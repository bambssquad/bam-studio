// Van Gogh kit for the "Studio Bam" film (1080×1920). Loaded via SCENE_LIBS after studio_lib.js.
(() => {
  const { W, H } = SL, TAU = Math.PI * 2, P = PAINT;
  const VG = window.VG = {};
  const C = VG.C = { sky: ['#1d3b8f', '#2a55b8', '#3f6fd0', '#16307a', '#5b87e0', '#8fb0ec'], skyLt: ['#c9d9f2', '#f2e7a6', '#9fbbe8'],
    hill: ['#2f5a3a', '#3e7a46', '#24472f', '#5a8f4a'], wheat: ['#e8b93a', '#d99a2b', '#f2d266', '#b9792a'],
    wall: ['#f0e3c0', '#e6cf96', '#f7efd6', '#d8bf84'], roof: ['#c2512c', '#a9411f', '#d9703c'], win: '#f7d64a',
    coat: ['#2b4fa8', '#1f3d8a', '#3e66c4'], skin: ['#e9b98c', '#d9a073', '#f0c9a0'], beard: ['#d8662a', '#e98a34', '#b84e1e'],
    hat: ['#e9c54a', '#d6aa2c', '#f3da7a'], paper: ['#f4ead2', '#ece0c2', '#f8f1df'], wood: ['#8a4a22', '#a35a2a', '#6e3a1a', '#c0743a'], ink: '#1a2a5c' };

  // ---- sky: seeded strokes advected around swirl centres (motif: swirl curls) ----
  const angFn = (SW) => (x, y) => { let a = Math.sin(y / 90 + x / 260) * 0.35, ws = 0, tx = 0, ty = 0;
    for (const [cx, cy, r, d] of SW) { const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy), w = Math.max(0, 1 - dd / (r * 1.6)) ** 2; tx += w * -dy * d / (dd + 1); ty += w * dx * d / (dd + 1); ws += w; }
    const k = 1 - Math.min(1, ws); return ws > 0.05 ? Math.atan2(ty + k * Math.sin(a), tx + k * Math.cos(a)) : a; };
  const SKIES = {};
  VG.sky = (c, t, o) => {
    const { swirls, stars, h = 1060, seed = 7, n = 9000 } = o, key = seed + ':' + h, af = angFn(swirls);
    const L = SKIES[key] || (SKIES[key] = (() => { const r = U.rng(seed); return Array.from({ length: n }, () => [r() * W, r() * h, r(), r(), r()]); })());
    c.fillStyle = C.sky[0]; c.fillRect(0, 0, W, h); c.lineCap = 'round';
    for (const [x0, y0, a, b, k] of L) {
      let x = x0, y = y0;
      for (const [cx, cy, r, d] of swirls) { const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy); if (dd < r * 1.4) { const om = d * t * 0.5 * (1 - dd / (r * 1.4)), co = Math.cos(om), si = Math.sin(om); x = cx + dx * co - dy * si; y = cy + dx * si + dy * co; } }
      const an = af(x, y), len = 20 + a * 18, near = stars.some(([sx, sy, sr]) => Math.hypot(x - sx, y - sy) < sr * 2.2);
      c.strokeStyle = near ? C.skyLt[(b * 3) | 0] : C.sky[(b * C.sky.length) | 0]; c.lineWidth = 6 + k * 4;
      c.beginPath(); c.moveTo(x - Math.cos(an) * len / 2, y - Math.sin(an) * len / 2); c.lineTo(x + Math.cos(an) * len / 2, y + Math.sin(an) * len / 2); c.stroke();
    }
    VG.stars(c, t, stars);
  };
  // stars / lamps — motif: halos expand outward
  VG.stars = (c, t, stars, col = '#f6e27a') => { for (const [sx, sy, sr] of stars) {
    for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3 + sx / 997) % 1; SL.ring(c, sx, sy, sr * (1 + ph * 1.6), sr * (1.12 + ph * 1.6), col, 0.55 * (1 - ph)); }
    c.fillStyle = '#f7e06a'; c.beginPath(); c.arc(sx, sy, sr * 0.62, 0, TAU); c.fill(); c.strokeStyle = '#f2b730'; c.lineWidth = 6; c.stroke(); } };

  // stroke-filled rect helper
  VG.box = (g, x0, y0, x1, y1, cols, seed, ang = -1.57, lw = 6) => { const p = new Path2D(); p.rect(x0, y0, x1 - x0, y1 - y0);
    SL.strokes(g, p, { colors: cols, angFn: () => ang, len: 22, w: 7, density: 0.05, seed, box: [x0, y0, x1, y1], outline: [C.ink, lw] }); };

  // house in unit coords (origin bottom-left, y up = negative), as separate pen lines for the sketch
  VG.houseLines = (ox, oy, s) => [
    [[-0.15, 0], [1.4, 0]],
    [[0, 0], [0, -0.3], [1, -0.3], [1, 0]],
    [[0.2, -0.3], [0.2, -0.58], [1.25, -0.58], [1.25, -0.3], [1, -0.3]],
    [[0.15, -0.6], [1.3, -0.6]],
    [[0.35, 0], [0.35, -0.18], [0.55, -0.18], [0.55, 0]],
    [[0.62, -0.38], [1.05, -0.38], [1.05, -0.5], [0.62, -0.5], [0.62, -0.38]],
    [[0.66, -0.1], [0.92, -0.1], [0.92, -0.22], [0.66, -0.22], [0.66, -0.1]],
  ].map(l => l.map(([x, y]) => [ox + x * s, oy + y * s]));
  // sequential pen reveal across several polylines; returns pen tip
  VG.revealLines = (g, lines, p, style) => {
    const len = l => l.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - l[i][0], q[1] - l[i][1]), 0);
    const Ls = lines.map(len), tot = Ls.reduce((a, b) => a + b, 0); let left = tot * U.clamp(p), tip = lines[0][0];
    for (let i = 0; i < lines.length && left > 0; i++) { const f = Math.min(1, left / Ls[i]); tip = SL.reveal(g, lines[i], f, style); left -= Ls[i]; }
    return tip;
  };
  // painted house (cached), grows from the ground: p 0..1
  VG.house = (c, key, HX, HY, HS, p, t, lit = [1, 1, 1]) => {
    const img = P.cached('vgh_' + key, W, H, g => {
      VG.box(g, HX, HY - 0.3 * HS, HX + HS, HY, C.wall, 21); VG.box(g, HX + 0.2 * HS, HY - 0.58 * HS, HX + 1.25 * HS, HY - 0.3 * HS, C.wall, 22);
      VG.box(g, HX + 0.15 * HS, HY - 0.62 * HS, HX + 1.3 * HS, HY - 0.56 * HS, C.roof, 23, 0);
      VG.box(g, HX + 0.35 * HS, HY - 0.18 * HS, HX + 0.55 * HS, HY, ['#7a3a1a', '#94502a'], 24); });
    const top = HY - 0.64 * HS, yCut = U.lerp(HY + 6, top, U.clamp(p));
    c.save(); c.beginPath(); c.rect(0, yCut, W, HY + 12 - yCut); c.clip(); c.drawImage(img, 0, 0);
    const wins = [[0.62, -0.5, 0.43, 0.12], [0.66, -0.22, 0.26, 0.12], [0.36, -0.17, 0.18, 0.06]];
    wins.forEach(([x, y, w, h], i) => { const on = lit[i] || 0; if (on <= 0) return;
      const fl = 0.8 + 0.2 * Math.sin(t * 7 + i * 1.7), X = HX + x * HS, Y = HY + y * HS;
      c.globalAlpha = on * 0.45 * fl; c.fillStyle = '#f7d64a'; c.beginPath(); c.ellipse(X + w * HS / 2, Y + h * HS / 2, w * HS * 0.9, h * HS * 1.6, 0, 0, TAU); c.fill();
      c.globalAlpha = on * fl; c.fillRect(X, Y, w * HS, h * HS); c.globalAlpha = 1; c.strokeStyle = C.ink; c.lineWidth = 5; c.strokeRect(X, Y, w * HS, h * HS); });
    c.restore();
  };

  // land: hill + wheat field + cypress (cached per key)
  VG.land = (c, key, o = {}) => c.drawImage(P.cached('vgl_' + key, W, H, g => {
    const hy = o.hill || 1000, fy = o.field || 1150;
    const hill = new Path2D(); hill.moveTo(0, hy); hill.bezierCurveTo(300, hy - 70, 700, hy + 80, W, hy - 40); hill.lineTo(W, H); hill.lineTo(0, H); hill.closePath();
    SL.strokes(g, hill, { colors: C.hill, angFn: x => Math.sin(x / 120) * 0.4, len: 30, w: 8, density: 0.02, seed: 11, box: [0, hy - 100, W, fy + 150], outline: [C.ink, 5] });
    const field = new Path2D(); field.moveTo(0, fy); field.bezierCurveTo(400, fy - 50, 700, fy + 50, W, fy - 30); field.lineTo(W, H); field.lineTo(0, H); field.closePath();
    SL.strokes(g, field, { colors: C.wheat, angFn: (x, y) => -1.2 + Math.sin(x / 70 + y / 50) * 0.5, len: 34, w: 8, density: 0.022, seed: 12, box: [0, fy - 60, W, H] });
    if (o.cypress !== false) { const cx = o.cypress || 1010, b = fy + 30;
      const cy = new Path2D(); cy.moveTo(cx - 50, b); cy.bezierCurveTo(cx - 110, b - 280, cx - 20, b - 540, cx - 25, b - 620); cy.bezierCurveTo(cx + 10, b - 480, cx + 70, b - 250, cx + 30, b); cy.closePath();
      SL.strokes(g, cy, { colors: ['#1d3a26', '#2c5534', '#14281b'], angFn: (x, y) => -1.57 + Math.sin(y / 40) * 0.6, len: 40, w: 9, density: 0.03, seed: 13, box: [cx - 130, b - 640, cx + 80, b], outline: [C.ink, 4] }); }
  }), 0, 0);
  // foreground wheat stalks swaying (motif)
  VG.wheat = (c, t, y0, n, seed) => { const r = U.rng(seed); c.lineCap = 'round';
    for (let i = 0; i < n; i++) { const x = r() * W, y = y0 + r() * (H - y0), h = 60 + r() * 90, sw = Math.sin(t * 1.6 + x / 140) * 0.25 + (r() - 0.5) * 0.2, col = C.wheat[(r() * 4) | 0];
      c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(sw) * h * 0.5, y - h * 0.6, x + Math.sin(sw) * h, y - h * Math.cos(sw)); c.stroke();
      c.fillStyle = col; c.beginPath(); c.ellipse(x + Math.sin(sw) * h, y - h * Math.cos(sw), 7, 18, sw, 0, TAU); c.fill(); } };

  // ---- architect (profile facing right). Head centre at (x,y), scale s. hatLift 0..1, smile 0..1 ----
  const ox = 205, oy = 1360;
  const body = () => P.cached('vga_body', W, H, g => {
    const coat = new Path2D(); coat.moveTo(-40, H); coat.bezierCurveTo(-20, 1560, 120, 1470, 260, 1480); coat.bezierCurveTo(380, 1500, 430, 1620, 470, H); coat.closePath();
    SL.strokes(g, coat, { colors: C.coat, angFn: (x, y) => -1.2 + Math.sin(y / 60) * 0.5, len: 30, w: 9, density: 0.03, seed: 31, box: [-40, 1460, 480, H], outline: [C.ink, 6] });
    const head = new Path2D(); head.ellipse(205, 1360, 98, 122, -0.15, 0, TAU);
    SL.strokes(g, head, { colors: C.skin, angFn: (x, y) => Math.atan2(y - 1360, x - 205) + 1.57, len: 16, w: 6, density: 0.07, seed: 32, box: [100, 1230, 310, 1490], outline: [C.ink, 5] });
    g.fillStyle = C.skin[0]; g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(295, 1330); g.quadraticCurveTo(335, 1372, 298, 1384); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(150, 1365, 18, 28, 0, 0, TAU); g.fill(); g.stroke();
    const beard = new Path2D(); beard.moveTo(140, 1390); beard.bezierCurveTo(170, 1500, 280, 1500, 300, 1400); beard.lineTo(280, 1400); beard.bezierCurveTo(240, 1420, 200, 1420, 160, 1380); beard.closePath();
    SL.strokes(g, beard, { colors: C.beard, angFn: () => 1.4, len: 18, w: 5, density: 0.09, seed: 33, box: [130, 1370, 310, 1500], outline: [C.ink, 4] }); });
  const hat = () => P.cached('vga_hat', W, H, g => {
    const brim = new Path2D(); brim.ellipse(205, 1262, 175, 34, -0.12, 0, TAU);
    const crown = new Path2D(); crown.moveTo(120, 1262); crown.bezierCurveTo(125, 1150, 285, 1140, 290, 1245); crown.closePath();
    for (const [p, s] of [[crown, 34], [brim, 35]]) SL.strokes(g, p, { colors: C.hat, angFn: x => 0.2 + Math.sin(x / 30) * 0.3, len: 20, w: 6, density: 0.08, seed: s, box: [20, 1130, 390, 1310], outline: [C.ink, 5] });
    g.strokeStyle = '#2b4fa8'; g.lineWidth = 12; g.beginPath(); g.moveTo(125, 1232); g.quadraticCurveTo(205, 1218, 288, 1226); g.stroke(); });
  VG.architect = (c, t, o = {}) => {
    const { x = ox, y = oy, s = 1, hatLift = 0, smile = 0, look = 0 } = o, bob = Math.sin(t * 2.2) * 4;
    c.save(); c.translate(x, y + bob); c.scale(s, s); c.translate(-ox, -oy);
    c.drawImage(body(), 0, 0);
    const blink = (t % 3.1) > 2.95 ? 0.15 : 1, ex = 262 + look * 6, ey = 1342 - look * 8;
    c.fillStyle = '#f7f1df'; c.strokeStyle = C.ink; c.lineWidth = 4; c.beginPath(); c.ellipse(ex, ey, 15, 11 * blink, 0.3, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#2a6a4a'; c.beginPath(); c.arc(ex + 4, ey, 6 * blink, 0, TAU); c.fill();
    c.lineWidth = 6; c.strokeStyle = '#b84e1e'; c.beginPath(); c.moveTo(240, 1318 - smile * 6); c.lineTo(285, 1322 - smile * 10); c.stroke();
    if (smile > 0) { c.strokeStyle = '#7a2a12'; c.lineWidth = 6; c.beginPath(); c.moveTo(250, 1418); c.quadraticCurveTo(272, 1418 + 16 * smile, 292, 1408); c.stroke(); }
    c.save(); c.translate(205, 1262); c.translate(40 * hatLift, -90 * hatLift); c.rotate(-0.35 * hatLift); c.translate(-205, -1262); c.drawImage(hat(), 0, 0); c.restore();
    c.restore();
  };
  // arm from shoulder to a hand holding a pencil at tip
  VG.hand = (c, t, tip, shoulder, writing) => {
    const hx = tip[0] - 20, hy = tip[1] - 30 + (writing ? Math.sin(t * 18) * 2 : 0);
    c.strokeStyle = C.ink; c.lineWidth = 54; c.lineCap = 'round'; c.beginPath(); c.moveTo(shoulder[0], shoulder[1]); c.quadraticCurveTo((shoulder[0] + hx) / 2 + 40, Math.max(shoulder[1], hy) + 90, hx - 30, hy + 20); c.stroke();
    c.strokeStyle = C.coat[1]; c.lineWidth = 44; c.stroke();
    c.strokeStyle = C.ink; c.lineWidth = 11; c.beginPath(); c.moveTo(hx + 10, hy + 26); c.lineTo(hx + 72, hy - 62); c.stroke();
    c.strokeStyle = '#e9c54a'; c.lineWidth = 7; c.beginPath(); c.moveTo(hx + 14, hy + 20); c.lineTo(hx + 68, hy - 56); c.stroke();
    c.fillStyle = C.skin[0]; c.strokeStyle = C.ink; c.lineWidth = 5; c.beginPath(); c.ellipse(hx, hy, 36, 28, -0.5, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = C.skin[1]; c.lineWidth = 4; c.beginPath(); c.moveTo(hx - 10, hy - 14); c.lineTo(hx + 14, hy - 4); c.stroke();
  };
  // camera: scale s around focus (fx,fy), plus pan dx
  VG.cam = (c, s, fx, fy, dx = 0, dy = 0) => { c.translate(fx + dx, fy + dy); c.scale(s, s); c.translate(-fx, -fy); };
})();
