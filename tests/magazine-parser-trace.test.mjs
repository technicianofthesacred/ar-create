import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {transform}=require('esbuild');
const source=await fs.readFile(new URL('../runtime/src/donors/mag/mag-send.ts',import.meta.url),'utf8');
const compiled=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
const parser=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const sha=value=>createHash('sha256').update(value).digest('hex');
// FIXTURES BEGIN: wholly invented, with no photographs or source content imported.
const BODY=[
 '%%photo: repeat.jpg · Cover alt · cover x=0.2 y=0.8%%',
 '%%pull: hook%%\n> "An invented opening hook."',
 'Invented opening about a clay bowl 瓷 🍵.',
 '%%photo: opening.jpg · Opening alt · wide aspect=4/5 left%%',
 '## Invented part',
 '%%photo: opener.jpg · Part alt · opener%%',
 'An invented paragraph about a quiet kiln.',
 '%%photos: first.jpg · First alt | repeat.jpg · Reused alt · stagger narrow aspect=3/2%%',
 '%%side: side.jpg · Side alt · flip%%',
 'Nested invented paragraph.',
 '%%photo: nested.jpg · Nested alt · bleed%%',
 '%%glyph: 缘分%%',
 'Nested glyph words.',
 '%%photo: glyph.jpg · Glyph alt · wide%%',
 '%%/glyph%%',
 '%%/side%%',
 '%%on-photo: on.jpg · Words on image · aspect=3/2 ink=#fff accent=#f00%%\n> "An invented whole line."',
 '%%ending%%',
 'An invented ending paragraph.',
 '%%photo: end-wide.jpg · Ending detail · wide%%',
 '%%saying: last.jpg · Last alt · aspect=4/5%%\n> "An invented closing line."',
 "Invented author's close."
].join('\n\n');
const OVERWRITTEN=['%%photo: old-cover.jpg · Old · cover%%','%%photo: new-cover.jpg · New · cover%%','Invented opening.','## A part','%%photo: old-opener.jpg · Old · opener%%','%%photo: new-opener.jpg · New · opener%%','Invented body.','%%ending%%','%%saying%%\n> "Invented saying."'].join('\n\n');
const variants={lf:BODY,crlf:BODY.replaceAll('\n','\r\n'),whitespace:' \t'+BODY.replaceAll('\n\n',' \r\n \t\r\n  ')+' \t',photoless:'Invented opening.\n\n%%ending%%\n\n%%saying%%\n> "Invented saying."',overwritten:OVERWRITTEN};
// FIXTURES END
const GOLDENS={"lf":"57f525734f4c921fc05279ab75d9c0c39f88ad923c73b49c689e37a7dcbb2eb1","crlf":"57f525734f4c921fc05279ab75d9c0c39f88ad923c73b49c689e37a7dcbb2eb1","whitespace":"57f525734f4c921fc05279ab75d9c0c39f88ad923c73b49c689e37a7dcbb2eb1","photoless":"7130923634bc3ac4de9c736ab9ea1f4fe24e58dd90a86c017f00140525d42599","overwritten":"830e0cc1e1486abed3bb4d494a57e41d6e226d86b8ffab47df4e7a1ee392389f"}; // Pinned from the unchanged maintained parser using only the invented variants above.
function shots(story){const result=[];const walk=blocks=>{for(const b of blocks){if(b.shot)result.push(b.shot);if(b.kind==='photos')result.push(...b.shots);if(b.kind==='side'||b.kind==='glyph')walk(b.blocks);}};if(story.portrait)result.push(story.portrait);walk(story.opening);for(const p of story.parts){if(p.opener)result.push(p.opener);walk(p.blocks);}walk(story.ending.blocks);if(story.ending.shot)result.push(story.ending.shot);return result;}
test('default parsing preserves the complete maintained Story goldens for invented inputs',()=>{for(const [name,body]of Object.entries(variants))assert.equal(sha(JSON.stringify(parser.parseDraft(body))),GOLDENS[name],name);});
for(const [name,body]of Object.entries(variants))test('optional origin trace preserves exact raw ranges and actual shot identity: '+name,()=>{
 const records=[],story=parser.parseDraft(body,undefined,(shot,origin)=>records.push({shot,origin}));assert.equal(sha(JSON.stringify(story)),GOLDENS[name]);assert.equal(records.length,shots(story).length);assert.ok(shots(story).every(shot=>records.some(r=>r.shot===shot)));
 for(const {shot,origin:o}of records){assert.equal(o.offsetUnit,'utf16');for(const k of ['chunkStart','chunkEnd','directiveStart','directiveEnd','groupIndex','groupSize','depth'])assert.ok(Number.isSafeInteger(o[k]),k);assert.ok(o.chunkStart>=0&&o.chunkEnd<=body.length&&o.chunkStart<=o.directiveStart&&o.directiveEnd<=o.chunkEnd);const directive=body.slice(o.directiveStart,o.directiveEnd);assert.ok(directive.startsWith('%%'+o.kind+':'));assert.ok(directive.endsWith('%%'));assert.ok(directive.includes(shot.file));assert.equal(body.slice(o.chunkStart,o.chunkEnd),body.slice(o.chunkStart,o.chunkEnd).trim());assert.ok(o.groupIndex>=0&&o.groupIndex<o.groupSize);assert.ok(Object.isFrozen(o));}
});
test('groups share one exact directive span while repeated files retain separate object identities',()=>{const records=[],story=parser.parseDraft(BODY,undefined,(shot,origin)=>records.push({shot,origin}));assert.equal(records.length,11);const group=records.filter(r=>r.origin.kind==='photos');assert.equal(group.length,2);assert.deepEqual(group.map(r=>r.origin.groupIndex),[0,1]);assert.ok(group.every(r=>r.origin.groupSize===2));assert.equal(group[0].origin.directiveStart,group[1].origin.directiveStart);assert.equal(group[0].origin.directiveEnd,group[1].origin.directiveEnd);const repeated=records.filter(r=>r.shot.file==='repeat.jpg');assert.equal(repeated.length,2);assert.notStrictEqual(repeated[0].shot,repeated[1].shot);assert.strictEqual(repeated[0].shot,story.portrait);});
test('origin roles and nesting reflect the branch that actually created the shot',()=>{const rows=[];parser.parseDraft(BODY,undefined,(shot,o)=>rows.push({file:shot.file,role:o.role,depth:o.depth,kind:o.kind}));assert.equal(rows.find(r=>r.file==='repeat.jpg').role,'cover');assert.equal(rows.find(r=>r.file==='opener.jpg').role,'opener');assert.equal(rows.find(r=>r.file==='nested.jpg').depth,1);assert.equal(rows.find(r=>r.file==='glyph.jpg').depth,2);assert.equal(rows.find(r=>r.file==='side.jpg').role,'side');assert.equal(rows.find(r=>r.file==='on.jpg').role,'on-photo');assert.equal(rows.find(r=>r.file==='last.jpg').role,'ending');});
test('no origin callbacks escape a failed parse or failed native ID assignment',()=>{for(const body of [BODY.replace('Invented opening','Invented — opening'),BODY.replace('%%/side%%',''),BODY.replace('ink=#fff ',''),BODY.replace('%%ending%%','')]){const rows=[];assert.throws(()=>parser.parseDraft(body,undefined,(...args)=>rows.push(args)));assert.equal(rows.length,0);}const rows=[];assert.throws(()=>parser.parseDraft(BODY,{byText:null,slots:new Map()},(...args)=>rows.push(args)));assert.equal(rows.length,0);});
test('the previous slot and text IDs remain authoritative with origin tracing',()=>{const previous={byText:new Map([['saved-native-words','An invented paragraph about a quiet kiln.']]),slots:new Map([['first.jpg','saved-photo-slot']])},rows=[];const plain=parser.parseDraft(BODY,previous),traced=parser.parseDraft(BODY,previous,(shot,o)=>rows.push({shot,o}));assert.deepEqual(traced,plain);assert.equal(rows.find(r=>r.shot.file==='first.jpg').shot.slot,'saved-photo-slot');assert.ok(traced.parts[0].blocks.some(b=>b.id==='saved-native-words'));});
test('overwritten cover and opener shots do not acquire current-placement origins',()=>{const rows=[],story=parser.parseDraft(OVERWRITTEN,undefined,(shot,o)=>rows.push({shot,o}));assert.deepEqual(rows.map(r=>r.shot.file),['new-cover.jpg','new-opener.jpg']);assert.ok(rows.every(r=>shots(story).includes(r.shot)));});
for(const newline of ['\n','\r\n'])test('draftBody reports the exact original DEV body range with delimiter whitespace: '+JSON.stringify(newline),()=>{const body=newline+BODY.replaceAll('\n',newline)+newline;const prefix='---  '+newline+'type: DEV'+newline+'---\t '+newline+'Invented metadata '+body+newline+'--- \t';const dev=prefix+body+'---   '+newline+'Invented notes repeat '+body;const seen=[],plain=parser.draftBody(dev),traced=parser.draftBody(dev,r=>seen.push(r));assert.deepEqual(traced,plain);assert.deepEqual(Object.keys(plain),['head','body','tail']);assert.equal(plain.body,body);assert.equal(plain.tail,newline+'Invented notes repeat '+body);assert.equal(seen.length,1);assert.deepEqual(seen[0],{start:prefix.length,end:prefix.length+body.length,offsetUnit:'utf16'});assert.equal(dev.slice(seen[0].start,seen[0].end),plain.body);assert.ok(dev.indexOf(body)<seen[0].start,'matching earlier text cannot choose the body span');assert.ok(Object.isFrozen(seen[0]));const rows=[];parser.parseDraft(traced.body,undefined,(shot,o)=>rows.push({shot,o}));assert.ok(rows.length);for(const {o}of rows)assert.equal(dev.slice(seen[0].start+o.directiveStart,seen[0].start+o.directiveEnd),traced.body.slice(o.directiveStart,o.directiveEnd));});
test('draftBody missing boundaries refuses before reporting any body range',()=>{const seen=[];assert.throws(()=>parser.draftBody('Invented plain text',r=>seen.push(r)));assert.equal(seen.length,0);});
test('observer failure cannot leak trace state into the next parse',()=>{assert.throws(()=>parser.parseDraft(BODY,undefined,()=>{throw Error('Invented observer failure');}),/Invented observer failure/);const rows=[];parser.parseDraft(BODY,undefined,(shot,o)=>rows.push({shot,o}));assert.equal(rows.length,11);});

