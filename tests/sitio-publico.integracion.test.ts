/**
 * El lector del sitio público, contra el emulador — B-227.
 *
 * ── Por qué existe, y por qué es de integración ───────────────────────────
 * `tests/pagina-de-detalle.test.ts` verifica que la plantilla delegue en
 * `caminosDeDetalle` y que el lector **nombre** el `where` del §5.3. Eso es la
 * alarma barata, y no alcanza: un `grep` pasa con la cláusula escrita mal
 * (`'Publicado'`, `'!='`, el campo renombrado). Lo que decide si se publican los
 * borradores es el comportamiento.
 *
 * Es el gemelo de `events-json-endpoint.integracion.test.ts` para la otra salida.
 * Y hace falta que sean dos: el `events.json` y las páginas de detalle salen hoy
 * del mismo lector, pero la afirmación que importa es «no existe una URL
 * `/actividad/{slug}` de un borrador», y esa no la hace el otro archivo.
 *
 * El modo de falla concreto que cierra: con el `where` roto, el build genera una
 * página HTML **indexable** por cada borrador, con su descripción, su sede, su
 * mail de inscripción y el link de la reunión que el dueño todavía no publicó. Es
 * peor que la fuga del índice, porque una página se queda en Google.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Actividad } from '@/types/actividad';
import { CENTINELA, actividadCentinela } from './fixtures/centinelas';
import { emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

const SLUG_PUBLICADA = 'sitio-publicada';
const SLUG_BORRADOR = 'sitio-borrador';

/**
 * El fixture con `Timestamp` de verdad: `fixtures/tiempo.ts` devuelve un doble
 * con métodos, que el Admin SDK no puede serializar. Un `Date` sí, y Firestore lo
 * devuelve como `Timestamp` — que es el viaje que hace el documento en
 * producción. Es el mismo helper que el test del endpoint.
 */
