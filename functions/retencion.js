/**
 * **B-838 / DEC-13 + B-844 — una propuesta no se guarda para siempre.**
 *
 * Es el paso 11 de la tajada 1, adelantado por decisión del dueño (B-843 punto
 * 1): la excepción del borrado tiene que existir **antes** que el dato, y una
 * propuesta lleva el mail o el WhatsApp de alguien que no está logueado —el
 * primer dato personal de un tercero que el proyecto guarda, y el que B-102 daba
 * por inexistente—.
 *
 * **Dos relojes, y el segundo es de B-844.** A los **30 días** de rechazada se va
 * el documento **y su imagen**, contados desde el rechazo (DEC-13). Y a los **30
 * días sin que nadie la toque** —el mismo número, otro reloj— se va también la
 * `nueva` o la `en-revision`, que es el caso que DEC-13
 * no contestó porque no se le preguntó: la que llegó, no interesó y quedó ahí
 * conservaba el mail o el WhatsApp de una persona **para siempre**, y el único
 * borrado que existía dependía de que un admin apretara «rechazar» —justo lo que
 * la retención automática vino a no depender—. La `aceptada` **no vence**, y eso
 * también es una decisión: ver `RETENCION_POR_ESTADO`.
 *
 * Las dos mitades —documento e imagen— se van juntas, y eso no es prolijidad: es
 * el punto 4 de «las nueve cosas que se rompen en silencio» del inventario. Un
 * objeto que sobrevive a su documento
 * es una foto de una persona **sin nada que la referencie**, así que no hay desde
 * dónde volver a encontrarla para borrarla; y un documento que sobrevive a su
 * objeto muestra un flyer roto en la bandeja.
 *
 * **Y no borra a ciegas** (B-864). El barrido decide al principio de la corrida y
 * borra segundos después; en el medio un admin puede tocar una vencida y ver el
 * plazo renovado. Desde B-864 la versión que la query vio viaja hasta el borrado
 * (`visto`) y el borrado la exige: una relectura de metadata antes de tocar
 * Storage, más `delete({ lastUpdateTime })` sobre el documento. El detalle —por
 * qué son dos guardas y por qué el orden de B-838 se queda como está— en
 * `borrarPropuesta`.
 *
 * **Todo lo de acá es puro** salvo `propuestasVencibles` y `borrarPropuesta`, que
 * reciben el `db` y el `bucket` y no importan `firebase-admin` — mismo criterio
 * que `subcoleccionesHuerfanas` en `limpieza-versiones.js` y `referenciasEnUso`
 * en `limpieza-imagenes.js`, y por el mismo motivo práctico: así el test los
 * importa **de acá** y no del trigger, que arrastra
 * `firebase-functions/scheduler` (B-561). El pegamento vive en
 * `retencion-trigger.js`.
 *
 * ── Por qué NO es un trigger sobre el rechazo ─────────────────────────────
 * Porque el rechazo no es el borrado: DEC-13 pide **30 días**, que es el margen
 * para el «lo rechacé sin querer» —la bandeja ofrece reabrir— y para que quien
 * propuso pueda repreguntar. Un `onDocumentUpdated` que borrara en el acto haría
 * imposible las dos cosas. Es el mismo argumento del margen de rescate de
 * `limpieza-versiones.js`, con otro número.
 *
 * ── Y por qué esto no es la trampa 3 ni la 12 ─────────────────────────────
 * Este barrido corre por reloj y solo **borra**: en Firestore, un documento de
 * `/propuestas`, colección que **ningún trigger escucha**; en Storage, un objeto
 * bajo `propuestas/`, y un `delete()` dispara `onObjectDeleted`, al que nada de
 * este proyecto está suscripto (`optimizarImagen` es `onObjectFinalized`). Sin un
 * trigger del otro lado, no hay con qué encadenarse. Mismo argumento que
 * `limpieza-imagenes.js`.
 *
 * Está probado en `tests/retencion.test.ts` (la decisión) y en
 * `tests/retencion.integracion.test.ts` (las dos mitades del borrado, contra los
 * emuladores de Firestore y de Storage). Y lo que la **bandeja** dice sobre estos
 * plazos —«se borra en 6 días» en la ficha— se cruza contra esta misma decisión
 * en `tests/bandeja-de-propuestas.test.ts`: son dos implementaciones del mismo
 * plazo y no pueden separarse.
 */
import { milisDe } from './calendario.js';

