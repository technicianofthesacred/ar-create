import {capture,render} from './draft-correspondence.mjs';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function metadata(snapshot){
 return {schema:'ar-create.bound-draft-correspondence.v1',sourceKey:snapshot.sourceKey,fileHash:snapshot.fileHash,prefixHash:hash(snapshot.prefix),prefixLength:snapshot.prefix.length,blocks:snapshot.blocks.map(b=>({id:b.id,blockHash:hash(b.raw),rawLength:b.raw.length,separatorHash:hash(b.separator),separatorLength:b.separator.length,origin:b.origin}))};
}
export function snapshot(raw,record,sourceKey){
 if(record?.schema!=='ar-create.bound-draft-correspondence.v1'||record.sourceKey!==sourceKey||record.fileHash!==hash(raw))throw Error('External DEV divergence or correspondence identity changed; explicit rebind required. Native pending operations must be preserved.');
 if(!Number.isSafeInteger(record.prefixLength)||record.prefixLength<0||!Array.isArray(record.blocks))throw Error('Correspondence metadata damaged; explicit rebind required.');
 let offset=record.prefixLength;const s={schema:'mag-dev-correspondence.v1',sourceKey,fileHash:record.fileHash,prefix:raw.slice(0,offset),blocks:[]};
 if(record.prefixHash!==hash(s.prefix))throw Error('Correspondence prefix damaged; explicit rebind required.');
 const ids=new Set();
 for(const old of record.blocks){
  if(typeof old.id!=='string'||!old.id||ids.has(old.id)||!Number.isSafeInteger(old.rawLength)||old.rawLength<0||!Number.isSafeInteger(old.separatorLength)||old.separatorLength<0)throw Error('Correspondence metadata damaged; explicit rebind required.');
  const body=raw.slice(offset,offset+old.rawLength);offset+=old.rawLength;const separator=raw.slice(offset,offset+old.separatorLength);offset+=old.separatorLength;
  if(hash(body)!==old.blockHash||hash(separator)!==old.separatorHash)throw Error('Correspondence metadata damaged; explicit rebind required.');ids.add(old.id);s.blocks.push({id:old.id,raw:body,separator,origin:old.origin});
 }
 if(offset!==raw.length||render(s)!==raw)throw Error('Correspondence roundtrip changed original bytes.');return s;
}
