/**
 * Lo que dice una **tarjeta** del listado del panel — B-620.
 *
 * ── Por qué es un módulo y no está dentro del componente ──────────────────
 * Es el mismo corte que `lib/tarjetaPublica.ts` hace del otro lado, y por el
 * mismo motivo que `docs/05-patrones.md` fija: los componentes del panel no
 * tienen tests de render salvo para el cableado de DOM que un test de fuente no
 * puede medir, así que **toda frase que haya que decidir** —qué dice una
 * actividad sin encuentros por venir, qué modalidad se lee cuando hay dos filas,
 * cuándo aparece «Sin flyer»— tiene que vivir afuera para poder verificarse.
 *
 * Antes de B-620 esas decisiones eran cinco cadenas de ternarios adentro del JSX
 * de `ListaActividades.tsx`, y ahí no se podían testear de ninguna manera. El
 * pase de fila a tarjeta era el momento de sacarlas: la tarjeta dice **dos datos
 * más** que la fila (la modalidad y el arancel), y agregarlos como dos ternarios
 * más habría dejado siete decisiones sin red.
 *
 * ── Qué se quedó en el componente, a propósito ────────────────────────────
 * El **badge de estado**. Es lo único de la tarjeta que lleva tinta además de
 * texto (`COLOR_ESTADO`), y la etiqueta ya sale de un mapa compartido con el
 * formulario (`ETIQUETA_ESTADO`, B-76): pasarla por acá sería un salto más sin
 * quitar ninguna decisión, y partiría en dos un badge cuyo color y cuyo texto se
 * eligen juntos.
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * Igual que en `filtrosActividades.ts` y en `functions/rebuild.js`: un test no
 * puede depender de qué día es hoy.
 *
 * ── La entrada es el documento CRUDO, y eso no es un descuido ─────────────
 * Este módulo es **del panel**, que ve el documento entero porque quien lo mira
 * es un admin. Su equivalente público, `lib/tarjetaPublica.ts`, recibe en cambio
 * una `EntradaDeIndice` ya proyectada, justamente para no poder publicar lo que
 * `toPublic` decidió no publicar (D-140).
 *
 * De ahí la regla que lo acompaña, y que la trajo el `auditor-privacidad`:
 * **ninguna salida pública puede importar este módulo.** Lo que calcula —la
 * modalidad resultante, la etiqueta del arancel, el próximo encuentro— es
 * exactamente lo que la tarjeta del sitio también necesita, así que reusarlo
 * desde ahí es la tentación probable; y si pasara, se publicaría `autoria`, o
 * sea cuántas cuentas cargan y qué cargó cada una (el razonamiento de D-57 y
 * D-138), sin que ningún campo nuevo del modelo lo delate. Las dos mitades
 * —ningún campo interno llega al view-model, y ningún productor público lo
 * importa— las fija `tests/tarjeta-del-panel.test.ts`.
 */
import { esSinCosto } from '@/lib/arancel';
import { fechaHoraLegible } from '@/lib/calendarioPanel';
import {
  ETIQUETA_MODALIDAD,
  legible,
  proximoEncuentro,
} from '@/lib/filtrosActividades';
import { ETIQUETA_AUTORIA, autoriaDe } from '@/lib/formulario/autoria';
import { faltaElFlyer, imagenesDe } from '@/lib/imagenes';
import { modalidadResultante } from '@/lib/modalidades';
// Type-only: `vistaPreviaEvento` importa `formADocumento`, que arrastra
// Firestore. El import se borra al compilar, así que no toca el corte del
// bundle de D-51 — es la misma forma que ya usan `ListaActividades` y
// `FiltrosActividades`.
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadConId } from '@/types/actividad';

/**
 * Lo que la tarjeta necesita saber de afuera: las etiquetas de taxonomía que el
 * panel ya tiene cargadas (§4.1), el reloj y quién está mirando.
 */
export interface ContextoDeTarjeta {
  labels: LabelsTaxonomia;
  ahora: Date;
  /** B-130 — para distinguir lo propio de lo que cargó la otra cuenta. */
  uid: string;
}

/**
 * El view-model de una tarjeta.
 *
 * Las líneas viajan como **listas de piezas** y no como cadenas ya unidas con
 * `·`: el separador es maquetación, y en una tarjeta angosta el componente puede
 * necesitar cortar la línea entre dos piezas. Armar la cadena acá y volver a
 * partirla allá es la derivación de ida y vuelta que este módulo existe para
 * evitar.
 *
 * Una pieza vacía no viaja: la lista trae solo lo que hay que decir, así que el
 * componente nunca tiene que pintar un `·` colgado.
 */
