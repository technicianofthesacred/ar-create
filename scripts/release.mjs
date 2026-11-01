#!/usr/bin/env node
// Make the installed app an exact, recorded release of one git commit.
//
//   node scripts/release.mjs --home <dir> --tag <name> [--dry-run]
//   node scripts/release.mjs --home <candidate-dir> --candidate [--tag <name>]
//   node scripts/release.mjs --home <dir> --rollback
//   node scripts/release.mjs --home <dir> --verify
//
// Options: --tag <name> (required for a release; an annotated local tag is created or verified at the sha),
// --candidate (release a commit that is not on origin/main, into a home that is NOT the permanent one),
// --no-ci-check "<reason>" and --hotfix "<reason>" (journaled overrides, see below), --deps-from <dir> (a folder inside
// this checkout or the home whose runtime/node_modules and mcp/study/node_modules match this commit's lockfiles; anything
// else is ignored and `npm ci` runs in the build folder), --built-by <actor> (default: AR_CREATE_ACTOR or
// human:<user>), --repo <dir> (tests only; default is the checkout this script lives in).
//
// Gates, all checked before anything is written (a refusal creates nothing):
//   1. a clean tree;
//   2. the sha is an ancestor of origin/main, as just fetched (offline refuses) -- unless --candidate, which refuses the
//      permanent home (the documented path, or any home whose config port is 8841);
//   3. a green `ci` check on the sha, read with `gh api` -- unless --no-ci-check "<reason>"; no gh, no check, or a red or
//      running check refuses;
//   4. --tag, annotated, local only (the script prints the push command);
//   5. at most two releases per calendar day per home (read from <home>/RELEASES.jsonl) -- unless --hotfix "<reason>".
// Overrides are recorded in RELEASE.json, RELEASES.jsonl and the data journal line.
//
// What it does: computes the source manifest from the clean checkout's tracked files (the manifest is not a committed
// file); copies exactly those files into <home>/service.next; installs the runtime dependencies; builds the generated
// files (npm run build) inside the staging folder; removes tests and developer tooling; refuses any file that is not in
// the manifest or declared generated; smoke-imports the server; swaps service.next in for <home>/service (the old one stays
// as <home>/service.prev) and writes <home>/RELEASE.json (with manifestSha256) and the manifest into <home>/service. It never
// touches <home>/data, <home>/config or <home>/state, and it never starts or stops anything: it prints the restart command.
// After the swap it also copies the repo's AGENTS.md (resolved through the CLAUDE.md symlink) to <home>/AGENTS.md
// and appends one `release:<sha>` line to <home>/data/journal/<yyyy-mm>.jsonl (the only thing it ever writes in data/).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createJournal} from '../runtime/services/journal.mjs';
import {GENERATED,MANIFEST_FILE,NOT_SHIPPED,PRUNE_AFTER_BUILD,REQUIRED_GENERATED,buildManifest,git,sha256} from './lib/manifest.mjs';
import {assertGreen,assertOnMain,assertReason,assertUnderCap,checkTag,createTag,deleteTag,isInside,isPermanentHome} from './lib/release-gates.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const DEPENDENCY_DIRS=['runtime','mcp/study'];

function parse(argv){
 const options={};const flags=new Set(['--dry-run','--rollback','--verify','--candidate']);const values=new Set(['--home','--deps-from','--tag','--built-by','--repo','--no-ci-check','--hotfix']);
 for(let i=0;i<argv.length;i++){
  if(flags.has(argv[i]))options[argv[i].slice(2)]=true;
  else if(values.has(argv[i])&&argv[i+1]!==undefined)options[argv[i].slice(2)]=argv[++i];
  else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
 }
 return options;
}

