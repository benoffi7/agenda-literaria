import { colapsarIndices } from '@/lib/rutaCampo';
import { slugify } from '@/lib/slugify';
import {
  CAMPOS_TAXONOMIA,
  ESTADOS,
  MODALIDADES,
  type ActividadForm,
} from '@/types/actividad';

/**
 * Taxonomía de eventos de analítica del panel, y la **proyección** que decide
 * qué sale de acá.
 *
 * Es el mismo criterio del §5.1 y de `toPublic.ts`: no se manda el objeto, se
 * manda una proyección deliberada. Acá es más estricto todavía, porque el
 * destino es un tercero (GA4) y no un JSON que el dueño controla:
 *
 * **Ningún parámetro puede llevar texto libre.** Cada parámetro declarado tiene
 * un sanitizador que lo reduce a un entero, un booleano, un valor de un
 * vocabulario cerrado, o una ruta de campo del schema. Un parámetro no
 * declarado se descarta; un string que no está en su vocabulario se reemplaza
 * por `'otro'`. Por construcción, entonces, un título, una descripción, un mail
 * de inscripción, un link de Zoom, un handle o un uid no tienen forma de
 * llegar al payload — no depende de que cada `medir()` se acuerde de filtrar.
 *
 * Este módulo es puro (§05-patrones: "al agregar lógica, preguntarse si
 * necesita red"). El transporte y la carga diferida del SDK viven en
 * `analytics.ts`.
 *
 * La referencia de la taxonomía, evento por evento, está en
 * `docs/09-analitica.md`. **Los nombres son estables**: renombrar un evento
 * corta la serie histórica en GA4, así que se agregan, no se renombran.
 */

// ── Vocabularios cerrados ──────────────────────────────────────────

/** Valor de reemplazo cuando un string no está en su vocabulario. */
export const FUERA_DE_VOCABULARIO = 'otro';

export const DISPOSITIVOS = ['mobile', 'tablet', 'escritorio'] as const;

/** Buckets de ancho de viewport. El detalle exacto no aporta y es una huella. */
export const ANCHOS = ['xs', 'sm', 'md', 'lg'] as const;

export const MODOS = ['nueva', 'editar', 'duplicar'] as const;
export type ModoFormulario = (typeof MODOS)[number];

/** Qué botón disparó el guardado. */
export const ACCIONES = ['borrador', 'submit'] as const;

/**
 * Los dos vocabularios que la analítica **no** define: los toma del modelo
 * (`@/types/actividad`) en vez de copiarlos (B-75).
 *
 * El modo de falla de la copia era el del D-60 una góndola más allá: un quinto
 * `estado` o una cuarta `modalidad` en el modelo dejaba a la analítica
 * reportándolo como `'otro'` **en silencio**, justo el dato con el que se
 * contestan las preguntas de `docs/09-analitica.md`. Acá no hay lista que
 * mantener: son el mismo objeto, y un test lo fija por identidad.
 *
 * El argumento de bundle del D-60 no aplica: `@/types/actividad` tiene fan-out
 * 0 —son interfaces y arrays de literales, sin un solo import— así que zod
 * sigue entrando solo por `@/lib/schema`, que este módulo no toca. Medido en el
 * build: la carga inicial de `/admin` no se movió ni un byte.
 *
 * Los alias existen porque el nombre dice para qué se usa acá: `estado` es el
 * **destino** de un guardado, no cualquier estado.
 */
export const ESTADOS_DESTINO = ESTADOS;

export const MODALIDADES_MEDIBLES = MODALIDADES;

/**
 * Motivos de un guardado fallido, clasificados. El mensaje crudo NO se manda:
 * `actividades.ts` tira `Fecha inválida: "<lo que escribió la persona>"`, así
 * que el texto del error es contenido del formulario.
 */
export const MOTIVOS_FALLO = [
  'slug-tomado',
  'permisos',
  'sin-sesion',
  'red',
  'fecha-invalida',
  'desconocido',
] as const;
export type MotivoFallo = (typeof MOTIVOS_FALLO)[number];

/** Códigos de error del SDK de Firestore/Auth. Cerrado a propósito. */
export const CODIGOS_FIREBASE = [
  'cancelled',
  'unknown',
  'invalid-argument',
  'deadline-exceeded',
  'not-found',
  'already-exists',
  'permission-denied',
  'resource-exhausted',
  'failed-precondition',
  'aborted',
  'out-of-range',
  'unimplemented',
  'internal',
  'unavailable',
  'data-loss',
  'unauthenticated',
] as const;

