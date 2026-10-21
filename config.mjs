import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const packageDir=path.dirname(fileURLToPath(import.meta.url));
const checkoutDir=packageDir;
const canonicalDestination=value=>{let ancestor=path.resolve(value);const suffix=[];while(!fs.existsSync(ancestor)){suffix.unshift(path.basename(ancestor));const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('Data directory has no existing ancestor.');ancestor=parent;}return path.resolve(fs.realpathSync(ancestor),...suffix);};
const insideCheckout=value=>{const relative=path.relative(checkoutDir,value);return !relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
const optionalFile=(value,label)=>{if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!path.isAbsolute(value))throw Error(`${label} requires an explicit absolute path.`);const stat=fs.lstatSync(value);if(stat.isSymbolicLink()||!stat.isFile())throw Error(`${label} must be an owned regular file.`);return value;};
const directory=(value,label,create=false)=>{if(typeof value!=='string'||!path.isAbsolute(value))throw Error(`${label} requires an explicit absolute directory.`);if(create)fs.mkdirSync(value,{recursive:true,mode:0o700});const stat=fs.lstatSync(value);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error(`${label} must be a real directory.`);return fs.realpathSync(value);};

// Scratch locations that another process may clean up. Live data, the transcript library and the
// imported transcript owner must never live here (review F-03); tests opt in with allowScratchRoots.
const scratchRoots=()=>[...new Set(['/tmp','/private/tmp','/private/var/folders','/var/folders',path.join(os.homedir(),'.codex')].flatMap(root=>{try{return [root,fs.realpathSync(root)];}catch{return [root];}}))];
const within=(value,root)=>{const relative=path.relative(root,value);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
const refuseScratch=(value,label,allowed)=>{if(allowed||typeof value!=='string'||!path.isAbsolute(value))return;let canonical;try{canonical=canonicalDestination(value);}catch{canonical=path.resolve(value);}const raw=path.resolve(value);for(const root of scratchRoots())if(within(raw,root)||within(canonical,root))throw Error(`${label} must not live under ${root}: it is a scratch location another process may clean up. Move it into the permanent home, or set allowScratchRoots for a test.`);};
const noSymlinks=(value,label)=>{let at=path.resolve(value);while(true){const stat=fs.lstatSync(at,{throwIfNoEntry:false});if(stat?.isSymbolicLink())throw Error(`${label} must not pass through a symlink.`);const parent=path.dirname(at);if(parent===at)return value;at=parent;}};
const optionalDirectory=(value,label)=>{if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!path.isAbsolute(value))throw Error(`${label} requires an explicit absolute directory.`);return directory(value,label);};
export function loadConfig(env=process.env){
 const configPath=env.AR_CREATE_CONFIG;
 const config=configPath?JSON.parse(fs.readFileSync(optionalFile(configPath,'AR_CREATE_CONFIG'),'utf8')):{};
 const allowScratch=env.AR_CREATE_ALLOW_SCRATCH_ROOTS==='1'||config.allowScratchRoots===true;
 // The live transcript stores are checked first and by name: F-03 was exactly this data living in a Codex scratch folder.
 for(const [label,record] of [['transcriptLibrary',config.transcriptLibrary],['importedTranscriptOwner',config.importedTranscriptOwner]])if(record&&typeof record==='object')for(const key of ['registryFile','indexFile','libraryRoot','dataDir','notesFile','handoverFile'])if(typeof record[key]==='string')refuseScratch(record[key],`${label}.${key}`,allowScratch);
 // Installed ("permanent home") mode: the program lives at <home>/service/serve.mjs and the config names that home.
 const home=config.home===undefined||config.home===null?null:config.home;
 if(home!==null){
  if(typeof home!=='string'||!path.isAbsolute(home)||home!==path.dirname(packageDir))throw Error('Explicit permanent local service configuration required.');
  noSymlinks(home,'home');noSymlinks(packageDir,'service');
 }
 const requestedData=env.AR_CREATE_DATA_DIR||config.dataDir;
 if(typeof requestedData==='string'&&path.isAbsolute(requestedData)){if(insideCheckout(canonicalDestination(requestedData)))throw Error('Private data must remain outside the package checkout.');}
 if(home!==null&&!(typeof requestedData==='string'&&requestedData.startsWith(home+path.sep)))throw Error('Explicit permanent local service configuration required.');
 refuseScratch(requestedData,'dataDir',allowScratch);
 if(home!==null)noSymlinks(requestedData,'dataDir');
 const dataDir=directory(requestedData,'AR_CREATE_DATA_DIR',true);
 if(insideCheckout(dataDir))throw Error('Private data must remain outside the package checkout.');
 const port=Number(env.AR_CREATE_PORT||config.port||8854);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Candidate port must be valid and distinct from installed port 8841.');
 // Only the installed home itself may take the installed port, and only with its own data.
 if(port===8841&&!(home!==null&&dataDir===path.join(home,'data')))throw Error('Candidate port must be valid and distinct from installed port 8841.');
 if(home!==null&&port<1024)throw Error('Explicit permanent local service configuration required.');
 let publicDir=path.join(packageDir,'public');
 if(home!==null&&config.publicDir!==undefined&&config.publicDir!==publicDir)throw Error('Explicit permanent local service configuration required.');
 let studyRelocation=null;
 if(config.relocationFile!==undefined&&config.relocationFile!==null){studyRelocation=JSON.parse(fs.readFileSync(optionalFile(config.relocationFile,'relocationFile'),'utf8'));if(home!==null)noSymlinks(config.relocationFile,'relocationFile');}
 const roots=config.studyOriginalRoots;
 const studyOriginalRoots=roots?{vaultRoot:directory(roots.vaultRoot,'vaultRoot'),filesRoot:directory(roots.filesRoot,'filesRoot'),catalog:roots.catalog||{projects:{},drafts:{}}}:null;
 const hostRecord=(value,keys,label)=>{if(value===null||value===undefined)return null;if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error(label+' requires only its explicit supported fields.');return value;};
 const hostPath=(value,label)=>{if(typeof value!=='string'||!path.isAbsolute(value))throw Error(label+' requires an explicit absolute path.');return value;};
 const transcriptLibrary=hostRecord(config.transcriptLibrary,['registryFile','indexFile','libraryRoot'],'transcriptLibrary');
 if(transcriptLibrary)for(const key of ['registryFile','indexFile','libraryRoot']){hostPath(transcriptLibrary[key],'transcriptLibrary.'+key);}
 const importedTranscriptOwner=hostRecord(config.importedTranscriptOwner,['dataDir','notesFile','handoverFile','connections'],'importedTranscriptOwner');
 if(importedTranscriptOwner){for(const key of ['dataDir','notesFile','handoverFile']){hostPath(importedTranscriptOwner[key],'importedTranscriptOwner.'+key);}if(insideCheckout(canonicalDestination(importedTranscriptOwner.dataDir)))throw Error('Imported Source private data must remain outside the package checkout.');if(!Array.isArray(importedTranscriptOwner.connections))throw Error('Imported Source connections must be explicitly configured.');}
 const executable=(value,label)=>{if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!path.isAbsolute(value)||!fs.statSync(value).isFile())throw Error(`${label} requires an explicit executable path.`);fs.accessSync(value,fs.constants.X_OK);return value;};
 const tools=Object.fromEntries(['python','ytDlp','firecrawl','codex'].map(name=>{const value=executable(config.tools?.[name],`tools.${name}`);return [name,value&&fs.realpathSync(value)];}));
 // A virtualenv's interpreter must keep its own path (resolving the symlink would leave the venv), so it is not realpath'd.
 const transcriptionVenv=optionalDirectory(config.tools?.transcriptionVenv,'tools.transcriptionVenv');
 tools.transcriptionVenv=transcriptionVenv;
 const python=tools.python||(transcriptionVenv?executable(path.join(transcriptionVenv,'bin/python'),'tools.transcriptionVenv python'):null);
 if(config.sourceRoots!==undefined&&!Array.isArray(config.sourceRoots))throw Error('sourceRoots must be an array of explicitly configured roots.');
 if(config.originalReaderBaseUrl){const url=new URL(config.originalReaderBaseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Original reader URL must not contain credentials.');}
 const editorialSkillsDir=optionalDirectory(config.editorialSkillsDir,'editorialSkillsDir');
 const fixturesDir=optionalDirectory(config.fixturesDir,'fixturesDir');
 if(config.magazine!==undefined&&config.magazine!==null&&(typeof config.magazine!=='object'||Array.isArray(config.magazine)))throw Error('magazine must be an object.');
 const magazineVaultRoot=optionalDirectory(config.magazine?.vaultRoot,'magazine.vaultRoot');
 let editorialSkills=Array.isArray(config.editorialSkills)?config.editorialSkills:[];
 if(!editorialSkills.length&&editorialSkillsDir)editorialSkills=['arcreate/SKILL.md','mag/SKILL.md'].map(name=>path.join(editorialSkillsDir,name)).filter(file=>fs.existsSync(file));
 return {home,dataDir,publicDir,port,studyRelocation,transcriptLibrary,importedTranscriptOwner,syntheticFixtures:config.syntheticFixtures===true,studyOriginalRoots,connections:config.sourceRoots||[],transcriptionRuntime:config.transcriptionRuntime?{...config.transcriptionRuntime,python}:null,originalReaderBaseUrl:config.originalReaderBaseUrl||null,editorialSkills,editorialSkillsDir,fixturesDir,magazine:{vaultRoot:magazineVaultRoot},allowScratchRoots:allowScratch,tools:{...tools,python}};
}
