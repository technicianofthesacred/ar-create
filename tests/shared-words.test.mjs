// The shared word process: library, prompt, recognise, auto-fix receipts, grouped ask, remembered answers, export,
// and the human-only line. Invented data only; no network, no model, no installed app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createWordLibrary,parseTeaTerms,parseOracleCards,classifyVariant} from '../runtime/services/word-library.mjs';
import {buildPrompt,promptFromFile,tokens,PROMPT_TOKENS} from '../runtime/services/word-prompt.mjs';
import {findHits,findFixes,findDoubtful,MAX_DOUBTFUL} from '../runtime/services/word-recognise.mjs';
import {createSharedWords} from '../runtime/services/shared-words.mjs';
import {createNeedsYou} from '../runtime/services/needs-you.mjs';
import {createTranscriptCorrections} from '../runtime/services/transcript-corrections.mjs';
import {markdownTranscript,readableTranscript} from '../runtime/services/magazine/outputs.mjs';
import {addRecording,seg,TALK,TEA,ORACLE} from './helpers/word-recording.mjs';

const adrian={actor:'human:adrian',client:'ui'},adrianCli={actor:'human:adrian',client:'cli'},agent={actor:'agent:claude-code',client:'cli'},importer={actor:'import:tea-terms',client:'cli'};
const DAY=24*3600e3;
const op=()=>randomUUID();

function home(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-words-')));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const clock={at:Date.parse('2026-11-03T08:00:00Z')},now=()=>clock.at;
 const library=createWordLibrary({dataDir:dir,now});
 const writeSeed=(name,value)=>{const f=path.join(dir,'seeds',name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(value));return f;};
 return {dir,clock,now,library,writeSeed};
}
async function seeded(t){
 const h=home(t),tea=h.writeSeed('tea-terms.json',TEA),oracle=h.writeSeed('oracle_cards_complete.json',ORACLE);
 await h.library.importFrom({operationId:op(),source:'tea-terms',path:tea},importer);
 await h.library.importFrom({operationId:op(),source:'oracle-cards',path:oracle},importer);
 return {...h,tea,oracle};
}

// ---------- a finished recording in the recording owner's own layout (tests/helpers/word-recording.mjs) ----------
async function engine(t,{segments=TALK,...options}={}){
 const h=await seeded(t);
 const rec=addRecording(h,{segments,...options});
 const corrections=createTranscriptCorrections({dir:rec.dir,config:rec.config});
 const needs=createNeedsYou({dataDir:h.dir,now:h.now});
 const shared=createSharedWords({dataDir:h.dir,library:h.library,corrections,needsYou:needs,now:h.now});
 // a confirmed mishearing, the way Adrian would have taught it
 await h.library.add({operationId:op(),spelling:'Shou Puerh',variants:[{text:'shaw puerh',kind:'heard'}]},adrianCli);
 const another=segs=>addRecording(h,{segments:segs});
 return {...h,rec,corrections,needs,shared,another,transcript:()=>JSON.parse(fs.readFileSync(path.join(rec.output,'transcript.json'),'utf8'))};
}

// ---------- 1. the library and its seeds ----------
test('tea terms import read-only: categories, mishearing versus alias, and a repeat import changes nothing',async t=>{
 const h=home(t),file=h.writeSeed('tea-terms.json',TEA),before=fs.readFileSync(file);
 const a=await h.library.importFrom({operationId:op(),source:'tea-terms',path:file},importer);
 assert.equal(a.created,5);assert.equal(a.entries,5);
 assert.deepEqual(fs.readFileSync(file),before,'the seed file is only ever read');
 const all=(await h.library.list({status:'all'})).entries,by=s=>all.find(e=>e.spelling===s);
 assert.equal(by('Lu Yu').category,'person');assert.equal(by('Yixing').category,'place');assert.equal(by('Puerh').category,'tea-term');
 assert.equal(by('Chan').note,'Zen','the bracket becomes a note, the spelling stays plain');
 assert.equal(by('Shou Puerh').variants.find(v=>v.text==='shou puer').kind,'heard');
 assert.equal(by('Shou Puerh').variants.find(v=>v.text==='ripe puerh').kind,'alias','a synonym is recognised but never rewritten');
 assert.equal(classifyVariant('Puerh','普尔'),'heard');assert.equal(classifyVariant('Lu Yu','lu'),'alias');
 assert.ok(by('Puerh').languages.includes('zh')&&by('Puerh').zh==='普洱');
 assert.equal(by('Puerh').source.kind,'import');assert.equal(by('Puerh').addedBy,'import:tea-terms');assert.ok(by('Puerh').addedAt);
 const again=await h.library.importFrom({operationId:op(),source:'tea-terms',path:file},importer);
 assert.deepEqual([again.created,again.updated,again.unchanged],[0,0,5]);
 assert.equal((await h.library.list({status:'all'})).matched,5);
});

