/**
 * **SOLO build time** (§5.4) — lo que el build deriva de la Guía: el índice
 * `/<directorio>.json`, el view-model del listado `/guia/<directorio>/` y los
 * caminos de cada ficha, **una vez para los cuatro directorios** (M-9, D-1195).
 *
 * No lee Firestore: todo sale del `contenidoDelSitio()` memoizado, que sigue
 * siendo el único lector del sitio (B-227) y el que decide el `where` y el
 * `.select()` de cada colección. Acá no hay ninguna query que se pueda olvidar
 * del estado.
 *
 * Lo que cambia por directorio vive en `DIRECTORIOS_DEL_BUILD` y es solo la
 * enchufada: con qué función se arma su índice, qué ejes tiene y cómo se resuelve
 * su ficha. La proyección sigue siendo **una whitelist por entidad**
 * (`lib/<entidad>Publica.ts`) y no se generaliza (§5.2, PRD 6 § 4).
 */
import {
  contenidoDelSitio,
  etiquetasDelDetalle,
  indiceDelSitio,
  type ContenidoDelSitio,
} from '@/lib/contenidoDelSitio';
import type { IdDirectorio } from '@/lib/directorios';
import { slugsConHub } from '@/lib/hubsPublicos';
import type { MapaDeEtiquetas } from '@/lib/listadoPublico';
import { rutaDeBarrio, rutaDeCiudad } from '@/lib/rutasPublicas';
import { INFO_VERSION } from '@/lib/version';
import {
  EJES_DE_LIBRERIA,
  construirIndiceDeLibrerias,
  fichaDeLibreria,
  type EjeDeLibreria,
  type FichaDeLibreria,
  type IndiceDeLibrerias,
  type LibreriaPublica,
} from '@/lib/libreriaPublica';
import {
  EJES_DE_BIBLIOTECA,
  construirIndiceDeBibliotecas,
  fichaDeBiblioteca,
  type BibliotecaPublica,
  type EjeDeBiblioteca,
  type FichaDeBiblioteca,
  type IndiceDeBibliotecas,
} from '@/lib/bibliotecaPublica';
import {
  EJES_DE_SUSCRIPCION,
  construirIndiceDeSuscripciones,
  fichaDeSuscripcion,
  type EjeDeSuscripcion,
  type FichaDeSuscripcion,
  type IndiceDeSuscripciones,
  type SuscripcionPublica,
} from '@/lib/suscripcionPublica';
import {
  EJES_DE_LUGAR,
  construirIndiceDeLugares,
  fichaDeLugar,
  type EjeDeLugar,
  type FichaDeLugar,
  type IndiceDeLugares,
  type LugarPublico,
} from '@/lib/lugarPublico';
import type { ValorOpcion } from '@/types/actividad';

interface Entidades {
  librerias: {
    publica: LibreriaPublica;
    ficha: FichaDeLibreria;
    indice: IndiceDeLibrerias;
    eje: EjeDeLibreria;
  };
  bibliotecas: {
    publica: BibliotecaPublica;
    ficha: FichaDeBiblioteca;
    indice: IndiceDeBibliotecas;
    eje: EjeDeBiblioteca;
  };
  suscripciones: {
    publica: SuscripcionPublica;
    ficha: FichaDeSuscripcion;
    indice: IndiceDeSuscripciones;
    eje: EjeDeSuscripcion;
  };
  lugares: {
    publica: LugarPublico;
    ficha: FichaDeLugar;
    indice: IndiceDeLugares;
    eje: EjeDeLugar;
  };
}

type Chip = { slug: string; label: string };

/**
 * Lo que una ficha necesita resolver además de su proyección.
 *
 * ── Por qué el hub se consulta y no se asume ──────────────────────────────
 * `/barrio/{slug}` y `/ciudad/{slug}` los emite el build solo para los valores
 * aprobados con alguna **actividad** publicada (`hubsPublicos.ts`), y la Guía
 * estrena barrios y ciudades que no tienen ninguna. Linkear a ciegas publicaría
 * un 404 en cada una de esas fichas: una URL emitida sin confirmar que exista, la
 * misma clase que `esSlugDeFicha` evita del otro lado.
 *
 * ── Por qué las etiquetas son las del detalle ─────────────────────────────
 * `etiquetasDelDetalle()` no filtra por aprobación, y es lo correcto (D-30): acá
 * se **resuelve** el slug que la ficha ya tiene guardado, no se ofrece un chip.
 * Sin resolverlas la ficha publicaría el slug crudo —`caba`, `universitaria`— en
 * la página, el listado, la `meta description` y el JSON-LD.
 */
