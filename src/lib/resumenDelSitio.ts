/**
 * El resumen de la analítica del sitio, **leído desde el panel** — B-374 (GA4)
 * y B-373 (Search Console). Arquitectura en `docs/16-analitica-del-sitio.md`
 * §9.
 *
 * Lo escribe `functions/analitica-trigger.js` en `sistema/analitica-sitio` una
 * vez por día; acá se lo interpreta para la pantalla. Es puro: no lee
 * Firestore, no sabe de React, y por eso se puede testear caso por caso —
 * incluida la parte que más importa, que es **qué pasa cuando no hay datos**.
 *
 * ── Lo que este módulo existe para garantizar ──────────────────────────────
 *
 * **D-272, la decisión de la pestaña «El sitio público»: estado vacío honesto,
 * ni un número inventado.** El andamiaje de B-502 lo cumplía por construcción,
 * porque no leía nada. Con datos de verdad entrando, el riesgo cambia de forma:
 * ahora hay cuatro situaciones que se ven parecidas en la pantalla y son
 * completamente distintas, y confundir dos es exactamente cómo un tablero
 * empieza a mentir.
 *
 * | Situación | Qué significa | Qué tiene que decir la pantalla |
 * |---|---|---|
 * | `sin-documento` | la Function nunca corrió (no está desplegada, o es su primer día) | «esto todavía no está conectado», y qué falta |
 * | `sin-configurar` | corrió, y le falta el `propertyId` o el sitio de Search Console | «falta un paso de consola», y **cuál** |
 * | `falla` | corrió y la API dijo no (permiso, cuota, property equivocada) | que hay un problema y de qué fecha es el último dato bueno |
 * | `sin-datos` | corrió, la API contestó bien, y **el número es cero** | «todavía no hay volumen», con la fecha desde la que se mide |
 *
 * La última es la que un tablero corriente muestra como «0 visitas», y es la
 * que motivó D-272: un cero durante tres semanas parece un tablero roto, y el
 * dueño no puede distinguirlo de un enganche que no funciona.
 *
 * ── Y por qué se valida en vez de confiar ──────────────────────────────────
 * El documento lo escribió **otro deploy**, tal vez de otra versión (`version`
 * en el documento). Es la clase de bug de B-580: un campo que se agrega después
 * deja los documentos viejos sin él, y la pantalla lo lee como `undefined` y
 * dibuja un hueco. Así que nada de castear: cada campo se lee con un lector que
 * devuelve un default seguro, y lo que no se pueda interpretar cuenta como
 * ausente y no como cero.
 */
import { MESES } from '@/lib/meses';

/** La ventana que el resumen mira, en claves de día (`2026-09-17`). */
export interface VentanaDelResumen {
  desde: string;
  hasta: string;
}

/** Un número con su variación contra la ventana anterior. `null` = sin comparación. */
export interface MetricaConVariacion {
  valor: number;
  variacion: number | null;
}

export interface FilaDeRanking {
  clave: string;
  valor: number;
}

export interface FilaDeBusqueda {
  clave: string;
  clics: number;
  impresiones: number;
  /** Fracción, no porcentaje: `0.0437`. El formateo es de la pantalla. */
  ctr: number;
  posicion: number;
}

/**
 * En qué situación está una de las dos mitades.
 *
 * `sin-configurar` sale de `falla` y no es un estado que escriba la Function:
 * se **deriva** del motivo. Vale la pena separarlo porque las dos acciones son
 * distintas —una es cargar una variable de entorno y desplegar, la otra es
 * mirar un log— y porque «sin configurar» no es un error del que haya que
 * preocuparse: es el estado normal hasta que el dueño hace su paso de consola.
 */
export type SituacionDeFuente = 'sin-documento' | 'sin-configurar' | 'falla' | 'sin-datos' | 'ok';

export interface ResumenGa4 {
  situacion: SituacionDeFuente;
  /** Solo con `falla`: qué dijo la API, ya recortado. */
  motivo: string | null;
  ventana: VentanaDelResumen | null;
  /** El primer día con datos, o `null` si todavía no hay ninguno. */
  desdeCuando: string | null;
  sesiones: MetricaConVariacion | null;
  personas: MetricaConVariacion | null;
  vistas: MetricaConVariacion | null;
  paginas: FilaDeRanking[];
  canales: FilaDeRanking[];
  dispositivos: FilaDeRanking[];
  /** `nombre → cuenta`, con las tres claves siempre (la Function las rellena). */
  eventos: Record<string, number>;
}

export interface ResumenSearchConsole {
  situacion: SituacionDeFuente;
  motivo: string | null;
  ventana: VentanaDelResumen | null;
  /** Del top 10, no del sitio — el nombre lo dice a propósito. */
  clicsEnElTope: number;
  impresionesEnElTope: number;
  busquedas: FilaDeBusqueda[];
  paginas: FilaDeBusqueda[];
}

