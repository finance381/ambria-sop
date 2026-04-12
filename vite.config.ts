import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ambria Kitchen SOP',
        short_name: 'Ambria SOP',
        description: 'Kitchen SOP & Compliance System',
        theme_color: '#1e3a5f',
        background_color: '#f8f7f4',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/sop-pdfs\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sop-pdfs',
              expiration: { maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  base: '/ambria-sop/',
})