// Pure planning only: consumes the maintained read-only inspection and current
// guarded owner projection. The existing native writer alone applies operations.
import {splitPhotoAnnotation,photoDirectiveComplete,validatePhotoAnnotation} from './magazine-annotations.mjs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=500;
function refuse(code,message){throw Object.assign(new Error(message),{name:'MagazinePlacementPlanError',code,status:409});}
const sameOwner=(a,b)=>a?.projectId===b.projectId&&a.pieceId===b.pieceId&&a.editionId===b.editionId&&a.artifactId===b.artifactId&&a.hash===b.hash;
const roles={photo:['cover','opener','wide','bleed'],photos:['photos'],side:['side'],'on-photo':['on-photo'],saying:['ending']};
const simple=group=>['wide','bleed','photos'].includes(group.origin.role)&&['photo','photos'].includes(group.origin.kind)&&photoDirectiveComplete(group.raw,group.origin)&&group.placements.every(p=>!p.structuralPath.startsWith('ending/'));
/** Returns existing native move operations, never new manuscript/layout data.
 * Request revision must come from this exact inspection; working is the current
 * owner resolver result, not browser-supplied projection or occurrence metadata.
 * Cover/opener/ending/side/on-photo arrangements retain their specialized owner.
 */
function placementContext({inspection,working,request}={},mode='move') {
 const keys=['storyId','pieceId','expectedHash','revision','placementId',...(mode==='annotation'?['annotation']:mode==='description'?['description']:mode==='focus'?['x','y']:mode==='aspect'?['aspect']:mode==='replace'?['replacementPlacementId','sourceId','sourceHash']:mode==='library'?['assetRootId','assetSourceId','assetRevision','assetHash','description']:['beforeId'])];
 if(!object(request)||Object.keys(request).length!==keys.length||Object.keys(request).some(k=>!keys.includes(k))||!keys.filter(k=>!['x','y','description','annotation'].includes(k)).every(k=>identity(request[k]))||mode==='focus'&&![request.x,request.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||mode==='aspect'&&!['4/3','4/5','1/1'].includes(request.aspect)||!['expectedHash','revision','placementId'].every(k=>HEX.test(request[k]))) refuse('invalid-request','Choose a current photo and an existing destination.');
 const {storyId,pieceId,expectedHash,revision,placementId,beforeId}=request;
 const {document,authority,target,projection}=working||{};
 if(authority?.kind!=='magazine'||authority.storyId!==storyId||authority.pieceId!==pieceId||typeof document?.text!=='string'||Buffer.byteLength(document.text)>2*1024*1024||document.hash!==expectedHash||sha(document.text)!==expectedHash||target?.hash!==expectedHash||!identity(target?.artifactId)||!identity(target?.nativeProjectId)) refuse('stale-owner','This working draft changed. Reopen it before moving a photo.');
 const ownerRef={projectId:storyId,pieceId,editionId:'working',artifactId:target.artifactId,hash:expectedHash};
 if(inspection?.schema!=='ar-create.magazine-media-inspection.v1'||inspection.revision!==revision||!HEX.test(inspection.scope)||!sameOwner(inspection.ownerRef,ownerRef)||inspection.originTrace?.status!=='ready'||inspection.originTrace.offsetUnit!=='utf16') refuse('stale-inspection','Refresh this draft’s photo positions before moving a photo.');
 const text=document.text;
 if(!Array.isArray(projection)||!projection.length||projection.length>4096) refuse('invalid-projection','The current draft structure is unavailable. Reopen the draft.');
 const rows=new Map();let previousEnd=(text.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)||[''])[0].length;
 for(const [index,row] of projection.entries()) {
  const origin=row?.origin;
  if(!object(row)||row.id!=='magazine:'+encodeURIComponent(pieceId)+':'+index||rows.has(row.id)||typeof row.raw!=='string'||!row.raw||!origin||origin.fileHash!==expectedHash||!HEX.test(row.blockHash)||origin.blockHash!==row.blockHash||sha(row.raw)!==row.blockHash||!integer(origin.offset)||origin.offset<previousEnd||text.slice(origin.offset,origin.offset+row.raw.length)!==row.raw||(index===0?origin.offset!==previousEnd:!/^\r?\n\s*\r?\n$/.test(text.slice(previousEnd,origin.offset)))) refuse('invalid-projection','The draft structure changed. Reopen it before moving a photo.');
  rows.set(row.id,{...row,index});previousEnd=origin.offset+row.raw.length;
 }
 if(previousEnd!==text.length) refuse('invalid-projection','The current draft structure is incomplete. Reopen the draft.');
 if(!Array.isArray(inspection.sources)||inspection.sources.length>256) refuse('invalid-origins','Photo position evidence is unavailable.');
 const placements=new Map(),groups=new Map();
 for(const source of inspection.sources) {
  if(!sameOwner(source?.ownerRef,ownerRef)||!Array.isArray(source.placements)||source.placements.length>256) refuse('invalid-origins','Photo position evidence changed. Refresh the photos.');
  for(const p of source.placements) {
   const o=p?.nativeOrigin,row=rows.get(o?.blockId);
   if(!HEX.test(p?.placementId)||placements.has(p.placementId)||p.projectId!==storyId||p.pieceId!==pieceId||p.outputId!==pieceId||p.editionId!=='working'||p.hash!==expectedHash||typeof p.structuralPath!=='string'||!row||row.safe!==false||o.fileHash!==expectedHash||o.blockHash!==row.blockHash||o.blockOffset!==row.origin.offset||o.offsetUnit!=='utf16'||!Object.hasOwn(roles,o.kind)||!roles[o.kind].includes(o.role)||!['chunkStart','chunkEnd','directiveStart','directiveEnd','groupIndex','groupSize','depth'].every(k=>integer(o[k]))||o.groupSize<1||o.groupSize>256||o.groupIndex>=o.groupSize||o.depth>8) refuse('invalid-origins','An exact photo position could not be verified. Refresh the photos.');
   const trimmed=row.raw.trim(),start=row.origin.offset+row.raw.indexOf(trimmed);
   if(o.chunkStart!==start||o.chunkEnd!==start+trimmed.length||o.directiveStart!==o.chunkStart||o.directiveEnd<=o.directiveStart||o.directiveEnd>o.chunkEnd||!text.slice(o.directiveStart,o.directiveEnd).startsWith('%%'+o.kind+':')||!text.slice(o.directiveStart,o.directiveEnd).endsWith('%%')) refuse('invalid-origins','A photo’s exact draft position changed. Refresh the photos.');
   let group=groups.get(row.id);
   if(!group){group={origin:o,raw:row.raw,placements:[],indexes:new Set()};groups.set(row.id,group);}
   if(['fileHash','blockHash','blockOffset','chunkStart','chunkEnd','directiveStart','directiveEnd','kind','role','groupSize','depth','offsetUnit'].some(k=>group.origin[k]!==o[k])||group.indexes.has(o.groupIndex)) refuse('invalid-origins','The whole photo group could not be verified. Refresh the photos.');
   group.indexes.add(o.groupIndex);group.placements.push(p);placements.set(p.placementId,{placement:p,group,row});
   if(placements.size>256) refuse('invalid-origins','Too many photo positions were returned.');
  }
 }
 if(placements.size!==inspection.originTrace.occurrences||groups.size!==inspection.originTrace.blocks||[...groups.values()].some(g=>g.indexes.size!==g.origin.groupSize)) refuse('invalid-origins','The photo positions are incomplete. Refresh the photos.');
 const selected=placements.get(placementId),destination=rows.get(beforeId);
 if(!selected) refuse('unknown-placement','This photo is no longer in the selected draft.');
 if(mode!=='move')return {selected,placements,ownerRef,expectedHash,revision,scope:inspection.scope};
 if(!simple(selected.group)) refuse('unsupported-placement','This photo belongs to a cover, opener, ending or composed layout. Its arrangement needs its existing layout tools.');
 if(!destination) refuse('unknown-destination','Choose an existing position in this draft.');
 const source=selected.row;
 if(source.id===destination.id||source.index+1===destination.index) refuse('unchanged-position','The photo group is already at that position.');
 // The maintained parser owns the DEV envelope. Validate its original third and
 // fourth separator spans; never permit metadata or retained notes as anchors.
 const boundaries=[...text.matchAll(/^---[ \t]*$/gm)];
 if(boundaries.length<3) refuse('invalid-body','The original draft body could not be located.');
 const bodyStart=boundaries[2].index+boundaries[2][0].length,bodyEnd=boundaries[3]?.index??text.length;
 for(const row of [source,destination]) if(row.origin.offset<bodyStart||row.origin.offset+row.raw.length>bodyEnd) refuse('outside-body','Move photos only within this draft’s article body.');
 // A simple photo does not alter text or parser state. Headings and every other
 // layout/directive block are boundaries; this also preserves existing nested
 // side/glyph containers, opener adjacency and closing/saying ownership.
 const lo=Math.min(source.index,destination.index),hi=Math.max(source.index,destination.index);
 for(let i=lo;i<=hi;i++) {
  const row=projection[i],raw=row.raw.trim(),group=groups.get(row.id);
  if(/^#{1,6}\s/.test(raw)||raw.includes('%%')&&!(group&&simple(group))) refuse('layout-boundary','Keep this photo within its current section and layout.');
 }
 const placementIds=Object.freeze([...selected.group.placements].sort((a,b)=>a.nativeOrigin.groupIndex-b.nativeOrigin.groupIndex).map(p=>p.placementId));
 const operations=Object.freeze([Object.freeze({kind:'move',id:source.id,beforeId:destination.id})]);
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope:inspection.scope,placementIds,operations});
}

