import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recoverableDelete, readPending, listPending } from '../src/services/pendingDeletion.js'
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', id='33333333-3333-4333-8333-333333333333'
function storage() {
 const data=new Map()
 return {get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}
}
function locks() {
 const held=new Set()
 return {async request(key,options,fn){if(held.has(key)) return fn(null);held.add(key);try{return await fn({name:key})}finally{held.delete(key)}}}
}
function fixture() {
 const s=storage(); const l=locks(); let calls=0
 const options={storage:s,locks:l,userId:a,otherUserId:b,createId:()=>id,verifyUser:async()=>a,send:async(other,request)=>{calls++;assert.equal(readPending(s,a,b).requestId,request);return {other_user_id:other,request_id:request,hidden:true}}}
 return {s,options,calls:()=>calls}
}
test('persists only approved fields before sending and clears confirmed success',async()=>{
 const f=fixture(); const original=f.options.send
 f.options.send=async(...args)=>{assert.deepEqual(Object.keys(readPending(f.s,a,b)).sort(),['createdAt','otherUserId','requestId','userId']);return original(...args)}
 await recoverableDelete(f.options);assert.equal(f.calls(),1);assert.equal(f.s.length,0)
})
test('uncertain deletion survives a fresh client and reuses UUID',async()=>{
 const f=fixture();await assert.rejects(recoverableDelete({...f.options,send:async()=>{throw new Error('lost')}}))
 assert.equal(readPending(f.s,a,b).requestId,id)
 assert.equal(listPending(f.s,b).length,0)
 await recoverableDelete({...f.options,expectedRequestId:id,createId:()=>{throw new Error('must not generate')}})
 assert.equal(f.s.length,0)
})
test('storage write/read failure prevents network request',async()=>{
 for(const method of ['setItem','getItem']){
  const f=fixture();f.s[method]=()=>{throw new Error('storage blocked')}
  await assert.rejects(recoverableDelete(f.options));assert.equal(f.calls(),0)
 }
})
test('wrong confirmation and failed cleanup preserve metadata for retry',async()=>{
 const f=fixture();await assert.rejects(recoverableDelete({...f.options,send:async()=>({hidden:true})}))
 assert.equal(f.s.length,1)
 f.s.removeItem=()=>{throw new Error('cleanup blocked')}
 await assert.rejects(recoverableDelete(f.options));assert.equal(f.s.length,1)
})
test('account switch and missing locks fail closed',async()=>{
 const f=fixture()
 await assert.rejects(recoverableDelete({...f.options,verifyUser:async()=>b}))
 await assert.rejects(recoverableDelete({...f.options,locks:null}))
 assert.equal(f.calls(),0);assert.equal(f.s.length,0)
})
test('competing tabs cannot queue a fresh deletion after the first succeeds',async()=>{
 const f=fixture();let finish;let started
 const ready=new Promise(r=>{started=r})
 const first=recoverableDelete({...f.options,send:async()=>{started();await new Promise(r=>{finish=r});return {hidden:true,request_id:id,other_user_id:b}}})
 await ready
 await assert.rejects(recoverableDelete(f.options),/another tab/)
 finish();await first
 await assert.rejects(recoverableDelete({...f.options,expectedRequestId:id}),/resolved/)
 assert.equal(f.calls(),0)
})
test('malformed metadata is retained and blocks deletion',async()=>{
 const f=fixture();await assert.rejects(recoverableDelete({...f.options,send:async()=>{throw Error('lost')}}))
 f.s.setItem(f.s.key(0),'broken')
 await assert.rejects(recoverableDelete(f.options),/unreadable/)
 assert.equal(f.calls(),0);assert.equal(f.s.length,1)
})
