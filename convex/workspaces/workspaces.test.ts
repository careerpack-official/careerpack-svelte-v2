import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { sha256Base64Url } from "../_shared/pkce";
import { cascadeDeleteUser } from "../admin/lib/cascadeDelete";

const recursive = import.meta.glob("../**/*.{ts,js}");
const sameDir = Object.fromEntries(
  Object.entries(import.meta.glob("./*.{ts,js}")).map(([p, mod]) => [
    p.replace(/^\.\//, "../workspaces/"),
    mod,
  ]),
);
const modules = Object.fromEntries(
  Object.entries({ ...recursive, ...sameDir }).filter(
    ([p]) => !p.endsWith(".d.ts") && !/\.(test|spec|config)\./.test(p),
  ),
);
const setup = () => convexTest(schema, modules);
type Tester = ReturnType<typeof setup>;
const identity = (userId: string) => ({ subject: `${userId}|session` });
const user = (t: Tester, email: string, verified = true) =>
  t.run((ctx) =>
    ctx.db.insert("users", {
      name: email.split("@")[0],
      email,
      ...(verified ? { emailVerificationTime: Date.now() } : {}),
    }),
  );
const actor = (t: Tester, id: Id<"users">) => t.withIdentity(identity(id));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function fixture() {
  const t = setup();
  const owner = await user(t, "owner@example.test");
  const student = await user(t, "student@example.test");
  const stranger = await user(t, "stranger@example.test");
  const alice = actor(t, owner);
  const workspaceId = await alice.mutation(api.workspaces.mutations.create, {
    name: "Interior Academy",
    kind: "institution",
    sector: "interior-design",
  });
  const secondId = await actor(t, stranger).mutation(
    api.workspaces.mutations.create,
    { name: "HR workspace", kind: "business", sector: "hr" },
  );
  const invite = await alice.mutation(api.workspaces.mutations.invite, {
    workspaceId,
    email: "student@example.test",
    role: "member",
    sendEmail: false,
  });
  await actor(t, student).mutation(api.workspaces.mutations.acceptInvite, {
    token: invite.token,
    consent: true,
  });
  const detail = await alice.query(api.workspaces.queries.get, { workspaceId });
  const program = detail.programs[0];
  const entries = program.checklist.map((c) => ({
    key: c.key,
    done: true,
    note: "Explicitly shared note",
  }));
  return {
    t,
    owner,
    student,
    stranger,
    workspaceId,
    secondId,
    program,
    entries,
    alice,
    bob: actor(t, student),
    eve: actor(t, stranger),
  };
}

async function file(t: Tester, uploadedBy: Id<"users">, name = "selected.pdf") {
  return t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["%PDF-1.7\nShared test bytes"], { type: "application/pdf" }),
    );
    return ctx.db.insert("files", {
      storageId,
      fileName: name,
      fileType: "application/pdf",
      fileSize: 32,
      uploadedBy,
      tenantId: uploadedBy.toString(),
      createdAt: Date.now(),
    });
  });
}

