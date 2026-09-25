/**
 * B-209: la consulta sale antes de cualquier escritura.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { fuente } from '../fixtures/clases-de-bug';

/**
 * Clase de B-209 · un comando de consulta no puede convertirse en escritura
 * porque alguien movió una línea.
 *
 * `scripts/preparar-produccion.mjs --listar` contesta "quién tiene el claim
 * admin hoy". Reemplazó a una tabla versionada con los mails y los uids reales
 * en un repo público, así que **tiene que poder correrse sin miedo**: la doc de
 * `08-operacion.md` promete que "es solo consulta: no siembra ni escribe nada".
 *
 * Hoy eso es cierto, pero **no es una propiedad del código: es del orden de las
 * líneas.** La rama sale con `process.exit(0)` antes del `getFirestore()`, del
 * `ref.set` y del `setCustomUserClaims`. Mover el `if` treinta líneas abajo, o
 * subir el `getFirestore()` con un `set` en el medio, convierte una consulta en
 * una escritura a producción — y este script **aborta** si detecta un emulador,
 * así que la escritura sería siempre contra lo real. Lo señaló el
 * `auditor-privacidad` sobre el propio cambio que agregó el flag.
 *
 * Es la misma forma que la clase de B-71 (el efecto irreversible va último):
 * una garantía que depende de qué viene antes de qué se verifica leyendo el
 * orden, no confiando en que nadie lo toque.
 */
describe('clase de B-209 · la consulta sale antes de cualquier escritura', () => {
  const SCRIPT = 'scripts/preparar-produccion.mjs';

  /** Primera aparición, o `Infinity` si no está. */
  const donde = (src: string, aguja: string): number => {
    const i = src.indexOf(aguja);
    return i === -1 ? Infinity : i;
  };

  it('el script y sus marcas siguen ahí', () => {
    // Control positivo: con un `indexOf` que no encuentra nada, las
    // comparaciones de abajo pasarían comparando Infinity contra Infinity.
    const src = fuente(SCRIPT);
    expect(donde(src, 'quiereListar')).toBeLessThan(Infinity);
    expect(donde(src, 'process.exit(0)')).toBeLessThan(Infinity);
    expect(donde(src, 'getFirestore()')).toBeLessThan(Infinity);
    expect(donde(src, 'setCustomUserClaims')).toBeLessThan(Infinity);
  });

  it('la rama de --listar termina antes de tocar Firestore o Auth', () => {
    const src = fuente(SCRIPT);
    const salida = donde(src, 'process.exit(0)');

    for (const escritura of ['getFirestore()', 'ref.set(', 'setCustomUserClaims']) {
      expect(
        salida,
        `--listar tiene que salir antes de \`${escritura}\`: si no, consultar escribe`,
      ).toBeLessThan(donde(src, escritura));
    }
  });

  it('un argumento no reconocido aborta antes de escribir', () => {
    // El bug concreto que había: `--listar` se buscaba solo en argv[2], así que
    // `<email> --listar` ignoraba el flag y sembraba en producción.
    const src = fuente(SCRIPT);
    expect(src).toContain("argumentos.includes('--listar')");
    expect(donde(src, 'Argumento no reconocido')).toBeLessThan(donde(src, 'getFirestore()'));
  });
});
