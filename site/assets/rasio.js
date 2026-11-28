// pita warna rasio (legenda P-M ratio ala SAP2000) dan nama grup batang dalam bahasa awam
export const BANDS = [
  { max: 0.5, c: "#2f7fd8", t: "santai", r: "< 50%" },
  { max: 0.7, c: "#2bb24c", t: "nyaman", r: "50–70%" },
  { max: 0.9, c: "#f2c200", t: "sibuk", r: "70–90%" },
  { max: 1.0, c: "#f07a14", t: "dekat batas", r: "90–100%" },
  { max: 1e9, c: "#d81e1e", t: "lewat batas", r: "> 100%" },
];
export const band = r => BANDS.find(b => r < b.max) || BANDS[4];
export const NAMA = { COL: "Kolom utama", POST: "Tiang", ARM: "Lengan", RAIL: "Rel papan", STUD: "Tiang rangka papan", KICK: "Penopang miring", STRUT: "Penopang miring", BRACE: "Ikatan angin" };
