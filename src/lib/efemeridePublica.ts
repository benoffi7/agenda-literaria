/**
 * **Lo que el sitio publica de una efeméride** — B-959.
 *
 * Puro: sin Firestore, sin DOM y sin reloj propio (el «ahora» entra como
 * parámetro, `05-patrones.md` § «El reloj también es infraestructura»). Lo usan
 * el build —`/efemerides.json`, `/efemerides/` y cada `/efemerides/{slug}/`— y el
 * script de la home, que elige la del día en el navegador.
 *
 * ── La proyección es una whitelist propia, no genérica ───────────────────
 * > «`toPublic` por entidad, no genérico. La proyección es una whitelist y ahí
 * > está toda la seguridad de esto (…). **No hacerlo.**» — citado en
 * > `lib/directorios.ts`.
 *
 * `efemeridePublica` nombra cada campo que sale. `createdBy`/`updatedBy` son
 * uids (§5.1), `createdAt`/`updatedAt` y `publicadaAlgunaVez` son ciclo de vida,
 * y `estado` ya se usó para decidir si se lee: **ninguno sale**, y un campo que
 * mañana se agregue al documento tampoco, hasta que alguien lo escriba acá. Lo
 * afirma el barrido de centinelas de `tests/efemeride-publica.test.ts`.
 *
 * ── Por qué el cliente elige la del día ──────────────────────────────────
 * El contenido de «la efeméride de hoy» cambia **todos los días sin que nadie
 * edite nada**, y el sitio es estático. Un build diario para eso es un rebuild
 * por día para siempre. La salida es la del §2.5: el JSON las lleva todas y el
 * navegador elige — cero builds extra, cero lecturas de Firestore.
 */
import { claveDeDia } from '@/lib/fechasPublicas';
import { MESES } from '@/lib/meses';
import { NOMBRE } from '@/lib/identidad';
import { urlSegura } from '@/lib/enlaceSeguro';
import {
  RUTA_AGENDA,
  RUTA_EFEMERIDES,
  esSlugDeFicha,
  rutaDeEfemeride,
  urlAbsoluta,
} from '@/lib/rutasPublicas';
import { DIAS_POR_MES, type Efemeride } from '@/types/efemeride';

// ─────────────────────────────────────────────────────────────────
// La proyección
// ─────────────────────────────────────────────────────────────────

export interface EfemeridePublica {
  slug: string;
  titulo: string;
  descripcion: string;
  dia: number;
  mes: number;
  anio: number | null;
  /** `url` es `null` cuando no hay link o cuando el que había no es http(s). */
  fuente: { texto: string; url: string | null } | null;
}

/**
 * Los campos del **documento** que la proyección lee. La query del build los
 * pide con `.select()` (D-159: lo que no se pide no entra a la memoria del
 * runner de CI), y la guarda de rebuild de `functions/efemerides.js` compara
 * **estos mismos más `estado`** — `tests/efemeride-publica.test.ts` ata las tres
 * listas.
 */
export const CAMPOS_DE_LA_PROYECCION_EFEMERIDE = [
  'slug',
  'titulo',
  'descripcion',
  'dia',
  'mes',
  'anio',
  'fuente',
] as const;

const enteroEnRango = (n: unknown, min: number, max: number): number | null =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null;

/**
 * El documento → lo público, o `null` si no se puede publicar.
 *
 * **`null` y no una excepción**, por lo mismo que `esSlugDeFicha` en la Guía: un
 * solo documento raro —un slug que no pasó por `slugify`, un día fuera de rango
 * escrito a mano en la consola— no puede apagar el build entero. Se descarta ese
 * y se publica el resto.
 */
