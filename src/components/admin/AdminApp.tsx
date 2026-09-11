import { Suspense, lazy, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
// Estático a propósito: el aviso de versión nueva tiene que poder aparecer
// desde el primer render, incluso en la pantalla de login. No arrastra
// Firestore, así que no rompe el corte del bundle de D-51.
import { AvisoEtiquetas } from '@/components/admin/AvisoEtiquetas';
import { AvisoVersionNueva } from '@/components/admin/AvisoVersionNueva';
import { PieVersion } from '@/components/admin/PieVersion';
import { SiNoCarga } from '@/components/admin/SiNoCarga';
import { useVersionPublicada } from '@/components/admin/useVersionPublicada';
// El SDK de analítica lo carga este módulo de forma diferida, así que el
// import no engorda el chunk inicial.
import { medirPanelAbierto, registrarVersion } from '@/lib/analytics';
import { motivoDeLoginFallido, type MotivoDeLogin } from '@/lib/motivoDeLogin';
// B-620 — qué vista usa todo el ancho. Puro y con su test, por lo mismo que
// `salida-del-panel.ts`: la vista que se agregue mañana arranca angosta y quien
// la escriba decide en una línea, en vez de heredar un `===` suelto en el JSX.
import { ocupaTodoElAncho } from '@/lib/anchoDelPanel';
import { InterruptorDeVista } from '@/components/admin/InterruptorDeVista';
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
} from '@/lib/firebase-client';
// Puro: la tabla de qué ve cada rol. No toca Firestore, así que puede ser un
// import estático del chunk del login (B-09, D-51).
import { puedeVer, type RolDelPanel } from '@/lib/rolDelPanel';
// Store de módulo, sin Firestore ni React context (mismo patrón que
// `formulario-sucio.ts`): es lo que le permite a `campos-del-panel.tsx` decidir
// si ofrece «Otro…» sin cablear un booleano por seis componentes.
import { fijarRolActivo } from '@/lib/rolActivo';
import type { ActividadFormulario as TipoFormulario } from '@/components/admin/ActividadFormulario';
import type { CalendarioActividades as TipoCalendario } from '@/components/admin/CalendarioActividades';
import type { HistorialActividad as TipoHistorial } from '@/components/admin/HistorialActividad';
import type { ListaActividades as TipoLista } from '@/components/admin/ListaActividades';
import type { EstadisticasPanel as TipoEstadisticas } from '@/components/admin/EstadisticasPanel';
import type { ReportesPanel as TipoReportes } from '@/components/admin/ReportesPanel';
import type { PropuestasPanel as TipoPropuestas, Conversion } from '@/components/admin/PropuestasPanel';
import type { ActividadConId, ActividadForm } from '@/types/actividad';
import type { User } from 'firebase/auth';

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'nueva' }
  | { tipo: 'editar'; actividad: ActividadConId }
  // B-11 — la copia viaja como form, no como documento: se guarda por el camino
  // de creación, así el id, el slug y `createdAt`/`createdBy` son de la copia.
  | { tipo: 'duplicar'; copia: ActividadForm; tituloOrigen: string }
  | { tipo: 'reportes' }
  // La vista calendario es de solo lectura: enumera encuentros y, al tocar uno,
  // abre la actividad. No necesita estado propio (D-70).
  | { tipo: 'calendario' }
  // B-40 — historial de versiones de UNA actividad. Lleva la actividad y no solo
  // su id porque la comparación es contra el documento actual, y el listado ya
  // lo tiene en memoria: entrar no cuesta una lectura.
  | { tipo: 'historial'; actividad: ActividadConId }
  // B-170 — administración de las taxonomías del §4. No lleva estado: la
  // pantalla lee `/opciones/*` sola.
  | { tipo: 'taxonomias' }
  // B-370 — «Estado del catálogo», el tablero de docs/16-analitica-del-sitio.md.
  // No lleva estado: la pantalla lee `/actividades` sola, como el listado.
  | { tipo: 'estadisticas' }
  // B-830 — la bandeja de propuestas. Como `reportes`: no lleva estado, la
  // pantalla lee `/propuestas` sola.
  | { tipo: 'propuestas' }
  /*
   * B-830 — una propuesta convertida en formulario. Es `duplicar` con dos
   * diferencias, y las dos son de D-600:
   *
   *  - lleva los `avisos` de lo que la conversión **no** pudo prellenar, que se
   *    leen mientras se corrige;
   *  - y lleva `alGuardar`, el segundo movimiento: marcar la propuesta aceptada
   *    con el id de la actividad **recién cuando la actividad existe**. La
   *    función la arma la bandeja (es la que puede escribir en `/propuestas`) y
   *    viaja acá adentro por el corte del bundle: `AdminApp` está en el chunk del
   *    login y no puede importar nada que toque Firestore (B-09, D-51).
   */
  | {
      tipo: 'convertir';
      copia: ActividadForm;
      tituloOrigen: string;
      avisos: readonly string[];
      alGuardar: (actividadId: string) => Promise<void>;
    };

