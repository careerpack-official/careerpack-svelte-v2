# Workspace institusi, bisnis, dan HR — pilot 11 Oktober 2026

## Instruksi dan keputusan yang tidak boleh hilang

Pengguna meminta fondasi workspace institusi dan bisnis dengan interior design sebagai pilot. Bidang HR menggunakan frontend Careerpack dengan konfigurasi selevel bidang bisnis. Peserta default tetap di Careerpack; data pribadi hanya dibagikan secara pilihan. Repo HR client sudah ada dan sedang dikerjakan agent lain. Pengguna **meminta repo HR pilot baru** agar konteks dan pekerjaan client tidak terganggu. Repo tetap terpisah sampai client secara eksplisit menyetujui merge; tidak ada instruksi untuk mengubah repo HR client.

Baseline sumber: `careerpack-official/careerpack-svelte-v2`, commit `c7f9b9d3090a62c2471469d9b4aa85f40f1d5116`. Nama repo historis; stack nyata Next.js 15, React 19, Convex. Backend produksi Careerpack: `accomplished-vole-302`, domain `careerpack.org`. Jangan mengikuti deployment legacy dalam dokumen lama.

Clone baru private: [careerpack-hr-pilot](https://github.com/careerpack-official/careerpack-hr-pilot). Tidak membawa file env privat, kredensial, data produksi, workflow deploy Careerpack, route domain Careerpack, atau bucket cache Careerpack. Backend sumber disertakan untuk tipe dan pengujian; clone HR tidak boleh men-deploy backend bersama.

## Sumber konteks Linear

- [RAH-207 — perubahan utama](https://linear.app/rahman-hq/issue/RAH-207/careerpack-workspace-institusi-bisnis-interior-design-dan-pilot-hr)
- [Dokumen keputusan](https://linear.app/rahman-hq/document/careerpack-workspace-and-hr-pilot-konteks-batas-data-dan-keputusan-8a1b199aab92)
- RAH-208: fondasi workspace dan isolasi data.
- RAH-209: preset interior design dan alur peserta HR.
- RAH-210: clone HR, email/notifikasi, QA, dan release.

## Arsitektur pilot

Backend Careerpack bersama mempertahankan identitas peserta Careerpack. Tabel workspace baru menyimpan anggota, undangan, program, dan kiriman terpisah dari tabel pribadi. Setiap query/mutation yang membaca atau mengubah workspace memeriksa membership dan peran di server. ID workspace di URL dan mode frontend **bukan otorisasi**. Admin platform tidak otomatis menjadi anggota atau reviewer organisasi.

`frontend/shared/lib/productMode.ts` mengatur mode frontend. Sumber default `careerpack`; clone default `hr`. `NEXT_PUBLIC_PRODUCT_MODE` dapat mengubah tampilan tanpa mengubah izin. Mode HR membuka hub workspace di dashboard, default membuat workspace bisnis HR, dan mengarahkan persiapan pribadi serta undangan peserta ke Careerpack utama. Domain/login OAuth HR terpisah membutuhkan konfigurasi origin resmi sebelum rilis client; jangan melonggarkan pemeriksaan redirect untuk menerima origin sembarang.

Preset memakai jenis `institution` / `business` dan bidang `interior-design` / `hr`. Label dan checklist berasal dari konfigurasi server; bukan salinan implementasi fitur tiap bidang. Institusi interior: CV, portofolio, branding, presentasi konsep. Bisnis interior: profil studio, portofolio, proposal, draft kontrak, daftar dokumen usaha. HR: CV, portofolio, dokumen pilihan, persiapan wawancara. Daftar dokumen usaha merupakan bahan persiapan dan review, bukan keputusan otomatis tentang kepatuhan hukum.

## Peran dan alur

Pemilik/admin mengelola program dan undangan. Hanya pemilik yang memberikan peran admin atau mengubah peran anggota. Mentor/reviewer meninjau kiriman workspace. Peserta/anggota menyiapkan dan membagikan kiriman sendiri; tidak melihat kiriman peserta lain. Pemilik tidak dapat dikeluarkan atau keluar sehingga workspace tidak menjadi tanpa pemilik.

Alur peserta: buka undangan → login Careerpack dengan alamat penerima → verifikasi email melalui Google atau email verifikasi → setujui nama/email terlihat pengelola → bergabung → siapkan bahan memakai fitur pribadi → pilih berkas pustaka dan catatan → beri persetujuan → bagikan ke program → reviewer manusia memberi umpan balik → peserta mendapat pembaruan → perbarui atau tarik kiriman.

Undangan terikat email tujuan, hash token acak, masa berlaku tujuh hari, sekali pakai, dan inviter yang masih berwenang. Undangan baru ke email yang sama membatalkan tautan sebelumnya. Undangan tidak menaikkan peran anggota lama secara diam-diam. Token verifikasi email hanya berlaku pada akun dan alamat yang meminta, berlaku 24 jam, serta tidak mengubah password.

Pustaka berkas tetap milik peserta. Tidak ada import otomatis semua CV/profil/dokumen ke organisasi. Pembagian hanya mereferensikan file yang dimiliki pengirim. Pustaka menandai file yang sedang dipakai kiriman workspace. Reviewer tidak mendapatkan URL storage permanen: unduhan memakai ticket lima menit, memeriksa ulang membership reviewer dan pengirim, versi kiriman, file pilihan, serta kepemilikan file saat mengunduh. Mengganti/menarik kiriman, mengeluarkan anggota, turun peran reviewer, menghapus file, atau expiry menolak akses selanjutnya. Salinan yang sudah diunduh penerima tidak dapat ditarik dari perangkat mereka; persetujuan UI menjelaskan batas ini.

## Email dan notifikasi

Email memakai layanan Resend dan template Careerpack yang sudah ada; Hostinger tetap inbox, Cloudflare tetap DNS/frontend. Konfigurasi server: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `APP_URL` HTTPS. Tidak memasukkan secret ke frontend, URL, repo, atau Linear.

Notifikasi workspace aktif secara default. Email pembaruan **off** secara default, preferensi per pengguna/per workspace. Pengelola memilih apakah undangan dikirim email; default tersedia sebagai tautan manual. Email pembaruan hanya berisi pemberitahuan umum dan tautan program, tanpa CV, file, nilai, atau catatan reviewer. Unsubscribe global dihormati untuk undangan/pembaruan. Email verifikasi yang secara eksplisit diminta pengguna adalah email autentikasi. Status `sent` berarti provider menerima pengiriman; tidak menjamin inbox/delivered. Gagal/ditahan/antrean ditampilkan tanpa klaim sukses palsu.

## Batas pilot dan lifecycle

Maksimum 20 workspace per akun, 100 anggota dan 20 program per workspace. Query memakai index dan batas sesuai cap; naikkan batas hanya setelah pagination. Satu kiriman per peserta/program, checklist mengikuti preset, catatan maksimum 2.000 karakter per item. Nama workspace 100 karakter, judul program 120 karakter, deskripsi/umpan balik 2.000 karakter. Rate limit melindungi pembuatan workspace, undangan, kiriman, unduhan dan verifikasi email.

Keluar/offboarding menarik kiriman dan membership; berkas pribadi tetap tersimpan. Penghapusan akun membersihkan membership/kiriman/undangan/ticket/notifikasi terkait dan mengarsipkan workspace yang dimilikinya agar data peserta lain tidak dihapus secara mendadak. Ticket expired dan verifikasi expired dibersihkan setiap jam; notifikasi disimpan maksimum 30 hari dengan pembersihan bertahap.

## Pemeriksaan dan release

Backend: tes lintas dua workspace, nonmember/admin platform, peserta vs reviewer, undangan salah email/belum terverifikasi/replay/expiry/revoke, persetujuan, closed program, panjang/input, file milik orang lain, unduhan setelah withdraw/offboarding/turun peran/update/expiry/delete, notifikasi dan mock Resend, penghapusan akun. Frontend: desktop 1440, tablet 768, mobile 390; semua tab, form/modal, picker, tombol, kiriman dan penarikan. Pastikan tujuan undangan tetap tersimpan setelah login.

Jalankan typecheck, lint, seluruh test, coverage, build, CI branch, review, lalu deploy pipeline Careerpack dengan target backend produksi yang benar. Clone HR diuji terpisah dengan frontend mode HR; workflow deploy backend produksi dihilangkan. Setelah deploy, cocokkan build SHA dan smoke fitur produksi. Catat hasil nyata di Linear; jangan menandai pekerjaan selesai sebelum evidence tersedia.

## Di luar pilot ini

Billing/kontrak white label, SSO institusi, custom branding/domain client, keputusan perekrutan otomatis, sinkronisasi repo HR client, dan merger repositori belum diaktifkan. OpenRouter sistem yang masih 401 membutuhkan kredensial sah; ChatGPT OAuth masih menunggu client ID OpenAI. Status tersebut tidak boleh dinyatakan selesai hanya karena hub workspace tersedia.
