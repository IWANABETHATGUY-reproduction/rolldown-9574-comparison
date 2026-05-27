import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.js',
  // input: 'src2/main.js',
  output: {
    dir: 'dist/rolldown',
    format: 'esm',
  },
  treeshake: {
    moduleSideEffects: false,
  },
});
