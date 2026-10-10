import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveSelect, ResponsiveSelectContent, ResponsiveSelectItem, ResponsiveSelectTrigger } from "./responsive-select";

vi.mock("@/shared/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/shared/components/ui/drawer", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => children;
  return { Drawer: wrapper, DrawerTrigger: wrapper, DrawerClose: wrapper, DrawerContent: () => null, DrawerHeader: wrapper, DrawerTitle: wrapper };
});

describe("closed mobile select", () => {
  const render = (value?: string, defaultValue?: string) => renderToStaticMarkup(
    <ResponsiveSelect value={value} defaultValue={defaultValue}>
      <ResponsiveSelectTrigger placeholder="Pilih jenis" />
      <ResponsiveSelectContent>
        <><ResponsiveSelectItem value="interview">Wawancara</ResponsiveSelectItem></>
        <ResponsiveSelectItem value="country"><span>Indonesia</span></ResponsiveSelectItem>
      </ResponsiveSelectContent>
    </ResponsiveSelect>,
  );

  it("shows the selected label before the option portal mounts", () => {
    expect(render("interview")).toContain("Wawancara");
    expect(render(undefined, "interview")).toContain("Wawancara");
    expect(render("country")).toContain("Indonesia");
  });

  it("preserves placeholders and unknown values", () => {
    expect(render()).toContain("Pilih jenis");
    expect(render("unknown")).toContain("unknown");
  });
});
