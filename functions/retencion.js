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
 * **Y hay un flyer que este barrido no alcanza, y lo alcanza el de al lado**
 * (B-871). El original de una propuesta **aceptada** lo borra el trigger de
 * `propuestas-trigger.js` en la transición; si ese borrado no ocurre —no había
 * copia verificada, falló, o la propuesta ya estaba aceptada antes del deploy y
 * la transición no existió— el documento sigue sin vencer (el contacto sirve),
 * pero **la foto sí**: a los 30 días de aceptada la borra
 * `decidirFlyeresSinPlazo` + `borrarFlyer`, que recorren los objetos vivos de
 * `propuestas/` y se llevan también el que ningún documento nombra (D-1160,
 * D-1161). Corre en la misma Function, después de esta retención.
 *
 * **Todo lo de acá es puro** salvo `propuestasVencibles`, `borrarPropuesta` y los
 * lectores y el borrado de los flyers de B-871, que
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
 * `/propuestas`; en Storage, un objeto bajo `propuestas/`, y un `delete()`
 * dispara `onObjectDeleted`, al que nada de este proyecto está suscripto
 * (`optimizarImagen` es `onObjectFinalized`).
 *
 * **Del lado de Firestore sí hay un trigger, y esto decía que no** (corregido
 * con B-871): desde B-863 `borrarImagenAlCerrar` es un
 * `onDocumentWritten` sobre `propuestas/{id}`, que se dispara también en un
 * `delete`. No encadena nada porque su decisión empieza por
 * `if (!after) return nada('propuesta-borrada')`: no borra ni escribe. Pero la
 * razón es ésa, no que la
 * colección esté sola — y la diferencia importa el día que alguien le agregue
 * algo a ese trigger. Mismo argumento que `limpieza-imagenes.js` para Storage.
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
 * Cuántas propuestas trae **cada página** de la query — B-865.
 *
 * Hasta acá la query no llevaba `limit()` y traía la bandeja entera en cada
 * corrida: con B-844 dejó de ser «solo las rechazadas» y pasó a arrastrar
 * también todas las `nueva` y `en-revision`, que son las que **no** se van a
 * borrar. El tope que ya existía recorta el **borrado** y no la **lectura**.
 *
 * ── Por qué un `limit()` a secas habría sido peor que no tenerlo ───────────
 * La query no tiene `orderBy` (pediría índice compuesto), así que el orden es el
 * implícito: por id. Un `limit(50)` pelado lee siempre **las mismas primeras 50
 * por id**, y si esas 50 están dentro de su plazo la corrida no borra nada
 * aunque más adelante en la colección haya una vencida hace meses. O sea: el
 * plazo de retención —que es una promesa sobre el dato personal de un tercero—
 * dejaría de cumplirse **en silencio**, y la suite quedaría verde. Es el mismo
 * modo de falla que `ESTADOS_QUE_CADUCAN` evita del otro lado: la tabla dice que
 * caduca y el barrido no lo trae.
 *
 * Por eso la lectura es **paginada con cursor y se corta por trabajo, no por
 * cantidad leída**: se siguen pidiendo páginas hasta que las candidatas llenan
 * `MAX_PROPUESTAS_POR_CORRIDA` (lo que se va a borrar hoy) o hasta que la
 * colección se termina. Lo que se acota es la memoria y —el día que haya
 * trabajo— la lectura; lo que **no** se acota es la búsqueda: una vencida al
 * final de la colección se encuentra igual.
 *
 * El número no tiene que ser exacto: tiene que ser cómodamente mayor que el tope
 * de borrados para que la corrida normal sea **una sola página**, y chico frente
 * a una bandeja que se llenó de spam. Con 200 y el tope en 50, un día con
 * trabajo lee una página y corta.
 *
 * **Lo que esto NO acota, dicho** (y es el residual de B-865): el día que **no
 * haya nada vencido**, la búsqueda recorre la colección entera igual, porque no
 * hay forma de preguntarle a Firestore «¿cuál venció?» sin un campo
 * denormalizado (`venceEn`) que hoy no existe — el reloj de cada propuesta sale
 * del máximo entre dos campos y de su estado, así que ningún `orderBy` lo
 * ordena. Lo que cambió es la memoria (una página por vez) y el caso con
 * trabajo, que es el que iba a doler.
 */
