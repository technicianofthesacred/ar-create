import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSourceLineChecks} from '../runtime/services/source-line-checks.mjs';

test('checked lines are kept beside the transcript, replay safely and refuse vague input',()=>{
 const dataDir=mkdtempSync(join(tmpdir(),'ar-line-checks-'));
 try{
  const checks=createSourceLineChecks({dataDir}),hash='a'.repeat(64);
  assert.deepEqual(checks.list().checks,[]);
  const first=checks.mark({sessionId:'visit-a',turnId:'remark-1',textHash:hash,operationId:'op-1'});
  assert.equal(first.turnId,'remark-1');assert.equal(typeof first.by,'string');
  assert.deepEqual(checks.mark({sessionId:'visit-a',turnId:'remark-1',textHash:hash,operationId:'op-1'}),first,'the same operation replays');
  checks.mark({sessionId:'visit-a',turnId:'remark-1',textHash:'b'.repeat(64),operationId:'op-2'});
  assert.equal(checks.list().checks.length,1,'one mark per line, the latest wording wins');
  assert.throws(()=>checks.mark({sessionId:'visit-a',turnId:'remark-1',textHash:'nope',operationId:'op-3'}),/fingerprint/);
  assert.throws(()=>checks.mark({sessionId:'visit-a',turnId:'remark-1',textHash:hash,operationId:'op-4',text:'x'}),/exact transcript line/);
 }finally{rmSync(dataDir,{recursive:true,force:true});}
});
