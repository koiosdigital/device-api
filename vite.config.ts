import { defineConfig } from 'vite';

export default defineConfig({
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
