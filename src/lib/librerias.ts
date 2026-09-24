/**
 * **La capa de datos de `/librerias`, del lado del panel** — B-831/B-901,
 * tajada 2 paso 14.
 *
 * ⚠️ **Este módulo toca Firestore, así que NO puede llegar a una página
 * pública.** Es el mismo corte que separa `actividades.ts` de `toPublic.ts`, y lo
 * verifica `tests/bundle-panel.test.ts`: lo que el sitio necesita de una librería
 * está en `lib/libreriaPublica.ts`, que es puro. Un import de acá desde un
 * componente del sitio arrastra el SDK pesado a una página que hoy no lo baja.
 *
 * ── Qué vive acá y qué no ────────────────────────────────────────────────
 * | Pieza | Dónde |
 * |---|---|
 * | los estados, las transiciones, el congelado del slug | `lib/directorios.ts` (B-834) — **compartido con los tres directorios** |
 * | los campos, los topes | `types/libreria.ts` |
 * | la validación y el armado del documento | `lib/libreria-schema.ts` |
 * | la proyección pública | `lib/libreriaPublica.ts` |
 * | **leer y escribir** | acá |
 *
 * O sea: acá no se decide nada. Se lee, se escribe, y lo que se escribe sale de
 * `formALibreria`.
 *
 * ── Las dos escrituras, y por qué son dos ────────────────────────────────
 * `guardarLibreria` escribe **contenido** y `moverLibreria` escribe **estado**, y
 * la regla las trata distinto: mover el estado exige firmar la revisión con el
 * uid propio y `request.time`, y una corrección de un typo **no** tiene que
 * refirmarla (`libreriaActualizable()` lo condiciona a que `revision` esté en el
 * diff). Con una sola función habría que decidir en cada guardado si firma, que
 * es la clase de condición que termina firmando siempre.
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
import { db } from '@/lib/firestore-client';
import { asegurarSlugPublicable, slugDeGuiaDisponible } from '@/lib/slugDeGuia';
import { formALibreria } from '@/lib/libreria-schema';
import { CIUDAD_POR_DEFECTO } from '@/types/libreria';
import { ESTADO_INICIAL, ESTADO_PUBLICO, type EstadoDirectorio, type IdDirectorio } from '@/lib/directorios';
import { geografiaNormalizada } from '@/lib/geografia.mjs';
import type { Libreria, LibreriaConId, LibreriaForm } from '@/types/libreria';

const COL = 'librerias' satisfies IdDirectorio;

/**
 * Cuántas trae la bandeja.
 *
 * Mismo número y mismo motivo que `LIMITE_PROPUESTAS`: es un tope de seguridad
 * para que una colección que crece no baje entera en cada apertura del panel, no
 * una regla de producto. Con 40 librerías (el orden de magnitud del § 10 del PRD)
 * no se alcanza.
 */
export const LIMITE_LIBRERIAS = 200;

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
export const observarLibrerias = (
  cb: (ls: LibreriaConId[]) => void,
  onError: (e: Error) => void,
  cuantas = LIMITE_LIBRERIAS,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('creadoEn', 'desc'), limit(cuantas)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Libreria), id: d.id }))),
    onError,
  );

/**
 * ¿Esta dirección web está libre? — la guarda **de aviso** del formulario.
 *
 * La implementación es una sola para los cuatro directorios
 * (`lib/slugDeGuia.ts`, B-909). La **garantía** no es ésta: es
 * `asegurarSlugPublicable`, que corre al publicar desde la bandeja.
 */
export const slugDeLibreriaDisponible = (slug: string, idActual?: string): Promise<boolean> =>
  slugDeGuiaDisponible(COL, slug, idActual);

/**
 * Documento → formulario. La inversa de `formALibreria`.
 *
 * `null` → `''` en todo lo opcional, por lo mismo que allá: un `<input>` no tiene
 * `null`, y la ausencia tiene que representarse de una sola forma en cada lado de
 * la frontera. Los dos números de `geo` vuelven a texto con `String()` y no con
 * `toFixed`: recortar decimales acá cambiaría la coordenada guardada cada vez que
 * alguien abre la ficha para corregir un typo.
 *
 * `contactoDeQuienCargo` vuelve al formulario **entero**, y tiene que volver: es
 * contenido editable (`contenidoEditable` de `lib/directorios.ts` lo devuelve a
 * propósito) y el admin necesita poder corregirlo. Que sea editable no lo hace
 * público — eso lo decide `libreriaPublica.ts`, que no lo proyecta.
 */
