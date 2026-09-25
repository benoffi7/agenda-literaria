/**
 * B-171: el detector de efectos duplicables discrimina.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { guardaPorReclamo, marcasDe } from '../fixtures/clases-de-bug';

describe('el detector de efectos duplicables discrimina — B-171', () => {
  it('un efecto que solo vive en un helper se detecta igual', () => {
    // LA regresión de B-171, congelada: `guardarVersion` dejó de contar como
    // "con efecto" el día que su `.set()` se mudó a `guardar`.
    expect(marcasDe('await guardar({ id, eventoId: event.id });')).toBe('');
    expect(
      marcasDe('await guardar({ id, eventoId: event.id });', {
        guardar: 'await versiones.doc(version).set({ documento });',
      }),
    ).toBe('E');
  });

  it('sigue la llamada más de un salto', () => {
    expect(marcasDe('await a();', { a: 'await b();', b: 'await fetch(url);' })).toBe('E');
  });

  it('no se cuelga con un ciclo entre helpers', () => {
    expect(marcasDe('await a();', { a: 'await b();', b: 'await a();' })).toBe('');
  });

  it('direccionar una identidad que ya existe no es un efecto duplicable', () => {
    // Re-ejecutarlos no puede producir un segundo nada.
    expect(marcasDe('await cal.events.update({ eventId });')).toBe('');
    expect(marcasDe('await cal.events.delete({ eventId });')).toBe('');
    expect(marcasDe('await ref.update({ estado });')).toBe('');
    expect(marcasDe('batch.delete(versiones.doc(viejo));')).toBe('');
  });

  it('escribir siempre en la misma dirección tampoco lo es', () => {
    // `marcarRebuild`: si contara, cualquier trigger que marque el rebuild
    // pediría una guarda de reentrega que no necesita.
    expect(marcasDe("db.doc('sistema/rebuild').set({ pendiente: true }, { merge: true });")).toBe(
      '',
    );
  });

  it('escribir en una dirección calculada sí lo es', () => {
    expect(marcasDe('await versiones.doc(version).set({ documento });')).toBe('E');
  });

  it('los verbos de creación lo son, y un `Map` no', () => {
    expect(marcasDe('await cal.events.insert({ requestBody });')).toBe('E');
    expect(marcasDe('await col.add({ x: 1 });')).toBe('E');
    // `ids.set(op.id, eventId)` es un `Map` en memoria, no una escritura.
    expect(marcasDe('const ids = new Map(); ids.set(op.id, eventId);')).toBe('');
  });

  it('un comentario que nombra la llamada no cuenta como la llamada', () => {
    // El repo explica sus guardas en prosa: "el `update` reescribe lo mismo",
    // "`eventoId` de `event.id`". Sin sacar los comentarios, la explicación de
    // una guarda contaría como la guarda.
    expect(marcasDe('// acá iría un await fetch(url) y un .add({})\nreturn;')).toBe('');
    expect(marcasDe('/* await fetch(url); */ return;')).toBe('');
    // Y al revés: un `//` adentro de un string no arranca un comentario.
    expect(marcasDe("const API = 'https://api.github.com'; await fetch(API);")).toBe('E');
  });

  it('el orden entre el reclamo y el efecto se registra, y decide la guarda', () => {
    expect(guardaPorReclamo(marcasDe('await db.runTransaction(tx); await fetch(url);'))).toBe(true);
    expect(guardaPorReclamo(marcasDe('await fetch(url); await db.runTransaction(tx);'))).toBe(false);
    // Y también cuando el efecto está un salto más abajo.
    expect(
      guardaPorReclamo(
        marcasDe('await db.runTransaction(tx); await crear();', { crear: 'await fetch(url);' }),
      ),
    ).toBe(true);
  });
});