export function planMagazinePlacementMove(input){return placementContext(input);}
export function planMagazinePlacementDescription(input){
 if(!input?.working?.supportedNativeOperations?.includes('photoDescription'))refuse('unsupported-owner','This working editor does not support photo description yet.');
 if(typeof input.request?.description!=='string'||input.request.description.length>2000||!input.request.description.isWellFormed()||input.request.description!==input.request.description.trim()||/[\x00-\x1f\x7f%]/.test(input.request.description)||input.request.description.includes(' · '))refuse('invalid-description','Use a one-line description without native separators.');
 const {selected,ownerRef,expectedHash,revision,scope}=placementContext(input,'description'),o=selected.group.origin,p=selected.placement;
 if(o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||!photoDirectiveComplete(selected.row.raw,o)||p.structuralPath.startsWith('ending/'))refuse('unsupported-placement','Edit the description of a standalone article photo.');
 if(p.alt===input.request.description)refuse('unchanged-description','Choose a different photo description before saving.');
 const operations=Object.freeze([Object.freeze({kind:'photoDescription',id:selected.row.id,seenBlockHash:selected.row.blockHash,description:input.request.description})]);
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope,placementIds:Object.freeze([p.placementId]),operations});
}
export function planMagazinePlacementFocus(input){
 if(!input?.working?.supportedNativeOperations?.includes('photoFocus'))refuse('unsupported-owner','This working editor does not support photo focus yet.');
 const {selected,ownerRef,expectedHash,revision,scope}=placementContext(input,'focus'),o=selected.group.origin,p=selected.placement;
 if(o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||!photoDirectiveComplete(selected.row.raw,o)||p.structuralPath.startsWith('ending/'))refuse('unsupported-placement','Adjust the focus of a standalone article photo.');
 if((p.crop?.x??0.5)===input.request.x&&(p.crop?.y??0.5)===input.request.y)refuse('unchanged-focus','Choose a different photo focus before saving.');
 const operations=Object.freeze([Object.freeze({kind:'photoFocus',id:selected.row.id,seenBlockHash:selected.row.blockHash,x:input.request.x,y:input.request.y})]);
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope,placementIds:Object.freeze([p.placementId]),operations});
}
export function planMagazinePlacementAspect(input){
 if(!input?.working?.supportedNativeOperations?.includes('photoAspect'))refuse('unsupported-owner','This working editor does not support photo shape yet.');
 const {selected,ownerRef,expectedHash,revision,scope}=placementContext(input,'aspect'),o=selected.group.origin,p=selected.placement;
 if(o.kind!=='photo'||o.role!=='wide'||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||!photoDirectiveComplete(selected.row.raw,o)||p.structuralPath.startsWith('ending/'))refuse('unsupported-placement','Adjust the shape of a standalone wide article photo.');
 if((p.crop?.aspect??'4/3')===input.request.aspect)refuse('unchanged-aspect','Choose a different photo shape before saving.');
 const operations=Object.freeze([Object.freeze({kind:'photoAspect',id:selected.row.id,seenBlockHash:selected.row.blockHash,aspect:input.request.aspect})]);
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope,placementIds:Object.freeze([p.placementId]),operations});
}


