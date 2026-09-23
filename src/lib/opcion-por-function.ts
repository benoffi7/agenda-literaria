/**
 * **El publicador crea una etiqueta por la callable** — B-893, D-810.
 *
 * El publicador no escribe `/opciones/*` (las reglas no pueden verificar qué
 * elemento del array cambió, `firestore.rules`), así que su «Otro…» no pasa por
 * `upsertOpcion` sino por `crearOpcionDelPanel`, que corre con el Admin SDK y
 * verifica que lo único que cambia es un elemento agregado sin aprobar
 * (`functions/alta-de-opcion.js`). Este módulo es el pegamento del lado del
 * navegador, y nada más: la decisión vive del otro lado.
 *
 * ── Por qué es un archivo aparte y no una función de `opciones.ts` ────────
 * Porque trae `firebase/functions`, y `opciones.ts` lo importan pantallas que no
 * lo necesitan. Acá lo importa solo `formulario/guardar.ts`, que vive en el chunk
 * diferido del formulario (`AdminApp` lo carga con `lazy`), así que el SDK de
 * Functions no entra al chunk inicial del panel.
 *
 * ── App Check viaja solo ──────────────────────────────────────────────────
 * La callable tiene `enforceAppCheck: true`. El SDK de Functions le pega el token
 * de App Check al pedido por su cuenta cuando App Check está activado sobre la
 * misma app —y lo está: `firebase-client.ts` lo activa al crearla—, igual que
 * hace Firestore con cada lectura del panel.
 */
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import { app, usarEmuladores } from '@/lib/firebase-client';
import type { CampoTaxonomia } from '@/types/actividad';

/**
 * La región de las Functions. **Es el mismo valor que `REGION` en
 * `functions/despliegue.js`** y no se importa de ahí por lo mismo que en
 * `subir-imagen.ts`: el alias arrastraría `functions/` del deploy al bundle. Lo
 * ata `tests/alta-de-opcion-callable.test.ts` (clase de B-88: con la región
 * equivocada el SDK le pega a `us-central1` y el fallo es un 404 en runtime).
 */
const REGION_FUNCTIONS = 'southamerica-east1';

/** Puerto del emulador de Functions (`firebase.json`). */
const PUERTO_EMULADOR_FUNCTIONS = 5001;

/** El nombre exportado en `functions/index.js`. Atado por test al fuente de allá. */
const CALLABLE_OPCION = 'crearOpcionDelPanel';

let _funciones: Functions | null = null;
const funciones = (): Functions => {
  if (_funciones) return _funciones;
  _funciones = getFunctions(app(), REGION_FUNCTIONS);
  if (usarEmuladores) connectFunctionsEmulator(_funciones, '127.0.0.1', PUERTO_EMULADOR_FUNCTIONS);
  return _funciones;
};

/**
 * Pide el alta de una etiqueta y devuelve su slug. **Tira** si la callable la
 * rechaza o no responde: quien llama (`guardarActividad`) es el que decide qué
 * mostrar, y lo que no puede pasar es que un fallo acá se lea como un éxito
 * (B-893: «ese camino no puede fallar en silencio»).
 *
 * El `slug` que vuelve lo derivó la Function con el mismo `slugify` que el
 * formulario (trampa 6); si no coincidiera con el que el formulario ya guardó en
 * la actividad, la etiqueta quedaría registrada con otra identidad que la que la
 * actividad usa — así que eso también es un fallo, y se dice.
 */
export const proponerOpcion = async (
  campo: CampoTaxonomia,
  label: string,
  slugEsperado: string,
): Promise<string> => {
  const llamar = httpsCallable<{ campo: string; label: string }, { slug: string; creada: boolean }>(
    funciones(),
    CALLABLE_OPCION,
  );
  const { data } = await llamar({ campo, label });
  if (data?.slug !== slugEsperado) {
    throw new Error(
      `La opción quedó registrada como «${data?.slug}» y la actividad la guardó como «${slugEsperado}».`,
    );
  }
  return data.slug;
};
