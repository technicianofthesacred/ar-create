import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from '../../node_modules/esbuild/lib/main.js';
const para=(id,text)=>({id,text,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]},attributions:[],kept:[],origin:'source'});
async function load(){const temp=await mkdtemp(join(tmpdir(),'ar-snapshot-carousel-'));const outfile=join(temp,'document.cjs');await build({entryPoints:[fileURLToPath(new URL('./document.ts',import.meta.url))],bundle:true,platform:'node',format:'cjs',outfile,logLevel:'silent'});return {temp,mod:createRequire(import.meta.url)(outfile)};}
test('a long article becomes a Carousel within the slide limit, keeping every passage in order',async()=>{
 const {temp,mod}=await load();
 try{
  const paragraphs=Array.from({length:100},(_,i)=>para('p'+i,'Passage '+i));
  const out=mod.snapshotCarousel({id:'doc',revision:1,title:'Long piece',paragraphs,outputs:[]});
  assert.ok(out.slides.length<=40,String(out.slides.length));
  assert.equal(out.slides[0].role,'cover');
  assert.deepEqual(out.slides.slice(1).flatMap(s=>s.paragraphIds),paragraphs.map(p=>p.id));
  assert.ok(out.slides[1].text.startsWith('Passage 0\n\nPassage 1'));
  assert.ok(out.slides.slice(1).every(s=>s.typography?.fit==='auto'),'grouped slides fit their type');
  const short=mod.snapshotCarousel({id:'doc',revision:1,title:'Short',paragraphs:paragraphs.slice(0,5),outputs:[]});
  assert.deepEqual(short.slides.slice(1).map(s=>s.paragraphIds),[['p0'],['p1'],['p2'],['p3'],['p4']]);
 }finally{await rm(temp,{recursive:true,force:true});}
});
