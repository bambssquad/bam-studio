// Flat 2D motion-graphics engine (style_guide.md). Ortho camera in pixels, origin centre, y up.
// Everything is a pure function of t: cuts are snapped to the beat grid, shots are prebuilt and toggled.
import * as THREE from 'three'
import { clamp, lerp, smooth, outExpo, inCubic, hash, rng, boil, clock } from './util.js'
import { rectShape, circleShape, heartShape, starShape, ridge, skyline, noteShape } from './paper.js'

export const C = { ink: '#0f0f12', red: '#ff2a55', yellow: '#ffc21a', violet: '#7b3cff', blue: '#2f4bff', lime: '#d8f03c', white: '#f4f1ea', orange: '#ff8a1e', dark: '#1d1d24' }
const CH = {
  a: { id: 'a', skin: C.yellow, shade: '#e09a00', hair: '#121216', shirt: C.blue, acc: C.lime, style: 'curl' },
  b: { id: 'b', skin: C.violet, shade: '#5a22d6', hair: C.white, shirt: C.red, acc: C.red, style: 'bob' },
}

export const SCENES = [
  { id: 'intro', t0: 0, t1: 7.8, label: 'intro', accent: C.red, cols: [C.red, C.yellow, C.violet, C.lime, C.blue], shots: ['title'], every: 64, motifs: ['sun'] },
  { id: 'dusk', t0: 7.8, t1: 27.0, label: 'verse · senja', accent: C.orange, cols: [C.orange, C.yellow, C.red, C.violet], shots: ['close', 'motif', 'cards', 'rays', 'walk'], every: 8, motifs: ['sun', 'city', 'wind', 'sky'] },
  { id: 'road', t0: 27.0, t1: 47.0, label: 'verse · jalan', accent: C.yellow, cols: [C.yellow, C.violet, C.blue, C.white], shots: ['walk', 'close', 'cards', 'motif', 'rays'], every: 8, motifs: ['street', 'stars', 'city', 'stars'] },
  { id: 'hill', t0: 47.0, t1: 66.5, label: 'reff', accent: C.red, cols: [C.red, C.white, C.violet, C.yellow], shots: ['duo', 'close', 'rays', 'cards', 'duo', 'motif'], every: 4, motifs: ['heart', 'arcs', 'moon', 'heart'] },
  { id: 'ocean', t0: 66.5, t1: 86.8, label: 'verse · ombak', accent: C.lime, cols: [C.blue, C.lime, C.white, C.violet], shots: ['motif', 'close', 'cards', 'walk', 'rays'], every: 8, motifs: ['wave', 'boat', 'notes', 'moon'] },
  { id: 'symph', t0: 86.8, t1: 108.6, label: 'verse · simfoni', accent: C.violet, cols: [C.violet, C.red, C.yellow, C.lime], shots: ['rays', 'cards', 'close', 'motif', 'duo'], every: 8, motifs: ['rings', 'notes', 'clock', 'lamp'] },
  { id: 'heart', t0: 108.6, t1: 137.0, label: 'reff', accent: C.lime, cols: [C.red, C.yellow, C.lime, C.violet, C.blue], shots: ['rays', 'duo', 'close', 'motif', 'cards'], every: 4, motifs: ['heart', 'arcs', 'sunburst', 'heart'] },
  { id: 'rain', t0: 137.0, t1: 163.4, label: 'bridge · hujan', accent: C.blue, cols: [C.blue, C.white, C.violet], shots: ['motif', 'close', 'cards', 'duo'], every: 8, motifs: ['rain', 'umbrella', 'lamp', 'city'] },
  { id: 'dawn', t0: 163.4, t1: 191.0, label: 'reff · fajar', accent: C.yellow, cols: [C.yellow, C.orange, C.lime, C.red], shots: ['rays', 'duo', 'motif', 'close', 'cards'], every: 4, motifs: ['sun', 'flowers', 'heart', 'birds'] },
  { id: 'outro', t0: 191.0, t1: 219.5, label: 'outro', accent: C.red, cols: [C.red, C.violet, C.yellow], shots: ['close', 'motif', 'rays'], every: 16, motifs: ['sun', 'city', 'heart'] },
]
// lyric keyword -> motif, so the illustration follows the words being sung
const KEYWORD = [['senja', 'sun'], ['kota', 'city'], ['angin', 'wind'], ['langit', 'sky'], ['jalan', 'street'], ['mimpi', 'stars'], ['cinta', 'heart'], ['hening', 'moon'],
  ['berbicara', 'arcs'], ['ombak', 'wave'], ['bernyanyi', 'notes'], ['malam', 'moon'], ['hati', 'heart'], ['tawa', 'rings'], ['simfoni', 'rings'], ['waktu', 'clock'], ['lampu', 'lamp'], ['na', 'notes']]

// ---------- primitives ----------
let order = 0
const mat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false })
function M(shape, color, opacity) { const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 28), mat(color, opacity)); m.renderOrder = order++; return m }
function add(g, ...ms) { for (const m of ms) { m.traverse(o => { if (o.isMesh) o.renderOrder = order++ }); g.add(m) } return ms[0] }
const ell = (x, y, rx, ry, rot = 0) => { const s = new THREE.Shape(); s.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, rot); return s }
const ring = (r, w, a0 = 0, a1 = Math.PI * 2) => { const s = new THREE.Shape(); s.absarc(0, 0, r, a0, a1, false); s.absarc(0, 0, r - w, a1, a0, true); return s }
const poly = pts => { const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); return s }
const R = (x, y, w, h, c, o) => M(rectShape(x, y, w, h), c, o)
function crescent(rx, ry, k = 0.5, a = 1.25) { // right-side shade inside an ellipse
  const pts = []; for (let i = 0; i <= 24; i++) { const t = -a + (2 * a * i) / 24; pts.push([Math.cos(t) * rx, Math.sin(t) * ry]) }
  for (let i = 24; i >= 0; i--) { const t = -a + (2 * a * i) / 24; pts.push([Math.cos(t) * rx * k + rx * 0.18, Math.sin(t) * ry * 0.94]) }
  return poly(pts)
}
function tri(color) { const m = M(poly([[0, 0], [1, -0.07], [1, 0.07]]), color); return m } // unit ray along +x, scale = length
const sparkle = (r, c) => M(starShape(r, 4, 0.18), c)

