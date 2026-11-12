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
 const own=name=>OWN[name]?`<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${OWN[name]}"/></svg>`:icon(name);// a name this screen does not draw comes from the shell
 const uuid=()=>root.V2Client.uuid();
 const clock=iso=>{try{return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});}catch{return '';}};
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
 /** Finds the piece's words: the subject's standing, its forms, the Article asked for (the first when none is named), and
     the draft that owns its words. {standing, forms, form, piece, bindingId, native}. native is false when the words are
     owned elsewhere (a Magazine story), and bindingId is then null. Write, Read and Check all find a piece this way. */
 async function locate(id,pieceId){
  const standing=await v2.call('subject.standing',{parentStudyId:id});
  const forms=standing.forms||[],articles=forms.filter(f=>f.kind==='article');
  // A piece named in the address must be one of this subject's Articles; only an address with no piece opens the first.
  const form=pieceId?articles.find(f=>f.id===pieceId)||null:articles[0]||null;
  let bindingId=standing.facts?.bindingId||null,native=true;
  const piece=form&&/^out:/.test(form.key||'')?form.id:null;
  if(piece&&bindingId){
   try{
    const outs=await v2.call('study.outputs',{rootBindingId:bindingId,parentStudyId:id,selectedOutputId:piece});
    const owner=(outs?.outputBindings||[]).find(b=>b.outputId===piece)?.wordOwner;
    if(owner&&owner.kind==='native'&&owner.bindingId)bindingId=owner.bindingId;
    else if(owner&&owner.kind!=='native'){bindingId=null;native=false;}
   }catch{/* the subject's own words stay the owner */}
  }
  // A Magazine story's words are the Magazine's own: the form's owner names the story and the piece, and there is no draft
  // binding. Write, Read and Check reach them with magazine.working-draft.* and magazine.check.
  const story=storyOf(form);
  return {standing,forms,form,piece,bindingId,native,story};
 }
 /** The story and piece that own a form's words, or null when the form's words are an ordinary subject's draft. */
 function storyOf(form){
  const o=form&&form.owner;
  return o&&o.kind==='magazine'&&typeof o.storyId==='string'&&o.storyId&&typeof o.pieceId==='string'&&o.pieceId?{storyId:o.storyId,pieceId:o.pieceId}:null;
 }
 /** The passages of a Magazine story's saved words (magazine.working-draft.read), each with what editing it needs: the
     paragraph's index and the hash he saw (edit), or why it cannot be edited here (lock). Rows and paragraphs are matched in
     order by their words; one that cannot be matched, or that holds a pending review mark, stays read only. */
 function storyRows(read){
  const paras=Array.isArray(read?.paragraphs)?read.paragraphs:[];let at=0;
  // A rule between the parts of the file (---) is not words and is not shown.
  return (read?.projection||[]).filter(b=>!(b.safe===false&&(String(b.words||'')===''||/^\s*([-*_])\1{2,}\s*$/.test(String(b.words||''))))).map(b=>{
   const words=String(b.words||''),safe=b.safe!==false,raw=String(b.raw||'');
   const row={id:b.id,kind:b.blockKind||'paragraph',level:Number(b.level||b.frame?.level)||2,words,safe,hash:b.blockHash,edit:null,lock:''};
   if(!safe)return row;
   let j=-1;for(let i=at;i<paras.length;i++){if(paras[i]&&paras[i].text===words){j=i;break;}}
   if(j<0){row.lock='other';return row;}
   at=j+1;
   if(/==/.test(raw))row.lock='pending';
   else row.edit={block:paras[j].block,seen:paras[j].seen};
   return row;
  });
 }
 /** The tab's name: "Article" when it is the only one, the piece's own title when a subject has more than one. */
 function tabNames(forms){
  const articles=forms.filter(f=>f.kind==='article'),seen=new Map(),names=new Map();
  for(const f of forms){
   let name=f.name||'Piece';
   if(f.kind==='article'&&articles.length>1){
    name=String(f.title||'').trim()||name;const n=(seen.get(name)||0)+1;seen.set(name,n);if(n>1)name+=' ('+n+')';
   }
   names.set(f.key,name);
  }
  return names;
 }
 const MODES=[['write','Write'],['read','Read'],['check','Check']];
 /** The sub bar the three screens share: the way back, the piece tabs (which keep him in the same mode), the
     Write | Read | Check segment, then `right` (markup for the bar's right side). */
 function bar({id,forms=[],form=null,piece=null,mode='write',right=''}){
  const names=tabNames(forms),at=MODES.some(m=>m[0]===mode)?mode:'write';
  const formTab=f=>{
   const here=form&&f.key===form.key;
   const href=f.kind==='article'?v2.href(at+'/:id',{id},{piece:/^out:/.test(f.key)?f.id:undefined}):v2.href('subject/:id',{id},{form:f.key});
   return `<a href="${esc(href)}"${here?' aria-current="page"':''} title="${esc(names.get(f.key))}">${esc(names.get(f.key))}</a>`;
  };
  const seg=MODES.map(([m,label])=>m===at?`<span aria-current="true">${label}</span>`:`<a href="${esc(v2.href(m+'/:id',{id},{piece:piece||undefined}))}">${label}</a>`).join('');
  return `<div class="wr-bar" data-wr-bar>
    <a class="wr-back" href="${esc(v2.href('subject/:id',{id}))}" aria-label="Back to the subject">${icon('back')}<span>The subject</span></a>
    <nav class="wr-tabs" aria-label="Pieces of this subject">${forms.map(formTab).join('')}<a href="${esc(v2.href('subject/:id',{id}))}" aria-label="Add a piece on the subject page" title="Add a form on the subject page">${icon('plus')}</a></nav>
    <div class="wr-seg" role="group" aria-label="Write, Read or Check">${seg}</div>
    <span class="wr-sp"></span>
    ${right}
   </div>`;
 }
 v2.shared.write=Object.freeze({rowsOf,minimalDiff,buildOps,flat,proposalView,savedLabel,locate,bar,storyOf,storyRows});


 let live=null;// the open screen, so leaving it can save and clean up

 v2.screen({id:'write',route:'write/:id',title:'Write',
  render:()=>'<div class="v2-page wr" data-wr><p class="wr-wait" role="status">Opening the writing.</p></div>',
  mount(el,ctx){live=openAny(el.querySelector('[data-wr]'),ctx);return live.ready;},
  unmount(){live?.leave();live=null;}});

 /** Finds the piece first: a Magazine story's words have their own editor, any other subject's use the draft one. */
 function openAny(page,ctx){
  let inner=null,gone=false;
  const ready=(async()=>{
   let found=null;
   try{found=await locate(ctx.params.id,ctx.query.piece);}catch{/* the draft screen shows the reason below */}
   if(gone||ctx.signal.aborted)return;
   inner=found&&found.story?openStory(page,ctx,found):open(page,ctx,found);
   await inner.ready;
  })();
  return {ready,leave(){gone=true;inner?.leave();}};
 }

 function open(page,ctx,pre=null){
  const id=ctx.params.id,human=v2.isHuman();
  const st={standing:null,form:null,forms:[],bindingId:null,piece:null,missing:false,base:null,rows:[],edits:new Map(),added:[],
   starting:false,creating:false,saving:false,again:false,running:null,refreshWanted:false,saveSeq:0,sent:[],baseWords:new Map(),reading:new Map(),savedAt:null,problem:'',stopped:false,conflict:null,props:[],dropped:0,sources:null,
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
   const found=pre||await v2.shared.write.locate(id,ctx.query.piece);pre=null;if(ctx.signal.aborted)return false;
   const s=found.standing;st.standing=s;st.forms=found.forms;st.form=found.form;
   st.missing=!!ctx.query.piece&&!found.form;
   st.bindingId=found.bindingId;st.piece=found.piece;
   // A subject with no Article yet: the page is empty and his first saved words start the Article (see startArticle).
   st.starting=!found.form&&!ctx.query.piece&&!!found.bindingId&&!found.story;
   ctx.setTitle(s.title||'Write');if(s.look)v2.brand(s.look);
   ctx.setAdvanced({subject:id,piece:st.piece||undefined,section:'write'});
   return true;
  }
  const adv=section=>v2.advanced({subject:id,piece:st.piece||undefined,section});
  const readDraft=()=>v2.call('study-draft.read',scope());
  const sameRevision=(a,b)=>JSON.stringify(a?.expected)===JSON.stringify(b?.expected);

  // ---------- the unsaved words, kept on this device: his only ----------
  const KEY=()=>'ar-v2-write:'+st.bindingId;
  /** Everything unsaved goes to the device under his key, with the saves whose answer has not come back (the operation
      and what it carried), so a reload in the middle of a save can tell his own committed save from a newer version. */
  function stash(){
   if(!st.human)return;// an assistant's page never keeps or restores words as if they were his
   try{
    if(!dirty()){root.localStorage.removeItem(KEY());return;}
    root.localStorage.setItem(KEY(),JSON.stringify({v:2,at:Date.now(),draft:st.base?.expected?.workflow?.draft||'',
     edits:[...st.edits].map(([k,v])=>[k,v.text,v.orig]),added:st.added.filter(a=>String(a.text).trim()).map(a=>({id:a.id,afterId:a.afterId,text:a.text})),
     sent:st.sent,base:[...st.baseWords]}));
   }catch{/* private window or blocked storage: the words are still on the page */}
  }
  function unstash(){
   if(!st.human)return null;
   try{
    const s=JSON.parse(root.localStorage.getItem(KEY())||'null');
    if(!s||(s.v!==1&&s.v!==2)||!Array.isArray(s.edits)||!Array.isArray(s.added))return null;
    if(!Array.isArray(s.sent))s.sent=[];return s;
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
  function shell(){
   const names=tabNames(st.forms);
   const right=`<span class="wr-saved" data-wr-saved></span>
    <button type="button" data-wr="src" aria-pressed="${st.src}" aria-label="Sources">${own('side')}<span>Sources</span></button>
    <button type="button" class="v2-ghost" data-wr="ask" aria-label="Ask">${icon('ask')}<span>Ask</span></button>
    <button type="button" class="v2-ghost" data-wr="focus" aria-label="Focus">${own('focus')}<span>Focus</span></button>`;
   page.innerHTML=bar({id,forms:st.forms,form:st.form,piece:st.piece,mode:'write',right})+`
   <div class="wr-focusbar" hidden><span>${esc(st.standing?.title||'')} / ${esc(names.get(st.form?.key)||'Article')}</span><button type="button" class="v2-ghost" data-wr="unfocus">Leave focus</button></div>
   <div class="wr-work" data-src="${st.src?'open':'closed'}">
    <aside class="wr-src" data-wr-src aria-label="Sources"></aside>
    <article class="wr-paper"><div class="wr-sheet">
     <div class="wr-conflict" data-wr-conflict hidden></div>
     <p class="wr-saved wr-saved-m" data-wr-saved role="status"></p>
     <h1 class="wr-title">${esc(st.form?.title||st.standing?.title||'')}</h1>
     ${st.human?'':`<p class="wr-ro" role="status">${esc('Opened as '+v2.actorName(v2.actor())+'. Only Adrian writes here. '+v2.actorName(v2.actor())+' can propose words, and Adrian decides.')}</p>`}
     ${st.starting&&!st.human?'<p class="wr-dim" role="status">No Article has been started for this subject. Adrian starts it by writing the first words.</p>':''}
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
   return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><textarea class="wr-ed${cls}" rows="1" data-ed="${esc(r.id)}" aria-label="${esc(label)}" spellcheck="true"${st.human&&!st.creating?'':' readonly'}${r.fresh&&!r.text?' placeholder="Write here"':''}>${esc(r.text)}</textarea><div class="wr-drafts"></div></div><aside class="wr-margin"></aside></div>`;
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
   const text=st.none?'':!st.human?'Read only':st.problem?st.problem:st.saving?'Saving':dirty()||st.conflict?(st.conflict?'Not saved: a newer version exists':'Not saved yet'):st.savedAt?savedLabel(st.savedAt):'Saved';
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
  // A read-through he has begun (the words he changed, the paragraphs he marked Not me) is kept on this device, only his,
  // under the same key the existing workspace uses, so it carries over between the two.
  const readKey=id=>'ar-create:read-through:'+id;
  function reading(p){
   if(!st.reading.has(p.id)){
    let v=null;if(st.human)try{v=JSON.parse(root.localStorage.getItem(readKey(p.id))||'null');}catch{/* blocked storage */}
    st.reading.set(p.id,v&&typeof v==='object'&&v.words&&v.marks&&v.notes?v:{words:{},marks:{},notes:{}});
   }
   return st.reading.get(p.id);
  }
  const keepReading=p=>{if(!st.human)return;try{root.localStorage.setItem(readKey(p.id),JSON.stringify(reading(p)));}catch{/* the words are still on the page */}};
  function forgetReading(id){st.reading.delete(id);try{root.localStorage.removeItem(readKey(id));}catch{/* nothing to forget */}}
  const markedOf=p=>new Set(Object.keys(reading(p).marks).filter(k=>reading(p).marks[k]));
  function paintNotes(){
   const box=$('[data-wr-text]');if(!box)return;
   const live=doc.activeElement?.dataset?.rt?{p:doc.activeElement.dataset.rt,r:doc.activeElement.dataset.rid,a:doc.activeElement.selectionStart,b:doc.activeElement.selectionEnd}:null;
   box.querySelectorAll('.wr-drafts').forEach(n=>{n.innerHTML='';});box.querySelectorAll('.wr-margin').forEach(n=>{n.innerHTML='';});
   const loose=$('[data-wr-loose]');let looseHTML='';
   st.props.forEach((p,k)=>{
    const n=k+1,by=v2.actorName(p.by||'agent:'),shown=p.replacements.filter(r=>box.querySelector(`[data-row="${CSS.escape(r.id)}"]`)),off=markedOf(p),rd=p.reads?reading(p):null;
    for(const r of shown){
     const row=box.querySelector(`[data-row="${CSS.escape(r.id)}"]`),left=off.has(r.id);
     const mark=p.reads&&st.human&&p.replacements.length>1?`<button type="button" class="wr-mark" data-act="mark" data-id="${esc(p.id)}" data-rid="${esc(r.id)}" aria-pressed="${left}">Not me</button>`:'';
     // A read-through is his to rewrite before it becomes his: the words are a box he can change, as in the existing workspace.
     const words=rd?String(rd.words[r.id]??r.words):r.words;
     const body=rd&&st.human?`<textarea class="wr-dt" rows="1" data-rt="${esc(p.id)}" data-rid="${esc(r.id)}" aria-label="${esc(by+'’s words for this paragraph. Change them to rewrite them.')}" spellcheck="true"${left?' readonly':''}>${esc(words)}</textarea>`:`<span class="wr-dtx">${esc(words)}</span>`;
     row.querySelector('.wr-drafts').insertAdjacentHTML('beforeend',`<div class="wr-draft${left?' wr-left':''}"><sup>${n}</sup>${body}${mark}</div>`);
    }
    const note=noteHTML(p,n,by);
    if(shown.length)box.querySelector(`[data-row="${CSS.escape(shown[0].id)}"] .wr-margin`).insertAdjacentHTML('beforeend',note);
    else looseHTML+=`<div class="wr-loosenote">${note}</div>`;
   });
   box.querySelectorAll('textarea.wr-dt').forEach(fit);
   if(live){const t=box.querySelector(`[data-rt="${CSS.escape(live.p)}"][data-rid="${CSS.escape(live.r)}"]`);if(t){t.focus({preventScroll:true});try{t.setSelectionRange(live.a,live.b);}catch{}}}
   if(loose)loose.innerHTML=looseHTML+(st.dropped?`<p class="wr-dim wr-stale">${esc(st.dropped===1?'A suggestion was set aside because the words changed after it was made.':st.dropped+' suggestions were set aside because the words changed after they were made.')}</p>`:'');
  }
  function noteHTML(p,n,by){
   const ok=p.simple&&p.replacements.length||p.reads;
   const head=`<p class="wr-note-h"><sup>${n}</sup>${esc(ok?by+' suggests new words':by+' wrote more for this piece')}</p>`;
   if(!ok)return `<div class="wr-note" data-prop="${esc(p.id)}">${head}<p class="wr-dim">This kind of suggestion is read through in Advanced, where you choose what becomes yours.</p><div class="wr-row-btns"><a class="wr-btn" href="${esc(adv('write'))}">Read it in Advanced${icon('out')}</a></div></div>`;
   const many=p.replacements.length>1?` for ${p.replacements.length} paragraphs`:'';
   const asked=p.reads&&p.instruction?`<p class="wr-dim">${esc('Asked: '+p.instruction)}</p>`:'';
   // A read-through is read as a whole: he changes any words that are not his, or marks a paragraph Not me, and what he leaves
   // alone counts as read (the existing workspace's own account). A plain suggestion goes in exactly as it stands, so its
   // button says that, in the existing workspace's own words: Accept and Reject.
   const buttons=p.reads?`<div class="wr-row-btns"><button type="button" class="pri" data-act="finish" data-id="${esc(p.id)}">Rewrite it as mine</button><button type="button" class="v2-ghost" data-act="leave" data-id="${esc(p.id)}">Not me</button></div>`
    :`<div class="wr-row-btns"><button type="button" class="pri" data-act="accept" data-id="${esc(p.id)}">Accept</button><button type="button" class="v2-ghost" data-act="reject" data-id="${esc(p.id)}">Reject</button></div>`;
   const how=p.reads?'Shown dim'+many+'. Change any words that are not yours, or use Not me'+(p.replacements.length>1?' under a paragraph':'')+' to leave it out. What you leave alone counts as read, and becomes yours when you press Rewrite it as mine.'
    :'Shown dim'+many+'. If you accept, they go in exactly as they stand. They stay dim until you do.';
   return `<div class="wr-note" data-prop="${esc(p.id)}">${head}${asked}<p class="wr-dim">${esc(how)}</p>${buttons}</div>`;
  }

  // ---------- the conflict: his words and the newer saved ones, side by side ----------
  function paintConflict(){
   const box=$('[data-wr-conflict]');if(!box)return;
   const c=st.conflict;box.hidden=!c;if(!c){box.innerHTML='';return;}
   // Both sides, paragraph by paragraph: what he has changed, and what the saved version changed that he has not seen.
   const rows=rowsOf(c.fresh),fresh=new Map(rows.map(r=>[r.id,r])),base=st.baseWords,items=[];
   const says=(label,body)=>`<p><b>${label}</b> ${body}</p>`,note=text=>`<i>${esc(text)}</i>`;
   for(const r of rows){
    const e=st.edits.get(r.id),was=base.has(r.id)?base.get(r.id):e?.orig;
    if(was===undefined){items.push(says('Yours',note('Nothing here yet.'))+says('Saved',note('A new paragraph in the saved version: ')+esc(r.words)));continue;}
    const changed=was!==r.words;
    if(e)items.push(says('Yours',e.text.trim()?esc(e.text):note('You emptied this paragraph.'))+says('Saved',changed?esc(r.words):note('Not changed in the saved version.')));
    else if(changed)items.push(says('Yours',note('You have not changed this paragraph.'))+says('Saved',esc(r.words)));
   }
   for(const [rid,e] of st.edits){if(!fresh.has(rid))items.push(says('Yours',e.text.trim()?esc(e.text):note('You emptied this paragraph.'))+says('Saved',note('This paragraph is not in the saved version.')));}
   for(const [rid,was] of base){if(!fresh.has(rid)&&!st.edits.has(rid))items.push(says('Yours',esc(was))+says('Saved',note('This paragraph was removed in the saved version.')));}
   for(const a of st.added.filter(a=>String(a.text).trim()))items.push(says('Yours',esc(a.text))+says('Saved',note('A new paragraph. It is not in the saved version.')));
   const shown=items.slice(0,24),lines=shown.map(x=>`<li>${x}</li>`).join('')+(items.length>shown.length?`<li><p class="wr-dim">${esc('And '+(items.length-shown.length)+' more paragraphs differ.')}</p></li>`:'');
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
   st.base=c.fresh;st.rows=rowsOf(c.fresh);st.baseWords=wordsMap(st.rows);foldAdded();st.conflict=null;st.problem='';st.stopped=false;paintConflict();paintText();stash();await save({hold:null});
  }

  // ---------- taking in a server version ----------
  const wordsMap=rows=>new Map(rows.map(r=>[r.id,r.words]));
  /** A new paragraph the server now holds is an edit of that saved paragraph, never a second insert with the same id. */
  function foldAdded(){
   const now=new Map(st.rows.map(r=>[r.id,r]));
   for(const a of [...st.added]){
    const r=now.get(a.id);if(!r)continue;
    st.added=st.added.filter(x=>x!==a);
    if(a.text!==r.words&&r.safe)st.edits.set(r.id,{text:a.text,orig:r.words});
   }
  }
  /** Puts the server's version on the page. Nothing he typed is dropped: a paragraph he is still editing keeps his words
      against the new text, one that has just been saved as new becomes an edit of the saved paragraph, and words typed into
      a paragraph that is gone come back as a new paragraph after the one before it. */
  function adopt(read){
   const old=st.rows;
   st.base=read;st.rows=rowsOf(read);st.baseWords=wordsMap(st.rows);
   const h=(read.history||[]).filter(x=>x.state==='committed'&&x.modifiedAt).slice(-1)[0];
   if(h&&!st.savedAt)st.savedAt=h.modifiedAt;
   const now=new Map(st.rows.map(r=>[r.id,r]));
   for(const [rid,e] of [...st.edits]){
    const r=now.get(rid);
    if(!r){
     st.edits.delete(rid);
     if(String(e.text).trim()){
      let after=st.rows.length?st.rows[st.rows.length-1].id:null;const at=old.findIndex(x=>x.id===rid);
      if(at>=0){after=null;for(let i=at-1;i>=0;i--)if(now.has(old[i].id)){after=old[i].id;break;}}
      st.added.push({id:uuid(),afterId:after,text:e.text});
     }
    }else if(r.words===e.text)st.edits.delete(rid);
    else e.orig=r.words;
   }
   foldAdded();
   paintText();
  }
  /** Where a position in the old text lands in the new one, through the one change between them. */
  function carryAt(d,at){return at<=d.from?at:at>=d.to?at+d.insert.length-(d.to-d.from):d.from+d.insert.length;}
  /** A save of his own has been answered, or is found committed after a reload. What it carried is settled; what he typed
      after it was sent is carried onto the paragraphs it made (the difference between the text sent and his text now), so
      nothing typed meanwhile is lost and nothing is saved twice. Returns where his caret belongs in a new paragraph. */
  function settleSent(read,info){
   const now=new Map(rowsOf(read).map(r=>[r.id,r])),later=[],caret={};
   const cur=id=>st.edits.has(id)?st.edits.get(id).text:null;
   for(const sp of info.splits||[]){
    // What was written after the whole paragraph now follows its second half, so the empty box stays after the last paragraph.
    for(const a of st.added)if(a.afterId===sp.id)a.afterId=sp.newId;
    const typed=cur(sp.id),c=typed===null?sp.text:typed;st.edits.delete(sp.id);
    if(c===sp.text)continue;
    const d=minimalDiff(sp.text,c),m=carryAt(d,sp.at);
    later.push([sp.id,c.slice(0,m).trimEnd()],[sp.newId,c.slice(m).trimStart()]);
    caret[sp.newId]=Math.max(0,d.from+d.insert.length-m);
   }
   for(const j of info.joins||[]){
    const l=cur(j.leftId),r=cur(j.rightId),cl=l===null?j.leftText:l,cr=r===null?j.rightText:r;st.edits.delete(j.leftId);st.edits.delete(j.rightId);
    if(cl===j.leftText&&cr===j.rightText)continue;
    const joined=now.get(j.leftId)?.words||'',sep=joined.startsWith(j.leftText)&&joined.endsWith(j.rightText)&&joined.length>=j.leftText.length+j.rightText.length?joined.slice(j.leftText.length,joined.length-j.rightText.length):' ';
    later.push([j.leftId,cl+sep+cr]);
   }
   for(const [rid,text] of info.edits||[]){if(st.edits.get(rid)?.text===text)st.edits.delete(rid);}
   const sentAdd=new Map(info.added||[]);
   st.added=st.added.filter(a=>!(sentAdd.has(a.id)&&sentAdd.get(a.id)===a.text));
   adopt(read);
   for(const [rid,text] of later){const r=now.get(rid);if(r&&r.safe&&text!==r.words)st.edits.set(rid,{text,orig:r.words});}
   if(later.length)paintText();
   return caret;
  }
  /** After a refusal or a read, are the new committed saves all his own, saves whose answers never reached this page? If
      so they are settled and the server's version taken in, and it is not a newer version. */
  function takeOwn(fresh){
   const known=new Set((st.base?.history||[]).map(h=>h.operationId));
   const fresh_=(fresh.history||[]).filter(h=>h.state==='committed'&&!known.has(h.operationId));
   if(!fresh_.length||fresh_.some(h=>!st.ops.has(h.operationId)))return false;
   const done=new Set(fresh_.map(h=>h.operationId));
   const infos=st.sent.filter(i=>done.has(i.operationId));st.sent=st.sent.filter(i=>!done.has(i.operationId));
   if(infos.length)for(const info of infos)settleSent(fresh,info);else adopt(fresh);
   stash();return true;
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
   // What goes in this save, in a plain record kept with his words until the answer is in (a reload cannot lose it).
   const textOf=id=>st.edits.has(id)?st.edits.get(id).text:(st.rows.find(r=>r.id===id)?.words??''),addedById=new Map(st.added.map(a=>[a.id,a]));
   const info={operationId:mine(uuid()),
    edits:ops.filter(o=>o.kind==='text'||o.kind==='delete').map(o=>[o.id,o.kind==='delete'?'':st.edits.get(o.id)?.text??'']),
    added:ops.filter(o=>o.kind==='insert').map(o=>[o.id,addedById.get(o.id)?.text??o.raw]),
    splits:ops.filter(o=>o.kind==='split').map(o=>({id:o.id,at:o.at,newId:o.newId,text:textOf(o.id)})),
    joins:ops.filter(o=>o.kind==='join').map(o=>({leftId:o.leftId,rightId:o.rightId,leftText:textOf(o.leftId),rightText:textOf(o.rightId)}))};
   const operationId=info.operationId;
   st.sent=[...st.sent,info].slice(-6);st.saving=true;st.problem='';stash();paintSaved();
   let ok=false,retry=false;
   try{
    const result=await v2.call('study-draft.save',{...scope(),operationId,expected:st.base.expected,operations:ops});
    st.sent=st.sent.filter(x=>x!==info);
    const caret=settleSent(result,info);st.savedAt=new Date().toISOString();st.stopped=false;ok=true;
    stash();presence();loadProps();
    const text=undoText||(ops.some(o=>o.kind==='delete')?'Paragraph deleted.':'');
    if(text&&(result.history||[]).some(h=>h.operationId===operationId&&h.canUndo))v2.ui.undo(text,()=>undoOp(operationId));
    if(focus)focusEditor(focus.id,caret[focus.id]??focus.at);
   }catch(error){
    if(error.kind==='stale'||error.kind==='refused'||error.kind==='owner-only')st.sent=st.sent.filter(x=>x!==info);// not committed
    if(error.kind==='stale'){
     // Only a newer revision on the server is a newer version, and a save of his own that this page never heard back from
     // is not newer. Any other refusal is the server's own words.
     let fresh=null;try{fresh=await readDraft();}catch{/* the words stay on this device */}
     if(fresh&&!sameRevision(fresh,st.base)){
      if(takeOwn(fresh))retry=true;else noticeNewer(fresh);
     }
     else{st.problem=error.body?.error||'The app could not save these words.';st.stopped=true;if(!quiet)say(st.problem,'bad');}
    }
    else if(error.kind==='owner-only'){say403(error);}
    else{st.problem=error.kind==='held'||error.kind==='refused'?error.message:'Could not save. Your words are kept on this device.';st.stopped=error.kind==='refused'||error.kind==='held';if(!quiet)say(error.message,'bad');if(!st.stopped)schedule(5000);}
   }finally{
    st.saving=false;st.saveSeq++;stash();paintSaved();
    if(retry&&dirty())schedule(300);
    if(st.again){st.again=false;if(dirty())schedule(300);}
    if(st.refreshWanted){st.refreshWanted=false;void refresh();}
   }
   if(ok&&st.starting)void startArticle();
   return ok;
  }
  /** His first saved words start the Article, as Add a form does in the existing workspace: study-draft.save has put the
      words in the subject's draft, and study.outputs.create (from that draft, with the revisions just read) makes the
      Article. Anything he types while the first save runs is saved first; the boxes are read only for the moment the Article
      is being made, and the page then opens the piece. If it cannot be made, his words stay saved and it is tried again. */
  async function startArticle(){
   if(st.creating||gone||!st.starting||!st.human)return;
   st.creating=true;
   try{
    for(let i=0;i<8&&(dirty()||st.saving)&&!st.conflict&&!st.stopped;i++){clearTimeout(timer);if(st.saving)await settled();else await save({quiet:true,hold:null});}
    if(dirty()||st.conflict||st.stopped||gone){st.creating=false;return;}
    page.querySelectorAll('textarea.wr-ed').forEach(t=>{t.readOnly=true;});
    const standing=await v2.call('subject.standing',{parentStudyId:id});
    const made=(standing.forms||[]).find(f=>f.kind==='article'&&/^out:/.test(f.key||''));
    let outId=made?made.id:null;
    if(!outId){
     const sc={rootBindingId:st.bindingId,parentStudyId:id};
     const [native,outs]=await Promise.all([readDraft(),v2.call('study.outputs',sc)]);
     const r=await v2.call('study.outputs.create',{...sc,kind:'article',sourceBindingId:st.bindingId,expectedNative:native.expected,expectedOutput:outs.expectedOutput});
     outId=r?.view?.output?.id||null;
     if(!outId){const again=await v2.call('subject.standing',{parentStudyId:id});outId=(again.forms||[]).filter(f=>f.kind==='article'&&/^out:/.test(f.key||'')).map(f=>f.id)[0]||null;}
    }
    if(!outId)throw new v2.Error('The Article was made, but its address could not be found. Go back to the subject to open it.');
    if(gone)return;
    st.creating=false;
    v2.go('write/:id',{id},{piece:outId});
   }catch(error){
    st.creating=false;page.querySelectorAll('textarea.wr-ed').forEach(t=>{t.readOnly=!st.human;});
    if(gone)return;
    say('Your words are saved. The Article could not be started yet: '+(error?.message||'try again.'),'bad');
    clearTimeout(timer);timer=setTimeout(()=>{void startArticle();},8000);
   }
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
   await save({hold:null,extra:[{kind:'split',id:rid,at:Math.min(at,text.length),newId}],undoText:'Split a paragraph.',focus:{id:newId,at:0}});
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
     let result,edited=false;
     if(kind==='accept')result=await v2.call('study-ai.accept',{...scope(),requestId:rid,operationId});
     else{
      const off=markedOf(prop),all=prop.replacements.every(r=>off.has(r.id)),rd=reading(prop),edits=[];
      if(all){await leaveOut(prop,operationId);return;}
      for(const r of prop.replacements){
       if(off.has(r.id))continue;
       const words=flat(rd.words[r.id]??r.words).trim();if(words&&words!==r.words)edits.push({id:r.id,words});
      }
      edited=edits.length>0;
      result=await v2.call('study-ai.finish',{...scope(),requestId:rid,operationId,...(edits.length?{edits}:{}),...(off.size?{marks:[...off].map(x=>({id:x}))}:{})});
     }
     if(Array.isArray(result?.projection)&&!dirty())adopt(result);else adopt(await readDraft());
     forgetReading(rid);
     const entry=(st.base.history||[]).find(h=>h.operationId===operationId&&h.canUndo);
     const said=kind==='finish'&&edited?'Changed to your words.':`Changed to ${who}’s words.`;
     if(entry)v2.ui.undo(said,()=>undoOp(operationId));else say(said,'good');
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
    forgetReading(prop.id);say('Left as you wrote it.','good');await loadProps();
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
   const seq=st.saveSeq;let fresh;try{fresh=await readDraft();}catch{return;}
   if(ctx.signal.aborted||gone)return;
   // A save began or ended while this was being read: the answer may be older than what he has saved, and is not to be
   // taken for a newer version or put on the page. Read again once the save is over.
   if(st.saving){st.refreshWanted=true;return;}
   if(st.saveSeq!==seq){void refresh();return;}
   if(!sameRevision(fresh,st.base)){
    if(takeOwn(fresh)){if(dirty())schedule(300);}
    else if(dirty()||st.conflict)noticeNewer(fresh);else{adopt(fresh);}
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
   if(act==='mark'){const p=st.props.find(x=>x.id===b.dataset.id);if(!p)return;const rd=reading(p);rd.marks[b.dataset.rid]=!rd.marks[b.dataset.rid];keepReading(p);paintNotes();page.querySelector(`[data-act="mark"][data-rid="${CSS.escape(b.dataset.rid)}"]`)?.focus({preventScroll:true});return;}
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
  page.addEventListener('input',e=>{
   if(e.target.matches?.('textarea[data-ed]'))onInput(e.target);
   else if(e.target.matches?.('textarea[data-rt]')&&st.human){const p=st.props.find(x=>x.id===e.target.dataset.rt);if(p){reading(p).words[e.target.dataset.rid]=e.target.value;keepReading(p);fit(e.target);}}
  });
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
    if(!st.form&&!st.starting){shell0('This subject has no Article yet, so there is nothing to write here.');return;}
    if(!st.bindingId){shell0('The words of this piece are not kept where Write can open them. They open in Advanced.');return;}
    const read=await readDraft();if(ctx.signal.aborted)return;
    st.base=read;st.rows=rowsOf(read);st.baseWords=wordsMap(st.rows);
    const saved=unstash(),committed=(read.history||[]).filter(x=>x.state==='committed'),h=committed.filter(x=>x.modifiedAt).slice(-1)[0];
    if(h)st.savedAt=h.modifiedAt;
    let newer=false,restored=false;
    if(saved){
     for(const [rid,text,orig] of saved.edits)st.edits.set(rid,{text:String(text),orig:String(orig??'')});
     for(const a of saved.added){if(a&&typeof a.id==='string'&&typeof a.text==='string'&&a.text.trim())st.added.push({id:a.id,afterId:a.afterId??null,text:flat(a.text)});}
     for(const i of saved.sent)if(i&&typeof i.operationId==='string')st.ops.add(i.operationId);
     // A save that was on its way when the page closed. If the server holds it, it is his own save and not a newer version:
     // what it carried is settled, and what he typed after it was sent is carried on.
     const done=new Set(committed.map(x=>x.operationId)),ours=saved.sent.filter(i=>done.has(i.operationId)),last=committed.at(-1);
     if(ours.length){
      st.sent=saved.sent.filter(i=>!done.has(i.operationId));
      for(const info of ours)settleSent(read,info);
      if(last&&!st.ops.has(last.operationId))newer=true;// someone else saved after it
      restored=true;
     }else{
      st.sent=saved.sent;// a late commit of these is still his own
      for(const rid of [...st.edits.keys()]){const r=st.rows.find(x=>x.id===rid);if(!r||!r.safe||st.edits.get(rid).text===r.words)st.edits.delete(rid);}
      foldAdded();
      newer=!!saved.draft&&saved.draft!==read.expected?.workflow?.draft;
      if(newer&&Array.isArray(saved.base))st.baseWords=new Map(saved.base);
      restored=true;
     }
     for(const [rid,e] of st.edits){if(!e.orig)e.orig=st.rows.find(x=>x.id===rid)?.words??'';}
    }
    shell();stash();
    if(restored&&dirty()&&newer)noticeNewer(read);
    else if(restored&&dirty()){say('Your unsaved words from earlier are back.','info');schedule(600);}
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
 // ====================================================================================================================
 // A Magazine story's words. They are the Magazine's own, kept in its working draft, and are reached only with
 // magazine.working-draft.read, .edit (one paragraph at a time, the hash he saw goes with it), .operation and, for an
 // assistant's proposal, magazine.proposals with magazine.proposal.accept and .reject. Only he writes and only he decides.
 // What he types is kept on this device, one entry for each paragraph, and sent one paragraph at a time with an operation
 // id that is kept with it, so a slow save, a reload or a closed tab loses nothing: the same operation sent again is
 // answered with the first answer, and it is not sent again while the Magazine may still be running the first. A
 // paragraph that changed in the Magazine meanwhile is never merged and never overwritten: he sees both, and his words
 // are put on a saved paragraph only when it is the same place with the same neighbours. A mark that has a meaning in the
 // Magazine (a heading, a review mark, a note, a rework order) is never sent through this command. Adding or removing a
 // paragraph has no command here, so it says it is not built yet and opens in Advanced.
 // ====================================================================================================================
 /** The one switch. When false a story's words show read only in Write, with a line saying they are changed in the Magazine
     and one link to the existing workspace. When true they are edited here as this part builds. */
 // Stays false until the faults listed in docs/plans/2026-11-11-version-two-open-corrections.md under "Write for a Magazine story" are corrected and reviewed.
 const STORY_EDITING=false;
 const MAX_PARAGRAPH=200000;// the Magazine's own limit for one paragraph
 const RESEND_GRACE_MS=8000;// an operation is not sent again sooner than this after it was sent, even if no answer came
 const STORY_KEY=story=>'ar-v2-write-story:'+story.storyId+':'+story.pieceId+':';
 /** The marks that mean something to the Magazine when they are typed into a paragraph through .edit. It would turn them into
     structure (a heading, a review mark, a hidden note, a rework order), so they are not sent from here. Returns what was
     found, in words, or '' when there is nothing. A mark the saved paragraph already has is not new, and is let through. */
 function markupIn(text,orig){
  const t=String(text??''),o=String(orig??''),has=re=>re.test(t)&&!re.test(o);
  if(has(/\n[ \t]*\n/))return 'a blank line (it would start a new paragraph)';
  if(has(/^\s*#{1,6}(\s|$)/))return '"#" at the start (a heading)';
  if(has(/==/))return '"==" (a review mark)';
  if(has(/%%/))return '"%%" (a note)';
  const slashes=/(^|[\s"'(])\/([^\/\n]+?)\/(?=$|[\s.,;:!?"')])/g,had=[...o.matchAll(slashes)].map(m=>m[2]);
  if([...t.matchAll(slashes)].some(m=>!had.includes(m[2])))return 'words between slashes (a rework order)';
  if(has(/^\s*>/m))return '">" at the start of a line (a large line)';
  if(has(/^\s*([-*+]|\d+[.)])\s/m))return 'a list mark at the start of a line';
  if(has(/^\s*\|/m))return '"|" at the start (a table)';
  if(has(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/m))return 'a line of dashes (a rule)';
  if(has(/<!--/))return '"<!--" (a comment)';
  if(has(/\[\[/))return '"[[" (a link)';
  if(has(/```|~~~/))return 'a code fence';
  if(has(/\*\*/))return '"**" (bold)';
  return '';
 }
 /** The saved paragraph his unsaved paragraph belongs to: the one with the hash he saw (the same block when it is there), or null. */
 function placeEdit(edit,rows){
  const hits=rows.filter(r=>r.edit&&r.edit.seen===edit.seen);
  return hits.find(r=>r.edit.block===edit.block)||(hits.length===1?hits[0]:null);
 }
 /** The saved paragraph that stands where his lost paragraph stood: the same place with the same words on each side of it.
     Anything less is not a pairing, and nothing is ever written over a paragraph on a guess. */
 function counterpartOf(edit,rows){
  if(edit.prev===undefined||edit.next===undefined)return null;
  for(let i=0;i<rows.length;i++){
   const r=rows[i];
   if(r.edit&&r.edit.block===edit.block&&(rows[i-1]?.words??null)===edit.prev&&(rows[i+1]?.words??null)===edit.next)return r;
  }
  return null;
 }
 /** What a proposal would change, in the file's own words: the paragraphs it brings in and the ones it takes out, counted
     one for one (a paragraph twice in one and once in the other differs), and whether it only puts the same ones in another order. */
 function proposalChanges(current,proposed){
  const body=text=>String(text||'').replace(/^---\n[\s\S]*?\n---\n/,'').split(/\n\s*\n/).map(t=>t.replace(/==/g,'').trim()).filter(t=>t&&t!=='---');
  const a=body(current),b=body(proposed);
  const count=l=>{const m=new Map();for(const t of l)m.set(t,(m.get(t)||0)+1);return m;};
  const minus=(x,other)=>{const left=count(other),out=[];for(const t of x){const n=left.get(t)||0;if(n>0)left.set(t,n-1);else out.push(t);}return out;};
  const out=minus(a,b),inn=minus(b,a);
  return {out,in:inn,reordered:!out.length&&!inn.length&&a.join('\n')!==b.join('\n')};
 }
 /** The unsent words this device keeps for a story's piece, one entry for each paragraph. */
 function keptEntries(story){
  const out=[],pre=STORY_KEY(story);
  try{
   const ls=root.localStorage;
   for(let i=0;i<ls.length;i++){
    const k=ls.key(i);if(!k||!k.startsWith(pre))continue;
    try{const e=JSON.parse(ls.getItem(k));if(e&&typeof e.seen==='string'&&typeof e.text==='string')out.push({...e,key:k});}catch{/* an unreadable entry is left alone */}
   }
  }catch{/* blocked storage */}
  return out;
 }
 const keptUnsaved=e=>!!e&&(!!e.sending||(String(e.text||'').trim()!==''&&e.text!==e.orig));
 /** Whether the Magazine has no working draft for this story and piece (the catalog lists the story without the piece). */
 async function storyHasNoDraft(story){
  try{
   const c=await v2.call('magazine.working-draft.catalog',{});
   const s=(c.stories||[]).find(x=>x.storyId===story.storyId);
   return !!s&&!(s.pieces||[]).some(p=>p.pieceId===story.pieceId);
  }catch{return false;}
 }
 /** The Magazine's own words for a refusal (the app's general line for a 409 says the page is out of date, which is not the case). */
 const storyWords=error=>String(error?.body?.error||error?.message||'');
 const NO_DRAFT='This story has no draft yet, so there are no words here. A draft is started in the Magazine; it is not started from here.';
 v2.shared.writeStory=Object.freeze({placeEdit,counterpartOf,proposalChanges,markupIn,keptEntries,keptUnsaved,storyHasNoDraft,storyWords,NO_DRAFT,STORY_KEY});

 function openStory(page,ctx,found){
  const id=ctx.params.id,human=v2.isHuman(),story=found.story;
  const sel={storyId:story.storyId,pieceId:story.pieceId,edition:'working'};
  const st={standing:found.standing,forms:found.forms,form:found.form,piece:found.piece,read:null,rows:[],edits:new Map(),props:[],dropped:0,written:new Map(),
   savedAt:null,problem:'',saving:false,running:null,again:false,refreshWanted:false,saveSeq:0,stopped:false,ops:new Set(),human,focus:false,none:false};
  let timer=null,propTimer=null,presenceTimer=null,presenceSeq=0,presenceOk=true,presenceSent='',gone=false;
  const session=uuid().slice(0,8),PRE=STORY_KEY(story);
  const $=sel2=>page.querySelector(sel2);
  const say=(text,tone='info')=>v2.ui.say(text,{tone});
  const adv=section=>v2.advanced({subject:id,piece:story.pieceId,section});
  const readStory=()=>v2.call('magazine.working-draft.read',sel);
  const all=()=>[...st.edits.values()];
  const live=e=>!e.gone;
  /** Whether this page may write at all: it is his, editing is switched on, and the Magazine says the draft can be edited. */
  const canWrite=()=>STORY_EDITING&&st.human&&st.read?.editable!==false;
  /** Words not yet in the Magazine: sent and not answered, unsent, or held back by a newer saved version. */
  const unsaved=e=>!!e.sending||e.gone||(!!e.text.trim()&&e.text!==e.orig);
  const dirty=()=>all().some(unsaved);
  const editFor=row=>row.edit?all().find(e=>live(e)&&e.seen===row.edit.seen&&e.block===row.edit.block):null;
  const around=row=>{const i=st.rows.indexOf(row);return {prev:st.rows[i-1]?.words??null,next:st.rows[i+1]?.words??null};};

  // ---------- his unsaved words, kept on this device, one entry for each paragraph: his only ----------
  // Each entry is written and removed on its own, so a save in another tab never erases the unsent words of this one.
  function stash(){
   if(!st.human||!STORY_EDITING)return;
   try{
    const ls=root.localStorage,want=new Map();
    for(const e of all()){
     if(!unsaved(e)||!(e.text.trim()||e.sending))continue;
     want.set(e.k,PRE+(e.sending?e.sending.seen:e.seen)+'.'+(e.sending?e.sending.block:e.block));
    }
    for(const [k,key] of st.written)if(want.get(k)!==key)ls.removeItem(key);
    for(const e of all()){
     const key=want.get(e.k);if(!key)continue;
     ls.setItem(key,JSON.stringify({v:1,at:Date.now(),seen:e.seen,block:e.block,orig:e.orig,text:e.text,prev:e.prev,next:e.next,sending:e.sending}));
    }
    st.written=want;
   }catch{/* private window or blocked storage: the words are still on the page */}
  }
  function unstash(){
   if(!st.human||!STORY_EDITING)return [];
   return keptEntries(story).filter(e=>Number.isSafeInteger(e.block)).map(e=>{
    const s=e.sending,ok=s&&typeof s.op==='string'&&typeof s.text==='string'&&typeof s.seen==='string'&&Number.isSafeInteger(s.block);
    const edit={k:uuid(),seen:e.seen,block:e.block,orig:String(e.orig??''),text:e.text,prev:e.prev,next:e.next,refused:'',kind:'',gone:false,tries:0,lastSent:'',
     sending:ok?{op:s.op,text:s.text,seen:s.seen,block:s.block,at:Number(s.at)||0,tried:s.tried!==false}:null};
    st.written.set(edit.k,e.key);return edit;
   });
  }

  // ---------- who is where: tells an assistant he has unsaved words open ----------
  function presence(force=false){
   if(!presenceOk||gone||!canWrite())return;
   const d=dirty(),sig=String(d);if(!d&&!presenceSent)return;if(!force&&sig===presenceSent)return;presenceSent=sig;
   v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:story.storyId},dirty:d,sequence:++presenceSeq,session}).catch(()=>{presenceOk=false;});
  }

  // ---------- drawing ----------
  function shell(){
   const names=tabNames(st.forms);
   const right=`<span class="wr-saved" data-wr-saved></span>
    <button type="button" class="v2-ghost" data-wr="ask" aria-label="Ask">${icon('ask')}<span>Ask</span></button>
    <button type="button" class="v2-ghost" data-wr="focus" aria-label="Focus">${own('focus')}<span>Focus</span></button>`;
   page.innerHTML=bar({id,forms:st.forms,form:st.form,piece:st.piece,mode:'write',right})+`
   <div class="wr-focusbar" hidden><span>${esc(st.standing?.title||'')} / ${esc(names.get(st.form?.key)||'Article')}</span><button type="button" class="v2-ghost" data-wr="unfocus">Leave focus</button></div>
   <div class="wr-work" data-src="closed">
    <article class="wr-paper"><div class="wr-sheet">
     <div class="wr-conflict" data-wr-conflict hidden></div>
     <p class="wr-saved wr-saved-m" data-wr-saved role="status"></p>
     <h1 class="wr-title">${esc(st.read?.authority?.title||st.form?.title||st.standing?.title||'')}</h1>
     ${st.human?'':`<p class="wr-ro" role="status">${esc('Opened as '+v2.actorName(v2.actor())+'. Only Adrian writes here. '+v2.actorName(v2.actor())+' can propose words, and Adrian decides.')}</p>`}
     <p class="wr-ro" data-wr-locked role="status" hidden></p>
     <div class="wr-loose wr-props" data-wr-props></div>
     <div class="wr-text" data-wr-text></div>
     ${STORY_EDITING?`<section class="wr-todo" aria-label="Still to write"><p class="wr-label">New and removed paragraphs</p>${v2.ui.notBuilt('Adding, splitting, joining and removing paragraphs of a Magazine story. Each paragraph can be changed here; the shape of the story is changed in the Magazine.',{advanced:{subject:id,piece:story.pieceId,section:'write'}})}</section>`:''}
    </div></article>
   </div>`;
   const out=$('.wr-todo .v2-out');if(out)out.setAttribute('data-wr-advanced','');
   paintText();paintSaved();paintConflict();paintProps();
  }
  /** Why the whole page is read only, when it is for a reason other than being an assistant's: the switch, or the Magazine. */
  function paintLocked(){
   const n=$('[data-wr-locked]');if(!n)return;
   let html='';
   if(!STORY_EDITING)html=`${esc('A Magazine story’s words are changed in the Magazine, not here.')} <a class="wr-btn" href="${esc(adv('write'))}">Open in Advanced${icon('out')}</a>`;
   else if(st.human&&st.read?.editable===false)html=esc((st.read.unavailableReason||'The Magazine is not open for editing right now.')+' These words are read only until it is.');
   n.hidden=!html;n.innerHTML=html;
  }
  function rowHTML(r,n){
   const label=r.kind==='heading'?'Heading':'Paragraph '+n;
   if(!r.safe||!r.edit)return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><p class="wr-lock"${r.lock==='pending'?' title="This line is waiting for a review decision in the Magazine. Decide it there."':' title="This passage is kept as it is. Change it in the Magazine."'}>${esc(r.words)}</p>${r.lock==='pending'?'<p class="wr-dim wr-lock-why">Waiting for a review decision in the Magazine.</p>':''}</div><aside class="wr-margin"></aside></div>`;
   const e=editFor(r),cls=r.kind==='heading'?' wr-h':r.kind==='blockquote'?' wr-q':'';
   return `<div class="wr-row" data-row="${esc(r.id)}"><div class="wr-main"><textarea class="wr-ed${cls}" rows="1" data-ed="${esc(r.id)}" aria-label="${esc(label)}" spellcheck="true"${canWrite()?'':' readonly'}>${esc(e?e.text:r.words)}</textarea></div><aside class="wr-margin"></aside></div>`;
  }
  function paintText(){
   const box=$('[data-wr-text]');if(!box)return;
   paintLocked();
   const a=doc.activeElement,keep=a?.dataset?.ed?{id:a.dataset.ed,a:a.selectionStart,b:a.selectionEnd}:null;
   let n=0;
   box.innerHTML=st.rows.length?st.rows.map(r=>rowHTML(r,r.kind==='heading'?0:++n)).join(''):'<p class="wr-dim" role="status">This story has no words yet.</p>';
   box.querySelectorAll('textarea').forEach(fit);
   if(keep){const t=box.querySelector(`[data-ed="${CSS.escape(keep.id)}"]`);if(t){t.focus({preventScroll:true});try{t.setSelectionRange(keep.a,keep.b);}catch{}}}
  }
  function fit(t){t.style.height='auto';t.style.height=(t.scrollHeight+1)+'px';}
  function paintSaved(){
   const text=st.none||!STORY_EDITING?'':!st.human||st.read?.editable===false?'Read only':st.problem?st.problem:st.saving?'Saving':dirty()?(all().some(e=>e.gone)?'Not saved: a newer version exists':all().some(e=>e.refused)?'Not saved':'Not saved yet'):st.savedAt?savedLabel(st.savedAt):'Saved';
   page.querySelectorAll('[data-wr-saved]').forEach(el=>{el.textContent=text;el.dataset.tone=st.problem||all().some(e=>e.gone||e.refused)?'bad':'';});
  }
  /** His words that are held back, each beside what is saved in the Magazine: a newer version, or a refusal in the Magazine's
      words. Nothing here only throws his words away: they can be copied, or placed in the Magazine, first. */
  function paintConflict(){
   const box=$('[data-wr-conflict]');if(!box)return;
   const lost=all().filter(e=>e.gone),refused=all().filter(e=>!e.gone&&e.refused);
   box.hidden=!lost.length&&!refused.length;if(box.hidden){box.innerHTML=''; return;}
   const note=text=>`<i>${esc(text)}</i>`,says=(label,body)=>`<p><b>${label}</b> ${body}</p>`;
   const copy=e=>`<button type="button" data-act="copy" data-k="${esc(e.k)}">Copy my words</button><a class="wr-btn" href="${esc(adv('write'))}">Open in Advanced${icon('out')}</a>`;
   const items=lost.map(e=>{
    const c=counterpartOf(e,st.rows);
    return c?`<li>${says('Yours',esc(e.text))}${says('Saved',esc(c.words))}<div class="wr-row-btns"><button type="button" class="pri" data-act="mine" data-k="${esc(e.k)}">Keep my words</button><button type="button" data-act="theirs" data-k="${esc(e.k)}">Use the saved version</button></div></li>`
     :`<li>${says('Yours',esc(e.text))}${says('Saved',note('This paragraph is not where you left it, so your words are not put on any other paragraph. They stay here and on this device until you place them.'))}<div class="wr-row-btns">${copy(e)}<button type="button" data-act="theirs" data-k="${esc(e.k)}">I have placed these words</button></div></li>`;
   }).concat(refused.map(e=>`<li>${says('Yours',esc(e.text.length>600?e.text.slice(0,600)+'…':e.text))}${says('Not saved',note(e.refused))}<div class="wr-row-btns">${copy(e)}</div></li>`));
   box.innerHTML=`<h2>${lost.length?'A newer version of this story is saved in the Magazine':'Some words were not saved'}</h2>
    <p class="wr-dim">${lost.length?'Your words are still here and are not saved. Nothing is mixed for you and nothing is written over another paragraph.':'Your words are still here and on this device. Change them and they are tried again.'}</p><ul class="wr-pairs">${items.join('')}</ul>`;
  }

  // ---------- an assistant's proposals: his to take or turn down ----------
  async function loadProps(){
   if(!STORY_EDITING){st.props=[];paintProps();return;}
   try{
    const list=await v2.call('magazine.proposals',{status:'open',story:story.storyId});if(ctx.signal.aborted||gone)return;
    const path=st.read?.authority?.path,hash=st.read?.document?.hash;
    const mine=(list.proposals||[]).filter(p=>p.status==='open'&&p.path===path);
    const fresh=mine.filter(p=>p.baseHash===hash);st.dropped=mine.length-fresh.length;
    const full=await Promise.all(fresh.map(p=>v2.call('magazine.proposal',{proposalId:p.proposalId}).catch(()=>null)));
    if(ctx.signal.aborted||gone)return;
    st.props=fresh.map((p,i)=>full[i]&&typeof full[i].content==='string'?{id:p.proposalId,by:p.actor||'',at:p.createdAt,changes:proposalChanges(st.read?.document?.text,full[i].content)}:null).filter(Boolean);
   }catch{st.props=[];}
   paintProps();
  }
  function paintProps(){
   const box=$('[data-wr-props]');if(!box)return;
   const part=(label,list)=>list.length?`<p class="wr-dim"><b>${label}</b></p>${list.slice(0,6).map(t=>`<p class="wr-dt-x">${esc(t)}</p>`).join('')}${list.length>6?`<p class="wr-dim">${esc('And '+(list.length-6)+' more paragraphs.')}</p>`:''}`:'';
   box.innerHTML=st.props.map((p,k)=>{
    const by=v2.actorName(p.by||'agent:'),n=k+1,c=p.changes;
    const body=(c.in.length||c.out.length)?part('Would come in',c.in)+part('Would go',c.out):c.reordered?'<p class="wr-dim">It puts the same paragraphs in another order.</p>':'<p class="wr-dim">The paragraphs are the same. Only marks in them, or the file around them, change.</p>';
    return `<div class="wr-note" data-prop="${esc(p.id)}"><p class="wr-note-h"><sup>${n}</sup>${esc(by+' suggests new words for this story')}</p><p class="wr-dim">As written in the file. If you accept, they replace the saved words as they stand. They are not yours until you do.</p>${body}${canWrite()?`<div class="wr-row-btns"><button type="button" class="pri" data-act="accept" data-id="${esc(p.id)}">Accept</button><button type="button" class="v2-ghost" data-act="reject" data-id="${esc(p.id)}">Reject</button></div>`:'<p class="wr-dim">Only Adrian decides.</p>'}</div>`;
   }).join('')+(st.dropped?`<p class="wr-dim wr-stale">${esc(st.dropped===1?'A suggestion was set aside because the words changed after it was made.':st.dropped+' suggestions were set aside because the words changed after they were made.')}</p>`:'');
  }
  async function decide(kind,pid){
   if(!canWrite())return;
   if(dirty()){say('Your words are not saved yet. They save by themselves in a moment; then you can decide.','warn');return;}
   const prop=st.props.find(p=>p.id===pid);if(!prop)return;
   const operationId=uuid();st.ops.add(operationId);
   try{
    if(kind==='accept'){
     await v2.call('magazine.proposal.accept',{proposalId:pid,operationId});
     adopt(await readStory());
     v2.ui.undo(`Changed to ${v2.actorName(prop.by||'agent:')}’s words.`,()=>undo(operationId));
    }else{await v2.call('magazine.proposal.reject',{proposalId:pid});say('Left as you wrote it.','good');}
    await loadProps();
   }catch(error){say(storyWords(error)||error.message,'bad');if(error.kind!=='owner-only')await loadProps();}
  }
  /** Takes back one accepted proposal, found by its own operation. */
  async function undo(operationId){
   try{
    await v2.call('magazine.working-draft.undo',{...sel,undoOperationId:operationId});
    adopt(await readStory());loadProps();
   }catch(error){say(storyWords(error)||error.message,'bad');}
  }

  // ---------- taking in the saved version ----------
  /** Puts the saved words on the page. Nothing he typed is dropped: each paragraph he is changing keeps his words against
      the saved ones, and one that is no longer where he left it is held back with both versions shown. */
  function adopt(read){
   st.read=read;st.rows=storyRows(read);
   const h=(read.history||[]).filter(x=>x.state==='committed'&&x.modifiedAt).slice(-1)[0];
   if(h&&!st.savedAt)st.savedAt=h.modifiedAt;
   for(const [k,e] of [...st.edits]){
    if(e.sending)continue;// its answer is still to come; it is settled when it does
    const row=placeEdit(e,st.rows);
    if(row){e.gone=false;e.block=row.edit.block;e.orig=row.words;Object.assign(e,around(row));if(e.text===row.words)st.edits.delete(k);}
    else if(e.text.trim())e.gone=true;
    else st.edits.delete(k);
   }
   paintText();paintConflict();paintSaved();paintProps();
  }

  // ---------- saving ----------
  function save(){
   if(!canWrite())return Promise.resolve(false);
   if(st.saving){st.again=true;return st.running;}
   st.running=run();return st.running;
  }
  const nextEdit=()=>all().find(e=>live(e)&&!e.refused&&(e.sending||(e.text.trim()&&e.text!==e.orig&&e.text!==e.lastSent)));
  async function run(){
   st.saving=true;st.problem='';paintSaved();let ok=false;
   try{
    for(let guard=0;guard<200;guard++){
     const e=nextEdit();if(!e)break;
     const r=await send(e);
     if(r==='ok')ok=true;else if(r==='stop')break;
    }
   }finally{
    st.saving=false;st.saveSeq++;stash();paintSaved();paintConflict();
    if(st.again){st.again=false;if(dirty())schedule(300);}
    if(st.refreshWanted){st.refreshWanted=false;void refresh();}
   }
   return ok;
  }
  /** What the Magazine says of an operation: committed (with its result), unknown to it, or not to be told yet (it may still
      be running). An operation that may still be running is never sent again. */
  async function probe(op){
   try{
    const r=await v2.call('magazine.working-draft.operation',{...sel,operationId:op});
    return r&&r.state==='committed'&&r.result?{state:'committed',result:r.result}:{state:'busy'};
   }catch(error){return error.status===404?{state:'none'}:{state:'busy'};}
  }
  /** The answer to a save is in (or was found committed): what it carried is settled. What he typed after it was sent stays,
      as a change to the paragraph the save made. */
  async function settle(e,s,out){
   e.sending=null;e.tries=0;e.seen=out.h||e.seen;e.orig=String(out.plain??s.text);
   if(e.text===s.text||e.text===e.orig)st.edits.delete(e.k);
   st.savedAt=new Date().toISOString();st.problem='';st.stopped=false;
   try{adopt(await readStory());}catch{st.refreshWanted=true;}
   stash();presence();void loadProps();
   return 'ok';
  }
  /** One paragraph. The operation id is made before the words go and kept with them on this device until the answer is in. */
  async function send(e){
   if(!e.sending)e.sending={op:uuid(),text:e.text,seen:e.seen,block:e.block,at:0,tried:false};
   const s=e.sending;st.ops.add(s.op);
   if(s.tried){
    // It was sent before and no answer is known (a timeout, a reload, a closed tab). The Magazine is asked first: if it has
    // the operation, that is the answer; if it may still be running it, nothing is sent again.
    const p=await probe(s.op);
    if(p.state==='committed')return settle(e,s,p.result);
    const age=Date.now()-s.at;
    if((p.state==='busy'&&age<300000)||age<RESEND_GRACE_MS){st.problem='Waiting for the Magazine to answer. Your words are kept.';schedule(Math.max(2000,RESEND_GRACE_MS-age));return 'stop';}
   }
   s.at=Date.now();s.tried=true;e.lastSent=s.text;stash();
   try{
    const out=await v2.call('magazine.working-draft.edit',{...sel,block:s.block,seen:s.seen,text:s.text,operationId:s.op});
    return settle(e,s,out);
   }catch(error){
    if(error.kind==='stale'){
     // A 409 means nothing was written. Whatever its words, the paragraph is looked for again by its hash: it may only have
     // moved (paragraphs above were removed), in which case it is sent again from where it is now.
     e.sending=null;
     let fresh=null;try{fresh=await readStory();}catch{/* the words stay on this device */}
     if(!fresh){st.problem='Could not save. Your words are kept on this device.';schedule(5000);return 'stop';}
     const before=e.block;adopt(fresh);
     if(e.gone)return 'skip';
     if(e.block!==before&&++e.tries<4){e.lastSent='';return 'again';}
     e.refused=storyWords(error)||'The Magazine did not take these words.';e.kind='server';return 'skip';
    }
    if(error.kind==='owner-only'){e.sending=null;st.problem=error.message;st.stopped=true;say(error.message,'bad');return 'stop';}
    if(error.kind==='held'||error.kind==='consent'){s.tried=false;st.problem=error.message+' Your words are kept and save when it is free.';schedule(5000);return 'stop';}
    if(error.kind==='refused'){e.sending=null;e.refused=storyWords(error)||error.message;e.kind='server';return 'skip';}
    st.problem='Could not save. Your words are kept on this device.';schedule(Math.max(5000,RESEND_GRACE_MS));return 'stop';
   }
  }
  function schedule(ms=AUTOSAVE_MS){clearTimeout(timer);if(gone||st.stopped||!canWrite())return;timer=setTimeout(()=>{void save();},ms);}

  // ---------- typing ----------
  function onInput(t){
   if(!canWrite())return;
   const row=st.rows.find(r=>r.id===t.dataset.ed);if(!row||!row.edit)return;
   // His line breaks are his: nothing is joined or changed in what he typed.
   const value=t.value.replace(/\r/g,'');
   fit(t);
   let e=editFor(row);
   if(!e){e={k:uuid(),seen:row.edit.seen,block:row.edit.block,orig:row.words,text:value,sending:null,refused:'',kind:'',gone:false,tries:0,lastSent:'',...around(row)};st.edits.set(e.k,e);}
   else{e.text=value;}
   e.refused='';e.kind='';
   const mark=markupIn(value,e.orig);
   if(mark){e.refused=`The mark ${mark} has a meaning in the Magazine, so it is not saved from here. Take it out, or type this mark in the Magazine. Your words are kept here and on this device.`;e.kind='markup';}
   else if(value.length>MAX_PARAGRAPH){e.refused=`A paragraph can hold at most ${MAX_PARAGRAPH.toLocaleString('en-GB')} characters, and this one has ${value.length.toLocaleString('en-GB')}. It is not saved. Your words are kept here and on this device.`;e.kind='limit';}
   if(value===e.orig&&!e.sending)st.edits.delete(e.k);
   st.problem='';st.stopped=false;paintSaved();paintConflict();stash();presence();schedule();
  }
  /** Leaving a paragraph saves it. One he emptied goes back to its saved words: removing a paragraph is not done here. */
  function onFocusOut(ev){
   const t=ev.target;if(!t.matches?.('textarea[data-ed]')||!canWrite())return;
   const row=st.rows.find(r=>r.id===t.dataset.ed),e=row&&editFor(row);
   if(e&&!e.text.trim()&&!e.sending){st.edits.delete(e.k);paintText();stash();paintSaved();presence();return;}
   if(dirty()){clearTimeout(timer);void save();}
  }

  // ---------- keeping up with other hands ----------
  async function refresh(){
   if(gone)return;
   if(st.saving){st.refreshWanted=true;return;}
   const seq=st.saveSeq;let fresh;try{fresh=await readStory();}catch{return;}
   if(ctx.signal.aborted||gone)return;
   // A save began or ended while this was being read: the answer may be older than what he has saved. Read again after it.
   if(st.saving){st.refreshWanted=true;return;}
   if(st.saveSeq!==seq){void refresh();return;}
   if(fresh.document?.hash!==st.read?.document?.hash||fresh.editable!==st.read?.editable)adopt(fresh);
   await loadProps();
  }
  function onChange(e){
   if(e?.reset){clearTimeout(propTimer);propTimer=setTimeout(refresh,250);return;}
   if(e?.operationId&&st.ops.has(e.operationId))return;
   clearTimeout(propTimer);propTimer=setTimeout(refresh,250);
  }

  // ---------- events ----------
  function onClick(e){
   const b=e.target.closest('[data-wr],[data-act]');if(!b||!page.contains(b))return;
   const wr=b.dataset.wr,act=b.dataset.act;
   if(wr==='focus'||wr==='unfocus'){setFocus(wr==='focus');return;}
   if(wr==='ask'){v2.ui.sheet({title:'Ask',body:v2.ui.notBuilt('Asking about this piece from here.',{advanced:{subject:id,piece:story.pieceId,section:'write'}})});return;}
   if(act==='accept'||act==='reject')return void decide(act,b.dataset.id);
   const edit=b.dataset.k?st.edits.get(b.dataset.k):null;
   if(act==='copy'&&edit){
    const done=()=>say('Copied. Your words are still kept here.','good'),fail=()=>say('Select the words in the box and copy them. They are still kept here.','warn');
    try{const p=root.navigator?.clipboard?.writeText(edit.text);if(p&&p.then)p.then(done,fail);else fail();}catch{fail();}
    return;
   }
   if(act==='mine'&&edit){
    // His words go on top of the saved paragraph standing in the same place with the same neighbours. Nothing is mixed.
    const c=counterpartOf(edit,st.rows);if(!c)return;
    edit.seen=c.edit.seen;edit.block=c.edit.block;edit.orig=c.words;Object.assign(edit,around(c));edit.gone=false;edit.refused='';edit.sending=null;edit.lastSent='';
    if(edit.text===c.words)st.edits.delete(edit.k);
    paintText();paintConflict();paintSaved();stash();schedule(300);return;
   }
   if(act==='theirs'&&edit){st.edits.delete(edit.k);paintText();paintConflict();paintSaved();stash();presence();return;}
  }
  function setFocus(on){
   st.focus=on;page.classList.toggle('wr-focus',on);
   const fb=$('.wr-focusbar');if(fb)fb.hidden=!on;
   if(on)(page.querySelector('[data-wr="unfocus"]')||page).focus?.({preventScroll:true});else page.querySelector('[data-wr="focus"]')?.focus({preventScroll:true});
  }
  function onKey(e){
   if(e.key==='Escape'&&st.focus){e.preventDefault();setFocus(false);return;}
   // There is no command to add a paragraph here, so Enter does not start one.
   if(e.key==='Enter'&&e.target.matches?.('textarea[data-ed]')&&!e.isComposing)e.preventDefault();
  }
  const onHide=()=>{if(doc.visibilityState==='hidden'&&dirty()){clearTimeout(timer);void save();}};
  const onUnload=()=>{if(presenceOk&&presenceSent==='true')v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:story.storyId},dirty:false,sequence:++presenceSeq,session,leaving:true}).catch(()=>{});};
  const onResize=()=>page.querySelectorAll('textarea.wr-ed').forEach(fit);
  page.addEventListener('click',onClick);page.addEventListener('keydown',onKey);page.addEventListener('focusout',onFocusOut);
  page.addEventListener('input',e=>{if(e.target.matches?.('textarea[data-ed]'))onInput(e.target);});
  doc.addEventListener('visibilitychange',onHide);root.addEventListener('pagehide',onUnload);root.addEventListener('resize',onResize);
  ctx.on({kinds:['magazine*']},onChange);
  ctx.on({},e=>{if(e.reset)onChange(e);});
  presenceTimer=setInterval(()=>presence(true),60000);

  // ---------- opening ----------
  function plainText(text,withLink=true){
   page.innerHTML=`<div class="wr-none"><p role="status">${esc(text)}</p><p><a class="wr-btn" href="${esc(v2.href('subject/:id',{id}))}">${icon('back')}Back to the subject</a>${withLink?` <a class="wr-btn" href="${esc(adv('write'))}">Open in Advanced${icon('out')}</a>`:''}</p></div>`;
  }
  async function ready(){
   try{
    ctx.setTitle(st.standing.title||'Write');if(st.standing.look)v2.brand(st.standing.look);
    ctx.setAdvanced({subject:id,piece:story.pieceId,section:'write'});
    if(ctx.query.piece&&!st.form){plainText('This piece is not one of this subject’s Articles, or it does not exist. Go back to the subject to choose one.',false);return;}
    let read;
    const none=async()=>{st.none=true;shell();$('[data-wr-text]').innerHTML=`<p class="wr-dim" role="status">${esc('This story has no draft yet, so there are no words to write on here. A draft is started in the Magazine; it is not started from here.')}</p>`;$('.wr-todo')?.remove();};
    if(await storyHasNoDraft(story)){if(!ctx.signal.aborted)await none();return;}
    try{read=await readStory();}
    catch(error){
     if(ctx.signal.aborted)return;
     if(await storyHasNoDraft(story)){await none();return;}
     plainText(storyWords(error)||'This story’s words could not be opened.');return;
    }
    if(ctx.signal.aborted)return;
    st.read=read;st.rows=storyRows(read);
    const h=(read.history||[]).filter(x=>x.state==='committed'&&x.modifiedAt).slice(-1)[0];if(h)st.savedAt=h.modifiedAt;
    const kept=unstash();
    for(const e of kept){if(e.sending)st.ops.add(e.sending.op);st.edits.set(e.k,e);}
    if(kept.length)adopt(read);
    shell();stash();
    if(kept.length&&dirty()){say('Your unsaved words from earlier are back.','info');schedule(300);}
    presence(true);loadProps();
   }catch(error){if(ctx.signal.aborted)return;plainText(error.message||'This story’s words could not be opened.');}
  }
  function leave(){
   gone=true;clearTimeout(timer);clearTimeout(propTimer);clearInterval(presenceTimer);
   doc.removeEventListener('visibilitychange',onHide);root.removeEventListener('pagehide',onUnload);root.removeEventListener('resize',onResize);
   if(canWrite()&&dirty()&&!st.stopped){try{void save();}catch{/* kept on this device */}}
   if(presenceOk&&presenceSent==='true'){presenceSent='';v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:story.storyId},dirty:false,sequence:++presenceSeq,session,leaving:true}).catch(()=>{});}
  }
  return {ready:ready(),leave,state:st};
 }
})(window.v2);
