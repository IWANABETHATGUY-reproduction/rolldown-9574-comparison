import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.js'],
  outfile: 'dist/esbuild/bundle.js',
  bundle: true,
  format: 'esm',
});
