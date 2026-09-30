/**
 * **La decisión de `unir-organizadores.mjs`, separada del I/O** — B-2178,
 * roadmap 1.5.
 *
 * El script se conecta a Firestore al importarlo, así que lo que un test tiene
 * que poder mirar vive acá (la forma de `geografia-a-sembrar.mjs`): validar la
 * tabla del dueño, la etiqueta de cada destino y qué se le escribe a cada
 * actividad.
 */
// **La misma derivación que el panel, el build y la siembra**, importada y no
// copiada: el slug que este script cree que tiene una actividad tiene que ser el
// de su página `/organiza/{slug}`, o se unirían actividades que no son.
import { slugify } from '../functions/slugify.js';
import { slugDeOrganizador } from '../functions/organizador.js';
// El `searchText` se reescribe con **la misma** función con que `syncCalendar` lo
// verifica (B-2050): con otra, el servidor lo «corregiría» y mandaría un
// `derivados-no-coinciden` por actividad.
import { derivadosDe } from '../functions/derivados.js';
import { etiquetaPresentable } from '../src/lib/etiqueta-presentable.mjs';
import { usosPorCampo } from './vocabulario-a-sembrar.mjs';

/** ¿Es un slug tal como lo escribe `slugify`? — `''` no lo es. */
const esSlug = (s) => typeof s === 'string' && s !== '' && slugify(s) === s;

/**
 * **Valida la tabla antes de tocar nada.** Devuelve la lista de problemas, vacía
 * si la tabla se puede usar. Cada problema es una línea que se lee sola.
 *
 * Lo que frena, y por qué cada uno:
 *  - **Un slug que no es `slugify` de sí mismo** («Hormiga», «hormiga »): no
 *    coincidiría nunca con el de una actividad, y el origen se informaría como
 *    «no aparece» cuando el error es de tipeo en la tabla.
 *  - **Un origen igual a su destino**: no cambia nada y casi seguro es un error
 *    de copiado.
 *  - **Un destino que es a su vez origen** (cadena `a → b → c`): aplicado en una
 *    pasada, `a` queda en `b`, que es justamente lo que se quería sacar. Se pide
 *    escribir `a → c` directo.
 *  - **Un slug que está en `unir` y en `noSeUnen`**: la tabla se contradice.
 *
 * @param {any} tabla  el JSON de `scripts/datos/organizadores-a-unir.json`
 * @returns {string[]}
 */
export const problemasDeLaTabla = (tabla) => {
  const problemas = [];
  const unir = tabla?.unir;
  if (!unir || typeof unir !== 'object' || Array.isArray(unir)) {
    return ['falta `unir`: un objeto { "<slug origen>": "<slug destino>" }'];
  }
  const origenes = new Set(Object.keys(unir));
  for (const [origen, destino] of Object.entries(unir)) {
    if (!esSlug(origen)) problemas.push(`origen «${origen}» no es un slug (sería «${slugify(String(origen))}»)`);
    if (!esSlug(destino)) {
      problemas.push(`destino «${destino}» de «${origen}» no es un slug (sería «${slugify(String(destino ?? ''))}»)`);
    }
    if (origen === destino) problemas.push(`«${origen}» se une consigo mismo`);
    else if (origenes.has(destino)) {
      problemas.push(`«${origen}» → «${destino}», que a su vez es origen de «${unir[destino]}»: escribí «${origen}» → «${unir[destino]}» directo`);
    }
  }
  for (const slug of Object.keys(tabla.noSeUnen ?? {})) {
    if (origenes.has(slug)) problemas.push(`«${slug}» está en \`unir\` y en \`noSeUnen\``);
  }
  for (const slug of Object.keys(tabla.porCompletar ?? {})) {
    if (!esSlug(slug)) problemas.push(`\`porCompletar\`: «${slug}» no es un slug`);
  }
  const porActividad = tabla.porActividad ?? {};
  if (typeof porActividad !== 'object' || Array.isArray(porActividad)) {
    problemas.push('`porActividad` tiene que ser { "<slug de la actividad>": "Nombre del organizador" }');
  } else {
    for (const [actividad, nombre] of Object.entries(porActividad)) {
      if (!esSlug(actividad)) problemas.push(`\`porActividad\`: «${actividad}» no es el slug de una actividad`);
      if (typeof nombre !== 'string' || !slugify(nombre)) {
        problemas.push(`\`porActividad\`: la actividad «${actividad}» no dice qué organizador le va`);
      }
    }
  }
  return problemas;
};