let fontReady = false
export const setFontReady = () => { fontReady = true }
function label(lines, { size = 18, color = C.white, w = 300, weight = 500, lh = 1.3, font = '"IBM Plex Mono"' } = {}) {
  const h = Math.ceil(lines.length * size * lh + size * 0.4), c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d'); g.fillStyle = color; g.font = `${weight} ${size}px ${font}, monospace`; g.textBaseline = 'top'
  lines.forEach((l, i) => g.fillText(l, 0, i * size * lh))
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
  m.geometry.translate(w / 2, -h / 2, 0); m.renderOrder = order++; return m
}

// ---------- characters (original) ----------
function faceFront(ch) {
  const g = new THREE.Group(), P = { eyes: [] }
  const hairBack = new THREE.Group()
  if (ch.style === 'bob') { const b = new THREE.Shape(); b.moveTo(-215, -230); b.lineTo(-215, 40); b.absarc(0, 40, 215, Math.PI, 0, true); b.lineTo(215, -230); b.closePath(); add(hairBack, M(b, ch.hair)) }
  else for (const [x, y, r] of [[-150, 110, 95], [0, 180, 120], [150, 110, 95], [-185, 10, 75], [185, 10, 75]]) add(hairBack, M(circleShape(x, y, r), ch.hair))
  add(g, hairBack)
  add(g, R(-55, -270, 110, 140, ch.shade))
  const sh = new THREE.Shape(); sh.moveTo(-300, -470); sh.lineTo(300, -470); sh.quadraticCurveTo(280, -250, 60, -240); sh.lineTo(-60, -240); sh.quadraticCurveTo(-280, -250, -300, -470)
  add(g, M(sh, ch.shirt))
  add(g, M(ell(0, 0, 150, 185), ch.skin), M(crescent(150, 185), ch.shade))
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 62, 18, 0)
    add(e, M(ell(0, 0, 38, 22), C.white), M(circleShape(s * 3, -2, 14), C.ink), M(circleShape(s * 3 + 5, 3, 4), C.white), R(-42, 16, 84, 7, C.ink))
    add(g, e); P.eyes.push(e)
    const b = R(-34, 0, 68, 10, C.ink); b.position.set(s * 62, 68, 0); b.rotation.z = -s * 0.12; add(g, b)
  }
  add(g, M(poly([[2, 18], [-16, -42], [12, -46]]), ch.shade))
  const mouth = new THREE.Group(); mouth.position.set(0, -100, 0); add(mouth, M(ell(0, 0, 32, 12), '#2a0f1c'), M(ell(0, -5, 16, 5), C.red)); add(g, mouth); P.mouth = mouth
  const hairFront = new THREE.Group()
  if (ch.style === 'bob') {
    const f = [[-175, 205], [175, 205], [170, 92]]; for (let i = 7; i >= 0; i--) f.push([-170 + i * 48.5 + 24, i % 2 ? 108 : 82], [-170 + i * 48.5, 98])
    add(hairFront, M(poly(f), ch.hair), R(-215, -210, 70, 330, ch.hair), R(145, -210, 70, 330, ch.hair))
  } else for (const [x, y, r] of [[-110, 140, 72], [-35, 178, 80], [45, 182, 80], [115, 145, 70], [158, 85, 52], [-155, 82, 52]]) add(hairFront, M(circleShape(x, y, r), ch.hair))
  add(g, hairFront)
  if (ch.id === 'a') { for (const s of [-1, 1]) { const r = M(ring(52, 9), ch.acc); r.position.set(s * 62, 18, 0); add(g, r) } add(g, R(-12, 26, 24, 7, ch.acc)) }
  else { const e = M(circleShape(0, 0, 15), ch.acc); e.position.set(-160, -70, 0); add(g, e); const sp = sparkle(26, C.yellow); sp.position.set(100, -50, 0); add(g, sp) }
  Object.assign(P, { hairBack, hairFront }); g.userData = P; return g
}

function profile(ch) { // facing +x
  const g = new THREE.Group(), P = {}
  const hb = new THREE.Group()
  if (ch.style === 'bob') add(hb, M(poly([[-150, 120], [60, 150], [20, -175], [-175, -175]]), ch.hair))
  else for (const [x, y, r] of [[-70, 95, 75], [-130, 20, 70], [-115, -60, 55], [10, 120, 70]]) add(hb, M(circleShape(x, y, r), ch.hair))
  add(g, hb)
  add(g, R(-35, -230, 80, 120, ch.shade))
  const sh = new THREE.Shape(); sh.moveTo(-240, -420); sh.lineTo(220, -420); sh.quadraticCurveTo(200, -220, 40, -200); sh.lineTo(-60, -200); sh.quadraticCurveTo(-220, -220, -240, -420); add(g, M(sh, ch.shirt))
  add(g, M(circleShape(0, 0, 130), ch.skin), M(ell(45, -70, 90, 72), ch.skin), M(poly([[108, 22], [165, -32], [110, -40]]), ch.skin))
  add(g, M(ell(-22, -5, 22, 32), ch.shade))
  const eye = new THREE.Group(); eye.position.set(68, 22, 0); add(eye, M(ell(0, 0, 20, 12), C.white), M(circleShape(8, -1, 8), C.ink), R(-22, 9, 44, 6, C.ink)); add(g, eye); P.eyes = [eye]
  const brow = R(0, 0, 44, 8, C.ink); brow.position.set(48, 56, 0); brow.rotation.z = -0.1; add(g, brow)
  const mouth = new THREE.Group(); mouth.position.set(105, -78, 0); add(mouth, M(ell(0, 0, 18, 7), '#2a0f1c')); add(g, mouth); P.mouth = mouth
  const hf = new THREE.Group()
  if (ch.style === 'bob') { const s = new THREE.Shape(); s.moveTo(-150, 10); s.quadraticCurveTo(-140, 160, 20, 150); s.quadraticCurveTo(125, 145, 128, 62); s.lineTo(78, 70); s.quadraticCurveTo(-20, 85, -70, 20); s.closePath(); add(hf, M(s, ch.hair)) }
  else for (const [x, y, r] of [[-40, 110, 66], [35, 128, 62], [95, 100, 46], [-105, 55, 55]]) add(hf, M(circleShape(x, y, r), ch.hair))
  add(g, hf)
  if (ch.id === 'a') { const r = M(ring(30, 6), ch.acc); r.position.set(70, 22, 0); add(g, r, R(-20, 20, 62, 5, ch.acc)) }
  else { const e = M(circleShape(-22, -48, 11), ch.acc); add(g, e) }
  Object.assign(P, { hairBack: hb, hairFront: hf }); g.userData = P; return g
}

