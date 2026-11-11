/* Version two: Read. The saved words of one piece of one subject, set on the same page as Write and with nothing to edit:
   no margin, no suggestions, no Undo. Address: #/read/<subject>?piece=<output id>. It reads the draft with study-draft.read
   and never changes it. The sub bar and the finding of the piece's words are Write's (v2.shared.write.bar and .locate).
   If he has unsaved words in Write on this device, it says so rather than silently showing older words. When the saved
   draft changes while it is open (the change stream), the new words are shown. "Earlier original draft" is left out: the
   existing workspace's Read does not show it for a piece written here, and no command reads it. Every rule starts with .rd. */
(function(v2){
 'use strict';
 const {esc,icon}=v2.ui,root=window,doc=document;

 // ---------- pure helpers (pinned by tests/v2-read.test.mjs) ----------
 /** How many words the rows hold. */
 const wordCount=rows=>(rows||[]).reduce((n,r)=>n+(String(r.words||'').trim().match(/\S+/g)||[]).length,0);
 const countLabel=n=>n===1?'1 word':n.toLocaleString('en-GB')+' words';
 /** Whether the words Write keeps on this device (its stored text) differ from the saved ones in `rows`: an edit that is not
     what is saved, or a new paragraph with words in it. */
 function unsavedIn(raw,rows){
  let s=null;try{s=JSON.parse(raw||'null');}catch{return false;}
  if(!s||(s.v!==1&&s.v!==2)||!Array.isArray(s.edits)||!Array.isArray(s.added))return false;
  const saved=new Map((rows||[]).map(r=>[r.id,r]));
  if(s.added.some(a=>a&&typeof a.text==='string'&&a.text.trim()))return true;
  return s.edits.some(([rid,text])=>{const r=saved.get(rid);return r&&r.safe&&String(text)!==r.words;});
 }
 function rowHTML(r){
  if(r.kind==='heading')return `<h2 class="rd-h" data-row="${esc(r.id)}">${esc(r.words)}</h2>`;
  if(r.kind==='blockquote')return `<blockquote class="rd-q" data-row="${esc(r.id)}">${esc(r.words)}</blockquote>`;
  return `<p class="rd-p" data-row="${esc(r.id)}">${esc(r.words)}</p>`;
 }
 /** Whether a change of this kind alters the saved words (a save, undo, restore, recover); a check, inspect or read does not. */
 const changesWords=kind=>/^study-draft[.-]/.test(String(kind||''))&&!/^study-draft[.-](check|inspect|read|catalog|history-preview|root-recovery\.get)/.test(String(kind));
 v2.shared.read=Object.freeze({wordCount,countLabel,unsavedIn,rowHTML,changesWords});

 v2.screen({id:'read',route:'read/:id',title:'Read',
  render:()=>'<div class="v2-page wr rd" data-rd><p class="wr-wait" role="status">Opening the reading.</p></div>',
  mount(el,ctx){live=open(el.querySelector('[data-rd]'),ctx);return live.ready;},
  unmount(){live?.leave();live=null;}});
 let live=null;

 function open(page,ctx){
  const id=ctx.params.id;
  const st={standing:null,forms:[],form:null,piece:null,bindingId:null,base:null,rows:[],unsaved:false};
  let timer=null,gone=false,newerKnown=false;
  const $=sel=>page.querySelector(sel);
  const write=()=>v2.shared.write;
  const scope=()=>({bindingId:st.bindingId,parentStudyId:id});
  const adv=section=>v2.advanced({subject:id,piece:st.piece||undefined,section});
  const to=mode=>v2.href(mode+'/:id',{id},{piece:st.piece||undefined});
  const readDraft=()=>v2.call('study-draft.read',scope());
  const sameRevision=(a,b)=>JSON.stringify(a?.expected)===JSON.stringify(b?.expected);
  const KEY=()=>'ar-v2-write:'+st.bindingId;
  const stored=()=>{if(!v2.isHuman())return '';try{return root.localStorage.getItem(KEY())||'';}catch{return '';}};

  function plain(text,{advanced=true}={}){
   page.innerHTML=`<div class="wr-none"><p role="status">${esc(text)}</p><p><a class="wr-btn" href="${esc(v2.href('subject/:id',{id}))}">${icon('back')}Back to the subject</a>${advanced?` <a class="wr-btn" href="${esc(adv('read'))}">Open in Advanced${icon('out')}</a>`:''}</p></div>`;
  }
  /** The bar and the page, before any words are on it (so a message can stand in the page's place). */
  function frame(){
   const right=`<span class="wr-saved rd-count" data-rd-count></span><a class="wr-btn rd-edit" href="${esc(to('write'))}">Edit words</a>`;
   page.innerHTML=write().bar({id,forms:st.forms,form:st.form,piece:st.piece,mode:'read',right})+`
    <div class="wr-work" data-src="closed"><article class="wr-paper"><div class="wr-sheet">
     <p class="wr-saved wr-saved-m rd-count" data-rd-count role="status"></p>
     <h1 class="wr-title">${esc(st.form?.title||st.standing?.title||'')}</h1>
     <p class="rd-unsaved" data-rd-unsaved role="status" hidden></p>
     <p class="rd-stale" data-rd-stale role="status" hidden></p>
     <div class="rd-text" data-rd-text></div>
     <div class="rd-foot" data-rd-foot></div>
    </div></article></div>`;
  }
  function paint(){
   const text=$('[data-rd-text]');if(!text)return;
   const words=wordCount(st.rows);
   page.querySelectorAll('[data-rd-count]').forEach(n=>{n.textContent=st.rows.length?countLabel(words):'';});
   st.unsaved=!!st.bindingId&&unsavedIn(stored(),st.rows);
   const un=$('[data-rd-unsaved]');
   if(un){un.hidden=!st.unsaved;un.innerHTML=st.unsaved?`You have unsaved words in Write on this device, so what you see here is older than what you typed. <a href="${esc(to('write'))}">Open Write</a> to carry on, and they save by themselves.`:'';}
   if(!st.rows.length){
    text.innerHTML=`<p class="rd-empty" role="status">This piece has no saved words yet.</p>`;
    $('[data-rd-foot]').innerHTML=`<a class="wr-btn rd-edit-foot" href="${esc(to('write'))}">Write the first words</a>`;
   }else{
    text.innerHTML=st.rows.map(rowHTML).join('');
    $('[data-rd-foot]').innerHTML=`<a class="wr-btn rd-edit-foot" href="${esc(to('write'))}">Edit words</a><a class="wr-btn" href="${esc(to('check'))}">Check this piece</a>`;
   }
  }

  // ---------- keeping up with the saved words ----------
  async function refresh(){
   if(gone||!st.bindingId||!$('[data-rd-text]'))return;
   let fresh;
   try{fresh=await readDraft();}
   catch{
    if(gone||ctx.signal.aborted)return;
    const n=$('[data-rd-stale]');
    if(n){n.hidden=false;n.innerHTML=(newerKnown?'Newer words exist, but they could not be read just now, so what you see here may be out of date.':'The saved words could not be read again just now, so what you see here may be out of date.')+' <button type="button" data-rd-retry>Try again</button>';}
    return;
   }
   if(gone||ctx.signal.aborted)return;
   const stale=$('[data-rd-stale]');if(stale){stale.hidden=true;stale.textContent='';}
   newerKnown=false;
   if(!sameRevision(fresh,st.base)){st.base=fresh;st.rows=write().rowsOf(fresh);}
   paint();
  }
  /** Only a change to this piece's words (a draft change carries the draft's id as its scope) is worth reading again; a change
      to another piece's draft is not. A change that names no draft is read again to be safe. */
  const onChange=e=>{
   if(e&&!e.reset&&e.scope&&e.scope.id&&e.scope.id!==st.bindingId)return;
   if(e&&e.scope&&e.scope.id===st.bindingId&&changesWords(e.kind))newerKnown=true;
   clearTimeout(timer);timer=setTimeout(refresh,250);};
  const onRetry=e=>{if(e.target.closest?.('[data-rd-retry]')){clearTimeout(timer);void refresh();}};
  page.addEventListener('click',onRetry);
  const onStorage=e=>{if(!e||!e.key||e.key===KEY())paint();};

  ctx.on({kinds:['study-draft*']},onChange);
  ctx.on({},e=>{if(e.reset)onChange();});
  root.addEventListener('storage',onStorage);
  async function ready(){
   try{
    if(!write()?.locate||!write()?.bar||!write()?.rowsOf){plain('Read needs the writing screen, which did not load. Open this piece in Advanced.');return;}
    const found=await write().locate(id,ctx.query.piece);if(ctx.signal.aborted)return;
    Object.assign(st,{standing:found.standing,forms:found.forms,form:found.form,piece:found.piece,bindingId:found.bindingId});
    ctx.setTitle(found.standing.title||'Read');if(found.standing.look)v2.brand(found.standing.look);
    ctx.setAdvanced({subject:id,piece:st.piece||undefined,section:'read'});
    if(ctx.query.piece&&!found.form){plain('This piece is not one of this subject’s Articles, or it does not exist. Go back to the subject to choose one.',{advanced:false});return;}
    if(!found.form){frame();$('[data-rd-text]').innerHTML='<p class="rd-empty" role="status">This subject has no Article yet, so there is nothing to read here.</p>';return;}
    if(!found.native||!st.bindingId){frame();$('[data-rd-text]').innerHTML=`<p class="rd-empty" role="status">The words of this piece are not kept where Read can open them. They open in Advanced.</p>`;$('[data-rd-foot]').innerHTML=`<a class="wr-btn" href="${esc(adv('read'))}">Open in Advanced${icon('out')}</a>`;return;}
    const read=await readDraft();if(ctx.signal.aborted)return;
    st.base=read;st.rows=write().rowsOf(read);
    frame();paint();
   }catch(error){if(ctx.signal.aborted)return;plain(error.message||'This piece could not be opened.');}
  }
  function leave(){gone=true;clearTimeout(timer);root.removeEventListener('storage',onStorage);}
  return {ready:ready(),leave,state:st};
 }
})(window.v2);
