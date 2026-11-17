import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const script=fs.readFileSync(new URL('../public/v3/screens/write-page.js',import.meta.url),'utf8');

test('saved quote ranges escape text, keep quote marks outside dots, and disappear after input invalidation',async()=>{
 const dom=new JSDOM('<main><aside data-wr-src></aside></main>',{url:'http://local.test',runScripts:'outside-only'}),w=dom.window;
 w.v2={shared:{}};
 const st={bindingId:'b',base:{expected:{hash:'h'}},human:true},page=w.document.querySelector('main');let dirty=false;
 w.fetch=async()=>({ok:true,text:async()=>JSON.stringify({expected:{hash:'h'},links:[{id:'q',active:true,paragraph:{id:'p',from:1,to:6,text:'<tea>'}}]})});
 w.eval(script);
 const W={lib:{esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),uuid:()=>'',own:()=>''},st,clk:{},page,ctx:{signal:{aborted:false}},scope:()=>({bindingId:'b',parentStudyId:'s'}),dirty:()=>dirty,$:()=>null};
 const api=w.v2.shared['write-page'](W);
 await api.loadQuoteLinks();
 const row={id:'p',text:'“<tea>”'};
 assert.match(api.quoteHTML(row),/data-quote-link="q"/);
 assert.match(api.quoteHTML(row),/“<span class="wr-source-dots">&lt;tea&gt;<\/span>”/);
 assert.equal(api.quoteHTML(row).includes('<tea>'),false);
 dirty=true;assert.equal(api.quoteHTML(row),'“&lt;tea&gt;”');dirty=false;
 st.base.expected={hash:'new'};assert.equal(api.quoteHTML(row),'“&lt;tea&gt;”','revision drift never renders cached marks');
 await api.loadQuoteLinks();assert.equal(api.quoteHTML(row),'“&lt;tea&gt;”','a response checked against another saved revision cannot mark matching words');
 st.base.expected={hash:'h'};api.invalidateQuotes();assert.equal(api.quoteHTML(row),'“&lt;tea&gt;”');
 dom.window.close();
});