export const efemeridePublica = (
  e: Pick<Efemeride, (typeof CAMPOS_DE_LA_PROYECCION_EFEMERIDE)[number]>,
): EfemeridePublica | null => {
  const mes = enteroEnRango(e.mes, 1, 12);
  const dia = mes === null ? null : enteroEnRango(e.dia, 1, DIAS_POR_MES[mes - 1]!);
  if (!esSlugDeFicha(e.slug) || mes === null || dia === null) return null;
  const titulo = typeof e.titulo === 'string' ? e.titulo.trim() : '';
  if (!titulo) return null;

  const textoDeFuente = typeof e.fuente?.texto === 'string' ? e.fuente.texto.trim() : '';
  const urlDeFuente = urlSegura(typeof e.fuente?.url === 'string' ? e.fuente.url : '');

  return {
    slug: e.slug,
    titulo,
    descripcion: typeof e.descripcion === 'string' ? e.descripcion.trim() : '',
    dia,
    mes,
    anio: enteroEnRango(e.anio, 1, 9999),
    fuente: textoDeFuente || urlDeFuente ? { texto: textoDeFuente, url: urlDeFuente } : null,
  };
};

/**
 * El orden del año: enero antes que diciembre, el 1 antes que el 31, y dentro
 * del mismo día el hecho más viejo primero (los sin año, al final). El título
 * desempata para que dos builds den el mismo orden.
 */
type ParaOrdenar = Pick<EfemeridePublica, 'mes' | 'dia' | 'anio' | 'titulo'>;

export const ordenDelAnio = (a: ParaOrdenar, b: ParaOrdenar): number =>
  a.mes - b.mes ||
  a.dia - b.dia ||
  (a.anio ?? Number.MAX_SAFE_INTEGER) - (b.anio ?? Number.MAX_SAFE_INTEGER) ||
  a.titulo.localeCompare(b.titulo, 'es');

/** Lo que hace falta para decidir cuál de dos con el mismo slug se queda la página. */
type ConSlug = ParaOrdenar & Pick<EfemeridePublica, 'slug'>;

/**
 * El reparto de un slug repetido, en **una sola implementación** para el build
 * y para el panel — B-1943. El build se queda con `quedan`; el panel avisa con
 * `sinPagina`. Si cada lado ordenara por su cuenta, el aviso podría nombrar
 * como perdedora a la que el build publica.
 */
const partirPorSlug = <T extends ConSlug>(
  lista: readonly T[],
): { quedan: T[]; sinPagina: { perdida: T; ganadora: T }[] } => {
  const primera = new Map<string, T>();
  const quedan: T[] = [];
  const sinPagina: { perdida: T; ganadora: T }[] = [];
  for (const e of [...lista].sort(ordenDelAnio)) {
    const ganadora = primera.get(e.slug);
    if (ganadora) {
      sinPagina.push({ perdida: e, ganadora });
      continue;
    }
    primera.set(e.slug, e);
    quedan.push(e);
  }
  return { quedan, sinPagina };
};

/**
 * Una sola efeméride por slug, **la primera en el orden del año**.
 *
 * El panel frena el slug repetido, pero la consola no: dos documentos con el
 * mismo slug serían dos páginas pisándose en el build y dos entradas en el
 * índice (el «N más hoy» contaría una de más). Se resuelve una vez, en la
 * lectura, para que todas las salidas digan lo mismo.
 */
export const sinSlugsRepetidos = <T extends ConSlug>(lista: readonly T[]): T[] =>
  partirPorSlug(lista).quedan;

/**
 * **Las publicadas que el build deja sin página**, cada una con la que se quedó
 * el slug — B-1943.
 *
 * La guarda del panel (`slugPublicable`) lee y después escribe, sin
 * transacción: dos admins que publican a la vez con el mismo slug pasan los dos.
 * El build no se rompe —`sinSlugsRepetidos` deja una—, pero la otra quedaba sin
 * página y sin que nadie lo supiera. El panel escucha la colección entera, así
 * que con esta lista lo dice en cuanto pasa, en las pantallas de los dos.
 *
 * Recibe **solo las publicadas**: es lo que lee el build.
 */
export const publicadasSinPagina = <T extends ConSlug>(
  publicadas: readonly T[],
): { perdida: T; ganadora: T }[] => partirPorSlug(publicadas).sinPagina;

// ─────────────────────────────────────────────────────────────────
// Las fechas: día y mes, nunca un instante
// ─────────────────────────────────────────────────────────────────

