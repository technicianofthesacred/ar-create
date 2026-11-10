#!/usr/bin/env node
// Stand-in AI for `npm run demo` only. It speaks the small slice of the Codex command line the app uses
// (`codex exec ... --output-schema <file> -`) and answers from a fixed script of invented words.
// It is copied into a generated ar-create-synthetic-* folder and refuses to run anywhere else, so it cannot be
// pointed at by a real home. Every answer says where it came from: "Stand-in answers for the demo".
// A request it has no script for is saved under standin/unscripted/ and fails plainly.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const finish=(type,extra={})=>{console.log(JSON.stringify({type,...extra}));};
const refuse=why=>{console.error('Stand-in AI refused: '+why);finish('turn.failed',{error:{message:'Stand-in AI refused: '+why}});process.exit(3);};
try{
 const home=path.dirname(here),config=JSON.parse(fs.readFileSync(path.join(home,'config.json'),'utf8')),temp=fs.realpathSync(os.tmpdir());
 if(config.syntheticFixtures!==true||!path.basename(home).startsWith('ar-create-synthetic-')||!fs.realpathSync(home).startsWith(temp+path.sep)||config.home)refuse('this is not a generated demo folder.');
}catch(error){refuse('no demo configuration beside it.');}
export const LABEL='Stand-in answers for the demo';
const args=process.argv.slice(2);
if(args[0]==='--version'){console.log('stand-in codex for the demo');process.exit(0);}
const cwd=args[args.indexOf('-C')+1];
let prompt='';process.stdin.setEncoding('utf8');for await(const chunk of process.stdin)prompt+=chunk;
const schema=JSON.parse(fs.readFileSync(path.join(cwd,'execution-schema.json'),'utf8'));
const names=schema.properties.artifacts.required;
const readJson=name=>{try{return JSON.parse(fs.readFileSync(path.join(cwd,name),'utf8'));}catch{return null;}};
// The proposal request carries its captured context as one JSON object after the contract text.
const context=(()=>{const start=prompt.indexOf('\n\n{');if(start<0)return null;const text=prompt.slice(start+2);let depth=0,inString=false,escaped=false;for(let i=0;i<text.length;i++){const ch=text[i];if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue;}if(ch==='"')inString=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){try{return JSON.parse(text.slice(0,i+1));}catch{return null;}}}return null;})();
const TAG='Stand-in answers for the demo. ';
const DRAFT=[TAG+'Every morning before the shops open, the harbour belongs to the rope menders and a baker pushing warm loaves along Marrow Quay.','What the Guest notices first is sound: halyards ticking against the masts, gulls arguing over the fish stalls, and beneath it the slow slap of water on the stone steps.','The walk ends at the breakwater. There the Guest counts the boats, and by the time they turn round they know what they want to write that day.','One morning stays with them. Fog hid the lighthouse completely, so they could only hear it, and a fisherman handed over half a loaf without a word.','Taken together, the walk is about being given something small and then being left alone. Small things, freely given, and enough quiet to notice them.'];
const OPENINGS=[TAG+'Before the shops open, the harbour belongs to the rope menders and one baker with a cart of warm loaves.','The first thing the Guest will tell you about their morning walk is not what they see but what they hear.','A fisherman once handed the Guest half a loaf in the fog without saying a word, and the Guest has been walking the harbour ever since.'];
const CONTINUATION=['The Guest keeps to the same route each day: along Marrow Quay, past the fish stalls, out to the end of the breakwater.','Nothing is asked of them there, which is the point. The only business is to count the boats and let the words arrive.','On the way back the thing they meant to write has usually decided itself.'];
const unique=(body,wanted)=>{const lines=body.split('\n').map(line=>line.trim()).filter(line=>line.length>40);const hit=wanted.map(w=>lines.find(l=>l.includes(w))).find(Boolean)||lines[0];return hit;};

