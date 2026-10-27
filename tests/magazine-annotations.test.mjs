import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as native from '../runtime/services/draft-correspondence.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const body=['Opening invented words.','%%photo: same.jpg · Visible vessel · wide x=0.2%%','%%photos: same.jpg · First | same.jpg · Second · aspect=4/5%%','%%ending%%','%%saying%%\n> "Invented close."'];
const raw=(nl='\n')=>['---','type: DEV','---','Private metadata.','','---','',body.join('\n\n'),'','---','','Retained notes.'].join('\n').replaceAll('\n',nl);
for(const nl of ['\n','\r\n'])test('caption and credit belong to exact photo/group block and exact Undo preserves '+JSON.stringify(nl),()=>{
 const text=raw(nl),model=native.capture(text,'invented'),photo=model.blocks.find(b=>b.raw.startsWith('%%photo:')),group=model.blocks.find(b=>b.raw.startsWith('%%photos:'));
 const annotation={caption:'Vessel 瓷 😀 <literal> 100%',credit:'Photo: Invented Maker'};
 for(const row of [photo,group]){
  const result=native.apply(model,text,[{kind:'photoAnnotation',id:row.id,seenBlockHash:sha(row.raw),annotation}]);
  assert.ok(result.raw.includes('%%ar-create-photo: '));assert.ok(result.raw.includes('\\u0025'));
  assert.equal(result.snapshot.blocks.filter(b=>b.raw!==model.blocks.find(x=>x.id===b.id)?.raw).length,1);
  assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,text);
  assert.throws(()=>native.apply(model,text+'external',[{kind:'photoAnnotation',id:row.id,seenBlockHash:sha(row.raw),annotation}]),/External/);
  const cleared=native.apply(result.snapshot,result.raw,[{kind:'photoAnnotation',id:row.id,seenBlockHash:sha(result.snapshot.blocks.find(b=>b.id===row.id).raw),annotation:null}]);assert.equal(cleared.raw,text);
 }
});
test('canonical article credits distinguish absent, empty and named without changing any ordinary words',()=>{
 const text=raw(),model=native.capture(text,'invented');
 const result=native.apply(model,text,[{kind:'articleCredits',credits:['Words: Invented Author','Photo: 瓷 😀']}]);
 assert.ok(result.raw.includes('%%ar-create-credits: ["Words: Invented Author","Photo: 瓷 😀"]%%'));
 assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,text);
 const empty=native.apply(result.snapshot,result.raw,[{kind:'articleCredits',credits:[]}]);assert.ok(empty.raw.includes('%%ar-create-credits: []%%'));
 const clear=native.apply(empty.snapshot,empty.raw,[{kind:'articleCredits',credits:null}]);assert.equal(clear.raw,text);
});
test('malformed or duplicate supplemental data cannot become a new annotation or ordinary text edit',()=>{
 const text=raw(),model=native.capture(text,'invented'),row=model.blocks.find(b=>b.raw.startsWith('%%photo:'));
 for(const annotation of [{caption:'x',credit:'y',extra:true},{caption:'line\nbreak',credit:''},{caption:'x',credit:' leading'},[]])assert.throws(()=>native.apply(model,text,[{kind:'photoAnnotation',id:row.id,seenBlockHash:sha(row.raw),annotation}]));
 for(const suffix of ['\n%%ar-create-photo: broken%%','\n%%ar-create-photo: {"caption":"x","credit":"y"}%%\n%%ar-create-photo: {"caption":"z","credit":"y"}%%']){
  const changed=text.replace(row.raw,row.raw+suffix),snapshot=native.capture(changed,'invented'),bad=snapshot.blocks.find(b=>b.raw.startsWith('%%photo:'));assert.throws(()=>native.apply(snapshot,changed,[{kind:'photoAnnotation',id:bad.id,seenBlockHash:sha(bad.raw),annotation:{caption:'correct',credit:''}}]),/Malformed|duplicate/);
 }
});
