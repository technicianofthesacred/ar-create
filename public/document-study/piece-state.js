/* One piece state. Every state word in the sidebar, every empty state, the bar's one primary action and the save status
   read this one object, so no layer computes its own status from its own store and the screens stop contradicting each
   other (review F-08). It only reads: saved draft proof and binding (draft-flow), the output register (output-connection),
   the saved check receipt (draft-check-flow), the piece record, and the owners' own controls for the step on screen.
   Nothing here saves, creates, approves or sends; a primary action presses the owner's real control or opens a step. */
(()=>{
 if(window.c3PieceState)return;
 const NAMES=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
 const TTL=30000,cache=new Map(),mediaSeen=new Map();let loading=null;
 const text=html=>{const d=document.createElement('div');d.innerHTML=html||'';return (d.textContent||'').trim();};
 const ws=sel=>document.querySelector('#app .workspace '+sel);
 const visible=n=>!!n&&n.isConnected&&!n.hidden&&!n.closest('[hidden]')&&!n.closest('[data-wn-consolidated]');
 const stage=()=>{const p=current();return p.view==='record'?Number(p.viewedStage)||0:p.view==='article'?5:0;};
 // ---------- the output register: one read per piece, shared by every reader of this object
 function outputs(id){const nav=window.workspaceNavigation?.outputs?.(id);if(Array.isArray(nav))return nav;const hit=cache.get(id);return hit&&Date.now()-hit.at<TTL?hit.outputs:hit?.outputs??null;}
 function load(id=current().id){
  if(loading||typeof window.realOutputOverview?.read!=='function')return loading;
  const hit=cache.get(id);if(hit&&Date.now()-hit.at<TTL)return null;
  loading=(async()=>{try{const data=await window.realOutputOverview.read({projectId:id});if(data?.projectId===id)cache.set(id,{at:Date.now(),outputs:Array.isArray(data.outputs)?data.outputs:[]});}catch{cache.set(id,{at:Date.now(),outputs:hit?.outputs??null,error:true});}})().finally(()=>{loading=null;window.dispatchEvent(new Event('c3-piece-state'));});
  return loading;
 }
 for(const name of ['study-output-selection','study-draft-change'])window.addEventListener(name,()=>{cache.delete(current()?.id);});
 // ---------- the save owner's own words, never re-derived
 function saveText(){const s=document.querySelector('#app .workspace>.workbar .saved')||document.querySelector('#app .workspace>.topbar .status');return s?(s.textContent||'').replace(/\s+/g,' ').trim():'';}
 function save(m){
  const t=saveText();
  if(m.dirty)return {word:'Unsaved',tone:'warn',text:t&&/unsaved|pending|saving|conflict|fail|not saved|could not|newer version|held by/i.test(t)?t:'Unsaved changes'};
  if(/fail|conflict|unavailable|not saved|could not/i.test(t))return {word:'Not saved',tone:'bad',text:t};
  if(/saving|pending/i.test(t))return {word:'Saving',tone:'warn',text:t};
  if(m.bound)return {word:'Saved',tone:'ok',text:/^saved/i.test(t)?t:'Saved to the project'};
  if(m.words)return {word:'Only in this browser',tone:'warn',text:t||'These words are kept only in this browser until the piece has its project file.'};
  return {word:'',tone:'ok',text:''};
 }
 function read(){
  const p=current(),proof=window.studyDraft?.currentProof?.()||null,binding=window.studyDraft?.currentBinding?.()||null;
  const words=(p.blocks||[]).some(b=>text(b.html));
  const list=outputs(p.id);
  const figures=(p.blocks||[]).filter(b=>b.tag==='figure').length;
  const visual=(list||[]).filter(o=>!['Article','Post','Product listing'].includes(o.format)).length;
  const record=[p.step,p.status].filter(Boolean).join(' · ');
  const published=/publish/i.test(record)?{label:'Published outside AR Create',record}:null;
  const manuscript={bound:!!binding,title:binding?.title||p.title||p.name,words,dirty:!!proof?.dirty,revision:proof?proof.sequence||0:p.rev||0,local:!binding&&words};
  const check=window.studyDraftCheck?.state?.()||null;
  const waiting=(list||[]).filter(o=>['review-needed','correction-needed'].includes(o.status));
  // Text-only: no photographs in the words and no output that needs a visual layout. Unknown outputs never count as text-only.
  const textOnly=list===null?null:figures===0&&visual===0&&!(mediaSeen.get(p.id)>0);
  return {projectId:p.id,name:p.name,step:stage(),manuscript,save:save(manuscript),outputs:list,waiting,published,check,media:{figures},textOnly,loading:list===null};
 }
 // ---------- what is on screen for the step being viewed, read from the owners' controls in one place
 function control(sel){const n=ws(sel);return n&&(visible(n)||n.closest('details'))?n:null;}
 function probe(n){
  const s={};
  if(n===1){const c=ws('.material-surface.sws-material .mrb-count');s.count=c?parseInt(c.textContent,10)||0:ws('.material-surface.sws-material .mrb-item')?1:null;if(s.count===0&&ws('.material-surface.sws-material .mrb-item'))s.count=1;}
  if(n===2){const host=ws('.material-surface.sws-source');s.count=host?host.querySelectorAll('.material-record').length:null;}
  if(n===3)s.count=ws('#stage-working-lane')?document.querySelectorAll('#app .workspace :is([data-research-point],.research-standard-row)').length:null;
  if(n===4){const save=control('[data-direction-save]'),typed=[...document.querySelectorAll('#app .workspace :is(textarea,input[type=text])')].some(t=>visible(t)&&t.value.trim()&&t.value!==t.defaultValue);s.dirty=!!save&&!save.disabled&&typed;s.count=document.querySelectorAll('#app .workspace .flow-directions button').length;s.saved=!!(document.getElementById('downstream-human-direction')?.textContent.trim());}
  if(n===8){s.count=/No photos added yet/i.test(ws('#owned-photo-stage')?.textContent||'')?0:ws('#owned-photo-stage [data-asset],#owned-photo-stage figure,#owned-photo-stage img')?1:null;if(s.count!==null)mediaSeen.set(current().id,s.count);}
  if(n===9)s.empty=!!ws('#study-output-canvas .oo-empty');
  if(n===10)s.empty=/No connected audience preview/i.test(ws('[data-oss-reader]')?.textContent||'');
  if(n===11){const m=ws('[data-share-field="message"],[data-oss-field="message"]');s.message=m?m.value.trim():null;}
  return s;
 }
 // ---------- one primary action per step (review Track C, C1). Every label here is the only filled button on screen.
 const go=n=>({label:'Next: '+NAMES[n-1],phase:n});
 const press=(label,sel,why)=>{const n=control(sel);return n?{label,press:sel,disabled:!!n.disabled,reason:n.disabled?(n.title||why||''):''}:null;};
 const OPEN_DRAFT='Open the draft';
 function primary(n=stage(),st=read()){
  // An assistant's open question about this piece is the one thing to do here until it is answered (review C3).
  const asked=window.arLive?.question?.(n);if(asked)return asked;
  const m=st.manuscript,q=probe(n);
  switch(n){
   case 1:return q.count>0&&(m.words||m.bound)?go(2):press('Add files','[data-flow-action="files"]')||(q.count>0?go(2):{label:'Add files',disabled:true,reason:'Adding files is not available for this piece yet.'});
   case 2:return q.count===0?{label:'Add a recording',phase:1,reason:'Recordings and transcripts are added in Material.'}:go(3);
   case 3:if(q.count===0||q.count===null){const r=press('Research these sources','[data-flow-action="analyze"]','Add a source in Material first.');return r||{label:'Research these sources',disabled:true,reason:'Add a source in Material first.'};}return go(4);
   case 4:if(q.dirty)return press('Save direction','[data-direction-save]');if(!q.saved&&!q.count)return press('Write my own angle','[data-dwt-action="angle"]')||{label:OPEN_DRAFT,phase:5};return {label:OPEN_DRAFT,phase:5};
   case 5:{if(!m.words&&!m.bound)return {label:'Start writing',focus:'#manuscript'};if(m.dirty)return {label:'Save',save:true};const ask=[...document.querySelectorAll('#app .workspace [onclick]')].find(b=>/openInstruction\(\)/.test(b.getAttribute('onclick')||''));return ask?{label:'Ask about words',press:'[onclick^="openInstruction"]',disabled:ask.disabled}:go(6);}
   case 6:return !m.words&&!m.bound?{label:'Write first',phase:5}:go(7);
   case 7:{if(!m.bound){const load=press('Load saved part','[data-current-check="open-part"]');if(load&&!load.disabled)return load;return {label:'Save a draft first',disabled:true,reason:st.published?'This piece was published outside AR Create; there is no saved working draft here to check.':m.local?'These words are only in this browser. Save them to the project in Write, then check them.':'There is no saved working draft for this piece yet.'};}
    if(m.dirty)return {label:'Run checks',disabled:true,reason:'Save or resolve your edits in Write first; checks run on the saved revision.'};
    const c=st.check;if(c&&c.current&&c.findings)return {label:`Resolve ${c.findings} finding${c.findings===1?'':'s'}`,press:'[data-current-issue]'};if(c&&c.current&&c.complete)return go(8);
    return press('Run checks','[data-current-check="run"]')||{label:'Run checks',disabled:true,reason:'Checks are not available for this draft.'};}
   case 8:return q.count===0?press('Add media','.study-photos [data-add]')||{label:'Add media',phase:1,reason:'Photos are added in Material.'}:q.count?{label:'Place in Arrange',phase:9}:press('Add media','.study-photos [data-add]')||go(9);
   case 9:if(st.textOnly)return go(10);if(!m.words&&!m.bound)return {label:'Write first',phase:5};if(q.empty)return {label:'Make an output',phase:12};return press('Audience view','[data-oss-action="look"]')||go(10);
   case 10:if(st.outputs&&!st.outputs.length)return {label:'Make an output',phase:12};return press('Export','[data-output-action="export"]')||(q.empty?{label:'Make an output',phase:12}:go(11));
   case 11:if(notApplicable(11,st))return {label:'Open Outputs',phase:12};if(q.message)return press('Save invitation','[data-share-action="save"]')||press('Copy message','[data-oss-action="copy"]')||{label:'Open Outputs',phase:12};return {label:'Write invitation',focus:'[data-share-field="message"],[data-oss-field="message"]'};
   case 12:{const list=st.outputs||[];if(!list.length)return {label:'New output',menu:true};const o=window.workspaceNavigation?.selectedOutput?.()||list[0];return {label:'Continue '+(o.title||o.format||'output'),output:o.id};}
  }
  return null;
 }
 async function run(action){
  if(!action||action.disabled)return;
  if(action.ask)return window.arLive?.showAsk?.(action.ask);
  if(action.phase)return window.viewPhase(action.phase);
  if(action.press){const n=ws(action.press);if(n&&!n.disabled){if(n.closest('[data-c3-empty-hidden]'))window.c3Empty?.reveal?.();const d=n.closest('details');if(d&&!d.open)d.open=true;n.click();if(n.matches('[data-current-issue]'))n.scrollIntoView?.({block:'center'});}return;}
  if(action.save){const save=window.studyOutputConnection?.flush||window.studyDraft?.flush;return save?.();}
  if(action.focus){const n=document.querySelector('#app .workspace :is('+action.focus+')')||document.querySelector(action.focus);n?.focus?.();n?.scrollIntoView?.({block:'center'});return;}
  if(action.menu){if(stage()!==12)await window.viewPhase(12);return window.surfaceBar?.openMore?.('New output');} // the kinds of output are in More
  if(action.output){const id=current().id;await window.realOutputOverview?.onAction?.({projectId:id,outputId:action.output,kind:'native'});return window.viewPhase(5);}
 }
 // ---------- one state word per step for the sidebar (review C5): only words this object can stand behind
 function notApplicable(n,st=read()){
  if(n===9&&st.textOnly)return 'This piece is words only: no photographs and no visual output to lay out.';
  if(n===11&&st.textOnly&&!st.waiting.length&&probe(2).count!==1&&!(st.outputs||[]).some(o=>o.format==='Carousel'))return 'This piece is words only and has no one recorded in it to invite. Share is here if you want it.';
  return '';
 }
 function word(n,st=read()){
  if(notApplicable(n,st))return {word:'n/a',title:notApplicable(n,st)};
  const waiting=st.waiting.filter(o=>({native:5,arrange:9,review:10})[o.nextAction?.kind]===n||(!o.nextAction&&({'correction-needed':5,'review-needed':10})[o.status]===n));
  if(waiting.length)return {word:'needs you',title:`${waiting.length} output${waiting.length===1?'':'s'} wait${waiting.length===1?'s':''} on you here`};
  const m=st.manuscript;
  if(n===5)return m.dirty?{word:'unsaved',title:'Unsaved changes in the draft'}:m.bound?{word:'saved',title:'The draft is saved to the project'}:m.words?{word:'browser only',title:'These words are only in this browser'}:{word:'empty',title:'No words yet'};
  if(n===6)return m.words||m.bound?{word:'',title:''}:{word:'empty',title:'Nothing to read yet'};
  if(n===7){const c=st.check;if(!m.bound)return {word:'',title:''};if(c?.current&&c.findings)return {word:'needs you',title:`${c.findings} finding${c.findings===1?'':'s'} to resolve`};if(c?.current&&c.complete)return {word:'checked',title:'Checks cover the current saved revision'};return {word:'',title:''};}
  if(n===12&&st.outputs)return st.outputs.length?{word:String(st.outputs.length),title:`${st.outputs.length} output${st.outputs.length===1?'':'s'}`}:{word:'none',title:'No outputs made yet'};
  if(n===stage()){const q=probe(n);if(q.count===0||q.empty===true)return {word:'empty',title:'Nothing here yet'};}
  return {word:'',title:''};
 }
 // Why a step's surface cannot be edited, in words; never a bare "Read-only".
 function readOnlyReason(n=stage(),st=read()){
  const p=current();if(n===5&&p.view==='article')return '';
  if(n===5||n===6||n===7)return p.view==='record'?'Retained record · read-only':'Reading view · open the draft to edit';
  return '';
 }
 window.c3PieceState={read,primary:n=>primary(n),run,word,notApplicable,readOnlyReason,load,stage,names:NAMES};
})();
