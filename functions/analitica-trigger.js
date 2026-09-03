/**
 * La Function que trae los números del sitio público al panel — **B-374** (GA4)
 * y **B-373** (Search Console). La lógica pura está en `analitica.js`; acá vive
 * lo que necesita red, credenciales y Firestore.
 *
 * ── Por qué un `onSchedule` que escribe Firestore, y no un `onCall` ────────
 *
 * El §9.1 del diseño lista, para leer GA4 desde el panel, «un `onCall` con
 * verificación del claim `admin`» **más** «un documento de caché en Firestore
 * con su invalidación». Son dos piezas para el mismo fin, y con una alcanza:
 * si el resultado se cachea igual, el `onCall` solo agrega una superficie de
 * autenticación nueva que hay que escribir, testear y no equivocar.
 *
 * Es el mismo razonamiento —y textualmente el mismo— con el que
 * `reportes-trigger.js` eligió trigger sobre `onCall`: **la autorización ya la
 * hacen las reglas de Firestore**, `sistema/{doc}` es `read: if esAdmin()` /
 * `write: if false`, o sea que el panel lee con el permiso que ya tiene y nadie
 * más puede leer ni escribir. Y `reconciliacion.js` dejó escrito el criterio
 * general: no se agrega «un `onCall` nuevo (superficie de auth de más) cuando
 * la vía ya sancionada por la arquitectura alcanza».
 *
 * Lo que se pierde, dicho de frente: el panel **no** puede pedir «recalculá
 * ahora». Ve el resumen de la última corrida. No es una pérdida real: los
 * informes de GA4 tardan de 24 a 48 h y Search Console de 2 a 3 días, así que
 * un botón de refrescar traería exactamente el mismo número, y una vez por día
 * es más seguido de lo que los datos cambian.
 *
 * ── Y por qué diario y no cada hora ────────────────────────────────────────
 * La ventana es de 28 días con un día de retraso (`RETRASO`), así que el número
 * cambia una vez por día. Correr cada hora consumiría cuota de la Data API
 * —que se cuenta por propiedad y por día— para reescribir el mismo documento.
 *
 * ── Qué NO hace, a propósito ───────────────────────────────────────────────
 * No escribe nada si las dos mitades fallan: **el documento anterior es mejor
 * que un documento en blanco**. Un tablero que se vacía porque una credencial
 * venció hace media hora es peor que uno que dice «esto es de ayer».
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import {
  MOTIVOS_SIN_CONFIGURAR,
  RETRASO,
  documentoDeAnalitica,
  pedidoPrimerDia,
  pedidosGa4,
  pedidosSearchConsole,
  resumenGa4,
  resumenSearchConsole,
  ventanas,
} from './analitica.js';

/**
 * Las opciones van explícitas y no por el `setGlobalOptions` de `index.js`, por
 * el mismo motivo que en `reportes-trigger.js`: en ESM los imports corren antes
 * que el cuerpo del módulo que importa, así que cuando este archivo define la
 * Function el `setGlobalOptions()` todavía no se ejecutó y el endpoint quedaría
 * sin región ni service account.
 *
 * **La service account es la misma que ya existe** (`calendar-sync@`) y no una
 * nueva. El §9.1 pedía «+1 identidad», y no hace falta: esta identidad ya es la
 * que el proyecto autoriza a mano en consolas de Google (así se comparte el
 * calendario), así que sumarle dos permisos de lectura es un paso de consola
 * menos y una identidad menos que rotar. Los dos permisos que hay que darle
 * están en el runbook del §9.4 de `docs/16-analitica-del-sitio.md`.
 */
const OPCIONES = {
  schedule: 'every day 07:00',
  timeZone: 'America/Argentina/Buenos_Aires',
  region: 'southamerica-east1',
  maxInstances: 1,
  serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
};

/** El documento que lee el panel. Uno solo: es una foto, no una serie (B-378). */
const DOC = 'sistema/analitica-sitio';

/**
 * La propiedad de GA4 y el sitio de Search Console, por entorno.
 *
 * **El `propertyId` NO es el `G-…`.** El measurement id (`G-9CFMHSSGRC`) es lo
 * que va en el tag del navegador; la Data API pide el **id numérico de la
 * propiedad** (`properties/123456789`), que es otro número y está en otra
 * pantalla de la consola. Confundirlos devuelve un 403 que no dice cuál de los
 * dos está mal, y es el primer lugar donde se traba este ítem.
 *
 * `SEARCH_CONSOLE_SITE` es la propiedad tal cual la registró el dueño: para un
 * dominio verificado por DNS es `sc-domain:agendaleh.ar`, y para un prefijo de
 * URL es `https://agendaleh.ar/` **con la barra final**. No son intercambiables
 * y la API devuelve 403 con la que no es.
 */
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const SEARCH_CONSOLE_SITE = process.env.SEARCH_CONSOLE_SITE;

/** Timeout de cada llamada. Sin esto un socket colgado se come la invocación. */
const TIMEOUT_MS = 20_000;

/**
 * §2.6 — la Function **corre como** la service account y toma el token de las
 * credenciales de su propio runtime, sin una key que guardar ni rotar. Es el
 * mismo desvío deliberado que `index.js` documenta para Calendar.
 *
 * Los dos scopes son de **solo lectura** y no hay ninguno de escritura: esta
 * Function no puede tocar la configuración de GA4 ni de Search Console ni con
 * un bug.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

let _clientes = null;
const clientes = async () => {
  if (_clientes) return _clientes;
  const auth = new GoogleAuth({ scopes: SCOPES });
  const authClient = await auth.getClient();
  _clientes = {
    ga4: google.analyticsdata({ version: 'v1beta', auth: authClient }),
    searchConsole: google.searchconsole({ version: 'v1', auth: authClient }),
  };
  return _clientes;
};

/** Ejecuta los cinco informes de una ventana. */
const informesDe = async (ga4, property, ventana) => {
  const pedidos = pedidosGa4(ventana);
  const nombres = Object.keys(pedidos);
  const respuestas = await Promise.all(
    nombres.map((n) =>
      ga4.properties
        .runReport({ property, requestBody: pedidos[n] }, { timeout: TIMEOUT_MS })
        .then((r) => r.data),
    ),
  );
  return Object.fromEntries(nombres.map((n, i) => [n, respuestas[i]]));
};

