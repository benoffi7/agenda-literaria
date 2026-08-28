/**
 * Búsqueda, filtros y orden del listado público — B-227.
 *
 * **Todo en memoria del cliente, sobre el `events.json`** (§2.5): un solo fetch
 * cacheado, cero lecturas de Firestore desde el público, búsqueda instantánea y
 * filtros combinados sin índices compuestos. No hay Algolia y no hay una query
 * nueva: son decisiones cerradas del `CLAUDE.md`.
 *
 * ── Qué se comparte con el panel y qué no ─────────────────────────────────
 * `lib/filtrosActividades.ts` hace lo mismo para el listado del panel y **no se
 * reusa entero**, a propósito: opera sobre `ActividadConId` —el documento crudo,
 * con `Timestamp`, con `estado`, con los borradores— y acá el insumo es
 * `EntradaDeIndice`, que es el recorte público con fechas ISO. Forzar un tipo
 * común habría sido pedirle al panel que hable en ISO o al sitio que conozca el
 * documento entero; lo segundo es exactamente lo que la frontera del §5 evita.
 *
 * Lo que **sí** se comparte es lo que duele si diverge:
 *
 * | Qué | De dónde sale | Por qué |
 * |---|---|---|
 * | «cuál es el próximo encuentro» | `proximaVentana` (`lib/sesiones.ts`) | tres decisiones sutiles (el fin y no el inicio, el fallback, los cancelados). Dos copias = el panel y el sitio contestando distinto sobre la misma actividad |
 * | la normalización de la búsqueda | `normalize` (`lib/normalize.ts`) | es la del §6, la misma con la que se escribió el `searchText` que se está buscando |
 * | el nombre de cada modalidad | `ETIQUETA_MODALIDAD` (`lib/filtrosActividades.ts`) | «Presencial y virtual» tiene que decirse igual en las dos pantallas |
 * | el respaldo de un slug sin etiqueta | `desSlug` (`@calendario`) | el mismo texto que muestra el evento público (D-20) |
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * Como en `functions/rebuild.js` y en `filtrosActividades.ts`: `ahora` es un
 * argumento, nunca `Date.now()`. Un test no puede depender de qué día es hoy, y
 * acá además hay una segunda razón — el HTML lo arma el build con **su** reloj y
 * la island lo recalcula con el de quien mira (§6.4 del diseño).
 */
import { ETIQUETA_MODALIDAD } from '@/lib/filtrosActividades';
import { claveDeMes, nombreDeMes } from '@/lib/fechasPublicas';
import { normalize } from '@/lib/normalize';
import { instanteDeIso, proximaVentana } from '@/lib/sesiones';
import type { EntradaDeIndice, Indice } from '@/lib/eventsJson';
import type { OpcionPublica } from '@/lib/toPublic';
import { desSlug } from '@calendario';

// ─────────────────────────────────────────────────────────────────
// Lo que se deriva de una entrada, con el reloj de quien mira
// ─────────────────────────────────────────────────────────────────

export interface EstadoDeEntrada {
  /** La próxima sesión no cancelada que todavía no terminó, o `null`. */
  proxima: Date | null;
  /** La primera y la última sesión no cancelada: el rango del ciclo. */
  desde: Date | null;
  hasta: Date | null;
  /** Ninguna sesión por venir: ya pasó (§7.1 del diseño). */
  paso: boolean;
  /** Empezó y todavía le quedan encuentros (§7.2). */
  enCurso: boolean;
  /** Cuántos encuentros no cancelados tiene. */
  encuentros: number;
  /** Fecha de cierre de inscripción, ya parseada. */
  cierra: Date | null;
  /**
   * **Se recalcula con el reloj de quien mira** — B-111. El `abierta` de
   * `toPublic` se congela en el build y sigue diciendo «abierta» hasta el
   * rebuild siguiente; por eso el índice manda `cierraEn` y no el booleano.
   */
  inscripcionCerrada: boolean;
}

const fechasDe = (e: EntradaDeIndice): Date[] =>
  e.sesiones
    .filter((s) => !s.cancelada)
    .map((s) => instanteDeIso(s.inicio))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

