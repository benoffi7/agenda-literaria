/**
 * **La bandeja de propuestas, del lado de los datos** — B-830, paso 7.
 *
 * Es a `/propuestas` lo que `reportes.ts` es a `/reportes`: la lectura en vivo
 * para la pantalla y las **únicas** escrituras que el panel puede hacer sobre
 * una propuesta. Lo demás —qué se ve, cómo se ve— es del componente.
 *
 * ── Lo que un admin puede escribir, y por qué es tan poco ─────────────────
 * Una propuesta es **prueba de qué se pidió**, así que su contenido no se edita:
 * si hay que corregir el título, se corrige en la actividad que sale de ella
 * (§4.3 del PRD). La regla lo hace cumplir —`revisionValida()` acota el update a
 * `estado` + `revision`— y este módulo no ofrece ningún otro camino, que es la
 * mitad de la propiedad: la regla frena lo que se intente, y acá no se intenta.
 *
 * ── Y una cosa que no está acá ────────────────────────────────────────────
 * **La conversión a actividad no vive en este archivo**: es pura y vive en
 * `propuestas.ts`, sin un solo `await`. Acá está solo el segundo movimiento de
 * **D-600** —marcar la propuesta aceptada con el id de la actividad que ya se
 * creó—, que es el que necesita Firestore.
 */
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09).
import { db } from '@/lib/firestore-client';
// Los dos saneadores de `href` del proyecto, importados y **no copiados**: dos
// versiones de «qué URL es segura» divergen y una queda vieja (la clase de B-88).
import { handleInstagram, urlSegura } from '@/lib/enlaceSeguro';
// El conversor de `Timestamp` del proyecto, importado y **no reescrito**: es el
// hogar de las conversiones de fecha y el que evita la trampa 1 (§13).
import { instanteDeTimestamp } from '@/lib/sesiones';
import type {
  EstadoPropuesta,
  FechaPropuesta,
  ImagenPropuesta,
  Propuesta,
  PropuestaConId,
  ViaContactoPropuesta,
} from '@/types/propuesta';

const COL = 'propuestas';

/**
 * Cuántas trae el `onSnapshot` de la bandeja.
 *
 * Mismo número y mismo motivo que `LIMITE_REPORTES` (B-580): la pantalla oculta
 * las cerradas por defecto y el filtro es **en memoria**, así que la query tiene
 * que traer de más para que una racha de aceptadas no le coma el lugar a las
 * pendientes. Filtrar en la query pediría un índice compuesto (`estado` +
 * `orderBy creadoEn`) para ahorrar cuarenta documentos.
 */
export const LIMITE_PROPUESTAS = 50;

/** Las que esperan una decisión. Es lo que cuenta el badge y lo que la bandeja muestra por defecto. */
export const ESTADOS_PENDIENTES = ['nueva', 'en-revision'] as const;

export const esPendiente = (p: Pick<Propuesta, 'estado'>): boolean =>
  (ESTADOS_PENDIENTES as readonly string[]).includes(p.estado);

/*
 * ── Cuándo caduca una propuesta, del lado de la pantalla — B-844 ──────────
 *
 * **Esto es una segunda implementación del mismo plazo, y se declara como tal.**
 * La primera —la que borra— es `decidirRetencion` en `functions/retencion.js`, y
 * lo natural sería importarla: es exactamente lo que el § «Lógica pura separada
 * de la infraestructura» de `05-patrones.md` pide, y lo que hacen `@calendario`,
 * `@historial` y `@png-chunks-seguros`. Acá no se hizo, y el motivo es de
 * alcance y no de diseño: un cuarto alias toca `astro.config.mjs`,
 * `tsconfig.json`, `vitest.config.ts`, `scripts/que-deployar.sh` y las dos
 * listas de alias que `bundle-panel.test.ts` y `panel-fuera-del-sitio.test.ts`
 * enumeran — seis archivos compartidos, y esta tanda no los tiene.
 *
 * **Entonces la atadura es un test y no un import** (el patrón de B-364, el
 * mismo que ata los topes de `types/propuesta.ts` con `firestore.rules`), con
 * una diferencia que la hace más fuerte que comparar dos números:
 * `tests/bandeja-de-propuestas.test.ts` pasa **una familia de fixtures por las
 * dos implementaciones** y exige que coincidan caso por caso. Si los plazos, la
 * tabla de estados o el reloj se separan, se pone rojo. Que el import sea mejor
 * igual sigue siendo cierto, y está anotado.
 *
 * Y por qué la bandeja tiene que decirlo: el borrado ya no depende de que un
 * admin apriete «rechazar», así que ahora hay documentos que se van solos y
 * **nadie los ve irse**. Una propuesta que estaba por caducar y desaparece sin
 * aviso se lee como un bug de la bandeja. Con los 30 días que contestó el dueño
 * pesa más que con la hipótesis de 90: una propuesta puede caducar **antes de
 * que nadie la haya abierto nunca** si la bandeja pasó un mes sin mirarse.
 */

