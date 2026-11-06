import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');

test('workspace heading defaults leave saved Article typography to its export renderer',()=>{
 const css=fs.readFileSync(new URL('../public/document-study/c3-theme.css',import.meta.url),'utf8');
 const dom=new JSDOM('<style>'+css+'</style><body class="c3-tabs"><main id="app"><section class="workspace"><div class="oo-stage"><h2 id="tool">Output tools</h2><div class="ar-output-reader"><div class="ar-recorded-prose"><h2 id="article">Saved section heading</h2><h3 id="subsection">Saved subsection</h3></div></div></div></section></main></body>');
 try{
  const d=dom.window.document,rules=[...d.styleSheets[0].cssRules].filter(rule=>rule.selectorText&&rule.style?.getPropertyPriority('font')==='important');
  assert.ok(rules.some(rule=>d.querySelector('#tool').matches(rule.selectorText)),'workspace tools retain compact UI typography');
  for(const id of ['article','subsection'])assert.deepEqual(rules.filter(rule=>d.querySelector('#'+id).matches(rule.selectorText)).map(rule=>rule.selectorText),[],'saved Article layout keeps its own typography in the app, as in the exported file');
 }finally{dom.window.close();}
});
