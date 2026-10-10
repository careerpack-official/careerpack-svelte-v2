import { it, expect, vi, afterEach } from "vitest";

const { mutation } = vi.hoisted(() => ({ mutation: vi.fn<(reference: unknown, args: Record<string, unknown>) => Promise<unknown>>(async () => null) }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class { mutation = mutation; } }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); mutation.mockReset(); });

it("finishes the analytics write before the Worker request ends and never sends a raw IP", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://api.careerpack.org");
  vi.resetModules();
  const { POST } = await import("./route");
  let finish!: () => void;
  mutation.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  let returned = false;
  const pending = POST(new Request("https://careerpack.org/api/analytics", {
    method: "POST", headers: { "cf-connecting-ip": "203.0.113.5", "cf-ipcountry": "ID" },
    body: JSON.stringify({ path: "/", viewport: "desktop" }),
  })).then(response => { returned = true; return response; });
  await vi.waitFor(() => expect(mutation).toHaveBeenCalledOnce());
  expect(returned).toBe(false);
  const payload = mutation.mock.calls[0][1];
  expect(payload).toMatchObject({ country: "ID", ipHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(JSON.stringify(payload)).not.toContain("203.0.113.5");
  finish();
  expect((await pending).status).toBe(204);
});

it("forwards anonymous public pageviews without private payloads or query tokens", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
  const capture = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", capture);
  mutation.mockResolvedValue(null);
  vi.resetModules();
  const { POST } = await import("./route");
  await POST(new Request("https://careerpack.org/api/analytics", {
    method: "POST", headers: { "cf-connecting-ip": "203.0.113.5" },
    body: JSON.stringify({ path: "/?token=private-token", eventType: "page_view",
      sessionId: "a123456789abcdef", properties: "private-cv", email: "private@example.com" }),
  }));
  expect(capture).toHaveBeenCalledOnce();
  const [url, options] = capture.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://us.i.posthog.com/i/v0/e/");
  const payload = JSON.parse(options.body as string);
  expect(payload).toMatchObject({ event: "$pageview", distinct_id: "careerpack-public:a123456789abcdef",
    properties: { $current_url: "https://careerpack.org/", $process_person_profile: false, $geoip_disable: true } });
  expect(options.body).not.toMatch(/private|203\.0\.113\.5/);
  for (const path of ["/dashboard", "/admin", "/login", "/reset-password", "/oauth/authorize", "https://other.example/", "//other.example/", "/\\other.example/"]) {
    await POST(new Request("https://careerpack.org/api/analytics", {
      method: "POST", body: JSON.stringify({ path, eventType: "page_view" }),
    }));
  }
  expect(capture).toHaveBeenCalledOnce();
});
