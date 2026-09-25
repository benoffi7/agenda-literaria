/**
 * **La retención de las propuestas, la decisión pura** — B-838 / DEC-13 + B-844.
 *
 * Los plazos por estado, los dos relojes y `decidirRetencion`. No recibe `db` ni
 * `bucket`: la lectura y el borrado viven en `retencion-propuestas-firestore.js`,
 * y el porqué de todo el ciclo en el docblock de `retencion.js` (B-1960, M-13 del
 * PRD 6).
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
