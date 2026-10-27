import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
import {splitBlocks, edit, hash as paragraphHash} from '../runtime/reference/mag-edit.mjs';
import * as codec from '../runtime/services/magazine/feedback-share-codec.mjs';
import {parseFeedbackShare, updateFeedbackShare, updateFeedbackShareSection} from '../runtime/services/magazine/feedback-share-codec.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const original='---\ntype: FEEDBACK\nstory: Invented kiln\n---\n\n# Invitations\n\n## A Chinese\n\n你好，甲。\n\n## A English\n\nHello A.\n\n## B Chinese\n\n你好，乙。\n\n## B English\n\nHello B.\n';
function meta(md=original){
 const headings=['## A Chinese','## A English','## B Chinese','## B English'];
 return {schema:'ar-create.magazine-feedback-share.v1',entries:ids.map((recipientId,i)=>({recipientId,target:{storyId:'mag-invented-kiln',pieceId:'mag-invented-kiln:article',edition:'working',hash:'a'.repeat(64)},sections:headings.slice(i*2,i*2+2).map((heading,j)=>{const at=md.indexOf(heading),next=md.indexOf('\n## ',at+1);return {language:j?'en':'zh',heading,hash:sha(md.slice(at,next<0?md.length:next+1))};})}))};
}
test('two explicit recipients and language anchors project canonical sections without copying prose into metadata',()=>{
 const metadata=meta(), result=updateFeedbackShare(original,{expectedHash:sha(original),metadata});
 const parsed=parseFeedbackShare(result.markdown);
 assert.equal(parsed.structured,true);assert.deepEqual(parsed.metadata,metadata);assert.equal(parsed.projection.length,2);
 assert.equal(parsed.projection[0].sections[0].language,'zh');assert.match(parsed.projection[0].sections[0].markdown,/你好，甲/);
 assert.equal(result.markdown.replace(/^ar-create-share: .*\n/m,''),original);
 assert.ok(!JSON.stringify(metadata).includes('你好'));assert.equal(result.beforeHash,sha(original));assert.equal(result.hash,sha(result.markdown));
});

