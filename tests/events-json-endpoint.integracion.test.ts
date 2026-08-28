import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Actividad } from '@/types/actividad';
import { CENTINELA, actividadCentinela } from './fixtures/centinelas';
import { emuladorVivo, limpiarFirestore } from './emulador';

/**
 * `/events.json` — **el endpoint**, no la librería — B-106, B-218.
 *
 * ── Por qué faltaba ───────────────────────────────────────────────────────
 * `tests/eventsJson.test.ts` prueba `entradaDeIndice`/`construirIndice` y el
 * barrido prueba la proyección. Los dos entran a la cadena **después** de que el
 * endpoint ya eligió qué documentos leer, así que ninguno mira la query. El
 * `auditor-privacidad` lo encontró con un `grep` que no devolvía nada: hasta este
 * archivo, **ningún test nombraba `src/pages/events.json.ts`**.
 *
 * Consecuencia medida: borrar el `.where('estado','==','publicado')` dejaba la
 * suite entera en verde y publicaba en `/events.json` —en un solo GET— el
 * título, el resumen, el `searchText`, la sede, el organizador y todas las
 * fechas de las actividades en **borrador**, **pendiente** y **cancelado**. Es la
 * salida 1 con el filtro del §5.3 apagado.
 *
 * ── Por qué es de integración y no de texto ───────────────────────────────
 * Un test que le hiciera `grep` al fuente buscando la cláusula pasaría con la
 * cláusula escrita mal (`'Publicado'`, `'!='`, el campo cambiado de nombre). Acá
 * se siembran dos documentos —uno publicado y uno en borrador— y se afirma sobre
 * el JSON que el endpoint devuelve. Lo que se prueba es el comportamiento.
 *
 * El mismo par lo verifica `scripts/build-contra-emulador.mjs` sobre el
 * `dist/events.json` de verdad (paso 4 del gate de pre-push). Éste corre además
 * en CI, que no corre `verificar-todo.sh`.
 */

const vivo = await emuladorVivo();

const SLUG_PUBLICADA = 'endpoint-publicada';
const SLUG_BORRADOR = 'endpoint-borrador';

/**
 * El fixture de centinelas, con `Timestamp` de verdad.
 *
 * `fixtures/tiempo.ts` devuelve un doble con métodos, que es lo que las
 * proyecciones necesitan y lo que el Admin SDK **no** puede serializar. Un `Date`
 * sí: Firestore lo guarda como `Timestamp` y lo devuelve como `Timestamp`, que es
 * exactamente el viaje que hace el documento en producción.
 */
const documento = (over: Partial<Actividad>): Record<string, unknown> => {
  const a = actividadCentinela(over);
  return {
    ...a,
    sesiones: a.sesiones.map((s) => ({
      ...s,
      inicio: s.inicio.toDate(),
      fin: s.fin.toDate(),
    })),
    // B-224 — la ventana de cada forma de cursar, con el mismo criterio: `Date`
    // en vez del doble, y `null` cuando no hay fecha.
    modalidades: a.modalidades.map((m) => ({
      ...m,
      inicio: m.inicio ? m.inicio.toDate() : null,
      fin: m.fin ? m.fin.toDate() : null,
    })),
    inscripcion: {
      ...a.inscripcion,
      cierra: a.inscripcion.cierra ? a.inscripcion.cierra.toDate() : null,
    },
    createdAt: a.createdAt.toDate(),
    updatedAt: a.updatedAt.toDate(),
  };
};

