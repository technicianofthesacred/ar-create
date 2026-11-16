/* A subject: its forms in order, the steps to the finish line, and every step's tool in a section of its own, one under
   another on one page: the side list jumps to a section and follows the page, and a section opens to the whole window.
   Two halves. The first is pure (it runs in a browser and under node --test, tests/v2-subject.test.mjs): the table of
   hand-offs to the existing workspace, how an answer of `subject.standing` is shown, which change concerns this
   subject, and the few things a tool needs worked out of records. The second half is the screen.
   Where the subject stands (the ring, the station, every form, every step, its state and what it waits for) comes ONLY
   from the command `subject.standing`, asked through one function, gather(). A tool reads its own records when its
   section comes near the window, never before, and never a list of every subject. Nothing here keeps a record past the open page. */
(function(root){
 'use strict';
 // coss ui's button look (window.coss, from /ui/kit/coss-classes.js) where version three loads it: primary for the
 // main step action, outline for the others, ghost for the quiet ones. Version two does not load the script, so there
 // the classes are empty and every button keeps its own look.
 const coss=o=>{try{return window.coss.button(o);}catch{return '';}};
 const CP=coss({variant:'default',size:'sm'}),CB=coss({variant:'outline',size:'sm'}),CQ=coss({variant:'ghost',size:'sm'});

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
  board:{label:'Open the Simmer board in Advanced',section:'direction'},dishChange:{label:'Change it in Advanced',section:'direction'},dishWrite:{label:'Write it in Advanced',section:'direction'},
  write:{label:'Write',section:'write'},read:{label:'Read it through',section:'read'},
  media:{label:'Choose photographs in Advanced',section:'media'},arrange:{label:'Place them in Advanced',section:'arrange'},addPhotos:{label:'Add photographs in Advanced',section:'material'},
  checkRun:{label:'Run the check in Advanced',section:'check'},checkOpen:{label:'Open the check in Advanced',section:'check'},
  story:{label:'Open the story in Advanced',section:'arrange'},slides:{label:'Open the slides in Advanced',section:'arrange'},desk:{label:'Open the desk in Advanced',section:'share'},
  outputs:{label:'Open Outputs in Advanced',section:'outputs'},audience:{label:'See it as readers will, in Advanced',section:'audience'},
  postWrite:{label:'Write in Advanced',section:'write'},postRead:{label:'Read in Advanced',section:'read'},postCheck:{label:'Check in Advanced',section:'check'},
 });
 /** The hand-offs each step offers, first the one `subject.standing` names as the step's own section. */
 const STEP_OUT=Object.freeze({
  have:['addMaterial','readSources'],transcript:['readTranscript'],facts:['research','researchLook'],dish:['dishChange','board'],
  form:['outputs'],words:['write','read'],photos:['media','arrange','addPhotos'],check:['checkRun','checkOpen'],
  story:['story'],slides:['slides','media'],posttext:['postWrite','postRead','postCheck'],yes:['desk'],publish:['outputs','audience'],
 });
 /** The words a step is said in. `unknown`: a record it rests on was not read, so nothing is claimed. */
 const STATE_SAY=Object.freeze({done:'Done',next:'Next',flag:'Needs a look',todo:'To do',wait:'Waiting',unknown:'Not known'});
 const TO_MARK=Object.freeze({done:'done',next:'now',flag:'flag',todo:'todo',wait:'wait'});
 const plural=(n,one,many=one+'s')=>n+' '+(n===1?one:many);
 const ok=r=>!!r&&!r.__error;

 /** The hand-off for a step's own section: the labelled one from the table when there is one, else a plain one. */
 function ownHandoff(step){
  const key=(STEP_OUT[step?.id]||[]).find(k=>HANDOFFS[k].section===step?.section);
  if(key)return {key,...HANDOFFS[key]};
  const section=step?.section;return section?{key:null,label:'Open '+(SECTION_LABEL[section]||section)+' in Advanced',section}:null;
 }
 /** One step as it is shown: its state, its marker, and the note under its name. A finished step carries no note, and
     a step not known says so and is never offered as the one to open. */
 function stepView(step){
  const state=STATE_SAY[step?.state]?step.state:'unknown',unknown=state==='unknown';
  return {id:step.id,name:step.name,group:step.group,state,mark:TO_MARK[state]||null,unknown,openable:!unknown,
   note:state==='done'?'':unknown?'Not known':String(step.note||''),say:STATE_SAY[state]};
 }
 /** The form the page shows first: the one the command's next step belongs to, else the first. */
 function chooseForm(standing,wanted=null){
  const forms=standing?.forms||[];
  return forms.find(f=>f.key===wanted)||forms.find(f=>f.key===standing?.next?.form)||forms[0]||null;
 }
 /** The steps shown for a form, or for a subject with no form yet. */
 const stepsOfForm=(standing,form)=>form?form.steps||[]:standing?.steps||[];
 /** The step a page opens on, once: the command's next step for the form when it can be opened; failing that the first
     step that needs him, is next, is to do, or waits; failing that the first one known. Never a step not known. */
 function firstOpen(steps,form=null){
  const known=(steps||[]).filter(s=>s.state!=='unknown');
  // The rule can name a step not known as the one to open (a Magazine story's Check): that one is offered, and no other.
  const named=form?.next?.step&&(known.find(s=>s.id===form.next.step)||(form.next.state==='unknown'?(steps||[]).find(s=>s.id===form.next.step&&s.state==='unknown'):null));
  if(named)return named.id;
  return (known.find(s=>s.state==='flag')||known.find(s=>s.state==='next')||known.find(s=>s.state==='todo')||known.find(s=>s.state==='wait')||known[0]||null)?.id||null;
 }
 /** What tells forms of one name apart, from the records alone: the piece's own title when it has one, its slide count,
     and the date it was made (the time too when those still match). Never a made-up name. '' for a form whose name is
     its own. One entry per form, in order. */
 function tellApart(forms){
  const when=iso=>{const d=new Date(iso||'');return isNaN(d)?null:d;};
  const day=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short',...(d.getFullYear()===new Date().getFullYear()?{}:{year:'numeric'})});
  const base=(forms||[]).map(f=>{
   if(!f?.alike)return '';
   // A title every one of them shares tells nothing apart, so it is left out.
   const own=String(f.title||'').trim(),shared=forms.filter(x=>x.alike&&x.name===f.name).every(x=>String(x.title||'').trim()===own),made=when(f.createdAt),changed=made?null:when(f.updatedAt);
   // A plan keeps no date it was made, only when it was last changed: it says that, and not more.
   return [shared&&forms.filter(x=>x.alike&&x.name===f.name).length>1?'':own,['slides','instagram'].includes(f.kind)&&f.slides>0?plural(f.slides,'slide'):'',made?'made '+day(made):changed?'changed '+day(changed):''].filter(Boolean).join(' · ');
  });
  // Still alike: add the time it was made, then the second, until the real records part them.
  const clock=[null,d=>d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),d=>d.toLocaleTimeString('en-GB')];
  const at=level=>base.map((x,j)=>{const e=when(forms[j]?.createdAt||forms[j]?.updatedAt);return x&&e&&clock[level]?x+', '+clock[level](e):x;});
  const apart=lines=>lines.every((x,j)=>!x||lines.every((y,k)=>k===j||y!==x||forms[k].name!==forms[j].name));
  for(let level=0;level<clock.length;level++){const lines=at(level);if(apart(lines)||level===clock.length-1)return lines;}
  return base;
 }
 /** How a form's pill reads: its ring, its n/m, and the line under its name (where it goes; with what tells it apart
     from another of its name, `detail` from tellApart, or else its own title). */
 function pillView(form,index,detail){
  const own=String(form.title||'').trim(),extra=form.alike?(detail===undefined?own:detail):'',line=extra?(form.to?form.to+' · '+extra:extra):form.to||'';
  return {key:form.key,name:form.name,line,lead:extra&&form.to?form.to+' · ':'',tell:extra,ring:form.ring||0,count:form.done+'/'+form.total,
   say:(index===0?'First: ':'Then: ')+form.name+(form.to?' for '+form.to:'')+(extra?', '+extra:'')+', '+form.done+' of '+form.total+' steps done'};
 }
 /** A Magazine story as the standing reads give it: the subject carries `origin`, its one Article form `owner`. */
 const isMagazine=standing=>standing?.origin?.kind==='magazine';
 /** The piece a link to Write, Read or Check names: a saved output's id, or a Magazine story's own piece id. */
 const pieceFor=form=>form&&form.owner?.kind==='magazine'?form.id||undefined:pieceOf(form);
 /** Where a Magazine story leads in the existing workspace. That workspace opens a story from a link only in its review
     mode (existing-work.js); in ordinary mode its Magazine pieces are opened from its own board, and `?subject=` does not
     know a story, so any such address would silently open another project. So the link leads to the workspace itself, and
     its words say so. `actor` is added the way v2.advanced adds it. */
 function magazineHref(storyId,{actor}={}){
  const q=new URLSearchParams();if(actor)q.set('reviewActor',actor);
  const text=String(q);return '/document-study/index.html'+(text?'?'+text:'');
 }
 /** The label of a hand-off once it leads to the workspace for a Magazine story: it says where it goes, not more. */
 const inMagazine=label=>/ in Advanced(,|$)/.test(label)?'Open the Magazine in Advanced':label;
 /** The output id of a saved Carousel (an older Outputs carousel, not an Instagram plan): version two's studio shows it read only. */
 const outputStudio=form=>form&&form.kind==='slides'&&/^out:/.test(form.key||'')?form.id||null:null;
 /** How many findings a research brief holds: its research words, its brief and each direction. null while it is not read. */
 function findingsOf(brief){
  if(!brief||brief.__error||typeof brief!=='object')return null;
  const r=brief.research||{},has=v=>typeof v==='string'&&v.trim()?1:0;
  return has(r.body)+has(r.brief)+(Array.isArray(brief.directions)?brief.directions.length:0);
 }
 /** The Facts step as shown once its brief is read: a result that came back says findings only when some are there. */
 function factsView(step,brief){
  if(step?.why!=='research-result')return step;
  const n=findingsOf(brief);if(n===null)return step;
  return n?{...step,state:'flag',note:'Findings to read'}:{...step,state:'wait',note:'The question is asked, waiting for findings',waitsFor:'Findings'};
 }
 /** What a transcript offers the one who is looking: "use" is Adrian's alone, so an assistant is shown it as his to do. */
 const transcriptAct=(act,human)=>act==='use'&&!human?'owner':act||null;
 /** The words for a refused or stale step on a recording, from the app's own answer when it gave one. */
 function sourceRefusal(error){
  const said=error?.body&&typeof error.body.error==='string'&&error.body.error?error.body.error:'';
  if(error?.status===409&&error?.command==='recordings.source')return said||'The transcript or the recording changed since you looked. Open its current source, then use it.';
  return error?.message||'That could not be done. Nothing was changed.';
 }
 /** The piece (an output id) a hand-off to Advanced keeps: only a saved output has one. */
 const pieceOf=form=>form&&/^out:/.test(form.key||'')?form.id:undefined;

 /** Changes that never alter where a subject stands (the server ignores the same). */
 const QUIET=[/^presence/,/^leases?\./,/^handoff$/,/^needs-decision$/,/^journal\./,/^looks?\b/,/^accounts?\b/,/^templates?\b/,/^template\./,/^instagram\.template/,/^subject-places\.folders/,/^terminal/,/^study-draft\.open$/];
 /** Does a change concern this subject? One about its own records (its id, its writing place, project, a piece or a
     plan) does; one naming no record might; one about another subject does not. */
 function concerns(event,standing){
  if(!event)return false;
  if(event.reset)return true;
  const kind=String(event.kind||'');if(QUIET.some(r=>r.test(kind)))return false;
  const id=event.scope?.id;if(typeof id!=='string'||!id)return true;
  const mine=new Set([standing?.id,standing?.facts?.bindingId,standing?.facts?.projectId,...(standing?.forms||[]).map(f=>f.id)].filter(Boolean));
  if(mine.has(id))return true;
  return !['project','subject'].includes(event.scope?.kind);
 }
 /** The kinds of piece Add a form offers, in the sample's order: every one the app can make, then the ones it cannot yet. */
 const KINDS=Object.freeze({
  post:{name:'Post',to:'Instagram',what:'A few lines and a picture',needs:'nothing to start'},
  story:{name:'Story',to:'Instagram',what:'Three to five frames',needs:'',unbuilt:true},
  video:{name:'Video',to:'Instagram',what:'A short reel',needs:'',unbuilt:true},
  'product-listing':{name:'Product listing',to:'the shop',what:'A thing, with its story',needs:'nothing to start'},
  newsletter:{name:'Newsletter',to:'email',what:'A letter to readers',needs:'',unbuilt:true},
  'shared-notes':{name:'Shared notes',to:'people you choose',what:'What you learned, plainly',needs:'',unbuilt:true},
  article:{name:'Article',to:'the magazine',what:'A long read in your words',needs:'your first words',hadNeeds:'some words in Write'},
  carousel:{name:'Carousel',to:'Instagram',what:'Slides, one line each',needs:'a recording or a note; photographs help'},
 });
 /** The kinds Add a form shows, each with whether it can be made now and, if not, why. The facts are the command's own
     (`facts.words`, `facts.material`, `facts.bindingId`). A kind the app cannot make yet is listed and says so. */
 function addable(facts={},forms=[]){
  const m=facts.material;
  return Object.entries(KINDS).map(([kind,k])=>{
   let ready=true,why='';
   if(k.unbuilt){return {kind,name:k.name,to:k.to,what:k.what,needs:k.needs,ready:false,unbuilt:true,why:'Not built yet.'};}
   // An Article starts in Write, for any subject with a draft: with words already saved it is made at once, and with none Write
   // opens on an empty page and his first saved words start it. He can write before he has a source.
   if(kind==='carousel'&&!((m?.recordings||0)+(m?.notes||0))){ready=false;why=m?'Add a recording or a note first.':'Not known yet.';}
   if(kind!=='carousel'&&!facts.bindingId){ready=false;why='This subject has no saved writing yet.';}
   const needs=kind==='article'?((forms||[]).some(x=>x?.kind==='article')?k.hadNeeds:facts.words?.paragraphs>0?'Starts from your saved words':k.needs):k.needs;
   return {kind,name:k.name,to:k.to,what:k.what,needs,ready,unbuilt:false,why};
  });
 }

 // ---- the records a tool reads when its step is opened ----
 const kindOf=s=>{
  const k=String(s?.kind||'').toLowerCase();
  if(['image','photo','photograph','picture','photos'].includes(k)||/\.(jpe?g|png|heic|webp|gif|tiff?)$/i.test(s?.rel_path||''))return 'photos';
  if(['audio','video','transcript','recording','recordings'].includes(k)||s?.recordingId||s?.transcriptState||s?.transcriptProvenance)return 'recordings';
  if(['link','url','web','webpage','youtube','links'].includes(k)||/^https?:/i.test(s?.url||''))return 'links';
  return 'notes';
 };
 /** The recording a kept transcript belongs to: the Library tree leaves these files out, but a subject's own list names the file,
     and a recording's transcript always sits under Transcription/<job id>. */
 const jobOfPath=p=>(String(p||'').match(/(?:^|[\\/])Transcription[\\/]([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})[\\/]/i)||[])[1]||'';
 function sourcesById(tree){
  const map=new Map();if(!ok(tree))return map;
  for(const s of tree.sources||[])if(s?.id)map.set(s.id,s);
  return map;
 }
 /** The files of one Library folder (the subject's own, Projects/<project id>). */
 function folderFiles(tree,rel){
  const out=[];if(!ok(tree))return out;
  const find=f=>{if(!f)return null;if(f.rel_path===rel)return f;for(const c of f.folders||[]){const r=find(c);if(r)return r;}return null;};
  const all=f=>{for(const x of f.files||[])out.push(x);for(const c of f.folders||[])all(c);};
  const hit=find((tree.roots||[]).find(r=>r.id==='library')?.tree);if(hit)all(hit);
  return out;
 }
 /** What a subject is made from, sorted: its Library folder, the sources its research holds, what its plans were
     made from. */
 function materialFrom(rec={},projectId=null){
  const byId=sourcesById(rec.tree),seen=new Map();
  const add=(sid,extra={})=>{if(!sid||seen.has(sid))return;const s=byId.get(sid)||{};
   seen.set(sid,{id:sid,title:extra.title||s.title||s.name||'Untitled',kind:extra.kind||s.kind||'',hash:extra.hash||s.hash||'',recordingId:s.recordingId||extra.recordingId,transcriptState:s.transcriptState,transcriptProvenance:s.transcriptProvenance,rel_path:s.rel_path||'',url:s.url||''});};
  if(ok(rec.brief)){for(const mm of rec.brief.materials||[])add(mm.sourceId,{title:mm.title,kind:mm.kind,hash:mm.hash,...(mm.kind==='transcript'&&jobOfPath(mm.path)?{recordingId:jobOfPath(mm.path)}:{})});for(const sid of rec.brief.sourceIds||[])add(sid);}
  if(projectId)for(const x of folderFiles(rec.tree,'Projects/'+projectId))add(x.id||x.sourceId,{title:x.name});
  for(const pr of rec.planRecords||[]){if(!ok(pr))continue;for(const x of pr.material?.transcripts||[])add(x.sourceId,{title:x.title,kind:'transcript',hash:x.sourceHash});for(const x of pr.material?.photos||[])add(x.sourceId,{title:x.caption,kind:'image'});}
  const out={total:0,recordings:0,notes:0,links:0,photos:0,items:[]};
  for(const s of seen.values()){const k=kindOf(s);out[k]++;out.total++;out.items.push({...s,kind:k});}
  const rank={recordings:0,notes:1,links:2,photos:3};out.items.sort((a,b)=>rank[a.kind]-rank[b.kind]);
  return out;
 }
 /** Parts of the writing: a heading starts a part; with no headings the whole is one part. */
 function partsOf(blocks){
  const parts=[];let cur=null;
  for(const b of blocks){if(b.blockKind==='heading'){cur={name:String(b.words).trim().slice(0,80),paragraphs:0};parts.push(cur);continue;}if(!cur){cur={name:'Opening',paragraphs:0};parts.push(cur);}cur.paragraphs++;}
  return parts;
 }
 /** Which tool reads a change touches, by the start of its command name. The longest start wins; none means none. */
 const TOUCHES=Object.freeze([
  ['study-draft.check',['check']],['study-draft',['read','check']],['study-ai',['read']],['study.outputs',['read']],
  ['study.human-direction',['direction','board']],['concept',['direction']],['simmer',['board','direction']],['instagram',['planRecords']],
  ['consent',['desk']],['words',['wordChecks']],['transcript-check',['wordChecks']],
  ['sources',['tree','brief','recordings']],['recordings',['tree','brief','recordings']],['transcription',['recordings']],['research-topics',['topics']],['first-flow',['brief','tree']],['study.material',['brief','tree']],['study.research',['brief']],['study.photos',['tree']],['inquiries',['topics']],
 ]);
 const READS=Object.freeze(['tree','brief','planRecords','wordChecks','board','direction','read','check','desk','topics','recordings']);
 function touched(kind){const k=String(kind||'');let best=null;for(const [start,keys] of TOUCHES)if(k.startsWith(start)&&(!best||start.length>best[0].length))best=[start,keys];return best?[...best[1]]:[];}
 /** The reads each step's tool needs, in the order they are asked. */
 const STEP_READS=Object.freeze({
  have:['tree','brief','planRecords','recordings'],transcript:['tree','planRecords','wordChecks'],facts:['brief','topics'],dish:['board','direction'],
  words:['read'],check:['check'],story:['planRecords'],slides:['planRecords'],yes:['desk'],
 });

 /** Where one recording is, said plainly, from the job `recordings` holds for it. `registered`: the transcript is already a
     source. `act`: the one thing he can do about it here (start or retry the transcript, or use the finished one). */
 function recordingView(job,capability,registered=false){
  if(!job||typeof job!=='object')return null;
  const ready=!!capability?.ready;
  switch(job.state){
   case 'saved':return ready?{say:'Saved. The transcript has not been started.',act:'start'}:{say:'Saved. Transcription is not set up on this machine.',act:null};
   case 'queued':case 'running':return {say:'Making the transcript.',act:null};
   case 'failed':return {say:'The transcript could not be made. The recording is kept.',act:ready?'retry':null};
   case 'done':return job.transcriptReady?(registered?{say:'Transcript ready, and kept as a source.',act:null}:{say:'Transcript ready.',act:'use'}):{say:'The transcript is not ready.',act:null};
   case 'unavailable':return {say:'The saved recording cannot be reached.',act:null};
   default:return null;
  }
 }
 /** The recordings that already have their transcript as a source, by job id, from the Library tree. */
 function registeredJobs(tree,brief){
  const out=new Set();
  if(ok(tree))for(const x of tree.sources||[])if(x?.kind==='transcript'){const j=x.recordingId||x.transcriptState?.jobId;if(j)out.add(j);}
  if(ok(brief))for(const x of brief.materials||[])if(x?.kind==='transcript'){const j=jobOfPath(x.path);if(j)out.add(j);}
  return [...out];
 }
 /** A topic is waiting to be kept only while its own status says `proposed`; once he keeps it, who first suggested it no longer matters. */
 const topicStatus=t=>t?.status==='proposed'?'proposed':'accepted';
 /** How a topic reads in the Facts step. A question is his own words, unchanged; any other name keeps the sentence. */
 function topicLine(t){
  const name=String(t?.name||''),asked=/\?\s*$/.test(name);
  if(topicStatus(t)==='proposed')return 'Suggested: '+(asked?name:name.charAt(0).toLowerCase()+name.slice(1));
  return asked?name:'Learn more about '+name.charAt(0).toLowerCase()+name.slice(1);
 }
 /** The summary's "n research topics" says the number the panel lists; until the panel has read its topics it says no number. */
 function topicNote(note,topics){
  const text=String(note||''),n=!topics||topics.error||!Array.isArray(topics.list)?0:topics.list.length;
  return text.replace(/(\s·\s)?\d+ research topics?( on this material)?/,(all,dot,tail)=>n?(dot||'')+plural(n,'research topic')+(tail||''):'').replace(/\s·\s*$/,'');
 }
 
 /** The one sentence of his that a subject shows beside its name, for display only (nothing stored is changed). The dish
     he named comes first; otherwise the direction he adopted. A stored direction can be the whole concept record (its
     headings, his thoughts, the assistants' provisional parts) or one plain paragraph written long ago or by hand: the
     record is read only to find his adopted words, and nothing else of it is ever shown. Nothing found gives ''. */
 // A heading of the stored concept record, with or without its dash suffix; the workspace tells the record by the same words.
 const PART='(?:Concept|Author thoughts|Adopted human direction|AI interpretation|Suggestions|Selected Library passages)';
 // The record is the concept's when a line starts like one of its headings, whatever follows the name (a dash, a colon, brackets).
 const CONCEPT_PART=new RegExp('^#{1,2}[ \\t]*'+PART+'\\b','mi'),ADOPTED_AT=/^##[ \t]*Adopted human direction\b.*$/mi,NEXT_HEADING=/^#{1,6}[ \t]/m;
 /** His adopted words, with their own line breaks (what Edit starts from); adoptedWords lays them flat for one line.
     Only text the record's shape vouches for is returned: a plain paragraph, or the adopted section of the concept
     record up to the next heading of any kind. A shape that is not recognised gives ''. */
 function adoptedRaw(body){
  let text=String(body??'').replace(/\r\n?/g,'\n');
  // The app's own blocks (direction choices, planning intent) are data wrapped in markers: take them out whole.
  text=text.replace(/<!-- ar-create:([a-z-]+):v1 -->[\s\S]*?<!-- \/ar-create:\1:v1 -->/g,'');
  // An opening marker whose block never closes: it is data to the end.
  text=text.replace(/<!-- ar-create:[a-z-]+:v1 -->[\s\S]*$/,'');
  // A closing marker with no opening one: what came before it is the rest of a block, so it goes, with the marker.
  const stray=/<!-- \/ar-create:[a-z-]+:v1 -->/g;let last=null,m;while((m=stray.exec(text)))last=m;
  if(last)text=text.slice(last.index+last[0].length);
  // Any comment goes; one left open takes everything after it, which cannot be told from data.
  text=text.replace(/<!--[\s\S]*?-->/g,'');const open=text.indexOf('<!--');if(open>=0)text=text.slice(0,open);
  if(!text.trim())return '';
  if(/^\s*[{[]/.test(text)){try{JSON.parse(text);return '';}catch{}}
  if(!CONCEPT_PART.test(text))return /^#{1,6}[ \t]/m.test(text)?'':text.trim();
  const at=ADOPTED_AT.exec(text);if(!at)return '';
  const rest=text.slice(at.index+at[0].length),end=NEXT_HEADING.exec(rest);
  return (end?rest.slice(0,end.index):rest).trim();
 }
 const adoptedWords=body=>adoptedRaw(body).replace(/\s+/g,' ');
 function sentenceOf(board,direction){
  const n=board?.forming?.named,named=typeof n==='string'?n:n?.text;
  if(typeof named==='string'&&named.trim())return named.trim();
  return adoptedWords(direction?.body);
 }

 const pure=Object.freeze({isMagazine,pieceFor,magazineHref,inMagazine,topicStatus,topicLine,topicNote,recordingView,registeredJobs,adoptedWords,adoptedRaw,sentenceOf,TWELVE,SECTION_LABEL,GROUPS,HANDOFFS,STEP_OUT,STATE_SAY,KINDS,READS,STEP_READS,ownHandoff,stepView,chooseForm,stepsOfForm,firstOpen,pillView,pieceOf,tellApart,outputStudio,findingsOf,factsView,transcriptAct,sourceRefusal,concerns,addable,materialFrom,partsOf,kindOf,touched,plural});
 if(typeof module==='object'&&module.exports)module.exports=pure;
 const v2=root.v2;if(!v2||typeof v2.screen!=='function')return;

 // =====================================================================================================
 // The screen half.
 // =====================================================================================================
 const {esc,icon,ring,step:mark}=v2.ui;
 const call=(name,input)=>v2.call(name,input).catch(error=>({__error:error}));
 const cssq=v=>root.CSS?.escape?root.CSS.escape(v):String(v).replace(/["\\]/g,'\\$&');
 // Line icons this screen needs that the shell does not draw. 24 by 24, stroke only.
 const OWN_ICONS={mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',note:'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',photo:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01'};
 const ownIcon=name=>`<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${OWN_ICONS[name]}"/></svg>`;

 // ===== capture sources: BEGIN. The list of what Check can read and the one button, shared with check.js through
 // v2.shared.subject.captureSources. A screen makes one with createCaptureSources({scope, paint, after}) and puts block()
 // in its markup; it hands clicks on [data-cs] to handle(). The list and the press are the server's: the list comes from
 // study-draft.capture-sources.list and the press captures exactly the eligible sources shown, with study-draft.capture-sources
 // (Adrian only: an assistant's press shows the refusal). A row in use also offers Stop using for Check (study-draft.capture-sources.stop),
 // and a stopped row Use for Check again. Nothing here decides what counts. =====
 const CS_KIND={transcript:'Transcript',markdown:'Note',note:'Note'};
 const csKind=k=>CS_KIND[k]||(k?String(k).replace(/^./,c=>c.toUpperCase()):'Material');
 function createCaptureSources({scope,paint,after,stopped,signal}){
  const S={list:undefined,loading:false,busy:false,done:false};
  const sc=()=>{try{return scope()||null;}catch{return null;}};
  async function load(){
   const at=sc();if(!at||S.loading)return;
   S.loading=true;
   try{S.list=await v2.call('study-draft.capture-sources.list',at);}catch(error){S.list={__error:error};}
   S.loading=false;paint();
  }
  const ensure=()=>{if(S.list===undefined&&!S.loading&&sc())load();};
  /** Read the list again the next time it is drawn (after a confirm, a capture or a change to what is attached). */
  const reset=()=>{S.list=undefined;};
  /** Read the list again now, leaving the old one on screen until the new one is in, so a row's control keeps its focus. */
  async function refresh(){
   const at=sc();if(!at)return;
   try{S.list=await v2.call('study-draft.capture-sources.list',at);}catch(error){S.list={__error:error};}
   paint();
  }
  // What a row says: the design's words for a source in use, a stopped one, and the list's own reason for the rest.
  const inUse=x=>!!x.captured&&!x.stopped;
  const say=x=>x.stopped?'Not used for Check. You stopped it.'
   :inUse(x)?(x.setAside?'Used for Check. Set aside in the Library since.':x.reason===UNREAD?'Used for Check. '+UNREAD:x.changedSinceCapture?'Used for Check. Changed in the Library since.':x.capturedCurrent===false&&!x.changedSinceCapture?'Used for Check. No longer attached to this subject.':'Used for Check')
   :x.eligible?(v2.isHuman()?'Confirmed by you':'Confirmed by Adrian'):(x.reason||'It cannot be used for Check.');
  const KEPT='Check can now read this';
  const UNREAD='This material could not be read.';
  const LOST='The answer did not come back. The list shows what is on file now.';
  /** The one quiet control of a row: Stop for a source in use (it names the copy shown), Use for Check again for a stopped one. */
  function control(x,L){
   const off=S.busy?' aria-disabled="true"':'';
   if(inUse(x)&&x.capturedHash&&typeof L.sourcesHash==='string')return `<button type="button" class="${CQ} v2-ghost" data-cs="stop" data-src="${esc(x.id)}"${off}>Stop using for Check</button>`;
   if(x.stopped&&x.hash)return `<button type="button" class="${CQ} v2-ghost" data-cs="again" data-src="${esc(x.id)}"${off}>Use for Check again</button>`;
   return '';
  }
  /** `noCapture` leaves out the button that captures (Check's details: Stop is reachable there, capturing is not). */
  function block({back,noCapture}={}){
   if(!sc())return '';
   const L=S.list;
   if(L===undefined||S.loading){ensure();return `<div class="subj-cs-block" data-cs-block>${S.done?`<p class="subj-cs-done" role="status" data-cs-done>${KEPT}</p>`:'<p class="subj-cs-note" role="status">Reading what Check can use.</p>'}</div>`;}
   if(L.__error)return `<div class="subj-cs-block" data-cs-block><p class="subj-cs-note" role="alert">${esc(L.__error.message||'What Check can use could not be read.')}</p></div>`;
   if(L.canCapture===false||L.damaged)return `<div class="subj-cs-block" data-cs-block data-cs-sentence><p class="subj-cs-note" role="status">${esc(L.reason||L.addedError||'Nothing can be added for Check here.')}</p></div>`;
   const all=Array.isArray(L.sources)?L.sources:[],yes=all.filter(x=>x.eligible),no=all.filter(x=>!x.eligible);
   const item=x=>`<li data-cs-src="${esc(x.id)}"${x.eligible?'':' data-cs-no'}>${ownIcon(x.kind==='transcript'?'mic':'note')}<span><b title="${esc(x.title)}">${esc(x.title)}</b><small>${esc(csKind(x.kind))} · <i class="${x.eligible?'subj-cs-ok':'subj-cs-why'}">${esc(say(x))}</i></small>${control(x,L)}</span></li>`;
   const link=!yes.length&&back?`<p class="subj-cs-note"><a href="${esc(back)}">Back to the subject</a></p>`:'';
   return `<div class="subj-cs-block" data-cs-block><div class="subj-cs-h"><h3>Sources</h3><span>${all.length}</span></div>${all.length?`<ul class="subj-cs-list">${yes.map(item).join('')}${no.map(item).join('')}</ul>`:'<p class="subj-cs-note" role="status">Nothing is attached to this subject yet.</p>'}${yes.length&&!noCapture?`<div class="subj-cs-btns"><button type="button" class="${CB} subj-btn" data-cs="capture"${S.busy?' disabled':''}>Use it for Check</button></div>`:''}${S.done?`<p class="subj-cs-done" role="status" data-cs-done>${KEPT}</p>`:''}${link}</div>`;
  }
  async function capture(){
   const at=sc(),L=S.list;
   if(S.busy||!at||!L||L.__error||L.canCapture===false)return;
   // The bulk press names only what the list calls eligible: a stopped source is never eligible, so it is never sent here.
   const yes=(L.sources||[]).filter(x=>x.eligible&&!x.stopped);if(!yes.length)return;
   S.busy=true;paint();
   try{
    await v2.call('study-draft.capture-sources',{...at,expectedSourcesHash:L.sourcesHash??null,sources:yes.map(x=>({sourceId:x.id,sourceHash:x.hash}))});
    S.done=true;reset();v2.ui.say(KEPT,{tone:'good'});
    if(typeof after==='function')await after();
   }catch(error){S.done=false;reset();v2.ui.say(error?.message||'That could not be done. Nothing was changed.',{tone:'bad'});}
   finally{S.busy=false;paint();}
  }
  /** Focus goes back to the row only while the screen is open and the page the press came from is still on screen, and only inside that page. */
  const focusRow=(id,which,host)=>{
   if(signal?.aborted||!host||!host.isConnected)return;
   const row=[...host.querySelectorAll('[data-cs-src]')].find(r=>r.dataset.csSrc===id);
   (row?.querySelector(`[data-cs="${which}"]`)||row?.querySelector('button')||host.querySelector('[data-cs-block] button'))?.focus({preventScroll:true});
  };
  /** Stop using one source (his alone: an assistant's press shows the server's refusal and leaves the list as it was) or use a stopped one again. */
  async function change(kind,id,host){
   const at=sc(),L=S.list,x=(L?.sources||[]).find(r=>r.id===id);
   if(S.busy||!at||!L||L.__error||L.canCapture===false||!x)return;
   if(kind==='stop'&&(!x.capturedHash||typeof L.sourcesHash!=='string'))return;
   if(kind==='again'&&!x.stopped)return;
   S.busy=true;paint();
   let ok=false,refused=false,lost=false;
   try{
    if(kind==='stop'){await v2.call('study-draft.capture-sources.stop',{...at,expectedSourcesHash:L.sourcesHash,sourceId:x.id,copiedHash:x.capturedHash});S.done=false;v2.ui.say('Check no longer reads this.',{tone:'good'});}
    else{await v2.call('study-draft.capture-sources',{...at,expectedSourcesHash:L.sourcesHash??null,sources:[{sourceId:x.id,sourceHash:x.hash,again:true}]});S.done=true;v2.ui.say(KEPT,{tone:'good'});}
    ok=true;
   }catch(error){refused=error?.kind==='owner-only';lost=error?.kind==='failed';S.done=false;if(!lost)v2.ui.say(error?.message||'That could not be done. Nothing was changed.',{tone:'bad'});}
   S.busy=false;
   // A refusal changed nothing, so the list stays as it was; anything else is read again so the rows tell the truth.
   if(!refused)await refresh();else paint();
   // The answer never came back, so what happened is not known: say so after the list shows what the server holds.
   if(lost&&!signal?.aborted)v2.ui.say(LOST,{tone:'bad'});
   if(ok){try{if(kind==='stop'){if(typeof stopped==='function')await stopped();}else if(typeof after==='function')await after();}catch{/* the screen shows its own state */}}
   focusRow(id,kind==='stop'?'again':'stop',host);
  }
  /** True when the click was this block's. */
  function handle(target){
   const b=target?.closest?.('[data-cs=capture],[data-cs=stop],[data-cs=again]');if(!b)return false;
   if(b.getAttribute('aria-disabled')==='true')return true;
   if(b.dataset.cs==='capture')capture();else change(b.dataset.cs,b.dataset.src,b.closest('[data-subj],[data-ck]'));
   return true;
  }
  return {block,handle,load,ensure,reset,refresh,state:S};
 }
 // ===== capture sources: END =====

 /** Where this subject stands: forms, steps, states, ring, station and what each step waits for. One command, one
     call. Everything the page shows about standing comes from here and nowhere else. */
 const gather=subject=>v2.call('subject.standing',{parentStudyId:subject});

 /** The records a tool reads for the open step, each by name; `ids` carry what the reads need. */
 const READERS={
  tree:()=>call('sources.tree',{}),
  brief:ids=>ids.bindingId?call('study.research.brief',{bindingId:ids.bindingId,parentStudyId:ids.id}):null,
  planRecords:async ids=>{const list=await call('instagram.plans',{subject:ids.id});if(!ok(list))return list;return Promise.all((list.plans||[]).filter(p=>p.subject===ids.id).map(p=>call('instagram.plan.get',{id:p.id})));},
  wordChecks:()=>call('words.checks',{}),
  recordings:()=>call('recordings',{}),
  board:ids=>call('simmer.board.get',{subject:ids.id}),
  direction:ids=>call('study.human-direction',{parentStudyId:ids.id}),
  read:ids=>ids.bindingId?call('study-draft.read',{bindingId:ids.bindingId,parentStudyId:ids.id}):null,
  check:ids=>ids.bindingId?call('study-draft.check.get',{bindingId:ids.bindingId,parentStudyId:ids.id}):null,
  desk:ids=>call('consent.desk',{parentStudyId:ids.id}),
 };
 /** Research topics tied to this subject (read only for its Facts step): only those that share a source with it. */
 async function topicsOf(ids,brief){
  // A question asked from the Capture sheet is a research topic linked to this subject: it shows here too.
  const linked=await call('research-topics',{subject:ids.id});
  const extra=ok(linked)?(linked.topics||[]).filter(t=>t?.id&&t.name).map(t=>({id:t.id,name:t.name,status:topicStatus(t)})):[];
  const base=await topicsFromInquiries(ids,brief);
  const seen=new Set(base.list.map(t=>t.id));
  return {...base,list:[...base.list,...extra.filter(t=>!seen.has(t.id))].sort((a,b)=>a.name.localeCompare(b.name))};
 }
 async function topicsFromInquiries(ids,brief){
  if(!ids.bindingId||!ids.projectId||!ok(brief))return {list:[]};
  const cat=await call('inquiries.catalog',{});if(!ok(cat))return {error:true,list:[]};
  const mine=new Set(brief.sourceIds||[]),selector={workspaceId:ids.projectId,parentStudyId:ids.id,rootBindingId:ids.bindingId};
  const cols=(cat.collections||[]).filter(c=>(c.sourceIds||[]).some(s=>mine.has(s)));
  const views=await Promise.all(cols.map(c=>call('inquiries.project',{collectionId:c.id,projectSelector:selector})));
  const list=[];views.forEach((v,i)=>{if(!ok(v))return;const rel=(v.relationships||[]).find(r=>r.to?.parentStudyId===ids.id&&['accepted','proposed'].includes(r.status));if(rel)list.push({id:cols[i].id,name:cols[i].name,status:rel.status});});
  return {list:list.sort((a,b)=>a.name.localeCompare(b.name))};
 }

 // ---------- the page ----------
 function render(){
  return `<div class="v2-page subj" data-subj>
   <header class="subj-head" data-subj-head><h1>&nbsp;</h1></header>
   <nav class="subj-forms" data-subj-forms aria-label="Forms, in order"><span class="subj-form none"><b>Reading</b></span></nav>
   <div class="subj-work"><div class="subj-steps" data-subj-steps><p class="subj-quiet" role="status">Reading</p></div><div class="subj-secs" data-subj-secs></div></div>
  </div>`;
 }

 function mount(el,ctx){
  const id=ctx.params.id,page=el.querySelector('.subj');
  // rec[k]: undefined = not asked yet (the tool says Reading); null = nothing to read; {__error} = could not be read.
  let back={};try{back=JSON.parse(root.sessionStorage.getItem('ar-v2-subject:'+id)||'{}')||{};}catch{}
  const st={standing:null,form:ctx.query?.form||back.form||null,open:ctx.query?.step||back.step||null,rec:{},pend:{},drafts:{},sayLine:'',busy:false,frames:new Map(),last:{},look:new Map(),looks:[],zoom:null,zoomY:0,hold:0,placed:false,came:!!(ctx.query?.step||back.step),backY:Number.isFinite(back.y)?back.y:null,reader:null};
  const phone=root.matchMedia?root.matchMedia('(max-width:850px)'):{matches:false};
  let timer=null,paintTimer=null;
  const $=sel=>page.querySelector(sel);
  /** Keep the form and the open step in the address (and for this tab), so Back from the slide studio returns to them. */
  const KEEP='ar-v2-subject:'+id;
  function remember(){
   const form=st.form,step=st.open;
   try{root.history.replaceState(root.history.state,'',v2.href('subject/:id',{id},{form,step}));}catch{}
   try{root.sessionStorage.setItem(KEEP,JSON.stringify({form,step,y:Math.round(root.scrollY||0)}));}catch{}
  }
  const ids=()=>({id,bindingId:st.standing?.facts?.bindingId||null,projectId:st.standing?.facts?.projectId||null});

  // ---- asking: one command for the standing, then only the reads the open step's tool needs ----
  async function refresh(){
   st.at=Date.now();
   const answer=await gather(id).catch(error=>({__error:error}));
   if(ctx.signal.aborted)return;
   if(!ok(answer)){if(!st.standing)paintMissing(answer.__error);return;}
   st.standing=answer;
   paintNow();
  }
  const schedule=()=>{if(!paintTimer)paintTimer=setTimeout(()=>{paintTimer=null;paintNow();},40);};
  /** Read one record (or read it again: `again`), keeping what was there until the new answer arrives. */
  function ask(k,again=false){
   if(!again){if(st.rec[k]!==undefined)return Promise.resolve(st.rec[k]);if(st.pend[k])return st.pend[k];}
   const run=k==='topics'?ask('brief').then(()=>topicsOf(ids(),st.rec.brief)):Promise.resolve(READERS[k](ids()));
   const p=st.pend[k]=run.catch(error=>({__error:error})).then(v=>{if(st.pend[k]===p)delete st.pend[k];if(ctx.signal.aborted)return v;st.rec[k]=v===undefined?null:v;schedule();return v;});
   return p;
  }
  const need=(stepId,keys=null,again=false)=>{for(const k of keys||STEP_READS[stepId]||[])ask(k,again);};
  ctx.signal.addEventListener('abort',()=>{clearTimeout(timer);clearTimeout(paintTimer);});

  // A change for this subject: ask the command again, and again the tool reads its kind touches that were read before.
  // It never moves the open step.
  ctx.on({},e=>{
   if(!concerns(e,st.standing))return;
   // The first connection of the change stream says "read everything" just after the page read it: nothing to add.
   if(e.reset&&st.at&&Date.now()-st.at<2500)return;
   const keys=(e.reset?READS:touched(e.kind)).filter(k=>st.rec[k]!==undefined);
   clearTimeout(timer);
   timer=setTimeout(()=>{if(ctx.signal.aborted)return;for(const k of keys)ask(k,true);refresh();},200);
  });

  // ---------- drawing, in place ----------
  // With no form decided the list stops at Simmer: the rest appears when he says what it will be.
  const later=s=>!(s?.forms||[]).length;
  const current=()=>{const s=st.standing;if(!s)return {form:null,steps:[]};const form=chooseForm(s,st.form),all=stepsOfForm(s,form);return {form,steps:later(s)?all.filter(x=>['Gather','Research','Simmer'].includes(x.group)):all};};
  function paintNow(){
   if(ctx.signal.aborted||!st.standing)return;
   const s=st.standing,{form,steps}=current();
   st.form=form?.key||null;
   ctx.setTitle(s.title);if(s.look)v2.brand(s.look);
   // A story has no address in Advanced, so the bar leads to Advanced itself, never to a subject address it does not know.
   if(isMagazine(s)&&!st.advSet){st.advSet=true;ctx.setAdvanced({});}
   // The page chooses its open step once. After that only he moves it; it changes by itself only if it has gone.
   if(!st.open||!steps.some(x=>x.id===st.open)){st.open=firstOpen(steps,form);}
   // Every paint makes sure the open step's reads were asked (a step kept from the address or the tab was never asked before).
   if(st.open)need(st.open);
   swap('[data-subj-head]',head(s),'outer');
   swap('[data-subj-forms]',formRow(s,form),'outer');
   paintSteps(steps,form);
   paintPanels(steps,form);
   place();
  }
  /** Replace a part only when its markup changed, keeping focus where it was. */
  function swap(sel,html,how){
   const node=$(sel);if(!node||st.last[sel]===html)return;st.last[sel]=html;
   const back=node.contains(document.activeElement)?keyOf(document.activeElement):null;
   if(how==='outer')node.outerHTML=html;else node.innerHTML=html;
   if(back)$(back)?.focus({preventScroll:true});
  }
  const keyOf=n=>n.dataset?.subjStep&&n.closest('.subj-row')?`.subj-row[data-step="${n.dataset.subjStep}"]>[data-subj-step]`:n.dataset?.subjForm?`[data-subj-form="${cssq(n.dataset.subjForm)}"]`:n.dataset?.subjDraft?`[data-subj-draft="${cssq(n.dataset.subjDraft)}"]`:n.matches?.('[data-subj-say]')?'[data-subj-say]':n.matches?.('[data-subj-dishtext]')?'[data-subj-dishtext]':n.matches?.('[data-subj-add]')?'[data-subj-add]':n.matches?.('[data-cs-words]')?'[data-cs-words]':n.dataset?.csName?`[data-cs-name="${cssq(n.dataset.csName)}"]`:n.dataset?.cs?`[data-cs="${n.dataset.cs}"]${n.dataset.job?`[data-job="${cssq(n.dataset.job)}"]`:''}${n.dataset.src?`[data-src="${cssq(n.dataset.src)}"]`:''}`:null;
  /** A step as shown; the Facts summary counts the research topics its panel lists. */
  const viewOf=x=>{if(x.id!=='facts')return stepView(x);const f=factsView(x,st.rec.brief);return stepView({...f,note:topicNote(f.note,st.rec.topics)});};
  function paintSteps(steps,form){
   const nav=$('[data-subj-steps]'),shape=JSON.stringify([form?.key||null,steps.map(x=>x.id),later(st.standing)]);
   if(nav.dataset.shape!==shape){
    nav.dataset.shape=shape;nav.innerHTML=stepList(steps)+(later(st.standing)?'<p class="subj-later">The rest appears when you say what it will be.</p>':'');
   }else for(const x of steps){
    const li=nav.querySelector(`.subj-row[data-step="${cssq(x.id)}"]`),v=viewOf(x),html=rowInner(v);
    if(li&&li.dataset.html!==html){
     const focused=li.contains(document.activeElement);
     li.dataset.state=v.state;li.dataset.html=html;li.querySelector(':scope>[data-subj-step]').outerHTML=html;
     if(focused)li.querySelector(':scope>[data-subj-step]')?.focus({preventScroll:true});
    }
    li?.toggleAttribute('data-open',x.id===st.open);
   }
   // On a phone the list is a strip along the top: keep the current step in sight, without moving the page.
   const on=nav.querySelector('.subj-row[data-open]');
   if(on&&phone.matches&&nav.scrollWidth>nav.clientWidth)nav.scrollLeft=on.offsetLeft-(nav.clientWidth-on.clientWidth)/2;
  }

  const mag=()=>isMagazine(st.standing);
  const actorQ=()=>v2.actor()&&!v2.isHuman()?v2.actor():'';
  /** Where a hand-off leads: Advanced for a subject; the story's own place in the Magazine for a Magazine story. */
  const handoffRaw=(section,form)=>mag()?magazineHref(id,{actor:actorQ()}):v2.advanced({subject:id,section,piece:pieceOf(form)});
  const handoffHref=(section,form)=>esc(handoffRaw(section,form));
  const where=()=>mag()?'the Magazine':'Advanced';
  const said=label=>mag()?inMagazine(label):label;
  /** Write opens version two's own Write screen for an Article; every other piece still opens Advanced. */
  const writeHref=form=>form&&form.kind==='article'?esc(v2.href('write/:id',{id},{piece:pieceFor(form)})):handoffHref('write',form);
  /** An Article's Read and Check open version two's own screens too (a Carousel's stay on Advanced). The labels that said
      Advanced say what they do instead. */
  const SCREEN_OF=Object.freeze({read:'read',checkRun:'check',checkOpen:'check'}),SCREEN_LABEL=Object.freeze({checkRun:'Open Check',checkOpen:'Open Check'});
  const ownScreen=(key,form)=>form&&form.kind==='article'&&SCREEN_OF[key]?SCREEN_OF[key]:null;
  const screenHref=(key,form)=>{const s=ownScreen(key,form);return s?esc(v2.href(s+'/:id',{id},{piece:pieceFor(form)})):null;};
  const screenOfSection=(section,form)=>form&&form.kind==='article'&&(section==='read'||section==='check')?esc(v2.href(section+'/:id',{id},{piece:pieceFor(form)})):null;
  const lookName=lookId=>st.look.get(lookId)||String(lookId).replace(/^./,c=>c.toUpperCase());
  function head(s){
   const look=`<button type="button" class="${CB} subj-look${s.look?'':' none'}" data-subj-look aria-haspopup="dialog" title="Choose the look here. Looks is where looks are made and changed"><i aria-hidden="true"></i>${s.look?esc(lookName(s.look))+' look':'Choose a look'}</button>`;
   const trail=['Subjects',...(s.folder||[])].join(' / ');
   const path=`<p class="subj-path" title="${esc(s.folder?.length?'This is a real folder on disk':'Subjects')}">${esc(trail)}</p>`;
   // The station stays for assistive technology; the sample shows it nowhere on this page.
   const where=`<span class="subj-where subj-sr" title="${esc(s.stationName)}">${ring(s.ring)}<span>${esc(s.stationName)}</span></span>`;
   // His sentence waits for both reads (the direction and the board), so it is drawn once and never changes under him.
   // A Magazine story's picked direction is an option chosen on its Magazine page, never his words: only the dish he named
   // in Simmer is shown as his sentence; otherwise the page says what the records say, a direction is chosen or not.
   const d=st.rec.direction,both=d!==undefined&&st.rec.board!==undefined,isMag=isMagazine(s),own=!both?null:ok(d)?sentenceOf(ok(st.rec.board)?st.rec.board:null,d):(sentenceOf(ok(st.rec.board)?st.rec.board:null,null)||null),said=!both||!isMag?own:sentenceOf(ok(st.rec.board)?st.rec.board:null,null);
   const hasDish=(current().steps||[]).some(x=>x.id==='dish');
   // Change stays on the page: it opens the Name the dish step. Only a subject with no such step is sent to Advanced.
   const change=(label,key,aria)=>hasDish?`<button type="button" class="subj-link" data-subj-step="dish" aria-label="${aria}">${label}</button>`:`<a class="subj-link" data-subj-handoff="${key}" href="${handoffHref('direction',null)}" aria-label="${aria} (opens Advanced)">${label}</a>`;
   const chosen=isMag&&!!s.facts?.dish?.direction;
   const dir=!both?'':isMag&&!said?`<p class="subj-dir none"><span>${chosen?'A direction is chosen in the Magazine, the dish is not named':'No direction yet'}</span><a class="subj-link" data-subj-handoff="${chosen?'directionChange':'directionWrite'}" href="${handoffHref('direction',null)}" aria-label="${chosen?'See the direction':'Write the direction'} (opens the Magazine)">Open the Magazine in Advanced</a></p>`:said?`<p class="subj-dir"><span title="${esc(said)}">${esc(said)}</span>${change(HANDOFFS.directionChange.label,'directionChange','Change the direction')}</p>`
    :said===''&&!later(s)?`<p class="subj-dir none"><span>No direction yet</span>${change(HANDOFFS.directionWrite.label,'directionWrite','Write the direction')}</p>`:'';
   return `<header class="subj-head" data-subj-head><h1 title="${esc(s.title)}">${esc(s.title)}</h1>${look}${path}${where}<span class="subj-sp"></span>${dir}${glance(s)}</header>`;
  }
  /** The whole subject in one line: what he has, how far it is, and the step that needs him next. */
  function glance(s){
   const f=s.facts||{},m=f.material,bits=[];
   if(m)for(const [count,one] of [[m.recordings,'recording'],[m.notes,'note'],[m.links,'link'],[m.photos,'photograph']])if(count)bits.push(`<span><b>${count}</b> ${count===1?one:one+'s'}</span>`);
   if(f.words?.count)bits.push(`<span><b>${Number(f.words.count).toLocaleString('en-GB')}</b> ${f.words.count===1?'word':'words'}</span>`);
   const steps=current().steps.filter(x=>x.state!=='unknown'),done=steps.filter(x=>x.state==='done').length;
   if(steps.length)bits.push(`<span><b>${done} of ${steps.length}</b> steps done</span>`);
   if(s.asks)bits.push(`<a class="subj-link" href="#/">${plural(s.asks,'question')} waiting on you${icon('chev')}</a>`);
   const nx=steps.find(x=>x.state==='flag')||steps.find(x=>x.state==='next');
   if(nx)bits.push(`<button type="button" class="subj-link" data-subj-step="${esc(nx.id)}">Next: ${esc(nx.name)}${icon('chev')}</button>`);
   return bits.length?`<p class="subj-glance" data-subj-glance>${bits.join('')}</p>`:'';
  }
  function formRow(s,form){
   // Forms cannot be reordered yet (no record keeps their order), so there is no drag grip; the number is their place.
   const apart=tellApart(s.forms||[]);
   const pills=(s.forms||[]).map((f,i)=>{const v=pillView(f,i,apart[i]),own=String(f.title||'').trim();
    return `<button type="button" class="subj-form${f.key===form?.key?' v2-current on':''}" data-subj-form="${esc(f.key)}" aria-pressed="${f.key===form?.key}" aria-label="${esc(v.say)}" title="${esc(v.line&&f.alike?v.say:own||v.say)}"><small>${i+1}</small>${ring(v.ring)}<b>${esc(v.name)}</b>${v.line?`<span>${v.tell?`<span class="subj-pto">${esc(v.lead)}</span>${esc(v.tell)}`:esc(v.line)}</span>`:''}<em>${v.count}</em></button>`;}).join('');
   const none=(s.forms||[]).length?'':`<span class="subj-form none"><b>Not decided yet</b><span>Gather first</span></span>`;
   return `<nav class="subj-forms" data-subj-forms aria-label="Forms, in order">${pills}${none}${isMagazine(s)?'':`<button type="button" class="subj-form add" data-subj-add>${icon('plus')}<b>Add a form</b></button>`}</nav>`;
  }
  function stepList(steps){
   return GROUPS.map(g=>{const rows=steps.filter(x=>x.group===g);if(!rows.length)return '';
    return `<section class="subj-grp"><h3 class="subj-group">${g}</h3><ol>${rows.map(x=>{const v=viewOf(x),html=rowInner(v);return `<li class="subj-row" data-step="${esc(x.id)}" data-state="${v.state}"${x.id===st.open?' data-open':''} data-html="${esc(html)}">${html}</li>`;}).join('')}</ol></section>`;}).join('');
  }
  const rowInner=v=>{const on=v.id===st.open;
   return `<button type="button" data-subj-step="${esc(v.id)}"${on?' aria-current="step" class="v2-current"':''}>${v.mark?mark(v.mark):'<i class="subj-reading" aria-hidden="true"></i>'}<b>${esc(v.name)}</b>${v.note?`<small title="${esc(v.note)}">${esc(v.note)}</small>`:''}</button>`;};

  function paintMissing(error){
   page.innerHTML=`<header class="subj-head"><h1>This subject could not be found</h1></header><p class="subj-quiet">${esc(error?.message||'Nothing in the records has this name.')}</p><p><a class="v2-out" href="#/">Home${icon('right')}</a></p>`;
  }

  // ---------- every step, one under another ----------
  const secOf=sid=>sid?$(`[data-subj-sec="${cssq(sid)}"]`):null;
  function paintPanels(steps,form){
   const box=$('[data-subj-secs]');if(!box)return;
   const shape=JSON.stringify([form?.key||null,steps.map(x=>x.id)]);
   if(box.dataset.shape!==shape){
    box.dataset.shape=shape;for(const k of Object.keys(st.last))if(k.startsWith('panel:'))delete st.last[k];
    if(st.zoom&&!steps.some(x=>x.id===st.zoom)){st.zoom=null;document.documentElement.style.overflow='';}
    box.innerHTML=steps.map(x=>`<section class="subj-step" data-subj-sec="${esc(x.id)}"></section>`).join('');
   }
   const title=st.standing?.title||'the subject';
   for(const s of steps){
    const sec=secOf(s.id);if(!sec)continue;
    need(s.id);
    const v=viewOf(s),quiet=s.id==='have'&&s.state==='next',big=st.zoom===s.id;
    // The same Back as every other screen: top left, an arrow and where it leads.
    const back=big?`<button type="button" class="${CQ} v2-ghost subj-back" data-subj-zoom="${esc(s.id)}">${icon('back')}<span>Back to ${esc(title)}</span></button>`:'';
    const html=`${back}<header data-subj-zoom="${esc(s.id)}"${big?'':' title="Open this at full size"'}><p class="subj-label">${esc(s.group)}</p><h2 tabindex="-1">${esc(s.name)}</h2>${v.note&&!quiet?`<p class="subj-note" data-state="${v.state}">${esc(v.note)}</p>`:''}</header>${tool(s,form,steps)}${readerOf(s.id)}`;
    // The current step's section answers to [data-subj-panel], as the one open panel did.
    sec.toggleAttribute('data-subj-panel',s.id===st.open);sec.classList.toggle('zoomed',big);
    const key='panel:'+s.id;
    if(st.last[key]!==html){const backTo=sec.contains(document.activeElement)?keyOf(document.activeElement):null;st.last[key]=html;sec.innerHTML=html;paintFrames(sec);embed(sec);soon(sec);if(backTo)$(backTo)?.focus({preventScroll:true});}
   }
  }
  // ---------- tools brought over from the existing workspace, run on this page itself ----------
  // A tool the existing workspace already has is not written twice: its own file is loaded when its step is on the page and
  // it is put straight into the section (no frame, so one page, one scroll, the same colours). It keeps its own saving rules.
  // `covers` names the hand-offs it stands in for, so the step no longer says those are missing.
  const BORROWED={photos:{js:'/document-study/study-photos.js',css:'/document-study/study-photos.css',ready:()=>typeof root.mountPhotosStage==='function'},
   simmer:{js:'/document-study/simmer.js',css:'/document-study/simmer.css',ready:()=>typeof root.arSimmer?.open==='function'},
   consent:{js:'/document-study/consent-desk.js',css:'/document-study/consent-desk.css',ready:()=>typeof root.arConsentDesk?.load==='function'},
   arrange:{js:'/assets/study-output-canvas.js',css:'/assets/study-output-canvas.css',module:true,ready:()=>typeof root.ArStudyOutputHost?.mountStudyOutputHost==='function'}};
  /** The existing workspace's tools read who is acting from one place on the page; here it is this tab's own actor. */
  const actAsMe=()=>{if(!root.arCreateUiActor)root.arCreateUiActor=Object.freeze({actor:v2.actor()||'human:adrian',explicit:!v2.isHuman()});};
  /** The Simmer board, whole, over this page. Leaving it comes back to the same place, and the step reads what changed. */
  async function openSimmer(button){
   if(button.disabled)return;button.disabled=true;
   try{actAsMe();await bring('simmer');if(ctx.signal.aborted)return;
    await root.arSimmer.open({subject:id,title:st.standing?.title||''});
    const board=document.querySelector('dialog.simmer');
    const after=()=>{if(ctx.signal.aborted)return;for(const k of ['board','direction'])ask(k,true);refresh();$('[data-subj-borrow="simmer"]')?.focus({preventScroll:true});};
    if(board&&board.open)board.addEventListener('close',after,{once:true});else after();
   }catch(error){v2.ui.say(error?.message||'The Simmer board could not be opened.',{tone:'bad'});}
   finally{const b=$('[data-subj-borrow="simmer"]');if(b)b.disabled=false;}
  }
  const loads=new Map();
  function bring(kind){
   const b=BORROWED[kind];if(b.ready())return Promise.resolve();
   if(!loads.has(kind))loads.set(kind,new Promise((done,fail)=>{
    if(b.css&&!document.querySelector(`link[href="${b.css}"]`)){const l=document.createElement('link');l.rel='stylesheet';l.href=b.css;document.head.append(l);}
    const s=document.createElement('script');if(b.module)s.type='module';s.src=b.js;s.onload=()=>b.ready()?done():fail(new Error('The tool could not be started.'));s.onerror=()=>fail(new Error('The tool could not be loaded.'));document.head.append(s);
   }));
   return loads.get(kind);
  }
  const embeds=new Map();// kind|binding -> {node, instance}: the node is kept and put back when its section is drawn again
  // The photograph tools and the reader view work on a piece's own saved place, so they need the subject to have one.
  const NEEDS_PLACE=new Set(['photos','arrange','audience']);
  const borrowed=(kind,covers,piece='')=>!mag()&&(ids().bindingId||!NEEDS_PLACE.has(kind))&&typeof document.createElement==='function'?`<div class="subj-embed" data-subj-embed="${kind}" data-subj-covers="${covers}"${piece?` data-piece="${esc(piece)}"`:''}></div>`:'';
  /** The borrowed tool asks by address; here every address is one of the app's named commands, asked through the page's own
      client like everything else (the same actor, the same checks). An address with no command is refused, never fetched. */
  const asMe=(url,input)=>{const [path,query]=String(url).split('?'),m=/^\/api\/study\/photos(\/[a-z-]+)?$/.exec(path);if(!m)return Promise.reject(new Error('That is not available on this page.'));
   return v2.call('study.photos'+(m[1]||'').replace('/','.'),input||Object.fromEntries(new URLSearchParams(query||'')));};
  function embed(sec){
   for(const slot of sec.querySelectorAll('[data-subj-embed]')){
    const kind=slot.dataset.subjEmbed,binding=ids().bindingId,piece=slot.dataset.piece||'',key=kind+'|'+binding+'|'+piece;let e=embeds.get(key);
    if(e){e.node.dataset.subjCovers=slot.dataset.subjCovers;slot.replaceWith(e.node);continue;}
    e={node:slot,instance:null};embeds.set(key,e);slot.innerHTML='<p class="subj-quiet" role="status">Reading</p>';
    if(kind==='consent')startConsent(e);else if(kind==='source')startSource(e);else if(kind==='arrange')startArrange(e,binding,piece);else if(kind==='audience')startAudience(e,binding,piece);else startPhotos(e,binding);
   }
  }
  /** The photographs of this article: the collection the existing workspace keeps for it. Reading it changes nothing; the
      collection is made only when he presses to start choosing. */
  async function startPhotos(e,binding){
   const say=html=>{if(!ctx.signal.aborted)e.node.innerHTML=html;};
   const mountIt=async found=>{await bring('photos');if(ctx.signal.aborted)return;e.node.innerHTML='';e.instance=root.mountPhotosStage(e.node,{projectId:found.projectId,documentId:found.documentId,request:asMe});};
   try{
    const key='owned-draft:'+binding,found=await call('first-flow.binding',{projectKey:key});
    if(ok(found)&&found.projectKey===key&&typeof found.projectId==='string'&&typeof found.documentId==='string'){await mountIt(found);return;}
    say('<p class="subj-quiet">No photographs are chosen for this article yet.</p><div class="subj-actions"><button type="button" class="'+CP+' subj-btn pri" data-subj-startphotos>Choose photographs</button></div>');
    e.node.addEventListener('click',async ev=>{const b=ev.target.closest('[data-subj-startphotos]');if(!b||b.disabled)return;b.disabled=true;
     try{const made=await v2.call('study.photos.select',{bindingId:binding,parentStudyId:id});await mountIt(made);}
     catch(error){b.disabled=false;v2.ui.say(error?.message||'That could not be done. Nothing was changed.',{tone:'bad'});}});
   }catch(error){say(`<p class="subj-quiet" role="alert">${esc(error?.message||'The photographs could not be read.')}</p>`);}
  }
  /** The borrowed layout editor asks by address, with a method and a body. Every address is found in the app's own list of
      commands and asked through this page's client (the same actor, the same checks); its answer goes back in the shape the
      editor expects. An address with no command is answered Not found, never sent. */
  let routes=null;
  const routeMap=()=>routes||=v2.call('capabilities',{only:'commands'}).then(r=>new Map((r?.commands||[]).filter(c=>c&&typeof c.route==='string'&&!c.route.includes('{')).map(c=>[c.method+' '+c.route,c.name])));
  const answer=(status,body)=>new root.Response(JSON.stringify(body??{}),{status,headers:{'Content-Type':'application/json'}});
  async function viaCommands(url,init={}){
   const u=new URL(url,root.location.origin),method=String(init.method||'GET').toUpperCase(),name=(await routeMap()).get(method+' '+u.pathname);
   if(!name)return answer(404,{error:'That is not available on this page.'});
   let body={};try{body=init.body?JSON.parse(init.body):{};}catch{return answer(400,{error:'That request could not be read.'});}
   try{return answer(200,await v2.call(name,{...Object.fromEntries(u.searchParams),...body}));}
   catch(error){return answer(error?.status||500,error?.body&&typeof error.body==='object'?error.body:{error:error?.message||'That could not be done. Nothing was changed.'});}
  }
  /** Layout edits not yet saved are kept on this device, one copy for each piece, and never written over by an older one. */
  const KEPT='ar-v2-subject-layout:';
  const kept=key=>{try{return JSON.parse(root.localStorage.getItem(KEPT+key)||'null')||{};}catch{throw new Error('The edits kept on this device cannot be read. Keep this window open.');}};
  const keepIt=(key,value)=>{try{root.localStorage.setItem(KEPT+key,JSON.stringify(value));}catch{throw new Error('The edits could not be kept on this device. Keep this window open.');}};
  /** Placing photographs in the story: the workspace's own layout editor for this Article, started when he asks for it (it is
      a large file). Saving is its own, with its own rules; a save the app refuses is said in its own words. */
  function startArrange(e,binding,piece){
   const key=binding+'|'+piece,scope={parentStudyId:id,rootBindingId:binding};
   e.node.innerHTML='<div class="subj-actions"><button type="button" class="'+CB+' subj-btn" data-subj-startarrange>Place photographs in the story</button></div>';
   e.node.addEventListener('click',async ev=>{
    const b=ev.target.closest('[data-subj-startarrange]');if(!b||b.disabled)return;b.disabled=true;b.textContent='Opening the layout';
    try{
     const [view]=await Promise.all([v2.call('study.outputs',scope),bring('arrange'),routeMap()]);if(ctx.signal.aborted)return;
     if(!view?.photoScope?.projectId||!view.photoScope.documentId)throw new Error('This Article’s photographs are not connected yet. Choose photographs first.');
     if(!(view.outputs||[]).some(o=>o.id===piece&&o.kind==='article'))throw new Error('This Article has no saved layout yet.');
     const canvas=document.createElement('div');canvas.className='subj-layout';const alert=document.createElement('p');alert.className='subj-quiet';alert.setAttribute('role','alert');alert.hidden=true;
     const say=text=>{alert.textContent=text;alert.hidden=!text;};
     e.node.replaceChildren(alert,canvas);
     e.instance=await root.ArStudyOutputHost.mountStudyOutputHost(canvas,{scope,selectedOutputId:piece,embeddedArrange:true,request:viaCommands,photoScope:view.photoScope,assetOrigin:root.location.origin,
      studyDraft:{openBinding:()=>{throw new Error('The words are written in Write. Press The words on this page.');}},
      readBrowserDraft:outputId=>kept(key).drafts?.[outputId]||null,
      rememberBrowserDraft:(value,expectedToken,outputId)=>{const all=kept(key),drafts={...(all.drafts||{})};if((drafts[outputId]?.token??null)!==expectedToken)throw new Error('Newer edits are already kept on this device. Keep this window open and compare both copies.');if(value)drafts[outputId]=value;else delete drafts[outputId];keepIt(key,{...all,drafts});},
      pendingRequest:kept(key).pending||null,rememberPending:pending=>{keepIt(key,{...kept(key),pending:pending||null});},
      onError:error=>say(error?.message||'That could not be done. Nothing was changed.'),onShelf:()=>say('Other pieces are opened from their own tab at the top of this page.')});
     if(ctx.signal.aborted){try{e.instance.destroy();}catch{}return;}
     // A save that was cut short last time is finished, or said, before anything else is done.
     if(e.instance.pending)try{await e.instance.recoverPending();}catch(error){say(error?.message||'An earlier save could not be finished. Nothing was lost; it is kept on this device.');}
    }catch(error){b.disabled=false;b.textContent='Place photographs in the story';v2.ui.say(error?.message||'The layout could not be opened.',{tone:'bad'});}
   });
  }
  /** The whole conversation: the workspace's own reader of a kept conversation, with its speakers, its find, and its
      corrections under its own saving rules. It is given this page, this subject and this page's client; it is asked for
      only when he presses, because kept conversations are large. A conversation that is one of this subject's own sources
      is opened first; otherwise the reader offers the kept conversations to choose from, as it does in the workspace. */
  let sourceReader=null;
  function startSource(e){
   const idle=()=>{e.node.innerHTML='<div class="subj-actions"><button type="button" class="'+CB+' subj-btn" data-subj-startsource>Read a kept conversation</button></div>';};
   idle();
   e.node.addEventListener('click',async ev=>{
    if(ev.target.closest('[data-subj-closesource]')){try{sourceReader?.closeContext();}catch{}idle();e.node.querySelector('button')?.focus({preventScroll:true});return;}
    const b=ev.target.closest('[data-subj-startsource]');if(!b||b.disabled)return;b.disabled=true;b.textContent='Reading the conversation';
    try{
     actAsMe();
     if(!document.querySelector('link[href="/document-study/source-imported.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/document-study/source-imported.css';document.head.append(l);}
     // The reader's file starts itself on the workspace's own page; here it is started by hand, with this page's client.
     if(!root.studyImportedSource)root.studyImportedSource=Object.freeze({startedBy:'subject'});
     const [made,,tree,brief,plans]=await Promise.all([import('/document-study/source-imported.js'),routeMap(),ask('tree'),ask('brief'),ask('planRecords')]);if(ctx.signal.aborted)return;
     const project=Object.freeze({id,title:st.standing?.title||'',name:st.standing?.title||''});
     sourceReader||=made.installSourceReader({document,getProject:()=>project,fetch:viaCommands,observe:false});
     const mine=new Set(materialFrom({tree,brief,planRecords:Array.isArray(plans)?plans:[]},ids().projectId).items.map(x=>x.id));
     const bar=document.createElement('div');bar.className='subj-actions';bar.innerHTML='<button type="button" class="'+CQ+' v2-ghost" data-subj-closesource>Close the conversation</button>';
     const box=document.createElement('div');box.className='subj-convo';e.node.replaceChildren(bar,box);
     sourceReader.openContext({container:box,project});await sourceReader.refresh();if(ctx.signal.aborted)return;
     const sessions=sourceReader.getState().data?.sessions,own=Array.isArray(sessions)?sessions.find(s=>mine.has(s.sourceId)):null;
     if(Array.isArray(sessions)&&!sessions.length){sourceReader.closeContext();idle();e.node.insertAdjacentHTML('beforeend','<p class="subj-quiet" data-subj-noconvo>No conversation is kept yet, so there is none to read.</p>');return;}
     // The reader opens a conversation it is given and offers none itself, so the kept ones are listed here to choose from.
     const pick=s=>sourceReader.selectSource({sourceId:s.sourceId,expectedSourceHash:s.sourceHash,expectedVersion:s.version});
     const list=(Array.isArray(sessions)?sessions:[]).filter(s=>s&&typeof s.sourceId==='string');
     if(list.length>1||!own){const chooser=document.createElement('ul');chooser.className='subj-list subj-convos';chooser.setAttribute('aria-label','Kept conversations');
      chooser.innerHTML=list.map((s,i)=>`<li><button type="button" class="subj-link" data-subj-convo="${i}" aria-pressed="${s===own}">${esc(s.title||'Untitled conversation')}</button><small>${esc([s.date,mine.has(s.sourceId)?'one of this subject’s sources':''].filter(Boolean).join(' · '))}</small></li>`).join('');
      chooser.addEventListener('click',async cv=>{const cb=cv.target.closest('[data-subj-convo]');if(!cb||cb.disabled)return;cv.stopPropagation();cb.disabled=true;
       try{await pick(list[Number(cb.dataset.subjConvo)]);for(const x of chooser.querySelectorAll('[data-subj-convo]'))x.setAttribute('aria-pressed',String(x===cb));box.scrollIntoView?.({block:'nearest'});}
       catch(error){v2.ui.say(error?.message||'That conversation could not be opened.',{tone:'bad'});}finally{cb.disabled=false;}});
      bar.after(chooser);}
     if(own)await pick(own);
    }catch(error){idle();v2.ui.say(error?.message||'The conversation could not be opened.',{tone:'bad'});}
   });
   ctx.signal.addEventListener('abort',()=>{try{sourceReader?.dispose();}catch{}sourceReader=null;},{once:true});
  }
  /** The consent desk: comfortable sharing, accurate, the people in the piece and their consent, and the final yes. It is the
      workspace's own desk. That desk puts itself on its Share screen by looking for two things on the page: which subject is
      open at the Share stage, and the place the screen keeps for it. Here the step gives it both, and takes them away on leaving.
      For anyone but Adrian it shows his decisions and offers none, by its own rule. */
  function startConsent(e){
   e.node.innerHTML='<p class="subj-quiet" role="status">Reading</p>';
   (async()=>{
    try{
     actAsMe();
     if(typeof root.current==='function'&&!root.current.subjectPage)throw new Error('The consent desk is already open elsewhere on this page.');
     const open=Object.freeze({id,view:'record',viewedStage:11}),say=()=>open;say.subjectPage=true;root.current=say;
     e.node.innerHTML='<div id="app" class="subj-desk"><div class="workspace"></div></div>';
     await bring('consent');if(ctx.signal.aborted)return;
     await root.arConsentDesk.load(id,{force:true});
    }catch(error){if(!ctx.signal.aborted)e.node.innerHTML=`<p class="subj-quiet" role="alert">${esc(error?.message||'The consent desk could not be opened.')}</p>`;}
   })();
   ctx.signal.addEventListener('abort',()=>{if(root.current?.subjectPage)try{delete root.current;}catch{root.current=undefined;}e.node.replaceChildren();},{once:true});
  }
  /** The piece as readers will see it: the saved edition, read again each time he asks, drawn by the workspace's own reader.
      Looking changes nothing. The reader comes in the same large file as the layout editor, so it too loads when asked for. */
  function startAudience(e,binding,piece){
   const scope={parentStudyId:id,rootBindingId:binding};
   const idle=label=>{e.node.innerHTML=`<div class="subj-actions"><button type="button" class="${CB} subj-btn" data-subj-startaudience>${label}</button></div>`;};
   idle('See it as readers will');
   e.node.addEventListener('click',async ev=>{
    const b=ev.target.closest('[data-subj-startaudience]');if(!b||b.disabled)return;b.disabled=true;const label=b.textContent;b.textContent='Reading the saved edition';
    try{
     const [v]=await Promise.all([v2.call('study.outputs',{...scope,selectedOutputId:piece}),bring('arrange')]);if(ctx.signal.aborted)return;
     if(v?.scope?.parentStudyId!==id||v.scope.rootBindingId!==binding||v.documentId!==binding||v.output?.id!==piece)throw new Error('The reader returned a different edition. Nothing is shown.');
     if(!['article','carousel'].includes(v.output.kind)||typeof root.ArStudyOutputHost?.mountStudyAudience!=='function')throw new Error('This kind of piece has no reader view on this page yet.');
     try{e.instance?.destroy?.();}catch{}e.instance=null;
     const bar=document.createElement('div');bar.className='subj-actions';bar.innerHTML='<button type="button" class="'+CQ+' v2-ghost" data-subj-startaudience>Read it again as it is now</button><button type="button" class="'+CQ+' v2-ghost" data-subj-closeaudience>Close</button>';
     const target=document.createElement('div');target.className='subj-reads';target.setAttribute('aria-label','As readers will see it');
     e.node.replaceChildren(bar,target);e.instance=root.ArStudyOutputHost.mountStudyAudience(target,v);
    }catch(error){b.disabled=false;b.textContent=label;v2.ui.say(error?.message||'The reader view could not be opened.',{tone:'bad'});}
   });
   e.node.addEventListener('click',ev=>{if(!ev.target.closest('[data-subj-closeaudience]'))return;try{e.instance?.destroy?.();}catch{}e.instance=null;idle('See it as readers will');e.node.querySelector('button')?.focus({preventScroll:true});});
  }
  ctx.signal.addEventListener('abort',()=>{try{root.arSimmer?.close?.();}catch{}for(const e of embeds.values()){const i=e.instance;if(!i)continue;try{Promise.resolve(i.flush?.()).catch(()=>{}).finally(()=>{try{i.destroy?.();}catch{}});}catch{}}embeds.clear();});
  /** Advanced is hidden for now. A step whose only tools were links there says plainly that its tool is not on this page yet. */
  const toAdvanced=a=>(a.getAttribute('href')||'').startsWith('/document-study')&&!a.hasAttribute('data-subj-capture');
  function soon(sec){
   for(const box of sec.querySelectorAll('.subj-links,.subj-actions'))box.toggleAttribute('data-subj-empty',![...box.children].some(x=>!(x.tagName==='A'&&toAdvanced(x))));
   const body=[...sec.children].filter(x=>x.tagName!=='HEADER'&&!x.matches('.subj-back,[data-subj-empty]'));
   const covered=new Set([...sec.querySelectorAll('[data-subj-covers]')].flatMap(x=>x.dataset.subjCovers.split(' ')));
   const gone=[...new Set([...sec.querySelectorAll('a[href]')].filter(toAdvanced).filter(x=>!covered.has(x.dataset.subjHandoff)).map(x=>x.textContent.trim().replace(/ in Advanced$/,'')).filter(Boolean))];
   if(!body.length)sec.insertAdjacentHTML('beforeend','<p class="subj-quiet" data-subj-soon>This step has no tool on this page yet. It is being built here.</p>');
   // Nothing is hidden silently: what still lives only in Advanced is named, so a step never looks finished when it is not.
   else if(gone.length)sec.insertAdjacentHTML('beforeend',`<p class="subj-quiet" data-subj-soon>Not on this page yet: ${esc(gone.join(', '))}.</p>`);
  }
  /** One thing he has, opened where it is: a note or a transcript to read, a photograph at full width, a link to follow. */
  function readerOf(sid){
   const r=st.reader;if(!r||r.sec!==sid)return '';
   const f=r.file,head=`<header><b>${esc(r.title||'Untitled')}</b><button type="button" class="${CQ} v2-ghost" data-subj-readclose>Close</button></header>`;
   let body='<p class="subj-quiet" role="status">Reading</p>';
   if(r.kind==='photos')body=`<img src="/api/sources/blob?id=${encodeURIComponent(r.id)}" alt="${esc(r.title||'')}">`;
   else if(f&&f.__error)body=`<p class="subj-quiet" role="alert">${esc(f.__error?.message||'This could not be read.')}</p>`;
   else if(f){const text=String(f.text||f.body||'').trim(),url=/^https?:\/\//.test(f.url||'')?f.url:'';
    body=(url?`<p><a class="subj-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}${icon('chev')}</a></p>`:'')+(text?`<div class="subj-readtext">${text.split(/\n{2,}/).map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:url?'':'<p class="subj-quiet">There are no words in this one.</p>');}
   return `<article class="subj-reader" data-subj-reader tabindex="-1" aria-label="${esc(r.title||'Reading')}">${head}${body}</article>`;
  }
  function openReader(sec,id,title,kind){
   if(st.reader?.id===id&&st.reader.sec===sec){st.reader=null;paintNow();return;}
   const r=st.reader={sec,id,title,kind,file:null};paintNow();
   secOf(sec)?.querySelector('[data-subj-reader]')?.scrollIntoView?.({block:'nearest',behavior:calm()?'auto':'smooth'});
   if(kind!=='photos')call('sources.file.get',{id}).then(f=>{if(st.reader!==r||ctx.signal.aborted)return;r.file=f||{__error:{message:'This could not be read.'}};paintNow();});
  }
  const calm=()=>!!root.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
  /** Bring a step's section to the top of the window. The side list holds still until the page has arrived. */
  function goTo(sid,smooth=true){const sec=secOf(sid);if(!sec)return;st.hold=Date.now()+1500;sec.scrollIntoView?.({block:'start',behavior:smooth&&!calm()?'smooth':'auto'});}
  /** Once, when he comes back to a step (the address or this tab remembers it), the page goes to it. A page opened fresh stays at the top. */
  function place(){
   if(st.placed||!st.standing)return;st.placed=true;
   if(!st.came)return;
   const y=st.backY,go=()=>{if(ctx.signal.aborted||st.moved)return;st.hold=Date.now()+400;if(y!=null)root.scrollTo?.(0,y);else if(st.open&&st.open!==current().steps[0]?.id)secOf(st.open)?.scrollIntoView?.({block:'start',behavior:'auto'});};
   // Again once the records are in, since the sections grow as they arrive; never after he has moved the page himself.
   go();Promise.all(Object.values(st.pend)).then(()=>setTimeout(go,60));
   for(const ev of ['wheel','touchmove','keydown','pointerdown'])root.addEventListener(ev,()=>{st.moved=true;},{once:true,passive:true,signal:ctx.signal});
  }
  /** The side list follows the page: the step whose section has reached the top of the window is the current one. */
  let keep=null;
  function spy(){
   if(ctx.signal.aborted||st.zoom||Date.now()<st.hold)return;
   const secs=[...page.querySelectorAll('[data-subj-sec]')];if(!secs.length)return;
   const line=(parseFloat(root.getComputedStyle(document.documentElement).getPropertyValue('--v2-top'))||48)+140;
   let now=secs[0];for(const s of secs)if(s.getBoundingClientRect().top<=line)now=s;
   const sid=now.dataset.subjSec;if(sid===st.open)return;
   st.open=sid;clearTimeout(keep);keep=setTimeout(()=>{if(!ctx.signal.aborted)remember();},300);paintNow();
  }
  const arrived=()=>{st.hold=0;};
  root.addEventListener('scroll',spy,{passive:true});root.addEventListener('scrollend',arrived);
  ctx.signal.addEventListener('abort',()=>{root.removeEventListener('scroll',spy);root.removeEventListener('scrollend',arrived);clearTimeout(keep);document.documentElement.style.overflow='';});
  /** Open one section to the whole window, or fold it back. The page behind does not move, so he lands where he was. */
  function setZoom(sid){
   const was=st.zoom,box=$('[data-subj-secs]');
   if(sid&&!was){st.zoomY=root.scrollY||0;const sec=secOf(sid);if(sec){const hold=document.createElement('div');hold.className='subj-hold';hold.dataset.subjHold='';hold.style.height=sec.offsetHeight+'px';sec.before(hold);}}
   st.zoom=sid||null;document.documentElement.style.overflow=st.zoom?'hidden':'';// the page behind holds still
   if(sid){st.open=sid;remember();}
   paintNow();
   const sec=secOf(sid||was);
   if(!sid){box?.querySelector('[data-subj-hold]')?.remove();st.hold=Date.now()+400;root.scrollTo?.(0,st.zoomY);sec?.querySelector('h2')?.focus({preventScroll:true});return;}
   if(sec){sec.scrollTop=0;sec.querySelector('h2')?.focus({preventScroll:true});}
  }
  /** Choose the look without leaving the page. A look is kept with a Carousel, so the choice is set on each of this subject's. */
  function chooseLook(){
   const s=st.standing;if(!s)return;
   const plans=(s.forms||[]).filter(f=>f.kind==='instagram'),now=s.look||null,list=st.looks.filter(l=>l.drawable!==false);
   const why=plans.length?`The look is kept with this subject's ${plans.length===1?'Carousel':'Carousels'}. You stay on this page.`:'A look is kept with a Carousel drawn in the slide studio, and this subject has none yet. Add a Carousel, then choose its look here.';
   const rows=list.map(l=>`<button type="button" data-subj-setlook="${esc(l.id)}" aria-pressed="${l.id===now}"${plans.length?'':' disabled'}><b>${esc(l.name)}</b>${l.description?`<span>${esc(l.description)}</span>`:''}${l.id===now?'<em>In use</em>':''}</button>`).join('');
   const body=`<p class="subj-quiet">${esc(why)}</p><div class="subj-kinds">${rows||'<p class="subj-quiet">The looks could not be read.</p>'}</div><p class="subj-lookmore"><a class="subj-link" data-subj-lookedit href="${esc(v2.href('looks',{},now?{look:now}:{}))}">Make and change looks in Looks${icon('chev')}</a></p>`;
   const sheet=v2.ui.sheet({title:'Choose a look',body});sheet.el.classList.add('subj-sheetdlg');
   ctx.signal.addEventListener('abort',()=>sheet.close(),{once:true});// leaving the page closes it
   sheet.body.addEventListener('click',async e=>{
    if(e.target.closest('[data-subj-lookedit]')){sheet.close();return;}
    const b=e.target.closest('[data-subj-setlook]');if(!b||b.disabled||st.busy)return;
    const look=b.dataset.subjSetlook;sheet.close();
    await act(['planRecords'],async()=>{
     for(const f of plans){const p=await v2.call('instagram.plan.get',{id:f.id});if(p?.look===look)continue;await v2.call('instagram.look',{id:f.id,...v2.expect(p),look});}
     v2.ui.say(lookName(look)+' look chosen.',{tone:'good'});
    });
   });
  }
  /** A hand-off link, named in HANDOFFS so its label and its section cannot drift apart. */
  const out=(key,form,cls='subj-link')=>`<a class="${cls}" data-subj-handoff="${key}" href="${key==='write'?writeHref(form):screenHref(key,form)||handoffHref(HANDOFFS[key].section,form)}" title="${key==='write'&&form?.kind==='article'?'Opens Write':ownScreen(key,form)?'Opens '+SCREEN_OF[key][0].toUpperCase()+SCREEN_OF[key].slice(1):(mag()?'Opens Advanced. A story cannot be opened from a link there, so find it on its Magazine board':'Opens in '+where())}">${esc(ownScreen(key,form)&&SCREEN_LABEL[key]||said(HANDOFFS[key].label))}${cls==='subj-link'?icon('chev'):''}</a>`;
  const btn=(key,form,pri=false)=>out(key,form,'subj-btn'+(pri?' pri':''));
  /** The step's own hand-off, from the section the command names for it. */
  const own=(s,form)=>{const h=ownHandoff(s);if(!h)return '';return h.key?out(h.key,form):`<a class="subj-link" data-subj-handoff="own" href="${screenOfSection(h.section,form)||handoffHref(h.section,form)}" title="${screenOfSection(h.section,form)?'Opens '+SECTION_LABEL[h.section]:(mag()?'Opens Advanced. A story cannot be opened from a link there, so find it on its Magazine board':'Opens in '+where())}">${esc(screenOfSection(h.section,form)?'Open '+SECTION_LABEL[h.section]:said(h.label))}${icon('chev')}</a>`;};
  const links=(...items)=>{const seen=new Set(),l=items.filter(x=>{if(!x)return false;if(!mag())return true;const k=x.replace(/<[^>]*>/g,'').trim();return !seen.has(k)&&seen.add(k);}).join('');return l?`<div class="subj-links">${l}</div>`:'';};
  /** What a step waits for: one button to the step in question, as the sample's Go to the words. */
  const waitsFor=(s,steps)=>{
   const rows=(s.waits||[]).map(w=>{const t=steps.find(x=>x.id===w);return t?`<button type="button" class="${CB} subj-btn" data-subj-step="${esc(t.id)}">Go to ${esc(/^(The|Your) /.test(t.name)?t.name.charAt(0).toLowerCase()+t.name.slice(1):t.name)}${icon('right')}</button>`:'';}).join('');
   return rows?`<div class="subj-actions subj-waits">${rows}</div>`:'';
  };
  const reading=()=>`<p class="subj-quiet" role="status">Reading</p>`;
  const rec=k=>st.rec[k];

  // ===== confirm a transcript and use it for Check: BEGIN (the list and the button are createCaptureSources, above) =====
  // Confirming is Adrian's own act on the transcript's words: the speakers are named, then the review is confirmed, both
  // through the recording's own actions as the page's actor. The server accepts an assistant's review too and records who made
  // it, so the page never claims more than the stamp says: "Confirmed by you" only for a human stamp on the current bytes.
  // Opening the panel and drawing the row only read (.transcription.id.look: no lock, nothing written); the press is what writes.
  // The transcript file's hash changes when it is confirmed, so the list is read again afterwards.
  const cs=createCaptureSources({scope:()=>{const b=st.standing?.facts?.bindingId;return b?{bindingId:b,parentStudyId:id}:null;},paint:()=>paintNow(),after:async()=>{ask('recordings',true);},stopped:async()=>{ask('check',true);},signal:ctx.signal});
  // Another tab's stop or capture: read the list again, keeping the old one on screen meanwhile.
  ctx.on({kinds:['study-draft.capture-sources*']},()=>{void cs.refresh();});
  const cf={job:null,state:'idle',look:null,names:{},error:'',looks:new Map(),fresh:new Set(),pend:new Set(),seen:null};
  const recAct=(job,action,input={})=>v2.call('.transcription.id.action',{id:job,action,...input});
  const lookRead=job=>v2.call('.transcription.id.look',{id:job});
  const lookSig=r=>!r||r.__error?'':[r.reviewStatus,r.reviewedBy].join('|');
  /** What is on file for one transcript: its words, speakers and review stamp, one read. Kept while the next read is made, so the row does not blink. */
  function lookOf(jobId){
   const now=rec('recordings');
   if(cf.seen!==now){cf.seen=now;cf.fresh.clear();}
   if(!cf.fresh.has(jobId)&&!cf.pend.has(jobId)){
    cf.pend.add(jobId);const at=cf.seen;
    lookRead(jobId).catch(error=>({__error:error})).then(r=>{
     cf.pend.delete(jobId);if(ctx.signal.aborted||cf.seen!==at)return;
     const before=cf.looks.get(jobId);cf.looks.set(jobId,r);cf.fresh.add(jobId);
     // The list is the server's own reading of the same bytes: read it again when the stamp moved, so the two never disagree.
     if(before&&lookSig(before)!==lookSig(r))cs.reset();
     schedule();
    });
   }
   return cf.looks.get(jobId);
  }
  /** Who stands behind the words: 'human' (confirmed by him, on the current bytes), 'other' (reviewed, but not by a human), 'open' (not reviewed) or null (not read yet). */
  function reviewOf(job){
   const L=lookOf(job.id);
   if(!L)return null;
   if(L.__error||L.reviewStatus!=='reviewed')return 'open';
   return String(L.reviewedBy||'').startsWith('human:')?'human':'other';
  }
  const csConfirmed=job=>reviewOf(job)==='human';
  /** The row's words and control for a transcript that is ready: the truth from the stamp, never from "reviewed" alone. */
  function confirmRow(job){
   const how=reviewOf(job);if(how===null)return '';
   const L=cf.looks.get(job.id),mine=v2.isHuman(),button=`<button type="button" class="${CB} subj-btn" data-cs="open" data-job="${esc(job.id)}">Confirm this transcript</button>`;
   if(how==='human')return `<span class="subj-where" data-cs-confirmed tabindex="-1">${mine?'Confirmed by you':'Confirmed by Adrian'}</span>`;
   if(how==='other'){
    const note=mine?'Reviewed, not confirmed by you yet':String(L.reviewedBy||'').startsWith('agent:')?'Reviewed by an assistant. Not confirmed by Adrian yet.':'Reviewed, not confirmed by Adrian yet';
    return `<span class="subj-where" data-cs-reviewed tabindex="-1">${note}</span>${mine?button:''}`;
   }
   return L&&!L.__error&&!(L.segments||[]).length?'':button;
  }
  const focusSoon=sel=>{const go=()=>$(sel)?.focus({preventScroll:true});go();setTimeout(go,0);};
  async function openConfirm(job){
   Object.assign(cf,{job,state:'loading',look:null,names:{},error:''});paintNow();
   try{cf.look=await lookRead(job);cf.looks.set(job,cf.look);cf.state='ready';}catch(error){cf.state='error';cf.error=error?.message||'The transcript could not be read.';}
   paintNow();focusSoon('[data-cs-words]');
  }
  /** Close without saving; focus goes back to the control that opened it (or, when that is gone, the words that replaced it). */
  function closeConfirm(){
   const job=cf.job;cf.job=null;cf.state='idle';paintNow();
   if(job)focusSoon(`[data-cs="open"][data-job="${cssq(job)}"],[data-cs-confirmed],[data-cs-reviewed]`);
  }
  async function doConfirm(){
   if(cf.state!=='ready')return;
   // An assistant's press sends only the review: naming speakers or making the revision first would write things Adrian never asked for, and the server refuses the review itself.
   const mine=v2.isHuman(),unnamed=mine?(cf.look?.speakers||[]).filter(s=>!s.name):[],names={};
   for(const s of unnamed){const v=String(cf.names[s.id]||'').trim();if(!v){v2.ui.say('Say who is speaking first.',{tone:'warn'});return;}names[s.id]=v;}
   const job=cf.job;cf.state='busy';paintNow();
   let failed=null;
   try{
    // The press may make the transcript's mapping the first time, so the revision comes from the recording's own read, now.
    if(!mine)await recAct(job,'review',{confirmed:true});
    else{
     let expected=(await recAct(job,'recover')).expected;
     if(unnamed.length){const named=await recAct(job,'speakers',{expected,names});expected=named.expected;}
     await recAct(job,'review',{expected,confirmed:true});
    }
   }catch(error){failed=error;}
   // One plain read after the press, whatever happened: the panel and the row show what is on file now (named speakers lose their box).
   let now=null;try{now=await lookRead(job);cf.looks.set(job,now);cf.fresh.add(job);}catch{}
   if(failed){cf.state='ready';if(now)cf.look=now;v2.ui.say(failed?.message||'That could not be done. Nothing was changed.',{tone:'bad'});paintNow();return;}
   cs.reset();ask('recordings',true);
   if(now&&now.reviewStatus==='reviewed'&&!String(now.reviewedBy||'').startsWith('human:'))v2.ui.say(v2.isHuman()?'Reviewed, not confirmed by you yet.':'Reviewed by an assistant. Not confirmed by Adrian yet.',{tone:'warn'});
   closeConfirm();
  }
  function confirmMarkup(){
   if(!cf.job)return '';
   const open=inner=>`<section class="subj-cs-confirm" data-cs-confirm aria-label="Confirm this transcript">${inner}</section>`;
   if(cf.state==='loading')return open('<p class="subj-cs-note" role="status">Reading the transcript.</p>');
   if(cf.state==='error')return open(`<p class="subj-cs-note" role="alert">${esc(cf.error)}</p><div class="subj-cs-btns"><button type="button" class="${CQ} v2-ghost" data-cs="cancel">Close</button></div>`);
   const sp=cf.look?.speakers||[],segs=cf.look?.segments||[],label=sid=>{const i=sp.findIndex(s=>s.id===sid),s=sp[i];return s&&s.name?s.name:i<0?'No speaker':'Speaker '+(i+1);};
   const words=segs.map(g=>`<p>${sp.length>1||g.speaker==null||sp[0]?.name?`<b>${esc(label(g.speaker))}</b> `:''}${esc(g.text)}</p>`).join('');
   const boxes=sp.filter(s=>!s.name).map(s=>`<label class="subj-cs-name"><span>Who is ${esc(label(s.id))}?</span><input type="text" data-cs-name="${esc(s.id)}" maxlength="120" autocomplete="off" value="${esc(cf.names[s.id]||'')}"></label>`).join('');
   const loose=segs.some(g=>g.speaker==null||!sp.some(s=>s.id===g.speaker))?'<p class="subj-cs-note">A line with no speaker has to be settled in Advanced before this can be confirmed.</p>':'';
   const busy=cf.state==='busy';
   return open(`<div class="subj-cs-words" data-cs-words tabindex="0" role="region" aria-label="The transcript's words">${words||'<p>The transcript has no words.</p>'}</div>${loose}${boxes}<div class="subj-cs-btns">${segs.length?`<button type="button" class="${CB} subj-btn" data-cs="confirm"${busy?' disabled':''}>Confirm</button>`:''}<button type="button" class="${CQ} v2-ghost" data-cs="cancel"${busy?' disabled':''}>Not now</button></div>`);
  }
  // ===== confirm a transcript and use it for Check: END =====

  function tool(s,form,steps){
   if(s.state==='unknown'&&s.id!=='publish')return notKnown(s,form);
   switch(s.id){
    case 'have':return toolHave(s,form);
    case 'transcript':return toolTranscript(s,form);
    case 'facts':return toolFacts(s,form);
    case 'dish':return toolDish(s,steps,form);
    case 'form':return waitsFor(s,steps)+`<div class="subj-actions"><button type="button" class="pri" data-subj-add>Add a form</button></div>`+links(own(s,form));
    case 'words':return toolWords(s,form);
    case 'photos':return waitsFor(s,steps)+borrowed('photos','media addPhotos')+(form?.kind==='article'&&/^out:/.test(form.key||'')?borrowed('arrange','arrange',form.id):'')+links(...(s.missing?[out('addPhotos',form)]:[]),out('media',form),out('arrange',form));
    case 'check':return toolCheck(s,steps,form);
    case 'story':return toolStory(s,form);
    case 'slides':return form?.kind==='instagram'?toolSlides(s,form,steps):outputStudio(form)?toolOutputSlides(s,form):links(own(s,form));
    case 'posttext':return waitsFor(s,steps)+(form?.kind==='instagram'&&laidOut(form)?`<div class="subj-actions">${studio(form)}</div>`:'')+links(out('postWrite',form),out('postRead',form),out('postCheck',form));
    case 'yes':return toolYes(s,form);
    case 'publish':return toolPublish(s,steps,form);
   }
   return links(own(s,form));
  }
  /** A step he opened that is not known: it says so plainly, and every way into Advanced for it is offered. */
  function notKnown(s,form){
   const keys=STEP_OUT[s.id]||[];
   if(mag()&&s.id==='check')return `<p class="subj-quiet">This story has a check on file, but it cannot be counted here. Open Check to see where it stands.</p>`+links(out('checkRun',form));
   return `<p class="subj-quiet">Not known yet. What this step rests on has not been read, so nothing is claimed.</p>`+links(...(keys.length?keys.map(k=>out(k,form)):[own(s,form)]));
  }
  const WAYS=[['mic','A recording','Record now, or add one.'],['note','A note or a link','A thought, a page, a video.'],['photo','Photographs','From this device or the Library.']];
  /** The three ways in and the drop strip. Adding material is done in the existing workspace, so each opens Material there. */
  /** What a way in does: the Capture sheet when the app has one (read now, as the press does), else Material in Advanced. */
  const wayTip=()=>typeof v2.capture==='function'?'Opens the Capture sheet':'Opens Material in Advanced';
  function ways(){
   const to=handoffHref('material',null);
   return `<div class="subj-ways">${WAYS.map(([ic,n,w])=>`<a data-subj-handoff="addMaterial" data-subj-capture href="${to}" title="${wayTip()}">${ownIcon(ic)}<b>${n}</b><span>${w}</span></a>`).join('')}</div><a class="subj-drop" data-subj-handoff="addMaterial" data-subj-capture href="${to}" title="${wayTip()}">${icon('plus')}Or drop anything here</a>`;
  }
  /** A Magazine story's material is kept in the Magazine; the page says what is there and where to add to it. */
  function toolHaveMagazine(s,form){
   const m=st.standing?.facts?.material,n=m?[m.notes&&plural(m.notes,'written source'),m.photos&&plural(m.photos,'photograph')].filter(Boolean).join(' · '):'';
   return `<p class="subj-quiet">${m?(n||'Nothing yet')+'. ':'Not known. '}This story's material is kept in the Magazine, so it is added there.</p>`+links(out('addMaterial',form),out('readSources',form));
  }
  function toolHave(s,form){
   if(mag())return toolHaveMagazine(s,form);
   const known=['tree','brief','planRecords'].every(k=>rec(k)!==undefined);
   const m=known?materialFrom({tree:rec('tree'),brief:rec('brief'),planRecords:Array.isArray(rec('planRecords'))?rec('planRecords'):[]},ids().projectId):null;
   const photos=m?m.items.filter(x=>x.kind==='photos'):[],rest=m?m.items.filter(x=>x.kind!=='photos'):[];
   const capList=st.zoom==='have'?Infinity:11,capTray=st.zoom==='have'?Infinity:12;
   const KIND={recordings:'Recording',notes:'Your note',links:'Link'},IC={recordings:'mic',notes:'note',links:'note'};
   const jobs=ok(rec('recordings'))?rec('recordings'):null,byJob=new Map((jobs?.jobs||[]).map(j=>[j.sourceId,j])),done=new Set(registeredJobs(rec('tree'),rec('brief')));
   // A transcript kept as a source (by the button, or in Advanced) is itself part of what he has.
   {const have=new Set(rest.map(x=>x.id));for(const x of rest.slice()){const job=byJob.get(x.id);if(!job||!done.has(job.id))continue;
    for(const t of ok(rec('tree'))?rec('tree').sources||[]:[])if(t?.id&&t.kind==='transcript'&&t.recordingId===job.id&&!have.has(t.id)){have.add(t.id);rest.push({id:t.id,title:t.title||t.name||'Transcript',kind:'recordings',recordingId:t.recordingId});}}}
   const where=x=>{
    if(x.kind!=='recordings'||x.recordingId)return '';
    const job=byJob.get(x.id),v=jobs&&job?recordingView(job,jobs.capability,done.has(job.id)):null;if(!v)return '';
    const mine=transcriptAct(v.act,v2.isHuman()),act=mine==='owner'?`<span class="subj-quiet" data-subj-owner>Keeping this transcript as a source is for Adrian to do.</span><a class="subj-link subj-quietlink" data-subj-handoff="readTranscript" href="${handoffHref('source',null)}" title="Opens the transcript in Advanced">Open in Advanced</a>`:mine==='use'?`<button type="button" class="${CB} subj-btn" data-subj-rec="use" data-job="${esc(job.id)}" title="Keeps the finished transcript as a source of this subject">Use the transcript</button><a class="subj-link subj-quietlink" data-subj-handoff="readTranscript" href="${handoffHref('source',null)}" title="Opens the transcript in Advanced, where its words are checked">Open in Advanced</a>`:v.act?`<button type="button" class="${CB} subj-btn" data-subj-rec="${v.act}" data-job="${esc(job.id)}">${v.act==='start'?'Make the transcript':'Try the transcript again'}</button>`:'';
    // capture sources (marked block): the transcript's own confirm control, or the words "Confirmed by you"
    const ready=job.state==='done'&&job.transcriptReady;
    const confirm=ready?confirmRow(job):'';
    return `<span class="subj-where" data-subj-where>${esc(v.say)}</span>${act}${confirm}`;
   };
   // capture sources (marked block): the open confirm panel, and the list with its one button once a confirmed transcript is kept
   const csPanels=()=>{
    const keptSure=rest.some(x=>{const job=x.kind==='recordings'&&!x.recordingId?byJob.get(x.id):null;return !!job&&job.state==='done'&&job.transcriptReady&&done.has(job.id)&&csConfirmed(job);});
    const b=keptSure?cs.block():'';
    return confirmMarkup()+b;
   };
   const list=rest.length?`<ul class="subj-have">${rest.slice(0,capList).map(x=>`<li data-subj-src="${esc(x.id)}" data-title="${esc(x.title)}" data-kind="${x.kind}" tabindex="0" role="button">${ownIcon(IC[x.kind])}<b title="${esc(x.title)}">${esc(x.title)}</b><small>${x.recordingId?'Transcript':KIND[x.kind]}</small>${where(x)}</li>`).join('')}${rest.length>capList?`<li><small>and ${rest.length-capList} more. Full size shows them all.</small></li>`:''}</ul>`:'';
   const tray=photos.length?`<div class="subj-tray">${photos.slice(0,capTray).map(x=>`<img data-subj-src="${esc(x.id)}" data-title="${esc(x.title)}" data-kind="photos" tabindex="0" role="button" src="/api/sources/blob?id=${encodeURIComponent(x.id)}" alt="${esc(x.title)}" loading="lazy">`).join('')}${photos.length>capTray?`<span>+${photos.length-capTray}</span>`:''}</div>`:'';
   const any=s.state==='done'||list||tray;
   if(!any)return (!known?reading():'')+ways()+borrowed('source','readSources readTranscript');
   return (!known?reading():'')+list+csPanels()+tray+borrowed('source','readSources readTranscript')+`<a class="subj-drop" data-subj-handoff="addMaterial" data-subj-capture href="${handoffHref('material',null)}" title="${wayTip()}">${icon('plus')}Add a recording, note, link or photographs</a>`;
  }
  function toolTranscript(s,form){
   const plans=rec('planRecords'),flags=[];
   for(const pr of Array.isArray(plans)?plans.filter(ok):[]){const open=new Set((pr.flagStatus||[]).filter(x=>x.status==='open').map(x=>x.id));for(const x of pr.flags||[])if(open.has(x.id))flags.push({...x,planId:pr.id,line:(pr.lines||[]).find(l=>l.id===x.lineId)?.text||''});}
   const m=materialFrom({tree:rec('tree'),planRecords:Array.isArray(plans)?plans:[]},ids().projectId);
   const jobs=new Set(m.items.filter(x=>x.kind==='recordings').map(x=>x.transcriptState?.jobId||x.recordingId).filter(Boolean));
   const checks=ok(rec('wordChecks'))?(rec('wordChecks').recordings||[]).filter(r=>jobs.has(r.jobId)&&r.open):[];
   const words=flags.length?`<ol class="subj-talk">${flags.slice(0,6).map(x=>`<li><small>${esc(x.why||'To confirm')}</small><p class="subj-quote">${hl(x.line,x.heard)}</p></li>`).join('')}</ol>${flags.length>6?`<p class="subj-quiet">and ${flags.length-6} more</p>`:''}`:'';
   const who=v2.actor()&&!v2.isHuman()?'&reviewActor='+encodeURIComponent(v2.actor()):'';
   const hear=checks.map(c=>`<a class="${CB} subj-btn" href="/transcript-check/index.html?job=${encodeURIComponent(c.jobId)}${who}" title="Opens the word check">Hear ${plural(c.open,'word')}${c.story?' in '+esc(c.story):''}</a>`).join('');
   const plan=flags[0]?.planId;
   return (plans===undefined?reading():'')+words+(hear||plan?`<div class="subj-actions">${hear}${plan?`<a class="${CB} subj-btn" href="/document-study/index.html?instagram=${encodeURIComponent(plan)}${who}" title="Opens the slide studio in Advanced">Confirm them in the slide studio</a>`:''}</div>`:'')+links(out('readTranscript',form));
  }
  const hl=(line,heard)=>{const i=heard?String(line).indexOf(heard):-1;return i<0?esc(line):esc(line.slice(0,i))+'<mark>'+esc(heard)+'</mark>'+esc(line.slice(i+heard.length));};
  function toolFacts(s,form){
   if(mag())return `<p class="subj-quiet">${s.state==='done'?'A research file is on record in the Magazine. Whether its findings were read is not recorded.':'No research file is on record for this story.'}</p>`+links(out('research',form));
   const b=ok(rec('brief'))?rec('brief'):null,tp=rec('topics');
   let body='';
   if(b?.research?.question)body+=`<div class="subj-one"><p class="subj-label">Asked</p><p class="subj-quote">${esc(b.research.question)}</p></div>`;
   const toLook=(b?.materials||[]).filter(mm=>!mm.reviewed&&!['audio','image'].includes(mm.kind));
   const review=b?.step==='review'&&toLook.length;
   if(review)body+=`<div class="subj-one"><p>${plural(toLook.length,'source')} not looked at yet.</p><ul class="subj-have subj-plain">${toLook.slice(0,6).map(mm=>`<li><b title="${esc(mm.title)}">${esc(mm.title)}</b><small>Not looked at</small></li>`).join('')}</ul><div class="subj-actions">${btn('researchLook',form,true)}</div></div>`;
   const learn=(tp?.list||[]).map(t=>`<a class="subj-link" href="${esc(v2.href('research/topic/:id',{id:t.id}))}">${esc(topicLine(t))}${icon('chev')}</a>`).join('');
   return (rec('brief')===undefined?reading():'')+body+links(learn,review?'':out('research',form));
  }
  /** Name the dish, in place: what the board holds (the letter, the possible dishes, the feelings), the dish in his words
      with Edit, and the board itself in Advanced. Only the sentence he types is written, by simmer.dish. */
  function toolDish(s,steps,form){
   const bd=ok(rec('board'))?rec('board'):null,f=bd?.forming||{},blocks=(bd?.groups||[]).flatMap(g=>g.blocks||[]);
   const sentence=typeof f.named==='string'?f.named:f.named?.text||'',d=rec('direction'),dir=ok(d)&&!mag()?adoptedWords(d.body):'';
   const letter=blocks.find(x=>x.kind==='letter'&&x.letter),feel=blocks.filter(x=>x.kind==='feeling'&&x.text).slice(0,4);
   const by=x=>x?.by?`<em class="subj-by">${esc(v2.actorName(x.by))}’s proposal</em>`:'';
   const L=letter?.letter||{},rows=[['What keeps coming back',L.recurs],['Where your voice changed',L.voice],['Still unresolved',L.unresolved]].filter(r=>r[1]);
   const left=(rows.length?`<section><p class="subj-label">What keeps coming back${by(letter)}</p><ul class="subj-rec">${rows.map(([n,t])=>`<li><b>${esc(n)}.</b> ${esc(t)}</li>`).join('')}</ul></section>`:'')
    +(feel.length?`<section><p class="subj-label">True for you, or borrowed?</p><ul class="subj-feel">${feel.map(x=>`<li><span>${esc(x.text)}</span>${out('board',form)}</li>`).join('')}</ul></section>`:'');
   const dishes=(f.dishes||[]).slice(0,4).map(x=>`<li${f.dish===x.id?' class="on"':''}><b>${esc(x.title||'')}</b>${x.why?`<span>${esc(x.why)}</span>`:''}${f.dish===x.id?'<em class="subj-by">Chosen</em>':by(x)}</li>`).join('');
   const right=dishes?`<section><p class="subj-label">It could be</p><ul class="subj-dishes">${dishes}</ul></section>`:'';
   const said=sentence||dir,editing=st.editDish!==undefined;
   const edit=editing?`<form class="subj-dishform" data-subj-dishform><label for="subj-dish">The dish, in your words</label><textarea id="subj-dish" rows="3" data-subj-dishtext>${esc(st.editDish)}</textarea><div class="subj-actions"><button type="submit" class="pri">Keep it</button><button type="button" class="${CQ} v2-ghost" data-subj-dishcancel>Cancel</button></div></form>`
    :`<p class="subj-label">The dish, in your words</p>${said?`<blockquote class="subj-quote big">${esc(said)}</blockquote>`:`<p class="subj-quiet">Not said yet.</p>`}<div class="subj-actions">${mag()?'':`<a class="${CB} subj-btn" data-subj-handoff="dishChange" href="${handoffHref('direction',form)}" title="Opens Direction in Advanced">Say it again</a>`}${mag()?'':'<button type="button" class="${CP} subj-btn pri" data-subj-borrow="simmer" data-subj-covers="board dishChange dishWrite">Open the Simmer board</button>'}<button type="button" class="${CB} subj-btn" data-subj-dishedit>${said?'Edit':'Write it'}</button><span class="subj-sp"></span>${out('board',form,'subj-btn').replace('</a>',icon('right')+'</a>')}</div>`;
   return (rec('board')===undefined?reading():'')+waitsFor(s,steps)+((left||right)?`<div class="subj-sim">${left?`<div>${left}</div>`:''}${right?`<div>${right}</div>`:''}</div>`:'')+`<div class="subj-named">${edit}</div>`;
  }
  function toolWords(s,form){
   const r=ok(rec('read'))?rec('read'):null,blocks=(r?.projection||[]).filter(x=>String(x.words||'').trim()),parts=partsOf(blocks);
   const write=writeHref(form);
   const sheet=blocks.length?`<a class="subj-sheet" href="${write}" aria-label="Open the writing in Advanced" tabindex="-1"><b>${esc(form?.title||st.standing.title)}</b>${blocks.slice(0,5).map(x=>x.blockKind==='heading'?`<i>${esc(String(x.words).slice(0,80))}</i>`:`<span>${esc(String(x.words).slice(0,220))}</span>`).join('')}</a>`:'';
   const list=parts.length?`<ol class="subj-parts">${parts.map(p=>`<li title="${esc(plural(p.paragraphs,'paragraph'))}"><i aria-hidden="true"></i><span>${esc(p.name)}</span></li>`).join('')}</ol>`:'';
   return (rec('read')===undefined?reading():'')+(sheet||list?`<div class="subj-words">${sheet}<div>${list}</div></div>`:'')+`<div class="subj-actions"><a class="${CP} subj-btn pri" data-subj-handoff="write" href="${write}">${HANDOFFS.write.label}${icon('right')}</a>${blocks.length||mag()&&s.state!=='todo'?`<a class="${CB} subj-btn" data-subj-handoff="read" href="${screenHref('read',form)||handoffHref('read',form)}">${HANDOFFS.read.label}</a>`:''}</div>`;
  }
  function toolCheck(s,steps,form){
   const c=ok(rec('check'))?rec('check'):null,all=(c?.issues||[]).map(i=>i.message).filter(Boolean),list=st.zoom==='check'?all:all.slice(0,3);
   const rows=list.length?`<ul class="subj-list">${list.map(m=>`<li><span>${esc(m)}</span></li>`).join('')}${all.length>list.length?`<li><small>and ${all.length-list.length} more. Full size shows them all.</small></li>`:''}</ul>`:'';
   return waitsFor(s,steps)+rows+links(out(c?'checkOpen':'checkRun',form));
  }
  const planOf=form=>{const p=rec('planRecords');return form?.kind==='instagram'&&Array.isArray(p)?p.filter(ok).find(x=>x.id===form.id)||null:null;};
  const studio=form=>form?.kind==='instagram'?`<a class="${CP} subj-btn pri" href="${esc(v2.href('slides/:id',{id:form.id}))}">Open the slide studio${icon('right')}</a>`:'';
  const igAdvanced=form=>`<a class="${CB} subj-btn" href="/document-study/index.html?instagram=${encodeURIComponent(form.id)}${v2.actor()&&!v2.isHuman()?'&reviewActor='+encodeURIComponent(v2.actor()):''}" title="Opens the slide studio in Advanced">Open the slide studio in Advanced</a>`;
  const laidOut=form=>{const p=planOf(form);return !!p&&Object.values(p.layouts||{}).some(l=>(l?.frames||[]).length);};
  // What a waiting Carousel step waits for, and the way forward that already exists: the same place in Advanced.
  const STORY_WAIT='An assistant proposes the stories from your words and photographs. You choose one.';
  const waitingCarousel=(form,say,key)=>`<p class="subj-quiet" data-subj-waiting>${esc(say)}</p><div class="subj-actions">${out(key,form,'subj-btn')}</div>`;
  function toolStory(s,form){
   const p=planOf(form);
   const list=(p?.stories||[]).map(x=>{const on=p.chosen?.storyId===x.id;return `<li>${mark(on?'done':'todo')}<span><b>${esc(x.title)}</b>${x.readback?`<small>${esc(x.readback)}</small>`:''}</span>${on?'<em class="subj-by">Chosen</em>':''}</li>`;}).join('');
   if(form?.kind==='instagram'&&rec('planRecords')!==undefined&&!list)return waitingCarousel(form,STORY_WAIT,'story');
   return (rec('planRecords')===undefined?reading():'')+(list?`<ul class="subj-list">${list}</ul>`:'')+(form?.kind==='instagram'?`<div class="subj-actions">${laidOut(form)?studio(form):''}${igAdvanced(form)}</div>`:links(own(s,form)));
  }
  function toolSlides(s,form,steps=[]){
   const p=planOf(form),fmt=Object.keys(p?.layouts||{})[0]||'carousel',frames=p?.layouts?.[fmt]?.frames||[];
   const strip=frames.length?`<ol class="subj-strip" data-subj-strip="${esc(p.id)}" data-format="${esc(fmt)}">${frames.map((fr,i)=>`<li><div class="subj-frame" data-frame="${i}" data-tall="${fmt==='story'||fmt==='reel'?1:0}"></div><small>${i+1} · <b data-code="${esc(fr.templateId)}">${esc(codeMap?.get?.(fr.templateId)||fr.templateId)}</b></small></li>`).join('')}</ol>`:'';
   const say=p&&p.chosen?`<form class="subj-say" data-subj-sayform><label for="subj-say">Say the codes</label><div><input id="subj-say" data-subj-say value="${esc(st.sayLine)}" placeholder="use C1, 2 and 5" autocomplete="off" spellcheck="false"><button type="submit">Use them</button></div></form>`:'';
   if(rec('planRecords')!==undefined&&!frames.length)return (p?.chosen?'':waitsFor(s,steps))+waitingCarousel(form,p?.chosen?'An assistant lays the slides out from the story you chose.':'The slides wait for a story to be chosen.','slides');
   return (rec('planRecords')===undefined?reading():'')+strip+say+`<div class="subj-actions">${studio(form)}${igAdvanced(form)}</div>`;
  }
  /** An older Outputs carousel: version two's studio shows it read only; changing it is still done in Advanced. */
  function toolOutputSlides(s,form){
   const studioHref=esc(v2.href('slides/:id',{id:outputStudio(form)},{kind:'output',subject:id}));
   return `<div class="subj-actions"><a class="${CP} subj-btn pri" data-subj-outputstudio href="${studioHref}" title="Shows the slides as they are; nothing is changed here">Open the slides${icon('right')}</a><a class="subj-link" data-subj-handoff="slides" href="${handoffHref('arrange',form)}" title="Opens the slides in Advanced, where they are changed">Open in Advanced${icon('chev')}</a></div>`;
  }
  function toolYes(s,form){
   const y=ok(rec('desk'))?rec('desk'):null;
   if(!y)return (rec('desk')===undefined?reading():'')+borrowed('consent','desk')+links(out('desk',form));
   const STATE={'not-asked':'Not asked','asked':'Asked','yes':'Said yes','yes-with-changes':'Said yes, with changes','no':'Said no'};
   const people=(y.people||[]).map(p=>{const state=p.consent?.state||'not-asked',draftable=state==='not-asked'&&!p.request;
    return `<li><div class="subj-person"><span><b>${esc(p.name)}</b><small>${esc((p.appears||[]).join(', '))}</small></span><em class="subj-by" data-state="${esc(state)}">${esc(p.request&&state==='not-asked'?'Request drafted':STATE[state]||state)}</em></div>${draftable?`<form class="subj-draft" data-subj-draftform="${esc(p.id)}"><label for="subj-draft-${esc(p.id)}">Draft the request to ${esc(p.name)}</label><textarea id="subj-draft-${esc(p.id)}" rows="3" data-subj-draft="${esc(p.id)}">${esc(st.drafts[p.id]||'')}</textarea><button type="submit">Save the draft</button></form>`:''}</li>`;}).join('');
   const reasons=(y.release?.reasons||[]).length&&!(y.people||[]).length?`<ul class="subj-list">${y.release.reasons.map(r=>`<li>${mark('todo')}<span>${esc(r)}</span></li>`).join('')}</ul>`:'';
   return borrowed('consent','desk')+(people?`<ul class="subj-people">${people}</ul>`:'')+reasons+links(out('desk',form));
  }
  /** Publish: what it waits for, each with Open, as the sample's two lines (here the steps this form really has). */
  function toolPublish(s,steps,form){
   const need=['yes','check','slides','posttext'].map(id=>steps.find(x=>x.id===id)).filter(Boolean);
   const rows=need.map(t=>{const tv=stepView(t);return `<li>${tv.mark?mark(tv.mark):'<i class="subj-reading" aria-hidden="true"></i>'}<span>${esc(t.name)}</span><button type="button" class="subj-link" data-subj-step="${esc(t.id)}">Open${icon('chev')}</button></li>`;}).join('');
   const posting=['instagram','post'].includes(form?.kind)?`<p class="subj-quiet">Posting is not connected.</p>`:'';
   const reader=/^out:/.test(form?.key||'')&&['article','carousel'].includes(form.kind)?borrowed('audience','audience',form.id):'';
   return (rows?`<ul class="subj-waitl">${rows}</ul>`:'')+posting+reader+links(out('outputs',form),out('audience',form));
  }

  // ---------- the slides, drawn by the app's own renderer ----------
  let codeMap=null,codesAsked=null;
  const codes=()=>codesAsked||=v2.call('instagram.templates',{}).then(r=>{codeMap=new Map((r?.templates||[]).filter(t=>t.code).map(t=>[t.id,t.code]));return codeMap;}).catch(()=>new Map());
  function paintFrames(panel){
   const strip=panel.querySelector('[data-subj-strip]');if(!strip)return;
   const planId=strip.dataset.subjStrip,fmt=strip.dataset.format,revision=planOf(current().form)?.revision||0;
   codes().then(map=>{for(const b of strip.querySelectorAll('[data-code]')){const c=map.get(b.dataset.code);if(c)b.textContent=c;}});
   for(const box of strip.querySelectorAll('[data-frame]')){
    const i=box.dataset.frame,key=[planId,fmt,i,revision].join('|');
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
   // The ways in open the Capture sheet for this subject when the app has one; without it they open Material in Advanced.
   const csb=e.target.closest('[data-cs]');
   if(csb){e.preventDefault();const w=csb.dataset.cs;if(w==='open')openConfirm(csb.dataset.job);else if(w==='cancel')closeConfirm();else if(w==='confirm')doConfirm();else cs.handle(csb);return;}
   const cap=e.target.closest('[data-subj-capture]');
   if(cap&&typeof v2.capture==='function'){e.preventDefault();const f=st.standing?.facts||{};v2.capture({subject:{id,name:st.standing?.title||'',title:st.standing?.title||'',bindingId:f.bindingId||null,projectId:f.projectId||null}});return;}
   const rb=e.target.closest('[data-subj-rec]');
   if(rb){e.preventDefault();if(st.busy)return;const job=rb.dataset.job,action=rb.dataset.subjRec;
    if(action==='use'){
     // Reading the proof (transcript-check.id) holds a writer lock only for the length of that one read and leaves the transcript's mapping in place; recordings.source (Adrian only) then keeps it as a source.
     act(['recordings','tree','brief'],async()=>{let kept;try{const check=await v2.call('transcript-check.id',{id:job});kept=await v2.call('recordings.source',{jobId:job,expected:check.expected});}catch(error){throw new Error(sourceRefusal(error));}await keepWithSubject(kept?.source?.id);v2.ui.say('The transcript is now one of your sources.',{tone:'good'});});return;}
    act(['recordings','tree'],async()=>{await v2.call('.transcription.id.action',{id:job,action});v2.ui.say(action==='start'?'The transcript is being made.':'Trying the transcript again.',{tone:'good'});});return;}
   if(e.target.closest('[data-subj-look]')){e.preventDefault();chooseLook();return;}
   if(e.target.closest('[data-subj-readclose]')){e.preventDefault();const s=st.reader?.sec;st.reader=null;paintNow();secOf(s)?.querySelector('h2')?.focus({preventScroll:true});return;}
   const bw=e.target.closest('[data-subj-borrow]');
   if(bw){e.preventDefault();if(bw.dataset.subjBorrow==='simmer')openSimmer(bw);return;}
   const src=e.target.closest('[data-subj-src]');
   if(src&&!e.target.closest('a,button,input,textarea,select,label')){e.preventDefault();openReader(src.closest('[data-subj-sec]')?.dataset.subjSec,src.dataset.subjSrc,src.dataset.title||'',src.dataset.kind||'');return;}
   const z=e.target.closest('[data-subj-zoom]');
   if(z&&(z.tagName==='BUTTON'||!st.zoom)&&!e.target.closest('a,input,textarea,select,label,[data-subj-embed]')){e.preventDefault();setZoom(st.zoom===z.dataset.subjZoom?null:z.dataset.subjZoom);return;}
   const b=e.target.closest('[data-subj-step]');
   if(b){e.preventDefault();openStep(b.dataset.subjStep,b);return;}
   const f=e.target.closest('[data-subj-form]');
   if(f){chooseFormByKey(f.dataset.subjForm);return;}
   if(e.target.closest('[data-subj-add]')){addForm();return;}
   const sec=e.target.closest('[data-subj-sec]');
   if(sec&&!e.target.closest('a,button,input,textarea,select,label,summary,[data-subj-reader],[data-subj-embed],[data-cs-confirm],[contenteditable]')&&!String(root.getSelection?.()||'')){
    const live=x=>!(x.tagName==='A'&&toAdvanced(x))&&!x.disabled&&!x.matches('[data-subj-zoom],[data-subj-readclose]');
    const row=e.target.closest('li,.subj-sheet,.subj-inset,.subj-one,.subj-frame,.subj-quote');
    const own=row&&sec.contains(row)?[...row.querySelectorAll('a[href],button')].find(live):null;
    const way=own||[...sec.querySelectorAll(':scope>.subj-actions a[href],:scope>.subj-actions button,:scope>.subj-links a[href],:scope>.subj-links button,:scope>*>.subj-actions a[href],:scope>*>.subj-actions button')].find(live);
    if(way&&row){e.preventDefault();way.click();return;}
    if(!st.zoom){e.preventDefault();setZoom(sec.dataset.subjSec);return;}
   }
   if(e.target.closest('[data-subj-dishedit]')){const b=ok(rec('board'))?rec('board'):null,n=b?.forming?.named,d=rec('direction');st.editDish=(typeof n==='string'?n:n?.text)||(ok(d)?adoptedRaw(d.body):'');delete st.last['panel:dish'];paintNow();$('[data-subj-dishtext]')?.focus();}
   if(e.target.closest('[data-subj-dishcancel]')){delete st.editDish;delete st.last['panel:dish'];paintNow();}
  });
  function openStep(sid,from=null){
   const list=!!from?.closest?.('.subj-row');// asked now: painting replaces the row he pressed
   if(st.zoom)setZoom(null);
   st.open=sid;need(sid);remember();paintNow();
   goTo(sid);
   // From the side list, focus stays on the step he pressed. From anywhere else it goes to the section he asked for.
   if(list)$(`.subj-row[data-step="${cssq(sid)}"]>[data-subj-step]`)?.focus({preventScroll:true});
   else secOf(sid)?.querySelector('h2')?.focus({preventScroll:true});
  }
  /** He chose another form: its own next step opens (his act, so it may move the open step). */
  function chooseFormByKey(key){
   const f=(st.standing?.forms||[]).find(x=>x.key===key);if(!f)return;
   st.form=key;st.open=firstOpen(stepsOfForm(st.standing,f),f);if(st.open)need(st.open);remember();paintNow();$(`[data-subj-form="${cssq(key)}"]`)?.focus();
  }
  page.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-subj-src]')){e.preventDefault();e.target.click();return;}if(e.key==='Escape'&&st.reader&&e.target.closest?.('[data-subj-reader]')){e.preventDefault();e.stopPropagation();const s=st.reader.sec;st.reader=null;paintNow();secOf(s)?.querySelector('h2')?.focus({preventScroll:true});return;}if(e.key==='Escape'&&st.zoom&&!(cf.job&&e.target.closest?.('[data-cs-confirm]'))){e.preventDefault();setZoom(null);return;}if(e.key==='Escape'&&cf.job&&cf.state!=='busy'&&e.target.closest?.('[data-cs-confirm]')){e.preventDefault();e.stopPropagation();closeConfirm();}});
  page.addEventListener('input',e=>{const t=e.target;if(t.dataset.csName){cf.names[t.dataset.csName]=t.value;return;}if(t.dataset.subjDraft)st.drafts[t.dataset.subjDraft]=t.value;if(t.matches('[data-subj-say]'))st.sayLine=t.value;if(t.matches('[data-subj-dishtext]'))st.editDish=t.value;});
  page.addEventListener('submit',async e=>{
   const form=e.target;e.preventDefault();if(st.busy)return;
   if(form.matches('[data-subj-draftform]')){
    const personId=form.dataset.subjDraftform,text=(st.drafts[personId]||'').trim();
    if(!text){v2.ui.say('Write the request first.',{tone:'warn'});return;}
    await act(['desk'],async()=>{const y=await v2.call('consent.desk',{parentStudyId:id});await v2.call('consent.people.draft-request',{parentStudyId:id,...v2.expect(y),personId,text});delete st.drafts[personId];v2.ui.say('The request is drafted. Sending it is yours, from the desk.',{tone:'good'});});
   }
   if(form.matches('[data-subj-dishform]')){
    const text=(st.editDish||'').trim();
    if(!text){v2.ui.say('Say the dish first.',{tone:'warn'});return;}
    await act(['board','direction'],async()=>{const b=await v2.call('simmer.board.get',{subject:id});await v2.call('simmer.dish',{subject:id,sentence:text,said:'typed',...v2.expect(b)});delete st.editDish;delete st.last['panel:dish'];v2.ui.say('The dish is kept in your words.',{tone:'good'});});
   }
   if(form.matches('[data-subj-sayform]')){
    const f=current().form,line=(st.sayLine||'').trim();if(f?.kind!=='instagram'||!line)return;
    await act(['planRecords'],async()=>{const p=await v2.call('instagram.plan.get',{id:f.id});const r=await v2.call('instagram.plan.codes',{id:f.id,...v2.expect(p),say:line,format:Object.keys(p.layouts||{})[0]||'carousel'});st.sayLine='';v2.ui.say(typeof r?.summary==='string'?r.summary:'The slides follow the codes.',{tone:'good'});});
   }
  });
  /** Do something, then ask again what it touched (the reads named, and the standing). */
  /** A kept transcript becomes one of this subject's sources the way the workspace does it: attached to the subject. Asking again
      for one already attached changes nothing, so pressing twice never makes two. */
  async function keepWithSubject(sourceId){
   const f=st.standing?.facts||{};if(!sourceId)return;
   const tries=[];
   if(f.bindingId)tries.push(()=>v2.call('study.material.attach',{bindingId:f.bindingId,parentStudyId:id,sourceIds:[sourceId]}));
   if(!f.bindingId&&f.projectId)tries.push(()=>v2.call('first-flow.attach',{projectId:f.projectId,sourceIds:[sourceId]}));
   if(!tries.length)throw new Error('The transcript is kept, but this subject has no place of its own yet to hold it.');
   let failed=false;for(const attempt of tries){try{await attempt();return;}catch(error){failed=true;}}
   if(failed)throw new Error('The transcript was kept as a source, but it could not be added to this subject. Press Use the transcript again to try again.');
  }
  async function act(keys,run){st.busy=true;page.setAttribute('aria-busy','true');try{await run();cs.reset();for(const k of keys)if(st.rec[k]!==undefined)ask(k,true);await refresh();}catch(error){v2.ui.say(error?.message||'That could not be done. Nothing was changed.',{tone:'bad'});}finally{st.busy=false;page.removeAttribute('aria-busy');}}

  function addForm(){
   const kinds=addable(st.standing.facts,st.standing.forms);
   const body=`<p class="subj-quiet">Each form brings its own steps and your template for it.</p><div class="subj-kinds">${kinds.map(k=>`<button type="button" data-subj-make="${k.kind}"${k.ready?'':` disabled aria-describedby="subj-why-${k.kind}"`}><b>${esc(k.name)}</b>${k.to?`<small>for ${esc(k.to)}</small>`:''}<span>${esc(k.what)}</span>${k.unbuilt?'':`<em>Needs: ${esc(k.needs)}</em>`}${k.ready?'':`<em class="why" id="subj-why-${k.kind}">${esc(k.why)}</em>`}</button>`).join('')}</div>`;
   const sheet=v2.ui.sheet({title:'What else will this be?',body});sheet.el.classList.add('subj-sheetdlg');
   sheet.body.addEventListener('click',async e=>{const b=e.target.closest('[data-subj-make]');if(!b||b.disabled)return;b.disabled=true;
    try{
     if(b.dataset.subjMake==='article'&&!(st.standing.facts?.words?.paragraphs>0)){sheet.close();v2.go('write/:id',{id},{start:'article'});return;}// no words yet: Write starts it
     const key=await make(b.dataset.subjMake);sheet.close();
     // Say "added" only when the command, asked again, shows it. A refusal threw above and says its own words.
     let shown=false;
     for(let i=0;i<3&&!shown;i++){if(i)await new Promise(r=>setTimeout(r,500));await refresh();shown=!!st.standing?.forms?.some(f=>f.key===key);}
     if(shown){st.form=key;st.open=null;remember();paintNow();v2.ui.say(KINDS[b.dataset.subjMake].name+' added.',{tone:'good'});}
     else v2.ui.say('It was made, but the records do not show it here yet. Reload to see it.',{tone:'warn'});
    }
    catch(error){b.disabled=false;v2.ui.say(error?.message||'It could not be added. Nothing was changed.',{tone:'bad'});}});
  }
  async function make(kind){
   const f=ids();
   if(kind==='carousel'){
    const [tree,brief,plans]=await Promise.all(['tree','brief','planRecords'].map(k=>ask(k,true)));
    const items=materialFrom({tree,brief,planRecords:Array.isArray(plans)?plans:[]},f.projectId).items;
    const transcripts=items.filter(x=>(x.kind==='recordings'||x.kind==='notes')&&x.hash).map(x=>({sourceId:x.id,sourceHash:x.hash})),photos=items.filter(x=>x.kind==='photos').map(x=>({sourceId:x.id,...(x.title&&x.title!=='Untitled'?{caption:x.title.slice(0,200)}:{})}));
    if(!transcripts.length)throw new v2.Error('Add a recording or a note first.');
    const plan=await v2.call('instagram.plan.post',{subject:id,title:st.standing.title,material:{transcripts,photos}});return 'ig:'+plan.id;
   }
   const scope={rootBindingId:f.bindingId,parentStudyId:id};
   const [native,outs]=await Promise.all([v2.call('study-draft.read',{bindingId:f.bindingId,parentStudyId:id}),v2.call('study.outputs',scope)]);
   const r=await v2.call('study.outputs.create',{...scope,kind,sourceBindingId:f.bindingId,expectedNative:native.expected,expectedOutput:outs.expectedOutput});
   return 'out:'+(r?.view?.output?.id||r?.receipt?.operationId);
  }

  // First paint comes from the one command; the look's name and his direction sentence follow, each from one read.
  call('looks',{}).then(r=>{if(!ok(r)||ctx.signal.aborted)return;st.looks=r.looks||[];st.look=new Map(st.looks.map(l=>[l.id,l.name]));paintNow();});
  ask('direction');ask('board');
  return refresh();
 }

 v2.screen({id:'subject',title:'Subject',route:'subject/:id',render,mount});
 try{if(!v2.shared)v2.shared={};}catch{}
 try{if(v2.shared&&typeof v2.shared==='object')v2.shared.subject=Object.freeze({gather,createCaptureSources,...pure});}catch{}
 root.V2Subject=Object.freeze({gather,...pure});
})(typeof window!=='undefined'?window:globalThis);
