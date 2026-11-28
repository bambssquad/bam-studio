// adighanilham — viewer 3D model analitik reklame (three.js)
// Koordinat mesin (x, y, z-atas) -> three (x, z, -y)
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const GROUP_COL = { COL: "#121212", POST: "#121212", ARM: "#e0261b", RAIL: "#5d5a54", STUD: "#9a968e", KICK: "#c7671f", STRUT: "#c7671f", BRACE: "#b9b5ad" };
const C0 = new THREE.Color("#d9d6cf"), C1 = new THREE.Color("#7a776f"), C2 = new THREE.Color("#e0261b");
export function ratioColor(r) {
  const t = Math.max(0, Math.min(1, r / 0.95));
  return t < .5 ? C0.clone().lerp(C1, t / .5) : C1.clone().lerp(C2, (t - .5) / .5);
}
const V = a => new THREE.Vector3(a[0], a[2], -a[1]);

export function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch { return false; }
}

export function mount(host, d, opt = {}) {
  host.classList.add("viewer");
  host.innerHTML = "";
  if (!hasWebGL()) {
    host.innerHTML = `<div class="vfail">Peramban ini tidak mendukung WebGL, jadi model 3D tidak bisa tampil.<br>Gambar kerja PDF dan IFC tetap bisa diunduh di bawah.</div>`;
    return { dispose() {} };
  }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false }); }
  catch (e) { host.innerHTML = `<div class="vfail">WebGL gagal dimulai (${e.message}).</div>`; return { dispose() {} }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, .1, 500);
  scene.add(new THREE.HemisphereLight("#ffffff", "#bdb8ae", 1.6));
  const sun = new THREE.DirectionalLight("#ffffff", 2.2);
  sun.position.set(-14, 26, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 22, bottom: -6, near: 1, far: 80 });
  scene.add(sun);

  const isRoof = d.typ === "rooftop";
  const gz = isRoof ? d.z0 : 0;

  // ---------- batang ----------
  const members = new THREE.Group(); scene.add(members);
  const meshes = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const m of d.members) {
    const s = d.sections[m.g]; if (!s) continue;
    const a = V(d.nodes[m.i]), b = V(d.nodes[m.j]);
    const ax = b.clone().sub(a), L = ax.length(); if (L < 1e-6) continue;
    ax.normalize();
    let geo;
    if (s.kind === "CHS") {
      geo = new THREE.CylinderGeometry(s.dims[0] / 2000, s.dims[0] / 2000, L, 20, 1);
    } else {
      // RHS: h searah vy, b searah sumbu ke-3, panjang searah sumbu batang (lokal y three)
      geo = new THREE.BoxGeometry(s.dims[1] / 1000, L, s.dims[0] / 1000);
    }
    const mat = new THREE.MeshStandardMaterial({ color: ratioColor(m.ratio), roughness: .55, metalness: .25 });
    const mesh = new THREE.Mesh(geo, mat);
    // orientasi: lokal y -> sumbu batang; lokal z -> vy
    const vy = V(m.vy || [0, 1, 0]).normalize();
    let z = vy.clone().sub(ax.clone().multiplyScalar(vy.dot(ax)));
    if (z.lengthSq() < 1e-6) z = Math.abs(ax.y) < .9 ? up.clone().cross(ax) : new THREE.Vector3(1, 0, 0).cross(ax);
    z.normalize();
    const x = ax.clone().cross(z).normalize();
    mesh.matrix.makeBasis(x, ax, z).setPosition(a.clone().add(b).multiplyScalar(.5));
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = m;
    members.add(mesh); meshes.push(mesh);
  }

  // ---------- panel reklame ----------
  const panelG = new THREE.Group(); scene.add(panelG);
  {
    const studY = d.yb ?? Math.min(...d.nodes.map(n => n[1]));
    const face = new THREE.Mesh(new THREE.BoxGeometry(d.B, d.S, .04),
      new THREE.MeshStandardMaterial({ color: "#f7f6f2", roughness: .9 }));
    face.position.copy(V([0, studY - .12, (d.zb + d.zt) / 2]));
    face.castShadow = true; face.receiveShadow = true;
    panelG.add(face);
    // grafis papan: blok merah + label
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = Math.round(1024 * d.S / d.B);
    const g = cv.getContext("2d");
    g.fillStyle = "#f7f6f2"; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#e0261b"; g.fillRect(0, cv.height * .62, cv.width, cv.height * .38);
    g.fillStyle = "#121212"; g.font = `600 ${cv.height * .26}px Inter Tight, Arial`; g.textBaseline = "alphabetic";
    g.fillText("adighanilham", cv.width * .05, cv.height * .5);
    g.fillStyle = "#fff"; g.font = `${cv.height * .1}px JetBrains Mono, monospace`;
    g.fillText(`${({unipole:"UNIPOLE",doublepole:"DOUBLE POLE",rooftop:"ROOFTOP"})[d.typ]} ${d.S}×${d.B} M · STUDI`, cv.width * .05, cv.height * .86);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(d.B, d.S), new THREE.MeshStandardMaterial({ map: tex, roughness: .8 }));
    art.position.copy(face.position); art.position.z += .021;
    panelG.add(art);
  }

  // ---------- pondasi / atap ----------
  const sup = Object.keys(d.supports).map(Number).map(i => d.nodes[i]);
  const cx = sup.reduce((s, n) => s + n[0], 0) / sup.length, cy = sup.reduce((s, n) => s + n[1], 0) / sup.length;
  const conc = new THREE.MeshStandardMaterial({ color: "#c9c5bc", roughness: 1 });
  if (isRoof) {
    const xs = d.nodes.map(n => n[0]), ys = d.nodes.map(n => n[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 4, l = Math.max(...ys) - Math.min(...ys) + 5;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, .2, l), conc);
    slab.position.copy(V([cx, cy, gz - .1])); slab.receiveShadow = true; scene.add(slab);
    const bld = new THREE.Mesh(new THREE.BoxGeometry(w, gz - .2, l),
      new THREE.MeshStandardMaterial({ color: "#e7e4dd", roughness: 1, transparent: true, opacity: .35 }));
    bld.position.copy(V([cx, cy, (gz - .2) / 2])); scene.add(bld);
    const ed = new THREE.LineSegments(new THREE.EdgesGeometry(bld.geometry), new THREE.LineBasicMaterial({ color: "#a8a49b" }));
    ed.position.copy(bld.position); scene.add(ed);
  } else if (d.footing) {
    const f = d.footing;
    const ft = new THREE.Mesh(new THREE.BoxGeometry(f.Lx, f.Hf, f.Ly), conc);
    ft.position.copy(V([cx, cy, -f.Df + f.Hf / 2])); scene.add(ft);
    for (const n of sup) {
      const h = f.Df - f.Hf + .2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(f.bp, h, f.bp), conc);
      p.position.copy(V([n[0], n[1], -f.Df + f.Hf + h / 2])); p.castShadow = true; scene.add(p);
    }
  }
  // tanah transparan + grid
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .18 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = gz + (isRoof ? 0 : 0.001); ground.receiveShadow = true; scene.add(ground);
  if (!isRoof) {
    const grid = new THREE.GridHelper(40, 40, "#c9c5bc", "#dedbd4"); grid.position.y = .002;
    grid.material.transparent = true; grid.material.opacity = .45; scene.add(grid);
    // galian dipotong: tampilkan tanah sebagai bidang tembus pandang
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: "#d8d4cb", transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }));
    soil.rotation.x = -Math.PI / 2; scene.add(soil);
  }
  // figur skala 1,7 m
  {
    const man = new THREE.Mesh(new THREE.CapsuleGeometry(.2, 1.3, 4, 8), new THREE.MeshStandardMaterial({ color: "#121212" }));
    man.position.copy(V([d.B / 2 + 1.5, cy - 2, gz + .85])); man.castShadow = true; scene.add(man);
  }

  // ---------- kamera ----------
  const box = new THREE.Box3().setFromObject(members).union(new THREE.Box3().setFromObject(panelG));
  const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const rad = Math.max(size.x, size.y, size.z) * .9;
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.target.copy(ctr); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * .52;
  const home = () => { cam.position.set(ctr.x + rad * 1.6, ctr.y + rad * .5, ctr.z - rad * 1.5); ctl.target.copy(ctr); ctl.update(); };
  home();
  ctl.autoRotate = !!opt.autoRotate; ctl.autoRotateSpeed = .6;
  ctl.addEventListener("start", () => ctl.autoRotate = false);

  // ---------- HUD ----------
  const hud = document.createElement("div"); hud.className = "vhud";
  hud.innerHTML = `<div class="seg" data-k="mode"><button data-v="ratio" class="on">Rasio</button><button data-v="group">Grup</button></div>
    <div class="seg" data-k="panel"><button data-v="1" class="on">Panel</button><button data-v="0">Rangka</button></div>
    <div class="seg"><button data-v="home">Reset</button></div>`;
  host.append(hud);
  const tip = document.createElement("div"); tip.className = "vtip"; host.append(tip);
  const leg = document.createElement("div"); leg.className = "vleg"; host.append(leg);
  const note = document.createElement("div"); note.className = "vnote";
  note.textContent = "Model analitik · warna = rasio kapasitas LRFD maksimum"; host.append(note);
  const groups = [...new Set(d.members.map(m => m.g))];
  function legend(mode) {
    leg.innerHTML = mode === "ratio"
      ? `<div class="row"><span>RASIO</span><span>maks ${Math.max(...d.members.map(m => m.ratio)).toFixed(2)}</span></div><div class="grad"></div><div class="row"><span>0</span><span>0,5</span><span>0,95</span></div>`
      : groups.map(g => `<div class="gl"><i style="background:${GROUP_COL[g] || "#888"}"></i>${g} · ${d.sections[g].name}</div>`).join("");
  }
  function setMode(mode) {
    for (const ms of meshes) ms.material.color.set(mode === "ratio" ? ratioColor(ms.userData.ratio) : (GROUP_COL[ms.userData.g] || "#888"));
    legend(mode);
  }
  legend("ratio");
  hud.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const seg = b.parentElement, k = seg.dataset.k;
    if (b.dataset.v === "home") { home(); return; }
    seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    if (k === "mode") setMode(b.dataset.v);
    if (k === "panel") panelG.visible = b.dataset.v === "1";
  });

  // ---------- hover ----------
  const ray = new THREE.Raycaster(), mp = new THREE.Vector2(); let hot = null;
  function onMove(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mp.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mp, cam);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hot && (!hit || hit.object !== hot)) { hot.material.emissive.set(0); hot = null; }
    if (hit) {
      hot = hit.object; hot.material.emissive.set("#3a0805");
      const m = hot.userData, s = d.sections[m.g];
      tip.innerHTML = `${m.g} · ${s.name}<br>L ${m.L.toFixed(2)} m · rasio <b>${m.ratio.toFixed(2)}</b> (${m.combo})<br>N ${m.N.toFixed(1)} kN · M ${m.M.toFixed(1)} kNm`;
      tip.style.display = "block";
      tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 230) + "px";
      tip.style.top = (e.clientY - r.top + 14) + "px";
    } else tip.style.display = "none";
  }
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerleave", () => { tip.style.display = "none"; if (hot) { hot.material.emissive.set(0); hot = null; } });

  // ---------- loop ----------
  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  });
  ro.observe(host);
  let raf, alive = true;
  const io = new IntersectionObserver(es => { alive = es[0].isIntersecting; });
  io.observe(host);
  (function loop() { raf = requestAnimationFrame(loop); if (!alive) return; ctl.update(); renderer.render(scene, cam); })();

  return {
    setMode, home,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); ctl.dispose();
      scene.traverse(o => { o.geometry?.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose(); x.dispose(); }); });
      renderer.dispose(); renderer.forceContextLoss?.(); host.innerHTML = "";
    }
  };
}