/** `25 de septiembre`. Sin `Intl`: no hay instante que formatear, hay dos números. */
export const diaYMesDeEfemeride = (e: { dia: number; mes: number }): string =>
  `${e.dia} de ${MESES[e.mes - 1] ?? ''}`;

/** `25 de septiembre de 1914`, o `25 de septiembre` si no tiene año. */
export const fechaDeEfemeride = (e: { dia: number; mes: number; anio: number | null }): string =>
  e.anio === null ? diaYMesDeEfemeride(e) : `${diaYMesDeEfemeride(e)} de ${e.anio}`;

/** El ancla de un día en el listado: `dia-09-25`. */
export const anclaDelDia = (e: { dia: number; mes: number }): string =>
  `dia-${String(e.mes).padStart(2, '0')}-${String(e.dia).padStart(2, '0')}`;

const esBisiesto = (anio: number): boolean =>
  (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;

/**
 * Las efemérides de un **día calendario** (`AAAA-MM-DD`), en el orden del año.
 *
 * **El 29 de febrero, en un año que no lo tiene, se muestra el 28** — D-1172.
 * Sin esto, la efeméride de ese día aparecería una vez cada cuatro años, y el
 * renglón de la home existe para que se vea. Es un pliegue y no un cambio del
 * dato: la página de la efeméride sigue diciendo «29 de febrero».
 */
export const efemeridesDelDia = <T extends { dia: number; mes: number }>(
  lista: readonly T[],
  clave: string,
): T[] => {
  const [anio, mes, dia] = clave.split('-').map(Number) as [number, number, number];
  const pliegaElVeintinueve = mes === 2 && dia === 28 && !esBisiesto(anio);
  return lista.filter(
    (e) => e.mes === mes && (e.dia === dia || (pliegaElVeintinueve && e.dia === 29)),
  );
};

/**
 * Las de **hoy en Buenos Aires** (§14). `claveDeDia` formatea con la zona del
 * proyecto, así que un navegador con el reloj en Madrid a las 2 de la mañana del
 * 26 sigue viendo la del 25 mientras en Buenos Aires sea el 25 — la trampa 1,
 * del lado del cliente.
 */
export const efemeridesDeHoy = <T extends { dia: number; mes: number }>(
  lista: readonly T[],
  ahora: Date,
): T[] => efemeridesDelDia(lista, claveDeDia(ahora));

// ─────────────────────────────────────────────────────────────────
// El índice: `/efemerides.json`
// ─────────────────────────────────────────────────────────────────

/**
 * Lo mínimo para el renglón de la home: el título, el día, el año y el link.
 * **Sin la descripción ni la fuente**: el JSON lo baja toda persona que abre la
 * home, y el renglón no los usa. La página de cada efeméride sí los tiene, en su
 * HTML.
 */
export interface EntradaDeEfemeride {
  slug: string;
  titulo: string;
  dia: number;
  mes: number;
  anio: number | null;
}

export interface IndiceDeEfemerides {
  efemerides: EntradaDeEfemeride[];
}

export const entradaDeEfemeride = (e: EfemeridePublica): EntradaDeEfemeride => ({
  slug: e.slug,
  titulo: e.titulo,
  dia: e.dia,
  mes: e.mes,
  anio: e.anio,
});

export const construirIndiceDeEfemerides = (
  efemerides: readonly EfemeridePublica[],
): IndiceDeEfemerides => ({
  efemerides: [...efemerides].sort(ordenDelAnio).map(entradaDeEfemeride),
});

/**
 * ¿Lo que bajó el navegador tiene la forma del índice? El JSON es nuestro, pero
 * una pestaña abierta desde antes de un deploy puede leer otra versión: ante la
 * duda, el renglón no se muestra.
 */
export const entradasDelIndice = (crudo: unknown): EntradaDeEfemeride[] => {
  const lista = (crudo as { efemerides?: unknown } | null)?.efemerides;
  if (!Array.isArray(lista)) return [];
  return lista.filter(
    (e): e is EntradaDeEfemeride =>
      typeof e?.slug === 'string' &&
      esSlugDeFicha(e.slug) &&
      typeof e.titulo === 'string' &&
      Number.isInteger(e.dia) &&
      Number.isInteger(e.mes),
  );
};

// ─────────────────────────────────────────────────────────────────
// El renglón de la home
// ─────────────────────────────────────────────────────────────────

export interface RenglonDeHoy {
  titulo: string;
  href: string;
  /** «Un 25 de septiembre de 1914» o «Un 25 de septiembre». */
  cuando: string;
  /** Cuántas más hay hoy, y a dónde llevan. `null` si es una sola. */
  mas: { cuantas: number; href: string } | null;
}

/**
 * Qué dice el renglón, o `null` si hoy no hay ninguna — y entonces **no se
 * muestra nada**, ni un «hoy no hay efemérides» que ocupe lugar arriba del
 * listado.
 */
export const renglonDeHoy = (
  lista: readonly EntradaDeEfemeride[],
  ahora: Date,
): RenglonDeHoy | null => {
  const deHoy = [...efemeridesDeHoy(lista, ahora)].sort(
    (a, b) =>
      (a.anio ?? Number.MAX_SAFE_INTEGER) - (b.anio ?? Number.MAX_SAFE_INTEGER) ||
      a.titulo.localeCompare(b.titulo, 'es'),
  );
  const primera = deHoy[0];
  if (!primera) return null;
  return {
    titulo: primera.titulo,
    href: rutaDeEfemeride(primera.slug),
    cuando: `Un ${fechaDeEfemeride(primera)}`,
    mas:
      deHoy.length > 1
        ? { cuantas: deHoy.length - 1, href: `${RUTA_EFEMERIDES}#${anclaDelDia(primera)}` }
        : null,
  };
};

// ─────────────────────────────────────────────────────────────────
// Las páginas
// ─────────────────────────────────────────────────────────────────

export interface MesDeEfemerides {
  mes: number;
  nombre: string;
  efemerides: EfemeridePublica[];
}

/** El listado por mes, sin los meses vacíos. */
export const efemeridesPorMes = (lista: readonly EfemeridePublica[]): MesDeEfemerides[] => {
  const ordenadas = [...lista].sort(ordenDelAnio);
  return MESES.map((nombre, i) => ({
    mes: i + 1,
    nombre,
    efemerides: ordenadas.filter((e) => e.mes === i + 1),
  })).filter((m) => m.efemerides.length > 0);
};

/** La `<meta name="description">` de una efeméride. */
export const descripcionDeEfemeride = (e: EfemeridePublica): string =>
  e.descripcion || `${fechaDeEfemeride(e)}: ${e.titulo}. Efemérides literarias en ${NOMBRE}.`;

/** La de `/efemerides/`. */
export const descripcionDeLasEfemerides = (cuantas: number): string =>
  cuantas === 0
    ? 'Efemérides literarias: nacimientos, publicaciones y fechas del mundo de los libros, día por día.'
    : `${cuantas} ${cuantas === 1 ? 'efeméride literaria' : 'efemérides literarias'}: ` +
      'nacimientos, publicaciones y fechas del mundo de los libros, día por día.';

/** Las migas de una efeméride, para el buscador. */
export const migasDeEfemeride = (e: EfemeridePublica): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: NOMBRE, item: urlAbsoluta(RUTA_AGENDA) },
    { '@type': 'ListItem', position: 2, name: 'Efemérides', item: urlAbsoluta(RUTA_EFEMERIDES) },
    { '@type': 'ListItem', position: 3, name: e.titulo, item: urlAbsoluta(rutaDeEfemeride(e.slug)) },
  ],
});

/**
 * Las otras efemérides del mismo mes, para el pie de la página: el linkeo
 * interno que hace que ninguna quede huérfana más que del listado.
 */
export const vecinasDelMes = (
  e: EfemeridePublica,
  todas: readonly EfemeridePublica[],
  cuantas = 5,
): EfemeridePublica[] =>
  [...todas]
    .filter((o) => o.mes === e.mes && o.slug !== e.slug)
    .sort(ordenDelAnio)
    .slice(0, cuantas);
