/* Version three: Write. The words of one piece of one subject, on the approved page, with an assistant's suggestions beside
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
 const OWN={side:'M4 5h16v14H4zM9 5v14',focus:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',note:'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',link:'M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1',
  undo:'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',history:'M3 12a9 9 0 1 0 3-6.700L3 8M3 3v5h5M12 8v4l3 2',book:'M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z',
  check:'M5 12l5 5 9-10',cloud:'M7 18h10a4 4 0 0 0 .500-8 6 6 0 0 0-11.500 2A3 3 0 0 0 7 18z',warn:'M12 4l9 16H3zM12 10v4M12 17v.500',copy:'M8 8h12v12H8zM16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'};
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
 /** Read and Check, version two's files borrowed unchanged, call bar() without the subject's name. The frame already holds
     it (they set it as the page's title before they draw), so the bar takes it from there and the way back names the subject
     on all three tabs. A title that is only a screen's own name means the subject's name is not known: "The subject". */
 const frameTitle=()=>{const t=String(doc.title||'').replace(/\s*·\s*AR Create$/,'').trim();return t===''||t==='AR Create'||['Write','Read','Check'].includes(t)?'':t;};
 /** The sub bar the three screens share: the way back, the piece tabs (which keep him in the same mode), the
     Write | Read | Check segment, then `right` (markup for the bar's right side). */
 function bar({id,forms=[],form=null,piece=null,mode='write',right='',title=''}){
  const names=tabNames(forms),at=MODES.some(m=>m[0]===mode)?mode:'write',name=String(title||'').trim()||frameTitle();
  const formTab=f=>{
   const here=form&&f.key===form.key;
   const href=f.kind==='article'?v2.href(at+'/:id',{id},{piece:/^out:/.test(f.key)?f.id:undefined}):v2.href('subject/:id',{id},{form:f.key});
   return `<a href="${esc(href)}"${here?' aria-current="page"':''} title="${esc(names.get(f.key))}">${esc(names.get(f.key))}</a>`;
  };
  const seg=MODES.map(([m,label])=>m===at?`<span aria-current="true">${label}</span>`:`<a href="${esc(v2.href(m+'/:id',{id},{piece:piece||undefined}))}">${label}</a>`).join('');
  // One line on a computer and two fixed lines on a phone, in every state: the way back (named after the subject), the
  // piece tabs, the Write | Read | Check segment, then `right` (the status place and the tools), which never wraps.
  return `<div class="wr-bar" data-wr-bar>
    <a class="wr-back" href="${esc(v2.href('subject/:id',{id}))}" aria-label="Back to the subject" title="${esc(name?'Back to '+name:'Back to the subject')}">${icon('back')}<span>${esc(name?'Back to '+name:'Back to the subject')}</span></a>
    <nav class="wr-tabs" aria-label="Pieces of this subject">${forms.map(formTab).join('')}<a href="${esc(v2.href('subject/:id',{id}))}" aria-label="Add a piece on the subject page" title="Add a form on the subject page">${icon('plus')}</a></nav>
    <span class="wr-sep" aria-hidden="true"></span>
    <div class="wr-seg" role="group" aria-label="Write, Read or Check">${seg}</div>
    <span class="wr-sp"></span>
    <span class="wr-right">${right}</span>
   </div>`;
 }
 v2.shared.write=Object.freeze({rowsOf,minimalDiff,buildOps,flat,proposalView,savedLabel,locate,bar,storyOf,storyRows});


 let live=null;// the open screen, so leaving it can save and clean up
 /** Whether this browser edits an element as plain text. Where it does not, setting the value throws, and the paragraphs
     stay plain boxes (a textarea each), which every browser edits. */
 const PLAINTEXT_ONLY=()=>{try{const d=doc.createElement('div');d.contentEditable='plaintext-only';return true;}catch{return false;}};

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
   starting:false,creating:false,making:false,startSaid:false,saving:false,again:false,running:null,refreshWanted:false,saveSeq:0,sent:[],retryMs:8000,baseWords:new Map(),reading:new Map(),savedAt:null,problem:'',stopped:false,conflict:null,props:[],dropped:0,sources:null,
   src:root.matchMedia&&root.matchMedia('(min-width:1101px)').matches,focus:false,ops:new Set(),human,
   plain:false,fail:null,trying:false,back:null,ask:null,saves:new Map(),composing:false,paintWanted:false,kept:[]};
  const clk={timer:null,startTimer:null,propTimer:null,presenceTimer:null,presenceSeq:0,presenceOk:true,presenceSent:'',gone:false};
  const session=uuid().slice(0,8);
  const $=sel=>page.querySelector(sel);
  const scope=()=>({bindingId:st.bindingId,parentStudyId:id});
  const dirty=()=>[...st.edits.keys()].length>0||st.added.some(a=>String(a.text).trim());
  const say=(text,tone='info')=>v2.ui.say(text,{tone});
  const mine=operationId=>{st.ops.add(operationId);return operationId;};

  // ---------- the other files: the paragraphs and saving, the suggestions and notes ----------
  const W={st,clk,page,ctx,id,human,session,$,scope,dirty,say,mine,lib:{esc,icon,own,uuid,clock,savedLabel,AUTOSAVE_MS,rowsOf,minimalDiff,buildOps,flat,proposalView,bar,tabNames}};
  Object.assign(W,v2.shared['write-page'](W),v2.shared['write-margin'](W),v2.shared['write-versions'](W));
  const decide=(...a)=>W.decide(...a);
  const enter=(...a)=>W.enter(...a);
  const fit=(...a)=>W.fit(...a);
  const foldAdded=(...a)=>W.foldAdded(...a);
  const join=(...a)=>W.join(...a);
  const keepMine=(...a)=>W.keepMine(...a);
  const keepReading=(...a)=>W.keepReading(...a);
  const loadProps=(...a)=>W.loadProps(...a);
  const noticeNewer=(...a)=>W.noticeNewer(...a);
  const onChange=(...a)=>W.onChange(...a);
  const onInput=(...a)=>W.onInput(...a);
  const paintNotes=(...a)=>W.paintNotes(...a);
  const paintSaved=(...a)=>W.paintSaved(...a);
  const paintText=(...a)=>W.paintText(...a);
  const reading=(...a)=>W.reading(...a);
  const save=(...a)=>W.save(...a);
  const schedule=(...a)=>W.schedule(...a);
  const settleSent=(...a)=>W.settleSent(...a);
  const startArticle=(...a)=>W.startArticle(...a);
  const stash=(...a)=>W.stash(...a);
  const unstash=(...a)=>W.unstash(...a);
  const useSaved=(...a)=>W.useSaved(...a);
  const wordsMap=(...a)=>W.wordsMap(...a);

  // ---------- reading ----------
  async function locate(){
   const found=pre||await v2.shared.write.locate(id,ctx.query.piece);pre=null;if(ctx.signal.aborted)return false;
   const s=found.standing;st.standing=s;st.forms=found.forms;st.form=found.form;
   st.missing=!!ctx.query.piece&&!found.form;
   st.bindingId=found.bindingId;st.piece=found.piece;
   // A subject with no Article yet: the page is empty and his first saved words start the Article (see startArticle).
   // A subject that has other forms (a Carousel) gets an Article only when he came by Add a form, Article (start=article).
   st.starting=!found.form&&!ctx.query.piece&&!!found.bindingId&&!found.story&&(!found.forms.length||ctx.query.start==='article');
   // A page opened with no Article yet keeps plain boxes for its life (the Article is made under his cursor and the page is
   // never rebuilt); the next time it opens, the paragraphs are the page's own editable lines.
   // A browser that cannot edit an element as plain text (Firefox before 136 refuses the value) keeps plain boxes too.
   st.plain=st.starting||!PLAINTEXT_ONLY();
   ctx.setTitle(s.title||'Write');if(s.look)v2.brand(s.look);
   ctx.setAdvanced({subject:id,piece:st.piece||undefined,section:'write'});
   return true;
  }
  const adv=section=>v2.advanced({subject:id,piece:st.piece||undefined,section});
  const readDraft=()=>v2.call('study-draft.read',scope());
  const sameRevision=(a,b)=>JSON.stringify(a?.expected)===JSON.stringify(b?.expected);

  // ---------- who is where: tells an assistant he has unsaved words open ----------
  function presence(force=false){
   if(!clk.presenceOk||clk.gone||!st.bindingId||!st.human)return;
   const d=dirty(),sig=String(d);if(!d&&!clk.presenceSent)return;/* nothing to tell until he has unsaved words */if(!force&&sig===clk.presenceSent)return;clk.presenceSent=sig;
   v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:d,sequence:++clk.presenceSeq,session}).catch(()=>{clk.presenceOk=false;});
  }

  // ---------- drawing ----------
  /** The bar's tools, and the same three on a phone's bottom bar. Each keeps its size in every state. */
  const tool=(wr,ic,label,extra='')=>`<button type="button" class="v2-ghost wr-tool" data-wr="${wr}" aria-label="${label}" title="${label}"${extra}>${own(ic)}<span>${label}</span></button>`;
  function shell(){
   const right=`<span class="wr-status" data-wr-status><span class="wr-st-ic" data-wr-st-ic aria-hidden="true"></span><span class="wr-saved" data-wr-saved role="status"></span><span class="wr-saved-s" data-wr-saved-s aria-hidden="true"></span><button type="button" class="v2-ghost wr-retry" data-wr="retry" hidden>Try again</button><button type="button" class="v2-ghost wr-retry" data-wr="putback" hidden aria-label="Put back the words Undo took back" title="Put back the words Undo took back">Put back</button></span>
    <span class="wr-tools">${tool('undo','undo','Undo')}${tool('versions','history','Versions',' aria-pressed="false"')}${tool('src','book','Sources',` aria-pressed="${st.src}"`)}${tool('focus','focus','Focus')}</span>`;
   page.classList.add('wr-w');
   page.innerHTML=bar({id,forms:st.forms,form:st.form,piece:st.piece,mode:'write',right,title:st.standing?.title||''})+`
   <div class="wr-work" data-src="${st.src?'open':'closed'}">
    <aside class="wr-src" data-wr-src aria-label="Sources"></aside>
    <article class="wr-paper"><div class="wr-sheet">
     <div class="wr-fail" data-wr-fail hidden></div>
     <div class="wr-fail" data-wr-undo hidden role="status"></div>
     <div class="wr-conflict" data-wr-conflict hidden></div>
     <h1 class="wr-title">${esc(st.form?.title||st.standing?.title||'')}</h1>
     ${st.human?'':`<p class="wr-ro" role="status">${esc('Opened as '+v2.actorName(v2.actor())+'. Only Adrian writes here. '+v2.actorName(v2.actor())+' can propose words, and Adrian decides.')}</p>`}
     ${st.starting&&!st.human?'<p class="wr-dim" role="status">No Article has been started for this subject. Adrian starts it by writing the first words.</p>':''}
     <div class="wr-text" data-wr-text></div>
     <div class="wr-loose" data-wr-loose></div>
     <section class="wr-todo" aria-label="Still to write"><p class="wr-label">Still to write</p>${v2.ui.notBuilt('The list of parts still to write.',{advanced:{subject:id,piece:st.piece||undefined,section:'write'}})}</section>
    </div></article>
   </div>
   <nav class="wr-pphone" aria-label="Writing">${tool('undo','undo','Undo')}${tool('versions','history','Versions',' aria-pressed="false"')}${tool('src','book','Sources',` aria-pressed="${st.src}"`)}</nav>`;
   // Focus keeps the bar with only the way out, the status and nothing else.
   $('.wr-bar')?.insertAdjacentHTML('afterbegin',`<button type="button" class="v2-ghost wr-leave" data-wr="unfocus">${icon('back')}<span>Leave focus</span></button>`);
   const out=$('.wr-todo .v2-out');if(out)out.setAttribute('data-wr-advanced','');
   paintSources();paintText();paintSaved();
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

  // ---------- events ----------
  function onClick(e){
   const b=e.target.closest('[data-wr],[data-act]');if(!b||!page.contains(b))return;
   const wr=b.dataset.wr,act=b.dataset.act;
   if(wr==='src'){st.src=!st.src;const w=$('.wr-work');w.dataset.src=st.src?'open':'closed';page.querySelectorAll('[data-wr="src"]').forEach(x=>x.setAttribute('aria-pressed',String(st.src)));if(st.src&&st.sources===null)loadSources();return;}
   if(wr==='focus'||wr==='unfocus'){setFocus(wr==='focus');return;}
   if(wr==='versions'){void versionsSheet();return;}
   if(wr==='undo')return void W.undoLast();
   if(wr==='undo-yes')return void W.yesAsk();
   if(wr==='undo-no')return void W.noAsk();
   if(wr==='putback')return void W.putBack();
   if(wr==='retry')return void W.tryAgain();
   if(wr==='copy')return void W.copyAll();
   if(act==='accept'||act==='reject'||act==='finish'||act==='leave')return void decide(act,b.dataset.id);
   if(act==='mark'){const p=st.props.find(x=>x.id===b.dataset.id);if(!p)return;const rd=reading(p);rd.marks[b.dataset.rid]=!rd.marks[b.dataset.rid];keepReading(p);paintNotes();page.querySelector(`[data-act="mark"][data-rid="${CSS.escape(b.dataset.rid)}"]`)?.focus({preventScroll:true});return;}
   if(act==='mine')return void keepMine();
   if(act==='theirs')return void useSaved();
   if(['keep','rec','earlier','merged-see','side-done'].includes(act))return void W.sideAct(act,b.dataset.v,b.dataset.k);
  }
  /** Earlier versions: not built yet, except the words of his set aside here or on the app, which are listed in full. */
  async function versionsSheet(){
   if(st.human)await W.loadAsides();
   const list=st.human?[...(st.asides||[]).map(e=>({...e,here:false})),...W.deviceAsides().map(e=>({...e,at:new Date(e.at).toISOString(),here:true}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))):[];
   const why={conflict:'Not kept when two versions met',recovery:'Left out after the app closed',['failed-save']:'Not saved when the app did not answer'};
   const items=list.map(e=>`<li class="wr-item"><div class="wr-hd"><h2>${esc(why[e.reason]||'Set aside')}</h2><p class="wr-by">${esc((e.here?'Kept on this device, ':'Kept on the app, ')+savedLabel(e.at).replace(/^Saved /,''))}</p></div>${e.paragraphs.map(p=>`<p class="wr-pr">${esc(p.words)}</p>`).join('')}</li>`).join('');
   v2.ui.sheet({title:'Earlier versions',body:(items?`<p class="wr-label">Your words set aside</p><ul class="wr-asides">${items}</ul>`:'')+v2.ui.notBuilt('Earlier versions of this piece, with what changed in each and who made it.',{advanced:{subject:id,piece:st.piece||undefined,section:'write'}})});
  }
  function setFocus(on){
   st.focus=on;page.classList.toggle('wr-focus',on);
   if(on)(page.querySelector('[data-wr="unfocus"]')||page).focus?.({preventScroll:true});else page.querySelector('.wr-tools [data-wr="focus"]')?.focus({preventScroll:true});
  }
  function onKey(e){
   const t=e.target;
   if(e.key==='Escape'&&st.focus){e.preventDefault();setFocus(false);return;}
   if(!t.matches?.('[data-ed]')||!st.human)return;
   if(e.key==='Enter'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey){e.preventDefault();void enter(t);}
   else if(e.key==='Backspace'&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&t.selectionStart===0&&t.selectionEnd===0){e.preventDefault();void join(t);}
  }
  /** A newline that comes without an Enter key (as Android keyboards send it, or Shift and Enter) is a new paragraph too,
      never a space: the same split as Enter. */
  function onBeforeInput(e){
   const t=e.target;if(!t.matches?.('[data-ed]')||!st.human)return;
   const newline=e.inputType==='insertParagraph'||e.inputType==='insertLineBreak'||(e.inputType==='insertText'&&/^\r?\n$/.test(e.data||''));
   if(newline&&!e.isComposing){e.preventDefault();void enter(t);}
  }
  const onFocusOut=e=>{if(e.target.matches?.('[data-ed]')&&dirty()&&!st.conflict){clearTimeout(clk.timer);void save({quiet:true,hold:null});}};
  const onHide=()=>{if(doc.visibilityState==='hidden'&&dirty()&&!st.conflict){clearTimeout(clk.timer);void save({quiet:true,hold:null});}};
  const onUnload=()=>{if(clk.presenceOk&&st.bindingId&&clk.presenceSent==='true')v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:false,sequence:++clk.presenceSeq,session,leaving:true}).catch(()=>{});};
  const onResize=()=>page.querySelectorAll('textarea.wr-ed,textarea.wr-dt').forEach(fit);

  page.addEventListener('click',onClick);page.addEventListener('keydown',onKey);page.addEventListener('focusout',onFocusOut);page.addEventListener('beforeinput',onBeforeInput);
  page.addEventListener('compositionstart',e=>{if(e.target.matches?.('[data-ed]'))st.composing=true;});
  page.addEventListener('compositionend',e=>{if(!e.target.matches?.('[data-ed]'))return;st.composing=false;onInput(e.target);if(st.paintWanted){st.paintWanted=false;W.paintText();}});
  page.addEventListener('input',e=>{
   if(e.target.matches?.('[data-ed]'))onInput(e.target);
   else if(e.target.matches?.('textarea[data-rt]')&&st.human){const p=st.props.find(x=>x.id===e.target.dataset.rt);if(p){reading(p).words[e.target.dataset.rid]=e.target.value;keepReading(p);fit(e.target);}}
  });
  doc.addEventListener('visibilitychange',onHide);root.addEventListener('pagehide',onUnload);root.addEventListener('resize',onResize);
  ctx.on({kinds:['study-draft*','study-ai*']},onChange);
  ctx.on({},e=>{if(e.reset)onChange(e);});
  clk.presenceTimer=setInterval(()=>{presence(true);void W.offerNext();},60000);// a tab that closed a moment ago may let go of its key late

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
    // This tab's own key first: its words come back as before. A closed tab's words are offered once, in place, after.
    await W.claim();if(ctx.signal.aborted||clk.gone){W.letAllGo();return;}
    const saved=unstash(),committed=(read.history||[]).filter(x=>x.state==='committed'),h=committed.filter(x=>x.modifiedAt).slice(-1)[0];
    if(h)st.savedAt=h.modifiedAt;
    let newer=false,restored=false;
    if(saved){
     const times=new Map(Array.isArray(saved.times)?saved.times:[]);
     for(const [rid,text,orig] of saved.edits)st.edits.set(rid,{text:String(text),orig:String(orig??''),...(times.get(rid)?{at:times.get(rid)}:{})});
     for(const a of saved.added){if(a&&typeof a.id==='string'&&typeof a.text==='string'&&a.text.trim())st.added.push({id:a.id,afterId:a.afterId??null,text:flat(a.text)});}
     for(const i of saved.sent)if(i&&typeof i.operationId==='string')st.ops.add(i.operationId);
     // A save that was on its way when the page closed. If the server holds it, it is his own save and not a newer version:
     // what it carried is settled, and what he typed after it was sent is carried on.
     const done=new Set(committed.map(x=>x.operationId)),ours=saved.sent.filter(i=>done.has(i.operationId)),last=committed.at(-1);
     if(ours.length){
      st.sent=saved.sent.filter(i=>!done.has(i.operationId));
      for(const info of ours){W.noteSave(info);settleSent(read,info);}
      if(last&&!st.ops.has(last.operationId))newer=true;// someone else saved after it
      restored=true;
     }else{
      st.sent=saved.sent;// a late commit of these is still his own
      // Words typed into a paragraph that is gone now (removed or joined elsewhere) or that now holds formatting this page
      // keeps as it is come back as a new paragraph where it stood, never dropped.
      const order=Array.isArray(saved.base)?saved.base.map(x=>x[0]):[],have=new Set(st.rows.map(x=>x.id));
      const after=rid=>{const i=order.indexOf(rid);for(let j=i-1;j>=0;j--)if(have.has(order[j]))return order[j];return null;};
      for(const rid of [...st.edits.keys()]){const r=st.rows.find(x=>x.id===rid),text=st.edits.get(rid).text;if(!r||!r.safe||text===r.words){st.edits.delete(rid);if((!r||!r.safe)&&String(text).trim()&&text!==r?.words)st.added.push({id:uuid(),afterId:r?r.id:after(rid),text:flat(text)});}}
      foldAdded();
      newer=!!saved.draft&&saved.draft!==read.expected?.workflow?.draft;
      if(newer&&Array.isArray(saved.base))st.baseWords=new Map(saved.base);
      // Two versions still waiting when the page closed: the words he started from are kept with his, so they wait again.
      else if(Array.isArray(saved.base)){const b=new Map(saved.base);for(const [rid] of st.edits)if(b.has(rid)&&b.get(rid)!==st.baseWords.get(rid)){st.baseWords.set(rid,b.get(rid));newer=true;}}
      restored=true;
     }
     for(const [rid,e] of st.edits){if(!e.orig)e.orig=st.rows.find(x=>x.id===rid)?.words??'';}
    }
    shell();stash();W.loadBack();paintSaved();
    void W.sendAsides();void W.loadAsides();
    if(restored&&dirty()&&newer)noticeNewer(read);
    else if(restored&&dirty()){say('Your unsaved words from earlier are back.','info');schedule(600);}
    presence(true);loadProps();W.loadKept();if(st.src)loadSources();
    // Words are saved but the Article was never made (a reload or a closed tab between the two): make it now.
    if(st.starting&&st.human&&!dirty()&&!st.conflict&&st.rows.some(r=>r.words.trim()))void startArticle();
    void W.offerNext();for(const ms of [3000,12000])clk['offer'+ms]=setTimeout(()=>void W.offerNext(),ms);
   }catch(error){if(ctx.signal.aborted)return;plain(error.message||'This piece could not be opened.');}
  }
  function shell0(text){shell();$('[data-wr-text]').innerHTML=`<p class="wr-dim" role="status">${esc(text)}</p>`;$('.wr-todo')?.remove();}
  function leave(){
   clk.gone=true;clearTimeout(clk.timer);clearTimeout(clk.startTimer);clearTimeout(clk.propTimer);clearInterval(clk.presenceTimer);clearTimeout(clk.offer3000);clearTimeout(clk.offer12000);
   doc.removeEventListener('visibilitychange',onHide);root.removeEventListener('pagehide',onUnload);root.removeEventListener('resize',onResize);
   if(st.human&&dirty()&&!st.conflict&&st.bindingId&&!st.stopped){try{void save({quiet:true,hold:null});}catch{/* kept on this device */}}
   void W.settled().then(()=>W.letAllGo());// his key stays his until the last save is answered
   if(clk.presenceOk&&clk.presenceSent==='true'){clk.presenceSent='';v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:st.bindingId},dirty:false,sequence:++clk.presenceSeq,session,leaving:true}).catch(()=>{});}
  }
  Object.assign(W,{locate,adv,readDraft,sameRevision,presence,shell,paintSources,kindOf,loadSources,onClick,setFocus,onKey,onFocusOut,onHide,onUnload,onResize,plain,ready,shell0,leave});// what the other files reach in this one
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
 const STORY_KEY=story=>'ar-v3-write-story:'+story.storyId+':'+story.pieceId+':';
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
   page.innerHTML=bar({id,forms:st.forms,form:st.form,piece:st.piece,mode:'write',right,title:st.standing?.title||''})+`
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
   if(on)(page.querySelector('[data-wr="unfocus"]')||page).focus?.({preventScroll:true});else page.querySelector('.wr-tools [data-wr="focus"]')?.focus({preventScroll:true});
  }
  function onKey(e){
   if(e.key==='Escape'&&st.focus){e.preventDefault();setFocus(false);return;}
   // There is no command to add a paragraph here, so Enter does not start one.
   if(e.key==='Enter'&&e.target.matches?.('textarea[data-ed]')&&!e.isComposing)e.preventDefault();
  }
  const onHide=()=>{if(doc.visibilityState==='hidden'&&dirty()){clearTimeout(timer);void save();}};
  const onUnload=()=>{if(presenceOk&&presenceSent==='true')v2.call('presence.post',{stage:'Write',scope:{kind:'draft',id:story.storyId},dirty:false,sequence:++presenceSeq,session,leaving:true}).catch(()=>{});};
  const onResize=()=>page.querySelectorAll('textarea.wr-ed,textarea.wr-dt').forEach(fit);
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
