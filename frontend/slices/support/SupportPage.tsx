import Link from "next/link";
import { ArrowUpRight, GraduationCap, Heart, Sprout } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function SupportPage({ donationUrl }: { donationUrl: string | null }) {
  return (
    <main id="main-content" className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-3xl space-y-4">
        <p className="text-sm font-medium text-primary">Dukung CareerPack</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Persiapan karir tetap gratis. Dukungan selalu sukarela.
        </h1>
        <p className="text-muted-foreground">
          Pencari kerja dan fresh graduate bisa menyiapkan masa depan tanpa harus membayar.
          Jika CareerPack membantu Anda, dukungan Anda bisa membantu membiayai operasional
          dan pengembangan berikutnya.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="flex min-w-0 flex-col">
          <CardHeader>
            <Sprout className="mb-2 size-6 text-primary" aria-hidden />
            <CardTitle>Untuk individu</CardTitle>
            <CardDescription>Gratis untuk mempersiapkan karir Anda.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              CV, portofolio, personal branding, ceklis dokumen, dan pelacak lamaran
              tetap bisa dipakai tanpa donasi. AI mengikuti kuota yang tersedia;
              Anda juga bisa memakai koneksi AI pribadi.
            </p>
            <Button asChild variant="outline" className="mt-auto">
              <Link href="/login">Mulai gratis</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <CardHeader>
            <Heart className="mb-2 size-6 text-primary" aria-hidden />
            <CardTitle>Dukungan sukarela</CardTitle>
            <CardDescription>Bantu CareerPack tetap berjalan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Donasi tidak menjadi syarat akses dan tidak membuka fitur berbayar.
              Anda menentukan nominal dan memilih metode pembayaran di halaman DOKU.
              Tidak ada langganan atau penagihan otomatis dari halaman ini.
            </p>
            {donationUrl && (
              <p className="text-xs text-muted-foreground">
                Nama penerima di DOKU: rahman fakhru, pengelola CareerPack.
              </p>
            )}
            {donationUrl ? (
              <Button asChild className="mt-auto">
                <a href={donationUrl} target="_blank" rel="noopener noreferrer">
                  Dukung lewat DOKU <ArrowUpRight aria-hidden />
                </a>
              </Button>
            ) : (
              <div className="mt-auto space-y-2">
                <Button disabled className="w-full">Donasi belum dibuka</Button>
                <p className="text-xs text-muted-foreground">Kami sedang menyiapkan halaman DOKU. CareerPack tetap gratis.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <CardHeader>
            <GraduationCap className="mb-2 size-6 text-primary" aria-hidden />
            <CardTitle>Untuk institusi</CardTitle>
            <CardDescription>Mari rancang program persiapan karir bersama.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Kami membuka diskusi pilot bersama sekolah, kampus, dan lembaga pelatihan:
              program sesuai jurusan, pendampingan peserta, dan penyesuaian branding.
              Ruang kerja institusi dan paket white label sedang dirancang.
            </p>
            <Button asChild variant="outline" className="mt-auto">
              <a href="mailto:hello@careerpack.org?subject=Diskusi%20pilot%20CareerPack%20untuk%20institusi">
                Diskusikan pilot
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="max-w-3xl space-y-3" aria-labelledby="pilot-heading">
        <h2 id="pilot-heading" className="text-xl font-semibold">Pilot yang ingin kami kembangkan</h2>
        <p className="text-sm text-muted-foreground">
          Salah satu fokusnya adalah interior design: membantu mahasiswa membangun
          portofolio dan personal branding, lalu membantu desainer mandiri menyiapkan
          profil usaha, proposal, dokumen proyek, dan relasi klien.
          Fitur bisnis akan diuji bersama peserta pilot sebelum ditawarkan sebagai paket.
        </p>
        <p className="text-sm text-muted-foreground">
          Punya kebutuhan serupa di bidang lain? Ceritakan program, jumlah peserta,
          dan hasil yang ingin dicapai melalui hello@careerpack.org.
        </p>
      </section>
    </main>
  );
}
