/**
 * B-911: un flag de publicación se lee antes que el dato que esconde.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { Actividad } from '@/types/actividad';
// B-911 — el registro de la clase «flag booleano + dato que el flag esconde».
import { CAMPOS_CON_PAR_DE, NO_SON_PARES, PARES_FLAG_DATO, camposDelPar } from '@/lib/paresFlagDato';
import { fuente, versionados, EFECTOS_INCONDICIONALES } from '../fixtures/clases-de-bug';

// ─────────────────────────────────────────────────────────────────────
// clase de B-911 · el par flag + dato
// ─────────────────────────────────────────────────────────────────────

/**
 * **La cuarta instancia trajo la red** — B-911, abierto por B-832 y cerrado por
 * B-833.
 *
 * La clase es: **un booleano que decide si otro campo del mismo documento se
 * publica**. Hay cuatro (`online.urlPublica`, `material.items[].publico`,
 * `envio.manda`, `direccionPublica`) y las cuatro fallan igual: la proyección lee
 * el dato sin mirar el flag, y el sitio publica exactamente lo que alguien pidió
 * no publicar. No falla nada.
 *
 * Hasta B-832 la cobertura era **por instancia** y la clase no existía acá —
 * peor: dos docblocks llegaron a afirmar que sí, que es el daño que el ítem
 * describe—. La cuarta esconde la dirección de la casa de una persona (§ 6 del
 * PRD 4), así que la red se puso antes de escribirla.
 *
 * ── Las tres propiedades del § «Verificar la clase» ───────────────────────
 * 1. **La lista se deriva del código en su mitad derivable**: todo booleano de
 *    un tipo del modelo que se llame «público» tiene que estar registrado o
 *    declarado. Un `xxxPublica: boolean` nuevo no puede entrar en silencio. Lo
 *    que **no** se puede derivar —un flag que no se llama así, como
 *    `envio.manda`— está escrito a mano y dicho, igual que
 *    `EFECTOS_INCONDICIONALES`.
 * 2. **No se puede satisfacer sin arreglar nada**: `NO_SON_PARES` tiene una sola
 *    entrada y lleva su párrafo.
 * 3. **El chequeo dice qué lo haría pasar**, en cada caso.
 */
