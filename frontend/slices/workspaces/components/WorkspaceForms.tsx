"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/shared/components/ui/responsive-dialog";
import { notify } from "@/shared/lib/notify";
import { IS_HR_PILOT } from "@/shared/lib/productMode";

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };
export function CreateWorkspace({
  open,
  onOpenChange,
  onCreated,
}: DialogProps & { onCreated: (id: Id<"workspaces">) => void }) {
  const create = useMutation(api.workspaces.mutations.create);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"institution" | "business">(
    IS_HR_PILOT ? "business" : "institution",
  );
  const [sector, setSector] = useState<"interior-design" | "hr">(
    IS_HR_PILOT ? "hr" : "interior-design",
  );
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Buat workspace pilot</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Area baru dengan anggota, program, dan kiriman terpisah. Email akun
            harus terverifikasi.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const id = await create({ name, kind, sector });
              onCreated(id);
              onOpenChange(false);
              setName("");
              notify.success("Workspace berhasil dibuat");
            } catch (error) {
              notify.fromError(error, "Gagal membuat workspace");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="workspace-name"
            >
              Nama workspace
            </label>
            <Input
              id="workspace-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Studio Interior Nusantara"
            />
          </div>
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="workspace-kind"
            >
              Jenis workspace
            </label>
            <select
              id="workspace-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm lg:h-9"
            >
              <option value="institution">Institusi · sekolah / kampus</option>
              <option value="business">Bisnis · studio / HR</option>
            </select>
          </div>
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="workspace-sector"
            >
              Bidang
            </label>
            <select
              id="workspace-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value as typeof sector)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm lg:h-9"
            >
              <option value="interior-design">Interior design</option>
              <option value="hr">HR</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Pilot: maksimum 100 anggota dan 20 program. Pembayaran, branding
            institusi, serta keputusan rekrutmen otomatis belum diaktifkan.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Membuat…" : "Buat workspace"}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function CreateProgram({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: DialogProps & {
  workspaceId: Id<"workspaces">;
  onCreated: (id: Id<"workspacePrograms">) => void;
}) {
  const create = useMutation(api.workspaces.mutations.createProgram);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Tambah program</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Checklist mengikuti konfigurasi bidang workspace. Peserta membagikan
            kiriman sendiri.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const id = await create({ workspaceId, title, description });
              onCreated(id);
              onOpenChange(false);
              setTitle("");
              setDescription("");
              notify.success("Program dibuat");
            } catch (error) {
              notify.fromError(error, "Gagal membuat program");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label
              htmlFor="program-title"
              className="mb-2 block text-sm font-medium"
            >
              Nama program / proyek
            </label>
            <Input
              id="program-title"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="program-description"
              className="mb-2 block text-sm font-medium"
            >
              Deskripsi dan arahan peserta
            </label>
            <Textarea
              id="program-description"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              Tambah program
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