/**
 * B-09 — carga diferida del panel autenticado.
 *
 * El listado y el formulario son los que arrastran el SDK de Firestore
 * (`@/lib/firestore-client`) y, con él, la mitad del bundle. Nadie los ve antes
 * de loguearse ni sin el claim `admin`, así que se cargan por `import()`: la
 * pantalla de login baja solo React + `firebase/auth`.
 *
 * El `Suspense` va acá adentro a propósito: así los puntos de uso del JSX no
 * cambian y el diff queda contenido en este bloque.
 */
const diferido = <P extends object>(
  cargar: () => Promise<{ default: (props: P) => ReactNode }>,
): ComponentType<P> => {
  const Cargado = lazy(cargar);
  return (props: P) => (
    /*
     * `SiNoCarga` envuelve el `Suspense` y no al revés — reporte del 2026-09-07.
     * Una pestaña abierta desde antes de un deploy apunta a chunks que Hosting ya
     * borró, y un `import()` que falla adentro de `lazy` tira hacia arriba: sin
     * este límite, React desmonta el árbol y **el panel queda en blanco**, sin
     * mensaje y sin nada que tocar.
     *
     * Va acá, en el helper, y así cubre de una las ocho vistas que pasan por él.
     * Las otras dos puertas de carga del panel llevan el suyo: la subida de
     * imágenes con un `try` propio —ahí el error no pasa por el render— y el
     * centro de ayuda, que se monta desde el encabezado y desde cada sección del
     * formulario, o sea **fuera** de este helper. Esa última quedó sin límite hasta
     * que los auditores la encontraron, y hoy lo verifica un chequeo de clase.
     */
    <SiNoCarga>
      <Suspense fallback={<p className="p-8 text-sm text-tinta/50">Cargando…</p>}>
        <Cargado {...props} />
      </Suspense>
    </SiNoCarga>
  );
};

// Los props salen del componente real vía `import type` (se borra al compilar,
// no genera import en runtime). Hay que anotarlos explícitamente: dentro de un
// `.then()` TypeScript no puede inferir `P`.
const ListaActividades = diferido<Parameters<typeof TipoLista>[0]>(() =>
  import('@/components/admin/ListaActividades').then((m) => ({ default: m.ListaActividades })),
);

const ActividadFormulario = diferido<Parameters<typeof TipoFormulario>[0]>(() =>
  import('@/components/admin/ActividadFormulario').then((m) => ({
    default: m.ActividadFormulario,
  })),
);

// Diferido igual que las otras dos vistas: ReportesPanel lee y escribe
// /reportes, así que arrastra Firestore. Estático devolvería el SDK al chunk
// del login y desharía el corte de B-09.
const ReportesPanel = diferido<Parameters<typeof TipoReportes>[0]>(() =>
  import('@/components/admin/ReportesPanel').then((m) => ({ default: m.ReportesPanel })),
);

// Diferida por la misma razón que las otras vistas: lee /actividades, así que
// arrastra Firestore y no puede volver al chunk del login (B-09, D-51).
const CalendarioActividades = diferido<Parameters<typeof TipoCalendario>[0]>(() =>
  import('@/components/admin/CalendarioActividades').then((m) => ({
    default: m.CalendarioActividades,
  })),
);

// B-40 — ídem, y con una razón de más: es la vista menos usada del panel
// (recuperar un campo pisado es una operación rara), así que es justo la que no
// tiene por qué viajar en el chunk que se baja para mostrar "Entrar con Google".
const HistorialActividad = diferido<Parameters<typeof TipoHistorial>[0]>(() =>
  import('@/components/admin/HistorialActividad').then((m) => ({
    default: m.HistorialActividad,
  })),
);

// B-170 — ídem: la administración de taxonomías se abre poco y el contador de
// pendientes que lleva al lado importa Firestore, así que ninguno de los dos
// tiene por qué viajar en el chunk del login.
const TaxonomiasPanel = diferido<object>(() =>
  import('@/components/admin/taxonomias/TaxonomiasPanel').then((m) => ({
    default: m.TaxonomiasPanel,
  })),
);