function walker(ch) {
  const g = new THREE.Group(), legs = [], arms = []
  for (const k of [0, 1]) { const l = new THREE.Group(); l.position.set(0, 60, 0); add(l, R(-9, -60, 18, 60, k ? C.ink : '#26262e')); legs.push(l); add(g, l) }
  for (const k of [0, 1]) { const a = new THREE.Group(); a.position.set(0, 112, 0); add(a, R(-7, -50, 14, 50, ch.skin)); arms.push(a) }
  add(g, arms[0], R(-20, 56, 40, 64, ch.shirt), arms[1], M(circleShape(4, 142, 24), ch.skin))
  if (ch.style === 'bob') add(g, M(poly([[-28, 166], [26, 168], [30, 140], [-30, 112]]), ch.hair)); else for (const [x, y, r] of [[-10, 162, 18], [10, 166, 16], [-22, 146, 14]]) add(g, M(circleShape(x, y, r), ch.hair))
  g.userData = { legs, arms }; return g
}
function walk(w, ph) { const s = Math.sin(ph * Math.PI * 2); w.userData.legs[0].rotation.z = 0.5 * s; w.userData.legs[1].rotation.z = -0.5 * s; w.userData.arms[0].rotation.z = -0.4 * s; w.userData.arms[1].rotation.z = 0.4 * s; w.position.y += Math.abs(Math.cos(ph * Math.PI * 2)) * 6 }

// expression: blink + sing + hair boil (8 fps hand-drawn jitter)
function animateChar(c, t, sing, en, seed) {
  const P = c.userData, bl = ((t + hash(seed) * 3) % 3.3) < 0.13 ? 0.12 : 1
  for (const e of P.eyes) e.scale.y = bl
  P.mouth.scale.y = 0.35 + sing * (0.6 + en * 1.6); P.mouth.scale.x = 0.9 + sing * 0.2
  P.hairFront.rotation.z = boil(t, seed, 0.015); P.hairBack.rotation.z = boil(t, seed + 3, 0.012)
}

