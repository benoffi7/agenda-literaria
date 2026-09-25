/**
 * **La proyección pública de una biblioteca** — B-960, el cuarto directorio.
 *
 * ── Es una whitelist, y ahí está toda la seguridad de esto ────────────────
 * §5.2 del `CLAUDE.md`, y el recuadro del § 1.2 del inventario de los PRDs:
 *
 * > «`toPublic` por entidad, no genérico. La proyección es una **whitelist** y
 * > ahí está toda la seguridad de esto: un `pick` con la lista escrita a mano.
 * > Un `toPublic` genérico que proyecte "todo menos lo prohibido" invierte el
 * > default y el primer campo nuevo sale solo. **No hacerlo.**»
 *
 * Que sea el cuarto directorio con la misma forma es exactamente la tentación
 * que ese recuadro anticipa: cuatro proyecciones que se parecen piden a gritos
 * una función genérica, y generalizarlas invertiría el default en las cuatro de
 * una sola vez. Acá no hay un solo spread sobre el documento.
 *
 * ── El campo que no sale nunca ────────────────────────────────────────────
 * `contactoDeQuienCargo` es el dato personal de un tercero, y vive en el mismo
 * documento que los cuatro contactos **públicos** de la biblioteca (`instagram`,
 * `whatsapp`, `web`, `mail`). Que convivan es exactamente la condición donde una
 * proyección por spread filtra un campo, y por eso además de la whitelist hay un
 * centinela: `tests/biblioteca-publica.test.ts`, con el fixture
 * `tests/fixtures/centinelas-biblioteca.ts`, y el control negativo codificado de
 * B-212 (se mete el spread y se exige que falle nombrando el campo).
 *
 * Tampoco salen `revision` (lleva el uid de quien revisó y el motivo del
 * descarte), `origen`, `estado`, `creadoEn` ni `publicadaAlgunaVez`: son el
 * ciclo de vida, no la ficha.
 *
 * ── Lo que se publica se publica **saneado** ──────────────────────────────
 * Los cuatro contactos y el catálogo terminan en un `href` de una página
 * **indexada**, y las URLs de las imágenes en un `src`. `firestore.rules` ya
 * acota su forma, pero la regla **no itera una lista** (B-842), así que las filas
 * de `imagenes` llegan sin validar fila por fila. Acá se pasa todo por los
 * saneadores que el proyecto ya tiene —`urlSegura`, `handleInstagram`— y lo que
 * no pasa **se descarta**: nunca se emite algo que no se pudo verificar.
 *
 * ── Puro, y por eso barrible ──────────────────────────────────────────────
 * Sin Firestore y sin navegador: lo importan el build (`contenidoDelSitio.ts`),
 * el endpoint del JSON, las dos páginas y los tests. La lectura —con su
 * `where('estado','==','publicado')`, que es la primera de las nueve cosas que se
 * rompen en silencio— vive en `contenidoDelSitio.ts`.
 */
import { fraseConFecha } from '@/lib/datoConFecha';
import { urlSegura, handleInstagram } from '@/lib/enlaceSeguro';
import { geografiaNormalizada, piezasDeLugar } from '@/lib/geografia.mjs';
import { desSlug } from '@calendario';
import { imagenesDeFichaPublica } from '@/lib/imagenesDeFicha';
import { NOMBRE } from '@/lib/identidad';
import { normalize } from '@/lib/normalize';
import {
  RUTA_AGENDA,
  RUTA_BIBLIOTECAS,
  RUTA_GUIA,
  rutaDeBiblioteca,
  urlAbsoluta,
} from '@/lib/rutasPublicas';
import { opcionesPublicas, type OpcionPublica } from '@/lib/toPublic';
import {
  MIN_WHATSAPP_BIBLIOTECA,
  TOPE_WHATSAPP_BIBLIOTECA,
  type Biblioteca,
} from '@/types/biblioteca';
import type { ValorOpcion } from '@/types/actividad';

