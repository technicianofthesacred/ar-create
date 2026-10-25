// Pure metadata projection. Root paths are private inputs, never public targets.
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=512&&!/[\x00-\x1f\x7f]/.test(value);
const dev=rel=>typeof rel==='string'&&/^Workflow\/3-Develop\/DEV - [^/]+\.md$/.test(rel)&&!rel.includes('\\');
export function resolveMagazineWorkingTargets({owner,roots=[],stories=[],projectLinks={}}={}){
 const result={schema:'ar-create.review-magazine-working-links.v1',state:'unavailable',reason:'invalid-owner-catalog',targets:[]};
 if(owner?.schema!=='ar-create.magazine-working-catalog.v1'||typeof owner.configured!=='boolean'||typeof owner.writable!=='boolean'||typeof owner.registered!=='boolean'||!Array.isArray(owner.stories))return result;
 if(owner.stories.length>1000||owner.stories.some(row=>!row||!Array.isArray(row.pieces)||row.pieces.length>1000||row.pieces.some(piece=>!piece)))return {...result,reason:'invalid-owner-catalog'};
 if(owner.stories.reduce((count,row)=>count+row.pieces.length,0)>10000)return {...result,reason:'owner-catalog-limit'};
 if(!owner.configured)return {...result,reason:'owner-not-configured'};
 if(!owner.registered)return {...result,reason:'owner-not-registered'};
 if(owner.rootIdentity?.scheme!=='canonical-directory-sha256-v1'||!hash(owner.rootIdentity.fingerprint))return {...result,reason:'owner-root-identity-unavailable'};
 const matchingRoots=roots.filter(root=>text(root.id)&&text(root.canonical)&&sha(root.canonical)===owner.rootIdentity.fingerprint);
 if(matchingRoots.length!==1)return {...result,reason:matchingRoots.length?'ambiguous-owner-root':'owner-root-not-in-portfolio'};
 const root=matchingRoots[0],targets=[];
 for(const story of stories){
  const nativeProjectId=projectLinks[story.id]?.nativeProjectId;
  if(!text(nativeProjectId))continue;
  for(const artifact of story.artifacts||[]){
   const rel=artifact.relativePath;
   if(artifact.kind!=='DEV'||artifact.archived||!dev(rel)||!hash(artifact.hash)||artifact.provenance?.rootId!==root.id||artifact.provenance?.rootPath!==root.path||artifact.provenance?.relativePath!==rel||artifact.provenance?.sha256!==artifact.hash||artifact.artifactId!=='mag_'+sha(root.id+'\0'+root.canonical+'\0'+rel))continue;
   const claims=owner.stories.flatMap(registered=>registered.pieces.filter(piece=>piece.relativePath===rel).map(piece=>({registered,piece})));
   if(claims.length!==1)continue;
   const {registered,piece}=claims[0],pieces=registered.pieces;
   if(registered.archived!==false||!text(registered.storyId)||owner.stories.filter(row=>row.storyId===registered.storyId).length!==1)continue;
   if(!['article','article-part'].includes(piece.kind)||!text(piece.pieceId)||pieces.filter(p=>p.pieceId===piece.pieceId).length!==1||piece.hash!==artifact.hash)continue;
   // A part is usable only with its exact retained part label; never choose a sibling.
   if(piece.kind==='article-part'&&(!text(piece.part)||piece.part!==artifact.part))continue;
   if(piece.kind==='article'&&(piece.part||artifact.part))continue;
   targets.push({kind:'magazine',nativeProjectId,storyId:registered.storyId,pieceId:piece.pieceId,edition:'working',partKey:piece.part||'article',artifactId:artifact.artifactId,hash:artifact.hash,editable:owner.writable&&piece.editable===true});
  }
 }
 // Duplicate portfolio ownership is not a choice for the reader to guess.
 result.targets=targets.filter(target=>targets.filter(row=>row.artifactId===target.artifactId).length===1);
 return {...result,state:'available',reason:owner.writable?null:'owner-read-only',rootIdentity:{scheme:owner.rootIdentity.scheme,fingerprint:owner.rootIdentity.fingerprint},targets:result.targets};
}
