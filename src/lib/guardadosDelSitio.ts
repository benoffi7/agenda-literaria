/**
 * Lo que una persona guarda en el sitio público: **favoritos** y **búsquedas
 * guardadas** — B-848, **D-630**.
 *
 * ── «Sin login» es la decisión, y es la que hace que esto sea barato ──────
 * No hay cuenta, así que no hay nada que guardar del lado nuestro: todo vive en
 * el `localStorage` del navegador de cada uno. Es el mismo patrón que el panel
 * usa para los borradores (D-122) y para el consentimiento del banner
 * (`analyticsSitio.ts`), y es lo que hace que el sitio siga sin guardar un dato
 * de nadie — la promesa que sostiene B-102 y que afirma `07-seguridad.md`.
 *
 * **Este archivo es puro y no toca el navegador.** `window`, `document` y
 * `localStorage` viven en `guardadoDelNavegador.ts`, que es el único que puede
 * fallar por una ventana privada o una cuota llena. Acá todo es determinístico y
 * se testea sin DOM — el mismo corte que `analyticsSitio.ts` / `medicionSitio.ts`.
 *
 * ── Lo guardado lleva el tipo y la versión desde el día uno ───────────────
 * **Es la decisión del ítem, y no es un cálculo.** Son datos que **no podemos
 * ver ni migrar**: el día que haya que cambiarles la forma, lo guardado no se
 * convierte solo — o se pierde, o hay que leerlo con un default para siempre.
 *
 * | Campo | Por qué está hoy, con una sola entidad |
 * |---|---|
 * | `v` | sin número de versión, un formato nuevo tiene que **adivinar** si lo que leyó es viejo o corrupto, y las dos respuestas son destructivas |
 * | `tipo` | el dueño ya contestó que el favorito es genérico —«puede ser un evento, una librería, una suscripción…»—. Guardar solo el slug y tener que adivinar de qué era, cuando existan las cuatro entidades, no tiene arreglo bueno |
 *
 * La llave es **`tipo` + `slug`**, y funciona porque el slug es **inmutable
 * después de publicar** (trampa 10): un favorito sobrevive a que le editen el
 * título, la sede o la fecha. Hoy `TIPOS_GUARDABLES` tiene un solo valor y eso es
 * lo esperado — las otras tres entidades son las tajadas 2 a 4 de `docs/prd/`, y
 * cada una entra agregando su tipo acá y su fila en la sección.
 *
 * ── Una búsqueda guardada es una URL con un nombre ────────────────────────
 * Los filtros del listado **ya viajan en la query string** (`aQuery` /
 * `desdeQuery` de `listadoPublico.ts`), así que no hay ninguna serialización que
 * inventar: guardar un filtro es guardar la ruta con su query. Y por eso **no
 * lleva `tipo`**, a diferencia del favorito: de qué listado es ya está en el
 * path (`/` hoy, `/librerias` el día que exista), mientras que un slug suelto no
 * dice de qué era. Sí lleva `v`, por el mismo motivo que arriba.
 *
 * ── Lo que se lee de acá se valida como si viniera de afuera ──────────────
 * Es `localStorage`: lo escribe este código, pero lo puede editar cualquiera con
 * la consola abierta, y **el `url` termina en un `href`**. Un `javascript:…`
 * guardado a mano sería XSS en la propia máquina, y un `//otro.sitio` un redirect
 * afuera con la cara del sitio. Por eso `esRutaGuardable` exige una ruta interna
 * y `esSlugGuardable` el alfabeto que produce `slugify` (`[a-z0-9-]`): lo que no
 * pasa **se descarta en silencio**, nunca rompe la página.
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';

// ─────────────────────────────────────────────────────────────────
// La forma de lo guardado
// ─────────────────────────────────────────────────────────────────

/**
 * La versión del formato. **Se sube cuando cambia la forma de lo guardado**, y
 * entonces lo que tenga otro número se descarta al leer: un favorito viejo
 * interpretado con el formato nuevo es peor que ningún favorito, porque parece
 * bueno.
 *
 * Es el mismo criterio que `VERSION_BORRADOR` del panel, con una diferencia que
 * importa: allá el dato es recuperable (está en Firestore) y acá **no hay copia
 * en ninguna parte**. Por eso subir este número es tirar lo de todo el mundo, y
 * la decisión de subirlo se toma con eso escrito adelante.
 */
