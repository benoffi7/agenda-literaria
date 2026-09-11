/**
 * Validación y armado de una librería — PRD 2 (`docs/prd/02-librerias.md`),
 * B-831. Lógica pura: sin Firestore ni navegador, así se testea sin emuladores
 * (`05-patrones.md`).
 *
 * Se valida **en el submit** con zod y los condicionales van en `superRefine`,
 * que es el criterio de `src/lib/schema.ts` (D-01, § «Validación en el submit,
 * no por campo»). No hay librería de formularios.
 *
 * ── Lo que este archivo NO es ─────────────────────────────────────────────
 * **No es la defensa.** El formulario público de `/guia/librerias/sumar` lo
 * completa alguien sin login, así que todo lo de acá se saltea con un `curl`: la
 * defensa es `firestore.rules` (`libreriaValida()`), y este schema existe para
 * que la persona vea el error antes de mandar. Los dos dicen los mismos números
 * —importados de `types/libreria.ts`, y el lado de la regla atado por
 * `tests/librerias.test.ts`— porque un documento que pase por acá y no por la
 * regla **no se guarda igual**, con el formulario diciendo que sí. Es la clase de
 * B-88 en el peor lugar posible, y la lección de DEC-7b.
 *
 * ── Los dos schemas, que son el mismo formulario con dos configuraciones ──
 * `libreriaFormSchema` es el del panel; `libreriaPublicaFormSchema` le agrega
 * **una** regla: quien carga desde afuera tiene que dejar por dónde
 * repreguntarle (§ 5 del PRD). Es una regla y no un tipo aparte a propósito: dos
 * formularios son dos derivaciones de la misma forma, y se separan sin que nada
 * falle.
 */
import { z } from 'zod';
import { ESTADO_INICIAL, slugDeFicha } from '@/lib/directorios';
import { handleInstagram, urlSegura } from '@/lib/enlaceSeguro';
import { MAXIMO_IMAGENES } from '@/lib/imagenes';
import { normalize } from '@/lib/normalize';
import {
  CIUDAD_POR_DEFECTO,
  MIN_CONTACTO_LIBRERIA,
  MIN_DIRECCION_LIBRERIA,
  MIN_NOMBRE_LIBRERIA,
  MIN_WHATSAPP_LIBRERIA,
  TOPE_BARRIO_LIBRERIA,
  TOPE_CIUDAD_LIBRERIA,
  TOPE_CONTACTO_LIBRERIA,
  TOPE_DESCRIPCION_LIBRERIA,
  TOPE_DIRECCION_LIBRERIA,
  TOPE_MAIL_LIBRERIA,
  TOPE_NOMBRE_LIBRERIA,
  TOPE_SLUG_LIBRERIA,
  TOPE_WEB_LIBRERIA,
  TOPE_WHATSAPP_LIBRERIA,
  VIAS_CONTACTO_LIBRERIA,
} from '@/types/libreria';
import type { Libreria, LibreriaForm } from '@/types/libreria';

const texto = z.string().trim();
const opcional = texto.default('');

/**
 * El alfabeto de un slug, **el mismo que produce `slugify`** y el mismo que
 * exige el `matches` de `firestore.rules`.
 *
 * Se exporta porque `tests/librerias.test.ts` compara esta fuente con la de la
 * regla: dos definiciones de «qué es un slug» se separan sin que nada falle
 * (clase de B-88), y acá el precio de que se separen es una dirección web que el
 * panel acepta y Firestore rechaza — o peor, al revés.
 */
export const RE_SLUG = '^[a-z0-9]+(-[a-z0-9]+)*$';
/** Los barrios son slugs de taxonomía (§4.2), producidos por el mismo `slugify`. */
export const RE_BARRIO = RE_SLUG;
/** El WhatsApp se guarda **solo con dígitos**: de él sale un `wa.me/<digitos>`. */
export const RE_WHATSAPP = `^[0-9]{${MIN_WHATSAPP_LIBRERIA},${TOPE_WHATSAPP_LIBRERIA}}$`;
/** El alfabeto real de un handle de Instagram, el de `handleInstagram`. */
export const RE_INSTAGRAM = '^[A-Za-z0-9._]{1,30}$';

/** `+54 9 11 2222-3333` → `5491122223333`. Lo que se publica es esto. */
export const soloDigitos = (valor: string): string => valor.replace(/\D/g, '');

/** ¿Esto parece un mail? Mismo criterio que zod, en una función para reusarlo. */
export const pareceMail = (valor: string): boolean =>
  z.string().email().safeParse(valor.trim()).success;

