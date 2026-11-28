// adighanilham — data portofolio, gambar SVG, modal, reveal
export const PROJECTS = [
  { id:"kemang", n:"01", title:"Kemang Eco Hub", loc:"Jakarta Selatan", cat:"Jurnal 3D · LOD 400 · PBG/SLF", kind:"eco",
    desc:"Jurnal web three.js dan set gambar LOD 400 dari render desain, lengkap dengan paket PBG (SIMBG) dan SLF bertemplat as-built.",
    meta:[["Desain","PT Serasa Rancang Indonesia"],["Peran","jurnal 3D, gamtek, PBG/SLF"],["Kertas","A1"]], url:"https://kemang-eco-hub.vercel.app" },
  { id:"dak", n:"02", title:"Dak Makassar 15×18", loc:"Makassar", cat:"Struktur baja · Gamtek · 3D walkable", kind:"mezz",
    desc:"Dak baja (mezzanine) di dalam gudang eksisting: kolom WF lurus sambungan 90°, tangga dan roller conveyor manual, divisualkan sebagai web 3D yang bisa dijelajahi.",
    meta:[["Struktur","WF, dak baja"],["Luas","15 × 18 m"],["Keluaran","gamtek, web 3D, MP4"]], url:"https://dak-makassar.vercel.app" },
  { id:"ngoro", n:"03", title:"Gudang Ngoro", loc:"Ngoro, Mojokerto", cat:"Struktur baja · Digital twin", kind:"ware",
    desc:"Jurnal 3D interaktif tiga gudang baja 23 × 60 m, dengan dua versi desain: orisinal dan revisi tanpa kantor dan sosoran samping.",
    meta:[["Massa","3 gudang 23 × 60 m"],["Versi","V1 orisinal, V2 revisi"],["Platform","web 3D"]], url:"https://bambssquad.github.io/ngoro-digital-twin/" },
  { id:"g23", n:"04", title:"Gudang 23", loc:"Jawa Timur", cat:"Struktur baja · Jurnal 3D", kind:"ware2",
    desc:"Jurnal web 3D gudang rangka baja, dipublikasikan sebagai halaman statis interaktif.",
    meta:[["Struktur","rangka baja"],["Platform","web 3D"]], url:"https://bambssquad.github.io/gudang-23/" },
  { id:"mjk8", n:"05", title:"Gudang Mojokerto 8", loc:"Mojokerto", cat:"Struktur baja · Tahap 1 + 2", kind:"ware",
    desc:"Gudang baja dua tahap yang dibangun ulang dari gambar konsep PDF menjadi penjelajah 3D dan penampil gambar vektor CAD.",
    meta:[["Versi","Tahap 1, Tahap 1+2"],["Puncak T1","+13,70 m"],["Keluaran","web 3D, viewer CAD"]], url:null },
  { id:"maros", n:"06", title:"Maros Pergudangan 88", loc:"Maros, Sulawesi Selatan", cat:"Struktur baja · Gamtek", kind:"ware2",
    desc:"Kompleks pergudangan dengan mess dan kantor: set gambar teknik, PDF render dan jurnal web.",
    meta:[["Program","gudang, mess, kantor"],["Keluaran","gamtek, jurnal web"]], url:null },
];
export const PBG = [
  { id:"kludan", title:"Apotek Kludan", loc:"Tanggulangin, Sidoarjo", k:"PBG · revisi dinas", kind:"ruko1",
    desc:"Gambar PBG ruko apotek satu lantai. Revisi dari dinas: parkir depan tanpa atap, tambahan denah atap dan tabel komposisi lahan, GSB 3 m.",
    li:[["Lahan","± 60 m²"],["Bangunan","1 lantai"],["GSB","3 m"],["Kertas","A1"]],
    docs:[{ t:"Gambar PBG revisi 2 · A1", f:"pbg-apotek-kludan-rev2", n:1 }] },
  { id:"wage", title:"Apotek Alam Hijau Wage", loc:"Wage, Sidoarjo", k:"PBG perubahan fungsi · SLF", kind:"ruko2",
    desc:"Alih fungsi ruko dua lantai menjadi apotek: paket PBG perubahan fungsi dan SLF berisi gambar, perhitungan struktur, spesifikasi teknis dan RAB.",
    li:[["Bangunan","ruko 2 lantai"],["Rute","alih fungsi"],["Paket","PBG + SLF + RAB"]],
    docs:[{ t:"Gambar PBG · A2", f:"pbg-apotek-alam-hijau-wage", n:1 }, { t:"Perhitungan teknis struktur · A4", f:"perhitungan-struktur-apotek-wage", n:17 }] },
  { id:"kebonagung", title:"Apotek Kebonagung", loc:"Kebonagung, Sukodono, Sidoarjo", k:"PBG · ARS/STR/MEP", kind:"ruko1",
    desc:"Gambar PBG bangunan apotek dalam satu lembar A1: layout, denah, pondasi, sloof, kolom, instalasi air dan listrik, tampak, potongan dan rangka atap.",
    li:[["Bangunan","18,27 m²"],["KDB","64,28%"],["Kertas","A1, 1 lembar"]],
    docs:[{ t:"Gambar PBG V3 · A1", f:"pbg-apotek-kebonagung", n:1 }] },
  { id:"alamhijau", title:"Apotek Alam Hijau Sukodono", loc:"Klopo Sepuluh, Sukodono, Sidoarjo", k:"PBG · komposisi lahan", kind:"ruko1",
    desc:"Gambar PBG apotek satu lembar A1 lengkap arsitektur, struktur dan MEP, ditambah lembar rincian komposisi lahan.",
    li:[["Lahan","145 m²"],["Bangunan","93 m² (64,14%)"],["Kertas","A1 + tabel lahan"]],
    docs:[{ t:"Gambar PBG + komposisi lahan", f:"pbg-apotek-alam-hijau-sukodono", n:2 }] },
  { id:"huda", title:"SD Huda Center", loc:"Genuk, Semarang", k:"Masterplan · DED LOD 300", kind:"school",
    desc:"Masterplan tiga lot dan set gambar lengkap gedung kelas: 3 lantai, 24 kelas, atap dak dengan kelas luar ruang dan kulit louver lipat.",
    li:[["Lahan","1.610 m²"],["Gedung kelas","933 m², 3 lt"],["Model","Revit + IFC"]],
    docs:[{ t:"Gambar rencana teknis PBG · A1", f:"pbg-sd-huda-center", n:6 }] },
];