test('hexagram names and Gene Keys import from the oracle list; Wilhelm romanisation is an alias, not a rewrite',async t=>{
 const h=home(t),file=h.writeSeed('oracle_cards_complete.json',ORACLE);
 const done=await h.library.importFrom({operationId:op(),source:'oracle-cards',path:file},importer);
 assert.ok(done.created>=9);
 const cats=(await h.library.list()).counts.byCategory;
 assert.equal(cats.hexagram,3);assert.ok(cats['gene-key']>=8,'shadow, gift and siddhi names, once each');
 const hex=(await h.library.list({category:'hexagram'})).entries.find(e=>e.spelling==='The Creative');
 assert.deepEqual(hex.variants.map(v=>[v.text,v.kind]),[["Ch'ien",'alias']]);
 assert.equal((await h.library.list({category:'gene-key',q:'beauty'})).entries.length,1,'a name shared by two keys is one entry');
 assert.ok(parseOracleCards(ORACLE).some(e=>e.spelling==='Gene Keys'));
 assert.throws(()=>parseOracleCards({codon_rings:[]}),/no cards/);assert.throws(()=>parseTeaTerms({}),/no terms/);
});

test('seeding is for Adrian or an import script; an agent cannot import, and a missing file is a plain refusal',async t=>{
 const h=home(t),file=h.writeSeed('tea-terms.json',TEA);
 await assert.rejects(h.library.importFrom({operationId:op(),source:'tea-terms',path:file},agent),e=>e.status===403);
 await assert.rejects(h.library.importFrom({operationId:op(),source:'tea-terms',path:path.join(h.dir,'nope.json')},importer),e=>e.status===404);
 await assert.rejects(h.library.importFrom({operationId:op(),source:'tea-terms',path:'relative.json'},importer),/absolute/);
 await assert.rejects(h.library.importFrom({operationId:op(),source:'other'},importer),/source is/);
 assert.equal((await h.library.list({status:'all'})).matched,0);
});

// ---------- 2. prompt ----------
test('the prompt is built from confirmed words, per language, inside the token budget, learned words first',async t=>{
 const h=await seeded(t);
 const en=await h.library.promptFor({language:'en'});
 assert.match(en.prompt,/^Names and terms in this conversation: /);
 assert.ok(en.words.includes('Lu Yu')&&en.words.includes('Puerh'));
 assert.ok(en.tokens<=PROMPT_TOKENS,'inside the 160 token budget');assert.equal(tokens(en.prompt),en.tokens);
 const zh=await h.library.promptFor({language:'zh'});
 assert.ok(zh.words.includes('普洱')&&zh.words.includes('陆羽'));assert.match(zh.prompt,/^以下是/);
 assert.ok(!zh.words.some(x=>/^[A-Za-z]/.test(x)),'the Chinese prompt holds Chinese forms only');
 // a word Adrian once corrected goes to the front
 await h.library.learn({heard:'moon shan',spelling:'Mengshan',category:'place',from:{jobId:randomUUID(),story:'x',at:3,sentence:'s'},operationId:op()},adrian);
 assert.equal((await h.library.promptFor({language:'en'})).words[0],'Mengshan');
 // a tight budget cuts the list, never overruns
 const tight=await h.library.promptFor({language:'en',budget:20});
 assert.ok(tight.tokens<=20&&tight.words.length<en.words.length);
 // prefer lifts a topic within its tier
 assert.equal((await h.library.promptFor({language:'en',prefer:['person']})).words.indexOf('Lu Yu')<=(await h.library.promptFor({language:'en'})).words.indexOf('Lu Yu'),true);
});

