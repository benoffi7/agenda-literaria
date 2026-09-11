import { useMemo, useState, type ReactNode } from 'react';
import { claseBotonSecundario } from '@/components/campos/Campo';
import {
  TEXTO_ESTADO,
  TRANSICIONES,
  directorioPorId,
  esPendienteDeRevision,
  slugBloqueado,
  textoDelMovimiento,
  type EstadoDirectorio,
  type IdDirectorio,
} from '@/lib/directorios';

/**
 * **La bandeja de un directorio, una sola para los tres** — B-834, tajada 2
 * paso 12.
 *
 * Librerías, suscripciones y lugares tienen campos distintos y la misma
 * pantalla: una lista de fichas, un filtro que arranca mostrando lo que espera
 * decisión, y los botones que mueven el estado. Eso es lo que hay acá. Lo que
 * cambia entre las tres —qué dice cada ficha— entra por `detalle`, que es una
 * función y no una lista de campos, justamente para que agregar «qué incluye» a
 * los lugares no toque este archivo.
 *
 * ── Por qué **recibe** los datos en vez de leerlos ────────────────────────
 * Es la regla del § «Un control compartido recibe, no importa» de
 * `05-patrones.md`, aplicada al caso que la hizo nacer: un componente que van a
 * usar tres pantallas distintas **no puede importar lo que solo una de las tres
 * tiene**. Si este archivo llamara a `observarLibrerias()`, dejaría de ser la
 * bandeja de los tres directorios y pasaría a ser la de librerías con un `if`.
 *
 * Y hay una segunda mitad, que es la que se cobra en los tests: recibiendo, esta
 * pantalla se puede montar con tres fichas literales y sin Firestore, sin
 * emulador y sin sesión. La lectura en vivo (`onSnapshot`) y las escrituras son
 * de `useDirectorio.ts` y de la capa por entidad — el mismo reparto que
 * `bandejaDePropuestas.ts` tiene con `PropuestasPanel`.
 *
 * ── Los botones salen del grafo, no de un `if` ────────────────────────────
 * Qué se le puede hacer a una ficha lo dice `TRANSICIONES` (`lib/directorios.ts`)
 * y esta pantalla lo **recorre**. La consecuencia visible es que una ficha
 * descartada no ofrece «Publicar»: para volver al sitio hay que reabrirla, o sea
 * volver a mirarla. Escribir esos botones a mano en el JSX sería tener la regla
 * en dos lados —el que decide y el que dibuja— y la copia que se queda vieja es
 * siempre la del dibujo (la clase de B-88).
 *
 * ── Lo que esta pantalla **no** hace ──────────────────────────────────────
 * No edita el contenido de la ficha. Corregirle la dirección a una librería es
 * el formulario de esa entidad, que llega con su tajada; acá se decide si entra
 * al sitio y nada más. `onEditar` es la puerta a ese formulario, y si no se pasa,
 * el botón no existe.
 */

/**
 * Lo que la bandeja necesita de **cualquier** ficha de directorio.
 *
 * Son los cinco campos que el ciclo de vida usa, y ninguno de los que distinguen
 * a una librería de un lugar: el tipo de la entidad extiende esto, no al revés.
 * `nombre` es el único que puede sorprender —cada entidad lo llama distinto en su
 * documento— y por eso se pide con este nombre genérico: quien arme la lista lo
 * mapea una vez.
 */
export interface FichaDeDirectorio {
  id: string;
  nombre: string;
  /** La dirección web que tiene o va a tener en el sitio. Sin `/guia/…` adelante. */
  slug: string;
  estado: EstadoDirectorio;
  /** De dónde vino. Cambia cuánto hay que revisar antes de publicar. */
  origen: 'formulario-publico' | 'panel';
  /**
   * ¿Estuvo publicada alguna vez? **Opcional a propósito** (B-285): ausente
   * significa «no lo sabemos» y `slugBloqueado` cae al estado actual, que es el
   * comportamiento de siempre. Ver su docblock en `lib/directorios.ts`.
   */
  publicadaAlgunaVez?: boolean;
}

interface Props {
  /** Cuál de los tres. De acá salen el título y el nombre en singular de una ficha. */
  directorio: IdDirectorio;
  fichas: readonly FichaDeDirectorio[];
  /** El error de la lectura o de la última escritura, ya en castellano. */
  fallo?: string | null;
  /**
   * Mueve una ficha de estado. **La escritura la hace quien llama**, con la
   * regla y la firma de revisión que le correspondan a su colección; acá solo se
   * sabe qué movimiento pidió quien mira.
   */
  onMover: (ficha: FichaDeDirectorio, estado: EstadoDirectorio) => Promise<void>;
  /** Abre el formulario de esa entidad. Sin esto, la bandeja no ofrece editar. */
  onEditar?: (ficha: FichaDeDirectorio) => void;
  /** Lo propio de la entidad: la dirección de una librería, el precio de una suscripción. */
  detalle?: (ficha: FichaDeDirectorio) => ReactNode;
}

/**
 * El color del estado. Vive en el componente y no en `directorios.ts` porque es
 * presentación: el módulo puro dice **cómo se llama** cada estado, no de qué
 * color se pinta. Las clases son las del panel, que no sigue el sistema visual
 * del sitio (§ «Estilo de UI» de `05-patrones.md`).
 */
