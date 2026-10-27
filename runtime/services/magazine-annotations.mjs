// Supplemental AR Create annotations only. The maintained Magazine parser still
// owns every story word/layout; these notes live in the same canonical DEV bytes.
const PHOTO='%%ar-create-photo:',CREDITS='%%ar-create-credits:';
function fail(message){throw Object.assign(new Error(message),{status:409});}
const plain=(s,max)=>typeof s==='string'&&s.isWellFormed()&&s.length<=max&&s===s.trim()&&!/[\x00-\x1f\x7f]/.test(s);
export function validatePhotoAnnotation(value){
 if(value===null)return null;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'caption')||!Object.hasOwn(value,'credit')||!plain(value.caption,4000)||!plain(value.credit,1000))fail('Use one plain caption and photo credit without outer spaces.');
 return {caption:value.caption,credit:value.credit};
}
export function validateArticleCredits(value){
 if(value===null)return null;
 if(!Array.isArray(value)||value.length>24||!value.every(s=>plain(s,1000)&&s.length>0))fail('Use up to 24 nonempty plain credit lines, an empty list, or remove the override.');
 return [...value];
}
const encode=value=>JSON.stringify(value).replaceAll('%','\\u0025');
function decode(text,validate){let value;try{value=JSON.parse(text);}catch{fail('Malformed canonical AR Create annotation.');}return validate(value);}
export function splitPhotoAnnotation(raw){
 if(typeof raw!=='string')fail('The exact photo block is unavailable.');
 if(!raw.includes(PHOTO))return {base:raw,annotation:null,suffix:''};
 const m=/^(\s*%%(?:photo|photos):[^\r\n]*?%%[ \t]*)(\r?\n)%%ar-create-photo: ([^\r\n]*)%%([ \t]*)$/.exec(raw);
 if(!m||m[1].includes(PHOTO)||m[3].includes('%%')||raw.split(PHOTO).length!==2)fail('Malformed or duplicate canonical photo annotation.');
 const annotation=decode(m[3],validatePhotoAnnotation);if(annotation===null)fail('A canonical photo annotation must contain caption and credit.');
 return {base:m[1],annotation,suffix:m[2]+PHOTO+' '+m[3]+'%%'+m[4]};
}
export function writePhotoAnnotation(raw,value,newline='\n'){
 const {base}=splitPhotoAnnotation(raw),annotation=validatePhotoAnnotation(value);
 if(!/^\s*%%(?:photo|photos):[^\r\n]*%%\s*$/.test(base))fail('An exact standalone photo or group directive is required.');
 return annotation===null?base:base+newline+PHOTO+' '+encode(annotation)+'%%';
}
export function readCreditsBlock(raw){
 if(!raw.includes(CREDITS))return undefined;
 const m=/^\s*%%ar-create-credits: ([^\r\n]*)%%\s*$/.exec(raw);
 if(!m||m[1].includes('%%')||raw.split(CREDITS).length!==2)fail('Malformed or duplicate canonical article credits.');
 const credits=decode(m[1],validateArticleCredits);if(credits===null)fail('Remove a credit annotation to restore publication metadata.');return credits;
}
export const writeCreditsBlock=credits=>CREDITS+' '+encode(validateArticleCredits(credits))+'%%';
export function readArticleCredits(body){
 const hits=[...body.matchAll(/%%ar-create-credits:/g)];if(!hits.length)return null;
 if(hits.length!==1)fail('Duplicate canonical article credits.');
 const m=/(?:^|\r?\n[ \t]*\r?\n)([ \t]*%%ar-create-credits: [^\r\n]*%%[ \t]*)(?=\r?\n[ \t]*\r?\n|$)/.exec(body);
 if(!m)fail('Article credits must be a separate canonical annotation block.');
 return readCreditsBlock(m[1]);
}
export function photoDirectiveComplete(raw,origin){const {base}=splitPhotoAnnotation(raw);return origin.directiveEnd-origin.directiveStart===base.trim().length;}
