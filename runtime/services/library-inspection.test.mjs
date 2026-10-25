import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLibrary} from './library.mjs';
import {digest} from './files.mjs';

const inventory=dir=>{
  const rows=[];
  const visit=(file,relative='')=>{
    const stat=fs.lstatSync(file),row={path:relative,mode:stat.mode,dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs};
    if(stat.isFile())row.hash=digest(fs.readFileSync(file));
    rows.push(row);
    if(stat.isDirectory())for(const name of fs.readdirSync(file).sort())visit(path.join(file,name),path.join(relative,name));
  };
  visit(dir);return rows;
};

test('inspection projects registered Library identity and leaves every byte, inode and timestamp intact',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-library-inspect-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dataDir,'library','Notes'),{recursive:true});fs.mkdirSync(path.join(dataDir,'recordings'));
  const id=randomUUID(),collectionId=randomUUID(),folderId=randomUUID(),raw='---\ntitle: "Research note"\n---\n\nA useful finding.\n';
  const sourceFile=path.join(dataDir,'library','Notes','research.md');fs.writeFileSync(sourceFile,raw);
  const stat=fs.lstatSync(sourceFile),stamp=`${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  const index={revision:7,sources:[{id,rootId:'library',rel_path:'Notes/research.md',title:'Research note',hash:digest(raw),fileStamp:stamp,missing:false}],collections:[{id:collectionId,name:'Inquiry',sourceIds:[id]}],evidence:[],folders:[{id:folderId,domain:'library',name:'Read next',parentId:null,sourceIds:[id]}]};
  fs.writeFileSync(path.join(dataDir,'library-index.json'),JSON.stringify(index));
  const before=inventory(dataDir),reader=createLibrary({dataDir,inspectionOnly:true});
  assert.deepEqual(Object.keys(reader).sort(),['collectionRelationships','collectionsSnapshot','evidence','folders','sourceText','tree']);
  const catalog=await reader.tree();
  assert.equal(catalog.revision,7);assert.equal(catalog.sources[0].id,id);assert.equal(catalog.roots[0].tree.folders[0].files[0].sourceId,id);
  const folders=await reader.folders({domain:'library'});assert.equal(folders.folders[0].id,folderId);assert.equal(folders.sources[0].id,id);
  const collections=await reader.collectionsSnapshot();assert.deepEqual(collections.collections[0].sourceIds,[id]);
  assert.deepEqual((await reader.collectionRelationships(collectionId)).relationships,[]);
  assert.deepEqual((await reader.evidence()).cards,[]);
  const source=await reader.sourceText({id,expectedIndexHash:catalog.indexHash,expectedHash:digest(raw),expectedStamp:stamp});
  assert.equal(source.text,'\nA useful finding.\n');assert.equal(source.hash,digest(raw));
  assert.equal((await reader.sourceText({id})).raw,raw);
  assert.deepEqual(inventory(dataDir),before);
  fs.writeFileSync(sourceFile,raw+'Later edit.');
  await assert.rejects(reader.sourceText({id}),/differ from the saved catalog/);
  await assert.rejects(reader.sourceText({id,expectedStamp:stamp}),/changed/);
  const pending=reader.collectionsSnapshot();
  fs.writeFileSync(path.join(dataDir,'library-index.json'),JSON.stringify({...index,revision:8}));
  await assert.rejects(pending,/index changed/);
  const secondId=randomUUID(),secondRaw='Another registered note.';
  fs.writeFileSync(path.join(dataDir,'library','Notes','second.md'),secondRaw);
  fs.writeFileSync(path.join(dataDir,'library-index.json'),JSON.stringify({...index,revision:9,sources:[...index.sources,{id:secondId,rootId:'library',rel_path:'Notes/second.md',hash:digest(secondRaw),missing:false}]}));
  const afterOwner=inventory(dataDir),updated=await reader.tree();
  assert.equal(updated.revision,9);assert.deepEqual(updated.sources.map(source=>source.id),[id,secondId]);
  assert.equal((await reader.sourceText({id:secondId})).raw,secondRaw);
  assert.deepEqual(inventory(dataDir),afterOwner);
});

test('source text read stays bounded when a file grows after its opening stat',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-library-growth-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dataDir,'library'));fs.mkdirSync(path.join(dataDir,'recordings'));
  const id=randomUUID(),raw='Original text',file=path.join(dataDir,'library','note.txt');
  fs.writeFileSync(file,raw);
  fs.writeFileSync(path.join(dataDir,'library-index.json'),JSON.stringify({revision:1,sources:[{id,rootId:'library',rel_path:'note.txt',hash:digest(raw),missing:false}],collections:[],evidence:[]}));
  const reader=createLibrary({dataDir,inspectionOnly:true}),originalRead=fs.readSync;
  let maximumRequested=0,grew=false;
  fs.readSync=function(...args){maximumRequested=Math.max(maximumRequested,args[3]);const count=originalRead.apply(this,args);if(!grew){grew=true;fs.appendFileSync(file,'x'.repeat(3*1024*1024));}return count;};
  try{await assert.rejects(reader.sourceText({id}),/Source changed during inspection/);}
  finally{fs.readSync=originalRead;}
  assert.equal(grew,true);assert.equal(maximumRequested,Buffer.byteLength(raw));
});

test('inspection reports absent index or roots without creating either',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-library-absent-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  const before=inventory(dataDir),reader=createLibrary({dataDir,inspectionOnly:true});
  await assert.rejects(reader.tree(),/index is unavailable/);
  assert.deepEqual(inventory(dataDir),before);
  fs.writeFileSync(path.join(dataDir,'library-index.json'),JSON.stringify({revision:0,sources:[],collections:[],evidence:[]}));
  const second=createLibrary({dataDir,inspectionOnly:true}),saved=inventory(dataDir),catalog=await second.tree();
  assert.equal(catalog.roots[0].available,false);assert.equal(catalog.roots[1].available,false);
  assert.deepEqual(inventory(dataDir),saved);
});

test('inspection refuses duplicate identities, traversal, symlinks, and replaced roots',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-library-unsafe-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dataDir,'library'));fs.mkdirSync(path.join(dataDir,'recordings'));
  const id=randomUUID(),sourceFile=path.join(dataDir,'library','note.md');fs.writeFileSync(sourceFile,'Safe note');
  const indexFile=path.join(dataDir,'library-index.json');
  const source={id,rootId:'library',rel_path:'note.md',hash:digest('Safe note'),missing:false};
  const save=sources=>fs.writeFileSync(indexFile,JSON.stringify({revision:1,sources,collections:[],evidence:[]}));
  save([source,source]);let reader=createLibrary({dataDir,inspectionOnly:true});await assert.rejects(reader.tree(),/Ambiguous Library identities/);
  save([{...source,rel_path:'../outside.md'}]);reader=createLibrary({dataDir,inspectionOnly:true});await assert.rejects(reader.tree(),/traversal paths/);
  save([source]);fs.rmSync(sourceFile);fs.symlinkSync(indexFile,sourceFile);reader=createLibrary({dataDir,inspectionOnly:true});
  assert.equal((await reader.tree()).sources[0].sourceUnavailable,true);
  await assert.rejects(reader.sourceText({id}),/Symlink paths|regular file/);
  fs.rmSync(sourceFile);fs.writeFileSync(sourceFile,'Safe note');reader=createLibrary({dataDir,inspectionOnly:true});
  fs.renameSync(path.join(dataDir,'library'),path.join(dataDir,'old-library'));fs.mkdirSync(path.join(dataDir,'library'));
  await assert.rejects(reader.tree(),/root changed/);
});