/**
 * Una imagen de la ficha, **sin `storagePath`**.
 *
 * Mismo recorte y mismo motivo que `ImagenDeLibreriaPublica`: `storagePath` es
 * el handle interno del objeto en Storage, y publicarlo le da a cualquiera la
 * ruta exacta de un bucket cuyo `list` está cerrado a propósito (trampa 13).
 */
export interface ImagenDeBibliotecaPublica {
  /** Ya saneada con `urlSegura`: lo que no era `http(s)` no llegó hasta acá. */
  url: string;
  epigrafe: string;
  ancho: number | null;
  alto: number | null;
}

/**
 * Lo que de una biblioteca sale al sitio. **Whitelist: si no está acá, no sale.**
 *
 * Los contactos son `null` cuando la biblioteca no los cargó **o cuando lo
 * cargado no se pudo sanear**, y las dos cosas se leen igual desde la página:
 * «no hay por dónde».
 */
export interface BibliotecaPublica {
  /** El segmento de la URL. Inmutable después de publicar — trampa 10. */
  slug: string;
  nombre: string;
  /** `''` cuando no hay. */
  descripcion: string;
  /** Slug de `/opciones/tipo-biblioteca`. `''` cuando no se cargó. */
  tipo: string;
  direccion: string;
  /**
   * El horario de atención, texto libre. `''` cuando no se cargó.
   *
   * **Es público a propósito y sin flag**, igual que en una librería: cuándo abre
   * una biblioteca es exactamente lo que el directorio existe para contestar, y
   * no identifica a nadie.
   */
  horarios: string;
  /** El horario de la sala de lectura, texto libre. `''` es «no tiene sala» o «no lo dijo». */
  horarioDeSala: string;
  /**
   * **Si hace falta asociarse, y la frase del costo ya armada** — B-837.
   *
   * ⚠️ `costo` es **un string y nunca un número**, y ésa es la regla 2 de
   * `datoConFecha.ts` impuesta por la forma y no por la disciplina: sale
   * «$3.000 por año · cargado el 17 de septiembre de 2026», que es inservible
   * para filtrar u ordenar. Por eso el eje `asociarse` de los filtros de abajo
   * ofrece **si hace falta o no**, que es un booleano estable, y nunca el monto.
   *
   * Vacío cuando no hay costo cargado **o cuando su fecha no es usable**: el
   * dato huérfano desaparece en vez de publicarse solo.
   */
  asociarse: { haceFalta: boolean; costo: string };
  /** La URL del catálogo consultable, saneada con `urlSegura`. */
  catalogo: string | null;
  /** El **mismo slug** de `/opciones/provincia` que usan las actividades. */
  provincia: string;
  /** El **mismo slug** de `/opciones/barrio` que usan las actividades. */
  barrio: string;
  /** El **mismo slug** de `/opciones/ciudad`. */
  ciudad: string;
  /**
   * Público sin discusión: es la ubicación de una **institución**, no de una
   * persona, y la sede de una actividad ya la publica. Es el mismo argumento que
   * el de una librería, y la diferencia con `/lugares` —que tiene
   * `direccionPublica` porque ahí puede ser la casa de alguien— es justamente
   * ésa.
   */
  geo: { lat: number; lng: number } | null;
  imagenes: ImagenDeBibliotecaPublica[];
  /** Handle sin `@`, saneado con `handleInstagram`. */
  instagram: string | null;
  /** Solo dígitos: de acá sale un `wa.me/<digitos>`. */
  whatsapp: string | null;
  /** Con esquema `http(s)`, saneada con `urlSegura`. */
  web: string | null;
  mail: string | null;
  /**
   * El índice de búsqueda del §6, normalizado al escribir.
   *
   * No publica nada nuevo — se deriva de campos de esta misma lista — y eso es
   * lo que lo hace inocuo, no el hecho de estar normalizado.
   */
  searchText: string;
}

/** `8–15 dígitos`, el mismo rango que la regla y el schema. */
const whatsappPublicable = (valor: string | null): string | null => {
  const digitos = (valor ?? '').replace(/\D/g, '');
  return digitos.length >= MIN_WHATSAPP_BIBLIOTECA && digitos.length <= TOPE_WHATSAPP_BIBLIOTECA
    ? digitos
    : null;
};

