import {AsyncLocalStorage} from 'node:async_hooks';
import {isDeepStrictEqual} from 'node:util';
import {MongoClient,Binary,type ClientSession,type Collection,type Document,type Db,type MongoClientOptions} from 'mongodb';
import {DEFAULT_NOTEBOOK,type NotebookPreferences} from '../shared/notebook';
import {GOOGLE_ONLY_PASSWORD,type Account,type GoogleIdentity,type GoogleChallenge} from './store';
import {AccountUnavailable,type AuthProof,type DiaryScope,type DiaryStore} from './storage';

const KINDS={entry:'entries',memory:'memories',goal:'goals',letter:'letters',song:'songs'} as const;
type AccountDoc=Document&{_id:string;email:string;name:string;passwordHash:string;recoveryHash:string;timeZone:string;weekStart:0|1;createdAt:string;notebook:NotebookPreferences;authVersion:number;revision:number;sessionSequence:number};
type IdentityDoc=Document&{_id:string;accountId:string;email:string;linkedAt:string};
type SessionDoc=Document&{_id:string;accountId:string;authVersion:number;expires:Date};
type ChallengeDoc=Document&{_id:string;nonceHash:string;purpose:GoogleChallenge['purpose'];accountId:string|null;sessionHash:string|null;expires:Date;timeZone:string;name:string};
type RecordDoc=Document&{_id:string;ownerId:string;key:string;value:Document};
type PhotoDoc=Document&{_id:string;ownerId:string;key:string;data:Binary;bytes:number};
type QuotaDoc=Document&{_id:string;hits:number;expires:Date};
const string={bsonType:'string'},number={bsonType:['int','long','double']};
const isDuplicate=(error:unknown)=>(error as {code?:number}).code===11000;
const schema=(required:string[],properties:Document)=>({$jsonSchema:{bsonType:'object',required,properties,additionalProperties:false}});
const owned=(properties:Document)=>({$and:[schema(['_id','ownerId','key',...Object.keys(properties)],{_id:string,ownerId:{bsonType:'string',minLength:1},key:{bsonType:'string',minLength:1},...properties}),{$expr:{$eq:['$_id',{$concat:['$ownerId',':','$key']}]}}]});

/** MongoDB is the sole source of truth for this backend. No process-local user data or SQLite fallback.
 * Owner IDs come exclusively from an authenticated session. Each private document's immutable _id
 * is tied to its owner by a database validator, in addition to owner-filtered server queries. */