function walk(dir,relative=''){
 const files=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const name=relative?relative+'/'+entry.name:entry.name;
  if(entry.name==='node_modules')continue;
  if(entry.isDirectory())files.push(...walk(path.join(dir,entry.name),name));else files.push(name);
 }
 return files;
}
const remove=target=>fs.rmSync(target,{recursive:true,force:true});
const safeRename=(from,to)=>fs.renameSync(from,to);
function checkHome(home,repo){
 if(!home||!path.isAbsolute(home))throw new Error('--home requires an absolute directory.');
 const resolved=path.resolve(home);
 const relative=path.relative(repo,resolved);
 // Inside the checkout is allowed only for an ignored folder (the .test-home used by tests), never for the checkout itself.
 if(!relative.startsWith('..')&&!path.isAbsolute(relative)){
  if(relative==='')throw new Error('--home must not be the source checkout itself.');
  try{git(repo,'check-ignore','-q',resolved);}catch{throw new Error('--home must be outside the source checkout (or an ignored folder inside it, such as .test-home).');}
 }
 if(path.relative(resolved,repo)===''||!path.relative(resolved,repo).startsWith('..'))throw new Error('--home must not contain the source checkout.');
 let at=resolved;
 while(true){const stat=fs.lstatSync(at,{throwIfNoEntry:false});if(stat?.isSymbolicLink())throw new Error(`Symlinked home paths are refused: ${at}`);const parent=path.dirname(at);if(parent===at)break;at=parent;}
 for(const name of ['service','service.next','service.prev']){const stat=fs.lstatSync(path.join(resolved,name),{throwIfNoEntry:false});if(stat&&(stat.isSymbolicLink()||!stat.isDirectory()))throw new Error(`${name} must be a real directory.`);}
 return resolved;
}
function restartHint(home){
 const script=['restart.py','start.py'].map(name=>path.join(home,name)).find(file=>fs.existsSync(file));
 return script?`python3 ${JSON.stringify(script)}`:`(no launcher found in ${home}; start <home>/service/serve.mjs with AR_CREATE_CONFIG=<home>/config/local.json)`;
}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function appendLog(home,entry){fs.appendFileSync(path.join(home,'RELEASES.jsonl'),JSON.stringify(entry)+'\n');}

// The agent entry file travels with the release: <home>/AGENTS.md is the repo's AGENTS.md (a symlink target is followed).
function copyAgentsFile(repo,home,log){
 const source=path.join(repo,'AGENTS.md');
 if(!fs.existsSync(source)){log('  AGENTS.md: none in this commit; nothing copied');return false;}
 const target=path.join(home,'AGENTS.md'),temp=target+'.next';
 fs.writeFileSync(temp,fs.readFileSync(fs.realpathSync(source)));fs.renameSync(temp,target);
 log(`  AGENTS.md copied to ${target}`);return true;
}
// One journal line, through the app's own journal writer, so history shows when each release happened.
async function journalRelease({home,sha,tag,by,at,previousSha,overrides={},candidate=false,log}){
 const data=path.join(home,'data');
 try{
  fs.mkdirSync(data,{recursive:true,mode:0o700});
  const journal=createJournal({dataDir:data,now:()=>new Date(at)});
  const actor=/^(human|agent|cron|import):[A-Za-z0-9._-]+$/.test(by)?by:'human:release';
  const notes=[candidate?'candidate':null,overrides.noCiCheck?`without a CI check: ${overrides.noCiCheck}`:null,overrides.hotfix?`hotfix over the daily cap: ${overrides.hotfix}`:null].filter(Boolean);
  await journal.append({operationId:null,actor,client:'file',scope:{kind:'system',id:sha},kind:'release:'+sha,status:'committed',before:{revision:null,hash:previousSha},after:{revision:null,hash:sha},summary:`Released ${sha.slice(0,12)}${tag?` (${tag})`:''}${notes.length?` [${notes.join('; ')}]`:''}.`});
  log('  journal: release line written');return true;
 }catch(error){log(`  journal: release line NOT written (${error.message})`);return false;}
}

function cleanTree(repo){
 const dirty=git(repo,'status','--porcelain','--untracked-files=all').split('\n').filter(Boolean);
 if(dirty.length)throw new Error(`Refusing to release a dirty tree (${dirty.length} change${dirty.length===1?'':'s'}). Commit or discard first:\n  ${dirty.slice(0,10).join('\n  ')}${dirty.length>10?'\n  ...':''}`);
}

