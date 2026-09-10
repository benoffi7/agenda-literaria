/**
 * El transporte de lo que se guarda en el sitio público — B-848.
 *
 * Qué se guarda, con qué forma y **bajo qué clave** lo decide
 * `guardadosDelSitio.ts`, que es puro y está testeado; acá está lo único que
 * toca `window.localStorage`. Es el mismo corte que `analyticsSitio.ts` /
 * `medicionSitio.ts`, y por el mismo motivo: este archivo no tiene test propio
 * porque no hay lógica que verificar — lo que hay es un `try`/`catch` alrededor
 * de cada acceso.
 *
 * ── Por qué cada acceso va en `try`/`catch`, y no solo el primero ────────
 * `localStorage` no falla de una sola manera:
 *
 * | Cuándo | Qué pasa |
 * |---|---|
 * | ventana privada de algunos navegadores, o el almacenamiento del sitio bloqueado | el **accesor** `window.localStorage` tira, antes de leer nada |
 * | cuota llena | tira el `setItem`, no el `getItem` |
 * | datos del sitio borrados, u otro navegador | no tira: devuelve `null`, que es «no hay nada guardado» |
 *
 * O sea que «hay almacén» no implica «se puede escribir». Cada operación
 * devuelve lo mejor que puede —la lista que ya tenía, o una vacía— y **ninguna
 * tira**: una función que la persona pidió no puede voltear la página.
 *
 * ── Y no hay ningún dato nuestro acá ─────────────────────────────────────
 * Nada de esto sale del navegador: no hay fetch, no hay Firestore, no hay
 * analítica. Es la promesa que el sitio hace en pantalla y la que sostiene B-102
 * (`docs/07-seguridad.md`). Por eso este archivo **no importa `medicionSitio`**:
 * medir «guardó un favorito» sería mandar afuera la señal de la única función
 * del sitio que existe justamente porque no manda nada afuera.
 */
import {
  conBusquedaGuardada,
  conFavoritoAlternado,
  escribirBusquedasEn,
  escribirFavoritosEn,
  leerBusquedasDe,
  leerFavoritosDe,
  sinBusquedaGuardada,
  sinFavorito,
  type AlmacenDelSitio,
  type BusquedaGuardada,
  type Favorito,
  type ResultadoDeGuardado,
  type TipoGuardable,
} from '@/lib/guardadosDelSitio';

/**
 * El `localStorage` del navegador, o `null` si no se puede usar.
 *
 * El acceso de prueba no sobra: en algunos navegadores el objeto existe y tira
 * recién al tocarlo, así que un `typeof window.localStorage` no alcanza.
 */
export const almacenDelSitio = (): AlmacenDelSitio | null => {
  try {
    const almacen = window.localStorage;
    // Una lectura cualquiera: es lo que dispara la excepción del modo privado.
    leerFavoritosDe(almacen);
    return almacen;
  } catch {
    return null;
  }
};

// ── Favoritos ───────────────────────────────────────────────────────

export const leerFavoritos = (): Favorito[] => {
  try {
    const almacen = almacenDelSitio();
    return almacen ? leerFavoritosDe(almacen) : [];
  } catch {
    return [];
  }
};

/** Escribe, y avisa si no pudo. */
const guardarFavoritos = (lista: readonly Favorito[]): boolean => {
  try {
    const almacen = almacenDelSitio();
    if (!almacen) return false;
    escribirFavoritosEn(almacen, lista);
    return true;
  } catch {
    return false;
  }
};

/**
 * Marca o desmarca, y devuelve **la lista como quedó en el navegador**.
 *
 * Si la escritura falla se devuelve la lista de antes y no la que se quiso
 * dejar: la pantalla tiene que mostrar lo que hay guardado de verdad, no lo que
 * se intentó. Un botón que queda en «Guardada» sobre un `localStorage` que no
 * escribió es la peor versión de este error — se descubre en la visita
 * siguiente, cuando el favorito no está.
 */
export const alternarFavorito = (tipo: TipoGuardable, slug: string): Favorito[] => {
  const antes = leerFavoritos();
  const despues = conFavoritoAlternado(antes, tipo, slug, new Date());
  return guardarFavoritos(despues) ? despues : antes;
};

export const olvidarFavorito = (tipo: TipoGuardable, slug: string): Favorito[] => {
  const antes = leerFavoritos();
  const despues = sinFavorito(antes, tipo, slug);
  return guardarFavoritos(despues) ? despues : antes;
};

// ── Búsquedas guardadas ─────────────────────────────────────────────

export const leerBusquedas = (): BusquedaGuardada[] => {
  try {
    const almacen = almacenDelSitio();
    return almacen ? leerBusquedasDe(almacen) : [];
  } catch {
    return [];
  }
};

const guardarBusquedas = (lista: readonly BusquedaGuardada[]): boolean => {
  try {
    const almacen = almacenDelSitio();
    if (!almacen) return false;
    escribirBusquedasEn(almacen, lista);
    return true;
  } catch {
    return false;
  }
};

/**
 * Guarda la búsqueda. Un `ok: false` con motivo `'sin-nombre'`, `'ruta-invalida'`
 * o `'tope'` lo decide el módulo puro; **acá se agrega el cuarto caso**, que es
 * el del navegador: si no se pudo escribir, tampoco se guardó. Se devuelve como
 * `'almacen'` para que la pantalla pueda decir algo distinto — los otros tres se
 * arreglan haciendo algo, y este no.
 */
export const guardarBusqueda = (
  nombre: string,
  url: string,
): ResultadoDeGuardado | { ok: false; motivo: 'almacen' } => {
  const resultado = conBusquedaGuardada(leerBusquedas(), { nombre, url }, new Date());
  if (!resultado.ok) return resultado;
  return guardarBusquedas(resultado.lista) ? resultado : { ok: false, motivo: 'almacen' };
};

export const olvidarBusqueda = (url: string): BusquedaGuardada[] => {
  const antes = leerBusquedas();
  const despues = sinBusquedaGuardada(antes, url);
  return guardarBusquedas(despues) ? despues : antes;
};