export const VERSION_GUARDADOS = 1;

/**
 * Qué se puede guardar. **Hoy una sola cosa, y la lista existe igual**: es el
 * `tipo` que viaja en cada favorito, y es lo único que hay que tocar acá el día
 * que exista la segunda entidad.
 */
export const TIPOS_GUARDABLES = ['actividad'] as const;
export type TipoGuardable = (typeof TIPOS_GUARDABLES)[number];

export interface Favorito {
  v: number;
  tipo: TipoGuardable;
  slug: string;
  /** ISO-8601 de cuándo se guardó. Ordena la sección: lo último arriba. */
  guardadoEn: string;
}

export interface BusquedaGuardada {
  v: number;
  /** El nombre que le puso quien la guardó. Se muestra tal cual, recortado. */
  nombre: string;
  /** La ruta interna con su query — `/?tag=poesia&cuando=este-mes`. */
  url: string;
  guardadoEn: string;
}

/** Las dos claves de `localStorage`, con el mismo prefijo que el consentimiento. */
export const CLAVE_FAVORITOS = 'agenda:favoritos';
export const CLAVE_BUSQUEDAS = 'agenda:busquedas';

/**
 * La forma mínima de `localStorage` que hace falta, como puerto: así todo esto
 * se testea sin un navegador y sin mockear el global entero. Es el mismo recurso
 * que usan `AlmacenConsentimiento` (`analyticsSitio.ts`) y `AlmacenLocal`
 * (`formulario/borradoresDelNavegador.ts`), declarado acá y no importado de
 * ninguno de los dos: el sitio público no importa nada del panel
 * (`tests/panel-fuera-del-sitio.test.ts`), y el del banner no tiene `removeItem`.
 */
export interface AlmacenDelSitio {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

/**
 * Cuántas búsquedas guardadas se admiten.
 *
 * **El tope existe y los favoritos no tienen ninguno**, y la asimetría es a
 * propósito. Una búsqueda guardada es una fila de una lista que se mira entera
 * para elegir: pasadas veinte deja de servir para lo que existe. Un favorito es
 * una colección — que alguien tenga ochenta es que el sitio le sirve, y
 * **descartar uno en silencio para hacer lugar sería perder un dato que no
 * tenemos cómo devolverle**. Así que acá se **rechaza** al llegar al tope, con
 * un motivo que la pantalla dice; nunca se tira lo más viejo.
 */
export const MAXIMO_BUSQUEDAS = 20;

/** Cuánto se recorta el nombre de una búsqueda guardada. */
export const LARGO_MAXIMO_NOMBRE = 60;

/** Cuánto puede medir la ruta guardada. Diez ejes con varios valores entran de sobra. */
const LARGO_MAXIMO_RUTA = 500;

// ─────────────────────────────────────────────────────────────────
// Validación de lo que se lee
// ─────────────────────────────────────────────────────────────────

/**
 * El alfabeto que produce `slugify` (§4.2): minúsculas, dígitos y guiones.
 *
 * Se valida porque el slug se interpola en una ruta (`rutaDeDetalle`) y termina
 * en un `href`. No alcanza con «es un string»: `../../admin` también lo es.
 */
export const esSlugGuardable = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valor) && valor.length <= 120;

/**
 * ¿Es una ruta **interna** de este sitio, con su query?
 *
 * Las cuatro exclusiones, cada una por su ataque:
 *
 * | Se rechaza | Qué sería si no |
 * |---|---|
 * | lo que no arranca con `/` | `javascript:alert(1)` o `https://otro.sitio` en un `href` |
 * | `//` al principio | una URL **protocolo-relativa**: `//otro.sitio` es absoluta y no lo parece |
 * | la barra invertida | algunos navegadores normalizan `\\` a `/`, así que `/\\otro.sitio` es el caso de arriba disfrazado |
 * | los caracteres de control | un `\n` parte cualquier cosa que después se serialice por líneas |
 */
