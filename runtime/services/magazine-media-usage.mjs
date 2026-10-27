// Read-only, current-working-article projection. Identity is supplied by the
// catalog and exact Magazine inspector; matching bytes are never an asset join.
import {createHash} from 'node:crypto';
const ORIGINALS_ROOT=createHash('sha256').update('original-photos').digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const validOwner=value=>value&&typeof value.projectId==='string'&&!!value.projectId&&typeof value.pieceId==='string'&&!!value.pieceId&&value.editionId==='working'&&typeof value.artifactId==='string'&&!!value.artifactId&&HEX.test(value.hash||'');
const sameOwner=(a,b)=>validOwner(a)&&validOwner(b)&&a.projectId===b.projectId&&a.pieceId===b.pieceId&&a.artifactId===b.artifactId&&a.hash===b.hash;
const clone=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function key(ref){
 if(!ref||typeof ref!=='object'||typeof ref.rootId!=='string'||!ref.rootId)return null;
 if(ref.kind==='publication'&&typeof ref.relativePath==='string'&&ref.relativePath)return JSON.stringify(['publication',ref.rootId,ref.relativePath]);
 if(ref.kind==='originals'&&ref.rootId===ORIGINALS_ROOT&&HEX.test(ref.sourceId||''))return JSON.stringify(['originals',ref.rootId,ref.sourceId]);
 if(ref.kind==='library'&&typeof ref.sourceId==='string'&&ref.sourceId)return JSON.stringify(['library',ref.rootId,ref.sourceId]);
 return null;
}
function unavailable(reason){return {status:'unavailable',count:null,placements:[],reason};}

/** Project a full catalog against one exact Magazine working-article inspection.
 * expectedOwnerRef and expectedCatalogRevision are captured at request start.
 * All rows, placements and metadata are detached and deeply frozen.
 */
export function projectMagazineMediaUsage({catalog,inspection,expectedOwnerRef,expectedCatalogRevision}={}){
 if(catalog?.schema!=='ar-create.magazine-library-photos.v1'||!Array.isArray(catalog.items)||!HEX.test(catalog.revision||'')||!validOwner(expectedOwnerRef)||!HEX.test(expectedCatalogRevision||'')||(inspection?.schema==='ar-create.magazine-media-inspection.v1'&&!HEX.test(inspection.revision||'')))throw new TypeError('Supply the full photo catalog and captured exact owner/revision.');
 const rows=clone(catalog.items),supported=inspection?.schema==='ar-create.magazine-media-inspection.v1'&&Array.isArray(inspection.sources)&&Array.isArray(rows);
 const stale=catalog.revision!==expectedCatalogRevision||(supported&&!sameOwner(inspection.ownerRef,expectedOwnerRef));
 const completeCatalog=catalog.coverage?.complete===true&&catalog.coverage?.truncated===false;
 const index=new Map(),unlistedSources=[],placementClaims=new Map();let invalid=false;
 if(supported&&!stale)for(const source of inspection.sources)for(const p of Array.isArray(source?.placements)?source.placements:[])if(typeof p?.placementId==='string')placementClaims.set(p.placementId,(placementClaims.get(p.placementId)||0)+1);
 if(supported&&!stale)for(const source of inspection.sources){
  const identity=key(source?.originRef);
  const good=identity&&['rootId','sourceId','relativePath'].every(key=>typeof source.sourceRef?.[key]==='string'&&!!source.sourceRef[key])&&HEX.test(source.sourceRef?.hash||'')&&sameOwner(source.ownerRef,expectedOwnerRef)&&Array.isArray(source.placements)&&source.placements.length>0&&new Set(source.placements.map(p=>p?.placementId)).size===source.placements.length&&source.placements.every(p=>p&&placementClaims.get(p.placementId)===1&&p.hash===expectedOwnerRef.hash&&p.projectId===expectedOwnerRef.projectId&&p.pieceId===expectedOwnerRef.pieceId&&p.outputId===expectedOwnerRef.pieceId&&p.editionId==='working'&&typeof p.placementId==='string'&&!!p.placementId&&typeof p.structuralPath==='string'&&!!p.structuralPath&&p.sourceRef?.rootId===source.sourceRef?.rootId&&p.sourceRef?.sourceId===source.sourceRef?.sourceId&&p.sourceRef?.relativePath===source.sourceRef?.relativePath&&p.sourceRef?.hash===source.sourceRef?.hash);
  if(!good){invalid=true;if(identity)index.set(identity,{invalid:true});continue;}
  const previous=index.get(identity);if(previous?.invalid||previous&&previous.source.sourceRef.hash!==source.sourceRef.hash){invalid=true;index.set(identity,{invalid:true});continue;}
  const placements=source.placements.map(p=>({...p,originRef:clone(source.originRef)}));
  if(previous){previous.sources.push(source);previous.placements.push(...placements);}else index.set(identity,{source,sources:[source],placements});
 }
 const catalogKeys=new Map();for(const row of rows){const identity=key(row.originRef);if(identity)catalogKeys.set(identity,(catalogKeys.get(identity)||0)+1);}
 const items=rows.map(row=>{
  const identity=key(row.originRef),match=identity&&index.get(identity);let usage;
  if(stale)usage=unavailable('stale-owner-or-catalog');
  else if(!supported)usage=unavailable('inspection-unsupported');
  else if(!identity)usage={status:'unmapped',count:null,placements:[],reason:'no-owner-backed-identity'};
  else if(catalogKeys.get(identity)>1)usage=unavailable('ambiguous-catalog-identity');
  else if(match?.invalid)usage=unavailable('invalid-placement-owner');
  else if(match&&row.sourceHash!==match.source.sourceRef?.hash&&!(row.byteVerification==='pending'&&row.selectable===false&&row.sourceHash===null&&HEX.test(row.metadataRevision||'')&&match.sources.some(source=>row.metadataRevision===source.metadataRevision)))usage=unavailable('source-bytes-changed');
  else if(match)usage={status:'used',count:match.placements.length,placements:clone(match.placements)};
  else if(!completeCatalog||invalid)usage=unavailable(invalid?'inspection-incomplete':'catalog-incomplete');
  else usage={status:'not-used-in-article',count:0,placements:[]};
  return {...row,usage};
 });
 if(supported&&!stale)for(const [identity,entry] of index)if(!catalogKeys.has(identity))for(const source of entry.sources||[null])unlistedSources.push({source:source?clone(source):null,reason:entry.invalid?'invalid-placement-owner':'missing-from-catalog'});
 const partial=invalid||!completeCatalog||unlistedSources.length>0||items.some(row=>['unmapped','unavailable'].includes(row.usage.status));
 const status=stale?'stale':!supported?'unsupported':partial?'partial':'complete';
 return freeze({schema:'ar-create.magazine-media-usage.v1',scope:'current-working-article',status,ownerRef:clone(expectedOwnerRef),catalogRevision:catalog.revision,inspectionRevision:supported?inspection.revision:null,items,unlistedSources,coverage:{catalogComplete:completeCatalog,inspectionAvailable:supported,claim:'Usage is limited to this current working article.'}});
}
