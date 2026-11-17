#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {git} from './lib/manifest.mjs';
import {assertGreen,assertOnMain,checkTag,githubSlug} from './lib/release-gates.mjs';

const workflow='ci.yml';

export function requestReleaseCI(repo,tag,{gh=process.env.AR_RELEASE_GH||'gh',log=console.log}={}){
 const sha=git(repo,'rev-parse','HEAD').trim();
 if(!checkTag(repo,tag,sha).exists)throw new Error('Create the annotated release tag on this commit first.');
 assertOnMain(repo,sha);

 const tagRef=`refs/tags/${tag}`,branchRef=`refs/heads/${tag}`;
 const refs=new Map(git(repo,'ls-remote','origin',branchRef,tagRef,`${tagRef}^{}`).trim().split('\n').map(line=>{
  const [oid,ref]=line.split('\t');
  return [ref,oid];
 }));
 if(refs.has(branchRef))throw new Error(`A remote branch is also named ${tag}. Choose a different release tag.`);
 if(refs.get(`${tagRef}^{}`)!==sha)throw new Error(`Push the annotated tag ${tag} at ${sha.slice(0,12)} before requesting CI.`);

 const source=git(repo,'show',`${sha}:.github/workflows/${workflow}`);
 const picker=source.match(/^  pick-runner:\s*\n((?:    .*\n|\n)*)/m)?.[1];
 if(!/^    runs-on: ubuntu-slim\s*$/m.test(picker||'')){
  throw new Error(`The release tag ${tag} uses a workflow without Ubuntu Slim for pick-runner. Select a newer commit and use a new tag.`);
 }

 const slug=githubSlug(repo);
 if(!slug)throw new Error('Cannot find the GitHub repository from origin.');
 const repository=`${slug.owner}/${slug.name}`;
 const runGH=args=>execFileSync(gh,args,{encoding:'utf8',timeout:60000}).trim();
 const {workflow_runs:runs}=JSON.parse(runGH(['api',`repos/${repository}/actions/workflows/${workflow}/runs?head_sha=${sha}&per_page=100`]));
 const active=runs.find(run=>run.status!=='completed');
 if(active){
  log(`CI already ${active.status} for ${sha.slice(0,12)}: ${active.html_url}`);
  return;
 }
 if(runs.length){
  try{assertGreen(repo,sha,{gh});}
  catch(error){throw new Error(`${error.message} Review the existing run before any retry: ${runs[0].html_url}`);}
  log(`CI already passed for ${sha.slice(0,12)}: ${runs.find(run=>run.conclusion==='success')?.html_url||runs[0].html_url}`);
  return;
 }

 const result=runGH(['workflow','run',workflow,'--repo',repository,'--ref',tag]);
 log(`CI requested for ${tag} at ${sha.slice(0,12)}. ${result||`https://github.com/${repository}/actions/workflows/${workflow}`}`);
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw new Error('Usage: node scripts/release-ci.mjs <release-tag>');
  requestReleaseCI(fileURLToPath(new URL('..',import.meta.url)),process.argv[2]);
 }catch(error){console.error(`release CI refused: ${error.message}`);process.exitCode=1;}
}