// ---------- motifs (drawn around origin, ~700 px) ----------
function motif(kind, cols, seed) {
  const g = new THREE.Group(), r = rng(seed), U = {}
  const c = i => cols[i % cols.length]
  switch (kind) {
    case 'sun': { const burst = M(starShape(330, 22, 0.78), c(1)); add(g, burst); add(g, M(circleShape(0, 0, 230), c(0))); for (let i = 0; i < 5; i++) add(g, R(-540, -300 - i * 46, 1080, 22, c(2 + (i % 2)))); U.spin = [burst]; break }
    case 'city': { const back = new THREE.Group(), front = new THREE.Group()
      for (const [grp, sd, col, lit, y] of [[back, seed, c(2), c(1), -330], [front, seed + 9, C.dark, c(0), -720]]) {
        for (const k of [0, 1]) { const s = skyline(sd, 0, 8, 0.8, 2.6); const lw = M(s.outline, lit); const b = M(s.shape, col); lw.scale.set(170, 170, 1); b.scale.set(170, 170, 1); lw.position.set(k * 1360, y, 0); b.position.set(k * 1360, y, 0); add(grp, lw, b) }
        add(g, grp) }
      U.scroll = [[back, 40], [front, 90]]; break }
    case 'wind': { U.ribbons = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1400, 34, 80, 1), mat(c(i))); m.position.y = 260 - i * 120; m.userData.base = m.geometry.attributes.position.array.slice(); add(g, m); U.ribbons.push(m) } break }
    case 'sky': { for (let i = 0; i < 6; i++) add(g, R(-540, 380 - i * 140, 1080, 140, c(i))); U.clouds = []; for (let k = 0; k < 3; k++) { const cl = new THREE.Group(); for (const [x, y, rr] of [[-90, 0, 70], [0, 30, 95], [95, 0, 70], [0, -30, 80]]) add(cl, M(circleShape(x, y, rr), C.white)); cl.position.set(-300 + k * 320, 200 - k * 180, 0); cl.scale.setScalar(0.7 + k * 0.2); add(g, cl); U.clouds.push(cl) } break }
    case 'street': { add(g, M(poly([[-60, 420], [60, 420], [520, -560], [-520, -560]]), C.dark)); U.dash = []; for (let i = 0; i < 6; i++) { const d = R(-10, -40, 20, 80, c(0)); add(g, d); U.dash.push(d) }
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const l = new THREE.Group(); add(l, R(-6, 0, 12, 380, C.white), R(-40, 380, 80, 16, C.white), M(poly([[-36, 372], [36, 372], [180, -40], [-180, -40]]), c(0), 0.22)); l.position.set(s * (150 + k * 130), 120 - k * 220, 0); l.scale.setScalar(0.45 + k * 0.35); add(g, l) } break }
    case 'stars': { U.stars = []; for (let i = 0; i < 26; i++) { const s = sparkle(18 + r() * 60, c(i)); s.position.set((r() - 0.5) * 1000, (r() - 0.5) * 1100, 0); add(g, s); U.stars.push(s) } break }
    case 'heart': { U.hearts = []; for (let i = 4; i >= 0; i--) { const h = M(heartShape(150 + i * 70), i % 2 ? C.ink : c(i)); add(g, h); U.hearts.push(h) } break }
    case 'arcs': { U.arcs = []; for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const a = M(ring(100, 20, -0.6, 0.6), c(i)); a.rotation.z = s < 0 ? Math.PI : 0; a.userData = { i, s }; add(g, a); U.arcs.push(a) } add(g, M(heartShape(70), c(0))); break }
    case 'moon': { const m = new THREE.Shape(); m.absarc(0, 0, 260, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(110, 70, 230, 0, Math.PI * 2, true); m.holes.push(hole); add(g, M(m, C.white)); U.stars = []; for (let i = 0; i < 14; i++) { const s = sparkle(12 + r() * 30, c(i)); s.position.set((r() - 0.5) * 1000, (r() - 0.3) * 900, 0); add(g, s); U.stars.push(s) } break }
    case 'wave': case 'boat': { U.waves = []; for (let i = 0; i < 5; i++) { const w = new THREE.Group(); for (const k of [0, 1]) { const m = M(ridge(0, 1440, 260, [[3, 55, i], [6, 20, i * 2]], 120), c(i)); m.position.set(k * 1440, 0, 0); add(w, m) } w.position.y = 380 - i * 230; add(g, w); U.waves.push(w)
        if (kind === 'boat' && i === 1) { const b = new THREE.Group(); add(b, M(poly([[-170, 40], [170, 40], [120, -40], [-120, -40]]), C.white)); for (const [x, ch] of [[-50, CH.a], [50, CH.b]]) { const p = walker(ch); p.scale.setScalar(0.8); p.position.set(x, 40, 0); add(b, p) } b.position.set(0, 640, 0); add(g, b); U.boat = b } } break }
    case 'notes': { U.notes = []; for (let i = 0; i < 16; i++) { const n = new THREE.Group(); for (const s of noteShape(34 + r() * 26)) add(n, M(s, c(i))); n.position.set((r() - 0.5) * 900, (r() - 0.5) * 1000, 0); n.userData.v = 40 + r() * 80; add(g, n); U.notes.push(n) } break }
    case 'rings': { U.rings = []; for (let i = 0; i < 7; i++) { const m = M(ring(80 + i * 62, 30), c(i)); add(g, m); U.rings.push(m) } break }
    case 'clock': { add(g, M(circleShape(0, 0, 330), c(0)), M(circleShape(0, 0, 290), C.white)); for (let i = 0; i < 12; i++) { const k = R(-7, 230, 14, i % 3 ? 30 : 55, C.ink); k.rotation.z = (i / 12) * Math.PI * 2; add(g, k) }
      U.hands = [add(g, R(-10, 0, 20, 160, C.ink)), add(g, R(-6, 0, 12, 240, c(1)))]; add(g, M(circleShape(0, 0, 18), C.ink)); break }
    case 'lamp': { add(g, M(poly([[-30, 300], [30, 300], [380, -480], [-380, -480]]), c(0), 0.35), R(-12, -480, 24, 800, C.white), M(poly([[-70, 300], [70, 300], [40, 360], [-40, 360]]), C.white), M(circleShape(0, 300, 34), c(0))); U.glow = g.children[0]; break }
    case 'rain': case 'umbrella': { U.drops = []; for (let i = 0; i < 90; i++) { const d = R(-2, 0, 4, 40 + r() * 50, i % 4 ? C.white : c(0), 0.7); d.rotation.z = 0.25; d.userData = { x: (r() - 0.5) * 1300, o: r() * 1500, v: 900 + r() * 500 }; add(g, d); U.drops.push(d) }
      if (kind === 'umbrella') { const u = new THREE.Group(); const can = new THREE.Shape(); can.moveTo(-300, 0); can.quadraticCurveTo(0, 330, 300, 0); for (let i = 4; i >= 0; i--) can.quadraticCurveTo(-300 + (i + 0.5) * 120, 40, -300 + i * 120, 0); add(u, M(can, c(0)), R(-7, -330, 14, 330, C.white)); for (const [x, ch] of [[-70, CH.a], [70, CH.b]]) { const p = walker(ch); p.scale.setScalar(1.5); p.position.set(x, -560, 0); add(u, p) } u.position.y = 120; add(g, u); U.umb = u } break }
    case 'flowers': { U.fl = []; for (let i = 0; i < 12; i++) { const f = new THREE.Group(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add(f, M(circleShape(Math.cos(a) * 46, Math.sin(a) * 46, 40), c(i + k % 2))) } add(f, M(circleShape(0, 0, 32), C.ink)); f.position.set(-360 + (i % 4) * 240, 330 - Math.floor(i / 4) * 300, 0); add(g, f); U.fl.push(f) } break }
    case 'birds': { U.birds = []; for (let i = 0; i < 9; i++) { const b = new THREE.Group(), w1 = add(b, M(poly([[0, 0], [70, 22], [64, 4]]), c(i))), w2 = add(b, M(poly([[0, 0], [-70, 22], [-64, 4]]), c(i))); b.userData = { w1, w2 }; add(g, b); U.birds.push(b) } add(g, M(circleShape(220, 300, 140), c(0))); break }
    case 'sunburst': { const b = new THREE.Group(); for (let i = 0; i < 20; i++) { const s = new THREE.Shape(), a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2; s.moveTo(0, 0); s.absarc(0, 0, 1300, a0, a1, false); s.closePath(); add(b, M(s, i % 2 ? c(0) : c(1))) } add(g, b); add(g, M(heartShape(220), C.ink), M(heartShape(170), c(2))); U.spin = [b]; break }
  }
  g.userData = U; return g
}
function animateMotif(g, u, t, beat, en) {
  const U = g.userData
  U.spin?.forEach(m => { m.rotation.z = t * 0.25 })
  U.scroll?.forEach(([grp, v]) => { grp.position.x = -680 - ((u * v) % 1360) })
  U.ribbons?.forEach((m, i) => { const p = m.geometry.attributes.position, b = m.userData.base; for (let k = 0; k < p.count; k++) { const x = b[k * 3]; p.array[k * 3 + 1] = b[k * 3 + 1] + Math.sin(x * 0.006 + t * 3 + i) * 70 } p.needsUpdate = true })
  U.clouds?.forEach((c, i) => { c.position.x += Math.sin(t * 0.5 + i) * 0.6 })
  U.dash?.forEach((d, i) => { const ph = ((u * 0.9 + i / 6) % 1), y = 420 - ph * 980; d.position.set(0, y, 0); d.scale.set(0.3 + ph * 1.6, 0.3 + ph * 1.6, 1) })
  U.stars?.forEach((s, i) => { const k = 0.6 + 0.4 * Math.sin(t * 4 + i * 1.7) + beat * 0.3; s.scale.setScalar(k); s.rotation.z = t * 0.5 + i })
  U.hearts?.forEach((h, i) => { const k = 1 + beat * 0.08 * (5 - i) * 0.4; h.scale.setScalar(k) })
  U.arcs?.forEach(a => { const ph = ((u * 0.8 + a.userData.i / 6) % 1), k = 1 + ph * 3.2; a.scale.setScalar(k); a.position.x = a.userData.s * (60 + ph * 140); a.material.opacity = 1 - ph; a.material.transparent = true })
  U.waves?.forEach((w, i) => { w.position.x = -720 - ((u * (60 + i * 30) * (i % 2 ? 1 : -1)) % 1440 + 1440) % 1440 })
  if (U.boat) { U.boat.rotation.z = Math.sin(t * 1.6) * 0.06; U.boat.position.y = 640 + Math.sin(t * 1.3) * 16 }
  U.notes?.forEach((n, i) => { n.position.y = ((n.userData.y0 ??= n.position.y) + u * n.userData.v + 600) % 1200 - 600; n.rotation.z = Math.sin(t * 2 + i) * 0.3; n.scale.setScalar(1 + beat * 0.15) })
  U.rings?.forEach((m, i) => { m.scale.setScalar(1 + beat * 0.12 * Math.sin(i + t)); m.rotation.z = t * (i % 2 ? 0.4 : -0.4) })
  if (U.hands) { U.hands[0].rotation.z = -t * 0.6; U.hands[1].rotation.z = -t * 5 }
  if (U.glow) U.glow.material.opacity = 0.25 + 0.15 * Math.sin(t * 13) * (1 - smooth(0, 3, u))
  U.drops?.forEach(d => { const y = 700 - ((d.userData.o + t * d.userData.v) % 1500); d.position.set(d.userData.x - y * 0.25, y, 0) })
  if (U.umb) U.umb.rotation.z = Math.sin(t * 1.1) * 0.04
  U.fl?.forEach((f, i) => { const k = outExpo((u - i * 0.06) / 0.4); f.scale.setScalar(Math.max(0.001, k * (1 + beat * 0.1))); f.rotation.z = t * 0.6 + i })
  U.birds?.forEach((b, i) => { const f = Math.sin(t * 10 + i) * 0.5; b.userData.w1.rotation.z = f; b.userData.w2.rotation.z = -f; b.position.set(-600 + ((u * (160 + i * 14) + i * 140) % 1300), -200 + (i % 3) * 170 + Math.sin(t * 2 + i) * 20, 0) })
}