/**
 * La dirección web de la ficha: **la tipeada tal cual si la hay**, si no la
 * derivada del nombre con `slugDeFicha`.
 *
 * `slugDeFicha` y no un regex propio para el derivado, por lo mismo que
 * `directorios.ts` dice de él: es el `slugify` de las taxonomías y de las
 * actividades, y dos versiones de «cómo se hace un slug» se separan sin que nada
 * falle.
 *
 * **Lo tipeado NO se slugifica, y es una decisión.** Pasarlo por `slugify`
 * también sería más cómodo —nunca da un valor inválido— y tendría dos costos que
 * no valen la pena: reescribe en silencio lo que alguien escribió a mano para un
 * valor que **queda congelado al publicar** (trampa 10), y dejaría la rama de
 * formato del `superRefine` sin poder fallar nunca, que es la clase de cláusula
 * muerta que este repo persigue. El campo existe para el desempate del § 8 del
 * PRD (`-palermo` en vez de `-2`): si se tipeó mal, se avisa.
 *
 * **Puede dar `''`**, y ése es el otro caso que el `superRefine` agarra: un
 * nombre de puros signos no produce ninguna dirección, y devolver algo inventado
 * publicaría una URL que nadie escribió.
 */
export const slugDeLibreria = (f: { nombre: string; slug: string }): string =>
  f.slug.trim() ? f.slug.trim() : slugDeFicha(f.nombre);

/**
 * Una fila de la galería (D-125).
 *
 * ⚠️ **Es la segunda derivación de la misma forma**: la primera es
 * `imagenSchema` de `src/lib/schema.ts`, que no está exportado. Mientras sean
 * dos, un campo nuevo de `Imagen` entra en una y no en la otra sin que nada se
 * ponga rojo — la clase de B-88. Lo que hoy lo sostiene es el compilador (las
 * dos producen un `Imagen`) y lo que falta es unificarlas; está anotado para el
 * backlog. Los cuatro campos **opcionales** lo son por D-125/B-301 y se leen con
 * el default que preserva lo anterior, no se exigen acá.
 */
