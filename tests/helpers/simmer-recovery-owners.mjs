// Real file owners shared by recovery tests and the abrupt-process-exit probe.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from '../../runtime/store.mjs';
import {createLibrary} from '../../runtime/services/library.mjs';
import {createSimmerBoards} from '../../runtime/services/simmer-board.mjs';
import {createSimmerChat} from '../../runtime/services/simmer-chat.mjs';
import {withActor} from '../../runtime/services/actor.mjs';
import {createConceptWork} from '../../runtime/services/concept-work.mjs';
import {createStudyBindings} from '../../runtime/services/study-bindings.mjs';
import {createStudyDraftCopies} from '../../runtime/services/study-draft-copies.mjs';
import {createStudyOriginals} from '../../runtime/services/study-originals.mjs';
import {createStudyHumanDirection} from '../../runtime/services/study-human-direction.mjs';
export async function recoveryOwners(config,checkpoint){
 const dataDir=config.dataDir,store=await createStore({dataDir}),library=createLibrary({dataDir}),originals=createStudyOriginals(config.studyOriginalRoots),drafts=createStudyDraftCopies({dataDir,originals}),bindings=createStudyBindings({dataDir,store}),humanDirection=createStudyHumanDirection({dataDir,store,bindings,drafts,library}),concepts=createConceptWork({drafts,humanDirection,bindings,library}),boards=createSimmerBoards({dataDir,library}),chat=createSimmerChat({dataDir,library,boards,concepts,checkpoint});
 return {store,library,boards,concepts,chat};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [configPath,method,encoded,point]=process.argv.slice(2),config=JSON.parse(fs.readFileSync(configPath)),input=JSON.parse(encoded);
 if(config.syntheticFixtures!==true)throw Error('Only generated synthetic homes are permitted.');
 const x=await recoveryOwners(config,key=>{if(key===point)process.exit(86);});
 if(point==='source-index'){
  const rename=fs.renameSync;fs.renameSync=function(from,to){if(to===path.join(config.dataDir,'library-index.json')&&fs.existsSync(path.join(config.dataDir,'library','Simmer imports',input.operationId,'photo-0',input.photos[0])))process.exit(86);return rename(from,to);};
 }
 await withActor({actor:'agent:codex',client:'cli'},()=>x.chat[method](input));
 throw Error('Crash point was not reached.');
}
