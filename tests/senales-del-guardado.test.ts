import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * B-177 — una señal que el caso de uso devuelve y la pantalla no mira.
 *
 * El bug era ese, literal: `guardarActividad` devolvía `etiquetasSinRegistrar` y
 * el formulario no lo leía, así que un guardado que dejó la etiqueta nueva sin
 * registrar se veía **exactamente igual** que uno perfecto. Nada fallaba, nada
 * avisaba, y el arreglo —volver a tipear la etiqueta— nadie sabía que hacía
 * falta.
 *
 * ── La clase, no la instancia ──────────────────────────────────────────────
 * Arreglar esa línea protege esa línea. Lo que hay que proteger es la forma: **un
 * campo del resultado que nadie consume**. Así que los campos del `estado: 'ok'`
 * se **derivan del fuente** de `guardar.ts` y se exige que cada uno aparezca en
 * el componente que llama al caso de uso. Un campo nuevo del resultado que la
 * pantalla ignore falla acá, y no seis meses después con alguien preguntando por
 * qué su etiqueta no está.
 *
 * Se lee el fuente porque el panel no tiene tests de componentes (B-08,
 * `docs/05-patrones.md`). Es el mismo recurso de `tests/etiquetas-de-ui.test.ts`.
 */

const CASO_DE_USO = readFileSync('src/lib/formulario/guardar.ts', 'utf8');
const FORMULARIO = readFileSync('src/components/admin/ActividadFormulario.tsx', 'utf8');
const CHASIS = readFileSync('src/components/admin/AdminApp.tsx', 'utf8');
const AVISO = readFileSync('src/components/admin/AvisoEtiquetas.tsx', 'utf8');

/**
 * Los campos de la variante `estado: 'ok'` de `ResultadoGuardado`, leídos del
 * fuente.
 *
 * El corte es el bloque de la unión que contiene `estado: 'ok'`, y de ahí las
 * claves de primer nivel. `estado` se saca: es el discriminante, no una señal.
 */
const camposDelOk = (): string[] => {
  const i = CASO_DE_USO.indexOf("estado: 'ok';");
  expect(i, 'no se encontró la variante ok de ResultadoGuardado').toBeGreaterThan(-1);
  const bloque = CASO_DE_USO.slice(i, CASO_DE_USO.indexOf('\n    }', i));
  return [...bloque.matchAll(/^\s{6}(\w+)[?]?:/gm)]
    .map((m) => m[1])
    .filter((c) => c !== 'estado');
};

describe('el resultado de guardar no tiene señales que nadie mire (B-177)', () => {
  const campos = camposDelOk();

  it('se encontraron los campos del resultado (control positivo)', () => {
    // Sin esto, el recorrido de abajo pasaría con la lista vacía el día que el
    // tipo se refactorice y el corte deje de encontrarlo.
    expect(campos).toContain('id');
    expect(campos).toContain('etiquetasSinRegistrar');
    expect(campos.length).toBeGreaterThan(2);
  });

  it('el formulario consume cada campo del resultado', () => {
    for (const campo of campos) {
      expect(
        FORMULARIO,
        `\`${campo}\` es un campo del resultado de guardarActividad que la ` +
          'pantalla no lee. Es la forma exacta de B-177: la señal viaja y no se ve.',
      ).toContain(`r.${campo}`);
    }
  });
});

describe('el aviso de etiqueta sin registrar llega a la pantalla (B-177)', () => {
  it('el formulario le pasa las etiquetas a quien sobrevive al guardado', () => {
    // Al guardar, el formulario se desmonta: si el aviso viviera acá, no se
    // vería nunca. Viaja por `onGuardado`.
    expect(FORMULARIO).toContain('onGuardado(r.id, r.etiquetasSinRegistrar)');
  });

  it('el chasis del panel lo pinta', () => {
    expect(CHASIS).toContain('<AvisoEtiquetas');
    expect(CHASIS).toContain('etiquetas={etiquetasSinRegistrar}');
  });

  it('lo pinta fuera de la vista, así aparece se vuelva al listado o al calendario', () => {
    // Adentro del listado, volver del formulario al calendario —que es de dónde
    // se entró si se editó desde ahí— se comería el aviso.
    const i = CHASIS.indexOf('<AvisoEtiquetas');
    // Las dos vistas a las que se puede volver del formulario.
    const listado = CHASIS.indexOf('<ListaActividades');
    const calendario = CHASIS.indexOf('<CalendarioActividades');
    expect(i).toBeGreaterThan(-1);
    expect(listado).toBeGreaterThan(-1);
    expect(calendario).toBeGreaterThan(-1);
    expect(i, 'el aviso quedó adentro de una vista').toBeLessThan(
      Math.min(listado, calendario),
    );
  });

  it('abrir un formulario limpia el aviso del guardado anterior', () => {
    // Un aviso viejo colgado arriba de una carga nueva se lee como si fuera de
    // esta, y manda a arreglar una etiqueta de otra actividad. Las cuatro
    // entradas a un formulario son nueva, editar (desde el listado y desde el
    // calendario) y duplicar.
    const entradas = [
      "setVista({ tipo: 'nueva' })",
      "setVista({ tipo: 'editar', actividad: a })",
      "setVista({ tipo: 'duplicar', copia, tituloOrigen })",
    ];
    for (const entrada of entradas) {
      let desde = 0;
      let encontradas = 0;
      for (;;) {
        const i = CHASIS.indexOf(entrada, desde);
        if (i === -1) break;
        encontradas += 1;
        desde = i + entrada.length;
        /*
         * El cuerpo **de ese handler**, no una ventana de N caracteres: los
         * handlers están pegados, así que una ventana se come la limpieza del de
         * al lado y la mutación «saqué la limpieza de duplicar» sobrevive. Se
         * corta desde el `=> {` que abre este handler.
         */
        const cuerpo = CHASIS.slice(CHASIS.lastIndexOf('=> {', i), i);
        expect(
          cuerpo,
          `la entrada «${entrada}» no limpia el aviso del guardado anterior`,
        ).toContain('setEtiquetasSinRegistrar([])');
      }
      expect(encontradas, `no se encontró la entrada «${entrada}»`).toBeGreaterThan(0);
    }
  });

  it('el aviso no se pinta cuando no hay nada que avisar', () => {
    // Sin esto, la franja quedaría siempre en pantalla como un cartel vacío.
    expect(AVISO).toContain('if (etiquetas.length === 0) return null;');
  });

  it('el aviso nombra las etiquetas y lleva a donde se arreglan', () => {
    // «Alguna etiqueta no se registró» no es accionable: hay cinco campos con
    // taxonomía. Y el destino existe desde B-170, que es lo que hace que este
    // aviso valga la pena y no sea solo una mala noticia.
    expect(AVISO).toContain('etiquetas.map');
    expect(AVISO).toContain('onIrAOpciones');
    expect(CHASIS).toMatch(/onIrAOpciones=\{\(\) => \{[\s\S]*?tipo: 'taxonomias'/);
  });

  it('el texto del aviso le habla a quien carga, no a quien programa', () => {
    // La misma regla que `tests/ayuda.test.ts` le pone a la guía: sin jerga, sin
    // nombres de campo, sin rutas de colección.
    for (const jerga of ['/opciones', 'slug', 'Firestore', 'taxonomía', 'upsert', '§']) {
      expect(
        // Solo el texto visible: los comentarios del fuente sí nombran todo eso.
        AVISO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
        `el aviso usa jerga: «${jerga}»`,
      ).not.toContain(jerga);
    }
  });
});