/**
 * 30 días desde el rechazo — **DEC-13**, contestada por el dueño el 2026-09-08.
 *
 * Se cuenta desde `revision.en` (cuándo se rechazó) y no desde `creadoEn`: el
 * plazo es del rechazo, así que una propuesta que estuvo dos meses en la bandeja
 * y recién ayer se rechazó tiene sus treinta días completos.
 *
 * Parámetro con default para que el test simule el vencimiento sin esperar un
 * mes, como `MARGEN_DE_RESCATE_MS` (`05-patrones.md` § «El reloj también es
 * infraestructura»).
 */
export const MARGEN_DE_RETENCION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * **30 días sin que nadie la toque** — B-844, contestado por el dueño el
 * 2026-09-09.
 *
 * Es el segundo plazo, y cubre el caso que DEC-13 no contestó porque no se le
 * preguntó: la propuesta que **nadie miró**. La pregunta se hizo con una
 * hipótesis de 90 días escrita en el código; el dueño la bajó a 30. Queda dicho
 * acá para que dentro de tres meses nadie lo lea como un default que quedó de
 * una plantilla: **es una respuesta, no una suposición.**
 *
 * ── Da el mismo número que `MARGEN_DE_RETENCION_MS`, y son dos constantes ──
 * A propósito, y **no** escrito como `= MARGEN_DE_RETENCION_MS`: eso las ataría
 * y haría que mover una moviera la otra, que es exactamente lo que no puede
 * pasar. Son **dos decisiones que hoy coinciden**, no una:
 *
 *  - aquélla (DEC-13) es el margen de un **arrepentimiento**: cuánto tiempo hay
 *    para deshacer un «la rechacé sin querer» y para que quien propuso
 *    repregunte. Se mide en «cuánto tarda alguien en darse cuenta del error»;
 *  - ésta es cuánto tarda **una bandeja en dejar de mirarse**. Se mide en
 *    «cuánto es razonable que una propuesta espere una respuesta».
 *
 * Nada obliga a que las dos respuestas se muevan juntas: el día que el dueño
 * alargue el margen de rescate porque alguien perdió una propuesta buena, eso no
 * dice nada sobre cuánto se guarda el WhatsApp de quien nunca recibió respuesta.
 *
 * Es el mismo criterio que `MINIMO_DESCRIPCION` en `estadoDelCatalogo.ts`, que
 * no se importa de `LARGO_RESUMEN` aunque los dos números hablen de la misma
 * descripción: «atarlos sería acoplar dos decisiones que no se mueven juntas».
 * `tests/retencion.test.ts` tiene el aserto que lo dice al revés —**hoy son
 * iguales y eso no es una atadura**— para que nadie las una por prolijidad.
 */
export const MARGEN_SIN_TOCAR_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * **Cuánto se guarda cada estado, en un solo lugar** — B-844. `null` es «no
 * vence».
 *
 * Es una tabla y no cuatro `if` desparramados por tres archivos a propósito: el
 * plazo de cada estado se cambia **editando una línea de acá**, y de acá salen
 * también los estados que la query trae (`ESTADOS_QUE_CADUCAN`), así que un
 * cambio no hay que acordarse de replicarlo en el `where`.
 *
 * **Con la respuesta del dueño (30 y 30) hoy hay un solo plazo y dos relojes**,
 * y conviene decirlo porque cambia dónde está la decisión: lo que de verdad
 * distingue a una `rechazada` de una `nueva` ya no es *cuánto* se guarda sino
 * **desde cuándo se cuenta** (`relojDeRetencion`). La tabla se queda igual —los
 * dos números son dos decisiones que hoy coinciden, ver `MARGEN_SIN_TOCAR_MS`, y
 * la `aceptada` sigue necesitando su `null`— pero quien venga a entender esto
 * tiene que mirar el reloj y no los plazos.
 *
 * **`aceptada: null` es lo único de acá que el dueño NO contestó**, y va marcado
 * como tal: contestó el número (30) y nada sobre este estado. El argumento es
 * mío. Ahí el contacto sirve: la
 * actividad existe, está publicada y puede haber que repreguntar por ella —una
 * sede que cambió, un horario—. Borrar el único modo de contactar a quien la
 * propuso a los tres meses de publicarla no protege a nadie: deja al proyecto
 * sin poder avisarle a la persona sobre su propia actividad.
 * `tests/retencion.test.ts` lo tiene como caso propio, y es el aserto que se pone
 * rojo si alguien le pone un número «por prolijidad».
 *
 * **Lo que la decisión NO cubre, y hay que decirlo: la foto.** Al convertir se
 * promueve una **copia** a `imagenes/` y el objeto de `propuestas/` queda —«se
 * lo lleva el ciclo de la propuesta», dice `PropuestasPanel.convertir`—, así que
 * con `aceptada: null` ese ciclo no llega nunca y la imagen de un tercero se
 * queda sin plazo bajo un prefijo que `limpiarImagenesHuerfanas` no barre. Lo
 * señaló el `auditor-privacidad`; va anotado como **B-863** porque el arreglo
 * barato (borrar el original cuando la promoción sale bien) es una decisión y no
 * un renglón.
 */
