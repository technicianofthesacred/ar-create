/* The kept conversation reader is a projection; source sessions remain server-owned. */
import {renderConversationNotes, resolveNoteAnchors, renderSourceGroups} from './source-dialogue.js';
import {detectInterpretation,pairingInfo,isSourceBoundary} from './interpretation-view.js';
import {translationReadiness,prepareTranslationBatch} from './translation-readiness.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE = 'ar-create:source-reader:v1';
// Chromium inserts DIV/BR nodes for plain-text line breaks; innerText doubles blank lines here.
function editableWords(node){let text='';for(const child of node.childNodes){if(child.nodeType===3)text+=child.nodeValue;else if(child.nodeType===1){if(child.tagName==='BR')text+='\n';else{const block=['DIV','P'].includes(child.tagName);if(block&&text&&!text.endsWith('\n'))text+='\n';text+=editableWords(child);if(block&&child.nextSibling?.nodeType===3&&!text.endsWith('\n'))text+='\n';}}}return text;}

const button = (action, text, disabled=false) => `<button type="button" data-source-reader-action="${action}"${disabled?' disabled':''}>${text}</button>`;
const namespaced = html => html.replace(/data-note-/g, 'data-source-reader-note-').replace(/data-source-session=/g, 'data-source-reader-session=').replace(/data-source-turn=/g, 'data-source-reader-turn=');
export function teaLibraryURL(session){if(!session||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(session.sourceId||'')||!/^[a-f0-9]{64}$/i.test(session.sourceHash||''))return null;const url=new URL('https://www.teajia.com/admin/compass');url.search=new URLSearchParams({tab:'library',arSource:session.sourceId}).toString();return url.href;}
export function installSourceReader({document:doc, window:win=doc.defaultView, getProject, fetch:request=win.fetch.bind(win), storage=win.localStorage, makeId=()=>win.crypto.randomUUID(), observe=true}={}) {
  let stored;
  try { stored=JSON.parse(storage.getItem(STORAGE)||'{}'); } catch { stored={}; }
  const projects=stored.projects && typeof stored.projects==='object'?stored.projects:{};
  const drafts=stored.drafts && typeof stored.drafts==='object'?stored.drafts:{};
  const contextualCopy=new Map();
  const translationBatches=new Map();
  const translationReviews=new Map();
  let contextView=null, showOriginal=false,showTiming=false,navigationEpoch=0,savedReviewEpoch=0;
  let data={revision:null,sessions:[],notes:{}}, loaded=false, loading=false, loadError='', notConnected=false, disposed=false, panel=null, stamp='', refreshQueued=false,refreshJob=null;
  const active = () => { const p=contextView?.project||getProject(); return p?.view==='record' && Number(p.viewedStage)===2 ? p:null; };
  const room = p => projects[p.id] ||= {sessionId:'',turnId:'',navigation:null,pending:null,message:''};
  const draftKey = (p,s,t) => JSON.stringify([p.id,s.id,t.id]);
  const selected = p => data.sessions.find(s=>s.id===room(p).sessionId);
  const saveLocal = () => {try {storage.setItem(STORAGE,JSON.stringify({projects,drafts}));} catch {if(panel){const n=panel.querySelector('[data-source-reader-status]');if(n)n.textContent='Browser storage is unavailable. Keep this page open to retain unsaved wording.';}}};
  function stale(d,s) {return d && (d.conflict || d.baseRevision!==data.revision || d.baseSourceHash!==s.sourceHash);}
  function editor(p,s,t) {
    const d=drafts[draftKey(p,s,t)]; if(!d)return '';
    const old=stale(d,s), pending=!!room(p).pending;
    return `<form data-source-reader-edit="${esc(t.id)}"><details class="source-reader-speaker-edit"><summary>Speaker</summary><label>Speaker<input data-source-reader-field="speaker" value="${esc(d.speaker)}"${pending?' disabled':''}></label></details>${old?`<p class="source-reader-conflict" role="alert">This conversation changed. Your unsaved wording remains in the remark; saving is blocked until you resolve it.</p><details><summary>Compare saved and unsaved wording</summary><p>Saved now: ${esc(t.speaker)} — ${esc(t.text)}</p><p>Your edit: ${esc(d.speaker)} — ${esc(d.text)}</p><p>Started at revision ${esc(d.baseRevision)} / ${esc(d.baseSourceHash)}. Current revision ${esc(data.revision)} / ${esc(s.sourceHash)}.</p></details>`:''}<div class="source-reader-actions">${button('save','Save correction',pending||old||!d.text.trim())}${button('cancel',old?'Discard my unsaved edit':'Cancel',pending)}</div><p class="small">${old?'Discard only when you have kept any wording you still need.':'Unsaved wording stays on this device until saved or cancelled.'}</p></form>`;
  }
  function inlineNode(node,p,s,t) {
    const d=drafts[draftKey(p,s,t)];if(!d)return;
    if(node.textContent!==d.text)node.textContent=d.text;node.dataset.sourceReaderField='text';
  }
  const reviewKey=(p,s)=>JSON.stringify([p.id,s.id]);
  const sessionDirty=(p,s)=>Object.keys(drafts).some(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}});
  // Read-only generation can use an exact saved duplicate without deleting its recovery.
  const generationDirty=(p,s)=>Object.entries(drafts).some(([k,d])=>{try{const ids=JSON.parse(k);if(ids[0]!==p.id||ids[1]!==s.id)return false;const turn=s.turns.find(t=>t.id===ids[2]);return !turn||d.speaker!==(turn.speaker||'')||d.text!==turn.text;}catch{return false;}});
  function reviewCurrent(review,s){const c=review?.result?.sourceContext;return c&&c.sessionId===s.id&&c.sourceId===s.sourceId&&c.expectedRevision===data.revision&&c.expectedSourceHash===s.sourceHash;}
  function reviewHTML(p,s){
    const review=translationReviews.get(reviewKey(p,s));if(!review)return '';
    if(review.state==='earlier-review'){if(review.result.sourceContext.sessionId===s.id&&review.result.sourceContext.sourceId===s.sourceId)return earlierReviewHTML(review,s);review.state='stale';review.message='These earlier proposals belong to a different source and cannot be reviewed here.';}
    if(review.state==='proposal-ready'&&!reviewCurrent(review,s)){review.state='stale';review.message='The saved source changed. These proposals cannot be accepted; prepare the current conversation again.';}
    const message=review.message||review.result?.message||'';
    if(review.state!=='proposal-ready')return `<p class="small" role="status" data-source-translation-state="${esc(review.state)}"${review.gate?` data-source-translation-gate="${esc(review.gate)}"`:""}>${esc(message)}</p>`;
    const proposals=review.result.proposals,selected=proposals.find(t=>t.turnId===review.selectedTurnId)||proposals[0],turn=s.turns.find(t=>t.id===selected?.turnId);
    if(!selected||!turn)return '<p class="small" role="status">No current English proposal is available.</p>';
    review.selectedTurnId=selected.turnId;
    return `<details class="source-reader-details" open><summary>English proposals · ${proposals.length} · not saved</summary><p class="small" role="status" data-source-translation-state="proposal-ready">Review one remark at a time. Accepting saves only the selected remark through the existing correction history.${review.result.reviewNote?' '+esc(review.result.reviewNote):''}</p><label>Remark <select data-source-translation-select>${proposals.map((t,i)=>`<option value="${esc(t.turnId)}"${t.turnId===selected.turnId?' selected':''}>${i+1} of ${proposals.length} · ${esc(s.turns.find(x=>x.id===t.turnId)?.speaker||'Supplied speaker')}</option>`).join('')}</select></label><p class="small">Current saved wording</p><p data-source-translation-current>${esc(turn.text)}</p><p class="small">Proposed English · not saved</p><p data-source-translation-proposal>${esc(selected.text)}</p>${selected.uncertainty?`<p class="small">Uncertainty: ${esc(selected.uncertainty)}</p>`:''}<div class="source-reader-actions">${button('accept-translation','Save English for this remark',!correctionsAllowed()||!!room(p).pending||sessionDirty(p,s))}</div><p class="small">Saving requires the existing correction permission and no unfinished local corrections.</p></details>`;
  }
  function earlierReviewHTML(review,s){
    const proposals=review.result.proposals,proposal=proposals.find(t=>t.turnId===review.selectedTurnId)||proposals[0];if(!proposal)return '';
    review.selectedTurnId=proposal.turnId;const turn=s.turns.find(t=>t.id===proposal.turnId);
    return `<details class="source-reader-details" open><summary>Earlier English proposals · ${proposals.length} · read only</summary><p class="small" role="status" data-source-translation-state="earlier-review">The conversation wording has changed. These earlier proposals remain available for comparison and cannot be saved.${review.result.reviewNote?' '+esc(review.result.reviewNote):''}</p><label>Remark <select data-source-translation-select>${proposals.map((t,i)=>`<option value="${esc(t.turnId)}"${t.turnId===proposal.turnId?' selected':''}>${i+1} of ${proposals.length} · ${esc(s.turns.find(x=>x.id===t.turnId)?.speaker||'Earlier remark')}</option>`).join('')}</select></label><p class="small">Wording when prepared</p><p data-source-translation-preparation>${esc(proposal.currentAtPreparation)}</p><p class="small">Current saved wording</p><p data-source-translation-current>${esc(turn?turn.text:'This remark is no longer in the current conversation.')}</p><p class="small">Earlier proposed English · read only</p><p data-source-translation-proposal>${esc(proposal.text)}</p>${proposal.uncertainty?`<p class="small">Uncertainty: ${esc(proposal.uncertainty)}</p>`:''}</details>`;
  }
  function paintReview(controlsOnly=false){const p=active(),s=p&&selected(p);if(!p||!s||!panel?.isConnected)return;const target=panel.querySelector('[data-source-translation-review]');if(target&&!controlsOnly)target.innerHTML=reviewHTML(p,s);const refreshButton=panel.querySelector('[data-source-reader-action="refresh"]');if(refreshButton){refreshButton.disabled=loading||!!room(p).pending;refreshButton.textContent=loading?'Loading…':notConnected?'Check connection':'Refresh';}const review=translationReviews.get(reviewKey(p,s)),ready=review?.state==='earlier-review'||review?.state==='proposal-ready'&&reviewCurrent(review,s);let shortcut=panel.querySelector('[data-source-reader-action="review-translation"]');if(ready&&!shortcut){shortcut=doc.createElement('button');shortcut.type='button';shortcut.dataset.sourceReaderAction='review-translation';panel.querySelector('.source-reader-toolbar')?.append(shortcut);}if(shortcut){if(ready)shortcut.textContent='Review English · '+review.result.proposals.length;else shortcut.remove();}const accept=panel.querySelector('[data-source-reader-action="accept-translation"]');if(accept)accept.disabled=!correctionsAllowed()||!!room(p).pending||sessionDirty(p,s)||!reviewCurrent(translationReviews.get(reviewKey(p,s)),s);const b=panel.querySelector('[data-source-reader-action="translate"]');if(b)b.disabled=loading||!!room(p).pending||generationDirty(p,s)||translationReviews.get(reviewKey(p,s))?.state==='busy';}
  function validProposals(result,s,input,batch){
    const c=result?.sourceContext,ids=new Set(batch.gapIds);
    return result?.applied===false&&c&&c.sessionId===input.sessionId&&c.sourceId===s.sourceId&&c.expectedRevision===input.expectedRevision&&c.expectedSourceHash===input.expectedSourceHash&&Array.isArray(result.proposals)&&result.proposals.length===ids.size&&result.proposals.every(t=>t&&ids.delete(t.turnId)&&typeof t.text==='string'&&t.text.trim());
  }
  function validEarlierReview(result,s,input){
    const original=result?.sourceContext,current=result?.currentSourceContext,ids=new Set();
    if(result?.applied!==false||result?.savedReview!==true||!original||original.sessionId!==s.id||original.sourceId!==s.sourceId||!Number.isInteger(original.expectedRevision)||original.expectedRevision<0||!/^[a-f0-9]{64}$/i.test(original.expectedSourceHash||'')||!current||current.sessionId!==input.sessionId||current.sourceId!==s.sourceId||current.expectedRevision!==input.expectedRevision||current.expectedSourceHash!==input.expectedSourceHash||!Array.isArray(result.proposals)||!result.proposals.length||result.proposals.length>10000)return false;
    return result.proposals.every(t=>t&&typeof t.turnId==='string'&&t.turnId.trim()&&t.turnId.length<=1000&&!ids.has(t.turnId)&&ids.add(t.turnId)&&typeof t.text==='string'&&t.text.trim()&&t.text.length<=2000000&&typeof t.currentAtPreparation==='string'&&t.currentAtPreparation.length<=2000000&&(t.uncertainty===undefined||typeof t.uncertainty==='string'));
  }
  async function pickupSavedReview(){
    const p=active(),s=p&&selected(p);if(!p||!s||!loaded||loading||loadError||disposed||!Number.isInteger(data.revision))return;
    const key=reviewKey(p,s),prior=translationReviews.get(key);
    if(prior?.state==='busy'||prior?.state==='proposal-ready'&&reviewCurrent(prior,s)||prior?.state==='earlier-review'&&reviewCurrent({result:{sourceContext:prior.result.currentSourceContext}},s))return;
    const epoch=++savedReviewEpoch,nav=navigationEpoch,input={sessionId:s.id,expectedRevision:data.revision,expectedSourceHash:s.sourceHash};
    let batch;try{batch=prepareTranslationBatch(s,data.revision);}catch{return;}
    const current=()=>!disposed&&epoch===savedReviewEpoch&&nav===navigationEpoch&&active()===p&&selected(p)?.id===s.id&&selected(p)?.sourceId===s.sourceId&&data.revision===input.expectedRevision&&selected(p)?.sourceHash===input.expectedSourceHash&&translationReviews.get(key)===prior;
    try{
      const query=new URLSearchParams(input),response=await request('/api/source-sessions/translation-review?'+query,{headers:{Accept:'application/json'},cache:'no-store'});
      if(!current()||response.status===404)return;
      if(response.status===409){translationReviews.set(key,{state:'stale',message:'Saved English proposals do not match this conversation’s current wording.'});paintReview();return;}
      const result=await response.json();if(!current())return;
      if(result?.state==='stale'&&result.applied===false&&(response.ok||response.status===409)){
        translationReviews.set(key,{state:'stale',message:'The conversation changed since these English proposals were prepared. Refresh before reviewing them.'});paintReview();return;
      }
      if(response.ok&&result?.state==='earlier-review'&&validEarlierReview(result,s,input)){translationReviews.set(key,{state:'earlier-review',result,selectedTurnId:prior?.selectedTurnId||result.proposals[0].turnId});paintReview();return;}
      if(!response.ok||result?.state!=='proposal-ready'||result.savedReview!==true||!validProposals(result,s,input,batch)||!result.proposals.length)return;
      translationReviews.set(key,{state:'proposal-ready',result,selectedTurnId:result.proposals[0].turnId});paintReview();
    }catch{/* A missing saved review never interrupts reading or local recovery. */}
  }
  async function generateTranslation(p){
    const s=selected(p);if(!s||loading||room(p).pending||generationDirty(p,s))return;
    const key=reviewKey(p,s);if(translationReviews.get(key)?.state==='busy')return;
    const input={sessionId:s.id,expectedRevision:data.revision,expectedSourceHash:s.sourceHash};let batch;try{batch=prepareTranslationBatch(s,data.revision);}catch{translationReviews.set(key,{state:'error',message:'The source turn identities are incomplete. Refresh before preparing English proposals.'});paintReview();return;}
    const review={state:'busy',message:'Preparing English proposals for this conversation. Saved wording is unchanged.'};translationReviews.set(key,review);paintReview();
    try{const response=await request('/api/source-sessions/translation-proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();
      if(!response.ok){if(response.status!==409&&result?.state==='unavailable'&&result.applied===false&&Array.isArray(result.proposals)&&result.proposals.length===0&&typeof result.gate==='string'&&result.gate.trim()&&typeof result.message==='string'&&result.message.trim()){review.state='unavailable';review.message=result.message;review.gate=result.gate;return;}review.state=response.status===409?'stale':'error';review.message=result?.error||'English proposals could not be prepared. Saved wording is unchanged.';return;}
      if(!result||!['proposal-ready','ready','unavailable','stale','error'].includes(result.state))throw Error('The translation response is incomplete.');
      if(result.state==='proposal-ready'&&!validProposals(result,s,input,batch))throw Error('The translation result does not match this exact conversation.');
      review.state=result.state;review.result=result;review.message=result.message||'';
    }catch(error){review.state='error';review.message=error.message||'English proposals could not be prepared. No source wording was changed.';}
    finally{paintReview();}
  }
  function acceptTranslation(p){
    const s=selected(p),r=room(p),review=s&&translationReviews.get(reviewKey(p,s));if(!s||!correctionsAllowed()||r.pending||sessionDirty(p,s)||review?.state!=='proposal-ready'||!reviewCurrent(review,s))return;
    const proposal=review.result.proposals.find(t=>t.turnId===review.selectedTurnId),turn=s.turns.find(t=>t.id===proposal?.turnId);if(!proposal||!turn)return;
    const c=review.result.sourceContext,body={operationId:makeId(),expectedRevision:c.expectedRevision,expectedSourceHash:c.expectedSourceHash,sessionId:s.id,turnId:turn.id,speaker:turn.speaker||'',text:proposal.text};
    r.pending={kind:'edit',body,uncertain:false,translation:true};saveLocal();return send(p);
  }
  function html(p) {
    const r=room(p),s=selected(p),nav=r.navigation, pending=r.pending;
    const teaHref=loaded&&!loading&&!loadError&&!pending&&s&&!Object.keys(drafts).some(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}})?teaLibraryURL(s):null;
    const teaAction=teaHref?`<a class="source-reader-tea-link" data-source-tea-link href="${esc(teaHref)}" target="_blank" rel="noopener noreferrer" title="Review this transcript and choose existing teas in Teajia. Opening saves nothing.">Link to tea library</a>`:'';
    const selector=data.sessions.length?`<label class="source-reader-selector">Kept conversations · shared Library<select data-source-reader-select${pending?' disabled':''}><option value=""${!s?' selected':''}>Choose a kept conversation</option>${data.sessions.map(x=>`<option value="${esc(x.id)}"${x.id===s?.id?' selected':''}>${esc(x.title||'Untitled conversation')}${x.date?' · '+esc(x.date):''}</option>`).join('')}</select></label>`:'';
    let body='';
    if(s) {
      const notes=namespaced(renderConversationNotes(s,data.notes));
      const hasDraft=Object.keys(drafts).some(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}});
      const readiness=translationReadiness(s,{loading,error:loadError,stale:hasDraft||!!pending});
      if(readiness.state==='unavailable'&&readiness.count)readiness.message=`${readiness.count} Chinese remark${readiness.count===1?' needs':'s need'} English. Prepare conversation proposals to check availability; saved wording stays unchanged.`;
      if(hasDraft||pending)readiness.message='Save or cancel local corrections before preparing conversation translation.';
      translationBatches.delete(s.id);
      if(!loading&&!loadError&&!hasDraft&&!pending)try{translationBatches.set(s.id,prepareTranslationBatch(s,data.revision));}catch{readiness.state='error';readiness.message='Conversation turn identities are incomplete. Refresh before preparing translation.';}
      const validNav=nav && nav.sourceHash===s.sourceHash && nav.ids.every(id=>s.turns.some(t=>t.id===id));
      body=`<article><header class="source-reader-title"><h3>${esc(s.title||'Untitled conversation')}</h3>${s.location?`<span class="small">${esc(s.location)}</span>`:''}<span class="source-reader-attribution small" title="Supplied source labels do not establish speaker identities. Review individual remarks before attribution.">Speaker labels unverified</span></header><p class="source-reader-translation-readiness small" data-source-translation-readiness="${readiness.state}" role="status">${esc(readiness.message)}</p><div data-source-translation-review>${reviewHTML(p,s)}</div><div data-source-reader-notes tabindex="-1">${notes||'<p class="small">No reviewed notes are connected to this conversation.</p>'}</div>${validNav?`<nav class="source-reader-actions" aria-label="Supporting passages">${button('previous','Previous',nav.index===0)}<span>${nav.index+1} of ${nav.ids.length}</span>${button('next','Next',nav.index>=nav.ids.length-1)}${button('notes','Back to notes')}</nav>`:nav?'<p class="source-reader-conflict">The supporting passage belongs to earlier wording. Review the notes before following it.</p>':''}<div data-source-reader-dialogue>${namespaced(renderSourceGroups(s))}</div>${s.undoOperationId?`<div class="source-reader-actions">${button('undo','Undo last correction',!!pending||Object.keys(drafts).some(k=>{try {const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}}))}</div>`:''}<details class="source-reader-details"><summary>Source & versions</summary>${button('timing',showTiming?'Hide timestamps':'Show timestamps')}${button('speaker','Correct speaker')}<p>Version ${esc(s.version??'unspecified')}. Original source and earlier wording are preserved.</p><p>Source: ${esc(s.sourceId)}<br>Revision: ${esc(data.revision)}<br>Source fingerprint: ${esc(s.sourceHash)}</p></details></article>`;
    }
    return `<div class="source-reader-toolbar">${selector}${button('refresh',loading?'Loading…':notConnected?'Check connection':'Refresh',loading||!!pending)}${teaAction}${s?button('translate','Prepare English proposals',loading||!!pending||generationDirty(p,s)||translationReviews.get(reviewKey(p,s))?.state==='busy'):''}</div><p data-source-reader-status role="status">${esc(loadError||r.message||(!loaded?'Loading kept conversations…':!data.sessions.length?'No kept conversations are connected yet. Existing source records remain available below.':!s?'Choose a conversation from the shared Library. No conversation has been linked to this project here.':''))}</p>${pending?`<p class="source-reader-conflict">${pending.uncertain?'The response was interrupted. Retry the same request to find out whether it was saved.':'Saving correction…'}</p>${pending.uncertain?button('retry','Retry same request'):''}`:''}${body}`;
  }
  function paint() {
    const p=active(); if(!p||!panel?.isConnected||panel.dataset.sourceReaderProject!==p.id)return;
    const r=room(p); if(loaded&&r.sessionId&&!data.sessions.some(s=>s.id===r.sessionId))r.message='The selected conversation is unavailable. Your local wording is preserved; choose a shared Library conversation explicitly.';
    if(!r.turnId){const s=selected(p);const key=s&&Object.keys(drafts).find(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}});if(key)r.turnId=JSON.parse(key)[2];}
    const scroll=panel.querySelector('[data-source-reader-dialogue]')?.scrollTop||0;
    panel.innerHTML=html(p);paintReview(true);panel.classList.toggle('source-reader-show-timing',showTiming);
    const s=selected(p),interpretation=!!s&&detectInterpretation(s),originalShown=showOriginal??interpretation;panel.classList.toggle('source-reader-paired',interpretation&&originalShown);
    let changed=0;
    if(s) for(const node of panel.querySelectorAll('[data-source-reader-turn]')) {
      const t=s.turns.find(x=>x.id===node.dataset.sourceReaderTurn); if(!t)continue;const local=drafts[draftKey(p,s,t)];node.textContent=local?local.text:t.text;if(local)node.dataset.sourceReaderUnsaved='true';
      node.tabIndex=0;node.setAttribute('role','textbox');node.setAttribute('aria-multiline','true');node.setAttribute('aria-label','Conversation remark');node.setAttribute('contenteditable',correctionsAllowed()&&!r.pending?'plaintext-only':'false');node.setAttribute('aria-readonly',String(!correctionsAllowed()||!!r.pending));
      if(!isSourceBoundary(t) && t.originalText!==undefined && t.originalText!==t.text){const original=doc.createElement('p'),pair=pairingInfo(t);original.className='source-reader-original';original.hidden=!originalShown;original.dataset.sourceReaderOriginalFor=t.id;original.innerHTML=`<span class="source-reader-original-l">Original ${pair.sourceLanguage==='zh'?'Chinese':pair.sourceLanguage==='en'?'English':'wording'}</span> ${esc(pair.originalText)}`;if(interpretation){const wrapper=doc.createElement('span');wrapper.className='source-reader-pair';wrapper.dataset.sourceReaderPair=t.id;wrapper.dataset.sourceReaderPairKind=pair.sourceLanguage==='en'?'edited':'translated';wrapper.title=pair.sourceLanguage==='en'?'Original English and saved edited wording for the same turn':'Original speech and current translated wording for the same turn';node.before(wrapper);wrapper.append(original,node);}else node.after(original);changed++;}
      if(r.turnId===t.id&&local){inlineNode(node,p,s,t);const host=doc.createElement('div');host.className='source-reader-inline-tools';host.innerHTML=editor(p,s,t);panel.append(host);}
      if(r.navigation?.sourceHash===s.sourceHash && r.navigation.ids[r.navigation.index]===t.id)node.setAttribute('data-source-reader-highlight','true');
    }
    const dialogue=panel.querySelector('[data-source-reader-dialogue]');if(dialogue)dialogue.scrollTop=scroll;
    if(changed&&dialogue){const toggle=doc.createElement('button');toggle.type='button';toggle.className='source-reader-original-toggle';toggle.dataset.sourceOriginalToggle='';toggle.setAttribute('aria-pressed',String(originalShown));toggle.textContent=interpretation?(originalShown?'Read English wording':'Show originals'):(originalShown?'Hide':'Show')+` original wording · ${changed} corrected line${changed===1?'':'s'}`;toggle.title='The current wording includes saved corrections. Viewing never changes the source.';const toolbar=panel.querySelector('.source-reader-toolbar'),tea=toolbar?.querySelector('[data-source-tea-link]');if(tea)tea.before(toggle);else if(toolbar)toolbar.append(toggle);else dialogue.before(toggle);if(interpretation&&originalShown){const legend=doc.createElement('div');legend.className='source-reader-pair-legend';legend.innerHTML='<span>Original speech</span><span>Translation / current wording</span>';const title=panel.querySelector('.source-reader-title');title?.append(legend);}}
    compactLegacy();
  }
  function restoreContextualCopy() {
    for(const [node,{before,after}] of contextualCopy)if(node.textContent===after)node.textContent=before;
    contextualCopy.clear();
  }
  function refineContextualCopy() {
    if(!loaded||!data.sessions.length||!panel?.isConnected)return;
    const lane=panel.closest('#stage-working-lane');if(!lane)return;
    const update=(selector,before,after)=>{for(const node of lane.querySelectorAll(selector))if(node.textContent===before){contextualCopy.set(node,{before,after});node.textContent=after;}};
    update('.sws-revision','Retained source words are read-only. Choose a connected transcript to use passage and speaker correction.','Choose a kept conversation to correct a remark. Other project source records remain available.');
    update('.material-index h3','Sessions & versions','Project source records');
    update('.material-index p','No retained source records are connected.','No source records are attached to this project.');
  }
  function compactLegacy() {
    if(!panel?.isConnected)return;
    refineContextualCopy();
    const target=panel.parentElement;
    if(data.sessions.length && target.classList.contains('material-reading')) {
      let fallback=target.querySelector(':scope > [data-source-reader-legacy]');
      if(!fallback){fallback=doc.createElement('details');fallback.dataset.sourceReaderLegacy='';fallback.className='source-reader-legacy';const summary=doc.createElement('summary');summary.textContent='Other connected source records';fallback.append(summary);target.append(fallback);}
      for(const n of [...target.childNodes])if(n!==panel&&n!==fallback)fallback.append(n);
    }
  }
  function refresh(){if(disposed)return Promise.resolve();if(refreshJob){refreshQueued=true;return refreshJob;}refreshJob=runRefresh().finally(()=>{refreshJob=null;if(refreshQueued){refreshQueued=false;void refresh();}});return refreshJob;}
  async function runRefresh() {
    if(disposed)return;savedReviewEpoch++;const hadError=!!loadError,previous=JSON.stringify(data),hadView=loaded&&!!panel?.querySelector('[data-source-reader-dialogue]');loading=true;loadError='';notConnected=false;if(!hadView)paint();else paintReview(true);
    try {
      const response=await request('/api/source-sessions',{headers:{Accept:'application/json'},cache:'no-store'});
      let next;try{next=await response.json();}catch{}
      if(disposed)return;
      if(!response.ok){
        if(response.status===503&&next?.error==='Kept conversation editing is not connected in this workspace.'){
          notConnected=true;throw Error('Not connected · Kept conversation editing is not available in this workspace. Existing source records remain readable below.');
        }
        throw Error('Kept conversations could not be loaded. Try Refresh.');
      }
      if(!next||next.revision===undefined||!Array.isArray(next.sessions)||next.sessions.some(s=>!s.id||!s.sourceHash||!Array.isArray(s.turns)))throw Error('Kept conversation data is incomplete. Try Refresh.');
      data=next;data.notes ||= {};loaded=true;
    }catch(e){loadError=e.message||'Kept conversations could not be loaded.';}finally{loading=false;mount();if(!hadView||hadError||previous!==JSON.stringify(data)||loadError)paint();else{paintReview(true);const p=active(),editable=!!p&&correctionsAllowed()&&!room(p).pending;for(const node of panel?.querySelectorAll('[data-source-reader-turn]')||[]){node.setAttribute('contenteditable',editable?'plaintext-only':'false');node.setAttribute('aria-readonly',String(!editable));}}if(!loadError)void pickupSavedReview();}
  }
  async function selectSource({sourceId,expectedSourceHash,expectedVersion}={}){const p=active(),intent=++navigationEpoch;if(!p||room(p).pending||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(sourceId||''))throw Error('Choose one existing transcript source in the Source reader.');await(refreshJob||refresh());if(refreshJob)await refreshJob;if(disposed||active()!==p||intent!==navigationEpoch||room(p).pending||loadError||!loaded)throw Error(loadError||'The selected Source context changed. Open the transcript again.');const matches=data.sessions.filter(s=>s.sourceId===sourceId);if(matches.length!==1)throw Error('The exact transcript source is missing or ambiguous. No alternative was selected.');const s=matches[0];if(expectedSourceHash!==undefined&&s.sourceHash!==expectedSourceHash||expectedVersion!==undefined&&s.version!==expectedVersion)throw Error('This transcript changed. Refresh the catalog before opening its current version.');const r=room(p);r.sessionId=s.id;r.turnId='';r.navigation=null;r.message='';saveLocal();paint();void pickupSavedReview();return {sessionId:s.id,sourceId:s.sourceId,sourceHash:s.sourceHash,version:s.version};}
  function correctionsAllowed(){return !(win.AR_CREATE_REVIEW_MODE?.actualWork===true&&win.AR_CREATE_REVIEW_MODE.sourceCorrections!==true);}
  function syncTools(p,s,t){
    let host=panel.querySelector('.source-reader-inline-tools');
    const d=t&&drafts[draftKey(p,s,t)];
    if(!d){if(host)host.hidden=true;return;}
    if(!host){host=doc.createElement('div');host.className='source-reader-inline-tools';panel.append(host);}
    host.hidden=false;host.innerHTML=editor(p,s,t);
  }
  function selectCaret(p,id){
    const s=selected(p),t=s?.turns.find(t=>t.id===id),r=room(p);if(!t||r.pending||!correctionsAllowed())return;
    // All current remarks are already editable. Selection never replaces words,
    // changes contenteditable, forces focus, creates a draft or writes browser storage.
    const node=[...panel.querySelectorAll('[data-source-reader-turn]')].find(n=>n.dataset.sourceReaderTurn===id);if(!node)return;if(r.turnId===id&&node.dataset.sourceReaderField==='text')return;
    for(const previous of panel.querySelectorAll('[data-source-reader-field="text"]'))if(previous!==node)delete previous.dataset.sourceReaderField;
    node.dataset.sourceReaderField='text';r.turnId=id;
    syncTools(p,s,t);if(drafts[draftKey(p,s,t)])saveLocal();
  }
  function ensureDraft(p,s,t){
    const key=draftKey(p,s,t);
    drafts[key] ||= {baseRevision:data.revision,baseSourceHash:s.sourceHash,speaker:t.speaker||'',text:t.text,baseSpeaker:t.speaker||'',baseText:t.text};
    navigationEpoch++;translationBatches.delete(s.id);room(p).turnId=t.id;
    const node=[...panel.querySelectorAll('[data-source-reader-turn]')].find(n=>n.dataset.sourceReaderTurn===t.id);if(node)node.dataset.sourceReaderUnsaved='true';
    const tea=panel.querySelector('[data-source-tea-link]');if(tea){tea.style.visibility='hidden';tea.removeAttribute('href');tea.removeAttribute('data-source-tea-link');tea.setAttribute('aria-disabled','true');}
    return drafts[key];
  }
  async function submit(p,kind) {
    const r=room(p),s=selected(p);if(!s||r.pending||!loaded)return;
    let body, key;
    if(kind==='edit'){
      const t=s.turns.find(t=>t.id===r.turnId);if(!t)return;key=draftKey(p,s,t);const d=drafts[key];
      if(!d||stale(d,s)||!d.text.trim())return;
      body={operationId:makeId(),expectedRevision:d.baseRevision,expectedSourceHash:d.baseSourceHash,sessionId:s.id,turnId:t.id,speaker:d.speaker,text:d.text};
    }else{
      if(!s.undoOperationId||Object.keys(drafts).some(k=>{try{const v=JSON.parse(k);return v[0]===p.id&&v[1]===s.id;}catch{return false;}}))return;
      body={operationId:makeId(),undoOperationId:s.undoOperationId,expectedRevision:data.revision,expectedSourceHash:s.sourceHash,sessionId:s.id};
    }
    r.pending={kind,body,key,uncertain:false};r.message='';saveLocal();return send(p);
  }
  async function send(p) {
    const r=room(p),pending=r.pending;if(!pending||pending.sending)return;pending.sending=true;pending.uncertain=false;saveLocal();paint();
    try{
      const response=await request(`/api/source-sessions/${pending.kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending.body)});
      if(response.status===409){if(pending.translation)translationReviews.set(JSON.stringify([p.id,pending.body.sessionId]),{state:'stale',message:'The source changed. Proposed English was not saved; local wording is preserved. Prepare the current conversation again.'});if(pending.key&&drafts[pending.key])drafts[pending.key].conflict=true;r.pending=null;r.message='This conversation changed. Your unsaved wording is preserved. Compare it with the current wording before continuing.';await refresh();return;}
      if(!response.ok){if(response.status>=500)throw Error('The response was interrupted.');r.pending=null;r.message='The correction was refused. Your unsaved wording is preserved.';return;}
      await response.json(); // Receipt is historical; never replace current state from it.
      if(pending.translation)translationReviews.set(JSON.stringify([p.id,pending.body.sessionId]),{state:'stale',message:'Selected-remark request confirmed. Current saved wording is shown; other proposals were not accepted.'});if(pending.key)delete drafts[pending.key];r.pending=null;r.turnId='';r.message=pending.kind==='undo'?'Last correction undone.':'Correction saved. Notes may need review.';
      await refresh();
    }catch {pending.uncertain=true;r.message='Your wording and complete request are kept on this device.';}
    finally{pending.sending=false;saveLocal();paint();}
  }
  function follow(p,key,index) {
    const s=selected(p),ids=s?resolveNoteAnchors(s,data.notes,key,index):[];
    if(!ids.length){room(p).message='This note has no current exact supporting passage.';paint();return;}
    room(p).navigation={sourceHash:s.sourceHash,ids,index:0};saveLocal();paint();scrollPassage();
  }
  function scrollPassage(){const n=panel?.querySelector('[data-source-reader-highlight]');n?.scrollIntoView?.({block:'center',behavior:'instant'});n?.focus({preventScroll:true});}
  function onClick(event) {
    if(event.target.closest?.('[data-source-original-toggle]')){const p=active(),s=p&&selected(p);showOriginal=!(showOriginal??(!!s&&detectInterpretation(s)));paint();return;}
    if(!event.target.closest?.('[data-source-reader]'))return;
    const p=active();if(!p||panel?.dataset.sourceReaderProject!==p.id)return;
    const r=room(p),note=event.target.closest('[data-source-reader-note-section]'),action=event.target.closest('[data-source-reader-action]')?.dataset.sourceReaderAction;
    if(note){event.preventDefault();follow(p,note.dataset.sourceReaderNoteSection,Number(note.dataset.sourceReaderNoteIndex));return;}
    if(action){event.preventDefault();if(action==='review-translation'){const review=panel.querySelector('[data-source-translation-review] details');if(review){review.open=true;const summary=review.querySelector('summary');summary?.focus({preventScroll:true});review.scrollIntoView?.({block:'nearest'});}return;}if(action==='translate')return generateTranslation(p);if(action==='accept-translation')return acceptTranslation(p);if(action==='speaker'){const s=selected(p),t=s?.turns.find(t=>t.id===r.turnId);if(t&&correctionsAllowed()&&!r.pending){ensureDraft(p,s,t);saveLocal();syncTools(p,s,t);const details=panel.querySelector('.source-reader-speaker-edit');if(details)details.open=true;panel.querySelector('[data-source-reader-field="speaker"]')?.focus({preventScroll:true});}return;}if(action==='timing'){showTiming=!showTiming;paint();return;}if(action==='refresh')return refresh();if(action==='save')return submit(p,'edit');if(action==='undo')return submit(p,'undo');if(action==='retry')return send(p);
      if(action==='cancel'){const s=selected(p),t=s?.turns.find(t=>t.id===r.turnId);if(t&&!r.pending)delete drafts[draftKey(p,s,t)];r.turnId='';saveLocal();paint();}
      if(action==='notes'){r.navigation=null;saveLocal();paint();panel.querySelector('[data-source-reader-notes]')?.focus();panel.querySelector('[data-source-reader-notes]')?.scrollIntoView?.({block:'start'});}
      if(action==='previous'||action==='next'){const s=selected(p),n=r.navigation;if(n?.sourceHash===s?.sourceHash){n.index=Math.max(0,Math.min(n.ids.length-1,n.index+(action==='next'?1:-1)));saveLocal();paint();scrollPassage();}}
      return;
    }
    const turn=event.target.closest('[data-source-reader-turn]');if(turn)selectCaret(p,turn.dataset.sourceReaderTurn);
  }
  function onFocusIn(event){const node=event.target.closest?.('[data-source-reader-turn]'),p=active();if(node&&p&&panel?.contains(node))selectCaret(p,node.dataset.sourceReaderTurn);}
  function onInput(event) {
    const field=event.target.dataset?.sourceReaderField|| (event.target.matches?.('[data-source-reader-turn]')?'text':null);if(!field||!['speaker','text'].includes(field))return;
    const p=active(),s=p&&selected(p),r=p&&room(p),id=field==='text'?event.target.dataset.sourceReaderTurn:r?.turnId,t=s?.turns.find(t=>t.id===id);if(!t||r.pending||!correctionsAllowed())return;
    if(field==='text')selectCaret(p,t.id);
    const d=ensureDraft(p,s,t);d[field]=field==='text'?editableWords(event.target):event.target.value;saveLocal();
    // Tool state changes only after an actual edit, outside the speech flow.
    if(field==='text')syncTools(p,s,t);paintReview(true);
    const b=panel.querySelector('[data-source-reader-action="save"]');if(b)b.disabled=stale(d,s)||!d.text.trim();
  }
  function onChange(event){if(event.target.matches?.('[data-source-translation-select]')){const p=active(),s=p&&selected(p),review=s&&translationReviews.get(reviewKey(p,s));if(review){review.selectedTurnId=event.target.value;paintReview();}return;}if(!event.target.matches?.('[data-source-reader-select]'))return;const p=active();if(!p||room(p).pending)return;navigationEpoch++;const r=room(p);r.sessionId=event.target.value;r.turnId='';r.navigation=null;r.message='';saveLocal();paint();void pickupSavedReview();}
  function onSubmit(event){if(event.target.matches?.('[data-source-reader-edit]')){event.preventDefault();const p=active();if(p)submit(p,'edit');}}
  function restoreLegacy(){restoreContextualCopy();doc.querySelectorAll('[data-source-reader-legacy]').forEach(n=>{const parent=n.parentNode;for(const child of [...n.childNodes])if(child.tagName!=='SUMMARY')parent.insertBefore(child,n);n.remove();});}
  function mount(){
    if(disposed)return;const p=active(),lane=p&&doc.getElementById('stage-working-lane'),surface=lane?.querySelector('.material-surface'),heading=surface?.querySelector(':scope > .material-heading'),target=contextView?.container||(heading?surface:(lane?.querySelector('.material-reading')||lane));
    const place=()=>{if(heading&&!contextView){if(panel.previousElementSibling!==heading)heading.after(panel);}else if(panel.parentElement!==target)target.prepend(panel);};
    if(!p||!target){savedReviewEpoch++;if(panel?.isConnected)panel.remove();panel=null;stamp='';restoreLegacy();return;}
    const next=String(p.id);
    if(panel?.isConnected&&stamp===next){place();return;}
    savedReviewEpoch++;restoreContextualCopy();panel?.remove();panel=doc.createElement('section');panel.dataset.sourceReader='';panel.dataset.sourceReaderProject=p.id;panel.className='source-reader';panel.setAttribute('aria-label','Kept conversation reader');place();stamp=next;paint();if(!loaded&&!loading)void refresh();else if(!loading)void pickupSavedReview();
  }
  doc.addEventListener('focusin',onFocusIn);doc.addEventListener('click',onClick);doc.addEventListener('input',onInput);doc.addEventListener('change',onChange);doc.addEventListener('submit',onSubmit);
  const observer=observe?new win.MutationObserver(()=>mount()):null;observer?.observe(doc.getElementById('app')||doc.body,{childList:true,subtree:true});
  // Returning browser focus must not replace prose under the incoming pointer.
  // Live source events and the explicit Refresh action retain freshness checks.
  let liveOff=null,liveTimer=null;const liveHook=()=>{liveOff=win.c3Shell?.live?.on?.({},event=>{if(disposed||!active())return;if(!event.reset&&event.kind==='source-sessions.translation-proposals')return;if(!event.reset&&!(event.scope?.kind==='source'||/^source-sessions/.test(event.kind||'')))return;win.clearTimeout(liveTimer);liveTimer=win.setTimeout(()=>{if(!disposed&&active())void refresh();},250);})||null;};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',liveHook,{once:true});else win.setTimeout(liveHook,0);
  // In-flight transport does not survive reload; preserve its exact idempotent request.
  for(const r of Object.values(projects))if(r.pending){r.pending.sending=false;r.pending.uncertain=true;}
  mount();
  return {openContext({container,project}){if(!container?.isConnected||!project?.id)throw Error('Choose an existing project and context mount.');contextView={container,project:{...project,view:'record',viewedStage:2}};stamp='';mount();},closeContext(){contextView=null;stamp='';mount();},mount,refresh,selectSource,getTranslationBatch(){const p=active(),s=p&&selected(p);if(!s||loading||loadError)throw Error('Refresh the conversation before preparing translation.');if(room(p).pending||Object.keys(drafts).some(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}}))throw Error('Save or cancel local corrections before preparing translation.');const batch=translationBatches.get(s.id);if(!batch)throw Error('Conversation translation preparation is unavailable.');return structuredClone(batch);},getState:()=>({data,projects,drafts}),dispose(){disposed=true;liveOff?.();observer?.disconnect();for(const [name,fn] of [['focusin',onFocusIn],['click',onClick],['input',onInput],['change',onChange],['submit',onSubmit]])doc.removeEventListener(name,fn);panel?.remove();restoreLegacy();}};
}
if(typeof document!=='undefined'&&typeof current==='function'&&!window.studyImportedSource){window.studyImportedSource=installSourceReader({document,getProject:()=>current()});}
