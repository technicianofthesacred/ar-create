// The style page: theme switch, the side index, and the pressed state of the demo controls.
(function(){
 var root=document.documentElement;
 function setTheme(t){root.setAttribute('data-theme',t);try{localStorage.setItem('ui-theme',t)}catch(e){}
  document.querySelectorAll('[data-theme-set]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.themeSet===t))})}
 var saved=null;try{saved=localStorage.getItem('ui-theme')}catch(e){}
 var q=new URLSearchParams(location.search).get('theme');
 setTheme(q||saved||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
 document.querySelectorAll('[data-theme-set]').forEach(function(b){b.onclick=function(){setTheme(b.dataset.themeSet)}});

 var idx=document.getElementById('sg-index');
 var secs=[].slice.call(document.querySelectorAll('.sg-sec'));
 secs.forEach(function(s){var li=document.createElement('li'),a=document.createElement('a');a.href='#'+s.id;a.textContent=s.dataset.name;li.appendChild(a);idx.appendChild(li)});
 var links=[].slice.call(idx.querySelectorAll('a'));
 function mark(){var cur=secs[0];secs.forEach(function(s){if(s.getBoundingClientRect().top<=120)cur=s});if(innerHeight+scrollY>=document.documentElement.scrollHeight-2)cur=secs[secs.length-1];links.forEach(function(a){a.toggleAttribute('aria-current',a.hash==='#'+cur.id)})}
 addEventListener('scroll',mark,{passive:true});mark();

 document.querySelectorAll('[data-pick]').forEach(function(g){var attr=g.dataset.pick;g.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){g.querySelectorAll('button').forEach(function(o){o.setAttribute(attr,String(o===b))})})})});
 document.querySelectorAll('[data-flip]').forEach(function(b){b.onclick=function(){b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'))}});
 var ind=document.getElementById('sg-ind');if(ind)ind.indeterminate=true;
})();
