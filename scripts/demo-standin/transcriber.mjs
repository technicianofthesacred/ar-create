#!/usr/bin/env node
// Stand-in transcriber for `npm run demo` only. It is copied into a generated
// ar-create-synthetic-* folder and refuses to run anywhere else, so a real home
// cannot be pointed at it by accident. It listens to nothing: every recording gets
// the same invented two-speaker conversation, marked as a stand-in in its metadata.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const refuse=why=>{console.error('Stand-in transcriber refused: '+why);process.exit(3);};
try{
 const home=path.dirname(here),config=JSON.parse(fs.readFileSync(path.join(home,'config.json'),'utf8')),temp=fs.realpathSync(os.tmpdir());
 if(config.syntheticFixtures!==true||!path.basename(home).startsWith('ar-create-synthetic-')||!fs.realpathSync(home).startsWith(temp+path.sep)||config.home)refuse('this is not a generated demo folder.');
}catch(error){refuse('no demo configuration beside it.');}
export const LABEL='Stand-in transcript for the demo';
const lines=[
 ['A','Okay, we are rolling. Tell me about the walk you take along the harbour every morning.'],
 ['B','It starts before the shops open. The only people out are the rope menders and a baker pushing a cart of warm loaves along Marrow Quay.'],
 ['A','What do you notice first?'],
 ['B','The sound. Halyards ticking against the masts, gulls arguing over the fish stalls, and under it all the slow slap of water on the stone steps.'],
 ['A','Why do you keep going back to it?'],
 ['B','Because nobody asks anything of me there. I walk to the end of the breakwater, I count the boats, and by the time I turn round I know what I want to write that day.'],
 ['A','Is there one morning that stays with you?'],
 ['B','The morning of the fog. I could not see the lighthouse, only hear it, and a fisherman handed me half a loaf without a word. I still think about that bread.'],
 ['A','So the walk is really about being given something small and being let alone.'],
 ['B','Yes. That is it exactly. Small things, freely given, and enough quiet to notice them.']];
const args=process.argv.slice(2);
if(args[0]==='-c'){console.log(JSON.stringify({mlx_whisper:true,torch:true,pyannote:true,sherpa_onnx:true,ffmpeg:true}));process.exit(0);}
if(args[0]==='-m'&&args[1]==='transcription'&&args[2]==='process'){
 const input=args[3],out=args[args.indexOf('--output')+1];
 if(!input||!out)refuse('missing input or output.');
 fs.mkdirSync(out,{recursive:true});
 let seconds=60;try{const head=fs.readFileSync(input).subarray(0,44);if(head.toString('ascii',0,4)==='RIFF'){const rate=head.readUInt32LE(24),bytes=head.readUInt32LE(40);if(rate&&bytes)seconds=Math.max(20,Math.floor(bytes/(rate*2)));}}catch{}
 const step=(seconds-4)/lines.length,segments=lines.map(([who,text],index)=>({start:Math.round((2+index*step)*10)/10,end:Math.round((2+index*step+step*0.85)*10)/10,speaker:who==='A'?'s1':'s2',text}));
 const result={language:'en',speakers:[{id:'s1',name:null},{id:'s2',name:null}],segments,metadata:{duration_seconds:seconds,review:{status:'unreviewed'},synthetic:true,standIn:true,warnings:[LABEL+'. No speech was recognised and no speaker was identified; every recording receives this invented conversation.']}};
 fs.writeFileSync(path.join(out,'transcript.json'),JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(path.join(out,'transcript.txt'),segments.map(s=>s.text).join('\n\n')+'\n');
 fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({stage:'done',updated_at:new Date().toISOString()}));
 process.exit(0);
}
console.error('Stand-in transcriber does not handle: '+args.join(' '));process.exit(2);