export const PROPUESTAS_POR_PAGINA = 200;

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
 * ── El nombre del estado rechazado entra por parámetro — B-904/B-912/B-917 ─
 * Las tres guías tienen el **mismo** ciclo (`revision.en` en todo movimiento,
 * `creadoEn` al llegar) y llaman `'rechazado'` a lo que una propuesta llama
 * `'rechazada'`. Un `if` con los dos literales adentro sería una función que
 * trata dos vocabularios como si fueran uno, y el día que una tercera entidad
 * use un tercer nombre el reloj caería al camino de «la última señal de vida»
 * **en silencio** — o sea, alargándole el plazo a un dato personal sin que nada
 * falle. Por eso es un parámetro con default: quien lo llama declara cuál es su
 * estado terminal.
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
export const relojDeRetencion = (p, estadoRechazado = 'rechazada') => {
  const revisada = milisDe(p?.revision?.en);

  if (p?.estado === estadoRechazado) {
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
  estadoRechazado = 'rechazada',
  tope = MAX_PROPUESTAS_POR_CORRIDA,
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

    const reloj = relojDeRetencion(p, estadoRechazado);
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

  if (aBorrar.length <= tope) return { aBorrar, motivos };

  const recortado = aBorrar.slice(0, tope);
  for (const { id } of aBorrar.slice(tope)) {
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
 * ── Y se lee de a páginas, cortando por trabajo (B-865) ───────────────────
 * La query lleva `limit()` desde B-865 y esta función pide páginas hasta que las
 * candidatas llenan el tope de borrados o hasta que la colección se termina. El
 * porqué de las dos mitades —y por qué un `limit()` a secas habría dejado de
 * cumplir el plazo en silencio— está en `PROPUESTAS_POR_PAGINA`. Es también por
 * lo que esta función recibe `ahora` y `plazos`: no decide nada, pero le
 * **pregunta** a la decisión pura cuándo dejar de leer, y tiene que preguntarlo
 * con el mismo reloj con el que el llamador va a decidir después.
 *
 * @param {{ ahora?: number, plazos?: Record<string, number | null> }} [opciones]
 * @returns {Promise<{ id: string, estado: string, creadoEn: unknown, revision: unknown, imagen: unknown, updateTime: unknown }[]>}
 */
export const propuestasVencibles = async (
  db,
  { ahora = Date.now(), plazos = RETENCION_POR_ESTADO } = {},
) => {
  // Un `in` vacío es un error de Firestore, no una query que no devuelve nada.
  // Solo pasa si alguien pone toda la tabla en `null`, que es «no borres nada».
  if (ESTADOS_QUE_CADUCAN.length === 0) return [];

  const base = db
    .collection('propuestas')
    .where('estado', 'in', ESTADOS_QUE_CADUCAN)
    .select('estado', 'creadoEn', 'revision.en', 'imagen.storagePath');

  const leidas = [];
  let desde = null;
  for (;;) {
    /*
     * El cursor va con el **snapshot** de la última leída y no con su id: así el
     * orden lo pone Firestore y no hay que repetirlo acá. Sin `orderBy`
     * explícito el SDK deriva del snapshot el orden implícito por `__name__`,
     * que es el mismo con el que la página vino. Verificado contra el emulador,
     * y fijado por el caso de `retencion.integracion.test.ts` — un doble a mano
     * diría que sí sin haber preguntado.
     */
    const snap = await (desde ? base.startAfter(desde) : base).limit(PROPUESTAS_POR_PAGINA).get();
    for (const d of snap.docs) {
      leidas.push({
        id: d.id,
        estado: d.get('estado'),
        creadoEn: d.get('creadoEn'),
        revision: d.get('revision'),
        imagen: d.get('imagen'),
        // Metadata, no un campo: `d.get(...)` no lo alcanzaría ni haría falta que
        // lo hiciera. Es la versión del documento que **esta** corrida vio.
        updateTime: d.updateTime,
      });
    }

    // Página corta: la colección se terminó. No hace falta pedir una vacía.
    if (snap.size < PROPUESTAS_POR_PAGINA) return leidas;

    /*
     * **El corte es por trabajo y no por cantidad leída** (B-865, ver
     * `PROPUESTAS_POR_PAGINA`). Se llama a la decisión pura —que es barata y no
     * toca la red— para preguntar si lo leído ya llena el tope de borrados de
     * hoy; si lo llena, lo que falta leer no cambiaría nada, porque de todos
     * modos quedaría marcado `-pendiente-por-tope`. El `ahora` entra por
     * parámetro para que sea **el mismo** con el que el llamador va a decidir
     * después: dos relojes distintos podrían cortar acá y no allá.
     */
    const { aBorrar } = decidirRetencion({ propuestas: leidas, ahora, plazos });
    if (aBorrar.length >= MAX_PROPUESTAS_POR_CORRIDA) return leidas;

    desde = snap.docs[snap.size - 1];
  }
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

/**
 * Los estados cuyo **documento** no vence, derivados de la tabla — B-871.
 *
 * Es el complemento exacto de `ESTADOS_QUE_CADUCAN` y se deriva por el mismo
 * motivo: hoy es `['aceptada']` y el día que alguien le ponga un número, esta
 * lista queda vacía sola. Una segunda lista escrita a mano sería la que quedaría
 * vieja.
 *
 * **Habla del documento y no del flyer**, y desde la salida 3 de B-871 la
 * diferencia importa: la `aceptada` sigue sin vencer —el contacto sirve para
 * repreguntar por una actividad publicada—, pero su **foto original** sí tiene
 * plazo (`MARGEN_DEL_ORIGINAL_ACEPTADO_MS`).
 */
export const ESTADOS_SIN_PLAZO = Object.entries(RETENCION_POR_ESTADO)
  .filter(([, plazo]) => plazo === null)
  .map(([estado]) => estado);

/**
 * El estado cuyo flyer original tiene un plazo propio aunque el documento no lo
 * tenga — B-871. Es el nombre que `decidirBorradoDeImagen` y
 * `clasificarAceptadas` (`propuestas.js`) ya usan para el mismo estado.
 */
export const ESTADO_ACEPTADO = 'aceptada';

/**
 * **30 días desde que se aceptó**, y después el flyer original se va — B-871,
 * contestado por el dueño el 2026-09-25 (**D-1160**).
 *
 * ── Qué original es éste ──────────────────────────────────────────────────
 * El que `borrarImagenAlCerrar` **no** borró en la transición a `aceptada`: o
 * porque no había copia verificada en la galería (`sin-copia`,
 * `copia-sin-objeto`, `sin-actividad` — conservarlo fue lo correcto en ese
 * momento), o porque el borrado falló, o porque la propuesta ya estaba aceptada
 * antes del deploy y la transición no existió. Hasta B-871 esa foto de un
 * tercero se quedaba **para siempre**, porque la `aceptada` no vence y ningún
 * barrido recorría `propuestas/`.
 *
 * La respuesta del dueño es que **conservar a propósito no es conservar para
 * siempre**: los 30 días son el margen para decidir si la foto se usa —subirla a
 * la actividad desde el panel, y entonces la borra antes B-1370 con la copia
 * verificada— y después el original se va aunque la actividad siga sin imagen.
 * O sea que en el caso `sin-copia` **se acepta perder la foto** pasado el plazo.
 * Es la mitad de la decisión que no era técnica.
 *
 * ── Da el mismo número que `MARGEN_DE_RETENCION_MS`, y son dos constantes ──
 * El dueño lo dijo como «el mismo plazo que la rechazada», y va igual escrito
 * aparte, por el criterio de `MARGEN_SIN_TOCAR_MS`: aquél es cuánto se guarda
 * **el documento** de una rechazada —el margen de un «la rechacé sin querer»—;
 * éste es cuánto se guarda **una foto** cuya propuesta ya se cerró bien. El día
 * que el dueño alargue el margen de arrepentimiento, eso no dice nada sobre
 * cuánto tiempo se queda la foto de un tercero después de aceptarla.
 * `tests/retencion.test.ts` tiene el aserto sobre el fuente.
 *
 * **Se cuenta desde `revision.en`**, que es cuándo se aceptó: el panel lo
 * escribe en todo movimiento de estado, así que para una `aceptada` es el
 * momento de la última aceptación. Sin fecha legible **no se borra**: falla
 * cerrado, como la rechazada (ver `relojDeAceptacion`).
 */
export const MARGEN_DEL_ORIGINAL_ACEPTADO_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tope de flyers borrados por corrida — B-871. Misma salvaguarda que
 * `MAX_PROPUESTAS_POR_CORRIDA` y `MAX_ORIGINALES_POR_CORRIDA`: una fecha mal
 * leída o un cruce que empate mal no puede vaciar el prefijo en una pasada. Lo
 * que sobra queda marcado `-pendiente-por-tope` y va mañana.
 */
export const MAX_FLYERES_POR_CORRIDA = 50;

/**
 * Cuánto se le perdona a un objeto de `propuestas/` que todavía no tenga
 * documento — B-871.
 *
 * **No es el mismo caso que `MARGEN_DE_GRACIA_MS` de `limpieza-imagenes.js`
 * aunque dé el mismo número**, y va aparte por el mismo criterio con el que
 * `MARGEN_SIN_TOCAR_MS` no se escribe en términos de `MARGEN_DE_RETENCION_MS`:
 * son dos decisiones que hoy coinciden. Allá el margen cubre «el admin subió la
 * imagen y todavía no guardó la actividad»; acá cubre algo peor de mirar, que es
 * cómo está escrito `/proponer`: el flyer se sube **al elegir el archivo** y el
 * documento se escribe **al enviar** (`FormularioPublico`), así que entre las dos
 * cosas hay todo el tiempo que la persona tarde en terminar el formulario. Un
 * objeto sin documento en esa ventana es el estado normal y no un huérfano.
 *
 * **Desde la salida 3 de B-871 este margen protege un borrado** —el docblock
 * anterior avisaba que ese día había que volver a mirarlo, y se miró—: es la
 * única red del caso `sin-propuesta`, que ahora se borra. 72 horas siguen
 * sobrando: nadie deja el formulario de `/proponer` abierto tres días, y si lo
 * hiciera, lo peor es que su propuesta llegue sin flyer. La relectura de
 * `borrarFlyer` achica además la carrera con un envío que llega justo en el
 * medio de la corrida.
 */
export const MARGEN_DEL_FLYER_EN_VUELO_MS = 72 * 60 * 60 * 1000;

/**
 * **Cuándo se aceptó esta propuesta**, en ms. `null` si no es una `aceptada` o
 * si no hay fecha legible — B-871.
 *
 * Es `revision.en` y **nada más**, sin caer a `creadoEn`: el plazo es de la
 * aceptación, y contar desde la llegada sería otro plazo decidido por
 * accidente. Es el mismo corte que `relojDeRetencion` hace con la rechazada, y
 * no se reusa esa función porque su vocabulario (`rechazo`, `ultimo-toque`,
 * `llegada`) nombraría mal lo que se está contando.
 */
export const relojDeAceptacion = (p) =>
  p?.estado === ESTADO_ACEPTADO ? milisDe(p?.revision?.en) : null;

/**
 * **Qué hacer con cada flyer de `propuestas/`**: borrarlo, pedir a alguien, o
 * nada porque otro barrido lo cubre — B-871.
 *
 * El nombre es de cuando esto solo **relevaba** («qué flyer no tiene plazo»), y
 * se conserva porque es la misma decisión, ampliada: desde la salida 3 los dos
 * casos que antes iban a la lista para un humano tienen ahora quien los borre.
 * La usan **la Function y el script**, que es lo que el ítem pedía: el informe
 * en seco dice exactamente lo que la corrida diaria va a hacer.
 *
 * ── Qué agujero tapa ──────────────────────────────────────────────────────
 * El borrado del original de una propuesta **aceptada** ocurre una sola vez, en
 * la transición a `aceptada` (`borrarImagenAlCerrar`), y debajo no había nada:
 * la `aceptada` no vence (`RETENCION_POR_ESTADO`) y `limpiarImagenesHuerfanas`
 * solo recorre `imagenes/` y `miniaturas/`. Si ese borrado no ocurría —falló, o
 * la decisión fue **no** borrar porque no había copia verificada— la foto de un
 * tercero se quedaba ahí para siempre. Y hay un séptimo camino que ni siquiera
 * emite el `warn`: una propuesta que ya estaba en `aceptada` antes del deploy
 * nunca dispara la transición.
 *
 * Esta función mira el mundo al revés que el trigger —los **objetos que
 * existen** en el bucket, no las transiciones— así que alcanza los siete
 * caminos por igual, incluido el que no emitió nada.
 *
 * ── Las tres salidas ──────────────────────────────────────────────────────
 *  - **`aBorrar`** — `aceptada-vencida` (el original de una aceptada, a los 30
 *    días de aceptada: **D-1160**) y `sin-propuesta` (un objeto que ningún
 *    documento nombra, pasada la gracia de 72 horas: **D-1161**).
 *  - **`aRevisar`** — lo que ningún barrido va a borrar y hay que mirar:
 *    `aceptada-sin-fecha-legible`, `sin-fecha-legible` (un estado que caduca
 *    pero que la retención no puede fechar), `<estado>-sin-plazo` (un estado que
 *    la tabla no nombra) y `varias-propuestas`.
 *  - **nada** — `de-una-que-caduca` (la retención se lo lleva con su
 *    documento), `aceptada-dentro-del-plazo`, `recien-subido`,
 *    `fuera-del-alcance`.
 *
 * **La retención de `nueva`, `en-revision` y `rechazada` no cambia**, y eso es
 * lo primero que se mira: si el estado tiene plazo de documento, el flyer se va
 * con el documento y esta función no opina. Por eso el caso de la aceptada va
 * **después** del chequeo de la tabla: el día que la `aceptada` tenga plazo de
 * documento, su flyer pasa solo al camino de la retención.
 *
 * ── `visto` viaja, como en `decidirRetencion` ─────────────────────────────
 * Cada `aBorrar` de una aceptada lleva el `updateTime` que la lectura vio, que
 * es lo que `borrarFlyer` exige antes de tocar el objeto. Acá no se juzga.
 *
 * @param {{
 *   objetos?: { nombre: string, creado?: number }[],
 *   propuestas?: { id: string, estado?: string, creadoEn?: unknown, revision?: unknown, imagen?: unknown, updateTime?: unknown }[],
 *   ahora?: number,
 *   margen?: number,
 *   plazos?: Record<string, number | null>,
 *   plazoDelAceptado?: number,
 *   tope?: number,
 * }} _
 * @returns {{
 *   aBorrar: { objeto: string, propuesta: string | null, visto: unknown, motivo: string }[],
 *   aRevisar: { objeto: string, propuesta: string | null, motivo: string }[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirFlyeresSinPlazo = ({
  objetos = [],
  propuestas = [],
  ahora = Date.now(),
  margen = MARGEN_DEL_FLYER_EN_VUELO_MS,
  plazos = RETENCION_POR_ESTADO,
  plazoDelAceptado = MARGEN_DEL_ORIGINAL_ACEPTADO_MS,
  tope = MAX_FLYERES_POR_CORRIDA,
} = {}) => {
  /*
   * El índice se arma con la **misma** guarda que usa el borrado
   * (`objetoDePropuesta`) y no con el `storagePath` crudo: si un documento
   * nombrara `imagenes/img_x.jpg`, decir que «referencia» ese objeto sería
   * afirmar que el flyer de una actividad publicada está cubierto por un ciclo
   * de vida que no lo cubre.
   *
   * **Hoy no es alcanzable, y va igual** —mismo caso que el `Object.hasOwn` de
   * `decidirRetencion`—: una clave inválida no puede empatar con ningún objeto,
   * porque todo objeto que llega a consultarse ya pasó esta misma guarda unas
   * líneas más abajo. Lo que sostiene la propiedad es el corte del lado del
   * objeto; esto es que las dos mitades digan lo mismo (B-88).
   *
   * **Una lista por objeto y no un solo dueño**, desde que esto borra: con un
   * `Map` de un valor, dos documentos que nombraran el mismo objeto se pisarían
   * y ganaría el último — y si el último fuera una aceptada vencida, se borraría
   * el flyer que una `nueva` todavía muestra en la bandeja. `/proponer` genera
   * un uuid por flyer, así que solo pasa con un documento escrito a mano; por
   * eso no se resuelve, se pide a alguien (`varias-propuestas`).
   */
  const duenias = new Map();
  for (const p of propuestas) {
    const objeto = objetoDePropuesta(p?.imagen);
    if (!objeto) continue;
    const lista = duenias.get(objeto) ?? [];
    lista.push(p);
    duenias.set(objeto, lista);
  }

  const aBorrar = [];
  const aRevisar = [];
  const motivos = {};
  const revisar = (objeto, propuesta, motivo) => {
    motivos[objeto] = motivo;
    aRevisar.push({ objeto, propuesta, motivo });
  };

  for (const o of objetos) {
    const nombre = o?.nombre ?? '';

    if (objetoDePropuesta({ storagePath: nombre }) !== nombre) {
      // Un objeto anidado, o el prefijo pelado. Mismo criterio que
      // `decidirLimpieza`: no se opina de lo que no se entiende — y acá además
      // es lo que impide que un objeto de la galería llegue a `aBorrar`.
      motivos[nombre] = 'fuera-del-alcance';
      continue;
    }

    const lista = duenias.get(nombre) ?? [];

    if (lista.length > 1) {
      revisar(nombre, null, 'varias-propuestas');
      continue;
    }

    const [propuesta] = lista;
    if (propuesta) {
      const plazo = Object.hasOwn(plazos, propuesta.estado) ? plazos[propuesta.estado] : undefined;
      if (typeof plazo === 'number') {
        /*
         * **Tener plazo no alcanza: hace falta poder contarlo** — lo encontró el
         * `auditor-trampas`, y es la clase de B-88 en su forma más cara: dos
         * lugares que derivan por separado la misma pregunta —«¿el barrido va a
         * pasar por este documento?»— y uno de los dos se queda corto.
         * `decidirRetencion` pide un plazo numérico **y** un reloj legible; una
         * propuesta sin fecha legible cae en `sin-fecha-legible` y no se borra
         * nunca, así que su flyer tampoco. Se reusa el mismo motivo que el
         * barrido porque es el mismo hecho visto desde el otro lado.
         *
         * **Y este camino no borra**, a propósito: el flyer de una propuesta que
         * caduca es de la retención, que se lo lleva junto con el documento y en
         * el orden de B-838. Borrarlo acá sería un segundo borrado del mismo
         * objeto en carrera con aquél, y cambiaría la retención de la `nueva`,
         * la `en-revision` y la `rechazada`, que esto no vino a tocar.
         */
        if (relojDeRetencion(propuesta) === null) {
          revisar(nombre, propuesta.id, 'sin-fecha-legible');
          continue;
        }
        motivos[nombre] = 'de-una-que-caduca';
        continue;
      }

      if (propuesta.estado === ESTADO_ACEPTADO) {
        const aceptadaEn = relojDeAceptacion(propuesta);
        if (aceptadaEn === null) {
          /*
           * **Sin fecha de aceptación no se borra** — falla cerrado, como la
           * rechazada sin `revision.en`. No se puede afirmar que pasaron los 30
           * días, y la foto que se borra no vuelve. Va a la lista con su motivo
           * propio (y no con `sin-fecha-legible`) porque el remedio es otro: acá
           * lo que hay que arreglar es `revision.en`, no `creadoEn`, y el
           * pegamento lo loguea con `alerta` para que no dependa de que alguien
           * corra el script.
           */
          revisar(nombre, propuesta.id, 'aceptada-sin-fecha-legible');
          continue;
        }
        if (ahora - aceptadaEn < plazoDelAceptado) {
          // Tiene red: dentro del plazo, y la corrida del día 30 se lo lleva.
          motivos[nombre] = 'aceptada-dentro-del-plazo';
          continue;
        }
        motivos[nombre] = 'aceptada-vencida';
        aBorrar.push({
          objeto: nombre,
          propuesta: propuesta.id,
          visto: propuesta.updateTime,
          motivo: 'aceptada-vencida',
        });
        continue;
      }

      /*
       * Un estado sin plazo que no es la `aceptada`: hoy no existe (la tabla
       * tiene uno solo en `null`, y un estado que no nombra cae acá también). Si
       * nadie le puso plazo, nadie lo va a borrar — y agregar un estado no puede
       * empezar a borrar fotos de rebote.
       */
      revisar(nombre, propuesta.id, `${propuesta.estado}-sin-plazo`);
      continue;
    }

    if (!Number.isFinite(o?.creado) || ahora - o.creado < margen) {
      /*
       * Falla cerrado, igual que `decidirLimpieza`: sin fecha legible se trata
       * como recién subido. Acá el caso normal no es raro —`/proponer` sube el
       * archivo al elegirlo y escribe el documento al enviar— así que un objeto
       * joven sin documento es una persona llenando el formulario.
       */
      motivos[nombre] = 'recien-subido';
      continue;
    }

    /*
     * **Ningún documento lo nombra**, y tampoco es reciente: un `/proponer` que
     * se abandonó después de subir la foto, o la mitad que sobrevivió a un
     * borrado que se cortó (la foto de una persona **sin nada que la
     * referencie**, el punto 4 del inventario). Nadie la va a encontrar desde
     * otro lado, así que se borra (**D-1161**).
     */
    motivos[nombre] = 'sin-propuesta';
    aBorrar.push({ objeto: nombre, propuesta: null, visto: null, motivo: 'sin-propuesta' });
  }

  if (aBorrar.length <= tope) return { aBorrar, aRevisar, motivos };

  for (const { objeto } of aBorrar.slice(tope)) {
    motivos[objeto] = `${motivos[objeto]}-pendiente-por-tope`;
  }
  return { aBorrar: aBorrar.slice(0, tope), aRevisar, motivos };
};

/**
 * Los objetos que hoy existen bajo `propuestas/`.
 *
 * `getFiles` con prefijo y no un listado del bucket entero: lo que este barrido
 * mira es un prefijo chico —los flyers de las propuestas abiertas más lo que
 * quedó colgado— y nunca la galería, que tiene su propio barrido.
 *
 * @returns {Promise<{ nombre: string, creado: number }[]>}
 */
export const flyeresDelBucket = async (bucket) => {
  const [objetos] = await bucket.getFiles({ prefix: PREFIJO_PROPUESTAS });
  return objetos.map((o) => ({
    nombre: o.name,
    // Mismo criterio que `objetosDelBucket` en el barrido de imágenes: si la
    // fecha no se puede leer, `NaN` y la decisión lo trata como recién subido.
    creado: Date.parse(o.metadata?.timeCreated ?? ''),
  }));
};

/** El techo de valores de un `where(…, 'in', …)` de Firestore. */
const MAXIMO_DEL_IN = 30;

/**
 * Las propuestas que nombran **alguno de estos objetos**, con **lo mínimo** para
 * decidir — B-871.
 *
 * ── Se entra por el bucket, y es lo que deja correrlo todos los días ──────
 * Hasta la salida 3 esto leía la colección `/propuestas` **entera** y por eso
 * corría solo a pedido: es la lectura que B-865 sacó del camino diario. Pero lo
 * que la decisión necesita no es la colección: es saber, **para cada objeto
 * vivo**, qué documentos lo nombran. Así que se buscan esos y nada más, de a 30
 * por `in` —el mismo camino que `aceptadasConOriginalVivo` (B-1370)—, y el costo
 * crece con los flyers vivos y no con el archivo histórico. La decisión es la
 * misma: un documento que no nombra ningún objeto vivo no cambiaba nada.
 *
 * Se leen **todos** los estados y no solo la aceptada: lo que hay que poder
 * distinguir es «este objeto lo borra la retención» de «este objeto no lo borra
 * nadie», y de «este objeto no lo nombra nadie», que ahora **se borra** — o sea
 * que un documento que la query no trajera convertiría su flyer en huérfano.
 *
 * El `select` es el de siempre y por el mismo motivo: el contacto de quien
 * propuso **no entra a la memoria** — ni `revision.motivo`, que es una nota
 * interna sobre el trabajo de otra persona, ni `revision.porUid`. **Las dos
 * fechas están en el `select` y no son opcionales**: sin `revision.en` ninguna
 * aceptada se podría fechar (y ninguna se borraría), y sin `creadoEn` la
 * retención diría que ninguna `nueva` se puede fechar. `updateTime` es metadata
 * y no afloja la máscara (B-864).
 *
 * @param {string[]} nombres — ya pasados por la guarda del prefijo.
 * @returns {Promise<{ id: string, estado: string, creadoEn: unknown, revision: unknown, imagen: unknown, updateTime: unknown }[]>}
 */
export const propuestasQueNombran = async (db, nombres) => {
  const leidas = [];
  for (let i = 0; i < nombres.length; i += MAXIMO_DEL_IN) {
    const snap = await db
      .collection('propuestas')
      .where('imagen.storagePath', 'in', nombres.slice(i, i + MAXIMO_DEL_IN))
      .select('estado', 'creadoEn', 'revision.en', 'imagen.storagePath')
      .get();
    for (const d of snap.docs) {
      leidas.push({
        id: d.id,
        estado: d.get('estado'),
        creadoEn: d.get('creadoEn'),
        revision: d.get('revision'),
        imagen: d.get('imagen'),
        updateTime: d.updateTime,
      });
    }
  }
  return leidas;
};

/**
 * La lectura completa y la decisión pura en el medio. Es lo que el informe del
 * script imprime **y** lo que la Function ejecuta — B-871.
 *
 * @returns {Promise<{
 *   aBorrar: { objeto: string, propuesta: string | null, visto: unknown, motivo: string }[],
 *   aRevisar: { objeto: string, propuesta: string | null, motivo: string }[],
 *   motivos: Record<string, string>,
 *   objetos: number,
 * }>}
 */
export const relevarFlyeresSinPlazo = async (db, bucket, { ahora = Date.now() } = {}) => {
  const objetos = await flyeresDelBucket(bucket);
  // Solo se preguntan los que la decisión va a mirar: los demás quedan
  // `fuera-del-alcance` sin importar quién los nombre.
  const nombres = objetos
    .map((o) => o.nombre)
    .filter((n) => objetoDePropuesta({ storagePath: n }) === n);
  const propuestas = await propuestasQueNombran(db, nombres);
  return { ...decidirFlyeresSinPlazo({ objetos, propuestas, ahora }), objetos: objetos.length };
};

/**
 * Borra **un** flyer que la decisión mandó a borrar, si sigue siendo el que se
 * decidió — B-871.
 *
 * ── Dos relecturas distintas, una por cada motivo ─────────────────────────
 * Entre la lectura y este `delete()` pasa la corrida entera, y cada caso tiene su
 * forma de dejar de ser cierto:
 *
 *  - **`aceptada-vencida`** — un admin **reabre** la propuesta, o la vuelve a
 *    aceptar (y le renueva el plazo). Se relee con `fieldMask: []` —`exists` y
 *    `updateTime`, cero campos: el contacto no entra— y se exige la versión que
 *    la lectura vio, como `borrarPropuesta` (B-864). Si el documento **ya no
 *    está**, el objeto quedó sin nadie que lo nombre y se sigue por el camino del
 *    huérfano.
 *  - **`sin-propuesta`** — llega el envío de `/proponer` que subió esa foto hace
 *    más de 72 horas. Se pregunta de nuevo si algún documento la nombra, con
 *    `select()` vacío: solo los ids.
 *
 * Storage no tiene precondición que ponerle a un `delete()` sin generación, así
 * que la ventana que queda es de un round-trip, igual que en la retención. El
 * peor caso está acotado: una propuesta que se reabre **justo** en ese
 * round-trip, pasados los 30 días de aceptada, se queda sin flyer.
 *
 * **La guarda del prefijo se vuelve a aplicar acá** aunque la decisión ya la
 * aplicó: esta función es exportada, corre con el Admin SDK sin pasar por las
 * reglas, y el próximo llamador puede no haber pasado por la decisión. Un path
 * fuera de `propuestas/<un segmento>` es un error de programación y tira — no se
 * clasifica, porque clasificarlo lo dejaría pasar como «uno que no se borró».
 *
 * ── Por qué no es la trampa 3 ni la 12 ────────────────────────────────────
 * Lo único que escribe es un `delete()` en Storage, que emite
 * `onObjectDeleted` —nada del proyecto lo escucha; `optimizarImagen` es
 * `onObjectFinalized`— y no toca ningún documento: ni el de la aceptada, que
 * sigue nombrando un `storagePath` que ya no existe, igual que después del
 * borrado de la transición.
 *
 * @param {{ objeto: string, propuesta: string | null, visto: unknown }} flyer
 * @returns {Promise<'borrado' | 'la-tocaron' | 'lo-nombran'>}
 */
export const borrarFlyer = async (db, bucket, { objeto, propuesta, visto }) => {
  if (objetoDePropuesta({ storagePath: objeto }) !== objeto) {
    throw new Error(
      `borrarFlyer(${objeto}) fuera de ${PREFIJO_PROPUESTAS}<un segmento>: este barrido ` +
        'no borra nada que no sea el flyer de una propuesta (B-871).',
    );
  }

  let huerfano = propuesta === null;
  if (!huerfano) {
    if (!visto) {
      // Falla ruidoso, como `borrarPropuesta`: sin la versión vista, esto se
      // lleva el flyer de una propuesta que un admin acaba de reabrir.
      throw new Error(
        `borrarFlyer(${objeto}) sin la versión vista de ${propuesta}: sin eso este borrado ` +
          'puede llevarse el flyer de una propuesta que un admin acaba de reabrir (B-871).',
      );
    }
    const [ahora] = await db.getAll(db.collection('propuestas').doc(propuesta), {
      fieldMask: [],
    });
    if (ahora.exists && !ahora.updateTime.isEqual(visto)) return 'la-tocaron';
    huerfano = !ahora.exists;
  }

  if (huerfano) {
    const nombrado = await db
      .collection('propuestas')
      .where('imagen.storagePath', '==', objeto)
      .select()
      .limit(1)
      .get();
    if (!nombrado.empty) return 'lo-nombran';
  }

  await bucket.file(objeto).delete({ ignoreNotFound: true });
  return 'borrado';
};

// ─────────────────────────────────────────────────────────────────────────
// B-904 / B-912 / B-917 — la retención de las tres guías
// ─────────────────────────────────────────────────────────────────────────

/**
 * **DEC-13 sin contestar, tres veces más.**
 *
 * `contactoDeQuienCargo` es el mismo dato que el `contacto` de una propuesta —el
 * mail, el WhatsApp o el Instagram de alguien que no está logueado— y hasta acá
 * una ficha `rechazado` lo conservaba **para siempre**: `/librerias`,
 * `/suscripciones` y `/lugares` no tenían ninguna Function. Lo único que había
 * era `allow delete: if esAdmin()`, o sea el borrado a mano, que depende de que
 * alguien se acuerde — justo lo que B-838 decidió no aceptar.
 *
 * Y con los formularios públicos de `/guia/<x>/sumar` el campo pasa de opcional
 * a **obligatorio** (`libreriaPublicaFormSchema` y sus dos hermanos): quien carga
 * desde afuera no vuelve a entrar, así que sin contacto no hay forma de
 * repreguntar. O sea que cada alta anónima trae el dato de un tercero. La
 * excepción del borrado va **antes** que el dato, que es el orden que el dueño
 * fijó en B-843 punto 1.
 *
 * ── Una Function para las tres, y eso lo pedía el ítem ────────────────────
 * «Con tres directorios, lo que corresponde es extender `functions/retencion.js`
 * con la lista de colecciones, no escribir una Function por cada una» (B-904).
 * La lista sale de `COLECCIONES_DE_DIRECTORIO` (`directorios.js`), que ya es
 * quien declara qué guías existen: la cuarta entra a este barrido sola. Es la
 * misma derivación que B-922 acaba de cobrar en `limpieza-imagenes.js`, y por el
 * mismo motivo — una lista escrita a mano es la que queda vieja.
 *
 * ── Y NO borra nada de Storage, que es la diferencia con las propuestas ───
 * Una propuesta guarda su flyer bajo `propuestas/`, un prefijo que
 * `limpiarImagenesHuerfanas` no barre: por eso allá el objeto se borra a mano y
 * las dos mitades tienen que irse juntas. Una ficha de directorio usa el **mismo**
 * `GaleriaEditor` que una actividad, así que sus fotos viven en `imagenes/` y las
 * levanta ese barrido — desde B-922, que es el cambio que lo hizo cierto: hasta
 * entonces no las contaba como referencia y se las llevaba igual. Borrado el
 * documento, la foto queda sin dueño y se va sola a las 72 horas, con margen de
 * gracia y con tope por corrida. Duplicar acá el borrado de Storage sería una
 * segunda implementación de la misma idea, y la que se equivoque de prefijo borra
 * la imagen de una actividad publicada.
 */
export const MARGEN_DE_RETENCION_FICHA_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * **30 días sin que nadie la toque**, para la `pendiente`.
 *
 * Es B-844 aplicado a la bandeja de la Guía, y hace falta por lo mismo: la ficha
 * que llegó por el formulario público, no interesó y quedó ahí conservaría el
 * contacto de quien la cargó sin que ningún reloj la alcance. Con el otro plazo
 * sola, la única forma de que una ficha caduque sería que un admin apretara
 * «Descartar» — que es la dependencia que esto viene a sacar.
 *
 * Da el mismo número que el de arriba y son **dos constantes**, por el mismo
 * argumento que `MARGEN_SIN_TOCAR_MS` desarrolla para las propuestas: son dos
 * decisiones que hoy coinciden, no una. Atarlas con un `=` haría que mover el
 * margen de arrepentimiento moviera cuánto se guarda el contacto de alguien que
 * nunca recibió respuesta.
 */
export const MARGEN_SIN_TOCAR_FICHA_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cuánto se guarda cada estado de una ficha. `null` es «no vence».
 *
 * **`publicado: null` es el único de los tres que no es un plazo, y es una
 * decisión:** una ficha publicada está en el sitio, así que su contacto es lo
 * que deja avisarle a la librería que su ficha existe, corregirle un horario o
 * darla de baja cuando cierra. Es el mismo argumento con el que la propuesta
 * `aceptada` no vence, y tiene su caso propio en los tests para que nadie le
 * ponga un número «por simetría».
 *
 * Los tres nombres son los de `ESTADOS_DIRECTORIO` (`src/lib/directorios.ts`),
 * y eso lo ata un test: dos vocabularios del mismo ciclo de vida se separan sin
 * que nada falle, y acá el síntoma sería silencioso —un estado que la tabla no
 * nombra **no caduca**, así que el plazo deja de correr sin ningún error—.
 */
export const RETENCION_DE_FICHA_POR_ESTADO = {
  rechazado: MARGEN_DE_RETENCION_FICHA_MS,
  pendiente: MARGEN_SIN_TOCAR_FICHA_MS,
  publicado: null,
};

/** El estado terminal de una ficha, que es el que `relojDeRetencion` necesita saber. */
export const ESTADO_RECHAZADO_DE_FICHA = 'rechazado';

/**
 * Los estados que la query trae, **derivados de la tabla**. Mismo motivo que
 * `ESTADOS_QUE_CADUCAN`: escribir la lista al lado era el modo de falla obvio
 * —la tabla dice que caduca, la query no lo trae, no caduca nunca y nada falla—.
 */
export const ESTADOS_DE_FICHA_QUE_CADUCAN = Object.entries(RETENCION_DE_FICHA_POR_ESTADO)
  .filter(([, plazo]) => plazo !== null)
  .map(([estado]) => estado);

/**
 * Tope de fichas borradas por corrida, **por colección**. Misma salvaguarda que
 * `MAX_PROPUESTAS_POR_CORRIDA`: un bug en la lectura no puede vaciar un
 * directorio en una sola pasada. Lo que sobra queda para mañana y lo dice el log.
 */
export const MAX_FICHAS_POR_CORRIDA = 50;

/** Cuántas fichas trae cada página. Mismo criterio que `PROPUESTAS_POR_PAGINA`. */
export const FICHAS_POR_PAGINA = 200;

/**
 * Las fichas de una colección que **pueden** caducar, con lo mínimo para decidir.
 *
 * El `select()` no es una optimización: es lo que hace que el
 * `contactoDeQuienCargo` —el dato personal del tercero— **no entre a la memoria
 * de la Function** ni pueda caer en un log. Es el mismo cuidado que el `select`
 * de `propuestasVencibles`, y acá vale doble porque el documento además trae el
 * motivo del rechazo, que es una nota interna sobre el trabajo de otra persona.
 *
 * La paginación con cursor y el corte **por trabajo y no por cantidad leída**
 * son los de B-865: un `limit()` pelado sobre una query sin `orderBy` lee siempre
 * las mismas primeras N por id, así que una ficha vencida hace meses al final de
 * la colección no se encontraría nunca — y el plazo dejaría de cumplirse en
 * silencio.
 *
 * @returns {Promise<{ id: string, estado?: string, creadoEn?: unknown, revision?: unknown, updateTime?: unknown }[]>}
 */
export const fichasVencibles = async (
  db,
  coleccion,
  { ahora = Date.now(), plazos = RETENCION_DE_FICHA_POR_ESTADO } = {},
) => {
  // Un `in` vacío es un error de Firestore. Solo pasa si alguien pone toda la
  // tabla en `null`, que es «no borres nada».
  if (ESTADOS_DE_FICHA_QUE_CADUCAN.length === 0) return [];

  const base = db
    .collection(coleccion)
    .where('estado', 'in', ESTADOS_DE_FICHA_QUE_CADUCAN)
    .select('estado', 'creadoEn', 'revision.en');

  const leidas = [];
  let desde = null;
  for (;;) {
    const snap = await (desde ? base.startAfter(desde) : base).limit(FICHAS_POR_PAGINA).get();
    for (const d of snap.docs) {
      leidas.push({
        id: d.id,
        estado: d.get('estado'),
        creadoEn: d.get('creadoEn'),
        revision: d.get('revision'),
        // Metadata, no un campo: es la versión que **esta** corrida vio.
        updateTime: d.updateTime,
      });
    }

    if (snap.size < FICHAS_POR_PAGINA) return leidas;

    const { aBorrar } = decidirRetencionDeFichas({ fichas: leidas, ahora, plazos });
    if (aBorrar.length >= MAX_FICHAS_POR_CORRIDA) return leidas;

    desde = snap.docs[snap.size - 1];
  }
};

/**
 * Qué fichas caducaron. Es `decidirRetencion` con la tabla, el estado terminal y
 * el tope de la Guía — **no una segunda decisión**.
 *
 * Que sea un envoltorio y no una copia es el punto: el reloj de «la última señal
 * de vida», el `Object.hasOwn` contra las claves heredadas, el fallar cerrado
 * ante una fecha ilegible y el recorte por tope son propiedades que costaron
 * cuatro ítems de backlog cada una, y una segunda implementación las perdería de
 * a una sin que nada falle.
 *
 * Lo único que no se hereda es la guarda de la imagen, y porque **no aplica**:
 * una ficha no lleva `imagen`, así que `objetoDePropuesta(undefined)` da `null` y
 * la decisión nunca mira Storage — ver el docblock de
 * `MARGEN_DE_RETENCION_FICHA_MS`.
 *
 * @param {{
 *   fichas?: { id: string, estado?: string, creadoEn?: unknown, revision?: unknown, updateTime?: unknown }[],
 *   ahora?: number,
 *   plazos?: Record<string, number | null>,
 * }} _
 * @returns {{
 *   aBorrar: { id: string, objeto: string | null, visto: unknown }[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirRetencionDeFichas = ({
  fichas = [],
  ahora = Date.now(),
  plazos = RETENCION_DE_FICHA_POR_ESTADO,
} = {}) =>
  decidirRetencion({
    propuestas: fichas,
    ahora,
    plazos,
    estadoRechazado: ESTADO_RECHAZADO_DE_FICHA,
    tope: MAX_FICHAS_POR_CORRIDA,
  });

/**
 * Borra una ficha caducada: relectura de metadata, y el `delete` con
 * precondición.
 *
 * ── Las dos guardas de B-864, y acá alcanza con una ──────────────────────
 * La promesa es la misma: entre `fichasVencibles()` y esta línea pasan segundos,
 * y en esos segundos un admin puede reabrir una ficha descartada y ver el plazo
 * renovado. `delete({ lastUpdateTime })` compara y borra en la misma operación,
 * así que sobre el documento la garantía es atómica.
 *
 * Y a diferencia de `borrarPropuesta`, acá **no hay una segunda mitad sin
 * precondición**: no se borra ningún objeto de Storage (ver
 * `MARGEN_DE_RETENCION_FICHA_MS`), así que no existe el final `la-tocaron-tarde`
 * —la ficha rescatada en el último segundo se queda entera— ni la tensión de
 * orden que B-838 tuvo que resolver eligiendo cuál mitad perder.
 *
 * La relectura sí se queda, y con `fieldMask: []`: devuelve `exists` y
 * `updateTime` y **cero campos**, o sea que el contacto del tercero no entra a
 * memoria. Un `ref.get()` traería el documento entero, que es justo lo que el
 * `select` de la query existe para evitar.
 *
 * @returns {Promise<'borrada' | 'la-tocaron' | 'ya-no-esta'>}
 */
export const borrarFicha = async (db, coleccion, { id, visto }) => {
  if (!visto) {
    // Falla ruidoso y no cerrado, como `borrarPropuesta`: es un error de
    // programación del que llama —armó la lista sin pasar por
    // `fichasVencibles`— y sin la versión vista este borrado se lleva puesta una
    // ficha que un admin acaba de reabrir.
    throw new Error(
      `borrarFicha(${coleccion}/${id}) sin la versión vista: sin precondición este ` +
        'borrado puede llevarse una ficha que un admin acaba de tocar (B-864).',
    );
  }

  const ref = db.collection(coleccion).doc(id);
  const [ahora] = await db.getAll(ref, { fieldMask: [] });

  if (!ahora.exists) return 'ya-no-esta';
  if (!ahora.updateTime.isEqual(visto)) return 'la-tocaron';

  try {
    await ref.delete({ lastUpdateTime: visto });
  } catch (e) {
    // El código 9 no distingue «otra versión» de «ya no existe» — ver
    // `FALLO_DE_PRECONDICION`. Acá las dos salidas son benignas y la relectura
    // extra no aportaría nada que cambie una decisión: sin objeto que borrar, no
    // hay ninguna mitad que pueda haber quedado suelta.
    if (e?.code !== FALLO_DE_PRECONDICION) throw e;
    return 'la-tocaron';
  }
  return 'borrada';
};
