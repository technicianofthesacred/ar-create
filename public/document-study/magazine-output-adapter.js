/* Recorded publication references are metadata, never delivered-edition proof. */
(()=>{
 'use strict';
 const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v), text=v=>typeof v==='string'&&v.length>0;
 const copy=v=>structuredClone(v), freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
 function publicationURL(value){
  if(typeof value!=='string'||!/^https:\/\/www\.teajia\.com\/read\/[A-Za-z0-9_-]+$/.test(value))throw Error('The recorded publication address is unsupported.');
  const u=new URL(value);if(u.origin!=='https://www.teajia.com'||u.username||u.password||u.port||u.search||u.hash)throw Error('The recorded publication address is unsupported.');return value;
 }
 function snapshot(value,projectId){
  const s=copy(value),o=s?.owner;
  if(!text(projectId)||s?.projectId!==projectId||o?.kind!=='magazine'||!text(o.storyId)||!text(o.pieceId)||!/^Workflow\/3-Develop\/DEV - [^/\\\x00-\x1f]+\.md$/.test(o.path||'')||!sha(s.hash)||typeof s.dirty!=='boolean')throw Error('Choose this exact Magazine working part before opening its references.');
  if(s.dirty)throw Error('Save or resolve the current edits before opening this reference.');return freeze({projectId:s.projectId,owner:{kind:'magazine',storyId:o.storyId,pieceId:o.pieceId,path:o.path},hash:s.hash,dirty:s.dirty});
 }
 function reference(value,s){
  const r=copy(value),w=r?.workingOwnerRef;
  if(r?.schema!=='ar-create.magazine-publication-reference.v1'||!sha(r.revision)||r.nativeProjectId!==s.projectId||w?.projectId!==s.owner.storyId||w.pieceId!==s.owner.pieceId||w.editionId!=='working'||!text(w.artifactId)||w.hash!==s.hash)throw Error('The publication reference does not match this exact working part.');
  if(r.publication!==null){const p=r.publication;if(!sha(p?.id)||!text(p.title)||p.recordedBy!=='working-draft-frontmatter'||p.edition!==null||p.date!==null)throw Error('The recorded publication metadata could not be confirmed.');publicationURL(p.url);}
  // Keep only contract metadata. Resolver extras can never become file bodies or delivery proof.
  return freeze({schema:r.schema,revision:r.revision,nativeProjectId:r.nativeProjectId,workingOwnerRef:{projectId:w.projectId,pieceId:w.pieceId,editionId:'working',artifactId:w.artifactId,hash:w.hash},publication:r.publication===null?null:{id:r.publication.id,url:r.publication.url,title:r.publication.title,recordedBy:r.publication.recordedBy,edition:null,date:null}});
 }
 function createMagazineOutputAdapter({current,resolve,openWorking,openPublication,readWorking,readShareContext:readShare,readShareFeedback:readFeedback,openArrangement,openAudience,downloadWorking}={}){
  if(typeof current!=='function'||typeof resolve!=='function')throw Error('The Magazine reference reader is not connected.');
  const state=id=>snapshot(current(),id);
  const unchanged=s=>{if(stable(state(s.projectId))!==stable(s))throw Error('The selected working part changed. Read its references again.');};
  async function fresh(s){unchanged(s);const r=reference(await resolve(freeze({storyId:s.owner.storyId,pieceId:s.owner.pieceId,expectedHash:s.hash})),s);unchanged(s);return r;}
  const working=(s,r)=>freeze({kind:'magazine-working',projectId:s.projectId,owner:copy(s.owner),hash:s.hash,workingOwnerRef:copy(r.workingOwnerRef),revision:r.revision});
  const workingId=s=>'magazine-working:'+s.owner.storyId+':'+s.owner.pieceId;
  async function readShareContext(input={}){
   const q=copy(input),s=state(q.projectId);
   if(typeof readShare!=='function')throw Error('Magazine invitation context is not connected.');
   if(q.outputId!==workingId(s)||q.expectedHash!==s.hash)throw Error('Choose this exact current article before preparing its invitation.');
   const value=copy(await readShare(freeze({storyId:s.owner.storyId,pieceId:s.owner.pieceId,edition:'working',expectedHash:s.hash})));unchanged(s);
   const a=value?.authority,d=value?.draft,selection=value?.selection,root=value?.rootIdentity;
   if(value?.schema!=='ar-create.magazine-share-context.v1'||selection?.storyId!==s.owner.storyId||selection.pieceId!==s.owner.pieceId||selection.edition!=='working'||a?.kind!=='magazine'||a.storyId!==s.owner.storyId||a.pieceId!==s.owner.pieceId||a.path!==s.owner.path||d?.path!==s.owner.path||d.hash!==s.hash||root?.scheme!=='canonical-directory-sha256-v1'||!sha(root.fingerprint))throw Error('Invitation context belongs to different or changed work.');
   const references={};let count=0;
   for(const [key,kind]of Object.entries({feedback:'FEEDBACK',context:'CONTEXT',research:'RESEARCH'})){
    if(!Array.isArray(value.references?.[key]))throw Error('Registered invitation references are unavailable.');
    references[key]=value.references[key].map(r=>{
     const missing=r.state==='missing',readable=['current','changed-since-registration'].includes(r.state);
     if(++count>512||r.kind!==kind||!text(r.path)||!sha(r.registeredHash)||!(missing?r.currentHash===null:sha(r.currentHash))||!['current','changed-since-registration','missing','unreadable'].includes(r.state)||r.readable!==readable||r.changedSinceRegistration!==(r.currentHash!==r.registeredHash)||r.state==='current'&&r.changedSinceRegistration||r.state==='changed-since-registration'&&!r.changedSinceRegistration)throw Error('Registered invitation reference state is inconsistent.');
     return {path:r.path,kind,registeredHash:r.registeredHash,currentHash:r.currentHash,state:r.state,readable:r.readable,changedSinceRegistration:r.changedSinceRegistration};
    });
   }
   return freeze({schema:value.schema,selection:{storyId:selection.storyId,pieceId:selection.pieceId,edition:'working'},authority:{...s.owner,...text(a.title)&&a.title.length<=512?{title:a.title}:{}},rootIdentity:{scheme:root.scheme,fingerprint:root.fingerprint},draft:{path:d.path,hash:d.hash},references});
  }
  async function readShareEntry({projectId}={}){
   const s=state(projectId),context=await readShareContext({projectId,outputId:workingId(s),expectedHash:s.hash});unchanged(s);
   return freeze({output:{id:workingId(s),kind:'magazine-working',title:context.authority.title||'Working article',format:'Working article',workingHash:s.hash},context});
  }
  const feedbackPath=value=>typeof value==='string'&&value.length<=600&&/^Workflow\/6-Feedback\/FEEDBACK - [^/\\\x00-\x1f\x7f]+\.md$/.test(value)&&!value.includes('.sync-conflict-');
  async function digestText(value){
   if(!globalThis.crypto?.subtle||typeof TextEncoder!=='function')throw Error('Canonical FEEDBACK verification is unavailable.');
   return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function feedbackMetadata(value){
   if(value===null)return null;
   if(value?.schema!=='ar-create.magazine-feedback-share.v1'||!Array.isArray(value.entries)||value.entries.length>200||new TextEncoder().encode(JSON.stringify(value)).length>65536)throw Error('FEEDBACK recipient mapping exceeds its contract.');
   const owners=new Set(),headings=new Set();
   const entries=value.entries.map(entry=>{
    const t=entry?.target;
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(entry?.recipientId||'')||!t||!['storyId','pieceId'].every(k=>text(t[k])&&t[k].length<=256&&!/[\x00-\x1f\x7f]/.test(t[k]))||t.edition!=='working'||!sha(t.hash)||!Array.isArray(entry.sections)||!entry.sections.length||entry.sections.length>12)throw Error('FEEDBACK recipient/edition mapping is invalid.');
    const owner=stable([entry.recipientId.toLowerCase(),t.storyId,t.pieceId,t.hash]);if(owners.has(owner))throw Error('FEEDBACK recipient/edition mapping is ambiguous.');owners.add(owner);const languages=new Set();
    const sections=entry.sections.map(anchor=>{
     if(typeof anchor?.language!=='string'||!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(anchor.language)||typeof anchor.heading!=='string'||anchor.heading.length>512||!/^#{1,6} [^\r\n]+$/.test(anchor.heading)||!sha(anchor.hash)||languages.has(anchor.language.toLowerCase())||headings.has(anchor.heading))throw Error('FEEDBACK language section mapping is invalid or ambiguous.');
     languages.add(anchor.language.toLowerCase());headings.add(anchor.heading);return {language:anchor.language,heading:anchor.heading,hash:anchor.hash};
    });
    return {recipientId:entry.recipientId,target:{storyId:t.storyId,pieceId:t.pieceId,edition:'working',hash:t.hash},sections};
   });
   return {schema:value.schema,entries};
  }
  async function readShareFeedback(input={}){
   const q=copy(input),s=state(q.projectId);
   if(typeof readFeedback!=='function')throw Error('Magazine FEEDBACK reading is not connected.');
   if(q.outputId!==workingId(s)||q.expectedHash!==s.hash||!feedbackPath(q.registeredFeedbackPath)||!sha(q.expectedFeedbackHash))throw Error('Choose an exact registered FEEDBACK reference and its current hash.');
   const context=await readShareContext({projectId:q.projectId,outputId:q.outputId,expectedHash:q.expectedHash});unchanged(s);
   const selected=context.references.feedback.filter(r=>r.path===q.registeredFeedbackPath);
   if(selected.length!==1||!selected[0].readable||selected[0].currentHash!==q.expectedFeedbackHash)throw Error('The chosen FEEDBACK is not one exact readable current registered reference.');
   const registered=selected[0],value=copy(await readFeedback(freeze({storyId:s.owner.storyId,pieceId:s.owner.pieceId,edition:'working',expectedHash:s.hash,registeredFeedbackPath:q.registeredFeedbackPath,expectedFeedbackHash:q.expectedFeedbackHash})));unchanged(s);
   const a=value?.authority,d=value?.draft,f=value?.feedback,doc=value?.document,sel=value?.selection,root=value?.rootIdentity,m=value?.mapping;
   if(value?.schema!=='ar-create.magazine-share-feedback.v1'||value.readOnly!==true||sel?.storyId!==s.owner.storyId||sel.pieceId!==s.owner.pieceId||sel.edition!=='working'||sel.editionId!==undefined||a?.kind!=='magazine'||a.storyId!==s.owner.storyId||a.pieceId!==s.owner.pieceId||a.path!==s.owner.path||d?.path!==s.owner.path||d.hash!==s.hash||stable(root)!==stable(context.rootIdentity)||f?.path!==registered.path||f.hash!==registered.currentHash||f.registeredHash!==registered.registeredHash||f.changedSinceRegistration!==registered.changedSinceRegistration||doc?.path!==registered.path||doc.kind!=='FEEDBACK'||doc.hash!==registered.currentHash||typeof doc.text!=='string'||doc.text.length>2097152||new TextEncoder().encode(doc.text).length>2097152)throw Error('FEEDBACK returned different or changed owner, root or canonical file metadata.');
   if(await digestText(doc.text)!==doc.hash)throw Error('FEEDBACK canonical Markdown does not match its file hash.');unchanged(s);
   if(typeof m?.structured!=='boolean'||!Array.isArray(m.projection)||m.projection.length>200||!(m.structured?m.reason===null:typeof m.reason==='string'&&m.reason.length>0&&m.reason.length<=2048)||!m.structured&&m.projection.length)throw Error('FEEDBACK projection state is inconsistent.');
   const metadata=feedbackMetadata(m.metadata),projection=[];
   if(metadata){
    const front=doc.text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1],lines=front?.split(/\r?\n/).filter(line=>line.startsWith('ar-create-share: '))||[];
    let stored;try{stored=lines.length===1?JSON.parse(lines[0].slice('ar-create-share: '.length)):null;}catch{}
    if(stable(stored)!==stable(metadata))throw Error('FEEDBACK mapping does not match the canonical Markdown namespace.');
   }
   if(m.structured){
    if(!metadata||m.projection.length!==metadata.entries.length)throw Error('FEEDBACK projection has no exact recipient references.');
    const ranges=[];
    for(let i=0;i<metadata.entries.length;i++){
     const entry=metadata.entries[i],p=m.projection[i],t=entry.target;
     if(t.storyId!==s.owner.storyId||t.pieceId!==s.owner.pieceId||t.hash!==s.hash||p?.recipientId!==entry.recipientId||stable(p.target)!==stable(t)||!Array.isArray(p.sections)||p.sections.length!==entry.sections.length)throw Error('FEEDBACK projection belongs to another recipient, piece or revision.');
     const sections=[];
     for(let j=0;j<entry.sections.length;j++){
      const anchor=entry.sections[j],section=p.sections[j];
      if(!section||section.language!==anchor.language||section.heading!==anchor.heading||section.hash!==anchor.hash||!Number.isSafeInteger(section.start)||!Number.isSafeInteger(section.end)||section.start<0||section.end<=section.start||section.end>doc.text.length||typeof section.markdown!=='string'||section.markdown!==doc.text.slice(section.start,section.end)||!section.markdown.startsWith(anchor.heading+'\n')&&!section.markdown.startsWith(anchor.heading+'\r\n')||ranges.some(([start,end])=>section.start<end&&section.end>start)||await digestText(section.markdown)!==anchor.hash)throw Error('FEEDBACK language section is stale or outside the canonical document.');
      unchanged(s);ranges.push([section.start,section.end]);sections.push({...anchor,start:section.start,end:section.end,markdown:section.markdown});
     }
     projection.push({recipientId:entry.recipientId,target:{...t},sections});
    }
   }
   const after=await readShareContext({projectId:q.projectId,outputId:q.outputId,expectedHash:q.expectedHash});unchanged(s);
   if(stable(after.rootIdentity)!==stable(context.rootIdentity)||stable(after.references.feedback.filter(r=>r.path===registered.path))!==stable(selected))throw Error('The registered FEEDBACK reference changed while opening.');
   return freeze({schema:value.schema,selection:{storyId:s.owner.storyId,pieceId:s.owner.pieceId,edition:'working'},authority:{...s.owner},rootIdentity:{...context.rootIdentity},draft:{path:d.path,hash:d.hash},feedback:{path:f.path,hash:f.hash,registeredHash:f.registeredHash,changedSinceRegistration:f.changedSinceRegistration},document:{path:doc.path,kind:'FEEDBACK',hash:doc.hash,text:doc.text},mapping:{structured:m.structured,metadata,projection,reason:m.reason},readOnly:true});
  }
  async function read({projectId}={}){
   const selected=copy(current());if(selected?.projectId!==projectId||selected?.owner?.kind!=='magazine')return null;
   const s=snapshot(selected,projectId),r=await fresh(s),p=r.publication,existingDraft=working(s,r);
   return freeze({projectId,allowNewExpression:false,outputs:[...(typeof readWorking==='function'?[{id:workingId(s),kind:'magazine-working',title:p?.title||'Current article',format:'Working article',edition:'working',status:'draft',delivery:{},workingOwner:copy(s.owner),workingHash:s.hash,followUp:'Not approved for publication.',nextAction:{kind:'native',label:'Edit words'},actions:[{kind:'review',label:'Preview'},{kind:'export',label:'Download working HTML'}]}]:[]),...(p?[{id:p.id,kind:'publication-reference',title:p.title,format:'Publication reference',language:null,edition:null,status:'not-recorded',delivery:{},publicationReference:copy(p),followUp:'Recorded in this working draft. Live contents, delivered edition and publication date have not been verified.',nextAction:{kind:'publication-reference',label:'Open recorded publication'},actions:[]}]:[])],existingDraft,emptyMessage:p?null:'No publication reference is recorded for this working part.',emptyActions:[{kind:'native',type:'magazine-working',label:'Continue writing'}],availability:{state:'ready'}});
  }
  async function readWorkingEdition(input={}){
   const q=copy(input),s=state(q.projectId);if(typeof readWorking!=='function'||q.outputId!==workingId(s)||q.expectedHash!==s.hash)throw Error('Choose this exact current working article before previewing it.');
   const r=await fresh(s),value=copy(await readWorking(freeze({storyId:s.owner.storyId,pieceId:s.owner.pieceId,expectedHash:s.hash})));unchanged(s);
   const o=value?.ownerRef,m=value?.media;if(value?.schema!=='ar-create.magazine-working-edition.v1'||!sha(value.revision)||value.revision!==m?.revision||o?.projectId!==s.owner.storyId||o.pieceId!==s.owner.pieceId||o.editionId!=='working'||o.hash!==s.hash||o.artifactId!==r.workingOwnerRef.artifactId||stable(o)!==stable(m.ownerRef)||m.schema!=='ar-create.magazine-media-inspection.v1'||!Array.isArray(m.sources)||!value.spec)throw Error('The saved working article preview belongs to different or changed work.');
   const after=await fresh(s);if(stable(after)!==stable(r))throw Error('The working article changed while its preview was read.');return freeze(value);
  }
  async function onAction(input={}){
   // Copy first so a caller cannot change identity while a fresh resolver is pending.
   const q=copy(input),s=state(q.projectId);
   const currentWorking=typeof readWorking==='function'&&q.outputId===workingId(s)&&['arrange','review','export','native'].includes(q.kind)&&(q.type===undefined||q.type==='magazine-working');
   const arrangement=currentWorking&&q.kind==='arrange';
   if(currentWorking&&['review','native','export'].includes(q.kind)&&((q.expectedHash!==undefined&&q.expectedHash!==s.hash)||(q.kind==='export'&&q.expectedHash!==s.hash)))throw Error('The working article changed. Refresh Outputs before downloading or opening it.');
   if(!(currentWorking||q.kind==='publication-reference'&&sha(q.outputId)||q.kind==='native'&&q.type==='magazine-working'&&(q.outputId===null||q.outputId===undefined)))throw Error('This action is not a Magazine publication-reference action.');
   if(q.edition!==undefined&&q.edition!==null&&q.edition!==''&&!(currentWorking&&q.edition==='working'))throw Error('No delivered edition is recorded for this reference.');
   const r=await fresh(s),w=working(s,r);let callback,payload;
   if(currentWorking&&q.kind==='review'){callback=openAudience;payload=w;}
   else if(currentWorking&&q.kind==='export'){callback=downloadWorking;payload=w;}
   else if(arrangement){callback=openArrangement;payload=w;}
   else if(q.kind==='native'){callback=openWorking;payload=w;}
   else{if(!r.publication||r.publication.id!==q.outputId)throw Error('This exact recorded publication is no longer available.');callback=openPublication;payload=freeze({...copy(w),kind:'publication-reference',publication:copy(r.publication)});}
   if(typeof callback!=='function')throw Error('This exact open action is not connected.');
   // The integrator must invoke this guard immediately before its navigation commit.
   const assertCurrent=()=>unchanged(s);assertCurrent();
   // Download owns its asynchronous preparation, fresh read and final guard.
   // Once its synchronous file action commits, no later resolver may report it failed.
   if(currentWorking&&q.kind==='export')return await callback(payload,assertCurrent);
   const result=await callback(payload,assertCurrent);assertCurrent();const after=await fresh(s);
   if(stable(after)!==stable(r))throw Error('The recorded reference changed while opening. Read its current metadata again.');
   return result;
  }
  return Object.freeze({read,onAction,readWorkingEdition,readShareContext,readShareEntry,readShareFeedback});
 }
 globalThis.createMagazineOutputAdapter=createMagazineOutputAdapter;
})();