/** Lo mínimo para poner un `mailto:` sin publicar un link roto. */
const mailPublicable = (valor: string | null): string | null => {
  const mail = (valor ?? '').trim();
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(mail) ? mail : null;
};

/**
 * Las imágenes que se pueden publicar, **con la portada primera**.
 *
 * `imagenesPublicables` y no un `urlSegura` escrito acá: es la misma pregunta
 * que el panel hace con `faltaElFlyer` y que la página de detalle hace con
 * `imagenesDeDetalle`, y cuatro respuestas escritas a mano se separan sin que
 * nada falle (la clase de B-88, y lo que B-854 cerró).
 *
 * La portada se busca **después** de filtrar: una portada con la URL rota no
 * puede dejar la ficha sin imagen habiendo otras sanas.
 *
 * B-907 — **una sola implementación para las cuatro guías**
 * (`lib/imagenesDeFicha.ts`), que además de la URL acota el tipo de `epigrafe`,
 * `ancho` y `alto`: la regla no puede mirar adentro de cada fila.
 */
const imagenesDeBiblioteca = (b: Biblioteca): ImagenDeBibliotecaPublica[] => imagenesDeFichaPublica(b.imagenes);

/**
 * **La frase del costo de asociarse, o vacío** — B-837, regla 1.
 *
 * `fraseConFecha` es lo que garantiza que el valor y su fecha salgan pegados o no
 * salga ninguno: **no hay forma de pedir el monto solo**, porque este módulo no
 * expone ninguna función que lo devuelva.
 *
 * El `formatear` es de acá porque el valor es de acá: se recorta y se deja tal
 * cual, que es lo que quien carga escribió («$3.000 por año», «gratis para
 * jubilados»). No se le agrega un `$` ni se lo intenta parsear — es texto
 * justamente porque el monto de un carnet casi nunca es un número solo (ver
 * `TOPE_COSTO_DE_ASOCIARSE_BIBLIOTECA`).
 *
 * **Y no sale cuando `haceFalta` es `false`**, aunque el documento traiga un
 * costo colgado: la regla y el schema lo prohíben, pero un documento anterior o
 * escrito por un script puede tenerlo, y publicar «no hace falta asociarse ·
 * $3.000» sería publicar una contradicción. Lo que la proyección no puede
 * verificar, lo descarta.
 */
const costoDeAsociarse = (b: Biblioteca): string => {
  if (!b.asociarse?.haceFalta) return '';
  return fraseConFecha(b.asociarse.costo, (v) => v.trim());
};

/**
 * **El índice de búsqueda de una biblioteca, derivado de los campos que sí se
 * publican** — §6, y la lección que el `auditor-privacidad` dejó escrita en
 * `searchTextDeLibreria` el 2026-09-15.
 *
 * ── Por qué no se copia el del documento ──────────────────────────────────
 * Porque `searchText` **se publica** —viaja en `/bibliotecas.json` para que el
 * listado filtre en memoria (§2.5)— y en el documento es un campo que **escribe
 * el cliente**. Los dos mil caracteres que la regla acota —`is string &&
 * size() <= 2000`, que es todo lo que una regla puede decir de una cadena
 * derivada— los elige cualquiera con un `curl`, y saldrían **verbatim** al JSON
 * el día que un admin publique la ficha.
 *
 * **Y es el único campo publicado que la bandeja no muestra:**
 * `bibliotecaAFormulario` no lo mapea, porque no es un campo del formulario. O
 * sea que el admin revisa nombre, dirección y descripción, aprieta publicar, y
 * sale un campo que nadie leyó — justo el agujero de «nada sale sin que un admin
 * lo mire».
 *
 * Con la derivación acá, el campo del documento deja de ser publicable.
 * `formABiblioteca` importa esta misma función para escribir el documento, así
 * que sigue habiendo **una sola** derivación (la clase de B-88) y el buscador del
 * panel y el del sitio dicen lo mismo.
 *
 * **Esta colección nace con la versión correcta**, que es lo que las otras tres
 * tuvieron que corregir después. Es el argumento de por qué el patrón se copia
 * de la última y no de la primera.
 */