export class MongoStore implements DiaryStore{
 readonly kind='mongodb' as const;
 #context=new AsyncLocalStorage<ClientSession>();
 #accounts:Collection<AccountDoc>;#identities:Collection<IdentityDoc>;#sessions:Collection<SessionDoc>;#challenges:Collection<ChallengeDoc>;#photos:Collection<PhotoDoc>;#quotas:Collection<QuotaDoc>;
 private constructor(private client:MongoClient,private db:Db){
  this.#accounts=db.collection('accounts');this.#identities=db.collection('google_identities');this.#sessions=db.collection('sessions');this.#challenges=db.collection('google_challenges');this.#photos=db.collection('photos');this.#quotas=db.collection('rate_limits');
 }
 static async connect(uri:string,database='a_little_life_diary',options:{requireTls?:boolean}={}){
  if(!/^mongodb(?:\+srv)?:\/\//.test(uri)||!uri.trim())throw new Error('Set MONGODB_URI to a valid MongoDB connection string. Its value is never logged.');
  if(!/^[A-Za-z0-9_-]{1,63}$/.test(database)||['admin','config','local'].includes(database))throw new Error('Choose a dedicated application database in MONGODB_DB.');
  if(options.requireTls&&/[?&](?:tls|ssl)=false|[?&](?:tlsAllowInvalidCertificates|tlsAllowInvalidHostnames|tlsInsecure)=true/i.test(uri))throw new Error('The hosted MongoDB connection must use verified TLS.');
  const connection:MongoClientOptions={appName:'a-little-life',maxPoolSize:5,minPoolSize:0,maxIdleTimeMS:60000,serverSelectionTimeoutMS:5000,connectTimeoutMS:5000,timeoutMS:15000,retryWrites:true,...(options.requireTls?{tls:true}:{})};
  const client=new MongoClient(uri,connection);
  try{
   await client.connect();const db=client.db(database),hello=await db.admin().command({hello:1});
   if(!hello.setName&&hello.msg!=='isdbgrid')throw new Error('MongoDB must support transactions (Atlas, a replica set, or a sharded cluster).');
   const store=new MongoStore(client,db);await store.#initialize();return store;
  }catch(error){await client.close();throw error}
 }
 async #initialize(){
  const validators:Record<string,Document>={
   accounts:schema(['_id','email','name','passwordHash','recoveryHash','timeZone','weekStart','createdAt','notebook','authVersion','revision','sessionSequence'],{_id:string,email:{bsonType:'string',maxLength:254},name:{bsonType:'string',maxLength:60},passwordHash:string,recoveryHash:{bsonType:'string',pattern:'^[a-f0-9]{64}$'},timeZone:string,weekStart:{enum:[0,1]},createdAt:string,notebook:{bsonType:'object'},authVersion:{...number,minimum:0},revision:{...number,minimum:0},sessionSequence:{...number,minimum:0}}),
   sessions:schema(['_id','accountId','authVersion','expires'],{_id:{bsonType:'string',pattern:'^[a-f0-9]{64}$'},accountId:string,authVersion:number,expires:{bsonType:'date'}}),
   google_identities:schema(['_id','accountId','email','linkedAt'],{_id:{bsonType:'string',minLength:1,maxLength:255},accountId:string,email:string,linkedAt:string}),
   google_challenges:schema(['_id','nonceHash','purpose','accountId','sessionHash','expires','timeZone','name'],{_id:string,nonceHash:string,purpose:{enum:['login','signup','link','delete']},accountId:{bsonType:['string','null']},sessionHash:{bsonType:['string','null']},expires:{bsonType:'date'},timeZone:string,name:string}),
   photos:owned({data:{bsonType:'binData'},bytes:{...number,minimum:1,maximum:1500*1024}}),
   rate_limits:schema(['_id','hits','expires'],{_id:string,hits:{...number,minimum:1},expires:{bsonType:'date'}}),
  };
  for(const name of Object.values(KINDS))validators[name]=owned({value:{bsonType:'object'}});
  for(const [name,validator] of Object.entries(validators)){
   try{await this.db.createCollection(name,{validator,validationLevel:'strict',validationAction:'error'})}
   catch(error){
    if((error as {code?:number}).code!==48)throw error;
    const existing=await this.db.listCollections({name},{nameOnly:false}).next() as {options?:{validator?:Document;validationLevel?:string;validationAction?:string}}|null;
    if(!isDeepStrictEqual(existing?.options?.validator,validator)||existing?.options?.validationLevel!=='strict'||existing?.options?.validationAction!=='error')throw new Error(`Database collection ${name} needs a reviewed schema migration; existing data was not changed.`);
   }
  }
  await this.#accounts.createIndex({email:1},{unique:true,name:'unique_account_email'});
  await this.#identities.createIndex({accountId:1},{unique:true,name:'one_google_identity_per_account'});
  for(const collection of [this.#sessions,this.#challenges,this.#quotas])await collection.createIndex({expires:1},{expireAfterSeconds:0,name:'expire_stale_records'});
  await this.#sessions.createIndex({accountId:1});await this.#challenges.createIndex({accountId:1});
  for(const name of [...Object.values(KINDS),'photos'])await this.db.collection(name).createIndex({ownerId:1,key:1},{unique:true,name:'unique_owner_record'});
 }
 #options(){return {session:this.#context.getStore()}}
 #records(kind:string){const name=KINDS[kind as keyof typeof KINDS];if(!name)throw new Error('Unknown diary record type.');return this.db.collection<RecordDoc>(name)}
 async #transaction<T>(operation:()=>Promise<T>):Promise<T>{
  if(this.#context.getStore())return operation();
  const session=this.client.startSession();
  try{return await session.withTransaction(()=>this.#context.run(session,operation),{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},maxCommitTimeMS:5000,timeoutMS:15000})}finally{await session.endSession()}
 }
 async #account(row:AccountDoc|null):Promise<Account|null>{
  if(!row)return null;const identity=await this.#identities.findOne({accountId:row._id},this.#options());
  return {id:row._id,email:row.email,name:row.name,passwordHash:row.passwordHash,recoveryHash:row.recoveryHash,timeZone:row.timeZone,weekStart:row.weekStart,createdAt:row.createdAt,notebook:{...DEFAULT_NOTEBOOK,...row.notebook},credentialVersion:row.authVersion,hasPassword:row.passwordHash!==GOOGLE_ONLY_PASSWORD,googleLinked:!!identity,...(identity?{googleEmail:identity.email}:{})};
 }
 async #touch(id:string){if((await this.#accounts.updateOne({_id:id},{$inc:{revision:1}},this.#options())).matchedCount!==1)throw new AccountUnavailable()}
 async #prove(id:string,proof:AuthProof={}){
  const a=await this.byId(id);if(!a||proof.passwordHash!==undefined&&a.passwordHash!==proof.passwordHash||proof.credentialVersion!==undefined&&a.credentialVersion!==proof.credentialVersion)throw new AccountUnavailable();
  if(proof.sessionHash!==undefined&&!await this.#sessions.findOne({_id:proof.sessionHash,accountId:id,authVersion:a.credentialVersion||0,expires:{$gt:new Date(proof.now??Date.now())}},this.#options()))throw new AccountUnavailable();
  if(proof.googleSubject!==undefined&&(await this.googleForAccount(id))?.subject!==proof.googleSubject)throw new AccountUnavailable();
  return a;
 }
 async byEmail(email:string){return this.#account(await this.#accounts.findOne({email:email.trim().toLowerCase()},this.#options()))}
 async byId(id:string){return this.#account(await this.#accounts.findOne({_id:id},this.#options()))}
 async create(value:Account){
  if(value.notebook?.coverPhotoId)throw new Error('A new account cannot reference an existing photo.');
  await this.#accounts.insertOne({_id:value.id,email:value.email.trim().toLowerCase(),name:value.name,passwordHash:value.passwordHash,recoveryHash:value.recoveryHash,timeZone:value.timeZone,weekStart:value.weekStart,createdAt:value.createdAt,notebook:{...DEFAULT_NOTEBOOK,...value.notebook},authVersion:0,revision:0,sessionSequence:0},this.#options());
 }
 async session(hash:string,now:number){const session=await this.#sessions.findOne({_id:hash,expires:{$gt:new Date(now)}},this.#options());if(!session)return null;const a=await this.byId(session.accountId);return a&&a.credentialVersion===session.authVersion?a:null}
 async addSession(hash:string,id:string,expires:number,expectedVersion=0){await this.#transaction(async()=>{if((await this.#accounts.updateOne({_id:id,authVersion:expectedVersion},{$inc:{sessionSequence:1}},this.#options())).matchedCount!==1)throw new AccountUnavailable();await this.#sessions.insertOne({_id:hash,accountId:id,authVersion:expectedVersion,expires:new Date(expires)},this.#options())})}
 async removeSession(hash:string){await this.#sessions.deleteOne({_id:hash},this.#options())}
 async revokeSessions(id:string){await this.#transaction(async()=>{await this.#accounts.updateOne({_id:id},{$inc:{authVersion:1}},this.#options());await this.#sessions.deleteMany({accountId:id},this.#options())})}
 async updatePassword(id:string,passwordHash:string,recoveryHash:string,expected:{recoveryHash?:string;passwordHash?:string}={}){
  return this.#transaction(async()=>{const filter={_id:id,...(expected.recoveryHash?{recoveryHash:expected.recoveryHash}:{}),...(expected.passwordHash?{passwordHash:expected.passwordHash}:{})};const changed=await this.#accounts.updateOne(filter,{$set:{passwordHash,recoveryHash},$inc:{authVersion:1}},this.#options());if(!changed.matchedCount)return false;await this.#sessions.deleteMany({accountId:id},this.#options());return true});
 }
 async deleteAccount(id:string,proof:AuthProof={}){await this.#transaction(async()=>{await this.#prove(id,proof);await this.#accounts.deleteOne({_id:id},this.#options());for(const name of [...Object.values(KINDS),'photos'])await this.db.collection(name).deleteMany({ownerId:id},this.#options());await this.#identities.deleteMany({accountId:id},this.#options());await this.#sessions.deleteMany({accountId:id},this.#options());await this.#challenges.deleteMany({accountId:id},this.#options())})}
 async #updateProfile(owner:string,name:string,timeZone:string,weekStart:number,notebook?:NotebookPreferences){
  const a=await this.byId(owner);if(!a)throw new AccountUnavailable();const preferences=notebook||a.notebook||DEFAULT_NOTEBOOK;
  if(preferences.coverPhotoId&&!await this.#photos.findOne({_id:owner+':'+preferences.coverPhotoId,ownerId:owner},this.#options()))throw new Error('Cover photo must belong to this account.');
  await this.#accounts.updateOne({_id:owner},{$set:{name,timeZone,weekStart:weekStart as 0|1,notebook:preferences},$inc:{revision:1}},this.#options());return (await this.byId(owner))!;
 }
 async scoped<T>(owner:string,operation:(scope:DiaryScope)=>Promise<T>){
  return this.#transaction(async()=>{
   if(!await this.byId(owner))throw new AccountUnavailable();
   const scope=new MongoScope(owner,this.#context.getStore()!,kind=>this.#records(kind),this.#photos,()=>this.#touch(owner),async()=>{const a=await this.byId(owner);if(!a)throw new AccountUnavailable();return a},(name,zone,weekStart,notebook)=>this.#updateProfile(owner,name,zone,weekStart,notebook),()=>this.googleForAccount(owner));
   try{return await operation(scope)}finally{scope.active=false}
  });
 }
 async googleForAccount(id:string){const row=await this.#identities.findOne({accountId:id},this.#options());return row?{subject:row._id,accountId:row.accountId,email:row.email,linkedAt:row.linkedAt}:null}
 async googleBySubject(subject:string){const row=await this.#identities.findOne({_id:subject},this.#options());return row?this.byId(row.accountId):null}
 async createGoogleAccount(value:Account,subject:string,email:string,at:string){return this.#transaction(async()=>{await this.create(value);await this.#identities.insertOne({_id:subject,accountId:value.id,email,linkedAt:at},this.#options());return (await this.byId(value.id))!})}
 async linkGoogle(id:string,subject:string,email:string,at:string,proof:AuthProof={}){return this.#transaction(async()=>{await this.#prove(id,proof);await this.#touch(id);await this.#identities.insertOne({_id:subject,accountId:id,email,linkedAt:at},this.#options());return (await this.byId(id))!})}
 async unlinkGoogle(id:string,proof:AuthProof={}){return this.#transaction(async()=>{await this.#prove(id,proof);await this.#touch(id);await this.#identities.deleteOne({accountId:id},this.#options());return (await this.byId(id))!})}
 async updateGoogleEmail(subject:string,email:string){await this.#identities.updateOne({_id:subject},{$set:{email}},this.#options())}
 async putGoogleChallenge(value:GoogleChallenge,_now:number){await this.#challenges.insertOne({_id:value.hash,nonceHash:value.nonceHash,purpose:value.purpose,accountId:value.accountId,sessionHash:value.sessionHash,expires:new Date(value.expires),timeZone:value.timeZone,name:value.name},this.#options())}
 async takeGoogleChallenge(hash:string,now:number){const row=await this.#challenges.findOneAndDelete({_id:hash},this.#options());return row&&row.expires.getTime()>now?{hash:row._id,nonceHash:row.nonceHash,purpose:row.purpose,accountId:row.accountId,sessionHash:row.sessionHash,expires:row.expires.getTime(),timeZone:row.timeZone,name:row.name}:null}
 async consumeQuota(key:string,limit:number,expires:Date){try{const row=await this.#quotas.findOneAndUpdate({_id:key,hits:{$lt:limit}},{$inc:{hits:1},$setOnInsert:{expires}},{upsert:true,returnDocument:'after'});return !!row&&row.hits<=limit}catch(error){if(isDuplicate(error))return false;throw error}}
 async close(){await this.client.close()}
}

class MongoScope implements DiaryScope{
 active=true;#touched=false;
 constructor(private owner:string,private session:ClientSession,private records:(kind:string)=>Collection<RecordDoc>,private images:Collection<PhotoDoc>,private touch:()=>Promise<void>,private readAccount:()=>Promise<Account>,private saveProfile:(name:string,zone:string,weekStart:number,notebook?:NotebookPreferences)=>Promise<Account>,private identity:()=>Promise<GoogleIdentity|null>){}
 #check(){if(!this.active)throw new Error('Owner scope has ended.')}
 async #write(){this.#check();if(!this.#touched){await this.touch();this.#touched=true}}
 async account(){this.#check();return this.readAccount()}
 async googleIdentity(){this.#check();return this.identity()}
 async updateProfile(name:string,zone:string,weekStart:number,notebook?:NotebookPreferences){await this.#write();return this.saveProfile(name,zone,weekStart,notebook)}
 async list<T>(kind:string){this.#check();const rows=await this.records(kind).find({ownerId:this.owner},{session:this.session}).sort({key:-1}).toArray();return rows.map(row=>row.value as T)}
 async get<T>(kind:string,id:string){this.#check();const row=await this.records(kind).findOne({_id:this.owner+':'+id,ownerId:this.owner,key:id},{session:this.session});return row?row.value as T:null}
 async put<T>(kind:string,id:string,value:T){await this.#write();const data=JSON.parse(JSON.stringify(value)) as Document;await this.records(kind).updateOne({_id:this.owner+':'+id,ownerId:this.owner,key:id},{$set:{value:data}},{upsert:true,session:this.session});return value}
 async remove(kind:string,id:string){await this.#write();return (await this.records(kind).deleteOne({_id:this.owner+':'+id,ownerId:this.owner,key:id},{session:this.session})).deletedCount===1}
 async photo(id:string){this.#check();const row=await this.images.findOne({_id:this.owner+':'+id,ownerId:this.owner,key:id},{session:this.session});return row?Buffer.from(row.data.value()):null}
 async photoBytes(){this.#check();const rows=await this.images.aggregate<{bytes:number}>([{$match:{ownerId:this.owner}},{$group:{_id:null,bytes:{$sum:'$bytes'}}}],{session:this.session}).toArray();return rows[0]?.bytes||0}
 async putPhoto(id:string,data:Buffer){await this.#write();await this.images.insertOne({_id:this.owner+':'+id,ownerId:this.owner,key:id,data:new Binary(data),bytes:data.length},{session:this.session})}
 async removePhoto(id:string){await this.#write();const a=await this.account();if(a.notebook?.coverPhotoId===id)throw new Error('Cover photo is still in use.');await this.images.deleteOne({_id:this.owner+':'+id,ownerId:this.owner,key:id},{session:this.session})}
 async photos(){this.#check();const rows=await this.images.find({ownerId:this.owner},{session:this.session}).toArray();return rows.map(row=>({id:row.key,dataUrl:'data:image/jpeg;base64,'+Buffer.from(row.data.value()).toString('base64')}))}
}
