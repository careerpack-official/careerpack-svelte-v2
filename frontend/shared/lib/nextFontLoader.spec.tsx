import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const css = require("next/dist/compiled/@next/font/dist/google/fetch-css-from-google-fonts");
const files = require("next/dist/compiled/@next/font/dist/google/fetch-font-file");
const loader = require("next/dist/compiled/@next/font/dist/google/loader").default;
afterEach(() => vi.restoreAllMocks());

const load = (url: string, bytes: string, weight: string) => {
  vi.spyOn(css, "fetchCSSFromGoogleFonts").mockResolvedValue(
    `/* latin */\n@font-face { font-family: 'Inter'; src: url(${url}) format('woff2'); }`,
  );
  vi.spyOn(files, "fetchFontFile").mockResolvedValue(Buffer.from(bytes));
  const emit = vi.fn<(buffer: Buffer, extension: string) => string>(() => "/font.woff2");
  return { emit, result: loader({ functionName: "Inter", data: [{ weight, subsets: ["latin"] }], emitFontFile: emit, isDev: false, isServer: true }) };
};

describe("patched Google font loader", () => {
  it("accepts extensionless WOFF2 responses and preserves the stylesheet", async () => {
    const { emit, result } = load("https://fonts.gstatic.com/l/font?kit=test&skey=test", "wOF2fixture", "400");
    expect((await result).css).toContain("/font.woff2");
    expect(emit.mock.calls[0]?.[1]).toBe("woff2");
  });

  it("accepts a normal font URL with query parameters", async () => {
    const { emit, result } = load("https://fonts.gstatic.com/font.woff2?version=1", "wOF2fixture", "500");
    await result;
    expect(emit.mock.calls[0]?.[1]).toBe("woff2");
  });

  it("rejects an unrecognized extensionless response", async () => {
    await expect(load("https://fonts.gstatic.com/l/font?kit=invalid", "<html>error</html>", "600").result).rejects.toThrow("Unsupported Google font response format");
  });
});
