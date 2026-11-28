import { el, $, fmt, reveal, getJSON, elevSVG } from "./common.js";

const f1 = x => fmt(x, 1), f2 = x => fmt(x, 2), f3 = x => fmt(x, 3);
const okc = (v, lim, le = true) => (le ? v <= lim : v >= lim) ? `<span class="ok">OK</span>` : `<span class="ng">TIDAK</span>`;
const tbl = (head, rows, right = []) => `<table class="t"><thead><tr>${head.map((h, i) => `<th class="${right.includes(i) ? "r" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${right.includes(i) ? "r" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const sec = (id, n, h, txt, body) => `<section id="r-${id}" class="reveal"><div><h3><small>${n}</small>${h}</h3><div class="txt">${txt}</div></div><div>${body}</div></section>`;

async function main() {
  const idx = await getJSON("data/index.json");
  const id = new URLSearchParams(location.search).get("id") || "unipole-5x10";
  if (!idx.some(r => r.id === id)) throw new Error(`varian "${id}" tidak ada`);
  const d = await getJSON(`data/${id}.json`);
  const P = d.params, W = d.wind, roof = d.typ === "rooftop";
  const rmax = Math.max(...d.members.map(m => m.ratio));
  document.title = `${d.typ_name} ${d.S}×${d.B} m — adighanilham`;

  const chips = idx.map(r => `<a href="varian.html?id=${r.id}" class="${r.id === id ? "on" : ""}">${r.typ === "doublepole" ? "DBL" : r.typ.slice(0, 4).toUpperCase()} ${r.size.replace("x", "×")}</a>`).join("");
  const nm = d.typ_name.split(" (")[0];

  // ---------- tabel ----------
  const secRows = Object.entries(d.sections).map(([g, s]) => {
    const ms = d.members.filter(m => m.g === g), gov = ms.reduce((a, b) => b.ratio > a.ratio ? b : a, ms[0]);
    return [g, s.group, s.name, f1(s.w), f2(s.ratio), gov ? gov.combo : "-", okc(s.ratio, 1)];
  });
  const R = d.reactions.map(r => [r.node, f1(r.Rz_max), f1(r.Rz_min), f1(r.V_max), f1(r.M_max)]);
  const B = d.bill;
  const billRows = B.profil.map(r => [r.g, r.profil, f2(r.L), f1(r.w), fmt(r.kg)]).concat(B.lain.map(r => ["", r.item, r.qty, "", r.kg == null ? "-" : fmt(r.kg)]));
  const cases = [["A", "resultan di tengah papan", f1(W.F_A)], ["B", `eksentris 0,2B = ${f2(0.2 * d.B)} m (torsi)`, f1(W.F_A)], ["C", `Cf ${W.CfC.join(" / ")} pada pias tepi`, f1(W.F_C)]];

  let support;
  if (roof) {
    const a = d.anchors;
    support = sec("tumpuan", "07", "Angkur atap", `<p>Tiang dan strut berdiri di atas pelat atap beton dengan pelat dasar dan angkur kimia. ${d.roof_note}</p>`,
      tbl(["Lokasi", "Angkur", "Tu (kN)", "Vu (kN)", "Rasio", ""], Object.entries(a).map(([k, v]) => [k, `${v.n}×M${v.d} ${v.grade}`, f1(v.Tu), f1(v.Vu), f3(v.ratio), okc(v.ratio, 1)]), [2, 3, 4])
      + `<p class="warn" style="margin-top:12px">Kapasitas pelat, balok dan kolom bangunan eksisting di bawahnya belum dicek di studi ini dan wajib diperiksa ahli struktur sebelum dipakai.</p>`);
  } else {
    const bp = d.baseplate, ft = d.footing;
    support = sec("baseplate", "07", "Base plate", `<p>Pelat dasar bundar dengan ${bp.n} angkur M${bp.d} ${bp.grade} pada lingkar Ø${bp.Db} mm, ${bp.stiff} pengaku t${bp.stiff_t}. Kombinasi menentukan ${bp.gov}.</p>`,
      `<div class="kv"><span>Pelat</span><span>Ø${bp.Dp} × t${bp.tp} mm</span><span>t perlu</span><span>${f1(bp.treq)} mm</span><span>Tarik angkur Tu</span><span>${f1(bp.Tu)} kN / angkur</span><span>Geser Vu</span><span>${f1(bp.Vu)} kN / angkur</span><span>Tanam hef</span><span>${bp.hef} mm</span><span>Tulangan pedestal</span><span>${fmt(bp.As_ped)} mm²</span><span>Rasio</span><span>${f3(bp.ratio)} ${okc(bp.ratio, 1)}</span></div>`)
      + sec("pondasi", "08", "Pondasi", `<p>Telapak beton f'c ${P.FC} MPa, tulangan fy ${P.FYR} MPa, kedalaman ${ft.Df} m. Daya dukung izin tanah ${P.SOIL.qa} kPa adalah asumsi, perlu data sondir/boring.</p>`,
        `<div class="kv"><span>Ukuran</span><span>${ft.Lx} × ${ft.Ly} × ${ft.Hf} m</span><span>Pedestal</span><span>${ft.bp} × ${ft.bp} m</span>
        <span>q maks (layan)</span><span>${f1(ft.qmax)} kPa ≤ ${P.SOIL.qa} ${okc(ft.qmax, P.SOIL.qa)}</span>
        <span>FS guling</span><span>${f2(ft.FS_guling)} ≥ 1,5 ${okc(ft.FS_guling, 1.5, false)}</span>
        <span>FS geser</span><span>${f2(ft.FS_geser)} ≥ 1,5 ${okc(ft.FS_geser, 1.5, false)}</span>
        <span>Geser 1 arah Vu / φVc</span><span>${f1(ft.Vu)} / ${f1(ft.phiVc)} kN ${okc(ft.Vu, ft.phiVc)}</span>
        <span>Geser pons Vu / φVc</span><span>${f1(ft.Vpons)} / ${fmt(ft.phiVpons)} kN ${okc(ft.Vpons, ft.phiVpons)}</span>
        <span>Mu</span><span>${f1(ft.Mu)} kNm/m</span><span>Tulangan</span><span>${ft.bar} (As ${fmt(ft.As)} mm²/m)</span>
        <span>Volume beton</span><span>${f2(ft.vol)} m³</span><span>Besi</span><span>${fmt(ft.rebar_kg)} kg</span></div>`);
  }

  const c = d.conn;
  const dlinks = [["Gambar struktur", "STR-01 · PDF A2", d.files.str_pdf], ["Gambar struktur", "STR-01 · DXF", d.files.str_dxf], ["Lembar ala PBG", "PBG-01 · PDF A2", d.files.pbg_pdf], ["Lembar ala PBG", "PBG-01 · DXF", d.files.pbg_dxf],
    ["SAP2000", ".s2k teks", d.files.s2k], ["Tekla / BIM", "IFC4", d.files.ifc], ["Material", "CSV", d.files.csv]];

  const { analysisHTML, wireAnalysis } = await import("./analisis-ui.js");
  $("#app").innerHTML = `${analysisHTML(d, chips)}
  <details class="tech" id="teknis"><summary>Detail teknis untuk insinyur<span>LAPORAN LENGKAP · BUKA</span></summary>
  <div class="rep">
    <nav>${[["data", "Data & asumsi"], ["angin", "Angin"], ["kombinasi", "Kombinasi"], ["profil", "Profil & rasio"], ["defleksi", "Defleksi"], ["reaksi", "Reaksi"], [roof ? "tumpuan" : "baseplate", roof ? "Angkur atap" : "Base plate"], ...(roof ? [] : [["pondasi", "Pondasi"]]), ["sambungan", "Sambungan"], ["material", "Material"], ["unduh", "Unduhan"]].map(([a, b], i) => `<a href="#r-${a}">${String(i + 1).padStart(2, "0")} ${b}</a>`).join("")}</nav>
    <div>
    ${sec("data", "01", "Data &amp; asumsi", `<p>${d.site.ket}</p><p>${d.site.nama}. Lahan ${d.site.lahan.join(" × ")} m, GSB ${d.site.gsb} m dari rumija ${d.site.rumija} m.</p>`,
      `${elevSVG(d, { ratio: true, dims: true }).replace("<svg", '<svg style="width:100%;max-height:300px;background:#fff;border:1px solid var(--line)"')}
      <div class="kv" style="margin-top:12px"><span>Baja</span><span>BJ41, fy ${P.FY} MPa</span><span>Beban mati papan</span><span>${P.LOADS.board_D} kPa</span>
      <span>Catwalk D / L</span><span>${P.LOADS.walk_D} / ${P.LOADS.walk_L} kPa</span><span>Angin V</span><span>${P.WIND.V} m/s, eksposur ${P.WIND.exposure}, risiko ${P.WIND.risk}</span>
      <span>Kd · G · Kzt</span><span>${P.WIND.Kd} · ${P.WIND.G} · ${P.WIND.Kzt}</span><span>Gempa</span><span>SDS ${P.SDS}; ${d.E_note}</span>
      <span>E / W</span><span>${f3(d.E_ratio)} (angin menentukan)</span><span>Berat sendiri</span><span>${f1(d.W_total)} kN</span></div>`)}
    ${sec("angin", "02", "Beban angin", `<p>Papan reklame padat menurut SNI 1727:2020 bab 29 (setara ASCE 7-16). Tekanan pada tinggi pusat papan h = ${f1(W.h)} m.</p>`,
      `<div class="eq">qh = 0,613 · Kz · Kzt · Kd · V²
   = 0,613 · ${f3(W.Kz)} · ${P.WIND.Kzt} · ${P.WIND.Kd} · ${P.WIND.V}² = ${f3(W.qh)} kPa
B/s = ${f2(W.Bs)},  s/h = ${f3(W.sh)}  →  Cf = ${f3(W.Cf)}
F = qh · G · Cf · As = ${f3(W.qh)} · ${P.WIND.G} · ${f3(W.Cf)} · ${f1(W.As)} = ${f1(W.F_A)} kN</div>`
      + tbl(["Kasus", "Keterangan", "F (kN)"], cases, [2]))}
    ${sec("kombinasi", "03", "Kombinasi beban", `<p>LRFD untuk kekuatan batang, ASD untuk pondasi dan tanah, kombinasi layan untuk defleksi.</p>`,
      tbl(["Kode", "Kombinasi"], d.combos.map(c => [c.id, c.desc])))}
    ${sec("profil", "04", "Profil &amp; rasio", `<p>Rangka 3D diselesaikan dengan metode kekakuan, tiap batang dicek SNI 1729:2020 (AISC 360-16 LRFD), lalu profil dinaikkan sampai rasio ≤ 0,95.</p>`,
      tbl(["Grup", "Fungsi", "Profil", "kg/m", "Rasio", "Komb.", ""], secRows, [3, 4]))}
    ${sec("defleksi", "05", "Defleksi", `<p>Simpangan puncak pada kombinasi layan D + 0,6W, dibatasi H/100.</p>`,
      `<div class="big-n">${f1(d.defl.dmax)} mm<small>BATAS ${f1(d.defl.dlim)} MM · ${okc(d.defl.dmax, d.defl.dlim)}</small></div>`)}
    ${sec("reaksi", "06", "Reaksi tumpuan", `<p>Selubung reaksi kombinasi LRFD per titik tumpuan (kN, kNm). Rz negatif berarti tarik.</p>`,
      tbl(["Titik", "Rz maks", "Rz min", "V maks", "M maks"], R, [1, 2, 3, 4]))}
    ${support}
    ${sec("sambungan", String(roof ? 8 : 9).padStart(2, "0"), "Sambungan", `<p>Sambungan pelat ujung lengan/rel ke kolom memakai baut A325, dihitung dari momen terbesar grup ${c.g}.</p>`,
      `<div class="kv"><span>Batang</span><span>${c.g} · ${c.prof}</span><span>Mu</span><span>${f1(c.Mu)} kNm</span><span>Baut</span><span>${c.n} × M${c.d} A325</span>
      <span>Tarik baut T / φT</span><span>${f1(c.T)} / ${f1(c.phiT)} kN</span><span>Pelat ujung</span><span>t${c.tp} mm</span><span>Rasio</span><span>${f2(c.ratio)} ${okc(c.ratio, 1)}</span></div>`)}
    ${sec("material", String(roof ? 9 : 10).padStart(2, "0"), "Material", `<p>Panel ${f1(B.panel_m2)} m², luas cat ${f1(B.cat_m2)} m².${B.beton && B.beton.beton ? ` Beton ${f2(B.beton.beton)} m³, lantai kerja ${f2(B.beton.lantai_kerja)} m³, galian ${f1(B.beton.galian)} m³, besi ${fmt(B.beton.tulangan_kg)} kg.` : ""}</p>`,
      tbl(["Grup", "Item", "Panjang / qty", "kg/m", "kg"], billRows, [2, 3, 4]) + `<p class="mono" style="margin-top:8px">TOTAL BAJA ${fmt(B.baja_kg)} kg (profil ${fmt(B.profil_kg)} kg)</p>`)}
    </div>
  </div>
  </details>
  <div class="rep rep-dl"><div>
    <section id="r-unduh" class="reveal"><div><h3><small>${String(roof ? 10 : 11).padStart(2, "0")}</small>Unduhan</h3><div class="txt"><p>File .s2k bisa diimpor ke SAP2000 (File › Import › Text). IFC4 bisa dibuka di Tekla, Revit atau penampil IFC. Keduanya belum dijalankan di program aslinya.</p></div></div>
      <div class="dl">${dlinks.map(([a, b, u]) => `<a href="${u}" download><span><b>${a}</b><br>${b}</span><span>↓</span></a>`).join("")}</div>
      <div class="sheets"><iframe src="${d.files.str_pdf}#view=FitH" title="STR-01" loading="lazy"></iframe><iframe src="${d.files.pbg_pdf}#view=FitH" title="PBG-01" loading="lazy"></iframe></div>
    </section>
  </div></div>`;

  reveal();
  await wireAnalysis($("#app"), d);
}
main().catch(e => { console.error(e); $("#app").innerHTML = `<p class="warn" style="margin:120px 24px">${e.message}. <a href="./#reklame">Kembali ke daftar varian</a></p>`; });
