/**
 * Lo que dice una tarjeta del listado, y cómo se dibuja su portada — B-247.
 *
 * ── Por qué es un módulo y no está dentro del componente ──────────────────
 * `docs/05-patrones.md` dice que los componentes de React de este repo no tienen
 * tests de render: no hay testing-library y no se va a instalar. Con la lógica
 * adentro del `.tsx`, «qué dice la tarjeta cuando el ciclo ya empezó» no se puede
 * verificar de ninguna manera, y son justo las frases del dominio que el sitio no
 * puede decir mal: un ciclo no es una fecha, «a la gorra» no es gratis ni pago, y
 * una inscripción cerrada no se calcula en el build (B-111).
 *
 * Así que el componente queda dumb —recibe strings y los pinta— y todas las
 * decisiones viven acá, puras, con el reloj entrando como parámetro a través de
 * `EstadoDeEntrada`. Es el mismo corte que ya hay entre `listadoPublico.ts` y
 * `Buscador.tsx`.
 *
 * ── La portada generada ───────────────────────────────────────────────────
 * `imagenUrl` es opcional y en este circuito muchas actividades no van a tener
 * foto (D-141, decisión 3). Lo que se dibuja en su lugar **no es un placeholder**:
 * es una portada tipográfica, el título sobre el color del tipo, con dos cosas
 * derivadas de forma determinística para que se vea elegida y no rellenada:
 *
 * | Qué | De dónde sale | Por qué así |
 * |---|---|---|
 * | el color | `colorDeTipo` (`lib/identidad.ts`) | se deriva del slug, no de una tabla: `tipo` es taxonomía autogestionada (§4) y una tabla queda vieja el día que alguien agrega el octavo tipo |
 * | la escala del título | `escalaDePortada` | un título de una palabra y uno de doce no pueden ir al mismo cuerpo; con un solo tamaño, el primero se ve perdido y el segundo se corta |
 * | el motivo gráfico | `renglonesDePortada` | le da carácter propio a cada tipo sin inventar un segundo color |
 *
 * **El motivo se siembra con `tonoDeTipo` y no con un hash nuevo.** Es la misma
 * derivación que ya decide el color, así que un tipo tiene siempre la misma
 * portada y no hay dos funciones que respondan «qué le toca a este slug» —que es
 * exactamente la clase de B-88, dos derivaciones de la misma idea separándose sin
 * que nada falle.
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { diaYMes, fechaCorta, hora } from '@/lib/fechasPublicas';
import { ETIQUETA_MODALIDAD } from '@/lib/filtrosActividades';
import { tonoDeTipo } from '@/lib/identidad';
import { etiquetaDe, type EstadoDeEntrada, type MapaDeEtiquetas } from '@/lib/listadoPublico';

// ─────────────────────────────────────────────────────────────────
// Arancel
// ─────────────────────────────────────────────────────────────────

/**
 * Los aranceles que no se pagan.
 *
 * `'a-la-gorra'` está acá y **no es un caso raro**: el §4.1 del `CLAUDE.md` dice
 * que en el circuito literario es la mitad de los casos y que no entra en el
 * binario gratis/pago. Por eso la tarjeta lo pinta con el acento igual que
 * «Gratis» en vez de dejarlo en el gris del resto.
 */
export const SIN_COSTO: readonly string[] = ['gratis', 'a-la-gorra'];

export const esSinCosto = (slugArancel: string): boolean => SIN_COSTO.includes(slugArancel);

export interface ArancelDeTarjeta {
  /** La etiqueta cargada en `/opciones/arancel`. Vacío si el slug no está puesto. */
  texto: string;
  sinCosto: boolean;
}

export const arancelDeTarjeta = (
  entrada: EntradaDeIndice,
  etiquetas: MapaDeEtiquetas,
): ArancelDeTarjeta => ({
  texto: entrada.arancel.tipo ? etiquetaDe(etiquetas, 'arancel', entrada.arancel.tipo) : '',
  sinCosto: esSinCosto(entrada.arancel.tipo),
});

// ─────────────────────────────────────────────────────────────────
// Cuándo
// ─────────────────────────────────────────────────────────────────

export interface CuandoDeTarjeta {
  /** `mié 24 sep · 19:00`, o `Ya pasó`. */
  texto: string;
  /** El ISO para el atributo `datetime`, o `null` si no hay fecha que marcar. */
  iso: string | null;
  paso: boolean;
}

/**
 * La línea de fecha. Es el primer dato de la tarjeta porque es el que decide
 * (§4.2 del diseño).
 *
 * Sale de `estado.proxima`, que ya resolvió las tres decisiones sutiles —el fin y
 * no el inicio, los cancelados, el fallback— en `proximaVentana`. Acá no se
 * recalcula nada: solo se escribe.
 */