const ESTILO_ESTADO: Record<EstadoDirectorio, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  publicado: 'bg-emerald-100 text-emerald-800',
  rechazado: 'bg-tinta/10 text-tinta/60',
};

const TEXTO_ORIGEN: Record<FichaDeDirectorio['origen'], string> = {
  'formulario-publico': 'la cargaron desde el sitio',
  panel: 'la cargamos nosotros',
};

export function DirectorioPanel({ directorio, fichas, fallo, onMover, onEditar, detalle }: Props) {
  /** Apagado por defecto: la bandeja arranca mostrando lo que espera decisión. */
  const [verCerradas, setVerCerradas] = useState(false);
  /** Id de la que se está moviendo, para no tocar el botón dos veces. */
  const [moviendo, setMoviendo] = useState<string | null>(null);

  /*
   * El directorio puede no existir si alguien pasa un id a mano. Se resuelve con
   * un respaldo y **no con un `!`**: el precio de equivocarse es un encabezado
   * feo, y el de un `!` es la pantalla entera en blanco.
   */
  const ficha = directorioPorId(directorio);
  const titulo = ficha?.titulo ?? directorio;
  const singular = ficha?.singular ?? 'ficha';

  const visibles = useMemo(
    () => (verCerradas ? fichas : fichas.filter(esPendienteDeRevision)),
    [fichas, verCerradas],
  );

  const mover = async (f: FichaDeDirectorio, estado: EstadoDirectorio) => {
    setMoviendo(f.id);
    try {
      await onMover(f, estado);
    } finally {
      setMoviendo(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-base font-semibold">{titulo}</h2>
        <label className="flex items-center gap-1.5 text-xs text-tinta/70">
          <input
            type="checkbox"
            checked={verCerradas}
            onChange={(e) => setVerCerradas(e.target.checked)}
          />
          Ver publicadas y descartadas
        </label>
      </div>

      {/*
        Lo que hay que saber antes de tocar un botón, y no es evidente: publicar
        no es guardar. Es la misma advertencia que la bandeja de propuestas pone
        arriba, y por el mismo motivo — acá se decide qué sale al sitio.
      */}
      <p className="text-xs text-tinta/55">
        Hasta que no la publiques, esta {singular} no está en el sitio: no aparece en la Guía,
        ni en el buscador, ni en el mapa del sitio. Publicar la deja visible para cualquiera en
        el próximo rebuild.
      </p>

      {fallo && (
        <p className="rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento">
          {fallo}
        </p>
      )}

      {visibles.length === 0 && !fallo && (
        <p className="rounded-md border border-dashed border-borde px-3 py-8 text-center text-sm text-tinta/50">
          {fichas.length === 0
            ? 'Todavía no hay nada cargado acá.'
            : 'No hay nada esperando decisión. Activá «Ver publicadas y descartadas» para ver el resto.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visibles.map((f) => (
          <li
            key={f.id}
            className={`rounded-md border border-borde bg-white px-3 py-2.5 ${
              f.estado === 'rechazado' ? 'opacity-60' : ''
            }`}
          >
            <div className="sm:flex sm:items-start sm:gap-3">
              <div className="min-w-0 sm:flex-1">
                <p className="truncate font-serif font-semibold">{f.nombre}</p>
                <p className="text-xs text-tinta/55">
                  {TEXTO_ORIGEN[f.origen]}
                  {/*
                    **La dirección web se muestra siempre, y se dice cuándo se
                    congeló** — trampa 10 del §13. Que el campo esté bloqueado sin
                    explicación es lo que hace que alguien lo intente cambiar por
                    la consola; dicho acá, se entiende que la URL ya está dada.
                  */}
                  {' · '}
                  {f.slug ? `/${f.slug}` : 'sin dirección web todavía'}
                  {slugBloqueado(f) && ' (fija desde que se publicó)'}
                </p>
                {detalle && <div className="mt-1 text-xs text-tinta/70">{detalle(f)}</div>}
              </div>

              <span
                className={`mt-2 inline-block shrink-0 rounded-full px-2 py-0.5 text-xs sm:mt-0 ${
                  ESTILO_ESTADO[f.estado] ?? ''
                }`}
              >
                {TEXTO_ESTADO[f.estado]}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {onEditar && (
                <button
                  type="button"
                  onClick={() => onEditar(f)}
                  className={`${claseBotonSecundario} shrink-0`}
                >
                  Abrir
                </button>
              )}
              {/*
                **Los botones son el grafo.** `TRANSICIONES[estado]` y no una
                lista escrita acá: la arista que falta —de descartada a
                publicada— es la que obliga a reabrir antes de publicar, y si
                este `map` se reemplazara por tres `if`, esa decisión viviría en
                dos lados.
              */}
              {(TRANSICIONES[f.estado] ?? []).map((destino) => (
                <button
                  key={destino}
                  type="button"
                  onClick={() => void mover(f, destino)}
                  disabled={moviendo === f.id}
                  className={`${claseBotonSecundario} shrink-0 disabled:opacity-50`}
                >
                  {moviendo === f.id ? 'Guardando…' : textoDelMovimiento(f.estado, destino)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
