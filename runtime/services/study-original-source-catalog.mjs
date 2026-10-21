import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {safeRel,resolveInside} from './files.mjs';

// This is an allowlist of existing paths, not a scan, content store or writer.
// Manuscripts and output plans keep their existing editing authorities.
const ROLES=new Set(['source','raw','transcript','machine transcript','research','research notes','note','notes','context','brief','guide','guidance','reference']);
const outputName=/^(?:DEV|MAP|PLANS|CHECK|FEEDBACK|ARTICLE|CAROUSEL)\s*-/i;
export function createStudyOriginalSourceCatalog({vaultRoot,catalog={}}={}){
 if(typeof vaultRoot!=='string'||!path.isAbsolute(vaultRoot))throw new StateError('Original discovery requires its explicit existing vault root.',400);
 const root=path.resolve(vaultRoot).replace(/^\/(tmp|var)(?=\/|$)/,'/private/$1'),rows=new Map();
 function add(docs,reference){
  if(!Array.isArray(docs)||docs.length>20000)throw new StateError('Original discovery requires a bounded configured file list.',400);
  for(const entry of docs){
   if(!Array.isArray(entry)||typeof entry[0]!=='string'||typeof entry[1]!=='string')throw new StateError('Original discovery requires explicit path and role pairs.',400);
   const [relative,role]=entry;if(!ROLES.has(role.trim().toLowerCase())||outputName.test(path.posix.basename(relative)))continue;
   safeRel(relative,false);if(!/\.(?:md|markdown|txt)$/i.test(relative))continue;
   let row=rows.get(relative);if(!row){row={rel_path:relative,title:path.posix.basename(relative,path.posix.extname(relative)),originalReferences:[]};rows.set(relative,row);}
   const ref={...reference,path:relative,role};if(!row.originalReferences.some(r=>JSON.stringify(r)===JSON.stringify(ref)))row.originalReferences.push(ref);
   if(rows.size>20000)throw new StateError('Original discovery exceeds its bounded configured file list.',413);
  }
 }
 for(const [projectKey,project]of Object.entries(catalog.projects||{}))add(project.docs||[],{projectKey});
 for(const [originalId,draft]of Object.entries(catalog.drafts||{}))add(draft.support||[],{originalId,parentStudyKey:draft.parentStudyKey});
 return {id:'study-originals',name:'Existing project sources',path:root,entries(){
  resolveInside(root,'',{directory:true});if(fs.realpathSync(root)!==root)throw new StateError('Original discovery root changed into a symlink.',403);
  return structuredClone([...rows.values()]);
 }};
}
