import test from 'node:test';import assert from 'node:assert/strict';import {createExistingWorkReader} from '../runtime/services/review-existing-work.mjs';
const hash='a'.repeat(64),a=(id,kind='SRC')=>({artifactId:id,hash,fileName:kind+' - Example.md',relativePath:'Workflow/'+id+'.md',kind,archived:false});
const story=(id,name,artifacts)=>({id,name,stage:'draft',step:5,who:'you',flags:[],published:null,latestDraft:artifacts.find(a=>a.kind==='DEV')||null,parts:[],artifacts,questions:[],attentionCount:0,openCount:0,answeredCount:0});
function setup(extra={}){let reads=[];const originals={stories:[story('s1','Example',[a('same-words-a'),a('draft','DEV'),a('social','CAROUSEL')]),story('s2','Another Example',[a('same-words-b')]),story('test','Disposable fixture',[a('fixture')])],guidance:[a('guide','GUIDE')],unassigned:[a('unassigned','NOTES')],diagnostics:[]};const portfolio={list:async()=>originals,read:async request=>{reads.push(request);return{raw:'Exact original words',provenance:{sha256:request.expectedHash}};}};const data={'/api/sources/tree':{sources:[{id:'real',name:'Retained conversation'},{id:'fixture-source',name:'Disposable source'}]},'/api/source-sessions':{sessions:[{id:'conversation',title:'Retained session',turns:[{},{}]}]},'/api/pieces':{pieces:[{id:'real-piece',title:'Separate words'},{id:'fixture-piece',title:'Example only'}]}};return{reader:createExistingWorkReader({portfolio,readAuthority:async path=>data[path],excludedStoryNames:['Disposable fixture'],excludedSourceIds:['fixture-source'],excludedPieceIds:['fixture-piece'],seedProjects:[{id:'native-a',name:'Example',slideCount:8}],projectLinks:{s1:{nativeProjectId:'native-a'}},...extra}),reads,originals};}
test('catalog preserves independently authored same-hash artifacts and identifies existing owners',async()=>{const{reader,originals}=setup();const before=JSON.stringify(originals);const c=await reader.catalog();assert.equal(c.stories.length,2);assert.equal(c.stories[0].nativeProjectId,'native-a');assert.equal(c.stories[0].outputs[0].artifactId,'social');assert.equal(c.stories[0].retainedOutputs[0].slideCount,8);assert.equal(c.sources.filter(s=>s.authority==='magazine-original').length,2);assert.deepEqual(c.sources.filter(s=>s.authority==='magazine-original').map(s=>s.id),['same-words-a','same-words-b']);assert.equal(c.sourceGroups.find(g=>g.id==='library').count,1);assert.equal(c.conversations[0].turnCount,2);assert.equal(c.workspacePieces.length,1);assert.equal(c.exclusions.length,3);assert.equal(c.unassigned.length,1);assert.equal(JSON.stringify(originals),before);});
test('artifact read delegates exact opaque identity/hash without creating copies',async()=>{const{reader,reads}=setup();const r=await reader.readArtifact({artifactId:'same-words-a',expectedHash:hash});assert.equal(r.raw,'Exact original words');assert.deepEqual(reads,[{artifactId:'same-words-a',expectedHash:hash}]);});
test('published facts are retained verbatim and only safe https is linked',async()=>{const{reader,originals}=setup();originals.stories[0].published='https://example.org/read/a (2026-10-01; earlier edition 2026-09-20)';originals.stories[1].published='javascript:bad';const c=await reader.catalog();assert.equal(c.stories[0].published,originals.stories[0].published);assert.equal(c.stories[0].publishedUrl,'https://example.org/read/a');assert.equal(c.stories[1].publishedUrl,null);});
test('missing authority remains explicit while independent originals stay discoverable',async()=>{const{reader}=setup({readAuthority:async()=>{throw Error('offline');}});const c=await reader.catalog();assert.equal(c.stories.length,2);assert.equal(c.diagnostics.length,5);assert.equal(c.sourceGroups.find(g=>g.id==='library').count,0);assert.equal(c.mode,'existing-work-read-only');});

