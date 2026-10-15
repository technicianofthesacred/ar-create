import {recomposeOutput,type Manuscript,type Output} from './document';
export type ArticleRecomposeRecord={savedAt:string;before:Output;afterIdentity:string};
type RecoverableArticle=Output&{recomposeHistory?:ArticleRecomposeRecord[];name?:string};
const MAX_HISTORY=10;
export function articleOutputIdentity(output:Output):string {const {recomposeHistory,...snapshot}=output as RecoverableArticle;return JSON.stringify(snapshot);}
function snapshot(output:Output):Output {const {recomposeHistory,...saved}=structuredClone(output) as RecoverableArticle;return saved;}
function capacity(output:RecoverableArticle){if((output.recomposeHistory?.length||0)>=MAX_HISTORY)throw Error('Ten earlier article copies are retained. Export its archive and create a new output to continue; no saved copy was removed.');}
function commit(doc:Manuscript,previous:RecoverableArticle,updated:Output):Manuscript {
 capacity(previous);const revision=(previous.outputRevision||0)+1;if(!Number.isSafeInteger(revision))throw Error('The article revision cannot advance safely. Existing copies remain intact.');
 const next={...updated,id:previous.id,createdAt:previous.createdAt,outputRevision:revision,...(previous.name!==undefined?{name:previous.name}:{})};
 const history:ArticleRecomposeRecord={savedAt:new Date().toISOString(),before:snapshot(previous),afterIdentity:articleOutputIdentity(next)};
 const result={...doc,outputs:doc.outputs.map(output=>output.id===previous.id?{...next,recomposeHistory:[...(previous.recomposeHistory||[]),history]}:output)};
 if(new TextEncoder().encode(JSON.stringify(result)).length>2*1024*1024)throw Error('This article recovery copy exceeds the document size limit. Export the output archive before making a new article; existing work is intact.');return result;
}
/** Update exactly the selected output; the legacy new-snapshot helper stays unchanged. */
export function recomposeSelectedArticle(doc:Manuscript,id:string):Manuscript {
 const previous=doc.outputs.find(output=>output.id===id) as RecoverableArticle|undefined;if(!previous||previous.kind!=='article')throw Error('Choose an existing article to recompose.');capacity(previous);
 const next={...snapshot(previous),...recomposeOutput(doc,previous)};delete next.wordsReview;delete next.articleVisualMake;delete next.articleVisualHistory;delete next.recomposedFrom;
 if(next.articleCompositionNotice?.includes('Your previous composed output is still available.'))next.articleCompositionNotice=next.articleCompositionNotice.replace('Your previous composed output is still available.','Your previous article is retained in the output archive.');
 return commit(doc,previous,next);
}
/** Exact baseline prevents recovery from replacing output edits made since update. */
export function restorePreviousArticle(doc:Manuscript,id:string):Manuscript {
 const previous=doc.outputs.find(output=>output.id===id) as RecoverableArticle|undefined,last=previous?.recomposeHistory?.at(-1);if(!previous||previous.kind!=='article'||!last)throw Error('No earlier article copy is retained.');
 if(last.afterIdentity!==articleOutputIdentity(previous))throw Error('This article was edited after recomposition. Your edits and earlier copy are retained; export its archive before restoring.');
 if(last.before.id!==id||last.before.kind!=='article')throw Error('The earlier article belongs to another output. Existing work is intact.');
 return commit(doc,previous,structuredClone(last.before));
}
