/**
 * **Las páginas de organizador** — `/organiza/{slug}`. Roadmap 1.5, B-2172 paso 4
 * (D-723 punto 8: el modelo completo, decisión del dueño del 2026-09-28).
 *
 * ── Para qué ──────────────────────────────────────────────────────────────
 * «Todo lo de Hormiga Libros» en una URL: lo que viene y lo que ya hizo. Es la
 * respuesta a quien busca a una casa por su nombre, y el lugar al que lleva el
 * link del detalle de cada actividad.
 *
 * ── Por qué no es una clase más de `hubsPublicos.ts` ──────────────────────
 * Un hub es **un chip de la home hecho página** (`filtrosDelHub` → `filtrarPublico`)
 * que muestra lo vigente, entra a la tira «Explorá por» y se arma con las opciones
 * **del índice**. El organizador no cumple ninguna de las tres:
 *
 *  - no es un eje del filtro de la home, así que no hay chip que convertir;
 *  - la página muestra **también lo que ya pasó**: de una casa importa qué hace,
 *    no solo qué tiene esta semana, y con 267 organizadores casi todos tienen una
 *    o dos actividades;
 *  - 267 enlaces no entran en la tira, y su lista no viaja en el índice
 *    (`TAXONOMIAS_FUERA_DEL_INDICE`): un organizador suele ser una persona y la
 *    lista incluye borradores. El build la lee con el Admin SDK.
 *
 * Lo que **sí** hereda, y es lo que importa, son las dos defensas de un hub:
 *
 *  1. **Se emite solo para una opción aprobada con alguna actividad publicada.**
 *     «Ofrecer un hub es publicar vocabulario, y un valor recién tipeado puede
 *     ser un typo: un typo con página propia es una URL indexada para siempre.»
 *     Un organizador que alguien tipeó y nadie aprobó no tiene página, y el dueño
 *     apaga una desde Opciones sin tocar código (B-2178: «A conf», «Buscando»).
 *  2. **Sitemap si y solo si no lleva `noindex`**, y se indexa si tiene algo por
 *     venir. Una página con solo lo que ya pasó se emite igual —su URL no puede
 *     volverse un 404 el día que termina la última actividad— pero con `noindex`.
 *
 * ── Es una salida pública (la 11, con los hubs) ───────────────────────────
 * Su entrada es `EntradaDeIndice`, la proyección más angosta del repo, así que
 * **solo puede sacar**. El nombre sale de la entrada (`organizador`, ya resuelto
 * contra la opción por `nombreDeOrganizador`) y **no** de la lista privada: la
 * página no muestra nada que el detalle de sus actividades no muestre ya. Lo
 * nuevo son las frases, que interpolan títulos: por eso tiene su barrido,
 * `tests/salidas/11-paginas-de-organizador.test.ts`.
 *
 * Puro: recibe las entradas, las opciones y `ahora`.
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { ORDEN_PUBLICO_POR_DEFECTO, estadoDe, ordenarPublico } from '@/lib/listadoPublico';
import { pasadasDelSitio } from '@/lib/pasadasPublicas';
import { rutaDeOrganizador } from '@/lib/rutasPublicas';
import {
  contactoDeOrganizador,
  type ActividadConOrganizador,
  type ContactoDeOrganizador,
} from '@/lib/contactoDeOrganizador';
import { estaAprobada } from '@/lib/taxonomia';
import type { ValorOpcion } from '@/types/actividad';

// El contacto (Instagram y web) vive en su módulo, compartido con el panel
// (roadmap 2.6). Se reexporta para no cambiarle el import a nadie.
export {
  contactoDeOrganizador,
  type ActividadConOrganizador,
  type ContactoDeOrganizador,
  type EnlaceDeContacto,
} from '@/lib/contactoDeOrganizador';

export interface PaginaDeOrganizador {
  /** El slug de `/opciones/organizador`: lo que direcciona (trampa 10). */
  slug: string;
  ruta: string;
  /** Cómo se llama, tal como lo muestra el detalle de sus actividades. */
  nombre: string;
  /** Lo que tiene por venir, en el orden de la home. */
  proximas: EntradaDeIndice[];
  /** Lo que ya pasó, de lo más reciente a lo más viejo (el orden de `/pasadas`). */
  pasadas: EntradaDeIndice[];
  /** ¿Se indexa, y por lo tanto entra al sitemap? Si tiene algo por venir. */
  indexable: boolean;
  /** El `<h1>`, y la primera mitad del `<title>`. */
  titulo: string;
  /** La `meta description`. */
  descripcion: string;
  /** El párrafo de debajo del `h1`. */
  bajada: string;
  /** Qué dice cuando no hay nada por venir. */
  avisoSinProximas: string;
  /** Su Instagram y su web, si sus actividades los traen y se pueden enlazar. */
  contacto: ContactoDeOrganizador;
}