test('a matching display title cannot confer native identity without an explicit stable-ID connection',async()=>{const{reader}=setup({projectLinks:{}});const catalog=await reader.catalog();assert.equal(catalog.stories[0].nativeProjectId,null);assert.deepEqual(catalog.stories[0].retainedOutputs,[]);});
test('explicit question-reading links pin known artifact IDs/hashes using target metadata only and never expose question prose',async()=>{const{reader,originals}=setup(),source={...a('ask','ASK'),hash:'b'.repeat(64)},target=originals.stories[0].artifacts.find(x=>x.artifactId==='draft');target.title='Invented retained draft';originals.stories[0].artifacts.push(source);originals.stories[0].questions=[{title:'Private question text must stay out',context:['Private context must stay out'],answer:'Private answer must stay out',artifact:source,reads:[{file:target.relativePath,label:'Private custom read label',artifact:target}]}];const before=JSON.stringify(originals),catalog=await reader.catalog(),links=catalog.stories[0].referenceLinks;assert.deepEqual(links,[{kind:'question-reading',fromStoryId:'s1',fromArtifactId:'ask',fromHash:'b'.repeat(64),fromArchived:false,toArtifactId:'draft',toHash:hash,toStoryId:'s1',toStoryIds:['s1'],crossStory:false,toArchived:false,label:'Invented retained draft'}]);assert.deepEqual(catalog.stories[0].unresolvedReferenceLinks,[]);assert.ok(!JSON.stringify(catalog).includes('Private question'));assert.ok(!JSON.stringify(catalog).includes('Private context'));assert.ok(!JSON.stringify(catalog).includes('Private answer'));assert.ok(!JSON.stringify(catalog).includes('Private custom read label'));assert.equal(JSON.stringify(originals),before);});
test('unresolved explicit reading path remains unresolved rather than finding an artifact with a similar name',async()=>{const{reader,originals}=setup(),source=a('ask','ASK');originals.stories[0].artifacts.push(source);originals.stories[0].questions=[{artifact:source,reads:[{file:'Workflow/3-Develop/DEV - Missing exact file.md',label:'Private question label'}]}];const c=await reader.catalog(),s=c.stories[0];assert.deepEqual(s.referenceLinks,[]);assert.equal(s.unresolvedReferenceLinks.length,1);assert.equal(s.unresolvedReferenceLinks[0].reason,'explicit-reading-target-unresolved');assert.equal(s.unresolvedReferenceLinks[0].targetPath,'Workflow/3-Develop/DEV - Missing exact file.md');assert.equal(s.unresolvedReferenceLinks[0].toArtifactId,null);assert.ok(!JSON.stringify(c).includes('Private question label'));});
test('cross-story and archived explicit targets retain their exact scope without becoming same-story records',async()=>{const{reader,originals}=setup(),source={...a('earlier-ask','ASK'),archived:true},target={...a('other-draft','DEV'),hash:'c'.repeat(64),archived:true,title:'Other retained scope'};originals.stories[0].artifacts.push(source);originals.stories[1].artifacts.push(target);originals.stories[0].questions=[{artifact:source,reads:[{file:target.relativePath,artifact:target}]}];const c=await reader.catalog(),link=c.stories[0].referenceLinks[0];assert.equal(link.toStoryId,'s2');assert.deepEqual(link.toStoryIds,['s2']);assert.equal(link.crossStory,true);assert.equal(link.fromArchived,true);assert.equal(link.toArchived,true);assert.equal(link.toHash,'c'.repeat(64));assert.ok(!c.stories[0].artifacts.some(x=>x.artifactId==='other-draft'));});
test('stale, excluded and unowned relationship targets fail closed and repeated explicit pairs stay compact',async()=>{const{reader,originals}=setup(),source=a('ask','ASK'),draft=originals.stories[0].artifacts.find(x=>x.artifactId==='draft'),excluded=originals.stories[2].artifacts[0];originals.stories[0].artifacts.push(source);originals.stories[0].questions=[{artifact:source,reads:[{file:draft.relativePath,artifact:draft},{file:draft.relativePath,artifact:draft},{file:draft.relativePath,artifact:{...draft,hash:'d'.repeat(64)}},{file:excluded.relativePath,artifact:excluded},{file:'Workflow/Unowned.md',artifact:a('not-in-catalog')}]},{artifact:{...source,hash:'e'.repeat(64)},reads:[{file:draft.relativePath,artifact:draft}]}];const c=await reader.catalog(),s=c.stories[0];assert.equal(s.referenceLinks.length,1);assert.deepEqual(s.unresolvedReferenceLinks.map(x=>x.reason),['reading-target-hash-changed','reading-target-excluded','reading-target-unavailable','source-question-record-unavailable']);assert.equal(c.stories.length,2);});

