import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { outDir: 'out/main', rollupOptions: { input: resolve('src/main/index.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          pet: resolve('src/preload/pet.ts'),
          settings: resolve('src/preload/settings.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
          // Sandboxed Electron preload cannot require local chunks at runtime,
          // so inline every shared module back into each entry file.
          manualChunks: () => null
        }
      }
    }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          pet: resolve('src/renderer/pet/index.html'),
          settings: resolve('src/renderer/settings/index.html')
        }
      }
    }
  }
});