/**
 * Los mismos plazos de `RETENCION_POR_ESTADO`, en días. `null` = no vence.
 *
 * **Si el dueño cambia el número, se cambia en los dos lados** —acá y en
 * `functions/retencion.js`— y el test de arriba es lo que hace que olvidarse de
 * uno no compile en silencio.
 */
export const RETENCION_DIAS: Record<EstadoPropuesta, number | null> = {
  rechazada: 30,
  // 30 también, y es **otra decisión con el mismo número** — el docblock de
  // `MARGEN_SIN_TOCAR_MS` explica por qué son dos y no una. No se escriben como
  // `rechazada` reusado por lo mismo.
  nueva: 30,
  'en-revision': 30,
  aceptada: null,
};

/**
 * Desde cuántos días antes la ficha avisa.
 *
 * ── El criterio, escrito para que no haya que redescubrirlo ───────────────
 * **La ventana es más o menos un cuarto del plazo, y nunca más de un tercio.**
 * Con los 30 días que contestó el dueño eso da **una semana**, que además es la
 * unidad en la que una persona actúa: ves la ficha, le escribís a quien propuso
 * y le das unos días para contestar.
 *
 * El número anterior era 14 y **el argumento que lo eligió murió con la
 * respuesta del dueño**: se había elegido contra un plazo de 90 días —«está
 * apagado once semanas de cada trece»— y sobre 30 prendería casi la mitad de la
 * vida de cada ficha. Eso es el cartel en cada ficha que **D-273** rechaza: «una
 * lista de 65 sobre 68 no es trabajo pendiente sino el catálogo con otro
 * nombre». Con siete está apagado el 77 % del plazo, y en una bandeja que se
 * atiende no se prende nunca — mover una propuesta de estado reinicia su reloj,
 * así que lo único que llega a los 23 días es lo que de verdad nadie tocó.
 *
 * La otra mitad del criterio, y es la que pone el **piso**: la ventana tiene que
 * ser más larga que el hueco entre dos visitas a la bandeja, o el aviso se puede
 * perder entero —la ficha pasa de callada a borrada sin que nadie lo haya
 * visto—. Una semana es el hueco de alguien que la mira aunque sea los lunes. Si
 * el plazo bajara a diez días, esta cuenta ya no cerraría y habría que decidir
 * de nuevo: `tests/bandeja-de-propuestas.test.ts` tiene el aserto que lo fuerza
 * (la ventana no puede pasar de un tercio del plazo más corto).
 */
export const AVISO_DE_CADUCIDAD_DIAS = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Desde cuándo se cuenta el plazo: **la última señal de vida**.
 *
 * Espejo de `relojDeRetencion`. `revision.en` se escribe en **todo** movimiento
 * de estado —«la estoy mirando» y también «Reabrir»—, así que una que un admin
 * miró la semana pasada no es una que nadie abrió nunca, aunque las dos hayan
 * llegado hace tres meses. La `rechazada` cuenta desde el rechazo y no cae a
 * `creadoEn` (DEC-13).
 */
