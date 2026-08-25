import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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

const FORMULARIO = fuente('components/admin/ActividadFormulario.tsx');
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
  it('los estados coinciden', () => {
    const delFormulario = mapaDelFuente(FORMULARIO, 'ESTADO');
    expect(Object.keys(delFormulario).length).toBe(ESTADOS.length);
    for (const e of ESTADOS) expect(delFormulario[e]).toBe(ETIQUETA_ESTADO[e]);
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
