/**
 * Autoguardado del formulario en el navegador (B-191).
 *
 * El pedido, de un reporte desde el panel: «Se podrá guardar algo como borrador
 * o auto guardado, como en word? Porque reporté algo y todo lo que escribí se
 * borró». El accidente concreto ya estaba cerrado —B-35 avisa antes de descartar
 * el formulario—, pero un aviso evita el accidente y no recupera el trabajo.
 *
 * **No toca Firestore.** Es la decisión que hace que esto sea chico: no hay
 * reglas nuevas, ni modelo, ni calendario, ni una escritura por tecla que cueste
 * plata. Lo guardado vive en el navegador de quien está cargando y no sale nunca
 * de ahí.
 *
 * **Lo guardado es contenido**, a diferencia de todo lo demás que el panel
 * persiste (qué novedad se leyó, qué acordeón se abrió). Por eso no puede
 * filtrarse a la analítica, que solo acepta enums y contadores (§9): este módulo
 * no importa nada de `analytics` y `tests/autoguardado.test.ts` lo verifica.
 *
 * **Recuperar en silencio es peor que no recuperar.** Si al abrir una actividad
 * aparece texto que no está en Firestore sin decir de dónde salió, la próxima
 * duda es "¿esto lo guardé o no?". Por eso lo que se lee de acá se **ofrece**:
 * el aviso dice cuándo se guardó y se puede descartar.
 *
 * Todo lo de acá es puro y recibe el almacén como puerto: `localStorage` tira en
 * modo privado y cuando la cuota está llena, y un formulario no puede romperse
 * porque no se pudo autoguardar.
 */
import {
  borrarBorradorLocal,
  PREFIJO_CLAVE,
  type AlmacenLocal,
} from '@/lib/formulario/borradoresDelNavegador';
import {
  formVacio,
  geoVacia,
  onlineVacio,
  personaVacia,
  sedeVacia,
} from '@/lib/formulario/estadoInicial';
import { huellaCreador } from '@/lib/huella';
import { fechaHoraCorta } from '@/lib/sesiones';
import type { ActividadForm } from '@/types/actividad';

/**
 * Versión del formato guardado. **Se sube cuando el formulario cambia de forma**
 * (un campo nuevo obligatorio, un renombre): un borrador viejo aplicado sobre un
 * formulario nuevo es peor que no tener borrador, porque parece bueno.
 *
 * Era una convención sin nada que la verificara, que es la clase de B-88: el
 * productor de un formato y su consumidor derivando por separado. Ahora
 * `tests/autoguardado.test.ts` fija la lista de claves del formulario al lado de
 * este número, así que agregar un campo falla hasta que alguien decida si el
 * borrador viejo sigue sirviendo.
 */
export const VERSION_BORRADOR = 1;

/**
 * La clave, el almacén y el borrado viven en `borradoresDelNavegador.ts` y se
 * re-exportan desde acá. La separación es por el corte del bundle: `AdminApp`
 * necesita borrar al cerrar sesión sin arrastrar el molde del formulario a la
 * carga inicial del panel. El detalle está en ese archivo.
 */
export {
  almacenDelNavegador,
  borrarBorradorLocal,
  borrarTodosLosBorradores,
  PREFIJO_CLAVE,
  type AlmacenLocal,
} from '@/lib/formulario/borradoresDelNavegador';

/**
 * A los cuántos días se descarta un borrador sin recuperar.
 *
 * Un mes es tiempo de sobra para volver a una carga interrumpida, y evita que
 * dentro de un año aparezca un aviso ofreciendo el taller del año pasado.
 */
export const DIAS_QUE_VIVE = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Qué formulario es, cuando todavía no hay documento del cual tomar el id. */
export interface IdentidadBorrador {
  /** Quién está cargando. Va como huella, nunca el uid en claro. */
  uid: string;
  /** El id del documento que se está editando, si se está editando uno. */
  idActividad?: string;
  /** ¿Es la copia de otra actividad (duplicar) y no una carga desde cero? */
  esCopia?: boolean;
}