export const esRutaGuardable = (valor: unknown): valor is string =>
  typeof valor === 'string' &&
  valor.length > 0 &&
  valor.length <= LARGO_MAXIMO_RUTA &&
  valor.startsWith('/') &&
  !valor.startsWith('//') &&
  !valor.includes('\\') &&
  // eslint-disable-next-line no-control-regex
  !/[\u0000-\u001f\u007f]/.test(valor);

const esTipoGuardable = (valor: unknown): valor is TipoGuardable =>
  typeof valor === 'string' && (TIPOS_GUARDABLES as readonly string[]).includes(valor);

const esFechaGuardada = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.length > 0 && valor.length <= 40;

const objetos = (crudo: string | null): Record<string, unknown>[] => {
  if (!crudo) return [];
  let leido: unknown;
  try {
    leido = JSON.parse(crudo);
  } catch {
    // Un JSON roto es exactamente igual de útil que no tener nada: se descarta y
    // la página se dibuja vacía. Nunca una excepción que voltee la sección.
    return [];
  }
  if (!Array.isArray(leido)) return [];
  return leido.filter(
    (x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x),
  );
};

/**
 * Los favoritos de un texto crudo. **Todo lo que no pase entero se descarta**:
 * media entrada válida no es una entrada.
 *
 * Sin duplicados por `tipo`+`slug` —dos veces la misma actividad es una fila
 * repetida en la sección— y **conservando el orden en que estaban**, que es el
 * que escribe `conFavoritoAlternado`: lo último guardado primero.
 */
export const favoritosDeTexto = (crudo: string | null): Favorito[] => {
  const vistos = new Set<string>();
  const salida: Favorito[] = [];
  for (const o of objetos(crudo)) {
    if (o.v !== VERSION_GUARDADOS) continue;
    if (!esTipoGuardable(o.tipo)) continue;
    if (!esSlugGuardable(o.slug)) continue;
    if (!esFechaGuardada(o.guardadoEn)) continue;
    const llave = llaveDeFavorito(o.tipo, o.slug);
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    salida.push({ v: VERSION_GUARDADOS, tipo: o.tipo, slug: o.slug, guardadoEn: o.guardadoEn });
  }
  return salida;
};

/** Las búsquedas guardadas de un texto crudo. Mismas reglas, y la llave es la `url`. */
export const busquedasDeTexto = (crudo: string | null): BusquedaGuardada[] => {
  const vistas = new Set<string>();
  const salida: BusquedaGuardada[] = [];
  for (const o of objetos(crudo)) {
    if (o.v !== VERSION_GUARDADOS) continue;
    if (!esRutaGuardable(o.url)) continue;
    if (!esFechaGuardada(o.guardadoEn)) continue;
    const nombre = nombreLimpio(o.nombre);
    if (!nombre) continue;
    if (vistas.has(o.url)) continue;
    vistas.add(o.url);
    salida.push({ v: VERSION_GUARDADOS, nombre, url: o.url, guardadoEn: o.guardadoEn });
  }
  /*
   * **No se recorta al tope acá.** El tope lo hace cumplir la escritura
   * (`conBusquedaGuardada`); recortar al leer tiraría en silencio lo que alguien
   * ya tiene guardado —si el número bajara, o si la lista vino de otra pestaña—,
   * y perder un dato que no tenemos cómo devolver es justo lo que el comentario
   * de `MAXIMO_BUSQUEDAS` dice que no se hace. Con más de las que entran, lo que
   * pasa es que no se puede agregar otra.
   */
  return salida;
};

/** El texto que se escribe. Un solo lugar, para que las dos claves se serialicen igual. */
export const aTexto = (lista: readonly unknown[]): string => JSON.stringify(lista);