test('separated quote-layout blocks retain story bytes and exact directive origins',()=>{
 const direct=BODY.replace('An invented paragraph about a quiet kiln.','%%pull: l%%\n> "An invented part pull."\n\nAn invented paragraph about a quiet kiln.');
 for(const newline of ['\n','\r\n']){
  const body=direct.replace(/(%%(?:pull|on-photo|saying)[^\n]*%%)\n>/g,'$1\n\n>').replaceAll('\n',newline),records=[];
  const story=parser.parseDraft(body,undefined,(shot,origin)=>records.push({shot,origin}));
  assert.deepEqual(story,parser.parseDraft(direct));assert.equal(records.length,shots(story).length);
  for(const {shot,origin}of records){
   const directive=body.slice(origin.directiveStart,origin.directiveEnd);
   assert.ok(directive.startsWith('%%'+origin.kind+':'));assert.ok(directive.endsWith('%%'));assert.ok(directive.includes(shot.file));
   if(['on-photo','saying'].includes(origin.kind))assert.equal(body.slice(origin.chunkStart,origin.chunkEnd),directive,'the consumed quote never replaces the photograph marker origin');
  }
 }
});
test('separated quote-layout parsing cannot skip prose or notes or accept an unquoted pull',()=>{
 for(const between of ['Invented intervening prose.\n\n','%%An intervening private note%%\n\n'])assert.throws(()=>parser.parseDraft('%%pull: hook%%\n\n'+between+'> "Invented words."'),/quotation marks/);
 assert.throws(()=>parser.parseDraft('%%pull: hook%%\n\n> Invented unquoted words.'),/quotation marks/);
});
