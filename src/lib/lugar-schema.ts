/**
 * Validación y armado de un lugar para eventos — PRD 4
 * (`docs/prd/04-lugares-para-eventos.md`), B-833. Lógica pura: sin Firestore ni
 * navegador, así se testea sin emuladores (`05-patrones.md`).
 *
 * Se valida **en el submit** con zod y los condicionales van en `superRefine`,
 * que es el criterio de `src/lib/schema.ts` (D-01).
 *
 * ── Lo que este archivo NO es ─────────────────────────────────────────────
 * **No es la defensa.** El formulario público de `/guia/lugares/sumar` lo va a
 * completar alguien sin login, así que todo lo de acá se saltea con un `curl`:
 * la defensa es `firestore.rules` (`lugarValido()`), y este schema existe para
 * que la persona vea el error antes de mandar. Los dos dicen los mismos números
 * —importados de `types/lugar.ts`, y el lado de la regla atado por
 * `tests/lugares.test.ts`— porque un documento que pase por acá y no por la
 * regla **no se guarda igual**, con el formulario diciendo que sí.
 *
 * ── Y hay una cláusula que acá pesa más que en los otros dos directorios ──
 * `direccionPublica` (§ 6 del PRD). El schema hace **dos** cosas con ella y
 * ninguna es la que protege de verdad:
 *
 * 1. avisa cuando un tipo de `TIPOS_SIN_DIRECCION_PUBLICA` llega con la casilla
 *    prendida, para que sea una decisión y no un descuido;
 * 2. `formALugar` la **fuerza en `false`** cuando la ficha viene del formulario
 *    público, que es el criterio 3 del PRD.
 *
 * La que protege de verdad es la regla, que exige lo mismo del lado que no se
 * puede saltear, y la proyección, que no publica la dirección si el flag está
 * apagado pase lo que pase en el documento.
 */
import { z } from 'zod';
import type { DatoConFecha } from '@/lib/datoConFecha';
import { ESTADO_INICIAL, slugDeFicha } from '@/lib/directorios';
import { handleInstagram, urlSegura } from '@/lib/enlaceSeguro';
import { MAXIMO_IMAGENES } from '@/lib/imagenes';
// La derivación del índice de búsqueda vive del lado **público** y se importa:
// es la misma para el documento y para lo que se publica, así que no puede haber
// dos (la clase de B-88). Ver su docblock en `lib/lugarPublico.ts`.
import { searchTextDeLugar } from '@/lib/lugarPublico';
import { CIUDAD_POR_DEFECTO } from '@/types/libreria';
import {
  MAX_CAPACIDAD_LUGAR,
  MAX_INCLUYE_LUGAR,
  MAX_PRECIO_LUGAR,
  MIN_CAPACIDAD_LUGAR,
  MIN_CONTACTO_LUGAR,
  MIN_DIRECCION_LUGAR,
  MIN_NOMBRE_LUGAR,
  MIN_PRECIO_LUGAR,
  MIN_WHATSAPP_LUGAR,
  TOPE_CAPACIDAD_NOTAS_LUGAR,
  TOPE_CIUDAD_LUGAR,
  TOPE_CONDICION_NOTAS_LUGAR,
  TOPE_CONTACTO_LUGAR,
  TOPE_DESCRIPCION_LUGAR,
  TOPE_DIRECCION_LUGAR,
  TOPE_MAIL_LUGAR,
  TOPE_NOMBRE_LUGAR,
  TOPE_OTRO_LUGAR,
  TOPE_SLUG_LUGAR,
  TOPE_SLUG_TAXONOMIA_LUGAR,
  TOPE_WEB_LUGAR,
  TOPE_WHATSAPP_LUGAR,
  UNIDADES_DE_PRECIO_LUGAR,
  VIAS_CONTACTO_LUGAR,
  direccionPublicaPorDefecto,
} from '@/types/lugar';
import type { Lugar, LugarForm, PrecioDeLugar, UnidadDePrecioLugar } from '@/types/lugar';
import type { TimestampLike } from '@/types/actividad';

const texto = z.string().trim();
const opcional = texto.default('');

