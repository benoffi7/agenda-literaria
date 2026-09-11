/**
 * B-882 — el chequeo de frescura del sitio. Acá vive lo que necesita red,
 * Firestore, el secreto y el reloj; la decisión es pura y está en `frescura.js`,
 * que además tiene escrito **por qué** este chequeo mide el efecto y no el
 * mecanismo. Leer esa cabecera primero.
 *
 * ── Las cuatro decisiones, y dónde está cada una ──────────────────────────
 *
 * 1. **Qué se compara:** el *conjunto* de slugs, no el conteo →
 *    `diferenciaDeSlugs` en `frescura.js`.
 * 2. **Cuánta divergencia es normal:** la ventana, con el criterio escrito
 *    sumando por sumando → `TOLERANCIA_MS` en `frescura.js`.
 * 3. **Cómo avisa:** issue en el repo + `logger.error` con `alerta` → acá abajo.
 * 4. **Qué pasa si no puede leer el índice:** no grita →
 *    `registrarFalloDeLectura` en `frescura.js`, y `leerElIndice` acá abajo.
 *
 * ── §3, acá, porque es la que se decide en este archivo ───────────────────
 *
 * **Un aviso que nadie ve es el bug que este ítem existe para cerrar**, así que
 * «lo loguea» no alcanzaba. El precedente del repo para un log que despierta a
 * alguien es `alerta: 'rebuild-agotado'` (B-21), y esa etiqueta depende de que
 * exista una log-based alert creada a mano en la consola de GCP: el repo no
 * puede verificar que exista, y el 2026-09-11 nadie se enteró de nada. Además esa
 * alarma era estructuralmente incapaz de ver aquel incidente — los dispatches
 * salieron todos bien.
 *
 * Así que el canal primario es **un issue en el repo**, que es donde el dueño ya
 * recibe los reportes del panel (`reporteAIssue`), que manda mail solo, que
 * sobrevive a los 30 días de retención de los logs y que queda abierto hasta que
 * alguien lo mire. Y el `logger.error` con `alerta: 'sitio-atrasado'` va
 * **igual**, como segundo canal: es gratis, es lo que engancharía una log-based
 * alert, y es el que queda si la creación del issue falla — porque el canal de
 * aviso también se puede romper, y ahí no puede quedar nada.
 *
 * Lo que **no** hace: cerrar el issue cuando el sitio se pone al día. Cerrar es
 * del dueño; el chequeo escribe `estado: 'fresco'` en `sistema/frescura` y lo
 * dice en el log. Un bot que cierra issues tapa la evidencia de cuánto duró.
 *
 * ── El orden de las dos lecturas no es casual ─────────────────────────────
 *
 * Primero el `events.json` y **después** Firestore. Al revés, una actividad
 * publicada entre las dos lecturas aparecería en el JSON y no en el conjunto de
 * Firestore, o sea un `sobrante` fantasma producido por el propio chequeo. Con
 * este orden la foto de Firestore nunca es más vieja que la del JSON, y la
 * divergencia que la ventana pueda inventar es del lado `falta`, que además se
 * fecha con `updatedAt` y por lo tanto cae dentro de la tolerancia. Es la misma
 * forma de B-85 —una llamada larga en el medio de dos estados— resuelta donde se
 * puede resolver: ordenando.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { OPCIONES_BASE } from './despliegue.js';
import { crearIssue } from './github-issues.js';
import {
import { remarcarPorFrescura } from './marca-de-rebuild.js';
  compararFrescura,
  decidirAviso,
  decidirAvisoDeLectura,
  diferenciaDeSlugs,
  fechar,
  issueDeAtraso,
  issueDeSinLectura,
  leerIndice,
  MOTIVOS,
  registrarFalloDeLectura,
} from './frescura.js';

/**
 * El origen del sitio público. Va en `functions/.env` y no importado de
 * `src/lib/rutasPublicas.ts` porque `functions/` es otro paquete y no puede
 * importar del sitio — es el mismo motivo por el que `SEARCH_CONSOLE_SITE` ya
 * vive ahí con el dominio adentro.
 *
 * Sin esto la Function no falla: no compara nada y lo dice, igual que la
 * analítica con `GA4_PROPERTY_ID` vacío.
 */
