// The sentence about sources on Share (4 November 2026): the verb follows the count beside it, so "1 has none", never "1 have none".
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
function sentence(counts){const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window;w.requestAnimationFrame=f=>setTimeout(f,0);
 w.eval(fs.readFileSync(new URL('../public/document-study/consent-desk.js',import.meta.url),'utf8'));const text=w.arConsentDesk.accuracySentence(counts);w.close();return text;}
test('the unsourced count agrees with its verb: 1 has none, 2 have none',()=>{
 assert.equal(sentence({claims:4,sourced:3,unsourced:1,doubtful:0}),'3 of 4 claims have a source, 1 has none.');
 assert.equal(sentence({claims:5,sourced:3,unsourced:2,doubtful:0}),'3 of 5 claims have a source, 2 have none.');
});
test('the sourced count agrees too, and the claim noun follows the total',()=>{
 assert.equal(sentence({claims:1,sourced:1,unsourced:0,doubtful:0}),'1 of 1 claim has a source.');
 assert.equal(sentence({claims:3,sourced:1,unsourced:2,doubtful:0}),'1 of 3 claims has a source, 2 have none.');
 assert.equal(sentence({claims:3,sourced:0,unsourced:3,doubtful:0}),'0 of 3 claims have a source, 3 have none.');
 assert.equal(sentence({claims:1,sourced:0,unsourced:1,doubtful:0}),'0 of 1 claim has a source, 1 has none.');
});
test('doubtful claims are named after the rest, with no stray verb',()=>{
 assert.equal(sentence({claims:4,sourced:2,unsourced:1,doubtful:1}),'2 of 4 claims have a source, 1 has none, 1 doubtful.');
 assert.doesNotMatch(sentence({claims:4,sourced:2,unsourced:1,doubtful:1}),/1 have none/);
});
