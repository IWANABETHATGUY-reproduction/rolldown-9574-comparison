export default {
  input: 'src/main.js',
  // input: 'src2/main.js',
  output: {
    dir: 'dist/rollup',
    format: 'esm',
  },
  treeshake: {
    moduleSideEffects: false,
  },
};
