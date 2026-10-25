import {resolve,sep} from 'node:path';
import {createApp} from './app';
import {MongoStore} from './mongo-store';

export function hostedConfiguration(environment:NodeJS.ProcessEnv){
 const cloud=environment.VERCEL==='1'||environment.NODE_ENV==='production';
 const backend=environment.STORAGE_BACKEND||'mongodb';
 if(!['mongodb','sqlite'].includes(backend))throw new Error('STORAGE_BACKEND must be mongodb or sqlite.');
 if(cloud&&backend!=='mongodb')throw new Error('Hosted accounts require MongoDB; temporary SQLite is not allowed.');
 let origin=environment.CLIENT_ORIGIN?.trim();
 if(!origin&&environment.VERCEL_PROJECT_PRODUCTION_URL)origin='https://'+environment.VERCEL_PROJECT_PRODUCTION_URL;
 if(!origin&&cloud)throw new Error('Set CLIENT_ORIGIN to the exact HTTPS diary origin.');
 origin||='http://127.0.0.1:5177,http://localhost:5177';
 for(const value of origin.split(',')){const parsed=new URL(value.trim());if(parsed.origin!==value.trim()||!['https:','http:'].includes(parsed.protocol)||cloud&&parsed.protocol!=='https:')throw new Error('CLIENT_ORIGIN must contain exact browser origins; hosted origins must use HTTPS.')}
 if(backend==='mongodb'&&!environment.MONGODB_URI?.trim())throw new Error('Set the server-only MONGODB_URI environment variable. Hosted accounts never use temporary SQLite.');
 if(cloud&&(!environment.RATE_LIMIT_SECRET||environment.RATE_LIMIT_SECRET.length<32))throw new Error('Set a server-only RATE_LIMIT_SECRET of at least 32 characters.');
 if(environment.VERCEL_ENV==='preview'&&environment.VERCEL_URL){const preview='https://'+environment.VERCEL_URL;const parsed=new URL(preview);if(parsed.origin!==preview)throw new Error('Invalid trusted preview URL.');origin=origin+','+preview}
 return {cloud,origin,backend,database:environment.MONGODB_DB?.trim()||'a_little_life_diary'};
}
export async function createConfiguredApp(environment:NodeJS.ProcessEnv=process.env){
 const config=hostedConfiguration(environment),shared={origin:config.origin,apiKey:environment.GEMINI_API_KEY,aiModel:environment.GEMINI_MODEL,googleClientId:environment.GOOGLE_CLIENT_ID,secureCookies:config.cloud,trustProxy:environment.VERCEL==='1',rateLimitSecret:environment.RATE_LIMIT_SECRET,serveFrontend:environment.VERCEL!=='1'};
 if(config.backend==='mongodb'){
  const store=await MongoStore.connect(environment.MONGODB_URI!.trim(),config.database,{requireTls:config.cloud});
  try{const {app}=createApp({...shared,store});return {app,close:()=>store.close(),storage:store.kind}}catch(error){await store.close();throw error}
 }
 const directory=resolve(environment.DATA_DIR||'server/data');
 if(['public','dist','client','shared','node_modules','.cache','.vercel'].some(part=>{const root=resolve(part).toLowerCase(),target=directory.toLowerCase();return target===root||target.startsWith(root+sep)}))throw new Error('The private database directory must not be inside web assets or client source.');
 const {app,store}=createApp({...shared,directory});return {app,close:async()=>store.close(),storage:'local-sqlite' as const};
}
