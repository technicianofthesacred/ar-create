/* Lossless storage encoding; large new writes prefer the smaller complete form.
 * This is a transient safety copy, never a manuscript or history authority.
 * No retained key is removed; callers write only their own record or UI cache. */
(()=>{
 const FORMAT='ar-create.recovery-packed.v1',MAX=32*1024*1024;
 function unpack(value){
  if(!value||value.format!==FORMAT)throw Error('Invalid compact recovery format.');
  if(!Number.isSafeInteger(value.length)||value.length<0||value.length>MAX||!Array.isArray(value.parts)||value.parts.length>value.length+1)throw Error('Invalid compact recovery snapshot.');
  // Linear UTF-16 decoding also reads older many-part snapshots without
  // repeatedly flattening an ever-growing string for each back-reference.
  const buffer=new Uint16Array(value.length);let position=0;
  for(const part of value.parts){
   if(typeof part==='string'){
    if(position+part.length>value.length)throw Error('Compact recovery length changed.');
    for(let i=0;i<part.length;i++)buffer[position++]=part.charCodeAt(i);
   }else{
    if(!Array.isArray(part)||part.length!==2||!part.every(Number.isSafeInteger))throw Error('Invalid recovery reference.');
    const [distance,length]=part;if(distance<1||distance>position||length<8||length>65535||position+length>value.length)throw Error('Invalid recovery reference.');
    for(let i=0;i<length;i++){buffer[position]=buffer[position-distance];position++;}
   }
  }
  if(position!==value.length)throw Error('Compact recovery is incomplete.');
  const chunks=[];for(let i=0;i<buffer.length;i+=8192)chunks.push(String.fromCharCode(...buffer.subarray(i,i+8192)));
  return chunks.join('');
 }
 function decode(raw){const value=JSON.parse(raw);return value?.format===FORMAT?unpack(value):raw;}
 function parse(raw){return JSON.parse(decode(raw));}
 function pack(raw){
  if(raw.length>MAX)throw Error('Recovery snapshot exceeds the supported size.');
  const MAX_KEYS=262144,seen=new Map(),slots=new Array(MAX_KEYS),parts=[];let start=0,i=0,nextSlot=0;
  const remember=position=>{const key=raw.slice(position,position+8),prior=seen.get(key);if(prior){prior.push(position);if(prior.length>4)prior.shift();}else{if(seen.size>=MAX_KEYS)seen.delete(slots[nextSlot]);slots[nextSlot]=key;nextSlot=(nextSlot+1)%MAX_KEYS;seen.set(key,[position]);}};
  while(i+12<=raw.length){
   const candidates=seen.get(raw.slice(i,i+8));let length=0,distance=0;
   for(let k=(candidates?.length||0)-1;k>=0;k--){const gap=i-candidates[k];let match=8;while(match<65535&&i+match<raw.length&&raw[i+match]===raw[i+match-gap])match++;if(match>length){length=match;distance=gap;}}
   remember(i);
   if(length<12){i++;continue;}
   if(i>start)parts.push(raw.slice(start,i));parts.push([distance,length]);
   for(let j=i+1;j<i+length;j++)remember(j);
   i+=length;start=i;
  }
  if(start<raw.length)parts.push(raw.slice(start));
  const packed=JSON.stringify({format:FORMAT,length:raw.length,parts});
  if(decode(packed)!==raw)throw Error('Recovery compaction did not retain exact data.');
  return packed;
 }
 function write(storage,key,raw){
  // Callers supply JSON.stringify output. Never replace a failed write with a
  // truncated value or delete another record to make room.
  const compact=raw.length>=65536?pack(raw):null,preferred=compact&&compact.length<raw.length?compact:raw;
  try{storage.setItem(key,preferred);}catch(error){
   if(preferred!==raw)throw error;
   const fallback=compact||pack(raw);if(fallback.length>=raw.length)throw error;
   storage.setItem(key,fallback);
  }
  if(decode(storage.getItem(key))!==raw)throw Error('Browser did not retain exact recovery data.');
 }
 window.arRecoveryStorage=Object.freeze({parse,write});
})();
