import type { APIRoute } from 'astro';
import { adminDb, hayCredenciales } from '@/lib/firebase-admin';
import { construirIndice } from '@/lib/eventsJson';
import { toPublic, type ActividadPublica } from '@/lib/toPublic';
import { INFO_VERSION } from '@/lib/version';
import { CAMPOS_TAXONOMIA, type Actividad, type CampoTaxonomia, type ValorOpcion } from '@/types/actividad';

/**
 * `/events.json` — el índice que el listado filtra en memoria — B-106.
 *
 * ── Por qué es un endpoint del build y no una Cloud Function (§2.4) ───────
 * Decisión cerrada del `CLAUDE.md`: **no existe una Function que genere el
 * JSON.** Astro lo produce en build time leyendo Firestore con el Admin SDK, y
 * el resultado es un archivo estático que sirve el CDN. Con eso el público hace
 * **un** fetch cacheado y **cero** lecturas de Firestore (§2.5), lo que hace que
 * el costo de la parte pública sea prácticamente nulo.
 *
 * ── Sin credenciales: en CI falla, en local sigue vacío (D-123, B-189) ────
 * Las dos cláusulas las decide **este** archivo, porque «seguir con lista vacía»
 * es una respuesta que solo puede dar el lector: es su valor de retorno.
 *
 * En CI un build sin credenciales tiene que **fallar**, y esa es la mitad
 * importante: leer cero actividades no falla solo, produce un `events.json`
 * vacío, y el deploy lo publica **encima del sitio que sí tenía datos**. Sin
 * error, sin log, con el workflow en verde — y borrar el sitio de Google se
 * recupera en semanas, no en un rebuild. Es la familia del `EXIGIR_EMULADOR=1`:
 * «verde» no puede significar a la vez «los datos están» y «no había datos».
 *
 * En local sigue con lista vacía y un aviso, para poder trabajar el CSS sin
 * levantar los emuladores. El camino recomendado del §10 igual es el emulador.
 *
 * Y detrás hay una red que ya está puesta: `adminApp()` tira si no hay
 * credenciales (B-189), así que un consumidor que se olvide del chequeo de acá
 * —el patrón que dejó esa guarda apagada un mes— se encuentra un error claro en
 * vez de leer cero documentos en silencio.
 *
 * ── La cabecera de cache vive en `firebase.json` ──────────────────────────
 * En un sitio estático las cabeceras de esta `Response` solo valen en el dev
 * server. La de producción es la de `firebase.json` (`no-cache`), y con eso
 * **cierra B-37**: el índice no puede quedar cacheado más viejo que el HTML que
 * lo acompaña.
 */
export const prerender = true;

/** El `where` del §5.3: solo lo publicado entra al índice (§3.3 del diseño). */
const ESTADO_PUBLICO = 'publicado';

/**
 * Las actividades publicadas, proyectadas.
 *
 * La query lleva el `where('estado','==','publicado')` porque es lo que el §3.3
 * define que entra al índice — y no por las reglas de Firestore: el Admin SDK
 * las saltea. Vale decirlo porque la trampa 7 del §13 habla del caso contrario.
 */
const publicadas = async (): Promise<ActividadPublica[]> => {
  const snap = await adminDb()
    .collection('actividades')
    .where('estado', '==', ESTADO_PUBLICO)
    .get();
  return snap.docs.map((d) => toPublic(d.data() as Actividad, d.id));
};

/** Los cinco documentos de `/opciones/*`, en una sola ida (§4.1). */
const opcionesDeTaxonomia = async (): Promise<
  Partial<Record<CampoTaxonomia, ValorOpcion[]>>
> => {
  const refs = CAMPOS_TAXONOMIA.map((c) => adminDb().doc(`opciones/${c}`));
  const snaps = await adminDb().getAll(...refs);
  const porCampo: Partial<Record<CampoTaxonomia, ValorOpcion[]>> = {};
  snaps.forEach((snap, i) => {
    porCampo[CAMPOS_TAXONOMIA[i]!] = (snap.data()?.valores ?? []) as ValorOpcion[];
  });
  return porCampo;
};

export const GET: APIRoute = async () => {
  let actividades: ActividadPublica[] = [];
  let opciones: Partial<Record<CampoTaxonomia, ValorOpcion[]>> = {};

  if (hayCredenciales()) {
    [actividades, opciones] = await Promise.all([publicadas(), opcionesDeTaxonomia()]);
  } else if (process.env.CI) {
    throw new Error(
      'Build sin credenciales en CI: un events.json vacío se publicaría encima ' +
        'del sitio que tiene datos (B-189, D-123). Falta el secret ' +
        'FIREBASE_SERVICE_ACCOUNT.',
    );
  } else {
    console.warn(
      '[events.json] build sin credenciales: 0 actividades. ' +
        'Levantá el emulador (npm run emu) para ver datos.',
    );
  }

  const indice = construirIndice({
    actividades,
    opciones,
    version: INFO_VERSION.version,
    generadoEn: INFO_VERSION.generadoEn,
  });

  return new Response(`${JSON.stringify(indice, null, 2)}\n`, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
};
