/**
 * Validación y armado de una suscripción literaria — PRD 3
 * (`docs/prd/03-suscripciones-literarias.md`), B-832. Lógica pura: sin Firestore
 * ni navegador, así se testea sin emuladores (`05-patrones.md`).
 *
 * Se valida **en el submit** con zod y los condicionales van en `superRefine`,
 * que es el criterio de `src/lib/schema.ts` (D-01) y el que el § 3.1 del PRD pide
 * para `envio.*`: «campos condicionales de verdad».
 *
 * ── Lo que este archivo NO es ─────────────────────────────────────────────
 * **No es la defensa.** El formulario público de `/guia/suscripciones/sumar` lo
 * va a completar alguien sin login, así que todo lo de acá se saltea con un
 * `curl`: la defensa es `firestore.rules` (`suscripcionValida()`), y este schema
 * existe para que la persona vea el error antes de mandar. Los dos dicen los
 * mismos números —importados de `types/suscripcion-literaria.ts`, y el lado de la
 * regla atado por `tests/suscripciones.test.ts`— porque un documento que pase por
 * acá y no por la regla **no se guarda igual**, con el formulario diciendo que
 * sí.
 *
 * ── Los dos schemas, que son el mismo formulario con dos configuraciones ──
 * `suscripcionFormSchema` es el del panel; `suscripcionPublicaFormSchema` le
 * agrega **una** regla: quien carga desde afuera tiene que dejar por dónde
 * repreguntarle (§ 5 del PRD, `prd/README.md` § 7). Es una regla y no un tipo
 * aparte a propósito.
 */
import { z } from 'zod';
import type { DatoConFecha } from '@/lib/datoConFecha';
import { ESTADO_INICIAL, slugDeFicha } from '@/lib/directorios';
import { handleInstagram, urlSegura } from '@/lib/enlaceSeguro';
import { MAXIMO_IMAGENES } from '@/lib/imagenes';
import { normalize } from '@/lib/normalize';
import {
  MAX_ALCANCE_SUSCRIPCION,
  MAX_EXTRAS_SUSCRIPCION,
  MAX_INCLUYE_SUSCRIPCION,
  MAX_LIBROS_POR_ENTREGA,
  MAX_PRECIO_SUSCRIPCION,
  MIN_CONTACTO_SUSCRIPCION,
  MIN_DESCRIPCION_SUSCRIPCION,
  MIN_LIBROS_POR_ENTREGA,
  MIN_NOMBRE_SUSCRIPCION,
  MIN_OFRECIDA_POR_SUSCRIPCION,
  MIN_PRECIO_SUSCRIPCION,
  MIN_WHATSAPP_SUSCRIPCION,
  PERIODICIDAD_POR_DEFECTO,
  TOPE_COMPROMISO_SUSCRIPCION,
  TOPE_CONTACTO_SUSCRIPCION,
  TOPE_DESCRIPCION_SUSCRIPCION,
  TOPE_LINK_SUSCRIPCION,
  TOPE_MAIL_SUSCRIPCION,
  TOPE_NOMBRE_SUSCRIPCION,
  TOPE_OFRECIDA_POR_SUSCRIPCION,
  TOPE_OTRO_SUSCRIPCION,
  TOPE_SLUG_SUSCRIPCION,
  TOPE_SLUG_TAXONOMIA_SUSCRIPCION,
  TOPE_TEMATICA_SUSCRIPCION,
  TOPE_WHATSAPP_SUSCRIPCION,
  VIAS_CONTACTO_SUSCRIPCION,
} from '@/types/suscripcion-literaria';
import type {
  PrecioDeSuscripcion,
  SuscripcionLiteraria,
  SuscripcionLiterariaForm,
} from '@/types/suscripcion-literaria';
import type { TimestampLike } from '@/types/actividad';

const texto = z.string().trim();
const opcional = texto.default('');

/**
 * El alfabeto de un slug, **el mismo que produce `slugify`** y el mismo que
 * exige el `matches` de `firestore.rules`.
 *
 * Se exporta porque `tests/suscripciones.test.ts` compara esta fuente con la de
 * la regla: dos definiciones de «qué es un slug» se separan sin que nada falle
 * (clase de B-88).
 */
