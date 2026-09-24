/**
 * **El tablero del backlog** — una web local para mirar y mover
 * `docs/BACKLOG.md` y `docs/11-ideas-de-producto.md` sin abrir diecisiete mil
 * líneas de markdown.
 *
 *   npm run tablero            # http://127.0.0.1:4173
 *   npm run tablero -- 5050    # en otro puerto
 *
 * ── Qué es y qué no ───────────────────────────────────────────────────────
 * **No es una aplicación con base de datos.** El markdown sigue siendo la fuente
 * de verdad (el razonamiento completo está en `parseo.mjs`): este servidor lee el
 * archivo en cada pedido y, cuando se cambia algo, reescribe una línea o inserta
 * una cita. Todo lo que hace se ve en `git diff`.
 *
 * ── Tres guardas, y las tres por algo que ya pasó ─────────────────────────
 *  1. **Escucha en `127.0.0.1` y nada más.** El backlog es público (está
 *     versionado), pero este proceso *escribe* en el repo: no tiene por qué
 *     estar accesible desde la red de un bar.
 *  2. **Escritura con precondición.** Cada cambio manda el encabezado que el
 *     tablero tenía en pantalla y el servidor lo busca en el disco; si no está,
 *     no escribe (`409`). El 2026-09-15 dos frentes escribieron el mismo
 *     `B-930` con minutos de diferencia — esa es exactamente la carrera que esto
 *     corta.
 *  3. **Escritura atómica.** Se escribe un archivo temporal al lado y se hace
 *     `rename`, que en el mismo sistema de archivos es atómico. Un Ctrl-C en el
 *     medio deja el backlog entero, no la mitad.
 */
import { createServer } from 'node:http';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  conEstado,
  conItemNuevo,
  conNota,
  conPrioridad,
  idsUsados,
  parsearBacklog,
  parsearIdeas,
  proximoNumero,
  rangosReservados,
} from './parseo.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const BACKLOG = join(RAIZ, 'docs', 'BACKLOG.md');
/**
 * El rastro de lo cerrado, que `scripts/archivar-backlog.mjs` saca del anterior.
 *
 * **Se lee siempre, aunque el tablero no lo muestre por omisión**, y por dos
 * motivos distintos. Uno es visible: los chips «Hechos» y «Descartados» siguen
 * mostrando todo. El otro es el que importa — `proximoNumero` busca el `B-` más
 * alto que el texto nombre, y **la mitad de los ids usados vive acá**: calcularlo
 * solo sobre el archivo vivo propondría un número ya tomado, que es exactamente
 * el choque de `B-930` del 2026-09-15 que la cabecera del backlog documenta.
 */
const CERRADOS = join(RAIZ, 'docs', 'BACKLOG-cerrados.md');
const IDEAS = join(RAIZ, 'docs', '11-ideas-de-producto.md');

/**
 * **El archivo de coordinación de la tanda en curso — B-1051.** Ahí se reservan
 * los rangos de ids de cada frente, y es lo único que sabe de un número
 * reservado y todavía no escrito. Vive fuera del repo a propósito (no es
 * rastro, es andamio de una tarde), así que puede no estar: sin él, el tablero
 * ofrece lo mismo que antes. `FRENTES=otra/ruta` lo cambia.
 *
 * Un archivo viejo que quedó de una tanda cerrada solo hace saltear números, que
 * es un hueco y no un choque: el lado prudente.
 */
const FRENTES = process.env.FRENTES ?? '/tmp/agenda-literaria-frentes.md';

const PUERTO = Number(process.argv[2] ?? process.env.PUERTO ?? 4173);

/** La fecha de hoy en el huso del proyecto (§14), que es la que va al archivo. */
const hoy = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const leer = (ruta) => readFile(ruta, 'utf8');

/**
 * Como `leer`, pero un archivo que puede no existir todavía vale como vacío.
 *
 * Es el caso del de cerrados en un repo que nunca corrió el archivador: el
 * tablero tiene que arrancar igual, no explotar con un `ENOENT`.
 */
const leerSiEsta = (ruta) => readFile(ruta, 'utf8').catch(() => '');

/**
 * Escribe el archivo entero sin dejarlo a medias.
 *
 * El temporal va en el mismo directorio a propósito: `rename` solo es atómico
 * dentro del mismo sistema de archivos, y `/tmp` puede estar en otro.
 */
