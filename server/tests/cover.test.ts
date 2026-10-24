import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../app';
import {DEFAULT_NOTEBOOK} from '../../shared/notebook';
import type {Book,Profile} from '../../shared/types';

test('optional cover photos stay private, replace atomically, and return to default covers',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'little-life-covers-')),origin='http://127.0.0.1:5177';
 const {app,store}=createApp({directory,origin}),server=app.listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`,image=await readFile(new URL('./photo.jpg',import.meta.url));
 const password='a-local-cover-test-password';let alice='',bob='',aliceId='',bobId='',cover='';
 async function request(path:string,options:{method?:string;body?:unknown;cookie?:string;type?:string;origin?:string}={}){
  return fetch(base+path,{method:options.method||(options.body===undefined?'GET':'POST'),headers:{origin:options.origin||origin,...(options.cookie?{Cookie:options.cookie}:{}),...(options.body===undefined?{}:{'Content-Type':options.type||'application/json'})},body:options.body===undefined?undefined:Buffer.isBuffer(options.body)?new Uint8Array(options.body).buffer:JSON.stringify(options.body)});
 }
 async function upload(cookie=alice){return request('/cover-photo',{method:'PUT',cookie,type:'image/jpeg',body:image})}
 async function preferences(cookie:string,coverPhotoId:string|null){return request('/profile',{cookie,method:'PATCH',body:{name:'Cover tester',timeZone:'UTC',weekStart:1,notebook:{...DEFAULT_NOTEBOOK,coverPhotoId}}})}
 try{
  for(const name of ['alice','bob']){const response=await request('/signup',{body:{name,email:`cover-${name}@example.test`,password,timeZone:'UTC',consent:true}});assert.equal(response.status,201);const cookie=response.headers.get('set-cookie')!.split(';')[0]!,data=await response.json() as {profile:Profile};if(name==='alice'){alice=cookie;aliceId=data.profile.id}else{bob=cookie;bobId=data.profile.id}}
  await t.test('uploads require authentication and a same-origin request',async()=>{
   assert.equal((await upload('')).status,401);assert.equal((await request('/cover-photo',{method:'PUT',cookie:alice,type:'image/jpeg',body:image,origin:'https://other.example'})).status,403);
   const book=await(await request('/book',{cookie:alice})).json() as Book;assert.equal(book.profile.notebook?.coverPhotoId,undefined);assert.equal(book.profile.notebook?.cover,'sage');
  });
  await t.test('a custom cover uses authenticated photos and preserves notebook choices',async()=>{
   await request('/profile',{cookie:alice,method:'PATCH',body:{name:'Alice',timeZone:'UTC',weekStart:1,notebook:{...DEFAULT_NOTEBOOK,cover:'rose',title:'my summer book'}}});
   const response=await upload();assert.equal(response.status,201);const data=await response.json() as {profile:Profile};cover=data.profile.notebook!.coverPhotoId!;
   assert.equal(data.profile.notebook?.cover,'rose');assert.equal(data.profile.notebook?.title,'my summer book');
   const own=await request('/photos/'+cover,{cookie:alice});assert.equal(own.status,200);assert.equal(own.headers.get('content-type'),'image/jpeg');assert.equal(own.headers.get('cache-control'),'no-store');
   assert.equal((await request('/photos/'+cover,{cookie:bob})).status,404);assert.equal((await request('/photos/'+cover)).status,401);
  });
  await t.test('server and database reject another owner’s cover reference',async()=>{
   assert.equal((await preferences(bob,cover)).status,404);
   assert.throws(()=>store.updateProfile(bobId,'Bob','UTC',1,{...DEFAULT_NOTEBOOK,coverPhotoId:cover}),/Cover photo must belong to this account/);
   assert.throws(()=>store.scoped(aliceId,s=>s.removePhoto(cover)),/Cover photo is still in use/);
   assert.equal((await request('/photos/'+cover,{cookie:alice})).status,200);
   assert.equal((await request('/photos/'+cover,{cookie:alice,method:'DELETE'})).status,409);
  });
  await t.test('replacement removes an unused old upload and is included in export',async()=>{
   const old=cover,response=await upload();assert.equal(response.status,201);cover=(await response.json() as {profile:Profile}).profile.notebook!.coverPhotoId!;assert.notEqual(cover,old);
   assert.equal((await request('/photos/'+old,{cookie:alice})).status,404);assert.equal((await request('/photos/'+cover,{cookie:alice})).status,200);
   const exported=await(await request('/export',{cookie:alice})).json() as {account:Profile;photos:{id:string;dataUrl:string}[]};assert.equal(exported.account.notebook?.coverPhotoId,cover);assert.deepEqual(exported.photos.map(p=>p.id),[cover]);assert.match(exported.photos[0]!.dataUrl,/^data:image\/jpeg;base64,/);
  });
  await t.test('invalid, oversized, and unavailable photos do not change the current cover',async()=>{
   assert.equal((await request('/cover-photo',{cookie:alice,method:'PUT',type:'image/png',body:Buffer.from('not a jpeg')})).status,400);
   assert.equal((await request('/cover-photo',{cookie:alice,method:'PUT',type:'image/jpeg',body:Buffer.from('not a jpeg')})).status,400);
   assert.equal((await request('/cover-photo',{cookie:alice,method:'PUT',type:'image/jpeg',body:Buffer.alloc(1600*1024)})).status,413);
   assert.equal((await preferences(alice,randomUUID())).status,404);assert.equal((await preferences(alice,'not-a-photo-id')).status,400);
   assert.equal(store.byId(aliceId)?.notebook?.coverPhotoId,cover);assert.equal((await request('/photos/'+cover,{cookie:alice})).status,200);
  });
  await t.test('replacement can reclaim its own bytes at the account quota',async()=>{
   const filler=randomUUID();store.scoped(aliceId,s=>s.putPhoto(filler,Buffer.alloc(20*1024*1024-s.photoBytes())));
   try{assert.equal((await request('/photos',{cookie:alice,type:'image/jpeg',body:image})).status,413);const response=await upload();assert.equal(response.status,201);cover=(await response.json() as {profile:Profile}).profile.notebook!.coverPhotoId!}finally{store.scoped(aliceId,s=>s.removePhoto(filler))}
  });
  await t.test('memory deletion does not erase a cover; removing a cover preserves a shared memory photo',async()=>{
   const memory=async()=>{const response=await request('/memories',{cookie:alice,body:{photoId:cover,date:'2027-05-15',caption:'Cover also kept as a memory',alt:'A deliberately artificial photo fixture'}});assert.equal(response.status,201);return (await response.json() as {id:string}).id};
   let id=await memory();assert.equal((await request('/memories/'+id,{cookie:alice,method:'DELETE'})).status,200);assert.equal((await request('/photos/'+cover,{cookie:alice})).status,200);
   id=await memory();const response=await request('/cover-photo',{cookie:alice,method:'DELETE'});assert.equal(response.status,200);const data=await response.json() as {profile:Profile};assert.equal(data.profile.notebook?.coverPhotoId,null);assert.equal(data.profile.notebook?.cover,'rose');assert.equal(data.profile.notebook?.title,'my summer book');assert.equal((await request('/photos/'+cover,{cookie:alice})).status,200);
   assert.equal((await request('/memories/'+id,{cookie:alice,method:'DELETE'})).status,200);assert.equal((await request('/photos/'+cover,{cookie:alice})).status,404);
  });
  await t.test('returning to default removes an unshared upload; account deletion cascades an active cover',async()=>{
   let response=await upload();cover=(await response.json() as {profile:Profile}).profile.notebook!.coverPhotoId!;assert.equal((await request('/cover-photo',{cookie:alice,method:'DELETE'})).status,200);assert.equal((await request('/photos/'+cover,{cookie:alice})).status,404);
   response=await upload();cover=(await response.json() as {profile:Profile}).profile.notebook!.coverPhotoId!;assert.equal((await request('/delete-account',{cookie:alice,body:{password,confirm:'DELETE'}})).status,200);assert.equal(store.byId(aliceId),null);assert.equal(store.scoped(aliceId,s=>s.photo(cover)),null);assert.equal((await request('/photos/'+cover,{cookie:alice})).status,401);
  });
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();await rm(directory,{recursive:true,force:true})}
});
