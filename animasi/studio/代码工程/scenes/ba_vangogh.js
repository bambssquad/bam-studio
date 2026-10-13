// Direction A — Van Gogh: low horizon, swirling night sky, architect (straw hat, profile) sketches a house that grows on the hill.
SCENES['ba_vangogh'] = (() => {
  const { W, H } = SL, TAU = Math.PI * 2, P = PAINT;
  const C = { sky: ['#1d3b8f', '#2a55b8', '#3f6fd0', '#16307a', '#5b87e0', '#8fb0ec'], skyLt: ['#c9d9f2', '#f2e7a6', '#9fbbe8'],
    hill: ['#2f5a3a', '#3e7a46', '#24472f', '#5a8f4a'], wheat: ['#e8b93a', '#d99a2b', '#f2d266', '#b9792a'],
    wall: ['#f0e3c0', '#e6cf96', '#f7efd6', '#d8bf84'], roof: ['#c2512c', '#a9411f', '#d9703c'], win: '#f7d64a',
    coat: ['#2b4fa8', '#1f3d8a', '#3e66c4'], skin: ['#e9b98c', '#d9a073', '#f0c9a0'], beard: ['#d8662a', '#e98a34', '#b84e1e'],
    hat: ['#e9c54a', '#d6aa2c', '#f3da7a'], paper: ['#f4ead2', '#ece0c2', '#f8f1df'], ink: '#1a2a5c' };
  const SW = [[300, 330, 260, 1], [770, 560, 210, -1], [520, 150, 150, 1]];
  const skyAng = (x, y) => { let a = Math.sin(y / 90 + x / 260) * 0.35, wsum = 0, tx = 0, ty = 0;
    for (const [cx, cy, r, d] of SW) { const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy), w = Math.max(0, 1 - dd / (r * 1.6)) ** 2; tx += w * -dy * d / (dd + 1); ty += w * dx * d / (dd + 1); wsum += w; }
    return wsum > 0.05 ? Math.atan2(ty + (1 - Math.min(1, wsum)) * Math.sin(a), tx + (1 - Math.min(1, wsum)) * Math.cos(a)) : a; };
  // fixed sky stroke list (seeded), advected around swirl centres each frame
  const R = U.rng(7), SKY = Array.from({ length: 9000 }, () => [R() * W, R() * 1020, R(), R(), R()]);
  const STARS = [[300, 330, 46], [770, 560, 38], [520, 150, 30], [930, 200, 26], [120, 620, 22], [640, 820, 20]];
  const HX = 300, HY = 1095, HS = 480, house = SL.housePts(HX, HY, HS);
  const PX = 470, PY = 1830, PS = 360, sketch = SL.housePts(PX, PY, PS);

  const land = () => P.cached('vg_land', W, H, g => {
    const hill = new Path2D(); hill.moveTo(0, 1000); hill.bezierCurveTo(300, 930, 700, 1080, W, 960); hill.lineTo(W, H); hill.lineTo(0, H); hill.closePath();
    SL.strokes(g, hill, { colors: C.hill, angFn: (x, y) => Math.sin(x / 120) * 0.4, len: 30, w: 8, density: 0.02, seed: 11, box: [0, 900, W, 1300], outline: [C.ink, 5] });
    const field = new Path2D(); field.moveTo(0, 1150); field.bezierCurveTo(400, 1100, 700, 1200, W, 1120); field.lineTo(W, H); field.lineTo(0, H); field.closePath();
    SL.strokes(g, field, { colors: C.wheat, angFn: (x, y) => -1.2 + Math.sin(x / 70 + y / 50) * 0.5, len: 34, w: 8, density: 0.022, seed: 12, box: [0, 1090, W, H] });
    // cypress at right
    const cy = new Path2D(); cy.moveTo(960, 1180); cy.bezierCurveTo(900, 900, 990, 640, 985, 560); cy.bezierCurveTo(1020, 700, 1080, 930, 1040, 1180); cy.closePath();
    SL.strokes(g, cy, { colors: ['#1d3a26', '#2c5534', '#14281b'], angFn: (x, y) => -1.57 + Math.sin(y / 40) * 0.6, len: 40, w: 9, density: 0.03, seed: 13, box: [880, 540, 1080, 1200], outline: [C.ink, 4] });
  });
  const housePaint = () => P.cached('vg_house', W, H, g => {
    const box = (x0, y0, x1, y1, cols, seed) => { const p = new Path2D(); p.rect(x0, y0, x1 - x0, y1 - y0); SL.strokes(g, p, { colors: cols, angFn: () => -1.57, len: 22, w: 7, density: 0.05, seed, box: [x0, y0, x1, y1], outline: [C.ink, 6] }); };
    box(HX, HY - 0.3 * HS, HX + HS, HY, C.wall, 21);
    box(HX + 0.2 * HS, HY - 0.58 * HS, HX + 1.25 * HS, HY - 0.3 * HS, C.wall, 22);
    box(HX + 0.2 * HS, HY - 0.6 * HS, HX + 1.25 * HS, HY - 0.56 * HS, C.roof, 23);
  });

  const face = (g, t) => {
    const bob = Math.sin(t * 2.2) * 4;
    g.save(); g.translate(0, bob);
    const coat = new Path2D(); coat.moveTo(-40, H); coat.bezierCurveTo(-20, 1560, 120, 1470, 260, 1480); coat.bezierCurveTo(380, 1500, 430, 1620, 470, H); coat.closePath();
    SL.strokes(g, coat, { colors: C.coat, angFn: (x, y) => -1.2 + Math.sin(y / 60) * 0.5, len: 30, w: 9, density: 0.03, seed: 31, box: [-40, 1460, 480, H], outline: [C.ink, 6] });
    const head = new Path2D(); head.ellipse(205, 1360, 98, 122, -0.15, 0, TAU);
    SL.strokes(g, head, { colors: C.skin, angFn: (x, y) => Math.atan2(y - 1360, x - 205) + 1.57, len: 16, w: 6, density: 0.07, seed: 32, box: [100, 1230, 310, 1490], outline: [C.ink, 5] });
    // nose bump + ear + eye (profile facing right, looking down at paper)
    g.fillStyle = C.skin[0]; g.strokeStyle = C.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(295, 1330); g.quadraticCurveTo(335, 1372, 298, 1384); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(150, 1365, 18, 28, 0, 0, TAU); g.fill(); g.stroke();
    const blink = (t % 3.1) > 2.95 ? 0.15 : 1;
    g.fillStyle = '#2a6a4a'; g.beginPath(); g.ellipse(262, 1342, 11, 9 * blink, 0.3, 0, TAU); g.fill(); g.stroke();
    g.lineWidth = 6; g.strokeStyle = '#b84e1e'; g.beginPath(); g.moveTo(240, 1318); g.lineTo(285, 1322); g.stroke();
    const beard = new Path2D(); beard.moveTo(140, 1390); beard.bezierCurveTo(170, 1500, 280, 1500, 300, 1400); beard.lineTo(280, 1400); beard.bezierCurveTo(240, 1420, 200, 1420, 160, 1380); beard.closePath();
    SL.strokes(g, beard, { colors: C.beard, angFn: () => 1.4, len: 18, w: 5, density: 0.09, seed: 33, box: [130, 1370, 310, 1500], outline: [C.ink, 4] });
    const hat = new Path2D(); hat.ellipse(205, 1262, 175, 34, -0.12, 0, TAU);
    const crown = new Path2D(); crown.moveTo(120, 1262); crown.bezierCurveTo(125, 1150, 285, 1140, 290, 1245); crown.closePath();
    for (const [p, s] of [[crown, 34], [hat, 35]]) SL.strokes(g, p, { colors: C.hat, angFn: (x) => 0.2 + Math.sin(x / 30) * 0.3, len: 20, w: 6, density: 0.08, seed: s, box: [20, 1130, 390, 1310], outline: [C.ink, 5] });
    g.strokeStyle = '#2b4fa8'; g.lineWidth = 12; g.beginPath(); g.moveTo(125, 1232); g.quadraticCurveTo(205, 1218, 288, 1226); g.stroke();
    g.restore();
  };

  return {
    draw(c, lt, t) {
      const p = U.ease.inOut(U.clamp(lt / 3.2));
      // sky — advected strokes (motif 1: swirl curls)
      c.fillStyle = C.sky[0]; c.fillRect(0, 0, W, 1060); c.lineCap = 'round';
      for (const [x0, y0, a, b, k] of SKY) {
        let x = x0, y = y0;
        for (const [cx, cy, r, d] of SW) { const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy); if (dd < r * 1.4) { const om = d * t * 0.5 * (1 - dd / (r * 1.4)), co = Math.cos(om), si = Math.sin(om); x = cx + dx * co - dy * si; y = cy + dx * si + dy * co; } }
        const an = skyAng(x, y), L = 20 + a * 18, near = STARS.some(([sx, sy, sr]) => Math.hypot(x - sx, y - sy) < sr * 2.2);
        c.strokeStyle = near ? C.skyLt[(b * 3) | 0] : C.sky[(b * C.sky.length) | 0]; c.lineWidth = 6 + k * 4;
        c.beginPath(); c.moveTo(x - Math.cos(an) * L / 2, y - Math.sin(an) * L / 2); c.lineTo(x + Math.cos(an) * L / 2, y + Math.sin(an) * L / 2); c.stroke();
      }
      // stars — motif 2: halos expand outward
      for (const [sx, sy, sr] of STARS) {
        for (let k = 0; k < 3; k++) { const ph = ((t * 0.6 + k / 3 + sx / 997) % 1); SL.ring(c, sx, sy, sr * (1 + ph * 1.6), sr * (1.12 + ph * 1.6), '#f6e27a', 0.55 * (1 - ph)); }
        c.fillStyle = '#f7e06a'; c.beginPath(); c.arc(sx, sy, sr * 0.62, 0, TAU); c.fill(); c.strokeStyle = '#f2b730'; c.lineWidth = 6; c.stroke();
      }
      c.drawImage(land(), 0, 0);
      // building grows from the ground in sync with the sketch
      const top = HY - 0.62 * HS, yCut = U.lerp(HY + 4, top, U.clamp(p * 1.05));
      c.save(); c.beginPath(); c.rect(0, yCut, W, HY + 10 - yCut); c.clip(); c.drawImage(housePaint(), 0, 0);
      const fl = 0.75 + 0.25 * Math.sin(t * 7 + 1.3);  // windows flicker
      c.globalAlpha = U.ss(0.75, 1, p) * fl; c.fillStyle = C.win; c.strokeStyle = C.ink; c.lineWidth = 4;
      for (const [x, y, w, h] of [[HX + 0.62 * HS, HY - 0.5 * HS, 0.43 * HS, 0.12 * HS], [HX + 0.35 * HS, HY - 0.18 * HS, 0.2 * HS, 0.18 * HS], [HX + 0.66 * HS, HY - 0.22 * HS, 0.26 * HS, 0.12 * HS]]) { c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h); }
      c.restore();
      // drafting paper + pen-tip reveal
      c.save(); c.translate(560, 1720); c.rotate(-0.06); c.translate(-560, -1720);
      const paper = new Path2D(); paper.rect(400, 1520, 640, 380);
      c.drawImage(P.cached('vg_paper', W, H, g => SL.strokes(g, paper, { colors: C.paper, angFn: () => 0.05, len: 26, w: 7, density: 0.06, seed: 41, box: [400, 1520, 1040, 1900], outline: [C.ink, 5] })), 0, 0);
      const tip = SL.reveal(c, sketch, p, { strokeStyle: C.ink, lineWidth: 6 });
      c.restore();
      face(c, t);
      // hand + pencil at the pen tip
      const hx = tip[0] - 20, hy = tip[1] - 30 + Math.sin(t * 18) * 2 * (p < 1);
      c.strokeStyle = C.coat[1]; c.lineWidth = 46; c.lineCap = 'round'; c.beginPath(); c.moveTo(300, 1560); c.quadraticCurveTo(380, 1700, hx - 30, hy + 20); c.stroke();
      c.strokeStyle = C.ink; c.lineWidth = 9; c.beginPath(); c.moveTo(hx + 10, hy + 26); c.lineTo(hx + 70, hy - 60); c.stroke();
      c.strokeStyle = '#e9c54a'; c.lineWidth = 6; c.beginPath(); c.moveTo(hx + 14, hy + 20); c.lineTo(hx + 66, hy - 54); c.stroke();
      c.fillStyle = C.skin[0]; c.strokeStyle = C.ink; c.lineWidth = 5; c.beginPath(); c.ellipse(hx, hy, 34, 26, -0.5, 0, TAU); c.fill(); c.stroke();
    },
  };
})();
