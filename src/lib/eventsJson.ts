import { portadaDe } from '@/lib/imagenes';
import { opcionesPublicas, type ActividadPublica, type OpcionPublica } from '@/lib/toPublic';
import type { CampoTaxonomia, ValorOpcion } from '@/types/actividad';

/**
 * `/events.json` — el índice que el listado filtra en memoria (§2.5) — B-106.
 *
 * ── Dos filtros en serie, no uno ──────────────────────────────────────────
 * `toPublic` decide **qué puede ser público** (§5). Esto decide **qué necesita el
 * listado**, que es menos. Son dos preguntas distintas y se contestan en dos
 * lugares a propósito (§3.1 del diseño): la primera es de privacidad y la segunda
 * de peso y de superficie.
 *
 * Lo que el índice **no** lleva, y sí está en `toPublic`: `descripcion`,
 * `sede.direccion`, `sede.geo`, `sede.indicaciones`, `inscripcion.destino`,
 * `material`, `sesiones[].tema`, `sesiones[].lectura` y `tallerista.bio`. Nada
 * de eso se usa para filtrar ni para pintar una tarjeta, y todo vive en el HTML
 * de la página de detalle, que es donde hace falta.
 *
 * Las dos ventajas, en este orden:
 *
 * 1. **Menos superficie scrapeable.** `inscripcion.destino` es un mail o un
 *    WhatsApp, y el §5.1 ya advierte que queda expuesto a bots. Sacarlo del JSON
 *    no lo esconde —está en el HTML del detalle— pero deja de **servirlo en lote,
 *    en un solo GET**. La diferencia entre scrapear un archivo y crawlear N
 *    páginas es la que decide si alguien lo hace.
 * 2. **Peso.** El campo caro es `descripcion`, y `searchText` ya lo contiene
 *    normalizado (§6): mandar los dos es mandar la descripción dos veces.
 *
 * ── Y es la TERCERA proyección de la misma decisión ───────────────────────
 * Ya hay `toPublic` (salida 1) y `opcionesPublicas` (§4.4). Ésta se apoya en la
 * primera en vez de leer el documento: **recorta una `ActividadPublica`, no una
 * `Actividad`.** Es lo que hace que no pueda publicar algo que la frontera de
 * privacidad ya descartó — un `Actividad` de entrada la habría dejado decidir de
 * nuevo sobre `difusion` y `createdBy`, y esa decisión ya está tomada.
 *
 * El barrido de centinelas la cubre como salida propia
 * (`tests/barrido-de-salidas-publicas.test.ts`).
 */

/** Una sesión en el índice: solo lo que el listado necesita para ordenar y filtrar. */
export interface SesionDeIndice {
  inicio: string;
  fin: string;
  cancelada: boolean;
}

/** La sede en el índice: sin dirección, sin indicaciones y sin coordenadas. */
export interface SedeDeIndice {
  nombre: string;
  barrio: string;
  ciudad: string;
}

export interface EntradaDeIndice {
  id: string;
  slug: string;
  titulo: string;
  tipo: string;
  /** Los primeros ~160 caracteres de `descripcion`, cortados en palabra. */
  resumen: string;
  /** La portada de la galería, o `null`. Ver la nota de `imagenUrlDe`. */
  imagenUrl: string | null;
  modalidad: string;
  sede: SedeDeIndice | null;
  /** Solo el slug del arancel: las notas («2 cuotas») son del detalle. */
  arancel: { tipo: string };
  /** **Strings, no objetos**: el Instagram y la bio son del detalle. */
  organizador: string;
  tallerista: string | null;
  tags: string[];
  destacado: boolean;
  esCiclo: boolean;
  /** Solo la plataforma, para el filtro de modalidad. */
  online: { plataforma: string } | null;
  sesiones: SesionDeIndice[];
  inscripcion: {
    requiere: boolean;
    cupo: number | null;
    /**
     * **El ISO del cierre, no un booleano** — B-111.
     *
     * `toPublic` emite `abierta`, que se calcula **en el build** y desde ahí
     * miente hasta el rebuild siguiente: una inscripción que cerró a la
     * medianoche sigue diciendo «abierta» todo el día. Mandando la fecha, el
     * listado lo decide con el reloj de quien mira.
     */
    cierraEn: string | null;
    completo: boolean;
  };
  searchText: string;
}

export interface Indice {
  generadoEn: string;
  /** La misma que estampa `scripts/version.mjs`: de qué build salió este archivo. */
  version: string;
  opciones: Record<string, OpcionPublica[]>;
  actividades: EntradaDeIndice[];
}

/** Largo del resumen. 160 es el corte útil como `meta description` (§5.1). */
export const LARGO_RESUMEN = 160;

