import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import * as renderer from './carousel-render-process.mjs';
const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;};
function image(width=1080,height=1350){const chunk=(type,data)=>{const kind=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);kind.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([kind,data])),out.length-4);return out;};const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.alloc((width*4+1)*height))),chunk('IEND',Buffer.alloc(0))]);}
const png=image().toString('base64');

test('completed PNG and ready DOM release a renderer that hangs during shutdown',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'slide.png');
 const script='const fs=require("fs");fs.writeFileSync(process.argv[1],Buffer.from(process.argv[2],"base64"));process.stdout.write("<html data-export-status=\\"ready\\"><body>Invented slide</body></html>");process.on("SIGTERM",()=>{});setInterval(()=>{},1000);';
 const start=Date.now(),result=await renderer.renderCarouselProcess(process.execPath,['-e',script,file,png],file,{timeout:1500,grace:50});
 assert.match(result.stdout,/data-export-status="ready"/);assert.deepEqual(fs.readFileSync(file),Buffer.from(png,'base64'));assert.ok(Date.now()-start<1000);
});

test('ready DOM with an incomplete PNG fails closed within the existing deadline',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'slide.png');
 const script='require("fs").writeFileSync(process.argv[1],Buffer.from(process.argv[2],"base64").subarray(0,30));process.stdout.write("<html data-export-status=\\"ready\\"></html>");process.on("SIGTERM",()=>{});setInterval(()=>{},1000);';
 await assert.rejects(renderer.renderCarouselProcess(process.execPath,['-e',script,file,png],file,{timeout:150,grace:25}),/deadline/);
});

test('wrong size, corrupt compressed bytes and truncated endings are refused',()=>{
 assert.throws(()=>renderer.validateCarouselPng(image(10,10)),/dimensions/);
 const bad=image();bad[bad.length-20]^=1;assert.throws(()=>renderer.validateCarouselPng(bad),/checksum/);
 assert.throws(()=>renderer.validateCarouselPng(image().subarray(0,-4)),/Incomplete/);
});

test('child failure cannot turn otherwise valid output into a successful render',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'slide.png');
 await assert.rejects(renderer.renderCarouselProcess(process.execPath,['-e','process.exit(7)'],file,{timeout:150,grace:25}),/renderer (?:failed|stopped)/i);
});

test('cancellation stops the exact child group and never accepts a partial file',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'slide.png'),controller=new AbortController();
 const pending=renderer.renderCarouselProcess(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],file,{timeout:1000,grace:25,signal:controller.signal});setTimeout(()=>controller.abort(),50);
 await assert.rejects(pending,/cancelled/);
});

test('a retained or foreign preexisting file is never renderer completion proof',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'slide.png');fs.writeFileSync(file,image());
 await assert.rejects(renderer.renderCarouselProcess(process.execPath,['-e','process.exit(0)'],file),/fresh child-owned/);
});

test('complete bytes still require ready DOM and successful child behavior',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const script='require("fs").writeFileSync(process.argv[1],Buffer.from(process.argv[2],"base64"));process.stdout.write(process.argv[3]);process.exit(Number(process.argv[4]));';
 await assert.rejects(renderer.renderCarouselProcess(process.execPath,['-e',script,path.join(dir,'not-ready.png'),png,'<html>still loading</html>','0'],path.join(dir,'not-ready.png'),{timeout:200,grace:50}),/stopped/);
 await assert.rejects(renderer.renderCarouselProcess(process.execPath,['-e',script,path.join(dir,'failed.png'),png,'<html data-export-status="ready"></html>','7'],path.join(dir,'failed.png'),{timeout:200,grace:50}),/failed|stopped/);
});

test('ready DOM before a silent later file write still completes, and abort during shutdown holds it',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const script='const fs=require("fs");process.stdout.write("<html data-export-status=\\"ready\\"></html>");setTimeout(()=>fs.writeFileSync(process.argv[1],Buffer.from(process.argv[2],"base64")),60);process.on("SIGTERM",()=>{});setInterval(()=>{},1000);';
 await renderer.renderCarouselProcess(process.execPath,['-e',script,path.join(dir,'late.png'),png],path.join(dir,'late.png'),{timeout:400,grace:25});
 const controller=new AbortController(),file=path.join(dir,'cancel.png'),pending=renderer.renderCarouselProcess(process.execPath,['-e',script,file,png],file,{timeout:500,grace:200,signal:controller.signal});
 setTimeout(()=>controller.abort(),180);await assert.rejects(pending,/cancelled/);
});

test('terminal overflow DOM retains its layout diagnosis without waiting for the deadline',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'carousel-process-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'slide.png'),start=Date.now();
 await assert.rejects(renderer.renderCarouselProcess(process.execPath,['-e','process.stdout.write("<html data-export-status=\\"overflow\\"></html>");setInterval(()=>{},1000)'],file,{timeout:1500,grace:25}),/overflows/);assert.ok(Date.now()-start<1000);
});
