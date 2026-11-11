/* Version two: Home. "Needs you", "On your desk" and "Everything", on the app's real records only.
   Subjects come from the saved collections (study-draft.catalog); where each one lives (folder, tags, pin, archived,
   hand-set order in its folder, hand-set place on the desk) from subject-places; the folder list from
   subject-places.folders.get. Where a subject stands (Gather, Research, Create, Share, Published, Resting) is worked
   out by one pure function, station(facts), shared with the Subject screen as v2.shared.home.station (and
   window.v2HomeStations.station while the shell's v2 has no v2.shared). Every read of where subjects stand goes
   through one object, Standing, below: when the app gains one summary of every subject, only Standing changes. */
(function(v2){
 'use strict';
 if(!v2)return;
 const W=window,{esc,icon,ring}=v2.ui;

 /* ======================= where a subject stands: one pure function ======================= */
 const STATIONS=Object.freeze([
  {id:'gather',name:'Gather'},{id:'research',name:'Research'},{id:'create',name:'Create'},
  {id:'share',name:'Share'},{id:'published',name:'Published'},{id:'resting',name:'Resting'}].map(Object.freeze));
 const NAME=Object.fromEntries(STATIONS.map(s=>[s.id,s.name]));
 /** A subject is resting when nothing in its records has changed for this many days, or its Article is marked Paused. */
 const RESTING_DAYS=60;
 const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
 const known=v=>v!==undefined&&v!==null;
 /**
  * Where a subject stands, from facts its records hold. A fact left out (undefined or null) is not known, and a next
  * step that depends on it is not shown: '' means "no next step we can vouch for", never a guess.
  *   material      number of sources gathered for it (0 when it is known to have none)
  *   research      number of research topics over that material
  *   direction     true or false when its direction has been read
  *   article       true when it has an Article; suggestions (waiting for him) when read; articleStatus when recorded:
  *                 draft, in-progress, review-needed, correction-needed, complete, paused
  *   carousel      null, or {chosen: a story was chosen, ready: Ready to post was given}
  *   published     true when a publication is recorded
  *   asks          open questions on "Needs you" about it
  *   changedAt     ISO time of the newest change its records show
  * Returns {station, name, ring (0 to 1), next (plain words, or ''), section (the place in Advanced)}.
  */
 function station(facts={},now=Date.now()){
  const f=facts&&typeof facts==='object'?facts:{};
  const n=v=>Math.max(0,Number(v)||0),status=String(f.articleStatus||'');
  const changed=Date.parse(f.changedAt||''),idle=Number.isFinite(changed)?(now-changed)/864e5:0;
  let out;
  if(f.published)out={station:'published',ring:1,next:'',section:'outputs'};
  else if(status==='paused'||idle>=RESTING_DAYS)out={station:'resting',ring:0,next:'',section:''};
  else if(f.carousel?.ready)out={station:'share',ring:.9,next:'Post the Carousel',section:'share'};
  else if(f.article&&status==='complete')out={station:'share',ring:.85,next:'See it as the audience',section:'audience'};
  else if(f.article&&status==='review-needed')out={station:'share',ring:.8,next:'Review it',section:'audience'};
  else if(f.article){
   // Whether an Article is half written or finished is not in its records; only what is waiting on him is certain.
   const waiting=n(f.suggestions);
   out={station:'create',ring:.6,section:'write',next:status==='correction-needed'?'Correct the Article':waiting?'Look at '+plural(waiting,'suggestion'):''};
  }
  else if(f.carousel)out={station:'create',ring:.6,next:f.carousel.chosen?'Make the slides':'Choose a story',section:'arrange'};
  else if(f.direction===true)out={station:'create',ring:.5,next:'Write',section:'write'};
  else if(n(f.research))out={station:'research',ring:.4,next:f.direction===false?'Write my direction':'',section:'direction'};
  else if(n(f.material))out={station:'gather',ring:.2,next:f.research===0?'Start the research':'',section:'research'};
  else out={station:'gather',ring:.05,next:f.material===0?'Add material':'',section:'material'};
  const asks=n(f.asks);
  if(asks&&out.station!=='published')out.next='Answer '+plural(asks,'question');
  return {...out,name:NAME[out.station]};
 }
 const sharedApi=Object.freeze({station,STATIONS,RESTING_DAYS});
 // For the Subject screen. The shell's v2 is frozen until it gains v2.shared; the plain global stays either way.
 try{let shared=v2.shared;if(!shared){try{v2.shared={};}catch{}shared=v2.shared;}if(shared&&typeof shared==='object')shared.home=sharedApi;}catch{}
 W.v2HomeStations=sharedApi;

 /* ======================= small pure helpers ======================= */
 const quiet=p=>p.then(v=>v,()=>null);
 const newest=(...times)=>{let best=null,t=-Infinity;for(const x of times){const v=Date.parse(x||'');if(Number.isFinite(v)&&v>t){t=v;best=x;}}return best;};
 const fkey=path=>(path||[]).join('\u0001');
 const lower=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase();
 const slug=s=>lower(s).replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
 const EMPTY_HASH='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

 /* ======================= Standing: the one place that reads where subjects stand =======================
    list() reads only list-level records, a dozen calls whatever the number of subjects. deepen() reads one subject a
    little further, for the desk and for rows as they come into view, and may only add a next step to the station
    list() gave, or a cover; it never moves a subject to another station. */
 const Standing={
  /** From the journal (who did what), newest first: when each subject last changed, and whether its latest direction
      write left words. */
  async hints(){
   const hints=new Map();let before=null;
   for(let page=0;page<3;page++){
    const r=await v2.call('journal',{kind:'project',status:'committed',limit:1000,...(before?{before}:{})});
    for(const l of r?.lines||[]){
     const id=l?.scope?.id;if(typeof id!=='string'||!id)continue;
     const h=hints.get(id)||{};if(!h.changedAt)h.changedAt=l.ts;
     if(!('direction' in h)&&/^study\.human-direction\.(write|undo)$/.test(l.kind)&&typeof l.after?.hash==='string')h.direction=l.after.hash!==EMPTY_HASH;
     hints.set(id,h);
    }
    if(!r?.hasMore||!r.nextCursor)break;before=r.nextCursor;
   }
   return hints;
  },
  /** Every subject with its place and its station, from list-level records only. Throws only when the subjects
      themselves cannot be read. */
  async list(){
   const [catalog,places,folders]=await Promise.all([v2.call('study-draft.catalog',{}),v2.call('subject-places',{}),v2.call('subject-places.folders.get',{})]);
   const [plans,needs,leases,sourceProjects,topics,board,hints]=await Promise.all([
    quiet(v2.call('instagram.plans',{})),quiet(v2.call('needs-you',{status:'all'})),quiet(v2.call('leases',{})),
    quiet(v2.call('library.source-projects',{})),quiet(v2.call('inquiries.catalog',{})),quiet(v2.call('magazine.board',{})),quiet(Standing.hints())]);
   const placeOf=new Map((places?.places||[]).map(p=>[p.parentStudyId,p]));
   const articleOf=new Set();for(const b of catalog?.outputBindings||[])if(b?.parentStudyId)articleOf.add(b.parentStudyId);
   const planOf=new Map();for(const p of plans?.plans||[])if(p?.subject&&(!planOf.has(p.subject)||String(p.updatedAt)>String(planOf.get(p.subject).updatedAt)))planOf.set(p.subject,p);
   const unplaced=id=>({parentStudyId:id,folder:[],tags:[],pinnedAt:null,archived:false,order:null,deskOrder:null,revision:0,saved:false});
   const seen=new Set(),subjects=[];
   for(const c of catalog?.collections||[]){
    const id=c?.parentStudyId;if(typeof id!=='string'||!id||seen.has(id))continue;seen.add(id);
    subjects.push({id,title:String(c.title||'').trim()||'Untitled subject',bindingId:c.bindingId||null,place:placeOf.get(id)||unplaced(id),article:articleOf.has(id),plan:planOf.get(id)||null,hint:hints?.get(id)||null});
   }
   // A working draft that belongs to no saved collection is a subject too (its working text is its Article), as the
   // top bar's desk already names it.
   for(const d of catalog?.drafts||[]){
    const id=d?.parentStudyKey;if(typeof id!=='string'||!id||seen.has(id))continue;seen.add(id);
    subjects.push({id,title:String(d.title||'').trim()||'Untitled subject',bindingId:null,place:placeOf.get(id)||unplaced(id),article:true,plan:planOf.get(id)||null,hint:hints?.get(id)||null,draftAt:d.modifiedAt||null});
   }
   const idx={byProject:new Map(),byTitle:new Map(),topics:topics?.collections||[],stories:Array.isArray(board?.board)?board.board:[],openAsks:(needs?.asks||[]).filter(a=>a.status==='open'),tree:null};
   for(const p of sourceProjects?.projects||[]){if(p?.projectId)idx.byProject.set(p.projectId,p);const t=lower(p?.title);if(t&&!idx.byTitle.has(t))idx.byTitle.set(t,p);}
   const now=Date.now();
   for(const s of subjects){
    const material=idx.byTitle.get(lower(s.title))||null,sourceIds=new Set(material?.sourceIds||[]);
    const linked=sourceIds.size?idx.topics.filter(t=>(t.sourceIds||[]).some(x=>sourceIds.has(x))):[];
    const story=idx.stories.find(b=>b&&b.story&&(lower(b.story)===lower(s.title)||'mag-'+slug(b.story)===s.id));
    s.changedAt=newest(s.draftAt,s.hint?.changedAt,s.place.updatedAt,s.plan?.updatedAt,...linked.map(t=>t.updated_at));
    // Material and research are known here only when the project's own list names this subject's material.
    s.facts={...(material?{material:sourceIds.size,research:linked.length}:{}),...(s.hint&&'direction' in s.hint?{direction:s.hint.direction}:{}),
     article:s.article,carousel:s.plan?{chosen:!!s.plan.chosen,ready:Array.isArray(s.plan.ready)&&s.plan.ready.length>0}:null,
     published:!!story?.published,asks:idx.openAsks.filter(a=>a.scope?.id===s.id).length,changedAt:s.changedAt};
    s.st=station(s.facts,now);
    s.look=s.plan?.drawnIn?.id||s.plan?.look||null;
   }
   return {subjects,folders,needs,leases:leases?.leases||[],readAt:now,idx};
  },
  /** One subject read a little further: {next, cover}. next is a step on the station list() gave, or '' when the
      further reading points elsewhere. cover (when asked) is the address of its first selected photograph, or null. */
  async deepen(s,data,{cover=false}={}){
   const more={};let scope=null;
   if(s.article&&s.bindingId){
    const [outputs,requests]=await Promise.all([quiet(v2.call('study.outputs',{parentStudyId:s.id,rootBindingId:s.bindingId})),quiet(v2.call('study-ai.requests',{parentStudyId:s.id,bindingId:s.bindingId}))]);
    const outs=outputs?.outputs||[],article=outs.find(o=>o.kind==='article')||outs[0]||null;
    if(article?.status)more.articleStatus=article.status;
    if(requests)more.suggestions=(requests.items||[]).filter(i=>i.status==='pending').length;
    scope=outputs?.photoScope||null;
   }
   if(!s.article&&(!s.plan||cover)){
    const d=await quiet(v2.call('study.human-direction',{parentStudyId:s.id}));
    if(d){more.direction=!!String(d.body||'').trim();if(d.scope?.projectId&&d.scope?.documentId)scope={projectId:d.scope.projectId,documentId:d.scope.documentId};}
    if(!s.plan&&!known(s.facts.material)){
     const binding=await v2.call('first-flow.binding',{projectKey:s.id}).catch(e=>e?.status===404?{none:true}:null);
     if(binding?.none)more.material=0;
     else if(binding?.projectId){
      const listed=data.idx.byProject.get(binding.projectId);
      if(listed){const ids=new Set(listed.sourceIds||[]);more.material=ids.size;more.research=data.idx.topics.filter(t=>(t.sourceIds||[]).some(x=>ids.has(x))).length;}
      else{data.idx.tree||=quiet(v2.call('sources.tree',{}));const tree=await data.idx.tree,files=new Map();
       const walk=f=>{if(!f)return;files.set(f.rel_path,f.file_count||0);(f.folders||[]).forEach(walk);};for(const r of tree?.roots||[])if(r.id==='library')walk(r.tree);
       // A project's own Library folder holds what was gathered for it; no folder means nothing was.
       if(tree)more.material=files.get('Projects/'+binding.projectId)||0;}
     }
    }
   }
   const deeper=station({...s.facts,...more});
   let picture=null;
   if(cover&&scope){
    const photos=await quiet(v2.call('study.photos',{projectId:scope.projectId,documentId:scope.documentId}));
    const first=(photos?.photos||[]).find(p=>p&&!p.missing&&typeof p.url==='string'&&p.url.startsWith('/api/study/photos/preview?'));
    if(first){const u=new URL(first.url,location.origin);if(!u.searchParams.has('bindingId')&&s.bindingId)u.searchParams.set('bindingId',s.bindingId);if(!u.searchParams.has('parentStudyId'))u.searchParams.set('parentStudyId',s.id);picture=u.pathname+u.search;}
   }
   return {next:deeper.station===s.st.station?deeper.next:'',cover:picture};
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
 const today=()=>new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric'});
 const subjectHref=id=>v2.href('subject/:id',{id});
 const folderPath=path=>['Subjects',...path].join(' / ');
 const expectPlace=p=>({expectedRevision:p?.revision||0,...(p?.saved&&p.hash?{expectedHash:p.hash}:{})});
 const V2Client=W.V2Client;
 const uuid=()=>{try{return crypto.randomUUID();}catch{return V2Client?.uuid?.()||String(Date.now());}};
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 // The controls a repaint must hand focus back to, by what they are and which subject they belong to.
 const FOCUS_KEYS=['data-pin','data-v2-up','data-v2-down','data-row-menu','data-group-by','data-view','data-station','data-arrange','data-archived','data-show-all','data-home-find','data-ask-change','data-ask-choice','data-unarchive'];

 /* ======================= the screen ======================= */
 v2.screen({id:'home',title:'Home',route:'',
  render:()=>`<div class="v2-page home" data-home>
 <header><div><h1>Home</h1><p>${esc(today())}</p></div><button type="button" class="pri home-new" data-home-new>${icon('plus')}New subject</button></header>
 <div class="home-needs-slot" data-home-needs></div>
 <section class="home-desk" data-home-desk aria-labelledby="home-desk-h" hidden></section>
 <section class="home-all" data-home-all aria-labelledby="home-all-h"><div class="home-sec-h"><h2 id="home-all-h">Everything</h2></div><p class="home-quiet" data-home-loading>Reading your subjects…</p></section>
</div>`,
  async mount(el,ctx){
   const root=el.querySelector('[data-home]');if(!root)return;
   const ui={...prefs(),station:null,find:'',open:new Set(),archived:false,arrange:false,allAsks:false};
   let data=null,failed=null,loading=null,again=false,loadedAt=0,timer=0,dragId=null,dragging=false,deskStops=[],allStops=[],repaintWaiting=false;
   const answeredHere=new Map(),changing=new Set(),askOrder=[],lookRoles=new Map();
   // What deepen() found, by subject, while this page is open: {next, cover}. Forgotten when that subject changes.
   const deep=new Map(),wanted=new Map();let deepRunning=0;
   // Reordering: each press waits for the one before it.
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
     if(data)void v2.desk.use(async()=>desk().map(s=>({id:s.id,title:s.title})));
     loadedAt=Date.now();
     if(busy()&&data)repaint();else paint();
     void readLooks();
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

   /* ---------- reading further, only for what is in view ---------- */
   const observer=typeof W.IntersectionObserver==='function'?new W.IntersectionObserver(entries=>{
    for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);want(e.target);}
   },{rootMargin:'160px 0px'}):null;
   function watch(scope){
    for(const el of scope.querySelectorAll('[data-id]')){
     if(!el.matches('.home-card,.home-row,.home-cover'))continue;
     if(observer)observer.observe(el);
    }
    // With no way to tell what is in view, the desk and the first rows are read.
    if(!observer)[...scope.querySelectorAll('.home-card,.home-row,.home-cover')].slice(0,12).forEach(want);
   }
   function want(el){
    const id=el.dataset.id,cover=el.matches('.home-card,.home-cover'),had=deep.get(id);
    if(had&&(!cover||'cover' in had))return apply(id);
    const w=wanted.get(id);wanted.set(id,{cover:cover||!!w?.cover});pump();
   }
   function pump(){
    while(deepRunning<2&&wanted.size&&!ctx.signal.aborted){
     const [id,opts]=wanted.entries().next().value;wanted.delete(id);
     const s=find(id);if(!s)continue;
     deepRunning++;
     Standing.deepen(s,data,opts).then(r=>{const had=deep.get(id)||{};deep.set(id,{...had,next:r.next,...(opts.cover?{cover:r.cover}:{})});apply(id);},()=>{})
      .finally(()=>{deepRunning--;pump();});
    }
   }
   const nextOf=s=>{const d=deep.get(s.id);return d&&d.next!==undefined&&!s.st.next?d.next:s.st.next;};
   /** A subject's next step and cover, put where it is shown, in place. Stations and their counts are left alone. */
   function apply(id){
    const s=find(id);if(!s)return;const d=deep.get(id)||{};
    for(const el of root.querySelectorAll('[data-id]')){
     if(el.dataset.id!==id)continue;
     const next=el.querySelector('.home-next');if(next&&!next.querySelector('.home-held'))next.textContent=s.st.station==='published'?'':nextOf(s);
     const card=el.querySelector('.home-card-next span');if(card)card.textContent=nextOf(s)||'Open';
     if(d.cover){
      const pic=el.querySelector('.home-card-pic,.home-cover-pic');
      if(pic&&!pic.querySelector('img')){pic.innerHTML=`<img src="${esc(d.cover)}" alt="" loading="lazy">`;pic.hidden=false;pic.classList.add('has-img');}
     }
    }
   }

   /* ---------- looks for the folder dots ---------- */
   async function readLooks(){
    const ids=[...new Set((data?.subjects||[]).map(s=>s.look).filter(id=>id&&!lookRoles.has(id)))];if(!ids.length)return;
    await Promise.all(ids.map(async id=>{const look=await quiet(v2.call('look',{id}));lookRoles.set(id,look?.roles||null);}));
    if(!ctx.signal.aborted&&data)paintDots();
   }
   function paintDots(){
    for(const h of root.querySelectorAll('.home-group>header[data-drop-folder]')){
     let path=[];try{path=JSON.parse(h.parentElement.dataset.path||'[]');}catch{}
     h.querySelector('.home-dot')?.remove();const dot=folderDot(path);if(dot)h.insertAdjacentHTML('afterbegin',dot);
    }
   }
   function folderDot(path){if(!path?.length)return '';const id=folderLook(path),a=id&&accentOf(id);return a?`<i class="home-dot" style="--home-dot:${esc(a)}" title="Drawn in the ${esc(id)} look" aria-hidden="true"></i>`:'';}
   function accentOf(id){const roles=lookRoles.get(id),a=roles?.[v2.theme()==='dark'?'dark':'light']?.accent||roles?.dark?.accent;return typeof a==='string'&&/^#[0-9a-f]{3,8}$/i.test(a)?a:null;}

   /* ---------- the model ---------- */
   const find=id=>data?.subjects.find(s=>s.id===id);
   const live=()=>(data?.subjects||[]).filter(s=>!s.place.archived);
   const orderKey=s=>num(s.place.order)?s.place.order:1e9;
   const byHand=(a,b)=>orderKey(a)-orderKey(b)||a.title.localeCompare(b.title);
   const byName=(a,b)=>a.title.localeCompare(b.title);
   // The desk keeps its own order; a subject placed before the desk had one goes by when it was pinned.
   const deskKey=s=>num(s.place.deskOrder)?s.place.deskOrder:1e9;
   function desk(){return live().filter(s=>s.place.pinnedAt).sort((a,b)=>deskKey(a)-deskKey(b)||String(a.place.pinnedAt).localeCompare(String(b.place.pinnedAt))).slice(0,5);}
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
    const all=live(),rows=all.filter(s=>(!ui.station||s.st.station===ui.station)&&findMatch(s)),filtered=!!(ui.find||ui.station);
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
    if(ui.group==='station')return STATIONS.map(st=>({key:'s:'+st.id,name:st.name,total:all.filter(s=>s.st.station===st.id).length,items:rows.filter(s=>s.st.station===st.id).sort(byName)})).filter(g=>g.items.length);
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
    keepFocus(()=>{paintNeeds();paintDesk();paintAll();});
   }

   function paintNeeds(){
    const slot=root.querySelector('[data-home-needs]'),asks=data.needs?.asks||[],human=v2.isHuman();
    // A question answered here stays where it was, marked answered, until he leaves the page.
    for(const a of asks)if((a.status==='open'||a.status==='defaulted'||answeredHere.has(a.id))&&!askOrder.includes(a.id))askOrder.push(a.id);
    const shown=askOrder.map(id=>asks.find(a=>a.id===id)).filter(a=>a&&(a.status==='open'||a.status==='defaulted'||answeredHere.has(a.id)));
    const working=new Map();for(const l of data.leases||[])if(String(l.actor||'').startsWith('agent:')&&Date.parse(l.expiresAt||0)>Date.now()){const n=v2.actorName(l.actor);working.set(n,(working.get(n)||0)+1);}
    const steer=asks.filter(a=>a.status==='open'&&a.band==='steer'&&a.default).length;
    const carrying=([...working].map(([n,c])=>`${n} is carrying on with ${plural(c,'thing')} by itself.`).join(' ')+(steer?` ${plural(steer,'question')} will take ${steer===1?'its':'their'} default unless you choose.`:'')).trim();
    const off=human?'':' disabled title="Only Adrian answers these."';
    if(!shown.length){slot.innerHTML=carrying?`<p class="home-quiet home-carry">${esc(carrying)}</p>`:'';return;}
    const cut=ui.allAsks?shown.length:3,more=shown.length-cut;
    const rows=shown.slice(0,cut).map(a=>{
     const done=answeredHere.get(a.id)||(a.status==='defaulted'?{choice:a.resolution?.choice||a.default,auto:true}:null);
     const about=a.about?`<small>${esc(a.about)}</small>`:'';
     if(done&&!changing.has(a.id))return `<li class="ok" data-ask="${esc(a.id)}">${icon('check')}<p>${done.auto?'Applied by default':'Answered'}: <b>${esc(done.choice||done.text||'')}</b>. ${esc(a.question)}${about}</p><span class="home-acts"><button type="button" data-ask-change="${esc(a.id)}"${off}>Change it</button></span></li>`;
     const recording=['recording-words','recording-check'].includes(a.scope?.kind);
     let href=recording?(a.recording?.wordsHref||a.wordsHref||a.link?.href):a.link?.href;
     if(typeof href==='string'&&href.startsWith('#'))href='/document-study/index.html'+href;
     const link=typeof href==='string'&&/^\/(?!\/)/.test(href)?`<a class="home-act" href="${esc(href)}">${esc(recording?'Go through them':a.link?.label||'Open')}${icon('right')}</a>`:'';
     const choices=recording?'':(a.choices||[]).map(c=>`<button type="button" data-ask-id="${esc(a.id)}" data-ask-choice="${esc(c)}"${off}>${esc(c)}${a.default===c?'<small>default</small>':''}</button>`).join('');
     const due=a.band==='steer'&&a.applyAt&&a.status==='open'?`<small>Takes its default ${esc(dueAt(a.applyAt))} unless you choose.</small>`:'';
     return `<li data-ask="${esc(a.id)}"><p><b>${esc(a.question)}</b>${about}${due}</p>${choices||link?`<span class="home-acts">${choices}${link}</span>`:''}</li>`;
    }).join('');
    slot.innerHTML=`<section class="home-needs" aria-labelledby="home-needs-h"><h2 class="home-label" id="home-needs-h">${icon('ask')}Needs you</h2><ul>${rows}</ul>${more>0?`<button type="button" class="v2-ghost home-more" data-all-asks>Show all ${shown.length}${icon('chev')}</button>`:''}${carrying?`<p class="home-quiet">${esc(carrying)}</p>`:''}${human?'':'<p class="home-quiet">Opened as an assistant: these are for Adrian to answer.</p>'}</section>`;
   }

   function card(s){
    const who=holder(s.id),d=deep.get(s.id);
    return `<article class="home-card" data-id="${esc(s.id)}">
 <a class="home-card-open" href="${esc(subjectHref(s.id))}"><span class="home-card-pic${d?.cover?' has-img':''}" aria-hidden="true"${d?.cover?'':' hidden'}>${d?.cover?`<img src="${esc(d.cover)}" alt="">`:''}</span><b>${esc(s.title)}</b><span class="home-st">${ring(s.st.ring)}${esc(s.st.name)}</span>${who?`<small class="home-held">${esc(who)} is working on it</small>`:''}</a>
 <a class="home-card-next" href="${esc(subjectHref(s.id))}"><span>${esc(nextOf(s)||'Open')}</span>${icon('right')}</a>
</article>`;
   }
   function paintDesk(){
    const sec=root.querySelector('[data-home-desk]'),items=desk();
    deskStops.forEach(f=>f());deskStops=[];
    if(!live().length){sec.hidden=true;sec.innerHTML='';return;}
    sec.hidden=false;
    if(!items.length){sec.innerHTML=`<div class="home-sec-h"><h2 id="home-desk-h">On your desk</h2></div><p class="home-quiet">Nothing on your desk. Press the pin beside a subject to keep it here and in the top bar.</p>`;return;}
    sec.innerHTML=`<div class="home-sec-h"><h2 id="home-desk-h">On your desk</h2><span>${items.length} of 5 · what you are working on now. <span class="home-mouse">Drag to reorder.</span><span class="home-touch">Move them with the arrows.</span></span></div><div class="home-cards" data-home-cards>${items.map(card).join('')}</div>`;
    const box=sec.querySelector('[data-home-cards]');
    deskStops.push(v2.ui.reorder(box,{item:'.home-card',label:el=>el.querySelector('b')?.textContent||'Subject',
     onMove:()=>queueOrder('desk',[...box.querySelectorAll(':scope>.home-card')].map(x=>x.dataset.id))}));
   }

   const tagsOf=s=>{const tags=s.place.tags||[],extra=tags.length-TAGS_SHOWN;return `<span class="home-tags">${tags.slice(0,TAGS_SHOWN).map(t=>`<i>${esc(t)}</i>`).join('')}${extra>0?`<i class="home-tag-more" title="${esc(tags.slice(TAGS_SHOWN).join(', '))}">+${extra}</i>`:''}</span>`;};
   const pinBtn=s=>{const on=!!s.place.pinnedAt;return `<button type="button" class="v2-ghost v2-icon-btn home-pin" data-pin="${esc(s.id)}" aria-pressed="${on}" aria-label="${on?'Take off your desk':'Put on your desk'}: ${esc(s.title)}" title="${on?'On your desk':'Put on your desk'}">${PIN}</button>`;};
   function row(s){
    const who=holder(s.id);
    return `<li class="home-row" data-id="${esc(s.id)}">
 <a class="home-row-open" href="${esc(subjectHref(s.id))}"><b>${esc(s.title)}</b>${tagsOf(s)}<span class="home-st">${ring(s.st.ring)}${esc(s.st.name)}</span><span class="home-next">${who?`<em class="home-held">${esc(who)} is working on it</em>`:esc(s.st.station==='published'?'':nextOf(s))}</span><small>${esc(when(s.changedAt))}</small></a>
 ${ui.arrange&&ui.group==='folder'?`<button type="button" class="v2-ghost v2-icon-btn home-rowmenu" data-row-menu="${esc(s.id)}" aria-label="More: ${esc(s.title)}" title="Move or archive">${MORE}</button>`:''}${pinBtn(s)}
</li>`;
   }
   const cover=s=>{const d=deep.get(s.id);return `<li class="home-cover" data-id="${esc(s.id)}"><a href="${esc(subjectHref(s.id))}"><span class="home-cover-pic${d?.cover?' has-img':''}" aria-hidden="true">${d?.cover?`<img src="${esc(d.cover)}" alt="">`:ring(s.st.ring,{size:'lg'})}</span><b>${esc(s.title)}</b><span class="home-st">${ring(s.st.ring)}${esc(s.st.name)}</span></a>${pinBtn(s)}</li>`;};
   function stationCounts(){const c={};for(const s of live().filter(findMatch))c[s.st.station]=(c[s.st.station]||0)+1;return c;}

   function paintAll(){
    const sec=root.querySelector('[data-home-all]'),all=live(),archived=(data.subjects||[]).filter(s=>s.place.archived);
    allStops.forEach(f=>f());allStops=[];
    const counts=stationCounts(),gs=all.length?groups():[],arrange=canArrange();
    const list=gs.map(g=>{
     const cut=ui.find||ui.open.has(g.key)?Infinity:ui.view==='covers'?12:CUT[ui.group],items=g.items.slice(0,cut),more=g.items.length-items.length,folder=ui.group==='folder'&&!g.loose;
     const count=!g.items.length?'Empty':ui.find||ui.station?`${g.items.length} of ${g.total}`:g.total;
     const head=`<header${ui.group==='folder'?` data-drop-folder`:''}>${folder?folderDot(g.path):''}<h3>${esc(g.name)}</h3><span>${esc(count)}</span>${folder?`<small class="home-path" title="A real folder">${esc(folderPath(g.path))}</small>`:''}</header>`;
     const body=!items.length?'':ui.view==='covers'?`<ul class="home-covers" data-group="${esc(g.key)}">${items.map(cover).join('')}</ul>`:`<ul class="home-rows" data-group="${esc(g.key)}">${items.map(row).join('')}</ul>`;
     return `<section class="home-group${items.length?'':' home-empty-folder'}" data-key="${esc(g.key)}"${folder&&g.saved?' data-saved':''}${g.path?` data-path="${esc(JSON.stringify(g.path))}"`:''}>${head}${body}${more>0?`<button type="button" class="v2-ghost home-more" data-show-all="${esc(g.key)}">Show all ${g.items.length}${icon('chev')}</button>`:''}</section>`;
    }).join('');
    const empty=!all.length?`<div class="home-empty"><p>${archived.length?'Every subject is archived.':'No subjects yet. A subject holds what you gather, learn and make about one thing.'}</p><button type="button" class="pri" data-home-new>${icon('plus')}New subject</button></div>`
     :!gs.length?`<p class="home-quiet">No subject matches${ui.find?` "${esc(ui.find)}"`:''}${ui.station?' in '+esc(NAME[ui.station]):''}.</p>`:'';
    const archive=archived.length?`<div class="home-archived"><button type="button" class="v2-ghost" data-archived aria-expanded="${ui.archived}">${ui.archived?'Hide archived':'Archived'} · ${archived.length}</button>${ui.archived?`<ul class="home-rows">${archived.sort(byName).map(s=>`<li class="home-row" data-id="${esc(s.id)}"><a class="home-row-open" href="${esc(subjectHref(s.id))}"><b>${esc(s.title)}</b>${tagsOf(s)}<span class="home-st">${ring(s.st.ring)}${esc(s.st.name)}</span><span class="home-next"></span><small>${esc(when(s.changedAt))}</small></a><button type="button" class="v2-ghost home-unarchive" data-unarchive="${esc(s.id)}">Put back</button></li>`).join('')}</ul>`:''}</div>`:'';
    sec.innerHTML=`<div class="home-sec-h"><h2 id="home-all-h">Everything</h2><span>${plural(all.length,'subject')}</span>${all.length?`<label class="home-find"><span class="home-sr">Find a subject</span>${icon('search')}<input type="search" data-home-find placeholder="Find a subject" value="${esc(ui.find)}" autocomplete="off"></label>`:''}</div>
${all.length?`<div class="home-tools">
 <div class="home-seg" role="group" aria-label="Group">${GROUPS.map(([k,l])=>`<button type="button" data-group-by="${k}" aria-pressed="${ui.group===k}">${l}</button>`).join('')}</div>
 <div class="home-chips" role="group" aria-label="Show one station">${STATIONS.map(st=>`<button type="button" data-station="${st.id}" aria-pressed="${ui.station===st.id}">${st.name}<small>${counts[st.id]||0}</small></button>`).join('')}</div>
 <span class="home-grow"></span>
 ${ui.group==='folder'?`<button type="button" class="home-arrange" data-arrange aria-pressed="${ui.arrange}">${ui.arrange?'Done':'Arrange'}</button>`:''}
 <div class="home-seg" role="group" aria-label="View">${[['rows','Rows'],['covers','Covers']].map(([k,l])=>`<button type="button" data-view="${k}" aria-pressed="${ui.view===k}">${l}</button>`).join('')}</div>
</div>`:''}
${empty}<div class="home-groups" data-home-groups${ui.arrange?' data-arranging':''}>${list}</div>
${all.length&&ui.group==='folder'?`<div class="home-foot"><button type="button" data-new-folder>${icon('plus')}New folder</button><span class="home-quiet">Folders are real places. Drag a folder to change the order, or a subject onto a folder to move it. Tags cut across folders.</span></div>`:''}${archive}`;
    // What is in view (the desk and these rows) is read a little further, a few at a time.
    observer?.disconnect();watch(root);
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
      // The new order is what is on screen now; any saved folder not shown keeps its place at the end.
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
   /** Save a hand order (the desk's, or a folder's) for these subjects, read with their newest places at the moment it runs. */
   function queueOrder(which,ids){
    return queue(async()=>{
     const list=ids.map(find).filter(Boolean);if(!list.length)return;
     const result=await v2.call('subject-places.reorder',{...(which==='desk'?{which:'desk'}:{}),items:list.map(s=>({parentStudyId:s.id,...expectPlace(s.place)}))});
     for(const p of result?.places||[]){const s=find(p.parentStudyId);if(s)s.place=p;}
    });
   }
   async function savePlace(s,change){
    const result=await v2.call('subject-places.save',{parentStudyId:s.id,...expectPlace(s.place),...change},{
     reread:()=>v2.call('subject-places',{parentStudyId:s.id}),
     // Only the fields asked for are sent again, on top of what is saved now; the rest of the place is left as it is.
     merge:fresh=>{const p=(fresh?.places||[]).find(x=>x.parentStudyId===s.id);if(!p)return null;s.place=p;return {parentStudyId:s.id,...expectPlace(p),...change};}});
    if(result&&result.parentStudyId===s.id)s.place=result;else if(result?.place)s.place=result.place;
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
    if(on&&desk().length>=5){v2.ui.say('Your desk holds five. Take one off first.',{tone:'warn',timeout:6000});return;}
    // A new pin goes last on the desk.
    const last=desk().reduce((m,x)=>num(x.place.deskOrder)?Math.max(m,x.place.deskOrder):m,-1);
    try{await savePlace(s,on?{pinned:true,...(last>=0?{deskOrder:last+1}:{})}:{pinned:false});repaint();v2.ui.say(on?`"${s.title}" is on your desk.`:`"${s.title}" is off your desk.`);soon();}
    catch(error){v2.ui.say(error.message,{tone:'bad'});}
   }
   async function answer(id,choice){
    const a=(data.needs?.asks||[]).find(x=>x.id===id);if(!a)return;
    for(const b of root.querySelectorAll('[data-ask] button'))if(b.closest('[data-ask]').dataset.ask===id)b.disabled=true;
    try{const saved=await v2.call('needs-you.answer',{id,choice});answeredHere.set(id,{choice:saved?.resolution?.choice||choice});changing.delete(id);
     const i=data.needs.asks.findIndex(x=>x.id===id);if(i>=0&&saved?.id===id)data.needs.asks[i]=saved;paintNeeds();
     [...root.querySelectorAll('[data-ask-change]')].find(b=>b.dataset.askChange===id)?.focus({preventScroll:true});v2.needs.refresh();}
    catch(error){v2.ui.say(error.message,{tone:'bad'});paintNeeds();}
   }
   function form(markup){const f=document.createElement('form');f.className='home-form';f.innerHTML=markup;return f;}
   const formActs=label=>`<div class="home-form-acts"><button type="button" class="v2-ghost" data-v2-close>Cancel</button><button type="submit" class="pri">${esc(label)}</button></div>`;
   function newSubject(){
    const f=form(`<label for="home-new-name">Name</label><input id="home-new-name" name="name" maxlength="160" required autocomplete="off" placeholder="What is it about?"><p class="home-quiet">It opens as itself, ready for material.</p>${formActs('Make it')}`);
    const sheet=v2.ui.sheet({title:'New subject',body:f});f.elements.name.focus();
    let intent=null;
    f.addEventListener('submit',async e=>{e.preventDefault();const title=f.elements.name.value.trim();if(!title)return;
     // The same identity is kept for a retry, so a second press never makes a second subject.
     intent||={parentStudyId:uuid(),title,operationId:uuid()};
     f.elements.name.readOnly=true;f.querySelector('[type=submit]').disabled=true;
     try{await v2.call('study-draft.create-collection',intent);sheet.close();v2.go('subject/:id',{id:intent.parentStudyId});}
     catch(error){f.querySelector('[type=submit]').disabled=false;v2.ui.say(error.message+' Press Make it to try again.',{tone:'bad'});}
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
   /** The row's quiet menu while arranging: move it to another folder, or archive it. */
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
    if(t.matches('[data-home-retry]')){t.disabled=true;t.textContent='Reading again…';return void load();}
    if(t.dataset.groupBy){ui.group=t.dataset.groupBy;ui.open.clear();if(ui.group!=='folder')ui.arrange=false;keepPrefs(ui);return keepFocus(paintAll);}
    if(t.dataset.view){ui.view=t.dataset.view;keepPrefs(ui);return keepFocus(paintAll);}
    if(t.dataset.station){const id=t.dataset.station;ui.station=ui.station===id?null:id;return keepFocus(paintAll);}
    if(t.dataset.showAll){ui.open.add(t.dataset.showAll);return paintAll();}
    if(t.hasAttribute('data-all-asks')){ui.allAsks=true;return paintNeeds();}
    if(t.hasAttribute('data-arrange')){ui.arrange=!ui.arrange;return keepFocus(paintAll);}
    if(t.hasAttribute('data-archived')){ui.archived=!ui.archived;return keepFocus(paintAll);}
    if(t.hasAttribute('data-new-folder'))return newFolder();
    if(t.dataset.pin){const s=find(t.dataset.pin);if(s)void togglePin(s);return;}
    if(t.dataset.rowMenu){const s=find(t.dataset.rowMenu);if(s)rowMenu(s);return;}
    if(t.dataset.unarchive){const s=find(t.dataset.unarchive);if(s)void setArchived(s,false);return;}
    if(t.dataset.askChoice)return void answer(t.dataset.askId,t.dataset.askChoice);
    if(t.dataset.askChange){const id=t.dataset.askChange;changing.add(id);answeredHere.delete(id);const a=data.needs.asks.find(x=>x.id===id);if(a&&a.status==='answered')a.status='open';paintNeeds();return [...root.querySelectorAll('[data-ask-choice]')].find(b=>b.dataset.askId===id)?.focus();}
   });
   root.addEventListener('input',e=>{if(e.target.matches?.('[data-home-find]')){ui.find=e.target.value;keepFocus(paintAll);}});
   // A subject dragged onto a folder's heading moves there, with Undo.
   root.addEventListener('dragstart',e=>{dragging=true;const r=e.target.closest?.('.home-row,.home-cover');dragId=r&&root.contains(r)?r.dataset.id:null;},true);
   root.addEventListener('drop',()=>{dragging=false;},true);
   root.addEventListener('dragend',()=>{dragging=false;dragId=null;root.querySelectorAll('.home-over').forEach(x=>x.classList.remove('home-over'));});
   root.addEventListener('dragover',e=>{const h=e.target.closest?.('[data-drop-folder]');if(!dragId||!h)return;e.preventDefault();root.querySelectorAll('.home-over').forEach(x=>x!==h&&x.classList.remove('home-over'));h.classList.add('home-over');});
   root.addEventListener('drop',e=>{const h=e.target.closest?.('[data-drop-folder]');if(!dragId||!h)return;e.preventDefault();const s=find(dragId);dragId=null;h.classList.remove('home-over');
    let path=[];try{path=JSON.parse(h.closest('.home-group')?.dataset.path||'[]');}catch{}if(s)void moveTo(s,path);});
   // What an assistant changes shows here without a reload; what was read further about that subject is read again.
   ctx.on({kinds:['subject-places*','study-draft*','study.human-direction*','study.outputs*','study.photos*','instagram*','inquiries*','sources*','needs-you*','lease*','magazine*','study-ai*','concept*','first-flow*']},e=>{
    if(e?.reset)return;
    const id=e?.scope?.id,hit=id&&(data?.subjects||[]).filter(x=>x.id===id||x.bindingId===id);
    if(hit?.length)for(const x of hit)deep.delete(x.id);
    else if(!/^(subject-places|needs-you|lease)/.test(String(e?.kind||'')))deep.clear();
    soon();
   });
   // A reset asks for everything to be read again; one that comes while the first reading is still under way is that reading.
   ctx.on({},e=>{if(e?.reset&&(data||failed)&&Date.now()-loadedAt>3000){deep.clear();soon();}});
   ctx.setAdvanced({section:'home'});
   ctx.homeStop=()=>{clearTimeout(timer);deskStops.forEach(f=>f());allStops.forEach(f=>f());observer?.disconnect();wanted.clear();};
   await load();
  },
  unmount(el,ctx){ctx.homeStop?.();void v2.desk.use(null);},
 });
})(window.v2);
