import {useAutomaticAI,AutomaticExecutionNotice,executionPending,type AIExecution} from './AutomaticExecution';
import React,{useEffect,useRef,useState} from 'react';
import type {WorkspaceOptions} from './EditorWorkspace';
import {passageBaselineJSON,type Manuscript,type PassageRevisionResult} from './document';
import './passage-revision.css';
type Session={id:string;cli:string;model?:string|null;status:string};
export type PassageRevisionRecord=PassageRevisionResult&{execution?:AIExecution;status:'preview'|'sent'|'awaiting-artifact'|'result-ready'|'needs-attention';prompt?:string;terminal?:Session;error?:string;notes?:string;finalizationVerified?:boolean};
type Props={options:WorkspaceOptions;doc:Manuscript;paragraphId:string;visible?:boolean;onClose:()=>void;onReview:(record:PassageRevisionRecord)=>Promise<void>};
const endpoint='/api/passage/revisions';
const message=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);
function stale(record:PassageRevisionRecord,doc:Manuscript,id:string){
 const paragraph=doc.paragraphs.find(value=>value.id===id);
 if(!paragraph||record.documentId!==doc.id||record.paragraphId!==id)return true;
 const captured=record.baselineJSON||(record.originalDoc?JSON.stringify({id:record.paragraphId,doc:record.originalDoc,text:record.originalText,kept:record.originalKept,attributions:record.originalAttributions}):undefined);
 return !!captured&&captured!==passageBaselineJSON(paragraph);
}
/** A contextual request surface. A result only enters the existing review editor. */
export function PassageRevision({options,doc,paragraphId,visible=true,onClose,onReview}:Props){
 const [instruction,setInstruction]=useState(''),[record,setRecord]=useState<PassageRevisionRecord|null>(null),[sessions,setSessions]=useState<Session[]>([]),[sessionId,setSessionId]=useState(''),[ready,setReady]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [manual,setManual]=useState(false);const capability=useAutomaticAI(options.api);
 const key=options.project.id+':'+doc.id+':'+paragraphId,api=options.api;
 const latest=useRef({doc,options,onReview,key});latest.current={doc,options,onReview,key};
 const generation=useRef(0),operation=useRef(false),checking=useRef(false);
 const paragraph=doc.paragraphs.find(value=>value.id===paragraphId),selected=sessions.find(value=>value.id===sessionId);
 const applied=!!record&&paragraph?.acceptanceHistory?.some(value=>value.passageRevision?.recordId===record.id),staged=!!record&&paragraph?.proposal?.passageRevision?.recordId===record.id;
 const changed=!!record&&!applied&&stale(record,doc,paragraphId),pending=!applied&&executionPending(record);
 const current=(at:number)=>generation.current===at&&latest.current.key===key;
 function receive(value:PassageRevisionRecord){setRecord(value);setInstruction(value.instruction||'');}
 function receiveSessions(value:any){const available=(value.sessions||[]).filter((session:Session)=>session.status==='ready'&&['claude','codex'].includes(session.cli));setSessions(available);setSessionId(previous=>available.some((session:Session)=>session.id===previous)?previous:available[0]?.id||'');setReady(false);}
 useEffect(()=>{
  const at=++generation.current;operation.current=false;checking.current=false;setLoading(true);setBusy(false);setRecord(null);setInstruction('');setError('');setNotice('');setReady(false);setSessions([]);setSessionId('');
  if(!api){setError('The local revision service is unavailable.');setLoading(false);return;}
  (async()=>{
   const results=await Promise.allSettled([api('/api/terminal/sessions'),api(endpoint+'/recent')]);if(!current(at))return;
   if(results[0].status==='fulfilled')receiveSessions(results[0].value);else setSessions([]);
   if(results[1].status==='fulfilled'){
    const records=results[1].value?.records||[],candidate=records.find((value:PassageRevisionRecord)=>value.projectId===options.project.id&&value.documentId===doc.id&&value.paragraphId===paragraphId);
    if(candidate)try{const recovered=await api(endpoint+'/'+encodeURIComponent(candidate.id));if(!current(at))return;if(recovered.id!==candidate.id||recovered.projectId!==options.project.id||recovered.documentId!==doc.id||recovered.paragraphId!==paragraphId)throw Error('The returned revision belongs to another passage.');receive(recovered);}catch(cause){if(current(at))setError('The saved revision could not be reopened: '+message(cause));}
   }else setError('Saved revisions could not be loaded: '+message(results[1].reason));
   if(current(at))setLoading(false);
  })();return()=>{generation.current++;};
 },[key,api]);
 async function refreshSessions(){if(!api)return;const at=generation.current;try{const value=await api('/api/terminal/sessions');if(current(at)){receiveSessions(value);setError('');}}catch(cause){if(current(at))setError(message(cause));}}
 async function check(){
  if(!api||!record||checking.current)return;const at=generation.current;checking.current=true;
  try{const next=await api(endpoint+'/'+encodeURIComponent(record.id));if(current(at)){if(next.id!==record.id||next.documentId!==doc.id||next.paragraphId!==paragraphId)throw Error('The returned revision belongs to another passage.');receive(next);setError('');}}catch(cause){if(current(at))setError(message(cause));}finally{if(current(at))checking.current=false;}
 }
 useEffect(()=>{
  if(!pending||!visible||options.visible===false)return;
  const wake=()=>{if(document.visibilityState!=='hidden')void check();};
  const timer=setInterval(wake,3000);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
  return()=>{clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);};
 },[record?.id,pending,key,visible,options.visible,api]);
 async function prepare(automatic=false){
  if(!api||operation.current||!instruction.trim()||paragraph?.proposal||automatic&&capability.available!==true)return;const at=generation.current;operation.current=true;setBusy(true);setError('');setNotice('');
  try{await latest.current.options.ensureSaved?.();if(!current(at))return;const next=await api(endpoint+'/preview',{method:'POST',body:{paragraphId,instruction:instruction.trim(),...(latest.current.options.writingContext?{contextSelection:latest.current.options.writingContext}:{})}});if(!current(at))return;if(next.projectId!==options.project.id||next.documentId!==latest.current.doc.id||next.paragraphId!==paragraphId)throw Error('The request belongs to another passage.');receive(next);setReady(false);if(automatic){const started=await api(endpoint+'/'+encodeURIComponent(next.id)+'/run',{method:'POST',body:{}});if(current(at))receive(started);}}
  catch(cause){if(current(at))setError(message(cause));}finally{if(current(at)){operation.current=false;setBusy(false);}}
 }
 async function revise(){
  if(!record||record.status!=='preview')return prepare(true);
  if(!api||changed||operation.current||paragraph?.proposal||capability.available!==true)return;
  const at=generation.current,request=record;operation.current=true;setBusy(true);setError('');
  try{await latest.current.options.ensureSaved?.();if(!current(at))return;if(stale(request,latest.current.doc,paragraphId)||latest.current.doc.paragraphs.find(value=>value.id===paragraphId)?.proposal)throw Error('This passage changed. Prepare a fresh revision.');const next=await api(endpoint+'/'+encodeURIComponent(request.id)+'/run',{method:'POST',body:{}});if(current(at))receive(next);}
  catch(cause){if(current(at))setError(message(cause));}finally{if(current(at)){operation.current=false;setBusy(false);}}
 }
 async function send(){
  if(!api||!record||record.status!=='preview'||changed||!selected||!ready||operation.current||paragraph?.proposal)return;const at=generation.current,request=record;operation.current=true;setBusy(true);setError('');
  try{await latest.current.options.ensureSaved?.();if(!current(at))return;if(stale(request,latest.current.doc,paragraphId)||latest.current.doc.paragraphs.find(value=>value.id===paragraphId)?.proposal)throw Error('This passage changed. Prepare a fresh revision before sending.');const next=await api(endpoint+'/'+encodeURIComponent(request.id)+'/send',{method:'POST',body:{sessionId}});if(current(at)){receive(next);setNotice('Sent to the provider. Open the Command room if it needs permission or sign-in.');}}
  catch(cause){if(current(at))setError(message(cause));}finally{if(current(at)){operation.current=false;setBusy(false);}}
 }
 async function review(){
  if(!api||!record||record.status!=='result-ready'||!record.artifact||operation.current||paragraph?.proposal)return;const at=generation.current,request=record;operation.current=true;setBusy(true);setError('');
  try{await latest.current.options.ensureSaved?.();if(!current(at))return;const fresh=await api(endpoint+'/'+encodeURIComponent(request.id));if(!current(at))return;if(fresh.id!==request.id)throw Error('The returned revision belongs to another request.');receive(fresh);if(stale(fresh,latest.current.doc,paragraphId))throw Error('The accepted passage, Kept constraints or sources changed. Prepare a fresh revision.');await latest.current.onReview(fresh);}
  catch(cause){if(current(at))setError(message(cause));}finally{if(current(at)){operation.current=false;setBusy(false);}}
 }
 const providerName=selected?.cli==='claude'?'Claude':'Codex';
 return <section hidden={!visible} className="ar-passage-revision" aria-label="AI passage revision">
  <header><div><h3>Revise this passage with AI</h3></div><button onClick={onClose} aria-label="Close AI passage revision">×</button></header>
  <label className="apr-instruction">Direction<textarea rows={2} aria-label="Passage revision instruction" value={instruction} disabled={busy||pending||staged} placeholder="Make the opening more direct, while keeping the quote…" onChange={event=>{setInstruction(event.target.value);setRecord(null);setReady(false);setError('');}}/></label>
  {!!paragraph?.kept.length&&<p className="apr-help">{paragraph.kept.length} Kept {paragraph.kept.length===1?'constraint':'constraints'} included · quoted words and source identity stay protected.</p>}
  {manual&&record?.status==='preview'&&!changed&&!applied&&!staged&&<><label className="apr-session">Provider session<select aria-label="Passage revision provider" value={sessionId} onChange={event=>{setSessionId(event.target.value);setReady(false);}}><option value="">Choose a ready session</option>{sessions.map(session=><option key={session.id} value={session.id}>{session.cli==='claude'?'Claude':'Codex'}{session.model?' · '+session.model:''} · {session.id.slice(0,8)}</option>)}</select></label><label className="apr-ready"><input type="checkbox" checked={ready} onChange={event=>setReady(event.target.checked)}/> I have checked this session is at its prompt and ready for this request.</label><p className="apr-help">Complete any CLI trust or sign-in prompts yourself in the Command room.</p></>}
  {loading&&<p className="apr-help">Recovering saved revisions…</p>}
  {pending&&!record?.execution&&<p role="status" className="apr-help">Waiting for the revised passage. You can keep writing; acceptance checks the original passage again.</p>}
  {applied&&<p className="apr-help">This revision was accepted. Your current passage includes the reviewed wording.</p>}
  {staged&&<p className="apr-help">This candidate is waiting in the alternative editor below. Review, edit, replace or drop it there.</p>}
  {changed&&<p className="apr-error" role="alert">The accepted passage, Kept constraints or sources changed after this request. Prepare a fresh revision.</p>}
  {record?.error&&<p className="apr-error" role="alert">{record.error}</p>}
  {error&&<p className="apr-error" role="alert">{error}</p>}{notice&&<p className="apr-help" role="status">{notice}</p>}
  <AutomaticExecutionNotice capability={capability} record={record} label="Passage revision"/>
  <div className="apr-actions">
   {(!record||record.status==='preview'||record.status==='needs-attention')&&!applied&&!staged&&<button className="apr-primary" disabled={loading||busy||pending||!!paragraph?.proposal||!instruction.trim()||changed&&record?.status==='preview'||capability.available!==true} onClick={()=>void revise()}>{busy?'Starting…':record?.status==='needs-attention'?'Revise with a fresh request':'Revise'}</button>}
   {(!pending&&!applied&&!staged)&&<button className="apr-terminal-toggle" disabled={busy} aria-expanded={manual} onClick={()=>setManual(!manual)}>{manual?'Hide terminal options':'Use terminal instead'}</button>}

   {manual&&<button disabled={loading||busy||pending||!!paragraph?.proposal||!instruction.trim()} onClick={()=>void prepare()}>{busy?'Working…':record?'Prepare fresh revision':'Prepare revision'}</button>}
   {manual&&record?.status==='preview'&&!changed&&!applied&&!staged&&<button className="apr-primary" disabled={busy||!selected||!ready||!!paragraph?.proposal} onClick={()=>void send()}>Send to {providerName}</button>}
   {record?.status==='result-ready'&&!applied&&!staged&&<button className="apr-primary" disabled={busy||changed||!!paragraph?.proposal} onClick={()=>void review()}>Review revised passage</button>}
   {record&&!applied&&<button disabled={busy} onClick={()=>void check()}>Check reply</button>}
   {manual&&<button disabled={busy} onClick={()=>void refreshSessions()}>Refresh sessions</button>}{(manual||error||record?.status==='needs-attention')&&<button onClick={()=>options.onShelfRequest?.('environment')}>Open Command room</button>}
   {!record&&!manual&&<span className="apr-action-hint">Review before replacing.</span>}
  </div>
  {record&&<details className="apr-receipt"><summary>Request and provenance</summary><p>Request {record.requestId} · saved revision {record.manuscriptRevision} · baseline {record.baselineHash?.slice(0,10)}</p><p>Voice, Positions, Recipe, attached sources and Kept constraints were captured. Review determines whether the candidate follows your direction.</p>{record.notes&&<p>{record.notes}</p>}<pre>{record.prompt||record.assembledContext}</pre></details>}
 </section>;
}
