/* Pure, metadata-only table projection. The supplied reader remains the source authority. */
(()=>{
 'use strict';
 const HASH=/^[a-f0-9]{64}$/i;
 const fields=['id','title','name','fileName','rootId','rel_path','relativePath','kind','type','authority','artifactId','storyId','hash','archived','readOnly','missing','sourceUnavailable','available','publication','channel','source_url','modifiedAt','updatedAt','createdAt','readingStatus','toReadLater','watched','usedInPiece','provenance'];
 const blocked=/^(?:body|text|content|words|transcript|segments|turns|raw|manuscript|draft|caption|notes|discussion)$/i;
 const metadata=(value,depth=0)=>{if(depth>6)return undefined;if(value===null||['string','number','boolean'].includes(typeof value))return value;if(Array.isArray(value))return value.slice(0,100).map(x=>metadata(x,depth+1));if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())if(!blocked.test(key)){const v=metadata(value[key],depth+1);if(v!==undefined)out[key]=v;}return out;}return undefined;};
 const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
 const identity=s=>JSON.stringify([s.id,s.authority,s.hash??null,s.artifactId??null,s.storyId??null]);
 // Only the retained transcript owner's exact revision may describe a transcript.
 function transcriptMetadata(row){
  const p=row.transcriptProvenance;
  if(row.authority!=='library'||!['note','text','transcript'].includes(row.kind)||!p||Array.isArray(p)||p.authority!=='retained-transcript-manager'||typeof p.sessionId!=='string'||!p.sessionId.trim()||p.sessionId.length>240||/[\x00-\x1f\x7f]/.test(p.sessionId)||p.workingSourceId!==row.id||typeof p.workingHash!=='string'||!HASH.test(p.workingHash)||p.workingHash!==row.hash)return undefined;
  const out={authority:p.authority,sessionId:p.sessionId,workingSourceId:p.workingSourceId,workingHash:p.workingHash};
  if(Number.isSafeInteger(p.version)&&p.version>=1)out.version=p.version;
  if(typeof p.date==='string'&&p.date.length<=64&&!/[\x00-\x1f\x7f]/.test(p.date))out.date=p.date;
  return out;
 }
 function source(row){
  if(!row||typeof row.id!=='string'||!row.id||typeof row.authority!=='string'||!row.authority)throw Error('The source list has an unconfirmed identity.');
  if(row.hash!=null&&!HASH.test(row.hash))throw Error('The source list has an unconfirmed revision.');
  if(row.authority==='magazine-original'&&(!row.artifactId||!HASH.test(row.hash||'')))throw Error('An original file needs its exact saved reference.');
  const out={};for(const key of fields)if(Object.hasOwn(row,key))out[key]=metadata(row[key]);const transcript=transcriptMetadata(row);if(transcript)out.transcriptProvenance=transcript;return out;
 }
 function project({sources,scope,revision=null,folderData=null}={}){
  if(typeof scope!=='string'||!HASH.test(scope))throw Error('The source connection is not confirmed.');
  if(revision!==null&&(typeof revision!=='string'||!HASH.test(revision)))throw Error('The source catalog revision is not confirmed.');
  if(!Array.isArray(sources)||sources.length>10000)throw Error('The source list could not be confirmed.');
  const rows=new Map(),duplicates=[];
  for(const raw of sources){const row=source(raw),old=rows.get(row.id);if(old){if(identity(old)!==identity(row))throw Error('Conflicting source references need review. No list was substituted.');duplicates.push(row.id);if(JSON.stringify(row).localeCompare(JSON.stringify(old))<0)rows.set(row.id,row);}else rows.set(row.id,row);}
  const folderSources=new Map((folderData?.sources||[]).map(row=>[row.id,row]));
  const projected=[...rows.values()].map(row=>{const saved=folderSources.get(row.id),compatible=saved&&(!saved.authority||saved.authority===row.authority)&&(!saved.hash||!row.hash||saved.hash===row.hash);if(!compatible)return row;const out={...row};for(const key of ['modifiedAt','updatedAt','createdAt','publication','channel','readingStatus','toReadLater','watched','usedInPiece'])if(out[key]===undefined&&saved[key]!==undefined)out[key]=metadata(saved[key]);return out;});
  const ids=new Set(rows.keys()),folders=(folderData?.folders||[]).map(folder=>({id:folder.id,name:folder.name,parentId:folder.parentId??null,sourceIds:[...new Set((folder.sourceIds||[]).filter(id=>ids.has(id)))]}));
  return freeze({scope,revision,duplicateIds:[...new Set(duplicates)].sort(),data:{schema:'ar-create.library-folders.v1',domain:'library',revision:folderData?.revision??null,indexHash:folderData?.indexHash??null,folders,sources:projected,readOnly:true}});
 }
 function openDescriptor(projection,id,{scope,revision,ready}={}){
  if(!ready||!projection?.revision||projection.scope!==scope||projection.revision!==revision)throw Error('The source list is updating. Try again when it is ready.');
  const row=projection.data.sources.find(row=>row.id===id);if(!row)throw Error('This source is no longer in the current list.');
  if(row.available===false||row.missing||row.sourceUnavailable)throw Error('This original is unavailable. Its saved reference is retained.');
  return freeze({id:row.id,authority:row.authority,hash:row.hash??null,artifactId:row.artifactId??null,storyId:row.storyId??null,catalogRevision:projection.revision,scope:projection.scope});
 }
 window.arCreateCatalogProjection=Object.freeze({project,openDescriptor});
})();
