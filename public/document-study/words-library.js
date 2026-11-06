/* Words: the shared word library on its own screen (a full-screen layer over Home).
   One list of names and terms every transcription of Adrian's voice should get right, shared by all his projects.
     To check       words a finished recording left in doubt, one card per recording, explicit per-word decisions
     Suggested      words an agent proposed; they wait for his yes and never reach a prompt before it
     Recently       spellings he confirmed lately, so he sees the library learn
     All words      search, category filter, where each word came from
   Answering is his alone: sent as human:adrian from this page. Opened as an agent (?reviewActor=agent:...) the screen
   reads and never answers. Data: /api/words (runtime/services/words-http.mjs). Entry points: the Words button on Home,
   the #words address, and the "Go through them" link on a Needs you row. */
(()=>{
 if(window.wordsLibrary)return;
 const SHOW=60;
 const CATS=[['person','People'],['place','Places'],['tea-term','Tea terms'],['gene-key','Gene Keys'],['hexagram','Hexagrams'],['other','Other']];
 const CAT_ONE=Object.fromEntries([['person','Person'],['place','Place'],['tea-term','Tea term'],['gene-key','Gene Key'],['hexagram','Hexagram'],['other','Other']]);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const actor=()=>window.arCreateUiActor?.actor||'human:adrian',human=()=>/^human:/.test(actor());
 const headers=()=>({'Content-Type':'application/json','X-AR-Actor':actor(),'X-AR-Client':'ui'});
 const uuid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});
 const who=by=>{const named=window.c3Shell?.actorName?.(by);if(named&&named!==by)return named;const m=/^agent:(.+)$/.exec(by||'');if(!m)return /^human:/.test(by||'')?'You':(by||'An agent');return /^claude/.test(m[1])?'Claude':m[1].replace(/^./,c=>c.toUpperCase());};
 const day=iso=>iso?new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'';
 const plural=(n,one,many)=>n+' '+(n===1?one:many);

 const S={touched:new Set(),q:'',category:'',lib:null,counts:null,recent:[],proposed:[],checks:[],records:new Map(),opened:new Set(),form:new Map(),showAll:false,adding:false,notice:'',failed:'',busy:new Set(),loaded:false,focus:''};
 const call=async(url,options={})=>{const r=await fetch(url,{cache:'no-store',...options,headers:{...headers(),...options.headers}}),v=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(v.error||'The request was refused ('+r.status+').'),{status:r.status});return v;};
 const post=(route,body)=>call('/api/words/'+route,{method:'POST',body:JSON.stringify({operationId:uuid(),...body})});

 /* ---------- data ---------- */
 let loading=null,searchTimer=0,watchedHome=null;
 async function load(){
  if(loading)return loading;
  const query=new URLSearchParams();if(S.q)query.set('q',S.q);if(S.category)query.set('category',S.category);query.set('limit','300');
  loading=Promise.all([call('/api/words?'+query),call('/api/words?status=proposed&limit=50'),call('/api/words/checks')]).then(async([lib,proposed,checks])=>{
   S.lib=lib;S.counts=lib.counts;S.recent=lib.recent||[];S.proposed=proposed.entries||[];S.checks=checks.recordings||[];S.failed='';S.loaded=true;
   // Open the recording he came for; read each open recording so its words are there to answer.
   const want=S.checks.filter(c=>c.open).map(c=>c.jobId);
   if(S.focus&&!want.includes(S.focus)&&S.checks.some(c=>c.jobId===S.focus))want.push(S.focus);
   await Promise.all(want.map(async id=>{try{S.records.set(id,await call('/api/words/check?jobId='+encodeURIComponent(id)));}catch{}}));
   if(S.focus){S.opened.add(S.focus);}
   else if(!S.opened.size&&S.checks.some(c=>c.open))S.opened.add(S.checks.find(c=>c.open).jobId);
  }).catch(e=>{S.failed=e.message||'The words could not be read.';}).finally(()=>{loading=null;paint();updateButton();});
  return loading;
 }
 async function run(key,work,failure='That was not saved. Nothing changed.'){
  if(S.busy.has(key))return;S.busy.add(key);S.notice='';paint();
  try{await work();}
  catch(e){S.notice=e.status===403?'Only you can do that, and only from this page.':e.status===404?'That is not on the list any more.':(e.message||failure);}
  finally{S.busy.delete(key);await load();}
 }

 /* ---------- rendering ---------- */
 const off=()=>human()?'':' disabled aria-disabled="true"';
 const catSelect=(id,value)=>`<label>Kind of word<select data-wl-cat="${esc(id)}"${off()}>${CATS.map(([v,l])=>`<option value="${v}"${v===value?' selected':''}>${esc(CAT_ONE[v])}</option>`).join('')}</select></label>`;
 function sentence(item){
  const s=String(item.sentence||''),w=String(item.word||''),i=w?s.toLowerCase().indexOf(w.toLowerCase()):-1;
  return i<0?esc(s):esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+w.length))+'</mark>'+esc(s.slice(i+w.length));
 }
 function outcome(item){
  const a=item.answer||{};
  if(item.status==='kept')return a.via==='ask'&&a.by==='default'?'Kept as heard, the default.':'Kept as heard.';
  if(item.status==='remembered')return '<b>'+esc(item.word)+'</b> is right. Added to the library.';
  return 'Changed to <b>'+esc(a.spelling)+'</b>'+(a.receiptId?' in this recording':'')+(a.remembered?' and remembered for the next recordings':'')+'.';
 }
 function itemCard(rec,item){
  const key=rec.jobId+'|'+item.key,f=S.form.get(key),busy=S.busy.has(key);
  const meta=`<div class="wl-meta"><span class="wl-kind" data-kind="${esc(item.kind)}">${esc(item.kindLabel)}</span><span>at ${esc(item.time)}</span>${item.occurrences>1?`<span>${item.occurrences} times</span>`:''}</div>`;
  const range=/#t=([\d.]+),([\d.]+)/.exec(item.audioUrl||'');
  const from=range?Number(range[1]):Math.max(0,Number(item.start||0)-1),to=range?Number(range[2]):Number(item.end||0)+1;
  const listen=item.audioUrl?`<div class="wl-listen"><audio controls preload="none" data-wl-audio="${esc(key)}" data-audio-start="${from}" data-audio-end="${to}" aria-label="Hear ${esc(item.word)} in context" src="${esc(item.audioUrl)}"></audio><span class="wl-audio-status" role="status"></span></div>`:'<p class="wl-audio-status">Audio unavailable for this passage.</p>';
  const head=`${meta}<p class="wl-sentence">${sentence(item)}</p>${item.reason?`<p class="wl-sugg">${esc(item.reason)}</p>`:''}${listen}`;
  if(item.status!=='open')return `<li class="wl-item" data-wl-item="${esc(item.key)}" data-status="${esc(item.status)}">${head}<p class="wl-done">${outcome(item)}</p></li>`;
  const sugg=item.suggestion?`<p class="wl-sugg">The library has <b>${esc(item.suggestion)}</b>${item.category?' ('+esc(CAT_ONE[item.category]||item.category)+')':''}.</p>`:'';
  const dis=busy||!human()?' disabled':'';
  let form='';
  if(f?.mode==='spell')form=`<form class="wl-form" data-wl-spell="${esc(key)}"><label class="grow">How it is spelled<input type="text" maxlength="120" value="${esc(f.value??item.word)}" data-wl-spelling="${esc(key)}"${off()}></label>${item.kind==='number'?'':catSelect(key,f.cat||'other')}<button type="submit" class="wl-btn is-warm"${dis}>${item.kind==='number'?'Fix it in this recording':'Fix it and remember it'}</button></form>`;
  if(f?.mode==='right')form=`<form class="wl-form" data-wl-right="${esc(key)}">${catSelect(key,f.cat||'other')}<button type="submit" class="wl-btn is-warm"${dis}>Add ${esc(item.word)} to the library</button></form>`;
  const acts=`<div class="wl-acts"><button type="button" class="wl-btn is-default" data-wl-keep="${esc(key)}"${dis}>Keep as heard</button>`
   +(item.suggestion?`<button type="button" class="wl-btn is-warm" data-wl-use="${esc(key)}"${dis}>Use ${esc(item.suggestion)}</button>`:'')
   +`<button type="button" class="wl-btn" data-wl-mode="spell" data-wl-key="${esc(key)}"${dis}>Spell it another way</button>`
   +(item.kind==='number'?'':`<button type="button" class="wl-btn" data-wl-mode="right" data-wl-key="${esc(key)}"${dis}>That is right, remember it</button>`)+'</div>';
  return `<li class="wl-item" data-wl-item="${esc(item.key)}" data-status="open">${head}${sugg}${acts}${form}</li>`;
 }
 function checkCard(c){
  const rec=S.records.get(c.jobId);if(!rec)return '';
  const fixed=rec.fixes?.applied?.length;
  const note=rec.open?plural(rec.open,'word','words')+' to check':'All checked';
  const date=rec.recordedAt?day(rec.recordedAt):'';
  const source=/^[a-f0-9-]{36}$/.test(c.jobId)?`<a class="wl-recording-link" href="/transcription/${esc(c.jobId)}/view">Open recording</a>`:'';
  const fixes=fixed?`<p class="wl-fixed">Fixed automatically before you saw it: ${[...new Set(rec.fixes.applied.map(x=>'<b>'+esc(x.heard)+'</b> to <b>'+esc(x.spelling)+'</b>'))].join(', ')}. The first wording is kept in the receipt.</p>`:'';
  return `<section class="wl-card" data-wl-rec="${esc(c.jobId)}"><header class="wl-recording-head"><b>${esc(rec.title||rec.story)}</b>${date?`<span class="wl-note">${esc(date)}</span>`:''}<span class="wl-note">${esc(note)}${rec.dropped?' · '+rec.dropped+' more were left out':''}</span>${source}</header>${fixes}<ul class="wl-list" style="border-top:0">${rec.items.map(i=>itemCard(rec,i)).join('')}</ul></section>`;
 }
 function sourceOf(e){
  const s=e.source||{};
  if(s.kind==='import')return 'Seeded from '+(/tea-terms/.test(s.ref||'')?'the Teajia tea terms':/oracle/.test(s.ref||'')?'the oracle list':esc(s.ref||'a seed file'));
  if(s.kind==='confirmed-answer')return 'You confirmed it'+(s.story?' in '+esc(s.story):'')+', '+esc(day(e.addedAt));
  return e.status==='proposed'?'Suggested by '+esc(who(e.proposedBy||e.addedBy))+', '+esc(day(e.addedAt)):(/^human:/.test(e.addedBy||'')?'Added by you':'Added by '+esc(who(e.addedBy)))+', '+esc(day(e.addedAt));
 }
 function row(e){
  const heard=(e.variants||[]).filter(v=>v.kind!=='alias').map(v=>v.text),alias=(e.variants||[]).filter(v=>v.kind==='alias').map(v=>v.text);
  const extra=[e.zh,e.pinyin].filter(Boolean).join(' · ');
  return `<li class="wl-row" data-wl-word="${esc(e.id)}"><div class="wl-w">${esc(e.spelling)}${extra?`<small>${esc(extra)}</small>`:''}</div><div><span class="wl-tag">${esc(CAT_ONE[e.category]||e.category)}</span><span class="wl-heard">${heard.length?'Heard as: '+esc(heard.slice(0,8).join(', '))+(heard.length>8?' and '+(heard.length-8)+' more':''):'No mishearings recorded'}${alias.length?' · Also called: '+esc(alias.join(', ')):''}</span></div><div class="wl-src">${sourceOf(e)}${e.note?' · '+esc(e.note):''}</div></li>`;
 }
 function proposedRow(e){
  const pending=(e.proposedVariants||[]),busy=S.busy.has('decide|'+e.id)||!human()?' disabled':'';
  const what=e.status==='proposed'?`<b>${esc(e.spelling)}</b> <span class="wl-tag">${esc(CAT_ONE[e.category]||e.category)}</span>`:`<b>${esc(e.spelling)}</b> may be heard as <b>${esc(pending.map(v=>v.text).join(', '))}</b>`;
  const by=who(e.status==='proposed'?e.proposedBy:pending[0]?.proposedBy);
  return `<li class="wl-row" data-wl-proposed="${esc(e.id)}"><div class="wl-w">${what}</div><div class="wl-heard">Suggested by ${esc(by)}, ${esc(day(e.addedAt))}${e.status==='proposed'&&e.variants?.length?'. Heard as: '+esc(e.variants.map(v=>v.text).join(', ')):''}. It does nothing until you say so.</div><div class="wl-acts"><button type="button" class="wl-btn is-warm" data-wl-decide="confirm" data-wl-id="${esc(e.id)}"${busy}>${e.status==='proposed'?'Add to the library':'Add as a mishearing'}</button><button type="button" class="wl-btn is-quiet" data-wl-decide="reject" data-wl-id="${esc(e.id)}"${busy}>Not now</button></div></li>`;
 }
 function recentCard(e){
  const learned=(e.variants||[]).filter(v=>v.source?.kind==='confirmed-answer'),last=learned.at(-1),s=last?.source||e.source||{};
  const when=last?last.addedAt:e.addedAt;
  return `<div class="wl-learned"><b>${esc(e.spelling)}</b><span>${learned.length?'Heard as '+esc(learned.map(v=>v.text).join(', '))+'. ':''}${esc(s.story||'')}${s.story?', ':''}${esc(day(when))}</span></div>`;
 }
 function addForm(){
  const d=S.form.get('add')||{};
  return `<form class="wl-form wl-card" data-wl-add style="padding:14px 18px"><label class="grow">Spelling<input type="text" maxlength="120" required data-wl-add-spelling value="${esc(d.spelling||'')}"${off()}></label>${catSelect('add',d.cat||'person')}<label class="grow">Sometimes heard as (commas)<input type="text" maxlength="400" data-wl-add-heard value="${esc(d.heard||'')}"${off()}></label><button type="submit" class="wl-btn is-warm"${human()?'':' disabled'}>Add to the library</button><button type="button" class="wl-btn is-quiet" data-wl-add-cancel>Cancel</button></form>`;
 }
 function emptyLibrary(){
  return `<div class="wl-empty"><p class="wl-empty-t">The library has no words yet.</p><p class="wl-empty-s">Once it holds names and terms, every new recording is primed with them, known mishearings are fixed with a receipt, and anything doubtful comes here to check. Start with a seed, or add a word.</p><div class="wl-acts"><button type="button" class="wl-btn is-warm" data-wl-import="tea-terms"${human()?'':' disabled'}>Add the Teajia tea terms</button><button type="button" class="wl-btn" data-wl-import="oracle-cards"${human()?'':' disabled'}>Add hexagrams and Gene Keys</button><button type="button" class="wl-btn" data-wl-add-open${human()?'':' disabled'}>Add a word</button></div></div>`;
 }
 function html(){
  const total=S.counts?.total||0,open=S.checks.reduce((n,c)=>n+(c.open||0),0);
  const chips=`<div class="wl-chips" role="group" aria-label="Kind of word"><button type="button" class="wl-chip" data-wl-chip="" aria-pressed="${!S.category}">All<span>${total}</span></button>${CATS.map(([v,l])=>`<button type="button" class="wl-chip" data-wl-chip="${v}" aria-pressed="${S.category===v}">${esc(l)}<span>${S.counts?.byCategory?.[v]??0}</span></button>`).join('')}</div>`;
  const rows=S.lib?.entries||[],shown=S.showAll?rows:rows.slice(0,SHOW);
  let listing;
  if(!S.loaded)listing='<p class="wl-msg" role="status">Reading the library…</p>';
  else if(S.failed)listing=`<div class="wl-empty"><p class="wl-empty-t">The library could not be read.</p><p class="wl-empty-s">${esc(S.failed)} Nothing was lost. <button type="button" class="wl-btn is-quiet" data-wl-retry>Try again</button></p></div>`;
  else if(!total&&!S.q&&!S.category)listing=emptyLibrary();
  else if(!rows.length)listing=`<div class="wl-empty"><p class="wl-empty-t">No word matches${S.q?' "'+esc(S.q)+'"':''}.</p><p class="wl-empty-s">Try a shorter spelling, or another kind of word. If it is missing, add it.</p><div class="wl-acts"><button type="button" class="wl-btn" data-wl-add-open${human()?'':' disabled'}>Add a word</button></div></div>`;
  else listing=`<ul class="wl-list">${shown.map(row).join('')}</ul>${rows.length>SHOW?`<button type="button" class="wl-more" data-wl-all aria-expanded="${S.showAll}">${S.showAll?'Show fewer':'Show all '+S.lib.matched}</button>`:''}`;
  // A recording he has just finished stays on the screen as "All checked" until he leaves, instead of vanishing under his hand.
  const listed=new Set(S.checks.map(c=>c.jobId)),checking=[...S.checks.filter(c=>S.records.has(c.jobId)&&(c.open||S.focus===c.jobId||S.opened.has(c.jobId))),...[...S.touched].filter(id=>!listed.has(id)&&S.records.has(id)).map(id=>({jobId:id,open:0}))];
  const check=`<section class="wl-section" aria-label="Words to check"><div class="wl-h"><h3>To check</h3><span>${open?plural(open,'word','words')+' in '+plural(checking.filter(c=>c.open).length,'recording','recordings'):'Nothing waiting'}</span></div>${checking.length?checking.map(checkCard).join(''):`<div class="wl-empty"><p class="wl-empty-t">Nothing to check.</p><p class="wl-empty-s">When a recording finishes, words the transcript was unsure of land here as one card, kept as heard unless you say otherwise. Names it already knows are fixed on their own.</p></div>`}</section>`;
  const sug=S.proposed.length?`<section class="wl-section" aria-label="Suggested by agents"><div class="wl-h"><h3>Suggested</h3><span>${plural(S.proposed.length,'suggestion','suggestions')} waiting for you</span></div><ul class="wl-list">${S.proposed.map(proposedRow).join('')}</ul></section>`:'';
  const recent=S.recent.length?`<section class="wl-section" aria-label="Recently learned"><div class="wl-h"><h3>Recently learned</h3><span>Spellings you confirmed, now used for every recording</span></div><div class="wl-recent">${S.recent.map(recentCard).join('')}</div></section>`:'';
  const readonly=!human()?`<p class="wl-msg" role="status">You are signed in as ${esc(actor())}. Confirming a spelling is Adrian's, so these buttons are off here.</p>`:'';
  return `<div class="wl-bar"><h2 id="wl-title">Words</h2><span class="wl-note" style="color:var(--dim);font-size:13px">${total?plural(total,'word','words')+' shared by every project':'Shared by every project'}</span><span class="wl-grow"></span><button type="button" class="wl-btn" data-wl-add-open${human()?'':' disabled'}>Add a word</button><button type="button" class="wl-btn is-warm" data-wl-close>Back to Home</button></div>`
   +`<div class="wl-scroll"><div class="wl-wrap">${S.notice?`<p class="wl-msg is-bad" role="alert">${esc(S.notice)}</p>`:''}${readonly}<p class="wl-lede">One list of names and terms for every transcription. A word you confirm here primes the next recordings in any project, and a known mishearing is fixed on its own, with a receipt.</p>`
   +(S.adding?addForm():'')+check+sug+recent
   +`<section class="wl-section" aria-label="All words"><div class="wl-h"><h3>All words</h3><span>${S.lib?S.lib.matched+(S.q||S.category?' match':' in the library'):''}</span></div><div class="wl-controls"><input type="search" placeholder="Search a word or a way it was misheard" aria-label="Search the library" data-wl-search value="${esc(S.q)}"></div>${chips}${listing}</section></div></div>`;
 }
 function screen(){
  let d=document.getElementById('words-library');if(d)return d;
  d=document.createElement('dialog');d.id='words-library';d.className='wl-screen';d.setAttribute('aria-labelledby','wl-title');
  d.addEventListener('cancel',event=>{event.preventDefault();close();});
  document.body.append(d);return d;
 }
 function paint(){
  const d=document.getElementById('words-library');if(!d?.open)return;
  if([...d.querySelectorAll('audio[data-wl-audio]')].some(a=>!a.paused&&!a.ended))return;
  const next=html();if(d.dataset.render===next)return;
  // A re-render must not eat what he is typing or move the page under him.
  const scroller=d.querySelector('.wl-scroll'),top=scroller?.scrollTop||0,a=document.activeElement;
  const keep=a&&d.contains(a)&&a.matches('input,select')?{sel:a.matches('[data-wl-search]')?'[data-wl-search]':a.dataset.wlSpelling?`[data-wl-spelling="${CSS.escape(a.dataset.wlSpelling)}"]`:a.matches('[data-wl-add-spelling]')?'[data-wl-add-spelling]':a.matches('[data-wl-add-heard]')?'[data-wl-add-heard]':'',start:a.selectionStart,end:a.selectionEnd}:null;
  d.innerHTML=next;d.dataset.render=next;
  const s2=d.querySelector('.wl-scroll');if(s2)s2.scrollTop=top;
  if(keep?.sel){const n=d.querySelector(keep.sel);if(n){n.focus({preventScroll:true});try{n.setSelectionRange(keep.start,keep.end);}catch{}}}
 }
  /* The Words card in Home's right-hand lists, with the number of words waiting. Home re-renders its lists, so the card
    is put back whenever it goes missing. */
 const cardHtml=()=>{
  const total=S.counts?.total||0,n=S.checks.reduce((sum,c)=>sum+(c.open||0),0);
  const line=!S.loaded?'':total?plural(total,'word','words')+' shared by every project.'+(n?' <b>'+plural(n,'word','words')+' to check.</b>':' Nothing to check.'):'No words yet. Add some, or seed it from the tea terms.';
  return '<h2>Words</h2>'+(line?'<p>'+line+'</p>':'')+'<p><button type="button" class="wl-open" data-wl-open>Open Words'+(n?'<span class="wl-count" aria-label="'+plural(n,'word','words')+' to check">'+n+'</span>':'')+'</button></p>';
 };
 function updateButton(){const card=document.querySelector('#project-library [data-home-words]');if(card){const html=cardHtml();if(card.dataset.render!==html){card.innerHTML=html;card.dataset.render=html;}}}
 function decorate(){
  if(!window.document)return;
  const aside=document.querySelector('#project-library .combined-home-lists');
  if(!aside)return;
  if(!aside.querySelector(':scope>[data-home-words]')){
   const card=document.createElement('section');card.className='combined-home-list';card.dataset.homeWords='';card.setAttribute('aria-label','Words');
   aside.append(card);updateButton();
   // Home opened: read the count of words waiting.
   void load();
  }
  const home=document.getElementById('project-library');
  if(home&&home!==watchedHome){watchedHome=home;new MutationObserver(()=>{if(home.open&&!document.getElementById('words-library')?.open)void load();}).observe(home,{attributes:true,attributeFilter:['open']});}
 }

 /* ---------- open and close ---------- */
 function open(focus=''){
  const d=screen();S.focus=focus||S.focus;
  if(!d.open)d.showModal();
  try{if(location.hash.replace(/^#/,'').split('/')[0]!=='words')history.replaceState(null,'','#words'+(focus?'/check/'+focus:''));}catch{}
  paint();void load().then(()=>{if(S.focus){const card=d.querySelector(`[data-wl-rec="${CSS.escape(S.focus)}"]`);card?.scrollIntoView({block:'start'});}});
  return d;
 }
 function close(){
  const d=document.getElementById('words-library');if(d?.open)d.close();
  S.focus='';S.touched.clear();try{if(/^#words/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);}catch{}
  void load();
 }
 function fromHash(){
  const m=/^#words(?:\/check\/([a-f0-9-]{36}))?$/.exec(location.hash||'');
  if(m)open(m[1]||'');
 }

 /* ---------- events ---------- */
 document.addEventListener('play',event=>{
  const a=event.target;if(!a?.matches?.('#words-library audio[data-wl-audio]'))return;
  const from=Number(a.dataset.audioStart),to=Number(a.dataset.audioEnd);
  if(a.currentTime<from||a.currentTime>=to)a.currentTime=from;
 },true);
 document.addEventListener('timeupdate',event=>{
  const a=event.target;if(!a?.matches?.('#words-library audio[data-wl-audio]'))return;
  if(a.currentTime>=Number(a.dataset.audioEnd)&&!a.paused)a.pause();
 },true);
 document.addEventListener('error',event=>{
  const a=event.target;if(!a?.matches?.('#words-library audio[data-wl-audio]'))return;
  const status=a.parentElement.querySelector('.wl-audio-status');if(status)status.textContent='Audio could not be played. Open the recording to check its availability.';
 },true);
 for(const name of ['pause','ended'])document.addEventListener(name,event=>{
  if(event.target?.matches?.('#words-library audio[data-wl-audio]'))setTimeout(paint,0);
 },true);
 const itemOf=key=>{const [jobId,k]=key.split('|');return {jobId,key:k,item:S.records.get(jobId)?.items.find(i=>i.key===k)};};
 const reply=(jobId,v)=>{if(v&&v.items){S.records.set(jobId,v);S.touched.add(jobId);}};
 document.addEventListener('click',event=>{
  const t=event.target;if(!t.closest)return;
  if(t.closest('[data-wl-open]')){event.preventDefault();open();return;}
  const d=t.closest('#words-library');if(!d)return;
  if(t.closest('[data-wl-close]')){close();return;}
  if(t.closest('[data-wl-retry]')){void load();return;}
  if(t.closest('[data-wl-all]')){S.showAll=!S.showAll;paint();return;}
  const chip=t.closest('[data-wl-chip]');if(chip){S.category=chip.dataset.wlChip;S.showAll=false;void load();return;}
  if(t.closest('[data-wl-add-open]')){S.adding=true;paint();d.querySelector('[data-wl-add-spelling]')?.focus();return;}
  if(t.closest('[data-wl-add-cancel]')){S.adding=false;paint();return;}
  const imp=t.closest('[data-wl-import]');
  if(imp&&!imp.disabled){const source=imp.dataset.wlImport;void run('import|'+source,async()=>{const r=await post('import',{source});S.notice='';S.lastImport=r;},'That seed could not be added. Nothing changed.');return;}
  const decide=t.closest('[data-wl-decide]');
  if(decide&&!decide.disabled){const id=decide.dataset.wlId,decision=decide.dataset.wlDecide;void run('decide|'+id,()=>post('decide',{id,decision}));return;}
  const keep=t.closest('[data-wl-keep]');
  if(keep&&!keep.disabled){const {jobId,key}=itemOf(keep.dataset.wlKeep);void run(keep.dataset.wlKeep,async()=>reply(jobId,await post('answer',{jobId,key,choice:'keep'})));return;}
  const use=t.closest('[data-wl-use]');
  if(use&&!use.disabled){const {jobId,key}=itemOf(use.dataset.wlUse);void run(use.dataset.wlUse,async()=>reply(jobId,await post('answer',{jobId,key,choice:'suggestion'})));return;}
  const mode=t.closest('[data-wl-mode]');
  if(mode&&!mode.disabled){const k=mode.dataset.wlKey,cur=S.form.get(k);cur?.mode===mode.dataset.wlMode?S.form.delete(k):S.form.set(k,{mode:mode.dataset.wlMode,cat:'other',value:itemOf(k).item?.word});paint();d.querySelector(`[data-wl-spelling="${CSS.escape(k)}"]`)?.focus();return;}
 });
 document.addEventListener('change',event=>{
  const sel=event.target.closest?.('#words-library select[data-wl-cat]');if(!sel)return;
  const k=sel.dataset.wlCat;if(k==='add'){S.form.set('add',{...(S.form.get('add')||{}),cat:sel.value});return;}
  const f=S.form.get(k);if(f)f.cat=sel.value;
 });
 document.addEventListener('input',event=>{
  const t=event.target;if(!t.closest?.('#words-library'))return;
  if(t.matches('[data-wl-search]')){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{S.q=t.value.trim();S.showAll=false;void load();},200);return;}
  if(t.dataset.wlSpelling){const f=S.form.get(t.dataset.wlSpelling);if(f)f.value=t.value;return;}
  if(t.matches('[data-wl-add-spelling]'))S.form.set('add',{...(S.form.get('add')||{}),spelling:t.value});
  if(t.matches('[data-wl-add-heard]'))S.form.set('add',{...(S.form.get('add')||{}),heard:t.value});
 });
 document.addEventListener('submit',event=>{
  const form=event.target.closest?.('#words-library form');if(!form)return;event.preventDefault();
  if(form.matches('[data-wl-add]')){
   const spelling=form.querySelector('[data-wl-add-spelling]').value.trim(),heard=form.querySelector('[data-wl-add-heard]').value.split(',').map(s=>s.trim()).filter(Boolean),category=form.querySelector('select').value;
   if(!spelling){S.notice='Write the spelling first.';paint();return;}
   void run('add',async()=>{await post('add',{spelling,category,variants:heard});S.adding=false;S.form.delete('add');});return;
  }
  const key=form.dataset.wlSpell||form.dataset.wlRight,{jobId,key:k,item}=itemOf(key||'');if(!item)return;
  const cat=form.querySelector('select')?.value;
  if(form.dataset.wlRight!==undefined){void run(key,async()=>{reply(jobId,await post('answer',{jobId,key:k,choice:'right',category:cat}));S.form.delete(key);});return;}
  const spelling=form.querySelector('input[type=text]').value.trim();
  if(!spelling){S.notice='Write the spelling first.';paint();return;}
  void run(key,async()=>{reply(jobId,await post('answer',{jobId,key:k,choice:'spelling',spelling,...(item.kind==='number'?{}:{category:cat})}));S.form.delete(key);});
 });
 document.addEventListener('toggle',event=>{const d=event.target;if(d?.matches?.('#words-library .wl-card')){const id=d.dataset.wlRec;d.open?S.opened.add(id):S.opened.delete(id);}},true);
 window.addEventListener('hashchange',fromHash);
 new MutationObserver(decorate).observe(document.documentElement,{childList:true,subtree:true});
 decorate();
 // The count on the Words button comes from the same read; Home asks for it when it opens.
 const refreshSoon=()=>{if(document.querySelector('#project-library[open]')&&!document.getElementById('words-library')?.open)void load();};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshSoon();});
 setTimeout(()=>{fromHash();refreshSoon();},0);
 window.wordsLibrary={open,close,load,state:()=>S,html};
})();
