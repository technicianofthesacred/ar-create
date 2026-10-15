import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build({absWorkingDir:runtime,nodePaths:[path.join(runtime,'node_modules')],entryPoints:['../public/document-study/study-output-entry.ts'],outfile:'public/assets/study-output-canvas.js',bundle:true,format:'esm',target:'es2022',external:['/assets/*','/ig-assets/*'],loader:{'.woff2':'file'},jsx:'automatic',legalComments:'inline'});
