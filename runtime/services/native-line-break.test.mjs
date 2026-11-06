import test from 'node:test';
import assert from 'node:assert/strict';
import {capture,projection,apply,render,undo} from './draft-correspondence.mjs';

const edit=(row,from,to,insert,kind='lineBreakText')=>({kind,id:row.id,from,to,insert,seenBlockHash:row.blockHash});
for(const newline of ['\n','\r\n'])test('explicit paragraph line break preserves '+JSON.stringify(newline)+' bytes, identity and exact saved Undo',()=>{
 const raw='A paragraph.'+newline+newline+'Unchanged tail.'+newline,snapshot=capture(raw,'invented'),row=projection(snapshot)[0];
 const changed=apply(snapshot,raw,[edit(row,row.words.length,row.words.length,'\nA second line.')]);
 assert.equal(changed.raw,'A paragraph.'+newline+'A second line.'+newline+newline+'Unchanged tail.'+newline);
 const rows=projection(changed.snapshot);assert.equal(rows.length,2);assert.equal(rows[0].id,row.id);assert.equal(rows[0].safe,true);assert.equal(rows[0].words,'A paragraph.\nA second line.');assert.equal(rows[0].doc.content[0].content[1].type,'hardBreak');
 const joined=apply(changed.snapshot,changed.raw,[edit(rows[0],12,13,' ')]);assert.equal(projection(joined.snapshot)[0].words,'A paragraph. A second line.');
 assert.equal(undo(changed.snapshot,changed.raw,changed.inverse).raw,raw);assert.equal(render(snapshot),raw);
});
test('line-break editing keeps ordinary text restrictions and refuses topology, markup, stale proof and locked spans',()=>{
 const raw='Ordinary paragraph.\n\nUnchanged tail.',snapshot=capture(raw,'invented'),row=projection(snapshot)[0];
 for(const operation of [edit(row,8,8,'\n\nNew block.'),edit(row,8,8,'\n# New heading'),edit(row,8,8,'\n- New list'),edit(row,8,8,'\n<b>HTML</b>'),edit(row,8,8,'\n%%note%%'),edit(row,8,8,'\r\nNew line'),edit(row,8,8,'just text'),edit(row,8,8,'\nNew line','text'),{...edit(row,8,8,'\nNew line'),seenBlockHash:'0'.repeat(64)}]){assert.throws(()=>apply(snapshot,raw,[operation]));assert.equal(render(snapshot),raw);}
 const marked='Before [[term:tea|tea]] after.',locked=capture(marked,'invented'),lr=projection(locked)[0];assert.throws(()=>apply(locked,marked,[edit(lr,8,8,'\nNew line')]));assert.equal(render(locked),marked);
 const pending='Before ==exact phrase== after.',held=capture(pending,'invented'),hr=projection(held)[0];assert.throws(()=>apply(held,pending,[edit(hr,9,9,'\nNew line')]));assert.equal(render(held),pending);
});
