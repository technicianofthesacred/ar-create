/* Display only: original references, filenames and revision guards remain authoritative. */
(()=>{
 'use strict';
 const kinds={RAW:'Original source',SRC:'Original source',CONTEXT:'Context',NOTES:'Research notes',RESEARCH:'Research',BRIEF:'Research brief',READ:'Reading notes',MAP:'Direction',PLANS:'Plans',ASK:'Questions',IDEA:'Idea',MOMENTS:'Moments',DEV:'Draft',EDITS:'Editing history',CHECK:'Checks',BLIND:'Independent review',RATINGS:'Review',SENSE:'Review',SOCIAL:'Social post',PHOTO:'Photo',PHOTOS:'Photos',MEDIA:'Media',EXPORT:'Export',FEEDBACK:'Feedback',ISSUE:'Published issue',image:'Photo',video:'Video',audio:'Audio',note:'Note',text:'Text',transcript:'Transcript',pdf:'PDF',file:'File'};
 const filename=row=>String(row.fileName||row.name||row.rel_path||row.relativePath||'').split('/').pop();
 function title(row={},fallback='Untitled source'){
  const file=filename(row),value=String(row.title||file||fallback);
  // A supplied human title is authoritative, even when it resembles an internal prefix.
  if(row.title&&value!==file&&!/\.md$/i.test(value))return value;
  const bare=value.replace(/\.md$/i,'');
  const match=/^([A-Z]+)\s*-\s*(.+)$/.exec(bare);
  return match&&Object.hasOwn(kinds,match[1])?match[2]:bare;
 }
 const kind=value=>kinds[value]||kinds[String(value).toUpperCase()]||'Saved record';
 const recordTitle=value=>{const name=String(value||'Saved record');if(!/\.md$/i.test(name))return name;const prefix=/^([A-Z]+)\s*-\s*/.exec(filename({name})),label=title({name});return prefix&&Object.hasOwn(kinds,prefix[1])?kind(prefix[1])+' · '+label:label;};
 function error(value,fallback='This action could not finish. Try again.'){
  const message=String(value?.message||value||'');
  const status=Number(value?.status);
  if(/Bound root changed|Binding roots differ from configuration|Bound file or directory unavailable|Symlink or changed directory refused/i.test(message))return 'The original folder connection needs repair before this work can open.';
  if(status===409)return 'This work changed elsewhere. Refresh before trying again.';
  if(status===423)return 'This work is being edited. Try again when the current edit finishes.';
  if(status===401||status===403)return 'Access to this work is unavailable. Check its connection before trying again.';
  if(/(?:API|HTTP|route|stack|TypeError|SyntaxError|fetch|network|ECONN|ENOENT|owner|UUID|[a-f0-9]{32,}|\/(?:api|Users|private|home)\/|_[a-z]+_)/i.test(message))return fallback;
  return message||fallback;
 }
 window.arCreateDisplay=Object.freeze({title,kind,error,filename,recordTitle});
})();
