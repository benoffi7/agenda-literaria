import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
// B-219 — el projectId del emulador para este working-tree. Se importa y no se
// deriva acá: el gate (`scripts/verificar-todo.sh`) necesita el mismo valor
// desde bash, y dos derivaciones del mismo dato es la clase de bug de B-88.
import { PROJECT_ID_EMULADOR } from './scripts/project-id-emulador.mjs';

/**
 * Los archivos que hablan con el emulador y por eso corren en fila, en el
 * proyecto `integracion` (M-1). Casi todos llevan el sufijo; los dos de abajo
 * no, y llaman a `limpiarFirestore()` igual. Se nombran acá y no se renombran
 * porque otros tests y docs los citan por ruta.
 */
export const INTEGRACION = [
  'tests/**/*.integracion.test.ts',
  'tests/emulador-aislado.test.ts',
  'tests/limpieza-versiones.test.ts',
];

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // El mismo alias que astro.config.mjs y tsconfig.json: la lógica del
      // evento de Calendar se importa de un solo lugar (§7.4).
      '@calendario': fileURLToPath(new URL('./functions/calendario.js', import.meta.url)),
      '@historial': fileURLToPath(new URL('./functions/historial.js', import.meta.url)),
      // B-323 — la lista blanca de chunks PNG seguros, compartida con el
      // panel.
      '@png-chunks-seguros': fileURLToPath(
        new URL('./functions/png-chunks-seguros.js', import.meta.url),
      ),
      // B-869 — la lista blanca de segmentos APPn seguros de un JPEG,
      // compartida con la Function por el mismo motivo.
      '@jpeg-appn-seguros': fileURLToPath(
        new URL('./functions/jpeg-appn-seguros.js', import.meta.url),
      ),
    },
  },
  test: {
    /*
     * La suite en tres proyectos — PRD 6, M-1.
     *
     * Hasta acá toda la suite corría en fila india (`fileParallelism: false`)
     * porque los archivos de integración comparten el emulador, y los otros
     * ~260 pagaban igual la espera: 138-154 s de reloj contra ~30 s en
     * paralelo. Ahora solo va en fila lo que habla con el emulador.
     *
     *  - `unidad` — node, archivos en paralelo. Es casi toda la suite.
     *  - `render` — jsdom, en paralelo (B-08: el único rincón que necesita DOM
     *    de verdad, el cableado de una capa o menú, que un test que lee el
     *    fuente no puede verificar sin arriesgarse a un falso verde como
     *    B-202). Es un proyecto aparte porque el entorno es por proyecto; antes
     *    lo decidía `environmentMatchGlobs`, que vitest 3 marca obsoleto.
     *  - `integracion` — todo lo que limpia, siembra o lee el emulador, en un
     *    solo proceso y de a un archivo (`singleFork`). vitest lo corre
     *    **después** de los otros dos, así que tampoco compite por CPU con el
     *    paralelo (B-1951).
     *
     * `unidad` + `render` son lo que corre el paso de zona horaria del gate
     * (M-2, `--project unidad --project render`): sin emulador, lo de
     * integración se saltearía igual.
     *
     * Qué es integración lo dice `INTEGRACION`, arriba, y no solo el sufijo:
     * dos archivos sin `.integracion` en el nombre también vacían la base. El
     * que un archivo nuevo que usa el emulador quede afuera de la fila lo frena
     * `tests/proyectos-de-la-suite.test.ts`, que verifica además que cada
     * archivo de test caiga en exactamente un proyecto.
     *
     * **Sin `include` ni `exclude` en la raíz**, a propósito: con
     * `extends: true` los arrays de la raíz se **concatenan** con los del
     * proyecto en vez de reemplazarse, y cada proyecto terminaba corriendo la
     * suite entera.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'unidad',
          environment: 'node',
          // El `include` de la suite entera, y cada proyecto se lleva su parte
          // con `exclude`. Se escribe acá, completo, porque lo lee
          // `tests/ayuda.test.ts` (B-1131: los sufijos que la ayuda puede
          // citar son los que corre vitest).
          include: ['tests/**/*.test.ts', 'tests/**/*.render.test.tsx'],
          exclude: [...configDefaults.exclude, 'tests/**/*.render.test.tsx', ...INTEGRACION],
          /*
           * **Sin `testTimeout` propio, a propósito** — B-2121. Se evaluó
           * subirlo a 15 s como red para los barridos del repo bajo la carga
           * del paralelo, y no: de los tres casos que pasaron los 5 s en esta
           * familia, dos eran bugs de verdad (B-2041 y el de `ciudades.test.ts`:
           * un barrido que bajaba a `node_modules`) y el timeout fue lo único
           * que los mostró. Con 15 s habrían quedado verdes y lentos. Además un
           * test colgado de verdad —un `waitFor` o una promesa que no
           * resuelve— tardaría el triple en fallar, en cada archivo que lo
           * tenga. El barrido que es caro **por lo que hace** lleva su límite
           * en el `it`, con el porqué al lado (el de `sin-comentarios.test.ts`).
           */
        },
      },
      {
        extends: true,
        test: {
          name: 'render',
          environment: 'jsdom',
          include: ['tests/**/*.render.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integracion',
          environment: 'node',
          include: INTEGRACION,
          /*
           * El emulador es estado compartido: los archivos no pueden pisarse
           * entre sí.
           *
           * **Sigue haciendo falta después de B-219**, y conviene decir por
           * qué: el `projectId` particiona por *working-tree*, así que los
           * archivos de UNA corrida comparten base entre ellos. Los dos
           * mecanismos cubren mitades distintas —la fila, los archivos de una
           * corrida; el projectId, las corridas de dos checkouts— y sacar
           * cualquiera de los dos reabre la mitad que le toca. Eso es
           * exactamente lo que dicen la segunda y la cuarta observación de
           * B-219. Antes la fila era `fileParallelism: false` para toda la
           * suite; ese no se puede poner por proyecto, `singleFork` sí.
           */
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
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
      /*
       * **El bucket del SDK de cliente** — B-1235, y faltaba.
       *
       * `subir-imagen.ts` pide el almacén con `getStorage(app())`, sin bucket
       * explícito, así que lo saca de esta clave de la config. Sin ella, todo
       * lo que suba o traiga una imagen por el camino del panel muere con
       * `storage/no-default-bucket` **antes** de tocar el emulador. Eso es lo
       * que dejaba a `promoverImagenDePropuesta` —la función que B-1235
       * encontró rota en producción— sin una sola prueba que la ejecutara de
       * verdad: los tests que había la mockeaban o iban por el Admin SDK, que
       * resuelve el bucket por otro lado.
       *
       * Es el mismo bucket que `tests/emulador.ts` expone como
       * `BUCKET_EMULADOR`; se escribe acá con el literal por la misma razón que
       * las otras cuatro claves de arriba — este bloque es lo que el SDK lee, y
       * un import desde `tests/` invertiría la dependencia.
       */
      PUBLIC_FIREBASE_STORAGE_BUCKET: 'agenda-literaria.firebasestorage.app',
      PUBLIC_USE_EMULATORS: 'true',
      // Se respeta el valor del entorno si viene: permite apuntar los tests a
      // otro emulador, y sin esto no se puede verificar el guard de
      // EXIGIR_EMULADOR (el config pisaba la variable del shell).
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
      /*
       * D-210 (B-320/B-321) — **es una condición para que `miniaturasConocidas()`
       * pueda entrar, no el arreglo de una fuga que ya existía.**
       *
       * Conviene decirlo así porque la primera versión de esta línea afirmaba
       * lo contrario («los tests le hablaban a Storage de producción y nadie lo
       * notaba»), y no es cierto: hasta D-210 nada de la suite tocaba Storage
       * con el Admin SDK, y lo que sí lo toca —`tests/emulador.ts`— resuelve el
       * host con `HOST_STORAGE`, que ya cae al emulador por defecto.
       *
       * El riesgo lo trae el código nuevo: `miniaturasConocidas()`
       * (`src/lib/contenidoDelSitio.ts`) lee el bucket con el Admin SDK, y el
       * cliente de `@google-cloud/storage` no mira `FIRESTORE_EMULATOR_HOST`
       * —mira la suya—. Sin esta variable un test que lo ejercite saldría a
       * `storage.googleapis.com`, y en una máquina con credenciales de GCP la
       * corrida daría **verde** leyendo producción. Mismo default que
       * `HOST_STORAGE` de `tests/emulador.ts`, y el módulo tiene además su
       * propia guarda para el build (ver `leerMiniaturas`).
       */
      FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199',
    },
  },
});
