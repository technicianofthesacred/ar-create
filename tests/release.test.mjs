import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync,spawnSync} from 'node:child_process';
import {buildManifest} from '../scripts/lib/manifest.mjs';
import {requestReleaseCI} from '../scripts/release-ci.mjs';
const script=path.resolve(import.meta.dirname,'../scripts/release.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const write=(root,file,body)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);};
const green=[{name:'ci',status:'completed',conclusion:'success',started_at:'2026-11-01T10:00:00Z'}];
// A tiny stand-in for the real repository: shipped files, two tests, one TODO. No build script, so no generated files.
// `origin` is a local bare repository standing in for GitHub (a URL rewrite makes the github.com address fetch from it),
// and the `gh` the script calls is a fake that answers from FAKE_GH_RUNS.
function scene(t,{extra={}}={}){
 const base=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-release-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const repo=path.join(base,'repo'),home=path.join(base,'home'),remote=path.join(base,'origin.git'),gh=path.join(base,'gh');fs.mkdirSync(repo);
 git(base,'init','-q','--bare','-b','main',remote);
 git(repo,'init','-q','-b','main');git(repo,'config','user.email','test@example.invalid');git(repo,'config','user.name','Test');
 git(repo,'remote','add','origin','https://github.com/acme/widgets.git');git(repo,'config',`url.${remote}.insteadOf`,'https://github.com/acme/widgets.git');
 fs.writeFileSync(gh,`#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(path.join(base,'gh-calls.log'))},process.argv.slice(2).join(' ')+'\\n');\nif(process.env.FAKE_GH_FAIL){console.error('gh: HTTP 404');process.exit(1);}\nconsole.log(JSON.stringify({total_count:1,check_runs:JSON.parse(process.env.FAKE_GH_RUNS||'[]')}));\n`,{mode:0o755});
 const files={'serve.mjs':'console.log("serve");\n','runtime/lib.mjs':'export const one=1;\n','public/index.html':'<p>invented</p>\n','tests/lib.test.mjs':'// a test\n','runtime/lib.test.mjs':'// another test\n','TODO.md':'- [ ] invented\n','AGENTS.md':'# Invented agent entry\n','editorial/stages/mag/ask.md':'# invented stage\n','tools/magazine/mag.mjs':'export const mag=1;\n',...extra};
 for(const [file,body] of Object.entries(files))write(repo,file,body);
 // CLAUDE.md is a symlink to AGENTS.md, as in the real repository.
 fs.symlinkSync('AGENTS.md',path.join(repo,'CLAUDE.md'));files['CLAUDE.md']=files['AGENTS.md'];
 const commit=(message,{push=true}={})=>{git(repo,'add','-A');git(repo,'commit','-q','-m',message);if(push)git(repo,'push','-q','origin','HEAD:main');return git(repo,'rev-parse','HEAD').trim();};
 const env={FAKE_GH_RUNS:JSON.stringify(green)};let tags=0;
 const run=(...args)=>{
  const lifecycle=args.some(arg=>arg==='--rollback'||arg==='--verify'),tagged=lifecycle||args.includes('--tag')||args.includes('--candidate');
  return spawnSync(process.execPath,[script,'--repo',repo,'--home',home,...(tagged?[]:['--tag','test-'+(++tags)]),...args],{encoding:'utf8',env:{...process.env,AR_RELEASE_GH:gh,...env}});
 };
 return {base,repo,home,remote,gh,files,env,write:(file,body)=>{files[file]=body;write(repo,file,body);},commit,run,calls:()=>{try{return fs.readFileSync(path.join(base,'gh-calls.log'),'utf8');}catch{return '';}}};
}
const walk=(dir,rel='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),rel?rel+'/'+e.name:e.name):[rel?rel+'/'+e.name:e.name]).sort();
const SHIPPED=['AGENTS.md','CLAUDE.md','editorial/stages/mag/ask.md','public/index.html','runtime/lib.mjs','serve.mjs','source-manifest.json','tools/magazine/mag.mjs'];
const releases=home=>fs.readFileSync(path.join(home,'RELEASES.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
const record=home=>JSON.parse(fs.readFileSync(path.join(home,'RELEASE.json'),'utf8'));

test('release CI dispatches the pinned Slim workflow once and reuses the same commit’s run',t=>{
 const ci='.github/workflows/ci.yml',tag='v2026.11.17-1',url='https://github.test/actions/runs/123';
 const s=scene(t,{extra:{[ci]:'jobs:\n  pick-runner:\n    runs-on: ubuntu-latest\n  ci:\n    runs-on: ubuntu-slim\n'}});
 const old=s.commit('older workflow');
 git(s.repo,'tag','-a',tag,'-m','old release',old);git(s.repo,'push','origin',tag);
 assert.throws(()=>requestReleaseCI(s.repo,tag,{gh:s.gh}),/without Ubuntu Slim for pick-runner/);
 assert.equal(s.calls(),'');

 const next='v2026.11.17-2';
 s.write(ci,'jobs:\n  pick-runner:\n    # Discovery uses Slim.\n    runs-on: ubuntu-slim\n  ci:\n    runs-on: ubuntu-latest\n');
 const sha=s.commit('Slim workflow');git(s.repo,'tag','-a',next,'-m','next release',sha);
 assert.throws(()=>requestReleaseCI(s.repo,next,{gh:s.gh}),/Push the annotated tag/);
 git(s.repo,'push','origin',next);

 const response=path.join(s.base,'workflow-response.json');
 fs.writeFileSync(s.gh,`#!/usr/bin/env node
import fs from 'node:fs';
const args=process.argv.slice(2),url=args[1]||'';
fs.appendFileSync(${JSON.stringify(path.join(s.base,'gh-calls.log'))},args.join(' ')+'\\n');
const data=JSON.parse(fs.readFileSync(${JSON.stringify(response)},'utf8'));
if(args[0]==='workflow'){
 console.log(data.run.html_url);
 fs.writeFileSync(${JSON.stringify(response)},JSON.stringify({...data,runs:[data.run]}));
}else if(url.includes('/check-runs'))console.log(JSON.stringify({check_runs:data.checks}));
else console.log(JSON.stringify({workflow_runs:data.runs}));
`,{mode:0o755});
 const run={status:'queued',html_url:url};
 const simulate=(runs,checks)=>fs.writeFileSync(response,JSON.stringify({run,runs,checks}));
 simulate([],[]);
 const output=[];const request=()=>requestReleaseCI(s.repo,next,{gh:s.gh,log:line=>output.push(line)});
 request();request();
 assert.match(s.calls(),new RegExp(`runs\\?head_sha=${sha}`));
 assert.deepEqual(s.calls().split('\n').filter(line=>line.startsWith('workflow run')),[
  `workflow run ci.yml --repo acme/widgets --ref ${next}`
 ]);
 assert.match(output[0],/CI requested/);assert.match(output[1],/already queued/);

 simulate([{...run,status:'completed',conclusion:'success'}],green);
 request();assert.match(output[2],/already passed/);
 simulate([{...run,status:'completed',conclusion:'failure'}],[{...green[0],conclusion:'failure'}]);
 assert.throws(request,/Review the existing run before any retry/);
 assert.equal(s.calls().split('\n').filter(line=>line.startsWith('workflow run')).length,1);
});

test('refuses a dirty tree and writes nothing',t=>{
 const s=scene(t);s.commit('first');
 write(s.repo,'serve.mjs','changed after the commit\n');
 let result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/dirty tree/);
 git(s.repo,'checkout','-q','serve.mjs');write(s.repo,'untracked.txt','x');
 result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/dirty tree/);assert.match(result.stderr,/untracked\.txt/);
 assert.equal(fs.existsSync(s.home),false,'a refused release creates nothing');
});

test('dry run reports the plan and writes nothing',t=>{
 const s=scene(t);const commit=s.commit('first');
 const result=s.run('--dry-run');assert.equal(result.status,0,result.stderr);assert.match(result.stdout,new RegExp(commit.slice(0,12)));assert.match(result.stdout,/shipped 7/);assert.match(result.stdout,/dry run: nothing written/);
 assert.match(result.stdout,/on origin\/main/);assert.match(result.stdout,/ci check: success/);
 assert.equal(fs.existsSync(s.home),false);assert.equal(git(s.repo,'tag','--list').trim(),'','a dry run creates no tag');
});

test('releases exactly the tracked files, computes the manifest at build time, keeps the previous service, never touches data',t=>{
 const s=scene(t);fs.mkdirSync(path.join(s.home,'data'),{recursive:true});fs.mkdirSync(path.join(s.home,'config'),{recursive:true});
 write(s.home,'data/saved.json','{"precious":true}');write(s.home,'config/local.json','{}');
 const dataBefore=sha(fs.readFileSync(path.join(s.home,'data/saved.json'))),configBefore=sha(fs.readFileSync(path.join(s.home,'config/local.json')));
 const first=s.commit('first');
 assert.equal(git(s.repo,'ls-files').includes('source-manifest.json'),false,'the manifest is not a tracked file');
 let result=s.run('--built-by','agent:test');assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/restart \(not done by this script\)/);
 assert.deepEqual(walk(path.join(s.home,'service')),SHIPPED,'editorial and tools/magazine ship; no tests, no TODO, nothing else');
 assert.equal(fs.existsSync(path.join(s.repo,'source-manifest.json')),false,'nothing was written into the checkout');
 const rec=record(s.home),manifestText=fs.readFileSync(path.join(s.home,'service/source-manifest.json'),'utf8');
 assert.equal(rec.sha,first);assert.equal(rec.builtBy,'agent:test');assert.match(rec.builtAt,/^\d{4}-\d\d-\d\dT/);assert.equal(rec.manifestSha256,sha(manifestText));assert.equal(rec.previousSha,null);
 assert.equal(manifestText,buildManifest(s.repo).text,'the service manifest is the one computed from the clean checkout');
 assert.deepEqual(JSON.parse(manifestText).authored.map(row=>row.path),git(s.repo,'ls-files').trim().split('\n').sort());
 assert.equal(fs.existsSync(path.join(s.home,'service.next')),false);assert.equal(fs.existsSync(path.join(s.home,'.release.lock')),false);
 // Second release: the first becomes service.prev.
 s.write('runtime/lib.mjs','export const one=2;\n');const second=s.commit('second');
 result=s.run();assert.equal(result.status,0,result.stderr);
 assert.equal(record(s.home).sha,second);assert.equal(JSON.parse(fs.readFileSync(path.join(s.home,'RELEASE.prev.json'),'utf8')).sha,first);
 assert.equal(fs.readFileSync(path.join(s.home,'service/runtime/lib.mjs'),'utf8'),'export const one=2;\n');assert.equal(fs.readFileSync(path.join(s.home,'service.prev/runtime/lib.mjs'),'utf8'),'export const one=1;\n');
 assert.equal(sha(fs.readFileSync(path.join(s.home,'data/saved.json'))),dataBefore);assert.equal(sha(fs.readFileSync(path.join(s.home,'config/local.json'))),configBefore);
 assert.deepEqual(releases(s.home).map(line=>line.action),['release','release']);
 // verify passes, then catches a hand edit and a stray file.
 result=s.run('--verify');assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/exactly release/);
 write(s.home,'service/runtime/lib.mjs','hand edited');result=s.run('--verify');assert.equal(result.status,1);assert.match(result.stderr,/changed: runtime\/lib\.mjs/);
 write(s.home,'service/runtime/lib.mjs','export const one=2;\n');write(s.home,'service/notes/receipt.md','stray');result=s.run('--verify');assert.equal(result.status,1);assert.match(result.stderr,/not in manifest: notes\/receipt\.md/);
});