const escribirAtomico = async (ruta, texto) => {
  const tmp = `${ruta}.tablero.tmp`;
  await writeFile(tmp, texto, 'utf8');
  await rename(tmp, ruta);
};

const marcaDeTiempo = async () => {
  const [b, c, i] = await Promise.all([
    stat(BACKLOG),
    stat(CERRADOS).catch(() => ({ mtimeMs: 0 })),
    stat(IDEAS),
  ]);
  return `${b.mtimeMs}:${c.mtimeMs}:${i.mtimeMs}`;
};

/**
 * El estado completo que consume la pantalla.
 *
 * Se manda todo junto —ítems, ideas, secciones, próximo id— porque el archivo
 * entra en un puñado de megabytes de JSON y evita seis pedidos encadenados. La
 * pantalla filtra en memoria, que es la misma decisión que el § 2.5 tomó para el
 * sitio público y por el mismo motivo.
 */
const estado = async () => {
  const [textoBacklog, textoCerrados, textoIdeas, reservados] = await Promise.all([
    leer(BACKLOG),
    leerSiEsta(CERRADOS),
    leer(IDEAS),
    reservadosDeLaTanda(),
  ]);
  const vivo = parsearBacklog(textoBacklog);
  const cerrados = parsearBacklog(textoCerrados);
  const ideas = parsearIdeas(textoIdeas);
  // Los dos textos juntos para todo lo que razona sobre **ids**: el archivo vivo
  // solo tiene los de lo pendiente.
  const usados = idsUsados(losDos(textoBacklog, textoCerrados));

  // Cada ítem se lleva de qué archivo salió: es lo que la ficha usa para el link
  // al editor, y lo que el servidor usa para saber **dónde escribir**.
  const conArchivo = (its, archivo) => its.map((it) => ({ ...it, archivo }));
  const items = [
    ...conArchivo(vivo.items, 'docs/BACKLOG.md'),
    ...conArchivo(cerrados.items, 'docs/BACKLOG-cerrados.md'),
  ];
  // Las secciones del vivo primero: son las que ofrece el alta, y un ítem nuevo
  // nunca nace en el archivo de cerrados.
  const secciones = [
    ...vivo.secciones,
    ...cerrados.secciones.filter((s) => !vivo.secciones.includes(s)),
  ];

  return {
    marca: await marcaDeTiempo(),
    hoy: hoy(),
    raiz: RAIZ,
    archivos: {
      backlog: 'docs/BACKLOG.md',
      cerrados: 'docs/BACKLOG-cerrados.md',
      ideas: 'docs/11-ideas-de-producto.md',
    },
    seccionesDelAlta: vivo.secciones,
    secciones,
    items,
    // Una idea ya trabajada es la que alguien citó desde el backlog. No hace
    // falta marcarla en ninguna parte: la cita es la marca.
    ideas: ideas.map((idea) => ({
      ...idea,
      citadaEn: items
        .filter((it) => it.cuerpo.includes(`idea ${idea.numero}`) || it.cuerpo.includes(idea.titulo))
        .map((it) => it.id),
    })),
    proximoId: `B-${proximoNumero(losDos(textoBacklog, textoCerrados), reservados)}`,
    cantidadDeIds: usados.size,
  };
};

/**
 * Los dos archivos del backlog como un solo texto, para lo que razona sobre ids.
 *
 * No se parsea: `proximoNumero` e `idsUsados` barren el texto crudo, incluida la
 * prosa —un `B-960` citado adentro de otro ítem ya está comprometido aunque no
 * tenga sección propia—, así que concatenar es exactamente lo que hace falta.
 */
const losDos = (vivo, cerrados) => `${vivo}\n${cerrados}`;

/** Los `B-` que la tanda en curso reservó, o ninguno si no hay tanda. */
const reservadosDeLaTanda = async () => rangosReservados(await leerSiEsta(FRENTES)).bugs;

const json = (res, codigo, cuerpo) => {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(texto);
};

const cuerpoDe = (req) =>
  new Promise((ok, mal) => {
    let datos = '';
    req.on('data', (c) => {
      datos += c;
      // Un backlog entero son ~700 KB; una nota, unos cientos de bytes. Un
      // megabyte es holgado y evita que un pedido roto coma memoria.
      if (datos.length > 1_000_000) mal(new Error('pedido demasiado grande'));
    });
    req.on('end', () => {
      try {
        ok(datos ? JSON.parse(datos) : {});
      } catch (e) {
        mal(e);
      }
    });
    req.on('error', mal);
  });