interface ContextoDeFicha {
  contenido: ContenidoDelSitio;
  etiquetas: MapaDeEtiquetas;
  barriosConHub: ReadonlySet<string>;
  ciudadesConHub: ReadonlySet<string>;
}

interface DirectorioDelBuild<E extends Entidades[IdDirectorio]> {
  ejes: readonly E['eje'][];
  publicas: (contenido: ContenidoDelSitio) => readonly E['publica'][];
  delIndice: (indice: E['indice']) => readonly { slug: string }[];
  filtrosDelIndice: (indice: E['indice'], eje: E['eje']) => readonly Chip[];
  construirIndice: (entrada: {
    publicas: readonly E['publica'][];
    vocabularios: Partial<Record<E['eje'], readonly ValorOpcion[]>>;
    version: string;
    generadoEn: string;
  }) => E['indice'];
  ficha: (publica: E['publica'], ctx: ContextoDeFicha) => E['ficha'];
}

const DIRECTORIOS_DEL_BUILD: { [D in IdDirectorio]: DirectorioDelBuild<Entidades[D]> } = {
  librerias: {
    ejes: EJES_DE_LIBRERIA,
    publicas: (c) => c.librerias,
    delIndice: (i) => i.librerias,
    filtrosDelIndice: (i, eje) => i.filtros[eje],
    construirIndice: ({ publicas, ...resto }) =>
      construirIndiceDeLibrerias({ librerias: publicas, ...resto }),
    ficha: (l, { etiquetas, barriosConHub, ciudadesConHub }) =>
      fichaDeLibreria(l, {
        etiquetaDeBarrio: etiquetas.barrio?.[l.barrio],
        rutaDelBarrio: barriosConHub.has(l.barrio) ? rutaDeBarrio(l.barrio) : null,
        etiquetaDeCiudad: etiquetas.ciudad?.[l.ciudad],
        rutaDeLaCiudad: ciudadesConHub.has(l.ciudad) ? rutaDeCiudad(l.ciudad) : null,
        etiquetaDeProvincia: etiquetas.provincia?.[l.provincia],
      }),
  },
  bibliotecas: {
    ejes: EJES_DE_BIBLIOTECA,
    publicas: (c) => c.bibliotecas,
    delIndice: (i) => i.bibliotecas,
    filtrosDelIndice: (i, eje) => i.filtros[eje],
    construirIndice: ({ publicas, ...resto }) =>
      construirIndiceDeBibliotecas({ bibliotecas: publicas, ...resto }),
    ficha: (b, { etiquetas, barriosConHub, ciudadesConHub }) =>
      fichaDeBiblioteca(b, {
        etiquetaDeBarrio: etiquetas.barrio?.[b.barrio],
        rutaDelBarrio: barriosConHub.has(b.barrio) ? rutaDeBarrio(b.barrio) : null,
        etiquetaDeCiudad: etiquetas.ciudad?.[b.ciudad],
        rutaDeLaCiudad: ciudadesConHub.has(b.ciudad) ? rutaDeCiudad(b.ciudad) : null,
        etiquetaDeProvincia: etiquetas.provincia?.[b.provincia],
        etiquetaDeTipo: etiquetas['tipo-biblioteca']?.[b.tipo],
      }),
  },
  suscripciones: {
    ejes: EJES_DE_SUSCRIPCION,
    publicas: (c) => c.suscripciones,
    delIndice: (i) => i.suscripciones,
    filtrosDelIndice: (i, eje) => i.filtros[eje],
    construirIndice: ({ publicas, ...resto }) =>
      construirIndiceDeSuscripciones({ suscripciones: publicas, ...resto }),
    /*
     * `ofrecidaPor.libreriaSlug` apunta a `/guia/librerias/{slug}`, que existe
     * solo si esa librería está publicada: se consulta por lo mismo que el hub.
     */
    ficha: (s, { etiquetas, contenido }) =>
      fichaDeSuscripcion(s, {
        etiqueta: (campo, slug) => etiquetas[campo]?.[slug],
        libreriasPublicadas: new Set(contenido.librerias.map((l) => l.slug)),
      }),
  },
  lugares: {
    ejes: EJES_DE_LUGAR,
    publicas: (c) => c.lugares,
    delIndice: (i) => i.lugares,
    filtrosDelIndice: (i, eje) => i.filtros[eje],
    construirIndice: ({ publicas, ...resto }) =>
      construirIndiceDeLugares({ lugares: publicas, ...resto }),
    ficha: (l, { etiquetas, barriosConHub }) =>
      fichaDeLugar(l, {
        etiqueta: (campo, slug) => etiquetas[campo]?.[slug],
        rutaDelBarrio: barriosConHub.has(l.donde.barrio) ? rutaDeBarrio(l.donde.barrio) : null,
      }),
  },
};

