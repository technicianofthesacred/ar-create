import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {releaseSha} from '../runtime/services/release-sha.mjs';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {run} from '../agents/cli/ar-create.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const SHA='7dd235de846bfe0b088b500434b91712642e6bcb';

test('an installed program with no .git reports the sha of its RELEASE.json',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'ar-release-sha-'));
 try{
  fs.mkdirSync(path.join(home,'service'));
  assert.equal(releaseSha(path.join(home,'service')),null,'no record yet');
  fs.writeFileSync(path.join(home,'RELEASE.json'),JSON.stringify({schema:'ar-create.release.v1',sha:SHA}));
  assert.equal(releaseSha(path.join(home,'service')),SHA);
  assert.equal(releaseSha(path.join(home,'service'),{sha:'abcdef1'}),'abcdef1','the record serve.mjs passed in wins');
  assert.equal(releaseSha(path.join(home,'service'),{sha:'not a sha'}),SHA,'a malformed passed-in record is ignored');
  fs.writeFileSync(path.join(home,'RELEASE.json'),'{broken');
  assert.equal(releaseSha(path.join(home,'service')),null,'a broken file is null, never a throw');
  fs.writeFileSync(path.join(home,'RELEASE.json'),JSON.stringify({sha:'ZZZ'}));
  assert.equal(releaseSha(path.join(home,'service')),null,'a non-hex sha is not trusted');
  assert.equal(releaseSha(path.join(home,'other')),null,'only an installed service/ directory looks at its parent');
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('capabilities and the CLI status show the release sha first',async t=>{
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,release:{sha:SHA}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const status=await run(['--url',url,'--actor','agent:codex','status']);
 assert.equal(status.exitCode,0,JSON.stringify(status.result));
 assert.equal(Object.keys(status.result)[0],'release','release is the first line of status');
 assert.match(status.result.release,/^[a-f0-9]{7,40}$/,'never null while the program knows its commit');
 assert.equal(status.result.release,status.result.git.sha);
});
