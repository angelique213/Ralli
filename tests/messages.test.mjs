import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const source = readFileSync(new URL('../src/services/messages.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replaceAll('export ', '')
const a = '11111111-1111-4111-8111-111111111111'
const b = '22222222-2222-4222-8222-222222222222'
const id = '33333333-3333-4333-8333-333333333333'
function service(results = []) {
  const calls = []
  const query = Object.fromEntries(['from', 'select', 'eq', 'or', 'order', 'insert'].map((name) => [name, (...args) => { calls.push([name, ...args]); return query }]))
  for (const name of ['single', 'maybeSingle', 'limit', 'rpc', 'in']) query[name] = (...args) => { calls.push([name, ...args]); return Promise.resolve(results.shift()) }
  const context = { supabase: query }
  runInNewContext(source + '\nthis.api = {sendMessage, getMessages, getInbox, validateMessage, unsendMessage, preserveUnsent, hideMessage, hideConversation, filterHidden, getMessageText, messagingError}', context)
  return { ...context.api, calls }
}
test('invalid messages and recipient IDs never reach Supabase', async () => {
  const s = service()
  for (const body of ['', ' \n\t ', 'x'.repeat(2001)]) await assert.rejects(s.sendMessage(a,b,body,id))
  await assert.rejects(s.sendMessage(a,a,'hello',id))
  await assert.rejects(s.sendMessage(a,'bad,filter','hello',id))
  assert.equal(s.calls.length, 0)
})
test('send supplies only allowed columns, never a sender or timestamp', async () => {
  const s = service([{ data: { id } }])
  assert.equal((await s.sendMessage(a,b,' hello ',id)).id,id)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls.find(([name]) => name === 'insert')[1])), { id, recipient_id: b, body: 'hello' })
})
test('uncertain send retry confirms exact saved message', async () => {
  const s = service([{error:{code:'23505'}},{data:{id,sender_id:a,recipient_id:b,body:'hello'}}])
  assert.equal((await s.sendMessage(a,b,'hello',id)).id,id)
  const denied = service([{error:{code:'23505'}},{data:{id,sender_id:b,recipient_id:a,body:'hello'}}])
  await assert.rejects(denied.sendMessage(a,b,'hello',id))
})
test('failed send is not reported as success', async () => {
  await assert.rejects(service([{error:{code:'42501'}}]).sendMessage(a,b,'hello',id))
})
test('history requests both directions and displays the newest page chronologically', async () => {
  const s = service([{data:[{id:3},{id:2},{id:1}]}])
  const result = await s.getMessages(a,b,2)
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{messages:[{id:2},{id:3}],hasMore:true})
  assert.equal(s.calls.find(([name])=>name==='or')[1],`and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`)
})
test('inbox uses paginated RLS-respecting RPC', async () => {
  const s = service([{data:Array.from({length:21},()=>({user_id:b}))}])
  const result = await s.getInbox(2)
  assert.equal(result.people.length,20)
  assert.equal(result.hasMore,true)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls)),[['rpc','ralli_message_inbox',{page_offset:40}]])
})

test('unsend calls only the restricted RPC and validates confirmation', async () => {
  const s = service([{data:{id,unsent_at:'2026-11-20T10:00:00Z'}}])
  assert.equal((await s.unsendMessage(id)).id,id)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls)),[['rpc','ralli_unsend_message',{message_id:id}]])
  await assert.rejects(service().unsendMessage('invalid'))
  await assert.rejects(service([{data:null}]).unsendMessage(id))
  await assert.rejects(service([{error:{code:'42501'}}]).unsendMessage(id))
  await assert.rejects(service([{error:{code:'PGRST202'}}]).unsendMessage(id),/migration/)
})
test('confirmed unsend scrubs stale poll text but preserves history and other messages', () => {
  const s = service()
  const known = new Map([[id,'2026-11-20T10:00:00Z']])
  const data = {messages:[{id,body:'old text',created_at:'original'}, {id:b,body:'keep'}],hasMore:true}
  const result = s.preserveUnsent(data,known)
  assert.equal(result.messages[0].body,null)
  assert.equal(result.messages[0].created_at,'original')
  assert.equal(result.messages[1].body,'keep')
  assert.equal(result.hasMore,true)
})
test('recipient remembers an observed unsend across later stale responses', () => {
  const s = service()
  const known = new Map()
  s.preserveUnsent({messages:[{id,body:null,unsent_at:'saved'}]},known)
  assert.equal(s.preserveUnsent({messages:[{id,body:'stale'}]},known).messages[0].body,null)
})
test('retrying a sent then unsent message cannot recreate its text', async () => {
  const s = service([{error:{code:'23505'}},{data:{id,sender_id:a,recipient_id:b,body:null,unsent_at:'saved'}}])
  await assert.rejects(s.sendMessage(a,b,'hello',id),/already unsent/)
  assert.equal(s.calls.filter(([name])=>name==='insert').length,1)
})

