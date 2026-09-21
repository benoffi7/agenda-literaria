/**
 * **El handle de Instagram, normalizado** — B-928.
 *
 * Vive en un `.mjs` y no adentro de `enlaceSeguro.ts` por lo mismo que
 * `slugify`, `geografia` y `etiqueta-presentable`: **los scripts de `scripts/`
 * lo necesitan y corren en Node plano**, sin resolver los alias `@/` de
 * TypeScript. `enlaceSeguro.ts` lo re-exporta, así que ningún import cambió de
 * ruta.
 *
 * ── Antes había una copia, y esto la reemplaza ────────────────────────────
 * `scripts/handle-instagram.mjs` era una **segunda implementación**, atada a la
 * del sitio por un test que corría las dos contra la misma batería y exigía que
 * contestaran igual. Funcionó —ese test se puso en rojo apenas B-928 tocó una
 * sola de las dos—, pero una copia con red sigue siendo una copia: el arreglo
 * hay que escribirlo dos veces y el test solo avisa después. Con un módulo
 * compartido no hay nada que sincronizar.
 */

/**
 * `@casabrandon` / `casabrandon` / `instagram.com/casabrandon` → el handle solo.
 *
 * Se valida contra el alfabeto real de Instagram: lo que no lo cumple no se
 * convierte en link, se muestra como texto. Un handle con una barra adentro
 * armaría una URL a otra cuenta.
 *
 * ── B-928 · lo que Instagram pega de verdad ───────────────────────────────
 * **Se descarta el query string y el fragmento**, y no es una tolerancia
 * genérica: el botón «Compartir» de Instagram pega
 * `https://www.instagram.com/casabrandon/?igsh=MWx…`, o sea que el caso **más
 * común de todos** era justo el que fallaba. Sin esto el handle sale `null`, el
 * link no se arma, y en la ficha queda una URL escrita que no lleva a ninguna
 * parte — peor que no haber puesto nada.
 *
 * Salió de que hay una segunda persona cargando, con la forma real de hacerlo:
 * copiar la URL del perfil es más fácil que acordarse del handle. El criterio del
 * dueño vale más allá de este campo: «no podemos obligarlos a hacerlo como
 * queremos, sino ajustarnos nosotros».
 *
 * Se corta en el **primer** `?` o `#` y **antes** de sacar la barra final, que es
 * el orden que importa: al revés, la barra de `…/casabrandon/?igsh=…` no queda al
 * final y sobrevive adentro del handle.
 *
 * **Y el `https://` pasó a ser opcional.** El docblock decía desde siempre que
 * `instagram.com/casabrandon` andaba, y no andaba: el patrón exigía el esquema.
 * Copiar de la barra del navegador sin el `https://` es lo que hace cualquiera, y
 * el alfabeto de abajo sigue siendo la guarda — un `instagram.com/p/ABC/` queda
 * en `p/ABC`, que tiene una barra y no pasa.
 */
export const handleInstagram = (/** @type {string | null | undefined} */ crudo) => {
  const limpio = (crudo ?? '')
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(limpio) ? limpio : null;
};

/**
 * **El texto con el que se muestra ese handle: `@casabrandon`** — B-1141.
 *
 * Es la otra mitad de la misma pregunta que contesta `handleInstagram`, y vive
 * al lado por eso: uno dice *cuál es la cuenta*, éste dice *cómo se escribe*.
 * Tenerlo acá es lo que evita que cada salida se arme la arroba por su cuenta y
 * que una quede vieja — la clase de B-88.
 *
 * ── Los dos arreglos que motivaron la función ─────────────────────────────
 * 1. **La arroba faltaba.** La ficha pública mostraba `casabrandon` pelado,
 *    que no se lee como una cuenta de Instagram sino como una palabra suelta.
 * 2. **Las fichas cargadas antes del 2026-09-17 tienen la URL guardada.** La
 *    normalización al guardar llegó con B-928 (`formADocumento`,
 *    `lib/actividades.ts`) y **no reescribió lo ya cargado**: esos documentos
 *    siguen con `https://www.instagram.com/casabrandon/?igsh=…` adentro, y la
 *    ficha lo publicaba tal cual como nombre visible. Derivarlo **al mostrar**
 *    —y no con una migración— arregla las viejas y las nuevas con el mismo
 *    cambio, y deja el documento intacto por si hay que ver qué se tipeó.
 *
 * **Lo que no se reconoce sale como se escribió**, sin arroba: es el mismo
 * criterio que `enlaceInstagram` con el `href`. Perder «Casa Brandon / IG» por
 * no ser un handle es peor que mostrarlo sin link, y ponerle una arroba adelante
 * a algo que no es una cuenta sería afirmar algo falso.
 */
export const arrobaInstagram = (/** @type {string | null | undefined} */ crudo) => {
  const handle = handleInstagram(crudo);
  return handle ? `@${handle}` : (crudo ?? '').trim();
};