/**
 * Clave del borrador. Es **por admin y por formulario**.
 *
 * Por actividad, para que el borrador de un taller no reaparezca dentro de otro.
 *
 * **Por admin**, porque el §5.1 marca como interno buena parte de lo que el
 * formulario contiene (`difusion`, `inscripcion.destino`, `online.url`) y con dos
 * cuentas en la misma máquina —la premisa de D-57— una clave sin dueño le ofrece
 * a B el borrador sin guardar de A. Va la huella de `lib/huella.ts` y no el uid:
 * lo único que hace falta es distinguir personas, y un pseudónimo opaco alcanza.
 *
 * **Y distingue la carga nueva de la copia.** Las dos nacen sin `idActividad`, así
 * que compartían la clave `nueva`; el comentario que lo justificaba —"las dos se
 * guardan creando un documento"— razona sobre la escritura y no sobre el
 * contenido. Con la clave compartida, un borrador de "nueva" interrumpido se
 * ofrecía dentro de un duplicado y, aceptado, publicaba una actividad distinta de
 * la que se quiso duplicar.
 */
export const claveBorrador = ({ uid, idActividad, esCopia }: IdentidadBorrador): string =>
  `${PREFIJO_CLAVE}${huellaCreador(uid)}:${idActividad ?? (esCopia ? 'copia' : 'nueva')}`;

export interface BorradorLocal {
  version: number;
  /** ISO-8601 del momento en que se guardó. */
  guardadoEn: string;
  form: ActividadForm;
}

/** ¿Tiene la forma de un formulario de actividad? Guarda contra un JSON ajeno. */
const pareceFormulario = (valor: unknown): valor is ActividadForm => {
  if (typeof valor !== 'object' || valor === null) return false;
  const f = valor as Partial<ActividadForm>;
  return typeof f.titulo === 'string' && Array.isArray(f.sesiones);
};

const esObjetoPlano = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * El molde contra el que se poda lo recuperado.
 *
 * `tallerista`, `online` y `sede.geo` nacen en `null` —los crean las cascadas de
 * tipo y modalidad, y el pegado de coordenadas—, así que el formulario vacío no
 * alcanza para conocer sus claves. **Salen de las mismas fábricas que las
 * cascadas, nunca escritas a mano acá:** la primera versión de este molde le puso
 * a `tallerista` la forma de `organizador` —que tiene `web` y no `bio`— y la poda
 * borraba `tallerista.bio` de todo borrador recuperado. Es la clase de B-88, con
 * el productor de la forma y el consumidor derivando por separado.
 */
const moldeDelFormulario = (): Record<string, unknown> => ({
  ...formVacio(),
  tallerista: personaVacia(),
  online: onlineVacio(),
  sede: { ...sedeVacia(), geo: geoVacia() },
});

/**
 * Lo recuperado, con **solo las claves que el formulario conoce**.
 *
 * `pareceFormulario` mira dos campos de ~30, y lo que pasa esa guarda entra al
 * estado del formulario y de ahí a `formADocumento`, que copia `sede`, `online`,
 * `organizador`, `tallerista` y `tags` tal cual — y `toPublic` proyecta los tres
 * primeros **enteros**. O sea: una clave de más en el borrador termina en
 * `events.json`. No filtra nada hoy porque nadie escribe esa clave; entra por la
 * regla de "publica solo el campo que se agregue mañana" (§5.2).
 *
 * Poda en profundidad los objetos y **deja pasar los arrays**: `sesiones` y
 * `material.items` no necesitan poda porque sus dos proyecciones públicas
 * (`sesionPublica`, `itemPublico`) enumeran campo por campo, así que una clave de
 * más no llega a ninguna salida.
 */
const podarConMolde = (molde: unknown, valor: unknown): unknown => {
  if (!esObjetoPlano(molde) || !esObjetoPlano(valor)) return valor;
  const podado: Record<string, unknown> = {};
  for (const clave of Object.keys(molde)) {
    if (clave in valor) podado[clave] = podarConMolde(molde[clave], valor[clave]);
  }
  return podado;
};