export const estadoDe = (e: EntradaDeIndice, ahora: Date): EstadoDeEntrada => {
  const proxima = proximaVentana(
    e.sesiones.map((s) => ({
      inicio: instanteDeIso(s.inicio),
      fin: instanteDeIso(s.fin),
      cancelada: s.cancelada,
    })),
    ahora,
  );
  const fechas = fechasDe(e);
  const desde = fechas[0] ?? null;
  const hasta = fechas[fechas.length - 1] ?? null;
  const cierra = instanteDeIso(e.inscripcion.cierraEn);

  return {
    proxima,
    desde,
    hasta,
    paso: proxima === null,
    // «Ya empezó» es que la primera fecha quedó atrás y todavía queda algo: es
    // lo que la tarjeta tiene que decir en vez de «empieza el 3 de septiembre»
    // cuando ya es octubre (§7.2).
    enCurso: proxima !== null && desde !== null && desde.getTime() < ahora.getTime(),
    encuentros: fechas.length,
    cierra,
    inscripcionCerrada:
      e.inscripcion.requiere && cierra !== null && cierra.getTime() <= ahora.getTime(),
  };
};

// ─────────────────────────────────────────────────────────────────
// Orden
// ─────────────────────────────────────────────────────────────────

export const ORDENES_PUBLICOS = ['proxima', 'nuevas', 'titulo'] as const;
export type OrdenPublico = (typeof ORDENES_PUBLICOS)[number];

/**
 * Lo que se lee en el desplegable.
 *
 * **El §6.1 del diseño decía que no había selector de orden**, con el argumento
 * de que no hay un segundo criterio que alguien pida («¿por precio? no hay
 * precio; ¿por relevancia? es una lista de 40 cosas»). Los dos que están acá son
 * justamente los que ese argumento no consideró, y el desvío está escrito en
 * **D-133**:
 *
 * - **«Recién agregadas»** contesta «¿qué se sumó desde la última vez que
 *   miré?», que es la pregunta del recorrido C —el que vuelve— y la única que el
 *   orden cronológico no puede contestar: una actividad cargada hoy para
 *   diciembre queda al fondo de la lista.
 * - **«Título»** es para volver a encontrar una que ya se vio.
 *
 * El default sigue siendo `proxima`, así que el HTML del build y el resultado de
 * Google no cambian.
 */
export const ETIQUETA_ORDEN_PUBLICO: Record<OrdenPublico, string> = {
  proxima: 'Próximas primero',
  nuevas: 'Recién agregadas',
  titulo: 'Título (A-Z)',
};

export const ORDEN_PUBLICO_POR_DEFECTO: OrdenPublico = 'proxima';

// ─────────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────────

/**
 * Los ejes que son **multivalor y OR entre sí**. El cruce entre ejes es AND:
 * «taller o club de lectura, en Boedo o Almagro, gratis» es la combinación que la
 * gente espera y la única que no sorprende (§6.1 del diseño).
 *
 * Están declarados como lista y no como cinco campos sueltos porque el conteo de
 * cada chip, la serialización a la URL y el "sacá este filtro" del estado vacío
 * los recorren: con cinco campos sueltos, agregar el sexto eje obliga a acordarse
 * de tres lugares.
 */
export const EJES = ['tipo', 'modalidad', 'arancel', 'barrio', 'ciudad', 'tag'] as const;
export type Eje = (typeof EJES)[number];

/** Cómo se llama cada eje en la pantalla. Es el texto del `<legend>`. */
export const ETIQUETA_EJE: Record<Eje, string> = {
  tipo: 'Tipo de actividad',
  modalidad: 'Cómo se cursa',
  arancel: 'Arancel',
  barrio: 'Barrio',
  ciudad: 'Ciudad',
  tag: 'Temas',
};

export const CUANDO_PROXIMAS = 'proximas';
export const CUANDO_ESTE_MES = 'este-mes';
export const CUANDO_TRES_MESES = 'tres-meses';

/** Un valor de «Cuándo» que es un mes puntual, `2026-09`. */
export const esMes = (cuando: string): boolean => /^\d{4}-\d{2}$/.test(cuando);

