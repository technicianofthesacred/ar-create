/* Research: its home, a group of sources, and a topic. A stub from the shell piece; the Research piece replaces this
   file and research.css, and nothing else. */
(function(v2){
 'use strict';
 const stub=(id,title)=>()=>`<div class="v2-page" data-v2-stub="${id}"><header><h1>${title}</h1></header>${v2.ui.notBuilt('',{advanced:{section:'research'}})}</div>`;
 v2.screen({id:'research',title:'Research',route:'research',render:stub('research','Research')});
 v2.screen({id:'research-group',title:'Research group',route:'research/group/:id',render:stub('research-group','Research group')});
 v2.screen({id:'research-topic',title:'Research topic',route:'research/topic/:id',render:stub('research-topic','Research topic')});
})(window.v2);
