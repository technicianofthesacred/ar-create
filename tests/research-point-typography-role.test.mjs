import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const source=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');

test('the maintained Research point gives ordinary findings sans body typography and quoted speech its Lora role',()=>{
 const dom=new JSDOM('<div id="app"><main id="workspace" class="workspace wb-research"><div class="rpd"></div></main></div>',{runScripts:'outside-only'}),w=dom.window;
 w.document.body.classList.add('wbf-on');
 w.current=()=>({viewedStage:0});
 w.eval(source('research-standard.js'));
 w.document.querySelector('.rpd').innerHTML=w.ResearchStandard.pointHTML({id:'point',title:'Invented point',spoken:[{speaker:'Invented speaker',quote:'Exact invented speech',location:'00:01'}],clarity:{supported:'A useful explanation.',uncertain:'A qualified limit.',storyImplication:'An optional editorial implication.'}});
 w.eval(source('shared-prose-surfaces.js'));
 w.SharedProseSurfaces.decorate();
 const prose=w.document.querySelector('.research-standard-row:not(.research-standard-said) p.shared-prose-block'),speech=w.document.querySelector('.research-standard-said blockquote.shared-prose-block');
 assert.ok(prose,'the real point renderer marks its explanation as prose');
 assert.ok(speech,'the real point renderer marks its exact quotation as speech');
 const sheet=w.document.createElement('style');sheet.textContent=source('workbench-develop-match.css');w.document.head.append(sheet);
 const location=w.document.querySelector('.research-standard-location');
 assert.ok([...sheet.sheet.cssRules].some(rule=>rule.selectorText&&location.matches(rule.selectorText)&&/^var\(--(t-label|size-detail|size-label)\)$/.test(rule.style?.getPropertyValue('font-size'))),'source attribution retains the compact label role');
 const legacy=[...sheet.sheet.cssRules].filter(rule=>rule.selectorText?.includes('.rpd')&&rule.style?.getPropertyValue('font-family')?.includes('shared-prose-font'));
 assert.equal(legacy.some(rule=>prose.matches(rule.selectorText)),false,'ordinary point explanations must not inherit the superseded Atlas exception');
 assert.ok([...sheet.sheet.cssRules].some(rule=>rule.selectorText&&prose.matches(rule.selectorText)&&/^var\(--(t-body|size-body)\)$/.test(rule.style?.getPropertyValue('font-size'))&&/^(1\.5|var\(--lh-ui\))$/.test(rule.style?.getPropertyValue('line-height'))),'point explanations explicitly use the approved body role, not the long-guide reading role');
 assert.ok([...sheet.sheet.cssRules].some(rule=>rule.selectorText&&speech.matches(rule.selectorText)&&rule.style?.getPropertyValue('line-height').includes('--lh-read')),'speech keeps the approved reading rhythm');
 const speechSheet=w.document.createElement('style');speechSheet.textContent=source('workbench-frame.css');w.document.head.append(speechSheet);
 assert.ok([...speechSheet.sheet.cssRules].some(rule=>rule.selectorText?.includes('.research-standard-said blockquote')&&speech.matches(rule.selectorText)&&rule.style?.getPropertyValue('font-family')?.includes('Workbench Lora')),'quoted speech retains its explicit Lora role');
 w.dispatchEvent(new w.Event('pagehide'));dom.window.close();
});
