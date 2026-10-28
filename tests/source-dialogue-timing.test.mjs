import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/document-study/source-dialogue.js',import.meta.url),'utf8');
const {renderSourceGroups}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('supplied first-remark timestamps reach the Source grid without changing speech, groups or stable anchors',()=>{
 const html=renderSourceGroups({id:'s',turns:[{id:'a',speaker:'Visitor',text:'Exact <words>.',timestamp:'00:00:03'},{id:'b',speaker:'Visitor',text:'Next words.',timestamp:'00:00:08'},{id:'c',speaker:'Host',text:'Reply.',timestamp:'00:00:14'}]});
 assert.equal((html.match(/<time /g)||[]).length,2);assert.match(html,/<time datetime="00:00:03"[^>]*>00:00:03<\/time>/);assert.match(html,/<time datetime="00:00:14"[^>]*>00:00:14<\/time>/);assert.doesNotMatch(html,/>00:00:08<\/time>/);assert.match(html,/data-source-session="s" data-source-turn="a">Exact &lt;words&gt;\./);assert.match(html,/data-source-turn="b">Next words\./);
});
test('missing and invalid timing stays absent rather than inferred from another remark',()=>{
 for(const timestamp of [undefined,'','unverified','25:99:99','<script>']){const html=renderSourceGroups({id:'s',turns:[{id:'a',speaker:'Visitor',text:'Untimed.',timestamp},{id:'b',speaker:'Visitor',text:'Later timed.',timestamp:'00:00:08'}]});assert.doesNotMatch(html,/<time /);}
});

test('speaker buttons target only exact first remarks and editorial boundaries remain read-only',()=>{
 const html=renderSourceGroups({id:'source',turns:[{id:'first',speaker:'Speaker <one>',text:'First.'},{id:'second',speaker:'Speaker <one>',text:'Second.'},{id:'editorial-x',kind:'editorial',speaker:'Editor',text:'A boundary.'}]});assert.match(html,/<button[^>]*data-source-speaker-turn="first"/);assert.doesNotMatch(html,/data-source-speaker-turn="second"|data-source-speaker-turn="editorial-x"/);assert.match(html,/Speaker &lt;one&gt;/);assert.equal((html.match(/class="source-remark"/g)||[]).length,3);
});
