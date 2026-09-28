import type { EntradaDeIndice } from '@/lib/eventsJson';
import { claveDeDia } from '@/lib/fechasPublicas';
import { MESES } from '@/lib/meses';
import { normalize } from '@/lib/normalize';
import { deDatetimeLocal, instanteDeTimestamp } from '@/lib/sesiones';
import type { ActividadConId, ActividadForm } from '@/types/actividad';

/**
 * **¿Esta actividad ya está cargada?** — roadmap 5.4.
 *
 * Con cuatro formularios públicos abiertos y más de una cuenta cargando, el mismo
 * taller va a llegar dos veces: una propuesta de quien lo da y otra de quien lo
 * vio en Instagram. El panel avisa «se parece a *X*, que ya está publicada el
 * mismo día» mientras se carga, y **nunca frena**: los falsos positivos existen
 * (dos clubes distintos leyendo el mismo libro el mismo sábado), y un aviso que
 * bloquea obliga a inventar una forma de saltearlo.
 *
 * ── Contra qué compara, y por qué ──────────────────────────────────────────
 * Contra el **`events.json` publicado**, no contra Firestore. El formulario no
 * tiene el catálogo en memoria (lo tiene el listado, otra pantalla), y leer la
 * colección entera cada vez que se abre un formulario es la lectura de más que
 * el §2.5 existe para evitar. El índice ya está en el CDN, lo lee también el
 * boletín, y trae justo lo que hace falta: título, fechas y sede. La contra: solo
 * ve lo **publicado**, y con hasta siete minutos de atraso (§8). Es la mitad que
 * importa —el duplicado que sale al sitio es el que choca con algo publicado—,
 * y un borrador duplicado se ve en el listado.
 *
 * ── Qué cuenta como «se parece» ────────────────────────────────────────────
 * Siempre **el mismo día** (en la hora del proyecto), y además una de dos:
 *
 *  - `titulo` — los títulos comparten casi todas sus palabras con sentido. Se
 *    sacan las que no distinguen nada en este circuito («club», «lectura»,
 *    «taller»…): sin eso, «Club de lectura: Basura» y «Club de lectura: Rayuela»
 *    serían parecidos, y todo sábado tendría un aviso.
 *  - `lugar-y-hora` — la misma sede, empezando con menos de una hora de
 *    diferencia, **y** alguna palabra del título en común (un tercio). Es el caso
 *    en que el título cambió entre la propuesta y la carga («"El buen mal" de
 *    Schweblin» contra «Club de lectura: El buen mal»). Sin la condición del
 *    título avisaba de más: un centro cultural con dos salas tiene dos cosas a la
 *    misma hora, y en la medición del 2026-09-28 eran la mitad de los avisos.
 */

/** Las palabras que no distinguen una actividad de otra en este circuito. */
const VACIAS = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los', 'para', 'por', 'se',
  'sobre', 'su', 'un', 'una', 'y', 'e', 'o',
  'club', 'clubes', 'lectura', 'lecturas', 'taller', 'talleres', 'escritura', 'encuentro',
  'encuentros', 'presentacion', 'charla', 'ciclo', 'libro', 'edicion', 'jornada', 'clase',
  'presencial', 'virtual', 'online', 'on', 'line', 'hibrido',
  // Medido contra el catálogo del 2026-09-28: sin estas, «Feria de libros en Verne» y
  // «Encuentros de escritores y feria de libros» daban aviso por dos palabras que
  // aparecen en media agenda.
  'feria', 'ferias', 'libros', 'book', 'seminario', 'intensivo', 'escritores', 'escritoras',
  'presentaciones', 'charlas', 'noche', 'festival',
  // Las fechas escritas en el título: «Octubre», «Sábados», «17-10». Dos actividades
  // del mismo día comparten la fecha por definición, así que no dicen nada. Los
  // meses salen de `meses.ts`; «setiembre» es la otra grafía que se tipea.
  ...MESES,
  'setiembre',
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'sabados', 'domingo', 'domingos',
]);

