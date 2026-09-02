import {
  construirEventoSitio,
  debeMedirSitio,
  debeMostrarBanner,
  guardarConsentimiento,
  leerConsentimiento,
  ubicacionSinQuery,
  type EstadoConsentimiento,
  type NombreEventoSitio,
} from '@/lib/analyticsSitio';

/**
 * Transporte de la analítica del sitio público (B-372, B-375). Lo que se
 * manda y con qué forma lo decide `analyticsSitio.ts` (puro y testeado); acá
 * solo está la infraestructura que toca `window`, `document` y
 * `localStorage` — por eso, igual que `analytics.ts` del panel, este archivo
 * no tiene test propio: lo que hace falta verificar es la lógica, no el DOM.
 *
 * Nada de acá corre en `/admin`: el panel ya mide, con su propia proyección
 * (`analytics-eventos.ts`), y ahí el `page_view` automático de este módulo
 * **sí** sería una fuga — este archivo ni se importa desde `AdminApp`.
 */

const emuladores = import.meta.env.PUBLIC_USE_EMULATORS === 'true';
const measurementId = import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** ¿Ya se inyectó el script? Una sola vez por carga de página. */
let cargado = false;

const habilitado = (estado: EstadoConsentimiento): boolean =>
  debeMedirSitio({
    navegador: typeof window !== 'undefined',
    emuladores,
    measurementId,
    consentimiento: estado,
  });

/** El flag de opt-out que el propio `gtag.js` respeta — es la forma de
 * detener el envío sin poder (ni tener que) desinstalar nada. */
const claveDisable = (): string | undefined =>
  measurementId ? `ga-disable-${measurementId}` : undefined;

/**
 * Inyecta `gtag.js` y lo configura — **solo se llama cuando el consentimiento
 * ya es `'aceptado'`** (lo garantiza `habilitado`, no quien llama). Una vez
 * por carga de página: una segunda llamada es no-op.
 */
const cargarGtag = (): void => {
  if (cargado || !measurementId) return;
  cargado = true;
  try {
    const clave = claveDisable();
    // Por si veníamos de un «rechazar» de la misma sesión (ver `rechazar`
    // más abajo): sin esto, aceptar después de haber rechazado quedaría
    // mudo aunque el script se cargue.
    if (clave) delete (window as unknown as Record<string, unknown>)[clave];

    window.dataLayer = window.dataLayer || [];
    /*
     * El snippet EXACTO que documenta Google: `dataLayer.push(arguments)`, no
     * `dataLayer.push([...args])`. Encontrado por el `auditor-privacidad`:
     * `gtag.js`, una vez que carga, procesa cada entrada del `dataLayer`
     * esperando el objeto `arguments` (o algo array-like equivalente); un
     * array construido a mano por `rest params` es una forma distinta y el
     * riesgo es que el tag la ignore en silencio — cero eventos medidos, sin
     * ningún error que lo diga. No cuesta nada igualar el snippet real.
     */
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    /*
     * `page_location` recortado — nunca la URL real. Es el invariante del
     * §5.3 de docs/16-analitica-del-sitio.md: sin esto, el texto que alguien
     * tipeó en el buscador (`?q=...`) viajaría solo por instalar el tag.
     *
     * `page_referrer` recortado también, y por el mismo motivo — lo encontró
     * el `auditor-privacidad` (D-253): navegar de `/?q=...` a la página de
     * detalle manda ese `page_location` ya recortado, pero el `page_view` de
     * la página de **llegada** manda como referrer la URL de **origen**
     * entera si no se la pisa acá. Sin este segundo recorte, el recorte del
     * `page_location` no alcanzaba: el texto del buscador viajaba igual, un
     * campo al lado.
     */
    window.gtag('config', measurementId, {
      page_location: ubicacionSinQuery(window.location.href),
      page_referrer: document.referrer ? ubicacionSinQuery(document.referrer) : undefined,
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  } catch {
    // Un fallo acá (ad blocker, CSP, lo que sea) nunca puede romper el sitio.
  }
};

/** Corta el envío en esta misma sesión, sin recargar la página. */
const desactivarGtag = (): void => {
  try {
    const clave = claveDisable();
    if (clave) (window as unknown as Record<string, unknown>)[clave] = true;
  } catch {
    // idem
  }
};

/** El estado guardado, o `'sin-decidir'` si `localStorage` no está
 * disponible (modo privado, storage bloqueado). Fallar a «sin decidir» y no
 * a «aceptado» es la mitad segura del error: en el peor caso se vuelve a
 * preguntar, nunca se mide sin haber preguntado. */
export const estadoActual = (): EstadoConsentimiento => {
  try {
    return leerConsentimiento(window.localStorage);
  } catch {
    return 'sin-decidir';
  }
};

export const mostrarBannerAlArrancar = (): boolean => debeMostrarBanner(estadoActual());

/** Se llama una vez, al cargar cualquier página pública: si ya había una
 * aceptación guardada de una visita anterior, esto es lo que hace que el tag
 * se cargue sin volver a preguntar. */
export const iniciarSegunConsentimiento = (): void => {
  const estado = estadoActual();
  if (habilitado(estado)) cargarGtag();
};

export const aceptar = (): void => {
  try {
    guardarConsentimiento(window.localStorage, 'aceptado');
  } catch {
    // Sin persistencia la decisión no sobrevive a esta carga, pero esta
    // carga igual la respeta: se sigue pudiendo cargar el tag ahora mismo.
  }
  if (habilitado('aceptado')) cargarGtag();
};

/**
 * **La guarda que más importa de este archivo**: rechazar no manda nada y no
 * carga el tag. Si `gtag.js` ya estaba cargado —se aceptó antes en esta misma
 * carga de página y ahora se está revisando la decisión— esto lo silencia sin
 * poder desinstalarlo: es el mecanismo que el propio `gtag.js` provee.
 */
export const rechazar = (): void => {
  try {
    guardarConsentimiento(window.localStorage, 'rechazado');
  } catch {
    // idem
  }
  desactivarGtag();
};

/**
 * Único punto de salida para los eventos propios (B-375). No manda nada si
 * el tag no está cargado —es decir, si el consentimiento no es
 * `'aceptado'`—: sin cola y sin reintento, porque un evento que no se manda
 * de un visitante que rechazó es exactamente lo correcto, no una pérdida.
 */
export const medirSitio = (
  nombre: NombreEventoSitio,
  crudos: Record<string, unknown> = {},
): void => {
  try {
    if (!cargado || !window.gtag) return;
    const evento = construirEventoSitio(nombre, crudos);
    if (!evento) return;
    window.gtag('event', evento.nombre, evento.params);
  } catch {
    // Una métrica nunca puede tirar el sitio.
  }
};