/**
 * Lo recuperado, podado y con los campos que falten completados.
 *
 * **El molde da la forma; los defaults salen de `formVacio()`.** No son lo mismo:
 * el molde tiene `sede.geo` con la forma de una coordenada para poder podar
 * adentro, y usarlo como default metería un `{lat: 0, lng: 0}` —el golfo de
 * Guinea— en la sede de una actividad a la que le faltara el bloque.
 *
 * Completar hace falta porque la guarda de forma mira dos campos de ~30: un
 * borrador sin `material` la pasa, y el primer consumidor que haga
 * `f.material.items.some(...)` tira y se lleva puesta la isla del panel. Podar no
 * puede dejar el formulario incompleto.
 */
const conFormaConocida = (form: unknown): ActividadForm => {
  const podado = podarConMolde(moldeDelFormulario(), form) as Record<string, unknown>;
  const completo = mezclarProfundo(formVacio(), podado) as ActividadForm;
  return {
    ...completo,
    // Los dos bloques que las cascadas crean y destruyen: si el borrador no los
    // trae, la respuesta es `null` —que es valor legal y es lo que produce una
    // actividad virtual— y no el bloque vacío. Completarlos con la fábrica
    // fabricaría datos que nadie cargó, y `sedeVacia()` trae `ciudad: 'CABA'`,
    // que `toPublic` proyecta dentro de `sede` y saldría a `events.json`. Es el
    // mismo argumento del `{lat: 0, lng: 0}`, una capa más arriba.
    sede: 'sede' in podado ? (completo.sede ?? null) : null,
    tallerista: 'tallerista' in podado ? (completo.tallerista ?? null) : null,
  };
};

/**
 * Completa `valor` con lo que le falte de `defecto`, en profundidad.
 *
 * De primer nivel no alcanza: un borrador con `material: {tiene: true}` y sin
 * `items` conserva la clave incompleta, y el primer consumidor que haga
 * `f.material.items.some(...)` tira en el render y se lleva puesta la isla del
 * panel. Los arrays se toman enteros del valor: mezclarlos elemento por elemento
 * inventaría filas.
 */
const mezclarProfundo = (defecto: unknown, valor: unknown): unknown => {
  if (!esObjetoPlano(defecto) || !esObjetoPlano(valor)) return valor === undefined ? defecto : valor;
  const salida: Record<string, unknown> = { ...defecto };
  for (const clave of Object.keys(valor)) {
    salida[clave] = mezclarProfundo(defecto[clave], valor[clave]);
  }
  return salida;
};

/**
 * Los flags de publicación del borrador recuperado vuelven a su default privado.
 *
 * **Es la segunda mitad de la guarda de B-80**, y por el mismo motivo: el
 * autoguardado institucionaliza formularios de hasta 30 días, así que un valor de
 * hace tres semanas se aplica sobre el documento de hoy. `calendarEventId` no es
 * el único campo donde eso tiene consecuencias: `online.urlPublica` y
 * `material.items[].publico` son los dos que deciden si el link de la reunión y
 * las URLs del material salen a `events.json` y a la descripción del evento
 * (trampa 5). Se destilda una casilla, no se guarda, se recupera el borrador a los
 * veinte días, se publica — y el link sale.
 *
 * Vuelven a `false`, que es el default que `toPublic` ya declara: publicar un link
 * es una acción deliberada por actividad, no el comportamiento por omisión. Y no
 * pierde trabajo, porque la asimetría es total: destildado se vuelve a tildar,
 * publicado no se despublica de donde ya lo copiaron.
 *
 * El agravante que lo hacía silencioso: `SeccionMaterial` decide si abre según
 * `form.material.tiene` y `Seccion` lee eso **solo al montar**, así que un flag
 * que llega con el borrador —después del montaje— quedaba en una sección cerrada,
 * sin estar en ninguna parte de la pantalla. Por eso además lo dice el aviso.
 */