// ─────────────────────────────────────────────────────────────────
// El almacén, por el puerto
// ─────────────────────────────────────────────────────────────────
//
// **Las cuatro funciones que tocan el almacén viven acá y no en el transporte**,
// igual que `leerConsentimiento`/`guardarConsentimiento` en `analyticsSitio.ts`.
// Dos motivos, y el segundo no se ve venir:
//
// 1. Reciben el almacén como puerto, así que se testean con un objeto de tres
//    métodos y sin navegador — que es todo lo que hace falta verificar acá.
// 2. **El barrido de claves de `tests/clases-de-bug.test.ts` mira los archivos
//    que llaman a `getItem`/`setItem`/`removeItem`.** Con las llamadas en otro
//    archivo, la clave declarada acá quedaría fuera del barrido y podría nacer
//    sin su fila en la tabla de `07-seguridad.md`. Es la misma trampa que el
//    barrido existe para atrapar, en el archivo que lo esquiva.

export const leerFavoritosDe = (almacen: AlmacenDelSitio): Favorito[] =>
  favoritosDeTexto(almacen.getItem(CLAVE_FAVORITOS));

export const leerBusquedasDe = (almacen: AlmacenDelSitio): BusquedaGuardada[] =>
  busquedasDeTexto(almacen.getItem(CLAVE_BUSQUEDAS));

/**
 * Escribe una lista, y **con la lista vacía borra la clave**.
 *
 * Dejar un `[]` colgado en el navegador de alguien que sacó todo es guardarle un
 * dato que ya no significa nada — y en la única función del sitio cuya promesa
 * es «esto vive solo en tu navegador», que quede una marca después de vaciarla
 * es exactamente lo que no puede pasar.
 */
const escribirEn = (almacen: AlmacenDelSitio, clave: string, lista: readonly unknown[]): void => {
  if (lista.length === 0) almacen.removeItem(clave);
  else almacen.setItem(clave, aTexto(lista));
};

export const escribirFavoritosEn = (
  almacen: AlmacenDelSitio,
  lista: readonly Favorito[],
): void => escribirEn(almacen, CLAVE_FAVORITOS, lista);

export const escribirBusquedasEn = (
  almacen: AlmacenDelSitio,
  lista: readonly BusquedaGuardada[],
): void => escribirEn(almacen, CLAVE_BUSQUEDAS, lista);

// ─────────────────────────────────────────────────────────────────
// Favoritos
// ─────────────────────────────────────────────────────────────────

/** La llave de un favorito: **tipo + slug**, nunca el slug solo. */
export const llaveDeFavorito = (tipo: TipoGuardable, slug: string): string => `${tipo}:${slug}`;

export const esFavorito = (
  lista: readonly Favorito[],
  tipo: TipoGuardable,
  slug: string,
): boolean => lista.some((f) => f.tipo === tipo && f.slug === slug);

/** Sin el favorito, si estaba. No muta la lista que recibe. */
export const sinFavorito = (
  lista: readonly Favorito[],
  tipo: TipoGuardable,
  slug: string,
): Favorito[] => lista.filter((f) => !(f.tipo === tipo && f.slug === slug));

/**
 * Marca o desmarca. **Lo nuevo va adelante**: la sección lo lee en ese orden y
 * lo último guardado es lo que se está buscando.
 *
 * Un slug que no pasa la validación **no se guarda y no rompe**: devuelve la
 * lista igual. El único llamador le pasa el slug de la página en la que está, así
 * que esto no puede pasar hoy — y por eso mismo no puede fallar ruidosamente el
 * día que un llamador nuevo se equivoque.
 */
export const conFavoritoAlternado = (
  lista: readonly Favorito[],
  tipo: TipoGuardable,
  slug: string,
  ahora: Date,
): Favorito[] => {
  if (!esSlugGuardable(slug)) return [...lista];
  if (esFavorito(lista, tipo, slug)) return sinFavorito(lista, tipo, slug);
  return [{ v: VERSION_GUARDADOS, tipo, slug, guardadoEn: ahora.toISOString() }, ...lista];
};

// ─────────────────────────────────────────────────────────────────
// Búsquedas guardadas
// ─────────────────────────────────────────────────────────────────

/** El nombre, recortado y con el largo topeado. `''` si no queda nada. */
export const nombreLimpio = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim().slice(0, LARGO_MAXIMO_NOMBRE) : '';

/**
 * Por qué no se pudo guardar una búsqueda. **Es un motivo y no un booleano**
 * porque los tres se arreglan distinto y la pantalla tiene que decir cuál es:
 * ponerle nombre, volver al listado, o borrar una de las guardadas.
 */