describe('clase de B-911 · un flag de publicación se lee antes que el dato que esconde', () => {
  it('control positivo: hay cuatro pares registrados, de tres entidades', () => {
    // Sin esto, un registro vacío haría pasar todo lo de abajo sin mirar nada.
    expect(PARES_FLAG_DATO.length).toBeGreaterThanOrEqual(4);
    expect(new Set(PARES_FLAG_DATO.map((p) => p.entidad)).size).toBeGreaterThanOrEqual(3);
    for (const par of PARES_FLAG_DATO) {
      expect(par.datos.length, `${par.id} no declara qué esconde`).toBeGreaterThan(0);
    }
  });

  it('cada par tiene UNA función que decide, y esa función LEE el flag', () => {
    /*
     * El corazón de la clase. «La proyección mira el flag antes del dato» se
     * verifica sobre el cuerpo del productor: tiene que existir, y el nombre de
     * su flag —la última parte de la ruta— tiene que aparecer adentro.
     *
     * MUTACIÓN PROBADA: sacarle el `l.direccionPublica !== true` a `dondeQueSale`
     * (o el `envio?.manda === true` a `envioPublico`) deja este caso en rojo
     * nombrando el par — y el efecto real es la dirección de una casa publicada.
     */
    const sinGuarda: string[] = [];
    for (const par of PARES_FLAG_DATO) {
      const src = fuente(par.productor.archivo);
      const decl = new RegExp(`(const|function)\\s+${par.productor.funcion}\\b`);
      expect(
        decl.test(src),
        `${par.id}: no existe \`${par.productor.funcion}\` en ${par.productor.archivo}`,
      ).toBe(true);

      // El cuerpo del productor: de su declaración hasta la próxima declaración
      // de nivel superior. Es tosco a propósito — lo que se busca adentro es un
      // nombre de campo, y un falso positivo por leer de más se vería en el
      // aserto de arriba.
      const desde = src.search(decl);
      const siguiente = src.indexOf('\nexport const ', desde + 1);
      const cuerpo = src.slice(desde, siguiente === -1 ? src.length : siguiente);
      /*
       * Se busca **la lectura** del flag (`.manda`, `.urlPublica`,
       * `.direccionPublica`) y no su nombre a secas, y la diferencia la encontró
       * una mutación: con el nombre pelado, reemplazar `envio?.manda === true` por
       * `const manda = true` dejaba el chequeo en **verde** —la palabra seguía
       * ahí, como nombre de la variable— con el flag desactivado. El punto es que
       * el productor **lea el campo del documento**, no que lo nombre.
       */
      const nombreDelFlag = par.flag.split('.').pop()!.replace('[]', '');
      if (!cuerpo.includes(`.${nombreDelFlag}`)) {
        sinGuarda.push(`${par.id} → ${par.productor.funcion}`);
      }
    }
    expect(
      sinGuarda,
      'estos productores no leen su propio flag: publican el dato que el flag esconde',
    ).toEqual([]);
  });

  it('el productor es el ÚNICO que nombra el dato en su archivo — el par no se reparte', () => {
    /*
     * La segunda mitad, y la que impide la forma que B-819 describe: que la
     * decisión esté en el productor **y además** en el llamador, con las dos
     * copias separándose. Se mira el archivo de la proyección y se cuenta
     * cuántas veces se lee el dato crudo del documento; tiene que ser adentro del
     * productor o adentro de la función que lo llama con su resultado.
     *
     * Se verifica sobre el par de `lugar`, que es el único de los cuatro cuyo
     * dato tiene un nombre propio y rastreable (`direccion`, `geo`): en los otros
     * tres el dato vive adentro de un sub-objeto que se proyecta entero.
     *
     * MUTACIÓN PROBADA: agregar `direccion: l.direccion ?? ''` a `lugarPublico`
     * —esquivando `dondeQueSale`— deja este caso en rojo.
     */
    const par = PARES_FLAG_DATO.find((p) => p.id === 'lugar/direccionPublica')!;
    const src = fuente(par.productor.archivo);
    const desde = src.indexOf(`export const ${par.productor.funcion} =`);
    expect(desde, `no se encontró \`${par.productor.funcion}\``).toBeGreaterThan(0);
    const hasta = src.indexOf('\nexport const ', desde + 1);
    const productor = src.slice(desde, hasta);
    const afuera = src.slice(0, desde) + src.slice(hasta);

    // `l.direccion` y `l.geo` son la lectura cruda del documento. La proyección
    // solo puede leerlos adentro de `dondeQueSale`; en `lugarPublico` lo que se
    // usa es el resultado (`donde.direccion`, `donde.geo`).
    // El `(?!\w)` es lo que separa `l.direccion` de `l.direccionPublica`: el
    // segundo es el **flag** y leerlo en un docblock no es repartir el par.
    const lecturaCruda = (campo: string) => new RegExp(`\\bl\\.${campo}(?!\\w)`, 'g');
    for (const campo of ['direccion', 'geo']) {
      // Control positivo: el productor **sí** los lee. Sin esto, el barrido de
      // abajo pasaría en verde sobre un productor que no mira nada.
      expect(
        productor.match(lecturaCruda(campo))?.length ?? 0,
        `\`${par.productor.funcion}\` dejó de leer \`l.${campo}\``,
      ).toBeGreaterThan(0);
      expect(
        afuera.match(lecturaCruda(campo))?.length ?? 0,
        `\`l.${campo}\` se lee fuera de \`${par.productor.funcion}\`: el par se repartió`,
      ).toBe(0);
    }
  });

  it('todo booleano del modelo que se llame «público» está registrado o declarado', () => {
    /*
     * **La mitad derivada.** Recorre los tipos del modelo y junta los booleanos
     * cuyo nombre dice «publico/publica». Cada uno tiene que ser el flag de un
     * par, o estar en `NO_SON_PARES` con su motivo.
     *
     * Es lo que hace que el quinto par no pueda entrar en silencio, que es
     * exactamente lo que B-911 pedía: «el cuarto par se va a escribir confiando
     * en una red que no está puesta».
     *
     * MUTACIÓN PROBADA: agregar `webPublica: boolean;` a `Lugar` deja este caso en
     * rojo nombrando el campo.
     */
    /*
     * **Se deriva del disco y no se enumera** — lo pidió el `auditor-privacidad`.
     * La primera versión listaba cinco archivos a mano mientras el docblock decía
     * «recorre los tipos del modelo», y el caso en que la clase se estrena es
     * justamente el que quedaba afuera: **el `src/types/*.ts` que se cree
     * mañana**. El cuarto par nació con una entidad nueva; el quinto también va a
     * nacer así.
     */
    const TIPOS = versionados('src/types').filter((f) => f.endsWith('.ts'));
    // Control positivo: sin esto, un glob que deje de encontrar archivos haría
    // pasar el barrido en verde sin haber leído nada.
    expect(TIPOS.length, 'el glob de `src/types` no encontró archivos').toBeGreaterThanOrEqual(5);
    const encontrados = new Set<string>();
    for (const archivo of TIPOS) {
      for (const m of fuente(archivo).matchAll(/^\s{2,}(\w*[Pp]ublic[ao]\w*)\??:\s*boolean/gm)) {
        encontrados.add(m[1]!);
      }
    }
    // Control positivo: los dos pares históricos tienen que aparecer solos.
    expect([...encontrados], 'el barrido de los tipos no encontró nada').toContain('urlPublica');
    expect([...encontrados]).toContain('direccionPublica');

    const registrados = new Set(PARES_FLAG_DATO.map((p) => p.flag.split('.').pop()!));
    const sinCubrir = [...encontrados].filter(
      (n) => !registrados.has(n) && !(n in NO_SON_PARES),
    );
    expect(
      sinCubrir,
      'estos booleanos se llaman como un flag de publicación y no están ni en `PARES_FLAG_DATO` ' +
        `ni en \`NO_SON_PARES\`: nadie dijo si esconden algo — ${sinCubrir.join(', ')}`,
    ).toEqual([]);
  });

  it('la guarda del historial vigila exactamente los pares que tienen historial', () => {
    /*
     * La segunda puerta de cada par (B-819): restaurar una versión vieja puede
     * volver a prender un flag que hoy está apagado.
     * `flagsDePublicacionRestaurables` saca de `CAMPOS_CON_PAR_DE` **qué campos
     * mira**, así que un par nuevo de una actividad entra a esa guarda solo.
     *
     * ⚠️ **Y lo que este caso deja escrito es la otra mitad**: los pares de
     * `/suscripciones` y `/lugares` no llegan a esa guarda porque esas
     * colecciones **no tienen subcolección `/versiones`** —`firestore.rules` lo
     * dice en cada bloque—. No es que la guarda esté floja: la puerta no existe.
     * El día que un directorio gane historial, este caso se pone rojo y pide la
     * guarda en el mismo cambio.
     *
     * MUTACIÓN PROBADA: poner `conHistorial: true` en el par de `lugar` deja este
     * caso en rojo nombrando la colección.
     */
    expect(CAMPOS_CON_PAR_DE('actividad').sort()).toEqual(['material', 'modalidades']);
    /*
     * ⚠️ **Y el registro nombra el campo del FLAG, no solo el del dato** — lo
     * pidió el `auditor-privacidad`. En los tres primeros pares el flag vive
     * adentro del mismo campo que el dato (`modalidades`, `material`, `envio`);
     * en el cuarto `direccionPublica` es un campo de primer nivel aparte, y
     * restaurarlo **solo** volvería a prenderlo sobre la dirección de hoy.
     *
     * MUTACIÓN PROBADA: sacar `'direccionPublica'` de `campos` deja este caso en
     * rojo — y el efecto real llegaría el día que `/lugares` gane historial.
     */
    expect(CAMPOS_CON_PAR_DE('lugar').sort()).toEqual([
      'direccion',
      'direccionPublica',
      'geo',
    ]);
    /*
     * Y las rutas son **desde la raíz del documento**: de ahí se derivan los
     * campos, así que una relativa haría que la derivación mintiera. Se verifica
     * contra la interfaz de cada entidad, que es de donde salen los nombres.
     */
    const INTERFAZ: Record<string, [string, string]> = {
      actividad: ['src/types/actividad.ts', 'Actividad'],
      suscripcion: ['src/types/suscripcion-literaria.ts', 'SuscripcionLiteraria'],
      lugar: ['src/types/lugar.ts', 'Lugar'],
    };
    for (const par of PARES_FLAG_DATO) {
      const [archivo, nombre] = INTERFAZ[par.entidad]!;
      const bloque = new RegExp(`export interface ${nombre} \\{\\n([\\s\\S]*?)\\n\\}`).exec(
        fuente(archivo),
      );
      const delDocumento = new Set(
        [...bloque![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!),
      );
      for (const campo of camposDelPar(par)) {
        expect(
          delDocumento.has(campo),
          `${par.id}: «${campo}» no es un campo de primer nivel de \`${nombre}\` — la ruta del ` +
            'registro es relativa y la derivación de `camposDelPar` miente',
        ).toBe(true);
      }
    }
    expect(fuente('src/lib/historial.ts')).toContain("CAMPOS_CON_PAR_DE('actividad')");

    const reglas = fuente('firestore.rules');
    const conHistorial = PARES_FLAG_DATO.filter((p) => p.conHistorial).map((p) => p.entidad);
    expect([...new Set(conHistorial)], 'solo `/actividades` tiene `/versiones`').toEqual([
      'actividad',
    ]);
    for (const entidad of ['suscripciones', 'lugares']) {
      const desde = reglas.indexOf(`match /${entidad}/{id}`);
      expect(desde, `no se encontró el bloque de /${entidad}`).toBeGreaterThan(0);
      expect(
        reglas.slice(desde, desde + 12000),
        `el bloque de /${entidad} dejó de decir que no tiene /versiones: si ahora las tiene, ` +
          'el par flag + dato de esa colección necesita su guarda de restauración (B-819)',
      ).toContain('No hay\n       * subcolección `/versiones` acá');
    }
  });
});
