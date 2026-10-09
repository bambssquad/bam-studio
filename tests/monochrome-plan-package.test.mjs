import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
const root='public/billymoon/'
test('monochrome plan entry and circuit furniture dimension controls ship together',()=>{
 assert.ok(existsSync(root+'floorplan-detail.js'))
 const html=readFileSync(root+'index.html','utf8');for(const id of ['floorplan-circuit','floorplan-furniture','floorplan-dimensions'])assert.ok(html.includes(`id="${id}"`),id)
 assert.ok(readFileSync(root+'floorplan-entry.js','utf8').includes('floorplans-4a6cbb0e3b83.json'))
})
test('lazy floor payloads and final base match exact approved hashes and budget',()=>{
 const b=readFileSync(root+'floorplans-4a6cbb0e3b83.json');assert.equal(b.length,296315);assert.equal(createHash('sha256').update(b).digest('hex'),'4a6cbb0e3b83cd2561036a9aaf80754e79302d55b97be395a5a4a2bb18d7c7b4')
 const d=JSON.parse(b);assert.deepEqual(d.levels.map(l=>l.id),['site','ground','upper'])
 for(const level of d.levels){const f=level.detail;assert.ok(f.bytes<1500000);const payload=readFileSync(root+f.url.replace(/^\.\//,''));assert.equal(payload.length,f.bytes);assert.equal(createHash('sha256').update(payload).digest('hex'),f.sha256)}
})
