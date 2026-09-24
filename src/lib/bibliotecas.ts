/**
 * **La capa de datos de `/bibliotecas`, del lado del panel** — B-960.
 *
 * ⚠️ **Este módulo toca Firestore, así que NO puede llegar a una página
 * pública.** Es el mismo corte que separa `actividades.ts` de `toPublic.ts`, y
 * lo verifica `tests/bundle-panel.test.ts`: lo que el sitio necesita de una
 * biblioteca está en `lib/bibliotecaPublica.ts`, que es puro. Un import de acá
 * desde un componente del sitio arrastra el SDK pesado a una página que hoy no
 * lo baja.
 *
 * ── Qué vive acá y qué no ────────────────────────────────────────────────
 * | Pieza | Dónde |
 * |---|---|
 * | los estados, las transiciones, el congelado del slug | `lib/directorios.ts` (B-834) — **compartido con los cuatro directorios** |
 * | los campos, los topes | `types/biblioteca.ts` |
 * | la validación y el armado del documento | `lib/biblioteca-schema.ts` |
 * | la proyección pública | `lib/bibliotecaPublica.ts` |
 * | **leer y escribir** | acá |
 *
 * O sea: acá no se decide nada. Se lee, se escribe, y lo que se escribe sale de
 * `formABiblioteca`.
 *
 * ── Las dos escrituras, y por qué son dos ────────────────────────────────
 * `guardarBiblioteca` escribe **contenido** y `moverBiblioteca` escribe
 * **estado**, y la regla las trata distinto: mover el estado exige firmar la
 * revisión con el uid propio y `request.time`, y una corrección de un typo **no**
 * tiene que refirmarla. Con una sola función habría que decidir en cada guardado
 * si firma, que es la clase de condición que termina firmando siempre.
 */
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  costoDeAsociarseCambio,
  costoDeAsociarseDelForm,
  formABiblioteca,
} from '@/lib/biblioteca-schema';
import { ESTADO_INICIAL, ESTADO_PUBLICO, type EstadoDirectorio, type IdDirectorio } from '@/lib/directorios';
import { db } from '@/lib/firestore-client';
import { asegurarSlugPublicable, slugDeGuiaDisponible } from '@/lib/slugDeGuia';
import { geografiaNormalizada } from '@/lib/geografia.mjs';
import { CIUDAD_POR_DEFECTO } from '@/types/biblioteca';
import type { Biblioteca, BibliotecaConId, BibliotecaForm } from '@/types/biblioteca';
import type { TimestampLike } from '@/types/actividad';

const COL = 'bibliotecas' satisfies IdDirectorio;

/**
 * Cuántas trae la bandeja.
 *
 * Mismo número y mismo motivo que `LIMITE_LIBRERIAS`: es un tope de seguridad
 * para que una colección que crece no baje entera en cada apertura del panel, no
 * una regla de producto.
 */
export const LIMITE_BIBLIOTECAS = 200;

/**
 * `serverTimestamp()` devuelve un `FieldValue` que Firestore reemplaza al
 * escribir. El tipo del modelo dice `TimestampLike` porque es lo que se **lee**;
 * en la escritura viaja el centinela. Mismo puente que en
 * `suscripcionesLiterarias.ts`.
 */
const ahoraDelServidor = (): TimestampLike => serverTimestamp() as unknown as TimestampLike;

/**
 * Escucha el directorio entero.
 *
 * `onSnapshot` y no una lectura suelta, por lo mismo que la bandeja de
 * propuestas: con dos admins mirando, la que uno acaba de publicar tiene que
 * dejar de estar pendiente en la pantalla del otro sin que nadie recargue.
 *
 * Ordenada por `creadoEn` descendente: lo último que llegó es lo que espera
 * decisión. Es un `orderBy` de un solo campo, así que no pide índice compuesto.
 */
export const observarBibliotecas = (
  cb: (bs: BibliotecaConId[]) => void,
  onError: (e: Error) => void,
  cuantas = LIMITE_BIBLIOTECAS,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('creadoEn', 'desc'), limit(cuantas)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Biblioteca), id: d.id }))),
    onError,
  );

/**
 * ¿Esta dirección web está libre? — la guarda **de aviso** del formulario.
 *
 * La implementación es una sola para los cuatro directorios
 * (`lib/slugDeGuia.ts`, B-909). La **garantía** no es ésta: es
 * `asegurarSlugPublicable`, que corre al publicar desde la bandeja.
 */
