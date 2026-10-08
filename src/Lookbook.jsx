import { useEffect, useRef, useState } from 'react'
import './Lookbook.css'
import JellyTitle from './JellyTitle'
import { advanceSpring, spring, clamp } from './motion'

export default function Lookbook({ projects, photo, onOpen, onFeatured, onAbout }) {
  const [mode, setMode] = useState('timeline')
  const [active, setActive] = useState(0)
  const billymoonIndex = projects.findIndex(project => project.name === 'BILLYMOON')
  const billymoon = projects[billymoonIndex]
  const stage = useRef(null)
  const actions = useRef(null)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const frames = ['Space', 'Light', 'Detail'].flatMap((view, crop) => projects.map((p, project) => ({ ...p, project, view, crop })))
  useEffect(() => {
    const element = stage.current
    const cards = [...element.querySelectorAll('.look-card')]
    const bodies = cards.map(card => ({ photo: card.querySelector('.look-photo'), caption: card.querySelector('.look-name'), x: spring(0), y: spring(0), tilt: spring(0), stretch: spring(0), lift: spring(0) }))
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let current = 0, target = 0, blend = 0, drag = null, raf, last = -1, disposed = false
    let hover = -1, px = 0, py = 0, lastTime = performance.now(), suppressClick = false
    const scrollSpring = spring(0)
    const count = cards.length
    actions.current = { move: n => { target = Math.round(target) + n }, select: n => { target = n } }
    const wheel = e => { if (modeRef.current === 'index') return; e.preventDefault(); target += Math.max(-150, Math.min(150, e.deltaY || e.deltaX)) * .004 }
    const down = e => { if (e.button !== 0 || !e.isPrimary) return; const index = cards.indexOf(e.target.closest('.look-card')); suppressClick = false; drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, time: performance.now(), speed: 0, dx: 0, dy: 0, index, target, moved: false }; element.setPointerCapture(e.pointerId); element.classList.add('is-dragging') }
    const move = e => {
      if (drag) { const now = performance.now(); drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; drag.moved ||= Math.hypot(drag.dx, drag.dy) > 6; drag.speed = (e.clientX - drag.lastX) / Math.max(now - drag.time, 8); drag.lastX = e.clientX; drag.time = now; if (modeRef.current !== 'index') target = drag.target - drag.dx / 260; return }
      const card = e.target.closest('.look-card'); hover = e.pointerType === 'touch' ? -1 : cards.indexOf(card)
      if (hover >= 0) { const rect = card.getBoundingClientRect(); px = clamp((e.clientX - rect.left) / rect.width - .5, -.5, .5); py = clamp((e.clientY - rect.top) / rect.height - .5, -.5, .5) }
    }
    const up = e => { if (!drag) return; const moved = drag.moved; suppressClick = moved; if (modeRef.current !== 'index') target = Math.round(target - (media.matches ? 0 : clamp(drag.speed * .24, -.8, .8))); drag = null; hover = -1; element.classList.remove('is-dragging'); if (!moved && e.type !== 'pointercancel') { const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-project]'); if (hit) onOpen(Number(hit.dataset.project)) } }
    const leave = () => { hover = -1 }
    const click = e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false } }
    const key = e => { if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); actions.current.move(e.key === 'ArrowRight' ? 1 : -1) } }
    element.addEventListener('wheel', wheel, { passive: false }); element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move); element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up); element.addEventListener('keydown', key)
    element.addEventListener('pointerleave', leave); element.addEventListener('click', click, true)
    const tick = (time = performance.now()) => {
      if (disposed) return
      if (modeRef.current === 'billymoon') { lastTime = time; raf = requestAnimationFrame(tick); return }
      const dt = Math.min(Math.max((time - lastTime) / 1000, .001), .032); lastTime = time
      if (media.matches) { scrollSpring.value = target; scrollSpring.velocity = 0 }
      current = media.matches ? target : advanceSpring(scrollSpring, target, dt, 160, 22)
      const w = element.clientWidth, h = element.clientHeight, surf = modeRef.current === 'surf'
      blend += ((surf ? 1 : 0) - blend) * (media.matches ? 1 : 1 - Math.exp(-dt * 7))
      cards.forEach((card, i) => {
        const offset = (((i - current + 2) % count) + count) % count - 2
        const size = w < 700 ? w * .57 : w * .19
        const timelineX = 16 + (offset + 1) * (size + 16)
        const x = timelineX + (w * .2 + offset * size * .49 - timelineX) * blend
        const y = Math.sin(offset * .75) * h * .06 + blend * (Math.sin(offset * .45) * h * .12)
        card.style.setProperty('--card-width', `${size}px`)
        card.style.transform = `translate3d(${x}px,${y}px,${-Math.abs(offset) * 55 * blend}px) rotateY(${-48 * blend}deg) rotateZ(${media.matches ? 0 : Math.max(-5, Math.min(5, (target-current)*-3))}deg)`
        card.style.zIndex = String(20 - Math.round(Math.abs(offset)))
        const body = bodies[i], held = drag?.index === i, over = hover === i && !drag, reduced = media.matches
        if (reduced) for (const name of ['x','y','tilt','stretch','lift']) { body[name].value = 0; body[name].velocity = 0 }
        const tx = reduced ? 0 : held && modeRef.current === 'index' ? clamp(drag.dx * .3, -65, 65) : over ? px * 13 : 0
        const ty = reduced ? 0 : held ? clamp(drag.dy * .4, -55, 55) : over ? py * 10 - 8 : 0
        const force = reduced ? 0 : clamp(scrollSpring.velocity * .8 + (held ? drag.dx * .035 : 0), -9, 9)
        const dx = advanceSpring(body.x, tx, dt), dy = advanceSpring(body.y, ty, dt)
        const tilt = advanceSpring(body.tilt, force + (over ? px * 7 : 0), dt, 210, 16)
        const stretch = advanceSpring(body.stretch, reduced ? 0 : clamp(Math.abs(force) * .007 + (held ? .025 : 0), 0, .09), dt, 240, 15)
        const lift = advanceSpring(body.lift, !reduced && over ? .025 : 0, dt)
        body.photo.style.transform = `perspective(800px) translate3d(${dx}px,${dy}px,0) rotateY(${dx * .38}deg) rotateZ(${tilt}deg) scale(${1 + stretch + lift},${1 - stretch * .6 + lift})`
        body.caption.style.transform = `translate3d(${dx * .45}px,${dy * .35}px,0) rotate(${tilt * .15}deg)`
      })
      const index = ((Math.round(current) % count) + count) % count
      if (index !== last) { setActive(index); last = index }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { disposed = true; cancelAnimationFrame(raf); element.removeEventListener('wheel', wheel); element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up); element.removeEventListener('keydown', key); element.removeEventListener('pointerleave', leave); element.removeEventListener('click', click, true) }
  }, [onOpen])
  return <section className={`lookbook look-${mode}`} aria-label="Bambe Studio Lookbook">
    <nav className="look-nav" aria-label="Lookbook views"><button onClick={onFeatured}>Featured ↗</button><span>/</span>{['timeline', 'surf', 'index'].map(item => <button key={item} aria-pressed={mode === item} onClick={() => setMode(item)}>{item}</button>)}<button aria-pressed={mode === 'billymoon'} onClick={() => setMode('billymoon')}>BILLYMOON</button><button onClick={onAbout}>About</button></nav>
    <div className="look-title-wrap" hidden={mode === 'billymoon'}><JellyTitle/></div>
    {mode === 'billymoon' && <section id="billymoon" className="billymoon-feature" aria-labelledby="billymoon-title"><div className="billymoon-heading"><p className="eyebrow">Project / Interior visualization</p><h2 id="billymoon-title">BILLYMOON</h2><p>A closer look at the café seating area.</p></div><figure><img src={photo(billymoon.image)} alt={billymoon.alt} width="1280" height="720" loading="lazy" decoding="async"/><figcaption>Warm timber. Patterned upholstery. Natural light.</figcaption></figure><div className="billymoon-summary"><p>{billymoon.description}</p><div className="billymoon-actions"><button onClick={() => onOpen(billymoonIndex)}>Project details <span aria-hidden="true">↗</span></button><a className="public-viewer-link" href={`${import.meta.env.BASE_URL}billymoon/`}>Explore in 3D <span aria-hidden="true">↗</span></a></div></div></section>}
    <div className="look-stage" hidden={mode === 'billymoon'} ref={stage} tabIndex={0} role="region" aria-label="Project photographs. Drag, scroll, or use arrow keys.">
      {frames.map((p, i) => <button data-project={p.project} className="look-card" key={`${p.name}-${p.view}`} aria-label={`Open ${p.name}, ${p.view}`} onClick={e => { if (e.detail === 0) onOpen(p.project) }}><div className="look-photo" style={{ aspectRatio: [ .8, .72, 1.15 ][i % 3] }}><img loading="lazy" decoding="async" src={photo(p.image)} alt={`${p.name} — ${p.view.toLowerCase()}`} style={{ objectPosition: `${p.crop * 50}% center`, transform: `scale(${1 + p.crop * .18})` }} draggable="false" /></div><span className="look-meta"><span>{String(i + 1).padStart(2, '0')} / {p.view}</span><span>{p.year}</span></span><span className="look-name">{p.name}</span></button>)}
    </div>
    <footer className="look-footer" hidden={mode === 'billymoon'}><div className="look-status"><span>ARCHITECTURE / INTERIORS</span><span>SCROLL OR DRAG TO EXPLORE</span><span>{String(active + 1).padStart(2, '0')} — {String(frames.length).padStart(2, '0')}</span></div><div className="look-ruler" aria-label="Choose photograph">{frames.map((p, i) => <button key={i} aria-label={`Show ${p.name} ${p.view}`} aria-pressed={active === i} onClick={() => actions.current?.select(i)}><span>{i % 3 === 0 ? p.year : ''}</span></button>)}</div><div className="look-bottom"><button onClick={() => actions.current?.move(-1)} aria-label="Previous photograph">←</button><span>Spaces for life. A collection by Bambe Studio.</span><button onClick={() => actions.current?.move(1)} aria-label="Next photograph">→</button></div></footer>
  </section>
}
