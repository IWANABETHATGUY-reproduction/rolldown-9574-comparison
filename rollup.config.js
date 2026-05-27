export default {
  input: 'src/main.js',
  output: {
    dir: 'dist/rollup',
    format: 'esm',
  },
  treeshake: {
    moduleSideEffects: false,
  },
};
