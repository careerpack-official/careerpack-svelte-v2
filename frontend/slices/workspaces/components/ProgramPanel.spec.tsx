import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useQuery: () => [
    {
      _id: "submission",
      own: true,
      participant: "Peserta",
      status: "submitted",
      feedback: "",
      updatedAt: 1,
      entries: [
        {
          key: "cv",
          done: true,
          note: "Catatan CV dibagikan",
          fileId: "file-cv",
        },
        {
          key: "portfolio",
          done: true,
          note: "Catatan portofolio berbeda",
          fileId: "file-portfolio",
        },
      ],
      files: [
        { _id: "file-cv", name: "cv-selected.pdf" },
        { _id: "file-portfolio", name: "portfolio-selected.pdf" },
      ],
    },
  ],
  useMutation: () => vi.fn(),
}));
vi.mock("@/shared/components/files/LibraryPicker", () => ({
  LibraryPicker: () => null,
}));
import { ProgramPanel } from "./ProgramPanel";

describe("workspace feature view", () => {
  it("shows only its shared entry and file, and directs edits to the complete consent form", () => {
    const html = renderToStaticMarkup(
      <ProgramPanel
        program={{
          _id: "program" as Id<"workspacePrograms">,
          title: "Program HR",
          description: "",
          closed: false,
          checklist: [
            { key: "cv", label: "CV peserta", route: "/dashboard/cv" },
            {
              key: "portfolio",
              label: "Portofolio",
              route: "/dashboard/portfolio",
            },
          ],
        }}
        canManage={false}
        canReview={false}
        entryKeys={["cv"]}
        manageHref="/dashboard/workspaces?workspace=mine&view=programs"
      />,
    );
    expect(html).toContain("Catatan CV dibagikan");
    expect(html).toContain("cv-selected.pdf");
    expect(html).not.toContain("Catatan portofolio berbeda");
    expect(html).not.toContain("portfolio-selected.pdf");
    expect(html).toContain("Atur kiriman lengkap");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<textarea");
  });
});
