/**
 * **La capa de datos de `/lugares`, del lado del panel** — B-833, tajada 4.
 *
 * ⚠️ **Este módulo toca Firestore, así que NO puede llegar a una página
 * pública.** Es el mismo corte que separa `actividades.ts` de `toPublic.ts`,
 * `librerias.ts` de `libreriaPublica.ts` y `suscripcionesLiterarias.ts` de
 * `suscripcionPublica.ts`, y lo verifica `tests/bundle-panel.test.ts`: lo que el
 * sitio necesita de un lugar está en `lib/lugarPublico.ts`, que es puro.
 *
 * ── Qué vive acá y qué no ────────────────────────────────────────────────
 * | Pieza | Dónde |
 * |---|---|
 * | los estados, las transiciones, el congelado del slug | `lib/directorios.ts` (B-834) |
 * | los campos, los topes | `types/lugar.ts` |
 * | la validación y el armado del documento | `lib/lugar-schema.ts` |
 * | la proyección pública, y el gate de la dirección | `lib/lugarPublico.ts` |
 * | **leer y escribir** | acá |
 *
 * ── Las dos escrituras, y por qué son dos ────────────────────────────────
 * `guardarLugar` escribe **contenido** y `moverLugar` escribe **estado**, igual
 * que en los otros dos directorios y por lo mismo: mover el estado exige firmar
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
import { formALugar, precioCambio, precioDelForm } from '@/lib/lugar-schema';
import { CIUDAD_POR_DEFECTO } from '@/types/libreria';
import { direccionPublicaPorDefecto } from '@/types/lugar';
import type { EstadoDirectorio } from '@/lib/directorios';
import type { TimestampLike } from '@/types/actividad';
import type { Lugar, LugarConId, LugarForm } from '@/types/lugar';

const COL = 'lugares';

/**
 * Cuántos trae la bandeja.
 *
 * Mismo número y mismo motivo que `LIMITE_LIBRERIAS` y `LIMITE_SUSCRIPCIONES`:
 * es un tope de seguridad para que una colección que crece no baje entera en
 * cada apertura del panel.
 */
export const LIMITE_LUGARES = 200;

/**
 * El sentinel del servidor, tipado como el `Timestamp` que va a quedar guardado.
 *
 * Va acá y no en el módulo puro a propósito: `lugar-schema.ts` no importa
 * `firebase/firestore` —es lo que lo deja testeable sin emuladores y fuera del
 * bundle público— así que la fecha **entra como parámetro**, que es lo que el §
 * «El reloj también es infraestructura» de `05-patrones.md` pide.
 */
const ahoraDelServidor = (): TimestampLike => serverTimestamp() as unknown as TimestampLike;

/**
 * Escucha el directorio entero.
 *
 * `onSnapshot` y no una lectura suelta, por lo mismo que las otras dos bandejas:
 * con dos admins mirando, el que uno acaba de publicar tiene que dejar de estar
 * pendiente en la pantalla del otro sin que nadie recargue.
 */
export const observarLugares = (
  cb: (ls: LugarConId[]) => void,
  onError: (e: Error) => void,
  cuantos = LIMITE_LUGARES,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('creadoEn', 'desc'), limit(cuantos)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Lugar), id: d.id }))),
    onError,
  );

/**
 * ¿Esta dirección web está libre? — trampa 10.
 *
 * Misma guarda **de aviso** que en los otros dos directorios, con el mismo
 * alcance escrito: no hay reserva atómica en `/slugs` para esta colección, así
 * que dos altas simultáneas con el mismo nombre pasarían las dos (B-909). El
 * daño es acotado y visible —dos fichas en `pendiente`, y nada sale al sitio sin
 * que un admin lo publique— y se corrige en la bandeja, que es justo el momento
 * en que el slug todavía se puede tocar.
 */
export const slugDeLugarDisponible = async (
  slug: string,
  idActual?: string,
): Promise<boolean> => {
  if (!slug) return false;
  const snap = await getDocs(query(collection(db(), COL), where('slug', '==', slug), limit(2)));
  return snap.docs.every((d) => d.id === idActual);
};

