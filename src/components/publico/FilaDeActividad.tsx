/**
 * Una **fila** del listado — B-260 (D-146). Sustituye a `Tarjeta.tsx`.
 *
 * **Hay una sola definición del markup de la fila, y es ésta.** La usa el HTML
 * que arma el build (Astro renderiza este componente sin hidratar, así que sale
 * como HTML plano y sin JavaScript) y la usa la island después de filtrar. El
 * §6.3 del diseño lo pide con todas las letras: dos markups —uno en `.astro` y
 * otro en React— se separan en el primer cambio y nadie se entera, porque los dos
 * se ven bien por separado.
 *
 * ── Por qué una fila y no una tarjeta ─────────────────────────────────────
 * El sistema visual lo dice: «**filas cronológicas** en lugar de tarjetas,
 * separadas por una regla fina. Primera columna la fecha, segunda el título,
 * tercera la sede y la categoría». Una grilla de tarjetas es la forma de una
 * plataforma; una lista de filas con reglas es la forma de un **programa de
 * festival**, que es lo que este sitio es. Y a igual ancho entran tres veces más
 * actividades, que es la «densidad» que el sistema pide como principio.
 *
 * La grilla es de **12 columnas** en escritorio, como manda el sistema: la fecha
 * y el tipo en 1-3, el título y los metadatos en 4-9, el arancel en 10-12. En el
 * teléfono son dos —el bloque de fecha y el resto—, que es la bajada de las «4
 * columnas en móvil».
 *
 * ── El bloque de fecha ────────────────────────────────────────────────────
 * Un **rectángulo de tinta plena con el texto calado en el papel**: es el gesto
 * central del sistema y el ancla visual de la fila. Su clase vive en
 * `estilos.ts` porque la página de detalle pinta el mismo bloque, y dos
 * definiciones serían dos bloques de fecha distintos para el mismo dato.
 *
 * Qué va adentro lo decide `bloqueDeFecha` (`lib/tarjetaPublica.ts`), que es puro
 * y está testeado: acá no se formatea una fecha ni se parte una cadena.
 *
 * ── Sin imágenes, y eso es la decisión ────────────────────────────────────
 * El listado es **puramente tipográfico**. No hay portada, no hay miniatura y no
 * hay portada generada: se retiró `PortadaDeTarjeta` (D-146). Una miniatura de
 * 64px de una portada generada es un sello de color que no dice nada y devuelve
 * la textura de plataforma que el rediseño existe para sacar.
 *
 * ── Es presentacional, y a propósito ──────────────────────────────────────
 * Sin hooks, sin estado, sin fetch, y **sin decidir qué dice**: cada frase sale
 * de `lib/tarjetaPublica.ts`, que es puro y está testeado. Los componentes de
 * este repo no tienen tests de render (`docs/05-patrones.md`), así que lo que
 * quede acá adentro no se verifica en ninguna parte.
 */
import { claseBloqueFecha, foco } from '@/components/sitio/estilos';
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { estadoDe, etiquetaDe, type MapaDeEtiquetas } from '@/lib/listadoPublico';
// La ruta no se arma acá: la produce `caminosDeDetalle` y la linkea esto, y son
// dos derivaciones del mismo formato (clase de B-88). Ver `rutasPublicas.ts`.
import { rutaDeDetalle } from '@/lib/rutasPublicas';
import {
  arancelDeTarjeta,
  avisoDeTarjeta,
  bloqueDeFecha,
  cicloDeTarjeta,
  enCursoDeTarjeta,
  formasDeCursar,
  lugarDeTarjeta,
} from '@/lib/tarjetaPublica';

interface Props {
  entrada: EntradaDeIndice;
  /** El reloj con el que se decide «próxima» y «cerró» (§6.4). */
  ahora: Date;
  etiquetas: MapaDeEtiquetas;
}