export const RETENCION_POR_ESTADO = {
  rechazada: MARGEN_DE_RETENCION_MS,
  nueva: MARGEN_SIN_TOCAR_MS,
  'en-revision': MARGEN_SIN_TOCAR_MS,
  aceptada: null,
};

/**
 * Los estados que la query tiene que traer, **derivados de la tabla y no
 * escritos otra vez**.
 *
 * Si mañana la `aceptada` pasa a caducar, alcanza con cambiar su línea de
 * `RETENCION_POR_ESTADO`: el `where('estado','in', …)` la incluye solo. Escribir
 * la lista a mano era el modo de falla obvio —la tabla dice que caduca y la
 * query no la trae, así que no caduca nunca y nada falla—.
 *
 * Es un `in` de **un solo campo** y sin `orderBy`, así que no pide índice
 * compuesto, igual que el `==` que reemplaza.
 */
export const ESTADOS_QUE_CADUCAN = Object.entries(RETENCION_POR_ESTADO)
  .filter(([, plazo]) => plazo !== null)
  .map(([estado]) => estado);

/**
 * Tope de propuestas borradas por corrida. Misma salvaguarda que
 * `MAX_BORRADOS_POR_CORRIDA` y `MAX_ACTIVIDADES_POR_CORRIDA`: un bug en la
 * lectura —una fecha mal leída que haga vencer todo, por ejemplo— no puede
 * vaciar la bandeja en una sola pasada. Lo que sobra queda para mañana y lo dice
 * el log.
 */
export const MAX_PROPUESTAS_POR_CORRIDA = 50;

/**
 * El prefijo de Storage donde vive la imagen de una propuesta (DEC-11).
 *
 * Está escrito acá y en el `matches('^propuestas/…')` de `firestore.rules`, que
 * es el mismo caso que los topes de `types/propuesta.ts`: dos runtimes que no se
 * pueden importar entre sí, atados por un test que lee los dos archivos
 * (`tests/retencion.test.ts`). **Va a ser un tercero** cuando el paso 8 escriba
 * el bloque de `storage.rules`; hoy ese bloque no existe y por eso el test no lo
 * mira — un aserto contra un archivo que no dice nada del prefijo pasaría por
 * ausencia.
 */
export const PREFIJO_PROPUESTAS = 'propuestas/';

/**
 * El objeto que hay que borrar junto con la propuesta, o `null`.
 *
 * ── El `startsWith` no es higiene: es lo que impide borrar el flyer de una
 * actividad publicada ──────────────────────────────────────────────────────
 * Esta Function corre con el **Admin SDK**, así que **no pasa por
 * `firestore.rules`**: el `matches('^propuestas/…')` que valida la escritura no
 * la protege a ella. Un documento escrito antes de esa cláusula, o por un camino
 * futuro que se olvide de validar, puede nombrar `imagenes/img_<uuid>.jpg` de una
 * actividad **real y publicada** — y el path no hay que adivinarlo: viaja adentro
 * de la URL de descarga. Borrarlo deja el sitio con la imagen rota, en vivo, y
 * sin forma de recuperarla.
 *
 * Es exactamente el hallazgo que el `auditor-privacidad` cobró sobre la regla en
 * el paso 5, del lado donde la regla no llega. Dos guardas y las dos hacen falta:
 * el prefijo, y **un solo segmento** debajo de él (`propuestas/../imagenes/x.jpg`
 * empieza con el prefijo y no está adentro).
 */
export const objetoDePropuesta = (imagen) => {
  const path = imagen && typeof imagen === 'object' ? imagen.storagePath : null;
  if (typeof path !== 'string' || !path.startsWith(PREFIJO_PROPUESTAS)) return null;
  const resto = path.slice(PREFIJO_PROPUESTAS.length);
  return resto.length > 0 && !resto.includes('/') ? path : null;
};