// Each script returns {artifactName: string} or null when it does not recognise the request.
const scripts=[
 // A Research answer: one explanation with exact excerpts taken from the captured sources.
 ({names,prompt})=>{
  if(names.join()!=='result.json'||!prompt.includes('Answer the operator'))return null;
  const capture=readJson('capture.json');const sources=capture?.manifest?.sources||[];if(!sources.length)return null;
  const excerpts=[];for(const source of sources.slice(0,2)){const body=source.body||'';
   for(const wanted of ['Small things, freely given','nobody asks anything of me','The sound.']){const line=body.split('\n').find(l=>l.includes(wanted));if(line&&body.indexOf(line)===body.lastIndexOf(line)){const quote=line.replace(/^\*\*[^*]+\*\*:?\s*/,'').trim();if(body.includes(quote)&&body.indexOf(quote)===body.lastIndexOf(quote)){excerpts.push({sourceId:source.id,quote});break;}}}
   if(!excerpts.some(e=>e.sourceId===source.id)){const hit=unique(body,[]);if(hit&&body.indexOf(hit)===body.lastIndexOf(hit))excerpts.push({sourceId:source.id,quote:hit});}}
  const body=[LABEL+'. This explanation is a fixed, invented script, not a model reading of the source.','',
   'The Guest describes the morning harbour walk as something they do for quiet more than for the view. They name the sound first, the ticking halyards, the gulls and the water on the steps, and say that by the time they turn back from the breakwater they know what they want to write.','',
   'Where the source is clear: the walk is given as small, freely offered things (a half loaf from a fisherman in the fog) and being left alone. Where it is thin: the source never says why this harbour matters more than another place, so any claim about the harbour itself would be inference.','',
   'Remaining uncertainty: this is one conversation, so it cannot show whether the walk always feels this way.'].join('\n');
  return {'result.json':JSON.stringify({body,excerpts})};
 },

 // A Carousel made from the finished Article: slides in the app's own words-stage format.
 ({names,prompt})=>{
  if(names.join()!=='result.md'||!/carousel/i.test(prompt))return null;
  return {'result.md':['---','kind: CAROUSEL','stage: words','status: for-your-yes','story: Harbour Morning Walk','---','','## Slides','1. [hook] What does a morning walk give you?','2. [teach] Before the shops open, the harbour belongs to rope menders and a baker.','3. [teach] First comes the sound: ticking halyards, gulls, water on the steps.','4. [teach] On the breakwater the Guest counts boats and finds what to write.','5. [close] Small things, freely given, and enough quiet to notice them.','','## Caption','Stand-in answers for the demo: a fixed, invented Carousel about a morning harbour walk. Small things, freely given.',''].join('\n')};
 },

 // Proposals for the Write screen: opening options, a full draft, a continuation, a scoped revision.
 ({names})=>{
  if(names.join()!=='proposal.json'||!context?.purpose)return null;
  const purpose=context.purpose;
  if(purpose==='opening-options')return {'proposal.json':JSON.stringify({openingOptions:OPENINGS})};
  if(purpose==='article-draft')return {'proposal.json':JSON.stringify({draftParagraphs:DRAFT})};
  if(purpose==='article-continuation')return {'proposal.json':JSON.stringify({continuationParagraphs:CONTINUATION})};
  if(purpose==='scoped-revision'){const ids=context.request?.targetParagraphIds||[];return {'proposal.json':JSON.stringify({replacements:ids.map((id,i)=>({id,words:TAG+'A tighter version for the demo, paragraph '+(i+1)+': the walk is small things freely given and enough quiet to notice them.'}))})};}
  return null;
 },
];

let produced=null;for(const script of scripts){try{produced=script({names,prompt,cwd});}catch(error){produced=null;}if(produced)break;}
if(!produced){
 const folder=path.join(here,'unscripted');fs.mkdirSync(folder,{recursive:true});const id=Date.now()+'-'+names.join('+').replace(/[^a-z0-9.+-]/gi,'');
 fs.writeFileSync(path.join(folder,id+'.json'),JSON.stringify({names,cwd,prompt},null,1));
 try{for(const name of fs.readdirSync(cwd))if(/\.(json|md)$/.test(name))fs.copyFileSync(path.join(cwd,name),path.join(folder,id+'-'+name));}catch{}
 refuse('there is no script for this request ('+names.join(', ')+'). It was saved in standin/unscripted.');
}
finish('thread.started',{model:'fixed-script',provider:'Stand-in-answers-for-the-demo'});
finish('item.completed',{item:{type:'agent_message',text:JSON.stringify({artifacts:Object.fromEntries(names.map(name=>[name,produced[name]??'']))})}});
finish('turn.completed',{usage:{input_tokens:0,output_tokens:0}});
