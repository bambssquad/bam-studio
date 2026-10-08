import {test} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const root='public/billymoon/'
test('whole-building publication includes guarded loader and UI wiring',()=>{
 assert.ok(existsSync(root+'whole-building-bake.js'))
 const app=readFileSync(root+'app.js','utf8');assert.match(app,/createWholeBuildingBake/);assert.match(app,/fetchModelPayload/);assert.match(app,/wholeBake\.ensureLoaded/)
 const html=readFileSync(root+'index.html','utf8');assert.match(html,/id="bake-scope"/);assert.match(html,/id="geometry-detail"/)
})
test('all whole-building assets match their bounded manifest hashes',async()=>{
 const m=JSON.parse(readFileSync(root+'whole-bake/manifest-fa01c1cf9108.json'))
 assert.equal(m.coverage.placements,1845);assert.equal(m.zones.length,16);assert.equal(m.instances.length,1845)
 for(const asset of [m.overviewSheet,...m.zones.map(z=>z.detail),...m.geometryBinary.parts]){
  const b=readFileSync(root+asset.url.replace(/^\.\//,''));assert.equal(b.length,asset.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),asset.sha256);assert.ok(b.length<=1800000)
 }
 const {fetchVerifiedBinary}=await import('../public/billymoon/bake-geometry.js')
 const bytes=await fetchVerifiedBinary(m.geometryBinary,async url=>new Response(readFileSync(root+url.replace(/^\.\//,''))))
 assert.equal(createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),m.geometryBinary.sha256)
})
