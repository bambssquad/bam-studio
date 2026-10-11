// Pre-analysed audio features (analyze.py) sampled at time t — no live FFT, so render == player.
export function makeAudio(a) {
  const at = (arr, t) => {
    const f = t * a.fps, i = Math.floor(f), k = f - i
    const x = arr[Math.min(arr.length - 1, Math.max(0, i))], y = arr[Math.min(arr.length - 1, Math.max(0, i + 1))]
    return x + (y - x) * k
  }
  const lastBeat = t => {
    let lo = 0, hi = a.beats.length - 1
    if (t < a.beats[0]) return -1
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a.beats[m] <= t) lo = m; else hi = m - 1 }
    return lo
  }
  return {
    duration: a.duration,
    beats: a.beats,
    rms: t => at(a.rms, t),
    bass: t => at(a.bass, t),
    high: t => at(a.high, t),
    onset: t => at(a.onset, t),
    beatIndex: lastBeat,
    // 1 on the beat, decays to 0
    pulse: (t, k = 7) => { const i = lastBeat(t); return i < 0 ? 0 : Math.exp(-(t - a.beats[i]) * k) },
  }
}