/**
 * Los primeros `LARGO_RESUMEN` caracteres, **cortados en límite de palabra**.
 *
 * Se calcula en el build y no es un campo nuevo del modelo (§3.1): pedirle un
 * resumen a mano a quien carga es un campo más en un formulario de treinta, y lo
 * que se escribiría es la primera oración de la descripción.
 *
 * Cortar por caracteres a secas parte la última palabra al medio, y eso se lee
 * como un error de software en la tarjeta y en el resultado de Google.
 */
export const resumenDe = (descripcion: string): string => {
  const limpia = descripcion.replace(/\s+/g, ' ').trim();
  if (limpia.length <= LARGO_RESUMEN) return limpia;

  const recorte = limpia.slice(0, LARGO_RESUMEN + 1);
  const ultimoEspacio = recorte.lastIndexOf(' ');
  // Sin espacios en 161 caracteres (una URL pegada, por ejemplo) se corta duro:
  // es preferible a devolver la cadena entera y romper el largo prometido.
  const cuerpo = ultimoEspacio > 0 ? recorte.slice(0, ultimoEspacio) : limpia.slice(0, LARGO_RESUMEN);
  return `${cuerpo.replace(/[.,;:—-]$/, '')}…`;
};

/**
 * La URL de la portada.
 *
 * **Nota de fidelidad al diseño:** §3.1 escribe este campo como `imagenUrl`, que
 * era el nombre del campo del modelo cuando se diseñó. B-167 lo reemplazó por la
 * galería `imagenes: Imagen[]` con un flag `portada`. Se conserva el nombre del
 * diseño y se deriva de la portada: el listado necesita **una** imagen y elegir
 * cuál es una decisión del modelo (D-125), no del consumidor.
 */
const imagenUrlDe = (a: ActividadPublica): string | null => portadaDe(a.imagenes)?.url ?? null;

/**
 * Las sesiones, **ordenadas por inicio**.
 *
 * El array del documento no garantiza orden: el formulario permite agregar filas
 * en cualquier orden y el botón de «generar N encuentros» las agrega al final.
 * Ordenar es del build —una vez— y no de cada consumidor: si lo hiciera cada
 * consumidor, el que se olvide muestra «Encuentro 3» antes que «Encuentro 1» y
 * nada falla.
 */
const sesionesDeIndice = (a: ActividadPublica): SesionDeIndice[] =>
  [...a.sesiones]
    .map((s) => ({ inicio: s.inicio, fin: s.fin, cancelada: s.cancelada }))
    .sort((x, y) => x.inicio.localeCompare(y.inicio));

/** Una `ActividadPublica` recortada a lo que el listado necesita. */
export const entradaDeIndice = (a: ActividadPublica): EntradaDeIndice => ({
  id: a.id,
  slug: a.slug,
  titulo: a.titulo,
  tipo: a.tipo,
  resumen: resumenDe(a.descripcion),
  imagenUrl: imagenUrlDe(a),
  modalidad: a.modalidad,
  sede: a.sede
    ? { nombre: a.sede.nombre, barrio: a.sede.barrio, ciudad: a.sede.ciudad }
    : null,
  arancel: { tipo: a.arancel.tipo },
  organizador: a.organizador.nombre,
  tallerista: a.tallerista?.nombre ?? null,
  tags: a.tags,
  destacado: a.destacado,
  esCiclo: a.esCiclo,
  online: a.online ? { plataforma: a.online.plataforma } : null,
  sesiones: sesionesDeIndice(a),
  inscripcion: {
    requiere: a.inscripcion.requiere,
    cupo: a.inscripcion.cupo,
    cierraEn: a.inscripcion.cierraEn,
    completo: a.inscripcion.completo,
  },
  searchText: a.searchText,
});

/**
 * El archivo entero.
 *
 * Las opciones viajan **en el mismo archivo** (§4.4) para que los chips de filtro
 * no tengan nada cableado: al agregar una etiqueta aparece sola en los filtros.
 * Por eso el rebuild se dispara también cuando cambia `/opciones/*` (§8, trampa 8).
 */
export const construirIndice = ({
  actividades,
  opciones,
  version,
  generadoEn,
}: {
  actividades: readonly ActividadPublica[];
  opciones: Partial<Record<CampoTaxonomia, ValorOpcion[]>>;
  version: string;
  generadoEn: string;
}): Indice => ({
  generadoEn,
  version,
  opciones: Object.fromEntries(
    Object.entries(opciones).map(([campo, valores]) => [campo, opcionesPublicas(valores ?? [])]),
  ),
  actividades: actividades.map(entradaDeIndice),
});
