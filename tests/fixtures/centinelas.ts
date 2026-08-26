/**
 * Un documento de actividad donde **cada string es un centinela** (B-196).
 *
 * ── Por qué existe este archivo ────────────────────────────────────────────
 * Los tests de privacidad del `events.json` y del evento de Calendar eran una
 * **lista de campos conocidos**: `zoom.us/j/secreto`, `coordinar con prensa`,
 * `drive/privado`, `evt_secreto`, `uid_abc`. Eso cubre lo que se conocía el día
 * que se escribieron, no la propiedad — **el campo nuevo que nadie agregue a la
 * lista se publica sin que nada se ponga rojo**. Y `construirDescripcion` arma
 * la descripción con ~15 interpolaciones a mano, que es justo donde un campo se
 * cuela por descuido.
 *
 * Acá el documento entero es centinelas, y la afirmación se hace sobre la
 * salida: sobreviven **exactamente** los centinelas que el §5.2 permite
 * (`tests/barrido-de-salidas-publicas.test.ts`). Un campo nuevo nace en este
 * fixture —lo obliga el chequeo de cobertura contra `src/types/actividad.ts`— y
 * si se publica sin estar permitido, falla nombrándolo.
 *
 * Es el mismo truco que ya usan las otras dos salidas públicas: el barrido de
 * la analítica (`tests/analytics-privacidad.test.ts`, con
 * `tests/fixtures/formulario.ts`) y el del issue de GitHub
 * (`tests/clases-de-bug.test.ts`).
 *
 * ── Dos reglas de forma, y las dos son load-bearing ────────────────────────
 * 1. **El valor dice la ruta.** El centinela de `difusion.notas` es
 *    `CENTINELA.difusion.notas`, así que el mensaje de falla nombra el campo
 *    que se escapó sin que haya que traducir nada.
 * 2. **Todos son URL-safe** (letras, dígitos, `.`, `_`, `-`): `encodeURIComponent`
 *    los deja igual. El evento arma el link del mapa con
 *    `encodeURIComponent(ubicación)`, y si un centinela llevara espacios su
 *    forma escapada no coincidiría con la que se busca — una fuga por ese
 *    camino quedaría invisible.
 *
 * ── Este fixture no es `formulario.ts` ─────────────────────────────────────
 * Aquél es un `ActividadForm` (fechas como string, sin campos de auditoría) y
 * mide la analítica del panel. Éste es el **documento de Firestore** tal como
 * lo leen el build y la Function: con `Timestamp`, con `createdBy`/`updatedBy`,
 * y con las dos claves que ninguna pantalla escribe (`calendarEventId`,
 * `storagePath`).
 */
import type { Actividad, Imagen, Sede } from '@/types/actividad';

/** `Timestamp` mínimo, como el que Firestore entrega al build y a la Function. */
export const ts = (iso: string) => {
  const d = new Date(iso);
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  };
};

/**
 * Cada ruta de contenido del documento, más las etiquetas de `/opciones/*` que
 * la Function recibe aparte (`labels`).
 *
 * **Es la lista que hay que tocar al agregar un campo**, y no hace falta
 * acordarse: el chequeo de cobertura del barrido compara este fixture contra
 * las interfaces de `src/types/actividad.ts` y falla si falta una clave.
 */
const RUTAS = [
  // Identidad y texto de la actividad.
  'titulo',
  'slug',
  'descripcion',
  'searchText',

  // Galería (B-167, D-125) y el campo viejo que reemplazó.
  'imagenUrl',
  'imagenes.id',
  'imagenes.url',
  'imagenes.epigrafe',
  'imagenes.storagePath',

  // Quién.
  'organizador.nombre',
  'organizador.instagram',
  'organizador.web',
  'tallerista.nombre',
  'tallerista.bio',
  'tallerista.instagram',

  // La obra que se presenta (DEC-1, D-126).
  'libro.titulo',
  'libro.autor',

  // Encuentros.
  'sesiones.id',
  'sesiones.tema',
  'sesiones.lectura',
  'sesiones.calendarEventId',

  // Dónde.
  'sede.nombre',
  'sede.direccion',
  'sede.barrio',
  'sede.ciudad',
  'sede.indicaciones',
  'online.plataforma',
  'online.url',

  // Inscripción y arancel.
  'inscripcion.destino',
  'arancel.tipo',
  'arancel.notas',

  // Material: un item público y uno privado, con centinelas separados, porque
  // de uno sobrevive la URL y del otro no (§5.2).
  'material.titulo.publico',
  'material.url.publico',
  'material.titulo.privado',
  'material.url.privado',

  // Difusión: interno, nunca público (§3.2, §5.1).
  'difusion.arrobar',
  'difusion.notas',

  'tags',

  // Auditoría: uids (§5.1).
  'createdBy',
  'updatedBy',

  // Etiquetas de `/opciones/*`. No son del documento: la Function las recibe
  // como segundo argumento y el evento muestra la etiqueta, no el slug crudo.
  'labels.tipo',
  'labels.barrio',
  'labels.plataforma',
  'labels.arancel',
  'labels.tags',
] as const;

