import {Store,type Scope,type Account,type GoogleChallenge,type GoogleIdentity} from './store.js';
import type {NotebookPreferences} from '../shared/notebook.js';

export class AccountUnavailable extends Error{constructor(){super('Your account or credentials changed. Sign in again before continuing.')}}
export type AuthProof={passwordHash?:string;credentialVersion?:number;sessionHash?:string;googleSubject?:string;now?:number};
export interface DiaryScope{
 account():Promise<Account>;
 googleIdentity():Promise<GoogleIdentity|null>;
 updateProfile(name:string,zone:string,weekStart:number,notebook?:NotebookPreferences):Promise<Account>;
 list<T>(kind:string):Promise<T[]>;
 get<T>(kind:string,id:string):Promise<T|null>;
 put<T>(kind:string,id:string,value:T):Promise<T>;
 remove(kind:string,id:string):Promise<boolean>;
 photo(id:string):Promise<Buffer|null>;
 photoBytes():Promise<number>;
 putPhoto(id:string,data:Buffer):Promise<void>;
 removePhoto(id:string):Promise<void>;
 photos():Promise<{id:string;dataUrl:string}[]>;
}
export interface DiaryStore{
 readonly kind:'local-sqlite'|'mongodb';
 byEmail(email:string):Promise<Account|null>;
 byId(id:string):Promise<Account|null>;
 create(value:Account):Promise<void>;
 session(hash:string,now:number):Promise<Account|null>;
 addSession(hash:string,id:string,expires:number,expectedVersion?:number):Promise<void>;
 removeSession(hash:string):Promise<void>;
 revokeSessions(id:string):Promise<void>;
 updatePassword(id:string,passwordHash:string,recoveryHash:string,expected?:{recoveryHash?:string;passwordHash?:string}):Promise<boolean>;
 deleteAccount(id:string,proof?:AuthProof):Promise<void>;
 scoped<T>(owner:string,operation:(scope:DiaryScope)=>Promise<T>):Promise<T>;
 googleForAccount(id:string):Promise<GoogleIdentity|null>;
 googleBySubject(subject:string):Promise<Account|null>;
 createGoogleAccount(value:Account,subject:string,email:string,at:string):Promise<Account>;
 linkGoogle(id:string,subject:string,email:string,at:string,proof?:AuthProof):Promise<Account>;
 unlinkGoogle(id:string,proof?:AuthProof):Promise<Account>;
 updateGoogleEmail(subject:string,email:string):Promise<void>;
 putGoogleChallenge(value:GoogleChallenge,now:number):Promise<void>;
 takeGoogleChallenge(hash:string,now:number):Promise<GoogleChallenge|null>;
 consumeQuota?(key:string,limit:number,expires:Date):Promise<boolean>;
 close():Promise<void>;
}

/** All asynchronous local requests share a lock, including auth operations outside an owner scope.
 * This prevents another request from entering SQLite while an awaited transaction owns the connection. */
