/* A subject: its forms in order, the steps, one step open. A stub from the shell piece; the Subject piece replaces
   this file and subject.css, and nothing else. */
(function(v2){
 'use strict';
 v2.screen({id:'subject',title:'Subject',route:'subject/:id',
  render:ctx=>`<div class="v2-page" data-v2-stub="subject"><header><h1>Subject</h1></header>${v2.ui.notBuilt('',{advanced:{subject:ctx.params.id}})}</div>`});
})(window.v2);
