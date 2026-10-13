// Direction C — Bauhaus: frontal symmetric composition; primary-colour blocks stack into a tower on the beat, Schlemmer-style figure draws an arc with a compass.
SCENES['ba_bauhaus'] = (() => {
  const { W, H } = SL, TAU = Math.PI * 2, P = PAINT;
  const C = { bg: '#efe6d2', red: '#d23a2a', yel: '#f2b822', blu: '#1f4fa0', blk: '#161616', gry: '#b9b0a0', wht: '#faf6ec' };
  const BPM = 120, beat = 60 / BPM;
  // blocks: [x, y(top), w, h, colour, shape]
  const BL = [[290, 1380, 500, 140, C.blk, 'r'], [340, 1240, 220, 140, C.red, 'r'], [560, 1240, 180, 140, C.yel, 'r'], [300, 1060, 480, 180, C.wht, 'r'],
    [420, 900, 240, 160, C.blu, 'r'], [470, 780, 140, 120, C.red, 'c'], [330, 1100, 120, 100, C.blu, 'r'], [640, 1100, 100, 100, C.yel, 'c']];
  const grain = () => P.cached('bh_grain', W, H, g => { const r = U.rng(9); g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.12)'; g.fillRect(r() * W, r() * H, 2, 2); } });
  const block = (c, x, y, w, h, col, sh) => { c.fillStyle = col; c.strokeStyle = C.blk; c.lineWidth = 6;
    if (sh === 'c') { c.beginPath(); c.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, TAU); c.fill(); c.stroke(); } else { c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h); } };

  return {
    draw(c, lt, t) {
      c.drawImage(grain(), 0, 0);
      // motif 1: big sun disc slowly rotates its quarter-segments; motif 2: grid lines pulse on beat
      const pulse = Math.exp(-((t % beat) / beat) * 5);
      c.strokeStyle = C.gry; c.lineWidth = 2 + pulse * 3; c.globalAlpha = 0.5 + pulse * 0.4;
      for (let x = 90; x < W; x += 180) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 120; y < H; y += 180) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.globalAlpha = 1;
      const sr = 300, sx = 540, sy = 560;
      for (let k = 0; k < 4; k++) { c.fillStyle = [C.yel, C.red, C.yel, C.wht][k]; c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, sr, k * TAU / 4 + t * 0.35, (k + 1) * TAU / 4 + t * 0.35); c.closePath(); c.fill(); }
      c.strokeStyle = C.blk; c.lineWidth = 6; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.stroke();
      // ground bar
      c.fillStyle = C.blk; c.fillRect(0, 1520, W, 26); c.fillStyle = C.red; c.fillRect(0, 1546, W, 14);
      // tower blocks land on beats (main action), squash on landing
      for (let i = 0; i < BL.length; i++) { const [x, y, w, h, col, sh] = BL[i], ta = 0.2 + i * beat * 0.75, q = U.clamp((lt - ta) / (beat * 0.6)); if (q <= 0) continue;
        const fall = (1 - U.ease.in(q)) * -(y + h), land = U.clamp((lt - ta - beat * 0.6) / 0.25), sq = q >= 1 ? Math.sin(land * Math.PI) * 0.08 * (1 - land) : 0;
        c.save(); c.translate(x + w / 2, y + h + fall); c.scale(1 + sq, 1 - sq); block(c, -w / 2, -h, w, h, col, sh); c.restore(); }
      // Schlemmer figure (bottom-left): geometric head, profile eye, compass drawing an arc
      const fx = 180, fy = 1780;
      c.fillStyle = C.blu; c.strokeStyle = C.blk; c.lineWidth = 6;
      c.beginPath(); c.moveTo(fx - 110, H); c.lineTo(fx - 80, fy - 120); c.lineTo(fx + 80, fy - 120); c.lineTo(fx + 120, H); c.closePath(); c.fill(); c.stroke();   // torso cone
      c.fillStyle = C.wht; c.beginPath(); c.arc(fx, fy - 210, 78, 0, TAU); c.fill(); c.stroke();                                                        // head disc
      c.fillStyle = C.blk; c.beginPath(); c.arc(fx, fy - 210, 78, -Math.PI / 2, Math.PI / 2); c.fill();                                                   // half-black face (Schlemmer)
      const bl = (t % 3.3) > 3.15 ? 0.15 : 1; c.fillStyle = C.wht; c.beginPath(); c.ellipse(fx + 36, fy - 224, 16, 9 * bl, 0, 0, TAU); c.fill();
      c.fillStyle = C.blk; c.beginPath(); c.arc(fx + 40, fy - 224, 6 * bl, 0, TAU); c.fill();
      c.fillStyle = C.red; c.fillRect(fx + 52, fy - 180, 26, 10);                                                                                           // mouth bar
      c.fillStyle = C.yel; c.beginPath(); c.arc(fx, fy - 210, 22, Math.PI * 1.1, Math.PI * 1.9); c.fill();
      // arm + compass sweeping an arc (yellow) above the ground
      const sweep = U.ease.inOut(U.clamp(lt / 3.6)) * Math.PI, px = 700, py = 1700, rr = 240;
      c.strokeStyle = C.yel; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.arc(px, py, rr, Math.PI, Math.PI + sweep); c.stroke();
      const ex = px + Math.cos(Math.PI + sweep) * rr, ey = py + Math.sin(Math.PI + sweep) * rr;
      c.strokeStyle = C.blk; c.lineWidth = 8; c.beginPath(); c.moveTo(px, py); c.lineTo((px + ex) / 2, Math.min(py, ey) - 120); c.lineTo(ex, ey); c.stroke();
      c.strokeStyle = C.blu; c.lineWidth = 34; c.beginPath(); c.moveTo(fx + 70, fy - 100); c.lineTo((px + ex) / 2 - 10, Math.min(py, ey) - 110); c.stroke();
      c.fillStyle = C.red; c.beginPath(); c.arc((px + ex) / 2, Math.min(py, ey) - 120, 20, 0, TAU); c.fill(); c.stroke();
      // type: Bauhaus-style label
      c.fillStyle = C.blk; c.font = '96px "ArchivoBlack-400"'; c.fillText('STUDIO', 70, 1660 - 1440 + 30);
      c.fillStyle = C.red; c.fillText('BAM', 70, 1660 - 1440 + 120);
    },
  };
})();
