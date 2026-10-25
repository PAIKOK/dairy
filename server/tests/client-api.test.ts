import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {api,ApiError} from '../../client/api';

const unavailable=(error:unknown)=>error instanceof ApiError&&/diary API/i.test(error.message)&&/npm run dev/.test(error.message);

test('auth route 404s explain that the page is missing its diary backend',async()=>{
 const request=mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:'Not Found'}),{status:404,headers:{'Content-Type':'application/json'}}));
 try{for(const path of ['/signup','/login','/recover','/session','/auth/google/options'])await assert.rejects(api(path,{}),unavailable)}finally{request.mock.restore()}
});

test('HTML from a static preview is never mistaken for a successful API response',async()=>{
 const request=mock.method(globalThis,'fetch',async()=>new Response('<!doctype html><title>A Little Life</title>',{status:200,headers:{'Content-Type':'text/html'}}));
 try{await assert.rejects(api('/auth/google/options'),unavailable);await assert.rejects(api('/signup',{}),unavailable)}finally{request.mock.restore()}
});

test('missing records retain their actual server error instead of a backend setup warning',async()=>{
 const request=mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:'Photo not found.'}),{status:404,headers:{'Content-Type':'application/json'}}));
 try{await assert.rejects(api('/photos/missing'),error=>error instanceof ApiError&&error.status===404&&error.message==='Photo not found.')}finally{request.mock.restore()}
});

test('valid JSON and same-origin credentials are preserved',async()=>{
 const request=mock.method(globalThis,'fetch',async(_input:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify({configured:true,clientId:'test.apps.googleusercontent.com'}),{headers:{'Content-Type':'application/json'}}));
 try{assert.deepEqual(await api('/auth/google/options'),{configured:true,clientId:'test.apps.googleusercontent.com'});assert.equal(request.mock.calls[0]?.arguments[0],'/api/auth/google/options');assert.equal((request.mock.calls[0]?.arguments[1] as RequestInit).credentials,'same-origin')}finally{request.mock.restore()}
});

test('aborting a Google settings request preserves cancellation rather than inventing a server failure',async()=>{
 const controller=new AbortController(),cancelled=new DOMException('The request was cancelled.','AbortError');controller.abort();
 const request=mock.method(globalThis,'fetch',async()=>{throw cancelled});
 try{await assert.rejects(api('/auth/google/options',undefined,undefined,controller.signal),error=>error===cancelled)}finally{request.mock.restore()}
});

test('a genuine network failure still reports that saving was not confirmed',async()=>{
 const request=mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch')});
 try{await assert.rejects(api('/signup',{}),error=>error instanceof ApiError&&error.status===0&&/could not be reached/.test(error.message))}finally{request.mock.restore()}
});

test('a deployed site explains its missing backend without telling visitors to run a local development server',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{hostname:'dairy-five-gules.vercel.app'}}});
 const request=mock.method(globalThis,'fetch',async()=>new Response('Not Found',{status:404,headers:{'Content-Type':'text/plain'}}));
 try{await assert.rejects(api('/signup',{}),error=>error instanceof ApiError&&error.status===404&&/site owner deploys the API with persistent storage/.test(error.message)&&!/npm run dev/.test(error.message))}finally{request.mock.restore();if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window')}
});

test('a crashed deployed function is reported as a server error, not a missing deployment',async()=>{
 const request=mock.method(globalThis,'fetch',async()=>new Response('FUNCTION_INVOCATION_FAILED',{status:500,headers:{'Content-Type':'text/plain'}}));
 try{await assert.rejects(api('/signup',{}),error=>error instanceof ApiError&&error.status===500&&/server error \(HTTP 500\)/.test(error.message)&&!/site owner deploys|npm run dev/.test(error.message))}finally{request.mock.restore()}
});
