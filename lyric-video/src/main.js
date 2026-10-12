import './style.css'
import lyrics from '../data/lyrics.json'
import audioData from '../data/audio.json'
import { makeAudio } from './audio.js'
import { buildWorld, SCENES } from './flat.js'
import { buildLyrics, buildTitle } from './lyrics.js'

const RENDER = new URLSearchParams(location.search).has('render')
document.body.classList.toggle('render', RENDER)

const strip = document.getElementById('lyr')
const audio = makeAudio(audioData)
let seek = () => {}

// fonts first: shot labels are rasterised into canvas textures at build time
window.__ready = (async () => {
  await Promise.all(['700 64px Unbounded', '800 120px Unbounded', '500 18px "IBM Plex Mono"', '400 24px "IBM Plex Mono"', '700 64px Caveat'].map(f => document.fonts.load(f)))
  await document.fonts.ready
  const world = buildWorld(document.getElementById('gl'), audio, lyrics)
  if (!RENDER) world.seek.setQuality(1) // live player: no sub-frame blur
  const lyr = buildLyrics(strip, lyrics, SCENES, audio, world.info)
  const title = buildTitle(document.getElementById('title'))
  seek = t => { world.seek(t); const tq = Math.floor(t * 12 + 1e-6) / 12; lyr(tq); title(tq) } // type on twos
  window.__cuts = world.cuts.map(c => ({ t: c.t, type: c.type, kind: c.tr?.kind ?? -1, d: c.tr?.d ?? 0, t0: c.tr?.t0 ?? 0 }))
  seek(0); return true
})()
window.__seek = t => { seek(t); return new Promise(res => requestAnimationFrame(() => res(true))) }

if (!RENDER) {
  const stage = document.getElementById('stage'), el = document.getElementById('audio'), play = document.getElementById('play'), scrub = document.getElementById('scrub'), time = document.getElementById('time')
  const fit = () => { // scale the 1080x1920 stage to the viewport, keep layout box in sync
    const s = Math.min((innerWidth - 32) / 1080, (innerHeight - 90) / 1920)
    stage.style.transform = `scale(${s})`; stage.style.marginRight = `${1080 * s - 1080}px`; stage.style.marginBottom = `${1920 * s - 1920}px`
  }
  fit(); addEventListener('resize', fit)
  let dragging = false
  play.onclick = () => { el.paused ? el.play() : el.pause() }
  el.onplay = () => { play.textContent = 'Jeda' }; el.onpause = () => { play.textContent = 'Putar' }
  scrub.oninput = () => { dragging = true; el.currentTime = +scrub.value; seek(+scrub.value) }
  scrub.onchange = () => { dragging = false }
  const tick = () => {
    const t = el.currentTime
    if (!el.paused) seek(t)
    if (!dragging) scrub.value = t
    time.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`
    requestAnimationFrame(tick)
  }
  window.__ready.then(tick)
}
