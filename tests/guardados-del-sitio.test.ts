import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { entradaDePrueba } from './fixtures/indice';
import {
  busquedasDeTexto,
  CLAVE_BUSQUEDAS,
  CLAVE_FAVORITOS,
  conBusquedaGuardada,
  conFavoritoAlternado,
  cuantosSinFicha,
  esFavorito,
  escribirBusquedasEn,
  escribirFavoritosEn,
  esRutaGuardable,
  esSlugGuardable,
  favoritosDeTexto,
  leerFavoritosDe,
  llaveDeFavorito,
  MAXIMO_BUSQUEDAS,
  nombreLimpio,
  resolverFavoritos,
  sinBusquedaGuardada,
  sinFavorito,
  TIPOS_GUARDABLES,
  type AlmacenDelSitio,
  VERSION_GUARDADOS,
  type BusquedaGuardada,
  type Favorito,
} from '@/lib/guardadosDelSitio';

/**
 * Los favoritos y las búsquedas guardadas del sitio público — B-848.
 *
 * ── Lo que este archivo custodia, y no es el cálculo ──────────────────────
 * Casi todo acá es aritmética de listas y se podría reescribir de diez maneras.
 * **Lo que no** es la forma de lo guardado: `{ v, tipo, slug, guardadoEn }`.
 *
 * Son datos que viven en el `localStorage` de cada persona, o sea que **no los
 * podemos ver ni migrar**. El día que la forma cambie, lo guardado no se
 * convierte solo: o se pierde, o hay que leerlo con un default para siempre. Por
 * eso el `tipo` está desde el día uno aunque hoy haya una sola entidad, y por eso
 * el `v` está aunque hoy solo pueda valer 1 — y por eso el primer `describe` de
 * este archivo es sobre eso y no sobre el orden de la lista.
 *
 * ── La segunda mitad: lo que se lee no se cree ────────────────────────────
 * `localStorage` lo escribe este código y lo puede editar cualquiera con la
 * consola abierta. El `url` de una búsqueda guardada termina en un `href` y el
 * `slug` de un favorito en una ruta, así que los dos se validan con la misma
 * desconfianza que `desdeQuery` le tiene a la query string.
 */

const AHORA = new Date('2026-09-10T12:00:00.000Z');
const DESPUES = new Date('2026-09-11T12:00:00.000Z');

const favorito = (slug: string, guardadoEn = AHORA.toISOString()): Favorito => ({
  v: VERSION_GUARDADOS,
  tipo: 'actividad',
  slug,
  guardadoEn,
});

