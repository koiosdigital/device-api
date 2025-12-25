import { defineConfig } from 'vite';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2022',
      },
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    ssr: true,
    rollupOptions: {
      input: 'src/index.ts',
      output: {
        format: 'es',
        entryFileNames: '[name].js',
      },
      external: [
        '@prisma/client',
        '@prisma/adapter-pg',
        'ws',
        'redis',
        '@bufbuild/protobuf',
        /^@prisma\//,
      ],
    },
    minify: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      '~': '/src',
    },
    extensions: ['.ts', '.js', '.json'],
  },
});