export const slugDeBibliotecaDisponible = (slug: string, idActual?: string): Promise<boolean> =>
  slugDeGuiaDisponible(COL, slug, idActual);

/**
 * Documento → formulario. La inversa de `formABiblioteca`.
 *
 * `null` → `''` en todo lo opcional, por lo mismo que allá: un `<input>` no
 * tiene `null`, y la ausencia tiene que representarse de una sola forma en cada
 * lado de la frontera. Los dos números de `geo` vuelven a texto con `String()` y
 * no con `toFixed`: recortar decimales acá cambiaría la coordenada guardada cada
 * vez que alguien abre la ficha para corregir un typo.
 *
 * - **`asociarse.costo.cargadoEn` no vuelve al formulario.** No se tipea, así
 *   que no tiene input; la decide `guardarBiblioteca` según si el valor cambió.
 * - **`contactoDeQuienCargo` vuelve entero**, y tiene que volver: es contenido
 *   editable (`contenidoEditable` de `lib/directorios.ts` lo devuelve a
 *   propósito) y el admin necesita poder corregirlo. Que sea editable no lo hace
 *   público — eso lo decide `bibliotecaPublica.ts`, que no lo proyecta.
 */
export const bibliotecaAFormulario = (b: Biblioteca): BibliotecaForm => ({
  nombre: b.nombre,
  slug: b.slug,
  descripcion: b.descripcion ?? '',
  imagenes: b.imagenes ?? [],
  tipo: b.tipo ?? '',
  direccion: b.direccion,
  // Defaults de lectura: las fichas anteriores a un campo no lo tienen.
  horarios: b.horarios ?? '',
  horarioDeSala: b.horarioDeSala ?? '',
  asociarse: {
    haceFalta: Boolean(b.asociarse?.haceFalta),
    costo: b.asociarse?.costo?.valor ?? '',
  },
  catalogo: b.catalogo ?? '',
  /*
   * El **default de lectura** de la geografía (D-26), el mismo que usa una
   * actividad: una ficha anterior guarda la ciudad como se tipeó y sin
   * provincia, y sin esto el desplegable de la cascada abriría con un valor que
   * no matchea ninguna opción.
   */
  ...geografiaNormalizada(b),
  ciudad: geografiaNormalizada(b).ciudad || CIUDAD_POR_DEFECTO,
  geo: b.geo ? { lat: String(b.geo.lat), lng: String(b.geo.lng) } : { lat: '', lng: '' },
  instagram: b.instagram ?? '',
  whatsapp: b.whatsapp ?? '',
  web: b.web ?? '',
  mail: b.mail ?? '',
  contactoDeQuienCargo: b.contactoDeQuienCargo ?? { via: 'mail', valor: '' },
});

/**
 * Alta desde el panel: el dueño carga una biblioteca a mano.
 *
 * `origen: 'panel'` porque lo escribe un admin, y la regla lo exige coherente
 * con quién escribe: un admin no puede hacer pasar su carga por una ficha que
 * llegó de afuera.
 *
 * `creadoEn: serverTimestamp()` porque la regla pide `request.time`: el reloj
 * del navegador no puede antedatar la ficha. Y el costo de asociarse nace con
 * **esa misma hora** —una ficha recién cargada tiene el costo recién cargado—,
 * que es lo que la regla exige igual.
 *
 * `setDoc` sobre una ref acuñada en el cliente y no `addDoc`: así el id se
 * conoce antes de la ida, que es lo que deja abrir el formulario de edición sin
 * releer.
 *
 * **`publicar` decide si nace publicada** (B-983): `false` la deja en
 * `pendiente`, que es lo que hace de borrador —los estados del directorio no
 * tienen `borrador`, así que es la única forma de guardar una ficha a medio
 * cargar sin que salga al sitio—. Lo que lo autoriza es `firestore.rules`, no
 * este parámetro.
 */