export const searchTextDeBiblioteca = (c: {
  nombre: string;
  descripcion: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  provincia: string;
  /**
   * El slug del tipo entra al índice para que «biblioteca popular» encuentre las
   * populares. Va **requerido y no opcional**, por lo que cobró el
   * `auditor-privacidad` sobre `searchTextDeLibreria`: con el `?`, un llamador se
   * olvida de pasarlo y el índice del documento dice algo distinto del publicado.
   */
  tipo: string;
}): string =>
  normalize(
    [
      c.nombre,
      c.descripcion,
      c.direccion,
      /*
       * **Los slugs entran de las dos formas** — la lección de B-967.
       *
       * El índice diría `villa-crespo` y quien escribe «villa crespo» **no
       * encontraría nada**: el guion no coincide con el espacio y la búsqueda es
       * un `includes` sobre el texto normalizado. Se indexan el slug y su
       * des-slug en vez de resolver la etiqueta, porque acá **no hay opciones a
       * mano**: esta función la llaman la proyección y `formABiblioteca`, y
       * ninguna de las dos las tiene. Indexar de más no produce falsos negativos;
       * resolver mal, sí.
       */
      ...[c.barrio, c.ciudad, c.provincia, c.tipo].flatMap((slug) =>
        slug ? [slug, desSlug(slug)] : [],
      ),
    ].join(' '),
  ).trim();

/**
 * Documento → ficha pública. **Campo por campo, sin un solo spread.**
 *
 * No recibe el id del documento y eso es deliberado: la ficha se direcciona por
 * `slug` (trampa 10) y el id de Firestore no tiene ningún consumidor público.
 */
export const bibliotecaPublica = (b: Biblioteca): BibliotecaPublica => ({
  slug: b.slug,
  nombre: b.nombre,
  descripcion: b.descripcion ?? '',
  tipo: b.tipo ?? '',
  direccion: b.direccion,
  horarios: b.horarios ?? '',
  horarioDeSala: b.horarioDeSala ?? '',
  asociarse: {
    haceFalta: Boolean(b.asociarse?.haceFalta),
    costo: costoDeAsociarse(b),
  },
  catalogo: urlSegura(b.catalogo),
  /*
   * **Se deriva, no se copia**, igual que en `toPublic` (D-710): una ficha
   * anterior guarda la ciudad como se tipeó y sin provincia, y copiarla verbatim
   * publicaría un valor que no matchea ningún chip.
   */
  ...geografiaNormalizada(b),
  geo: b.geo ? { lat: b.geo.lat, lng: b.geo.lng } : null,
  imagenes: imagenesDeBiblioteca(b),
  instagram: handleInstagram(b.instagram),
  whatsapp: whatsappPublicable(b.whatsapp),
  web: urlSegura(b.web),
  mail: mailPublicable(b.mail),
  /*
   * ⚠️ **Derivado y NO copiado del documento** — ver `searchTextDeBiblioteca`.
   * `b.searchText` es un campo que escribe el cliente, y ese cliente puede ser
   * un anónimo.
   */
  searchText: searchTextDeBiblioteca({
    nombre: b.nombre,
    descripcion: b.descripcion ?? '',
    direccion: b.direccion,
    tipo: b.tipo ?? '',
    ...geografiaNormalizada(b),
  }),
});

