import { app } from '@/lib/firebase-client';
import {
  bucketDeAncho,
  construirEvento,
  debeMedir,
  dispositivoDe,
  seccionASlug,
  type EventoMedido,
  type Funcion,
  type NombreEvento,
} from '@/lib/analytics-eventos';

/**
 * Transporte de la analítica del panel. Lo que se manda y con qué forma lo
 * decide `analytics-eventos.ts` (puro); acá solo está la infraestructura.
 *
 * Tres propiedades que no se negocian:
 *
 * 1. **No engorda el bundle inicial.** `firebase/analytics` entra por un
 *    `import()` dinámico dentro de una función, así que Rollup lo parte en su
 *    propio chunk y ese chunk no se descarga hasta que el navegador está
 *    libre. El panel ya carga ~570 KB de SDK (B-09) y hay trabajo en curso
 *    para bajarlo: esto no puede sumar ahí.
 * 2. **No se mide en desarrollo.** Con `PUBLIC_USE_EMULATORS=true` no sale
 *    nada. Si no, las pruebas locales contaminan los datos de producción y el
 *    panel deja de servir para lo que se instrumentó.
 * 3. **Un fallo de analítica no rompe el panel.** Un ad blocker, una red
 *    caída o un navegador sin soporte hacen fallar el `import()`: todo está
 *    envuelto y el formulario sigue igual. Nunca se propaga una excepción.
 */

const emuladores = import.meta.env.PUBLIC_USE_EMULATORS === 'true';
const measurementId = import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID as string | undefined;

export const analiticaHabilitada = (): boolean =>
  debeMedir({
    navegador: typeof window !== 'undefined',
    emuladores,
    measurementId,
  });

type Emisor = (nombre: string, params: Record<string, string | number>) => void;

/**
 * Versión desplegada (`VERSION_APP` de `src/lib/version.ts`). Entra por un
 * setter y no por un import para que este módulo no dependa de nada más que de
 * la config: sin la versión los eventos se mandan igual, con `version: otro`.
 *
 * Sin este dato, un pico de errores de validación no se puede atribuir a un
 * deploy, que es la mitad de la utilidad de medirlos.
 */
let versionApp: string | undefined;

export const registrarVersion = (version: string): void => {
  versionApp = version;
};

let emisor: Emisor | null = null;
let arrancando = false;
/** Una vez que el SDK falló, no se reintenta: no vale otro round trip por métrica. */
let inutilizable = false;

/**
 * Cola de eventos anteriores a la carga del SDK. Acotada a propósito: si el
 * SDK nunca llega (ad blocker), esto no puede crecer sin techo.
 */
const pendientes: EventoMedido[] = [];
const MAX_PENDIENTES = 30;

/**
 * Identificador de perfil, para poder distinguir a las dos personas que cargan
 * sin saber quién es cada una.
 *
 * Es un valor **aleatorio generado en el navegador**, no derivado de ningún
 * dato personal. No se usa el uid ni el mail, y tampoco un hash de ellos: el
 * conjunto de admins es de dos personas conocidas, así que un hash del mail se
 * revierte probando dos entradas — sería el mail con otro nombre.
 *
 * Vive en `localStorage`, así que sobrevive a las sesiones del panel y se
 * pierde si se limpia el navegador. Ese olvido es aceptable: sirve para
 * separar "una persona se traba diez veces" de "diez personas se traban una
 * vez", que es lo único que se necesita.
 */
const CLAVE_PERFIL = 'agenda:analitica:perfil';

const perfilAnonimo = (): string | undefined => {
  try {
    const guardado = window.localStorage.getItem(CLAVE_PERFIL);
    if (guardado) return guardado;
    const nuevo = `p_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    window.localStorage.setItem(CLAVE_PERFIL, nuevo);
    return nuevo;
  } catch {
    // Modo privado o storage bloqueado: se mide igual, sin perfil.
    return undefined;
  }
};

const iniciarSdk = async (): Promise<void> => {
  try {
    // El único import de `firebase/analytics` del proyecto, y es dinámico.
    const sdk = await import('firebase/analytics');
    if (!(await sdk.isSupported())) {
      inutilizable = true;
      return;
    }
    const instancia = sdk.getAnalytics(app());
    const perfil = perfilAnonimo();
    if (perfil) sdk.setUserId(instancia, perfil);
    emisor = (nombre, params) => sdk.logEvent(instancia, nombre as string, params);
    while (pendientes.length) {
      const evento = pendientes.shift()!;
      emisor(evento.nombre, evento.params);
    }
  } catch {
    inutilizable = true;
    pendientes.length = 0;
  }
};

/** Arranca el SDK cuando el navegador esté libre, nunca durante el primer render. */
const arrancar = (): void => {
  if (arrancando || emisor || inutilizable) return;
  arrancando = true;
  const diferir = (fn: () => void) => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: 4000 });
    else window.setTimeout(fn, 2000);
  };
  diferir(() => void iniciarSdk());
};

/** Contexto de dispositivo: mobile vs escritorio, que es la mitad del análisis. */
const contexto = (): Record<string, unknown> => {
  try {
    const ancho = window.innerWidth || 1024;
    const grueso = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return {
      dispositivo: dispositivoDe(ancho, grueso),
      ancho: bucketDeAncho(ancho),
      version: versionApp,
    };
  } catch {
    return { version: versionApp };
  }
};

/**
 * Única puerta de salida. Todo lo que se mide pasa por acá, y por lo tanto por
 * la proyección de `construirEvento`: un parámetro no declarado se descarta y
 * un string fuera de su vocabulario se reemplaza. No hay forma de mandar
 * contenido del formulario ni con un `medir()` mal escrito.
 */
export const medir = (nombre: NombreEvento, crudos: Record<string, unknown> = {}): void => {
  try {
    if (!analiticaHabilitada() || inutilizable) return;
    const evento = construirEvento(nombre, { ...contexto(), ...crudos });
    if (!evento) return;
    if (emisor) {
      emisor(evento.nombre, evento.params);
      return;
    }
    arrancar();
    if (pendientes.length < MAX_PENDIENTES) pendientes.push(evento);
  } catch {
    // Una métrica nunca puede tirar el panel.
  }
};

let panelMedido = false;

/** `panel_abierto`, una vez por carga de página. */
export const medirPanelAbierto = (): void => {
  if (panelMedido) return;
  panelMedido = true;
  medir('panel_abierto');
};

/** `funcion_usada`. `detalle` y `valor` son opcionales y ya vienen acotados. */
export const medirFuncion = (funcion: Funcion, detalle?: string, valor?: number): void =>
  medir('funcion_usada', { funcion, detalle, valor });

/** Acordeones: se reporta el slug del título, que es un literal del código. */
export const medirSeccion = (titulo: string, abierta: boolean): void =>
  medir('funcion_usada', {
    funcion: abierta ? 'seccion-abrir' : 'seccion-cerrar',
    detalle: seccionASlug(titulo),
  });
