// Paper-cut pop-up diorama. Everything is a pure function of t (seek), no timers / Math.random.
import * as THREE from 'three'
import { clamp, lerp, smooth, pop, hash, boil, outExpo } from './util.js'
import { cut, paper, rectShape, circleShape, skyline, ridge, heartShape, starShape, noteShape, glow, thread, paperTex } from './paper.js'
import { figure, pose } from './figures.js'

// ---------- palette timeline ----------
const P = {
  duskWarm: { top: '#6b5aa6', bot: '#f6b06a', key: '#ffd6a0', kI: 2.2, hS: '#f3c9b0', hG: '#6b4e6e', hI: 1.1, ground: '#d9a98a' },
  blueDusk: { top: '#4f78c2', bot: '#f2c48e', key: '#ffe2bf', kI: 2.2, hS: '#c9d6f0', hG: '#6b5a72', hI: 1.15, ground: '#e3bf95' },
  evening: { top: '#2f3f7d', bot: '#e1877a', key: '#ff9f80', kI: 1.7, hS: '#8d8fc2', hG: '#4a3550', hI: 0.95, ground: '#a77a86' },
  night: { top: '#141c3d', bot: '#3f3f7a', key: '#a9b8ff', kI: 1.25, hS: '#5a6aa8', hG: '#1d1a33', hI: 0.85, ground: '#3b3e66' },
  oceanN: { top: '#0f2244', bot: '#2c5f8a', key: '#b8d4ff', kI: 1.3, hS: '#6f9ac9', hG: '#1a2440', hI: 0.9, ground: '#2e4f72' },
  symph: { top: '#2a1d55', bot: '#b3528c', key: '#ffc1d9', kI: 1.6, hS: '#c58fd0', hG: '#3a2050', hI: 0.95, ground: '#5b3b6e' },
  warm: { top: '#e2475a', bot: '#ffd28c', key: '#fff0d0', kI: 2.4, hS: '#ffd0b0', hG: '#8a4a5a', hI: 1.2, ground: '#f2b48c' },
  rain: { top: '#1a2134', bot: '#4b5871', key: '#9fb3d1', kI: 1.0, hS: '#6b7c99', hG: '#1c2130', hI: 0.8, ground: '#343d52' },
  dawn: { top: '#f0938a', bot: '#ffe9b8', key: '#fff2d6', kI: 2.3, hS: '#ffd9c4', hG: '#8a5a6a', hI: 1.15, ground: '#f4c7a6' },
  outro: { top: '#594a92', bot: '#f2a46c', key: '#ffcf9e', kI: 2.0, hS: '#e8c0b0', hG: '#5a4060', hI: 1.0, ground: '#c9927f' },
  outroEnd: { top: '#2e2650', bot: '#b8676b', key: '#ff9f80', kI: 1.3, hS: '#9a7aa0', hG: '#2a1e38', hI: 0.8, ground: '#7a5266' },
}
const KEYS = [[0, 'duskWarm'], [12, 'duskWarm'], [22, 'blueDusk'], [32, 'blueDusk'], [44, 'evening'], [49, 'night'], [64, 'night'], [69, 'oceanN'],
  [85, 'oceanN'], [90, 'symph'], [106, 'symph'], [110, 'warm'], [135, 'warm'], [139.5, 'rain'], [161, 'rain'], [167, 'dawn'], [189, 'dawn'],
  [195, 'outro'], [207, 'outro'], [219, 'outroEnd']]
const cA = new THREE.Color(), cB = new THREE.Color()
function palette(t, out) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++
  const [t0, a] = KEYS[i], [t1, b] = KEYS[i + 1], f = smooth(0, 1, (t - t0) / (t1 - t0))
  for (const k of ['top', 'bot', 'key', 'hS', 'hG', 'ground']) out[k].copy(cA.set(P[a][k])).lerp(cB.set(P[b][k]), f)
  out.kI = lerp(P[a].kI, P[b].kI, f); out.hI = lerp(P[a].hI, P[b].hI, f)
}

// ---------- scene timing ----------
export const SCENES = [
  { id: 'dusk', t0: 0, t1: 27.0, label: 'intro · senja' },
  { id: 'road', t0: 27.0, t1: 47.0, label: 'verse · jalan' },
  { id: 'hill', t0: 47.0, t1: 66.5, label: 'reff' },
  { id: 'ocean', t0: 66.5, t1: 86.8, label: 'verse · ombak' },
  { id: 'symph', t0: 86.8, t1: 108.6, label: 'verse · simfoni' },
  { id: 'heart', t0: 108.6, t1: 137.0, label: 'reff' },
  { id: 'rain', t0: 137.0, t1: 163.4, label: 'bridge · hujan' },
  { id: 'dawn', t0: 163.4, t1: 191.0, label: 'reff · fajar' },
  { id: 'outro', t0: 191.0, t1: 219.5, label: 'outro' },
]

