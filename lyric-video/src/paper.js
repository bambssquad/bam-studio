// Paper materials + cut-paper shape builders. Every shape is built with its base at y=0.
import * as THREE from 'three'
import { rng } from './util.js'

export function paperCanvas(size = 512, seed = 7) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d'), r = rng(seed)
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size)
  for (let i = 0; i < 2600; i++) { // fibres
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 4 + r() * 18
    g.strokeStyle = `rgba(${r() < 0.5 ? '120,110,100' : '255,255,255'},${0.05 + r() * 0.09})`
    g.lineWidth = 0.6 + r() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
  }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(90,80,70,${r() * 0.07})`; g.fillRect(r() * size, r() * size, 1.4, 1.4) }
  return c
}

let tex
export function paperTex() {
  if (tex) return tex
  tex = new THREE.CanvasTexture(paperCanvas())
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(0.45, 0.45); tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const mats = new Map()
export function paper(color, opts = {}) {
  const key = color + JSON.stringify(opts)
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({
    color, map: paperTex(), bumpMap: paperTex(), bumpScale: 0.9, roughness: 0.93, metalness: 0, side: THREE.DoubleSide, ...opts,
  }))
  return mats.get(key)
}

export function cut(shape, color, depth = 0.025, opts) {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 }), paper(color, opts))
  m.castShadow = m.receiveShadow = true
  return m
}

const rect = (x, y, w, h) => { const p = new THREE.Path(); p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.closePath(); return p }
export const rectShape = (x, y, w, h) => { const s = new THREE.Shape(); s.moveTo(x, y); s.lineTo(x + w, y); s.lineTo(x + w, y + h); s.lineTo(x, y + h); s.closePath(); return s }
export const circleShape = (x, y, r) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); return s }

// skyline over [x0, x0+W]; returns {shape (with window holes), outline (no holes)}
export function skyline(seed, x0, W, hMin, hMax, windows = true) {
  const r = rng(seed), pts = [[x0, 0]], holes = []
  let x = x0
  while (x < x0 + W - 0.05) {
    const w = Math.min(0.28 + r() * 0.5, x0 + W - x), h = hMin + r() * (hMax - hMin), kind = r()
    pts.push([x, h])
    if (kind < 0.18 && w > 0.3) { pts.push([x + w / 2, h + w * 0.45]) } // gable
    else if (kind < 0.3) { pts.push([x + w * 0.45, h]); pts.push([x + w * 0.47, h + 0.35]); pts.push([x + w * 0.5, h]) } // antenna
    pts.push([x + w, h])
    if (windows && w > 0.3) {
      const cols = Math.floor((w - 0.08) / 0.11), rows = Math.floor((h - 0.25) / 0.16)
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() < 0.55)
        holes.push(rect(x + 0.06 + i * 0.11, 0.2 + j * 0.16, 0.055, 0.08))
    }
    x += w
  }
  pts.push([x0 + W, 0])
  const mk = () => { const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); return s }
  const shape = mk(); shape.holes = holes
  return { shape, outline: mk() }
}

// periodic rolling edge (hills / waves): integer harmonics over W so tiles repeat seamlessly
export function ridge(x0, W, base, harm, seg = 96) {
  const s = new THREE.Shape(); s.moveTo(x0, 0)
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, x = x0 + u * W
    let y = base; for (const [k, a, ph] of harm) y += a * Math.sin(u * Math.PI * 2 * k + ph)
    s.lineTo(x, y)
  }
  s.lineTo(x0 + W, 0); s.closePath(); return s
}

export function heartShape(sz) {
  const s = new THREE.Shape(), k = sz
  s.moveTo(0, -k); s.bezierCurveTo(-0.2 * k, -0.6 * k, -1.2 * k, -0.2 * k, -k, 0.45 * k)
  s.bezierCurveTo(-0.85 * k, 1.05 * k, -0.15 * k, 1.05 * k, 0, 0.55 * k)
  s.bezierCurveTo(0.15 * k, 1.05 * k, 0.85 * k, 1.05 * k, k, 0.45 * k)
  s.bezierCurveTo(1.2 * k, -0.2 * k, 0.2 * k, -0.6 * k, 0, -k)
  return s
}

export function starShape(R, n = 5, inner = 0.45) {
  const s = new THREE.Shape()
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? R * inner : R
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return s
}

export function noteShape(k = 0.12) {
  const s = new THREE.Shape(); s.absellipse(0, 0, k, k * 0.75, 0, Math.PI * 2, false, -0.4)
  const stem = rectShape(k * 0.8, 0, k * 0.22, k * 3.4), flag = new THREE.Shape()
  flag.moveTo(k * 0.8, k * 3.4); flag.quadraticCurveTo(k * 2.2, k * 2.8, k * 1.6, k * 1.7); flag.lineTo(k * 1.02, k * 2.9); flag.closePath()
  return [s, stem, flag]
}

let glowTex
export function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}
export function glow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  s.scale.set(size, size, 1); return s
}

// thin hanging thread (paper-theatre rigging)
export function thread(len = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 4), new THREE.MeshBasicMaterial({ color: '#f5efe4', transparent: true, opacity: 0.55 }))
  m.position.y = len / 2; return m
}
