/* Lossless storage encoding, used only when an ordinary browser write fails.
 * This is a transient safety copy, never a manuscript or history authority.
 * Existing recovery keys are never deleted or compacted in place here. */
(()=>{
 const FORMAT='ar-create.recovery-packed.v1',MAX=32*1024*1024;
 function unpack(value){
  if(!value||value.format!==FORMAT)throw Error('Invalid compact recovery format.');
  if(!Number.isSafeInteger(value.length)||value.length<0||value.length>MAX||!Array.isArray(value.parts)||value.parts.length>value.length+1)throw Error('Invalid compact recovery snapshot.');
  let out='';
  for(const part of value.parts){
   if(typeof part==='string')out+=part;
   else{
    if(!Array.isArray(part)||part.length!==2||!part.every(Number.isSafeInteger))throw Error('Invalid recovery reference.');
    const [distance,length]=part;if(distance<1||distance>out.length||length<8||length>65535||out.length+length>value.length)throw Error('Invalid recovery reference.');
    const source=out.slice(-distance);out+=source.repeat(Math.ceil(length/distance)).slice(0,length);
   }
   if(out.length>value.length)throw Error('Compact recovery length changed.');
  }
  if(out.length!==value.length)throw Error('Compact recovery is incomplete.');
  return out;
 }
 function decode(raw){const value=JSON.parse(raw);return value?.format===FORMAT?unpack(value):raw;}
 function parse(raw){return JSON.parse(decode(raw));}
 function pack(raw){
  if(raw.length>MAX)throw Error('Recovery snapshot exceeds the supported size.');
  const seen=new Map(),parts=[];let start=0,i=0;
  const remember=position=>{if(seen.size>=65536)seen.clear();seen.set(raw.slice(position,position+4),position);};
  while(i+8<=raw.length){
   const key=raw.slice(i,i+4),prior=seen.get(key);remember(i);
   let length=0;const distance=i-prior;
   if(prior!==undefined&&distance>0&&distance<=65535){while(length<65535&&i+length<raw.length&&raw[i+length]===raw[i+length-distance])length++;}
   if(length<8){i++;continue;}
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
  try{storage.setItem(key,raw);}catch(error){
   const compact=pack(raw);if(compact.length>=raw.length)throw error;
   storage.setItem(key,compact);
  }
  if(decode(storage.getItem(key))!==raw)throw Error('Browser did not retain exact recovery data.');
 }
 window.arRecoveryStorage=Object.freeze({parse,write});
})();
