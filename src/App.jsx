import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import './App.css'
import Lookbook from './Lookbook'
import Soundtrack from './Soundtrack'
import './Glass.css'
import './Interactive.css'
import { spring, advanceSpring } from './motion'
import { TRAIL_LENGTH, galleryVertexShader, galleryFragmentShader } from './galleryShaders'

const projects = [
  { name: 'Courtyard House', category: 'Residential', location: 'Bandung', year: '2025', image: 'photo-1600607687939-ce8a6c25118c', description: 'A quiet home shaped around light, greenery, and shared moments.' },
  { name: 'The Common Ground', category: 'Commercial', location: 'Jakarta', year: '2025', image: 'photo-1497366754035-f200968a6e72', description: 'An open workspace that makes room for connection and new ideas.' },
  { name: 'Still Living', category: 'Interior', location: 'Surabaya', year: '2024', image: 'photo-1600210492486-724fe5c67fb0', description: 'Warm materials and thoughtful details for the everyday.' },
  { name: 'BILLYMOON', category: 'Interior', image: 'projects/billymoon-interior.webp', description: 'An interior visualization of the BILLYMOON café seating area. Warm timber, patterned upholstery, and daylight define the space.', note: 'Architectural 3D model · Interior visualization', alt: 'BILLYMOON café interior with patterned lounge chairs, pale tables, timber flooring, and a service counter.' },
]
const photo = (id) => id.startsWith('projects/') ? `${import.meta.env.BASE_URL}${id}` : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=85`
const wrap = (n, length) => ((n % length) + length) % length

function Gallery({ controller, onChange, onOpen }) {
  const host = useRef(null)
  const [fallback, setFallback] = useState(false)
  const actions = useRef(null)
  useImperativeHandle(controller, () => ({ move: (n) => actions.current?.move(n), select: (n) => actions.current?.select(n) }), [])
  useEffect(() => {
    const element = host.current
    let renderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) } catch { queueMicrotask(() => setFallback(true)); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    renderer.setClearColor(0xffffff, 0)
    element.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 1, 5000)
    camera.position.z = 1000
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = media.matches
    let current = reduced ? 0 : -.65, target = 0, width = 0, height = 0, cardWidth = 0, cardHeight = 0, step = 0
    const gallerySpring = spring(current)
    let frame, disposed = false, drag = null, lastIndex = -1, dirty = true
    const meshes = [], textures = [], labels = []
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
    let lastPointer = null, flowUntil = 0
    const loader = new THREE.TextureLoader()
    projects.forEach((project, index) => {
      const texture = loader.load(photo(project.image), () => { if (!disposed) { dirty = true } }, undefined, () => { if (!disposed) setFallback(true) })
      texture.colorSpace = THREE.SRGBColorSpace
      textures.push(texture)
      for (let repeat = -1; repeat <= 1; repeat++) {
        const material = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: texture }, bend: { value: 0 }, imageAspect: { value: 1.5 }, cardAspect: { value: 1.5 },
            trail: { value: Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector4()) },
            life: { value: Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector2(2, 0)) },
          },
          vertexShader: galleryVertexShader,
          fragmentShader: galleryFragmentShader,
          side: THREE.DoubleSide,
        })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 36, 16), material)
        mesh.userData.index = index + repeat * projects.length
        mesh.userData.trailCursor = 0
        mesh.userData.births = new Float64Array(TRAIL_LENGTH).fill(-10000)
        scene.add(mesh); meshes.push(mesh)
        const label = document.createElement('div')
        label.className = 'floating-label'
        label.textContent = project.name
        label.setAttribute('aria-hidden', 'true')
        element.appendChild(label); labels.push(label)
      }
    })
    const resize = () => {
      width = element.clientWidth; height = element.clientHeight
      renderer.setSize(width, height)
      camera.aspect = width / height; camera.updateProjectionMatrix()
      const worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(21)) * 1000
      const worldWidth = worldHeight * camera.aspect
      cardWidth = worldWidth * (width < 700 ? .78 : .48)
      cardHeight = Math.min(worldHeight * .61, cardWidth * (width < 700 ? 1.3 : .72))
      step = cardWidth * 1.06
      dirty = true
    }
    const observer = new ResizeObserver(resize); observer.observe(element); resize()
    const move = (n) => { target = Math.round(target) + n; dirty = true }
    actions.current = { move, select: (index) => { target += wrap(index - Math.round(target) + projects.length / 2, projects.length) - projects.length / 2; dirty = true } }
    const wheel = (event) => { event.preventDefault(); target += Math.max(-160, Math.min(160, event.deltaY || event.deltaX)) * .003; dirty = true }
    const down = (event) => { if (event.button !== 0 || !event.isPrimary) return; drag = { x: event.clientX, start: target, moved: false }; element.setPointerCapture(event.pointerId); element.classList.add('dragging') }
    const pointermove = (event) => {
      if (!reduced) {
        const now = performance.now()
        const rect = element.getBoundingClientRect()
        pointer.set((event.clientX - rect.left) / width * 2 - 1, -(event.clientY - rect.top) / height * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(meshes)[0]
        if (hit) {
          if (lastPointer?.mesh === hit.object && now - lastPointer.time < 100) {
            const distance = lastPointer.uv.distanceTo(hit.uv)
            if (distance > .001) {
              const mesh = hit.object, slot = mesh.userData.trailCursor
              mesh.material.uniforms.trail.value[slot].set(lastPointer.uv.x, lastPointer.uv.y, hit.uv.x, hit.uv.y)
              mesh.material.uniforms.life.value[slot].set(0, Math.min(1.4, distance * 45))
              mesh.userData.births[slot] = now
              mesh.userData.trailCursor = (slot + 1) % TRAIL_LENGTH
              flowUntil = now + 1400
              dirty = true
            }
          }
          lastPointer = { mesh: hit.object, uv: hit.uv.clone(), time: now }
        } else lastPointer = null
      }
      if (!drag) return
      const delta = event.clientX - drag.x
      drag.moved ||= Math.abs(delta) > 6
      target = drag.start - delta / (width * .5)
      dirty = true
    }
    const end = (event) => { if (!drag) return; const clicked = !drag.moved; drag = null; target = Math.round(target); element.classList.remove('dragging'); if (clicked && event.type !== 'pointercancel') onOpen(wrap(Math.round(target), projects.length)) }
    const key = (event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1) } }
    const changeMotion = () => { reduced = media.matches; dirty = true }
    element.addEventListener('wheel', wheel, { passive:false }); element.addEventListener('pointerdown',down); element.addEventListener('pointermove',pointermove); element.addEventListener('pointerup',end); element.addEventListener('pointercancel',end); element.addEventListener('keydown',key); media.addEventListener('change',changeMotion)
    let previousTime = performance.now()
    const tick = (time) => {
      if (disposed) return
      const dt = Math.min((time - previousTime) / 16.67, 3); previousTime = time
      const velocity = target - current
      
      if (dirty || Math.abs(velocity) > .0001 || time < flowUntil) {
        if (reduced) { gallerySpring.value = target; gallerySpring.velocity = 0 }
        current = reduced ? target : advanceSpring(gallerySpring, target, dt / 60, 160, 22)
        meshes.forEach((mesh, index) => {
          const offset = wrap(mesh.userData.index - current + projects.length * 1.5, projects.length * 3) - projects.length * 1.5
          mesh.position.set(offset * step, Math.sin(offset * .65) * cardHeight * .09, -Math.abs(offset) * 55)
          mesh.rotation.y = reduced ? 0 : -offset * .12
          mesh.scale.set(cardWidth, cardHeight, 1)
          mesh.material.uniforms.bend.value = reduced ? 0 : 65 + Math.min(Math.abs(velocity), 1) * 120
          mesh.material.uniforms.life.value.forEach((life, i) => { life.x = reduced ? 2 : (time - mesh.userData.births[i]) / 1000 })
          mesh.material.uniforms.cardAspect.value = cardWidth / cardHeight
          const texture = mesh.material.uniforms.map.value
          if (texture.image) mesh.material.uniforms.imageAspect.value = texture.image.width / texture.image.height
          const point = new THREE.Vector3(0, -.5, 0); mesh.updateMatrixWorld(); mesh.localToWorld(point); point.project(camera)
          labels[index].style.transform = `translate(${(point.x * .5 + .5) * width}px,${(-point.y * .5 + .5) * height + 16}px) translateX(-50%)`
          labels[index].style.opacity = Math.abs(offset) < 1.7 ? '1' : '0'
        })
        const active = wrap(Math.round(current), projects.length)
        if (active !== lastIndex) { onChange(active); lastIndex = active }
        renderer.render(scene, camera); dirty = false
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); media.removeEventListener('change',changeMotion)
      element.removeEventListener('wheel',wheel); element.removeEventListener('pointerdown',down); element.removeEventListener('pointermove',pointermove); element.removeEventListener('pointerup',end); element.removeEventListener('pointercancel',end); element.removeEventListener('keydown',key)
      meshes.forEach(m => { m.geometry.dispose(); m.material.dispose() }); textures.forEach(t=>t.dispose()); labels.forEach(l=>l.remove()); renderer.dispose(); renderer.domElement.remove(); actions.current = null
    }
  }, [controller, onChange, onOpen])
  return <div className="scene" ref={host} tabIndex={0} role="region" aria-roledescription="carousel" aria-label="Featured architecture. Scroll, drag, or use arrow keys to browse.">{fallback && <div className="fallback">{projects.map((p,i)=><button key={p.name} onClick={()=>onOpen(i)}><img src={photo(p.image)} alt={p.name}/><span>{p.name}</span></button>)}</div>}</div>
}

export default function App() {
  const controller = useRef(null)
  const dialog = useRef(null)
  const [active, setActive] = useState(0)
  const [panel, setPanel] = useState(null)
  const [category, setCategory] = useState('All')
  const [lookbook, setLookbook] = useState(true)
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const highlight = event => {
      if (motion.matches || event.pointerType === 'touch') return
      const surface = event.target.closest('.look-photo, .look-nav, .sound-toggle, .sound-panel, .panel, .gallery-instructions')
      if (!surface) return
      const bounds = surface.getBoundingClientRect()
      surface.style.setProperty('--shine-x', `${(event.clientX - bounds.left) / bounds.width * 100}%`)
      surface.style.setProperty('--shine-y', `${(event.clientY - bounds.top) / bounds.height * 100}%`)
    }
    document.addEventListener('pointermove', highlight, { passive: true })
    return () => document.removeEventListener('pointermove', highlight)
  }, [])
  const openProject = useCallback((index) => setPanel(index), [])
  useEffect(() => { if (panel !== null) dialog.current?.showModal(); else dialog.current?.close() }, [panel])
  const project = projects[active]
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#home" onClick={()=>controller.current?.select(0)}>bambe studio<span>Architecture & interiors</span></a><button onClick={()=>setPanel('studio')}>The studio <span>↗</span></button></header>
    <main id="home"><h1 className="sr-only">Bambe Studio — selected architecture projects</h1><div className="exhibition-label">Spaces for life.<span>{project.year ? 'Selected works — 2024 / 2025' : 'Selected works — Interior visualization'}</span></div><Gallery controller={controller} onChange={setActive} onOpen={openProject}/><div className="project-caption"><p aria-live="polite"><span>{String(active+1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</span>{project.location ? `${project.location} — ${project.category}, ${project.year}` : `${project.category} · Interior visualization`}</p><button onClick={()=>setPanel(active)}>Explore project <span>↗</span></button></div></main>
    <footer className="site-footer"><nav aria-label="Project views"><button className="selected" onClick={()=>setPanel(null)}>Featured</button><span>/</span><button onClick={()=>setLookbook(true)}>Lookbook ↗</button><span>/</span><button onClick={()=>setPanel('index')}>All projects</button></nav><div className="gallery-instructions"><button aria-label="Previous project" onClick={()=>controller.current?.move(-1)}>←</button><span>Scroll or drag to explore</span><button aria-label="Next project" onClick={()=>controller.current?.move(1)}>→</button></div><button onClick={()=>setPanel('contact')}>Let’s talk ↗</button></footer>
    {lookbook && <Lookbook projects={projects} photo={photo} onOpen={openProject} onFeatured={()=>setLookbook(false)} onAbout={()=>setPanel('studio')}/>}
    <Soundtrack/>
    <dialog ref={dialog} onCancel={()=>setPanel(null)} onClose={()=>setPanel(null)} onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}><div className="panel"><button className="close" aria-label="Close panel" onClick={()=>setPanel(null)}>Close ×</button>
      {typeof panel === 'number' ? <><p className="eyebrow">{projects[panel].category}{projects[panel].year ? ` / ${projects[panel].year}` : ' / Interior visualization'}</p><h2>{projects[panel].name}</h2><img className="detail-image" src={photo(projects[panel].image)} alt={projects[panel].alt || projects[panel].name} loading="lazy" decoding="async"/><p>{projects[panel].description}</p><p className="note">{projects[panel].note || `${projects[panel].location} · Concept portfolio. Sample project and reference photography.`}</p></> : panel === 'index' ? <><p className="eyebrow">The collection</p><h2>All projects</h2><div className="filters">{['All','Residential','Commercial','Interior'].map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="index-list">{projects.map((p,i)=>(category==='All'||p.category===category)&&<button key={p.name} onClick={()=>setPanel(i)}><img src={photo(p.image)} alt=""/><span>{p.name}<small>{p.location ? `${p.location} · ${p.year}` : 'Interior visualization'}</small></span><span>↗</span></button>)}</div></> : panel === 'studio' ? <><p className="eyebrow">Bambe Studio</p><h2>Good spaces begin<br/>with understanding.</h2><p>We explore how light, material, and proportion can turn a space into somewhere you belong.</p><p>Architecture. Interiors. Spaces for life.</p><p className="note">Concept portfolio · Sample projects and reference photography.</p></> : <><p className="eyebrow">Start a conversation</p><h2>Let’s make room<br/>for your next idea.</h2><p>Contact details coming soon.</p></>}
    </div></dialog>
  </div>
}



