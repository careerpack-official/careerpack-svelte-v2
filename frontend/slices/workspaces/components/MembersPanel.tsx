"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/shared/components/ui/responsive-dialog";
import { notify } from "@/shared/lib/notify";
import { PERSONAL_APP_ORIGIN } from "@/shared/lib/productMode";

type Data = FunctionReturnType<typeof api.workspaces.queries.get>;
const labels = {
  owner: "Pemilik",
  admin: "Admin",
  mentor: "Mentor / reviewer",
  member: "Peserta / anggota",
};
export function MembersPanel({
  workspace,
  members,
  invites,
  emailReady,
}: Pick<Data, "workspace" | "members" | "invites"> & { emailReady: boolean }) {
  const invite = useMutation(api.workspaces.mutations.invite);
  const remove = useMutation(api.workspaces.mutations.removeMember);
  const setRole = useMutation(api.workspaces.mutations.setMemberRole);
  const revoke = useMutation(api.workspaces.mutations.revokeInvite);
  const [email, setEmail] = useState("");
  const [role, chooseRole] = useState<"admin" | "mentor" | "member">("member");
  const [sendEmail, setSendEmail] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Data["members"][number] | null>(
    null,
  );
  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <h3 className="font-semibold">Undang anggota</h3>
        <p className="text-sm text-muted-foreground">
          Undangan berlaku tujuh hari dan hanya dapat diterima akun dengan email
          tujuan yang sudah diverifikasi. Tidak memberikan akses ke data pribadi
          Careerpack.
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setLink("");
            try {
              const result = await invite({
                workspaceId: workspace._id,
                email,
                role,
                sendEmail,
              });
              const url = new URL(
                "/dashboard/workspaces",
                PERSONAL_APP_ORIGIN || window.location.origin,
              );
              url.searchParams.set("invite", result.token);
              setLink(url.toString());
              notify.success(
                sendEmail
                  ? "Undangan dibuat; pengiriman email masuk antrean"
                  : "Undangan dibuat",
              );
            } catch (error) {
              notify.fromError(error, "Gagal membuat undangan");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-2 block text-sm font-medium"
              >
                Email penerima
              </label>
              <Input
                id="invite-email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="peserta@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="invite-role"
                className="mb-2 block text-sm font-medium"
              >
                Peran
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => chooseRole(e.target.value as typeof role)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm lg:h-9"
              >
                <option value="member">Peserta / anggota</option>
                <option value="mentor">Mentor / reviewer</option>
                {workspace.role === "owner" && (
                  <option value="admin">Admin</option>
                )}
              </select>
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox
              checked={sendEmail}
              disabled={!emailReady || busy}
              onCheckedChange={(value) => setSendEmail(value === true)}
            />
            <span>
              Kirim email undangan{" "}
              {emailReady ? "(opsional)" : "(belum dikonfigurasi)"}
            </span>
          </label>
          <Button type="submit" disabled={busy || !email.trim()}>
            Buat undangan
          </Button>
        </form>
        {link && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <label htmlFor="invite-link" className="block text-sm font-medium">
              Tautan undangan privat
            </label>
            <Input id="invite-link" readOnly value={link} />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  notify.success("Tautan disalin");
                } catch (e) {
                  notify.fromError(e, "Pilih dan salin tautan secara manual");
                }
              }}
            >
              Salin tautan
            </Button>
            <p className="text-xs text-muted-foreground">
              Tautan ini tidak disimpan di perangkat. Jika hilang, buat undangan
              baru; tautan sebelumnya untuk email yang sama akan dibatalkan.
            </p>
          </div>
        )}
      </section>
      <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
        <h3 className="font-semibold">Anggota ({members.length}/100)</h3>
        {members.map((m) => (
          <div
            key={m._id}
            className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{m.name}</p>
              <p className="break-all text-xs text-muted-foreground">
                {m.email} · {labels[m.role]}
              </p>
            </div>
            {m.role !== "owner" && (
              <div className="flex max-w-full flex-wrap items-center gap-2">
                {workspace.role === "owner" && (
                  <>
                    <label htmlFor={`role-${m._id}`} className="sr-only">
                      Peran {m.name}
                    </label>
                    <select
                      id={`role-${m._id}`}
                      disabled={busy}
                      value={m.role}
                      onChange={async (e) => {
                        const nextRole = e.target.value as
                          | "admin"
                          | "mentor"
                          | "member";
                        setBusy(true);
                        try {
                          await setRole({ memberId: m._id, role: nextRole });
                          notify.success("Peran diperbarui");
                        } catch (error) {
                          notify.fromError(error, "Gagal mengubah peran");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="h-11 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm lg:h-9"
                    >
                      <option value="member">Peserta / anggota</option>
                      <option value="mentor">Mentor / reviewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </>
                )}
                {(workspace.role === "owner" || m.role !== "admin") && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setRemoving(m)}
                  >
                    Keluarkan
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
        <h3 className="font-semibold">Undangan aktif</h3>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada undangan aktif.
          </p>
        ) : (
          invites.map((i) => (
            <div
              key={i._id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
            >
              <div className="min-w-0">
                <p className="break-all text-sm">{i.email}</p>
                <p className="text-xs text-muted-foreground">
                  {labels[i.role]} ·{" "}
                  {i.delivery === "sent"
                    ? "Email dikirim (penerimaan belum dikonfirmasi)"
                    : i.delivery === "pending"
                      ? "Email dalam antrean"
                      : i.delivery === "failed"
                        ? "Email gagal; buat undangan baru atau salin tautan"
                        : i.delivery === "suppressed"
                          ? "Email tidak dikirim"
                          : "Tautan manual"}
                </p>
              </div>
              <Button
                disabled={busy}
                variant="outline"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await revoke({ inviteId: i._id });
                    notify.success("Undangan dibatalkan");
                  } catch (e) {
                    notify.fromError(e, "Gagal membatalkan undangan");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Batalkan undangan
              </Button>
            </div>
          ))
        )}
      </section>
      <ResponsiveDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      >
        <ResponsiveDialogContent size="lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Keluarkan anggota?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Keanggotaan dan kiriman peserta di workspace ini akan ditarik.
              Berkas asli tetap berada di Careerpack pribadi peserta. Unduhan
              berikutnya ditolak; salinan yang sudah diunduh tidak dapat ditarik
              dari perangkat penerima.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <p className="break-words text-sm">{removing?.name}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!removing) return;
                setBusy(true);
                try {
                  await remove({ memberId: removing._id });
                  setRemoving(null);
                  notify.success("Anggota dikeluarkan");
                } catch (e) {
                  notify.fromError(e, "Gagal mengeluarkan anggota");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Keluarkan anggota
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
