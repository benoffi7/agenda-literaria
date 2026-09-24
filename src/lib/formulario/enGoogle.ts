/**
 * Lo que esta actividad pierde en Google si se publica así — B-813, la mitad
 * por-actividad.
 *
 * ── De dónde sale ─────────────────────────────────────────────────────────
 * El informe «Eventos» de Search Console del 2026-09-08 avisaba por nueve cosas,
 * y cuatro no eran del markup sino del dato: la foto (`image`), quién la da
 * (`performer`), la web del organizador (`organizer.url`) y el precio
 * (`offers.price`). El JSON-LD los emite **cuando están cargados** (B-731), así
 * que la única forma de que salgan es que alguien los cargue, y el único lugar
 * donde eso pasa es el formulario.
 *
 * La otra mitad —cuánto del catálogo entero sale con cada uno— ya es el bloque
 * «Lo que Google puede mostrar» de `estadoDelCatalogo.ts`, y como proporciones y
 * no como lista por D-273. Acá la pregunta es la misma para **una** actividad, y
 * para una sí hay algo que hacer: está abierta y el campo está a un toque.
 *
 * ── Aviso, no validación (D-440, D-900) ───────────────────────────────────
 * Ninguno de los cuatro frena nada. Una actividad sin flyer, sin tallerista, sin
 * web o sin monto se publica igual, y tiene que poder: el monto quedó opcional a
 * propósito (B-114, «a convenir») y el dueño ya sacó una vez el bloqueo de la
 * portada. Lo que no tiene que pasar es que se publique **sin que nadie se haya
 * enterado** de lo que pierde. Por eso esto no devuelve issues de zod ni rutas de
 * error: devuelve una lista que la barra pinta en gris.
 *
 * ── Una sola derivación (D-88) ────────────────────────────────────────────
 * Cada condición es **la misma función** que usa el tablero, que a su vez es la
 * condición del JSON-LD: `faltaElFlyer` (con `urlSegura`, desde B-854),
 * `diceQuienLaDa`, `webEnlazable` y `publicaPrecio` + `admiteMonto`. Si mañana el
 * JSON-LD cambia de criterio, cambian el tablero y la barra con él, y ninguno de
 * los dos puede decir «sale con precio» de algo que Google no recibe.
 *
 * ── Y solo lo accionable (D-273) ──────────────────────────────────────────
 * Lo que el formulario no pide no se avisa: en un club de lectura o un encuentro
 * no hay campo de tallerista (§11), así que decir «sale sin quién la da» sería un
 * aviso sin botón. Lo mismo el precio en gratis y a la gorra, que no admiten
 * monto: gratis ya publica `price: '0'` y a la gorra no tiene número que cargar.
 */
import { admiteMonto } from '@/lib/arancel';
import { diceQuienLaDa, webCargada, webEnlazable, publicaPrecio } from '@/lib/estadoDelCatalogo';
import { esCharla, esTaller } from '@/lib/formulario/condicionales';
import type { IdSeccion } from '@/lib/formulario/camposFaltantes';
import { faltaElFlyer } from '@/lib/imagenes';
import type { ActividadForm } from '@/types/actividad';

/** Lo que falta, con dónde se carga. */
export interface PerdidaEnGoogle {
  /** Estable: es la clave de React y la que un test nombra. No se renombra. */
  id: 'foto' | 'quien' | 'web' | 'precio';
  /** Lo que Google no va a mostrar, dicho para que siga a «sale sin». */
  etiqueta: string;
  /** La sección que hay que abrir para cargarlo. */
  seccion: IdSeccion;
}

/**
 * Lo que esta actividad no le va a dar a Google, en el orden en que el
 * resultado de búsqueda lo muestra: la foto primero, el precio al final.
 */
export const loQuePierdeEnGoogle = (form: ActividadForm): PerdidaEnGoogle[] => {
  const perdidas: PerdidaEnGoogle[] = [];

  if (faltaElFlyer(form.imagenes)) {
    perdidas.push({ id: 'foto', etiqueta: 'foto', seccion: 'que-es' });
  }

  if ((esTaller(form) || esCharla(form)) && !diceQuienLaDa(form)) {
    perdidas.push({ id: 'quien', etiqueta: 'quién la da', seccion: 'quien' });
  }

  if (!webEnlazable(form)) {
    /*
     * Dos casos con el mismo efecto y distinto arreglo. Vacía, falta cargarla.
     * Cargada y rechazada por `urlSegura` —«Casa Brandon / IG @…»— es el aviso
     * `web-que-no-enlaza` del tablero, y es el único de los cuatro que sí es un
     * defecto: decir «sin la web» de un campo que tiene algo escrito haría pensar
     * que no se guardó.
     */
    perdidas.push({
      id: 'web',
      etiqueta: webCargada(form)
        ? 'la web del organizador (lo cargado no es una dirección)'
        : 'la web del organizador',
      seccion: 'quien',
    });
  }

  if (admiteMonto(form.arancel.tipo) && !publicaPrecio(form)) {
    perdidas.push({
      id: 'precio',
      etiqueta: 'precio',
      seccion: 'arancel-inscripcion',
    });
  }

  return perdidas;
};

/** El texto que va antes de la lista. Acá y no en el `.tsx`, para que se lea en un test. */
export const ENCABEZADO_EN_GOOGLE = 'Se publica igual, pero en Google sale sin';

/**
 * Lo que va **antes** del elemento `i` de una lista de `n`: nada, coma, o «ni»
 * antes del último. «sin foto, quién la da ni precio».
 */
export const separadorEnGoogle = (i: number, n: number): string =>
  i === 0 ? '' : i === n - 1 ? ' ni ' : ', ';

/** La frase entera, en texto plano: la barra la pinta con botones, un test la lee así. */
export const textoEnGoogle = (perdidas: readonly PerdidaEnGoogle[]): string =>
  perdidas.length === 0
    ? ''
    : `${ENCABEZADO_EN_GOOGLE} ${perdidas
        .map((p, i) => separadorEnGoogle(i, perdidas.length) + p.etiqueta)
        .join('')}.`;
