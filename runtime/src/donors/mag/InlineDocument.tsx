import React,{useEffect,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import {documentParts,editBlock,readableBlock,type MarkdownBlock} from './markdown-blocks';
import './inline-document.css';
export type InlineDocumentProps={raw:string;onSave:(nextRaw:string,seenRaw:string)=>Promise<void|string>;label?:string;readOnly?:boolean;protectGuidanceQueue?:boolean;onDirtyChange?:(dirty:boolean)=>void};
type Active={index:number;seenRaw:string;seenBlock:string;initial:string;value:string;saving:boolean;error:string};
// Mag's rendered paragraph is the control: click, type in that same measure,
// keep its height, save on blur/Cmd+Enter; Escape returns its earlier wording.
export function InlineDocument({raw,onSave,label='Document',readOnly=false,protectGuidanceQueue=true,onDirtyChange}:InlineDocumentProps){
 const [local,setLocal]=useState(raw),[active,setActive]=useState<Active|null>(null),[status,setStatus]=useState('');const latest=useRef(raw),incoming=useRef(raw),edit=useRef<Active|null>(null),inFlight=useRef<Promise<boolean>|null>(null),saveRef=useRef<()=>Promise<boolean>>(async()=>true),cancelRef=useRef<()=>void>(()=>{}),navigationPending=useRef(false),replay=useRef(false),elements=useRef(new Map<number,HTMLDivElement>());edit.current=active;
 useEffect(()=>{if(raw===incoming.current)return;incoming.current=raw;latest.current=raw;if(!edit.current)setLocal(raw);},[raw]);
 const setEditing=(next:Active|null)=>{edit.current=next;setActive(next);};
 function clearHeight(index:number){elements.current.get(index)?.style.removeProperty('min-height');}
 function cancel(){if(edit.current)clearHeight(edit.current.index);setEditing(null);setLocal(latest.current);setStatus('Edit cancelled.');onDirtyChange?.(false);}
 async function saveActive(){const current=edit.current;if(!current||current.saving)return !current;if(current.value.trim()===current.initial.trim()){clearHeight(current.index);setEditing(null);setLocal(latest.current);onDirtyChange?.(false);return true;}setEditing({...current,saving:true,error:''});
  try{const next=editBlock(latest.current,current.index,current.seenRaw,current.seenBlock,current.value,protectGuidanceQueue);const canonical=await onSave(next,current.seenRaw);latest.current=typeof canonical==='string'?canonical:next;clearHeight(current.index);setLocal(latest.current);setEditing(null);setStatus('Saved.');onDirtyChange?.(false);return true;}
  catch(error){setEditing({...current,saving:false,error:(error as Error).message||'Could not save. Your edit is retained.'});setStatus('Not saved.');return false;}
 }
 function save():Promise<boolean>{if(inFlight.current)return inFlight.current;const operation=saveActive();inFlight.current=operation;void operation.finally(()=>{if(inFlight.current===operation)inFlight.current=null;});return operation;}
 saveRef.current=save;cancelRef.current=cancel;
 useEffect(()=>{
  // Actual Mag outside-click contract: finish successfully, then replay the
  // connected action once. A rejected write cannot navigate away from words.
  const finishOutside=async(event:MouseEvent)=>{
   if(replay.current){replay.current=false;return;}
   const current=edit.current;if(!current)return;const target=event.target as HTMLElement|null;if(!target)return;
   if(target.closest('[data-mid-local-action]'))return;
   if(target.closest('[data-mid-discard]')){cancelRef.current();return;}
   const field=elements.current.get(current.index),tools=field?.parentElement?.querySelector('.mid-tools');
   if(field?.contains(target)||tools?.contains(target))return;
   event.preventDefault();event.stopImmediatePropagation();if(navigationPending.current)return;navigationPending.current=true;
   try{if(!await saveRef.current()){elements.current.get(edit.current?.index??current.index)?.focus({preventScroll:true});return;}
    if(target.isConnected){replay.current=true;target.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,clientX:event.clientX,clientY:event.clientY,button:event.button,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,shiftKey:event.shiftKey}));replay.current=false;}
   }finally{navigationPending.current=false;}
  };
  document.addEventListener('click',finishOutside,true);return()=>document.removeEventListener('click',finishOutside,true);
 },[]);
 async function begin(block:MarkdownBlock,event?:React.MouseEvent){if(readOnly||!block.editable)return;if(edit.current?.index===block.index)return;if(edit.current&&!await save())return;
  const current=documentParts(latest.current,protectGuidanceQueue).blocks[block.index];if(!current?.editable)return;const element=elements.current.get(block.index),height=element?.getBoundingClientRect().height||0;
  setEditing({index:block.index,seenRaw:latest.current,seenBlock:current.raw,initial:current.plain,value:current.plain,saving:false,error:''});setLocal(latest.current);setStatus('');
  requestAnimationFrame(()=>{const field=elements.current.get(block.index);if(!field)return;field.style.minHeight=height?height+'px':'';field.focus({preventScroll:true});const selection=window.getSelection();if(event&&document.caretRangeFromPoint){const range=document.caretRangeFromPoint(event.clientX,event.clientY);if(range&&field.contains(range.startContainer)){selection?.removeAllRanges();selection?.addRange(range);return;}}const range=document.createRange();range.selectNodeContents(field);range.collapse(false);selection?.removeAllRanges();selection?.addRange(range);});
 }
 const model=documentParts(local,protectGuidanceQueue);
 return <div className="mag-inline-document" aria-label={label}>{model.blocks.map(block=>{const editing=active?.index===block.index;const heading=block.raw.trim().match(/^(#{1,3})\s+/)?.[1].length,quote=block.raw.trim().startsWith('>');return <div className={'mid-block'+(block.editable&&!readOnly?' mid-editable':'')+(editing?' mid-editing':'')+(heading?' mid-heading-'+heading:quote?' mid-quote':'')} key={block.index}>
  <div ref={element=>{if(element)elements.current.set(block.index,element);else elements.current.delete(block.index);}} className="mid-content" role={block.editable&&!readOnly?'textbox':undefined} aria-label={block.editable&&!readOnly?label+' paragraph '+(block.index+1):undefined} aria-multiline={block.editable&&!readOnly?true:undefined} tabIndex={block.editable&&!readOnly?0:undefined} contentEditable={editing&&!active.saving?'plaintext-only':undefined} suppressContentEditableWarning onClick={event=>{if((event.target as HTMLElement).closest('a'))return;const selection=window.getSelection();if(selection&&!selection.isCollapsed&&(event.currentTarget.contains(selection.anchorNode)||event.currentTarget.contains(selection.focusNode)))return;void begin(block,event);}} onInput={event=>{if(edit.current?.index===block.index){edit.current.value=event.currentTarget.innerText??event.currentTarget.textContent??'';onDirtyChange?.(edit.current.value.trim()!==edit.current.initial.trim());}}} onBlur={()=>{if(edit.current?.index===block.index)void save();}} onKeyDown={event=>{if(!editing&&(event.key==='Enter'||event.key==='F2')){event.preventDefault();void begin(block);}else if(editing&&event.key==='Escape'){event.preventDefault();if(!active.saving)cancel();}else if(editing&&event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();void save();}}}>{editing?active.initial:block.raw.trim()?<ReactMarkdown>{readableBlock(block.raw)}</ReactMarkdown>:block.editable&&!readOnly?<span className="mid-placeholder">Write here…</span>:null}</div>
  {editing&&<div className="mid-tools" onMouseDown={event=>event.preventDefault()}><button disabled={active.saving} onClick={()=>void save()}>{active.saving?'Saving…':active.error?'Retry save':'Save'}</button><button disabled={active.saving} onClick={cancel}>Cancel</button><span>Click outside to save · ⌘ Enter · Esc cancel</span></div>}{editing&&active.error&&<p className="mid-error" role="alert">{active.error}</p>}
 </div>;})}<span className="mid-status" role="status">{status}</span></div>;
}
