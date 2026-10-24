import {DatabaseSync,constants} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {DEFAULT_NOTEBOOK,type NotebookPreferences} from '../shared/notebook';
import type {Profile} from '../shared/types';

export const GOOGLE_ONLY_PASSWORD='!google-only';
export type GoogleIdentity={subject:string;accountId:string;email:string;linkedAt:string};
export type GoogleChallenge={hash:string;nonceHash:string;purpose:'login'|'signup'|'link'|'delete';accountId:string|null;sessionHash:string|null;expires:number;timeZone:string;name:string};
export type Account=Profile&{passwordHash:string;recoveryHash:string};
type AccountRow={id:string;name:string;email:string;zone:string;week_start:number;created_at:string;password_hash:string;recovery_hash:string;notebook?:string;google_subject?:string;google_email?:string};
const account=(r:AccountRow):Account=>({id:r.id,name:r.name,email:r.email,timeZone:r.zone,weekStart:r.week_start as 0|1,createdAt:r.created_at,notebook:{...DEFAULT_NOTEBOOK,...JSON.parse(r.notebook||'{}')},passwordHash:r.password_hash,recoveryHash:r.recovery_hash,hasPassword:r.password_hash!==GOOGLE_ONLY_PASSWORD,googleLinked:!!r.google_subject,...(r.google_email?{googleEmail:r.google_email}:{})});
const accountSelect='SELECT a.*,g.subject AS google_subject,g.email AS google_email FROM accounts a LEFT JOIN google_identities g ON g.account_id=a.id';
/** One local SQLite connection. All private records go through owner-filtered database views.
 * The SQL authorizer refuses direct base-table access in user scope; write triggers reject owner changes.
 * Scope callbacks are synchronous, so request contexts cannot interleave on this connection. */