// UI texture cluster (small mono text + sparkle), the "interface" layer of the reference
function uiCluster(info, cols, seed) {
  const g = new THREE.Group(), r = rng(seed)
  const words = info.line ? info.line.toLowerCase().split(' ') : ['berbicara']
  const chunks = []; for (let i = 0; i < words.length; i += 2) chunks.push(words.slice(i, i + 2).join(' '))
  const blocks = [[`berbicara/${info.scene}`, `shot ${String(info.n).padStart(3, '0')}`, `bpm 112.3`], chunks.slice(0, 3), [`${info.tc}`, '✦ hati.kau.aku', `L${String(info.li + 1).padStart(2, '0')}/33`]]
  blocks.forEach((b, i) => { const m = label(b.length ? b : ['—'], { size: 17, color: i === 1 ? cols[0] : C.white, w: 320 }); m.position.set(-500 + r() * 560, 860 - i * (150 + r() * 160), 0); add(g, m) })
  const sp = sparkle(14, cols[1 % cols.length]); sp.position.set(-480 + r() * 900, 300 + r() * 500, 0); add(g, sp)
  const line = R(0, -1, 260 + r() * 300, 2, C.white); line.position.set(-540 + r() * 300, -200 + r() * 700, 0); line.rotation.z = -0.5 + r(); add(g, line)
  g.userData.sp = sp; return g
}

// ---------- shots ----------
// damped spring (small overshoot) reads hand-keyed; pure expo ease reads generated
const spring = x => (x <= 0 ? 0 : 1 - Math.exp(-6 * x) * (Math.cos(9.5 * x) + 0.55 * Math.sin(9.5 * x)))
function slideIn(m, from, to, u, d = 0, dur = 0.32) { const k = spring((u - d) / dur * 1.6); m.position.x = lerp(from[0], to[0], k); m.position.y = lerp(from[1], to[1], k) }