export class SQLiteBackend implements DiaryStore{
 readonly kind='local-sqlite' as const;
 #queue:Promise<unknown>=Promise.resolve();
 constructor(readonly raw:Store){}
 #run<T>(operation:()=>T|Promise<T>):Promise<T>{const result=this.#queue.then(operation);this.#queue=result.catch(()=>{});return result}
 async #proof(id:string,proof:AuthProof={}){const a=this.raw.byId(id);if(!a||proof.passwordHash!==undefined&&a.passwordHash!==proof.passwordHash||proof.credentialVersion!==undefined&&a.credentialVersion!==proof.credentialVersion||proof.googleSubject!==undefined&&this.raw.googleForAccount(id)?.subject!==proof.googleSubject||proof.sessionHash!==undefined&&this.raw.session(proof.sessionHash,proof.now??Date.now())?.id!==id)throw new AccountUnavailable()}
 byEmail(email:string){return this.#run(()=>this.raw.byEmail(email))}
 byId(id:string){return this.#run(()=>this.raw.byId(id))}
 create(value:Account){return this.#run(()=>this.raw.create(value))}
 session(hash:string,now:number){return this.#run(()=>this.raw.session(hash,now))}
 addSession(hash:string,id:string,expires:number,expectedVersion?:number){return this.#run(()=>{if(!this.raw.addSession(hash,id,expires,expectedVersion))throw new AccountUnavailable()})}
 removeSession(hash:string){return this.#run(()=>this.raw.removeSession(hash))}
 revokeSessions(id:string){return this.#run(()=>this.raw.revokeSessions(id))}
 updatePassword(id:string,passwordHash:string,recoveryHash:string,expected:{recoveryHash?:string;passwordHash?:string}={}){return this.#run(()=>this.raw.updatePassword(id,passwordHash,recoveryHash,expected))}
 deleteAccount(id:string,proof:AuthProof={}){return this.#run(async()=>{await this.#proof(id,proof);this.raw.deleteAccount(id)})}
 scoped<T>(owner:string,operation:(scope:DiaryScope)=>Promise<T>){return this.#run(async()=>{if(!this.raw.byId(owner))throw new AccountUnavailable();return this.raw.scopedAsync(owner,async scope=>{const adapter=new LocalScope(scope,this.raw,owner);try{return await operation(adapter)}finally{adapter.active=false}})})}
 googleForAccount(id:string){return this.#run(()=>this.raw.googleForAccount(id))}
 googleBySubject(subject:string){return this.#run(()=>this.raw.googleBySubject(subject))}
 createGoogleAccount(value:Account,subject:string,email:string,at:string){return this.#run(()=>this.raw.createGoogleAccount(value,subject,email,at))}
 linkGoogle(id:string,subject:string,email:string,at:string,proof:AuthProof={}){return this.#run(async()=>{await this.#proof(id,proof);return this.raw.linkGoogle(id,subject,email,at)})}
 unlinkGoogle(id:string,proof:AuthProof={}){return this.#run(async()=>{await this.#proof(id,proof);return this.raw.unlinkGoogle(id)})}
 updateGoogleEmail(subject:string,email:string){return this.#run(()=>this.raw.updateGoogleEmail(subject,email))}
 putGoogleChallenge(value:GoogleChallenge,now:number){return this.#run(()=>this.raw.putGoogleChallenge(value,now))}
 takeGoogleChallenge(hash:string,now:number){return this.#run(()=>this.raw.takeGoogleChallenge(hash,now))}
 close(){return this.#run(()=>this.raw.close())}
}
class LocalScope implements DiaryScope{
 active=true;
 constructor(private scope:Scope,private raw:Store,private owner:string){}
 #check(){if(!this.active)throw new Error('Owner scope has ended.')}
 async account(){this.#check();const a=this.raw.byId(this.owner);if(!a)throw new AccountUnavailable();return a}
 async googleIdentity(){this.#check();return this.raw.googleForAccount(this.owner)}
 async updateProfile(name:string,zone:string,weekStart:number,notebook?:NotebookPreferences){this.#check();return this.raw.updateProfile(this.owner,name,zone,weekStart,notebook)}
 async list<T>(kind:string){this.#check();return this.scope.list<T>(kind)}
 async get<T>(kind:string,id:string){this.#check();return this.scope.get<T>(kind,id)}
 async put<T>(kind:string,id:string,value:T){this.#check();return this.scope.put(kind,id,value)}
 async remove(kind:string,id:string){this.#check();return this.scope.remove(kind,id)}
 async photo(id:string){this.#check();return this.scope.photo(id)}
 async photoBytes(){this.#check();return this.scope.photoBytes()}
 async putPhoto(id:string,data:Buffer){this.#check();this.scope.putPhoto(id,data)}
 async removePhoto(id:string){this.#check();this.scope.removePhoto(id)}
 async photos(){this.#check();return this.scope.photos()}
}
