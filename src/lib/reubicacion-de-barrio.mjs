/**
 * **Un barrio que en realidad era una provincia** — B-976.
 *
 * Hasta B-950 el barrio era **el único campo de lugar** que el formulario
 * ofrecía. Quien cargaba una actividad en Tandil no tenía dónde poner la
 * provincia, así que la puso donde había lugar: `/opciones/barrio` terminó con
 * «Provincia de Buenos Aires» entre Belgrano y Colegiales, y 54 actividades
 * apuntando ahí. No es descuido de nadie — el vocabulario es el registro fiel de
 * un formulario que faltaba.
 *
 * Este módulo contesta **una** pregunta, y es pura: dada una sede, ¿dónde
 * debería estar cada dato? Escribir es del script (`reubicar-barrios.mjs`).
 *
 * ── Las dos reglas que generalizan, y por qué solo dos ────────────────────
 * Se reubica **solo cuando el propio dato lo dice**, sin tabla de ciudades y sin
 * tabla de barrios:
 *
 *  1. **El barrio es una provincia** → va a `provincia`, y el barrio queda
 *     vacío. Lo decide `esProvincia`, o sea la lista cerrada de 24, más el alias
 *     `provincia-de-buenos-aires`, que es como quedó escrita las 54 veces.
 *  2. **Están invertidos** (el barrio es una ciudad y la *ciudad* es una
 *     provincia) → se cruzan. Es el caso `barrio=rosario | ciudad=santa-fe`.
 *
 * **Lo que NO se hace, y es el punto:** deducir la provincia de una ciudad.
 * «Tandil» es bonaerense para una persona y para nadie más acá; una tabla
 * ciudad→provincia sería inventar el dato, y el primer error se publicaría en el
 * `addressLocality` del JSON-LD. Es la misma línea que `sembrar-geografia.mjs`
 * ya trazó, y se respeta: si la sede no dice la provincia, queda sin provincia.
 *
 * ── Lo ambiguo se devuelve como ambiguo, no se resuelve ───────────────────
 * Cuando el documento **se contradice** —un barrio de CABA con una ciudad que no
 * es CABA, o la provincia de Buenos Aires con la ciudad en CABA— no hay lectura
 * correcta que el código pueda elegir: las dos mitades son afirmaciones de igual
 * peso y una está mal. Se marca `ambiguo` y lo mira una persona. Un backfill que
 * desempata a la fuerza escribe el error con la misma confianza que el acierto.
 */
/*
 * Imports **relativos** y no con el alias `@/`: a este módulo lo carga un script
 * de `scripts/` con Node plano, que no resuelve el alias de Vite. Es la misma
 * razón por la que `geografia.mjs` importa así.
 */
import { esCaba, esProvincia, PROVINCIAS } from './geografia.mjs';
import { slugify } from '../../functions/slugify.js';

/**
 * Así quedó escrita la provincia de Buenos Aires las 54 veces: con el
 * «Provincia de» adelante, porque se estaba llenando un campo que decía
 * «Barrio» y había que aclarar que no lo era.
 */
export const ALIAS_DE_PROVINCIA = { 'provincia-de-buenos-aires': 'buenos-aires' };

/** El slug de provincia que denota este texto, o `''` si no denota ninguna. */
export const provinciaQueDenota = (valor) => {
  const slug = slugify(valor ?? '');
  if (!slug) return '';
  if (ALIAS_DE_PROVINCIA[slug]) return ALIAS_DE_PROVINCIA[slug];
  if (PROVINCIAS.some((p) => p.slug === slug)) return slug;
  /*
   * `esProvincia` acepta además los cuatro alias de CABA, y se consulta después
   * de la tabla para que `caba` salga con su slug canónico y no con el alias
   * tipeado.
   */
  return esProvincia(slug) ? 'caba' : '';
};

