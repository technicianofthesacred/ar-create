/** Shared URL policy for imported passage links, editor, revision and export. */
export function safePassageHref(value){
 if(typeof value!=='string'||!value||/[\s\\\u0000-\u001f\u007f<>]/u.test(value))return false;
 if(value.startsWith('#'))return true;
 if(value.startsWith('/'))return !value.startsWith('//');
 if(/^https?:/i.test(value)){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname;}catch{return false;}}
 return /^(mailto|tel):[^:]/i.test(value);
}