export const libreriaAFormulario = (l: Libreria): LibreriaForm => ({
  nombre: l.nombre,
  slug: l.slug,
  descripcion: l.descripcion ?? '',
  imagenes: l.imagenes ?? [],
  direccion: l.direccion,
  // B-982 — default de lectura: las fichas anteriores al campo no lo tienen.
  horarios: l.horarios ?? '',
  /*
   * B-967 — el **default de lectura** de la geografía (D-26), el mismo que usa
   * una actividad: una ficha anterior guarda la ciudad como se tipeó («Ciudad de
   * Buenos Aires») y sin provincia, y sin esto el desplegable de la cascada
   * abriría con un valor que no matchea ninguna opción.
   */
  ...geografiaNormalizada(l),
  ciudad: geografiaNormalizada(l).ciudad || CIUDAD_POR_DEFECTO,
  geo: l.geo ? { lat: String(l.geo.lat), lng: String(l.geo.lng) } : { lat: '', lng: '' },
  instagram: l.instagram ?? '',
  whatsapp: l.whatsapp ?? '',
  web: l.web ?? '',
  mail: l.mail ?? '',
  contactoDeQuienCargo: l.contactoDeQuienCargo ?? { via: 'mail', valor: '' },
});

/**
 * Alta desde el panel, que es **la tercera puerta del § 1 del PRD** y no un
 * andamio: el dueño carga una librería a mano.
 *
 * `origen: 'panel'` porque lo escribe un admin, y la regla lo exige coherente con
 * quién escribe (`libreriaValida()`): un admin no puede hacer pasar su carga por
 * una ficha que llegó de afuera.
 *
 * `creadoEn: serverTimestamp()` porque la regla pide `request.time`: el reloj del
 * navegador no puede antedatar la ficha. Y el `estado` sale de `formALibreria` con
 * el valor que la regla va a exigir igual — lo que lo fuerza de verdad es la
 * regla, no esto.
 *
 * `setDoc` sobre una ref acuñada en el cliente y no `addDoc`: así el id se conoce
 * antes de la ida, que es lo que deja abrir el formulario de edición sin releer.
 */
/**
 * **`publicar` decide si nace publicada** — B-983, los dos botones del panel.
 *
 * `false` (el default) la deja en `pendiente`, que es lo que hace de borrador:
 * los estados del directorio no tienen `borrador`, así que es la única forma de
 * guardar una ficha a medio cargar sin que salga al sitio.
 *
 * Lo que lo autoriza es `firestore.rules` —exige `origen == 'panel' &&
 * esAdmin()` para aceptar `publicado`—, no este parámetro.
 */
export const crearLibreria = async (f: LibreriaForm, publicar = false): Promise<string> => {
  const ref = doc(collection(db(), COL));
  await setDoc(ref, { ...formALibreria(f, 'panel', publicar ? ESTADO_PUBLICO : ESTADO_INICIAL), creadoEn: serverTimestamp() });
  return ref.id;
};

/**
 * Edición de **contenido**. No toca `estado`, `origen`, `creadoEn` ni `revision`.
 *
 * Los cuatro los rechaza la regla si cambian, pero además no se mandan: mandar un
 * campo que la regla acepta solo si es idéntico al que ya está es pedirle al
 * cliente que reproduzca un valor del servidor, y ahí es donde se cuela un
 * `Timestamp` reconstruido con un milisegundo de diferencia.
 *
 * ⚠️ **El `slug` sí se manda**, y por eso el llamador tiene que saber si está
 * congelado: `slugBloqueado` (`lib/directorios.ts`) es lo que apaga el campo en
 * el formulario, y `slugDeLibreriaCongelado` en `firestore.rules` es lo que lo
 * impide de verdad. Las dos mitades, como siempre.
 */
export const guardarLibreria = async (id: string, f: LibreriaForm): Promise<void> => {
  const { estado, origen, revision, ...contenido } = formALibreria(f, 'panel');
  void estado;
  void origen;
  void revision;
  await updateDoc(doc(db(), COL, id), contenido);
};

/**
 * Mueve el estado y **firma la revisión**.
 *
 * `serverTimestamp()` y no la hora del navegador: la regla exige
 * `revision.en == request.time`, así que un reloj adelantado no puede firmar en
 * el futuro. Mismo criterio que `revisarPropuesta`.
 *
 * El grafo —qué movimiento es legal— lo decide `TRANSICIONES`
 * (`lib/directorios.ts`) y lo hace cumplir la regla; acá solo se escribe.
 */
export const moverLibreria = async (
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
