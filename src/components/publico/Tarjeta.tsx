/**
 * La tarjeta del listado — B-227, reescrita en B-247 (D-141, D-142).
 *
 * **Hay una sola definición del markup de la tarjeta, y es ésta.** La usa el
 * HTML que arma el build (Astro renderiza este componente sin hidratar, así que
 * sale como HTML plano y sin JavaScript) y la usa la island después de filtrar.
 * El §6.3 del diseño lo pide con todas las letras: dos markups —uno en `.astro`
 * y otro en React— se separan en el primer cambio y nadie se entera, porque los
 * dos se ven bien por separado.
 *
 * ── La jerarquía, y por qué es ésa ────────────────────────────────────────
 * Lo que alguien decide mirando una tarjeta es **qué es, cuándo, dónde y cuánto
 * sale**. En ese orden manda el diseño de la tarjeta:
 *
 * 1. **qué es** — la píldora del tipo, en su color, arriba en la portada;
 * 2. **cuándo** — la fecha, primera línea del cuerpo y en Inter, no el título
 *    (§4.2: es el dato que decide);
 * 3. **el título**, en serif, que es la identidad;
 * 4. **dónde** — sede y barrio, o online, leídos de `modalidades[]`;
 * 5. **cuánto** — el arancel, en el pie y con su propio peso.
 *
 * El resto (el ciclo, el aviso de inscripción) es secundario y va atenuado.
 *
 * ── Apilado con superficie y borde, sin sombras (D-141) ───────────────────
 * La tarjeta es `bg-crema` sobre el `papel` de la página, con un borde. Las
 * sombras son exactamente lo que da el aire de plataforma genérica; el papel
 * apilado es la idea del sitio.
 *
 * ── Es presentacional, y a propósito ──────────────────────────────────────
 * Sin hooks, sin estado, sin fetch, y **sin decidir qué dice**: cada frase sale
 * de `lib/tarjetaPublica.ts`, que es puro y está testeado. Los componentes de
 * este repo no tienen tests de render (`docs/05-patrones.md`), así que lo que
 * quede acá adentro no se verifica en ninguna parte.
 */
import { foco } from '@/components/sitio/estilos';
import { PortadaDeTarjeta } from '@/components/publico/PortadaDeTarjeta';
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { estadoDe, etiquetaDe, type MapaDeEtiquetas } from '@/lib/listadoPublico';
// La ruta no se arma acá: la produce `caminosDeDetalle` y la linkea esto, y son
// dos derivaciones del mismo formato (clase de B-88). Ver `rutasPublicas.ts`.
import { rutaDeDetalle } from '@/lib/rutasPublicas';
import {
  arancelDeTarjeta,
  avisoDeTarjeta,
  cicloDeTarjeta,
  cuandoDeTarjeta,
  enCursoDeTarjeta,
  formasDeCursar,
  lugarDeTarjeta,
} from '@/lib/tarjetaPublica';

interface Props {
  entrada: EntradaDeIndice;
  /** El reloj con el que se decide «próxima» y «cerró» (§6.4). */
  ahora: Date;
  etiquetas: MapaDeEtiquetas;
  /** Las primeras de la grilla cargan su portada sin `lazy`. Ver `PortadaDeTarjeta`. */
  prioridad?: boolean;
}

export function Tarjeta({ entrada, ahora, etiquetas, prioridad = false }: Props) {
  const estado = estadoDe(entrada, ahora);
  const cuando = cuandoDeTarjeta(estado);
  const ciclo = cicloDeTarjeta(entrada, estado);
  const enCurso = enCursoDeTarjeta(estado);
  const aviso = avisoDeTarjeta(entrada, estado);
  const arancel = arancelDeTarjeta(entrada, etiquetas);
  const formas = formasDeCursar(entrada);

  return (
    // `min-w-0` para que un título largo no estire la celda de la grilla.
    <li className="min-w-0">
      {/*
        Toda la tarjeta es un link y no hay botones adentro: en móvil un botón
        dentro de un link es un blanco ambiguo (§4.2). El nombre accesible sale
        del contenido completo —tipo, fecha, título, lugar y arancel—, no de un
        «leer más» (§10), y por eso la portada no aporta texto.

        `h-full` + `flex-col` es lo que iguala el alto de las tarjetas de una
        fila de la grilla; el `mt-auto` del pie apoya el arancel abajo, así que
        el precio queda alineado entre tarjetas vecinas y se puede comparar de un
        barrido vertical.
      */}
      <a
        href={rutaDeDetalle(entrada.slug)}
        className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-borde bg-crema transition-colors hover:border-acento ${foco}`}
      >
        <PortadaDeTarjeta
          tipo={entrada.tipo}
          tipoLabel={etiquetaDe(etiquetas, 'tipo', entrada.tipo)}
          titulo={entrada.titulo}
          imagenUrl={entrada.imagenUrl}
          destacado={entrada.destacado}
          prioridad={prioridad}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3.5">
          {/* 2 · cuándo. Primero, y en Inter. */}
          {cuando.iso ? (
            <time
              dateTime={cuando.iso}
              className="text-sm font-semibold tracking-wide text-acento-hondo"
            >
              {cuando.texto}
            </time>
          ) : (
            <span className="text-sm font-semibold tracking-wide text-tinta/70">{cuando.texto}</span>
          )}

          {/* 3 · el título. */}
          <h3 className="line-clamp-2 font-serif text-lg leading-snug font-semibold text-tinta group-hover:underline">
            {entrada.titulo}
          </h3>

          {ciclo && <p className="text-sm text-tinta/70">{ciclo}</p>}

          {/* 4 · dónde. Una línea: si no entra, se corta y está en el detalle. */}
          <p className="line-clamp-1 text-sm text-tinta/70">{lugarDeTarjeta(entrada, etiquetas)}</p>

          {enCurso && <p className="text-sm font-medium text-acento-hondo">{enCurso}</p>}

          {/*
            El aviso de inscripción, en su propia línea. **Va antes del pie y no
            al lado del arancel**: «Las inscripciones cerraron» no entra en la
            misma fila en 360px, y compartir la fila dejaba el precio bailando de
            una tarjeta a otra según cuánto ocupara el aviso — justo lo que el pie
            existe para evitar.
          */}
          <p
            className={
              aviso.tono === 'alerta'
                ? 'text-xs font-medium text-acento-hondo'
                : 'text-xs text-tinta/70'
            }
          >
            {aviso.texto}
          </p>

          {/*
            5 · cuánto, y cómo se cursa. El pie va **último y con `mt-auto`**, así
            que el arancel queda a la misma altura en todas las tarjetas de la
            fila y se puede comparar de un barrido vertical.
          */}
          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-2.5">
            {arancel.texto && (
              /*
                «A la gorra» es la mitad de los casos del circuito y no entra en
                el binario gratis/pago (§4.1 del `CLAUDE.md`): va con el acento y
                con peso, no escondido entre chips grises. Lo decide
                `esSinCosto`, no una comparación suelta acá.
              */
              <span
                className={
                  arancel.sinCosto
                    ? 'text-sm font-semibold text-acento-hondo'
                    : 'text-sm font-semibold text-tinta'
                }
              >
                {arancel.texto}
              </span>
            )}
            {formas.texto && (
              <span className="rounded-full bg-hondo px-2 py-0.5 text-xs text-tinta/70">
                {formas.texto}
              </span>
            )}
          </div>
        </div>
      </a>
    </li>
  );
}
