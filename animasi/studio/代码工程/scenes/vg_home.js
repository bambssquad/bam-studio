// Shot 3 (10–15s) — the finished house up close: windows light up on the beat, the sign is painted, the architect turns and tips his hat. Camera: slow truck.
SCENES['vg_home'] = (() => {
  const { W, H } = SL, P = PAINT, C = VG.C, B = 0.625;           // 96 BPM beat
  const SW = [[220, 260, 230, -1], [800, 420, 240, 1]];
  const STARS = [[220, 260, 44], [800, 420, 40], [520, 120, 26], [980, 140, 22], [90, 560, 20]];
  const HX = 120, HY = 1300, HS = 620;
  return {
    draw(c, lt, t) {
      const tr = U.ease.inOut(U.clamp(lt / 5));
      c.save(); VG.cam(c, 1.08, 540, 960, U.lerp(30, -20, tr));
      VG.sky(c, t, { swirls: SW, stars: STARS, h: 1120, seed: 9, n: 10000 });
      VG.land(c, 'home', { hill: 1150, field: 1330, cypress: 60 });
      VG.house(c, 'home', HX, HY, HS, 1, t, [U.ss(B, B + 0.15, lt), U.ss(2 * B, 2 * B + 0.15, lt), U.ss(3 * B, 3 * B + 0.15, lt)]);
      // sign board on a post, letters painted on the beat
      c.drawImage(P.cached('hm_sign', W, H, g => { VG.box(g, 770, 1470, 794, 1600, C.wood, 61); VG.box(g, 590, 1230, 975, 1480, C.wood, 62, 0); }), 0, 0);
      const txt = 'STUDIO BAM', n = Math.floor(U.clamp((lt - 2 * B) / (B * 3)) * txt.length + (lt > 2 * B ? 1 : 0));
      c.font = '112px "LilitaOne-400"'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillStyle = '#f7d64a'; c.strokeStyle = C.ink; c.lineWidth = 10;
      const s = txt.slice(0, Math.min(n, txt.length)), l1 = s.slice(0, 6), l2 = s.slice(7);
      c.strokeText(l1, 782, 1300); c.fillText(l1, 782, 1300); if (l2) { c.strokeText(l2, 782, 1415); c.fillText(l2, 782, 1415); } c.textAlign = 'left';
      VG.wheat(c, t, 1560, 70, 71);
      const turn = U.ss(3.0, 3.6, lt);
      VG.architect(c, t, { x: 250, y: 1640, s: 1.25, hatLift: U.ss(3.3, 3.7, lt) * (1 - U.ss(4.4, 4.9, lt)), smile: turn, look: 0.4 + turn * 0.6 });
      c.restore();
    },
  };
})();