/**
 * ¿El dueño la dio por buena? Es lo que habilita `--aplicar`: la tabla se entrega
 * como **propuesta** y escribirla sin mirarla uniría casas que no son.
 *
 * @param {any} tabla
 */
export const tablaConfirmada = (tabla) => tabla?.confirmada === true;

/**
 * La etiqueta con que queda escrito cada destino.
 *
 * La de `/opciones/organizador` si el destino está ahí —es la que el sitio va a
 * mostrar igual (`nombreDeOrganizador`) y la que el dueño pudo haber corregido a
 * mano—; si no, la variante más escrita entre las actividades del destino
 * (`usosPorCampo`, el mismo criterio que la siembra), presentable. **Un destino
 * sin ninguna de las dos no tiene etiqueta** y queda afuera: no se inventa un
 * nombre a partir del slug.
 *
 * @param {Record<string, string>} unir
 * @param {readonly { slug: string, label?: string }[]} opciones  los `valores` de `/opciones/organizador`
 * @param {readonly any[]} actividades
 * @returns {Map<string, string>}  destino → etiqueta, solo los que la tienen
 */
export const etiquetasDeDestinos = (unir, opciones, actividades) => {
  const usos = usosPorCampo(actividades, ['organizador']).organizador;
  const etiquetas = new Map();
  for (const destino of new Set(Object.values(unir))) {
    const deLaLista = opciones.find((v) => v.slug === destino)?.label?.trim();
    const etiqueta = deLaLista || etiquetaPresentable(usos.get(destino)?.crudo ?? '');
    if (etiqueta) etiquetas.set(destino, etiqueta);
  }
  return etiquetas;
};

/**
 * Lo que se le escribe a una actividad, o `null` si no se toca.
 *
 * Campos puntuales para un `update`, nunca el documento: `organizador.nombre` y
 * `organizador.slug` —Instagram y web quedan como estaban—, y el `searchText`,
 * que lleva el nombre del organizador (§6) y el servidor verifica (B-2050).
 * Se recalcula con el documento entero y el organizador nuevo, igual que lo haría
 * `syncCalendar`.
 *
 * Es idempotente por construcción: después de escribir, el slug guardado es el
 * destino, que no es origen (lo garantiza `problemasDeLaTabla`).
 *
 * @param {any} actividad
 * @param {Record<string, string>} unir
 * @param {Map<string, string>} etiquetas  de `etiquetasDeDestinos`
 * @returns {{ origen: string, destino: string, cambios: Record<string, string> } | null}
 */
export const cambiosDe = (actividad, unir, etiquetas) => {
  const origen = slugDeOrganizador(actividad?.organizador);
  if (!origen || !Object.hasOwn(unir, origen)) return null;
  const destino = unir[origen];
  const nombre = etiquetas.get(destino);
  if (!nombre) return null;
  const organizador = { ...actividad.organizador, nombre, slug: destino };
  return {
    origen,
    destino,
    cambios: {
      'organizador.nombre': nombre,
      'organizador.slug': destino,
      searchText: derivadosDe({ ...actividad, organizador }).searchText,
    },
  };
};

/**
 * **El organizador de una actividad puntual** — `porActividad` (B-2178, el relleno).
 *
 * `unir` trabaja por organizador: todas las actividades de un origen van al mismo
 * destino. El relleno no se deja: «A conf» son seis actividades de seis casas
 * distintas. Acá la tabla dice, actividad por actividad, **el nombre** que le va
 * —un nombre y no un slug, porque el organizador correcto puede no estar todavía
 * en la lista—, y se resuelve como en el formulario (`resolverOrganizador`): si
 * normaliza a una opción que existe —por su slug, o por el slug de su etiqueta
 * renombrada—, queda con esa etiqueta y ese slug; si no, con el nombre
 * presentable. `null` si no hay nada que cambiar.
 *
 * @param {any} actividad
 * @param {Record<string, string>} porActividad
 * @param {readonly { slug: string, label?: string }[]} opciones
 */
