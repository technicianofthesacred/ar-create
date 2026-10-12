// Disposable interaction fixture. These tones and authored captions prove UI
// behavior, never recognition accuracy or real speaker identity.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from './server.mjs';
import {digest} from './services/files.mjs';
import {validateChatGPTTranslation} from './services/magazine/chatgpt-translation.mjs';
import {translationSourceDigest} from './services/magazine/translation.mjs';

export function createWorkshopFixture(dataDir){
 const id=randomUUID(),story='Disposable tone fixture',recordings=path.join(dataDir,'recordings'),output=path.join(recordings,story,'Transcription',id),rawRoot=path.join(recordings,'vault','Workflow','0-Inbox');
 for(const folder of [output,rawRoot,path.join(recordings,'.transcription-jobs'),path.join(output,'translations')])fs.mkdirSync(folder,{recursive:true});
 const rate=16000,seconds=32,frames=rate*seconds,wav=Buffer.alloc(44+frames*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
 for(let index=0;index<frames;index++){const time=index/rate,frequency=time>=2&&time<12?440:time>=17&&time<23?660:0;wav.writeInt16LE(frequency?Math.round(1600*Math.sin(time*frequency*Math.PI*2)):0,44+index*2);}
 const source=path.join(recordings,'tone-fixture.wav'),raw=path.join(rawRoot,'RAW - Disposable tone fixture.md');fs.writeFileSync(source,wav);
 const original={language:'en',speakers:[{id:'s1',name:null},{id:'s2',name:null}],segments:[{start:2,end:12,speaker:'s1',text:'The first sample uses a low fixture tone.'},{start:17,end:23,speaker:'s2',text:'The second sample uses a higher fixture tone.'}],metadata:{duration_seconds:seconds,review:{status:'unreviewed'},synthetic:true,warnings:['Synthetic tone fixture; no speech recognition or speaker identity is asserted.']}};
 const rawBody='# Machine RAW · disposable fixture\n\n'+original.segments.map(segment=>segment.text).join('\n\n')+'\n';fs.writeFileSync(raw,rawBody);fs.writeFileSync(path.join(output,'transcript.json'),JSON.stringify(original,null,2));
 const translation=validateChatGPTTranslation({id,story},original,{recordingId:id,sourceDigest:translationSourceDigest(original),language:'ko',segments:[{id:'segment:0',text:'첫 번째 샘플은 낮은 테스트 음을 사용합니다.',uncertainty:''},{id:'segment:1',text:'두 번째 샘플은 더 높은 테스트 음을 사용합니다.',uncertainty:'Authored fixture translation; this is not an external model result.'}]});
 fs.writeFileSync(path.join(output,'translation.ko.json'),JSON.stringify(translation,null,2));fs.writeFileSync(path.join(output,'translations','ko.state.json'),JSON.stringify({language:'ko',version:3,engine:'chatgpt-import',state:'complete',sourceDigest:translationSourceDigest(original),completed:2,total:2,updatedAt:new Date().toISOString()}));
 fs.writeFileSync(path.join(recordings,'.transcription-jobs',id+'.json'),JSON.stringify({id,story,state:'done',stage:'done',transcriptReady:true,source,output,raw,rawCandidateSha256:digest(rawBody),started:new Date().toISOString()}));
 return {id,story,source,raw,output,original,translation};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-workshop-ui-')),fixture=createWorkshopFixture(dataDir),server=await createServer({dataDir,transcriptionRuntime:{python:'/no-interpreter'}});
 server.listen(0,'127.0.0.1',()=>{const base=`http://127.0.0.1:${server.address().port}`;console.log(JSON.stringify({dataDir,recordingId:fixture.id,original:base+`/transcription/${fixture.id}/view`,translation:base+`/transcription/${fixture.id}/view?language=ko`,raw:base+`/transcription/${fixture.id}/raw.md`}));});
}
