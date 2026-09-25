/**
 * B-854: «¿hay X?» se contesta igual en cada salida.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import type { Actividad } from '@/types/actividad';
// B-891 — las cinco salidas que contestan «¿hay tallerista?» y «¿hay libro?».
import { toPublic } from '@/lib/toPublic';
import { detalleDeActividad } from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { construirTextoRedes } from '@/lib/textoRedes';
import { construirDescripcion } from '../../functions/calendario.js';
import { actividadDePrueba } from '../fixtures/indice';
import { fuente, CENTINELA } from '../fixtures/clases-de-bug';

/**
 * **Clase de B-854 · «¿hay X?» se contesta igual en cada salida.**
 *
 * ── Lo que pasó, cinco veces ──────────────────────────────────────────────
 * El tallerista «solo tiene sentido si tiene nombre» y el libro «si tiene
 * título» (`formADocumento`). Pero esa pregunta se contesta en cada salida por
 * separado, y cada una la contestó a su manera: mirando el objeto (B-854 en el
 * detalle, B-861 en `toPublic`, B-881 en el texto para redes), mirando el campo
 * sin `trim()` (B-885 en Calendar), y las dos cosas con el libro (B-891). La
 * cáscara —`{ nombre: '   ', bio: '…' }`, `{ titulo: '   ', autor: '…' }`— llega
 * de un escritor de afuera del panel o de una restauración del historial, que no
 * pasan por `formADocumento`, y cada salida que la dejaba pasar publicaba **lo
 * que colgaba del objeto**: la bio de alguien sin nombre, «Se presenta    , de
 * Bolaño» en el HTML indexado.
 *
 * ── Por qué por comportamiento y no por el fuente ────────────────────────
 * Buscar `?.trim()` en el fuente daría verde con el predicado bien escrito en el
 * lugar equivocado. Acá se le da **la misma cáscara a las cinco derivaciones** y
 * se exige que ninguna publique lo que cuelga de ella. Un campo nuevo con la
 * misma forma («solo tiene sentido si tiene X») entra agregando una fila a
 * `CASCARAS`; una salida nueva, agregando una entrada a `SALIDAS`.
 *
 * **Lo que NO verifica**: el texto emitido cuando el campo sí existe. Eso lo
 * cubre el barrido de salidas públicas con sus centinelas; acá solo se exige que
 * el control positivo vea el centinela, para que el negativo no dé verde sin
 * mirar nada.
 */
describe('clase de B-854 · «¿hay X?» se contesta igual en cada salida', () => {
  const AHORA_DE_LA_CLASE = new Date('2026-09-01T12:00:00Z');
  const ETIQUETAS_DE_LA_CLASE = mapaDeEtiquetas({});

  /** Cada salida, como texto: lo que importa es si el centinela aparece. */
  const SALIDAS: Record<string, (a: Actividad) => string> = {
    formADocumento: (a) =>
      JSON.stringify(formADocumento(documentoAForm(a), 'uid', false)),
    toPublic: (a) => JSON.stringify(toPublic(a, 'act_1')),
    // El view-model se alimenta **dos** veces: por el camino completo y con la
    // cáscara metida después de la proyección, porque es el punto de paso de la
    // página (D-140) y no puede depender de que `toPublic` la haya filtrado.
    detalleDeActividad: (a) =>
      JSON.stringify([
        detalleDeActividad(toPublic(a, 'act_1'), ETIQUETAS_DE_LA_CLASE, AHORA_DE_LA_CLASE, {}),
        detalleDeActividad(
          { ...toPublic(actividadDePrueba({}), 'act_1'), tallerista: a.tallerista, libro: a.libro } as never,
          ETIQUETAS_DE_LA_CLASE,
          AHORA_DE_LA_CLASE,
          {},
        ),
      ]),
    construirTextoRedes: (a) => {
      const r = construirTextoRedes(a, 'anuncio', AHORA_DE_LA_CLASE);
      if (!r.ok) throw new Error(`el texto para redes no salió: ${r.motivo}`);
      return r.texto;
    },
    construirDescripcion: (a) => construirDescripcion(a, a.sesiones[0], {}),
  };

  /** La cáscara de cada campo, y el mismo campo lleno para el control positivo. */
  const CASCARAS = [
    {
      campo: 'tallerista',
      // Dos centinelas porque no todas las salidas publican lo mismo del
      // tallerista: el texto para redes lo arroba y no lleva la bio.
      centinelas: ['CENTINELA-CLASE-BIO', 'centinelaclase'],
      lleno: { nombre: 'Ana Ruiz', bio: 'CENTINELA-CLASE-BIO', instagram: '@centinelaclase' },
      vacios: ['', '   '].map((nombre) => ({
        nombre,
        bio: 'CENTINELA-CLASE-BIO',
        instagram: '@centinelaclase',
      })),
    },
    {
      campo: 'libro',
      centinelas: ['CENTINELA-CLASE-AUTOR'],
      lleno: { titulo: 'Los detectives salvajes', autor: 'CENTINELA-CLASE-AUTOR' },
      vacios: ['', '   '].map((titulo) => ({ titulo, autor: 'CENTINELA-CLASE-AUTOR' })),
    },
  ] as const;

  const con = (campo: string, valor: unknown): Actividad =>
    ({ ...actividadDePrueba({}), [campo]: valor }) as Actividad;

  it.each(CASCARAS.flatMap((c) => Object.keys(SALIDAS).map((s) => [c.campo, s, c] as const)))(
    'control positivo: con %s cargado, %s lo publica',
    (_campo, salida, c) => {
      const texto = SALIDAS[salida]!(con(c.campo, c.lleno));
      expect(
        c.centinelas.some((x) => texto.includes(x)),
        `${salida} no publicó ${c.campo}: el negativo de abajo daría verde sin mirar nada`,
      ).toBe(true);
    },
  );

  it.each(CASCARAS.flatMap((c) => Object.keys(SALIDAS).map((s) => [c.campo, s, c] as const)))(
    'la cáscara de %s no sale por %s',
    (campo, salida, c) => {
      for (const vacio of c.vacios) {
        const texto = SALIDAS[salida]!(con(campo, vacio));
        expect(
          c.centinelas.filter((x) => texto.includes(x)),
          `${salida} publicó lo que cuelga de ${campo} ${JSON.stringify(vacio)}: «¿hay ${campo}?» ` +
            'se contesta por el campo que lo identifica, con trim, en todas las salidas (B-854, B-891)',
        ).toEqual([]);
      }
    },
  );
});