/**
 * `/<directorio>.json` — el índice que su listado filtra en memoria (§2.5).
 *
 * Los vocabularios salen de las opciones **sin filtrar por aprobación** y se
 * recortan después a los valores que alguna ficha usa (D-30 en su lado
 * correcto): lo que impide publicar vocabulario sin validar es el recorte por
 * uso, no el filtro de aprobación. Se arman recorriendo los ejes del módulo y
 * no a mano, porque **cada eje se llama igual que su taxonomía**: así un eje
 * nuevo llega solo hasta acá en vez de quedarse con el chip vacío.
 */
export const indiceDeDirectorio = async <D extends IdDirectorio>(
  id: D,
): Promise<Entidades[D]['indice']> => {
  const directorio: DirectorioDelBuild<Entidades[D]> = DIRECTORIOS_DEL_BUILD[id];
  const contenido = await contenidoDelSitio();
  return directorio.construirIndice({
    publicas: directorio.publicas(contenido),
    vocabularios: Object.fromEntries(
      directorio.ejes.map((eje) => [eje, contenido.opciones[eje] ?? []]),
    ) as Partial<Record<Entidades[D]['eje'], ValorOpcion[]>>,
    version: INFO_VERSION.version,
    generadoEn: INFO_VERSION.generadoEn,
  });
};

const fichasDe = async <D extends IdDirectorio>(id: D): Promise<Entidades[D]['ficha'][]> => {
  const directorio: DirectorioDelBuild<Entidades[D]> = DIRECTORIOS_DEL_BUILD[id];
  const contenido = await contenidoDelSitio();
  const indice = await indiceDelSitio();
  const ctx: ContextoDeFicha = {
    contenido,
    etiquetas: await etiquetasDelDetalle(),
    barriosConHub: new Set(slugsConHub('barrio', indice.actividades, indice.opciones)),
    ciudadesConHub: new Set(slugsConHub('ciudad', indice.actividades, indice.opciones)),
  };
  return directorio.publicas(contenido).map((p) => directorio.ficha(p, ctx));
};

/**
 * Todo lo que `/guia/<directorio>/` necesita, y **nada más** — el view-model del
 * listado (D-140). La plantilla no ve el índice ni el documento: recibe las
 * fichas ya armadas más los chips de cada eje.
 */
export interface VistaDeDirectorio<D extends IdDirectorio> {
  fichas: Entidades[D]['ficha'][];
  filtros: Record<Entidades[D]['eje'], Chip[]>;
  version: string;
}

/**
 * El listado: las fichas en el orden del índice —el mismo que va a ver la island
 * después de hidratar; con dos ordenamientos la lista saltaría al cargar el
 * JSON— y los chips de cada eje.
 */
