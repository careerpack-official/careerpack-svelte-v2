import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChecklistItemCard, type ChecklistView } from "./ChecklistItemCard";
import type { ChecklistItem } from "../../types";

const item: ChecklistItem = {
  id: "qa-document", title: "Sertifikat Kompetensi/Pelatihan", description: "Keterangan dokumen QA",
  category: "local", subcategory: "professional", required: true, completed: false, dueDate: "2026-12-31",
};
const render = (view?: ChecklistView) => renderToStaticMarkup(
  <ChecklistItemCard item={item} view={view} onToggle={() => {}} onSelect={() => {}} />,
);

describe("checklist view options", () => {
  it("keeps both document actions, required status and deadline in every view", () => {
    for (const view of ["list", "detail", "thumbnail"] as const) {
      const markup = render(view);
      expect(markup).toContain(item.title);
      expect(markup).toContain("buka detail dokumen");
      expect(markup).toContain("Wajib");
      expect(markup).toContain(item.dueDate);
      expect(markup.match(/<button\b/g)).toHaveLength(2);
      expect(markup).not.toMatch(/<button\b[^]*?<button\b[^]*?<\/button>[^]*?<\/button>/);
    }
  });
  it("uses detail by default and keeps compact lists concise", () => {
    expect(render()).toContain(item.description);
    expect(render("detail")).toContain(item.description);
    expect(render("list")).not.toContain(item.description);
  });
  it("shows a document icon thumbnail without pretending there is an uploaded image", () => {
    expect(render("thumbnail")).toContain("h-24 w-full");
    expect(render("thumbnail")).not.toContain("<img");
    expect(render("detail")).not.toContain("h-24 w-full");
  });
});