export const RE_SLUG_SUSCRIPCION = '^[a-z0-9]+(-[a-z0-9]+)*$';
/** Los seis vocabularios del § 8 del PRD guardan slugs del mismo alfabeto. */
export const RE_TAXONOMIA_SUSCRIPCION = RE_SLUG_SUSCRIPCION;
/** El WhatsApp se guarda **solo con dígitos**: de él sale un `wa.me/<digitos>`. */
export const RE_WHATSAPP_SUSCRIPCION = `^[0-9]{${MIN_WHATSAPP_SUSCRIPCION},${TOPE_WHATSAPP_SUSCRIPCION}}$`;
/** El alfabeto real de un handle de Instagram, el de `handleInstagram`. */
export const RE_INSTAGRAM_SUSCRIPCION = '^[A-Za-z0-9._]{1,30}$';
/**
 * **`https:` y solo `https:`** — criterio de aceptación 7 del PRD.
 *
 * Es la diferencia con la `web` de una librería, que acepta `http://`: acá el
 * link lleva a **la página de cobro de un tercero** (§ 7), y mandar a alguien a
 * pagar por un canal sin cifrar es distinto de mandarlo a leer una página
 * institucional vieja. Un `javascript:` o un `http://` rebotan en el schema **y**
 * en la regla.
 */
export const RE_LINK_SUSCRIPCION = '^https://.*';

/** `+54 9 11 2222-3333` → `5491122223333`. Lo que se publica es esto. */
export const soloDigitos = (valor: string): string => valor.replace(/\D/g, '');

/** ¿Esto parece un mail? Mismo criterio que zod, en una función para reusarlo. */
export const pareceMail = (valor: string): boolean =>
  z.string().email().safeParse(valor.trim()).success;

/**
 * La dirección web de la ficha: **la tipeada tal cual si la hay**, si no la
 * derivada del nombre con `slugDeFicha`.
 *
 * Mismo criterio y mismo docblock que `slugDeLibreria`: lo tipeado **no** se
 * slugifica —reescribir en silencio un valor que queda congelado al publicar es
 * la trampa 10 con disfraz— y el derivado puede dar `''`, que es el caso que el
 * `superRefine` agarra.
 */
export const slugDeSuscripcion = (f: { nombre: string; slug: string }): string =>
  f.slug.trim() ? f.slug.trim() : slugDeFicha(f.nombre);

/**
 * Una fila de la galería (D-125).
 *
 * ⚠️ **Es la tercera derivación de la misma forma** —`imagenSchema` de
 * `src/lib/schema.ts` y `imagenDeLibreriaSchema` de `libreria-schema.ts` son las
 * otras dos— y eso ya estaba anotado como deuda cuando eran dos (B-909). Se
 * escribe igual que la segunda a propósito: lo que hay que hacer es unificarlas,
 * no que la tercera invente una variante.
 */
const imagenDeSuscripcionSchema = z.object({
  id: z.string().regex(/^img_/, 'El id de la imagen tiene que empezar con img_'),
  url: texto.min(1, 'Falta la dirección de la imagen'),
  epigrafe: opcional,
  textoAlternativo: opcional,
  origen: z.enum(['externa', 'propia']),
  storagePath: z.string().optional(),
  ancho: z.number().optional(),
  alto: z.number().optional(),
  portada: z.boolean().default(false),
});

/** Un slug de taxonomía tal como lo guarda el documento. */
const slugDeTaxonomia = texto.max(TOPE_SLUG_TAXONOMIA_SUSCRIPCION, 'Ese valor quedó muy largo');

