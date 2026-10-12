import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(new URL('../public/document-study/research-standard-adapter.js',import.meta.url),'utf8'),context);
const adapter=context.module.exports;
const source={name:'SRC - Conversation.md',path:'/source',role:'source',hash:'current',raw:'A says: Caring for guests matters. Some really good ones from good leaf.'};
test('all R/W/S and unnumbered claim bullets survive without promoting declarations',()=>{
 const record={name:'RESEARCH - Any subject.md',hash:'research',raw:'# Research\n## 1. Claims\n### Facts\n- **R1** A 01:00, "Caring for guests matters." · confirmed · usable · vendor.example (lead)\n- **R3b** A reading · mixed · qualified (one source) · Exact finding\n- **R9** A 02:00, claim · unconfirmed · held back · No evidence\n### Opinions\n- A 03:00, personal view\n## 3. Wisdom\n- **W2** idea to trace\n## 4. Speaker check\nA:\n- **S7** 04:00 "Some really good ones from good leaf." · sweeping alone · keep with context\n'};
 const {points}=adapter.parse([record,source]);
 assert.deepEqual(Array.from(points,p=>p.label),['R1','R3b','R9','','W2','S7']);
 assert.equal(points[0].spoken[0].speaker,'A'); assert.equal(points[5].spoken[0].location,'04:00');
 assert.equal(points[2].clarity.supported,''); assert.match(points[2].clarity.uncertain,/No evidence/);
 assert.match(points[1].clarity.storyImplication,/qualified/);
 assert.equal(points[0].decision.state,'read-only'); assert.equal(points[0].sources[0].raw,points[0].originalText);
 assert.match(points[0].clarity.supported,/lead/);
});
test('numbered enrichment and checks are separated by section and part; no summary duplicates',()=>{
 const raw='# Notes\n## 1. Articles found\n1. Index entry\n## 2. What enriches each part\n### Part 1\n1. Dew process (article p7). Exact prose.\n2. Another finding.\n### Part 2\n1. Contrast and disagreement.\n## 4. Claims to check\n1. Ask for the date.\n## 5-line summary\n1. Duplicate summary\n';
 const {points}=adapter.parse([{name:'NOTES - Topic research.md',raw,hash:'notes'}]);
 assert.equal(points.length,4); assert.equal(points[2].part,'Part 2'); assert.notEqual(points[0].id,points[2].id);
 assert.equal(points[0].clarity.supported,'Dew process (article p7). Exact prose.');
 assert.equal(points[3].clarity.supported,'');
 assert.match(points[3].clarity.evidenceNeeded,/Ask for the date/);
});
test('research paraphrases, proposed wording, and stale canonical sources never become speech',()=>{
 const record={name:'RESEARCH - Quotes.md',raw:'## Claims\n- **W1** A 01:00, "invented quote"\n- **W2** A 01:00, "Caring for guests matters."\n- **R1** A 01:00, description · qualified · proposed "Caring for guests matters."\n'};
 const {points,limits}=adapter.parse([record,{...source,stale:true}]);
 assert.ok(points.every(p=>!p.spoken.length)); assert.equal(points[0].researchParaphrases.length,1);
 assert.equal(points[1].stale,true); assert.equal(points[2].researchParaphrases.length,0);
 assert.ok(limits.some(x=>x.includes('paraphrases')));
 assert.equal(adapter.parse([record,source],{expectedSourceHashes:{'/source':'older'}}).points[1].spoken.length,0);
});
test('no invented attribution; multiline original prose retained and ids deterministic',()=>{
 const record={name:'RESEARCH - Generic.md',path:'/research',hash:'r',raw:'## Claims\n- **R1** An unnamed term "care" · unconfirmed · held\n  Original continuation.\n'};
 const a=adapter.parse([record]),b=adapter.parse([record]);
 assert.equal(a.points[0].id,b.points[0].id); assert.equal(a.points[0].spoken.length,0);
 assert.match(a.points[0].originalText,/Original continuation/); assert.ok(a.limits.some(x=>x.includes('No canonical')));
});

test('CRLF research preserves exact source substring and backend point key',()=>{
 const record={name:'RESEARCH - CRLF',path:'/crlf',raw:'## Claims\r\n- **R1** Meaning · mixed · qualified\r\n  Continuation.\r\n'};
 const point=adapter.parse([record]).points[0];
 assert.ok(record.raw.includes(point.originalText));
 assert.equal(point.pointKey,record.path+'\n'+point.originalText);
 assert.equal(point.sources[0].recordPath,record.path);
});

test('supplemental research records cannot self-validate a quotation',()=>{
 const record={name:'RESEARCH - Self match.md',path:'/research',role:'research',raw:'## Claims\n- **W1** A 01:00, "Research invented these words."'};
 const {points}=adapter.parse([record],{sourceRecords:[record]});
 assert.equal(points[0].spoken.length,0);
 assert.equal(points[0].researchParaphrases.length,1);
});
test('qualification remains separate from supporting prose',()=>{
 const record={name:'RESEARCH - Qualification.md',raw:'## Claims\n- **R1** Place · mixed · qualified (one vendor source) · Exact retained finding · vendor.example (lead)'};
 const point=adapter.parse([record]).points[0];
 assert.equal(point.clarity.supported,'Exact retained finding · vendor.example (lead)');
 assert.equal(point.clarity.uncertain,'mixed · qualified (one vendor source)');
});

test('unresolved archive notes preserve exact human text as evidence needed, never supporting findings',()=>{const raw='## 4. Claims to check\n3. Lu Yu "Life is like tea" (Part 1 and 2). Not in the archive; GTH pages never use it. Ask for the source, or cut.\n4. "Supplements to the Compendium of Materia Medica" and "cell regeneration". Not in the archive. Ask which part is the book and which is her own explanation.\n';const {points}=adapter.parse([{name:'NOTES - Global Tea Hut research.md',path:'/notes',raw}]);assert.equal(points.length,2);for(const point of points){assert.equal(point.clarity.supported,'');assert.match(point.clarity.evidenceNeeded,/Not in the archive/);assert.ok(raw.includes(point.originalText));assert.equal(point.sources[0].raw,point.originalText);assert.match(point.clarity.storyImplication,/Hold factual narration/);}});