test('legacy text remains readable and never guesses a recipient or a default language',()=>{
 const parsed=parseFeedbackShare(original);assert.equal(parsed.structured,false);assert.equal(parsed.markdown,original);assert.deepEqual(parsed.projection,[]);
 const metadata=meta();delete metadata.entries[0].sections[0].language;
 assert.throws(()=>updateFeedbackShare(original,{expectedHash:sha(original),metadata}));
});
test('metadata insertion and replacement preserve every other byte and have exact reversible metadata patches',()=>{
 for(const md of [original,original.replace(/^---\n[\s\S]*?\n---\n/,''),original.replaceAll('\n','\r\n')]){
  const metadata=meta(md), first=updateFeedbackShare(md,{expectedHash:sha(md),metadata});
  const inverse=(text,change)=>text.slice(0,change.start)+change.before+text.slice(change.start+change.after.length);
  assert.equal(inverse(first.markdown,first.metadataChange),md);
  const next=structuredClone(metadata);next.entries[0].target.hash='b'.repeat(64);
  const second=updateFeedbackShare(first.markdown,{expectedHash:first.hash,metadata:next});
  assert.equal(inverse(second.markdown,second.metadataChange),first.markdown);
 }
});
test('structured actions refuse newer files, ambiguous headings and stale mapped sections while retaining the full source',()=>{
 const metadata=meta(), saved=updateFeedbackShare(original,{expectedHash:sha(original),metadata});
 assert.throws(()=>updateFeedbackShare(saved.markdown+'New note.\n',{expectedHash:saved.hash,metadata}),/changed/);
 for(const changed of [saved.markdown.replace('Hello A.','Hello newer A.'),saved.markdown+'\n## A English\n\nAnother message.\n']){
  const parsed=parseFeedbackShare(changed);assert.equal(parsed.structured,false);assert.equal(parsed.markdown,changed);assert.deepEqual(parsed.projection,[]);
  assert.throws(()=>updateFeedbackShare(changed,{expectedHash:sha(changed),metadata}));
 }
});
test('malformed or duplicate namespaces refuse structured updates without discarding Markdown',()=>{
 for(const line of ['ar-create-share: {bad json}','ar-create-share: null',"'ar-create-share': {}",'  ar-create-share: {}','AR-CREATE-SHARE: {}','ar-create-share: {}\nar-create-share: {}']){
  const md=original.replace('type: FEEDBACK','type: FEEDBACK\n'+line), parsed=parseFeedbackShare(md);
  assert.equal(parsed.structured,false);assert.equal(parsed.markdown,md);assert.throws(()=>updateFeedbackShare(md,{expectedHash:sha(md),metadata:meta(md)}));
 }
});
test('duplicate owners/languages, unmapped or foreign content fields and inferred sending are refused',()=>{
 for(const alter of [m=>m.entries.push(m.entries[0]),m=>m.entries[0].sections.push(m.entries[0].sections[0]),m=>m.entries[1].sections[0]={...m.entries[0].sections[0]},m=>m.entries[0].message='Duplicated prose',m=>m.entries[0].sent=true,m=>m.entries[0].target.edition='published',m=>m.entries[0].recipientId='Invented person',m=>m.entries[0].sections[0].heading='## Absent',m=>m.entries[0].sections[0].hash='c'.repeat(64)]){
  const metadata=meta();alter(metadata);assert.throws(()=>updateFeedbackShare(original,{expectedHash:sha(original),metadata}));
 }
});
test('mapped bilingual editing changes only its canonical section and metadata hash, preserving the other recipient',()=>{
 const metadata=meta(), saved=updateFeedbackShare(original,{expectedHash:sha(original),metadata});
 const content='## A Chinese\n\n你好，新甲。\n\n';
 const result=updateFeedbackShareSection(saved.markdown,{expectedHash:saved.hash,recipientId:ids[0],target:metadata.entries[0].target,language:'zh',expectedSectionHash:metadata.entries[0].sections[0].hash,content});
 const parsed=parseFeedbackShare(result.markdown);assert.equal(parsed.structured,true);assert.equal(parsed.projection[0].sections[0].markdown,content);
 assert.equal(parsed.metadata.entries[0].sections[0].hash,sha(content));assert.deepEqual(parsed.metadata.entries[1],metadata.entries[1]);
 assert.equal(result.markdown.replace(/^ar-create-share: .*\n/m,''),original.replace('## A Chinese\n\n你好，甲。\n\n',content));
 assert.equal(result.beforeHash,saved.hash);
 for(const changes of [{recipientId:ids[1]},{language:'fr'},{expectedSectionHash:'b'.repeat(64)},{target:{...metadata.entries[0].target,hash:'c'.repeat(64)}},{content:'## A English\nWrong heading.\n'},{content:content+'## Injected heading\nNew section.\n'}]){
  assert.throws(()=>updateFeedbackShareSection(saved.markdown,{expectedHash:saved.hash,recipientId:ids[0],target:metadata.entries[0].target,language:'zh',expectedSectionHash:metadata.entries[0].sections[0].hash,content,...changes}));
 }
 // Magazine's saved before-bytes, rather than an independent codec history, restore exactly.
 assert.equal(parseFeedbackShare(saved.markdown).projection[0].sections[0].markdown,'## A Chinese\n\n你好，甲。\n\n');
});
test('heading-like lines inside fenced examples cannot establish a language anchor',()=>{
 const md=original+'\n```md\n## Example Chinese\nHello.\n```\n', metadata=meta(md);
 metadata.entries[0].sections[0]={language:'zh',heading:'## Example Chinese',hash:sha('## Example Chinese\nHello.\n```\n')};
 assert.throws(()=>updateFeedbackShare(md,{expectedHash:sha(md),metadata}),/missing or ambiguous/);
});
test('duplicate JSON keys, multiline namespace values and headings hidden in comments are not structured mappings',()=>{
 const saved=updateFeedbackShare(original,{expectedHash:sha(original),metadata:meta()});
 const key='ar-create-share: ';
 for(const md of [saved.markdown.replace(key+'{',key+'{"schema":"wrong",'),saved.markdown.replace(/^(ar-create-share: .*\n)/m,'$1  continued: invalid\n')]){
  const parsed=parseFeedbackShare(md);assert.equal(parsed.structured,false);assert.equal(parsed.markdown,md);
 }
 const md=original+'\n<!--\n## Hidden\nComment text.\n-->\n',metadata=meta(md);
 metadata.entries[0].sections[0]={language:'zh',heading:'## Hidden',hash:sha('## Hidden\nComment text.\n-->\n')};
 assert.throws(()=>updateFeedbackShare(md,{expectedHash:sha(md),metadata}),/missing or ambiguous/);
});