const base = z.object({
  nombre: texto
    .min(MIN_NOMBRE_SUSCRIPCION, '¿Cómo se llama la suscripción?')
    .max(TOPE_NOMBRE_SUSCRIPCION, 'El nombre tiene que ser más corto'),
  // El slug va sin formato acá: el formulario público **no lo muestra** y llega
  // vacío, así que un `.regex()` en el campo haría inguardable el camino normal.
  // La forma se valida en el `superRefine`, sobre el slug ya derivado.
  slug: texto.max(TOPE_SLUG_SUSCRIPCION, 'La dirección web quedó muy larga').default(''),
  // **Obligatoria**, al revés que en una librería: una suscripción es una promesa
  // a futuro y sin descripción la ficha no dice nada (§ 3.1 del PRD).
  descripcion: texto
    .min(MIN_DESCRIPCION_SUSCRIPCION, 'Contá qué es y para quién, aunque sea en una línea')
    .max(TOPE_DESCRIPCION_SUSCRIPCION, 'Quedó muy largo, resumilo'),
  imagenes: z.array(imagenDeSuscripcionSchema).default([]),
  ofrecidaPor: z.object({
    nombre: texto
      .min(MIN_OFRECIDA_POR_SUSCRIPCION, '¿Quién la ofrece?')
      .max(TOPE_OFRECIDA_POR_SUSCRIPCION, 'Quedó muy largo'),
    tipo: slugDeTaxonomia.default(''),
    instagram: opcional,
    libreriaSlug: opcional,
  }),
  periodicidad: slugDeTaxonomia.default(PERIODICIDAD_POR_DEFECTO),
  compromisoMinimo: texto.max(TOPE_COMPROMISO_SUSCRIPCION, 'Quedó muy largo').default(''),
  incluye: z.array(slugDeTaxonomia).default([]),
  incluyeOtro: texto.max(TOPE_OTRO_SUSCRIPCION, 'Quedó muy largo').default(''),
  envio: z.object({
    manda: z.boolean().default(false),
    cuantos: opcional,
    tematica: texto.max(TOPE_TEMATICA_SUSCRIPCION, 'Quedó muy largo').default(''),
    editoriales: slugDeTaxonomia.default(''),
    sorpresa: opcional,
  }),
  extras: z.array(slugDeTaxonomia).default([]),
  extrasOtro: texto.max(TOPE_OTRO_SUSCRIPCION, 'Quedó muy largo').default(''),
  precio: z.object({ monto: opcional, porPeriodo: slugDeTaxonomia.default('') }),
  alcance: z.array(slugDeTaxonomia).default([]),
  linkDeSuscripcion: texto
    .max(TOPE_LINK_SUSCRIPCION, 'La dirección quedó muy larga')
    .default(''),
  instagram: opcional,
  whatsapp: opcional,
  mail: texto.max(TOPE_MAIL_SUSCRIPCION, 'Quedó muy largo').default(''),
  contactoDeQuienCargo: z.object({
    via: z.enum(VIAS_CONTACTO_SUSCRIPCION),
    valor: texto.max(TOPE_CONTACTO_SUSCRIPCION, 'Quedó muy largo').default(''),
  }),
});

/**
 * El formulario de **admin** (§ 5 del PRD): todos los campos, y el contacto de
 * quien cargó es opcional porque del lado del panel lo carga el propio admin.
 */
