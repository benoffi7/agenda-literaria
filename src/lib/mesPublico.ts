/**
 * Las páginas de mes — `/agenda/{aaaa-mm}`, B-113, §2.2 del diseño.
 *
 * ── Por qué la sección viene acotada, y no es timidez ─────────────────────
 * «Qué hay este mes» es una forma real de mirar la agenda, pero la página es un
 * **subconjunto de la home** y su consulta (`agenda literaria septiembre`) es de
 * volumen bajo. El §2.2 la aceptó con cuatro condiciones, y las cuatro están
 * escritas en este módulo porque son la mitad del ítem:
 *
 * | Condición | Dónde vive |
 * |---|---|
 * | solo el mes en curso y los siguientes | `mesesDelSitio`, el corte contra `mesDesplazado(actual, -1)` |
 * | solo meses con **3 o más** actividades | `MINIMO_DE_ACTIVIDADES` |
 * | no va en la navegación | no es una `Seccion` del encabezado: se llega desde la tira de la home |
 * | cuando el mes termina la URL no se rompe | `vencido`, que emite la página una última vez |
 *
 * El corte de tres no es un número redondo: con una o dos actividades la página
 * es un casi-duplicado de la home compitiendo con la página de detalle de cada
 * una, o sea que resta en vez de sumar.
 *
 * ── Cero lecturas nuevas de Firestore ─────────────────────────────────────
 * Todo sale de `EntradaDeIndice[]`, o sea del **mismo** índice que ya leyó
 * `contenidoDelSitio()` para la home y el `events.json` (§2.4). Este módulo no
 * habla con Firestore ni sabe que existe: es puro, y `ahora` entra como
 * parámetro como en todo el resto del sitio.
 *
 * ── La selección es la del filtro de la home, importada ───────────────────
 * Qué actividades caen en un mes lo decide `filtrarPublico` con `cuando` puesto
 * en la clave —o sea `caeEnAlgunMes`, adentro de `listadoPublico.ts`—, que es
 * exactamente lo que aplica el filtro «Cuándo» del listado. Reescribirlo acá
 * dejaría a `/agenda/2026-09` y a `/?cuando=2026-09` contestando distinto sobre
 * los mismos datos —la clase de B-88— y el día que diverjan nadie se entera:
 * las dos páginas se ven bien por separado.
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { claveDeMes, mesDesplazado, nombreDeMes } from '@/lib/fechasPublicas';
import { RUTA_PASADAS } from '@/lib/rutasPublicas';
import {
  filtrarPublico,
  filtrosVacios,
  mesesConActividad,
  ordenarPublico,
  ORDEN_PUBLICO_POR_DEFECTO,
} from '@/lib/listadoPublico';
import { instanteDeIso } from '@/lib/sesiones';

/**
 * El corte del §2.2. **Es una constante y no un parámetro con default**: con un
 * parámetro, un test que pasa el mínimo explícito deja de mirar el número que
 * corre en producción, y bajarlo a 1 no pondría nada en rojo.
 */
export const MINIMO_DE_ACTIVIDADES = 3;

/**
 * A dónde manda el aviso de un mes que ya terminó: **`/pasadas`** — cierra
 * B-281.
 *
 * Es lo que el §2.2 pedía desde el día uno. Hasta B-109 mandaba a la home porque
 * `/pasadas` no existía, y enlazar un 404 en la única salida que la página
 * vencida ofrece era peor que el problema que esa página resuelve. Ahora existe,
 * y es el destino correcto: quien llega a septiembre en noviembre no quiere lo
 * que viene, quiere lo que hubo.
 *
 * Se cambió **una línea**, que es lo que este módulo prometía. Y sigue siendo una
 * constante y no un literal en el markup: `tests/mesPublico.test.ts` verifica que
 * apunte a una página que el sitio tiene de verdad.
 */
export const DESTINO_DEL_MES_VENCIDO = RUTA_PASADAS;

export interface PaginaDeMes {
  /** `2026-09` — la clave, que es también el segmento de la URL. */
  clave: string;
  /** `Septiembre de 2026`. */
  nombre: string;
  /**
   * El mes ya terminó y esta es su **última** emisión (§2.2). La página sigue
   * respondiendo —nunca un 404 sobre una URL que estuvo indexada— con un aviso y
   * una salida; en el build del mes siguiente ya no se genera.
   */
  vencido: boolean;
  /** Las actividades de ese mes, en el orden en que se muestran. */
  entradas: EntradaDeIndice[];
}

