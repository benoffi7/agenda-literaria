import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ETIQUETA_ESTADO as ETIQUETA_ESTADO_FORM } from '@/components/admin/formulario/etiquetasUI';
import { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD } from '@/lib/filtrosActividades';
import { ENTREGAS_MATERIAL, TIPOS_MATERIAL } from '@/types/actividad';
import { ETIQUETA_TIPO_MATERIAL } from '@calendario';
import { ESTADOS, MODALIDADES } from '@/types/actividad';

/**
 * B-76 — el vocabulario de etiquetas de la UI, verificado como clase.
 *
 * El bug era una instancia: el listado renderizaba `{a.estado}` y decía
 * "borrador" donde el formulario decía "Borrador". Arreglar esa línea protege
 * esa línea; lo que hace falta proteger es la **forma**: *el mismo valor
 * guardado leído distinto en dos pantallas del panel*.
 *
 * Por eso acá hay dos chequeos y no uno:
 *
 *  1. que el listado use el mapa compartido y no el valor crudo — la instancia
 *     que se arregló;
 *  2. que el mapa del formulario **diga lo mismo** que el compartido — la clase,
 *     que sigue viva en `modalidad` y por eso su chequeo es `it.fails`.
 *
 * Los mapas del formulario se leen del fuente como texto porque el panel no
 * tiene tests de componentes (`docs/05-patrones.md`): importar el `.tsx`
 * arrastraría React y Firestore para leer cuatro strings.
 */

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

/** Ídem, pero desde la raíz del repo: `functions/` no está bajo `src/`. */
const fuenteEnRaiz = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/*
 * B-79 partió el formulario en secciones y se llevó los mapas a
 * `formulario/etiquetasUI.ts`. Este chequeo los buscaba en
 * `ActividadFormulario.tsx` y se quedó midiendo un archivo que ya no los tiene:
 * el mapa salía vacío y el chequeo de `estado` rompió, mientras el `it.fails` de
 * `modalidad` seguía fallando **por el motivo equivocado** — que es el punto
 * ciego que encontró B-171: un `it.fails` que falla se ve bien aunque falle por
 * otra cosa.
 *
 * De ahí que `estado` ya no se lea del fuente: se compara la identidad del
 * objeto, que es lo que de verdad garantiza que hay un solo vocabulario. Solo
 * `modalidad` sigue leyéndose como texto, porque ahí todavía hay dos mapas.
 */
const FORMULARIO = fuente('components/admin/formulario/etiquetasUI.ts');
const LISTADO = fuente('components/admin/ListaActividades.tsx');

/**
 * Extrae `const ETIQUETA_X = { clave: 'valor', … }` del fuente.
 *
 * Devuelve `{}` si el mapa dejó de existir con ese nombre, y el test que lo usa
 * lo declara vacío en vez de pasar por omisión: un mapa renombrado tiene que
 * romper esto, no volverlo silencioso.
 */
const mapaDelFuente = (src: string, nombre: string): Record<string, string> => {
  /*
   * Dos cosas que este regex aprendió a la mala, las dos de la misma clase —un
   * chequeo que lee el fuente y cree haber encontrado lo que buscaba:
   *
   *  1. `[^={\n]*` salta una anotación de tipo entre el nombre y el `=`
   *     (`const ETIQUETA_ENTREGA: Record<…, string> = {`). Sin eso el mapa
   *     anotado salía vacío y el chequeo decía "el panel no sabe decir
   *     «previo»" sobre un mapa que lo dice.
   *  2. El `\n` adentro de la clase negada es lo que impide cruzar líneas. Sin
   *     él, una **mención** del nombre en un comentario de arriba enganchaba con
   *     el `= {` del mapa SIGUIENTE, así que se leía el mapa equivocado y
   *     faltaban todas las claves. Un chequeo que mide otra cosa es peor que uno
   *     que no mide nada, porque el mensaje de error manda a buscar donde no está.
   */
  const bloque = new RegExp(`ETIQUETA_${nombre}[^={\n]*=\\s*\\{([^}]*)\\}`).exec(src);
  if (!bloque?.[1]) return {};
  return Object.fromEntries(
    // La clave puede venir citada: un slug con guion (`'al-inscribirse'`) no es
    // un identificador válido, así que en el fuente va entre comillas. `\w+`
    // solo veía las de una palabra, y las de guion —que son justo las que este
    // chequeo existe para no perder— salían como ausentes.
    [...bloque[1].matchAll(/'?([\w-]+)'?\s*:\s*'([^']*)'/g)].map((m) => [m[1]!, m[2]!]),
  );
};

describe('el listado muestra la etiqueta y no el valor guardado (B-76)', () => {
  it('usa el mapa compartido de estados', () => {
    expect(LISTADO).toContain('ETIQUETA_ESTADO[a.estado]');
  });

  it('no renderiza el valor crudo del estado en ningún lado', () => {
    // El bug exacto: `{a.estado}` suelto dentro del JSX. El `??` del fallback
    // no cuenta, porque solo se usa si el mapa no tiene la clave.
    expect(LISTADO).not.toMatch(/>\s*\{a\.estado\}\s*</);
  });

  it('hay etiqueta para los cuatro estados y las tres modalidades', () => {
    for (const e of ESTADOS) expect(ETIQUETA_ESTADO[e]).toBeTruthy();
    for (const m of MODALIDADES) expect(ETIQUETA_MODALIDAD[m]).toBeTruthy();
  });
});

