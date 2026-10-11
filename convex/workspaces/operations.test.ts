import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
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
async function setup(sector: "hr" | "interior-design" = "interior-design") {
  const t = convexTest(schema, modules);
  const owner = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Owner",
      email: "owner@test.example",
      emailVerificationTime: Date.now(),
    }),
  );
  const user = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Participant",
      email: "participant@test.example",
      emailVerificationTime: Date.now(),
    }),
  );
  const other = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "other@test.example",
      emailVerificationTime: Date.now(),
    }),
  );
  const alice = t.withIdentity({ subject: `${owner}|session` });
  const bob = t.withIdentity({ subject: `${user}|session` });
  const eve = t.withIdentity({ subject: `${other}|session` });
  const workspaceId = await alice.mutation(api.workspaces.mutations.create, {
    name: "Pilot QA",
    kind: "business",
    sector,
  });
  const invite = await alice.mutation(api.workspaces.mutations.invite, {
    workspaceId,
    email: "participant@test.example",
    role: "member",
    sendEmail: false,
  });
  await bob.mutation(api.workspaces.mutations.acceptInvite, {
    token: invite.token,
    consent: true,
  });
  return { t, alice, bob, eve, workspaceId };
}
describe("operational workspaces", () => {
  it("renames, prices, archives and restores without exposing archived data or reviving invites", async () => {
    const { alice, bob, eve, workspaceId } = await setup();
    await alice.mutation(api.workspaces.manage.update, {
      workspaceId,
      name: "Studio Baru",
      description: "Pilot",
      monthlyIDR: 299000,
    });
    expect(
      (await alice.query(api.workspaces.queries.listMine, {}))[0].name,
    ).toBe("Studio Baru");
    expect(
      await alice.query(api.workspaces.manage.settings, { workspaceId }),
    ).toEqual({ description: "Pilot", monthlyIDR: 299000 });
    await expect(
      bob.mutation(api.workspaces.manage.update, {
        workspaceId,
        name: "Denied",
        description: "",
        monthlyIDR: 0,
      }),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.workspaces.manage.update, {
        workspaceId,
        name: "Studio",
        description: "",
        monthlyIDR: -1,
      }),
    ).rejects.toThrow();
    const invite = await alice.mutation(api.workspaces.mutations.invite, {
      workspaceId,
      email: "other@test.example",
      role: "member",
      sendEmail: false,
    });
    await alice.mutation(api.workspaces.manage.archive, { workspaceId });
    expect(await bob.query(api.workspaces.queries.listMine, {})).toEqual([]);
    await expect(
      bob.query(api.workspaces.queries.get, { workspaceId }),
    ).rejects.toThrow();
    await expect(
      eve.mutation(api.workspaces.manage.restore, { workspaceId }),
    ).rejects.toThrow();
    expect(await alice.query(api.workspaces.manage.archived, {})).toHaveLength(
      1,
    );
    await alice.mutation(api.workspaces.manage.restore, { workspaceId });
    expect(await bob.query(api.workspaces.queries.listMine, {})).toHaveLength(
      1,
    );
    await expect(
      eve.mutation(api.workspaces.mutations.acceptInvite, {
        token: invite.token,
        consent: true,
      }),
    ).rejects.toThrow();
  });
  it("runs client → project → task/document CRUD, validates input and prevents cross-workspace references", async () => {
    const { alice, bob, eve, workspaceId } = await setup();
    const client = await alice.mutation(api.workspaces.records.save, {
      workspaceId,
      resource: "clients",
      title: "QA client",
      status: "Prospek",
      values: { email: "client@test.example" },
    });
    const project = await alice.mutation(api.workspaces.records.save, {
      workspaceId,
      resource: "projects",
      title: "QA project",
      status: "Brief",
      parentId: client,
      values: { scope: "Interior design", budget: "10000000" },
    });
    const task = await alice.mutation(api.workspaces.records.save, {
      workspaceId,
      resource: "tasks",
      title: "QA task",
      status: "Belum mulai",
      parentId: project,
      values: { due: "2026-10-20" },
    });
    await alice.mutation(api.workspaces.records.save, {
      workspaceId,
      id: task,
      resource: "tasks",
      title: "Updated task",
      status: "Selesai",
      parentId: project,
      values: {},
    });
    expect(
      (
        await bob.query(api.workspaces.records.list, {
          workspaceId,
          resource: "tasks",
        })
      )[0].title,
    ).toBe("Updated task");
    await expect(
      eve.query(api.workspaces.records.list, {
        workspaceId,
        resource: "clients",
      }),
    ).rejects.toThrow();
    await expect(
      bob.mutation(api.workspaces.records.save, {
        workspaceId,
        resource: "clients",
        title: "Denied",
        status: "Prospek",
        values: {},
      }),
    ).rejects.toThrow();
    const otherId = await eve.mutation(api.workspaces.mutations.create, {
      name: "Other",
      kind: "business",
      sector: "interior-design",
    });
    await expect(
      eve.mutation(api.workspaces.records.save, {
        workspaceId: otherId,
        resource: "projects",
        title: "Cross tenant",
        status: "Brief",
        parentId: client,
        values: { scope: "Secret" },
      }),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.workspaces.records.save, {
        workspaceId,
        resource: "tasks",
        title: "Bad date",
        status: "Belum mulai",
        parentId: project,
        values: { due: "2026-02-31" },
      }),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.workspaces.records.save, {
        workspaceId,
        resource: "clients",
        title: "Bad field",
        status: "Prospek",
        values: { admin: "true" },
      }),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.workspaces.records.save, {
        workspaceId,
        resource: "vacancies",
        title: "Wrong module",
        status: "Terbuka",
        values: { description: "Test" },
      }),
    ).rejects.toThrow();
    await alice.mutation(api.workspaces.records.setArchived, {
      id: client,
      archived: true,
    });
    expect(
      await bob.query(api.workspaces.records.list, {
        workspaceId,
        resource: "tasks",
      }),
    ).toEqual([]);
    await alice.mutation(api.workspaces.records.setArchived, {
      id: client,
      archived: false,
    });
    expect(
      await bob.query(api.workspaces.records.list, {
        workspaceId,
        resource: "tasks",
      }),
    ).toHaveLength(1);
    await alice.mutation(api.workspaces.records.setArchived, {
      id: task,
      archived: true,
    });
    expect(
      await alice.query(api.workspaces.records.list, {
        workspaceId,
        resource: "tasks",
        archived: true,
      }),
    ).toHaveLength(1);
    await alice.mutation(api.workspaces.records.setArchived, {
      id: task,
      archived: false,
    });
    expect(
      await alice.query(api.workspaces.records.list, {
        workspaceId,
        resource: "tasks",
      }),
    ).toHaveLength(1);
  });
  it("keeps applicants on Careerpack and hides schedules immediately after consent withdrawal", async () => {
    const { alice, bob, eve, workspaceId } = await setup("hr");
    const vacancyId = await alice.mutation(api.workspaces.records.save, {
      workspaceId,
      resource: "vacancies",
      title: "Designer",
      status: "Draf",
      values: { description: "Interior designer" },
    });
    const draft = (
      await alice.query(api.workspaces.records.list, {
        workspaceId,
        resource: "vacancies",
      })
    )[0];
    expect(
      await bob.query(api.workspaces.records.list, {
        workspaceId,
        resource: "vacancies",
      }),
    ).toEqual([]);
    expect(
      (
        await bob.query(api.workspaces.queries.get, { workspaceId })
      ).programs.some((p) => p._id === draft.programId),
    ).toBe(false);
    await expect(
      bob.query(api.workspaces.queries.listSubmissions, {
        programId: draft.programId!,
      }),
    ).rejects.toThrow();
    await alice.mutation(api.workspaces.records.save, {
      workspaceId,
      id: vacancyId,
      resource: "vacancies",
      title: "Designer",
      status: "Terbuka",
      values: { description: "Interior designer" },
    });
    const program = (
      await bob.query(api.workspaces.queries.get, { workspaceId })
    ).programs.find((p) => p._id === draft.programId)!;
    await expect(
      bob.mutation(api.workspaces.mutations.submit, {
        programId: program._id,
        entries: program.checklist.map((c) => ({
          key: c.key,
          done: true,
          note: "Explicit consent only",
        })),
        consent: false,
      }),
    ).rejects.toThrow();
    await bob.mutation(api.workspaces.mutations.submit, {
      programId: program._id,
      entries: program.checklist.map((c) => ({
        key: c.key,
        done: true,
        note: "Explicit consent only",
      })),
      consent: true,
    });
    const shared = (
      await alice.query(api.workspaces.queries.listSubmissions, {
        programId: program._id,
      })
    )[0];
    const schedule = await alice.mutation(api.workspaces.records.save, {
      workspaceId,
      resource: "schedules",
      title: "Wawancara",
      status: "Direncanakan",
      parentId: vacancyId,
      submissionId: shared._id,
      values: { date: "2026-10-20", time: "09:00", location: "Studio" },
    });
    expect(
      await bob.query(api.workspaces.records.list, {
        workspaceId,
        resource: "schedules",
      }),
    ).toHaveLength(1);
    expect(await bob.query(api.workspaces.queries.notifications, {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetView: "schedules",
          delivery: "manual",
        }),
      ]),
    );

    const invite = await alice.mutation(api.workspaces.mutations.invite, {
      workspaceId,
      email: "other@test.example",
      role: "member",
      sendEmail: false,
    });
    await eve.mutation(api.workspaces.mutations.acceptInvite, {
      token: invite.token,
      consent: true,
    });
    expect(
      await eve.query(api.workspaces.records.list, {
        workspaceId,
        resource: "schedules",
      }),
    ).toEqual([]);
    await bob.mutation(api.workspaces.mutations.withdraw, {
      submissionId: shared._id,
    });
    expect(
      await alice.query(api.workspaces.records.list, {
        workspaceId,
        resource: "schedules",
      }),
    ).toEqual([]);
    await expect(
      alice.mutation(api.workspaces.records.save, {
        workspaceId,
        id: schedule,
        resource: "schedules",
        title: "No consent",
        status: "Direncanakan",
        parentId: vacancyId,
        submissionId: shared._id,
        values: { date: "2026-10-20", time: "09:00", location: "Studio" },
      }),
    ).rejects.toThrow();
    await alice.mutation(api.workspaces.records.setArchived, {
      id: vacancyId,
      archived: true,
    });
    await expect(
      bob.query(api.workspaces.queries.listSubmissions, {
        programId: program._id,
      }),
    ).rejects.toThrow();
  });
});
