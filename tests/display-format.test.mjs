import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};vm.runInNewContext(fs.readFileSync(new URL('../public/document-study/display-format.js',import.meta.url),'utf8'),{window});
const display=window.arCreateDisplay;
test('filename display is narrow and never changes chosen metadata titles',()=>{
 assert.equal(display.title({fileName:'NOTES-NASA and tea.md'}),'NASA and tea');
 assert.equal(display.title({fileName:'CONTEXT-NASA and tea.md',title:'CONTEXT-NASA and tea.md'}),'NASA and tea');
 assert.equal(display.title({fileName:'NOTES-NASA.md',title:'NOTES-NASA'}),'NOTES-NASA');
 assert.equal(display.title({fileName:'UNKNOWN-NASA.md'}),'UNKNOWN-NASA');
 assert.equal(display.title({title:'iPhone and NASA / Part II'}),'iPhone and NASA / Part II');
 assert.equal(display.kind('EDITS'),'Editing history');assert.equal(display.kind('NOTES'),'Research notes');
});
test('technical failures use recovery copy; safe human guard instructions survive',()=>{
 for(const error of ['API route was not found','HTTP 500','TypeError: fetch failed','The learning owner is unavailable.','/private/example-author/work.md'])assert.equal(display.error(error,'Sources could not refresh. Try again.'),'Sources could not refresh. Try again.');
 assert.equal(display.error('Save or resolve your current writing before switching.'),'Save or resolve your current writing before switching.');
 assert.match(display.error(Object.assign(Error('internal'),{status:409})),/changed elsewhere/);
});
test('changed original folders explain the connection problem without suggesting a refresh can repair it',()=>{
 for(const message of ['Bound root changed. Rebind explicitly.','Binding roots differ from configuration.','Bound file or directory unavailable.','Symlink or changed directory refused.']){
  const shown=display.error(Object.assign(Error(message),{status:409}));
  assert.match(shown,/original folder connection needs repair/);
  assert.match(shown,/before this work can open/);
  assert.doesNotMatch(shown,/rebind|refresh|symlink|binding/i);
 }
});

test('research record labels distinguish purpose without exposing storage names',()=>{
 assert.equal(display.recordTitle('BRIEF - Invented story.md'),'Research brief · Invented story');
 assert.equal(display.recordTitle('RESEARCH - Invented story.md'),'Research · Invented story');
 assert.equal(display.recordTitle('NOTES - Invented story.md'),'Research notes · Invented story');
 assert.equal(display.recordTitle('Research: Invented story'),'Research: Invented story');
 assert.equal(display.recordTitle('A chosen title'),'A chosen title');
});
