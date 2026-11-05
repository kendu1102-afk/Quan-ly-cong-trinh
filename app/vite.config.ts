import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.webp', 'nen.webp'],
      manifest: {
        name: 'Quản Lý Công Trình',
        short_name: 'QL Công Trình',
        description: 'Quản lý vật tư, chi phí và tài chính công trình',
        lang: 'vi',
        theme_color: '#0a2a66',
        background_color: '#eef3fb',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webp}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { include: ['src/**/*.test.ts'] },
})
