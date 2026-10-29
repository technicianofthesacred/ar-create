/** Serialization only: callers retain snapshot, editorial and download authority.
 * Accept maintained renderer markup, never arbitrary user-authored HTML. */
export type StandaloneArticleOptions = {
 title:string; markup:string; imageAssets?:readonly string[];
 readAsset?:typeof fetch; stylesheetUrl?:string; fontStylesheetUrl?:string;
 origin?:string; maxBytes?:number;
};
const DEFAULT_LIMIT=32*1024*1024;
const size=(text:string)=>new TextEncoder().encode(text).byteLength;
const escaped=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const decoded=(text:string)=>text.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#x27;',"'");
const urls=/url\(\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^\s)'"\n]+))\s*\)/gi;
export async function standaloneArticleHtml({title,markup,imageAssets=[],readAsset=fetch,stylesheetUrl='/assets/app.css',fontStylesheetUrl='/assets/fonts/wordforge.css',origin=globalThis.location?.origin,maxBytes=DEFAULT_LIMIT}:StandaloneArticleOptions):Promise<string>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>DEFAULT_LIMIT)throw Error('Choose an export byte limit up to 32 MB.');
 if(!origin||new URL(origin).origin!==origin||!/^https?:/.test(origin))throw Error('A same-origin article asset reader is required.');
 let consumed=size(markup)+size(title);
 const charge=(bytes:number)=>{consumed+=bytes;if(consumed>maxBytes)throw Error('The standalone article exceeds its byte limit.');};
 charge(0);
 const local=(value:string,base=origin+'/')=>{const url=new URL(value,base);if(url.origin!==origin||url.username||url.password||url.hash||!/^https?:$/.test(url.protocol))throw Error('Include only inspected same-origin article assets.');return url;};
 const cache=new Map<string,Promise<string>>();
 const asset=(value:string,kind:'image'|'font',base=origin+'/')=>{
  const url=local(value,base),key=url.href;
  if(!cache.has(key))cache.set(key,(async()=>{
   const response=await readAsset(url);if(!response.ok||response.redirected)throw Error('An article '+kind+' could not be included.');
   const blob=await response.blob();charge(blob.size);
   const mime=blob.type.split(';')[0];
   if(kind==='image'&&!/^image\/(png|jpeg|webp|gif|avif)$/.test(mime))throw Error('An article photograph has an unsupported media type.');
   if(kind==='font'&&!/\.(woff2?|ttf|otf)$/i.test(url.pathname))throw Error('An article font has an unsupported format.');
   const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return 'data:'+(mime||'application/octet-stream')+';base64,'+btoa(binary);
  })());
  return cache.get(key)!;
 };
 const sheet=async(value:string)=>{const url=local(value),response=await readAsset(value);if(!response.ok||response.redirected)throw Error('The article styles could not be included.');let css=await response.text();charge(size(css));
  if(/@import\b|local\s*\(|expression\s*\(|-moz-binding/i.test(css))throw Error('The article styles contain unsupported dependencies.');
  for(const match of [...css.matchAll(urls)]){const value=match[1]??match[2]??match[3];if(value.startsWith('data:'))continue;const embedded=await asset(value,'font',url.href);css=css.replaceAll(match[0],`url("${embedded}")`);}
  // Any unrecognized URL syntax must fail rather than leave an online dependency.
  const remainder=css.replace(urls,(_m,a,b,c)=>(a??b??c).startsWith('data:')?'':_m);if(/url\s*\(/i.test(remainder))throw Error('An article style asset could not be embedded.');return css;
 };
 const css=await sheet(stylesheetUrl)+'\n'+await sheet(fontStylesheetUrl);
 const allowed=new Set(imageAssets.map(value=>local(value).href));
 const embedded=new Map<string,string>();for(const value of allowed)embedded.set(value,await asset(value,'image'));
 // Maintained React markup uses quoted attributes. Refuse other resource forms.
 if(/<(?:script|iframe|object|embed|video|audio|source|base|svg)\b|\bsrcset\s*=|<[^>]*\bon[a-z]+\s*=|url\s*\(|@import\b/i.test(markup))throw Error('The rendered article contains unsupported active assets.');
 markup=markup.replace(/<[^>]+>/g,tag=>tag.replace(/\b(src|href)="([^"]*)"/g,(whole,name,value)=>{
  if(name==='href'&&!/^<link\b/i.test(tag))return whole;
  const data=embedded.get(local(decoded(value)).href);if(!data)throw Error('A rendered photograph was not in the inspected article assets.');return name+'="'+data+'"';
 }));
 // Reject unquoted/single-quoted resource attributes and unembedded image URLs.
 for(const tag of markup.matchAll(/<[^>]+>/g))for(const source of tag[0].matchAll(/(?:^|\s)src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi))if(!/^"data:image\//i.test(source[1]))throw Error('An article image dependency remains unembedded.');
 // Link elements may only be React's image preloads, now embedded like the image.
 for(const link of markup.matchAll(/<link\b[^>]*>/gi))if(!/\bhref="data:image\//i.test(link[0])||! /\brel="preload"/i.test(link[0]))throw Error('The rendered article contains an external dependency.');
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escaped(title)+'</title><style>'+css.replace(/<\/style/gi,'<\\/style')+'\nbody{margin:0;background:#151b18}.ar-output-reader{margin:0 auto}@media print{body{background:white}.ar-output-reader{max-width:none}}</style>'+markup+'</html>';
 if(size(html)>maxBytes)throw Error('The standalone article exceeds its byte limit.');return html;
}
