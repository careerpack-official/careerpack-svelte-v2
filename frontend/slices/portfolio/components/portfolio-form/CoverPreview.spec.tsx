import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useQuery } from "convex/react";
import type { PortfolioFormValues } from "../../types";
import { CoverPreview } from "./CoverPreview";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

const values: PortfolioFormValues = {
  title: "QA", description: "", category: "project", coverEmoji: "🚀", coverGradient: "",
  media: [{ storageId: "qa-storage", kind: "image", url: "blob:expired-preview" }],
  link: "", links: [], techStack: [], date: "", featured: false,
  role: "", client: "", duration: "", outcomes: [], collaborators: [], skills: [], brandingShow: undefined,
};

describe("portfolio cover", () => {
  it("uses the owned storage URL after the upload preview is revoked", () => {
    vi.mocked(useQuery).mockReturnValue("https://example.test/stored.webp");
    const html = renderToStaticMarkup(<CoverPreview values={values} />);
    expect(html).toContain("https://example.test/stored.webp");
    expect(html).not.toContain("blob:expired-preview");
    expect(vi.mocked(useQuery).mock.lastCall?.[1]).toEqual({ storageId: "qa-storage" });
  });
  it("shows a placeholder when storage is inaccessible instead of trusting the draft URL", () => {
    vi.mocked(useQuery).mockReturnValue(null);
    const html = renderToStaticMarkup(<CoverPreview values={values} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("🚀");
  });
});
