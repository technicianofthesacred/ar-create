/* "Needs you" on Home: every question an agent has raised, in one list (3 Nov 2026, "When to ask Adrian").
   Two kinds reach him. "Only you" asks wait for him and never apply themselves. "You steer" asks name a default and the
   time it applies if he does not answer; once it has applied the row says so and offers "Change it". One tap answers.
   The answer is sent as human:adrian from this page, never from an agent: opened as an agent (?reviewActor=agent:...)
   the list is read-only. A step that only a human can take (publish, send, consent) links straight to the screen where
   that click happens; this list only lets him say it is done. Data: /api/needs-you (runtime/services/needs-you.mjs).
   Mounts at the top of Home, next to the other Home bands. */
(()=>{
 if(window.needsYou)return;
 const POLL=20000,RECENT=5,SHOW=4;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const actor=()=>window.arCreateUiActor?.actor||'human:adrian',human=()=>/^human:/.test(actor());
 const headers=()=>({'Content-Type':'application/json','X-AR-Actor':actor(),'X-AR-Client':'ui'});
 const uuid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});
 const who=by=>{const named=window.c3Shell?.actorName?.(by);if(named&&named!==by)return named;const m=/^agent:(.+)$/.exec(by||'');if(!m)return /^human:/.test(by||'')?'You':(by||'An agent');return /^claude/.test(m[1])?'Claude':m[1].replace(/^./,c=>c.toUpperCase());};
 const clock=ms=>new Date(ms).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
 const day=ms=>new Date(ms).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
 const sameDay=(a,b)=>new Date(a).toDateString()===new Date(b).toDateString();
 // "today 17:00", "tomorrow 09:00", "Wed 5 Nov 09:00"
 function at(iso){const t=Date.parse(iso),n=Date.now();if(sameDay(t,n))return 'today '+clock(t);if(sameDay(t,n+864e5))return 'tomorrow '+clock(t);if(sameDay(t,n-864e5))return 'yesterday '+clock(t);return day(t)+' '+clock(t);}
 const days=n=>n+(n===1?' day':' days');
 function ago(iso){const s=Math.max(0,(Date.now()-Date.parse(iso))/1000);if(s<90)return 'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';return days(Math.round(s/86400))+' ago';}
 function within(iso){const s=(Date.parse(iso)-Date.now())/1000;if(s<90)return 'in a moment';if(s<3600)return 'in '+Math.round(s/60)+' min';if(s<86400)return 'in '+Math.round(s/3600)+' h';return 'in '+days(Math.round(s/86400));}

 let expanded=false,asks=[],counts=null,loaded=false,failed='',busy=new Set(),notice='',changing=new Set(),drafts=new Map(),doneOpen=false,timer=0,loading=null;
 const call=async(url,options={})=>{const r=await fetch(url,{cache:'no-store',...options,headers:{...headers(),...options.headers}}),v=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(v.error||'The request was refused ('+r.status+').'),{status:r.status});return v;};

 async function load(){
  if(loading)return loading;
  loading=call('/api/needs-you?status=all',{method:'GET'}).then(v=>{asks=v.asks||[];counts=v.counts||null;loaded=true;failed='';},e=>{failed=e.message||'The list could not be read.';}).finally(()=>{loading=null;paint();});
  return loading;
 }
 async function answer(id,body){
  if(busy.has(id))return;busy.add(id);notice='';paint();
  try{
   const saved=await call('/api/needs-you/answer',{method:'POST',body:JSON.stringify({operationId:uuid(),id,...body})});
   asks=asks.map(a=>a.id===id?saved:a);changing.delete(id);drafts.delete(id);
  }catch(error){
   notice=error.status===404?'That question is not on the list any more.':error.status===403?'Only you can answer these, and only from this page.':(error.message||'That answer was not saved. Nothing changed.');
  }finally{busy.delete(id);paint();void load();}
 }

 /* ---------- rendering ---------- */
 const tagOf=a=>a.status==='defaulted'?'Default chosen':a.status==='answered'?'Answered':a.band==='only-adrian'?'Only you':'You steer';
 const metaOf=a=>`<div class="ny-meta"><span class="ny-tag" data-band="${esc(a.band)}" data-status="${esc(a.status)}">${esc(tagOf(a))}</span>${a.about?`<span class="ny-about">${esc(a.about)}</span>`:''}<span class="ny-by">${esc(who(a.raisedBy))}, ${esc(ago(a.raisedAt))}</span></div>`;
 const off=()=>human()?'':' disabled aria-disabled="true"';
 // A recording's doubtful words are one ask; "Go through them" opens the Words screen at that recording instead of answering.
 const wordsLink=(a,c)=>a.scope?.kind==='recording-words'&&c==='Go through them'?`<a class="ny-open" href="#words/check/${esc(a.scope.id)}">Go through them <span aria-hidden="true">›</span></a>`:'';
 const choiceBtn=(a,c,{mark='',pressed=false,quiet=false}={})=>`<button type="button" class="ny-choice${mark?' is-default':''}${quiet?' is-quiet':''}" data-ny-choice="${esc(c)}" data-ny-id="${esc(a.id)}"${pressed?' aria-pressed="true"':''}${busy.has(a.id)?' disabled':off()}>${esc(c)}${mark?`<small>${esc(mark)}</small>`:''}</button>`;
 function freeForm(a){
  const field='ny-free-'+a.id,value=drafts.get(a.id)||'';
  return `<form class="ny-free" data-ny-free="${esc(a.id)}"><label class="ny-sr" for="${esc(field)}">Your answer</label><textarea id="${esc(field)}" rows="2" maxlength="500" placeholder="Your own words"${off()}>${esc(value)}</textarea><button type="submit" class="ny-choice"${busy.has(a.id)?' disabled':off()}>Send</button></form>`;
 }
 const audioRange=item=>{
  const match=/#t=([\d.]+),([\d.]+)/.exec(item.audioUrl||'');
  return match?{start:Number(match[1]),end:Number(match[2])}:{start:Math.max(0,Number(item.start||0)-1),end:Number(item.end||0)+1};
 };
 function recordingRow(a){
  const r=a.recording,wordCount=Number(r.wordCount)||0,passageCount=Number(r.passageCount)||0;
  const count=(n,one)=>n+' '+one+(n===1?'':'s');
  const parts=[wordCount?count(wordCount,'word'):'',passageCount?count(passageCount,'passage'):''].filter(Boolean);
  const date=r.recordedAt?new Date(r.recordedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
  const items=(r.items||[]).slice(0,2).map((item,i)=>{
   const range=audioRange(item),stamp=clockTime(item.at??item.start);
   const context=String(item.context||item.text),at=context.indexOf(item.text);
   const passage=at>=0?esc(context.slice(0,at))+'<mark>'+esc(item.text)+'</mark>'+esc(context.slice(at+item.text.length)):esc(item.text);
   const audio=item.audioUrl?`<audio controls preload="none" data-ny-audio="${esc(r.jobId+':'+i)}" data-audio-start="${range.start}" data-audio-end="${range.end}" aria-label="Hear the passage at ${esc(stamp)}" src="${esc(item.audioUrl)}"></audio><span class="ny-audio-status" role="status"></span>`:'<span class="ny-audio-status">Audio unavailable for this passage.</span>';
   return `<div class="ny-context"><p class="ny-passage"><span class="ny-time">${esc(stamp)}</span> ${passage}</p>${item.proposed?`<p class="ny-proposed">Suggested: <b>${esc(item.proposed)}</b></p>`:''}<p class="ny-reason">${esc(item.reason||'Listen and decide whether the transcript needs a correction.')}</p><div class="ny-listen">${audio}</div></div>`;
  }).join('');
  const wordsHref=r.wordsHref||a.wordsHref,transcriptHref=r.transcriptHref||a.transcriptHref;
  const words=wordCount&&wordsHref?`<a class="ny-open" href="${esc(wordsHref)}">Review ${count(wordCount,'word')}</a>`:'';
  const passages=passageCount&&transcriptHref?`<a class="ny-open" href="${esc(transcriptHref)}">Review ${count(passageCount,'passage')}</a>`:'';
  return `<article class="ny-ask ny-recording" data-ny-ask="${esc(a.id)}" data-band="only-adrian"><div class="ny-meta"><span class="ny-about">${esc(r.title||a.about||'Recording')}</span>${date?`<span>${esc(date)}</span>`:''}<span>Transcript review</span></div><p class="ny-q">${esc(parts.join(' and '))} to review</p>${items}<div class="ny-acts">${words}${passages}</div><p class="ny-foot">Review each suggestion with its source. No correction is applied here.</p></article>`;
 }
 const clockTime=t=>Math.floor(Math.max(0,Number(t)||0)/60)+':'+String(Math.floor(Math.max(0,Number(t)||0)%60)).padStart(2,'0');
 function openRow(a){
  if(a.recording)return recordingRow(a);
  let acts='',foot='';
  if(a.choices.length){
   const linked=!!a.link;
   acts=(linked?`<a class="ny-open" href="${esc(a.link.href)}">${esc(a.link.label)} <span aria-hidden="true">›</span></a>`:'')+a.choices.map(c=>wordsLink(a,c)||choiceBtn(a,c,{mark:a.default===c?'Default':'',quiet:linked})).join('');
   if(linked)foot='<p class="ny-foot">This is done on its own screen. Tap Done afterwards to take it off the list.</p>';
  }else acts=freeForm(a);
  if(a.band==='steer'&&a.default)foot=`<p class="ny-foot">If you do not answer, <b>${esc(a.default)}</b> applies ${esc(at(a.applyAt))} (${esc(within(a.applyAt))}).</p>`;
  else if(a.band==='only-adrian'&&!a.link)foot='<p class="ny-foot">Waits for you. Nothing applies on its own.</p>';
  return `<article class="ny-ask" data-ny-ask="${esc(a.id)}" data-band="${esc(a.band)}">${metaOf(a)}<p class="ny-q">${esc(a.question)}</p><div class="ny-acts">${acts}</div>${foot}</article>`;
 }
 function appliedRow(a){
  const r=a.resolution||{},more=changing.has(a.id);
  return `<article class="ny-ask is-applied" data-ny-ask="${esc(a.id)}" data-band="steer">${metaOf(a)}<p class="ny-q">${esc(a.question)}</p><p class="ny-applied"><b>${esc(r.choice)}</b> became the default ${esc(at(r.at))}. The work result is not yet verified.</p><div class="ny-acts"><button type="button" class="ny-choice" data-ny-choice="${esc(r.choice)}" data-ny-id="${esc(a.id)}"${busy.has(a.id)?' disabled':off()}>Keep ${esc(r.choice)}</button><button type="button" class="ny-choice is-quiet" data-ny-change="${esc(a.id)}" aria-expanded="${more}"${off()}>Change it</button></div>${more?`<div class="ny-acts ny-others" role="group" aria-label="Change it to">${a.choices.filter(c=>c!==r.choice).map(c=>choiceBtn(a,c)).join('')}</div>`:''}</article>`;
 }
 function doneRow(a){
  const r=a.resolution||{},more=changing.has(a.id),text=r.choice||r.text,mine=/^human:/.test(r.by||'');
  return `<li class="ny-done-row" data-ny-ask="${esc(a.id)}"><div><p class="ny-q">${esc(a.question)}</p><p class="ny-applied"><b>${esc(text)}</b> · ${esc(mine?'you':who(r.by))} · ${esc(ago(r.at))}</p></div>${a.choices.length?`<button type="button" class="ny-choice is-quiet" data-ny-change="${esc(a.id)}" aria-expanded="${more}"${off()}>Change it</button>`:''}${more?`<div class="ny-acts ny-others" role="group" aria-label="Change it to">${a.choices.filter(c=>c!==r.choice).map(c=>choiceBtn(a,c)).join('')}</div>`:''}</li>`;
 }
 /* Decisions about his own editorial work (choose an angle or a title, review marked passages, carousel words, marked
    wording) used to sit in a second box lower on Home. They are folded in here as "Only you" rows: nothing about them
    has a default, so none applies on its own. The workbench owns what they are and how they open; a tap uses its
    existing click handling (data-wbf-author-decision / data-wbf-wording-review). */
 const decisions=()=>{try{const v=window.c3WorkbenchFrame?.decisionAsks?.();return v&&Array.isArray(v.items)?v:{state:'ready',items:[],note:''};}catch{return {state:'ready',items:[],note:''};}};
 function decisionRow(d){
  const hook=d.kind==='wording-review'?'data-wbf-wording-review':'data-wbf-author-decision';
  return `<article class="ny-ask" data-ny-decision="${esc(d.kind)}" data-band="only-adrian"><div class="ny-meta"><span class="ny-tag" data-band="only-adrian" data-status="open">Only you</span>${d.subject?`<span class="ny-about">${esc(d.subject)}</span>`:''}<span class="ny-by">From your saved work</span></div><p class="ny-q">${esc(d.label)}${d.detail?` <span class="ny-detail">· ${esc(d.detail)}</span>`:''}</p><div class="ny-acts"><button type="button" class="ny-choice" ${hook}="${esc(d.key)}"${d.canOpen===false?' disabled':''}>${esc(d.step?'Open it in '+d.step:'Open it')} <span aria-hidden="true">›</span></button></div><p class="ny-foot">Waits for you. Nothing applies on its own.</p></article>`;
 }
 const EMPTY='<div class="ny-empty"><p class="ny-empty-t">Nothing needs you right now.</p><p class="ny-empty-s">When an agent has a question only you can answer, or one it can carry on from with a default, it lands here with one tap to answer.</p></div>';
 function html(){
  const waiting=asks.filter(a=>a.status==='open'),applied=asks.filter(a=>a.status==='defaulted'),done=asks.filter(a=>a.status==='answered').slice(0,RECENT);
  const mine=decisions(),mineRows=mine.items.map(decisionRow);
  const onlyAsks=waiting.filter(a=>a.band==='only-adrian'),steerAsks=waiting.filter(a=>a.band!=='only-adrian');
  const only=onlyAsks.length+mineRows.length,steer=steerAsks.length;
  const sub=[only?only+' only you can decide':'',steer?steer+' you can steer':'',applied.length?applied.length+' default'+(applied.length===1?'':'s')+' chosen':''].filter(Boolean).join(' · ');
  const rows=[...onlyAsks.map(openRow),...mineRows,...steerAsks.map(openRow),...applied.map(appliedRow)];
  let body='';
  const status=mine.note?`<p class="ny-msg" role="status">${esc(mine.note)}</p>`:'';
  if(rows.length){const shown=expanded?rows:rows.slice(0,SHOW);body=`<div class="ny-list">${shown.join('')}</div>${rows.length>SHOW?`<button type="button" class="ny-more" data-ny-all aria-expanded="${expanded}">${expanded?'Show fewer':'Show all '+rows.length}</button>`:''}`;}
  if(failed&&!loaded)body+=`<div class="ny-empty"><p class="ny-empty-t">The list could not be read.</p><p class="ny-empty-s">${esc(failed)} Nothing was lost. <button type="button" class="ny-link" data-ny-retry>Try again</button></p></div>`;
  else if(!loaded)body+='<p class="ny-loading" role="status">Reading the list…</p>';
  else if(!rows.length&&!mine.note)body=EMPTY;
  const readonly=!human()?`<p class="ny-msg" role="status">You are signed in as ${esc(actor())}. Answers are Adrian's, so these buttons are off here.</p>`:'';
  const doneBlock=loaded&&done.length?`<details class="ny-done"${doneOpen?' open':''}><summary>Answered recently · ${done.length}</summary><ul>${done.map(doneRow).join('')}</ul></details>`:'';
  return `<div class="ny-head"><span class="ny-title">Needs you</span>${sub?`<span class="ny-sub">${esc(sub)}</span>`:''}</div>${notice?`<p class="ny-msg is-bad" role="alert">${esc(notice)}</p>`:''}${readonly}${status}${body}${doneBlock}`;
 }
 function paint(){
  if(!window.document)return;
  const d=document.getElementById('project-library'),main=d?.querySelector('.ht-home-main');if(!d?.open||!main)return;
  let band=main.querySelector(':scope>.ny-band');
  if(!band){band=document.createElement('section');band.className='ny-band';band.setAttribute('aria-label','Needs you');main.prepend(band);}
  // Polling may update data while he listens; refresh the card after playback pauses.
  if([...band.querySelectorAll('audio[data-ny-audio]')].some(a=>!a.paused&&!a.ended))return;
  const next=html();if(band.dataset.render===next)return;
  // A re-render must not eat what he is typing: keep the draft and the cursor.
  const active=band.querySelector('textarea:focus'),keep=active?{id:active.closest('[data-ny-free]')?.dataset.nyFree,start:active.selectionStart,end:active.selectionEnd}:null;
  for(const t of band.querySelectorAll('[data-ny-free] textarea'))drafts.set(t.closest('[data-ny-free]').dataset.nyFree,t.value);
  band.innerHTML=next;band.dataset.render=next;
  if(keep?.id){const t=band.querySelector(`[data-ny-free="${CSS.escape(keep.id)}"] textarea`);if(t){t.focus({preventScroll:true});try{t.setSelectionRange(keep.start,keep.end);}catch{}}}
 }

 /* ---------- events ---------- */
 document.addEventListener('play',event=>{
  const a=event.target;if(!a?.matches?.('#project-library audio[data-ny-audio]'))return;
  const from=Number(a.dataset.audioStart),to=Number(a.dataset.audioEnd);
  if(a.currentTime<from||a.currentTime>=to)a.currentTime=from;
 },true);
 document.addEventListener('timeupdate',event=>{
  const a=event.target;if(!a?.matches?.('#project-library audio[data-ny-audio]'))return;
  if(a.currentTime>=Number(a.dataset.audioEnd)&&!a.paused)a.pause();
 },true);
 document.addEventListener('error',event=>{
  const a=event.target;if(!a?.matches?.('#project-library audio[data-ny-audio]'))return;
  const status=a.parentElement.querySelector('.ny-audio-status');if(status)status.textContent='Audio could not be played. Open the recording to check its availability.';
 },true);
 for(const name of ['pause','ended'])document.addEventListener(name,event=>{
  if(event.target?.matches?.('#project-library audio[data-ny-audio]'))setTimeout(paint,0);
 },true);
 document.addEventListener('click',event=>{
  const root=event.target.closest?.('#project-library .ny-band');if(!root)return;
  const choice=event.target.closest('[data-ny-choice]');
  if(choice&&!choice.disabled){void answer(choice.dataset.nyId,{choice:choice.dataset.nyChoice});return;}
  const change=event.target.closest('[data-ny-change]');
  if(change&&!change.disabled){const id=change.dataset.nyChange;changing.has(id)?changing.delete(id):changing.add(id);paint();return;}
  if(event.target.closest('[data-ny-all]')){expanded=!expanded;paint();return;}
  if(event.target.closest('[data-ny-retry]')){void load();}
 });
 document.addEventListener('submit',event=>{
  const form=event.target.closest?.('#project-library .ny-band [data-ny-free]');if(!form)return;event.preventDefault();
  const text=form.querySelector('textarea').value.trim();if(!text){notice='Write your answer first.';paint();return;}
  void answer(form.dataset.nyFree,{text});
 });
 document.addEventListener('toggle',event=>{const d=event.target;if(d?.matches?.('#project-library .ny-done')){doneOpen=d.open;}},true);
 // Cmd/Ctrl+Enter sends a written answer.
 document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){const form=event.target.closest?.('#project-library .ny-band [data-ny-free]');if(form){event.preventDefault();form.requestSubmit();}}});

 // Read whenever Home opens; keep fresh while it stays open and visible. Nothing polls when Home is closed.
 let watched=null;
 const tick=()=>{clearInterval(timer);timer=0;const d=document.getElementById('project-library');if(!d?.open)return;timer=setInterval(()=>{if(document.visibilityState==='hidden')return;if(!document.getElementById('project-library')?.open){clearInterval(timer);timer=0;return;}void load();},POLL);};
 new MutationObserver(()=>{if(!window.document)return;const d=document.getElementById('project-library');if(d&&d!==watched){watched=d;const onOpen=()=>{if(d.open){notice='';paint();void load();tick();}else tick();};new MutationObserver(onOpen).observe(d,{attributes:true,attributeFilter:['open']});onOpen();}}).observe(document.body,{childList:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.getElementById('project-library')?.open)void load();});
 window.needsYou={load,paint,asks:()=>asks.slice(),html};
})();
