import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ETIQUETA_ESTADO as ETIQUETA_ESTADO_FORM } from '@/components/admin/formulario/etiquetasUI';
import { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD } from '@/lib/filtrosActividades';
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
  const bloque = new RegExp(`ETIQUETA_${nombre}\\s*=\\s*\\{([^}]*)\\}`).exec(src);
  if (!bloque?.[1]) return {};
  return Object.fromEntries(
    [...bloque[1].matchAll(/(\w+)\s*:\s*'([^']*)'/g)].map((m) => [m[1]!, m[2]!]),
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
