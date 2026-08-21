import { useMemo, useState } from 'react';
import { Campo, claseInput } from '@/components/admin/campos/Campo';
import { useLabelsTaxonomia } from '@/components/admin/useOpciones';
import { deDatetimeLocal } from '@/lib/sesiones';
import { vistaPreviaEvento, type LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadForm, SesionForm } from '@/types/actividad';

interface Props {
  form: ActividadForm;
  /**
   * Etiquetas creadas con "Otro" que todavía no están en `/opciones/*` porque
   * se persisten en el submit (D-02). Sin esto la vista previa las mostraría
   * des-slugueadas y no coincidiría con el evento publicado.
   */
  labelsPendientes?: LabelsTaxonomia;
}

/** "Encuentro 2 · 10 sept, 19:00" para el desplegable. */
const etiquetaSesion = (s: SesionForm, i: number): string => {
  const d = deDatetimeLocal(s.inicio);
  // Sin `timeZone`: el `datetime-local` del formulario ya está en la hora del
  // navegador, y mostrarlo en otra zona sería mentir sobre lo que se cargó.
  const cuando = d
    ? new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    : 'sin fecha';
  return `Encuentro ${i + 1} · ${cuando}${s.cancelada ? ' · cancelado' : ''}`;
};

const claseAviso = 'rounded-md px-3 py-2 text-xs';

/**
 * B-12 — cómo queda el evento de Google Calendar, para el encuentro que se
 * elija. El título, la ubicación y la descripción salen de `@calendario`, la
 * misma lógica que publica la Function: lo que se ve acá es exactamente lo que
 * va a ver la gente, incluidas las reglas de privacidad del §5.1.
 */
export function VistaPreviaEvento({ form, labelsPendientes }: Props) {
  const [sesionId, setSesionId] = useState<string>('');
  const labels = useLabelsTaxonomia(labelsPendientes);

  // Si la sesión elegida se borró del formulario, se cae a la primera en lugar
  // de quedar con un desplegable en blanco.
  const idEfectivo = form.sesiones.some((s) => s.id === sesionId)
    ? sesionId
    : (form.sesiones[0]?.id ?? '');

  const resultado = useMemo(
    () => vistaPreviaEvento(form, idEfectivo, labels),
    [form, idEfectivo, labels],
  );

  return (
    <div className="flex flex-col gap-3">
      {form.sesiones.length > 1 && (
        <Campo label="Encuentro" ayuda="Cada encuentro es un evento propio (§2.2).">
          <select
            className={claseInput}
            value={idEfectivo}
            onChange={(e) => setSesionId(e.target.value)}
          >
            {form.sesiones.map((s, i) => (
              <option key={s.id} value={s.id}>
                {etiquetaSesion(s, i)}
              </option>
            ))}
          </select>
        </Campo>
      )}

      {!resultado.ok ? (
        <p className="rounded-md border border-borde bg-white px-3 py-2 text-sm text-tinta/60">
          {resultado.motivo}
        </p>
      ) : (
        <>
          {/*
            El link de la reunión es el único dato sensible que puede salir, y
            sale solo si se tildó la casilla (D-15). La vista previa es el lugar
            natural para que se note: el calendario es público y scrapeable.
          */}
          {resultado.evento.linkPublicado && (
            <p className={`${claseAviso} border border-acento bg-acento/10 font-medium text-acento`}>
              El link de la reunión sale publicado en este evento, y el calendario es
              público. Destildá «Publicar el link» si no querés eso.
            </p>
          )}
          {resultado.evento.linkReservado && (
            <p className={`${claseAviso} border border-borde bg-white text-tinta/60`}>
              El link de la reunión no sale: la descripción avisa que se envía a quienes se
              inscriban.
            </p>
          )}
          {!resultado.evento.saleAlCalendario && (
            <p className={`${claseAviso} border border-amber-300 bg-amber-50 text-amber-900`}>
              {form.sesiones.find((s) => s.id === idEfectivo)?.cancelada
                ? 'Este encuentro está cancelado: su evento se borra del calendario (§7.3). Abajo está cómo quedaría si lo reactivás.'
                : 'La actividad todavía no está publicada, así que este evento no existe en el calendario. Abajo está cómo va a quedar al publicarla.'}
            </p>
          )}

          <article className="overflow-hidden rounded-md border border-borde bg-white">
            <div className="border-b border-borde px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-tinta/45">Título</p>
              <p className="font-serif text-base font-semibold break-words">
                {resultado.evento.titulo || '—'}
              </p>
            </div>
            <div className="border-b border-borde px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-tinta/45">Ubicación</p>
              <p className="text-sm break-words">
                {resultado.evento.ubicacion ?? (
                  <span className="text-tinta/45">El evento sale sin ubicación.</span>
                )}
              </p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-tinta/45">Descripción</p>
              {/*
                Texto plano largo: `whitespace-pre-wrap` conserva los saltos de
                línea que la Function manda, `overflow-y-auto` le da su propio
                scroll para no empujar la barra de acciones fuera de alcance en
                un teléfono, y `overscroll-contain` evita que al llegar al final
                el gesto arrastre la página entera.
              */}
              <div className="mt-1 max-h-72 overflow-y-auto overscroll-contain rounded border border-borde bg-papel px-3 py-2 text-sm whitespace-pre-wrap break-words sm:max-h-96">
                {resultado.evento.descripcion}
              </div>
            </div>
          </article>
        </>
      )}
    </div>
  );
}
