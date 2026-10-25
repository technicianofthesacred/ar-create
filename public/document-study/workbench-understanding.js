/* Disposable Understanding projection. Maintained records and human-direction editor own all words. */
(()=>{
 if(window.workbenchUnderstanding)return;
 const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
 const key=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function protectionScope(project,selected,binding){
  // A carousel has its own words. An old Article binding is never its owner.
  if(selected?.output?.kind==='carousel'||selected?.owner?.parentStudyId&&selected.owner.parentStudyId!==project.id)return null;
  const writing=[5,6,7].includes(Number(project.viewedStage))||project.view==='article';
  if(writing&&binding?.parentStudyId===project.id&&UUID.test(binding.id||'')){
   if(selected?.output&&selected.output.kind!=='article')return null;
   if(selected?.owner&&(selected.owner.kind!=='native'||selected.owner.bindingId!==binding.id))return null;
   return {bindingId:binding.id,parentStudyId:project.id};
  }
  const owner=selected?.owner;
  if(selected?.projectId===project.id&&selected.output?.kind==='article'&&owner?.kind==='native'&&UUID.test(owner.bindingId||'')&&(!owner.parentStudyId||owner.parentStudyId===project.id))return {bindingId:owner.bindingId,parentStudyId:project.id};
  return null;
 }
 function validateProtections(value,scope){
  const sameBinding=b=>key(b)===key(scope);
  if(value?.schema!=='ar-create.study-mcp-proposal-contracts.v1'||value.role!=='explicit-human-proposal-intent-not-evidence-or-manuscript'||!sameBinding(value.binding)||!HASH.test(value.hash||'')||!Array.isArray(value.protections)||!Array.isArray(value.rejections)||!Array.isArray(value.events))throw Error('The saved protections could not be confirmed for this manuscript.');
  const ids=new Set();
  for(const row of value.protections){
   if(!row||!sameBinding(row.binding)||!UUID.test(row.id||'')||ids.has(row.id)||row.role!=='human-selected-exact-native-wording'||row.author!=='human'||row.selectedFrom!=='saved-native-DEV'||typeof row.paragraphId!=='string'||!row.paragraphId||typeof row.text!=='string'||!row.text||typeof row.active!=='boolean'||!(row.reason===null||typeof row.reason==='string'&&row.reason.length<=4000)||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt)))throw Error('A saved protection does not match this manuscript or could not be read.');
   ids.add(row.id);
  }
  return value.protections.filter(row=>row.active);
 }
 function context(options){
  const p=typeof current==='function'?current():null;if(!p||p.id!==options.projectId)throw Error('The selected project changed.');
  const selected=window.studyOutputConnection?.selection?.(),binding=window.studyDraft?.currentBinding?.(),native=[5,6,7].includes(Number(p.viewedStage))?binding:null;
  if(native?.parentStudyId&&native.parentStudyId!==p.id)throw Error('The writing scope belongs to another project.');
  if(selected&&selected.projectId!==p.id)throw Error('The selected output scope is unavailable.');
  const nativeOutput=native?.parentStudyId===p.id?native.canonicalOutputId:null;
  if(nativeOutput&&selected?.output?.id&&nativeOutput!==selected.output.id)throw Error('The writing and selected output scopes do not agree.');
  const outputId=options.outputId||nativeOutput||selected?.output?.id||null;
  const nativeRoot=nativeOutput?(native.sourceBindingId||(selected?.output?.id===nativeOutput?selected.rootBindingId:native.id)):null;
  if(native?.sourceBindingId&&selected?.output?.id===nativeOutput&&selected.rootBindingId!==native.sourceBindingId)throw Error('The writing and selected root scopes do not agree.');
  const rootBindingId=options.rootBindingId||nativeRoot||selected?.rootBindingId||null;
  if((options.outputId&&options.outputId!==(nativeOutput||selected?.output?.id))||(options.rootBindingId&&options.rootBindingId!==(nativeRoot||selected?.rootBindingId)))throw Error('The requested output scope changed.');
  if((outputId&&!UUID.test(outputId))||(outputId&&!UUID.test(rootBindingId||''))||(!outputId&&options.rootBindingId))throw Error('Choose one exact output and root scope.');
  const scopes=[{scope:'project',parentStudyId:p.id}];
  if(outputId)scopes.push({scope:'output',parentStudyId:p.id,bindingId:rootBindingId,outputId});
  const wordingBinding=protectionScope(p,selected,binding);
  return {project:p,wordingBinding,signature:key({id:p.id,outputId,rootBindingId,wordingBinding}),request:{scopes,selectedScope:scopes.at(-1),...(outputId?{piece:{parentStudyId:p.id,rootBindingId,selectedOutputId:outputId}}:{})}};
 }
 function validate(value,request){
  if(value?.schema!=='ar-create.current-understanding.projection.v1'||!HASH.test(value.fingerprint||'')||value.readConsistency?.status!=='stable-reread'||!['current','empty','missing','unavailable'].includes(value.status)||key(value.selection?.scope)!==key(request.selectedScope)||!Array.isArray(value.records)||value.records.length!==request.scopes.length)throw Error('The current understanding scope is unavailable or changed.');
  const seen=new Set();for(const record of value.records){const id=key(record.selector);if(seen.has(id)||!request.scopes.some(s=>key(s)===id))throw Error('The current understanding returned an ambiguous or foreign scope.');seen.add(id);}
  if(request.piece){const piece=value.piece;if(piece?.status!=='current'||piece.scope?.parentStudyId!==request.piece.parentStudyId||piece.scope.rootBindingId!==request.piece.rootBindingId||piece.scope.outputId!==request.piece.selectedOutputId)throw Error('This output’s current understanding is unavailable.');}
  return value;
 }
 function mount(host,options={}){
  if(!host?.isConnected)throw Error('Open the Understanding drawer before mounting it.');
  const root=node('section');root.className='wbu-understanding';root.style.minWidth='0';root.setAttribute('aria-label','Current understanding and direction');host.append(root);
  const projectionHost=node('div'),editorHost=node('div'),protectedDetails=node('details'),protectedSummary=node('summary','Protected phrases'),protectedBody=node('div');
  protectedDetails.dataset.understanding='protected';protectedDetails.style.marginBottom='8px';protectedDetails.append(protectedSummary,protectedBody);root.append(projectionHost,protectedDetails,editorHost);
  let disposed=false,invalidated=false,epoch=0,abort=null,captured=null,borrowed=null,ownedContext=false,contractsAbort=null,contractsEpoch=0;

  function endEditor(){if(borrowed){const {element,placeholder,parent}=borrowed;if(placeholder.isConnected)placeholder.replaceWith(element);else parent.append(element);borrowed=null;}if(ownedContext){ownedContext=false;window.studyHumanDirection?.closeContext?.();}editorHost.replaceChildren();}
  function currentScope(){return context(options);}
  function active(token){if(disposed||invalidated||token!==epoch||!root.isConnected)return false;try{return currentScope().signature===captured?.signature;}catch{return false;}}
  function section(id,title){const el=node('section');el.dataset.understanding=id;el.style.marginBottom='16px';const heading=node('h3',title);heading.style.font='600 var(--t-head,15px)/1.5 var(--ar-ui,sans-serif)';heading.style.margin='0 0 6px';el.append(heading);projectionHost.append(el);return el;}
  // Keep the independent reader mounted when the main projection is pending
  // or unavailable; successful rendering places this same node in C's order.
  function retainProtectionSection(){if(protectedDetails.parentElement!==root)projectionHost.after(protectedDetails);}
  function unavailable(message){retainProtectionSection();projectionHost.replaceChildren();const p=node('p','Unavailable · '+message);p.setAttribute('role','status');projectionHost.append(p);}
  function protectionStatus(state,message){protectedSummary.textContent='Protected phrases'+(state?' · '+state:'');protectedBody.replaceChildren(node('p',message));}
  async function refreshProtections(token=epoch){
   const ticket=++contractsEpoch;contractsAbort?.abort();const requestAbort=new AbortController();contractsAbort=requestAbort;
   const scope=captured?.wordingBinding;
   if(!scope){protectionStatus('Not connected','Protected phrases are not connected for this writing view.');return;}
   protectionStatus('Reading…','Reading saved protected phrases…');
   try{
    const query=new URLSearchParams(scope),response=await fetch('/api/study-ai/contracts?'+query,{method:'GET',cache:'no-store',signal:requestAbort.signal}),value=await response.json();
    if(!active(token)||ticket!==contractsEpoch){requestAbort.abort();return;}
    if(!response.ok)throw Error(value.error||'Protected phrases could not be read.');
    const rows=validateProtections(value,scope);protectedSummary.textContent='Protected phrases · '+rows.length;
    protectedBody.replaceChildren(node('p','Saved rules for assistant proposals. Current wording may have changed.'));
    if(!rows.length)protectedBody.append(node('p','No active protected phrases for this manuscript part.'));
    for(const row of rows){const entry=node('section');entry.className='wbu-protection';const words=node('p',row.text);words.style.whiteSpace='pre-wrap';words.style.overflowWrap='anywhere';entry.append(words);if(row.reason)entry.append(node('small',row.reason));protectedBody.append(entry);}
   }catch(error){if(!disposed&&ticket===contractsEpoch&&active(token))protectionStatus('Unavailable','Unavailable · '+error.message);else requestAbort.abort();}
  }
  function scopeLabel(record){return record.selector.scope==='project'?'Whole project':record.selector.scope==='output'?'This output':record.selector.scope==='part'?'This manuscript part':'This collection';}
  function entry(parent,record,label,text){const row=node('div');row.className='wbu-entry';row.append(node('small',scopeLabel(record)+(record.applicability==='inherited-direction'?' · inherited direction':record.applicability==='separate-scope'?' · separate scope':'')+' · '+label));const body=node('p',text);body.style.whiteSpace='pre-wrap';body.style.overflowWrap='anywhere';row.append(body);parent.append(row);}
  function render(value){
   projectionHost.replaceChildren(node('small',captured.request.piece?'This output · whole-project context shown separately':'Whole project'));
   const current=section('current','Current understanding'),thoughts=section('thoughts','Your thoughts — Adrian'),decisions=section('decisions','Decisions');
   const usable=value.records.filter(r=>['current','empty'].includes(r.status));
   const bad=value.records.filter(r=>!['current','empty'].includes(r.status));
   for(const record of usable){
    const c=record.contributions||{};
    if(c.status==='owner-projected'){
     if(c.personalThoughts)entry(thoughts,record,'Your saved words',c.personalThoughts);
     if(c.agentProposed)entry(current,record,'AI interpretation · provisional',c.agentProposed);
     if(c.unadoptedSuggestions)entry(current,record,'Suggestions · unadopted',c.unadoptedSuggestions);
     if(c.unclassified)entry(current,record,'Shared notes · attribution unclassified',c.unclassified);
    }else if(c.status==='unknown'&&record.body)entry(current,record,'Shared notes · attribution unavailable',record.body);
    if(c.adoptedDirection)entry(decisions,record,'Saved human direction',c.adoptedDirection);
   }
   if(!current.querySelector('.wbu-entry'))current.append(node('p',bad.length?'Unavailable · Some saved understanding could not be read.':'No separate understanding saved for this scope.'));
   if(!thoughts.querySelector('.wbu-entry'))thoughts.append(node('p',bad.length?'Unavailable · Saved thoughts could not be read.':'No saved thoughts for this scope.'));
   if(!decisions.querySelector('.wbu-entry'))decisions.append(node('p',bad.length?'Unavailable · Saved direction could not be read.':'No saved decisions or explicit direction for this scope.'));
   if(decisions.querySelector('.wbu-entry'))decisions.append(node('small','These are saved instructions; individual decision events are not connected.'));
   if(value.assistance?.scopeResolution==='unresolved-overlap')current.append(node('p','Direction overlaps across scopes. No automatic precedence has been chosen.'));
   projectionHost.append(protectedDetails);
   for(const [id,title,copy]of [['corrections','Corrections','Not connected · Dated Source corrections are not connected to this drawer.'],['rejected','Rejected angles','Not connected · A scoped rejected-angle record is unavailable here.']]){const details=node('details');details.dataset.understanding=id;details.style.marginBottom='8px';details.append(node('summary',title+' · Not connected'),node('p',copy));projectionHost.append(details);}
   const history=node('details');history.dataset.understanding='history';history.append(node('summary','Saved direction history'));projectionHost.append(history);
   for(const record of usable)if(record.history?.length)history.append(node('p',scopeLabel(record)+' · '+record.history.length+' earlier saved changes. Use the existing notes editor for saved Undo.'));
   if(!history.querySelector('p'))history.append(node('p',bad.length?'Unavailable · History could not be read.':'No earlier saved direction changes for this scope.'));
   const button=node('button','Edit shared notes');button.type='button';button.dataset.understandingEdit='';button.onclick=()=>{
    if(!active(epoch))return;
    if(borrowed||ownedContext){editorHost.querySelector('[data-human-direction]')?.focus();return;}
    const existing=document.getElementById('material-human-direction');
    if(existing){if(existing.dataset.directionProjectKey!==options.projectId){unavailable('The notes editor belongs to another project.');return;}const placeholder=document.createComment('Existing human direction editor');existing.before(placeholder);borrowed={element:existing,placeholder,parent:existing.parentElement};editorHost.append(node('p','Shared notes · existing editor and save controls'),existing);}
    else if(window.studyHumanDirection?.openContext){editorHost.append(node('p','Shared notes · whole project. Thoughts, proposals and references retain their existing labels.'));const slot=node('div');editorHost.append(slot);try{window.studyHumanDirection.openContext({container:slot,project:captured.project});ownedContext=true;}catch(error){slot.textContent=error.message;}}
    else editorHost.append(node('p','Not connected · The existing notes editor is unavailable.'));
    const details=editorHost.querySelector('[data-direction-editor]');if(details)details.open=true;editorHost.querySelector('[data-human-direction]')?.focus();
   };thoughts.append(button);
  }
  async function refresh(){
   const token=++epoch;abort?.abort();contractsAbort?.abort();const requestAbort=new AbortController();abort=requestAbort;let protectionRead=Promise.resolve();
   try{captured=currentScope();invalidated=false;retainProtectionSection();projectionHost.replaceChildren(node('p','Reading saved understanding…'));const pending=fetch('/api/work-continuity/understanding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request:captured.request}),signal:requestAbort.signal});protectionRead=refreshProtections(token);const response=await pending,value=await response.json();if(!active(token)){requestAbort.abort();return;}if(!response.ok)throw Error(value.error||'The saved understanding could not be read.');render(validate(value,captured.request));}
   catch(error){if(!disposed&&token===epoch&&root.isConnected){if(captured&&!active(token)){requestAbort.abort();return;}unavailable(error.message);}}
   await protectionRead;
  }
  function changed(){if(disposed||invalidated||!captured)return;if(!active(epoch)){invalidated=true;abort?.abort();contractsAbort?.abort();contractsEpoch++;endEditor();unavailable('The selected project or output changed. Reopen Understanding for this work.');protectionStatus('Unavailable','The selected writing changed. Reopen Understanding for this work.');}}
  const observer=new MutationObserver(changed);observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  const events=['study-output-selection','study-draft-change'];for(const event of events)window.addEventListener(event,changed);
  const saved=event=>{if(event.detail?.parentStudyId===options.projectId&&active(epoch))void refresh();};window.addEventListener('study-human-direction-change',saved);
  const wordingChanged=event=>{if(active(epoch)&&captured?.wordingBinding&&key(event.detail)===key(captured.wordingBinding))void refreshProtections();};window.addEventListener('study-wording-contract-change',wordingChanged);
  function cleanup(){if(disposed)return;disposed=true;epoch++;abort?.abort();contractsAbort?.abort();contractsEpoch++;window.removeEventListener('study-wording-contract-change',wordingChanged);observer.disconnect();for(const event of events)window.removeEventListener(event,changed);window.removeEventListener('study-human-direction-change',saved);endEditor();root.remove();}
  protectionStatus('Not connected','Protected phrases are not connected for this writing view.');
  const ready=refresh();return {ready,refresh,cleanup};
 }
 window.workbenchUnderstanding={mount};
})();