export const suscripcionFormSchema = base.superRefine((v, ctx) => {
  const falta = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  };

  /*
   * Trampa 10 — el slug **es** la URL pública. Una suscripción llamada «※» se
   * guardaría con `slug: ''` y su página no existiría.
   */
  const slug = slugDeSuscripcion(v);
  if (!slug) {
    falta(['slug'], 'Escribí la dirección web: el nombre no produce ninguna');
  } else if (!new RegExp(RE_SLUG_SUSCRIPCION).test(slug)) {
    // Sin tercera rama para el largo: el nombre está capado en 80 y el tope del
    // slug es 120, así que el derivado no puede pasarse; el tipeado lo frena el
    // `.max()` del campo. Una cláusula que no puede fallar es peor que ninguna.
    falta(['slug'], 'La dirección web va en minúsculas, números y guiones');
  }

  /*
   * Los seis vocabularios guardan **slugs** (§4.2). Un valor con mayúsculas o
   * espacios no resuelve su etiqueta, y en los tres que son eje de filtro
   * (`periodicidad`, `perfil-editorial`, `alcance-envio`) además no matchea
   * ningún chip: la ficha quedaría fuera de su propio filtro.
   */
  const slugMal = (valor: string) => valor && !new RegExp(RE_TAXONOMIA_SUSCRIPCION).test(valor);
  if (!v.periodicidad) falta(['periodicidad'], 'Elegí cada cuánto llega');
  else if (slugMal(v.periodicidad)) falta(['periodicidad'], 'Elegí una opción de la lista');
  if (!v.ofrecidaPor.tipo) falta(['ofrecidaPor', 'tipo'], 'Elegí qué es quien la ofrece');
  else if (slugMal(v.ofrecidaPor.tipo)) {
    falta(['ofrecidaPor', 'tipo'], 'Elegí una opción de la lista');
  }
  for (const [campo, valores] of [
    ['incluye', v.incluye],
    ['extras', v.extras],
    ['alcance', v.alcance],
  ] as const) {
    if (valores.some(slugMal)) falta([campo], 'Elegí las opciones de la lista');
  }

  /*
   * Los topes de las tres listas. No son regla de producto: la regla de
   * Firestore **no puede iterar una lista** (B-842), así que lo único que puede
   * acotar del otro lado es la cantidad, y los dos lados tienen que decir el
   * mismo número.
   */
  if (v.incluye.length > MAX_INCLUYE_SUSCRIPCION) {
    falta(['incluye'], `Hasta ${MAX_INCLUYE_SUSCRIPCION} cosas`);
  }
  if (v.extras.length > MAX_EXTRAS_SUSCRIPCION) {
    falta(['extras'], `Hasta ${MAX_EXTRAS_SUSCRIPCION} extras`);
  }
  if (v.alcance.length > MAX_ALCANCE_SUSCRIPCION) {
    falta(['alcance'], `Hasta ${MAX_ALCANCE_SUSCRIPCION} zonas`);
  }

  /*
   * ── Los condicionales de `envio` — §11 del `CLAUDE.md`, § 3.1 del PRD ────
   *
   * **La condición que usa el schema es la misma que decide si el campo se
   * muestra** (`SeccionEnvio` del formulario llama a `pideDatosDeEnvio`). Si se
   * separan, el formulario esconde un campo que el schema exige y el guardado
   * falla por algo que no está en pantalla (§ «Validación en el submit»).
   */
  if (pideDatosDeEnvio(v.envio)) {
    if (!v.envio.editoriales) {
      falta(['envio', 'editoriales'], 'Elegí el perfil de las editoriales, o «No lo dice»');
    }
    if (v.envio.cuantos) {
      const n = Number(v.envio.cuantos);
      if (
        !Number.isInteger(n) ||
        n < MIN_LIBROS_POR_ENTREGA ||
        n > MAX_LIBROS_POR_ENTREGA
      ) {
        falta(['envio', 'cuantos'], `Poné un número entre ${MIN_LIBROS_POR_ENTREGA} y ${MAX_LIBROS_POR_ENTREGA}`);
      }
    }
  } else {
    /*
     * Y al revés: los datos de envío **cargados sin que mande libros** se avisan
     * en vez de guardarse. Sin esto, una suscripción que dejó de mandar libros
     * conserva su temática y la ficha publica «novela negra» de algo que ya no
     * manda nada. Es la mitad del condicional que se olvida siempre.
     */
    if (v.envio.cuantos || v.envio.tematica || v.envio.editoriales || v.envio.sorpresa) {
      falta(['envio', 'manda'], 'Marcá que manda libros, o vaciá los datos del envío');
    }
  }
  if (v.envio.sorpresa && !['si', 'no'].includes(v.envio.sorpresa)) {
    falta(['envio', 'sorpresa'], 'Elegí una opción de la lista');
  }

  /*
   * ── El precio — DEC-12 ──────────────────────────────────────────────────
   *
   * Los dos campos o ninguno, con el mismo criterio que `geo`: un monto sin
   * período no se puede escribir en la ficha («$18.000» ¿por qué?), y un período
   * sin monto no dice nada. La **fecha** no se valida acá porque no se tipea: la
   * pone el armado del documento (ver `formASuscripcion`), que es la mitad de
   * DEC-12 que no se le puede delegar al formulario.
   */
  const montoCrudo = v.precio.monto.trim();
  if (Boolean(montoCrudo) !== Boolean(v.precio.porPeriodo)) {
    falta(
      ['precio', montoCrudo ? 'porPeriodo' : 'monto'],
      'Cargá el precio y a qué período corresponde, o ninguno de los dos',
    );
  } else if (montoCrudo) {
    const monto = Number(montoCrudo);
    if (
      !Number.isInteger(monto) ||
      monto < MIN_PRECIO_SUSCRIPCION ||
      monto > MAX_PRECIO_SUSCRIPCION
    ) {
      falta(['precio', 'monto'], 'Poné el precio en pesos, sin centavos y sin puntos');
    }
    if (slugMal(v.precio.porPeriodo)) {
      falta(['precio', 'porPeriodo'], 'Elegí una opción de la lista');
    }
  }

  /*
   * Los cuatro destinos públicos que terminan en un `href` de una página
   * **indexada**. Se validan acá y no solo al pintarlos por lo mismo que en una
   * librería: un dato roto que se guarda es un link roto en una página indexada,
   * y el saneador de la ficha lo único que puede hacer entonces es **no**
   * mostrarlo.
   */
  if (v.linkDeSuscripcion) {
    const url = urlSegura(v.linkDeSuscripcion);
    if (!url || !new RegExp(RE_LINK_SUSCRIPCION).test(url)) {
      falta(['linkDeSuscripcion'], 'El link de suscripción tiene que empezar con https://');
    }
  }
  if (v.instagram && !handleInstagram(v.instagram)) {
    falta(['instagram'], 'Poné el usuario de Instagram, sin el @');
  }
  if (v.ofrecidaPor.instagram && !handleInstagram(v.ofrecidaPor.instagram)) {
    falta(['ofrecidaPor', 'instagram'], 'Poné el usuario de Instagram, sin el @');
  }
  if (v.whatsapp) {
    const digitos = soloDigitos(v.whatsapp);
    if (
      digitos.length < MIN_WHATSAPP_SUSCRIPCION ||
      digitos.length > TOPE_WHATSAPP_SUSCRIPCION
    ) {
      falta(['whatsapp'], 'Poné el número con código de país, por ejemplo 5491122223333');
    }
  }
  if (v.mail && !pareceMail(v.mail)) {
    falta(['mail'], 'Ese mail no parece válido');
  }
  // El slug de la librería que la ofrece: es el segmento de una URL del propio
  // sitio (`/guia/librerias/{slug}`), así que tiene que ser un slug o no ser
  // nada. Que esa librería **exista y esté publicada** no se puede saber acá; lo
  // confirma quien arma la ficha, igual que con el hub de barrio.
  if (slugMal(v.ofrecidaPor.libreriaSlug)) {
    falta(['ofrecidaPor', 'libreriaSlug'], 'Poné la dirección web de la librería, sin /guia/librerias/');
  }

  /*
   * La galería, con las mismas dos reglas que una actividad y que una librería:
   * el techo de `MAXIMO_IMAGENES` y **exactamente una portada**. Cero imágenes es
   * válido; dos portadas no, porque entonces «cuál es la imagen» la contesta el
   * orden del array.
   */
  if (v.imagenes.length > MAXIMO_IMAGENES) {
    falta(['imagenes'], `Hasta ${MAXIMO_IMAGENES} imágenes por suscripción`);
  }
  const portadas = v.imagenes.filter((i) => i.portada).length;
  if (v.imagenes.length > 0 && portadas !== 1) {
    falta(['imagenes'], 'Elegí una sola imagen como portada');
  }

  if (
    v.contactoDeQuienCargo.valor &&
    v.contactoDeQuienCargo.valor.length < MIN_CONTACTO_SUSCRIPCION
  ) {
    falta(['contactoDeQuienCargo', 'valor'], 'Quedó muy corto');
  }
});