// item helpers. mode 'pop' hinges up from the floor; 'fly' drops in on a thread from above.
function popItem(obj, z, delay = 0, x = 0) { const h = new THREE.Group(); h.position.set(x, 0, z); h.add(obj); return { node: h, mode: 'pop', delay } }
function flyItem(obj, x, y, z, delay = 0, withThread = true) {
  const g = new THREE.Group(); g.add(obj); if (withThread) g.add(thread())
  const h = new THREE.Group(); h.add(g); h.position.set(x, y, z); return { node: h, inner: g, mode: 'fly', delay, y }
}
function scroller(build, TW) { // two tiles so the strip loops seamlessly over [-TW/2, TW/2]
  const g = new THREE.Group(), a = build(), b = build(); b.position.x = TW; g.add(a, b)
  g.userData.scroll = s => { g.position.x = -TW / 2 - (((s % TW) + TW) % TW) }
  return g
}
function windowsGlow(outline, color = '#ffcf7a') {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshBasicMaterial({ color })); m.position.z = -0.02; return m
}
function lamp(h = 1.5) {
  const g = new THREE.Group()
  g.add(cut(rectShape(-0.025, 0, 0.05, h), '#2a2436'), cut(rectShape(-0.09, h, 0.18, 0.05), '#2a2436'))
  const head = new THREE.Shape(); head.moveTo(-0.07, h); head.lineTo(0.07, h); head.lineTo(0.04, h - 0.12); head.lineTo(-0.04, h - 0.12); head.closePath()
  g.add(cut(head, '#ffe2a0', 0.03, { emissive: '#ffcc66', emissiveIntensity: 0.9 }))
  const gl = glow('#ffcc77', 1.1); gl.position.set(0, h - 0.08, 0.06); g.add(gl); g.userData.glow = gl
  return g
}
function tree(s = 1, c1 = '#3f5b4a', c2 = '#55785d') {
  const g = new THREE.Group(); g.add(cut(rectShape(-0.05 * s, 0, 0.1 * s, 0.8 * s), '#3a2a2a'))
  ;[[0, 1.0, 0.42], [-0.3, 0.8, 0.3], [0.3, 0.82, 0.32], [0, 1.3, 0.3]].forEach(([x, y, r], i) => {
    const m = cut(circleShape(x * s, y * s, r * s), i % 2 ? c2 : c1, 0.03); m.position.z = i * 0.012; g.add(m)
  })
  return g
}
function cloud(s, color) {
  const g = new THREE.Group()
  ;[[-0.5, 0, 0.32], [0, 0.12, 0.45], [0.5, 0, 0.3], [0.2, -0.08, 0.3], [-0.2, -0.1, 0.3]].forEach(([x, y, r], i) => {
    const m = cut(circleShape(x * s, y * s, r * s), color, 0.03); m.position.z = (i % 2) * 0.015; g.add(m)
  })
  return g
}
function multi(shapes, color, depth) { const g = new THREE.Group(); for (const s of shapes) g.add(cut(s, color, depth)); return g }
function rings(n, color) { // expanding sound arcs, both sides
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40, 1, -Math.PI * 0.28, Math.PI * 0.56), mat.clone())
    g.add(m)
  }
  return g
}

// confetti / rain / fireflies via instancing
function confettiField(N, colors) {
  const geo = new THREE.PlaneGeometry(0.07, 0.1), m = new THREE.InstancedMesh(geo, paper('#ffffff'), N)
  const c = new THREE.Color(); for (let i = 0; i < N; i++) m.setColorAt(i, c.set(colors[i % colors.length]))
  m.castShadow = true; m.frustumCulled = false
  return m
}
const dummy = new THREE.Object3D()

