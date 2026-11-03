import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createSimmerBoards} from '../runtime/services/simmer-board.mjs';
import {withActor} from '../runtime/services/actor.mjs';

const TEXT='Invented speaker: every mark on this bowl is a day it was used.',HASH='a'.repeat(64),SOURCE='11111111-2222-4333-8444-555555555555';
const library={snapshot:async id=>{if(id!==SOURCE)throw Error('missing');return {id,hash:HASH,text:TEXT};}};
const as=(actor,fn)=>withActor({actor,client:'http'},fn);
const op=()=>crypto.randomUUID();
function fresh(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'simmer-board-'));return {dir,boards:createSimmerBoards({dataDir:dir,library})};}
const group=(id,blocks,extra={})=>({id,title:'Marks',x:40,y:40,w:662,origin:'human',blocks,...extra});
const note={id:'b-note',kind:'note',origin:'human',by:'human:adrian',text:'I like my marks.'};
const passage={id:'b-pass',kind:'passage',origin:'machine',by:'agent:claude-code',text:'every mark on this bowl',source:{sourceId:SOURCE,sourceHash:HASH,quote:'every mark on this bowl',start:TEXT.indexOf('every mark'),title:'Invented'}};
async function save(boards,actor,current,board){return as(actor,()=>boards.save({subject:'proj-1',operationId:op(),expectedRevision:current.revision,expectedHash:current.hash,board}));}

test('Adrian saves a board; the next save must name the revision it read', async () => {
 const {boards}=fresh();const start=await boards.read({subject:'proj-1'});
 assert.equal(start.revision,0);assert.deepEqual(start.groups,[]);
 const saved=await save(boards,'human:adrian',start,{groups:[group('g1',[note])]});
 assert.equal(saved.revision,1);assert.equal(saved.groups[0].blocks[0].text,'I like my marks.');
 await assert.rejects(save(boards,'human:adrian',start,{groups:[]}),e=>e.status===409);
 assert.equal((await boards.read({subject:'proj-1'})).groups.length,1);
});

test('an agent may propose blocks and groups but never write his words', async () => {
 const {boards}=fresh();let cur=await save(boards,'human:adrian',await boards.read({subject:'proj-1'}),{groups:[group('g1',[note,{id:'b-q',kind:'question',origin:'machine',by:'agent:claude-code',text:'Where do you go slowly?'}])]});
 const guidance={id:'b-g',kind:'guidance',origin:'machine',by:'agent:claude-code',text:'This group is the centre.'};
 cur=await save(boards,'agent:claude-code',cur,{groups:[group('g1',[...cur.groups[0].blocks,guidance]),{id:'g2',title:'Proposed',x:740,y:40,w:502,origin:'machine',blocks:[]}]});
 assert.equal(cur.revision,2);
 const refused=board=>assert.rejects(save(boards,'agent:codex',cur,board),e=>e.status===403);
 await refused({groups:[group('g1',[...cur.groups[0].blocks,{id:'b-n2',kind:'note',origin:'machine',text:'A note in his name'}]),cur.groups[1]]});
 await refused({groups:[group('g1',cur.groups[0].blocks.map(b=>b.id==='b-note'?{...b,text:'Changed'}:b)),cur.groups[1]]});
 await refused({groups:[group('g1',cur.groups[0].blocks.map(b=>b.id==='b-q'?{...b,answer:'Typed by an agent'}:b)),cur.groups[1]]});
 await refused({groups:[group('g1',cur.groups[0].blocks.filter(b=>b.id!=='b-note')),cur.groups[1]]});
 await refused({groups:cur.groups,forming:{...cur.forming,sentence:{...cur.forming.sentence,about:'a cup'}}});
 const answered=await save(boards,'human:adrian',cur,{groups:[group('g1',cur.groups[0].blocks.map(b=>b.id==='b-q'?{...b,answer:'At the kettle.',held:true}:b)),cur.groups[1]]});
 assert.equal(answered.groups[0].blocks.find(b=>b.id==='b-q').answer,'At the kettle.');
});

test('his exact words are checked against the Library and never change', async () => {
 const {boards}=fresh();const start=await boards.read({subject:'proj-1'});
 await assert.rejects(save(boards,'human:adrian',start,{groups:[group('g1',[{...passage,source:{...passage.source,start:0}}])]}),e=>e.status===409);
 await assert.rejects(save(boards,'human:adrian',start,{groups:[group('g1',[{...passage,text:'every mark'}])]}),e=>e.status===403);
 const cur=await save(boards,'human:adrian',start,{groups:[group('g1',[passage])]});
 const quote='every mark on this bowl is a day';
 await assert.rejects(save(boards,'human:adrian',cur,{groups:[group('g1',[{...passage,text:quote,source:{...passage.source,quote}}])]}),e=>e.status===403);
});
