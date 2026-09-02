import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAMPOS_VALIDABLES } from '@/lib/analytics-eventos';

/**
 * B-197 — el error de una fila se ve **en la fila**.
 *
 * `material.items.N.titulo` es obligatorio al publicar, y `MaterialEditor`
 * recibía un solo `error` —el de la lista— así que el rechazo de una fila
 * puntual solo se leía en la barra de abajo («Título del material»): con dos
 * filas cargadas y una sin título, el mensaje no decía cuál de las dos. Era la
 * única familia de campos del formulario que no mostraba su propio error, y el
 * patrón que la mantenía así era ese: el editor no recibía con qué.
 *
 * ── Por qué acá y no en `campos-faltantes.test.ts` ──────────────────────────
 * Ese archivo verifica el **mensaje de la barra** (B-184): que todo campo del
 * schema tenga nombre y sección. Esto verifica la otra mitad, la que B-184 dio
 * por supuesta: que el campo, además de estar nombrado en la barra, esté
 * marcado en rojo donde se edita.
 *
 * ── Clase, no instancia ────────────────────────────────────────────────────
 * La lista de sufijos se **deriva** de `CAMPOS_VALIDABLES`, que
 * `tests/analytics-campos.test.ts` mantiene pegado al schema de zod. Un campo
 * nuevo en una fila de material entra solo: si el schema puede rechazarlo y el
 * editor no lo pinta, falla acá y no en producción con una barra que dice «1
 * campo» y no dice cuál.
 *
 * El panel no tiene tests de componentes (B-08, `docs/05-patrones.md`), así que
 * lo que se lee es el fuente. Es el mismo recurso que usa
 * `tests/etiquetas-de-ui.test.ts` por el mismo motivo: importar el `.tsx`
 * arrastraría React y Firestore para leer cuatro strings.
 */

const fuente = (rel: string): string => readFileSync(`src/${rel}`, 'utf8');

/** Los sufijos de campo de una fila de material, según el schema. */
const PREFIJO = 'material.items.N.';
const sufijosDeMaterial = [...CAMPOS_VALIDABLES]
  .filter((r) => r.startsWith(PREFIJO))
  .map((r) => r.slice(PREFIJO.length))
  .sort();

describe('el error de una fila de material se pinta al lado del campo (B-197)', () => {
  const EDITOR = fuente('components/admin/MaterialEditor.tsx');
  const SECCION = fuente('components/admin/formulario/SeccionMaterial.tsx');

  it('hay sufijos que verificar (control positivo)', () => {
    // Sin esto, el recorrido de abajo pasaría con la lista vacía: el chequeo
    // quedaría en verde sin haber mirado un solo campo.
    expect(sufijosDeMaterial).toContain('titulo');
    expect(sufijosDeMaterial.length).toBeGreaterThan(3);
  });

  it('la sección le pasa el mapa entero, no el error de la lista', () => {
    expect(SECCION).toContain('errorDe={errorDe}');
    // El bug exacto: pasarle únicamente el error de `material.items`.
    expect(SECCION).not.toMatch(/error=\{errorDe\('material\.items'\)\}/);
  });

  it('el editor arma la ruta con el índice en el medio', () => {
    // Es donde lo pone el `path` del superRefine (`material.items.2.titulo`).
    // Armada distinto, el error existe en el mapa y no se pinta nunca — y nada
    // falla: `errorDe` de una clave que no existe devuelve `undefined`.
    expect(EDITOR).toMatch(/material\.items\.\$\{i\}\.\$\{sufijo\}/);
  });

  it('cada campo de la fila lee su propio error', () => {
    for (const sufijo of sufijosDeMaterial) {
      expect(
        EDITOR,
        `el editor de material no pinta el error de «${sufijo}»: ` +
          'el rechazo de esa fila solo se vería en la barra',
      ).toContain(`errorDe(ruta('${sufijo}'))`);
    }
  });

  it('el error de la lista sigue mostrándose, y sigue marcando el ancla', () => {
    // No se reemplazó: `material.items` —la casilla tildada y ningún material—
    // es un rechazo de la lista y no de ninguna fila.
    expect(EDITOR).toContain("errorDe('material.items')");
    // `data-campo-con-error` es lo que hace que un guardado fallido scrollee
    // hasta acá (B-184). Lo pone `Campo` en cada campo de la fila, y la línea
    // de la lista lo pone a mano.
    expect(EDITOR).toContain('data-campo-con-error');
  });

  it('los campos de la fila usan `Campo`, que es quien marca el ancla', () => {
    // El editor pintaba `<label>` a mano, sin `Campo`, y por eso ningún campo de
    // material quedaba marcado en el DOM: el scroll de B-184 caía en la línea de
    // la lista o en el principio de la sección.
    expect(EDITOR).toContain("import {\n  Campo,");
    expect(EDITOR).toMatch(/<Campo\b[\s\S]*?label="Título"/);
  });
});