export const cuandoDeTarjeta = (estado: EstadoDeEntrada): CuandoDeTarjeta =>
  estado.proxima
    ? {
        texto: `${fechaCorta(estado.proxima)} · ${hora(estado.proxima)}`,
        iso: estado.proxima.toISOString(),
        paso: false,
      }
    : { texto: 'Ya pasó', iso: null, paso: true };

// ─────────────────────────────────────────────────────────────────
// Dónde y cómo se cursa
// ─────────────────────────────────────────────────────────────────

export interface FormasDeCursar {
  presencial: boolean;
  virtual: boolean;
  /** `Presencial` · `Virtual` · `Presencial y virtual`. Vacío si no hay dato. */
  texto: string;
}

/**
 * Qué formas de cursar ofrece, **leídas de `modalidades[]` y no del escalar**
 * (B-224).
 *
 * El escalar `modalidad` es la resultante que calculó el build, y una actividad
 * con una fila presencial y otra virtual tiene las dos cosas ciertas de ella. La
 * tarjeta tiene que poder decir «y también online», y con la resultante sola no
 * hay con qué: `'hibrido'` no distingue «un encuentro híbrido» de «dos filas, una
 * de cada tipo». Se cae al escalar solo si el índice viene sin el array, que es la
 * forma que el modelo tenía antes de B-224.
 */
export const formasDeCursar = (entrada: EntradaDeIndice): FormasDeCursar => {
  const valores = entrada.modalidades.length > 0 ? entrada.modalidades : [entrada.modalidad];
  const presencial = valores.some((v) => v === 'presencial' || v === 'hibrido');
  const virtual = valores.some((v) => v === 'virtual' || v === 'hibrido');
  if (!presencial && !virtual) return { presencial: false, virtual: false, texto: '' };
  const clave = presencial && virtual ? 'hibrido' : virtual ? 'virtual' : 'presencial';
  // El nombre se importa y no se escribe: «Presencial y virtual» tiene que
  // decirse igual en el sitio y en el panel.
  return { presencial, virtual, texto: ETIQUETA_MODALIDAD[clave] };
};

/**
 * La línea de lugar.
 *
 * `Casa Brandon · Boedo, CABA`, o `Online por Zoom`, o las dos cosas. **Nunca la
 * dirección**: el índice no la lleva (§3.1 del diseño) y la tarjeta no la
 * necesita.
 *
 * `Lugar a confirmar` es el texto del §7.7 para una presencial sin sede: no se
 * inventa una sede ni se esconde la actividad.
 */
export const lugarDeTarjeta = (entrada: EntradaDeIndice, etiquetas: MapaDeEtiquetas): string => {
  const { presencial, virtual } = formasDeCursar(entrada);
  const enLinea = entrada.online?.plataforma
    ? `Online por ${etiquetaDe(etiquetas, 'plataforma', entrada.online.plataforma)}`
    : 'Online';

  if (presencial && entrada.sede) {
    const zona = [
      entrada.sede.barrio ? etiquetaDe(etiquetas, 'barrio', entrada.sede.barrio) : '',
      entrada.sede.ciudad,
    ]
      .filter(Boolean)
      .join(', ');
    const base = [entrada.sede.nombre, zona].filter(Boolean).join(' · ');
    return virtual ? `${base} · y online` : base;
  }
  if (virtual) return enLinea;
  return 'Lugar a confirmar';
};

// ─────────────────────────────────────────────────────────────────
// El ciclo
// ─────────────────────────────────────────────────────────────────

/**
 * La línea del ciclo: **no es una fecha, es una cantidad y un arranque.**
 *
 * «Ciclo de 4 encuentros · empieza el 9 de septiembre» es lo que alguien necesita
 * para decidir, y es lo que el §2.2 del `CLAUDE.md` pide que la lista diga con una
 * sola tarjeta.
 *
 * **El verbo cambia con el reloj de quien mira** (§7.2 del diseño): decir «empieza
 * el 3 de septiembre» en octubre es información falsa, y es el modo de falla que
 * un texto armado en el build tiene garantizado.
 */
export const cicloDeTarjeta = (
  entrada: EntradaDeIndice,
  estado: EstadoDeEntrada,
): string | null => {
  if (estado.encuentros === 0) return null;
  if (estado.encuentros === 1 && !entrada.esCiclo) return null;

  const cabeza = `${entrada.esCiclo ? 'Ciclo de ' : ''}${estado.encuentros} ${
    estado.encuentros === 1 ? 'encuentro' : 'encuentros'
  }`;
  if (estado.paso) return estado.hasta ? `${cabeza} · terminó el ${diaYMes(estado.hasta)}` : cabeza;
  if (estado.enCurso) return estado.desde ? `${cabeza} · empezó el ${diaYMes(estado.desde)}` : cabeza;
  return estado.desde ? `${cabeza} · empieza el ${diaYMes(estado.desde)}` : cabeza;
};

