/**
 * **Qué cambio de una efeméride amerita rehacer el sitio** — B-959, trampa 8.
 *
 * Lógica pura: sin Firebase, sin red y sin reloj. El efecto —marcar
 * `sistema/rebuild.pendiente`— vive en `efemerides-trigger.js`, que es el corte
 * que pide `docs/05-patrones.md` y el mismo que tienen `directorios.js` y
 * `rebuild.js`.
 *
 * ── Por qué no entra en `CAMPOS_PUBLICOS_POR_DIRECTORIO` ─────────────────
 * Sería una línea, y arrastraría dos cosas que una efeméride no es:
 * `COLECCIONES_DE_DIRECTORIO` se deriva de ese mapa y la recorre la retención
 * de la Guía (`borrarFichasVencidas`), que borra lo que nadie publicó a los 30
 * días. Un borrador de efeméride es trabajo del dueño, no el contacto de un
 * tercero: no tiene por qué vencer. Así que la lista vive acá, aparte.
 *
 * ── La trampa 3 ──────────────────────────────────────────────────────────
 * El trigger escribe `publicadaAlgunaVez` en la misma efeméride que lo disparó,
 * y ese write-back lo vuelve a disparar. Lo corta su guarda
 * (`faltaMarcarPublicada`), y ésta es la que impide que además cueste un build:
 * la marca no está en la lista.
 *
 * ── Los campos son los de la proyección, y eso se afirma ─────────────────
 * `functions/` no puede importar de `src/` (D-20), así que la lista se escribe
 * de este lado y `tests/efemeride-publica.test.ts` la ata a
 * `CAMPOS_DE_LA_PROYECCION_EFEMERIDE` (`src/lib/efemeridePublica.ts`) más
 * `estado`.
 */

/**
 * Lo que el sitio publica de una efeméride, más el `estado` que decide si la
 * publica. **No están** `createdAt`/`updatedAt`/`createdBy`/`updatedBy` (ciclo
 * de vida, y los uids no salen) ni `publicadaAlgunaVez` (el write-back).
 */
export const CAMPOS_PUBLICOS_DE_EFEMERIDE = [
  'estado',
  'slug',
  'titulo',
  'descripcion',
  'dia',
  'mes',
  'anio',
  'fuente',
];

const ESTADO_PUBLICADO = 'publicado';

const estaPublicada = (e) => e?.estado === ESTADO_PUBLICADO;

/**
 * ¿Este cambio cambia lo que el sitio muestra?
 *
 * **Un borrador que nunca estuvo publicado no rebuildea**, y es lo único que esta
 * guarda sabe que la de los directorios no: una efeméride a medio cargar se
 * guarda muchas veces, y ninguna de esas escrituras toca el sitio. Solo cuenta
 * lo que está publicado **antes o después** del cambio — publicar, despublicar,
 * editar una publicada o borrarla.
 *
 * Con eso resuelto, la comparación es la de siempre (§7.1): campo por campo con
 * `JSON.stringify`. Un falso positivo cuesta un build, que es el lado barato.
 */
export const efemerideAmeritaRebuild = (antes, despues) => {
  if (!estaPublicada(antes) && !estaPublicada(despues)) return false;
  if (!antes || !despues) return true;
  return CAMPOS_PUBLICOS_DE_EFEMERIDE.some(
    (c) => JSON.stringify(antes[c]) !== JSON.stringify(despues[c]),
  );
};
