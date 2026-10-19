/**
 * **El caché de etiquetas vence** — B-2192.
 *
 * `invalidarLabels` limpia solo la instancia que lo llama (la de
 * `rebuildPorOpciones`), así que la de `syncCalendar` tiene que releer sola: sin
 * vencimiento, una instancia tibia reescribía la etiqueta vieja en eventos que un
 * renombre ya había corregido.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { VIGENCIA_DE_LABELS_MS, cargarLabels, invalidarLabels } from '../functions/etiquetas.js';

const dbFalsa = (etiqueta: { actual: string }) => {
  const lecturas = { total: 0 };
  return {
    lecturas,
    doc: (ruta: string) => ruta,
    getAll: async (...rutas: string[]) => {
      lecturas.total += 1;
      return rutas.map(() => ({ data: () => ({ valores: [{ slug: 'gratis', label: etiqueta.actual }] }) }));
    },
  };
};

describe('el caché de etiquetas de Calendar vence — B-2192', () => {
  beforeEach(() => invalidarLabels());

  it('dentro de la vigencia no relee; pasada, sí, y trae la etiqueta nueva', async () => {
    // Mutación probada: volver a `if (_labels) return _labels;` deja la vieja.
    const etiqueta = { actual: 'Gratis' };
    const db = dbFalsa(etiqueta);
    let reloj = 1_000_000;
    const ahora = () => reloj;

    expect((await cargarLabels(db as never, ahora)).arancel!.gratis).toBe('Gratis');
    etiqueta.actual = 'Sin costo';
    reloj += VIGENCIA_DE_LABELS_MS - 1;
    expect((await cargarLabels(db as never, ahora)).arancel!.gratis).toBe('Gratis');
    expect(db.lecturas.total).toBe(1);

    reloj += 2;
    expect((await cargarLabels(db as never, ahora)).arancel!.gratis).toBe('Sin costo');
    expect(db.lecturas.total).toBe(2);
  });

  it('la vigencia es corta: un minuto', () => {
    expect(VIGENCIA_DE_LABELS_MS).toBeLessThanOrEqual(60_000);
  });
});