const busqueda = (nombre: string, url: string): BusquedaGuardada => ({
  v: VERSION_GUARDADOS,
  nombre,
  url,
  guardadoEn: AHORA.toISOString(),
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · La decisión: lo guardado lleva el tipo y la versión
// ───────────────────────────────────────────────────────────────────────────

describe('lo guardado lleva el `tipo` y la versión, desde el día uno — B-848', () => {
  it('un favorito recién marcado tiene exactamente `v`, `tipo`, `slug` y `guardadoEn`', () => {
    /*
     * **Es la decisión del ítem, no el cálculo.** Se afirman las cuatro claves y
     * no solo que el slug esté: guardar el slug pelado cuesta una línea menos hoy
     * y no tiene arreglo bueno cuando existan las cuatro entidades de `docs/prd/`,
     * porque hay que adivinar de qué era cada uno y no hay a quién preguntarle.
     *
     * El `toEqual` sobre las claves ordenadas es a propósito: un campo nuevo hace
     * fallar esto y obliga a decidir si lo guardado antes sigue sirviendo o si hay
     * que subir `VERSION_GUARDADOS` —que es tirar lo de todo el mundo—. Es el
     * mismo mecanismo con el que `tests/autoguardado.test.ts` ata la lista de
     * claves del formulario a `VERSION_BORRADOR`.
     *
     * MUTACIÓN PROBADA: sacarle el `tipo:` al objeto que arma
     * `conFavoritoAlternado` deja este caso en rojo con
     * `['guardadoEn','slug','v'] ≠ ['guardadoEn','slug','tipo','v']`, y también el
     * caso de la llave de más abajo. Sacarle el `v:` lo deja en rojo acá y en el
     * de la relectura.
     */
    const [nuevo] = conFavoritoAlternado([], 'actividad', 'taller-de-cronica', AHORA);
    expect(Object.keys(nuevo!).sort()).toEqual(['guardadoEn', 'slug', 'tipo', 'v']);
    expect(nuevo).toEqual({
      v: 1,
      tipo: 'actividad',
      slug: 'taller-de-cronica',
      guardadoEn: AHORA.toISOString(),
    });
  });

  it('y una búsqueda guardada tiene exactamente `v`, `nombre`, `url` y `guardadoEn`', () => {
    /*
     * **No lleva `tipo` y eso es una decisión, no un olvido**: de qué listado es
     * una búsqueda ya está en el path que se guarda (`/` hoy, `/librerias` el día
     * que exista). Un slug suelto no dice de qué era; una ruta sí.
     *
     * MUTACIÓN PROBADA: agregarle `tipo: 'actividad'` al objeto que arma
     * `conBusquedaGuardada` hace fallar este caso.
     */
    const r = conBusquedaGuardada([], { nombre: 'Poesía este mes', url: '/?tag=poesia' }, AHORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.lista[0]!).sort()).toEqual(['guardadoEn', 'nombre', 'url', 'v']);
  });

  it('lo guardado con otra versión se descarta al leer, no se interpreta', () => {
    /*
     * Un favorito de una forma que ya no existe, leído con el código de hoy, es
     * peor que ningún favorito: **parece bueno**. Es el mismo criterio que
     * `leerConsentimiento`, que solo acepta exactamente los dos valores que
     * escribe.
     *
     * MUTACIÓN PROBADA: cambiar `o.v !== VERSION_GUARDADOS` por
     * `typeof o.v !== 'number'` hace fallar este caso.
     */
    const crudo = JSON.stringify([
      { v: 0, tipo: 'actividad', slug: 'viejo', guardadoEn: AHORA.toISOString() },
      { v: 99, tipo: 'actividad', slug: 'del-futuro', guardadoEn: AHORA.toISOString() },
      favorito('bueno'),
    ]);
    expect(favoritosDeTexto(crudo).map((f) => f.slug)).toEqual(['bueno']);
  });

  it('y lo guardado sin `tipo`, o con un tipo que no existe, tampoco entra', () => {
    /*
     * MUTACIÓN PROBADA: sacar el chequeo `esTipoGuardable` de `favoritosDeTexto`
     * deja pasar las dos entradas y este caso queda en rojo con tres slugs.
     */
    const crudo = JSON.stringify([
      { v: VERSION_GUARDADOS, slug: 'sin-tipo', guardadoEn: AHORA.toISOString() },
      { v: VERSION_GUARDADOS, tipo: 'libreria', slug: 'todavia-no', guardadoEn: AHORA.toISOString() },
      favorito('bueno'),
    ]);
    expect(favoritosDeTexto(crudo).map((f) => f.slug)).toEqual(['bueno']);
  });

  it('la llave es tipo + slug, no el slug solo', () => {
    /*
     * Hoy no se puede demostrar con dos entidades porque hay una sola, así que se
     * demuestra sobre la función que arma la llave: dos tipos distintos con el
     * mismo slug **no** son el mismo favorito. El día que exista `libreria`, una
     * librería y un taller que se llamen igual —«la-boca»— tienen que poder estar
     * los dos guardados.
     *
     * MUTACIÓN PROBADA: cambiar `llaveDeFavorito` por `(_, slug) => slug` hace
     * fallar este caso.
     */
    expect(llaveDeFavorito('actividad', 'la-boca')).not.toBe(llaveDeFavorito('libreria' as never, 'la-boca'));
    expect(llaveDeFavorito('actividad', 'la-boca')).toContain('actividad');
  });

  it('la lista de tipos guardables existe aunque hoy tenga uno solo', () => {
    // Si esto queda en uno para siempre, el `tipo` de arriba habrá sido gratis
    // igual. El día que sean cuatro, la validación de lectura ya está escrita.
    expect(TIPOS_GUARDABLES).toContain('actividad');
    expect(VERSION_GUARDADOS).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Marcar, desmarcar, y no perder nada
// ───────────────────────────────────────────────────────────────────────────

describe('marcar y desmarcar un favorito', () => {
  it('alternar dos veces vuelve a la lista de antes', () => {
    const una = conFavoritoAlternado([], 'actividad', 'club-de-lectura', AHORA);
    expect(esFavorito(una, 'actividad', 'club-de-lectura')).toBe(true);
    expect(conFavoritoAlternado(una, 'actividad', 'club-de-lectura', DESPUES)).toEqual([]);
  });

  it('lo nuevo va adelante y no pisa lo que había', () => {
    const lista = conFavoritoAlternado([favorito('viejo')], 'actividad', 'nuevo', DESPUES);
    expect(lista.map((f) => f.slug)).toEqual(['nuevo', 'viejo']);
  });

  it('no muta la lista que recibe', () => {
    /*
     * El mismo motivo que `ordenar` del panel: la lista viene del estado de React
     * y mutarla la deja igual entre dos renders — la pantalla no se actualiza y
     * parece que el clic no hizo nada.
     */
    const antes = [favorito('uno')];
    conFavoritoAlternado(antes, 'actividad', 'dos', DESPUES);
    sinFavorito(antes, 'actividad', 'uno');
    expect(antes.map((f) => f.slug)).toEqual(['uno']);
  });

  it('un slug que no pasa la validación no se guarda y no rompe', () => {
    /*
     * MUTACIÓN PROBADA: sacar la guarda `esSlugGuardable` de
     * `conFavoritoAlternado` hace que la lista quede con un favorito cuyo slug es
     * `../admin`, y este caso pasa a ver uno en vez de cero.
     */
    expect(conFavoritoAlternado([], 'actividad', '../admin', AHORA)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Lo que se lee de `localStorage` no se cree
// ───────────────────────────────────────────────────────────────────────────

describe('lo leído se valida como si viniera de afuera — B-848', () => {
  it('un JSON roto, un no-array o un `null` dan lista vacía y no tiran', () => {
    /*
     * Las tres formas de «no hay nada usable» tienen que dar lo mismo, porque la
     * página se dibuja igual en las tres: sin nada guardado.
     *
     * MUTACIÓN PROBADA: sacar el `try`/`catch` de `objetos` hace que el primer
     * caso tire `SyntaxError` y voltee la sección entera.
     */
    expect(favoritosDeTexto(null)).toEqual([]);
    expect(favoritosDeTexto('')).toEqual([]);
    expect(favoritosDeTexto('{no es json')).toEqual([]);
    expect(favoritosDeTexto('{"v":1}')).toEqual([]);
    expect(favoritosDeTexto('[1,2,"tres",null]')).toEqual([]);
    expect(busquedasDeTexto('no es json')).toEqual([]);
  });

  it('el mismo favorito dos veces se lee una sola', () => {
    const crudo = JSON.stringify([favorito('repetido'), favorito('repetido'), favorito('otro')]);
    expect(favoritosDeTexto(crudo).map((f) => f.slug)).toEqual(['repetido', 'otro']);
  });

  it('un slug que no es un slug se descarta', () => {
    /*
     * El slug se interpola en `rutaDeDetalle` y termina en un `href`. `slugify`
     * produce `[a-z0-9-]` (§4.2) y eso es lo que se acepta.
     *
     * MUTACIÓN PROBADA: cambiar `esSlugGuardable` por `typeof valor === 'string'`
     * deja pasar los cinco y este caso queda en rojo.
     */
    for (const malo of ['../admin', '/otra/cosa', 'con espacio', 'Mayúsculas', 'a?b=c']) {
      expect(esSlugGuardable(malo), malo).toBe(false);
    }
    expect(esSlugGuardable('taller-de-cronica-2')).toBe(true);
  });

  it('una `url` que no es una ruta interna se descarta', () => {
    /*
     * **Es la guarda que más importa de este archivo.** La `url` guardada se
     * pinta como el `href` de un enlace en `/mis-favoritos`, así que un
     * `javascript:` guardado a mano en la consola es XSS en la propia máquina, y
     * un `//otro.sitio` —protocolo-relativa, o sea absoluta sin parecerlo— manda
     * afuera desde un link que dice el nombre que le puso la persona. La barra
     * invertida está porque algunos navegadores la normalizan a `/`.
     *
     * MUTACIÓN PROBADA: sacar el `!valor.startsWith('//')` de `esRutaGuardable`
     * deja entrar `//evil.example` y este caso queda en rojo.
     */
    for (const mala of [
      'javascript:alert(1)',
      'https://otro.sitio/',
      '//otro.sitio/',
      '/\\otro.sitio',
      'data:text/html,x',
      '?tag=poesia',
      '',
    ]) {
      expect(esRutaGuardable(mala), mala).toBe(false);
    }
    expect(esRutaGuardable('/?tag=poesia&cuando=este-mes')).toBe(true);
    expect(esRutaGuardable('/tipo/taller?arancel=gratis')).toBe(true);
  });

  it('una búsqueda con la url envenenada no llega a la lista', () => {
    const crudo = JSON.stringify([
      { v: VERSION_GUARDADOS, nombre: 'Mirá esto', url: 'javascript:alert(1)', guardadoEn: AHORA.toISOString() },
      busqueda('Poesía', '/?tag=poesia'),
    ]);
    expect(busquedasDeTexto(crudo).map((b) => b.url)).toEqual(['/?tag=poesia']);
  });

  it('una búsqueda sin nombre usable se descarta', () => {
    const crudo = JSON.stringify([
      { v: VERSION_GUARDADOS, nombre: '   ', url: '/?tag=x', guardadoEn: AHORA.toISOString() },
      { v: VERSION_GUARDADOS, nombre: 42, url: '/?tag=y', guardadoEn: AHORA.toISOString() },
    ]);
    expect(busquedasDeTexto(crudo)).toEqual([]);
  });

  it('el nombre se recorta y se topea', () => {
    expect(nombreLimpio('  Poesía en Villa Crespo  ')).toBe('Poesía en Villa Crespo');
    expect(nombreLimpio('x'.repeat(200))).toHaveLength(60);
    expect(nombreLimpio(null)).toBe('');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Varias búsquedas guardadas, con su tope
// ───────────────────────────────────────────────────────────────────────────

describe('las búsquedas guardadas — «puede tener varios filtros predeterminados»', () => {
  it('se guardan varias y la última queda arriba', () => {
    const a = conBusquedaGuardada([], { nombre: 'Gratis', url: '/?arancel=gratis' }, AHORA);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = conBusquedaGuardada(a.lista, { nombre: 'Poesía', url: '/?tag=poesia' }, DESPUES);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.lista.map((x) => x.nombre)).toEqual(['Poesía', 'Gratis']);
  });

  it('guardar la misma URL de nuevo le pisa el nombre y no deja dos filas', () => {
    /*
     * La llave es la URL: dos filas que filtran exactamente lo mismo con dos
     * nombres distintos son una lista que no se puede usar para elegir.
     *
     * MUTACIÓN PROBADA: sacar el `lista.filter((b) => b.url !== entrada.url)` deja
     * las dos y este caso queda en rojo con `['Nuevo nombre','Viejo']`.
     */
    const a = conBusquedaGuardada([], { nombre: 'Viejo', url: '/?tag=poesia' }, AHORA);
    if (!a.ok) return;
    const b = conBusquedaGuardada(a.lista, { nombre: 'Nuevo nombre', url: '/?tag=poesia' }, DESPUES);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.lista.map((x) => x.nombre)).toEqual(['Nuevo nombre']);
  });

  it('sin nombre y con una ruta inválida se rechaza con su motivo, no en silencio', () => {
    expect(conBusquedaGuardada([], { nombre: '  ', url: '/?a=1' }, AHORA)).toEqual({
      ok: false,
      motivo: 'sin-nombre',
    });
    expect(conBusquedaGuardada([], { nombre: 'X', url: 'https://otro.sitio' }, AHORA)).toEqual({
      ok: false,
      motivo: 'ruta-invalida',
    });
  });

  it('en el tope se rechaza, y nunca se tira la más vieja', () => {
    /*
     * **La asimetría con los favoritos es la decisión** (ver `MAXIMO_BUSQUEDAS`):
     * acá hay tope porque una lista de veinte filas ya no sirve para elegir, y el
     * tope **rechaza** en vez de descartar, porque un dato que vive solo en el
     * navegador de alguien no se puede devolver.
     *
     * MUTACIÓN PROBADA: cambiar el rechazo por `resto.slice(0, MAXIMO_BUSQUEDAS - 1)`
     * —tirar la más vieja para hacer lugar— hace fallar las dos afirmaciones de
     * este caso: la primera porque devuelve `ok: true`, y la segunda porque la
     * número 1 ya no está.
     */
    let lista: BusquedaGuardada[] = [];
    for (let i = 0; i < MAXIMO_BUSQUEDAS; i++) {
      const r = conBusquedaGuardada(lista, { nombre: `Nº ${i}`, url: `/?tag=t${i}` }, AHORA);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      lista = r.lista;
    }
    expect(conBusquedaGuardada(lista, { nombre: 'Una más', url: '/?tag=extra' }, AHORA)).toEqual({
      ok: false,
      motivo: 'tope',
    });
    expect(lista.some((b) => b.url === '/?tag=t0')).toBe(true);
  });

  it('pisar una que ya está no cuenta contra el tope', () => {
    let lista: BusquedaGuardada[] = [];
    for (let i = 0; i < MAXIMO_BUSQUEDAS; i++) {
      const r = conBusquedaGuardada(lista, { nombre: `Nº ${i}`, url: `/?tag=t${i}` }, AHORA);
      if (!r.ok) return;
      lista = r.lista;
    }
    const r = conBusquedaGuardada(lista, { nombre: 'Renombrada', url: '/?tag=t3' }, DESPUES);
    expect(r.ok).toBe(true);
  });

  it('quitar una saca solo esa', () => {
    const lista = [busqueda('A', '/?a=1'), busqueda('B', '/?b=2')];
    expect(sinBusquedaGuardada(lista, '/?a=1').map((b) => b.nombre)).toEqual(['B']);
    expect(lista).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Resolver contra el índice del build
// ───────────────────────────────────────────────────────────────────────────

describe('la sección resuelve contra el `events.json` y tolera que el slug no esté', () => {
  const cronica = entradaDePrueba({ slug: 'taller-de-cronica', titulo: 'Taller de crónica' });
  const club = entradaDePrueba({ slug: 'club-de-lectura', titulo: 'Club de lectura' });

  it('un favorito cuyo slug ya no está en la agenda se devuelve igual, con `entrada: null`', () => {
    /*
     * **El sitio es estático**: la sección resuelve contra el índice del último
     * build, y ahí puede no estar —despublicada, cancelada o borrada—. Esconderla
     * sería hacer desaparecer algo que la persona guardó sin decirle nada, y
     * dejarla sin poder sacarla es peor.
     *
     * MUTACIÓN PROBADA: cambiar el `.map` por un `.filter((f) => porSlug.has(...))`
     * —que es la forma corta y la primera que uno escribe— hace fallar este caso:
     * el favorito desaparecido deja de estar en la lista.
     */
    const resueltos = resolverFavoritos(
      [favorito('taller-de-cronica'), favorito('ya-no-existe', DESPUES.toISOString())],
      [cronica, club],
    );
    expect(resueltos).toHaveLength(2);
    expect(resueltos.map((r) => r.favorito.slug)).toEqual(['ya-no-existe', 'taller-de-cronica']);
    expect(resueltos[0]!.ficha).toBeNull();
    expect(resueltos[1]!.ficha?.titulo).toBe('Taller de crónica');
    expect(cuantosSinFicha(resueltos)).toBe(1);
  });

  it('ordena por cuándo se guardó, lo último arriba', () => {
    /*
     * El orden sale de `guardadoEn` y **no del orden del array**: el array lo pudo
     * haber escrito otra pestaña o una mano en la consola, y el único dato que
     * dice cuándo se guardó cada uno es el campo.
     *
     * MUTACIÓN PROBADA: sacar el `.sort` hace fallar este caso, y el array llega
     * en el orden en que estaba escrito.
     */
    const resueltos = resolverFavoritos(
      [
        favorito('taller-de-cronica', '2026-01-01T00:00:00.000Z'),
        favorito('club-de-lectura', '2026-06-01T00:00:00.000Z'),
      ],
      [cronica, club],
    );
    expect(resueltos.map((r) => r.favorito.slug)).toEqual(['club-de-lectura', 'taller-de-cronica']);
  });

  it('sin nada guardado devuelve una lista vacía, no una excepción', () => {
    expect(resolverFavoritos([], [cronica])).toEqual([]);
    expect(cuantosSinFicha([])).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · El almacén, por el puerto
// ───────────────────────────────────────────────────────────────────────────

/** Un `localStorage` de mentira: tres métodos y un `Map`. */
const almacenFalso = (): AlmacenDelSitio & { datos: Map<string, string> } => {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  };
};

describe('lo guardado va y vuelve por el puerto, sin navegador', () => {
  it('escribir y volver a leer da lo mismo', () => {
    const almacen = almacenFalso();
    const lista = conFavoritoAlternado([], 'actividad', 'taller-de-cronica', AHORA);
    escribirFavoritosEn(almacen, lista);
    expect(leerFavoritosDe(almacen)).toEqual(lista);
  });

  it('sin nada escrito devuelve una lista vacía', () => {
    expect(leerFavoritosDe(almacenFalso())).toEqual([]);
  });

  it('vaciar la lista **borra la clave**, no deja un `[]` colgado', () => {
    /*
     * En la única función del sitio cuya promesa es «esto vive solo en tu
     * navegador», que quede una marca después de sacar todo es exactamente lo
     * que no puede pasar: quien vació sus favoritos y va a mirar el
     * almacenamiento del sitio tiene que no encontrar nada nuestro.
     *
     * MUTACIÓN PROBADA: cambiar `escribirEn` por un `setItem` incondicional deja
     * `agenda:favoritos` con el texto `[]` y este caso en rojo.
     */
    const almacen = almacenFalso();
    escribirFavoritosEn(almacen, [favorito('uno')]);
    expect([...almacen.datos.keys()]).toEqual([CLAVE_FAVORITOS]);
    escribirFavoritosEn(almacen, []);
    expect([...almacen.datos.keys()]).toEqual([]);
  });

  it('las dos listas viven en claves distintas y no se pisan', () => {
    const almacen = almacenFalso();
    escribirFavoritosEn(almacen, [favorito('uno')]);
    escribirBusquedasEn(almacen, [busqueda('Poesía', '/?tag=poesia')]);
    expect([...almacen.datos.keys()].sort()).toEqual([CLAVE_BUSQUEDAS, CLAVE_FAVORITOS].sort());
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7 · Lo guardado no sale del navegador — la promesa de la salida 19
// ───────────────────────────────────────────────────────────────────────────

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const sinComentarios = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * Los archivos que **producen** la salida 19: los dos módulos y todo lo que los
 * importa.
 *
 * **Se derivan del repo, no se enumeran**: el día que aparezca el quinto
 * consumidor —la sección de librerías, un botón en la cartelera— entra solo al
 * barrido. Una lista a mano acá es la forma exacta del «se acordaron de sanear
 * los cinco campos que había».
 */
const IMPORTA_GUARDADOS = /@\/lib\/guardado(sDelSitio|DelNavegador)/;

const productoresDeLaSalida19 = (): string[] => {
  const versionados = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(ts|tsx|astro)$/.test(f));
  return versionados.filter((f) =>
    IMPORTA_GUARDADOS.test(sinComentarios(readFileSync(raiz(f), 'utf8'))),
  );
};

/**
 * El **código que produce la salida 19**, y no el archivo entero.
 *
 * La distinción no es un tecnicismo: la página de detalle tiene **dos**
 * `<script>` y son de dos salidas distintas —el de la analítica es de la 12 y
 * mide `clic_inscripcion`, legítimamente—. Barrer el archivo completo pondría en
 * rojo un `medirSitio` que está bien puesto, y la salida fácil de ese falso
 * positivo sería exceptuar el archivo, o sea apagar el chequeo justo donde vive
 * el botón.
 *
 * Así que un `.astro` se parte por sus `<script>` y solo entran los bloques que
 * tocan estos módulos; un `.ts`/`.tsx` entra entero, porque un módulo no se
 * parte en dos salidas.
 */
const codigoDeLaSalida19 = (): { archivo: string; codigo: string }[] =>
  productoresDeLaSalida19().flatMap((archivo) => {
    const codigo = sinComentarios(readFileSync(raiz(archivo), 'utf8'));
    if (!archivo.endsWith('.astro')) return [{ archivo, codigo }];
    return codigo
      .split(/<\/script>/)
      .filter((bloque) => IMPORTA_GUARDADOS.test(bloque))
      .map((bloque, i) => ({ archivo: `${archivo} (script ${i + 1})`, codigo: bloque }));
  });

describe('lo guardado no sale del navegador — la promesa de la salida 19 (B-781, B-848)', () => {
  it('control positivo: el barrido encuentra los productores', () => {
    /*
     * Sin esto, un `git ls-files` que no devuelve nada —o un renombre de los
     * módulos— haría pasar los casos de abajo sobre una lista vacía. El piso es
     * cuatro: los dos componentes, la página de detalle y el transporte.
     */
    const productores = productoresDeLaSalida19();
    expect(productores.length).toBeGreaterThanOrEqual(4);
    // Y el recorte por `<script>` no puede dejar la lista vacía.
    expect(codigoDeLaSalida19().length).toBeGreaterThanOrEqual(4);
    expect(codigoDeLaSalida19().every(({ codigo }) => codigo.length > 0)).toBe(true);
    expect(productores).toContain('src/components/publico/MisGuardados.tsx');
    expect(productores).toContain('src/components/publico/GuardarBusqueda.tsx');
    expect(productores).toContain('src/pages/actividad/[slug].astro');
  });

  it('ninguno mide: ni GA4, ni el transporte de la analítica, ni un beacon', () => {
    /*
     * **Es la red que faltaba, y la señaló el `auditor-privacidad`.** Dos páginas
     * indexadas afirman que lo guardado «no lo vemos nosotros» y que vive «en
     * ningún lado del servidor» — la clase B-781, texto libre sobre tratamiento
     * de datos en HTML público. Lo único que lo sostenía era un aserto sobre el
     * `<script>` de la ficha; `MisGuardados.tsx` y `GuardarBusqueda.tsx` no
     * estaban nombrados por ningún test.
     *
     * El caso que importa no es abstracto: `medirSitio('guardo_busqueda', {
     * nombre })` manda a GA4 **texto que tipeó el visitante**, que es lo más
     * prohibido del §5.4, y hasta hoy dejaba la suite entera en verde.
     *
     * MUTACIÓN PROBADA: agregar `medirSitio('clic_inscripcion', { via: 'mail' })`
     * en el `guardar` de `GuardarBusqueda.tsx` pone este caso en rojo nombrando
     * el archivo.
     */
    const culpables = codigoDeLaSalida19()
      .filter(({ codigo }) => /\bmedirSitio\b|medicionSitio|sendBeacon|\bgtag\b|dataLayer/.test(codigo))
      .map(({ archivo }) => archivo);
    expect(
      culpables,
      'lo guardado en el navegador no puede llegar a la analítica: el `nombre` de una ' +
        'búsqueda guardada es texto que tipeó quien visita, y dos páginas indexadas ' +
        'afirman que eso no sale (§5.4, B-781)',
    ).toEqual([]);
  });

  it('y el único destino de red es el `events.json` de este mismo sitio', () => {
    /*
     * La otra mitad de la promesa: «en ningún lado del servidor». La sección
     * **sí** hace un `fetch`, y tiene que ser el del índice público que la home
     * ya baja — nunca uno que mande lo guardado a alguna parte.
     *
     * MUTACIÓN PROBADA: cambiar el fetch de `MisGuardados.tsx` por un
     * `fetch('/api/favoritos', { method: 'POST' })` pone este caso en rojo.
     */
    const destinos = codigoDeLaSalida19()
      .flatMap(({ archivo, codigo }) =>
        [...codigo.matchAll(/\bfetch\(\s*[`'"]([^`'"]*)/g)].map((m) => `${archivo} → ${m[1]}`),
      )
      .filter((d) => !d.includes('→ /events.json'));
    expect(destinos, 'un destino de red que no es el índice público del propio sitio').toEqual([]);
  });

  it('ni Firestore, ni el bundle del panel, ni una cookie', () => {
    // El sitio público no escribe en Firestore (solo `/proponer`, B-830), y esto
    // menos que nada: no hay cuenta con la cual escribir.
    const culpables = codigoDeLaSalida19()
      .filter(({ codigo }) =>
        /firestore-client|firebase-client|@\/lib\/appcheck|@\/lib\/analytics\b|document\.cookie/.test(
          codigo,
        ),
      )
      .map(({ archivo }) => archivo);
    expect(culpables).toEqual([]);
  });
});
