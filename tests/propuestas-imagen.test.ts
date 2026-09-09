/**
 * **La imagen de una propuesta** — B-830 paso 8, DEC-11.
 *
 * Es el objeto más delicado del bucket: lo sube alguien **sin login**, no es
 * público, y su ciclo de vida no lo decide una persona sino el estado de su
 * propuesta — se promueve al aceptar y se borra al rechazar, en el acto.
 *
 * Este archivo prueba lo que se puede sin emuladores: la decisión de borrado
 * (`functions/propuestas.js`), la atadura del prefijo entre los cuatro runtimes
 * que lo escriben, y que el trigger de optimización lo ignore (trampa 12). Las
 * reglas de verdad se prueban contra el emulador en
 * `tests/storage-reglas.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decidirBorradoDeImagen } from '../functions/propuestas.js';
import { decidirOptimizacion } from '../functions/imagenes.js';
import { PREFIJO_PROPUESTAS as PREFIJO_DE_LA_FUNCTION } from '../functions/retencion.js';
import {
  PREFIJO_PROPUESTAS,
  nuevaImagenPropuestaId,
  rutaDeImagenPropuesta,
} from '@/lib/imagenes-archivo';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const OBJETO = 'propuestas/prop_abc-123.jpg';
const propuesta = (over: Record<string, unknown> = {}) => ({
  estado: 'nueva',
  imagen: { storagePath: OBJETO },
  ...over,
});

describe('decidirBorradoDeImagen — rechazar se lleva la foto (DEC-11)', () => {
  it('rechazar borra la imagen, y solo en la transición', () => {
    expect(
      decidirBorradoDeImagen({
        before: propuesta({ estado: 'en-revision' }),
        after: propuesta({ estado: 'rechazada' }),
      }),
    ).toEqual({ accion: 'borrar', objeto: OBJETO, motivo: 'rechazada' });

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

  it('los otros estados no borran nada', () => {
    for (const estado of ['nueva', 'en-revision', 'aceptada']) {
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

  it('una imagen de afuera no es nuestra y no se toca', () => {
    // La otra forma de `ImagenPropuesta`: `{ url }`. Y la ausencia de imagen.
    for (const imagen of [{ url: 'https://ejemplo.test/f.jpg' }, null]) {
      const { accion, motivo } = decidirBorradoDeImagen({
        before: propuesta({ estado: 'nueva' }),
        after: propuesta({ estado: 'rechazada', imagen }),
      });
      expect(accion, JSON.stringify(imagen)).toBe('ignorar');
      expect(motivo, JSON.stringify(imagen)).toBe('sin-imagen-propia');
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
    for (const path of ['imagenes/img_de_otra.jpg', 'propuestas/sub/x.jpg', 'propuestas/../x.jpg']) {
      const { accion, objeto, motivo } = decidirBorradoDeImagen({
        before: propuesta({ estado: 'nueva' }),
        after: propuesta({ estado: 'rechazada', imagen: { storagePath: path } }),
      });
      expect(accion, path).toBe('ignorar');
      expect(objeto, path).toBeNull();
      // El motivo los separa a propósito: «no hay imagen propia» es el caso
      // frecuente y sano; éste es un documento que alguien escribió mal, y en el
      // log tiene que poder distinguirse.
      expect(motivo, path).toBe('imagen-fuera-del-prefijo');
    }
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
