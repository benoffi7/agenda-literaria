import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { infoVersion } from './scripts/version.mjs';

// La versión se estampa una sola vez por build y viaja al bundle como variable
// `PUBLIC_*`, que es el mecanismo que Astro ya usa para la config del cliente.
// Así el JS que corre en el navegador sabe cuál es, y `/version.json` publica
// exactamente la misma: el panel compara una contra otra para detectar que la
// pestaña quedó vieja (ver `src/lib/version.ts`).
const version = infoVersion();
process.env.PUBLIC_VERSION_APP = version.version;
process.env.PUBLIC_VERSION_GENERADO_EN = version.generadoEn;

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
