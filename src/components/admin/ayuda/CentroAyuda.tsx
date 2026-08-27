import { useEffect, useId, useRef, useState } from 'react';
import { claseBotonSecundario, claseBotonTinta } from '@/components/admin/campos/Campo';
import { Seccion } from '@/components/admin/campos/Seccion';
import {
  AVISOS,
  CAPITULOS,
  CAPITULO_POR_CONTEXTO,
  type ContextoAyuda,
  type PuntoAyuda,
} from '@/lib/ayuda';
import { useCapaModal } from '@/components/admin/useCapaModal';
import { NOVEDADES, fechaLegible, guardarVisto } from '@/lib/novedades';

interface Props {
  /** Desde dónde se pidió la ayuda: decide qué capítulo abre desplegado. */
  contexto: ContextoAyuda;
  /** Ids de novedades sin leer al momento de abrir, para marcarlas «nuevo». */
  idsSinLeer: string[];
  onCerrar: () => void;
  /** Avisa al botón que puede apagar el número de sin leer. */
  onNovedadesLeidas: () => void;
}

type Pestania = 'guia' | 'novedades';

/**
 * Centro de ayuda del panel: la guía y las novedades, en una capa sobre la
 * pantalla que esté abierta (D-61).
 *
 * **Por qué una capa y no una pantalla del panel:** desde el formulario se
 * consulta la ayuda justo cuando hay dudas, y navegar a otra pantalla
 * desmontaría el formulario y se perdería lo cargado. La ayuda tiene que costar
 * cero.
 *
 * **Por qué una sola entrada con dos pestañas** (D-65): el encabezado tiene que
 * seguir entrando en 360px al lado de «Volver» y «Salir», y las dos cosas se
 * consultan en el mismo momento — «¿cómo era esto?» y «¿qué cambió?».
 *
 * En mobile ocupa la pantalla completa: la guía es texto largo y una ventanita
 * de 300px de alto no se lee. Desde `sm` es un cuadro centrado.
 */