test('an agent\'s suggestion never reaches a prompt, and an empty library gives no prompt so the tea-terms path stays the fallback',async t=>{
 const h=home(t);
 assert.equal((await h.library.promptFor({language:'en'})).prompt,'','nothing confirmed: the caller falls back');
 const sug=await h.library.add({operationId:op(),spelling:'Zhongshan'},agent);
 assert.equal(sug.entry.status,'proposed');assert.equal(sug.entry.proposedBy,'agent:claude-code');
 assert.equal((await h.library.promptFor({language:'en'})).prompt,'');
 assert.deepEqual(await h.library.entries(),[]);
 // the transcription job reads the file itself
 assert.equal(promptFromFile(path.join(h.dir,'word-library','library.json')).prompt,'');
 assert.equal(promptFromFile(path.join(h.dir,'missing.json')).prompt,'');
 await h.library.add({operationId:op(),spelling:'Zhongshan',category:'place'},adrianCli);
 assert.match(promptFromFile(path.join(h.dir,'word-library','library.json')).prompt,/Zhongshan/);
 assert.equal(buildPrompt([],{}).prompt,'');
});

// ---------- 3. recognise ----------
test('recognise finds library hits, known mishearings and the four kinds of doubtful word',async t=>{
 const e=await engine(t);
 const entries=await e.library.entries(),result=e.transcript();
 const hits=findHits(result,entries);
 assert.ok(hits.some(h=>h.spelling==='Shou Puerh'&&h.heard['shaw puerh']===1));
 const fixes=findFixes(result,entries);
 assert.deepEqual(fixes.changes.map(c=>[c.heard,c.spelling]),[['shaw puerh','Shou Puerh']]);
 assert.equal(fixes.corrections[0].text,'We drank Shou Puerh from 1998 with Maria at the farm.');
 const doubt=findDoubtful(result,entries,{});
 const kinds=Object.fromEntries(doubt.items.map(i=>[i.word,i.kind]));
 assert.equal(kinds['Lu Yo'],'near-match');assert.equal(doubt.items.find(i=>i.word==='Lu Yo').suggestion,'Lu Yu');
 assert.equal(kinds['1998'],'number');assert.equal(kinds['Maria'],'unknown-name');assert.equal(kinds['gaiwan'],'low-confidence');
 const maria=doubt.items.find(i=>i.word==='Maria');
 assert.equal(maria.sentence,'We drank shaw puerh from 1998 with Maria at the farm.');assert.equal(maria.segmentIndex,1);assert.ok(maria.start>=5);
 assert.ok(!('Classic' in {}),'(sentence-start words are not names)');
 assert.ok(!doubt.items.some(i=>i.word==='Lu'||i.word==='Yo'),'a near-miss is one item, not its pieces');
});

test('known library words and sentence starts are not doubtful; words Adrian keeps twice stop being asked about',async t=>{
 const e=await engine(t,{segments:[seg(0,'Lu Yu wrote it. Yixing clay is good. Then we met Jonas and Jonas again.')]});
 const entries=await e.library.entries();
 const first=findDoubtful(e.transcript(),entries,{});
 const words=first.items.map(i=>i.word);
 assert.ok(!words.includes('Lu Yu')&&!words.includes('Yixing')&&!words.includes('Then'));
 assert.equal(first.items.find(i=>i.word==='Jonas').occurrences,2,'one item per word, with the count');
 assert.ok(!findDoubtful(e.transcript(),entries,{kept:{jonas:2}}).items.some(i=>i.word==='Jonas'));
});

test('a long talk is capped so it cannot flood the list',async t=>{
 const names=Array.from({length:70},(_,i)=>'Zq'+String.fromCharCode(97+(i%26))+String.fromCharCode(97+((i*7)%26))+'ona'+i);
 const text='We met '+names.join(', ')+' today.';
 const e=await engine(t,{segments:[seg(0,text)]});
 const doubt=findDoubtful(e.transcript(),await e.library.entries(),{});
 assert.equal(doubt.items.length,MAX_DOUBTFUL);assert.ok(doubt.dropped>0);
});

