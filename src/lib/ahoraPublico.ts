/**
 * «¿Qué hay ahora?» — los tres paneles de programación inmediata de la home
 * (**B-600**), la mitad de UI que **B-99** había dejado pendiente.
 *
 * ── Qué problema resuelve ─────────────────────────────────────────────────
 * El modelo es centrado en la **actividad** y eso está bien (§2.2 del
 * `CLAUDE.md`): un club de ocho encuentros es una tarjeta. Pero la pregunta que
 * se le hace a una agenda es «¿qué hay el sábado?», que es centrada en el
 * **encuentro**, y el listado de la home no la contesta: ordena por próxima
 * fecha, así que un ciclo que arrancó en agosto aparece arriba con su próximo
 * encuentro del 20 y hay que abrir tarjetas para saber qué pasa hoy.
 *
 * Esto lo contesta de un vistazo, y sin ningún dato nuevo: sale del **eje plano
 * de encuentros** que B-99 metió en el `events.json` (`{slug, sesionId,
 * inicio}`, próximos, ordenados), cruzado contra las actividades del mismo
 * índice. Aplanar los ciclos en el navegador en cada filtrado era justamente lo
 * que ese eje vino a evitar.
 *
 * ── Por qué es un módulo puro y no vive en el componente ──────────────────
 * Por lo mismo que `tarjetaPublica.ts`: los componentes de React de este repo no
 * tienen tests de render (`docs/05-patrones.md`), así que «qué panel es el finde
 * cuando hoy es sábado» no se podría verificar de ninguna manera si viviera en
 * un `.tsx`. Y acá hay más que frases: hay **aritmética de calendario en una zona
 * con offset**, que es la trampa 1 del §13 en su versión más filosa.
 *
 * El componente recibe strings ya decididos y no toca una `EntradaDeIndice`: es
 * la forma de D-140, y además lo exige `tests/listado-del-sitio.test.ts`, que
 * falla si un componente de `components/publico` que no es la fila le lee un
 * campo a la entrada.
 *
 * ── Las tres ventanas ─────────────────────────────────────────────────────
 * | Panel | Qué agarra |
 * |---|---|
 * | **Hoy** | lo que **queda** de hoy |
 * | **Mañana** | el día siguiente, entero |
 * | **Este finde** / **El finde que viene** | el sábado y el domingo, **menos** lo que ya contaron los dos primeros |
 *
 * La resta del tercero no es un detalle: un viernes, «mañana» y «este finde»
 * comparten el sábado, y el mismo encuentro repetido en dos paneles pegados de
 * un tríptico se lee como un error de software (no es el caso de una destacada
 * apareciendo en la tira y en su mes, que están a media pantalla de distancia).
 * Cuando la resta deja el finde en curso sin días —o sea hoy es sábado o
 * domingo— la ventana pasa al finde siguiente y **el rótulo lo dice**: nunca se
 * llama «este finde» a un sábado que falta una semana.
 *
 * ── Y por qué el rótulo no alcanza: la fecha va escrita ───────────────────
 * Cada panel imprime **los días que abarca** («Hoy · vie 15 sep»). El HTML lo
 * arma el build con su reloj y el sitio se rehace solo cuando cambia un dato
 * (§8), así que una página servida tres días después de la última carga diría
 * «Hoy» de un viernes que ya pasó. La island lo recalcula con el reloj de quien
 * mira —el mismo argumento de B-111 y del §6.4— y, mientras eso no ocurra (o si
 * el JavaScript está apagado), la fecha escrita es lo que impide que el rótulo
 * mienta sin que se note.
 */
import { arancelDeTarjeta, lugarDeTarjeta, type ArancelDeTarjeta } from '@/lib/tarjetaPublica';
import {
  claveDeDia,
  diaDeSemana,
  diaDesplazado,
  fechaCorta,
  fechaCortaDeDia,
  hora,
  partesDeFecha,
} from '@/lib/fechasPublicas';
import { etiquetaDe, type MapaDeEtiquetas } from '@/lib/listadoPublico';
import { instanteDeIso } from '@/lib/sesiones';
import { rutaDeDetalle } from '@/lib/rutasPublicas';
import type { EntradaDeIndice, Indice } from '@/lib/eventsJson';

