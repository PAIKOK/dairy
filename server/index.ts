import {createConfiguredApp} from './bootstrap.js';
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4017);
if(!['127.0.0.1','localhost','::1'].includes(host))throw new Error('This development entry point only binds to loopback. Use the Vercel API entry point for hosted access.');
let configured:Awaited<ReturnType<typeof createConfiguredApp>>;
try{configured=await createConfiguredApp()}catch{console.error('The diary API could not initialize. Check the server-only database, trusted origin, TLS and rate-limit configuration. No database URI or credentials are logged.');process.exit(1)}
const server=configured.app.listen(port,host,()=>console.log(`A Little Life API: http://${host}:${port} · ${configured.storage==='mongodb'?'private MongoDB storage':'private local SQLite storage'}`));
server.on('error',()=>{console.error('The diary API could not bind its local port.');void configured.close().finally(()=>{process.exitCode=1})});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>void configured.close().finally(()=>process.exit(0))));