/**
 * Funciones del panel cuyo uso real se quiere medir. Enum cerrado y no un
 * evento por función: diez eventos bien elegidos se analizan, cincuenta
 * sueltos no.
 */
export const FUNCIONES = [
  'encuentro-agregar',
  'encuentro-duplicar',
  'encuentro-borrar',
  'encuentros-ordenar',
  'encuentros-generar',
  'taxonomia-otro',
  'taxonomia-nueva',
  'taxonomia-reusada',
  'taxonomia-sugerencia',
  'seccion-abrir',
  'seccion-cerrar',
  'actividad-duplicar',
  /**
   * B-199 — cuántas casillas se destildaron al duplicar, como entero.
   *
   * Contesta la pregunta por la que el modal existe: **si nadie destilda nunca, el
   * modal es un peaje** y hay que volver al click directo. Sin esto, la única señal
   * sería que alguien se queje. Entero, sin texto libre (§9).
   */
  'duplicar-desmarcar',
  /**
   * B-186 — correr un encuentro con los botones, en días (con signo).
   *
   * **Toda la hipótesis del arreglo es que esto reemplaza al almanaque**, que se
   * cierra solo y no es nuestro para arreglar. Sin este evento no hay forma de
   * saber si se usa, y el ítem quedaría cerrado por fe.
   */
  'encuentro-correr',
  // B-97 — prender o apagar «se llenó» desde el menú del listado. La pregunta
  // que contesta es si la función se usa: si nadie la toca, el cartel de cupo
  // completo no existe en la práctica y el sitio sigue mintiendo el cupo.
  'actividad-cupo-completo',
  // Pegar un link de Google Maps para las coordenadas de la sede. Tiene varios
  // modos de fallo y saber cuál pesa más decide el arreglo: si casi todos pegan
  // un link corto, lo que hay que hacer es resolverlos, no explicar mejor.
  'coordenadas-pegar',
  'coordenadas-fallo',
  /**
   * B-167 (segunda tajada) — una imagen propia subida.
   *
   * Contesta si la mitad cara de DEC-7c se usa: si nadie sube nunca y todos
   * pegan URLs, la Function de optimización (DEC-7d, la tajada que falta) no
   * vale lo que cuesta.
   */
  'imagen-subida',
  /**
   * Ídem, rechazada, con `detalle` en un enum cerrado: `tamano`, `tipo` o `red`.
   *
   * **Es el único termómetro del tope de 3 MB de DEC-7b.** Si casi todos los
   * rechazos son por tamaño, el número está mal elegido y lo que hay que hacer
   * es recomprimir del lado de la Function, no explicar mejor. Nunca viaja el
   * nombre del archivo ni el tamaño real: eso es contenido (§9).
   */
  'imagen-rechazada',
] as const;
export type Funcion = (typeof FUNCIONES)[number];

/**
 * Secciones del formulario, por el slug de su título (§11).
 *
 * `Seccion` reporta el slug de su propio título, así que una sección nueva se
 * mide sola en cuanto existe — pero cae en `'otro'` hasta que su slug entre en
 * esta lista. Si aparece una sección y su uso se ve como `detalle: otro`, lo
 * que falta es una línea acá.
 */
export const SECCIONES = [
  'que-es',
  'encuentros',
  'donde',
  'quien',
  'arancel-e-inscripcion',
  'material',
  'opcional',
  'difusion',
  // La vista previa del evento es la pregunta "¿alguien la abre antes de
  // publicar?": si nadie la despliega, la función no sirvió.
  'vista-previa',
  'vista-previa-del-evento',
] as const;

/**
 * Campos con taxonomía autogestionada (§4). Importado del modelo, no copiado
 * (B-75): un sexto campo con taxonomía se mide solo, sin caer en `'otro'`.
 */
export const CAMPOS_TAXONOMIA_MEDIBLES = CAMPOS_TAXONOMIA;

/**
 * Modos de fallo al pegar un link de Google Maps en las coordenadas de la sede.
 * Son etiquetas de la causa, no el mensaje ni el link pegado.
 */
export const FALLOS_COORDENADAS = [
  'coord-link-corto',
  'coord-sin-coordenadas',
  'coord-coma-decimal',
  'coord-formato',
] as const;

