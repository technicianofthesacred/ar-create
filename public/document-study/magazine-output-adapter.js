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
 function createMagazineOutputAdapter({current,resolve,openWorking,openPublication,readWorking,openArrangement}={}){
  if(typeof current!=='function'||typeof resolve!=='function')throw Error('The Magazine reference reader is not connected.');
  const state=id=>snapshot(current(),id);
  const unchanged=s=>{if(stable(state(s.projectId))!==stable(s))throw Error('The selected working part changed. Read its references again.');};
  async function fresh(s){unchanged(s);const r=reference(await resolve(freeze({storyId:s.owner.storyId,pieceId:s.owner.pieceId,expectedHash:s.hash})),s);unchanged(s);return r;}
  const working=(s,r)=>freeze({kind:'magazine-working',projectId:s.projectId,owner:copy(s.owner),hash:s.hash,workingOwnerRef:copy(r.workingOwnerRef),revision:r.revision});
  const workingId=s=>'magazine-working:'+s.owner.storyId+':'+s.owner.pieceId;
  async function read({projectId}={}){
   const selected=copy(current());if(selected?.projectId!==projectId||selected?.owner?.kind!=='magazine')return null;
   const s=snapshot(selected,projectId),r=await fresh(s),p=r.publication,existingDraft=working(s,r);
   return freeze({projectId,allowNewExpression:false,outputs:[...(typeof readWorking==='function'?[{id:workingId(s),kind:'magazine-working',title:p?.title||'Current article',format:'Working article',edition:'working',status:'draft',delivery:{},workingOwner:copy(s.owner),workingHash:s.hash,followUp:'Current saved Magazine article. Previewing does not approve or publish it.',actions:[]}]:[]),...(p?[{id:p.id,kind:'publication-reference',title:p.title,format:'Publication reference',language:null,edition:null,status:'not-recorded',delivery:{},publicationReference:copy(p),followUp:'Recorded in this working draft. Live contents, delivered edition and publication date have not been verified.',nextAction:{kind:'publication-reference',label:'Open recorded publication'},actions:[]}]:[])],existingDraft,emptyMessage:p?null:'No publication reference is recorded for this working part.',emptyActions:[{kind:'native',type:'magazine-working',label:'Continue writing'}],availability:{state:'ready'}});
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
   const arrangement=typeof readWorking==='function'&&q.kind==='arrange'&&q.outputId===workingId(s);
   if(!(arrangement||q.kind==='publication-reference'&&sha(q.outputId)||q.kind==='native'&&q.type==='magazine-working'&&(q.outputId===null||q.outputId===undefined)))throw Error('This action is not a Magazine publication-reference action.');
   if(q.edition!==undefined&&q.edition!==null&&q.edition!==''&&!(arrangement&&q.edition==='working'))throw Error('No delivered edition is recorded for this reference.');
   const r=await fresh(s),w=working(s,r);let callback,payload;
   if(arrangement){callback=openArrangement;payload=w;}
   else if(q.kind==='native'){callback=openWorking;payload=w;}
   else{if(!r.publication||r.publication.id!==q.outputId)throw Error('This exact recorded publication is no longer available.');callback=openPublication;payload=freeze({...copy(w),kind:'publication-reference',publication:copy(r.publication)});}
   if(typeof callback!=='function')throw Error('This exact open action is not connected.');
   // The integrator must invoke this guard immediately before its navigation commit.
   const assertCurrent=()=>unchanged(s);assertCurrent();
   const result=await callback(payload,assertCurrent);assertCurrent();const after=await fresh(s);
   if(stable(after)!==stable(r))throw Error('The recorded reference changed while opening. Read its current metadata again.');
   return result;
  }
  return Object.freeze({read,onAction,readWorkingEdition});
 }
 globalThis.createMagazineOutputAdapter=createMagazineOutputAdapter;
})();