describe("workspace access and personal privacy", () => {
  it("a participant cannot read another participant's submission; a mentor can review but cannot administer", async () => {
    const f = await fixture();
    const id = await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    const invitation = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "stranger@example.test",
      role: "member",
      sendEmail: false,
    });
    await f.eve.mutation(api.workspaces.mutations.acceptInvite, {
      token: invitation.token,
      consent: true,
    });
    expect(
      await f.eve.query(api.workspaces.queries.listSubmissions, {
        programId: f.program._id,
      }),
    ).toEqual([]);
    const member = (
      await f.alice.query(api.workspaces.queries.get, {
        workspaceId: f.workspaceId,
      })
    ).members.find((m) => m.name === "stranger")!;
    await f.alice.mutation(api.workspaces.mutations.setMemberRole, {
      memberId: member._id,
      role: "mentor",
    });
    await f.eve.mutation(api.workspaces.mutations.review, {
      submissionId: id,
      status: "reviewed",
      feedback: "Tinjauan mentor",
    });
    expect(
      (
        await f.bob.query(api.workspaces.queries.listSubmissions, {
          programId: f.program._id,
        })
      )[0].feedback,
    ).toBe("Tinjauan mentor");
    await expect(
      f.eve.mutation(api.workspaces.mutations.createProgram, {
        workspaceId: f.workspaceId,
        title: "Blocked",
        description: "",
      }),
    ).rejects.toThrow(/akses/);
  });
  it("keeps personal data private and denies workspace ID substitution, including platform admins", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.insert("userProfiles", {
        userId: f.stranger,
        fullName: "Platform admin",
        location: "",
        targetRole: "",
        experienceLevel: "",
        role: "admin",
      }),
    );
    expect(
      (
        await f.bob.query(api.workspaces.queries.get, {
          workspaceId: f.workspaceId,
        })
      ).members,
    ).toEqual([]);
    expect(
      (await f.bob.query(api.workspaces.queries.listMine, {})).map(
        (w) => w._id,
      ),
    ).toEqual([f.workspaceId]);
    await expect(
      f.eve.query(api.workspaces.queries.get, { workspaceId: f.workspaceId }),
    ).rejects.toThrow(/akses/);
    await expect(
      f.bob.query(api.workspaces.queries.get, { workspaceId: f.secondId }),
    ).rejects.toThrow(/akses/);
    await expect(
      f.bob.mutation(api.workspaces.mutations.createProgram, {
        workspaceId: f.workspaceId,
        title: "Forbidden",
        description: "",
      }),
    ).rejects.toThrow(/akses/);
    expect(await f.t.query(api.workspaces.queries.listMine, {})).toEqual([]);
    await expect(
      f.t.mutation(api.workspaces.mutations.create, {
        name: "Anon",
        kind: "business",
        sector: "hr",
      }),
    ).rejects.toThrow(/terautentikasi/);
  });

  it("separates submissions by program and participant; reviews are manual and self-review is denied", async () => {
    const f = await fixture();
    const id = await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    await expect(
      f.eve.query(api.workspaces.queries.listSubmissions, {
        programId: f.program._id,
      }),
    ).rejects.toThrow(/akses/);
    await expect(
      f.bob.mutation(api.workspaces.mutations.review, {
        submissionId: id,
        status: "reviewed",
        feedback: "No",
      }),
    ).rejects.toThrow(/akses/);
    await f.alice.mutation(api.workspaces.mutations.review, {
      submissionId: id,
      status: "needs_update",
      feedback: "Lengkapi portofolio",
    });
    expect(
      (
        await f.bob.query(api.workspaces.queries.listSubmissions, {
          programId: f.program._id,
        })
      )[0].feedback,
    ).toBe("Lengkapi portofolio");
    expect(
      (await f.bob.query(api.workspaces.queries.notifications, {}))[0].title,
    ).not.toContain("portofolio");
    await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    expect(
      (
        await f.alice.query(api.workspaces.queries.listSubmissions, {
          programId: f.program._id,
        })
      )[0].status,
    ).toBe("submitted");
    const own = await f.alice.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    await expect(
      f.alice.mutation(api.workspaces.mutations.review, {
        submissionId: own,
        status: "reviewed",
        feedback: "No",
      }),
    ).rejects.toThrow(/sendiri/);
  });

  it("requires consent, correct keys, bounded text, and honors closed programs", async () => {
    const f = await fixture();
    await expect(
      f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        entries: f.entries,
        consent: false,
      }),
    ).rejects.toThrow(/persetujuan/i);
    await expect(
      f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        entries: [...f.entries, f.entries[0]],
        consent: true,
      }),
    ).rejects.toThrow(/Checklist/);
    await expect(
      f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        entries: f.entries.map((e) => ({ ...e, key: "forged" })),
        consent: true,
      }),
    ).rejects.toThrow(/Checklist/);
    await expect(
      f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        entries: f.entries.map((e) => ({ ...e, note: "x".repeat(2001) })),
        consent: true,
      }),
    ).rejects.toThrow(/2000/);
    await expect(
      f.alice.mutation(api.workspaces.mutations.createProgram, {
        workspaceId: f.workspaceId,
        title: "bad\0title",
        description: "",
      }),
    ).rejects.toThrow(/valid/);
    await f.alice.mutation(api.workspaces.mutations.setProgramClosed, {
      programId: f.program._id,
      closed: true,
    });
    await expect(
      f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        entries: f.entries,
        consent: true,
      }),
    ).rejects.toThrow(/ditutup/);
    await f.alice.mutation(api.workspaces.mutations.setProgramClosed, {
      programId: f.program._id,
      closed: false,
    });
    expect(
      await f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        entries: f.entries,
        consent: true,
      }),
    ).toBeTruthy();
  });

  it("uses institution/business/HR presets without giving extra permissions", async () => {
    const f = await fixture();
    const business = await f.alice.mutation(api.workspaces.mutations.create, {
      name: "Interior studio",
      kind: "business",
      sector: "interior-design",
    });
    expect(
      (
        await f.alice.query(api.workspaces.queries.get, {
          workspaceId: business,
        })
      ).programs[0].checklist.map((c) => c.key),
    ).toContain("contract");
    expect(
      (
        await f.eve.query(api.workspaces.queries.get, {
          workspaceId: f.secondId,
        })
      ).programs[0].checklist.map((c) => c.key),
    ).toContain("interview");
    expect(
      (await f.alice.query(api.workspaces.queries.configuration, {})).presets,
    ).toHaveLength(4);
  });
});

