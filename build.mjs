import {build} from 'esbuild';import {execFileSync} from 'node:child_process';import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const out=process.env.AKRAM_OUTPUT_DIR||'../akram-upload-ready';mkdirSync(out,{recursive:true});
await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,target:['es2020'],outfile:out+'/storefront.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
execFileSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-c','tailwind.config.cjs','-i','src/styles.css','-o',out+'/storefront.css','--minify']);
console.log('Built storefront.js and storefront.css');
