import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {coherentFixture,op,words,sourceRevision} from './helpers/coherent-journey-fixture.mjs';
import {projectDecisionCoverage} from '../public/lib/decision-coverage.js';
import {digest} from '../runtime/services/files.mjs';

test('actual selected source correction and changed wording produce scoped Check findings without rewriting sibling',async t=>{
 const f=await coherentFixture(t),sourceId=f.imported.receipts[0].source.id,source=await f.request('/api/concept/source?'+new URLSearchParams({sourceId})),concept=await f.request('/api/concept?parentStudyId=hk');
 const reference={sourceId,sourceHash:source.hash,start:0,quote:source.text};
 await f.request('/api/concept/save',{parentStudyId:'hk',operationId:op(),expectedRevision:concept.revision,expectedHash:concept.hash,authorThoughts:concept.authorThoughts,adoptedDirection:concept.adoptedDirection,aiInterpretation:concept.aiInterpretation,suggestions:concept.suggestions,sourceSelections:[reference]});
 const selector={parentStudyId:'hk',rootBindingId:f.group.rootBindingId,outputId:f.article.output.id},before=await f.request('/api/current-work/read',{selector});
 const tree=await f.request('/api/sources/tree'),row=tree.sources.find(s=>s.id===sourceId);assert.equal(row.rootId,'library');
 const original=await fetch(f.url+'/api/sources/blob?'+new URLSearchParams({id:sourceId,original:'1'})),originalBytes=Buffer.from(await original.arrayBuffer());assert.equal(original.status,200);
 await f.request('/api/sources/file',{id:sourceId,expectedHash:source.hash,content:source.text+'\nInvented correction: Mira did not date the cup.\n',raw:true},200,'human:adrian');
 const corrected=await f.request('/api/current-work/read',{selector});assert.ok(corrected.sources.freshness.some(s=>s.sourceId===sourceId&&s.stale));
 // Also check refresh after an explicit invented outside-file edit; this does
 // not establish a general filesystem watcher or automatic reconciliation.
 const file=path.resolve(f.config.dataDir,'library',row.rel_path);assert.ok(file.startsWith(path.join(f.config.dataDir,'library')+path.sep));fs.appendFileSync(file,'A second outside-file clarification leaves the age unknown.\n');
 const sourceChanged=await f.request('/api/current-work/read',{selector});assert.ok(sourceChanged.sources.freshness.some(s=>s.sourceId===sourceId&&s.stale));assert.equal((await f.native()).raw,f.raw);
 const native=await f.native(),paragraph=native.projection.find(p=>p.words===words.article),rejected=words.phrase+' '+words.rejected;
 const saved=await f.request('/api/study-draft/save',{...f.scope,expected:native.expected,operationId:op(),operations:[{kind:'text',id:paragraph.id,from:0,to:paragraph.words.length,insert:'The seam disappeared. '+rejected.replace(words.phrase+' ',''),seenBlockHash:paragraph.blockHash}]},200,'human:adrian');
 const after=await f.request('/api/current-work/read',{selector}),report=projectDecisionCoverage(after,{selector,expectedFingerprint:after.fingerprint});
 assert.equal(report.status,'partial');assert.ok(report.findings.some(r=>r.code==='protected-literal-absent'));assert.ok(report.findings.some(r=>r.code==='source-stale'));assert.ok(report.findings.some(r=>r.code==='intent-unassessed'));
 // Exact rejected proposal wording is absent because this human edit omitted
 // its protected prefix: semantic correspondence must stay unassessed.
 assert.ok(report.findings.some(r=>r.code==='rejection-meaning-unassessed'));assert.equal(report.authority.wordingApproved,false);
 const sibling=await f.request(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.carousel.output.id}));assert.deepEqual(sibling.output,f.carousel.output);assert.equal((await f.request('/api/concept?parentStudyId=ref-an-cha')).authorThoughts,'');
 assert.deepEqual(Buffer.from(await(await fetch(f.url+'/api/sources/blob?'+new URLSearchParams({id:sourceId,original:'1'}))).arrayBuffer()),originalBytes);
 assert.equal((await f.native()).raw,saved.raw);assert.equal(projectDecisionCoverage(after,{expectedFingerprint:before.fingerprint}).status,'stale');
 if(process.env.W8_PROOF_DIR){fs.mkdirSync(process.env.W8_PROOF_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,'decisions.json'),JSON.stringify({sourceRevision,report,sourceId,originalHash:digest(originalBytes),unrelatedSiblingUnchanged:true,outsideFileCorrection:true,generalWatcherProven:false},null,2));}
});
