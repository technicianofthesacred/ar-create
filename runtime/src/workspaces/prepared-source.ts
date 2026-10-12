/** An owned Library source receipt; it never grants access to an arbitrary URL. */
export type PreparedSource={sourceId:string;hash:string;artifactHash:string;originalUrl:string;requestId:string};
export function preparedSourceReceipt(value:unknown):PreparedSource {
 const v=value as PreparedSource;
 if(!v||typeof v!=='object'||Array.isArray(v)||typeof v.sourceId!=='string'||!v.sourceId||v.sourceId.length>256||typeof v.requestId!=='string'||!v.requestId||!(/^[a-f0-9]{64}$/).test(v.hash)||!(/^[a-f0-9]{64}$/).test(v.artifactHash)||v.originalUrl!=='/api/sources/blob?id='+encodeURIComponent(v.sourceId)+'&original=1')throw new Error('The prepared source receipt is invalid. Reload the draft before accepting it.');
 return {sourceId:v.sourceId,hash:v.hash,artifactHash:v.artifactHash,originalUrl:v.originalUrl,requestId:v.requestId};
}