export interface ResumenDelSitio {
  /** Cuándo corrió la Function, en ISO, o `null` si nunca corrió. */
  generadoEn: string | null;
  ga4: ResumenGa4;
  searchConsole: ResumenSearchConsole;
}

// ─────────────────────────────────────────────────────────────────
// Lectores seguros
// ─────────────────────────────────────────────────────────────────

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Un número, o `0`.
 *
 * **No acepta strings.** El documento lo escribió `analitica.js`, que ya
 * convirtió las métricas de GA4 (que sí vienen como string) a números: si acá
 * llega un string, algo se rompió aguas arriba y aceptarlo taparía el bug. Lo
 * mismo con `NaN`, que además no sobrevive a Firestore.
 */
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Un string con contenido, o `null`. */
const texto = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

/**
 * Cuánto del motivo de una falla se muestra.
 *
 * Los mensajes de las dos APIs son largos y a veces traen el pedido entero
 * repetido. La pantalla necesita reconocer el problema, no auditarlo: el
 * detalle completo está en el log de la Function, que además es donde va la
 * respuesta cruda (que al documento no llega nunca, a propósito).
 */
export const MAX_MOTIVO = 200;

const motivoDe = (v: unknown): string | null => {
  const t = texto(v);
  if (!t) return null;
  return t.length <= MAX_MOTIVO ? t : `${t.slice(0, MAX_MOTIVO - 1)}…`;
};

const ventanaDe = (v: unknown): VentanaDelResumen | null => {
  if (!esObjeto(v)) return null;
  const desde = texto(v.desde);
  const hasta = texto(v.hasta);
  return desde && hasta ? { desde, hasta } : null;
};

const metricaDe = (v: unknown): MetricaConVariacion => ({
  valor: esObjeto(v) ? num(v.valor) : 0,
  // `variacion` es `null` a propósito cuando la ventana anterior fue cero
  // (el primer mes de medición entero), así que un `null` acá es un dato y no
  // una ausencia: se conserva tal cual.
  variacion: esObjeto(v) && typeof v.variacion === 'number' && Number.isFinite(v.variacion)
    ? v.variacion
    : null,
});

const rankingDe = (v: unknown): FilaDeRanking[] =>
  Array.isArray(v)
    ? v
        .filter(esObjeto)
        .map((f) => ({ clave: texto(f.clave) ?? '(sin dato)', valor: num(f.valor) }))
    : [];

const busquedasDe = (v: unknown): FilaDeBusqueda[] =>
  Array.isArray(v)
    ? v.filter(esObjeto).map((f) => ({
        clave: texto(f.clave) ?? '(sin dato)',
        clics: num(f.clics),
        impresiones: num(f.impresiones),
        ctr: num(f.ctr),
        posicion: num(f.posicion),
      }))
    : [];

const eventosDe = (v: unknown): Record<string, number> =>
  esObjeto(v) ? Object.fromEntries(Object.entries(v).map(([k, n]) => [k, num(n)])) : {};

/**
 * Un motivo de falla que en realidad es «falta un paso de consola».
 *
 * Se reconoce por la frase que la propia Function escribe («… sin
 * configurar»), y no por adivinar sobre el mensaje de Google: los dos motivos
 * que la Function produce sin llamar a nadie son literales de
 * `analitica-trigger.js`.
 */
const esSinConfigurar = (motivo: string | null): boolean =>
  motivo !== null && /sin configurar/i.test(motivo);

const situacionDe = (rama: Record<string, unknown> | null, hayDatos: boolean, motivo: string | null): SituacionDeFuente => {
  if (!rama) return 'sin-documento';
  if (rama.estado !== 'ok') return esSinConfigurar(motivo) ? 'sin-configurar' : 'falla';
  return hayDatos ? 'ok' : 'sin-datos';
};

// ─────────────────────────────────────────────────────────────────
// La lectura
// ─────────────────────────────────────────────────────────────────

/** El resumen vacío, que es lo que la pantalla dibuja antes del primer dato. */
const SIN_DOCUMENTO: ResumenDelSitio = {
  generadoEn: null,
  ga4: {
    situacion: 'sin-documento',
    motivo: null,
    ventana: null,
    desdeCuando: null,
    sesiones: null,
    personas: null,
    vistas: null,
    paginas: [],
    canales: [],
    dispositivos: [],
    eventos: {},
  },
  searchConsole: {
    situacion: 'sin-documento',
    motivo: null,
    ventana: null,
    clicsEnElTope: 0,
    impresionesEnElTope: 0,
    busquedas: [],
    paginas: [],
  },
};