const relojDe = (p: Pick<Propuesta, 'estado' | 'creadoEn' | 'revision'>): number | null => {
  const revisada = instanteDeTimestamp(p.revision?.en)?.getTime() ?? null;
  if (p.estado === 'rechazada') return revisada;
  const creada = instanteDeTimestamp(p.creadoEn)?.getTime() ?? null;
  if (revisada !== null && (creada === null || revisada >= creada)) return revisada;
  return creada;
};

/**
 * Cuántos días le quedan antes de que el barrido se la lleve. `null` si no vence
 * o si no se la puede fechar (que es lo que el barrido lee como
 * `sin-fecha-legible` y **tampoco** borra).
 *
 * Se redondea para abajo, o sea que promete **menos** tiempo del que hay: el
 * barrido corre una vez por día y el error caro es decir «te quedan 2» de algo
 * que se va esta noche.
 */
export const caducaEn = (
  p: Pick<Propuesta, 'estado' | 'creadoEn' | 'revision'>,
  ahora: number = Date.now(),
): number | null => {
  // `Object.hasOwn` y no el lookup pelado, por lo mismo que del lado que borra
  // (`auditor-privacidad`): `estado: 'constructor'` devolvería una función, y de
  // ahí sale «Se borra en NaN días» en la ficha.
  const plazo = Object.hasOwn(RETENCION_DIAS, p.estado) ? RETENCION_DIAS[p.estado] : undefined;
  if (plazo === null || plazo === undefined) return null;
  const reloj = relojDe(p);
  if (reloj === null) return null;
  return Math.floor((reloj + plazo * MS_POR_DIA - ahora) / MS_POR_DIA);
};

/**
 * Lo que la ficha muestra, o `null` si todavía falta mucho. En el idioma de
 * quien mira la bandeja: no dice «retención» ni nombra el plazo, dice cuándo.
 */
export const avisoDeCaducidad = (
  p: Pick<Propuesta, 'estado' | 'creadoEn' | 'revision'>,
  ahora: number = Date.now(),
): string | null => {
  const dias = caducaEn(p, ahora);
  if (dias === null || dias > AVISO_DE_CADUCIDAD_DIAS) return null;
  /*
   * **Los tres bordes de abajo importan más desde que el plazo son 30 días**: la
   * ventana es de una semana, así que ahora se visitan seguido —con noventa,
   * `dias === 0` era una rareza—. Y lo que hace útil al aviso es **el número**,
   * no la advertencia: una propuesta puede caducar antes de que nadie la haya
   * abierto si la bandeja pasó un mes sin mirarse, y ahí «esto vence» y «esto
   * vence el jueves» son la diferencia entre llegar y no llegar.
   *
   * `dias < 0` es vencida y todavía en la bandeja: el barrido corre una vez por
   * día, así que hay una ventana normal de hasta 24 horas. No es un error y no
   * se anuncia como tal.
   */
  if (dias < 0) return 'Se borra en la próxima limpieza';
  if (dias === 0) return 'Se borra hoy';
  if (dias === 1) return 'Se borra mañana';
  return `Se borra en ${dias} días`;
};

/**
 * **A qué estado pasa una propuesta cuando se abre su conversión** — B-866, o
 * `null` si no se toca.
 *
 * Abrir «Convertir en actividad» es literalmente empezar a mirarla, y hasta
 * B-866 no escribía nada (D-600 en su primera redacción): una propuesta vieja
 * abierta en el formulario no renovaba su plazo, y el barrido de retención se la
 * podía llevar con el formulario abierto — la actividad se guardaba y la prueba de
 * qué se pidió desaparecía. Pasarla a `en-revision` es un movimiento de estado,
 * así que escribe `revision.en` y el reloj de B-844 vuelve a contar desde ahí; y
 * la precondición de B-864 convierte cualquier carrera con una corrida en curso
 * en un borrado que no ocurre.
 *
 * **Solo la `nueva`**, decisión del dueño (2026-09-24):
 *
 *  - la `en-revision` **ya está** donde tiene que estar, y la regla no deja
 *    escribir sin mover el estado (`revisionValida()` pide `hasAny(['estado'])`),
 *    así que abrir la conversión no tiene nada que marcarle. Desde B-1490 el
 *    movimiento que le renueva el plazo existe, pero es un botón aparte de la
 *    bandeja («Volver a sin mirar», `estadoAlVolverASinMirar`) y no algo que la
 *    conversión haga sola: devolverla a `nueva` al abrirla diría lo contrario de
 *    lo que está pasando;
 *  - la `rechazada` se convierte sin reabrirla: pasarla a `en-revision` sería
 *    tomar en su nombre una decisión que el admin no tomó (reabrir), y la foto ya
 *    se borró al rechazar;
 *  - la `aceptada` no ofrece el botón.
 *
 * Lo que queda descubierto por esas dos primeras ramas no se tapa acá sino que
 * se avisa: `avisoDeVencimientoAlConvertir`, abajo (B-1460). Es puro para que la
 * regla de cuándo se escribe se pueda fijar sin DOM.
 */
