import { useEffect, useRef } from 'react'
import { advanceSpring, spring, clamp } from './motion'

export default function JellyTitle() {
  const title = useRef(null)
  useEffect(() => {
    const element = title.current, media = matchMedia('(prefers-reduced-motion: reduce)')
    const letters = [...element.querySelectorAll('.jelly-letter')]
    const bodies = letters.map(() => ({ x: spring(0), y: spring(0), angle: spring(0) }))
    let pointer = null, held = null, raf = 0, last = 0
    const tick = time => {
      const dt = Math.min((time - (last || time - 16)) / 1000, .032); last = time
      let alive = !!pointer
      letters.forEach((letter, i) => {
        const body = bodies[i], rect = letter.parentElement.getBoundingClientRect()
        if (media.matches) { for (const name of ['x', 'y', 'angle']) { body[name].value = 0; body[name].velocity = 0 }; pointer = null; held = null; alive = false }
        const center = rect.left + letter.offsetLeft + letter.offsetWidth / 2
        const distance = pointer ? Math.abs(pointer.x - center) : 999
        const influence = Math.max(0, 1 - distance / 150)
        const tx = media.matches ? 0 : held ? clamp((pointer.x - held.x) * .18, -24, 24) * influence : (pointer ? clamp((pointer.x - center) * .09, -5, 5) * influence : 0)
        const ty = media.matches ? 0 : held ? clamp((pointer.y - held.y) * .24, -24, 24) * influence : -9 * influence
        const x = advanceSpring(body.x, tx, dt), y = advanceSpring(body.y, ty, dt)
        const angle = advanceSpring(body.angle, held ? tx * .3 : x * .7, dt)
        letter.style.transform = `translate3d(${x}px,${y}px,0) rotate(${angle}deg) scale(${1 + Math.abs(y) * .002},${1 - Math.abs(y) * .001})`
        alive ||= Math.abs(x) + Math.abs(y) + Math.abs(body.y.velocity) > .015
      })
      raf = alive ? requestAnimationFrame(tick) : 0
      if (!raf) last = 0
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick) }
    const move = e => { if (media.matches || (e.pointerType === 'touch' && !held)) return; pointer = { x: e.clientX, y: e.clientY }; wake() }
    const down = e => { if (e.button !== 0 || media.matches) return; held = { x: e.clientX, y: e.clientY }; pointer = held; element.setPointerCapture(e.pointerId); element.classList.add('is-pulled'); wake() }
    const up = () => { held = null; pointer = null; element.classList.remove('is-pulled'); wake() }
    const leave = () => { if (!held) { pointer = null; wake() } }
    element.addEventListener('pointermove', move); element.addEventListener('pointerdown', down); element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up); element.addEventListener('pointerleave', leave)
    return () => { cancelAnimationFrame(raf); element.removeEventListener('pointermove', move); element.removeEventListener('pointerdown', down); element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); element.removeEventListener('pointerleave', leave) }
  }, [])
  return <h1 ref={title} className="look-title jelly-title" aria-label="Bambe Studio. The Lookbook. Spaces, 2025.">{['Bambe Studio®','THE LOOKBOOK','(SPACES/2025)'].map(line => <span className="jelly-line" key={line} aria-hidden="true">{[...line].map((letter, i) => <span className="jelly-letter" key={i}>{letter === ' ' ? '\u00a0' : letter}</span>)}</span>)}</h1>
}