/**
 * **Desde cuándo se cuenta el plazo de esta propuesta.** `null` si no hay
 * ninguna fecha legible con la que contar.
 *
 * ── El reloj no es el mismo para los dos plazos, y esa es la decisión ─────
 * B-844 pide el plazo «sin tocar» y dice, en la misma línea, «contados desde
 * `creadoEn`». **Las dos mitades no siempre coinciden, y donde no coinciden gana
 * «sin tocar»**: `revision.en` se escribe en **todo** movimiento de estado
 * —«la estoy mirando», y también **Reabrir**— así que una propuesta que un
 * admin miró la semana pasada y dejó en `en-revision` **no es** una que nadie
 * abrió nunca, aunque las dos hayan llegado hace tres meses. Contar desde
 * `creadoEn` a secas las borraría a las dos el mismo día, y a la mirada del
 * admin la trataría como si no hubiera existido.
 *
 * Entonces el reloj es **la última señal de vida**: `revision.en` si la hay, y
 * `creadoEn` cuando nadie la tocó nunca —que es el estado normal de una `nueva`
 * y el caso que el ítem quiere cubrir—. Se toma el **máximo** y no simplemente
 * el primero que exista, porque lo que importa es cuál es más reciente y no cuál
 * campo está escrito.
 *
 * El caso que lo prueba solo no es teórico: una rechazada que se **reabre** el
 * día 40 vuelve a `nueva` con `creadoEn` de hace más de 30 días. Con el reloj
 * en `creadoEn`, el barrido de esa misma noche se lleva la propuesta que un
 * admin acababa de rescatar a mano — que es exactamente el error que la
 * retención existía para no cometer.
 *
 * ── Menos la `rechazada`, que conserva el suyo (DEC-13) ───────────────────
 * Ahí el plazo **es del rechazo**: `revision.en` y nada más, sin caer a
 * `creadoEn`. Una rechazada sin fecha de revisión legible no se borra a los 30
 * días de haber llegado —eso sería otro plazo, decidido por accidente—: falla
 * cerrado, como antes de B-844.
 *
 * @param {{ estado?: string, creadoEn?: unknown, revision?: unknown }} p
 * @returns {{ ms: number, campo: 'rechazo' | 'ultimo-toque' | 'llegada' } | null}
 */
export const relojDeRetencion = (p) => {
  const revisada = milisDe(p?.revision?.en);

  if (p?.estado === 'rechazada') {
    return revisada === null ? null : { ms: revisada, campo: 'rechazo' };
  }

  const creada = milisDe(p?.creadoEn);
  if (revisada !== null && (creada === null || revisada >= creada)) {
    return { ms: revisada, campo: 'ultimo-toque' };
  }
  return creada === null ? null : { ms: creada, campo: 'llegada' };
};

/**
 * Qué dice el log cuando una vence, según con qué reloj se contó. Son tres
 * situaciones distintas y el log de la corrida es el único lugar donde después
 * se puede reconstruir cuál fue.
 */
const VENCIDA_POR = {
  rechazo: 'rechazada-vencida',
  'ultimo-toque': 'sin-avanzar-vencida',
  llegada: 'sin-mirar-vencida',
};

