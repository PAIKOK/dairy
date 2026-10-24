export const STICKER_KINDS = ['daisy','fern','butterfly','coffee','heart','stamp','washi','note','moon'] as const;
export type StickerKind = typeof STICKER_KINDS[number];
export type Ink = 'plum' | 'blue' | 'forest';
export type Paper = 'lined' | 'dotted' | 'plain' | 'graph';
export type Cover = 'sage' | 'plum' | 'rose' | 'linen';
export type NotebookPreferences = {cover:Cover;title:string;paper:Paper;ink:Ink;font:'hand'|'print';coverPhotoId?:string|null};
export type PageSticker = {id:string;kind:StickerKind;x:number;y:number;rotation:number;scale:number;text?:string};
export type InkStroke = {id:string;color:Ink;width:number;points:[number,number][]};
export type PageDesign = {paper:Paper;ink:Ink;font:'hand'|'print';note:string;stickers:PageSticker[];doodles:InkStroke[]};
export const DEFAULT_NOTEBOOK:NotebookPreferences = {cover:'sage',title:'the little things',paper:'lined',ink:'plum',font:'hand'};
export const INKS:Record<Ink,string> = {plum:'#4D4054',blue:'#385B84',forest:'#4C6853'};
export const COVERS:{id:Cover;label:string;color:string}[] = [{id:'sage',label:'Forest linen',color:'#496454'},{id:'plum',label:'Mulberry',color:'#61495E'},{id:'rose',label:'Dusty rose',color:'#986778'},{id:'linen',label:'Natural linen',color:'#D4BE9F'}];
export function pageDesign(value:PageDesign|undefined,prefs:NotebookPreferences=DEFAULT_NOTEBOOK):PageDesign {
 return {paper:prefs.paper,ink:prefs.ink,font:prefs.font,note:'',stickers:[],doodles:[],...value};
}