test('rollback restores the previous release and can itself be undone',t=>{
 const s=scene(t);const first=s.commit('first');assert.equal(s.run().status,0);
 s.write('runtime/lib.mjs','export const one=2;\n');const second=s.commit('second');assert.equal(s.run().status,0);
 const sha_=()=>record(s.home).sha,lib=()=>fs.readFileSync(path.join(s.home,'service/runtime/lib.mjs'),'utf8');
 let result=s.run('--rollback');assert.equal(result.status,0,result.stderr);assert.equal(sha_(),first);assert.equal(lib(),'export const one=1;\n');assert.match(result.stdout,/restart \(not done/);
 result=s.run('--rollback');assert.equal(result.status,0,result.stderr);assert.equal(sha_(),second);assert.equal(lib(),'export const one=2;\n');
 const fresh=scene(t);assert.match(fresh.run('--rollback').stderr,/no service\.prev/);
});

test('refuses an in-progress release',t=>{
 const s=scene(t);s.commit('first');
 fs.mkdirSync(s.home,{recursive:true});write(s.home,'.release.lock','');
 const result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/Another release is in progress/);
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
 assert.equal(record(s.home).sha,first,'still the first release');
 assert.equal(fs.existsSync(path.join(s.home,'service.next')),false,'staging is cleaned up');assert.equal(fs.existsSync(path.join(s.home,'.release.lock')),false);
 assert.deepEqual(walk(path.join(s.home,'service')),SHIPPED);
 assert.equal(git(s.repo,'tag','--list').trim().split('\n').length,1,'the failed release left no tag of its own behind');
});

