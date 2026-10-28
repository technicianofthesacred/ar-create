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
 function createMagazineOutputAdapter({current,resolve,openWorking,openPublication,readWorking,readShareContext:readShare,readShareFeedback:readFeedback,readShareFeedbackEditModel:readEditModel,prepareShareFeedbackParagraph:prepareParagraph,prepareShareFeedbackMapping:prepareMapping,saveShareFeedback:saveFeedback,undoShareFeedback:undoFeedback,readShareFeedbackHistory:readFeedbackHistory,openArrangement,openAudience,downloadWorking,readExports,openExport}={}){
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
  async function digestText(value,algorithm='SHA-256'){
   if(!globalThis.crypto?.subtle||typeof TextEncoder!=='function')throw Error('Canonical FEEDBACK verification is unavailable.');
   return [...new Uint8Array(await crypto.subtle.digest(algorithm,new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function feedbackMetadata(value){
   if(value===null)return null;
   if(value?.schema!=='ar-create.magazine-feedback-share.v1'||!Array.isArray(value.entries)||value.entries.length>200||new TextEncoder().encode(JSON.stringify(value)).length>65536)throw Error('FEEDBACK recipient mapping exceeds its contract.');
   const owners=new Set(),headings=new Set();
   const entries=value.entries.map(entry=>{
    const t=entry?.target;
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(entry?.recipientId||'')||!t||!['storyId','pieceId'].every(k=>text(t[k])&&t[k].length<=256&&!/[\x00-\x1f\x7f]/.test(t[k]))||t.edition!=='working'||!sha(t.hash)||!Array.isArray(entry.sections)||!entry.sections.length||entry.sections.length>12)throw Error('FEEDBACK recipient/edition mapping is invalid.');
    if(entry.recipientName!==undefined&&(typeof entry.recipientName!=='string'||!entry.recipientName.trim()||entry.recipientName.length>200||/[\x00-\x1f\x7f]/.test(entry.recipientName)))throw Error('The saved recipient name is invalid.');
    const owner=stable([entry.recipientId.toLowerCase(),t.storyId,t.pieceId,t.hash]);if(owners.has(owner))throw Error('FEEDBACK recipient/edition mapping is ambiguous.');owners.add(owner);const languages=new Set();
    const sections=entry.sections.map(anchor=>{
     if(typeof anchor?.language!=='string'||!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(anchor.language)||typeof anchor.heading!=='string'||anchor.heading.length>512||!/^#{1,6} [^\r\n]+$/.test(anchor.heading)||!sha(anchor.hash)||languages.has(anchor.language.toLowerCase())||headings.has(anchor.heading))throw Error('FEEDBACK language section mapping is invalid or ambiguous.');
     languages.add(anchor.language.toLowerCase());headings.add(anchor.heading);return {language:anchor.language,heading:anchor.heading,hash:anchor.hash};
    });
    return {recipientId:entry.recipientId,...entry.recipientName!==undefined?{recipientName:entry.recipientName}:{},target:{storyId:t.storyId,pieceId:t.pieceId,edition:'working',hash:t.hash},sections};
   });
   const metadata={schema:value.schema,entries};
   if(value.invitations!==undefined){
    const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)),id=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v),target=t=>exact(t,['storyId','pieceId','edition','hash'])&&['storyId','pieceId'].every(k=>typeof t[k]==='string'&&t[k]&&t[k].length<=256)&&t.edition==='working'&&sha(t.hash),words=v=>typeof v==='string'&&v.trim()&&v.length<=8000&&v.isWellFormed()&&!v.includes('\0'),ids=new Set(),facts=new Set();
    if(!Array.isArray(value.invitations)||value.invitations.length>100)throw Error('Saved invitation records exceed their contract.');
    for(const i of value.invitations){if(!(exact(i,['id','recipientId','recipientName','target','sections','facts'])||exact(i,['id','recipientId','recipientName','target','sections','facts','messageRecordHash']))||i.messageRecordHash!==undefined&&!sha(i.messageRecordHash)||!id(i.id)||ids.has(i.id)||!target(i.target)||!Array.isArray(i.sections)||i.sections.length>12||!Array.isArray(i.facts)||i.facts.length>100)throw Error('Invalid saved invitation.');ids.add(i.id);if(i.recipientId==='none'){if(i.recipientName!==null||i.sections.length)throw Error('Invalid no-recipient invitation.');}else if(!id(i.recipientId)||typeof i.recipientName!=='string'||!i.recipientName.trim()||i.recipientName.length>200||!i.sections.length||i.sections.some(a=>!exact(a,['language','heading','hash'])||typeof a.language!=='string'||!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(a.language)||typeof a.heading!=='string'||!/^#{1,6} [^\r\n]+$/.test(a.heading)||!sha(a.hash)))throw Error('Invalid invitation recipient snapshot.');
     for(const f of i.facts){if(!id(f?.id)||facts.has(f.id)||f.recordedBy!=='human')throw Error('Invalid correspondence fact.');facts.add(f.id);if(f.kind==='sent'){if(i.recipientId==='none'||!exact(f,['id','kind','recordedBy','sentAt','channel'])||!words(f.sentAt)||!words(f.channel))throw Error('Invalid actual sending fact.');}else if(f.kind==='reply'){if(i.recipientId==='none'||!exact(f,['id','kind','recordedBy','receivedAt','original','translation','correction'])||!words(f.original)||f.receivedAt!==null&&!words(f.receivedAt)||f.translation!==null&&!words(f.translation)||f.correction!==null&&(!exact(f.correction,['text','affected'])||!words(f.correction.text)||!target(f.correction.affected)))throw Error('Invalid reply fact.');}else if(!['closed','not-applicable'].includes(f.kind)||!exact(f,['id','kind','recordedBy','reason'])||!words(f.reason))throw Error('Invalid closing fact.');}
    }
    metadata.invitations=copy(value.invitations);
   }
   return metadata;
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
     if(t.storyId!==s.owner.storyId||t.pieceId!==s.owner.pieceId||t.hash!==s.hash||p?.recipientId!==entry.recipientId||p.recipientName!==entry.recipientName||stable(p.target)!==stable(t)||!Array.isArray(p.sections)||p.sections.length!==entry.sections.length)throw Error('FEEDBACK projection belongs to another recipient, piece or revision.');
     const sections=[];
     for(let j=0;j<entry.sections.length;j++){
      const anchor=entry.sections[j],section=p.sections[j];
      if(!section||section.language!==anchor.language||section.heading!==anchor.heading||section.hash!==anchor.hash||!Number.isSafeInteger(section.start)||!Number.isSafeInteger(section.end)||section.start<0||section.end<=section.start||section.end>doc.text.length||typeof section.markdown!=='string'||section.markdown!==doc.text.slice(section.start,section.end)||!section.markdown.startsWith(anchor.heading+'\n')&&!section.markdown.startsWith(anchor.heading+'\r\n')||ranges.some(([start,end])=>section.start<end&&section.end>start)||await digestText(section.markdown)!==anchor.hash)throw Error('FEEDBACK language section is stale or outside the canonical document.');
      unchanged(s);ranges.push([section.start,section.end]);sections.push({...anchor,start:section.start,end:section.end,markdown:section.markdown});
     }
     projection.push({recipientId:entry.recipientId,...entry.recipientName!==undefined?{recipientName:entry.recipientName}:{},target:{...t},sections});
    }
   }
   const after=await readShareContext({projectId:q.projectId,outputId:q.outputId,expectedHash:q.expectedHash});unchanged(s);
   if(stable(after.rootIdentity)!==stable(context.rootIdentity)||stable(after.references.feedback.filter(r=>r.path===registered.path))!==stable(selected))throw Error('The registered FEEDBACK reference changed while opening.');
   return freeze({schema:value.schema,selection:{storyId:s.owner.storyId,pieceId:s.owner.pieceId,edition:'working'},authority:{...s.owner},rootIdentity:{...context.rootIdentity},draft:{path:d.path,hash:d.hash},feedback:{path:f.path,hash:f.hash,registeredHash:f.registeredHash,changedSinceRegistration:f.changedSinceRegistration},document:{path:doc.path,kind:'FEEDBACK',hash:doc.hash,text:doc.text},mapping:{structured:m.structured,metadata,projection,reason:m.reason,targetState:metadata?(metadata.entries.every(e=>e.target.storyId===s.owner.storyId&&e.target.pieceId===s.owner.pieceId&&e.target.hash===s.hash)?'current':'mismatch'):'unverified',invitations:(metadata?.invitations||[]).map(i=>({...copy(i),workingChanged:i.target.storyId!==s.owner.storyId||i.target.pieceId!==s.owner.pieceId||i.target.hash!==s.hash,messageChanged:i.sections.some(a=>!metadata.entries.some(e=>e.sections.some(section=>section.heading===a.heading&&section.hash===a.hash)))})),publishedReadiness:{available:false,reason:'An immutable published-edition reader is not connected. A recorded publication URL is not edition proof.'}},readOnly:true});
  }
  const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
  function feedbackSelection(q,s){
   if(q.outputId!==workingId(s)||q.expectedHash!==s.hash||!feedbackPath(q.registeredFeedbackPath)||!sha(q.expectedFeedbackHash))throw Error('Choose this exact feedback record and article before editing.');
   return {storyId:s.owner.storyId,pieceId:s.owner.pieceId,edition:'working',expectedHash:s.hash,registeredFeedbackPath:q.registeredFeedbackPath,expectedFeedbackHash:q.expectedFeedbackHash};
  }
  async function readShareFeedbackEditModel(input={}){
   const q=copy(input),s=state(q.projectId),request=feedbackSelection(q,s);
   if(typeof readEditModel!=='function')throw Error('The correspondence paragraph editor is not connected.');
   const base=await readShareFeedback(q),value=copy(await readEditModel(freeze(request)));unchanged(s);
   if(value?.schema!=='ar-create.magazine-share-feedback-edit-model.v1'||value.readOnly!==true||['selection','rootIdentity','draft','feedback','document'].some(key=>stable(value[key])!==stable(base[key]))||typeof value.editable!=='boolean'||!(value.editable?value.unavailableReason===null:typeof value.unavailableReason==='string')||!Array.isArray(value.paragraphs)||value.paragraphs.length>5000)throw Error('The correspondence editor returned different or unavailable saved words.');
   const body=base.document.text.replace(/^---\n[\s\S]*?\n---\n/,''),parts=body.split(/(\n\s*\n)/),paragraphs=[];
   if(value.paragraphs.length!==Math.ceil(parts.length/2))throw Error('The saved paragraph positions changed.');
   for(let i=0;i<value.paragraphs.length;i++){
    const row=value.paragraphs[i];
    if(row?.index!==i||row.raw!==parts[i*2]||typeof row.text!=='string'||typeof row.editable!=='boolean'||typeof row.seen!=='string'||row.seen!==(await digestText(row.raw,'SHA-1')).slice(0,12))throw Error('The saved paragraph words or identity changed.');
    paragraphs.push({index:i,seen:row.seen,text:row.text,raw:row.raw,editable:row.editable});
   }
   const mappingSections=[];if(value.mappingSections!==undefined){if(!Array.isArray(value.mappingSections)||value.mappingSections.length>5000)throw Error('Correspondence section choices exceed their limit.');const seen=new Set();for(const row of value.mappingSections){if(typeof row?.heading!=='string'||!/^#{1,6} [^\r\n]+$/.test(row.heading)||!sha(row.hash)||!Number.isSafeInteger(row.start)||!Number.isSafeInteger(row.end)||row.start<0||row.end<=row.start||row.end>base.document.text.length||seen.has(row.heading)||!base.document.text.slice(row.start,row.end).startsWith(row.heading+'\n')&&!base.document.text.slice(row.start,row.end).startsWith(row.heading+'\r\n')||await digestText(base.document.text.slice(row.start,row.end))!==row.hash)throw Error('A correspondence section choice changed.');seen.add(row.heading);mappingSections.push({heading:row.heading,hash:row.hash,start:row.start,end:row.end});}}
   unchanged(s);return freeze({...base,schema:value.schema,editable:value.editable,unavailableReason:value.unavailableReason,paragraphs,mappingSections});
  }
  async function prepareShareFeedbackParagraph(input={}){
   const q=copy(input),s=state(q.projectId),request=feedbackSelection(q,s),model=await readShareFeedbackEditModel(q);unchanged(s);
   const row=model.paragraphs.find(row=>row.index===q.block);
   if(typeof prepareParagraph!=='function'||!model.editable||!row?.editable||row.seen!==q.seen||typeof q.text!=='string'||q.rootFingerprint!==undefined&&q.rootFingerprint!==model.rootIdentity.fingerprint)throw Error('This paragraph is unavailable or changed. Keep your words and compare the saved record.');
   const value=copy(await prepareParagraph(freeze({...request,block:q.block,seen:q.seen,text:q.text})));unchanged(s);
   if(value?.expectedHash!==q.expectedHash||value.expectedFeedbackHash!==q.expectedFeedbackHash||value.registeredFeedbackPath!==q.registeredFeedbackPath||stable(value.selection)!==stable(model.selection)||stable(value.rootIdentity)!==stable(model.rootIdentity)||value.authority?.storyId!==s.owner.storyId||value.authority.pieceId!==s.owner.pieceId||typeof value.content!=='string'||!value.content.isWellFormed()||value.content.includes('\0')||new TextEncoder().encode(value.content).length>2097152)throw Error('Paragraph preparation returned different or unavailable words.');
   return freeze({selection:copy(model.selection),rootIdentity:copy(model.rootIdentity),expectedHash:q.expectedHash,expectedFeedbackHash:q.expectedFeedbackHash,registeredFeedbackPath:q.registeredFeedbackPath,content:value.content});
  }
  async function prepareShareFeedbackMapping(input={}){
   const q=copy(input),s=state(q.projectId),request=feedbackSelection(q,s),model=await readShareFeedbackEditModel(q);unchanged(s);
   if(q.invitationChange!==undefined){
    if(typeof prepareMapping!=='function'||!model.editable||q.rootFingerprint!==model.rootIdentity.fingerprint||['recipientId','recipientName','sections'].some(k=>q[k]!==undefined))throw Error('Resolve the current correspondence before recording a fact.');
    const change=q.invitationChange,before=model.mapping.metadata,expected=copy(before)||(change.kind==='new'&&change.recipientId==='none'?{schema:'ar-create.magazine-feedback-share.v1',entries:[]}:null);if(!expected)throw Error('Map an explicit recipient first.');expected.invitations||=[];
    if(change.kind==='new'){if(!uuid(change.id)||!(uuid(change.recipientId)||change.recipientId==='none'))throw Error('Choose an explicit invitation recipient.');const e=expected.entries.find(e=>e.recipientId===change.recipientId);if(change.recipientId!=='none'&&!e?.recipientName)throw Error('Name this recipient first.');expected.invitations.push({id:change.id,messageRecordHash:q.expectedFeedbackHash,recipientId:change.recipientId,recipientName:e?.recipientName||null,target:{storyId:s.owner.storyId,pieceId:s.owner.pieceId,edition:'working',hash:s.hash},sections:e?copy(e.sections):[],facts:[]});}
    else if(change.kind==='fact'){const i=expected.invitations.find(i=>i.id===change.invitationId);if(!i)throw Error('Choose a saved invitation.');i.facts.push(copy(change.fact));}else throw Error('Unsupported invitation action.');
    feedbackMetadata(expected);
    const value=copy(await prepareMapping(freeze({...request,invitationChange:copy(change)})));unchanged(s);
    if(value?.expectedHash!==q.expectedHash||value.expectedFeedbackHash!==q.expectedFeedbackHash||value.registeredFeedbackPath!==q.registeredFeedbackPath||stable(value.selection)!==stable(model.selection)||stable(value.rootIdentity)!==stable(model.rootIdentity)||stable(feedbackMetadata(value.mapping?.metadata))!==stable(expected)||typeof value.content!=='string')throw Error('Invitation preparation changed its exact owner or frozen facts.');
    const strip=t=>t.replace(/^ar-create-share: .*\r?\n/m,''),body=model.document.text.startsWith('---\n')||model.document.text.startsWith('---\r\n')?strip(value.content):value.content.replace(/^---\r?\nar-create-share: [^\r\n]*\r?\n---\r?\n/,'');if(body!==strip(model.document.text))throw Error('Invitation preparation changed correspondence words.');
    const line=value.content.match(/^ar-create-share: (.*)$/m);if(!line||stable(JSON.parse(line[1]))!==stable(expected))throw Error('Invitation metadata differs from canonical Markdown.');
    return freeze({selection:copy(model.selection),rootIdentity:copy(model.rootIdentity),expectedHash:q.expectedHash,expectedFeedbackHash:q.expectedFeedbackHash,registeredFeedbackPath:q.registeredFeedbackPath,content:value.content});
   }
   if(typeof prepareMapping!=='function'||!model.editable||!uuid(q.recipientId)||typeof q.recipientName!=='string'||!q.recipientName.trim()||q.recipientName.length>200||/[\x00-\x1f\x7f]/.test(q.recipientName)||!Array.isArray(q.sections)||!q.sections.length||q.sections.length>12||q.rootFingerprint!==model.rootIdentity.fingerprint)throw Error('Choose a named recipient and exact language sections.');
   const languages=new Set(),headings=new Set(),sections=q.sections.map(row=>{const offered=model.mappingSections.find(choice=>choice.heading===row.heading&&choice.hash===row.hash);if(!offered||typeof row.language!=='string'||!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(row.language)||languages.has(row.language.toLowerCase())||headings.has(row.heading))throw Error('Choose each exact section and language once.');languages.add(row.language.toLowerCase());headings.add(row.heading);return {heading:row.heading,hash:row.hash,language:row.language};});
   const value=copy(await prepareMapping(freeze({...request,recipientId:q.recipientId,recipientName:q.recipientName,sections})));unchanged(s);
   if(value?.expectedHash!==q.expectedHash||value.expectedFeedbackHash!==q.expectedFeedbackHash||value.registeredFeedbackPath!==q.registeredFeedbackPath||stable(value.selection)!==stable(model.selection)||stable(value.rootIdentity)!==stable(model.rootIdentity)||value.authority?.storyId!==s.owner.storyId||value.authority.pieceId!==s.owner.pieceId||typeof value.content!=='string'||new TextEncoder().encode(value.content).length>2097152||!value.content.isWellFormed()||value.content.includes('\0')||value.mapping?.structured!==true)throw Error('Recipient preparation returned another owner or unavailable mapping.');
   const before=model.document.text,header=before.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0],strip=text=>text.replace(/^(---\r?\n[\s\S]*?)(?=---(?:\r?\n|$))/,fm=>fm.replace(/^ar-create-share: .*\r?\n/m,''));
   if(header?strip(value.content)!==strip(before):value.content.replace(/^---\r?\nar-create-share: [^\r\n]*\r?\n---\r?\n/,'')!==before)throw Error('Recipient preparation changed message words or unrelated metadata.');
   const metadata=feedbackMetadata(value.mapping.metadata),front=value.content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1],line=front?.split(/\r?\n/).filter(row=>row.startsWith('ar-create-share: '));if(line?.length!==1||stable(JSON.parse(line[0].slice(17)))!==stable(metadata))throw Error('Prepared recipient metadata is not canonical.');
   const entry=metadata.entries.find(row=>row.recipientId===q.recipientId&&row.target.storyId===s.owner.storyId&&row.target.pieceId===s.owner.pieceId&&row.target.hash===s.hash);if(!entry||entry.recipientName!==q.recipientName||stable(entry.sections)!==stable(sections)||metadata.entries.some(row=>row.target.storyId!==s.owner.storyId||row.target.pieceId!==s.owner.pieceId||row.target.hash!==s.hash))throw Error('Prepared recipient selection changed.');
   if(stable(metadata.invitations||[])!==stable(model.mapping.metadata?.invitations||[]))throw Error('Recipient preparation changed saved invitation facts.');
   const other=rows=>rows.filter(row=>row.recipientId!==q.recipientId);if(stable(other(metadata.entries))!==stable(other(model.mapping.metadata?.entries||[])))throw Error('Recipient preparation changed another saved mapping.');
   return freeze({selection:copy(model.selection),rootIdentity:copy(model.rootIdentity),expectedHash:q.expectedHash,expectedFeedbackHash:q.expectedFeedbackHash,registeredFeedbackPath:q.registeredFeedbackPath,content:value.content});
  }
  async function feedbackCommand(action,input={}){
   const q=copy(input),s=state(q.projectId),request=feedbackSelection(q,s),context=await readShareContext({projectId:q.projectId,outputId:q.outputId,expectedHash:q.expectedHash});unchanged(s);
   const refs=context.references.feedback.filter(ref=>ref.path===q.registeredFeedbackPath);
   if(!uuid(q.operationId)||q.rootFingerprint!==context.rootIdentity.fingerprint||refs.length!==1||!refs[0].readable)throw Error('This exact feedback operation or root changed. Keep the unsaved copy.');
   let payload,callback;
   if(action==='save'){
    if(typeof q.content!=='string'||!q.content.isWellFormed()||q.content.includes('\0')||new TextEncoder().encode(q.content).length>2097152)throw Error('Keep bounded readable correspondence.');
    payload={...request,content:q.content,operationId:q.operationId};callback=saveFeedback;
   }else{if(!uuid(q.undoOperationId))throw Error('Choose an exact saved correspondence change to undo.');payload={...request,operationId:q.operationId,undoOperationId:q.undoOperationId};callback=undoFeedback;}
   if(typeof callback!=='function')throw Error('This correspondence action is not connected.');
   const value=copy(await callback(freeze(payload)));unchanged(s);
   if(value?.operationId!==q.operationId||(action==='save'?value.written!==true||value.path!==q.registeredFeedbackPath||value.beforeHash!==q.expectedFeedbackHash||value.hash!==await digestText(q.content):value.undone!==q.undoOperationId))throw Error(value?.proposed?'These words are a proposal awaiting the author’s decision.':'The correspondence action did not confirm the exact saved operation.');
   unchanged(s);return freeze(value);
  }
  const saveShareFeedback=input=>feedbackCommand('save',input),undoShareFeedback=input=>feedbackCommand('undo',input);
  async function shareFeedbackHistory(input={}){
   const q=copy(input),s=state(q.projectId),request=feedbackSelection(q,s);if(typeof readFeedbackHistory!=='function')throw Error('Saved correspondence history is unavailable.');
   if(q.invitationId!==undefined){
    if(!uuid(q.invitationId))throw Error('Choose one exact invitation.');const base=await readShareFeedback(q),invitation=base.mapping.metadata?.invitations?.find(i=>i.id===q.invitationId);if(!invitation)throw Error('That invitation is unavailable in this exact record.');
    const value=copy(await readFeedbackHistory(freeze({...request,invitationId:q.invitationId})));unchanged(s);
    const valid=value?.schema==='ar-create.magazine-invitation-message.v1'&&value.invitationId===invitation.id&&value.messageRecordHash===(invitation.messageRecordHash||null)&&stable(value.target)===stable(invitation.target)&&stable(value.selection)===stable(base.selection)&&stable(value.rootIdentity)===stable(base.rootIdentity)&&value.registeredFeedbackPath===q.registeredFeedbackPath&&value.expectedHash===q.expectedHash&&value.expectedFeedbackHash===q.expectedFeedbackHash&&typeof value.available==='boolean'&&Array.isArray(value.sections)&&value.sections.length<=12&&(value.available?value.reason===null&&value.sections.length===invitation.sections.length:typeof value.reason==='string'&&value.reason.length>0&&value.reason.length<=2048&&value.sections.length===0);
    if(!valid)throw Error('The original invitation returned another owner or unavailable proof.');let total=0;const sections=[];
    for(let i=0;i<value.sections.length;i++){const row=value.sections[i],anchor=invitation.sections[i];if(row?.language!==anchor.language||row.heading!==anchor.heading||row.hash!==anchor.hash||typeof row.markdown!=='string'||!row.markdown.startsWith(row.heading+'\n')&&!row.markdown.startsWith(row.heading+'\r\n')||await digestText(row.markdown)!==row.hash)throw Error('The invitation-time words do not match their frozen section hashes.');total+=new TextEncoder().encode(row.markdown).length;if(total>262144)throw Error('The selected original invitation exceeds its reading limit.');sections.push({language:row.language,heading:row.heading,hash:row.hash,markdown:row.markdown});}
    return freeze({schema:value.schema,invitationId:invitation.id,messageRecordHash:value.messageRecordHash,target:copy(invitation.target),available:value.available,reason:value.reason,sections});
   }
   await readShareFeedback(q);const value=copy(await readFeedbackHistory(freeze(request)));unchanged(s);
   if(!Array.isArray(value?.history)||value.history.length>200)throw Error('The saved correspondence history is invalid.');
   const history=value.history.map(row=>{if(!uuid(row.operationId)||!sha(row.beforeHash)||!sha(row.afterHash)||typeof row.modifiedAt!=='string'||typeof row.actor!=='string'||typeof row.canUndo!=='boolean')throw Error('A saved correspondence receipt is invalid.');return {operationId:row.operationId,modifiedAt:row.modifiedAt,actor:row.actor,beforeHash:row.beforeHash,afterHash:row.afterHash,canUndo:row.canUndo};});return freeze({history});
  }
  async function exportReceipts(s,r){
   if(typeof readExports!=='function')return [];
   const value=copy(await readExports(freeze({storyId:s.owner.storyId,pieceId:s.owner.pieceId,expectedHash:s.hash})));unchanged(s);
   if(!Array.isArray(value?.artifacts)||value.artifacts.length>4096)throw Error('Saved export receipts are unavailable.');
   const current=value.artifacts.length&&typeof readWorking==='function'?await readWorking({storyId:s.owner.storyId,pieceId:s.owner.pieceId,expectedHash:s.hash}):null;unchanged(s);
   return value.artifacts.map(a=>{const b=a?.sourceBinding,o=b?.owner;let u;try{u=new URL(a.url,'http://local');}catch{}
    if(!uuid(a?.id)||a.exportKind!=='magazine-working-html'||a.mimeType!=='text/html'||a.deliveryState!=='created'||!sha(a.hash)||!sha(b?.sourceHash)||!sha(b.renderRevision)||o?.kind!=='magazine'||o.storyId!==s.owner.storyId||o.pieceId!==s.owner.pieceId||o.path!==s.owner.path||!sha(o.rootFingerprint)||typeof a.name!=='string'||!Number.isSafeInteger(a.sizeBytes)||a.sizeBytes<1||typeof a.createdAt!=='string'||!u||u.origin!=='http://local'||u.pathname!=='/api/magazine/working-draft/export-file'||u.searchParams.get('storyId')!==s.owner.storyId||u.searchParams.get('pieceId')!==s.owner.pieceId||u.searchParams.get('expectedHash')!==b.sourceHash||u.searchParams.get('exportId')!==a.id)throw Error('An export receipt belongs to different or unavailable work.');
    return {...a,stale:b.sourceHash!==s.hash||current?.revision!==b.renderRevision};
   });
  }
  async function read({projectId}={}){
   const selected=copy(current());if(selected?.projectId!==projectId||selected?.owner?.kind!=='magazine')return null;
   const s=snapshot(selected,projectId),r=await fresh(s),p=r.publication,existingDraft=working(s,r),receipts=await exportReceipts(s,r),latest=receipts.find(a=>!a.stale);
   return freeze({projectId,allowNewExpression:false,outputs:[...(typeof readWorking==='function'?[{id:workingId(s),kind:'magazine-working',title:p?.title||'Current article',format:'Working article',edition:'working',status:'draft',delivery:latest?{exported:{fileId:latest.id,label:'Saved working HTML',date:latest.createdAt,version:'working',hash:latest.hash,url:latest.url}}:{},exportReceipts:receipts,workingOwner:copy(s.owner),workingHash:s.hash,followUp:receipts.length?(latest?'Working HTML saved. Download requests do not verify delivery or publication.':'Earlier working HTML retained; the article or its assets have changed. No current export recorded.'):'Not approved for publication.',nextAction:{kind:'native',label:'Edit words'},actions:[{kind:'review',label:'Preview'},{kind:'export',label:'Download working HTML'}]}]:[]),...(p?[{id:p.id,kind:'publication-reference',title:p.title,format:'Publication reference',language:null,edition:null,status:'not-recorded',delivery:{},publicationReference:copy(p),followUp:'Recorded in this working draft. Live contents, delivered edition and publication date have not been verified.',nextAction:{kind:'publication-reference',label:'Open recorded publication'},actions:[]}]:[])],existingDraft,emptyMessage:p?null:'No publication reference is recorded for this working part.',emptyActions:[{kind:'native',type:'magazine-working',label:'Continue writing'}],availability:{state:'ready'}});
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
   if(currentWorking&&q.kind==='export'&&q.export?.fileId){const receipts=await exportReceipts(s,r),artifact=receipts.find(a=>a.id===q.export.fileId);if(!artifact||typeof openExport!=='function')throw Error('This saved article export is unavailable.');unchanged(s);return openExport(freeze(artifact),()=>unchanged(s));}
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
  return Object.freeze({read,onAction,readWorkingEdition,readShareContext,readShareEntry,readShareFeedback,readShareFeedbackEditModel,prepareShareFeedbackParagraph,prepareShareFeedbackMapping,saveShareFeedback,undoShareFeedback,shareFeedbackHistory});
 }
 globalThis.createMagazineOutputAdapter=createMagazineOutputAdapter;
})();
