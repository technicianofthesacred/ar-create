import {useAutomaticAI,AutomaticExecutionNotice,executionPending,type AIExecution} from './AutomaticExecution';
import React,{useEffect,useRef,useState} from 'react';
import type {Manuscript} from './document';
import type {WorkspaceOptions} from './EditorWorkspace';
import {importCarouselDraft} from './carousel-import.mjs';
import {carouselWordsHash} from './carousel-words.mjs';
import {applyCarouselVisualPlan} from './carousel-visual';
import './make-carousel.css';

type Photo={id:string;name?:string;rel_path?:string;missing?:boolean};
type Session={id:string;cli:string;model?:string|null;status:string};
type MakeRecord={execution?:AIExecution;stage?:'words'|'look';outputId?:string;capturedOutputRevision?:number;wordsHash?:string;id:string;status:string;prompt?:string;photos?:Photo[];documentId?:string;manuscriptRevision?:number;manuscriptTitle?:string;sessionId?:string;error?:string;terminal?:Session;artifact?:{filename:string;raw:string;hash:string;visualPlan?:any}};
const photosOf=(sources:Photo[])=>sources.filter(photo=>!photo.missing&&/\.(jpe?g|png|webp)$/i.test(photo.rel_path||photo.name||''));
const storageKey=(projectId:string,documentId:string)=>'ar-create:carousel-make:'+projectId+':'+documentId;
const stored=(key:string)=>{try{return window.sessionStorage.getItem(key);}catch{return null;}};
const remember=(key:string,id:string|null)=>{try{if(id)window.sessionStorage.setItem(key,id);else window.sessionStorage.removeItem(key);}catch{}};
const fromMake=(output:any,id:string)=>output.importedDraft?.makeRequestId===id||output.visualMake?.requestId===id;

