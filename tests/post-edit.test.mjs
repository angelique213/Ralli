import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Exercise the real service with a fake database; no account or network is used.
const source = readFileSync(new URL('../src/services/feed.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replaceAll('export ', '')
function service(result) {
  const calls = []
  const query = Object.fromEntries(['from', 'update', 'eq', 'select'].map((method) => [method, (...args) => { calls.push([method, ...args]); return query }]))
  query.maybeSingle = async () => result
  const context = { supabase: query }
  runInNewContext(source + '\nthis.edit = updatePost', context)
  return { edit: context.edit, calls }
}

test('caption update only writes body and filters both post and owner', async () => {
  const { edit, calls } = service({ data: { id: 'post', body: 'Edited' } })
  await edit('post', 'owner', '  Edited  ')
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['from', 'posts'], ['update', { body: 'Edited' }], ['eq', 'id', 'post'],
    ['eq', 'user_id', 'owner'], ['select', 'id, body'],
  ])
})
test('rejects empty text-only, oversized, and signed-out updates before any query', async () => {
  const { edit, calls } = service({})
  await assert.rejects(edit('post', 'owner', ' \n '))
  await assert.rejects(edit('post', 'owner', 'x'.repeat(5001)))
  await assert.rejects(edit('post', '', 'Text'))
  assert.equal(calls.length, 0)
})
test('permits a blank caption with an existing image', async () => {
  const { edit } = service({ data: { id: 'post', body: '' } })
  assert.equal((await edit('post', 'owner', '  ', true)).body, '')
})
test('does not report success for a denied or missing row', async () => {
  const { edit } = service({ data: null })
  await assert.rejects(edit('post', 'owner', 'Text'), /no longer available/)
})
test('reports database errors without claiming a save', async () => {
  const { edit } = service({ error: { message: 'Request failed' } })
  await assert.rejects(edit('post', 'owner', 'Text'), /Could not confirm the update/)
})
