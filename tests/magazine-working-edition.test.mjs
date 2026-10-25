import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createMagazineMediaInspection} from '../scripts/magazine-media-inspection.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const PNG=Buffer.from([137,80,78,71,13,10,26,10,1]);
function fixture(t,{nested=false,follow=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'working-edition-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const conv=path.join(root,'src/pages/read/conversation');fs.mkdirSync(path.join(conv,'pieces'),{recursive:true});
 const shot={file:'photo.png',slot:'shot',alt:'Invented vessel',x:.7,y:.3};
 const words={kind:'n',id:'words',text:'Current saved words'};
 const block=nested?{kind:'side',shot,blocks:[follow?{kind:'line',id:'pull',text:'A pull',size:'l',follow:{id:'follow',text:'Continuation'}}:{kind:'photos',shots:[shot]}]}:{kind:'photos',shots:[shot],aspect:'4/5'};
 const parsed={intro:'Current opening',opening:[words,block],parts:[],ending:{blocks:[],saying:{id:'end',text:'Current closing saying'}}};
 fs.writeFileSync(path.join(conv,'magSend.ts'),`export const draftBody=text=>({body:text});export const memoryOf=spec=>spec;export const parseDraft=()=>(${JSON.stringify(parsed)});`);
 const metadata={slug:'synthetic',path:'/read/synthetic',images:'/read/synthetic/',source:'invented-source',pageTitle:'Invented',title:['Invented','Story'],dek:'Context',subject:{name:'Invented',role:'Maker',secret:'omit'},speakers:{author:'Author',subject:'Maker',secret:'omit'},author:{name:'Author',links:[{label:'About',href:'/about',secret:'omit'}]},credit:['Invented credit'],next:[],portrait:shot,hook:'Earlier hook',closing:'Earlier close',secret:'omit'};
 fs.writeFileSync(path.join(conv,'pieces/index.ts'),`export const CONVERSATIONS=[${JSON.stringify(metadata)}];`);
 const image=path.join(root,'public/read/synthetic/photo.png');fs.mkdirSync(path.dirname(image),{recursive:true});fs.writeFileSync(image,PNG);
 const text='---\npublished: https://www.teajia.com/read/synthetic\n---\nInvented saved draft';
 const input={storyId:'invented',pieceId:'invented:article',expectedHash:sha(text)};let reads=0,hook=()=>{};
 const reader=createMagazineMediaInspection({repoRoot:root,resolveWorking:async()=>{hook(++reads);return {document:{text,hash:sha(text)},authority:{kind:'magazine',storyId:input.storyId,pieceId:input.pieceId},target:{nativeProjectId:'native-invented',artifactId:'registered',hash:sha(text)}};}});
 return {reader,input,image,conv,root,parsed,onRead(fn){reads=0;hook=fn;}};
}
test('working edition carries one exact parse/media owner and drops earlier optional story fields and metadata extras',async t=>{
 const f=fixture(t),r=await f.reader.workingEdition(f.input),m=await f.reader.inspect(f.input);
 assert.equal(r.schema,'ar-create.magazine-working-edition.v1');assert.equal(r.revision,m.revision);assert.deepEqual(r.media,m);assert.deepEqual(r.ownerRef,m.ownerRef);
 for(const k of ['intro','opening','parts','ending'])assert.deepEqual(r.spec[k],f.parsed[k]);
 for(const k of ['portrait','hook','closing','secret'])assert.equal(Object.hasOwn(r.spec,k),false);
 assert.equal(r.spec.subject.secret,undefined);assert.equal(r.spec.speakers.secret,undefined);assert.equal(r.spec.author.links[0].secret,undefined);assert.equal(r.spec.credit[0],'Invented credit');
 assert.equal(JSON.stringify(r).includes(f.root),false);assert.equal(r.media.sources[0].placements[0].crop.x,.7);
});
test('refuses nested forms the maintained canvas would omit',async t=>{
 for(const options of [{nested:true},{nested:true,follow:true}]){const f=fixture(t,options);await assert.rejects(f.reader.workingEdition(f.input),/nested article layout/);}
});
test('exact request rejects foreign fields and hash, and current owner failure propagates',async t=>{
 const f=fixture(t);await assert.rejects(f.reader.workingEdition({...f.input,path:'/elsewhere'}));await assert.rejects(f.reader.workingEdition({...f.input,expectedHash:'a'.repeat(64)}));
 f.onRead(n=>{if(n===3)throw Object.assign(Error('Owner changed'),{status:409});});await assert.rejects(f.reader.workingEdition(f.input),/Owner changed/);
});
test('final recheck refuses changed parser, asset bytes, and substituted symlink',async t=>{
 for(const kind of ['code','asset','symlink']){const f=fixture(t);f.onRead(n=>{if(n!==3)return;if(kind==='code')fs.appendFileSync(path.join(f.conv,'magSend.ts'),'\n// changed');else if(kind==='asset')fs.writeFileSync(f.image,Buffer.concat([PNG,Buffer.from('new')]));else{fs.unlinkSync(f.image);fs.symlinkSync(path.join(f.conv,'magSend.ts'),f.image);}});await assert.rejects(f.reader.workingEdition(f.input));}
});