/**
 * ¿Qué propuestas caducaron?
 *
 * `plazos` entra por parámetro —con la tabla real de default— por lo mismo que
 * el margen entraba antes: un test no puede esperar treinta días
 * (`05-patrones.md` § «El reloj también es infraestructura»).
 *
 * ── `visto` viaja pero no se juzga (B-864) ────────────────────────────────
 * Cada entrada de `aBorrar` lleva el `updateTime` que la query vio, porque es lo
 * que `borrarPropuesta` va a exigir como precondición. Acá **no** se valida: esta
 * función contesta una pregunta temporal —qué caducó— y la versión del documento
 * no es parte de ella. Quien la mira es quien borra, que es donde el dato hace
 * falta y donde su ausencia tiene que ser ruidosa (`borrarPropuesta` tira).
 * Meterlo en la decisión pura además obligaría a que el cruce de fixtures de
 * `bandeja-de-propuestas.test.ts` —que compara plazos y no versiones— arrastrara
 * un campo que no le importa.
 *
 * @param {{
 *   propuestas?: { id: string, estado?: string, creadoEn?: unknown, revision?: unknown, imagen?: unknown, updateTime?: unknown }[],
 *   ahora?: number,
 *   plazos?: Record<string, number | null>,
 * }} _
 * @returns {{
 *   aBorrar: { id: string, objeto: string | null, visto: unknown }[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirRetencion = ({
  propuestas = [],
  ahora = Date.now(),
  plazos = RETENCION_POR_ESTADO,
} = {}) => {
  const aBorrar = [];
  const motivos = {};

  for (const p of propuestas) {
    /*
     * **`Object.hasOwn` y no `plazos[p.estado]` a secas** — lo trajo el
     * `auditor-privacidad`. El `if (p.estado !== 'rechazada') continue` que esto
     * reemplazó era cerrado por construcción; un lookup sobre un objeto literal
     * no lo es. Con `estado: 'constructor'` —o `'toString'`, `'valueOf'`,
     * `'__proto__'`— el valor no es `undefined` **ni** `null`, así que no cae en
     * ninguna de las dos guardas de abajo, y después `ahora - reloj.ms < plazo`
     * compara un número contra una función: `NaN`, `false`, **y la propuesta se
     * borra**.
     *
     * Hoy no es alcanzable —el `where('estado','in',…)` y `firestore.rules`
     * acotan el valor— así que es defensa en profundidad. Va igual porque el
     * caso `estado-<x>` de `tests/retencion.test.ts` afirma que un estado que la
     * tabla no nombra **no caduca**, y sin esto esa propiedad valía para
     * `'archivada'` y no para el medio centenar de claves heredadas.
     */
    const plazo = Object.hasOwn(plazos, p.estado) ? plazos[p.estado] : undefined;

    if (plazo === undefined) {
      /*
       * Un estado que la tabla no nombra. Hoy no existe —son los cuatro de
       * `ESTADOS_PROPUESTA`— y el día que exista un quinto, **no caduca hasta
       * que alguien lo decida**: agregar un estado no puede empezar a borrar
       * documentos de rebote.
       */
      motivos[p.id] = `estado-${p.estado}`;
      continue;
    }

    if (plazo === null) {
      /*
       * **No vence, y es una decisión escrita** (hoy: la `aceptada`). El motivo
       * lo dice con esas palabras y no con `estado-aceptada`, que se leía como
       * «cayó acá porque el filtro no la contemplaba».
       */
      motivos[p.id] = `${p.estado}-no-vence`;
      continue;
    }

    const reloj = relojDeRetencion(p);
    if (reloj === null) {
      /*
       * Falla cerrado, como `decidirPurga` y `decidirLimpieza`: una propuesta que
       * no sabemos fechar es una de la que no se puede afirmar que el plazo
       * venció. Queda en la bandeja y se ve — que es mejor que borrar algo de
       * ayer.
       */
      motivos[p.id] = 'sin-fecha-legible';
      continue;
    }

    if (ahora - reloj.ms < plazo) {
      motivos[p.id] = 'dentro-del-plazo';
      continue;
    }

    const objeto = objetoDePropuesta(p.imagen);
    if (p?.imagen?.storagePath && !objeto) {
      /*
       * **Falla cerrado, y esta guarda la trajo el `auditor-privacidad`.**
       *
       * `objetoDePropuesta` devuelve `null` en dos situaciones que no son la
       * misma: «no hay imagen propia» (bien, no hay nada que borrar) y «hay un
       * `storagePath` que no calza el prefijo» (mal). Sin este corte, el segundo
       * caso borraba **el documento igual** y dejaba el objeto vivo: o sea la
       * foto de una persona sin nada que la nombre, y bajo un prefijo que
       * `limpiarImagenesHuerfanas` **no barre** (solo recorre `imagenes/` y
       * `miniaturas/`). Nadie la vuelve a encontrar nunca.
       *
       * Es el punto 4 de «las nueve cosas que se rompen en silencio» en su peor
       * versión, y la asimetría se veía al lado de `sin-fecha-legible`: ahí un
       * dato ilegible bloquea, acá no bloqueaba. El docblock de
       * `objetoDePropuesta` construye el caso sobre un documento mal escrito y
       * después no lo trataba.
       */
      motivos[p.id] = 'imagen-fuera-del-prefijo';
      continue;
    }

    motivos[p.id] = VENCIDA_POR[reloj.campo];
    // `visto` es la versión que la query trajo — ver el docblock. Pasa de largo,
    // no se juzga acá.
    aBorrar.push({ id: p.id, objeto, visto: p.updateTime });
  }

  if (aBorrar.length <= MAX_PROPUESTAS_POR_CORRIDA) return { aBorrar, motivos };

  const recortado = aBorrar.slice(0, MAX_PROPUESTAS_POR_CORRIDA);
  for (const { id } of aBorrar.slice(MAX_PROPUESTAS_POR_CORRIDA)) {
    motivos[id] = `${motivos[id]}-pendiente-por-tope`;
  }
  return { aBorrar: recortado, motivos };
};

