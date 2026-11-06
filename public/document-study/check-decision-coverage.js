import {projectDecisionCoverage} from '../lib/decision-coverage.js';

// Saved-wording presentation; existing editor/decision owners stay authoritative.
const titles={'intent-unassessed':'Personal intent','guidance-unassessed':'Piece instruction','protected-paragraph-unassessed':'Protected wording','protected-literal-absent':'Protected wording absent','source-support-unassessed':'Source support','native-contracts-unavailable':'Protection & rejection history','context-incomplete':'Incomplete context','direction-unassessed':'Chosen direction','rejected-literal-present':'Rejected wording present','rejected-direction-literal-present':'Rejected direction wording','source-stale':'Source changed'};
const weight=code=>({'protected-literal-absent':0,'rejected-literal-present':0,'source-stale':0,'protected-paragraph-unassessed':1,'guidance-unassessed':2,'native-contracts-unavailable':3,'source-support-unassessed':5,'context-incomplete':6}[code]??4);
export function mountDecisionCoverage(host,{window:win=window,context}={}){
 const doc=host.ownerDocument;
 const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 let epoch=0,packet=null,report=null,seen=null;
 const signature=()=>JSON.stringify(context());
 const selected=()=>{const c=context();return c?.kind==='manuscript'&&c.selector&&c.proof?.bindingId&&c.proof.bindingId===c.bindingId&&c.proof.parentStudyId===c.selector.parentStudyId&&!c.proof.owner?c:null;};
 const request=async(route,body)=>{const r=await win.fetch(route,{method:body?'POST':'GET',cache:'no-store',headers:{'Content-Type':'application/json','X-AR-Actor':win.arCreateUiActor?.actor||'human:adrian','X-AR-Client':'ui'},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(value.error||'Saved context could not be read.');return value;};
 function button(label,fn){const b=el('button',label);b.type='button';b.addEventListener('click',fn);return b;}
 function shell(note){host.replaceChildren();const h=el('div',undefined,'sws-coverage-heading');h.append(el('h3','Decisions in this piece'),button('Reload decisions',load));host.append(h,el('p',note,'sws-coverage-status'));}
 function stillCurrent(stamp){return host.isConnected&&signature()===stamp;}
 async function guardedAction(f,action){
  const stamp=seen,c=selected();if(!c||!packet||!stillCurrent(stamp))return invalid();
  const notice=el('p','Confirming the saved revision…','sws-status');host.append(notice);
  try{
   const fresh=await request('/api/current-work/read',{selector:c.selector});
   if(!stillCurrent(stamp)||fresh.fingerprint!==packet.fingerprint)throw Error('The saved words or decisions changed. Reload decisions before following this finding.');
   if(action==='source'){
    const source=f.navigation.source;
    if(typeof win.studyStageOpenSource!=='function')throw Error('The source reader is unavailable.');
    await win.studyStageOpenSource({parentStudyId:c.selector.parentStudyId,sourceId:source.sourceId});return;
   }
   const record=f.evidence?.record,id=f.navigation?.recordedParagraph?.paragraphId;
   const native=await request('/api/study-ai/read?'+new URLSearchParams({parentStudyId:c.selector.parentStudyId,bindingId:c.bindingId}));
   const matches=native.projection?.filter(row=>row.id===id)||[];
   if(!stillCurrent(stamp)||native.expected?.workflow?.draft!==packet.piece.words.hash||matches.length!==1||matches[0].blockHash!==record.selectionBlockHash||!matches[0].words?.includes(record.text))throw Error('The recorded paragraph changed or cannot be resolved exactly. Read the saved words and review the decision; no passage was guessed.');
   if(!await win.studyDraft?.focusPassage?.(id,{edit:false,highlight:true}))throw Error('This exact passage is unavailable. Reload decisions and read the saved words.');
  }catch(error){notice.textContent=error.message;}
 }
 function invalid(){++epoch;seen=signature();packet=null;report=null;shell('The selected words changed. Reload decisions for this saved revision.');}
 function render(){
  shell(report.status==='partial'?'Literal comparison complete. Meaning and intent remain unassessed.':report.status==='stale'?'Saved context changed. Reload decisions before reviewing.':'Decision coverage is unavailable for these saved words.');
  host.append(el('p','Saved Article · current saved words','sws-coverage-version'));
  for(const f of [...report.findings].sort((a,b)=>weight(a.code)-weight(b.code))){
   const row=el('article',undefined,'sws-coverage-finding'),heading=el('div',undefined,'sws-coverage-row');row.dataset.findingId=f.id;
   heading.append(el('h4',titles[f.code]||'Needs review'),el('span',f.assessment==='mechanical'?'Literal finding':'Unassessed','sws-coverage-state'));row.append(heading);
   const record=f.evidence?.record;
   const recordedWords=f.evidence?.replacement?.words||record?.body||record?.text||record?.value;
   if(recordedWords)row.append(el('blockquote',recordedWords));
   if(record?.reason)row.append(el('p',`Recorded reason: ${record.reason}`));
   if(record?.decisionRole==='stand-in')row.append(el('small','Synthetic test decision','sws-coverage-note'));
   row.append(el('p',f.code==='source-support-unassessed'?`${record?.selectedSourceCount??0} selected source passages in this snapshot. Claim support and meaning remain unassessed.`:f.message));
   const actions=el('div',undefined,'sws-coverage-actions');
   if(f.navigation?.recordedParagraph?.paragraphId&&record?.selectionBlockHash&&record?.text&&f.navigation?.passages?.length&&typeof win.studyDraft?.focusPassage==='function')actions.append(button('Review passage',()=>guardedAction(f,'passage')));
   if(f.navigation?.source?.sourceId&&typeof win.studyStageOpenSource==='function'){actions.append(button('Open source',()=>guardedAction(f,'source')));row.append(el('small','Opens the source record; an exact passage jump is unavailable.','sws-coverage-note'));}
   else if(f.navigation?.passages?.length||f.navigation?.recordedParagraph)row.append(el('small',actions.childNodes.length?'The recorded paragraph is verified again before opening.':'An exact passage route is unavailable. Compare the recorded words in Read.','sws-coverage-note'));
   if(actions.childNodes.length)row.append(actions);
   host.append(row);
  }
  host.append(el('p','Saved wording only. Literal comparisons do not assess meaning, factual support, voice or consent. This is not wording or publication approval.','sws-coverage-boundary'));
 }
 async function load(){
  const token=++epoch,c=selected(),stamp=signature();packet=null;report=null;seen=stamp;
  if(!c){shell('Exact saved Article decision coverage is unavailable for this owner. Choose its saved Article; existing mechanical tools and wording remain available.');return;}
  shell(c.proof.dirty?'Reading saved decisions. Unsaved writing is excluded.':'Reading saved words and decisions…');
  try{const value=await request('/api/current-work/read',{selector:c.selector});if(token!==epoch||!stillCurrent(stamp))return;
   if(value.piece?.wordOwner?.kind!=='native'||value.piece.wordOwner.bindingId!==c.bindingId||value.piece.words?.hash!==c.proof.expected?.workflow?.draft)throw Error('The saved wording owner changed. Reload its current words before checking decisions.');
   packet=value;report=projectDecisionCoverage(value,{selector:c.selector,expectedFingerprint:value.fingerprint});render();
   if(c.proof.dirty)host.prepend(el('p','Unsaved writing is excluded. These findings concern saved words only.','sws-status'));
  }catch(error){if(token===epoch&&stillCurrent(stamp))shell(error.message);}
 }
 load();return {refresh:load,update(){if(signature()!==seen)invalid();},dispose(){++epoch;}};
}
