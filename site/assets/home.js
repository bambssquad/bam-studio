import { PROJECTS, PBG, el, $, $$, fmt, elevSVG, projSVG, openModal, reveal, getJSON } from "./common.js";

const TYPES = [["unipole", "Unipole", "tiang tunggal"], ["doublepole", "Double pole", "dua tiang"], ["rooftop", "Rooftop", "di atas atap"]];
const SIZES = ["4x8", "5x10", "6x12"];
const SHORT = { unipole: "Unipole", doublepole: "Double pole", rooftop: "Rooftop" };

async function quick3D(d) {
  const host = el("div");
  const mb = openModal({
    title: `${d.typ_name} ${d.S}×${d.B} m`, sub: "3D CEPAT · MODEL ANALITIK",
    body: host,
    foot: `<span>Seret untuk memutar · gulir untuk zoom · arahkan ke batang untuk rasio</span><a class="btn" href="varian.html?id=${d.id}">Laporan lengkap →</a>`
  });
  const { mount } = await import("./viewer.js");
  const v = mount(host, d, { autoRotate: true });
  mb.addEventListener("dispose", () => v.dispose(), { once: true });
}

function openProject(p) {
  openModal({
    title: p.title, sub: `${p.n} · ${p.cat.toUpperCase()}`,
    body: `<iframe src="${p.url}" title="${p.title}" loading="lazy" allow="fullscreen; xr-spatial-tracking"></iframe>`,
    foot: `<span>Jurnal 3D asli proyek. Kalau tidak tampil, buka di tab baru.</span><a class="btn" href="${p.url}" target="_blank" rel="noopener">Buka di tab baru ↗</a>`
  });
}

