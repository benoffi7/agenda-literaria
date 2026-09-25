/**
 * El monto del arancel llega a las salidas que lo publican, y a ninguna más (B-114).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import { detalleDeActividad } from '@/lib/detallePublico';
import { carteleraDeDetalles } from '@/lib/cartelera';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { construirEvento, montoLegible } from '../../functions/calendario.js';
import { actividadParaIssue } from '../../functions/reportes.js';
import { arancelDeTarjeta } from '@/lib/tarjetaPublica';
import { construirTextoRedes } from '@/lib/textoRedes';
import { construirEvento as construirEventoDeAnalitica } from '@/lib/analytics-eventos';
import { CENTINELA, LABELS_CENTINELA, MONTO_CENTINELA, actividadCentinela } from '../fixtures/centinelas';

/**
 * §4.4 — barrido de `/opciones/*` proyectado, la salida que faltaba — B-212.
 *
 * El `events.json` lleva las opciones de taxonomía además de las actividades:
 * la web arma los chips de filtro recorriéndolas, así que sin ellas no hay
 * filtros. El documento tiene siete campos y **dos** salen.
 *
 * Esto se escribió **antes que su consumidor** (B-106 todavía no existe), y ese
 * es el punto: el camino corto cuando se escriba el `events.json` es volcar
 * `valores` tal cual —una línea, se lee razonable— y con eso entran
 * `huellaCreador` y `usos` sin que nadie lo haya decidido. Y nada lo detendría,
 * porque hasta ahora `ValorOpcion` estaba en la lista de interfaces AJENAS de
 * este archivo.
 */
// ───────────────────────────────────────────────────────────────────────────
// B-114 · el monto del arancel, campo por salida
// ───────────────────────────────────────────────────────────────────────────

/**
 * **El monto del arancel no puede ir en `RUTAS_CENTINELA` y por eso tiene su
 * propio barrido** — B-114.
 *
 * Los centinelas del fixture son strings (`CENTINELA.<ruta>`) y el monto es un
 * **entero**: registrarlo allá hacía que el barrido buscara el texto
 * `'CENTINELA.arancel.monto'`, que ninguna salida puede contener nunca. O sea un
 * chequeo verde para siempre, esté la fuga o no — la peor clase de red.
 *
 * Así que se ancla **por valor**, y en las dos formas en que puede salir:
 *
 * - `987654` crudo en las salidas que serializan JSON;
 * - `$987.654` en las que arman texto, porque ahí pasa por `montoLegible`.
 *
 * Buscar solo una de las dos era la trampa: el número crudo **no aparece** en la
 * descripción del evento (dice `$987.654`) y la cadena formateada **no aparece**
 * en el `events.json` (dice `987654`). Un barrido que mirara una sola forma daría
 * verde en la mitad de las salidas por el motivo equivocado.
 *
 * Y la lista de abajo es la decisión del dueño hecha test: «en todo lo que ya
 * dice el arancel».
 */
