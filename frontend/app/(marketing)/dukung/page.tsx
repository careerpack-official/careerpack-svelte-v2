import type { Metadata } from "next";
import { SupportPage } from "@/slices/support/SupportPage";
import { dokuDonationUrl } from "@/slices/support/lib/dokuDonationUrl";

export const metadata: Metadata = {
  title: "Dukung CareerPack",
  description: "CareerPack gratis untuk individu. Dukung pengembangannya secara sukarela atau diskusikan pilot bersama institusi.",
  alternates: { canonical: "/dukung" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <SupportPage donationUrl={dokuDonationUrl(process.env.NEXT_PUBLIC_DOKU_DONATION_URL)} />;
}
