// `Eje` es **solo tipo**: un `import type` no deja rastro en el bundle (se
// borra en la compilación), así que esto no es la importación que el
// comentario de `EJES_MEDIBLES` más abajo dice evitar — esa es la de
// `EJES` como *valor*, que sí arrastraría el motor de filtrado entero.
import type { Eje } from '@/lib/listadoPublico';
import { VIAS_INSCRIPCION, type ViaInscripcion } from '@/types/actividad';

/**
 * La analítica del **sitio público** — B-372 y B-375, arquitectura en
 * `docs/16-analitica-del-sitio.md`.
 *
 * Es el mismo criterio que `analytics-eventos.ts` del panel (D-201, §5.4 de ese
 * documento): **no se manda el objeto, se manda una proyección deliberada.**
 * Pero la proyección **no se hereda** — el sitio público no importa nada del
 * panel — así que este archivo es una implementación propia, con sus propios
 * vocabularios y su propio saneador.
 *
 * Puro y sin DOM: nada de acá toca `window`, `document` ni `localStorage`. Eso
 * vive en `medicionSitio.ts`, que es el único que puede fallar por un ad
 * blocker o un `localStorage` bloqueado — acá todo es determinístico y
 * testeable sin un navegador.
 */

// ── Consentimiento ──────────────────────────────────────────────────
//
// §7 del diseño: se eligió C3, un banner con «aceptar» o «rechazar» al mismo
// nivel visual. La preferencia se guarda **en el navegador de cada uno**, no
// en Firestore — no hay nada que guardar del lado nuestro, y el §4 de
// `07-seguridad.md` es explícito en que del público no se guarda nada.

export type Consentimiento = 'aceptado' | 'rechazado';
export type EstadoConsentimiento = Consentimiento | 'sin-decidir';

/** La clave de `localStorage`. Un solo valor, nunca un objeto: no hay nada más
 * que preguntar. */
export const CLAVE_CONSENTIMIENTO = 'agenda:consentimiento-analitica';

/** La forma mínima de `localStorage` que este módulo necesita, para poder
 * testear sin un navegador y sin mockear el global entero. */
