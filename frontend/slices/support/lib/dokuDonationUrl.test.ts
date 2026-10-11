import { describe, expect, it } from "vitest";
import { dokuDonationUrl } from "./dokuDonationUrl";

describe("DOKU donation destination", () => {
  it("accepts a public DOKU payment link", () => {
    expect(dokuDonationUrl(" https://pay.doku.com/p-link/p/careerpack "))
      .toBe("https://pay.doku.com/p-link/p/careerpack");
    expect(dokuDonationUrl("https://pay.doku.com/Careerpack"))
      .toBe("https://pay.doku.com/Careerpack");
  });
  it.each([undefined, "", "not a URL", "javascript:alert(1)", "http://pay.doku.com/donate",
    "https://pay.doku.com.evil.example/donate", "https://evil.example/pay.doku.com",
    "https://pay.doku.com@evil.example/donate", "https://user:password@pay.doku.com/donate",
    "https://pay.doku.com:8443/donate", "https://pay.doku.com/"])("disables an invalid destination: %s", value => {
    expect(dokuDonationUrl(value)).toBeNull();
  });
});
