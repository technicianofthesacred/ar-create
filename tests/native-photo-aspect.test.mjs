import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {build,transform}=require('esbuild');
// Compile maintained source in memory: the check never changes shared generated files.
const compiled=await build({entryPoints:[new URL('../runtime/src/native/correspondence.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',target:'node22',logLevel:'silent'});
const native=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const parsed=await transform(await fs.readFile(new URL('../runtime/src/donors/mag/mag-send.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'});
const parser=await import('data:text/javascript;base64,'+Buffer.from(parsed.code).toString('base64'));
const DIRECTIVE='%%photo: repeated.png · Selected 瓷 😀 · wide aspect=4/5 narrow right custom=keep x=2e-1 y=.8   %%';
const BODY=[
 '%%photo: repeated.png · Cover · cover%%',
 'Invented opening 瓷 😀.',DIRECTIVE,
 '%%photo: repeated.png · Repeated occurrence · wide aspect=4/5%%',
 '%%photos: repeated.png · Group first | repeated.png · Group second · aspect=4/5%%',
 '## Invented part','%%photo: repeated.png · Opener · opener%%','Invented part words.',
 '%%photo: repeated.png · Bleed · bleed%%',
 '%%side: repeated.png · Side%%','%%photo: repeated.png · Nested · wide%%','%%/side%%',
 '%%ending%%','%%photo: repeated.png · Ending detail · wide%%',
 '%%saying: repeated.png · Closing photo · aspect=4/5%%\n> "Invented closing saying."',
 'Invented close.'
];
function fixture({newline='\n',directive=DIRECTIVE}={}){
 const body=BODY.join('\n\n').replace(DIRECTIVE,directive);
 const raw=['---','type: DEV','title: Invented 瓷 😀','---','Invented metadata.','','---','',body,'','---','','Invented notes: '+DIRECTIVE].join('\n').replaceAll('\n',newline);
 const snapshot=native.capture(raw,'synthetic:article'),block=snapshot.blocks.find(b=>b.raw.includes('Selected 瓷 😀'));
 const operation={kind:'photoAspect',id:block.id,seenBlockHash:block.origin.blockHash,aspect:'4/3'};
 return {raw,snapshot,block,operation};
}
const story=raw=>parser.parseDraft(parser.draftBody(raw).body);
test('native owner advertises the bounded aspect operation',()=>assert.ok(native.supportedNativeOperations.includes('photoAspect')));
for(const newline of ['\n','\r\n'])test('aspect changes only one exact repeated-photo occurrence, preserving Unicode, layout, identities and exact Undo '+JSON.stringify(newline),()=>{
 const f=fixture({newline}),before=structuredClone(f.snapshot),result=native.apply(f.snapshot,f.raw,[f.operation]);
 assert.equal(result.raw,f.raw.replace(DIRECTIVE,DIRECTIVE.replace('aspect=4/5','aspect=4/3')));
 assert.deepEqual(f.snapshot,before);assert.deepEqual(result.snapshot.blocks.map(b=>b.id),before.blocks.map(b=>b.id));
 assert.equal(result.snapshot.prefix,before.prefix);
 for(const old of before.blocks){const next=result.snapshot.blocks.find(b=>b.id===old.id);assert.equal(next.separator,old.separator);assert.deepEqual(next.origin,old.origin);if(old.id!==f.block.id)assert.equal(next.raw,old.raw);}
 const expected=story(f.raw);expected.opening.find(b=>b.shot?.alt==='Selected 瓷 😀').aspect='4/3';
 assert.deepEqual(story(result.raw),expected,'maintained parser sees only the selected aspect change');
 assert.deepEqual(result.ledger,[f.operation]);
 const undone=native.undo(result.snapshot,result.raw,result.inverse);assert.equal(undone.raw,f.raw);assert.deepEqual(undone.snapshot,f.snapshot);
});
test('absent and bare native aspect forms add or replace only their token with every preset',()=>{
 const cases=[
  ['%%photo:repeated.png · Selected 瓷 😀%%','%%photo:repeated.png · Selected 瓷 😀 · aspect=ASPECT%%'],
  ['%%photo: repeated.png · Selected 瓷 😀 · wide\t narrow x=.2 y=.8  %%','%%photo: repeated.png · Selected 瓷 😀 · wide\t narrow x=.2 y=.8 aspect=ASPECT  %%'],
  ['%%photo: repeated.png · Selected 瓷 😀 · wide\t 16/9  left custom=瓷 x=.2 y=.8 %%','%%photo: repeated.png · Selected 瓷 😀 · wide\t ASPECT  left custom=瓷 x=.2 y=.8 %%']
 ];
 for(const [directive,expected]of cases)for(const aspect of ['4/3','4/5','1/1']){
  const f=fixture({directive});
  if(!directive.includes('16/9')&&aspect==='4/3'){assert.throws(()=>native.apply(f.snapshot,f.raw,[{...f.operation,aspect}]),/already has this shape/);continue;}
  const result=native.apply(f.snapshot,f.raw,[{...f.operation,aspect}]);assert.equal(result.raw,f.raw.replace(directive,expected.replace('ASPECT',aspect)));
  const parsed=story(f.raw);parsed.opening.find(b=>b.shot?.alt==='Selected 瓷 😀').aspect=aspect;assert.deepEqual(story(result.raw),parsed);
  assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,f.raw);
 }
});
test('implicit default wide aspect rejects a direct native 4/3 no-op without adding source bytes',()=>{
 for(const directive of ['%%photo: repeated.png · Selected 瓷 😀%%','%%photo: repeated.png · Selected 瓷 😀 · wide%%','%%photo: repeated.png · Selected 瓷 😀 · narrow right x=.2 y=.8 %%']){
  const f=fixture({directive}),before=structuredClone(f.snapshot);assert.throws(()=>native.apply(f.snapshot,f.raw,[{...f.operation,aspect:'4/3'}]),/already has this shape/);assert.deepEqual(f.snapshot,before);assert.equal(native.render(f.snapshot),f.raw);
 }
 assert.throws(()=>native.photoAspectRaw('%%photo: repeated.png%%','4/3'),/already has this shape/);
});
test('malformed, extra, stale, foreign and nonfinite aspect operations refuse without mutation',()=>{
 const f=fixture(),before=JSON.stringify(f.snapshot);
 for(const extra of [{aspect:NaN},{aspect:Infinity},{aspect:4/3},{aspect:null},{aspect:''},{aspect:'16/9'},{aspect:'4/0'},{aspect:'0/1'},{aspect:'4/3 '},{aspect:'4/3 x=1'},{aspect:'aspect=4/3'},{aspect:'1e309/1'},{aspect:'4/3\n'},{id:'foreign'},{seenBlockHash:'0'.repeat(64)},{seenBlockHash:'bad'},{file:'other.png'},{x:.2},{layout:'bleed'},{kind:'toString'}])assert.throws(()=>native.apply(f.snapshot,f.raw,[{...f.operation,...extra}]));
 const missing={...f.operation};delete missing.aspect;assert.throws(()=>native.apply(f.snapshot,f.raw,[missing]));
 assert.throws(()=>native.apply(f.snapshot,f.raw+'external',[f.operation]),/External file change/);
 assert.throws(()=>native.apply(f.snapshot,f.raw,[f.operation,f.operation]));
 const other=fixture();assert.throws(()=>native.apply(f.snapshot,f.raw,[other.operation]),/Unknown stable block ID/);
 const ambiguous=structuredClone(f.snapshot);ambiguous.blocks[0].id=f.block.id;assert.throws(()=>native.apply(ambiguous,f.raw,[f.operation]));
 assert.equal(JSON.stringify(f.snapshot),before);
});
test('duplicate or invalid existing aspects and semantically unchanged ratios are refused',()=>{
 for(const aspect of ['aspect=4/5 aspect=16/9','4/5 aspect=16/9','4/5 16/9','aspect=','aspect=NaN','aspect=Infinity','aspect=4/0','aspect=0/5','aspect=-4/5','aspect=4.5/3','aspect=999999999999999999999/1','0/5','4/0','aspect=4/3','4/3','aspect=8/6']){
  const f=fixture({directive:'%%photo: repeated.png · Selected 瓷 😀 · wide '+aspect+'%%'});assert.throws(()=>native.apply(f.snapshot,f.raw,[f.operation]),aspect);
 }
});
test('cover, opener, bleed, groups, nested, ending, metadata and trailing notes cannot acquire an aspect through this operation',()=>{
 const f=fixture();
 for(const text of ['Cover ·','Opener ·','Bleed ·','Group first','Nested ·','Ending detail','Closing photo','Invented metadata.','Invented notes:']){
  const block=f.snapshot.blocks.find(b=>b.raw.includes(text));assert.ok(block,text);assert.throws(()=>native.apply(f.snapshot,f.raw,[{...f.operation,id:block.id,seenBlockHash:block.origin.blockHash}]),text);
 }
 const combined=fixture({directive:DIRECTIVE+'\nInvented words attached to this same chunk.'});assert.throws(()=>native.apply(combined.snapshot,combined.raw,[combined.operation]));
});
test('aspect inverse retains existing stale and wrong-owner Undo guards',()=>{
 const f=fixture(),result=native.apply(f.snapshot,f.raw,[f.operation]);
 assert.throws(()=>native.undo(result.snapshot,result.raw+'external',result.inverse));
 const foreign=structuredClone(result.snapshot);foreign.sourceKey='foreign:article';assert.throws(()=>native.undo(foreign,result.raw,result.inverse));
 const damaged=structuredClone(result.inverse);damaged.before.blocks[0].raw+='damage';assert.throws(()=>native.undo(result.snapshot,result.raw,damaged));
});
test('existing focal adjustment retains its exact coordinate-only behavior in maintained source',()=>{
 const f=fixture({newline:'\r\n'}),operation={kind:'photoFocus',id:f.block.id,seenBlockHash:f.block.origin.blockHash,x:.7,y:.3},result=native.apply(f.snapshot,f.raw,[operation]);
 assert.equal(result.raw,f.raw.replace(DIRECTIVE,DIRECTIVE.replace('x=2e-1 y=.8','x=0.7 y=0.3')));
 assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,f.raw);
});
