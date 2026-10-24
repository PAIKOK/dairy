import type {Entry,EntryInput} from '../shared/types';
export type Draft={entry:Entry;revision:number;savedRevision:number;status:'saved'|'pending'|'saving'|'error';error:string;timer?:ReturnType<typeof setTimeout>;inflight?:Promise<void>};
/** Serializes each page's autosaves, retains edits made in-flight, and refuses conflict overwrites. */
export class EntryQueue{
 private drafts=new Map<string,Draft>();
 notify=()=>{};
 constructor(private getBase:(date:string)=>Entry|undefined,private send:(value:EntryInput)=>Promise<Entry>){}
 get(date:string):Draft{let d=this.drafts.get(date);if(!d){d={entry:{date,title:'',body:'',mood:null,favorite:false,version:0,updatedAt:'',...this.getBase(date)},revision:0,savedRevision:0,status:'saved',error:''};this.drafts.set(date,d)}return d;}
 edit(date:string,patch:Partial<EntryInput>){const d=this.get(date);d.entry={...d.entry,...patch,date};d.revision++;d.status='pending';d.error='';clearTimeout(d.timer);d.timer=setTimeout(()=>{void this.save(date).catch(()=>{})},600);this.notify();}
 async save(date:string):Promise<void>{const d=this.get(date);clearTimeout(d.timer);if(d.inflight)return d.inflight;if(d.revision===d.savedRevision)return;const run=async()=>{while(d.revision>d.savedRevision){const revision=d.revision,snapshot={...d.entry};d.status='saving';this.notify();try{const saved=await this.send(snapshot);d.entry={...d.entry,version:saved.version,updatedAt:saved.updatedAt};d.savedRevision=revision;d.error='';d.status=d.revision===revision?'saved':'pending';this.notify()}catch(error){d.status='error';d.error=error instanceof Error?error.message:'This page was not saved.';this.notify();throw error}}};d.inflight=run();try{await d.inflight}finally{d.inflight=undefined}}
 async flush(){await Promise.all([...this.drafts.keys()].map(date=>this.save(date)))}
 get pending(){return [...this.drafts.values()].some(d=>d.revision>d.savedRevision)}
 forget(date:string){const d=this.drafts.get(date);if(d)clearTimeout(d.timer);this.drafts.delete(date);this.notify()}
}
