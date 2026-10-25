export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
function missingBackend(){
 const hostname=typeof window==='undefined'?'localhost':window.location.hostname;
 return ['localhost','127.0.0.1','[::1]'].includes(hostname)
  ?'The diary API is not available at this address. Start both app servers with npm run dev and open the app address printed in the terminal. A static-only preview cannot create accounts, sign in, or save diary data.'
  :'This website’s diary service is not connected. Account creation, sign-in, and saving are unavailable until the site owner deploys the API with persistent storage. Your request has not succeeded; your form entries have not been cleared.';
}
const authRoute=/^\/(?:signup|login|recover|session|auth\/google\/options)$/;
export async function api<T>(path:string,body?:unknown,method?:string,signal?:AbortSignal):Promise<T>{
 let response:Response;
 try{
  response=await fetch(`/api${path}`,{method:method||(body===undefined?'GET':'POST'),credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 }catch(error){
  if(signal?.aborted)throw error;
  throw new ApiError(0,'The diary server could not be reached. Your changes have not been confirmed saved.');
 }
 let result:unknown;
 try{result=await response.json()}catch(error){
  if(signal?.aborted)throw error;
  throw new ApiError(response.ok?502:response.status,missingBackend());
 }
 if(!result||typeof result!=='object'||Array.isArray(result))throw new ApiError(response.ok?502:response.status,missingBackend());
 if(!response.ok){
  const message=(result as {error?:unknown}).error;
  throw new ApiError(response.status,response.status===404&&authRoute.test(path)?missingBackend():typeof message==='string'?message:`The request failed (${response.status}).`);
 }
 return result as T;
}
export const errorMessage=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Please try again.';
export async function uploadJpeg(file:File):Promise<Blob>{if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG, or WebP photograph.');if(file.size>15*1024*1024)throw new Error('Choose a photograph smaller than 15 MB.');let image:ImageBitmap;try{image=await createImageBitmap(file)}catch{throw new Error('This photo could not be opened. Try another image.')}try{const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('Photo processing is not available in this browser.');context.fillStyle='#FFF9F0';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare this photo.')),'image/jpeg',.85));if(blob.size>1500*1024)throw new Error('This photo is still too large. Try a smaller image.');return blob}finally{image.close()}}
