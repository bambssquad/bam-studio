import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'

test('initial portfolio renders BILLYMOON alongside all three existing projects', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null } })
  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx')
    const html = renderToString(React.createElement(App))
    for (const name of ['Courtyard House', 'The Common Ground', 'Still Living', 'BILLYMOON']) assert.ok(html.includes(name))
    assert.equal((html.match(/class="look-card"/g) || []).length, 12)
    assert.equal((html.match(/\/bam-studio\/projects\/billymoon-interior.webp/g) || []).length, 3)
    assert.ok(html.includes('>BILLYMOON</button>'))
    assert.ok(!html.includes('undefined'))
  } finally {
    await server.close()
  }
})
