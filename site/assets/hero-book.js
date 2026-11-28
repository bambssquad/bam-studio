// hero buku: buku tertutup di awan lembar gambar -> dibuka -> lembar tersebar bernomor
import { PROJECTS, PBG, el, $, $$, elevSVG, projSVG } from "./common.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => (t = clamp(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const pad = n => String(n).padStart(2, "0");

// posisi awan (px pada layar 1440x900): x, y, z, rotX, rotY
const CLOUD = [
  [-560, -170, -200, 0, 38], [-330, 230, 120, -8, 22], [-250, -300, -520, 6, -10], [330, -120, 140, 0, -34],
  [560, 210, -260, 0, -62], [230, -330, -420, 10, 12], [-620, 320, -640, 0, 72], [420, 330, 40, -10, -18],
];
const EXTRA = [[-120, -390, -900, 0, 0], [720, -300, -800, 0, -80], [-840, -60, -900, 0, 85], [80, 400, -720, -64, 0], [-40, -470, -320, 70, 0]];
// posisi tersebar (fraksi lebar/tinggi panggung dari tengah)
const SCAT = [[-.22, -.06], [-.07, .23], [-.05, -.27], [.06, -.02], [.15, .25], [.18, -.22], [-.25, .28], [.26, .05]];
const SCAT_M = [[-.24, -.29], [.24, -.25], [-.24, -.11], [.24, -.07], [-.24, .07], [.24, .11], [-.24, .25], [.24, .29]];

