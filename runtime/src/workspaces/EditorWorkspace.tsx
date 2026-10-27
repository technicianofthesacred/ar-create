import {ManuscriptEditor} from './ManuscriptEditor';
import {SelectionRewrite,type RewriteSelection} from './SelectionRewrite';
import {captureSelection} from './selection-rewrite.mjs';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection} from '@tiptap/pm/state';
import {ArticleContextReceipt} from './ArticleContextReceipt';
import type {WritingContextSelection,TerminalHandoff} from './context-selection';
import React,{useEffect,useId,useRef,useState} from 'react';
import './writing-controls.css';
import {TerminalWorkspace,type TerminalDraftContext} from './TerminalWorkspace';
import {WholeDraftImport} from './WholeDraftImport';
import {MakeArticle} from './MakeArticle';
import {PassageRevision,type PassageRevisionRecord} from './PassageRevision';
import {candidateFromArticleResult} from './wholeDraft';
import type {WholeDraftCandidate} from './wholeDraft';
import type {Editor} from '@tiptap/core';
import {InlineParagraph} from '../donors/wordforge/InlineParagraph';
import {readWritingLocation,saveWritingLocation,reconcileWritingLocation,clampedWritingSelection,writingLocationKey,type WritingView} from './writingLocation';
import {useDraftSafety} from '../donors/wordforge/wf-draft-safety';
import {blockQuoteForm,inlineQuoteForm,referenceCardForm,paraphraseForm} from '../donors/study/quoteForms';
import {newParagraph,revise,passageBaselineJSON,stagePassageRevision,proposalAcceptanceIssue,createManualProposal,createTerminalProposal,createTerminalCandidate,pendingResearchCandidate,stageResearchCandidate,dropResearchCandidate,acceptResearchCandidate,locatorLabel,locatorDetails,plainText,structuredMarkdown,takeProposal,dropProposal,importLegacy,uid,type Manuscript,type Attribution,type Proposal} from './document';
export type Evidence=Omit<Attribution,'form'>;
export type ResearchSelection={scope:'research';sourceIds:string[];cardIds?:string[];nonce?:number};
export type WorkspaceOptions={readOutputAsset?:typeof fetch;outputExport?:(doc:Manuscript,output:any,format:'html'|'markdown'|'json')=>Promise<any>;mediaApi?:{uploadImageProgress:(file:File,onProgress:(n:number)=>void,options?:{filename?:string})=>Promise<string>};onUndoArrangement?:(outputId:string)=>Promise<void>;canUndoArrangement?:boolean;onRefreshOutput?:(outputId:string)=>Promise<void>;selectedOutputId?:string;onReviewCarouselWords?:(outputId:string)=>Promise<any>;onCreateOutput?:(kind:'article'|'carousel')=>Promise<string>;compositionCapabilities?:{articleAI?:boolean;carouselAI?:boolean;manualCreate?:boolean;restore?:boolean};onOutputWriting?:(outputId?:string)=>void;onOutputSelect?:(outputId:string)=>void;outputRelationship?:(doc:Manuscript,output:any)=>{stale:boolean;label?:string;canUpdate?:boolean;canRefresh?:boolean;writingStale?:boolean;sourceStale?:boolean;canRefreshUnchangedWriting?:boolean};externalReplacementNonce?:number;activity:'create'|'use'|'environment';requestedPassageView?:'passage'|'draft'|'return';requestedPassageNonce?:number;selectedParagraphId?:string;requestSelection?:ResearchSelection;writingContext?:WritingContextSelection;terminalHandoff?:TerminalHandoff;onParagraphFocus?:(id:string)=>void;visible?:boolean;requestedEvidenceId?:string;requestedEvidenceNonce?:number;project:any;document?:Manuscript;evidence?:Evidence[];onDocumentChange:(doc:Manuscript)=>void;onWholeDraftAccept?:(candidate:WholeDraftCandidate)=>Promise<void>;ensureSaved?:()=>Promise<void>;prepareFirstDraft?:(input:any)=>Promise<any>;onNavigate?:(s:string)=>void;onShelfRequest?:(s:string,payload?:{sourceId:string;excerpt?:string;locator?:Attribution['locator'];sourceHash?:string})=>void;api?:(path:string,options?:any)=>Promise<any>};
type EditorWorkspaceProps={options:WorkspaceOptions;doc:Manuscript;change:(d:Manuscript,origin?:'native')=>void;focusRef:React.MutableRefObject<(id?:string)=>void>};
export function EditorWorkspace(props:EditorWorkspaceProps){return <WritingEditorWorkspace key={writingLocationKey(props.options.project.id,props.doc.id)} {...props}/>;}
function WritingEditorWorkspace({options,doc,change,focusRef}:EditorWorkspaceProps){
 const locationRef=useRef<ReturnType<typeof readWritingLocation>|undefined>(undefined);
 if(!locationRef.current)locationRef.current=readWritingLocation(options.project.id,doc.id,doc.paragraphs.map(p=>p.id));
 const location=locationRef.current;
 reconcileWritingLocation(location,doc.paragraphs.map(p=>p.id));
 const persistTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 function persistLocation(){if(persistTimer.current!==undefined){clearTimeout(persistTimer.current);persistTimer.current=undefined;}saveWritingLocation(options.project.id,doc.id,location);}
 function scheduleLocation(){if(persistTimer.current===undefined)persistTimer.current=setTimeout(persistLocation,120);}
 const workspaceId=useId();
 const [revisionOpen,setRevisionOpen]=useState(false),[rewriteSelection,setRewriteSelection]=useState<RewriteSelection|null>(null),[rewriteUndo,setRewriteUndo]=useState<string|null>(null),[rewriteRecord,setRewriteRecord]=useState<PassageRevisionRecord|undefined>(undefined),[savedRewrites,setSavedRewrites]=useState<any[]>([]);
 const externalReplacement=useRef(options.externalReplacementNonce);
 useEffect(()=>{if(externalReplacement.current===options.externalReplacementNonce)return;externalReplacement.current=options.externalReplacementNonce;setRevisionOpen(false);setRewriteSelection(null);setRewriteRecord(undefined);setRewriteUndo(null);setWholeDraftOpen(false);setMakeArticleOpen(false);setGeneratedDraft(undefined);setSelected(null);setNotice('');proposalEditors.current.clear();},[options.externalReplacementNonce]);
 const [wholeDraftOpen,setWholeDraftOpen]=useState(false),[makeArticleOpen,setMakeArticleOpen]=useState(false),[generatedDraft,setGeneratedDraft]=useState<WholeDraftCandidate|undefined>(undefined);
 const articleMode=!!options.terminalHandoff?.preparedArticle;
 const commandMode=options.activity==='environment',research=options.requestSelection?.scope==='research';const [notesOpen,setNotesOpen]=useState(false);
 const [tab,setTab]=useState<'passage'|'terminal'|'draft'>(options.activity==='environment'?'terminal':'passage');
 const [writingView,setWritingView]=useState<WritingView>(location.view);
 const viewRef=useRef(writingView);viewRef.current=writingView;
 const restoringScroll=useRef(false);
 const bankRef=useRef<HTMLElement|null>(null),manuscriptRef=useRef<HTMLDivElement|null>(null),focusFrame=useRef<number|undefined>(undefined);
 const pendingResearch=pendingResearchCandidate(doc,options.project.id),researchCandidate=pendingResearch?.proposal,inheritedResearch=researchCandidate?.requestManifest?.purpose==='study-inheritance';
 const [acceptBusy,setAcceptBusy]=useState<string|null>(null);const acceptanceLock=useRef(false),latestOptions=useRef(options);latestOptions.current=options;
 const editors=useRef(new Map<string,Editor>()),proposalEditors=useRef(new Map<string,Editor>());const latest=useRef(doc);latest.current=doc;
 const firstEvidence=useRef<{target:string;card:Evidence;form:Attribution['form']}|null>(null);
 useEffect(()=>{let alive=true;if(options.api)void options.api('/api/passage/revisions/recent').then(result=>{if(alive)setSavedRewrites((result.records||[]).filter((r:any)=>r.selection&&!r.applied&&r.documentId===doc.id&&r.projectId===options.project.id&&r.status!=='preview'));}).catch(()=>{});return()=>{alive=false;};},[options.api,options.project.id,doc.id]);
 async function resumeRewrite(recordId:string){
  try{const record=await latestOptions.current.api?.('/api/passage/revisions/'+encodeURIComponent(recordId));const p=latest.current.paragraphs.find(p=>p.id===record?.paragraphId);if(!record?.selection||!p||record.projectId!==latestOptions.current.project.id||record.documentId!==latest.current.id||record.baselineJSON!==passageBaselineJSON(p))throw Error('This saved rewrite belongs to earlier words. Select your current words for a fresh rewrite.');setRewriteRecord(record);setRewriteSelection({id:p.id,from:record.selection.from,to:record.selection.to,text:record.selection.text,baselineJSON:record.baselineJSON});}catch(cause){setNotice((cause as Error).message);}
 }
 function editorReady(id:string,editor:Editor,initial=true){
  editors.current.set(id,editor);if(initial&&id===location.activeId)restoreCaret(id,editor);
  const pending=firstEvidence.current;if(!pending||pending.target!==id)return;
  firstEvidence.current=null;
  queueMicrotask(()=>{if(!editor.isDestroyed&&latest.current.paragraphs.some(p=>p.id===id))insertEvidence(editor,id,pending.card,pending.form);});
 }
 function stageResearch(candidate:Proposal){
  const current=pendingResearchCandidate(latest.current,options.project.id),manifest=candidate.requestManifest as any;
  if(manifest?.projectId&&manifest.projectId!==options.project.id){setNotice('This reply belongs to another exploration. Nothing was changed.');return;}
  const sourceIds=manifest?.scope==='research'?[...new Set([...(manifest.sourceSelection?.requestedIds||manifest.sources?.map((s:any)=>s.id)||[]),...(manifest.retainedContext?.sourceIds||[])])]:options.requestSelection?.sourceIds||[];
  const cardIds=manifest?.scope==='research'?manifest.cardSelection?.requestedIds||[]:options.requestSelection?.cardIds||[];
  const next=stageResearchCandidate(latest.current,current?{...current,proposal:candidate}:{projectId:options.project.id,sourceIds,cardIds,proposal:candidate});
  if(next===latest.current){setNotice('Review or drop the waiting research reply before selecting another.');return;}
  latest.current=next;change(next);
 }
 const [previewBusy,setPreviewBusy]=useState<string|null>(null);const [includeThoughts,setIncludeThoughts]=useState(false);const [proposalBusy,setProposalBusy]=useState<string|null>(null);const [focused,setFocused]=useState<string|null>(options.selectedParagraphId||location.activeId||null);const [selected,setSelected]=useState<{id:string;text:string;parts?:{id:string;text:string}[]}|null>(null);const [notice,setNotice]=useState('');const [bank,setBank]=useState(false);
 const activeId=[focused,options.selectedParagraphId,location.activeId].find(id=>doc.paragraphs.some(p=>p.id===id))||doc.paragraphs[0]?.id;const active=doc.paragraphs.find(p=>p.id===activeId);
 useEffect(()=>{if(options.selectedParagraphId&&doc.paragraphs.some(p=>p.id===options.selectedParagraphId)){setFocused(options.selectedParagraphId);location.activeId=options.selectedParagraphId;scheduleLocation();}},[options.selectedParagraphId]);
 useEffect(()=>{location.activeId=activeId;if(activeId)options.onParagraphFocus?.(activeId);scheduleLocation();},[activeId]);
 useEffect(()=>{if(options.activity==='environment')setTab(options.requestedPassageView==='draft'?'draft':'terminal');else setTab('passage');},[options.activity,options.requestSelection?.nonce]);
 useEffect(()=>{if(options.terminalHandoff)setTab('terminal');},[options.terminalHandoff?.nonce]);
 useEffect(()=>{
  if(!options.requestedPassageView||!options.requestedPassageNonce)return;
  const id=options.selectedParagraphId||activeId;if(!id)return;
  setFocused(id);location.activeId=id;setTab(options.requestedPassageView==='draft'?'draft':'passage');
  if(options.requestedPassageView==='passage'){location.view='focus';setWritingView('focus');scheduleLocation();}
  const frame=requestAnimationFrame(()=>{const ed=(options.requestedPassageView==='draft'?proposalEditors:editors).current.get(id);if(ed&&!ed.isDestroyed){if(options.requestedPassageView!=='draft'&&(options.requestedPassageView!=='return'||!(ed as any).nativeEditor))restoreCaret(id,ed);ed.commands.focus(undefined,{scrollIntoView:false});ed.view.dom.scrollIntoView?.({block:'nearest'});}});
  return()=>cancelAnimationFrame(frame);
 },[options.requestedPassageNonce]);
 useEffect(()=>{if(!options.requestedEvidenceId)return;setBank(true);const frame=requestAnimationFrame(()=>bankRef.current?.querySelector('.ar-requested-card')?.scrollIntoView?.({block:'nearest'}));return()=>cancelAnimationFrame(frame);},[options.requestedEvidenceId,options.requestedEvidenceNonce]);
 const safety=useDraftSafety({save:()=>options.onDocumentChange(latest.current),idleMs:1200});
 function remember(id:string){const ed=editors.current.get(id);if(ed&&!ed.isDestroyed){const {from,to}=ed.state.selection;delete location.selections[id];location.selections[id]={from,to};if(ed.isFocused)location.activeId=id;scheduleLocation();}}
 function restoreCaret(id:string,ed:Editor){const saved=location.selections[id];if(saved){const valid=clampedWritingSelection(saved,ed.state.doc.content.size);location.selections[id]=valid;ed.commands.setTextSelection(valid);}}
 useEffect(()=>{
  const flush=()=>{if(location.activeId)remember(location.activeId);persistLocation();};
  window.addEventListener('pagehide',flush);
  const visibility=()=>{if(document.visibilityState==='hidden')flush();};document.addEventListener('visibilitychange',visibility);
  return()=>{flush();window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);if(focusFrame.current!==undefined)cancelAnimationFrame(focusFrame.current);};
 },[]);
 useEffect(()=>{
  // Restore after passage visibility has changed, including returning from a
  // hidden activity. A hidden panel's transient zero must not replace its hint.
  if(options.visible===false||commandMode&&tab==='terminal')return;
  restoringScroll.current=true;
  if(manuscriptRef.current)manuscriptRef.current.scrollTop=location.scrolls[writingView];
  const frame=requestAnimationFrame(()=>{if(manuscriptRef.current)manuscriptRef.current.scrollTop=location.scrolls[writingView];restoringScroll.current=false;});
  return()=>cancelAnimationFrame(frame);
 },[writingView,options.visible,options.activity,tab]);
 focusRef.current=(id)=>{const key=[id,focused,location.activeId].find(value=>latest.current.paragraphs.some(p=>p.id===value))||latest.current.paragraphs[0]?.id;if(!key)return;setFocused(key);location.activeId=key;scheduleLocation();setTab('passage');if(focusFrame.current!==undefined)cancelAnimationFrame(focusFrame.current);focusFrame.current=requestAnimationFrame(()=>{const ed=editors.current.get(key);if(ed&&!ed.isDestroyed&&!ed.isFocused){restoreCaret(key,ed);ed.commands.focus(undefined,{scrollIntoView:false});}});};
 function switchWritingView(view:'continuous'|'focus'){
  if(activeId)remember(activeId);
  location.scrolls[writingView]=manuscriptRef.current?.scrollTop||0;
  location.view=view;setWritingView(view);scheduleLocation();
  if(activeId)focusRef.current(activeId);
  requestAnimationFrame(()=>{if(manuscriptRef.current)manuscriptRef.current.scrollTop=location.scrolls[view];});
 }
 function adjacentPassage(direction:-1|1){
  const target=doc.paragraphs[activeIndex-1+direction];if(!target)return;
  if(activeId)remember(activeId);
  options.onParagraphFocus?.(target.id);focusRef.current(target.id);
  if(manuscriptRef.current)manuscriptRef.current.scrollTop=0;
 }
 function commandRoom(){
  if(activeId){remember(activeId);location.activeId=activeId;options.onParagraphFocus?.(activeId);}
  options.onShelfRequest?.('environment');
 }
 const activeIndex=active?doc.paragraphs.indexOf(active)+1:0;
 const wordCount=(text:string)=>text.trim().split(/\s+/).filter(Boolean).length;
 const manuscriptWords=doc.paragraphs.reduce((total,p)=>total+wordCount(plainText(p.doc)),0);
 const paragraphChange=(id:string,json:any,proposal=false)=>{
  const next=latest.current.paragraphs.map(p=>p.id===id?proposal?{...p,proposal:{...p.proposal!,doc:json,text:structuredMarkdown(json)}}:{...p,doc:json,text:structuredMarkdown(json)}:p);
  if(!proposal)setRewriteUndo(null);
  const updated=proposal?{...latest.current,paragraphs:next}:revise(latest.current,next);latest.current=updated;change(updated);safety.note({passageId:doc.id,paragraphId:id,text:JSON.stringify(json)});
 };
 async function propose(id:string){
  if(latest.current.paragraphs.find(p=>p.id===id)?.proposal){setTab('draft');setNotice('Review or drop the waiting proposal before opening another.');return;}
  setProposalBusy(id);let guidance;
  try{if(options.api)guidance=await options.api('/api/guidance');}
  catch{setNotice('Alternative wording remains manual. Guidance revisions could not be read and are recorded as unknown.');}
  finally{change(createManualProposal(latest.current,id,guidance));setTab('draft');setProposalBusy(null);}
 }
 async function reviewRevision(record:PassageRevisionRecord){
  const replacementNonce=latestOptions.current.externalReplacementNonce;
  const next=await stagePassageRevision(latest.current,options.project.id,record),staged=next.paragraphs.find(value=>value.id===record.paragraphId);
  const current=latest.current,paragraph=current.paragraphs.find(value=>value.id===record.paragraphId);
  if(latestOptions.current.externalReplacementNonce!==replacementNonce)throw Error('The writing workspace was replaced while this revision was being opened. Review it again against the current words.');
  if(!paragraph||paragraph.proposal||!staged?.proposal||passageBaselineJSON(paragraph)!==staged.proposal.passageRevision?.baselineJSON)throw Error('The passage changed while its revision was being opened. Prepare a fresh revision.');
  const updated={...current,paragraphs:current.paragraphs.map(value=>value.id===record.paragraphId?{...value,proposal:staged.proposal}:value)};
  latest.current=updated;change(updated);setFocused(record.paragraphId);setTab(record.selection?'passage':'draft');setRevisionOpen(false);setRewriteSelection(null);setSavedRewrites(values=>values.filter(r=>r.id!==record.id));setNotice('AI revision ready for review. Accepted wording stays in place until you replace it.');
 }
 function completeAcceptance(id:string){
  const current=latest.current,paragraph=current.paragraphs.find(value=>value.id===id);if(!paragraph?.proposal)return;
  const issue=proposalAcceptanceIssue(current,id);if(issue){setNotice(issue);return;}
  const proposal=paragraph.proposal,next=takeProposal(current,id);if(next===current)return;
  if(proposal.passageRevision?.selection){
   const ed=editors.current.get(id),range=proposal.passageRevision.selection,replacement=proposal.passageRevision.replacement;
   if(!ed||ed.isDestroyed||typeof replacement!=='string'||!ed.schema.nodeFromJSON(paragraph.doc).eq(ed.state.doc)){setNotice('The passage changed in the editor. Select again for a fresh rewrite.');return;}
   const candidate=ed.schema.nodeFromJSON(next.paragraphs.find(p=>p.id===id)!.doc),fragment=candidate.slice(range.from,range.from+replacement.length).content;
   const transaction=closeHistory(ed.state.tr).replaceWith(range.from,range.to,fragment);transaction.setSelection(TextSelection.create(transaction.doc,range.from+replacement.length));ed.view.dispatch(transaction);
   // Close the native history event so future typing does not join acceptance.
   ed.view.dispatch(closeHistory(ed.state.tr));setRewriteUndo(id);setSelected(null);
  }
  latest.current=next;change(next);
  if(proposal.method==='ai-revision'){setTab('passage');setNotice(proposal.passageRevision?.selection?'Selected words replaced. Undo is available in the editor.':'Reviewed AI wording replaced this passage. Sources, Kept constraints and revision history are retained.');}
  if(proposal.method==='terminal'){
   setNotice('Terminal reply appended as a new passage. Original wording and kept constraints are preserved.');
   const added=next.paragraphs.find(value=>value.acceptedFrom?.proposalId===proposal.id);if(added){setFocused(added.id);options.onParagraphFocus?.(added.id);}setTab('passage');
  }
 }
 async function acceptProposal(id:string){
  if(acceptanceLock.current)return;
  const current=latest.current,paragraph=current.paragraphs.find(value=>value.id===id),proposal=paragraph?.proposal;if(!proposal)return;
  const issue=proposalAcceptanceIssue(current,id);if(issue){setNotice(issue);return;}
  if(proposal.method!=='ai-revision'){completeAcceptance(id);return;}
  const api=latestOptions.current.api,projectId=latestOptions.current.project.id,documentId=current.id,receipt=proposal.passageRevision,replacementNonce=latestOptions.current.externalReplacementNonce;
  if(!api||!receipt){setNotice('The revision service is unavailable. Reconnect before accepting this AI revision.');return;}
  acceptanceLock.current=true;setAcceptBusy(id);
  try{
   safety.flush();await latestOptions.current.ensureSaved?.();
   if(latestOptions.current.project.id!==projectId||latest.current.id!==documentId||latestOptions.current.externalReplacementNonce!==replacementNonce)throw Error('The writing workspace changed. This revision was not accepted.');
   const fresh=await api('/api/passage/revisions/'+encodeURIComponent(receipt.recordId));
   if(fresh.id!==receipt.recordId||fresh.projectId!==projectId||fresh.documentId!==documentId||fresh.paragraphId!==id||fresh.baselineHash!==receipt.baselineHash||fresh.requestId!==receipt.requestId||fresh.contextHash!==receipt.contextHash)throw Error('The returned revision belongs to another passage. Nothing was accepted.');
   if(fresh.status!=='result-ready'||fresh.finalizationVerified!==true||!fresh.artifact||fresh.artifact.hash!==receipt.artifactHash)throw Error(fresh.error||'The captured guidance, sources or revision result changed. Prepare a fresh revision before accepting.');
   const live=latest.current,waiting=live.paragraphs.find(value=>value.id===id)?.proposal;
   if(latestOptions.current.project.id!==projectId||live.id!==documentId||latestOptions.current.externalReplacementNonce!==replacementNonce||waiting?.id!==proposal.id||waiting.method!=='ai-revision'||waiting.passageRevision?.recordId!==receipt.recordId)throw Error('The waiting proposal changed while its request was being checked. Nothing was accepted.');
   const liveIssue=proposalAcceptanceIssue(live,id);if(liveIssue)throw Error(liveIssue);
   completeAcceptance(id);
  }catch(cause){setNotice((cause as Error).message);}finally{acceptanceLock.current=false;setAcceptBusy(null);}
 }
 async function buildRequest(id:string){
  if(!options.api){setNotice('Request preview is unavailable in this environment. No model has run.');return;}
  setPreviewBusy(id);
  try{
   await options.ensureSaved?.();
   const result=await options.api('/api/requests/preview',{method:'POST',body:{paragraphIds:[id],includeThoughts}});
   const current=latest.current;
   if(result.manifest.mode!=='dry-run'||result.manifest.modelExecuted!==false)throw new Error('The service did not confirm a request preview without model execution.');
   if(result.manifest.documentId!==current.id||result.manifest.manuscriptRevision!==current.revision)throw new Error('Save the current manuscript before building its request preview.');
   if(!current.paragraphs.find(p=>p.id===id)?.proposal)throw new Error('This alternative was closed before the request preview finished.');
   change({...current,paragraphs:current.paragraphs.map(p=>p.id===id?{...p,proposal:{...p.proposal!,requestManifest:structuredClone(result.manifest),assembledContext:result.assembledContext}}:p)});
   setNotice('Request preview recorded for inspection. No model ran and no guidance was applied to the manual alternative.');
  }catch(e){setNotice((e as Error).message);}finally{setPreviewBusy(null);}
 }
 function add(){const p=newParagraph();change(revise(doc,[...doc.paragraphs,p]));setFocused(p.id);options.onParagraphFocus?.(p.id);setTab('passage');setTimeout(()=>{const ed=editors.current.get(p.id);ed?.commands.setTextSelection(1);ed?.commands.focus(undefined,{scrollIntoView:false});},0);}
 function pull(card:Evidence,form:Attribution['form']){
  const current=latest.current;
  const target=activeId||current.paragraphs.at(-1)?.id;const ed=target&&editors.current.get(target);
  if(!current.paragraphs.length){
   const paragraph=newParagraph(),next=revise(current,[paragraph]);
   firstEvidence.current={target:paragraph.id,card,form};latest.current=next;change(next);
   setFocused(paragraph.id);options.onParagraphFocus?.(paragraph.id);setTab('passage');return;
  }
  if(!ed||ed.isDestroyed){setNotice('Place the caret in a passage before inserting evidence.');return;}
  insertEvidence(ed,target!,card,form);
 }
 function insertEvidence(ed:Editor,target:string,card:Evidence,form:Attribution['form']){
  const passage={passageId:card.id,sourceRef:card.sourceId,sourceTitle:card.sourceTitle,author:card.author||'',text:card.excerpt};
  const command=form==='quote'?blockQuoteForm(passage):form==='reference'?referenceCardForm(passage):form==='paraphrase'?paraphraseForm(passage):inlineQuoteForm(passage);
  ed.commands.command(command);
  target=(ed as any).currentParagraphId?.()||target;
  const inserted=latest.current.paragraphs.find(p=>p.id===target);
  const hasEvidence=(node:any):boolean=>node?.attrs?.passageId===card.id||!!node?.marks?.some((mark:any)=>mark.attrs?.passageId===card.id)||!!node?.content?.some(hasEvidence);
  if(!inserted||!hasEvidence(inserted.doc)){setNotice('The source excerpt was not inserted. Review a waiting proposal or place the caret in your own prose.');return;}
  // onUpdate has already saved the complete JSON. Add original excerpt and
  // locator to the same paragraph, so later paraphrasing never erases evidence.
  const current=latest.current;const attribution={...card,form},next={...current,paragraphs:current.paragraphs.map(p=>p.id===target?{...p,attributions:[...p.attributions.filter(a=>a.id!==card.id||a.form!==form),attribution]}:p)};latest.current=next;change(next);
  setBank(false);
  setNotice(form==='paraphrase'?'Attributed paraphrase inserted and visibly flagged. Rewrite it in your own words.':'Attributed evidence inserted at the caret.');
 }
 function openSelectionRewrite(id:string){
  const ed=editors.current.get(id),p=latest.current.paragraphs.find(p=>p.id===id);if(!ed||!p)return;
  if(p.proposal){setNotice('Review or discard the waiting replacement first.');return;}
  if((ed as any).selectionScope?.()==='manuscript'){setNotice('This selection spans passages. Native editing works across them; AI rewrite currently needs a selection within one paragraph.');return;}
  try{const {from,to}=ed.state.selection,range=captureSelection(ed.getJSON(),{from,to,text:ed.state.doc.textBetween(from,to,'\n')});setRewriteRecord(undefined);setRewriteSelection({id,from:range.from,to:range.to,text:range.text,baselineJSON:passageBaselineJSON(p)});setNotice('');}catch(cause){setNotice((cause as Error).message);}
 }
 function keep(mode:'verbatim'|'point'){
  if(!selected?.text)return;const parts=selected.parts?.length?selected.parts:[{id:selected.id,text:selected.text}],current=latest.current;
  const next={...current,paragraphs:current.paragraphs.map(p=>{const text=parts.find(part=>part.id===p.id)?.text;return text?{...p,kept:[...p.kept,{id:uid(),text,mode}]}:p;})};latest.current=next;change(next);setSelected(null);
 }

 const legacy=options.project.draft||'';
 function terminalDraft(text:string,context:TerminalDraftContext){
  if(articleMode){options.onShelfRequest?.('shared-review');return;}
  if(research||!active){if(latest.current.pendingResearchCandidate){setNotice('Review or drop the waiting research reply before selecting another.');setTab('draft');return;}stageResearch(createTerminalCandidate(text,context.origin,context.record));setTab('draft');return;}
  if(latest.current.paragraphs.find(p=>p.id===active.id)?.proposal){setTab('draft');setNotice('Review or drop the waiting proposal before selecting another reply.');return;}
  const next=createTerminalProposal(latest.current,active.id,text,context.origin,context.record);latest.current=next;change(next);setTab('draft');
 }
 function closeMenu(event:React.MouseEvent<HTMLButtonElement>){const menu=event.currentTarget.closest('details');if(menu)menu.open=false;}
 function controlMenuKeyDown(event:React.KeyboardEvent<HTMLDetailsElement>){if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector<HTMLElement>('summary')?.focus();}
 function controlMenuBlur(event:React.FocusEvent<HTMLDetailsElement>){if(!event.currentTarget.contains(event.relatedTarget as Node|null))event.currentTarget.open=false;}
 const waitingReplies=Number(!!active?.proposal)+Number(!!researchCandidate);
 const disclosureArrow=<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
 const articleActions=<details className="ar-control-menu ar-article-actions" onKeyDown={controlMenuKeyDown} onBlur={controlMenuBlur}><summary>Article actions{disclosureArrow}</summary><div className="ar-control-menu-items">
  {!!doc.paragraphs.length&&<><button onClick={event=>{closeMenu(event);options.onShelfRequest?.('work-article');}}>Work on this article</button><p>Propose changes in your selected local CLI.</p><button onClick={event=>{closeMenu(event);options.onShelfRequest?.('connect-ai-tools');}}>Connect AI tools</button><p>Give a local AI client access to this article and its review tools.</p></>}
  <button onClick={event=>{closeMenu(event);setMakeArticleOpen(true);}}>Draft article with AI</button><p>Create a whole article from your selected sources.</p>
  <button onClick={event=>{closeMenu(event);setGeneratedDraft(undefined);setWholeDraftOpen(true);}}>Bring in an existing draft</button><p>Review a complete draft before adding it.</p>
  <button onClick={event=>{closeMenu(event);add();}}>Add passage</button><p>Add a blank passage to your writing.</p>
 </div></details>;
 const passageTools=<details className="ar-control-menu ar-passage-tools" onKeyDown={controlMenuKeyDown} onBlur={controlMenuBlur}><summary>Passage tools{disclosureArrow}</summary><div className="ar-control-menu-items">
  <button disabled={!active||proposalBusy===activeId} onMouseDown={e=>e.preventDefault()} onClick={event=>{closeMenu(event);if(activeId)void propose(activeId);}}>{proposalBusy===activeId?'Opening…':'Try another version'}</button><p>Write another version for review.</p>
  <button onClick={event=>{closeMenu(event);setNotesOpen(!notesOpen);}} aria-pressed={notesOpen}>{notesOpen?'Hide passage details':'Show passage details'}</button><p>Kept wording, citations and revision history.</p>
  <button onClick={event=>{closeMenu(event);setBank(!bank);}} aria-expanded={bank} aria-controls={`${workspaceId}-sources`}>Insert a saved excerpt</button><p>Insert a quote or reference at the caret.</p>
 </div></details>;
 const passageControls=<div className="ar-workbench-row ar-passage-context" hidden={commandMode&&tab!=='passage'}>
  <div className="ar-passage-identity"><span className="ar-active-passage">{active?`Passage ${String(activeIndex).padStart(2,'0')} / ${doc.paragraphs.length}`:'Choose a passage'}</span>{!commandMode&&writingView==='focus'&&<div className="ar-passage-step" role="group" aria-label="Navigate focused passages"><button aria-label="Previous passage" disabled={activeIndex<=1} onMouseDown={e=>e.preventDefault()} onClick={()=>adjacentPassage(-1)}><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="m10 4-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button><button aria-label="Next passage" disabled={activeIndex>=doc.paragraphs.length} onMouseDown={e=>e.preventDefault()} onClick={()=>adjacentPassage(1)}><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>}<span className="ar-passage-metrics">{active?wordCount(plainText(active.doc)):0} words · {active?.kept.length||0} kept</span></div>
  <div className="ar-passage-primary" role="group" aria-label="Current passage actions"><button disabled={!active} className="ar-revise-action" onMouseDown={e=>e.preventDefault()} onClick={()=>setRevisionOpen(value=>!value)} aria-expanded={revisionOpen}>Revise with AI</button><button disabled={!active} className="ar-open-terminal" onMouseDown={e=>e.preventDefault()} onClick={()=>commandMode?setTab('terminal'):commandRoom()}>Open terminal</button>{!commandMode&&passageTools}</div>
 </div>;
 function selectTab(event:React.KeyboardEvent<HTMLButtonElement>){
  const tabs=articleMode?['terminal'] as const:research?['terminal','draft'] as const:['passage','terminal','draft'] as const,index=tabs.indexOf(tab as any);
  let next:number|undefined;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=tabs.length-1;
  if(next===undefined)return;event.preventDefault();setTab(tabs[next]);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
 }
 return <section className={commandMode?"ar-writing ar-command-room":"ar-writing ar-desk-writing"} aria-label="Writing workspace">
 {commandMode&&articleMode?<header className="ar-command-status"><strong>Whole article</strong><span className="ar-command-excerpt" title={doc.title}>{doc.title}</span><small>{manuscriptWords} words</small><button type="button" onClick={()=>{switchWritingView('continuous');options.onShelfRequest?.('article-return');}}>Return to writing</button></header>:commandMode?<header className="ar-command-status"><strong>{research?`Research · ${options.requestSelection!.sourceIds.length} ${options.requestSelection!.sourceIds.length===1?'source':'sources'}`:active?`Passage ${String(activeIndex).padStart(2,'0')}`:'Choose a passage'}</strong>{!research&&active&&<><span className="ar-command-excerpt" title={plainText(active.doc)}>{plainText(active.doc).trim()||'Blank passage'}</span><small>{wordCount(plainText(active.doc))} words</small></>}{!research&&passageTools}{articleActions}</header>
 :<header className="ar-writing-workbench">
  <div className="ar-workbench-row"><div className="ar-writing-view" role="group" aria-label="Writing view"><button aria-pressed={writingView==='continuous'} onMouseDown={e=>e.preventDefault()} onClick={()=>switchWritingView('continuous')}>Manuscript</button><button disabled={!active} aria-pressed={writingView==='focus'} onMouseDown={e=>e.preventDefault()} onClick={()=>switchWritingView('focus')}>Focused passage</button></div><span className="ar-writing-total">{doc.paragraphs.length} {doc.paragraphs.length===1?'passage':'passages'} · {manuscriptWords} words</span>{articleActions}</div>
  {!!doc.paragraphs.length&&passageControls}
 </header>}
 {revisionOpen&&active&&<PassageRevision visible={!commandMode||tab==='passage'} options={options} doc={doc} paragraphId={active.id} onClose={()=>setRevisionOpen(false)} onReview={reviewRevision}/>}
 {makeArticleOpen&&<MakeArticle options={options} doc={doc} onClose={()=>setMakeArticleOpen(false)} onReview={result=>{const candidate=candidateFromArticleResult(result,latest.current,latestOptions.current.project);setGeneratedDraft(candidate);setMakeArticleOpen(false);setWholeDraftOpen(true);}}/>}
 {wholeDraftOpen&&<WholeDraftImport document={doc} projectId={options.project.id} initialCandidate={generatedDraft} api={options.api} onAccept={options.onWholeDraftAccept} onClose={()=>setWholeDraftOpen(false)}/>}
 {commandMode&&!articleMode&&<nav className="ar-command-tabs" role="tablist" aria-label="Writing and terminal">{!research&&!articleMode&&<button id={`${workspaceId}-passage-tab`} role="tab" aria-controls={`${workspaceId}-writing-panel`} tabIndex={tab==='passage'?0:-1} aria-selected={tab==='passage'} onKeyDown={selectTab} onClick={()=>focusRef.current(activeId)}>Your writing</button>}<button id={`${workspaceId}-terminal-tab`} role="tab" aria-controls={`${workspaceId}-terminal-panel`} tabIndex={tab==='terminal'?0:-1} aria-selected={tab==='terminal'} onKeyDown={selectTab} onClick={()=>setTab('terminal')}>Terminal</button>{!articleMode&&<button id={`${workspaceId}-draft-tab`} role="tab" aria-controls={`${workspaceId}-writing-panel`} tabIndex={tab==='draft'?0:-1} aria-selected={tab==='draft'} onKeyDown={selectTab} onClick={()=>setTab('draft')}>Review reply{waitingReplies>0&&<span className="ar-reply-count"> · {waitingReplies} waiting</span>}</button>}<span>{tab==='terminal'?'Local session':'Revision '+doc.revision}</span></nav>}
 {commandMode&&!research&&!articleMode&&<div className="ar-command-passage-controls">{passageControls}</div>}
 <div id={`${workspaceId}-terminal-panel`} className="ar-terminal-pane" role={commandMode?(articleMode?'region':'tabpanel'):undefined} aria-label={articleMode?'Article terminal':undefined} aria-labelledby={commandMode&&!articleMode?`${workspaceId}-terminal-tab`:undefined} hidden={!commandMode||tab!=='terminal'}><TerminalWorkspace options={{...options,document:doc,selectedParagraphId:activeId}} visible={commandMode&&tab==='terminal'&&options.visible!==false} onDraft={terminalDraft}/></div>
 {!doc.paragraphs.length&&<div className="ar-blank-manuscript" hidden={commandMode&&tab!=='passage'}><h2>Start your writing</h2><p>{options.project.materialSelection?.sourceIds?.length?'Your selected sources are ready. Draft an article, or begin in your own words.':'Draft from source material, or begin in your own words.'}</p><div className="ar-workspace-actions"><button className="ar-start-draft" onClick={()=>setMakeArticleOpen(true)}>Draft article with AI</button><button onClick={add}>Write a passage</button></div>{legacy&&!doc.legacyImport&&<button onClick={()=>change(importLegacy(doc,legacy))}>Import existing draft · preserve original</button>}</div>}
 {(!commandMode||tab==='passage')&&legacy&&!doc.legacyImport&&doc.paragraphs.length>0&&<button className="ar-legacy" onClick={()=>change(importLegacy(doc,legacy))}>Import existing draft into this manuscript · original retained</button>}
 {bank&&<aside id={`${workspaceId}-sources`} ref={bankRef} className="ar-passage-bank" aria-label="Source passages"><header><h2>Source passages</h2><button onClick={()=>options.onShelfRequest?.('sources')}>Open sources</button></header>{options.evidence?.length?options.evidence.map(card=><article key={card.id} className={card.id===options.requestedEvidenceId?'ar-requested-card':undefined}><blockquote>{card.excerpt}</blockquote><p title={locatorDetails(card.locator)}><button onClick={()=>options.onShelfRequest?.('source:'+card.sourceId,{sourceId:card.sourceId,excerpt:card.excerpt,locator:card.locator,sourceHash:card.sourceHash})}>{card.sourceTitle} · {locatorLabel(card.locator)}</button></p><div className="ar-workspace-actions"><button onMouseDown={e=>e.preventDefault()} onClick={()=>pull(card,'quote')}>Block quote</button><button onMouseDown={e=>e.preventDefault()} onClick={()=>pull(card,'inline')}>Inline quote</button><button onMouseDown={e=>e.preventDefault()} onClick={()=>pull(card,'reference')}>Reference</button><button onMouseDown={e=>e.preventDefault()} onClick={()=>pull(card,'paraphrase')}>Paraphrase · flagged</button></div></article>):<p>Select words while reading a source and make an evidence card. Those passages will appear here.</p>}</aside>}
 <div id={`${workspaceId}-writing-panel`} role={commandMode?'tabpanel':undefined} aria-labelledby={commandMode?`${workspaceId}-${tab==='draft'?'draft':'passage'}-tab`:undefined} ref={manuscriptRef} className={`ar-manuscript ar-manuscript-${writingView}`} onScroll={e=>{if(restoringScroll.current||options.visible===false||commandMode&&tab==='terminal')return;location.scrolls[viewRef.current]=e.currentTarget.scrollTop;scheduleLocation();}} hidden={commandMode&&tab==='terminal'} onFocusCapture={e=>{const id=(e.target as HTMLElement).closest('[data-paragraph]')?.getAttribute('data-paragraph');if(id){setFocused(id);remember(id);location.activeId=id;options.onParagraphFocus?.(id);}}}>
 {doc.importedDraft?.makeReceipt&&<ArticleContextReceipt receipt={doc.importedDraft.makeReceipt} api={options.api}/>}
 {researchCandidate&&<section key={researchCandidate.id} className="ar-proposal" hidden={commandMode&&tab!=='draft'} aria-label="Proposed research passage"><header><h3>{inheritedResearch?'Grouped Study notes':researchCandidate.method==='manual'?'Your note, ready for writing':'Proposed passage from research'}</h3><span className="ar-kicker">Not in the manuscript</span></header><p className="ar-proposal-context">{inheritedResearch?'Retained research · review the wording and original sources; questions stay in the receipt':researchCandidate.method==='manual'?(pendingResearch!.sourceIds.length?`Your note beside ${pendingResearch!.sourceIds.length} ${pendingResearch!.sourceIds.length===1?'source':'sources'}`:'Your personal words'):`Waiting reply · ${pendingResearch!.sourceIds.length} ${pendingResearch!.sourceIds.length===1?'source':'sources'}`}{research&&JSON.stringify([[...pendingResearch!.sourceIds].sort(),[...pendingResearch!.cardIds].sort()])!==JSON.stringify([[...options.requestSelection!.sourceIds].sort(),[...(options.requestSelection!.cardIds||[])].sort()])&&' · From an earlier source selection. Review or drop it before choosing another reply.'}</p><InlineParagraph key={researchCandidate.id+':'+options.externalReplacementNonce} text={researchCandidate.text} doc={researchCandidate.doc} label="Research reply candidate" onChange={()=>{}} onDocumentChange={json=>{const current=pendingResearchCandidate(latest.current,options.project.id)?.proposal;if(current?.id===researchCandidate.id)stageResearch({...current,doc:json,text:structuredMarkdown(json)});}} onBlur={()=>safety.flush()} onSelect={()=>{}}/><p className="ar-proposal-context">{inheritedResearch?'No model run. These are retained research notes, not established facts or your personal beliefs. Questions are outside the prose.':researchCandidate.terminalOrigin?.cli==='shell'?'Local shell reply · no writing context sent.':researchCandidate.method==='manual'?'Adding it creates a passage. Your saved note stays with this document.':'Review this reply. Supplied context is recorded; citations require explicit attribution.'}</p>{inheritedResearch&&!!(researchCandidate.requestManifest?.studyInheritance as any)?.questions?.length&&<details className="ar-request-preview" open={!researchCandidate.text.trim()}><summary>Unresolved questions · {(researchCandidate.requestManifest?.studyInheritance as any).questions.length}</summary><p>These are questions to investigate, kept outside the proposed prose.</p><ul>{(researchCandidate.requestManifest?.studyInheritance as any).questions.map((question:any)=><li key={question.id}>{question.question}</li>)}</ul></details>}{researchCandidate.assembledContext&&<details className="ar-request-preview"><summary>Research context receipt</summary><div className="ar-request-context">{researchCandidate.assembledContext}</div></details>}<div className="ar-workspace-actions"><button disabled={!plainText(researchCandidate.doc).trim()} onClick={()=>{const candidate=pendingResearchCandidate(latest.current,options.project.id)?.proposal;if(candidate?.id!==researchCandidate.id)return;const next=acceptResearchCandidate(latest.current,options.project.id,candidate.id);if(next===latest.current)return;latest.current=next;change(next);const acceptedId=candidate.acceptedId||`accepted-${candidate.id}`;setFocused(acceptedId);options.onParagraphFocus?.(acceptedId);setTab('passage');setNotice(candidate.requestManifest?.purpose==='study-inheritance'?'Reviewed Study wording was added; source receipts and open questions are retained separately.':candidate.method==='manual'?'Your note was added as a passage. The saved note stays with this document.':'Research reply added as a real passage. Original material remains separate.');}}>Add as new passage</button><button onClick={()=>{const next=dropResearchCandidate(latest.current,options.project.id,researchCandidate.id);if(next!==latest.current){latest.current=next;change(next);}setTab(researchCandidate.method==='manual'?'passage':'terminal');}}>{researchCandidate.method==='manual'?'Dismiss from writing':'Drop reply'}</button>{researchCandidate.method!=='manual'&&<button onClick={()=>setTab('terminal')}>Keep exploring</button>}</div></section>}
 {commandMode&&tab==='draft'&&!researchCandidate&&!active&&<p className="ar-draft-empty">Select terminal reply text to review a passage. Nothing is added to the manuscript automatically.</p>}
 <ManuscriptEditor paragraphs={doc.paragraphs} activeId={activeId} focusOnly={commandMode||writingView==='focus'} hideText={commandMode&&tab!=='passage'} visible={options.visible!==false&&(!commandMode||tab!=='terminal')} externalReplacementNonce={options.externalReplacementNonce}
  onEditor={editorReady} onActivate={id=>focusRef.current(id)} onBlur={()=>{if(location.activeId)remember(location.activeId);safety.flush();}} onBlocked={setNotice}
  onFocus={id=>{setFocused(id);location.activeId=id;options.onParagraphFocus?.(id);scheduleLocation();}}
  onSelect={(id,text,parts)=>{remember(id);setSelected(text?{id,text,parts}:null);}}
  onChange={paragraphs=>{if(latestOptions.current.visible===false)return;const next=revise(latest.current,paragraphs);latest.current=next;change(next,'native');setRewriteUndo(null);safety.note({passageId:doc.id,paragraphId:activeId||paragraphs[0]?.id||doc.id,text:JSON.stringify(paragraphs.map(p=>({id:p.id,doc:p.doc})))});}}
  renderTools={(p,i)=><>
 {p.acceptedFrom&&<details className="ar-acceptance" hidden={!notesOpen}><summary>{p.acceptedFrom.method==='terminal'?'Terminal reply appended':p.acceptedFrom.method==='ai-revision'?'AI passage revision accepted':'Manual alternative accepted'} · {new Date(p.acceptedFrom.acceptedAt).toLocaleString()}</summary><p>{p.acceptedFrom.method==='terminal'?'Selected terminal output was added as a new passage. Its originating session and available context are recorded.':p.acceptedFrom.method==='ai-revision'?'Reviewed AI wording replaced this passage. Sources and Kept constraints were retained; its request and baseline are recorded.':'Guidance revisions were recorded for context. No model applied this guidance.'}</p>{p.acceptedFrom.terminalOrigin&&<p>{p.acceptedFrom.terminalOrigin.cli} · session {p.acceptedFrom.terminalOrigin.sessionId}</p>}<dl><dt>Proposal</dt><dd>{p.acceptedFrom.proposalId}</dd>{(['voice','positions','recipe'] as const).map(key=><React.Fragment key={key}><dt>{key==='positions'?'Positions':key==='voice'?'Voice':'Recipe'}</dt><dd>{p.acceptedFrom!.guidance[key].status==='unknown'?'Revision unknown':'Captured revision'}<span title={p.acceptedFrom!.guidance[key].revision}> · {p.acceptedFrom!.guidance[key].revision==='unknown'?'unknown':p.acceptedFrom!.guidance[key].revision.slice(0,10)}</span></dd></React.Fragment>)}<dt>{p.acceptedFrom.method==='terminal'?'Context sources':'Sources'}</dt><dd>{p.acceptedFrom.sources.length} {p.acceptedFrom.method==='terminal'?'source passages recorded as context; citations require explicit attribution':'attributed passages recorded'}</dd><dt>Kept</dt><dd>{p.acceptedFrom.keptConstraints.length} constraints recorded</dd></dl></details>}
 <div hidden={commandMode&&tab!=='passage'}>
 {selected?.id===p.id&&rewriteSelection?.id!==p.id&&!p.proposal?.passageRevision?.selection&&<div className="ar-selection-tools"><span>{selected.text.length>70?selected.text.slice(0,70)+'…':selected.text}</span><button onMouseDown={e=>e.preventDefault()} onClick={()=>openSelectionRewrite(p.id)}>Rewrite selection</button><button onMouseDown={e=>e.preventDefault()} onClick={()=>keep('verbatim')}>Keep wording</button><button onMouseDown={e=>e.preventDefault()} onClick={()=>keep('point')}>Keep meaning</button></div>}
 {!p.proposal&&!rewriteSelection&&savedRewrites.some(r=>r.paragraphId===p.id)&&<button className="ar-resume-rewrite" onClick={()=>void resumeRewrite(savedRewrites.find(r=>r.paragraphId===p.id).id)}>Resume rewrite</button>}
 {rewriteSelection?.id===p.id&&<SelectionRewrite key={rewriteSelection.id+':'+rewriteSelection.from+':'+rewriteSelection.to} options={options} doc={doc} selection={rewriteSelection} initialRecord={rewriteRecord} onClose={()=>{setRewriteSelection(null);const ed=editors.current.get(p.id);ed?.commands.focus(undefined,{scrollIntoView:false});}} onReview={reviewRevision}/>}
 {rewriteUndo===p.id&&<button className="ar-selection-undo" onMouseDown={e=>e.preventDefault()} onClick={()=>{const ed=editors.current.get(p.id);ed?.chain().focus(undefined,{scrollIntoView:false}).undo().run();setRewriteUndo(null);setNotice('Original selected words restored.');}}>Undo replacement</button>}
 {!!p.kept.length&&<div className="ar-kept" hidden={!notesOpen}><span className="ar-kicker">Kept</span>{p.kept.map(k=><div key={k.id}><button title="Switch between wording and meaning" onClick={()=>change({...doc,paragraphs:doc.paragraphs.map(v=>v.id===p.id?{...v,kept:v.kept.map(a=>a.id===k.id?{...a,mode:a.mode==='verbatim'?'point':'verbatim'}:a)}:v)})}>{k.mode==='verbatim'?'Wording':'Meaning'}</button><span>{k.text}</span><button aria-label="Remove kept line" onClick={()=>change({...doc,paragraphs:doc.paragraphs.map(v=>v.id===p.id?{...v,kept:v.kept.filter(a=>a.id!==k.id)}:v)})}>×</button></div>)}</div>}
 {!!p.attributions.length&&<div className="ar-attributions" hidden={!notesOpen}>{p.attributions.map((a,i)=><button key={a.id+i} onClick={()=>options.onShelfRequest?.('source:'+a.sourceId,{sourceId:a.sourceId,excerpt:a.excerpt,locator:a.locator,sourceHash:a.sourceHash||(typeof a.locator==='object'&&typeof a.locator.sourceHash==='string'?a.locator.sourceHash:undefined)})}>{a.form==='paraphrase'?'Flagged paraphrase':a.form==='reference'?'Reference':'Quoted'} · {a.sourceTitle}</button>)}</div>}
 </div>{commandMode&&tab==='draft'&&!p.proposal&&!researchCandidate&&<p className="ar-draft-empty">No reply waiting. Select terminal output or choose Try another version in Passage tools.</p>}
 {p.proposal?.passageRevision?.selection&&<section className="ar-selection-proposal" aria-label="Proposed selection replacement"><header><strong>Proposed replacement</strong></header><details><summary>Original selection</summary><p className="ar-selection-before">{p.proposal.passageRevision.selection.text}</p></details><p className="ar-selection-result">{p.proposal.passageRevision.replacement}</p>{proposalAcceptanceIssue(doc,p.id)&&<p role="alert">{proposalAcceptanceIssue(doc,p.id)}</p>}<div className="ar-workspace-actions"><button disabled={acceptBusy===p.id||!!proposalAcceptanceIssue(doc,p.id)} onMouseDown={e=>e.preventDefault()} onClick={()=>void acceptProposal(p.id)}>{acceptBusy===p.id?'Checking…':'Accept replacement'}</button><button onClick={()=>{const next=dropProposal(latest.current,p.id);latest.current=next;change(next);setNotice('Replacement discarded. Original words retained.');}}>Discard</button></div></section>}
 {p.proposal&&!p.proposal.passageRevision?.selection&&<section hidden={commandMode&&tab!=='draft'} className="ar-proposal" aria-label={p.proposal.method==='terminal'?'Proposed new passage':p.proposal.method==='ai-revision'?'AI passage revision':'Alternative wording'}><header><h3>{p.proposal.method==='terminal'?'Proposed new passage':p.proposal.method==='ai-revision'?'AI passage revision':'Alternative wording'}</h3><span className="ar-kicker">Accepted passage preserved</span></header>{(!p.proposal.method||p.proposal.method==='manual')&&<p className="ar-proposal-context">Edit this copy, then replace the passage or discard it.</p>}{p.proposal.method==='ai-revision'&&<details className="ar-request-preview"><summary>Compare accepted wording</summary><div className="apr-before">{plainText(p.doc)}</div></details>}<InlineParagraph key={p.proposal.id+':'+options.externalReplacementNonce} text={p.proposal.text} doc={p.proposal.doc} label={`Alternative for passage ${i+1}`} onEditor={ed=>{proposalEditors.current.set(p.id,ed);}} onChange={()=>{}} onDocumentChange={json=>paragraphChange(p.id,json,true)} onBlur={()=>safety.flush()} onSelect={()=>{}}/>{p.proposal.method==='ai-revision'?<details className="ar-request-preview"><summary>AI revision receipt</summary><p>{p.proposal.passageRevision?.instruction}</p><p>Request {p.proposal.passageRevision?.requestId} · baseline {p.proposal.passageRevision?.baselineHash.slice(0,10)} · {p.proposal.terminalOrigin?.cli||'Provider'} reply. Guidance and attached sources were supplied; acceptance records your review.</p>{p.proposal.assembledContext&&<div className="ar-request-context">{p.proposal.assembledContext}</div>}</details>:p.proposal.method==='terminal'?<>{p.proposal.terminalOrigin?.cli==='shell'?<p className="ar-proposal-context">Local shell reply · no writing context sent.</p>:p.proposal.terminalOrigin?.requestId?<details className="ar-request-preview"><summary>CLI context receipt</summary><p>Writing context was supplied to the CLI. Acceptance does not certify that the reply followed it.</p><p>Request {p.proposal.terminalOrigin.requestId}{p.proposal.terminalOrigin.contextHash&&<> · context <span title={p.proposal.terminalOrigin.contextHash}>{p.proposal.terminalOrigin.contextHash.slice(0,10)}</span></>}</p>{p.proposal.requestManifest&&<p>Saved manuscript revision {String(p.proposal.requestManifest.manuscriptRevision)} · personal thoughts {(p.proposal.requestManifest.thoughts as any)?.included?'included':'excluded'}</p>}{p.proposal.assembledContext&&<div className="ar-request-context">{p.proposal.assembledContext}</div>}</details>:<p className="ar-proposal-context">CLI reply · writing context receipt unavailable.</p>}</>:<><details className="ar-request-preview"><summary>Request preview · no model run</summary><label><input type="checkbox" checked={includeThoughts} onChange={e=>setIncludeThoughts(e.target.checked)}/> Include my contributions in request preview</label><button disabled={previewBusy===p.id} onClick={()=>buildRequest(p.id)}>{previewBusy===p.id?'Building preview…':'Build request preview'}</button>{p.proposal.requestManifest&&<details><summary>Recorded request preview · no model run</summary><p>Accepted manuscript revision {String(p.proposal.requestManifest.manuscriptRevision)} · this passage. Your contributions are {(p.proposal.requestManifest.thoughts as any)?.included?'included':'excluded'}.</p><p>Voice, Positions and Recipe revisions are recorded in the output archive. This preview excludes file metadata and pending guidance suggestions.</p>{p.proposal.assembledContext&&<div className="ar-request-context">{p.proposal.assembledContext}</div>}</details>}</details></>}<div className="ar-workspace-actions"><button disabled={acceptBusy===p.id} onClick={()=>void acceptProposal(p.id)}>{acceptBusy===p.id?'Checking revision…':p.proposal.method==='terminal'?'Add as new passage':p.proposal.method==='ai-revision'?'Replace with reviewed revision':'Replace passage'}</button><button onClick={()=>{const next=dropProposal(latest.current,p.id);latest.current=next;change(next);}}>{p.proposal.method==='terminal'?'Drop reply':p.proposal.method==='ai-revision'?'Drop revision':'Discard'}</button></div></section>}
</>}/>

 </div><p className="ar-workspace-notice" role="status">{notice}</p>
 </section>;
}
