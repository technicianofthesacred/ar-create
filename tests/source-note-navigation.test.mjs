import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/source-note-navigation.js',import.meta.url),'utf8');
const scope={module:{exports:{}}};
vm.runInNewContext(code,scope);
const {resolveNote,install}=scope.module.exports;

function fixture(t){
  const dom=new JSDOM('<main><div class="desk"><article id="manuscript" contenteditable="true"><p data-block="one">First <em>invented</em> passage.</p><p data-block="two">Second passage.</p></article><aside id="margin"><div id="originalNotes"></div></aside></div></main>');
  t.after(()=>dom.window.close());
  const document=dom.window.document;
  const project={id:'synthetic-a',rev:7,history:[{label:'Saved exact words',blocks:['one','two']}],blocks:[{id:'one',tag:'p',html:'First <em>invented</em> passage.',source:'sources/a.md'},{id:'two',tag:'p',html:'Second passage.',source:'sources/a.md'}],originalNotes:[{anchor:'one',anchorIndex:0,path:'sources/a.md',text:'First note'},{anchor:'one',anchorIndex:0,path:'sources/a.md',text:'Another note on the same passage'},{anchor:'two',anchorIndex:1,path:'sources/a.md',text:'Second note'}]};
  const records={words:[{path:'sources/a.md',html:'<p>First invented passage.</p><p>Second passage.</p>'}]};
  document.querySelector('#originalNotes').innerHTML=project.originalNotes.map((n,i)=>`<article class="originalNote" data-note-index="${i}"><p>${n.text}</p><button type="button">At this passage</button></article>`).join('');
  let selection=null,current=project,currentRecords=records,mobileCalls=0;
  const scrolls=[];
  for(const node of document.querySelectorAll('[data-block]'))node.scrollIntoView=()=>scrolls.push(node.dataset.block);
  const adapter=install({document,getProject:()=>current,getRecords:()=>currentRecords,getSelection:()=>selection,setSelection:value=>{selection=value;},onMobileSelection:()=>{mobileCalls++;}});
  return {dom,document,project,records,adapter,scrolls,get selection(){return selection;},set selection(value){selection=value;},get mobileCalls(){return mobileCalls;},switchProject(value,record=records){current=value;currentRecords=record;}};
}
function active(document){return [...document.querySelectorAll('#manuscript [data-source-note-active]')];}
function refused(project,note,records,document){const result=resolveNote(project,note,records,document);assert.equal(result.ok,false);assert.equal(typeof result.reason,'string');assert.ok(result.reason.trim());}

test('exact source-index link resolves to the unique current manuscript node',t=>{
  const f=fixture(t),target=f.document.querySelector('[data-block="one"]');
  assert.equal(resolveNote(f.project,f.project.originalNotes[0],f.records,f.document).target,target);
  f.records.words[0].html='<p> First\n invented   passage. </p><p>Second passage.</p>';
  const result=resolveNote(f.project,f.project.originalNotes[0],f.records,f.document);
  assert.equal(result.ok,true);assert.equal(result.target,target);
});

test('missing, invalid, ambiguous and stale record links never fall back to a nearby passage',t=>{
  const f=fixture(t),n=f.project.originalNotes[0];
  for(const note of [{...n,anchor:'missing'},{...n,anchorIndex:-1},{...n,anchorIndex:99},{...n,path:'sources/missing.md'}])refused(f.project,note,f.records,f.document);
  refused(f.project,n,{words:[]},f.document);
  refused(f.project,n,{words:[...f.records.words,...f.records.words]},f.document);
  refused(f.project,n,{words:[{path:n.path,html:'<p>Changed original words.</p>'}]},f.document);
  f.project.blocks[0].source='sources/another.md';refused(f.project,n,f.records,f.document);
});

test('duplicate authoritative or rendered anchors and absent manuscript targets are refused',t=>{
  const f=fixture(t),n=f.project.originalNotes[0];
  f.project.blocks.push({...f.project.blocks[0]});refused(f.project,n,f.records,f.document);f.project.blocks.pop();
  const target=f.document.querySelector('[data-block="one"]');target.after(target.cloneNode(true));
  refused(f.project,n,f.records,f.document);target.remove();
  f.document.querySelector('[data-block="one"]').remove();refused(f.project,n,f.records,f.document);
});

test('native notes use stable authoritative identity and honor an explicit source path',t=>{
  const f=fixture(t),native={anchor:'two',text:'Native note'};
  assert.equal(resolveNote(f.project,native,{words:[]},f.document).ok,true);
  assert.equal(resolveNote(f.project,{...native,path:'sources/a.md'},{words:[]},f.document).ok,true);
  refused(f.project,{...native,path:'sources/other.md'},f.records,f.document);
  f.project.blocks[1].source='Owned working copy · two';
  assert.equal(resolveNote(f.project,{...native,path:'draft/article.md'},{words:[]},f.document).ok,true);
});

