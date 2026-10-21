import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {loadConfig} from '../config.mjs';
import {installFixtureOverlay} from '../fixture-overlay.mjs';
// Disposable folders live under the OS temp directory, which is itself a refused scratch root.
const scratch=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ar-private-config-'));
const scratchOk=env=>({AR_CREATE_ALLOW_SCRATCH_ROOTS:'1',...env});
const cleanup=(...dirs)=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true});};
const write=(dir,name,body)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);return file;};

test('refuses a data root under /tmp, the OS temp folder or ~/.codex unless allowScratchRoots is set',()=>{
 const dir=scratch();try{
  assert.throws(()=>loadConfig({AR_CREATE_DATA_DIR:dir}),/scratch location/);
  assert.throws(()=>loadConfig({AR_CREATE_DATA_DIR:'/tmp/ar-create-never-created'}),/scratch location/);
  assert.throws(()=>loadConfig({AR_CREATE_DATA_DIR:'/private/tmp/ar-create-never-created'}),/scratch location/);
  assert.throws(()=>loadConfig({AR_CREATE_DATA_DIR:path.join(os.homedir(),'.codex','visualizations','x','data')}),/scratch location/);
  assert.equal(loadConfig(scratchOk({AR_CREATE_DATA_DIR:dir})).dataDir,fs.realpathSync(dir));
  const config=write(dir,'allow.json',JSON.stringify({dataDir:path.join(dir,'owned'),allowScratchRoots:true}));
  assert.equal(loadConfig({AR_CREATE_CONFIG:config}).allowScratchRoots,true);
 }finally{cleanup(dir);}
});

test('refuses transcript library and imported transcript owner roots under a scratch location, naming the key',()=>{
 const dir=scratch();try{
  const codex=path.join(os.homedir(),'.codex','visualizations','2026','10','05','x','data');
  const library={registryFile:path.join(codex,'registry.json'),indexFile:path.join(codex,'index.json'),libraryRoot:path.join(codex,'library')};
  const owner={dataDir:codex,notesFile:path.join(codex,'notes.json'),handoverFile:path.join(codex,'handover.json'),connections:[]};
  const file=(name,extra)=>write(dir,name,JSON.stringify({dataDir:path.join(dir,'owned'),...extra}));
  assert.throws(()=>loadConfig({AR_CREATE_CONFIG:file('lib.json',{transcriptLibrary:library})}),/transcriptLibrary\.registryFile must not live under/);
  assert.throws(()=>loadConfig({AR_CREATE_CONFIG:file('owner.json',{importedTranscriptOwner:owner})}),/importedTranscriptOwner\.dataDir must not live under/);
  const permanent={registryFile:path.join(dir,'registry.json'),indexFile:path.join(dir,'index.json'),libraryRoot:path.join(dir,'library')};
  assert.doesNotThrow(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:file('ok.json',{transcriptLibrary:permanent})})));
  assert.doesNotThrow(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:file('ok2.json',{transcriptLibrary:library})})),'tests may opt in explicitly');
 }finally{cleanup(dir);}
});

test('host tools: transcriptionVenv supplies python, tools.python wins, nothing is guessed',()=>{
 const dir=scratch();try{
  assert.equal(loadConfig(scratchOk({AR_CREATE_DATA_DIR:path.join(dir,'d')})).tools.python,null);
  const venv=path.join(dir,'venv');write(venv,'bin/python','#!/bin/sh\n');fs.chmodSync(path.join(venv,'bin/python'),0o755);
  const config=write(dir,'c.json',JSON.stringify({dataDir:path.join(dir,'d'),tools:{transcriptionVenv:venv},transcriptionRuntime:{models:'x'}}));
  const loaded=loadConfig(scratchOk({AR_CREATE_CONFIG:config}));
  assert.equal(loaded.tools.python,path.join(fs.realpathSync(venv),'bin/python'),'the venv interpreter keeps its venv path');
  assert.equal(loaded.transcriptionRuntime.python,loaded.tools.python);
  const tool=write(dir,'bin/yt-dlp','#!/bin/sh\n');fs.chmodSync(tool,0o755);
  const explicit=loadConfig(scratchOk({AR_CREATE_CONFIG:write(dir,'e.json',JSON.stringify({dataDir:path.join(dir,'d'),tools:{python:tool,transcriptionVenv:venv,ytDlp:tool}}))}));
  assert.equal(explicit.tools.python,fs.realpathSync(tool));assert.equal(explicit.tools.ytDlp,fs.realpathSync(tool));
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:write(dir,'bad.json',JSON.stringify({dataDir:path.join(dir,'d'),tools:{transcriptionVenv:'relative/venv'}}))})),/explicit absolute directory/);
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:write(dir,'bad2.json',JSON.stringify({dataDir:path.join(dir,'d'),tools:{ytDlp:path.join(dir,'missing')}}))})),/ENOENT|executable/);
 }finally{cleanup(dir);}
});

