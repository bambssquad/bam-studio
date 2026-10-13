// Shared helpers for the "sketsa → bangunan" film (1080×1920 portrait).
(() => {
  const TAU = Math.PI * 2;
  const SL = window.SL = {};
  SL.W = 1080; SL.H = 1920;

  // Fill a Path2D with short directional strokes (Van Gogh-ish impasto). angFn(x,y) → radians.
  SL.strokes = (g, path, opt) => {
    const { colors, angFn, len = 26, w = 7, density = 0.012, seed = 1, box = [0, 0, SL.W, SL.H], jitter = 0.25, outline } = opt;
    const r = U.rng(seed), [x0, y0, x1, y1] = box, n = Math.round((x1 - x0) * (y1 - y0) * density);
    g.save(); if (path) g.clip(path); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), a = angFn(x, y) + (r() - 0.5) * jitter, L = len * (0.6 + r() * 0.8);
      g.strokeStyle = colors[(r() * colors.length) | 0]; g.lineWidth = w * (0.7 + r() * 0.6);
      g.beginPath(); g.moveTo(x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2); g.lineTo(x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2); g.stroke();
    }
    g.restore();
    if (outline && path) { g.save(); g.strokeStyle = outline[0]; g.lineWidth = outline[1]; g.lineJoin = 'round'; g.stroke(path); g.restore(); }
  };

  // Polyline length-reveal: pts drawn up to fraction p (pen-tip reveal).
  SL.reveal = (g, pts, p, style) => {
    let tot = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
    let left = tot * U.clamp(p), tip = pts[0];
    g.save(); Object.assign(g, style); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const f = Math.min(1, left / seg[i - 1]); tip = [U.lerp(pts[i - 1][0], pts[i][0], f), U.lerp(pts[i - 1][1], pts[i][1], f)];
      g.lineTo(tip[0], tip[1]); left -= seg[i - 1];
    }
    g.stroke(); g.restore(); return tip;
  };

  // Building outline as a single pen path (cantilevered stacked boxes) in unit coords → scaled.
  SL.housePts = (ox, oy, s) => [[0, 0], [1, 0], [1, -0.3], [1.25, -0.3], [1.25, -0.58], [0.2, -0.58], [0.2, -0.3], [0, -0.3], [0, 0],
    [0.35, 0], [0.35, -0.18], [0.55, -0.18], [0.55, 0], [0.62, -0.38], [0.62, -0.5], [1.05, -0.5], [1.05, -0.38], [0.62, -0.38]]
    .map(([x, y]) => [ox + x * s, oy + y * s]);

  SL.ring = (g, x, y, r0, r1, col, a) => { g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = r1 - r0; g.beginPath(); g.arc(x, y, (r0 + r1) / 2, 0, TAU); g.stroke(); g.restore(); };
})();