export const crearBiblioteca = async (f: BibliotecaForm, publicar = false): Promise<string> => {
  const ref = doc(collection(db(), COL));
  await setDoc(ref, {
    ...formABiblioteca(
      f,
      ahoraDelServidor(),
      'panel',
      publicar ? ESTADO_PUBLICO : ESTADO_INICIAL,
    ),
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Edición de **contenido**. No toca `estado`, `origen`, `creadoEn` ni
 * `revision`.
 *
 * Los cuatro los rechaza la regla si cambian, pero además no se mandan: mandar
 * un campo que la regla acepta solo si es idéntico al que ya está es pedirle al
 * cliente que reproduzca un valor del servidor, y ahí es donde se cuela un
 * `Timestamp` reconstruido con un milisegundo de diferencia.
 *
 * ── La fecha del costo: se mueve solo si el costo se movió — DEC-12 ──────
 * Recibe la ficha **previa** justamente para poder contestar eso. Las dos
 * mitades son la misma decisión:
 *
 * - **corregir la descripción no refecha el costo**: si lo hiciera, la ficha
 *   publicaría que el número es más fresco de lo que es, que es exactamente la
 *   mentira que DEC-12 evita;
 * - **cambiar el número sí lo refecha**, y con `serverTimestamp()`, así que el
 *   reloj del navegador no puede antedatarlo.
 *
 * El costo previo se manda **tal como vino del snapshot**, no reconstruido: un
 * `Timestamp` rearmado con un milisegundo de diferencia haría rebotar la
 * escritura entera.
 *
 * ⚠️ **El `slug` sí se manda**, y por eso el llamador tiene que saber si está
 * congelado: `slugBloqueado` (`lib/directorios.ts`) es lo que apaga el campo en
 * el formulario, y la regla es lo que lo impide de verdad. Las dos mitades, como
 * siempre.
 */
export const guardarBiblioteca = async (
  id: string,
  f: BibliotecaForm,
  previa: Biblioteca,
): Promise<void> => {
  const nuevo = costoDeAsociarseDelForm(f, ahoraDelServidor());
  const cambio = costoDeAsociarseCambio(previa.asociarse?.costo, nuevo);
  const cargadoEn =
    cambio || !previa.asociarse?.costo ? ahoraDelServidor() : previa.asociarse.costo.cargadoEn;

  const { estado, origen, revision, ...contenido } = formABiblioteca(f, cargadoEn, 'panel');
  void estado;
  void origen;
  void revision;
  await updateDoc(doc(db(), COL, id), contenido);
};

/**
 * **«Lo revisé hoy y sigue siendo éste»**, para el costo de asociarse — B-1410,
 * el mismo gesto que `confirmarPrecioDeSuscripcion` y `confirmarPrecioDeLugar`
 * (B-913), y por lo mismo: refecha el dato con el reloj del servidor sin tocar
 * el valor.
 *
 * **La puerta ya estaba abierta**: `bibliotecaActualizable()` acepta un
 * `asociarse.costo.cargadoEn == request.time` con cualquier valor, así que un
 * valor igual con la fecha de hoy pasa sin tocar `firestore.rules`.
 *
 * Las dos decisiones de las hermanas, con la ruta de esta colección:
 *
 * - **Una sola ruta, `asociarse.costo.cargadoEn`**: el valor que queda es el
 *   del documento al escribir, no el que la pantalla tenía en memoria, y no hay
 *   `Timestamp` previo que reenviar.
 * - **Sin costo no hay nada que confirmar**, y la guarda es acá: la ruta con
 *   punto sobre un `costo: null` crearía `{ cargadoEn }` sin `valor`, que la
 *   regla rechaza con un «permiso denegado» que no le dice nada a nadie.
 */
export const confirmarCostoDeBiblioteca = async (
  id: string,
  actual: Pick<Biblioteca, 'asociarse'>,
): Promise<void> => {
  if (!actual.asociarse?.costo) {
    throw new Error('Esta biblioteca no tiene cargado el costo de asociarse.');
  }
  await updateDoc(doc(db(), COL, id), { 'asociarse.costo.cargadoEn': serverTimestamp() });
};

/**
 * Mueve el estado y **firma la revisión**.
 *
 * `serverTimestamp()` y no la hora del navegador: la regla exige
 * `revision.en == request.time`, así que un reloj adelantado no puede firmar en
 * el futuro.
 *
 * El grafo —qué movimiento es legal— lo decide `TRANSICIONES`
 * (`lib/directorios.ts`) y lo hace cumplir la regla; acá solo se escribe.
 */
export const moverBiblioteca = async (
  id: string,
  uid: string,
  estado: EstadoDirectorio,
  motivo: string | null = null,
): Promise<void> => {
  // B-909 — publicar es el momento en que el slug pasa a ser una URL: acá se
  // verifica que no sea de otra ficha publicada (`lib/slugDeGuia.ts`).
  if (estado === ESTADO_PUBLICO) await asegurarSlugPublicable(COL, id);
  await updateDoc(doc(db(), COL, id), {
    estado,
    revision: { porUid: uid, en: serverTimestamp(), motivo },
  });
};