export interface TarjetaDelPanel {
  /** «Club de lectura · 8 encuentros» — qué es y cuánto dura. */
  identidad: string[];
  /** «Presencial y virtual · Villa Crespo» — cómo se cursa y dónde. */
  donde: string[];
  /** La etiqueta del arancel, o `''` si el campo no está cargado. */
  arancel: string;
  /**
   * `true` para gratis y a la gorra (`lib/arancel.ts`): la tarjeta lo pinta con
   * el acento, con el mismo criterio que la fila del sitio público.
   */
  sinCosto: boolean;
  /** «Próximo: lunes 24 de agosto · 19:00», o que no queda nada por pasar. */
  cuando: string;
  /**
   * ¿Le queda algo por pasar? Lo separa de `cuando` porque la tarjeta lo usa
   * para **apagar** la línea, y un consumidor que tenga que deducirlo comparando
   * el texto contra una frase literal se rompe el día que la frase cambia.
   */
  hayProximo: boolean;
  /**
   * Las marcas que solo aparecen cuando dicen algo: «Cupo completo» (B-97) y
   * «Sin flyer» (B-264). Vacía es el caso normal — si todo llevara marca, la
   * marca dejaría de avisar.
   */
  marcas: string[];
  /**
   * B-130 — «La cargó otra cuenta», o `null`. Va aparte de `marcas` y no
   * mezclada con ellas porque no es del mismo orden: las dos marcas describen
   * algo **que hay que atender**, y ésta describe de quién es. En la fila se
   * pintaban con pesos distintos y la tarjeta conserva esa diferencia.
   */
  autoria: string | null;
}

/** La etiqueta de un valor de taxonomía, con la legibilización como respaldo (§4.1). */
const etiqueta = (labels: LabelsTaxonomia, campo: 'tipo' | 'barrio' | 'arancel', valor: string) =>
  labels[campo]?.[valor] ?? legible(valor);

/**
 * Las piezas de una línea, sin las vacías.
 *
 * Es lo que hace cierto el contrato de `TarjetaDelPanel`: el componente une con
 * `·` sin preguntar nada, así que una pieza vacía se vería como un separador
 * colgado al principio de la línea. Pasa con un documento a medio crear —un
 * `tipo` sin cargar da etiqueta vacía— y filtrar acá es más barato que hacer que
 * cada consumidor se acuerde.
 */
const piezas = (partes: string[]): string[] => partes.filter((p) => p !== '');

/** «8 encuentros» / «1 encuentro». */
const cuantosEncuentros = (cantidad: number): string =>
  `${cantidad} ${cantidad === 1 ? 'encuentro' : 'encuentros'}`;

export const datosDeTarjeta = (
  a: ActividadConId,
  { labels, ahora, uid }: ContextoDeTarjeta,
): TarjetaDelPanel => {
  const proximo = proximoEncuentro(a, ahora);
  /*
   * B-224 — la modalidad **resultante**, la misma derivación que usan el filtro
   * y el `events.json`: con dos filas que difieren, la tarjeta dice «Presencial
   * y virtual» y no la de la primera fila, que dependería del orden del array
   * (la trampa 2 en otra forma). El `?? [{ modalidad: a.modalidad }]` es el
   * default de lectura de un documento sin la lista.
   */
  const modalidad = modalidadResultante(a.modalidades ?? [{ modalidad: a.modalidad }]);
  const slugArancel = a.arancel?.tipo ?? '';

  return {
    identidad: piezas([
      etiqueta(labels, 'tipo', a.tipo),
      cuantosEncuentros(a.sesiones?.length ?? 0),
    ]),
    donde: piezas([
      ETIQUETA_MODALIDAD[modalidad],
      // La sede es la principal —«la primera fila que tenga»— y el documento ya
      // la trae derivada (B-224). Puede no haber ninguna: una actividad solo
      // virtual no tiene barrio.
      a.sede?.barrio ? etiqueta(labels, 'barrio', a.sede.barrio) : '',
    ]),
    arancel: slugArancel ? etiqueta(labels, 'arancel', slugArancel) : '',
    sinCosto: esSinCosto(slugArancel),
    // B-96 — la fecha que importa es la que viene, no la última modificación: es
    // lo que hace accionable el listado.
    cuando: proximo ? `Próximo: ${fechaHoraLegible(proximo)}` : 'Sin encuentros por venir',
    hayProximo: proximo !== null,
    marcas: [
      // B-97 — lo que se publica se ve desde el panel: el sitio y el calendario
      // ya están diciendo que se llenó.
      ...(a.inscripcion?.completo === true ? ['Cupo completo'] : []),
      /*
       * B-264 — **solo en las publicadas, y solo cuando falta.** Un borrador sin
       * flyer no le falta nada todavía; una publicada sin flyer ya está afuera de
       * la cartelera. La condición sale de `faltaElFlyer`, la misma que usan el
       * aviso del formulario y la cartelera.
       */
      ...(a.estado === 'publicado' && faltaElFlyer(imagenesDe(a)) ? ['Sin flyer'] : []),
    ],
    autoria: ETIQUETA_AUTORIA[autoriaDe(a, uid)],
  };
};
