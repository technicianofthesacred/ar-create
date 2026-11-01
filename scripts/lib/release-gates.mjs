// The refusals scripts/release.mjs applies before it writes anything (review R2-02, F-31).
// Each gate either returns quietly or throws an Error whose message says what to do next.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {git} from './manifest.mjs';

export const INSTALLED_PORT=8841;
export const CANDIDATE_PORT=8854;
export const RELEASES_PER_DAY=2;
// A check run counts as "the" CI result when its name is `ci` (or `ci (...)`, `ci / ...`).
export const CI_CHECK_NAME=/^ci(?:$|[\s/(])/i;

export const permanentHome=()=>path.join(os.homedir(),'Library','Application Support','i64os','ar-create');

function realOrResolved(target){try{return fs.realpathSync(target);}catch{return path.resolve(target);}}
export function isInside(parent,child){
 const relative=path.relative(realOrResolved(parent),realOrResolved(child));
 return relative===''||(!relative.startsWith('..')&&!path.isAbsolute(relative));
}

// The permanent home is the documented install path, or any home whose config says it serves the installed port.
export function isPermanentHome(home){
 if(realOrResolved(home)===realOrResolved(permanentHome()))return true;
 try{const config=JSON.parse(fs.readFileSync(path.join(home,'config','local.json'),'utf8'));return Number(config?.port)===INSTALLED_PORT;}catch{return false;}
}

// A sha is releasable to the permanent home only when it is an ancestor of origin/main, as just fetched.
export function assertOnMain(repo,sha){
 try{git(repo,'fetch','--quiet','origin','+refs/heads/main:refs/remotes/origin/main');}
 catch(error){throw new Error(`Cannot fetch origin/main, so ${sha.slice(0,12)} cannot be shown to be on main (${String(error.stderr||error.message).trim().split('\n')[0]}). Release again when online, or use --candidate with a candidate home.`);}
 try{git(repo,'merge-base','--is-ancestor',sha,'refs/remotes/origin/main');}
 catch{throw new Error(`${sha.slice(0,12)} is not an ancestor of origin/main. Merge it through a pull request first, or use --candidate with a candidate home (not the permanent one).`);}
}

export function githubSlug(repo){
 let url='';try{url=git(repo,'config','--get','remote.origin.url').trim();}catch{}
 const match=/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(url);
 return match?{owner:match[1],name:match[2]}:null;
}

// The newest `ci` check run on the sha must be completed and successful. Needs `gh`, logged in.
export function assertGreen(repo,sha,{gh=process.env.AR_RELEASE_GH||'gh'}={}){
 const slug=githubSlug(repo);
 if(!slug)throw new Error('Cannot find the GitHub repository from the origin remote, so the CI result cannot be checked. Pass --no-ci-check "<reason>" to release without it (the reason is journaled).');
 let raw;
 try{raw=execFileSync(gh,['api',`repos/${slug.owner}/${slug.name}/commits/${sha}/check-runs?per_page=100`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:16*1024*1024});}
 catch(error){
  const why=error.code==='ENOENT'?'`gh` is not installed':String(error.stderr||error.message).trim().split('\n')[0];
  throw new Error(`Cannot read the CI result for ${sha.slice(0,12)} (${why}). Pass --no-ci-check "<reason>" to release without it (the reason is journaled).`);
 }
 let runs;try{runs=JSON.parse(raw).check_runs;}catch{runs=null;}
 if(!Array.isArray(runs))throw new Error(`GitHub returned no check-run list for ${sha.slice(0,12)}. Pass --no-ci-check "<reason>" to release without it.`);
 const ci=runs.filter(run=>CI_CHECK_NAME.test(String(run.name||'')));
 if(!ci.length)throw new Error(`No \`ci\` check has run on ${sha.slice(0,12)} (${runs.length} other check${runs.length===1?'':'s'}). Open or update the pull request so CI runs, or pass --no-ci-check "<reason>".`);
 const newest=ci.reduce((a,b)=>(Date.parse(b.started_at||0)||0)>=(Date.parse(a.started_at||0)||0)?b:a);
 if(newest.status!=='completed')throw new Error(`The \`ci\` check on ${sha.slice(0,12)} is ${newest.status}; wait for it to finish.`);
 if(newest.conclusion!=='success')throw new Error(`The \`ci\` check on ${sha.slice(0,12)} concluded ${newest.conclusion}, not success. Fix main, or pass --no-ci-check "<reason>".`);
 return {check:newest.name,conclusion:newest.conclusion};
}

// Every release is tagged. An existing tag must be annotated and point at this sha; a new one is created later.
export function checkTag(repo,tag,sha){
 if(!tag)throw new Error('--tag <name> is required (for example v2026.11.01-1). Tags are annotated and local; the script prints the push command.');
 try{git(repo,'check-ref-format',`refs/tags/${tag}`);}catch{throw new Error(`--tag ${JSON.stringify(tag)} is not a valid tag name.`);}
 let type=null;try{type=git(repo,'cat-file','-t',`refs/tags/${tag}`).trim();}catch{}
 if(type===null)return {exists:false};
 if(type!=='tag')throw new Error(`Tag ${tag} exists but is lightweight. Releases use annotated tags; pick another name or delete it.`);
 const target=git(repo,'rev-parse',`refs/tags/${tag}^{commit}`).trim();
 if(target!==sha)throw new Error(`Tag ${tag} already points at ${target.slice(0,12)}, not ${sha.slice(0,12)}. Use a new tag name.`);
 return {exists:true};
}
export function createTag(repo,tag,sha){git(repo,'tag','-a',tag,'-m',`Release ${tag} (${sha.slice(0,12)})`,sha);}
export function deleteTag(repo,tag){try{git(repo,'tag','-d',tag);}catch{}}

const localDay=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;};
export function releasesToday(home,now=new Date()){
 let text='';try{text=fs.readFileSync(path.join(home,'RELEASES.jsonl'),'utf8');}catch{return 0;}
 const today=localDay(now);
 return text.split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(entry=>entry?.action==='release'&&localDay(entry.at)===today).length;
}
export function assertUnderCap(home){
 const count=releasesToday(home);
 if(count>=RELEASES_PER_DAY)throw new Error(`${count} releases already went into this home today; the ceiling is ${RELEASES_PER_DAY} a day. Batch the next change into tomorrow's, or pass --hotfix "<reason>" (journaled).`);
}

// --no-ci-check and --hotfix carry a reason, so a flag swallowed from the next argument is not accepted as one.
export function assertReason(flag,reason){
 if(typeof reason!=='string'||!reason.trim()||reason.startsWith('--'))throw new Error(`${flag} requires a reason in words, for example ${flag} "main CI is down, fix is one line".`);
 return reason.trim();
}
