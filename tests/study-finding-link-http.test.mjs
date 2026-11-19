import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {syntheticHome} from '../scripts/demo.mjs';

test('public commands save a proposed finding and reconnect an existing brief with actor and source guards',async t=>{
 const home=syntheticHome();t.after(()=>fs.rmSync(home.dir,{recursive:true,force:true}));
 const config=JSON.parse(fs.readFileSync(home.config));
 const server=await createServer({dataDir:config.dataDir,studyOriginalRoots:config.studyOriginalRoots,researchEnabled:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(route,body,actor='agent:codex')=>{
  const response=await fetch(base+route,{method:body?'POST':'GET',headers:{'Connection':'close','X-AR-Actor':actor,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,value:await response.json()};
 };
 const scope={projectKey:'hk',parentStudyId:'hk'};
 const source=(await request('/api/study-originals?projectKey=hk')).value.records.find(r=>r.role==='source');
 const quote=source.raw.trim(),from=source.raw.indexOf(quote);
 const original={...scope,operationId:randomUUID(),findingId:'prior-anchor-without-finding',title:'Proposed invented video brief',sourcePath:source.path,sourceHash:source.hash,from,to:from+quote.length,quote};
 const added=await request('/api/study/video-briefs',original);assert.equal(added.status,200);
 const saved=await request('/api/study-research/findings/save',{...scope,operationId:randomUUID(),expectedExportHash:null,title:'Proposed invented finding',sourcePath:source.path,sourceHash:source.hash,from,to:original.to,quote,speaker:'Invented speaker',location:'Invented transcript; no media timing established',clarity:{supported:'These words exist in the original.',uncertain:'No real recording exists.',storyImplication:'Test a proposed source anchor.'}});
 assert.equal(saved.status,200);const point=saved.value.points[0];assert.equal(point.provenance.actor,'agent:codex');
 const link={...scope,id:original.operationId,operationId:randomUUID(),expectedFindingId:original.findingId,findingId:point.id};
 assert.equal((await request('/api/study/video-briefs/relink',link)).status,200);
 assert.equal((await request('/api/study/video-briefs/relink?foreign=1',link)).status,400);
 const read=await request('/api/study/video-briefs?projectKey=hk&parentStudyId=hk');
 assert.equal(read.value.briefs.length,1);assert.equal(read.value.briefs[0].id,original.operationId);assert.equal(read.value.briefs[0].findingId,point.id);
 assert.equal((await request('/api/study-research/findings?projectKey=hk&parentStudyId=hk')).value.points[0].id,point.id);
 const capabilities=(await request('/api/capabilities')).value.commands;
 assert(capabilities.some(c=>c.name==='study-research.findings'&&c.method==='GET'),'Preserve the existing public read command name.');
 for(const route of ['/api/study-research/findings/save','/api/study/video-briefs/relink'])assert(capabilities.some(c=>c.route===route&&c.method==='POST'&&!c.readOnly));
});
