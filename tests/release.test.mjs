import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync,spawnSync} from 'node:child_process';
const script=path.resolve(import.meta.dirname,'../scripts/release.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const write=(root,file,body)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);};
// A tiny stand-in for the real repository: three shipped files, one test, one TODO. No build script, so no generated files.
function scene(t){
 const base=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-release-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const repo=path.join(base,'repo'),home=path.join(base,'home');fs.mkdirSync(repo);
 git(repo,'init','-q');git(repo,'config','user.email','test@example.invalid');git(repo,'config','user.name','Test');
 const files={'serve.mjs':'console.log("serve");\n','runtime/lib.mjs':'export const one=1;\n','public/index.html':'<p>invented</p>\n','tests/lib.test.mjs':'// a test\n','runtime/lib.test.mjs':'// another test\n','TODO.md':'- [ ] invented\n'};
 for(const [file,body] of Object.entries(files))write(repo,file,body);
 const manifest=()=>{const rows=Object.keys(files).sort().map(file=>({path:file,candidateSha256:sha(fs.readFileSync(path.join(repo,file)))}));write(repo,'source-manifest.json',JSON.stringify({schema:'test',included:[],authored:rows},null,2)+'\n');};
 const commit=message=>{manifest();git(repo,'add','-A');git(repo,'commit','-q','-m',message);return git(repo,'rev-parse','HEAD').trim();};
 const run=(...args)=>spawnSync(process.execPath,[script,'--repo',repo,'--home',home,...args],{encoding:'utf8'});
 return {base,repo,home,files,write:(file,body)=>{files[file]=body;write(repo,file,body);},commit,run,manifest};
}
const walk=(dir,rel='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),rel?rel+'/'+e.name:e.name):[rel?rel+'/'+e.name:e.name]).sort();

test('refuses a dirty tree and a stale manifest, and writes nothing',t=>{
 const s=scene(t);s.commit('first');
 write(s.repo,'serve.mjs','changed after the commit\n');
 let result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/dirty tree/);
 git(s.repo,'checkout','-q','serve.mjs');write(s.repo,'untracked.txt','x');
 result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/dirty tree/);assert.match(result.stderr,/untracked\.txt/);
 fs.rmSync(path.join(s.repo,'untracked.txt'));
 // A committed change that the manifest does not know about.
 write(s.repo,'serve.mjs','edited and committed without refreshing the manifest\n');git(s.repo,'commit','-qam','edit');
 result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/source-manifest\.json does not match/);assert.match(result.stderr,/refresh-manifest/);
 assert.equal(fs.existsSync(s.home),false,'a refused release creates nothing');
});

test('dry run reports the plan and writes nothing',t=>{
 const s=scene(t);const commit=s.commit('first');
 const result=s.run('--dry-run');assert.equal(result.status,0,result.stderr);assert.match(result.stdout,new RegExp(commit.slice(0,12)));assert.match(result.stdout,/shipped 3/);assert.match(result.stdout,/dry run: nothing written/);
 assert.equal(fs.existsSync(s.home),false);
});