/**
 * Documento → formulario. La inversa de `formALugar`.
 *
 * `null` → `''` en todo lo opcional, por lo mismo que allá. Tres cosas que se
 * ven raras y son a propósito:
 *
 * - **`precio.cargadoEn` no vuelve al formulario.** No se tipea, así que no
 *   tiene campo; quien guarda decide si se refecha (ver `guardarLugar`). Es la
 *   mitad de B-837 que no se le puede delegar a la pantalla.
 * - **`direccionPublica` vuelve con el default del TIPO cuando el campo no
 *   está**, y no con `true`. Un documento anterior al campo —o escrito por un
 *   script— llegaría sin él, y leerlo como `true` prendería la dirección de una
 *   casa al primer guardado desde el panel. Es el § «un campo nuevo se lee con
 *   el default que preserva lo anterior» con el matiz del § 6: acá «lo anterior»
 *   es *no publicar*, porque la proyección ya trata el ausente como apagado.
 * - **`ciudad` cae a `CIUDAD_POR_DEFECTO`**, igual que en una librería.
 *
 * `contactoDeQuienCargo` vuelve **entero**, y tiene que volver: es contenido
 * editable y el admin necesita poder corregirlo. Que sea editable no lo hace
 * público — eso lo decide `lugarPublico.ts`, que no lo proyecta.
 */
export const lugarAFormulario = (l: Lugar): LugarForm => ({
  nombre: l.nombre,
  slug: l.slug,
  descripcion: l.descripcion ?? '',
  imagenes: l.imagenes ?? [],
  tipo: l.tipo ?? '',
  direccion: l.direccion ?? '',
  barrio: l.barrio ?? '',
  ciudad: l.ciudad || CIUDAD_POR_DEFECTO,
  geo: {
    lat: l.geo ? String(l.geo.lat) : '',
    lng: l.geo ? String(l.geo.lng) : '',
  },
  direccionPublica: l.direccionPublica ?? direccionPublicaPorDefecto(l.tipo ?? ''),
  capacidad: l.capacidad == null ? '' : String(l.capacidad),
  capacidadNotas: l.capacidadNotas ?? '',
  incluye: l.incluye ?? [],
  incluyeOtro: l.incluyeOtro ?? '',
  condicion: l.condicion ?? '',
  precio: {
    monto: l.precio ? String(l.precio.valor.monto) : '',
    porUnidad: l.precio?.valor.porUnidad || 'hora',
  },
  condicionNotas: l.condicionNotas ?? '',
  instagram: l.instagram ?? '',
  whatsapp: l.whatsapp ?? '',
  mail: l.mail ?? '',
  web: l.web ?? '',
  contactoDeQuienCargo: l.contactoDeQuienCargo ?? { via: 'mail', valor: '' },
});

/**
 * Alta desde el panel, que es **la tercera puerta del § 1 del PRD** y no un
 * andamio: el dueño carga un lugar a mano — y el § 10 dice que **es la mejor
 * forma de arrancar**, cargando los que ya están en la base como sede
 * (`src/lib/sedesRepetidas.ts` sabe cuáles son), con permiso pedido.
 *
 * `origen: 'panel'` porque lo escribe un admin, y la regla lo exige coherente
 * con quién escribe. `creadoEn: serverTimestamp()` porque la regla pide
 * `request.time`. Y el precio nace con **esa misma hora**: una ficha recién
 * cargada tiene el precio recién cargado, y la regla lo exige igual.
 */
export const crearLugar = async (f: LugarForm): Promise<string> => {
  const ref = doc(collection(db(), COL));
  await setDoc(ref, {
    ...formALugar(f, ahoraDelServidor(), 'panel'),
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Edición de **contenido**. No toca `estado`, `origen`, `creadoEn` ni
 * `revision`.
 *
 * ── La fecha del precio: se mueve solo si el precio se movió — B-837 ─────
 * Recibe la ficha **previa** justamente para poder contestar eso, igual que
 * `guardarSuscripcion`. Corregir la descripción no refecha el precio; cambiar el
 * número sí, y con `serverTimestamp()`, así que el reloj del navegador no puede
 * antedatarlo. La regla lo hace cumplir (`lugarActualizable()`), que es la mitad
 * que no se puede saltear. Y el precio previo se manda **tal como vino del
 * snapshot**, no reconstruido: un `Timestamp` rearmado con un milisegundo de
 * diferencia haría rebotar la escritura entera.
 */
export const guardarLugar = async (
  id: string,
  f: LugarForm,
  previo: Lugar,
): Promise<void> => {
  const nuevo = precioDelForm(f, ahoraDelServidor());
  const cambio = precioCambio(previo.precio, nuevo);
  const cargadoEn = cambio || !previo.precio ? ahoraDelServidor() : previo.precio.cargadoEn;

  const { estado, origen, revision, ...contenido } = formALugar(f, cargadoEn, 'panel');
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
export const moverLugar = async (
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
