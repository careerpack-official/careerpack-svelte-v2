import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { listProvidersPublic } from "../../../../convex/_shared/aiProviders";

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":listAIProviders") ? listProvidersPublic() : null,
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

import { AIProviderForm } from "./AIProviderForm";

describe("OAuth affordances in both AI settings scopes", () => {
  it.each(["user", "global"] as const)("offers OpenRouter OAuth and honest ChatGPT availability in %s settings", scope => {
    const html = renderToStaticMarkup(React.createElement(AIProviderForm, { scope }));
    expect(html).toContain("Masuk dengan OpenRouter");
    expect(html).toContain("API Key");
    expect(html).toContain("menunggu persetujuan OpenAI");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Masuk dengan ChatGPT/);
    expect(html).toContain(scope === "global" ? "saldo akun OpenRouter admin" : "saldo akun OpenRouter Anda");
  });
});