function plan(repo){
 cleanTree(repo);
 const sha=git(repo,'rev-parse','HEAD').trim();
 return {sha};
}
// The manifest is computed here, from the clean checkout, and checked by verify:package; it is never read from a file.
function computeManifest(repo){
 const built=buildManifest(repo);
 const checker=path.join(repo,'scripts/check-package.mjs');
 if(fs.existsSync(checker)){try{execFileSync(process.execPath,[checker],{cwd:repo,encoding:'utf8',stdio:'pipe'});}catch(error){throw new Error('check-package refused this commit:\n'+String(error.stderr||error.message).split('\n').filter(line=>/Error:/.test(line)).join('\n'));}}
 const shipped=built.rows.map(row=>row.path).filter(file=>!NOT_SHIPPED(file));
 return {...built,shipped,notShipped:built.rows.length-shipped.length};
}

// Every refusal that does not need the manifest, in the order a person would fix them.
function gates({repo,home,sha,tag,candidate,noCiCheck,hotfix,log}){
 const overrides={};
 if(noCiCheck!==undefined&&noCiCheck!==null)overrides.noCiCheck=assertReason('--no-ci-check',noCiCheck);
 if(hotfix!==undefined&&hotfix!==null)overrides.hotfix=assertReason('--hotfix',hotfix);
 if(candidate){
  if(isPermanentHome(home))throw new Error(`--candidate refuses the permanent home (${home}): a commit that is not on origin/main must go to a candidate home on its own port, for example --home ~/Library/Application\\ Support/i64os/ar-create-candidate.`);
  log(`  origin/main: skipped (--candidate); candidate home ${home}`);
 }else{
  assertOnMain(repo,sha);log(`  origin/main: ${sha.slice(0,12)} is on origin/main`);
 }
 if(overrides.noCiCheck)log(`  ci check: SKIPPED (--no-ci-check: ${overrides.noCiCheck})`);
 else{const green=assertGreen(repo,sha);log(`  ci check: ${green.conclusion} (${green.check})`);}
 let tagState=null;
 if(candidate&&!tag)log('  tag: none (candidate)');
 else{tagState=checkTag(repo,tag,sha);log(`  tag: ${tag} (${tagState.exists?'exists, annotated, at this sha':'will be created, annotated, local'})`);}
 if(overrides.hotfix)log(`  daily cap: bypassed (--hotfix: ${overrides.hotfix})`);
 else assertUnderCap(home);
 return {overrides,tagState};
}

function dependencySource({relative,staged,home,depsFrom,repo,log}){
 const lock=path.join(staged,relative,'package-lock.json');
 if(!fs.existsSync(path.join(staged,relative,'package.json')))return null;
 const lockSha=fs.existsSync(lock)?sha256(fs.readFileSync(lock)):null;
 const candidates=[];
 // Only a folder inside the checkout being released or inside the home may supply node_modules; a scratch worktree
 // somewhere else may be garbage-collected or built from other lockfiles (review F-06/F-07), so `npm ci` runs instead.
 if(depsFrom){
  if(isInside(repo,depsFrom)||isInside(home,depsFrom))candidates.push({from:path.resolve(depsFrom),why:'--deps-from'});
  else if(relative===DEPENDENCY_DIRS[0])log?.(`  --deps-from ${path.resolve(depsFrom)} is outside the checkout and the home; ignored, npm ci will run in the build folder`);
 }
 candidates.push({from:path.join(home,'service'),why:'the current service'});
 for(const candidate of candidates){
  const modules=path.join(candidate.from,relative,'node_modules'),otherLock=path.join(candidate.from,relative,'package-lock.json');
  if(!fs.existsSync(modules)||!lockSha||!fs.existsSync(otherLock))continue;
  if(sha256(fs.readFileSync(otherLock))===lockSha)return {mode:'copy',modules,description:`copied from ${candidate.why} (${candidate.from})`};
  if(candidate.why==='--deps-from')throw new Error(`--deps-from ${candidate.from}: ${relative}/package-lock.json differs from this commit, so its node_modules do not match.`);
 }
 return {mode:'npm-ci',description:'npm ci (needs the network)'};
}

function installDependencies(options){
 const record={};
 for(const relative of DEPENDENCY_DIRS){
  const source=dependencySource({...options,relative});
  if(!source)continue;
  const target=path.join(options.staged,relative);
  if(source.mode==='copy')fs.cpSync(source.modules,path.join(target,'node_modules'),{recursive:true,verbatimSymlinks:true,preserveTimestamps:true});
  else execFileSync('npm',['ci','--prefix',target],{stdio:'inherit'});
  record[relative]=source.description;options.log(`  dependencies ${relative}: ${source.description}`);
 }
 return record;
}