/**
 * Qué habría que hacer con la geografía de esta sede.
 *
 * - `{ estado: 'sin-cambios' }` — la sede no tiene un barrio mal ubicado.
 * - `{ estado: 'reubicar', geografia, motivo }` — los tres campos corregidos.
 * - `{ estado: 'ambiguo', motivo }` — el documento se contradice; lo mira una persona.
 *
 * **Nunca inventa una provincia** y **nunca toca nada que no sean los tres
 * campos de la geografía**: el nombre, la dirección, las indicaciones y la `geo`
 * son del llamador. Un backfill que reescribe un campo que no le toca es un
 * backfill que puede perder datos.
 */
export const reubicacionDe = (sede) => {
  const barrio = slugify(sede?.barrio ?? '');
  const ciudad = slugify(sede?.ciudad ?? '');
  const provinciaYaPuesta = slugify(sede?.provincia ?? '');
  if (!barrio) return { estado: 'sin-cambios' };

  const barrioEsProvincia = provinciaQueDenota(barrio);
  const ciudadEsProvincia = provinciaQueDenota(ciudad);

  // ── 1 · El barrio es una provincia ───────────────────────────────────────
  if (barrioEsProvincia) {
    /*
     * «Provincia de Buenos Aires» con la ciudad en CABA es una contradicción, no
     * un dato incompleto: CABA no está en la provincia de Buenos Aires. Cuál de
     * las dos mitades es la verdadera lo sabe quien la cargó.
     */
    if (esCaba(ciudad) && barrioEsProvincia !== 'caba') {
      return { estado: 'ambiguo', motivo: `el barrio dice «${barrioEsProvincia}» y la ciudad dice CABA` };
    }
    return {
      estado: 'reubicar',
      motivo: `el barrio era la provincia «${barrioEsProvincia}»`,
      geografia: { provincia: barrioEsProvincia, barrio: '', ciudad },
    };
  }

  // ── 2 · La ciudad es una provincia ───────────────────────────────────────
  /*
   * **Esto NO se reubica solo, y la primera versión de este módulo sí lo hacía.**
   *
   * Parece obvio: si el barrio tiene una ciudad y la ciudad tiene una provincia,
   * se tipeó cruzado — `barrio=rosario | ciudad=santa-fe` es exactamente eso. Y
   * la regla escrita así **rompe el caso de al lado**: `barrio=nunez |
   * ciudad=neuquen` la dispara igual, porque Neuquén también es una provincia, y
   * la reubicaría como «la ciudad de Núñez, en Neuquén». Núñez es un barrio de
   * CABA.
   *
   * Distinguir los dos pide saber si el barrio es un barrio de CABA, y **acá no
   * hay forma de saberlo**: el barrio es vocabulario abierto y no existe ninguna
   * lista contra la cual medirlo. Inventarla —48 barrios cableados en un módulo
   * de migración— es la tabla ciudad→provincia que el docblock de arriba
   * descarta, con otro nombre.
   *
   * Son cuatro filas en total. Las mira una persona.
   */
  if (ciudadEsProvincia && ciudadEsProvincia !== 'caba') {
    return {
      estado: 'ambiguo',
      motivo:
        `la ciudad dice «${ciudadEsProvincia}», que es una provincia — ` +
        `puede ser que estén invertidos, o que «${barrio}» sea un barrio de CABA`,
    };
  }

  /*
   * ── 3 · Lo que queda ────────────────────────────────────────────────────
   * Un barrio que no es provincia con una ciudad que tampoco lo es. Casi siempre
   * está bien (Palermo en CABA). Se marca ambiguo **solo** cuando ya hay una
   * provincia puesta y la sede se contradice consigo misma — en CABA el segundo
   * nivel es el barrio, así que un barrio junto a una ciudad que no es CABA, bajo
   * una provincia que sí lo es, no puede ser las dos cosas.
   */
  if (provinciaYaPuesta && esCaba(provinciaYaPuesta) && ciudad && !esCaba(ciudad)) {
    return { estado: 'ambiguo', motivo: `provincia CABA con la ciudad «${ciudad}»` };
  }
  return { estado: 'sin-cambios' };
};
