"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LibraryPicker } from "@/shared/components/files/LibraryPicker";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/shared/components/ui/responsive-dialog";
import { convexHttpUrl } from "@/shared/lib/env";
import { notify } from "@/shared/lib/notify";
import { PERSONAL_APP_ORIGIN } from "@/shared/lib/productMode";

type Program = FunctionReturnType<
  typeof api.workspaces.queries.get
>["programs"][number];
type Submission = FunctionReturnType<
  typeof api.workspaces.queries.listSubmissions
>[number];
type Entry = Submission["entries"][number];
export const statusLabel = {
  submitted: "Menunggu tinjauan",
  needs_update: "Perlu diperbarui",
  reviewed: "Sudah ditinjau",
};

export function ProgramPanel({
  program,
  canReview,
  canManage,
  entryKeys,
  initialTab = "mine",
  manageHref,
}: {
  program: Program;
  canReview: boolean;
  canManage: boolean;
  entryKeys?: readonly string[];
  initialTab?: "mine" | "review";
  manageHref: string;
}) {
  const submissions = useQuery(api.workspaces.queries.listSubmissions, {
    programId: program._id,
  });
  const setClosed = useMutation(api.workspaces.mutations.setProgramClosed);
  const withdraw = useMutation(api.workspaces.mutations.withdraw);
  const ticket = useMutation(api.workspaces.mutations.fileTicket);
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const own = submissions?.find((s) => s.own);
  async function download(
    submission: Submission,
    fileId: Id<"files">,
    name: string,
  ) {
    setBusy(true);
    try {
      const { token } = await ticket({ submissionId: submission._id, fileId });
      const response = await fetch(
        convexHttpUrl(`/workspaces/files/read?t=${token}`),
        { credentials: "omit", referrerPolicy: "no-referrer" },
      );
      if (!response.ok)
        throw new Error("Akses berkas sudah ditarik atau tautan kedaluwarsa.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify.fromError(e, "Gagal mengunduh berkas");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{program.title}</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {program.description}
          </p>
          {program.closed && (
            <p className="mt-2 text-sm font-medium">
              Program ditutup untuk kiriman baru.
            </p>
          )}
        </div>
        {canManage && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setClosed({
                  programId: program._id,
                  closed: !program.closed,
                });
              } catch (e) {
                notify.fromError(e, "Gagal mengubah program");
              } finally {
                setBusy(false);
              }
            }}
          >
            {program.closed ? "Buka kembali" : "Tutup program"}
          </Button>
        )}
      </div>
      <Tabs defaultValue={canReview ? initialTab : "mine"}>
        <TabsList>
          <TabsTrigger value="mine">Kiriman saya</TabsTrigger>
          {canReview && (
            <TabsTrigger value="review">
              Tinjauan peserta ({submissions?.filter((s) => !s.own).length ?? 0}
              )
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="mine" className="space-y-4">
          {own && (
            <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
              <p className="text-sm font-medium">
                Status: {statusLabel[own.status]}
              </p>
              {own.feedback && (
                <div>
                  <p className="text-sm font-medium">Umpan balik reviewer</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {own.feedback}
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await withdraw({ submissionId: own._id });
                    notify.success(
                      "Kiriman ditarik; akses workspace ke berkas ini dihentikan",
                    );
                  } catch (e) {
                    notify.fromError(e, "Gagal menarik kiriman");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Tarik pembagian kiriman
              </Button>
            </section>
          )}
          {submissions === undefined ? (
            <p className="p-4 text-sm text-muted-foreground">Memuat kiriman…</p>
          ) : entryKeys ? (
            <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
              {own ? (
                <SubmissionEntries
                  program={program}
                  submission={own}
                  entryKeys={entryKeys}
                  busy={busy}
                  download={download}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Anda belum membagikan bahan ini ke program workspace ini.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Pilih dan perbarui bahan melalui kiriman lengkap, lalu setujui
                pembagiannya. Pustaka pribadi tidak dibagikan otomatis.
              </p>
              <Button variant="outline" asChild>
                <Link href={manageHref}>Atur kiriman lengkap</Link>
              </Button>
            </section>
          ) : (
            <SubmissionForm
              key={own?._id ?? "new"}
              program={program}
              own={own}
            />
          )}
        </TabsContent>
        {canReview && (
          <TabsContent value="review" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hanya kiriman yang dibagikan peserta ke program ini yang terlihat.
              Peninjauan dilakukan manusia; status ini bukan keputusan diterima
              kerja.
            </p>
            {submissions === undefined ? (
              <p>Memuat kiriman…</p>
            ) : submissions.filter((s) => !s.own).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                Belum ada kiriman peserta.
              </p>
            ) : (
              submissions
                .filter((s) => !s.own)
                .map((s) => (
                  <article
                    key={s._id}
                    className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h4 className="break-words font-semibold">
                        {s.participant}
                      </h4>
                      <span className="text-sm text-muted-foreground">
                        {statusLabel[s.status]}
                      </span>
                    </div>
                    <SubmissionEntries
                      program={program}
                      submission={s}
                      entryKeys={entryKeys}
                      busy={busy}
                      download={download}
                    />
                    {s.feedback && (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        Umpan balik: {s.feedback}
                      </p>
                    )}
                    <Button onClick={() => setReviewing(s)}>
                      Tinjau kiriman
                    </Button>
                  </article>
                ))
            )}
          </TabsContent>
        )}
      </Tabs>
      <ReviewDialog submission={reviewing} onClose={() => setReviewing(null)} />
    </section>
  );
}

function SubmissionEntries({
  program,
  submission,
  entryKeys,
  busy,
  download,
}: {
  program: Program;
  submission: Submission;
  entryKeys?: readonly string[];
  busy: boolean;
  download: (
    submission: Submission,
    id: Id<"files">,
    name: string,
  ) => Promise<void>;
}) {
  return submission.entries
    .filter((entry) => !entryKeys || entryKeys.includes(entry.key))
    .map((entry) => {
      const file = submission.files.find((f) => f._id === entry.fileId);
      return (
        <div key={entry.key} className="min-w-0 border-t border-border pt-3">
          <p className="text-sm font-medium">
            {program.checklist.find((c) => c.key === entry.key)?.label} ·{" "}
            {entry.done ? "Siap" : "Dalam persiapan"}
          </p>
          {entry.note && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {entry.note}
            </p>
          )}
          {file && (
            <Button
              className="mt-2"
              variant="outline"
              disabled={busy}
              onClick={() => void download(submission, file._id, file.name)}
            >
              Unduh {file.name}
            </Button>
          )}
        </div>
      );
    });
}

function SubmissionForm({
  program,
  own,
}: {
  program: Program;
  own?: Submission;
}) {
  const submit = useMutation(api.workspaces.mutations.submit);
  const [entries, setEntries] = useState<Entry[]>(
    () =>
      own?.entries ??
      program.checklist.map((c) => ({ key: c.key, done: false, note: "" })),
  );
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries((own?.files ?? []).map((f) => [f._id, f.name])),
  );
  const [picking, setPicking] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  function patch(key: string, change: Partial<Entry>) {
    setEntries((previous) =>
      previous.map((e) => (e.key === key ? { ...e, ...change } : e)),
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await submit({ programId: program._id, entries, consent });
          setConsent(false);
          notify.success("Kiriman dibagikan ke workspace ini");
        } catch (error) {
          notify.fromError(error, "Gagal membagikan kiriman");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        {program.checklist.map((c) => {
          const entry = entries.find((e) => e.key === c.key);
          if (!entry) return null;
          return (
            <section
              key={c.key}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
            >
              <label className="flex min-h-11 items-start gap-3 text-sm font-medium">
                <Checkbox
                  disabled={program.closed || busy}
                  className="mt-1"
                  checked={entry.done}
                  onCheckedChange={(value) =>
                    patch(c.key, { done: value === true })
                  }
                />
                <span className="break-words">{c.label}</span>
              </label>
              <Button variant="outline" asChild>
                <Link href={`${PERSONAL_APP_ORIGIN}${c.route}`}>
                  Siapkan di Careerpack pribadi
                </Link>
              </Button>
              <label htmlFor={`entry-${c.key}`} className="text-sm font-medium">
                Catatan yang ingin dibagikan
              </label>
              <Textarea
                id={`entry-${c.key}`}
                disabled={program.closed || busy}
                maxLength={2000}
                value={entry.note}
                onChange={(e) => patch(c.key, { note: e.target.value })}
                placeholder="Tulis hanya informasi yang boleh dilihat reviewer workspace ini."
              />
              <div className="mt-auto space-y-2">
                {entry.fileId && (
                  <p className="break-all text-sm text-muted-foreground">
                    Berkas pilihan:{" "}
                    {names[entry.fileId] ?? "Berkas tidak tersedia"}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={program.closed || busy}
                    type="button"
                    variant="outline"
                    onClick={() => setPicking(c.key)}
                  >
                    {entry.fileId
                      ? "Ganti berkas"
                      : "Pilih berkas dari pustaka"}
                  </Button>
                  {entry.fileId && (
                    <Button
                      disabled={program.closed || busy}
                      variant="ghost"
                      type="button"
                      onClick={() => patch(c.key, { fileId: undefined })}
                    >
                      Lepas berkas
                    </Button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Unggah berkas baru melalui{" "}
          <Link
            href={`${PERSONAL_APP_ORIGIN}/dashboard/library`}
            className="underline underline-offset-4"
          >
            Pustaka Konten
          </Link>
          , lalu kembali dan pilih berkasnya. Berkas yang tidak dipilih tetap
          pribadi.
        </p>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            disabled={program.closed || busy}
            checked={consent}
            onCheckedChange={(value) => setConsent(value === true)}
          />
          <span>
            Saya setuju checklist, catatan, dan berkas pilihan di atas dilihat
            pengelola / reviewer workspace ini. Saya dapat menarik kiriman;
            salinan yang sudah diunduh pihak penerima tidak dapat ditarik dari
            perangkat mereka.
          </span>
        </label>
        <Button type="submit" disabled={program.closed || busy || !consent}>
          {busy
            ? "Mengirim…"
            : own
              ? "Bagikan ulang pembaruan"
              : "Bagikan kiriman"}
        </Button>
      </div>
      <LibraryPicker
        open={picking !== null}
        onOpenChange={(open) => {
          if (!open) setPicking(null);
        }}
        onPick={(file) => {
          if (picking) {
            patch(picking, { fileId: file._id as Id<"files"> });
            setNames((previous) => ({
              ...previous,
              [file._id]: file.fileName,
            }));
          }
          setPicking(null);
        }}
      />
    </form>
  );
}

function ReviewDialog({
  submission,
  onClose,
}: {
  submission: Submission | null;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog
      open={submission !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Tinjau kiriman peserta</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Umpan balik hanya terlihat peserta terkait dan reviewer workspace
            ini.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {submission && (
          <ReviewForm
            key={submission._id}
            submission={submission}
            onClose={onClose}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ReviewForm({
  submission,
  onClose,
}: {
  submission: Submission;
  onClose: () => void;
}) {
  const review = useMutation(api.workspaces.mutations.review);
  const [status, setStatus] = useState<"reviewed" | "needs_update">(
    submission.status === "needs_update" ? "needs_update" : "reviewed",
  );
  const [feedback, setFeedback] = useState(submission.feedback);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await review({ submissionId: submission._id, status, feedback });
          notify.success("Tinjauan tersimpan");
          onClose();
        } catch (error) {
          notify.fromError(error, "Gagal menyimpan tinjauan");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="break-words text-sm">Peserta: {submission.participant}</p>
      <label className="block text-sm font-medium" htmlFor="review-status">
        Hasil tinjauan
      </label>
      <select
        id="review-status"
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm lg:h-9"
      >
        <option value="reviewed">Sudah ditinjau</option>
        <option value="needs_update">Perlu diperbarui</option>
      </select>
      <label className="block text-sm font-medium" htmlFor="review-feedback">
        Umpan balik
      </label>
      <Textarea
        id="review-feedback"
        required
        maxLength={2000}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={busy || !feedback.trim()}>
          Simpan tinjauan
        </Button>
      </div>
    </form>
  );
}
