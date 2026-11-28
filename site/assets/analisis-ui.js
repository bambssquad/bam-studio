// adighanilham — halaman analisis yang mudah dipahami orang awam.
// Semua angka berasal dari data/<id>.json (hasil engine.py + scenario.py).
import { fmt, elevSVG } from "./common.js";
import { BANDS, band, NAMA } from "./rasio.js";

const f0 = x => fmt(x, 0), f1 = x => fmt(x, 1), f2 = x => fmt(x, 2);
const kmh = v => f0(v * 3.6);
const kgm2 = kpa => f0(kpa * 1000 / 9.81);
const ton = kn => f1(kn / 9.81);
const pct = u => u > 3 ? ">300%" : `${f0(u * 100)}%`;
const cls = u => u <= .9 ? "ok" : u <= 1 ? "warn" : "ng";

// ---------- cek desain (beban rencana) ----------
function designChecks(d) {
  const P = d.params, roof = d.typ === "rooftop";
  const gov = d.members.reduce((a, b) => b.ratio > a.ratio ? b : a);
  const out = [
    { k: "batang", h: "Batang baja", u: gov.ratio, say: `Bagian paling sibuk: ${(NAMA[gov.g] || gov.g).toLowerCase()} (${d.sections[gov.g].name}). Masih ada cadangan ${f0(Math.max(0, 1 - gov.ratio) * 100)}% sebelum batas.`, num: `Rasio P-M ${f2(gov.ratio)} ≤ 1,00 · kombinasi ${gov.combo} · SNI 1729 LRFD` },
    { k: "lendutan", h: "Goyangan puncak", u: d.defl.dmax / d.defl.dlim, say: `Saat angin layan, puncak bergeser ${f0(d.defl.dmax / 10)} cm. Batasnya ${f0(d.defl.dlim / 10)} cm (tinggi/100) supaya papan tidak terasa limbung.`, num: `δ ${f1(d.defl.dmax)} / ${f1(d.defl.dlim)} mm · D + 0,6W` },
  ];
  if (roof) {
    for (const [nm, a] of Object.entries(d.anchors || {}))
      out.push({ k: "angkur-" + nm, h: `Angkur ${nm}`, u: a.ratio, say: `${a.n} angkur kimia M${a.d} per tumpuan ${nm}. Tarik ${f1(a.Tu)} kN (≈ ${f0(a.Tu * 102)} kg) per angkur.`, num: `Interaksi tarik-geser ${f2(a.ratio)} · batas desain 0,60` });
    out.push({ k: "sambungan", h: "Sambungan baut", u: d.conn.ratio, say: `${d.conn.n} baut M${d.conn.d} di ujung ${(NAMA[d.conn.g] || d.conn.g).toLowerCase()}.`, num: `T ${f1(d.conn.T)} / φT ${f1(d.conn.phiT)} kN` });
    out.push({ k: "bangunan", h: "Bangunan di bawahnya", u: null, say: "Pelat, balok dan kolom atap eksisting belum dicek. Wajib diperiksa ahli struktur sebelum dipasang.", num: "Di luar lingkup studi" });
  } else {
    const bp = d.baseplate, ft = d.footing;
    out.push({ k: "baseplate", h: "Pelat dasar & angkur", u: bp.ratio, say: `${bp.n} angkur M${bp.d} menahan kaki tiang. Tarik terbesar ${f1(bp.Tu)} kN (≈ ${f1(bp.Tu / 9.81)} ton) per angkur.`, num: `Pelat Ø${bp.Dp}×${bp.tp} mm · t perlu ${f1(bp.treq)} mm · rasio ${f2(bp.ratio)}` });
    out.push({ k: "tanah", h: "Tekanan ke tanah", u: ft.qmax / P.SOIL.qa, say: `Pondasi ${ft.Lx}×${ft.Ly} m menekan tanah ${f0(ft.qmax)} kPa (≈ ${f2(ft.qmax / 98.1)} kg/cm²). Tanah diasumsikan kuat ${P.SOIL.qa} kPa.`, num: `q maks ${f1(ft.qmax)} / qa ${P.SOIL.qa} kPa · asumsi, perlu sondir` });
    out.push({ k: "guling", h: "Tidak terguling", u: 1.5 / ft.FS_guling, say: `Berat pondasi + tanah menahan ${f2(ft.FS_guling)}× gaya yang mau menggulingkan. Minimal 1,5×.`, num: `FS guling ${f2(ft.FS_guling)} ≥ 1,50 · 0,6D + 0,6W` });
    out.push({ k: "geser", h: "Tidak bergeser", u: 1.5 / ft.FS_geser, say: `Gesekan dasar pondasi ${f2(ft.FS_geser)}× lebih besar dari dorongan angin. Minimal 1,5×.`, num: `FS geser ${f2(ft.FS_geser)} ≥ 1,50 · μ ${P.SOIL.mu}` });
  }
  return out;
}