export const estadoAlConvertir = (estado: EstadoPropuesta): EstadoPropuesta | null =>
  estado === 'nueva' ? 'en-revision' : null;

/**
 * **A qué estado vuelve una `en-revision` con «Volver a sin mirar»** — B-1490, o
 * `null` si la propuesta no ofrece ese botón.
 *
 * Es el deshacer de «La estoy mirando», y existe por el hueco que destapó
 * B-1460: la bandeja le ofrecía a la `en-revision` un solo movimiento,
 * «Rechazar», que es una decisión y —si trajo foto— la borra. Volver a `nueva`
 * no decide nada, deja la foto donde está (el trigger de B-863 solo actúa sobre
 * los estados que cierran) y, como todo movimiento, firma `revision.en`: el reloj
 * de retención vuelve a contar desde ahí. **La regla no cambió**: no tiene grafo
 * de transiciones y `en-revision → nueva` mueve el estado, que es lo único que
 * `revisionValida()` exige para dejar pasar la firma nueva.
 *
 * Solo la `en-revision`: la `nueva` ya está sin mirar, la `rechazada` tiene su
 * propio camino a `nueva` («Reabrir», que dice que la foto no vuelve) y la
 * `aceptada` no se reabre desde la bandeja.
 *
 * Lo leen los dos lados que tienen que coincidir —el botón de la ficha y el aviso
 * de `avisoDeVencimientoAlConvertir`—, para que el aviso no ofrezca una salida
 * que la pantalla no muestra.
 */
export const estadoAlVolverASinMirar = (estado: EstadoPropuesta): EstadoPropuesta | null =>
  estado === 'en-revision' ? 'nueva' : null;

/**
 * **Lo que dice el formulario cuando se convierte una propuesta que se va esta
 * noche y la marca no la salva** — B-1460, o `null` si no hace falta.
 *
 * Es la otra mitad de B-866. La marca renueva el plazo de la `nueva`, pero la
 * `en-revision` y la `rechazada` se convierten sin moverse (`estadoAlConvertir`
 * devuelve `null`), así que a una de ésas vieja el barrido se la puede llevar con
 * el formulario abierto. El dueño eligió **avisar y no aflojar la regla**: la
 * salida alternativa era un «toque» que renovara `revision.en` sin mover el
 * estado, y eso es abrir el `hasAny(['estado'])` que D-600 defendió.
 *
 * **Por qué el corte es «menos de un día» y no la semana de la ficha.** El
 * barrido corre una vez cada 24 horas, así que una propuesta con un día entero
 * por delante no puede caer en la próxima corrida: el riesgo real del formulario
 * abierto empieza cuando `caducaEn` da 0 (o menos, la vencida que todavía está).
 * Avisar desde los siete días repetiría lo que la bandeja ya dijo en la ficha
 * (`avisoDeCaducidad`) y volvería cartel un aviso que tiene que leerse.
 *
 * **No hay un segundo cálculo del plazo acá**: el número sale de `caducaEn` y la
 * frase de `avisoDeCaducidad`, que son los que el test de
 * `bandeja-de-propuestas.test.ts` cruza contra `decidirRetencion`.
 *
 * **La salida que ofrece depende del estado**, porque la bandeja no ofrece lo
 * mismo:
 *
 *  - las dos se salvan **guardando**, aunque sea en borrador: guardar dispara el
 *    segundo movimiento de D-600, la propuesta pasa a `aceptada` y deja de vencer;
 *  - la `rechazada`, si la conversión va a llevar tiempo, se puede **reabrir**
 *    desde la bandeja, que la mueve a `nueva` y reinicia el plazo;
 *  - la `en-revision`, desde B-1490, se puede **volver a «sin mirar»**
 *    (`estadoAlVolverASinMirar`), que la mueve a `nueva` y reinicia el plazo sin
 *    decidir nada. Hasta entonces el único movimiento que la bandeja le ofrecía
 *    era «Rechazar» —decidir algo solo para ganar tiempo, y borrar la foto—, y el
 *    aviso decía que no había salida. «Rechazar» sigue sin aconsejarse.
 */
