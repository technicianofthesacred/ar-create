import test from 'node:test';import assert from 'node:assert/strict';
import {decorateOutputExports} from '../runtime/server.mjs';
test('native export HTTP decoration scopes fresh and already-scoped saved files exactly once',()=>{
 const scope={rootBindingId:'root',parentStudyId:'parent',selectedOutputId:'carousel'},query=new URLSearchParams(scope),file='/api/carousel/exports/export/file/slide-01.png',result={artifact:{url:'/api/exports/article/file'},export:{files:[{url:file}]},exports:[{files:[{url:file+'?'+query}]}],artifacts:[{url:'/api/exports/article/file?download=1&selectedOutputId=old&selectedOutputId=duplicate'}]};
 const before=structuredClone(result),decorated=decorateOutputExports(result,scope);assert.deepEqual(result,before);assert.deepEqual(decorateOutputExports(decorated,scope),decorated);
 for(const value of [decorated.artifact,decorated.export.files[0],decorated.exports[0].files[0],decorated.artifacts[0]]){const url=new URL(value.url,'http://local.invalid');for(const [key,entry]of Object.entries(scope))assert.deepEqual(url.searchParams.getAll(key),[entry]);assert.equal(value.url.split('?').length,2);}
 assert.equal(new URL(decorated.artifacts[0].url,'http://local.invalid').searchParams.get('download'),'1');
});