// ---------- skenario ----------
function lerpSweep(sc, Vv) {
  const S = sc.sweep;
  let i = S.findIndex(s => s.V > Vv) - 1;
  if (i < 0) i = Vv < S[0].V ? 0 : S.length - 2;
  i = Math.min(i, S.length - 2);
  const a = S[i], b = S[i + 1], t = Math.max(0, Math.min(1, (Vv - a.V) / (b.V - a.V)));
  const L = (x, y) => x + (y - x) * t;
  const o = { V: Vv, r: a.r.map((x, j) => L(x, b.r[j])), dmax: L(a.dmax, b.dmax) };
  for (const k of ["qmax", "angkur"]) if (a[k] != null) o[k] = L(a[k], b[k]);
  for (const k of ["FS_guling", "FS_geser"]) if (a[k] != null) o[k] = 1 / L(1 / a[k], 1 / b[k]);
  return o;
}
function scenChecks(d, s) {
  const roof = d.typ === "rooftop", qa = d.params.SOIL.qa;
  const rmax = Math.max(...s.r), gi = s.r.indexOf(rmax), g = d.members[gi].g;
  const out = [
    { k: "batang", nm: "batang baja", h: "Batang baja", u: rmax, sub: NAMA[g] || g },
    { k: "lendutan", nm: "goyangan puncak", h: "Goyangan puncak", u: s.dmax / d.defl.dlim, sub: `${f0(s.dmax / 10)} cm dari batas ${f0(d.defl.dlim / 10)} cm` },
  ];
  if (roof) out.push({ k: "angkur", nm: "angkur atap", h: "Angkur atap", u: s.angkur, sub: "interaksi tarik-geser" });
  else {
    out.push({ k: "tanah", nm: "tekanan tanah", h: "Tekanan ke tanah", u: s.qmax / qa, sub: s.qmax > 2000 ? "pondasi sebagian terangkat" : `${f0(s.qmax)} dari ${qa} kPa` });
    out.push({ k: "guling", nm: "faktor aman guling", h: "Tidak terguling", u: 1.5 / s.FS_guling, sub: `faktor aman ${f2(s.FS_guling)}× (min 1,5×)` });
    out.push({ k: "geser", nm: "faktor aman geser", h: "Tidak bergeser", u: 1.5 / s.FS_geser, sub: `faktor aman ${f2(s.FS_geser)}× (min 1,5×)` });
  }
  return out;
}
function limitSpeed(d) {
  // kecepatan pertama saat salah satu cek mencapai 100%, diinterpolasi antar titik hitung 2 m/s
  const sc = d.scen; let best = null;
  const names = {};
  for (let i = 0; i < sc.sweep.length - 1; i++) {
    const A = scenChecks(d, sc.sweep[i]), B = scenChecks(d, sc.sweep[i + 1]);
    A.forEach((a, j) => {
      const b = B[j]; names[a.k] = a.h;
      if (a.u <= 1 && b.u > 1) {
        const v = sc.sweep[i].V + (1 - a.u) / (b.u - a.u) * (sc.sweep[i + 1].V - sc.sweep[i].V);
        if (!best || v < best.v) best = { v, h: a.nm, k: a.k };
      }
    });
  }
  return best;
}