test('copies AGENTS.md to the home and appends one release line to the journal, through the app journal writer',t=>{
 const s=scene(t);fs.mkdirSync(path.join(s.home,'data'),{recursive:true});write(s.home,'data/saved.json','{"precious":true}');
 const saved=sha(fs.readFileSync(path.join(s.home,'data/saved.json')));
 const first=s.commit('first');let result=s.run('--built-by','agent:test');assert.equal(result.status,0,result.stderr);
 assert.equal(fs.lstatSync(path.join(s.home,'AGENTS.md')).isSymbolicLink(),false,'a real file, not the symlink');
 assert.equal(fs.readFileSync(path.join(s.home,'AGENTS.md'),'utf8'),'# Invented agent entry\n');
 const month=new Date().toISOString().slice(0,7),journal=path.join(s.home,'data/journal',month+'.jsonl');
 let lines=fs.readFileSync(journal,'utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.equal(lines.length,1);
 assert.equal(lines[0].kind,'release:'+first);assert.equal(lines[0].actor,'agent:test');assert.equal(lines[0].status,'committed');assert.equal(lines[0].client,'file');assert.deepEqual(lines[0].scope,{kind:'system',id:first});
 assert.match(lines[0].ts,/^\d{4}-\d\d-\d\dT/);assert.match(lines[0].summary,new RegExp(first.slice(0,12)));
 assert.equal(sha(fs.readFileSync(path.join(s.home,'data/saved.json'))),saved,'nothing else in data/ is touched');
 // A second release appends; it never rewrites the first line. The home copy follows the repo.
 s.write('AGENTS.md','# Invented agent entry, second edition\n');const second=s.commit('second');
 result=s.run();assert.equal(result.status,0,result.stderr);
 lines=fs.readFileSync(journal,'utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.deepEqual(lines.map(line=>line.kind),['release:'+first,'release:'+second]);assert.equal(lines[1].before.hash,first);
 assert.equal(fs.readFileSync(path.join(s.home,'AGENTS.md'),'utf8'),'# Invented agent entry, second edition\n');
 assert.match(result.stdout,/journal: release line written/);
});

test('a release into a home with no data folder still records the line, and a dry run writes neither the copy nor the line',t=>{
 const s=scene(t);s.commit('first');
 assert.equal(s.run('--dry-run').status,0);assert.equal(fs.existsSync(s.home),false);
 assert.equal(s.run().status,0);assert.equal(fs.readdirSync(path.join(s.home,'data/journal')).length,1);
});

test('the real checkout ships the editorial files and the magazine tools, and does not track a manifest',()=>{
 const repo=path.resolve(import.meta.dirname,'..'),paths=buildManifest(repo).rows.map(row=>row.path);
 for(const prefix of ['editorial/','tools/magazine/'])assert.ok(paths.some(file=>file.startsWith(prefix)),prefix+' is in the manifest');
 assert.ok(paths.includes('AGENTS.md'));
 assert.ok(paths.includes('editorial/stages/mag/ask.md'),'the stage files the article and carousel makers read');
 assert.ok(paths.includes('scripts/gen-capabilities-portable.ts'),'the capabilities generator is tracked source');
 assert.equal(paths.includes('source-manifest.json'),false,'the manifest is computed at release time, not committed');
});

// ---- T1.4: the gates ----------------------------------------------------------------------------------------------

test('refuses a sha that is not an ancestor of origin/main, and says what to do',t=>{
 const s=scene(t);s.commit('on main');
 s.write('serve.mjs','console.log("a branch");\n');const branch=s.commit('only local',{push:false});
 const result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/not an ancestor of origin\/main/);assert.match(result.stderr,new RegExp(branch.slice(0,12)));assert.match(result.stderr,/--candidate/);
 assert.equal(fs.existsSync(s.home),false);assert.equal(s.calls(),'','the ancestry gate runs before CI is queried');
 // Pushed to a branch other than main is still not main.
 git(s.repo,'push','-q','origin','HEAD:refs/heads/feature');
 assert.match(s.run().stderr,/not an ancestor of origin\/main/);
});

test('refuses when origin cannot be fetched (offline), unless it is a candidate',t=>{
 const s=scene(t);s.commit('first');
 git(s.repo,'config','--unset','url.'+s.remote+'.insteadOf');git(s.repo,'remote','set-url','origin',path.join(s.base,'nowhere.git'));
 const result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/Cannot fetch origin\/main/);assert.match(result.stderr,/--candidate/);assert.equal(fs.existsSync(s.home),false);
});