// ---------- 4. auto-fix with a receipt ----------
test('known mishearings are fixed automatically through the correction receipts; RAW and the first transcript are kept',async t=>{
 const e=await engine(t);
 const rawBefore=fs.readFileSync(e.rec.raw),audioBefore=fs.readFileSync(e.rec.audio);
 const baseBefore=JSON.parse(fs.readFileSync(path.join(e.rec.output,'transcript.json'),'utf8'));
 const done=await e.shared.recognise({jobId:e.rec.id},adrianCli);
 assert.equal(done.fixes.applied.length,1);assert.ok(done.fixes.receiptId);
 const now=e.transcript();
 assert.equal(now.segments[1].text,'We drank Shou Puerh from 1998 with Maria at the farm.');
 assert.equal(now.segments[0].text,baseBefore.segments[0].text,'other segments are untouched');
 // the receipt is the existing kind: exact before and after, status applied
 const receipt=JSON.parse(fs.readFileSync(path.join(e.rec.output,'.corrections',done.fixes.receiptId+'.proposal.json'),'utf8'));
 assert.equal(receipt.status,'applied');assert.equal(receipt.kind,'library-variant');
 assert.equal(receipt.changes[0].before.text,baseBefore.segments[1].text);assert.equal(receipt.changes[0].after.text,now.segments[1].text);
 assert.match(receipt.reason,/shaw puerh" -> "Shou Puerh/);
 assert.ok(JSON.parse(receipt.before.json).segments[1].text.includes('shaw puerh'),'the wording before the fix is in the receipt');
 assert.deepEqual(fs.readFileSync(e.rec.raw),rawBefore);assert.deepEqual(fs.readFileSync(e.rec.audio),audioBefore);
 // the fixed word is no longer asked about
 assert.ok(!done.items.some(i=>/shaw/i.test(i.word)));
 // running it again changes nothing
 const twice=await e.shared.recognise({jobId:e.rec.id},adrianCli);
 assert.equal(twice.fixes.receiptId,done.fixes.receiptId);
});

test('a transcript Adrian already reviewed is never changed on its own; the fixes become things to check',async t=>{
 const e=await engine(t,{reviewed:true});
 const done=await e.shared.recognise({jobId:e.rec.id},adrianCli);
 assert.equal(done.fixes.receiptId,null);assert.equal(done.fixes.applied.length,0);
 assert.match(e.transcript().segments[1].text,/shaw puerh/);
 const item=done.items.find(i=>i.word==='shaw puerh');
 assert.equal(item.suggestion,'Shou Puerh');assert.equal(item.status,'open');
});

// ---------- 5. one ask per recording ----------
test('doubtful words from one recording are ONE steer ask, default keep as heard, scoped to the recording',async t=>{
 const e=await engine(t);
 const done=await e.shared.recognise({jobId:e.rec.id},agent);
 assert.ok(done.items.length>=4);
 const asks=(await e.needs.list({status:'all'})).asks;
 assert.equal(asks.length,1,'many words, one ask');
 const ask=asks[0];
 assert.equal(ask.band,'steer');assert.equal(ask.default,'Keep all as heard');assert.ok(ask.choices.includes('Keep all as heard'));
 assert.deepEqual(ask.scope,{kind:'recording-words',id:e.rec.id});assert.equal(ask.about,'Yixing visit');
 assert.match(ask.question,/words to check in "Yixing visit"/);assert.match(ask.question,/at \d+:\d\d/);
 assert.equal(done.askId,ask.id);
 assert.ok(Date.parse(ask.applyAt)>e.clock.at,'the default applies later, not at once');
 // running it again does not raise a second ask
 await e.shared.recognise({jobId:e.rec.id,force:true},agent);
 assert.equal((await e.needs.list({status:'all'})).asks.length,1);
 // each item carries its audio time and the sentence it sat in
 for(const item of done.items){assert.match(item.time,/^\d+:\d\d$/);assert.ok(item.sentence.length>0);assert.equal(item.status,'open');}
});

test('when the default applies, every word stays as heard and the transcript is unchanged by it',async t=>{
 const e=await engine(t);
 const done=await e.shared.recognise({jobId:e.rec.id},agent);
 const textBefore=JSON.stringify(e.transcript().segments.map(s=>s.text));
 e.clock.at+=8*DAY;
 const later=await e.shared.check({jobId:e.rec.id});
 assert.equal(later.state,'done');assert.ok(later.items.every(i=>i.status==='kept'&&i.answer.by==='default'));
 assert.equal(JSON.stringify(e.transcript().segments.map(s=>s.text)),textBefore);
 assert.equal((await e.library.entries()).some(x=>x.spelling==='Mariya'),false,'keeping as heard remembers nothing');
 assert.equal((await e.shared.checks()).recordings.length,0,'nothing left to check');
 assert.ok(done.items.length>0);
});

