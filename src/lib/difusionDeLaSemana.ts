import {
  metadatosDe,
  metadatosDeDestacada,
  TITULO_DE_DESTACADAS,
  type Boletin,
  type EncuentroDelBoletin,
} from '@/lib/boletinSemanal';
import { fechaLargaDeDia } from '@/lib/fechasPublicas';
import { DOMINIO } from '@/lib/rutasPublicas';
import { construirTextoRedes, type ActividadParaRedes, type ResultadoTextoRedes } from '@/lib/textoRedes';
import { instanteDeTimestamp } from '@/lib/sesiones';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';

/**
 * **«El lunes de difusión»** — roadmap 4.1.
 *
 * El panel ya armaba el correo de la semana y el texto para redes de cada
 * actividad, pero en dos lugares y de a una: el lunes eran tres pantallas y varias
 * actividades abiertas. Esto junta lo que falta al lado del correo:
 *
 *  - **el posteo de la semana** («Esta semana en la agenda»), y
 *  - **los recordatorios**: cada encuentro de la semana, por día, con su texto ya
 *    armado para el día antes.
 *
 * ── De dónde sale cada cosa (D-801) ────────────────────────────────────────
 * **Todo sale del mismo `Boletin`** que arma el correo, o sea del `events.json`
 * publicado: lo que se anuncia es lo que el sitio muestra, y un posteo es la
 * salida más irreversible de todas (07-seguridad.md). El posteo semanal **no**
 * lee la base.
 *
 * El recordatorio de cada encuentro sí la lee, **de a una actividad y solo cuando
 * se pide**: es `construirTextoRedes`, la misma función del formulario, que
 * necesita los handles a etiquetar (`difusion.arrobar`) y el canal de inscripción,
 * y no están en el índice. La **lista** de qué recordar sale del índice; el
 * **texto**, de la función que ya decide qué entra a un posteo. Ninguna regla de
 * privacidad del posteo se reescribe acá.
 */

/** El límite de la caption de Instagram: pasado eso, el texto se corta al pegar. */
export const LIMITE_DEL_POSTEO = 2200;

const lineaDelDia = (e: EncuentroDelBoletin) => `· ${e.titulo} — ${metadatosDe(e)}`;
const lineaDestacada = (e: EncuentroDelBoletin) => `· ${e.titulo} — ${metadatosDeDestacada(e)}`;

/**
 * El posteo «Esta semana en la agenda»: las recomendadas arriba y el resto por
 * día, con las mismas filas que el correo (`metadatosDe`), sin links por fila —en
 * una caption no se pueden tocar— y con la agenda al final.
 *
 * **Si no entra en la caption, se corta al final y lo dice**: «…y N más en la
 * agenda». Cortar sin decirlo publicaría una semana que parece completa y no lo es.
 */
export const posteoDeLaSemana = (b: Boletin): string => {
  const cabeza = [`Esta semana en la agenda: ${b.total} ${b.total === 1 ? 'encuentro' : 'encuentros'}.`, `Del ${b.desde} al ${b.hasta}.`];
  const pie = [`Toda la agenda, con cómo anotarse: ${DOMINIO}`];

  /** Las líneas en orden, cada una con cuántos encuentros suma (los rótulos, cero). */
  const cuerpo: { texto: string; cuenta: number }[] = [
    ...(b.destacadas.length > 0
      ? [
          { texto: '', cuenta: 0 },
          { texto: TITULO_DE_DESTACADAS.toUpperCase(), cuenta: 0 },
          ...b.destacadas.map((e) => ({ texto: lineaDestacada(e), cuenta: 1 })),
        ]
      : []),
    ...b.dias.flatMap((d) => [
      { texto: '', cuenta: 0 },
      { texto: d.rotulo.toUpperCase(), cuenta: 0 },
      ...d.encuentros.map((e) => ({ texto: lineaDelDia(e), cuenta: 1 })),
    ]),
  ];

  const armar = (lineas: string[], faltan: number) =>
    [
      ...cabeza,
      ...lineas,
      '',
      ...(faltan > 0 ? [`…y ${faltan} más en la agenda.`] : []),
      ...pie,
    ].join('\n');

  const lineas = cuerpo.map((l) => l.texto);
  let usadas = cuerpo.length;
  let faltan = 0;
  while (usadas > 0 && armar(lineas.slice(0, usadas), faltan).length > LIMITE_DEL_POSTEO) {
    usadas -= 1;
    faltan += cuerpo[usadas]!.cuenta;
  }
  // Un rótulo de día que quedó sin ninguna fila debajo no dice nada.
  const recortadas = lineas.slice(0, usadas);
  while (recortadas.length > 0 && cuerpo[recortadas.length - 1]!.cuenta === 0) recortadas.pop();
  return armar(recortadas, faltan);
};