/**
 * Interpreta el documento de `sistema/analitica-sitio`.
 *
 * `null`/`undefined` —el documento no existe— y un documento que no se puede
 * interpretar dan lo mismo: `sin-documento` en las dos mitades. Es deliberado:
 * la acción del dueño es la misma en los dos casos (desplegar la Function y
 * esperar el primer tick), y distinguirlos en la pantalla sería una tercera
 * frase que nadie puede accionar distinto.
 */
export const leerResumenDelSitio = (doc: unknown): ResumenDelSitio => {
  if (!esObjeto(doc)) return SIN_DOCUMENTO;

  const ga4Crudo = esObjeto(doc.ga4) ? doc.ga4 : null;
  const scCrudo = esObjeto(doc.searchConsole) ? doc.searchConsole : null;

  const motivoGa4 = motivoDe(ga4Crudo?.motivo);
  const motivoSc = motivoDe(scCrudo?.motivo);

  return {
    generadoEn: texto(doc.generadoEn),
    ga4: {
      situacion: situacionDe(ga4Crudo, ga4Crudo?.hayDatos === true, motivoGa4),
      motivo: motivoGa4,
      ventana: ventanaDe(ga4Crudo?.ventana),
      desdeCuando: texto(ga4Crudo?.desdeCuando),
      /*
       * Las tres métricas son `null` cuando no hay documento o la fuente
       * falló, y **no `{valor: 0}`**: un cero es un dato («nadie entró en 28
       * días») y la pantalla lo escribe; una métrica ausente es «no sabemos», y
       * escribir «0 visitas» ahí es la mentira que D-272 vino a evitar.
       */
      sesiones: ga4Crudo?.estado === 'ok' ? metricaDe(ga4Crudo.sesiones) : null,
      personas: ga4Crudo?.estado === 'ok' ? metricaDe(ga4Crudo.personas) : null,
      vistas: ga4Crudo?.estado === 'ok' ? metricaDe(ga4Crudo.vistas) : null,
      paginas: rankingDe(ga4Crudo?.paginas),
      canales: rankingDe(ga4Crudo?.canales),
      dispositivos: rankingDe(ga4Crudo?.dispositivos),
      eventos: eventosDe(ga4Crudo?.eventos),
    },
    searchConsole: {
      situacion: situacionDe(scCrudo, scCrudo?.hayDatos === true, motivoSc),
      motivo: motivoSc,
      ventana: ventanaDe(scCrudo?.ventana),
      clicsEnElTope: num(scCrudo?.clicsEnElTope),
      impresionesEnElTope: num(scCrudo?.impresionesEnElTope),
      busquedas: busquedasDe(scCrudo?.busquedas),
      paginas: busquedasDe(scCrudo?.paginas),
    },
  };
};

// ─────────────────────────────────────────────────────────────────
// Formateo para la pantalla
// ─────────────────────────────────────────────────────────────────

/**
 * `2026-09-17` → `17 de septiembre`. Sin año, que en una ventana de 28 días es
 * ruido; el año entra solo si la ventana lo cruza (`periodoLegible`).
 *
 * **Se parsea la clave y no se hace `new Date('2026-09-17')`.** Ese constructor
 * interpreta una fecha sin hora como **UTC**, así que en Buenos Aires devuelve
 * el día anterior: es la trampa 1 del §13 y la clase de bug que este repo ya
 * arregló en `instanteDeIso`.
 *
 * Los doce nombres salen de `lib/meses.ts` y no se copian acá (B-215): no son
 * de ningún dominio, son un hecho del castellano, y dos copias son dos
 * acentos que se pueden arreglar en una sola.
 */
export const diaLegible = (clave: string | null, conAnio = false): string | null => {
  if (!clave || !/^\d{4}-\d{2}-\d{2}$/.test(clave)) return null;
  const [a, m, d] = clave.split('-').map(Number);
  const mes = MESES[(m ?? 1) - 1];
  if (!mes) return null;
  return conAnio ? `${d} de ${mes} de ${a}` : `${d} de ${mes}`;
};

/** «del 17 de septiembre al 14 de octubre de 2026». */
export const periodoLegible = (ventana: VentanaDelResumen | null): string | null => {
  if (!ventana) return null;
  const desde = diaLegible(ventana.desde);
  const hasta = diaLegible(ventana.hasta, true);
  return desde && hasta ? `del ${desde} al ${hasta}` : null;
};

/** `+37 %` / `−27 %` / `null` cuando no hay con qué comparar. */
export const variacionLegible = (v: number | null): string | null => {
  if (v === null) return null;
  // Signo menos tipográfico (U+2212) y no un guion: es el mismo criterio que
  // el sistema visual usa para los números.
  if (v === 0) return 'igual';
  return v > 0 ? `+${v} %` : `−${Math.abs(v)} %`;
};

/** `0.0437` → `4,4 %`. Coma decimal, que es la del idioma del proyecto. */
export const ctrLegible = (ctr: number): string =>
  `${(Math.round(ctr * 1000) / 10).toFixed(1).replace('.', ',')} %`;
