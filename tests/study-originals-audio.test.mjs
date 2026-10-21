import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
const id='11111111-1111-4111-8111-111111111111';
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'arc-audio-')),vault=path.join(root,'vault'),files=path.join(root,'files');fs.mkdirSync(vault);fs.mkdirSync(files);
 const write=(base,rel,value)=>{const file=path.join(base,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);return file;};
 const entry={id,title:'Synthetic recording',provenance:'Catalog provenance',listProvenance:'Completed receipt provenance',playbackProvenance:'Exact recording provenance',source:'Project/Conversation.wav',raw:'Inbox/Original.md'};
 const audio=write(files,entry.source,Buffer.from('RIFFsyntheticWAVE'));write(vault,entry.raw,'Synthetic original');
 const receipt={id,state:'done',transcriptReady:true,source:audio,originalSource:audio,raw:path.join(vault,entry.raw)};
 const receiptFile=write(files,`.transcription-jobs/${id}.json`,JSON.stringify(receipt));
 const catalog={projects:{synthetic:{docs:[[entry.raw,'raw']],audio:[entry]}},drafts:{}};
 const service=()=>createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return{root,vault,files,entry,audio,receipt,receiptFile,catalog,service};
}
test('completed receipt preserves the listed identity, provenance and exact audio metadata',t=>{
 const f=setup(t),s=f.service();assert.deepEqual(s.list('synthetic').audio,[{id,title:f.entry.title,url:`/api/study-originals/audio?id=${id}`,provenance:f.entry.listProvenance}]);
 const got=s.audio(id);assert.deepEqual(got,{file:fs.realpathSync(f.audio),type:'audio/wav',title:f.entry.title,hash:null,size:fs.statSync(f.audio).size,provenance:f.entry.playbackProvenance});assert.equal(s.list('synthetic').records[0].raw,'Synthetic original');
});
test('unknown ids and caller paths are never filesystem selectors',t=>{const f=setup(t);for(const value of ['../../secret',f.audio,'bad',id+'../'])assert.throws(()=>f.service().audio(value),e=>e.status===404);});
test('missing, unfinished or mismatched receipt refuses playback and lists a diagnostic',t=>{
 const f=setup(t);
 for(const change of [{state:'running'},{transcriptReady:false},{id:'22222222-2222-4222-8222-222222222222'},{source:path.join(f.files,'wrong.wav')},{originalSource:path.join(f.files,'wrong.wav')},{raw:path.join(f.vault,'wrong.md')}]){
  fs.writeFileSync(f.receiptFile,JSON.stringify({...f.receipt,...change}));assert.throws(()=>f.service().audio(id),e=>e.status===409);assert.equal(f.service().list('synthetic').audio.length,0);assert.equal(f.service().list('synthetic').diagnostics.length,1);
 }
 fs.unlinkSync(f.receiptFile);assert.throws(()=>f.service().audio(id),e=>e.status===404);
});
test('configured traversal, nonaudio, symlink receipt and symlink recording refuse',t=>{
 const f=setup(t);
 for(const source of ['../secret.wav','/absolute.wav','Project/../Conversation.wav','Project/hidden.html']){f.entry.source=source;assert.throws(()=>f.service().audio(id));}f.entry.source='Project/Conversation.wav';
 fs.renameSync(f.receiptFile,f.receiptFile+'.original');fs.symlinkSync(f.receiptFile+'.original',f.receiptFile);assert.throws(()=>f.service().audio(id),e=>e.status===403);fs.unlinkSync(f.receiptFile);fs.renameSync(f.receiptFile+'.original',f.receiptFile);
 fs.renameSync(f.audio,f.audio+'.original');fs.symlinkSync(f.audio+'.original',f.audio);assert.throws(()=>f.service().audio(id),e=>e.status===403);
});

test('existing HTTP playback preserves exact bytes, type, length, HEAD and ranges',async t=>{
 const f=setup(t),{createServer}=await import('../runtime/server.mjs');
 const server=await createServer({dataDir:path.join(f.root,'data'),researchEnabled:false,transcriptionRuntime:null,studyOriginalRoots:{vaultRoot:f.vault,filesRoot:f.files,catalog:f.catalog}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}/api/study-originals/audio?id=${id}`,bytes=fs.readFileSync(f.audio);
 const got=await fetch(url);assert.equal(got.status,200);assert.equal(got.headers.get('content-type'),'audio/wav');assert.equal(Number(got.headers.get('content-length')),bytes.length);assert.deepEqual(Buffer.from(await got.arrayBuffer()),bytes);
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),bytes.length);assert.equal((await head.arrayBuffer()).byteLength,0);
 const range=await fetch(url,{headers:{range:'bytes=2-5'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 2-5/${bytes.length}`);assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(2,6));
 assert.equal((await fetch(url,{headers:{range:'bytes=999-'}})).status,416);
});
test('unsupported configured file type and oversized or malformed receipts refuse',t=>{
 const f=setup(t);f.entry.source='Project/secret.html';const file=path.join(f.files,f.entry.source);fs.writeFileSync(file,'not audio');fs.writeFileSync(f.receiptFile,JSON.stringify({...f.receipt,source:file,originalSource:file}));assert.throws(()=>f.service().audio(id),e=>e.status===415);
 for(const invalid of ['{','null','[]']){fs.writeFileSync(f.receiptFile,invalid);assert.throws(()=>f.service().audio(id),e=>e.status===409);}
 fs.writeFileSync(f.receiptFile,'x'.repeat(65537));assert.throws(()=>f.service().audio(id),e=>e.status===413);
});

test('missing recording and symlinked parent directory refuse without losing source metadata',t=>{
 const f=setup(t);fs.unlinkSync(f.audio);assert.throws(()=>f.service().audio(id),e=>e.status===404);
 fs.rmdirSync(path.dirname(f.audio));const other=path.join(f.root,'other');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'Conversation.wav'),'other');fs.symlinkSync(other,path.dirname(f.audio));assert.throws(()=>f.service().audio(id),e=>e.status===403);
 assert.equal(f.service().list('synthetic').records[0].raw,'Synthetic original');
});