// ---------- build ----------
export function buildWorld(canvas, audio) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.1, 100)
  const pal = { top: new THREE.Color(), bot: new THREE.Color(), key: new THREE.Color(), hS: new THREE.Color(), hG: new THREE.Color(), ground: new THREE.Color() }

  // sky backdrop with paper grain
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: pal.top }, bot: { value: pal.bot }, grain: { value: paperTex() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform sampler2D grain; varying vec2 vUv;
      void main(){ float h=smoothstep(.12,.92,vUv.y); vec3 c=mix(bot,top,h); float g=texture2D(grain,vUv*vec2(3.,4.)).r;
      c*=mix(.9,1.03,g); c*=1.-.25*pow(length(vUv-vec2(.5,.55))*1.3,2.); gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`,
  })
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(22, 26), skyMat); sky.position.set(0, 5, -7); scene.add(sky)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', map: paperTex(), roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2; floor.position.z = -1; floor.receiveShadow = true; scene.add(floor)

  const hemi = new THREE.HemisphereLight('#fff', '#888', 1); scene.add(hemi)
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(22, 26), new THREE.ShadowMaterial({ opacity: 0.32 })); catcher.position.set(0, 5, -6.9); catcher.receiveShadow = true; scene.add(catcher)
  const key = new THREE.DirectionalLight('#fff', 2); key.position.set(-6.5, 7.5, 6); key.castShadow = true
  key.shadow.mapSize.set(1536, 1536); Object.assign(key.shadow.camera, { left: -9, right: 9, top: 11, bottom: -4, near: 1, far: 34 })
  key.shadow.radius = 3; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key, key.target); key.target.position.set(0, 2, -1)

  // celestial body (sun <-> moon), flown on a thread
  const orb = new THREE.Group(), orbDisc = cut(circleShape(0, 0, 0.62), '#ffffff', 0.03, { emissive: '#ffffff', emissiveIntensity: 0.6 })
  const orbGlow = glow('#fff1c9', 4.2); orbGlow.position.z = -0.1; orb.add(orbGlow, orbDisc, thread()); orbDisc.castShadow = false; scene.add(orb)
  const ORB = [ // t, x, y, color, glow, emissive
    [0, 1.25, 7.2, '#ffd27a', 1, 0.7], [27, 1.35, 3.4, '#ffb36b', 1, 0.7], [33, 1.35, 0.4, '#ff9a6b', 0.6, 0.5],
    [42, -1.25, 0.4, '#f4ead2', 0.4, 0.5], [50, -1.2, 7.4, '#f4ead2', 0.7, 0.55], [104, -1.3, 7.2, '#f4ead2', 0.7, 0.55],
    [108.5, -1.3, 13, '#f4ead2', 0.7, 0.55], [137, 1.2, 13, '#dfe6f2', 0.3, 0.4], [141, 1.2, 7.3, '#dfe6f2', 0.3, 0.4],
    [162, 1.2, 7.3, '#dfe6f2', 0.3, 0.4], [164, 1.2, 13, '#dfe6f2', 0.3, 0.4], [164.1, 0, 0.3, '#ffcf8a', 1, 0.7],
    [178, 0, 5.4, '#ffe1a0', 1, 0.75], [191, 1.0, 6.6, '#ffd27a', 1, 0.7], [216, 1.2, 2.2, '#ff9a6b', 0.9, 0.6], [220, 1.2, 1.8, '#ff9a6b', 0.9, 0.6]]
  const orbColor = new THREE.Color()
  function updateOrb(t) {
    let i = 0; while (i < ORB.length - 2 && ORB[i + 1][0] <= t) i++
    const a = ORB[i], b = ORB[i + 1], f = smooth(0, 1, (t - a[0]) / (b[0] - a[0]))
    orb.position.set(lerp(a[1], b[1], f), lerp(a[2], b[2], f), -4.6)
    orbColor.set(a[3]).lerp(cB.set(b[3]), f); orbDisc.material.color.copy(orbColor); orbDisc.material.emissive.copy(orbColor)
    orbDisc.material.emissiveIntensity = lerp(a[5], b[5], f); orbGlow.material.color.copy(orbColor); orbGlow.material.opacity = lerp(a[4], b[4], f)
    orb.rotation.z = Math.sin(t * 0.6) * 0.03
  }

  const scenes = SCENES.map(s => ({ ...s, ...BUILD[s.id](s), group: new THREE.Group() }))
  for (const s of scenes) { for (const it of s.items) s.group.add(it.node); scene.add(s.group) }

  function seek(t) {
    palette(t, pal)
    hemi.color.copy(pal.hS); hemi.groundColor.copy(pal.hG); hemi.intensity = pal.hI * 0.62
    key.color.copy(pal.key); key.intensity = pal.kI * 1.35; floor.material.color.copy(pal.ground)
    updateOrb(t)
    const beat = audio.pulse(t), en = audio.rms(t)
    for (const s of scenes) {
      const active = t > s.t0 - 1.2 && t < s.t1 + 1.6
      s.group.visible = active; if (!active) continue
      const n = s.items.length
      s.items.forEach((it, i) => {
        if (it.mode === 'none') return
        const enter = pop((t - (s.t0 - 0.7) - (it.delay ?? 0) - (s.t0 === 0 ? 1.0 : 0)) / 1.1)
        const exit = smooth(0, 0.75, t - (s.t1 - 0.55) - (n - 1 - i) * 0.05)
        const p = enter * (1 - exit)
        it.node.visible = p > 0.002
        if (it.mode === 'pop') it.node.rotation.x = -(Math.PI / 2) * (1 - p)
        else { it.node.position.y = it.y + (1 - p) * 9; it.inner.rotation.z = Math.sin(t * 1.3 + i) * 0.04 + (1 - Math.min(1, enter)) * 0.3 + boil(t, i, 0.01) }
      })
      s.update?.(t, t - s.t0, { beat, en, audio })
    }
    // camera: slow drift + gentle push on the beat in high-energy parts
    const drift = Math.sin(t * 0.09) * 0.35, push = beat * clamp(en - 0.45, 0, 1) * 0.12
    const cz = 12.6 - push - 0.5 * smooth(108, 118, t) + 0.5 * smooth(130, 140, t)
    camera.position.set(drift, 3.55 + Math.sin(t * 0.13) * 0.12, cz)
    camera.lookAt(drift * 0.4, 2.5 + 0.6 * smooth(36, 42, t) * (1 - smooth(45, 47.5, t)), -1)
    renderer.render(scene, camera)
  }
  return { seek, renderer }
}

// ---------- scene builders: return {items, update?} ----------
const BUILD = {
  dusk() {
    const far = skyline(11, -5, 10, 1.4, 3.2), near = skyline(23, -5, 10, 0.8, 2.2)
    const farG = new THREE.Group(); farG.add(cut(far.shape, '#7d5a8c'), windowsGlow(far.outline))
    const nearG = new THREE.Group(); nearG.add(cut(near.shape, '#5b3f6e'), windowsGlow(near.outline))
    const hillsBack = cut(ridge(-6, 12, 1.5, [[2, 0.35, 0.3], [5, 0.12, 1.1]]), '#c27a86')
    const hillsFront = cut(ridge(-6, 12, 0.75, [[3, 0.22, 2.1], [7, 0.08, 0.4]]), '#3f2d55')
    // wind ribbons (strip planes deformed per frame)
    const ribbons = [0, 1, 2].map(i => {
      const geo = new THREE.PlaneGeometry(4.5, 0.13, 60, 1), m = new THREE.Mesh(geo, paper(['#fff4e0', '#ffd9b0', '#f6c2c8'][i]))
      m.userData.base = geo.attributes.position.array.slice(); m.castShadow = true; return m
    })
    const ribG = new THREE.Group(); ribbons.forEach(r => ribG.add(r))
    const birds = [0, 1, 2, 3, 4].map(i => {
      const g = new THREE.Group(), w1 = cut(rectShape(0, 0, 0.18, 0.035), '#3a2b48', 0.01), w2 = cut(rectShape(-0.18, 0, 0.18, 0.035), '#3a2b48', 0.01)
      g.add(w1, w2); g.userData = { w1, w2 }; return g
    })
    const birdG = new THREE.Group(); birds.forEach(b => birdG.add(b))
    const items = [popItem(hillsBack, -3.6, 0), popItem(farG, -2.8, 0.15), popItem(nearG, -1.8, 0.3), popItem(hillsFront, 0.4, 0.45),
      { node: ribG, mode: 'none' }, { node: birdG, mode: 'none' }]
    return {
      items, update(t) {
        const lit = smooth(8, 26, t) * (1 - smooth(26, 27.5, t)); farG.children[1].material.color.setRGB(1 * lit + 0.25, 0.8 * lit + 0.18, 0.45 * lit + 0.2)
        nearG.children[1].material.color.copy(farG.children[1].material.color)
        const wa = smooth(16.0, 18.0, t) * (1 - smooth(25, 27, t))
        ribbons.forEach((r, i) => {
          const pa = r.geometry.attributes.position, b = r.userData.base
          for (let k = 0; k < pa.count; k++) {
            const x = b[k * 3], u = (x + 2.25) / 4.5
            pa.array[k * 3] = x + (1 - wa) * -7
            pa.array[k * 3 + 1] = b[k * 3 + 1] + Math.sin(u * 7 + t * 2.4 + i * 1.7) * 0.28 * u
            pa.array[k * 3 + 2] = Math.cos(u * 5 + t * 1.8 + i) * 0.35
          }
          pa.needsUpdate = true; r.geometry.computeVertexNormals(); r.position.set(0, 4.3 + i * 0.55, -0.6 + i * 0.3)
        })
        ribG.visible = wa > 0.01
        const bt = t - 21.0; birdG.visible = bt > 0 && bt < 7
        birds.forEach((b, i) => {
          const f = Math.sin(t * 9 + i * 1.3) * 0.6; b.userData.w1.rotation.z = f; b.userData.w2.rotation.z = -f
          b.position.set(-3.2 + bt * (0.85 + hash(i) * 0.3) + i * 0.15, 5.0 + hash(i + 9) * 1.4 + Math.sin(bt * 1.2 + i) * 0.1, -1 - i * 0.3)
        })
      },
    }
  },

  road() {
    const TW = 8
    const backRow = scroller(() => { const s = skyline(37, 0, TW, 1.2, 2.8); const g = new THREE.Group(); g.add(cut(s.shape, '#4b4d86'), windowsGlow(s.outline, '#ffd58a')); return g }, TW)
    const houses = scroller(() => { const s = skyline(41, 0, TW, 0.7, 1.4); const g = new THREE.Group(); g.add(cut(s.shape, '#6f5a8f'), windowsGlow(s.outline, '#ffe0a0')); return g }, TW)
    const lamps = scroller(() => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const l = lamp(1.55); l.position.x = 1 + i * 2; g.add(l) } return g }, TW)
    const street = cut(rectShape(-6, 0, 12, 0.32), '#3b3358'), curb = cut(rectShape(-6, 0.32, 12, 0.05), '#d9c6b8')
    const st = new THREE.Group(); st.add(street, curb)
    const a = figure('a'), b = figure('b'); a.position.set(0.18, 0.37, 0.02); b.position.set(-0.22, 0.37, 0.05)
    const pair = new THREE.Group(); pair.add(a, b); pair.scale.setScalar(1.35)
    const stars = [0, 1, 2, 3, 4].map(i => flyItem(cut(starShape(0.16 + hash(i) * 0.08), '#ffe7a8', 0.03, { emissive: '#ffd36b', emissiveIntensity: 0.5 }),
      -1.6 + i * 0.8, 5.4 + hash(i + 3) * 1.4, -1.5 - hash(i + 5), 4.4 + i * 0.35))
    const items = [popItem(backRow, -3.0, 0), popItem(houses, -2.0, 0.12), popItem(lamps, -1.2, 0.24), popItem(st, 0.3, 0.3), popItem(pair, 0.5, 0.45), ...stars]
    return {
      items, update(t, lt) {
        const walk = lt * 0.55
        backRow.userData.scroll(walk * 0.25); houses.userData.scroll(walk * 0.55); lamps.userData.scroll(walk * 1.0)
        pose(a, lt * 0.9, 1); pose(b, lt * 0.9 + 0.08, 1, 0.3)
        stars.forEach((s, i) => { s.inner.children[0].rotation.y = Math.sin(t * 1.4 + i) * 0.6 })
      },
    }
  },

  hill() {
    const back = cut(ridge(-6, 12, 1.6, [[2, 0.3, 1.5], [6, 0.1, 0.2]]), '#3a3f74')
    const hillS = new THREE.Shape(); hillS.moveTo(-6, 0); hillS.lineTo(-6, 0.5); hillS.bezierCurveTo(-2.5, 0.6, -1.8, 1.55, 0, 1.6); hillS.bezierCurveTo(1.8, 1.55, 2.5, 0.6, 6, 0.45); hillS.lineTo(6, 0); hillS.closePath()
    const hillM = cut(hillS, '#252a52')
    const tr = tree(1.1, '#27344f', '#33456a'); tr.position.set(-1.65, 1.0, 0.03)
    const hillG = new THREE.Group(); hillG.add(hillM, tr)
    const a = figure('a', '#1b1830'), b = figure('b', '#1b1830'); a.position.set(-0.42, 1.58, 0.05); b.position.set(0.42, 1.58, 0.05); b.scale.x = -1
    const pair = new THREE.Group(); pair.add(a, b)
    const ra = rings(4, '#ffe9c7'), rb = rings(4, '#ffd0d6'); ra.position.set(-0.3, 2.6, 0.1); rb.position.set(0.3, 2.6, 0.1); rb.rotation.z = Math.PI
    const heart = cut(heartShape(0.32), '#e2475a', 0.05, { emissive: '#e2475a', emissiveIntensity: 0.25 })
    const hf = flyItem(heart, 0, 3.4, 0.1, 11.6, true)
    const flies = new THREE.Group(); for (let i = 0; i < 26; i++) { const g = glow('#fff3b0', 0.22); flies.add(g) }
    const stars = [0, 1, 2, 3, 4, 5].map(i => flyItem(cut(starShape(0.1 + hash(i * 3) * 0.06), '#f8eecf', 0.02, { emissive: '#f8eecf', emissiveIntensity: 0.4 }),
      -2.2 + i * 0.9 + hash(i) * 0.3, 5.6 + hash(i + 1) * 1.6, -3, 0.2 + i * 0.12))
    const items = [popItem(back, -3.2, 0), ...stars, popItem(hillG, -0.6, 0.15), popItem(pair, 0, 0.3), { node: ra, mode: 'none' }, { node: rb, mode: 'none' }, hf, { node: flies, mode: 'none' }]
    return {
      items, update(t, lt, { beat }) {
        pose(a, 0, 0, 0.25 * smooth(55, 58, t)); pose(b, 0, 0, 0.25 * smooth(55, 58, t))
        const talk = t - 57.0
        ;[ra, rb].forEach((r, k) => {
          r.visible = talk > -0.5 && t < 66
          r.children.forEach((m, i) => {
            const ph = ((talk * 0.55 + i / r.children.length + k * 0.12) % 1 + 1) % 1, s = 0.15 + ph * 0.7
            m.scale.set(s, s, 1); m.position.x = ph * 0.3; m.material.opacity = Math.sin(ph * Math.PI) * 0.9 * smooth(-0.5, 0.5, talk)
          })
        })
        heart.scale.setScalar(1 + beat * 0.12 * smooth(58, 59, t)); heart.rotation.y = Math.sin(t * 0.8) * 0.5
        const fl = smooth(51, 53, t); flies.visible = fl > 0
        flies.children.forEach((g, i) => {
          g.position.set(-2.4 + hash(i) * 4.8 + Math.sin(t * 0.5 + i) * 0.3, 1.8 + hash(i + 7) * 2.4 + Math.sin(t * 0.7 + i * 2) * 0.25, -1.2 + hash(i + 3) * 1.6)
          g.material.opacity = fl * (0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7))
        })
      },
    }
  },

  ocean() {
    const TW = 8, cols = ['#1e3d66', '#2a5585', '#3a6fa3', '#5a92c2', '#8fc0de']
    const waves = cols.map((c, i) => scroller(() => cut(ridge(0, TW, 0.6 + (4 - i) * 0.32, [[2 + i, 0.12, i], [5 + i, 0.05, i * 2]]), c), TW))
    const boat = new THREE.Group(), hull = new THREE.Shape()
    hull.moveTo(-0.6, 0.18); hull.lineTo(0.62, 0.18); hull.lineTo(0.42, -0.08); hull.lineTo(-0.44, -0.08); hull.closePath()
    boat.add(cut(hull, '#e9dccb', 0.06))
    const a = figure('a', '#1b2238'), b = figure('b', '#1b2238'); a.scale.setScalar(0.62); b.scale.setScalar(0.62); a.position.set(-0.2, 0.18, 0.02); b.position.set(0.2, 0.18, 0.02); b.scale.x = -0.62
    boat.add(a, b)
    const notes = new THREE.Group(); for (let i = 0; i < 8; i++) { const n = multi(noteShape(0.07), '#fff1d6', 0.02); notes.add(n) }
    const lantern = cut(heartShape(0.16), '#ff8a7a', 0.04, { emissive: '#ff6a5a', emissiveIntensity: 0.6 }), lg = glow('#ffb38a', 0.9)
    const lan = new THREE.Group(); lan.add(lantern, lg)
    const stars = [0, 1, 2, 3, 4, 5, 6].map(i => flyItem(cut(starShape(0.08 + hash(i * 7) * 0.07), '#f8eecf', 0.02, { emissive: '#f8eecf', emissiveIntensity: 0.4 }),
      -2.4 + i * 0.8, 5.2 + hash(i + 2) * 2, -3.4, 6.5 + i * 0.15))
    const items = [...waves.slice(0, 2).map((w, i) => popItem(w, -3 + i * 0.8, i * 0.1)), popItem(waves[2], -1.4, 0.2), { node: boat, mode: 'none' },
      ...waves.slice(3).map((w, i) => popItem(w, -0.6 + i * 0.7, 0.3 + i * 0.1)), ...stars, { node: notes, mode: 'none' }, { node: lan, mode: 'none' }]
    return {
      items, update(t, lt, { beat }) {
        waves.forEach((w, i) => { w.userData.scroll(t * (0.12 + i * 0.07) * (i % 2 ? -1 : 1)); w.position.y = Math.sin(t * 0.9 + i) * 0.04 })
        const bob = Math.sin(t * 1.1) * 0.06, appear = smooth(66.2, 67.6, t) * (1 - smooth(86.2, 87.2, t))
        boat.visible = appear > 0.01; boat.position.set(0.1, 1.15 + bob - (1 - appear) * 1.2, -1.0); boat.rotation.z = Math.sin(t * 0.9 + 0.5) * 0.06
        const nt = t - 69.5; notes.visible = nt > 0 && t < 80
        notes.children.forEach((n, i) => {
          const ph = ((nt * 0.22 + i / 8) % 1 + 1) % 1
          n.position.set(0.1 + Math.sin(ph * 6 + i) * 0.5 + (hash(i) - 0.5), 2.0 + ph * 3.2, -0.9 + hash(i + 4) * 0.4); n.rotation.z = Math.sin(t + i) * 0.3
          n.scale.setScalar(Math.sin(ph * Math.PI) * 1.2)
        })
        const lt2 = t - 77.0; lan.visible = lt2 > 0 && t < 87
        lan.position.set(0.15 + Math.sin(lt2 * 0.6) * 0.3, 1.7 + lt2 * 0.42, -0.9); lantern.rotation.y = Math.sin(t * 0.7) * 0.6; lg.material.opacity = 0.7 + beat * 0.3
      },
    }
  },

  symph() {
    const wedge = (n, c1, c2) => { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const s = new THREE.Shape(), a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; s.moveTo(0, 0); s.absarc(0, 0, 6, a0, a1, false); s.closePath(); g.add(cut(s, i % 2 ? c1 : c2, 0.01)) } return g }
    const rays = wedge(24, '#6a3a86', '#7d4597'); const rayH = flyItem(rays, 0, 4.2, -4.2, 0, false)
    const ringStack = new THREE.Group(); ['#f6c2d6', '#e58fb5', '#c56aa0', '#9a4e8c'].forEach((c, i) => {
      const s = circleShape(0, 0, 1.6 - i * 0.32); s.holes.push(new THREE.Path().absarc(0, 0, 1.6 - i * 0.32 - 0.1, 0, Math.PI * 2, true)); const m = cut(s, c, 0.03); m.position.z = i * 0.15; ringStack.add(m)
    })
    const ringH = flyItem(ringStack, 0, 3.6, -2.0, 0.2)
    const clock = new THREE.Group(), face = cut(circleShape(0, 0, 0.9), '#f6efe2', 0.04); clock.add(face)
    for (let i = 0; i < 12; i++) { const m = cut(rectShape(-0.02, 0.72, 0.04, 0.12), '#2a2436', 0.01); m.rotation.z = (i / 12) * Math.PI * 2; m.position.z = 0.045; clock.add(m) }
    const hH = cut(rectShape(-0.03, 0, 0.06, 0.45), '#2a2436', 0.01), hM = cut(rectShape(-0.02, 0, 0.04, 0.68), '#e2475a', 0.01); hH.position.z = 0.055; hM.position.z = 0.065; clock.add(hH, hM)
    const clockH = flyItem(clock, -1.35, 5.6, -1.6, 12.0)
    const city = skyline(57, -5, 10, 0.6, 1.6), cityG = new THREE.Group(); cityG.add(cut(city.shape, '#2b2048'), windowsGlow(city.outline, '#ffcf7a'))
    const lamps = new THREE.Group(); for (let i = 0; i < 3; i++) { const l = lamp(1.4); l.position.x = -1.6 + i * 1.6; lamps.add(l) }
    const a = figure('a', '#211a33'), b = figure('b', '#211a33'); a.position.set(-0.24, 0.42, 0.03); b.position.set(0.24, 0.42, 0.05); b.scale.x = -1
    const pair = new THREE.Group(); pair.add(cut(rectShape(-1.1, 0, 2.2, 0.42), '#3a2556', 0.05), a, b); pair.scale.setScalar(1.3)
    const notes = new THREE.Group(); for (let i = 0; i < 14; i++) notes.add(multi(noteShape(0.06 + hash(i) * 0.03), ['#fff1d6', '#ffd0e0', '#ffe39a'][i % 3], 0.02))
    const items = [rayH, ringH, clockH, popItem(cityG, -0.9, 16.4), popItem(lamps, -0.4, 16.6), popItem(pair, 0.4, 0.3), { node: notes, mode: 'none' }]
    return {
      items, update(t, lt, { beat, en }) {
        rays.rotation.z = t * 0.06
        ringStack.children.forEach((m, i) => { const s = 1 + beat * 0.06 * (4 - i) * 0.4; m.scale.set(s, s, 1) })
        hM.rotation.z = -t * 1.2; hH.rotation.z = -t * 0.1
        pose(a, 0, 0, 0.2 + 0.1 * Math.sin(t * 2)); pose(b, 0, 0, 0.2 + 0.1 * Math.sin(t * 2 + 1))
        const dim = 1 - 0.75 * smooth(104, 108, t); cityG.children[1].material.color.setRGB(dim, 0.8 * dim, 0.48 * dim)
        lamps.children.forEach((l, i) => { l.userData.glow.material.opacity = dim * (0.8 + 0.2 * Math.sin(t * 13 + i * 5)) })
        const nt = t - 91.5; notes.visible = nt > 0
        notes.children.forEach((n, i) => {
          const a2 = nt * 0.5 + (i / 14) * Math.PI * 2, r = 1.3 + Math.sin(nt * 0.7 + i) * 0.3
          n.position.set(Math.cos(a2) * r * 1.2, 3.6 + Math.sin(a2) * r, -1.2 + Math.sin(a2) * 0.6); n.rotation.z = Math.sin(t * 1.5 + i) * 0.4
          n.scale.setScalar(smooth(0, 1.5, nt - i * 0.08) * (1 + en * 0.3))
        })
      },
    }
  },

  heart() {
    const sun = new THREE.Group(); for (let i = 0; i < 28; i++) { const s = new THREE.Shape(), a0 = (i / 28) * Math.PI * 2, a1 = ((i + 1) / 28) * Math.PI * 2; s.moveTo(0, 0); s.absarc(0, 0, 7, a0, a1, false); s.closePath(); sun.add(cut(s, i % 2 ? '#ff9a6b' : '#ffb27a', 0.01)) }
    const sunH = flyItem(sun, 0, 3.8, -4.4, 0, false)
    const hearts = new THREE.Group(); ['#ffd3b0', '#ff8a7a', '#e2475a'].forEach((c, i) => { const m = cut(heartShape(1.15 - i * 0.28), c, 0.06, { emissive: c, emissiveIntensity: 0.12 }); m.position.z = i * 0.22; hearts.add(m) })
    const heartH = flyItem(hearts, 0, 3.6, -1.6, 0.3)
    const hills = cut(ridge(-6, 12, 0.9, [[2, 0.25, 0.7], [5, 0.08, 2]]), '#c2445a')
    const a = figure('a', '#3a1e32'), b = figure('b', '#3a1e32'); a.position.set(-0.75, 0.9, 0.05); b.position.set(0.75, 0.9, 0.05); b.scale.x = -1
    const pair = new THREE.Group(); pair.add(a, b)
    const conf = confettiField(320, ['#fff4e0', '#ffd28c', '#e2475a', '#ff8a7a', '#ffffff', '#6a3a86'])
    const bursts = []; for (let k = 0; k < 40; k++) bursts.push(109.6 + k * 2.14) // ≈ every 4 beats
    const items = [sunH, popItem(hills, -0.6, 0.1), heartH, popItem(pair, 0.3, 0.25), { node: conf, mode: 'none' }]
    return {
      items, update(t, lt, { beat, en, audio }) {
        sun.rotation.z = t * (0.05 + 0.1 * smooth(122, 126, t))
        const b2 = audio.pulse(t, 5); hearts.children.forEach((m, i) => { const s = 1 + b2 * 0.07 * (1 + i * 0.4) * (0.6 + en); m.scale.set(s, s, 1) })
        hearts.rotation.y = smooth(122.4, 126, t) * Math.sin((t - 122.4) * 0.5) * 0.9
        pose(a, 0, 0, 0.45 + 0.05 * Math.sin(t * 2)); pose(b, 0, 0, 0.45 + 0.05 * Math.sin(t * 2 + 0.6))
        let idx = 0
        for (let i = 0; i < 320; i++) {
          const k = Math.floor(i / 8), bt = bursts[k % bursts.length], dt = t - bt
          if (dt < 0 || dt > 3.2 || t > 137.5) { dummy.position.set(0, -10, 0); dummy.scale.setScalar(0) } else {
            const ang = hash(i * 3.1) * Math.PI * 2, sp = 1.4 + hash(i * 1.7) * 2.2
            dummy.position.set(Math.cos(ang) * sp * dt * 0.8, 3.6 + Math.sin(ang) * sp * dt * 0.8 - 0.9 * dt * dt + 0.6 * dt, 0.6 + hash(i) * 1.2)
            dummy.rotation.set(dt * 6 * hash(i + 1), dt * 5 * hash(i + 2), dt * 4); dummy.scale.setScalar(1 - smooth(2.4, 3.2, dt))
          }
          dummy.updateMatrix(); conf.setMatrixAt(idx++, dummy.matrix)
        }
        conf.instanceMatrix.needsUpdate = true
      },
    }
  },

  rain() {
    const far = skyline(71, -5, 10, 1.6, 3.4), near = skyline(83, -5, 10, 0.9, 2.0)
    const farG = new THREE.Group(); farG.add(cut(far.shape, '#2b3450'), windowsGlow(far.outline, '#ffcf7a'))
    const nearG = new THREE.Group(); nearG.add(cut(near.shape, '#1f2638'), windowsGlow(near.outline, '#ffd58a'))
    const clouds = [0, 1, 2].map(i => flyItem(cloud(1 + hash(i) * 0.5, ['#5d6a85', '#4b5871', '#6d7a94'][i]), -1.8 + i * 1.8, 6.4 + hash(i + 2) * 0.6, -2.4 + i * 0.4, i * 0.2))
    const lp = lamp(1.7); lp.position.x = 1.05
    const a = figure('a', '#151a28'), b = figure('b', '#151a28'); a.position.set(-0.13, 0, 0.03); b.position.set(0.15, 0, 0.06); b.scale.x = -1
    const umb = new THREE.Group(), canopy = new THREE.Shape(); canopy.moveTo(-0.55, 0); canopy.quadraticCurveTo(0, 0.55, 0.55, 0)
    for (let i = 4; i >= 0; i--) canopy.quadraticCurveTo(-0.55 + (i + 0.5) * 0.22, 0.06, -0.55 + i * 0.22, 0)
    umb.add(cut(canopy, '#e2475a', 0.03), cut(rectShape(-0.012, -0.5, 0.024, 0.5), '#151a28', 0.02)); umb.position.set(0.02, 1.42, 0.08)
    const pair = new THREE.Group(); pair.add(a, b, umb, lp)
    const N = 420, drops = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.012, 0.22), new THREE.MeshBasicMaterial({ color: '#c9d6ec', transparent: true, opacity: 0.65 }), N)
    drops.frustumCulled = false
    const items = [popItem(farG, -2.8, 0), popItem(nearG, -1.6, 0.15), ...clouds, popItem(pair, 0.3, 0.3), { node: drops, mode: 'none' }]
    return {
      items, update(t, lt) {
        const dim = 1 - 0.7 * smooth(156, 161, t); const flick = (i) => dim * (0.85 + 0.15 * Math.sin(t * 17 + i))
        farG.children[1].material.color.setRGB(flick(1), 0.78 * flick(1), 0.45 * flick(1)); nearG.children[1].material.color.setRGB(flick(2), 0.8 * flick(2), 0.5 * flick(2))
        lp.userData.glow.material.opacity = 0.6 + 0.4 * dim
        pose(a, 0, 0, 0.6); pose(b, 0, 0, 0.1); umb.rotation.z = Math.sin(t * 0.8) * 0.04
        const rn = smooth(138.5, 141, t) * (1 - smooth(162.5, 164, t))
        for (let i = 0; i < N; i++) {
          const H = 8, y = 7.5 - ((t * (6 + hash(i) * 2) + hash(i + 1) * H) % H)
          dummy.position.set(-3 + hash(i * 2.3) * 6 + y * 0.04, y, -2.5 + hash(i * 5.1) * 3.4); dummy.rotation.set(0, 0, 0.04); dummy.scale.setScalar(i / N < rn ? 1 : 0)
          dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix)
        }
        drops.instanceMatrix.needsUpdate = true
      },
    }
  },

  dawn() {
    const back = cut(ridge(-6, 12, 1.7, [[2, 0.3, 2.2], [5, 0.1, 0.6]]), '#e7a0a0'), mid = cut(ridge(-6, 12, 1.2, [[3, 0.25, 0.4], [6, 0.08, 1.9]]), '#d37c8a')
    const hillS = new THREE.Shape(); hillS.moveTo(-6, 0); hillS.lineTo(-6, 0.4); hillS.bezierCurveTo(-2.5, 0.5, -1.6, 1.15, 0, 1.2); hillS.bezierCurveTo(1.6, 1.15, 2.5, 0.5, 6, 0.38); hillS.lineTo(6, 0); hillS.closePath()
    const front = cut(hillS, '#8f4d6a')
    const flowers = new THREE.Group(); for (let i = 0; i < 9; i++) {
      const f = new THREE.Group(), x = -2.2 + i * 0.55 + (hash(i) - 0.5) * 0.2, h = 0.3 + hash(i + 3) * 0.25
      f.add(cut(rectShape(-0.012, 0, 0.024, h), '#4a6a4a', 0.01)); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; f.add(cut(circleShape(Math.cos(a) * 0.05, h + Math.sin(a) * 0.05, 0.045), ['#fff4e0', '#ffd0d6', '#ffe39a'][i % 3], 0.01)) }
      f.add(cut(circleShape(0, h, 0.03), '#e2475a', 0.015)); f.position.set(x, 0, 0); f.userData.base = x; flowers.add(f)
    }
    const a = figure('a', '#4a2a44'), b = figure('b', '#4a2a44'); a.position.set(-0.36, 1.18, 0.05); b.position.set(0.36, 1.18, 0.05); b.scale.x = -1
    const pair = new THREE.Group(); pair.add(a, b)
    const ra = rings(4, '#fff4e0'), rb = rings(4, '#fff4e0'); ra.position.set(-0.25, 2.2, 0.1); rb.position.set(0.25, 2.2, 0.1); rb.rotation.z = Math.PI
    const heart = cut(heartShape(0.28), '#e2475a', 0.05, { emissive: '#e2475a', emissiveIntensity: 0.2 }); const hf = flyItem(heart, 0, 3.0, 0.1, 9.0)
    const birds = [0, 1, 2, 3, 4, 5, 6].map(i => { const g = new THREE.Group(), w1 = cut(rectShape(0, 0, 0.16, 0.03), '#5a3550', 0.01), w2 = cut(rectShape(-0.16, 0, 0.16, 0.03), '#5a3550', 0.01); g.add(w1, w2); g.userData = { w1, w2 }; return g })
    const birdG = new THREE.Group(); birds.forEach(b2 => birdG.add(b2))
    const items = [popItem(back, -3.2, 0), popItem(mid, -2.2, 0.1), popItem(front, -0.4, 0.2), popItem(flowers, 0.5, 0.35), popItem(pair, -0.3, 0.3),
      { node: ra, mode: 'none' }, { node: rb, mode: 'none' }, hf, { node: birdG, mode: 'none' }]
    return {
      items, update(t, lt, { beat }) {
        flowers.children.forEach((f, i) => { const p = pop((t - 164.2 - i * 0.18) / 1.0); f.scale.setScalar(Math.max(0.001, p)); f.rotation.z = Math.sin(t * 1.2 + i) * 0.05 })
        pose(a, 0, 0, 0.25 * smooth(171, 173, t)); pose(b, 0, 0, 0.25 * smooth(171, 173, t))
        const talk = t - 172.0
        ;[ra, rb].forEach((r, k) => {
          r.visible = talk > -0.5 && t < 190.5
          r.children.forEach((m, i) => { const ph = ((talk * 0.55 + i / 4 + k * 0.12) % 1 + 1) % 1, s = 0.15 + ph * 0.7; m.scale.set(s, s, 1); m.position.x = ph * 0.3; m.material.opacity = Math.sin(ph * Math.PI) * 0.9 * smooth(-0.5, 0.5, talk) })
        })
        heart.scale.setScalar(1 + beat * 0.15); heart.rotation.y = Math.sin(t * 0.8) * 0.5
        const bt = t - 179; birdG.visible = bt > 0 && bt < 12
        birds.forEach((b2, i) => { const f = Math.sin(t * 9 + i * 1.3) * 0.6; b2.userData.w1.rotation.z = f; b2.userData.w2.rotation.z = -f; b2.position.set(-3.4 + bt * (0.55 + hash(i) * 0.25) + (i % 3) * 0.3, 6.3 + hash(i + 9) * 1.2 + Math.sin(bt + i) * 0.12, -1.2 - i * 0.2) })
      },
    }
  },

  outro() {
    const far = skyline(91, -5, 10, 1.4, 3.0), near = skyline(97, -5, 10, 0.8, 2.0)
    const farG = new THREE.Group(); farG.add(cut(far.shape, '#7d5a8c'), windowsGlow(far.outline))
    const nearG = new THREE.Group(); nearG.add(cut(near.shape, '#5b3f6e'), windowsGlow(near.outline))
    const hills = cut(ridge(-6, 12, 0.7, [[3, 0.2, 1.1], [7, 0.07, 0.4]]), '#3f2d55')
    const a = figure('a', '#2a1e38'), b = figure('b', '#2a1e38'); a.position.set(0.2, 0.62, 0.03); b.position.set(-0.2, 0.62, 0.05)
    const pair = new THREE.Group(); pair.add(a, b)
    const items = [popItem(farG, -2.8, 0), popItem(nearG, -1.8, 0.15), popItem(hills, 0.3, 0.3), popItem(pair, 0.4, 0.45)]
    // fold-down ending: front-to-back, each layer slowly falls flat (book closing)
    return {
      items, update(t, lt) {
        const lit = 0.3 + 0.7 * smooth(195, 210, t); farG.children[1].material.color.setRGB(lit, 0.8 * lit, 0.45 * lit); nearG.children[1].material.color.copy(farG.children[1].material.color)
        const walk = clamp((t - 195) / 14), w = smooth(195, 196, t) * (1 - smooth(208, 209, t))
        a.position.x = 0.2 + walk * 1.8; b.position.x = -0.2 + walk * 1.8; pose(a, (t - 195) * 0.9, w); pose(b, (t - 195) * 0.9 + 0.1, w, 0.3)
        items.slice().reverse().forEach((it, i) => { const f = smooth(0, 1.6, t - 211.5 - i * 0.6); if (f > 0) it.node.rotation.x = -(Math.PI / 2) * f })
      },
    }
  },
}
