/**
 * **La imagen de una propuesta** — B-830 paso 8 (DEC-11) y **B-863**.
 *
 * Es el objeto más delicado del bucket: lo sube alguien **sin login**, no es
 * público, y su ciclo de vida no lo decide una persona sino el estado de su
 * propuesta — se promueve al aceptar y se borra **al cerrarla**, sea por el
 * rechazo (en el acto) o por la aceptación (cuando la copia promovida ya existe
 * y la reemplaza, B-863).
 *
 * Este archivo prueba lo que se puede sin emuladores: la decisión de borrado y
 * el **orden** de las dos operaciones de B-863 (`functions/propuestas.js`), la
 * atadura del prefijo entre los cuatro runtimes que lo escriben, y que el
 * trigger de optimización lo ignore (trampa 12). Las reglas de verdad se prueban
 * contra el emulador en `tests/storage-reglas.integracion.test.ts`, y el ciclo
 * completo de una aceptación en `tests/propuestas-imagen.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  borrarOriginalAlAceptar,
  copiasEnLaGaleria,
  decidirBorradoDeImagen,
} from '../functions/propuestas.js';
import { decidirOptimizacion, PREFIJO_ORIGINALES } from '../functions/imagenes.js';
import { esDePrimerNivel } from '../functions/limpieza-imagenes.js';
import {
  PREFIJO_PROPUESTAS as PREFIJO_DE_LA_FUNCTION,
  objetoDePropuesta,
} from '../functions/retencion.js';
import {
  PREFIJO_PROPUESTAS,
  nuevaImagenPropuestaId,
  rutaDeImagenPropuesta,
} from '@/lib/imagenes-archivo';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const OBJETO = 'propuestas/prop_abc-123.jpg';
const ACTIVIDAD = 'act_de_la_propuesta';
const propuesta = (over: Record<string, unknown> = {}) => ({
  estado: 'nueva',
  imagen: { storagePath: OBJETO },
  revision: { porUid: 'uid_admin', en: null, actividadId: null, motivo: null },
  ...over,
});

/** Una aceptada como la escribe `alGuardar`: con el id de la actividad creada. */
const aceptada = (over: Record<string, unknown> = {}) =>
  propuesta({
    estado: 'aceptada',
    revision: { porUid: 'uid_admin', en: null, actividadId: ACTIVIDAD, motivo: null },
    ...over,
  });

