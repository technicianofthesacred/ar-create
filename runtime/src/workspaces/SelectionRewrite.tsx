import React,{useEffect,useRef,useState} from 'react';
import type {WorkspaceOptions} from './EditorWorkspace';
import type {Manuscript} from './document';
import {passageBaselineJSON} from './document';
import type {PassageRevisionRecord} from './PassageRevision';
import {useAutomaticAI,executionPending} from './AutomaticExecution';
import './selection-rewrite.css';
export type RewriteSelection={id:string;from:number;to:number;text:string;baselineJSON:string};
const endpoint='/api/passage/revisions';
/** Captures a range once. Moving the caret or typing a direction never retargets it. */
export function SelectionRewrite({options,doc,selection,initialRecord,onClose,onReview}:{options:WorkspaceOptions;doc:Manuscript;selection:RewriteSelection;initialRecord?:PassageRevisionRecord;onClose:()=>void;onReview:(record:PassageRevisionRecord)=>Promise<void>}){
 const [instruction,setInstruction]=useState(initialRecord?.instruction||''),[record,setRecord]=useState<PassageRevisionRecord|null>(initialRecord||null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[terminal,setTerminal]=useState(false),[sessions,setSessions]=useState<any[]>([]),[sessionId,setSessionId]=useState(''),[ready,setReady]=useState(false);
 const capability=useAutomaticAI(options.api),api=options.api,live=useRef({options,doc,onReview});live.current={options,doc,onReview};
 const mounted=useRef(true),lock=useRef(false),checking=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const paragraph=doc.paragraphs.find(p=>p.id===selection.id),changed=!paragraph||passageBaselineJSON(paragraph)!==selection.baselineJSON,pending=executionPending(record);
 const isCurrent=()=>mounted.current&&live.current.doc.id===doc.id&&live.current.options.project.id===options.project.id;
 function validateCurrent(){const p=live.current.doc.paragraphs.find(p=>p.id===selection.id);if(!p||passageBaselineJSON(p)!==selection.baselineJSON)throw Error('This passage changed. Select the words again for a fresh rewrite.');}
 function validateRecord(value:PassageRevisionRecord){const range=(value as any).selection;if(value.documentId!==doc.id||value.projectId!==options.project.id||value.paragraphId!==selection.id||value.baselineJSON!==selection.baselineJSON||range?.from!==selection.from||range?.to!==selection.to||range?.text!==selection.text)throw Error('The reply does not match these selected words. Nothing was changed.');}
 async function check(){if(!api||!record||checking.current)return;checking.current=true;try{const next=await api(endpoint+'/'+encodeURIComponent(record.id));if(isCurrent()){validateRecord(next);setRecord(next);setError('');}}catch(cause){if(isCurrent())setError((cause as Error).message);}finally{checking.current=false;}}
 useEffect(()=>{if(!pending||options.visible===false)return;const wake=()=>{if(document.visibilityState!=='hidden')void check();};const timer=setInterval(wake,3000);window.addEventListener('focus',wake);return()=>{clearInterval(timer);window.removeEventListener('focus',wake);};},[record?.id,pending,options.visible]);
 async function perform(action:'run'|'prepare'|'send'|'review'){
  if(!api||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   validateCurrent();await live.current.options.ensureSaved?.();if(!isCurrent())return;validateCurrent();
   let next=record;
   if(action==='run'||action==='prepare'){
    next=await api(endpoint+'/preview',{method:'POST',body:{paragraphId:selection.id,selection:{from:selection.from,to:selection.to,text:selection.text},instruction:instruction.trim(),...(live.current.options.writingContext?{contextSelection:live.current.options.writingContext}:{})}});
    if(!isCurrent())return;validateRecord(next!);setRecord(next);validateCurrent();
   }
   if(action==='run'||action==='send'){
    const started=await api(endpoint+'/'+encodeURIComponent(next!.id)+(action==='run'?'/run':'/send'),{method:'POST',body:action==='run'?{}:{sessionId}});if(isCurrent()){validateRecord(started);setRecord(started);}
   }
   if(action==='review'){
    const fresh=await api(endpoint+'/'+encodeURIComponent(next!.id));if(!isCurrent())return;validateRecord(fresh);validateCurrent();setRecord(fresh);if(fresh.status!=='result-ready'||!fresh.artifact||!(fresh as any).finalizationVerified)throw Error(fresh.error||'The finalized replacement is not ready. Check the reply again.');await live.current.onReview(fresh);
   }
  }catch(cause){if(isCurrent())setError((cause as Error).message);}finally{lock.current=false;if(isCurrent())setBusy(false);}
 }
 async function openTerminal(){setTerminal(true);if(!api)return;try{const result=await api('/api/terminal/sessions');if(isCurrent()){const available=(result.sessions||[]).filter((s:any)=>s.status==='ready'&&['claude','codex'].includes(s.cli));setSessions(available);setSessionId(available[0]?.id||'');}}catch(cause){if(isCurrent())setError((cause as Error).message);}}
 return <section className="ar-selection-rewrite" aria-label="Rewrite selected words" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!busy&&!changed&&!pending&&instruction.trim()&&capability.available){event.preventDefault();void perform('run');}}}>
  <header><blockquote title={selection.text}>{selection.text}</blockquote><button onClick={onClose} aria-label="Close selection rewrite">×</button></header>
  {!record||record.status==='preview'?<form onSubmit={event=>{event.preventDefault();void perform('run');}}><label><input autoFocus aria-label="Selection rewrite instruction" value={instruction} disabled={busy||changed} placeholder="Make this more direct…" onChange={event=>{setInstruction(event.target.value);setRecord(null);}}/></label><button type="submit" disabled={busy||changed||!instruction.trim()||capability.available!==true}>{busy?'Starting…':'Rewrite'}</button></form>:null}
  {pending&&<p role="status">Preparing a replacement. You can keep writing.</p>}
  {record?.status==='result-ready'&&!changed&&<><p className="ar-selection-replacement">{(record.artifact as any)?.replacement||'Replacement ready for review.'}</p><button disabled={busy} onClick={()=>void perform('review')}>Review replacement</button></>}
  {changed&&<p role="alert">This passage changed. Your newer words are safe. Select again to rewrite.</p>}
  {(error||record?.error)&&<p role="alert">{error||record?.error}</p>}
  {capability.available===false&&!record&&<p>{capability.reason||'Automatic AI is unavailable.'}</p>}
  <div className="ar-selection-secondary">{record&&<button disabled={busy} onClick={()=>void check()}>Check reply</button>}<details onToggle={event=>{if(event.currentTarget.open&&!terminal)void openTerminal();}}><summary>Terminal options</summary><div className="ar-selection-terminal">{terminal&&<><label>Provider<select aria-label="Selection rewrite provider" value={sessionId} onChange={event=>{setSessionId(event.target.value);setReady(false);}}><option value="">Choose ready session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.cli} · {s.id.slice(0,8)}</option>)}</select></label><label><input type="checkbox" checked={ready} onChange={event=>setReady(event.target.checked)}/> Session is at its prompt</label>{record?.status==='preview'?<button disabled={busy||changed||!sessionId||!ready} onClick={()=>void perform('send')}>Send rewrite</button>:<button disabled={busy||pending||changed||!instruction.trim()} onClick={()=>void perform('prepare')}>Prepare request</button>}</>}<button onClick={()=>options.onShelfRequest?.('environment')}>Open terminal</button></div></details></div>

 </section>;
}