export type RutaCentinela = (typeof RUTAS)[number];

/** `titulo` → `CENTINELA.titulo`. El valor dice de qué campo salió. */
export const CENTINELA = Object.fromEntries(
  RUTAS.map((r) => [r, `CENTINELA.${r}`]),
) as Record<RutaCentinela, string>;

/** Todas las rutas, para recorrerlas en el barrido. */
export const RUTAS_CENTINELA: readonly RutaCentinela[] = RUTAS;

/**
 * Vocabulario cerrado: los strings del fixture que **no** son centinelas.
 *
 * Son enums del modelo (`src/types/actividad.ts`) y no contenido cargado por
 * nadie: publicarlos no filtra nada, y hacerlos centinelas obligaría a castear
 * el fixture y perdería la verificación de tipos. El barrido exige que todo
 * string del fixture esté acá o lleve un centinela: así un campo nuevo de texto
 * libre no puede entrar al fixture con un valor inocente.
 */
export const VOCABULARIO_CERRADO: readonly string[] = [
  // tipo
  'presentacion',
  // modalidad — `hibrido` a propósito: es el único valor con el que la
  // descripción del evento arma **los dos** bloques, sede y online.
  'hibrido',
  // estado — publicado, si no el evento no existe (§7.3) y no habría qué barrer.
  'publicado',
  // inscripcion.via
  'mail',
  // material.items[].tipo
  'lectura',
  'guia',
  // material.items[].entrega
  'previo',
  'al-inscribirse',
  // imagenes[].origen
  'propia',
];

/** Cuántos encuentros trae el ciclo del fixture (§2.2). */
export const ENCUENTROS = 8;

const SEMANA_MS = 7 * 86_400_000;
const PRIMER_INICIO_UTC = Date.UTC(2026, 8, 3, 22);

/**
 * Los encuentros. Todos con tema y lectura cargados: el barrido afirma que esos
 * dos centinelas **sí** salen, y una sesión con `null` haría pasar esa mitad de
 * la aserción por casualidad.
 *
 * Los ids llevan el centinela adentro (`ses_CENTINELA.sesiones.id.3`), así se
 * conserva la forma del §3.1 y el barrido igual los encuentra por substring.
 */
const sesionesCentinela = (): Actividad['sesiones'] =>
  Array.from({ length: ENCUENTROS }, (_, i) => {
    const inicio = PRIMER_INICIO_UTC + i * SEMANA_MS;
    return {
      id: `ses_${CENTINELA['sesiones.id']}.${i + 1}`,
      inicio: ts(new Date(inicio).toISOString()),
      fin: ts(new Date(inicio + 120 * 60_000).toISOString()),
      tema: CENTINELA['sesiones.tema'],
      lectura: CENTINELA['sesiones.lectura'],
      cancelada: false,
      calendarEventId: `${CENTINELA['sesiones.calendarEventId']}.${i + 1}`,
    };
  });

const imagenCentinela = (): Imagen => ({
  id: `img_${CENTINELA['imagenes.id']}`,
  url: CENTINELA['imagenes.url'],
  epigrafe: CENTINELA['imagenes.epigrafe'],
  origen: 'propia',
  // §5.1 — la ruta del bucket no sale. Es la única clave de `Imagen` que el
  // fixture pone para que **no** aparezca.
  storagePath: CENTINELA['imagenes.storagePath'],
  ancho: 1200,
  alto: 800,
  portada: true,
});

/**
 * La sede **sin coordenadas**, a propósito: sin `geo`, el link del mapa se arma
 * con la dirección pasada por `encodeURIComponent`. Es el único lugar donde un
 * centinela sale escapado, y es lo que hace que la regla "todos URL-safe" sea
 * verificable en vez de decorativa.
 */