describe('decidirBorradoDeImagen — cerrar una propuesta se lleva la foto (DEC-11, B-863)', () => {
  it('rechazar borra la imagen, y solo en la transición', () => {
    expect(
      decidirBorradoDeImagen({
        before: propuesta({ estado: 'en-revision' }),
        after: propuesta({ estado: 'rechazada' }),
      }),
    ).toEqual({ accion: 'borrar', objeto: OBJETO, motivo: 'rechazada', actividadId: null, dejaLaFoto: false });

    /*
     * **Solo la transición**, y el caso vale por sí solo: la entrega de eventos
     * de Firestore es «al menos una vez» y cualquier escritura sobre una
     * propuesta ya rechazada volvería a llamar a Storage. Hoy sería inofensivo
     * (`ignoreNotFound`), y sería igual una llamada por escritura.
     *
     * MUTACIÓN PROBADA: sacando el corte de `before?.estado === 'rechazada'`,
     * este caso se pone rojo y el de arriba sigue verde.
     */
    const { accion, motivo } = decidirBorradoDeImagen({
      before: propuesta({ estado: 'rechazada' }),
      after: propuesta({ estado: 'rechazada' }),
    });
    expect(accion).toBe('ignorar');
    expect(motivo).toBe('ya-estaba-rechazada');
  });

  /**
   * **B-863 — aceptar también cierra, y también se lleva el original.**
   *
   * Y el momento no es una elección de este test: la transición a `aceptada` es,
   * por **D-600**, exactamente «la actividad ya se guardó» —el panel no escribe
   * nada al apretar «Convertir»—, así que un trigger sobre esa transición
   * **no puede** correr en el primer momento. Ese es el punto delicado del ítem:
   * borrar al abrir el formulario deja la propuesta sin flyer sin haber sido
   * aceptada nunca, porque la copia promovida se la lleva
   * `limpiarImagenesHuerfanas` a las 72 horas si el admin abandona.
   *
   * MUTACIÓN PROBADA: sacando `'aceptada'` de `ESTADOS_QUE_CIERRAN`, este caso se
   * pone rojo y todos los del rechazo siguen verdes.
   */
  it('aceptar también borra el original, y lleva el id de la actividad para verificar', () => {
    expect(
      decidirBorradoDeImagen({
        before: propuesta({ estado: 'en-revision' }),
        after: aceptada(),
      }),
    ).toEqual({
      accion: 'borrar',
      objeto: OBJETO,
      motivo: 'aceptada',
      actividadId: ACTIVIDAD,
      dejaLaFoto: false,
    });

    /*
     * Misma guarda de transición que el rechazo, y por el mismo motivo: sin ella
     * cualquier escritura sobre una aceptada volvería a llamar a Storage.
     *
     * MUTACIÓN PROBADA: cambiando la guarda por `before?.estado === 'rechazada'`,
     * este aserto se pone rojo y el del rechazo sigue verde.
     */
    const { accion, motivo } = decidirBorradoDeImagen({
      before: aceptada(),
      after: aceptada(),
    });
    expect(accion).toBe('ignorar');
    expect(motivo).toBe('ya-estaba-aceptada');
  });

  /**
   * **Aceptada sin `actividadId` no borra nada** (B-863). No es defensivo de
   * más: `revisionValida()` pide que el campo **esté**, no que tenga valor, así
   * que una propuesta marcada `aceptada` a mano desde la consola llega acá con
   * `null`. Sin el id no hay dónde verificar que la copia existe, y sin esa
   * verificación el borrado es exactamente lo que este ítem decidió no hacer.
   *
   * MUTACIÓN PROBADA: sacando el corte, este caso se pone rojo — y la mutación
   * es peligrosa de verdad, porque `borrarOriginalAlAceptar` recibiría
   * `actividadId: null` y leería `actividades/null`.
   */
  it('una aceptada sin actividad no borra: no hay dónde verificar la copia', () => {
    for (const revision of [
      { porUid: 'u', en: null, actividadId: null, motivo: null },
      { porUid: 'u', en: null, actividadId: '', motivo: null },
      undefined,
    ]) {
      const { accion, objeto, motivo, dejaLaFoto } = decidirBorradoDeImagen({
        before: propuesta(),
        after: propuesta({ estado: 'aceptada', revision }),
      });
      expect(accion, JSON.stringify(revision)).toBe('ignorar');
      expect(objeto, JSON.stringify(revision)).toBeNull();
      expect(motivo, JSON.stringify(revision)).toBe('aceptada-sin-actividad');
      /*
       * **Y avisa**, que es lo que lo separa de un «ignorar» sano — lo pidió el
       * `auditor-privacidad`. El estado del mundo es el mismo que el de
       * `sin-copia`: una aceptada que no vence con la foto de un tercero en un
       * prefijo que nadie barre. Sin esta bandera el trigger lo logueaba en
       * `debug`, o sea invisible.
       *
       * MUTACIÓN PROBADA: sacando el `true` de este `nada(...)`, este aserto se
       * pone rojo y el resto del caso sigue verde.
       */
      expect(dejaLaFoto, JSON.stringify(revision)).toBe(true);
    }
  });

  it('los estados que no cierran no borran nada', () => {
    for (const estado of ['nueva', 'en-revision']) {
      const { accion, motivo } = decidirBorradoDeImagen({
        before: propuesta(),
        after: propuesta({ estado }),
      });
      expect(accion, estado).toBe('ignorar');
      expect(motivo, estado).toBe(`estado-${estado}`);
    }
  });

  it('borrar el documento tampoco: de eso se ocupa la retención, y en orden', () => {
    /*
     * El único que borra documentos de `/propuestas` es
     * `borrarPropuestasVencidas`, que borra el objeto **primero** y el documento
     * después. Actuar también acá sería un segundo borrado en carrera con aquel
     * —el error que B-89 documenta para dos triggers del mismo evento— y encima
     * llegaría cuando el objeto ya no está.
     */
    const { accion, motivo } = decidirBorradoDeImagen({
      before: propuesta({ estado: 'rechazada' }),
      after: null,
    });
    expect(accion).toBe('ignorar');
    expect(motivo).toBe('propuesta-borrada');
  });

  it('una imagen de afuera no es nuestra y no se toca, cierre como cierre', () => {
    // La otra forma de `ImagenPropuesta`: `{ url }`. Y la ausencia de imagen.
    // Se recorren **los dos** cierres: la guarda vive antes de la bifurcación y
    // el día que alguien la mueva adentro de una sola rama, esto lo dice.
    for (const estado of ['rechazada', 'aceptada']) {
      for (const imagen of [{ url: 'https://ejemplo.test/f.jpg' }, null]) {
        const { accion, motivo } = decidirBorradoDeImagen({
          before: propuesta({ estado: 'nueva' }),
          after: aceptada({ estado, imagen }),
        });
        expect(accion, `${estado} ${JSON.stringify(imagen)}`).toBe('ignorar');
        expect(motivo, `${estado} ${JSON.stringify(imagen)}`).toBe('sin-imagen-propia');
      }
    }
  });

  /**
   * **La guarda que importa**, y es la misma que la de la retención por el mismo
   * motivo: este trigger corre con el Admin SDK y **no pasa por
   * `firestore.rules`**, así que el `matches('^propuestas/…')` que valida la
   * escritura no lo protege. Un documento que nombrara el flyer de una actividad
   * publicada haría que rechazar una propuesta se lo llevara del sitio, en vivo.
   *
   * Y está **importada** de `retencion.js`, no copiada: dos versiones de «qué
   * objeto es nuestro» divergen y una queda vieja (B-88).
   */
  it('un `storagePath` de otro prefijo no se borra, y se distingue de «no hay imagen»', () => {
    for (const estado of ['rechazada', 'aceptada']) {
      for (const path of [
        'imagenes/img_de_otra.jpg',
        'propuestas/sub/x.jpg',
        'propuestas/../x.jpg',
      ]) {
        const { accion, objeto, motivo, dejaLaFoto } = decidirBorradoDeImagen({
          before: propuesta({ estado: 'nueva' }),
          after: aceptada({ estado, imagen: { storagePath: path } }),
        });
        expect(accion, `${estado} ${path}`).toBe('ignorar');
        expect(objeto, `${estado} ${path}`).toBeNull();
        /*
         * **Avisa solo en la aceptada**, y la asimetría es la decisión: sobre una
         * rechazada el barrido de retención va a pasar por ese documento en 30
         * días y alguien va a ver el desajuste; sobre una aceptada no pasa nadie
         * nunca.
         *
         * MUTACIÓN PROBADA: poniendo `true` fijo, la mitad de `rechazada` se
         * pone roja; poniendo `false` fijo, la de `aceptada`.
         */
        expect(dejaLaFoto, `${estado} ${path}`).toBe(estado === 'aceptada');
        // El motivo los separa a propósito: «no hay imagen propia» es el caso
        // frecuente y sano; éste es un documento que alguien escribió mal, y en el
        // log tiene que poder distinguirse.
        expect(motivo, `${estado} ${path}`).toBe('imagen-fuera-del-prefijo');
      }
    }
  });
});