export function initHero({ all, openProject }) {
  const hb = $(".hb"), world = $(".hb-world"), stick = $(".hb-stick");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- isi: 6 proyek + studi reklame + PBG ----------
  const items = [
    ...PROJECTS.map(p => ({ t: p.title, c: p.cat.split("·")[0].trim(), loc: p.loc.split(",")[0], svg: projSVG(p.kind), go: () => p.url ? openProject(p) : jump("#porto") })),
    { t: "Studi reklame baja", c: "9 varian · SNI 1727/1729", loc: "Waru, Sidoarjo", svg: elevSVG(all["doublepole-5x10"], { ratio: true }), go: () => jump("#reklame") },
    { t: "PBG & SLF", c: "Perizinan", loc: `${PBG.length} paket`, svg: projSVG(PBG[2].kind), go: () => jump("#pbg") },
  ];
  const extras = ["unipole-6x12", "rooftop-6x12", "unipole-4x8", "doublepole-4x8"].map(id => ({ svg: elevSVG(all[id], { ratio: true }), t: id.toUpperCase() }))
    .concat([{ svg: projSVG(PBG[0].kind), t: "PBG · RUKO" }]);

  const sheets = items.map((it, i) => {
    const n = el("a", { class: "sh", href: "#", "data-i": i, "aria-label": it.t },
      `<span class="tag"><em>{${pad(i + 1)}}</em>${it.t}</span><div class="sh-h"><span>${it.c}</span><span>${pad(i + 1)}</span></div>${it.svg}<div class="sh-f"><b>${it.t}</b><span>${it.loc}</span></div>`);
    world.append(n); return n;
  });
  const xsheets = extras.map(it => { const n = el("div", { class: "sh x", "aria-hidden": "true" }, `<div class="sh-h"><span>${it.t}</span><span>—</span></div>${it.svg}<div class="sh-f"><b>lembar kerja</b><span>A1</span></div>`); world.append(n); return n; });

  // ---------- buku ----------
  const bk = el("div", { class: "bk" });
  const leafBacks = [
    `<div>${elevSVG(all["unipole-5x10"], { ratio: true, dims: true })}</div><span class="pg-n">012</span>`,
    `<div>${projSVG("mezz")}</div><span class="pg-n">034</span>`,
    `<p class="toc-h"><span>Pengantar</span><span>adighanilham</span></p><p class="pg-l">Dari sketsa pertama sampai <em>gambar siap bangun.</em></p><div style="margin-top:10%">${projSVG("ware")}</div><span class="pg-n">ii</span>`,
  ];
  bk.innerHTML = `
    <div class="bcov"></div>
    <div class="edge t"></div><div class="edge b"></div><div class="edge r"></div>
    <div class="spine"><span>adighan<i>ilham</i> · buku kerja</span></div>
    <div class="pages"><p class="toc-h"><span>Daftar isi</span><span>${pad(items.length)} bab</span></p>
      <ol class="toc">${items.map((it, i) => `<li><em>${pad(i + 1)}</em>${it.t}</li>`).join("")}</ol><span class="pg-n">iii</span></div>
    ${leafBacks.map(b => `<div class="leaf"><div class="fc front"></div><div class="fc back">${b}</div></div>`).join("")}
    <div class="cover"><div class="fc front">
        <div class="cv-top"><span>Buku kerja</span><span>2024 — 2026</span></div>
        <div><div class="cv-mid">adighan<span>ilham</span></div><div class="cv-sub">gambar teknik, struktur baja, PBG/SLF</div></div>
        <div class="cv-bot"><span>Proyek <b>${pad(PROJECTS.length)}</b></span><span>Reklame <b>09</b></span><span>PBG/SLF <b>${pad(PBG.length)}</b></span><span>Sidoarjo, ID</span></div>
      </div><div class="fc back"><span>Untuk siapa pun yang membangun dari gambar.</span></div></div>`;
  world.append(bk);
  const leaves = $$(".leaf", bk), cover = $(".cover", bk), spine = $(".spine", bk), edges = $$(".edge", bk), bcov = $(".bcov", bk), pages = $(".pages", bk);

  // ---------- indeks kanan ----------
  const idx = $(".hb-idx");
  idx.innerHTML = items.map((it, i) => `<li data-i="${i}"><b>${it.t}</b><span>{${pad(i + 1)}} ${it.c}</span></li>`).join("");
  const lis = $$("li", idx);

  // ---------- ukuran ----------
  let W, H, k, kc, sw, bw, bh, bt, mobile;
  function size() {
    W = stick.clientWidth; H = stick.clientHeight; mobile = W < 760;
    k = Math.min(W / 1440, H / 900); kc = mobile ? W / 760 : k;
    sw = mobile ? W * .28 : Math.max(150, W * .12);
    bh = mobile ? Math.min(H * .42, W * .6 / .72) : Math.min(H * .46, W * .5 / .72 / 2 * 1.6); bw = bh * .72; bt = bw * .11;
    world.style.setProperty("--sw", sw + "px");
    bk.style.cssText += `;--bw:${bw}px;--bh:${bh}px;--bt:${bt}px`;
  }

  // ---------- keadaan ----------
  let target = 0, cur = reduce ? 1 : 0, mx = 0, my = 0, smx = 0, smy = 0, active = 0, lastUser = 0;
  const prog = () => { const r = hb.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };

  function frame() {
    target = reduce ? 1 : prog();
    cur += (target - cur) * .12; if (Math.abs(target - cur) < 1e-4) cur = target;
    smx += (mx - smx) * .06; smy += (my - smy) * .06;
    const p = cur;
    const Ew = ease((p - .05) / .6), Eo = ease((p - .04) / .36), R = ease((p - .40) / .2);

    world.style.transform = `translateZ(${lerp(-120, 0, Ew) * k}px) rotateX(${lerp(14, 0, Ew) - smy * 5 * (1 - Ew * .85)}deg) rotateY(${lerp(-16, 0, Ew) + smx * 8 * (1 - Ew * .85)}deg)`;

    // buku
    const bx = lerp(0, bw / 2, Eo), bz = lerp(0, -1500 * k, R), brx = lerp(10, 0, Eo), bry = lerp(26, 0, Eo), brz = lerp(-5, 0, Eo);
    const bs = lerp(1, mobile ? .7 : .85, Eo);
    bk.style.transform = `translate3d(${bx - bw / 2}px,${-bh / 2 - (1 - Eo) * H * .07 + R * 80 * k}px,${bz}px) rotateX(${brx}deg) rotateY(${bry}deg) rotateZ(${brz}deg) scale(${bs})`;
    bk.style.setProperty("--bo", (1 - R).toFixed(3));
    bk.style.visibility = R >= .999 ? "hidden" : "";
    cover.style.transform = `translateZ(${bt / 2 + 1}px) rotateY(${-Eo * 179.4}deg)`;
    leaves.forEach((lf, i) => {
      const t = ease(Eo * 1.35 - .12 - i * .1);
      const z = lerp(bt / 2 - 1.5 - i * 1.5, bt / 2 + 2 + i * 1.5, t);
      lf.style.transform = `translateZ(${z}px) rotateY(${-t * (178.6 - i * .4)}deg)`;
    });
    pages.style.transform = `translateZ(${bt / 2 - 6}px)`;
    bcov.style.transform = `translateZ(${-bt / 2}px)`;
    spine.style.transform = `translateZ(${-bt / 2}px) rotateY(-90deg)`;
    edges[0].style.transform = `translateZ(${-bt / 2}px) rotateX(90deg)`;
    edges[1].style.transform = `translateZ(${bt / 2}px) rotateX(-90deg)`;
    edges[2].style.transform = `translateZ(${bt / 2}px) rotateY(90deg)`;

    // lembar
    const S = mobile ? SCAT_M : SCAT;
    sheets.forEach((n, i) => {
      const c = CLOUD[i], s = S[i], e = ease((p - .3 - i * .025) / .38);
      const x = lerp(c[0] * kc, s[0] * W, e), y = lerp(c[1] * kc, s[1] * H, e), z = lerp(c[2] * kc, 0, e);
      const rx = lerp(c[3], 0, e), ry = lerp(c[4], 0, e), sc = lerp(.95, 1, e);
      const bob = (1 - e) * Math.sin(performance.now() / 1600 + i * 1.7) * 10 * k;
      n.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y + bob}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`;
    });
    xsheets.forEach((n, i) => {
      const c = EXTRA[i], e = ease((p - .22) / .35);
      const bob = Math.sin(performance.now() / 1900 + i) * 8 * k;
      n.style.transform = `translate(-50%,-50%) translate3d(${c[0] * k * (1 + e * .6)}px,${c[1] * k * (1 + e * .6) + bob}px,${lerp(c[2] * k, c[2] * k - 900 * k, e)}px) rotateX(${c[3]}deg) rotateY(${c[4]}deg)`;
      n.style.opacity = (1 - e).toFixed(3);
      n.style.visibility = e >= .999 ? "hidden" : "";
    });

    hb.classList.toggle("moving", p > .02);
    const open = p > .86;
    if (open !== hb.classList.contains("open")) hb.classList.toggle("open", open);
    requestAnimationFrame(frame);
  }

  // ---------- fokus (satu tajam, lainnya kabur) ----------
  function setActive(i, user) {
    active = i; if (user) lastUser = performance.now();
    sheets.forEach((n, j) => n.classList.toggle("on", j === i));
    lis.forEach((l, j) => l.classList.toggle("on", j === i));
    hb.classList.add("focus");
  }
  setActive(0);
  setInterval(() => { if (hb.classList.contains("open") && performance.now() - lastUser > 6000) setActive((active + 1) % items.length); }, 3200);

  const openBook = () => scrollTo({ top: hb.offsetTop + (hb.offsetHeight - innerHeight) * .95, behavior: reduce ? "auto" : "smooth" });
  function jump(sel) { document.querySelector(sel)?.scrollIntoView({ behavior: "smooth" }); }

  sheets.forEach((n, i) => {
    n.addEventListener("pointerenter", () => setActive(i, true));
    n.addEventListener("focus", () => setActive(i, true));
    n.addEventListener("click", e => { e.preventDefault(); hb.classList.contains("open") ? items[i].go() : openBook(); });
  });
  lis.forEach((l, i) => { l.addEventListener("pointerenter", () => setActive(i, true)); l.addEventListener("click", () => items[i].go()); });
  $(".open-btn").addEventListener("click", openBook);
  addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  addEventListener("resize", size);
  size(); requestAnimationFrame(frame);
}

// ---------- header pil: jam + tentang ----------
export function initPills() {
  const f = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
  const tick = () => $$(".clocks em.t").forEach(e => e.textContent = f.format(new Date()).replace(".", ":") + " WIB");
  tick(); setInterval(tick, 20000);
  const b = $(".pill.dot"), a = $(".pills .about");
  b.addEventListener("click", () => { const on = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", on); a.hidden = !on; });
  addEventListener("keydown", e => { if (e.key === "Escape" && !a.hidden) { a.hidden = true; b.setAttribute("aria-expanded", "false"); } });
}