function buildShot(type, ctx) {
  const g = new THREE.Group(), { cols, ch, seed, mot } = ctx, r = rng(seed), other = ch.id === 'a' ? CH.b : CH.a
  const okFor = who => { const cs = cols.filter(c => c !== who.skin && c !== who.hair); return cs.length ? cs : [C.red, C.blue] }
  const pick = (i, who = ch) => { const cs = okFor(who); return cs[i % cs.length] }
  let up = () => {}
  const AN = [0, 0] // transition anchor: where the next shot grows out of this one
  if (type === 'close') {
    const p1 = R(-300, -360, 600, 1500, pick(0)), p2 = R(-200, -150, 400, 700, pick(1))
    add(g, p1, p2)
    const f = faceFront(ch), flip = r() < 0.5 ? -1 : 1; f.scale.set(2.5 * flip, 2.5, 1); add(g, f)
    const ui = uiCluster(ctx, cols, seed); add(g, ui)
    const fx = flip * (120 + r() * 120), fy = 120 + r() * 160, rot = (r() - 0.5) * 0.35
    up = (u, t, beat, en, sing) => {
      slideIn(p1, [-1400 * flip, 0], [flip * 380, 0], u); slideIn(p2, [0, 1600], [-flip * 330, 520], u, 0.06)
      f.position.set(fx + Math.sin(t * 0.7) * 10 - u * 14 * flip, fy + u * 6, 0); f.rotation.z = rot; f.scale.setScalar(1).multiply(new THREE.Vector3(2.5 * flip, 2.5, 1)).multiplyScalar(1 + u * 0.012 + beat * 0.01)
      const ex = 62 * f.scale.x, ey = 18 * f.scale.y; AN[0] = f.position.x + ex * Math.cos(rot) - ey * Math.sin(rot); AN[1] = f.position.y + ex * Math.sin(rot) + ey * Math.cos(rot) // pupil
      animateChar(f, t, sing, en, seed); ui.userData.sp.rotation.z = t * 2
    }
  } else if (type === 'rays') {
    AN[0] = 0; AN[1] = 180
    const rays = []; for (let i = 0; i < 16; i++) { const m = tri(cols[i % cols.length]); m.userData = { a: (i / 16) * Math.PI * 2 + r() * 0.2, L: 700 + r() * 600, w: 0.7 + r() * 1.3 }; add(g, m); rays.push(m) }
    const lines = []; for (let i = 0; i < 10; i++) { const l = R(0, -1, 300 + r() * 300, 3, C.white); l.userData = { a: r() * Math.PI * 2, o: r() }; add(g, l); lines.push(l) }
    const f = faceFront(ch); add(g, f); const ui = uiCluster(ctx, cols, seed); add(g, ui)
    const sps = [0, 1, 2].map(i => { const s = sparkle(30 + i * 14, cols[(i + 1) % cols.length]); s.position.set(-360 + r() * 720, 50 + r() * 700, 0); add(g, s); return s })
    up = (u, t, beat, en, sing) => {
      const k = outExpo(u / 0.28)
      rays.forEach((m, i) => { const d = m.userData; m.rotation.z = d.a + Math.sin(t * 0.6 + i) * 0.05 + u * 0.08; m.scale.set(d.L * k * (0.86 + beat * 0.28), d.w * 900 * k * 0.1 + 1, 1); m.position.set(0, 180, 0) })
      lines.forEach(l => { const ph = (l.userData.o + u * 1.4) % 1; l.rotation.z = l.userData.a; l.position.set(Math.cos(l.userData.a) * (200 + ph * 700), 180 + Math.sin(l.userData.a) * (200 + ph * 700), 0); l.scale.x = 1 - ph })
      f.position.set(0, 120 - (1 - k) * 200, 0); f.scale.setScalar(0.95 + beat * 0.03); animateChar(f, t, sing, en, seed)
      sps.forEach((s, i) => { s.rotation.z = t * (1 + i * 0.3); s.scale.setScalar(0.8 + 0.3 * Math.sin(t * 5 + i)) })
    }
  } else if (type === 'cards') {
    const cards = [], spec = [[-500, -40, 660, 660], [200, 200, 300, 400], [-500, -600, 420, 500], [-30, -560, 530, 700], [-540, -720, 1080, 110]]
    spec.forEach(([x, y, w, h], i) => { const m = R(0, 0, w, h, i === 4 ? C.white : pick(i)); m.userData = { x, y, from: [i % 2 ? 1300 : -1700, y] }; add(g, m); cards.push(m) })
    const mo = motif(mot, [C.ink, C.white, ...cols], seed + 4); mo.scale.setScalar(0.62); add(g, mo)
    const face = faceFront(ch); face.scale.setScalar(0.85); add(g, face)
    const big = label([String(ctx.li + 1).padStart(2, '0')], { size: 190, color: C.ink, w: 400, weight: 500, lh: 0.95 }); add(g, big)
    const spk = sparkle(90, C.ink); add(g, spk)
    const txt = label([ctx.line ? ctx.line.toUpperCase() : 'BERBICARA'], { size: 34, color: C.ink, w: 1060, weight: 500 }); add(g, txt)
    const ui = uiCluster(ctx, cols, seed); add(g, ui)
    up = (u, t, beat, en, sing) => {
      cards.forEach((m, i) => slideIn(m, m.userData.from, [m.userData.x, m.userData.y], u, i * 0.05))
      mo.position.set(cards[0].position.x + 330, cards[0].position.y + 330, 0); animateMotif(mo, u, t, beat, en); AN[0] = mo.position.x; AN[1] = mo.position.y
      face.position.set(cards[3].position.x + 265, cards[3].position.y + 380, 0); animateChar(face, t, sing, en, seed)
      big.position.set(cards[2].position.x + 30, cards[2].position.y + 470, 0); spk.position.set(cards[1].position.x + 150, cards[1].position.y + 200, 0); spk.rotation.z = t * 1.5
      txt.position.set(cards[4].position.x + 28, cards[4].position.y + 76, 0)
    }
  } else if (type === 'duo') {
    AN[0] = 0; AN[1] = 300
    const bl = R(-540, -720, 540, 1440, pick(0, CH.a)), br = R(0, -720, 540, 1440, pick(1, CH.b)); add(g, bl, br)
    const A = profile(CH.a), B = profile(CH.b); B.scale.x = -1; add(g, A, B)
    const mo = motif(mot === 'heart' || mot === 'arcs' ? mot : 'arcs', [C.white, C.ink, ...cols], seed); mo.scale.setScalar(0.55); add(g, mo)
    const ui = uiCluster(ctx, cols, seed); add(g, ui)
    up = (u, t, beat, en, sing) => {
      slideIn(bl, [-1100, 0], [0, 0], u); slideIn(br, [1100, 0], [0, 0], u)
      const k = outExpo(u / 0.4); A.position.set(-330 - (1 - k) * 400, 120, 0); B.position.set(330 + (1 - k) * 400, 120, 0)
      const talkA = Math.floor(t / 2.14) % 2 === 0
      animateChar(A, t, sing * (talkA ? 1 : 0.15), en, seed); animateChar(B, t, sing * (talkA ? 0.15 : 1), en, seed + 1)
      mo.position.set(0, 300, 0); animateMotif(mo, u, t, beat, en)
    }
  } else if (type === 'motif') {
    const bgc = pick(2), bg = R(-540, -720, 1080, 1440, bgc); add(g, bg)
    const mo = motif(mot, cols.filter(c => c !== bgc), seed); add(g, mo)
    const ui = uiCluster(ctx, [C.ink, ...cols], seed); add(g, ui)
    up = (u, t, beat, en) => { const k = outExpo(u / 0.3); mo.scale.setScalar(0.6 + 0.4 * k + beat * 0.02); animateMotif(mo, u, t, beat, en); bg.scale.y = k }
  } else if (type === 'walk') {
    AN[0] = 0; AN[1] = -60
    const skyc = cols.find(c => ![C.white, C.yellow, C.violet].includes(c)) ?? C.blue, sky = R(-540, -720, 1080, 1440, skyc); add(g, sky)
    const city = motif('city', [C.ink, C.yellow, '#2a2a34'], seed); city.position.y = 520; add(g, city)
    add(g, R(-540, -720, 1080, 520, C.white), R(-540, -205, 1080, 10, C.ink))
    const A = walker(CH.a), B = walker(CH.b); A.scale.setScalar(2.6); B.scale.setScalar(2.6); add(g, A, B)
    const ui = uiCluster(ctx, cols, seed); add(g, ui)
    up = (u, t, beat, en) => {
      animateMotif(city, u, t, beat, en)
      A.position.set(-130, -200, 0); B.position.set(130, -200, 0); walk(A, t * 0.95); walk(B, t * 0.95 + 0.1)
    }
  } else if (type === 'title') {
    AN[0] = 0; AN[1] = 240
    const rays = []; for (let i = 0; i < 22; i++) { const m = tri(cols[i % cols.length]); m.userData = { a: (i / 22) * Math.PI * 2 + r() * 0.15, L: 800 + r() * 700, w: 0.8 + r() }; add(g, m); rays.push(m) }
    add(g, M(circleShape(0, 0, 210), C.ink))
    const sps = [0, 1, 2, 3].map(i => { const s = sparkle(24 + i * 10, C.white); s.position.set(-420 + r() * 840, -300 + r() * 1100, 0); add(g, s); return s })
    up = (u, t, beat) => {
      const k = outExpo(u / 1.2)
      rays.forEach((m, i) => { const d = m.userData; m.rotation.z = d.a + t * 0.05; m.scale.set(d.L * k * (0.9 + beat * 0.2), d.w * 90 * k + 1, 1); m.position.set(0, 240, 0) })
      sps.forEach((s, i) => { s.rotation.z = t * (0.8 + i * 0.2); s.scale.setScalar(0.7 + 0.3 * Math.sin(t * 3 + i)) })
    }
  }
  return { g, update: up, anchor: AN, color: type === 'cards' ? pick(0) : null }
}

