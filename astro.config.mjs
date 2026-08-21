import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Sitio estático (SSG) — SEO real es requisito (§2.3).
export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // Guarda de §5.4: firebase-admin no puede terminar en un bundle de cliente.
    ssr: { external: ['firebase-admin'] },
  },
});