/**
 * Por qué se rechazó una imagen propia al subirla (B-167). Son etiquetas de la
 * causa, **nunca** el nombre del archivo ni su tamaño real — eso es contenido, y
 * el mensaje que ve la persona sí los dice pero no viaja.
 *
 * Vive acá y no en `subir-imagen.ts` por la lección de B-88: el productor y el
 * consumidor del vocabulario tienen que ser el mismo. Declarados por separado, el
 * sanitizador de `detalle` los reemplaza por `otro` y los tres rechazos llegan a
 * GA4 indistinguibles — con el agravante de que **falla en silencio**, porque un
 * `otro` de más no rompe nada.
 */
export const MOTIVOS_IMAGEN = ['tamano', 'tipo', 'metadatos', 'red'] as const;
export type MotivoImagen = (typeof MOTIVOS_IMAGEN)[number];

/** Vocabulario del parámetro `detalle`. */
export const DETALLES = [
  ...SECCIONES,
  ...CAMPOS_TAXONOMIA_MEDIBLES,
  ...FALLOS_COORDENADAS,
  ...MOTIVOS_IMAGEN,
] as const;

/**
 * Grupos de campos del formulario, para ubicar dónde quedó una carga
 * abandonada sin mandar nada de lo que se escribió.
 */
export const GRUPOS = [
  'que-es',
  'encuentros',
  'donde',
  'quien',
  'arancel',
  'inscripcion',
  'material',
] as const;
export type Grupo = (typeof GRUPOS)[number];

// ── Rutas de campo validables, derivadas del schema ────────────────

/**
 * El vocabulario de `campo` se **deriva** del schema de zod en vez de
 * mantenerse a mano. Es el criterio de D-07: una lista de campos escrita al
 * lado del schema se desactualiza en silencio, y acá el silencio significaría
 * que un campo nuevo que falla validación se reporta como `'otro'` justo
 * cuando alguien está buscando por qué la gente se traba en él.
 *
 * Los índices de array se colapsan a `N` (`sesiones.3.fin` → `sesiones.N.fin`):
 * lo que importa es qué campo falla, no en qué fila.
 */
/**
 * Rutas de campo que el schema puede reportar como inválidas.
 *
 * Es una constante y no una derivación del schema en runtime, aunque derivarla
 * sería más elegante. El motivo es de bundle: importar `@/lib/schema` acá
 * arrastra zod, y como `AdminApp` importa el transporte de analítica de forma
 * estática, zod terminaba en el chunk inicial del panel — 68 kB que el corte de
 * B-09 justamente había sacado de ahí.
 *
 * La garantía que se buscaba —que esta lista no pueda quedar desactualizada en
 * silencio— no se pierde: se mueve al test. `tests/analytics-campos.test.ts`
 * deriva el vocabulario del schema de zod y falla si difiere de esta lista, con
 * el detalle de qué sobra y qué falta. Misma protección, sin costo en runtime.
 */
export const CAMPOS_VALIDABLES: ReadonlySet<string> = new Set([
  'arancel',
  'arancel.notas',
  'arancel.tipo',
  'descripcion',
  'destacado',
  'difusion',
  'difusion.arrobar',
  'difusion.arrobar.N',
  'difusion.notas',
  'esCiclo',
  'estado',
  // B-167 — la galería es una lista, así que sus rutas van colapsadas
  // (`rutaCampo.ts`). Son **nombres de campo**, no contenido: ninguna URL ni
  // ningún epígrafe sale a la analítica (§7 de 07-seguridad.md).
  'imagenes',
  'imagenes.N',
  'imagenes.N.alto',
  'imagenes.N.ancho',
  'imagenes.N.epigrafe',
  'imagenes.N.id',
  'imagenes.N.origen',
  'imagenes.N.portada',
  'imagenes.N.storagePath',
  'imagenes.N.url',
  'inscripcion',
  'inscripcion.cierra',
  // B-97 — es el **nombre** del campo, no su valor: un booleano no es contenido
  // ni siquiera cuando viaja como ruta.
  'inscripcion.completo',
  'inscripcion.cupo',
  'inscripcion.destino',
  'inscripcion.requiere',
  'inscripcion.via',
  // DEC-1 — el libro presentado. Son **nombres de campo** y no contenido: acá
  // viaja `libro.titulo` como ruta que falló la validación, nunca el título.
  'libro',
  'libro.autor',
  'libro.titulo',
  'material',
  'material.items',
  'material.items.N',
  'material.items.N.entrega',
  'material.items.N.publico',
  'material.items.N.tipo',
  'material.items.N.titulo',
  'material.items.N.url',
  'material.tiene',
  'modalidad',
  'online',
  'online.plataforma',
  'online.url',
  'online.urlPublica',
  'organizador',
  'organizador.instagram',
  'organizador.nombre',
  'organizador.web',
  'sede',
  'sede.barrio',
  'sede.ciudad',
  'sede.direccion',
  'sede.geo',
  'sede.geo.lat',
  'sede.geo.lng',
  'sede.indicaciones',
  'sede.nombre',
  'sesiones',
  'sesiones.N',
  'sesiones.N.calendarEventId',
  'sesiones.N.cancelada',
  'sesiones.N.fin',
  'sesiones.N.id',
  'sesiones.N.inicio',
  'sesiones.N.lectura',
  'sesiones.N.tema',
  'slug',
  'tags',
  'tags.N',
  'tallerista',
  'tallerista.bio',
  'tallerista.instagram',
  'tallerista.nombre',
  'tipo',
  'titulo',
]);