/**
 * **La verificación de B-863, y el orden que la hace valer.**
 *
 * Estos casos usan dobles del `db` y del `bucket` a propósito y no el emulador:
 * lo que hay que medir es **el orden de las llamadas**, y el orden no se ve
 * desde el resultado cuando las dos operaciones salen bien. El emulador prueba
 * la otra mitad —que los paths sean los que el bucket conoce— en
 * `tests/propuestas-imagen.integracion.test.ts`.
 *
 * Es el mismo problema que B-838 resolvió mirando el fuente con `indexOf`; acá
 * hay una costura por donde inyectar, así que se mide el comportamiento, que
 * muerde más: una inversión del orden no solo cambia dónde está escrita la
 * línea, cambia lo que queda en el bucket.
 */
describe('borrarOriginalAlAceptar — verificar la copia, después borrar el original (B-863)', () => {
  /**
   * Dobles que **anotan qué se hizo y en qué orden**. El `db` devuelve el
   * documento por `getAll` con máscara, igual que el código real.
   */
  const dobles = ({
    actividades = {} as Record<string, unknown>,
    enElBucket = [] as string[],
  } = {}) => {
    const pasos: string[] = [];
    const mascaras: unknown[] = [];
    const vivos = new Set(enElBucket);

    const db = {
      collection: (nombre: string) => ({ doc: (id: string) => ({ nombre, id }) }),
      getAll: async (ref: { id: string }, opciones: { fieldMask?: string[] }) => {
        mascaras.push(opciones?.fieldMask);
        const datos = actividades[ref.id];
        pasos.push(`leer:${ref.id}`);
        return [{ exists: datos !== undefined, data: () => datos }];
      },
    };

    const bucket = {
      file: (nombre: string) => ({
        exists: async () => {
          pasos.push(`existe?:${nombre}`);
          return [vivos.has(nombre)];
        },
        delete: async () => {
          pasos.push(`borrar:${nombre}`);
          vivos.delete(nombre);
        },
      }),
    };

    return { db, bucket, pasos, mascaras, vivos };
  };

  const COPIA = 'imagenes/img_promovida.jpg';
  const galeria = (paths: string[]) => ({
    imagenes: paths.map((storagePath, i) => ({ id: `img_${i}`, storagePath, portada: i === 0 })),
  });

  /**
   * El caso feliz, y lo que afirma no es «se borró» sino **en qué orden**.
   *
   * MUTACIÓN PROBADA: moviendo el `bucket.file(objeto).delete(...)` arriba del
   * `for` que pregunta por la copia, este caso se pone rojo por el orden de
   * `pasos` — y ningún otro caso de este archivo se entera, que es exactamente
   * el falso verde que justifica el aserto.
   */
  it('primero pregunta si la copia está, y recién entonces borra el original', async () => {
    const { db, bucket, pasos, vivos } = dobles({
      actividades: { [ACTIVIDAD]: galeria([COPIA]) },
      enElBucket: [COPIA, OBJETO],
    });

    expect(await borrarOriginalAlAceptar(db, bucket, { objeto: OBJETO, actividadId: ACTIVIDAD }))
      .toBe('borrado');

    expect(pasos).toEqual([`leer:${ACTIVIDAD}`, `existe?:${COPIA}`, `borrar:${OBJETO}`]);
    expect(vivos.has(COPIA), 'la copia promovida no se toca').toBe(true);
    expect(vivos.has(OBJETO), 'el original de la propuesta se fue').toBe(false);
  });

  /**
   * **El caso por el que existe el orden.** Si la actividad se guardó sin
   * ninguna imagen propia —la promoción falló y el panel avisó, o el admin sacó
   * la fila— el original **se conserva**: es la única copia que queda de la foto
   * que mandó el tercero, y borrarla no se deshace.
   *
   * MUTACIÓN PROBADA: sacando el `return 'sin-copia'`, este caso se pone rojo
   * con el original borrado, que es el daño irreversible que el ítem nombra.
   */
  it('sin copia en la actividad no borra nada, que es el lado barato de equivocarse', async () => {
    for (const [caso, imagenes] of [
      ['galería vacía', []],
      ['solo una imagen de afuera', [{ id: 'i', url: 'https://ejemplo.test/f.jpg' }]],
      // El caso que la guarda de prefijo tiene que atrapar: una fila que apunta
      // al **propio original**. Sin el `startsWith`, el original se verificaría
      // contra sí mismo y el borrado se autorizaría siempre.
      ['una fila que apunta al original', [{ id: 'i', storagePath: OBJETO }]],
      // Y la otra guarda: un segundo segmento debajo del prefijo no es una
      // imagen de galería (mismo criterio que `objetoDePropuesta`).
      ['un path anidado', [{ id: 'i', storagePath: 'imagenes/sub/x.jpg' }]],
    ] as [string, unknown[]][]) {
      const { db, bucket, pasos, vivos } = dobles({
        actividades: { [ACTIVIDAD]: { imagenes } },
        enElBucket: [OBJETO],
      });

      expect(
        await borrarOriginalAlAceptar(db, bucket, { objeto: OBJETO, actividadId: ACTIVIDAD }),
        caso,
      ).toBe('sin-copia');
      expect(pasos, caso).toEqual([`leer:${ACTIVIDAD}`]);
      expect(vivos.has(OBJETO), caso).toBe(true);
    }
  });

  /**
   * **Que el documento la nombre no alcanza**, y no es paranoia: una copia
   * promovida que se queda huérfana más de 72 horas —el formulario abierto un
   * fin de semana largo— se la lleva `limpiarImagenesHuerfanas` antes de que la
   * actividad se guarde. Ahí el documento nombra un objeto muerto y borrar el
   * original perdería la foto entera.
   *
   * MUTACIÓN PROBADA: sacando el `exists()` y dando por buena la referencia del
   * documento, este caso se pone rojo con el original borrado.
   */
  it('si la copia que nombra el documento no está en el bucket, tampoco borra', async () => {
    const { db, bucket, pasos, vivos } = dobles({
      actividades: { [ACTIVIDAD]: galeria([COPIA]) },
      enElBucket: [OBJETO],
    });

    expect(await borrarOriginalAlAceptar(db, bucket, { objeto: OBJETO, actividadId: ACTIVIDAD }))
      .toBe('copia-sin-objeto');
    expect(pasos).toEqual([`leer:${ACTIVIDAD}`, `existe?:${COPIA}`]);
    expect(vivos.has(OBJETO)).toBe(true);
  });

  it('con varias imágenes alcanza con que una esté, y no se pregunta de más', async () => {
    const OTRA = 'imagenes/img_otra.jpg';
    const { db, bucket, pasos } = dobles({
      actividades: { [ACTIVIDAD]: galeria([COPIA, OTRA]) },
      enElBucket: [COPIA, OTRA, OBJETO],
    });

    expect(await borrarOriginalAlAceptar(db, bucket, { objeto: OBJETO, actividadId: ACTIVIDAD }))
      .toBe('borrado');
    // Corta en la primera que existe: una llamada a Storage por imagen es lo
    // que este `break` evita.
    expect(pasos).toEqual([`leer:${ACTIVIDAD}`, `existe?:${COPIA}`, `borrar:${OBJETO}`]);
  });

  /**
   * **La guarda del prefijo, otra vez y adentro de la función que borra** — lo
   * pidió el `auditor-privacidad` sobre este mismo cambio.
   *
   * `objetoDePropuesta` empareja la guarda con el valor: si el path no es
   * nuestro, no hay objeto. Partir la decisión del efecto rompía ese
   * emparejamiento — esta función recibía `objeto` como string libre, verificaba
   * una condición sobre **otra cosa** (la galería) y borraba. Hoy el único
   * llamador la alimenta desde la decisión guardada; el riesgo es el próximo,
   * que va a existir (un backfill de B-871, el script en seco), y lo que está
   * del otro lado es el flyer de una actividad **publicada**, borrado en vivo.
   *
   * MUTACIÓN PROBADA: sacando la línea del `objeto-ajeno`, este caso se pone
   * rojo con `imagenes/img_de_otra.jpg` borrado — y ningún otro se entera,
   * porque los demás le pasan siempre un objeto legítimo.
   */
  it('no borra un objeto que no está en `propuestas/`, aunque se lo pidan', async () => {
    for (const ajeno of [
      'imagenes/img_de_otra.jpg',
      'miniaturas/img_de_otra.jpg',
      'propuestas/sub/x.jpg',
      'propuestas/',
      '',
    ]) {
      const { db, bucket, pasos, vivos } = dobles({
        actividades: { [ACTIVIDAD]: galeria([COPIA]) },
        enElBucket: [COPIA, ajeno],
      });

      expect(
        await borrarOriginalAlAceptar(db, bucket, { objeto: ajeno, actividadId: ACTIVIDAD }),
        ajeno,
      ).toBe('objeto-ajeno');
      // Ni siquiera llega a leer la actividad: la guarda es lo primero.
      expect(pasos, ajeno).toEqual([]);
      expect(vivos.has(ajeno), ajeno).toBe(true);
    }
  });

  it('si la actividad no existe, no borra: no hay contra qué verificar', async () => {
    const { db, bucket, vivos } = dobles({ actividades: {}, enElBucket: [OBJETO] });

    expect(await borrarOriginalAlAceptar(db, bucket, { objeto: OBJETO, actividadId: ACTIVIDAD }))
      .toBe('sin-actividad');
    expect(vivos.has(OBJETO)).toBe(true);
  });

  /**
   * **La lectura trae `imagenes` y nada más** (§5.1). Un `get()` pelado dejaría
   * en memoria de la Function el `online.url`, la `difusion` y los uids de la
   * actividad para leerle un array de paths — el mismo cuidado que el
   * `select('imagenes')` de `limpieza-imagenes.js` y que el `fieldMask: []` de
   * `borrarPropuesta`.
   *
   * Se afirma sobre la llamada y no sobre el resultado por lo mismo que allá:
   * desde el resultado no se distingue una lectura con máscara de una sin.
   *
   * MUTACIÓN PROBADA: cambiando la máscara por `['imagenes', 'difusion']`, este
   * caso se pone rojo y todos los demás siguen verdes.
   */
  it('la actividad se lee con máscara: solo `imagenes`', async () => {
    const { db, bucket, mascaras } = dobles({
      actividades: { [ACTIVIDAD]: galeria([COPIA]) },
      enElBucket: [COPIA, OBJETO],
    });

    await borrarOriginalAlAceptar(db, bucket, { objeto: OBJETO, actividadId: ACTIVIDAD });
    expect(mascaras).toEqual([['imagenes']]);
  });
});

