import { useEffect, useMemo, useState } from 'react';
import { claseBotonSecundario } from '@/components/admin/campos/Campo';
import { ReporteFormulario } from '@/components/admin/ReporteFormulario';
import { marcarResuelto, observarReportes, reintentarReporte } from '@/lib/reportes';
import type { EstadoReporte, ReporteConId } from '@/types/reporte';

interface Props {
  usuario: { uid: string; email: string | null };
}

/**
 * B-580 — cuántos reportes trae el `onSnapshot`, ahora que la pantalla oculta
 * los resueltos por defecto.
 *
 * El viejo `limit(10)` se quedaba corto apenas hubiera resueltos de por
 * medio: la query trae los 10 más nuevos *sin importar `resuelto`*, y si
 * filtrás recién en el cliente, cada resuelto le come un lugar a un abierto
 * — con unos pocos resueltos entre los últimos diez, la lista de "abiertos"
 * podía mostrar menos de lo que hay.
 *
 * **Por qué no se filtra en la query en vez de traer más.** `resuelto` es
 * opcional (los reportes de antes de B-580 no lo tienen — ver el comentario
 * del tipo) y Firestore no matchea documentos que no tienen el campo ni con
 * `== false` ni con `!=`: una condición `where('resuelto','!=',true)` habría
 * hecho desaparecer de la vista "abiertos" a todo lo cargado antes de este
 * cambio, que es exactamente lo contrario de lo que pide el dueño. Traer más
 * y filtrar en memoria es más código en el cliente, pero no depende de
 * backfillear ningún documento viejo.
 */
const LIMITE_REPORTES = 50;

const ESTILO_ESTADO: Record<EstadoReporte, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  enviando: 'bg-amber-100 text-amber-800',
  creado: 'bg-emerald-100 text-emerald-800',
  error: 'bg-acento/10 text-acento',
};

const TEXTO_ESTADO: Record<EstadoReporte, string> = {
  pendiente: 'guardado, creando el issue…',
  enviando: 'creando el issue…',
  creado: 'en GitHub',
  error: 'no se pudo publicar',
};

const cuando = (r: ReporteConId): string => {
  // `creadoEn` es `serverTimestamp()`: en el primer snapshot local todavía
  // llega en null y hay que tolerarlo.
  if (!r.creadoEn?.toDate) return 'ahora';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(r.creadoEn.toDate());
};

/**
 * Pantalla de reportes: el formulario y los últimos reportes con su estado.
 *
 * La lista no es decorativa: el issue lo crea una Function *después* de
 * guardar, así que es el único lugar donde se ve si el reporte llegó a GitHub
 * o quedó colgado. Se actualiza sola (`onSnapshot`).
 */
