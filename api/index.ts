import express from 'express';
import {createConfiguredApp} from '../server/bootstrap';

// One pooled client/app per warm instance. Rejected initialization is cleared for a later retry.
let ready:Promise<Awaited<ReturnType<typeof createConfiguredApp>>>|undefined;
function application(){
 if(!ready)ready=createConfiguredApp({...process.env,VERCEL:'1'}).catch(error=>{ready=undefined;throw error});
 return ready;
}
const api=express();api.disable('x-powered-by');
api.use(async(req,res)=>{
 try{const configured=await application();configured.app(req,res)}
 catch{res.status(503).set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}).json({error:'The diary database is not available. The site owner must check the server-only MONGODB_URI, database access, CLIENT_ORIGIN and RATE_LIMIT_SECRET settings. No account creation or save has been confirmed.'})}
});
export default api;
