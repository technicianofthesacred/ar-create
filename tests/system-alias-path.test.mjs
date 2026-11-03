import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {systemAliasPath} from '../runtime/services/files.mjs';

// Root identity compares a stored root path to its realpath. On macOS /tmp and /var
// are host symlinks into /private; on Linux they are real directories. A hard-coded
// /private rewrite made every Linux temp root look like "a folder that became a
// symlink", which refused 117 library tests on Linux CI.
const host=real=>t=>{const original=fs.realpathSync;t.mock.method(fs,'realpathSync',p=>p in real?real[p]:original(p));};

test('macOS host aliases expand into /private exactly as realpath does',t=>{
 host({'/tmp':'/private/tmp','/var':'/private/var'})(t);
 assert.equal(systemAliasPath('/tmp/root'),'/private/tmp/root');
 assert.equal(systemAliasPath('/var/folders/x'),'/private/var/folders/x');
 assert.equal(systemAliasPath('/tmp'),'/private/tmp');
});

test('Linux real /tmp and /var stay unchanged so their realpath still matches',t=>{
 host({'/tmp':'/tmp','/var':'/var'})(t);
 assert.equal(systemAliasPath('/tmp/root'),'/tmp/root');
 assert.equal(systemAliasPath('/var/lib/x'),'/var/lib/x');
});

test('only the two host aliases expand; look-alikes and other symlink targets do not',t=>{
 host({'/tmp':'/somewhere/else','/var':'/private/var'})(t);
 assert.equal(systemAliasPath('/tmp/root'),'/tmp/root');
 assert.equal(systemAliasPath('/tmpfoo/root'),'/tmpfoo/root');
 assert.equal(systemAliasPath('/private/tmp/root'),'/private/tmp/root');
 assert.equal(systemAliasPath('/home/user/tmp/root'),'/home/user/tmp/root');
});

test('a root that really became a symlink still differs from its realpath on this host',t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'system-alias-'))),real=path.join(dir,'real'),link=path.join(dir,'link');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(real);fs.symlinkSync(real,link);
 assert.equal(fs.realpathSync(real),systemAliasPath(real));
 assert.notEqual(fs.realpathSync(link),systemAliasPath(link));
});
