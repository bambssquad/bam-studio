// Direction B — Matisse cut-outs: coral paper ground, cut-paper blocks fall and stack into a tower held up by a cut-paper architect.
SCENES['ba_matisse'] = (() => {
  const { W, H } = SL, TAU = Math.PI * 2, P = PAINT;
  const C = { bg: '#e8674a', bg2: '#f1a07c', white: '#fbf6ea', black: '#1c1a1a', yel: '#f4c437', grn: '#2f8a57', ink: '#14316b', pink: '#f6b8b0', org: '#f08a2c', skin: '#f3c7a1' };
  // scissor edge: jitter a polygon's edges with seeded wobble
  const cut = (pts, seed, amp = 5, step = 22) => { const r = U.rng(seed), p = new Path2D(); let first = true;
    for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
      for (let k = 0; k < n; k++) { const f = k / n, x = U.lerp(ax, bx, f) + (r() - 0.5) * amp, y = U.lerp(ay, by, f) + (r() - 0.5) * amp; first ? p.moveTo(x, y) : p.lineTo(x, y); first = false; } }
    p.closePath(); return p; };
  const blob = (cx, cy, rx, ry, seed, lobes = 7, amp = 0.35) => { const r = U.rng(seed), ph = Array.from({ length: 3 }, () => r() * TAU), pts = [];
    for (let i = 0; i < 64; i++) { const a = i / 64 * TAU, k = 1 + amp * (Math.sin(a * lobes + ph[0]) * 0.6 + Math.sin(a * (lobes - 3) + ph[1]) * 0.4); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    return cut(pts, seed + 1, 4, 30); };
  const pinned = (c, path, fill, dx = 8, dy = 10) => { c.save(); c.translate(dx, dy); c.fillStyle = 'rgba(60,20,10,0.28)'; c.fill(path); c.restore(); c.fillStyle = fill; c.fill(path); };
  // seaweed (algue) motif — sways
  const algue = (c, x, y, s, rot, col, seed, t) => { c.save(); c.translate(x, y); c.rotate(rot + Math.sin(t * 1.4 + seed) * 0.08); c.scale(s, s);
    const pts = []; for (let i = 0; i <= 10; i++) { const yy = -i * 40, w = 46 * (1 - i / 11) + 8, sw = Math.sin(i * 1.1 + t * 2 + seed) * 10 * i / 10; pts.push([sw - w - (i % 2) * 28, yy]); }
    for (let i = 10; i >= 0; i--) { const yy = -i * 40, w = 46 * (1 - i / 11) + 8, sw = Math.sin(i * 1.1 + t * 2 + seed) * 10 * i / 10; pts.push([sw + w + ((i + 1) % 2) * 28, yy]); }
    pinned(c, cut(pts, seed, 3, 18), col, 6, 8); c.restore(); };
  // tower pieces (target x,y,w,h,color, arrival time)
  const BX = 160, BASE = 1500;
  const PIECES = [[0, 0, 520, 150, C.ink, 0.1], [60, -150, 400, 130, C.yel, 0.55], [-40, -280, 380, 120, C.white, 1.0], [140, -400, 400, 120, C.grn, 1.4],
    [40, -520, 330, 120, C.ink, 1.8], [120, -640, 280, 120, C.org, 2.2]];
  const WINS = [[60, -125, 80, 60], [200, -125, 80, 60], [30, -255, 70, 70], [250, -380, 90, 60], [120, -500, 60, 80]];

  return {
    draw(c, lt, t) {
      c.drawImage(P.cached('mt_bg2', W, H, g => { g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.fillStyle = C.bg2; g.fill(cut([[0, 1560], [W, 1520], [W, H], [0, H]], 3, 10, 30));
        const r = U.rng(4); g.globalAlpha = 0.08; for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? '#fff' : '#8a2a10'; g.fillRect(r() * W, r() * H, 2 + r() * 60, 2 + r() * 3); } }), 0, 0);
      // motif 1: algues sway; motif 2: confetti stars drift
      algue(c, 930, 520, 1.25, 0.25, C.white, 11, t); algue(c, 80, 760, 0.9, -0.35, C.yel, 12, t); algue(c, 1010, 1440, 0.8, 0.1, C.grn, 13, t);
      for (let i = 0; i < 9; i++) { const r = U.rng(50 + i), x = r() * W, y = ((r() * H - t * (30 + r() * 30)) % H + H) % H, rot = t * (r() - 0.5) * 2;
        c.save(); c.translate(x, y); c.rotate(rot); pinned(c, blob(0, 0, 26, 26, 60 + i, 5, 0.55), [C.white, C.yel, C.pink][i % 3], 4, 5); c.restore(); }
      // tower: pieces drop in with outBack, slight paper wobble
      for (let i = 0; i < PIECES.length; i++) { const [x, y, w, h, col, ta] = PIECES[i], q = U.clamp((lt - ta) / 0.45); if (q <= 0) continue;
        const drop = (1 - U.ease.outBack(q)) * -260, wob = Math.sin(t * 3 + i) * 0.012;
        c.save(); c.translate(BX + x + w / 2, BASE + y - h / 2 + drop); c.rotate(wob + (1 - q) * 0.3);
        pinned(c, cut([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 100 + i, 6), col); c.restore(); }
      c.fillStyle = C.bg; for (const [x, y, w, h] of WINS) { const i = WINS.findIndex(q => q[1] === y); if (lt < PIECES[i + 1 < PIECES.length ? i + 1 : i][5] + 0.4) continue; c.fill(cut([[BX + x, BASE + y], [BX + x + w, BASE + y], [BX + x + w, BASE + y + h], [BX + x, BASE + y + h]], 200 + x, 3, 14)); }
      // architect: cut-paper figure, profile face looking up at the tower
      const sw = Math.sin(t * 1.8) * 0.04;
      c.save(); c.translate(820, 1560); c.rotate(sw);
      pinned(c, cut([[-150, 0], [-110, -420], [-20, -470], [90, -440], [150, 0]], 301, 6), C.grn);           // body
      pinned(c, cut([[-30, -460], [30, -460], [26, -520], [-26, -520]], 302, 3), C.skin);                    // neck
      pinned(c, cut([[-70, -560], [-40, -650], [40, -670], [80, -620], [96, -600], [84, -585], [92, -560], [70, -530], [76, -505], [20, -490], [-60, -510]], 303, 3, 14), C.skin); // head profile, facing left-up
      pinned(c, cut([[-80, -600], [-60, -690], [30, -705], [80, -650], [20, -640], [-40, -600]], 304, 3, 14), C.black); // hair
      const bl = (t % 2.7) > 2.55 ? 0.2 : 1; c.fillStyle = C.black; c.beginPath(); c.ellipse(52, -600, 10, 7 * bl, 0, 0, TAU); c.fill();
      c.strokeStyle = C.black; c.lineWidth = 5; c.beginPath(); c.moveTo(50, -540); c.quadraticCurveTo(64, -532, 76, -540); c.stroke();
      // arm raised, holding up a cut-paper compass toward the tower
      const ar = -0.25 + Math.sin(t * 2.4) * 0.08; c.save(); c.translate(-90, -400); c.rotate(ar - 2.2);
      pinned(c, cut([[0, -24], [260, -20], [260, 22], [0, 26]], 305, 3), C.grn); pinned(c, blob(275, 0, 34, 30, 306, 4, 0.2), C.skin);
      c.strokeStyle = C.black; c.lineWidth = 8; c.beginPath(); c.moveTo(290, 0); c.lineTo(380, -50); c.moveTo(290, 0); c.lineTo(390, 30); c.stroke(); c.restore();
      c.restore();
    },
  };
})();
