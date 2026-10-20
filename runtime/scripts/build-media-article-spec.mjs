// Build the read-only Media projection from the same maintained article renderer specification.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const runtime=fileURLToPath(new URL('../',import.meta.url));
await build({entryPoints:[runtime+'src/workspaces/compositionSpec.ts'],bundle:true,platform:'node',format:'esm',minify:true,outfile:runtime+'services/media-article-spec.mjs',logLevel:'silent'});