/**
 * El alfabeto de un slug, **el mismo que produce `slugify`** y el mismo que
 * exige el `matches` de `firestore.rules`.
 *
 * Se exporta porque `tests/lugares.test.ts` compara esta fuente con la de la
 * regla: dos definiciones de «qué es un slug» se separan sin que nada falle (la
 * clase de B-88).
 */
export const RE_SLUG_LUGAR = '^[a-z0-9]+(-[a-z0-9]+)*$';
/** Los cuatro vocabularios de este modelo guardan slugs del mismo alfabeto. */
export const RE_TAXONOMIA_LUGAR = RE_SLUG_LUGAR;
/** El WhatsApp se guarda **solo con dígitos**: de él sale un `wa.me/<digitos>`. */
export const RE_WHATSAPP_LUGAR = `^[0-9]{${MIN_WHATSAPP_LUGAR},${TOPE_WHATSAPP_LUGAR}}$`;
/** El alfabeto real de un handle de Instagram, el de `handleInstagram`. */
export const RE_INSTAGRAM_LUGAR = '^[A-Za-z0-9._]{1,30}$';
/**
 * La web del lugar acepta `http://`, **al revés que el link de cobro de una
 * suscripción** (§ 9.7 del PRD 3): esto lleva a una página institucional vieja,
 * no a mandar a alguien a pagar por un canal sin cifrar. Es el mismo patrón que
 * la `web` de una librería.
 */
export const RE_WEB_LUGAR = '^https?://.*';

/** `+54 9 11 2222-3333` → `5491122223333`. Lo que se publica es esto. */
export const soloDigitos = (valor: string): string => valor.replace(/\D/g, '');

/** ¿Esto parece un mail? Mismo criterio que zod, en una función para reusarlo. */
export const pareceMail = (valor: string): boolean =>
  z.string().email().safeParse(valor.trim()).success;

/**
 * La dirección web de la ficha: **la tipeada tal cual si la hay**, si no la
 * derivada del nombre con `slugDeFicha`.
 *
 * Mismo criterio y mismo docblock que `slugDeLibreria` y `slugDeSuscripcion`: lo
 * tipeado **no** se slugifica —reescribir en silencio un valor que queda
 * congelado al publicar es la trampa 10 con disfraz— y el derivado puede dar
 * `''`, que es el caso que el `superRefine` agarra.
 */
export const slugDeLugar = (f: { nombre: string; slug: string }): string =>
  f.slug.trim() ? f.slug.trim() : slugDeFicha(f.nombre);

/**
 * Una fila de la galería (D-125).
 *
 * ⚠️ **Es la cuarta derivación de la misma forma** —`imagenSchema` de
 * `src/lib/schema.ts`, `imagenDeLibreriaSchema` y `imagenDeSuscripcionSchema`
 * son las otras tres— y eso está anotado como deuda desde que eran dos:
 * **B-906**, «`imagenSchema` está escrito dos veces: `src/lib/schema.ts` no lo
 * exporta». (El docblock equivalente de `suscripcion-literaria-schema.ts` cita
 * **B-909**, que es otra cosa —el slug sin reserva atómica—; queda anotado.)
 *
 * Se escribe igual que las otras **a propósito**: lo que hay que hacer es
 * unificarlas exportando la de `schema.ts`, no que la cuarta invente una
 * variante.
 */
