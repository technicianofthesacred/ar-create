// New ar-create state adapter for the copied Teajia renderer. It has no
// original auth, publishing, websocket or writable API effects.
import React,{createContext,useContext,useMemo,useCallback,useEffect,useRef} from 'react';
import {localMediaApi} from '../../workspaces/media';
import type {Placement} from '../../workspaces/document';
export type PhotoVal={url:string;crop:{scale:number;x:number;y:number}};
type Adapter={mediaApi:typeof localMediaApi;isOwner:boolean;editing:boolean;previewVisitor:boolean;photos:Record<string,PhotoVal>;setPhoto:(slot:string,value:PhotoVal|null)=>void;text:(field:string,fallback:string)=>string;setText:(field:string,text:string)=>void;registerFrame:(slot:string,label:string)=>void;usedImages:string[]};
const Ctx=createContext<Adapter>({mediaApi:localMediaApi,isOwner:false,editing:false,previewVisitor:true,photos:{},setPhoto:()=>{},text:(_f,t)=>t,setText:()=>{},registerFrame:()=>{},usedImages:[]});
export const useStoryEdit=()=>useContext(Ctx);
const registerFrame=()=>{};
export type PlacementUpdate=Placement[]|((latest:Placement[])=>Placement[]);
export function LocalStoryProvider({placements,editing,onPlacements,children,libraryImages=[],mediaApi=localMediaApi}:{placements:Placement[];editing:boolean;onPlacements:(p:PlacementUpdate)=>void;children:React.ReactNode;libraryImages?:string[];mediaApi?:typeof localMediaApi}){
 const alive=useRef(true),callback=useRef(onPlacements);callback.current=onPlacements;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const setPhoto=useCallback((slot:string,p:PhotoVal|null)=>{if(!alive.current)return;callback.current(rows=>{const previous=rows.find(row=>row.slot===slot);if(!previous)return rows;return p?rows.map(row=>row.slot===slot?{...row,url:p.url,x:p.crop.x,y:p.crop.y,zoom:p.crop.scale}:row):rows.filter(row=>row.slot!==slot);});},[]);
 const value=useMemo<Adapter>(()=>({mediaApi,isOwner:true,editing,previewVisitor:!editing,photos:Object.fromEntries(placements.filter(p=>p.url).map(p=>[p.slot,{url:p.url,crop:{x:p.x,y:p.y,scale:p.zoom}}])),setPhoto,text:(_f,t)=>t,setText:()=>{},registerFrame,usedImages:[...new Set([...placements.filter(p=>p.url).map(p=>p.url),...libraryImages])]}),[placements,editing,setPhoto,libraryImages,mediaApi]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
// Authored prose remains editable in the manuscript. Composition controls
// affect only photo placements; they cannot silently rewrite accepted text.
export function EditableText({children,as='p',className,style}:{field:string;children:React.ReactNode;as?:React.ElementType;className?:string;style?:React.CSSProperties;multiline?:boolean}){const Tag=as;return <Tag className={className} style={style}>{children}</Tag>;}
