import {test} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
test('public transport supports bounded model pieces',()=>assert.ok(existsSync('public/billymoon/model-transfer.js')))
test('every encoded runtime file reconstructs to its original hash',()=>{
 for(const tier of ['model','model-light']){
 const root=`public/billymoon/${tier}/`;const manifest=JSON.parse(readFileSync(root+'manifest.json'))
 for(const f of manifest.files){const bytes=f.parts?Buffer.concat(f.parts.map(p=>readFileSync(root+p.name))):readFileSync(root+f.name); assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256)}
 }
})
test('public loader reconstructs both tiers through its actual transfer function',async()=>{
 const {fetchModelPayload}=await import('../public/billymoon/model-transfer.js')
 for(const tier of ['model','model-light']){
  const base=new URL(`../public/billymoon/${tier}/`,import.meta.url);const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)))
  let progress=0
  for(const f of manifest.files){const result=await fetchModelPayload(f,base,async(url,expected,onChunk)=>{const b=readFileSync(url);assert.equal(b.length,expected);onChunk(b.length);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)},n=>progress+=n);assert.equal(createHash('sha256').update(new Uint8Array(result)).digest('hex'),f.sha256)}
  assert.equal(progress,manifest.bytes||manifest.totalBytes)
 }
})
test('public loader rejects missing or oversized pieces',async()=>{
 const {fetchModelPayload}=await import('../public/billymoon/model-transfer.js')
 const file={bytes:4,parts:[{name:'piece',bytes:4}]};const base=new URL('https://example.com/model/')
 await assert.rejects(fetchModelPayload(file,base,async()=>new ArrayBuffer(3),()=>{}),/Ukuran/)
 await assert.rejects(fetchModelPayload({...file,bytes:3},base,async()=>new ArrayBuffer(4),()=>{}),/Ukuran/)
})