describe('el monto del arancel llega a las salidas que lo publican, y a ninguna más (B-114)', () => {
  const CRUDO = String(MONTO_CENTINELA);
  const LEGIBLE = montoLegible(MONTO_CENTINELA);

  it('el número crudo y el formateado no se confunden entre sí', () => {
    // El control de todo este describe: si las dos formas fueran la misma cadena,
    // cada aserto de abajo estaría midiendo la otra salida sin darse cuenta.
    expect(LEGIBLE).toBe('$987.654');
    expect(LEGIBLE).not.toContain(CRUDO);
    expect(CRUDO).not.toContain(LEGIBLE);
  });

  it('sale al `events.json` y al índice del listado (salida 1)', () => {
    const publica = toPublic(actividadCentinela(), 'act_centinela');
    expect(JSON.stringify(publica)).toContain(CRUDO);
    expect(JSON.stringify(entradaDeIndice(publica))).toContain(CRUDO);
  });

  it('sale en la frase de la tarjeta, pegado a la etiqueta del arancel', () => {
    const entrada = entradaDeIndice(toPublic(actividadCentinela(), 'act_centinela'));
    const etiquetas = mapaDeEtiquetas({
      arancel: [{ slug: CENTINELA['arancel.tipo'], label: 'Arancelado' }],
    });
    expect(arancelDeTarjeta(entrada, etiquetas).texto).toBe(`Arancelado · ${LEGIBLE}`);
  });

  it('sale en la descripción del evento de Calendar (salida 2)', () => {
    const actividad = actividadCentinela();
    const evento = construirEvento(actividad, actividad.sesiones[0], LABELS_CENTINELA);
    expect(evento.description).toContain(LEGIBLE);
    // Y **no** el crudo: en un texto para leer va formateado o no va.
    expect(evento.description).not.toContain(CRUDO);
  });

  it('sale al texto para redes (salida 5), que es la más irreversible', () => {
    /*
     * Un posteo pegado en Instagram ya está copiado, así que acá el aserto vale
     * doble: el precio es de lo primero que se pregunta en los comentarios, y por
     * eso el dueño lo quiso en el texto — pero también es donde un «Gratis ·
     * $8.000» no se corrige nunca.
     */
    const r = construirTextoRedes(
      actividadCentinela() as never,
      'anuncio',
      new Date('2020-01-01T00:00:00Z'),
      LABELS_CENTINELA,
    );
    expect(r.ok, 'el fixture dejó de producir texto para redes').toBe(true);
    if (r.ok) {
      expect(r.texto).toContain(LEGIBLE);
      expect(r.texto).not.toContain(CRUDO);
    }
  });

  it('NO llega a la cartelera (salida 7): esa salida no proyecta el arancel', () => {
    /*
     * No es una decisión sobre el monto: la cartelera es la pared de afiches y
     * **no muestra el arancel de ninguna forma**, así que el monto no tiene por
     * dónde entrar. El aserto está para que el día que la cartelera empiece a
     * decir el arancel, esa celda se decida y no se herede.
     */
    const detalle = detalleDeActividad(
      toPublic(actividadCentinela(), 'act_centinela'),
      mapaDeEtiquetas({ arancel: [{ slug: CENTINELA['arancel.tipo'], label: 'Arancelado' }] }),
      new Date('2020-01-01T00:00:00Z'),
      {},
    );
    const afiches = carteleraDeDetalles([detalle]);
    /*
     * **El control positivo, que pidió el `auditor-privacidad`.**
     * `carteleraDeDetalles` filtra por portada, por cancelada y por próxima fecha:
     * si mañana cambian las fechas del fixture o su portada, la lista vuelve vacía
     * y los dos `not.toContain` de abajo pasan **sin haber mirado la cartelera**.
     */
    expect(afiches, 'la cartelera devolvió vacío: el barrido no midió nada').toHaveLength(1);
    const cartelera = JSON.stringify(afiches);
    expect(cartelera).not.toContain(CRUDO);
    expect(cartelera).not.toContain(LEGIBLE);
  });

  it('NO sale al issue de GitHub (salida 3), que es público y ajeno al arancel', () => {
    /*
     * El issue reporta un problema de una actividad: lleva el título y el slug
     * para poder encontrarla, no su ficha comercial. `actividadParaIssue` es una
     * whitelist, así que esto es el aserto que la mantiene angosta.
     */
    const proyectada = JSON.stringify(actividadParaIssue(actividadCentinela()));
    expect(proyectada).not.toContain(CRUDO);
    expect(proyectada).not.toContain(LEGIBLE);
  });

  it('NO sale a la analítica (salida 4): ahí no sale contenido nunca', () => {
    /*
     * La salida más estricta. Lo único que puede viajar de este campo es **la
     * ruta** (`arancel.monto`, cuando el schema lo rechaza), nunca el número: un
     * monto es un dato de la actividad y `campo_invalido` mide qué se rompió, no
     * con qué valor.
     */
    const evento = construirEventoDeAnalitica('campo_invalido', {
      campo: 'arancel.monto',
      valor: MONTO_CENTINELA,
    });
    const serializado = JSON.stringify(evento);
    expect(serializado).toContain('arancel.monto');
    expect(serializado, 'el monto viajó como valor a GA4').not.toContain(CRUDO);
  });
});
