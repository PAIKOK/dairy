import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Profile} from '../shared/types';
import {api,errorMessage} from './api';
import {Notice} from './ui';

type GoogleSDK={accounts:{id:{initialize:(options:{client_id:string;nonce:string;callback:(value:{credential?:string})=>void;auto_select:boolean;ux_mode:'popup'})=>void;renderButton:(element:HTMLElement,options:{type:'standard';theme:'outline';size:'large';text:'continue_with';shape:'rectangular';width:number})=>void}}};
declare global{interface Window{google?:GoogleSDK}}
export type GoogleResult={profile?:Profile;recoveryCode?:string;deleted?:boolean};
type Purpose='login'|'signup'|'link'|'delete';
type Props={purpose:Purpose;disabled?:boolean;consent?:boolean;name?:string;password?:string;confirm?:'DELETE';label?:string;beforeStart?:()=>Promise<void>;onPrepared?:()=>void;onBusyChange?:(value:boolean)=>void;onSuccess:(result:GoogleResult)=>void};
let scriptPromise:Promise<void>|undefined;
function loadGoogle(){
 if(window.google?.accounts.id)return Promise.resolve();if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';
  const timer=setTimeout(()=>fail(),20000);
  function fail(){clearTimeout(timer);script.remove();scriptPromise=undefined;reject(new Error('Google sign-in could not load on this network. Use email/password or try another network.'))}
  script.onerror=fail;script.onload=()=>{clearTimeout(timer);if(window.google?.accounts.id)resolve();else fail()};document.head.append(script);
 });return scriptPromise;
}
/** No Google script, iframe, or network request is loaded until the user chooses Google. */
export function GoogleSignIn(props:Props){
 const latest=useRef(props);latest.current=props;
 const [clientId,setClientId]=useState<string|null>(null),[configLoading,setConfigLoading]=useState(true),[configError,setConfigError]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[flow,setFlow]=useState<{clientId:string;nonce:string;version:number}|null>(null);
 const slot=useRef<HTMLDivElement>(null),alive=useRef(true),version=useRef(0),posting=useRef(false),referrer=useRef<HTMLMetaElement|null>(null);
 const blocked=props.disabled||(props.purpose==='signup'&&!props.consent);
 useEffect(()=>{alive.current=true;api<{configured:boolean;clientId:string|null}>('/auth/google/options').then(result=>{if(alive.current)setClientId(result.configured?result.clientId:null)}).catch(()=>{if(alive.current)setConfigError('Google sign-in settings could not be loaded. Email/password is still available.')}).finally(()=>{if(alive.current)setConfigLoading(false)});return()=>{alive.current=false;version.current++;referrer.current?.remove();latest.current.onBusyChange?.(false)}},[]);
 function markBusy(value:boolean){if(alive.current)setBusy(value);latest.current.onBusyChange?.(value)}
 function reset(){version.current++;setFlow(null);setError('');posting.current=false;markBusy(false)}
 async function prepare(){
  if(blocked||busy||!clientId)return;const request=++version.current;setError('');markBusy(true);
  try{
   await latest.current.beforeStart?.();
   const challenge=await api<{clientId:string;nonce:string}>('/auth/google/challenge',{purpose:latest.current.purpose,...(latest.current.purpose==='signup'?{consent:!!latest.current.consent,name:latest.current.name||'',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}:{}),...(latest.current.purpose==='link'?{password:latest.current.password||''}:{})});
   if(!alive.current||version.current!==request)return;latest.current.onPrepared?.();
   if(!referrer.current){const meta=document.createElement('meta');meta.name='referrer';meta.content='strict-origin-when-cross-origin';document.head.append(meta);referrer.current=meta}
   await loadGoogle();if(!alive.current||version.current!==request)return;
   setFlow({...challenge,version:request});
  }catch(e){if(alive.current&&version.current===request){setError(errorMessage(e));setFlow(null)}}finally{if(alive.current&&version.current===request)markBusy(false)}
 }
 useLayoutEffect(()=>{
  if(!flow||!slot.current||!window.google)return;const holder=slot.current;holder.replaceChildren();
  window.google.accounts.id.initialize({client_id:flow.clientId,nonce:flow.nonce,auto_select:false,ux_mode:'popup',callback:value=>{void complete(value.credential,flow.version)}});
  window.google.accounts.id.renderButton(holder,{type:'standard',theme:'outline',size:'large',text:'continue_with',shape:'rectangular',width:Math.max(200,Math.min(400,Math.floor(holder.clientWidth)))});
  holder.querySelector<HTMLElement>('iframe,button,[role="button"]')?.focus({preventScroll:true});
 },[flow]);
 async function complete(credential:string|undefined,request:number){
  if(!alive.current||request!==version.current||posting.current||(latest.current.disabled&&latest.current.purpose!=='link'))return;
  if(latest.current.purpose==='signup'&&!latest.current.consent){setError('Confirm the age and terms checkbox before creating your account.');setFlow(null);return}
  if(!credential){setError('Google did not return a sign-in credential. Choose Google again.');setFlow(null);return}
  posting.current=true;markBusy(true);setError('');
  try{const result=await api<GoogleResult>('/auth/google',{credential,...(latest.current.purpose==='delete'?{confirm:latest.current.confirm}:{})});if(alive.current&&request===version.current)latest.current.onSuccess(result)}catch(e){if(alive.current&&request===version.current){setError(errorMessage(e));setFlow(null)}}finally{posting.current=false;if(alive.current&&request===version.current)markBusy(false)}
 }
 return <div className="google-sign-in" aria-busy={busy}>
  {!flow&&<button type="button" className="button button-outline google-activate" disabled={!!blocked||busy||configLoading||!clientId} onClick={()=>void prepare()}>{busy?'Loading Google sign-in…':props.label||'Continue with Google'}</button>}
  {flow&&<><div className="google-button-slot" ref={slot}/><p className="google-sign-in-note">Use Google’s button above to choose your account. No diary writing or photos are attached.</p><button type="button" className="text-link" disabled={busy} onClick={reset}>Start Google sign-in again</button></>}
  {busy&&<p className="form-note" role="status">{posting.current?'Verifying your Google sign-in…':'Preparing Google’s sign-in button…'}</p>}
  {props.purpose==='signup'&&!props.consent&&<p className="google-sign-in-note">First confirm the age and terms checkbox above. Google sign-up does not require a diary password.</p>}
  {!flow&&!busy&&clientId&&<p className="google-sign-in-note">Optional. Choosing Google loads its sign-in service. Email/password stays available.</p>}
  {!configLoading&&!clientId&&!configError&&<p className="google-sign-in-note">Google sign-in is not configured on this server yet.</p>}
  {(error||configError)&&<Notice error>{error||configError}</Notice>}
 </div>;
}