/** Las palabras con sentido de un título, sin acentos (§6). `ademas`: otras a ignorar. */
export const palabrasDelTitulo = (titulo: string, ademas: ReadonlySet<string> = new Set()): Set<string> =>
  new Set(
    normalize(titulo)
      // El `@handle` del organizador se repite en todo lo suyo: no distingue nada.
      .replace(/@[a-z0-9_.]+/g, ' ')
      .split(/[^a-z0-9ñ]+/)
      // Con un dígito es un número de edición o una fecha («2da», «17»): igual que
      // los meses, no distingue una actividad de otra del mismo día.
      .filter((p) => p.length > 1 && !/[0-9]/.test(p) && !VACIAS.has(p) && !ademas.has(p)),
  );

/**
 * Qué parte de las palabras del título **más corto** está en el otro. Contra el
 * más corto y no contra la unión, porque el caso típico es la misma actividad con
 * un título más largo: «Basura» contra «Club de lectura - Basura, de Héctor Abad».
 */
export const parecidoDeTitulos = (
  a: string,
  b: string,
  ademas: ReadonlySet<string> = new Set(),
): number => {
  const pa = palabrasDelTitulo(a, ademas);
  const pb = palabrasDelTitulo(b, ademas);
  const menor = Math.min(pa.size, pb.size);
  if (menor === 0) return 0;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes += 1;
  return comunes / menor;
};

/** Desde cuánto parecido se avisa. Dos de tres palabras en común. */
export const UMBRAL_DE_TITULO = 0.66;

/** El parecido mínimo cuando además coinciden el lugar y la hora. */
export const UMBRAL_CON_LUGAR_Y_HORA = 0.33;

/** Cuánto pueden separarse dos comienzos en el mismo lugar para contar «a la misma hora». */
const MS_MISMA_HORA = 60 * 60 * 1000;

const mismaSede = (a: string, b: string) => {
  const na = normalize(a.trim());
  return na !== '' && na === normalize(b.trim());
};

export interface PosibleDuplicado {
  id: string;
  slug: string;
  titulo: string;
  motivo: 'titulo' | 'lugar-y-hora';
  /** `2026-10-12`: el primer día en que coinciden. */
  dia: string;
}

/** Cuántos se muestran como mucho: más de tres ya no es un duplicado, es un criterio que falló. */
const MAXIMO = 3;

/**
 * Lo mínimo que se compara, sea un formulario, una entrada del índice o un
 * documento del listado: **una sola regla** para las tres fuentes. Con dos copias
 * del criterio, el aviso del formulario y el filtro del listado podrían contestar
 * distinto sobre el mismo par, y nadie lo notaría.
 */
export interface Comparable {
  id: string | null;
  slug: string;
  titulo: string;
  /** Los comienzos de los encuentros no cancelados. */
  inicios: Date[];
  /** Los nombres de las sedes de todas las filas de «Dónde». */
  sedes: string[];
}

/** El motivo por el que `b` se parece a `a`, y el primer día en que coinciden; o `null`. */
export const seParecen = (
  a: Comparable,
  b: Comparable,
): { motivo: PosibleDuplicado['motivo']; dia: string } | null => {
  if (a.id !== null && a.id === b.id) return null;
  const dias = new Set(a.inicios.map(claveDeDia));
  const coinciden = b.inicios.filter((d) => dias.has(claveDeDia(d)));
  if (coinciden.length === 0) return null;
  const dia = claveDeDia(coinciden[0]!);

  if (a.titulo.trim() && parecidoDeTitulos(a.titulo, b.titulo) >= UMBRAL_DE_TITULO) {
    return { motivo: 'titulo', dia };
  }
  const mismoLugar = a.sedes.some((n) => b.sedes.some((m) => mismaSede(n, m)));
  if (!mismoLugar) return null;
  // El nombre del lugar escrito en los dos títulos («… - La Libre») no dice que
  // sean la misma actividad: dice que son en el mismo lugar, que ya se sabe.
  const delLugar = new Set(b.sedes.flatMap((n) => [...palabrasDelTitulo(n)]));
  if (parecidoDeTitulos(a.titulo, b.titulo, delLugar) < UMBRAL_CON_LUGAR_Y_HORA) return null;
  const mismaHora = coinciden.some((d) =>
    a.inicios.some((i) => Math.abs(i.getTime() - d.getTime()) < MS_MISMA_HORA),
  );
  return mismaHora ? { motivo: 'lugar-y-hora', dia } : null;
};

