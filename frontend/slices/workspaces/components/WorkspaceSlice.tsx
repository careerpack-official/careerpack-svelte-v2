"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { PageContainer } from "@/shared/components/layout/PageContainer";
import { PageSkeleton } from "@/shared/components/feedback/PageSkeleton";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { notify } from "@/shared/lib/notify";
import { IS_HR_PILOT, PERSONAL_APP_ORIGIN } from "@/shared/lib/productMode";
import { useWorkspaceNavigation } from "@/shared/hooks/useWorkspaceNavigation";
import {
  workspaceHref,
  workspaceEntryKeys,
} from "@/shared/lib/dashboardRegistry";
import { CreateWorkspace, CreateProgram } from "./WorkspaceForms";
import { ProgramPanel } from "./ProgramPanel";
import { MembersPanel } from "./MembersPanel";
import {
  ArchivedWorkspaces,
  OperationsOverview,
  OperationsPanel,
  WorkspaceSettings,
} from "./OperationsPanel";
import { resourcesFor } from "../../../../convex/workspaces/modules/catalog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/shared/components/ui/responsive-dialog";

export function WorkspaceSlice() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkspaceHub />
    </Suspense>
  );
}

function WorkspaceHub() {
  const router = useRouter();
  const search = useSearchParams();
  const { mine, selected, active, view, requestedWorkspace } =
    useWorkspaceNavigation();
  const configuration = useQuery(api.workspaces.queries.configuration);
  const notices = useQuery(api.workspaces.queries.notifications);
  const accept = useMutation(api.workspaces.mutations.acceptInvite);
  const preferences = useMutation(api.workspaces.mutations.preferences);
  const read = useMutation(api.workspaces.mutations.readNotification);
  const leave = useMutation(api.workspaces.mutations.leave);
  const requestVerification = useMutation(
    api.workspaces.emailVerification.request,
  );
  const verifyEmail = useMutation(api.workspaces.emailVerification.verify);
  const [createOpen, setCreateOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const token = search.get("invite");
  const verificationToken = search.get("verify");
  const invitation = useQuery(
    api.workspaces.queries.previewInvite,
    token ? { token } : "skip",
  );
  const data = useQuery(
    api.workspaces.queries.get,
    selected ? { workspaceId: selected._id } : "skip",
  );
  const program =
    data?.programs.find((p) => p._id === search.get("program")) ??
    data?.programs[0];
  const manager = selected && ["owner", "admin"].includes(selected.role);
  const operational =
    selected && (selected.kind === "business" || selected.sector === "hr");
  const resource = selected
    ? resourcesFor(selected.kind, selected.sector).find((r) => r.key === view)
    : undefined;
  const relevantNotices =
    notices?.filter((n) => !selected || n.workspaceId === selected._id) ?? [];
  function selectWorkspace(
    id: string,
    programId?: string,
    nextView = programId ? "programs" : "overview",
  ) {
    router.push(workspaceHref(id, nextView, programId));
  }
  if (mine === undefined) return <PageSkeleton />;
  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {selected
              ? `${selected.sector === "hr" ? "Careerpack HR" : selected.kind === "business" ? "Careerpack Studio" : "Careerpack Institusi"} · ${selected.name}`
              : IS_HR_PILOT
                ? "Careerpack HR · Pilot terpisah"
                : "Careerpack"}
          </p>
          <h1 className="text-2xl font-semibold">
            {selected ? active?.label : "Workspace"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {selected
              ? "Area kerja organisasi ini. Akun dan persiapan karier pribadi berada di Careerpack."
              : "Buat, kelola, atau pulihkan workspace institusi dan bisnis Anda."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Buat workspace
        </Button>
      </header>
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          CV, profil, dan pustaka pribadi tidak otomatis terlihat di workspace.
          Pengelola hanya dapat melihat kiriman dan berkas yang Anda pilih untuk
          dibagikan.
        </p>
      </div>
      {verificationToken && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">Konfirmasi email Careerpack</h2>
          <p className="text-sm text-muted-foreground">
            Konfirmasi alamat email akun yang sedang masuk. Ini tidak mengubah
            password atau membagikan dokumen.
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await verifyEmail({ token: verificationToken });
                const next = new URLSearchParams(search.toString());
                next.delete("verify");
                router.replace(
                  `/dashboard/workspaces${next.size ? `?${next}` : ""}`,
                );
                notify.success("Email berhasil diverifikasi");
              } catch (e) {
                notify.fromError(e, "Gagal memverifikasi email");
              } finally {
                setBusy(false);
              }
            }}
          >
            Konfirmasi email saya
          </Button>
        </section>
      )}
      {configuration && !configuration.emailVerified && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">Verifikasi email sebelum bergabung</h2>
          <p className="text-sm text-muted-foreground">
            Gunakan akun Google, atau minta tautan verifikasi untuk akun
            email/password Anda. Setelah verifikasi, buka kembali undangan
            workspace.
          </p>
          {configuration.verificationDelivery === "failed" && (
            <p role="status" className="text-sm text-destructive">
              Pengiriman verifikasi gagal. Coba minta ulang; jika berulang,
              hubungi pengelola Careerpack.
            </p>
          )}
          {configuration.verificationDelivery === "sent" && (
            <p role="status" className="text-sm text-muted-foreground">
              Email verifikasi dikirim. Periksa inbox atau spam; konfirmasi
              menggunakan akun ini.
            </p>
          )}
          <Button
            disabled={busy || !configuration.emailReady}
            onClick={async () => {
              setBusy(true);
              try {
                await requestVerification({});
                notify.success(
                  "Permintaan verifikasi masuk antrean pengiriman email",
                );
              } catch (e) {
                notify.fromError(e, "Gagal meminta verifikasi");
              } finally {
                setBusy(false);
              }
            }}
          >
            Kirim tautan verifikasi email
          </Button>
          {!configuration.emailReady && (
            <p className="text-sm text-muted-foreground">
              Email belum dikonfigurasi; masuk menggunakan Google untuk email
              terverifikasi.
            </p>
          )}
        </section>
      )}
      {token && (
        <section
          className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6"
          aria-label="Undangan workspace"
        >
          <h2 className="font-semibold">Undangan workspace</h2>
          {invitation === undefined ? (
            <p>Memeriksa undangan…</p>
          ) : invitation ? (
            <>
              <p className="break-words">
                Bergabung ke <strong>{invitation.name}</strong> sebagai{" "}
                {invitation.role === "member"
                  ? "peserta"
                  : invitation.role === "mentor"
                    ? "mentor / reviewer"
                    : "admin"}
                .
              </p>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                />
                <span>
                  Saya setuju nama dan email akun saya terlihat oleh pengelola
                  workspace. Berkas pribadi dibagikan hanya setelah saya memilih
                  dan mengirimkannya.
                </span>
              </label>
              <Button
                disabled={!consent || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const id = await accept({ token, consent });
                    selectWorkspace(id);
                    notify.success("Berhasil bergabung");
                  } catch (e) {
                    notify.fromError(e, "Gagal menerima undangan");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Terima undangan
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Undangan tidak berlaku untuk akun ini, email belum diverifikasi,
              atau tautan sudah kedaluwarsa. Masuk menggunakan email penerima
              undangan.
            </p>
          )}
        </section>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`${PERSONAL_APP_ORIGIN}/dashboard`}>
            Buka Careerpack pribadi
          </Link>
        </Button>
      </div>
      {requestedWorkspace && !selected && (
        <p role="status" className="text-sm text-muted-foreground">
          Workspace ini tidak tersedia untuk akun Anda.
        </p>
      )}
      {!selected ? (
        <>
          <ArchivedWorkspaces />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((w) => (
              <button
                key={w._id}
                onClick={() => selectWorkspace(w._id)}
                className="flex min-h-32 min-w-0 flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
              >
                <Building2 className="size-5 text-primary" />
                <span className="break-words font-semibold">{w.name}</span>
                <span className="text-sm text-muted-foreground">
                  {w.kind === "institution" ? "Institusi" : "Bisnis"} ·{" "}
                  {w.sector === "hr" ? "HR" : "Interior design"} · {w.role}
                </span>
              </button>
            ))}
          </div>
          {mine.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p>Anda belum bergabung ke workspace.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Terima undangan institusi/HR, atau buat pilot interior design
                Anda sendiri.
              </p>
            </div>
          )}
          {relevantNotices.length > 0 && (
            <NoticeList
              notices={relevantNotices}
              onOpen={async (n) => {
                try {
                  await read({ id: n._id });
                  selectWorkspace(n.workspaceId, n.programId, n.targetView ?? "programs");
                } catch (e) {
                  notify.fromError(e, "Gagal membuka notifikasi");
                }
              }}
            />
          )}
        </>
      ) : data === undefined ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold">
              {selected.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selected.kind === "institution" ? "Institusi" : "Bisnis"} ·{" "}
              {selected.sector === "hr" ? "HR" : "Interior design"} · Peran:{" "}
              {selected.role}
            </p>
          </div>
          <Tabs
            value={view}
            onValueChange={(next) =>
              selectWorkspace(selected._id, program?._id, next)
            }
            key={`${selected._id}:${selected.role}`}
          >
            {!operational && (
              <TabsList>
                <TabsTrigger value="overview">Ringkasan</TabsTrigger>
                <TabsTrigger value="programs">
                  Program &amp; kiriman
                </TabsTrigger>
                {![
                  "overview",
                  "programs",
                  "members",
                  "notifications",
                  "preferences",
                ].includes(view) && (
                  <TabsTrigger value={view}>{active?.label}</TabsTrigger>
                )}
                {manager && <TabsTrigger value="members">Anggota</TabsTrigger>}
                <TabsTrigger value="notifications">
                  Notifikasi{" "}
                  {relevantNotices.filter((n) => !n.read).length > 0
                    ? `(${relevantNotices.filter((n) => !n.read).length})`
                    : ""}
                </TabsTrigger>
                <TabsTrigger value="preferences">Pengaturan</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="overview" className="space-y-4">
              {operational ? (
                <OperationsOverview workspace={selected} />
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Pilih fitur dari navigasi workspace. Bahan yang tampil
                    berasal dari kiriman ke workspace ini; persiapan pribadi
                    tetap terpisah.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {data.programs.map((p) => (
                      <Button
                        key={p._id}
                        variant="outline"
                        className="h-auto min-h-24 min-w-0 flex-col items-start whitespace-normal p-4 text-left"
                        onClick={() => selectWorkspace(selected._id, p._id)}
                      >
                        <span className="break-words font-semibold">
                          {p.title}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {p.closed
                            ? "Program ditutup"
                            : "Buka program & kiriman"}
                        </span>
                      </Button>
                    ))}
                  </div>
                  {data.programs.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Belum ada program di workspace ini.
                    </p>
                  )}
                  {manager && (
                    <Button
                      variant="outline"
                      onClick={() => setProgramOpen(true)}
                    >
                      <Plus />
                      Tambah program
                    </Button>
                  )}
                </>
              )}
            </TabsContent>
            {resource && (
              <TabsContent value={view}>
                <OperationsPanel
                  key={`${selected._id}:${view}`}
                  workspace={selected}
                  spec={resource}
                />
              </TabsContent>
            )}
            <TabsContent value="pricing">
              <WorkspaceSettings
                key={selected._id}
                workspace={selected}
                onArchived={() => router.push("/dashboard/workspaces")}
              />
            </TabsContent>
            {!resource && view !== "pricing" && (
              <TabsContent
                value={
                  [
                    "overview",
                    "members",
                    "notifications",
                    "preferences",
                  ].includes(view)
                    ? "programs"
                    : view
                }
                className="space-y-4"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="program-picker"
                      className="mb-2 block text-sm font-medium"
                    >
                      {selected.sector === "hr"
                        ? "Program peserta HR"
                        : selected.kind === "institution"
                          ? "Program peserta"
                          : "Proyek kesiapan bisnis"}
                    </label>
                    <select
                      id="program-picker"
                      value={program?._id ?? ""}
                      onChange={(e) =>
                        selectWorkspace(selected._id, e.target.value, view)
                      }
                      className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm lg:h-9"
                    >
                      {data.programs.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.title}
                          {p.closed ? " · ditutup" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {manager && (
                    <Button
                      variant="outline"
                      onClick={() => setProgramOpen(true)}
                    >
                      <Plus />
                      Tambah program
                    </Button>
                  )}
                </div>
                {program && (
                  <ProgramPanel
                    key={`${program._id}:${view}`}
                    program={program}
                    canReview={["owner", "admin", "mentor"].includes(
                      selected.role,
                    )}
                    canManage={!!manager}
                    entryKeys={workspaceEntryKeys(view)}
                    initialTab={
                      view === "review" ||
                      (workspaceEntryKeys(view) &&
                        (selected.sector === "hr" ||
                          selected.kind === "institution") &&
                        selected.role !== "member")
                        ? "review"
                        : "mine"
                    }
                    manageHref={workspaceHref(
                      selected._id,
                      "programs",
                      program._id,
                    )}
                  />
                )}
                {!program && (
                  <p className="text-sm text-muted-foreground">
                    Buat program terlebih dahulu untuk memakai fitur workspace
                    ini.
                  </p>
                )}
              </TabsContent>
            )}
            {manager && (
              <TabsContent value="members">
                <MembersPanel
                  workspace={data.workspace}
                  members={data.members}
                  invites={data.invites}
                  emailReady={configuration?.emailReady ?? false}
                />
              </TabsContent>
            )}
            <TabsContent value="notifications">
              <NoticeList
                notices={relevantNotices}
                onOpen={async (n) => {
                  try {
                    await read({ id: n._id });
                    selectWorkspace(n.workspaceId, n.programId, n.targetView ?? "programs");
                  } catch (e) {
                    notify.fromError(e, "Gagal membuka notifikasi");
                  }
                }}
              />
            </TabsContent>
            <TabsContent value="preferences">
              <WorkspaceSettings
                key={selected._id}
                workspace={selected}
                onArchived={() => router.push("/dashboard/workspaces")}
              />
              <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
                <h3 className="font-semibold">
                  Notifikasi untuk akun Anda di workspace ini
                </h3>
                <p className="text-sm text-muted-foreground">
                  Email berisi pemberitahuan umum dan tautan masuk, tanpa
                  dokumen atau umpan balik pribadi. Pengaturan workspace lain
                  tetap terpisah.
                </p>
                {!configuration?.emailReady && (
                  <p className="text-sm text-muted-foreground">
                    Pengiriman email belum aktif. Notifikasi dalam workspace
                    tetap tersedia.
                  </p>
                )}
                {(["inApp", "email"] as const).map((key) => (
                  <label
                    key={key}
                    className="flex min-h-11 items-center gap-3 text-sm"
                  >
                    <Checkbox
                      disabled={
                        busy || (key === "email" && !configuration?.emailReady)
                      }
                      checked={data.workspace[key]}
                      onCheckedChange={async (value) => {
                        setBusy(true);
                        try {
                          await preferences({
                            workspaceId: selected._id,
                            inApp: data.workspace.inApp,
                            email: data.workspace.email,
                            [key]: value === true,
                          });
                        } catch (e) {
                          notify.fromError(e, "Gagal menyimpan pengaturan");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                    <span>
                      {key === "inApp"
                        ? "Notifikasi dalam workspace"
                        : "Email pembaruan (opsional)"}
                    </span>
                  </label>
                ))}
                {selected.role !== "owner" && (
                  <Button variant="outline" onClick={() => setLeaving(true)}>
                    Keluar dari workspace
                  </Button>
                )}
              </section>
            </TabsContent>
          </Tabs>
          <CreateProgram
            open={programOpen}
            onOpenChange={setProgramOpen}
            workspaceId={selected._id}
            onCreated={(id) => selectWorkspace(selected._id, id)}
          />
          <ResponsiveDialog open={leaving} onOpenChange={setLeaving}>
            <ResponsiveDialogContent size="lg">
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>
                  Keluar dari workspace?
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  Kiriman Anda di workspace ini akan ditarik. Data dan berkas
                  asli Careerpack pribadi tetap tersimpan. Untuk bergabung
                  kembali, Anda perlu undangan baru.
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setLeaving(false)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await leave({ workspaceId: selected._id });
                      setLeaving(false);
                      router.push("/dashboard/workspaces");
                      notify.success("Anda telah keluar dari workspace");
                    } catch (e) {
                      notify.fromError(e, "Gagal keluar dari workspace");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Keluar dan tarik kiriman
                </Button>
              </div>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </>
      )}
      <CreateWorkspace
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={selectWorkspace}
      />
    </PageContainer>
  );
}

type Notice = NonNullable<
  ReturnType<typeof useQuery<typeof api.workspaces.queries.notifications>>
>[number];
function NoticeList({
  notices,
  onOpen,
}: {
  notices: Notice[];
  onOpen: (notice: Notice) => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
      <h3 className="font-semibold">Pembaruan workspace</h3>
      {notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pembaruan.</p>
      ) : (
        notices.map((n) => (
          <button
            key={n._id}
            onClick={() => onOpen(n)}
            className="flex w-full min-w-0 flex-col gap-1 rounded-md border border-border p-3 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={`break-words text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}
            >
              {n.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(n.createdAt).toLocaleString("id-ID")} ·{" "}
              {n.delivery === "sent"
                ? "Email dikirim"
                : n.delivery === "failed"
                  ? "Email gagal; pembaruan tersedia di sini"
                  : n.delivery === "pending"
                    ? "Email dalam antrean"
                    : n.delivery === "suppressed"
                      ? "Email tidak dikirim"
                      : "Dalam aplikasi"}
            </span>
          </button>
        ))
      )}
    </section>
  );
}
