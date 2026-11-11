/* Version two: Write. The words of one piece of one subject, on the approved page, with an assistant's suggestions beside
   them. Address: #/write/<subject>?piece=<output id>. It reads the draft with study-draft.read, saves his words with
   study-draft.save (the revision he read goes with them; a join and a delete go in the same command), lists
   suggestions with study-ai.requests and study-ai.review, and settles one with study-ai.finish (a read-through of a whole
   draft) or study-ai.accept and study-ai.reject (a plain suggestion). Only he decides and only he writes: opened by an
   assistant the page is read only, and a decision answers 403 with that message shown plainly. A newer saved version is
   never merged for him and never written over: he sees both and chooses. His unsaved words are kept on this device across
   a reload, and only his. Every rule starts with .wr. */
(function(v2){
 'use strict';
 const {esc,icon}=v2.ui,root=window,doc=document;
 const OWN={side:'M4 5h16v14H4zM9 5v14',focus:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',note:'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',link:'M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1'};
 const own=name=>`<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${OWN[name]}"/></svg>`;
 const uuid=()=>root.V2Client.uuid();
 const clock=iso=>{try{return new Date(iso).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}catch{return '';}};
 /** How "Saved" reads, as the sample's does: the time today, and the day and time on any other day ("10 Nov, 13:52"). */
 function savedLabel(iso,now=new Date()){
  try{
   const d=new Date(iso);if(Number.isNaN(d.getTime()))return 'Saved';
   const time=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});
   const sameDay=d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
   return 'Saved '+(sameDay?time:d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})+', '+time);
  }catch{return 'Saved';}
 }
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
 /** The operations study-draft.save takes for his unsaved words: a text change per edited passage, each new paragraph
     inserted before the passage that follows its place, then a delete for each passage he emptied (the one under his
     caret, named in hold, is left until he leaves it). */
 function buildOps({rows,edits,added,hold=null}){
  const ops=[],gone=[],byId=new Map(rows.map(r=>[r.id,r]));
  for(const r of rows){
   if(!r.safe||!edits.has(r.id))continue;
   const text=edits.get(r.id).text;
   if(!String(text).trim()){if(r.id!==hold&&r.words!=='')gone.push({kind:'delete',id:r.id});continue;}
   const d=minimalDiff(r.words,text);
   if(d)ops.push({kind:'text',id:r.id,...d,seenBlockHash:r.hash});
  }
  const anchorOf=a=>{let id=a.afterId,guard=0;while(id&&!byId.has(id)&&guard++<1000){const p=added.find(x=>x.id===id);id=p?p.afterId:null;}return id;};
  for(const a of added){
   const text=String(a.text||'').trim();if(!text)continue;
   const anchor=anchorOf(a),at=anchor?rows.findIndex(r=>r.id===anchor):-1;
   ops.push({kind:'insert',id:a.id,beforeId:at>=0?(rows[at+1]?.id??null):null,raw:text});
  }
  return ops.concat(gone);
 }