// ─────────────────────────────────────────────────────────────────
// El recorte al mes — el caso del ciclo a caballo
// ─────────────────────────────────────────────────────────────────

/**
 * **La misma entrada, con solo las sesiones de ese mes** — es el corazón de
 * B-113.
 *
 * Un ciclo del 3 de septiembre al 22 de octubre aparece en las dos páginas de
 * mes (§7.5: una actividad, una fila, sin excepciones), y en cada una tiene que
 * mostrar *las fechas de esa página*. La forma barata de hacerlo sería un
 * parámetro más en cada frase de la fila —«pero mostrame solo estas fechas»— y
 * eso obliga a acordarse en cada una: el bloque de fecha, la línea del ciclo, el
 * «ya empezó», el orden.
 *
 * Recortando la **entrada** en vez de cada frase, todo lo que deriva de las
 * sesiones habla del mes solo, porque no tiene otras a la vista. Lo único que
 * hay que pasarle aparte a la fila es cuántos encuentros tiene el ciclo
 * **entero**, que es justo el dato que no se puede perder: «Ciclo de 4
 * encuentros» en la página de septiembre, cuando son 8, es información falsa.
 *
 * No se toca ningún otro campo: es la misma actividad, con menos fechas.
 */
export const recorteDelMes = (e: EntradaDeIndice, clave: string): EntradaDeIndice => ({
  ...e,
  sesiones: e.sesiones.filter((s) => {
    const d = instanteDeIso(s.inicio);
    return d !== null && claveDeMes(d) === clave;
  }),
});

// ─────────────────────────────────────────────────────────────────
// Qué entra en cada mes, y en qué orden
// ─────────────────────────────────────────────────────────────────

/**
 * Las actividades de un mes, ordenadas **por sus fechas de ese mes**.
 *
 * Dos mitades, y las dos importadas en vez de reescritas:
 *
 * - **Quién entra** lo decide `filtrarPublico` con `cuando` puesto en la clave
 *   del mes, que es exactamente el filtro «Cuándo» de la home. Así
 *   `/agenda/2026-09` y `/?cuando=2026-09` no pueden contestar distinto.
 * - **En qué orden** lo decide `ordenarPublico` sobre los **recortes**, no sobre
 *   las entradas enteras. Sobre las enteras, un ciclo que empezó en septiembre
 *   se ordenaría en la página de octubre por su fecha de septiembre y quedaría
 *   arriba de todo sin tener nada que hacer ahí ese día. Sobre el recorte, el
 *   orden del mes es el de las fechas del mes — y lo que ya pasó cae al final,
 *   que es la semántica que `ordenarPublico` ya tiene y que en el mes en curso es
 *   justo lo que hace falta.
 *
 * Devuelve las entradas **enteras**: el recorte es para ordenar y para lo que
 * cada fila derive, no para la salida. Una fila necesita saber que el ciclo
 * tiene ocho encuentros aunque en este mes muestre cuatro.
 */
export const entradasDelMes = (
  entradas: readonly EntradaDeIndice[],
  clave: string,
  ahora: Date,
): EntradaDeIndice[] => {
  const delMes = filtrarPublico(entradas, { ...filtrosVacios(), cuando: clave }, ahora);
  const porId = new Map(delMes.map((e) => [e.id, e]));
  return ordenarPublico(
    delMes.map((e) => recorteDelMes(e, clave)),
    ORDEN_PUBLICO_POR_DEFECTO,
    ahora,
  )
    .map((r) => porId.get(r.id))
    .filter((e): e is EntradaDeIndice => e !== undefined);
};

/**
 * Las páginas de mes que el build tiene que emitir, de la más vieja a la más
 * nueva.
 *
 * El horizonte **sale de los datos** y no de un número de meses hacia adelante:
 * se parte de los meses que tienen alguna actividad (`mesesConActividad`) y se
 * corta por abajo. Un horizonte fijo —«los próximos seis»— dejaría sin página a
 * un ciclo cargado para marzo del año que viene, en silencio, y obligaría a
 * elegir un número que nadie puede justificar.
 *
 * El corte por abajo es **el mes anterior al actual**, no el actual: esa es la
 * emisión de más que pide el §2.2 para que una URL que estuvo indexada no
 * devuelva 404 el primer día del mes siguiente.
 */