const leerGa4 = async (ahora) => {
  if (!GA4_PROPERTY_ID) {
    return { ok: false, motivo: MOTIVOS_SIN_CONFIGURAR.ga4 };
  }
  const property = `properties/${GA4_PROPERTY_ID}`;
  const v = ventanas(ahora, RETRASO.ga4);
  try {
    const { ga4 } = await clientes();
    const [actual, anterior, primerDia] = await Promise.all([
      informesDe(ga4, property, v.actual),
      informesDe(ga4, property, v.anterior),
      ga4.properties
        .runReport({ property, requestBody: pedidoPrimerDia(ahora) }, { timeout: TIMEOUT_MS })
        .then((r) => r.data),
    ]);
    return {
      ok: true,
      resumen: resumenGa4({ actual, anterior, primerDia, ventana: v.actual }),
    };
  } catch (e) {
    /*
     * La respuesta cruda va **al log y no al documento**: el panel lee ese
     * documento, y volcarle el cuerpo de un error de Google es la clase de fuga
     * que el `auditor-privacidad` busca. Al log sí, porque un 403 de la Data
     * API sin el cuerpo no distingue «la property no existe» de «la service
     * account no tiene acceso», que son dos pasos de consola distintos.
     */
    logger.error('falló la lectura de GA4', {
      alerta: 'analitica-sitio-ga4',
      error: e?.message,
      codigo: e?.code ?? e?.response?.status ?? null,
      detalle: e?.response?.data ?? null,
    });
    return { ok: false, motivo: e?.message ?? String(e) };
  }
};

const leerSearchConsole = async (ahora) => {
  if (!SEARCH_CONSOLE_SITE) {
    return { ok: false, motivo: MOTIVOS_SIN_CONFIGURAR.searchConsole };
  }
  const v = ventanas(ahora, RETRASO.searchConsole);
  const pedidos = pedidosSearchConsole(v.actual);
  try {
    const { searchConsole } = await clientes();
    const [busquedas, paginas] = await Promise.all(
      ['busquedas', 'paginas'].map((n) =>
        searchConsole.searchanalytics
          .query(
            { siteUrl: SEARCH_CONSOLE_SITE, requestBody: pedidos[n] },
            { timeout: TIMEOUT_MS },
          )
          .then((r) => r.data),
      ),
    );
    return {
      ok: true,
      resumen: resumenSearchConsole({ busquedas, paginas, ventana: v.actual }),
    };
  } catch (e) {
    logger.error('falló la lectura de Search Console', {
      alerta: 'analitica-sitio-search-console',
      error: e?.message,
      codigo: e?.code ?? e?.response?.status ?? null,
      detalle: e?.response?.data ?? null,
    });
    return { ok: false, motivo: e?.message ?? String(e) };
  }
};

export const traerAnaliticaDelSitio = onSchedule(OPCIONES, async () => {
  const ahora = new Date();

  // Las dos en paralelo y con `Promise.all` sobre resultados que **nunca
  // rechazan** (cada lectura atrapa lo suyo): un `Promise.all` de promesas que
  // pueden rechazar tiraría la primera y dejaría la otra mitad sin escribir,
  // que es justamente lo que el docblock de `documentoDeAnalitica` evita.
  const [ga4, searchConsole] = await Promise.all([leerGa4(ahora), leerSearchConsole(ahora)]);

  if (!ga4.ok && !searchConsole.ok) {
    // El documento anterior es mejor que uno en blanco: un tablero que se vacía
    // porque una credencial venció es peor que uno que dice «esto es de ayer».
    logger.error('las dos fuentes de analítica fallaron: no se toca el documento', {
      alerta: 'analitica-sitio-sin-fuentes',
      ga4: ga4.motivo,
      searchConsole: searchConsole.motivo,
    });
    return;
  }

  await getFirestore()
    .doc(DOC)
    .set(
      {
        ...documentoDeAnalitica({ ga4, searchConsole, generadoEn: ahora.toISOString() }),
        // El sello del servidor, al lado del ISO: el ISO es el que la pantalla
        // muestra y el `serverTimestamp` es el que ordena, sin depender del
        // reloj de la instancia.
        actualizado: FieldValue.serverTimestamp(),
      },
      /*
       * **Sin `merge`, a propósito.** Es una foto completa, no un parche: con
       * `merge` una fila que hoy no viene (un canal que dejó de aparecer, o la
       * mitad que pasó a `falla`) quedaría con el valor de ayer mezclado con
       * los de hoy, y nadie podría notarlo mirando la pantalla. Es la clase de
       * bug de B-580 al revés: acá el dueño del documento es uno solo y escribe
       * todo o nada.
       *
       * La excepción es lo que este `set` no puede saber: si una mitad falló,
       * su rama dice `estado: 'falla'` con el motivo, así que la pantalla
       * muestra la mitad buena y explica la otra — no hereda un número viejo
       * haciéndolo pasar por nuevo.
       */
      { merge: false },
    );

  logger.info('analítica del sitio actualizada', {
    ga4: ga4.ok ? 'ok' : 'falla',
    searchConsole: searchConsole.ok ? 'ok' : 'falla',
  });
});
