import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { authError, requireUser } from "../_shared/auth";
import { assertShortText } from "../_shared/validate";

// shortcut: pilot caps 100 members, 20 programs and 20 workspaces/user; paginate before raising these limits.
export const MAX_MEMBERS = 100;
export const MAX_PROGRAMS = 20;
export const MAX_WORKSPACES = 20;

export const presets = {
  "interior-design": {
    label: "Interior design",
    institution: {
      program: "Persiapan karier desainer interior",
      participant: "Peserta",
      checklist: [
        { key: "cv", label: "CV desainer interior", route: "/dashboard/cv" },
        {
          key: "portfolio",
          label: "Portofolio proyek dan studi kasus",
          route: "/dashboard/portfolio",
        },
        {
          key: "brand",
          label: "Profil dan personal branding",
          route: "/dashboard/personal-branding",
        },
        {
          key: "presentation",
          label: "Presentasi konsep dan moodboard",
          route: "/dashboard/library",
        },
      ],
    },
    business: {
      program: "Kesiapan studio interior",
      participant: "Anggota",
      checklist: [
        {
          key: "profile",
          label: "Profil studio dan layanan",
          route: "/dashboard/personal-branding",
        },
        {
          key: "portfolio",
          label: "Portofolio studio",
          route: "/dashboard/portfolio",
        },
        {
          key: "proposal",
          label: "Proposal, lingkup kerja, dan estimasi",
          route: "/dashboard/library",
        },
        {
          key: "contract",
          label: "Draft kontrak dan hak penggunaan desain",
          route: "/dashboard/library",
        },
        {
          key: "documents",
          label: "Daftar dokumen usaha untuk ditinjau",
          route: "/dashboard/checklist",
        },
      ],
    },
  },
  hr: {
    label: "HR",
    institution: {
      program: "Program persiapan rekrutmen",
      participant: "Peserta",
      checklist: [
        { key: "cv", label: "CV yang dibagikan", route: "/dashboard/cv" },
        {
          key: "portfolio",
          label: "Portofolio yang dibagikan",
          route: "/dashboard/portfolio",
        },
        {
          key: "documents",
          label: "Dokumen pendukung pilihan peserta",
          route: "/dashboard/library",
        },
        {
          key: "interview",
          label: "Catatan persiapan wawancara",
          route: "/dashboard/interview",
        },
      ],
    },
    business: {
      program: "Pipeline peserta HR",
      participant: "Peserta",
      checklist: [
        { key: "cv", label: "CV yang dibagikan", route: "/dashboard/cv" },
        {
          key: "portfolio",
          label: "Portofolio yang dibagikan",
          route: "/dashboard/portfolio",
        },
        {
          key: "documents",
          label: "Dokumen pendukung pilihan peserta",
          route: "/dashboard/library",
        },
        {
          key: "interview",
          label: "Catatan persiapan wawancara",
          route: "/dashboard/interview",
        },
      ],
    },
  },
};

export function shortText(
  value: string,
  max: number,
  label: string,
  required = true,
) {
  try {
    const result = assertShortText(value, max, label);
    if (required && !result) throw new Error(`${label} wajib diisi`);
    return result;
  } catch (e) {
    throw authError(e instanceof Error ? e.message : "Input tidak valid");
  }
}

export async function verifiedUser(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user?.email || user.emailVerificationTime === undefined)
    throw authError(
      "Verifikasi email sebelum mengelola atau bergabung ke workspace.",
    );
  return { userId, user, email: user.email.trim().toLowerCase() };
}

export async function access(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  allowed?: Doc<"workspaceMembers">["role"][],
) {
  const userId = await requireUser(ctx);
  const workspace = await ctx.db.get(workspaceId);
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .unique();
  if (
    !workspace ||
    workspace.archivedAt ||
    !member ||
    (allowed && !allowed.includes(member.role))
  )
    throw authError("Workspace tidak tersedia atau Anda tidak memiliki akses.");
  return { userId, workspace, member };
}

export const MANAGERS: Doc<"workspaceMembers">["role"][] = ["owner", "admin"];
export const REVIEWERS: Doc<"workspaceMembers">["role"][] = [
  "owner",
  "admin",
  "mentor",
];

export async function programAccess(
  ctx: QueryCtx | MutationCtx,
  programId: Id<"workspacePrograms">,
  allowed?: Doc<"workspaceMembers">["role"][],
) {
  const program = await ctx.db.get(programId);
  if (!program) throw authError("Program tidak tersedia.");
  const scope = await access(ctx, program.workspaceId, allowed);
  if (scope.workspace.sector === "hr") {
    const vacancies = await ctx.db
      .query("workspaceRecords")
      .withIndex("by_workspace_resource", (q) =>
        q.eq("workspaceId", program.workspaceId).eq("resource", "vacancies"),
      )
      .take(200);
    const vacancy = vacancies.find((row) => row.programId === programId);
    if (
      vacancy &&
      (vacancy.archivedAt ||
        (scope.member.role === "member" && vacancy.status === "Draf"))
    )
      throw authError("Lowongan tidak tersedia.");
  }
  return { ...scope, program };
}

export async function activeSubmission(
  ctx: QueryCtx | MutationCtx,
  submission: Doc<"workspaceSubmissions">,
) {
  const member = await ctx.db.get(submission.memberId);
  return (
    member?.workspaceId === submission.workspaceId &&
    member.userId === submission.userId
  );
}

export async function selectedFile(
  ctx: QueryCtx | MutationCtx,
  fileId: Id<"files">,
  userId: Id<"users">,
) {
  const file = await ctx.db.get(fileId);
  if (
    !file ||
    file.uploadedBy !== userId ||
    file.tenantId !== userId.toString()
  )
    throw authError("Berkas tidak ditemukan.");
  const owners = await ctx.db
    .query("files")
    .withIndex("by_storage", (q) => q.eq("storageId", file.storageId))
    .take(2);
  if (owners.length !== 1) throw authError("Berkas tidak ditemukan.");
  return file;
}

export async function notifyMember(
  ctx: MutationCtx,
  member: Doc<"workspaceMembers">,
  programId: Id<"workspacePrograms">,
  title: string,
  targetView?: "schedules",
) {
  if (!member.inApp && !member.email) return;
  const id = await ctx.db.insert("workspaceNotifications", {
    workspaceId: member.workspaceId,
    memberId: member._id,
    userId: member.userId,
    programId,
    title,
    ...(targetView ? { targetView } : {}),
    read: false,
    createdAt: Date.now(),
    delivery: member.email ? "pending" : "manual",
  });
  if (member.email)
    await ctx.scheduler.runAfter(0, internal.workspaces.email.sendUpdate, {
      notificationId: id,
    });
}
