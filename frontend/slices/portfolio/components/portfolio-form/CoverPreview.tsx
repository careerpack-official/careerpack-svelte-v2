import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { cn } from "@/shared/lib/utils";
import type { PortfolioFormValues } from "../../types";

export function CoverPreview({ values }: { values: PortfolioFormValues }) {
  const first = values.media[0];
  const url = useQuery(api.files.queries.getFileUrl, first?.kind === "image" ? { storageId: first.storageId } : "skip");
  if (url && first?.kind === "image") {
    return (
      <div className="relative h-28 overflow-hidden rounded-lg bg-muted">
        <Image
          src={url}
          alt="Cover portofolio"
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, 512px"
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-28 items-center justify-center rounded-lg bg-gradient-to-br",
        values.coverGradient,
      )}
    >
      <span className="text-4xl">{values.coverEmoji}</span>
    </div>
  );
}
