// Shot 1 (0–5s) — top-down desk: the architect's hand pencils the house elevation; lamp halo pulses, coffee steam curls. Camera: slow push.
SCENES['vg_sketch'] = (() => {
  const { W, H } = SL, TAU = Math.PI * 2, P = PAINT, C = VG.C;
  const lines = VG.houseLines(200, 1080, 560);
  const desk = () => P.cached('sk_desk', W, H, g => {
    g.fillStyle = C.wood[2]; g.fillRect(0, 0, W, H);
    SL.strokes(g, null, { colors: C.wood, angFn: (x, y) => Math.sin(y / 140 + x / 400) * 0.25, len: 46, w: 10, density: 0.02, seed: 51, box: [0, 0, W, H] });
    const paper = new Path2D(); paper.rect(110, 380, 860, 1180);
    g.save(); g.translate(540, 970); g.rotate(-0.04); g.translate(-540, -970);
    g.fillStyle = 'rgba(30,10,0,0.35)'; g.fillRect(124, 396, 860, 1180);
    SL.strokes(g, paper, { colors: C.paper, angFn: () => 0.05, len: 26, w: 7, density: 0.06, seed: 52, box: [110, 380, 970, 1560], outline: [C.ink, 6] });
    g.strokeStyle = C.ink; g.lineWidth = 3; g.globalAlpha = 0.5; g.strokeRect(140, 410, 800, 1120); g.strokeRect(700, 1420, 240, 110); g.globalAlpha = 1;
    g.restore();
    // ruler
    g.save(); g.translate(150, 1700); g.rotate(-0.25);
    VG.box(g, 0, 0, 620, 70, ['#e9c54a', '#d6aa2c', '#f3da7a'], 53, 0, 5);
    g.strokeStyle = C.ink; g.lineWidth = 3; for (let i = 1; i < 31; i++) { g.beginPath(); g.moveTo(i * 20, 0); g.lineTo(i * 20, i % 5 ? 16 : 30); g.stroke(); }
    g.restore();
  });
  return {
    draw(c, lt, t) {
      c.save(); VG.cam(c, 1 + 0.08 * U.ease.inOut(U.clamp(lt / 5)), 560, 1050);
      c.drawImage(desk(), 0, 0);
      // lamp (top-right) — halo rings expand + warm pool flickers
      const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7);
      const gr = c.createRadialGradient(900, 210, 20, 900, 210, 700); gr.addColorStop(0, `rgba(255,214,90,${0.45 * fl})`); gr.addColorStop(1, 'rgba(255,214,90,0)');
      c.fillStyle = gr; c.fillRect(0, 0, W, 1000);
      c.lineCap = 'round'; for (let i = 0; i < 160; i++) { const r0 = 110 + (i % 8) * 26, a = i * 2.39 + t * (0.9 - (i % 8) * 0.06); c.strokeStyle = ['#ffe27a', '#f2b730', '#fff1b8'][i % 3]; c.lineWidth = 8; c.globalAlpha = 0.8 - (i % 8) * 0.08;
        c.beginPath(); c.arc(900, 210, r0, a, a + 0.35); c.stroke(); } c.globalAlpha = 1;
      VG.stars(c, t, [[900, 210, 90]], '#ffe27a');
      // coffee cup top-down + steam swirls (motif)
      c.fillStyle = '#f0e3c0'; c.strokeStyle = C.ink; c.lineWidth = 6; c.beginPath(); c.arc(130, 1500, 95, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#5a2e14'; c.beginPath(); c.arc(130, 1500, 70, 0, TAU); c.fill();
      c.strokeStyle = '#f7efd6'; c.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1; c.globalAlpha = 0.8 * (1 - ph); c.lineWidth = 9 * (1 - ph * 0.5);
        c.beginPath(); for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU * 1.2 + t * 2 + k, r = 12 + i * 2.2 + ph * 30; const x = 130 + Math.cos(a) * r, y = 1500 - ph * 260 + Math.sin(a) * r * 0.5; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
      c.globalAlpha = 1;
      // the sketch (main action)
      const p = U.clamp(0.06 + U.ease.out(U.clamp(lt / 4.2)) * 0.94);
      c.save(); c.translate(540, 970); c.rotate(-0.04); c.translate(-540, -970);
      const tip = VG.revealLines(c, lines, p, { strokeStyle: C.ink, lineWidth: 7 });
      c.restore();
      const a = -0.04, tx = 540 + (tip[0] - 540) * Math.cos(a) - (tip[1] - 970) * Math.sin(a), ty = 970 + (tip[0] - 540) * Math.sin(a) + (tip[1] - 970) * Math.cos(a);
      VG.hand(c, t, [tx, ty], [1180, 2050], p < 1);
      c.restore();
    },
  };
})();
