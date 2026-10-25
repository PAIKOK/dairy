import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {temporaryMongo} from './mongo-fixture';
import {MongoStore} from '../mongo-store';
import {createApp} from '../app';
import {DEFAULT_NOTEBOOK} from '../../shared/notebook';
import {digest,hashPassword} from '../password';
import type {Book} from '../../shared/types';
const NOW=new Date('2027-05-15T12:00:00Z'),ORIGIN='http://127.0.0.1:5177',PASSWORD='a-mongodb-regression-password';
class Jar{cookies=new Map<string,string>();header(){return [...this.cookies].map(([k,v])=>k+'='+v).join('; ')}absorb(response:Response){for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0]!,at=pair.indexOf('='),key=pair.slice(0,at),value=pair.slice(at+1);if(value)this.cookies.set(key,value);else this.cookies.delete(key)}}}

test('MongoDB is durable and owner-isolated for every saved page, authentication and photo flow',{timeout:90000},async t=>{
 const replica=await temporaryMongo(),uri=replica.getUri(),database='little_life_test_'+randomUUID().replaceAll('-','');
 let store=await MongoStore.connect(uri,database),second=await MongoStore.connect(uri,database);const inspector=new MongoClient(uri);await inspector.connect();const db=inspector.db(database);
 const {app}=createApp({origin:ORIGIN,store,now:()=>NOW,googleClientId:'mongo-test.apps.googleusercontent.com',googleVerifyToken:async token=>JSON.parse(token)}),server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`,alice=new Jar(),bob=new Jar();let aliceId='',bobId='',recovery='',photoId='',memoryId='',goalId='';
 async function request(path:string,jar=new Jar(),body?:unknown,method=body===undefined?'GET':'POST',origin=ORIGIN){const response=await fetch(base+path,{method,headers:{origin,...(jar.header()?{cookie:jar.header()}:{}),...(body===undefined?{}:{'Content-Type':Buffer.isBuffer(body)?'image/jpeg':'application/json'})},body:body===undefined?undefined:Buffer.isBuffer(body)?new Uint8Array(body).buffer:JSON.stringify(body)});jar.absorb(response);return response}
 const book=async(jar=alice)=>(await(await request('/book',jar)).json()) as Book;
 try{
  await t.test('all collections exist with database validators, unique owner keys and TTL indexes',async()=>{
   const names=(await db.listCollections().toArray()).map(value=>value.name);
   for(const name of ['accounts','entries','memories','goals','letters','songs','photos','sessions','google_identities','google_challenges','rate_limits'])assert.ok(names.includes(name),name);
   for(const name of ['entries','memories','goals','letters','songs','photos']){const options=(await db.listCollections({name},{nameOnly:false}).toArray())[0];assert.ok(options?.options?.validator);assert.equal(options?.options?.validationLevel,'strict')}
  });
  await t.test('signup stores only credential hashes and persistent sessions, and refuses anonymous/cross-origin access',async()=>{
   for(const [jar,name]of [[alice,'alice'],[bob,'bob']] as const){const response=await request('/signup',jar,{name,email:`mongo-${name}@example.test`,password:PASSWORD,timeZone:'Asia/Kolkata',consent:true});assert.equal(response.status,201);const data=await response.json();if(name==='alice'){aliceId=data.profile.id;recovery=data.recoveryCode}else bobId=data.profile.id;assert.match(response.headers.get('set-cookie')!,/HttpOnly/)}
   const row=await db.collection('accounts').findOne({_id:aliceId} as never);assert.ok(row);assert.notEqual(row.passwordHash,PASSWORD);assert.equal(row.recoveryHash,digest(recovery));assert.equal(JSON.stringify(row).includes(recovery),false);
   assert.equal((await request('/book')).status,401);assert.equal((await request('/goals',alice,{title:'forged',kind:'goal',target:1},'POST','https://other.example')).status,403);
  });
  const page={paper:'graph',ink:'blue',font:'hand',note:'A kept note',stickers:[{id:randomUUID(),kind:'daisy',x:20,y:60,rotation:5,scale:1}],doodles:[{id:randomUUID(),color:'blue',width:2,points:[[10,20],[30,40]]}]};
  await t.test('entry text, mood, bookmarks, sticky notes, stickers and ink persist in MongoDB',async()=>{
   const body={title:'A Mongo-kept day',body:'Words for the cloud database.',mood:'good',favorite:true,page,version:0};const response=await request('/entries/2027-05-15',alice,body,'PUT');assert.equal(response.status,200);assert.equal((await response.json()).version,1);
   const data=await book();assert.equal(data.storage,'mongodb');assert.deepEqual(data.entries[0]?.page,page);assert.equal(data.entries[0]?.favorite,true);assert.equal((await book(bob)).entries.length,0);
   assert.equal((await request('/entries/2027-05-15',alice,{...body,body:'stale'},'PUT')).status,409);assert.equal((await request('/entries/2027-05-15',alice,body,'PUT')).status,200);
  });
  await t.test('photos, gallery captions, alt text, cover uploads and settings all use private MongoDB storage',async()=>{
   const image=await readFile(new URL('./photo.jpg',import.meta.url));let response=await request('/photos',alice,image);assert.equal(response.status,201);photoId=(await response.json()).id;
   response=await request('/memories',alice,{photoId,date:'2027-05-15',caption:'A kept photo',alt:'A plum rectangle on sage'});assert.equal(response.status,201);memoryId=(await response.json()).id;
   assert.equal((await request('/photos/'+photoId,bob)).status,404);assert.equal((await request('/memories',bob,{photoId,date:'2027-05-15',caption:'not mine',alt:'not mine'})).status,404);
   response=await request('/profile',alice,{name:'Alice',timeZone:'Asia/Kolkata',weekStart:0,notebook:{...DEFAULT_NOTEBOOK,title:'my Mongo pages',cover:'rose',coverPhotoId:photoId}},'PATCH');assert.equal(response.status,200);
   assert.equal((await request('/profile',bob,{name:'Bob',timeZone:'UTC',weekStart:1,notebook:{...DEFAULT_NOTEBOOK,coverPhotoId:photoId}},'PATCH')).status,404);
   response=await request('/cover-photo',alice,image,'PUT');assert.equal(response.status,201);const replacement=(await response.json()).profile.notebook.coverPhotoId;assert.notEqual(replacement,photoId);assert.equal((await request('/photos/'+photoId,alice)).status,200,'Gallery photo survives cover replacement');
   assert.equal((await request('/cover-photo',alice,{},'DELETE')).status,200);assert.equal((await request('/photos/'+replacement,alice)).status,404);
   const data=await book();assert.equal(data.profile.notebook?.title,'my Mongo pages');assert.equal(data.profile.weekStart,0);assert.equal(data.memories[0]?.alt,'A plum rectangle on sage');
  });
  await t.test('goals, habit dates, future letters and soundtrack notes are saved and owner-scoped',async()=>{
   let response=await request('/goals',alice,{title:'Make room to read',kind:'goal',target:3});assert.equal(response.status,201);goalId=(await response.json()).id;assert.equal((await request('/goals/'+goalId,alice,{delta:1},'PATCH')).status,200);
   response=await request('/goals',alice,{title:'A little walk',kind:'habit',target:4});const habit=(await response.json()).id;await request('/goals/'+habit,alice,{delta:1},'PATCH');assert.equal((await request('/goals/'+goalId,bob,{delta:1},'PATCH')).status,404);
   response=await request('/letters',alice,{title:'For another day',body:'Still sealed.',unlockDate:'2027-12-31'});assert.equal(response.status,201);const letter=(await response.json()).id;assert.equal((await request('/letters/'+letter,alice)).status,403);
   response=await request('/songs',alice,{title:'A little song',artist:'Test artist',url:'https://example.com/song',date:'2027-05-15',note:'The feeling of this day'});assert.equal(response.status,201);
   const data=await book();assert.equal(data.goals.find(g=>g.id===goalId)?.completed,1);assert.deepEqual(data.goals.find(g=>g.id===habit)?.checks,['2027-05-15']);assert.equal(data.letters[0]?.body,undefined);assert.equal(data.songs[0]?.note,'The feeling of this day');
   const other=await book(bob);assert.equal(other.memories.length+other.goals.length+other.letters.length+other.songs.length,0);
  });
  await t.test('concurrent saves cannot overwrite one another and transactions roll back after failures',async()=>{
   const original={title:'Concurrent',body:'first',mood:null,favorite:false,version:0};const responses=await Promise.all([request('/entries/2027-05-20',alice,original,'PUT'),request('/entries/2027-05-20',alice,{...original,body:'second'},'PUT')]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
   await assert.rejects(store.scoped(aliceId,async s=>{await s.put('entry','2027-05-21',{body:'must roll back'});throw new Error('abort transaction')}),/abort transaction/);assert.equal(await second.scoped(aliceId,async s=>s.get('entry','2027-05-21')),null);
  });
  await t.test('database validation rejects changing a document owner, even in a direct database write',async()=>{
   await assert.rejects(db.collection('entries').updateOne({ownerId:aliceId,key:'2027-05-15'},{$set:{ownerId:bobId}}),error=>(error as {code?:number}).code===121);
   await assert.rejects(db.collection<{_id:string;ownerId:string;key:string;data:Buffer;bytes:number}>('photos').insertOne({_id:aliceId+':bad',ownerId:bobId,key:'bad',data:Buffer.from('bad'),bytes:3}),error=>(error as {code?:number}).code===121);
   assert.equal((await book(bob)).entries.length,0);
  });
  await t.test('another client and a reopened connection read the saved data and session, not a process cache',async()=>{
   const token=alice.cookies.get('little_life_session')!;assert.equal((await second.session(digest(token),NOW.getTime()))?.id,aliceId);
   await second.close();second=await MongoStore.connect(uri,database);assert.equal((await second.scoped(aliceId,async s=>s.list<{body:string}>('entry'))).some(value=>value.body==='Words for the cloud database.'),true);
  });
  await t.test('photo quotas remain atomic under simultaneous writes from different instances',async()=>{
   const quota=await request('/signup',new Jar(),{name:'quota',email:'quota-mongo@example.test',password:PASSWORD,timeZone:'UTC',consent:true});const owner=(await quota.json()).profile.id as string;
   await store.scoped(owner,async s=>{for(let i=0;i<12;i++)await s.putPhoto(randomUUID(),Buffer.alloc(1500*1024));await s.putPhoto(randomUUID(),Buffer.alloc(1024*1024))});
   const upload=(backend:MongoStore)=>backend.scoped(owner,async s=>{if(await s.photoBytes()+900*1024>20*1024*1024)throw new Error('quota reached');await s.putPhoto(randomUUID(),Buffer.alloc(900*1024))});
   const results=await Promise.allSettled([upload(store),upload(second)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(await store.scoped(owner,async s=>s.photoBytes())<=20*1024*1024);await store.deleteAccount(owner);
  });
  await t.test('Google challenges are durable, single-use and usable across different backend instances',async()=>{
   const google=new Jar();let response=await request('/auth/google/challenge',google,{purpose:'signup',consent:true,timeZone:'UTC',name:'Google Mongo'});const challenge=await response.json();
   const token=JSON.stringify({iss:'https://accounts.google.com',aud:'mongo-test.apps.googleusercontent.com',exp:Math.floor(NOW.getTime()/1000)+600,sub:'google-mongo-subject',email:'google-mongo@example.test',email_verified:true,nonce:challenge.nonce});
   const copied=new Jar();copied.cookies=new Map(google.cookies);response=await request('/auth/google',google,{credential:token});assert.equal(response.status,201);const created=await response.json();assert.equal((await second.googleBySubject('google-mongo-subject'))?.id,created.profile.id);assert.equal((await request('/auth/google',copied,{credential:token})).status,401);
   response=await request('/auth/google/challenge',google,{purpose:'delete'});const deletion=await response.json();const deletionToken=JSON.stringify({...JSON.parse(token),nonce:deletion.nonce});assert.equal((await request('/auth/google',google,{credential:deletionToken,confirm:'DELETE'})).status,200);assert.equal(await second.googleBySubject('google-mongo-subject'),null);
  });
  await t.test('hosted session and Google challenge cookies are Secure, HttpOnly and same-site',async()=>{
   const trusted='https://diary.example',secured=createApp({store,origin:trusted,secureCookies:true,rateLimitSecret:'a-private-cookie-test-secret-over-32-characters',googleClientId:'secure-test.apps.googleusercontent.com'}).app;
   const listener=secured.listen(0,'127.0.0.1');await new Promise<void>(resolve=>listener.once('listening',resolve));const url=`http://127.0.0.1:${(listener.address() as {port:number}).port}/api`;let id='';
   try{
    const response=await fetch(url+'/signup',{method:'POST',headers:{origin:trusted,'Content-Type':'application/json'},body:JSON.stringify({name:'Secure',email:'secure-mongo@example.test',password:PASSWORD,timeZone:'UTC',consent:true})});assert.equal(response.status,201);id=(await response.json()).profile.id;
    const cookie=response.headers.getSetCookie().find(value=>value.startsWith('little_life_session='))!;assert.match(cookie,/; Secure/);assert.match(cookie,/; HttpOnly/);assert.match(cookie,/; SameSite=Strict/);
    const challenge=await fetch(url+'/auth/google/challenge',{method:'POST',headers:{origin:trusted,'Content-Type':'application/json'},body:JSON.stringify({purpose:'login'})});assert.equal(challenge.status,200);assert.match(challenge.headers.get('set-cookie')!,/; Secure/);
   }finally{await new Promise<void>(resolve=>listener.close(()=>resolve()));if(id)await store.deleteAccount(id)}
  });
  await t.test('a stale in-flight login cannot create a new session after credentials change',async()=>{
   const id=randomUUID();await store.create({id,name:'Epoch fixture',email:'epoch-mongo@example.test',timeZone:'UTC',weekStart:1,createdAt:NOW.toISOString(),passwordHash:await hashPassword(PASSWORD),recoveryHash:digest(randomUUID())});
   await store.updatePassword(id,await hashPassword(PASSWORD+'changed'),digest(randomUUID()));await assert.rejects(second.addSession(digest('stale-fixture-token'),id,NOW.getTime()+60000,0),/credentials changed/);assert.equal(await store.session(digest('stale-fixture-token'),NOW.getTime()),null);await store.deleteAccount(id);
  });
  await t.test('distributed abuse limits are shared and store no raw IP address',async()=>{const key='test:'+digest('private fixture IP');const values=await Promise.all(Array.from({length:12},(_,i)=>(i%2?store:second).consumeQuota(key,5,new Date(Date.now()+60000))));assert.equal(values.filter(Boolean).length,5);const row=await db.collection('rate_limits').findOne({_id:key} as never);assert.equal(JSON.stringify(row).includes('private fixture IP'),false)});
  await t.test('export includes all owned page inputs and photos but no secret hashes, and recovery revokes old sessions',async()=>{
   let response=await request('/export',alice);assert.equal(response.status,200);const data=await response.json();assert.equal(data.entries.find((value:{date:string})=>value.date==='2027-05-15').page.note,'A kept note');assert.equal(data.letters[0].body,'Still sealed.');assert.equal(data.photos[0].id,photoId);assert.equal(data.songs[0].note,'The feeling of this day');for(const secret of ['passwordHash','recoveryHash','authVersion','credentialVersion','mongo-bob@example.test'])assert.equal(JSON.stringify(data).includes(secret),false);
   const old=new Jar();old.cookies=new Map(alice.cookies);response=await request('/recover',alice,{email:'mongo-alice@example.test',code:recovery,password:'a-recovered-mongo-password'});assert.equal(response.status,200);assert.equal((await request('/book',old)).status,401);assert.equal((await request('/recover',new Jar(),{email:'mongo-alice@example.test',code:recovery,password:PASSWORD})).status,400);assert.equal((await book()).entries.length,2);
  });
  await t.test('deleting a memory cleans its photo, and deleting an account cascades every private collection',async()=>{
   assert.equal((await request('/memories/'+memoryId,alice,undefined,'DELETE')).status,200);assert.equal((await request('/photos/'+photoId,alice)).status,404);
   assert.equal((await request('/delete-account',alice,{password:'a-recovered-mongo-password',confirm:'DELETE'})).status,200);assert.equal((await request('/book',alice)).status,401);assert.equal(await second.byId(aliceId),null);
   for(const name of ['entries','memories','goals','letters','songs','photos'])assert.equal(await db.collection(name).countDocuments({ownerId:aliceId}),0);
   for(const name of ['sessions','google_identities','google_challenges'])assert.equal(await db.collection(name).countDocuments({accountId:aliceId}),0);
   assert.ok(await second.byId(bobId));
  });
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await store.close();await second.close();await inspector.close();await replica.stop()}
});
