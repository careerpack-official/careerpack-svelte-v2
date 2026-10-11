"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  resourcesFor,
  type Resource,
} from "../../../../convex/workspaces/modules/catalog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { notify } from "@/shared/lib/notify";
import {
  workspaceHref,
  type WorkspaceNavScope,
} from "@/shared/lib/dashboardRegistry";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/shared/components/ui/responsive-dialog";

type Scope = WorkspaceNavScope & { _id: Id<"workspaces"> };
type Row = NonNullable<
  ReturnType<typeof useQuery<typeof api.workspaces.records.list>>
>[number];
const selectClass =
  "min-h-[44px] w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm lg:min-h-9";
export function OperationsOverview({ workspace }: { workspace: Scope }) {
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">
        {workspace.sector === "hr"
          ? "Rekrutmen: lowongan \u2192 kiriman Careerpack \u2192 tinjauan \u2192 jadwal"
          : "Studio: klien → proyek → tugas dan dokumen → proposal dan kontrak"}
      </h3>
      <p className="text-sm text-muted-foreground">
        Semua data di area ini milik workspace {workspace.name}. Gunakan sidebar
        untuk berpindah halaman.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {resourcesFor(workspace.kind, workspace.sector).map((spec) => (
          <Link
            key={spec.key}
            href={workspaceHref(workspace._id, spec.key)}
            className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-4 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
          >
            <h4 className="font-medium">{spec.label}</h4>
            <p className="text-sm text-muted-foreground">{spec.description}</p>
          </Link>
        ))}
      </div>
      {workspace.sector === "hr" && workspace.role !== "member" && (
        <Button asChild variant="outline">
          <Link href={workspaceHref(workspace._id, "review")}>
            Tinjau kiriman peserta Careerpack
          </Link>
        </Button>
      )}
    </section>
  );
}
export function OperationsPanel({
  workspace,
  spec,
}: {
  workspace: Scope;
  spec: Resource;
}) {
  const manager = ["owner", "admin"].includes(workspace.role);
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const rows = useQuery(api.workspaces.records.list, {
    workspaceId: workspace._id,
    resource: spec.key,
    archived,
  });
  const parents = useQuery(
    api.workspaces.records.list,
    spec.parent
      ? { workspaceId: workspace._id, resource: spec.parent }
      : "skip",
  );
  const toggle = useMutation(api.workspaces.records.setArchived);
  const [busy, setBusy] = useState(false);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {spec.description}
        </p>
        {manager && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setArchived(!archived)}>
              {archived ? "Data aktif" : "Arsip"}
            </Button>
            <Button onClick={() => setEditing("new")}>
              Tambah {spec.singular.toLowerCase()}
            </Button>
          </div>
        )}
      </div>
      {rows === undefined ? (
        <p role="status">Memuat data…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {archived
            ? "Arsip kosong."
            : `Belum ada ${spec.label.toLowerCase()} di workspace ini.`}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <article
              key={row._id}
              className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="min-w-0 break-words font-semibold">
                  {row.title}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {row.status}
                </span>
              </div>
              {row.parentId && spec.parent && (
                <p className="text-sm text-muted-foreground">
                  <Link
                    className="break-words underline underline-offset-4"
                    href={workspaceHref(workspace._id, spec.parent)}
                  >
                    {spec.parent === "clients"
                      ? "Klien"
                      : spec.parent === "projects"
                        ? "Proyek"
                        : "Lowongan"}
                    :{" "}
                    {parents?.find((p) => p._id === row.parentId)?.title ??
                      "Data terkait"}
                  </Link>
                </p>
              )}
              {row.participant && (
                <p className="break-words text-sm text-muted-foreground">
                  Peserta: {row.participant}
                </p>
              )}
              {spec.fields.map(
                (field) =>
                  row.values[field.key] && (
                    <div key={field.key} className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {field.label}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                        {row.values[field.key]}
                      </p>
                    </div>
                  ),
              )}
              <div className="flex flex-wrap gap-2">
                {row.programId && !archived && (
                  <Button asChild variant="outline">
                    <Link
                      href={workspaceHref(
                        workspace._id,
                        "programs",
                        row.programId,
                      )}
                    >
                      {workspace.role === "member"
                        ? "Lamar dengan data pilihan saya"
                        : "Kandidat & kiriman lowongan"}
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    const content = [
                      row.title,
                      row.status,
                      ...spec.fields.map(
                        (f) => `${f.label}: ${row.values[f.key] ?? ""}`,
                      ),
                    ].join("\n\n");
                    const url = URL.createObjectURL(
                      new Blob([content], { type: "text/plain;charset=utf-8" }),
                    );
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `${spec.key}-draft.txt`;
                    anchor.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Unduh teks
                </Button>
                {manager && (
                  <>
                    <Button
                      variant="outline"
                      disabled={archived}
                      onClick={() => setEditing(row)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await toggle({ id: row._id, archived: !archived });
                          notify.success(
                            archived
                              ? "Data dipulihkan"
                              : "Data diarsipkan; dapat dipulihkan dari Arsip",
                          );
                        } catch (e) {
                          notify.fromError(e, "Gagal mengubah arsip");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {archived ? "Pulihkan" : "Arsipkan"}
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <RecordForm
          key={editing === "new" ? "new" : editing._id}
          workspace={workspace}
          spec={spec}
          row={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
        />
      )}
    </section>
  );
}
function RecordForm({
  workspace,
  spec,
  row,
  close,
}: {
  workspace: Scope;
  spec: Resource;
  row?: Row;
  close: () => void;
}) {
  const save = useMutation(api.workspaces.records.save);
  const parents = useQuery(
    api.workspaces.records.list,
    spec.parent
      ? { workspaceId: workspace._id, resource: spec.parent }
      : "skip",
  );
  const [title, setTitle] = useState(row?.title ?? "");
  const [status, setStatus] = useState(row?.status ?? spec.states[0]);
  const [values, setValues] = useState<Record<string, string>>(
    row?.values ?? {},
  );
  const [parentId, setParentId] = useState<Id<"workspaceRecords"> | undefined>(
    row?.parentId,
  );
  const [submissionId, setSubmissionId] = useState<
    Id<"workspaceSubmissions"> | undefined
  >(row?.submissionId);
  const parent = parents?.find((p) => p._id === parentId);
  const submissions = useQuery(
    api.workspaces.queries.listSubmissions,
    spec.key === "schedules" && parent?.programId
      ? { programId: parent.programId }
      : "skip",
  );
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <ResponsiveDialogContent size="2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {row ? "Edit" : "Tambah"} {spec.singular.toLowerCase()}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {workspace.name} · {spec.description}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await save({
                workspaceId: workspace._id,
                id: row?._id,
                resource: spec.key,
                title,
                status,
                values,
                parentId,
                submissionId,
              });
              notify.success("Data workspace disimpan");
              close();
            } catch (e) {
              notify.fromError(e, "Gagal menyimpan data");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block space-y-2 text-sm">
            <span>Nama {spec.singular.toLowerCase()}</span>
            <Input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Status</span>
            <select
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {spec.states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {spec.parent && (
            <label className="block space-y-2 text-sm">
              <span>
                {spec.parent === "clients"
                  ? "Klien"
                  : spec.parent === "projects"
                    ? "Proyek"
                    : "Lowongan"}
              </span>
              <select
                required
                className={selectClass}
                value={parentId ?? ""}
                onChange={(e) => {
                  setParentId(
                    parents?.find((p) => p._id === e.target.value)?._id,
                  );
                  setSubmissionId(undefined);
                }}
              >
                <option value="">Pilih data terkait</option>
                {parents?.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {parents?.length === 0 && (
                <p className="text-muted-foreground">
                  Buat{" "}
                  {spec.parent === "clients"
                    ? "klien"
                    : spec.parent === "projects"
                      ? "proyek"
                      : "lowongan"}{" "}
                  terlebih dahulu.
                </p>
              )}
            </label>
          )}
          {spec.key === "schedules" && (
            <label className="block space-y-2 text-sm">
              <span>Kiriman peserta Careerpack</span>
              <select
                required
                className={selectClass}
                value={submissionId ?? ""}
                onChange={(e) =>
                  setSubmissionId(
                    submissions?.find((s) => s._id === e.target.value)?._id,
                  )
                }
              >
                <option value="">
                  Pilih peserta yang sudah membagikan data
                </option>
                {submissions?.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.participant}
                  </option>
                ))}
              </select>
            </label>
          )}
          {spec.fields.map((field) => (
            <label key={field.key} className="block space-y-2 text-sm">
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "textarea" ? (
                <Textarea
                  required={field.required}
                  maxLength={6000}
                  className="min-h-32"
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                />
              ) : (
                <Input
                  required={field.required}
                  type={field.type ?? "text"}
                  min={field.type === "number" ? 0 : undefined}
                  step={field.type === "number" ? 1 : undefined}
                  maxLength={500}
                  value={values[field.key] ?? ""}
                  onInput={
                    field.type === "date"
                      ? (e) =>
                          setValues({
                            ...values,
                            [field.key]: e.currentTarget.value,
                          })
                      : undefined
                  }
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy}>
              Simpan
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
export function WorkspaceSettings({
  workspace,
  onArchived,
}: {
  workspace: Scope;
  onArchived: () => void;
}) {
  const settings = useQuery(api.workspaces.manage.settings, {
    workspaceId: workspace._id,
  });
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const archive = useMutation(api.workspaces.manage.archive);
  const [busy, setBusy] = useState(false);
  if (!settings) return <p role="status">Memuat pengaturan…</p>;
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <h3 className="font-semibold">Workspace & harga pilot</h3>
      <p className="whitespace-pre-wrap break-words text-sm">
        {settings.description || workspace.name}
      </p>
      <p className="text-xl font-semibold">
        {new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(settings.monthlyIDR)}{" "}
        / bulan
      </p>
      <p role="status" className="text-sm text-muted-foreground">
        Draf penawaran pilot. Belum menjadi harga yang disetujui, belum ditagih,
        dan belum terhubung ke pembayaran DOKU. Careerpack pribadi tetap gratis.
      </p>
      {["owner", "admin"].includes(workspace.role) && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit workspace & draf harga
        </Button>
      )}
      {workspace.role === "owner" && (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          Arsipkan workspace
        </Button>
      )}
      {editing && (
        <SettingsForm
          workspace={workspace}
          settings={settings}
          close={() => setEditing(false)}
        />
      )}
      <ResponsiveDialog open={confirming} onOpenChange={setConfirming}>
        <ResponsiveDialogContent size="lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              Arsipkan {workspace.name}?
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Workspace disembunyikan dari semua anggota dan undangan aktif
              dicabut. Data disimpan; pemilik dapat memulihkan dari halaman
              Workspace. Data Careerpack pribadi tetap tersimpan.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await archive({ workspaceId: workspace._id });
                  setConfirming(false);
                  onArchived();
                  notify.success("Workspace diarsipkan");
                } catch (e) {
                  notify.fromError(e, "Gagal mengarsipkan");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Arsipkan
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </section>
  );
}
function SettingsForm({
  workspace,
  settings,
  close,
}: {
  workspace: Scope;
  settings: { description: string; monthlyIDR: number };
  close: () => void;
}) {
  const update = useMutation(api.workspaces.manage.update);
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(settings.description);
  const [price, setPrice] = useState(String(settings.monthlyIDR));
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit workspace</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Harga adalah draf penawaran; perubahan ini tidak mengaktifkan
            pembayaran.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await update({
                workspaceId: workspace._id,
                name,
                description,
                monthlyIDR: Number(price),
              });
              notify.success("Workspace diperbarui");
              close();
            } catch (err) {
              notify.fromError(err, "Gagal menyimpan");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block space-y-2 text-sm">
            <span>Nama workspace</span>
            <Input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Deskripsi</span>
            <Textarea
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Draf harga bulanan (Rp)</span>
            <Input
              required
              type="number"
              min={0}
              max={100000000}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Batal
            </Button>
            <Button disabled={busy}>Simpan draf</Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
export function ArchivedWorkspaces() {
  const rows = useQuery(api.workspaces.manage.archived, {});
  const restore = useMutation(api.workspaces.manage.restore);
  const [busy, setBusy] = useState(false);
  if (!rows?.length) return null;
  return (
    <section className="space-y-3 rounded-lg border border-border p-4 sm:p-6">
      <h2 className="font-semibold">Arsip workspace milik Anda</h2>
      {rows.map((w) => (
        <div
          key={w._id}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span className="min-w-0 break-words">{w.name}</span>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await restore({ workspaceId: w._id });
                notify.success(
                  "Workspace dipulihkan; undangan lama tetap dicabut",
                );
              } catch (e) {
                notify.fromError(e, "Gagal memulihkan");
              } finally {
                setBusy(false);
              }
            }}
          >
            Pulihkan
          </Button>
        </div>
      ))}
    </section>
  );
}
