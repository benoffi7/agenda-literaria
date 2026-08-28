/**
 * La tarjeta del listado — B-227, §4.2 del diseño.
 *
 * **Hay una sola definición del markup de la tarjeta, y es ésta.** La usa el
 * HTML que arma el build (Astro renderiza este componente sin hidratar, así que
 * sale como HTML plano y sin JavaScript) y la usa la island después de filtrar.
 * El §6.3 del diseño lo pide con todas las letras: dos markups —uno en `.astro`
 * y otro en React— se separan en el primer cambio y nadie se entera, porque los
 * dos se ven bien por separado.
 *
 * Es puramente presentacional: sin hooks, sin estado, sin fetch. Lo que decide
 * qué dice sale de `estadoDe`, que es lo que se testea.
 */
import {
  estadoDe,
  etiquetaDe,
  type MapaDeEtiquetas,
} from '@/lib/listadoPublico';
import { diaYMes, fechaCorta, hora, rangoCorto } from '@/lib/fechasPublicas';
// La ruta no se arma acá: la produce `caminosDeDetalle` y la linkea esto, y son
// dos derivaciones del mismo formato (clase de B-88). Ver `rutasPublicas.ts`.
import { rutaDeDetalle } from '@/lib/rutasPublicas';
import type { EntradaDeIndice } from '@/lib/eventsJson';

interface Props {
  entrada: EntradaDeIndice;
  /** El reloj con el que se decide «próxima» y «cerró» (§6.4). */
  ahora: Date;
  etiquetas: MapaDeEtiquetas;
}

/** El arancel se pinta con el acento solo cuando no se paga (§4.2). */
const SIN_COSTO = ['gratis', 'a-la-gorra'];

export function Tarjeta({ entrada, ahora, etiquetas }: Props) {
  const e = estadoDe(entrada, ahora);
  const tipo = etiquetaDe(etiquetas, 'tipo', entrada.tipo);
  const arancel = etiquetaDe(etiquetas, 'arancel', entrada.arancel.tipo);
  const gratis = SIN_COSTO.includes(entrada.arancel.tipo);

  const lugar = entrada.sede
    ? [entrada.sede.nombre, entrada.sede.barrio ? etiquetaDe(etiquetas, 'barrio', entrada.sede.barrio) : '', entrada.sede.ciudad]
        .filter(Boolean)
        .join(' · ')
    : entrada.online
      ? `Online por ${etiquetaDe(etiquetas, 'plataforma', entrada.online.plataforma)}`
      : 'Lugar a confirmar';

  /*
   * §7.2 — «empezó el 3 de sep» y no «empieza el 3 de sep»: decir lo segundo en
   * octubre es información falsa. Y §7.5: un ciclo es una tarjeta, con su rango.
   */
  const lineaCiclo =
    e.encuentros > 1 && e.desde && e.hasta
      ? `${entrada.esCiclo ? 'Ciclo de ' : ''}${e.encuentros} encuentros · ${rangoCorto(e.desde, e.hasta)}`
      : null;

  const lineaInscripcion = !entrada.inscripcion.requiere
    ? 'Entrada libre'
    : e.inscripcionCerrada
      ? 'Las inscripciones cerraron'
      : entrada.inscripcion.completo
        ? 'Cupo completo · consultá por lista de espera'
        : e.cierra
          ? `Inscripción abierta hasta el ${diaYMes(e.cierra)}`
          : entrada.inscripcion.cupo
            ? `Inscripción abierta · cupo ${entrada.inscripcion.cupo}`
            : 'Inscripción abierta';

  return (
    <li>
      {/*
        Toda la tarjeta es un link y no hay botones adentro: en móvil un botón
        dentro de un link es un blanco ambiguo (§4.2). El nombre accesible sale
        del contenido completo —título, fecha y lugar—, no de un «leer más» (§10).
      */}
      <a
        href={rutaDeDetalle(entrada.slug)}
        className="group flex gap-3 rounded-lg border border-borde bg-white/50 p-3 transition-colors hover:border-tinta/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento sm:gap-4 sm:p-4"
      >
        {/*
          §7.6 — sin imagen **no hay hueco gris**: la columna no se reserva y el
          texto usa todo el ancho. Es una tarjeta distinta, no una rota.
          `width`/`height` y `loading="lazy"` para que la lista no salte al
          cargar y no se toque la tarjeta equivocada (§8).
        */}
        {entrada.imagenUrl && (
          <img
            src={entrada.imagenUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={320}
            height={180}
            referrerPolicy="no-referrer"
            className="h-16 w-24 shrink-0 rounded-md border border-borde object-cover sm:h-24 sm:w-40"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {/* La fecha va primero y en Inter: es el dato que decide (§4.2). */}
            {e.proxima ? (
              <time dateTime={e.proxima.toISOString()} className="text-sm font-medium text-tinta">
                {fechaCorta(e.proxima)} · {hora(e.proxima)}
              </time>
            ) : (
              <span className="text-sm font-medium text-tinta/65">Ya pasó</span>
            )}
            <span className="ml-auto flex shrink-0 flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-wide">
              <span className="text-tinta/65">{tipo}</span>
              <span className={gratis ? 'font-semibold text-acento' : 'text-tinta/65'}>
                {arancel}
              </span>
            </span>
          </div>

          <h3 className="font-serif text-lg leading-snug font-semibold text-tinta group-hover:underline sm:text-xl">
            {entrada.titulo}
          </h3>

          <p className="text-sm text-tinta/70">{lugar}</p>
          {lineaCiclo && <p className="text-sm text-tinta/65">{lineaCiclo}</p>}
          {/*
            §7.2 — el aviso sale **solo si además la inscripción está abierta**.
            Es lo más cerca que estamos del dato real: no hay un campo «acepta
            incorporaciones tardías», y un cierre posterior a la primera sesión es
            la forma en que el dueño lo expresa hoy. Decir «se puede entrar» con la
            inscripción cerrada sería inventarlo.
          */}
          {e.enCurso && !e.inscripcionCerrada && (
            <p className="text-sm font-medium text-acento">Ya empezó — se puede entrar</p>
          )}
          <p className="text-xs text-tinta/65">{lineaInscripcion}</p>
        </div>
      </a>
    </li>
  );
}
