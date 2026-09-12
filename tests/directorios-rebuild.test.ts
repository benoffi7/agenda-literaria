/**
 * **El rebuild cuando cambia una ficha de directorio** — B-901, trampa 8 del §13.
 *
 * La sexta de las nueve cosas que se rompen en silencio: sin este trigger se
 * publica una librería desde el panel y el sitio estático **no la muestra
 * nunca** —hasta que alguien edite cualquier actividad por otro motivo— y nada
 * falla.
 *
 * ── La atadura que importa: D-20 ─────────────────────────────────────────
 * `functions/` no puede importar de `src/`, así que
 * `CAMPOS_PUBLICOS_POR_DIRECTORIO` es una **segunda escritura** de lo que publica
 * la proyección de cada colección. Dos listas de «qué ve el sitio» se separan sin
 * que nada falle: la que se quede vieja deja un campo que se publica y no dispara
 * el build, o dispara builds de más. Es la clase de B-88, y el único modo de
 * atarla desde este lado es el patrón de `cargarLabels`: un test que compare las
 * dos.
 *
 * Desde **B-832** son **dos** colecciones y la comparación se recorre por tabla:
 * la tajada 4 suma su fila y hereda los casos.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_PUBLICOS_POR_DIRECTORIO,
  COLECCIONES_DE_DIRECTORIO,
  cambioAmeritaRebuild,
} from '../functions/directorios.js';
import { libreriaPublica } from '@/lib/libreriaPublica';
import { suscripcionPublica } from '@/lib/suscripcionPublica';
import { DIRECTORIOS } from '@/lib/directorios';
import { libreriaCentinela } from './fixtures/centinelas-libreria';
import { suscripcionCentinela } from './fixtures/centinelas-suscripcion';

/**
 * Las dos colecciones, con su proyección y el campo derivado que **no** dispara
 * build.
 *
 * Se recorre una tabla y no se escriben dos bloques iguales: la tajada 4 suma su
 * fila y hereda los cuatro casos. Y lo que se compara sale de la **proyección**,
 * no de una lista escrita acá — que es lo que hace que un campo público nuevo
 * entre solo al chequeo.
 *
 * `searchText` es la única clave de cada proyección que no está en su lista de
 * campos publicados, y con motivo: es **derivado** de otros que sí están, así que
 * no puede cambiar solo.
 */
const DIRECTORIOS_CON_PROYECCION = [
  {
    coleccion: 'librerias',
    proyeccion: () => libreriaPublica(libreriaCentinela()),
    documento: () => libreriaCentinela() as unknown as Record<string, unknown>,
    derivados: ['searchText'],
  },
  {
    coleccion: 'suscripciones',
    proyeccion: () => suscripcionPublica(suscripcionCentinela()),
    documento: () => suscripcionCentinela() as unknown as Record<string, unknown>,
    derivados: ['searchText'],
  },
] as const;