const NS = "http://www.w3.org/2000/svg";
export const el = (t, a = {}, h = "") => { const e = document.createElement(t); for (const k in a) e.setAttribute(k, a[k]); if (h) e.innerHTML = h; return e; };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const fmt = (x, d = 0) => Number(x).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- tampak belakang reklame dari data analisis ----------
export function elevSVG(d, opt = {}) {
  const W = 300, H = 300, pad = 18;
  const gz = d.typ === "rooftop" ? d.z0 : 0;
  const xs = d.nodes.map(n => n[0]), zs = d.nodes.map(n => n[2]);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, z0 = gz - (d.typ === "rooftop" ? 1.2 : 0.4), z1 = Math.max(...zs) + 0.6;
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (z1 - z0));
  const X = x => W / 2 + (x - (x0 + x1) / 2) * s, Z = z => H - pad - (z - z0) * s;
  const wmap = { COL: 2.4, POST: 1.6, ARM: 1.5, RAIL: 1, STUD: .7, KICK: .9, STRUT: 1, BRACE: .6 };
  let g = "";
  if (opt.panel !== false) g += `<rect x="${X(-d.B / 2)}" y="${Z(d.zt)}" width="${d.B * s}" height="${d.S * s}" fill="${opt.dark ? "#2a2a2a" : "#efede8"}"/>`;
  if (d.typ === "rooftop") g += `<rect x="${pad}" y="${Z(gz)}" width="${W - 2 * pad}" height="${(gz - z0) * s}" fill="url(#h${d.id})" stroke="${opt.dark ? "#666" : "#999"}" stroke-width=".6"/>`;
  else g += `<line x1="${pad}" x2="${W - pad}" y1="${Z(0)}" y2="${Z(0)}" stroke="${opt.dark ? "#888" : "#121212"}" stroke-width="1.2"/>`;
  for (const m of d.members) {
    const a = d.nodes[m.i], b = d.nodes[m.j];
    const hot = opt.ratio && m.ratio > .8;
    g += `<line x1="${X(a[0])}" y1="${Z(a[2])}" x2="${X(b[0])}" y2="${Z(b[2])}" stroke="${hot ? "#e0261b" : (opt.dark ? "#f1efe9" : "#121212")}" stroke-width="${wmap[m.g] || 1}" stroke-linecap="square"/>`;
  }
  if (opt.dims) {
    const c = opt.dark ? "#9c988f" : "#77746e";
    g += `<text x="${X(0)}" y="${Z(d.zt) - 6}" font-family="JetBrains Mono" font-size="8" fill="${c}" text-anchor="middle">${d.B} m</text>`;
    g += `<text x="${X(x1) - 2}" y="${Z(d.zt) + 3}" font-family="JetBrains Mono" font-size="8" fill="${c}" text-anchor="end">+${d.zt.toFixed(2)}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}"><defs><pattern id="h${d.id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${opt.dark ? "#555" : "#bbb"}" stroke-width=".6"/></pattern></defs>${g}</svg>`;
}