// B-370 — ídem: el tablero lee /actividades, así que arrastra Firestore. Y es
// además la pantalla que se abre de a ratos y no en cada carga, así que es justo
// la que no tiene por qué viajar en el chunk del login (B-09, D-51, B-117).
const EstadisticasPanel = diferido<Parameters<typeof TipoEstadisticas>[0]>(() =>
  import('@/components/admin/EstadisticasPanel').then((m) => ({
    default: m.EstadisticasPanel,
  })),
);

// Diferida por lo mismo que las otras vistas: la bandeja lee y escribe
// `/propuestas`, así que arrastra Firestore (B-09, D-51).
const PropuestasPanel = diferido<Parameters<typeof TipoPropuestas>[0]>(() =>
  import('@/components/admin/PropuestasPanel').then((m) => ({ default: m.PropuestasPanel })),
);

const PropuestasBadge = diferido<object>(() =>
  import('@/components/admin/PropuestasBadge').then((m) => ({ default: m.PropuestasBadge })),
);

const PendientesBadge = diferido<object>(() =>
  import('@/components/admin/taxonomias/PendientesBadge').then((m) => ({
    default: m.PendientesBadge,
  })),
);

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
 * El router es propio y mínimo: lista, nueva, editar, duplicar, reportes y
 * calendario.
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
  const [version, setVersion] = useState(0);

  // Una sola llamada: el hook hace el fetch de /version.json y el reload().
  // Dos componentes llamándolo serían dos chequeos y, en el peor caso, dos
  // recargas. Se reparte al aviso y al pie.
  const estadoVersion = useVersionPublicada();

  /**
   * A dónde vuelve el formulario al guardar o cancelar. Sin esto, editar desde
   * el calendario devolvía al listado y se perdía el mes que se estaba
   * mirando — que en una vista de calendario es la mitad del contexto.
   */
  const [volverA, setVolverA] = useState<'lista' | 'calendario' | 'estadisticas' | 'propuestas'>(
    'lista',
  );

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
      const suRol = u ? await rolDelPanel(u) : null;
      setRol(suRol);
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
    return <p className="p-8 text-sm text-tinta/50">Cargando…</p>;
  }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-sm px-segura py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Panel de carga</h1>
        <p className="mt-2 text-sm text-tinta/60">
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
          <p className="mt-4 text-xs text-tinta/45">
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
        <h1 className="font-serif text-xl font-semibold">Sin permisos</h1>
        <p className="mt-2 text-sm text-tinta/60">
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
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-borde pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-xl font-semibold">
            {vista.tipo === 'lista'
              ? 'Actividades'
              : vista.tipo === 'nueva'
                ? 'Nueva actividad'
                : vista.tipo === 'duplicar'
                  ? `Copia de ${vista.tituloOrigen}`
                  : vista.tipo === 'reportes'
                    ? 'Bugs y sugerencias'
                    : vista.tipo === 'calendario'
                      ? 'Calendario'
                      : vista.tipo === 'historial'
                        ? `Historial de ${vista.actividad.titulo}`
                        : vista.tipo === 'taxonomias'
                          ? 'Opciones de los desplegables'
                          : vista.tipo === 'estadisticas'
                            ? 'Estado del catálogo'
                            : vista.tipo === 'propuestas'
                              ? 'Propuestas'
                              : vista.tipo === 'convertir'
                                ? `Propuesta de ${vista.tituloOrigen}`
                                : vista.actividad.titulo}
          </h1>
          <p className="truncate text-xs text-tinta/50">{usuario.email}</p>
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
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Calendario
          </button>
        )}
        {vista.tipo === 'lista' && puedeVer(rol, 'taxonomias') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'taxonomias' })}
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Opciones
            <PendientesBadge />
          </button>
        )}
        {vista.tipo === 'lista' && puedeVer(rol, 'estadisticas') && (
          <button
            type="button"
            onClick={() => setVista({ tipo: 'estadisticas' })}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Estadísticas
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
            className="min-h-touch flex shrink-0 items-center rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
          >
            Propuestas
            <PropuestasBadge />
          </button>
        )}
        {vista.tipo !== 'reportes' && puedeVer(rol, 'reportes') && (
          <button
            type="button"
            onClick={() => salirDe(() => setVista({ tipo: 'reportes' }))}
            className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
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
                : vista.tipo === 'taxonomias' || vista.tipo === 'estadisticas'
                  ? 'lista'
                  : 'formulario'
          }
        />
        <button
          type="button"
          onClick={() => salirDe(() => void cerrarSesion())}
          className="min-h-touch shrink-0 rounded-md px-3 text-xs text-tinta/55 hover:bg-black/5"
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

      {vista.tipo === 'lista' && (
        <ListaActividades
          version={version}
          onNueva={() => {
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'nueva' });
          }}
          onEditar={(a) => {
            // Se resetea acá y no solo se setea en el calendario: si no, la
            // preferencia queda pegada y una edición desde el listado
            // devolvería al calendario.
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
          onDuplicar={(copia, tituloOrigen) => {
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'duplicar', copia, tituloOrigen });
          }}
          uid={usuario.uid}
          rol={rol}
          onHistorial={(a) => {
            setVolverA('lista');
            setVista({ tipo: 'historial', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'historial' && (
        <HistorialActividad
          actividad={vista.actividad}
          uid={usuario.uid}
          // Restaurar es una edición del documento: el listado tiene que
          // releerlo, igual que después de guardar el formulario.
          onRestaurado={() => setVersion((v) => v + 1)}
        />
      )}

      {vista.tipo === 'calendario' && (
        <CalendarioActividades
          version={version}
          rol={rol}
          uid={usuario.uid}
          onEditar={(a) => {
            setVolverA('calendario');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'taxonomias' && <TaxonomiasPanel />}

      {vista.tipo === 'estadisticas' && (
        <EstadisticasPanel
          onEditar={(a) => {
            // Vuelve al tablero y no al listado, con el mismo criterio que el
            // calendario: se llegó acá desde un aviso, y lo más probable es que
            // haya más de uno para atender en la misma sentada.
            setVolverA('estadisticas');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'reportes' && (
        <ReportesPanel usuario={{ uid: usuario.uid, email: usuario.email }} />
      )}

      {vista.tipo === 'propuestas' && (
        <PropuestasPanel
          usuario={{ uid: usuario.uid }}
          onConvertir={(c: Conversion) => {
            // Vuelve a la bandeja y no al listado: se llegó acá desde ahí y lo
            // más probable es que haya más de una para atender en la misma
            // sentada (mismo criterio que el tablero).
            setVolverA('propuestas');
            setEtiquetasSinRegistrar([]);
            setFalloAlAceptar(null);
            setVista({
              tipo: 'convertir',
              copia: c.copia,
              tituloOrigen: c.tituloOrigen,
              avisos: c.avisos,
              alGuardar: c.alGuardar,
            });
          }}
        />
      )}

      {(vista.tipo === 'nueva' ||
        vista.tipo === 'editar' ||
        vista.tipo === 'duplicar' ||
        vista.tipo === 'convertir') && (
        <ActividadFormulario
          uid={usuario.uid}
          rol={rol}
          vistaDelPanel={vistaDelPanel}
          inicial={vista.tipo === 'editar' ? vista.actividad : undefined}
          copia={
            vista.tipo === 'duplicar' || vista.tipo === 'convertir' ? vista.copia : undefined
          }
          tituloOrigen={
            vista.tipo === 'duplicar' || vista.tipo === 'convertir'
              ? vista.tituloOrigen
              : undefined
          }
          origenDeLaCopia={vista.tipo === 'convertir' ? 'propuesta' : 'duplicado'}
          avisos={vista.tipo === 'convertir' ? vista.avisos : undefined}
          onCancelar={() => salirDe(() => setVista({ tipo: volverA }))}
          onGuardado={(id, sinRegistrar) => {
            setVersion((v) => v + 1);
            setEtiquetasSinRegistrar(sinRegistrar ?? []);
            /*
             * D-600, segundo movimiento: la actividad ya existe, así que ahora
             * —y solo ahora— la propuesta pasa a `aceptada` con su id. No se
             * espera para cambiar de vista: el guardado ya salió y dejar el
             * formulario montado mientras viaja un `update` no aporta nada.
             */
            if (vista.tipo === 'convertir') {
              void vista.alGuardar(id).catch((e: unknown) => {
                setFalloAlAceptar(
                  'La actividad se guardó, pero la propuesta quedó sin marcar como aceptada' +
                    ` (${e instanceof Error ? e.message : 'error desconocido'}).` +
                    ' Marcala a mano desde la bandeja: si no, se convierte dos veces.',
                );
              });
            }
            setVista({ tipo: volverA });
          }}
        />
      )}
    </div>
  );
}
