import { useEffect, useRef, useState } from 'react';
// Estático a propósito: el aviso de versión nueva tiene que poder aparecer
// desde el primer render, incluso en la pantalla de login. No arrastra
// Firestore, así que no rompe el corte del bundle de D-51.
import { AvisoEtiquetas } from '@/components/admin/AvisoEtiquetas';
import { AvisoVersionNueva } from '@/components/admin/AvisoVersionNueva';
// B-930 — estático por lo mismo que el de versión nueva: tiene que poder
// aparecer en la pantalla de login. Solo lee un store de módulo sin SDK.
import {
  AvisoVerificacion,
  useVerificacionDelNavegador,
} from '@/components/admin/AvisoVerificacion';
import { PieVersion } from '@/components/admin/PieVersion';
import { useVersionPublicada } from '@/components/admin/useVersionPublicada';
// El SDK de analítica lo carga este módulo de forma diferida, así que el
// import no engorda el chunk inicial.
import { medirPanelAbierto, registrarVersion } from '@/lib/analytics';
// B-955 — los filtros y el orden del listado viven acá: ver el estado, más abajo.
import {
  FILTROS_VACIOS,
  ORDEN_POR_DEFECTO,
  type Filtros,
  type Orden,
} from '@/lib/filtrosActividades';
import { motivoDeLoginFallido, type MotivoDeLogin } from '@/lib/motivoDeLogin';
// B-620 — qué vista usa todo el ancho. Puro y con su test, por lo mismo que
// `salida-del-panel.ts`: la vista que se agregue mañana arranca angosta y quien
// la escriba decide en una línea, en vez de heredar un `===` suelto en el JSX.
import { ocupaTodoElAncho } from '@/lib/anchoDelPanel';
import { InterruptorDeFormato } from '@/components/admin/InterruptorDeFormato';
import { InterruptorDeVista } from '@/components/admin/InterruptorDeVista';
import {
  formatoInicialDeHora,
  recordarFormatoDeHora,
  type FormatoDeHora,
} from '@/lib/formatoDeHora';
import {
  recordarVistaDelPanel,
  vistaInicialDelPanel,
  type VistaDelPanel,
} from '@/lib/vistaDelPanel';
// Store de módulo, sin Firestore ni React context (ver formulario-sucio.ts).
import { hayCambiosSinGuardar, marcarCambiosSinGuardar } from '@/lib/formulario-sucio';
import {
  AVISO_CAMBIOS_SIN_GUARDAR,
  debeConfirmarSalida,
  tieneFormulario,
} from '@/lib/salida-del-panel';
import { VERSION_APP } from '@/lib/version';
// Estático: la ayuda es solo datos y componentes, no toca Firestore.
import { BotonAyuda } from '@/components/admin/ayuda/BotonAyuda';
import {
  alCambiarDeSesion,
  almacenDelNavegador,
  borrarTodosLosBorradores,
} from '@/lib/formulario/borradoresDelNavegador';
import {
  loginConGoogle,
  logout,
  observarAuth,
  rolDelPanel,
  usarEmuladores,
  verificarNavegadorAlArrancar,
} from '@/lib/firebase-client';
// Puro: la tabla de qué ve cada rol. No toca Firestore, así que puede ser un
// import estático del chunk del login (B-09, D-51).
import { puedeVer, type RolDelPanel } from '@/lib/rolDelPanel';
// Store de módulo, sin Firestore ni React context (mismo patrón que
// `formulario-sucio.ts`): es lo que le permite a `campos-del-panel.tsx` decidir
// si ofrece «Otro…» sin cablear un booleano por seis componentes.
import { fijarRolActivo } from '@/lib/rolActivo';
// M-17 — el router de pantallas y sus puertas diferidas, cada uno en su módulo.
// Los dos son estáticos y no rompen el corte de B-09: todo lo que toca
// Firestore sigue entrando por `import()` desde `diferidas.tsx`.
import { PantallaDelPanel } from '@/components/admin/pantallas/PantallaDelPanel';
import { PendientesBadge, PropuestasBadge } from '@/components/admin/pantallas/diferidas';
import {
  tituloDeLaVista,
  type DestinoDeVolver,
  type Vista,
} from '@/components/admin/pantallas/vista';
import type { User } from 'firebase/auth';