const sedeCentinela = (): Sede => ({
  nombre: CENTINELA['sede.nombre'],
  direccion: CENTINELA['sede.direccion'],
  barrio: CENTINELA['sede.barrio'],
  ciudad: CENTINELA['sede.ciudad'],
  indicaciones: CENTINELA['sede.indicaciones'],
  geo: null,
});

/**
 * El documento completo, con centinelas en todo string.
 *
 * `tipo: 'presentacion'` para que corran las dos ramas que solo existen ahí: el
 * bloque del libro (DEC-1) y el rótulo «Invitado» del §11.
 */
export const actividadCentinela = (over: Partial<Actividad> = {}): Actividad => ({
  tipo: 'presentacion',
  titulo: CENTINELA.titulo,
  slug: CENTINELA.slug,
  descripcion: CENTINELA.descripcion,
  imagenes: [imagenCentinela()],
  // El campo viejo (B-167): con `imagenes` cargado no se mira, así que en el
  // caso base su centinela **no** puede aparecer. El caso legacy lo invierte.
  imagenUrl: null,
  organizador: {
    nombre: CENTINELA['organizador.nombre'],
    instagram: CENTINELA['organizador.instagram'],
    web: CENTINELA['organizador.web'],
  },
  tallerista: {
    nombre: CENTINELA['tallerista.nombre'],
    bio: CENTINELA['tallerista.bio'],
    instagram: CENTINELA['tallerista.instagram'],
  },
  libro: { titulo: CENTINELA['libro.titulo'], autor: CENTINELA['libro.autor'] },
  esCiclo: true,
  sesiones: sesionesCentinela(),
  modalidad: 'hibrido',
  sede: sedeCentinela(),
  online: {
    plataforma: CENTINELA['online.plataforma'],
    url: CENTINELA['online.url'],
    // El default del §5.1: el link de la reunión no se publica (trampa 5). El
    // caso `urlPublica: true` es su propio caso del barrido.
    urlPublica: false,
  },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: CENTINELA['inscripcion.destino'],
    cupo: 12,
    cierra: ts('2026-09-01T12:00:00Z'),
    // B-97 / D-127 — prendido: así la línea «Cupo completo» existe en el evento
    // y `completo: true` viaja al JSON. Un booleano no admite centinela.
    completo: true,
  },
  arancel: { tipo: CENTINELA['arancel.tipo'], notas: CENTINELA['arancel.notas'] },
  material: {
    tiene: true,
    items: [
      {
        tipo: 'lectura',
        titulo: CENTINELA['material.titulo.publico'],
        url: CENTINELA['material.url.publico'],
        entrega: 'previo',
        publico: true,
      },
      {
        tipo: 'guia',
        titulo: CENTINELA['material.titulo.privado'],
        url: CENTINELA['material.url.privado'],
        entrega: 'al-inscribirse',
        publico: false,
      },
    ],
  },
  difusion: {
    arrobar: [CENTINELA['difusion.arrobar']],
    notas: CENTINELA['difusion.notas'],
  },
  estado: 'publicado',
  tags: [CENTINELA.tags],
  destacado: true,
  searchText: CENTINELA.searchText,
  createdAt: ts('2026-08-01T00:00:00Z'),
  updatedAt: ts('2026-08-02T00:00:00Z'),
  createdBy: CENTINELA.createdBy,
  updatedBy: CENTINELA.updatedBy,
  ...over,
});

/**
 * Las etiquetas de `/opciones/*` que la Function recibe aparte (§4.1): la
 * actividad guarda el slug y el evento tiene que mostrar la etiqueta, porque
 * "a-la-gorra" crudo en un calendario público se ve roto.
 *
 * Las claves son los centinelas de los slugs, así que el barrido puede afirmar
 * las dos mitades: la etiqueta sale y el slug **no**.
 */
export const LABELS_CENTINELA: Record<string, Record<string, string>> = {
  tipo: { presentacion: CENTINELA['labels.tipo'] },
  barrio: { [CENTINELA['sede.barrio']]: CENTINELA['labels.barrio'] },
  plataforma: { [CENTINELA['online.plataforma']]: CENTINELA['labels.plataforma'] },
  arancel: { [CENTINELA['arancel.tipo']]: CENTINELA['labels.arancel'] },
  tags: { [CENTINELA.tags]: CENTINELA['labels.tags'] },
};