export interface FiltrosPublicos {
  /** Texto libre. Se compara contra `searchText` con `normalize` (§6). */
  q: string;
  /** `proximas` · `este-mes` · `tres-meses` · `aaaa-mm`. */
  cuando: string;
  /** Los ejes multivalor. Vacío es «sin filtrar». */
  valores: Record<Eje, string[]>;
  /** Descarta lo que ya cerró inscripción. */
  soloAbierta: boolean;
  /** `''` · `ciclos` · `unicos`. */
  cursada: '' | 'ciclos' | 'unicos';
}

export const FILTROS_PUBLICOS_VACIOS: FiltrosPublicos = {
  q: '',
  cuando: CUANDO_PROXIMAS,
  valores: { tipo: [], modalidad: [], arancel: [], barrio: [], ciudad: [], tag: [] },
  soloAbierta: false,
  cursada: '',
};

/** Copia con los ejes clonados: el objeto de arriba es una constante compartida. */
export const filtrosVacios = (): FiltrosPublicos => ({
  ...FILTROS_PUBLICOS_VACIOS,
  valores: { tipo: [], modalidad: [], arancel: [], barrio: [], ciudad: [], tag: [] },
});

/**
 * Cuántos filtros hay puestos, **sin contar el texto**: el buscador está siempre
 * a la vista y se explica solo. Este número va al lado del botón «Filtros», para
 * que un filtro puesto y olvidado detrás de un panel colapsado no explique un
 * listado que parece vacío. Es el mismo criterio que el panel.
 */
export const cantidadDeFiltrosPublicos = (f: FiltrosPublicos): number =>
  EJES.reduce((n, eje) => n + (f.valores[eje].length > 0 ? 1 : 0), 0) +
  (f.cuando !== CUANDO_PROXIMAS ? 1 : 0) +
  (f.soloAbierta ? 1 : 0) +
  (f.cursada !== '' ? 1 : 0);

export const hayFiltrosPublicos = (f: FiltrosPublicos): boolean =>
  cantidadDeFiltrosPublicos(f) > 0 || f.q.trim() !== '';

/** Los valores del eje que una entrada tiene. Es lo que cruza contra el filtro. */
export const valoresDe = (e: EntradaDeIndice, eje: Eje): string[] => {
  switch (eje) {
    case 'tipo':
      return e.tipo ? [e.tipo] : [];
    /*
     * B-224 — **todas** las formas de cursar, no el escalar `modalidad`. Una
     * actividad presencial y virtual es cierta bajo los tres chips, y filtrar
     * solo por la resultante la escondería de los dos que la describen mejor.
     * Es el mismo criterio que el filtro del panel, y el motivo por el que el
     * índice lleva `modalidades[]` además del derivado.
     */
    case 'modalidad':
      return e.modalidades.length > 0 ? e.modalidades : [e.modalidad];
    case 'arancel':
      return e.arancel.tipo ? [e.arancel.tipo] : [];
    case 'barrio':
      return e.sede?.barrio ? [e.sede.barrio] : [];
    case 'ciudad':
      return e.sede?.ciudad ? [e.sede.ciudad] : [];
    case 'tag':
      return e.tags;
  }
};

const pasaEje = (e: EntradaDeIndice, eje: Eje, elegidos: string[]): boolean => {
  if (elegidos.length === 0) return true;
  const tiene = valoresDe(e, eje);
  return elegidos.some((v) => tiene.includes(v));
};

/**
 * Los meses que cuentan como «este mes» o «próximos 3 meses», incluido el actual.
 *
 * El mes de arranque sale de `claveDeMes` y no de `getMonth()`: el segundo
 * devuelve el mes del reloj de quien mira, así que a las 22:30 del 31 de agosto
 * en Buenos Aires un navegador en UTC ya diría «septiembre» y «este mes»
 * mostraría el mes equivocado. Es la trampa 1 del lado del filtro.
 */
