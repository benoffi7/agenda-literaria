import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Sitio estático (SSG) — SEO real es requisito (§2.3).
export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        /*
         * `@calendario` es la lógica pura del evento de Calendar, compartida
         * entre la Cloud Function y la vista previa del panel. Vive en
         * `functions/` porque la Function es su consumidora principal, y no
         * importa Firebase ni googleapis, así que Vite la puede bundlear.
         *
         * Es un alias a un archivo y no a `functions/*`: un comodín invitaría a
         * importar `functions/index.js` desde el cliente, y eso arrastra
         * firebase-admin al bundle (trampa 4, §5.4).
         */
        '@calendario': fileURLToPath(new URL('./functions/calendario.js', import.meta.url)),
      },
    },
    // Guarda de §5.4: firebase-admin no puede terminar en un bundle de cliente.
    ssr: { external: ['firebase-admin'] },
  },
});
