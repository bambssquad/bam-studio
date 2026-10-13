// Shot 2 (5–10s) — pull back from the paper: the house grows out of the hill in sync with the finished sketch; sky swirls, stars pulse.
SCENES['vg_grow'] = (() => {
  const { W, H } = SL, P = PAINT, C = VG.C;
  const SW = [[300, 330, 260, 1], [770, 560, 210, -1], [520, 150, 150, 1]];
  const STARS = [[300, 330, 46], [770, 560, 38], [520, 150, 30], [930, 200, 26], [120, 620, 22], [640, 820, 20]];
  const sketch = VG.houseLines(470, 1830, 360);
  const hatch = [[[560, 1745], [600, 1700]], [[600, 1745], [640, 1700]], [[640, 1745], [680, 1700]], [[680, 1745], [720, 1700]]];
  return {
    draw(c, lt, t) {
      const pull = U.ease.inOut(U.clamp(lt / 3.4));
      c.save(); VG.cam(c, U.lerp(1.55, 1, pull), 730, 1720);
      VG.sky(c, t, { swirls: SW, stars: STARS });
      VG.land(c, 'grow');
      VG.house(c, 'grow', 300, 1095, 480, U.ss(0.5, 3.6, lt), t, [0, 0, 0]);
      c.save(); c.translate(560, 1720); c.rotate(-0.06); c.translate(-560, -1720);
      c.drawImage(P.cached('gr_paper', W, H, g => { const p = new Path2D(); p.rect(400, 1520, 640, 380); SL.strokes(g, p, { colors: C.paper, angFn: () => 0.05, len: 26, w: 7, density: 0.06, seed: 41, box: [400, 1520, 1040, 1900], outline: [C.ink, 5] }); }), 0, 0);
      VG.revealLines(c, sketch, 1, { strokeStyle: C.ink, lineWidth: 6 });
      const tip = VG.revealLines(c, hatch, U.ss(0.3, 3.0, lt), { strokeStyle: C.ink, lineWidth: 4 });
      c.restore();
      VG.architect(c, t, { look: U.ss(2.6, 3.4, lt) });
      VG.hand(c, t, [tip[0] - 10, tip[1] + 25], [300, 1560], lt < 3);
      c.restore();
    },
  };
})();