/**
 * Cerrar sesión se lleva los borradores del navegador (B-191).
 *
 * El autoguardado persiste **contenido**, y parte de ese contenido el §5.1 lo
 * marca como interno (`difusion`, `inscripcion.destino`, `online.url`). Sin este
 * paso sobrevive al logout hasta 30 días, en claro y bajo una clave predecible:
 * en una máquina compartida, la persona que entra después se encuentra con lo que
 * dejó a medias la anterior. La clave lleva la huella del uid, así que el aviso
 * no se lo ofrecería —eso es lo que arregla la clave—, pero el contenido seguiría
 * ahí, y `07-seguridad.md` promete que el alcance es el de la sesión del panel.
 *
 * Se borra **antes** del `signOut`: después de cerrar sesión la pantalla puede
 * remontar y no hay garantía de llegar a correrlo.
 */
const cerrarSesion = () => {
  borrarTodosLosBorradores(almacenDelNavegador());
  return logout();
};

/**
 * El ancho de una pantalla de lectura: el que el panel tuvo siempre. Es el
 * default y lo usan todas las vistas menos las que `anchoDelPanel.ts` marca.
 */
const ANCHO_DE_LECTURA = 'max-w-3xl lg:max-w-4xl';

/**
 * El ancho para lo que se recorre de un barrido (B-620). Con tope, y no
 * `max-w-none`: en un monitor de 2560px las cuatro columnas de la grilla darían
 * tarjetas de 600px, que es el problema del panel encajonado dado vuelta.
 */
const ANCHO_COMPLETO = 'max-w-[100rem]';

/**
 * SPA del panel, montada como island `client:only` en `/admin` (§2.3, §9).
 * El router es propio y mínimo: este componente es el chasis —sesión, estado
 * que sobrevive al cambio de vista, encabezado— y la pantalla de cada vista la
 * monta `pantallas/PantallaDelPanel.tsx` (M-17).
 */