// ---------- world ----------
export function buildWorld(canvas, audio, lines) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false); renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(C.ink); renderer.autoClear = false // accumulation clears explicitly
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-540, 540, 960, -960, -10, 10)
  const root = new THREE.Group(); root.position.y = 240; scene.add(root) // shot area centre (top 1440 px)

  const lineAt = t => { let k = -1; lines.forEach((l, i) => { if (t >= l.start - 0.4 && t < l.end + 0.8) k = i }); return k }
  const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`
  // cut list snapped to the beat grid
  const cuts = []
  for (const s of SCENES) {
    let i = s.t0 === 0 ? -1 : audio.beats.findIndex(b => b >= s.t0 - 0.15)
    let t = s.t0 === 0 ? 0 : audio.beats[i], k = 0
    while (t < s.t1 - 0.5) {
      const li = lineAt(t + 0.3), line = li >= 0 ? lines[li].text : ''
      const kw = KEYWORD.find(([w]) => line.toLowerCase().split(' ').some(x => x.startsWith(w)))
      const type = s.id === 'outro' && t > 204 ? 'title' : s.shots[k % s.shots.length]
      cuts.push({ t, s, type, ch: (cuts.length % 2 ? CH.b : CH.a), mot: kw ? kw[1] : s.motifs[k % s.motifs.length], li, line, k })
      k++; i += s.every; t = i < audio.beats.length ? audio.beats[i] : s.t1
    }
  }
  const shots = cuts.map((c, n) => {
    const sh = buildShot(c.type, { cols: c.s.cols, ch: c.ch, seed: 101 + n * 17, mot: c.mot, line: c.line, li: Math.max(0, c.li), scene: c.s.id, n: n + 1, tc: fmt(c.t) })
    sh.g.visible = false; root.add(sh.g); return sh
  })
  const cutAt = t => { let lo = 0; for (let i = 0; i < cuts.length; i++) if (cuts[i].t <= t) lo = i; return lo }
  const singing = t => lines.some(l => l.words.some(w => t >= w.s && t < w.e)) ? 1 : 0
  // ---------- linked transitions ----------
  // Every cut grows out of something already on screen in the outgoing shot (its anchor): the pupil, the heart,
  // the ray centre, a card's colour. Window is centred on the beat so the hand-over lands on it.
  const T = { iris: 0, heart: 1, star: 2, block: 3, slash: 4, pupil: 5, push: 6, bands: 7 }
  cuts.forEach((c, n) => {
    if (n === 0) return
    const a = cuts[n - 1], sec = a.s !== c.s, reff = c.s.every <= 4
    let kind
    if (sec) kind = n % 2 ? T.slash : T.push
    else if (a.type === 'close') kind = T.pupil
    else if (a.type === 'duo' || a.mot === 'heart') kind = T.heart
    else if (a.type === 'rays' || a.type === 'title') kind = T.star
    else if (a.type === 'cards') kind = T.block
    else if (a.type === 'walk') kind = T.bands
    else kind = T.iris
    const d = kind === T.pupil ? 0.62 : sec ? 0.56 : reff ? 0.36 : 0.48
    c.tr = { kind, d, t0: c.t - d * 0.5, dir: n % 2 ? 1 : -1 }
  })
  const easeIO = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
  const trAt = t => { for (let i = 1; i < cuts.length; i++) { const r = cuts[i].tr; if (t >= r.t0 && t < r.t0 + r.d) return i } return -1 }

  // 8-bit sRGB targets without MSAA (MSAA + float is very slow in software GL); AA comes from sub-pixel jitter across the blur samples
  const RT = () => { const r = new THREE.WebGLRenderTarget(1080, 1920); r.texture.colorSpace = THREE.SRGBColorSpace; return r }
  const frame = RT(), rtA = RT(), rtB = RT(), accum = new THREE.WebGLRenderTarget(1080, 1920, { type: THREE.HalfFloatType })
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b) } return r }
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
  const quadScene = new THREE.Scene(); quadScene.add(quad)
  const addMat = new THREE.MeshBasicMaterial({ map: frame.texture, transparent: true, blending: THREE.AdditiveBlending, depthTest: false })
  const VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }'
  const col = () => new THREE.Color()
  const trMat = new THREE.ShaderMaterial({
    uniforms: { A: { value: rtA.texture }, B: { value: rtB.texture }, p: { value: 0 }, kind: { value: 0 }, c: { value: new THREE.Vector2() },
      c1: { value: col() }, c2: { value: col() }, c3: { value: col() }, dir: { value: 1 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D A, B; uniform float p, dir; uniform int kind; uniform vec2 c; uniform vec3 c1, c2, c3; varying vec2 vUv;
      const vec2 S = vec2(1080., 1920.);
      float eio(float x){ x = clamp(x, 0., 1.); return x < .5 ? 4.*x*x*x : 1. - pow(-2.*x + 2., 3.) / 2.; }
      float eo(float x){ x = clamp(x, 0., 1.); return 1. - pow(1. - x, 3.); }
      float aa(float d){ return clamp(.5 - d / 1.5, 0., 1.); }            // 1 inside (d<0), 1.5px soft edge
      float sdHeart(vec2 q){ q.x = abs(q.x); if (q.y + q.x > 1.) return sqrt(dot(q - vec2(.25, .75), q - vec2(.25, .75))) - sqrt(2.) / 4.;
        return sqrt(min(dot(q - vec2(0., 1.), q - vec2(0., 1.)), dot(q - .5 * max(q.x + q.y, 0.), q - .5 * max(q.x + q.y, 0.)))) * sign(q.x - q.y); }
      vec3 tA(vec2 u){ return texture2D(A, u).rgb; } vec3 tB(vec2 u){ return texture2D(B, u).rgb; }
      // shape iris: B inside a growing shape, accent rim riding its edge
      vec3 iris(float d, float w, vec2 u){ vec3 o = mix(tA(u), tB(u), aa(d)); return mix(o, c1, aa(abs(d + w * .5) - w * .5) * step(.001, w)); }
      void main(){
        vec2 px = vUv * S, cp = c * S, q = px - cp; vec3 o;
        if (kind == 0) { float e = eio(p), R = e * 2400.; o = iris(length(q) - R, 34. * (1. - e), vUv); }
        else if (kind == 1) { float e = eio(p), k = max(e * 3400., 1.); float d = sdHeart(vec2(q.x, q.y + .5 * k) / k) * k;
          o = iris(d, 40. * (1. - e), vUv); }
        else if (kind == 2) { float e = eio(p), a = atan(q.y, q.x) + e * 1.6, r = length(q);
          float R = e * 4400. * (.45 + .55 * pow(abs(cos(a * 2.)), 6.)); o = iris(r - R, 30. * (1. - e), vUv); }
        else if (kind == 3) { // card colour block carries over: covers A, then peels off to B (three layered edges)
          float x = dir > 0. ? vUv.x : 1. - vUv.x, a = eio(p * 1.25), b = eio(p * 1.25 - .25);
          o = x < b ? tB(vUv) : x < a ? c1 : tA(vUv);
          if (x < a && x > a - .05 && x >= b) o = c2; if (x < b + .03 && x >= b) o = c3; }
        else if (kind == 4) { // diagonal slash: three accent bands sweep, B behind them
          vec2 n = normalize(vec2(1., .42 * dir)); float s = dot(vUv * S - S * .5, n) / 1300. + .5, f = eio(p) * 1.5 - .2;
          o = s < f - .16 ? tB(vUv) : s < f - .1 ? c3 : s < f - .05 ? c2 : s < f ? c1 : tA(vUv); }
        else if (kind == 5) { // into the pupil: zoom A toward the eye until it is all pupil, then the pupil opens onto B
          float z = eo(p / .55), zoom = 1. + z * z * 34.; vec2 ua = c + (vUv - c) / zoom;
          if (p < .55) o = tA(ua); else { float e = eo((p - .55) / .45), R = e * 2300.; o = mix(vec3(.0058), tB(vUv), aa(length(q) - R)); } }
        else if (kind == 6) { float k = eio(p); vec2 ua = vUv + vec2(dir * k, 0.), ub = vUv - vec2(dir * (1. - k), 0.);
          o = (ua.x >= 0. && ua.x <= 1.) ? tA(ua) : tB(ub); }
        else { // bands: 8 horizontal strips slide across, alternating sides, staggered
          float i = floor(vUv.y * 8.), side = mod(i, 2.) < 1. ? 1. : -1., k = eio(p * 1.5 - i * .06);
          float x = side > 0. ? vUv.x : 1. - vUv.x; o = x < k ? tB(vUv) : (x < k + .02 ? c1 : tA(vUv)); }
        gl_FragColor = vec4(o, 1.);
      }`,
  })
  const ink = new THREE.Color(C.ink)
  const outMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: accum.texture }, seed: { value: 0 }, ink: { value: ink } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tex; uniform float seed; uniform vec3 ink; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
      void main(){ vec3 c = texture2D(tex, vUv).rgb; if (vUv.y < 0.25) c = ink;
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
        float g = h(floor(vUv * vec2(1080., 1920.) / 1.5)) - .5; // grain in display space
        gl_FragColor.rgb += g * .035;
      }`,
  })

  function showOnly(i) { shots.forEach((s, k) => { s.g.visible = k === i }) }
  function poseShot(i, t) {
    const c = cuts[i], beat = audio.pulse(t), en = audio.rms(t), hot = c.s.every <= 4 ? 1 : 0
    const lead = c.tr ? c.tr.d * 0.5 + 0.3 : 0
    shots[i].update(Math.max(0, t - c.t + lead), t, beat, en, singing(t))
    root.position.set(hot * boil(t * 2, 7, 10) * beat, 240 + hot * boil(t * 2, 9, 10) * beat, 0) // reff: camera punch
    root.scale.setScalar(1 + hot * beat * 0.012)
  }
  const draw = target => { renderer.setRenderTarget(target); renderer.setClearColor(C.ink, 1); renderer.clear(); renderer.render(scene, cam) }
  function renderAt(t) { // one sub-frame into `frame`
    const m = trAt(t)
    if (m < 0) { const n = cutAt(t); showOnly(n); poseShot(n, t); draw(frame); return }
    const r = cuts[m].tr, a = shots[m - 1]
    showOnly(m - 1); poseShot(m - 1, t); draw(rtA)
    const ax = (a.anchor[0] * root.scale.x + root.position.x + 540) / 1080, ay = (a.anchor[1] * root.scale.y + root.position.y + 960) / 1920
    showOnly(m); poseShot(m, t); draw(rtB)
    const U = trMat.uniforms, cs = cuts[m].s.cols
    U.p.value = (t - r.t0) / r.d; U.kind.value = r.kind; U.dir.value = r.dir; U.c.value.set(ax, ay)
    U.c1.value.set(a.color ?? cuts[m].s.accent); U.c2.value.set(cs[1 % cs.length]); U.c3.value.set(cs[2 % cs.length])
    quad.material = trMat; renderer.setRenderTarget(frame); renderer.render(quadScene, quadCam)
  }
  let SUB = 3
  function seek(t) {
    renderer.setRenderTarget(accum); renderer.setClearColor(0x000000, 1); renderer.clear()
    // fast moves (transitions, cut entries) need more samples or the blur steps into ghost copies
    const N = SUB > 1 && (trAt(t) >= 0 || t - cuts[cutAt(t)].t < 0.36) ? 6 : SUB
    for (let s = 0; s < N; s++) {
      const dt = (s / N) * (0.5 / 30); clock.off = dt
      if (N > 1) cam.setViewOffset(1080, 1920, halton(s + 1, 2) - 0.5, halton(s + 1, 3) - 0.5, 1080, 1920); else cam.clearViewOffset()
      renderAt(t - dt)
      addMat.opacity = 1 / N; quad.material = addMat; renderer.setRenderTarget(accum); renderer.render(quadScene, quadCam)
    }
    clock.off = 0; cam.clearViewOffset()
    outMat.uniforms.seed.value = Math.floor(t * 12) * 1.37 % 97
    quad.material = outMat; renderer.setRenderTarget(null); renderer.render(quadScene, quadCam)
  }
  seek.setQuality = q => { SUB = q }
  return { seek, info: t => { const n = cutAt(t), c = cuts[n]; return { shot: n + 1, total: cuts.length, accent: c.s.accent, type: c.type } }, cuts }
}