/**
 * ¿Este formulario tiene que mostrar (y validar) los datos del envío?
 *
 * Una función y no un `v.envio.manda` escrito en los dos lados: es la condición
 * del §11 y **la usan el schema y el formulario**. Separarlas es lo que hace que
 * el guardado falle por un campo que no está en pantalla.
 */
export const pideDatosDeEnvio = (envio: { manda: boolean }): boolean => envio.manda;

/**
 * El formulario **público** de `/guia/suscripciones/sumar`: el mismo, con una
 * regla más.
 *
 * Quien carga desde afuera **no vuelve a entrar** (`prd/README.md` § 7), así que
 * si la ficha llega incompleta o dudosa no hay forma de repreguntar y la única
 * salida es descartarla.
 */
export const suscripcionPublicaFormSchema = suscripcionFormSchema.superRefine((v, ctx) => {
  if (!v.contactoDeQuienCargo.valor.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactoDeQuienCargo', 'valor'],
      message: '¿Cómo te escribimos si hay que preguntarte algo?',
    });
  }
});

export type SuscripcionFormValues = z.input<typeof suscripcionFormSchema>;

export const suscripcionVacia = (): SuscripcionLiterariaForm => ({
  nombre: '',
  slug: '',
  descripcion: '',
  imagenes: [],
  ofrecidaPor: { nombre: '', tipo: '', instagram: '', libreriaSlug: '' },
  // § 4.1 — el default que hace que el formulario se vea igual de simple.
  periodicidad: PERIODICIDAD_POR_DEFECTO,
  compromisoMinimo: '',
  incluye: [],
  incluyeOtro: '',
  envio: { manda: false, cuantos: '', tematica: '', editoriales: '', sorpresa: '' },
  extras: [],
  extrasOtro: '',
  precio: { monto: '', porPeriodo: PERIODICIDAD_POR_DEFECTO },
  alcance: [],
  linkDeSuscripcion: '',
  instagram: '',
  whatsapp: '',
  mail: '',
  contactoDeQuienCargo: { via: 'mail', valor: '' },
});

