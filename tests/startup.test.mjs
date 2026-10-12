import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const execute=promisify(execFile);
test('occupied candidate port exits safely and preserves the existing listener',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ar-occupied-'));const existing=http.createServer((req,res)=>res.end('existing listener'));
 await new Promise(r=>existing.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>existing.close(()=>{fs.rmSync(root,{recursive:true,force:true});r();})));
 const port=existing.address().port;
 await assert.rejects(execute(process.execPath,[path.resolve(import.meta.dirname,'../serve.mjs')],{env:{PATH:process.env.PATH,HOME:process.env.HOME,AR_CREATE_DATA_DIR:root,AR_CREATE_PORT:String(port)},timeout:10000}),error=>error.code===1&&error.stderr.includes('existing listener preserved'));
 assert.equal(await (await fetch('http://127.0.0.1:'+port)).text(),'existing listener');
});