describe("workspace invitation and membership lifecycle", () => {
  it("enforces the member cap before accepting another participant", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 98; i++) {
        const userId = await ctx.db.insert("users", {
          email: `synthetic-${i}@example.test`,
          emailVerificationTime: 1,
        });
        await ctx.db.insert("workspaceMembers", {
          workspaceId: f.workspaceId,
          userId,
          role: "member",
          inApp: true,
          email: false,
          joinedAt: Date.now(),
        });
      }
    });
    const invitation = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "stranger@example.test",
      role: "member",
      sendEmail: false,
    });
    await expect(
      f.eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: invitation.token,
        consent: true,
      }),
    ).rejects.toThrow(/100 anggota/);
  });
  it("binds invitation to verified email; rejects expiry, replay, revoked tokens and silent escalation", async () => {
    const f = await fixture();
    const pending = await user(f.t, "pending@example.test", false);
    const invitation = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "pending@example.test",
      role: "member",
      sendEmail: false,
    });
    expect(
      await actor(f.t, pending).query(api.workspaces.queries.previewInvite, {
        token: invitation.token,
      }),
    ).toBeNull();
    await expect(
      actor(f.t, pending).mutation(api.workspaces.mutations.acceptInvite, {
        token: invitation.token,
        consent: true,
      }),
    ).rejects.toThrow(/Verifikasi/);
    await expect(
      f.eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: invitation.token,
        consent: true,
      }),
    ).rejects.toThrow(/akun ini/);
    await f.t.run((ctx) =>
      ctx.db.patch(pending, { emailVerificationTime: Date.now() }),
    );
    expect(
      (
        await actor(f.t, pending).query(api.workspaces.queries.previewInvite, {
          token: invitation.token,
        })
      )?.name,
    ).toBe("Interior Academy");
    await expect(
      actor(f.t, pending).mutation(api.workspaces.mutations.acceptInvite, {
        token: invitation.token,
        consent: false,
      }),
    ).rejects.toThrow(/Persetujuan/);
    await actor(f.t, pending).mutation(api.workspaces.mutations.acceptInvite, {
      token: invitation.token,
      consent: true,
    });
    await expect(
      actor(f.t, pending).mutation(api.workspaces.mutations.acceptInvite, {
        token: invitation.token,
        consent: true,
      }),
    ).rejects.toThrow(/berlaku/);
    const escalation = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "student@example.test",
      role: "admin",
      sendEmail: false,
    });
    await f.bob.mutation(api.workspaces.mutations.acceptInvite, {
      token: escalation.token,
      consent: true,
    });
    expect(
      (await f.bob.query(api.workspaces.queries.listMine, {}))[0].role,
    ).toBe("member");
    const expires = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "stranger@example.test",
      role: "member",
      sendEmail: false,
    });
    vi.useFakeTimers();
    vi.setSystemTime(expires.expiresAt + 1);
    await expect(
      f.eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: expires.token,
        consent: true,
      }),
    ).rejects.toThrow(/kedaluwarsa/);
  });

  it("requires a current inviter and keeps admin assignment owner-only", async () => {
    const f = await fixture();
    const studentMember = (
      await f.alice.query(api.workspaces.queries.get, {
        workspaceId: f.workspaceId,
      })
    ).members.find((m) => m.role === "member")!;
    await f.alice.mutation(api.workspaces.mutations.setMemberRole, {
      memberId: studentMember._id,
      role: "admin",
    });
    await expect(
      f.bob.mutation(api.workspaces.mutations.invite, {
        workspaceId: f.workspaceId,
        email: "stranger@example.test",
        role: "admin",
        sendEmail: false,
      }),
    ).rejects.toThrow(/pemilik/);
    const invitation = await f.bob.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "stranger@example.test",
      role: "member",
      sendEmail: false,
    });
    await f.alice.mutation(api.workspaces.mutations.setMemberRole, {
      memberId: studentMember._id,
      role: "member",
    });
    expect(
      await f.eve.query(api.workspaces.queries.previewInvite, {
        token: invitation.token,
      }),
    ).toBeNull();
    await expect(
      f.eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: invitation.token,
        consent: true,
      }),
    ).rejects.toThrow(/berlaku/);
    const ownerMember = (
      await f.alice.query(api.workspaces.queries.get, {
        workspaceId: f.workspaceId,
      })
    ).members.find((m) => m.role === "owner")!;
    await expect(
      f.alice.mutation(api.workspaces.mutations.removeMember, {
        memberId: ownerMember._id,
      }),
    ).rejects.toThrow(/menghapus/);
    await expect(
      f.alice.mutation(api.workspaces.mutations.leave, {
        workspaceId: f.workspaceId,
      }),
    ).rejects.toThrow(/Pemilik/);
  });

  it("revokes the old invite when replacing it and permits explicit cancellation", async () => {
    const f = await fixture();
    const first = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "stranger@example.test",
      role: "member",
      sendEmail: false,
    });
    const second = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "STRANGER@example.test",
      role: "member",
      sendEmail: false,
    });
    await expect(
      f.eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: first.token,
        consent: true,
      }),
    ).rejects.toThrow(/berlaku/);
    const row = (
      await f.alice.query(api.workspaces.queries.get, {
        workspaceId: f.workspaceId,
      })
    ).invites[0];
    await f.alice.mutation(api.workspaces.mutations.revokeInvite, {
      inviteId: row._id,
    });
    await expect(
      f.eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: second.token,
        consent: true,
      }),
    ).rejects.toThrow(/berlaku/);
    const stored = await f.t.run((ctx) => ctx.db.get(row._id));
    expect(stored?.tokenHash).not.toBe(second.token);
  });

  it("allows a participant to leave, removes grants, and defaults email to off", async () => {
    const f = await fixture();
    expect(
      (await f.bob.query(api.workspaces.queries.listMine, {}))[0],
    ).toMatchObject({ inApp: true, email: false });
    await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    await f.bob.mutation(api.workspaces.mutations.leave, {
      workspaceId: f.workspaceId,
    });
    expect(await f.bob.query(api.workspaces.queries.listMine, {})).toEqual([]);
    expect(
      await f.alice.query(api.workspaces.queries.listSubmissions, {
        programId: f.program._id,
      }),
    ).toEqual([]);
    await expect(
      f.bob.query(api.workspaces.queries.get, { workspaceId: f.workspaceId }),
    ).rejects.toThrow(/akses/);
  });
});