/**
 * Las que **pueden** caducar, con **lo mínimo** para decidir.
 *
 * Ya no son solo las rechazadas (B-844): los estados los pone
 * `ESTADOS_QUE_CADUCAN`, que sale de `RETENCION_POR_ESTADO`. La `aceptada`
 * queda afuera de la query **porque queda afuera de la tabla**, y no porque acá
 * haya una segunda lista que alguien tenga que acordarse de mover.
 *
 * El `select()` no es una optimización: es lo que hace que el contacto de quien
 * propuso —el dato personal del tercero— **no entre a la memoria de la Function**
 * ni pueda terminar en un log por accidente. Lo único que este barrido necesita
 * saber de una propuesta es su estado, cuándo dio su última señal de vida y qué
 * objeto tiene colgado.
 *
 * **Y por eso los dos campos anidados van por su path y no enteros** — lo corrigió
 * el `auditor-privacidad`. `select('revision')` traía también `revision.motivo`
 * («una nota interna sobre el trabajo de otra persona», con su propia fila en
 * `07-seguridad.md`) y `revision.porUid`, que es un uid. No era una fuga —nada de
 * eso se loguea— pero la doc decía «trae lo mínimo» y no lo traía, y la distancia
 * era una línea. Importa además por la trampa del nombre: el log ya tiene una
 * clave `causa`, y con el motivo del rechazo ya en memoria, «enriquecer el log»
 * sería un renglón.
 *
 * **`creadoEn` está en el `select` y eso no es opcional** (B-844): es el reloj de
 * la propuesta que nadie tocó, y un campo que la query no pide vuelve
 * `undefined`, así que `relojDeRetencion` lo leería como «sin fecha legible» y
 * **ninguna `nueva` caducaría jamás**, en silencio y con la suite en verde. Es
 * la clase de bug que este `select` acotado trae de regalo: lo que se agrega a
 * la lógica hay que agregarlo también acá.
 *
 * El `where('estado','in', …)` es de un solo campo, así que no pide índice
 * compuesto — por eso tampoco lleva `orderBy`, que sí lo pediría.
 *
 * ── `updateTime` es la sexta clave, y **no** afloja el `select`** (B-864) ──
 * Es **metadata del snapshot**, no un campo del documento: viaja en la respuesta
 * de Firestore aunque la máscara no pida nada, y por eso pedirlo no agrega ni un
 * campo del documento a la memoria de la Function. El `select` sigue trayendo
 * exactamente lo mismo que traía; lo que cambia es que ahora también se **guarda**
 * la versión que esta corrida vio, que es lo que `borrarPropuesta` va a exigir
 * como precondición.
 *
 * Sin esto el barrido borra «el id que decidí hace un rato», sin condición: entre
 * esta query y el `delete()` un admin puede apretar «la estoy mirando» sobre una
 * vencida, ver el plazo renovado en Firestore y **perder el documento igual**.
 * B-844 ensanchó esa carrera de «solo las rechazadas» a toda la bandeja pendiente
 * y le puso enfrente la promesa que la vuelve intolerable: «moverla de estado le
 * renueva el plazo».
 *
 * @returns {Promise<{ id: string, estado: string, creadoEn: unknown, revision: unknown, imagen: unknown, updateTime: unknown }[]>}
 */
export const propuestasVencibles = async (db) => {
  // Un `in` vacío es un error de Firestore, no una query que no devuelve nada.
  // Solo pasa si alguien pone toda la tabla en `null`, que es «no borres nada».
  if (ESTADOS_QUE_CADUCAN.length === 0) return [];

  const snap = await db
    .collection('propuestas')
    .where('estado', 'in', ESTADOS_QUE_CADUCAN)
    .select('estado', 'creadoEn', 'revision.en', 'imagen.storagePath')
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    estado: d.get('estado'),
    creadoEn: d.get('creadoEn'),
    revision: d.get('revision'),
    imagen: d.get('imagen'),
    // Metadata, no un campo: `d.get(...)` no lo alcanzaría ni haría falta que lo
    // hiciera. Es la versión del documento que **esta** corrida vio.
    updateTime: d.updateTime,
  }));
};

