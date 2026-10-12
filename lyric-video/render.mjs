// Deterministic renderer: dist/ -> headless Chromium seek(t) -> JPEG frames -> ffmpeg.
// node render.mjs --stills 0,10,20 [--out out/stills]      stills + contact sheet
// node render.mjs [--from 0 --to 219] [--workers 4] [--fps 30] [--scale 1] [--out out/berbicara.mp4]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs'

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const DIST = path.resolve('dist'), FPS = +arg('fps', 30), SCALE = +arg('scale', 1), W = 1080, H = 1920
const AUDIO = path.resolve('data/berbicara.mp3'), DUR = JSON.parse(fs.readFileSync('data/audio.json')).duration

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.mp3': 'audio/mpeg' }
const server = http.createServer((q, s) => {
  const p = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'))
  if (q.url.startsWith('/favicon')) { s.writeHead(204); return s.end() }
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { console.log('404', q.url); s.writeHead(404); return s.end() }
  s.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }); fs.createReadStream(p).pipe(s)
}).listen(0)
const URL = `http://127.0.0.1:${server.address().port}/?render`

const launch = () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const browsers = []
async function page() { // one browser (own GPU process) per worker; a shared one serialises SwiftShader
  const b = await launch(); browsers.push(b)
  const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE })
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()))
  await pg.goto(URL); await pg.evaluate(() => window.__ready)
  if (errs.length) throw new Error('page errors: ' + errs.join(' | '))
  return pg
}
const shot = async (pg, t) => { await pg.evaluate(t => window.__seek(t), t); return pg.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H }, timeout: 180000 }) }

if (process.argv.includes('--dumpcuts')) { const pg = await page(); fs.writeFileSync(arg('dumpcuts', 'out/cuts.json'), JSON.stringify(await pg.evaluate(() => window.__cuts))); await Promise.all(browsers.map(b => b.close())); server.close(); process.exit(0) }
const stills = arg('stills')
if (stills) {
  const out = arg('out', 'out/stills'); fs.mkdirSync(out, { recursive: true })
  const pg = await page(), ts = stills.split(',').map(Number), files = []
  for (const t of ts) { const f = path.join(out, `t${t.toFixed(3).padStart(8, '0')}.jpg`); const t0 = Date.now(); fs.writeFileSync(f, await shot(pg, t)); files.push(f); console.log(`still ${t}s ${Date.now() - t0}ms`) }
  const cols = Math.min(6, files.length), rows = Math.ceil(files.length / cols)
  if (files.length === 1) fs.copyFileSync(files[0], path.join(out, 'contact.jpg')); else
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex',
    files.map((_, i) => `[${i}]scale=270:480,drawtext=text='${ts[i]}s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`).join(';') + ';' +
    files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join('|')}:fill=black`,
    path.join(out, 'contact.jpg')])
  console.log('contact sheet', path.join(out, 'contact.jpg'), `${cols}x${rows}`)
} else {
  const from = +arg('from', 0), to = +arg('to', DUR), workers = +arg('workers', 4), out = arg('out', 'out/berbicara.mp4')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const n = Math.round((to - from) * FPS), per = Math.ceil(n / workers), t0 = Date.now()
  let done = 0
  const parts = await Promise.all([...Array(workers)].map(async (_, w) => {
    const a = w * per, b = Math.min(n, a + per); if (a >= b) return null
    const pg = await page(), file = `${out}.part${w}.mp4`
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-vf', `scale=${W}:${H}`, file], { stdio: ['pipe', 'inherit', 'inherit'] })
    for (let f = a; f < b; f++) {
      const buf = await shot(pg, from + f / FPS)
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r))
      if (++done % 150 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${n} frames · ${(done / el).toFixed(1)} fps · eta ${((n - done) / (done / el) / 60).toFixed(1)} min`) }
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); await pg.close(); return file
  }))
  const list = `${out}.txt`; fs.writeFileSync(list, parts.filter(Boolean).map(p => `file '${path.resolve(p)}'`).join('\n'))
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from), '-t', String(to - from), '-i', AUDIO,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out])
  for (const p of parts.filter(Boolean)) fs.unlinkSync(p); fs.unlinkSync(list)
  console.log(`done ${out} · ${n} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min`)
}
await Promise.all(browsers.map(b => b.close())); server.close()
