/* The kept conversation reader is a projection; source sessions remain server-owned. */
import {renderConversationNotes, resolveNoteAnchors, renderSourceGroups} from './source-dialogue.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE = 'ar-create:source-reader:v1';
const button = (action, text, disabled=false) => `<button type="button" data-source-reader-action="${action}"${disabled?' disabled':''}>${text}</button>`;
const namespaced = html => html.replace(/data-note-/g, 'data-source-reader-note-').replace(/data-source-session=/g, 'data-source-reader-session=').replace(/data-source-turn=/g, 'data-source-reader-turn=');
export function installSourceReader({document:doc, window:win=doc.defaultView, getProject, fetch:request=win.fetch.bind(win), storage=win.localStorage, makeId=()=>win.crypto.randomUUID(), observe=true}={}) {
  let stored;
  try { stored=JSON.parse(storage.getItem(STORAGE)||'{}'); } catch { stored={}; }
  const projects=stored.projects && typeof stored.projects==='object'?stored.projects:{};
  const drafts=stored.drafts && typeof stored.drafts==='object'?stored.drafts:{};
  const contextualCopy=new Map();
  let contextView=null, showOriginal=false;
  let data={revision:null,sessions:[],notes:{}}, loaded=false, loading=false, loadError='', disposed=false, panel=null, stamp='', refreshQueued=false;
  const active = () => { const p=contextView?.project||getProject(); return p?.view==='record' && Number(p.viewedStage)===2 ? p:null; };
  const room = p => projects[p.id] ||= {sessionId:'',turnId:'',navigation:null,pending:null,message:''};
  const draftKey = (p,s,t) => JSON.stringify([p.id,s.id,t.id]);
  const selected = p => data.sessions.find(s=>s.id===room(p).sessionId);
  const saveLocal = () => {try {storage.setItem(STORAGE,JSON.stringify({projects,drafts}));} catch {if(panel){const n=panel.querySelector('[data-source-reader-status]');if(n)n.textContent='Browser storage is unavailable. Keep this page open to retain unsaved wording.';}}};
  function stale(d,s) {return d && (d.conflict || d.baseRevision!==data.revision || d.baseSourceHash!==s.sourceHash);}
  function editor(p,s,t) {
    const d=drafts[draftKey(p,s,t)]; if(!d)return '';
    const old=stale(d,s), pending=!!room(p).pending;
    return `<form data-source-reader-edit="${esc(t.id)}"><label>Speaker<input data-source-reader-field="speaker" value="${esc(d.speaker)}"${pending?' disabled':''}></label><label>Wording<textarea data-source-reader-field="text" rows="4"${pending?' disabled':''}>${esc(d.text)}</textarea></label>${old?`<p class="source-reader-conflict" role="alert">This conversation changed. Your unsaved wording is kept below; saving is blocked until you resolve it.</p><details><summary>Compare saved and unsaved wording</summary><p>Saved now: ${esc(t.speaker)} — ${esc(t.text)}</p><p>Your edit: ${esc(d.speaker)} — ${esc(d.text)}</p><p>Started at revision ${esc(d.baseRevision)} / ${esc(d.baseSourceHash)}. Current revision ${esc(data.revision)} / ${esc(s.sourceHash)}.</p></details>`:''}<div class="source-reader-actions">${button('save','Save correction',pending||old||!d.text.trim())}${button('cancel',old?'Discard my unsaved edit':'Cancel',pending)}</div><p class="small">${old?'Discard only when you have kept any wording you still need.':'Unsaved wording stays on this device until saved or cancelled.'}</p></form>`;
  }
  function html(p) {
    const r=room(p),s=selected(p),nav=r.navigation, pending=r.pending;
    const selector=data.sessions.length?`<label class="source-reader-selector">Kept conversations<select data-source-reader-select${pending?' disabled':''}>${data.sessions.map(x=>`<option value="${esc(x.id)}"${x.id===s?.id?' selected':''}>${esc(x.title||'Untitled conversation')}${x.date?' · '+esc(x.date):''}</option>`).join('')}</select></label>`:'';
    let body='';
    if(s) {
      const notes=namespaced(renderConversationNotes(s,data.notes));
      const validNav=nav && nav.sourceHash===s.sourceHash && nav.ids.every(id=>s.turns.some(t=>t.id===id));
      body=`<article><header class="source-reader-title"><h3>${esc(s.title||'Untitled conversation')}</h3><span class="small">${[s.date,s.location].filter(Boolean).map(esc).join(' · ')}</span></header><div data-source-reader-notes tabindex="-1">${notes||'<p class="small">No reviewed notes are connected to this conversation.</p>'}</div>${validNav?`<nav class="source-reader-actions" aria-label="Supporting passages">${button('previous','Previous',nav.index===0)}<span>${nav.index+1} of ${nav.ids.length}</span>${button('next','Next',nav.index>=nav.ids.length-1)}${button('notes','Back to notes')}</nav>`:nav?'<p class="source-reader-conflict">The supporting passage belongs to earlier wording. Review the notes before following it.</p>':''}<div data-source-reader-dialogue>${namespaced(renderSourceGroups(s))}</div>${s.undoOperationId?`<div class="source-reader-actions">${button('undo','Undo last correction',!!pending||Object.keys(drafts).some(k=>{try {const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}}))}</div>`:''}<details class="source-reader-details"><summary>Source & versions</summary><p>Version ${esc(s.version??'unspecified')}. Original source and earlier wording are preserved.</p><p>Source: ${esc(s.sourceId)}<br>Revision: ${esc(data.revision)}<br>Source fingerprint: ${esc(s.sourceHash)}</p></details></article>`;
    }
    return `<div class="source-reader-toolbar">${selector}${button('refresh',loading?'Loading…':'Refresh',loading||!!pending)}</div><p data-source-reader-status role="status">${esc(loadError||r.message||(!loaded?'Loading kept conversations…':!data.sessions.length?'No kept conversations are connected yet. Existing source records remain available below.':''))}</p>${pending?`<p class="source-reader-conflict">${pending.uncertain?'The response was interrupted. Retry the same request to find out whether it was saved.':'Saving correction…'}</p>${pending.uncertain?button('retry','Retry same request'):''}`:''}${body}`;
  }
  function paint() {
    const p=active(); if(!p||!panel?.isConnected||panel.dataset.sourceReaderProject!==p.id)return;
    const r=room(p); if(loaded&&!data.sessions.some(s=>s.id===r.sessionId)){r.sessionId=data.sessions[0]?.id||'';r.turnId='';r.navigation=null;saveLocal();}
    if(!r.turnId){const s=selected(p);const key=s&&Object.keys(drafts).find(k=>{try{const ids=JSON.parse(k);return ids[0]===p.id&&ids[1]===s.id;}catch{return false;}});if(key)r.turnId=JSON.parse(key)[2];}
    const scroll=panel.querySelector('[data-source-reader-dialogue]')?.scrollTop||0;
    panel.innerHTML=html(p);
    const s=selected(p);
    let changed=0;
    if(s) for(const node of panel.querySelectorAll('[data-source-reader-turn]')) {
      const t=s.turns.find(x=>x.id===node.dataset.sourceReaderTurn); if(!t)continue;
      node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',`Correct remark: ${t.text}`);
      if(t.originalText!==undefined && t.originalText!==t.text){const original=doc.createElement('p');original.className='source-reader-original';original.hidden=!showOriginal;original.innerHTML=`<span class="source-reader-original-l">Original wording</span> ${esc(t.originalText)}`;node.after(original);changed++;}
      if(r.turnId===t.id){const host=doc.createElement('div');host.innerHTML=editor(p,s,t);node.after(host);}
      if(r.navigation?.sourceHash===s.sourceHash && r.navigation.ids[r.navigation.index]===t.id)node.setAttribute('data-source-reader-highlight','true');
    }
    const dialogue=panel.querySelector('[data-source-reader-dialogue]');if(dialogue)dialogue.scrollTop=scroll;
    if(changed&&dialogue){const toggle=doc.createElement('button');toggle.type='button';toggle.className='source-reader-original-toggle';toggle.dataset.sourceOriginalToggle='';toggle.setAttribute('aria-pressed',String(showOriginal));toggle.textContent=(showOriginal?'Hide':'Show')+` original wording · ${changed} corrected line${changed===1?'':'s'}`;dialogue.before(toggle);}
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
  async function refresh() {
    if(disposed)return;if(loading){refreshQueued=true;return;}loading=true;loadError='';paint();
    try {
      const response=await request('/api/source-sessions',{headers:{Accept:'application/json'},cache:'no-store'});
      if(!response.ok)throw Error('Kept conversations could not be loaded. Try Refresh.');
      const next=await response.json();
      if(next.revision===undefined||!Array.isArray(next.sessions)||next.sessions.some(s=>!s.id||!s.sourceHash||!Array.isArray(s.turns)))throw Error('Kept conversation data is incomplete. Try Refresh.');
      data=next;data.notes ||= {};loaded=true;
    }catch(e){loadError=e.message||'Kept conversations could not be loaded.';}finally{loading=false;mount();paint();if(refreshQueued){refreshQueued=false;void refresh();}}
  }
  function startEdit(p,id) {
    const s=selected(p),t=s?.turns.find(t=>t.id===id);if(!t||room(p).pending)return;
    const key=draftKey(p,s,t);
    drafts[key] ||= {baseRevision:data.revision,baseSourceHash:s.sourceHash,speaker:t.speaker||'',text:t.text,baseSpeaker:t.speaker||'',baseText:t.text};
    room(p).turnId=id;saveLocal();paint();panel.querySelector('[data-source-reader-field="text"]')?.focus();
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
      if(response.status===409){if(pending.key&&drafts[pending.key])drafts[pending.key].conflict=true;r.pending=null;r.message='This conversation changed. Your unsaved wording is preserved. Compare it with the current wording before continuing.';await refresh();return;}
      if(!response.ok){if(response.status>=500)throw Error('The response was interrupted.');r.pending=null;r.message='The correction was refused. Your unsaved wording is preserved.';return;}
      await response.json(); // Receipt is historical; never replace current state from it.
      if(pending.key)delete drafts[pending.key];r.pending=null;r.turnId='';r.message=pending.kind==='undo'?'Last correction undone.':'Correction saved. Notes may need review.';
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
    if(event.target.closest?.('[data-source-original-toggle]')){showOriginal=!showOriginal;paint();return;}
    if(!event.target.closest?.('[data-source-reader]'))return;
    const p=active();if(!p||panel?.dataset.sourceReaderProject!==p.id)return;
    const r=room(p),note=event.target.closest('[data-source-reader-note-section]'),action=event.target.closest('[data-source-reader-action]')?.dataset.sourceReaderAction;
    if(note){event.preventDefault();follow(p,note.dataset.sourceReaderNoteSection,Number(note.dataset.sourceReaderNoteIndex));return;}
    if(action){event.preventDefault();if(action==='refresh')return refresh();if(action==='save')return submit(p,'edit');if(action==='undo')return submit(p,'undo');if(action==='retry')return send(p);
      if(action==='cancel'){const s=selected(p),t=s?.turns.find(t=>t.id===r.turnId);if(t&&!r.pending)delete drafts[draftKey(p,s,t)];r.turnId='';saveLocal();paint();}
      if(action==='notes'){r.navigation=null;saveLocal();paint();panel.querySelector('[data-source-reader-notes]')?.focus();panel.querySelector('[data-source-reader-notes]')?.scrollIntoView?.({block:'start'});}
      if(action==='previous'||action==='next'){const s=selected(p),n=r.navigation;if(n?.sourceHash===s?.sourceHash){n.index=Math.max(0,Math.min(n.ids.length-1,n.index+(action==='next'?1:-1)));saveLocal();paint();scrollPassage();}}
      return;
    }
    const turn=event.target.closest('[data-source-reader-turn]');if(turn){event.preventDefault();startEdit(p,turn.dataset.sourceReaderTurn);}
  }
  function onInput(event) {
    const field=event.target.dataset?.sourceReaderField;if(!field||!['speaker','text'].includes(field))return;
    const p=active(),s=p&&selected(p),r=p&&room(p),t=s?.turns.find(t=>t.id===r.turnId);if(!t||r.pending)return;
    const d=drafts[draftKey(p,s,t)];if(d){d[field]=event.target.value;saveLocal();const b=panel.querySelector('[data-source-reader-action="save"]');if(b)b.disabled=stale(d,s)||!d.text.trim();}
  }
  function onChange(event){if(!event.target.matches?.('[data-source-reader-select]'))return;const p=active();if(!p||room(p).pending)return;const r=room(p);r.sessionId=event.target.value;r.turnId='';r.navigation=null;r.message='';saveLocal();paint();}
  function onKey(event){if((event.key==='Enter'||event.key===' ')&&event.target.matches?.('[data-source-reader-turn]')){event.preventDefault();const p=active();if(p)startEdit(p,event.target.dataset.sourceReaderTurn);}}
  function onSubmit(event){if(event.target.matches?.('[data-source-reader-edit]')){event.preventDefault();const p=active();if(p)submit(p,'edit');}}
  function restoreLegacy(){restoreContextualCopy();doc.querySelectorAll('[data-source-reader-legacy]').forEach(n=>{const parent=n.parentNode;for(const child of [...n.childNodes])if(child.tagName!=='SUMMARY')parent.insertBefore(child,n);n.remove();});}
  function mount(){
    if(disposed)return;const p=active(),lane=p&&doc.getElementById('stage-working-lane'),surface=lane?.querySelector('.material-surface'),heading=surface?.querySelector(':scope > .material-heading'),target=contextView?.container||(heading?surface:(lane?.querySelector('.material-reading')||lane));
    const place=()=>{if(heading&&!contextView){if(panel.previousElementSibling!==heading)heading.after(panel);}else if(panel.parentElement!==target)target.prepend(panel);};
    if(!p||!target){if(panel?.isConnected)panel.remove();panel=null;stamp='';restoreLegacy();return;}
    const next=String(p.id);
    if(panel?.isConnected&&stamp===next){place();return;}
    restoreContextualCopy();panel?.remove();panel=doc.createElement('section');panel.dataset.sourceReader='';panel.dataset.sourceReaderProject=p.id;panel.className='source-reader';panel.setAttribute('aria-label','Kept conversation reader');place();stamp=next;paint();if(!loaded&&!loading)void refresh();
  }
  doc.addEventListener('click',onClick);doc.addEventListener('input',onInput);doc.addEventListener('change',onChange);doc.addEventListener('keydown',onKey);doc.addEventListener('submit',onSubmit);
  const observer=observe?new win.MutationObserver(()=>mount()):null;observer?.observe(doc.getElementById('app')||doc.body,{childList:true,subtree:true});
  // Live sync (review F-25): a correction saved elsewhere re-reads the open transcript; refresh-on-focus is only the fallback
  // for when the live stream is down.
  function focus(){if(win.c3Shell?.live?.connected?.())return;if(active())void refresh();}win.addEventListener('focus',focus);
  let liveOff=null,liveTimer=null;const liveHook=()=>{liveOff=win.c3Shell?.live?.on?.({},event=>{if(disposed||!active())return;if(!event.reset&&!(event.scope?.kind==='source'||/^source-sessions/.test(event.kind||'')))return;win.clearTimeout(liveTimer);liveTimer=win.setTimeout(()=>{if(!disposed&&active())void refresh();},250);})||null;};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',liveHook,{once:true});else win.setTimeout(liveHook,0);
  // In-flight transport does not survive reload; preserve its exact idempotent request.
  for(const r of Object.values(projects))if(r.pending){r.pending.sending=false;r.pending.uncertain=true;}
  mount();
  return {openContext({container,project}){if(!container?.isConnected||!project?.id)throw Error('Choose an existing project and context mount.');contextView={container,project:{...project,view:'record',viewedStage:2}};stamp='';mount();},closeContext(){contextView=null;stamp='';mount();},mount,refresh,getState:()=>({data,projects,drafts}),dispose(){disposed=true;liveOff?.();observer?.disconnect();for(const [name,fn] of [['click',onClick],['input',onInput],['change',onChange],['keydown',onKey],['submit',onSubmit]])doc.removeEventListener(name,fn);win.removeEventListener('focus',focus);panel?.remove();restoreLegacy();}};
}
if(typeof document!=='undefined'&&typeof current==='function'&&!window.studyImportedSource){window.studyImportedSource=installSourceReader({document,getProject:()=>current()});}
