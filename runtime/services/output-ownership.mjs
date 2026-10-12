import path from 'node:path';
import {readJson} from './files.mjs';

// New exports name their piece. Earlier immutable manifests belong to the
// original piece recorded by migration; never relabel them as the active piece.
export function outputOwnership({dataDir,store}){
 if(!store)return ()=>true; // Standalone renderer fixtures have no active piece.
 let originalProjectId=null;
 try{const original=readJson(path.join(dataDir,'state.pieces-migration.backup.json'),null);originalProjectId=original?original.project?.id:store.get().project.id;}catch{/* Unreadable migration proof cannot grant legacy ownership. */}
 return record=>Boolean(record&&(Object.hasOwn(record,'projectId')?record.projectId:originalProjectId)===store.get().project.id);
}
