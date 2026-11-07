// Invented transcripts only. Attention requires uncertainty, not resemblance to a vocabulary entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {findDoubtful,findFixes,findHits} from '../runtime/services/word-recognise.mjs';
const seg=(start,text,probability={},extra={})=>({start,end:start+10,text,words:text.split(' ').map((word,i)=>({word,start:start+i*.4,probability:probability[word]??probability[word.replace(/[.!?,]$/,'')]??.95})),avg_logprob:-.3,...extra});

const entry=(spelling,category,variants=[])=>({id:spelling,spelling,category,status:'confirmed',variants});
const vocabulary=[entry('Vitrification','tea-term'),entry('Reaction','gene-key'),entry('Lu Yu','person'),entry('Jonah','person')];
const doubtful=(segments,entries=vocabulary,options={})=>findDoubtful({segments},entries,options).items;

test('ordinary words resembling specialist vocabulary do not become proposed corrections',()=>{
 const items=doubtful([seg(0,'The verification was complete. Creation is the subject. We discuss verification and Creation again.')]);
 assert.deepEqual(items,[]);
 // Weak speech confidence cannot establish that an ordinary word meant a specialist term.
 const weak=doubtful([seg(0,'We discuss verification and Creation.',{verification:.1,Creation:.1})]);
 assert.ok(weak.every(i=>i.suggestion===null));
});

test('confident numbers and isolated capitalisation do not become chores',()=>{
 assert.deepEqual(doubtful([seg(0,'We met Maria in 1998 during the Annual Gathering.')],[]),[]);
});

test('weak confidence on ordinary speech needs stronger evidence than under half',()=>{
 assert.deepEqual(doubtful([seg(0,'It was nice again.',{nice:.4})],[]),[]);
 assert.deepEqual(doubtful([seg(0,'It was nice again.',{nice:.2})],[]),[],'a common adjective is not editorial uncertainty');
});

test('genuinely uncertain names, uncommon words and numbers remain reviewable',()=>{
 const items=doubtful([seg(0,'We met Marisol carrying a gaiwan in 1998.',{Marisol:.2,gaiwan:.2,'1998':.2})],[]);
 assert.deepEqual(items.map(i=>[i.word,i.kind]).sort((a,b)=>a[0].localeCompare(b[0])),[['1998','number'],['gaiwan','low-confidence'],['Marisol','low-confidence']].sort((a,b)=>a[0].localeCompare(b[0])));
 assert.ok(items.every(i=>i.sentence==='We met Marisol carrying a gaiwan in 1998.'));
});

test('a weak segment alone can flag a proper name, but not every confident number',()=>{
 const items=doubtful([seg(0,'We met Marisol in 1998.',undefined,{avg_logprob:-1.4})],[]);
 assert.ok(items.some(i=>i.word==='Marisol'));
 assert.ok(!items.some(i=>i.word==='1998'),'a year needs its own uncertain word evidence');
});

test('proper-name phrase near matches survive while confident single-token names do not get replaced',()=>{
 const items=doubtful([seg(0,'Lu Yo wrote the book. We met Jonas there.')]);
 assert.equal(items.find(i=>i.word==='Lu Yo')?.suggestion,'Lu Yu');
 assert.ok(!items.some(i=>i.word==='Jonas'));
 const weak=doubtful([seg(0,'We met Jonas there.',{Jonas:.2})]);
 assert.equal(weak.find(i=>i.word==='Jonas')?.suggestion,'Jonah');
});

test('confirmed aliases and learned mishearings preserve exact recognition and correction',()=>{
 const entries=[entry('Mengshan','place',[{text:'moon shan',kind:'heard'}]),entry('Shou Puerh','tea-term',[{text:'ripe puerh',kind:'alias'}])];
 const result={segments:[seg(0,'We visited moon shan and drank ripe puerh.')]};
 assert.deepEqual(findFixes(result,entries).corrections,[{index:0,text:'We visited Mengshan and drank ripe puerh.'}]);
 assert.equal(findHits(result,entries).length,2);
});

test('twice-kept uncertain words do not return under a different detector',()=>{
 const items=doubtful([seg(0,'We met Jonas with the gaiwan.',{Jonas:.2,gaiwan:.2})],vocabulary,{kept:{jonas:2,gaiwan:2}});
 assert.deepEqual(items,[]);
});