// ---------- markup ----------
export function analysisHTML(d, chips) {
  const P = d.params, W = d.wind, roof = d.typ === "rooftop", V0 = P.WIND.V;
  const nm = d.typ_name.split(" (")[0];
  const checks = designChecks(d);
  const worst = Math.max(...checks.filter(c => c.u != null).map(c => c.u));
  const ok = worst <= 1;
  const lim = d.scen ? limitSpeed(d) : null;
  const R0 = d.reactions.reduce((a, b) => b.M_max > a.M_max ? b : a, d.reactions[0]);
  const rail = d.sections.RAIL;
  const colG = d.sections.COL ? "COL" : "POST";

  const flow = [
    ["Angin", `${V0} m/s`, `≈ ${kmh(V0)} km/jam. Di ketinggian papan jadi tekanan ${f2(W.qh)} kPa ≈ ${kgm2(W.qh)} kg per m².`],
    ["Papan", `${f0(W.F_A)} kN`, `Papan ${d.B}×${d.S} m (${f0(W.As)} m²) didorong total ≈ ${ton(W.F_A)} ton, kira-kira berat ${f0(W.F_A / 9.81)} mobil kecil.`],
    ["Rangka papan", `${f0(rail.ratio * 100)}%`, `Rel ${rail.name} dan tiang rangka meneruskan dorongan ke ${roof ? "tiang" : "lengan dan kolom"}.`],
    roof
      ? ["Tiang & penopang", `${f0(Math.max(...d.reactions.map(r => r.V_max)))} kN`, `Penopang miring menahan papan agar tidak rebah; gaya geser terbesar per tumpuan.`]
      : ["Kolom", `${f0(R0.M_max)} kNm`, `Momen di kaki kolom ≈ ${ton(R0.M_max)} ton·m, seperti ${ton(W.F_A)} ton didorong di ketinggian ${f1(R0.M_max / Math.max(W.F_A, 1))} m.`],
    roof
      ? ["Angkur atap", `${f1(Math.max(...Object.values(d.anchors).map(a => a.Tu)))} kN`, `Tarik terbesar per angkur kimia. Ditanam ke pelat atap beton.`]
      : ["Pelat dasar", `${f0(d.baseplate.Tu)} kN`, `Tarik terbesar per angkur (${d.baseplate.n}×M${d.baseplate.d}); sisi lain menekan beton.`],
    roof
      ? ["Bangunan", `${f0(Math.max(...d.reactions.map(r => r.Rz_max)))} kN`, `Beban tekan terbesar per tumpuan ke struktur atap. Wajib dicek ahli.`]
      : ["Pondasi & tanah", `${f0(d.footing.qmax)} kPa`, `Telapak ${d.footing.Lx}×${d.footing.Ly}×${d.footing.Hf} m di kedalaman ${d.footing.Df} m menyebarkan beban ke tanah.`],
  ];

  const presets = d.scen ? [
    ["rencana", `Angin rencana`, `${V0} m/s · ${kmh(V0)} km/jam`, V0],
    ["kencang", `Angin sangat kencang`, `44 m/s · ${kmh(44)} km/jam`, 44],
    ["badai", `Badai ekstrem`, `50 m/s · ${kmh(50)} km/jam`, 50],
    ["gempa", `Gempa SNI 1726`, `SDS ${P.SDS} (asumsi)`, null],
  ] : [];

  return `
  <div class="an">
    <div class="an-head">
      <div><p class="eyebrow">Analisis struktur · ${d.typ_name} · papan ${d.B}×${d.S} m · lokasi ilustrasi</p>
        <h1>${nm} <span>${d.S}×${d.B}</span></h1>
        <div class="an-verdict"><span class="stamp ${ok ? "" : "ng"}">${ok ? "AMAN" : "PERLU DIPERBAIKI"}</span>
        <p>Angin rencana ${V0} m/s (≈ ${kmh(V0)} km/jam) mendorong papan dengan gaya ≈ ${ton(W.F_A)} ton. ${ok ? `Semua bagian masih di bawah batasnya; yang paling mepet terpakai ${f0(worst * 100)}%.` : "Ada bagian yang melewati batas."}${lim ? ` Batas desain pertama tercapai di ±${f1(lim.v)} m/s (${kmh(lim.v)} km/jam), pada ${lim.h}.` : ""}</p></div>
      </div>
      <div class="chips">${chips}</div>
    </div>

    <div class="sap" id="sap">
      <div class="sap-title"><b>adighanilham · Analisis 3D — ${d.id}.s2k</b><span><i></i><i></i><i></i></span></div>
      <div class="sap-bar" role="toolbar" aria-label="Langkah analisis">
        <button data-step="beban">1 · Beban</button><button data-step="rasio" class="on">2 · Rasio</button><button data-step="lendutan">3 · Lendutan</button>${d.scen ? `<button data-step="skenario">4 · Skenario ekstrem</button>` : ""}
        <span class="sp"></span><button data-act="home">Reset tampilan</button>
      </div>
      <div class="sap-panes">
        <div class="sap-pane"><span class="tab act">3-D View · model &amp; beban</span></div>
        <div class="sap-pane"><span class="tab">Rasio kapasitas baja</span>
          <div class="sap-leg"><div style="margin-bottom:4px">Terpakai</div>${BANDS.map(b => `<div class="r"><i style="background:${b.c}"></i>${b.t}<em>${b.r}</em></div>`).join("")}</div></div>
      </div>
      <div class="sap-status"><span id="sap-st">Satuan kN, m · ${d.members.length} batang · ${d.nodes.length} titik</span><span>Model sama dengan file .s2k di bawah · seret untuk memutar</span></div>
    </div>
    <div class="an-cap" id="an-cap"></div>

    ${d.scen ? `
    <section class="an-sec sc" id="skenario">
      <h2>Kalau terjadi kejadian ekstrem</h2>
      <p class="lead">Force majeure di sini artinya beban di luar rencana: angin jauh lebih kencang dari ${V0} m/s, atau gempa. Bebannya dinaikkan di model yang sama; ukuran baja, pondasi dan angkur tidak diubah. Lihat bagian mana yang lebih dulu lewat batas.</p>
      <div class="sc-presets">${presets.map(([k, a, b, v]) => `<button data-sc="${k}" ${v ? `data-v="${v}"` : ""}><b>${a}</b><span>${b}</span></button>`).join("")}</div>
      <div class="sc-slider">
        <label for="sc-v">Atur kecepatan angin</label>
        <div class="sc-track"><input id="sc-v" type="range" min="${d.scen.speeds[0]}" max="${d.scen.speeds[d.scen.speeds.length - 1]}" step="1" value="${V0}">
          ${lim ? `<i class="sc-lim" style="left:${(lim.v - d.scen.speeds[0]) / (d.scen.speeds[d.scen.speeds.length - 1] - d.scen.speeds[0]) * 100}%"><em>batas desain ±${f1(lim.v)} m/s</em></i>` : ""}
          <i class="sc-lim plan" style="left:${(V0 - d.scen.speeds[0]) / (d.scen.speeds[d.scen.speeds.length - 1] - d.scen.speeds[0]) * 100}%"><em>rencana</em></i></div>
        <output id="sc-out"></output>
      </div>
      <div class="sc-res">
        <div class="sc-verdict"><span class="stamp" id="sc-stamp"></span><p id="sc-say"></p></div>
        <div class="sc-grid" id="sc-grid"></div>
      </div>
      <p class="sc-note">Cara hitung: model rangka 3D yang sama dihitung ulang untuk tiap kecepatan 20–56 m/s (langkah 2 m/s, di antaranya diinterpolasi). Tekanan angin naik sebanding V². Gempa: gaya lateral = ${f2(d.scen.eq.coef)} × berat (${d.E_note.split(" /")[0]}), SDS ${P.SDS} adalah asumsi lokasi. Lewat 100% berarti melewati batas desain dengan faktor keamanannya, belum tentu langsung roboh, tetapi keamanannya tidak lagi dijamin.</p>
    </section>` : ""}

    <section class="an-sec">
      <h2>Jalan gayanya</h2>
      <p class="lead">Dari angin sampai ke tanah, gaya diteruskan bagian demi bagian. Tiap bagian harus kuat menerima lalu meneruskannya.</p>
      <div class="flow">${flow.map(([b, v, p], i) => `<div><span class="n">${String(i + 1).padStart(2, "0")}</span><b>${b}</b><span class="v">${v}</span><p>${p}</p></div>`).join("")}</div>
    </section>

    <section class="an-sec">
      <h2>Hasil cek, satu per satu</h2>
      <p class="lead">Persen = seberapa banyak kemampuan yang terpakai pada beban rencana. Di bawah 100% berarti aman.</p>
      <div class="checks">${checks.map(c => c.u == null
        ? `<div class="chk"><div class="top"><span>${c.h}</span><span class="st ng">BELUM DICEK</span></div><h4>${c.h}</h4><p>${c.say}</p><div class="num">${c.num}</div></div>`
        : `<div class="chk"><div class="top"><span>${c.h}</span><span class="st ${c.u > 1 ? "ng" : ""}">${c.u > 1 ? "LEWAT" : "AMAN"}</span></div>
          <div class="pct">${f0(c.u * 100)}%<small>terpakai</small></div>
          <div class="bar"><i style="width:${Math.min(100, c.u * 100)}%;background:${band(c.u).c}"></i><u></u></div>
          <p>${c.say}</p><div class="num">${c.num}</div></div>`).join("")}</div>
    </section>

    <section class="an-sec">
      <h2>Istilah singkat</h2>
      <div class="gloss">
        <div><b>kN (kilonewton)</b><p>Satuan gaya. 1 kN kira-kira berat 100 kg.</p></div>
        <div><b>% terpakai (rasio)</b><p>Gaya yang bekerja dibagi kekuatan bagian itu, sudah dengan faktor keamanan SNI.</p></div>
        <div><b>Kombinasi beban</b><p>Beban mati, beban orang di catwalk dan angin digabung dengan pengali aman, lalu diambil yang terberat.</p></div>
        <div><b>Faktor aman (FS)</b><p>Berapa kali lipat penahan dibanding pendorong. Pondasi minimal 1,5×.</p></div>
      </div>
    </section>
  </div>`;
}

