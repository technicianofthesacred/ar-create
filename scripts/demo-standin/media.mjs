// Invented media for the demo, generated at start and never committed: a two-tone WAV and plain-shape PNG "photographs".
import zlib from 'node:zlib';
export function toneWav(seconds=48){const rate=16000,frames=rate*seconds,wav=Buffer.alloc(44+frames*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++){const t=i/rate,slot=Math.floor(t/4.4),on=(t%4.4)<3.7&&t>=2&&t<seconds-2,f=slot%2?660:440;wav.writeInt16LE(on?Math.round(1400*Math.sin(t*f*Math.PI*2)):0,44+i*2);}return wav;}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);out.write(type,4,'ascii');data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,8+data.length)),8+data.length);return out;};
/** A plain gradient with one simple shape. colour(x,y)->[r,g,b] */
export function png(width,height,colour){const raw=Buffer.alloc((width*3+1)*height);for(let y=0;y<height;y++){raw[y*(width*3+1)]=0;for(let x=0;x<width;x++){const [r,g,b]=colour(x/width,y/height),o=y*(width*3+1)+1+x*3;raw[o]=r;raw[o+1]=g;raw[o+2]=b;}}
 const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
export const PHOTOS=[
 {name:'demo-photo-1-dawn-gradient.png',png:()=>png(960,640,(x,y)=>mix([250,196,140],[70,96,140],y))},
 {name:'demo-photo-2-circle-on-teal.png',png:()=>png(960,640,(x,y)=>(x-.5)**2*1.8+(y-.5)**2<.06?[246,232,200]:mix([32,98,104],[14,52,66],x))},
 {name:'demo-photo-3-stripes.png',png:()=>png(960,640,(x,y)=>Math.floor(y*8)%2?mix([170,86,70],[210,140,100],x):mix([240,226,206],[220,200,176],x))},
];