export function AdminApp() {
  const [usuario, setUsuario] = useState<User | null>(null);
  /**
   * B-888 — el rol, no un booleano. `null` = la cuenta no tiene ninguno de los
   * dos claims (la pantalla «Sin permisos»); `undefined` = todavía no se leyó.
   *
   * Era `esAdmin: boolean | null`, y con el rol nuevo un booleano no alcanza: un
   * publicador daría `false` y vería «Sin permisos» teniendo permisos.
   */
  const [rol, setRol] = useState<RolDelPanel | null | undefined>(undefined);
  /**
   * B-919 — el alcance por ciudad del publicador, del mismo token que el rol.
   *
   * `''` es «sin alcance por ciudad», que es lo que tiene un admin (ve todo) y
   * una cuenta publicadora a la que nadie le puso `--ciudad`. Va en su propio
   * estado y no adentro de `rol` para no cambiar el tipo que ya leen `puedeVer` y
   * las quince ramas del router.
   */
  const [ciudad, setCiudad] = useState('');
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });

  /**
   * **La forma del formulario de carga, elegida a mano** — B-814.
   *
   * El inicializador es **perezoso** (`useState(() => …)`) y no un valor: leer
   * `localStorage` en cada render sería una lectura sincrónica por pintada, y
   * sobre todo el valor tiene que venir de la primera —si arrancara en el default
   * y un `useEffect` lo corrigiera después, el formulario se dibujaría con
   * pestañas y saltaría a apilado a la vista de todos.
   *
   * `globalThis.localStorage` con `?? null` y no `window.localStorage`: este
   * componente lo monta una island `client:only`, así que en el navegador está
   * siempre — pero el mismo módulo lo importan los tests de render, donde el
   * almacén puede no existir, y el módulo puro está escrito para recibir `null`.
   */
  const [vistaDelPanel, setVistaDelPanel] = useState<VistaDelPanel>(() =>
    vistaInicialDelPanel(globalThis.localStorage ?? null),
  );

  const elegirVista = (nueva: VistaDelPanel) => {
    setVistaDelPanel(nueva);
    recordarVistaDelPanel(globalThis.localStorage ?? null, nueva);
  };

  /**
   * En qué formato se **tipean** las horas — B-889, D-720. Misma forma que la
   * vista de arriba, y por el mismo motivo: se lee del almacén en el
   * inicializador (no en un `useEffect`) para que el primer dibujo ya sea el
   * elegido, y se recuerda al cambiarla.
   */
  const [formatoDeHora, setFormatoDeHora] = useState<FormatoDeHora>(() =>
    formatoInicialDeHora(globalThis.localStorage ?? null),
  );

  const elegirFormatoDeHora = (nuevo: FormatoDeHora) => {
    setFormatoDeHora(nuevo);
    recordarFormatoDeHora(globalThis.localStorage ?? null, nuevo);
  };
  /**
   * **Los filtros y el orden del listado** — B-955, pedido del dueño.
   *
   * Viven acá y no en `ListaActividades` porque ese componente se **desmonta**
   * en cuanto la vista deja de ser la lista: al volver de editar una actividad,
   * su estado nacía vacío y se llevaba puestos los ocho ejes, el texto de
   * búsqueda y el orden. Es el mismo motivo por el que `volverA` vive acá.
   *
   * **No se persiste**, y es una decisión: mueren con la pestaña. Un filtro
   * pegado de ayer es peor que ninguno, porque quien abre el panel ve una lista
   * recortada sin haber pedido nada.
   */
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [orden, setOrden] = useState<Orden>(ORDEN_POR_DEFECTO);

  const [version, setVersion] = useState(0);

  // Una sola llamada: el hook hace el fetch de /version.json y el reload().
  // Dos componentes llamándolo serían dos chequeos y, en el peor caso, dos
  // recargas. Se reparte al aviso y al pie.
  const estadoVersion = useVersionPublicada();
  /*
   * B-930 — **el token de App Check se pide al entrar**, no en el primer
   * guardado: con el enforcement puesto, un navegador sin token no puede leer
   * ni guardar nada, y enterarse recién al apretar «Guardar» es tarde. El
   * cartel va en las tres pantallas —login, sin permisos y panel—, porque el
   * problema es del navegador y no de la sesión.
   */
  const verificacion = useVerificacionDelNavegador();
  useEffect(() => {
    verificarNavegadorAlArrancar();
  }, []);

  /**
   * A dónde vuelve el formulario al guardar o cancelar. Sin esto, editar desde
   * el calendario devolvía al listado y se perdía el mes que se estaba
   * mirando — que en una vista de calendario es la mitad del contexto.
   */
  const [volverA, setVolverA] = useState<DestinoDeVolver>('lista');

  /**
   * B-177 — las etiquetas nuevas que el último guardado no llegó a registrar.
   *
   * Vive acá y no en el formulario porque el formulario se desmonta al guardar:
   * el aviso tiene que sobrevivir al cambio de vista, y este es el único
   * componente que lo hace. Se limpia al abrir cualquier formulario de nuevo —un
   * aviso del guardado anterior colgado arriba de una carga nueva se lee como si
   * fuera de esta.
   */
  const [etiquetasSinRegistrar, setEtiquetasSinRegistrar] = useState<readonly string[]>([]);

  /**
   * B-830 / D-600 — el segundo movimiento que **no** salió.
   *
   * Aceptar una propuesta son dos escrituras y el orden es una decisión: primero
   * la actividad, después la propuesta. Si la segunda falla —permisos, red— la
   * actividad ya existe y la propuesta sigue diciendo `nueva`: sin este aviso,
   * la próxima vez que alguien mire la bandeja la convierte de nuevo y quedan
   * dos actividades. Vive acá y no en la bandeja porque la bandeja está
   * desmontada mientras el formulario está abierto, que es cuando esto pasa.
   */
  const [falloAlAceptar, setFalloAlAceptar] = useState<string | null>(null);

  /**
   * B-35 — toda salida del formulario pasa por acá.
   *
   * Antes cada botón del encabezado hacía su `setVista` directo, así que
   * "Volver", "Calendario", "Reportar algo", "Salir" y "Cancelar" descartaban
   * los 30+ campos del §11 sin decir nada. La regla de cuándo preguntar es pura
   * y vive en `salida-del-panel.ts`; acá queda solo el `confirm()`.
   *
   * Envolver la acción en vez de chequear en cada `onClick` es lo que hace que
   * una salida nueva no pueda olvidarse del aviso: el botón nuevo se escribe
   * como `salirDe(() => …)` porque es la forma que tienen todos los demás.
   */
  const salirDe = (accion: () => void): void => {
    if (debeConfirmarSalida(vista.tipo, hayCambiosSinGuardar())) {
      if (!confirm(AVISO_CAMBIOS_SIN_GUARDAR)) return;
      // La persona eligió perderlos: el store queda limpio para que el aviso no
      // se repita en la pantalla siguiente si el desmontaje llega después.
      marcarCambiosSinGuardar(false);
    }
    accion();
  };

  /**
   * A dónde manda "← Volver" del encabezado. Desde el formulario respeta
   * `volverA` igual que "Cancelar": antes mandaba siempre al listado, así que
   * editar un encuentro desde el calendario y volver por el encabezado perdía
   * el mes que se estaba mirando — justo lo que `volverA` existe para evitar.
   */
  const destinoDeVolver = (): Vista =>
    tieneFormulario(vista.tipo) ? { tipo: volverA } : { tipo: 'lista' };

  /**
   * B-203 — el fin de sesión que no pasa por el botón «Salir».
   *
   * `cerrarSesion()` cubre los dos botones, que son los dos únicos call sites de
   * `logout()`. Pero `observarAuth` es `onAuthStateChanged` y avisa **sin ningún
   * click**: token revocado, cuenta deshabilitada, logout en otra pestaña. Ahí el
   * panel vuelve al login y, sin esto, los borradores quedan en el navegador en
   * claro y hasta 30 días, con campos que el §5.1 marca como internos.
   *
   * El uid anterior va en un `useRef` porque la condición es la **transición**, no
   * el valor: el primer aviso del observador es `null` mientras se restaura la
   * sesión, y borrar en cualquier `null` se llevaría el trabajo de quien está
   * abriendo el panel. La regla —qué transición borra y por qué— vive en
   * `alCambiarDeSesion`, junto al borrado; acá queda solo el enganche.
   *
   * Se corre **antes** del `await`: el `ref` tiene que quedar al día aunque la
   * lectura del claim tarde y llegue otro aviso del observador en el medio.
   */
  const uidAnterior = useRef<string | null>(null);

  useEffect(() => {
    return observarAuth(async (u) => {
      alCambiarDeSesion(almacenDelNavegador(), uidAnterior.current, u?.uid ?? null);
      uidAnterior.current = u?.uid ?? null;
      setUsuario(u);
      const sesion = u ? await rolDelPanel(u) : { rol: null, ciudad: '' };
      const suRol = sesion.rol;
      setRol(suRol);
      setCiudad(sesion.ciudad);
      // Antes del `setCargando(false)`: el store tiene que estar al día **antes**
      // del primer render del panel, o el formulario se dibujaría una vez con el
      // default permisivo.
      fijarRolActivo(suRol);
      setCargando(false);

      /*
       * B-888 — **el consumidor que a `registrarUsuario()` le faltaba.** Hasta
       * la tajada 1 la colección `/usuarios` existía y estaba vacía, así que el
       * panel no podía mostrar ningún mail.
       *
       * Va acá, en el observador de auth, y no en un botón: es lo que hace que
       * el mail **no envejezca** (D-650) — se refresca en cada login en vez de
       * quedar cableado, que es el defecto que D-610 le señalaba al mapa
       * uid→nombre a mano.
       *
       * `import()` y no un import estático: `usuarios.ts` toca Firestore y este
       * módulo es el que baja la pantalla de login (B-09, D-51). Y `void` con su
       * `catch`: que el directorio no se pueda actualizar **no puede impedirle a
       * nadie entrar** — lo peor que pasa es que el panel lea un uid donde
       * esperaba un mail.
       */
      if (u && suRol) {
        void import('@/lib/usuarios')
          .then((m) => m.registrarUsuario(u.uid, u.email))
          .catch(() => {});
      }
    });
  }, []);

  /**
   * B-35 — cerrar la pestaña con el formulario a medio cargar.
   *
   * Es el único camino de salida que el panel no controla: no hay click que
   * interceptar, así que va por `beforeunload`. El navegador muestra su propio
   * cartel y no se le puede poner texto — de ahí que el `confirm()` de las
   * salidas de abajo sí valga la pena, que es donde se puede explicar qué se
   * pierde.
   *
   * El estado se lee dentro del handler y no como dependencia del efecto: el
   * listener se registra una vez y siempre ve el valor actual del store.
   */
  useEffect(() => {
    const alCerrar = (e: BeforeUnloadEvent) => {
      if (!hayCambiosSinGuardar()) return;
      e.preventDefault();
      // Sin esto Chrome ignora el `preventDefault()` y cierra sin preguntar.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alCerrar);
    return () => window.removeEventListener('beforeunload', alCerrar);
  }, []);

  // Analítica del panel. Deliberadamente fuera del efecto de auth y sin datos
  // de la sesión: no se mide ni el uid ni el mail (docs/09-analitica.md).
  useEffect(() => {
    // Sin esto los eventos viajan sin `version` y un pico de errores no se
    // puede atribuir a un deploy, que es la mitad del valor de medir.
    registrarVersion(VERSION_APP);
    medirPanelAbierto();
  }, []);

  /*
   * B-790 — el motivo del login fallido. Antes el botón hacía
   * `void loginConGoogle()` y el error se descartaba: el popup fallaba y la
   * pantalla no decía nada, que es el síntoma «carga pero no entra».
   */
  const [motivoDeLogin, setMotivoDeLogin] = useState<MotivoDeLogin | null>(null);

  const entrar = async () => {
    setMotivoDeLogin(null);
    try {
      await loginConGoogle();
    } catch (error) {
      setMotivoDeLogin(motivoDeLoginFallido(error));
    }
  };

  if (cargando) {
    return <p className="p-8 text-sm text-tinta/65">Cargando…</p>;
  }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-sm px-segura py-24 text-center">
        <AvisoVerificacion estado={verificacion} />
        <h1 className="font-serif text-2xl font-semibold">Panel de carga</h1>
        <p className="mt-2 text-sm text-tinta/65">
          Agenda de actividades literarias
        </p>
        <button
          type="button"
          onClick={() => void entrar()}
          className="mt-6 min-h-touch w-full rounded-md bg-acento px-4 text-sm font-medium text-white"
        >
          {motivoDeLogin?.reintentable ? 'Probar de nuevo' : 'Entrar con Google'}
        </button>

        {motivoDeLogin && (
          /*
           * `role="alert"` para que un lector de pantalla lo diga sin que haya
           * que ir a buscarlo: quien apretó el botón está esperando una respuesta
           * y el foco se quedó en el botón.
           */
          <p role="alert" className="mt-4 text-sm text-acento">
            {motivoDeLogin.texto}
          </p>
        )}
        {usarEmuladores && (
          <p className="mt-4 text-xs text-tinta/65">
            Emuladores activos — la cuenta que uses es de mentira.
          </p>
        )}
        <PieVersion {...estadoVersion} />
      </div>
    );
  }

  // §5.3 — sin uno de los dos custom claims no hay escritura posible: las reglas
  // de Firestore lo rechazan igual, esto solo evita mostrar un panel inútil.
  // `!rol` y no `rol === null`: con la sesión ya resuelta (`cargando` en false y
  // `usuario` puesto) el `undefined` inicial no es alcanzable, y esta forma lo
  // **estrecha** para todo lo que sigue, así que el resto del componente no
  // necesita un `rol!` ni una rama más.
  if (!rol) {
    return (
      <div className="mx-auto max-w-md px-segura py-24 text-center">
        <AvisoVerificacion estado={verificacion} />
        <h1 className="font-serif text-xl font-semibold">Sin permisos</h1>
        <p className="mt-2 text-sm text-tinta/65">
          {usuario.email} no tiene el claim <code>admin</code> ni{' '}
          <code>publicador</code>. Correlo con{' '}
          <code className="rounded bg-tinta/8 px-1">
            npm run admin:claim -- {usuario.uid}
          </code>{' '}
          (agregale <code>--publicador</code> para el rol acotado) y volvé a entrar.
        </p>
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="mt-6 min-h-touch rounded-md border border-borde bg-white px-4 text-sm"
        >
          Salir
        </button>
        <PieVersion {...estadoVersion} />
      </div>
    );
  }

  return (
    <div
      /*
       * B-620 — el ancho lo decide la vista.
       *
       * `ANCHO_DE_LECTURA` es el de siempre y sigue siendo el default: un
       * formulario de 30+ campos a 1900px separa la etiqueta del error y pasa el
       * límite de renglón cómodo. `ANCHO_COMPLETO` es para lo que se recorre de
       * un barrido —hoy la grilla de tarjetas del listado—, y tiene tope: sin él,
       * en un monitor de 2560px las cuatro columnas darían tarjetas de 600px, o
       * sea el mismo problema con otra cara.
       *
       * El encabezado va adentro a propósito, así que se ensancha con la vista:
       * en el listado son siete controles que dejan de apretarse, y en el
       * formulario queda alineado con los campos.
       */
      className={`mx-auto px-segura py-6 ${
        ocupaTodoElAncho(vista.tipo, vistaDelPanel) ? ANCHO_COMPLETO : ANCHO_DE_LECTURA
      }`}
    >
      <AvisoVersionNueva {...estadoVersion} />
      <AvisoVerificacion estado={verificacion} />
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-borde pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl font-semibold">
            {tituloDeLaVista(vista)}
          </h1>
          <p className="truncate text-xs text-tinta/65">{usuario.email}</p>
          {/*
            **Debajo del mail** — pedido del dueño (2026-09-07). Antes vivía al
            pie del contenido, y para leerla había que scrollear el formulario
            entero: es el dato que se pide justo cuando algo no funciona. Acá
            queda al lado de quién está logueado, que es la otra mitad de «contra
            qué versión se probó».
          */}
          <PieVersion {...estadoVersion} enLinea />
        </div>
        {vista.tipo !== 'lista' && (
          <button
            type="button"
            onClick={() => salirDe(() => setVista(destinoDeVolver()))}
            className="min-h-touch shrink-0 rounded-md border border-borde bg-white px-3 text-sm"
          >
            ← Volver
          </button>
        )}
        {vista.tipo === 'lista' && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'calendario' })}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Calendario
          </button>
        )}
        {vista.tipo === 'lista' && puedeVer(rol, 'taxonomias') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'taxonomias' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Opciones
            <PendientesBadge />
          </button>
        )}
        {vista.tipo === 'lista' && puedeVer(rol, 'estadisticas') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'estadisticas' })}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Estadísticas
          </button>
        )}
        {/*
          B-1230 — la entrada al borrador del correo semanal. Solo desde el
          listado, como «Opciones» y «Estadísticas»: ahí no hay nada que perder,
          así que no va envuelta en `salirDe` (B-35).
        */}
        {vista.tipo === 'lista' && puedeVer(rol, 'boletin') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'boletin' })}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Correo
          </button>
        )}
        {/*
          B-830 — la entrada a la bandeja, con su badge de pendientes. Solo desde
          el listado, como «Opciones» y «Estadísticas»: ahí no hay nada que
          perder, así que no va envuelta en `salirDe` (B-35).
        */}
        {vista.tipo === 'lista' && puedeVer(rol, 'propuestas') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'propuestas' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Propuestas
            <PropuestasBadge />
          </button>
        )}
        {/*
          B-901 — la entrada a la Guía. Solo desde el listado, como «Opciones»,
          «Estadísticas» y «Propuestas»: ahí no hay nada que perder, así que no va
          envuelta en `salirDe` (B-35).
        */}
        {vista.tipo === 'lista' && puedeVer(rol, 'librerias') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'librerias' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Librerías
          </button>
        )}
        {/* B-832 — la segunda sección de la Guía. Mismo trato que la de arriba. */}
        {vista.tipo === 'lista' && puedeVer(rol, 'suscripciones') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'suscripciones' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Suscripciones
          </button>
        )}
        {/* B-960 — la cuarta sección de la Guía. Mismo trato que las otras. */}
        {vista.tipo === 'lista' && puedeVer(rol, 'bibliotecas') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'bibliotecas' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Bibliotecas
          </button>
        )}
        {/*
          B-959 — las efemérides. Solo desde el listado, como las de la Guía: ahí
          no hay nada que perder, así que no va envuelta en `salirDe` (B-35).
        */}
        {vista.tipo === 'lista' && puedeVer(rol, 'efemerides') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'efemerides' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Efemérides
          </button>
        )}
        {/* B-833 — la tercera sección de la Guía. */}
        {vista.tipo === 'lista' && puedeVer(rol, 'lugares') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'lugares' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Lugares
          </button>
        )}
        {vista.tipo !== 'reportes' && puedeVer(rol, 'reportes') && (
          <button
            type="button"
            onClick={() => salirDe(() => setVista({ tipo: 'reportes' }))}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
          >
            Reportar algo
          </button>
        )}
        {/*
          B-814 — el interruptor de la forma del formulario. Va en la cabecera y
          no en el formulario (decisión del dueño): es una **preferencia**, y se
          busca donde están las preferencias. Se ve en todas las pantallas, así
          que también se puede elegir antes de entrar a cargar.
        */}
        <InterruptorDeVista vista={vistaDelPanel} onCambiar={elegirVista} />
        {/*
          B-889 / D-720 — en qué formato se tipean las horas. Al lado del de
          arriba y por el mismo argumento: es una preferencia. Queda inerte en la
          vista de celular, donde el control del teléfono es el que gana.
        */}
        <InterruptorDeFormato
          formato={formatoDeHora}
          onCambiar={elegirFormatoDeHora}
          inerte={vistaDelPanel === 'celular'}
        />
        {/* Única entrada a la ayuda y a las novedades (D-61): el encabezado se
            ve en todas las pantallas, y al ser una capa se puede consultar sin
            perder el formulario a medio cargar. */}
        <BotonAyuda
          contexto={
            vista.tipo === 'lista'
              ? 'lista'
              : vista.tipo === 'calendario'
                ? 'calendario'
                : vista.tipo === 'propuestas'
                ? 'propuestas'
                : vista.tipo === 'librerias' || vista.tipo === 'libreria'
                  ? 'librerias'
                : vista.tipo === 'suscripciones' || vista.tipo === 'suscripcion'
                  ? 'suscripciones'
                : vista.tipo === 'lugares' || vista.tipo === 'lugar'
                  ? 'lugares'
                : vista.tipo === 'bibliotecas' || vista.tipo === 'biblioteca'
                  ? 'bibliotecas'
                : vista.tipo === 'efemerides' || vista.tipo === 'efemeride'
                  ? 'efemerides'
                  : vista.tipo === 'taxonomias' || vista.tipo === 'estadisticas'
                    ? 'lista'
                    : 'formulario'
          }
        />
        <button
          type="button"
          onClick={() => salirDe(() => void cerrarSesion())}
          className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/65 hover:bg-black/5"
        >
          Salir
        </button>
      </header>

      {usarEmuladores && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Conectado a los emuladores locales. Nada de esto toca producción.
        </p>
      )}

      {/*
        B-177 — arriba de la vista y no adentro del listado: al volver del
        formulario se puede caer en el listado o en el calendario (según de dónde
        se entró), y el aviso tiene que estar en las dos.
      */}
      {falloAlAceptar && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-acento/30 bg-acento/5 px-3 py-2 text-sm text-acento"
        >
          {falloAlAceptar}
        </p>
      )}

      <AvisoEtiquetas
        etiquetas={etiquetasSinRegistrar}
        onIrAOpciones={() => {
          setEtiquetasSinRegistrar([]);
          setVista({ tipo: 'taxonomias' });
        }}
        onCerrar={() => setEtiquetasSinRegistrar([])}
      />

      <PantallaDelPanel
        vista={vista}
        usuario={usuario}
        rol={rol}
        ciudad={ciudad}
        vistaDelPanel={vistaDelPanel}
        formatoDeHora={formatoDeHora}
        filtros={filtros}
        setFiltros={setFiltros}
        orden={orden}
        setOrden={setOrden}
        version={version}
        setVersion={setVersion}
        volverA={volverA}
        setVolverA={setVolverA}
        setVista={setVista}
        setEtiquetasSinRegistrar={setEtiquetasSinRegistrar}
        setFalloAlAceptar={setFalloAlAceptar}
        salirDe={salirDe}
        destinoDeVolver={destinoDeVolver}
      />
    </div>
  );
}
