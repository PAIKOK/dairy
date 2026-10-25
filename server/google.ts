import {OAuth2Client} from 'google-auth-library';
import type {Express,RequestHandler,Response} from 'express';
import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {validZone} from '../shared/dates';
import type {Profile} from '../shared/types';
import {GOOGLE_ONLY_PASSWORD,type Account} from './store';
import {AccountUnavailable,type DiaryStore} from './storage';
import {digest,verifyPassword,secretMatches,DUMMY_HASH} from './password';

export const GOOGLE_CHALLENGE_COOKIE='little_life_google';
export type GoogleClaims={iss?:unknown;aud?:unknown;sub?:unknown;email?:unknown;email_verified?:unknown;name?:unknown;given_name?:unknown;nonce?:unknown;exp?:unknown};
export type GoogleVerifier=(credential:string)=>Promise<GoogleClaims>;
const challengeSchema=z.object({purpose:z.enum(['login','signup','link','delete']),consent:z.boolean().optional(),timeZone:z.string().refine(validZone).optional(),name:z.string().trim().max(60).optional(),password:z.string().max(200).optional()}).strict();
const credentialSchema=z.object({credential:z.string().min(1).max(12000),confirm:z.literal('DELETE').optional()}).strict();
const COOKIE_OPTIONS={httpOnly:true,sameSite:'strict' as const,secure:false,path:'/api/auth/google'};
export function googleVerifier(clientId:string):GoogleVerifier {
 const client=new OAuth2Client({clientId,transporterOptions:{timeout:15000,retry:false}});
 return async credential=>{const ticket=await client.verifyIdToken({idToken:credential,audience:clientId});const value=ticket.getPayload();if(!value)throw new Error('Missing verified identity');return value as GoogleClaims};
}
/** Google only proves an identity. This app still owns accounts, sessions, and all private data. */
export function googleRoutes(options:{app:Express;store:DiaryStore;secureCookies?:boolean;clientId?:string;verify?:GoogleVerifier;now:()=>Date;limit:RequestHandler;requireUser:RequestHandler;account:(res:Response)=>Account;profile:(a:Account)=>Profile;startSession:(res:Response,account:Account)=>Promise<void>;fail:(status:number,message:string)=>never}){
 const {app,store,now,limit,requireUser,account,profile,startSession,fail}=options,clientId=options.clientId?.trim()||'',cookieOptions={...COOKIE_OPTIONS,secure:!!options.secureCookies};
 if(clientId&&!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId))throw new Error('GOOGLE_CLIENT_ID must be a Google Web application client ID. Its value is never logged.');
 const verify=options.verify||(clientId?googleVerifier(clientId):undefined);
 const requireConfigured:RequestHandler=(_req,_res,next)=>{if(!clientId||!verify)fail(503,'Google sign-in is not configured. Email and password still work.');next()};
 app.get('/api/auth/google/options',(_req,res)=>res.json({configured:!!clientId,clientId:clientId||null}));
 app.post('/api/auth/google/challenge',limit,requireConfigured,async(req,res)=>{
  const result=challengeSchema.safeParse(req.body);if(!result.success)fail(400,'Check the Google sign-in request.');const input=result.data!;
  if(input.purpose==='signup'&&(input.consent!==true||!input.timeZone))fail(400,'Confirm you are 18 or older, accept the terms, and choose a valid time zone before creating an account.');
  let owner:Account|null=null,sessionHash:string|null=null;
  if(input.purpose==='link'||input.purpose==='delete'){
   const session=req.cookies?.little_life_session;sessionHash=typeof session==='string'?digest(session):null;owner=sessionHash?await store.session(sessionHash,now().getTime()):null;
   if(!owner)fail(401,'Sign in to your diary again before changing Google access.');
   if(input.purpose==='link'){
    if(owner!.googleLinked)fail(409,'This diary already has a Google account linked.');
    if(!owner!.hasPassword||!await verifyPassword(input.password||'',owner!.hasPassword?owner!.passwordHash:DUMMY_HASH))fail(403,'Confirm your current diary password before linking Google.');
    if((await store.byId(owner!.id))?.passwordHash!==owner!.passwordHash||!await store.session(sessionHash!,now().getTime()))fail(401,'Your sign-in changed. Sign in again before linking Google.');
   }else if(!owner!.googleLinked)fail(409,'This diary does not have a linked Google account.');
  }
  const cookie=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url');
  await store.putGoogleChallenge({hash:digest(cookie),nonceHash:digest(nonce),purpose:input.purpose,accountId:owner?.id||null,sessionHash,expires:now().getTime()+5*60000,timeZone:input.timeZone||'UTC',name:input.name||''},now().getTime());
  res.cookie(GOOGLE_CHALLENGE_COOKIE,cookie,{...cookieOptions,maxAge:5*60000});res.json({clientId,nonce});
 });
 app.post('/api/auth/google',limit,requireConfigured,async(req,res)=>{
  const result=credentialSchema.safeParse(req.body);if(!result.success)fail(400,'Google did not return a usable sign-in credential.');
  const cookie=req.cookies?.[GOOGLE_CHALLENGE_COOKIE],challenge=typeof cookie==='string'?await store.takeGoogleChallenge(digest(cookie),now().getTime()):null;res.clearCookie(GOOGLE_CHALLENGE_COOKIE,cookieOptions);
  if(!challenge)fail(401,'This Google sign-in has expired or was already used. Choose Google again.');
  let claims:GoogleClaims;try{claims=await verify!(result.data!.credential)}catch{fail(401,'Google sign-in could not be verified. Try again, use email and password, or test on another network.');}
  const audience=Array.isArray(claims!.aud)?claims!.aud.includes(clientId):claims!.aud===clientId;
  const email=z.string().email().max(254).safeParse(typeof claims!.email==='string'?claims!.email.trim().toLowerCase():'');
  if(!audience||!['https://accounts.google.com','accounts.google.com'].includes(String(claims!.iss))||typeof claims!.exp!=='number'||claims!.exp*1000<=now().getTime()||claims!.email_verified!==true||!email.success||typeof claims!.sub!=='string'||!claims!.sub||claims!.sub.length>255||typeof claims!.nonce!=='string'||!secretMatches(claims!.nonce,challenge!.nonceHash))fail(401,'Google sign-in could not be verified. Choose Google again.');
  const subject=claims!.sub as string,googleEmail=email.data!;
  if(challenge!.purpose==='delete'||challenge!.purpose==='link'){
   const token=req.cookies?.little_life_session,sessionHash=typeof token==='string'?digest(token):null,owner=sessionHash?await store.session(sessionHash,now().getTime()):null;
   if(!owner||owner.id!==challenge!.accountId||sessionHash!==challenge!.sessionHash)fail(401,'Your diary session changed. Sign in again before changing Google access.');
   if(challenge!.purpose==='delete'){
    if(result.data!.confirm!=='DELETE')fail(400,'Type DELETE before confirming with Google.');
    if((await store.googleForAccount(owner!.id))?.subject!==subject)fail(403,'Choose the Google account linked to this diary. No data was deleted.');
    await store.deleteAccount(owner!.id,{sessionHash:sessionHash!,googleSubject:subject,credentialVersion:owner!.credentialVersion,now:now().getTime()});res.clearCookie('little_life_session',{httpOnly:true,sameSite:'strict',secure:!!options.secureCookies,path:'/api'});res.json({deleted:true});return;
   }
   if(owner!.googleLinked||await store.googleBySubject(subject))fail(409,'That Google account is already linked. No diaries were merged.');
   let linked:Account;try{linked=await store.linkGoogle(owner!.id,subject,googleEmail,now().toISOString(),{sessionHash:sessionHash!,credentialVersion:owner!.credentialVersion,now:now().getTime()})}catch(error){if(error instanceof AccountUnavailable)throw error;if((error as {code?:number}).code===11000||/UNIQUE constraint failed/.test((error as Error).message||''))fail(409,'Google could not be linked. No diaries were merged.');throw error}
   await store.revokeSessions(owner!.id);await startSession(res,(await store.byId(owner!.id))!);res.json({profile:profile(linked!)});return;
  }
  const existing=await store.googleBySubject(subject);
  if(existing){await store.updateGoogleEmail(subject,googleEmail);const current=(await store.byId(existing.id))!;await startSession(res,current);res.json({profile:profile(current)});return;}
  if(await store.byEmail(googleEmail))fail(409,'An account already uses this email. Sign in with your diary password, then link Google in Settings. No accounts were merged.');
  if(challenge!.purpose!=='signup')fail(404,'No diary is linked to this Google account yet. Choose Create an account to begin with Google.');
  const recoveryCode=randomBytes(24).toString('base64url'),name=challenge!.name||(typeof claims!.given_name==='string'?claims!.given_name:typeof claims!.name==='string'?claims!.name:'').trim().slice(0,60);
  let created:Account;try{created=await store.createGoogleAccount({id:randomUUID(),name,email:googleEmail,timeZone:challenge!.timeZone,weekStart:1,createdAt:now().toISOString(),passwordHash:GOOGLE_ONLY_PASSWORD,recoveryHash:digest(recoveryCode)},subject,googleEmail,now().toISOString())}catch(error){if((error as {code?:number}).code===11000||/UNIQUE constraint failed/.test((error as Error).message||''))fail(409,'This Google identity or email already has a diary. Try signing in.');throw error}
  await startSession(res,created!);res.status(201).json({profile:profile(created!),recoveryCode});
 });
 app.post('/api/auth/google/unlink',limit,requireUser,async(req,res)=>{
  const parsed=z.object({password:z.string().min(1).max(200)}).strict().safeParse(req.body);if(!parsed.success)fail(400,'Confirm your current diary password to unlink Google.');const current=account(res);
  if(!current.hasPassword)fail(409,'Set a diary password using your saved recovery code before unlinking your only sign-in method.');
  if(!await verifyPassword(parsed.data!.password,current.passwordHash))fail(403,'The current diary password is incorrect.');
  if((await store.byId(current.id))?.passwordHash!==current.passwordHash)fail(401,'Your sign-in changed. Sign in again.');
  await store.unlinkGoogle(current.id,{passwordHash:current.passwordHash,credentialVersion:current.credentialVersion});await store.revokeSessions(current.id);const updated=(await store.byId(current.id))!;await startSession(res,updated);res.json({profile:profile(updated)});
 });
}