export const avisoDeVencimientoAlConvertir = (
  p: Pick<Propuesta, 'estado' | 'creadoEn' | 'revision'>,
  ahora: number = Date.now(),
): string | null => {
  if (estadoAlConvertir(p.estado) !== null) return null;
  const dias = caducaEn(p, ahora);
  if (dias === null || dias >= 1) return null;
  const cuando = avisoDeCaducidad(p, ahora);
  if (cuando === null) return null;
  const guardar =
    'Guardá la actividad pronto, aunque sea como borrador: al guardarla la propuesta ' +
    'queda aceptada y ya no vence.';
  const inicio =
    `La propuesta ${cuando.charAt(0).toLowerCase()}${cuando.slice(1)} de la bandeja: le ` +
    'queda menos de un día de plazo y convertirla no se lo renueva.';
  if (p.estado === 'rechazada') {
    return (
      `${inicio} ${guardar} Si te vas a demorar, reabrila desde la bandeja («Reabrir»), ` +
      'que eso le reinicia el plazo.'
    );
  }
  if (estadoAlVolverASinMirar(p.estado) !== null) {
    // «Rechazar» no se ofrece como salida: es decidir algo solo para ganar tiempo,
    // y si la propuesta trajo foto, la borra. «Volver a sin mirar» no decide nada.
    return (
      `${inicio} ${guardar} Si te vas a demorar, volvela a «sin mirar» desde la bandeja ` +
      '(«Volver a sin mirar»), que eso le reinicia el plazo sin decidir nada.'
    );
  }
  return `${inicio} ${guardar}`;
};

/**
 * Lo que dice el formulario cuando la marca de B-866 no se pudo escribir.
 *
 * **No bloquea**: la conversión es trabajo que el admin ya empezó, y la marca es
 * una protección contra un caso raro (una propuesta a punto de vencer y un
 * formulario abierto por horas). Cortar la conversión por eso sería cambiar un
 * riesgo chico por uno seguro. Lo que sí hace falta es decir **qué** quedó sin
 * proteger, para que quien lee sepa que guardar pronto es la mitigación.
 *
 * Solo el código de Firebase y nunca el `message` del SDK, por lo mismo que
 * `textoDeFallo`: está en inglés y puede traer el path del documento.
 */
export const avisoDeMarcaFallida = (e: unknown): string => {
  const code = (e as { code?: unknown } | null)?.code;
  const codigo = typeof code === 'string' && /^[a-z/-]{1,40}$/.test(code) ? ` (${code})` : '';
  return (
    `No se pudo marcar la propuesta como «la estoy mirando»${codigo}. La conversión sigue ` +
    'igual, pero su plazo en la bandeja no se renovó: guardá la actividad pronto, así la ' +
    'limpieza diaria no se lleva la propuesta mientras el formulario está abierto.'
  );
};