export function FilaDeActividad({ entrada, ahora, etiquetas }: Props) {
  const estado = estadoDe(entrada, ahora);
  const fecha = bloqueDeFecha(estado);
  const ciclo = cicloDeTarjeta(entrada, estado);
  const enCurso = enCursoDeTarjeta(estado);
  const aviso = avisoDeTarjeta(entrada, estado);
  const arancel = arancelDeTarjeta(entrada, etiquetas);
  const formas = formasDeCursar(entrada);
  const lugar = lugarDeTarjeta(entrada, etiquetas);

  /*
   * La línea de metadatos: hora, lugar y forma de cursar, separados por un punto
   * medio. Se arma filtrando los vacíos y no concatenando con condicionales,
   * porque con tres condicionales encadenados el separador sobrante al principio
   * o al final es el bug clásico —«· Villa Crespo»— y no lo ve nadie hasta que
   * una actividad no tiene hora.
   */
  const metadatos = [fecha.paso ? null : fecha.hora, lugar, formas.texto].filter(Boolean);

  return (
    /*
     * La regla fina que separa una fila de la siguiente. Va en el `<li>` y no en
     * el `<a>` para que el hover pinte hasta el borde del bloque sin comerse la
     * regla.
     */
    <li className="regla-fina min-w-0">
      {/*
        Toda la fila es un link y no hay botones adentro: en móvil un botón dentro
        de un link es un blanco ambiguo (§4.2). El nombre accesible sale del
        contenido completo —fecha, tipo, título, lugar y arancel—, no de un «leer
        más» (§10).

        El hover pinta la superficie de la capa tonal, que es lo que el sistema
        pide («hover: surface-container-low»): **no** hay sombra ni
        desplazamiento, que es la regla 2 de `global.css`.
      */}
      <a
        href={rutaDeDetalle(entrada.slug)}
        className={`group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-2 py-4 transition-colors hover:bg-crema lg:grid-cols-12 lg:px-4 ${foco}`}
      >
        {/* ── Columnas 1-3 · el bloque de fecha y el tipo ─────────────── */}
        <div className="flex flex-col items-start gap-2 lg:col-span-3 lg:flex-row lg:items-center">
          {fecha.paso ? (
            /*
              La actividad ya pasó: el bloque va en la tinta de superposición y no
              en terracota. El terracota es la tinta de lo que se puede hacer, y un
              bloque terracota en algo que ya pasó promete una acción que no existe.
            */
            <p className={`${claseBloqueFecha} label-caps bg-super`}>{fecha.texto}</p>
          ) : (
            <time dateTime={fecha.iso} className={`${claseBloqueFecha} bg-acento`}>
              <span className="label-caps">{fecha.diaSemana}</span>
              <span className="fecha-dia">{fecha.dia}</span>
              <span className="label-caps">{fecha.mes}</span>
            </time>
          )}

          {/*
            El tipo en una cajita con borde, en azul tinta. **Una sola tinta para
            todas las categorías** (D-146): la paleta del sistema es limitada, así
            que lo que distingue un taller de un club de lectura es la palabra y no
            un color por tipo.
          */}
          <p className="label-caps border border-borde px-1.5 py-1 text-azul">
            {etiquetaDe(etiquetas, 'tipo', entrada.tipo)}
          </p>
        </div>

        {/* ── Columnas 4-9 · el título y los metadatos ────────────────── */}
        <div className="col-start-2 min-w-0 lg:col-span-6 lg:col-start-auto">
          {entrada.destacado && (
            <p className="label-caps mb-1 text-acento">Destacada</p>
          )}

          <h3 className="headline-sm text-tinta group-hover:text-acento">{entrada.titulo}</h3>

          {metadatos.length > 0 && (
            <p className="body-sm mt-1 text-super">{metadatos.join(' · ')}</p>
          )}

          {ciclo && <p className="body-sm mt-1 text-super">{ciclo}</p>}

          {enCurso && <p className="body-sm mt-1 font-semibold text-acento">{enCurso}</p>}

          {/*
            El aviso de inscripción. `alerta` frena y va en terracota; `apagado`
            informa y va en la tinta de superposición. Las dos están medidas: 6,33
            y 6,34 sobre el papel, y 5,15 sobre la capa tonal del hover.
          */}
          <p
            className={
              aviso.tono === 'alerta'
                ? 'body-sm mt-1 font-semibold text-acento'
                : 'body-sm mt-1 text-super'
            }
          >
            {aviso.texto}
          </p>
        </div>

        {/* ── Columnas 10-12 · el arancel ─────────────────────────────── */}
        {arancel.texto && (
          <p
            className={`label-caps col-start-2 lg:col-span-3 lg:col-start-auto lg:text-end ${
              /*
                «A la gorra» es la mitad de los casos del circuito y no entra en el
                binario gratis/pago (§4.1 del `CLAUDE.md`): va con el acento, no
                escondido con el resto de los metadatos. Lo decide `esSinCosto`, no
                una comparación suelta acá.
              */
              arancel.sinCosto ? 'text-acento' : 'text-tinta'
            }`}
          >
            {arancel.texto}
          </p>
        )}
      </a>
    </li>
  );
}