describe('qué campos mira el trigger (D-20: la lista vive de los dos lados)', () => {
  it.each(DIRECTORIOS_CON_PROYECCION)(
    'los de $coleccion son los que su proyección publica, más el `estado`',
    ({ coleccion, proyeccion, derivados }) => {
      /*
       * La proyección decide qué ve el sitio; `estado` decide **si** lo ve.
       *
       * MUTACIÓN PROBADA: sacar `'barrio'` de la lista de librerías —o `'envio'`
       * de la de suscripciones— deja este caso en rojo nombrando la colección (y
       * el efecto real sería: se corrige ese campo de una ficha publicada y el
       * sitio sigue mostrando el viejo).
       */
      const dePublica = Object.keys(proyeccion());
      const esperados = new Set([
        ...dePublica.filter((c) => !(derivados as readonly string[]).includes(c)),
        'estado',
      ]);
      expect([...CAMPOS_PUBLICOS_POR_DIRECTORIO[coleccion]].sort()).toEqual(
        [...esperados].sort(),
      );
    },
  );

  it.each(DIRECTORIOS_CON_PROYECCION)(
    'control positivo: la lista de $coleccion no está vacía y su proyección tampoco',
    ({ coleccion, proyeccion }) => {
      // Sin esto, dos listas vacías compararían iguales y el caso de arriba
      // pasaría sin haber mirado nada.
      expect(CAMPOS_PUBLICOS_POR_DIRECTORIO[coleccion].length).toBeGreaterThan(10);
      expect(Object.keys(proyeccion()).length).toBeGreaterThan(10);
    },
  );

  it('cada colección tiene su propia lista, y no una compartida', () => {
    /*
     * **B-832 — era una lista sola y ahora es un mapa.** Con una compartida, el
     * campo que existe en una colección y no en la otra (`barrio`,
     * `periodicidad`) se compararía contra `undefined` en los dos lados de la
     * segunda: **nunca cambia**, y editarlo no dispararía ningún build. Es la
     * trampa 8 volviendo por la puerta de al lado, sin que nada falle.
     */
    expect(CAMPOS_PUBLICOS_POR_DIRECTORIO.librerias).not.toEqual(
      CAMPOS_PUBLICOS_POR_DIRECTORIO.suscripciones,
    );
    expect(CAMPOS_PUBLICOS_POR_DIRECTORIO.librerias).toContain('barrio');
    expect(CAMPOS_PUBLICOS_POR_DIRECTORIO.suscripciones).toContain('periodicidad');
    // Y el precio está: es un campo publicado (como frase, con su fecha) y
    // corregirlo tiene que rehacer la ficha (DEC-12).
    expect(CAMPOS_PUBLICOS_POR_DIRECTORIO.suscripciones).toContain('precio');
  });

  it('los campos internos NO están: corregirlos no cambia una letra del sitio', () => {
    /*
     * `contactoDeQuienCargo` no sale a ninguna salida pública, así que corregirlo
     * no puede cambiar lo publicado. `revision` y `origen` son ciclo de vida, y
     * `publicadaAlgunaVez` la escribe un trigger: incluirla haría que **cada
     * publicación costara dos builds**, que es la trampa 3 con otra cara.
     */
    for (const { coleccion } of DIRECTORIOS_CON_PROYECCION) {
      for (const interno of [
        'contactoDeQuienCargo',
        'revision',
        'origen',
        'creadoEn',
        'publicadaAlgunaVez',
        'searchText',
      ]) {
        expect(
          CAMPOS_PUBLICOS_POR_DIRECTORIO[coleccion],
          `«${interno}» no tendría que disparar un build en ${coleccion}`,
        ).not.toContain(interno);
      }
    }
  });

  it('las colecciones del trigger son las de `/guia` que ya existen', () => {
    /*
     * Hoy una. Las tajadas 3 y 4 suman la suya **acá y en `index.js`**, que es lo
     * que hace que un directorio nuevo sin rebuild se vea en el diff.
     */
    expect([...COLECCIONES_DE_DIRECTORIO]).toEqual(
      DIRECTORIOS.filter((d) => d.disponible).map((d) => d.id),
    );
  });

  it('y el trigger de cada una está exportado — trampa 8', () => {
    /*
     * Lo único que no se puede derivar del mapa: Firestore no matchea un comodín
     * en el segmento de colección, así que cada directorio declara su Function. Sin
     * este caso, una colección podría entrar a `CAMPOS_PUBLICOS_POR_DIRECTORIO` y
     * quedarse sin trigger — y el sitio no mostraría nunca lo que se publique ahí.
     *
     * MUTACIÓN PROBADA: sacar el `export { rebuildPorSuscripciones }` de
     * `functions/index.js` deja este caso en rojo nombrando la colección.
     */
    const index = readFileSync('functions/index.js', 'utf8');
    const trigger = readFileSync('functions/directorios-trigger.js', 'utf8');
    for (const coleccion of COLECCIONES_DE_DIRECTORIO) {
      const nombre = `rebuildPor${coleccion[0]!.toUpperCase()}${coleccion.slice(1)}`;
      expect(index, `falta exportar ${nombre}`).toContain(`export { ${nombre} }`);
      expect(trigger, `falta el trigger de ${coleccion}`).toContain(
        `document: '${coleccion}/{id}'`,
      );
    }
  });
});