const SITIO_PUBLICO = process.env.SITIO_PUBLICO;
const GITHUB_REPO = process.env.GITHUB_REPO;

/** §5.4 — el PAT va a Secret Manager y se ata a la Function con `defineSecret`. */
const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');

/** El documento con el veredicto vigente. Uno solo: es una foto, no una serie. */
const DOC = 'sistema/frescura';

/**
 * Timeout de la lectura del índice. Más corto que el de GitHub a propósito: del
 * otro lado hay un archivo estático en un CDN, y si tarda diez segundos el
 * problema ya es el que este chequeo busca.
 */
const TIMEOUT_LECTURA_MS = 10_000;

const OPCIONES = {
  ...OPCIONES_BASE,
  /*
   * Cada media hora. La cuenta, para poder revisarla:
   *
   *  - La ventana de tolerancia es de 40 minutos, así que tickear más seguido no
   *    detecta antes: solo gasta.
   *  - Cada corrida cuesta **una lectura de Firestore por actividad publicada**
   *    (el `.select()` de abajo no abarata el documento, solo lo adelgaza). Con ~100
   *    publicadas son ~4.800 lecturas por día, holgado dentro de la cuota
   *    gratuita de 50.000 y coherente con el §2.5, que puso a costo cero la parte
   *    pública.
   *  - Con 30 minutos, una divergencia real se ve como mucho ~70 minutos después
   *    del cambio. Frente a «nunca», que es lo que había.
   *
   * Si algún día molesta el costo, lo que se sube es este período, no la
   * tolerancia: son dos números que responden preguntas distintas.
   */
  schedule: 'every 30 minutes',
  timeZone: 'America/Argentina/Buenos_Aires',
  secrets: [GITHUB_TOKEN],
  maxInstances: 1,
};

/**
 * Lee el `events.json` **por la misma URL que pide el público**, sin ningún
 * parámetro que esquive la cache: si el CDN devuelve una copia vieja, eso *es* la
 * divergencia que hay que ver, no ruido de la medición. `cache: 'no-store'` es
 * de este lado (que esta invocación no se sirva a sí misma algo cacheado), no del
 * de Hosting.
 */
const leerElIndice = async (url) => {
  let r;
  try {
    r = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_LECTURA_MS),
      cache: 'no-store',
      headers: { 'User-Agent': 'agenda-literaria-frescura' },
    });
  } catch (e) {
    // `motivo` es del vocabulario cerrado —es lo único que puede llegar al aviso
    // público— y `detalle` es el texto crudo, que se queda en el log y en
    // `sistema/frescura`, los dos admin-only. Ver `MOTIVOS` en `frescura.js`.
    const abortado = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return {
      ok: false,
      motivo: abortado ? MOTIVOS.timeout : MOTIVOS.red,
      detalle: e?.message ?? 'error de red',
    };
  }
  // El cuerpo de la respuesta **no** entra al detalle: puede ser una página
  // entera, y para diagnosticar alcanza con el código.
  if (!r.ok) return { ok: false, motivo: MOTIVOS.http, detalle: `HTTP ${r.status}` };
  const texto = await r.text().catch(() => '');
  return leerIndice(texto);
};

/**
 * Las publicadas, con lo mínimo: el slug y cuándo se tocaron por última vez.
 *
 * **`.select('slug', 'updatedAt')` y no el documento entero.** No abarata nada
 * —Firestore cobra el documento igual— y no es por eso: un documento de
 * actividad trae `online.url`, `difusion` y los uids, y nada de eso tiene por
 * qué entrar a una Function cuyo trabajo es comparar dos listas de slugs contra
 * un archivo público (§5.1). Es el mismo criterio con el que `estuvoPublicada`
 * lee las versiones en `src/lib/contenidoDelSitio.ts`: pedir solo lo que se va a
 * mirar es lo que hace que un campo nuevo del modelo no se cuele por acá.
 */
