import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist/webpack'),
    filename: 'bundle.js',
    module: true,
    chunkFormat: 'module',
  },
  experiments: {
    outputModule: true,
  },
  mode: 'production',
  optimization: {
    minimize: false,
  },
};
