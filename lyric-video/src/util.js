export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const outExpo = x => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
export const inCubic = x => { x = clamp(x); return x * x * x }
// paper pop-up: fast rise, one small damped overshoot
export const pop = x => (x <= 0 ? 0 : 1 - Math.exp(-6.5 * x) * Math.cos(9 * x))
export const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
}
// deterministic "boil" (stop-motion jitter) quantised to 8 fps
export const boil = (t, seed, amp = 1) => (hash(Math.floor(t * 8) * 13 + seed) - 0.5) * amp
