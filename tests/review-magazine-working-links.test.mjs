import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveMagazineWorkingTargets as resolve} from '../runtime/services/review-magazine-working-links.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex'),hash='a'.repeat(64),rel='Workflow/3-Develop/DEV - Invented.md';
function fixture(){
 const roots=[{id:'a',path:'/invented/a',canonical:'/invented/a'},{id:'b',path:'/invented/b',canonical:'/invented/b'}];
 const artifact=(root,path=rel,part='')=>({artifactId:'mag_'+sha(root.id+'\0'+root.canonical+'\0'+path),kind:'DEV',archived:false,relativePath:path,hash,part,provenance:{rootId:root.id,rootPath:root.path,relativePath:path,sha256:hash}});
 const stories=roots.map(root=>({id:'portfolio-'+root.id,name:'Same title',artifacts:[artifact(root)]}));
 return {roots,stories,projectLinks:{'portfolio-a':{nativeProjectId:'browser-clay'},'portfolio-b':{nativeProjectId:'browser-clay'}},owner:{schema:'ar-create.magazine-working-catalog.v1',configured:true,writable:true,registered:true,rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:sha(roots[0].canonical)},stories:[{storyId:'registered',archived:false,pieces:[{pieceId:'registered:article',kind:'article',part:null,relativePath:rel,hash,editable:true}]}]},artifact};
}
test('same paths, hashes and titles in two roots join only exact configured writer root',()=>{const f=fixture(),result=resolve(f);assert.equal(result.targets.length,1);assert.equal(result.targets[0].artifactId,f.stories[0].artifacts[0].artifactId);assert.equal(result.targets[0].editable,true);assert.equal(result.targets[0].storyId,'registered');assert.ok(!JSON.stringify(result).includes('/invented/'));});
test('explicit native identity is required; display names never match',()=>{const f=fixture();f.projectLinks={};assert.deepEqual(resolve(f).targets,[]);});
test('registration, configuration, offline and unknown root states fail closed',()=>{for(const change of [{registered:false},{configured:false},{rootIdentity:null},{rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:'b'.repeat(64)}}])assert.deepEqual(resolve({...fixture(),owner:{...fixture().owner,...change}}).targets,[]);assert.equal(resolve({}).reason,'invalid-owner-catalog');});
test('read-only registered target carries no editable capability',()=>{const f=fixture();f.owner.writable=false;const r=resolve(f);assert.equal(r.targets.length,1);assert.equal(r.targets[0].editable,false);assert.equal(r.reason,'owner-read-only');});
test('current file hash, opaque ID, provenance, archival and piece ambiguity refuse joins',()=>{for(const mutate of [f=>f.owner.stories[0].pieces[0].hash='b'.repeat(64),f=>f.stories[0].artifacts[0].artifactId='mag_'+hash,f=>f.stories[0].artifacts[0].provenance.rootId='b',f=>f.stories[0].artifacts[0].archived=true,f=>f.owner.stories[0].pieces.push({...f.owner.stories[0].pieces[0],pieceId:'second'}),f=>f.owner.stories.push({...f.owner.stories[0]})]){const f=fixture();mutate(f);assert.deepEqual(resolve(f).targets,[]);}});
test('separate exact parts are retained with no newest-part inference; duplicate identity is ambiguous',()=>{const f=fixture();f.stories[0].artifacts=[f.artifact(f.roots[0],rel,'1'),f.artifact(f.roots[0],rel.replace('Invented','Invented two'),'2')];f.owner.stories[0].pieces=f.stories[0].artifacts.map((a,i)=>({pieceId:'registered:part-'+(i+1),kind:'article-part',part:a.part,relativePath:a.relativePath,hash,editable:true}));assert.deepEqual(resolve(f).targets.map(t=>t.partKey),['1','2']);f.owner.stories[0].pieces[1].pieceId='registered:part-1';assert.deepEqual(resolve(f).targets,[]);});
test('part mismatch and multiple configured aliases for one root are refused',()=>{const f=fixture();f.owner.stories[0].pieces[0].kind='article-part';f.owner.stories[0].pieces[0].part='1';assert.deepEqual(resolve(f).targets,[]);const g=fixture();g.roots.push({...g.roots[0],id:'alias'});assert.equal(resolve(g).reason,'ambiguous-owner-root');});

test('catalog decorates exact artifact, latest draft and part consistently and old owner 404 stays unavailable',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');
 const {createExistingWorkReader}=await import('../runtime/services/review-existing-work.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'magazine-owner-join-'));
 try{
  const canonical=await (await import('node:fs/promises')).realpath(dir),f=fixture();f.roots=[{id:'real-root',path:dir,canonical}];
  const a=f.artifact(f.roots[0]);const s={id:'portfolio-a',name:'Invented',artifacts:[a],latestDraft:a,parts:[a],questions:[],flags:[]};
  f.owner.rootIdentity.fingerprint=sha(canonical);
  const queries=[],portfolio={list:async()=>({stories:[s],guidance:[],unassigned:[],diagnostics:[]})};
  const reader=createExistingWorkReader({roots:f.roots,portfolio,projectLinks:f.projectLinks,readAuthority:async url=>{queries.push(url);return url==='/api/magazine/working-draft/catalog'?f.owner:null;}});
  const catalog=await reader.catalog(),story=catalog.stories[0],target=story.artifacts[0].magazineWorkingTarget;
  assert.equal(target.pieceId,'registered:article');assert.deepEqual(story.latestDraft.magazineWorkingTarget,target);assert.deepEqual(story.parts[0].magazineWorkingTarget,target);
  assert.equal(queries.filter(url=>url==='/api/magazine/working-draft/catalog').length,1);
  assert.ok(!JSON.stringify(target).includes(dir));
  const legacy=createExistingWorkReader({roots:f.roots,portfolio,projectLinks:f.projectLinks,readAuthority:async url=>{if(url==='/api/magazine/working-draft/catalog')throw Error('404');return null;}});
  const old=await legacy.catalog();assert.equal(old.stories[0].artifacts[0].magazineWorkingTarget,undefined);assert.equal(old.magazineWorkingLinks.reason,'owner-catalog-unavailable');assert.ok(old.diagnostics.some(d=>d.includes('404')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('per-file conflict editability is honored even with a writable owner',()=>{const f=fixture();f.owner.stories[0].pieces[0].editable=false;assert.equal(resolve(f).targets[0].editable,false);});

test('browser parent and Magazine registration remain distinct namespaces',()=>{const f=fixture();f.owner.stories[0].storyId='mag-clay-teacher';const target=resolve(f).targets[0];assert.equal(target.nativeProjectId,'browser-clay');assert.equal(target.storyId,'mag-clay-teacher');});
test('two registered stories claiming one exact DEV refuse pickup regardless of browser mapping',()=>{const f=fixture();f.owner.stories.push({...f.owner.stories[0],storyId:'different-magazine-story'});assert.deepEqual(resolve(f).targets,[]);});

test('only a verified configured root fingerprint travels with ready working links',()=>{const f=fixture(),r=resolve(f);assert.deepEqual(r.rootIdentity,f.owner.rootIdentity);assert.notEqual(r.rootIdentity,f.owner.rootIdentity);assert.equal(JSON.stringify(r).includes('/invented/'),false);f.owner.rootIdentity.fingerprint='bad';assert.equal(resolve(f).rootIdentity,undefined);});
