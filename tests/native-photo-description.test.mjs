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
 const operation={kind:'photoDescription',id:block.id,seenBlockHash:block.origin.blockHash,description:'Exact description 瓷 😀'};
 return {raw,snapshot,block,operation};
}
const story=raw=>parser.parseDraft(parser.draftBody(raw).body);

for(const newline of ['\n','\r\n'])test('description changes one exact duplicate occurrence; preserves all other bytes and exact Undo '+JSON.stringify(newline),()=>{
 const f=fixture({newline}),before=structuredClone(f.snapshot),result=native.apply(f.snapshot,f.raw,[f.operation]);assert.equal(result.raw,f.raw.replace(DIRECTIVE,DIRECTIVE.replace('Selected 瓷 😀','Exact description 瓷 😀')));assert.deepEqual(f.snapshot,before);assert.deepEqual(result.snapshot.blocks.map(b=>b.id),before.blocks.map(b=>b.id));const expected=story(f.raw);expected.opening.find(b=>b.shot?.alt==='Selected 瓷 😀').shot.alt='Exact description 瓷 😀';assert.deepEqual(story(result.raw),expected);assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,f.raw);
});
test('description refuses stale, unknown, combined, unsafe, caption and composed edits without mutation',()=>{
 const f=fixture(),before=structuredClone(f.snapshot);
 for(const change of [{description:'100%'},{description:'one · two'},{description:'line\nline'},{description:' spaced '},{description:'\ud800'},{description:'x'.repeat(2001)},{seenBlockHash:'0'.repeat(64)},{caption:'caption'},{file:'another.png'},{id:'unknown'}])assert.throws(()=>native.apply(f.snapshot,f.raw,[{...f.operation,...change}]));
 assert.throws(()=>native.apply(f.snapshot,f.raw,[f.operation,f.operation]));
 for(const block of f.snapshot.blocks.filter(b=>/Cover|Opener|Group first|Closing photo|Side|Nested|Ending detail/.test(b.raw)&&b.id!==f.block.id))assert.throws(()=>native.apply(f.snapshot,f.raw,[{...f.operation,id:block.id,seenBlockHash:block.origin.blockHash}]));
 assert.deepEqual(f.snapshot,before);
});
test('blank description is supported and native field padding stays byte exact',()=>{
 const directive=DIRECTIVE.replace('Selected 瓷 😀','  Selected 瓷 😀  '),f=fixture({directive}),result=native.apply(f.snapshot,f.raw,[{...f.operation,description:''}]);assert.equal(result.raw,f.raw.replace(directive,directive.replace('Selected 瓷 😀','')));assert.equal(story(result.raw).opening.find(b=>b.kind==='wide').shot.alt,'');assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,f.raw);
});
