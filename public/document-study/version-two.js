/* Version two, from the existing workspace. Two small things, nothing else on this page changes:
   1. One quiet link, "Version two", on the top line beside the theme switch (the place for app-wide links).
   2. The smallest reading of the address, so version two's "Advanced" lands on the matching place here:
      ?subject=<project id>&section=<rail name, or read>&piece=<output id>. It presses the workspace's own owners
      (the subject board, the rail, the output overview) exactly as a click would, then takes the three keys out of
      the address so a reload does not repeat it. Loaded last. */
(()=>{
 'use strict';
 if(window.arVersionTwo)return;
 const SECTIONS=['home','subjects','library','material','source','research','direction','write','read','check','media','arrange','audience','share','outputs'];

 // ---------- the link ----------
 // Version two names the address he left in ?v2from=<hash>. The workspace drops its query string once loaded, so it is
 // read now and kept for this tab. Only a plain version two path is accepted.
 const KEEP='ar-create-v2-from';
 const way=(()=>{
  let from=null;try{from=new URLSearchParams(location.search).get('v2from');}catch{}
  const ok=v=>typeof v==='string'&&/^\/[A-Za-z0-9._~%\-\/?=&:+,]*$/.test(v)&&!v.includes('//')&&v.length<400;
  if(ok(from)){try{sessionStorage.setItem(KEEP,from);}catch{}return from;}
  try{const kept=sessionStorage.getItem(KEEP);if(ok(kept))return kept;}catch{}
  return null;
 })();
 function href(){
  const who0=window.arCreateUiActor;
  if(way){const q0=who0?.explicit&&who0.actor?'?reviewActor='+encodeURIComponent(who0.actor):'';return '/v2/index.html'+q0+'#'+way;}
  let hash='';
  try{const home=document.getElementById('project-library')?.open,p=typeof current==='function'?current():null;if(!home&&p?.id)hash='#/subject/'+encodeURIComponent(p.id);}catch{}
  const who=window.arCreateUiActor;const q=who?.explicit&&who.actor?'?reviewActor='+encodeURIComponent(who.actor):'';
  return '/v2/index.html'+q+hash;
 }
 let watched=null;const watcher=typeof MutationObserver==='function'?new MutationObserver(()=>queueMicrotask(ensure)):null;
 function ensure(){
  const strip=document.getElementById('c3-tabstrip');if(!strip)return;
  if(watcher&&watched!==strip){watcher.disconnect();watcher.observe(strip,{childList:true});watched=strip;}
  let link=strip.querySelector(':scope>a.v2-front');
  if(!link){link=document.createElement('a');link.className='v2-front';link.textContent='Version two';link.title='Open version two';}
  const theme=strip.querySelector(':scope>.ht-theme');
  if(theme){if(link.nextElementSibling!==theme)theme.before(link);}else if(link.parentElement!==strip)strip.append(link);
  const next=href();if(link.getAttribute('href')!==next)link.setAttribute('href',next);
 }
 // Refresh the address just before it is followed, so it names the subject open at that moment.
 document.addEventListener('pointerdown',e=>{const a=e.target.closest?.('a.v2-front');if(a)a.setAttribute('href',href());},true);
 document.addEventListener('keydown',e=>{const a=e.target.closest?.('a.v2-front');if(a&&e.key==='Enter')a.setAttribute('href',href());},true);
 if(window.c3Shell?.register)window.c3Shell.register('Version two link',ensure,{order:200,ignore:'.v2-front'});else ensure();

 // ---------- the address ----------
 const params=new URLSearchParams(location.search),subject=params.get('subject'),section=params.get('section'),piece=params.get('piece');
 const wanted=(subject||section)&&params.getAll('subject').length<2&&params.getAll('section').length<2&&params.getAll('piece').length<2;
 // ---------- landing ----------
 // openPlace({subject, piece, view}) opens one exact subject, one exact piece (an output id) and one view (a section
 // name from SECTIONS, where read, write and check are the three views of a piece) in the existing workspace, and
 // resolves only when the workspace shows it. Every step waits on the workspace's own state or events (the rail's mark,
 // the selected output, the writer's view, the board closing), never on a fixed delay. It resolves to a plain result:
 //   {ok, reason, message, subject, piece, view, opened:{subject, piece, section, view}}
 // reason is null when ok, else 'subject-not-found', 'piece-not-found', 'piece-other-subject' (the subject's section
 // is still opened, with no piece, and nothing of another subject's is ever opened), 'not-shown' or 'not-ready'.
 const EVENTS=['study-output-selection','study-write-view','study-carousel-view','study-draft-change','c3-header-painted','combined-counts','toggle'];
 function until(test,timeout=8000){
  const ask=()=>{try{return !!test();}catch{return false;}};
  if(ask())return Promise.resolve(true);
  return new Promise(resolve=>{
   let done=false,watch=null,timer=null,tick=null;
   const finish=value=>{if(done)return;done=true;for(const e of EVENTS)window.removeEventListener(e,look,true);watch?.disconnect();clearTimeout(timer);clearInterval(tick);resolve(value);};
   const look=()=>{if(ask())finish(true);};
   for(const e of EVENTS)window.addEventListener(e,look,true);
   if(typeof MutationObserver==='function'){watch=new MutationObserver(look);watch.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-current','data-writing-view','data-tool','open','disabled','hidden']});}
   tick=setInterval(look,500);timer=setTimeout(()=>finish(ask()),timeout);
  });
 }
 const projectList=()=>{try{return typeof state!=='undefined'&&Array.isArray(state.projects)?state.projects:[];}catch{return [];}};
 const nowId=()=>{try{return typeof current==='function'?current()?.id||null:null;}catch{return null;}};
 const railNow=()=>document.querySelector('.combined-rail [data-combined-nav][aria-current]')?.dataset.combinedNav;
 const railBusy=()=>!!document.querySelector('.combined-rail [data-combined-nav]:disabled');
 const boardOpen=()=>!!window.combinedSubjects?.isOpen?.();
 const picked=()=>{try{return window.studyOutputConnection?.selection?.()?.output||null;}catch{return null;}};
 const carouselPage=()=>document.querySelector('#study-output-canvas .car-writing-page');
 // The writer's own sign that its draft has loaded: until then it can still reset its view to Write.
 const writerSettled=()=>{try{const d=window.studyDraft,s=d?.recoveryOwnership?.()?.state;if(!d?.currentBinding)return !s||s!=='pending';return (!s||s!=='pending')&&!!(d.currentBinding()||d.currentOwner?.());}catch{return true;}};
 const railKey=k=>k==='read'?'write':k==='subjects'?'home':k;
 async function ready(){
  await window.arCreateReviewStartup?.whenReady?.();
  return until(()=>window.combinedNavigation?.go&&window.combinedSubjects?.open&&document.querySelector('.combined-rail,.combined-phonebar')&&nowId(),15000);
 }
 // Which subject holds a piece: {known:false} when the workspace cannot say, else {found, other}.
 async function findPiece(subjectId,pieceId){
  const read=window.realOutputOverview?.read;if(typeof read!=='function')return {known:false};
  const has=d=>(d?.outputs||[]).some(o=>o.id===pieceId);
  try{if(has(await read({projectId:subjectId})))return {known:true,found:true,other:null};}catch{return {known:false};}
  for(const p of projectList()){if(p.id===subjectId)continue;try{if(has(await read({projectId:p.id})))return {known:true,found:false,other:p.id};}catch{}}
  return {known:true,found:false,other:null};
 }
 async function openPlace({subject:sid=null,piece:pid=null,view=null}={}){
  const key=SECTIONS.includes(view)?view:null;
  const result={ok:false,reason:null,message:'',subject:sid||null,piece:pid||null,view:key,opened:null};
  const finish=()=>{result.opened={subject:nowId(),piece:picked()?.id||null,section:boardOpen()?'subjects':document.getElementById('project-library')?.open&&!document.querySelector('#project-library[data-combined-subjects]')?'home':railNow()||null,view:carouselPage()?.dataset.writingView||window.studyDraft?.viewMode?.()||null};return result;};
  let started=false;try{started=await ready();}catch{}
  if(!started){result.reason='not-ready';result.message='The workspace did not finish loading.';return finish();}
  await until(()=>!railBusy(),5000);
  // The subject list may still be arriving; a list that has loaded and lacks the subject means it does not exist.
  // (A workspace that keeps no list is not asked.)
  if(sid&&key!=='home'&&projectList().length&&!await until(()=>projectList().some(p=>p.id===sid),5000)){result.reason='subject-not-found';result.message='No subject with that id.';return finish();}
  let pieceId=pid&&sid&&key!=='home'&&key!=='subjects'?pid:null;
  if(pieceId){
   const where=await findPiece(sid,pieceId);
   if(where.known&&!where.found){pieceId=null;result.reason=where.other?'piece-other-subject':'piece-not-found';result.message=where.other?'That piece belongs to another subject, so only this subject was opened.':'This subject has no piece with that id, so only the subject was opened.';}
  }
  try{
   if(sid&&key!=='home'){await window.combinedSubjects.open({projectId:sid});await until(()=>nowId()===sid||window.combinedSubjects?.currentSubject?.()?.id===sid);}
   // A subject with no section opens on the section it was last on, or Write, through its own board. Library (1) is
   // where every subject starts and shows all subjects, so it counts as none.
   if(sid&&!key){
    let saved=null;try{saved=projectList().find(p=>p?.id===sid)?.viewedStage;}catch{}
    const n=Number.isInteger(Number(saved))&&Number(saved)>=2&&Number(saved)<=12?Number(saved):5;
    await window.combinedSubjects.openStage(n);await until(()=>nowId()===sid&&!boardOpen()&&!railBusy());
   }
   // A piece is chosen before the section, never after: choosing a piece is itself a navigation (the output overview
   // opens that piece's own writer), so the piece is chosen through its writer and the section named is set last,
   // where it lands. (Choosing it straight into Arrange leaves an Article piece with no Arrange view.)
   if(pieceId&&window.realOutputOverview?.onAction){
    if(nowId()!==sid)await window.combinedSubjects.openStage(5);
    if(nowId()===sid){await window.realOutputOverview.onAction({projectId:sid,outputId:pieceId,kind:'native'});if(typeof window.studyOutputConnection?.selection==='function')await until(()=>picked()?.id===pieceId&&!railBusy());}
   }
   if(key&&key!=='subjects'){
    const target=railKey(key);
    let ok=await window.combinedNavigation.go(target);
    // From a subject's board the rail opens a section by its number only (Material then shows as Library); once the
    // board has closed the same rail button does the whole step, so it is pressed once more if the rail is elsewhere
    // after the board has closed. Check of a chosen piece opens beside its writing, where the rail stays on Write.
    await until(()=>!boardOpen()&&!railBusy(),4000);
    if(ok!==false&&target!=='check'&&target!=='home'&&railNow()&&railNow()!==target)ok=await window.combinedNavigation.go(target);
    // Read is a view of Write: wait for the writer to settle, then switch the view, as its Read switch does. A chosen
    // Carousel is read at its own writer (step 9, where the rail keeps marking Arrange): its writer's view says when it took.
    if(ok!==false&&key==='read'){
     if(picked()?.kind==='carousel'){for(let i=0;i<4&&carouselPage()?.dataset.writingView!=='read';i++){if(!await until(carouselPage,4000))continue;try{await window.workspaceNavigation?.changeMode?.('read');}catch{}await until(()=>carouselPage()?.dataset.writingView==='read',3000);}}
     else for(let i=0;i<4;i++){await until(()=>document.getElementById('manuscript')&&Number(current()?.viewedStage)===5&&writerSettled(),4000);if(!document.getElementById('manuscript')||Number(current()?.viewedStage)!==5)continue;try{await window.workspaceNavigation?.changeMode?.('read');}catch{}if(await until(()=>window.studyDraft?.viewMode?.()!=='edit',3000))break;}
    }
   }
   // Resolve only when the workspace itself shows it.
   const shows=()=>{
    if(key==='home')return !!document.getElementById('project-library')?.open;
    if(sid&&key==='subjects')return boardOpen();
    if(sid&&nowId()!==sid)return false;
    if(pieceId&&typeof window.studyOutputConnection?.selection==='function'&&picked()?.id!==pieceId)return false;
    // A chosen piece whose words live in a native binding shows only once the writer holds that exact binding (the
    // selection is recorded before the writer opens it, and the writer can decline or be superseded).
    if(pieceId&&typeof window.studyDraft?.currentBinding==='function'){const owner=window.studyOutputConnection?.selection?.()?.owner;if(owner?.kind==='native'){const b=window.studyDraft.currentBinding();if(b?.id!==owner.bindingId||b.parentStudyId!==sid)return false;}}
    if(!key)return !boardOpen();
    const carousel=pieceId&&picked()?.kind==='carousel';
    if(carousel){const w=carouselPage()?.dataset.writingView;return key==='read'?w==='read':key==='write'?w==='write':key==='check'?document.getElementById('wbf-drawer')?.dataset.tool==='check':true;}
    if(key==='check'&&pieceId)return true;
    if(key==='read')return window.studyDraft?.viewMode?.()!=='edit';
    // (A rail that marks nothing, as in a page with no rail, cannot contradict the landing.)
    return (!railNow()||railNow()===railKey(key))&&!boardOpen();
   };
   if(!await until(shows,6000)){if(!result.reason){result.reason='not-shown';result.message='The workspace did not show that place.';}return finish();}
   if(!result.reason)result.ok=true;
   return finish();
  }catch(error){if(!result.reason){result.reason='not-shown';result.message=error?.message||'The address could not open that place here.';}console.warn('Version two: the address could not open that place here.',result.message);return finish();}
 }
 function forget(){
  try{const url=new URL(location.href);for(const k of ['subject','section','piece','v2from'])url.searchParams.delete(k);history.replaceState(history.state,'',url.pathname+url.search+url.hash);}catch{}
 }
 async function open(){
  try{return await openPlace({subject,piece,view:section});}
  finally{forget();}
 }
 let landing=null;
 if(wanted)landing=open();

 window.arVersionTwo=Object.freeze({href,ensure,openPlace,landing:()=>landing});
})();