/**
 * Ruta de campo → ruta normalizada, o `'otro'` si no es una ruta del schema.
 * Este es el único parámetro que no viene de un enum literal, y por eso pasa
 * igual por un whitelist: la ruta la arma zod, pero nadie garantiza que un
 * `medir()` futuro no le pase otra cosa.
 */
export const normalizarCampo = (valor: unknown): string => {
  if (typeof valor !== 'string' && !Array.isArray(valor)) return FUERA_DE_VOCABULARIO;
  const crudo = Array.isArray(valor) ? valor.join('.') : valor;
  const ruta = colapsarIndices(crudo);
  return CAMPOS_VALIDABLES.has(ruta) ? ruta : FUERA_DE_VOCABULARIO;
};

// ── Sanitizadores ──────────────────────────────────────────────────

type Sanitizador =
  | { tipo: 'entero'; max: number }
  | { tipo: 'version' }
  | { tipo: 'booleano' }
  | { tipo: 'enum'; valores: readonly string[] }
  | { tipo: 'campo' }
  | { tipo: 'lista'; valores: readonly string[] }
  | { tipo: 'lista-campos' };

/** Tope de GA4 para el valor de un parámetro de texto. */
const MAX_TEXTO = 100;

/** Recorta una lista ya unida sin dejar un token partido a la mitad. */
const recortarLista = (unida: string): string => {
  if (unida.length <= MAX_TEXTO) return unida;
  const corte = unida.lastIndexOf(',', MAX_TEXTO);
  return corte > 0 ? unida.slice(0, corte) : unida.slice(0, MAX_TEXTO);
};

const unir = (valores: string[]): string =>
  recortarLista([...new Set(valores)].sort().join(','));

/**
 * Las tres formas que estampa el build: `1.0.1+5e2cb50`,
 * `1.0.1+5e2cb50-sucio.20260821-2124` y `1.0.1+sin-git.20260821-2124`.
 *
 * Sin la versión, un pico de errores de validación no se puede atribuir a un
 * deploy; con un formato abierto, el campo sería una puerta para texto libre.
 * El formato se verifica, no se confía: semver de tres números y, como máximo,
 * **un** sufijo que arranca alfanumérico y sigue con `[0-9A-Za-z.-]` hasta 40
 * caracteres. No entra un espacio, ni un acento, ni `@ : / ?`, así que un
 * título, un mail, un handle o un link no tienen forma de pasar por acá.
 *
 * **El productor del formato es `scripts/version.mjs`; este es su consumidor**
 * (B-88, D-98). No se importa: ese script corre en Node —`child_process`,
 * `fs`— y traerlo al bundle es el mismo problema que el D-60 tiene con zod.
 * Así que la lista no se copia: los dos lados los ata un test.
 * `tests/version.test.ts` recorre `versionesPosibles()` —el dominio completo de
 * entradas que puede tener un build— y verifica que cada salida sobreviva
 * **entera** a este sanitizador, más la versión que el árbol de trabajo estampa
 * ahora mismo. Una forma nueva inventada del lado del build rompe ese test en
 * vez de viajar como `'otro'` en silencio, que es lo que pasaba hasta B-88.
 *
 * El sufijo tolera un guion porque el build lo produce (`-sucio.`, `sin-git.`),
 * no porque el vocabulario se haya abierto: sigue siendo cerrado y verificado,
 * y lo que no matchea viaja como `'otro'`.
 */
