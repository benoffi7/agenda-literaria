/**
 * La portada de una tarjeta: la foto si hay, y si no una portada generada — B-247.
 *
 * ── Por qué se genera y no se deja el hueco ───────────────────────────────
 * `imagenUrl` es opcional y en este circuito **muchas actividades no van a tener
 * foto**. B-227 resolvió eso no reservando la columna: la tarjeta sin imagen usaba
 * todo el ancho y quedaban dos ritmos de tarjeta en la lista (§4.2, §7.6 del
 * diseño). Eso funcionaba con la tarjeta **horizontal** de una sola columna; con
 * la grilla de D-141 no funciona, porque en una grilla la mitad de las celdas sin
 * portada no se lee como «dos ritmos» sino como una grilla roída. El desvío está
 * escrito en **D-142**.
 *
 * Lo que se pinta en su lugar no es un placeholder: es el título sobre el color
 * del tipo, con el cuerpo elegido según el largo y un motivo de renglones propio
 * del tipo. Las tres cosas se deciden en `lib/tarjetaPublica.ts`, que es puro y
 * está testeado; acá solo se pintan.
 *
 * ── El color y su contraste ───────────────────────────────────────────────
 * El color sale de `colorDeTipo` (`lib/identidad.ts`), que lo **deriva del slug**:
 * `tipo` es taxonomía autogestionada (§4 del `CLAUDE.md`) y una tabla de siete
 * colores queda vieja el día que alguien crea el octavo tipo, en silencio.
 *
 * Por eso **todo el texto de la portada va con `text-papel` opaco, sin `/NN`**: la
 * garantía de contraste de `identidad.ts` está afirmada sobre los 360 tonos
 * posibles para el papel opaco (peor caso 7,21:1). Una atenuación la rompería para
 * un tono que todavía no existe, y no habría forma de verlo. Lo fija
 * `tests/tarjeta-del-listado.test.ts`.
 *
 * ── Accesibilidad: la portada generada es decorativa ──────────────────────
 * El arte va con `aria-hidden` y la foto con `alt=""`, las dos por el mismo
 * motivo: **no aportan nada que el texto de la tarjeta no diga ya.** El nombre
 * accesible del link sale del título, la fecha y el lugar; un `alt` con el título
 * lo diría dos veces, y describir una foto que subió otra persona es algo que este
 * componente no puede hacer —no hay campo de texto alternativo en el modelo—. Lo
 * que **no** es decorativo es el tipo de actividad, así que la píldora del tipo va
 * fuera del arte, como texto de verdad.
 */
import { colorDeTipo } from '@/lib/identidad';
import { escalaDePortada, renglonesDePortada, type EscalaDePortada } from '@/lib/tarjetaPublica';

interface Props {
  tipo: string;
  /** La etiqueta del tipo, ya resuelta contra `/opciones/tipo`. */
  tipoLabel: string;
  titulo: string;
  imagenUrl: string | null;
  destacado: boolean;
  /**
   * Las primeras tarjetas de la grilla se cargan sin `lazy`: son la imagen más
   * grande del primer pantallazo y con `lazy` el navegador las pide tarde, lo que
   * empeora justo la métrica que la portada existe para mejorar.
   */
  prioridad?: boolean;
}

/** El cuerpo del título por escala. Lo decide `escalaDePortada`. */
const CUERPO: Record<EscalaDePortada, string> = {
  sello: 'text-[2.15rem] leading-[1.03] tracking-tight line-clamp-2',
  grande: 'text-2xl leading-[1.1] tracking-tight line-clamp-3',
  media: 'text-lg leading-snug line-clamp-3',
  chica: 'text-sm leading-snug line-clamp-4',
};

const PILDORA =
  'pointer-events-none absolute z-10 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold tracking-[0.12em] uppercase';

export function PortadaDeTarjeta({
  tipo,
  tipoLabel,
  titulo,
  imagenUrl,
  destacado,
  prioridad = false,
}: Props) {
  const color = colorDeTipo(tipo);

  return (
    /*
     * `aspect-[16/9]` reserva el alto antes de que baje la imagen: sin eso la
     * grilla salta mientras carga y se toca la tarjeta equivocada (§8).
     */
    <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-borde bg-hondo">
      {imagenUrl ? (
        <img
          src={imagenUrl}
          alt=""
          loading={prioridad ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={prioridad ? 'high' : 'auto'}
          width={640}
          height={360}
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-full flex-col justify-between gap-2 p-4"
          style={{ background: color }}
        >
          {/* Un renglón vacío arriba: la píldora del tipo se apoya ahí. */}
          <span className="block h-3" />
          <p className={`min-w-0 font-serif font-semibold text-papel ${CUERPO[escalaDePortada(titulo)]}`}>
            {titulo}
          </p>
          {/*
            El motivo: renglones de anchos derivados del tipo, con el último más
            corto para que se lea como un párrafo que termina. Es decorativo —no
            es texto— así que la atenuación acá no tiene piso de contraste.
          */}
          <div className="flex flex-col gap-[3px]">
            {renglonesDePortada(tipo).map((ancho, i) => (
              <span
                key={i}
                className="block h-[2px] rounded-full bg-papel/30"
                style={{ width: `${ancho}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/*
        El tipo, siempre en la portada y siempre como texto de verdad.
        Dos tratamientos porque hay dos fondos, y los dos están medidos:
        sobre la foto va el color del tipo con texto papel (≥7,21:1 sobre
        cualquiera de los 360 tonos); sobre la portada generada, que ya es de ese
        color, va papel con tinta (16,3:1) — la calcomanía sobre el afiche.
      */}
      {imagenUrl ? (
        <p className={`${PILDORA} top-2.5 left-2.5 text-papel`} style={{ background: color }}>
          {tipoLabel}
        </p>
      ) : (
        <p className={`${PILDORA} top-2.5 left-2.5 bg-papel text-tinta`}>{tipoLabel}</p>
      )}

      {destacado && (
        <p className={`${PILDORA} top-2.5 right-2.5 border border-borde bg-papel text-acento`}>
          Destacada
        </p>
      )}
    </div>
  );
}