export const mesesDelSitio = (
  entradas: readonly EntradaDeIndice[],
  ahora: Date,
): PaginaDeMes[] => {
  const actual = claveDeMes(ahora);
  const primero = mesDesplazado(actual, -1);

  return mesesConActividad(entradas)
    .filter((clave) => clave >= primero)
    .map((clave) => ({
      clave,
      nombre: nombreDeMes(clave),
      vencido: clave < actual,
      entradas: entradasDelMes(entradas, clave, ahora),
    }))
    .filter((p) => p.entradas.length >= MINIMO_DE_ACTIVIDADES);
};

/**
 * Las páginas de mes que se pueden **enlazar** — o sea, las que no vencieron.
 *
 * La tira de la home usa esta y no `mesesDelSitio`: enlazar la página de un mes
 * que ya pasó es mandar a alguien a un aviso de que llegó tarde. La vencida
 * sigue existiendo para quien tenga la URL o la encuentre en Google, que es para
 * lo único que se emite.
 */
export const mesesEnlazables = (
  entradas: readonly EntradaDeIndice[],
  ahora: Date,
): PaginaDeMes[] => mesesDelSitio(entradas, ahora).filter((p) => !p.vencido);

// ─────────────────────────────────────────────────────────────────
// Lo que la página dice
// ─────────────────────────────────────────────────────────────────

/** Cuántas actividades, dicho bien en singular y en plural. */
const cuantas = (n: number): string => `${n} ${n === 1 ? 'actividad' : 'actividades'}`;

/**
 * El `<title>`, sin el nombre del sitio —eso lo agrega la página—.
 *
 * **El verbo cambia con `vencido`**: «Qué hay en septiembre» en octubre es falso,
 * y es el título que Google se queda mostrando durante semanas. Es el mismo
 * criterio que `cicloDeTarjeta` aplica a «empieza / empezó / terminó».
 */
export const tituloDelMes = (pagina: PaginaDeMes): string =>
  `${pagina.vencido ? 'Qué hubo' : 'Qué hay'} en ${pagina.nombre.toLowerCase()}`;

/**
 * La `meta description` del §5.1: `{N} actividades literarias en {mes}: {tres
 * títulos}.`
 *
 * Tres títulos y no más: el corte útil de una descripción son ~160 caracteres, y
 * lo que se gana con el cuarto título es que se corte el tercero.
 */
export const CUANTOS_TITULOS_EN_LA_DESCRIPCION = 3;

export const descripcionDelMes = (pagina: PaginaDeMes): string => {
  const titulos = pagina.entradas
    .slice(0, CUANTOS_TITULOS_EN_LA_DESCRIPCION)
    .map((e) => e.titulo)
    .join(', ');
  const cabeza = `${cuantas(pagina.entradas.length)} literarias en ${pagina.nombre.toLowerCase()}`;
  return titulos ? `${cabeza}: ${titulos}.` : `${cabeza}.`;
};

/**
 * La bajada, debajo del marcador de mes. Dice de qué se trata la página con las
 * palabras que el marcador —«Septiembre», «2026»— no puede decir.
 */
export const bajadaDelMes = (pagina: PaginaDeMes): string =>
  pagina.vencido
    ? `${pagina.nombre} ya pasó. Esto es lo que hubo: ${cuantas(pagina.entradas.length)}.`
    : `${cuantas(pagina.entradas.length)} literarias en ${pagina.nombre.toLowerCase()}: ` +
      'talleres, clubes de lectura, encuentros y presentaciones.';

/**
 * El aviso del mes vencido, en las palabras del §2.2.
 *
 * Va como texto y no armado en la plantilla por lo de siempre en este repo: un
 * `.astro` no se puede importar desde vitest, así que una frase escrita ahí
 * adentro no la verifica nadie — y esta es justo la que tiene que seguir
 * diciendo la verdad cuando `/pasadas` exista.
 */
export const AVISO_DEL_MES_VENCIDO = 'Este mes ya pasó.';
/*
 * El texto acompaña al destino — B-109. Mientras mandaba a la home decía «mirá lo
 * que viene en la agenda», que era cierto de la home y no de `/pasadas`: un link
 * cuyo texto promete otra cosa que la página a la que lleva es peor que no
 * tenerlo. Los dos se cambian juntos porque son una sola frase.
 */
export const SALIDA_DEL_MES_VENCIDO = 'Mirá todo lo que ya pasó';