const flat=text=>String(text??'').replace(/\s*[\r\n]+\s*/g,' ');
 /** Which of a suggestion's replacements can be shown on a passage he can see. */
 const proposalView=(item,review)=>{
  const purpose=review.purpose||item.purpose||'';
  const replacements=Array.isArray(review.replacements)?review.replacements.filter(r=>r&&typeof r.id==='string'&&typeof r.words==='string'):[];
  // A plain suggestion (no purpose) is taken with study-ai.accept. A read-through of a whole draft is settled with
  // study-ai.finish. Opening options and stand-in reviews need a choice this screen does not offer: they open in Advanced.
  const reads=!!purpose&&purpose!=='opening-options'&&review.canStandInReview!==true&&replacements.length>0;
  return {id:item.id,by:item.proposedBy?.actor||'',purpose,instruction:String(review.instruction||''),replacements,simple:!purpose,reads};
 };
 v2.shared.write=Object.freeze({rowsOf,minimalDiff,buildOps,flat,proposalView,savedLabel});


 let live=null;// the open screen, so leaving it can save and clean up

 v2.screen({id:'write',route:'write/:id',title:'Write',
  render:()=>'<div class="v2-page wr" data-wr><p class="wr-wait" role="status">Opening the writing.</p></div>',
  mount(el,ctx){live=open(el.querySelector('[data-wr]'),ctx);return live.ready;},
  unmount(){live?.leave();live=null;}});

 function open(page,ctx){
  const id=ctx.params.id,human=v2.isHuman();
  const st={standing:null,form:null,forms:[],bindingId:null,piece:null,missing:false,base:null,rows:[],edits:new Map(),added:[],
   saving:false,again:false,running:null,refreshWanted:false,savedAt:null,problem:'',stopped:false,conflict:null,props:[],marks:new Map(),dropped:0,sources:null,
   src:root.matchMedia&&root.matchMedia('(min-width:1101px)').matches,focus:false,ops:new Set(),human};
  let timer=null,propTimer=null,presenceTimer=null,presenceSeq=0,presenceOk=true,presenceSent='',gone=false;
  const session=uuid().slice(0,8);
  const $=sel=>page.querySelector(sel);
  const scope=()=>({bindingId:st.bindingId,parentStudyId:id});
  const dirty=()=>[...st.edits.keys()].length>0||st.added.some(a=>String(a.text).trim());
  const say=(text,tone='info')=>v2.ui.say(text,{tone});
  const mine=operationId=>{st.ops.add(operationId);return operationId;};

  // ---------- reading ----------
  async function locate(){
   const s=await v2.call('subject.standing',{parentStudyId:id});if(ctx.signal.aborted)return false;
   st.standing=s;const forms=s.forms||[];st.forms=forms;
   const articles=forms.filter(f=>f.kind==='article'),want=ctx.query.piece;
   // A piece named in the address must be one of this subject's Articles; only an address with no piece opens the first.
   st.form=want?articles.find(f=>f.id===want)||null:articles[0]||null;
   st.missing=!!want&&!st.form;
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
  const sameRevision=(a,b)=>JSON.stringify(a?.expected)===JSON.stringify(b?.expected);

  // ---------- the unsaved words, kept on this device: his only ----------
  const KEY=()=>'ar-v2-write:'+st.bindingId;
  function stash(){
   if(!st.human)return;// an assistant's page never keeps or restores words as if they were his
   try{
    if(!dirty()){root.localStorage.removeItem(KEY());return;}
    root.localStorage.setItem(KEY(),JSON.stringify({v:1,at:Date.now(),draft:st.base?.expected?.workflow?.draft||'',
     edits:[...st.edits].map(([k,v])=>[k,v.text,v.orig]),added:st.added.filter(a=>String(a.text).trim()).map(a=>({id:a.id,afterId:a.afterId,text:a.text}))}));
   }catch{/* private window or blocked storage: the words are still on the page */}
  }
  function unstash(){
   if(!st.human)return null;
   try{
    const s=JSON.parse(root.localStorage.getItem(KEY())||'null');
    if(!s||s.v!==1||!Array.isArray(s.edits)||!Array.isArray(s.added))return null;return s;
   }catch{return null;}
  }

  // ---------- who is where: tells an assistant he has unsaved words open ----------
  function presence(force=false){
   if(!presenceOk||gone||!st.bindingId||!st.human)return;
   const d=dirty(),sig=String(d);if(!d&&!presenceSent)return;/* nothing to tell until he has unsaved words */if(!force&&sig===presenceSent)return;presenceSent=sig;
   v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:d,sequence:++presenceSeq,session}).catch(()=>{presenceOk=false;});
  }

  // ---------- the order on the page: his passages, with new paragraphs after the one they follow ----------
  function ensureTail(){
   if(!st.human)return;
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
  function removeAdded(a){st.added=st.added.filter(x=>x!==a);for(const k of st.added)if(k.afterId===a.id)k.afterId=a.afterId;}

  // ---------- drawing ----------
  const BAR_ICON={back:icon('back')};
  /** The tab's name: "Article" when it is the only one, the piece's own title when a subject has more than one. */
  function tabNames(){
   const articles=st.forms.filter(f=>f.kind==='article'),seen=new Map(),names=new Map();
   for(const f of st.forms){
    let name=f.name||'Piece';
    if(f.kind==='article'&&articles.length>1){
     name=String(f.title||'').trim()||name;const n=(seen.get(name)||0)+1;seen.set(name,n);if(n>1)name+=' ('+n+')';
    }
    names.set(f.key,name);
   }
   return names;
  }
  function shell(){
   const names=tabNames();
   const formTab=f=>{
    const here=st.form&&f.key===st.form.key;
    const href=f.kind==='article'?v2.href('write/:id',{id},{piece:/^out:/.test(f.key)?f.id:undefined}):v2.href('subject/:id',{id},{form:f.key});
    return `<a href="${esc(href)}"${here?' aria-current="page"':''} title="${esc(names.get(f.key))}">${esc(names.get(f.key))}</a>`;
   };
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
   <div class="wr-focusbar" hidden><span>${esc(st.standing?.title||'')} / ${esc(names.get(st.form?.key)||'Article')}</span><button type="button" class="v2-ghost" data-wr="unfocus">Leave focus</button></div>
   <div class="wr-work" data-src="${st.src?'open':'closed'}">
    <aside class="wr-src" data-wr-src aria-label="Sources"></aside>
    <article class="wr-paper"><div class="wr-sheet">
     <div class="wr-conflict" data-wr-conflict hidden></div>
     <p class="wr-saved wr-saved-m" data-wr-saved role="status"></p>
     <h1 class="wr-title">${esc(st.form?.title||st.standing?.title||'')}</h1>
     ${st.human?'':`<p class="wr-ro" role="status">${esc('Opened as '+v2.actorName(v2.actor())+'. Only Adrian writes here. '+v2.actorName(v2.actor())+' can propose words, and Adrian decides.')}</p>`}
     <div class="wr-text" data-wr-text></div>
     <div class="wr-loose" data-wr-loose></div>
     <section class="wr-todo" aria-label="Still to write"><p class="wr-label">Still to write</p>${v2.ui.notBuilt('The list of parts still to write.',{advanced:{subject:id,piece:st.piece||undefined,section:'write'}})}</section>
    </div></article>
   </div>`;
   const out=$('.wr-todo .v2-out');if(out)out.setAttribute('data-wr-advanced','');
   paintSources();paintText();paintSaved();
  }
  function rowHTML(r,n){
   const label=r.kind==='heading'?'Heading':'Paragraph '+n;
   if(!r.safe)return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><p class="wr-lock" title="This passage has formatting that is kept as it is. Change it in Advanced.">${esc(r.text)}</p><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
   const cls=r.kind==='heading'?' wr-h':r.kind==='blockquote'?' wr-q':'';
   return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><textarea class="wr-ed${cls}" rows="1" data-ed="${esc(r.id)}" aria-label="${esc(label)}" spellcheck="true"${st.human?'':' readonly'}${r.fresh&&!r.text?' placeholder="Write here"':''}>${esc(r.text)}</textarea><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
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
   const text=!st.human?'Read only':st.problem?st.problem:st.saving?'Saving':dirty()||st.conflict?(st.conflict?'Not saved: a newer version exists':'Not saved yet'):st.savedAt?savedLabel(st.savedAt):'Saved';
   page.querySelectorAll('[data-wr-saved]').forEach(el=>{el.textContent=text;el.dataset.tone=st.problem||st.conflict?'bad':'';});
  }
  function paintSources(){
   const box=$('[data-wr-src]');if(!box)return;
   const list=(st.sources||[]).map(s=>`<li>${own(s.icon)}<span><b>${esc(s.title)}</b><small>${esc(s.kind)}</small></span></li>`).join('');
   const body=st.sources===null?'<p class="wr-dim" role="status">Reading the sources</p>':list?`<ul class="wr-src-l">${list}</ul>`:'<p class="wr-dim">No material is attached to this subject yet.</p>';
   box.innerHTML=`<div class="wr-src-h"><h2>Sources</h2><span>${st.sources?esc(st.sources.length)+', one list':''}</span><button type="button" class="v2-ghost v2-icon-btn" data-wr="src" aria-label="Close sources">${icon('close')}</button></div>${body}
    <div class="wr-play">${v2.ui.notBuilt('Playing a recording and reading its transcript beside the page.',{advanced:{subject:id,section:'source'}})}</div>`;
  }
  const kindOf=s=>{const k=String(s.kind||s.role||'').toLowerCase();return /record|audio|voice/.test(k)?['Recording','mic']:/note/.test(k)?['Your note','note']:/photo|image/.test(k)?['Photograph','photo']:/link|web/.test(k)?['Link','link']:['Source','note'];};
  async function loadSources(){
   try{
    const r=await v2.call('study-ai.read',scope());if(ctx.signal.aborted)return;
    st.sources=(r.sourceCatalog||[]).filter(s=>!/^author-page:/.test(String(s.id))&&s.title&&s.id!=='collection-initial-edition'&&!s.missing).map(s=>{const [kind,icon]=kindOf(s);return {title:String(s.title),kind,icon};});
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
  const markedOf=p=>st.marks.get(p.id)||new Set();
  function paintNotes(){
   const box=$('[data-wr-text]');if(!box)return;
   box.querySelectorAll('.wr-drafts').forEach(n=>{n.innerHTML='';});box.querySelectorAll('.wr-margin').forEach(n=>{n.innerHTML='';});
   const loose=$('[data-wr-loose]');let looseHTML='';
   st.props.forEach((p,k)=>{
    const n=k+1,by=v2.actorName(p.by||'agent:'),shown=p.replacements.filter(r=>box.querySelector(`[data-row="${CSS.escape(r.id)}"]`)),off=markedOf(p);
    for(const r of shown){
     const row=box.querySelector(`[data-row="${CSS.escape(r.id)}"]`),left=off.has(r.id);
     const mark=p.reads&&st.human&&p.replacements.length>1?`<button type="button" class="wr-mark" data-act="mark" data-id="${esc(p.id)}" data-rid="${esc(r.id)}" aria-pressed="${left}">Not me</button>`:'';
     row.querySelector('.wr-drafts').insertAdjacentHTML('beforeend',`<p class="wr-draft${left?' wr-left':''}"><sup>${n}</sup>${esc(r.words)}${mark}</p>`);
    }
    const note=noteHTML(p,n,by);
    if(shown.length)box.querySelector(`[data-row="${CSS.escape(shown[0].id)}"] .wr-margin`).insertAdjacentHTML('beforeend',note);
    else looseHTML+=`<div class="wr-loosenote">${note}</div>`;
   });
   if(loose)loose.innerHTML=looseHTML+(st.dropped?`<p class="wr-dim wr-stale">${esc(st.dropped===1?'A suggestion was set aside because the words changed after it was made.':st.dropped+' suggestions were set aside because the words changed after they were made.')}</p>`:'');
  }
  function noteHTML(p,n,by){
   const ok=p.simple&&p.replacements.length||p.reads;
   const head=`<p class="wr-note-h"><sup>${n}</sup>${esc(ok?by+' suggests new words':by+' wrote more for this piece')}</p>`;
   if(!ok)return `<div class="wr-note" data-prop="${esc(p.id)}">${head}<p class="wr-dim">This kind of suggestion is read through in Advanced, where you choose what becomes yours.</p><div class="wr-row-btns"><a class="wr-btn" href="${esc(adv('write'))}">Read it in Advanced${icon('out')}</a></div></div>`;
   const many=p.replacements.length>1?` for ${p.replacements.length} paragraphs`:'';
   const asked=p.reads&&p.instruction?`<p class="wr-dim">${esc('Asked: '+p.instruction)}</p>`:'';
   const mark=p.reads&&p.replacements.length>1?' Use Not me under a paragraph to leave only that one out.':'';
   const buttons=`<div class="wr-row-btns"><button type="button" class="pri" data-act="${p.reads?'finish':'accept'}" data-id="${esc(p.id)}">Rewrite it as mine</button><button type="button" class="v2-ghost" data-act="${p.reads?'leave':'reject'}" data-id="${esc(p.id)}">Not me</button></div>`;
   return `<div class="wr-note" data-prop="${esc(p.id)}">${head}${asked}<p class="wr-dim">${esc('Shown dim'+many+'. They stay dim until you make them yours.'+mark)}</p>${buttons}</div>`;
  }

  // ---------- the conflict: his words and the newer saved ones, side by side ----------
  function paintConflict(){
   const box=$('[data-wr-conflict]');if(!box)return;
   const c=st.conflict;box.hidden=!c;if(!c){box.innerHTML='';return;}
   const fresh=new Map(rowsOf(c.fresh).map(r=>[r.id,r])),mine=[];
   for(const [rid,e] of st.edits){const f=fresh.get(rid);mine.push({yours:e.text,saved:f?f.words:null,same:f&&f.words===e.orig});}
   const added=st.added.filter(a=>String(a.text).trim());
   const lines=mine.map(m=>`<li><p><b>Yours</b> ${m.yours.trim()?esc(m.yours):'<i>You emptied this paragraph.</i>'}</p><p><b>Saved</b> ${m.saved===null?'<i>This paragraph is not in the saved version.</i>':m.same?'<i>Not changed in the saved version.</i>':esc(m.saved)}</p></li>`)
    .concat(added.map(a=>`<li><p><b>Yours</b> ${esc(a.text)}</p><p><b>Saved</b> <i>A new paragraph. It is not in the saved version.</i></p></li>`)).join('');
   const h=(c.fresh.history||[]).filter(x=>x.state==='committed').slice(-1)[0];
   const by=h&&h.actor&&!/unknown/.test(h.actor)?v2.actorName(h.actor)+(h.modifiedAt?' at '+clock(h.modifiedAt):''):'';
   box.innerHTML=`<h2>A newer version of this piece is saved${by?' by '+esc(by.replace(/^You/,'you')):''}</h2>
    <p class="wr-dim">Your words are still here and are not saved. Choose which to keep. Nothing is mixed for you.</p>
    <ul class="wr-pairs">${lines||'<li><p class="wr-dim">You have no unsaved words. The saved version is the newer one.</p></li>'}</ul>
    <div class="wr-row-btns"><button type="button" class="pri" data-act="mine">Keep my words</button><button type="button" data-act="theirs">Use the saved version</button></div>`;
  }
  function noticeNewer(fresh){
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
    if(!f||!f.safe){st.edits.delete(rid);if(String(e.text).trim())st.added.push({id:uuid(),afterId:after,text:e.text});}
    else if(f.words===e.text)st.edits.delete(rid);else st.edits.set(rid,{text:e.text,orig:f.words});
   }
   st.base=c.fresh;st.rows=rowsOf(c.fresh);st.conflict=null;st.problem='';st.stopped=false;paintConflict();paintText();stash();await save({hold:null});
  }

  // ---------- taking in a server version ----------
  /** Puts the server's version on the page. Nothing he typed is dropped: a paragraph he is still editing keeps his words
      against the new text, one that has just been saved as new becomes an edit of the saved paragraph, and words typed into
      a paragraph that is gone come back as a new paragraph after the one before it. */
  function adopt(read){
   const old=st.rows;
   st.base=read;st.rows=rowsOf(read);
   const h=(read.history||[]).filter(x=>x.state==='committed'&&x.modifiedAt).slice(-1)[0];
   if(h&&!st.savedAt)st.savedAt=h.modifiedAt;
   const now=new Map(st.rows.map(r=>[r.id,r]));
   for(const [rid,e] of [...st.edits]){
    const r=now.get(rid);
    if(!r){
     st.edits.delete(rid);
     if(String(e.text).trim()){
      let after=null;const at=old.findIndex(x=>x.id===rid);
      for(let i=at-1;i>=0;i--)if(now.has(old[i].id)){after=old[i].id;break;}
      st.added.push({id:uuid(),afterId:after,text:e.text});
     }
    }else if(r.words===e.text)st.edits.delete(rid);
    else e.orig=r.words;
   }
   for(const a of [...st.added]){
    const r=now.get(a.id);if(!r)continue;
    // A new paragraph the server now holds: what was typed after it was sent is an edit of the saved paragraph.
    st.added=st.added.filter(x=>x!==a);
    if(a.text!==r.words&&r.safe)st.edits.set(r.id,{text:a.text,orig:r.words});
   }
   paintText();
  }

  // ---------- saving ----------
  function say403(error){st.problem=error.message;st.stopped=true;say(error.message,'bad');}
  const settled=async()=>{while(st.saving){try{await st.running;}catch{/* its own caller shows it */}}};
  /** One save: his unsaved words (and any extra operation such as a join or a split) in one study-draft.save, with the
      revision he read. Resolves true when it was saved. */
  function save(opts={}){
   if(!st.human)return Promise.resolve(false);
   if(st.saving){st.again=true;return st.running;}
   st.running=run(opts);return st.running;
  }
  async function run({quiet=false,extra=[],hold,undoText='',focus=null}={}){
   if(st.conflict||!st.bindingId)return false;
   const holdId=hold===undefined?(doc.activeElement?.dataset?.ed||null):hold;
   const ops=buildOps({rows:st.rows,edits:st.edits,added:st.added,hold:holdId}).concat(extra);
   if(!ops.length){st.problem='';paintSaved();stash();return false;}
   // Only what goes in this save is settled by it.
   const sentIds=new Set(ops.filter(o=>o.kind==='text'||o.kind==='delete').map(o=>o.id)),sentAdd=new Set(ops.filter(o=>o.kind==='insert').map(o=>o.id));
   const sent={edits:new Map([...st.edits].filter(([k])=>sentIds.has(k)).map(([k,v])=>[k,v.text])),added:new Map(st.added.filter(a=>sentAdd.has(a.id)).map(a=>[a.id,a.text]))};
   const operationId=mine(uuid());st.saving=true;st.problem='';paintSaved();
   let ok=false;
   try{
    const result=await v2.call('study-draft.save',{...scope(),operationId,expected:st.base.expected,operations:ops});
    for(const [rid,text] of sent.edits){if(st.edits.get(rid)?.text===text)st.edits.delete(rid);}
    st.added=st.added.filter(a=>!(sent.added.has(a.id)&&sent.added.get(a.id)===a.text));
    adopt(result);st.savedAt=new Date().toISOString();st.stopped=false;ok=true;
    stash();presence();loadProps();
    const text=undoText||(ops.some(o=>o.kind==='delete')?'Paragraph deleted.':'');
    if(text&&(result.history||[]).some(h=>h.operationId===operationId&&h.canUndo))v2.ui.undo(text,()=>undoOp(operationId));
    if(focus)focusEditor(focus.id,focus.at);
   }catch(error){
    if(error.kind==='stale'){
     // Only a newer revision on the server is a newer version. Any other refusal is the server's own words.
     let fresh=null;try{fresh=await readDraft();}catch{/* the words stay on this device */}
     if(fresh&&!sameRevision(fresh,st.base))noticeNewer(fresh);
     else{st.problem=error.body?.error||'The app could not save these words.';st.stopped=true;if(!quiet)say(st.problem,'bad');}
    }
    else if(error.kind==='owner-only'){say403(error);}
    else{st.problem=error.kind==='held'||error.kind==='refused'?error.message:'Could not save. Your words are kept on this device.';st.stopped=error.kind==='refused'||error.kind==='held';if(!quiet)say(error.message,'bad');if(!st.stopped)schedule(5000);}
   }finally{
    st.saving=false;paintSaved();
    if(st.again){st.again=false;if(dirty())schedule(300);}
    if(st.refreshWanted){st.refreshWanted=false;void refresh();}
   }
   return ok;
  }
  function schedule(ms=AUTOSAVE_MS){clearTimeout(timer);if(gone||st.stopped||st.conflict||!st.human)return;timer=setTimeout(()=>{void save({quiet:true});},ms);}

  // ---------- typing ----------
  function onInput(t){
   if(!st.human)return;
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
   // In the middle of a saved paragraph: his words and the split go in one save, so nothing typed in between can be lost.
   clearTimeout(timer);await settled();
   const row=st.rows.find(r=>r.id===rid);if(!row||!row.safe)return;
   const text=st.edits.get(rid)?.text??row.words,newId=uuid();
   await save({hold:null,extra:[{kind:'split',id:rid,at:Math.min(at,text.length),newId}],focus:{id:newId,at:0}});
  }
  /** Backspace at the start of a paragraph joins it to the one before. A paragraph that was never saved is joined on the
      page; a saved one is saved first and joined in the same save. A paragraph he emptied is deleted. */
  async function join(t){
   const rid=t.dataset.ed,list=order(),i=list.findIndex(x=>x.id===rid);if(i<1)return;
   const prev=list[i-1],cur=list[i];if(!prev.safe||!cur.safe)return;
   const curAdded=st.added.find(a=>a.id===rid),prevAdded=st.added.find(a=>a.id===prev.id);
   clearTimeout(timer);
   if(prevAdded&&!String(prevAdded.text).trim()){removeAdded(prevAdded);paintText();focusEditor(rid,0);return;}
   if(curAdded){
    const at=prev.text.length;
    if(prevAdded)prevAdded.text+=curAdded.text;
    else{const r=st.rows.find(x=>x.id===prev.id),e=st.edits.get(prev.id),text=prev.text+curAdded.text;if(text===r.words)st.edits.delete(prev.id);else st.edits.set(prev.id,{text,orig:e?.orig??r.words});}
    removeAdded(curAdded);paintText();stash();presence();schedule();focusEditor(prev.id,at);return;
   }
   await settled();
   if(prevAdded){if(!await save({hold:null})||st.conflict||st.problem)return;await settled();}
   const left=st.rows.find(x=>x.id===prev.id),right=st.rows.find(x=>x.id===rid);if(!left||!right||!left.safe||!right.safe)return;
   const at=(st.edits.get(left.id)?.text??left.words).length,rightText=st.edits.get(rid)?.text??right.words;
   if(!String(rightText).trim()){
    if(!st.edits.has(rid))st.edits.set(rid,{text:'',orig:right.words});else st.edits.get(rid).text='';
    await save({hold:null,focus:{id:left.id,at}});return;
   }
   await save({hold:null,extra:[{kind:'join',leftId:left.id,rightId:rid}],undoText:'Joined two paragraphs.',focus:{id:left.id,at}});
  }

  // ---------- suggestions: his to take or turn down ----------
  async function decide(kind,rid){
   if(st.human&&dirty()){say('Your words are not saved yet. They save by themselves in a moment; then you can decide.','warn');return;}
   const prop=st.props.find(p=>p.id===rid);if(!prop)return;
   const operationId=mine(uuid()),who=v2.actorName(prop.by||'agent:');
   try{
    if(kind==='accept'||kind==='finish'){
     let result;
     if(kind==='accept')result=await v2.call('study-ai.accept',{...scope(),requestId:rid,operationId});
     else{
      const off=markedOf(prop),all=prop.replacements.every(r=>off.has(r.id));
      if(all){await leaveOut(prop,operationId);return;}
      result=await v2.call('study-ai.finish',{...scope(),requestId:rid,operationId,...(off.size?{marks:[...off].map(x=>({id:x}))}:{})});
     }
     if(Array.isArray(result?.projection)&&!dirty())adopt(result);else adopt(await readDraft());
     st.marks.delete(rid);
     const entry=(st.base.history||[]).find(h=>h.operationId===operationId&&h.canUndo);
     if(entry)v2.ui.undo(`Changed to ${who}’s words.`,()=>undoOp(operationId));else say(`Changed to ${who}’s words.`,'good');
    }else if(kind==='leave'){await leaveOut(prop,operationId);return;}
    else{
     await v2.call('study-ai.reject',{...scope(),requestId:rid});say('Left as you wrote it.','good');
    }
    await loadProps();
   }catch(error){
    if(error.kind==='owner-only'){say(error.message,'bad');}
    else{say(error.message,'bad');await loadProps();}
   }
  }
  /** "Not me" on a read-through: every paragraph of it is marked left out, so nothing of it is written and it is not offered again. */
  async function leaveOut(prop,operationId){
   try{
    await v2.call('study-ai.finish',{...scope(),requestId:prop.id,operationId,marks:prop.replacements.map(r=>({id:r.id}))});
    st.marks.delete(prop.id);say('Left as you wrote it.','good');await loadProps();
   }catch(error){say(error.message,'bad');if(error.kind!=='owner-only')await loadProps();}
  }
  /** Takes back one saved change, found by its own operation, never merely the latest one. */
  async function undoOp(operationId){
   try{
    const fresh=await readDraft();
    if(!(fresh.history||[]).some(h=>h.operationId===operationId&&h.canUndo)){say('That can no longer be undone, because the words have changed since.','warn');return;}
    const result=await v2.call('study-draft.undo',{...scope(),expected:fresh.expected,undoOperationId:operationId});
    adopt(Array.isArray(result?.projection)?result:await readDraft());loadProps();
   }catch(error){say(error.message,'bad');}
  }

  // ---------- keeping up with other hands ----------
  async function refresh(){
   if(gone||!st.bindingId)return;
   if(st.saving){st.refreshWanted=true;return;}// shown as soon as the save is over
   let fresh;try{fresh=await readDraft();}catch{return;}
   if(ctx.signal.aborted||st.saving)return;
   if(!sameRevision(fresh,st.base)){
    if(dirty())noticeNewer(fresh);else{adopt(fresh);}
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
   if(act==='accept'||act==='reject'||act==='finish'||act==='leave')return void decide(act,b.dataset.id);
   if(act==='mark'){const set=st.marks.get(b.dataset.id)||new Set();if(set.has(b.dataset.rid))set.delete(b.dataset.rid);else set.add(b.dataset.rid);st.marks.set(b.dataset.id,set);paintNotes();page.querySelector(`[data-act="mark"][data-rid="${CSS.escape(b.dataset.rid)}"]`)?.focus({preventScroll:true});return;}
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
   if(!t.matches?.('textarea[data-ed]')||!st.human)return;
   if(e.key==='Enter'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey){e.preventDefault();void enter(t);}
   else if(e.key==='Backspace'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&t.selectionStart===0&&t.selectionEnd===0){e.preventDefault();void join(t);}
  }
  const onFocusOut=e=>{if(e.target.matches?.('textarea[data-ed]')&&dirty()&&!st.conflict){clearTimeout(timer);void save({quiet:true,hold:null});}};
  const onHide=()=>{if(doc.visibilityState==='hidden'&&dirty()&&!st.conflict){clearTimeout(timer);void save({quiet:true,hold:null});}};
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
    if(st.missing){plain('This piece is not one of this subject’s Articles, or it does not exist. Go back to the subject to choose one.',false);return;}
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
    if(saved&&dirty()&&saved.draft&&saved.draft!==read.expected?.workflow?.draft)noticeNewer(read);
    else if(saved&&dirty()){say('Your unsaved words from earlier are back.','info');schedule(600);}
    presence(true);loadProps();if(st.src)loadSources();
   }catch(error){if(ctx.signal.aborted)return;plain(error.message||'This piece could not be opened.');}
  }
  function shell0(text){shell();$('[data-wr-text]').innerHTML=`<p class="wr-dim" role="status">${esc(text)}</p>`;$('.wr-todo')?.remove();}
  function leave(){
   gone=true;clearTimeout(timer);clearTimeout(propTimer);clearInterval(presenceTimer);
   doc.removeEventListener('visibilitychange',onHide);root.removeEventListener('pagehide',onUnload);root.removeEventListener('resize',onResize);
   if(st.human&&dirty()&&!st.conflict&&st.bindingId&&!st.stopped){try{void save({quiet:true,hold:null});}catch{/* kept on this device */}}
   if(presenceOk&&presenceSent==='true'){presenceSent='';v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:false,sequence:++presenceSeq,session,leaving:true}).catch(()=>{});}
  }
  return {ready:ready(),leave,state:st};
 }
})(window.v2);
