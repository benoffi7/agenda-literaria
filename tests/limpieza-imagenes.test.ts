/**
 * B-221 — nadie borra las imágenes propias que quedan huérfanas en Storage.
 *
 * Este archivo prueba la decisión pura de `functions/limpieza-imagenes.js`
 * (`decidirLimpieza`): qué objetos de `imagenes/` y `miniaturas/` hay que
 * borrar, dado el conjunto de `storagePath` que las actividades referencian
 * hoy. El pegamento con Storage/Firestore (`imagenes-limpieza-trigger.js`) no
 * se prueba acá: correr el barrido de verdad se hizo a mano contra el
 * emulador (`scripts/limpiar-imagenes-huerfanas.mjs`), documentado en
 * `docs/CHANGELOG.md`.
 *
 * **B-560** — y prueba `referenciasEnUso`, que desde entonces cuenta también
 * los `storagePath` que nombra el **historial** (`/actividades/{id}/versiones/*`,
 * §12): sin eso, el barrido borraba a las 72 horas la imagen que una versión
 * vieja todavía referencia, y restaurar esa versión devolvía una fila con una
 * `url` que da 404.
 */
import { describe, expect, it } from 'vitest';
import {
  MARGEN_DE_GRACIA_MS,
  MAX_BORRADOS_POR_CORRIDA,
  decidirLimpieza,
  referenciasEnUso,
} from '../functions/limpieza-imagenes.js';
import { rutaDeMiniatura } from '../functions/imagenes.js';

const HORA = 60 * 60 * 1000;
const AHORA = Date.parse('2026-09-10T12:00:00Z');
const VIEJO = AHORA - MARGEN_DE_GRACIA_MS - HORA; // más viejo que el margen
const RECIENTE = AHORA - HORA; // mucho más nuevo que el margen