export function planMagazinePlacementReplace(input){
 if(!input?.working?.supportedNativeOperations?.includes('photoReplace'))refuse('unsupported-owner','This working editor does not support replacing photos yet.');
 const {selected,placements,ownerRef,expectedHash,revision,scope}=placementContext(input,'replace');
 for(const asset of input.inspection.sources){
  const ref=asset.sourceRef;
  if(!HEX.test(asset.id)||ref?.sourceId!==asset.id||!HEX.test(ref?.hash)||!HEX.test(ref?.rootId)||typeof ref?.relativePath!=='string'||asset.placements.some(p=>['rootId','sourceId','relativePath','hash'].some(k=>p.sourceRef?.[k]!==ref[k])))refuse('invalid-source','The draft’s photo catalog changed. Refresh the photos.');
 }
 const source=placements.get(input.request.replacementPlacementId);
 const standalone=hit=>hit&&hit.group.origin.kind==='photo'&&['wide','bleed'].includes(hit.group.origin.role)&&hit.group.origin.depth===0&&hit.group.origin.groupSize===1&&hit.group.origin.groupIndex===0&&photoDirectiveComplete(hit.row.raw,hit.group.origin)&&!hit.placement.structuralPath.startsWith('ending/');
 if(!standalone(selected)||!standalone(source))refuse('unsupported-placement','Choose two standalone article photos in this draft.');
 const ref=source.placement.sourceRef;
 if(!HEX.test(input.request.sourceId)||!HEX.test(input.request.sourceHash)||ref?.sourceId!==input.request.sourceId||ref?.hash!==input.request.sourceHash||!input.inspection.sources.some(s=>s.id===input.request.sourceId&&s.sourceRef?.hash===input.request.sourceHash&&s.placements.includes(source.placement)))refuse('unknown-source','This replacement photo is not in the current draft’s photo catalog.');
 if(selected.placement.sourceRef?.sourceId===ref.sourceId)refuse('unchanged-photo','Choose a different photograph.');
 const operations=Object.freeze([Object.freeze({kind:'photoReplace',id:selected.row.id,seenBlockHash:selected.row.blockHash,replacementId:source.row.id,seenReplacementHash:source.row.blockHash})]);
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope,placementIds:Object.freeze([selected.placement.placementId]),replacementPlacementId:source.placement.placementId,sourceId:ref.sourceId,sourceHash:ref.hash,operations});
}


