import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  // Client bundle build: npm run build:client
  if (mode === 'client') {
    return {
      build: {
        outDir: 'public/static',
        lib: {
          entry: 'src/app.ts',
          name: 'MindApp',
          fileName: 'app',
          formats: ['es']
        },
        rollupOptions: {
          external: [],
          output: {
            entryFileNames: 'app.js',
            chunkFileNames: '[name]-[hash].js',
            assetFileNames: '[name].[ext]'
          }
        },
        emptyOutDir: false,
        minify: true
      }
    }
  }

  // Worker build (default)
  return {
    plugins: [
      build(),
      devServer({
        adapter,
        entry: 'src/index.tsx'
      })
    ]
  }
})
