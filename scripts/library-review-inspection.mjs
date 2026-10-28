// Host-only composition of the maintained Library's pure readers. No HTTP paths,
// authority creation, discovery or installation is accepted here.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createLibrary} from '../runtime/services/library.mjs';
import {createRetainedTranscriptCatalog} from '../runtime/services/retained-transcript-catalog.mjs';
import {createStudyOriginalSourceCatalog} from '../runtime/services/study-original-source-catalog.mjs';
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');
export function createLibraryReviewInspection({configFile}={}){
 if(typeof configFile!=='string'||!path.isAbsolute(configFile))throw Error('An explicit host Library configuration is required.');
 const before=fs.lstatSync(configFile);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>1024*1024)throw Error('Host Library configuration must be bounded regular JSON.');
 let bytes;const fd=fs.openSync(configFile,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{if(stamp(fs.fstatSync(fd))!==stamp(before))throw Error('Host Library configuration changed.');bytes=Buffer.alloc(before.size);let used=0;while(used<bytes.length){const n=fs.readSync(fd,bytes,used,bytes.length-used,used);if(!n)break;used+=n;}if(used!==bytes.length||stamp(fs.fstatSync(fd))!==stamp(before))throw Error('Host Library configuration changed.');}finally{fs.closeSync(fd);}
 if(stamp(fs.lstatSync(configFile))!==stamp(before))throw Error('Host Library configuration changed.');
 const config=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!config||typeof config!=='object'||Array.isArray(config)||typeof config.dataDir!=='string'||!path.isAbsolute(config.dataDir))throw Error('Host configuration must name its existing Library data directory.');
 const owner=createLibrary({dataDir:config.dataDir,connections:config.sourceRoots||[],inspectionOnly:true,...(config.transcriptLibrary?{retainedCatalog:createRetainedTranscriptCatalog(config.transcriptLibrary)}:{}),...(config.studyOriginalRoots?{originalCatalog:createStudyOriginalSourceCatalog(config.studyOriginalRoots)}:{})});
 const scope=createHash('sha256').update(bytes).update(fs.realpathSync(config.dataDir)).digest('hex');
 // A changed host configuration must be explicitly reopened, never retarget an
 // existing reader or continue serving metadata cached under its previous scope.
 const check=()=>{const current=fs.lstatSync(configFile);if(stamp(current)!==stamp(before)||current.isSymbolicLink())throw Object.assign(Error('The host Library connection changed. Reopen this preview connection.'),{status:409});};
 // Root paths establish owner parity; identical cloned index bytes are insufficient.
 const verifyFolderOwner=async({tree,folders,domain})=>{
  check();const localTree=await owner.tree(),localFolders=await owner.folders({domain});check();
  const held=()=>{throw Object.assign(Error('The native folder authority is not the same inspected Library owner and revision.'),{status:409});};
  for(const id of ['library','recordings']){
   const native=tree?.roots?.filter(root=>root.id===id),local=localTree.roots.filter(root=>root.id===id);
   if(native?.length!==1||local.length!==1||native[0].path!==local[0].path||native[0].writable!==local[0].writable)held();
  }
  if(folders?.schema!=='ar-create.library-folders.v1'||folders.domain!==domain||tree?.revision!==localTree.revision||tree?.indexHash!==undefined&&tree.indexHash!==localTree.indexHash||folders.revision!==localTree.revision||folders.indexHash!==localTree.indexHash||localFolders.revision!==folders.revision||localFolders.indexHash!==folders.indexHash||JSON.stringify(localFolders.folders)!==JSON.stringify(folders.folders)||localFolders.undoOperationId!==folders.undoOperationId)held();
  return localFolders;
 };
 return Object.freeze({scope,assertCurrent:check,verifyFolderOwner,publicationRepoRoot:typeof config.magazine?.magSendRepo==='string'?config.magazine.magSendRepo:null,...Object.fromEntries(Object.entries(owner).map(([name,read])=>[name,async(...args)=>{check();const result=await read(...args);check();return result;}]))});
}
