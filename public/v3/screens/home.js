/* Version three: Home, in the approved look (design/2026-11-write/NOTES.md, third pass). It is a copy of version two's Home:
   Home shows a quiet entrance to Needs you, On your desk and Everything, on the app's real records only.
   The full Needs you list has its own route. Every class here starts with h3-, and every rule in home.css starts with .v3-home.
   Where every subject stands (its station, ring, next step, forms, when it last changed) comes from ONE read,
   subjects.standing, and nothing else: no per-subject reads, no list of projects. Where each subject lives (folder,
   tags, pin, archived, hand-set order in its folder, hand-set place on the desk) comes from subject-places, the folder
   list from subject-places.folders.get. Only the five covers on the desk are read one by one, after first paint. */
(function(v2){
 'use strict';

 // coss ui's button look (window.coss, from /ui/kit/coss-classes.js): primary for the main action, outline for the
 // ordinary ones, ghost for the quiet and icon buttons. If the script did not load, the classes are empty and the
 // button keeps Home's own look.
 const coss=o=>{try{return window.coss.button(o);}catch{return '';}};
 const CP=coss({variant:'default'}),CB=coss({variant:'outline'}),CQ=coss({variant:'ghost',size:'sm'}),CI=coss({variant:'ghost',size:'icon-sm'});
 if(!v2)return;
 const W=window,{esc,icon,ring}=v2.ui;

 const STATIONS=Object.freeze([
  {id:'gather',name:'Gather'},{id:'research',name:'Research'},{id:'create',name:'Create'},
  {id:'share',name:'Share'},{id:'published',name:'Published'},{id:'resting',name:'Resting'}].map(Object.freeze));
 const NAME=Object.fromEntries(STATIONS.map(s=>[s.id,s.name]));
 const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
 const quiet=p=>p.then(v=>v,()=>null);
 const readNeeds=()=>v2.call('needs-you',{status:'pending'});
 const readLeases=()=>quiet(v2.call('leases',{}));
 const needsHref=ask=>v2.href('needs-you',{},ask?{ask}:null);
 const isRecordingAsk=ask=>['recording-words','recording-check'].includes(ask.scope?.kind);
 function askLinks(ask){
  const recording=isRecordingAsk(ask);
  const links=recording?[
   {href:ask.recording?.wordsHref||ask.wordsHref,label:'Check words'},
   {href:ask.recording?.transcriptHref||ask.transcriptHref,label:'Check passages'},
  ].filter(link=>link.href):[];
  if(!links.length&&ask.link)links.push({href:ask.link.href,label:recording?'Go through them':ask.link.label||'Open'});
  return links.map(link=>({
   ...link,href:typeof link.href==='string'&&link.href.startsWith('#')?'/document-study/index.html'+link.href:link.href,
  })).filter(link=>typeof link.href==='string'&&/^\/(?![/\\])/.test(link.href));
 }
 function askTile(ask){
  const links=askLinks(ask);
  const direct=ask.status==='open'&&links.length===1&&
   (isRecordingAsk(ask)||(ask.choices||[]).every(choice=>choice==='Done'));
  const href=direct?links[0].href:needsHref(ask.id);
  const question=String(ask.question||'').trim();
  const contextualLabel=direct&&links[0].label!=='Open'?links[0].label.replace(/^Open the /i,'Open '):'';
  let label=question.split(/[?!.](?:\s|$)/,1)[0],symbol='ask';
  if(isRecordingAsk(ask)){label=contextualLabel||'Check recording';symbol='mic';}
  else if(/\b(?:what (?:month|year|date)|when did you|(?:confirm|check|verify) (?:the )?(?:visit )?date)\b/i.test(question)){label='Visit date';symbol='calendar';}
  else if(/\b(?:introduce|introduction)\b/i.test(question)){label='Introduction';symbol='pen';}
  else if(contextualLabel){label=contextualLabel;symbol='out';}
  const context=ask.status==='defaulted'?'Applied by default':ask.about;
  const detail=context?.split(' · ').at(-1);
  const accessibleLabel=[label===question?'':label,question,context].filter(Boolean).join(' · ');
  return `<li><a class="h3-needs-link" data-needs-open="${esc(ask.id)}" href="${esc(href)}" title="${esc(question)}" aria-label="${esc(accessibleLabel)}">${icon(symbol)}<span class="h3-needs-copy"><span>${esc(label)}</span>${detail?`<small>${esc(detail)}</small>`:''}</span></a></li>`;
 }
 const fkey=path=>(path||[]).join('\u0001');
 const lower=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase();
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const DESK_MAX=5;
 // Which desk subjects had a cover picture last time, on this device only (ids and nothing else), so the cover block is
 // kept from first paint and the page does not jump when the covers arrive. Version two's keys are never touched.
 const COVERS_KEY='ar-v3-home-covers';
 function rememberedCovers(){try{const v=JSON.parse(W.localStorage.getItem(COVERS_KEY)||'[]');return new Set((Array.isArray(v)?v:[]).filter(x=>typeof x==='string'&&x&&x.length<200).slice(0,40));}catch{return new Set();}}
 function keepCovers(ids){try{W.localStorage.setItem(COVERS_KEY,JSON.stringify([...ids]));}catch{}}

 /** The next step to show for a subject, or '' when it is not known. Never a guess: the read says "known" and names the
     step, or nothing is shown. The form is named only when the subject has more than one. */
 function nextOf(s){
  if(!s||!s.known||!s.next||typeof s.next.name!=='string'||!s.next.name)return '';
  if(s.station==='published'||s.station==='resting')return '';
  // A check held for want of a source cannot be run: the standing's own words say what it waits for, not a bare "Check".
  const held=s.next.step==='check'&&s.next.state==='wait'&&typeof s.next.note==='string'&&s.next.note.trim();
  const say=held?s.next.note.trim():s.next.name;
  return s.next.formName&&(s.forms||[]).length>1?say+' · '+s.next.formName:say;
 }
 const sharedApi=Object.freeze({nextOf,STATIONS});
 try{let shared=v2.shared;if(!shared){try{v2.shared={};}catch{}shared=v2.shared;}if(shared&&typeof shared==='object')shared.home=sharedApi;}catch{}

 /* ======================= reading: three calls for the subject list ======================= */
 const Standing={
  async list(){
   const [summary,places,folders]=await Promise.all([
    v2.call('subjects.standing',{}),v2.call('subject-places',{}),v2.call('subject-places.folders.get',{})]);
   const placeOf=new Map((places?.places||[]).map(p=>[p.parentStudyId,p]));
   const unplaced=id=>({parentStudyId:id,folder:[],tags:[],pinnedAt:null,archived:false,order:null,deskOrder:null,revision:0,saved:false});
   const subjects=(summary?.subjects||[]).filter(x=>x&&typeof x.id==='string'&&x.id).map(x=>{
    const place=placeOf.get(x.id)||unplaced(x.id);
    return {...x,title:String(x.title||'').trim()||'Untitled subject',forms:x.forms||[],place,archived:!!(x.archived||place.archived)};
   });
   return {subjects,folders,readAt:Date.now(),ms:summary?.ms};
  },
 };

 /* ======================= small helpers for the page ======================= */
 const PIN='<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/></svg>';
 const MORE='<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h.01M12 12h.01M18 12h.01"/></svg>';
 const GROUPS=[['folder','By folder'],['tag','By tag'],['station','By station'],['recent','Recent']];
 const CUT={folder:8,tag:8,station:8,recent:30},TAGS_SHOWN=4;
 const PREFS='ar-create-v2-home';// how he likes Home grouped and viewed, on this device only; never a record
 function prefs(){try{const p=JSON.parse(W.localStorage.getItem(PREFS)||'{}');return {group:GROUPS.some(g=>g[0]===p.group)?p.group:'folder',view:p.view==='covers'?'covers':'rows'};}catch{return {group:'folder',view:'rows'};}}
 function keepPrefs(ui){try{W.localStorage.setItem(PREFS,JSON.stringify({group:ui.group,view:ui.view}));}catch{}}
 function when(iso,now=Date.now()){
  const t=Date.parse(iso||'');if(!Number.isFinite(t))return '';
  const d=new Date(t),today=new Date(now);
  if(d.toDateString()===today.toDateString())return 'Today';
  const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);
  if(d.toDateString()===yesterday.toDateString())return 'Yesterday';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',...(d.getFullYear()!==today.getFullYear()?{year:'numeric'}:{})});
 }
 function workDate(iso){
  const label=when(iso);
  if(!label)return '<small></small>';
  const exact=new Date(iso).toLocaleDateString('en-GB',{dateStyle:'long'});
  return `<small><time datetime="${esc(iso)}" title="Last worked on ${esc(exact)}">${esc(label)}</time></small>`;
 }
 function dueAt(iso){const t=Date.parse(iso||'');if(!Number.isFinite(t))return 'soon';const d=new Date(t),clock=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});return when(iso)==='Today'?'at '+clock:'on '+when(iso)+' at '+clock;}
 const today=()=>{const d=new Date(),part=o=>d.toLocaleDateString('en-GB',o);return part({weekday:'long'})+' '+part({day:'numeric',month:'short',year:'numeric'});};
 const subjectHref=id=>v2.href('subject/:id',{id});
 const folderPath=path=>['Subjects',...path].join(' / ');
 const expectPlace=p=>({expectedRevision:p?.revision||0,...(p?.saved&&p.hash?{expectedHash:p.hash}:{})});
 const V2Client=W.V2Client;
 const uuid=()=>{try{return crypto.randomUUID();}catch{return V2Client?.uuid?.()||String(Date.now());}};
 // The controls a repaint must hand focus back to, by what they are and which subject they belong to.
 const FOCUS_KEYS=['data-pin','data-v2-up','data-v2-down','data-row-menu','data-group-by','data-view','data-station','data-arrange','data-archived','data-show-all','data-home-find','data-file-in','data-file-more','data-needs-open','data-unarchive'];

 /* ======================= the screen ======================= */
 v2.screen({id:'home',title:'Home',route:'',
  render:()=>`<div class="v2-page v3-home" data-home>
 <header><div><h1 class="h3-title">Home</h1><p class="h3-quiet">${esc(today())}</p></div><button type="button" class="${CP} h3-pri h3-new" data-home-new>${icon('plus')}New subject</button></header>
 <div class="h3-needs-slot" data-home-needs hidden></div>
 <section class="h3-desk" data-home-desk aria-labelledby="h3-desk-h" hidden></section>
 <section class="h3-file" data-home-file aria-labelledby="h3-file-h" hidden></section>
 <section class="h3-all" data-home-all aria-labelledby="h3-all-h"><div class="h3-sec-h"><h2 class="h3-title" id="h3-all-h">Everything</h2></div><p class="h3-quiet" data-home-loading>Reading your subjects…</p></section>
</div>`,
  async mount(el,ctx){
   const root=el.querySelector('[data-home]');if(!root)return;
   const ui={...prefs(),station:null,find:'',open:new Set(),archived:false,arrange:false,allFile:false};
   let data=null,failed=null,loading=null,again=false,loadedAt=0,timer=0,dragId=null,dragging=false,deskStops=[],allStops=[],repaintWaiting=false;
   let dragPreview=null,needs=null,leases=[],leaseRead=0;
   const lookRoles=new Map(),lookNames=new Map();
   // Covers of the desk's cards: subject id to an address, or '' when it has no chosen photograph. Read after first paint.
   // failedCovers: subjects whose cover read did not answer during this visit; they are not asked again (as in version two),
   // their held block is dropped, and the list on the device is left as it was for the next visit.
   const covers=new Map(),remembered=rememberedCovers(),failedCovers=new Set();let coverRun=0,bindings=null,coversStale=false;
   // Reordering: each press waits for the one before it, and was built from what was on screen at the press.
   let orderQueue=Promise.resolve(),ordersPending=0,readAgain=false;

   /* ---------- reading ---------- */
   async function load(){
    if(loading){again=true;return loading;}
    loading=(async()=>{
     try{data=await Standing.list();failed=null;}
     catch(error){if(ctx.signal.aborted)return;failed=error;}
     finally{loading=null;}
     if(ctx.signal.aborted)return;
     // The desk in the top bar follows this page's order while it is open, once Home has read its subjects.
     if(data)void v2.desk.use(async()=>desk().map(s=>({id:s.id,title:s.title,...(covers.get(s.id)?{cover:covers.get(s.id)}:{})})));
     loadedAt=Date.now();
     if(busy()&&data)repaint();else paint();
     void readCovers();void readLooks();if(!unfiledRead||unfiledStale)void readUnfiled();
     if(again){again=false;void load();}
    })();
    return loading;
   }
   async function readLeases(){
    const run=++leaseRead,result=await quiet(v2.call('leases',{}));
    if(ctx.signal.aborted||!root.isConnected||run!==leaseRead)return;
    const next=result?.leases||[];
    if(!next.length&&!leases.length)return;
    leases=next;
    if(data)repaint();else keepFocus(paintNeeds);
   }
   const soon=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!ctx.signal.aborted)void load();},350);};
   const busy=()=>!!(dragging||ordersPending||document.querySelector('dialog.v2-sheet[open]'));
   function repaint(){
    if(ctx.signal.aborted||!data)return;
    if(busy()){if(!repaintWaiting){repaintWaiting=true;setTimeout(()=>{repaintWaiting=false;repaint();},800);}return;}
    paint();v2.desk.refresh();
   }

   /* ---------- covers: the first chosen photograph of each subject on the desk ---------- */
   async function readCovers(){
    const run=++coverRun,want=desk().map(s=>s.id).filter(id=>coversStale||(!covers.has(id)&&!failedCovers.has(id)));coversStale=false;
    if(!want.length)return applyCovers();
    if(!bindings||want.some(id=>!bindings.has(id))){
     const catalog=await quiet(v2.call('study-draft.catalog',{}));
     if(!catalog){for(const id of want)failedCovers.add(id);return applyCovers();}// not answered: nothing new is known, what is known is still drawn
     bindings=new Map((catalog?.collections||[]).filter(c=>c?.parentStudyId&&c?.bindingId).map(c=>[c.parentStudyId,c.bindingId]));
    }
    await Promise.all(want.map(async id=>{
     const binding=bindings?.get(id);let url='';
     if(binding){
      const out=await quiet(v2.call('study.outputs',{parentStudyId:id,rootBindingId:binding})),scope=out?.photoScope;
      if(!out){failedCovers.add(id);return;}
      const photos=scope?.projectId&&scope?.documentId?await quiet(v2.call('study.photos.inspect',{projectId:scope.projectId,documentId:scope.documentId,bindingId:binding,parentStudyId:id})):null;
      if(scope?.projectId&&scope?.documentId&&!photos){failedCovers.add(id);return;}
      const first=(photos?.photos||[]).find(p=>p&&p.selected!==false&&!p.missing&&!p.previewUnavailable&&typeof p.url==='string'&&p.url.startsWith('/api/study/photos/preview?'));
      if(first){const u=new URL(first.url,location.origin);if(!u.searchParams.has('bindingId'))u.searchParams.set('bindingId',binding);if(!u.searchParams.has('parentStudyId'))u.searchParams.set('parentStudyId',id);url=u.pathname+u.search;}
     }
     failedCovers.delete(id);covers.set(id,url);
    }));
    if(ctx.signal.aborted)return;
    if(run!==coverRun)return applyCovers();// a newer run took over: what this one read is still drawn
    applyCovers();void v2.desk.refresh();
    // What the desk's covers are now, kept for the next first paint; a subject whose answer did not come keeps what it had.
    const have=desk().filter(s=>covers.get(s.id)||(covers.get(s.id)===undefined&&remembered.has(s.id))).map(s=>s.id);
    remembered.clear();for(const id of have)remembered.add(id);keepCovers(have);
   }
   /** Put each known cover where its subject is shown, in place; nothing else on the page is touched. */
   function applyCovers(){
    for(const node of root.querySelectorAll('.h3-card[data-id],.h3-cover[data-id],.h3-row[data-id]')){
     const url=covers.get(node.dataset.id);
     // A card whose cover turned out not to exist loses the block kept for it.
     if((url===''||(url===undefined&&failedCovers.has(node.dataset.id)))&&node.classList.contains('h3-card')){node.querySelector('.h3-card-pic:not(.has-img)')?.remove();continue;}
     if(!url)continue;
     let pic=node.querySelector('.h3-card-pic,.h3-cover-pic,.h3-row-pic');
     if(!pic&&node.classList.contains('h3-card')){node.querySelector('.h3-card-open')?.insertAdjacentHTML('afterbegin','<span class="h3-card-pic" aria-hidden="true"></span>');pic=node.querySelector('.h3-card-pic');}
     if(pic&&!pic.querySelector('img')){pic.innerHTML=`<img src="${esc(url)}" alt="" loading="lazy">`;pic.hidden=false;pic.classList.add('has-img');}
    }
   }

   /* ---------- looks for the folder dots ---------- */
   async function readLooks(){
    const ids=[...new Set((data?.subjects||[]).map(s=>s.look).filter(id=>id&&!lookRoles.has(id)))];if(!ids.length)return;
    await Promise.all(ids.map(async id=>{const look=await quiet(v2.call('look',{id}));lookRoles.set(id,look?.roles||null);lookNames.set(id,String(look?.name||'').trim());}));
    if(!ctx.signal.aborted&&data)paintDots();
   }
   function paintDots(){
    for(const h of root.querySelectorAll('.h3-group>header[data-drop-folder]')){
     let path=[];try{path=JSON.parse(h.parentElement.dataset.path||'[]');}catch{}
     h.querySelector('.h3-dot')?.remove();const dot=folderDot(path),grip=h.querySelector('.h3-grip');if(dot){if(grip)grip.insertAdjacentHTML('afterend',dot);else h.insertAdjacentHTML('afterbegin',dot);}
    }
   }
   function folderDot(path){if(!path?.length)return '';const id=folderLook(path),a=id&&accentOf(id);return !a?'<i class="h3-dot" aria-hidden="true"></i>':`<i class="h3-dot" style="--h3-dot:${esc(a)}" title="${esc(lookNames.get(id)?'Drawn in the '+lookNames.get(id)+' look':'Drawn in one look')}" aria-hidden="true"></i>`;}
   function accentOf(id){const roles=lookRoles.get(id),a=roles?.[v2.theme()==='dark'?'dark':'light']?.accent||roles?.dark?.accent;return typeof a==='string'&&/^#[0-9a-f]{3,8}$/i.test(a)?a:null;}

   /* ---------- to file: things in the Library that no subject or plan uses ---------- */
   // The Library's own top folder is where Capture puts what has no subject ("to file later"), but anything else can sit
   // there too, so the list says only what the records support: files there that no subject lists as its material
   // (library.source-projects), no Instagram plan uses (instagram.plans, then each plan's material) and no saved
   // photograph placement uses (library.usage). A use the records do not keep (a Magazine story, a citation) cannot be
   // seen, so such a file may still be listed. The Library tree is read once, and again only when a change that could
   // alter it arrives.
   const FILE_CUT=5,PLAN_CAP=40;
   let unfiled=[],filing=new Set(),unfiledRead=false,unfiledStale=false;
   const sourceIdsOf=plan=>[...(plan?.material?.transcripts||[]),...(plan?.material?.photos||[])].map(x=>x?.sourceId).filter(Boolean);
   async function readUnfiled(){
    unfiledRead=true;unfiledStale=false;
    const [tree,used,plans]=await Promise.all([quiet(v2.call('sources.tree',{})),quiet(v2.call('library.source-projects',{})),quiet(v2.call('instagram.plans',{}))]);
    if(ctx.signal.aborted)return;
    const library=(tree?.roots||[]).find(r=>r?.id==='library'),top=library?.tree?.files;
    if(!Array.isArray(top)||!used||!Array.isArray(used.projects)){unfiled=[];return keepFocus(paintFile);}
    const taken=new Set(used.projects.flatMap(p=>p.sourceIds||[]));
    const planList=(plans?.plans||[]).filter(p=>p&&typeof p.id==='string').slice(0,PLAN_CAP);
    for(const plan of await Promise.all(planList.map(p=>quiet(v2.call('instagram.plan.get',{id:p.id})))))for(const id of sourceIdsOf(plan))taken.add(id);
    let rest=top.filter(f=>f&&typeof f.id==='string'&&f.id&&!f.missing&&!taken.has(f.id));
    if(rest.length){
     const placed=await quiet(v2.call('library.usage',{sourceId:rest.map(f=>f.id)}));
     const usedIds=new Set((placed?.sources||[]).filter(x=>(x?.occurrences||[]).length).map(x=>x.sourceId));
     rest=rest.filter(f=>!usedIds.has(f.id));
    }
    if(ctx.signal.aborted)return;
    unfiled=rest.sort((a,b)=>String(b.provenance?.capturedAt||b.modified_at||'').localeCompare(String(a.provenance?.capturedAt||a.modified_at||'')));
    keepFocus(paintFile);
   }
   function paintFile(){
    const sec=root.querySelector('[data-home-file]');if(!sec||ctx.signal.aborted)return;
    if(!unfiled.length||!live().length){sec.hidden=true;sec.innerHTML='';return;}
    const show=ui.allFile?unfiled:unfiled.slice(0,FILE_CUT),more=unfiled.length-show.length,lib=v2.advanced({section:'library'});
    sec.hidden=false;
    sec.innerHTML=`<div class="h3-sec-h"><h2 class="h3-title" id="h3-file-h">To file</h2><span>${plural(unfiled.length,'thing')} in the Library, not with a subject yet</span></div>
<ul class="h3-file-list">${show.map(f=>`<li data-source="${esc(f.id)}"><span class="h3-file-name">${esc(f.rel_path||f.name||'Untitled')}</span><small>${esc(when(f.provenance?.capturedAt||f.modified_at))}</small><span class="h3-file-acts"><button type="button" class="${CQ} h3-q" data-file-in="${esc(f.id)}">File in a subject</button><a class="h3-act" href="${esc(lib)}">See it in Advanced</a></span></li>`).join('')}</ul>
${more>0?`<button type="button" class="${CQ} h3-q h3-more" data-file-more>Show ${more} more</button>`:''}`;
   }
   /** File one capture with a subject, as the Capture sheet does: study.material.attach, else first-flow.attach. */
   function fileSheet(id){
    const item=unfiled.find(f=>f.id===id);if(!item)return;
    // A Magazine story keeps its material in the Magazine, so nothing is filed in it from here.
    const subjects=live().filter(s=>s.origin?.kind!=='magazine').sort(byName);
    const f=form(`<label for="h3-file-to">Subject</label><select id="h3-file-to" name="subject">${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')}</select><p class="h3-quiet">${esc(item.rel_path||item.name||'')}</p>${formActs('File it')}`);
    const sheet=v2.ui.sheet({title:'File in a subject',body:f});f.elements.subject.focus();
    f.addEventListener('submit',async e=>{
     e.preventDefault();const subject=subjects.find(s=>s.id===f.elements.subject.value);if(!subject||filing.has(id))return;
     filing.add(id);f.querySelector('[type=submit]').disabled=true;
     try{
      const st=await v2.call('subject.standing',{parentStudyId:subject.id}),facts=st?.facts||{};
      const tries=[];
      if(facts.bindingId)tries.push(()=>v2.call('study.material.attach',{bindingId:facts.bindingId,parentStudyId:subject.id,sourceIds:[id]}));
      if(facts.projectId)tries.push(()=>v2.call('first-flow.attach',{projectId:facts.projectId,sourceIds:[id]}));
      if(!tries.length)throw new Error('This subject has no place of its own yet, so nothing can be filed in it.');
      let why='',done=false;for(const attempt of tries){try{await attempt();done=true;break;}catch(error){why=error?.message||why;}}
      if(!done)throw new Error(why||'The app refused it.');
      const at=unfiled.findIndex(x=>x.id===id);
      sheet.close();unfiled=unfiled.filter(x=>x.id!==id);paintFile();v2.ui.say(`Filed in "${subject.title}".`,{tone:'good'});
      // Focus goes to the next line; with none left the block is gone, so to the page's own heading.
      const next=[...root.querySelectorAll('[data-file-in]')][Math.min(Math.max(at,0),unfiled.length-1)]||root.querySelector('h1');
      if(next){if(next.tagName==='H1')next.tabIndex=-1;next.focus({preventScroll:true});}
      unfiledStale=true;void readUnfiled();
     }catch(error){f.querySelector('[type=submit]').disabled=false;v2.ui.say((error?.message||'It could not be filed.')+' Press File it to try again.',{tone:'bad'});}
     finally{filing.delete(id);}
    });
   }

   /* ---------- the model ---------- */
   const find=id=>data?.subjects.find(s=>s.id===id);
   const live=()=>(data?.subjects||[]).filter(s=>!s.archived);
   const orderKey=s=>num(s.place.order)?s.place.order:1e9;
   const byHand=(a,b)=>orderKey(a)-orderKey(b)||a.title.localeCompare(b.title);
   const byName=(a,b)=>a.title.localeCompare(b.title);
   // The desk keeps its own order, apart from the folders'; a subject placed before the desk had one goes by when it was pinned.
   const deskKey=s=>num(s.place.deskOrder)?s.place.deskOrder:1e9;
   function desk(){return live().filter(s=>s.place.pinnedAt).sort((a,b)=>deskKey(a)-deskKey(b)||String(a.place.pinnedAt).localeCompare(String(b.place.pinnedAt))).slice(0,DESK_MAX);}
   const findMatch=s=>!ui.find||lower(s.title).includes(lower(ui.find));
   function holder(id){const l=leases.find(x=>x?.scope?.id===id&&x.actor&&x.actor!==v2.actor()&&Date.parse(x.expiresAt||0)>Date.now());return l?v2.actorName(l.actor):'';}
   function folderList(){
    const list=(data?.folders?.folders||[]).map(f=>({path:f.path,saved:f.saved!==false}));
    const seen=new Set(list.map(f=>fkey(f.path)));
    for(const s of live())if(s.place.folder?.length&&!seen.has(fkey(s.place.folder))){seen.add(fkey(s.place.folder));list.push({path:[...s.place.folder],saved:false});}
    return list;
   }
   const inFolder=path=>live().filter(s=>fkey(s.place.folder)===fkey(path)).sort(byHand);
   function groups(){
    const all=live(),rows=all.filter(s=>(!ui.station||s.station===ui.station)&&findMatch(s)),filtered=!!(ui.find||ui.station);
    if(ui.group==='folder'){
     const out=folderList().map(f=>({key:'f:'+fkey(f.path),name:f.path[f.path.length-1],path:f.path,saved:f.saved,
      total:all.filter(s=>fkey(s.place.folder)===fkey(f.path)).length,items:rows.filter(s=>fkey(s.place.folder)===fkey(f.path)).sort(byHand)}));
     out.push({key:'f:',name:'Not in a folder',path:[],loose:true,total:all.filter(s=>!s.place.folder?.length).length,items:rows.filter(s=>!s.place.folder?.length).sort(byHand)});
     return out.filter(g=>g.items.length||(!filtered&&!g.loose));
    }
    if(ui.group==='tag'){
     const tags=new Map();for(const s of all)for(const t of s.place.tags||[])tags.set(t,(tags.get(t)||0)+1);
     const out=[...tags.keys()].sort((a,b)=>tags.get(b)-tags.get(a)||a.localeCompare(b)).map(t=>({key:'t:'+t,name:t,total:tags.get(t),items:rows.filter(s=>(s.place.tags||[]).includes(t)).sort(byName)}));
     out.push({key:'t:',name:'No tag',total:all.filter(s=>!(s.place.tags||[]).length).length,items:rows.filter(s=>!(s.place.tags||[]).length).sort(byName)});
     return out.filter(g=>g.items.length);
    }
    if(ui.group==='station')return STATIONS.map(st=>({key:'s:'+st.id,name:st.name,total:all.filter(s=>s.station===st.id).length,items:rows.filter(s=>s.station===st.id).sort(byName)})).filter(g=>g.items.length);
    const t=s=>Date.parse(s.workChangedAt||'')||0;
    return [{key:'r:',name:'Most recent first',total:all.length,items:rows.sort((a,b)=>t(b)-t(a)||byName(a,b))}];
   }
   const canArrange=()=>ui.group==='folder'&&!ui.find&&!ui.station;
   function folderLook(path){const looks=new Set(live().filter(s=>fkey(s.place.folder)===fkey(path)&&s.look).map(s=>s.look));return looks.size===1?[...looks][0]:null;}

   /* ---------- painting ---------- */
   /** Draw again, then give focus back to the same control of the same subject, if it is still there. */
   function keepFocus(draw){
    const a=root.ownerDocument.activeElement,inside=a&&root.contains(a);
    let pick=null;
    if(inside){const key=FOCUS_KEYS.find(k=>a.hasAttribute(k));if(key){const holderEl=a.closest('[data-id],[data-ask]');pick={key,value:a.getAttribute(key),id:holderEl?.dataset.id||null,ask:holderEl?.dataset.ask||null};}}
    const caret=a?.matches?.('[data-home-find]')?a.selectionStart:null;
    draw();
    if(!pick)return;
    const match=[...root.querySelectorAll(`[${pick.key}]`)].find(x=>x.getAttribute(pick.key)===pick.value&&(!pick.id||x.closest('[data-id]')?.dataset.id===pick.id)&&(!pick.ask||x.closest('[data-ask]')?.dataset.ask===pick.ask));
    if(match){match.focus({preventScroll:true});if(caret!==null){try{match.setSelectionRange(caret,caret);}catch{}}}
   }
   function paint(){
    if(ctx.signal.aborted)return;
    if(failed&&!data){
     root.querySelector('[data-home-needs]').hidden=true;root.querySelector('[data-home-desk]').hidden=true;
     root.querySelector('[data-home-all]').innerHTML=`<div class="h3-sec-h"><h2 class="h3-title" id="h3-all-h">Everything</h2></div><div class="h3-empty" data-home-error><p>${esc(failed.message||'The app could not be reached. Nothing was changed.')}</p><button type="button" class="${CB} h3-btn" data-home-retry>Try again</button></div>`;
     return;
    }
    if(!data)return;
    if(failed)v2.ui.say('Home could not be read again just now. What is shown is from '+new Date(data.readAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'.',{tone:'warn',timeout:8000});
    keepFocus(()=>{paintNeeds();paintDesk();paintFile();paintAll();applyCovers();});
   }

   function paintNeeds(){
    const slot=root.querySelector('[data-home-needs]');
    const asks=needs?.asks;
    const carrying=asks?.length===0?carryingOn({leases}):'';
    slot.hidden=asks?.length===0&&!carrying;
    if(!asks?.length){
     slot.innerHTML=asks?(carrying?`<p class="h3-quiet">${esc(carrying)}</p>`:''):
      `<a class="h3-needs-link" data-needs-open href="${esc(needsHref())}"><span>Open Needs you</span>${icon('chev')}</a>`;
     return;
    }
    const tiles=asks.slice(0,3).map(askTile).join('');
    const all=asks.length>3?`<a class="h3-needs-all" data-needs-open href="${esc(needsHref())}">All ${asks.length}${icon('chev')}</a>`:'';
    slot.innerHTML=`<section class="h3-needs-shelf" aria-labelledby="h3-needs-title"><h2 class="h3-needs-title" id="h3-needs-title">Needs you:</h2><ul class="h3-needs-preview">${tiles}</ul>${all}</section>`;
   }

   function card(s){
    const who=holder(s.id),url=covers.get(s.id),next=nextOf(s);
    // A card with no cover picture has no cover block at all: its name, its station and its next step. A subject that had
    // a cover last time keeps its block from first paint until the covers are read again.
    const hold=url===undefined&&remembered.has(s.id)&&!failedCovers.has(s.id);
    return `<article class="h3-card" data-id="${esc(s.id)}">
 <a class="h3-card-open" href="${esc(subjectHref(s.id))}">${url?`<span class="h3-card-pic has-img" aria-hidden="true"><img src="${esc(url)}" alt=""></span>`:hold?'<span class="h3-card-pic" aria-hidden="true"></span>':''}<b>${esc(s.title)}</b><span class="h3-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span>${who?`<small class="h3-held">${esc(who)} is working on it</small>`:''}</a>
 <a class="h3-card-next" href="${esc(subjectHref(s.id))}"${s.next?.note&&next&&!next.startsWith(s.next.note.trim())?` title="${esc(s.next.note)}"`:''}><span>${esc(next||'Open')}</span>${icon('right')}</a>
</article>`;
   }
   function paintDesk(){
    const sec=root.querySelector('[data-home-desk]'),items=desk();
    deskStops.forEach(f=>f());deskStops=[];
    if(!live().length){sec.hidden=true;sec.innerHTML='';return;}
    sec.hidden=false;
    if(!items.length){sec.innerHTML=`<div class="h3-sec-h"><h2 class="h3-title" id="h3-desk-h">On your desk</h2></div><p class="h3-quiet">Nothing on your desk yet.</p>`;return;}
    sec.innerHTML=`<div class="h3-sec-h"><h2 class="h3-title" id="h3-desk-h">On your desk</h2><span>${items.length} · what you are working on now. Drag to reorder.</span></div><div class="h3-cards" data-home-cards>${items.map(card).join('')}</div>`;
    const box=sec.querySelector('[data-home-cards]');
    deskStops.push(v2.ui.reorder(box,{item:'.h3-card',label:el=>el.querySelector('b')?.textContent||'Subject',
     // The order is read from the screen at the press, not from what was painted earlier.
     onMove:()=>queueOrder('desk',[...box.querySelectorAll(':scope>.h3-card')].map(x=>x.dataset.id))}));
    // The footer is one bar: the next step, and Move up and Move down beside it when they fit, under it when they do not.
    for(const c of box.querySelectorAll(':scope>.h3-card')){
     const bar=c.querySelector(':scope>.v2-move'),next=c.querySelector(':scope>.h3-card-next');if(!bar||!next)continue;
     const btns=document.createElement('span');btns.className='h3-move-btns';btns.append(...bar.querySelectorAll('button'));bar.prepend(next);bar.append(btns);
    }
   }

   const tagsOf=s=>{const tags=s.place.tags||[],extra=tags.length-TAGS_SHOWN;return `<span class="h3-tags">${tags.slice(0,TAGS_SHOWN).map(t=>`<i title="${esc(t)}">${esc(t)}</i>`).join('')}${extra>0?`<i class="h3-tag-more" title="${esc(tags.slice(TAGS_SHOWN).join(', '))}">+${extra}</i>`:''}</span>`;};
   const pinBtn=s=>{const on=!!s.place.pinnedAt;return `<button type="button" class="${CI} h3-q h3-ic h3-pin" data-pin="${esc(s.id)}" aria-pressed="${on}" aria-label="${on?'Take off your desk':'Put on your desk'}: ${esc(s.title)}" title="${on?'On your desk':'Put on your desk'}">${PIN}</button>`;};
   const menuBtn=s=>`<button type="button" class="${CI} h3-q h3-ic h3-rowmenu" data-row-menu="${esc(s.id)}" aria-label="Move or archive: ${esc(s.title)}" title="Move or archive">${MORE}</button>`;
   const rowPic=s=>{const url=covers.get(s.id);return `<span class="h3-row-pic${url?' has-img':''}" aria-hidden="true">${url?`<img src="${esc(url)}" alt="" draggable="false">`:''}</span>`;};
   function row(s){
    const who=holder(s.id),keys=canArrange()?' aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"':'';
    return `<li class="h3-row" data-id="${esc(s.id)}">
 <a class="h3-row-open" draggable="false"${keys} href="${esc(subjectHref(s.id))}">${rowPic(s)}<b>${esc(s.title)}</b>${tagsOf(s)}<span class="h3-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span><span class="h3-next">${who?`<em class="h3-held">${esc(who)} is working on it</em>`:esc(nextOf(s))}</span>${workDate(s.workChangedAt)}</a>
 ${menuBtn(s)}${pinBtn(s)}
</li>`;
   }
   const cover=s=>{const url=covers.get(s.id);return `<li class="h3-cover" data-id="${esc(s.id)}"><a href="${esc(subjectHref(s.id))}"><span class="h3-cover-pic${url?' has-img':''}" aria-hidden="true"${url?'':' hidden'}>${url?`<img src="${esc(url)}" alt="">`:''}</span><b>${esc(s.title)}</b><span class="h3-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span></a>${menuBtn(s)}${pinBtn(s)}</li>`;};
   function stationCounts(){const c={};for(const s of live())c[s.station]=(c[s.station]||0)+1;return c;}

   function paintAll(){
    const sec=root.querySelector('[data-home-all]'),all=live(),archived=(data.subjects||[]).filter(s=>s.archived);
    allStops.forEach(f=>f());allStops=[];
    const counts=stationCounts(),gs=all.length?groups():[],arrange=canArrange();
    const list=gs.map(g=>{
     const cut=ui.find||ui.open.has(g.key)?Infinity:ui.view==='covers'?12:CUT[ui.group],items=g.items.slice(0,cut),more=g.items.length-items.length,folder=ui.group==='folder'&&!g.loose;
     const count=!g.items.length?'Empty':ui.find||ui.station?`${g.items.length} of ${g.total}`:g.total;
     const head=`<header${ui.group==='folder'?` data-drop-folder`:''}>${folder&&g.saved?'<i class="h3-grip" aria-hidden="true"></i>':''}${folder?folderDot(g.path):''}<h3 class="h3-title">${esc(g.name)}</h3><span>${esc(count)}</span>${folder?`<small class="h3-path" title="A real folder">${esc(folderPath(g.path))}</small>`:''}</header>`;
     const body=!items.length?'':ui.view==='covers'?`<ul class="h3-covers" data-group="${esc(g.key)}">${items.map(cover).join('')}</ul>`:`<ul class="h3-rows" data-group="${esc(g.key)}">${items.map(row).join('')}</ul>`;
     return `<section class="h3-group${items.length?'':' h3-empty-folder'}" data-key="${esc(g.key)}"${folder&&g.saved?' data-saved':''}${g.path?` data-path="${esc(JSON.stringify(g.path))}"`:''}>${head}${body}${more>0?`<button type="button" class="${CQ} h3-q h3-more" data-show-all="${esc(g.key)}">Show all ${g.items.length}${icon('chev')}</button>`:''}</section>`;
    }).join('');
    const empty=!all.length?`<div class="h3-empty"><p>${archived.length?'Every subject is archived.':'No subjects yet.'}</p><button type="button" class="${CB} h3-btn" data-home-new>${icon('plus')}New subject</button></div>`
     :!gs.length?`<p class="h3-quiet">No subject matches${ui.find?` "${esc(ui.find)}"`:''}${ui.station?' in '+esc(NAME[ui.station]):''}.</p>`:'';
    const archive=archived.length?`<div class="h3-archived"><button type="button" class="${CQ} h3-q" data-archived aria-expanded="${ui.archived}">${ui.archived?'Hide archived':'Archived'} · ${archived.length}</button>${ui.archived?`<ul class="h3-rows">${archived.sort(byName).map(s=>`<li class="h3-row" data-id="${esc(s.id)}"><a class="h3-row-open" href="${esc(subjectHref(s.id))}">${rowPic(s)}<b>${esc(s.title)}</b>${tagsOf(s)}<span class="h3-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span><span class="h3-next"></span>${workDate(s.workChangedAt)}</a><button type="button" class="${CQ} h3-q h3-unarchive" data-unarchive="${esc(s.id)}">Put back</button></li>`).join('')}</ul>`:''}</div>`:'';
    sec.innerHTML=`<div class="h3-sec-h"><h2 class="h3-title" id="h3-all-h">Everything</h2><span>${plural(all.length,'subject')}</span>${all.length?`<label class="h3-find"><span class="h3-sr">Find a subject</span>${icon('search')}<input type="search" data-home-find placeholder="Find a subject" value="${esc(ui.find)}" autocomplete="off"></label>`:''}</div>
${all.length?`<div class="h3-tools">
 <div class="h3-seg" role="group" aria-label="Group">${GROUPS.map(([k,l])=>`<button type="button" class="h3-nav" data-group-by="${k}" aria-pressed="${ui.group===k}">${l}</button>`).join('')}</div>
 <div class="h3-chips" role="group" aria-label="Show one station">${STATIONS.map(st=>`<button type="button" class="h3-nav" data-station="${st.id}" aria-pressed="${ui.station===st.id}">${st.name}<small>${counts[st.id]||0}</small></button>`).join('')}</div>
 <span class="h3-grow"></span>
  <div class="h3-seg" role="group" aria-label="View">${[['rows','Rows'],['covers','Covers']].map(([k,l])=>`<button type="button" class="h3-nav" data-view="${k}" aria-pressed="${ui.view===k}">${l}</button>`).join('')}</div>
</div>`:''}
${empty}<div class="h3-groups" data-home-groups>${list}</div>
${all.length&&ui.group==='folder'?`<div class="h3-foot"><button type="button" class="${CB} h3-btn" data-new-folder>${icon('plus')}New folder</button><span class="h3-quiet">Folders here are the real folders on disk. Drag a folder to change the order, or a subject onto a folder to move it. Tags cut across folders.</span></div>`:''}${archive}`;
    if(!arrange)return;
    // Rows use the full drag surface and Alt+arrow. Covers and folders also show move buttons.
    // The new order is read from the screen at the moment of the move.
    for(const ul of sec.querySelectorAll('.h3-rows[data-group],.h3-covers[data-group]')){
     const g=gs.find(x=>x.key===ul.dataset.group);if(!g)continue;
     const sel=ul.classList.contains('h3-covers')?'.h3-cover':'.h3-row';
     allStops.push(v2.ui.reorder(ul,{item:sel,controls:ui.view==='covers',label:el=>el.querySelector('b')?.textContent||'Subject',
      onMove:()=>{const shown=[...ul.querySelectorAll(':scope>'+sel)].map(x=>x.dataset.id);
       // Those cut off by "Show all" keep their places after the ones shown.
       const rest=inFolder(g.path).map(s=>s.id).filter(id=>!shown.includes(id));
       return queueOrder('folder',[...shown,...rest]);}}));
    }
    const box=sec.querySelector('[data-home-groups]');
    allStops.push(v2.ui.reorder(box,{item:'.h3-group[data-saved]',label:el=>el.querySelector('h3')?.textContent||'Folder',onMove:()=>{
     const shown=[...box.querySelectorAll(':scope>.h3-group[data-saved]')].map(x=>{try{return JSON.parse(x.dataset.path);}catch{return null;}}).filter(Boolean);
     return queue(async()=>{
      const fresh=await v2.call('subject-places.folders.get',{}),saved=(fresh.folders||[]).filter(f=>f.saved!==false).map(f=>f.path);
      // The new order is what was on screen at the press; any saved folder not shown keeps its place at the end.
      const order=[...shown.filter(p=>saved.some(f=>fkey(f)===fkey(p))),...saved.filter(f=>!shown.some(p=>fkey(p)===fkey(f)))];
      data.folders=await v2.call('subject-places.folders.post',{action:'reorder',order,...v2.expect(fresh)});
      offerFolderUndo(data.folders,'Folders put in a new order.');
     });
    }}));
   }

   /* ---------- writing, always through the commands ---------- */
   /** Run one change after the one before it. A failure says so and reads everything again; the screen is not
       rolled back piece by piece, because later presses may already stand on it. */
   function queue(run){
    ordersPending++;
    const done=orderQueue.then(run).catch(error=>{if(!ctx.signal.aborted){v2.ui.say(error?.message||'The new order could not be saved.',{tone:'bad'});readAgain=true;}}).finally(()=>{ordersPending--;if(!ordersPending){v2.desk.refresh();if(readAgain){readAgain=false;soon();}}});
    orderQueue=done;return done;
   }
   /** Save a hand order for these subjects, the desk's or a folder's, each apart from the other. The list is the order
       on screen at the press; each subject's place is read when its turn comes, so quick presses never stand on a place
       an earlier press has already moved on. */
   function queueOrder(which,ids){
    return queue(async()=>{
     const wanted=ids.filter(id=>find(id));if(!wanted.length)return;
     const send=async()=>v2.call('subject-places.reorder',{which,items:wanted.map(id=>({parentStudyId:id,...expectPlace(find(id).place)}))});
     let result;
     try{result=await send();}
     catch(error){
      if(error?.kind!=='stale')throw error;
      // Someone else moved a place meanwhile: read the places again and send the same order once more.
      const fresh=await v2.call('subject-places',{});
      for(const p of fresh?.places||[]){const s=find(p.parentStudyId);if(s)s.place=p;}
      result=await send();
     }
     for(const p of result?.places||[]){const s=find(p.parentStudyId);if(s)s.place=p;}
    });
   }
   async function savePlace(s,change){
    const result=await v2.call('subject-places.save',{parentStudyId:s.id,...expectPlace(s.place),...change},{
     reread:()=>v2.call('subject-places',{parentStudyId:s.id}),
     // Only the fields asked for are sent again, on top of what is saved now; the rest of the place is left as it is.
     merge:fresh=>{const p=(fresh?.places||[]).find(x=>x.parentStudyId===s.id);if(!p)return null;s.place=p;return {parentStudyId:s.id,...expectPlace(p),...change};}});
    if(result&&result.parentStudyId===s.id){s.place=result;s.archived=!!result.archived;}
    return s.place;
   }
   function offerFolderUndo(view,text){
    const undoId=view?.undoOperationId;if(!undoId)return;
    v2.ui.undo(text,async()=>{try{const fresh=await v2.call('subject-places.folders.get',{});data.folders=await v2.call('subject-places.folders.post',{action:'undo',undoOperationId:undoId,...v2.expect(fresh)});v2.ui.say('Taken back.');repaint();soon();}catch(error){v2.ui.say(error.message,{tone:'bad'});}});
   }
   /** File a subject in another folder. It goes last there; Undo puts it back where it was, at its old place. */
   async function moveTo(s,path){
    const from=[...(s.place.folder||[])],fromOrder=num(s.place.order)?s.place.order:null;if(fkey(from)===fkey(path))return;
    const there=inFolder(path).filter(x=>x.id!==s.id),last=there.reduce((m,x)=>num(x.place.order)?Math.max(m,x.place.order):m,-1);
    try{await savePlace(s,{folder:path,order:Math.max(last+1,there.length)});repaint();
     v2.ui.undo(`"${s.title}" moved to ${path.length?path.join(' / '):'no folder'}.`,async()=>{try{await savePlace(s,{folder:from,order:fromOrder});repaint();v2.ui.say('Moved back.');soon();}catch(error){v2.ui.say(error.message,{tone:'bad'});}});soon();}
    catch(error){v2.ui.say(error.message,{tone:'bad'});}
   }
   async function setArchived(s,on){
    try{await savePlace(s,{archived:on});repaint();
     v2.ui.undo(on?`"${s.title}" archived.`:`"${s.title}" is back.`,async()=>{try{await savePlace(s,{archived:!on});repaint();soon();}catch(error){v2.ui.say(error.message,{tone:'bad'});}});soon();}
    catch(error){v2.ui.say(error.message,{tone:'bad'});}
   }
   async function togglePin(s){
    const on=!s.place.pinnedAt;
    if(on&&desk().length>=DESK_MAX){v2.ui.say('Your desk holds five. Take one off first.',{tone:'warn',timeout:6000});return;}
    // A new pin goes last on the desk.
    const last=desk().reduce((m,x)=>num(x.place.deskOrder)?Math.max(m,x.place.deskOrder):m,-1);
    try{await savePlace(s,on?{pinned:true,...(last>=0?{deskOrder:last+1}:{})}:{pinned:false});repaint();void readCovers();v2.ui.say(on?`"${s.title}" is on your desk.`:`"${s.title}" is off your desk.`);soon();}
    catch(error){v2.ui.say(error.message,{tone:'bad'});}
   }
   function form(markup){const f=document.createElement('form');f.className='v3-home h3-form';f.innerHTML=markup;return f;}
   const formActs=label=>`<div class="h3-form-acts"><button type="button" class="${CQ} h3-q" data-v2-close>Cancel</button><button type="submit" class="${CP} h3-pri h3-primary">${esc(label)}</button></div>`;
   function newSubject(){
    const f=form(`<label for="h3-new-name">Subject name</label><input id="h3-new-name" name="name" maxlength="160" required autocomplete="off" placeholder="What is it about?">${formActs('Create subject')}`);
    const sheet=v2.ui.sheet({title:'New subject',body:f});f.elements.name.focus();
    let intent=null;
    f.addEventListener('submit',async e=>{e.preventDefault();const title=f.elements.name.value.trim();if(!title)return;
     // The same identity is kept for a retry, so a second press never makes a second subject.
     intent||={parentStudyId:uuid(),title,operationId:uuid()};
     f.elements.name.readOnly=true;f.querySelector('[type=submit]').disabled=true;
     try{await v2.call('study-draft.create-collection',intent);sheet.close();v2.go('subject/:id',{id:intent.parentStudyId});}
     catch(error){f.querySelector('[type=submit]').disabled=false;v2.ui.say(error.message+' Press Create subject to try again.',{tone:'bad'});}
    });
   }
   const folderOptions=selected=>[`<option value="[]">Subjects (no folder)</option>`,...folderList().map(x=>`<option value="${esc(JSON.stringify(x.path))}"${fkey(x.path)===fkey(selected)?' selected':''}>${esc(x.path.join(' / '))}</option>`)].join('');
   function newFolder(){
    const f=form(`<label for="h3-folder-name">Name</label><input id="h3-folder-name" name="name" maxlength="80" required autocomplete="off"><label for="h3-folder-in">Inside</label><select id="h3-folder-in" name="parent">${folderOptions([])}</select>${formActs('Make the folder')}`);
    const sheet=v2.ui.sheet({title:'New folder',body:f});f.elements.name.focus();
    f.addEventListener('submit',async e=>{e.preventDefault();const name=f.elements.name.value.trim();if(!name)return;
     let parent=[];try{parent=JSON.parse(f.elements.parent.value);}catch{}
     f.querySelector('[type=submit]').disabled=true;
     try{const fresh=await v2.call('subject-places.folders.get',{});data.folders=await v2.call('subject-places.folders.post',{action:'create',path:[...parent,name],...v2.expect(fresh)});sheet.close();repaint();offerFolderUndo(data.folders,`Folder ${[...parent,name].join(' / ')} made.`);soon();}
     catch(error){f.querySelector('[type=submit]').disabled=false;v2.ui.say(error.message,{tone:'bad'});}
    });
   }
   /** A row's quiet menu: move it to another folder, or archive it. */
   function rowMenu(s){
    const f=form(`<label for="h3-move-to">Folder</label><select id="h3-move-to" name="to">${folderOptions(s.place.folder)}</select><div class="h3-form-acts h3-form-split"><button type="button" class="${CQ} h3-q" data-archive-now>Archive</button><span class="h3-grow"></span><button type="button" class="${CQ} h3-q" data-v2-close>Cancel</button><button type="submit" class="${CP} h3-pri">Move</button></div>`);
    const sheet=v2.ui.sheet({title:s.title,body:f});f.elements.to.focus();
    f.addEventListener('submit',e=>{e.preventDefault();let to=[];try{to=JSON.parse(f.elements.to.value);}catch{}sheet.close();void moveTo(s,to);});
    f.querySelector('[data-archive-now]').addEventListener('click',()=>{sheet.close();void setArchived(s,true);});
   }

   /* ---------- listening ---------- */
   root.addEventListener('click',e=>{
    const t=e.target.closest?.('button');if(!t||!root.contains(t)||t.closest('.v2-move'))return;
    if(t.matches('[data-home-new]'))return newSubject();
    if(t.dataset.fileIn)return fileSheet(t.dataset.fileIn);
    if(t.hasAttribute('data-file-more')){ui.allFile=true;return keepFocus(paintFile);}
    if(t.matches('[data-home-retry]')){t.disabled=true;t.textContent='Reading again…';void v2.needs.refresh();void readLeases();return void load();}
    if(t.dataset.groupBy){ui.group=t.dataset.groupBy;ui.open.clear();if(ui.group!=='folder')ui.arrange=false;keepPrefs(ui);return keepFocus(paintAll);}
    if(t.dataset.view){ui.view=t.dataset.view;keepPrefs(ui);return keepFocus(()=>{paintAll();applyCovers();});}
    if(t.dataset.station){const id=t.dataset.station;ui.station=ui.station===id?null:id;return keepFocus(()=>{paintAll();applyCovers();});}
    if(t.dataset.showAll){ui.open.add(t.dataset.showAll);return paintAll();}
    if(t.hasAttribute('data-arrange')){ui.arrange=!ui.arrange;return keepFocus(paintAll);}
    if(t.hasAttribute('data-archived')){ui.archived=!ui.archived;return keepFocus(paintAll);}
    if(t.hasAttribute('data-new-folder'))return newFolder();
    if(t.dataset.pin){const s=find(t.dataset.pin);if(s)void togglePin(s);return;}
    if(t.dataset.rowMenu){const s=find(t.dataset.rowMenu);if(s)rowMenu(s);return;}
    if(t.dataset.unarchive){const s=find(t.dataset.unarchive);if(s)void setArchived(s,false);return;}
   });
   root.addEventListener('input',e=>{if(e.target.matches?.('[data-home-find]')){ui.find=e.target.value;keepFocus(()=>{paintAll();applyCovers();});}});
   // Keep native drops, drawing the row ourselves so the preview has full contrast and follows the grab point.
   function previewRow(e,row){
    const transfer=e.dataTransfer;
    if(typeof transfer?.setDragImage!=='function')return;
    const blank=document.createElement('canvas');blank.width=blank.height=1;
    transfer.setDragImage(blank,0,0);
    const box=row.getBoundingClientRect(),offsetX=e.clientX-box.left,offsetY=e.clientY-box.top;
    const preview=document.createElement('div');
    preview.className='h3-row h3-row-preview';preview.innerHTML=row.innerHTML;
    preview.setAttribute('aria-hidden','true');preview.inert=true;
    preview.style.width=box.width+'px';
    const follow=event=>{preview.style.transform=`translate(${event.clientX-offsetX}px,${event.clientY-offsetY}px)`;};
    follow(e);root.append(preview);
    document.addEventListener('dragover',follow,true);
    dragPreview=()=>{document.removeEventListener('dragover',follow,true);preview.remove();dragPreview=null;};
   }
   // A subject dragged onto a folder's heading moves there, with Undo.
   root.addEventListener('dragstart',e=>{
    const r=e.target.closest?.('.h3-row,.h3-cover');
    if(r&&!r.draggable){e.preventDefault();return;}
    dragging=true;dragId=r?.dataset.id||null;
    if(r?.matches('.h3-row'))previewRow(e,r);
   },true);
   root.addEventListener('drop',()=>{dragging=false;dragPreview?.();},true);
   root.addEventListener('dragend',()=>{dragging=false;dragId=null;dragPreview?.();root.querySelectorAll('.h3-over').forEach(x=>x.classList.remove('h3-over'));});
   root.addEventListener('dragover',e=>{const h=e.target.closest?.('[data-drop-folder]');if(!dragId)return;root.querySelectorAll('.h3-over').forEach(x=>x!==h&&x.classList.remove('h3-over'));if(h){e.preventDefault();h.classList.add('h3-over');}});
   root.addEventListener('drop',e=>{const h=e.target.closest?.('[data-drop-folder]');if(!dragId||!h)return;e.preventDefault();const s=find(dragId);dragId=null;h.classList.remove('h3-over');
    let path=[];try{path=JSON.parse(h.closest('.h3-group')?.dataset.path||'[]');}catch{}if(s)void moveTo(s,path);});
   // What an assistant changes shows here without a reload. A photograph or piece changing makes the covers be read again.
   ctx.on({kinds:['subject-places*','study-draft*','study.human-direction*','study.outputs*','study.photos*','study.material*','instagram*','inquiries*','sources*','library*','recordings*','first-flow*','needs-you*','magazine*','study-ai*','words*','consent*','simmer*']},e=>{
    if(e?.reset)return;
    if(/^(study\.photos|study\.outputs)/.test(String(e?.kind||''))){coversStale=true;bindings=null;}
    if(/^(sources|library|study\.material|first-flow|instagram|study\.photos|study\.outputs)/.test(String(e?.kind||'')))unfiledStale=true;
    soon();
   });
   ctx.on({kinds:['lease*']},e=>{if(!e?.reset)void readLeases();});
   // A reset asks for everything to be read again; one that comes while the first reading is still under way is that reading.
   ctx.on({},e=>{if(e?.reset&&(data||failed)&&Date.now()-loadedAt>3000){coversStale=true;bindings=null;unfiledStale=true;void readLeases();soon();}});
   const stopNeeds=v2.needs.subscribe(result=>{
    if(ctx.signal.aborted||!root.isConnected)return;
    needs=result;
    keepFocus(paintNeeds);
   });
   ctx.setAdvanced({section:'home'});
   ctx.homeStop=()=>{dragPreview?.();stopNeeds();clearTimeout(timer);deskStops.forEach(f=>f());allStops.forEach(f=>f());coverRun++;};
   void readLeases();
   await load();
  },
  unmount(el,ctx){ctx.homeStop?.();void v2.desk.use(null);},
 });

 function carryingOn(leases){
  const working=new Map();
  for(const l of leases||[])if(String(l.actor||'').startsWith('agent:')&&Date.parse(l.expiresAt||0)>Date.now()){
   const name=v2.actorName(l.actor);working.set(name,(working.get(name)||0)+1);
  }
  return [...working].map(([name,count])=>`${name} is carrying on with ${plural(count,'thing')} by itself.`).join(' ');
 }

 v2.screen({id:'needs',title:'Needs you',route:'needs-you',
  render:()=>`<div class="v2-page v3-home h3-review"><header><div><a class="h3-back" href="${esc(v2.href())}">${icon('back')}Home</a><h1 class="h3-title" tabindex="-1">Needs you</h1></div></header><div class="h3-needs" data-needs-list><p class="h3-quiet" role="status">Reading what needs you…</p></div></div>`,
  async mount(el,ctx){
   const root=el.querySelector('.h3-review'),slot=root.querySelector('[data-needs-list]');
   const answeredHere=new Map(),changing=new Set(),saving=new Set(),askOrder=[],askBook=new Map();
   let leases=[],failed=false,loading=false,again=false;
   let requestedAsk=ctx.query.ask;
   /** The questions waiting, in the order they first appeared. One answered here keeps its place; one that is gone from
       the list because something else settled it drops out. */
   function syncAsks(needs){
    const fresh=new Map((needs.asks||[]).filter(a=>a.status==='open'||a.status==='defaulted').map(a=>[a.id,a]));
    for(const [id,a] of fresh){askBook.set(id,a);if(!askOrder.includes(id))askOrder.push(id);}
    for(let i=askOrder.length-1;i>=0;i--){const id=askOrder[i];if(!fresh.has(id)&&!answeredHere.has(id)&&!changing.has(id)&&!saving.has(id)){askOrder.splice(i,1);askBook.delete(id);}}
   }
   function paintNeeds(){
    const human=v2.isHuman(),shown=askOrder.map(id=>askBook.get(id)).filter(Boolean);
    const steer=shown.filter(a=>a.status==='open'&&a.band==='steer'&&a.default&&!answeredHere.has(a.id)).length;
    const carrying=[carryingOn(leases),steer?`${plural(steer,'question')} will take ${steer===1?'its':'their'} default unless you choose.`:''].filter(Boolean).join(' ');
    const rows=shown.map(a=>{
     const off=human?(saving.has(a.id)?' disabled':''):' disabled title="Only Adrian answers these."';
     const done=answeredHere.get(a.id)||(a.status==='defaulted'?{choice:a.resolution?.choice||a.default,auto:true}:null);
     const about=a.about?`<small class="h3-about">${esc(a.about)}</small>`:'';
     if(done&&!changing.has(a.id))return `<li class="ok" data-ask="${esc(a.id)}" tabindex="-1">${icon('check')}<p><span class="h3-state">${done.auto?'Applied by default':'Answered'}</span><b>${esc(a.question)}</b>${about}<span class="h3-said">${esc(done.choice||done.text||'')}</span></p><span class="h3-acts"><button type="button" class="${CQ} h3-q" data-ask-change="${esc(a.id)}"${off}>Change it</button></span></li>`;
     const recording=isRecordingAsk(a);
     const link=askLinks(a).map(({href,label})=>`<a class="h3-act" href="${esc(href)}">${esc(label)}${icon('right')}</a>`).join('');
     const current=done?.choice;
     const choices=recording?'':(a.choices||[]).map(c=>`<button type="button" class="${CB} h3-btn" data-ask-id="${esc(a.id)}" data-ask-choice="${esc(c)}"${current===c?' aria-pressed="true"':''}${off}>${esc(c)}${a.default===c&&!current?'<small>default</small>':''}</button>`).join('');
     const due=a.band==='steer'&&a.applyAt&&a.status==='open'?`<span class="h3-due">Takes its default ${esc(dueAt(a.applyAt))} unless you choose.</span>`:'';
     return `<li data-ask="${esc(a.id)}" tabindex="-1"><p><b>${esc(a.question)}</b>${about}${due}</p>${choices||link?`<span class="h3-acts">${choices}${link}</span>`:''}</li>`;
    }).join('');
    const active=document.activeElement,focused=slot.contains(active)?active:null;
    slot.innerHTML=`${failed?`<div><p class="h3-quiet" role="status">The list could not be read.</p><button type="button" class="${CB} h3-btn" data-ask-retry>Try again</button></div>`:''}${rows?`<ul>${rows}</ul>`:(failed?'':'<p class="h3-quiet">Nothing needs you right now.</p>')}${carrying?`<p class="h3-quiet">${esc(carrying)}</p>`:''}${rows&&!human?'<p class="h3-quiet h3-reason">Only Adrian answers these.</p>':''}`;
    if(focused?.isConnected===false){
     const id=focused.closest('[data-ask]')?.dataset.ask;
     const next=[...slot.querySelectorAll('[data-ask] button:not(:disabled),[data-ask] a')].find(b=>
      b.closest('[data-ask]').dataset.ask===id&&b.dataset.askChoice===focused.dataset.askChoice&&
      b.dataset.askChange===focused.dataset.askChange&&b.getAttribute('href')===focused.getAttribute('href'));
     const row=focused.matches('[data-ask]')?findAsk(id):null;
     (next||row||root.querySelector('h1')).focus({preventScroll:true});
    }
   }
   function findAsk(id){
    return [...slot.querySelectorAll('[data-ask]')].find(row=>row.dataset.ask===id);
   }
   async function answer(id,choice){
    if(!v2.isHuman()||!askBook.has(id)||saving.has(id))return;
    saving.add(id);
    for(const b of root.querySelectorAll('[data-ask] button'))if(b.closest('[data-ask]').dataset.ask===id)b.disabled=true;
    try{const saved=await v2.call('needs-you.answer',{id,choice});answeredHere.set(id,{choice:saved?.resolution?.choice||choice});changing.delete(id);
     if(ctx.signal.aborted)return;
     if(saved?.id===id)askBook.set(id,saved);saving.delete(id);paintNeeds();
     [...root.querySelectorAll('[data-ask-change]')].find(b=>b.dataset.askChange===id)?.focus({preventScroll:true});v2.needs.refresh();}
    catch(error){if(!ctx.signal.aborted)v2.ui.say(error.message,{tone:'bad'});}
    finally{saving.delete(id);if(!ctx.signal.aborted)for(const b of root.querySelectorAll('[data-ask] button'))if(b.closest('[data-ask]').dataset.ask===id)b.disabled=false;}
   }

   async function load(){
    if(loading){again=true;return;}
    loading=true;
    try{
     const [needs,work]=await Promise.all([readNeeds(),readLeases()]);
     if(ctx.signal.aborted)return;
     syncAsks(needs);leases=work?.leases||[];failed=false;
    }catch{failed=true;}
    finally{loading=false;}
    if(ctx.signal.aborted)return;
    paintNeeds();
    if(requestedAsk&&!failed){
     const row=findAsk(requestedAsk);
     requestedAsk=null;
     if(row&&(document.activeElement===el||document.activeElement===document.body)){
      row.focus({preventScroll:true});
      row.scrollIntoView?.({block:'nearest'});
     }
    }
    if(again){again=false;await load();}
   }
   root.addEventListener('click',e=>{
    const t=e.target.closest?.('button');
    if(!t||t.disabled)return;
    if(t.hasAttribute('data-ask-retry')){t.disabled=true;void load();}
    if(t.dataset.askChoice)return void answer(t.dataset.askId,t.dataset.askChoice);
    if(t.dataset.askChange&&v2.isHuman()){
     const id=t.dataset.askChange;changing.add(id);paintNeeds();
     [...root.querySelectorAll('[data-ask-choice]')].find(b=>b.dataset.askId===id)?.focus();
    }
   });
   ctx.on({kinds:['needs-you*','lease*']},e=>{if(!e?.reset)void load();});
   ctx.on({},e=>{if(e?.reset&&!loading)void load();});
   ctx.setAdvanced({section:'home'});
   await load();
  }
 });
})(window.v2);