/**
 * Cuántos encuentros muestra un panel antes de cortar.
 *
 * Cuatro y no «todos»: el tríptico es la **portada del programa**, y un panel de
 * doce filas deja de leerse de un vistazo y empuja el listado abajo del pliegue
 * en un teléfono —que es el argumento de D-143 sobre los filtros, acá otra vez—.
 * Lo que queda afuera no se esconde: el panel dice cuántos son, y el listado
 * completo está en la misma página, unos centímetros más abajo.
 */
export const TOPE_DEL_PANEL = 4;

export type ClaveDePanel = 'hoy' | 'manana' | 'finde';

/** Un encuentro como lo muestra un panel: strings ya decididos, nada que derivar. */
export interface EncuentroDePanel {
  /** `slug#sesionId` — identifica la fila del panel, y es la `key` de React. */
  clave: string;
  /** La URL de la página de detalle de la actividad. */
  ruta: string;
  /** ISO del inicio, para el `datetime` del `<time>`. */
  iso: string;
  /** `19:00`. */
  hora: string;
  /**
   * `sáb 16`, y solo cuando el panel abarca **más de un día**.
   *
   * En «Hoy» y en «Mañana» el día ya lo dijo el encabezado del panel, y
   * repetirlo en cada fila es ruido; en el finde son dos días y sin esto no se
   * sabe cuál de los dos.
   */
  dia: string | null;
  titulo: string;
  /** El slug del tipo — con él el componente pide el color a `estiloDeTipo` (D-150). */
  tipo: string;
  /** La etiqueta del tipo, resuelta contra `/opciones` (§4.4). */
  tipoEtiqueta: string;
  /** `Casa Brandon · Boedo, CABA`, o `Online por Zoom`. Sale de `lugarDeTarjeta`. */
  lugar: string;
  arancel: ArancelDeTarjeta;
}

export interface PanelDeAhora {
  clave: ClaveDePanel;
  /** `Hoy` · `Mañana` · `Este finde` · `El finde que viene`. */
  rotulo: string;
  /** Los días que abarca, escritos: `vie 15 sep`, `sáb 16 sep y dom 17 sep`. */
  fechas: string;
  /**
   * Los primeros `TOPE_DEL_PANEL`.
   *
   * No viaja el total de la ventana: lo que el panel necesita saber del resto lo
   * dice `resto`, ya en palabras. Un `cuantos` de más sería un dato que el
   * componente puede imprimir sin que nadie haya decidido cómo se lee («HOY 3»
   * no dice tres qué).
   */
  encuentros: EncuentroDePanel[];
  /** Cuántos quedaron afuera del tope. `0` si entraron todos. */
  restantes: number;
  /**
   * `+2 más hoy` — los que el tope dejó afuera, o `null` si entraron todos.
   *
   * **No es un enlace, y eso es una decisión**: el día no es una URL de este
   * sitio (§2.3 del diseño decide qué es página y qué es filtro, y el día no está
   * en ninguna de las dos listas), así que no hay ningún «ver el cronograma de
   * hoy» al que mandar. Lo que sí hay es el listado completo, en esta misma
   * página y unos centímetros más abajo. Inventar acá una página por día sería
   * decidir de paso una decena de URLs indexables, que no es algo que se resuelva
   * en el pie de un panel.
   */
  resto: string | null;
  /** Qué dice el panel cuando no tiene ningún encuentro. */
  vacio: string;
}

/**
 * Las frases de cada panel, que es lo que cambia entre los tres.
 *
 * Están juntas y no interpoladas en el armado porque son **texto de producto**:
 * el día que «Nada hoy» tenga que decir otra cosa se cambia acá, en las tres, y
 * no repartido en dos ramas de un `map`.
 *
 * «Por hoy no queda nada» y no «hoy no hay nada»: a las once de la noche las dos
 * frases describen el mismo panel vacío y solo una es cierta.
 */
const FRASES: Record<ClaveDePanel, { vacio: string; resto: (n: number) => string }> = {
  hoy: { vacio: 'Por hoy no queda nada.', resto: (n) => `+${n} más hoy` },
  manana: { vacio: 'Todavía no hay nada para mañana.', resto: (n) => `+${n} más mañana` },
  finde: { vacio: 'Todavía no hay nada para ese finde.', resto: (n) => `+${n} más ese finde` },
};