describe("selected file grants and revocation", () => {
  it("rejects foreign files and serves only explicitly shared bytes without permanent URLs", async () => {
    const f = await fixture();
    const foreign = await file(f.t, f.stranger);
    const shared = await file(f.t, f.student);
    const hidden = await file(f.t, f.student, "private.pdf");
    await expect(
      f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        consent: true,
        entries: f.entries.map((e) => ({ ...e, fileId: foreign })),
      }),
    ).rejects.toThrow(/Berkas/);
    const id = await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      consent: true,
      entries: f.entries.map((e, i) => (i ? e : { ...e, fileId: shared })),
    });
    const rows = await f.alice.query(api.workspaces.queries.listSubmissions, {
      programId: f.program._id,
    });
    expect(rows[0].files).toEqual([{ _id: shared, name: "selected.pdf" }]);
    expect(JSON.stringify(rows)).not.toContain("private.pdf");
    expect(JSON.stringify(rows)).not.toContain(".convex.cloud");
    await expect(
      f.alice.mutation(api.workspaces.mutations.fileTicket, {
        submissionId: id,
        fileId: hidden,
      }),
    ).rejects.toThrow(/Berkas/);
    await expect(
      f.eve.mutation(api.workspaces.mutations.fileTicket, {
        submissionId: id,
        fileId: shared,
      }),
    ).rejects.toThrow(/akses/);
    const { token } = await f.alice.mutation(
      api.workspaces.mutations.fileTicket,
      { submissionId: id, fileId: shared },
    );
    const response = await f.t.fetch(`/workspaces/files/read?t=${token}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-disposition")).toContain(
      "attachment;",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).toContain("Shared test bytes");
    expect(
      (await f.bob.query(api.files.queries.listMyFiles, {})).find(
        (r) => r._id === shared,
      )?.usedIn,
    ).toContain("Kiriman workspace");
  });

  it.each([
    "withdraw",
    "offboard",
    "reviewer-left",
    "resubmit",
    "expire",
    "file-delete",
    "role-demotion",
  ] as const)("invalidates issued download links after %s", async (mode) => {
    const f = await fixture();
    const shared = await file(f.t, f.student);
    const entries = f.entries.map((e, i) => (i ? e : { ...e, fileId: shared }));
    const id = await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      consent: true,
      entries,
    });
    let reviewer = f.alice;
    if (mode === "reviewer-left" || mode === "role-demotion") {
      const invite = await f.alice.mutation(api.workspaces.mutations.invite, {
        workspaceId: f.workspaceId,
        email: "stranger@example.test",
        role: "mentor",
        sendEmail: false,
      });
      await f.eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: invite.token,
        consent: true,
      });
      reviewer = f.eve;
    }
    const { token, expiresAt } = await reviewer.mutation(
      api.workspaces.mutations.fileTicket,
      { submissionId: id, fileId: shared },
    );
    if (mode === "withdraw")
      await f.bob.mutation(api.workspaces.mutations.withdraw, {
        submissionId: id,
      });
    if (mode === "offboard") {
      const member = (
        await f.alice.query(api.workspaces.queries.get, {
          workspaceId: f.workspaceId,
        })
      ).members.find((m) => m.role === "member")!;
      await f.alice.mutation(api.workspaces.mutations.removeMember, {
        memberId: member._id,
      });
    }
    if (mode === "reviewer-left")
      await f.eve.mutation(api.workspaces.mutations.leave, {
        workspaceId: f.workspaceId,
      });
    if (mode === "resubmit")
      await f.bob.mutation(api.workspaces.mutations.submit, {
        programId: f.program._id,
        entries,
        consent: true,
      });
    if (mode === "expire") {
      vi.useFakeTimers();
      vi.setSystemTime(expiresAt + 1);
    }
    if (mode === "file-delete") await f.t.run((ctx) => ctx.db.delete(shared));
    if (mode === "role-demotion") {
      const member = (
        await f.alice.query(api.workspaces.queries.get, {
          workspaceId: f.workspaceId,
        })
      ).members.find((m) => m.role === "mentor")!;
      await f.alice.mutation(api.workspaces.mutations.setMemberRole, {
        memberId: member._id,
        role: "member",
      });
    }
    expect((await f.t.fetch(`/workspaces/files/read?t=${token}`)).status).toBe(
      404,
    );
    expect(
      await f.t.query(internal.workspaces.queries.resolveTicket, {
        hash: await sha256Base64Url(token),
      }),
    ).toBeNull();
  });

  it("account erasure archives owned workspaces and removes membership and private grants", async () => {
    const f = await fixture();
    await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    await f.t.run((ctx) => cascadeDeleteUser(ctx, f.student));
    expect(
      await f.alice.query(api.workspaces.queries.listSubmissions, {
        programId: f.program._id,
      }),
    ).toEqual([]);
    await f.t.run((ctx) => cascadeDeleteUser(ctx, f.owner));
    expect(await f.t.run((ctx) => ctx.db.get(f.workspaceId))).toMatchObject({
      archivedAt: expect.any(Number),
    });
  });
});

describe("workspace notifications and email", () => {
  it("prunes expired tickets, verification tokens, and old notifications without deleting recent updates", async () => {
    const f = await fixture();
    const id = await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    const member = (
      await f.alice.query(api.workspaces.queries.get, {
        workspaceId: f.workspaceId,
      })
    ).members.find((m) => m.role === "member")!;
    const fileId = await file(f.t, f.student);
    const ticketId = await f.t.run((ctx) =>
      ctx.db.insert("workspaceFileTickets", {
        userId: f.student,
        memberId: member._id,
        submissionId: id,
        fileId,
        revision: 1,
        tokenHash: "expired",
        expiresAt: Date.now() - 1,
      }),
    );
    const verifyId = await f.t.run((ctx) =>
      ctx.db.insert("workspaceEmailVerifications", {
        userId: f.student,
        email: "student@example.test",
        tokenHash: "expired",
        expiresAt: Date.now() - 1,
        delivery: "sent",
      }),
    );
    const noticeId = await f.t.run((ctx) =>
      ctx.db.insert("workspaceNotifications", {
        workspaceId: f.workspaceId,
        userId: f.student,
        memberId: member._id,
        programId: f.program._id,
        title: "Old",
        read: true,
        delivery: "manual",
        createdAt: Date.now() - 31 * 86_400_000,
      }),
    );
    await f.t.mutation(internal.workspaces.cleanup.prune, {});
    expect(await f.t.run((ctx) => ctx.db.get(ticketId))).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.get(verifyId))).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.get(noticeId))).toBeNull();
    expect(
      await f.alice.query(api.workspaces.queries.notifications, {}),
    ).toHaveLength(1);
  });
  function configured() {
    vi.stubEnv("RESEND_API_KEY", "test-only-not-live");
    vi.stubEnv("EMAIL_FROM", "Careerpack <hello@example.test>");
    vi.stubEnv("APP_URL", "https://careerpack.example.test");
  }

  it("verifies password accounts through a bound, expiring email token without changing credentials", async () => {
    const t = setup();
    configured();
    vi.useFakeTimers();
    const pending = await user(t, "pending@example.test", false);
    const other = await user(t, "other@example.test", false);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "mock-verify" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await actor(t, pending).mutation(
      api.workspaces.emailVerification.request,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      html: string;
    };
    const token = sent.html.match(/verify=([a-f0-9]{64})/)?.[1];
    expect(token).toBeTruthy();
    const row = await t.run((ctx) =>
      ctx.db.query("workspaceEmailVerifications").first(),
    );
    expect(row?.tokenHash).not.toBe(token);
    expect(row?.delivery).toBe("sent");
    await expect(
      actor(t, other).mutation(api.workspaces.emailVerification.verify, {
        token: token!,
      }),
    ).rejects.toThrow(/akun ini/);
    await actor(t, pending).mutation(api.workspaces.emailVerification.verify, {
      token: token!,
    });
    expect(
      (await actor(t, pending).query(api.workspaces.queries.configuration, {}))
        .emailVerified,
    ).toBe(true);
    await expect(
      actor(t, pending).mutation(api.workspaces.emailVerification.verify, {
        token: token!,
      }),
    ).rejects.toThrow(/berlaku/);
    expect(
      await t.run((ctx) => ctx.db.query("authAccounts").collect()),
    ).toEqual([]);
  });

  it("reports verification delivery failure and refuses an expired token", async () => {
    const t = setup();
    configured();
    vi.useFakeTimers();
    const pending = await user(t, "pending@example.test", false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Failure", { status: 500 })),
    );
    await actor(t, pending).mutation(
      api.workspaces.emailVerification.request,
      {},
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (await actor(t, pending).query(api.workspaces.queries.configuration, {}))
        .verificationDelivery,
    ).toBe("failed");
    const token = "a".repeat(64);
    await t.run((ctx) =>
      ctx.db.insert("workspaceEmailVerifications", {
        userId: pending,
        email: "pending@example.test",
        tokenHash: "",
        expiresAt: Date.now() - 1,
        delivery: "sent",
      }),
    );
    const hash = await sha256Base64Url(token);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("workspaceEmailVerifications")
        .order("desc")
        .first();
      await ctx.db.patch(row!._id, { tokenHash: hash });
    });
    await expect(
      actor(t, pending).mutation(api.workspaces.emailVerification.verify, {
        token,
      }),
    ).rejects.toThrow(/kedaluwarsa/);
  });

  it("honors workspace preferences and hides notifications after offboarding", async () => {
    const f = await fixture();
    await f.alice.mutation(api.workspaces.mutations.preferences, {
      workspaceId: f.workspaceId,
      inApp: false,
      email: false,
    });
    const id = await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    expect(
      await f.alice.query(api.workspaces.queries.notifications, {}),
    ).toEqual([]);
    await f.alice.mutation(api.workspaces.mutations.review, {
      submissionId: id,
      status: "reviewed",
      feedback: "Private review note",
    });
    const notice = (
      await f.bob.query(api.workspaces.queries.notifications, {})
    )[0];
    await expect(
      f.eve.mutation(api.workspaces.mutations.readNotification, {
        id: notice._id,
      }),
    ).rejects.toThrow(/tidak ditemukan/);
    await f.bob.mutation(api.workspaces.mutations.readNotification, {
      id: notice._id,
    });
    expect(
      (await f.bob.query(api.workspaces.queries.notifications, {}))[0].read,
    ).toBe(true);
    await f.bob.mutation(api.workspaces.mutations.leave, {
      workspaceId: f.workspaceId,
    });
    expect(await f.bob.query(api.workspaces.queries.notifications, {})).toEqual(
      [],
    );
  });

  it("renders an escaped invite, records provider failures honestly, and never sends without config", async () => {
    const f = await fixture();
    await expect(
      f.alice.mutation(api.workspaces.mutations.invite, {
        workspaceId: f.workspaceId,
        email: "stranger@example.test",
        role: "member",
        sendEmail: true,
      }),
    ).rejects.toThrow(/dikonfigurasi/);
    configured();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "mock-id" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await f.t.run((ctx) =>
      ctx.db.patch(f.workspaceId, { name: "<script>bad</script>" }),
    );
    const invite = await f.alice.mutation(api.workspaces.mutations.invite, {
      workspaceId: f.workspaceId,
      email: "stranger@example.test",
      role: "member",
      sendEmail: false,
    });
    const row = (
      await f.alice.query(api.workspaces.queries.get, {
        workspaceId: f.workspaceId,
      })
    ).invites[0];
    await f.t.action(internal.workspaces.email.sendInvite, {
      inviteId: row._id,
      token: invite.token,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      html: string;
      text: string;
    };
    expect(sent.html).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(sent.html).not.toContain("<script>bad</script>");
    expect(sent.text).toContain(invite.token);
    expect(await f.t.run((ctx) => ctx.db.get(row._id))).toMatchObject({
      delivery: "sent",
    });
    fetchMock.mockResolvedValue(new Response("Rejected", { status: 401 }));
    await f.t.action(internal.workspaces.email.sendInvite, {
      inviteId: row._id,
      token: invite.token,
    });
    expect(await f.t.run((ctx) => ctx.db.get(row._id))).toMatchObject({
      delivery: "failed",
    });
  });

  it("sends no private review content and respects unsubscribe, opt-out and revoked membership", async () => {
    const f = await fixture();
    configured();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "mock-id" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const id = await f.bob.mutation(api.workspaces.mutations.submit, {
      programId: f.program._id,
      entries: f.entries,
      consent: true,
    });
    await f.alice.mutation(api.workspaces.mutations.review, {
      submissionId: id,
      status: "needs_update",
      feedback: "SECRET PRIVATE REVIEW",
    });
    const notice = (
      await f.bob.query(api.workspaces.queries.notifications, {})
    )[0];
    await f.bob.mutation(api.workspaces.mutations.preferences, {
      workspaceId: f.workspaceId,
      inApp: true,
      email: true,
    });
    await f.t.run((ctx) => ctx.db.patch(notice._id, { delivery: "pending" }));
    await f.t.action(internal.workspaces.email.sendUpdate, {
      notificationId: notice._id,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      "SECRET PRIVATE REVIEW",
    );
    await f.t.mutation(internal.admin.unsubscribes._markUnsubscribed, {
      email: "student@example.test",
      source: "user_one_click",
    });
    await f.t.run((ctx) => ctx.db.patch(notice._id, { delivery: "pending" }));
    await f.t.action(internal.workspaces.email.sendUpdate, {
      notificationId: notice._id,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await f.t.run((ctx) => ctx.db.get(notice._id))).toMatchObject({
      delivery: "suppressed",
    });
    await f.bob.mutation(api.workspaces.mutations.leave, {
      workspaceId: f.workspaceId,
    });
    await f.t.action(internal.workspaces.email.sendUpdate, {
      notificationId: notice._id,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
