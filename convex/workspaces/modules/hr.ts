import type { Field, Resource } from "./types";
const note: Field = {
  key: "note",
  label: "Catatan untuk peserta",
  type: "textarea",
};
export const hr: readonly Resource[] = [
  {
    key: "vacancies",
    label: "Lowongan",
    singular: "Lowongan",
    description:
      "Setiap lowongan memiliki program kiriman tersendiri. Pelamar memakai akun Careerpack dan memilih data yang dibagikan.",
    states: ["Draf", "Terbuka", "Ditutup"],
    fields: [
      {
        key: "description",
        label: "Deskripsi pekerjaan",
        type: "textarea",
        required: true,
      },
      { key: "requirements", label: "Persyaratan", type: "textarea" },
      { key: "location", label: "Lokasi / remote" },
      { key: "due", label: "Batas lamaran", type: "date" },
    ],
  },
  {
    key: "schedules",
    label: "Jadwal wawancara",
    singular: "Jadwal",
    description:
      "Jadwal hanya untuk peserta yang sudah membagikan kiriman. Peserta melihat jadwalnya sendiri.",
    parent: "vacancies",
    states: ["Direncanakan", "Dikonfirmasi", "Selesai", "Dibatalkan"],
    fields: [
      { key: "date", label: "Tanggal", type: "date", required: true },
      { key: "time", label: "Jam (WIB, HH:mm)", required: true },
      { key: "location", label: "Tempat / tautan pertemuan", required: true },
      note,
    ],
  },
];