/**
 * ¿Lo guardado tenía algún flag de publicación tildado?
 *
 * Solo para que el aviso lo diga cuando hay algo que decir: avisar siempre que
 * "los links quedan sin publicar" en una actividad que no tiene ni reunión ni
 * material es ruido, y el ruido se aprende a ignorar.
 */
export const teniaFlagsDePublicacion = (f: ActividadForm): boolean =>
  Boolean(f.online?.urlPublica) || f.material.items.some((i) => i.publico);

export const sinFlagsDePublicacion = (f: ActividadForm): ActividadForm => ({
  ...f,
  online: f.online ? { ...f.online, urlPublica: false } : f.online,
  material: {
    ...f.material,
    items: f.material.items.map((i) => ({ ...i, publico: false })),
  },
});

/**
 * Guarda el borrador. Devuelve si pudo.
 *
 * Nunca tira: un `localStorage` lleno o deshabilitado no puede cortar el tecleo.
 */
export const guardarBorradorLocal = (
  almacen: AlmacenLocal | null,
  clave: string,
  form: ActividadForm,
  ahora: Date = new Date(),
): boolean => {
  if (!almacen) return false;
  const borrador: BorradorLocal = {
    version: VERSION_BORRADOR,
    guardadoEn: ahora.toISOString(),
    form,
  };
  try {
    almacen.setItem(clave, JSON.stringify(borrador));
    return true;
  } catch {
    return false;
  }
};

/**
 * Lee el borrador guardado, o `null` si no hay uno usable.
 *
 * Un borrador ilegible, de otra versión del formulario o vencido **se borra** en
 * el mismo paso: dejarlo ahí lo haría reaparecer en cada apertura sin que nadie
 * pueda hacer nada con él.
 */
export const leerBorradorLocal = (
  almacen: AlmacenLocal | null,
  clave: string,
  ahora: Date = new Date(),
): BorradorLocal | null => {
  if (!almacen) return null;
  let crudo: string | null = null;
  try {
    crudo = almacen.getItem(clave);
  } catch {
    return null;
  }
  if (!crudo) return null;

  const descartar = () => {
    borrarBorradorLocal(almacen, clave);
    return null;
  };

  let dato: unknown;
  try {
    dato = JSON.parse(crudo);
  } catch {
    return descartar();
  }
  if (typeof dato !== 'object' || dato === null) return descartar();

  const { version, guardadoEn, form } = dato as Partial<BorradorLocal>;
  if (version !== VERSION_BORRADOR) return descartar();
  if (typeof guardadoEn !== 'string') return descartar();
  if (!pareceFormulario(form)) return descartar();

  const cuando = new Date(guardadoEn);
  if (Number.isNaN(cuando.getTime())) return descartar();
  if (ahora.getTime() - cuando.getTime() > DIAS_QUE_VIVE * MS_POR_DIA) return descartar();

  return { version, guardadoEn, form: conFormaConocida(form) };
};


/** «12/8/26, 14:32», para que el aviso diga de cuándo es lo que ofrece. */
export const cuandoSeGuardo = (borrador: BorradorLocal): string =>
  fechaHoraCorta(new Date(borrador.guardadoEn));

/**
 * ¿Vale la pena ofrecer este borrador?
 *
 * Si lo guardado es igual a lo que el formulario ya muestra, ofrecerlo es ruido:
 * el aviso diría "recuperá esto" señalando lo mismo que está en la pantalla.
 * Compara el JSON, igual que `useFormularioSucio`.
 */
export const vaLaPenaOfrecer = (borrador: BorradorLocal, actual: ActividadForm): boolean =>
  JSON.stringify(borrador.form) !== JSON.stringify(actual);

