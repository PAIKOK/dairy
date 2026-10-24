import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
const derive=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>scrypt(password.normalize('NFKC'),salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function hashPassword(password:string){const salt=randomBytes(16),hash=await derive(password,salt);return `${salt.toString('hex')}:${hash.toString('hex')}`;}
export async function verifyPassword(password:string,encoded:string){const [salt,key]=encoded.split(':');if(!salt||!key)return false;const hash=await derive(password,Buffer.from(salt,'hex')),expected=Buffer.from(key,'hex');return hash.length===expected.length&&timingSafeEqual(hash,expected);}
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function secretMatches(input:string,hash:string){const a=Buffer.from(digest(input),'hex'),b=Buffer.from(hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);}
export const DUMMY_HASH=await hashPassword(randomBytes(32).toString('hex'));