const imagenDeLibreriaSchema = z.object({
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

const base = z.object({
  nombre: texto
    .min(MIN_NOMBRE_LIBRERIA, '¿Cómo se llama la librería?')
    .max(TOPE_NOMBRE_LIBRERIA, 'El nombre tiene que ser más corto'),
  // El slug va acá sin formato: el formulario público **no lo muestra** y llega
  // vacío, así que un `.regex()` en el campo haría inguardable el camino
  // normal. La forma se valida en el `superRefine`, sobre el slug ya derivado.
  slug: texto.max(TOPE_SLUG_LIBRERIA, 'La dirección web quedó muy larga').default(''),
  descripcion: texto.max(TOPE_DESCRIPCION_LIBRERIA, 'Quedó muy largo, resumilo').default(''),
  imagenes: z.array(imagenDeLibreriaSchema).default([]),
  direccion: texto
    .min(MIN_DIRECCION_LIBRERIA, '¿Dónde queda?')
    .max(TOPE_DIRECCION_LIBRERIA, 'La dirección quedó muy larga'),
  barrio: texto.min(1, 'Elegí el barrio').max(TOPE_BARRIO_LIBRERIA, 'Quedó muy largo'),
  ciudad: texto.max(TOPE_CIUDAD_LIBRERIA, 'Quedó muy largo').default(CIUDAD_POR_DEFECTO),
  // Los dos como texto: salen de un `<input>`, y un `''` es «no lo cargué».
  geo: z.object({ lat: opcional, lng: opcional }).default({ lat: '', lng: '' }),
  instagram: opcional,
  whatsapp: opcional,
  web: texto.max(TOPE_WEB_LIBRERIA, 'La dirección quedó muy larga').default(''),
  mail: texto.max(TOPE_MAIL_LIBRERIA, 'Quedó muy largo').default(''),
  contactoDeQuienCargo: z.object({
    via: z.enum(VIAS_CONTACTO_LIBRERIA),
    valor: texto.max(TOPE_CONTACTO_LIBRERIA, 'Quedó muy largo').default(''),
  }),
});

/**
 * El formulario de **admin** (§ 5 del PRD): todos los campos, y el contacto de
 * quien cargó es opcional porque del lado del panel lo carga el propio admin.
 */
export const libreriaFormSchema = base.superRefine((v, ctx) => {
  const falta = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  };

  /*
   * Trampa 10 — el slug **es** la URL pública. Que la ficha tenga una dirección
   * web legible es un requisito del documento, no del formulario: sin esto, una
   * librería llamada «※» se guarda con `slug: ''` y su página no existe.
   */
  const slug = slugDeLibreria(v);
  if (!slug) {
    falta(['slug'], 'Escribí la dirección web: el nombre no produce ninguna');
  } else if (!new RegExp(RE_SLUG).test(slug)) {
    // El derivado no puede pasarse de largo —el nombre está capado en 80 y el
    // tope del slug es 120—, así que acá no hay una tercera rama: la que frena
    // el largo es el `.max()` del campo, sobre el slug **tipeado**, que es el
    // único que puede llegar largo. Una cláusula que no puede fallar es peor
    // que ninguna.
    falta(['slug'], 'La dirección web va en minúsculas, números y guiones');
  }

  // El barrio es un slug de `/opciones/barrio` — **el mismo que usan las
  // actividades** (§ 2 del PRD). Un barrio con mayúsculas o espacios no resuelve
  // su etiqueta y el hub de barrio no lo encuentra.
  if (v.barrio && !new RegExp(RE_BARRIO).test(v.barrio)) {
    falta(['barrio'], 'Elegí el barrio de la lista');
  }

  /*
   * Los tres contactos públicos que terminan en un `href`. Se validan acá y no
   * solo al pintarlos, por lo mismo que `sedeSchema` valida el rango de `geo`:
   * un dato roto que se guarda es un link roto en una página indexada, y el
   * saneador de la ficha lo único que puede hacer entonces es **no** mostrarlo.
   *
   * Las tres funciones son las que el proyecto ya usa (`handleInstagram`,
   * `urlSegura`, el `email` de zod), no regex propios.
   */
  if (v.instagram && !handleInstagram(v.instagram)) {
    falta(['instagram'], 'Poné el usuario de Instagram, sin el @');
  }
  if (v.whatsapp) {
    const digitos = soloDigitos(v.whatsapp);
    if (digitos.length < MIN_WHATSAPP_LIBRERIA || digitos.length > TOPE_WHATSAPP_LIBRERIA) {
      falta(['whatsapp'], 'Poné el número con código de país, por ejemplo 5491122223333');
    }
  }
  if (v.web && !urlSegura(v.web)) {
    falta(['web'], 'Esa dirección no es válida');
  }
  if (v.mail && !pareceMail(v.mail)) {
    falta(['mail'], 'Ese mail no parece válido');
  }

  /*
   * `geo` — los dos o ninguno, y dentro del rango. Mismo criterio que
   * `sedeSchema` (`lib/schema.ts`): una latitud de 200 no existe, y un lat/lng
   * invertido manda la ficha al otro lado del mundo. Va en el nivel de siempre
   * porque no es completitud, es un dato roto.
   */
  const { lat, lng } = v.geo;
  if (Boolean(lat) !== Boolean(lng)) {
    falta(['geo', lat ? 'lng' : 'lat'], 'Cargá la latitud y la longitud, o ninguna');
  } else if (lat && lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || nLat < -90 || nLat > 90) {
      falta(['geo', 'lat'], 'Latitud fuera de rango');
    }
    if (!Number.isFinite(nLng) || nLng < -180 || nLng > 180) {
      falta(['geo', 'lng'], 'Longitud fuera de rango');
    }
  }

  /*
   * La galería, con las mismas dos reglas que una actividad: el techo de
   * `MAXIMO_IMAGENES` y **exactamente una portada**, que es la que va a Open
   * Graph y a la tarjeta. Cero imágenes es válido —una ficha sin foto se publica
   * igual—; dos portadas no, porque entonces «cuál es la imagen» la contesta el
   * orden del array.
   */
  if (v.imagenes.length > MAXIMO_IMAGENES) {
    falta(['imagenes'], `Hasta ${MAXIMO_IMAGENES} imágenes por librería`);
  }
  const portadas = v.imagenes.filter((i) => i.portada).length;
  if (v.imagenes.length > 0 && portadas !== 1) {
    falta(['imagenes'], 'Elegí una sola imagen como portada');
  }
  if (v.contactoDeQuienCargo.valor && v.contactoDeQuienCargo.valor.length < MIN_CONTACTO_LIBRERIA) {
    falta(['contactoDeQuienCargo', 'valor'], 'Quedó muy corto');
  }
});

/**
 * El formulario **público** de `/guia/librerias/sumar`: el mismo, con una regla
 * más.
 *
 * Quien carga desde afuera **no vuelve a entrar** (`prd/README.md` § 7), así que
 * si la ficha llega incompleta o dudosa no hay forma de repreguntar y la única
 * salida es descartarla. Por eso el contacto interno es obligatorio de este lado
 * y opcional del otro — es exactamente la diferencia entre las dos
 * configuraciones, y es una regla, no un tipo aparte.
 */