export function MakeCarousel({options,doc,change,onSelectOutput,onClose,open=true,outputId}:{outputId?:string;options:WorkspaceOptions;doc:Manuscript;change:(doc:Manuscript)=>void;onSelectOutput:(id:string)=>void;onClose:()=>void;open?:boolean}){
 const [photos,setPhotos]=useState<Photo[]>([]),[photoIds,setPhotoIds]=useState<string[]>([]),[sessions,setSessions]=useState<Session[]>([]),[sessionId,setSessionId]=useState(''),[providerReady,setProviderReady]=useState(false),[record,setRecord]=useState<MakeRecord|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [manual,setManual]=useState(false);const capability=useAutomaticAI(options.api);const operation=useRef(false);
 const latest=useRef({doc,options,change,onSelectOutput,onClose,open});latest.current={doc,options,change,onSelectOutput,onClose,open};
 const dialog=useRef<HTMLElement>(null);
 const mounted=useRef(true),inFlight=useRef(false),importing=useRef(false),generation=useRef(0);
 const visual=!!outputId;
 const key=storageKey(options.project.id,doc.id)+(outputId?':look:'+outputId:''),api=options.api;
 const imported=!!record&&doc.outputs.some(output=>fromMake(output,record.id));
 const pending=!imported&&executionPending(record),prepared=!imported&&record?.status==='preview';
 const selectedSession=sessions.find(session=>session.id===sessionId);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if(!open)return;
  const active=document.activeElement as HTMLElement|null;
  const previous=active?.closest('details')?.querySelector<HTMLElement>('summary')||active;
  const siblings:HTMLElement[]=[];
  for(let element=dialog.current?.parentElement;element&&element!==document.body;element=element.parentElement){
   if(element.parentElement)siblings.push(...Array.from(element.parentElement.children).filter(sibling=>sibling!==element) as HTMLElement[]);
  }
  const earlier=siblings.map(element=>({element,inert:element.hasAttribute('inert')}));siblings.forEach(element=>element.setAttribute('inert',''));
  dialog.current?.querySelector<HTMLButtonElement>('.make-close')?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();latest.current.onClose();return;}
   if(event.key!=='Tab')return;
   const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary,[tabindex="0"]')||[]).filter(element=>!element.closest('details:not([open])')||element.tagName==='SUMMARY');
   const first=controls[0],last=controls.at(-1);if(!first)return;
   if(event.shiftKey&&(document.activeElement===first||!dialog.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!dialog.current?.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{document.removeEventListener('keydown',keyboard);earlier.forEach(({element,inert})=>{if(!inert)element.removeAttribute('inert');});if(previous?.isConnected)previous.focus();};
 },[open]);
 async function refreshSessions(){
  if(!api)return;
  const result=await api('/api/terminal/sessions');if(!mounted.current)return;
  const available=(result.sessions||[]).filter((session:Session)=>session.status==='ready'&&['claude','codex'].includes(session.cli));
  setSessions(available);setProviderReady(false);setSessionId(previous=>available.some((session:Session)=>session.id===previous)?previous:available[0]?.id||'');
 }
 async function receive(next:MakeRecord){
  if(!mounted.current)return;setRecord(next);if(next.status==='preview'&&next.photos)setPhotoIds(next.photos.map(photo=>photo.id));
  if(next.documentId&&next.documentId!==latest.current.doc.id){setError('This request belongs to another manuscript. Prepare a new request.');return;}
  if(visual&&(next.stage!=='look'||next.outputId!==outputId)){setError('This visual request belongs to another carousel. Prepare a request for the selected carousel.');return;}
  const existing=latest.current.doc.outputs.find(output=>fromMake(output,next.id));
  if(existing){if(latest.current.open)latest.current.onSelectOutput(existing.id);setNotice(visual?'Visual draft is saved. Adjust the actual slides.':'Writing draft is saved. Review the complete sequence.');return;}
  if(next.status!=='result-ready'||!next.artifact||importing.current)return;
  importing.current=true;
  try{
   if(next.stage==='look'&&next.outputId){
    const current=latest.current.doc,nextDocument=await applyCarouselVisualPlan(current,next);
    if(!mounted.current)return;if(latest.current.doc!==current)throw new Error('The document changed while its visual draft was checked. Your edits are kept; retry.');
    latest.current.doc=nextDocument;latest.current.change(nextDocument);if(latest.current.open)latest.current.onSelectOutput(next.outputId);setNotice('Visual draft added to the same carousel. Your reviewed wording is unchanged.');setError('');return;
   }
   const tree=await api!('/api/sources/tree');if(!mounted.current)return;
   // Read the latest manuscript after loading the tree: adding an output must
   // never overwrite accepted words or another output edited during the read.
   const current=latest.current.doc;if((next.documentId&&next.documentId!==current.id)||(next.manuscriptRevision!==undefined&&next.manuscriptRevision!==current.revision))throw new Error('The manuscript changed. This draft was not imported. Prepare a new request from the current manuscript.');
   const duplicate=current.outputs.find(output=>fromMake(output,next.id));if(duplicate){if(latest.current.open)latest.current.onSelectOutput(duplicate.id);return;}
   const result=importCarouselDraft(current,next.artifact.raw,next.artifact.filename,{sources:tree.sources||[]});
   result.output.importedDraft={...result.output.importedDraft,makeRequestId:next.id,makeArtifactHash:next.artifact.hash};
   latest.current.doc=result.document;latest.current.change(result.document);if(latest.current.open)latest.current.onSelectOutput(result.output.id);
   setNotice('Writing draft added. Review the whole sequence before moving to visual content.');setError('');
  }catch(cause){if(mounted.current)setError((cause as Error).message);}finally{importing.current=false;}
 }
 async function check(){
  if(!api||!record||inFlight.current)return;inFlight.current=true;
  try{setError('');await receive(await api('/api/carousel/make/'+encodeURIComponent(record.id)));}catch(cause){if(mounted.current)setError((cause as Error).message);}finally{inFlight.current=false;}
 }
 useEffect(()=>{
  let active=true;const at=++generation.current;setLoading(true);setError('');
  if(!api){setLoading(false);setError('The local Make service is unavailable.');return;}
  (async()=>{
   const results=await Promise.allSettled([api('/api/sources/tree'),refreshSessions()]);if(!active||at!==generation.current)return;
   if(results[0].status==='fulfilled'){
    const rows=photosOf(results[0].value.sources||[]);setPhotos(rows);
   }else setError('The photo library could not be loaded. Close Make and open it again to retry.');
   if(results[1].status==='rejected')setSessions([]);
   const remembered=stored(key);
   try{
    let requestId=remembered;
    if(!requestId){
     const recent=await api('/api/carousel/make/recent');if(!active||at!==generation.current)return;
     const current=latest.current.doc,records=Array.isArray(recent.records)?recent.records:[];
     const eligible=records.filter((value:MakeRecord)=>value.documentId===current.id&&(visual?value.stage==='look'&&value.outputId===outputId:value.stage!=='look'||!value.outputId)&&(current.outputs.some(output=>fromMake(output,value.id))||(visual?current.outputs.some(output=>output.id===value.outputId&&(output.outputRevision||0)===value.capturedOutputRevision):value.manuscriptRevision===current.revision&&(value.manuscriptTitle===undefined||value.manuscriptTitle===current.title))));
     requestId=eligible[0]?.id||null;
    }
    if(requestId){
     const recovered=await api('/api/carousel/make/'+encodeURIComponent(requestId));if(!active||at!==generation.current)return;
     const current=latest.current.doc;
     if(!remembered&&(recovered.id!==requestId||recovered.documentId!==current.id||(!visual&&!current.outputs.some(output=>fromMake(output,recovered.id))&&(recovered.manuscriptRevision!==current.revision||recovered.manuscriptTitle!==undefined&&recovered.manuscriptTitle!==current.title))))throw new Error('The recovered request no longer matches this manuscript.');
     remember(key,requestId);await receive(recovered);
    }
   }catch(cause){if(active&&at===generation.current)setError((cause as Error).message);}
   if(active)setLoading(false);
  })();return()=>{active=false;};
 },[key,api]);
 useEffect(()=>{
  if(!open||!pending||options.visible===false)return;
  const timer=setInterval(()=>{if(document.visibilityState!=='hidden')void check();},3000);
  const wake=()=>{if(document.visibilityState!=='hidden')void check();};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
  return()=>{clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[record?.id,pending,options.visible,api,open]);
 function choose(ids:string[]){setProviderReady(false);setPhotoIds(ids);setRecord(null);remember(key,null);setError('');setNotice('');}
 async function prepare(automatic=false){
  if(!api||operation.current||automatic&&capability.available!==true)return;operation.current=true;setBusy(true);setError('');setNotice('');
  try{await latest.current.options.ensureSaved?.();const selected=latest.current.doc.outputs.find(output=>output.id===outputId);if(visual&&!selected)throw new Error('Open the carousel whose words you reviewed.');const body=visual?{stage:'look',outputId,outputRevision:selected!.outputRevision||0,wordsHash:await carouselWordsHash(selected),photoIds}:{stage:'words',includeThoughts:false,...(latest.current.options.writingContext?{contextSelection:latest.current.options.writingContext}:{})};const next=await api('/api/carousel/make/preview',{method:'POST',body});if(!mounted.current)return;remember(key,next.id);setRecord(next);if(automatic){const started=await api('/api/carousel/make/'+encodeURIComponent(next.id)+'/run',{method:'POST',body:{}});if(mounted.current)await receive(started);}else await refreshSessions();}
  catch(cause){if(mounted.current)setError((cause as Error).message);}finally{operation.current=false;if(mounted.current)setBusy(false);}
 }
 async function make(){
  if(!record)return prepare(true);
  if(!api||!prepared||operation.current||capability.available!==true)return;operation.current=true;setBusy(true);setError('');
  try{await latest.current.options.ensureSaved?.();const next=await api('/api/carousel/make/'+encodeURIComponent(record.id)+'/run',{method:'POST',body:{}});if(mounted.current)await receive(next);}catch(cause){if(mounted.current)setError((cause as Error).message);}finally{operation.current=false;if(mounted.current)setBusy(false);}
 }
 async function send(){
  if(!api||!record||!prepared||!sessionId||!providerReady||operation.current)return;operation.current=true;setBusy(true);setError('');
  try{await latest.current.options.ensureSaved?.();const next=await api('/api/carousel/make/'+encodeURIComponent(record.id)+'/send',{method:'POST',body:{sessionId}});if(!mounted.current)return;setRecord(next);if(next.status==='preview'&&next.photos)setPhotoIds(next.photos.map(photo=>photo.id));setNotice('Request sent. Open the Command room if the provider needs permission or sign-in.');}
  catch(cause){if(mounted.current)setError((cause as Error).message);}finally{operation.current=false;if(mounted.current)setBusy(false);}
 }
 function review(){
  const existing=latest.current.doc.outputs.find(output=>record&&fromMake(output,record.id));
  if(existing){latest.current.onSelectOutput(existing.id);onClose();}
 }
 return <div className="make-carousel-overlay" hidden={!open}><section ref={dialog} className="make-carousel" role="dialog" aria-modal="true" aria-labelledby="make-carousel-title" aria-busy={busy||loading}>
  <header className="make-heading"><div><h2 id="make-carousel-title">{visual?'Arrange visual content':'Write carousel with AI'}</h2><p>{visual?'AI chooses templates and photos for your reviewed wording. It cannot rewrite the sequence.':'AI develops the hook, teaching and story as one complete writing draft. Photos and layouts come afterward.'}</p></div><button className="make-close" aria-label="Close AI carousel dialog" onClick={onClose}>Close</button></header>
  {imported&&<div className="make-result make-complete"><h3>{visual?'Visual content ready':'Writing content ready'}</h3><p className="make-note">The draft is saved in Outputs. Your manuscript and earlier outputs are preserved.</p><button className="cwb-primary" onClick={review}>{visual?'Review visual content':'Review writing content'}</button></div>}
  {visual&&!pending&&!imported&&<>
   <div className="make-photo-heading"><h3>Photographs to draw from <span>{photoIds.length} selected</span></h3><div><button disabled={busy||loading||photos.length>100||!photos.length} onClick={()=>choose(photos.map(photo=>photo.id))}>Use all</button><button disabled={busy||loading||!photoIds.length} onClick={()=>choose([])}>Clear</button></div></div>
   {loading?<p className="make-note">Loading your library…</p>:photos.length?<div className="make-photo-grid" role="group" aria-label="Photographs available to AI">{photos.map(photo=><button key={photo.id} disabled={busy||(!photoIds.includes(photo.id)&&photoIds.length>=100)} aria-pressed={photoIds.includes(photo.id)} onClick={()=>choose(photoIds.includes(photo.id)?photoIds.filter(id=>id!==photo.id):[...photoIds,photo.id])}><img src={'/api/sources/blob?id='+encodeURIComponent(photo.id)} alt="" loading="lazy"/><span>{photo.name||photo.rel_path}</span></button>)}</div>:<p className="make-note">No photographs in the library yet. AI can make a words-only carousel, or add photographs in Library first.</p>}
   <p className="make-note">{photoIds.length?'AI will choose from these photographs.':'No photographs selected: AI will compose with words only.'}{photos.length>100?' Select up to 100 photographs.':''}</p>
  </>}
  <AutomaticExecutionNotice capability={capability} record={record} label={visual?'Visual arrangement':'Carousel draft'}/>
  {(!record||prepared||record?.status==='needs-attention')&&!pending&&<button disabled={busy} aria-expanded={manual} onClick={()=>setManual(!manual)}>{manual?'Hide terminal options':'Use terminal instead'}</button>}
  {(!record||prepared)&&<button className="cwb-primary" disabled={busy||loading||(!visual&&!doc.paragraphs.length)||!api||capability.available!==true} onClick={()=>void make()}>{busy?'Starting…':visual?'Arrange visuals':'Make draft'}</button>}
  {manual&&!record&&<button className="cwb-primary" disabled={busy||loading||(!visual&&!doc.paragraphs.length)||!api} onClick={()=>void prepare()}>{busy?'Preparing…':'Prepare AI request'}</button>}
  {manual&&prepared&&<div className="make-send"><p className="make-note">{visual?'Prepared from this carousel’s reviewed wording and visual guidance. The current manuscript is not sent.':'Prepared from your saved manuscript, guidance and explicitly selected context. Unselected personal thoughts are excluded.'} Sending starts work in your selected provider session.</p><label className="cwb-field">Provider session<select aria-label="AI provider session" value={sessionId} disabled={busy||!sessions.length} onChange={event=>{setSessionId(event.target.value);setProviderReady(false);}}>{sessions.length?sessions.map(session=><option value={session.id} key={session.id}>{session.cli==='claude'?'Claude':'Codex'} · {session.model||session.id.slice(0,8)}</option>):<option value="">No running provider session</option>}</select></label>{selectedSession&&<label className="make-ready"><input type="checkbox" checked={providerReady} disabled={busy} onChange={event=>setProviderReady(event.target.checked)}/><span>The provider is past its sign-in and permission screens, ready for a request.</span></label>}<div className="make-actions"><button className="cwb-primary" disabled={busy||!selectedSession||!providerReady} onClick={send}>{busy?'Sending…':'Send Make request to '+(selectedSession?.cli==='claude'?'Claude':selectedSession?.cli==='codex'?'Codex':'provider')}</button><button disabled={busy} onClick={()=>{void refreshSessions().catch(cause=>setError(cause.message));}}>Refresh sessions</button></div>{!sessions.length&&<p className="make-note">Open the Command room, start Claude or Codex, and finish its permission or sign-in prompts. Return here to send this request.</p>}</div>}
  {pending&&!record?.execution&&<div className="make-result"><h3>Waiting for the AI draft</h3><p className="make-note">The request was sent to a provider session. A draft appears here when it writes its result. If it is waiting for approval, continue in the Command room.</p><button onClick={()=>void check()}>Check for draft</button></div>}
  {!imported&&record?.status==='needs-attention'&&<p className="make-error" role="alert">{record.error||'The AI result needs attention.'}{!record.execution&&' Open the Command room to inspect the reply.'}</p>}
  {error&&<p className="make-error" role="alert">{error}</p>}
  {notice&&<p className="make-notice" role="status">{notice}</p>}
  {(imported||prepared||pending||record?.status==='needs-attention'||record?.status==='result-ready'||error)&&<div className="make-actions"><button onClick={()=>{onClose();options.onNavigate?.('environment');}}>Open command room</button>{!imported&&record?.status==='needs-attention'&&<button onClick={()=>void check()}>Check corrected draft</button>}{record&&!pending&&<button disabled={busy} onClick={()=>{setRecord(null);remember(key,null);setNotice('');setError('');}}>Prepare another draft</button>}{record?.status==='result-ready'&&!imported&&<button onClick={()=>void check()}>Retry draft import</button>}</div>}
  {record?.prompt&&<details className="make-prompt"><summary>Request details</summary><pre>{record.prompt}</pre></details>}
 </section></div>;
}