export function CentroAyuda({ contexto, idsSinLeer, onCerrar, onNovedadesLeidas }: Props) {
  // Si hay algo sin leer, abre en Novedades: es la razón por la que la persona
  // hizo clic. Si no, en la guía.
  const [pestania, setPestania] = useState<Pestania>(idsSinLeer.length ? 'novedades' : 'guia');

  /**
   * Los «nuevo» se congelan al abrir. Si se recalcularan, al marcar leído
   * desaparecerían de la pantalla mientras la persona los está leyendo.
   */
  const [nuevos] = useState(() => new Set(idsSinLeer));

  const caja = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idPestania = useId();

  const capituloAbierto = CAPITULO_POR_CONTEXTO[contexto];

  // Ver las novedades es haberlas visto: se marca al mostrar la pestaña.
  useEffect(() => {
    if (pestania !== 'novedades') return;
    const ultima = NOVEDADES[0];
    if (!ultima) return;
    guardarVisto(ultima.id);
    onNovedadesLeidas();
  }, [pestania, onNovedadesLeidas]);

  /**
   * B-64 — la capa atrapa el foco y lo devuelve al cerrarse.
   *
   * Antes cerraba con `Escape`, con el botón y con un click en el fondo, y al
   * abrirse el foco iba al diálogo; pero con Tab se salía hacia el formulario de
   * atrás, que sigue montado y tapado. Quien navega con teclado perdía la capa
   * sin haberla cerrado, y encima empezaba a tabular por 30+ campos que no ve.
   *
   * **B-210 — el cableado sale de `useCapaModal`**, compartido con
   * `DialogoDuplicar`. Estaba copiado verbatim en las dos, y esta copia se había
   * quedado sin el `ref` del callback: con `[onCerrar]` en las dependencias y una
   * flecha inline en `BotonAyuda`, marcar las novedades como leídas re-renderiza
   * el botón, remonta el efecto y le roba el foco a lo que se estuviera usando.
   */
  useCapaModal(caja, onCerrar);

  const clasePestania = (propia: Pestania) =>
    `flex-1 sm:flex-none ${pestania === propia ? claseBotonTinta : claseBotonSecundario}`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-tinta/40 sm:items-center sm:p-6"
      // El click sobre el fondo cierra; sobre el contenido, no.
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="flex h-full w-full flex-col bg-papel shadow-xl outline-none sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-lg"
      >
        <header className="shrink-0 border-b border-borde px-segura pt-segura pb-3 sm:px-4 sm:pt-4">
          <div className="flex items-start gap-3">
            <h2 id={idTitulo} className="min-w-0 flex-1 font-serif text-lg font-semibold">
              Cómo funciona el panel
            </h2>
            <button type="button" onClick={onCerrar} className={`${claseBotonSecundario} shrink-0`}>
              Cerrar
            </button>
          </div>
          <div className="mt-3 flex gap-2" role="tablist" aria-label="Ayuda y novedades">
            <button
              type="button"
              role="tab"
              id={`${idPestania}-guia`}
              aria-selected={pestania === 'guia'}
              onClick={() => setPestania('guia')}
              className={clasePestania('guia')}
            >
              Guía
            </button>
            <button
              type="button"
              role="tab"
              id={`${idPestania}-novedades`}
              aria-selected={pestania === 'novedades'}
              onClick={() => setPestania('novedades')}
              className={clasePestania('novedades')}
            >
              Novedades
              {nuevos.size > 0 && (
                <span className="ml-1.5 rounded-full bg-acento px-1.5 text-xs text-white">
                  {nuevos.size}
                </span>
              )}
            </button>
          </div>
        </header>

        <div
          role="tabpanel"
          aria-labelledby={`${idPestania}-${pestania}`}
          className="flex-1 overflow-y-auto overscroll-contain px-segura py-4 pb-segura sm:px-4"
        >
          {pestania === 'guia' ? (
            <Guia capituloAbierto={capituloAbierto} />
          ) : (
            <Novedades nuevos={nuevos} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Los avisos primero y sin colapsar; los capítulos, en acordeón. */
function Guia({ capituloAbierto }: { capituloAbierto: string }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="font-serif text-base font-semibold">Lo que no se puede deshacer</h3>
        <p className="text-xs text-tinta/60">
          Seis cosas que conviene saber antes de publicar la primera actividad.
        </p>
        {AVISOS.map((a) => (
          <div
            key={a.id}
            className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2.5 text-xs"
          >
            <p className="font-medium text-acento">{a.titulo}</p>
            <p className="mt-1 text-tinta/80">{a.texto}</p>
          </div>
        ))}
      </section>

      {CAPITULOS.map((c) => (
        <Seccion
          key={c.id}
          titulo={c.titulo}
          descripcion={c.paraQue}
          colapsable
          abiertaPorDefecto={c.id === capituloAbierto}
        >
          <ul className="flex flex-col gap-2.5">
            {c.puntos.map((p, i) => (
              <Punto key={i} punto={p} />
            ))}
          </ul>
        </Seccion>
      ))}
    </div>
  );
}

function Punto({ punto }: { punto: PuntoAyuda }) {
  if (punto.cuidado) {
    return (
      <li className="border-l-2 border-acento/50 pl-2.5 text-sm text-tinta">{punto.texto}</li>
    );
  }
  return <li className="pl-2.5 text-sm text-tinta/80">{punto.texto}</li>;
}

function Novedades({ nuevos }: { nuevos: Set<string> }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-tinta/60">
        Lo que se fue agregando al panel, de lo más nuevo a lo más viejo.
      </p>
      {NOVEDADES.map((n) => (
        <article key={n.id} className="rounded-lg border border-borde bg-white/60 px-3 py-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="min-w-0 flex-1 font-serif text-base font-semibold">{n.titulo}</h3>
            {nuevos.has(n.id) && (
              <span className="shrink-0 rounded-full bg-acento px-2 py-0.5 text-xs text-white">
                nuevo
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-tinta/50">
            {fechaLegible(n.fecha)}
            {n.version && ` · versión ${n.version}`}
          </p>
          <p className="mt-1.5 text-sm text-tinta/80">{n.detalle}</p>
          {n.donde && (
            <p className="mt-1.5 text-xs text-tinta/60">
              <span className="font-medium text-tinta/75">Dónde:</span> {n.donde}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
