import fs from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const packageDir=path.dirname(fileURLToPath(import.meta.url));
const checkoutDir=path.resolve(packageDir,'../..');
const canonicalDestination=value=>{let ancestor=path.resolve(value);const suffix=[];while(!fs.existsSync(ancestor)){suffix.unshift(path.basename(ancestor));const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('Data directory has no existing ancestor.');ancestor=parent;}return path.resolve(fs.realpathSync(ancestor),...suffix);};
const insideCheckout=value=>{const relative=path.relative(checkoutDir,value);return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
const optionalFile=(value,label)=>{if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!path.isAbsolute(value))throw Error(`${label} requires an explicit absolute path.`);const stat=fs.lstatSync(value);if(stat.isSymbolicLink()||!stat.isFile())throw Error(`${label} must be an owned regular file.`);return value;};
const directory=(value,label,create=false)=>{if(typeof value!=='string'||!path.isAbsolute(value))throw Error(`${label} requires an explicit absolute directory.`);if(create)fs.mkdirSync(value,{recursive:true,mode:0o700});const stat=fs.lstatSync(value);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error(`${label} must be a real directory.`);return fs.realpathSync(value);};
export function loadConfig(env=process.env){
 const configPath=env.AR_CREATE_CONFIG;
 const config=configPath?JSON.parse(fs.readFileSync(optionalFile(configPath,'AR_CREATE_CONFIG'),'utf8')):{};
 const requestedData=env.AR_CREATE_DATA_DIR||config.dataDir;
 if(typeof requestedData==='string'&&path.isAbsolute(requestedData)){if(insideCheckout(canonicalDestination(requestedData)))throw Error('Private data must remain outside the package checkout.');}
 const dataDir=directory(requestedData,'AR_CREATE_DATA_DIR',true);
 if(insideCheckout(dataDir))throw Error('Private data must remain outside the package checkout.');
 const port=Number(env.AR_CREATE_PORT||config.port||8854);
 if(!Number.isInteger(port)||port<1||port>65535||port===8841)throw Error('Candidate port must be valid and distinct from installed port 8841.');
 const roots=config.studyOriginalRoots;
 const studyOriginalRoots=roots?{vaultRoot:directory(roots.vaultRoot,'vaultRoot'),filesRoot:directory(roots.filesRoot,'filesRoot'),catalog:roots.catalog||{projects:{},drafts:{}}}:null;
 const tools=Object.fromEntries(['python','ytDlp','firecrawl','codex'].map(name=>{const value=config.tools?.[name];if(value===null||value===undefined||value==='')return [name,null];if(typeof value!=='string'||!path.isAbsolute(value)||!fs.statSync(value).isFile())throw Error(`tools.${name} requires an explicit executable path.`);fs.accessSync(value,fs.constants.X_OK);return [name,fs.realpathSync(value)];}));
 if(config.sourceRoots!==undefined&&!Array.isArray(config.sourceRoots))throw Error('sourceRoots must be an array of explicitly configured roots.');
 if(config.originalReaderBaseUrl){const url=new URL(config.originalReaderBaseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Original reader URL must not contain credentials.');}
 return {dataDir,port,syntheticFixtures:config.syntheticFixtures===true,studyOriginalRoots,connections:config.sourceRoots||[],transcriptionRuntime:config.transcriptionRuntime?{...config.transcriptionRuntime,python:tools.python}:null,originalReaderBaseUrl:config.originalReaderBaseUrl||null,editorialSkills:Array.isArray(config.editorialSkills)?config.editorialSkills:[],tools};
}
