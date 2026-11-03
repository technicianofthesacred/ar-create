// A synthetic AR Create with a seeded word library, two finished recordings with doubtful words, and two agent
// suggestions, for looking at the Words screen and for tests/words.browser.mjs. Invented data only; never the
// installed app. As a script:  node tests/helpers/words-demo.mjs [port]   (default 8873; refuses 8841)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {syntheticHome} from '../../scripts/demo.mjs';
import {createServer} from '../../runtime/server.mjs';
import {addRecording,seg,TEA,ORACLE} from './word-recording.mjs';

const repo=path.resolve(import.meta.dirname,'../..');
const MORE_TEA=[
 {en:'Gushu',zh:'古树',cat:'tea',variants:['goo shoo','gu shu']},{en:'Tie Guan Yin',zh:'铁观音',cat:'tea',variants:['tee gwan yin']},
 {en:'Da Hong Pao',zh:'大红袍',cat:'tea',variants:['da hong pau']},{en:'Jingdezhen',zh:'景德镇',cat:'place',variants:['jing de jen']},
 {en:'Wuyi',zh:'武夷',cat:'place',variants:['woo yee']},{en:'Gaiwan',zh:'盖碗',cat:'teaware',variants:['guy wan','kai wan']},
];

/** Start the demo. With seed:false the library is empty and there are no recordings (the first-use screen). */
export async function startWordsDemo({port=0,seed=true}={}){
 if(port===8841)throw Error('The word demo never runs on the installed app\'s port 8841.');
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
 const server=await createServer({dataDir:config.dataDir,publicDir:path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,uuid=()=>crypto.randomUUID();
 const send=async(route,body,actor='human:adrian',client='ui')=>{
  const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':client},body:body?JSON.stringify(route.endsWith('/recognise')?body:{operationId:uuid(),...body}):undefined});
  const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(route+' '+r.status+' '+JSON.stringify(v));return v;
 };
 const out={base,url:base+'/document-study/index.html',dataDir:config.dataDir,send,
  close:async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}};
 if(!seed)return out;
 const seeds=path.join(config.dataDir,'seeds');fs.mkdirSync(seeds,{recursive:true});
 fs.writeFileSync(path.join(seeds,'tea-terms.json'),JSON.stringify({terms:[...TEA.terms,...MORE_TEA]}));
 fs.writeFileSync(path.join(seeds,'oracle_cards_complete.json'),JSON.stringify(ORACLE));
 await send('/api/words/import',{source:'tea-terms',path:path.join(seeds,'tea-terms.json')},'import:demo','cli');
 await send('/api/words/import',{source:'oracle-cards',path:path.join(seeds,'oracle_cards_complete.json')},'import:demo','cli');
 await send('/api/words/add',{spelling:'Shou Puerh',variants:[{text:'shaw puerh',kind:'heard'}]});
 // two suggestions from agents
 await send('/api/words/add',{spelling:'Fenghuang',category:'place',variants:['fung wong']},'agent:claude-code','cli');
 await send('/api/words/add',{spelling:'Lu Yu',variants:['lou yoo']},'agent:codex','cli');
 const home={dir:config.dataDir,clock:{at:Date.now()}};
 const first=addRecording(home,{story:'Tea Teacher interview',segments:[
  seg(0,'Lu Yo wrote the Classic of Tea long ago.'),
  seg(5,'We drank shaw puerh from 1998 with Maria at the farm.'),
  seg(12,'Then the gaiwan was warmed.',{gaiwan:.2}),
  seg(19,'Her teacher Jonas had bought the clay from a man in Dingshu.'),
 ]});
 const second=addRecording(home,{story:'Yixing studio visit',segments:[
  seg(0,'The workshop sits above the river in Yixing.'),
  seg(6,'Wen Liang fires about 40 pots a month in the old kiln.'),
 ]});
 const one=await send('/api/words/recognise',{jobId:first.id},'cron:demo','cli');
 await send('/api/words/recognise',{jobId:second.id},'cron:demo','cli');
 // Adrian has already settled one word in the first recording, so "Recently learned" has something real to show.
 await send('/api/words/answer',{jobId:first.id,key:one.items.find(i=>i.word==='Maria').key,choice:'spelling',spelling:'Mariya',category:'person'});
 return {...out,first:first.id,second:second.id};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const demo=await startWordsDemo({port:Number(process.argv[2]||8873)});
 console.log('words demo ready: '+demo.url);
 console.log(JSON.stringify({base:demo.base,first:demo.first,second:demo.second}));
}
