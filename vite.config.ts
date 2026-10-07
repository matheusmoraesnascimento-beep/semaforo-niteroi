import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const android = mode === 'android';
  return {
  base: android ? '/' : '/semaforo-niteroi/',
  plugins: [
    react(),
    ...(android ? [] : [VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NitRotas',
        short_name: 'NitRotas',
        lang: 'pt-BR',
        description: 'Protótipo: próximo semáforo e mão da rua via GPS',
        start_url: '/semaforo-niteroi/',
        scope: '/semaforo-niteroi/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    })]),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  };
});