/**
 * El precio del formulario, ya con su fecha — **la mitad de DEC-12 que el
 * formulario no puede escribir**.
 *
 * `cargadoEn` lo decide quien guarda y no quien tipea, por lo mismo que
 * `creadoEn`: un campo de fecha que se puede escribir es un campo de fecha que se
 * puede mentir, y esta fecha es justamente la que le dice a quien lee si le puede
 * creer al número (§ 6 del PRD).
 *
 * Sin monto no hay precio, y sin precio no hay fecha: devolver `{ valor: null }`
 * publicaría una fecha que no fecha nada.
 */
export const precioDelForm = (
  f: SuscripcionLiterariaForm,
  cargadoEn: TimestampLike,
): DatoConFecha<PrecioDeSuscripcion> | null => {
  const monto = Number(f.precio.monto.trim());
  if (!f.precio.monto.trim() || !Number.isFinite(monto) || !f.precio.porPeriodo) return null;
  return { valor: { monto, porPeriodo: f.precio.porPeriodo }, cargadoEn };
};

/**
 * ¿El precio que se está guardando **es otro** que el que ya estaba?
 *
 * Es lo que decide si `cargadoEn` se refecha. Y es la razón por la que existe:
 * corregir un typo de la descripción **no puede** mover la fecha del precio —
 * sería publicar que el número es más fresco de lo que es, que es exactamente la
 * mentira que DEC-12 evita—; y cambiar el número **sí** tiene que moverla.
 *
 * Compara el valor y no el objeto entero, que es lo mismo que hace la guarda
 * anti-loop del §7.1: se deriva lo relevante y se compara eso.
 */
export const precioCambio = (
  previo: DatoConFecha<PrecioDeSuscripcion> | null | undefined,
  nuevo: DatoConFecha<PrecioDeSuscripcion> | null,
): boolean =>
  JSON.stringify(previo?.valor ?? null) !== JSON.stringify(nuevo?.valor ?? null);

/**
 * Form → documento, **sin los campos que pone la regla**: `creadoEn` es
 * `request.time`, y el `estado` y la `revision` los fuerza la propia regla.
 *
 * `''` → `null` en todo lo opcional, por el mismo criterio que `formALibreria`:
 * la ausencia se representa **una sola vez**, y así la regla puede exigir
 * `== null` en lugar de aceptar dos formas de vacío.
 *
 * Los contactos públicos se guardan **normalizados** —el handle sin arroba, el
 * teléfono sin signos, el link con esquema—: lo que se guarda es lo que la ficha
 * va a publicar. Si se guardara crudo, cada consumidor tendría que volver a
 * normalizarlo y serían cuatro derivaciones de la misma idea (la clase de B-88).
 *
 * Y `envio` se **vacía** cuando no manda libros, en vez de conservar lo que
 * quedó tipeado: el schema ya avisa, y esto es la otra mitad — un documento donde
 * `manda: false` conviva con una temática es un documento que la ficha puede
 * publicar mal el día que alguien lea el campo sin mirar el flag. Es el par
 * flag + dato de `urlPublica` y `material.items[].publico` — la **tercera
 * instancia**, y ⚠️ la clase **no tiene red**: está cubierta por instancia acá y
 * en la proyección, no por un chequeo de la forma. Ver el docblock de
 * `envioPublico` en `lib/suscripcionPublica.ts`.
 */