const mesesDesde = (ahora: Date, cantidad: number): string[] => {
  const [anio, mes] = claveDeMes(ahora).split('-').map(Number);
  if (!anio || !mes) return [];
  return Array.from({ length: cantidad }, (_, i) => {
    const corrido = mes - 1 + i;
    const a = anio + Math.floor(corrido / 12);
    return `${a}-${String((corrido % 12) + 1).padStart(2, '0')}`;
  });
};

/**
 * ¿Alguna sesión de la actividad cae en alguno de esos meses?
 *
 * Un ciclo que cruza dos meses matchea los dos (§7.5 del diseño): matchear solo
 * por la primera fecha escondería de «este mes» un ciclo que arrancó el mes
 * pasado y sigue.
 */
const caeEnAlgunMes = (e: EntradaDeIndice, meses: readonly string[]): boolean =>
  e.sesiones.some((s) => {
    if (s.cancelada) return false;
    const d = instanteDeIso(s.inicio);
    return d !== null && meses.includes(claveDeMes(d));
  });

const pasaCuando = (e: EntradaDeIndice, estado: EstadoDeEntrada, cuando: string, ahora: Date): boolean => {
  if (cuando === CUANDO_PROXIMAS) return !estado.paso;
  if (cuando === CUANDO_ESTE_MES) return caeEnAlgunMes(e, mesesDesde(ahora, 1));
  if (cuando === CUANDO_TRES_MESES) return caeEnAlgunMes(e, mesesDesde(ahora, 3));
  if (esMes(cuando)) return caeEnAlgunMes(e, [cuando]);
  // Un valor que no reconocemos (una URL vieja, alguien tipeando) no puede
  // vaciar el listado: se cae al default y se muestra lo que viene.
  return !estado.paso;
};

/**
 * Filtra, con el reloj de quien mira.
 *
 * `omitir` deja un eje **sin aplicar**, y es lo que hace posible el conteo de los
 * chips: el número que va al lado de «Taller» tiene que contar contra los otros
 * filtros y no contra sí mismo, si no elegir un tipo pone en cero a todos los
 * demás y no se puede sumar un segundo.
 */
