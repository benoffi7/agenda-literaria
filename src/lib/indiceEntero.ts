import { RUTA_INDICE_PASADO, unirIndices, type Indice } from '@/lib/eventsJson';

/**
 * **El índice entero, para quien lo necesita** — B-2191, D-1276.
 *
 * Desde que `/events.json` lleva solo lo vigente, `/pasadas` y los favoritos (que
 * pueden tener guardada una actividad de hace meses) piden también
 * `/pasadas.json`. Los dos pedidos van en paralelo y con la misma `version` del
 * build, que es la que los mantiene del mismo build en el CDN.
 *
 * **Falla solo si falla el vigente.** Un `/pasadas.json` caído deja lo de ahora,
 * que sigue siendo algo para mostrar; tirar todo por la mitad que falta sería peor.
 * Corre en el navegador: no importa nada del build.
 */
const pedir = async (ruta: string, version: string): Promise<Indice | null> => {
  const r = await fetch(`${ruta}?v=${encodeURIComponent(version)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as Indice;
};

export const pedirIndiceEntero = async (version: string): Promise<Indice> => {
  const [vigente, pasado] = await Promise.all([
    pedir('/events.json', version),
    pedir(RUTA_INDICE_PASADO, version).catch(() => null),
  ]);
  return unirIndices(vigente, pasado)!;
};
