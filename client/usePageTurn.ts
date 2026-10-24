import {useEffect,useLayoutEffect,useRef,useState,type MouseEvent,type PointerEvent} from 'react';
import {shiftDate,validDate} from '../shared/dates';
import {errorMessage} from './api';

type Direction='next'|'previous';
type Phase='dragging'|'saving'|'settling';
type Turn={target:string;direction:Direction;phase:Phase;minimal:boolean;ready:boolean};
type ActiveTurn=Turn & {progress:number;cancelled:boolean;snapshot:HTMLElement|null;mounted:Promise<void>;onMount:()=>void};
type Drag={pointer:number;handle:HTMLButtonElement;direction:Direction;startX:number;startY:number;width:number;moved:boolean};
type Options={date:string;flat:boolean;flush:()=>Promise<void>;onNavigate:(target:string)=>void;onClose:()=>void;onError:(message:string)=>void};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const rotation=(turn:ActiveTurn,progress:number)=>`rotateY(${(turn.direction==='next'?-1:1)*progress*178}deg)`;

/** An inert, local DOM copy keeps the actual writing and decorations on the moving paper. */
function paperSnapshot(source:HTMLElement):HTMLElement {
 const copy=source.cloneNode(true) as HTMLElement;
 copy.classList.add('turn-snapshot');copy.inert=true;copy.setAttribute('aria-hidden','true');
 const originals=source.querySelectorAll('textarea');
 copy.querySelectorAll('textarea').forEach((textarea,i)=>{
  const original=originals[i];if(!original)return;
  const replacement=document.createElement('div'),text=document.createElement('div'),style=getComputedStyle(original);
  replacement.className=textarea.className;
  for(const property of ['font-family','font-size','font-weight','font-style','line-height','letter-spacing','color','margin','padding','border','border-radius','background','box-sizing','width','height','min-height','max-height','text-align'])replacement.style.setProperty(property,style.getPropertyValue(property));
  replacement.style.overflow='hidden';replacement.style.whiteSpace='pre-wrap';
  text.textContent=original.value||original.placeholder;
  if(!original.value)text.style.color=getComputedStyle(original,'::placeholder').color;
  if(original.scrollTop)text.style.transform=`translateY(-${original.scrollTop}px)`;
  replacement.append(text);textarea.replaceWith(replacement);
 });
 for(const node of [copy,...copy.querySelectorAll<HTMLElement>('*')]){
  for(const attribute of ['id','for','name','autofocus','aria-labelledby','aria-describedby','aria-controls','aria-live'])node.removeAttribute(attribute);
  if(node.matches('button,a,input,textarea,select,summary,[tabindex]'))node.tabIndex=-1;
 }
 return copy;
}