/**
 * La `meta description` de la ficha de una biblioteca.
 *
 * ── Por qué vive acá y no en la plantilla ────────────────────────────────
 * El argumento es el que el `auditor-privacidad` fijó para `descripcionDeLibreria`:
 * una frase armada interpolando campos **dentro de un `.astro`** es un productor
 * de texto público que vitest no puede importar, así que no se puede barrer. Hoy
 * los campos que usa son públicos y no filtra nada; lo que cambia es qué pasa
 * mañana, cuando alguien sume un campo al view-model y esta línea lo publique en
 * el `<head>` sin que nada se ponga rojo.
 *
 * La descripción cargada gana cuando existe: la escribió quien conoce la
 * biblioteca. El respaldo es la ficha mínima —qué es, dónde queda— y no una
 * frase de relleno: una `meta description` vacía la inventa Google con el primer
 * párrafo que encuentre.
 */
export const descripcionDeBiblioteca = (f: FichaDeBiblioteca): string =>
  f.descripcion || `${f.nombre}: biblioteca en ${f.barrio || f.ciudad}. ${f.direccion}.`;

/**
 * La `meta description` del listado.
 *
 * Vive al lado de la anterior por lo mismo, aunque ésta **no interpole ningún
 * campo de ninguna ficha**: son las dos frases de la misma salida, y separarlas
 * dejaría la mitad barrida y la mitad no.
 */
export const descripcionDelDirectorio = (cuantas: number): string =>
  cuantas === 0
    ? 'Bibliotecas: dónde sacar libros, en qué barrio, con qué horario de sala y si hay que asociarse.'
    : `${cuantas} ${cuantas === 1 ? 'biblioteca' : 'bibliotecas'}: dónde sacar libros, ` +
      'con qué horario de sala y si hay que asociarse.';

// ─────────────────────────────────────────────────────────────────
// El índice: `/bibliotecas.json`
// ─────────────────────────────────────────────────────────────────

/**
 * El artefacto que baja el listado.
 *
 * **Propio y no adentro de `events.json`**: aquél lo baja **toda** persona que
 * abre la agenda, y sumarle un catálogo que el 90% no va a mirar le cobra el peso
 * a la mayoría. Es la misma lógica con la que el panel se corta del bundle
 * público (§9).
 *
 * `filtros` viaja adentro por lo mismo que las opciones viajan en el
 * `events.json` (§4.4): los chips se arman recorriéndolo, así que una etiqueta
 * renombrada aparece sola y nada queda hardcodeado en el island.
 */
export interface IndiceDeBibliotecas {
  generadoEn: string;
  version: string;
  /** Solo los valores **con alguna biblioteca publicada detrás**: un chip vacío es ruido. */
  filtros: Record<EjeDeBiblioteca, OpcionPublica[]>;
  bibliotecas: BibliotecaPublica[];
}

/**
 * Los ejes de filtro de la guía, en el orden de la pantalla.
 *
 * Los dos niveles de la geografía primero —`provincia`, y de lo que se elija ahí
 * depende si abajo se ofrece `barrio` (CABA) o `ciudad` (las otras 23), regla que
 * vive en `muestraEjeDeGeografia` y acá no se reescribe— y después `tipo`, que
 * es el eje propio de esta entidad.
 *
 * **`asociarse` no es un eje acá y sí un filtro del buscador**, y la diferencia
 * importa: los ejes de este registro son taxonomías de `/opciones/*` que se
 * pintan como chips con su etiqueta, y «hace falta asociarse» es un booleano
 * derivado que no vive en ninguna taxonomía. Lo resuelve el island con un toggle
 * propio (`BuscadorDeBibliotecas.tsx`), leyendo `asociarse.haceFalta` de cada
 * ficha. Meterlo acá obligaría a inventarle un vocabulario de dos valores y a que
 * el JSON lo publicara como si fuera una opción renombrable, que no lo es.
 */
export const EJES_DE_BIBLIOTECA = ['provincia', 'barrio', 'ciudad', 'tipo-biblioteca'] as const;
export type EjeDeBiblioteca = (typeof EJES_DE_BIBLIOTECA)[number];