const authorityPaths=['/api/sources/tree','/api/source-sessions','/api/pieces','/api/study-draft/catalog','/api/magazine/working-draft/catalog'];
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function deferredCatalog(){
 const rounds=[],original={stories:[],guidance:[],unassigned:[],diagnostics:['Original diagnostic']};let current;
 const defer=key=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});current.set(key,{resolve,reject});return promise;};
 const reader=createExistingWorkReader({portfolio:{list(){current=new Map();rounds.push(current);return defer('portfolio');}},readAuthority:path=>defer(path)});
 const values={'portfolio':original,'/api/sources/tree':{sources:[{id:'saved-source',title:'Saved source'}]},'/api/source-sessions':{sessions:[{id:'saved-conversation',sourceId:'saved-source',sourceHash:hash,version:3,turns:[{}]}]},'/api/pieces':{pieces:[{id:'saved-piece',title:'Saved piece'}]},'/api/study-draft/catalog':null,'/api/magazine/working-draft/catalog':{stories:[],registered:false}};
 return {reader,rounds,values};
}
test('fresh catalog starts all independent readers before portfolio settles and stays pending for complete proof',async()=>{
 const {reader,rounds,values}=deferredCatalog();let settled=false;const pending=reader.catalog();pending.then(()=>{settled=true;});
 assert.equal(reader.catalog(),pending);await turn();const gates=rounds[0];
 assert.deepEqual([...gates.keys()],['portfolio',...authorityPaths]);
 for(const key of ['portfolio',...authorityPaths.slice(0,-1)])gates.get(key).resolve(values[key]);
 await turn();assert.equal(settled,false);assert.equal(reader.catalog(),pending);
 gates.get(authorityPaths.at(-1)).resolve(values[authorityPaths.at(-1)]);const catalog=await pending;
 assert.equal(catalog.sources[0].id,'saved-source');assert.equal(catalog.conversations[0].version,3);assert.equal(catalog.workspacePieces[0].id,'saved-piece');assert.equal(settled,true);
});
test('reader completion order preserves the complete catalog and stable unavailable diagnostics',async()=>{
 const orders=[['portfolio',...authorityPaths],[...authorityPaths].reverse().concat('portfolio')];const catalogs=[];
 for(const order of orders){
  const {reader,rounds,values}=deferredCatalog(),pending=reader.catalog();await turn();const gates=rounds[0];assert.deepEqual([...gates.keys()],['portfolio',...authorityPaths]);
  for(const key of order){if(key==='/api/sources/tree'||key==='/api/pieces')gates.get(key).reject(Error(key+' offline'));else gates.get(key).resolve(values[key]);await turn();}
  catalogs.push(await pending);
 }
 assert.deepEqual(catalogs[0],catalogs[1]);assert.deepEqual(catalogs[0].diagnostics,['Original diagnostic','Library unavailable: /api/sources/tree offline','Workspace pieces unavailable: /api/pieces offline']);
 assert.equal(catalogs[0].conversations[0].id,'saved-conversation');assert.deepEqual(catalogs[0].sources,[]);
});
test('fatal portfolio failure rejects promptly while independent rejected readers are handled and retry reads afresh',async()=>{
 const {reader,rounds,values}=deferredCatalog(),pending=reader.catalog(),failure=assert.rejects(pending,/portfolio unavailable/);await turn();
 const started=[...rounds[0].keys()];rounds[0].get('portfolio').reject(Error('portfolio unavailable'));await failure;assert.deepEqual(started,['portfolio',...authorityPaths]);
 for(const key of authorityPaths)rounds[0].get(key).reject(Error('late unavailable'));
 await turn();const retry=reader.catalog();assert.notEqual(retry,pending);assert.equal(reader.catalog(),retry);await turn();assert.equal(rounds.length,2);
 for(const [key,gate]of rounds[1])gate.resolve(values[key]);assert.equal((await retry).sources[0].id,'saved-source');
 const refreshed=reader.catalog();await turn();assert.equal(rounds.length,3);for(const [key,gate]of rounds[2])gate.resolve(values[key]);assert.equal((await refreshed).sources[0].id,'saved-source');
});
test('synchronous reader failure stays optional and missing root resolution cannot confer working ownership',async()=>{
 const {reader}=setup({roots:[{id:'unavailable',path:new URL('../fixtures/no-catalog-scheduling-root',import.meta.url).pathname}],readAuthority:path=>{if(path==='/api/sources/tree')throw Error('synchronous unavailable');return path==='/api/magazine/working-draft/catalog'?{stories:[],registered:true}:undefined;}});
 const catalog=await reader.catalog();assert.equal(catalog.stories.length,2);assert.equal(catalog.magazineWorkingLinks.state,'unavailable');assert.deepEqual(catalog.magazineWorkingLinks.targets,[]);
 assert.ok(catalog.diagnostics.some(message=>message==='Library unavailable: synchronous unavailable'));assert.ok(catalog.diagnostics.some(message=>message.startsWith('Magazine working identities unavailable: ')));
});

