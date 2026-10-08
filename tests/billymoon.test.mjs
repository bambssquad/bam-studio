import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const app = readFileSync('src/App.jsx','utf8')
const look = readFileSync('src/Lookbook.jsx','utf8')
test('BILLYMOON is a project with an owned interior visualization',()=>{
 assert.match(app, /name: 'BILLYMOON'/)
 assert.match(app, /projects\/billymoon-interior\.webp/)
})
test('Dedicated BILLYMOON section is accessible from Lookbook navigation',()=>{
 assert.match(look, /id="billymoon"/)
 assert.match(look, /Project details/)
})
test('Gallery and lookbook totals scale with the project collection',()=>{
 assert.doesNotMatch(app, /wrap\(index - Math.round\(target\) \+ 1, 3\)/)
 assert.doesNotMatch(app, /4\.5, 9/)
 assert.doesNotMatch(look, /— 09/)
})
test('Private walkthrough is not exposed in public portfolio',()=>{
 assert.doesNotMatch(app+look,/billymoon-3d-viewer|\.glb|\.skp/)
})
test('narrow screens can reach every Lookbook navigation control',()=>{
 const css = readFileSync('src/Lookbook.css','utf8')
 assert.match(css, /\.look-nav\{max-width:calc\(100% - 30px\);overflow-x:auto/)
})
test('dedicated view skips hidden gallery layout work',()=>{
 assert.match(look, /if \(modeRef.current === 'billymoon'\) \{ lastTime = time; raf = requestAnimationFrame\(tick\); return \}/)
})
test('mobile nav starts at a reachable scroll origin despite the glass layer',()=>{
 assert.match(readFileSync('src/Lookbook.css','utf8'), /\.lookbook \.look-nav\{justify-content:flex-start\}/)
})
test('feature render keeps its full-width aspect ratio without side letterboxing',()=>{
 assert.match(readFileSync('src/Lookbook.css','utf8'), /figure img\{display:block;width:100%;height:auto;max-height:none/)
})
