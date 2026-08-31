/**
 * La identidad del sitio: cómo se llama — B-245, recortado en B-260.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El sitio se presentaba como «Agenda literaria», que es **su categoría, no su
 * nombre**. El nombre estaba decidido desde el 2026-08-27 (DEC-6) y no se había
 * usado en ninguna parte: ocho lugares repetían la descripción genérica. Un sitio
 * que se presenta con su categoría no tiene identidad, y esto es la mitad de la
 * causa.
 *
 * B-245 le sumó una segunda mitad —un color derivado por tipo de actividad— que
 * B-260 retiró al pasar a una paleta de tres tintas. El porqué está al final del
 * archivo; lo que queda acá es el nombre, que es lo que había que arreglar.
 */

/** El nombre, corto, para el encabezado y el `og:site_name`. */
export const NOMBRE = 'Agenda LEH';

/**
 * La bajada. Hace trabajo doble: es la línea de qué es el sitio y es el
 * desarrollo del acrónimo, así que «LEH» no queda como una sigla muda.
 */
export const BAJADA = 'Leer, Escribir, Hacer';

/** El nombre completo, para el `<title>` y los metadatos. */
export const NOMBRE_COMPLETO = `${NOMBRE} — ${BAJADA}`;

/**
 * De qué habla el sitio, en una línea. Vive acá y no en cada página porque las
 * cinco lo necesitan y tres lo tenían escrito distinto.
 */
export const QUE_ES = 'Talleres de escritura, clubes de lectura, encuentros y presentaciones en Argentina.';

/*
 * ── Lo que B-260 sacó: el color por tipo de actividad ─────────────────────
 *
 * D-141 decidió que cada tipo de actividad tuviera **su propio tono**, derivado
 * del slug para que un tipo creado desde «Otro» no cayera en un gris de descarte.
 * El razonamiento era bueno y la implementación estaba bien medida: el contraste
 * se garantizaba sobre los 360 tonos posibles y no sobre los siete que existían.
 *
 * El sistema visual de B-260 (`docs/referencias/sistema-visual.md`) lo retira, y
 * no por un defecto de aquello: por una premisa distinta. La paleta es ahora
 * **«limitada, como una impresión a tintas planas»** — tres tintas con nombre:
 * terracota, azul tinta y la superposición de las dos. Siete u ocho tintas más,
 * una por tipo de actividad, es exactamente lo contrario de eso; y el sistema
 * además ya le asigna un lugar a la categoría: «azul tinta — texto funcional,
 * **categorías**».
 *
 * Así que el tipo de actividad se escribe en azul tinta, todos con la misma, y lo
 * que distingue a un taller de un club de lectura vuelve a ser la palabra. Ver
 * D-146, que deja escrito qué se pierde con esto y cómo volver si hiciera falta.
 *
 * Lo que **no** se fue es este módulo: el nombre, la bajada y la línea de qué es
 * el sitio son lo que D-141 resolvió de fondo —ocho literales sueltos que habían
 * quedado viejos los ocho a la vez— y siguen igual de vigentes.
 */
