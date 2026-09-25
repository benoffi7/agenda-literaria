import type { ActividadConId, ActividadForm } from '@/types/actividad';
import type { LibreriaConId } from '@/types/libreria';
import type { SuscripcionLiterariaConId } from '@/types/suscripcion-literaria';
import type { LugarConId } from '@/types/lugar';
import type { BibliotecaConId } from '@/types/biblioteca';
import type { EfemerideConId } from '@/types/efemeride';

/**
 * Las pantallas del panel, una por `tipo` (M-17). La leen el chasis
 * (`AdminApp.tsx`), que decide cuál está abierta, y el router
 * (`PantallaDelPanel.tsx`), que la monta. Es solo tipos y una función pura: no
 * arrastra nada al chunk del login (B-09, D-51).
 */
export type Vista =
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
      /** B-1235 — la foto que pidieron usar y no entró: la alerta del formulario. */
      imagenNoPromovida: string | null;
      alGuardar: (actividadId: string) => Promise<void>;
    }
  /*
   * B-901 — la Guía, primera entidad. Son **dos** vistas y no una, y el motivo es
   * el aviso de salida con cambios sin guardar: `debeConfirmarSalida` pregunta
   * por `vista.tipo`, así que un formulario montado adentro de la bandeja se
   * abandonaría sin decir nada (B-35). `librerias` es la bandeja; `libreria`, su
   * formulario, con la ficha que se edita o nada si es un alta.
   *
   * Las dos montan el **mismo** componente (`LibreriasPanel`), que es lo que
   * mantiene viva la suscripción a la colección al abrir y cerrar el formulario:
   * volver a la bandeja no cuesta una lectura nueva.
   */
  | { tipo: 'librerias' }
  | { tipo: 'libreria'; ficha?: LibreriaConId }
  /*
   * B-832 — la Guía, segunda entidad. Dos vistas por el mismo motivo que las de
   * librerías, y montando el mismo componente: así la suscripción a la colección
   * sigue viva mientras el formulario está abierto.
   */
  | { tipo: 'suscripciones' }
  | { tipo: 'suscripcion'; ficha?: SuscripcionLiterariaConId }
  /*
   * B-833 — la Guía, tercera entidad. Dos vistas por el mismo motivo que las de
   * los otros dos directorios, y montando el mismo componente: así la suscripción
   * a la colección sigue viva mientras el formulario está abierto.
   */
  | { tipo: 'lugares' }
  | { tipo: 'lugar'; ficha?: LugarConId }
  /*
   * B-960 — la Guía, cuarta entidad. Dos vistas por el mismo motivo que las
   * otras tres, y montando el mismo componente: así la suscripción a la
   * colección sigue viva mientras el formulario está abierto.
   */
  | { tipo: 'bibliotecas' }
  | { tipo: 'biblioteca'; ficha?: BibliotecaConId }
  /*
   * B-959 — las efemérides. Dos vistas por el mismo motivo que las de la Guía
   * (el aviso de salida, B-35), montando el mismo componente para que la
   * suscripción a la colección siga viva con el formulario abierto.
   */
  | { tipo: 'efemerides' }
  | { tipo: 'efemeride'; efemeride?: EfemerideConId }
  /*
   * B-1230 — el borrador del correo semanal. No lleva estado y **no lee
   * Firestore**: se arma con el `/events.json` publicado (D-801), así que es la
   * única vista del panel que no depende de la sesión más que para llegar.
   */
  | { tipo: 'boletin' };

/**
 * Las pantallas a las que vuelve un formulario al guardar o cancelar: las que
 * abren uno. El porqué de que exista está en el `volverA` de `AdminApp`.
 */
export type DestinoDeVolver =
  | 'lista'
  | 'calendario'
  | 'estadisticas'
  | 'propuestas'
  | 'librerias'
  | 'suscripciones'
  | 'lugares'
  | 'bibliotecas'
  | 'efemerides';

/**
 * El título del encabezado. `switch` y no un ternario encadenado: con veintidós
 * vistas, una que falte no compila (`never` al final).
 */
export const tituloDeLaVista = (vista: Vista): string => {
  switch (vista.tipo) {
    case 'lista':
      return 'Actividades';
    case 'nueva':
      return 'Nueva actividad';
    case 'editar':
      return vista.actividad.titulo;
    case 'duplicar':
      return `Copia de ${vista.tituloOrigen}`;
    case 'reportes':
      return 'Bugs y sugerencias';
    case 'calendario':
      return 'Calendario';
    case 'historial':
      return `Historial de ${vista.actividad.titulo}`;
    case 'taxonomias':
      return 'Opciones de los desplegables';
    case 'estadisticas':
      return 'Estado del catálogo';
    case 'boletin':
      return 'Correo semanal';
    case 'propuestas':
      return 'Propuestas';
    case 'convertir':
      return `Propuesta de ${vista.tituloOrigen}`;
    case 'librerias':
      return 'Librerías';
    case 'libreria':
      return vista.ficha ? vista.ficha.nombre : 'Librería nueva';
    case 'suscripciones':
      return 'Suscripciones';
    case 'suscripcion':
      return vista.ficha ? vista.ficha.nombre : 'Suscripción nueva';
    case 'lugares':
      return 'Lugares';
    case 'lugar':
      return vista.ficha ? vista.ficha.nombre : 'Lugar nuevo';
    case 'bibliotecas':
      return 'Bibliotecas';
    case 'biblioteca':
      return vista.ficha ? vista.ficha.nombre : 'Biblioteca nueva';
    case 'efemerides':
      return 'Efemérides';
    case 'efemeride':
      return vista.efemeride ? vista.efemeride.titulo : 'Efeméride nueva';
    default: {
      const nunca: never = vista;
      return nunca;
    }
  }
};
