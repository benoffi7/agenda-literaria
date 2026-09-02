import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { infoVersion } from './scripts/version.mjs';
/*
 * El dominio se **importa**, no se escribe — B-109 (D-165).
 *
 * `SITIO` es la única aparición del dominio en el repo: de ahí salen el
 * `canonical`, el Open Graph, el sitemap y las URLs del JSON-LD. Copiarlo acá
 * como literal sería un cuarto lugar donde puede quedar viejo, y el peor de
 * todos: `site` es lo que Astro usa para resolver el resto.
 *
 * La extensión `.ts` va explícita porque este archivo es `.mjs` y lo carga Vite,
 * que resuelve TypeScript sin problema (verificado con `astro sync`).
 */
import { SITIO } from './src/lib/rutasPublicas.ts';

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
  // B-109 — el origen canónico. Sin esto no hay URL absoluta que poner en el
  // canonical, en el Open Graph ni en el sitemap, y era el bloqueo de la cadena.
  site: SITIO,
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

        /*
         * `@historial` es lo mismo para la lógica del historial de versiones
         * (§12): el panel necesita comparar una versión guardada contra el
         * documento actual, y esa comparación es la misma que decide si se
         * guarda una versión. Duplicarla habría creado dos ideas distintas de
         * "qué campos escribe la máquina" (`calendarEventId`, `updatedAt`),
         * que es justo el acuerdo que D-41 evita mantener a mano.
         *
         * Tampoco importa Firebase, así que Vite la bundlea igual que la otra.
         */
        '@historial': fileURLToPath(new URL('./functions/historial.js', import.meta.url)),
      },
    },
    // Guarda de §5.4: firebase-admin no puede terminar en un bundle de cliente.
    ssr: { external: ['firebase-admin'] },
  },
});
