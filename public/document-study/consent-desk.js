/* The truth and consent desk (How I Work, step 6), shown in two places over one record per piece:
   - Check: every claim and quote with the source moment it rests on, unsourced and doubtful ones called out,
     and every person with how they appear and where their consent stands.
   - Share: the two questions (comfortable, accurate), the release hold while anyone is unanswered, Adrian's
     consent answers, the override with a reason, and the final yes.
   Reads and writes go through /api/consent/* (the same commands agents call). The page acts as its own actor
   (reviewActor); for anyone but Adrian, his decisions are shown, never offered. Nothing here sends a message. */
(()=>{
 if(window.arConsentDesk)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const actor=()=>window.arCreateUiActor?.actor||'human:adrian';
 const isAdrian=()=>actor()==='human:adrian';
 const project=()=>{try{return current()?.id||null;}catch{return null;}};
 const stage=()=>{try{const p=current();return p?.view==='record'?Number(p.viewedStage)||0:0;}catch{return 0;}};
 // One desk per project's working piece. Agents use the same key: pieceKey "main" (the default).
 const scopeFor=id=>({parentStudyId:id,pieceKey:'main'});
 const rooms=new Map();
 const room=id=>{if(!rooms.has(id))rooms.set(id,{desk:null,loading:null,error:'',busy:false,message:'',at:0,open:{}});return rooms.get(id);};
 const STATE_WORDS={'not-asked':'Not asked yet','asked':'Asked, waiting','yes':'Yes','yes-with-changes':'Yes, with changes','no':'No'};
 const time=ms=>{const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
 const day=iso=>{try{return new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short'});}catch{return '';}};
 const today=()=>new Date().toISOString().slice(0,10);

 async function api(method,route,body){
  const r=await fetch(route,{method,headers:{'Content-Type':'application/json','X-AR-Actor':actor(),'X-AR-Client':'ui'},...(body?{body:JSON.stringify(body)}:{})});
  const v=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(v.error||'The consent record is unavailable.'),{status:r.status});return v;
 }
 async function load(id,{force=false}={}){
  const r=room(id);if(r.loading)return r.loading;if(!force&&r.desk&&Date.now()-r.at<15000)return r.desk;
  r.loading=(async()=>{try{r.desk=await api('GET','/api/consent/desk?'+new URLSearchParams(scopeFor(id)));r.error='';r.at=Date.now();}catch(e){r.error=e.message;}finally{r.loading=null;paintAll();}})();
  return r.loading;
 }
 async function write(id,route,body,done){
  const r=room(id);if(r.busy||!r.desk)return;r.busy=true;r.message='Saving…';paintAll();
  try{r.desk=await api('POST','/api/consent/'+route,{...scopeFor(id),operationId:crypto.randomUUID(),expectedRevision:r.desk.revision,expectedHash:r.desk.hash,...body});r.at=Date.now();r.message=done||'Saved.';}
  catch(e){r.message=e.message;if(e.status===409&&/changed since/.test(e.message)){r.at=0;void load(id,{force:true});}}
  finally{r.busy=false;paintAll();}
 }

 // ---------- pieces of markup shared by both places
 function sourceLine(c){
  if(c.status==='doubtful')return `<span class="cd-tag cd-warn">Doubtful</span> ${esc(c.doubt.reason)}${c.source?' · '+sourceWords(c.source):''}`;
  if(!c.source)return '<span class="cd-tag cd-warn">No source</span> Not linked to a recording, passage or photo yet.';
  return `<span class="cd-tag">Sourced</span> ${sourceWords(c.source)}${c.fidelity==='differs from source'?' · <span class="cd-tag cd-warn">Differs from source</span>':''}`;
 }
 function sourceWords(s){
  if(s.type==='recording')return 'Recording '+esc(s.title)+' at '+time(s.atMs)+(s.quote?': “'+esc(s.quote)+'”':'');
  if(s.type==='photo')return 'Photo: '+esc(s.title);
  return 'Library: '+esc(s.title)+(s.quote?' · “'+esc(s.quote.length>140?s.quote.slice(0,140)+'…':s.quote)+'”':'');
 }
 const appearsWords=a=>a.length?a.join(', '):'';
 function personState(p,desk){
  const blocker=desk.release.blockers.find(b=>b.personId===p.id);
  return `<span class="cd-tag${blocker?' cd-warn':''}">${esc(STATE_WORDS[p.consent.state]||p.consent.state)}</span>${blocker&&!['not asked yet','asked, no answer yet'].includes(blocker.reason)?' '+esc(blocker.reason):''}${p.consent.changes?' · Changes: '+esc(p.consent.changes):''}`;
 }

 // ---------- Check: claims and people
 function checkHTML(id){
  const r=room(id),d=r.desk;
  if(!d)return `<h3>Truth and consent</h3><p class="cd-muted" role="status">${esc(r.error||'Reading the claims and people for this piece…')}</p>`;
  const s=d.summary,claims=d.claims;
  const counts=s.claims?`${s.claims} ${s.claims===1?'claim':'claims'} · ${s.sourced} sourced${s.unsourced?' · '+s.unsourced+' with no source':''}${s.doubtful?' · '+s.doubtful+' doubtful':''}${s.quotesDiffering?' · '+s.quotesDiffering+' quote'+(s.quotesDiffering===1?'':'s')+' differ from the source':''}`:'';
  const order={doubtful:0,unsourced:1,sourced:2};
  const list=claims.length?`<ul class="cd-list">${[...claims].sort((a,b)=>order[a.status]-order[b.status]).map(c=>`<li class="cd-claim cd-${c.status}"><p class="cd-said">${c.kind==='quote'?'Quote: ':''}${esc(c.text)}</p><p class="cd-src">${sourceLine(c)}</p></li>`).join('')}</ul>`
   :'<p class="cd-muted">No claims recorded for this piece yet. Ask an agent to go through it: it links each claim and quote to the moment it came from and raises only the doubtful ones.</p>';
  const people=d.people.length?`<ul class="cd-list">${d.people.map(p=>`<li class="cd-person"><p><strong>${esc(p.name)}</strong> <span class="cd-muted">${esc(appearsWords(p.appears))}</span></p><p>${personState(p,d)}</p></li>`).join('')}</ul>`
   :'<p class="cd-muted">No one is listed in this piece. If someone is named, pictured or quoted, list them so their consent is asked before release.</p>';
  return `<h3>Truth and consent</h3>
   <section aria-label="Claims and quotes"><h4>Claims and quotes</h4>${counts?`<p class="cd-muted">${counts}</p>`:''}${list}</section>
   <section aria-label="People in this piece"><h4>People</h4>${people}<p class="cd-muted">${d.people.length?'Answers and the release hold are in Share.':''}</p>${d.people.length?'<button type="button" class="cd-btn" data-cd-go-share>Open Share</button>':''}</section>`;
 }

 // ---------- Share: the two questions, the hold, the people, override and release
 function question(d,key,label,hint){
  const a=d.share[key]?.answer||null,adrian=isAdrian(),r=room(project());
  return `<div class="cd-q"><p class="cd-q-label">${label}</p>${hint?`<p class="cd-muted">${hint}</p>`:''}<div class="cd-row">${['yes','not-yet'].map(v=>`<button type="button" class="cd-btn${a===v?' is-on':''}" aria-pressed="${a===v}" data-cd-answer="${key}:${v}" ${adrian&&!r.busy?'':'disabled'}>${v==='yes'?'Yes':'Not yet'}</button>`).join('')}</div>${d.share[key]?.note?`<p class="cd-muted">${esc(d.share[key].note)}</p>`:''}</div>`;
 }
 function personControls(p,id){
  const r=room(id),open=r.open[p.id]||{},disabled=r.busy?'disabled':'';
  if(!isAdrian())return `<p class="cd-muted">Only Adrian records sending and sets consent.</p>`;
  return `<div class="cd-row"><label class="cd-field">Their answer<select data-cd-state="${p.id}" ${disabled}>${Object.entries(STATE_WORDS).map(([k,v])=>`<option value="${k}" ${(open.state||p.consent.state)===k?'selected':''}>${v}</option>`).join('')}</select></label>
   ${(open.state||p.consent.state)==='yes-with-changes'?`<label class="cd-field cd-grow">Changes they asked for<input data-cd-changes="${p.id}" value="${esc(open.changes??p.consent.changes??'')}" ${disabled}></label>`:''}
   <button type="button" class="cd-btn" data-cd-save-answer="${p.id}" ${disabled}>Save answer</button></div>
   <details class="cd-sent"${open.sent?' open':''} data-cd-sent-box="${p.id}"><summary>Record that I sent the request</summary><div class="cd-row"><label class="cd-field">Date<input type="date" data-cd-sent-at="${p.id}" value="${esc(open.sentAt||today())}" ${disabled}></label><label class="cd-field cd-grow">How<input data-cd-channel="${p.id}" placeholder="WeChat, email, in person" value="${esc(open.channel||'')}" ${disabled}></label><button type="button" class="cd-btn" data-cd-sent="${p.id}" ${disabled}>Record</button></div><p class="cd-muted">AR Create never sends it. Send it yourself, then record it here.</p></details>`;
 }

 // The one sentence about sources. The verb follows the count it sits beside: "1 has", "2 have", "0 have".
 const has=n=>n===1?'has':'have';
 function accuracySentence(s){
  const sourced=Number(s.sourced)||0,claims=Number(s.claims)||0,unsourced=Number(s.unsourced)||0,doubtful=Number(s.doubtful)||0;
  return `${sourced} of ${claims} ${claims===1?'claim':'claims'} ${claims===1?'has':has(sourced)} a source${unsourced?`, ${unsourced} ${has(unsourced)} none`:''}${doubtful?`, ${doubtful} doubtful`:''}.`;
 }
 function shareHTML(id){
  const r=room(id),d=r.desk;
  if(!d)return `<h3>Before you release</h3><p class="cd-muted" role="status">${esc(r.error||'Reading consent for this piece…')}</p>`;
  const rel=d.release,s=d.summary,adrian=isAdrian();
  const status=rel.released?.current?`<p class="cd-status cd-ok" role="status">You said yes to release on ${esc(day(rel.released.at))}. Publishing still happens from Outputs.</p>`
   :rel.ready?`<p class="cd-status cd-ok" role="status">Ready. Nothing is holding the release.${rel.overridden?' You overrode the hold: '+esc(rel.override.reason):''}</p>`
   :`<p class="cd-status cd-held" role="status"><strong>On hold.</strong> ${rel.reasons.map(esc).join(' ')}</p>`;
  const accuracyHint=s.claims?accuracySentence(s)+' <button type="button" class="cd-link" data-cd-go-check>See them in Check</button>':'No claims are recorded for this piece yet.';
  const people=d.people.length?`<ul class="cd-list">${d.people.map(p=>`<li class="cd-person"><div class="cd-person-head"><p><strong>${esc(p.name)}</strong> <span class="cd-muted">${esc(appearsWords(p.appears))}</span></p><p>${personState(p,d)}</p></div>
    ${p.request?`<details class="cd-request"><summary>Consent request drafted by ${esc(p.request.by==='human:adrian'?'you':p.request.by.replace('agent:',''))}</summary><p class="cd-request-text">${esc(p.request.text)}</p><button type="button" class="cd-btn" data-cd-copy="${p.id}">Copy request</button></details>`:''}
    ${p.sent.length?`<p class="cd-muted">Sent ${esc(p.sent.at(-1).sentAt)} by ${esc(p.sent.at(-1).channel)}</p>`:''}
    ${personControls(p,id)}</li>`).join('')}</ul>`
   :'<p class="cd-muted">No one is listed in this piece. If someone appears in it, add them so their consent is asked.</p>';
  const addPerson=`<details class="cd-add"><summary>Add a person</summary><div class="cd-row"><label class="cd-field cd-grow">Name<input data-cd-new-name></label><fieldset class="cd-appears"><legend>Appears</legend>${['named','pictured','quoted'].map(a=>`<label><input type="checkbox" data-cd-new-appears value="${a}"> ${a}</label>`).join('')}</fieldset><button type="button" class="cd-btn" data-cd-add ${r.busy?'disabled':''}>Add</button></div></details>`;
  const blockers=rel.blockers.length,override=adrian&&blockers&&!rel.overridden?`<details class="cd-override"><summary>Release without every answer</summary><label class="cd-field">Why<textarea data-cd-override-reason rows="2" placeholder="Your reason is kept in the journal."></textarea></label><button type="button" class="cd-btn" data-cd-override ${r.busy?'disabled':''}>Override the hold</button></details>`:'';
  const releaseBtn=adrian?`<button type="button" class="cd-btn pri" data-cd-release ${rel.ready&&!rel.released?.current&&!r.busy?'':'disabled'}>Yes, release this</button>`:'<p class="cd-muted">Comfort, accuracy, consent and the final yes are Adrian\'s to give.</p>';
  return `<header class="cd-head"><h3>Before you release</h3>${status}</header>
   <div class="cd-grid"><section aria-label="Two questions">${question(d,'comfort','Are you comfortable sharing this?','')}${question(d,'accuracy','Is it accurate?',accuracyHint)}</section>
   <section aria-label="People and consent"><h4>People and consent</h4>${people}${addPerson}</section></div>
   <div class="cd-foot">${override}${releaseBtn}<p class="cd-muted" role="status" data-cd-message>${esc(r.message)}</p></div>`;
 }

 // ---------- mounting
 function bind(node,id){
  const r=room(id);
  node.querySelector('[data-cd-go-share]')?.addEventListener('click',()=>window.viewPhase?.(11));
  node.querySelector('[data-cd-go-check]')?.addEventListener('click',()=>window.viewPhase?.(7));
  node.querySelectorAll('[data-cd-answer]').forEach(b=>b.onclick=()=>{const [question,answer]=b.dataset.cdAnswer.split(':');void write(id,'share/answer',{question,answer},'Answer saved.');});
  node.querySelectorAll('[data-cd-state]').forEach(s=>s.onchange=()=>{const o=r.open[s.dataset.cdState]||={};o.state=s.value;paintAll();});
  node.querySelectorAll('[data-cd-changes]').forEach(i=>i.oninput=()=>{(r.open[i.dataset.cdChanges]||={}).changes=i.value;});
  node.querySelectorAll('[data-cd-save-answer]').forEach(b=>b.onclick=()=>{const pid=b.dataset.cdSaveAnswer,p=r.desk.people.find(x=>x.id===pid),o=r.open[pid]||{},state=o.state||p.consent.state,changes=o.changes??p.consent.changes;
   void write(id,'people/answer',{personId:pid,state,...(state==='yes-with-changes'?{changes:changes||''}:{})},p.name+': '+STATE_WORDS[state]+'.').then(()=>{if(r.desk.people.find(x=>x.id===pid)?.consent.state===state)delete r.open[pid];paintAll();});});
  node.querySelectorAll('[data-cd-sent-box]').forEach(dt=>dt.ontoggle=()=>{(r.open[dt.dataset.cdSentBox]||={}).sent=dt.open;});
  node.querySelectorAll('[data-cd-sent-at]').forEach(i=>i.oninput=()=>{(r.open[i.dataset.cdSentAt]||={}).sentAt=i.value;});
  node.querySelectorAll('[data-cd-channel]').forEach(i=>i.oninput=()=>{(r.open[i.dataset.cdChannel]||={}).channel=i.value;});
  node.querySelectorAll('[data-cd-sent]').forEach(b=>b.onclick=()=>{const pid=b.dataset.cdSent,o=r.open[pid]||{};if(!o.channel?.trim()){r.message='Say how you sent it.';return paintAll();}
   void write(id,'people/sent',{personId:pid,sentAt:o.sentAt||today(),channel:o.channel},'Recorded that you sent it.').then(()=>{delete r.open[pid];paintAll();});});
  node.querySelectorAll('[data-cd-copy]').forEach(b=>b.onclick=async()=>{const p=r.desk.people.find(x=>x.id===b.dataset.cdCopy);try{await navigator.clipboard.writeText(p.request.text);r.message='Copied. Copying does not record sending.';}catch{r.message='Copy was not allowed by the browser.';}paintAll();});
  node.querySelector('[data-cd-add]')?.addEventListener('click',()=>{const name=node.querySelector('[data-cd-new-name]').value.trim(),appears=[...node.querySelectorAll('[data-cd-new-appears]:checked')].map(i=>i.value);
   if(!name||!appears.length){r.message='Give a name and how they appear.';return paintAll();}void write(id,'people/record',{person:{name,appears}},'Added '+name+'.');});
  node.querySelector('[data-cd-override]')?.addEventListener('click',()=>{const reason=node.querySelector('[data-cd-override-reason]').value;if(!reason.trim()){r.message='Write why you are releasing without every answer.';return paintAll();}void write(id,'share/override',{reason},'Hold overridden. Your reason is in the journal.');});
  node.querySelector('[data-cd-release]')?.addEventListener('click',()=>void write(id,'share/release',{},'You said yes to release.'));
 }
 function paint(node,kind,id){
  const html=kind==='share'?shareHTML(id):checkHTML(id);
  if(node.dataset.render===html)return;
  // Keep what is being typed when a repaint arrives.
  const typing=document.activeElement&&node.contains(document.activeElement)&&document.activeElement.matches('input:not([type=checkbox]),textarea')?{sel:[...document.activeElement.attributes].filter(a=>a.name.startsWith('data-cd-')).map(a=>`[${a.name}="${a.value}"]`).join(''),value:document.activeElement.value}:null;
  const openDetails=[...node.querySelectorAll('details[open]')].map(dt=>[...dt.attributes].filter(a=>a.name.startsWith('data-cd-')||a.name==='class').map(a=>`[${a.name}="${a.value}"]`).join(''));
  node.innerHTML=html;node.dataset.render=html;
  for(const sel of openDetails){const dt=sel&&node.querySelector('details'+sel);if(dt)dt.open=true;}
  if(typing?.sel){const el=node.querySelector(typing.sel);if(el){el.value=typing.value;el.focus();}}
  node.setAttribute('aria-busy',String(!!room(id).busy));
  bind(node,id);
 }
 function placeCheck(id){
  const check=document.getElementById('current-draft-check');
  if(!check||!check.isConnected){document.querySelectorAll('[data-consent-desk="check"]').forEach(n=>n.remove());return;}
  // Right under the manuscript check, before the longer change and evidence tools.
  const after=check.querySelector(':scope>.draft-check-room')||check;
  let node=document.querySelector('[data-consent-desk="check"]');
  if(!node){node=document.createElement('section');node.className='cd-desk cd-check';node.dataset.consentDesk='check';node.setAttribute('aria-label','Truth and consent');}
  if(after.nextElementSibling!==node)after.after(node);
  paint(node,'check',id);
 }
 function placeShare(id){
  const ws=document.querySelector('#app .workspace');
  if(stage()!==11||!ws){document.querySelectorAll('[data-consent-desk="share"]').forEach(n=>n.remove());return;}
  const host=ws.querySelector(':scope>.c3-ws-title')||ws.querySelector(':scope>#c3-surface-bar');
  let node=ws.querySelector(':scope>[data-consent-desk="share"]');
  if(!node){node=document.createElement('section');node.className='cd-desk cd-share';node.dataset.consentDesk='share';node.setAttribute('aria-label','Before you release');}
  // A words-only piece shows a not-applicable card here. It still owns the step (it keeps the invitation composer
  // hidden), but once people are listed its line about nobody to invite is wrong, so the desk takes its place.
  const na=ws.querySelector(':scope>.c3-empty.ce-na');if(na)na.classList.toggle('cd-covered',!!room(id).desk?.people.length);
  const anchor=na||host||ws.firstElementChild;
  if(anchor&&anchor!==node&&anchor.nextElementSibling!==node)anchor.after(node);else if(!anchor)ws.prepend(node);
  paint(node,'share',id);
 }
 let scheduled=false;
 function paintAll(){
  const id=project();if(!id)return;
  const wantsCheck=!!document.getElementById('current-draft-check'),wantsShare=stage()===11;
  if((wantsCheck||wantsShare)&&!room(id).desk&&!room(id).loading&&!room(id).error)void load(id);
  observer.disconnect();
  try{placeCheck(id);placeShare(id);}finally{observer.observe(document.body,{childList:true,subtree:true});}
 }
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;paintAll();});});
 function start(){observer.observe(document.body,{childList:true,subtree:true});paintAll();}
 // Agents write to the same record; a change event from anyone refreshes what is on screen.
 window.addEventListener('ar-live-change',e=>{const v=e.detail||{};if(v.reset||String(v.kind||'').startsWith('consent.')){const id=project();if(id&&rooms.has(id)){room(id).at=0;void load(id,{force:true});}}});
 window.arConsentDesk={load,read:id=>room(id).desk,scopeFor,accuracySentence};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
