import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { livestoreDevtoolsPlugin } from '@livestore/devtools-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    viteTsConfigPaths(),
    livestoreDevtoolsPlugin({ schemaPath: '../../packages/shared/src/livestore-schema.ts' }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg'],
      manifest: {
        name: 'Ordo - Task Management',
        short_name: 'Ordo',
        description: 'Your personal task management app',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: '/apple-touch-icon.svg',
            sizes: '180x180',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB — covers large wasm + js chunks
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(api|rpc|sync)\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['@tanstack/react-router', '@tanstack/react-query'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit'],
          'vendor-ui': ['@base-ui/react', 'lucide-react', '@hugeicons/react'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-ai': ['ai', '@ai-sdk/react'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@livestore/wa-sqlite'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/rpc': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/sync': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/openapi.json': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/docs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