/** De qué campo de la ficha sale cada eje. Un solo lugar: de él salen el recorte y los chips. */
const VALORES_DEL_EJE: Record<EjeDeBiblioteca, (b: BibliotecaPublica) => string[]> = {
  provincia: (b) => (b.provincia ? [b.provincia] : []),
  barrio: (b) => (b.barrio ? [b.barrio] : []),
  ciudad: (b) => (b.ciudad ? [b.ciudad] : []),
  /*
   * **La clave es el nombre de la taxonomía y el valor sale del campo**, que no
   * se llaman igual: el documento dice `tipo` y `/opciones/tipo-biblioteca` es
   * el vocabulario. Es la misma asimetría que `tipo-lugar`, y es lo que hace que
   * `indiceDeDirectorio` pueda armar los vocabularios recorriendo los ejes sin
   * una tabla de traducción — si el eje se llamara `tipo`, buscaría
   * `/opciones/tipo`, que es la taxonomía de una **actividad**.
   */
  'tipo-biblioteca': (b) => (b.tipo ? [b.tipo] : []),
};

/**
 * Arma el índice.
 *
 * Los vocabularios se recortan a los valores que alguna ficha usa —y no la
 * taxonomía entera— porque `/opciones/*` la comparten las actividades: sin el
 * recorte, el filtro ofrecería cuarenta barrios de los que treinta y cinco no
 * tienen ninguna biblioteca, y cada uno de esos chips es una promesa de cero
 * resultados. Es el mismo criterio con el que un hub sin nada vigente no entra al
 * sitemap (B-108).
 *
 * El orden lo decide la taxonomía (`opcionesPublicas` respeta el de `/opciones`),
 * no este módulo: es el mismo orden que el desplegable del panel.
 */
