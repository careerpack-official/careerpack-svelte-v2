import type { Field, Resource } from "./types";
const note: Field = {
  key: "note",
  label: "Catatan / isi dokumen",
  type: "textarea",
};
export const interior: readonly Resource[] = [
  {
    key: "profile",
    label: "Profil studio",
    singular: "Layanan",
    description: "Layanan, positioning, dan cakupan kerja studio ini.",
    states: ["Draf", "Aktif"],
    fields: [
      {
        key: "scope",
        label: "Lingkup layanan",
        type: "textarea",
        required: true,
      },
      note,
    ],
  },
  {
    key: "clients",
    label: "Klien",
    singular: "Klien",
    description:
      "Kontak klien studio; terpisah dari jaringan pribadi Careerpack.",
    states: ["Prospek", "Aktif", "Selesai"],
    fields: [
      { key: "contact", label: "Kontak" },
      { key: "email", label: "Email", type: "email" },
      note,
    ],
  },
  {
    key: "projects",
    label: "Proyek studio",
    singular: "Proyek",
    description:
      "Hubungkan proyek dengan klien sebelum menyiapkan tugas dan dokumennya.",
    parent: "clients",
    states: ["Brief", "Desain", "Pelaksanaan", "Selesai"],
    fields: [
      {
        key: "scope",
        label: "Brief / lingkup proyek",
        type: "textarea",
        required: true,
      },
      { key: "budget", label: "Estimasi anggaran (Rp)", type: "number" },
      { key: "due", label: "Target selesai", type: "date" },
    ],
  },
  {
    key: "tasks",
    label: "Tugas proyek",
    singular: "Tugas",
    description: "Tugas, penanggung jawab dan tenggat per proyek.",
    parent: "projects",
    states: ["Belum mulai", "Dikerjakan", "Selesai"],
    fields: [
      { key: "assignee", label: "Penanggung jawab" },
      { key: "due", label: "Tenggat", type: "date" },
      note,
    ],
  },
  {
    key: "proposals",
    label: "Proposal",
    singular: "Proposal",
    description:
      "Draf lingkup kerja, estimasi biaya, dan jadwal. Unduh teks untuk ditinjau sebelum dikirim.",
    parent: "projects",
    states: ["Draf", "Ditinjau", "Dikirim", "Disetujui"],
    fields: [
      { key: "amount", label: "Estimasi biaya (Rp)", type: "number" },
      {
        key: "content",
        label: "Lingkup, hasil kerja, biaya dan jadwal",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    key: "contracts",
    label: "Kontrak",
    singular: "Kontrak",
    description:
      "Draf kesepakatan proyek; tinjau ketentuan bersama pihak terkait sebelum digunakan.",
    parent: "projects",
    states: ["Draf", "Ditinjau", "Ditandatangani"],
    fields: [
      {
        key: "content",
        label: "Pihak, lingkup, pembayaran, revisi dan hak desain",
        type: "textarea",
        required: true,
      },
      { key: "due", label: "Tanggal kesepakatan", type: "date" },
    ],
  },
  {
    key: "documents",
    label: "Dokumen usaha",
    singular: "Dokumen",
    description:
      "Daftar dokumen usaha dan proyek, isi draf, serta status peninjauannya.",
    parent: "projects",
    states: ["Draf", "Perlu dilengkapi", "Ditinjau"],
    fields: [
      {
        key: "category",
        label: "Jenis dokumen (izin, brief, berita acara, lainnya)",
      },
      note,
    ],
  },
  {
    key: "portfolio",
    label: "Portofolio studio",
    singular: "Studi kasus",
    description:
      "Studi kasus milik studio ini; portofolio pribadi tidak disalin otomatis.",
    parent: "projects",
    states: ["Draf", "Disetujui klien", "Siap publikasi"],
    fields: [
      {
        key: "content",
        label: "Masalah, konsep, proses dan hasil",
        type: "textarea",
        required: true,
      },
      note,
    ],
  },
];