export const FORMATO_VERSION =
  /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][0-9A-Za-z][0-9A-Za-z.-]{0,39})?$/;

const sanitizar = (san: Sanitizador, valor: unknown): string | number | undefined => {
  switch (san.tipo) {
    case 'version':
      return typeof valor === 'string' && FORMATO_VERSION.test(valor)
        ? valor
        : FUERA_DE_VOCABULARIO;
    case 'entero': {
      const n = Number(valor);
      if (!Number.isFinite(n)) return undefined;
      return Math.min(Math.max(Math.round(n), 0), san.max);
    }
    case 'booleano':
      return valor ? 1 : 0;
    case 'enum':
      return typeof valor === 'string' && san.valores.includes(valor)
        ? valor
        : FUERA_DE_VOCABULARIO;
    case 'campo':
      return normalizarCampo(valor);
    case 'lista': {
      if (!Array.isArray(valor)) return '';
      const limpios = valor.filter(
        (v): v is string => typeof v === 'string' && san.valores.includes(v),
      );
      return unir(limpios);
    }
    case 'lista-campos': {
      if (!Array.isArray(valor)) return '';
      const limpios = valor
        .map(normalizarCampo)
        .filter((c) => c !== FUERA_DE_VOCABULARIO);
      return unir(limpios);
    }
  }
};

// ── Especificación de los eventos ──────────────────────────────────

type Especificacion = Record<string, Sanitizador>;

/**
 * Contexto que va en todos los eventos: mobile vs escritorio (y qué tan
 * angosto), más la versión desplegada para poder atribuir un pico a un deploy.
 */
const COMUNES = {
  dispositivo: { tipo: 'enum', valores: DISPOSITIVOS },
  ancho: { tipo: 'enum', valores: ANCHOS },
  version: { tipo: 'version' },
} satisfies Especificacion;

const MODO = { tipo: 'enum', valores: MODOS } as const satisfies Sanitizador;

/**
 * La taxonomía. Ocho eventos: cada uno responde una pregunta concreta sobre
 * fricción, y ninguno lleva contenido. La documentación de cada uno está en
 * `docs/09-analitica.md`.
 */
export const EVENTOS = {
  /** ¿Cuántas sesiones de panel hay, y desde qué tipo de pantalla? */
  panel_abierto: { ...COMUNES },

  /** ¿Cuántas cargas se empiezan, y de qué modo? Es el denominador del embudo. */
  formulario_abierto: { ...COMUNES, modo: MODO },

  /** ¿Dónde se abandona una carga? `faltantes` dice qué grupos quedaron vacíos. */
  formulario_abandonado: {
    ...COMUNES,
    modo: MODO,
    segundos: { tipo: 'entero', max: 7200 },
    avance: { tipo: 'entero', max: GRUPOS.length },
    faltantes: { tipo: 'lista', valores: GRUPOS },
    encuentros: { tipo: 'entero', max: 200 },
    intentos_validacion: { tipo: 'entero', max: 50 },
    // ¿Había trabajo sin guardar, o se abrió el formulario y se salió?
    sucio: { tipo: 'booleano' },
  },

  /** ¿Cuántas veces rebota la validación, y con qué combinación de campos? */
  validacion_fallida: {
    ...COMUNES,
    modo: MODO,
    accion: { tipo: 'enum', valores: ACCIONES },
    cantidad: { tipo: 'entero', max: 100 },
    campos: { tipo: 'lista-campos' },
    intento: { tipo: 'entero', max: 50 },
  },

  /** ¿Qué campo falla y con qué frecuencia? Uno por campo, para poder rankear. */
  campo_invalido: {
    ...COMUNES,
    modo: MODO,
    campo: { tipo: 'campo' },
    intento: { tipo: 'entero', max: 50 },
  },

  /** ¿Cuánto tarda una carga completa, y qué forma tenía la actividad? */
  guardado_ok: {
    ...COMUNES,
    modo: MODO,
    accion: { tipo: 'enum', valores: ACCIONES },
    estado: { tipo: 'enum', valores: ESTADOS_DESTINO },
    segundos: { tipo: 'entero', max: 7200 },
    intentos_validacion: { tipo: 'entero', max: 50 },
    encuentros: { tipo: 'entero', max: 200 },
    modalidad: { tipo: 'enum', valores: MODALIDADES_MEDIBLES },
    es_ciclo: { tipo: 'booleano' },
    material_items: { tipo: 'entero', max: 100 },
    tags: { tipo: 'entero', max: 100 },
    requiere_inscripcion: { tipo: 'booleano' },
    tiene_tallerista: { tipo: 'booleano' },
    // DEC-1 — si el libro presentado se cargó o no. Booleano y nada más: el
    // título es texto libre y no hay sanitizador de texto libre (§9).
    tiene_libro: { tipo: 'booleano' },
    // B-97 — si la actividad estaba marcada como completa al guardar. Booleano y
    // nada más: no hay cuántos lugares quedan, porque no hay contador (§3.1).
    cupo_completo: { tipo: 'booleano' },
    url_publica: { tipo: 'booleano' },
  },

  /** ¿Cuántos guardados fallan y por qué? Motivo clasificado, nunca el mensaje. */
  guardado_fallido: {
    ...COMUNES,
    modo: MODO,
    accion: { tipo: 'enum', valores: ACCIONES },
    motivo: { tipo: 'enum', valores: MOTIVOS_FALLO },
    codigo: { tipo: 'enum', valores: CODIGOS_FIREBASE },
  },

  /** ¿Qué funciones del panel se usan de verdad? */
  funcion_usada: {
    ...COMUNES,
    funcion: { tipo: 'enum', valores: FUNCIONES },
    detalle: { tipo: 'enum', valores: DETALLES },
    valor: { tipo: 'entero', max: 1000 },
  },
} satisfies Record<string, Especificacion>;