describe.skipIf(!vivo)('el endpoint /events.json publica solo lo publicado (§5.3, §3.3)', () => {
  let cuerpo = '';
  let indice: { actividades: { slug: string }[] };

  beforeAll(async () => {
    await limpiarFirestore();

    const db = getFirestore(initializeApp({ projectId: 'agenda-literaria' }, 'endpoint-test'));
    await db.doc('actividades/endpoint-publicada').set(
      documento({ slug: SLUG_PUBLICADA, estado: 'publicado' }),
    );
    // Los tres estados que NO entran, uno por documento: `borrador` es el que se
    // carga a medias, `cancelado` el que ya no va, y `pendiente` el que espera
    // revisión. Los tres tienen contenido real cargado y ninguno es público.
    await db.doc('actividades/endpoint-borrador').set(
      documento({ slug: SLUG_BORRADOR, estado: 'borrador' }),
    );
    await db.doc('actividades/endpoint-cancelada').set(
      documento({ slug: 'endpoint-cancelada', estado: 'cancelado' }),
    );
    await db.doc('actividades/endpoint-pendiente').set(
      documento({ slug: 'endpoint-pendiente', estado: 'pendiente' }),
    );

    const { GET } = await import('@/pages/events.json');
    const res = await GET({} as Parameters<typeof GET>[0]);
    cuerpo = await (res as Response).text();
    indice = JSON.parse(cuerpo);
  }, 30_000);

  /*
   * Y se limpia al salir, no solo al entrar. El emulador de quien está
   * trabajando persiste su estado (`--export-on-exit`), así que estas cuatro
   * actividades le quedarían cargadas en el panel. Se notó porque el paso 4 del
   * gate contó **dos** publicadas donde siembra una: el sobrante era la de acá.
   */
  afterAll(async () => {
    await limpiarFirestore();
  });

  it('la publicada está: el endpoint leyó Firestore de verdad', () => {
    // Control positivo. Sin esto, los tres `it` de abajo pasan con el índice
    // vacío — que es exactamente cómo el paso 4 del gate daba verde sin leer
    // nada (B-217).
    expect(indice.actividades.map((a) => a.slug)).toContain(SLUG_PUBLICADA);
  });

  it('ninguno de los tres estados no públicos entra al índice', () => {
    const slugs = indice.actividades.map((a) => a.slug);
    for (const slug of [SLUG_BORRADOR, 'endpoint-cancelada', 'endpoint-pendiente']) {
      expect(slugs, `${slug} no puede estar en el índice`).not.toContain(slug);
    }
    expect(indice.actividades).toHaveLength(1);
  });

  it('y su contenido tampoco se cuela por ningún otro camino', () => {
    /*
     * El `length` de arriba mira las entradas; esto mira el texto. Una
     * proyección futura que juntara datos de todas las actividades para armar,
     * por ejemplo, la lista de barrios con actividad, publicaría el contenido de
     * un borrador sin agregar ninguna entrada al array.
     */
    expect(cuerpo).not.toContain(SLUG_BORRADOR);
    expect(cuerpo).not.toContain('endpoint-cancelada');
    expect(cuerpo).not.toContain('endpoint-pendiente');
  });

  it('y el recorte del índice sigue puesto sobre el archivo servido', () => {
    // El barrido de centinelas corre sobre el valor de retorno de
    // `construirIndice`. Esto lo corre sobre el cuerpo de la `Response`, que es
    // lo que se sube: entre las dos cosas está `JSON.stringify` y la serialización
    // del endpoint.
    for (const campo of [
      'inscripcion.destino',
      'sede.direccion',
      'sede.indicaciones',
      'sesiones.tema',
      'sesiones.lectura',
      'tallerista.bio',
      'difusion.notas',
      'createdBy',
    ] as const) {
      expect(cuerpo, `${campo} no puede salir al índice`).not.toContain(CENTINELA[campo]);
    }
  });
});

/**
 * La otra mitad de D-123 / B-189: en CI, un build sin credenciales tiene que
 * **fallar** en vez de emitir un `events.json` vacío que el deploy publicaría
 * encima del sitio que sí tenía datos.
 *
 * Hasta acá esa rama la sostenía una frase de un mensaje de commit («probado,
 * sale con estado 1»), que es una verificación manual de una sola vez.
 */
describe('sin credenciales: en CI falla, en local sigue vacío (D-123, B-189)', () => {
  const sinCredenciales = () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '');
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '');
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '');
  };

  it('en CI tira, y el mensaje dice qué secret falta', async () => {
    sinCredenciales();
    vi.stubEnv('CI', 'true');
    const { GET } = await import('@/pages/events.json');
    await expect(GET({} as Parameters<typeof GET>[0])).rejects.toThrow(
      /FIREBASE_SERVICE_ACCOUNT/,
    );
    vi.unstubAllEnvs();
  });

  it('en local sigue con lista vacía, para trabajar el CSS sin emuladores', async () => {
    sinCredenciales();
    vi.stubEnv('CI', '');
    const { GET } = await import('@/pages/events.json');
    const res = (await GET({} as Parameters<typeof GET>[0])) as Response;
    expect(JSON.parse(await res.text()).actividades).toEqual([]);
    vi.unstubAllEnvs();
  });
});
