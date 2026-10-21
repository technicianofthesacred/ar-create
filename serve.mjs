// The one AR Create program. The demo (scripts/demo.mjs), a candidate checkout and the installed
// permanent home (<home>/service/serve.mjs, started by <home>/start.py) all run this file.
// Everything private - ports, data, host tools, skill folders, fixtures - comes from the config file
// (AR_CREATE_CONFIG or --config) and, for the three below, from env or arguments. Nothing private lives in code.
import fs from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createImportedSourceOwner} from './runtime/services/source-sessions.mjs';
import {createServer} from './runtime/server.mjs';
import {createWorkspaceExecution} from './runtime/services/artifact-execution.mjs';
import {loadConfig} from './config.mjs';
import {installFixtureOverlay} from './fixture-overlay.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
// Arguments win over env: --port N, --data-dir DIR, --config FILE, --allow-scratch-roots (tests only).
const env={...process.env};
const flags={'--port':'AR_CREATE_PORT','--data-dir':'AR_CREATE_DATA_DIR','--config':'AR_CREATE_CONFIG'};
const argv=process.argv.slice(2);
for(let i=0;i<argv.length;i++){
 if(argv[i]==='--allow-scratch-roots'){env.AR_CREATE_ALLOW_SCRATCH_ROOTS='1';continue;}
 if(!Object.hasOwn(flags,argv[i])||argv[i+1]===undefined){console.error(`Unknown or incomplete argument: ${argv[i]}`);process.exit(2);}
 env[flags[argv[i]]]=argv[++i];
}
if(!env.AR_CREATE_CONFIG&&!env.AR_CREATE_DATA_DIR&&path.basename(here)==='service'){const installed=path.join(path.dirname(here),'config/local.json');if(fs.existsSync(installed))env.AR_CREATE_CONFIG=installed;}
const config=loadConfig(env);
// Only explicitly configured host tools can reach an existing local account; nothing is inherited or guessed.
const setting=(key,value)=>{if(value)process.env[key]=value;else delete process.env[key];};
for(const [key,name] of [['AR_CREATE_PYTHON','python'],['AR_CREATE_YT_DLP','ytDlp'],['AR_CREATE_FIRECRAWL_CLI','firecrawl'],['AR_CREATE_CODEX','codex']])setting(key,config.tools[name]);
setting('AR_CREATE_EDITORIAL_SKILL_ROOT',config.editorialSkillsDir);
setting('AR_CREATE_MAGAZINE_ROOT',config.magazine.vaultRoot);
process.env.AR_CREATE_EDITORIAL_SKILLS=JSON.stringify(config.editorialSkills);
// The installed home records which git commit it is: <home>/RELEASE.json, written only by scripts/release.mjs.
let release=null;
if(config.home){try{release=JSON.parse(fs.readFileSync(path.join(config.home,'RELEASE.json'),'utf8'));}catch{release=null;}}
const server=await createServer({dataDir:config.dataDir,publicDir:config.publicDir,packageView:{syntheticFixtures:config.syntheticFixtures,originalReaderBaseUrl:config.originalReaderBaseUrl},connections:config.connections,connectionsEditable:false,studyOriginalRoots:config.studyOriginalRoots,studyRelocation:config.studyRelocation,transcriptionRuntime:config.transcriptionRuntime,transcriptLibrary:config.transcriptLibrary,importedSourceFactory:config.importedTranscriptOwner?()=>createImportedSourceOwner(config.importedTranscriptOwner):null,sharedArticles:true,researchEnabled:false,release,...(config.editorialSkillsDir?{articleMakeSkillRoot:config.editorialSkillsDir}:{}),execution:createWorkspaceExecution({codexPath:config.tools.codex,boundedEditorial:true})});
if(config.fixturesDir)installFixtureOverlay(server,{fixturesDir:config.fixturesDir,port:config.port});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port occupied; existing listener preserved.':`Candidate startup failed (${error.code||'runtime'}).`);server.close(()=>{process.exitCode=1;});});
server.listen(config.port,'127.0.0.1',()=>console.log(`AR Create: http://127.0.0.1:${config.port}/document-study/index.html${release?.sha?` (release ${String(release.sha).slice(0,12)})`:''}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
