import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {installFixtureOverlay} from '../fixture-overlay.mjs';

async function fixture(t,{symlinkRoot=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arc-fixture-'));
 const server=http.createServer((req,res)=>{res.writeHead(404);res.end('fallback');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const rootLink=dir+'-link';if(symlinkRoot)fs.symlinkSync(dir,rootLink);
 const port=server.address().port;installFixtureOverlay(server,{fixturesDir:symlinkRoot?rootLink:dir,port});
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(rootLink,{force:true});});
 const write=(name,body)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);return file;};
 const request=(url,options={})=>new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:url,...options},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();
 });
 return{dir,port,write,request};
}
test('private images keep both existing URL namespaces and GET/HEAD semantics',async t=>{
 const f=await fixture(t),bytes=Buffer.from([137,80,78,71,13,10,26,10]);
 for(const name of ['document-study/assets/photos/tea.png','porcelain-assets/tea.png']){
  f.write(name,bytes);
  const got=await f.request('/'+name);assert.equal(got.status,200);assert.deepEqual(got.body,bytes);assert.equal(got.headers['content-type'],'image/png');assert.equal(got.headers['cache-control'],'no-store');assert.equal(got.headers['x-content-type-options'],'nosniff');
  const head=await f.request('/'+name,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),bytes.length);
 }
});
test('existing JS fixture remains available and wrong hosts and methods cannot read images',async t=>{
 const f=await fixture(t);f.write('synthetic-study-data.js','const privateFixture=true;');f.write('porcelain-assets/tea.jpg','image');
 assert.equal((await f.request('/document-study/synthetic-study-data.js')).body.toString(),'const privateFixture=true;');
 for(const options of [{headers:{host:'example.com:'+f.port}},{method:'POST'}])assert.equal((await f.request('/porcelain-assets/tea.jpg',options)).status,404);
});
test('traversal, encoded separators, nonimages and symlink files/directories cannot escape the fixture root',async t=>{
 const f=await fixture(t);f.write('secret.png','secret');f.write('porcelain-assets/file.html','secret');f.write('porcelain-assets/folder.png/inside.jpg','secret');
 fs.symlinkSync(path.join(f.dir,'secret.png'),path.join(f.dir,'porcelain-assets/link.png'));
 f.write('outside/assets/photos/secret.png','secret');
 fs.symlinkSync(path.join(f.dir,'outside'),path.join(f.dir,'document-study'));
 for(const url of ['/porcelain-assets/../secret.png','/porcelain-assets/%2e%2e/secret.png','/porcelain-assets/%2e%2e%2fsecret.png','/porcelain-assets/a%5c..%5csecret.png','/porcelain-assets/file.html','/porcelain-assets/folder.png','/porcelain-assets/link.png','/document-study/assets/photos/secret.png','/porcelain-assets/missing.jpg','/porcelain-assets/%ZZ.png'])assert.equal((await f.request(url)).status,404,url);
});

test('a symlink configured fixture directory refuses private images',async t=>{
 const f=await fixture(t,{symlinkRoot:true});f.write('porcelain-assets/tea.jpg','secret');
 assert.equal((await f.request('/porcelain-assets/tea.jpg')).status,404);
});
