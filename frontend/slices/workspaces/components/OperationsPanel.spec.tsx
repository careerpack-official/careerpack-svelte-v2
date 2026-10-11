import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { OperationsOverview } from "./OperationsPanel";
const scope = {
  _id: "workspace-pilot" as Id<"workspaces">,
  name: "Studio QA",
  kind: "business" as const,
  sector: "interior-design" as const,
  role: "owner" as const,
};
describe("operational workspace overview", () => {
  it("links studio resources to dedicated workspace pages without borrowing private career routes", () => {
    const html = renderToStaticMarkup(<OperationsOverview workspace={scope} />);
    for (const resource of [
      "clients",
      "projects",
      "tasks",
      "proposals",
      "contracts",
      "documents",
      "portfolio",
    ])
      expect(html).toContain(`/dashboard/workspaces/${scope._id}/${resource}`);
    expect(html).not.toContain('href="/dashboard/cv"');
    expect(html).not.toContain("/vacancies");
  });
  it("shows the HR review shortcut only to reviewers, while applicants remain Careerpack users", () => {
    const participant = renderToStaticMarkup(
      <OperationsOverview
        workspace={{ ...scope, sector: "hr", role: "member" }}
      />,
    );
    expect(participant).toContain("Pelamar memakai akun Careerpack");
    expect(participant).toContain("/vacancies");
    expect(participant).not.toContain("Tinjau kiriman peserta Careerpack");
    const reviewer = renderToStaticMarkup(
      <OperationsOverview
        workspace={{ ...scope, sector: "hr", role: "mentor" }}
      />,
    );
    expect(reviewer).toContain("Tinjau kiriman peserta Careerpack");
  });
});