test('--candidate releases a branch commit to a separate home, records it as a candidate, and needs no tag',t=>{
 const s=scene(t);s.commit('on main');
 s.write('serve.mjs','console.log("a branch");\n');const branch=s.commit('only local',{push:false});
 const result=s.run('--candidate');assert.equal(result.status,0,result.stderr);
 const rec=record(s.home);assert.equal(rec.sha,branch);assert.equal(rec.candidate,true);assert.equal(rec.tag,null);
 assert.equal(releases(s.home)[0].candidate,true);assert.match(result.stdout,/candidate/i);
 assert.equal(git(s.repo,'tag','--list').trim(),'','no tag is made for a candidate');
});

test('--candidate refuses the permanent home: by its config port, and by its documented path',t=>{
 const s=scene(t);s.commit('first');
 write(s.home,'config/local.json',JSON.stringify({port:8841}));
 let result=s.run('--candidate');assert.equal(result.status,1);assert.match(result.stderr,/permanent home/);assert.equal(fs.existsSync(path.join(s.home,'service')),false);
 // The documented path, found through HOME, with no config at all.
 const fakeHome=path.join(s.base,'fake-user-home'),permanent=path.join(fakeHome,'Library','Application Support','i64os','ar-create');
 result=spawnSync(process.execPath,[script,'--repo',s.repo,'--home',permanent,'--candidate'],{encoding:'utf8',env:{...process.env,HOME:fakeHome,AR_RELEASE_GH:s.gh,...s.env}});
 assert.equal(result.status,1);assert.match(result.stderr,/permanent home/);assert.equal(fs.existsSync(permanent),false);
 // A candidate home on another port is fine; a main release into the 8841 home is also fine.
 write(s.home,'config/local.json',JSON.stringify({port:8854}));
 assert.equal(s.run('--candidate').status,0);
});

