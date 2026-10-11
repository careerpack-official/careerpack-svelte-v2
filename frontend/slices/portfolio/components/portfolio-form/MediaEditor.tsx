"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { FileUpload } from "@/shared/components/files/FileUpload";
import { MAX_EDGE } from "@/shared/lib/imageConvert";
import type { PortfolioMedia, PortfolioMediaKind } from "../../types";
import { LibraryPicker } from "@/shared/components/files/LibraryPicker";
import { PortfolioCoverPlaceholder } from "@/shared/components/illustrations/marketing";

interface Props {
  media: PortfolioMedia[];
  onChange: (next: PortfolioMedia[]) => void;
}

function MediaThumbnail({ media }: { media: PortfolioMedia }) {
  const storedUrl = useQuery(api.files.queries.getFileUrl, media.kind === "image" ? { storageId: media.storageId } : "skip");
  const url = storedUrl === undefined ? media.url : storedUrl;
  return url && media.kind === "image" ? (
    <Image src={url} alt={media.caption ?? ""} fill unoptimized sizes="96px" className="object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{media.kind}</div>
  );
}

export function MediaEditor({ media, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleUploaded = (
    storageId: string,
    kind: PortfolioMediaKind,
    url?: string | null,
  ) => {
    onChange([...media, { storageId, kind, url }]);
  };

  const remove = (idx: number) => {
    onChange(media.filter((_, i) => i !== idx));
  };

  const updateCaption = (idx: number, caption: string) => {
    onChange(media.map((m, i) => (i === idx ? { ...m, caption } : m)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...media];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Unggah satu atau beberapa media. Item pertama jadi cover otomatis.
        Bisa pilih dari Pustaka Konten untuk media yang sudah pernah diunggah.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <FileUpload
          label=""
          accept="image/*"
          crop={{ aspect: 16 / 9 }}
          maxEdge={MAX_EDGE.media}
          hint="Unggah baru — gambar (JPG/PNG/WebP)"
          onUploaded={(r) => handleUploaded(r.storageId, "image", r.previewUrl)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          className="h-full min-h-[120px] flex-col gap-2 lg:h-full lg:min-h-[120px] lg:whitespace-normal"
        >
          <Upload className="h-5 w-5" />
          <span className="text-sm">Pilih dari Pustaka Konten</span>
          <span className="text-xs text-muted-foreground">Pakai ulang media yang sudah diunggah</span>
        </Button>
      </div>

      {media.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed border-border p-6 text-center">
          <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-lg border border-border bg-card">
            <PortfolioCoverPlaceholder />
          </div>
          <p className="text-sm text-muted-foreground">
            Belum ada media. Tambahkan minimal satu untuk cover yang menarik.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {media.map((m, idx) => (
            <li
              key={`${m.storageId}-${idx}`}
              className="flex items-start gap-3 rounded-md border border-border p-2"
            >
              <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded bg-muted">
                <MediaThumbnail media={m} />
                {idx === 0 && (
                  <span className="absolute bottom-0 right-0 rounded-tl bg-brand px-1 text-xs font-bold text-brand-foreground">
                    COVER
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  placeholder="Caption (opsional)"
                  value={m.caption ?? ""}
                  onChange={(e) => updateCaption(idx, e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Geser media ke atas"
                    className="h-7 min-w-[44px] px-2 text-xs lg:min-w-0"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => move(idx, 1)}
                    disabled={idx === media.length - 1}
                    aria-label="Geser media ke bawah"
                    className="h-7 min-w-[44px] px-2 text-xs lg:min-w-0"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(idx)}
                    aria-label="Hapus media dari daftar"
                    className="h-7 min-w-[44px] px-2 text-xs text-destructive lg:min-w-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <LibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        accept="image"
        onPick={(file) => {
          handleUploaded(file.storageId, "image", file.url);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
