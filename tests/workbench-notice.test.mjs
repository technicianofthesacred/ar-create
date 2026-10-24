import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const css=['workspace-navigation.css','surface-bar.css','tree.css'].map(name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8')).join('\n');
test('the maintained current-work error remains visible when the obsolete toolbar is hidden',()=>{
 const dom=new JSDOM('<style>'+css+'</style><body class="c3-bar-on"><div id="app"><main class="workspace"><section id="work-context"><div class="wn-identity">Old identity</div><div class="wn-actions"><button>Old control</button></div><p id="wn-message" role="status" hidden></p></section><section class="c3-empty">No outputs made yet</section></main></div></body>');
 const {window:w}=dom,doc=w.document,host=doc.querySelector('#work-context'),message=doc.querySelector('#wn-message');
 assert.equal(w.getComputedStyle(host).display,'none');
 message.textContent='The selected manuscript connection needs attention.';message.hidden=false;
 assert.notEqual(w.getComputedStyle(host).display,'none');
 assert.equal(w.getComputedStyle(doc.querySelector('.wn-actions')).display,'none');
 assert.equal(w.getComputedStyle(doc.querySelector('.wn-identity')).display,'none');
 assert.equal(doc.querySelector('#wn-message'),message);
 message.hidden=true;assert.equal(w.getComputedStyle(host).display,'none');dom.window.close();
});
