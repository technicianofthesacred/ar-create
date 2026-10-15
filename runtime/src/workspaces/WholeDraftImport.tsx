import {ArticleContextReceipt} from './ArticleContextReceipt';
import React,{useEffect,useRef,useState} from 'react';
import {InlineDocument} from '../donors/mag/InlineDocument';
import {parseWholeDraft,manuscriptReviewIdentity,sameWholeDraftReview,reviseWholeDraftReview,approveWholeDraftMarks,skipWholeDraftPersonalNotes,type WholeDraftCandidate} from './wholeDraft';
import {approvalMarks,personalNoteQuestions} from './editorial-state.mjs';
import type {Manuscript} from './document';
import './whole-draft.css';
import {readWholeDraftRecovery,saveWholeDraftRecovery,clearWholeDraftRecovery} from './wholeDraftRecovery';

export function WholeDraftImport({document,projectId=document.id,onAccept,onClose,initialCandidate,api}:{api?:(path:string,options?:any)=>Promise<any>;document:Manuscript;initialCandidate?:WholeDraftCandidate;projectId?:string;onAccept?:(candidate:WholeDraftCandidate)=>Promise<void>;onClose:()=>void}) {
 const [start]=useState(()=>{const saved=readWholeDraftRecovery(projectId,document);return {saved,conflict:!!saved&&!!initialCandidate&&!sameWholeDraftReview(saved,initialCandidate)};});
 const [recovered,setRecovered]=useState(start.saved);
 const [raw,setRaw]=useState(start.saved?.raw||initialCandidate?.raw||''),[candidate,setCandidate]=useState<WholeDraftCandidate|null>(start.saved||initialCandidate||null),[recoveryWarning,setRecoveryWarning]=useState(''),[error,setError]=useState(start.conflict?'Another draft is already waiting for review. It has been kept. Finish it or choose another draft before opening the new copy.':''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false);
 useEffect(()=>{if(initialCandidate&&candidate&&!start.conflict&&!saveWholeDraftRecovery(projectId,candidate))setRecoveryWarning('This browser could not keep a recovery copy. Keep your original draft or reopen its source.');},[]);
 useEffect(()=>{if(!api||!candidate?.makeReceipt?.requestId||candidate.originalRaw)return;let active=true;const requestId=candidate.makeReceipt.requestId;
  void api('/api/article/make/'+encodeURIComponent(requestId)).then(record=>{if(!active||record.id!==requestId||record.status!=='result-ready'||record.finalizationVerified!==true||typeof record.artifact?.raw!=='string')return;setCandidate(previous=>{if(!previous||previous.originalRaw||previous.makeReceipt?.requestId!==requestId)return previous;const next={...previous,originalRaw:record.artifact.raw,originalRawKind:'captured-source' as const};return saveWholeDraftRecovery(projectId,next,previous)?next:previous;});}).catch(()=>{});
  return()=>{active=false;};
 },[api,candidate?.makeReceipt?.requestId,!!candidate?.originalRaw,projectId]);
 const loading=useRef(0),surface=useRef<HTMLElement|null>(null),reader=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  const dialog=surface.current,writing=dialog?.closest('.ar-writing');
  const siblings=writing?[...writing.children].filter(element=>element!==dialog):[];
  const previous=siblings.map(element=>({element,inert:element.hasAttribute('inert')}));
  siblings.forEach(element=>element.setAttribute('inert',''));
  const earlier=globalThis.document.activeElement as HTMLElement|null;
  dialog?.querySelector<HTMLElement>('button')?.focus({preventScroll:true});
  return()=>{previous.forEach(({element,inert})=>{if(!inert)element.removeAttribute('inert');});if(earlier?.isConnected)earlier.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{if(reader.current)reader.current.scrollTop=0;},[candidate?.fileName]);
 function preview(text:string,fileName='Pasted DEV draft') {
  try{const parsed=parseWholeDraft(text,document,fileName);const saved=saveWholeDraftRecovery(projectId,parsed);setRecovered(null);setRecoveryWarning(saved?'':'This browser could not keep a recovery copy. Keep your original draft file.');setRaw(text);setCandidate(parsed);setEditing(false);setError('');}
  catch(e){setError((e as Error).message);}
 }
 async function load(file:File) {
  const request=++loading.current;setBusy(true);setError('');
  try{if(file.size>256*1024)throw new Error('Choose a DEV draft under 256 KB.');const text=await file.text();if(request===loading.current)preview(text,file.name);}
  catch(e){if(request===loading.current)setError((e as Error).message);}
  finally{if(request===loading.current)setBusy(false);}
 }
 async function accept() {
  if(!candidate||!onAccept||busy||editing)return;setBusy(true);setError('');
  try{await onAccept(candidate);clearWholeDraftRecovery(projectId,candidate.baseDocumentId);onClose();}
  catch(e){setError((e as Error).message+' The current manuscript is intact.');}
  finally{setBusy(false);}
 }
 function dropPreview(){clearWholeDraftRecovery(projectId,document.id);onClose();}
 function chooseAnother(){clearWholeDraftRecovery(projectId,document.id);setCandidate(null);setRecovered(null);setRaw('');setError('');setRecoveryWarning('');}
 function editorialAction(action:'approve'|'skip'){if(!candidate||editing||busy)return;try{const next=action==='approve'?approveWholeDraftMarks(candidate,document):skipWholeDraftPersonalNotes(candidate,document);if(!saveWholeDraftRecovery(projectId,next,candidate))throw Error('Could not keep this review decision on the device. Your existing draft remains intact.');setCandidate(next);setRaw(next.raw);setError('');}catch(cause:any){setError(cause.message);}}
 const stale=!!candidate&&(candidate.baseDocumentId!==document.id||candidate.baseRevision!==document.revision||(candidate.baseIdentity!==undefined&&candidate.baseIdentity!==manuscriptReviewIdentity(document)));
 const markedLines=candidate?.warnings.find(warning=>warning.includes('marked for approval'));
 const questions=candidate?personalNoteQuestions(candidate.raw):[];
 const skipped=!!questions.length&&questions.every(question=>candidate?.editorialReview?.skippedPersonalNotes?.includes(question));
 const marks=candidate?approvalMarks(candidate.raw):{pairs:0,tokens:0};
 return <section ref={surface} className="ar-whole-draft" role="dialog" aria-modal="true" aria-labelledby="whole-draft-title" aria-label="Whole draft handoff">
  <header className="ar-whole-draft-header"><div className="ar-whole-draft-header-inner"><div><span className="ar-whole-draft-eyebrow">Draft preview</span><h3 id="whole-draft-title">{candidate?'Review article':'Bring in a draft'}</h3></div><button aria-label="Close draft preview" onClick={onClose} disabled={busy||editing}>×</button></div></header>
  <div ref={reader} className="ar-whole-draft-reader"><div className="ar-whole-draft-content">
   {!candidate?<div className="ar-whole-draft-intake"><p>Review your draft, then open it for editing. Previous writing stays in Documents.</p><label className="ar-whole-draft-file">Choose magazine draft <input aria-label="Choose magazine draft" type="file" accept=".md,.markdown,text/markdown,text/plain" disabled={busy} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void load(file);e.currentTarget.value='';}}/></label><label className="ar-whole-draft-paste">Complete draft<textarea aria-label="Complete draft" value={raw} placeholder="Or paste your complete magazine draft here…" disabled={busy} onChange={e=>{setRaw(e.target.value);setError('');}} rows={10}/></label></div>:<>
    <div className="ar-whole-draft-reading-note"><p>{recovered&&!recoveryWarning?'Recovered draft preview · kept on this device. ':''}Click any paragraph to refine it.</p>{stale&&<p className="ar-whole-draft-review-mark">Your current writing changed after this preview began. Choose the draft again to review it against the current manuscript.</p>}{markedLines&&<p className="ar-whole-draft-review-mark">{markedLines}</p>}{marks.tokens>0&&<button disabled={editing||busy||stale} onClick={()=>editorialAction('approve')}>Approve marked prose</button>}{candidate.editorialReview?.approvalResolvedAt&&!marks.tokens&&<p>Approval marks resolved by an explicit review action. Source and quote approval remain separate.</p>}</div>
    {!!questions.length&&<details className="ar-whole-draft-questions" open={!skipped}><summary>Questions for you · {questions.length}{skipped?' · skipped for now':''}</summary><p>Optional: add your own words in the draft, or skip for now. Requests stay in the original receipt.</p><ul>{questions.map((question,index)=><li key={index}>{question}</li>)}</ul>{!skipped&&<button disabled={editing||busy||stale} onClick={()=>editorialAction('skip')}>Skip for now</button>}</details>}
    <InlineDocument key={candidate.fileName} raw={candidate.raw} label="Whole draft candidate" protectGuidanceQueue={false} onDirtyChange={setEditing} onSave={async(next,seen)=>{if(seen!==candidate.raw)throw new Error('The draft preview changed. Your edit is retained.');const parsed=reviseWholeDraftReview(candidate,next,document);if(!saveWholeDraftRecovery(projectId,parsed,candidate)){setRecoveryWarning('The browser could not save the recovery copy. Your paragraph edit is still open.');throw new Error('Could not keep this edit on the device. Your words are still here; retry the save.');}setRecoveryWarning('');setCandidate(parsed);setRaw(next);return next;}}/>
    {candidate.makeReceipt&&<ArticleContextReceipt receipt={candidate.makeReceipt} api={api}/>}
    <details className="ar-whole-draft-receipt"><summary>Review notes</summary><p>{candidate.fileName}</p>{candidate.magazineProvenance&&<><p>Read-only original · {candidate.magazineProvenance.rootLabel}</p><p>{candidate.magazineProvenance.rootPath} / {candidate.magazineProvenance.relativePath}</p><p>Original SHA-256: {candidate.magazineProvenance.sha256}</p><p>Edits apply to this review copy. The original source hash identifies the untouched original.</p></>}{candidate.makeReceipt&&<><p>{candidate.makeReceipt.sourceIds.length} {candidate.makeReceipt.sourceIds.length===1?'source':'sources'} supplied to AI. These are context, not verified citations.</p>{candidate.makeReceipt.notes&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{candidate.makeReceipt.notes}</pre>}</>}<ul>{candidate.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul></details>
   </>}
  </div></div>
  <footer className="ar-whole-draft-footer"><div className="ar-whole-draft-footer-inner">
   <div className="ar-whole-draft-save-note"><span>{candidate?.firstDraft?'This first draft stays in the selected article.':candidate?.baseOrigin?.kind==='empty-project'?'This first draft will create a real document.':'Previous writing stays in Documents.'}</span>{candidate&&!recoveryWarning&&<span>Preview kept on this device.</span>}{editing&&<span>Save or cancel your paragraph edit to continue.</span>}{!onAccept&&candidate&&<span>Acceptance is unavailable here; your current writing is intact.</span>}{recoveryWarning&&<p role="alert">{recoveryWarning}</p>}{error&&<p role="alert">{error}</p>}</div>
   <div className="ar-whole-draft-actions"><button disabled={busy||editing} onClick={dropPreview}>Keep current writing</button>{candidate?<>{!candidate.makeReceipt&&<button disabled={busy||editing} onClick={chooseAnother}>Choose another draft</button>}<button className="ar-whole-draft-primary" disabled={busy||editing||stale||!onAccept} onClick={()=>void accept()}>{busy?'Saving draft…':candidate.firstDraft?'Accept first draft':'Open as new document'}</button></>:<button className="ar-whole-draft-primary" disabled={busy||!raw.trim()} onClick={()=>preview(raw)}>{busy?'Opening draft…':'Review whole draft'}</button>}</div>
  </div></footer>
 </section>;
}