/**
 * El código gRPC de `FAILED_PRECONDITION`.
 *
 * **Y dice menos de lo que parece, que es el hallazgo del `auditor-trampas`.**
 * La primera versión de este comentario afirmaba que en un
 * `delete({ lastUpdateTime })` sólo puede significar «la versión no era la
 * esperada», y es falso: Firestore devuelve **el mismo código** cuando el
 * documento **ya no existe** (se verificó contra el emulador — el mensaje habla
 * de `the stored version … does not match` en los dos casos). O sea que el
 * código solo no distingue «un admin la tocó» de «otra corrida ya se la llevó
 * entera», y son dos finales distintos con dos logs distintos. Por eso el
 * `catch` vuelve a preguntar por la existencia en vez de suponer.
 *
 * El caso de las dos corridas no es teórico: el trigger corre por reloj **y**
 * `scripts/borrar-propuestas-vencidas.mjs` se corre a mano, que es el uso que
 * `08-operacion.md` describe como normal.
 */
const FALLO_DE_PRECONDICION = 9;

/**
 * Borra una propuesta caducada: **la relectura primero, después el objeto,
 * después el documento** — y el documento con precondición.
 *
 * ── Lo que estaba y por qué no alcanzaba (B-864) ──────────────────────────
 * Esto hacía `delete()` con el id que se decidió al principio de la corrida,
 * **sin condición**. Entre `propuestasVencibles()` y esta línea pasan segundos, y
 * en esos segundos un admin puede apretar «la estoy mirando» sobre una vencida:
 * ve el plazo renovado en Firestore y **pierde el documento igual**. B-844 ensanchó
 * esa carrera de «solo las rechazadas» a toda la bandeja pendiente y le puso
 * enfrente la promesa que la vuelve intolerable —«moverla de estado le renueva el
 * plazo»—, así que el barrido tiene que poder decir «no la borro, la tocaron».
 *
 * ── Por qué son DOS guardas y no una, y ahí está la decisión ──────────────
 * Porque son **dos almacenes con capacidades distintas**, no cinturón y tiradores:
 *
 *  - **Firestore tiene precondición.** `delete({ lastUpdateTime })` compara y
 *    borra en la misma operación, así que sobre el documento la garantía es
 *    atómica y no hay ventana. Es la única forma de cumplir la promesa de B-844
 *    de verdad.
 *  - **Storage no tiene ninguna.** No hay `lastUpdateTime` que ponerle a
 *    `file().delete()`, y el objeto se borra **antes** que el documento (la
 *    decisión de B-838, abajo). O sea que con la precondición sola, una propuesta
 *    rescatada en el último segundo conservaría el documento y **perdería el
 *    flyer**: el huérfano que B-838 eligió como «el menos malo», cayendo justo
 *    sobre la que un admin acaba de salvar. Al objeto solo se lo puede proteger
 *    **no llegando hasta él**, y para eso está la relectura.
 *
 * La relectura no elimina la carrera —entre ella y el `delete` del objeto queda
 * un viaje de ida y vuelta—, la **reduce de la corrida entera a un round-trip**.
 * Eso importa porque la ventana real que este ítem ataca no es de microsegundos:
 * la query trae hasta 50 documentos y cada uno se procesa con su borrado de
 * Storage en el medio, así que el último de la lista se borra segundos después de
 * haber sido leído. Lo que queda es la cuarta forma de perder la mitad del
 * borrado, y está nombrada abajo.
 *
 * ── Lo que NO se cambió: el orden de B-838 ────────────────────────────────
 * El objeto sigue yendo **primero** y el documento después. Se evaluó invertirlo
 * cuando hay precondición —así una precondición que falla no toca nada— y no se
 * hizo: eso hace catastrófico el fallo **más probable**. Un `delete` de Storage
 * que falla por transitorio es un viaje de red que falla; una precondición que
 * falla son segundos por día. Con el documento borrado primero, el transitorio de
 * Storage deja la foto de una persona **sin nada que la nombre** —`propuestas/`
 * no lo barre nadie (B-221 solo recorre `imagenes/` y `miniaturas/`)— y sin
 * documento no hay corrida de mañana que reintente. El orden se queda donde
 * estaba, la guarda nueva se pone **arriba de los dos**, y `retencion.test.ts`
 * fija ahora las tres posiciones.
 *
 * ── Los cuatro finales ────────────────────────────────────────────────────
 *  - `'borrada'`      — las dos mitades se fueron.
 *  - `'la-tocaron'`   — la relectura vio otra versión. **No se tocó nada**: ni el
 *                       documento ni la foto. Es el final que este ítem existe
 *                       para producir.
 *  - `'ya-no-esta'`   — el documento ya no está (una corrida anterior murió en el
 *                       medio, o corrieron dos). Se llega por los **dos**
 *                       caminos: la relectura de arriba, y la precondición que
 *                       corta porque otra corrida lo borró en el medio. El objeto **sí** se borra: sin
 *                       documento que lo nombre es exactamente el huérfano
 *                       imposible de encontrar después, y acá todavía tenemos el
 *                       path en la mano y pasado por las dos guardas del prefijo.
 *  - `'la-tocaron-tarde'` — la precondición cortó el `delete` del documento, pero
 *                       el objeto ya no estaba. Es la cuarta forma de perder la
 *                       mitad, cae del lado tolerado por B-838 (documento vivo,
 *                       flyer roto, se ve en la bandeja) y el trigger la loguea
 *                       como `warn` porque cae sobre una propuesta rescatada.
 *
 * `ignoreNotFound` sigue siendo lo que hace que el reintento funcione: si el
 * objeto ya no está —porque la corrida anterior murió justo en el medio— borrarlo
 * de nuevo no es un error, es el estado que se quería.
 *
 * @param {{ id: string, objeto: string | null, visto: unknown }} caducada
 * @returns {Promise<'borrada' | 'la-tocaron' | 'ya-no-esta' | 'la-tocaron-tarde'>}
 */
