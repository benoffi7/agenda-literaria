/**
 * **La decisión de `vocabulario-desde-actividades.mjs`, separada del I/O** —
 * B-975, roadmap 1.5 (B-2172 paso 3).
 *
 * El script se conecta a Firestore al importarlo, así que lo que un test tiene
 * que poder mirar vive acá (la forma de `geografia-a-sembrar.mjs`).
 */
// **El mismo `slugify` y la misma derivación que el panel**, importados y no
// copiados: una opción sembrada acá y la misma tipeada en el formulario tienen
// que dar el mismo slug, o el §4.2 se rompe con un duplicado.
import { slugify } from '../functions/slugify.js';
import { slugDeOrganizador } from '../functions/organizador.js';
import { etiquetaPresentable } from '../src/lib/etiqueta-presentable.mjs';

/** Los tres campos de lugar que viven en una sede y son taxonomía (§4, D-710). */
export const CAMPOS_DE_SEDE = ['provincia', 'barrio', 'ciudad'];

/*
 * Roadmap 1.5 — `organizador` es taxonomía desde el tramo A de B-2172, y sus 441
 * actividades lo tienen escrito sin que la lista lo sepa: el mismo problema que
 * las ciudades de B-975. Va aparte de los de sede porque sale de otro lado del
 * documento y su slug se deriva distinto (el guardado si lo hay, D-26).
 */
export const CAMPOS = [...CAMPOS_DE_SEDE, 'organizador'];

/** Los campos que este script lee de cada actividad, para el `select`. */
export const CAMPOS_LEIDOS = ['modalidades', 'sede', 'organizador'];

/** Cada sede de una actividad: las filas de `modalidades`, más la `sede` suelta de los documentos viejos. */
export const sedesDe = (a) => [
  ...(a.modalidades ?? []).map((m) => m?.sede).filter(Boolean),
  ...(a.sede ? [a.sede] : []),
];

/**
 * Lo que una actividad usa en un campo: `[slug, lo que se tipeó]`, sin repetir
 * slug. **Por actividad y no por fila**: una actividad con dos modalidades en Mar
 * del Plata usa Mar del Plata una vez, que es la definición de `elegidosDe`.
 *
 * @param {any} a  el documento
 * @param {string} campo
 * @returns {[string, string][]}
 */
export const usadosEn = (a, campo) => {
  if (campo === 'organizador') {
    const slug = slugDeOrganizador(a.organizador);
    return slug ? [[slug, String(a.organizador?.nombre ?? '')]] : [];
  }
  const porSlug = new Map();
  for (const s of sedesDe(a)) {
    const crudo = s?.[campo] ?? '';
    const slug = slugify(crudo);
    if (slug && !porSlug.has(slug)) porSlug.set(slug, crudo);
  }
  return [...porSlug];
};

const mayusculas = (s) => [...s].filter((c) => c !== c.toLocaleLowerCase('es')).length;

/**
 * `campo → slug → { usos, crudo }` sobre todas las actividades.
 *
 * `crudo` es **la variante más escrita** de ese slug —«Casa Brandon» y no
 * «casa brandon », si la primera aparece en más actividades—, y a igualdad, la
 * de más mayúsculas: entre «casa brandon» y «Casa Brandon», la segunda es la que
 * alguien escribió con cuidado. Si también empatan, la primera que apareció. Es la etiqueta que se propone: con 266 organizadores y
 * variantes de tipeo que el slug junta, quedarse con la primera que aparece
 * dependería del orden de lectura.
 *
 * @param {readonly any[]} actividades
 * @param {readonly string[]} [campos]
 */
export const usosPorCampo = (actividades, campos = CAMPOS) => {
  /** @type {Record<string, Map<string, { usos: number, variantes: Map<string, number> }>>} */
  const conteo = Object.fromEntries(campos.map((c) => [c, new Map()]));
  for (const a of actividades) {
    for (const campo of campos) {
      for (const [slug, crudo] of usadosEn(a, campo)) {
        const previo = conteo[campo].get(slug) ?? { usos: 0, variantes: new Map() };
        const variante = crudo.trim().replace(/\s+/g, ' ');
        if (variante) previo.variantes.set(variante, (previo.variantes.get(variante) ?? 0) + 1);
        conteo[campo].set(slug, { usos: previo.usos + 1, variantes: previo.variantes });
      }
    }
  }
  return Object.fromEntries(
    campos.map((c) => [
      c,
      new Map(
        [...conteo[c]].map(([slug, { usos, variantes }]) => {
          let crudo = '';
          let max = 0;
          for (const [v, n] of variantes) {
            if (n > max || (n === max && mayusculas(v) > mayusculas(crudo))) [crudo, max] = [v, n];
          }
          return [slug, { usos, crudo }];
        }),
      ),
    ]),
  );
};

/**
 * Los valores a agregar a `/opciones/{campo}`: lo que se usa y no está, con su
 * `usos` real, ordenado por uso.
 *
 * `orden: 99` es el de «Otro» (§4.1): el orden real lo da `usos`. `aprobada:
 * true` porque ya están en actividades que alguien cargó; dejarlas pendientes las
 * escondería del desplegable de los demás (§4.3) justo a las más usadas. Sin
 * `huellaCreador`: nadie las tipeó, se derivan del catálogo.
 *
 * @param {Map<string, { usos: number, crudo: string }>} usos
 * @param {readonly { slug: string }[]} existentes
 */
export const valoresNuevos = (usos, existentes) => {
  const conocidos = new Set(existentes.map((v) => v.slug));
  return [...usos]
    .filter(([slug]) => !conocidos.has(slug))
    .sort((a, b) => b[1].usos - a[1].usos)
    .map(([slug, { usos: n, crudo }]) => ({
      slug,
      label: etiquetaPresentable(crudo || slug),
      orden: 99,
      fijo: false,
      usos: n,
      aprobada: true,
    }));
};