describe('cuándo corresponde rebuildear', () => {
  const doc = (over = {}) => ({ ...libreriaCentinela(), ...over });

  it('publicar y despublicar, siempre', () => {
    expect(
      cambioAmeritaRebuild(doc({ estado: 'pendiente' }), doc({ estado: 'publicado' }), 'librerias'),
    ).toBe(true);
    expect(
      cambioAmeritaRebuild(doc({ estado: 'publicado' }), doc({ estado: 'rechazado' }), 'librerias'),
    ).toBe(true);
  });

  it('el alta y la baja del documento también', () => {
    // Una ficha publicada que se borra deja una página que ya no tiene que existir.
    expect(cambioAmeritaRebuild(null, doc(), 'librerias')).toBe(true);
    expect(cambioAmeritaRebuild(doc(), null, 'librerias')).toBe(true);
  });

  it('una colección que nadie declaró rebuildea: es la dirección barata del error', () => {
    /*
     * Con la lista vacía la comparación no encontraría ninguna diferencia y el
     * sitio se quedaría viejo para siempre, en silencio. Un build de más cuesta
     * dos minutos de Actions.
     *
     * MUTACIÓN PROBADA: devolver `false` cuando la colección no está declarada
     * deja este caso en rojo.
     */
    expect(cambioAmeritaRebuild(doc(), doc(), 'lugares')).toBe(true);
  });

  it('corregir la dirección o el barrio de una publicada, también', () => {
    expect(cambioAmeritaRebuild(doc(), doc({ direccion: 'Otra 123' }), 'librerias')).toBe(true);
    expect(cambioAmeritaRebuild(doc(), doc({ barrio: 'almagro' }), 'librerias')).toBe(true);
    expect(cambioAmeritaRebuild(doc(), doc({ imagenes: [] }), 'librerias')).toBe(true);
  });

  it('y en una suscripción, corregir el precio — DEC-12', () => {
    /*
     * Acá el daño de no rebuildear tiene una cara más que en librerías: el precio
     * publicado se queda con **su fecha vieja al lado**, o sea afirmando algo que
     * ya no es cierto. Por eso `precio` está en la lista de campos publicados.
     */
    const sus = (over = {}) => ({ ...suscripcionCentinela(), ...over });
    expect(
      cambioAmeritaRebuild(
        sus(),
        sus({ precio: { valor: { monto: 25000, porPeriodo: 'mensual' }, cargadoEn: null } }),
        'suscripciones',
      ),
    ).toBe(true);
    expect(cambioAmeritaRebuild(sus(), sus({ periodicidad: 'anual' }), 'suscripciones')).toBe(true);
    expect(
      cambioAmeritaRebuild(sus(), sus({ envio: { ...suscripcionCentinela().envio, manda: false } }), 'suscripciones'),
    ).toBe(true);
  });

  it('pero NO el write-back de un campo de máquina: sin esto, publicar cuesta dos builds', () => {
    /*
     * Es la guarda del §7.1 aplicada acá: el trigger que escribe
     * `publicadaAlgunaVez` vuelve a disparar este trigger, y en esa segunda pasada
     * no hay nada nuevo que publicar.
     *
     * MUTACIÓN PROBADA: cambiar el cuerpo por `return true` deja este caso en rojo
     * —y el de abajo también—, que es lo que separa la guarda de una función que
     * siempre dice que sí.
     */
    expect(cambioAmeritaRebuild(doc({ publicadaAlgunaVez: false }), doc(), 'librerias')).toBe(false);
    expect(
      cambioAmeritaRebuild(
        doc(),
        doc({ revision: { porUid: 'otro', en: null, motivo: null } }),
        'librerias',
      ),
    ).toBe(false);
  });

  it('ni corregir el contacto interno, que no sale al sitio', () => {
    for (const { coleccion, documento } of DIRECTORIOS_CON_PROYECCION) {
      expect(
        cambioAmeritaRebuild(
          documento(),
          { ...documento(), contactoDeQuienCargo: { via: 'whatsapp', valor: '541100000000' } },
          coleccion,
        ),
        coleccion,
      ).toBe(false);
    }
  });
});