// A missing optional owner must not pin the shared catalog promise forever.
test('stalled optional catalog read expires, ignores late proof and retries every owner afresh',async()=>{
 let release,round=0,aborted=false;
 const {reader}=setup({readTimeoutMs:20,readAuthority:(path,{signal}={})=>{
  if(path==='/api/sources/tree'){round++;if(round===1){signal?.addEventListener('abort',()=>{aborted=true;});return new Promise(resolve=>{release=resolve;});}return {sources:[{id:'fresh-source'}]};}
  return {};
 }});
 const pending=reader.catalog();assert.equal(reader.catalog(),pending);
 const first=await Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('catalog stayed pinned')),200))]);
 assert.equal(aborted,true);assert.ok(first.diagnostics.some(d=>/Library unavailable:.*timed out/.test(d)));assert.equal(first.sources.some(s=>s.id==='late-source'),false);
 release({sources:[{id:'late-source'}]});await turn();assert.equal(first.sources.some(s=>s.id==='late-source'),false);
 const second=await reader.catalog();assert.equal(round,2);assert.equal(second.sources.some(s=>s.id==='fresh-source'),true);assert.notEqual(second.revision,first.revision);
});
test('stalled exact workspace binding lookup stays unavailable rather than conferring an identity',async()=>{
 const bindingId='11111111-1111-4111-8111-111111111111';let calls=0;
 const {reader}=setup({readTimeoutMs:20,readAuthority:path=>{
  if(path==='/api/study-draft/catalog')return {drafts:[{bindingStatus:'ready',bindingId,parentStudyId:'invented-parent'}]};
  if(path==='/api/pieces')return {pieces:[]};
  if(path.startsWith('/api/first-flow/binding?')){calls++;return new Promise(()=>{});}return {};
 }});
 const catalog=await Promise.race([reader.catalog(),new Promise((_,reject)=>setTimeout(()=>reject(Error('binding pinned catalog')),200))]);
 assert.equal(calls,2);assert.equal(catalog.workspaceLinks.unavailableBindings.length,2);assert.ok(catalog.workspaceLinks.unavailableBindings.every(row=>row.reason==='binding-unavailable'));
});


test('an exhausted optional catalogue budget cannot start a second full binding timeout wave',async()=>{
 const bindingId='11111111-1111-4111-8111-111111111111';let bindings=0,round=0;
 const {reader}=setup({readTimeoutMs:30,readAuthority:(path,{signal}={})=>{
  if(path==='/api/sources/tree')return ++round===1?new Promise(()=>{}):{sources:[]};
  if(path==='/api/study-draft/catalog')return {drafts:[{bindingStatus:'ready',bindingId,parentStudyId:'invented-parent'}]};
  if(path==='/api/pieces')return {pieces:[]};
  if(path.startsWith('/api/first-flow/binding?')){bindings++;return {projectKey:new URL(path,'http://localhost').searchParams.get('projectKey'),projectId:'22222222-2222-4222-8222-222222222222',documentId:'33333333-3333-4333-8333-333333333333'};}
  return {};
 }});
 const catalog=await reader.catalog();
 assert.equal(bindings,0,'a slow optional Library reader must not grant native joins another whole timeout');
 assert.ok(catalog.diagnostics.some(d=>/Library unavailable:.*timed out/.test(d)));
 assert.equal(catalog.stories.length,2,'independent originals remain available');
 assert.equal(catalog.workspaceLinks.unavailableBindings.length,2);
 assert.ok(catalog.workspaceLinks.unavailableBindings.every(row=>row.reason==='binding-unavailable'));
 const refreshed=await reader.catalog();assert.equal(bindings,2,'a deliberate refresh receives a fresh budget');assert.equal(refreshed.workspaceLinks.unavailableBindings.length,0);
});
