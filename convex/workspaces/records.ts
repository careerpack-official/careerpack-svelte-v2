import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { authError } from "../_shared/auth";
import { enforceRateLimit } from "../_shared/rateLimit";
import {
  access,
  notifyMember,
  activeSubmission,
  MANAGERS,
  MAX_PROGRAMS,
  presets,
  REVIEWERS,
  shortText,
} from "./lib";
import { resourcesFor } from "./modules/catalog";

// shortcut: 200 records/resource including archives; paginate before increasing the pilot cap.
const LIMIT = 200;
const recordSummary = v.object({
  _id: v.id("workspaceRecords"),
  resource: v.string(),
  title: v.string(),
  status: v.string(),
  values: v.record(v.string(), v.string()),
  parentId: v.optional(v.id("workspaceRecords")),
  programId: v.optional(v.id("workspacePrograms")),
  submissionId: v.optional(v.id("workspaceSubmissions")),
  archivedAt: v.optional(v.number()),
});
function resourceFor(w: Doc<"workspaces">, key: string) {
  const result = resourcesFor(w.kind, w.sector).find((r) => r.key === key);
  if (!result) throw authError("Module tidak tersedia di workspace ini.");
  return result;
}
async function visible(
  ctx: QueryCtx | MutationCtx,
  record: Doc<"workspaceRecords">,
) {
  let row = record;
  for (let depth = 0; depth < 3; depth++) {
    if (row.archivedAt) return false;
    if (!row.parentId) return true;
    const parent = await ctx.db.get(row.parentId);
    if (!parent || parent.workspaceId !== record.workspaceId) return false;
    row = parent;
  }
  return false;
}
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    resource: v.string(),
    archived: v.optional(v.boolean()),
  },
  returns: v.array(recordSummary),
  handler: async (ctx, args) => {
    const { workspace, member, userId } = await access(ctx, args.workspaceId);
    resourceFor(workspace, args.resource);
    const reviewer = REVIEWERS.includes(member.role);
    if (workspace.sector === "hr" && !reviewer && args.archived) return [];
    const rows = await ctx.db
      .query("workspaceRecords")
      .withIndex("by_workspace_resource", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("resource", args.resource),
      )
      .order("desc")
      .take(LIMIT);
    const result = [];
    for (const row of rows) {
      if (args.archived ? !row.archivedAt : !(await visible(ctx, row)))
        continue;
      if (row.submissionId) {
        const shared = await ctx.db.get(row.submissionId);
        if (
          !shared ||
          shared.workspaceId !== args.workspaceId ||
          !(await activeSubmission(ctx, shared)) ||
          (!reviewer && shared.userId !== userId)
        )
          continue;
      }
      if (
        workspace.sector === "hr" &&
        !reviewer &&
        row.resource === "vacancies" &&
        row.status !== "Terbuka"
      )
        continue;
      result.push({
        _id: row._id,
        resource: row.resource,
        title: row.title,
        status: row.status,
        values: row.values,
        ...(row.parentId ? { parentId: row.parentId } : {}),
        ...(row.programId ? { programId: row.programId } : {}),
        ...(row.submissionId ? { submissionId: row.submissionId } : {}),
        ...(row.archivedAt ? { archivedAt: row.archivedAt } : {}),
      });
    }
    return result;
  },
});
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.optional(v.id("workspaceRecords")),
    resource: v.string(),
    title: v.string(),
    status: v.string(),
    values: v.record(v.string(), v.string()),
    parentId: v.optional(v.id("workspaceRecords")),
    submissionId: v.optional(v.id("workspaceSubmissions")),
  },
  returns: v.id("workspaceRecords"),
  handler: async (ctx, args) => {
    const { workspace, userId } = await access(ctx, args.workspaceId, MANAGERS);
    const spec = resourceFor(workspace, args.resource);
    const title = shortText(args.title, 120, "Nama");
    if (!spec.states.includes(args.status))
      throw authError("Status tidak valid.");
    if (
      Object.keys(args.values).some(
        (key) => !spec.fields.some((f) => f.key === key),
      )
    )
      throw authError("Kolom tidak tersedia di module ini.");
    const values: Record<string, string> = {};
    for (const field of spec.fields) {
      const value = shortText(
        args.values[field.key] ?? "",
        field.type === "textarea" ? 6000 : 500,
        field.label,
        field.required ?? false,
      );
      if (
        value &&
        field.type === "number" &&
        (!/^\d+$/.test(value) ||
          !Number.isSafeInteger(Number(value)) ||
          Number(value) > 1_000_000_000_000)
      )
        throw authError(`${field.label} tidak valid.`);
      if (
        value &&
        field.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw authError(`${field.label} tidak valid.`);
      if (
        value &&
        field.type === "email" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )
        throw authError("Email tidak valid.");
      if (field.key === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        throw authError("Jam harus HH:mm dalam WIB.");
      values[field.key] = value;
    }
    const parent = args.parentId ? await ctx.db.get(args.parentId) : null;
    if (
      spec.parent
        ? !parent ||
          parent.resource !== spec.parent ||
          parent.workspaceId !== args.workspaceId ||
          !(await visible(ctx, parent))
        : !!parent || !!args.parentId
    )
      throw authError(
        "Pilih klien, proyek, atau lowongan aktif dari workspace yang sama.",
      );
    if (args.resource === "schedules") {
      const shared = args.submissionId
        ? await ctx.db.get(args.submissionId)
        : null;
      if (
        !shared ||
        shared.workspaceId !== args.workspaceId ||
        shared.programId !== parent?.programId ||
        !(await activeSubmission(ctx, shared))
      )
        throw authError("Pilih kiriman peserta aktif untuk lowongan ini.");
    } else if (args.submissionId)
      throw authError("Kiriman peserta hanya untuk jadwal HR.");
    const old = args.id ? await ctx.db.get(args.id) : null;
    if (
      args.id &&
      (!old ||
        old.workspaceId !== args.workspaceId ||
        old.resource !== args.resource ||
        old.archivedAt)
    )
      throw authError("Data tidak tersedia.");
    const siblings = await ctx.db
      .query("workspaceRecords")
      .withIndex("by_workspace_resource", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("resource", args.resource),
      )
      .take(LIMIT);
    if (!old && siblings.length >= LIMIT)
      throw authError("Batas pilot 200 data per module tercapai.");
    await enforceRateLimit(ctx, userId, {
      key: "workspace:record",
      max: 120,
      windowMs: 3_600_000,
    });
    let programId = old?.programId;
    if (args.resource === "vacancies") {
      if (!programId) {
        const programs = await ctx.db
          .query("workspacePrograms")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", args.workspaceId),
          )
          .take(MAX_PROGRAMS);
        if (programs.length >= MAX_PROGRAMS)
          throw authError("Batas pilot 20 program/lowongan tercapai.");
        programId = await ctx.db.insert("workspacePrograms", {
          workspaceId: args.workspaceId,
          title,
          description: values.description,
          checklist: presets.hr[workspace.kind].checklist,
          createdAt: Date.now(),
          createdBy: userId,
          closed: args.status !== "Terbuka",
        });
      } else
        await ctx.db.patch(programId, {
          title,
          description: values.description,
          closed: args.status !== "Terbuka",
        });
    }
    const payload = {
      title,
      status: args.status,
      values,
      parentId: args.parentId,
      submissionId: args.submissionId,
      programId,
      updatedAt: Date.now(),
    };
    if (args.submissionId) {
      const shared = await ctx.db.get(args.submissionId);
      const recipient = shared ? await ctx.db.get(shared.memberId) : null;
      if (recipient && shared)
        await notifyMember(
          ctx,
          recipient,
          shared.programId,
          "Jadwal wawancara diperbarui. Buka jadwal di workspace.",
          "schedules",
        );
    }
    if (old) {
      await ctx.db.patch(old._id, payload);
      return old._id;
    }
    return await ctx.db.insert("workspaceRecords", {
      workspaceId: args.workspaceId,
      resource: args.resource,
      ...payload,
      createdAt: Date.now(),
    });
  },
});
export const setArchived = mutation({
  args: { id: v.id("workspaceRecords"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) throw authError("Data tidak tersedia.");
    await access(ctx, row.workspaceId, MANAGERS);
    await ctx.db.patch(row._id, {
      archivedAt: args.archived ? Date.now() : undefined,
    });
    if (row.programId)
      await ctx.db.patch(row.programId, {
        closed: args.archived || row.status !== "Terbuka",
      });
    return null;
  },
});
