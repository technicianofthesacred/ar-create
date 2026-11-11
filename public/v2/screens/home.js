/* Version two: Home. "Needs you", "On your desk" and "Everything", on the app's real records only.
   Where every subject stands (its station, ring, next step, forms, when it last changed) comes from ONE read,
   subjects.standing, and nothing else: no per-subject reads, no list of projects. Where each subject lives (folder,
   tags, pin, archived, hand-set order in its folder, hand-set place on the desk) comes from subject-places, the folder
   list from subject-places.folders.get. Only the five covers on the desk are read one by one, after first paint. */
(function(v2){
 'use strict';
 if(!v2)return;
 const W=window,{esc,icon,ring}=v2.ui;

 const STATIONS=Object.freeze([
  {id:'gather',name:'Gather'},{id:'research',name:'Research'},{id:'create',name:'Create'},
  {id:'share',name:'Share'},{id:'published',name:'Published'},{id:'resting',name:'Resting'}].map(Object.freeze));
 const NAME=Object.fromEntries(STATIONS.map(s=>[s.id,s.name]));
 const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
 const quiet=p=>p.then(v=>v,()=>null);
 const fkey=path=>(path||[]).join('\u0001');
 const lower=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase();
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const DESK_MAX=5;

 /** The next step to show for a subject, or '' when it is not known. Never a guess: the read says "known" and names the
     step, or nothing is shown. The form is named only when the subject has more than one. */
 function nextOf(s){
  if(!s||!s.known||!s.next||typeof s.next.name!=='string'||!s.next.name)return '';
  if(s.station==='published'||s.station==='resting')return '';
  return s.next.formName&&(s.forms||[]).length>1?s.next.name+' · '+s.next.formName:s.next.name;
 }
 const sharedApi=Object.freeze({nextOf,STATIONS});
 try{let shared=v2.shared;if(!shared){try{v2.shared={};}catch{}shared=v2.shared;}if(shared&&typeof shared==='object')shared.home=sharedApi;}catch{}

 /* ======================= reading: five calls, whatever the number of subjects ======================= */
 const Standing={
  async list(){
   const [summary,places,folders,needs,leases]=await Promise.all([
    v2.call('subjects.standing',{}),v2.call('subject-places',{}),v2.call('subject-places.folders.get',{}),
    quiet(v2.call('needs-you',{status:'pending'})),quiet(v2.call('leases',{}))]);
   const placeOf=new Map((places?.places||[]).map(p=>[p.parentStudyId,p]));
   const unplaced=id=>({parentStudyId:id,folder:[],tags:[],pinnedAt:null,archived:false,order:null,deskOrder:null,revision:0,saved:false});
   const subjects=(summary?.subjects||[]).filter(x=>x&&typeof x.id==='string'&&x.id).map(x=>{
    const place=placeOf.get(x.id)||unplaced(x.id);
    return {...x,title:String(x.title||'').trim()||'Untitled subject',forms:x.forms||[],place,archived:!!(x.archived||place.archived)};
   });
   return {subjects,folders,needs,leases:leases?.leases||[],readAt:Date.now(),ms:summary?.ms};
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
  if(d.toDateString()===new Date(now-864e5).toDateString())return 'Yesterday';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',...(d.getFullYear()!==today.getFullYear()?{year:'numeric'}:{})});
 }
 function dueAt(iso){const t=Date.parse(iso||'');if(!Number.isFinite(t))return 'soon';const d=new Date(t),clock=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});return when(iso)==='Today'?'at '+clock:'on '+when(iso)+' at '+clock;}
 const today=()=>{const d=new Date(),part=o=>d.toLocaleDateString('en-GB',o);return part({weekday:'long'})+' '+part({day:'numeric',month:'short',year:'numeric'});};
 const subjectHref=id=>v2.href('subject/:id',{id});
 const folderPath=path=>['Subjects',...path].join(' / ');
 const expectPlace=p=>({expectedRevision:p?.revision||0,...(p?.saved&&p.hash?{expectedHash:p.hash}:{})});
 const V2Client=W.V2Client;
 const uuid=()=>{try{return crypto.randomUUID();}catch{return V2Client?.uuid?.()||String(Date.now());}};
 // The controls a repaint must hand focus back to, by what they are and which subject they belong to.
 const FOCUS_KEYS=['data-pin','data-v2-up','data-v2-down','data-row-menu','data-group-by','data-view','data-station','data-arrange','data-archived','data-show-all','data-home-find','data-file-in','data-file-more','data-ask-change','data-ask-choice','data-unarchive'];

 /* ======================= the screen ======================= */
 v2.screen({id:'home',title:'Home',route:'',
  render:()=>`<div class="v2-page home" data-home>
 <header><div><h1>Home</h1><p>${esc(today())}</p></div><button type="button" class="home-new" data-home-new>${icon('plus')}New subject</button></header>
 <div class="home-needs-slot" data-home-needs></div>
 <section class="home-desk" data-home-desk aria-labelledby="home-desk-h" hidden></section>
 <section class="home-file" data-home-file aria-labelledby="home-file-h" hidden></section>
 <section class="home-all" data-home-all aria-labelledby="home-all-h"><div class="home-sec-h"><h2 id="home-all-h">Everything</h2></div><p class="home-quiet" data-home-loading>Reading your subjects…</p></section>
</div>`,
  async mount(el,ctx){
   const root=el.querySelector('[data-home]');if(!root)return;
   const ui={...prefs(),station:null,find:'',open:new Set(),archived:false,arrange:false,allAsks:false,allFile:false};
   let data=null,failed=null,loading=null,again=false,loadedAt=0,timer=0,dragId=null,dragging=false,deskStops=[],allStops=[],repaintWaiting=false;
   // Needs you: a question answered here stays in its place, marked answered, until he leaves the page.
   const answeredHere=new Map(),changing=new Set(),askOrder=[],askBook=new Map(),lookRoles=new Map(),lookNames=new Map();
   // Covers of the desk's cards: subject id to an address, or '' when it has no chosen photograph. Read after first paint.
   const covers=new Map();let coverRun=0,bindings=null,coversStale=false;
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
     void readCovers();void readLooks();void readUnfiled();
     if(again){again=false;void load();}
    })();
    return loading;
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
    const run=++coverRun,want=desk().map(s=>s.id).filter(id=>coversStale||!covers.has(id));coversStale=false;
    if(!want.length)return applyCovers();
    if(!bindings||want.some(id=>!bindings.has(id))){
     const catalog=await quiet(v2.call('study-draft.catalog',{}));
     bindings=new Map((catalog?.collections||[]).filter(c=>c?.parentStudyId&&c?.bindingId).map(c=>[c.parentStudyId,c.bindingId]));
    }
    await Promise.all(want.map(async id=>{
     const binding=bindings.get(id);let url='';
     if(binding){
      const out=await quiet(v2.call('study.outputs',{parentStudyId:id,rootBindingId:binding})),scope=out?.photoScope;
      const photos=scope?.projectId&&scope?.documentId?await quiet(v2.call('study.photos.inspect',{projectId:scope.projectId,documentId:scope.documentId,bindingId:binding,parentStudyId:id})):null;
      const first=(photos?.photos||[]).find(p=>p&&p.selected!==false&&!p.missing&&!p.previewUnavailable&&typeof p.url==='string'&&p.url.startsWith('/api/study/photos/preview?'));
      if(first){const u=new URL(first.url,location.origin);if(!u.searchParams.has('bindingId'))u.searchParams.set('bindingId',binding);if(!u.searchParams.has('parentStudyId'))u.searchParams.set('parentStudyId',id);url=u.pathname+u.search;}
     }
     covers.set(id,url);
    }));
    if(ctx.signal.aborted||run!==coverRun)return;
    applyCovers();void v2.desk.refresh();
   }
   /** Put each known cover where its subject is shown, in place; nothing else on the page is touched. */
   function applyCovers(){
    for(const node of root.querySelectorAll('.home-card[data-id],.home-cover[data-id],.home-row[data-id]')){
     const url=covers.get(node.dataset.id);if(!url)continue;
     const pic=node.querySelector('.home-card-pic,.home-cover-pic,.home-row-pic');
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
    for(const h of root.querySelectorAll('.home-group>header[data-drop-folder]')){
     let path=[];try{path=JSON.parse(h.parentElement.dataset.path||'[]');}catch{}
     h.querySelector('.home-dot')?.remove();const dot=folderDot(path),grip=h.querySelector('.home-grip');if(dot){if(grip)grip.insertAdjacentHTML('afterend',dot);else h.insertAdjacentHTML('afterbegin',dot);}
    }
   }
   function folderDot(path){if(!path?.length)return '';const id=folderLook(path),a=id&&accentOf(id);return !a?'<i class="home-dot" aria-hidden="true"></i>':`<i class="home-dot" style="--home-dot:${esc(a)}" title="${esc(lookNames.get(id)?'Drawn in the '+lookNames.get(id)+' look':'Drawn in one look')}" aria-hidden="true"></i>`;}
   function accentOf(id){const roles=lookRoles.get(id),a=roles?.[v2.theme()==='dark'?'dark':'light']?.accent||roles?.dark?.accent;return typeof a==='string'&&/^#[0-9a-f]{3,8}$/i.test(a)?a:null;}

   /* ---------- to file: captures the sheet left in the Library with no subject ---------- */
   // The capture sheet with no subject open saves into the Library's own top folder ("to file later"). Those are the files
   // sitting there that no subject lists as its material: sources.tree for the files, library.source-projects for who uses
   // which. Quiet when both cannot be read or nothing is waiting; the block is only there when there is something to file.
   const FILE_CUT=5;
   let unfiled=[],filing=new Set();
   async function readUnfiled(){
    const [tree,used]=await Promise.all([quiet(v2.call('sources.tree',{})),quiet(v2.call('library.source-projects',{}))]);
    if(ctx.signal.aborted)return;
    const library=(tree?.roots||[]).find(r=>r?.id==='library'),top=library?.tree?.files;
    if(!Array.isArray(top)||!used||!Array.isArray(used.projects)){unfiled=[];return paintFile();}
    const taken=new Set(used.projects.flatMap(p=>p.sourceIds||[]));
    unfiled=top.filter(f=>f&&typeof f.id==='string'&&f.id&&!f.missing&&!taken.has(f.id)).sort((a,b)=>String(b.provenance?.capturedAt||b.modified_at||'').localeCompare(String(a.provenance?.capturedAt||a.modified_at||'')));
    paintFile();
   }
   function paintFile(){
    const sec=root.querySelector('[data-home-file]');if(!sec||ctx.signal.aborted)return;
    if(!unfiled.length||!live().length){sec.hidden=true;sec.innerHTML='';return;}
    const show=ui.allFile?unfiled:unfiled.slice(0,FILE_CUT),more=unfiled.length-show.length,lib=v2.advanced({section:'library'});
    sec.hidden=false;
    sec.innerHTML=`<div class="home-sec-h"><h2 id="home-file-h">To file</h2><span>${plural(unfiled.length,'capture')} in the Library, not with a subject yet</span></div>
<ul class="home-file-list">${show.map(f=>`<li data-source="${esc(f.id)}"><span class="home-file-name">${esc(f.rel_path||f.name||'Untitled')}</span><small>${esc(when(f.provenance?.capturedAt||f.modified_at))}</small><span class="home-file-acts"><button type="button" class="v2-ghost" data-file-in="${esc(f.id)}">File in a subject</button><a class="home-act" href="${esc(lib)}">See it in Advanced</a></span></li>`).join('')}</ul>
${more>0?`<button type="button" class="v2-ghost home-more" data-file-more>Show ${more} more</button>`:''}`;
   }
   /** File one capture with a subject, as the Capture sheet does: study.material.attach, else first-flow.attach. */
   function fileSheet(id){
    const item=unfiled.find(f=>f.id===id);if(!item)return;
    const subjects=live().slice().sort(byName);
    const f=form(`<label for="home-file-to">Subject</label><select id="home-file-to" name="subject">${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')}</select><p class="home-quiet">${esc(item.rel_path||item.name||'')}</p>${formActs('File it')}`);
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
      sheet.close();unfiled=unfiled.filter(x=>x.id!==id);paintFile();v2.ui.say(`Filed in "${subject.title}".`,{tone:'good'});void readUnfiled();
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
   function holder(id){const l=(data?.leases||[]).find(x=>x?.scope?.id===id&&x.actor&&x.actor!==v2.actor()&&Date.parse(x.expiresAt||0)>Date.now());return l?v2.actorName(l.actor):'';}
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
    const t=s=>Date.parse(s.changedAt||'')||0;
    return [{key:'r:',name:'Most recent first',total:all.length,items:rows.sort((a,b)=>t(b)-t(a)||byName(a,b))}];
   }
   const canArrange=()=>ui.group==='folder'&&!ui.find&&!ui.station;
   function folderLook(path){const looks=new Set(live().filter(s=>fkey(s.place.folder)===fkey(path)&&s.look).map(s=>s.look));return looks.size===1?[...looks][0]:null;}

   /* ---------- painting ---------- */
   /** Draw again, then give focus back to the same control of the same subject, if it is still there. */
   function keepFocus(draw){
    const a=document.activeElement,inside=a&&root.contains(a);
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
     root.querySelector('[data-home-needs]').innerHTML='';root.querySelector('[data-home-desk]').hidden=true;
     root.querySelector('[data-home-all]').innerHTML=`<div class="home-sec-h"><h2 id="home-all-h">Everything</h2></div><div class="home-empty" data-home-error><p>${esc(failed.message||'The app could not be reached. Nothing was changed.')}</p><button type="button" data-home-retry>Try again</button></div>`;
     return;
    }
    if(!data)return;
    if(failed)v2.ui.say('Home could not be read again just now. What is shown is from '+new Date(data.readAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'.',{tone:'warn',timeout:8000});
    keepFocus(()=>{paintNeeds();paintDesk();paintFile();paintAll();applyCovers();});
   }

   /** The questions waiting, in the order they first appeared. One answered here keeps its place; one that is gone from
       the list because something else settled it drops out. */
   function syncAsks(){
    const fresh=new Map((data.needs?.asks||[]).filter(a=>a.status==='open'||a.status==='defaulted').map(a=>[a.id,a]));
    for(const [id,a] of fresh){askBook.set(id,a);if(!askOrder.includes(id))askOrder.push(id);}
    for(let i=askOrder.length-1;i>=0;i--){const id=askOrder[i];if(!fresh.has(id)&&!answeredHere.has(id)&&!changing.has(id)){askOrder.splice(i,1);askBook.delete(id);}}
   }
   function paintNeeds(){
    const slot=root.querySelector('[data-home-needs]'),human=v2.isHuman();syncAsks();
    const shown=askOrder.map(id=>askBook.get(id)).filter(Boolean);
    const working=new Map();for(const l of data.leases||[])if(String(l.actor||'').startsWith('agent:')&&Date.parse(l.expiresAt||0)>Date.now()){const n=v2.actorName(l.actor);working.set(n,(working.get(n)||0)+1);}
    const steer=shown.filter(a=>a.status==='open'&&a.band==='steer'&&a.default&&!answeredHere.has(a.id)).length;
    const carrying=([...working].map(([n,c])=>`${n} is carrying on with ${plural(c,'thing')} by itself.`).join(' ')+(steer?` ${plural(steer,'question')} will take ${steer===1?'its':'their'} default unless you choose.`:'')).trim();
    const off=human?'':' disabled title="Only Adrian answers these."';
    if(!shown.length){slot.innerHTML=carrying?`<p class="home-quiet home-carry">${esc(carrying)}</p>`:'';return;}
    const cut=ui.allAsks?shown.length:3,more=shown.length-cut;
    const rows=shown.slice(0,cut).map(a=>{
     const done=answeredHere.get(a.id)||(a.status==='defaulted'?{choice:a.resolution?.choice||a.default,auto:true}:null);
     const about=a.about?`<small class="home-about">${esc(a.about)}</small>`:'';
     if(done&&!changing.has(a.id))return `<li class="ok" data-ask="${esc(a.id)}">${icon('check')}<p><span class="home-state">${done.auto?'Applied by default':'Answered'}</span><b>${esc(a.question)}</b>${about}<span class="home-said">${esc(done.choice||done.text||'')}</span></p><span class="home-acts"><button type="button" data-ask-change="${esc(a.id)}"${off}>Change it</button></span></li>`;
     const recording=['recording-words','recording-check'].includes(a.scope?.kind);
     let href=recording?(a.recording?.wordsHref||a.wordsHref||a.link?.href):a.link?.href;
     if(typeof href==='string'&&href.startsWith('#'))href='/document-study/index.html'+href;
     const link=typeof href==='string'&&/^\/(?!\/)/.test(href)?`<a class="home-act" href="${esc(href)}">${esc(recording?'Go through them':a.link?.label||'Open')}${icon('right')}</a>`:'';
     const current=done?.choice;
     const choices=recording?'':(a.choices||[]).map(c=>`<button type="button" data-ask-id="${esc(a.id)}" data-ask-choice="${esc(c)}"${current===c?' aria-pressed="true"':''}${off}>${esc(c)}${a.default===c&&!current?'<small>default</small>':''}</button>`).join('');
     const due=a.band==='steer'&&a.applyAt&&a.status==='open'?`<span class="home-due">Takes its default ${esc(dueAt(a.applyAt))} unless you choose.</span>`:'';
     return `<li data-ask="${esc(a.id)}"><p><b>${esc(a.question)}</b>${about}${due}</p>${choices||link?`<span class="home-acts">${choices}${link}</span>`:''}</li>`;
    }).join('');
    slot.innerHTML=`<section class="home-needs" aria-labelledby="home-needs-h"><h2 class="home-label" id="home-needs-h">${icon('ask')}Needs you</h2><ul>${rows}</ul>${more>0?`<button type="button" class="v2-ghost home-more" data-all-asks>Show all ${shown.length}${icon('chev')}</button>`:''}${carrying?`<p class="home-quiet">${esc(carrying)}</p>`:''}${human?'':'<p class="home-quiet home-reason">Only Adrian answers these.</p>'}</section>`;
   }

   function card(s){
    const who=holder(s.id),url=covers.get(s.id),next=nextOf(s);
    return `<article class="home-card" data-id="${esc(s.id)}"><i class="home-grip" aria-hidden="true"></i>
 <a class="home-card-open" href="${esc(subjectHref(s.id))}"><span class="home-card-pic${url?' has-img':''}" aria-hidden="true">${url?`<img src="${esc(url)}" alt="">`:''}</span><b>${esc(s.title)}</b><span class="home-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span>${who?`<small class="home-held">${esc(who)} is working on it</small>`:''}</a>
 <a class="home-card-next" href="${esc(subjectHref(s.id))}"${s.next?.note&&next?` title="${esc(s.next.note)}"`:''}><span>${esc(next||'Open')}</span>${icon('right')}</a>
</article>`;
   }
   function paintDesk(){
    const sec=root.querySelector('[data-home-desk]'),items=desk();
    deskStops.forEach(f=>f());deskStops=[];
    if(!live().length){sec.hidden=true;sec.innerHTML='';return;}
    sec.hidden=false;
    if(!items.length){sec.innerHTML=`<div class="home-sec-h"><h2 id="home-desk-h">On your desk</h2></div><p class="home-quiet">Nothing on your desk yet.</p>`;return;}
    sec.innerHTML=`<div class="home-sec-h"><h2 id="home-desk-h">On your desk</h2><span>${items.length} · what you are working on now. Drag to reorder.</span></div><div class="home-cards" data-home-cards>${items.map(card).join('')}</div>`;
    const box=sec.querySelector('[data-home-cards]');
    deskStops.push(v2.ui.reorder(box,{item:'.home-card',label:el=>el.querySelector('b')?.textContent||'Subject',
     // The order is read from the screen at the press, not from what was painted earlier.
     onMove:()=>queueOrder('desk',[...box.querySelectorAll(':scope>.home-card')].map(x=>x.dataset.id))}));
   }

   const tagsOf=s=>{const tags=s.place.tags||[],extra=tags.length-TAGS_SHOWN;return `<span class="home-tags">${tags.slice(0,TAGS_SHOWN).map(t=>`<i>${esc(t)}</i>`).join('')}${extra>0?`<i class="home-tag-more" title="${esc(tags.slice(TAGS_SHOWN).join(', '))}">+${extra}</i>`:''}</span>`;};
   const pinBtn=s=>{const on=!!s.place.pinnedAt;return `<button type="button" class="v2-ghost v2-icon-btn home-pin" data-pin="${esc(s.id)}" aria-pressed="${on}" aria-label="${on?'Take off your desk':'Put on your desk'}: ${esc(s.title)}" title="${on?'On your desk':'Put on your desk'}">${PIN}</button>`;};
   const menuBtn=s=>`<button type="button" class="v2-ghost v2-icon-btn home-rowmenu" data-row-menu="${esc(s.id)}" aria-label="Move or archive: ${esc(s.title)}" title="Move or archive">${MORE}</button>`;
   const rowPic=s=>{const url=covers.get(s.id);return `<span class="home-row-pic${url?' has-img':''}" aria-hidden="true">${url?`<img src="${esc(url)}" alt="">`:''}</span>`;};
   function row(s){
    const who=holder(s.id);
    return `<li class="home-row" data-id="${esc(s.id)}"><i class="home-grip" aria-hidden="true"></i>
 <a class="home-row-open" href="${esc(subjectHref(s.id))}">${rowPic(s)}<b>${esc(s.title)}</b>${tagsOf(s)}<span class="home-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span><span class="home-next">${who?`<em class="home-held">${esc(who)} is working on it</em>`:esc(nextOf(s))}</span><small>${esc(when(s.changedAt))}</small></a>
 ${menuBtn(s)}${pinBtn(s)}
</li>`;
   }
   const cover=s=>{const url=covers.get(s.id);return `<li class="home-cover" data-id="${esc(s.id)}"><a href="${esc(subjectHref(s.id))}"><span class="home-cover-pic${url?' has-img':''}" aria-hidden="true"${url?'':' hidden'}>${url?`<img src="${esc(url)}" alt="">`:''}</span><b>${esc(s.title)}</b><span class="home-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span></a>${menuBtn(s)}${pinBtn(s)}</li>`;};
   function stationCounts(){const c={};for(const s of live())c[s.station]=(c[s.station]||0)+1;return c;}

   function paintAll(){
    const sec=root.querySelector('[data-home-all]'),all=live(),archived=(data.subjects||[]).filter(s=>s.archived);
    allStops.forEach(f=>f());allStops=[];
    const counts=stationCounts(),gs=all.length?groups():[],arrange=canArrange();
    const list=gs.map(g=>{
     const cut=ui.find||ui.open.has(g.key)?Infinity:ui.view==='covers'?12:CUT[ui.group],items=g.items.slice(0,cut),more=g.items.length-items.length,folder=ui.group==='folder'&&!g.loose;
     const count=!g.items.length?'Empty':ui.find||ui.station?`${g.items.length} of ${g.total}`:g.total;
     const head=`<header${ui.group==='folder'?` data-drop-folder`:''}>${folder&&g.saved?'<i class="home-grip" aria-hidden="true"></i>':''}${folder?folderDot(g.path):''}<h3>${esc(g.name)}</h3><span>${esc(count)}</span>${folder?`<small class="home-path" title="A real folder">${esc(folderPath(g.path))}</small>`:''}</header>`;
     const body=!items.length?'':ui.view==='covers'?`<ul class="home-covers" data-group="${esc(g.key)}">${items.map(cover).join('')}</ul>`:`<ul class="home-rows" data-group="${esc(g.key)}">${items.map(row).join('')}</ul>`;
     return `<section class="home-group${items.length?'':' home-empty-folder'}" data-key="${esc(g.key)}"${folder&&g.saved?' data-saved':''}${g.path?` data-path="${esc(JSON.stringify(g.path))}"`:''}>${head}${body}${more>0?`<button type="button" class="v2-ghost home-more" data-show-all="${esc(g.key)}">Show all ${g.items.length}${icon('chev')}</button>`:''}</section>`;
    }).join('');
    const empty=!all.length?`<div class="home-empty"><p>${archived.length?'Every subject is archived.':'No subjects yet.'}</p><button type="button" class="pri" data-home-new>${icon('plus')}New subject</button></div>`
     :!gs.length?`<p class="home-quiet">No subject matches${ui.find?` "${esc(ui.find)}"`:''}${ui.station?' in '+esc(NAME[ui.station]):''}.</p>`:'';
    const archive=archived.length?`<div class="home-archived"><button type="button" class="v2-ghost" data-archived aria-expanded="${ui.archived}">${ui.archived?'Hide archived':'Archived'} · ${archived.length}</button>${ui.archived?`<ul class="home-rows">${archived.sort(byName).map(s=>`<li class="home-row" data-id="${esc(s.id)}"><a class="home-row-open" href="${esc(subjectHref(s.id))}">${rowPic(s)}<b>${esc(s.title)}</b>${tagsOf(s)}<span class="home-st">${ring(s.ring)}${esc(s.stationName||NAME[s.station]||'')}</span><span class="home-next"></span><small>${esc(when(s.changedAt))}</small></a><button type="button" class="v2-ghost home-unarchive" data-unarchive="${esc(s.id)}">Put back</button></li>`).join('')}</ul>`:''}</div>`:'';
    sec.innerHTML=`<div class="home-sec-h"><h2 id="home-all-h">Everything</h2><span>${plural(all.length,'subject')}</span>${all.length?`<label class="home-find"><span class="home-sr">Find a subject</span>${icon('search')}<input type="search" data-home-find placeholder="Find a subject" value="${esc(ui.find)}" autocomplete="off"></label>`:''}</div>
${all.length?`<div class="home-tools">
 <div class="home-seg" role="group" aria-label="Group">${GROUPS.map(([k,l])=>`<button type="button" data-group-by="${k}" aria-pressed="${ui.group===k}">${l}</button>`).join('')}</div>
 <div class="home-chips" role="group" aria-label="Show one station">${STATIONS.map(st=>`<button type="button" data-station="${st.id}" aria-pressed="${ui.station===st.id}">${st.name}<small>${counts[st.id]||0}</small></button>`).join('')}</div>
 <span class="home-grow"></span>
  <div class="home-seg" role="group" aria-label="View">${[['rows','Rows'],['covers','Covers']].map(([k,l])=>`<button type="button" data-view="${k}" aria-pressed="${ui.view===k}">${l}</button>`).join('')}</div>
</div>`:''}
${empty}<div class="home-groups" data-home-groups>${list}</div>
${all.length&&ui.group==='folder'?`<div class="home-foot"><button type="button" data-new-folder>${icon('plus')}New folder</button><span class="home-quiet">Folders here are the real folders on disk. Drag a folder to change the order, or a subject onto a folder to move it. Tags cut across folders.</span></div>`:''}${archive}`;
    if(!arrange)return;
    // Drag, and Move up and Move down: subjects inside a folder (rows or covers), and the folders themselves. The new
    // order is read from the screen at the moment of the press.
    for(const ul of sec.querySelectorAll('.home-rows[data-group],.home-covers[data-group]')){
     const g=gs.find(x=>x.key===ul.dataset.group);if(!g)continue;
     const sel=ul.classList.contains('home-covers')?'.home-cover':'.home-row';
     allStops.push(v2.ui.reorder(ul,{item:sel,label:el=>el.querySelector('b')?.textContent||'Subject',
      onMove:()=>{const shown=[...ul.querySelectorAll(':scope>'+sel)].map(x=>x.dataset.id);
       // Those cut off by "Show all" keep their places after the ones shown.
       const rest=inFolder(g.path).map(s=>s.id).filter(id=>!shown.includes(id));
       return queueOrder('folder',[...shown,...rest]);}}));
    }
    const box=sec.querySelector('[data-home-groups]');
    allStops.push(v2.ui.reorder(box,{item:'.home-group[data-saved]',label:el=>el.querySelector('h3')?.textContent||'Folder',onMove:()=>{
     const shown=[...box.querySelectorAll(':scope>.home-group[data-saved]')].map(x=>{try{return JSON.parse(x.dataset.path);}catch{return null;}}).filter(Boolean);
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
   async function answer(id,choice){
    if(!askBook.has(id))return;
    for(const b of root.querySelectorAll('[data-ask] button'))if(b.closest('[data-ask]').dataset.ask===id)b.disabled=true;
    try{const saved=await v2.call('needs-you.answer',{id,choice});answeredHere.set(id,{choice:saved?.resolution?.choice||choice});changing.delete(id);
     if(saved?.id===id)askBook.set(id,saved);paintNeeds();
     [...root.querySelectorAll('[data-ask-change]')].find(b=>b.dataset.askChange===id)?.focus({preventScroll:true});v2.needs.refresh();}
    catch(error){v2.ui.say(error.message,{tone:'bad'});paintNeeds();}
   }
   function form(markup){const f=document.createElement('form');f.className='home-form';f.innerHTML=markup;return f;}
   const formActs=label=>`<div class="home-form-acts"><button type="button" class="v2-ghost" data-v2-close>Cancel</button><button type="submit" class="pri home-primary">${esc(label)}</button></div>`;
   function newSubject(){
    const f=form(`<label for="home-new-name">Subject name</label><input id="home-new-name" name="name" maxlength="160" required autocomplete="off" placeholder="What is it about?">${formActs('Create subject')}`);
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
    const f=form(`<label for="home-folder-name">Name</label><input id="home-folder-name" name="name" maxlength="80" required autocomplete="off"><label for="home-folder-in">Inside</label><select id="home-folder-in" name="parent">${folderOptions([])}</select>${formActs('Make the folder')}`);
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
    const f=form(`<label for="home-move-to">Folder</label><select id="home-move-to" name="to">${folderOptions(s.place.folder)}</select><div class="home-form-acts home-form-split"><button type="button" class="v2-ghost" data-archive-now>Archive</button><span class="home-grow"></span><button type="button" class="v2-ghost" data-v2-close>Cancel</button><button type="submit" class="pri">Move</button></div>`);
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
    if(t.matches('[data-home-retry]')){t.disabled=true;t.textContent='Reading again…';return void load();}
    if(t.dataset.groupBy){ui.group=t.dataset.groupBy;ui.open.clear();if(ui.group!=='folder')ui.arrange=false;keepPrefs(ui);return keepFocus(paintAll);}
    if(t.dataset.view){ui.view=t.dataset.view;keepPrefs(ui);return keepFocus(()=>{paintAll();applyCovers();});}
    if(t.dataset.station){const id=t.dataset.station;ui.station=ui.station===id?null:id;return keepFocus(()=>{paintAll();applyCovers();});}
    if(t.dataset.showAll){ui.open.add(t.dataset.showAll);return paintAll();}
    if(t.hasAttribute('data-all-asks')){ui.allAsks=true;return paintNeeds();}
    if(t.hasAttribute('data-arrange')){ui.arrange=!ui.arrange;return keepFocus(paintAll);}
    if(t.hasAttribute('data-archived')){ui.archived=!ui.archived;return keepFocus(paintAll);}
    if(t.hasAttribute('data-new-folder'))return newFolder();
    if(t.dataset.pin){const s=find(t.dataset.pin);if(s)void togglePin(s);return;}
    if(t.dataset.rowMenu){const s=find(t.dataset.rowMenu);if(s)rowMenu(s);return;}
    if(t.dataset.unarchive){const s=find(t.dataset.unarchive);if(s)void setArchived(s,false);return;}
    if(t.dataset.askChoice)return void answer(t.dataset.askId,t.dataset.askChoice);
    // Change it: the row stays where it is and offers its choices again. A later answer replaces the earlier one.
    if(t.dataset.askChange){const id=t.dataset.askChange;changing.add(id);paintNeeds();return [...root.querySelectorAll('[data-ask-choice]')].find(b=>b.dataset.askId===id)?.focus();}
   });
   root.addEventListener('input',e=>{if(e.target.matches?.('[data-home-find]')){ui.find=e.target.value;keepFocus(()=>{paintAll();applyCovers();});}});
   // A subject dragged onto a folder's heading moves there, with Undo.
   root.addEventListener('dragstart',e=>{dragging=true;const r=e.target.closest?.('.home-row,.home-cover');dragId=r&&root.contains(r)?r.dataset.id:null;},true);
   root.addEventListener('drop',()=>{dragging=false;},true);
   root.addEventListener('dragend',()=>{dragging=false;dragId=null;root.querySelectorAll('.home-over').forEach(x=>x.classList.remove('home-over'));});
   root.addEventListener('dragover',e=>{const h=e.target.closest?.('[data-drop-folder]');if(!dragId||!h)return;e.preventDefault();root.querySelectorAll('.home-over').forEach(x=>x!==h&&x.classList.remove('home-over'));h.classList.add('home-over');});
   root.addEventListener('drop',e=>{const h=e.target.closest?.('[data-drop-folder]');if(!dragId||!h)return;e.preventDefault();const s=find(dragId);dragId=null;h.classList.remove('home-over');
    let path=[];try{path=JSON.parse(h.closest('.home-group')?.dataset.path||'[]');}catch{}if(s)void moveTo(s,path);});
   // What an assistant changes shows here without a reload. A photograph or piece changing makes the covers be read again.
   ctx.on({kinds:['subject-places*','study-draft*','study.human-direction*','study.outputs*','study.photos*','study.material*','instagram*','inquiries*','sources*','library*','recordings*','first-flow*','needs-you*','lease*','magazine*','study-ai*','words*','consent*','simmer*']},e=>{
    if(e?.reset)return;
    if(/^(study\.photos|study\.outputs)/.test(String(e?.kind||''))){coversStale=true;bindings=null;}
    soon();
   });
   // A reset asks for everything to be read again; one that comes while the first reading is still under way is that reading.
   ctx.on({},e=>{if(e?.reset&&(data||failed)&&Date.now()-loadedAt>3000){coversStale=true;bindings=null;soon();}});
   ctx.setAdvanced({section:'home'});
   ctx.homeStop=()=>{clearTimeout(timer);deskStops.forEach(f=>f());allStops.forEach(f=>f());coverRun++;};
   await load();
  },
  unmount(el,ctx){ctx.homeStop?.();void v2.desk.use(null);},
 });
})(window.v2);