/** Cuántos títulos entran en la `meta description`: el corte de los hubs (§5.1). */
const CUANTOS_TITULOS = 3;

const cuantas = (n: number): string => `${n} ${n === 1 ? 'actividad' : 'actividades'}`;

/**
 * Los slugs con página: **aprobados** en `/opciones/organizador` y usados por
 * alguna actividad publicada, vigente o pasada. En orden alfabético de slug, que
 * no se reacomoda solo de un build a otro.
 */
export const slugsConPaginaDeOrganizador = (
  entradas: readonly EntradaDeIndice[],
  opciones: readonly ValorOpcion[],
): string[] => {
  const usados = new Set(entradas.map((e) => e.organizadorSlug).filter(Boolean));
  return opciones
    // B-2179 — `sinPagina`: lo pidió la persona o lo decidió el dueño.
    .filter((o) => estaAprobada(o) && !o.sinPagina && usados.has(o.slug))
    .map((o) => o.slug)
    .sort();
};

/** Las frases de la página. Una función, para que el barrido las cubra todas. */
const frases = (
  nombre: string,
  proximas: readonly EntradaDeIndice[],
  pasadas: readonly EntradaDeIndice[],
): Pick<PaginaDeOrganizador, 'titulo' | 'descripcion' | 'bajada' | 'avisoSinProximas'> => {
  const titulos = proximas
    .slice(0, CUANTOS_TITULOS)
    .map((e) => e.titulo)
    .join(', ');
  return {
    titulo: `Actividades de ${nombre}`,
    /*
     * Con nada por venir la cuenta no se escribe —«0 actividades con fecha
     * próxima» se lee como un error—, y se dice cuántas hubo: es lo que la página
     * tiene para mostrar. Casi nunca se ve (la página lleva `noindex`), salvo en el
     * `og:description` de un link pegado en un chat.
     */
    descripcion: proximas.length
      ? `${cuantas(proximas.length)} de ${nombre} con fecha próxima: ${titulos}.`
      : `Lo que ${nombre} organizó en la agenda literaria: ${cuantas(pasadas.length)} que ya pasaron.`,
    bajada:
      `Lo que organiza ${nombre}, tal como se publicó en la agenda: primero lo que viene ` +
      'y abajo lo que ya pasó, que muchas veces vuelve.',
    avisoSinProximas: `Ahora no hay nada de ${nombre} con fecha próxima.`,
  };
};

/** La página de un organizador. `null` si ninguna entrada es suya. */
export const paginaDeOrganizador = (
  slug: string,
  entradas: readonly EntradaDeIndice[],
  ahora: Date,
  actividades: readonly ActividadConOrganizador[] = [],
): PaginaDeOrganizador | null => {
  const suyas = entradas.filter((e) => e.organizadorSlug === slug);
  const nombre = suyas.find((e) => e.organizador.trim())?.organizador.trim();
  if (!nombre) return null;
  const proximas = ordenarPublico(
    suyas.filter((e) => !estadoDe(e, ahora).paso),
    ORDEN_PUBLICO_POR_DEFECTO,
    ahora,
  );
  const pasadas = pasadasDelSitio(suyas, ahora);
  return {
    slug,
    ruta: rutaDeOrganizador(slug),
    nombre,
    proximas,
    pasadas,
    indexable: proximas.length > 0,
    ...frases(nombre, proximas, pasadas),
    contacto: contactoDeOrganizador(slug, actividades),
  };
};

/** Todas las páginas que el build emite. */
export const paginasDeOrganizador = (
  entradas: readonly EntradaDeIndice[],
  opciones: readonly ValorOpcion[],
  ahora: Date,
  actividades: readonly ActividadConOrganizador[] = [],
): PaginaDeOrganizador[] =>
  slugsConPaginaDeOrganizador(entradas, opciones)
    .map((slug) => paginaDeOrganizador(slug, entradas, ahora, actividades))
    .filter((p): p is PaginaDeOrganizador => p !== null);

/** Una fila de «Quién organiza». */
export interface OrganizadorDelIndice {
  nombre: string;
  ruta: string;
  /** Cuántas actividades tiene por venir. */
  porVenir: number;
}

/**
 * **«Quién organiza»** — el índice `/organiza/` (2026-10-06): todas las páginas de
 * organizador, en orden alfabético del nombre (en castellano: los acentos y las
 * mayúsculas no desordenan). Es el enlace interno que les faltaba a las páginas de
 * organizador además del «Todo lo de…» de cada actividad.
 *
 * Sale de las mismas páginas que el build emite (`paginasDeOrganizador`), así que
 * no puede listar una que no existe.
 */
export const indiceDeOrganizadores = (
  paginas: readonly PaginaDeOrganizador[],
): OrganizadorDelIndice[] =>
  paginas
    .map((p) => ({ nombre: p.nombre, ruta: p.ruta, porVenir: p.proximas.length }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
