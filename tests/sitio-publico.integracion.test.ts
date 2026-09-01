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

/** Sin `calendarEventId` en ninguna sesión — ver `SIN_EVENTOS` y B-110. */
const sinIdsDeCalendar = (d: Record<string, unknown>): Record<string, unknown> => ({
  ...d,
  sesiones: (d.sesiones as Record<string, unknown>[]).map((s) => ({
    ...s,
    calendarEventId: null,
  })),
});

/*
 * ── Las tres canceladas, y por qué son tres (B-110, §7.3) ──────────────────
 *
 * Una cancelada conserva su página **solo si estuvo publicada alguna vez**: una
 * que nace y muere en `cancelado` nunca fue pública, y publicarla ahora sería
 * filtrar un borrador. Como eso no es un dato del modelo, se infiere — y hay dos
 * señales, que son estos dos primeros documentos:
 *
 * | Documento | Señal | ¿Tiene página? |
 * |---|---|---|
 * | `SLUG_CANCELADA_CON_EVENTOS` | alguna sesión conserva su `calendarEventId` | sí — es la heurística del §7.3 |
 * | `SLUG_CANCELADA_CON_HISTORIAL` | una versión de `/versiones` tiene `documento.estado: 'publicado'` | sí — y **es la que importa en producción** |
 * | `SLUG_CANCELADA_NUNCA` | ninguna de las dos | **no** |
 *
 * La segunda existe porque la primera no sobrevive: al pasar a `cancelado`,
 * `syncCalendar` borra los N eventos y escribe `calendarEventId: null` de vuelta
 * en cada sesión (`reponerIds`, B-80). O sea que en producción la prueba que el
 * §7.3 propone la borra el propio sync, y sin la señal del historial este ítem no
 * generaría ni una página. Por eso las dos canceladas que sí tienen página se
 * siembran con formas distintas y no con la misma.
 */
const SLUG_CANCELADA_CON_EVENTOS = 'sitio-cancelada-con-eventos';
const SLUG_CANCELADA_CON_HISTORIAL = 'sitio-cancelada-con-historial';
const SLUG_CANCELADA_NUNCA = 'sitio-cancelada-nunca';
const SLUG_PENDIENTE = 'sitio-pendiente';