export const formASuscripcion = (
  f: SuscripcionLiterariaForm,
  cargadoEn: TimestampLike,
  origen: SuscripcionLiteraria['origen'] = 'formulario-publico',
): Omit<SuscripcionLiteraria, 'creadoEn'> => {
  const oNull = (s: string): string | null => (s.trim() ? s.trim() : null);
  const digitos = soloDigitos(f.whatsapp);
  const nombre = f.nombre.trim();
  const descripcion = f.descripcion.trim();
  const manda = f.envio.manda;
  const tematica = manda ? oNull(f.envio.tematica) : null;
  const link = urlSegura(f.linkDeSuscripcion);

  return {
    nombre,
    slug: slugDeSuscripcion(f),
    descripcion,
    // Las claves se **enumeran** en vez de spreadear la fila, por lo mismo que
    // `formADocumento` con las imágenes de una actividad (B-206 #2): así un
    // campo que escriba el servidor no puede viajar de vuelta por el formulario.
    imagenes: f.imagenes.map((i) => ({
      id: i.id,
      url: i.url.trim(),
      epigrafe: i.epigrafe ?? '',
      ...(i.textoAlternativo === undefined ? {} : { textoAlternativo: i.textoAlternativo }),
      origen: i.origen,
      ...(i.storagePath === undefined ? {} : { storagePath: i.storagePath }),
      ...(i.ancho === undefined ? {} : { ancho: i.ancho }),
      ...(i.alto === undefined ? {} : { alto: i.alto }),
      portada: i.portada,
    })),
    ofrecidaPor: {
      nombre: f.ofrecidaPor.nombre.trim(),
      tipo: f.ofrecidaPor.tipo.trim(),
      instagram: handleInstagram(f.ofrecidaPor.instagram),
      libreriaSlug: oNull(f.ofrecidaPor.libreriaSlug),
    },
    periodicidad: f.periodicidad.trim(),
    compromisoMinimo: oNull(f.compromisoMinimo),
    incluye: f.incluye.map((s) => s.trim()).filter(Boolean),
    incluyeOtro: oNull(f.incluyeOtro),
    envio: {
      manda,
      cuantos: manda && f.envio.cuantos.trim() ? Number(f.envio.cuantos) : null,
      tematica,
      editoriales: manda ? oNull(f.envio.editoriales) : null,
      // `''` → `null` («no lo dice»), y los otros dos valores a booleano. Tres
      // estados en un `<select>` y tres en el documento: no hay cuarto.
      sorpresa: manda && f.envio.sorpresa ? f.envio.sorpresa === 'si' : null,
    },
    extras: f.extras.map((s) => s.trim()).filter(Boolean),
    extrasOtro: oNull(f.extrasOtro),
    precio: precioDelForm(f, cargadoEn),
    alcance: f.alcance.map((s) => s.trim()).filter(Boolean),
    linkDeSuscripcion: link && new RegExp(RE_LINK_SUSCRIPCION).test(link) ? link : null,
    instagram: handleInstagram(f.instagram),
    whatsapp: digitos ? digitos : null,
    mail: oNull(f.mail),
    contactoDeQuienCargo: f.contactoDeQuienCargo.valor.trim()
      ? { via: f.contactoDeQuienCargo.via, valor: f.contactoDeQuienCargo.valor.trim() }
      : null,
    estado: ESTADO_INICIAL,
    origen,
    /*
     * §6 — el índice de búsqueda, normalizado al escribir para que «Crónica»
     * matchee «cronica».
     *
     * **El precio no entra, y no es un olvido**: la segunda regla de DEC-12 dice
     * que el monto no entra a un filtro, y el buscador del listado **es** un
     * filtro — tipear «18000» y que aparezca una ficha es comparar precios por la
     * ventana. Entran los dos textos libres (`tematica` y `compromisoMinimo`),
     * que es lo que el § 4.2 del PRD promete cuando decide que la temática no sea
     * taxonomía: «el texto libre entra a `searchText`, y ahí el buscador en
     * memoria lo encuentra igual».
     */
    searchText: normalize(
      [nombre, descripcion, f.ofrecidaPor.nombre, tematica ?? '', f.compromisoMinimo].join(' '),
    ).trim(),
    revision: { porUid: null, en: null, motivo: null },
  };
};