/**
 * **El cableado del trigger, afirmado sobre el fuente** — y esto no es celo: es
 * la única parte de B-863 que ningún test puede ejercitar.
 *
 * `propuestas-trigger.js` no se puede importar desde la suite (arrastra
 * `firebase-functions/v2/firestore`, ausente del `node_modules` de la raíz —
 * B-561), así que la unión entre «la decisión dijo `aceptada`» y «se llama a
 * `borrarOriginalAlAceptar`» no la mira nadie más. Y si esa unión se rompe, el
 * modo de falla es **el peor de todos**: la aceptada cae en el borrado crudo del
 * rechazo, el original se va sin que nadie haya verificado la copia, y toda la
 * suite queda verde.
 *
 * Por eso el trigger está escrito como `if/else` y no como dos `if` con un
 * `return` en el medio, y por eso se afirma que el borrado crudo vive **adentro
 * del `else`**.
 */
describe('el trigger cablea las dos ramas, y el borrado crudo vive solo en el rechazo', () => {
  it('la aceptada pasa por la verificación y no por el `delete` directo', () => {
    const src = fuente('functions/propuestas-trigger.js');

    const rama = src.indexOf("if (motivo === 'aceptada') {");
    const verificado = src.indexOf('borrarOriginalAlAceptar(', rama);
    const sino = src.indexOf('} else {', verificado);
    const crudo = src.indexOf('.file(objeto).delete(', verificado);

    // Controles positivos: si alguno no se encuentra, los asertos de abajo
    // compararían contra `-1` y pasarían sin mirar nada.
    expect(rama, 'no se encontró la rama de la aceptada').toBeGreaterThan(0);
    expect(verificado, 'la rama de la aceptada no llama a `borrarOriginalAlAceptar`').toBeGreaterThan(rama);
    expect(sino, 'la bifurcación dejó de ser `if/else`').toBeGreaterThan(verificado);
    expect(crudo, 'no se encontró el borrado directo del rechazo').toBeGreaterThan(0);

    /*
     * **El borrado sin verificar está después del `else`**, o sea en la rama del
     * rechazo y en ninguna otra.
     *
     * MUTACIÓN PROBADA (dos): cambiando el `} else {` por `}` + `if (true) {`,
     * este caso se pone rojo; y moviendo el `delete` crudo arriba de la
     * bifurcación —el refactor que de verdad haría daño— también.
     */
    expect(crudo, 'el borrado sin verificar tiene que vivir adentro del `else`').toBeGreaterThan(sino);

    // Y hay **uno solo**: un segundo borrado crudo en cualquier otra rama sería
    // la misma pérdida por otra puerta.
    expect([...src.matchAll(/\.file\(objeto\)\.delete\(/g)]).toHaveLength(1);
  });

  /**
   * El log del caso «no se pudo borrar» lleva `alerta`, que es lo que hace
   * filtrable el agujero de **B-871** — mismo patrón que `rebuild-agotado`
   * (B-21). Sin el campo, el único rastro sería el texto del mensaje, que se
   * rompe en silencio el día que alguien lo reescriba.
   */
  /**
   * **Cada camino que emite la alerta tiene su fila en el runbook** — lo pidió
   * el `auditor-privacidad`, y es la red que faltaba: cuando `dejaLaFoto` sumó
   * dos caminos nuevos, la tabla de `08-operacion.md` se quedó con los cuatro
   * viejos y **nada se puso rojo**. El operador con el log en la mano habría
   * buscado su `motivo` en el runbook y no lo habría encontrado — que es el
   * momento exacto en que un runbook deja de servir.
   *
   * Los dos vocabularios se **derivan del fuente** y no se escriben acá (§05,
   * «la lista se deriva del código»): los `resultado` salen del `@returns` de
   * `borrarOriginalAlAceptar`, los `motivo` de los `nada(..., true)`. Así, un
   * camino nuevo entra solo y esto se pone rojo hasta que alguien escriba la
   * fila.
   */
  it('cada motivo y cada resultado que emite la alerta tiene su fila en el runbook', () => {
    const src = fuente('functions/propuestas.js');
    const runbook = fuente('docs/08-operacion.md');

    // Los `resultado` del borrado, del `@returns`. Se saca `'borrado'`: ése es
    // el camino feliz y no emite ninguna alerta.
    const union = /@returns \{Promise<([^>]+)>\}/.exec(src)?.[1] ?? '';
    const resultados = [...union.matchAll(/'([a-z-]+)'/g)]
      .map((m) => m[1]!)
      .filter((r) => r !== 'borrado');

    // Los `motivo` que la decisión marca con `dejaLaFoto`.
    const motivos = [...src.matchAll(/nada\('([a-z-]+)',[^)]*\btrue\b/g)].map((m) => m[1]!);
    const conAlerta = [...src.matchAll(/nada\('([a-z-]+)', after\.estado === 'aceptada'\)/g)].map(
      (m) => m[1]!,
    );

    const caminos = [...resultados, ...motivos, ...conAlerta];

    // Controles positivos: si las extracciones vinieran vacías, el `for` de
    // abajo no verificaría nada y esto pasaría en verde.
    expect(resultados.length, 'no se extrajeron los `resultado` del `@returns`').toBeGreaterThan(2);
    expect(motivos.length + conAlerta.length, 'no se extrajeron los `motivo` con alerta').toBeGreaterThan(1);

    for (const camino of caminos) {
      expect(runbook, `«${camino}» no tiene fila en el runbook de 08-operacion.md`).toContain(
        `| \`${camino}\` |`,
      );
    }
  });

  it('los tres caminos que dejan la foto viva se pueden filtrar por `alerta`', () => {
    const src = fuente('functions/propuestas-trigger.js');
    /*
     * Tres y no dos: los dos del `try`/`catch` de la rama de la aceptada, más el
     * de `dejaLaFoto` en la rama de ignorar, que agregó el
     * `auditor-privacidad`. Ese tercero es el que faltaba: salía por `debug` con
     * el mismo estado del mundo que los otros dos, y este aserto —cuando decía
     * `2`— lo habría congelado así.
     */
    expect([...src.matchAll(/alerta: 'flyer-de-propuesta-sin-borrar'/g)]).toHaveLength(3);
  });
});

/**
 * `copiasEnLaGaleria` es el hermano de `objetoDePropuesta` para el otro
 * prefijo, y sus guardas protegen una **afirmación** en vez de un borrado — que
 * es por qué tienen que ser igual de estrictas: una afirmación laxa autoriza el
 * borrado que la estricta frenaría.
 */
describe('copiasEnLaGaleria — qué cuenta como «la copia promovida»', () => {
  it('solo los `storagePath` de primer nivel bajo `imagenes/`', () => {
    expect(
      copiasEnLaGaleria([
        { storagePath: 'imagenes/img_a.jpg' },
        { storagePath: 'imagenes/sub/img_b.jpg' },
        { storagePath: 'propuestas/prop_c.jpg' },
        { url: 'https://ejemplo.test/d.jpg' },
        { storagePath: 'imagenes/' },
        null,
        'no-es-un-objeto',
        { storagePath: 'imagenes/img_e.png' },
      ]),
    ).toEqual(['imagenes/img_a.jpg', 'imagenes/img_e.png']);
  });

  it('sin galería, sin copias — y no explota', () => {
    for (const entrada of [undefined, null, [], 'imagenes/img_a.jpg']) {
      expect(copiasEnLaGaleria(entrada as never), String(entrada)).toEqual([]);
    }
  });
});

/**
 * **Los tres «primer nivel bajo un prefijo», atados** — clase de B-88, lo vio el
 * `auditor-trampas` sobre B-863.
 *
 * El proyecto decide tres veces, en tres archivos, la misma pregunta: ¿este
 * `storagePath` es un objeto nuestro **de primer nivel** bajo tal prefijo?
 * `objetoDePropuesta` (`retencion.js`) para `propuestas/`, `esDePrimerNivel`
 * (`limpieza-imagenes.js`) para `imagenes/` y `miniaturas/`, y desde B-863
 * `copiasEnLaGaleria` (`propuestas.js`) para `imagenes/`. Las tres derivan el
 * mismo hecho —que `subirImagen` produce `<prefijo>/<id>.<ext>`, un solo
 * segmento— y hasta acá solo las coordinaban comentarios cruzados.
 *
 * El día que una acepte un segundo segmento y las otras no, el modo de falla es
 * mudo en las tres direcciones. Acá **falla cerrado** (no borra, conserva de
 * más), y por eso esto es una atadura y no un refactor: no se unifica el código
 * —cada una devuelve otra cosa— se unifica el **criterio**, contra la misma
 * tabla de casos.
 */
describe('«un solo segmento bajo el prefijo», el mismo criterio en los tres lugares', () => {
  /** El nombre, sin prefijo, y si tiene que contar como objeto nuestro. */
  const CASOS: [string, boolean][] = [
    ['img_abc.jpg', true],
    ['prop_abc-123.png', true],
    ['sub/x.jpg', false],
    ['../x.jpg', false],
    ['', false],
  ];

  it('los tres aceptan y rechazan lo mismo', () => {
    for (const [nombre, esperado] of CASOS) {
      // 1) `objetoDePropuesta`, sobre `propuestas/`
      const dePropuesta = objetoDePropuesta({ storagePath: `${PREFIJO_PROPUESTAS}${nombre}` });
      expect(dePropuesta !== null, `objetoDePropuesta · «${nombre}»`).toBe(esperado);

      // 2) `esDePrimerNivel`, sobre `imagenes/` (el que usa el barrido de B-221)
      expect(
        esDePrimerNivel(`${PREFIJO_ORIGINALES}${nombre}`, PREFIJO_ORIGINALES),
        `esDePrimerNivel · «${nombre}»`,
      ).toBe(esperado);

      // 3) `copiasEnLaGaleria`, sobre `imagenes/` (el de B-863)
      expect(
        copiasEnLaGaleria([{ storagePath: `${PREFIJO_ORIGINALES}${nombre}` }]).length === 1,
        `copiasEnLaGaleria · «${nombre}»`,
      ).toBe(esperado);
    }
  });

  it('y ninguno acepta el prefijo del otro', () => {
    expect(objetoDePropuesta({ storagePath: `${PREFIJO_ORIGINALES}img_a.jpg` })).toBeNull();
    expect(copiasEnLaGaleria([{ storagePath: `${PREFIJO_PROPUESTAS}prop_a.jpg` }])).toEqual([]);
    expect(esDePrimerNivel(`${PREFIJO_PROPUESTAS}prop_a.jpg`, PREFIJO_ORIGINALES)).toBe(false);
  });
});

/**
 * **Trampa 12, la instancia nueva de una clase que ya tiene red.**
 *
 * `optimizarImagen` está suscripto al **bucket entero** —un trigger de Storage
 * v2 no se filtra por prefijo en la declaración— así que la subida de una
 * propuesta lo despierta igual. Lo corta el primer `if` de `decidirOptimizacion`,
 * que ya existía; lo que este caso agrega es **nombrar el prefijo nuevo**, que es
 * el punto 5 de «las nueve cosas que se rompen en silencio» del inventario.
 *
 * Y el otro lado: la imagen **promovida** cae en `imagenes/`, así que sí se
 * optimiza — que es lo que se quiere, y es la misma pasada que cualquier subida
 * del panel.
 */
describe('el trigger de optimización y el prefijo de propuestas (trampa 12)', () => {
  it('ignora lo que se sube a `propuestas/`', () => {
    expect(
      decidirOptimizacion({ nombre: OBJETO, contentType: 'image/jpeg' }),
    ).toEqual({ accion: 'ignorar', motivo: 'fuera-del-prefijo' });
  });

  it('y sí optimiza la que se promovió, que es una imagen de galería como cualquier otra', () => {
    // Control positivo: sin esto, el caso de arriba pasaría también con un
    // `decidirOptimizacion` que ignorara todo.
    expect(
      decidirOptimizacion({ nombre: 'imagenes/img_abc.jpg', contentType: 'image/jpeg' }),
    ).toEqual({ accion: 'optimizar', motivo: null });
  });
});

/**
 * **El prefijo está escrito en cuatro runtimes que no se pueden importar entre
 * sí**, y esta es la atadura — el patrón de B-364 aplicado a un path.
 *
 * Si uno cambia y los otros no, el modo de falla es silencioso en las cuatro
 * direcciones: la subida se rechaza, el borrado no encuentra nada, la retención
 * deja huérfanos, o —el peor— la guarda de prefijo deja de coincidir con lo que
 * la regla acepta y el borrado se sale de su corral.
 */
describe('el prefijo `propuestas/`, en los cuatro lugares donde está escrito', () => {
  it('el cliente y la Function lo escriben igual', () => {
    expect(PREFIJO_PROPUESTAS).toBe('propuestas/');
    expect(PREFIJO_DE_LA_FUNCTION).toBe(PREFIJO_PROPUESTAS);
  });

  it('y las dos reglas también', () => {
    expect(fuente('storage.rules')).toContain('match /propuestas/{archivo}');
    expect(fuente('firestore.rules')).toContain(`matches('^${PREFIJO_PROPUESTAS}`);
  });

  it('el path que arma el cliente pasa el `matches` de `storage.rules`', () => {
    /*
     * **La atadura que de verdad se puede romper.** El regex de la regla vive en
     * otro runtime y el nombre lo arma `nuevaImagenPropuestaId()`: si mañana el
     * id llevara un punto, una barra o mayúsculas que el alfabeto no acepta, la
     * subida fallaría con un permission-denied y el diagnóstico sería «las reglas
     * están mal», no «el nombre cambió». Se extrae el regex del archivo y se lo
     * corre contra un nombre de verdad.
     */
    const regla = /archivo\.matches\('\^(prop_[^']+)'\)/.exec(fuente('storage.rules'))?.[1];
    expect(regla, 'no se encontró el `matches` del bloque de propuestas').toBeTruthy();

    for (const tipo of ['image/jpeg', 'image/png'] as const) {
      const ruta = rutaDeImagenPropuesta(nuevaImagenPropuestaId(), tipo);
      const archivo = ruta.slice(PREFIJO_PROPUESTAS.length);
      expect(new RegExp(`^${regla}`).test(archivo), ruta).toBe(true);
    }
  });

  it('la regla de Storage es más angosta que la de Firestore, y eso está decidido', () => {
    /*
     * `firestore.rules` acepta `jpeg` y `webp` además de `jpg`/`png`;
     * `storage.rules` solo los dos que el panel sabe limpiar (`tipoAceptado`).
     * O sea que un documento puede nombrar un path que **nunca va a existir** —
     * inofensivo (la promoción no lo encuentra y la retención lo ignora), pero
     * queda declarado acá para que se lea como asimetría y no como olvido.
     */
    const enStorage = /archivo\.matches\('\^prop_\[A-Za-z0-9_-\]\+\[\.\]\(([^)]+)\)/.exec(
      fuente('storage.rules'),
    )?.[1];
    const enFirestore = /matches\('\^propuestas\/\[A-Za-z0-9_-\]\+\[\.\]\(([^)]+)\)/.exec(
      fuente('firestore.rules'),
    )?.[1];

    expect(enStorage).toBe('jpg|png');
    expect(enFirestore).toBe('jpg|jpeg|png|webp');
    for (const ext of enStorage!.split('|')) {
      expect(enFirestore!.split('|'), ext).toContain(ext);
    }
  });
});
