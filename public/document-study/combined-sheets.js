/* Context sheets borrow maintained owners without navigating or replacing the piece. */
(()=>{
 if(window.combinedSheets)return;
 const names={source:'Source',research:'Research',media:'Media',arrange:'Arrange'},stages={source:2,research:3,media:8,arrange:9},owners=new Map();
 let active=null,lastReturn=null,lastSelection=null,lastFieldSelection=null;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function context(){
  const project=typeof current==='function'?current():null;if(!project?.id)throw Error('Choose the current piece first.');
  const visible=element=>{if(!element?.isConnected||element.closest('[hidden],[aria-hidden="true"]'))return false;for(let node=element;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden')return false;}return true;};
  const article=document.getElementById('manuscript'),carousel=document.querySelector('#study-output-canvas .car-writing-page'),isArticle=visible(article),isCarousel=visible(carousel),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),word=value=>typeof value==='string'&&!!value;
  if(isArticle===isCarousel)throw Error(isArticle?'The visible piece owner is ambiguous.':'Open this piece’s writing first.');
  if(isCarousel){
   const selection=window.studyOutputConnection?.selection?.(),canvas=window.studyOutputConnection?.canvasProof?.(),owner=selection?.owner,proof=canvas?.writingProof;
   if(selection?.projectId!==project.id||selection.output?.kind!=='carousel'||!word(selection.rootBindingId)||!word(selection.output.id)||owner?.kind!=='carousel-words'||owner.outputId!==selection.output.id||canvas?.scope?.parentStudyId!==project.id||canvas.scope.rootBindingId!==selection.rootBindingId||canvas.selectedOutputId!==selection.output.id||proof?.kind!=='carousel-words'||!['projectId','documentId','outputId'].every(key=>word(owner[key])&&owner[key]===proof[key]&&owner[key]===proof.expected?.[key])||!hash(proof.wordsHash)||!hash(proof.expected?.markdownHash))throw Error('The exact visible Carousel owner or saved words changed.');
   return {project,selection,owner,binding:null,editor:carousel,proof:canvas,signature:JSON.stringify(['carousel',project.id,project.view,project.viewedStage,selection.rootBindingId,selection.output.id,owner.projectId,owner.documentId,owner.outputId])};
  }
  const draft=window.studyDraft,proof=draft?.currentProof?.(),magazine=draft?.currentOwner?.();
  if(proof?.parentStudyId!==project.id||!hash(proof.draftHash)||proof.expected?.workflow?.draft!==proof.draftHash)throw Error('The exact visible Article writing could not be confirmed.');
  let owner,binding=null,selection=null;
  if(magazine?.kind==='magazine'){
   if(proof.owner?.kind!=='magazine'||!['storyId','pieceId','path'].every(key=>word(magazine[key])&&magazine[key]===proof.owner[key]))throw Error('The visible Article belongs to another saved owner.');owner=magazine;
  }else{
   binding=draft?.currentBinding?.();if(!word(binding?.id)||binding.parentStudyId!==project.id||proof.bindingId!==binding.id)throw Error('The visible Article belongs to another manuscript binding.');owner={kind:'native',bindingId:binding.id,parentStudyId:project.id};const selected=window.studyOutputConnection?.selection?.();if(selected?.projectId===project.id&&selected.output?.kind==='article'&&selected.owner?.kind==='native'&&selected.owner.bindingId===binding.id&&(!binding.canonicalOutputId||selected.output.id===binding.canonicalOutputId))selection=selected;
  }
  return {project,selection,owner,binding,editor:article,proof,signature:JSON.stringify(['article',project.id,project.view,project.viewedStage,owner.kind,owner.storyId,owner.pieceId,owner.path,binding?.id,selection?.rootBindingId,selection?.output?.id])};
 }

 const same=entry=>{try{const now=context();return active===entry&&entry.sheet.isConnected&&now.signature===entry.context.signature&&now.editor===entry.context.editor;}catch{return false;}};
 function status(entry,text){entry.message.textContent=text;entry.message.hidden=!text;}
 function scrollCapture(editor){const rows=[];for(let n=editor;n;n=n.parentElement)rows.push({node:n,top:n.scrollTop,left:n.scrollLeft});const scroller=document.scrollingElement;if(scroller&&!rows.some(r=>r.node===scroller))rows.push({node:scroller,top:scroller.scrollTop,left:scroller.scrollLeft});return rows;}
 function capture(c){
  const selection=window.getSelection();let range=null;
  if(selection?.rangeCount&&c.editor.contains(selection.getRangeAt(0).commonAncestorContainer))range=selection.getRangeAt(0).cloneRange();
  else if(lastSelection?.editor===c.editor&&c.editor.contains(lastSelection.range.commonAncestorContainer))range=lastSelection.range.cloneRange();
  const field=document.activeElement,fieldSelection=field?.matches('textarea,input')&&c.editor.contains(field)?{node:field,start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection}:lastFieldSelection?.editor===c.editor&&lastFieldSelection.signature===c.signature&&lastFieldSelection.node.isConnected?lastFieldSelection:null;
  const hold=c.editor.id==='manuscript'?window.studyDraft?.holdForContext?.({selectionRange:range}):null;
  if(c.editor.id==='manuscript'&&!hold?.bufferToken)throw Error('This writing could not retain its current buffer.');
  return {range,fieldSelection,hold,scroll:scrollCapture(c.editor),focus:field,proof:c.proof,editor:c.editor};
 }
 function dispose(entry){if(entry.disposed)return;entry.disposed=true;entry.abort.abort();entry.controller?.cleanup?.();for(const saved of entry.borrowed){if(saved.marker.isConnected)saved.marker.replaceWith(saved.node);}entry.borrowed=[];}
 function cancelChanged(entry){
  if(active!==entry)return;
  dispose(entry);if(entry.held.hold)try{window.studyDraft.releaseContext({bufferToken:entry.held.hold.bufferToken,cancelOnly:true,restoreSelection:false});}catch{}
  entry.sheet.remove();document.body.classList.remove('combined-sheet-open');active=null;lastReturn={restored:false,reason:'selected-piece-changed',sameEditorNode:false};
 }
 async function close(){
  const entry=active;if(!entry)return true;
  if(!same(entry)){cancelChanged(entry);return false;}
  try{
   if(entry.controller?.beforeClose&&await entry.controller.beforeClose()===false)return false;
   if(!same(entry)){cancelChanged(entry);return false;}
   // The existing owner verifies the retained revision before releasing it.
   const result=entry.held.hold?window.studyDraft.releaseContext({bufferToken:entry.held.hold.bufferToken,restoreSelection:true}):null;
   dispose(entry);entry.sheet.remove();document.body.classList.remove('combined-sheet-open');active=null;
   const held=entry.held,editor=entry.context.editor;
   if(held.fieldSelection?.node.isConnected){const f=held.fieldSelection;f.node.focus({preventScroll:true});f.node.setSelectionRange(f.start,f.end,f.direction);}
   else if(held.range&&editor.contains(held.range.commonAncestorContainer)){editor.focus({preventScroll:true});const selection=window.getSelection();selection.removeAllRanges();selection.addRange(held.range);}
   else if(held.focus?.isConnected)held.focus.focus?.({preventScroll:true});
   for(const row of held.scroll)if(row.node.isConnected){row.node.scrollTop=row.top;row.node.scrollLeft=row.left;}
   const range=window.getSelection()?.rangeCount?window.getSelection().getRangeAt(0):null;
   lastReturn={restored:true,kind:entry.kind,sameEditorNode:editor===held.editor,selectionRestored:held.range?!!range&&range.startContainer===held.range.startContainer&&range.startOffset===held.range.startOffset&&range.endContainer===held.range.endContainer&&range.endOffset===held.range.endOffset:!!held.fieldSelection,...(result?{ownerReturn:result}:{})};
   window.dispatchEvent(new CustomEvent('combined-sheet-return',{detail:lastReturn}));return true;
  }catch(error){status(entry,error.message||'Return needs review. Your writing remains retained.');return false;}
 }
 function unavailable(entry){if(!same(entry))return;entry.content.replaceChildren();const copy=node('p',names[entry.kind]+' · not connected');copy.className='combined-sheet-unavailable';entry.content.append(copy);}
 function borrow(entry,element){
  if(!same(entry)||!element?.isConnected||element===entry.context.editor||element.contains(entry.context.editor))throw Error('This context owner cannot be moved without replacing the writing.');
  const marker=document.createComment('Combined context owner return');element.before(marker);entry.borrowed.push({node:element,marker});entry.content.append(element);return element;
 }
 async function open(kind){
  if(!names[kind])throw Error('Choose Source, Research, Media or Arrange.');
  if(kind==='research'&&typeof window.c3Research?.openLearning==='function'){
   if(active&&!await close())return false;
   await window.c3Research.openLearning({parentStudyId:current().id});return true;
  }
  if(window.c3Research?.isOpen?.()&&window.c3Research.hide()===false)return false;
  if(active){if(active.kind===kind)return true;if(!await close())return false;}
  const c=context(),held=capture(c),sheet=node('aside');sheet.id='combined-sheet';sheet.dataset.kind=kind;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','false');sheet.setAttribute('aria-label',names[kind]);
  const header=node('header'),title=node('h2',names[kind]),back=node('button','Back to writing');back.type='button';back.dataset.combinedSheetClose='';const hint=node('span','Esc returns to the same line');hint.className='combined-sheet-hint';header.append(title,hint,back);
  const message=node('p');message.setAttribute('role','status');message.hidden=true;const content=node('div');content.className='combined-sheet-content';const footer=node('footer'),full=node('button','Open full '+names[kind]);full.type='button';full.dataset.combinedSheetFull=kind;footer.append(full);sheet.append(header,message,content,footer);
  const entry={kind,context:c,held,sheet,content,message,abort:new AbortController(),borrowed:[],controller:null,disposed:false};active=entry;document.body.append(sheet);document.body.classList.add('combined-sheet-open');content.append(node('p','Opening '+names[kind]+'…'));back.onclick=()=>void close();full.onclick=async()=>{if(!same(entry)||!await close())return;const original=[...document.querySelectorAll('.workflowNavigation .workflowStep')].find(b=>Number(b.querySelector('.stepNumber')?.textContent)===stages[kind]);if(original&&!original.disabled)original.click();else window.combinedNavigation?.go?.(kind);};back.focus({preventScroll:true});
  try{
   const mount=owners.get(kind);if(!mount){unavailable(entry);return true;}
   content.replaceChildren();
   const controller=await mount({container:content,project:c.project,selection:c.selection,owner:c.owner,binding:c.binding,editor:c.editor,hold:held.hold,signal:entry.abort.signal,isCurrent:()=>same(entry),borrow:element=>borrow(entry,element),setTitle:text=>{if(same(entry))title.textContent=text;}});
   if(!same(entry)){controller?.cleanup?.();return false;}
   entry.controller=controller||null;await controller?.ready;
   if(!same(entry)){dispose(entry);return false;}return true;
  }catch(error){if(same(entry)){unavailable(entry);status(entry,error.message||'This sheet is not connected.');}return false;}
 }
 function registerOwner(kind,mount){if(!names[kind]||typeof mount!=='function')throw Error('Supply a maintained context owner.');owners.set(kind,mount);return ()=>{if(owners.get(kind)===mount)owners.delete(kind);};}
 // These APIs already mount their actual guarded readers without stage navigation.
 function mountSourceContext({container,project,owner,binding,selection,isCurrent,signal,setTitle}){
  const label=node('label','Source'),choice=node('select'),reading=node('div'),notice=node('p');label.className='combined-source-picker';choice.dataset.combinedSourceChoice='';choice.setAttribute('aria-label','Source record');notice.setAttribute('role','status');notice.className='combined-sheet-unavailable';label.append(choice);container.append(label,notice,reading);
  const shared=node('option','Shared kept conversations');shared.value='shared';choice.append(shared);let disposed=false,sharedOpen=false,records=[],selectedByUser=false,missingNotice='',copyRoot=null,languageReview=null;
  const before=window.studyDraft?.currentProof?.(),piece=owner?.kind==='magazine'&&before?.owner?.kind==='magazine'&&before.parentStudyId===project.id&&['storyId','pieceId','path'].every(key=>owner[key]===before.owner[key])&&/^[a-f0-9]{64}$/.test(before.draftHash||'')?{...owner,hash:before.draftHash}:null;
  if(owner?.kind==='magazine'&&!piece)throw Error('The selected article source context could not be confirmed.');
  const stillHere=()=>!disposed&&!signal.aborted&&isCurrent();
  const active=()=>stillHere()&&(!piece||(()=>{const currentOwner=window.studyDraft?.currentOwner?.(),proof=window.studyDraft?.currentProof?.();return ['storyId','pieceId','path'].every(key=>currentOwner?.[key]===piece[key]&&proof?.owner?.[key]===piece[key])&&proof.parentStudyId===project.id&&proof.draftHash===piece.hash;})());
  const sourceKind=record=>record.path.startsWith('Workflow/0-Inbox/RAW - ')?'Raw record':'Transcript source';
  const sourceLabel=record=>(window.arCreateDisplay?.title?.(record,'Saved source')||record.name||'Saved source')+' · '+sourceKind(record);
  function closeShared(){if(sharedOpen){sharedOpen=false;window.studyImportedSource?.closeContext?.();}}
  function show(){if(!active())return;languageReview?.close();if(choice.value==='shared'&&sharedOpen)return;closeShared();reading.replaceChildren();notice.textContent=missingNotice;if(choice.value==='shared'){const source=window.studyImportedSource;if(!source?.openContext){notice.textContent='Shared kept conversations · not connected';return;}source.openContext({container:reading,project});sharedOpen=true;setTitle('Source · shared kept conversations');return;}const record=records[Number(choice.value)];if(!record||record.missing)return;setTitle('Source');const article=node('article');article.className='human-direction-preview';article.dataset.sourceRecordPath=record.path;article.dataset.sourceRecordHash=record.hash;const state=node('p','Subject source · '+sourceKind(record)+' · saved original · read only');state.className='small';article.append(state);const body=node('div'),prose=record.raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');if(window.studyReadableMarkdown?.render)body.innerHTML=window.studyReadableMarkdown.render(prose);else{body.textContent=prose;body.style.whiteSpace='pre-wrap';}article.append(body);reading.append(article);if(copyRoot&&record.id&&window.arCreateSourceLanguage?.create){
    const offset=record.raw.length-prose.length,ranges=[],tools=node('div'),translate=node('button','Translate selected · 0'),mount=node('div');translate.type='button';translate.disabled=true;translate.dataset.copySourceTranslate='';tools.className='source-reader-actions';tools.append(translate);article.prepend(tools);article.append(mount);body.replaceChildren();
    for(const match of prose.matchAll(/\S[\s\S]*?(?=\r?\n[ \t]*\r?\n|$)/g)){const words=match[0],from=offset+match.index,to=from+words.length,row=node('section'),text=node('p',words);text.style.whiteSpace='pre-wrap';text.style.fontSize='16px';text.style.lineHeight='1.6';if(!/^#{1,6}\s/.test(words)&&words.length<=16000){const label=node('label'),box=node('input');box.type='checkbox';box.dataset.copySourceFrom=String(from);box.dataset.copySourceTo=String(to);box.setAttribute('aria-label','Select source passage for translation');label.className='source-language-selection';label.append(box,document.createTextNode('Translate'));row.append(label);box.onchange=()=>{languageReview?.close();if(box.checked){if(ranges.length>=8||ranges.reduce((n,r)=>n+r.to-r.from,0)+to-from>16000){box.checked=false;notice.textContent='Select up to eight passages, under 16,000 characters.';return;}ranges.push({from,to});ranges.sort((a,b)=>a.from-b.from);}else ranges.splice(ranges.findIndex(r=>r.from===from&&r.to===to),1);translate.textContent='Translate selected · '+ranges.length;translate.disabled=!ranges.length;};}row.append(text);body.append(row);}
    languageReview=window.arCreateSourceLanguage.create({window,context:()=>{if(!active()||records[Number(choice.value)]!==record)throw Error('Selected source changed. Reopen Source.');return {selection:{kind:'copy-capture-excerpts',bindingId:copyRoot.id,parentStudyId:project.id,recordId:record.id,expectedSourceHash:record.hash,ranges:structuredClone(ranges)},rows:ranges.map(r=>({id:record.id+':'+r.from+':'+r.to,text:record.raw.slice(r.from,r.to),speaker:null})),actor:window.arCreateUiActor?.actor||'',title:sourceLabel(record),proof:{bindingId:copyRoot.id,parentStudyId:project.id,recordId:record.id,hash:record.hash}};}});translate.onclick=async()=>{try{await languageReview.open({container:mount});}catch(error){notice.textContent=error.message;}};
   }}
  choice.onchange=()=>{selectedByUser=true;show();};
  const api=async route=>{const response=await fetch(route,{method:'GET',cache:'no-store',signal}),value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Saved sources could not be read.'),{status:response.status});return value;};
  const originalKey=({'ref-an-cha':'ancha','ref-collector':'collector'})[project.id]||project.id;
  const sourcePath=path=>typeof path==='string'&&/^Workflow\/(?:1-Source\/SRC|0-Inbox\/RAW) - [^/]+\.md$/.test(path)&&!/[\\\x00-\x1f\x7f]/.test(path);
  const checked=async(record,expected)=>{if(!record||record.missing||!sourcePath(record.path)||typeof record.raw!=='string'||!/^[a-f0-9]{64}$/.test(record.hash||'')||expected&&record.hash!==expected.hash)throw Error('A configured source changed or is unavailable.');if(!crypto.subtle)throw Error('Saved source fingerprints cannot be checked here.');const sum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(record.raw))),b=>b.toString(16).padStart(2,'0')).join('');if(sum!==record.hash)throw Error('Saved source words do not match their captured fingerprint.');return record;};
  const ready=(async()=>{notice.textContent='Reading this subject’s saved sources…';
   if(owner?.kind==='native'){const rootId=selection?.rootBindingId||binding?.id;let owned;try{owned=await api('/api/study-draft/read?'+new URLSearchParams({bindingId:rootId,parentStudyId:project.id}));}catch(error){if(binding?.origin==='structure-test'||binding?.structureTest)throw error;}if(!active())return;if(owned?.binding?.origin==='structure-test'){const root=owned.binding;if(root.id!==rootId||root.parentStudyId!==project.id||root.kind!=='collection-root'||root.status!=='ready'||owned.readiness?.ready!==true||!Array.isArray(owned.context?.records))throw Error('The registered copy source context changed.');copyRoot=root;const sources=owned.context.records.filter(r=>r.role!=='draft'&&typeof r.sourcePath==='string'&&/(?:^|\/)Workflow\/(?:1-Source\/SRC|0-Inbox\/RAW) - [^/]+\.md$/.test(r.sourcePath));records=await Promise.all(sources.map(r=>{if(!r.id||r.missing||r.sourceHash!==r.copiedHash)throw Error('The captured source identity changed.');const path=r.sourcePath.slice(r.sourcePath.indexOf('Workflow/'));return checked({...r,path,hash:r.copiedHash,name:path.split('/').at(-1)});}));if(!active())return;choice.replaceChildren();records.forEach((record,index)=>{const option=node('option',sourceLabel(record));option.value=String(index);choice.append(option);});if(!records.length){const empty=node('option','No captured source passages');empty.value='';empty.disabled=true;choice.append(empty);}choice.append(shared);choice.value=records.length?'0':'';show();return;}}
   const [originals,inputResult]=await Promise.all([api('/api/study-originals?'+new URLSearchParams({projectKey:originalKey})),piece?api('/api/study-originals/check-inputs?'+new URLSearchParams({parentStudyKey:project.id,partKey:window.magazineCheckInputPartKey?.(piece)||piece.partKey,draftPath:piece.path,expectedDraftHash:piece.hash})).then(value=>({value}),error=>({error})):Promise.resolve({})]);if(!active()){if(stillHere())throw Error('The selected writing changed. Reopen Source.');return;}if(originals.projectKey!==originalKey||!Array.isArray(originals.records))throw Error('The original reader returned another subject.');if(inputResult.error&&![404,503].includes(inputResult.error.status))throw inputResult.error;
   const inputs=inputResult.value;if(inputs&&(inputs.schema!=='ar-create.study-original-inputs.v1'||inputs.parentStudyKey!==project.id||inputs.partKey!==(window.magazineCheckInputPartKey?.(piece)||piece.partKey)||inputs.draftPath!==piece.path||inputs.draftHash!==piece.hash||!Array.isArray(inputs.sources)||!/^[a-f0-9]{64}$/.test(inputs.revision||'')||inputs.rootIdentity?.scheme!=='canonical-directory-sha256-v1'||!/^[a-f0-9]{64}$/.test(inputs.rootIdentity?.fingerprint||'')))throw Error('The configured piece sources changed.');
   const refs=inputs?.sources;if(refs&&(new Set(refs.map(ref=>ref.path)).size!==refs.length||refs.some(ref=>ref.role!=='source'||!sourcePath(ref.path)||!/^[a-f0-9]{64}$/.test(ref.hash||''))))throw Error('The configured source identities are unavailable or ambiguous.');
   let available=[...originals.records];if(!refs||refs.some(ref=>!available.some(record=>record.path===ref.path))){const keys=[...new Set((originals.relatedProjects||[]).map(ref=>ref.projectKey).filter(key=>typeof key==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(key)&&key!==originalKey))];const related=await Promise.all(keys.map(async key=>{const value=await api('/api/study-originals?'+new URLSearchParams({projectKey:key}));if(value.projectKey!==key||!Array.isArray(value.records))throw Error('A related source reader returned another subject.');return value.records;}));if(!active()){if(stillHere())throw Error('The selected writing changed. Reopen Source.');return;}available.push(...related.flat());}
   if(!refs){const paths=available.filter(record=>sourcePath(record.path)).map(record=>record.path);if(new Set(paths).size!==paths.length)throw Error('Subject source paths are ambiguous across their declared originals.');}
   const selected=refs?refs.map(ref=>{const matches=available.filter(record=>record.path===ref.path);if(matches.length!==1)throw Error('A configured source is missing or ambiguous.');return {record:matches[0],expected:ref};}):available.filter(record=>sourcePath(record.path)).map(record=>({record}));
   const confirmed=await Promise.all(selected.map(({record,expected})=>!refs&&record.raw===null&&record.hash===null?{...record,missing:true}:checked(record,expected)));missingNotice=confirmed.some(record=>record.missing)?'Some declared subject sources are unavailable. Verified sources remain readable.':'';if(!active()){if(stillHere())throw Error('The selected writing changed. Reopen Source.');return;}records=confirmed;choice.replaceChildren();records.forEach((record,index)=>{const option=node('option',sourceLabel(record)+(record.missing?' · Unavailable':''));option.value=String(index);option.disabled=record.missing===true;choice.append(option);});if(!records.length){const empty=node('option','No captured originals');empty.value='';empty.disabled=true;choice.append(empty);}choice.append(shared);const preferred=!refs?records.findIndex(record=>!record.missing&&originals.records.some(own=>own.path===record.path)&&record.path.startsWith('Workflow/1-Source/SRC - ')):-1,first=preferred>=0?preferred:records.findIndex(record=>!record.missing);choice.value=selectedByUser&&sharedOpen?'shared':first>=0?String(first):'';show();if(!records.length)notice.textContent='No captured originals are connected to this subject.';
  })().catch(error=>{if(!stillHere())return;records=[];const empty=node('option','Subject sources · not connected');empty.value='';empty.disabled=true;choice.replaceChildren(empty,shared);choice.value=selectedByUser&&sharedOpen?'shared':'';if(!sharedOpen){reading.replaceChildren();setTitle('Source');}notice.textContent='Subject sources · not connected. '+error.message;});
  const changed=()=>{if(stillHere()&&!active()){languageReview?.close();closeShared();reading.replaceChildren();notice.textContent='The selected writing changed. Reopen Source.';choice.disabled=true;}};window.addEventListener('study-draft-change',changed);
  return {ready,cleanup(){languageReview?.close();disposed=true;window.removeEventListener('study-draft-change',changed);closeShared();choice.onchange=null;container.replaceChildren();}};
 }
 registerOwner('source',mountSourceContext);
 registerOwner('research',options=>{if(!window.ResearchStandard?.mountContext)throw Error('The research reader is not connected.');return window.ResearchStandard.mountContext(options);});
 registerOwner('arrange',options=>{if(options.owner?.kind==='magazine'&&window.magazineArrange?.mountContext)return window.magazineArrange.mountContext(options);if(window.studyOutputConnection?.mountArrangeContext)return window.studyOutputConnection.mountArrangeContext(options);throw Error('Arrange is not connected for this piece.');});
 registerOwner('media',options=>{if(window.studyPhotoStage?.mountContext)return window.studyPhotoStage.mountContext(options);throw Error('Media is not connected for this piece.');});
 const changed=()=>{if(active&&!same(active))cancelChanged(active);};
 for(const name of ['study-output-selection','study-draft-change','c3-header-painted'])window.addEventListener(name,changed);
 const observer=new MutationObserver(changed);observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 function rememberField(event){const field=event.target;if(!field?.matches?.('textarea,input'))return;try{const c=context();if(c.editor.contains(field))lastFieldSelection={editor:c.editor,signature:c.signature,node:field,start:field.selectionStart,end:field.selectionEnd,direction:field.selectionDirection};}catch{}}
 document.addEventListener('select',rememberField,true);document.addEventListener('focusout',rememberField,true);
 document.addEventListener('selectionchange',()=>{try{const c=context(),s=window.getSelection();if(s?.rangeCount&&c.editor.contains(s.getRangeAt(0).commonAncestorContainer))lastSelection={editor:c.editor,range:s.getRangeAt(0).cloneRange()};}catch{}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();void close();}},true);
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-combined-nav]'),kind=b?.dataset.combinedNav;if(!names[kind]||kind==='media'||kind==='arrange'||b.disabled)return;try{context();}catch{return;}event.preventDefault();event.stopImmediatePropagation();void open(kind);},true);
 window.addEventListener('pagehide',event=>{if(active)cancelChanged(active);if(!event.persisted)observer.disconnect();});
 window.combinedSheets={open,close,registerOwner,state:()=>active?{kind:active.kind,projectId:active.context.project.id}:null,lastReturn:()=>lastReturn};
})();
