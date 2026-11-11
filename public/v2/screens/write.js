/* Version two: Write. The words of one piece of one subject, on the approved page, with an assistant's suggestions beside
   them. Address: #/write/<subject>?piece=<output id>. It reads the draft with study-draft.read, saves his words with
   study-draft.save (the revision he read goes with them), lists suggestions with study-ai.requests and study-ai.review,
   and takes or turns one down with study-ai.accept and study-ai.reject. Only he decides: an assistant's save or decision
   answers 403 and the screen shows that message. A newer saved version is never merged for him and never written over:
   he sees both and chooses. Unsaved words are kept on this device across a reload. Every rule starts with .wr. */
(function(v2){
 'use strict';
 const {esc,icon}=v2.ui,root=window,doc=document;
 const OWN={side:'M4 5h16v14H4zM9 5v14',focus:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'};
 const own=name=>`<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${OWN[name]}"/></svg>`;
 const uuid=()=>root.V2Client.uuid();
 const clock=iso=>{try{return new Date(iso).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}catch{return '';}};
 const AUTOSAVE_MS=1500;

 // ---------- pure helpers (pinned by tests/v2-write.test.mjs) ----------
 /** The passages he can see: an empty protected placeholder is hidden, as in the existing workspace. */
 function rowsOf(read){
  return (read?.projection||[]).filter(b=>!(b.safe===false&&String(b.words||'')==='')).map(b=>({id:b.id,kind:b.blockKind||'paragraph',level:Number(b.level||b.frame?.level)||2,words:String(b.words||''),safe:b.safe!==false,hash:b.blockHash}));
 }
 /** The smallest change from one text to another: {from,to,insert}, or null when they are the same. */
 function minimalDiff(before,after){
  if(before===after)return null;
  let from=0;while(from<before.length&&from<after.length&&before[from]===after[from])from++;
  if(from&&/[\uDC00-\uDFFF]/.test(before[from]||after[from]||''))from--;
  let oldEnd=before.length,newEnd=after.length;
  while(oldEnd>from&&newEnd>from&&before[oldEnd-1]===after[newEnd-1]){oldEnd--;newEnd--;}
  if(/[\uDC00-\uDFFF]/.test(before[oldEnd]||after[newEnd]||'')){oldEnd++;newEnd++;}
  return {from,to:oldEnd,insert:after.slice(from,newEnd)};
 }
 /** The operations study-draft.save takes for his unsaved words: a text change per edited passage, then each new
     paragraph inserted before the passage that follows its place. */
 function buildOps({rows,edits,added}){
  const ops=[],byId=new Map(rows.map(r=>[r.id,r]));
  for(const r of rows){
   if(!r.safe||!edits.has(r.id))continue;
   const d=minimalDiff(r.words,edits.get(r.id).text);
   if(d)ops.push({kind:'text',id:r.id,...d,seenBlockHash:r.hash});
  }
  const anchorOf=a=>{let id=a.afterId,guard=0;while(id&&!byId.has(id)&&guard++<1000){const p=added.find(x=>x.id===id);id=p?p.afterId:null;}return id;};
  for(const a of added){
   const text=String(a.text||'').trim();if(!text)continue;
   const anchor=anchorOf(a),at=anchor?rows.findIndex(r=>r.id===anchor):-1;
   ops.push({kind:'insert',id:a.id,beforeId:at>=0?(rows[at+1]?.id??null):null,raw:text});
  }
  return ops;
 }
 const flat=text=>String(text??'').replace(/\s*[\r\n]+\s*/g,' ');
 /** Which of a suggestion's replacements can be shown on a passage he can see. */
 const proposalView=(item,review)=>({id:item.id,by:item.proposedBy?.actor||'',purpose:review.purpose||item.purpose||'',
  replacements:Array.isArray(review.replacements)?review.replacements.filter(r=>r&&typeof r.id==='string'&&typeof r.words==='string'):[],
  simple:!(review.purpose||item.purpose)});
 v2.shared.write=Object.freeze({rowsOf,minimalDiff,buildOps,flat,proposalView});

 let live=null;// the open screen, so leaving it can save and clean up

 v2.screen({id:'write',route:'write/:id',title:'Write',
  render:()=>'<div class="v2-page wr" data-wr><p class="wr-wait" role="status">Opening the writing.</p></div>',
  mount(el,ctx){live=open(el.querySelector('[data-wr]'),ctx);return live.ready;},
  unmount(){live?.leave();live=null;}});

 function open(page,ctx){
  const id=ctx.params.id;
  const st={standing:null,form:null,forms:[],bindingId:null,piece:null,base:null,rows:[],edits:new Map(),added:[],
   saving:false,again:false,savedAt:null,status:'',problem:'',stopped:false,conflict:null,props:[],dropped:0,sources:null,
   src:root.matchMedia&&root.matchMedia('(min-width:1101px)').matches,focus:false,reading:true,ops:new Set(),owner:true};
  let timer=null,propTimer=null,presenceTimer=null,presenceSeq=0,presenceOk=true,presenceSent='',gone=false;
  const session=uuid().slice(0,8);
  const $=sel=>page.querySelector(sel);
  const scope=()=>({bindingId:st.bindingId,parentStudyId:id});
  const dirty=()=>[...st.edits.keys()].length>0||st.added.some(a=>String(a.text).trim());
  const say=(text,tone='info')=>v2.ui.say(text,{tone});

  // ---------- reading ----------
  async function locate(){
   const s=await v2.call('subject.standing',{parentStudyId:id});if(ctx.signal.aborted)return false;
   st.standing=s;const forms=s.forms||[];st.forms=forms;
   const articles=forms.filter(f=>f.kind==='article');
   st.form=articles.find(f=>f.id===ctx.query.piece)||articles[0]||null;
   st.bindingId=s.facts?.bindingId||null;
   st.piece=st.form&&/^out:/.test(st.form.key||'')?st.form.id:null;
   if(st.piece&&st.bindingId){
    try{
     const outs=await v2.call('study.outputs',{rootBindingId:st.bindingId,parentStudyId:id,selectedOutputId:st.piece});
     const owner=(outs?.outputBindings||[]).find(b=>b.outputId===st.piece)?.wordOwner;
     if(owner&&owner.kind==='native'&&owner.bindingId)st.bindingId=owner.bindingId;
     else if(owner&&owner.kind!=='native')st.bindingId=null;
    }catch{/* the subject's own words stay the owner */}
   }
   ctx.setTitle(s.title||'Write');if(s.look)v2.brand(s.look);
   ctx.setAdvanced({subject:id,piece:st.piece||undefined,section:'write'});
   return true;
  }
  const adv=section=>v2.advanced({subject:id,piece:st.piece||undefined,section});
  const readDraft=()=>v2.call('study-draft.read',scope());

  // ---------- the unsaved words, kept on this device ----------
  const KEY=()=>'ar-v2-write:'+st.bindingId;
  function stash(){
   try{
    if(!dirty()){root.localStorage.removeItem(KEY());return;}
    root.localStorage.setItem(KEY(),JSON.stringify({v:1,at:Date.now(),draft:st.base?.expected?.workflow?.draft||'',
     edits:[...st.edits].map(([k,v])=>[k,v.text,v.orig]),added:st.added.filter(a=>String(a.text).trim()).map(a=>({id:a.id,afterId:a.afterId,text:a.text}))}));
   }catch{/* private window or blocked storage: the words are still on the page */}
  }
  function unstash(){
   try{
    const s=JSON.parse(root.localStorage.getItem(KEY())||'null');
    if(!s||s.v!==1||!Array.isArray(s.edits)||!Array.isArray(s.added))return null;return s;
   }catch{return null;}
  }

  // ---------- who is where: tells an assistant he has unsaved words open ----------
  function presence(force=false){
   if(!presenceOk||gone||!st.bindingId||!v2.isHuman())return;
   const d=dirty(),sig=String(d);if(!d&&!presenceSent)return;/* nothing to tell until he has unsaved words */if(!force&&sig===presenceSent)return;presenceSent=sig;
   v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:d,sequence:++presenceSeq,session}).catch(()=>{presenceOk=false;});
  }

  // ---------- the order on the page: his passages, with new paragraphs after the one they follow ----------
  function ensureTail(){
   const last=st.rows.length?st.rows[st.rows.length-1].id:null;
   const tail=st.added[st.added.length-1];
   if(!tail||String(tail.text).trim()){
    const lastAdded=st.added.length?st.added[st.added.length-1]:null;
    st.added.push({id:uuid(),afterId:lastAdded?lastAdded.id:last,text:''});
   }
  }
  function order(){
   const out=[],ids=new Set(st.rows.map(r=>r.id)),kids=new Map();
   for(const a of st.added){const key=ids.has(a.afterId)||st.added.some(x=>x.id===a.afterId)?a.afterId:(st.rows.at(-1)?.id??null);if(!kids.has(key))kids.set(key,[]);kids.get(key).push(a);}
   const addKids=key=>{for(const a of kids.get(key)||[]){out.push({id:a.id,kind:'paragraph',level:0,text:a.text,safe:true,fresh:true});addKids(a.id);}};
   addKids(null);
   for(const r of st.rows){out.push({id:r.id,kind:r.kind,level:r.level,text:st.edits.get(r.id)?.text??r.words,safe:r.safe,fresh:false});addKids(r.id);}
   return out;
  }

  // ---------- drawing ----------
  const BAR_ICON={back:icon('back')};
  function formTab(f){
   const here=st.form&&f.key===st.form.key;
   const href=f.kind==='article'?v2.href('write/:id',{id},{piece:/^out:/.test(f.key)?f.id:undefined}):v2.href('subject/:id',{id},{form:f.key});
   return `<a href="${esc(href)}"${here?' aria-current="page"':''}>${esc(f.name||'Piece')}</a>`;
  }
  function shell(){
   const read=`<a href="${esc(adv('read'))}" title="Opens Read in Advanced">Read</a>`,check=`<a href="${esc(adv('check'))}" title="Opens Check in Advanced">Check</a>`;
   page.innerHTML=`<div class="wr-bar" data-wr-bar>
    <a class="wr-back" href="${esc(v2.href('subject/:id',{id}))}" aria-label="Back to the subject">${BAR_ICON.back}<span>The subject</span></a>
    <nav class="wr-tabs" aria-label="Pieces of this subject">${st.forms.map(formTab).join('')}<a href="${esc(v2.href('subject/:id',{id}))}" aria-label="Add a piece on the subject page" title="Add a form on the subject page">${icon('plus')}</a></nav>
    <div class="wr-seg" role="group" aria-label="Write, Read or Check"><span aria-current="true">Write</span>${read}${check}</div>
    <span class="wr-sp"></span>
    <span class="wr-saved" data-wr-saved></span>
    <button type="button" data-wr="src" aria-pressed="${st.src}" aria-label="Sources">${own('side')}<span>Sources</span></button>
    <button type="button" class="v2-ghost" data-wr="ask" aria-label="Ask">${icon('ask')}<span>Ask</span></button>
    <button type="button" class="v2-ghost" data-wr="focus" aria-label="Focus">${own('focus')}<span>Focus</span></button>
   </div>
   <div class="wr-focusbar" hidden><span>${esc(st.standing?.title||'')} / ${esc(st.form?.name||'Article')}</span><button type="button" class="v2-ghost" data-wr="unfocus">Leave focus</button></div>
   <div class="wr-work" data-src="${st.src?'open':'closed'}">
    <aside class="wr-src" data-wr-src aria-label="Sources"></aside>
    <article class="wr-paper"><div class="wr-sheet">
     <div class="wr-conflict" data-wr-conflict hidden></div>
     <p class="wr-saved wr-saved-m" data-wr-saved role="status"></p>
     <h1 class="wr-title">${esc(st.form?.title||st.standing?.title||'')}</h1>
     <div class="wr-text" data-wr-text></div>
     <div class="wr-loose" data-wr-loose></div>
     <section class="wr-todo" aria-label="Still to write"><p class="wr-label">Still to write</p>${v2.ui.notBuilt('The list of parts still to write.',{advanced:{subject:id,piece:st.piece||undefined,section:'write'}})}</section>
     <p class="wr-out"><a href="${esc(adv('write'))}" data-wr-advanced>Open in Advanced${icon('out')}</a></p>
    </div></article>
   </div>`;
   paintSources();paintText();paintSaved();
  }
  function rowHTML(r,n){
   const label=r.kind==='heading'?'Heading':'Paragraph '+n;
   if(!r.safe)return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><p class="wr-lock" title="This passage has formatting that is kept as it is. Change it in Advanced.">${esc(r.text)}</p><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
   const cls=r.kind==='heading'?' wr-h':r.kind==='blockquote'?' wr-q':'';
   return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><textarea class="wr-ed${cls}" rows="1" data-ed="${esc(r.id)}" aria-label="${esc(label)}" spellcheck="true"${r.fresh&&!r.text?' placeholder="Write here"':''}>${esc(r.text)}</textarea><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
  }
  function paintText(){
   const box=$('[data-wr-text]');if(!box)return;
   const keep=doc.activeElement?.dataset?.ed?{id:doc.activeElement.dataset.ed,a:doc.activeElement.selectionStart,b:doc.activeElement.selectionEnd}:null;
   ensureTail();let n=0;
   box.innerHTML=order().map(r=>rowHTML(r,r.kind==='heading'?0:++n)).join('');
   box.querySelectorAll('textarea').forEach(fit);
   paintNotes();
   if(keep){const t=box.querySelector(`[data-ed="${CSS.escape(keep.id)}"]`);if(t){t.focus({preventScroll:true});try{t.setSelectionRange(keep.a,keep.b);}catch{}}}
  }
  function fit(t){t.style.height='auto';t.style.height=(t.scrollHeight+1)+'px';}
  function paintSaved(){
   const text=st.problem?st.problem:st.saving?'Saving':dirty()||st.conflict?(st.conflict?'Not saved: a newer version exists':'Not saved yet'):st.savedAt?'Saved '+clock(st.savedAt):'Saved';
   page.querySelectorAll('[data-wr-saved]').forEach(el=>{el.textContent=text;el.dataset.tone=st.problem||st.conflict?'bad':'';});
  }
  function paintSources(){
   const box=$('[data-wr-src]');if(!box)return;
   const list=(st.sources||[]).map(s=>`<li><b>${esc(s.title)}</b><small>${esc(s.kind)}</small></li>`).join('');
   const body=st.sources===null?'<p class="wr-dim" role="status">Reading the sources</p>':list?`<ul class="wr-src-l">${list}</ul>`:'<p class="wr-dim">No material is attached to this subject yet.</p>';
   box.innerHTML=`<div class="wr-src-h"><h2>Sources</h2><span>${st.sources?esc(st.sources.length)+', one list':''}</span><button type="button" class="v2-ghost v2-icon-btn" data-wr="src" aria-label="Close sources">${icon('close')}</button></div>${body}
    <div class="wr-play">${v2.ui.notBuilt('Playing a recording and reading its transcript beside the page.',{advanced:{subject:id,section:'source'}})}</div>`;
  }
  const kindName=s=>{const k=String(s.kind||s.role||'').toLowerCase();return /record|audio|voice/.test(k)?'Recording':/note/.test(k)?'Your note':/photo|image/.test(k)?'Photograph':/link|web/.test(k)?'Link':'Source';};
  async function loadSources(){
   try{
    const r=await v2.call('study-ai.read',scope());if(ctx.signal.aborted)return;
    st.sources=(r.sourceCatalog||[]).filter(s=>!/^author-page:/.test(String(s.id))&&s.title&&s.id!=='collection-initial-edition'&&!s.missing).map(s=>({title:String(s.title),kind:kindName(s)}));
   }catch{st.sources=[];}
   paintSources();
  }

  // ---------- suggestions ----------
  async function loadProps(){
   if(!st.bindingId)return;
   try{
    const list=await v2.call('study-ai.requests',scope());if(ctx.signal.aborted)return;
    const items=list.items||[],pending=items.filter(i=>i.status==='pending'&&!i.stale);
    const reviews=await Promise.all(pending.map(i=>v2.call('study-ai.review',{...scope(),requestId:i.id}).catch(()=>null)));
    if(ctx.signal.aborted)return;
    st.props=pending.map((i,k)=>reviews[k]&&reviews[k].status==='pending'&&!reviews[k].stale?proposalView(i,reviews[k]):null).filter(Boolean);
    st.dropped=items.filter(i=>i.status==='pending'&&i.stale).length;
   }catch{st.props=[];}
   paintNotes();
  }
  function paintNotes(){
   const box=$('[data-wr-text]');if(!box)return;
   box.querySelectorAll('.wr-drafts').forEach(n=>{n.innerHTML='';});box.querySelectorAll('.wr-margin').forEach(n=>{n.innerHTML='';});
   const loose=$('[data-wr-loose]');let looseHTML='';
   st.props.forEach((p,k)=>{
    const n=k+1,by=v2.actorName(p.by||'agent:'),shown=p.replacements.filter(r=>box.querySelector(`[data-row="${CSS.escape(r.id)}"]`));
    for(const r of shown){
     const row=box.querySelector(`[data-row="${CSS.escape(r.id)}"]`);
     row.querySelector('.wr-drafts').insertAdjacentHTML('beforeend',`<p class="wr-draft"><sup>${n}</sup>${esc(r.words)}</p>`);
    }
    const note=noteHTML(p,n,by,shown.length);
    if(shown.length)box.querySelector(`[data-row="${CSS.escape(shown[0].id)}"] .wr-margin`).insertAdjacentHTML('beforeend',note);
    else looseHTML+=`<div class="wr-loosenote">${note}</div>`;
   });
   if(loose)loose.innerHTML=looseHTML+(st.dropped?`<p class="wr-dim wr-stale">${esc(st.dropped===1?'A suggestion was set aside because the words changed after it was made.':st.dropped+' suggestions were set aside because the words changed after they were made.')}</p>`:'');
  }
  function noteHTML(p,n,by,shown){
   const reply=p.simple&&p.replacements.length;
   const head=`<p class="wr-note-h"><sup>${n}</sup>${esc(reply?by+' suggests new words':by+' wrote more for this piece')}</p>`;
   if(!reply)return `<div class="wr-note" data-prop="${esc(p.id)}">${head}<p class="wr-dim">Read it through before any of it becomes yours.</p><div class="wr-row-btns"><a class="wr-btn" href="${esc(adv('write'))}">Read it in Advanced${icon('out')}</a></div></div>`;
   const many=p.replacements.length>1?` for ${p.replacements.length} paragraphs`:'';
   return `<div class="wr-note" data-prop="${esc(p.id)}">${head}<p class="wr-dim">${esc('Shown dim'+many+'. They stay dim until you accept them.')}</p><div class="wr-row-btns"><button type="button" class="pri" data-act="accept" data-id="${esc(p.id)}">Accept</button><button type="button" class="v2-ghost" data-act="reject" data-id="${esc(p.id)}">Dismiss</button></div></div>`;
  }

  // ---------- the conflict: his words and the newer saved ones, side by side ----------
  function paintConflict(){
   const box=$('[data-wr-conflict]');if(!box)return;
   const c=st.conflict;box.hidden=!c;if(!c){box.innerHTML='';return;}
   const fresh=new Map(rowsOf(c.fresh).map(r=>[r.id,r])),mine=[];
   for(const [rid,e] of st.edits){const f=fresh.get(rid);mine.push({yours:e.text,saved:f?f.words:null,same:f&&f.words===e.orig});}
   const added=st.added.filter(a=>String(a.text).trim());
   const lines=mine.map(m=>`<li><p><b>Yours</b> ${esc(m.yours)}</p><p><b>Saved</b> ${m.saved===null?'<i>This paragraph is not in the saved version.</i>':m.same?'<i>Not changed in the saved version.</i>':esc(m.saved)}</p></li>`)
    .concat(added.map(a=>`<li><p><b>Yours</b> ${esc(a.text)}</p><p><b>Saved</b> <i>A new paragraph. It is not in the saved version.</i></p></li>`)).join('');
   const h=(c.fresh.history||[]).filter(x=>x.state==='committed').slice(-1)[0];
   const by=h&&h.actor&&!/unknown/.test(h.actor)?v2.actorName(h.actor)+(h.modifiedAt?' at '+clock(h.modifiedAt):''):'';
   box.innerHTML=`<h2>A newer version of this piece is saved${by?' by '+esc(by.replace(/^You/,'you')):''}</h2>
    <p class="wr-dim">Your words are still here and are not saved. Choose which to keep. Nothing is mixed for you.</p>
    <ul class="wr-pairs">${lines||'<li><p class="wr-dim">You have no unsaved words. The saved version is the newer one.</p></li>'}</ul>
    <div class="wr-row-btns"><button type="button" class="pri" data-act="mine">Keep my words</button><button type="button" data-act="theirs">Use the saved version</button></div>`;
  }
  async function noticeNewer(fresh){
   st.conflict={fresh};st.problem='';paintConflict();paintSaved();
  }
  async function useSaved(){
   const fresh=st.conflict?.fresh||await readDraft();
   st.edits.clear();st.added=[];st.conflict=null;adopt(fresh);paintConflict();stash();presence();paintSaved();
  }
  async function keepMine(){
   const c=st.conflict;if(!c)return;
   // His edits go on top of the saved version. A paragraph the saved version no longer has comes back as a new one.
   const fresh=new Map(rowsOf(c.fresh).map(r=>[r.id,r]));let after=c.fresh?rowsOf(c.fresh).at(-1)?.id??null:null;
   for(const [rid,e] of [...st.edits]){
    const f=fresh.get(rid);
    if(!f||!f.safe){st.edits.delete(rid);st.added.push({id:uuid(),afterId:after,text:e.text});}
    else if(f.words===e.text)st.edits.delete(rid);else st.edits.set(rid,{text:e.text,orig:f.words});
   }
   st.base=c.fresh;st.rows=rowsOf(c.fresh);st.conflict=null;st.problem='';st.stopped=false;paintConflict();paintText();stash();await save();
  }

  // ---------- taking in a server version ----------
  function adopt(read){
   const before=st.rows.map(r=>r.id).join();
   st.base=read;st.rows=rowsOf(read);
   const h=(read.history||[]).filter(x=>x.state==='committed'&&x.modifiedAt).slice(-1)[0];
   if(h&&!st.savedAt)st.savedAt=h.modifiedAt;
   for(const [rid,e] of [...st.edits]){const r=st.rows.find(x=>x.id===rid);if(!r)st.edits.delete(rid);else if(r.words===e.text)st.edits.delete(rid);else e.orig=r.words;}
   const ids=new Set(st.rows.map(r=>r.id));
   st.added=st.added.filter(a=>!ids.has(a.id));
   paintText();
  }

  // ---------- saving ----------
  function say403(error){st.problem=error.message;st.stopped=true;say(error.message,'bad');}
  async function save({quiet=false}={}){
   if(st.conflict||!st.bindingId)return;
   if(st.saving){st.again=true;return;}
   const ops=buildOps({rows:st.rows,edits:st.edits,added:st.added});
   if(!ops.length){st.problem='';paintSaved();stash();return;}
   const sent={edits:new Map([...st.edits].map(([k,v])=>[k,v.text])),added:new Map(st.added.map(a=>[a.id,a.text]))};
   const operationId=uuid();st.ops.add(operationId);st.saving=true;st.problem='';paintSaved();
   try{
    const result=await v2.call('study-draft.save',{...scope(),operationId,expected:st.base.expected,operations:ops});
    // What he typed while this was saving stays; only what was saved is settled.
    for(const [rid,text] of sent.edits){if(st.edits.get(rid)?.text===text)st.edits.delete(rid);}
    st.added=st.added.filter(a=>!(sent.added.has(a.id)&&sent.added.get(a.id)===a.text&&String(a.text).trim()));
    adopt(result);st.savedAt=new Date().toISOString();st.stopped=false;
    stash();presence();loadProps();
   }catch(error){
    if(error.kind==='stale'){try{await noticeNewer(await readDraft());}catch{st.problem='Could not save. Your words are kept on this device.';}}
    else if(error.kind==='owner-only'){say403(error);}
    else{st.problem=error.kind==='held'||error.kind==='refused'?error.message:'Could not save. Your words are kept on this device.';st.stopped=error.kind==='refused'||error.kind==='held';if(!quiet)say(error.message,'bad');if(!st.stopped)schedule(5000);}
   }finally{
    st.saving=false;paintSaved();
    if(st.again){st.again=false;if(dirty())schedule(300);}
   }
  }
  function schedule(ms=AUTOSAVE_MS){clearTimeout(timer);if(gone||st.stopped||st.conflict)return;timer=setTimeout(()=>{void save({quiet:true});},ms);}

  // ---------- typing ----------
  function onInput(t){
   const rid=t.dataset.ed,value=flat(t.value);
   if(value!==t.value){const at=t.selectionStart;t.value=value;try{t.setSelectionRange(at,at);}catch{}}
   fit(t);
   const row=st.rows.find(r=>r.id===rid);
   if(row){if(value===row.words)st.edits.delete(rid);else st.edits.set(rid,{text:value,orig:st.edits.get(rid)?.orig??row.words});}
   else{const a=st.added.find(x=>x.id===rid);if(a)a.text=value;}
   st.problem='';st.stopped=false;paintSaved();stash();presence();schedule();
  }
  function focusEditor(rid,at){
   const t=page.querySelector(`[data-ed="${CSS.escape(rid)}"]`);if(!t)return;t.focus();try{t.setSelectionRange(at,at);}catch{}
   t.scrollIntoView?.({block:'nearest'});
  }
  async function enter(t){
   const rid=t.dataset.ed,at=t.selectionStart,atEnd=at>=t.value.length&&t.selectionEnd>=t.value.length;
   const a=st.added.find(x=>x.id===rid);
   if(atEnd){
    const nextAdded=st.added.find(x=>x.afterId===rid);
    if(!t.value.trim())return;// a paragraph that is empty is not followed by another
    if(nextAdded&&!String(nextAdded.text).trim()){focusEditor(nextAdded.id,0);return;}
    const fresh={id:uuid(),afterId:rid,text:''};
    st.added.splice(a?st.added.indexOf(a)+1:st.added.length,0,fresh);paintText();focusEditor(fresh.id,0);return;
   }
   if(a){const head=t.value.slice(0,at),tail=t.value.slice(at);a.text=head;const fresh={id:uuid(),afterId:rid,text:tail};st.added.splice(st.added.indexOf(a)+1,0,fresh);paintText();stash();focusEditor(fresh.id,0);return;}
   // In the middle of a saved paragraph: save his words first, then split it where the caret was.
   clearTimeout(timer);await save();if(st.conflict||st.problem||dirty())return;
   const row=st.rows.find(r=>r.id===rid);if(!row)return;
   const newId=uuid(),operationId=uuid();st.ops.add(operationId);st.saving=true;paintSaved();
   try{
    const result=await v2.call('study-draft.save',{...scope(),operationId,expected:st.base.expected,operations:[{kind:'split',id:rid,at:Math.min(at,row.words.length),newId}]});
    adopt(result);st.savedAt=new Date().toISOString();loadProps();focusEditor(newId,0);
   }catch(error){
    if(error.kind==='stale'){try{await noticeNewer(await readDraft());}catch{}}else if(error.kind==='owner-only')say403(error);else say(error.message,'bad');
   }finally{st.saving=false;paintSaved();}
  }

  // ---------- suggestions: his to accept or turn down ----------
  async function decide(kind,rid){
   if(v2.isHuman()&&dirty()){say('Your words are not saved yet. They save by themselves in a moment; then you can decide.','warn');return;}
   const prop=st.props.find(p=>p.id===rid);
   try{
    if(kind==='accept'){
     const result=await v2.call('study-ai.accept',{...scope(),requestId:rid});
     if(Array.isArray(result?.projection)&&!dirty())adopt(result);else adopt(await readDraft());
     const entry=(st.base.history||[]).filter(h=>h.state==='committed'&&h.canUndo).slice(-1)[0];
     const who=v2.actorName(prop?.by||'agent:');
     v2.ui.undo(`Changed to ${who}’s words.`,()=>undoLast(entry));
    }else{
     await v2.call('study-ai.reject',{...scope(),requestId:rid});say('Left as you wrote it.','good');
    }
    await loadProps();
   }catch(error){
    if(error.kind==='owner-only'){say(error.message,'bad');}
    else{say(error.message,'bad');await loadProps();}
   }
  }
  async function undoLast(entry){
   if(!entry)return;
   try{
    const fresh=await readDraft();
    const result=await v2.call('study-draft.undo',{...scope(),expected:fresh.expected,undoOperationId:entry.operationId});
    adopt(Array.isArray(result?.projection)?result:await readDraft());loadProps();
   }catch(error){say(error.message,'bad');}
  }

  // ---------- keeping up with other hands ----------
  async function refresh(){
   if(gone||!st.bindingId||st.saving)return;
   let fresh;try{fresh=await readDraft();}catch{return;}
   if(ctx.signal.aborted)return;
   const same=JSON.stringify(fresh.expected)===JSON.stringify(st.base?.expected);
   if(!same){
    if(dirty())await noticeNewer(fresh);else{adopt(fresh);}
   }
   await loadProps();
  }
  function onChange(e){
   if(e?.reset){refresh();return;}
   if(e?.operationId&&st.ops.has(e.operationId))return;
   clearTimeout(propTimer);propTimer=setTimeout(refresh,250);
  }

  // ---------- events ----------
  function onClick(e){
   const b=e.target.closest('[data-wr],[data-act]');if(!b||!page.contains(b))return;
   const wr=b.dataset.wr,act=b.dataset.act;
   if(wr==='src'){st.src=!st.src;const w=$('.wr-work');w.dataset.src=st.src?'open':'closed';page.querySelectorAll('[data-wr="src"]').forEach(x=>x.setAttribute('aria-pressed',String(st.src)));if(st.src&&st.sources===null)loadSources();return;}
   if(wr==='focus'||wr==='unfocus'){setFocus(wr==='focus');return;}
   if(wr==='ask'){v2.ui.sheet({title:'Ask',body:v2.ui.notBuilt('Asking about this piece from here.',{advanced:{subject:id,piece:st.piece||undefined,section:'write'}})});return;}
   if(act==='accept'||act==='reject')return void decide(act,b.dataset.id);
   if(act==='mine')return void keepMine();
   if(act==='theirs')return void useSaved();
  }
  function setFocus(on){
   st.focus=on;page.classList.toggle('wr-focus',on);
   const fb=$('.wr-focusbar');if(fb)fb.hidden=!on;
   if(on)(page.querySelector('[data-wr="unfocus"]')||page).focus?.({preventScroll:true});else page.querySelector('[data-wr="focus"]')?.focus({preventScroll:true});
  }
  function onKey(e){
   const t=e.target;
   if(e.key==='Escape'&&st.focus){e.preventDefault();setFocus(false);return;}
   if(!t.matches?.('textarea[data-ed]'))return;
   if(e.key==='Enter'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey){e.preventDefault();void enter(t);}
  }
  const onFocusOut=e=>{if(e.target.matches?.('textarea[data-ed]')&&dirty()){clearTimeout(timer);void save({quiet:true});}};
  const onHide=()=>{if(doc.visibilityState==='hidden'&&dirty()&&!st.conflict){clearTimeout(timer);void save({quiet:true});}};
  const onUnload=()=>{if(presenceOk&&st.bindingId&&presenceSent==='true')v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:false,sequence:++presenceSeq,session,leaving:true}).catch(()=>{});};
  const onResize=()=>page.querySelectorAll('textarea.wr-ed').forEach(fit);

  page.addEventListener('click',onClick);page.addEventListener('keydown',onKey);page.addEventListener('focusout',onFocusOut);
  page.addEventListener('input',e=>{if(e.target.matches?.('textarea[data-ed]'))onInput(e.target);});
  doc.addEventListener('visibilitychange',onHide);root.addEventListener('pagehide',onUnload);root.addEventListener('resize',onResize);
  ctx.on({kinds:['study-draft*','study-ai*']},onChange);
  ctx.on({},e=>{if(e.reset)onChange(e);});
  presenceTimer=setInterval(()=>presence(true),60000);

  // ---------- opening ----------
  function plain(text,withLink=true){
   page.innerHTML=`<div class="wr-none"><p role="status">${esc(text)}</p><p><a class="wr-btn" href="${esc(v2.href('subject/:id',{id}))}">${icon('back')}Back to the subject</a>${withLink?` <a class="wr-btn" href="${esc(adv('write'))}">Open in Advanced${icon('out')}</a>`:''}</p></div>`;
  }
  async function ready(){
   try{
    if(!await locate())return;
    if(!st.form){shell0('This subject has no Article yet, so there is nothing to write here.');return;}
    if(!st.bindingId){shell0('The words of this piece are not kept where Write can open them. They open in Advanced.');return;}
    const read=await readDraft();if(ctx.signal.aborted)return;
    st.base=read;st.rows=rowsOf(read);
    const saved=unstash(),h=(read.history||[]).filter(x=>x.state==='committed'&&x.modifiedAt).slice(-1)[0];
    if(h)st.savedAt=h.modifiedAt;
    if(saved){
     for(const [rid,text,orig] of saved.edits){const r=st.rows.find(x=>x.id===rid);if(r&&r.safe&&text!==r.words)st.edits.set(rid,{text:String(text),orig:String(orig??r.words)});}
     for(const a of saved.added){if(a&&typeof a.id==='string'&&typeof a.text==='string'&&a.text.trim())st.added.push({id:a.id,afterId:a.afterId??null,text:flat(a.text)});}
    }
    shell();
    if(saved&&dirty()&&saved.draft&&saved.draft!==read.expected?.workflow?.draft)await noticeNewer(read);
    else if(saved&&dirty()){say('Your unsaved words from earlier are back.','info');schedule(600);}
    presence(true);loadProps();if(st.src)loadSources();
   }catch(error){if(ctx.signal.aborted)return;plain(error.message||'This piece could not be opened.');}
  }
  function shell0(text){shell();$('[data-wr-text]').innerHTML=`<p class="wr-dim" role="status">${esc(text)}</p>`;$('.wr-todo')?.remove();}
  function leave(){
   gone=true;clearTimeout(timer);clearTimeout(propTimer);clearInterval(presenceTimer);
   doc.removeEventListener('visibilitychange',onHide);root.removeEventListener('pagehide',onUnload);root.removeEventListener('resize',onResize);
   if(dirty()&&!st.conflict&&st.bindingId&&!st.stopped){try{void save({quiet:true});}catch{/* kept on this device */}}
   if(presenceOk&&presenceSent==='true'){presenceSent='';v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:false,sequence:++presenceSeq,session,leaving:true}).catch(()=>{});}
  }
  return {ready:ready(),leave,state:st};
 }
})(window.v2);
