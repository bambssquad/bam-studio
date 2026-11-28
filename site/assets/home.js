import { initHero, initPills } from "./hero-book.js";
import { PROJECTS, PBG, el, $, $$, fmt, elevSVG, projSVG, openModal, reveal, getJSON } from "./common.js";

const TYPES = [["unipole", "Unipole", "tiang tunggal"], ["doublepole", "Double pole", "dua tiang"], ["rooftop", "Rooftop", "di atas atap"]];
const SIZES = ["4x8", "5x10", "6x12"];

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

function openDoc(p, di) {
  const d = p.docs[di];
  let pg = 1, zoom = false;
  const host = el("div", { class: "dv" });
  host.innerHTML = `<div class="stage"><img alt=""></div>
    <button class="nav prev" aria-label="Halaman sebelumnya">←</button><button class="nav next" aria-label="Halaman berikutnya">→</button>
    ${d.n > 1 ? `<div class="strip">${Array.from({ length: d.n }, (_, i) => `<button data-pg="${i + 1}" aria-label="Halaman ${i + 1}">${i + 1}</button>`).join("")}</div>` : ""}`;
  const mb = openModal({
    title: p.title, sub: `${p.k.toUpperCase()} · ${d.t.toUpperCase()}`, body: host,
    foot: `<span class="pgc"></span><span class="btns"><a class="btn" href="files/pbg/${d.f}.pdf" target="_blank" rel="noopener">Buka PDF ↗</a><a class="btn fill" href="files/pbg/${d.f}.pdf" download>Unduh PDF</a></span>`
  });
  const img = $(".stage img", host), stage = $(".stage", host), pgc = $(".mf .pgc");
  const show = () => {
    img.src = `files/pbg/view/${d.f}-${pg}.webp`; img.alt = `${d.t}, halaman ${pg} dari ${d.n}`;
    pgc.textContent = `Hlm ${pg} / ${d.n} · klik gambar untuk zoom`;
    $(".prev", host).disabled = pg === 1; $(".next", host).disabled = pg === d.n;
    $$(".strip button", host).forEach(b => b.classList.toggle("on", +b.dataset.pg === pg));
    stage.scrollTo(0, 0);
  };
  const go = n => { pg = Math.max(1, Math.min(d.n, n)); show(); };
  host.addEventListener("click", e => {
    if (e.target.closest(".prev")) go(pg - 1); else if (e.target.closest(".next")) go(pg + 1);
    else if (e.target.closest("[data-pg]")) go(+e.target.closest("[data-pg]").dataset.pg);
    else if (e.target === img) { zoom = !zoom; host.classList.toggle("zoom", zoom); }
  });
  const key = e => { if (e.key === "ArrowLeft") go(pg - 1); if (e.key === "ArrowRight") go(pg + 1); };
  addEventListener("keydown", key);
  mb.addEventListener("dispose", () => removeEventListener("keydown", key), { once: true });
  show();
}

async function main() {
  const idx = await getJSON("data/index.json");
  const all = Object.fromEntries(await Promise.all(idx.map(async r => [r.id, await getJSON(`data/${r.id}.json`)])));

  initPills();
  initHero({ all, openProject, quick3D });

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
  const pg = $(".pgrid");
  pg.innerHTML = PBG.map(p => {
    const d0 = p.docs && p.docs[0];
    const vis = d0 ? `<button class="vis doc" data-pbg="${p.id}" data-i="0" aria-label="Lihat ${d0.t}"><img src="files/pbg/thumb/${d0.f}-1.webp" alt="Halaman pertama ${d0.t}, ${p.title}" loading="lazy"><span>${d0.n} hlm · lihat</span></button>` : `<div class="vis">${projSVG(p.kind)}</div>`;
    const docs = (p.docs || []).map((d, i) => `<div class="drow"><span>${d.t}</span><span><button class="lk" data-pbg="${p.id}" data-i="${i}">Lihat</button><a class="lk" href="files/pbg/${d.f}.pdf" download>PDF ↓</a></span></div>`).join("");
    return `<article class="pcard reveal">${vis}<div class="bd"><div class="k">${p.k}</div><h4>${p.title}</h4><p>${p.desc}</p><ul><li><span>Lokasi</span><span>${p.loc}</span></li>${p.li.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join("")}</ul>${docs ? `<div class="docs">${docs}</div>` : ""}</div></article>`;
  }).join("");
  pg.onclick = e => { const b = e.target.closest("[data-pbg]"); if (b) openDoc(PBG.find(p => p.id === b.dataset.pbg), +b.dataset.i); };

  reveal();
}
main().catch(e => { console.error(e); document.body.insertAdjacentHTML("beforeend", `<p class="warn" style="margin:24px">Data gagal dimuat: ${e.message}</p>`); });
