import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTranslationBatch,translationReadiness,validateTranslationBatch} from '../public/document-study/translation-readiness.js';
const session=()=>({id:'invented-session',sourceId:'invented-source',sourceHash:'a'.repeat(64),version:2,undoOperationId:'saved-undo',turns:[
{id:'gap',sourceLanguage:'zh',originalText:'虚构的花园。',text:'虚构的花园。',timestamp:'10:01'},
{id:'translated',language:'zh',originalText:'虚构的河流。',text:'My edited river wording.',corrections:[{id:'human-edit'}]},
{id:'english',language:'zh',originalText:'An English aside.',text:'An English aside.'},
{id:'number',language:'zh',originalText:'123',text:'123'},
{id:'boundary',kind:'session-boundary',language:'zh',originalText:'虚构边界',text:'虚构边界'},
{id:'corrected-chinese',language:'zh',originalText:'虚构旧话。',text:'虚构修正。'},
{id:'english-side',language:'en',originalText:'English reply.',text:'English reply.'}]});
test('whole conversation context selects only untouched Chinese text with Chinese source evidence',()=>{const s=session(),before=structuredClone(s),b=prepareTranslationBatch(s,3);assert.deepEqual(b.gapIds,['gap']);assert.deepEqual(b.segments.map(t=>t.id),s.turns.map(t=>t.id));assert.equal(b.language,'en');assert.equal(b.expectedSourceHash,s.sourceHash);assert.deepEqual(s,before);assert.equal(translationReadiness(s).state,'unavailable');});
test('ready, busy, error, unavailable and stale source states stay honest',()=>{const s=session();assert.equal(translationReadiness(s,{loading:true}).state,'busy');assert.equal(translationReadiness(s,{error:'Disconnected'}).state,'error');assert.equal(translationReadiness(s,{stale:true}).state,'stale');s.turns.shift();assert.equal(translationReadiness(s).state,'ready');assert.equal(translationReadiness(null).state,'unavailable');});
test('batch validation rejects stale identity, changed preserved words, missing/duplicate/foreign IDs and copied Chinese',()=>{const s=session(),b=prepareTranslationBatch(s,3),result={sessionId:s.id,sourceId:s.sourceId,expectedSourceHash:s.sourceHash,expectedRevision:3,segments:[{id:'gap',text:'An invented garden.'}]};assert.deepEqual(validateTranslationBatch(s,3,b,result),result.segments);for(const alter of [r=>r.expectedSourceHash='other',r=>r.expectedRevision=4,r=>r.sessionId='foreign',r=>r.segments=[],r=>r.segments.push(r.segments[0]),r=>r.segments[0].id='translated',r=>r.segments[0].text='虚构的花园。']){const r=structuredClone(result);alter(r);assert.throws(()=>validateTranslationBatch(s,3,b,r));}s.turns[1].text='New human edit';assert.throws(()=>validateTranslationBatch(s,3,b,result));assert.equal(s.turns[1].text,'New human edit');assert.equal(s.undoOperationId,'saved-undo');});
