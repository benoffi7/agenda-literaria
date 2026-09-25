/**
 * B-71: el efecto irreversible va último.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { Actividad } from '@/types/actividad';
import { fuente, versionados, primero } from '../fixtures/clases-de-bug';

// ─────────────────────────────────────────────────────────────────────
// Clase de B-71 · un efecto irreversible ejecutado antes del que puede
// fallar
// ─────────────────────────────────────────────────────────────────────

/**
 * Cuando un caso de uso escribe en dos lugares y uno de los dos no se puede
 * deshacer, el orden decide el modo de falla. Hoy `guardar()` crea las
 * etiquetas nuevas de taxonomía —para las que **no hay UI de limpieza**
 * (B-06)— antes de escribir la actividad, que es la escritura que puede
 * fallar. El resultado de un fallo es basura permanente en el desplegable.
 *
 * Invertido, el peor caso es "la etiqueta no quedó registrada para la próxima
 * vez", que se recupera tipeándola otra vez.
 *
 * El chequeo busca los dos efectos por nombre en todo `src/`, no en un archivo:
 * cuando B-70 saque `guardar()` del componente, sigue mirando.
 *
 * **`borrarPropuesta` (B-838) es de esta familia y no entra acá, a propósito.**
 * También escribe en dos lugares y también el orden decide el modo de falla,
 * pero la conclusión es la contraria: ahí los **dos** efectos son irreversibles
 * (un objeto de Storage y un documento), así que lo que se elige no es «el que no
 * se deshace va último» sino **cuál huérfano es peor** — y gana borrar el objeto
 * primero. Meterlo en este registro invertiría su orden. Su propio caso está en
 * `tests/retencion.test.ts`, con el motivo escrito.
 */
// B-893 — `proponerOpcion` es el alta del publicador por la callable: el mismo
// efecto (una etiqueta nueva en `/opciones/*`), otra puerta. Sin sumarlo acá, un
// flujo que la llamara antes de escribir la actividad pasaría este chequeo.
const EFECTO_IRREVERSIBLE = /await (?:upsertOpcion(?:es)?|proponerOpcion)\(/;

const EFECTO_QUE_PUEDE_FALLAR = /await (?:crear|actualizar)Actividad\(/;


const flujosQueEscribenEnDosLugares = () =>
  versionados('src')
    .filter((f) => /\.tsx?$/.test(f))
    .map((archivo) => ({ archivo, src: fuente(archivo) }))
    .filter(
      ({ src }) => EFECTO_IRREVERSIBLE.test(src) && EFECTO_QUE_PUEDE_FALLAR.test(src),
    );

describe('clase de B-71 · el efecto irreversible va último', () => {
  it('hay al menos un flujo que escribe la actividad y la taxonomía', () => {
    // Si los nombres cambian y esto queda en cero, el chequeo de abajo pasaría
    // sin mirar nada.
    expect(flujosQueEscribenEnDosLugares().map((f) => f.archivo).length).toBeGreaterThan(0);
  });

  /**
   * **Arreglado (B-71):** el caso de uso salió del componente a
   * `src/lib/formulario/guardar.ts` (B-70) y ahí la actividad se escribe
   * primero. El `it.fails` quedó promovido a `it`: de acá en adelante, un flujo
   * nuevo que cree la etiqueta antes de la actividad rompe el CI.
   */
  it('B-71: la actividad se escribe antes que las etiquetas de taxonomía', () => {
    const alReves: string[] = [];
    for (const { archivo, src } of flujosQueEscribenEnDosLugares()) {
      const irreversible = primero(src, EFECTO_IRREVERSIBLE);
      const puedeFallar = primero(src, EFECTO_QUE_PUEDE_FALLAR);
      if (irreversible < puedeFallar) alReves.push(`${archivo}: la taxonomía se escribe primero`);
    }
    expect(alReves).toEqual([]);
  });
});
