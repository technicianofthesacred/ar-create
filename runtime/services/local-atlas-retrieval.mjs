// Read only the explicitly configured existing Tea Atlas format-1 export.
// No discovery, authentication changes, network, model, index writes or copies.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const text=value=>typeof value==='string'&&value.isWellFormed();
const id=value=>typeof value==='string'&&ID.test(value)&&!value.includes('..');
export function createLocalAtlasRetrieval({root,maxArticles=2000,maxTotalBytes=32*1024*1024,maxArticleBytes=512*1024,maxManifestBytes=8*1024*1024}={}){
 for(const value of [maxArticles,maxTotalBytes,maxArticleBytes,maxManifestBytes])if(!Number.isSafeInteger(value)||value<1)throw TypeError('Use positive bounded local Atlas limits.');
 function directory(){try{if(typeof root!=='string'||!path.isAbsolute(root)||!fs.statSync(root).isDirectory())throw Error();return fs.realpathSync(root);}catch{fail('Local Tea Atlas is not connected to an available permitted export.',503);}}
 function bytes(base,relative,limit){
  let fd;try{
   const full=path.join(base,relative),parent=path.dirname(full),parentStat=fs.lstatSync(parent);if(parentStat.isSymbolicLink()||!parentStat.isDirectory())throw Error();
   const real=fs.realpathSync(full);if(real!==full||!real.startsWith(base+path.sep))throw Error();const stat=fs.lstatSync(full);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>limit)throw Error();
   fd=fs.openSync(full,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const opened=fs.fstatSync(fd);if(!opened.isFile()||opened.ino!==stat.ino||opened.dev!==stat.dev||opened.size>limit)throw Error();
   const value=fs.readFileSync(fd);if(value.length>limit||fs.realpathSync(full)!==full||fs.fstatSync(fd).size!==value.length)throw Error();return value;
  }catch{fail('The permitted local Atlas file is unavailable, oversized or not a regular captured file.',503);}finally{if(fd!==undefined)fs.closeSync(fd);}
 }
 function json(raw){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{fail('The local Atlas package contains unreadable JSON.',503);}}
 function manifest(){
  const base=directory(),raw=bytes(base,'manifest.json',maxManifestBytes),value=json(raw);
  if(value.format!==1||!Array.isArray(value.sources)||!Array.isArray(value.articles)||value.articles.length>10000||!Array.isArray(value.topics))fail('The local Atlas format-1 manifest is unavailable or unsupported.',503);
  const sources=new Map(),issues=new Map(),members=new Map();for(const source of value.sources){if(!id(source.id)||sources.has(source.id)||!text(source.name)||!Array.isArray(source.issues))fail('Atlas source identities are ambiguous.',503);sources.set(source.id,source);for(const issue of source.issues){if(!id(issue.id)||issues.has(issue.id)||!text(issue.label)||!Array.isArray(issue.articles))fail('Atlas issue identities are ambiguous.',503);issues.set(issue.id,{...issue,sourceId:source.id});for(const articleId of issue.articles){if(!id(articleId)||members.has(articleId))fail('Atlas article membership is ambiguous.',503);members.set(articleId,issue.id);}}}
  const articles=new Map();for(const article of value.articles){if(!id(article.id)||articles.has(article.id)||!text(article.title)||!sources.has(article.source)||issues.get(article.issue)?.sourceId!==article.source||members.get(article.id)!==article.issue)fail('Atlas article metadata or identity is invalid.',503);articles.set(article.id,article);}
  if(articles.size!==members.size)fail('Atlas manifest membership is incomplete.',503);
  return {base,hash:digest(raw),articles,sources,issues};
 }
 function article(m,articleId,raw){
  const meta=m.articles.get(articleId);if(!meta)fail('This Atlas article is not in the permitted manifest.',404);
  raw??=bytes(m.base,'articles/'+articleId+'.json',maxArticleBytes);const doc=json(raw);
  if(doc.id!==articleId||doc.source!==meta.source||doc.issue!==meta.issue||doc.title!==meta.title||!Array.isArray(doc.blocks)||doc.blocks.length>10000)fail('Atlas article identity or metadata differs from its manifest.');
  const blocks=[];let page=null,joined='';for(const [blockIndex,b]of doc.blocks.entries()){
   if(!b||!['p','h','aside','page','img'].includes(b.t))fail('Atlas article block structure is unsupported.');
   if(b.t==='page'){if(!Number.isSafeInteger(b.n)||b.n<0)fail('Atlas page locator is invalid.');page=b.n;continue;}if(b.t==='img')continue;
   if(!text(b.v))fail('Atlas paragraph is not readable exact text.');if(blocks.length)joined+='\n\n';const start=joined.length;joined+=b.v;blocks.push({blockIndex,kind:b.t,text:b.v,page,start,end:joined.length});
  }
  const source=m.sources.get(meta.source),issue=m.issues.get(meta.issue);
  return {schema:'ar-create.local-atlas-article.v1',articleId,articleHash:digest(raw),manifestHash:m.hash,metadata:{title:doc.title,author:typeof doc.author==='string'?doc.author:'',pages:typeof doc.pages==='string'?doc.pages:'',sourceId:source.id,source:source.name,credit:source.credit||source.name,issueId:issue.id,issue:issue.label},text:joined,textHash:digest(joined),blocks,role:'reference-not-verified-fact'};
 }
 async function capabilities(){try{const m=manifest();return {available:true,mode:'local-format1',readOnly:true,network:false,modelExecution:false,semanticSearch:false,totalArticles:m.articles.size,limits:{maxArticles,maxTotalBytes,maxArticleBytes},citation:'exact-article-hash-and-original-block-page-offsets',verification:false};}catch{return {available:false,mode:'local-format1',readOnly:true,network:false,modelExecution:false,semanticSearch:false,verification:false,reason:'Local Tea Atlas needs an explicit available permitted format-1 export. No remote access or sign-in was attempted.'};}}
 async function read(input){
  if(!exact(input,['articleId','expectedArticleHash','expectedManifestHash'])||!id(input.articleId)||input.expectedArticleHash!==undefined&&!hash(input.expectedArticleHash)||input.expectedManifestHash!==undefined&&!hash(input.expectedManifestHash))fail('Choose an exact permitted Atlas article and optional saved hashes.',400);
  const m=manifest();if(input.expectedManifestHash&&input.expectedManifestHash!==m.hash)fail('The Atlas manifest changed since this citation.');const doc=article(m,input.articleId);if(input.expectedArticleHash&&input.expectedArticleHash!==doc.articleHash)fail('The Atlas article changed since this citation.');return doc;
 }
 async function passage(input){
  const keys=['articleId','manifestHash','articleHash','blockIndex','start','end','quote','page'];if(!exact(input,keys)||keys.some(key=>!Object.hasOwn(input,key))||!hash(input.manifestHash)||!hash(input.articleHash)||!Number.isSafeInteger(input.blockIndex)||!Number.isSafeInteger(input.start)||!Number.isSafeInteger(input.end)||input.start<0||input.end<=input.start||!text(input.quote)||!input.quote||input.quote.length>12000)fail('Use an exact captured Atlas passage locator.',400);
  const doc=await read({articleId:input.articleId,expectedArticleHash:input.articleHash,expectedManifestHash:input.manifestHash}),block=doc.blocks.find(b=>b.blockIndex===input.blockIndex);if(!block||block.page!==input.page||input.end>block.text.length||block.text.slice(input.start,input.end)!==input.quote)fail('The Atlas passage locator or exact quotation changed.');
  return {schema:'ar-create.local-atlas-passage.v1',...input,metadata:doc.metadata,role:doc.role,verification:false};
 }
 async function search(input){
  if(!exact(input,['query','limit'])||!text(input.query)||input.query.trim().length<1||input.query.length>256||/[\x00-\x1f]/.test(input.query)||input.limit!==undefined&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>20))fail('Search with 1–256 literal characters and at most 20 results.',400);
  const m=manifest(),items=[],limit=input.limit||10,regex=new RegExp(input.query.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'iu');let scanned=0,examined=0,totalBytes=0,limited=false,unavailable=0,matches=0;
  for(const meta of m.articles.values()){
   if(examined>=maxArticles){limited=true;break;}examined++;let raw;try{raw=bytes(m.base,'articles/'+meta.id+'.json',maxArticleBytes);}catch{unavailable++;continue;}
   if(totalBytes+raw.length>maxTotalBytes){limited=true;break;}totalBytes+=raw.length;scanned++;let doc;try{doc=article(m,meta.id,raw);}catch{unavailable++;continue;}
   const matching=doc.blocks.map(block=>({block,match:regex.exec(block.text)})).find(row=>row.match);const metadataMatch=regex.test([doc.metadata.title,doc.metadata.author,doc.metadata.source,doc.metadata.issue].join('\n'));
   if(!matching&&!metadataMatch)continue;const block=matching?.block||doc.blocks.find(b=>b.text.trim());if(!block)continue;const start=matching?Math.max(0,matching.match.index-100):0,end=Math.min(block.text.length,(matching?matching.match.index+matching.match[0].length:0)+180),quote=block.text.slice(start,end);
   matches++;if(items.length<limit)items.push({articleId:doc.articleId,...doc.metadata,match:matching?'literal-source-text':'metadata',locator:{articleId:doc.articleId,manifestHash:doc.manifestHash,articleHash:doc.articleHash,blockIndex:block.blockIndex,start,end,quote,page:block.page},role:doc.role,verification:false});
  }
  if(manifest().hash!==m.hash)fail('Atlas changed during search; repeat against the current manifest.');
  return {schema:'ar-create.local-atlas-search.v1',query:input.query.trim(),items,totalMatches:matches,hasMore:matches>items.length,coverage:{scanned,examined,total:m.articles.size,complete:!limited&&!unavailable,unavailable,bytesRead:totalBytes,...(limited?{reason:'Configured local article or byte limit reached.'}:unavailable?{reason:'Some declared local articles were unavailable or invalid.'}:{})},retrieval:'literal-not-semantic',verification:false};
 }
 return {capabilities,search,read,passage};
}
