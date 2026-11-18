// Test-only, offline copy of explicitly generated fixtures. This is not a
// production backup command and never reads an installed home/configuration.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {digest} from '../../runtime/services/files.mjs';

const OWNERS=new Set(['journal','activity-outbox','icloud-albums','ingestion','recordings','state.json','simmer-boards','consent-desk','study-owned-photo-bindings','study-mcp-human-saves','source-line-checks','guidance','article-visual','shared-article-requests','word-library','library-index.json','articles','request-materials','research-material','terminal','local-transcript-candidates','pieces','library','research-answers','workspaces','first-flow','study-ai-execution','requests','exports','source-originals','article-make','shared-carousel-requests','passage-revisions','magazine','source-translation-proposals','provenance','study-draft-copies','carousel-exports','state.backup.json','study-footage','carousel-make','state.pieces-migration.backup.json','voice-corrections','shared-article-launches','native-carousel-make','study-mcp-requests','study-project-bindings','native-language-acceptance','native-outputs','language-proposals','simmer-operations','study-photos','conversation-captures','needs-you','study-quote-links']);
const SHA=/^[a-f0-9]{64}$/;
const canonical=p=>{assert.equal(path.resolve(p),p);let at=path.parse(p).root;for(const s of p.slice(at.length).split(path.sep).filter(Boolean)){at=path.join(at,s);assert.equal(fs.lstatSync(at).isSymbolicLink(),false,'Symlink refused: '+at);}assert.equal(fs.realpathSync(p),p);return p;};
function control(file){canonical(file);const stat=fs.lstatSync(file);assert.ok(stat.isFile()&&stat.nlink===1&&stat.size<=65536,'Control file must be an ordinary single-link bounded file');return {file,stat};}
function readControl({file,stat}){const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const opened=fs.fstatSync(fd);assert.ok(opened.isFile()&&opened.nlink===1&&opened.dev===stat.dev&&opened.ino===stat.ino&&opened.size===stat.size,'Control identity changed');const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),visible=fs.lstatSync(file);assert.ok(after.nlink===1&&visible.dev===stat.dev&&visible.ino===stat.ino&&bytes.length===stat.size&&after.mtimeMs===stat.mtimeMs&&after.ctimeMs===stat.ctimeMs,'Control bytes changed');return bytes.toString('utf8');}finally{fs.closeSync(fd);}}
const safe=rel=>{assert.equal(typeof rel,'string');assert.ok(rel&&!path.isAbsolute(rel)&&!/[\\\x00-\x1f]/.test(rel)&&rel.split('/').every(s=>s&&s!=='.'&&s!=='..'),'Unsafe relative path');return rel;};
const allowed=rel=>{safe(rel);const [area,owner]=rel.split('/');assert.ok(['owned','sources','files','invented-photos'].includes(area),'Unknown fixture area');if(area==='owned'&&owner)assert.ok(OWNERS.has(owner),'Unknown owner: '+owner);assert.ok(!/(^|\/)(credentials?|oauth|tokens?|secrets?|runner-config|i64os-directions)([./-]|$)/i.test(rel),'Secret/config excluded: '+rel);};
function inventory(root,area){const rows=[];function visit(dir){for(const name of fs.readdirSync(dir).sort()){const file=path.join(dir,name),rel=area+'/'+path.relative(root,file),s=fs.lstatSync(file);if(rel==='owned/recordings/runner-config.json')continue;allowed(rel);assert.equal(s.isSymbolicLink(),false,'Symlink refused');assert.ok(s.isDirectory()||s.isFile(),'Regular files only');if(s.isDirectory()){rows.push({path:rel,kind:'directory'});visit(file);}else{assert.equal(s.nlink,1);assert.ok(s.size<=16*1024*1024);const bytes=fs.readFileSync(file);rows.push({path:rel,kind:'file',size:bytes.length,hash:digest(bytes),bytes:bytes.toString('base64')});}}}visit(root);return rows;}
export function syntheticSnapshot(f,{sourceRevision}){
 assert.equal(f.closed,true,'Close fixture owners before snapshot');assert.match(sourceRevision,/^[a-f0-9]{40}$/);
 const root=canonical(f.home.dir),temp=fs.realpathSync(os.tmpdir());assert.equal(path.dirname(root),temp);assert.ok(path.basename(root).startsWith('ar-create-synthetic-'));
 // Validate both controls before reading either. An external symlink/hardlink
 // must never be opened even to discover that its configuration is invalid.
 const [configControl,markerControl]=['config.json','W8-SYNTHETIC'].map(name=>control(path.join(root,name)));
 assert.equal(readControl(markerControl),'generated-by-coherent-journey-fixture-v1\n');
 const config=JSON.parse(readControl(configControl));assert.equal(config.syntheticFixtures,true);assert.deepEqual(config.tools,{});assert.equal(config.dataDir,path.join(root,'owned'));assert.equal(config.studyOriginalRoots.vaultRoot,path.join(root,'sources'));assert.equal(config.studyOriginalRoots.filesRoot,path.join(root,'files'));
 // Inventory only explicit data and original areas. Never copy config itself.
 const rows=[];for(const area of ['owned','sources','files','invented-photos']){canonical(path.join(root,area));rows.push({path:area,kind:'directory'});for(const row of inventory(path.join(root,area),area))rows.push(row);}
 // inventory() receives each area, so validate the complete paths here too.
 for(const row of rows)allowed(row.path);
 return {schema:'ar-create.w8-synthetic-snapshot.v1',inventedOnly:true,closedOwners:true,sourceRevision,legacyHome:root,legacyDataRoot:config.dataDir,catalog:structuredClone(config.studyOriginalRoots.catalog),rows,inventoryHash:digest(JSON.stringify(rows.map(({bytes,...r})=>r))),originalAvailability:{sources:'included-invented',files:'included-invented',recordingOriginals:'not-created'},limits:['Synthetic fixture only','No installed-home claim','No provider or OAuth state','No external Magazine owner relocation']};
}
// The caller creates an empty private mkdtemp directory and exclusively owns
// it throughout this operation. No atomic publication or protection against
// concurrent external filesystem mutation is promised. Failures leave partial
// synthetic files for the caller to inspect and clean up; this helper never
// removes or replaces a destination.
export function restoreSynthetic(snapshot,destination){
 snapshot=structuredClone(snapshot);
 assert.equal(snapshot.schema,'ar-create.w8-synthetic-snapshot.v1');assert.equal(snapshot.inventedOnly,true);assert.equal(snapshot.closedOwners,true);assert.ok(Array.isArray(snapshot.rows));
 canonical(destination);
 assert.equal(path.dirname(destination),fs.realpathSync(os.tmpdir()),'Destination must be a caller-owned private test temp directory');
 assert.ok(path.basename(destination).startsWith('w8-restored-'),'Caller-created restore fixture required');
 assert.ok(fs.lstatSync(destination).isDirectory(),'Destination must be a directory');
 assert.deepEqual(fs.readdirSync(destination),[],'Nonempty destination refused');
 const seen=new Set();let total=0;
 for(const row of snapshot.rows){allowed(row.path);assert.ok(!seen.has(row.path),'Duplicate path');seen.add(row.path);assert.ok(['directory','file'].includes(row.kind));if(row.kind==='file'){assert.ok(SHA.test(row.hash));const bytes=Buffer.from(row.bytes,'base64');assert.equal(bytes.length,row.size);assert.equal(digest(bytes),row.hash);total+=bytes.length;assert.ok(total<=64*1024*1024,'Bounded fixture only');}}
 assert.equal(snapshot.inventoryHash,digest(JSON.stringify(snapshot.rows.map(({bytes,...r})=>r))),'Inventory changed');
  for(const row of snapshot.rows){const file=path.join(destination,row.path);if(row.kind==='directory')fs.mkdirSync(file,{mode:0o700});else fs.writeFileSync(file,Buffer.from(row.bytes,'base64'),{flag:'wx',mode:0o600});}
  for(const row of snapshot.rows.filter(r=>r.kind==='file'))assert.equal(digest(fs.readFileSync(path.join(destination,row.path))),row.hash);
  const dataDir=path.join(destination,'owned'),copyRoot=path.join(dataDir,'study-draft-copies/copies'),bindings=[];
  for(const bindingId of fs.readdirSync(copyRoot)){
   const room=path.join(copyRoot,bindingId),file=path.join(room,'metadata/ar-project-folder-bindings',bindingId+'.json'),raw=fs.readFileSync(file),binding=JSON.parse(raw),capture=JSON.parse(fs.readFileSync(path.join(room,'capture-manifest.json'))),roots={};
   for(const [key,suffix] of Object.entries({'roots.media':'media','roots.workflow':'workflow',media:'media/Project',derived:'workflow/Derived'})){const p=path.join(room,suffix),s=fs.lstatSync(p);roots[key]={before:key.startsWith('roots.')?binding.roots[key.slice(6)]:binding[key],after:{path:p,dev:s.dev,ino:s.ino}};}
   bindings.push({bindingId,bindingHash:digest(raw),roots,captures:capture.records.filter(r=>!r.missing).map(r=>({copiedPath:r.copiedPath,copiedHash:r.copiedHash,relocatedPath:path.join(room,'capture',path.basename(r.copiedPath))}))});
  }
  return {schema:'ar-create.w8-synthetic-restored.v1',state:'verified-files-owner-qualification-pending',dataDir,studyOriginalRoots:{vaultRoot:path.join(destination,'sources'),filesRoot:path.join(destination,'files'),catalog:snapshot.catalog},studyRelocation:{schema:'ar-create.study-owned-relocation.v1',legacyDataRoot:snapshot.legacyDataRoot,dataRoot:dataDir,bindings},sourceRevision:snapshot.sourceRevision,inventoryHash:snapshot.inventoryHash};
}
