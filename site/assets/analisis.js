// adighanilham — jendela analisis ala SAP2000: kiri model + beban, kanan hasil.
// Koordinat mesin (x, y, z-atas) -> three (x, z, -y). Angin & gempa mendorong ke +y mesin.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { hasWebGL } from "./viewer.js";

import { band, NAMA } from "./rasio.js";
const GROUP_LINE = { COL: "#1f3b73", POST: "#1f3b73", ARM: "#b0306a", RAIL: "#2f6fb5", STUD: "#3f8f8f", KICK: "#7a4fb0", STRUT: "#7a4fb0", BRACE: "#8a7f2a" };
const V = a => new THREE.Vector3(a[0], a[2], -a[1]);

export function mountSap(root, d, onStep) {
  const [pL, pR] = root.querySelectorAll(".sap-pane");
  if (!hasWebGL()) return null;

  const isRoof = d.typ === "rooftop", gz = isRoof ? d.z0 : 0;
  const zTop = Math.max(...d.nodes.map(n => n[2])), H = zTop - gz;
  const dDesign = d.defl.dmax / 1000;
  const EXAG = Math.max(1, Math.round(Math.min(40, 0.12 * H / Math.max(dDesign, 1e-3))));
  const shape = z => { const s = Math.max(0, Math.min(1, (z - gz) / H)); return s * s * (3 - s) / 2; };
  const studY = d.yb ?? Math.min(...d.nodes.map(n => n[1]));
  const xs = d.nodes.map(n => n[0]), ys = d.nodes.map(n => n[1]);
  const xc = (Math.max(...xs) + Math.min(...xs)) / 2;

  const mk = pane => {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setClearColor("#ffffff");
    pane.append(r.domElement); return r;
  };
  const rL = mk(pL), rR = mk(pR);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 500);
  const sL = new THREE.Scene(), sR = new THREE.Scene();
  sR.add(new THREE.HemisphereLight("#ffffff", "#c7ccd2", 1.7));
  const sun = new THREE.DirectionalLight("#ffffff", 1.9); sun.position.set(-12, 24, 16); sR.add(sun);

  // ================= kiri: garis model, tumpuan, beban =================
  const pos = [], col = [];
  for (const m of d.members) {
    const a = V(d.nodes[m.i]), b = V(d.nodes[m.j]), c = new THREE.Color(GROUP_LINE[m.g] || "#1f2a36");
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  lg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  sL.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true })));
  sL.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(d.nodes.map(V)), new THREE.PointsMaterial({ color: "#1f2a36", size: 4, sizeAttenuation: false })));
  const supMat = new THREE.MeshBasicMaterial({ color: "#1f9e3a" });
  for (const [k, t] of Object.entries(d.supports)) {
    const p = V(d.nodes[+k]);
    const g = t === "fixed" ? new THREE.BoxGeometry(.7, .18, .7) : new THREE.ConeGeometry(.22, .35, 4);
    const s = new THREE.Mesh(g, supMat); s.position.copy(p); s.position.y -= t === "fixed" ? .09 : .18; sL.add(s);
  }
  // bidang tekanan angin + panah (panjang mengikuti tekanan)
  const loadG = new THREE.Group(); sL.add(loadG);
  const area = new THREE.Mesh(new THREE.PlaneGeometry(d.B, d.S), new THREE.MeshBasicMaterial({ color: "#d63fd6", transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }));
  area.position.copy(V([0, studY - .12, (d.zb + d.zt) / 2])); loadG.add(area);
  const arrows = [];
  const nx = Math.max(3, Math.round(d.B / 2)), nz = Math.max(2, Math.round(d.S / 2));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -d.B / 2 + d.B * (i + .5) / nx, z = d.zb + d.S * (j + .5) / nz;
    const tip = V([x, studY - .15, z]);
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), tip, 1.75, 0xb51fb5, .35, .22);
    a.userData.tip = tip; loadG.add(a); arrows.push(a);
  }
  const setArrows = k => {
    const L = Math.max(.5, Math.min(5, 1.75 * k));
    for (const a of arrows) { a.position.copy(a.userData.tip).add(new THREE.Vector3(0, 0, L)); a.setLength(L, Math.min(.5, .2 * L + .15), Math.min(.32, .12 * L + .1)); }
  };
  setArrows(1);
  // aliran angin: partikel bergerak ke arah papan
  const NP = 520, wp = new Float32Array(NP * 3), wSeed = new Float32Array(NP);
  const yFar = studY - 9, yNear = studY - .3;
  for (let i = 0; i < NP; i++) {
    wp[i * 3] = -d.B / 2 - 1.5 + Math.random() * (d.B + 3);
    wp[i * 3 + 1] = d.zb - 1.2 + Math.random() * (d.S + 2.4);
    wSeed[i] = Math.random();
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.BufferAttribute(wp, 3));
  const wind = new THREE.Points(wg, new THREE.PointsMaterial({ color: "#7d8fa6", size: 2.5, sizeAttenuation: false, transparent: true, opacity: .8 }));
  sL.add(wind);
  let windSpeed = 1; // relatif terhadap V rencana
  const stepWind = dt => {
    const span = yNear - yFar;
    for (let i = 0; i < NP; i++) {
      wSeed[i] = (wSeed[i] + dt * .00028 * windSpeed * (0.8 + .4 * (i % 7) / 7)) % 1;
      const y = yFar + span * wSeed[i];
      wp[i * 3 + 2] = -y;
    }
    wg.attributes.position.needsUpdate = true;
  };
  // gaya gempa: panah horizontal di titik-titik bermassa
  const quakeG = new THREE.Group(); quakeG.visible = false; sL.add(quakeG);
  d.nodes.filter(n => n[2] > gz + .2).filter((_, i, a) => i % Math.ceil(a.length / 16) === 0).forEach(n => {
    const p = V(n); quakeG.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), p.clone().add(new THREE.Vector3(0, 0, .9)), .9, 0xe0261b, .25, .16));
  });
  // berat sendiri
  const gravG = new THREE.Group(); sL.add(gravG);
  for (const n of d.nodes.filter(n => Math.abs(n[2] - d.zt) < .01).slice(0, 8)) {
    const p = V(n); gravG.add(new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), p.clone().add(new THREE.Vector3(0, 1.2, 0)), 1.1, 0x3a3a3a, .25, .16));
  }
  const gl = new THREE.GridHelper(30, 30, "#c9ced4", "#e6e9ec"); gl.position.y = gz; sL.add(gl);

  // ================= kanan: batang ekstrusi berwarna rasio =================
  const pivot = new THREE.Group(), rig = new THREE.Group(); pivot.add(rig); sR.add(pivot);
  const meshes = [];
  for (const m of d.members) {
    const s = d.sections[m.g]; if (!s) continue;
    if (V(d.nodes[m.i]).distanceTo(V(d.nodes[m.j])) < 1e-6) continue;
    const geo = s.kind === "CHS" ? new THREE.CylinderGeometry(s.dims[0] / 2000, s.dims[0] / 2000, 1, 18) : new THREE.BoxGeometry(s.dims[1] / 1000, 1, s.dims[0] / 1000);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: band(m.ratio).c, roughness: .5, metalness: .1 }));
    mesh.matrixAutoUpdate = false; mesh.userData = { m, k: d.members.indexOf(m) }; rig.add(mesh); meshes.push(mesh);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(d.B, d.S, .04), new THREE.MeshStandardMaterial({ color: "#eef0f2", transparent: true, opacity: .55 }));
  rig.add(panel);
  const gr = new THREE.GridHelper(30, 30, "#c9ced4", "#e6e9ec"); gr.position.y = gz; sR.add(gr);
  const concrete = new THREE.MeshStandardMaterial({ color: "#bdb8ae", roughness: .9 });
  let tiltAxisZ = 0;
  if (isRoof) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(Math.max(...xs) - Math.min(...xs) + 4, .2, Math.max(...ys) - Math.min(...ys) + 5), new THREE.MeshStandardMaterial({ color: "#d5d2cb" }));
    slab.position.set(xc, gz - .1, -(Math.max(...ys) + Math.min(...ys)) / 2); sR.add(slab);
  } else if (d.footing) {
    const f = d.footing, yb0 = d.nodes[+Object.keys(d.supports)[0]][1];
    const ft = new THREE.Mesh(new THREE.BoxGeometry(f.Lx, f.Hf, f.Ly), concrete);
    ft.position.set(xc, -f.Df + f.Hf / 2, -yb0); rig.add(ft);
    for (const k of Object.keys(d.supports)) {
      const n = d.nodes[+k], h = f.Df - f.Hf + .3;
      const pd = new THREE.Mesh(new THREE.BoxGeometry(f.bp, h, f.bp), concrete);
      pd.position.set(n[0], -f.Df + f.Hf + h / 2, -n[1]); rig.add(pd);
    }
    // sumbu guling: tepi hilir pondasi (angin ke +y mesin = -z three)
    tiltAxisZ = -(yb0 + f.Ly / 2);
    pivot.position.set(0, -f.Df, tiltAxisZ); rig.position.set(0, f.Df, -tiltAxisZ);
  }
  const ghost = new THREE.LineSegments(lg.clone(), new THREE.LineBasicMaterial({ color: "#9aa3ad", transparent: true, opacity: .7 }));
  ghost.geometry.deleteAttribute("color"); ghost.visible = false; sR.add(ghost);

  const up = new THREE.Vector3(0, 1, 0), tA = new THREE.Vector3(), tB = new THREE.Vector3();
  let gShift = 0;
  const nodeAt = (i, dy) => { const n = d.nodes[i]; return V([n[0], n[1] + gShift + dy * shape(n[2]), n[2]]); };
  function place(dy) {
    for (const ms of meshes) {
      const m = ms.userData.m, a = nodeAt(m.i, dy), b = nodeAt(m.j, dy);
      const ax = tA.copy(b).sub(a); const L = ax.length(); ax.normalize();
      const vy = V(m.vy || [0, 1, 0]).normalize();
      let z = vy.clone().sub(ax.clone().multiplyScalar(vy.dot(ax)));
      if (z.lengthSq() < 1e-6) z = Math.abs(ax.y) < .9 ? up.clone().cross(ax) : new THREE.Vector3(1, 0, 0).cross(ax);
      z.normalize(); const x = tB.copy(ax).cross(z).normalize();
      ms.matrix.makeBasis(x, ax, z).scale(new THREE.Vector3(1, L, 1)).setPosition(a.clone().add(b).multiplyScalar(.5));
      ms.matrixWorldNeedsUpdate = true;
    }
    panel.position.copy(V([0, studY - .12 + gShift + dy * shape((d.zb + d.zt) / 2), (d.zb + d.zt) / 2]));
  }
  place(0);
  const paint = rs => meshes.forEach(ms => ms.material.color.set(band(rs ? rs[ms.userData.k] : ms.userData.m.ratio).c));

  // ================= kamera bersama =================
  const box = new THREE.Box3().setFromPoints(d.nodes.map(V));
  const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const rad = Math.max(size.x, size.y, size.z) * .95;
  const cL = new OrbitControls(cam, rL.domElement), cR = new OrbitControls(cam, rR.domElement);
  for (const c of [cL, cR]) { c.target.copy(ctr); c.enableDamping = true; c.maxPolarAngle = Math.PI * .55; }
  const home = () => { cam.position.set(ctr.x + rad * 1.5, ctr.y + rad * .55, ctr.z + rad * 1.55); cL.target.copy(ctr); cR.target.copy(ctr); cam.lookAt(ctr); };
  home();

  // ================= tooltip awam =================
  const tip = document.createElement("div"); tip.className = "sap-tip"; pR.append(tip);
  const ray = new THREE.Raycaster(), mp = new THREE.Vector2(); let hot = null, curR = null, curLabel = "kombinasi beban rencana";
  rR.domElement.addEventListener("pointermove", e => {
    const rc = rR.domElement.getBoundingClientRect();
    mp.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(mp, cam);
    const h = ray.intersectObjects(meshes, false)[0];
    if (hot && (!h || h.object !== hot)) { hot.material.emissive.set(0); hot = null; }
    if (!h || step === "beban") { tip.style.display = "none"; return; }
    hot = h.object; hot.material.emissive.set("#333");
    const { m, k } = hot.userData, r = curR ? curR[k] : m.ratio, b = band(r);
    tip.innerHTML = `${NAMA[m.g] || m.g} · ${d.sections[m.g].name}<br>Terpakai <b>${Math.round(r * 100)}%</b> dari kekuatannya (${b.t}).<br>${curR ? curLabel : `Paling berat saat kombinasi ${m.combo}.`}`;
    tip.style.display = "block";
    tip.style.left = Math.min(e.clientX - rc.left + 14, rc.width - 270) + "px"; tip.style.top = (e.clientY - rc.top + 14) + "px";
  });
  rR.domElement.addEventListener("pointerleave", () => { tip.style.display = "none"; if (hot) { hot.material.emissive.set(0); hot = null; } });

  // ================= langkah & skenario =================
  let step = "rasio", t0 = performance.now(), scen = null, tilt = 0;
  const tabR = pR.querySelector(".tab"), leg = root.querySelector(".sap-leg");
  function setStep(s) {
    step = s; t0 = performance.now();
    const quake = s === "skenario" && scen && scen.quake;
    loadG.visible = s === "beban" || s === "rasio" || (s === "skenario" && !quake);
    wind.visible = loadG.visible; quakeG.visible = quake; gravG.visible = s === "beban";
    ghost.visible = s === "lendutan" || s === "skenario";
    curR = s === "skenario" && scen ? scen.r : null;
    if (s === "beban") meshes.forEach(ms => ms.material.color.set("#c3c8ce")); else paint(curR);
    setArrows(s === "skenario" && scen && !quake ? scen.k : 1); windSpeed = s === "skenario" && scen && !quake ? Math.sqrt(scen.k) : 1;
    if (s !== "lendutan" && s !== "skenario") { gShift = 0; place(0); pivot.rotation.x = 0; }
    tabR.textContent = s === "beban" ? "Bentuk 3D" : s === "lendutan" ? `Bentuk melendut (dibesarkan ×${EXAG})` : s === "skenario" ? `${scen ? scen.label : "Skenario"} · lendutan ×${EXAG}` : "Rasio kapasitas baja";
    leg.style.display = s === "beban" ? "none" : "block";
    onStep && onStep(s);
  }
  // sc: {label, k (skala tekanan angin), r[], dmax mm, quake, tilt (0..1)}
  function setScenario(sc) {
    scen = sc; curLabel = sc.label;
    tilt = sc.tilt || 0;
    if (step !== "skenario") setStep("skenario"); else setStep("skenario");
  }

  // ================= loop =================
  const fit = () => {
    const w = pL.clientWidth, h = pL.clientHeight; if (!w || !h) return;
    rL.setSize(w, h, false); rR.setSize(pR.clientWidth, pR.clientHeight, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit); ro.observe(pL); ro.observe(pR);
  let vis = true; const io = new IntersectionObserver(es => vis = es.some(e => e.isIntersecting)); io.observe(root);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf, last = performance.now();
  (function loop(now) {
    raf = requestAnimationFrame(loop); if (!vis) { last = now; return; }
    const dt = Math.min(64, now - last); last = now; const t = (now - t0) / 1000;
    if (wind.visible && !still) stepWind(dt);
    if (step === "lendutan") place(EXAG * dDesign * (still ? 1 : .5 - .5 * Math.cos(t * 1.4)));
    else if (step === "skenario" && scen) {
      const dm = scen.dmax / 1000 * EXAG;
      if (scen.quake) { gShift = still ? 0 : .22 * Math.sin(t * 9) * Math.max(0, Math.sin(t * .9)); place(still ? dm : dm * Math.sin(t * 9 - .8)); }
      else { gShift = 0; place(still ? dm : dm * (.82 + .18 * Math.sin(t * 2.3) * Math.sin(t * .7))); }
      pivot.rotation.x = -tilt * (Math.PI / 30) * (still ? 1 : .5 - .5 * Math.cos(Math.min(t, 3) * Math.PI / 3));
    }
    cL.update(); cR.update(); rL.render(sL, cam); rR.render(sR, cam);
  })(performance.now());

  setStep("rasio");
  return {
    setStep, setScenario, home, EXAG,
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); cL.dispose(); cR.dispose(); rL.dispose(); rR.dispose(); }
  };
}
