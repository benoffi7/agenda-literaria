import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VISTAS_A_TODO_ANCHO, ocupaTodoElAncho } from '@/lib/anchoDelPanel';
import { VISTAS_CON_FORMULARIO } from '@/lib/salida-del-panel';

/**
 * Qué pantalla del panel usa todo el ancho — B-600.
 *
 * La regla es pura y se testea directo. Lo que **no** se puede testear así es el
 * cableado, y es justo la mitad que se rompe sola: el panel volvería a quedar
 * encajonado si alguien deja el `max-w-3xl` fijo en el `className` y nada
 * fallaría. De ahí el segundo bloque, que lee `AdminApp.tsx` como texto — mismo
 * criterio y mismo motivo que `tests/salida-del-panel.test.ts`.
 */

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

describe('el ancho lo decide la vista (B-600)', () => {
  it('el listado usa todo el ancho: es la grilla de tarjetas', () => {
    expect(ocupaTodoElAncho('lista')).toBe(true);
  });

  it('ninguna vista con formulario lo usa', () => {
    /*
     * La mitad que importa de la decisión. Un formulario de 30+ campos a 1900px
     * separa la etiqueta de su error y pasa el límite de renglón cómodo: es peor
     * que el panel encajonado, no mejor. La lista sale de `salida-del-panel.ts`
     * y no se repite acá: son las mismas tres vistas y no puede haber dos
     * versiones de cuáles son.
     */
    for (const vista of VISTAS_CON_FORMULARIO) {
      expect(ocupaTodoElAncho(vista), vista).toBe(false);
    }
  });

  it('las demás vistas arrancan angostas: el default es no ensanchar', () => {
    // Agregar una pantalla y olvidarse de esta lista la deja como está hoy, que
    // es el lado barato de equivocarse (mismo criterio que D-41).
    for (const vista of ['historial', 'reportes', 'taxonomias', 'calendario', 'estadisticas']) {
      expect(ocupaTodoElAncho(vista), vista).toBe(false);
    }
    expect(ocupaTodoElAncho('inventada')).toBe(false);
  });
});

describe('el chasis del panel respeta la decisión (B-600)', () => {
  const ADMIN_APP = fuente('components/admin/AdminApp.tsx');

  /**
   * **Sin comentarios**, y por experiencia propia: este archivo explica en prosa
   * por qué el ancho completo no es `max-w-none`, así que un aserto que busque
   * ese texto en el fuente crudo mide el comentario y no el código. Es la misma
   * lección que dejó escrita `tests/etiquetas-de-ui.test.ts` sobre B-204.
   */
  const codigo = ADMIN_APP.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

  it('el contenedor pregunta por la vista en lugar de fijar un ancho', () => {
    expect(ADMIN_APP).toContain('ocupaTodoElAncho(vista.tipo)');
  });

  it('el ancho de lectura sigue siendo el de siempre', () => {
    // Si esto cambia sin querer, cambia la medida de todas las pantallas del
    // panel menos una, y en ninguna se nota hasta que alguien la mira.
    expect(ADMIN_APP).toContain("ANCHO_DE_LECTURA = 'max-w-3xl lg:max-w-4xl'");
  });

  it('y el ancho completo tiene tope: `max-w-none` sería el mismo bug al revés', () => {
    // Sin tope, en 2560px las cuatro columnas dan tarjetas de 600px.
    expect(codigo).toMatch(/ANCHO_COMPLETO = 'max-w-\[\d+rem\]'/);
    expect(codigo).not.toContain('max-w-none');
  });

  it('no quedó ningún ancho fijo suelto en el contenedor de la vista', () => {
    /*
     * El bug exacto que dejaría el panel encajonado con este módulo puesto: un
     * `max-w-*` escrito al lado del ternario, que gana o pierde contra el de la
     * constante según el orden en que Tailwind emitió las dos utilidades
     * (`docs/05-patrones.md`, primera trampa de Tailwind).
     *
     * Se mira **la clase del contenedor de la vista** y no todo el archivo: el
     * login y la pantalla de «sin permisos» son angostas a propósito y tienen su
     * `max-w-sm` / `max-w-md` legítimo.
     */
    const contenedor = /className=\{`mx-auto[^`]*`\}/.exec(codigo);
    expect(contenedor, 'el contenedor de la vista cambió de forma').not.toBeNull();
    expect(contenedor![0]).not.toContain('max-w-');
  });

  it('las vistas a todo ancho existen en el router', () => {
    // Un typo en la lista la volvería inerte sin que nada falle: la vista no
    // matchearía nunca y el panel seguiría angosto.
    for (const vista of VISTAS_A_TODO_ANCHO) {
      expect(ADMIN_APP, `el router no tiene la vista «${vista}»`).toContain(
        `vista.tipo === '${vista}'`,
      );
    }
  });
});