export const libreriaPublicaFormSchema = libreriaFormSchema.superRefine((v, ctx) => {
  if (!v.contactoDeQuienCargo.valor.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactoDeQuienCargo', 'valor'],
      message: '¿Cómo te escribimos si hay que preguntarte algo?',
    });
  }
});

export type LibreriaFormValues = z.input<typeof libreriaFormSchema>;

export const libreriaVacia = (): LibreriaForm => ({
  nombre: '',
  slug: '',
  descripcion: '',
  imagenes: [],
  direccion: '',
  barrio: '',
  ciudad: CIUDAD_POR_DEFECTO,
  geo: { lat: '', lng: '' },
  instagram: '',
  whatsapp: '',
  web: '',
  mail: '',
  contactoDeQuienCargo: { via: 'mail', valor: '' },
});

/**
 * Form → documento, **sin los campos que pone la regla**: `creadoEn` es
 * `request.time`, y el `estado` y la `revision` los fuerza la propia regla, así
 * que la capa que escribe agrega el primero y éstos salen de acá con el valor
 * que la regla va a exigir igual.
 *
 * `''` → `null` en todo lo opcional, por el mismo criterio que `formAPropuesta`:
 * la ausencia se representa **una sola vez**, y así la regla puede exigir
 * `== null` en lugar de aceptar dos formas de vacío.
 *
 * Y los cuatro contactos públicos se guardan **normalizados** —el handle sin
 * arroba, el teléfono sin signos, la web con esquema—: lo que se guarda es lo
 * que la ficha va a publicar, no lo que se tipeó. Si se guardara crudo, cada
 * consumidor tendría que volver a normalizarlo y serían cuatro derivaciones de
 * la misma idea (la clase de B-88).
 */
export const formALibreria = (
  f: LibreriaForm,
  origen: Libreria['origen'] = 'formulario-publico',
): Omit<Libreria, 'creadoEn'> => {
  const oNull = (s: string): string | null => (s.trim() ? s.trim() : null);
  const digitos = soloDigitos(f.whatsapp);
  const lat = Number(f.geo.lat);
  const lng = Number(f.geo.lng);
  const hayGeo =
    f.geo.lat.trim() !== '' &&
    f.geo.lng.trim() !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const nombre = f.nombre.trim();
  const descripcion = oNull(f.descripcion);
  const direccion = f.direccion.trim();
  const barrio = f.barrio.trim();
  const ciudad = f.ciudad.trim() || CIUDAD_POR_DEFECTO;

  return {
    nombre,
    slug: slugDeLibreria(f),
    descripcion,
    // Las claves se **enumeran** en vez de spreadear la fila, por lo mismo que
    // `formADocumento` con las imágenes de una actividad (B-206 #2): así un
    // campo que escriba el servidor no puede viajar de vuelta por el formulario.
    imagenes: f.imagenes.map((i) => ({
      id: i.id,
      url: i.url.trim(),
      // `epigrafe` con su default de lectura, y `textoAlternativo` solo si
      // está: los dos son opcionales desde D-125/B-301, y un `undefined`
      // explícito no es lo mismo que una clave ausente — el SDK de Firestore
      // rechaza el documento entero al verlo.
      epigrafe: i.epigrafe ?? '',
      ...(i.textoAlternativo === undefined ? {} : { textoAlternativo: i.textoAlternativo }),
      origen: i.origen,
      ...(i.storagePath === undefined ? {} : { storagePath: i.storagePath }),
      ...(i.ancho === undefined ? {} : { ancho: i.ancho }),
      ...(i.alto === undefined ? {} : { alto: i.alto }),
      portada: i.portada,
    })),
    direccion,
    barrio,
    ciudad,
    geo: hayGeo ? { lat, lng } : null,
    instagram: handleInstagram(f.instagram),
    whatsapp: digitos ? digitos : null,
    web: urlSegura(f.web),
    mail: oNull(f.mail),
    contactoDeQuienCargo: f.contactoDeQuienCargo.valor.trim()
      ? { via: f.contactoDeQuienCargo.via, valor: f.contactoDeQuienCargo.valor.trim() }
      : null,
    estado: ESTADO_INICIAL,
    origen,
    /*
     * §6 — el índice de búsqueda, normalizado al escribir para que «Crónica»
     * matchee «cronica». El barrio entra por su **slug**, que es lo mismo que
     * hace el `searchText` de una actividad con `sede.barrio`: dos criterios
     * distintos para el mismo índice serían dos derivaciones de la misma idea.
     */
    searchText: normalize([nombre, descripcion ?? '', direccion, barrio, ciudad].join(' ')).trim(),
    revision: { porUid: null, en: null, motivo: null },
  };
};