export function planMagazineLibraryPlacementReplace(input){
 if(!input?.working?.supportedNativeOperations?.includes('photoReplaceAsset'))refuse('unsupported-owner','This working editor does not support library photographs yet.');
 const {selected,ownerRef,expectedHash,revision,scope}=placementContext(input,'library'),o=selected.group.origin,r=input.request;
 if(o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||!photoDirectiveComplete(selected.row.raw,o)||selected.placement.structuralPath.startsWith('ending/'))refuse('unsupported-placement','Replace a standalone wide or bleed article photo.');
 if(!['assetRootId','assetRevision','assetHash'].every(k=>HEX.test(r[k]))||!/^([a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(r.assetSourceId)||typeof r.description!=='string'||r.description.length>2000||!r.description.isWellFormed()||r.description!==r.description.trim()||/[\x00-\x1f\x7f%]/.test(r.description)||r.description.includes(' · '))refuse('invalid-source','Choose a current library photo and a plain single-line description.');
 const operations=Object.freeze([Object.freeze({kind:'photoReplaceAsset',id:selected.row.id,seenBlockHash:selected.row.blockHash,rootId:r.assetRootId,sourceId:r.assetSourceId,revision:r.assetRevision,sourceHash:r.assetHash,description:r.description})]);
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope,placementIds:Object.freeze([selected.placement.placementId]),operations});
}

export function planMagazinePlacementAnnotation(input){
 if(!input?.working?.supportedNativeOperations?.includes('photoAnnotation'))refuse('unsupported-owner','This working editor does not support canonical captions and credits yet.');
 const annotation=validatePhotoAnnotation(input.request?.annotation),context=placementContext(input,'annotation'),{selected,ownerRef,expectedHash,revision,scope}=context,o=selected.group.origin;
 if(!['cover','opener','wide','bleed','photos','side'].includes(o.role)||!['photo','photos','side'].includes(o.kind)||(o.depth!==0&&!['wide','bleed','photos'].includes(o.role))||!photoDirectiveComplete(selected.row.raw,o))refuse('unsupported-placement','Edit an exact standalone photo or its complete photo group.');
 if(JSON.stringify(splitPhotoAnnotation(selected.row.raw).annotation)===JSON.stringify(annotation))refuse('unchanged-annotation','Caption and credit already match the saved photo.');
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope,placementIds:Object.freeze([...selected.group.placements].sort((a,b)=>a.nativeOrigin.groupIndex-b.nativeOrigin.groupIndex).map(p=>p.placementId)),operations:Object.freeze([Object.freeze({kind:'photoAnnotation',id:selected.row.id,seenBlockHash:selected.row.blockHash,annotation})])});
}
