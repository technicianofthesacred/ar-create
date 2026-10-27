import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {capture,apply,photoInsertionAnchors} from '../runtime/services/draft-correspondence.mjs';
import {magazinePhotoOriginHeader,readMagazinePhotoOriginHeader} from '../runtime/services/magazine-library-photos.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const raw=['---','type: DEV','story: Invented','---','','Reader metadata.','','---','','Required intro.','','%%side: original.png · Existing side%%','','Nested words.','','%%/side%%','','## Existing chapter','','Ordinary chapter paragraph.','','> Protected quotation.','','Ordinary [[term:tea|tea]] words.','','%%ending%%','','Ending words.','','%%saying%%','> "Closing saying."','','Closing words.','','---','','Retained notes.',''].join('\r\n');
const snapshot=()=>{const s=capture(raw,'test-piece');s.blocks.forEach((b,i)=>b.id='block:'+i);return s;};
test('trusted new-photo boundaries include intro and chapter prose, exclude metadata/nested/protected/ending, and preserve all original bytes',()=>{
 const s=snapshot(),anchors=photoInsertionAnchors(s),rows=anchors.map(a=>s.blocks.find(b=>b.id===a.id));assert.deepEqual(rows.map(b=>b.raw),['Required intro.','Ordinary chapter paragraph.']);
 const target=rows[0],op={kind:'photoInsertAsset',id:target.id,seenBlockHash:sha(target.raw),rootId:'a'.repeat(64),sourceId:'12345678-1234-1234-1234-123456789abc',revision:'b'.repeat(64),sourceHash:'c'.repeat(64),description:'An unused photo'},file='library-photo-'+op.sourceHash+'-'+'d'.repeat(64)+'.png',candidate=apply(s,raw,[op],{photoAssets:[{...op,file}]});
 assert.equal(candidate.raw,raw.replace(target.raw,target.raw+'\r\n\r\n%%photo: '+file+' · An unused photo · wide%%'));assert.equal(candidate.snapshot.blocks.filter(b=>!s.blocks.some(old=>old.id===b.id)).length,1);
 for(const row of s.blocks.filter(b=>!anchors.some(a=>a.id===b.id)))assert.throws(()=>apply(s,raw,[{...op,id:row.id,seenBlockHash:sha(row.raw)}],{photoAssets:[{...op,file}]}));
 assert.throws(()=>apply(s,raw+'outside', [op],{photoAssets:[{...op,file}]}),/External/);assert.throws(()=>apply(s,raw,[{...op,seenBlockHash:'0'.repeat(64)}],{photoAssets:[{...op,file}]}));assert.throws(()=>apply(s,raw,[op]),/trusted/);assert.throws(()=>apply(s,raw,[{kind:'insert',id:'new',beforeId:target.id,raw:'%%photo: forged.png · bad · wide%%'}]),/ordinary/);
});
test('optional retained-origin header carries exact bounded identity/hash and rejects forged or mismatched proofs',()=>{
 const retainedOrigin={rootId:'a'.repeat(64),sourceId:'12345678-1234-1234-1234-123456789abc',revision:'b'.repeat(64),sourceHash:'c'.repeat(64)},preview={hash:retainedOrigin.sourceHash,retainedOrigin},header=magazinePhotoOriginHeader(preview);assert.ok(header);assert.deepEqual(readMagazinePhotoOriginHeader(header,preview.hash),retainedOrigin);assert.equal(readMagazinePhotoOriginHeader(null,preview.hash),null);assert.equal(magazinePhotoOriginHeader({hash:preview.hash}),null);assert.equal(magazinePhotoOriginHeader({...preview,hash:'d'.repeat(64)}),null);assert.equal(magazinePhotoOriginHeader({...preview,retainedOrigin:{...retainedOrigin,path:'/private'}}),null);
 for(const invalid of ['!',header+'=',Buffer.from(JSON.stringify({...retainedOrigin,path:'/private'})).toString('base64url'),'x'.repeat(1025)])assert.throws(()=>readMagazinePhotoOriginHeader(invalid,preview.hash),/origin proof/);assert.throws(()=>readMagazinePhotoOriginHeader(header,'d'.repeat(64)),/origin proof/);
});