export type NombreEvento = keyof typeof EVENTOS;

export const NOMBRES_EVENTOS = Object.keys(EVENTOS) as NombreEvento[];

export interface EventoMedido {
  nombre: string;
  params: Record<string, string | number>;
}

/**
 * Arma el payload de un evento a partir de valores crudos.
 *
 * Whitelist en las dos direcciones: un nombre de evento no declarado devuelve
 * `null` (no se manda nada), y un parámetro no declarado en ese evento se
 * descarta. Lo que queda pasa por su sanitizador.
 */
export const construirEvento = (
  nombre: string,
  crudos: Record<string, unknown> = {},
): EventoMedido | null => {
  const spec = (EVENTOS as Record<string, Especificacion>)[nombre];
  if (!spec) return null;
  const params: Record<string, string | number> = {};
  for (const [param, san] of Object.entries(spec)) {
    if (crudos[param] === undefined || crudos[param] === null) continue;
    const valor = sanitizar(san, crudos[param]);
    if (valor !== undefined) params[param] = valor;
  }
  return { nombre, params };
};

// ── Derivaciones sin contenido ─────────────────────────────────────

/**
 * ¿Se mide en este entorno? Tres portones, y los tres tienen que abrir:
 *
 * 1. Estamos en un navegador (el build de Astro corre en Node).
 * 2. **No** están los emuladores: con `PUBLIC_USE_EMULATORS=true` las pruebas
 *    de desarrollo contaminarían los datos de producción.
 * 3. Hay un `measurementId` configurado.
 *
 * Está acá, puro y con los tres argumentos explícitos, para poder testear las
 * combinaciones sin tocar `import.meta.env`.
 */
export const debeMedir = (entorno: {
  navegador: boolean;
  emuladores: boolean;
  measurementId?: string;
}): boolean =>
  entorno.navegador && !entorno.emuladores && Boolean(entorno.measurementId?.trim());

export const bucketDeAncho = (ancho: number): (typeof ANCHOS)[number] => {
  if (ancho < 400) return 'xs';
  if (ancho < 768) return 'sm';
  if (ancho < 1024) return 'md';
  return 'lg';
};

/**
 * Mobile / tablet / escritorio por ancho y por grosor del puntero. No se lee el
 * user agent: el ancho y `pointer: coarse` son lo que de verdad explica los
 * problemas de la barra fija y del zoom de iOS, y no identifican el aparato.
 */
export const dispositivoDe = (
  ancho: number,
  punteroGrueso: boolean,
): (typeof DISPOSITIVOS)[number] => {
  if (ancho < 768) return 'mobile';
  if (punteroGrueso && ancho < 1200) return 'tablet';
  return 'escritorio';
};