/** Los que **no** pueden tener página, en un solo lugar: se barren todos juntos. */
const SIN_PAGINA = [SLUG_BORRADOR, SLUG_PENDIENTE, SLUG_CANCELADA_NUNCA] as const;

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
  let caminos: {
    params: { slug: string };
    props: { detalle: { cancelada: boolean; aviso: { texto: string } | null } };
  }[] = [];
  let pared: { slug: string }[] = [];
  let indice: { actividades: { slug: string }[] } = { actividades: [] };

  beforeAll(async () => {
    await limpiarFirestore();
    const db = getFirestore(initializeApp({ projectId: 'agenda-literaria' }, 'sitio-test'));

    await db
      .doc('actividades/sitio-publicada')
      .set(documento({ slug: SLUG_PUBLICADA, estado: 'publicado' }));
    // Los dos estados que no son públicos, uno por documento, con contenido real
    // cargado: es lo que tiene un borrador de verdad.
    await db
      .doc('actividades/sitio-borrador')
      .set(documento({ slug: SLUG_BORRADOR, estado: 'borrador' }));
    await db
      .doc('actividades/sitio-pendiente')
      .set(documento({ slug: SLUG_PENDIENTE, estado: 'pendiente' }));

    // ── Las tres canceladas (ver la tabla de arriba) ──────────────────────
    await db
      .doc('actividades/sitio-cancelada-con-eventos')
      .set(documento({ slug: SLUG_CANCELADA_CON_EVENTOS, estado: 'cancelado' }));

    await db
      .doc('actividades/sitio-cancelada-con-historial')
      .set(sinIdsDeCalendar(documento({ slug: SLUG_CANCELADA_CON_HISTORIAL, estado: 'cancelado' })));
    /*
     * La versión que `guardarVersion` habría escrito al cancelarla: el documento
     * **anterior**, o sea el publicado. Se siembra con la misma forma que la
     * Function le da (`documento`, `guardadoEn`, `camposCambiados`…), porque lo
     * que se está probando es que el lector sepa leer ese rastro.
     */
    await db
      .doc('actividades/sitio-cancelada-con-historial/versiones/2026-08-19T10-00-00-000Z_ev1')
      .set({
        guardadoEn: new Date('2026-08-19T10:00:00Z'),
        actualizadoPor: 'uid_de_prueba',
        camposCambiados: ['estado'],
        borrado: false,
        documento: sinIdsDeCalendar(
          documento({ slug: SLUG_CANCELADA_CON_HISTORIAL, estado: 'publicado' }),
        ),
      });

    await db
      .doc('actividades/sitio-cancelada-nunca')
      .set(sinIdsDeCalendar(documento({ slug: SLUG_CANCELADA_NUNCA, estado: 'cancelado' })));
    /*
     * Y una versión que **no** prueba nada: nació en borrador y se canceló sin
     * pasar por publicado. Sin esto, el caso pasaría por no tener subcolección, y
     * lo que hay que verificar es que se mire el `estado` de la versión y no su
     * existencia.
     */
    await db
      .doc('actividades/sitio-cancelada-nunca/versiones/2026-08-19T10-00-00-000Z_ev1')
      .set({
        guardadoEn: new Date('2026-08-19T10:00:00Z'),
        actualizadoPor: 'uid_de_prueba',
        camposCambiados: ['estado'],
        borrado: false,
        documento: sinIdsDeCalendar(documento({ slug: SLUG_CANCELADA_NUNCA, estado: 'borrador' })),
      });

    const { caminosDeDetalle, carteleraDelSitio, indiceDelSitio, olvidarContenido } = await import(
      '@/lib/contenidoDelSitio'
    );
    olvidarContenido();
    caminos = await caminosDeDetalle(new Date('2026-08-20T15:00:00Z'));
    pared = await carteleraDelSitio(new Date('2026-08-20T15:00:00Z'));
    indice = await indiceDelSitio();
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

  it('ni el borrador, ni la pendiente, ni la cancelada que nunca se publicó', () => {
    /*
     * **La dirección que no puede fallar nunca.** El modo de falla concreto: con
     * el `where` roto, el build genera una página HTML **indexable** por cada
     * borrador, con su descripción, su sede, su mail de inscripción y el link de
     * la reunión que el dueño todavía no publicó. Es peor que la fuga del índice,
     * porque una página se queda en Google.
     *
     * La tercera es la que B-110 agregó, y es de la misma clase: una actividad que
     * nace y muere en `cancelado` **nunca fue pública**, así que publicar su
     * página ahora es publicar un borrador por otra puerta. Tiene su versión de
     * historial sembrada —en `borrador`— para que el caso no pase por no tener
     * subcolección.
     *
     * MUTACIÓN PROBADA: cambiar el `where` de `canceladas()` por un
     * `where('estado','!=','publicado')` —o sea el atajo que uno escribiría para
     * «todo lo que no está publicado»— hace que este `it` nombre los tres slugs.
     * Y hacer que `estuvoPublicada` devuelva siempre `true` lo hace nombrar
     * `sitio-cancelada-nunca`.
     */
    const slugs = caminos.map((c) => c.params.slug);
    for (const slug of SIN_PAGINA) {
      expect(slugs, `${slug} no puede tener página de detalle`).not.toContain(slug);
    }
    expect(slugs.sort()).toEqual(
      [SLUG_PUBLICADA, SLUG_CANCELADA_CON_EVENTOS, SLUG_CANCELADA_CON_HISTORIAL].sort(),
    );
  });

  it('la cancelada que estuvo publicada SÍ tiene página, y va marcada — B-110', () => {
    /*
     * El ítem entero: la URL estuvo tres semanas en Instagram y en Google, y a
     * quien pregunta «¿se hace o no se hace?» el sitio le contestaba «no existe».
     * Y `ayudaDelSitio.ts` ya prometía que no: «si se cancela la actividad entera,
     * la página no desaparece».
     *
     * MUTACIÓN PROBADA: sacar el `true` de `detallesDelSitio(instante, true)` en
     * `caminosDeDetalle` deja las dos canceladas sin página y este `it` lo dice;
     * el `it` de arriba también, por el `toEqual`.
     */
    const conEventos = caminos.find((c) => c.params.slug === SLUG_CANCELADA_CON_EVENTOS);
    expect(conEventos, 'la heurística del §7.3 —el `calendarEventId`— alcanza').toBeDefined();
    expect(conEventos!.props.detalle.cancelada).toBe(true);
    expect(conEventos!.props.detalle.aviso?.texto).toContain('Esta actividad se canceló');
  });

  it('y también la que solo lo prueba por el historial, que es el caso real', () => {
    /*
     * **Es el caso de producción y por eso tiene su propio `it`.** Al pasar a
     * `cancelado`, `syncCalendar` borra los eventos y escribe `calendarEventId:
     * null` de vuelta (`reponerIds`, B-80): la heurística del §7.3 se borra sola.
     * Lo que queda es la versión que `guardarVersion` escribió con el documento
     * anterior, cuyo `estado` era `publicado`.
     *
     * MUTACIÓN PROBADA: dejar `estuvoPublicada` solo con la línea del
     * `calendarEventId` —o sea implementar el §7.3 al pie de la letra— deja este
     * `it` en rojo y **todos los demás en verde**. Esa diferencia es todo el valor
     * de este caso: sin él, B-110 se cerraría con una implementación que en
     * producción no genera ninguna página.
     */
    const conHistorial = caminos.find((c) => c.params.slug === SLUG_CANCELADA_CON_HISTORIAL);
    expect(conHistorial, 'la versión publicada del historial la habilita').toBeDefined();
    expect(conHistorial!.props.detalle.cancelada).toBe(true);
  });

  it('ninguna cancelada entra al `events.json` — §7.3', () => {
    /*
     * La otra mitad de B-110, y la que se rompe sola si las dos listas se mezclan:
     * una cancelada tiene página **y no es algo a lo que se pueda ir**. No entra al
     * índice, ni al listado, ni a los hubs, ni a `/pasadas`. Existe solo para quien
     * tiene el link.
     *
     * MUTACIÓN PROBADA: hacer que `leer()` devuelva
     * `actividades: [...publicadas, ...canceladas]` —que es lo que uno escribe si
     * decide «una sola lista y un flag»— deja en verde los tres `it` de arriba y
     * pone rojo éste y el de la cartelera.
     */
    // Control positivo: sin esto, un índice vacío pasaría el aserto de abajo.
    expect(indice.actividades.map((a) => a.slug)).toEqual([SLUG_PUBLICADA]);

    const texto = JSON.stringify(indice);
    for (const slug of [
      SLUG_CANCELADA_CON_EVENTOS,
      SLUG_CANCELADA_CON_HISTORIAL,
      SLUG_CANCELADA_NUNCA,
    ]) {
      expect(texto, `${slug} no puede estar en el events.json`).not.toContain(slug);
    }
  });

  it('el flyer de un borrador no entra a la cartelera — B-265', () => {
    /*
     * **Lo pidió el `auditor-privacidad` sobre B-265.** La salida 7 comparte el
     * `where` del §5.3 con la 6 —las dos salen de `detallesDelSitio`— así que
     * hoy es cierto por construcción. Pero `detallesDelSitio` es una extracción
     * **nueva**, y el modo de falla es el peor que hay para una pared de
     * imágenes: el flyer de una actividad en borrador publicado en HTML
     * indexado, que es exactamente lo que la trampa 13 cierra del lado de
     * Storage y que entraría por esta otra puerta.
     *
     * El fixture de centinelas trae una imagen, así que las seis actividades
     * sembradas tienen flyer y las cinco no publicadas son candidatas de verdad.
     *
     * **Y desde B-110 la pared tiene un segundo motivo para filtrar**: las
     * canceladas sí generan página, así que `detallesDelSitio` sabe de ellas. No
     * se las pasa a la pared —el default es no incluirlas— y `carteleraDeDetalles`
     * las descarta igual, que es la guarda que sobrevive a que ese default cambie.
     *
     * MUTACIÓN PROBADA: darle a `carteleraDelSitio` su propia lectura
     * (`adminDb().collection('actividades').get()`, sin el `where`) en vez de
     * compartir `detallesDelSitio`. Los otros `it` de este describe quedan en
     * verde y éste se pone rojo — que es todo el punto: el `where` de la salida 6
     * no protege a la 7 el día que dejen de compartir el lector. Y pasarle
     * `true` a `detallesDelSitio` desde `carteleraDelSitio` sin tocar
     * `carteleraDeDetalles` **no** rompe nada, que es justamente para lo que está
     * el segundo filtro.
     */
    // Control positivo: sin esto, una pared vacía pasaría el aserto de abajo.
    expect(pared.map((a) => a.slug)).toEqual([SLUG_PUBLICADA]);

    const texto = JSON.stringify(pared);
    for (const slug of [
      ...SIN_PAGINA,
      SLUG_CANCELADA_CON_EVENTOS,
      SLUG_CANCELADA_CON_HISTORIAL,
    ]) {
      expect(texto, `${slug} no puede aparecer en la cartelera`).not.toContain(slug);
    }
  });

  it('sobrevive al argumento que Astro le pasa a `getStaticPaths` — B-237', async () => {
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
    // Tres: la publicada y las dos canceladas que estuvieron publicadas (B-110).
    await expect(caminosDeDetalle(comoLlamaAstro)).resolves.toHaveLength(3);
  });

  it('y su contenido tampoco viaja en las props de la que sí se genera', () => {
    /*
     * El `length` de arriba mira las rutas; esto mira el contenido. Una
     * proyección futura que juntara datos de todas las actividades —«otras
     * actividades del mismo barrio», por ejemplo— publicaría el título de un
     * borrador sin agregar ninguna ruta.
     */
    const texto = JSON.stringify(caminos);
    for (const slug of SIN_PAGINA) {
      expect(texto, `el contenido de ${slug} tampoco viaja`).not.toContain(slug);
    }
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