test('requires a green `ci` check on the sha',t=>{
 const s=scene(t);const commit=s.commit('first');
 s.env.FAKE_GH_RUNS=JSON.stringify([]);
 let result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/No `ci` check has run/);
 s.env.FAKE_GH_RUNS=JSON.stringify([{name:'lint',status:'completed',conclusion:'success'}]);
 assert.match(s.run().stderr,/No `ci` check has run/);
 s.env.FAKE_GH_RUNS=JSON.stringify([{name:'ci',status:'completed',conclusion:'failure',started_at:'2026-11-01T10:00:00Z'}]);
 assert.match(s.run().stderr,/concluded failure/);
 s.env.FAKE_GH_RUNS=JSON.stringify([{name:'ci',status:'in_progress',conclusion:null,started_at:'2026-11-01T10:00:00Z'}]);
 assert.match(s.run().stderr,/in_progress; wait/);
 // A rerun that passed replaces an older failure; the newest run decides.
 s.env.FAKE_GH_RUNS=JSON.stringify([{name:'ci',status:'completed',conclusion:'failure',started_at:'2026-11-01T09:00:00Z'},{name:'ci',status:'completed',conclusion:'success',started_at:'2026-11-01T10:00:00Z'}]);
 assert.equal(s.run('--dry-run').status,0);
 assert.match(s.calls(),new RegExp(`api repos/acme/widgets/commits/${commit}/check-runs`));
 assert.equal(fs.existsSync(s.home),false);
});

