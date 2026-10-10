import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync,existsSync} from 'node:fs'
import {join,dirname} from 'node:path'
const root='public/billymoon', tag='v=graphics-20261009-v13'
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)])
test('entire local module graph uses one release identity',()=>{
 let refs=0
 for(const file of walk(root).filter(f=>f.endsWith('.js')||f.endsWith('index.html'))){
  const s=readFileSync(file,'utf8')
  for(const m of s.matchAll(/['"]((?:\.\/|\.\.\/)[^'"\s]+\.js(?:\?[^'"\s]*)?)['"]/g)){
   assert.ok(m[1].endsWith('?'+tag),`${file}: ${m[1]}`);assert.ok(existsSync(join(dirname(file),m[1].split('?')[0])),m[1]);refs++
  }
 }
 assert.ok(refs>40)
 const html=readFileSync(root+'/index.html','utf8');assert.ok(html.includes('style.css?'+tag));assert.ok(html.includes('./vendor/three.module.js?'+tag))
})