/**
 * **El único cambio que el panel escribe**, armado aparte del `updateDoc` para
 * que se pueda verificar sin Firestore y —sobre todo— para que el test de
 * integración escriba **este** objeto contra el emulador en vez de un literal
 * calcado a mano, que es lo que se desincroniza (la clase de B-88).
 *
 * Los cuatro campos de `revision` van **siempre**, incluidos los dos que quedan
 * en `null`: `revisionValida()` los exige con un `hasAll` y ahí sí frena (en el
 * `create` no hacía falta, porque el default centinela ya tapa la clave
 * ausente). Mandar `{ porUid, en }` a secas es un permission-denied.
 *
 * `en` entra por parámetro y no se toma de acá: la regla pide `request.time`, o
 * sea `serverTimestamp()`, que es un valor de Firestore. Así la forma se testea
 * pura y el I/O queda en `revisarPropuesta`.
 */
export const cambioDeRevision = <T>(
  uid: string,
  estado: EstadoPropuesta,
  en: T,
  extras: {
    actividadId?: string | null;
    motivo?: string | null;
    /**
     * **La foto se descartó al convertir** — B-926. Solo viaja cuando es `true`:
     * ver abajo.
     */
    fotoDescartada?: boolean;
  } = {},
): { estado: EstadoPropuesta; revision: Record<string, unknown> } => ({
  estado,
  revision: {
    porUid: uid,
    en,
    actividadId: extras.actividadId ?? null,
    motivo: extras.motivo ?? null,
    /*
     * **La clave solo aparece cuando es `true`** — B-926, y es deliberado al
     * revés que los cuatro de arriba.
     *
     * Aquéllos van siempre porque `revisionValida()` los exige con un `hasAll`.
     * Éste está en el `hasOnly` y **no** en el `hasAll`, así que mandarlo en
     * `false` sería escribir un campo que no significa nada en las tres cuartas
     * partes de los casos —todo rechazo, toda propuesta sin foto— y dejarlo
     * guardado en el documento como si alguien hubiera decidido algo.
     *
     * Y la asimetría tiene un segundo motivo, más concreto: el trigger lo lee
     * con `=== true`. Un `false` explícito y una clave ausente significan lo
     * mismo para quien decide, así que la forma más chica es la que no miente.
     */
    ...(extras.fotoDescartada === true ? { fotoDescartada: true } : {}),
  },
});

/**
 * A dónde lleva el contacto de quien propuso, si se puede armar un link seguro.
 *
 * ── Es texto de un anónimo puesto en un `href`, y eso tiene una trampa ────
 * `contacto.valor` es el **primer dato de un tercero sin login** que el panel
 * muestra, y el `href` es el lugar donde un string ajeno deja de ser texto: un
 * valor que empiece con `javascript:` es código que corre en el panel de un
 * admin logueado, con su sesión. React escapa el contenido de un atributo, no su
 * esquema.
 *
 * Por eso ninguna rama concatena el valor crudo:
 *
 *  - **mail** — se exige que parezca un mail antes de ponerle `mailto:`;
 *  - **whatsapp** — se queda con los dígitos y descarta todo lo demás, así que
 *    de `+54 9 11 2222-3333` sale `5491122223333` y de cualquier otra cosa no
 *    sale nada;
 *  - **instagram** — solo el alfabeto de un handle, sin la arroba.
 *
 * Y cuando no se puede armar, devuelve `null` **y no un link roto**: la pantalla
 * muestra el valor como texto plano, que sigue siendo útil (se copia y se pega)
 * y no es clickeable. Preferir el texto al link es lo barato de equivocarse.
 */
export const enlaceDeContacto = (c: {
  via: ViaContactoPropuesta;
  valor: string;
}): string | null => {
  const valor = c.valor.trim();
  if (c.via === 'mail') {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(valor)
      ? `mailto:${valor}`
      : null;
  }
  if (c.via === 'whatsapp') {
    const digitos = valor.replace(/\D/g, '');
    // Ocho es más corto que cualquier número con característica; quince es el
    // largo máximo de un número internacional (E.164).
    return digitos.length >= 8 && digitos.length <= 15 ? `https://wa.me/${digitos}` : null;
  }
  /*
   * `handleInstagram` y no un regex propio: es el mismo saneo que la ficha
   * pública ya hace —el alfabeto real de Instagram, sin barras que manden a otra
   * cuenta— y de paso acepta las formas en que alguien pega su cuenta
   * (`@casabrandon`, `instagram.com/casabrandon`).
   */
  const handle = handleInstagram(valor);
  return handle ? `https://instagram.com/${handle}` : null;
};

