import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/main.js',
  output: {
    dir: 'dist/rolldown',
    format: 'esm',
  },
  treeshake: {
    moduleSideEffects: false,
  },
});