/**
 * Aplica una transformación pura sobre el backlog y la guarda.
 *
 * El resultado de las funciones de `parseo.mjs` es `{texto}` o `{error}`: un
 * error es una precondición que no se cumplió —el archivo cambió abajo, el id ya
 * está tomado— y sale como `409`, que es lo que la pantalla traduce a «recargá».
 */
const aplicar = async (res, transformar, encabezado) => {
  /*
   * En cuál de los dos archivos escribir lo decide **dónde está el encabezado**,
   * no quién pidió el cambio: una nota sobre un ítem ya archivado va al archivo
   * de cerrados, y marcar hecho uno abierto va al vivo. Si no está en ninguno se
   * aplica sobre el vivo, para que la transformación devuelva su propio `409` —el
   * mensaje de precondición ya explica qué hacer, y escribir otro acá sería tener
   * dos textos para el mismo caso.
   */
  const [textoVivo, textoCerrados] = await Promise.all([leer(BACKLOG), leerSiEsta(CERRADOS)]);
  const enCerrados =
    Boolean(encabezado) && !textoVivo.includes(encabezado) && textoCerrados.includes(encabezado);

  const salida = transformar(
    enCerrados ? textoCerrados : textoVivo,
    losDos(textoVivo, textoCerrados),
    await reservadosDeLaTanda(),
  );
  if (salida.error) return json(res, 409, { error: salida.error });
  await escribirAtomico(enCerrados ? CERRADOS : BACKLOG, salida.texto);
  return json(res, 200, { ok: true, ...(await estado()) });
};

const RUTAS = {
  'POST /api/prioridad': (datos) => (texto) =>
    conPrioridad(texto, datos.encabezado, datos.prioridad),

  'POST /api/estado': (datos) => (texto) =>
    conEstado(texto, datos.encabezado, datos.estado, hoy()),

  'POST /api/nota': (datos) => (texto) => conNota(texto, datos.encabezado, datos.nota, hoy()),

  'POST /api/nuevo': (datos) => (texto, ambos, reservados) =>
    conItemNuevo(texto, {
      // El id se vuelve a calcular **acá**, contra el disco, y no se usa el que
      // la pantalla mostró hace diez minutos: entre medio pudo entrar otro
      // frente. Es la mitad de la defensa; la otra es el choque que `conItemNuevo`
      // rechaza si alguien mandó uno a mano.
      //
      // Y se calcula sobre **los dos** archivos: un ítem nuevo nace en el vivo,
      // pero el número que le toca depende también de los que ya se archivaron.
      // Y por encima de lo que la tanda reservó (B-1051). Un id mandado a mano
      // no se frena por estar reservado: es el propio frente usando su rango.
      id: datos.id ?? `B-${proximoNumero(ambos, reservados)}`,
      idsTomados: idsUsados(ambos),
      titulo: datos.titulo ?? '',
      prioridad: /^P[0-4]$/u.test(datos.prioridad ?? '') ? datos.prioridad : 'P2',
      seccion: datos.seccion ?? 'P2 — mejoras reales',
      cuerpo: datos.cuerpo ?? '',
      hoy: hoy(),
    }),
};

const servidor = createServer(async (req, res) => {
  try {
    const ruta = `${req.method} ${req.url.split('?')[0]}`;

    if (ruta === 'GET /' || ruta === 'GET /index.html') {
      const html = await readFile(join(AQUI, 'tablero.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }

    if (ruta === 'GET /api/estado') return json(res, 200, await estado());

    // El latido: la pantalla lo consulta cada pocos segundos y se recarga sola
    // si el archivo cambió abajo. Es lo que permite tener el tablero abierto
    // mientras una sesión de Claude escribe en el mismo archivo.
    if (ruta === 'GET /api/marca') return json(res, 200, { marca: await marcaDeTiempo() });

    const manejador = RUTAS[ruta];
    if (manejador) {
      const datos = await cuerpoDe(req);
      return await aplicar(res, manejador(datos), datos.encabezado);
    }

    return json(res, 404, { error: `No existe ${ruta}` });
  } catch (e) {
    return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  process.stdout.write(
    `\n  Tablero del backlog → http://127.0.0.1:${PUERTO}\n` +
      `  Fuente: docs/BACKLOG.md y docs/11-ideas-de-producto.md (se escriben in situ)\n` +
      `  Ctrl-C para cerrar.\n\n`,
  );
});
