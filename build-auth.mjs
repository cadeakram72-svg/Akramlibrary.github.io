import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:root,sourcefile:'supabase-client-entry.js'},outfile:process.env.AKRAM_AUTH_OUTPUT||'../akram-upload-ready/supabase-client.js',bundle:true,format:'esm',platform:'browser',target:['es2020'],minify:true,legalComments:'eof'});
