/**
 * **El rebuild cuando cambia una ficha de directorio** — B-901, trampa 8 del §13.
 *
 * La sexta de las nueve cosas que se rompen en silencio: sin este trigger se
 * publica una librería desde el panel y el sitio estático **no la muestra
 * nunca** —hasta que alguien edite cualquier actividad por otro motivo— y nada
 * falla.
 *
 * ── La atadura que importa: D-20 ─────────────────────────────────────────
 * `functions/` no puede importar de `src/`, así que `CAMPOS_PUBLICOS` es una
 * **segunda escritura** de lo que `libreriaPublica()` publica. Dos listas de «qué
 * ve el sitio» se separan sin que nada falle: la que se quede vieja deja un campo
 * que se publica y no dispara el build, o dispara builds de más. Es la clase de
 * B-88, y el único modo de atarla desde este lado es el patrón de `cargarLabels`:
 * un test que compare las dos.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_PUBLICOS,
  COLECCIONES_DE_DIRECTORIO,
  cambioAmeritaRebuild,
} from '../functions/directorios.js';
import { libreriaPublica } from '@/lib/libreriaPublica';
import { DIRECTORIOS } from '@/lib/directorios';
import { libreriaCentinela } from './fixtures/centinelas-libreria';

describe('qué campos mira el trigger (D-20: la lista vive de los dos lados)', () => {
  it('son los que la proyección publica, más el `estado`', () => {
    /*
     * La proyección decide qué ve el sitio; `estado` decide **si** lo ve. El
     * `searchText` es la única clave de la proyección que no está acá, y con
     * motivo: es **derivado** de nombre, descripción, dirección, barrio y ciudad,
     * así que no puede cambiar sin que cambie alguno de esos cinco.
     *
     * MUTACIÓN PROBADA: sacar `'barrio'` de `CAMPOS_PUBLICOS` deja este caso en
     * rojo nombrando el campo (y el efecto real sería: se corrige el barrio de una
     * librería publicada y el sitio sigue mostrando el viejo).
     */
    const dePublica = Object.keys(libreriaPublica(libreriaCentinela()));
    const esperados = new Set([...dePublica.filter((c) => c !== 'searchText'), 'estado']);
    expect([...CAMPOS_PUBLICOS].sort()).toEqual([...esperados].sort());
  });

  it('control positivo: la lista no está vacía y la proyección tampoco', () => {
    // Sin esto, dos listas vacías compararían iguales y el caso de arriba pasaría
    // sin haber mirado nada.
    expect(CAMPOS_PUBLICOS.length).toBeGreaterThan(10);
    expect(Object.keys(libreriaPublica(libreriaCentinela())).length).toBeGreaterThan(10);
  });

  it('los campos internos NO están: corregirlos no cambia una letra del sitio', () => {
    /*
     * `contactoDeQuienCargo` no sale a ninguna salida pública, así que corregirlo
     * no puede cambiar lo publicado. `revision` y `origen` son ciclo de vida, y
     * `publicadaAlgunaVez` la escribe un trigger: incluirla haría que **cada
     * publicación costara dos builds**, que es la trampa 3 con otra cara.
     */
    for (const interno of [
      'contactoDeQuienCargo',
      'revision',
      'origen',
      'creadoEn',
      'publicadaAlgunaVez',
      'searchText',
    ]) {
      expect(CAMPOS_PUBLICOS, `«${interno}» no tendría que disparar un build`).not.toContain(
        interno,
      );
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
});

describe('cuándo corresponde rebuildear', () => {
  const doc = (over = {}) => ({ ...libreriaCentinela(), ...over });

  it('publicar y despublicar, siempre', () => {
    expect(cambioAmeritaRebuild(doc({ estado: 'pendiente' }), doc({ estado: 'publicado' }))).toBe(
      true,
    );
    expect(cambioAmeritaRebuild(doc({ estado: 'publicado' }), doc({ estado: 'rechazado' }))).toBe(
      true,
    );
  });

  it('el alta y la baja del documento también', () => {
    // Una ficha publicada que se borra deja una página que ya no tiene que existir.
    expect(cambioAmeritaRebuild(null, doc())).toBe(true);
    expect(cambioAmeritaRebuild(doc(), null)).toBe(true);
  });

  it('corregir la dirección o el barrio de una publicada, también', () => {
    expect(cambioAmeritaRebuild(doc(), doc({ direccion: 'Otra 123' }))).toBe(true);
    expect(cambioAmeritaRebuild(doc(), doc({ barrio: 'almagro' }))).toBe(true);
    expect(cambioAmeritaRebuild(doc(), doc({ imagenes: [] }))).toBe(true);
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
    expect(cambioAmeritaRebuild(doc({ publicadaAlgunaVez: false }), doc())).toBe(false);
    expect(
      cambioAmeritaRebuild(doc(), doc({ revision: { porUid: 'otro', en: null, motivo: null } })),
    ).toBe(false);
  });

  it('ni corregir el contacto interno, que no sale al sitio', () => {
    expect(
      cambioAmeritaRebuild(
        doc(),
        doc({ contactoDeQuienCargo: { via: 'whatsapp', valor: '541100000000' } }),
      ),
    ).toBe(false);
  });
});