/** Título de sección → slug del vocabulario, o `'otro'`. */
export const seccionASlug = (titulo: string): string => {
  const slug = slugify(titulo);
  return (SECCIONES as readonly string[]).includes(slug) ? slug : FUERA_DE_VOCABULARIO;
};

/**
 * Clasifica un fallo de guardado en un motivo del vocabulario.
 *
 * Nunca devuelve el mensaje del error: `formADocumento` tira
 * `Fecha inválida: "<lo que se escribió>"`, y las reglas de Firestore pueden
 * traer el path del documento. El mensaje solo se mira para reconocer patrones
 * propios; lo que sale es la etiqueta.
 */
export const clasificarFalloGuardado = (
  error: unknown,
): { motivo: MotivoFallo; codigo?: string } => {
  if (typeof error === 'string' && (MOTIVOS_FALLO as readonly string[]).includes(error)) {
    return { motivo: error as MotivoFallo };
  }
  const codigoCrudo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code).replace(/^[a-z]+\//, '')
      : undefined;
  const codigo = (CODIGOS_FIREBASE as readonly string[]).includes(codigoCrudo ?? '')
    ? codigoCrudo
    : undefined;
  const mensaje = error instanceof Error ? error.message : '';

  if (codigo === 'permission-denied') return { motivo: 'permisos', codigo };
  if (codigo === 'unauthenticated') return { motivo: 'sin-sesion', codigo };
  if (codigo === 'unavailable' || codigo === 'deadline-exceeded') {
    return { motivo: 'red', codigo };
  }
  if (/^Fecha inválida/.test(mensaje)) return { motivo: 'fecha-invalida' };
  return codigo ? { motivo: 'desconocido', codigo } : { motivo: 'desconocido' };
};

const tieneTexto = (s: string | null | undefined): boolean => Boolean(s && s.trim());

/**
 * Qué grupos del formulario están completos y cuáles no, **sin mirar qué se
 * escribió**: solo si hay algo. Es lo que permite decir "las cargas
 * abandonadas se caen en Encuentros" sin mandar una sola letra del contenido.
 *
 * Los criterios son los mismos condicionales del §11 que valida el schema.
 */
export const avanceDelFormulario = (
  form: ActividadForm,
): { completos: Grupo[]; faltantes: Grupo[] } => {
  const necesitaSede = form.modalidad === 'presencial' || form.modalidad === 'hibrido';
  const necesitaOnline = form.modalidad === 'virtual' || form.modalidad === 'hibrido';

  const listo: Record<Grupo, boolean> = {
    'que-es': tieneTexto(form.tipo) && tieneTexto(form.titulo) && tieneTexto(form.descripcion),
    encuentros:
      form.sesiones.length > 0 &&
      form.sesiones.every((s) => tieneTexto(s.inicio) && tieneTexto(s.fin)),
    donde:
      (!necesitaSede || (tieneTexto(form.sede?.nombre) && tieneTexto(form.sede?.direccion))) &&
      (!necesitaOnline || tieneTexto(form.online?.plataforma)),
    quien: tieneTexto(form.organizador?.nombre),
    arancel: tieneTexto(form.arancel?.tipo),
    inscripcion:
      !form.inscripcion.requiere ||
      (tieneTexto(form.inscripcion.via) && tieneTexto(form.inscripcion.destino)),
    material: !form.material.tiene || form.material.items.length > 0,
  };

  return {
    completos: GRUPOS.filter((g) => listo[g]),
    faltantes: GRUPOS.filter((g) => !listo[g]),
  };
};

/** La forma de la actividad guardada: contadores y booleanos, nada de texto. */
export const formaDelFormulario = (form: ActividadForm): Record<string, unknown> => ({
  estado: form.estado,
  encuentros: form.sesiones.length,
  modalidad: form.modalidad,
  es_ciclo: form.esCiclo,
  material_items: form.material.tiene ? form.material.items.length : 0,
  tags: form.tags.length,
  requiere_inscripcion: form.inscripcion.requiere,
  tiene_tallerista: tieneTexto(form.tallerista?.nombre),
  // DEC-1 — se completó o no. Nunca el título de la obra.
  tiene_libro: tieneTexto(form.libro?.titulo),
  // B-97 — «se llenó», tal como estaba en el momento del guardado.
  cupo_completo: form.inscripcion.completo,
  url_publica: Boolean(form.online?.urlPublica && tieneTexto(form.online?.url)),
});