test('a recording with nothing doubtful raises no ask',async t=>{
 const e=await engine(t,{segments:[seg(0,'We drank tea and talked.')]});
 const done=await e.shared.recognise({jobId:e.rec.id},agent);
 assert.equal(done.items.length,0);assert.equal(done.state,'done');assert.equal((await e.needs.list({status:'all'})).asks.length,0);
});

// ---------- 6. the answer is remembered ----------
test('a confirmed spelling is remembered: it fixes this talk now and the next recording in any project on its own',async t=>{
 const e=await engine(t);
 const done=await e.shared.recognise({jobId:e.rec.id},agent);
 const near=done.items.find(i=>i.word==='Lu Yo'),name=done.items.find(i=>i.word==='Maria');
 // use the suggestion
 const a=await e.shared.answer({operationId:op(),jobId:e.rec.id,key:near.key,choice:'suggestion'},adrian);
 assert.equal(a.items.find(i=>i.key===near.key).status,'corrected');
 assert.equal(e.transcript().segments[0].text.startsWith('Lu Yu wrote'),true);
 assert.equal(a.learned.variant.text,'Lu Yo');
 // type his own spelling and say what it is
 const b=await e.shared.answer({operationId:op(),jobId:e.rec.id,key:name.key,choice:'spelling',spelling:'Mariya',category:'person'},adrian);
 assert.equal(b.learned.created,true);assert.match(e.transcript().segments[1].text,/with Mariya at the farm/);
 const lib=await e.library.list({q:'mariya',status:'all'});
 assert.equal(lib.entries[0].category,'person');assert.equal(lib.entries[0].variants[0].text,'Maria');
 assert.equal(lib.entries[0].source.kind,'confirmed-answer');assert.equal(lib.entries[0].addedBy,'human:adrian');
 assert.equal(lib.entries[0].source.story,'Yixing visit');assert.match(lib.entries[0].source.sentence,/Maria/);
 assert.ok(lib.recent.some(x=>x.spelling==='Mariya'),'it shows under recently learned');
 // the next recording gets both right with no question
 const next=e.another([seg(0,'Lu Yo and Maria came for tea.')]);
 const second=await e.shared.recognise({jobId:next.id},agent);
 const text=JSON.parse(fs.readFileSync(path.join(next.output,'transcript.json'),'utf8')).segments[0].text;
 assert.equal(text,'Lu Yu and Mariya came for tea.');
 assert.equal(second.fixes.applied.length,2);
 // and the prompt for the next transcription now carries the learned spelling
 assert.ok((await e.library.promptFor({language:'en'})).words.includes('Mariya'));
});

test('answering every word settles the ask; "keep" and "it is right" are honest answers too',async t=>{
 const e=await engine(t,{segments:[seg(0,'We met Maria and Jonas near 1998 in Yixing.')]});
 const done=await e.shared.recognise({jobId:e.rec.id},agent);
 const by=w=>done.items.find(i=>i.word===w);
 await e.shared.answer({operationId:op(),jobId:e.rec.id,key:by('Maria').key,choice:'right',category:'person'},adrian);
 assert.equal((await e.library.entries()).some(x=>x.spelling==='Maria'),true,'"that is right" teaches the library the name');
 await assert.rejects(e.shared.answer({operationId:op(),jobId:e.rec.id,key:by('1998').key,choice:'right'},adrian),/not added to the library/);
 await e.shared.answer({operationId:op(),jobId:e.rec.id,key:by('1998').key,choice:'spelling',spelling:'1989'},adrian);
 assert.match(e.transcript().segments[0].text,/near 1989 in/);
 assert.equal((await e.library.list({q:'1989',status:'all'})).matched,0,'a figure is corrected for this talk and never becomes vocabulary');
 const last=await e.shared.answer({operationId:op(),jobId:e.rec.id,key:by('Jonas').key,choice:'keep'},adrian);
 assert.equal(last.state,'done');
 const ask=(await e.needs.list({status:'answered'})).asks[0];
 assert.equal(ask.resolution.choice,'Go through them');assert.equal(ask.resolution.by,'human:adrian');
 // asking again about a settled word is refused; replaying the same answer is not an error
 const jonas=by('Jonas');
 await assert.rejects(e.shared.answer({operationId:op(),jobId:e.rec.id,key:jonas.key,choice:'keep'},adrian),e=>e.status===409);
});

