import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildStatus,parseTests,parseRelease,testsLine,WORD_LIMIT} from '../scripts/gen-status.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const SHA='7dd235de846bfe0b088b500434b91712642e6bcb';

test('line 1 is the measured test result, or says it was not measured',()=>{
 assert.equal(buildStatus({works:'## Works today\n- x'}).split('\n')[0],'Tests: not measured.');
 const tests=parseTests(JSON.stringify({tests:3013,pass:2971,fail:42,skipped:0,sha:SHA,at:'2026-11-01T03:00:00Z'}));
 assert.equal(testsLine(tests),'Tests: 2,971 passed, 42 failed, 0 skipped, of 3,013 (commit 7dd235d, 2026-11-01T03:00:00Z).');
 assert.equal(buildStatus({tests,works:'x'}).split('\n')[0],testsLine(tests));
});

test('a result that is not a real measurement is never printed as one',()=>{
 for(const bad of [null,'','not json {','{"tests":"many","pass":1,"fail":0}','{"tests":10,"pass":-1,"fail":0}','{"pass":1,"fail":0}','[]'])assert.equal(parseTests(bad),null,String(bad));
});

test('TAP footers from node --test are read',()=>{
 const tap='TAP version 13\nok 1 - a\n1..1\n# tests 12\n# suites 0\n# pass 10\n# fail 1\n# cancelled 0\n# skipped 1\n# todo 0\n';
 assert.deepEqual(parseTests(tap),{tests:12,pass:10,fail:1,skipped:1,sha:null,at:null});
});

test('the installed release comes from RELEASE.json and a different test commit is called out',()=>{
 const release=parseRelease(JSON.stringify({schema:'ar-create.release.v1',sha:SHA,builtAt:'2026-11-01T02:47:36.799Z',builtBy:'agent:claude-code',shipped:706}));
 assert.match(buildStatus({release,works:'x'}),/Installed release: commit 7dd235d, built 2026-11-01T02:47:36.799Z, by agent:claude-code, 706 files\./);
 const other=parseTests(JSON.stringify({tests:1,pass:1,fail:0,skipped:0,sha:'abcdef1234567'}));
 assert.match(buildStatus({release,tests:other,works:'x'}),/ran on a different commit \(abcdef1\)/);
 assert.equal(parseRelease('{"sha":"nope"}'),null);
 assert.match(buildStatus({release:null,works:'x'}),/Installed release: not read\./);
});

test('the page refuses to grow past the word limit',()=>{
 assert.throws(()=>buildStatus({works:'word '.repeat(WORD_LIMIT)}),/limit/);
});

test('the committed WORKS list is at most 40 lines and CURRENT.md carries its text from the heading down',()=>{
 assert.ok(fs.readFileSync(path.join(repo,'docs/status/WORKS.md'),'utf8').trimEnd().split('\n').length<=40);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-gen-status-'));
 try{
  execFileSync(process.execPath,[path.join(repo,'scripts/gen-status.mjs'),'--out',path.join(dir,'CURRENT.md')],{cwd:repo});
  const fromHeading=file=>{const t=fs.readFileSync(file,'utf8');return t.slice(t.indexOf('# AR Create: status'));};
  assert.equal(fromHeading(path.join(repo,'docs/status/CURRENT.md')),fromHeading(path.join(dir,'CURRENT.md')),'CURRENT.md is stale: run node scripts/gen-status.mjs');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('docs/status/CURRENT.md is short and the old log keeps its content',()=>{
 const current=fs.readFileSync(path.join(repo,'docs/status/CURRENT.md'),'utf8');
 assert.ok(current.split(/\s+/).filter(Boolean).length<=WORD_LIMIT);
 assert.ok(/^Tests: /.test(current.split('\n')[0]));
 assert.ok(fs.readFileSync(path.join(repo,'docs/history/status-log-2026-10.md'),'utf8').split(/\s+/).length>25000);
});

test('--out writes where it is told and --tests/--release are read from files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-gen-status-'));
 try{
  fs.writeFileSync(path.join(dir,'t.json'),JSON.stringify({tests:5,pass:5,fail:0,skipped:0}));
  fs.writeFileSync(path.join(dir,'r.json'),JSON.stringify({sha:SHA,builtAt:'2026-11-01T00:00:00Z'}));
  execFileSync(process.execPath,[path.join(repo,'scripts/gen-status.mjs'),'--tests',path.join(dir,'t.json'),'--release',path.join(dir,'r.json'),'--out',path.join(dir,'CURRENT.md')],{cwd:repo});
  const page=fs.readFileSync(path.join(dir,'CURRENT.md'),'utf8');
  assert.equal(page.split('\n')[0],'Tests: 5 passed, 0 failed, 0 skipped, of 5.');
  assert.match(page,/commit 7dd235d/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
