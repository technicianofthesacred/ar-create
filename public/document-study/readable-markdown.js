/* Safe semantic reading of the same Markdown. No document, claim or source is rewritten. */
(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Parse escaped text once so generated markup and code-span contents stay literal.
 const inline=s=>esc(s).replace(/`([^`\n]+)`|\[\[term:([^|\]\n]+)\|([^\]\n]+)\]\]|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(?<![\p{L}\p{N}_])__(?=[^\s_\n])([^\n]+?)(?<![\s_])__(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])_(?!_)(?=[^\s_\n])([^\n]+?)(?<![\s_])_(?![\p{L}\p{N}_])|\[([^\]\n]+)\]\(([^)\s]+)\)/gu,(_,code,term,alias,bold,em,underBold,underEm,label,url)=>{
  if(code!==undefined)return '<code>'+code+'</code>';
  if(term!==undefined)return alias;
  if(bold!==undefined||underBold!==undefined)return '<strong>'+(bold??underBold)+'</strong>';
  if(em!==undefined||underEm!==undefined)return '<em>'+(em??underEm)+'</em>';
  return /^(?:https?:\/\/|mailto:|#|\/(?!\/))/i.test(url)?'<a href="'+url+'" rel="noopener noreferrer">'+label+'</a>':label+' ('+url+')';
 });
 function render(body){
  const lines=String(body??'').replace(/\r\n?/g,'\n').split('\n');let html='',paragraph=[],list=null,code=null,quote=null;
  const para=()=>{if(paragraph.length){html+='<p>'+inline(paragraph.join('\n')).replace(/\n/g,'<br>')+'</p>';paragraph=[];}};
  const closeQuote=()=>{if(quote!==null){html+='<blockquote><p>'+inline(quote.join('\n')).replace(/\n/g,'<br>')+'</p></blockquote>';quote=null;}};
  const closeList=()=>{if(list){html+='<'+list.tag+(list.tag==='ol'?' start="'+list.start+'"':'')+'>'+list.items.map(item=>'<li'+(list.tag==='ol'?' value="'+item.number+'"':'')+'>'+inline(item.text).replace(/\n/g,'<br>')+'</li>').join('')+'</'+list.tag+'>';list=null;}};
  for(const line of lines){
   if(code!==null){if(/^\s*```/.test(line)){html+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';code=null;}else code.push(line);continue;}
   if(/^\s*```/.test(line)){para();closeList();closeQuote();code=[];continue;}
   const quoted=line.match(/^ {0,3}>[ \t]?(.*)$/);if(quoted){para();closeList();quote||=[];quote.push(quoted[1]);continue;}
   closeQuote();
   if(!line.trim()){para();closeList();continue;}
   const heading=line.match(/^(#{1,6})\s+(.+?)\s*#*$/);if(heading){para();closeList();const level=Math.min(3,heading[1].length);html+='<h'+level+'>'+inline(heading[2])+'</h'+level+'>';continue;}
   const item=line.match(/^\s*(?:(\d+)[.)]|([-*+]))\s+(.+)$/);if(item){para();const tag=item[1]?'ol':'ul';if(list&&list.tag!==tag)closeList();list||={tag,start:Number(item[1])||1,items:[]};list.items.push({number:Number(item[1])||1,text:item[3]});continue;}
   if(list&&/^\s{2,}\S/.test(line)){list.items[list.items.length-1].text+='\n'+line.trimStart();continue;}
   closeList();paragraph.push(line);
  }
  para();closeList();closeQuote();if(code!==null)html+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';return html;
 }
 window.studyReadableMarkdown=Object.freeze({render});
})();