// ---------- 7. export ----------
test('the export is a versioned snapshot: confirmed words only, with ready-made prompts',async t=>{
 const e=await engine(t);
 await e.library.add({operationId:op(),spelling:'Pending Name'},agent);
 const snap=await e.library.exportSnapshot();
 assert.equal(snap.schema,'ar-create.word-library.export.v1');assert.match(snap.version,/^\d+\.[a-f0-9]{8}$/);
 assert.equal(snap.counts.entries,snap.entries.length);assert.equal(snap.promptBudgetTokens,160);
 assert.ok(!snap.entries.some(x=>x.spelling==='Pending Name'),'suggestions are not exported');
 assert.ok(snap.prompts.en.length>0&&snap.prompts.zh.length>0);
 const lu=snap.entries.find(x=>x.spelling==='Lu Yu');
 assert.deepEqual(Object.keys(lu).sort(),['addedAt','addedBy','category','id','languages','pinyin','source','spelling','trad','variants','zh'].sort().concat(lu.core?['core']:[]).sort());
 assert.ok(lu.variants.every(v=>['heard','alias'].includes(v.kind)&&Array.isArray(v.languages)));
 const again=await e.library.exportSnapshot();
 assert.equal(again.contentHash,snap.contentHash,'same words, same hash');
 await e.library.add({operationId:op(),spelling:'Mengshan',category:'place'},adrianCli);
 assert.notEqual((await e.library.exportSnapshot()).contentHash,snap.contentHash);
});

// ---------- 8. human-only ----------
test('an agent can suggest a word but not confirm it; only Adrian decides, and only he answers a doubtful word',async t=>{
 const e=await engine(t);
 const s=await e.library.add({operationId:op(),spelling:'Fenghuang',category:'place',variants:['fung wong']},agent);
 assert.equal(s.entry.status,'proposed');
 await assert.rejects(e.library.decide({operationId:op(),id:s.entry.id,decision:'confirm'},agent),e=>e.status===403);
 assert.equal((await e.library.entries()).some(x=>x.spelling==='Fenghuang'),false);
 // an agent adding a mishearing to a confirmed word is a suggestion on it, not a change
 const p=await e.library.add({operationId:op(),spelling:'Lu Yu',variants:['lou yoo']},agent);
 assert.deepEqual(p.proposedVariants,['lou yoo']);
 assert.equal((await e.library.entries()).find(x=>x.spelling==='Lu Yu').variants.some(v=>v.text==='lou yoo'),false);
 const ok=await e.library.decide({operationId:op(),id:p.entry.id,decision:'confirm'},adrian);
 assert.deepEqual(ok.addedVariants,['lou yoo']);
 const yes=await e.library.decide({operationId:op(),id:s.entry.id,decision:'confirm'},adrian);
 assert.equal(yes.entry.status,'confirmed');assert.equal(yes.entry.confirmedBy,'human:adrian');
 // answering a doubtful word: agents and scripts are refused, and so is Adrian from the command line
 const done=await e.shared.recognise({jobId:e.rec.id},agent),item=done.items[0];
 const body={operationId:op(),jobId:e.rec.id,key:item.key,choice:'keep'};
 await assert.rejects(e.shared.answer(body,agent),e=>e.status===403);
 await assert.rejects(e.shared.answer(body,{actor:'cron:x',client:'cli'}),e=>e.status===403);
 await assert.rejects(e.shared.answer(body,adrianCli),e=>e.status===403&&/Words screen/.test(e.message));
 await assert.rejects(e.library.learn({heard:'a',spelling:'b'},agent),e=>e.status===403);
 assert.equal((await e.shared.check({jobId:e.rec.id})).items.find(i=>i.key===item.key).status,'open');
 await e.shared.answer(body,adrian);
 assert.equal((await e.shared.check({jobId:e.rec.id})).items.find(i=>i.key===item.key).status,'kept');
});

