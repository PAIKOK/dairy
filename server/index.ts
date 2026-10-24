import {resolve,sep} from 'node:path';
import {createApp} from './app';
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4017);
if(!['127.0.0.1','localhost','::1'].includes(host))throw new Error('This local edition only binds to loopback. Review deployment security before enabling public hosting.');
if(process.env.MONGODB_URI?.trim())throw new Error('MongoDB is not connected in this local build. Unset MONGODB_URI to use SQLite; credentials are never printed.');
const directory=resolve(process.env.DATA_DIR||'server/data');if(['public','dist','client','shared','node_modules','.cache'].some(part=>{const root=resolve(part).toLowerCase(),target=directory.toLowerCase();return target===root||target.startsWith(root+sep)}))throw new Error('The private database directory must not be inside web assets or client source.');
const {app,store}=createApp({directory,origin:process.env.CLIENT_ORIGIN||'http://127.0.0.1:5177,http://localhost:5177',apiKey:process.env.GEMINI_API_KEY,aiModel:process.env.GEMINI_MODEL});
const server=app.listen(port,host,()=>console.log(`A Little Life API: http://${host}:${port} · private local SQLite storage`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>{store.close();process.exit(0)}));