/**
 * El borrador recuperado, pero con los `calendarEventId` del documento de hoy.
 *
 * **Es la guarda de la familia de B-80**, y hace falta justamente porque el
 * autoguardado institucionaliza los formularios viejos: hasta 30 días. El
 * `calendarEventId` es el único campo del formulario que **escribe el backend**
 * —la Function lo devuelve al documento cuando crea el evento (§7.1)—, así que un
 * borrador guardado antes de ese write-back lo tiene en `null`. Aplicarlo tal
 * cual y guardar deja `null` en el documento; el sync de **ese** guardado todavía
 * usa el id del snapshot anterior (`previa?.calendarEventId ?? …`) y no se nota, y
 * la edición siguiente ve una sesión conocida sin evento y **crea un segundo
 * evento para el mismo encuentro**. Es el mismo mecanismo de B-80, con un día de
 * demora.
 *
 * El cruce es por `id` de sesión, que es estable y del cliente (trampa 2): a cada
 * fila recuperada se le devuelve el id de calendario que hoy tiene esa misma fila.
 * Una fila que no existe en el documento —agregada dentro del borrador— se queda
 * con el suyo, que es `null`.
 */
export const conIdsDeCalendarioDe = (
  recuperado: ActividadForm,
  actual: ActividadForm,
): ActividadForm => {
  const deHoy = new Map(actual.sesiones.map((s) => [s.id, s.calendarEventId ?? null]));
  return {
    ...recuperado,
    sesiones: recuperado.sesiones.map((s) =>
      deHoy.has(s.id) ? { ...s, calendarEventId: deHoy.get(s.id) ?? null } : s,
    ),
  };
};

/**
 * Lo que **no** se aplica desde un borrador: la publicación es de esta sesión.
 *
 * `duplicar.ts` ya había contestado esta pregunta para el otro lugar del panel
 * donde se aplica un formulario viejo, con una línea y un comentario: `estado:
 * 'borrador'`, «duplicar no publica». Recuperar un borrador es el mismo caso y
 * aplicaba `estado` crudo, así que un borrador de hace veinte días que decía
 * `publicado` **re-publicaba** una actividad retirada a propósito: vuelve a
 * `events.json` y la Function le recrea los N eventos. Es el §7.3 al revés, y
 * publicar es lo irreversible del §5.
 *
 * Los tres campos, y por qué cada uno:
 *
 * - **`estado`** — sale del documento de hoy, siempre. Publicar y despublicar se
 *   eligen mirando la pantalla, no se heredan de un borrador.
 * - **`slug`** — sale del documento de hoy **cuando está bloqueado**, o sea cuando
 *   la actividad ya está publicada (trampa 10). El input está protegido, pero el
 *   borrador pisaba el campo sin mirar ese flag: un borrador anterior a publicar
 *   tiene el slug todavía cascadeando del título, y recuperarlo cambiaba la URL de
 *   algo indexado. Si no está bloqueado, el del borrador es trabajo legítimo.
 * - **`sesiones[].cancelada`** — sale del documento de hoy, por fila y por id. Un
 *   `false` de hace tres semanas sobre un encuentro cancelado hoy le recrea el
 *   evento a todo el que esté suscripto. La contra asumida: si lo que se canceló
 *   fue *dentro* del borrador, hay que volver a tildarlo. Es una casilla contra un
 *   evento que reaparece en el calendario de otros.
 *
 * **Esta es la lista, y vive en un solo lugar a propósito.** Se quedó corta dos
 * veces —primero solo `calendarEventId`, después sin `estado`— porque estaba
 * repartida. El campo que se agregue mañana se pregunta acá.
 */
export const conLoQueEsDelDocumento = (
  recuperado: ActividadForm,
  actual: ActividadForm,
  slugBloqueado: boolean,
): ActividadForm => {
  const canceladaHoy = new Map(actual.sesiones.map((s) => [s.id, s.cancelada]));
  return {
    ...recuperado,
    estado: actual.estado,
    slug: slugBloqueado ? actual.slug : recuperado.slug,
    sesiones: recuperado.sesiones.map((s) =>
      canceladaHoy.has(s.id) ? { ...s, cancelada: canceladaHoy.get(s.id)! } : s,
    ),
  };
};
