/**
 * **La capa de datos de `/suscripciones`, del lado del panel** — B-832, tajada 3.
 *
 * ⚠️ **Este módulo toca Firestore, así que NO puede llegar a una página
 * pública.** Es el mismo corte que separa `actividades.ts` de `toPublic.ts` y
 * `librerias.ts` de `libreriaPublica.ts`, y lo verifica
 * `tests/bundle-panel.test.ts`: lo que el sitio necesita de una suscripción está
 * en `lib/suscripcionPublica.ts`, que es puro.
 *
 * ── Qué vive acá y qué no ────────────────────────────────────────────────
 * | Pieza | Dónde |
 * |---|---|
 * | los estados, las transiciones, el congelado del slug | `lib/directorios.ts` (B-834) |
 * | los campos, los topes | `types/suscripcion-literaria.ts` |
 * | la validación y el armado del documento | `lib/suscripcion-literaria-schema.ts` |
 * | la proyección pública | `lib/suscripcionPublica.ts` |
 * | **leer y escribir** | acá |
 *
 * ── Las dos escrituras, y por qué son dos ────────────────────────────────
 * `guardarSuscripcion` escribe **contenido** y `moverSuscripcion` escribe
 * **estado**, igual que en librerías y por lo mismo: mover el estado exige firmar
 * la revisión con el uid propio y `request.time`, y una corrección de un typo
 * **no** tiene que refirmarla.
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import {
  formASuscripcion,
  precioCambio,
  precioDelForm,
} from '@/lib/suscripcion-literaria-schema';
import { PERIODICIDAD_POR_DEFECTO } from '@/types/suscripcion-literaria';
import type { EstadoDirectorio } from '@/lib/directorios';
import type { TimestampLike } from '@/types/actividad';
import type {
  SuscripcionLiteraria,
  SuscripcionLiterariaConId,
  SuscripcionLiterariaForm,
} from '@/types/suscripcion-literaria';

const COL = 'suscripciones';

/**
 * Cuántas trae la bandeja.
 *
 * Mismo número y mismo motivo que `LIMITE_LIBRERIAS`: es un tope de seguridad
 * para que una colección que crece no baje entera en cada apertura del panel. Con
 * quince suscripciones (el orden de magnitud del § 10 del PRD) no se alcanza ni
 * de lejos.
 */
export const LIMITE_SUSCRIPCIONES = 200;

/**
 * El sentinel del servidor, tipado como el `Timestamp` que va a quedar guardado.
 *
 * `serverTimestamp()` devuelve un `FieldValue` que Firestore reemplaza al
 * escribir, y el documento **resultante** tiene un `Timestamp`. El cast es esa
 * verdad dicha una vez: sin él, cada llamada tendría el suyo, que es la forma de
 * que uno se escriba distinto.
 *
 * Va acá y no en el módulo puro a propósito: `suscripcion-literaria-schema.ts` no
 * importa `firebase/firestore` —es lo que lo deja testeable sin emuladores y
 * fuera del bundle público— así que la fecha **entra como parámetro**, que es lo
 * que el § «El reloj también es infraestructura» de `05-patrones.md` pide.
 */
const ahoraDelServidor = (): TimestampLike => serverTimestamp() as unknown as TimestampLike;

/**
 * Escucha el directorio entero.
 *
 * `onSnapshot` y no una lectura suelta, por lo mismo que la bandeja de
 * propuestas: con dos admins mirando, la que uno acaba de publicar tiene que
 * dejar de estar pendiente en la pantalla del otro sin que nadie recargue.
 */
export const observarSuscripciones = (
  cb: (ss: SuscripcionLiterariaConId[]) => void,
  onError: (e: Error) => void,
  cuantas = LIMITE_SUSCRIPCIONES,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('creadoEn', 'desc'), limit(cuantas)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as SuscripcionLiteraria), id: d.id }))),
    onError,
  );

/**
 * ¿Esta dirección web está libre? — trampa 10.
 *
 * Misma guarda **de aviso** que en librerías, con el mismo alcance escrito: no
 * hay reserva atómica en `/slugs` para esta colección, así que dos altas
 * simultáneas con el mismo nombre pasarían las dos. El daño es acotado y visible
 * —dos fichas en `pendiente`, y nada sale al sitio sin que un admin lo publique—
 * y se corrige en la bandeja, que es justo el momento en que el slug todavía se
 * puede tocar.
 */
export const slugDeSuscripcionDisponible = async (
  slug: string,
  idActual?: string,
): Promise<boolean> => {
  if (!slug) return false;
  const snap = await getDocs(query(collection(db(), COL), where('slug', '==', slug), limit(2)));
  return snap.docs.every((d) => d.id === idActual);
};

/**
 * Documento → formulario. La inversa de `formASuscripcion`.
 *
 * `null` → `''` en todo lo opcional, por lo mismo que allá. Dos cosas que se ven
 * raras y son a propósito:
 *
 * - **`precio.cargadoEn` no vuelve al formulario.** No se tipea, así que no tiene
 *   campo; quien guarda decide si se refecha (ver `guardarSuscripcion`). Es la
 *   mitad de DEC-12 que no se le puede delegar a la pantalla.
 * - **`envio.sorpresa` vuelve como `'si'` / `'no'` / `''`**, que son los tres
 *   estados del `<select>`: `null` en el documento es «no lo dice», y convertirlo
 *   a `false` haría que abrir una ficha para corregir un typo publicara «se sabe
 *   qué libro llega» de algo que nunca lo dijo.
 *
 * `contactoDeQuienCargo` vuelve **entero**, y tiene que volver: es contenido
 * editable y el admin necesita poder corregirlo. Que sea editable no lo hace
 * público — eso lo decide `suscripcionPublica.ts`, que no lo proyecta.
 */
