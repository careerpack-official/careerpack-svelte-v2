import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UploadStep, type UploadStepProps } from "./UploadStep";

vi.mock("@/shared/components/files/LibraryPicker", () => ({ LibraryPicker: () => null }));

const noop = () => {};
const props: UploadStepProps = {
  phase: "review-text", isDemo: false, ready: true, visionUnverified: false,
  fileName: "synthetic.pdf", progress: null, ocrRunning: false, ocrOffer: false,
  manual: false, rawText: "Synthetic resume text with more than forty characters.", parseError: null,
  onRawTextChange: noop, onToggleManual: noop, onPickFile: noop, onEscalateOcr: noop,
  onParseText: noop, onRestart: noop, onSignUp: noop,
};

describe("CV import recovery", () => {
  it("distinguishes service failure from a genuinely empty parse and preserves retry text", () => {
    const markup = renderToStaticMarkup(<UploadStep {...props} parseError="Layanan AI sedang tidak tersedia." />);
    expect(markup).toContain("Gagal membaca CV");
    expect(markup).toContain("Layanan AI sedang tidak tersedia.");
    expect(markup).not.toContain("AI tidak menemukan data CV");
    expect(markup).toContain(props.rawText);
    expect(markup).toContain("Parse ulang");
    expect(renderToStaticMarkup(<UploadStep {...props} />)).toContain("AI tidak menemukan data CV");
  });
  it("also keeps image parse failures visible when returning to the file picker", () => {
    const markup = renderToStaticMarkup(<UploadStep {...props} phase="upload" parseError="Model tidak bisa membaca gambar." />);
    expect(markup).toContain("Model tidak bisa membaca gambar.");
    expect(markup).toContain("Ganti file");
  });
});