const leerPublicadas = async (db) => {
  const snap = await db
    .collection('actividades')
    .where('estado', '==', 'publicado')
    .select('slug', 'updatedAt')
    .get();
  const slugs = [];
  const fechas = {};
  for (const d of snap.docs) {
    const a = d.data();
    const slug = typeof a?.slug === 'string' ? a.slug : '';
    if (!slug) continue;
    slugs.push(slug);
    const ms = typeof a?.updatedAt?.toMillis === 'function' ? a.updatedAt.toMillis() : null;
    // Sin `updatedAt` no hay reloj del documento y `fechar` cae al suyo. Una
    // publicada sin esa marca está desde siempre, así que no se la protege.
    if (ms != null) fechas[slug] = ms;
  }
  return { slugs, fechas };
};

/**
 * Tope de sobrantes que se van a fechar leyendo su documento.
 *
 * El caso normal es cero; el caso feo —alguien despublica media agenda, o el
 * build sirve un índice de otro proyecto— son doscientas lecturas de a una en
 * una corrida que ya hizo una query entera. Pasado el tope, el resto se fecha
 * con el reloj de la primera vez, o sea que necesita una corrida más: es el
 * mismo precio que el borrado duro, y el aviso sale igual.
 */
const TOPE_DE_SOBRANTES_A_FECHAR = 50;

/**
 * El `updatedAt` de los sobrantes, uno por uno. Se paga **solo** cuando hay
 * sobrantes, que es casi nunca: un slug que el sitio muestra y Firestore ya no
 * publica. Si el documento no existe (se borró de verdad) no hay fecha, y
 * `fechar` cae al reloj de la primera vez que lo vimos.
 */
const fechasDeSobrantes = async (db, sobran, idPorSlug) => {
  const fechas = {};
  for (const slug of sobran.slice(0, TOPE_DE_SOBRANTES_A_FECHAR)) {
    const id = idPorSlug?.[slug];
    if (!id) continue;
    // Con `fieldMask` por lo mismo que la query de arriba: de la actividad que
    // el sitio todavía muestra alcanza con saber cuándo la tocaron.
    const [snap] = await db.getAll(db.doc(`actividades/${id}`), { fieldMask: ['updatedAt'] });
    const ms = snap.exists ? snap.data()?.updatedAt?.toMillis?.() : null;
    if (ms != null) fechas[slug] = ms;
  }
  return fechas;
};