async function main() {
  const idx = await getJSON("data/index.json");
  const all = Object.fromEntries(await Promise.all(idx.map(async r => [r.id, await getJSON(`data/${r.id}.json`)])));

  // ---------- hero collage ----------
  const col = $(".collage");
  const cards = [
    { k: "v", id: "unipole-6x12", x: 15, y: 50, w: 170, r: -4 },
    { k: "p", p: PROJECTS[2], x: 31, y: 24, w: 230, r: 2 },
    { k: "v", id: "doublepole-5x10", x: 48, y: 7, w: 200, r: -2 },
    { k: "p", p: PROJECTS[1], x: 65, y: 33, w: 210, r: 3 },
    { k: "v", id: "rooftop-6x12", x: 81, y: 58, w: 160, r: -3, blur: 1 },
    { k: "pb", p: PBG[0], x: 32, y: 60, w: 150, r: -6, blur: 1 },
    { k: "v", id: "unipole-4x8", x: 54, y: 52, w: 140, r: 5 },
    { k: "p", p: PROJECTS[0], x: 86, y: 30, w: 150, r: -2, blur: 1 },
  ];
  cards.forEach((c, i) => {
    const n = el("a", { class: "card-f" + (c.blur ? " blur" : ""), style: `left:${c.x}%;top:${c.y}%;--w:${c.w}px;transform:rotate(${c.r}deg)`, href: "#" });
    if (c.k === "v") { const d = all[c.id]; n.innerHTML = `<span class="tag">${String(i + 1).padStart(2, "0")}</span>${elevSVG(d, { ratio: true })}<div class="lab"><b>${SHORT[d.typ]} ${d.S}×${d.B}</b><span>${fmt(d.bill.baja_kg / 1000, 1)} t</span></div>`; n.onclick = e => { e.preventDefault(); quick3D(d); }; }
    else { const p = c.p; n.innerHTML = `<span class="tag">${String(i + 1).padStart(2, "0")}</span>${projSVG(p.kind)}<div class="lab"><b>${p.title}</b><span>${(p.loc || "").split(",")[0]}</span></div>`; n.onclick = e => { e.preventDefault(); (c.k === "p" && p.url) ? openProject(p) : document.getElementById(c.k === "pb" ? "pbg" : "porto").scrollIntoView({ behavior: "smooth" }); }; }
    col.append(n);
    // drift halus
    n.animate([{ translate: "0 0" }, { translate: `0 ${(i % 2 ? -1 : 1) * 10}px` }], { duration: 5000 + i * 700, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
  });
  const side = $(".hero .side");
  side.innerHTML = [["Portofolio", PROJECTS.length, "#porto"], ["Studi reklame", idx.length, "#reklame"], ["PBG / SLF", PBG.length, "#pbg"], ["Metode", 4, "#metode"]]
    .map(([a, b, h]) => `<li data-h="${h}"><span>${a}</span><b>${String(b).padStart(2, "0")}</b></li>`).join("");
  side.onclick = e => { const li = e.target.closest("li"); if (li) $(li.dataset.h).scrollIntoView({ behavior: "smooth" }); };

  // ---------- slider proyek ----------
  const tr = $(".slider .track");
  PROJECTS.forEach(p => {
    const s = el("article", { class: "slide" });
    s.innerHTML = `<div class="num">${p.n}</div><div class="vis">${projSVG(p.kind, true)}</div>
      <div class="meta"><div class="k">${p.n} / ${String(PROJECTS.length).padStart(2, "0")} · ${p.cat}</div><h3>${p.title}</h3><p>${p.desc}</p>
      <dl><dt>Lokasi</dt><dd>${p.loc}</dd>${p.meta.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("")}</dl>
      <div class="btns">${p.url ? `<button class="btn fill" data-p="${p.id}">Buka 3D ↗</button><a class="btn" href="${p.url}" target="_blank" rel="noopener">Tab baru</a>` : `<span class="btn ghost">Arsip internal</span>`}</div></div>`;
    tr.append(s);
  });
  tr.onclick = e => { const b = e.target.closest("[data-p]"); if (b) openProject(PROJECTS.find(p => p.id === b.dataset.p)); };
  const bar = $(".slider .bar i"), cnt = $(".slider .cnt");
  const upd = () => { const i = Math.round(tr.scrollLeft / tr.clientWidth); bar.style.width = ((i + 1) / PROJECTS.length * 100) + "%"; cnt.textContent = `${String(i + 1).padStart(2, "0")} / ${String(PROJECTS.length).padStart(2, "0")}`; };
  tr.addEventListener("scroll", () => requestAnimationFrame(upd)); upd();
  $$(".slider .ctl button").forEach(b => b.onclick = () => tr.scrollBy({ left: +b.dataset.d * tr.clientWidth, behavior: "smooth" }));
  tr.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { const i = Math.round(tr.scrollLeft / tr.clientWidth); if ((e.deltaY > 0 && i < PROJECTS.length - 1) || (e.deltaY < 0 && i > 0)) { e.preventDefault(); tr.scrollBy({ left: Math.sign(e.deltaY) * tr.clientWidth, behavior: "smooth" }); } } }, { passive: false });

  // ---------- grid buku: 9 varian ----------
  const g = $(".vgrid");
  TYPES.forEach(([t, nm, ket]) => {
    g.append(el("div", { class: "rowlab" }, `<span>${nm.toUpperCase()} · ${ket}</span><span>4×8 · 5×10 · 6×12 m</span>`));
    SIZES.forEach(sz => {
      const d = all[`${t}-${sz}`], r = idx.find(x => x.id === d.id);
      const main = d.sections.COL || d.sections.POST;
      const c = el("div", { class: "vcard reveal" });
      c.innerHTML = `<div class="hd"><b>${d.id.toUpperCase()}</b><span>+${fmt(d.zt, 1)} m</span></div>${elevSVG(d, { ratio: true, dims: true })}
        <h4>${nm} ${d.S}×${d.B}</h4>
        <div class="sp"><span>Profil utama</span><span><b>${main.name}</b></span><span>Baja total</span><span><b>${fmt(d.bill.baja_kg)} kg</b></span>
        <span>${t === "rooftop" ? "Tumpuan" : "Pondasi"}</span><span><b>${t === "rooftop" ? "angkur kimia" : r.footing.replace(/x/g, "×").replace(/\./g, ",")}</b></span><span>Rasio maks</span><span><b>${fmt(r.max_ratio, 2)}</b></span></div>
        <div class="ratio-bar"><i class="${r.max_ratio > .85 ? "hot" : ""}" style="width:${Math.min(100, r.max_ratio * 100)}%"></i></div>
        <div class="btns"><button class="btn" data-q="${d.id}">3D cepat</button><a class="btn fill" href="varian.html?id=${d.id}">Detail →</a></div>`;
      g.append(c);
    });
  });
  g.onclick = e => { const b = e.target.closest("[data-q]"); if (b) quick3D(all[b.dataset.q]); };

  // ---------- PBG ----------
  $(".pgrid").innerHTML = PBG.map(p => `<article class="pcard reveal"><div class="vis">${projSVG(p.kind)}</div><div class="bd"><div class="k">${p.k}</div><h4>${p.title}</h4><p>${p.desc}</p><ul><li><span>Lokasi</span><span>${p.loc}</span></li>${p.li.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join("")}</ul></div></article>`).join("");

  reveal();
}
main().catch(e => { console.error(e); document.body.insertAdjacentHTML("beforeend", `<p class="warn" style="margin:24px">Data gagal dimuat: ${e.message}</p>`); });
