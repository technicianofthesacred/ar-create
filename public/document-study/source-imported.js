/* The kept conversation reader is a projection; source sessions remain server-owned. */
import {renderConversationNotes, resolveNoteAnchors, renderSourceGroups} from './source-dialogue.js';
import {detectInterpretation,pairingInfo,isSourceBoundary} from './interpretation-view.js';
import {translationReadiness,prepareTranslationBatch} from './translation-readiness.js';
import {createSourceLanguageReview} from './source-language-review.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE = 'ar-create:source-reader:v1';
// Chromium inserts DIV/BR nodes for plain-text line breaks; innerText doubles blank lines here.
function editableWords(node){let text='';for(const child of node.childNodes){if(child.nodeType===3)text+=child.nodeValue;else if(child.nodeType===1){if(child.tagName==='BR')text+='\n';else{const block=['DIV','P'].includes(child.tagName);if(block&&text&&!text.endsWith('\n'))text+='\n';text+=editableWords(child);if(block&&child.nextSibling?.nodeType===3&&!text.endsWith('\n'))text+='\n';}}}return text;}

const button = (action, text, disabled=false) => `<button type="button" data-source-reader-action="${action}"${disabled?' disabled':''}>${text}</button>`;
const namespaced = html => html.replace(/data-source-speaker-/g,'data-source-reader-speaker-').replace(/data-note-/g, 'data-source-reader-note-').replace(/data-source-session=/g, 'data-source-reader-session=').replace(/data-source-turn=/g, 'data-source-reader-turn=');
export function teaLibraryURL(session){if(!session||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(session.sourceId||'')||!/^[a-f0-9]{64}$/i.test(session.sourceHash||''))return null;const url=new URL('https://www.teajia.com/admin/compass');url.search=new URLSearchParams({tab:'library',arSource:session.sourceId}).toString();return url.href;}
export function installSourceReader({document:doc, window:win=doc.defaultView, getProject, fetch:request=win.fetch.bind(win), storage=win.localStorage, makeId=()=>win.crypto.randomUUID(), observe=true}={}) {
  let stored,knownStorage,storageBlocked=false,externalRecovery=null,reconciling=false;
  try { knownStorage=storage.getItem(STORAGE);stored=JSON.parse(knownStorage||'{}'); } catch { stored={};storageBlocked=true; }
  const projects=stored.projects && typeof stored.projects==='object'?stored.projects:{};
  const drafts=stored.drafts && typeof stored.drafts==='object'?stored.drafts:{};
  const contextualCopy=new Map();
  const translationBatches=new Map();
  const translationReviews=new Map();
  const languageSelections=new Map();
  function languageContext(){const p=active(),s=p&&selected(p);if(!s||loading||loadError||sessionDirty(p,s)||room(p).pending)throw Error('Save or cancel corrections and refresh before translating selected remarks.');const ids=languageSelections.get(s.id+':'+s.sourceHash)||[];return {selection:{kind:'conversation-turns',sessionId:s.id,expectedRevision:data.revision,expectedSourceHash:s.sourceHash,turnIds:[...ids]},rows:ids.map(id=>{const t=s.turns.find(t=>t.id===id);if(!t||isSourceBoundary(t))throw Error('The selected remark changed.');return {id:t.id,text:t.originalText?.trim()?t.originalText:t.text,speaker:t.speaker};}),actor:win.arCreateUiActor?.actor||'',title:s.title,proof:p.id};}
  const languageReview=createSourceLanguageReview({window:win,document:doc,context:languageContext,operationId:makeId,request:async({url,body,signal,actor})=>{const response=await request(url,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'ui'},cache:'no-store',body:JSON.stringify(body),signal}),value=await response.json();if(!response.ok)throw Error(value.error||'Selected translation could not finish.');return value;}});
  function mountSelectedLanguage(p,s,passages){if(!s)return;const ids=languageSelections.get(s.id+':'+s.sourceHash)||[];for(const [node,t]of passages){if(isSourceBoundary(t))continue;const label=doc.createElement('label');label.className='source-language-selection';const box=doc.createElement('input');box.type='checkbox';box.checked=ids.includes(t.id);box.disabled=loading||!!room(p).pending||sessionDirty(p,s);box.setAttribute('aria-label','Select remark for reader translation');box.addEventListener('change',()=>{const key=s.id+':'+s.sourceHash,next=languageSelections.get(key)||[];if(box.checked&&next.length>=8){box.checked=false;localNotice('Select up to eight remarks.');return;}languageSelections.set(key,box.checked?[...next,t.id]:next.filter(id=>id!==t.id));languageReview.close();paint();});label.append(box,doc.createTextNode('Translate'));const cell=node.closest('.source-reader-passage-words');if(cell)cell.prepend(label);else node.before(label);}
    const b=doc.createElement('button');b.type='button';b.textContent='Translate selected · '+ids.length;b.disabled=!ids.length||loading||sessionDirty(p,s)||!!room(p).pending;b.addEventListener('click',async()=>{try{let mount=panel.querySelector('[data-source-language-mount]');if(!mount){mount=doc.createElement('div');mount.dataset.sourceLanguageMount='';panel.querySelector('[data-source-reader-dialogue]').before(mount);}await languageReview.open({container:mount});}catch(e){localNotice(e.message);}});panel.querySelector('.source-reader-toolbar')?.append(b);
  }
  let contextView=null, showOriginal=false,showTiming=false,navigationEpoch=0,savedReviewEpoch=0;
  let data={revision:null,sessions:[],notes:{}}, loaded=false, loading=false, loadError='', notConnected=false, disposed=false, panel=null, stamp='', refreshQueued=false,refreshJob=null;
  const active = () => { const p=contextView?.project||getProject(); return p?.view==='record' && Number(p.viewedStage)===2 ? p:null; };
  const room = p => projects[p.id] ||= {sessionId:'',turnId:'',navigation:null,pending:null,message:''};
  const draftKey = (p,s,t) => JSON.stringify([p.id,s.id,t.id]);
  const selected = p => data.sessions.find(s=>s.id===room(p).sessionId);
  function localNotice(message){const n=panel?.querySelector('[data-source-reader-status]');if(n)n.textContent=message;}
  function storageRefused(raw){storageBlocked=true;externalRecovery=raw;localNotice('Browser recovery changed or could not be verified. Keep this page open; your wording remains here and further browser saves are paused.');return false;}
  // This is conservative conflict detection, not a localStorage compare-and-swap.
  // Once another writer is observed, this reader never writes its old snapshot again.
  function storageMatches(){try{const raw=storage.getItem(STORAGE);return !storageBlocked&&raw===knownStorage||storageRefused(raw);}catch{return storageRefused(null);}}
  const saveLocal = () => {if(reconciling||!storageMatches())return false;try {const next=JSON.stringify({projects,drafts});storage.setItem(STORAGE,next);const raw=storage.getItem(STORAGE);if(raw!==next)return storageRefused(raw);knownStorage=next;return true;} catch {return storageRefused(null);}};
  function exactSaved(d,s,t){return d&&(d.sourceId===undefined||d.sourceId===s.sourceId)&&d.baseSourceHash===s.sourceHash&&d.speaker===(t.speaker||'')&&d.text===t.text;}
  function validRecoveryEntry(x,p){return !!x&&typeof x==='object'&&!Array.isArray(x)&&x.kind==='exact-saved-wording'&&x.projectId===p.id&&typeof x.sessionId==='string'&&!!x.sessionId&&typeof x.turnId==='string'&&!!x.turnId&&typeof x.sourceId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x.sourceId)&&Number.isInteger(x.currentRevision)&&x.currentRevision>=0&&typeof x.currentSourceHash==='string'&&/^[a-f0-9]{64}$/i.test(x.currentSourceHash)&&!!x.draft&&typeof x.draft==='object'&&!Array.isArray(x.draft)&&typeof x.draft.speaker==='string'&&typeof x.draft.text==='string';}
  function validRecoveryArchive(entries,p){return Array.isArray(entries)&&entries.every(x=>validRecoveryEntry(x,p));}
  function recoverySummary(entry){const label=[entry.draft.speaker.trim()||'Retained correction',entry.draft.text.replace(/\s+/g,' ').trim()].filter(Boolean).join(' · '),characters=Array.from(label);return characters.slice(0,60).join('')+(characters.length>60?'…':'');}
  function recoveryHTML(p,s){
    const entries=room(p).recoveryArchive;if(entries===undefined)return '';
    const readable=Array.isArray(entries)?entries.filter(x=>validRecoveryEntry(x,p)):[],unreadable=Array.isArray(entries)?entries.filter(x=>!validRecoveryEntry(x,p)):entries;
    const malformed=!validRecoveryArchive(entries,p),matching=readable.filter(x=>x.sessionId===s.id&&x.sourceId===s.sourceId);
    if(!matching.length&&!malformed)return '';
    return `<section data-source-reader-recovery><h3 title="Retained correction recovery">Recovery · ${matching.length}${malformed?' · needs review':''}</h3>${malformed?`<p role="status" data-source-reader-recovery-status>Some archived recovery could not be read. Nothing was removed. Keep saved wording is paused until this recovery is reviewed.</p><section><h3>Unreadable recovery details</h3><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(unreadable,null,2))}</pre></section>`:''}${matching.map(x=>`<section><h3>${esc(recoverySummary(x))}</h3><p>Retained speaker</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(x.draft.speaker)}</pre><p>Retained wording</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(x.draft.text)}</pre><section><h3>Recovery details</h3><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(x,null,2))}</pre></section></section>`).join('')}</section>`;
  }
  async function keepSaved(p){
    const s=selected(p),r=room(p),t=s?.turns.find(t=>t.id===r.turnId),key=t&&draftKey(p,s,t),d=drafts[key];
    if(!t||!Number.isInteger(data.revision)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s.sourceId||'')||!/^[a-f0-9]{64}$/i.test(s.sourceHash||'')||r.pending||reconciling||!correctionsAllowed()||!exactSaved(d,s,t)||loading||loadError||storageBlocked)return;
    if(!win.navigator?.locks?.request){localNotice('Saved wording cannot be confirmed safely in this browser. Your retained correction remains available.');return;}
    const before=JSON.stringify({projects,drafts}),draftBefore=JSON.stringify(d),revision=data.revision,nav=navigationEpoch;
    const node=[...panel.querySelectorAll('[data-source-reader-turn]')].find(n=>n.dataset.sourceReaderTurn===t.id),speakerField=panel.querySelector('[data-source-reader-field="speaker"]');
    const current=()=>!disposed&&active()===p&&selected(p)===s&&r.turnId===t.id&&!r.pending&&!loading&&!loadError&&data.revision===revision&&navigationEpoch===nav&&JSON.stringify({projects,drafts})===before&&JSON.stringify(drafts[key])===draftBefore&&exactSaved(drafts[key],s,t)&&node?.isConnected&&editableWords(node)===d.text&&(!speakerField||speakerField.value===d.speaker);
    reconciling=true;paintReview(true);
    try{await win.navigator.locks.request(STORAGE+':mutation',{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw Error('Another recovery change is in progress. Try Keep saved wording again.');
      if(!current()||!storageMatches())return;
      let deadline;const controller=new win.AbortController();let response,fresh;
      try{({response,fresh}=await Promise.race([(async()=>{const response=await request('/api/source-sessions',{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});return {response,fresh:await response.json()};})(),new Promise((_,reject)=>{deadline=win.setTimeout(()=>{controller.abort();reject(Error('Saved wording could not be checked in time. Your retained correction is unchanged.'));},8000);})]));}finally{win.clearTimeout(deadline);}
      const matches=fresh?.sessions?.filter(x=>x.id===s.id||x.sourceId===s.sourceId),owned=matches?.length===1&&matches[0],turns=owned?.turns?.filter(x=>x.id===t.id),turn=turns?.length===1&&turns[0];
      if(!response.ok||fresh.revision!==revision||!owned||owned.id!==s.id||owned.sourceId!==s.sourceId||owned.sourceHash!==s.sourceHash||!turn||turn.speaker!==t.speaker||turn.text!==t.text||!current())throw Error('The saved conversation changed. Refresh and compare; your retained correction is unchanged.');
      if(!storageMatches())return;
      const next=JSON.parse(before),nextRoom=next.projects[p.id];
      if(nextRoom.recoveryArchive!==undefined&&!validRecoveryArchive(nextRoom.recoveryArchive,p))throw Error('Earlier recovery could not be verified. Your retained correction is unchanged.');
      const entry={kind:'exact-saved-wording',projectId:p.id,sessionId:s.id,turnId:t.id,sourceId:s.sourceId,currentRevision:revision,currentSourceHash:s.sourceHash,draft:JSON.parse(draftBefore)};
      (nextRoom.recoveryArchive||=[]).push(entry);delete next.drafts[key];nextRoom.message='Saved wording kept. The full retained correction is available in recovery.';
      const encoded=JSON.stringify(next);
      // No await between the final preimage check, single write and readback.
      // The Web Lock serializes cooperating retirements; legacy/uncooperative writers
      // can still race localStorage, so any detected mismatch freezes persistence.
      if(!current()||!storageMatches())return;
      storage.setItem(STORAGE,encoded);const raw=storage.getItem(STORAGE);if(raw!==encoded){storageRefused(raw);return;}
      knownStorage=encoded;r.recoveryArchive=nextRoom.recoveryArchive;r.message=nextRoom.message;delete drafts[key];
      delete node.dataset.sourceReaderUnsaved;syncTools(p,s,t);paintReview(true);const undo=panel.querySelector('[data-source-reader-action="undo"]');if(undo)undo.disabled=!!r.pending||sessionDirty(p,s);localNotice(r.message);
    });}catch(error){if(!storageMatches())return;localNotice(error.message||'Recovery could not be saved. Your retained correction is unchanged.');}finally{reconciling=false;paintReview(true);}
  }

  function stale(d,s) {return d && (d.conflict || d.baseRevision!==data.revision || d.baseSourceHash!==s.sourceHash);}
  function editor(p,s,t) {
    const d=drafts[draftKey(p,s,t)]; if(!d)return '';
    const old=stale(d,s), pending=!!room(p).pending;
    return `<form data-source-reader-edit="${esc(t.id)}"><section class="source-reader-speaker-edit"><h3>Speaker</h3><p class="source-reader-speaker-scope">Speaker label for this remark only. Not saved.</p><label>Speaker<input maxlength="100" data-source-reader-field="speaker" value="${esc(d.speaker)}"${pending?' disabled':''}></label></section>${old?`<p class="source-reader-conflict" role="alert">This conversation changed. Your unsaved wording remains in the remark; saving is blocked until you resolve it.</p><section><h3>Compare saved and unsaved wording</h3><p>Saved now: ${esc(t.speaker)} — ${esc(t.text)}</p><p>Your edit: ${esc(d.speaker)} — ${esc(d.text)}</p><p>Started at revision ${esc(d.baseRevision)} / ${esc(d.baseSourceHash)}. Current revision ${esc(data.revision)} / ${esc(s.sourceHash)}.</p></section>`:''}<div class="source-reader-actions">${button('save','Save correction',pending||reconciling||storageBlocked||old||!d.text.trim())}${exactSaved(d,s,t)?button('keep-saved','Keep saved wording',pending||reconciling||storageBlocked):''}${button('cancel',old?'Discard my unsaved edit':'Cancel',pending)}</div><p class="small">${old?'Discard only when you have kept any wording you still need.':'Unsaved wording stays on this device until saved or cancelled.'}</p><section data-source-reader-draft-recovery><h3>Recovery details</h3><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(d,null,2))}</pre></section></form>`;
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
    if(!review.result.proposals.length)return '<section class="source-reader-proposal-card"><h4>English proposals · all saved</h4><p class="small" role="status" data-source-translation-state="proposal-ready" data-source-translation-complete>All English proposals have been saved. The last correction can be undone through the existing correction history.</p></section>';
    const proposals=review.result.proposals,selected=proposals.find(t=>t.turnId===review.selectedTurnId)||proposals[0],turn=s.turns.find(t=>t.id===selected?.turnId);
    if(!selected||!turn)return '<p class="small" role="status">No current English proposal is available.</p>';
    review.selectedTurnId=selected.turnId;
    return `<section class="source-reader-proposal-card" aria-label="English proposal beside its passage"><div class="source-reader-proposal-top"><h4>English proposal</h4><div class="source-reader-proposal-stepper"><button type="button" data-source-reader-action="proposal-previous" aria-label="Previous proposal"${proposals.indexOf(selected)===0?' disabled':''}>‹</button><span>${proposals.indexOf(selected)+1} / ${proposals.length}</span><button type="button" data-source-reader-action="proposal-next" aria-label="Next proposal"${proposals.indexOf(selected)===proposals.length-1?' disabled':''}>›</button></div></div><p class="small" role="status" data-source-translation-state="proposal-ready">Proposed English · not saved${review.result.reviewNote?' · '+esc(review.result.reviewNote):''}</p><p data-source-translation-proposal>${esc(selected.text)}</p>${selected.uncertainty?`<p class="small">Uncertainty: ${esc(selected.uncertainty)}</p>`:''}<div class="source-reader-actions">${button('accept-translation','Save English for this remark',reconciling||storageBlocked||!correctionsAllowed()||!!room(p).pending||sessionDirty(p,s))}${button('proposal-next','Next',proposals.indexOf(selected)===proposals.length-1)}</div><p class="small">Only this remark changes when saved.</p><section class="source-reader-proposal-picker"><h3>Choose a remark · ${proposals.length} proposals</h3><label>Remark <select data-source-translation-select>${proposals.map((t,i)=>`<option value="${esc(t.turnId)}"${t.turnId===selected.turnId?' selected':''}>${i+1} of ${proposals.length} · ${esc(s.turns.find(x=>x.id===t.turnId)?.speaker||'Supplied speaker')}</option>`).join('')}</select></label></section></section>`;
  }
  function earlierReviewHTML(review,s){
    const proposals=review.result.proposals,proposal=proposals.find(t=>t.turnId===review.selectedTurnId)||proposals[0];if(!proposal)return '';
    review.selectedTurnId=proposal.turnId;const turn=s.turns.find(t=>t.id===proposal.turnId);
    return `<section class="source-reader-details" open><h3>Earlier English proposals · ${proposals.length} · read only</h3><p class="small" role="status" data-source-translation-state="earlier-review">The conversation wording has changed. These earlier proposals remain available for comparison and cannot be saved.${review.result.reviewNote?' '+esc(review.result.reviewNote):''}</p><label>Remark <select data-source-translation-select>${proposals.map((t,i)=>`<option value="${esc(t.turnId)}"${t.turnId===proposal.turnId?' selected':''}>${i+1} of ${proposals.length} · ${esc(s.turns.find(x=>x.id===t.turnId)?.speaker||'Earlier remark')}</option>`).join('')}</select></label><p class="small">Wording when prepared</p><p data-source-translation-preparation>${esc(proposal.currentAtPreparation)}</p><p class="small">Current saved wording</p><p data-source-translation-current>${esc(turn?turn.text:'This remark is no longer in the current conversation.')}</p><p class="small">Earlier proposed English · read only</p><p data-source-translation-proposal>${esc(proposal.text)}</p>${proposal.uncertainty?`<p class="small">Uncertainty: ${esc(proposal.uncertainty)}</p>`:''}</section>`;
  }
  function paintReview(controlsOnly=false){const p=active(),s=p&&selected(p);if(!p||!s||!panel?.isConnected)return;const target=panel.querySelector('[data-source-translation-review]');if(target&&!controlsOnly){target.innerHTML=reviewHTML(p,s);placeReview();}const refreshButton=panel.querySelector('[data-source-reader-action="refresh"]');if(refreshButton){refreshButton.disabled=loading||!!room(p).pending;refreshButton.textContent=loading?'Loading…':notConnected?'Check connection':'Refresh';}const review=translationReviews.get(reviewKey(p,s)),ready=review?.state==='earlier-review'||review?.state==='proposal-ready'&&reviewCurrent(review,s);let shortcut=panel.querySelector('[data-source-reader-action="review-translation"]');if(ready&&!shortcut){shortcut=doc.createElement('button');shortcut.type='button';shortcut.dataset.sourceReaderAction='review-translation';(review.deferPlacement?panel.querySelector('[data-source-reader-secondary-tools]'):panel.querySelector('.source-reader-toolbar'))?.append(shortcut);}if(shortcut){if(ready)shortcut.textContent=review.result.proposals.length?'Review English · '+review.result.proposals.length:'Review English · all saved';else shortcut.remove();}const r=room(p),t=s.turns.find(t=>t.id===r.turnId),d=t&&drafts[draftKey(p,s,t)],blocked=reconciling||storageBlocked||!!r.pending;const save=panel.querySelector('[data-source-reader-action="save"]');if(save)save.disabled=blocked||!d||stale(d,s)||!d.text.trim();const keep=panel.querySelector('[data-source-reader-action="keep-saved"]');if(keep)keep.disabled=blocked;const undo=panel.querySelector('[data-source-reader-action="undo"]');if(undo)undo.disabled=blocked||sessionDirty(p,s);const retry=panel.querySelector('[data-source-reader-action="retry"]');if(retry)retry.disabled=reconciling||storageBlocked;const accept=panel.querySelector('[data-source-reader-action="accept-translation"]');if(accept)accept.disabled=reconciling||storageBlocked||!correctionsAllowed()||!!room(p).pending||sessionDirty(p,s)||!reviewCurrent(translationReviews.get(reviewKey(p,s)),s);const b=panel.querySelector('[data-source-reader-action="translate"]');if(b)b.disabled=loading||!!room(p).pending||generationDirty(p,s)||translationReviews.get(reviewKey(p,s))?.state==='busy';}
  function placeReview(){
    const p=active(),s=p&&selected(p);if(!p||!s||!panel)return;
    panel.classList.add('source-reader-approved');
    const tools=panel.querySelector('[data-source-reader-secondary-tools]');if(tools)for(const control of panel.querySelectorAll('.source-reader-toolbar [data-source-reader-action=refresh],.source-reader-toolbar [data-source-reader-action=translate],.source-reader-toolbar [data-source-tea-link]'))tools.append(control);
    for(const node of panel.querySelectorAll('[data-source-reader-turn]')){
      if(node.closest('.source-reader-passage'))continue;
      const words=node.closest('[data-source-reader-pair]')||node,row=doc.createElement('div'),cell=doc.createElement('div');
      row.className='source-reader-passage';cell.className='source-reader-passage-words';words.before(row);row.append(cell);cell.append(words);
      const original=row.nextElementSibling;if(original?.matches?.('[data-source-reader-original-for]')&&original.dataset.sourceReaderOriginalFor===node.dataset.sourceReaderTurn)cell.append(original);
    }
    panel.querySelectorAll('.source-reader-proposal-target').forEach(n=>n.classList.remove('source-reader-proposal-target'));
    panel.querySelectorAll('.source-remark[data-source-translation-current]').forEach(n=>n.removeAttribute('data-source-translation-current'));
    const review=translationReviews.get(reviewKey(p,s)),target=panel.querySelector('[data-source-translation-review]'),node=[...panel.querySelectorAll('[data-source-reader-turn]')].find(n=>n.dataset.sourceReaderTurn===review?.selectedTurnId),row=node?.closest('.source-reader-passage');
    if(target)target.hidden=review?.deferPlacement===true;
    const ready=!review?.deferPlacement&&!!row&&['proposal-ready','earlier-review'].includes(review?.state)&&review.result?.proposals?.length>0;
    panel.classList.toggle('source-reader-has-proposal',ready);
    if(ready){row.classList.add('source-reader-proposal-target');node.setAttribute('data-source-translation-current','');row.append(target);const dialogue=panel.querySelector('[data-source-reader-dialogue]');if(dialogue){dialogue.style.minHeight='';const fit=()=>{if(dialogue.isConnected&&target.isConnected){dialogue.style.minHeight='';dialogue.style.minHeight=Math.max(dialogue.getBoundingClientRect().height,target.getBoundingClientRect().bottom-dialogue.getBoundingClientRect().top)+'px';}};if(win.requestAnimationFrame)win.requestAnimationFrame(fit);else fit();}}
    else if(target){const dialogue=panel.querySelector('[data-source-reader-dialogue]');dialogue?.before(target);}
  }
  function stepProposal(delta){const p=active(),s=p&&selected(p),review=s&&translationReviews.get(reviewKey(p,s));if(!review?.result?.proposals?.length)return;review.deferPlacement=false;const list=review.result.proposals,index=Math.max(0,list.findIndex(t=>t.turnId===review.selectedTurnId));review.selectedTurnId=list[Math.max(0,Math.min(list.length-1,index+delta))].turnId;paintReview();const row=panel.querySelector('.source-reader-proposal-target');row?.scrollIntoView?.({block:'center'});}
  const validReceiptHash=hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/i.test(hash);
  function validProposals(result,s,input,batch){
    const c=result?.sourceContext,ids=new Set(batch.gapIds);
    if(!(result?.applied===false&&c&&c.sessionId===input.sessionId&&c.sourceId===s.sourceId&&c.expectedRevision===input.expectedRevision&&c.expectedSourceHash===input.expectedSourceHash&&Array.isArray(result.proposals)&&result.proposals.length===ids.size&&result.proposals.every(t=>t&&ids.delete(t.turnId)&&typeof t.text==='string'&&t.text.trim())))return false;
    if(result.savedReview!==true)return true;
    if(!validReceiptHash(result.receiptSha256)||!Array.isArray(result.acceptedTurnIds)||result.acceptedTurnIds.length>10000)return false;
    const accepted=new Set(),remaining=new Set(batch.gapIds),turnIds=new Set(s.turns.map(t=>t.id));
    return result.acceptedTurnIds.every(id=>typeof id==='string'&&id.trim()&&id.length<=1000&&!accepted.has(id)&&accepted.add(id)&&turnIds.has(id)&&!remaining.has(id))&&(result.proposals.length>0||accepted.size>0);
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
    // A first passive receipt must not resize prose beneath an editing caret.
    // Keep its review action in the existing Tools sheet until deliberately opened.
    const deferPlacement=()=>prior?.deferPlacement===true||!prior&&!!panel?.contains(doc.activeElement?.closest?.('[data-source-reader-turn][contenteditable="plaintext-only"],[data-source-reader-turn][contenteditable="true"]'));
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
      if(response.ok&&result?.state==='earlier-review'&&validEarlierReview(result,s,input)){translationReviews.set(key,{state:'earlier-review',result,deferPlacement:deferPlacement(),selectedTurnId:prior?.selectedTurnId||result.proposals[0].turnId});paintReview();return;}
      if(!response.ok||result?.state!=='proposal-ready'||result.savedReview!==true||!validProposals(result,s,input,batch))return;
      const remaining=new Set(result.proposals.map(t=>t.turnId)),old=prior?.result?.proposals||[],index=old.findIndex(t=>t.turnId===prior?.selectedTurnId),next=old.slice(index+1).concat(old.slice(0,index+1)).find(t=>remaining.has(t.turnId));
      translationReviews.set(key,{state:'proposal-ready',result,deferPlacement:deferPlacement(),selectedTurnId:remaining.has(prior?.selectedTurnId)?prior.selectedTurnId:next?.turnId||result.proposals[0]?.turnId});paintReview();
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
    const s=selected(p),r=room(p),review=s&&translationReviews.get(reviewKey(p,s));if(reconciling||storageBlocked||!s||!correctionsAllowed()||r.pending||sessionDirty(p,s)||review?.state!=='proposal-ready'||!reviewCurrent(review,s))return;
    const proposal=review.result.proposals.find(t=>t.turnId===review.selectedTurnId),turn=s.turns.find(t=>t.id===proposal?.turnId);if(!proposal||!turn)return;
    const c=review.result.sourceContext,body={operationId:makeId(),expectedRevision:c.expectedRevision,expectedSourceHash:c.expectedSourceHash,sessionId:s.id,turnId:turn.id,speaker:turn.speaker||'',text:proposal.text};
    if(review.result.savedReview===true&&!validReceiptHash(review.result.receiptSha256))return;
    const savedReview=review.result.savedReview===true;if(savedReview)body.receiptSha256=review.result.receiptSha256;
    r.pending={kind:savedReview?'translation-accept':'edit',body,uncertain:false,translation:true};if(!saveLocal()){r.pending.held=true;paint();return;}return send(p);
  }
  // Lookup reads the same kept speech; ephemeral results are never a second source authority.
  const lookups=new Map();
  const lookupFor=p=>{if(!lookups.has(p.id))lookups.set(p.id,{query:'',results:[],searched:false,open:false,busy:false,message:'',back:null,notesBeforeLookup:null});return lookups.get(p.id);};
  function ownSourceSheet(p,sheet){
    if(!sheet?.matches('.source-reader-secondary>details,.source-reader>.source-reader-lookup-sheet'))return;
    const q=lookupFor(p),lookup=sheet.matches('.source-reader-lookup-sheet');
    if(lookup&&q.notesBeforeLookup===null)q.notesBeforeLookup=!!panel?.querySelector('.source-reader-notes-sheet')?.open;
    for(const other of panel.querySelectorAll('.source-reader-secondary>details,.source-reader>.source-reader-lookup-sheet'))if(other!==sheet){other.open=false;if(other.matches('.source-reader-lookup-sheet'))q.open=false;}
    if(lookup)q.open=true;else if(!q.back)q.notesBeforeLookup=null;
  }
  function lookupHTML(p){const q=lookupFor(p);return `<section class="source-reader-lookup-sheet" ${q.open?'open':''}><h3>Find a passage</h3><form data-source-reader-lookup-form><label>Literal passage lookup<input type="search" data-source-reader-lookup-query maxlength="200" value="${esc(q.query)}" placeholder="Words in kept conversations" required></label><button type="submit" ${loading||!!loadError||!loaded||!!room(p).pending||q.busy?'disabled':''}>Find</button></form><p class="small">Exact text in saved kept speech, ignoring letter case. Unsaved corrections and original-language alternatives are not searched.</p><p role="status" data-source-reader-lookup-status>${esc(q.message||(q.searched?(q.results.length===20?'Showing the first 20 matching remarks.':q.results.length+' matching remarks.'):'Enter words to search across kept conversations.'))}</p><ol class="source-reader-lookup-results">${q.results.map((r,i)=>`<li><button type="button" data-source-reader-lookup-result="${i}" ${q.busy||!!room(p).pending?'disabled':''}><strong>${esc(r.title)}</strong><span>${esc(r.speaker||'Unverified speaker')}${r.date?' · '+esc(r.date):''}</span><span>${esc(r.excerpt)}</span></button></li>`).join('')}</ol></section>`;}
  function searchPassages(p,query){const q=lookupFor(p);if(loading||loadError||!loaded||room(p).pending||q.busy)return;q.query=query.trim().slice(0,200);q.results=[];q.searched=!!q.query;ownSourceSheet(p,panel.querySelector('.source-reader-lookup-sheet'));q.open=true;q.message='';if(q.query){const needle=q.query.toLocaleLowerCase();outer:for(const s of data.sessions)for(const t of s.turns){if(isSourceBoundary(t)||typeof t.text!=='string')continue;const at=t.text.toLocaleLowerCase().indexOf(needle);if(at<0)continue;const start=Math.max(0,at-60);q.results.push({sessionId:s.id,sourceId:s.sourceId,sourceHash:s.sourceHash,version:s.version,turnId:t.id,text:t.text,title:s.title||'Untitled conversation',speaker:t.speaker,date:s.date,excerpt:(start?'…':'')+t.text.slice(start,Math.max(at+needle.length,start+220))+(t.text.length>Math.max(at+needle.length,start+220)?'…':'')});if(q.results.length===20)break outer;}}paint();}
  function lookupSession(result){const matches=data.sessions.filter(s=>s.sourceId===result.sourceId);if(matches.length!==1||data.sessions.filter(s=>s.id===result.sessionId).length!==1)throw Error('This passage source is missing or ambiguous. Find the passage again.');const s=matches[0];if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(result.sourceId||'')||!/^[a-f0-9]{64}$/i.test(result.sourceHash||'')||!Number.isSafeInteger(result.version)||s.id!==result.sessionId||s.sourceHash!==result.sourceHash||s.version!==result.version)throw Error('This passage belongs to earlier or unverified wording. Find the passage again.');const turns=s.turns.filter(t=>t.id===result.turnId);if(turns.length!==1||turns[0].text!==result.text||isSourceBoundary(turns[0]))throw Error('This exact remark changed or is unavailable. Find the passage again.');return s;}
  async function openLookup(p,index){const q=lookupFor(p),result=q.results[index],r=room(p);if(!result||q.busy||r.pending)return;const token=++navigationEpoch;q.busy=true;q.message='Checking the exact saved passage…';const before={sessionId:r.sessionId,turnId:r.turnId,navigation:structuredClone(r.navigation),dialogueScroll:panel?.querySelector('[data-source-reader-dialogue]')?.scrollTop||0,notesOpen:q.notesBeforeLookup??!!panel?.querySelector('.source-reader-notes-sheet')?.open,scrolls:[]};for(let node=panel?.parentElement;node;node=node.parentElement)before.scrolls.push([node,node.scrollTop,node.scrollLeft]);paint();try{await(refreshJob||refresh());if(refreshJob)await refreshJob;if(disposed||active()!==p||token!==navigationEpoch||r.pending)throw Error('The Source selection changed. Open the passage again.');if(loadError||!loaded)throw Error(loadError||'Saved speech could not be checked.');const s=lookupSession(result);q.back ||= before;r.sessionId=s.id;r.turnId='';r.navigation={sourceHash:s.sourceHash,ids:[result.turnId],index:0,kind:'lookup'};r.message='';q.open=false;q.message='';saveLocal();paint();}catch(error){q.message=error.message;if(active()===p)paint();}finally{q.busy=false;if(active()===p){paint();if(token===navigationEpoch&&r.navigation?.kind==='lookup'&&!q.open)scrollPassage();}}}
  function backFromLookup(p){const q=lookupFor(p),before=q.back;if(!before||room(p).pending)return;navigationEpoch++;q.back=null;q.open=false;q.notesBeforeLookup=null;const r=room(p);r.sessionId=before.sessionId;r.turnId=before.turnId;r.navigation=before.navigation;saveLocal();paint();const dialogue=panel?.querySelector('[data-source-reader-dialogue]');if(dialogue)dialogue.scrollTop=before.dialogueScroll;const notes=panel?.querySelector('.source-reader-notes-sheet');if(notes)notes.open=before.notesOpen;for(const [node,top,left]of before.scrolls)if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}}
  function hasConversationDraft(p,s){return !!s&&Object.keys(drafts).some(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}});}
  function currentTeaHref(p,s){return loaded&&!loading&&!loadError&&!room(p).pending&&s&&!hasConversationDraft(p,s)?teaLibraryURL(s):null;}
  function conversationReadiness(p,s){
    const pending=room(p).pending,hasDraft=hasConversationDraft(p,s),ready=translationReadiness(s,{loading,error:loadError,stale:hasDraft||!!pending});
    if(ready.state==='unavailable'&&ready.count)ready.message=`${ready.count} Chinese remark${ready.count===1?' needs':'s need'} English. Prepare conversation proposals to check availability; saved wording stays unchanged.`;
    if(hasDraft||pending)ready.message='Save or cancel local corrections before preparing conversation translation.';
    if(loading||loadError||hasDraft||pending)translationBatches.delete(s.id);
    else{const batch=translationBatches.get(s.id);if(!batch||batch.sessionId!==s.id||batch.sourceId!==s.sourceId||batch.expectedSourceHash!==s.sourceHash||batch.expectedRevision!==data.revision)try{translationBatches.set(s.id,prepareTranslationBatch(s,data.revision));}catch{ready.state='error';ready.message='Conversation turn identities are incomplete. Refresh before preparing translation.';}}
    return ready;
  }
  function syncReaderAvailability(){
    const p=active(),s=p&&selected(p);if(!p||!s||!panel?.isConnected||panel.dataset.sourceReaderProject!==p.id)return;
    const ready=conversationReadiness(p,s),notice=panel.querySelector('[data-source-translation-readiness]');if(notice){if(notice.dataset.sourceTranslationReadiness!==ready.state)notice.dataset.sourceTranslationReadiness=ready.state;if(notice.textContent!==ready.message)notice.textContent=ready.message;}
    const href=currentTeaHref(p,s);let link=panel.querySelector('.source-reader-tea-link');if(!href){link?.remove();return;}
    if(!link){link=doc.createElement('a');link.className='source-reader-tea-link';link.textContent='Link to tea library';link.target='_blank';link.rel='noopener noreferrer';link.title='Review this transcript and choose existing teas in Teajia. Opening saves nothing.';}
    if(link.getAttribute('href')!==href)link.href=href;if(!link.hasAttribute('data-source-tea-link'))link.dataset.sourceTeaLink='';link.style.removeProperty('visibility');link.removeAttribute('aria-disabled');
    if(!link.isConnected)(panel.querySelector('[data-source-reader-secondary-tools]')||panel.querySelector('.source-reader-toolbar'))?.append(link);
  }
  function html(p) {
    const r=room(p),s=selected(p),nav=r.navigation, pending=r.pending;
    const teaHref=currentTeaHref(p,s);
    const teaAction=teaHref?`<a class="source-reader-tea-link" data-source-tea-link href="${esc(teaHref)}" target="_blank" rel="noopener noreferrer" title="Review this transcript and choose existing teas in Teajia. Opening saves nothing.">Link to tea library</a>`:'';
    const selector=data.sessions.length?`<label class="source-reader-selector">Kept conversations · shared Library<select data-source-reader-select${pending?' disabled':''}><option value=""${!s?' selected':''}>Choose a kept conversation</option>${data.sessions.map(x=>`<option value="${esc(x.id)}"${x.id===s?.id?' selected':''}>${esc(x.title||'Untitled conversation')}${x.date?' · '+esc(x.date):''}</option>`).join('')}</select></label>`:'';
    let body='';
    if(s) {
      const notes=namespaced(renderConversationNotes(s,data.notes));
      const hasDraft=hasConversationDraft(p,s),readiness=conversationReadiness(p,s);
      const validNav=nav && nav.sourceHash===s.sourceHash && nav.ids.every(id=>s.turns.some(t=>t.id===id));
      body=`<article><header class="source-reader-title"><h3 title="${esc(s.title||'Untitled conversation')}">${esc(s.title||'Untitled conversation')}</h3>${s.location?`<span class="small">${esc(s.location)}</span>`:''}<div class="source-reader-title-tools">${button('undo','Undo last correction',!s.undoOperationId||reconciling||storageBlocked||!!pending||hasDraft)}${button('history','History')}</div><span class="source-reader-attribution small" title="Supplied source labels do not establish speaker identities. Review individual remarks before attribution.">Speaker labels unverified</span></header><p class="source-reader-translation-readiness small" data-source-translation-readiness="${readiness.state}" role="status">${esc(readiness.message)}</p><div data-source-translation-review>${reviewHTML(p,s)}</div>${validNav?nav.kind==='lookup'?'':`<nav class="source-reader-actions" aria-label="Supporting passages">${button('previous','Previous',nav.index===0)}<span>${nav.index+1} of ${nav.ids.length}</span>${button('next','Next',nav.index>=nav.ids.length-1)}${button('notes','Back to notes')}</nav>`:nav?'<p class="source-reader-conflict">The supporting passage belongs to earlier wording. Review the notes before following it.</p>':''}<div data-source-reader-dialogue>${namespaced(renderSourceGroups(s))}</div><div class="source-reader-secondary">${lookupHTML(p)}<section class="source-reader-tools-sheet"><h3>Tools</h3><div data-source-reader-secondary-tools></div></section><section class="source-reader-notes-sheet"><h3>Notes</h3><div data-source-reader-notes tabindex="-1">${notes||'<p class="small">No reviewed notes are connected to this conversation.</p>'}</div></section>${recoveryHTML(p,s)}<section class="source-reader-details source-reader-history"><h3>Source info</h3>${button('timing',showTiming?'Hide timestamps':'Show timestamps')}${button('speaker','Correct speaker')}<p>Version ${esc(s.version??'unspecified')}. Original source and earlier wording are preserved.</p><p>Source: ${esc(s.sourceId)}<br>Revision: ${esc(data.revision)}<br>Source fingerprint: ${esc(s.sourceHash)}</p></section></div></article>`;
    }
    return `<div class="source-reader-toolbar">${selector}${button('refresh',loading?'Loading…':notConnected?'Check connection':'Refresh',loading||!!pending)}${teaAction}${s?button('translate','Prepare English proposals',loading||!!pending||generationDirty(p,s)||translationReviews.get(reviewKey(p,s))?.state==='busy'):''}</div>${!s?lookupHTML(p):''}${lookupFor(p).back?button('lookup-back','Back to previous reading',!!pending):''}<p data-source-reader-status role="status">${esc(loadError||r.message||(!loaded?'Loading kept conversations…':!data.sessions.length?'No kept conversations are connected yet. Existing source records remain available below.':!s?'Choose a conversation from the shared Library. No conversation has been linked to this project here.':''))}</p>${pending?`<p class="source-reader-conflict">${pending.held?'The request has not been sent. Browser recovery could not be verified; keep this page open.':pending.uncertain?'The response was interrupted. Retry the same request to find out whether it was saved.':'Saving correction…'}</p>${pending.uncertain?button('retry','Retry same request',storageBlocked||reconciling):''}`:''}${body}`;
  }
  function paint() {
    const p=active(); if(!p||!panel?.isConnected||panel.dataset.sourceReaderProject!==p.id)return;
    const r=room(p); if(loaded&&r.sessionId&&!data.sessions.some(s=>s.id===r.sessionId))r.message='The selected conversation is unavailable. Your local wording is preserved; choose a shared Library conversation explicitly.';
    if(!r.turnId){const s=selected(p);const key=s&&Object.keys(drafts).find(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}});if(key)r.turnId=JSON.parse(key)[2];}
    const scroll=panel.querySelector('[data-source-reader-dialogue]')?.scrollTop||0,notesOpen=!!panel.querySelector('.source-reader-notes-sheet')?.open;
    languageReview.close();panel.innerHTML=html(p);const notesSheet=panel.querySelector('.source-reader-notes-sheet');if(notesSheet)notesSheet.open=notesOpen&&!lookupFor(p).open;paintReview(true);panel.classList.toggle('source-reader-show-timing',showTiming);
    const s=selected(p),interpretation=!!s&&detectInterpretation(s),originalShown=showOriginal??interpretation;panel.classList.toggle('source-reader-paired',interpretation&&originalShown);
    let changed=0;const languageNodes=[];
    const turnsById=new Map((s?.turns||[]).map(t=>[t.id,t]));
    if(s) for(const node of panel.querySelectorAll('[data-source-reader-turn]')) {
      const t=turnsById.get(node.dataset.sourceReaderTurn); if(!t)continue;languageNodes.push([node,t]);const local=drafts[draftKey(p,s,t)];node.textContent=local?local.text:t.text;if(local)node.dataset.sourceReaderUnsaved='true';
      node.tabIndex=0;node.setAttribute('role','textbox');node.setAttribute('aria-multiline','true');node.setAttribute('aria-label','Conversation remark');node.setAttribute('contenteditable',correctionsAllowed()&&!r.pending?'plaintext-only':'false');node.setAttribute('aria-readonly',String(!correctionsAllowed()||!!r.pending));
      if(!isSourceBoundary(t) && t.originalText!==undefined && t.originalText!==t.text){const original=doc.createElement('p'),pair=pairingInfo(t);original.className='source-reader-original';original.hidden=!originalShown;original.dataset.sourceReaderOriginalFor=t.id;original.innerHTML=`<span class="source-reader-original-l">Original ${pair.sourceLanguage==='zh'?'Chinese':pair.sourceLanguage==='en'?'English':'wording'}</span> ${esc(pair.originalText)}`;if(interpretation){const wrapper=doc.createElement('span');wrapper.className='source-reader-pair';wrapper.dataset.sourceReaderPair=t.id;wrapper.dataset.sourceReaderPairKind=pair.sourceLanguage==='en'?'edited':'translated';wrapper.title=pair.sourceLanguage==='en'?'Original English and saved edited wording for the same turn':'Original speech and current translated wording for the same turn';node.before(wrapper);wrapper.append(original,node);}else node.after(original);changed++;}
      if(r.turnId===t.id&&local){inlineNode(node,p,s,t);const host=doc.createElement('div');host.className='source-reader-inline-tools';host.innerHTML=editor(p,s,t);panel.append(host);}
      if(r.navigation?.sourceHash===s.sourceHash && r.navigation.ids[r.navigation.index]===t.id)node.setAttribute('data-source-reader-highlight','true');
    }
    for(const label of panel.querySelectorAll('[data-source-reader-speaker-turn]'))label.disabled=!correctionsAllowed()||!!r.pending;
    const dialogue=panel.querySelector('[data-source-reader-dialogue]');if(dialogue)dialogue.scrollTop=scroll;
    if(changed&&dialogue){const toggle=doc.createElement('button');toggle.type='button';toggle.className='source-reader-original-toggle';toggle.dataset.sourceOriginalToggle='';toggle.setAttribute('aria-pressed',String(originalShown));toggle.textContent=interpretation?(originalShown?'Read English wording':'Show originals'):(originalShown?'Hide':'Show')+` original wording · ${changed} corrected line${changed===1?'':'s'}`;toggle.title='The current wording includes saved corrections. Viewing never changes the source.';const toolbar=panel.querySelector('.source-reader-toolbar'),tea=toolbar?.querySelector('[data-source-tea-link]');if(tea)tea.before(toggle);else if(toolbar)toolbar.append(toggle);else dialogue.before(toggle);if(interpretation&&originalShown){const legend=doc.createElement('div');legend.className='source-reader-pair-legend';legend.innerHTML='<span>Original speech</span><span>Translation / current wording</span>';const title=panel.querySelector('.source-reader-title');title?.append(legend);}}
    if(s&&!panel.querySelector('.source-reader-inline-tools'))syncTools(p,s,null);
    placeReview();mountSelectedLanguage(p,s,languageNodes);compactLegacy();for(const sheet of panel.querySelectorAll('.source-reader-secondary>details,.source-reader>.source-reader-lookup-sheet'))sheet.setAttribute('name','source-reader-sheet');if(lookupFor(p).open)ownSourceSheet(p,panel.querySelector('.source-reader-lookup-sheet'));
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
      if(!fallback){fallback=doc.createElement('section');fallback.dataset.sourceReaderLegacy='';fallback.className='source-reader-legacy';const summary=doc.createElement('h3');summary.textContent='Other connected source records';fallback.append(summary);target.append(fallback);}
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
    }catch(e){loadError=e.message||'Kept conversations could not be loaded.';}finally{loading=false;mount();if(!hadView||hadError||previous!==JSON.stringify(data)||loadError)paint();else{paintReview(true);const p=active(),editable=!!p&&correctionsAllowed()&&!room(p).pending;for(const node of panel?.querySelectorAll('[data-source-reader-turn]')||[]){node.setAttribute('contenteditable',editable?'plaintext-only':'false');node.setAttribute('aria-readonly',String(!editable));}}syncReaderAvailability();if(!loadError)void pickupSavedReview();}
  }
  async function selectSource({sourceId,expectedSourceHash,expectedVersion}={}){const p=active(),intent=++navigationEpoch;if(!p||room(p).pending||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(sourceId||''))throw Error('Choose one existing transcript source in the Source reader.');await(refreshJob||refresh());if(refreshJob)await refreshJob;if(disposed||active()!==p||intent!==navigationEpoch||room(p).pending||loadError||!loaded)throw Error(loadError||'The selected Source context changed. Open the transcript again.');const matches=data.sessions.filter(s=>s.sourceId===sourceId);if(matches.length!==1)throw Error('The exact transcript source is missing or ambiguous. No alternative was selected.');const s=matches[0];if(expectedSourceHash!==undefined&&s.sourceHash!==expectedSourceHash||expectedVersion!==undefined&&s.version!==expectedVersion)throw Error('This transcript changed. Refresh the catalog before opening its current version.');const r=room(p);r.sessionId=s.id;r.turnId='';r.navigation=null;r.message='';saveLocal();paint();void pickupSavedReview();return {sessionId:s.id,sourceId:s.sourceId,sourceHash:s.sourceHash,version:s.version};}
  function correctionsAllowed(){return !(win.AR_CREATE_REVIEW_MODE?.actualWork===true&&win.AR_CREATE_REVIEW_MODE.sourceCorrections!==true);}
  function syncTools(p,s,t){
    let host=panel.querySelector('.source-reader-inline-tools');
    const d=t&&drafts[draftKey(p,s,t)];
    const recovery=null,footer=panel?.querySelector('.source-reader-secondary'),archive=s?recoveryHTML(p,s):'';
    if(footer&&footer.recoveryHTML!==archive){footer.querySelector(':scope>[data-source-reader-recovery]')?.remove();if(archive)footer.insertAdjacentHTML('beforeend',archive);footer.recoveryHTML=archive;}
    if(!d&&!recovery){if(host)host.hidden=true;return;}
    if(!host){host=doc.createElement('div');host.className='source-reader-inline-tools';panel.append(host);}
    host.hidden=false;host.innerHTML=(d?editor(p,s,t):'')+(recovery||'');
  }
  function selectCaret(p,id){
    const s=selected(p),t=s?.turns.find(t=>t.id===id),r=room(p);if(!t||r.pending||!correctionsAllowed())return;
    // All current remarks are already editable. Selection never replaces words,
    // changes contenteditable, forces focus, creates a draft or writes browser storage.
    const node=[...panel.querySelectorAll('[data-source-reader-turn]')].find(n=>n.dataset.sourceReaderTurn===id);if(!node)return;if(r.turnId===id&&node.dataset.sourceReaderField==='text')return;
    for(const previous of panel.querySelectorAll('[data-source-reader-field="text"]'))if(previous!==node)delete previous.dataset.sourceReaderField;
    if(lookupFor(p).busy)navigationEpoch++;node.dataset.sourceReaderField='text';r.turnId=id;
    syncTools(p,s,t);if(drafts[draftKey(p,s,t)])saveLocal();
  }
  function ensureDraft(p,s,t){
    const key=draftKey(p,s,t);
    drafts[key] ||= {sourceId:s.sourceId,baseRevision:data.revision,baseSourceHash:s.sourceHash,speaker:t.speaker||'',text:t.text,baseSpeaker:t.speaker||'',baseText:t.text};
    navigationEpoch++;translationBatches.delete(s.id);room(p).turnId=t.id;
    const node=[...panel.querySelectorAll('[data-source-reader-turn]')].find(n=>n.dataset.sourceReaderTurn===t.id);if(node)node.dataset.sourceReaderUnsaved='true';
    const tea=panel.querySelector('[data-source-tea-link]');if(tea){tea.style.visibility='hidden';tea.removeAttribute('href');tea.removeAttribute('data-source-tea-link');tea.setAttribute('aria-disabled','true');}
    return drafts[key];
  }
  async function submit(p,kind) {
    const r=room(p),s=selected(p);if(reconciling||storageBlocked||!s||r.pending||!loaded)return;
    let body, key;
    if(kind==='edit'){
      const t=s.turns.find(t=>t.id===r.turnId);if(!t)return;key=draftKey(p,s,t);const d=drafts[key];
      if(!d||stale(d,s)||!d.text.trim())return;
      body={operationId:makeId(),expectedRevision:d.baseRevision,expectedSourceHash:d.baseSourceHash,sessionId:s.id,turnId:t.id,speaker:d.speaker,text:d.text};
    }else{
      if(!s.undoOperationId||Object.keys(drafts).some(k=>{try{const v=JSON.parse(k);return v[0]===p.id&&v[1]===s.id;}catch{return false;}}))return;
      body={operationId:makeId(),undoOperationId:s.undoOperationId,expectedRevision:data.revision,expectedSourceHash:s.sourceHash,sessionId:s.id};
    }
    r.pending={kind,body,key,uncertain:false};r.message='';if(!saveLocal()){r.pending.held=true;paint();return;}return send(p);
  }
  async function send(p) {
    const r=room(p),pending=r.pending;if(reconciling||storageBlocked||!pending||pending.sending)return;pending.sending=true;pending.uncertain=false;pending.held=false;if(!saveLocal()){pending.sending=false;pending.held=true;paint();return;}paint();
    try{
      const response=await request(`/api/source-sessions/${pending.kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending.body)});
      if(response.status===409){if(pending.translation)translationReviews.set(JSON.stringify([p.id,pending.body.sessionId]),{state:'stale',message:'The source changed. Proposed English was not saved; local wording is preserved. Prepare the current conversation again.'});if(pending.key&&drafts[pending.key])drafts[pending.key].conflict=true;r.pending=null;r.message='This conversation changed. Your unsaved wording is preserved. Compare it with the current wording before continuing.';await refresh();return;}
      if(!response.ok){if(response.status>=500)throw Error('The response was interrupted.');r.pending=null;r.message='The correction was refused. Your unsaved wording is preserved.';return;}
      await response.json(); // Receipt is historical; never replace current state from it.
      if(pending.translation){const key=JSON.stringify([p.id,pending.body.sessionId]);translationReviews.set(key,{...translationReviews.get(key),state:'stale',message:'Selected-remark request confirmed. Current saved wording is shown; other proposals were not accepted.'});}if(pending.key)delete drafts[pending.key];r.pending=null;r.turnId='';r.message=pending.kind==='undo'?'Last correction undone.':'Correction saved. Notes may need review.';
      await refresh();
    }catch {pending.uncertain=true;r.message='Your wording and complete request are kept on this device.';}
    finally{pending.sending=false;saveLocal();paint();}
  }
  function follow(p,key,index) {
    if(lookupFor(p).busy)navigationEpoch++;
    const s=selected(p),ids=s?resolveNoteAnchors(s,data.notes,key,index):[];
    if(!ids.length){room(p).message='This note has no current exact supporting passage.';paint();return;}
    room(p).navigation={sourceHash:s.sourceHash,ids,index:0};saveLocal();paint();scrollPassage();
  }
  function scrollPassage(){const n=panel?.querySelector('[data-source-reader-highlight]');n?.scrollIntoView?.({block:'center',behavior:'instant'});n?.focus({preventScroll:true});}
  function onClick(event) {
    if(event.target.closest?.('[data-source-original-toggle]')){const p=active(),s=p&&selected(p);showOriginal=!(showOriginal??(!!s&&detectInterpretation(s)));paint();return;}
    if(!event.target.closest?.('[data-source-reader]'))return;
    const p=active();if(!p||panel?.dataset.sourceReaderProject!==p.id)return;
    const speaker=event.target.closest('[data-source-reader-speaker-turn]');
    if(speaker){event.preventDefault();const s=selected(p),r=room(p),t=s?.turns.find(turn=>turn.id===speaker.dataset.sourceReaderSpeakerTurn);if(!speaker.disabled&&s?.id===speaker.dataset.sourceReaderSpeakerSession&&t&&!isSourceBoundary(t)&&correctionsAllowed()&&!r.pending){ensureDraft(p,s,t);saveLocal();syncTools(p,s,t);const details=panel.querySelector('.source-reader-speaker-edit');if(details)details.open=true;panel.querySelector('[data-source-reader-field="speaker"]')?.focus({preventScroll:true});}return;}
    const summary=event.target.closest('summary'),sheet=summary?.parentElement;if(sheet&&!sheet.open)ownSourceSheet(p,sheet);
    const r=room(p),note=event.target.closest('[data-source-reader-note-section]'),action=event.target.closest('[data-source-reader-action]')?.dataset.sourceReaderAction;
    const lookupResult=event.target.closest('[data-source-reader-lookup-result]');if(lookupResult){event.preventDefault();void openLookup(p,Number(lookupResult.dataset.sourceReaderLookupResult));return;}
    if(note){event.preventDefault();follow(p,note.dataset.sourceReaderNoteSection,Number(note.dataset.sourceReaderNoteIndex));return;}
    if(action){event.preventDefault();if(action==='lookup-back')return backFromLookup(p);if(action==='review-translation'){const s=selected(p),review=s&&translationReviews.get(reviewKey(p,s));if(review)review.deferPlacement=false;const tools=event.target.closest('.source-reader-tools-sheet');if(tools)tools.open=false;placeReview();panel.querySelector('.source-reader-proposal-target')?.scrollIntoView?.({block:'center'});return;}if(action==='proposal-next')return stepProposal(1);if(action==='proposal-previous')return stepProposal(-1);if(action==='history'){const details=panel.querySelector('.source-reader-history');if(details){details.open=!details.open;details.querySelector('summary')?.focus({preventScroll:true});details.scrollIntoView?.({block:'nearest'});}return;}if(action==='translate')return generateTranslation(p);if(action==='accept-translation')return acceptTranslation(p);if(action==='keep-saved')return keepSaved(p);if(action==='speaker'){const s=selected(p),t=s?.turns.find(t=>t.id===r.turnId);if(t&&correctionsAllowed()&&!r.pending){ensureDraft(p,s,t);saveLocal();syncTools(p,s,t);const details=panel.querySelector('.source-reader-speaker-edit');if(details)details.open=true;panel.querySelector('[data-source-reader-field="speaker"]')?.focus({preventScroll:true});}return;}if(action==='timing'){showTiming=!showTiming;paint();return;}if(action==='refresh')return refresh();if(action==='save')return submit(p,'edit');if(action==='undo')return submit(p,'undo');if(action==='retry')return send(p);
      if(action==='cancel'){const s=selected(p),t=s?.turns.find(t=>t.id===r.turnId);if(t&&!r.pending)delete drafts[draftKey(p,s,t)];r.turnId='';saveLocal();paint();}
      if(action==='notes'){if(lookupFor(p).busy)navigationEpoch++;r.navigation=null;saveLocal();paint();const details=panel.querySelector('.source-reader-notes-sheet');if(details)details.open=true;panel.querySelector('[data-source-reader-notes]')?.focus();panel.querySelector('[data-source-reader-notes]')?.scrollIntoView?.({block:'start'});}
      if(action==='previous'||action==='next'){if(lookupFor(p).busy)navigationEpoch++;const s=selected(p),n=r.navigation;if(n?.sourceHash===s?.sourceHash){n.index=Math.max(0,Math.min(n.ids.length-1,n.index+(action==='next'?1:-1)));saveLocal();paint();scrollPassage();}}
      return;
    }
    const turn=event.target.closest('[data-source-reader-turn]');if(turn)selectCaret(p,turn.dataset.sourceReaderTurn);
  }
  function onLookupToggle(event){const sheet=event.target;if(!sheet.matches?.('.source-reader-secondary>details,.source-reader>.source-reader-lookup-sheet')||!panel?.contains(sheet))return;const p=active();if(!p)return;const q=lookupFor(p);if(sheet.open)ownSourceSheet(p,sheet);else if(sheet.matches('.source-reader-lookup-sheet')){if(q.busy)navigationEpoch++;q.open=false;if(!q.back)q.notesBeforeLookup=null;}}
  function onFocusIn(event){const node=event.target.closest?.('[data-source-reader-turn]'),p=active();if(node&&p&&panel?.contains(node))selectCaret(p,node.dataset.sourceReaderTurn);}
  function onInput(event) {
    if(event.target.matches?.('[data-source-reader-lookup-query]')){const p=active();if(p)lookupFor(p).query=event.target.value;return;}
    const field=event.target.dataset?.sourceReaderField|| (event.target.matches?.('[data-source-reader-turn]')?'text':null);if(!field||!['speaker','text'].includes(field))return;
    const p=active(),s=p&&selected(p),r=p&&room(p),id=field==='text'?event.target.dataset.sourceReaderTurn:r?.turnId,t=s?.turns.find(t=>t.id===id);if(!t||r.pending||!correctionsAllowed())return;
    if(field==='text')selectCaret(p,t.id);
    const d=ensureDraft(p,s,t);d[field]=field==='text'?editableWords(event.target):event.target.value;saveLocal();
    // Tool state changes only after an actual edit, outside the speech flow.
    if(field==='text')syncTools(p,s,t);paintReview(true);
    const b=panel.querySelector('[data-source-reader-action="save"]');if(b)b.disabled=reconciling||storageBlocked||stale(d,s)||!d.text.trim();
  }
  function onChange(event){if(event.target.matches?.('[data-source-translation-select]')){const p=active(),s=p&&selected(p),review=s&&translationReviews.get(reviewKey(p,s));if(review){review.deferPlacement=false;review.selectedTurnId=event.target.value;paintReview();panel.querySelector('.source-reader-proposal-target')?.scrollIntoView?.({block:'center'});}return;}if(!event.target.matches?.('[data-source-reader-select]'))return;const p=active();if(!p||room(p).pending)return;navigationEpoch++;const r=room(p);r.sessionId=event.target.value;r.turnId='';r.navigation=null;r.message='';saveLocal();paint();void pickupSavedReview();}
  function onSubmit(event){if(event.target.matches?.('[data-source-reader-lookup-form]')){event.preventDefault();const p=active();if(p)searchPassages(p,event.target.querySelector('[data-source-reader-lookup-query]').value);return;}if(event.target.matches?.('[data-source-reader-edit]')){event.preventDefault();const p=active();if(p)submit(p,'edit');}}
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
  doc.addEventListener('toggle',onLookupToggle,true);
  mount();
  return {openContext({container,project}){if(!container?.isConnected||!project?.id)throw Error('Choose an existing project and context mount.');contextView={container,project:{...project,view:'record',viewedStage:2}};stamp='';mount();},closeContext(){contextView=null;stamp='';mount();},mount,refresh,selectSource,getTranslationBatch(){const p=active(),s=p&&selected(p);if(!s||loading||loadError)throw Error('Refresh the conversation before preparing translation.');if(room(p).pending||Object.keys(drafts).some(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}}))throw Error('Save or cancel local corrections before preparing translation.');const batch=translationBatches.get(s.id);if(!batch)throw Error('Conversation translation preparation is unavailable.');return structuredClone(batch);},sourceLanguageReview:languageReview,getState:()=>({data,projects,drafts,storageBlocked,externalRecovery}),dispose(){languageReview.close();disposed=true;doc.removeEventListener('toggle',onLookupToggle,true);liveOff?.();observer?.disconnect();for(const [name,fn] of [['focusin',onFocusIn],['click',onClick],['input',onInput],['change',onChange],['submit',onSubmit]])doc.removeEventListener(name,fn);panel?.remove();restoreLegacy();}};
}
if(typeof document!=='undefined'&&typeof current==='function'&&!window.studyImportedSource){window.studyImportedSource=installSourceReader({document,getProject:()=>current()});}