export const vistaDeDirectorio = async <D extends IdDirectorio>(
  id: D,
): Promise<VistaDeDirectorio<D>> => {
  const directorio: DirectorioDelBuild<Entidades[D]> = DIRECTORIOS_DEL_BUILD[id];
  const [fichas, indice] = await Promise.all([fichasDe(id), indiceDeDirectorio(id)]);
  const porSlug = new Map(fichas.map((f) => [f.slug, f]));
  return {
    fichas: directorio
      .delIndice(indice)
      .map((p) => porSlug.get(p.slug)!)
      .filter(Boolean),
    filtros: Object.fromEntries(
      directorio.ejes.map((eje) => [
        eje,
        directorio.filtrosDelIndice(indice, eje).map((v) => ({ slug: v.slug, label: v.label })),
      ]),
    ) as Record<Entidades[D]['eje'], Chip[]>,
    version: indice.version,
  };
};

/**
 * Los caminos de `/guia/<directorio>/[slug]`, uno por ficha publicada.
 *
 * Vive acá y no adentro del `.astro` porque un `.astro` no se importa desde
 * vitest. `props` lleva **solo el view-model**: la plantilla no recibe el
 * documento, así que no puede publicar el `contactoDeQuienCargo` —ni la
 * dirección de un lugar con el flag apagado— aunque quiera: no están en el
 * objeto.
 */
export const caminosDeDirectorio = async <D extends IdDirectorio>(
  id: D,
): Promise<{ params: { slug: string }; props: { ficha: Entidades[D]['ficha'] } }[]> =>
  caminosDeFichas(id, await fichasDe(id));

/** Dos fichas publicadas del mismo directorio con la misma dirección (B-1640). */
export class SlugDeFichaRepetido extends Error {
  constructor(
    readonly directorio: IdDirectorio,
    readonly slug: string,
  ) {
    super(
      `Dos fichas publicadas de «${directorio}» tienen la dirección «${slug}»: ` +
        'una de las dos páginas quedaría pisada (B-1640). Cambiale el slug a una ' +
        'desde el panel antes de volver a construir.',
    );
    this.name = 'SlugDeFichaRepetido';
  }
}

/**
 * Un camino por ficha, y **el build rojo si dos repiten el slug** (B-1640).
 *
 * D-1010 lo verifica al publicar, pero no lo garantiza: dos admins publicando en
 * el mismo segundo, o fichas anteriores a esa verificación, pueden dejar dos
 * publicadas con la misma dirección, y Astro emitiría las dos rutas a la misma
 * página con la segunda pisando a la primera **en silencio**. Mejor un build que
 * se niega con el slug y el directorio en el mensaje.
 */
export const caminosDeFichas = <F extends { slug: string }>(
  directorio: IdDirectorio,
  fichas: readonly F[],
): { params: { slug: string }; props: { ficha: F } }[] => {
  const vistos = new Set<string>();
  return fichas.map((ficha) => {
    if (vistos.has(ficha.slug)) throw new SlugDeFichaRepetido(directorio, ficha.slug);
    vistos.add(ficha.slug);
    return { params: { slug: ficha.slug }, props: { ficha } };
  });
};

/**
 * **Cuántas fichas publicadas tiene cada directorio** — B-900, lo que el `/404`
 * necesita para sugerir una sección solo si tiene algo adentro. Números, no
 * fichas (D-140).
 *
 * Cuenta lo que cuenta el listado y no la colección: sale de la misma
 * `vistaDeDirectorio` que pinta `/guia/<x>/`, así que «tiene contenido» quiere
 * decir exactamente «su listado no está vacío». Es un `Record` por
 * `IdDirectorio` para que un directorio nuevo no compile hasta decir de dónde se
 * cuentan sus fichas.
 */
export const fichasPorDirectorio = async (): Promise<Record<IdDirectorio, number>> => {
  const [librerias, suscripciones, lugares, bibliotecas] = await Promise.all([
    vistaDeDirectorio('librerias'),
    vistaDeDirectorio('suscripciones'),
    vistaDeDirectorio('lugares'),
    vistaDeDirectorio('bibliotecas'),
  ]);
  return {
    librerias: librerias.fichas.length,
    suscripciones: suscripciones.fichas.length,
    lugares: lugares.fichas.length,
    bibliotecas: bibliotecas.fichas.length,
  };
};