/**
 * «Ya empezó — se puede entrar», o nada.
 *
 * Sale **solo si además la inscripción está abierta**: no hay un campo «acepta
 * incorporaciones tardías», y un cierre posterior a la primera sesión es la forma
 * en que el dueño lo expresa hoy. Decirlo con la inscripción cerrada sería
 * inventarlo (§7.2).
 */
export const enCursoDeTarjeta = (estado: EstadoDeEntrada): string | null =>
  estado.enCurso && !estado.inscripcionCerrada ? 'Ya empezó — se puede entrar' : null;

// ─────────────────────────────────────────────────────────────────
// La inscripción
// ─────────────────────────────────────────────────────────────────

/** `alerta` frena, `apagado` informa. Lo traduce a color el componente. */
export type TonoDeAviso = 'alerta' | 'apagado';

export interface AvisoDeTarjeta {
  texto: string;
  tono: TonoDeAviso;
}

/**
 * La línea de inscripción, **en orden de qué frena antes**.
 *
 * El orden es la decisión: `cerraron` va antes que `cupo completo` porque cuando
 * las dos son ciertas la segunda invita a una acción —«consultá por lista de
 * espera»— que ya no tiene a dónde ir. Y `requiere: false` va primero de todo:
 * ninguna de las otras frases tiene sentido si no hay inscripción.
 *
 * Nada de «quedan 3 lugares» (§4.2): no sabemos cuántas inscripciones hay. `cupo`
 * es el cupo total y se dice así.
 */
export const avisoDeTarjeta = (
  entrada: EntradaDeIndice,
  estado: EstadoDeEntrada,
): AvisoDeTarjeta => {
  if (!entrada.inscripcion.requiere) return { texto: 'Entrada libre, sin inscripción', tono: 'apagado' };
  if (estado.inscripcionCerrada) return { texto: 'Las inscripciones cerraron', tono: 'alerta' };
  if (entrada.inscripcion.completo) {
    return { texto: 'Cupo completo · consultá por lista de espera', tono: 'alerta' };
  }
  if (estado.cierra) return { texto: `Anotate antes del ${diaYMes(estado.cierra)}`, tono: 'apagado' };
  if (entrada.inscripcion.cupo) {
    return { texto: `Inscripción abierta · cupo ${entrada.inscripcion.cupo}`, tono: 'apagado' };
  }
  return { texto: 'Inscripción abierta', tono: 'apagado' };
};

// ─────────────────────────────────────────────────────────────────
// La portada generada
// ─────────────────────────────────────────────────────────────────

/**
 * El cuerpo del título en la portada generada.
 *
 * `sello` es el título de una sola palabra corta —«Micrófono», «Cronopios»—, que
 * con el cuerpo de un título largo se ve perdido en el medio del rectángulo y
 * parece un error de maquetación. Al revés, un título de doce palabras con el
 * cuerpo del sello no entra ni recortado.
 */
export type EscalaDePortada = 'sello' | 'grande' | 'media' | 'chica';

/** Los cortes están en caracteres visibles, con los espacios ya normalizados. */
export const escalaDePortada = (titulo: string): EscalaDePortada => {
  const limpio = titulo.trim().replace(/\s+/g, ' ');
  const palabras = limpio === '' ? 0 : limpio.split(' ').length;
  if (palabras <= 1 && limpio.length <= 14) return 'sello';
  if (limpio.length <= 26) return 'grande';
  if (limpio.length <= 64) return 'media';
  return 'chica';
};

/** Cuántos renglones tiene la portada, como mínimo. */
export const RENGLONES_MIN = 3;

/**
 * El motivo gráfico de la portada: renglones de anchos distintos, como el final
 * de un párrafo escrito a mano.
 *
 * Devuelve porcentajes del ancho de la portada. **El último es siempre el más
 * corto**, que es lo que hace que se lea como un párrafo que termina y no como
 * una grilla de barras: sin eso, tres líneas parejas parecen un gráfico de datos.
 *
 * La semilla es `tonoDeTipo`, así que dos tipos con el mismo color tienen el mismo
 * motivo —y eso es correcto: el motivo acompaña al color, no lo desmiente.
 */
export const renglonesDePortada = (slugTipo: string): number[] => {
  const semilla = tonoDeTipo(slugTipo);
  const cantidad = RENGLONES_MIN + (semilla % 3);
  return Array.from({ length: cantidad }, (_, i) => {
    const largo = 46 + ((semilla * (i + 7)) % 50);
    return i === cantidad - 1 ? Math.round(largo * 0.42) : largo;
  });
};