export interface AlmacenConsentimiento {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** Lee la preferencia guardada. Cualquier valor que no sea exactamente uno de
 * los dos que este módulo escribe cuenta como «sin decidir» — un valor
 * corrompido o de una versión vieja del banner no se interpreta como
 * aceptación. */
export const leerConsentimiento = (almacen: AlmacenConsentimiento): EstadoConsentimiento => {
  const valor = almacen.getItem(CLAVE_CONSENTIMIENTO);
  return valor === 'aceptado' || valor === 'rechazado' ? valor : 'sin-decidir';
};

export const guardarConsentimiento = (
  almacen: AlmacenConsentimiento,
  valor: Consentimiento,
): void => {
  almacen.setItem(CLAVE_CONSENTIMIENTO, valor);
};

/**
 * ¿Hay que mostrar el banner? Solo mientras nadie decidió. Una vez que hay una
 * respuesta —cualquiera de las dos— el banner no vuelve a interrumpir solo:
 * la forma de revisar la decisión es el control de reabrir, nunca el banner
 * insistiendo.
 */
export const debeMostrarBanner = (estado: EstadoConsentimiento): boolean =>
  estado === 'sin-decidir';

/**
 * ¿Se puede cargar el tag? Solo con `'aceptado'`. **Nunca `'sin-decidir'`**:
 * es la regla que más importa de todo este archivo — «hasta que la persona
 * decide, no se mide» — y por eso no hay un tercer camino ni un modo
 * «mientras tanto, sin cookies»: acá no se instala Consent Mode, se instala o
 * no se instala.
 */
export const debeCargarGA = (estado: EstadoConsentimiento): boolean => estado === 'aceptado';

/**
 * Los cuatro portones para que salga un byte hacia GA4, en la misma forma que
 * `debeMedir` del panel (`analytics-eventos.ts`) más un cuarto: el
 * consentimiento. **Los cuatro tienen que abrir.**
 *
 * 1. Estamos en un navegador (el build de Astro corre en Node).
 * 2. No están los emuladores (`PUBLIC_USE_EMULATORS=true`): igual que el
 *    panel, para que correr los tests o el dev server no contamine datos
 *    reales.
 * 3. Hay un `measurementId` configurado.
 * 4. **El consentimiento es exactamente `'aceptado'`.** No `'sin-decidir'`,
 *    no `'rechazado'`.
 *
 * Puro y con los cuatro argumentos explícitos, para poder testear las
 * combinaciones sin tocar `import.meta.env` ni `localStorage` — el mismo
 * motivo que ya tenía `debeMedir`.
 */
export const debeMedirSitio = (entorno: {
  navegador: boolean;
  emuladores: boolean;
  measurementId?: string;
  consentimiento: EstadoConsentimiento;
}): boolean =>
  entorno.navegador &&
  !entorno.emuladores &&
  Boolean(entorno.measurementId?.trim()) &&
  entorno.consentimiento === 'aceptado';

// ── El invariante del §5.3: la URL que se manda nunca lleva la query ────
//
// El `page_view` automático de gtag.js manda `page_location` con la URL
// completa. La island de filtros escribe el texto del buscador en la query
// (`?q=...`, `aQuery` en `listadoPublico.ts`), así que sin este recorte lo que
// alguien tipeó en el buscador de un sitio de actividades literarias se
// convertiría en telemetría hacia un tercero — exactamente lo que §5.3 de
// `docs/16-analitica-del-sitio.md` pide verificar.
//
// Se recorta la query **entera**, no un parámetro a la vez: es más simple, es
// más fácil de auditar sin tener que enumerar cuáles ejes son sensibles hoy, y
// no depende de acordarse de sumar un eje nuevo el día que se agregue uno.

/**
 * `page_location` sin query ni hash. Es la única forma en la que este módulo
 * deja escapar una URL hacia GA4.
 */
export const ubicacionSinQuery = (href: string): string => {
  const url = new URL(href);
  return `${url.origin}${url.pathname}`;
};

// ── Vocabulario de los eventos propios (B-375) ──────────────────────
//
// La misma regla que el panel (§5.4 del diseño): vocabulario cerrado, sin
// sanitizador de texto libre. Nunca el texto del buscador, nunca el destino de
// inscripción — solo la vía y el eje/slug de un filtro, que son enums y slugs
// de taxonomía.

/** Valor de reemplazo cuando un string no está en su vocabulario. */
export const FUERA_DE_VOCABULARIO_SITIO = 'otro';

/**
 * Los ejes de filtro medibles. **Copiado, no importado en runtime, a
 * propósito** — la misma decisión que `CAMPOS_VALIDABLES` en el panel
 * (`analytics-eventos.ts`): importar `@/lib/listadoPublico` acá arrastraría
 * todo el motor de filtrado al chunk que carga en **todas** las páginas (el
 * banner vive en `Base.astro`), y esa es justamente la página de detalle cuyo
 * peso este frente se comprometió a medir.
 *
 * La garantía de que esta lista no se desactualice en silencio se mueve al
 * test: `tests/analyticsSitio.test.ts` importa `EJES` de `listadoPublico.ts` y
 * falla si difiere de esta copia.
 */
const EJES_MEDIBLES = ['tipo', 'arancel', 'modalidad', 'barrio', 'ciudad', 'tag'] as const;

/** Formato de un slug de taxonomía — el que produce `slugify()`. Rechaza
 * cualquier cosa con mayúsculas, acentos o espacios, que es exactamente lo que
 * el texto de un buscador tendría y un slug nunca tiene. */
const FORMATO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Tope de una lista de slugs ya unida, como en el panel. */
const MAX_TEXTO_SITIO = 100;

type SanitizadorSitio = { tipo: 'enum'; valores: readonly string[] } | { tipo: 'lista-slugs' };

const recortarListaSitio = (unida: string): string => {
  if (unida.length <= MAX_TEXTO_SITIO) return unida;
  const corte = unida.lastIndexOf(',', MAX_TEXTO_SITIO);
  return corte > 0 ? unida.slice(0, corte) : unida.slice(0, MAX_TEXTO_SITIO);
};

const sanitizarSitio = (san: SanitizadorSitio, valor: unknown): string | undefined => {
  switch (san.tipo) {
    case 'enum':
      return typeof valor === 'string' && san.valores.includes(valor)
        ? valor
        : FUERA_DE_VOCABULARIO_SITIO;
    case 'lista-slugs': {
      if (!Array.isArray(valor)) return undefined;
      const limpios = valor.filter(
        (v): v is string => typeof v === 'string' && FORMATO_SLUG.test(v),
      );
      if (limpios.length === 0) return undefined;
      return recortarListaSitio([...new Set(limpios)].sort().join(','));
    }
  }
};

type EspecificacionSitio = Record<string, SanitizadorSitio>;

/**
 * Los dos eventos propios de la mitad **b** (§4, §9 del diseño). Ninguno lleva
 * contenido: el clic de inscripción manda la **vía**, nunca el destino (un
 * mail o un teléfono); el filtro sin resultados manda el **eje** y el
 * **slug**, nunca el texto del buscador.
 */
export const EVENTOS_SITIO = {
  /** ¿Cuántos llegan a escribirle al organizador? El único número que dice si
   * el sitio sirve (pregunta 5 del §3). */
  clic_inscripcion: {
    via: { tipo: 'enum', valores: VIAS_INSCRIPCION },
  },
  /** ¿Qué filtro deja cero, y cuál sacar? (pregunta 6 y fricción 7 del §4).
   * Sin `eje`/`slug` cuando el cero no se explica por un único eje — sigue
   * siendo una señal válida: «hubo un cero que ninguna combinación de un solo
   * eje arregla». */
  filtro_sin_resultados: {
    eje: { tipo: 'enum', valores: EJES_MEDIBLES },
    slug: { tipo: 'lista-slugs' },
  },
} satisfies Record<string, EspecificacionSitio>;

export type NombreEventoSitio = keyof typeof EVENTOS_SITIO;
export const NOMBRES_EVENTOS_SITIO = Object.keys(EVENTOS_SITIO) as NombreEventoSitio[];

export interface EventoMedidoSitio {
  nombre: string;
  params: Record<string, string>;
}

/**
 * Arma el payload de un evento del sitio a partir de valores crudos.
 *
 * Whitelist en las dos direcciones, igual que `construirEvento` del panel: un
 * nombre no declarado no manda nada, y un parámetro no declarado en ese evento
 * se descarta. Lo que queda pasa por su saneador y nunca es texto libre.
 */
export const construirEventoSitio = (
  nombre: string,
  crudos: Record<string, unknown> = {},
): EventoMedidoSitio | null => {
  const spec = (EVENTOS_SITIO as Record<string, EspecificacionSitio>)[nombre];
  if (!spec) return null;
  const params: Record<string, string> = {};
  for (const [param, san] of Object.entries(spec)) {
    if (crudos[param] === undefined || crudos[param] === null) continue;
    const valor = sanitizarSitio(san, crudos[param]);
    if (valor !== undefined) params[param] = valor;
  }
  return { nombre, params };
};

// Reexportados para quien arme el evento de filtro sin resultados
// (`Buscador.tsx`, que igual ya importa `EJES` como *valor* de
// `listadoPublico.ts` para pintar los ejes — acá solo viaja el tipo) y el de
// inscripción (el detalle de la actividad).
export type { Eje, ViaInscripcion };
export { VIAS_INSCRIPCION };
