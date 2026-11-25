import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import pxToRem from 'postcss-pxtorem';

const sourceDirectory = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  base: './',
  css: {
    postcss: {
      plugins: [pxToRem({
        rootValue: 16,
        propList: ['*'],
        unitPrecision: 8,
        minPixelValue: 0.01, // Preserve typed zero lengths in calc(), min() and max().
        mediaQuery: false,
        exclude: (file) => !file?.startsWith(sourceDirectory),
      })],
    },
  },
  build: {
    manifest: true,
  },
});