function build(staged,log){
 const script=path.join(staged,'runtime/scripts/build-document-study.mjs');
 if(!fs.existsSync(script)){log('  build: no runtime/scripts/build-document-study.mjs in this commit; nothing generated');return false;}
 execFileSync(process.execPath,[script],{cwd:path.join(staged,'runtime'),env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,LANG:process.env.LANG||'en_US.UTF-8'},stdio:'pipe',encoding:'utf8'});
 log('  build: generated files built from reviewed source');return true;
}

// Everything in the staging folder must be a shipped manifest file, the manifest itself, or a declared generated file.
function checkAllowlist({staged,shipped,rows}){
 const allowed=new Set([...shipped,MANIFEST_FILE,...[...GENERATED].filter(file=>!PRUNE_AFTER_BUILD(file))]);
 const present=new Set(walk(staged));
 const extra=[...present].filter(file=>!allowed.has(file));
 if(extra.length)throw new Error(`Refusing files that are not in the manifest and not declared generated (${extra.length}):\n  ${extra.slice(0,15).join('\n  ')}`);
 const byPath=new Map(rows.map(row=>[row.path,row]));
 const bad=shipped.filter(file=>!present.has(file)||sha256(fs.readFileSync(path.join(staged,file)))!==byPath.get(file).candidateSha256);
 if(bad.length)throw new Error(`Staged files differ from the manifest (${bad.length}):\n  ${bad.slice(0,15).join('\n  ')}`);
 if(present.has('runtime/server.mjs')){const absent=REQUIRED_GENERATED.filter(file=>!present.has(file));if(absent.length)throw new Error(`The build did not produce files the server imports:\n  ${absent.join('\n  ')}`);}
 return Object.fromEntries([...present].filter(file=>GENERATED.has(file)).sort().map(file=>[file,sha256(fs.readFileSync(path.join(staged,file)))]));
}

function smoke(staged,log){
 const server=path.join(staged,'runtime/server.mjs');
 if(!fs.existsSync(server))return;
 const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR};
 execFileSync(process.execPath,['--check',path.join(staged,'serve.mjs')],{cwd:staged,env,stdio:'pipe'});
 execFileSync(process.execPath,['--input-type=module','-e','await import(process.argv[1]);'+'console.log("imports resolve");',pathToFileURL(server).href],{cwd:staged,env,stdio:'pipe',encoding:'utf8'});
 log('  smoke: server.mjs imports resolve and serve.mjs parses');
}

