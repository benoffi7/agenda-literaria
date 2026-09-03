/**
 * Las formas de cursar una actividad (B-224).
 *
 * El modelo pasó de `modalidad: 'presencial' | 'virtual' | 'hibrido'` + una sede
 * a una **lista de filas**, cada una con su modalidad, su lugar y su ventana
 * opcional de fechas. Es el patrón de `sesiones` (§11) aplicado al bloque
 * «Dónde», que es lo que el dueño pidió: «el formulario de modalidad se mantiene
 * tal cual + doble fecha, y sobre eso es tener N modalidades así como N
 * encuentros».
 *
 * Todo lo de acá es **puro** y no toca Firestore. Las conversiones de fecha son
 * las de `lib/sesiones.ts` —`aDatetimeLocal` / `deDatetimeLocal`— importadas y no
 * reescritas: son las que evitan la trampa 1, y ya están probadas.
 *
 * ── Tres derivaciones y por qué existen ────────────────────────────────────
 * `modalidad`, `sede` y `online` siguen en el documento como campos derivados de
 * esta lista, porque hay salidas que solo pueden decir **una** cosa: el filtro
 * del panel, el `location` del evento —que dibuja el mapa—, el `searchText` del
 * §6 y la analítica. Se calculan acá, en un solo lugar, y las escribe
 * `formADocumento` en cada guardado, igual que `searchText`.
 */
import { deDatetimeLocal } from '@/lib/sesiones';
import type { Modalidad, ModalidadFila, ModalidadFilaForm, Online, Sede } from '@/types/actividad';

/**
 * B-190 / D-231 — el slug de la opción "todavía no se decidió" (§4.1,
 * `opciones-base.json`). Vive acá y no repetido a mano en cada consumidor: lo
 * encontró el `auditor-privacidad` sobre B-190 — el string suelto en
 * `detallePublico.ts` y `textoRedes.ts` es la misma clase B-88 que ya costó una
 * vez (el productor y el consumidor de un vocabulario derivando por separado).
 * Si el slug cambia, TypeScript avisa en cada import; un string a mano no avisa
 * en ninguno.
 */
export const SLUG_PLATAFORMA_A_CONFIRMAR = 'a-confirmar';

/*
 * **No hay lectura de compatibilidad, y se sacó a propósito.** Hubo una que
 * sintetizaba una fila con el `modalidad`/`sede`/`online` de primer nivel de un
 * documento sin la lista, con id determinístico, copiando el patrón de
 * `imagenesDe` (D-125). Se borró: aquél existía para documentos que **sí** están
 * en producción, y acá no hay ninguno («no te preocupes por hoy, no hay nada en
 * producción», el dueño). Era una rama más de las tres proyecciones públicas sin
 * ningún centinela que la recorriera, y el arreglo más barato para eso es no
 * tener la rama. Lo que queda es `?? []` donde el campo puede faltar.
 */

/*
 * `modalidadVacia` y `conModalidadDeFila` **no viven acá**: viven en
 * `formulario/estadoInicial.ts`, con `sedeVacia`, `onlineVacio` y las demás
 * fábricas. Es donde tienen que estar por dos motivos: necesitan esas fábricas
 * (importarlas desde acá cerraría un ciclo, porque `estadoInicial` importa este
 * módulo), y el molde con el que `autoguardado.ts` poda lo recuperado necesita
 * exactamente la forma que producen — escribirla dos veces ya borró
 * `tallerista.bio` una vez (D-124).
 */

/**
 * Id de una fila de modalidad. **Generado en el cliente al crear la fila, nunca
 * por índice del array** — es la trampa 2, la misma que costó el diff de
 * sesiones: borrar la segunda fila renumera todo y cualquier cosa que compare por
 * posición cree que cambiaron todas.
 *
 * Mismo patrón y mismo fallback que `nuevaSesionId()` y `nuevaImagenId()`.
 */
export const nuevaModalidadId = (): string => {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `mod_${uuid}`;
};

/** §11 — la sede aparece en presencial e híbrido. Por fila, no por actividad. */
export const filaPideSede = (m: Modalidad): boolean => m === 'presencial' || m === 'hibrido';

/** §11 — el bloque online aparece en virtual e híbrido. */
export const filaPideOnline = (m: Modalidad): boolean => m === 'virtual' || m === 'hibrido';

/**
 * La modalidad de la actividad entera, **derivada** de sus filas (B-224,
 * decisión 3): la unión de lo que las filas dicen.
 *
 * - todas presenciales → `presencial`
 * - todas virtuales → `virtual`
 * - una presencial y una virtual, o cualquier fila `hibrido` → `hibrido`
 *
 * Es la unión y no «la primera fila manda» a propósito: lo segundo depende del
 * orden del array, que es la trampa 2 en otra forma —reordenar las filas
 * cambiaría lo que publica el `events.json`—. Y es lo que hace que las salidas
 * que solo admiten un valor sigan diciendo algo cierto.
 *
 * **Una lista vacía devuelve `presencial`**, que es el default de `formVacio()`.
 * Solo pasa en un borrador: el schema exige al menos una fila para publicar.
 */
