// Bottom paper strip: mask slide-up lyric lines, next-line preview, section label, timecode. Pure function of t.
import { clamp, outExpo, inCubic, smooth } from './util.js'

const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export function buildLyrics(root, lines, scenes, audio, info) {
  const meta = root.querySelector('.meta'), label = meta.querySelector('.label'), tc = meta.querySelector('.tc'), dot = meta.querySelector('.dot')
  const slot = root.querySelector('.slot'), next = root.querySelector('.next'), bar = root.querySelector('.bar')
  const mkLine = (l, cls) => {
    const el = document.createElement('div'); el.className = cls
    const spans = l.words.map(w => {
      const m = document.createElement('span'); m.className = 'm'; const i = document.createElement('span'); i.className = 'i'; i.textContent = w.w
      if (cls === 'line') { const hl = document.createElement('span'); hl.className = 'hl'; const k = (w.w.length * 7 + Math.round(w.s * 13)) % 5; hl.style.clipPath = `polygon(0 ${8 + k}%, 100% ${2 + k}%, 99% ${92 - k}%, 1% 100%)`; i.prepend(hl); i.hl = hl }
      m.appendChild(i); el.appendChild(m); el.appendChild(document.createTextNode(' ')); return i
    })
    return { el, spans }
  }
  const L = lines.map((l, k) => {
    const a = mkLine(l, 'line'), b = mkLine(l, 'pv'); slot.appendChild(a.el); next.appendChild(b.el)
    const nxt = lines[k + 1], enter = l.start - 0.45, exit = Math.min(nxt ? nxt.start - 0.95 : Infinity, l.end + 2.2)
    return { l, a, b, enter, exit }
  })
  return function seek(t) {
    let cur = -1, shown = 0
    L.forEach((o, k) => {
      const vis = t >= o.enter - 0.05 && t < o.exit + 0.5
      o.a.el.style.display = vis ? '' : 'none'; if (vis) shown++
      if (vis) o.l.words.forEach((w, j) => {
        let y
        if (t < o.exit) y = (1 - outExpo((t - o.enter - j * 0.045) / 0.6)) * 112
        else y = -112 * inCubic((t - o.exit - j * 0.025) / 0.32)
        const s = o.a.spans[j], bl = t < o.exit ? (1 - clamp((t - o.enter - j * 0.045) / 0.35)) * 10 : clamp((t - o.exit - j * 0.025) / 0.32) * 6
        s.style.transform = `translate3d(0,${y.toFixed(2)}%,0)`; s.style.filter = bl > 0.2 ? `blur(${bl.toFixed(1)}px)` : ''
        const nx = o.l.words[j + 1]?.s ?? w.e + 0.35, off = Math.min(nx, w.e + 0.35) // one marked word at a time
        const on = t >= w.s && t < off, sw = clamp((t - w.s + 0.04) / 0.16) * (1 - clamp((t - off + 0.1) / 0.1))
        s.style.color = on ? 'var(--hl-ink)' : t >= w.s ? 'var(--ink)' : 'var(--ink-soft)'
        if (s.hl) s.hl.style.transform = `scaleX(${sw.toFixed(3)}) skewX(-8deg)`
      })
      if (t >= o.enter && t < o.exit) cur = k
      // preview of the following line, shown while this one is current
      const pk = L[k - 1], pvis = pk && t >= pk.enter && t < pk.exit + 0.4 && o.l.start - pk.l.end < 4
      o.b.el.style.display = pvis ? '' : 'none'
      if (pvis) {
        const pin = outExpo((t - pk.enter - 0.25) / 0.6), pout = inCubic((t - pk.exit + 0.05) / 0.35)
        o.b.spans.forEach((s, j) => { s.style.transform = `translate3d(0,${((1 - pin) * 112 - pout * 112).toFixed(2)}%,0)` })
      }
    })
    const sc = scenes.find(s => t >= s.t0 && t < s.t1) ?? scenes[scenes.length - 1]
    const nf = info(t); root.style.setProperty('--accent', nf.accent)
    // caption block travels to the new shot's slot with a short ease (small in-frame lyric, not a subtitle bar)
    const k = clamp((t - nf.cutT) / 0.45), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
    const px = nf.capPrev[0] + (nf.cap[0] - nf.capPrev[0]) * e, py = nf.capPrev[1] + (nf.cap[1] - nf.capPrev[1]) * e
    root.parentElement.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`; const mode = (e < 0.5 ? nf.capPrev : nf.cap)[2]; root.classList.toggle('dark', mode === 1); root.classList.toggle('plate', mode === 2)
    const [r, g, b] = [1, 3, 5].map(i => parseInt(nf.accent.slice(i, i + 2), 16) / 255), lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    root.style.setProperty('--hl-ink', lum > 0.42 ? 'var(--bg)' : 'var(--ink)') // legible text on the marker
    label.textContent = sc.label.split(' · ')[0] // plain section name, no counters
    tc.textContent = 'sayoe'
    dot.style.transform = `scale(${(0.6 + audio.pulse(t, 9) * 0.8).toFixed(3)})`
    bar.style.transform = `scaleX(${clamp(t / audio.duration).toFixed(4)})`
    root.classList.toggle('idle', shown === 0)
    root.classList.toggle('paper', nf.fx === 2 || nf.fx === 6) // receipt / scribble paper: dark ink captions
  }
}

// title card (intro + outro): per-letter mask slide-up
export function buildTitle(el) {
  const word = el.querySelector('.word'), sub = el.querySelector('.sub'), text = word.textContent; word.textContent = ''
  const letters = [...text].map(ch => { const m = document.createElement('span'); m.className = 'm'; const i = document.createElement('span'); i.className = 'i'; i.textContent = ch; m.appendChild(i); word.appendChild(m); return i })
  const shows = [[0.4, 7.2], [206.5, 217.8]]
  return t => {
    const s = shows.find(([a, b]) => t > a - 0.1 && t < b + 1)
    el.style.display = s ? '' : 'none'; if (!s) return
    const [a, b] = s
    letters.forEach((l, i) => {
      const y = t < b ? (1 - outExpo((t - a - i * 0.06) / 0.8)) * 110 : -110 * inCubic((t - b - i * 0.03) / 0.5)
      l.style.transform = `translate3d(0,${y.toFixed(2)}%,0)`
    })
    sub.style.opacity = (smooth(a + 0.9, a + 1.6, t) * (1 - smooth(b - 0.3, b + 0.2, t))).toFixed(3)
    sub.style.transform = `translateY(${((1 - smooth(a + 0.9, a + 1.6, t)) * 16).toFixed(1)}px)`
  }
}