test('the maintained paragraph editor preserves namespace bytes, exposes changed section mapping and exact restored bytes',t=>{
 const saved=updateFeedbackShare(original,{expectedHash:sha(original),metadata:meta()}), rel='Workflow/6-Feedback/FEEDBACK - Clay Teacher.md';
 const f=buildMagazineFixture({extra:{[rel]:saved.markdown}});t.after(f.cleanup);
 const {fm,parts}=splitBlocks(saved.markdown), k=parts.findIndex((part,i)=>i%2===0&&part.trim()==='Hello A.');assert.ok(k>=0);
 edit(f.vault,rel,k/2,paragraphHash(parts[k]),'A newer paragraph.');
 const newer=fs.readFileSync(path.join(f.vault,rel),'utf8');assert.equal(splitBlocks(newer).fm,fm);assert.equal(parseFeedbackShare(newer).structured,false);
 assert.ok(newer.includes('你好，乙。'));assert.ok(newer.includes('Hello B.'));
 // The original owner receipt's before-bytes remain a complete restorable source.
 assert.equal(parseFeedbackShare(saved.markdown).structured,true);assert.equal(splitBlocks(saved.markdown).fm,fm);
});


test('optional explicit recipient names project unchanged and reject invalid names',()=>{
 const metadata=meta();metadata.entries[0].recipientName='甲 · Invented recipient';
 const saved=updateFeedbackShare(original,{expectedHash:sha(original),metadata}), parsed=parseFeedbackShare(saved.markdown);
 assert.equal(parsed.projection[0].recipientName,metadata.entries[0].recipientName);
 assert.equal(Object.hasOwn(parsed.projection[1],'recipientName'),false);
 assert.deepEqual(parsed.metadata,metadata);
 for(const recipientName of ['', '   ', 'x'.repeat(201), 'A\nB', 'A\rB', 'A\tB', 'A\u007fB', 'A\u0085B', 'A\u2028B', null, 5, {}]){
  const invalid=meta();invalid.entries[0].recipientName=recipientName;
  assert.throws(()=>updateFeedbackShare(original,{expectedHash:sha(original),metadata:invalid}));
 }
});

test('section choices expose exact raw section hashes and exclude fenced and commented headings',()=>{
 assert.equal(typeof codec.feedbackShareSectionChoices,'function');
 const md=original+'\n```md\n## Fenced\n```\n<!--\n## Hidden\n-->\n<!-- ## Inline hidden -->\n~~~\n## Tilde hidden\n~~~\n# Last\nFinal.\n';
 const choices=codec.feedbackShareSectionChoices(md);
 assert.deepEqual(choices.map(row=>row.heading),['# Invitations','## A Chinese','## A English','## B Chinese','## B English','# Last']);
 for(const choice of choices){assert.deepEqual(Object.keys(choice).sort(),['end','hash','heading','start']);assert.equal(choice.hash,sha(md.slice(choice.start,choice.end)));assert.ok(md.slice(choice.start).startsWith(choice.heading));}
 assert.equal(choices.at(-1).end,md.length);
});