/** Only the two dedicated corners own gestures; typing, ink, stickers and scrolling do not. */
export function usePageTurn(options:Options){
 const latest=useRef(options);latest.current=options;
 const bookRef=useRef<HTMLDivElement>(null),sheetRef=useRef<HTMLDivElement>(null),frontRef=useRef<HTMLDivElement>(null);
 const active=useRef<ActiveTurn|null>(null),drag=useRef<Drag|null>(null),alive=useRef(true),frame=useRef<number|null>(null),ignoreClick=useRef(false);
 const animation=useRef<{effect:Animation;turn:ActiveTurn;from:number;to:number}|null>(null);
 const [turn,setTurn]=useState<Turn|null>(null),[closing,setClosing]=useState(false);
 const closingRef=useRef(false),closeRequest=useRef(0);
 const minimal=()=>latest.current.flat||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const current=(value:ActiveTurn)=>alive.current&&active.current===value;
 function publish(value:ActiveTurn){if(current(value))setTurn({target:value.target,direction:value.direction,phase:value.phase,minimal:value.minimal,ready:value.ready})}
 function paint(value:ActiveTurn){
  if(!current(value))return;
  bookRef.current?.style.setProperty('--page-turn-progress',String(value.progress));
  const sheet=sheetRef.current;if(!sheet)return;
  sheet.style.transform=value.minimal?'none':rotation(value,value.progress);
  sheet.style.setProperty('--fold-shade',String(Math.sin(value.progress*Math.PI)*.16));
  sheet.dataset.progress=value.progress.toFixed(4);
 }
 function cancelFrame(){if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null}}
 function stopAnimation(){
  const running=animation.current;if(!running)return;
  const progress=running.effect.effect?.getComputedTiming().progress;
  if(typeof progress==='number')running.turn.progress=running.from+(running.to-running.from)*progress;
  animation.current=null;running.effect.cancel();paint(running.turn);
 }
 function releasePointer(){
  const value=drag.current;drag.current=null;
  if(value?.handle.hasPointerCapture(value.pointer))value.handle.releasePointerCapture(value.pointer);
 }
 function clear(value:ActiveTurn){
  if(!current(value))return;
  cancelFrame();stopAnimation();value.onMount();active.current=null;
  bookRef.current?.style.removeProperty('--page-turn-progress');setTurn(null);
 }
 function sourcePage(direction:Direction){
  const root=bookRef.current;if(!root)return null;
  const preferred=root.querySelector<HTMLElement>(`:scope > .${direction==='next'?'right':'left'}-leaf`);
  if(preferred&&getComputedStyle(preferred).display!=='none')return preferred;
  return root.querySelector<HTMLElement>(`:scope > .${direction==='next'?'left':'right'}-leaf`);
 }
 function begin(target:string,direction:Direction,phase:Phase){
  if(active.current||closingRef.current||!validDate(target)||target===latest.current.date)return null;
  let onMount=()=>{};const mounted=new Promise<void>(resolve=>{onMount=resolve}),source=sourcePage(direction),quiet=minimal();
  const value:ActiveTurn={target,direction,phase,minimal:quiet,ready:false,progress:0,cancelled:false,snapshot:!quiet&&source?paperSnapshot(source):null,mounted,onMount};
  latest.current.onError('');active.current=value;publish(value);return value;
 }
 useLayoutEffect(()=>{
  const value=active.current;if(!value||value.target!==turn?.target)return;
  if(frontRef.current&&value.snapshot)frontRef.current.replaceChildren(value.snapshot);
  paint(value);value.onMount();
 },[turn?.target,turn?.direction]);
 async function animate(value:ActiveTurn,to:number){
  cancelFrame();stopAnimation();if(!current(value))return false;
  if(value.minimal||minimal()||!sheetRef.current){value.progress=to;paint(value);return true}
  const from=value.progress;if(Math.abs(to-from)<.001)return true;
  const effect=sheetRef.current.animate([{transform:rotation(value,from)},{transform:rotation(value,to)}],{
   duration:to===1?Math.max(180,580*(1-from)):Math.max(140,330*from),
   easing:to===1?'cubic-bezier(.2,.65,.25,1)':'cubic-bezier(.2,.7,.3,1)',fill:'forwards'
  });
  animation.current={effect,turn:value,from,to};
  try{await effect.finished}catch{return false}
  if(!current(value)||animation.current?.effect!==effect)return false;
  animation.current=null;value.progress=to;paint(value);effect.cancel();return true;
 }
 async function returnPage(value:ActiveTurn,immediate=false){
  if(!current(value)||value.cancelled)return;
  value.cancelled=true;value.phase='settling';publish(value);
  if(immediate){clear(value);return}
  await value.mounted;if(!current(value))return;
  if(await animate(value,0))clear(value);
 }
 async function complete(value:ActiveTurn){
  if(!current(value)||value.cancelled)return;
  value.phase='saving';publish(value);
  try{await latest.current.flush()}catch(error){
   if(current(value)&&!value.cancelled){latest.current.onError(errorMessage(error));await returnPage(value)}
   return;
  }
  if(!current(value)||value.cancelled)return;
  await value.mounted;if(!current(value)||value.cancelled)return;
  value.phase='settling';publish(value);
  if(await animate(value,1)){
   if(!current(value)||value.cancelled)return;
   value.cancelled=true;latest.current.onNavigate(value.target);
  }
 }
 async function turnTo(target:string){
  if(drag.current||active.current||closingRef.current)return;
  const value=begin(target,target<latest.current.date?'previous':'next','saving');
  if(value)await complete(value);
 }
 async function closeBook(){
  if(active.current||drag.current||closingRef.current)return;
  const request=++closeRequest.current;closingRef.current=true;setClosing(true);latest.current.onError('');
  try{await latest.current.flush();if(alive.current&&closingRef.current&&closeRequest.current===request)latest.current.onClose()}
  catch(error){if(alive.current&&closeRequest.current===request){closingRef.current=false;setClosing(false);latest.current.onError(errorMessage(error))}}
 }
 function beginDrag(event:PointerEvent<HTMLButtonElement>,direction:Direction){
  if(event.button!==0||!event.isPrimary||active.current||drag.current||closingRef.current)return;
  const target=shiftDate(latest.current.date,direction==='next'?1:-1);if(!validDate(target))return;
  event.preventDefault();ignoreClick.current=false;
  const handle=event.currentTarget;handle.focus({preventScroll:true});
  drag.current={pointer:event.pointerId,handle,direction,startX:event.clientX,startY:event.clientY,width:sourcePage(direction)?.getBoundingClientRect().width||1,moved:false};
  handle.setPointerCapture(event.pointerId);
 }
 function moveDrag(event:PointerEvent<HTMLButtonElement>){
  const gesture=drag.current;if(!gesture||gesture.pointer!==event.pointerId)return;
  const dx=event.clientX-gesture.startX,dy=event.clientY-gesture.startY,distance=(gesture.direction==='next'?-1:1)*dx;
  if(Math.hypot(dx,dy)<6&&!active.current)return;
  gesture.moved=true;ignoreClick.current=true;
  if(!active.current&&Math.abs(dy)>Math.abs(dx)*1.4){releasePointer();return}
  if(!active.current&&distance<6)return;
  const value=active.current||begin(shiftDate(latest.current.date,gesture.direction==='next'?1:-1),gesture.direction,'dragging');
  if(!value||value.phase!=='dragging')return;
  value.progress=Math.acos(1-clamp(distance/gesture.width,0,1.998))/Math.PI;
  const ready=distance/gesture.width>=.38;
  if(ready!==value.ready){value.ready=ready;publish(value)}
  if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;paint(value)});
 }
 function endDrag(event:PointerEvent<HTMLButtonElement>){
  const gesture=drag.current;if(!gesture||gesture.pointer!==event.pointerId)return;
  moveDrag(event);releasePointer();const value=active.current;
  if(!value||value.phase!=='dragging')return;
  ignoreClick.current=true;
  if(value.ready)void complete(value);else void returnPage(value);
 }
 function cancelDrag(event:PointerEvent<HTMLButtonElement>){
  if(drag.current?.pointer!==event.pointerId)return;
  ignoreClick.current=true;releasePointer();const value=active.current;if(value)void returnPage(value);
 }
 function handleClick(event:MouseEvent<HTMLButtonElement>,direction:Direction){
  if(event.detail>0&&ignoreClick.current){ignoreClick.current=false;event.preventDefault();return}
  void turnTo(shiftDate(latest.current.date,direction==='next'?1:-1));
 }
 useEffect(()=>{
  alive.current=true;
  const cancel=()=>{ignoreClick.current=true;releasePointer();const value=active.current;if(value)void returnPage(value,true)};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&(active.current||drag.current||closingRef.current)){event.preventDefault();if(closingRef.current){closeRequest.current++;closingRef.current=false;setClosing(false)}ignoreClick.current=true;releasePointer();const value=active.current;if(value)void returnPage(value)}};
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener('keydown',escape);window.addEventListener('resize',cancel);media.addEventListener('change',cancel);
  return()=>{alive.current=false;closingRef.current=false;closeRequest.current++;cancelFrame();releasePointer();const value=active.current;if(value){value.cancelled=true;value.onMount()}active.current=null;animation.current?.effect.cancel();animation.current=null;window.removeEventListener('keydown',escape);window.removeEventListener('resize',cancel);media.removeEventListener('change',cancel)};
 },[]);
 function handleProps(direction:Direction){return {
  onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>beginDrag(event,direction),onPointerMove:moveDrag,onPointerUp:endDrag,onPointerCancel:cancelDrag,onLostPointerCapture:cancelDrag,
  onClick:(event:MouseEvent<HTMLButtonElement>)=>handleClick(event,direction),'aria-disabled':!!turn
 }}
 return {bookRef,sheetRef,frontRef,turn,turnTo,handleProps,closing,closeBook};
}