// ---------- ilustrasi garis proyek (bukan render; skematik) ----------
export function projSVG(kind, dark = false) {
  const c = dark ? "#f1efe9" : "#121212", m = dark ? "#6b6862" : "#b9b5ad", r = "#e0261b";
  const L = (x1, y1, x2, y2, w = 1, s = c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${w}"/>`;
  let g = "";
  const P = (x, y) => [200 + (x - y) * 0.86, 210 + (x + y) * 0.5];  // isometri
  const LI = (a, b, w = 1, s = c) => { const p = P(...a), q = P(...b); return L(p[0], p[1], q[0], q[1], w, s); };
  if (kind === "ware" || kind === "ware2") {
    const n = kind === "ware" ? 7 : 5, span = 70, len = 150, h = 34, rh = 14;
    for (let i = 0; i <= n; i++) {
      const y = -len / 2 + i * len / n, x0 = -span / 2, x1 = span / 2;
      const a = P(x0, y), b = P(x1, y);
      g += L(a[0], a[1], a[0], a[1] - h, 1.3) + L(b[0], b[1], b[0], b[1] - h, 1.3);
      const t = P(0, y);
      g += L(a[0], a[1] - h, t[0], t[1] - h - rh, 1.3, i === n ? r : c) + L(t[0], t[1] - h - rh, b[0], b[1] - h, 1.3, i === n ? r : c);
    }
    g += LI([-35, -75], [-35, 75], .6, m) + LI([35, -75], [35, 75], .6, m) + LI([-35, -75], [35, -75], .6, m) + LI([-35, 75], [35, 75], .6, m);
    for (let k = 0; k < 6; k++) { const yy = -75 + k * 30; const a = P(-35, yy), b = P(-35, yy + 30); g += L(a[0], a[1] - h, b[0], b[1], .5, m); }
  } else if (kind === "mezz") {
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++) { const a = P(-60 + i * 30, -45 + j * 30); g += L(a[0], a[1], a[0], a[1] - 40, 1.4); }
    for (let i = 0; i <= 4; i++) g += LI([-60 + i * 30, -45], [-60 + i * 30, 45], 1.1).replace(/y1="([\d.]+)"/, (s, v) => `y1="${v - 40}"`).replace(/y2="([\d.]+)"/, (s, v) => `y2="${v - 40}"`);
    for (let j = 0; j <= 3; j++) g += LI([-60, -45 + j * 30], [60, -45 + j * 30], 1.1).replace(/y1="([\d.]+)"/, (s, v) => `y1="${v - 40}"`).replace(/y2="([\d.]+)"/, (s, v) => `y2="${v - 40}"`);
    const a = P(60, 45), b = P(95, 45); g += L(a[0], a[1] - 40, b[0], b[1], 1.6, r);
    for (let k = 1; k < 8; k++) { const t = k / 8; g += L(a[0] + (b[0] - a[0]) * t - 6, a[1] - 40 + (b[1] - a[1] + 40) * t, a[0] + (b[0] - a[0]) * t + 6, a[1] - 40 + (b[1] - a[1] + 40) * t, .7, r); }
  } else if (kind === "eco") {
    for (let f = 0; f < 6; f++) { const w = 120 - f * 14, y = 250 - f * 26; g += `<rect x="${200 - w}" y="${y - 22}" width="${w * 2}" height="22" fill="none" stroke="${c}" stroke-width="1.1"/>`; for (let k = -w + 8; k < w; k += 9) g += L(200 + k, y - 22, 200 + k, y - 14, .5, f % 2 ? r : m); }
  } else if (kind === "school") {
    for (let f = 0; f < 3; f++) { g += `<rect x="60" y="${110 + f * 50}" width="280" height="50" fill="none" stroke="${c}" stroke-width="1.1"/>`; for (let k = 66; k < 340; k += 7) g += L(k, 114 + f * 50, k + 3, 156 + f * 50, .5, m); }
    g += L(60, 110, 340, 110, 2) + `<rect x="250" y="92" width="60" height="18" fill="none" stroke="${r}" stroke-width="1"/>` + L(40, 260, 360, 260, 1.4);
  } else { // ruko
    const fl = kind === "ruko2" ? 2 : 1, H0 = 260;
    for (let u = 0; u < 2; u++) {
      const x = 90 + u * 115;
      g += `<rect x="${x}" y="${H0 - fl * 70 - 24}" width="105" height="${fl * 70 + 24}" fill="none" stroke="${c}" stroke-width="1.2"/>`;
      for (let k = x + 8; k < x + 100; k += 5) g += L(k, H0 - 62, k, H0, .45, u === 0 ? r : m);
      if (fl > 1) g += `<rect x="${x + 18}" y="${H0 - 128}" width="70" height="36" fill="none" stroke="${c}" stroke-width=".8"/>`;
      g += L(x, H0 - fl * 70, x + 105, H0 - fl * 70, .8);
    }
    g += L(50, H0, 350, H0, 1.6) + `<rect x="95" y="${H0 - fl * 70 - 18}" width="60" height="10" fill="${r}"/>`;
  }
  return `<svg viewBox="0 0 400 320" xmlns="${NS}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}

// ---------- modal ----------
let modal;
export function openModal({ title, sub, body, foot }) {
  if (!modal) {
    modal = el("div", { class: "modal" }, `<div class="box"><div class="mh"><div><span class="mono sub"></span><br><b class="ttl"></b></div><button class="x" aria-label="Tutup">✕</button></div><div class="mb"></div><div class="mf"></div></div>`);
    document.body.append(modal);
    modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".x")) closeModal(); });
    addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  }
  $(".ttl", modal).textContent = title; $(".sub", modal).textContent = sub || "";
  const mb = $(".mb", modal); mb.innerHTML = ""; if (typeof body === "string") mb.innerHTML = body; else mb.append(body);
  $(".mf", modal).innerHTML = foot || "";
  modal.classList.add("on"); document.body.style.overflow = "hidden";
  return mb;
}
export function closeModal() {
  if (!modal) return; modal.classList.remove("on"); document.body.style.overflow = "";
  const mb = $(".mb", modal); mb.dispatchEvent(new Event("dispose")); mb.innerHTML = "";
}

export function reveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  $$(".reveal").forEach(n => io.observe(n));
}

export async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.json(); }
