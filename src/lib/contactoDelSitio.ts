/**
 * El contenido de `/contacto` — B-232.
 *
 * ── No hay backend, y eso es la mitad del diseño ──────────────────────────
 * El sitio es estático: no hay nada que reciba un formulario. Así que la página
 * son dos `mailto:` con el asunto ya puesto, y **el asunto es la funcionalidad**
 * — es lo que permite separar una sugerencia de un error en la bandeja sin
 * abrirlos, que es un pedido explícito del dueño. Los asuntos viven en
 * `src/lib/enlaces.ts` (B-228) y no se reescriben acá: escribirlos dos veces es
 * cómo se rompe la regla de la bandeja sin que nada falle.
 *
 * ── Por qué los bloques se derivan y no se listan ─────────────────────────
 * `BLOQUES_DE_CONTACTO` se arma recorriendo `MOTIVOS_DE_CONTACTO`, no
 * enumerando «sugerencia» y «error». Si mañana aparece un tercer motivo, la
 * página lo muestra sola en vez de ignorarlo en silencio — y lo único que hay
 * que escribir es qué conviene contar en ese caso, que es lo que el test exige.
 *
 * Tono: el mismo que `ayudaDelSitio.ts`. Le habla a alguien que encontró un
 * dato mal o conoce una actividad que falta, no a quien mantiene el sitio.
 */
import { MOTIVOS_DE_CONTACTO, urlDeContacto, type MotivoDeContacto } from '@/lib/enlaces';
import { RUTA_AYUDA } from '@/lib/rutasPublicas';

export interface BloqueDeContacto {
  motivo: MotivoDeContacto;
  /** El nombre del botón. Sale del contrato de enlaces, no se reescribe. */
  etiqueta: string;
  /** La frase de una línea del contrato: qué es este motivo. */
  ayuda: string;
  /** El asunto con el que llega el mail. Se muestra para que se sepa. */
  asunto: string;
  /** El `mailto:` armado. Nunca se escribe a mano. */
  href: string;
  /**
   * Qué conviene incluir, en viñetas. Es lo propio de esta página: el contrato
   * tiene la frase corta, acá está la lista que hace que el mail sea usable sin
   * tener que repreguntar.
   */
  queIncluir: string[];
}

/**
 * Lo que conviene contar, por motivo. Está separado de la derivación para que
 * un motivo nuevo sin su lista se note: el test compara las claves de acá con
 * las de `MOTIVOS_DE_CONTACTO`.
 */
const QUE_INCLUIR: Readonly<Record<MotivoDeContacto, readonly string[]>> = {
  sugerencia: [
    'Quién la da o quién la organiza.',
    'Cuándo es: la fecha y la hora, o todas las fechas si son varios encuentros.',
    'Dónde es: la dirección, o por dónde si es virtual.',
    'Cómo se anota la gente y cuánto sale, si lo sabés.',
    'Un link donde esté anunciada, aunque sea una publicación de Instagram.',
  ],
  error: [
    'Qué viste mal: la fecha, el lugar, el precio, un nombre.',
    'En qué página lo viste. Con pegar la dirección de la página alcanza.',
    'Cuál es el dato correcto, si lo sabés.',
  ],
};

/**
 * Los bloques de la página, uno por motivo, en el orden en que están declarados
 * en el contrato.
 */
export const BLOQUES_DE_CONTACTO: BloqueDeContacto[] = (
  Object.keys(MOTIVOS_DE_CONTACTO) as MotivoDeContacto[]
).map((motivo) => ({
  motivo,
  etiqueta: MOTIVOS_DE_CONTACTO[motivo].etiqueta,
  ayuda: MOTIVOS_DE_CONTACTO[motivo].ayuda,
  asunto: MOTIVOS_DE_CONTACTO[motivo].asunto,
  href: urlDeContacto(motivo),
  queIncluir: [...(QUE_INCLUIR[motivo] ?? [])],
}));

/*
 * ── La página no lleva entrada, y es una decisión ─────────────────────────
 * B-301. Había dos párrafos que explicaban que no hay formulario y por qué el
 * asunto viene puesto. Los sacó el dueño: **le explicaban al visitante las
 * decisiones de diseño del sitio**, que es algo que a nadie que entra a una
 * página de contacto le interesa.
 *
 * Lo que ocupaba su lugar lo dicen los dos botones: cada uno se llama por lo
 * que hace —«Sugerir una actividad», «Reportar un error»— y abre el correo. Una
 * página que se explica sola no necesita presentarse.
 */

/** Qué pasa después de mandar el mail. Corto y honesto. */
export const QUE_PASA_DESPUES: string[] = [
  'Lo lee una persona, no un sistema: no vas a recibir un acuse automático y puede demorar unos ' +
    'días.',
  'Si es un dato mal publicado, lo corregimos apenas lo vemos y el cambio tarda unos minutos más ' +
    'en aparecer en el sitio. Si es una actividad nueva, la cargamos cuando podemos verificarla, y ' +
    'a veces escribimos para preguntar algo que falta.',
  'No usamos tu dirección para nada más que responderte.',
];

/** Adónde mandar a quien en realidad venía con una pregunta. */
export const ANTES_DE_ESCRIBIR: { href: string; texto: string } = {
  href: RUTA_AYUDA,
  texto: 'Muchas preguntas ya están contestadas en la ayuda',
};
