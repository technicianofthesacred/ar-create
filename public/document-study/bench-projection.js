/* Metadata only. Opening, editing, saved locations and history remain with their owners. */
(()=>{
 'use strict';
 const HASH=/^[a-f0-9]{64}$/i;
 const key=t=>JSON.stringify([t?.kind,t?.storyId??null,t?.artifactId??null,t?.hash??null,t?.workspaceId??null,t?.rootBindingId??null,t?.parentStudyId??null,t?.outputId??null,t?.edition??null]);
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const text=(value,fallback)=>typeof value==='string'&&value.trim()?value:fallback;
 function project({catalog,scope,ready=false,current=null,history=[],capabilities=[]}={}){
  if(typeof scope!=='string'||!HASH.test(scope))throw Error('The work connection could not be confirmed.');
  if(!catalog)return freeze({scope,revision:null,ready:false,rows:[],moves:[],current:null,history:[],state:'pending'});
  if(!Array.isArray(catalog.stories)||catalog.stories.length>10000||catalog.revision!=null&&!HASH.test(catalog.revision))throw Error('The work list could not be confirmed.');
  const revision=catalog.revision??null,rows=[],seen=new Map(),projects=new Set(),files=new Map(),outputs=new Set(),can=new Set(capabilities),drafts=[];
  const add=(target,title,projectTitle,kind,extra={})=>{const id=key(target),old=seen.get(id),row={key:id,title:text(title,'Untitled work'),projectTitle,kind,target:{...target},available:can.has(target.kind),...extra};if(old){if(JSON.stringify(old)!==JSON.stringify(row))throw Error('Conflicting work references need review.');return old;}seen.set(id,row);rows.push(row);return row;};
  for(const story of catalog.stories){
   if(!story||typeof story.id!=='string'||!story.id||projects.has(story.id))throw Error('Conflicting project references need review.');projects.add(story.id);
   const name=text(story.name,'Untitled project'),artifacts=new Map();
   for(const a of story.artifacts||[]){if(!a?.artifactId)continue;if(files.has(a.artifactId)&&files.get(a.artifactId)!==story.id)throw Error('Conflicting file ownership needs review.');files.set(a.artifactId,story.id);const old=artifacts.get(a.artifactId);if(old&&(old.hash!==a.hash||old.kind!==a.kind))throw Error('Conflicting file references need review.');artifacts.set(a.artifactId,a);}
   add({kind:'story',storyId:story.id},name,name,'Project',{archived:story.archived===true});
   const parts=story.parts?.length?story.parts:story.latestDraft?[story.latestDraft]:[];
   const ids=new Set();for(const draft of parts){if(!draft?.artifactId||!HASH.test(draft.hash||''))continue;if(ids.has(draft.artifactId))throw Error('A piece reference is ambiguous.');ids.add(draft.artifactId);const exact=artifacts.get(draft.artifactId);if(!exact||exact.hash!==draft.hash||String(exact.kind).toUpperCase()!=='DEV')throw Error('The exact saved piece could not be confirmed.');
    const t={kind:'draft',storyId:story.id,artifactId:draft.artifactId,hash:draft.hash},row=add(t,draft.title||draft.fileName,name,story.parts?.length?'Article part':'Article',{archived:!!draft.archived,parentStudyId:story.nativeProjectId??null,partKey:draft.magazineWorkingTarget?.partKey??null});drafts.push(row);
   }
   for(const output of story.retainedOutputs||[])if(output?.kind==='carousel'&&typeof output.id==='string'){if(outputs.has(output.id))throw Error('Conflicting output references need review.');outputs.add(output.id);add({kind:'carousel',storyId:story.id,outputId:output.id,edition:output.edition??null},output.title||name+' · Carousel',name,'Carousel',{archived:!!output.archived});}
  }
  const pieceIds=new Set();for(const piece of catalog.workspacePieces||[]){if(!piece||typeof piece.id!=='string'||pieceIds.has(piece.id))throw Error('Conflicting workspace references need review.');pieceIds.add(piece.id);const links=(catalog.workspaceLinks?.pieces||[]).filter(link=>link.workspaceId===piece.id);if(links.length>1)throw Error('A workspace connection is ambiguous.');const targets=links[0]?.targets||[];
   if(!targets.length){add({kind:'workspace-record',workspaceId:piece.id},piece.title,'Saved workspace','Workspace record');continue;}
   const roots=new Set();for(const [index,t]of targets.entries()){if(t.workspaceId!==piece.id||!t.rootBindingId||!t.parentStudyId||roots.has(JSON.stringify([t.rootBindingId,t.outputId??null])))throw Error('A saved workspace target could not be confirmed.');roots.add(JSON.stringify([t.rootBindingId,t.outputId??null]));
    // Collapse only a verified native root pointing at the same original hash.
    if(!t.outputId&&t.originalHash&&drafts.some(row=>row.parentStudyId===t.parentStudyId&&row.target.hash===t.originalHash&&(row.partKey===null?t.partKey==='article':row.partKey===t.partKey)))continue;
    add({kind:'workspace',workspaceId:piece.id,rootBindingId:t.rootBindingId,parentStudyId:t.parentStudyId,outputId:t.outputId??null,edition:t.edition??null},piece.title,text(piece.projectTitle,'Saved workspace'),t.outputId?'Saved output':t.partKey&&t.partKey!=='article'?'Article part':'Article',{targetIndex:index});
   }
  }
  const selected=current?.target?seen.get(key(current.target)):null;
  if(current?.target&&!selected)throw Error('The selected piece is not in this exact work list.');
  const currentRow=selected?{...selected,stage:Number.isInteger(current.stage)?current.stage:null,saveLabel:text(current.saveLabel,'Current work'),resumeLabel:text(current.resumeLabel,'Open current work')}:null;
  const events=selected?(history||[]).filter(event=>event&&typeof event.id==='string'&&typeof event.label==='string'&&typeof event.actor==='string'&&Number.isFinite(Date.parse(event.at))&&(!event.target||key(event.target)===selected.key)).slice(0,3).map(e=>({id:e.id,label:e.label,actor:e.actor,at:e.at})):[];
  const moves=rows.filter(row=>row.available&&!row.archived&&row.kind!=='Project'&&row.key!==selected?.key).slice(0,4).map(row=>({...row,label:(row.target.kind==='draft'?'Read ':row.target.kind==='carousel'?'View ':'Open ')+row.title}));
  return freeze({scope,revision,ready:!!ready&&!!revision,rows,moves,current:currentRow,history:events,state:rows.length?'available':'empty'});
 }
 function descriptor(projection,targetKey,{scope,revision,ready}={}){
  if(!ready||!projection?.ready||projection.scope!==scope||projection.revision!==revision)throw Error('The work list is updating. Try again when it is ready.');const row=projection.rows.find(row=>row.key===targetKey);if(!row||!row.available)throw Error('This work is not connected to an opening action.');return freeze({...row.target,...row.targetIndex!==undefined?{targetIndex:row.targetIndex}:{},catalogRevision:projection.revision,scope:projection.scope});
 }
 window.arCreateBenchProjection=Object.freeze({project,descriptor,key});
})();