test('refuses when gh is unavailable or the API errors, unless --no-ci-check carries a reason that is journaled',t=>{
 const s=scene(t);const commit=s.commit('first');
 s.env.AR_RELEASE_GH=path.join(s.base,'no-such-gh');
 let result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/`gh` is not installed/);assert.match(result.stderr,/--no-ci-check/);
 delete s.env.AR_RELEASE_GH;s.env.FAKE_GH_FAIL='1';
 assert.match(s.run().stderr,/HTTP 404/);
 // The flag needs a reason in words, not another flag.
 assert.match(s.run('--no-ci-check').stderr,/Unknown or incomplete|requires a reason/);
 assert.match(s.run('--no-ci-check','--dry-run').stderr,/requires a reason/);
 assert.equal(fs.existsSync(s.home),false);
 result=s.run('--no-ci-check','github is down and the fix is one line');assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/ci check: SKIPPED/);
 const rec=record(s.home);assert.equal(rec.sha,commit);assert.equal(rec.overrides.noCiCheck,'github is down and the fix is one line');
 assert.equal(releases(s.home)[0].overrides.noCiCheck,'github is down and the fix is one line');
 const month=new Date().toISOString().slice(0,7),line=JSON.parse(fs.readFileSync(path.join(s.home,'data/journal',month+'.jsonl'),'utf8').trim().split('\n').at(-1));
 assert.match(line.summary,/without a CI check: github is down and the fix is one line/);
});