export async function release({home,repo=path.resolve(here,'..'),dryRun=false,depsFrom=null,tag=null,candidate=false,noCiCheck=null,hotfix=null,builtBy=null,log=console.log}={}){
 repo=fs.realpathSync(repo);home=checkHome(home,repo);
 const {sha}=plan(repo);
 log(`release ${sha.slice(0,12)}${tag?` (${tag})`:''}${candidate?' as a CANDIDATE':''} from ${repo}`);
 const {overrides,tagState}=gates({repo,home,sha,tag,candidate,noCiCheck,hotfix,log});
 const {rows,text:manifestText,sha256:manifestHash,shipped,notShipped}=computeManifest(repo);
 const staged=path.join(home,'service.next'),live=path.join(home,'service'),previous=path.join(home,'service.prev');
 const current=readJson(path.join(home,'RELEASE.json'));
 const depsPreview=DEPENDENCY_DIRS.filter(relative=>fs.existsSync(path.join(repo,relative,'package.json'))).map(relative=>`${relative}: ${dependencySource({relative,staged:repo,home,depsFrom,repo,log}).description}`);
 log(`  manifest computed from the clean checkout: ${rows.length} files, sha256 ${manifestHash.slice(0,12)}; shipped ${shipped.length}; kept out (tests, todo, .gitignore) ${notShipped}`);
 log(`  currently installed: ${current?`${String(current.sha).slice(0,12)} built ${current.builtAt}`:'no RELEASE.json'}`);
 for(const line of depsPreview)log(`  dependencies ${line}`);
 if(dryRun){
  log(`  would: ${tag&&!tagState?.exists?`tag ${tag}; `:''}stage ${staged}; build generated files; keep ${previous}; swap into ${live}; write ${path.join(home,'RELEASE.json')}; copy AGENTS.md to ${path.join(home,'AGENTS.md')}; append a release:${sha.slice(0,12)} line to ${path.join(home,'data/journal')}`);
  log('  dry run: nothing written, no tag made, nothing started or stopped.');
  return {dryRun:true,sha,shipped:shipped.length};
 }
 fs.mkdirSync(home,{recursive:true});
 const lock=path.join(home,'.release.lock');let lockFd,madeTag=false;
 try{lockFd=fs.openSync(lock,'wx');}catch{throw new Error(`Another release is in progress (${lock} exists). If none is, delete that file.`);}
 try{
  if(tag&&!tagState.exists){createTag(repo,tag,sha);madeTag=true;}
  remove(staged);fs.mkdirSync(staged,{recursive:true});
  for(const file of rows.map(row=>row.path)){const target=path.join(staged,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repo,file),target);fs.chmodSync(target,fs.statSync(path.join(repo,file)).mode&0o777);}
  fs.writeFileSync(path.join(staged,MANIFEST_FILE),manifestText);
  log(`  staged ${rows.length+1} files in ${staged}`);
  const dependencies=installDependencies({staged,home,depsFrom,repo,log});
  build(staged,log);
  for(const file of walk(staged))if(PRUNE_AFTER_BUILD(file))remove(path.join(staged,file));
  const generated=checkAllowlist({staged,shipped,rows});
  log(`  allowlist: ${shipped.length} manifest files + ${Object.keys(generated).length} generated, nothing else`);
  smoke(staged,log);
  const hasOverrides=Object.keys(overrides).length>0;
  const record={schema:'ar-create.release.v1',sha,tag:tag||null,candidate:!!candidate,builtAt:new Date().toISOString(),builtBy:builtBy||process.env.AR_CREATE_ACTOR||`human:${os.userInfo().username}`,manifestSha256:manifestHash,shipped:shipped.length,generated,dependencies,previousSha:current?.sha||null,...(hasOverrides?{overrides}:{})};
  fs.writeFileSync(path.join(home,'RELEASE.json.next'),JSON.stringify(record,null,2)+'\n');
  // Swap. The old service is kept whole as service.prev (the one before it is dropped; it is code, never data).
  remove(previous);
  const hadLive=fs.existsSync(live);
  if(hadLive)safeRename(live,previous);
  try{safeRename(staged,live);}catch(error){if(hadLive)safeRename(previous,live);throw error;}
  if(fs.existsSync(path.join(home,'RELEASE.json')))safeRename(path.join(home,'RELEASE.json'),path.join(home,'RELEASE.prev.json'));
  safeRename(path.join(home,'RELEASE.json.next'),path.join(home,'RELEASE.json'));
  madeTag=false;
  appendLog(home,{action:'release',sha,tag:record.tag,candidate:record.candidate,at:record.builtAt,by:record.builtBy,previousSha:record.previousSha,...(hasOverrides?{overrides}:{})});
  copyAgentsFile(repo,home,log);
  await journalRelease({home,sha,tag:record.tag,by:record.builtBy,at:record.builtAt,previousSha:record.previousSha,overrides,candidate:record.candidate,log});
  log(`released ${sha.slice(0,12)} into ${live}${hadLive?`; previous kept at ${previous}`:''}`);
  if(tag)log(`tagged ${tag} locally (annotated, at ${sha.slice(0,12)}); publish it with: git -C ${JSON.stringify(repo)} push origin ${tag}`);
  log(`restart (not done by this script): ${restartHint(home)}`);
  return {dryRun:false,sha,record};
 }catch(error){
  remove(staged);remove(path.join(home,'RELEASE.json.next'));if(madeTag)deleteTag(repo,tag);throw error;
 }finally{fs.closeSync(lockFd);remove(lock);}
}

