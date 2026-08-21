import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // El mismo alias que astro.config.mjs y tsconfig.json: la lógica del
      // evento de Calendar se importa de un solo lugar (§7.4).
      '@calendario': fileURLToPath(new URL('./functions/calendario.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Los tests de integración corren contra los emuladores. Config de mentira
    // a propósito: el emulador no valida la API key.
    env: {
      PUBLIC_FIREBASE_PROJECT_ID: 'agenda-literaria',
      PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'agenda-literaria.firebaseapp.com',
      PUBLIC_FIREBASE_APP_ID: '1:1038157194972:web:fake',
      PUBLIC_USE_EMULATORS: 'true',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    },
    // El emulador es estado compartido: los archivos no pueden pisarse entre sí.
    fileParallelism: false,
  },
});
