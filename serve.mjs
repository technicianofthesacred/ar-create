import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createServer} from './runtime/server.mjs';
import {createWorkspaceExecution} from './runtime/services/artifact-execution.mjs';
import {loadConfig} from './config.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));const config=loadConfig();
// Only explicitly configured host tools can access an existing local account.
for(const [key,name] of [['AR_CREATE_PYTHON','python'],['AR_CREATE_YT_DLP','ytDlp'],['AR_CREATE_FIRECRAWL_CLI','firecrawl'],['AR_CREATE_CODEX','codex']]){
 if(config.tools[name])process.env[key]=config.tools[name];else delete process.env[key];
}
process.env.AR_CREATE_EDITORIAL_SKILLS=JSON.stringify(config.editorialSkills);
const server=await createServer({dataDir:config.dataDir,publicDir:path.join(here,'public'),packageView:{syntheticFixtures:config.syntheticFixtures,originalReaderBaseUrl:config.originalReaderBaseUrl},connections:config.connections,connectionsEditable:false,studyOriginalRoots:config.studyOriginalRoots,transcriptionRuntime:config.transcriptionRuntime,sharedArticles:true,researchEnabled:false,execution:createWorkspaceExecution({codexPath:config.tools.codex,boundedEditorial:true})});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port occupied; existing listener preserved.':`Candidate startup failed (${error.code||'runtime'}).`);server.close(()=>{process.exitCode=1;});});
server.listen(config.port,'127.0.0.1',()=>console.log(`AR Create candidate: http://127.0.0.1:${config.port}/document-study/index.html`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
