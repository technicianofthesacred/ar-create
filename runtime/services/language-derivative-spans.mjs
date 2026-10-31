import {mapper as audienceMapper} from './native-output-helpers.mjs';
import {inlineMap} from './draft-correspondence.mjs';
import {digest} from './files.mjs';
/** Exact donor byte ranges for reader prose. Audience owns classification;
 * native notes, layout directives and term identities remain outside ranges. */
export function languageDerivativeSpans(snapshot,scope){
 const audience=audienceMapper.capture(snapshot,{projectId:scope.bindingId,documentId:scope.documentId||scope.bindingId,outputId:scope.outputId});
 return snapshot.projection.map(row=>{
  const classified=audience.privateSidecar.mapping.find(m=>m.nativeId===row.id),disposition=classified?.disposition;
  if(disposition!=='immutable-output-passage')return {id:row.id,disposition,map:null};
  const hidden=classified.hidden||[],characters=[],offsets=[];
  for(let i=0;i<row.raw.length;i++){if(hidden.some(h=>i>=h.from&&i<h.to))continue;characters.push(row.raw[i]);offsets.push(i);}
  let raw=characters.join(''),start=raw.length-raw.trimStart().length,end=raw.trimEnd().length;raw=raw.slice(start,end);const positions=offsets.slice(start,end),mapped=inlineMap(raw);
  if(!mapped.safe||!['paragraph','heading','blockquote'].includes(mapped.blockKind)||mapped.reworks.length)return {id:row.id,disposition,map:null};
  const runs=[];for(const r of mapped.runs){if(r.to<=r.from)continue;const next={...r,rawFrom:positions[r.rawFrom],rawTo:positions[r.rawTo-1]+1},last=runs.at(-1);if(!next.locked&&last&&!last.locked&&last.to===next.from&&last.rawTo===next.rawFrom){last.to=next.to;last.rawTo=next.rawTo;}else runs.push(next);}
  // Every editable raw run must remain exactly contiguous and literal; a hidden
  // note inside a run cannot silently be consumed by a derivative replacement.
  const safe=runs.every(r=>r.locked||row.raw.slice(r.rawFrom,r.rawTo)===mapped.words.slice(r.from,r.to));
  return {id:row.id,disposition,map:safe?{...mapped,runs}:null,rawHash:digest(row.raw)};
 });
}