// ---------- perilaku ----------
export async function wireAnalysis(root, d) {
  const sap = root.querySelector("#sap"), cap = root.querySelector("#an-cap"), st = root.querySelector("#sap-st");
  const caps = {
    beban: ["Langkah 1", "Beban yang bekerja", `Titik abu-abu = aliran angin. Bidang dan panah ungu = tekanan angin ${f2(d.wind.qh)} kPa (≈ ${kgm2(d.wind.qh)} kg/m²) pada papan. Panah hitam = berat sendiri. Kiri adalah model garis seperti di SAP2000; kotak hijau = tumpuan.`],
    rasio: ["Langkah 2", "Seberapa berat kerja tiap batang", "Warna di kanan = persen kekuatan yang terpakai pada kombinasi beban terberat. Biru santai, merah lewat batas. Arahkan kursor ke batang untuk keterangannya."],
    lendutan: ["Langkah 3", "Seberapa jauh bergoyang", `Saat angin layan, puncak bergeser ${f0(d.defl.dmax / 10)} cm, batasnya ${f0(d.defl.dlim / 10)} cm. Gerakan di layar dibesarkan supaya terlihat; garis abu-abu = posisi awal.`],
    skenario: ["Langkah 4", "Kejadian ekstrem", "Pilih skenario di panel bawah. Panah dan aliran angin ikut membesar, warna batang dan goyangan dihitung ulang dari model."],
  };
  const setCap = s => { const [k, h, p] = caps[s]; cap.innerHTML = `<span class="k">${k}</span><div><h3>${h}</h3><p>${p}</p></div>`; };
  const btns = [...sap.querySelectorAll("[data-step]")];
  const mark = s => btns.forEach(b => b.classList.toggle("on", b.dataset.step === s));

  let api = null;
  try { const { mountSap } = await import("./analisis.js"); api = mountSap(sap, d, s => { mark(s); setCap(s); }); }
  catch (e) { console.warn("3D tidak dimuat:", e); }
  if (!api) {
    const [pL, pR] = sap.querySelectorAll(".sap-pane");
    const fb = (svg, msg) => `<div class="fail">${svg}<span>${msg}</span></div>`;
    pL.insertAdjacentHTML("beforeend", fb(elevSVG(d, { dims: true }), "Peramban ini tidak mendukung WebGL, jadi model 3D diganti gambar tampak."));
    pR.insertAdjacentHTML("beforeend", fb(elevSVG(d, { ratio: true }), "Warna = rasio terpakai (tampak belakang)."));
    sap.querySelector(".sap-leg").style.display = "none";
  }
  setCap("rasio");
  btns.forEach(b => b.addEventListener("click", () => {
    const s = b.dataset.step;
    if (s === "skenario") { root.querySelector("#skenario")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); runScen(curKey, curV); }
    else if (api) api.setStep(s); else { mark(s); setCap(s); }
  }));
  sap.querySelector("[data-act=home]").addEventListener("click", () => api && api.home());

  // ---------- panel skenario ----------
  if (!d.scen) return api;
  const sc = d.scen, V0 = d.params.WIND.V, roof = d.typ === "rooftop";
  const slider = root.querySelector("#sc-v"), out = root.querySelector("#sc-out");
  const stamp = root.querySelector("#sc-stamp"), say = root.querySelector("#sc-say"), grid = root.querySelector("#sc-grid");
  const pbtn = [...root.querySelectorAll("[data-sc]")];
  let curKey = "rencana", curV = V0;

  function runScen(key, Vv) {
    curKey = key; curV = Vv;
    pbtn.forEach(b => b.classList.toggle("on", b.dataset.sc === key));
    const quake = key === "gempa";
    slider.disabled = quake; slider.closest(".sc-slider").classList.toggle("off", quake);
    const s = quake ? sc.eq : lerpSweep(sc, Vv);
    const C = scenChecks(d, s), worst = C.reduce((a, b) => b.u > a.u ? b : a);
    const k = quake ? 0 : (Vv / V0) ** 2;
    const fs = s.FS_guling;
    if (quake) out.innerHTML = `Gempa rencana · gaya lateral total ≈ ${f1(sc.eq.F)} kN (≈ ${ton(sc.eq.F)} ton)`;
    else out.innerHTML = `<b>${f0(Vv)} m/s</b> · ${kmh(Vv)} km/jam · tekanan ≈ ${kgm2(d.wind.qh * k)} kg/m² · gaya ke papan ≈ ${ton(d.wind.F_A * k)} ton (${f1(k)}× rencana)`;
    const tipping = !roof && fs < 1;
    const level = tipping ? "bahaya" : worst.u > 1 ? "lewat" : worst.u > .9 ? "mepet" : "aman";
    stamp.className = "stamp " + (level === "aman" ? "" : level === "mepet" ? "warn" : "ng");
    stamp.textContent = { aman: "AMAN", mepet: "MEPET", lewat: "LEWAT BATAS", bahaya: "BISA TERGULING" }[level];
    const over = C.filter(c => c.u > 1 && c.k !== "guling").map(c => c.nm);
    say.textContent = quake
      ? `Gempa mendorong struktur ${f1(sc.eq.F)} kN, jauh lebih kecil dari angin rencana (${f0(d.wind.F_A)} kN). Reklame ringan tetapi papannya lebar, jadi angin yang menentukan. Paling berat: ${worst.nm} ${pct(worst.u)}, sebagian besar dari berat sendiri.`
      : level === "aman" ? `Pada ${f0(Vv)} m/s semua bagian masih di bawah batas. Paling mepet: ${worst.nm} ${pct(worst.u)}.`
      : level === "mepet" ? `Pada ${f0(Vv)} m/s masih aman, tetapi ${worst.nm} sudah ${pct(worst.u)}. Sedikit lagi mencapai batas.`
      : tipping ? `Pada ${f0(Vv)} m/s dorongan angin lebih besar dari berat penahan pondasi (faktor aman ${f2(fs)}×). Pondasi bisa terangkat dan reklame terguling.${over.length ? ` Juga lewat batas: ${over.join(", ")}.` : ""}`
      : `Pada ${f0(Vv)} m/s ${C.filter(c => c.u > 1).map(c => c.nm).join(", ")} lewat batas desain. Belum tentu langsung roboh, tetapi keamanannya tidak lagi dijamin.`;
    grid.innerHTML = C.map(c => `<div class="sc-row ${cls(c.u)}"><span class="h">${c.h}<small>${c.sub}</small></span>
      <span class="b"><i style="width:${Math.min(100, c.u / 1.5 * 100)}%"></i><u style="left:${100 / 1.5}%"></u></span><span class="p">${pct(c.u)}</span></div>`).join("");
    if (api) api.setScenario({ label: quake ? "Gempa SNI 1726" : `Angin ${f0(Vv)} m/s`, k, r: s.r, dmax: s.dmax, quake, tilt: tipping ? Math.min(1, .35 + (1 - fs) * 2) : 0 });
    st.textContent = quake ? `Skenario gempa · koef ${f2(sc.eq.coef)} × berat · arah tegak lurus papan` : `Skenario angin ${f0(Vv)} m/s · beban angin ×${f2(k)} · profil & pondasi tetap`;
  }
  pbtn.forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.v ? +b.dataset.v : curV;
    if (b.dataset.v) slider.value = v;
    runScen(b.dataset.sc, v);
  }));
  slider.addEventListener("input", () => {
    const v = +slider.value;
    const key = v === V0 ? "rencana" : v === 44 ? "kencang" : v === 50 ? "badai" : "atur";
    runScen(key, v);
  });
  runScen("rencana", V0);
  if (api) api.setStep("rasio");
  return api;
}