export const borrarPropuesta = async (db, bucket, { id, objeto, visto }) => {
  if (!visto) {
    /*
     * **Falla ruidoso y no cerrado, que es la excepción de este archivo.**
     * `sin-fecha-legible` e `imagen-fuera-del-prefijo` son datos del documento
     * que pueden venir mal y se clasifican; esto es un **error de programación**
     * del que llama —armó la lista sin pasar por `propuestasVencibles`— y
     * clasificarlo lo dejaría pasar como «una que no se borró». Sin la versión
     * vista este borrado es el de antes de B-864, o sea el que se lleva puesta
     * una propuesta que un admin acaba de rescatar.
     */
    throw new Error(
      `borrarPropuesta(${id}) sin la versión vista: sin precondición este borrado ` +
        'puede llevarse una propuesta que un admin acaba de tocar (B-864).',
    );
  }

  const ref = db.collection('propuestas').doc(id);

  /*
   * **La relectura, y trae metadata y nada más.** `fieldMask: []` devuelve el
   * snapshot con `exists` y `updateTime` y **cero campos**: sin esto, un
   * `ref.get()` traería el documento entero y con él el contacto del tercero,
   * que es exactamente lo que el `select` de `propuestasVencibles` existe para
   * evitar. Un `runTransaction` tendría el mismo problema —y encima no puede
   * abarcar el borrado de Storage, así que no resolvería la tensión del orden—.
   */
  const [ahora] = await db.getAll(ref, { fieldMask: [] });

  if (!ahora.exists) {
    if (objeto) await bucket.file(objeto).delete({ ignoreNotFound: true });
    return 'ya-no-esta';
  }

  if (!ahora.updateTime.isEqual(visto)) return 'la-tocaron';

  if (objeto) await bucket.file(objeto).delete({ ignoreNotFound: true });
  try {
    await ref.delete({ lastUpdateTime: visto });
  } catch (e) {
    if (e?.code !== FALLO_DE_PRECONDICION) throw e;
    /*
     * **Una relectura más, y solo en este camino** (`auditor-trampas`). El
     * código 9 no distingue «otra versión» de «ya no existe», y la diferencia es
     * la que decide el log: `la-tocaron-tarde` afirma que **una propuesta viva
     * quedó con el flyer roto**, y si el documento se lo llevó otra corrida no
     * hay nada que rescatar ni nadie a quien avisarle — el operador iría a
     * buscar una propuesta que no está. Cuesta un viaje extra en un camino que
     * casi nunca se toma.
     */
    const [despues] = await db.getAll(ref, { fieldMask: [] });
    return despues.exists ? 'la-tocaron-tarde' : 'ya-no-esta';
  }
  return 'borrada';
};
