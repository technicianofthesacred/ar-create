// Fills a running synthetic demo (`npm run demo`, port 8854) with an invented Simmer board: an invented transcript
// and generated photos go into Library, then one board is saved. Never runs against the installed app on 8841.
//   node tests/helpers/simmer-demo.mjs [http://127.0.0.1:8854] [subject]
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const TRANSCRIPT='Invented fixture. Mender: Most old bowls arrive cracked. I think every crack is a record of the hands that used it.\n\nMender: When I sit with one bowl for a whole day, my own day gets quieter.\n\nMender: A mended bowl is like a person who kept going. Mending it, I mend something in me.\n\nMender: I want to teach this, so the craft does not stop with me.\n';

const CRC=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c;});
const crc=buf=>{let c=-1;for(const b of buf)c=CRC[(c^b)&255]^(c>>>8);return (c^-1)>>>0;};
const chunk=(type,data)=>{const t=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,sum]);};
/** A soft invented "photo": a warm vertical gradient with a darker round shape, as PNG bytes. */
export function inventedPhoto(seed,w=320,h=400){
 const rows=[];const [r0,g0,b0]=[[92,70,48],[58,64,56],[110,84,60],[70,58,52]][seed%4];
 for(let y=0;y<h;y++){const row=Buffer.alloc(1+w*3);for(let x=0;x<w;x++){const t=y/h,dx=x-w*(0.4+0.2*(seed%3)/2),dy=y-h*0.62,inBowl=dx*dx/((w*0.32)**2)+dy*dy/((h*0.16)**2)<1,shade=inBowl?0.45:1-0.35*t,i=1+x*3;row[i]=Math.min(255,r0*shade+60*t);row[i+1]=Math.min(255,g0*shade+50*t);row[i+2]=Math.min(255,b0*shade+40*t);}rows.push(row);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}

export async function fillSimmerDemo(base='http://127.0.0.1:8854',subject='ref-an-cha'){
 if(/:8841\b/.test(base))throw Error('Simmer demo data goes into a synthetic demo, never the installed app on 8841.');
 const call=async(path,body,actor='human:adrian')=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-AR-Actor':actor,'X-AR-Client':'http'},body:body&&JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(path+': '+v.error);return v;};
 const imported=await call('/api/sources/import',{rootId:'library',folder:'',urls:[],files:[{name:'Invented conversation with a bowl mender.md',content:TRANSCRIPT},...[0,1,2,3].map(i=>({name:['Mended bowl','Kettle over coals','Hands at the table','By the river'][i]+'.png',base64:inventedPhoto(i).toString('base64')}))]});
 const ids=imported.receipts.map(r=>r.source?.id);if(ids.some(id=>!id))throw Error('Demo Library import failed.');
 const [text,...photos]=ids;
 const textSource=imported.receipts[0].source;
 const passage=async(id,quote)=>{const start=TRANSCRIPT.indexOf(quote);if(start<0)throw Error('Passage not in the invented transcript: '+quote);return {id,kind:'passage',origin:'human',by:'human:adrian',wide:true,text:quote,source:{sourceId:textSource.id,sourceHash:textSource.hash,quote,start,title:'Invented conversation with a bowl mender',speaker:'The mender (invented)'}};};
 const photo=(id,i,caption)=>({id,kind:'photo',origin:'human',by:'human:adrian',wide:false,text:'',photo:{sourceId:photos[i]},caption});
 const m=(id,kind,text,extra={})=>({id,kind,origin:'machine',by:'agent:claude-code',text,wide:!['guidance','consent'].includes(kind),...extra});
 const h=(id,kind,text,extra={})=>({id,kind,origin:'human',by:'human:adrian',text,wide:kind==='mine',...extra});
 const groups=[
  {id:'g-marks',title:'Marks of use',sub:'the strongest line',x:40,y:40,w:662,origin:'human',blocks:[photo('b-p1',0,'The mended bowl'),await passage('b-marks','every crack is a record of the hands that used it'),h('b-age','note','I am getting older and I like my marks.'),m('b-check','check','Mending with staples is very old. He said it; nobody has checked it.',{status:'Not yet checked'}),photo('b-p2',2,'Hands at the table'),m('b-feel','feeling','Does this line move you, or only impress you?',{options:['Moves me','Impresses me','Not mine']})]},
  {id:'g-slow',title:'Slowing down',x:740,y:40,w:662,origin:'human',blocks:[photo('b-p3',1,'Kettle over coals'),await passage('b-day','When I sit with one bowl for a whole day, my own day gets quieter.'),m('b-guide','guidance','Everything here is his. If it stays that way, this is his story, not yours.'),m('b-voice','voice','He went quiet for a long breath before "quieter". You did not fill the silence.'),m('b-q','question','Where in your own life do you do one thing this slowly?')]},
  {id:'g-open',title:'Still open',sub:'unresolved',x:1440,y:40,w:502,origin:'human',blocks:[m('b-thread','thread','You asked whether work for money feels different from work for mastery. He answered about price.',{options:['Follow it','Let it rest','On purpose']}),m('b-q2','question','Is his struggle to live from the craft part of your story too?')]},
  {id:'g-mend',title:'Mending ourselves',sub:'where his story meets yours',x:40,y:640,w:662,origin:'human',blocks:[await passage('b-mend','A mended bowl is like a person who kept going.'),h('b-every','mine','How you do it in one place, you do it in every place.',{held:true}),m('b-concept','concept','The thread that brings a person and an object together. He used it for how he came to this craft.',{term:'Yuánfèn',termNative:'缘分'}),m('b-centre','guidance','I think this group is the centre. He talks about bowls. You talk about everything.')]},
  {id:'g-pass',title:'Passing it on',x:740,y:640,w:662,origin:'human',blocks:[photo('b-p4',3,'By the river'),await passage('b-teach','I want to teach this, so the craft does not stop with me.'),m('b-consent','consent','Two students are recognisable. Ask before sharing.',{status:'Not asked'}),m('b-for','choice','If this became a piece, who is it for first?',{options:['The maker','The host','The considered collector'],reader:true})]},
 ];
 groups[0].blocks[1].held=true;
 let board=await call('/api/simmer/board?subject='+encodeURIComponent(subject));
 // A refill starts from an empty board: the old passages point at the earlier import and stay exactly as they were.
 if(board.groups.length)board=await call('/api/simmer/board',{subject,operationId:crypto.randomUUID(),expectedRevision:board.revision,expectedHash:board.hash,board:{title:'',groups:[],links:[],forming:{dishes:[],dish:null,sentence:{},sentAt:null}}});
 return call('/api/simmer/board',{subject,operationId:crypto.randomUUID(),expectedRevision:board.revision,expectedHash:board.hash,board:{title:'',groups,links:[['b-marks','b-every'],['b-mend','b-every'],['b-every','b-teach']],forming:{dishes:[{id:'d-essay',title:'A personal essay',why:'Built on "one place, every place". His bowls as the way in.',origin:'machine',by:'agent:claude-code'},{id:'d-story',title:'A magazine story',why:'His craft first, your reflection at the close.',origin:'machine',by:'agent:claude-code'},{id:'d-carousel',title:'A carousel: marks of use',why:'Four photos, one line each.',origin:'machine',by:'agent:claude-code'}],dish:'d-essay',sentence:{about:'a mender of old bowls',really:'',dish:'a personal essay',reader:''},sentAt:null}}});
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){const saved=await fillSimmerDemo(process.argv[2],process.argv[3]);console.log('Simmer demo board saved, revision '+saved.revision+'.');}
