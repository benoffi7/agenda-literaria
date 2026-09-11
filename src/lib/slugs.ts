/**
 * `/slugs/{slug}` — el índice que hace verificable la unicidad del slug sin
 * barrer el catálogo (B-888 tajada 2, **D-660**).
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * `slugDisponible()` barría toda la colección de actividades. Con la regla de
 * B-888 esa query se le rechaza **entera** a un publicador (trampa 7: una regla
 * no filtra, corta), y no tiene arreglo dentro de la regla — el slug único es un
 * invariante de **todo** el catálogo y no se verifica mirando solo lo propio.
 *
 * Acá la pregunta se contesta con **un `getDoc` por id**: sin `where`, sin
 * índice compuesto, sin la trampa 7 y con la misma latencia para los dos roles.
 * El descarte de la otra salida —un `onCall`— está escrito en `firestore.rules`
 * y en D-660; el resumen es que ninguna acción del panel bloquea hoy sobre una
 * Function, que el CI no levanta el emulador de Functions, y que un `onCall`
 * seguiría siendo check-then-write.
 *
 * ── Lo que este módulo garantiza, y lo que no ─────────────────────────────
 * **Garantiza que dos actividades no puedan quedarse con el mismo slug.** No es
 * un chequeo: la reserva viaja en el **mismo `writeBatch`** que la actividad, y
 * `allow update: if false` hace que un `set` sobre un slug ya reservado sea un
 * `update` y lo rechace el servidor. Un batch es atómico, así que entran las dos
 * escrituras o ninguna: no hay reserva huérfana por un guardado a medias, que es
 * la forma en que un índice escrito «al lado» se desincroniza (clase de B-88).
 *
 * **No garantiza que el índice esté completo.** Las actividades anteriores a
 * este módulo no tienen reserva, así que sus slugs se leerían como libres. Por
 * eso `scripts/sembrar-slugs.mjs` deja el centinela `/slugs/_indice` y
 * `slugLibre()` **se niega a contestar** si no está: prefiere cortar el guardado
 * con un mensaje a decir «libre» sobre una dirección publicada, que es el daño
 * de la trampa 10 (URLs rotas y SEO perdido).
 *
 * El `_` del centinela lo hace inalcanzable como slug —`slugify` solo produce
 * `[a-z0-9-]`, que es lo que exige el `matches` de la regla—, así que no puede
 * chocar con la reserva de ninguna actividad.
 */
import { deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09, D-51).
import { db } from '@/lib/firestore-client';

export const COL_SLUGS = 'slugs';

/**
 * El documento que dice «el índice se sembró». Lo escribe
 * `scripts/sembrar-slugs.mjs` con el Admin SDK; ningún cliente puede crearlo
 * (`reservaValida()` exige el alfabeto de `slugify`, que no tiene `_`).
 */
export const ID_CENTINELA = '_indice';

/** El nombre ya está tomado por otra actividad. */
export class SlugTomado extends Error {
  constructor(readonly slug: string) {
    super(`La dirección web «${slug}» ya la usa otra actividad.`);
    this.name = 'SlugTomado';
  }
}

/**
 * El índice todavía no se sembró, así que **no se sabe** si el slug está libre.
 *
 * Se trata como un error y no como «está libre» a propósito: es la única
 * dirección en la que este módulo puede fallar, y falla cerrada.
 */
export class IndiceSinSembrar extends Error {
  constructor() {
    super(
      'No se pudo verificar la dirección web: el índice de direcciones todavía no ' +
        'se sembró. Avisá antes de seguir cargando (scripts/sembrar-slugs.mjs).',
    );
    this.name = 'IndiceSinSembrar';
  }
}

export const refDeSlug = (slug: string) => doc(db(), COL_SLUGS, slug);

/**
 * El cuerpo de una reserva. Los tres campos son los que exige `reservaValida()`
 * en `firestore.rules`, y se arman **acá y en un solo lugar**: la regla valida
 * `hasOnly` + `hasAll`, así que un campo de más o de menos es un rechazo.
 */
export const reservaDeSlug = (actividadId: string, uid: string): Record<string, unknown> => ({
  actividadId,
  porUid: uid,
  creadoEn: serverTimestamp(),
});

/**
 * El centinela, cacheado para toda la sesión: no cambia mientras el panel está
 * abierto, y sin cache cada guardado pagaría una lectura de más.
 *
 * **Solo se cachea el sí.** Un `false` se vuelve a preguntar, para que sembrar
 * el índice mientras el panel está abierto lo destrabe sin recargar.
 */
let _sembrado = false;

export const indiceSembrado = async (): Promise<boolean> => {
  if (_sembrado) return true;
  const snap = await getDoc(doc(db(), COL_SLUGS, ID_CENTINELA));
  _sembrado = snap.exists();
  return _sembrado;
};

/** Solo para los tests: olvida el cache del centinela. */
export const olvidarCentinela = (): void => {
  _sembrado = false;
};

/** El id de la actividad que tiene reservado ese slug, o `null` si está libre. */
export const duenoDelSlug = async (slug: string): Promise<string | null> => {
  const snap = await getDoc(refDeSlug(slug));
  return snap.exists() ? ((snap.data() as { actividadId?: string }).actividadId ?? null) : null;
};

/**
 * ¿El slug está libre para esta actividad?
 *
 * `idActual` es la actividad que se está editando: su propio slug no cuenta como
 * tomado, que es lo mismo que hacía el barrido con `d.id !== idActual`.
 *
 * Tira `IndiceSinSembrar` si el centinela no está — ver el docblock del archivo.
 */
export const slugLibre = async (slug: string, idActual?: string): Promise<boolean> => {
  // Las dos lecturas en paralelo: son dos `get` por id, no hay nada que ordenar.
  const [sembrado, dueno] = await Promise.all([indiceSembrado(), duenoDelSlug(slug)]);
  if (!sembrado) throw new IndiceSinSembrar();
  return dueno === null || dueno === idActual;
};

/**
 * Suelta un nombre. **Best-effort y en su propio `catch` por diseño**: se usa
 * después de borrar una actividad, y un borrado que ya ocurrió no se puede
 * deshacer porque la reserva no se dejó soltar.
 *
 * El caso en que falla está dicho y es acotado: si un admin le cambió el slug a
 * la actividad de un publicador, la reserva quedó a nombre del admin y el
 * publicador no la puede borrar (`porUid`). Queda un nombre que no se puede
 * reusar —falla cerrada— y lo barre `scripts/sembrar-slugs.mjs --reparar`.
 */
export const liberarSlug = async (slug: string): Promise<boolean> => {
  try {
    await deleteDoc(refDeSlug(slug));
    return true;
  } catch {
    return false;
  }
};