test('requires --tag, creates an annotated local tag at the sha, prints the push command, and refuses a clashing tag',t=>{
 const s=scene(t);const first=s.commit('first');
 let result=spawnSync(process.execPath,[script,'--repo',s.repo,'--home',s.home],{encoding:'utf8',env:{...process.env,AR_RELEASE_GH:s.gh,...s.env}});
 assert.equal(result.status,1);assert.match(result.stderr,/--tag <name> is required/);assert.equal(fs.existsSync(s.home),false);
 result=s.run('--tag','v2026.11.01-1');assert.equal(result.status,0,result.stderr);
 assert.equal(git(s.repo,'cat-file','-t','refs/tags/v2026.11.01-1').trim(),'tag','annotated, not lightweight');
 assert.equal(git(s.repo,'rev-parse','v2026.11.01-1^{commit}').trim(),first);
 assert.match(result.stdout,/ push origin v2026\.11\.01-1/);
 assert.equal(record(s.home).tag,'v2026.11.01-1');
 assert.equal(git(s.remote,'tag','--list').trim(),'','the script never pushes the tag');
 // The same tag on the same sha is accepted again; on another sha it is refused, as is a lightweight tag.
 s.write('runtime/lib.mjs','export const one=3;\n');const second=s.commit('second');
 result=s.run('--tag','v2026.11.01-1');assert.equal(result.status,1);assert.match(result.stderr,/already points at/);
 git(s.repo,'tag','light-tag',second);
 assert.match(s.run('--tag','light-tag').stderr,/lightweight/);
 assert.match(s.run('--tag','bad..name').stderr,/not a valid tag name/);
 assert.equal(s.run('--tag','v2026.11.01-2').status,0);
});

test('caps releases at two a day per home; --hotfix with a reason is the journaled exception',t=>{
 const s=scene(t);s.commit('one');assert.equal(s.run().status,0);
 s.write('runtime/lib.mjs','export const one=2;\n');s.commit('two');assert.equal(s.run().status,0);
 s.write('runtime/lib.mjs','export const one=3;\n');const third=s.commit('three');
 let result=s.run();assert.equal(result.status,1);assert.match(result.stderr,/2 releases already went into this home today/);assert.match(result.stderr,/--hotfix/);
 assert.notEqual(record(s.home).sha,third,'nothing was installed');
 assert.match(s.run('--hotfix','').stderr,/requires a reason/);
 // A dry run reports the refusal too.
 assert.equal(s.run('--dry-run').status,1);
 result=s.run('--hotfix','the sheet shows the wrong price');assert.equal(result.status,0,result.stderr);
 assert.equal(record(s.home).sha,third);assert.equal(record(s.home).overrides.hotfix,'the sheet shows the wrong price');
 assert.equal(releases(s.home).at(-1).overrides.hotfix,'the sheet shows the wrong price');
 // Earlier days do not count: age the log, and the cap resets.
 const log=releases(s.home).map(line=>({...line,at:'2026-01-01T00:00:00.000Z'}));fs.writeFileSync(path.join(s.home,'RELEASES.jsonl'),log.map(line=>JSON.stringify(line)).join('\n')+'\n');
 s.write('runtime/lib.mjs','export const one=4;\n');s.commit('four');assert.equal(s.run().status,0);
 // Rollback is not a release and does not count.
 assert.equal(s.run('--rollback').status,0);
});

test('--deps-from is honoured only inside the checkout or the home; elsewhere the release runs npm ci',t=>{
 const s=scene(t,{extra:{'.gitignore':'node_modules\n','runtime/package.json':'{"name":"x"}\n','runtime/package-lock.json':'{"lockfileVersion":3}\n'}});s.commit('first');
 const modules=dir=>{write(dir,'runtime/node_modules/dep/index.js','x');write(dir,'runtime/package.json','{"name":"x"}\n');write(dir,'runtime/package-lock.json','{"lockfileVersion":3}\n');return dir;};
 const outside=modules(path.join(s.base,'a-codex-worktree'));
 let result=s.run('--dry-run','--deps-from',outside);assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/--deps-from .* is outside the checkout and the home/);assert.match(result.stdout,/dependencies runtime: npm ci/);assert.doesNotMatch(result.stdout,/copied from --deps-from/);
 write(s.repo,'runtime/node_modules/dep/index.js','x');
 result=s.run('--dry-run','--deps-from',s.repo);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/copied from --deps-from/);
 // Inside the home counts too.
 modules(path.join(s.home,'service'));
 result=s.run('--dry-run','--deps-from',path.join(s.home,'service'));assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/copied from --deps-from/);
});