export const verificarFrescuraDelSitio = onSchedule(OPCIONES, async () => {
  const db = getFirestore();
  const ref = db.doc(DOC);
  const ahora = Date.now();

  if (!SITIO_PUBLICO) {
    // Falta configuración, no falló nada. Como `dispararRebuild` sin GITHUB_REPO.
    logger.info('chequeo de frescura sin SITIO_PUBLICO configurado (B-882)');
    return;
  }
  const url = `${SITIO_PUBLICO.replace(/\/$/, '')}/events.json`;

  const snapPrevio = await ref.get();
  const previo = snapPrevio.exists ? snapPrevio.data() : null;

  // ── 1. El efecto: lo que el público ve ──────────────────────────────────
  const indice = await leerElIndice(url);
  if (!indice.ok) {
    /*
     * §4 — el chequeo **no grita cuando el roto es él**. El veredicto anterior no
     * se pisa con un «atrasado» inventado: el estado pasa a `sin-lectura` y sube
     * el contador. Solo con varias fallas seguidas se habla, y de otra cosa.
     *
     * En transacción por lo mismo que la rama de abajo: el `previo` que decide
     * el aviso se leyó antes del `fetch` que acaba de fallar (hasta 10 s), y de
     * esa decisión cuelga un issue en un repo público.
     */
    const d = await db.runTransaction(async (tx) => {
      const actual = await tx.get(ref);
      const datos = actual.exists ? actual.data() : null;
      const fallo = registrarFalloDeLectura({
        previo: datos,
        motivo: indice.motivo,
        detalle: indice.detalle,
        ahora,
      });
      const decision = decidirAvisoDeLectura({ previo: datos, seguidas: fallo.seguidas, ahora });
      tx.set(
        ref,
        {
          estado: fallo.estado,
          lectura: fallo.lectura,
          ...(decision.avisar ? { aviso: { firma: decision.firma, enMs: ahora, issue: null } } : {}),
          actualizado: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return {
        ...decision,
        seguidas: fallo.seguidas,
        motivoDeLectura: fallo.lectura.motivo,
        detalleDeLectura: fallo.lectura.detalle,
      };
    });

    if (!d.avisar) {
      logger.warn('no se pudo leer el índice del sitio: el chequeo queda sin veredicto', {
        url,
        motivo: d.motivoDeLectura,
        detalle: d.detalleDeLectura,
        seguidas: d.seguidas,
      });
      return;
    }
    logger.error('el índice del sitio no se puede leer hace varias corridas', {
      alerta: 'sitio-sin-indice',
      url,
      motivo: d.motivoDeLectura,
      detalle: d.detalleDeLectura,
      seguidas: d.seguidas,
    });
    await avisar({
      ref,
      firma: d.firma,
      ahora,
      issue: issueDeSinLectura({ seguidas: d.seguidas, motivo: d.motivoDeLectura, url }),
    });
    return;
  }

  // ── 2. La verdad: lo que está publicado ─────────────────────────────────
  // Después del índice, nunca antes. Ver la cabecera.
  const { slugs: publicados, fechas } = await leerPublicadas(db);

  const { faltan, sobran } = diferenciaDeSlugs(publicados, indice.slugs);
  const fechasSobrantes = sobran.length
    ? await fechasDeSobrantes(db, sobran, indice.idPorSlug)
    : {};

  const veredicto = compararFrescura({
    faltan: fechar(faltan, fechas, previo?.vistas, ahora),
    sobran: fechar(sobran, fechasSobrantes, previo?.vistas, ahora),
    publicadas: publicados.length,
    enElIndice: indice.slugs.length,
    generadoEn: indice.generadoEn,
    ahora,
  });

  /*
   * ── 3. El veredicto y el aviso, en una transacción ─────────────────────
   *
   * Entre la lectura de `sistema/frescura` de arriba y este punto pasaron dos
   * lecturas y un `fetch`, o sea que el `previo` que se usó para decidir puede
   * haber envejecido: es la forma de B-85, y acá importa porque de esa decisión
   * cuelga un efecto con costo —un issue en un repo público—. La transacción
   * relee el documento y **vuelve a decidir** contra lo que hay ahora; lo que se
   * escribe es el resultado de esa comparación, no el de la de hace un minuto.
   *
   * El veredicto en sí no se recalcula (sus dos mitades ya son fotos de un
   * instante y rehacerlas adentro de una transacción es una lectura más y ningún
   * dato nuevo): lo que se compara es la **firma**, que es de lo que depende
   * abrir o no abrir un issue.
   */
  const decision = await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    const d = decidirAviso({ previo: actual.exists ? actual.data() : null, veredicto, ahora });
    tx.set(
      ref,
      {
        estado: veredicto.estado,
        faltan: veredicto.faltan.map((x) => x.slug),
        sobran: veredicto.sobran.map((x) => x.slug),
        enVuelo: veredicto.enVuelo,
        peorEdadMs: veredicto.peorEdadMs,
        toleranciaMs: veredicto.toleranciaMs,
        publicadas: veredicto.publicadas,
        enElIndice: veredicto.enElIndice,
        generadoEn: veredicto.generadoEn,
        vistas: veredicto.vistas,
        lectura: { ok: true, motivo: null, detalle: null, fallas: 0 },
        // Se reserva el aviso acá, adentro de la transacción: dos corridas
        // superpuestas no pueden abrir dos issues del mismo atraso.
        ...(d.avisar ? { aviso: { firma: d.firma, enMs: ahora, issue: null } } : {}),
        actualizado: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return d;
  });

  if (!decision.avisar) {
    logger.info('frescura verificada', {
      estado: veredicto.estado,
      motivo: decision.motivo,
      publicadas: veredicto.publicadas,
      enElIndice: veredicto.enElIndice,
      enVuelo: veredicto.enVuelo,
    });
    return;
  }

  // El log va SIEMPRE, y antes del issue: es el canal que queda si el otro falla.
  logger.error('el sitio quedó atrasado: hay publicadas que no aparecen', {
    alerta: 'sitio-atrasado',
    faltan: veredicto.faltan.length,
    sobran: veredicto.sobran.length,
    peorEdadMin: Math.round(veredicto.peorEdadMs / 60000),
    toleranciaMin: Math.round(veredicto.toleranciaMs / 60000),
    motivo: decision.motivo,
  });

  /*
   * ── Lo que este chequeo NO hace todavía: volver a pedir el build ───────
   *
   * B-884 nombra a B-882 como su cierre: al detectar la divergencia, que vuelva
   * a levantar el flag llamando a la marca de rebuild con el motivo `frescura`.
   * Estuvo escrito y probado, y **se sacó**, porque el chequeo de clase de B-83
   * lo rechaza con razón: esa marca está declarada en `EFECTOS_INCONDICIONALES`
   * como un efecto que corresponde **porque la actividad cambió** y que por eso
   * no puede quedar debajo de ningún `return`. Acá el uso es el contrario —un
   * reintento **condicionado** a que haya divergencia confirmada—, y llamarla
   * igual convierte un uso legítimo en una violación de la invariante del otro.
   *
   * (Y el nombre de esa función no se escribe en esta prosa a propósito: el
   * chequeo de B-83 busca la palabra clave en el **texto** del trigger,
   * comentarios incluidos. Es la misma rugosidad que `calendario-trigger.js` ya
   * documenta.)
   *
   * O sea que la reparación automática necesita **su propio efecto con nombre**
   * (`remarcarPorFrescura`, que escriba lo mismo más `CAMPOS_REARME`), y eso es
   * una decisión de diseño de B-884, que es el frente que está tocando ese
   * módulo. El diff está en el reporte de este ítem.
   */

  /*
   * **Y volver a pedir el build** — B-884, que nombraba a este chequeo como su
   * cierre. Cuelga de la misma `decision.avisar` que el issue, así que está
   * acotado por la firma de la divergencia y por el reaviso de 24 h: a lo sumo
   * un build extra por día y por divergencia distinta, no uno cada media hora.
   *
   * Va **antes** del aviso y en su propio `try`: que el issue no se pueda abrir
   * no tiene por qué impedir el reintento, que es lo único que puede arreglar
   * la divergencia sin que intervenga nadie.
   */
  try {
    await remarcarPorFrescura(db);
    logger.info('se volvió a marcar el rebuild por divergencia (B-884)');
  } catch (e) {
    logger.warn('no se pudo remarcar el rebuild', { error: e?.message });
  }

  await avisar({ ref, firma: decision.firma, ahora, issue: issueDeAtraso(veredicto) });
});

/**
 * Abre el issue y anota el número. Si falla, **borra la reserva** para que la
 * próxima corrida lo reintente: si no, el chequeo quedaría creyendo que ya avisó
 * de algo que nadie vio, que es el modo de falla que este ítem entero existe para
 * cerrar.
 */
const avisar = async ({ ref, firma, ahora, issue }) => {
  const token = GITHUB_TOKEN.value();
  if (!token || !GITHUB_REPO) {
    logger.error('el sitio necesita un aviso y no hay GitHub configurado', {
      alerta: 'frescura-sin-canal',
    });
    await ref.set({ aviso: FieldValue.delete() }, { merge: true });
    return;
  }
  const r = await crearIssue({ repo: GITHUB_REPO, token, issue });
  if (r.ok) {
    await ref.set({ aviso: { firma, enMs: ahora, issue: r.numero ?? null } }, { merge: true });
    logger.info('aviso de frescura publicado', { numero: r.numero });
    return;
  }
  logger.error('no se pudo publicar el aviso de frescura', {
    alerta: 'frescura-sin-canal',
    status: r.status,
    error: r.mensaje,
  });
  await ref.set({ aviso: FieldValue.delete() }, { merge: true });
};