export const cambiosPorActividad = (actividad, porActividad, opciones) => {
  const pedido = porActividad[actividad?.slug];
  if (typeof pedido !== 'string') return null;
  const escrito = slugify(pedido);
  if (!escrito) return null;
  const opcion =
    opciones.find((v) => v.slug === escrito) ??
    opciones.find((v) => slugify(v.label ?? '') === escrito);
  const destino = opcion?.slug ?? escrito;
  const nombre = opcion?.label?.trim() || etiquetaPresentable(pedido);
  const origen = slugDeOrganizador(actividad.organizador);
  if (origen === destino && (actividad.organizador?.nombre ?? '').trim() === nombre) return null;
  const organizador = { ...actividad.organizador, nombre, slug: destino };
  return {
    origen,
    destino,
    nueva: !opcion,
    cambios: {
      'organizador.nombre': nombre,
      'organizador.slug': destino,
      searchText: derivadosDe({ ...actividad, organizador }).searchText,
    },
  };
};

/**
 * ¿`slug` contiene a `otro` como palabras enteras? «faro-norte-libros-x» contiene
 * a «faro-norte»; «farola» no contiene a «faro».
 */
const contienePalabras = (slug, otro) => `-${slug}-`.includes(`-${otro}-`);

/**
 * El plan entero, para informar y para escribir.
 *
 * `parecidos` es la ayuda para completar la tabla: por cada destino (los de
 * `unir` y los de `porCompletar`), los slugs en uso que contienen al destino o a
 * alguno de sus orígenes y que la tabla no nombra. Así aparecen los «Faro Norte
 * Libros - …» que el ítem no pudo escribir enteros. **No se unen**: se listan.
 *
 * @param {any} tabla
 * @param {readonly { id: string, data: any }[]} actividades
 * @param {readonly { slug: string, label?: string }[]} opciones
 */
export const planDeUnion = (tabla, actividades, opciones) => {
  const unir = tabla.unir;
  const datos = actividades.map((a) => a.data);
  const etiquetas = etiquetasDeDestinos(unir, opciones, datos);

  /** @type {Map<string, { etiqueta: string | null, porOrigen: Map<string, number> }>} */
  const grupos = new Map();
  for (const [origen, destino] of Object.entries(unir)) {
    const g = grupos.get(destino) ?? { etiqueta: etiquetas.get(destino) ?? null, porOrigen: new Map() };
    g.porOrigen.set(origen, 0);
    grupos.set(destino, g);
  }

  const aEscribir = [];
  const enUso = new Set();
  const porActividad = tabla.porActividad ?? {};
  for (const { id, data } of actividades) {
    const slug = slugDeOrganizador(data?.organizador);
    if (slug) enUso.add(slug);
    // `porActividad` manda sobre `unir`: es la decisión más puntual.
    const c = Object.hasOwn(porActividad, data?.slug)
      ? cambiosPorActividad(data, porActividad, opciones)
      : cambiosDe(data, unir, etiquetas);
    if (c) aEscribir.push({ id, estado: data?.estado, slug: data?.slug, ...c });
    if (Object.hasOwn(unir, slug)) {
      const g = grupos.get(unir[slug]);
      g.porOrigen.set(slug, g.porOrigen.get(slug) + 1);
    }
  }

  const origenesSinUso = Object.keys(unir).filter((o) => !enUso.has(o));
  const destinosSinEtiqueta = [...grupos].filter(([, g]) => !g.etiqueta).map(([d]) => d);
  const destinosSinUso = [...grupos.keys()].filter((d) => !enUso.has(d));
  const origenesEnLaLista = Object.keys(unir).filter((o) => opciones.some((v) => v.slug === o));

  const nombrados = new Set([
    ...Object.keys(unir),
    ...Object.values(unir),
    ...Object.keys(tabla.noSeUnen ?? {}),
  ]);
  const parecidos = new Map();
  for (const destino of new Set([...grupos.keys(), ...Object.keys(tabla.porCompletar ?? {})])) {
    const delGrupo = [destino, ...Object.keys(unir).filter((o) => unir[o] === destino)];
    const hallados = [...enUso]
      .filter((s) => !nombrados.has(s) && s !== destino && delGrupo.some((g) => contienePalabras(s, g)))
      .sort();
    if (hallados.length) parecidos.set(destino, hallados);
  }

  const slugsDeActividades = new Set(datos.map((a) => a?.slug));
  const actividadesQueNoEstan = Object.keys(porActividad).filter((s) => !slugsDeActividades.has(s));

  return {
    grupos,
    aEscribir,
    origenesSinUso,
    destinosSinEtiqueta,
    destinosSinUso,
    origenesEnLaLista,
    parecidos,
    actividadesQueNoEstan,
  };
};
