import { useEffect, useRef, useState } from 'react'

const tracks = [
  { id: '7nvGNyJqZDQ', name: 'Sayoe — Lihat Gayaku' },
  { id: 'dS09OGNtZGA', name: 'Bambee Jeh — Cu' },
]
let apiPromise
function loadPlayerAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => fail(), 12000)
    function fail() { clearTimeout(timer); script.remove(); apiPromise = null; reject(new Error('YouTube unavailable')) }
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT) }
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = fail
    document.head.appendChild(script)
  })
  return apiPromise
}

export default function Soundtrack() {
  const [open, setOpen] = useState(false)
  const [track, setTrack] = useState(0)
  const [engaged, setEngaged] = useState(false)
  const [status, setStatus] = useState('idle')
  const [retry, setRetry] = useState(0)
  const mount = useRef(null), player = useRef(null), ready = useRef(false)
  const selected = useRef(0), wanted = useRef(false), root = useRef(null)
  const playing = status === 'playing'
  useEffect(() => {
    const dismiss = e => { if (!root.current?.contains(e.target)) setOpen(false) }
    const escape = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [])
  useEffect(() => {
    if (!engaged) return
    let cancelled = false, localPlayer
    const timer = setTimeout(() => { if (!cancelled && !ready.current) setStatus('error') }, 15000)
    loadPlayerAPI().then(YT => {
      if (cancelled) return
      const node = document.createElement('div'); mount.current.replaceChildren(node)
      localPlayer = new YT.Player(node, {
        width: '100%', height: '200', videoId: tracks[selected.current].id,
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: e => { if (cancelled) return; clearTimeout(timer); ready.current = true; player.current = e.target; e.target.setVolume(60); if (wanted.current) e.target.playVideo() },
          onStateChange: e => { if (cancelled) return; if (e.data === 1) setStatus('playing'); else if (e.data === 2) setStatus('paused'); else if (e.data === 0) { wanted.current = false; setStatus('ended') } else if (e.data === 3) setStatus('loading') },
          onAutoplayBlocked: () => { if (!cancelled) { wanted.current = false; setStatus('paused'); setOpen(true) } },
          onError: () => { if (!cancelled) { wanted.current = false; setStatus('error') } },
        },
      })
    }).catch(() => { if (!cancelled) { wanted.current = false; setStatus('error') } })
    return () => { cancelled = true; clearTimeout(timer); ready.current = false; player.current = null; localPlayer?.destroy() }
  }, [engaged, retry])
  const toggle = () => {
    if (status === 'error') { wanted.current = true; setStatus('loading'); setRetry(n => n + 1); return }
    if (!engaged) { wanted.current = true; setStatus('loading'); setEngaged(true); return }
    wanted.current = !wanted.current
    if (ready.current) { if (wanted.current) player.current.playVideo(); else player.current.pauseVideo() }
    else if (!wanted.current) setStatus('paused')
  }
  const choose = index => {
    if (index === selected.current) return
    selected.current = index; setTrack(index)
    if (ready.current) {
      if (wanted.current) { setStatus('loading'); player.current.loadVideoById(tracks[index].id) }
      else { player.current.cueVideoById(tracks[index].id); setStatus('paused') }
    }
  }
  const label = status === 'error' ? 'Retry' : playing || (status === 'loading' && wanted.current) ? 'Pause' : 'Play'
  return <aside ref={root} className={`soundtrack persistent-sound ${playing ? 'is-playing' : ''}`} aria-label="Studio soundtrack">
    <div className="mini-player">
      <button className="mini-cover" aria-label={`${label} ${tracks[track].name}`} onClick={toggle}><img src={`https://i.ytimg.com/vi/${tracks[track].id}/hqdefault.jpg`} alt=""/><span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span></button>
      <button className="mini-title" aria-expanded={open} aria-controls="music-menu" onClick={() => setOpen(!open)} title="Open music menu"><span>{tracks[track].name}</span><span className="equalizer" aria-hidden="true"><i/><i/><i/></span></button>
    </div>
    <div id="music-menu" className={`sound-panel ${open ? 'is-open' : ''}`} inert={!open} aria-hidden={!open}>
      <div className="sound-heading"><p className="sound-label">STUDIO SOUNDTRACK / 02</p><button aria-label="Close music menu" onClick={() => setOpen(false)}>×</button></div>
      {tracks.map((item, index) => <button className="track-option" key={item.id} aria-pressed={track === index} onClick={() => choose(index)}><img src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`} alt=""/><span>{item.name}</span><span>{track === index ? '●' : '○'}</span></button>)}
      <button className="play-track" onClick={toggle}>{label} {tracks[track].name}</button>
      <div className="youtube-mount" ref={mount}/>
      <p className="sound-help" aria-live="polite">{status === 'error' ? 'YouTube is unavailable in this browser. Retry or open the track below.' : status === 'loading' ? 'Connecting to YouTube…' : playing ? 'Playing · Close this menu to keep exploring.' : status === 'paused' ? 'Paused · Press Play to continue.' : 'Press Play to listen while you explore.'}</p>
      <a href={`https://www.youtube.com/watch?v=${tracks[track].id}`} target="_blank" rel="noreferrer">Open on YouTube ↗</a>
    </div>
  </aside>
}
