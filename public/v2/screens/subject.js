/* A subject: its forms in order, the steps to the finish line, one step open with its tool.
   Two halves. The first is pure: it turns the records (as gather() returns them) into facts, the facts into forms and
   steps, and maps every step and every hand-off onto the existing workspace's twelve sections. It runs in a browser
   and under node --test (tests/v2-subject.test.mjs). The second half is the screen: gather() reads the records through
   the shell's command client, in parallel, each answer painted as it arrives; a change re-asks only the reads its kind
   touches. Nothing here keeps a record of its own past the open page. */
(function(root){
 'use strict';

 // =====================================================================================================
 // The pure half.
 // =====================================================================================================

 /** The existing workspace's twelve sections, in its order, by the names v2.advanced takes. */
 const TWELVE=Object.freeze(['material','source','research','direction','write','read','check','media','arrange','audience','share','outputs']);
 const SECTION_LABEL=Object.freeze({material:'Material',source:'Source',research:'Research',direction:'Direction',write:'Write',read:'Read',check:'Check',media:'Media',arrange:'Arrange',audience:'Audience',share:'Share',outputs:'Outputs',subjects:'Subject board',library:'Library'});
 const GROUPS=Object.freeze(['Gather','Research','Simmer','Create','Share']);
 /** Every way out to the existing workspace, by what its label says: the label and the section it must land on. */
 const HANDOFFS=Object.freeze({
  directionChange:{label:'Change',section:'direction'},directionWrite:{label:'Write it',section:'direction'},
  addMaterial:{label:'Add it in Advanced',section:'material'},readSources:{label:'Read them in Advanced',section:'source'},
  readTranscript:{label:'Read the transcript in Advanced',section:'source'},
  research:{label:'Open Research in Advanced',section:'research'},researchLook:{label:'Look at them in Advanced',section:'research'},
  board:{label:'Open the board in Advanced',section:'subjects'},dishChange:{label:'Change it in Advanced',section:'direction'},dishWrite:{label:'Write it in Advanced',section:'direction'},
  write:{label:'Write',section:'write'},read:{label:'Read it through',section:'read'},
  media:{label:'Choose photographs in Advanced',section:'media'},arrange:{label:'Place them in Advanced',section:'arrange'},addPhotos:{label:'Add photographs in Advanced',section:'material'},
  checkRun:{label:'Run the check in Advanced',section:'check'},checkOpen:{label:'Open the check in Advanced',section:'check'},
  slides:{label:'Open the slides in Advanced',section:'arrange'},desk:{label:'Open the desk in Advanced',section:'share'},
  outputs:{label:'Open Outputs in Advanced',section:'outputs'},audience:{label:'See it as readers will, in Advanced',section:'audience'},
  postWrite:{label:'Write in Advanced',section:'write'},postRead:{label:'Read in Advanced',section:'read'},postCheck:{label:'Check in Advanced',section:'check'},
 });
 /** Where each step reaches in the existing workspace: the sections of its hand-offs. */
 const SECTIONS=Object.freeze({
  have:['material','source','library'],transcript:['source'],facts:['research'],dish:['direction','subjects'],
  words:['write','read'],photos:['media','arrange','material'],check:['check'],
  slides:['arrange','media'],story:['arrange'],posttext:['write','read','check'],yes:['share'],publish:['outputs','audience'],
 });
 /** The kinds of piece the app keeps, as forms. `make`: how Add a form makes one (null: not offered there). */
 const KINDS=Object.freeze({
  article:{name:'Article',to:'the magazine',what:'A long read in your words',needs:'some words in Write',make:'output'},
  carousel:{name:'Carousel',to:'Instagram',what:'Slides, one line each',needs:'a recording or a note; photographs help',make:'plan'},
  post:{name:'Post',to:'Instagram',what:'A few lines and a picture',needs:'nothing to start',make:'output'},
  'product-listing':{name:'Product listing',to:'the shop',what:'A thing, with its story',needs:'nothing to start',make:'output'},
  slides:{name:'Carousel',to:'Instagram',what:'Slides made from the words',needs:'',make:null},
 });
 const TEXT=new Set(['article','post','product-listing']);
 const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
 const day=iso=>{const d=new Date(iso||'');return isNaN(d)?'':d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});};
 const join=list=>list.length<2?list.join(''):list.slice(0,-1).join(', ')+' and '+list.at(-1);
 const ok=r=>!!r&&!r.__error;
 const has=(rec,k)=>rec[k]!==undefined;

 /** Every source in the Library tree by id, so a subject's material can be named and sorted. */
 function sourcesById(tree){
  const map=new Map();if(!ok(tree))return map;
  for(const s of tree.sources||[])if(s?.id)map.set(s.id,s);
  const walk=f=>{if(!f)return;for(const x of f.files||[]){const id=x.id||x.sourceId;if(id&&!map.has(id))map.set(id,x);}for(const c of f.folders||[])walk(c);};
  for(const r of tree.roots||[])walk(r.tree);
  return map;
 }
 /** The files in one Library folder (a subject's own folder, Projects/<project id>). */
 function folderFiles(tree,rel){
  const out=[];if(!ok(tree))return out;
  const find=f=>{if(!f)return null;if(f.rel_path===rel)return f;for(const c of f.folders||[]){const r=find(c);if(r)return r;}return null;};
  const all=f=>{for(const x of f.files||[])out.push(x);for(const c of f.folders||[])all(c);};
  const hit=find((tree.roots||[]).find(r=>r.id==='library')?.tree);if(hit)all(hit);
  return out;
 }
 /** Parts of the writing: a heading starts a part; with no headings the whole is one part. */
 function partsOf(blocks){
  const parts=[];let cur=null;
  for(const b of blocks){if(b.blockKind==='heading'){cur={name:String(b.words).trim().slice(0,80),paragraphs:0};parts.push(cur);continue;}if(!cur){cur={name:'Opening',paragraphs:0};parts.push(cur);}cur.paragraphs++;}
  return parts;
 }
 /** The subject's own record in the catalogue: its saved writing place, or a Magazine draft. */
 function homeOf(id,catalog){
  if(!ok(catalog))return null;
  const c=(catalog.collections||[]).find(x=>x.parentStudyId===id);if(c)return {title:c.title,bindingId:c.bindingId};
  const d=(catalog.drafts||[]).find(x=>x.parentStudyKey===id||x.id===id);return d?{title:d.title,bindingId:null}:null;
 }

 /** The facts the steps need, from whatever records have arrived. A record not yet arrived is undefined; a group of
     facts that rests on one is listed in `reading` and its steps say "Reading", never a guess. */
 function factsFrom(id,rec={}){
  const home=homeOf(id,rec.catalog),b=home?.bindingId||null,reading=new Set();
  const planRecords=(rec.planRecords||[]).filter(ok);
  // Material: the subject's own Library folder, what its research holds, and what its plans were made from.
  const byId=sourcesById(rec.tree),seen=new Map();
  const add=(sid,extra={})=>{if(!sid||seen.has(sid))return;const s=byId.get(sid)||{};seen.set(sid,{id:sid,title:extra.title||s.title||s.name||'Untitled',kind:extra.kind||s.kind||'',hash:extra.hash||s.hash||'',recordingId:s.recordingId,transcriptState:s.transcriptState,transcriptProvenance:s.transcriptProvenance,rel_path:s.rel_path||'',url:s.url||''});};
  if(ok(rec.brief)){for(const mm of rec.brief.materials||[])add(mm.sourceId,{title:mm.title,kind:mm.kind,hash:mm.hash});for(const sid of rec.brief.sourceIds||[])add(sid);}
  const projectId=ok(rec.binding)?rec.binding.projectId:ok(rec.brief)?rec.brief.projectId:null;
  if(projectId)for(const x of folderFiles(rec.tree,'Projects/'+projectId))add(x.id||x.sourceId,{title:x.name});
  for(const pr of planRecords){for(const x of pr.material?.transcripts||[])add(x.sourceId,{title:x.title,kind:'transcript',hash:x.sourceHash});for(const x of pr.material?.photos||[])add(x.sourceId,{title:x.caption,kind:'image'});}
  const material=sortMaterial([...seen.values()]);
  // What is known yet. The folder, the tree and the plans say there is material; only the brief can say there is none.
  const folderKnown=has(rec,'tree')&&has(rec,'binding')&&has(rec,'planRecords');
  if(!(folderKnown&&(has(rec,'brief')||material.total)))reading.add('material');
  if(!has(rec,'brief'))reading.add('research');
  if(!has(rec,'wordChecks')||!has(rec,'planRecords'))reading.add('transcript');
  if(!has(rec,'board')||!has(rec,'direction'))reading.add('dish');
  if(b&&(!has(rec,'read')||!has(rec,'requests')))reading.add('words');
  if(b&&!has(rec,'check'))reading.add('check');
  if(!has(rec,'desk'))reading.add('consent');
  if((b&&!has(rec,'outputs'))||!has(rec,'planRecords'))reading.add('pieces');
  if(!has(rec,'catalog'))for(const g of ['words','check','pieces','research'])reading.add(g);
  // The transcript: words a word check left open for this subject's recordings, and a plan's words to confirm.
  const jobs=new Set(material.items.filter(s=>s.kind==='recordings').map(s=>s.transcriptState?.jobId||s.recordingId).filter(Boolean));
  const wordChecks=ok(rec.wordChecks)?(rec.wordChecks.recordings||[]).filter(r=>jobs.has(r.jobId)):[];
  const flags=[];for(const pr of planRecords){const open=new Set((pr.flagStatus||[]).filter(x=>x.status==='open').map(x=>x.id));for(const x of pr.flags||[])if(open.has(x.id))flags.push({...x,planId:pr.id,line:(pr.lines||[]).find(l=>l.id===x.lineId)?.text||''});}
  const brief=ok(rec.brief)?rec.brief:null;
  const research={step:brief?brief.step:null,unreviewed:brief?(brief.materials||[]).filter(mm=>!mm.reviewed&&!['audio','image'].includes(mm.kind)).length:0,error:has(rec,'brief')&&!brief&&!!b};
  // The dish: the sentence he named on the Simmer board; failing that, the direction he wrote (Simmer's named dish
  // becomes the direction in this app, and a direction he writes himself is the same record).
  const forming=ok(rec.board)?rec.board.forming||{}:{},dirBody=ok(rec.direction)?String(rec.direction.body||'').trim():'';
  const namedText=typeof forming.named==='string'?forming.named:typeof forming.named?.sentence==='string'?forming.named.sentence:'';
  const onBoard=!!(forming.named||forming.sentAt);
  const dish={named:onBoard||!!dirBody,from:onBoard?'board':dirBody?'direction':null,at:onBoard?(forming.named?.at||forming.sentAt||''):(dirBody?rec.direction.updatedAt||'':''),sentence:namedText||dirBody,dishes:(forming.dishes||[]).length,groups:ok(rec.board)?(rec.board.groups||[]).length:0};
  const blocks=ok(rec.read)?(rec.read.projection||[]).filter(x=>String(x.words||'').trim()):[];
  const words={paragraphs:blocks.filter(x=>x.blockKind!=='heading').length,count:blocks.reduce((n,x)=>n+String(x.words).trim().split(/\s+/).length,0),parts:partsOf(blocks)};
  const pending=ok(rec.requests)?(rec.requests.items||[]).filter(i=>i.status==='pending'&&!i.stale).length:0;
  const check=ok(rec.check)?{status:rec.check.status,issues:(rec.check.issues||[]).length,list:(rec.check.issues||[]).slice(0,3).map(i=>i.message)}:null;
  const pieces=[];
  if(ok(rec.outputs))for(const o of rec.outputs.outputs||[])pieces.push({key:'out:'+o.id,id:o.id,kind:o.kind,title:o.title||o.name||'',placements:(o.placements||[]).length,slides:(o.slides||[]).length});
  for(const pr of planRecords){const fmt=Object.keys(pr.layouts||{})[0]||pr.stories?.[0]?.format||'carousel',lay=pr.layouts?.[fmt],chosen=pr.chosen?.storyId,story=(pr.stories||[]).find(s=>s.id===chosen),cap=lay?.caption;
   pieces.push({key:'ig:'+pr.id,id:pr.id,kind:'instagram',title:pr.title||'',plan:{id:pr.id,format:fmt,stories:(pr.stories||[]).length,chosen:!!chosen,chosenTitle:story?.title||'',frames:(lay?.frames||[]).length,caption:!!(typeof cap==='string'?cap.trim():cap?.parts?.length),ready:!!(pr.ready&&Object.keys(pr.ready).length),look:pr.drawnIn&&pr.drawnIn.from!=='default'?pr.drawnIn.id:null,revision:pr.revision}});}
  const y=ok(rec.desk)?rec.desk:null;
  const consent=y?{people:(y.people||[]).map(p=>({id:p.id,name:p.name,appears:p.appears||[],state:p.consent?.state||'not-asked',request:p.request||null})),released:!!y.release?.released,overridden:!!y.release?.overridden,ready:!!y.release?.ready,held:!!y.release?.held,reasons:y.release?.reasons||[],link:y.release?.publishHold?.link||''}:null;
  const place=ok(rec.place)?(rec.place.places||[]).find(p=>p.parentStudyId===id)||null:null;
  return {id,title:home?.title||id,found:!!home,bindingId:b,projectId,folder:place?.folder||[],direction:dirBody,look:pieces.find(p=>p.plan?.look)?.plan.look||null,
   material,transcript:{checks:wordChecks,flags,planned:planRecords.length>0},research,dish,words,pending,check,consent,pieces,reading:[...reading]};
 }

 /** The forms of a subject, in the order the app gives them: its saved pieces first, then its Instagram plans. A name
     that appears more than once is told apart by the piece's own name. */
 function formsOf(facts){
  const out=[];
  for(const p of facts?.pieces||[]){
   if(p.plan){const f=p.plan.format||'carousel';out.push({key:p.key,kind:'instagram',name:f==='story'?'Story':f==='reel'?'Reel':f==='post'?'Post':'Carousel',to:'Instagram',piece:p});continue;}
   const k=p.kind==='carousel'?'slides':p.kind,known=KINDS[k];if(!known)continue;
   out.push({key:p.key,kind:k,name:known.name,to:known.to,piece:p});
  }
  for(const f of out)f.alike=out.filter(x=>x.name===f.name).length>1;
  return out;
 }

 /** Which groups of facts each step rests on: while one is still being read, the step says so. */
 const NEEDS={have:['material'],transcript:['material','transcript'],facts:['material','research'],dish:['material','dish'],words:['words'],photos:['material','pieces'],check:['words','check'],story:['pieces'],slides:['pieces'],posttext:['pieces'],yes:['consent'],publish:['consent','words','check','pieces','transcript']};

 /** The steps for one form (or for the subject alone, form null), each with a state worked out from the facts:
     done, now (the next thing to make), flag (needs him), todo, wait (waits for something: `waits` names the steps,
     or `missing` names what is not there yet and where it is added), or reading (not known yet). */
 function stepsFor(form,facts={}){
  const m=facts.material||{total:0},steps=[],reading=new Set(facts.reading||[]);
  const add=(id,group,name,state,note,extra={})=>steps.push({id,group,name,state,note:note||'',sections:[...SECTIONS[id]],...extra});
  const find=id=>steps.find(x=>x.id===id);
  const materialKnown=!reading.has('material');
  // ---- Gather
  if(!materialKnown)add('have','Gather','What you have','reading','Reading');
  else if(!m.total)add('have','Gather','What you have','todo','Nothing yet');
  else add('have','Gather','What you have','done',[m.recordings&&plural(m.recordings,'recording'),m.notes&&plural(m.notes,'note'),m.links&&plural(m.links,'link'),m.photos&&plural(m.photos,'photograph')].filter(Boolean).join(' · '));
  const t=facts.transcript||{};
  if(materialKnown&&(m.recordings||t.flags?.length||t.checks?.length||t.planned)){
   const open=(t.flags||[]).length+(t.checks||[]).reduce((n,c)=>n+(c.open||0),0);
   if(open)add('transcript','Gather','The transcript','flag',plural(open,'word')+' to confirm');
   else if(t.checks?.length||t.planned)add('transcript','Gather','The transcript','done','Every word confirmed');
   else add('transcript','Gather','The transcript','todo','Not checked yet');
  }
  // ---- Research: the subject's own research brief. Sources not yet looked at do not stop the work.
  if(materialKnown&&m.total){
   const r=facts.research||{};
   if(r.step==='picked')add('facts','Research','The facts','done','Read and used');
   else if(r.step==='directions')add('facts','Research','The facts','flag','Findings to read');
   else if(r.step==='running')add('facts','Research','The facts','wait','Being looked into');
   else if(r.step==='needs-attention')add('facts','Research','The facts','flag','Needs a look');
   else if(r.step==='review')add('facts','Research','The facts','todo',r.unreviewed?plural(r.unreviewed,'source')+' not looked at yet':'Sources not looked at yet');
   else if(r.step==='research')add('facts','Research','The facts','todo','Ready to look into');
   else if(r.error)add('facts','Research','The facts','todo','Could not be read');
   else add('facts','Research','The facts','todo','Not looked into yet');
  }
  // ---- Simmer
  const d=facts.dish||{};
  if(d.named&&d.from==='board')add('dish','Simmer','Name the dish','done',d.at&&day(d.at)?'Named on the board, '+day(d.at):'Named on the board');
  else if(d.named)add('dish','Simmer','Name the dish','done','From your direction');
  else if(materialKnown&&!m.total)add('dish','Simmer','Name the dish','wait','When there is something to look at',{waits:['have']});
  else add('dish','Simmer','Name the dish','todo',d.dishes?plural(d.dishes,'possible dish','possible dishes'):'Not named yet');
  // ---- Create and Share, from the form
  if(form){
   const kind=form.kind,p=form.piece||{},w=facts.words||{paragraphs:0,count:0},c=facts.check;
   if(TEXT.has(kind)||kind==='slides'){
    const wordsName=kind==='post'?'The lines':kind==='slides'?'The words on the slides':'The words';
    if(kind==='slides'){const n=p.slides||0;add('slides','Create','The slides',n?'done':'todo',n?plural(n,'slide'):'Not laid out yet');}
    if(!w.paragraphs)add('words','Create',wordsName,'todo','Not started');
    else if(facts.pending)add('words','Create',wordsName,'flag',plural(facts.pending,'suggestion')+' waiting');
    else add('words','Create',wordsName,'done',plural(w.count,'word'));
    if(kind!=='slides'){
     const photosName=kind==='article'?'Photographs in the article':kind==='post'?'The picture':'Photographs';
     if(p.placements)add('photos','Create',photosName,'done',plural(p.placements,'placed','placed'));
     else if(!m.photos)add('photos','Create',photosName,'wait','No photographs added yet',{missing:'addPhotos'});
     else add('photos','Create',photosName,'todo','None placed yet');
    }
    const wordsDone=find('words').state==='done';
    if(!wordsDone)add('check','Create','Check','wait',w.paragraphs?'Waits for the suggestion to be settled':'Waits for the words',{waits:['words']});
    else if(!c)add('check','Create','Check','todo','Not checked yet');
    else if(c.status==='running')add('check','Create','Check','wait','Checking');
    else if(c.status==='checked'&&!c.issues)add('check','Create','Check','done','Checked');
    else if(c.issues)add('check','Create','Check','flag',plural(c.issues,'thing')+' to look at');
    else add('check','Create','Check','flag','Check again');
   }
   if(kind==='instagram'){
    const pl=p.plan||{};
    if(pl.chosen)add('story','Create','The story','done',pl.chosenTitle||'Chosen');
    else if(pl.stories)add('story','Create','The story','flag',plural(pl.stories,'story','stories')+' to choose from');
    else add('story','Create','The story','wait','Waits for stories to be proposed');
    if(pl.frames)add('slides','Create','The slides','done',plural(pl.frames,'slide'));
    else if(pl.chosen)add('slides','Create','The slides','todo','Not laid out yet');
    else add('slides','Create','The slides','wait','Waits for the story',{waits:['story']});
    if(pl.caption)add('posttext','Create','The post text','done','Written');
    else if(pl.frames)add('posttext','Create','The post text','todo','Not written');
    else add('posttext','Create','The post text','wait','Waits for the slides',{waits:['slides']});
   }
   // Share: the consent desk, then the way out.
   const y=facts.consent,people=y?.people||[];
   const yesName=people.length===1?people[0].name+'’s yes':people.length>1?'Their yes':'Your yes';
   if(!y)add('yes','Share',yesName,'todo','Could not be read');
   else if(y.released||y.overridden||y.ready&&!y.held)add('yes','Share',yesName,'done',y.overridden?'Overridden':y.released?'Given':'Everyone said yes');
   else{
    const no=people.find(x=>x.state==='no'),ask=people.find(x=>x.state==='not-asked'&&!x.request),drafted=people.find(x=>x.state==='not-asked'&&x.request),asked=people.find(x=>x.state==='asked');
    if(no)add('yes','Share',yesName,'flag',no.name+' said no');
    else if(ask)add('yes','Share',yesName,'todo','Not asked yet');
    else if(drafted)add('yes','Share',yesName,'todo','Request drafted, not sent');
    else if(asked)add('yes','Share',yesName,'wait','Asked, no answer yet');
    else add('yes','Share',yesName,'todo',people.length?'Your two answers':'Not answered yet');
   }
   const outName=kind==='article'?'Publish':kind==='product-listing'?'List it':'Post';
   const before=kind==='instagram'?['transcript','slides','posttext','yes']:['words','check','yes'];
   const waits=before.filter(x=>find(x)&&find(x).state!=='done');
   const said=x=>x==='check'?'the check':x==='slides'?'the slides':x==='transcript'?'the words to confirm':x==='words'?'the words':x==='posttext'?'the post text':find(x).name==='Your yes'?'your yes':find(x).name;
   if(kind==='instagram'&&p.plan?.ready)add('publish','Share',outName,'done','Ready to post');
   else if(waits.length)add('publish','Share',outName,'wait','Waits for '+join(waits.map(said)),{waits});
   else add('publish','Share',outName,'todo','Not yet');
  }
  // A step resting on facts still being read says so; a step waiting on one that is being read is not known either.
  for(const s of steps)if(s.state!=='reading'&&(NEEDS[s.id]||[]).some(g=>reading.has(g))){s.state='reading';s.note='Reading';delete s.waits;delete s.missing;}
  // The next thing to make: the first to do after the furthest step already done, else the first to do.
  let last=-1;steps.forEach((s,i)=>{if(s.state==='done')last=i;});
  const next=steps.find((s,i)=>i>last&&s.state==='todo')||steps.find(s=>s.state==='todo');if(next)next.state='now';
  return steps;
 }
 /** The step the page opens on: the first that needs him, else the next thing to make, else the first waiting. Null
     while any step is still being read, so the page never opens one and then moves under him. */
 function firstOpen(steps,{settle=true}={}){
  if(settle&&steps.some(s=>s.state==='reading'))return null;
  const known=steps.filter(s=>s.state!=='reading');
  return (known.find(s=>s.state==='flag')||known.find(s=>s.state==='now')||known.find(s=>s.state==='wait')||known[0]||null)?.id||null;
 }
 /** How far a form is, 0 to 1, and as "n/m". */
 const progress=steps=>{const done=steps.filter(s=>s.state==='done').length;return {done,total:steps.length,p:steps.length?done/steps.length:0,label:done+'/'+steps.length};};
 /** The kinds Add a form can really make, each with whether it can be made now and, if not, why. */
 function addable(facts={}){
  const m=facts.material||{},w=facts.words||{};
  return ['article','carousel','post','product-listing'].map(kind=>{
   const k=KINDS[kind];let ready=true,why='';
   if(kind==='article'&&!w.paragraphs){ready=false;why='Write a few words first.';}
   if(kind==='carousel'&&!((m.recordings||0)+(m.notes||0))){ready=false;why='Add a recording or a note first.';}
   if(k.make==='output'&&!facts.bindingId){ready=false;why='This subject has no saved writing yet.';}
   return {kind,name:k.name,to:k.to,what:k.what,needs:k.needs,ready,why};
  });
 }
 /** Which of the twelve sections a list of steps reaches. */
 const reached=steps=>TWELVE.filter(s=>steps.some(x=>x.sections.includes(s)));
 /** Sort a subject's materials into recordings, notes, links and photographs. */
 function sortMaterial(items){
  const out={total:0,recordings:0,notes:0,links:0,photos:0,items:[]};
  for(const s of items||[]){const k=kindOf(s);out[k]++;out.total++;out.items.push({...s,kind:k});}
  return out;
 }
 function kindOf(s){
  const k=String(s?.kind||'').toLowerCase();
  if(['image','photo','photograph','picture','photos'].includes(k)||/\.(jpe?g|png|heic|webp|gif|tiff?)$/i.test(s?.rel_path||''))return 'photos';
  if(['audio','video','transcript','recording','recordings'].includes(k)||s?.recordingId||s?.transcriptState||s?.transcriptProvenance)return 'recordings';
  if(['link','url','web','webpage','youtube','links'].includes(k)||/^https?:/i.test(s?.url||''))return 'links';
  return 'notes';
 }
 /** Which reads a change touches, by the start of its command name. The longest start wins; none means none. */
 const TOUCHES=Object.freeze([
  ['study-draft.check',['check']],['study-draft',['read','check','requests']],['study-ai',['requests','read']],['study.outputs',['outputs']],
  ['study.human-direction',['direction','board']],['concept',['direction']],['simmer',['board','direction']],['instagram',['plans']],
  ['consent',['desk']],['subject-places',['place']],['words',['wordChecks']],['transcript-check',['wordChecks']],
  ['sources',['tree','brief']],['recordings',['tree','brief']],['first-flow',['brief','binding']],['study.material',['brief','tree']],['study.research',['brief']],['study.photos',['tree']],
 ]);
 const READS=Object.freeze(['catalog','place','binding','direction','outputs','plans','brief','board','desk','requests','read','check','wordChecks','tree']);
 function touched(kind){const k=String(kind||'');let best=null;for(const [start,keys] of TOUCHES)if(k.startsWith(start)&&(!best||start.length>best[0].length))best=[start,keys];return best?[...best[1]]:[];}

 const pure=Object.freeze({TWELVE,SECTIONS,SECTION_LABEL,HANDOFFS,GROUPS,KINDS,NEEDS,READS,factsFrom,formsOf,stepsFor,firstOpen,progress,addable,reached,sortMaterial,kindOf,touched});
 if(typeof module==='object'&&module.exports)module.exports=pure;
 const v2=root.v2;if(!v2||typeof v2.screen!=='function')return;

 // =====================================================================================================
 // The screen half.
 // =====================================================================================================
 const {esc,icon,ring,step:mark}=v2.ui;
 const SAY_STATE={done:'Done',now:'Next',flag:'Needs a look',todo:'To do',wait:'Waiting',reading:'Reading'};
 const call=(name,input)=>v2.call(name,input).catch(error=>({__error:error}));
 const cssq=v=>root.CSS?.escape?root.CSS.escape(v):String(v).replace(/["\\]/g,'\\$&');
 // Line icons this screen needs that the shell does not draw. 24 by 24, stroke only.
 const OWN_ICONS={mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',note:'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',photo:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01'};
 const ownIcon=name=>`<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${OWN_ICONS[name]}"/></svg>`;

 /** Read the records one subject's page needs, through the commands, all at once. `only` names the reads to ask
     again (the rest are kept from `prev`); `onPart(key, records)` hears each answer as it arrives. Returns the records:
     catalog, place, binding, direction, outputs, plans and planRecords, brief, board, desk, requests, read, check,
     wordChecks, tree. A failed read is {__error}. One function, so it can later become one gathered command. */
 async function gather(id,{only=null,prev={},onPart=()=>{}}={}){
  const rec={...prev},want=k=>!only||only.includes(k)||rec[k]===undefined;
  const put=(k,v)=>{rec[k]=v;onPart(k,rec);};
  const jobs=[];
  const ask=(k,name,input)=>{if(want(k))jobs.push(call(name,input).then(v=>put(k,v)));};
  // Reads that need nothing but the subject's name start at once.
  ask('place','subject-places',{parentStudyId:id});
  ask('binding','first-flow.binding',{projectKey:id});
  ask('direction','study.human-direction',{parentStudyId:id});
  ask('board','simmer.board.get',{subject:id});
  ask('desk','consent.desk',{parentStudyId:id});
  ask('wordChecks','words.checks',{});
  ask('tree','sources.tree',{});
  if(want('plans'))jobs.push(call('instagram.plans',{subject:id}).then(async v=>{
   const list=ok(v)?(v.plans||[]).filter(p=>p.subject===id):[];
   const records=await Promise.all(list.map(p=>call('instagram.plan.get',{id:p.id})));
   rec.plans=v;put('planRecords',records);
  }));
  // The saved writing place (from the catalogue) is needed by the reads that work on the writing.
  if(want('catalog'))put('catalog',await call('study-draft.catalog',{}));
  const b=homeOf(id,rec.catalog)?.bindingId;
  if(b){
   const scope={bindingId:b,parentStudyId:id};
   ask('outputs','study.outputs',{rootBindingId:b,parentStudyId:id});
   ask('requests','study-ai.requests',scope);
   ask('read','study-draft.read',scope);
   ask('check','study-draft.check.get',scope);
   ask('brief','study.research.brief',scope);
  }else for(const k of ['outputs','requests','read','check','brief'])if(want(k))put(k,null);
  await Promise.all(jobs);
  return rec;
 }
 /** Research topics tied to this subject, for the open step only (they change no state). The topic list holds
     topics, not subjects; only those sharing a source with the subject are asked about, all at once. */
 async function topicsOf(facts){
  if(!facts.bindingId||!facts.projectId)return {list:[]};
  const cat=await call('inquiries.catalog',{});if(!ok(cat))return {error:true,list:[]};
  const mine=new Set(facts.material.items.map(x=>x.id)),selector={workspaceId:facts.projectId,parentStudyId:facts.id,rootBindingId:facts.bindingId};
  const cols=(cat.collections||[]).filter(c=>(c.sourceIds||[]).some(s=>mine.has(s)));
  const views=await Promise.all(cols.map(c=>call('inquiries.project',{collectionId:c.id,projectSelector:selector})));
  const list=[];views.forEach((v,i)=>{if(!ok(v))return;const rel=(v.relationships||[]).find(r=>r.to?.parentStudyId===facts.id&&['accepted','proposed'].includes(r.status));if(rel)list.push({id:cols[i].id,name:cols[i].name,status:rel.status});});
  return {list:list.sort((a,b)=>a.name.localeCompare(b.name))};
 }

 // ---------- the page ----------
 const render=ctx=>`<div class="v2-page subj" data-subject="${esc(ctx.params.id)}"><header class="subj-head" data-subj-head><h1>&nbsp;</h1></header><nav class="subj-forms" data-subj-forms aria-label="Forms, in order"></nav><div class="subj-work"><nav class="subj-steps" data-subj-steps aria-label="Steps to the finish line"></nav><section class="subj-step" data-subj-panel aria-label="The open step" hidden></section></div></div>`;

 function mount(el,ctx){
  const id=ctx.params.id,page=el.querySelector('.subj');
  const st={rec:{},facts:null,form:null,open:null,openSet:false,drafts:{},sayLine:'',busy:false,frames:new Map(),topics:undefined,last:{}};
  const phone=root.matchMedia?root.matchMedia('(max-width:850px)'):{matches:false};
  let lookNames=new Map(),queued=null,timer=null,paintTimer=null,settleTimer=null;
  const $=sel=>page.querySelector(sel);

  /** Read (all, or only the named reads), painting as answers arrive. */
  async function refresh(only=null){
   const done=await gather(id,{only,prev:st.rec,onPart:(k,rec)=>{st.rec=rec;schedule();}});
   if(ctx.signal.aborted)return;st.rec=done;paintNow();
  }
  // Paint at most every 40 ms while answers pour in.
  const schedule=()=>{if(!paintTimer)paintTimer=setTimeout(()=>{paintTimer=null;paintNow();},40);};
  ctx.signal.addEventListener('abort',()=>{clearTimeout(timer);clearTimeout(paintTimer);clearTimeout(settleTimer);});
  // If something is still being read after a while, open the step that is known to need him rather than nothing.
  settleTimer=setTimeout(()=>{if(!st.openSet&&st.facts){st.settleAnyway=true;paintNow();}},8000);

  // Changes: only those about this subject (or naming no record), and only the reads their kind touches.
  ctx.on({},e=>{
   if(e.reset){st.topics=undefined;return later(READS);}
   const kind=String(e.kind||''),sid=e.scope?.id,f=st.facts;
   if(kind.startsWith('inquiries')){if(st.topics!==undefined){st.topics=undefined;paintNow();}return;}
   if(sid&&!(sid===id||sid===f?.bindingId||sid===f?.projectId||f?.pieces?.some(p=>p.id===sid)))return;
   const keys=touched(kind);if(keys.length)later(keys);
  });
  function later(keys){queued=new Set([...(queued||[]),...keys]);clearTimeout(timer);timer=setTimeout(()=>{const only=[...queued];queued=null;refresh(only);},250);}
  phone.addEventListener?.('change',()=>placePanel());

  // ---------- drawing, in place ----------
  const formNow=()=>{const forms=formsOf(st.facts);return {forms,form:forms.find(x=>x.key===st.form)||null};};
  function paintNow(){
   if(ctx.signal.aborted)return;
   const f=factsFrom(id,st.rec);
   if(st.missing)return;
   if(st.rec.catalog!==undefined&&!f.found){st.missing=true;page.innerHTML=missing(st.rec.catalog);return;}
   st.facts=f;
   if(f.found){ctx.setTitle(f.title);if(f.look)v2.brand(f.look);}
   let {forms,form}=formNow();
   if(!form&&!f.reading.includes('pieces')){st.form=forms[0]?.key||null;form=forms[0]||null;}
   const steps=stepsFor(form,f);
   // The page chooses its open step once, when everything it rests on is known; after that only he changes it.
   if(!st.openSet){if(!f.reading.length||st.settleAnyway){const pick=firstOpen(steps,{settle:!st.settleAnyway});if(pick){st.open=pick;st.openSet=true;}}}
   else if(!steps.some(s=>s.id===st.open))st.open=firstOpen(steps,{settle:false});
   swap('[data-subj-head]',head(f),'outer');
   swap('[data-subj-forms]',formRow(f,forms,form),'outer');
   paintSteps(steps,form);
   paintPanel(steps,form);
  }
  /** Replace a part only when its markup changed, keeping focus where it was. */
  function swap(sel,html,how){
   const node=$(sel);if(!node||st.last[sel]===html)return;st.last[sel]=html;
   const back=node.contains(document.activeElement)?keyOf(document.activeElement):null;
   if(how==='outer')node.outerHTML=html;else node.innerHTML=html;
   if(back)$(back)?.focus({preventScroll:true});
  }
  function paintSteps(steps,form){
   const nav=$('[data-subj-steps]'),shape=JSON.stringify([form?.key||null,steps.map(s=>s.id)]);
   if(nav.dataset.shape!==shape){
    const panel=$('[data-subj-panel]');if(panel&&panel.parentElement!==$('.subj-work'))$('.subj-work').append(panel);
    nav.dataset.shape=shape;nav.innerHTML=stepList(steps,form);return;
   }
   // Same steps: update each row in place.
   for(const s of steps){const li=nav.querySelector(`.subj-row[data-step="${s.id}"]`),html=rowInner(s);if(li&&li.dataset.html!==html){const focused=li.contains(document.activeElement);const panel=li.querySelector(':scope>[data-subj-panel]');li.dataset.state=s.state;li.toggleAttribute('data-open',s.id===st.open);li.dataset.html=html;const btn=li.querySelector(':scope>[data-subj-step]');btn.outerHTML=html;if(panel)li.append(panel);if(focused)li.querySelector(':scope>[data-subj-step]')?.focus({preventScroll:true});}}
  }
  const keyOf=n=>n.dataset?.subjStep&&n.closest('.subj-row')?`.subj-row[data-step="${n.dataset.subjStep}"]>[data-subj-step]`:n.dataset?.subjForm?`[data-subj-form="${cssq(n.dataset.subjForm)}"]`:n.dataset?.subjDraft?`[data-subj-draft="${cssq(n.dataset.subjDraft)}"]`:n.matches?.('[data-subj-say]')?'[data-subj-say]':n.matches?.('[data-subj-add]')?'[data-subj-add]':null;

  const handoffHref=(key,{piece,form}={})=>esc(v2.advanced({subject:id,section:HANDOFFS[key].section,piece:piece??pieceOf(form)}));
  function head(f){
   if(!f.found)return `<header class="subj-head" data-subj-head><h1>&nbsp;</h1></header>`;
   const look=f.look?`<span class="subj-look"><i aria-hidden="true"></i>${esc(lookNames.get(f.look)||f.look)} look</span>`:'';
   const path=f.folder.length?`<span class="subj-path" title="${esc(f.folder.join(' / '))}">${esc(f.folder.join(' / '))}</span>`:'';
   const dir=f.reading.includes('dish')?'':f.direction?`<p class="subj-dir"><span title="${esc(f.direction)}">${esc(f.direction)}</span><a class="v2-out" data-subj-handoff="directionChange" href="${handoffHref('directionChange',{piece:null})}" aria-label="Change the direction (opens Advanced)">${HANDOFFS.directionChange.label}</a></p>`
    :`<p class="subj-dir none"><span>No direction yet</span><a class="v2-out" data-subj-handoff="directionWrite" href="${handoffHref('directionWrite',{piece:null})}" aria-label="Write the direction (opens Advanced)">${HANDOFFS.directionWrite.label}</a></p>`;
   return `<header class="subj-head" data-subj-head><h1 title="${esc(f.title)}">${esc(f.title)}</h1>${look}${path}<span class="subj-sp"></span>${dir}</header>`;
  }
  function formRow(f,forms,form){
   if(f.reading.includes('pieces')&&!forms.length)return `<nav class="subj-forms" data-subj-forms aria-label="Forms, in order"><span class="subj-form none"><span>Reading</span></span></nav>`;
   const pills=forms.map((x,i)=>{const pr=progress(stepsFor(x,f)),own=x.piece.title||'',sub=x.alike&&own?own:x.to;
    return `<button type="button" class="subj-form${x.key===form?.key?' v2-current on':''}" data-subj-form="${esc(x.key)}" aria-pressed="${x.key===form?.key}" aria-label="${i===0?'First':'Then'}: ${esc(x.name)}${x.to?' for '+esc(x.to):''}${own&&own!==f.title?', '+esc(own):''}, ${pr.done} of ${pr.total} steps done"${own?` title="${esc(own)}"`:''}><small aria-hidden="true">${i===0?'First':i+1}</small>${ring(pr.p)}<b>${esc(x.name)}</b>${sub?`<span${x.alike&&own?' class="own"':''}>${esc(sub)}</span>`:''}<em>${pr.label}</em></button>`;}).join('');
   const none=forms.length?'':`<span class="subj-form none"><b>Not decided yet</b><span>Gather first</span></span>`;
   return `<nav class="subj-forms" data-subj-forms aria-label="Forms, in order">${none}${pills}<button type="button" class="subj-form add" data-subj-add>${icon('plus')}<b>Add a form</b></button></nav>`;
  }
  function stepList(steps,form){
   const groups=GROUPS.map(g=>{const rows=steps.filter(s=>s.group===g);if(!rows.length)return '';
    return `<p class="subj-group">${g}</p><ol>${rows.map(s=>{const html=rowInner(s);return `<li class="subj-row" data-step="${s.id}" data-state="${s.state}"${s.id===st.open?' data-open':''} data-html="${esc(html)}">${html}</li>`;}).join('')}</ol>`;}).join('');
   const rest=form||st.facts.reading.includes('pieces')?'':`<p class="subj-later">The rest appears when you say what it will be.</p>`;
   const all=`<details class="subj-all"><summary>All twelve sections</summary><ul>${TWELVE.map(s=>`<li><a data-subj-section="${s}" href="${esc(v2.advanced({subject:id,section:s,piece:pieceOf(form)}))}">${SECTION_LABEL[s]}${icon('out')}</a></li>`).join('')}</ul></details>`;
   return groups+rest+all;
  }
  const rowInner=s=>{const on=s.id===st.open,shown=on||['flag','now','wait','reading'].includes(s.state);
   return `<button type="button" data-subj-step="${s.id}" aria-expanded="${on}"${on?' class="v2-current"':''}${s.state==='reading'?' aria-busy="true"':''}>${s.state==='reading'?'<i class="subj-reading" aria-hidden="true"></i>':mark(s.state)}<b>${esc(s.name)}</b><small${shown?'':' class="quiet"'}>${esc(s.note)}<span class="subj-sr"> (${SAY_STATE[s.state]})</span></small></button>`;};
  const pieceOf=form=>form&&form.piece&&form.kind!=='instagram'?form.piece.id:undefined;

  function paintPanel(steps,form){
   const panel=$('[data-subj-panel]');if(!panel)return;
   const s=steps.find(x=>x.id===st.open);
   if(!s){panel.hidden=true;st.last.panel='';return;}
   const html=`<header><p class="subj-label">${esc(s.group)}</p><h2 tabindex="-1">${esc(s.name)}</h2>${s.note?`<p class="subj-note" data-state="${s.state}">${s.state==='reading'?'<i class="subj-reading" aria-hidden="true"></i>':mark(s.state)}<span>${esc(s.note)}</span></p>`:''}</header>${s.state==='reading'?'':tool(s,form,steps)}${nextUp(s,steps)}`;
   panel.hidden=false;
   if(st.last.panel!==html){const back=panel.contains(document.activeElement)?keyOf(document.activeElement):null;st.last.panel=html;panel.innerHTML=html;paintFrames(panel);if(back)$(back)?.focus({preventScroll:true});}
   placePanel();
  }
  /** On a phone the open step sits under its own row; on a computer, beside the list. One panel, moved, never two. */
  function placePanel(){
   const panel=$('[data-subj-panel]'),work=$('.subj-work');if(!panel||!work)return;
   const open=$('.subj-row[data-open]');
   if(phone.matches&&open){if(panel.parentElement!==open)open.append(panel);panel.classList.add('inline');}
   else{if(panel.parentElement!==work)work.append(panel);panel.classList.remove('inline');}
  }
  function nextUp(s,steps){
   if(s.state!=='done')return '';
   const nx=steps.find(x=>x.state==='flag')||steps.find(x=>x.state==='now');
   return nx?`<footer class="subj-next"><button type="button" class="pri" data-subj-step="${nx.id}">Next: ${esc(nx.name)}${icon('right')}</button></footer>`:'';
  }
  /** A hand-off link, named in HANDOFFS so its label and its section cannot drift apart. */
  const out=(key,form,{piece}={})=>`<a class="v2-out" data-subj-handoff="${key}" href="${handoffHref(key,{piece,form})}">${esc(HANDOFFS[key].label)}${icon('out')}</a>`;
  const links=(...items)=>`<div class="subj-links">${items.filter(Boolean).join('')}</div>`;
  const waitsFor=(s,steps,form)=>(s.waits?.length?`<ul class="subj-list subj-waits">${s.waits.map(w=>{const t=steps.find(x=>x.id===w);return t?`<li>${mark(t.state)}<span><b>${esc(t.name)}</b><small>${esc(t.note)}</small></span><button type="button" class="v2-ghost" data-subj-step="${t.id}">Open${icon('chev')}</button></li>`:'';}).join('')}</ul>`:'')+(s.missing?links(out(s.missing,form,{piece:null})):'');

  function tool(s,form,steps){
   switch(s.id){
    case 'have':return toolHave(form);
    case 'transcript':return toolTranscript(form);
    case 'facts':return toolFacts(form);
    case 'dish':return toolDish(s,steps,form);
    case 'words':return toolWords(form);
    case 'photos':return waitsFor(s,steps,form)+(s.missing?'':links(out('media',form),out('arrange',form)));
    case 'check':return toolCheck(s,form,steps);
    case 'story':return toolStory(form);
    case 'slides':return form?.kind==='instagram'?toolSlides(form):links(out('slides',form));
    case 'posttext':return waitsFor(s,steps,form)+`<div class="subj-actions">${studio(form)}</div>`+links(out('postWrite',form),out('postRead',form),out('postCheck',form));
    case 'yes':return toolYes(form);
    case 'publish':return toolPublish(s,form,steps);
   }
   return '';
  }
  function toolHave(form){
   const m=st.facts.material,photos=m.items.filter(x=>x.kind==='photos'),rest=m.items.filter(x=>x.kind!=='photos');
   const KIND={recordings:'Recording',notes:'Note',links:'Link'};
   const list=rest.length?`<ul class="subj-list subj-have">${rest.slice(0,10).map(x=>`<li><span><b title="${esc(x.title)}">${esc(x.title)}</b></span><small>${KIND[x.kind]}</small></li>`).join('')}${rest.length>10?`<li><small>and ${rest.length-10} more</small></li>`:''}</ul>`:'';
   const tray=photos.length?`<div class="subj-tray">${photos.slice(0,12).map(x=>`<img src="/api/sources/blob?id=${encodeURIComponent(x.id)}" alt="${esc(x.title)}" loading="lazy">`).join('')}${photos.length>12?`<span>+${photos.length-12}</span>`:''}</div>`:'';
   const to=handoffHref('addMaterial',{piece:null});
   const ways=`<div class="subj-ways">${[['mic','A recording','Record, or add one'],['note','A note or a link','A thought, a page, a video'],['photo','Photographs','From this device or the Library']].map(([ic,n,w])=>`<a data-subj-handoff="addMaterial" href="${to}" aria-label="${n} (opens Material in Advanced)">${ownIcon(ic)}<b>${n}${icon('out')}</b><span>${w}</span></a>`).join('')}</div>`;
   return list+tray+(m.total?`<p class="subj-label">Add more</p>`:'')+ways+(m.total?links(out('readSources',form,{piece:null})):'');
  }
  function toolTranscript(form){
   const t=st.facts.transcript;
   const words=t.flags.length?`<ol class="subj-talk">${t.flags.slice(0,6).map(x=>`<li><p class="v2-speech">${hl(x.line,x.heard)}</p><small>${esc(x.why||'To confirm')}</small></li>`).join('')}</ol>${t.flags.length>6?`<p class="subj-quiet">and ${t.flags.length-6} more</p>`:''}`:'';
   const plan=t.flags[0]?.planId;
   const who=v2.actor()&&!v2.isHuman()?'&reviewActor='+encodeURIComponent(v2.actor()):'';
   const checks=t.checks.filter(c=>c.open).map(c=>`<li><span><b>${esc(c.story||'Recording')}</b><small>${plural(c.open,'word')} to hear</small></span><a class="v2-out" href="/transcript-check/index.html?job=${encodeURIComponent(c.jobId)}${who}">Hear them${icon('out')}</a></li>`).join('');
   return words+(checks?`<ul class="subj-list">${checks}</ul>`:'')+links(plan?`<a class="v2-out" href="/document-study/index.html?instagram=${encodeURIComponent(plan)}${who}">Confirm them in the slide studio, in Advanced${icon('out')}</a>`:'',out('readTranscript',form,{piece:null}));
  }
  const hl=(line,heard)=>{const i=heard?String(line).indexOf(heard):-1;return i<0?esc(line):esc(line.slice(0,i))+'<mark>'+esc(heard)+'</mark>'+esc(line.slice(i+heard.length));};
  function toolFacts(form){
   const r=st.facts.research,b=ok(st.rec.brief)?st.rec.brief:null,tp=st.topics;
   if(tp===undefined){st.topics=null;topicsOf(st.facts).then(t=>{if(ctx.signal.aborted)return;st.topics=t;paintNow();}).catch(()=>{st.topics={error:true,list:[]};paintNow();});}
   let body='';
   if(tp?.list.length)body+=`<p class="subj-label">Research topics</p><ul class="subj-list subj-topics">${tp.list.map(t=>`<li data-status="${t.status}"><span><b>${esc(t.name)}</b><small>${t.status==='proposed'?'Suggested, waiting for you':'In use here'}</small></span><a class="v2-out" href="${esc(v2.href('research/topic/:id',{id:t.id}))}">Open${icon('chev')}</a></li>`).join('')}</ul>`;
   else if(!tp)body+=`<p class="subj-quiet">Reading research topics</p>`;
   if(b?.research?.question)body+=`<div class="subj-one"><p class="subj-label">Asked</p><p>${esc(b.research.question)}</p></div>`;
   const toLook=(b?.materials||[]).filter(mm=>!mm.reviewed&&!['audio','image'].includes(mm.kind));
   if(r.step==='review'&&toLook.length)body+=`<p class="subj-label">Not looked at yet</p><ul class="subj-list subj-have">${toLook.slice(0,6).map(mm=>`<li><span><b title="${esc(mm.title)}">${esc(mm.title)}</b></span></li>`).join('')}</ul>`;
   return body+links(out(r.step==='review'?'researchLook':'research',form,{piece:null}));
  }
  function toolDish(s,steps,form){
   const d=st.facts.dish,f=ok(st.rec.board)?st.rec.board.forming||{}:{};
   let body=waitsFor(s,steps,form);
   if(f.dishes?.length)body+=`<p class="subj-label">It could be</p><ul class="subj-list subj-dishes">${f.dishes.slice(0,4).map(x=>`<li><span><b>${esc(x.title||x.dish||x.text||'')}</b>${x.why||x.reader?`<small>${esc(x.why||x.reader)}</small>`:''}</span>${x.by?`<em class="subj-by">${esc(v2.actorName(x.by))}’s proposal</em>`:''}</li>`).join('')}</ul>`;
   if(d.sentence)body+=`<div class="subj-named"><p class="subj-label">${d.from==='board'?'The dish, in your words':'Your direction'}</p><blockquote>${esc(d.sentence)}</blockquote></div>`;
   if(d.groups)body+=`<p class="subj-quiet">${plural(d.groups,'group')} on the board</p>`;
   return body+links(out('board',form,{piece:null}),out(d.sentence?'dishChange':'dishWrite',form,{piece:null}));
  }
  function toolWords(form){
   const f=st.facts,w=f.words,blocks=(ok(st.rec.read)?st.rec.read.projection||[]:[]).filter(x=>String(x.words||'').trim()).slice(0,5);
   const write=handoffHref('write',{form});
   const sheet=blocks.length?`<a class="subj-sheet" href="${write}" aria-label="Open the writing in Advanced" tabindex="-1"><b>${esc(form?.piece?.title||f.title)}</b>${blocks.map(x=>x.blockKind==='heading'?`<i>${esc(String(x.words).slice(0,80))}</i>`:`<span>${esc(String(x.words).slice(0,220))}</span>`).join('')}</a>`:'';
   const parts=w.parts.length?`<ol class="subj-parts">${w.parts.map(p=>`<li><i aria-hidden="true"></i><span>${esc(p.name)}</span><small>${plural(p.paragraphs,'paragraph')}</small></li>`).join('')}</ol>`:'';
   return `${sheet||parts?`<div class="subj-words">${sheet}<div>${parts}</div></div>`:''}<div class="subj-actions"><a class="subj-btn pri" data-subj-handoff="write" href="${write}">${HANDOFFS.write.label}${icon('right')}</a>${w.paragraphs?`<a class="subj-btn" data-subj-handoff="read" href="${handoffHref('read',{form})}">${HANDOFFS.read.label}</a>`:''}</div>`;
  }
  function toolCheck(s,form,steps){
   const c=st.facts.check;
   const list=c?.list?.length?`<ul class="subj-list">${c.list.map(m=>`<li><span>${esc(m)}</span></li>`).join('')}</ul>`:'';
   return waitsFor(s,steps,form)+list+links(out(c?'checkOpen':'checkRun',form));
  }
  const planOf=form=>(st.rec.planRecords||[]).filter(ok).find(p=>p.id===form?.piece?.plan?.id)||null;
  const studio=form=>form?.piece?.plan?`<a class="subj-btn pri" href="${esc(v2.href('slides/:id',{id:form.piece.plan.id}))}">Open the slide studio${icon('right')}</a>`:'';
  const igAdvanced=form=>`<a class="v2-out" href="/document-study/index.html?instagram=${encodeURIComponent(form.piece.plan.id)}${v2.actor()&&!v2.isHuman()?'&reviewActor='+encodeURIComponent(v2.actor()):''}">Open the slide studio in Advanced${icon('out')}</a>`;
  function toolStory(form){
   const p=planOf(form);if(!p)return '';
   const list=(p.stories||[]).map(x=>{const on=p.chosen?.storyId===x.id;return `<li>${mark(on?'done':'todo')}<span><b>${esc(x.title)}</b>${x.readback?`<small>${esc(x.readback)}</small>`:''}</span>${on?'<em class="subj-by">Chosen</em>':''}</li>`;}).join('');
   return (list?`<ul class="subj-list">${list}</ul>`:'')+`<div class="subj-actions">${studio(form)}${igAdvanced(form)}</div>`;
  }
  function toolSlides(form){
   const p=planOf(form),fmt=form.piece.plan.format,frames=p?.layouts?.[fmt]?.frames||[];
   const strip=frames.length?`<ol class="subj-strip" data-subj-strip="${esc(p.id)}" data-format="${esc(fmt)}">${frames.map((fr,i)=>`<li><div class="subj-frame" data-frame="${i}" data-tall="${fmt==='story'||fmt==='reel'?1:0}"></div><small>${i+1} · <b data-code="${esc(fr.templateId)}">${esc(codeMap?.get?.(fr.templateId)||fr.templateId)}</b></small></li>`).join('')}</ol>`:'';
   const say=p&&p.chosen?`<form class="subj-say" data-subj-sayform><label for="subj-say">Say the codes</label><div><input id="subj-say" data-subj-say value="${esc(st.sayLine)}" placeholder="use C1, 2 and 5" autocomplete="off" spellcheck="false"><button type="submit">Use them</button></div></form>`:'';
   return strip+say+`<div class="subj-actions">${studio(form)}${igAdvanced(form)}</div>`;
  }
  function toolYes(form){
   const y=st.facts.consent;if(!y)return links(out('desk',form,{piece:null}));
   const STATE={'not-asked':'Not asked','asked':'Asked','yes':'Said yes','yes-with-changes':'Said yes, with changes','no':'Said no'};
   const people=y.people.map(p=>{const draftable=p.state==='not-asked'&&!p.request;
    return `<li><div class="subj-person"><span><b>${esc(p.name)}</b><small>${esc(p.appears.join(', '))}</small></span><em class="subj-by" data-state="${esc(p.state)}">${esc(p.request&&p.state==='not-asked'?'Request drafted':STATE[p.state]||p.state)}</em></div>${draftable?`<form class="subj-draft" data-subj-draftform="${esc(p.id)}"><label for="subj-draft-${esc(p.id)}">Draft the request to ${esc(p.name)}</label><textarea id="subj-draft-${esc(p.id)}" rows="3" data-subj-draft="${esc(p.id)}">${esc(st.drafts[p.id]||'')}</textarea><button type="submit">Save the draft</button></form>`:''}</li>`;}).join('');
   const reasons=y.reasons.length&&!y.people.length?`<ul class="subj-list">${y.reasons.map(r=>`<li>${mark('todo')}<span>${esc(r)}</span></li>`).join('')}</ul>`:'';
   return (people?`<ul class="subj-people">${people}</ul>`:'')+reasons+links(out('desk',form,{piece:null}));
  }
  function toolPublish(s,form,steps){
   const posting=['instagram','slides','post'].includes(form?.kind)?`<p class="subj-quiet">Posting is not connected.</p>`:'';
   return waitsFor(s,steps,form)+posting+links(out('outputs',form),out('audience',form));
  }

  // ---------- the slides, drawn by the app's own renderer ----------
  let codeMap=null,codesAsked=null;
  const codes=()=>codesAsked||=v2.call('instagram.templates',{}).then(r=>{codeMap=new Map((r?.templates||[]).filter(t=>t.code).map(t=>[t.id,t.code]));return codeMap;}).catch(()=>new Map());
  function paintFrames(panel){
   const strip=panel.querySelector('[data-subj-strip]');if(!strip)return;
   const planId=strip.dataset.subjStrip,fmt=strip.dataset.format,rev=st.facts.pieces.find(p=>p.id===planId)?.plan.revision||0;
   codes().then(map=>{for(const b of strip.querySelectorAll('[data-code]')){const c=map.get(b.dataset.code);if(c)b.textContent=c;}});
   for(const box of strip.querySelectorAll('[data-frame]')){
    const i=box.dataset.frame,key=[planId,fmt,i,rev].join('|');
    if(!st.frames.has(key))st.frames.set(key,v2.call('instagram.render',{id:planId,format:fmt,frame:i}).then(r=>typeof r?.text==='string'?r.text:'').catch(()=>''));
    st.frames.get(key).then(text=>{if(!box.isConnected)return;
     if(!text){box.innerHTML='<span>Not drawn</span>';return;}
     const w=1080,h=box.dataset.tall==='1'?1920:1350,frame=document.createElement('iframe');
     frame.title='Slide '+(Number(i)+1);frame.setAttribute('sandbox','allow-same-origin');frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.srcdoc=text;frame.style.width=w+'px';frame.style.height=h+'px';
     const fit=()=>{frame.style.transform='scale('+(box.clientWidth/w)+')';};box.replaceChildren(frame);fit();if(typeof ResizeObserver==='function')new ResizeObserver(fit).observe(box);});
   }
  }

  // ---------- doing things ----------
  page.addEventListener('click',e=>{
   const b=e.target.closest('[data-subj-step]');
   if(b){e.preventDefault();openStep(b.dataset.subjStep);return;}
   const f=e.target.closest('[data-subj-form]');
   if(f){st.form=f.dataset.subjForm;st.openSet=false;st.settleAnyway=true;paintNow();$(`[data-subj-form="${cssq(st.form)}"]`)?.focus();return;}
   if(e.target.closest('[data-subj-add]'))addForm();
  });
  function openStep(sid){
   st.open=sid;st.openSet=true;
   paintNow();
   const panel=$('[data-subj-panel]');
   if(phone.matches)panel?.scrollIntoView?.({block:'nearest'});
   panel?.querySelector('h2')?.focus({preventScroll:!phone.matches});
  }
  page.addEventListener('input',e=>{const t=e.target;if(t.dataset.subjDraft)st.drafts[t.dataset.subjDraft]=t.value;if(t.matches('[data-subj-say]'))st.sayLine=t.value;});
  page.addEventListener('submit',async e=>{
   const form=e.target;e.preventDefault();if(st.busy)return;
   if(form.matches('[data-subj-draftform]')){
    const personId=form.dataset.subjDraftform,text=(st.drafts[personId]||'').trim();
    if(!text){v2.ui.say('Write the request first.',{tone:'warn'});return;}
    await act(['desk'],async()=>{const y=await v2.call('consent.desk',{parentStudyId:id});await v2.call('consent.people.draft-request',{parentStudyId:id,...v2.expect(y),personId,text});delete st.drafts[personId];v2.ui.say('The request is drafted. Sending it is yours, from the desk.',{tone:'good'});});
   }
   if(form.matches('[data-subj-sayform]')){
    const f=formNow().form,planId=f?.piece?.plan?.id,line=(st.sayLine||'').trim();if(!planId||!line)return;
    await act(['plans'],async()=>{const p=await v2.call('instagram.plan.get',{id:planId});const r=await v2.call('instagram.plan.codes',{id:planId,...v2.expect(p),say:line,format:f.piece.plan.format});st.sayLine='';v2.ui.say(typeof r?.summary==='string'?r.summary:'The slides follow the codes.',{tone:'good'});});
   }
  });
  async function act(keys,run){st.busy=true;page.setAttribute('aria-busy','true');try{await run();await refresh(keys);}catch(error){v2.ui.say(error?.message||'That could not be done. Nothing was changed.',{tone:'bad'});}finally{st.busy=false;page.removeAttribute('aria-busy');}}

  function addForm(){
   const kinds=addable(st.facts);
   const body=`<div class="subj-kinds">${kinds.map(k=>`<button type="button" data-subj-make="${k.kind}"${k.ready?'':` disabled aria-describedby="subj-why-${k.kind}"`}><b>${esc(k.name)}</b>${k.to?`<small>for ${esc(k.to)}</small>`:''}<span>${esc(k.what)}</span><em>Needs: ${esc(k.needs)}</em>${k.ready?'':`<em class="why" id="subj-why-${k.kind}">${esc(k.why)}</em>`}</button>`).join('')}</div>`;
   const sheet=v2.ui.sheet({title:'What else will this be?',body});sheet.el.classList.add('subj-sheetdlg');
   sheet.body.addEventListener('click',async e=>{const b=e.target.closest('[data-subj-make]');if(!b||b.disabled)return;b.disabled=true;
    try{const key=await make(b.dataset.subjMake);sheet.close();st.form=key;st.openSet=false;st.settleAnyway=true;await refresh(['outputs','plans']);v2.ui.say(KINDS[b.dataset.subjMake].name+' added.',{tone:'good'});}
    catch(error){b.disabled=false;v2.ui.say(error?.message||'It could not be added. Nothing was changed.',{tone:'bad'});}});
  }
  async function make(kind){
   const f=st.facts;
   if(kind==='carousel'){
    const items=f.material.items,transcripts=items.filter(x=>(x.kind==='recordings'||x.kind==='notes')&&x.hash).map(x=>({sourceId:x.id,sourceHash:x.hash})),photos=items.filter(x=>x.kind==='photos').map(x=>({sourceId:x.id,...(x.title&&x.title!=='Untitled'?{caption:x.title.slice(0,200)}:{})}));
    if(!transcripts.length)throw new v2.Error('Add a recording or a note first.');
    const plan=await v2.call('instagram.plan.post',{subject:f.id,title:f.title,material:{transcripts,photos}});return 'ig:'+plan.id;
   }
   const scope={rootBindingId:f.bindingId,parentStudyId:f.id};
   const [native,outs]=await Promise.all([v2.call('study-draft.read',{bindingId:f.bindingId,parentStudyId:f.id}),v2.call('study.outputs',scope)]);
   const r=await v2.call('study.outputs.create',{...scope,kind,sourceBindingId:f.bindingId,expectedNative:native.expected,expectedOutput:outs.expectedOutput});
   return 'out:'+(r?.view?.output?.id||r?.receipt?.operationId);
  }

  const missing=catalog=>`<header class="subj-head"><h1>This subject could not be found</h1></header><p class="subj-quiet">${esc(catalog?.__error?.message||'Nothing in the records has this name.')}</p><p><a class="v2-out" href="#/">Home${icon('right')}</a></p>`;
  call('looks',{}).then(r=>{if(!ok(r)||ctx.signal.aborted)return;lookNames=new Map((r.looks||[]).map(l=>[l.id,l.name]));if(st.facts?.look)paintNow();});
  return refresh();
 }

 v2.screen({id:'subject',title:'Subject',route:'subject/:id',render,mount});
 /** For Home: the pure steps, gather(), and one subject's forms, steps and ring, read from the records. */
 const shared=Object.freeze({...pure,gather,async read(id){const rec=await gather(id),facts=factsFrom(id,rec);if(!facts.found)return null;const forms=formsOf(facts),steps=stepsFor(forms[0]||null,facts);return {facts,forms:forms.map(f=>({key:f.key,kind:f.kind,name:f.name,to:f.to,...progress(stepsFor(f,facts))})),steps,progress:progress(steps)};}});
 // v2 is frozen by the shell, so v2.shared exists only once the shell makes it. Until then the same object is on window.
 try{if(!v2.shared)v2.shared={};}catch{}
 try{if(v2.shared&&typeof v2.shared==='object')v2.shared.subject=shared;}catch{}
 root.V2Subject=shared;
})(typeof window!=='undefined'?window:globalThis);
