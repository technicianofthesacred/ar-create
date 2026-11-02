import fs from 'node:fs';
import path from 'node:path';
import {digest} from './files.mjs';
import {StateError} from '../store.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const fail=()=>{throw new StateError('Owned relocation proof changed or is not authorized.',409);};
function canonical(p,directory=true){
 if(typeof p!=='string'||!path.isAbsolute(p)||path.resolve(p)!==p)fail();
 let at=path.parse(p).root;
 for(const part of p.slice(at.length).split(path.sep).filter(Boolean)){at=path.join(at,part);if(fs.lstatSync(at).isSymbolicLink())fail();}
 const s=fs.lstatSync(p);if(fs.realpathSync(p)!==p||(directory?!s.isDirectory():!s.isFile()||s.nlink!==1))fail();return s;
}
const stamp=(p)=>{const s=canonical(p);return {path:p,dev:s.dev,ino:s.ino};};
// A saved folder is the same folder when its path and inode match. The disk number (dev) is left out on purpose:
// macOS can renumber the same disk after a restart, which made every saved proof look moved and stopped startup.
const sameFolder=(a,b)=>a.path===b.path&&a.ino===b.ino;
const validStamp=r=>r&&typeof r.path==='string'&&Number.isSafeInteger(r.dev)&&Number.isSafeInteger(r.ino);
const suffixes={'roots.media':'media','roots.workflow':'workflow',media:'media/Project',derived:'workflow/Derived'};
/** Trusted startup-only capability. It preserves historical native metadata bytes and CAS.
 * Every mapped access rechecks the destination inode; no prefix rewrite or caller path is accepted. */
export function createStudyOwnedRelocation({dataDir,manifest}={}){
 if(!manifest)return null;
 const m=structuredClone(manifest);
 if(m.schema!=='ar-create.study-owned-relocation.v1'||m.dataRoot!==dataDir||typeof m.legacyDataRoot!=='string'||!path.isAbsolute(m.legacyDataRoot)||path.resolve(m.legacyDataRoot)!==m.legacyDataRoot||m.legacyDataRoot===dataDir||!Array.isArray(m.bindings))fail();
 const dataStamp=stamp(dataDir),entries=new Map();
 const room=(root,id)=>path.join(root,'study-draft-copies/copies',id);
 for(const e of m.bindings){
  if(!UUID.test(e.bindingId||'')||!SHA.test(e.bindingHash||'')||entries.has(e.bindingId)||!e.roots||Object.keys(e.roots).length!==4||!Array.isArray(e.captures))fail();
  for(const [k,suffix] of Object.entries(suffixes)){
   const r=e.roots[k];if(!validStamp(r?.before)||!validStamp(r?.after)||r.before.path!==path.join(room(m.legacyDataRoot,e.bindingId),suffix)||r.after.path!==path.join(room(dataDir,e.bindingId),suffix)||!sameFolder(stamp(r.after.path),r.after))fail();
  }
  const used=new Set();for(const c of e.captures){
   const legacyCapture=path.join(room(m.legacyDataRoot,e.bindingId),'capture');
   if(typeof c.copiedPath!=='string'||path.dirname(c.copiedPath)!==legacyCapture||used.has(c.copiedPath)||!SHA.test(c.copiedHash||'')||c.relocatedPath!==path.join(room(dataDir,e.bindingId),'capture',path.basename(c.copiedPath)))fail();
   canonical(c.relocatedPath,false);if(digest(fs.readFileSync(c.relocatedPath))!==c.copiedHash)fail();used.add(c.copiedPath);
  }
  entries.set(e.bindingId,e);
 }
 function check(){if(stable(stamp(dataDir))!==stable(dataStamp))fail();}
 function binding(raw,b,configured){
  check();const e=entries.get(b.projectId);if(!e) return b;
  if(digest(raw)!==e.bindingHash)fail();
  const updated=structuredClone(b),sourceKey=b.draftSourceKey??digest(stable({projectId:b.projectId,workflow:b.roots.workflow,draft:b.records.draft}));
  if(!SHA.test(sourceKey))fail();
  for(const [k] of Object.entries(suffixes)){
   const prior=k.startsWith('roots.')?b.roots[k.slice(6)]:b[k],r=e.roots[k];
   if(stable(prior)!==stable(r.before)||!sameFolder(stamp(r.after.path),r.after))fail();
   if(k.startsWith('roots.')){const kind=k.slice(6);if(!sameFolder(configured[kind],r.after))fail();updated.roots[kind]=structuredClone(r.after);}else updated[k]=structuredClone(r.after);
  }
  updated.draftSourceKey=sourceKey;return updated;
 }
 function capture(bindingId,record,captureDir){
  check();const e=entries.get(bindingId);
  if(!e){if(path.dirname(record.copiedPath)!==captureDir)fail();return record.copiedPath;}
  const bindingFile=path.join(room(dataDir,bindingId),'metadata/ar-project-folder-bindings',bindingId+'.json');canonical(bindingFile,false);if(digest(fs.readFileSync(bindingFile))!==e.bindingHash)fail();
  const c=e.captures.find(c=>c.copiedPath===record.copiedPath);
  if(!c||c.copiedHash!==record.copiedHash||path.dirname(c.relocatedPath)!==captureDir)fail();
  for(const r of Object.values(e.roots))if(!sameFolder(stamp(r.after.path),r.after))fail();
  canonical(c.relocatedPath,false);if(digest(fs.readFileSync(c.relocatedPath))!==c.copiedHash)fail();return c.relocatedPath;
 }
 return {binding,capture};
}
