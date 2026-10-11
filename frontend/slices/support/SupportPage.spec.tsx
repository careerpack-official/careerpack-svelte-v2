import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportPage } from "./SupportPage";

describe("voluntary support page", () => {
  it("keeps free access and disables payment before DOKU is configured", () => {
    const html = renderToStaticMarkup(React.createElement(SupportPage, { donationUrl: null }));
    expect(html).toContain('href="/login"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Donasi belum dibuka/);
    expect(html).not.toContain('href="https://pay.doku.com');
    expect(html).toContain("white label sedang dirancang");
  });
  it("uses DOKU hosted checkout without claiming a payment succeeded", () => {
    const html = renderToStaticMarkup(React.createElement(SupportPage, { donationUrl: "https://pay.doku.com/p-link/p/careerpack" }));
    expect(html).toContain('href="https://pay.doku.com/p-link/p/careerpack"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Tidak ada langganan atau penagihan otomatis");
    expect(html).toContain("Nama penerima di DOKU: rahman fakhru");
    expect(html).not.toContain("Donasi belum dibuka");
    expect(html).toContain('href="mailto:hello@careerpack.org?subject=');
  });
});