describe('decidirLimpieza — qué objeto está huérfano', () => {
  it('un original referenciado no se borra, viejo o no', () => {
    const objetos = [{ nombre: 'imagenes/img_a.jpg', creado: VIEJO }];
    const { aBorrar, motivos } = decidirLimpieza({
      objetos,
      referenciados: new Set(['imagenes/img_a.jpg']),
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['imagenes/img_a.jpg']).toBe('referenciado');
  });

  it('un original viejo y sin referencia se borra', () => {
    // Mutación: comparar `refs.has` contra el string vacío o no filtrar nada
    // — este caso deja de estar en `aBorrar` y el test lo nota.
    const objetos = [{ nombre: 'imagenes/img_b.jpg', creado: VIEJO }];
    const { aBorrar, motivos } = decidirLimpieza({
      objetos,
      referenciados: new Set(),
      ahora: AHORA,
    });
    expect(aBorrar).toEqual(['imagenes/img_b.jpg']);
    expect(motivos['imagenes/img_b.jpg']).toBe('original-huerfano');
  });

  it('un original reciente y sin referencia NO se borra — el margen de gracia', () => {
    // Es el caso que existe la guarda para cubrir: alguien subió la imagen
    // hace un rato y todavía no guardó la actividad.
    //
    // Mutación: sacar el `if` del margen de gracia. Este caso se pone rojo.
    const objetos = [{ nombre: 'imagenes/img_c.jpg', creado: RECIENTE }];
    const { aBorrar, motivos } = decidirLimpieza({
      objetos,
      referenciados: new Set(),
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos['imagenes/img_c.jpg']).toBe('dentro-del-margen-de-gracia');
  });

  it('exactamente en el borde del margen se borra, un milisegundo más joven no', () => {
    // La comparación es `ahora - creado < MARGEN` (estricta): a exactamente
    // `MARGEN` de antigüedad, el objeto ya no está protegido.
    const justoEnElMargen = AHORA - MARGEN_DE_GRACIA_MS; // ahora - creado === MARGEN
    const unMsMasJoven = justoEnElMargen + 1; // ahora - creado === MARGEN - 1
    expect(
      decidirLimpieza({
        objetos: [{ nombre: 'imagenes/img_borde.jpg', creado: justoEnElMargen }],
        referenciados: new Set(),
        ahora: AHORA,
      }).aBorrar,
    ).toEqual(['imagenes/img_borde.jpg']);
    expect(
      decidirLimpieza({
        objetos: [{ nombre: 'imagenes/img_borde.jpg', creado: unMsMasJoven }],
        referenciados: new Set(),
        ahora: AHORA,
      }).aBorrar,
    ).toEqual([]);
  });

  it('la miniatura de un original referenciado sobrevive, aunque nadie la nombre en ningún documento', () => {
    // La miniatura es derivada (D-175): ningún documento guarda su ruta. Su
    // "referencia" es la de su original, vía `rutaDeMiniatura`.
    const original = 'imagenes/img_d.jpg';
    const miniatura = rutaDeMiniatura(original)!;
    const objetos = [{ nombre: miniatura, creado: VIEJO }];
    const { aBorrar, motivos } = decidirLimpieza({
      objetos,
      referenciados: new Set([original]),
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    expect(motivos[miniatura]).toBe('referenciado');
  });

  it('la miniatura de un original que YA NO se referencia se borra con ella', () => {
    // Mutación: no derivar `miniaturasReferenciadas` de `referenciados` (dejar
    // el set vacío a propósito, digamos) — coincide por accidente con este
    // caso, así que el `it` de arriba es el que atrapa esa mutación.
    const original = 'imagenes/img_e.jpg';
    const miniatura = rutaDeMiniatura(original)!;
    const objetos = [{ nombre: miniatura, creado: VIEJO }];
    const { aBorrar, motivos } = decidirLimpieza({
      objetos,
      referenciados: new Set(), // el original ya no está en ninguna actividad
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([miniatura]);
    expect(motivos[miniatura]).toBe('miniatura-huerfana');
  });

  it('acepta `referenciados` como array, no solo como Set', () => {
    const objetos = [{ nombre: 'imagenes/img_f.jpg', creado: VIEJO }];
    expect(
      decidirLimpieza({
        objetos,
        referenciados: ['imagenes/img_f.jpg'],
        ahora: AHORA,
      }).aBorrar,
    ).toEqual([]);
  });

  it('un objeto sin fecha de creación legible no se borra — falla cerrado', () => {
    // Mismo criterio que `convieneReemplazar` ante un dato que no entendemos:
    // ante la duda, no se toca.
    const objetos = [
      { nombre: 'imagenes/img_g.jpg', creado: NaN },
      { nombre: 'imagenes/img_h.jpg' }, // sin `creado` en absoluto
    ];
    const { aBorrar } = decidirLimpieza({ objetos, referenciados: new Set(), ahora: AHORA });
    expect(aBorrar).toEqual([]);
  });

  it('un objeto anidado o en otro prefijo queda fuera del alcance, no se borra', () => {
    // El barrido solo entiende un nivel bajo `imagenes/` y `miniaturas/` —
    // igual que `decidirOptimizacion` en `imagenes.js`.
    const objetos = [
      { nombre: 'imagenes/sub/img_i.jpg', creado: VIEJO },
      { nombre: 'otra-cosa/img_j.jpg', creado: VIEJO },
      { nombre: 'imagenes/', creado: VIEJO },
    ];
    const { aBorrar, motivos } = decidirLimpieza({
      objetos,
      referenciados: new Set(),
      ahora: AHORA,
    });
    expect(aBorrar).toEqual([]);
    for (const o of objetos) expect(motivos[o.nombre]).toBe('fuera-del-alcance');
  });

  it('el tope de la corrida corta la lista y deja el resto marcado como pendiente', () => {
    // Mismo criterio que `MAX_EVENTOS_RESYNC` en `index.js` (B-04): un bug en
    // `referenciados` no puede vaciar el bucket entero de una vez.
    //
    // Mutación: sacar el corte del tope. `aBorrar.length` sale
    // `MAX_BORRADOS_POR_CORRIDA + 5` en vez de `MAX_BORRADOS_POR_CORRIDA`.
    const objetos = Array.from({ length: MAX_BORRADOS_POR_CORRIDA + 5 }, (_, i) => ({
      nombre: `imagenes/img_tope_${i}.jpg`,
      creado: VIEJO,
    }));
    const { aBorrar, motivos } = decidirLimpieza({
      objetos,
      referenciados: new Set(),
      ahora: AHORA,
    });
    expect(aBorrar).toHaveLength(MAX_BORRADOS_POR_CORRIDA);
    const pendientes = Object.values(motivos).filter((m) => m.endsWith('-pendiente-por-tope'));
    expect(pendientes).toHaveLength(5);
  });

  it('sin objetos ni referencias no hay nada para borrar', () => {
    expect(decidirLimpieza({}).aBorrar).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// referenciasEnUso — el lado que sí toca Firestore (con un `db` falso)
// ─────────────────────────────────────────────────────────────────────

/**
 * Un `db` falso que registra qué le pidieron y devuelve los documentos que se
 * le pasen. Alcanza con `collection().select().get()` y
 * `collectionGroup().select().get()`, que es toda la superficie que
 * `referenciasEnUso` usa.
 *
 * Las dos listas son **independientes** a propósito, igual que en Firestore: una
 * versión puede existir sin que exista su actividad (subcolección huérfana de un
 * borrado, B-41/B-89), y eso es un caso que hay que poder escribir acá.
 */
const dbFalso = (
  documentos: Record<string, unknown>[],
  versiones: Record<string, unknown>[] = [],
) => {
  const llamadas: {
    coleccion?: string;
    campo?: string;
    grupo?: string;
    campoDeVersion?: string;
  } = {};
  const snap = (docs: Record<string, unknown>[]) => ({
    docs: docs.map((data) => ({ data: () => data })),
  });
  return {
    db: {
      collection: (coleccion: string) => {
        llamadas.coleccion = coleccion;
        return {
          select: (campo: string) => {
            llamadas.campo = campo;
            return { get: async () => snap(documentos) };
          },
        };
      },
      collectionGroup: (grupo: string) => {
        llamadas.grupo = grupo;
        return {
          select: (campo: string) => {
            llamadas.campoDeVersion = campo;
            return { get: async () => snap(versiones) };
          },
        };
      },
    },
    llamadas,
  };
};

describe('referenciasEnUso — qué storagePath están en uso hoy', () => {
  it('pide la colección actividades, proyectada a solo el campo imagenes', () => {
    // Es lo que impide que la Function tenga en memoria `difusion`,
    // `createdBy`/`updatedBy` o `online.url` de ninguna actividad (§5.1,
    // clase de D-159) — no hay ninguna razón para leer más que esto.
    //
    // Mutación: cambiar `.select('imagenes')` por `.get()` a secas (traer el
    // documento entero). Este `it` se pone rojo porque `llamadas.campo` deja
    // de ser `'imagenes'`.
    const { db, llamadas } = dbFalso([]);
    void referenciasEnUso(db as never);
    expect(llamadas.coleccion).toBe('actividades');
    expect(llamadas.campo).toBe('imagenes');
  });

  it('lee actividades de TODOS los estados, no solo publicadas', async () => {
    // Un borrador sigue siendo dueño de su imagen (§3.1): si el barrido solo
    // mirara publicadas, borraría la imagen de cualquier actividad en
    // borrador o pendiente apenas pasen los dos días de margen.
    //
    // Mutación: agregar `.where('estado', '==', 'publicado')` en
    // `referenciasEnUso`. Este `db` falso no tiene `.where`, así que la
    // Function rompería al llamarlo — y si en cambio se filtrara en JS
    // después de `.get()`, el storagePath del borrador no aparecería en el
    // Set y este `it` se pondría rojo.
    const { db } = dbFalso([
      { imagenes: [{ storagePath: 'imagenes/img_borrador.jpg' }] },
      // Sin `estado` en absoluto, como puede pasar en un documento real: no
      // tiene que importar para que la imagen cuente como en uso.
    ]);
    const referenciados = await referenciasEnUso(db as never);
    expect(referenciados.has('imagenes/img_borrador.jpg')).toBe(true);
  });

  it('junta storagePath de varias actividades y de varias imágenes por actividad', async () => {
    const { db } = dbFalso([
      { imagenes: [{ storagePath: 'imagenes/img_a.jpg' }, { storagePath: 'imagenes/img_b.jpg' }] },
      { imagenes: [{ storagePath: 'imagenes/img_c.jpg' }] },
      { imagenes: [] },
      {}, // sin campo `imagenes` en absoluto
    ]);
    const referenciados = await referenciasEnUso(db as never);
    expect([...referenciados].sort()).toEqual([
      'imagenes/img_a.jpg',
      'imagenes/img_b.jpg',
      'imagenes/img_c.jpg',
    ]);
  });

  it('una imagen externa (sin storagePath) no ensucia el set', async () => {
    // Las imágenes externas (DEC-7c) no tienen storagePath: no hay objeto de
    // Storage que les corresponda, así que no tienen nada que hacer acá.
    const { db } = dbFalso([{ imagenes: [{ url: 'https://ejemplo.com/flyer.jpg' }] }]);
    const referenciados = await referenciasEnUso(db as never);
    expect(referenciados.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-560 — el historial también referencia imágenes
// ─────────────────────────────────────────────────────────────────────

/**
 * La secuencia que estos casos existen para cerrar: se saca una fila de la
 * galería y se guarda → la imagen queda huérfana → el barrido la borra a las 72
 * horas → alguien restaura esa versión desde el historial y la fila vuelve con
 * una `url` que da 404. El arreglo de B-221 le había puesto una fecha de
 * vencimiento silenciosa a la función de restaurar del §12.
 */
describe('referenciasEnUso — el historial cuenta como referencia (B-560)', () => {
  it('pide también el historial: la collection group `versiones`, proyectada a solo `documento.imagenes`', () => {
    // Dos cosas en un caso, y las dos importan:
    //
    //  - **`collectionGroup` y no un recorrido por actividad.** Es una sola
    //    query en vez de N, y es lo único que ve las subcolecciones de
    //    actividades **borradas** (el caso de más abajo): una query sobre
    //    `/actividades` no las devuelve — por eso `subcoleccionesHuerfanas`, en
    //    `limpieza-versiones.js`, necesita `listDocuments()`.
    //  - **`select('documento.imagenes')`.** Una versión guarda el `before`
    //    entero (D-41): sin el select, la Function tendría en memoria una copia
    //    completa de cada versión de cada actividad —`online.url`, `difusion`,
    //    `createdBy`— para leerle un array de paths. Es el mismo cuidado del
    //    `it` gemelo de arriba (§5.1), y acá pesa veinte veces más.
    //
    // MUTACIÓN PROBADA: cambiar `.select(CAMPO_IMAGENES_DE_VERSION)` por `.get()`
    // a secas deja `llamadas.campoDeVersion` en `undefined` y este caso se pone
    // rojo. Sacar la query entera deja también `llamadas.grupo` en `undefined`.
    const { db, llamadas } = dbFalso([], []);
    void referenciasEnUso(db as never);
    expect(llamadas.grupo).toBe('versiones');
    expect(llamadas.campoDeVersion).toBe('documento.imagenes');
  });

  it('un storagePath que hoy SOLO vive en una versión del historial cuenta como en uso', async () => {
    // El caso de B-560 tal cual: la actividad ya no nombra la imagen —la fila se
    // sacó de la galería— pero la versión anterior sí, y restaurarla la trae de
    // vuelta.
    //
    // MUTACIÓN PROBADA: sacar el `for` que recorre `versiones.docs` —o volver
    // `referenciasEnUso` a leer solo `/actividades`, que es el estado anterior a
    // B-560—. El Set queda solo con `img_actual` y este caso se pone rojo.
    const { db } = dbFalso(
      [{ imagenes: [{ storagePath: 'imagenes/img_actual.jpg' }] }],
      [{ documento: { imagenes: [{ storagePath: 'imagenes/img_sacada.jpg' }] } }],
    );
    const referenciados = await referenciasEnUso(db as never);
    expect([...referenciados].sort()).toEqual([
      'imagenes/img_actual.jpg',
      'imagenes/img_sacada.jpg',
    ]);
  });

  it('la versión de una actividad que YA NO existe también cuenta — el rescate de B-41', () => {
    // Borrar una actividad escribe su última versión (`guardarVersionAlBorrar`),
    // que es la única copia de la que se la puede recuperar entera, y
    // `limpiarVersionesHuerfanas` le da 30 días de rescate (B-89). Sus imágenes,
    // en cambio, se iban a las 72 horas: el rescate devolvía la actividad con la
    // galería rota. Acá la lista de actividades vivas está **vacía** y la imagen
    // igual cuenta.
    //
    // MUTACIÓN PROBADA: leer las versiones actividad por actividad, recorriendo
    // `/actividades` (que es la forma "obvia" de hacerlo sin `collectionGroup`).
    // La subcolección huérfana no aparecería por ningún lado y este caso se pone
    // rojo — con el `db` falso, porque la lista de actividades está vacía; contra
    // el emulador, porque la query no devuelve documentos que no existen.
    const { db } = dbFalso(
      [],
      [{ documento: { imagenes: [{ storagePath: 'imagenes/img_de_borrada.jpg' }] } }],
    );
    return expect(referenciasEnUso(db as never)).resolves.toEqual(
      new Set(['imagenes/img_de_borrada.jpg']),
    );
  });

  it('la misma imagen en la actividad y en su versión entra una sola vez', async () => {
    // Es un Set y tiene que seguir siéndolo: `decidirLimpieza` hace `refs.has()`,
    // y el script en seco imprime `referenciados.size`. Si esto pasara a ser un
    // array, las dos cosas seguirían "funcionando" y el conteo mentiría.
    const { db } = dbFalso(
      [{ imagenes: [{ storagePath: 'imagenes/img_x.jpg' }] }],
      [
        { documento: { imagenes: [{ storagePath: 'imagenes/img_x.jpg' }] } },
        { documento: { imagenes: [{ storagePath: 'imagenes/img_x.jpg' }] } },
      ],
    );
    const referenciados = await referenciasEnUso(db as never);
    expect(referenciados.size).toBe(1);
  });

  it('una versión sin `imagenes`, sin `documento`, o con una imagen externa, no rompe ni ensucia', async () => {
    // Las tres formas reales de una versión que no aporta nada:
    //
    //  - la de una edición que no tocó la galería: el `select` de un campo que
    //    el documento no tiene devuelve `{}` (comprobado contra el emulador);
    //  - la de una actividad anterior a B-167, que tenía `imagenUrl` y no
    //    `imagenes` (el aviso del §3.1);
    //  - una imagen externa (DEC-7c), que no tiene `storagePath` porque no hay
    //    ningún objeto de Storage que le corresponda.
    //
    // MUTACIÓN PROBADA: sacarle el `?.` a `doc.data()?.documento?.imagenes` — el
    // primer caso tira `TypeError` y el `it` se pone rojo. Sacar la guarda
    // `if (imagen?.storagePath)` mete un `undefined` en el Set y el `size` deja
    // de ser 0.
    const { db } = dbFalso(
      [],
      [
        {}, // el `select` no encontró el campo
        { documento: {} },
        { documento: { imagenUrl: 'https://viejo/flyer.jpg' } },
        { documento: { imagenes: [] } },
        { documento: { imagenes: [{ url: 'https://ejemplo.com/flyer.jpg' }] } },
      ],
    );
    const referenciados = await referenciasEnUso(db as never);
    expect(referenciados.size).toBe(0);
  });

  it('una imagen que no nombra ni una actividad ni ninguna versión sigue estando huérfana', async () => {
    // Control negativo, y es el que impide que el arreglo se convierta en «no
    // borrar nunca nada»: el objeto del bucket que nadie referencia tiene que
    // seguir cayendo en `aBorrar`. Se prueba el camino entero —lo que
    // `referenciasEnUso` devuelve, entrando a `decidirLimpieza`— porque la
    // regresión que importa es esa, no el Set solo.
    const { db } = dbFalso(
      [{ imagenes: [{ storagePath: 'imagenes/img_actual.jpg' }] }],
      [{ documento: { imagenes: [{ storagePath: 'imagenes/img_sacada.jpg' }] } }],
    );
    const referenciados = await referenciasEnUso(db as never);
    const { aBorrar, motivos } = decidirLimpieza({
      objetos: [
        { nombre: 'imagenes/img_actual.jpg', creado: VIEJO },
        { nombre: 'imagenes/img_sacada.jpg', creado: VIEJO },
        { nombre: 'imagenes/img_de_nadie.jpg', creado: VIEJO },
      ],
      referenciados,
      ahora: AHORA,
    });
    expect(aBorrar).toEqual(['imagenes/img_de_nadie.jpg']);
    expect(motivos['imagenes/img_sacada.jpg']).toBe('referenciado');
  });
});
