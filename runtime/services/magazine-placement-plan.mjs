// Pure planning only: consumes the maintained read-only inspection and current
// guarded owner projection. The existing native writer alone applies operations.
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=500;
function refuse(code,message){throw Object.assign(new Error(message),{name:'MagazinePlacementPlanError',code,status:409});}
const sameOwner=(a,b)=>a?.projectId===b.projectId&&a.pieceId===b.pieceId&&a.editionId===b.editionId&&a.artifactId===b.artifactId&&a.hash===b.hash;
const roles={photo:['cover','opener','wide','bleed'],photos:['photos'],side:['side'],'on-photo':['on-photo'],saying:['ending']};
const simple=group=>['wide','bleed','photos'].includes(group.origin.role)&&['photo','photos'].includes(group.origin.kind)&&group.origin.directiveEnd===group.origin.chunkEnd&&group.placements.every(p=>!p.structuralPath.startsWith('ending/'));
/** Returns existing native move operations, never new manuscript/layout data.
 * Request revision must come from this exact inspection; working is the current
 * owner resolver result, not browser-supplied projection or occurrence metadata.
 * Cover/opener/ending/side/on-photo arrangements retain their specialized owner.
 */
function placementContext({inspection,working,request}={},focus=false) {
 const keys=['storyId','pieceId','expectedHash','revision','placementId',...(focus?['x','y']:['beforeId'])];
 if(!object(request)||Object.keys(request).length!==keys.length||Object.keys(request).some(k=>!keys.includes(k))||!keys.filter(k=>!['x','y'].includes(k)).every(k=>identity(request[k]))||focus&&![request.x,request.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||!['expectedHash','revision','placementId'].every(k=>HEX.test(request[k]))) refuse('invalid-request','Choose a current photo and an existing destination.');
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
   if(!group){group={origin:o,placements:[],indexes:new Set()};groups.set(row.id,group);}
   if(['fileHash','blockHash','blockOffset','chunkStart','chunkEnd','directiveStart','directiveEnd','kind','role','groupSize','depth','offsetUnit'].some(k=>group.origin[k]!==o[k])||group.indexes.has(o.groupIndex)) refuse('invalid-origins','The whole photo group could not be verified. Refresh the photos.');
   group.indexes.add(o.groupIndex);group.placements.push(p);placements.set(p.placementId,{placement:p,group,row});
   if(placements.size>256) refuse('invalid-origins','Too many photo positions were returned.');
  }
 }
 if(placements.size!==inspection.originTrace.occurrences||groups.size!==inspection.originTrace.blocks||[...groups.values()].some(g=>g.indexes.size!==g.origin.groupSize)) refuse('invalid-origins','The photo positions are incomplete. Refresh the photos.');
 const selected=placements.get(placementId),destination=rows.get(beforeId);
 if(!selected) refuse('unknown-placement','This photo is no longer in the selected draft.');
 if(focus)return {selected,ownerRef,expectedHash,revision,scope:inspection.scope};
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
export function planMagazinePlacementFocus(input){
 if(!input?.working?.supportedNativeOperations?.includes('photoFocus'))refuse('unsupported-owner','This working editor does not support photo focus yet.');
 const {selected,ownerRef,expectedHash,revision,scope}=placementContext(input,true),o=selected.group.origin,p=selected.placement;
 if(o.kind!=='photo'||!['wide','bleed'].includes(o.role)||o.depth!==0||o.groupSize!==1||o.groupIndex!==0||o.directiveEnd!==o.chunkEnd||p.structuralPath.startsWith('ending/'))refuse('unsupported-placement','Adjust the focus of a standalone article photo.');
 if((p.crop?.x??0.5)===input.request.x&&(p.crop?.y??0.5)===input.request.y)refuse('unchanged-focus','Choose a different photo focus before saving.');
 const operations=Object.freeze([Object.freeze({kind:'photoFocus',id:selected.row.id,seenBlockHash:selected.row.blockHash,x:input.request.x,y:input.request.y})]);
 return Object.freeze({ownerRef:Object.freeze(ownerRef),expectedHash,revision,scope,placementIds:Object.freeze([p.placementId]),operations});
}
