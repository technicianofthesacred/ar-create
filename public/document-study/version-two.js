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
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 async function ready(){
  await window.arCreateReviewStartup?.whenReady?.();
  for(let i=0;i<150;i++){if(window.combinedNavigation?.go&&window.combinedSubjects?.open&&document.querySelector('.combined-rail,.combined-phonebar')&&typeof current==='function'&&current()?.id)return true;await wait(100);}
  return false;
 }
 function forget(){
  try{const url=new URL(location.href);for(const k of ['subject','section','piece','v2from'])url.searchParams.delete(k);history.replaceState(history.state,'',url.pathname+url.search+url.hash);}catch{}
 }
 async function open(){
  try{
   if(!await ready())return;await wait(300);
   const key=SECTIONS.includes(section)?section:null;
   if(subject&&key!=='home')await window.combinedSubjects.open({projectId:subject});
   // A subject with no section opens on the section it was last on, or Write, through its own board. Library (1) is
   // where every subject starts and shows all subjects, so it counts as none.
   if(subject&&!key){
    let saved=null;try{saved=(typeof state!=='undefined'?state.projects:[]).find(p=>p?.id===subject)?.viewedStage;}catch{}
    const n=Number.isInteger(Number(saved))&&Number(saved)>=2&&Number(saved)<=12?Number(saved):5;
    await window.combinedSubjects.openStage(n);
   }
   // A piece is chosen before the section, never after: choosing a piece is itself a navigation (the output overview
   // opens that piece's own writer), so the piece is chosen through its writer and the section named in the address is
   // set last, where it lands. (Choosing it straight into Arrange leaves an Article piece with no Arrange view.)
   if(piece&&subject&&key!=='home'&&key!=='subjects'&&window.realOutputOverview?.onAction){
    if(current()?.id!==subject)await window.combinedSubjects.openStage(5);
    if(current()?.id===subject){await window.realOutputOverview.onAction({projectId:subject,outputId:piece,kind:'native'});await wait(300);}
   }
   if(key&&key!=='subjects'){
    const target=key==='read'?'write':key;let ok=await window.combinedNavigation.go(target);
    // From a subject's board the rail opens a section by its number only (Material then shows as Library); once the
    // board has closed the same rail button does the whole step, so it is pressed once more when the rail is elsewhere.
    // Check of a chosen piece opens beside its writing, where the rail stays on Write: that is where it belongs.
    await wait(300);
    const railNow=()=>document.querySelector('.combined-rail [data-combined-nav][aria-current]')?.dataset.combinedNav;
    if(ok!==false&&target!=='check'&&target!=='home'&&railNow()&&railNow()!==target)ok=await window.combinedNavigation.go(target);
    // Read is a view of Write: wait for the writer to settle, then switch the view, as its Read switch does.
    // A chosen Carousel is read at its own writer (step 9, where the rail keeps marking Arrange): its Read switch is the
    // workspace's own mode change, and the writer's view says when it has taken.
    const carouselRead=()=>document.querySelector('#study-output-canvas .car-writing-page')?.dataset.writingView==='read';
    if(ok!==false&&key==='read'&&window.studyOutputConnection?.selection?.()?.output?.kind==='carousel')for(let i=0;i<30&&!carouselRead();i++){await wait(200);if(!document.querySelector('#study-output-canvas .car-writing-page'))continue;try{await window.workspaceNavigation?.changeMode?.('read');}catch{}await wait(300);}
    else if(ok!==false&&key==='read')for(let i=0;i<30;i++){await wait(200);if(!document.getElementById('manuscript')||Number(current()?.viewedStage)!==5)continue;try{await window.workspaceNavigation?.changeMode?.('read');}catch{}if(window.studyDraft?.viewMode?.()!=='edit')break;}
   }
  }catch(error){console.warn('Version two: the address could not open that place here.',error?.message||error);}
  finally{forget();}
 }
 if(wanted)void open();

 window.arVersionTwo=Object.freeze({href,ensure});
})();