test('editorialSkillsDir, magazine.vaultRoot and fixturesDir are explicit directories; skills are derived from the folder',()=>{
 const dir=scratch();try{
  const skills=path.join(dir,'skills');write(skills,'arcreate/SKILL.md','a');write(skills,'mag/SKILL.md','m');
  const loaded=loadConfig(scratchOk({AR_CREATE_CONFIG:write(dir,'c.json',JSON.stringify({dataDir:path.join(dir,'d'),editorialSkillsDir:skills,fixturesDir:dir,magazine:{vaultRoot:skills}}))}));
  const real=fs.realpathSync(skills);
  assert.deepEqual(loaded.editorialSkills,[path.join(real,'arcreate/SKILL.md'),path.join(real,'mag/SKILL.md')]);
  assert.equal(loaded.editorialSkillsDir,real);assert.equal(loaded.fixturesDir,fs.realpathSync(dir));
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:write(dir,'r.json',JSON.stringify({dataDir:path.join(dir,'d'),editorialSkillsDir:'skills'}))})),/explicit absolute directory/);
  const none=loadConfig(scratchOk({AR_CREATE_DATA_DIR:path.join(dir,'d')}));
  assert.deepEqual([none.editorialSkillsDir,none.fixturesDir,none.magazine.vaultRoot,none.editorialSkills],[null,null,null,[]]);
 }finally{cleanup(dir);}
});

test('installed home mode: config must name the real home, keep data inside it, and only the home may use 8841',()=>{
 const checkout=path.resolve(import.meta.dirname,'..');
 // The package lives at <home>/service in an install. Here the checkout is its own "service", so its parent is the home.
 const home=path.dirname(checkout);
 const dir=scratch();try{
  const configFor=body=>write(dir,'h.json',JSON.stringify(body));
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:configFor({home:dir,dataDir:path.join(dir,'data'),port:8841})})),/permanent local service/);
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:configFor({home,dataDir:path.join(dir,'data'),port:8855})})),/permanent local service/);
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:configFor({home,dataDir:path.join(home,'data'),port:80})})),/permanent local service/);
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:configFor({home,dataDir:path.join(home,'data'),port:8855,publicDir:path.join(dir,'public')})})),/permanent local service/);
  // A candidate (no home) still cannot take the installed port.
  assert.throws(()=>loadConfig(scratchOk({AR_CREATE_CONFIG:configFor({dataDir:path.join(dir,'data'),port:8841})})),/distinct from installed port 8841/);
 }finally{cleanup(dir);}
});

test('fixturesDir overlay serves only its allowed file to loopback hosts and defers everything else',async t=>{
 const dir=scratch();write(dir,'synthetic-study-data.js','window.PRIVATE_FIXTURE=1;');write(dir,'other.js','nope');
 const server=http.createServer((request,response)=>response.end('original:'+request.url));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
 installFixtureOverlay(server,{fixturesDir:dir,port});
 t.after(()=>new Promise(resolve=>server.close(()=>{cleanup(dir);resolve();})));
 const get=(pathname,host=`127.0.0.1:${port}`)=>new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port,path:pathname,headers:{host}},response=>{let body='';response.on('data',c=>body+=c);response.on('end',()=>resolve({status:response.statusCode,body}));}).on('error',reject));
 assert.equal((await get('/document-study/synthetic-study-data.js')).body,'window.PRIVATE_FIXTURE=1;');
 assert.equal((await get('/document-study/other.js')).body,'original:/document-study/other.js');
 assert.equal((await get('/document-study/synthetic-study-data.js','evil.example')).body,'original:/document-study/synthetic-study-data.js');
 fs.rmSync(path.join(dir,'synthetic-study-data.js'));
 assert.equal((await get('/document-study/synthetic-study-data.js')).body,'original:/document-study/synthetic-study-data.js','a missing fixture falls through to the synthetic file');
});

test('magazine settings: vault, Files, drops in order, writable defaults to false, staging and teajia checkout; bad values refused',()=>{
 const dir=scratch();try{
  const vault=path.join(dir,'vault'),files=path.join(dir,'files'),site=path.join(dir,'site');for(const d of [vault,files,site])fs.mkdirSync(d);
  const drops=[path.join(dir,'files/Drop'),path.join(dir,'phone/Drop')],staging=path.join(dir,'cache/export');
  const load=magazine=>loadConfig(scratchOk({AR_CREATE_CONFIG:write(dir,'m.json',JSON.stringify({dataDir:path.join(dir,'d'),magazine}))})).magazine;
  const set=load({vaultRoot:vault,filesRoot:files,drops,exportStaging:staging,magSendRepo:site});
  assert.deepEqual(set,{vaultRoot:fs.realpathSync(vault),filesRoot:fs.realpathSync(files),drops,writable:false,exportStaging:staging,magSendRepo:fs.realpathSync(site)},'MAG_DROPS order kept; writable false unless the file says true');
  assert.equal(load({vaultRoot:vault,writable:true}).writable,true);
  assert.equal(load({vaultRoot:vault,writable:false}).writable,false);
 }finally{cleanup(dir);}
 const again=scratch();try{
  const vault=path.join(again,'vault');fs.mkdirSync(vault);
  const load=magazine=>loadConfig(scratchOk({AR_CREATE_CONFIG:write(again,'m.json',JSON.stringify({dataDir:path.join(again,'d'),magazine}))}));
  assert.throws(()=>load({vaultRoot:vault,writable:1}),/magazine\.writable must be true or false/);
  assert.throws(()=>load({vaultRoot:vault,drops:['relative/Drop']}),/magazine\.drops\[0\] must be an absolute path/);
  assert.throws(()=>load({vaultRoot:vault,exportStaging:'cache/export'}),/magazine\.exportStaging must be an absolute path/);
  assert.throws(()=>load({vaultRoot:vault,sendNow:true}),/unsupported field/);
  assert.throws(()=>load({vaultRoot:vault,filesRoot:path.join(again,'missing')}),/ENOENT|real directory/);
  const none=loadConfig(scratchOk({AR_CREATE_DATA_DIR:path.join(again,'d')})).magazine;
  assert.equal(none.vaultRoot,null);assert.equal(none.writable,false);assert.deepEqual(none.drops,[]);
 }finally{cleanup(again);}
});
