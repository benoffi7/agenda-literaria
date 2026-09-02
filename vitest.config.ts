import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
// B-219 — el projectId del emulador para este working-tree. Se importa y no se
// deriva acá: el gate (`scripts/verificar-todo.sh`) necesita el mismo valor
// desde bash, y dos derivaciones del mismo dato es la clase de bug de B-88.
import { PROJECT_ID_EMULADOR } from './scripts/project-id-emulador.mjs';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // El mismo alias que astro.config.mjs y tsconfig.json: la lógica del
      // evento de Calendar se importa de un solo lugar (§7.4).
      '@calendario': fileURLToPath(new URL('./functions/calendario.js', import.meta.url)),
      '@historial': fileURLToPath(new URL('./functions/historial.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Los tests de integración corren contra los emuladores. Config de mentira
    // a propósito: el emulador no valida la API key.
    env: {
      /*
       * B-219 — un `projectId` por working-tree, no el del proyecto real.
       *
       * El emulador escucha en un puerto de la máquina y le pega cualquier
       * checkout, así que con varios worktreees trabajando en paralelo el
       * `limpiarFirestore()` de uno vaciaba la base del otro a mitad de un
       * `it`. Particionado por proyecto, cada checkout borra, siembra y carga
       * reglas **solo en su base**.
       *
       * Va por acá y no por archivo de test porque el panel arma su app de
       * Firebase con `import.meta.env.PUBLIC_FIREBASE_PROJECT_ID`
       * (`firebase-client.ts`) y el build con `process.env` del mismo nombre
       * (`firebase-admin.ts`): es el único punto que los alcanza a los dos.
       * Todo lo que hable con el emulador tiene que leer de acá — por eso
       * `tests/emulador.ts` lo re-exporta como `PROJECT_ID` y no lo vuelve a
       * derivar.
       */
      PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID_EMULADOR,
      PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'agenda-literaria.firebaseapp.com',
      PUBLIC_FIREBASE_APP_ID: '1:1038157194972:web:fake',
      PUBLIC_USE_EMULATORS: 'true',
      // Se respeta el valor del entorno si viene: permite apuntar los tests a
      // otro emulador, y sin esto no se puede verificar el guard de
      // EXIGIR_EMULADOR (el config pisaba la variable del shell).
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
    },
    /*
     * El emulador es estado compartido: los archivos no pueden pisarse entre sí.
     *
     * **Sigue haciendo falta después de B-219**, y conviene decir por qué: el
     * `projectId` particiona por *working-tree*, así que los archivos de UNA
     * corrida comparten base entre ellos. Los dos mecanismos cubren mitades
     * distintas —esta bandera, los archivos de una corrida; el projectId, las
     * corridas de dos checkouts— y sacar cualquiera de los dos reabre la mitad
     * que le toca. Eso es exactamente lo que dicen la segunda y la cuarta
     * observación de B-219.
     */
    fileParallelism: false,
  },
});
