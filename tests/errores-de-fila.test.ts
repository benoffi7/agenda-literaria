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

/**
 * Los sufijos de campo de una fila de material, según el schema.
 *
 * `id` queda afuera a propósito desde B-342: es el id de cliente (trampa 2),
 * de máquina y sin ningún campo del formulario que lo edite, la misma
 * exclusión que ya aplican `imagenes.N.id` y `sesiones.N.id` en sus propios
 * editores.
 */
const PREFIJO = 'material.items.N.';
const sufijosDeMaterial = [...CAMPOS_VALIDABLES]
  .filter((r) => r.startsWith(PREFIJO))
  .map((r) => r.slice(PREFIJO.length))
  .filter((sufijo) => sufijo !== 'id')
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
    expect(EDITOR).toMatch(/import \{[^}]*\bCampo\b[^}]*\} from '@\/components\/admin\/campos\/Campo'/);
    expect(EDITOR).toMatch(/<Campo\b[\s\S]*?label="Título"/);
  });

  it('B-342 — usa el chasis `FilasEditor`, con ids de cliente y no por índice', () => {
    expect(EDITOR).toContain("import { FilasEditor } from '@/components/admin/campos/FilasEditor'");
    expect(EDITOR).toMatch(/<FilasEditor\b/);
    // El bug exacto que reemplaza: borrar/editar comparando por posición.
    expect(EDITOR).not.toMatch(/items\.filter\(\(_, j\) => j !== i\)/);
    expect(EDITOR).not.toMatch(/items\.map\(\(it, j\) => \(j === i/);
  });
});

/**
 * B-341 — la otra mitad de B-197: la galería tampoco pintaba su propio error.
 *
 * `GaleriaEditor` declaraba `error?: string` y lo pintaba, pero `SeccionQueEs`
 * lo montaba sin ese atributo — la línea que pinta el error era código muerto,
 * y todo lo que el schema rechaza de `imagenes` se veía solo en la barra de
 * abajo. De los ocho campos de una imagen (`imagenes.N.*`), el schema solo
 * puede rechazar `url` (el resto son de máquina —`id`, `origen`, `storagePath`,
 * `ancho`, `alto`— o no tienen refine —`epigrafe`, `portada`—), así que acá no
 * se deriva la lista completa de `CAMPOS_VALIDABLES` como en B-197: se fija a
 * mano el único sufijo que puede fallar.
 */
describe('el error de una fila de la galería se pinta al lado del campo (B-341)', () => {
  const EDITOR = fuente('components/admin/GaleriaEditor.tsx');
  const SECCION = fuente('components/admin/formulario/SeccionQueEs.tsx');

  it('hay un sufijo validable en el schema (control positivo)', () => {
    expect(CAMPOS_VALIDABLES).toContain('imagenes.N.url');
  });

  it('la sección le pasa el mapa entero, no un `error` suelto', () => {
    expect(SECCION).toContain('errorDe={errorDe}');
    // El bug exacto: el editor no recibía ningún atributo de error.
    expect(SECCION).not.toMatch(/<GaleriaEditor[\s\S]*?error=\{/);
  });

  it('el editor recibe `errorDe`, no un `error` de un solo string', () => {
    expect(EDITOR).toContain('errorDe: (path: string) => string | undefined');
  });

  it('el editor arma la ruta de la fila con el índice en el medio', () => {
    // Es donde lo pone el `path` del superRefine (`imagenes.2.url`).
    expect(EDITOR).toMatch(/`imagenes\.\$\{i\}\.url`/);
  });

  it('cada fila lee su propio error de url', () => {
    expect(
      EDITOR,
      'el editor de la galería no pinta el error de «url»: el rechazo de esa ' +
        'fila solo se vería en la barra',
    ).toContain('errorDe(`imagenes.${i}.url`)');
  });

  it('el error de la lista se pinta y marca el ancla', () => {
    expect(EDITOR).toContain("errorDe('imagenes')");
    // `data-campo-con-error` es lo que hace que un guardado fallido scrollee
    // hasta acá (B-184). Antes ningún elemento de esta sección lo tenía.
    expect(EDITOR).toContain('data-campo-con-error');
  });
});

/**
 * B-343 — la otra mitad de B-197: los encuentros tampoco pintaban el error del
 * schema por fila.
 *
 * De los seis campos de una sesión (`sesiones.N.*`), el schema solo puede
 * rechazar `inicio` y `fin` («Falta la fecha de inicio/fin»; el resto —`id`,
 * `tema`, `lectura`, `cancelada`, `calendarEventId`— son de máquina, opcionales
 * o sin refine), así que como en B-341 se fija a mano la lista en vez de
 * derivarla entera de `CAMPOS_VALIDABLES`.
 *
 * El `.refine` de `sesionSchema` («el fin no es posterior al inicio») no entra
 * acá a propósito: ya tiene su propio aviso vivo en la fila (`resumirSesion`,
 * más rico porque dice el día de la semana) y el ítem decidió mantener los dos
 * caminos en vez de unificarlos.
 */
describe('el error de una fila de encuentros se pinta al lado del campo (B-343)', () => {
  const EDITOR = fuente('components/admin/SesionesEditor.tsx');
  const SECCION = fuente('components/admin/formulario/SeccionEncuentros.tsx');

  it('hay sufijos validables en el schema (control positivo)', () => {
    expect(CAMPOS_VALIDABLES).toContain('sesiones.N.inicio');
    expect(CAMPOS_VALIDABLES).toContain('sesiones.N.fin');
  });

  it('la sección le pasa el mapa entero, no el error de la lista', () => {
    expect(SECCION).toContain('errorDe={errorDe}');
    expect(SECCION).not.toMatch(/error=\{errorDe\('sesiones'\)\}/);
  });

  it('el editor arma la ruta con el índice en el medio', () => {
    expect(EDITOR).toMatch(/`sesiones\.\$\{i\}\.\$\{sufijo\}`/);
  });

  it('inicio y fin leen su propio error', () => {
    for (const sufijo of ['inicio', 'fin']) {
      expect(
        EDITOR,
        `el editor de encuentros no pinta el error de «${sufijo}»`,
      ).toContain(`errorDe(ruta('${sufijo}'))`);
    }
  });

  it('el error de la lista sigue mostrándose', () => {
    // «Cargá al menos un encuentro» — lo pinta `FilasEditor` con su propio
    // `error`, que acá se arma desde `errorDe('sesiones')`.
    expect(EDITOR).toContain("errorDe('sesiones')");
  });

  it('inicio y fin usan `Campo`, que es quien marca el ancla de B-184', () => {
    expect(EDITOR).toMatch(/<Campo label="Inicio"/);
    expect(EDITOR).toMatch(/<Campo label="Fin"/);
  });

  it('la derivación paralela de "fin antes del inicio" se conserva', () => {
    // Es más rica que el error del schema —dice el día de la semana— y el
    // ítem decidió no reemplazarla: los dos caminos conviven a propósito.
    expect(EDITOR).toContain('finAntesDelInicio');
  });
});
