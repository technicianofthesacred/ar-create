import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(runtime,'package.json'));
const {build}=require('esbuild');
for(const [input,output] of [['services/native-output-helpers.ts','services/native-output-helpers.mjs'],['services/native-output-owner.test.ts','services/native-output-owner.test.mjs'],['services/render-helper.ts','services/render-helper.mjs']]){
 await build({absWorkingDir:runtime,entryPoints:[path.join(runtime,input)],outfile:path.join(runtime,output),bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'warning'});
}
