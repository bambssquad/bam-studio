import './style.css'
import lyrics from '../data/lyrics.json'
import audioData from '../data/audio.json'
import { makeAudio } from './audio.js'
import { buildWorld, SCENES } from './world.js'
import { buildLyrics, buildTitle } from './lyrics.js'
import { paperCanvas } from './paper.js'
import { rng } from './util.js'

const RENDER = new URLSearchParams(location.search).has('render')
document.body.classList.toggle('render', RENDER)

// torn top edge + grain for the lyric strip (deterministic)
const r = rng(5), pts = ['0% 100%', '100% 100%']
for (let x = 100; x >= 0; x -= 1.6) pts.push(`${x.toFixed(1)}% ${(1.2 + r() * 2.2 + (x % 9 < 1.6 ? 1.4 : 0)).toFixed(2)}%`)
const strip = document.getElementById('lyr')
strip.style.setProperty('--torn', `polygon(${pts.join(',')})`)
strip.style.setProperty('--grain', `url(${paperCanvas(512, 21).toDataURL()})`)

const audio = makeAudio(audioData)
const world = buildWorld(document.getElementById('gl'), audio)
const lyr = buildLyrics(strip, lyrics, SCENES, audio)
const title = buildTitle(document.getElementById('title'))

function seek(t) { world.seek(t); lyr(t); title(t) }

window.__ready = (async () => {
  await document.fonts.ready
  await Promise.all(['600 84px Fraunces', 'italic 400 38px Fraunces', 'italic 700 172px Fraunces', '500 22px "Space Grotesk"'].map(f => document.fonts.load(f)))
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