export class Store {
 #db:DatabaseSync; #owner:string|null=null;
 constructor(directory:string){
  mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
  const path=join(directory,'little-life.sqlite');this.#db=new DatabaseSync(path);chmodSync(path,0o600);
  this.#db.function('current_owner',()=>this.#owner);
  this.#db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,recovery_hash TEXT NOT NULL,zone TEXT NOT NULL,week_start INTEGER NOT NULL CHECK(week_start IN(0,1)),created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS google_identities(subject TEXT PRIMARY KEY CHECK(length(subject) BETWEEN 1 AND 255),account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,email TEXT NOT NULL,linked_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS google_challenges(hash TEXT PRIMARY KEY,nonce_hash TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose IN('login','signup','link','delete')),account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,session_hash TEXT,expires INTEGER NOT NULL,zone TEXT NOT NULL,name TEXT NOT NULL);

   CREATE TABLE IF NOT EXISTS records(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN('entry','memory','goal','letter','song')),id TEXT NOT NULL,value TEXT NOT NULL CHECK(json_valid(value)),PRIMARY KEY(owner_id,kind,id));
   CREATE TABLE IF NOT EXISTS photos(owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,id TEXT NOT NULL,data BLOB NOT NULL,PRIMARY KEY(owner_id,id));
   CREATE VIEW IF NOT EXISTS owned_records AS SELECT * FROM records WHERE owner_id=current_owner();
   CREATE VIEW IF NOT EXISTS owned_photos AS SELECT * FROM photos WHERE owner_id=current_owner();
   CREATE TRIGGER IF NOT EXISTS owned_records_insert INSTEAD OF INSERT ON owned_records BEGIN
    SELECT CASE WHEN current_owner() IS NULL OR NEW.owner_id!=current_owner() THEN RAISE(ABORT,'Ownership required') END;
    INSERT INTO records(owner_id,kind,id,value) VALUES(current_owner(),NEW.kind,NEW.id,NEW.value);
   END;
   CREATE TRIGGER IF NOT EXISTS owned_records_update INSTEAD OF UPDATE ON owned_records BEGIN
    SELECT CASE WHEN NEW.owner_id!=current_owner() OR OLD.owner_id!=current_owner() THEN RAISE(ABORT,'Ownership required') END;
    UPDATE records SET value=NEW.value WHERE owner_id=current_owner() AND kind=OLD.kind AND id=OLD.id;
   END;
   CREATE TRIGGER IF NOT EXISTS owned_records_delete INSTEAD OF DELETE ON owned_records BEGIN
    DELETE FROM records WHERE owner_id=current_owner() AND kind=OLD.kind AND id=OLD.id;
   END;
   CREATE TRIGGER IF NOT EXISTS owned_photos_insert INSTEAD OF INSERT ON owned_photos BEGIN
    SELECT CASE WHEN current_owner() IS NULL OR NEW.owner_id!=current_owner() THEN RAISE(ABORT,'Ownership required') END;
    INSERT INTO photos(owner_id,id,data) VALUES(current_owner(),NEW.id,NEW.data);
   END;
   CREATE TRIGGER IF NOT EXISTS owned_photos_delete INSTEAD OF DELETE ON owned_photos BEGIN
    DELETE FROM photos WHERE owner_id=current_owner() AND id=OLD.id;
   END;`);
  const accountColumns=this.#db.prepare('PRAGMA table_info(accounts)').all() as {name:string}[];
  if(!accountColumns.some(c=>c.name==='notebook'))this.#db.exec("ALTER TABLE accounts ADD COLUMN notebook TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(notebook))");
  this.#db.exec(`
   CREATE TRIGGER IF NOT EXISTS owned_cover_photo_update BEFORE UPDATE OF notebook ON accounts
   WHEN json_extract(NEW.notebook,'$.coverPhotoId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM photos WHERE owner_id=NEW.id AND id=json_extract(NEW.notebook,'$.coverPhotoId'))
   BEGIN SELECT RAISE(ABORT,'Cover photo must belong to this account'); END;
   CREATE TRIGGER IF NOT EXISTS owned_cover_photo_insert BEFORE INSERT ON accounts
   WHEN json_extract(NEW.notebook,'$.coverPhotoId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM photos WHERE owner_id=NEW.id AND id=json_extract(NEW.notebook,'$.coverPhotoId'))
   BEGIN SELECT RAISE(ABORT,'Cover photo must belong to this account'); END;
   CREATE TRIGGER IF NOT EXISTS owned_cover_photo_delete BEFORE DELETE ON photos
   WHEN EXISTS(SELECT 1 FROM accounts WHERE id=OLD.owner_id AND json_extract(notebook,'$.coverPhotoId')=OLD.id)
   BEGIN SELECT RAISE(ABORT,'Cover photo is still in use'); END;
  `);
  this.#db.setAuthorizer((action,table,_column,_database,source)=>{
   if(this.#owner&&['records','photos'].includes(table||'')&&[constants.SQLITE_READ,constants.SQLITE_INSERT,constants.SQLITE_UPDATE,constants.SQLITE_DELETE].includes(action)&&!source?.startsWith('owned_'))return constants.SQLITE_DENY;
   return constants.SQLITE_OK;
  });
  this.#db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
 }
 byEmail(email:string):Account|null{const r=this.#db.prepare(accountSelect+' WHERE a.email=?').get(email) as AccountRow|undefined;return r?account(r):null;}
 byId(id:string):Account|null{const r=this.#db.prepare(accountSelect+' WHERE a.id=?').get(id) as AccountRow|undefined;return r?account(r):null;}
 create(a:Account){this.#db.prepare('INSERT INTO accounts(id,email,name,password_hash,recovery_hash,zone,week_start,created_at) VALUES(?,?,?,?,?,?,?,?)').run(a.id,a.email,a.name,a.passwordHash,a.recoveryHash,a.timeZone,a.weekStart,a.createdAt);}
 session(hash:string,now:number):Account|null{this.#db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);const r=this.#db.prepare(accountSelect+' JOIN sessions s ON s.account_id=a.id WHERE s.hash=? AND s.expires>?').get(hash,now) as AccountRow|undefined;return r?account(r):null;}
 addSession(hash:string,id:string,expires:number){this.#db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash,id,expires);}
 removeSession(hash:string){this.#db.prepare('DELETE FROM sessions WHERE hash=?').run(hash);}
 revokeSessions(id:string){this.#db.prepare('DELETE FROM sessions WHERE account_id=?').run(id);}
 updateProfile(id:string,name:string,zone:string,weekStart:number,notebook?:NotebookPreferences){const preferences=notebook||this.byId(id)?.notebook||DEFAULT_NOTEBOOK;this.#db.prepare('UPDATE accounts SET name=?,zone=?,week_start=?,notebook=? WHERE id=?').run(name,zone,weekStart,JSON.stringify(preferences),id);return this.byId(id)!;}
 updatePassword(id:string,passwordHash:string,recoveryHash:string,expected:{recoveryHash?:string;passwordHash?:string}={}):boolean{this.#db.exec('BEGIN IMMEDIATE');try{const a=this.byId(id);if(!a||(expected.recoveryHash&&a.recoveryHash!==expected.recoveryHash)||(expected.passwordHash&&a.passwordHash!==expected.passwordHash)){this.#db.exec('ROLLBACK');return false}this.#db.prepare('UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=?').run(passwordHash,recoveryHash,id);this.revokeSessions(id);this.#db.exec('COMMIT');return true}catch(error){if(this.#db.isTransaction)this.#db.exec('ROLLBACK');throw error}}
 deleteAccount(id:string){this.#db.exec('BEGIN IMMEDIATE');try{this.#db.prepare('DELETE FROM accounts WHERE id=?').run(id);this.#db.exec('COMMIT');try{this.#db.exec('VACUUM')}catch{/* Secure deletion applies to live records; device backups are outside this app. */}}catch(error){if(this.#db.isTransaction)this.#db.exec('ROLLBACK');throw error;}}
 scoped<T>(owner:string,operation:(scope:Scope)=>T):T{
  if(this.#owner)throw new Error('Nested owner scope is not allowed.');
  this.#owner=owner;
  this.#db.exec('BEGIN IMMEDIATE');try{const result=operation(new Scope(this.#db,owner));this.#db.exec('COMMIT');return result}catch(error){if(this.#db.isTransaction)this.#db.exec('ROLLBACK');throw error}finally{this.#owner=null;}
 }
 googleForAccount(id:string):GoogleIdentity|null{const row=this.#db.prepare('SELECT subject,account_id,email,linked_at FROM google_identities WHERE account_id=?').get(id) as {subject:string;account_id:string;email:string;linked_at:string}|undefined;return row?{subject:row.subject,accountId:row.account_id,email:row.email,linkedAt:row.linked_at}:null;}
 googleBySubject(subject:string):Account|null{const row=this.#db.prepare(accountSelect+' WHERE g.subject=?').get(subject) as AccountRow|undefined;return row?account(row):null;}
 createGoogleAccount(value:Account,subject:string,email:string,at:string){this.#db.exec('BEGIN IMMEDIATE');try{this.create(value);this.#db.prepare('INSERT INTO google_identities(subject,account_id,email,linked_at) VALUES(?,?,?,?)').run(subject,value.id,email,at);this.#db.exec('COMMIT');return this.byId(value.id)!}catch(error){if(this.#db.isTransaction)this.#db.exec('ROLLBACK');throw error}}
 linkGoogle(id:string,subject:string,email:string,at:string){this.#db.prepare('INSERT INTO google_identities(subject,account_id,email,linked_at) VALUES(?,?,?,?)').run(subject,id,email,at);return this.byId(id)!;}
 unlinkGoogle(id:string){this.#db.prepare('DELETE FROM google_identities WHERE account_id=?').run(id);return this.byId(id)!;}
 updateGoogleEmail(subject:string,email:string){this.#db.prepare('UPDATE google_identities SET email=? WHERE subject=?').run(email,subject);}
 putGoogleChallenge(value:GoogleChallenge,now:number){this.#db.prepare('DELETE FROM google_challenges WHERE expires<=?').run(now);this.#db.prepare('INSERT INTO google_challenges(hash,nonce_hash,purpose,account_id,session_hash,expires,zone,name) VALUES(?,?,?,?,?,?,?,?)').run(value.hash,value.nonceHash,value.purpose,value.accountId,value.sessionHash,value.expires,value.timeZone,value.name);}
 takeGoogleChallenge(hash:string,now:number):GoogleChallenge|null{const row=this.#db.prepare('DELETE FROM google_challenges WHERE hash=? RETURNING *').get(hash) as {hash:string;nonce_hash:string;purpose:GoogleChallenge['purpose'];account_id:string|null;session_hash:string|null;expires:number;zone:string;name:string}|undefined;return row&&row.expires>now?{hash:row.hash,nonceHash:row.nonce_hash,purpose:row.purpose,accountId:row.account_id,sessionHash:row.session_hash,expires:row.expires,timeZone:row.zone,name:row.name}:null;}
 close(){this.#db.close();}
}
export class Scope {
 constructor(private db:DatabaseSync,private owner:string){}
 list<T>(kind:string):T[]{return (this.db.prepare('SELECT value FROM owned_records WHERE kind=? ORDER BY id DESC').all(kind) as {value:string}[]).map(r=>JSON.parse(r.value) as T);}
 get<T>(kind:string,id:string):T|null{const r=this.db.prepare('SELECT value FROM owned_records WHERE kind=? AND id=?').get(kind,id) as {value:string}|undefined;return r?JSON.parse(r.value) as T:null;}
 put<T>(kind:string,id:string,value:T){const serialized=JSON.stringify(value);if(this.get(kind,id))this.db.prepare('UPDATE owned_records SET value=? WHERE kind=? AND id=?').run(serialized,kind,id);else this.db.prepare('INSERT INTO owned_records(owner_id,kind,id,value) VALUES(?,?,?,?)').run(this.owner,kind,id,serialized);return value;}
 remove(kind:string,id:string){const exists=!!this.get(kind,id);if(exists)this.db.prepare('DELETE FROM owned_records WHERE kind=? AND id=?').run(kind,id);return exists;}
 photo(id:string):Buffer|null{const r=this.db.prepare('SELECT data FROM owned_photos WHERE id=?').get(id) as {data:Uint8Array}|undefined;return r?Buffer.from(r.data):null;}
 photoBytes(){return Number((this.db.prepare('SELECT coalesce(sum(length(data)),0) AS bytes FROM owned_photos').get() as {bytes:number}).bytes);}
 putPhoto(id:string,data:Buffer){this.db.prepare('INSERT INTO owned_photos(owner_id,id,data) VALUES(?,?,?)').run(this.owner,id,data);}
 removePhoto(id:string){this.db.prepare('DELETE FROM owned_photos WHERE id=?').run(id);}
 photos(){return (this.db.prepare('SELECT id,data FROM owned_photos').all() as {id:string;data:Uint8Array}[]).map(p=>({id:p.id,dataUrl:`data:image/jpeg;base64,${Buffer.from(p.data).toString('base64')}`}));}
}