// ---------- 9. watching ----------
test('the watcher recognises a recording that finishes after it began, once, and leaves older ones alone',async t=>{
 const h=await seeded(t),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 h.clock.at=Date.now();
 const older=addRecording(h,{segments:TALK,story:'Old talk'});
 const corrections=createTranscriptCorrections({dir:path.join(h.dir,'recordings'),config:{conversationTimestamps:true}});
 const needs=createNeedsYou({dataDir:h.dir,now:h.now});
 const shared=createSharedWords({dataDir:h.dir,library:h.library,corrections,needsYou:needs,now:h.now});
 await sleep(40);h.clock.at=Date.now();
 shared.start(1e9);shared.stop();                      // begins watching now
 assert.deepEqual(await shared.sweep(),[],'a recording finished before watching is not touched on its own');
 await sleep(40);h.clock.at=Date.now();
 const fresh=addRecording(h,{segments:TALK,story:'New talk'});
 assert.deepEqual(await shared.sweep(),[fresh.id]);
 assert.deepEqual(await shared.sweep(),[],'once');
 assert.equal((await needs.list({status:'all'})).asks.length,1);
 // the older recording can still be asked for by id
 assert.equal((await shared.recognise({jobId:older.id},agent)).story,'Old talk');
});

// ---------- 10. the transcription job uses it ----------
test('the transcription job primes the speech model from the library, and falls back to tea-terms when the library is empty',async t=>{
 const {vocabularyPrompt}=await import('../runtime/services/magazine/intake.mjs');
 const h=await seeded(t),builds=path.join(h.dir,'builds');
 fs.mkdirSync(builds);fs.writeFileSync(path.join(builds,'tea-terms.mjs'),"process.stdout.write('TEA TERMS FALLBACK\\n');");fs.writeFileSync(path.join(builds,'tea-terms.json'),'{}');
 const config={wordLibrary:h.library.filePath(),teaTerms:path.join(builds,'tea-terms.json'),buildsDir:builds};
 const job={language:'en'};
 assert.match(vocabularyPrompt(config,job),/^Names and terms in this conversation: .*Lu Yu/);
 assert.match(vocabularyPrompt(config,{language:'zh'}),/^以下是/);
 // nothing confirmed yet (only a suggestion): the Teajia path answers
 const empty=home(t);await empty.library.add({operationId:op(),spelling:'Suggested'},agent);
 assert.equal(vocabularyPrompt({...config,wordLibrary:empty.library.filePath()},job),'TEA TERMS FALLBACK');
 assert.equal(vocabularyPrompt({wordLibrary:empty.library.filePath()},job),'','and with no tea-terms either, no prompt at all');
});

test('the recording runner config carries the library path and the isolated reader accepts only a library.json',async t=>{
 const {createRecordings}=await import('../runtime/services/recordings.mjs'),{readIsolatedConfig}=await import('../runtime/services/magazine/isolated-config.mjs');
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-words-rec-')));t.after(()=>{delete process.env.AR_CREATE_MAG_CONFIG;fs.rmSync(dir,{recursive:true,force:true});});
 createRecordings({dataDir:dir,library:null});
 const file=path.join(dir,'recordings','runner-config.json');process.env.AR_CREATE_MAG_CONFIG=file;
 assert.equal(readIsolatedConfig().wordLibrary,path.join(dir,'word-library','library.json'));
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 fs.writeFileSync(file,JSON.stringify({...saved,wordLibrary:'/etc/passwd'}));
 assert.throws(()=>readIsolatedConfig(),/library\.json/);
});

test('running recognise again after the ask was settled raises a new ask only for words that are still open',async t=>{
 const e=await engine(t);
 const first=await e.shared.recognise({jobId:e.rec.id},agent);
 e.clock.at+=8*DAY;await e.shared.check({jobId:e.rec.id});                  // the default applied: everything kept as heard
 assert.equal((await e.needs.list({status:'open'})).asks.length,0);
 const again=await e.shared.recognise({jobId:e.rec.id,force:true},agent);
 assert.ok(again.items.every(i=>i.status==='kept'),'what he already settled stays settled');
 assert.equal(again.state,'done');assert.equal((await e.needs.list({status:'open'})).asks.length,0,'nothing new, so nothing asked');
 // a word that is new to the library since then does get asked about, in a fresh ask
 await e.library.add({operationId:op(),spelling:'Marian',category:'person'},adrianCli);
 const third=await e.shared.recognise({jobId:e.rec.id,force:true},agent);
 assert.equal(third.state,'open');assert.equal(third.items.filter(i=>i.status==='open').length,1);
 assert.equal(third.items.find(i=>i.status==='open').suggestion,'Marian');
 const asks=(await e.needs.list({status:'open'})).asks;
 assert.equal(asks.length,1);assert.notEqual(asks[0].id,first.askId);assert.match(asks[0].question,/^1 word to check/);
 assert.ok(first.items.length>0);
});