/**
 * La imagen que pegaron, si se puede abrir sin riesgo.
 *
 * **Es el otro `href` de texto ajeno de la bandeja, y lo señaló el
 * `auditor-privacidad`**: `imagen.url` es el único string de una propuesta que no
 * pasa por ningún validador de forma —la regla exige `is string` y 1–500
 * caracteres, el schema solo el largo— así que un `javascript:…` llega entero al
 * documento. Hoy no es explotable porque React reescribe ese esquema y porque el
 * `create` sigue cerrado a admin; con `/proponer` abierto (paso 9) la defensa no
 * puede ser el framework.
 *
 * `null` cuando no se puede: la pantalla muestra la URL como texto, igual que con
 * el contacto.
 */
export const enlaceDeImagen = (imagen: ImagenPropuesta | null): string | null =>
  imagen && 'url' in imagen ? urlSegura(imagen.url) : null;

/**
 * Una fecha propuesta, para leerla de un vistazo.
 *
 * **No pasa por `new Date`, y eso es la trampa 1 del §13 aplicada al revés**: lo
 * que hay acá son strings de hora de pared (D-590), y darles un `Date` para
 * formatearlos les inventaría una zona —la del navegador del admin— para después
 * leerlos en otra. Reordenar tres pedazos de string no puede correr una fecha un
 * día.
 */
export const fraseDeFechaPropuesta = (f: FechaPropuesta): string => {
  const [a, m, d] = f.dia.split('-');
  const dia = a && m && d ? `${d}/${m}/${a}` : f.dia;
  return f.hasta
    ? `${dia} · ${f.desde} a ${f.hasta}`
    : `${dia} · ${f.desde} (sin hora de fin)`;
};

/**
 * Escucha la bandeja. `onSnapshot` y no una lectura suelta por lo mismo que en
 * `/reportes`: con dos admins mirando, la que uno acaba de aceptar tiene que
 * dejar de estar pendiente en la pantalla del otro sin que nadie recargue.
 */
export const observarPropuestas = (
  cb: (ps: PropuestaConId[]) => void,
  onError: (e: Error) => void,
  cuantas = LIMITE_PROPUESTAS,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('creadoEn', 'desc'), limit(cuantas)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Propuesta), id: d.id }))),
    onError,
  );

/**
 * Cuántas esperan una decisión, para el badge de la cabecera.
 *
 * Query propia y no un `filter` sobre la de arriba: el badge se monta en el
 * listado, donde la bandeja no está abierta. Es un `where` de un solo campo, así
 * que no pide índice compuesto — por eso no lleva `orderBy`, que es justamente lo
 * que lo pediría.
 */
export const observarPendientes = (
  cb: (cuantas: number) => void,
  onError: (e: Error) => void,
): (() => void) =>
  onSnapshot(
    query(
      collection(db(), COL),
      where('estado', 'in', [...ESTADOS_PENDIENTES]),
      limit(LIMITE_PROPUESTAS),
    ),
    (snap) => cb(snap.size),
    onError,
  );

/**
 * Mueve el estado y firma la revisión. Es **la única escritura** del panel sobre
 * una propuesta.
 *
 * `serverTimestamp()` y no la hora del navegador: la regla exige
 * `revision.en == request.time`, así que un reloj adelantado no puede firmar en
 * el futuro (mismo criterio que `creadoEn` en la creación).
 */
export const revisarPropuesta = async (
  id: string,
  uid: string,
  estado: EstadoPropuesta,
  extras: {
    actividadId?: string | null;
    motivo?: string | null;
    fotoDescartada?: boolean;
  } = {},
): Promise<void> => {
  await updateDoc(doc(db(), COL, id), cambioDeRevision(uid, estado, serverTimestamp(), extras));
};