describe('el formulario y el listado no pueden decir lo mismo de dos maneras (B-76)', () => {
  it('los estados son un solo mapa, no dos que coinciden', () => {
    // Identidad y no igualdad: dos objetos con el mismo contenido vuelven a
    // divergir el día que alguien toca uno. Esto solo pasa si es el mismo.
    expect(ETIQUETA_ESTADO_FORM).toBe(ETIQUETA_ESTADO);
    for (const e of ESTADOS) expect(ETIQUETA_ESTADO[e]).toBeTruthy();
  });

  /**
   * Clase todavía viva (B-175). El formulario dice "Híbrido" y el listado
   * "Presencial y virtual" para el mismo valor guardado.
   *
   * Qué lo haría pasar: un solo vocabulario que usen las dos pantallas
   * (`src/lib/etiquetas.ts`, lo que propone B-76). Eso toca
   * `ActividadFormulario.tsx`, que es de otro frente, así que queda anotado y
   * este chequeo se queda en rojo-esperado hasta entonces.
   */
  it.fails('las modalidades coinciden', () => {
    const delFormulario = mapaDelFuente(FORMULARIO, 'MODALIDAD');
    expect(Object.keys(delFormulario).length).toBe(MODALIDADES.length);
    for (const m of MODALIDADES) expect(delFormulario[m]).toBe(ETIQUETA_MODALIDAD[m]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-132 — ningún desplegable del panel pinta un slug pelado
// ─────────────────────────────────────────────────────────────────────

/**
 * El bug era `` `${value} (nueva)` `` en `TaxonomiaSelect`: `value` es el slug,
 * así que se leía `villa-crespo (nueva)`. Se llegaba por dos caminos —cargar una
 * etiqueta nueva, y reeditar una actividad cuya etiqueta nunca se registró— y
 * los dos salen de la misma línea.
 *
 * Lo que se verifica acá es **la clase**: que ningún componente del panel
 * interpole un valor de taxonomía crudo en el texto que se ve. Arreglar la línea
 * protege la línea; el `(nueva)`, el `(sin aprobar)` y el que venga son la misma
 * forma, y el tercero lo va a escribir alguien que no leyó este archivo.
 *
 * Se lee del fuente porque el panel no tiene tests de componentes (B-08). La
 * limitación está asumida: esto no prueba que la pantalla se vea bien, prueba que
 * el des-slug compartido está en el camino.
 */
describe('ningún desplegable pinta un slug pelado (B-132)', () => {
  const SELECT = fuente('components/admin/campos/TaxonomiaSelect.tsx');

  it('el option del valor no conocido pasa por el des-slug compartido', () => {
    // Del MISMO módulo que usa la descripción del evento público (D-20): dos
    // des-slugs distintos leen el mismo slug de dos maneras y nada falla.
    expect(SELECT).toMatch(/from '@calendario'/);
    expect(SELECT).toMatch(/desSlug\(value\)/);
  });

  it('no queda ninguna interpolación del valor crudo en un texto visible', () => {
    // El patrón exacto del bug, y sus vecinos: `${value}` seguido de texto
    // dentro de un template literal que se renderiza.
    expect(SELECT).not.toMatch(/`\$\{value\}[^`]/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-134 — todo valor del modelo tiene etiqueta en las dos pantallas
// ─────────────────────────────────────────────────────────────────────

/**
 * La clase, por tercera vez en este archivo: **un valor del modelo que se
 * renderiza sin pasar por un mapa de etiquetas**. Fue el estado en el listado
 * (B-76), el slug de taxonomía en los desplegables (B-132) y el tipo de material
 * en el editor (B-134), que decía "guia" y "autor" mientras el evento público
 * decía "Guía" y "Sobre el autor".
 *
 * Arreglar cada instancia no evita la cuarta: el patrón que la produce es
 * agregar un valor al enum y olvidarse de uno de los mapas, y ahí el desplegable
 * muestra el slug sin que nada falle. Esto lo hace fallar.
 */
describe('ningún valor del modelo se renderiza sin etiqueta (B-134)', () => {
  it('cada tipo de material tiene etiqueta en el vocabulario compartido', () => {
    for (const tipo of TIPOS_MATERIAL) {
      expect(ETIQUETA_TIPO_MATERIAL[tipo], `falta la etiqueta de «${tipo}»`).toBeTruthy();
    }
  });

  it('cada entrega tiene etiqueta en el panel y en el evento público', () => {
    // Los dos mapas existen a propósito —el panel capitaliza, el evento va en
    // minúscula a mitad de frase— pero ninguno puede tener agujeros.
    const delEvento = mapaDelFuente(fuenteEnRaiz('functions/calendario.js'), 'ENTREGA');
    const delPanel = mapaDelFuente(fuente('components/admin/MaterialEditor.tsx'), 'ENTREGA');
    for (const entrega of ENTREGAS_MATERIAL) {
      expect(delEvento[entrega], `el evento no sabe decir «${entrega}»`).toBeTruthy();
      expect(delPanel[entrega], `el panel no sabe decir «${entrega}»`).toBeTruthy();
    }
  });

  it('el editor de material no pinta el valor crudo', () => {
    const EDITOR = fuente('components/admin/MaterialEditor.tsx');
    // El bug exacto: `{t}` suelto como contenido de un `<option>`.
    expect(EDITOR).not.toMatch(/<option key=\{t\} value=\{t\}>\s*\n?\s*\{t\}/);
    expect(EDITOR).toMatch(/ETIQUETA_TIPO_MATERIAL\[t\]/);
  });
});