export const modalidadResultante = (
  filas: readonly { modalidad: Modalidad }[] = [],
): Modalidad => {
  if (filas.length === 0) return 'presencial';
  const hayPresencial = filas.some((f) => filaPideSede(f.modalidad));
  const hayVirtual = filas.some((f) => filaPideOnline(f.modalidad));
  if (hayPresencial && hayVirtual) return 'hibrido';
  return hayVirtual ? 'virtual' : 'presencial';
};

/**
 * Todas las modalidades que esta actividad ofrece, **sin repetir y en el orden de
 * las filas**, más la resultante.
 *
 * Es lo que hace que el filtro del panel encuentre por cualquiera de ellas: una
 * actividad con una fila presencial y otra virtual tiene que aparecer bajo
 * «Presencial», bajo «Virtual» y bajo «Presencial y virtual», porque las tres
 * cosas son ciertas de ella. Filtrar solo por la resultante la escondería de los
 * dos filtros que la describen mejor.
 */
export const modalidadesQueOfrece = (
  filas: readonly { modalidad: Modalidad }[] = [],
): Modalidad[] => [...new Set([...filas.map((f) => f.modalidad), modalidadResultante(filas)])];

/**
 * La sede **principal**: la de la primera fila que tenga una.
 *
 * Existe porque el campo `location` del evento —el que dibuja el mapa—, el
 * `searchText` y el filtro por barrio solo admiten una dirección. «La primera que
 * tenga» y no un flag explícito estilo `portada` (D-125) porque el orden de las
 * filas lo elige quien carga y se ve en pantalla. Si alguna vez importa
 * distinguirla, la respuesta es el flag.
 */
export const sedePrincipal = <T extends { sede: Sede | null }>(
  filas: readonly T[] = [],
): Sede | null => filas.find((f) => f.sede)?.sede ?? null;

/** El bloque online principal, con el mismo criterio que `sedePrincipal`. */
export const onlinePrincipal = <T extends { online: Online | null }>(
  filas: readonly T[] = [],
): Online | null => filas.find((f) => f.online)?.online ?? null;

/**
 * Duplica una fila conservando todo, con **id nuevo**.
 *
 * A diferencia de `duplicarSesion`, las fechas **no se corren una semana**: una
 * ventana no es un encuentro semanal, y el caso de duplicar acá es «lo mismo pero
 * virtual» o «la misma cursada en otra sede», donde correr las fechas sería
 * equivocarse en silencio.
 *
 * Los anidados se copian en lugar de compartir la referencia: dos filas apuntando
 * al mismo objeto `sede` hacen que editar una cambie la otra.
 */
export const duplicarModalidad = (f: ModalidadFilaForm): ModalidadFilaForm => ({
  ...f,
  id: nuevaModalidadId(),
  sede: f.sede ? { ...f.sede, geo: f.sede.geo ? { ...f.sede.geo } : null } : null,
  online: f.online ? { ...f.online } : null,
});

/**
 * ¿La ventana está al revés? El schema la rechaza, y el editor la muestra en rojo
 * antes de guardar — la misma pareja que `resumirSesion.finAntesDelInicio`.
 *
 * Con una sola de las dos fechas no hay nada que comparar: no es un error, es el
 * caso «desde marzo, sin fecha de cierre».
 */
export const ventanaInvertida = (f: { inicio: string; fin: string }): boolean => {
  const inicio = deDatetimeLocal(f.inicio);
  const fin = deDatetimeLocal(f.fin);
  return Boolean(inicio && fin && fin.getTime() <= inicio.getTime());
};

/**
 * La ventana en palabras, para el editor: «desde el 2/3/26, 19:00 hasta el
 * 30/6/26, 21:00». Vacío si no hay ninguna de las dos.
 *
 * Es lo mismo que hace `resumirSesion` con el día de la semana: lo que se tipeó a
 * mano se verifica de un vistazo. **No se publica**: hoy las fechas de una
 * modalidad no salen a ninguna de las cinco salidas del §5 (B-224).
 */
export const resumirVentana = (f: { inicio: string; fin: string }): string => {
  const legible = (s: string): string => {
    const d = deDatetimeLocal(s);
    return d
      ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d)
      : '';
  };
  const desde = legible(f.inicio);
  const hasta = legible(f.fin);
  if (desde && hasta) return `Del ${desde} al ${hasta}.`;
  if (desde) return `Desde el ${desde}.`;
  if (hasta) return `Hasta el ${hasta}.`;
  return '';
};

/** Fila del documento → fila del formulario. Las fechas, con la conversión del §7. */
export const modalidadAForm = (
  f: ModalidadFila,
  aTexto: (d: Date) => string,
): ModalidadFilaForm => ({
  id: f.id,
  modalidad: f.modalidad,
  inicio: f.inicio ? aTexto(f.inicio.toDate()) : '',
  fin: f.fin ? aTexto(f.fin.toDate()) : '',
  sede: f.sede,
  online: f.online,
});