export function ReportesPanel({ usuario }: Props) {
  const [reportes, setReportes] = useState<ReporteConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);
  /** Id del reporte que se está reintentando, para no tocar el botón dos veces. */
  const [reintentando, setReintentando] = useState<string | null>(null);
  /** Id del reporte que se está marcando resuelto/reabriendo — mismo motivo. */
  const [actualizando, setActualizando] = useState<string | null>(null);
  /** B-580 — apagado por defecto: la pantalla arranca mostrando solo los abiertos. */
  const [verResueltos, setVerResueltos] = useState(false);

  useEffect(
    () =>
      observarReportes(
        (rs) => setReportes(rs),
        (e) => setFallo(e.message),
        LIMITE_REPORTES,
      ),
    [],
  );

  // B-580 — el filtro va acá, en memoria, y no en la query: ver el comentario
  // de `LIMITE_REPORTES`. Ausente o `false` = abierto (el tipo lo documenta).
  const visibles = useMemo(
    () => (verResueltos ? reportes : reportes.filter((r) => !r.resuelto)),
    [reportes, verResueltos],
  );

  /**
   * B-31 — reintentar la publicación de un reporte que quedó en `error`.
   *
   * No hay que actualizar la lista a mano: el `onSnapshot` ve el cambio de
   * estado y después el número de issue, así que la fila se mueve sola de
   * "no se pudo publicar" a "creando el issue…" y a "en GitHub".
   */
  const reintentar = async (id: string) => {
    setReintentando(id);
    try {
      await reintentarReporte(id);
      setFallo(null);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo reintentar');
    } finally {
      setReintentando(null);
    }
  };

  /**
   * B-580 — marcar resuelto o reabrir. Igual que con el reintento, el
   * `onSnapshot` refleja el cambio solo: si `verResueltos` está apagado, la
   * fila desaparece de la lista en cuanto `resuelto` pasa a `true`.
   */
  const toggleResuelto = async (r: ReporteConId) => {
    setActualizando(r.id);
    try {
      await marcarResuelto(r.id, !r.resuelto);
      setFallo(null);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setActualizando(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ReporteFormulario usuario={usuario} onEnviado={() => setFallo(null)} />

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-base font-semibold">Últimos reportes</h2>
          <label className="flex items-center gap-1.5 text-xs text-tinta/70">
            <input
              type="checkbox"
              checked={verResueltos}
              onChange={(e) => setVerResueltos(e.target.checked)}
            />
            Ver resueltos
          </label>
        </div>
        <p className="text-xs text-tinta/55">
          El dueño contesta en el issue de GitHub. El panel todavía no trae las respuestas
          de vuelta.
        </p>

        {fallo && (
          <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
            {fallo}
          </p>
        )}

        {visibles.length === 0 && !fallo && (
          <p className="rounded-md border border-dashed border-borde px-3 py-8 text-center text-sm text-tinta/50">
            {reportes.length === 0
              ? 'Todavía no hay reportes.'
              : 'No hay reportes abiertos. Activá «Ver resueltos» para ver los que ya se cerraron.'}
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {visibles.map((r) => (
            <li
              key={r.id}
              className={`rounded-md border border-borde bg-white px-3 py-2.5 sm:flex sm:items-center sm:gap-3 ${
                r.resuelto ? 'opacity-60' : ''
              }`}
            >
              <div className="min-w-0 sm:flex-1">
                <p className="truncate font-serif font-semibold">{r.titulo}</p>
                <p className="text-xs text-tinta/55">
                  {r.tipo} · {cuando(r)}
                  {r.error ? ` · ${r.error}` : ''}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-0 sm:shrink-0">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${ESTILO_ESTADO[r.estado] ?? ''}`}
                >
                  {TEXTO_ESTADO[r.estado] ?? r.estado}
                </span>
                {/* B-31 — solo en `error`: en cualquier otro estado el reporte
                    está en cola, en vuelo o ya publicado, y "reintentar"
                    significaría un segundo issue del mismo reporte. */}
                {r.estado === 'error' && !r.github && (
                  <button
                    type="button"
                    onClick={() => void reintentar(r.id)}
                    disabled={reintentando === r.id}
                    className={`${claseBotonSecundario} shrink-0 disabled:opacity-50`}
                  >
                    {reintentando === r.id ? 'Reintentando…' : 'Reintentar'}
                  </button>
                )}
                {r.github && (
                  <a
                    href={r.github.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-touch items-center rounded-md px-2 text-xs font-medium text-acento hover:bg-acento/10"
                  >
                    #{r.github.numero} ↗
                  </a>
                )}
                {/* B-580 — no depende del `estado` de envío a GitHub: se puede
                    marcar resuelto un reporte que todavía está `pendiente` o
                    `enviando` (el problema se solucionó antes de que la
                    Function terminara de publicar el issue). */}
                <button
                  type="button"
                  onClick={() => void toggleResuelto(r)}
                  disabled={actualizando === r.id}
                  className={`${claseBotonSecundario} shrink-0 disabled:opacity-50`}
                >
                  {actualizando === r.id
                    ? 'Guardando…'
                    : r.resuelto
                      ? 'Reabrir'
                      : 'Marcar resuelto'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