test('mapping one explicit recipient appends or replaces its exact target while retaining every other mapping and source byte',()=>{
 assert.equal(typeof codec.mapFeedbackShareRecipient,'function');
 const metadata=meta(), initial=structuredClone(metadata);initial.entries.pop();
 const saved=updateFeedbackShare(original,{expectedHash:sha(original),metadata:initial});
 const result=codec.mapFeedbackShareRecipient(saved.markdown,{expectedHash:saved.hash,recipientId:ids[1],recipientName:'Invented B',target:metadata.entries[1].target,sections:metadata.entries[1].sections});
 const parsed=parseFeedbackShare(result.markdown);
 assert.equal(parsed.projection[1].recipientName,'Invented B');assert.deepEqual(parsed.metadata.entries[0],initial.entries[0]);
 assert.equal(result.markdown.replace(/^ar-create-share: .*\n/m,''),original);
 const replaced=codec.mapFeedbackShareRecipient(result.markdown,{expectedHash:result.hash,recipientId:ids[1],target:metadata.entries[1].target,sections:[metadata.entries[1].sections[1]]});
 const next=parseFeedbackShare(replaced.markdown);
 assert.equal(next.metadata.entries.length,2);assert.deepEqual(next.metadata.entries[0],initial.entries[0]);
 assert.equal(next.metadata.entries[1].recipientName,'Invented B');
 assert.deepEqual(next.metadata.entries[1].sections,[metadata.entries[1].sections[1]]);
 const fresh=codec.mapFeedbackShareRecipient(original,{expectedHash:sha(original),...metadata.entries[0]});
 assert.deepEqual(parseFeedbackShare(fresh.markdown).metadata.entries,[metadata.entries[0]]);
});

test('mapping refuses stale, malformed, foreign and overlapping identities through existing validation',()=>{
 assert.equal(typeof codec.mapFeedbackShareRecipient,'function');
 const metadata=meta(), saved=updateFeedbackShare(original,{expectedHash:sha(original),metadata});
 const base={expectedHash:saved.hash,...metadata.entries[0]};
 for(const changes of [{expectedHash:'b'.repeat(64)},{recipientId:'foreign'},{recipientName:''},{target:{...base.target,edition:'published'}},{target:{...base.target,extra:true}},{sections:[{...base.sections[0],hash:'b'.repeat(64)}]},{sections:[{...base.sections[0],heading:'## Foreign'}]},{sections:[base.sections[0],{...base.sections[1],language:'ZH'}]},{sections:[base.sections[0],{...base.sections[0],language:'fr'}]},{sections:[metadata.entries[1].sections[0]]},{sections:[{...base.sections[0],markdown:'copied prose'}]}]){
  assert.throws(()=>codec.mapFeedbackShareRecipient(saved.markdown,{...base,...changes}));
 }
 for(const md of [saved.markdown.replace('Hello A.','Changed.'),saved.markdown.replace('ar-create-share: {','ar-create-share: {bad'),saved.markdown+'\n## A English\nDuplicate.\n']){
  assert.throws(()=>codec.mapFeedbackShareRecipient(md,{...base,expectedHash:sha(md)}));
 }
});


test('section choices omit every ambiguous exact heading while preserving unique raw sections',()=>{
 const md=original+'\n## A English\nDuplicate.\n\n## Unique\nKeep this exact.\n';
 const choices=codec.feedbackShareSectionChoices(md);
 assert.equal(choices.some(choice=>choice.heading==='## A English'),false);
 assert.equal(choices.length,5);
 for(const choice of choices) assert.equal(choice.hash,sha(md.slice(choice.start,choice.end)));
 assert.equal(choices.at(-1).heading,'## Unique');
 const metadata=meta(md);
 assert.throws(()=>updateFeedbackShare(md,{expectedHash:sha(md),metadata}),/missing or ambiguous/);
});