/**
 * Lo que la sección entera necesita: los tres paneles y **de cuándo son los
 * datos**.
 *
 * El sello va acá y no lo arma cada llamador por el mismo motivo que el `null`
 * de abajo: lo pinta el build y lo pinta la island.
 */
export interface ProgramacionInmediata {
  /** `Actualizado: vie 3 sep, 14:30` — el `generadoEn` del índice, legible. */
  sello: string;
  paneles: PanelDeAhora[];
}

/** Una ventana de días calendario, con su rótulo ya decidido. */
interface Ventana {
  clave: ClaveDePanel;
  rotulo: string;
  /** Claves de día (`2026-09-15`), en orden. */
  dias: string[];
}

/**
 * Las tres ventanas, en claves de día de la zona del proyecto.
 *
 * Exportada porque es **lo único que hay que testear a fondo** de este módulo:
 * los siete días de la semana dan siete formas distintas del tríptico, y el
 * cruce contra los encuentros de arriba es mecánico al lado de esto.
 *
 * El finde es el de la **semana en curso** contada de lunes a domingo: el sábado
 * que se busca es el primero que cae en `hoy` o después dentro de esa semana. Un
 * domingo no tiene ninguno —el de su semana fue ayer—, así que la cuenta cae en
 * el de la semana siguiente, y por eso el rótulo se decide con el día de la
 * semana y no con la distancia en días.
 */
export const ventanasDeAhora = (ahora: Date): Ventana[] => {
  const hoy = claveDeDia(ahora);
  const manana = diaDesplazado(hoy, 1);
  const dow = diaDeSemana(hoy);

  // `(6 - dow + 7) % 7`: sábado a sábado da 0, lunes da 5, y **domingo da 6** —
  // el sábado de la semana que viene, que es lo correcto: el de su propia semana
  // ya pasó.
  const sabado = diaDesplazado(hoy, (6 - dow + 7) % 7);
  const domingo = diaDesplazado(sabado, 1);

  // La resta: lo que ya contaron «Hoy» y «Mañana» no se repite en el finde.
  const delFinde = [sabado, domingo].filter((d) => d !== hoy && d !== manana);
  // Sábado y domingo, o los dos ya contados: la ventana salta una semana. Es el
  // único caso en que el panel habla de algo que no es «lo que viene ya», y por
  // eso es también el único en que cambia el rótulo.
  const salta = delFinde.length === 0;
  const findeSiguiente = [diaDesplazado(sabado, 7), diaDesplazado(domingo, 7)];

  return [
    { clave: 'hoy', rotulo: 'Hoy', dias: [hoy] },
    { clave: 'manana', rotulo: 'Mañana', dias: [manana] },
    {
      clave: 'finde',
      // Un domingo no salta —el sábado que viene está a seis días, no se solapa
      // con nada— pero tampoco es «este finde»: el finde de su semana se está
      // terminando. Los dos casos comparten rótulo por razones distintas.
      rotulo: salta || dow === 0 ? 'El finde que viene' : 'Este finde',
      dias: salta ? findeSiguiente : delFinde,
    },
  ];
};

/**
 * `Actualizado: vie 3 sep, 14:30` — cuándo se generó lo que se está mirando.
 *
 * Es el dato que explica por qué una actividad cargada hace diez minutos todavía
 * no está: el sitio es estático y se rehace cuando cambia algo, con unos minutos
 * de latencia (§8). Sin esto, «Hoy» promete ser el estado del mundo y no lo es.
 *
 * Sale de `generadoEn`, que es el instante que el propio índice declara — el
 * mismo reloj con el que se armó el HTML.
 */
const selloDelIndice = (generadoEn: string): string => {
  const d = instanteDeIso(generadoEn);
  // Un `generadoEn` ilegible no puede tirar abajo la home: sin sello se pierde
  // una línea de contexto, y con una excepción se pierde la página entera.
  return d ? `Actualizado: ${fechaCorta(d)}, ${hora(d)}` : '';
};

/** `vie 15 sep`, o `sáb 16 sep y dom 17 sep`. */
const fechasDeVentana = (dias: readonly string[]): string =>
  dias.map(fechaCortaDeDia).join(' y ');

