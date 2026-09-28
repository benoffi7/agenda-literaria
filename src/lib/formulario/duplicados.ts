import type { EntradaDeIndice } from '@/lib/eventsJson';
import { claveDeDia } from '@/lib/fechasPublicas';
import { MESES } from '@/lib/meses';
import { normalize } from '@/lib/normalize';
import { deDatetimeLocal } from '@/lib/sesiones';
import type { ActividadForm } from '@/types/actividad';

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
 * Las actividades publicadas que se parecen a este formulario. Pura: el índice
 * entra por parámetro. `idPropio` es el de la actividad que se edita, para no
 * avisar que se parece a sí misma; `null` si todavía no se guardó.
 */
export const posiblesDuplicados = (
  form: Pick<ActividadForm, 'titulo' | 'sesiones' | 'modalidades'>,
  actividades: readonly Pick<EntradaDeIndice, 'id' | 'slug' | 'titulo' | 'sesiones' | 'sede'>[],
  idPropio: string | null,
): PosibleDuplicado[] => {
  const inicios = form.sesiones
    .filter((s) => !s.cancelada)
    .map((s) => deDatetimeLocal(s.inicio))
    .filter((d): d is Date => d !== null);
  if (inicios.length === 0) return [];
  const dias = new Set(inicios.map(claveDeDia));
  const sedes = (form.modalidades ?? []).map((m) => m.sede?.nombre ?? '').filter((n) => n.trim());

  const salida: PosibleDuplicado[] = [];
  for (const otra of actividades) {
    if (otra.id === idPropio) continue;
    const suyas = (otra.sesiones ?? []).filter((s) => !s.cancelada).map((s) => new Date(s.inicio));
    const coinciden = suyas.filter((d) => dias.has(claveDeDia(d)));
    if (coinciden.length === 0) continue;
    const dia = claveDeDia(coinciden[0]!);

    if (form.titulo.trim() && parecidoDeTitulos(form.titulo, otra.titulo) >= UMBRAL_DE_TITULO) {
      salida.push({ id: otra.id, slug: otra.slug, titulo: otra.titulo, motivo: 'titulo', dia });
      continue;
    }
    const mismoLugar = sedes.some((n) => mismaSede(n, otra.sede?.nombre ?? ''));
    // El nombre del lugar escrito en los dos títulos («… - La Libre») no dice que
    // sean la misma actividad: dice que son en el mismo lugar, que ya se sabe.
    const delLugar = palabrasDelTitulo(otra.sede?.nombre ?? '');
    if (parecidoDeTitulos(form.titulo, otra.titulo, delLugar) < UMBRAL_CON_LUGAR_Y_HORA) continue;
    const mismaHora = coinciden.some((d) =>
      inicios.some((i) => Math.abs(i.getTime() - d.getTime()) < MS_MISMA_HORA),
    );
    if (mismoLugar && mismaHora) {
      salida.push({ id: otra.id, slug: otra.slug, titulo: otra.titulo, motivo: 'lugar-y-hora', dia });
    }
  }
  return salida.slice(0, MAXIMO);
};
