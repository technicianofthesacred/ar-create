import {ArticleToolConnection} from '../shell/ArticleToolConnection';
import {articleOriginMatches} from './article-origin';
import {canonicalResearchSources} from '../shell/research-material-sources';
import {useAutomaticAI,AutomaticExecutionNotice,executionPending,type AIExecution} from './AutomaticExecution';
import {articleContextReceipt,type ArticleContextReceipt} from './article-context-receipt';
import {ContextHandoff} from './ContextHandoff';
import {contextCount,type WritingContextSelection} from './context-selection';
import {resolveRecordingSourceSelection} from '../library/recording-source.mjs';
import type {PreparedSource} from './prepared-source';
import ReactMarkdown from 'react-markdown';
import React,{useEffect,useRef,useState} from 'react';
import type {Manuscript} from './document';
import type {WorkspaceOptions} from './EditorWorkspace';
import {pipeline} from '../library/pipeline';
import './make-article.css';

type ArticleSource={id:string;title?:string;name?:string;rel_path?:string;rootId?:string;kind?:string;missing?:boolean;[key:string]:any};
type ProviderSession={id:string;cli:string;model?:string|null;status:string};
export type ArticleMakeRecord={firstDraft?:any;completionHash?:string;connection?:any;execution?:AIExecution;id:string;projectId?:string;requestId?:string;contextHash?:string;promptHash?:string;status:'preview'|'sent'|'awaiting-artifact'|'result-ready'|'needs-attention';prompt?:string;documentId:string|null;manuscriptRevision:number|null;manuscriptTitle?:string|null;sourceIds:string[];sessionId?:string;terminal?:ProviderSession;error?:string;artifact?:{raw:string;filename:string;hash:string};notes?:string;preparedSource?:PreparedSource;sourceArtifact?:{raw:string;hash:string};contextSelection?:WritingContextSelection;selectedContext?:{kind:string;id:string;role:string;hash:string;reviewState:string}[]};
export type ArticleDraftReview={firstDraft?:{artifactHash:string;completionHash:string};projectId?:string;manuscriptTitle?:string|null;raw:string;filename:string;requestId:string;documentId:string|null;manuscriptRevision:number|null;sourceIds:string[];notes?:string;preparedSource?:PreparedSource;contextReceipt?:ArticleContextReceipt};
export type MakeArticleProps={options:WorkspaceOptions;doc:Manuscript;onClose:()=>void;onReview:(draft:ArticleDraftReview)=>void|Promise<void>};
const MAX_SOURCES=100;
const differs=(record:ArticleMakeRecord,doc:Manuscript,project?:any)=>!articleOriginMatches(record,doc,project);
const keyFor=(projectId:string,documentId:string)=>'ar-create:article-make:'+projectId+':'+documentId;
const read=(key:string)=>{try{return window.sessionStorage.getItem(key);}catch{return null;}};
const remember=(key:string,value:string|null)=>{try{if(value===null)window.sessionStorage.removeItem(key);else window.sessionStorage.setItem(key,value);}catch{}};
const savedSelection=(key:string)=>{try{const value=JSON.parse(read(key+':sources')||'null');return Array.isArray(value)?value.filter(id=>typeof id==='string'):null;}catch{return null;}};
const readable=(source:ArticleSource)=>!source.missing&&['note','text','markdown','transcript','web'].includes(source.kind||'')&&pipeline(source).cardEligible;
const titleOf=(source:ArticleSource)=>source.title||source.name||source.rel_path?.split('/').pop()||'Untitled source';
const typeOf=(source:ArticleSource)=>source.kind==='transcript'?'Transcript':source.kind==='web'?'Article':source.kind==='text'?'Text':source.kind==='markdown'?'Document':'Note';
const messageOf=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);

