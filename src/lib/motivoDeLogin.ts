/**
 * Por qué falló el login del panel — B-790.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El botón «Entrar con Google» hacía `void loginConGoogle()`: la promesa se
 * descartaba y **el error no llegaba a ninguna parte**. El popup se abría, fallaba
 * y la pantalla quedaba exactamente igual — sin mensaje, sin nada. El síntoma que
 * eso produce es «el panel carga pero no hace el login», que es lo que reportó el
 * dueño el 2026-09-07 sobre `agendaleh.ar` y `agendaleh.com.ar`.
 *
 * Es **la misma clase de bug que B-590**, y por eso se arregla igual: ahí la
 * subida de una imagen decía siempre «fijate la conexión» y el `code` del SDK se
 * ignoraba; acá no se decía nada. En los dos casos el dato para explicar la falla
 * estaba y se tiraba.
 *
 * ── La causa que este mensaje tiene que poder nombrar ─────────────────────
 * `signInWithPopup` abre el handler en el `authDomain`
 * (`agenda-literaria.firebaseapp.com`) y ése **valida el origen que lo abrió**
 * contra la lista de dominios autorizados de Firebase Auth. Un dominio propio no
 * está en esa lista por default: `agenda-literaria.web.app` sí, `agendaleh.ar` y
 * `agendaleh.com.ar` **no** hasta que alguien los agrega en la consola.
 *
 * Ese caso —`auth/unauthorized-domain`— es el único de esta lista que **no se
 * arregla del lado de quien entra**, así que su mensaje dice qué pasa y a quién
 * avisarle, en vez de pedirle que reintente algo que no va a funcionar nunca.
 *
 * Es puro y se testea sin DOM: la decisión de qué se muestra es del dominio, y
 * el componente solo la pinta.
 */

/** El código que trae un error del SDK de Auth, si trae alguno. */
const codigoDe = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';

export interface MotivoDeLogin {
  /** Qué se le muestra a quien no pudo entrar. */
  texto: string;
  /**
   * ¿Tiene sentido que reintente?
   *
   * Con `false` el componente no ofrece «probá de nuevo»: un dominio sin
   * autorizar o un método de acceso deshabilitado no cambian por reintentar, y
   * ofrecerlo hace que la persona pruebe cinco veces antes de avisar.
   */
  reintentable: boolean;
}

/**
 * El motivo, a partir de lo que tiró el SDK.
 *
 * Los códigos son los de `firebase/auth`. El default **incluye el código** por lo
 * mismo que B-590: un código desconocido en pantalla es lo que permite reportarlo,
 * y un mensaje genérico lo esconde.
 */
export const motivoDeLoginFallido = (error: unknown): MotivoDeLogin => {
  const codigo = codigoDe(error);

  switch (codigo) {
    case 'auth/unauthorized-domain':
      return {
        texto:
          'Este dominio todavía no está habilitado para entrar. No es algo que se ' +
          'arregle desde acá: hay que autorizarlo en la configuración del proyecto. ' +
          'Mientras tanto se puede entrar desde agenda-literaria.web.app.',
        reintentable: false,
      };
    case 'auth/operation-not-allowed':
      return {
        texto:
          'El acceso con Google está deshabilitado en el proyecto. Hay que ' +
          'habilitarlo en la configuración; desde acá no se puede.',
        reintentable: false,
      };
    // Los tres de abajo son la misma cosa desde el lado de quien entra —cerró el
    // popup, lo canceló, o abrió otro— y no son un error: no vale asustar con un
    // mensaje rojo a quien apretó la cruz.
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return { texto: 'Quedó a medias: volvé a apretar «Entrar con Google».', reintentable: true };
    case 'auth/popup-blocked':
      return {
        texto:
          'El navegador bloqueó la ventana de Google. Permitile abrir ventanas a ' +
          'este sitio y probá de nuevo.',
        reintentable: true,
      };
    case 'auth/network-request-failed':
      return { texto: 'Se cortó la conexión antes de terminar. Probá de nuevo.', reintentable: true };
    case 'auth/too-many-requests':
      return { texto: 'Demasiados intentos seguidos. Esperá un rato y volvé a probar.', reintentable: false };
    default:
      return {
        texto: codigo
          ? `No se pudo entrar (${codigo}). Si sigue pasando, reportalo con ese código.`
          : 'No se pudo entrar, y el navegador no dijo por qué. Probá de nuevo.',
        reintentable: true,
      };
  }
};
