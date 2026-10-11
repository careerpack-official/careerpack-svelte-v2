# CareerPack: monetisasi, DOKU, dan workspace

Rancangan awal, 11 Oktober 2026. Harga dan target berikut adalah hipotesis untuk diuji, bukan penawaran yang sudah berlaku. Tahap yang mulai dibangun: halaman `/dukung`, donasi sukarela melalui DOKU, dan jalur kontak pilot institusi. Workspace bersama, langganan, dan white label belum diimplementasikan.

## Keputusan produk

CareerPack tetap gratis untuk individu. Donasi membantu operasional; pendapatan utama yang ditargetkan berasal dari institusi yang membiayai program bagi pesertanya. Uji workspace bisnis pada satu bidang dahulu, yaitu interior design. Pertahankan satu aplikasi dan basis kode.

Institusi lebih dekat dengan kebutuhan produk sekarang: CV, portofolio, dokumen, roadmap, pendampingan karir. ITS Career Center menyediakan layanan CV, karir, dan entrepreneurship melalui platform mitra; ini menunjukkan bentuk kebutuhan yang ada, bukan bukti bahwa mereka akan membeli CareerPack. [Sumber ITS](https://www.its.ac.id/careers/layanan/).

Bisnis berpotensi memiliki anggaran lebih besar jika produk membantu mendapatkan klien atau mengurangi pekerjaan administrasi. Namun mengganti nama fitur belum membuktikan nilai itu. Validasi studio interior dan desainer mandiri sebelum memperluas ke berbagai industri. Posisi pilot: persiapan usaha dan portofolio profesional; hindari perluasan langsung ke ERP, akuntansi, atau project management lengkap.

## Jalur pendapatan

| Jalur | Pembayar | Yang ditawarkan | Pola tagihan |
| --- | --- | --- | --- |
| Individu | Tidak wajib membayar | Fitur karir inti; AI mengikuti kuota atau BYOK | Gratis |
| Dukungan sukarela | Pengguna, alumni, pendukung | Membantu operasional tanpa hak akses khusus | Donasi satu kali, nominal bebas |
| Program institusi | Sekolah, kampus, lembaga pelatihan | Paket persiapan sesuai jurusan, pendampingan, pengelolaan kelompok dan ringkasan progres setelah tersedia | Pilot per kelompok, lalu kontrak tahunan |
| White label | Institusi atau mitra | Branding, domain, konfigurasi program, onboarding dan dukungan | Biaya setup + biaya tahunan |
| Pilot bisnis interior | Desainer mandiri atau studio | Profil usaha, portofolio proyek, proposal, ceklis kesiapan dan alur prospek | Pilot berbayar; langganan hanya setelah penggunaan berulang terbukti |
| Program sponsor | Institusi, perusahaan, alumni | Membiayai kelompok peserta dengan hasil program yang terukur | Kontrak program; sponsor tidak memperoleh data pribadi peserta otomatis |

Donasi dan paket institusi tidak mengunci data, unduhan CV, atau fitur karir individu. Jangan menaruh permintaan donasi sebelum login, unggah, atau ekspor berhasil. Jangan menjual data pencari kerja.

Hipotesis harga untuk wawancara pelanggan: pilot institusi Rp 1.500.000–Rp 3.000.000 untuk satu kelompok selama 6–8 minggu; white label Rp 3.000.000–Rp 7.500.000 biaya setup dan Rp 6.000.000–Rp 18.000.000 per tahun. Uji pilot studio interior Rp 150.000–Rp 500.000 per bulan. Sesuaikan jumlah peserta, dukungan, penyimpanan, dan biaya AI sebelum menawarkan kontrak. Tidak ada harga ini yang ditampilkan pada halaman publik.

AI tidak dijanjikan tanpa batas: pertahankan kuota yang ada dan koneksi pribadi. Pada workspace institusi, siapkan anggaran AI per workspace, batas biaya, dan kebijakan provider. Saldo OpenRouter milik pembayar tetap terpisah dari biaya layanan CareerPack.

## Unit economics yang perlu diukur

Estimasi margin operasional = pendapatan kontrak + donasi yang benar-benar diterima − biaya pembayaran − AI yang ditanggung CareerPack − storage/hosting − dukungan. Donasi satu kali bukan MRR. Biaya setup satu kali dilaporkan terpisah dari pendapatan berulang. Hitung juga pajak yang relevan, pembatalan, dan refund; angka bruto bukan keuntungan.

Contoh simulasi, bukan proyeksi: 1.000 pengguna aktif bulanan × 2% donatur × Rp 25.000 = Rp 500.000 donasi bruto. Tiga institusi × Rp 12.000.000 per tahun menghasilkan ekuivalen Rp 3.000.000 per bulan, tetapi kas masuk mengikuti jadwal pembayaran kontrak. Ini alasan menguji institusi sebagai sumber pendanaan utama, bukan mengandalkan donasi saja.

DOKU mempublikasikan biaya QRIS 0,7% dan virtual account umumnya Rp 4.000; BCA berbeda. Harga tersebut belum termasuk PPN dan ketentuan merchant/channel bisa berbeda. Donasi kecil lebih sensitif terhadap biaya nominal tetap. Gunakan tarif merchant sebenarnya saat menghitung margin. [Harga resmi DOKU](https://www.doku.com/en-us/pricing).

## DOKU tahap pertama

Payment Link dibuat dan terverifikasi **Active** pada 11 Oktober 2026: [Dukung CareerPack](https://pay.doku.com/p-link/p/careerpack-support). Konfigurasi **Multiple Payment Link / Terima Jumlah Apapun**, penggunaan tanpa batas jumlah transaksi, kedaluwarsa **10 Oktober 2027, 23:59:59 WIB**, tanpa perpanjangan otomatis. Nama penerima yang terlihat adalah **rahman fakhru**; akun merchant yang dipakai masih milik pengelola dengan login rahmanef63@gmail.com. Nama ini juga dijelaskan pada halaman dukungan. Jika identitas merchant berubah, perbarui keterangan penerima sebelum memakai link baru.

Halaman publik meminta nama dan email donor serta nominal, tanpa nomor telepon atau alamat. URL setelah berhasil kembali ke `/dukung`; redirect ini tidak dipakai sebagai bukti pembayaran. Transaksi nyata dan pencairan belum diuji. Jenis link ini didukung oleh [dokumentasi Payment Link DOKU](https://docs.doku.com/accept-payments/no-integration-products/payment-link).

1. Masuk ke akun merchant CareerPack di dashboard DOKU → Accept Payments → Payment Link → Create Payment Link.
2. Pilih Multiple Payment Link dan Accept Any Amount. Deskripsi: “Dukungan sukarela untuk operasional dan pengembangan CareerPack. Layanan individu tetap gratis; kontribusi ini tidak membeli fitur atau langganan.”
3. Pilih metode yang aktif di akun merchant. Tinjau nama penerima, biaya, masa berlaku, dan batas penggunaan link. Jangan mengaktifkan penagihan berulang pada tahap ini.
4. Jangan meminta alamat, CV, atau dokumen peserta. Jika diperlukan untuk bukti transaksi, gunakan informasi minimum yang didukung DOKU.
5. Uji tampilan penerima, nominal, dan opsi pembayaran. Transaksi nyata dilakukan pemilik akun dengan nominal yang mereka setujui; tes halaman tidak berarti transaksi telah berhasil.
6. Simpan URL publik `https://pay.doku.com/...` pada GitHub production environment variable `NEXT_PUBLIC_DOKU_DONATION_URL`, lalu deploy ulang. Ini URL publik, bukan Client ID, Secret Key, atau API key. Build frontend membacanya; tidak perlu mengubah backend Convex.
7. Cocokkan transaksi melalui dashboard DOKU. Pantau link yang kedaluwarsa atau dinonaktifkan; kosongkan konfigurasi dan deploy ulang bila perlu.

Halaman `/dukung` menonaktifkan tombol donasi jika URL kosong atau tidak valid. URL harus HTTPS, host tepat `pay.doku.com`, tanpa kredensial atau port khusus, dan punya path. Tidak ada status pembayaran, saldo, atau entitlement yang diberikan dari klik maupun URL redirect. Halaman sementara tidak diindeks mesin pencari.

[Panduan pembuatan Payment Link](https://docs.doku.com/accept-payments/no-integration-products/payment-link/create-payment-link). Tampilan dashboard dan metode yang tersedia perlu dikonfirmasi di akun merchant saat setup.

## DOKU tahap berikutnya

Untuk kontrak pilot awal, gunakan invoice dan Single Payment Link per institusi, direkonsiliasi manual. Tahun pertama bisa dibayar di muka; tagihan tahunan tidak harus auto-debit.

Tambahkan DOKU Checkout API dan pencatatan pembayaran hanya ketika aktivasi paket otomatis diperlukan. Kredensial API tetap server-side. Buat harga/order dari katalog server, verifikasi signature sesuai produk DOKU yang dipilih, cocokkan order/nominal/mata uang, proses notifikasi secara idempotent, dan dukung notifikasi berulang atau tidak berurutan. Redirect browser tidak membuktikan pembayaran. Uji sandbox: paid, failed, expired, duplikat, signature salah, nominal salah, retry, dan pembatalan/refund sebelum produksi.

Produk, metode, otorisasi recurring, dan kontrak merchant perlu dikonfirmasi sebelum auto-debit ditawarkan. Jangan menyamakan “partial/recurring payment” pada Payment Link dengan izin mendebit pelanggan otomatis. [DOKU Checkout](https://docs.doku.com/accept-payments/integration-tools/doku-checkout), [webhook DOKU](https://docs.doku.com/get-started/manage-business/set-up-integration/webhook-payment-notification).

## Workspace: bagian yang bisa dipakai ulang

Kode sekarang memakai `userId` untuk kepemilikan. [`files/schema.ts`](../convex/files/schema.ts) secara eksplisit menyebut `tenantId` sebagai duplikat ID pengguna, bukan isolasi organisasi. Belum ada organisasi, membership, atau role per workspace. Registry navigasi sebenarnya berada di [`dashboardRegistry.tsx`](../frontend/shared/lib/dashboardRegistry.tsx); file nav/routing lain merupakan re-export. Jangan membuat registry kedua.

| Fitur karir | Pilot interior | Bagian yang dipakai ulang |
| --- | --- | --- |
| Profil & personal branding | Profil desainer atau profil studio | Form, tema, renderer publik; izin publik tetap opt-in |
| Portofolio | Studi kasus, moodboard, hasil proyek | Upload, kartu, galeri dan tampilan detail |
| Ceklis dokumen | Kesiapan profesi/usaha dan berkas proyek | Tampilan, progres, lampiran; template dan pemilik berbeda |
| Roadmap skill | Kompetensi desain dan kesiapan mendapatkan klien | Renderer, milestone dan progres; konten sesuai bidang |
| Jaringan | Klien, vendor, kontraktor dan mentor | Komponen kontak; relasi workspace perlu ditambahkan |
| Kalender | Konsultasi, kunjungan lokasi dan tenggat | Kalender; keterkaitan entitas proyek perlu benar |
| Lamaran kerja | Prospek klien / penawaran | Komponen tabel dan filter; model/status prospek berbeda |
| CV | Profil usaha / capability statement | Input/media dapat dibagi; dokumen, template dan generator berbeda |

Dokumen pilot interior: portfolio/studi kasus, brief klien, moodboard, proposal layanan, rincian scope, penawaran, kontrak, invoice dan checklist serah terima. Kelompok identitas/perizinan usaha ditambahkan dengan sumber resmi, yurisdiksi dan tanggal peninjauan; daftar wajib harus divalidasi per jenis usaha. Label “lengkap” tidak boleh berarti otomatis sah secara hukum.

Konfigurasi yang diusulkan, belum runtime: jenis workspace `personal | organization`, track `career | business`, bidang seperti `interior-design`, branding, label tampilan, fitur aktif, template checklist/roadmap, serta kebijakan AI. Paket berbayar/entitlement diperiksa server-side; konfigurasi label atau URL tidak memberikan akses.

Personal workspace tetap tersedia ketika seseorang bergabung ke institusi. CV pribadi tidak otomatis menjadi data sekolah. Peserta bisa mengikuti program tanpa menyerahkan seluruh profil, berkas atau riwayat AI; berbagi item tertentu harus eksplisit.

Untuk pilot bersama, tambahkan tabel workspace dan membership dengan role owner/admin/mentor/member. Bedakan admin organisasi dari admin global CareerPack. Tambahkan scope/index pada modul bersama dan pemeriksaan membership pada query, mutation, action, pencarian, ekspor, storage URL, notifikasi, dan MCP. Background jobs juga mengikuti scope. Kredensial AI institusi harus milik workspace, bukan mengubah default global seluruh aplikasi.

Migrasi bertahap: akun/data lama tetap personal; tambahkan field optional yang kompatibel; jangan mengubah `files.tenantId` menjadi ID organisasi. Pindah atau berbagi data hanya melalui operasi eksplisit. Uji dua organisasi, anggota yang keluar, mentor tanpa akses file pribadi, dan pengguna yang memanipulasi ID sebelum workspace dibuka.

White label awal cukup tenant dengan logo, warna, nama program, dan template. Domain khusus dan deployment terpisah hanya ditawarkan jika pelanggan membutuhkan dan biaya operasionalnya dihitung. Branding domain tidak menggantikan isolasi data.

## Urutan implementasi dan validasi

| Tahap | Hasil yang harus terlihat | Kriteria lanjut |
| --- | --- | --- |
| 1 — Dukungan | `/dukung`, link DOKU valid, CTA pilot, laporan transaksi manual | Link merchant ditinjau dan satu transaksi pemilik terkonfirmasi |
| 2 — Validasi | Wawancara 3–5 institusi dan 3–5 studio/desainer; demo alur interior | Minimal satu pilot berbayar dengan scope dan pembayar jelas |
| 3 — Workspace pilot | Membership, grup/program, template bidang dan akses terisolasi | Tes lintas organisasi lulus; peserta menyelesaikan alur inti |
| 4 — White label | Branding konfigurasi, onboarding, invoice dan dukungan | Pembaruan kontrak/pemakaian berulang; margin setelah biaya positif |
| 5 — Billing otomatis | Checkout, webhook dan entitlement | Sandbox + rekonsiliasi transaksi nyata lulus; diperlukan oleh operasi |

Ukur: aktivasi CV/portfolio/checklist, penggunaan mingguan, kelompok yang selesai, waktu mentor yang dihemat, respons proposal studio, biaya AI/storage per peserta aktif, waktu dukungan, donasi bersih, serta calon pembeli yang menyetujui pilot. Sertakan kriteria berhenti: jika studio hanya tertarik demo tanpa pemakaian atau pembayaran, fokus kembali pada program institusi.

## Lisensi dan keputusan yang masih terbuka

Repository adalah fork dari `rahmanef63/CareerPack`; [`LICENSE`](../LICENSE) memakai PolyForm Noncommercial dan mencantumkan Rahman. Pemegang hak dapat menawarkan lisensi tambahan, tetapi perlu memastikan hak atas kontribusi lain sebelum menjual distribusi/white label. Lisensi publik tidak diubah dalam tahap ini. [Teks resmi lisensi](https://polyformproject.org/licenses/noncommercial/1.0.0).

Masih perlu diputuskan: calon pilot pertama, kebutuhan akses mentor, batas peserta/storage/AI, tarif kontrak, hak penggunaan komersial, serta konfigurasi Payment Link DOKU. Tidak ada fitur individu yang dikunci atau tagihan yang dibuat oleh perubahan awal ini.
