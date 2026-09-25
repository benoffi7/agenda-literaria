import { useEffect, useMemo, useRef, useState } from 'react';
import { claseBotonPrimario, claseBotonSecundario } from '@/components/campos/Campo';
import { EfemerideFormulario } from '@/components/admin/EfemerideFormulario';
import { medirFuncion } from '@/lib/analytics';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { fechaDeEfemeride } from '@/lib/efemeridePublica';
import { slugDeEfemerideBloqueado } from '@/lib/efemeride-schema';
import { moverEfemeride, observarEfemerides, slugPublicable } from '@/lib/efemerides';
import { rutaDeEfemeride } from '@/lib/rutasPublicas';
import type { EfemerideConId, EstadoEfemeride } from '@/types/efemeride';

/**
 * **La pantalla de efemérides del panel** — B-959.
 *
 * Listar, crear, editar, publicar, despublicar y borrar. **No es una bandeja**
 * como las de la Guía (`DirectorioPanel`): acá nadie de afuera propone nada, así
 * que no hay «espera decisión» ni «descartada». Es la lista del año, ordenada
 * por mes y día, con el estado de cada una a la vista.
 *
 * Mismo reparto que `BibliotecasPanel`: el alta y la edición viven acá adentro
 * para no perder la suscripción a la colección al abrir el formulario, y son
 * **dos vistas del router** (`efemerides` / `efemeride`) para que salir con
 * cambios sin guardar pregunte (B-35, `salida-del-panel.ts`).
 */
interface Props {
  usuario: { uid: string };
  onAbrirFormulario: (efemeride?: EfemerideConId) => void;
  /** La que se está editando, o `'nueva'`. `null` = la lista. */
  editando: EfemerideConId | 'nueva' | null;
  /** Guardó. Separado de `onCancelar` por el mismo motivo que en la Guía (B-35). */
  onGuardado: () => void;
  onCancelar: () => void;
}

const TEXTO_ESTADO: Record<EstadoEfemeride, string> = {
  borrador: 'borrador',
  publicado: 'en el sitio',
};

const ESTILO_ESTADO: Record<EstadoEfemeride, string> = {
  borrador: 'bg-amber-100 text-amber-800',
  publicado: 'bg-emerald-100 text-emerald-800',
};

export function EfemeridesPanel({
  usuario,
  onAbrirFormulario,
  editando,
  onGuardado,
  onCancelar,
}: Props) {
  const [efemerides, setEfemerides] = useState<EfemerideConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);

  /*
   * `efemerides-abrir` con cuántas hay publicadas, adentro del primer snapshot y
   * no en un efecto de montaje —ése mediría antes de que Firestore conteste—.
   * Un entero y nada más: ni un título.
   */
  const medido = useRef(false);

  useEffect(
    () =>
      observarEfemerides(
        (es) => {
          setEfemerides(es);
          if (!medido.current) {
            medido.current = true;
            medirFuncion(
              'efemerides-abrir',
              undefined,
              es.filter((e) => e.estado === 'publicado').length,
            );
          }
        },
        (e) => setFallo(e.message),
      ),
    [],
  );

  const ordenadas = useMemo(
    () =>
      [...efemerides].sort(
        (a, b) =>
          a.mes - b.mes ||
          a.dia - b.dia ||
          (a.anio ?? Number.MAX_SAFE_INTEGER) - (b.anio ?? Number.MAX_SAFE_INTEGER) ||
          a.titulo.localeCompare(b.titulo, 'es'),
      ),
    [efemerides],
  );

  if (editando) {
    return (
      <EfemerideFormulario
        uid={usuario.uid}
        inicial={editando === 'nueva' ? undefined : editando}
        onGuardado={onGuardado}
        onCancelar={onCancelar}
      />
    );
  }

  const mover = async (e: EfemerideConId, estado: EstadoEfemeride) => {
    setMoviendo(e.id);
    try {
      if (estado === 'publicado' && !(await slugPublicable(e.slug, e.id))) {
        setFallo(
          `El link «${e.slug}» ya es de otra efeméride publicada. Abrí ésta, cambiale el link y volvé a publicarla.`,
        );
        return;
      }
      await moverEfemeride(e.id, usuario.uid, estado);
      setFallo(null);
    } catch (err: unknown) {
      setFallo(textoDeFallo(err, { respaldo: 'No se pudo cambiar el estado de la efeméride' }));
    } finally {
      setMoviendo(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" onClick={() => onAbrirFormulario()} className={claseBotonPrimario}>
          Cargar una efeméride
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-base font-semibold">Efemérides</h2>
        <p className="text-xs text-tinta/65">
          Una efeméride en borrador no está en el sitio. Publicarla la suma a la sección
          Efemérides y, el día que corresponde, al renglón de la home —en el próximo rebuild—. No
          va al calendario público.
        </p>

        {fallo && (
          <p
            role="alert"
            className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento"
          >
            {fallo}
          </p>
        )}

        {ordenadas.length === 0 && !fallo && (
          <p className="rounded-md border border-dashed border-borde px-3 py-8 text-center text-sm text-tinta/65">
            Todavía no hay ninguna efeméride cargada.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {ordenadas.map((e) => (
            <li key={e.id} className="rounded-md border border-borde bg-white px-3 py-2.5">
              <div className="sm:flex sm:items-start sm:gap-3">
                <div className="min-w-0 sm:flex-1">
                  <p className="truncate font-serif font-semibold">{e.titulo}</p>
                  <p className="text-xs text-tinta/65">
                    {fechaDeEfemeride(e)}
                    {' · '}
                    {rutaDeEfemeride(e.slug)}
                    {slugDeEfemerideBloqueado(e) && ' (fijo desde que se publicó)'}
                  </p>
                </div>
                <span
                  className={`mt-2 inline-block shrink-0 rounded-full px-2 py-0.5 text-xs sm:mt-0 ${ESTILO_ESTADO[e.estado] ?? ''}`}
                >
                  {TEXTO_ESTADO[e.estado] ?? e.estado}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAbrirFormulario(e)}
                  className={`${claseBotonSecundario} shrink-0`}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  disabled={moviendo === e.id}
                  onClick={() => void mover(e, e.estado === 'publicado' ? 'borrador' : 'publicado')}
                  className={`${claseBotonSecundario} shrink-0 disabled:opacity-50`}
                >
                  {moviendo === e.id
                    ? 'Guardando…'
                    : e.estado === 'publicado'
                      ? 'Despublicar'
                      : 'Publicar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
