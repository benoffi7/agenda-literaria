/**
 * Salida 7: la cartelera (B-265).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { detalleDeActividad } from '@/lib/detallePublico';
import { carteleraDeDetalles } from '@/lib/cartelera';
import { urlDeMiniatura } from '@/lib/imagenes';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { CENTINELA, actividadCentinela, conLinkPublico } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';
import { CENTINELA_DE_LA_CARTELERA } from '../../scripts/gate-build/semilla.mjs';
import { canastaDelGateCoincide } from '../fixtures/barrido-de-salidas';

// ───────────────────────────────────────────────────────────────────────────
// Salida 7 — la cartelera (B-265)
// ───────────────────────────────────────────────────────────────────────────

describe('barrido de la cartelera (§5, salida 7, B-265)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, que es la lección de
   * B-212 y de la salida 5.
   *
   * Y hay algo que la distingue de las otras seis: **su entrada no es el
   * documento, es la salida 6**. `carteleraDeDetalles` proyecta `DetallePublico`,
   * así que solo puede sacar campos y no agregar ninguno que aquella no haya
   * decidido publicar. Eso hace que la lista de permitidos de acá tenga que ser
   * un **subconjunto** de la del detalle, y es lo que se afirma abajo: si algún
   * día alguien le pasa a la pared el documento en vez del view-model, la lista
   * deja de ser subconjunto y este archivo lo dice.
   */
  const ETIQUETAS = mapaDeEtiquetas({
    tipo: [{ slug: 'presentacion', label: CENTINELA['labels.tipo'] }],
    barrio: [{ slug: CENTINELA['sede.barrio'], label: CENTINELA['labels.barrio'] }],
    // B-950 — las dos de la geografía. Sin estas líneas `etiquetaDe` cae a
    // `desSlug` y el barrido mediría el respaldo en vez de la resolución.
    ciudad: [{ slug: CENTINELA['sede.ciudad'], label: CENTINELA['labels.ciudad'] }],
    provincia: [{ slug: CENTINELA['sede.provincia'], label: CENTINELA['labels.provincia'] }],
    plataforma: [
      { slug: CENTINELA['online.plataforma'], label: CENTINELA['labels.plataforma'] },
    ],
    arancel: [{ slug: CENTINELA['arancel.tipo'], label: CENTINELA['labels.arancel'] }],
    tags: [{ slug: CENTINELA.tags, label: CENTINELA['labels.tags'] }],
    'incluye-actividad': [{ slug: CENTINELA.incluye, label: CENTINELA['labels.incluye'] }],
  });

  // El mismo instante que el barrido del detalle: antes de la primera sesión, que
  // es el único estado en el que la actividad **entra** a la pared.
  const AHORA = new Date('2026-08-20T15:00:00Z');
  const TONOS = { presentacion: 195 };
  const pared = () =>
    carteleraDeDetalles([
      detalleDeActividad(
        toPublic(actividadCentinela(), 'act_centinela'),
        ETIQUETAS,
        AHORA,
        TONOS,
      ),
    ]);

  const PERMITIDO_EN_LA_CARTELERA: readonly Excepcion[] = [
    {
      nombre: 'identidad',
      centinelas: ['titulo', 'slug'],
      porque:
        'el título es el pie del afiche y el slug es el enlace a la actividad. La ' +
        '**descripción no está**: en una pared de afiches no entra un párrafo, y publicarla ' +
        'acá sería la tercera copia del mismo texto.',
    },
    {
      nombre: 'el afiche',
      centinelas: ['imagenes.url', 'imagenes.epigrafe'],
      porque:
        'es la página entera. `storagePath` NO está —y no puede estar, porque tampoco está ' +
        'en `DetallePublico`— y `imagenes.id` tampoco **como campo propio**: en una pared no ' +
        'identifica nada. Sí viaja adentro de `imagenes.url` (ya lo hacía) y, desde B-320, ' +
        'también adentro de `urlMiniatura` —es el mismo id con otro prefijo, `miniaturas/` en ' +
        'vez de `imagenes/`, y B-206 #1 ya decidió que el path es público de hecho y opaco a ' +
        'propósito—, así que no es una fuga nueva.',
    },
    {
      nombre: 'dónde y de qué tipo',
      centinelas: [
        'sede.nombre',
        'labels.barrio',
        // B-951 — el pie del afiche sale del **mismo** `donde` que la ficha, así
        // que hereda la ciudad y la provincia. Aplanado a texto: un enlace
        // adentro de un pie que ya está dentro del `<a>` a la actividad sería un
        // ancla anidada.
        'labels.ciudad',
        'labels.provincia',
        'labels.tipo',
      ],
      porque:
        'la ficha mínima que convierte un afiche en algo accionable: qué es, cuándo y dónde. ' +
        'La **dirección exacta NO está** —eso es del detalle, donde alguien ya decidió ir— y ' +
        'las indicaciones tampoco.',
    },
  ];

  it('la canasta de la cartelera del gate dice lo mismo que ésta (B-1761)', () => {
    canastaDelGateCoincide(CENTINELA_DE_LA_CARTELERA, PERMITIDO_EN_LA_CARTELERA);
  });

  it('sobreviven exactamente los centinelas que la pared necesita', () => {
    barrer('cartelera', JSON.stringify(pared()), PERMITIDO_EN_LA_CARTELERA, {
      insensible: true,
    });
  });

  it('con el link de la reunión publicado a mano, la pared sigue sin él (D-139)', () => {
    /*
     * **Lo pidió el `auditor-privacidad`, y el hueco era del fixture.**
     * `actividadCentinela()` a secas trae `urlPublica: false`, así que el
     * centinela del link **no estaba en la entrada** del barrido de arriba: ese
     * `it` no podía detectar una fuga del link ni aunque la hubiera. La salida 6
     * sí corre las dos ramas; la 7 quedaba cubierta solo de refilón.
     *
     * La rama que importa es ésta: D-15 deja pasar el link a las salidas 1 y 2,
     * y D-139 lo prohíbe en HTML indexado. La pared es HTML indexado.
     */
    const conLink = detalleDeActividad(
      toPublic(actividadCentinela(conLinkPublico()), 'act_link'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    // Dos controles positivos, y hacen falta los dos: que la rama esté activada
    // de verdad, y que la pared **no** haya quedado vacía —un `barrer()` sobre
    // `[]` pasa sin haber mirado nada—.
    expect(conLink.modalidades.some((m) => m.plataforma !== null)).toBe(true);
    const paredConLink = carteleraDeDetalles([conLink]);
    expect(paredConLink).toHaveLength(1);
    barrer(
      'cartelera (link de reunión publicado a mano)',
      JSON.stringify(paredConLink),
      PERMITIDO_EN_LA_CARTELERA,
      { insensible: true },
    );
  });

  it('todo lo que publica ya lo publicaba el detalle', () => {
    /*
     * La afirmación de **forma**, y la que sobrevive a que cambien las dos
     * listas: una salida derivada no puede publicar un texto que aquella de la
     * que deriva no publique. Se afirma sobre los valores y no sobre la lista de
     * permitidos, así que no hay nada que mantener.
     *
     * **Y no es el mismo chequeo que el de arriba.** Las dos mutaciones lo
     * muestran:
     *
     *  - agregarle a la pared un campo que el detalle **sí** publica
     *    (`descripcion`, «para el `title` del enlace») → lo caza el barrido de
     *    centinelas de arriba, y éste lo deja pasar, que es correcto: si el
     *    detalle lo publica, está auditado;
     *  - hacer que la pared **componga** en vez de copiar
     *    (`titulo: d.titulo.toUpperCase()`) → lo caza **este** y no el de
     *    arriba, porque `barrer` corre con `insensible: true` y encuentra el
     *    centinela igual. Componer es el primer paso de publicar algo que la
     *    salida 6 no publicó, y es como entró el `aviso.texto` del detalle.
     *
     * Las dos mutaciones se corrieron y las dos dieron rojo en su chequeo.
     *
     * `ruta` queda afuera y se verifica aparte: es lo único que la pared
     * **compone** en vez de copiar, y lo compone con el slug (B-227).
     *
     * `urlMiniatura` queda afuera de este `for` **por nombre**, y no por
     * casualidad del fixture — lo encontró el `auditor-privacidad` auditando
     * B-320. `CENTINELA['imagenes.url']` no es una URL de verdad (`new URL()`
     * tira dentro de `urlDeMiniatura`), así que en este fixture el campo da
     * `null` y el `typeof valor !== 'string'` lo saltea solo: el `for` nunca
     * ejercitó la rama no nula. Es exactamente lo que sí publica el afiche y el
     * detalle no —es un **derivado** de `imagenes.url`, no una proyección de
     * `DetallePublico`— así que no puede pasar por el mismo criterio que el
     * resto de los campos; se verifica aparte, con una URL real, más abajo.
     */
    const detalle = detalleDeActividad(
      toPublic(actividadCentinela(), 'act_centinela'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    const afiche = carteleraDeDetalles([detalle])[0]!;
    const delDetalle = JSON.stringify(detalle);

    for (const [campo, valor] of Object.entries(afiche)) {
      if (campo === 'ruta' || campo === 'urlMiniatura' || typeof valor !== 'string' || valor === '')
        continue;
      expect(
        delDetalle.includes(valor),
        `la cartelera publica \`${campo}\` y la página de detalle no: o dejó de derivar de ` +
          '`DetallePublico`, o alguien le pasó el documento',
      ).toBe(true);
    }

    expect(afiche.ruta).toBe(`/actividad/${detalle.slug}/`);
  });

  it('la miniatura es lo único que la pared publica y el detalle no, y es una derivación pura del original', () => {
    /*
     * El caso que el `it` de arriba no puede cubrir: con una URL real de
     * Storage, `urlMiniatura` **sí** es un string no vacío, y sin este test la
     * afirmación de forma de arriba se pondría roja el día que alguien haga el
     * fixture realista — un caso legítimo, no una fuga — y la tentación va a
     * ser aflojar ese `for` en vez de escribir este caso.
     *
     * Lo que hace aceptable que la pared publique algo que el detalle no: es
     * una función **pura** de `imagenes.url` (que el detalle sí publica), sin
     * `storagePath` ni ningún dato que no esté ya en esa misma URL — y sin el
     * token del original, que sería un dato que la miniatura no necesita para
     * autorizar su lectura (`allow get: if true`, D-175).
     */
    const conFotoPropia = detalleDeActividad(
      toPublic(
        actividadCentinela({
          imagenes: [
            {
              id: 'img_1',
              url:
                'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/' +
                'imagenes%2Fimg_1.jpg?alt=media&token=tok',
              epigrafe: '',
              origen: 'propia',
              portada: true,
              storagePath: 'imagenes/img_1.jpg',
            },
          ],
        }),
        'act_miniatura',
      ),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    // D-210: sin confirmar el path en `miniaturasConocidas`, `urlMiniatura`
    // daría `null` — el argumento completo está en `docs/06-decisiones.md`
    // § D-210, no en el BACKLOG (la entrada de B-320 todavía describe el
    // diseño anterior). Acá se confirma a propósito porque lo que este `it`
    // quiere ejercitar es el caso «no nulo».
    const afiche = carteleraDeDetalles(
      [conFotoPropia],
      new Set(['miniaturas/img_1.jpg']),
    )[0]!;
    expect(afiche.urlMiniatura).toBe(urlDeMiniatura(afiche.url));
    expect(afiche.urlMiniatura).toContain('miniaturas%2Fimg_1.jpg');
    expect(afiche.urlMiniatura, 'la miniatura no lleva el token del original').not.toContain(
      'token=',
    );
  });

  it('una actividad sin afiche no aporta nada a la pared', () => {
    // Control negativo del barrido: sin este caso, una pared vacía pasaría el
    // aserto de arriba habiendo barrido un `[]`.
    expect(pared()).toHaveLength(1);
    const sinImagen = detalleDeActividad(
      toPublic(actividadCentinela({ imagenes: [] }), 'act_sin_imagen'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    expect(carteleraDeDetalles([sinImagen])).toEqual([]);
  });
});