/** El formulario, como `Comparable`: sus fechas son `datetime-local` del navegador. */
export const comparableDelFormulario = (
  form: Pick<ActividadForm, 'titulo' | 'sesiones' | 'modalidades'>,
  id: string | null,
): Comparable => ({
  id,
  slug: '',
  titulo: form.titulo,
  inicios: form.sesiones
    .filter((s) => !s.cancelada)
    .map((s) => deDatetimeLocal(s.inicio))
    .filter((d): d is Date => d !== null),
  sedes: (form.modalidades ?? []).map((m) => m.sede?.nombre ?? '').filter((n) => n.trim()),
});

/** Una entrada del `events.json`: sus fechas son ISO. */
export const comparableDelIndice = (
  e: Pick<EntradaDeIndice, 'id' | 'slug' | 'titulo' | 'sesiones' | 'sede'>,
): Comparable => ({
  id: e.id,
  slug: e.slug,
  titulo: e.titulo,
  inicios: (e.sesiones ?? []).filter((s) => !s.cancelada).map((s) => new Date(s.inicio)),
  sedes: e.sede?.nombre ? [e.sede.nombre] : [],
});

/** Un documento del listado del panel: sus fechas son `Timestamp`. */
export const comparableDelDocumento = (a: ActividadConId): Comparable => ({
  id: a.id,
  slug: a.slug ?? '',
  titulo: a.titulo ?? '',
  inicios: (a.sesiones ?? [])
    .filter((s) => !s.cancelada)
    .map((s) => instanteDeTimestamp(s.inicio))
    .filter((d): d is Date => d !== null),
  sedes: ((a.modalidades ?? []).length > 0 ? (a.modalidades ?? []).map((m) => m.sede) : [a.sede])
    .map((sede) => sede?.nombre ?? '')
    .filter((n) => n.trim()),
});

/**
 * Las actividades publicadas que se parecen a este formulario. Pura: el índice
 * entra por parámetro. `idPropio` es el de la actividad que se edita, para no
 * avisar que se parece a sí misma; `null` si todavía no se guardó.
 */
export const posiblesDuplicados = (
  form: Pick<ActividadForm, 'titulo' | 'sesiones' | 'modalidades'>,
  actividades: readonly Pick<EntradaDeIndice, 'id' | 'slug' | 'titulo' | 'sesiones' | 'sede'>[],
  idPropio: string | null,
): PosibleDuplicado[] => {
  const propia = comparableDelFormulario(form, idPropio);
  if (propia.inicios.length === 0) return [];
  const salida: PosibleDuplicado[] = [];
  for (const e of actividades) {
    const otra = comparableDelIndice(e);
    const r = seParecen(propia, otra);
    if (r) salida.push({ id: e.id, slug: e.slug, titulo: e.titulo, ...r });
  }
  return salida.slice(0, MAXIMO);
};

/**
 * **El filtro «Posibles duplicados» del listado** — los ids de las actividades
 * que se parecen a alguna otra del catálogo. A diferencia del aviso del
 * formulario, acá el catálogo entero ya está en memoria (lo cargó el listado),
 * así que compara contra **todo**, borradores incluidos, sin pedir nada.
 *
 * Deja afuera las canceladas: una cancelada que se parece a una viva no es un
 * duplicado a limpiar, es la que ya se limpió.
 *
 * Se comparan solo los pares que comparten un día, agrupando por día primero:
 * con 400 actividades, todos contra todos son 80.000 pares por render; por día,
 * unos cientos.
 */
export const idsConPosibleDuplicado = (actividades: readonly ActividadConId[]): Set<string> => {
  const vivas = actividades.filter((a) => a.estado !== 'cancelado').map(comparableDelDocumento);
  const porDia = new Map<string, Comparable[]>();
  for (const c of vivas) {
    for (const dia of new Set(c.inicios.map(claveDeDia))) {
      porDia.set(dia, [...(porDia.get(dia) ?? []), c]);
    }
  }
  const ids = new Set<string>();
  for (const grupo of porDia.values()) {
    for (let i = 0; i < grupo.length; i += 1) {
      for (let j = 0; j < grupo.length; j += 1) {
        if (i === j) continue;
        if (seParecen(grupo[i]!, grupo[j]!)) {
          ids.add(grupo[i]!.id!);
          ids.add(grupo[j]!.id!);
        }
      }
    }
  }
  return ids;
};