const documento = (over: Partial<Actividad>): Record<string, unknown> => {
  const a = actividadCentinela(over);
  return {
    ...a,
    sesiones: a.sesiones.map((s) => ({ ...s, inicio: s.inicio.toDate(), fin: s.fin.toDate() })),
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

describe.skipIf(!vivo)('las páginas de detalle salen solo de lo publicado (§5.3, §3.3)', () => {
  let caminos: { params: { slug: string }; props: { detalle: unknown } }[] = [];

  beforeAll(async () => {
    await limpiarFirestore();
    const db = getFirestore(initializeApp({ projectId: 'agenda-literaria' }, 'sitio-test'));

    await db
      .doc('actividades/sitio-publicada')
      .set(documento({ slug: SLUG_PUBLICADA, estado: 'publicado' }));
    // Los tres estados que no son públicos, uno por documento, con contenido
    // real cargado: es lo que tiene un borrador de verdad.
    await db
      .doc('actividades/sitio-borrador')
      .set(documento({ slug: SLUG_BORRADOR, estado: 'borrador' }));
    await db
      .doc('actividades/sitio-cancelada')
      .set(documento({ slug: 'sitio-cancelada', estado: 'cancelado' }));
    await db
      .doc('actividades/sitio-pendiente')
      .set(documento({ slug: 'sitio-pendiente', estado: 'pendiente' }));

    const { caminosDeDetalle, olvidarContenido } = await import('@/lib/contenidoDelSitio');
    olvidarContenido();
    caminos = await caminosDeDetalle(new Date('2026-08-20T15:00:00Z'));
  }, 30_000);

  /*
   * Se limpia también al salir: el emulador de quien está trabajando persiste su
   * estado (`--export-on-exit`), y estas cuatro actividades le quedarían cargadas
   * en el panel.
   */
  afterAll(async () => {
    await limpiarFirestore();
    const { olvidarContenido } = await import('@/lib/contenidoDelSitio');
    olvidarContenido();
  });

  it('la publicada tiene su página: el lector leyó Firestore de verdad', () => {
    // Control positivo. Sin esto, los dos `it` de abajo pasan con cero caminos —
    // que es exactamente cómo un build vacío da verde.
    expect(caminos.map((c) => c.params.slug)).toContain(SLUG_PUBLICADA);
  });

  it('ninguno de los tres estados no públicos genera página', () => {
    const slugs = caminos.map((c) => c.params.slug);
    for (const slug of [SLUG_BORRADOR, 'sitio-cancelada', 'sitio-pendiente']) {
      expect(slugs, `${slug} no puede tener página de detalle`).not.toContain(slug);
    }
    expect(caminos).toHaveLength(1);
  });

  it('sobrevive al argumento que Astro le pasa a `getStaticPaths` — B-228', async () => {
    /*
     * El bug que el build de verdad encontró y ningún unitario podía ver: Astro
     * **llama a `getStaticPaths` con un objeto propio** (`{ paginate, rss }`), y
     * con `export const getStaticPaths = caminosDeDetalle` ese objeto caía en el
     * parámetro del reloj. Resultado: `ahora.getTime is not a function` y **cero**
     * páginas de detalle generadas, con toda la suite en verde.
     *
     * Acá se llama igual que Astro. La plantilla además la envuelve —lo fija
     * `tests/pagina-de-detalle.test.ts`— pero esta guarda es la que sigue valiendo
     * el día que alguien vuelva al alias, que es lo que uno escribe.
     */
    const { caminosDeDetalle } = await import('@/lib/contenidoDelSitio');
    const comoLlamaAstro = { paginate: () => [], rss: () => {} } as never;
    await expect(caminosDeDetalle(comoLlamaAstro)).resolves.toHaveLength(1);
  });

  it('y su contenido tampoco viaja en las props de la que sí se genera', () => {
    /*
     * El `length` de arriba mira las rutas; esto mira el contenido. Una
     * proyección futura que juntara datos de todas las actividades —«otras
     * actividades del mismo barrio», por ejemplo— publicaría el título de un
     * borrador sin agregar ninguna ruta.
     */
    const texto = JSON.stringify(caminos);
    expect(texto).not.toContain(SLUG_BORRADOR);
    expect(texto).not.toContain('sitio-cancelada');
    expect(texto).not.toContain('sitio-pendiente');
  });

  it('las props de la página no llevan lo privado, sobre el documento de verdad', () => {
    /*
     * El barrido de centinelas corre sobre el valor de `detalleDeActividad` con
     * un fixture en memoria. Esto lo corre sobre lo que sale del **viaje
     * completo**: Firestore → `Timestamp` reales → `toPublic` → view-model. Entre
     * una cosa y la otra está la serialización del Admin SDK, que es donde un
     * campo puede volver con otra forma.
     */
    const texto = JSON.stringify(caminos);
    for (const campo of [
      'online.url',
      'difusion.notas',
      'difusion.arrobar',
      'createdBy',
      'updatedBy',
      'imagenes.storagePath',
      'sesiones.calendarEventId',
      'material.url.privado',
    ] as const) {
      expect(texto, `${campo} no puede viajar a la página de detalle`).not.toContain(
        CENTINELA[campo],
      );
    }
  });

  it('y sí lleva lo que la página tiene que mostrar', () => {
    // La otra dirección, sin la cual lo de arriba pasaría con props vacías.
    const texto = JSON.stringify(caminos);
    for (const campo of ['descripcion', 'sede.direccion', 'inscripcion.destino', 'tallerista.bio'] as const) {
      expect(texto, `${campo} tiene que llegar al detalle`).toContain(CENTINELA[campo]);
    }
  });
});

/**
 * D-30 sobre el sitio: **filtrar lo elegible no es filtrar lo mostrable**.
 *
 * Lo encontró el `auditor-privacidad`. Al derivar las etiquetas del índice —que
 * ya pasó por `opcionesPublicas`— la página de detalle resolvía con la lista
 * filtrada por aprobación, y eso invierte en silencio una regla escrita en dos
 * lugares. El caso que D-30 nombra por su nombre: una actividad publicada puede
 * tener guardada una opción **pendiente**, y su página tiene que poder decir «Con
 * beca parcial» y no «Con Beca Parcial» desSlugeado.
 */
describe.skipIf(!vivo)('las etiquetas del detalle no se filtran por aprobación (D-30)', () => {
  const SLUG = 'sitio-pendiente-label';
  const OPCION_PENDIENTE = { slug: 'con-beca-parcial', label: 'Con beca parcial' };

  beforeAll(async () => {
    await limpiarFirestore();
    const db = getFirestore(initializeApp({ projectId: 'agenda-literaria' }, 'sitio-etiquetas'));
    await db.doc('actividades/sitio-etiqueta').set(
      documento({ slug: SLUG, estado: 'publicado', arancel: { tipo: OPCION_PENDIENTE.slug, notas: '' } }),
    );
    // La opción existe en la taxonomía pero **todavía no está aprobada** (§4.3).
    await db.doc('opciones/arancel').set({
      valores: [{ ...OPCION_PENDIENTE, orden: 9, fijo: false, usos: 1, aprobada: false }],
    });
    const { olvidarContenido } = await import('@/lib/contenidoDelSitio');
    olvidarContenido();
  }, 30_000);

  afterAll(async () => {
    await limpiarFirestore();
    const { olvidarContenido } = await import('@/lib/contenidoDelSitio');
    olvidarContenido();
  });

  it('el detalle muestra la etiqueta de la opción pendiente, no el slug desSlugeado', async () => {
    // MUTACIÓN PROBADA: volver `etiquetasDelDetalle` a derivar del índice
    // (`etiquetasDelListado`) hace que esto diga «Con Beca Parcial».
    const { caminosDeDetalle } = await import('@/lib/contenidoDelSitio');
    const [camino] = await caminosDeDetalle(new Date('2026-08-20T15:00:00Z'));
    expect(camino!.props.detalle.arancel.etiqueta).toBe(OPCION_PENDIENTE.label);
  });

  it('pero al `events.json` la opción pendiente NO entra como chip (§4.3)', async () => {
    /*
     * La otra mitad de la asimetría, y la que hace que la de arriba no sea un
     * aflojamiento: resolver no es ofrecer. El sitio público no publica
     * vocabulario sin validar, así que la opción no aparece en la lista de
     * `opciones` del índice — de la que salen los chips del filtro.
     */
    const { indiceDelSitio } = await import('@/lib/contenidoDelSitio');
    const indice = await indiceDelSitio();
    expect(indice.opciones.arancel ?? []).toEqual([]);
  });
});
