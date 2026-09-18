/**
 * Los filtros del listado sobreviven a ir y volver de una actividad — B-955.
 *
 * ── Qué se rompió, y por qué un test ──────────────────────────────────────
 * Pedido del dueño: *«en el admin, preservar filtros al ir y venir de una
 * actividad»*. La causa era de una línea: el `useState` de los filtros vivía
 * dentro de `ListaActividades`, y `AdminApp` **desmonta** ese componente en
 * cuanto la vista deja de ser la lista. Al volver, el estado nacía vacío y se
 * llevaba puestos los ocho ejes, el texto de búsqueda y el orden.
 *
 * ── Por qué se lee el fuente y no se monta el panel ───────────────────────
 * Montar `AdminApp` pide Firebase Auth, el listado, las opciones y la analítica
 * de mentira: sería el test más caro del repo para afirmar dónde vive un
 * `useState`. Y lo que hay que proteger **es estructural** —el estado no puede
 * vivir en un componente que se desmonta—, así que se afirma donde se decide.
 *
 * El comportamiento de los filtros ya está cubierto en otro lado y no se repite:
 * puro en `filtrosActividades.test.ts`, y renderizado en
 * `filtros-del-panel.render.test.tsx`.
 *
 * **Los comentarios se sacan antes de mirar** (D-124): este archivo cita el
 * código viejo en su prosa, y un aserto que lee prosa mide la prosa.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const fuente = (relativo: string): string =>
  sinComentarios(readFileSync(fileURLToPath(new URL(`../${relativo}`, import.meta.url)), 'utf8'));

const LISTA = 'src/components/admin/ListaActividades.tsx';
const APP = 'src/components/admin/AdminApp.tsx';

describe('el estado de los filtros no vive donde se desmonta — B-955', () => {
  it('el control positivo: los dos archivos se leen y no están vacíos', () => {
    // Sin esto, una ruta mal escrita dejaría todo lo de abajo en verde sobre un
    // string vacío (B-873).
    expect(fuente(LISTA).length).toBeGreaterThan(1000);
    expect(fuente(APP).length).toBeGreaterThan(1000);
  });

  it('`AdminApp` declara los filtros y el orden', () => {
    const app = fuente(APP);
    expect(app).toMatch(/useState<Filtros>\(FILTROS_VACIOS\)/);
    expect(app).toMatch(/useState<Orden>\(ORDEN_POR_DEFECTO\)/);
  });

  it('y `ListaActividades` NO los declara: los recibe', () => {
    // La mutación de este caso es el bug de B-955 exactamente: devolver el
    // `useState` a este archivo lo pone rojo.
    const lista = fuente(LISTA);
    expect(lista, 'los filtros volvieron a nacer dentro del listado').not.toMatch(
      /useState<Filtros>/,
    );
    expect(lista, 'el orden volvió a nacer dentro del listado').not.toMatch(/useState<Orden>/);
    expect(lista).toMatch(/filtros: Filtros;/);
    expect(lista).toMatch(/orden: Orden;/);
  });

  it('y `AdminApp` se los pasa: declararlos sin pasarlos sería lo mismo que antes', () => {
    const app = fuente(APP);
    for (const prop of ['filtros={filtros}', 'setFiltros={setFiltros}', 'orden={orden}', 'setOrden={setOrden}']) {
      expect(app, `falta ${prop} en el montaje del listado`).toContain(prop);
    }
  });

  it('la premisa sigue en pie: `AdminApp` desmonta el listado al cambiar de vista', () => {
    /*
     * Es lo que hace que todo lo de arriba importe. Si algún día el listado
     * quedara montado siempre —con la vista tapándolo por CSS, digamos—, el
     * `useState` de adentro habría alcanzado y este archivo estaría cuidando
     * algo que dejó de ser un problema. Que se ponga rojo ahí es correcto: hay
     * que venir a releer la decisión.
     */
    const app = fuente(APP);
    expect(app).toMatch(/vista\.tipo === 'lista'/);
  });
});
