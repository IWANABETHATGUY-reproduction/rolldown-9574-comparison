import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.js'],
  // entryPoints: ['src2/main.js'],
  outfile: 'dist/esbuild/bundle.js',
  bundle: true,
  format: 'esm',
});
