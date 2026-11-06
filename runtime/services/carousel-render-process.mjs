import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {inflateSync} from 'node:zlib';
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
const crc=bytes=>{let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;};
/** Decode the bounded Chromium RGB/RGBA PNG envelope before trusting completion. */
export function validateCarouselPng(bytes,{width=1080,height=1350}={}){
 if(bytes.length>32*1024*1024||!bytes.subarray(0,8).equals(SIGNATURE))throw Error('Renderer did not produce a complete PNG.');
 let offset=8,header=false,ended=false,channels=0;const data=[];
 while(offset<bytes.length){
  if(offset+12>bytes.length)throw Error('Incomplete PNG chunk.');const length=bytes.readUInt32BE(offset),end=offset+12+length;
  if(end>bytes.length)throw Error('Incomplete PNG bytes.');const type=bytes.toString('ascii',offset+4,offset+8),body=bytes.subarray(offset+8,end-4);
  if(crc(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('PNG checksum failed.');
  if(!header&&type!=='IHDR')throw Error('PNG header missing.');
  if(type==='IHDR'){if(header||length!==13||body.readUInt32BE(0)!==width||body.readUInt32BE(4)!==height||body[8]!==8||![2,6].includes(body[9])||body[10]!==0||body[11]!==0||body[12]!==0)throw Error('Renderer PNG dimensions or encoding do not match the portrait export.');header=true;channels=body[9]===6?4:3;}
  else if(type==='IDAT')data.push(body);
  else if(type==='IEND'){if(length!==0||!data.length||end!==bytes.length)throw Error('PNG ending is incomplete.');ended=true;}
  else if(type[0]===type[0].toUpperCase()&&!['PLTE'].includes(type))throw Error('Unsupported critical PNG chunk.');
  offset=end;
 }
 if(!ended)throw Error('PNG ending missing.');
 const stride=width*channels+1,raw=inflateSync(Buffer.concat(data),{maxOutputLength:stride*height});
 if(raw.length!==stride*height)throw Error('PNG image data is incomplete.');
 for(let row=0;row<height;row++)if(raw[row*stride]>4)throw Error('PNG row filter is invalid.');
 return bytes;
}

/** A completed render is distinct from Chrome shutdown. Own one isolated process
 * group, retain the 30s deadline, and never publish partial renderer output. */
export function renderCarouselProcess(binary,args,file,{timeout=30_000,grace=250,signal:abortSignal}={}){
 if(abortSignal?.aborted)return Promise.reject(Error('Carousel render cancelled.'));
 if(fs.existsSync(file))return Promise.reject(Error('Render target must be a fresh child-owned file.'));
 return new Promise((resolve,reject)=>{
  const child=spawn(binary,args,{detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',settling=false,done=false,failure=null;
  const signal=value=>{if(!child.pid)return;try{process.kill(-child.pid,value);}catch(error){if(error.code!=='ESRCH')failure??=error;}};
  const finish=error=>{
   failure=error||failure;if(settling)return;settling=true;clearTimeout(deadline);clearInterval(fileCheck);signal('SIGTERM');
   setTimeout(()=>{signal('SIGKILL');done=true;abortSignal?.removeEventListener('abort',cancel);child.stdout.destroy();child.stderr.destroy();failure?reject(failure):resolve({stdout,stderr});},grace);
  };
  const inspect=()=>{
   if(settling||!/<html\b[\s\S]*<\/html>\s*$/i.test(stdout))return;
   const status=/data-export-status="([^"]+)"/.exec(stdout)?.[1];
   if(status==='overflow'){finish(Error('Slide overflows its layout. Choose a roomier layout while keeping the reviewed words.'));return;}
   if(status==='missing-image'){finish(Error('Slide could not load all its photographs or fonts.'));return;}
   if(status!=='ready')return;
   try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.nlink!==1)throw Error('Render target is not its own regular file.');validateCarouselPng(fs.readFileSync(file));finish();}catch(error){if(error.code!=='ENOENT')lastInvalid=error;}
  };
  const cancel=()=>finish(Error('Carousel render cancelled.'));abortSignal?.addEventListener('abort',cancel,{once:true});
  let lastInvalid=null;
  const deadline=setTimeout(()=>finish(Error('Carousel renderer exceeded its deadline without a complete ready PNG.'+(lastInvalid?' '+lastInvalid.message:''))),timeout);
  const fileCheck=setInterval(inspect,50);
  child.stdout.on('data',bytes=>{stdout+=bytes.toString();if(Buffer.byteLength(stdout)>3*1024*1024)finish(Error('Carousel renderer output exceeded its limit.'));else inspect();});
  child.stderr.on('data',bytes=>{stderr+=bytes.toString();if(Buffer.byteLength(stderr)>3*1024*1024)finish(Error('Carousel renderer diagnostics exceeded their limit.'));else inspect();});
  child.on('error',finish);
  child.on('exit',code=>{if(code!==null&&code!==0)failure=Error('Carousel renderer failed with exit '+code+'.');});
  child.on('close',(code,reason)=>{if(done)return;if(settling){if(code!==null&&code!==0)failure=Error('Carousel renderer failed with exit '+code+'.');return;}inspect();if(!settling)finish(Error('Carousel renderer stopped before a complete ready PNG.'+(lastInvalid?' '+lastInvalid.message:'')));});
 });
}