const imagenDeLugarSchema = z.object({
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

/** ¿Este texto es una de las cuatro unidades de precio? */
export const esUnidadDePrecio = (valor: string): valor is UnidadDePrecioLugar =>
  (UNIDADES_DE_PRECIO_LUGAR as readonly string[]).includes(valor);

/** Un slug de taxonomía tal como lo guarda el documento. */
const slugDeTaxonomia = texto.max(TOPE_SLUG_TAXONOMIA_LUGAR, 'Ese valor quedó muy largo');

const base = z.object({
  nombre: texto
    .min(MIN_NOMBRE_LUGAR, '¿Cómo se llama el lugar?')
    .max(TOPE_NOMBRE_LUGAR, 'El nombre tiene que ser más corto'),
  // El slug va sin formato acá: el formulario público **no lo muestra** y llega
  // vacío, así que un `.regex()` en el campo haría inguardable el camino normal.
  // La forma se valida en el `superRefine`, sobre el slug ya derivado.
  slug: texto.max(TOPE_SLUG_LUGAR, 'La dirección web quedó muy larga').default(''),
  // **Opcional**, como en una librería: un café con su dirección y su capacidad
  // ya dice lo que hay que saber.
  descripcion: texto.max(TOPE_DESCRIPCION_LUGAR, 'Quedó muy largo, resumilo').default(''),
  imagenes: z.array(imagenDeLugarSchema).default([]),
  tipo: slugDeTaxonomia.default(''),
  /*
   * ⚠️ **Opcional, al revés que en una librería** — § 6 del PRD.
   *
   * Una librería es un local y su dirección es el punto de la ficha. Un lugar
   * puede ser la casa de alguien, y ahí la dirección **no se va a publicar**:
   * exigirla sería pedir el dato más sensible del proyecto para guardarlo y no
   * usarlo. Sin dirección, la ficha dice el barrio y quien escriba la pide, que
   * es exactamente lo que el § 6 describe.
   *
   * La otra mitad está en el `superRefine`: **si la dirección se va a publicar,
   * tiene que estar**. El par se cierra en las dos direcciones.
   */
  direccion: texto.max(TOPE_DIRECCION_LUGAR, 'La dirección quedó muy larga').default(''),
  barrio: texto.min(1, 'Elegí el barrio').max(TOPE_SLUG_TAXONOMIA_LUGAR, 'Quedó muy largo'),
  ciudad: texto.max(TOPE_CIUDAD_LUGAR, 'Quedó muy largo').default(CIUDAD_POR_DEFECTO),
  // Los dos como texto: salen de un `<input>`, y un `''` es «no lo cargué».
  geo: z.object({ lat: opcional, lng: opcional }).default({ lat: '', lng: '' }),
  direccionPublica: z.boolean().default(true),
  capacidad: opcional,
  capacidadNotas: texto.max(TOPE_CAPACIDAD_NOTAS_LUGAR, 'Quedó muy largo').default(''),
  incluye: z.array(slugDeTaxonomia).default([]),
  incluyeOtro: texto.max(TOPE_OTRO_LUGAR, 'Quedó muy largo').default(''),
  condicion: slugDeTaxonomia.default(''),
  precio: z.object({ monto: opcional, porUnidad: opcional }),
  condicionNotas: texto.max(TOPE_CONDICION_NOTAS_LUGAR, 'Quedó muy largo').default(''),
  instagram: opcional,
  whatsapp: opcional,
  mail: texto.max(TOPE_MAIL_LUGAR, 'Quedó muy largo').default(''),
  web: texto.max(TOPE_WEB_LUGAR, 'La dirección quedó muy larga').default(''),
  contactoDeQuienCargo: z.object({
    via: z.enum(VIAS_CONTACTO_LUGAR),
    valor: texto.max(TOPE_CONTACTO_LUGAR, 'Quedó muy largo').default(''),
  }),
});

/**
 * ¿Este formulario tiene que mostrar (y validar) los datos de la dirección
 * pública?
 *
 * Una función y no un `!TIPOS_SIN_DIRECCION_PUBLICA.includes(tipo)` escrito en
 * los dos lados: **la usan el schema y el formulario**, y separarlas es lo que
 * hace que el guardado falle por algo que no está en pantalla (§ «Validación en
 * el submit» de `05-patrones.md`).
 */
export const puedePublicarLaDireccion = (tipo: string): boolean =>
  direccionPublicaPorDefecto(tipo);

/**
 * El formulario de **admin** (§ 1 del PRD): todos los campos, y el contacto de
 * quien cargó es opcional porque del lado del panel lo carga el propio admin.
 */
export const lugarFormSchema = base.superRefine((v, ctx) => {
  const falta = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  };

  /*
   * Trampa 10 — el slug **es** la URL pública. Un lugar llamado «※» se guardaría
   * con `slug: ''` y su página no existiría.
   */
  const slug = slugDeLugar(v);
  if (!slug) {
    falta(['slug'], 'Escribí la dirección web: el nombre no produce ninguna');
  } else if (!new RegExp(RE_SLUG_LUGAR).test(slug)) {
    // Sin tercera rama para el largo: el nombre está capado en 80 y el tope del
    // slug es 120, así que el derivado no puede pasarse; el tipeado lo frena el
    // `.max()` del campo. Una cláusula que no puede fallar es peor que ninguna.
    falta(['slug'], 'La dirección web va en minúsculas, números y guiones');
  }

  /*
   * Los cuatro vocabularios guardan **slugs** (§4.2). Un valor con mayúsculas o
   * espacios no resuelve su etiqueta y, en los tres que son eje de filtro
   * (`tipo-lugar`, `barrio`, `incluye-lugar`), además no matchea ningún chip: la
   * ficha quedaría fuera de su propio filtro.
   */
  const slugMal = (valor: string) => valor && !new RegExp(RE_TAXONOMIA_LUGAR).test(valor);
  if (!v.tipo) falta(['tipo'], 'Elegí qué es el lugar');
  else if (slugMal(v.tipo)) falta(['tipo'], 'Elegí una opción de la lista');
  if (slugMal(v.barrio)) falta(['barrio'], 'Elegí una opción de la lista');
  /*
   * **La condición es obligatoria y el precio no** — § 5 del PRD. «No sé si
   * todos cobran, o le dicen que tienen que consumir»: lo que siempre se puede
   * decir es *qué tipo de arreglo es*, y por eso el campo que no puede faltar es
   * éste y no el número.
   */
  if (!v.condicion) falta(['condicion'], 'Elegí cómo se usa el lugar');
  else if (slugMal(v.condicion)) falta(['condicion'], 'Elegí una opción de la lista');
  if (v.incluye.some(slugMal)) falta(['incluye'], 'Elegí las opciones de la lista');

  /*
   * El tope de la lista. No es regla de producto: la regla de Firestore **no
   * puede iterar una lista** (B-842), así que lo único que puede acotar del otro
   * lado es la cantidad, y los dos lados tienen que decir el mismo número.
   */
  if (v.incluye.length > MAX_INCLUYE_LUGAR) {
    falta(['incluye'], `Hasta ${MAX_INCLUYE_LUGAR} cosas`);
  }

  /*
   * ── § 6 — la dirección de una casa ──────────────────────────────────────
   *
   * **Acá el schema NO dice nada, y eso es una decisión.** La primera versión
   * emitía un error cuando un tipo de `TIPOS_SIN_DIRECCION_PUBLICA` llegaba con
   * la casilla prendida, y el `auditor-privacidad` mostró que eso **bloqueaba el
   * único camino legítimo**: un admin que sí pidió permiso a quien vive ahí no
   * podía guardar, mientras cuatro docblocks, la ayuda del panel y un caso de
   * integración decían que podía.
   *
   * El reparto que quedó: el **formulario** apaga la casilla al elegir el tipo y
   * avisa a la vista si alguien la vuelve a prender (`LugarFormulario.tsx`), la
   * **regla** impide que el camino público la prenda, y la **proyección** no
   * publica nada si el flag está apagado. Tres capas, ninguna de ellas un
   * bloqueo al admin.
   */
  /*
   * La dirección, si está, tiene que ser una dirección y no un `-` cargado para
   * poder guardar. Y **si se va a publicar, tiene que estar**: publicar un campo
   * vacío no es publicar nada, pero deja la ficha diciendo que da la dirección
   * cuando no la da.
   */
  if (v.direccion && v.direccion.length < MIN_DIRECCION_LUGAR) {
    falta(['direccion'], '¿Dónde queda?');
  }
  if (v.direccionPublica && !v.direccion.trim()) {
    falta(['direccion'], 'Si la dirección se publica, cargala; si no, destildá la casilla');
  }

  /*
   * `geo` — los dos o ninguno, y dentro del rango. Mismo criterio que
   * `sedeSchema` y que la geo de una librería: una latitud de 200 no existe, y
   * un lat/lng invertido manda la ficha al otro lado del mundo.
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

  /* La capacidad: un entero en rango, o nada. «No lo sé» es una respuesta (§ 9). */
  if (v.capacidad) {
    const n = Number(v.capacidad);
    if (!Number.isInteger(n) || n < MIN_CAPACIDAD_LUGAR || n > MAX_CAPACIDAD_LUGAR) {
      falta(
        ['capacidad'],
        `Poné un número entre ${MIN_CAPACIDAD_LUGAR} y ${MAX_CAPACIDAD_LUGAR}, o dejalo vacío`,
      );
    }
  }

  /*
   * ── El precio — § 5 del PRD, B-837 ──────────────────────────────────────
   *
   * Los dos campos o ninguno, con el mismo criterio que `geo` y que el precio de
   * una suscripción: un monto sin unidad no se puede escribir en la ficha
   * («$25.000» ¿por qué?), y una unidad sin monto no dice nada. La **fecha** no
   * se valida acá porque no se tipea: la pone el armado del documento.
   */
  const montoCrudo = v.precio.monto.trim();
  if (Boolean(montoCrudo) !== Boolean(v.precio.porUnidad)) {
    falta(
      ['precio', montoCrudo ? 'porUnidad' : 'monto'],
      'Cargá el precio y a qué unidad corresponde, o ninguno de los dos',
    );
  } else if (montoCrudo) {
    const monto = Number(montoCrudo);
    if (!Number.isInteger(monto) || monto < MIN_PRECIO_LUGAR || monto > MAX_PRECIO_LUGAR) {
      falta(['precio', 'monto'], 'Poné el precio en pesos, sin centavos y sin puntos');
    }
    if (!esUnidadDePrecio(v.precio.porUnidad)) {
      falta(['precio', 'porUnidad'], 'Elegí una opción de la lista');
    }
  }

  /*
   * Los tres destinos públicos que terminan en un `href` de una página
   * **indexada**. Se validan acá y no solo al pintarlos por lo mismo que en los
   * otros dos directorios: un dato roto que se guarda es un link roto en una
   * página indexada, y el saneador de la ficha lo único que puede hacer entonces
   * es **no** mostrarlo.
   */
  if (v.instagram && !handleInstagram(v.instagram)) {
    falta(['instagram'], 'Poné el usuario de Instagram, sin el @');
  }
  if (v.whatsapp) {
    const digitos = soloDigitos(v.whatsapp);
    if (digitos.length < MIN_WHATSAPP_LUGAR || digitos.length > TOPE_WHATSAPP_LUGAR) {
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
   * La galería, con las mismas dos reglas que en las otras tres entidades: el
   * techo de `MAXIMO_IMAGENES` y **exactamente una portada**. Cero imágenes es
   * válido; dos portadas no, porque entonces «cuál es la imagen» la contesta el
   * orden del array.
   */
  if (v.imagenes.length > MAXIMO_IMAGENES) {
    falta(['imagenes'], `Hasta ${MAXIMO_IMAGENES} imágenes por lugar`);
  }
  const portadas = v.imagenes.filter((i) => i.portada).length;
  if (v.imagenes.length > 0 && portadas !== 1) {
    falta(['imagenes'], 'Elegí una sola imagen como portada');
  }

  if (
    v.contactoDeQuienCargo.valor &&
    v.contactoDeQuienCargo.valor.length < MIN_CONTACTO_LUGAR
  ) {
    falta(['contactoDeQuienCargo', 'valor'], 'Quedó muy corto');
  }
});

/**
 * El formulario **público** de `/guia/lugares/sumar`: el mismo, con una regla
 * más.
 *
 * Quien carga desde afuera **no vuelve a entrar** (`prd/README.md` § 7), así que
 * si la ficha llega incompleta o dudosa no hay forma de repreguntar y la única
 * salida es descartarla. Y acá esa repregunta importa más que en los otros dos
 * directorios: es por dónde se pide el permiso del § 6 —«que una sede figure en
 * una actividad no autoriza a publicarla como lugar que se alquila» (§ 10)—.
 */
export const lugarPublicoFormSchema = lugarFormSchema.superRefine((v, ctx) => {
  if (!v.contactoDeQuienCargo.valor.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactoDeQuienCargo', 'valor'],
      message: '¿Cómo te escribimos si hay que preguntarte algo?',
    });
  }
});

export type LugarFormValues = z.input<typeof lugarFormSchema>;

export const lugarVacio = (): LugarForm => ({
  nombre: '',
  slug: '',
  descripcion: '',
  imagenes: [],
  tipo: '',
  direccion: '',
  barrio: '',
  ciudad: CIUDAD_POR_DEFECTO,
  geo: { lat: '', lng: '' },
  /*
   * Arranca en `true` porque el tipo todavía no se eligió y la enorme mayoría de
   * los lugares son locales comerciales. **Lo que hace que la casa no dependa de
   * esto** es que el formulario la apaga en cuanto el tipo pasa a uno de
   * `TIPOS_SIN_DIRECCION_PUBLICA`, que el schema lo avisa, y que `formALugar` la
   * fuerza en `false` en el camino público. Tres capas, y la última es la regla.
   */
  direccionPublica: true,
  capacidad: '',
  capacidadNotas: '',
  incluye: [],
  incluyeOtro: '',
  condicion: '',
  precio: { monto: '', porUnidad: 'hora' },
  condicionNotas: '',
  instagram: '',
  whatsapp: '',
  mail: '',
  web: '',
  contactoDeQuienCargo: { via: 'mail', valor: '' },
});

/**
 * El precio del formulario, ya con su fecha — **la mitad de B-837 que el
 * formulario no puede escribir**.
 *
 * `cargadoEn` lo decide quien guarda y no quien tipea, por lo mismo que
 * `creadoEn`: un campo de fecha que se puede escribir es un campo de fecha que
 * se puede mentir, y esta fecha es justamente la que le dice a quien lee si le
 * puede creer al número (§ 5 del PRD).
 *
 * Sin monto no hay precio, y sin precio no hay fecha: devolver `{ valor: null }`
 * publicaría una fecha que no fecha nada.
 */
export const precioDelForm = (
  f: LugarForm,
  cargadoEn: TimestampLike,
): DatoConFecha<PrecioDeLugar> | null => {
  const monto = Number(f.precio.monto.trim());
  if (!f.precio.monto.trim() || !Number.isFinite(monto)) return null;
  if (!esUnidadDePrecio(f.precio.porUnidad)) return null;
  return { valor: { monto, porUnidad: f.precio.porUnidad }, cargadoEn };
};

/**
 * ¿El precio que se está guardando **es otro** que el que ya estaba?
 *
 * Es lo que decide si `cargadoEn` se refecha, y es la misma función que en
 * suscripciones: corregir un typo de la descripción **no puede** mover la fecha
 * del precio —sería publicar que el número es más fresco de lo que es— y cambiar
 * el número **sí** tiene que moverla.
 *
 * Compara el valor y no el objeto entero, que es lo mismo que hace la guarda
 * anti-loop del §7.1: se deriva lo relevante y se compara eso.
 */
export const precioCambio = (
  previo: DatoConFecha<PrecioDeLugar> | null | undefined,
  nuevo: DatoConFecha<PrecioDeLugar> | null,
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
 * ── Las dos cosas propias de esta función, y las dos son del § 6 ──────────
 *
 * 1. **`direccionPublica` se fuerza en `false` en el camino público** cuando el
 *    tipo es uno de `TIPOS_SIN_DIRECCION_PUBLICA`. Es el criterio 3 del PRD:
 *    «ese default no lo puede cambiar el formulario público». Desde el panel un
 *    admin **sí** puede prenderla —puede haber pedido permiso— y el schema se lo
 *    hace decir a propósito.
 *
 *    Fijate que la dirección **no se vacía**: se guarda igual. Es la forma de
 *    `online.url` con `urlPublica` (D-15) y no la de `envio` con `manda`
 *    (B-832), y la diferencia es de para qué sirve el dato: la dirección de un
 *    lugar es lo que el admin necesita para poder contestar «¿dónde queda?», y
 *    una temática de algo que ya no manda libros no le sirve a nadie. Lo que la
 *    protege es que la proyección no la publica.
 *
 * 2. ⚠️ **La dirección NO entra al `searchText`, y eso es la mitad más fácil de
 *    olvidar de todo este archivo.** El `searchText` **se publica** —viaja en
 *    `/lugares.json` para que el listado filtre en memoria (§2.5)— así que
 *    meterla ahí publicaría la dirección por una puerta lateral que ninguna
 *    casilla gatea. Y peor: se deriva **al escribir**, así que quedaría
 *    publicada aunque después alguien apague el flag. `librerias.ts` sí la mete,
 *    y ahí es correcto: la dirección de un local comercial es pública por
 *    definición y no tiene flag. Acá no. `tests/lugares.test.ts` lo fija con la
 *    mutación probada.
 */
export const formALugar = (
  f: LugarForm,
  cargadoEn: TimestampLike,
  origen: Lugar['origen'] = 'formulario-publico',
): Omit<Lugar, 'creadoEn'> => {
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
  const tipo = f.tipo.trim();
  const barrio = f.barrio.trim();
  const ciudad = f.ciudad.trim() || CIUDAD_POR_DEFECTO;
  const capacidad = f.capacidad.trim() ? Number(f.capacidad) : null;

  return {
    nombre,
    slug: slugDeLugar(f),
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
    tipo,
    direccion: oNull(f.direccion),
    barrio,
    ciudad,
    geo: hayGeo ? { lat, lng } : null,
    /*
     * § 6, criterio 3 — **del formulario público la dirección nunca nace
     * publicada**, sea cual sea el tipo de lugar. La prende un admin al revisar
     * la ficha, que es el momento en que alguien mira.
     *
     * No mira el tipo a propósito: `tipo-lugar` es un vocabulario **abierto**
     * (acepta «Otro»), así que una lista de tipos acá sería una lista negra que
     * `ph` o `mi-living` esquivan. El tipo decide el **default del panel**, que es
     * otra cosa. Lo encontró el `auditor-privacidad`.
     */
    direccionPublica: f.direccionPublica && origen === 'panel',
    capacidad:
      capacidad !== null && Number.isFinite(capacidad) ? Math.trunc(capacidad) : null,
    capacidadNotas: oNull(f.capacidadNotas),
    incluye: f.incluye.map((s) => s.trim()).filter(Boolean),
    incluyeOtro: oNull(f.incluyeOtro),
    condicion: f.condicion.trim(),
    precio: precioDelForm(f, cargadoEn),
    condicionNotas: oNull(f.condicionNotas),
    instagram: handleInstagram(f.instagram),
    whatsapp: digitos ? digitos : null,
    mail: oNull(f.mail),
    web: urlSegura(f.web),
    contactoDeQuienCargo: f.contactoDeQuienCargo.valor.trim()
      ? { via: f.contactoDeQuienCargo.via, valor: f.contactoDeQuienCargo.valor.trim() }
      : null,
    estado: ESTADO_INICIAL,
    origen,
    /*
     * §6 — el índice de búsqueda, normalizado al escribir para que «Crónica»
     * matchee «cronica».
     *
     * **La derivación es la de `lib/lugarPublico.ts`, importada**: la proyección
     * pública **no copia** este campo, lo vuelve a derivar de lo que publica, así
     * que si acá se armara distinto el buscador del panel y el del sitio dirían
     * cosas distintas. Una sola función, dos llamadores.
     *
     * ⚠️ Sin `direccion` y sin el precio: ver el docblock de `searchTextDeLugar`.
     */
    searchText: searchTextDeLugar({
      nombre,
      descripcion: descripcion ?? '',
      barrio,
      ciudad,
      capacidadNotas: f.capacidadNotas,
      condicionNotas: f.condicionNotas,
      incluyeOtro: f.incluyeOtro,
    }),
    revision: { porUid: null, en: null, motivo: null },
  };
};
