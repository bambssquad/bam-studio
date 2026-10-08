import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const root='public/billymoon'
test('public viewer ships both runtime variants and local dependencies',()=>{
 for(const file of ['index.html','app.js','style.css','vendor/three.module.js','vendor/GLTFLoader.js','model-light/manifest.json','model/manifest.json']) assert.ok(existsSync(join(root,file)),file)
})
test('portfolio has public 3D exploration entry points',()=>{
 for(const file of ['src/App.jsx','src/Lookbook.jsx']) assert.ok(readFileSync(file,'utf8').includes('billymoon/'),file)
})
test('public distribution excludes private project configuration and source archives',()=>{
 assert.ok(existsSync(root))
 const walk=dir=>readdirSync(dir).flatMap(name=>statSync(join(dir,name)).isDirectory()?walk(join(dir,name)):[join(dir,name)])
 for(const path of walk(root)) {
  assert.ok(statSync(path).size<100*1024*1024,path)
  assert.doesNotMatch(path, /(?:\.git|\.env|\.openai|\.skp$|\.blend$|\.zip$)/)
 }
})
