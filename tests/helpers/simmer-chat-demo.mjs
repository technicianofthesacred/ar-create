// Runs Simmer from a chat against a running synthetic demo (`npm run demo`, port 8854), through the agent CLI exactly
// as an agent in a Claude chat would: five invented photos from a folder plus invented words in, proposals onto the
// board, the dish named in an invented sentence, the commit sentence read back from Direction. Never the installed
// app on 8841.
//   node tests/helpers/simmer-chat-demo.mjs [http://127.0.0.1:8854]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {run} from '../../agents/cli/ar-create.mjs';
import {inventedPhoto} from './simmer-demo.mjs';

export const DEMO_WORDS=[
 {text:'Invented: I keep going back to the kettle before anyone is awake. The house is still mine for an hour.',said:'spoken'},
 {text:'Invented: the old cup has two cracks and I trust it more because of them.',said:'typed'},
 {text:'Invented: my grandmother never measured the leaves. She listened to the water.',said:'spoken'},
];
export const DEMO_SENTENCE='Invented: it is a short personal essay about the hour before anyone wakes, for the host who is always up first.';

export async function simmerChatDemo(base='http://127.0.0.1:8854',{log=()=>{}}={}){
 if(/:8841\b/.test(base))throw Error('The Simmer chat demo runs against a synthetic demo, never the installed app on 8841.');
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'simmer-chat-demo-'));
 const names=['Kettle before dawn','Two cracks','Leaves in the hand','Window light','Cups drying'];
 names.forEach((n,i)=>fs.writeFileSync(path.join(folder,n+'.png'),inventedPhoto(i)));
 const cli=async(args,input)=>{const out=await run(['--url',base,'--actor','agent:claude-code',...args,...(input?['--input','-']:[])],{stdin:async()=>JSON.stringify(input)});log('$ ar-create '+args.join(' ')+(input?' --input -':'')+'  -> exit '+out.exitCode);if(out.exitCode!==0)throw Error(args.join(' ')+': '+JSON.stringify(out.result));return out.result.data??out.result;};
 try{
  const intake=await cli(['simmer','intake'],{title:'The hour before anyone wakes',folder,words:DEMO_WORDS});
  const subject=intake.subject,blocks=intake.groups.flatMap(g=>g.blocks),photos=['Kettle before dawn','Two cracks','Leaves in the hand','Window light','Cups drying'].map(c=>blocks.find(b=>b.kind==='photo'&&b.caption===c)),mine=blocks.filter(b=>b.kind==='mine');
  log('  subject '+subject+': '+photos.length+' photos, '+mine.length+' of his words (dictated), Collection '+intake.collectionId);
  const material=await cli(['simmer','material',subject]);
  const proposal=await cli(['simmer','propose'],{subject,expectedRevision:material.revision,expectedHash:material.hash,
   groups:[{key:'dawn',title:'The house before it wakes',sub:'proposed grouping',blockIds:[photos[0].id,mine[0].id,photos[4].id]},{key:'cup',title:'What the cracks keep',sub:'proposed grouping',blockIds:[photos[1].id,mine[1].id]},{key:'lineage',title:'Listening to the water',sub:'proposed grouping',blockIds:[photos[2].id,mine[2].id,photos[3].id]}],
   letter:{recurs:'Being alone with the water before the day starts. You come back to it three times.',voice:'When you talk about your grandmother you stop describing and start listening.',unresolved:'Whether the cracked cup was hers.',group:'cup'},
   dishes:[{title:'A short personal essay',why:'The hour before anyone wakes as the way in.'},{title:'A carousel: five photos, five lines',why:'The photos already tell it in order.'},{title:'A Tea Wisdom entry on not measuring',why:'Your grandmother listening to the water.'}],
   questions:[{text:'Whose cup was it first?',group:'cup'},{text:'What do you do in that hour that you never do later?',group:'dawn'}],
   feelings:[{text:'Is "the house is still mine" true for you, or a nice line?',group:'dawn'},{text:'Does the grandmother belong in this, or in another piece?',group:'lineage'}]});
  log('  proposed: '+proposal.receipt.groups.length+' groups, '+proposal.receipt.blocks.length+' blocks, '+proposal.receipt.dishes.length+' dishes');
  const named=await cli(['simmer','name'],{subject,sentence:DEMO_SENTENCE,said:'spoken'});
  const direction=await cli(['project','read'],{parentStudyId:subject});
  log('  named: '+named.direction.status+'; Direction adopted direction: '+JSON.stringify(direction.adoptedDirection));
  if(direction.adoptedDirection!==DEMO_SENTENCE)throw Error('The commit sentence in Direction is not his exact sentence.');
  return {subject,title:intake.title,revision:named.revision,collectionId:intake.collectionId,direction:direction.adoptedDirection};
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){const out=await simmerChatDemo(process.argv[2],{log:console.log});console.log(JSON.stringify(out));}