export const suscripcionAFormulario = (
  s: SuscripcionLiteraria,
): SuscripcionLiterariaForm => ({
  nombre: s.nombre,
  slug: s.slug,
  descripcion: s.descripcion ?? '',
  imagenes: s.imagenes ?? [],
  ofrecidaPor: {
    nombre: s.ofrecidaPor?.nombre ?? '',
    tipo: s.ofrecidaPor?.tipo ?? '',
    instagram: s.ofrecidaPor?.instagram ?? '',
    libreriaSlug: s.ofrecidaPor?.libreriaSlug ?? '',
  },
  periodicidad: s.periodicidad || PERIODICIDAD_POR_DEFECTO,
  compromisoMinimo: s.compromisoMinimo ?? '',
  incluye: s.incluye ?? [],
  incluyeOtro: s.incluyeOtro ?? '',
  envio: {
    manda: s.envio?.manda ?? false,
    cuantos: s.envio?.cuantos == null ? '' : String(s.envio.cuantos),
    tematica: s.envio?.tematica ?? '',
    editoriales: s.envio?.editoriales ?? '',
    sorpresa: s.envio?.sorpresa == null ? '' : s.envio.sorpresa ? 'si' : 'no',
  },
  extras: s.extras ?? [],
  extrasOtro: s.extrasOtro ?? '',
  precio: {
    monto: s.precio ? String(s.precio.valor.monto) : '',
    porPeriodo: s.precio?.valor.porPeriodo || s.periodicidad || PERIODICIDAD_POR_DEFECTO,
  },
  alcance: s.alcance ?? [],
  linkDeSuscripcion: s.linkDeSuscripcion ?? '',
  instagram: s.instagram ?? '',
  whatsapp: s.whatsapp ?? '',
  mail: s.mail ?? '',
  contactoDeQuienCargo: s.contactoDeQuienCargo ?? { via: 'mail', valor: '' },
});

/**
 * Alta desde el panel, que es **la tercera puerta del § 1 del PRD** y no un
 * andamio: el dueño carga una suscripción a mano.
 *
 * `origen: 'panel'` porque lo escribe un admin, y la regla lo exige coherente con
 * quién escribe. `creadoEn: serverTimestamp()` porque la regla pide
 * `request.time`. Y el precio nace con **esa misma hora**: una ficha recién
 * cargada tiene el precio recién cargado, y la regla lo exige igual
 * (`d.precio.cargadoEn == request.time`).
 */
export const crearSuscripcion = async (f: SuscripcionLiterariaForm): Promise<string> => {
  const ref = doc(collection(db(), COL));
  await setDoc(ref, {
    ...formASuscripcion(f, ahoraDelServidor(), 'panel'),
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Edición de **contenido**. No toca `estado`, `origen`, `creadoEn` ni `revision`.
 *
 * ── La fecha del precio: se mueve solo si el precio se movió — DEC-12 ────
 * Recibe la ficha **previa** justamente para poder contestar eso. Las dos mitades
 * importan y las dos son la misma decisión:
 *
 * - **corregir la descripción no refecha el precio**: si lo hiciera, la ficha
 *   publicaría que el número es más fresco de lo que es, que es exactamente la
 *   mentira que DEC-12 evita;
 * - **cambiar el número sí lo refecha**, y con `serverTimestamp()`, así que el
 *   reloj del navegador no puede antedatarlo.
 *
 * La regla lo hace cumplir (`suscripcionActualizable()`), que es la mitad que no
 * se puede saltear. Y el precio previo se manda **tal como vino del snapshot**,
 * no reconstruido: un `Timestamp` rearmado con un milisegundo de diferencia haría
 * rebotar la escritura entera.
 */
export const guardarSuscripcion = async (
  id: string,
  f: SuscripcionLiterariaForm,
  previa: SuscripcionLiteraria,
): Promise<void> => {
  const nuevo = precioDelForm(f, ahoraDelServidor());
  const cambio = precioCambio(previa.precio, nuevo);
  const cargadoEn =
    cambio || !previa.precio ? ahoraDelServidor() : previa.precio.cargadoEn;

  const { estado, origen, revision, ...contenido } = formASuscripcion(f, cargadoEn, 'panel');
  void estado;
  void origen;
  void revision;
  await updateDoc(doc(db(), COL, id), contenido);
};

/**
 * Mueve el estado y **firma la revisión**.
 *
 * `serverTimestamp()` y no la hora del navegador: la regla exige
 * `revision.en == request.time`. El grafo —qué movimiento es legal— lo decide
 * `TRANSICIONES` (`lib/directorios.ts`) y lo hace cumplir la regla; acá solo se
 * escribe.
 */
export const moverSuscripcion = async (
  id: string,
  uid: string,
  estado: EstadoDirectorio,
  motivo: string | null = null,
): Promise<void> => {
  await updateDoc(doc(db(), COL, id), {
    estado,
    revision: { porUid: uid, en: serverTimestamp(), motivo },
  });
};