export const filtrarPublico = (
  entradas: readonly EntradaDeIndice[],
  filtros: FiltrosPublicos,
  ahora: Date,
  omitir?: Eje,
): EntradaDeIndice[] => {
  // §6 — la misma normalización con la que se escribió el `searchText`.
  // Se parte en palabras y se exigen **todas** (AND): «cronica boedo» encuentra
  // la crónica de Boedo, que es lo que alguien espera al tipear dos palabras.
  const palabras = normalize(filtros.q.trim()).split(/\s+/).filter(Boolean);

  return entradas.filter((e) => {
    if (palabras.length > 0) {
      const texto = e.searchText ?? '';
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    const estado = estadoDe(e, ahora);
    if (!pasaCuando(e, estado, filtros.cuando, ahora)) return false;
    if (filtros.soloAbierta && estado.inscripcionCerrada) return false;
    if (filtros.cursada === 'ciclos' && !e.esCiclo) return false;
    if (filtros.cursada === 'unicos' && e.esCiclo) return false;
    for (const eje of EJES) {
      if (eje !== omitir && !pasaEje(e, eje, filtros.valores[eje])) return false;
    }
    return true;
  });
};

const porTitulo = (a: EntradaDeIndice, b: EntradaDeIndice): number =>
  a.titulo.localeCompare(b.titulo, 'es');

/**
 * Ordena. **No muta**: el array de entradas lo comparten el listado y los
 * conteos de los chips.
 *
 * En `'proxima'`, lo que ya pasó va al final ordenado de lo más reciente a lo más
 * viejo. Es la mitad menos obvia: si lo pasado se intercalara por su fecha, el
 * principio del listado sería un archivo histórico. Con el filtro «Próximas»
 * puesto —que es el default— no hay nada pasado que ordenar; se nota al elegir un
 * mes que ya empezó.
 */
export const ordenarPublico = (
  entradas: readonly EntradaDeIndice[],
  orden: OrdenPublico,
  ahora: Date,
): EntradaDeIndice[] => {
  const copia = [...entradas];
  if (orden === 'titulo') return copia.sort(porTitulo);
  if (orden === 'nuevas') {
    return copia.sort(
      (a, b) =>
        (instanteDeIso(b.creadoEn)?.getTime() ?? 0) - (instanteDeIso(a.creadoEn)?.getTime() ?? 0) ||
        porTitulo(a, b),
    );
  }
  return copia.sort((a, b) => {
    const pa = estadoDe(a, ahora);
    const pb = estadoDe(b, ahora);
    if (pa.proxima && pb.proxima) return pa.proxima.getTime() - pb.proxima.getTime() || porTitulo(a, b);
    if (pa.proxima) return -1;
    if (pb.proxima) return 1;
    return (pb.hasta?.getTime() ?? 0) - (pa.hasta?.getTime() ?? 0) || porTitulo(a, b);
  });
};

/** Filtrar y ordenar de una vez: es lo único que necesita el componente. */
export const listaPublica = (
  entradas: readonly EntradaDeIndice[],
  filtros: FiltrosPublicos,
  orden: OrdenPublico,
  ahora: Date,
): EntradaDeIndice[] => ordenarPublico(filtrarPublico(entradas, filtros, ahora), orden, ahora);

// ─────────────────────────────────────────────────────────────────
// Etiquetas y chips
// ─────────────────────────────────────────────────────────────────

/** `{ campo: { slug: etiqueta } }`, armado con las opciones que viajan en el JSON. */
export type MapaDeEtiquetas = Record<string, Record<string, string>>;

/**
 * §4.4 — las etiquetas salen de `opciones.*` del propio archivo, **nada
 * cableado**: al agregar una opción nueva aparece sola en los filtros, y
 * renombrarla la renombra en el sitio sin tocar código.
 */
export const mapaDeEtiquetas = (opciones: Record<string, OpcionPublica[]>): MapaDeEtiquetas =>
  Object.fromEntries(
    Object.entries(opciones).map(([campo, valores]) => [
      campo,
      Object.fromEntries(valores.map((v) => [v.slug, v.label])),
    ]),
  );

/**
 * La etiqueta de un valor.
 *
 * `modalidad` sale del enum del modelo (no es taxonomía). El resto se resuelve
 * contra `/opciones/*` y, si el slug no está registrado, cae a `desSlug` — el
 * **mismo** respaldo que usa la descripción del evento público, importado y no
 * copiado (D-20): si divergieran, el mismo slug se leería distinto en el sitio y
 * en el calendario.
 *
 * Ojo con el matiz de D-30: acá se **resuelve** un valor ya guardado, así que no
 * se filtra por aprobación. Lo que se filtra es lo *elegible*, o sea qué chips se
 * ofrecen, y eso ya viene resuelto: `opcionesPublicas` deja fuera las no
 * aprobadas antes de que el archivo se escriba.
 */
export const etiquetaDe = (
  etiquetas: MapaDeEtiquetas,
  // `plataforma` no es un eje de filtro —«Online» ya está cubierto por
  // `modalidad`— pero sí es una taxonomía con etiqueta, y el detalle la muestra.
  // Se resuelve con la misma función para que no nazca una segunda.
  eje: Eje | 'plataforma',
  valor: string,
): string => {
  if (eje === 'modalidad') {
    return ETIQUETA_MODALIDAD[valor as keyof typeof ETIQUETA_MODALIDAD] ?? desSlug(valor);
  }
  // `tag` en el filtro, `tags` en `/opciones/*`: el nombre del eje es singular
  // porque así se lee en la URL (`?tag=poesia`).
  const campo = eje === 'tag' ? 'tags' : eje;
  return etiquetas[campo]?.[valor] ?? desSlug(valor);
};

export interface Chip {
  valor: string;
  label: string;
  cantidad: number;
  elegido: boolean;
}

/**
 * Los chips de un eje, **con su número y sin los que dan cero**.
 *
 * Tres reglas, y las tres tienen su motivo:
 *
 * 1. **El número se cuenta con los demás filtros aplicados y este no** (ver
 *    `omitir`): si se contara con el propio eje puesto, elegir «Taller» dejaría
 *    todos los otros tipos en cero y no se podría sumar «Club de lectura».
 * 2. **Un chip en cero no se muestra**, salvo que esté elegido: ofrecer un filtro
 *    que devuelve una lista vacía es ofrecer un callejón. El elegido se muestra
 *    igual —aunque quede en cero— porque si desapareciera no habría cómo sacarlo.
 * 3. **El orden es por cantidad y después alfabético.** Por frecuencia real, que
 *    es lo mismo que hace el desplegable del panel con `usos` (§4.3), y con el
 *    desempate estable para que dos chips empatados no se intercambien entre
 *    renders.
 */
export const chipsDe = (
  eje: Eje,
  entradas: readonly EntradaDeIndice[],
  filtros: FiltrosPublicos,
  etiquetas: MapaDeEtiquetas,
  ahora: Date,
): Chip[] => {
  const base = filtrarPublico(entradas, filtros, ahora, eje);
  const cuenta = new Map<string, number>();
  for (const e of base) {
    for (const v of valoresDe(e, eje)) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }
  for (const v of filtros.valores[eje]) if (!cuenta.has(v)) cuenta.set(v, 0);

  return [...cuenta.entries()]
    .map(([valor, cantidad]) => ({
      valor,
      cantidad,
      label: etiquetaDe(etiquetas, eje, valor),
      elegido: filtros.valores[eje].includes(valor),
    }))
    .filter((c) => c.cantidad > 0 || c.elegido)
    .sort((a, b) => b.cantidad - a.cantidad || a.label.localeCompare(b.label, 'es'));
};

/** Prende o apaga un valor de un eje. Devuelve filtros nuevos, no muta. */
export const alternarValor = (
  filtros: FiltrosPublicos,
  eje: Eje,
  valor: string,
): FiltrosPublicos => {
  const actuales = filtros.valores[eje];
  const nuevos = actuales.includes(valor)
    ? actuales.filter((v) => v !== valor)
    : [...actuales, valor];
  return { ...filtros, valores: { ...filtros.valores, [eje]: nuevos } };
};

/**
 * Qué filtro conviene sacar primero cuando no queda nada — §6.1 del diseño:
 * «cero resultados no es una pantalla vacía, dice qué filtro sacar».
 *
 * Se devuelve el **último eje puesto que, sacado solo, devuelve resultados**. Se
 * prueba de verdad en vez de adivinar por un orden de prioridad: sugerir «sacá el
 * barrio» cuando sacarlo tampoco alcanza es peor que no sugerir nada.
 */
export const ejeQueSobra = (
  entradas: readonly EntradaDeIndice[],
  filtros: FiltrosPublicos,
  ahora: Date,
): Eje | null => {
  for (const eje of [...EJES].reverse()) {
    if (filtros.valores[eje].length === 0) continue;
    const sinEse = { ...filtros, valores: { ...filtros.valores, [eje]: [] } };
    if (filtrarPublico(entradas, sinEse, ahora).length > 0) return eje;
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────
// Agrupar por mes
// ─────────────────────────────────────────────────────────────────

export interface GrupoDeMes {
  clave: string;
  titulo: string;
  entradas: EntradaDeIndice[];
}

/**
 * Agrupa por el mes de la **próxima** sesión, en el orden en que vienen.
 *
 * «Una lista plana de 38 fechas no se lee; el mes da estructura sin costar un
 * control» (§4.1 del diseño). Lo que ya pasó cae en el mes de su última fecha.
 *
 * **Solo tiene sentido con el orden cronológico**, y quien llama lo sabe: con
 * «Recién agregadas» o «Título» los separadores mentirían, así que el listado
 * los apaga. Que la decisión sea de quien llama y no de acá es lo que permite
 * testear las dos cosas por separado.
 */
export const agruparPorMes = (entradas: readonly EntradaDeIndice[], ahora: Date): GrupoDeMes[] => {
  const grupos: GrupoDeMes[] = [];
  for (const e of entradas) {
    const { proxima, hasta } = estadoDe(e, ahora);
    const fecha = proxima ?? hasta;
    const clave = fecha ? claveDeMes(fecha) : 'sin-fecha';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === clave) ultimo.entradas.push(e);
    else grupos.push({ clave, titulo: clave === 'sin-fecha' ? 'Sin fecha' : nombreDeMes(clave), entradas: [e] });
  }
  return grupos;
};

/** Los meses que tienen alguna actividad, para el desplegable de «Cuándo». */
export const mesesConActividad = (entradas: readonly EntradaDeIndice[]): string[] => {
  const claves = new Set<string>();
  for (const e of entradas) {
    for (const s of e.sesiones) {
      if (s.cancelada) continue;
      const d = instanteDeIso(s.inicio);
      if (d) claves.add(claveDeMes(d));
    }
  }
  return [...claves].sort();
};

// ─────────────────────────────────────────────────────────────────
// La URL
// ─────────────────────────────────────────────────────────────────

const CLAVE_ORDEN = 'orden';

/**
 * Los filtros a query string — §6.2 del diseño.
 *
 * **Sirve para compartir un filtro por WhatsApp**, que es cómo circula esto, y
 * para que el botón «atrás» del navegador haga algo. Solo se escribe lo que no es
 * el default: así `/` con todo por defecto queda limpia, que es la URL que
 * canoniza el `<link rel="canonical">`.
 */
export const aQuery = (filtros: FiltrosPublicos, orden: OrdenPublico): string => {
  const p = new URLSearchParams();
  if (filtros.q.trim()) p.set('q', filtros.q.trim());
  if (filtros.cuando !== CUANDO_PROXIMAS) p.set('cuando', filtros.cuando);
  for (const eje of EJES) {
    if (filtros.valores[eje].length > 0) p.set(eje, filtros.valores[eje].join(','));
  }
  if (filtros.soloAbierta) p.set('abierta', '1');
  if (filtros.cursada) p.set('cursada', filtros.cursada);
  if (orden !== ORDEN_PUBLICO_POR_DEFECTO) p.set(CLAVE_ORDEN, orden);
  return p.toString();
};

/**
 * La query string a filtros. **Nada de lo que venga de la URL se cree sin
 * chequear**: es texto que escribe cualquiera.
 *
 * Un valor que no reconocemos se descarta y se sigue con el default, nunca se
 * rompe la página ni se vacía el listado — una URL vieja compartida hace seis
 * meses tiene que seguir mostrando algo.
 */
export const desdeQuery = (
  query: string,
): { filtros: FiltrosPublicos; orden: OrdenPublico } => {
  const p = new URLSearchParams(query);
  const filtros = filtrosVacios();

  filtros.q = p.get('q') ?? '';
  const cuando = p.get('cuando') ?? '';
  if (cuando === CUANDO_ESTE_MES || cuando === CUANDO_TRES_MESES || esMes(cuando)) {
    filtros.cuando = cuando;
  }
  for (const eje of EJES) {
    const crudo = p.get(eje);
    if (crudo) filtros.valores[eje] = crudo.split(',').map((v) => v.trim()).filter(Boolean);
  }
  filtros.soloAbierta = p.get('abierta') === '1';
  const cursada = p.get('cursada');
  if (cursada === 'ciclos' || cursada === 'unicos') filtros.cursada = cursada;

  const orden = p.get(CLAVE_ORDEN);
  return {
    filtros,
    orden: (ORDENES_PUBLICOS as readonly string[]).includes(orden ?? '')
      ? (orden as OrdenPublico)
      : ORDEN_PUBLICO_POR_DEFECTO,
  };
};

/**
 * Las entradas vigentes, ordenadas — lo que el build imprime en el HTML.
 *
 * Es una función y no dos líneas en el `.astro` para que el HTML del build y el
 * primer render de la island salgan del **mismo** cálculo: si el build ordenara
 * por su cuenta, la lista se reacomodaría sola al hidratar y eso se lee como un
 * error.
 */
export const vigentesDelIndice = (indice: Indice, ahora: Date): EntradaDeIndice[] =>
  listaPublica(indice.actividades, filtrosVacios(), ORDEN_PUBLICO_POR_DEFECTO, ahora);