export type MotivoDeRechazo = 'sin-nombre' | 'ruta-invalida' | 'tope';

export type ResultadoDeGuardado =
  | { ok: true; lista: BusquedaGuardada[] }
  | { ok: false; motivo: MotivoDeRechazo };

/**
 * Agrega una búsqueda guardada. **La llave es la `url`**: guardar dos veces el
 * mismo filtro no deja dos filas que hacen lo mismo — se le pisa el nombre y
 * sube al principio, que es lo que quiso hacer quien lo guardó de nuevo.
 *
 * Y por eso **pisar no cuenta contra el tope**: el rechazo por `'tope'` es para
 * la vigésimo primera búsqueda *distinta*, no para renombrar una que ya está.
 */
export const conBusquedaGuardada = (
  lista: readonly BusquedaGuardada[],
  entrada: { nombre: unknown; url: unknown },
  ahora: Date,
): ResultadoDeGuardado => {
  const nombre = nombreLimpio(entrada.nombre);
  if (!nombre) return { ok: false, motivo: 'sin-nombre' };
  if (!esRutaGuardable(entrada.url)) return { ok: false, motivo: 'ruta-invalida' };
  const resto = lista.filter((b) => b.url !== entrada.url);
  if (resto.length === lista.length && lista.length >= MAXIMO_BUSQUEDAS) {
    return { ok: false, motivo: 'tope' };
  }
  return {
    ok: true,
    lista: [{ v: VERSION_GUARDADOS, nombre, url: entrada.url, guardadoEn: ahora.toISOString() }, ...resto],
  };
};

/** Sin la búsqueda de esa ruta, si estaba. No muta la lista que recibe. */
export const sinBusquedaGuardada = (
  lista: readonly BusquedaGuardada[],
  url: string,
): BusquedaGuardada[] => lista.filter((b) => b.url !== url);

// ─────────────────────────────────────────────────────────────────
// Resolver contra el índice del build
// ─────────────────────────────────────────────────────────────────

/**
 * Un favorito con la actividad que le corresponde, **o sin ella**.
 *
 * El sitio es estático: la sección resuelve contra el `events.json` del último
 * build, y ahí puede no estar — la actividad se despublicó, se canceló o se
 * borró. **Eso no es un error y tiene que verse**: el favorito sigue siendo suyo
 * y tiene que poder sacarlo, así que la fila se dibuja igual y dice qué pasó.
 * Esconderla sería hacer desaparecer algo que la persona guardó sin decirle nada.
 */
export interface FavoritoResuelto {
  favorito: Favorito;
  /** `null` = el slug ya no está en la agenda. */
  ficha: EntradaDeIndice | null;
}

/**
 * Los favoritos con su actividad, **lo último guardado primero**.
 *
 * El orden sale de `guardadoEn` y no del orden del array, y no es lo mismo: el
 * array lo puede haber escrito otra pestaña, otra versión o una mano en la
 * consola. Empate → se conserva el orden en que venían, que es estable.
 */
export const resolverFavoritos = (
  lista: readonly Favorito[],
  entradas: readonly EntradaDeIndice[],
): FavoritoResuelto[] => {
  const porSlug = new Map(entradas.map((e) => [e.slug, e]));
  return lista
    .map((favorito, orden) => ({
      favorito,
      orden,
      // Hoy solo hay un tipo, y el `switch` implícito sería una mentira: cuando
      // exista el segundo, un favorito de librería no se busca en este mapa.
      ficha: favorito.tipo === 'actividad' ? (porSlug.get(favorito.slug) ?? null) : null,
    }))
    .sort((a, b) => b.favorito.guardadoEn.localeCompare(a.favorito.guardadoEn) || a.orden - b.orden)
    .map(({ favorito, ficha }) => ({ favorito, ficha }));
};

/**
 * Cuántos favoritos ya no están en la agenda. Es la línea de aviso de la sección.
 */
export const cuantosSinFicha = (resueltos: readonly FavoritoResuelto[]): number =>
  resueltos.filter((r) => r.ficha === null).length;
