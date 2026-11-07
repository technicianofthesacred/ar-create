// A finished recording laid out exactly as the recording owner keeps it, so the real correction receipts run on it.
// `h` is {dir, clock:{at}}: dir is the data folder, clock.at the time the job counts as started.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {markdownTranscript,readableTranscript} from '../../runtime/services/magazine/outputs.mjs';
import {digest} from '../../runtime/services/files.mjs';

export function addRecording(h,{segments,story='Yixing visit',language='en',reviewed=false}={}){
 const dir=path.join(h.dir,'recordings'),id=randomUUID(),output=path.join(dir,'Story',id),jobs=path.join(dir,'.transcription-jobs');
 const raw=path.join(dir,'vault/Workflow/0-Inbox',`RAW-${id}.md`),audio=path.join(dir,'Story',`${id}.wav`);
 for(const p of [output,jobs,path.dirname(raw)])fs.mkdirSync(p,{recursive:true});
 fs.writeFileSync(raw,'Exact immutable synthetic RAW.');fs.writeFileSync(audio,'Invented synthetic audio bytes.');
 const job={id,output,source:audio,raw,rawCandidateSha256:digest(fs.readFileSync(raw)),story,language,state:'done',transcriptReady:true,started:new Date(h.clock.at).toISOString()};
 const result={language,speakers:[{id:'speaker',name:'Invented speaker'}],segments:segments.map(s=>({speaker:'speaker',...s})),metadata:{review:{status:reviewed?'reviewed':'unreviewed'}}};
 const config={conversationTimestamps:true};
 fs.writeFileSync(path.join(jobs,id+'.json'),JSON.stringify(job));
 for(const [name,value] of Object.entries({'transcript.json':JSON.stringify(result),'transcript.md':markdownTranscript(job,result,config),'transcript.txt':readableTranscript(result)}))fs.writeFileSync(path.join(output,name),value);
 return {id,output,raw,audio,dir,config,job};
}
export const w=(text,probability)=>text.split(' ').map((word,i)=>({word:' '+word,start:i*.4,end:i*.4+.3,probability:probability?.[word]??.95}));
export const seg=(start,text,probability,extra={})=>({start,end:start+text.split(' ').length*.4,text,words:w(text,probability),avg_logprob:-.3,...extra});
export const TALK=[
 seg(0,'Lu Yo wrote the Classic of Tea long ago.'),
 seg(5,'We drank shaw puerh from 1998 with Maria at the farm.',{'1998':.2},{avg_logprob:-1.5}),
 seg(12,'Then the gaiwan was warmed.',{gaiwan:.2}),
];


// ---- invented seed files shaped like the real ones (a tea-terms library and the oracle card list) ----
export const TEA={about:'invented',terms:[
 {en:'Puerh',pinyin:"pǔ'ěr",zh:'普洱',cat:'tea',sets:['puerh'],core:true,variants:["pu'er",'pu er','puer','pu air','普尔']},
 {en:'Shou Puerh',zh:'熟普洱',cat:'tea',sets:['puerh'],variants:['shou puer','show puer','ripe puerh']},
 {en:'Lu Yu',pinyin:'lù yǔ',zh:'陆羽',trad:'陸羽',cat:'person',core:true,variants:['lu yu','luyu','loo you']},
 {en:'Yixing',zh:'宜兴',cat:'place',variants:['yi shing','e shing']},
 {en:'Chan (Zen)',cat:'concept',variants:['zen','chan']},
]};
export const ORACLE={meta:{title:'invented'},codon_rings:[{ring_name:'r',cards:[
 {number:1,card_name:'First card',iching:{hexagram_name:"The Creative (Ch'ien)"},gene_keys:{shadow:'Entropy',gift:'Freshness',siddhi:'Beauty'}},
 {number:2,card_name:'Second card',iching:{hexagram_name:"The Receptive (K'un)"},gene_keys:{shadow:'Dislocation',gift:'Orientation',siddhi:'Unity'}},
 {number:3,card_name:'Third card',iching:{hexagram_name:'Difficulty at the Beginning (Chun)'},gene_keys:{shadow:'Chaos',gift:'Innovation',siddhi:'Beauty'}},
]}]};