export function rollback({home,repo=path.resolve(here,'..'),log=console.log}={}){
 repo=fs.realpathSync(repo);home=checkHome(home,repo);
 const live=path.join(home,'service'),previous=path.join(home,'service.prev'),swap=path.join(home,'service.swap');
 if(!fs.existsSync(previous))throw new Error('There is no service.prev to roll back to.');
 const lock=path.join(home,'.release.lock');let lockFd;
 try{lockFd=fs.openSync(lock,'wx');}catch{throw new Error(`Another release is in progress (${lock} exists).`);}
 try{
  const from=readJson(path.join(home,'RELEASE.json')),to=readJson(path.join(home,'RELEASE.prev.json'));
  remove(swap);
  // A three-way rename so that a second rollback undoes this one.
  if(fs.existsSync(live))safeRename(live,swap);
  safeRename(previous,live);
  if(fs.existsSync(swap))safeRename(swap,previous);
  const releaseNow=path.join(home,'RELEASE.json'),releasePrev=path.join(home,'RELEASE.prev.json'),releaseSwap=path.join(home,'RELEASE.swap.json');
  if(fs.existsSync(releaseNow))safeRename(releaseNow,releaseSwap);
  if(fs.existsSync(releasePrev))safeRename(releasePrev,releaseNow);
  if(fs.existsSync(releaseSwap))safeRename(releaseSwap,releasePrev);
  appendLog(home,{action:'rollback',from:from?.sha||null,to:to?.sha||null,at:new Date().toISOString()});
  log(`rolled back ${from?String(from.sha).slice(0,12):'unrecorded'} -> ${to?String(to.sha).slice(0,12):'unrecorded'}; run --rollback again to undo`);
  log(`restart (not done by this script): ${restartHint(home)}`);
  return {from,to};
 }finally{fs.closeSync(lockFd);remove(lock);}
}

export function verify({home,repo=path.resolve(here,'..'),log=console.log}={}){
 repo=fs.realpathSync(repo);home=checkHome(home,repo);
 const record=readJson(path.join(home,'RELEASE.json')),live=path.join(home,'service');
 if(!record)throw new Error('No RELEASE.json: the installed service is not a recorded release.');
 const manifestFile=path.join(live,MANIFEST_FILE);
 if(!fs.existsSync(manifestFile))throw new Error('The installed service has no source-manifest.json.');
 if(sha256(fs.readFileSync(manifestFile))!==record.manifestSha256)throw new Error('The installed source-manifest.json is not the one this release recorded.');
 const rows=JSON.parse(fs.readFileSync(manifestFile,'utf8'));const all=[...rows.included,...rows.authored];
 const shipped=all.map(row=>row.path).filter(file=>!NOT_SHIPPED(file)),byPath=new Map(all.map(row=>[row.path,row]));
 const allowed=new Set([...shipped,MANIFEST_FILE,...Object.keys(record.generated||{})]);
 const present=walk(live),problems=[];
 for(const file of present)if(!allowed.has(file))problems.push('not in manifest: '+file);
 for(const file of shipped){if(!present.includes(file))problems.push('missing: '+file);else if(sha256(fs.readFileSync(path.join(live,file)))!==byPath.get(file).candidateSha256)problems.push('changed: '+file);}
 for(const [file,hash] of Object.entries(record.generated||{}))if(present.includes(file)&&sha256(fs.readFileSync(path.join(live,file)))!==hash)problems.push('generated file changed: '+file);
 if(problems.length)throw new Error(`The installed service does not match release ${String(record.sha).slice(0,12)} (${problems.length}):\n  ${problems.slice(0,20).join('\n  ')}`);
 log(`verified: <home>/service is exactly release ${String(record.sha).slice(0,12)} (${shipped.length} manifest files + ${Object.keys(record.generated||{}).length} generated).`);
 return record;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const options=parse(process.argv.slice(2));
  const common={home:options.home,...(options.repo?{repo:options.repo}:{})};
  if(options.rollback)rollback(common);
  else if(options.verify)verify(common);
  else await release({...common,dryRun:!!options['dry-run'],depsFrom:options['deps-from']||null,tag:options.tag||null,candidate:!!options.candidate,noCiCheck:options['no-ci-check']??null,hotfix:options.hotfix??null,builtBy:options['built-by']||null});
 }catch(error){console.error('release refused: '+error.message);process.exit(1);}
}