/** Generate a captured draft; writing is changed only by the separate review. */
export function MakeArticle({options,doc,onClose,onReview}:MakeArticleProps){
 const [contextSelection,setContextSelection]=useState<WritingContextSelection>(options.writingContext||{});
 const [sources,setSources]=useState<ArticleSource[]>([]),[roots,setRoots]=useState<{id:string;name:string}[]>([]),[sourceIds,setSourceIds]=useState<string[]>([]),[query,setQuery]=useState(''),[sessions,setSessions]=useState<ProviderSession[]>([]),[sessionId,setSessionId]=useState(''),[ready,setReady]=useState(false),[record,setRecord]=useState<ArticleMakeRecord|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [connectionOpen,setConnectionOpen]=useState(false);const [manual,setManual]=useState(false);const capability=useAutomaticAI(options.api);
 const api=options.api,key=keyFor(options.project.id,doc.id);
 const latest=useRef({doc,options,onReview,key});latest.current={doc,options,onReview,key};
 const surface=useRef<HTMLElement|null>(null);
 const generation=useRef(0),operation=useRef(false),checking=useRef(false);
 const applied=!!record&&doc.importedDraft?.makeReceipt?.requestId===record.id;
 const stopped=!!record?.terminal&&record.terminal.status!=='ready'&&(record.status==='sent'||record.status==='awaiting-artifact');
 const pending=!applied&&!stopped&&executionPending(record);
 const prepared=!applied&&record?.status==='preview';
 const stale=!!record&&!applied&&differs(record,doc,options.project);
 const awaitingExternal=!!record?.firstDraft&&prepared&&!stale;
 const selectedSession=sessions.find(session=>session.id===sessionId);
 const current=(at:number,capturedKey:string)=>generation.current===at&&latest.current.key===capturedKey;
 function receive(next:ArticleMakeRecord){setRecord(next);if(next.contextSelection)setContextSelection(next.contextSelection);if(Array.isArray(next.sourceIds))setSourceIds(next.sourceIds.slice(0,MAX_SOURCES));}
 useEffect(()=>{
  if(options.visible===false)return;
  const dialog=surface.current,writing=dialog?.closest('.ar-writing'),earlier=document.activeElement as HTMLElement|null;
  const siblings=writing?[...writing.children].filter(element=>element!==dialog):[];
  const previous=siblings.map(element=>({element,inert:element.hasAttribute('inert')}));
  siblings.forEach(element=>element.setAttribute('inert',''));
  dialog?.querySelector<HTMLElement>('button')?.focus({preventScroll:true});
  return()=>{previous.forEach(({element,inert})=>{if(!inert)element.removeAttribute('inert');});if(earlier?.isConnected)earlier.focus({preventScroll:true});};
 },[options.visible]);
 function applySessions(result:any){const available=(result.sessions||[]).filter((session:ProviderSession)=>session.status==='ready'&&['claude','codex'].includes(session.cli));setSessions(available);setReady(false);setSessionId(previous=>available.some((session:ProviderSession)=>session.id===previous)?previous:available[0]?.id||'');}
 async function refreshSessions(){if(!api)return;const at=generation.current,capturedKey=key;const result=await api('/api/terminal/sessions');if(current(at,capturedKey))applySessions(result);}
 useEffect(()=>{
  setContextSelection(options.writingContext||{});
  const at=++generation.current;setLoading(true);setBusy(false);setError('');setNotice('');setRecord(null);setSources([]);setSourceIds([]);setSessions([]);setReady(false);setSessionId('');setQuery('');operation.current=false;checking.current=false;
  if(!api){setLoading(false);setError('The local draft service is unavailable. Reopen this workspace to reconnect.');return()=>{generation.current++;};}
  (async()=>{
   const remembered=read(key);
   const results=await Promise.allSettled([api('/api/sources/tree'),api('/api/terminal/sessions'),remembered?api('/api/article/make/'+encodeURIComponent(remembered)):api('/api/article/make/recent'),api('/api/recordings')]);
   if(!current(at,key))return;
   if(results[0].status==='fulfilled'){
    const tree=results[0].value,available=(tree.sources||[]).filter(readable);setSources(available);setRoots(tree.roots||[]);
    const requested=(remembered?savedSelection(key)??(latest.current.options.requestSelection?.sourceIds??latest.current.options.project.materialSelection?.sourceIds):(latest.current.options.requestSelection?.sourceIds??latest.current.options.project.materialSelection?.sourceIds)??savedSelection(key))??[];
    const resolved=resolveRecordingSourceSelection(requested,tree.sources||[],results[3].status==='fulfilled'?results[3].value.jobs||[]:[],readable);const selected=resolved.sourceIds.slice(0,MAX_SOURCES);setSourceIds(selected);
    if(requested.length>MAX_SOURCES)setNotice('Choose up to 100 readable sources per draft.');else if(resolved.unresolvedIds.length)setNotice('Some selected files have no linked readable transcript yet. Choose available text below or return to Library.');else if(resolved.substitutions.length)setNotice('Using the saved transcript'+(resolved.substitutions.length===1?'':'s')+' for your selected recording'+(resolved.substitutions.length===1?'':'s')+'.');
   }else setError('The source library could not be loaded. Close this panel and reopen it to retry.');
   if(results[1].status==='fulfilled')applySessions(results[1].value);else setSessions([]);
   if(results[2].status==='fulfilled'&&results[2].value){
    if(remembered)receive(results[2].value);
    else{
     const currentDoc=latest.current.doc,appliedId=currentDoc.importedDraft?.makeReceipt?.requestId;
     const records=Array.isArray(results[2].value.records)?results[2].value.records:[];
     const eligible=records.filter((value:ArticleMakeRecord)=>(value.id===appliedId||!differs(value,currentDoc,latest.current.options.project)));
     const candidate=eligible.find((value:ArticleMakeRecord)=>value.id===appliedId)||eligible[0];
     if(candidate)try{
      const recovered=await api('/api/article/make/'+encodeURIComponent(candidate.id));if(!current(at,key))return;
      if(recovered.id!==candidate.id||recovered.id!==latest.current.doc.importedDraft?.makeReceipt?.requestId&&differs(recovered,latest.current.doc,latest.current.options.project))throw new Error('The recovered request no longer matches this manuscript.');
      remember(key,recovered.id);receive(recovered);
     }catch(cause){if(current(at,key))setError('The saved request could not be recovered: '+messageOf(cause)+'. Reopen this panel to retry, or prepare another draft.');}
    }
   }
   else if(results[2].status==='rejected')setError('The saved request could not be reopened: '+messageOf(results[2].reason)+'. Reopen this panel to retry, or prepare another draft.');
   setLoading(false);
  })();
  return()=>{generation.current++;};
 },[key,api]);
 async function check(){
  if(!api||!record||checking.current)return;const at=generation.current,capturedKey=key;checking.current=true;
  try{const next=await api('/api/article/make/'+encodeURIComponent(record.id));if(current(at,capturedKey)){receive(next);setError('');}}
  catch(cause){if(current(at,capturedKey))setError(messageOf(cause)+' Check again or inspect the reply in the Command room.');}
  finally{if(current(at,capturedKey))checking.current=false;}
 }
 useEffect(()=>{
  if((!pending&&!awaitingExternal)||options.visible===false)return;
  const wake=()=>{if(document.visibilityState!=='hidden')void check();};
  const timer=setInterval(wake,3000);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
  return()=>{clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[record?.id,pending,awaitingExternal,options.visible,api,key]);
 function choose(ids:string[]){setSourceIds(ids);remember(key+':sources',JSON.stringify(ids));setReady(false);setRecord(null);remember(key,null);setError('');setNotice('');}
 async function prepare(automatic=false){
  if(!api||operation.current||loading||!sourceIds.length||sourceIds.length>MAX_SOURCES||automatic&&capability.available!==true)return;const at=generation.current,capturedKey=key;operation.current=true;setBusy(true);setError('');setNotice('');
  try{await latest.current.options.ensureSaved?.();if(!current(at,capturedKey))return;const requestInput={sourceIds,includeThoughts:false,...(contextCount(contextSelection)?{contextSelection}:{})};const next=latest.current.doc.paragraphs.length===0&&latest.current.options.prepareFirstDraft?await latest.current.options.prepareFirstDraft(requestInput):await api('/api/article/make/preview',{method:'POST',body:requestInput});if(!current(at,capturedKey))return;remember(capturedKey,next.id);remember(capturedKey+':sources',JSON.stringify(next.sourceIds||sourceIds));receive(next);if(automatic){const started=await api('/api/article/make/'+encodeURIComponent(next.id)+'/run',{method:'POST',body:{}});if(current(at,capturedKey))receive(started);}else await refreshSessions();}
  catch(cause){if(current(at,capturedKey))setError(messageOf(cause));}
  finally{if(current(at,capturedKey)){operation.current=false;setBusy(false);}}
 }
 async function make(){
  if(!record)return prepare(true);
  if(!api||!prepared||stale||operation.current||capability.available!==true)return;
  const at=generation.current,capturedKey=key,request=record;operation.current=true;setBusy(true);setError('');
  try{await latest.current.options.ensureSaved?.();if(!current(at,capturedKey))return;if(differs(request,latest.current.doc,latest.current.options.project))throw Error('Your writing changed. Make a fresh request.');const next=await api('/api/article/make/'+encodeURIComponent(request.id)+'/run',{method:'POST',body:{}});if(current(at,capturedKey))receive(next);}
  catch(cause){if(current(at,capturedKey))setError(messageOf(cause));}finally{if(current(at,capturedKey)){operation.current=false;setBusy(false);}}
 }
 async function send(){
  if(!api||!record||!prepared||stale||!selectedSession||!ready||operation.current)return;const at=generation.current,capturedKey=key,request=record;operation.current=true;setBusy(true);setError('');
  try{await latest.current.options.ensureSaved?.();if(!current(at,capturedKey))return;if(differs(request,latest.current.doc,latest.current.options.project))throw new Error('Your writing changed. Prepare another draft from the current manuscript.');const next=await api('/api/article/make/'+encodeURIComponent(request.id)+'/send',{method:'POST',body:{sessionId}});if(!current(at,capturedKey))return;receive(next);setNotice('Request sent. Continue in the Command room if the provider needs your attention.');}
  catch(cause){if(current(at,capturedKey))setError(messageOf(cause));}
  finally{if(current(at,capturedKey)){operation.current=false;setBusy(false);}}
 }
 async function review(){
  if(!api||!record?.artifact||record.status!=='result-ready'||operation.current)return;
  const at=generation.current,capturedKey=key,requestId=record.id;operation.current=true;setBusy(true);setError('');
  try{
   await latest.current.options.ensureSaved?.();if(!current(at,capturedKey))return;
   const fresh:ArticleMakeRecord=await api('/api/article/make/'+encodeURIComponent(requestId));if(!current(at,capturedKey))return;
   if(fresh.id!==requestId)throw new Error('The returned draft belongs to another request. Reopen this panel to retry.');
   receive(fresh);
   if(differs(fresh,latest.current.doc,latest.current.options.project))throw new Error('Your writing changed after this request was prepared. Prepare another draft from the current manuscript.');
   if(fresh.status!=='result-ready'||!fresh.artifact)throw new Error('The draft is not ready to review. Check again or inspect the reply in the Command room.');
   await latest.current.onReview({...(fresh.projectId?{projectId:fresh.projectId}:{}),...(fresh.manuscriptTitle!==undefined?{manuscriptTitle:fresh.manuscriptTitle}:{}),...(fresh.firstDraft&&fresh.completionHash?{firstDraft:{artifactHash:fresh.artifact.hash,completionHash:fresh.completionHash}}:{}),raw:fresh.artifact.raw,filename:fresh.artifact.filename,requestId:fresh.id,documentId:fresh.documentId,manuscriptRevision:fresh.manuscriptRevision,sourceIds:[...fresh.sourceIds],...(fresh.projectId&&fresh.requestId&&fresh.contextHash&&fresh.promptHash?{contextReceipt:articleContextReceipt({projectId:fresh.projectId,requestId:fresh.requestId,contextHash:fresh.contextHash,promptHash:fresh.promptHash,selection:fresh.contextSelection,items:fresh.selectedContext||[]})}:{}),...(fresh.notes?{notes:fresh.notes}:{}),...(fresh.preparedSource?{preparedSource:fresh.preparedSource}:{})});
  }catch(cause){if(current(at,capturedKey))setError(messageOf(cause));}
  finally{if(current(at,capturedKey)){operation.current=false;setBusy(false);}}
 }
 function keyboard(event:React.KeyboardEvent){
  if(event.key==='Escape'&&!busy){event.preventDefault();onClose();return;}
  if(event.key!=='Tab')return;
  const items=[...(surface.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')||[])];
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
 const chosen=sourceIds.map(id=>sources.find(source=>source.id===id)).filter((source):source is ArticleSource=>!!source);
 const matches=canonicalResearchSources(sources,readable,sourceIds).filter((source:ArticleSource)=>[titleOf(source),source.rel_path,typeOf(source)].join(' ').toLowerCase().includes(query.toLowerCase()));
 const folderOf=(source:ArticleSource)=>[roots.find(root=>root.id===source.rootId)?.name,(source.rel_path||'').split('/').slice(0,-1).filter(part=>!/^([a-f0-9]{8}-[a-f0-9-]{27,}|[a-f0-9]{32,})$/i.test(part)).join('/')].filter(Boolean).join(' / ')||'Library';
 return <><section ref={surface} className="ar-make-article" role="dialog" aria-modal="true" aria-labelledby="ama-title" aria-busy={loading||busy} onKeyDown={keyboard}>
  <header className="ama-heading"><div><span className="ama-eyebrow">Draft from sources</span><h2 id="ama-title">Make an article</h2><p>Choose the material. Review the complete draft before changing your writing.</p></div><button aria-label="Close article request" disabled={busy} onClick={onClose}>Close</button></header>
  <div className="ama-reader"><div className="ama-content">
  {!record&&<div className="ama-choose">
   <div className="ama-source-heading"><h3>Sources <span>{sourceIds.length} / 100 selected</span></h3><button disabled={busy||loading||!sourceIds.length} onClick={()=>choose([])}>Clear</button></div>
   {!!chosen.length&&<ul className="ama-selected" aria-label="Selected sources">{chosen.map(source=><li key={source.id}><span><strong>{titleOf(source)}</strong><small>{typeOf(source)}</small></span><button aria-label={'Remove '+titleOf(source)} disabled={busy} onClick={()=>choose(sourceIds.filter(id=>id!==source.id))}>×</button></li>)}</ul>}
   {loading?<p className="ama-note">Opening your library…</p>:sources.length?<><label className="ama-search"><span>Find a source</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Title or folder"/></label><div className="ama-source-list" role="group" aria-label="Readable source material">{matches.map(source=><label className="ama-source" key={source.id}><input type="checkbox" checked={sourceIds.includes(source.id)} disabled={busy||(!sourceIds.includes(source.id)&&sourceIds.length>=MAX_SOURCES)} onChange={event=>choose(event.target.checked?[...sourceIds,source.id]:sourceIds.filter(id=>id!==source.id))}/><span><strong>{titleOf(source)}</strong><small>{typeOf(source)} · {folderOf(source)}</small></span></label>)}</div>{!matches.length&&<p className="ama-note">No matching sources. Try another title or folder.</p>}</>:<p className="ama-note">Add documents or save a recording’s transcript in Library before making a draft.</p>}
   <p className="ama-note">Recordings need a saved transcript. Choose any personal notes or retained findings below; unselected material stays excluded.</p>
  </div>}
  {prepared&&<div className="ama-prepared-sources"><div className="ama-source-heading"><h3>{sourceIds.length} {sourceIds.length===1?'source':'sources'} selected</h3><button disabled={busy} onClick={()=>choose(sourceIds)}>Change sources</button></div><ul className="ama-selected" aria-label="Prepared sources">{chosen.map(source=><li key={source.id}><span><strong>{titleOf(source)}</strong><small>{typeOf(source)}</small></span></li>)}</ul></div>}
  {(!record||prepared)&&<ContextHandoff project={options.project} api={api} value={contextSelection} disabled={busy||loading} onChange={selection=>{setContextSelection(selection);setReady(false);setRecord(null);remember(key,null);}}/>}
  {manual&&prepared&&<div className="ama-send"><label className="ama-session"><span>Provider</span><select aria-label="AI provider session" value={sessionId} disabled={busy||!sessions.length} onChange={event=>{setSessionId(event.target.value);setReady(false);}}>{sessions.length?sessions.map(session=><option value={session.id} key={session.id}>{session.cli==='claude'?'Claude':'Codex'} · {session.model||session.id.slice(0,8)}</option>):<option value="">No running provider session</option>}</select></label>{selectedSession&&<label className="ama-ready"><input type="checkbox" checked={ready} disabled={busy} onChange={event=>setReady(event.target.checked)}/><span>The provider is signed in, past its permission screens, and ready for this request.</span></label>}<button disabled={busy} onClick={()=>void refreshSessions().catch(cause=>setError(messageOf(cause)))}>Refresh sessions</button>{!sessions.length&&<p className="ama-note">Start Claude or Codex in the Command room and finish its sign-in and permission prompts. This request stays here when you return.</p>}</div>}
  {applied&&<div className="ama-result"><h3>Draft opened for editing</h3><p className="ama-note">Your reviewed wording is in the manuscript. Its source-check notes remain here; previous writing is in Versions.</p></div>}
  {stopped&&<p className="ama-error" role="alert">The provider stopped before finishing this draft. Your writing is unchanged. Prepare another draft to try again.</p>}
  {pending&&!record?.execution&&<div className="ama-result"><h3>Waiting for draft</h3><p className="ama-note">Request sent with {record.sourceIds.length} selected {record.sourceIds.length===1?'source':'sources'}. You can leave and return. Continue in the Command room if the provider needs attention.</p><button disabled={busy} onClick={()=>void check()}>Check for draft</button></div>}
  {!applied&&record?.status==='result-ready'&&<div className="ama-result"><h3>Your draft is ready</h3><p className="ama-note">{record.firstDraft?'Review and refine this proposed direction before accepting it in the selected article.':record.documentId===null?'Review and refine this first draft before creating your document. No manuscript was present when it was requested.':'Review and refine its paragraphs before opening it for editing. Previous writing stays in Versions.'}</p>{!record.artifact&&<p className="ama-error" role="alert">The draft file is unavailable. Check the reply in the Command room and try again.</p>}</div>}
  {!applied&&record?.status==='needs-attention'&&<p className="ama-error" role="alert">{record.error||'The provider result needs attention.'}{!record.execution&&' Inspect it in the Command room, then check the corrected draft.'}</p>}
  {stale&&<p className="ama-error" role="alert">Your writing changed after this request was prepared. Prepare another draft from the current manuscript.</p>}
  {record?.sourceArtifact&&<details className="ama-details"><summary>Prepared source</summary><div className="ama-source-preview"><ReactMarkdown>{record.sourceArtifact.raw}</ReactMarkdown></div><p>Organized from the captured material. This stays with the article in Sources; it is not a speaker or translation approval.</p></details>}
  {record?.notes&&<details className="ama-details"><summary>Draft notes</summary><p>{record.notes}</p></details>}
  {record?.prompt&&<details className="ama-details"><summary>Request details</summary><pre>{record.prompt}</pre></details>}
  </div></div>
  <footer className="ama-footer">
   <AutomaticExecutionNotice capability={capability} record={record} label="Article draft"/>
   {(!record||prepared||record?.execution&&record.status==='needs-attention')&&<button disabled={busy} aria-expanded={manual} onClick={()=>setManual(!manual)}>{manual?'Hide terminal options':'Use terminal instead'}</button>}

   {error&&<p className="ama-error" role="alert">{error}</p>}{notice&&<p className="ama-notice" role="status">{notice}</p>}
   {manual&&prepared&&!ready&&!stale&&<p className="ama-send-help">{selectedSession?'Confirm provider readiness above to send.':'Start a provider in the Command room to send.'}</p>}
   <div className="ama-actions">{(manual||error||record?.status==='needs-attention')&&<button disabled={busy} onClick={()=>{onClose();options.onNavigate?.('environment');}}>Open command room</button>}{!applied&&(record?.status==='needs-attention'||(record?.status==='result-ready'&&!record.artifact))&&<button disabled={busy} onClick={()=>void check()}>Check corrected draft</button>}{((record&&!pending&&!prepared)||(!record&&error))&&<button disabled={busy||loading} onClick={()=>{setRecord(null);remember(key,null);setReady(false);setError('');setNotice('');}}>Prepare another draft</button>}
   {!record&&doc.paragraphs.length===0&&options.prepareFirstDraft&&<button disabled={loading||busy||!sourceIds.length} onClick={()=>void prepare()}>Prepare AI tools</button>}
   {awaitingExternal&&<button disabled={busy} onClick={()=>void check()}>Check for draft</button>}
   {prepared&&record?.connection&&<button disabled={busy||stale} onClick={()=>setConnectionOpen(true)}>Connect AI tools</button>}
   {(!record||prepared)&&<button className="ama-primary" disabled={loading||busy||!api||!sourceIds.length||stale||capability.available!==true} onClick={()=>void make()}>{busy?'Starting…':'Make draft'}</button>}
   {applied&&<button className="ama-primary" onClick={()=>{onClose();options.onNavigate?.('create');}}>Return to writing</button>}
   {manual&&!record&&<button className="ama-primary" disabled={loading||busy||!api||!sourceIds.length} onClick={()=>void prepare()}>{busy?'Preparing…':'Prepare request'}</button>}
   {manual&&prepared&&<button className="ama-primary" disabled={busy||!selectedSession||!ready||stale} onClick={()=>void send()}>{busy?'Sending…':'Send to '+(selectedSession?.cli==='claude'?'Claude':selectedSession?.cli==='codex'?'Codex':'provider')}</button>}
   {!applied&&record?.status==='result-ready'&&record.artifact&&<button className="ama-primary" disabled={busy||stale} onClick={()=>void review()}>{busy?'Opening…':'Review draft'}</button>}
   </div>
  </footer>
 </section>{connectionOpen&&record?.connection&&<ArticleToolConnection launch={{connection:record.connection,articleTitle:doc.title,projectId:record.projectId,documentId:record.documentId,selectedSourceIds:record.sourceIds,request:{id:record.id}}} onClose={()=>{setConnectionOpen(false);void check();}}/>}</>;
}