test('hide message uses only its ID and requires confirmed success', async () => {
  const s = service([{data:{id,hidden:true}}])
  assert.equal((await s.hideMessage(id)).hidden,true)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls)),[['rpc','ralli_hide_message',{message_id:id}]])
  await assert.rejects(service().hideMessage('bad'))
  await assert.rejects(service([{error:{code:'42501'}}]).hideMessage(id))
  await assert.rejects(service([{data:{id:b,hidden:true}}]).hideMessage(id))
})
test('conversation retry retains the same request token', async () => {
  const s = service([{error:{code:'network'}},{data:{other_user_id:b,request_id:id,hidden:true}}])
  await assert.rejects(s.hideConversation(b,id))
  await s.hideConversation(b,id)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0])),JSON.parse(JSON.stringify(s.calls[1])))
  await assert.rejects(service([{data:{other_user_id:a,request_id:id,hidden:true}}]).hideConversation(b,id))
})
test('hidden IDs cannot reappear through stale polls; new messages survive', () => {
  const s = service()
  const result = s.filterHidden({messages:[{id,body:'hidden'},{id:b,body:'new'}],hasMore:true},new Set([id]))
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{messages:[{id:b,body:'new'}],hasMore:true})
  const unsent = s.preserveUnsent({messages:[{id,body:'stale'},{id:b,body:'new'}]},new Map([[b,'saved']]))
  assert.equal(s.filterHidden(unsent,new Set([id])).messages[0].body,null)
})
test('send retry cannot recreate a hidden message', async () => {
  await assert.rejects(service([{error:{code:'23505'}},{data:null}]).sendMessage(a,b,'text',id),/no longer visible/)
})

test('quote/forward source is read through the existing RLS client', async () => {
  const s = service([{data:{body:'Text',unsent_at:null}}])
  assert.equal(await s.getMessageText(id),'Text')
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls)),[['from','messages'],['select','body, unsent_at'],['eq','id',id],['maybeSingle']])
})
test('quote/forward rejects unavailable, hidden, unsent, and failed reads', async () => {
  for (const result of [{data:null},{data:{body:null,unsent_at:'saved'}},{error:{code:'42501'}}]) {
    await assert.rejects(service([result]).getMessageText(id),/no longer available/)
  }
  const s = service()
  await assert.rejects(s.getMessageText('bad'))
  assert.equal(s.calls.length,0)
})

test('linked reply inserts only its own text and the original ID', async () => {
  const s = service([{ data: { id } }])
  await s.sendMessage(a,b,'yes',id,a)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls.find(([name]) => name === 'insert')[1])),
    {id, recipient_id:b, body:'yes', reply_to_message_id:a})
  await assert.rejects(service().sendMessage(a,b,'yes',id,'bad-id'))
})
test('send retry must match the original reply reference', async () => {
  const s = service([{error:{code:'23505'}},{data:{id,sender_id:a,recipient_id:b,body:'yes',reply_to_message_id:b}}])
  await assert.rejects(s.sendMessage(a,b,'yes',id,a))
})
test('history without replies needs no embedded relationship or extra query', async () => {
  const s = service([{data:[]}])
  await s.getMessages(a,b)
  assert.doesNotMatch(s.calls.find(([name]) => name === 'select')[1], /reply:messages/)
  assert.equal(s.calls.filter(([name]) => name === 'from').length, 1)
})
test('unsending original scrubs stale linked previews', () => {
  const s = service()
  const known = new Map()
  s.preserveUnsent({messages:[{id,reply:{id:a,body:null,unsent_at:'now'}}]},known)
  const result = s.preserveUnsent({messages:[{id,body:'yes',reply:{id:a,body:'private original'}}]},known)
  assert.equal(result.messages[0].reply.body,null)
  assert.equal(result.messages[0].body,'yes')
})
test('hidden original stays unavailable in stale previews without hiding reply', () => {
  const s = service()
  const hidden = new Set()
  s.filterHidden({messages:[{id,reply_to_message_id:a,reply:null}]},hidden)
  const result = s.filterHidden({messages:[{id,body:'yes',reply_to_message_id:a,reply:{id:a,body:'hidden'}},{id:a,body:'hidden'}]},hidden)
  assert.equal(result.messages.length,1)
  assert.equal(result.messages[0].reply,null)
  assert.equal(result.messages[0].body,'yes')
})

 test('relationship errors are not reported as connection failures', () => {
  const s = service()
  for (const code of ['PGRST200', 'PGRST201']) assert.match(s.messagingError({code}), /reply relationship/)
})

test('reply preview loads exact original text outside the history page', async () => {
  const original = {id:a,sender_id:b,recipient_id:a,body:'Original question',unsent_at:null}
  const s = service([{data:[{id,body:'yes',reply_to_message_id:a}]},{data:[original]}])
  const result = await s.getMessages(a,b)
  assert.equal(result.messages[0].reply.body,'Original question')
  assert.equal(result.messages[0].reply.sender_id,b)
  assert.equal(result.messages[0].body,'yes')
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls.find(([name])=>name==='in'))),['in','id',[a]])
})
test('RLS-hidden original resolves to unavailable, not copied text', async () => {
  const s = service([{data:[{id,body:'yes',reply_to_message_id:a}]},{data:[]}])
  assert.equal((await s.getMessages(a,b)).messages[0].reply,null)
})
test('unsent original cannot expose text and mismatched participants are rejected', async () => {
  const s = service([{data:[{id,reply_to_message_id:a}]},{data:[{id:a,sender_id:a,recipient_id:b,body:'stale',unsent_at:'now'}]}])
  assert.equal((await s.getMessages(a,b)).messages[0].reply.body,null)
  const other = service([{data:[{id,reply_to_message_id:a}]},{data:[{id:a,sender_id:a,recipient_id:id,body:'other conversation'}]}])
  assert.equal((await other.getMessages(a,b)).messages[0].reply,null)
})
test('failed original lookup is an error, not a permanent hidden marker', async () => {
  const s = service([{data:[{id,reply_to_message_id:a}]},{error:{code:'network'}}])
  await assert.rejects(s.getMessages(a,b))
})
