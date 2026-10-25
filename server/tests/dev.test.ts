import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

async function availablePort(){
 const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as {port:number}).port;await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return port;
}

test('development startup makes the diary API ready before exposing the frontend', {timeout:30000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'little-life-startup-'));
 const apiPort=await availablePort();let clientPort=await availablePort();while(clientPort===apiPort)clientPort=await availablePort();
 const origin=`http://127.0.0.1:${clientPort}`;
 const child=spawn(process.execPath,['scripts/dev.mjs'],{detached:process.platform!=='win32',stdio:['ignore','pipe','pipe'],env:{...process.env,STORAGE_BACKEND:'sqlite',DATA_DIR:directory,API_PORT:String(apiPort),CLIENT_PORT:String(clientPort),CLIENT_ORIGIN:origin,GOOGLE_CLIENT_ID:'startup-test.apps.googleusercontent.com',GEMINI_API_KEY:'',GEMINI_MODEL:'',MONGODB_URI:''}});
 let output='',exited=false;const exit=new Promise<void>(resolve=>child.once('exit',()=>{exited=true;resolve()}));
 try{
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Frontend startup timed out. '+output)),20000);
   child.stdout.on('data',data=>{output+=data.toString();if(/Local:.*http/.test(output)){clearTimeout(timer);resolve()}});
   child.stderr.on('data',data=>{output+=data.toString()});
   child.once('error',error=>{clearTimeout(timer);reject(error)});
   child.once('exit',()=>{clearTimeout(timer);reject(new Error('Development launcher exited before readiness. '+output))});
  });
  assert.ok(output.indexOf('A Little Life API:')>=0);
  assert.ok(output.indexOf('A Little Life API:')<output.indexOf('Local:'),'API readiness must precede the frontend address');
  assert.equal((await fetch(origin+'/login')).status,200);
  const options=await fetch(origin+'/api/auth/google/options');assert.equal(options.status,200);assert.deepEqual(await options.json(),{configured:true,clientId:'startup-test.apps.googleusercontent.com'});
  const signup=await fetch(origin+'/api/signup',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});assert.equal(signup.status,400,'The first signup request must reach validation, not a missing endpoint');
  assert.doesNotMatch(output,/ECONNREFUSED|http proxy error/);
 }finally{
  function signal(value:NodeJS.Signals){try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,value);else child.kill(value)}catch{}}
  signal('SIGTERM');await Promise.race([exit,delay(3000)]);if(!exited){signal('SIGKILL');await exit}
  await rm(directory,{recursive:true,force:true});
 }
});