test('card and native button select exactly one note, including notes sharing a passage',t=>{
  const f=fixture(t),cards=[...f.document.querySelectorAll('.originalNote')];f.adapter.decorate();
  cards[0].querySelector('p').click();
  assert.equal(active(f.document).length,1);assert.equal(active(f.document)[0].dataset.block,'one');
  assert.equal(cards[0].dataset.sourceNoteSelected,'true');assert.equal(cards[0].querySelector('button').getAttribute('aria-pressed'),'true');
  assert.equal(f.selection.index,0);assert.equal(f.selection.projectId,f.project.id);
  assert.equal(f.selection.anchor,'one');assert.equal(f.selection.path,'sources/a.md');
  cards[1].querySelector('button').click();
  assert.equal(active(f.document).length,1);assert.equal(f.selection.index,1);
  assert.notEqual(cards[0].dataset.sourceNoteSelected,'true');assert.equal(cards[1].dataset.sourceNoteSelected,'true');
  cards[2].click();assert.equal(active(f.document).length,1);assert.equal(active(f.document)[0].dataset.block,'two');
  assert.equal(f.document.querySelectorAll('.originalNote[data-source-note-selected="true"]').length,1);
  assert.ok(f.document.querySelector('.source-note-focus'));assert.ok(f.mobileCalls>0);
});

test('navigation preserves manuscript DOM identity, exact content and all model state',t=>{
  const f=fixture(t),before=JSON.stringify(f.project),manuscript=f.document.querySelector('#manuscript'),nodes=[...manuscript.childNodes],html=manuscript.innerHTML;
  f.adapter.decorate();f.adapter.select(0);f.adapter.select(2);f.adapter.clear();
  assert.equal(JSON.stringify(f.project),before);assert.equal(f.document.querySelector('#manuscript'),manuscript);
  assert.deepEqual([...manuscript.childNodes],nodes);assert.equal(manuscript.innerHTML,html);assert.equal(active(f.document).length,0);
});

test('unavailable note clears the previous target and exposes a visible status without scrolling',t=>{
  const f=fixture(t);f.adapter.decorate();f.adapter.select(0);const count=f.scrolls.length;
  f.project.originalNotes[2].anchor='absent';f.adapter.select(2);
  assert.equal(active(f.document).length,0);assert.equal(f.scrolls.length,count);
  const status=f.document.querySelector('.originalNote[data-note-index="2"] [role="status"]');
  assert.ok(status);assert.ok(status.textContent.trim());assert.equal(status.hidden,false);
  assert.notEqual(status.getAttribute('aria-hidden'),'true');
});

test('decoration remains idempotent and keeps native keyboard activation on the button',t=>{
  const f=fixture(t);f.adapter.decorate();f.adapter.decorate();
  const button=f.document.querySelector('.originalNote button');
  assert.equal(button.tagName,'BUTTON');assert.notEqual(button.getAttribute('role'),'link');assert.equal(button.disabled,false);assert.ok(button.tabIndex>=0);
  // Native Enter/Space produce a click in browsers; jsdom does not implement that default action.
  button.click();assert.equal(f.selection.index,0);assert.equal(f.scrolls.length,1);
  button.click();assert.equal(f.scrolls.length,2);assert.equal(active(f.document).length,1);
});

test('restore is restricted to the exact project, note index, anchor and source link',t=>{
  const f=fixture(t),valid={projectId:f.project.id,index:0,anchor:'one',path:'sources/a.md'};
  f.selection=valid;f.adapter.decorate();assert.equal(active(f.document).length,1);
  for(const stale of [{...valid,projectId:'synthetic-b'},{...valid,index:8},{...valid,anchor:'two'},{...valid,path:'sources/elsewhere.md'}]){
    f.adapter.clear();f.selection=stale;f.adapter.decorate();assert.equal(active(f.document).length,0);
  }
  f.selection=valid;f.switchProject({...f.project,id:'synthetic-b'});f.adapter.decorate();assert.equal(active(f.document).length,0);
  f.switchProject(f.project);f.selection=valid;f.adapter.decorate();assert.equal(active(f.document).length,1);
  f.switchProject(f.project,{words:[{path:'sources/a.md',html:'<p>Stale source.</p>'}]});f.selection=valid;f.adapter.decorate();assert.equal(active(f.document).length,0);
});
