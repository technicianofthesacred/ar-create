import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {createMagazinePortfolio} from '../runtime/services/magazine-portfolio.mjs';
import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';

function fixture(t){const f=buildMagazineFixture();t.after(f.cleanup);return {...f,reader:createMagazinePortfolio({roots:[{id:'invented',path:f.vault}]})};}
function mock(t,name,implementation){const original=fsp[name];t.mock.method(fsp,name,implementation(original));syncBuiltinESMExports();t.after(()=>{t.mock.restoreAll();syncBuiltinESMExports();});}
function gate(){let release,entered;return {blocked:new Promise(resolve=>{release=resolve;}),started:new Promise(resolve=>{entered=resolve;}),release:()=>release(),enter:()=>entered()};}
const settled=promise=>promise.then(value=>({value}),error=>({error}));

test('an already-aborted portfolio list refuses before reading a configured original',async t=>{
 const {reader}=fixture(t),controller=new AbortController(),reason=Error('Abandoned discovery');let reads=0;
 mock(t,'readdir',original=>(...args)=>{reads++;return original(...args);});controller.abort(reason);
 await assert.rejects(reader.list({signal:controller.signal}),error=>error===reason);assert.equal(reads,0);
});

test('abort after a pending root read stops before scanning its children',async t=>{
 const {reader,vault}=fixture(t),controller=new AbortController(),reason=Error('Abandoned root'),held=gate();let reads=0,hold=true;
 mock(t,'lstat',original=>async(...args)=>{if(args[0]===vault&&hold){hold=false;held.enter();await held.blocked;}return original(...args);});
 mock(t,'readdir',original=>(...args)=>{reads++;return original(...args);});
 const pending=settled(reader.list({signal:controller.signal}));try{await held.started;controller.abort(reason);held.release();const result=await pending;assert.equal(result.error,reason);assert.equal(reads,0);}finally{held.release();}
});

test('an abandoned late file close cannot publish over the later fresh portfolio',async t=>{
 const {reader,vault}=fixture(t),from='Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md',to='Workflow/1-Source/SRC - Clay Teacher (Fresh Day).md';
 await reader.list();const controller=new AbortController(),reason=Error('Abandoned earlier scan'),held=gate();let hold=true,reads=0;
 mock(t,'open',original=>async(...args)=>{const handle=await original(...args);if(args[0]===path.join(vault,from)&&hold){hold=false;const close=handle.close.bind(handle);handle.close=async()=>{held.enter();await held.blocked;return close();};}return handle;});
 mock(t,'readdir',original=>(...args)=>{reads++;return original(...args);});
 const abandoned=settled(reader.list({signal:controller.signal}));try{
  await held.started;controller.abort(reason);fs.renameSync(path.join(vault,from),path.join(vault,to));
  const fresh=await reader.list(),artifact=fresh.stories.flatMap(story=>story.artifacts).find(row=>row.relativePath===to);assert.ok(artifact);
  held.release();const old=await abandoned;const beforeRead=reads;
  const value=await reader.read({artifactId:artifact.artifactId,expectedHash:artifact.hash});assert.equal(value.provenance.relativePath,to);
  assert.equal(reads,beforeRead,'The late abandoned scan must not replace the fresh artifact map and force discovery again');assert.equal(old.error,reason);
 }finally{held.release();}
});

test('a handle arriving after cancellation is closed without reading its contents',async t=>{
 const {reader,vault}=fixture(t),target=path.join(vault,'Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md'),controller=new AbortController(),reason=Error('Abandoned open'),held=gate();let hold=true,closed=0,readCalls=0;
 mock(t,'open',original=>async(...args)=>{const handle=await original(...args);if(args[0]===target&&hold){hold=false;const close=handle.close.bind(handle),read=handle.read.bind(handle);handle.close=async()=>{closed++;return close();};handle.read=(...input)=>{readCalls++;return read(...input);};held.enter();await held.blocked;}return handle;});
 const pending=settled(reader.list({signal:controller.signal}));try{await held.started;controller.abort(reason);held.release();const result=await pending;assert.equal(result.error,reason);assert.equal(closed,1);assert.equal(readCalls,0);}finally{held.release();}
});
