import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
const root='public/billymoon/'
test('independent floorplan entry and accessible fallback launchers ship together',()=>{
 assert.ok(existsSync(root+'floorplan-entry.js'))
 const html=readFileSync(root+'index.html','utf8');for(const id of ['floorplan-dialog','floorplan-level','floorplan-canvas','error-map','loading-map'])assert.ok(html.includes(`id="${id}"`),id)
 assert.ok(html.includes('./floorplan-entry.js?'))
})
test('three floorplan projections retain source provenance and exact approved bytes',()=>{
 const b=readFileSync(root+'floorplans-6585641acb50.json');assert.equal(b.length,216304);assert.equal(createHash('sha256').update(b).digest('hex'),'6585641acb50b53e1c4f88438cfbd77080517ca3800ef25c359019a34e3907ac')
 const d=JSON.parse(b);assert.deepEqual(d.levels.map(l=>l.id),['site','ground','upper']);assert.equal(d.provenance.selectedNodeCount,1167);assert.ok(d.mapTop.includes('not surveyed north'));assert.equal(d.units,'metres')
})