/**
 * Los tres paneles, o `null` cuando no hay **nada** en ninguna de las tres
 * ventanas.
 *
 * El `null` es la decisión de no dibujar la sección, y se toma **acá y no en
 * cada llamador**: la pinta el HTML del build y la pinta la island, y dos
 * condiciones escritas por separado son dos maneras de que una se quede vieja
 * (la clase de B-88). Un tríptico de tres «nada» no es una portada del programa:
 * es un hueco que ocupa el lugar de lo que sí hay.
 *
 * Un panel vacío **con los otros dos llenos sí se dibuja**, y dice que no hay
 * nada ese día: eso es información —«el sábado está libre»— y sacarlo dejaría un
 * tríptico de dos columnas que se lee como si el dato faltara.
 */
export const panelesDeAhora = (
  indice: Indice,
  ahora: Date,
  etiquetas: MapaDeEtiquetas,
  tope: number = TOPE_DEL_PANEL,
): ProgramacionInmediata | null => {
  const porSlug = new Map<string, EntradaDeIndice>(indice.actividades.map((a) => [a.slug, a]));

  const paneles = ventanasDeAhora(ahora).map(({ clave, rotulo, dias }) => {
    const enLaVentana = indice.encuentros.filter((e) => {
      const d = instanteDeIso(e.inicio);
      /*
       * `d >= ahora` además del día: el eje ya viene recortado desde el build
       * (`inicio >= generadoEn`), pero el reloj que importa es el de quien mira
       * —§6.4— y entre el build y la visita pasa el tiempo. Sin esto, «Hoy»
       * ofrecería a las nueve de la noche un taller que empezó a las siete.
       *
       * Se mira el **inicio** y no el fin, que es la diferencia con
       * `proximaVentana` del listado: el eje de B-99 no lleva el fin. Es
       * deliberado —«lo que queda de hoy» es lo que todavía no arrancó— y el
       * costo es que una actividad que empezó hace diez minutos desaparece del
       * panel mientras sigue en el listado.
       */
      if (!d || d.getTime() < ahora.getTime()) return false;
      return dias.includes(claveDeDia(d));
    });

    /*
     * **Se resuelve toda la ventana y recién después se corta**, y no al revés.
     *
     * Cortar primero parece más barato (cuatro búsquedas en el Map en vez de
     * todas) y hace mentir al pie: un encuentro cuyo slug no está en
     * `actividades` se descarta acá abajo, así que si cayó entre los primeros
     * cuatro el panel muestra tres filas y `restantes` —contado contra el largo
     * de la ventana— dice «+1 más hoy» sin que haya ningún quinto encuentro. Con
     * la resolución primero, lo que no se puede mostrar no existe para ninguna de
     * las dos cuentas. El costo es una búsqueda en un Map por encuentro del día.
     */
    const resueltos = enLaVentana.flatMap((e) => {
      const entrada = porSlug.get(e.slug);
      /*
       * Un encuentro cuyo slug no está en `actividades` no se puede mostrar: no
       * hay título, ni lugar, ni página a la que ir. No debería pasar —los dos
       * ejes salen del mismo build— pero el índice lo sirve un CDN y puede ser
       * de un build anterior, así que se descarta en silencio en vez de romper
       * la home. Es el mismo criterio con el que `desdeQuery` no se cree nada de
       * lo que viene en la URL.
       */
      if (!entrada) return [];
      const d = instanteDeIso(e.inicio);
      if (!d) return [];
      const partes = partesDeFecha(d);
      return [
        {
          clave: `${e.slug}#${e.sesionId}`,
          ruta: rutaDeDetalle(e.slug),
          iso: e.inicio,
          hora: hora(d),
          dia: dias.length > 1 ? `${partes.diaSemana} ${partes.dia}` : null,
          titulo: entrada.titulo,
          tipo: entrada.tipo,
          tipoEtiqueta: etiquetaDe(etiquetas, 'tipo', entrada.tipo),
          lugar: lugarDeTarjeta(entrada, etiquetas),
          arancel: arancelDeTarjeta(entrada, etiquetas),
        },
      ];
    });

    const encuentros = resueltos.slice(0, tope);
    const restantes = resueltos.length - encuentros.length;

    return {
      clave,
      rotulo,
      fechas: fechasDeVentana(dias),
      encuentros,
      restantes,
      resto: restantes > 0 ? FRASES[clave].resto(restantes) : null,
      vacio: FRASES[clave].vacio,
    };
  });

  if (!paneles.some((p) => p.encuentros.length > 0)) return null;
  return { sello: selloDelIndice(indice.generadoEn), paneles };
};