/** Un encuentro de la semana para recordar: lo mínimo para pedir su texto. */
export interface EncuentroARecordar {
  /** `slug#sesionId`, como en el correo. */
  clave: string;
  slug: string;
  sesionId: string;
  titulo: string;
  /** `19:00 · Taller · Casa Brandon · Gratis` — la fila del correo. */
  detalle: string;
}

/** Los encuentros de la semana por día, **todos**: las recomendadas vuelven a su día. */
export const recordatoriosDeLaSemana = (
  b: Boletin,
): { dia: string; rotulo: string; encuentros: EncuentroARecordar[] }[] => {
  const todos = [...b.destacadas, ...b.dias.flatMap((d) => d.encuentros)];
  const dias = [...new Set(todos.map((e) => e.dia))].sort();
  return dias.map((dia) => ({
    dia,
    rotulo: fechaLargaDeDia(dia),
    encuentros: todos
      .filter((e) => e.dia === dia)
      .sort((x, y) => x.hora.localeCompare(y.hora))
      .map((e) => {
        const [slug = '', sesionId = ''] = e.clave.split('#');
        return { clave: e.clave, slug, sesionId, titulo: e.titulo, detalle: metadatosDe(e) };
      }),
  }));
};

/**
 * El recordatorio de **ese** encuentro, con la función del formulario.
 *
 * La lista sale del índice del último build, pero el texto sale del documento
 * **en vivo**, y entre los dos pueden pasar cosas. Tres guardas, las tres del
 * `auditor-privacidad`:
 *
 *  - **La actividad tiene que seguir publicada.** Despublicada, su página deja de
 *    existir en el próximo build y en borrador el slug ya no está congelado; una
 *    cancelada no se recuerda. Y el link sale solo si el slug sigue siendo el del
 *    índice (`slugPublicado`), que es el que tiene página (B-312).
 *  - **El encuentro tiene que seguir en pie.** Cancelado después del build, no se
 *    arma: `construirTextoRedes` saltearía al siguiente y el botón de un encuentro
 *    daría el texto de otro.
 *  - **Tiene que ser ESE encuentro.** `construirTextoRedes` elige «el próximo»
 *    según un instante, y con dos encuentros pegados (uno termina cuando empieza el
 *    otro) o dos comisiones a la misma hora, el instante no alcanza para
 *    distinguirlos. Así que se arma sobre una copia en la que **los demás van
 *    cancelados**: el único que queda en pie es éste. La numeración «Encuentro N de
 *    M» no cambia, porque cuenta los cancelados (D-95).
 */
export const recordatorioDeEncuentro = (
  actividad: ActividadParaRedes,
  sesionId: string,
  labels: LabelsTaxonomia,
  slugPublicado: string,
): ResultadoTextoRedes => {
  if (actividad.estado !== 'publicado') {
    return { ok: false, motivo: 'Esa actividad ya no está publicada: no hay qué recordar.' };
  }
  const sesion = actividad.sesiones?.find((s) => s.id === sesionId);
  const inicio = instanteDeTimestamp(sesion?.inicio);
  if (!sesion || !inicio) {
    return { ok: false, motivo: 'Ese encuentro ya no está en la actividad: el correo es de un build anterior.' };
  }
  if (sesion.cancelada) {
    return { ok: false, motivo: 'Ese encuentro se canceló después de armar esta lista.' };
  }
  const soloEste: ActividadParaRedes = {
    ...actividad,
    sesiones: actividad.sesiones.map((s) => (s.id === sesionId ? s : { ...s, cancelada: true })),
  };
  return construirTextoRedes(
    soloEste,
    'recordatorio',
    new Date(inicio.getTime() - 1),
    labels,
    actividad.slug === slugPublicado,
  );
};