test('releases exactly the manifest files, records the commit, keeps the previous service, never touches data',t=>{
 const s=scene(t);fs.mkdirSync(path.join(s.home,'data'),{recursive:true});fs.mkdirSync(path.join(s.home,'config'),{recursive:true});
 write(s.home,'data/saved.json','{"precious":true}');write(s.home,'config/local.json','{}');
 const dataBefore=sha(fs.readFileSync(path.join(s.home,'data/saved.json'))),configBefore=sha(fs.readFileSync(path.join(s.home,'config/local.json')));
 const first=s.commit('first');
 let result=s.run('--built-by','agent:test');assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/restart \(not done by this script\)/);
 assert.deepEqual(walk(path.join(s.home,'service')),['public/index.html','runtime/lib.mjs','serve.mjs','source-manifest.json'],'no tests, no TODO, nothing else');
 const record=JSON.parse(fs.readFileSync(path.join(s.home,'RELEASE.json'),'utf8'));
 assert.equal(record.sha,first);assert.equal(record.builtBy,'agent:test');assert.match(record.builtAt,/^\d{4}-\d\d-\d\dT/);assert.equal(record.manifestSha256,sha(fs.readFileSync(path.join(s.repo,'source-manifest.json'))));assert.equal(record.previousSha,null);
 assert.equal(fs.existsSync(path.join(s.home,'service.next')),false);assert.equal(fs.existsSync(path.join(s.home,'.release.lock')),false);
 // Second release: the first becomes service.prev.
 s.write('runtime/lib.mjs','export const one=2;\n');const second=s.commit('second');
 result=s.run();assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(fs.readFileSync(path.join(s.home,'RELEASE.json'),'utf8')).sha,second);assert.equal(JSON.parse(fs.readFileSync(path.join(s.home,'RELEASE.prev.json'),'utf8')).sha,first);
 assert.equal(fs.readFileSync(path.join(s.home,'service/runtime/lib.mjs'),'utf8'),'export const one=2;\n');assert.equal(fs.readFileSync(path.join(s.home,'service.prev/runtime/lib.mjs'),'utf8'),'export const one=1;\n');
 assert.equal(sha(fs.readFileSync(path.join(s.home,'data/saved.json'))),dataBefore);assert.equal(sha(fs.readFileSync(path.join(s.home,'config/local.json'))),configBefore);
 assert.deepEqual(fs.readFileSync(path.join(s.home,'RELEASES.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line).action),['release','release']);
 // verify passes, then catches a hand edit and a stray file.
 result=s.run('--verify');assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/exactly release/);
 write(s.home,'service/runtime/lib.mjs','hand edited');result=s.run('--verify');assert.equal(result.status,1);assert.match(result.stderr,/changed: runtime\/lib\.mjs/);
 write(s.home,'service/runtime/lib.mjs','export const one=2;\n');write(s.home,'service/notes/receipt.md','stray');result=s.run('--verify');assert.equal(result.status,1);assert.match(result.stderr,/not in manifest: notes\/receipt\.md/);
});

test('rollback restores the previous release and can itself be undone',t=>{
 const s=scene(t);const first=s.commit('first');assert.equal(s.run().status,0);
 s.write('runtime/lib.mjs','export const one=2;\n');const second=s.commit('second');assert.equal(s.run().status,0);
 const sha_=()=>JSON.parse(fs.readFileSync(path.join(s.home,'RELEASE.json'),'utf8')).sha,lib=()=>fs.readFileSync(path.join(s.home,'service/runtime/lib.mjs'),'utf8');
 let result=s.run('--rollback');assert.equal(result.status,0,result.stderr);assert.equal(sha_(),first);assert.equal(lib(),'export const one=1;\n');assert.match(result.stdout,/restart \(not done/);
 result=s.run('--rollback');assert.equal(result.status,0,result.stderr);assert.equal(sha_(),second);assert.equal(lib(),'export const one=2;\n');
 const fresh=scene(t);assert.match(fresh.run('--rollback').stderr,/no service\.prev/);
});

test('refuses an in-progress release and a manifest row whose file is gone',t=>{
 const s=scene(t);s.commit('first');
 fs.mkdirSync(s.home,{recursive:true});write(s.home,'.release.lock','');
 const result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/Another release is in progress/);
 fs.rmSync(path.join(s.home,'.release.lock'));
 // A manifest row for a file the commit does not contain would stage nothing: refused by the manifest comparison.
 fs.rmSync(path.join(s.repo,'public/index.html'));git(s.repo,'commit','-qam','delete without refreshing the manifest');
 assert.match(s.run().stderr,/missing\s+public\/index\.html/);
});

test('refuses a home that is the checkout, contains it, or is a non-ignored folder inside it',t=>{
 const s=scene(t);s.commit('first');
 for(const home of [s.repo,s.base,path.join(s.repo,'public')]){
  const result=spawnSync(process.execPath,[script,'--repo',s.repo,'--home',home,'--dry-run'],{encoding:'utf8'});
  assert.equal(result.status,1,home);assert.match(result.stderr,/--home must/);
 }
});

test('a build that leaves a file outside the manifest and the declared generated set is refused, and the live service is untouched',t=>{
 const s=scene(t);const first=s.commit('first');assert.equal(s.run().status,0);
 s.write('runtime/scripts/build-document-study.mjs',"import fs from 'node:fs';fs.writeFileSync(new URL('../stray-receipt.md',import.meta.url),'a receipt that should never ship');\n");
 s.commit('second, with a build that strays');
 const result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/not in the manifest and not declared generated/);assert.match(result.stderr,/runtime\/stray-receipt\.md/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(s.home,'RELEASE.json'),'utf8')).sha,first,'still the first release');
 assert.equal(fs.existsSync(path.join(s.home,'service.next')),false,'staging is cleaned up');assert.equal(fs.existsSync(path.join(s.home,'.release.lock')),false);
 assert.deepEqual(walk(path.join(s.home,'service')),['public/index.html','runtime/lib.mjs','serve.mjs','source-manifest.json']);
});