export const construirIndiceDeBibliotecas = ({
  bibliotecas,
  vocabularios,
  version,
  generadoEn,
}: {
  bibliotecas: readonly BibliotecaPublica[];
  vocabularios: Partial<Record<EjeDeBiblioteca, readonly ValorOpcion[]>>;
  version: string;
  generadoEn: string;
}): IndiceDeBibliotecas => {
  const filtros = Object.fromEntries(
    EJES_DE_BIBLIOTECA.map((eje) => {
      const usados = new Set(bibliotecas.flatMap((b) => VALORES_DEL_EJE[eje](b)));
      return [
        eje,
        opcionesPublicas([...(vocabularios[eje] ?? [])]).filter((v) => usados.has(v.slug)),
      ];
    }),
  ) as Record<EjeDeBiblioteca, OpcionPublica[]>;

  return {
    generadoEn,
    version,
    filtros,
    bibliotecas: [...bibliotecas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
};

// ─────────────────────────────────────────────────────────────────
// La ficha: `/guia/bibliotecas/{slug}`
// ─────────────────────────────────────────────────────────────────

/** Una pieza del renglón de lugar. `href` es `null` cuando ese hub no existe. */
export interface PiezaDeZona {
  texto: string;
  href: string | null;
}

/**
 * Todo lo que la página de una biblioteca necesita, y **nada más** — el
 * view-model de D-140.
 *
 * La plantilla `.astro` no ve el documento ni la proyección cruda: recibe esto,
 * con los `href` ya armados. Es la misma frontera que `DetallePublico` le pone a
 * `actividad/[slug].astro`, y lo que hace que la salida sea barrible desde un
 * test (un `.astro` no se importa desde vitest).
 */
export interface FichaDeBiblioteca {
  slug: string;
  nombre: string;
  descripcion: string;
  /** La etiqueta del tipo ya resuelta: la página no ve la taxonomía. `''` si no hay. */
  tipo: string;
  direccion: string;
  /** Texto libre. No entra al JSON-LD: ver `TOPE_HORARIOS_BIBLIOTECA`. */
  horarios: string;
  /** Texto libre. Tampoco entra al JSON-LD, por lo mismo. */
  horarioDeSala: string;
  /** La frase ya armada, con su fecha pegada. Vacía cuando no hay que mostrar nada. */
  asociarse: { haceFalta: boolean; costo: string };
  catalogo: string | null;
  /** La etiqueta del barrio ya resuelta. */
  barrio: string;
  /**
   * A dónde lleva el barrio, o `null`.
   *
   * **Solo si el hub existe de verdad.** `/barrio/{slug}` lo emite el build para
   * los barrios que tienen alguna actividad (`hubsPublicos.ts`), así que linkear
   * a ciegas publicaría un 404 en cada ficha de un barrio sin actividades — que
   * son justo los que este directorio puede estrenar.
   */
  rutaDelBarrio: string | null;
  ciudad: string;
  rutaDeLaCiudad: string | null;
  /** La etiqueta de la provincia. **No se enlaza**: no hay hub de provincia. */
  provincia: string;
  /**
   * **El renglón de lugar, en piezas y con la regla de CABA aplicada.**
   *
   * Misma forma que `DetallePublico.donde` (B-951) y sale de la misma
   * `piezasDeLugar`: adentro de CABA se dice el barrio y nada más —«Villa Crespo
   * · CABA» era decir la ciudad dos veces— y afuera la ciudad y la provincia.
   */
  zona: PiezaDeZona[];
  geo: { lat: number; lng: number } | null;
  imagenes: ImagenDeBibliotecaPublica[];
  /** Los contactos y el catálogo, ya como destino. `null` es «no hay por dónde». */
  enlaces: {
    instagram: string | null;
    whatsapp: string | null;
    web: string | null;
    mail: string | null;
    catalogo: string | null;
  };
  /** La ruta relativa, en la forma que contesta 200 (B-330). */
  ruta: string;
  /** La absoluta: el `url` del JSON-LD. La canónica y el OG los pone `Base.astro`. */
  url: string;
}

/**
 * Proyección → ficha. Acá se arman los `href` y se resuelven las etiquetas;
 * **no se agrega ningún campo del documento** que la proyección no haya dejado
 * pasar, que es lo que mantiene la whitelist en un solo lugar.
 */
export const fichaDeBiblioteca = (
  b: BibliotecaPublica,
  {
    etiquetaDeBarrio,
    rutaDelBarrio = null,
    etiquetaDeCiudad,
    rutaDeLaCiudad = null,
    etiquetaDeProvincia,
    etiquetaDeTipo,
  }: {
    etiquetaDeBarrio?: string;
    rutaDelBarrio?: string | null;
    etiquetaDeCiudad?: string;
    rutaDeLaCiudad?: string | null;
    etiquetaDeProvincia?: string;
    etiquetaDeTipo?: string;
  } = {},
): FichaDeBiblioteca => ({
  slug: b.slug,
  nombre: b.nombre,
  descripcion: b.descripcion,
  tipo: etiquetaDeTipo ?? b.tipo,
  direccion: b.direccion,
  horarios: b.horarios,
  horarioDeSala: b.horarioDeSala,
  asociarse: b.asociarse,
  catalogo: b.catalogo,
  barrio: etiquetaDeBarrio ?? b.barrio,
  rutaDelBarrio,
  ciudad: etiquetaDeCiudad ?? b.ciudad,
  rutaDeLaCiudad,
  provincia: etiquetaDeProvincia ?? b.provincia,
  zona: piezasDeLugar(b).map(({ campo, slug }) => ({
    texto:
      campo === 'barrio'
        ? (etiquetaDeBarrio ?? slug)
        : campo === 'ciudad'
          ? (etiquetaDeCiudad ?? slug)
          : (etiquetaDeProvincia ?? slug),
    href: campo === 'barrio' ? rutaDelBarrio : campo === 'ciudad' ? rutaDeLaCiudad : null,
  })),
  geo: b.geo,
  imagenes: b.imagenes,
  enlaces: {
    instagram: b.instagram ? `https://instagram.com/${b.instagram}` : null,
    whatsapp: b.whatsapp ? `https://wa.me/${b.whatsapp}` : null,
    web: b.web,
    mail: b.mail ? `mailto:${b.mail}` : null,
    catalogo: b.catalogo,
  },
  ruta: rutaDeBiblioteca(b.slug),
  url: urlAbsoluta(rutaDeBiblioteca(b.slug)),
});

/**
 * `Library` — el marcado estructurado de la ficha, y donde está el SEO de este
 * directorio.
 *
 * `Library` es el subtipo de `LocalBusiness` que schema.org tiene para esto, y es
 * a `BookStore` lo que una biblioteca es a una librería. Es el mismo movimiento
 * que `datosEstructuradosDeLibreria`, con otro tipo.
 *
 * **Sin `openingHours`, y es la misma decisión de B-982**: los dos horarios son
 * texto libre, y `schema.org/openingHours` quiere un formato fijo. Un horario
 * inventado es peor que ninguno — Google lo muestra como un hecho y quien va se
 * encuentra la puerta cerrada. Entra el día que el campo se estructure.
 *
 * **Y sin el costo de asociarse**, que es la parte que hay que respetar: la
 * proyección lo publica como **frase con fecha** justamente para que no se pueda
 * leer como un precio comparable, y un `priceRange` o un `Offer` con ese texto
 * adentro deshace eso en la salida que más lo amplifica. Es la regla 2 de
 * `datoConFecha.ts` (D-570) aplicada al JSON-LD, y es exactamente lo que DEC-12
 * decidió para el precio de una suscripción.
 *
 * `sameAs` lleva solo los perfiles que existen, `image` solo las imágenes que
 * sobrevivieron al saneo y `geo` solo si está: una clave con `null` adentro es un
 * dato mal declarado, y el validador de Google lo trata como error en vez de como
 * ausencia.
 */
export const datosEstructuradosDeBiblioteca = (f: FichaDeBiblioteca): Record<string, unknown> => {
  const sameAs = [f.enlaces.instagram, f.enlaces.web, f.enlaces.catalogo].filter(
    (u): u is string => u !== null,
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'Library',
    name: f.nombre,
    url: f.url,
    ...(f.descripcion ? { description: f.descripcion } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: f.direccion,
      addressLocality: f.ciudad,
      ...(f.provincia ? { addressRegion: f.provincia } : {}),
      addressCountry: 'AR',
    },
    ...(f.geo
      ? { geo: { '@type': 'GeoCoordinates', latitude: f.geo.lat, longitude: f.geo.lng } }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(f.imagenes.length > 0 ? { image: f.imagenes.map((i) => i.url) } : {}),
  };
};

/**
 * Las migas de la ficha: agenda → Guía → Bibliotecas → esta biblioteca.
 *
 * Misma forma que `migasDeLibreria`: los tres ancestros existen siempre, así que
 * las posiciones son fijas.
 */
export const migasDeBiblioteca = (f: FichaDeBiblioteca): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: NOMBRE, item: urlAbsoluta(RUTA_AGENDA) },
    { '@type': 'ListItem', position: 2, name: 'Guía', item: urlAbsoluta(RUTA_GUIA) },
    { '@type': 'ListItem', position: 3, name: 'Bibliotecas', item: urlAbsoluta(RUTA_BIBLIOTECAS) },
    { '@type': 'ListItem', position: 4, name: f.nombre, item: f.url },
  ],
});

/**
 * `CollectionPage` + `ItemList` para el listado, con la misma forma que
 * `coleccionSchema` le da a la home y a los hubs (§5.5 del diseño).
 *
 * No se reusa aquella función porque arma los `item` con `urlDeDetalle`, que es
 * la ruta de una **actividad**: pasarle bibliotecas publicaría `/actividad/{slug}`
 * para cada una, o sea un `ItemList` de URLs que dan 404. Es la misma razón por
 * la que la proyección no se generaliza.
 *
 * `null` con la lista vacía: un `ItemList` sin elementos no ayuda a entender la
 * página.
 */
export const coleccionDeBibliotecas = (
  bibliotecas: readonly BibliotecaPublica[],
): Record<string, unknown> | null => {
  if (bibliotecas.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Bibliotecas',
    url: urlAbsoluta(RUTA_BIBLIOTECAS),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: bibliotecas.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: urlAbsoluta(rutaDeBiblioteca(b.slug)),
        name: b.nombre,
      })),
    },
  };
};
