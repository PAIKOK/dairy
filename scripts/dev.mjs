import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {setTimeout as delay} from 'node:timers/promises';
if(existsSync('.env'))loadEnvFile('.env');
const apiPort=process.env.API_PORT||process.env.PORT||'4017',clientPort=process.env.CLIENT_PORT||'5177';
const env={...process.env,PORT:apiPort,API_PORT:apiPort,CLIENT_PORT:clientPort,CLIENT_ORIGIN:process.env.CLIENT_ORIGIN||`http://127.0.0.1:${clientPort},http://localhost:${clientPort}`};
const children=[],shutdown=new AbortController();
let stopping=false;
function stop(code=0){
 if(stopping)return;
 stopping=true;shutdown.abort();process.exitCode=code;
 for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
}
function start(args){
 const child=spawn(process.execPath,args,{stdio:'inherit',env});children.push(child);
 child.on('error',error=>{console.error(`Could not start the diary: ${error.message}`);stop(1)});
 child.on('exit',code=>stop(code||0));
 return child;
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
async function waitForApi(){
 const deadline=Date.now()+15000;
 while(!stopping&&Date.now()<deadline){
  try{
   const response=await fetch(`http://127.0.0.1:${apiPort}/api/auth/google/options`,{signal:AbortSignal.any([shutdown.signal,AbortSignal.timeout(1000)])});
   if(response.ok){
    const result=await response.json();
    if(typeof result.configured==='boolean'&&(result.configured?typeof result.clientId==='string':result.clientId===null))return true;
   }
  }catch{if(shutdown.signal.aborted)return false}
  try{await delay(100,undefined,{signal:shutdown.signal})}catch{return false}
 }
 if(stopping)return false;
 throw new Error('The diary API did not become ready within 15 seconds. The frontend was not started. Check the API error above, then restart npm run dev.');
}
// Do not expose sign-in forms while their local API is still starting.
start(['--import','tsx','--watch','server/index.ts']);
try{if(await waitForApi())start(['node_modules/vite/bin/vite.js'])}catch(error){console.error(error.message);stop(1)}
