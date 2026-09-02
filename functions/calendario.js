/**
 * Lógica pura del sync a Calendar (§7). Sin dependencias de Firebase ni de
 * red: así el diff —que es la parte frágil del sistema— se puede testear sin
 * emuladores ni tocar un calendario real.
 */

export const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * §5.1 y §7.4 — lo que NUNCA entra al evento, porque el calendario es público
 * y scrapeable igual que el events.json:
 *
 *  - `online.url` con `urlPublica: false` → el link de la reunión se manda
 *                        al inscribirse. Publicarlo habilita zoombombing
 *                        (trampa 5). Con `urlPublica: true` el dueño decidió
 *                        publicarlo y sale en la descripción.
 *  - `difusion`        → trabajo interno.
 *  - `material.items[].url` con `publico: false` → solo tipo y título.
 *  - `createdBy` / `updatedBy` → uids.
 *
 * Todo el resto de lo que se carga en el formulario sí va a la descripción.
 */

/** Formatea una fecha en la zona del proyecto. */
const fecha = (t, opciones) => {
  const d = typeof t?.toDate === 'function' ? t.toDate() : new Date(t);
  return new Intl.DateTimeFormat('es-AR', { timeZone: TIMEZONE, ...opciones }).format(d);
};

/**
 * Último recurso cuando un slug no está registrado en `/opciones/*`:
 * "villa-crespo" → "Villa Crespo". El calendario es público y mostrar el slug
 * crudo se ve roto.
 */
/**
 * Exportada porque el panel la reusa (`legible` en `src/lib/filtrosActividades.ts`):
 * el respaldo que se ve en un filtro tiene que decir lo mismo que la
 * descripción del evento público. Antes era una copia idéntica en los dos
 * lados, así que mejorar uno separaba los dos sin que nada fallara (D-20).
 */
export const desSlug = (slug) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

/**
 * Resuelve el slug de una taxonomía a su etiqueta legible.
 * La actividad guarda solo el slug (§4.1), así que sin esto la descripción
 * diría "a-la-gorra" en lugar de "A la gorra".
 */
const etiqueta = (labels, campo, slug) => {
  if (!slug) return '';
  return labels?.[campo]?.[slug] ?? desSlug(slug);
};

const ETIQUETA_VIA = {
  mail: 'por mail',
  whatsapp: 'por WhatsApp',
  dm: 'por DM de Instagram',
  formulario: 'por formulario',
};

/**
 * Los formatos, en sustantivo. **Exportado** porque el panel lo reusa (D-20): el
 * desplegable del editor de material pintaba el valor crudo —"guia", "autor"—
 * mientras el evento decía "Guía" y "Sobre el autor" (B-134). Son sustantivos y
 * no prosa, así que sirven igual en las dos pantallas.
 *
 * `ETIQUETA_ENTREGA`, en cambio, NO se exporta: acá va en minúscula porque cae a
 * mitad de una frase entre paréntesis, y en el panel es el texto de un
 * desplegable. Esa diferencia es correcta y unificarla haría que un cambio de
 * copy del panel cambie lo que se publica.
 */
export const ETIQUETA_TIPO_MATERIAL = {
  lectura: 'Libro o lectura',
  guia: 'Guía',
  contexto: 'Contexto',
  autor: 'Sobre el autor',
  newsletter: 'Newsletter',
  playlist: 'Playlist',
  otro: 'Otro',
};

const ETIQUETA_ENTREGA = {
  previo: 'previo al encuentro',
  'al-inscribirse': 'al inscribirse',
  'durante-el-mes': 'durante el mes',
  'en-el-encuentro': 'en el encuentro',
};

const ETIQUETA_MODALIDAD = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Presencial y virtual',
};

/**
 * Dirección para el campo `location` del evento.
 *
 * Se arma con sede, calle, barrio y ciudad, más el país. Mandar solo
 * `sede.direccion` ("Drago 236") no alcanza: Google no tiene con qué
 * desambiguar y el evento queda sin mapa, o con el mapa en otra ciudad.
 */
/**
 * La misma dirección, pero a partir de **una** sede suelta.
 *
 * B-224 partió `sede` en una por modalidad, así que la descripción arma la
 * dirección de cada fila y el campo `location` la de la sede principal. Es una
 * sola función para las dos, y no dos: si divergieran, el evento diría una
 * dirección en el mapa y otra en el texto.
 */
const ubicacionDeSede = (sede, labels, modalidad) => {
  if (!sede) {
    // Virtual sin sede: la plataforma en el campo location hace que se lea en
    // la vista de agenda sin abrir el evento.
    return modalidad === 'virtual' ? 'Encuentro virtual' : undefined;
  }

  // El barrio se resuelve a su etiqueta: mandarle "villa-crespo" a Google
  // geolocaliza peor que "Villa Crespo".
  const partes = [sede.nombre, sede.direccion, etiqueta(labels, 'barrio', sede.barrio), sede.ciudad, 'Argentina']
    .map((p) => (p ?? '').trim())
    .filter(Boolean);

  // Barrio y ciudad se repiten seguido ("Palermo" cargado en los dos campos).
  const unicas = partes.filter((p, i) => partes.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  return unicas.join(', ') || undefined;
};

export const construirUbicacion = (actividad, labels = {}) =>
  ubicacionDeSede(actividad.sede, labels, actividad.modalidad);

/**
 * Link al mapa. Si la sede tiene coordenadas se usan, que es exacto; si no, la
 * búsqueda por dirección, que es lo que Google resuelve igual de bien para una
 * dirección completa.
 */
const linkMapaDeSede = (sede, labels, modalidad) => {
  if (!sede) return null;

  const geo = sede.geo;
  const query =
    geo && typeof geo.lat === 'number' && typeof geo.lng === 'number'
      ? `${geo.lat},${geo.lng}`
      : ubicacionDeSede(sede, labels, modalidad);

  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const construirLinkMapa = (actividad, labels = {}) =>
  linkMapaDeSede(actividad.sede, labels, actividad.modalidad);

/**
 * Milisegundos de lo que puede venir como Timestamp de Firestore, `Date`,
 * número o string. `null` cuando no hay fecha usable.
 *
 * **Vive acá y la importan los demás, en vez de estar dos veces (D-20).**
 * `rebuild.js` tenía su propia copia idéntica salvo el respaldo, y el
 * `auditor-trampas` la marcó: dos implementaciones que hoy dan lo mismo no
 * rompen ningún test el día que una se extienda —un formato de fecha nuevo, un
 * `toDate()` en vez de `toMillis`— y ahí el orden de las sesiones y el contador
 * de reintentos del rebuild (D-23) divergen sin que nada falle. Es la misma
 * clase que D-190 acababa de arreglar para el número del encuentro.
 *
 * **Está en este archivo y no en un módulo nuevo, a propósito**, y el motivo es
 * de deploy: `scripts/que-deployar.sh` sabe que `functions/calendario.js` entra
 * al bundle del panel por el alias `@calendario` y lo trata como caso especial.
 * Un `functions/tiempo.js` importado desde acá también estaría en el bundle,
 * pero caería del lado de "es de functions, no afecta a hosting" y un cambio
 * suyo dejaría el panel viejo **en silencio** — que es justo lo que la lista
 * negra de ese script existe para evitar.
 *
 * **El respaldo es `null` y no `0` porque `null` es el dato honesto:** "no hay
 * fecha" no es "el 1 de enero de 1970". Cada consumidor decide qué hacer con
 * eso, y las dos decisiones son distintas y las dos son correctas: el orden de
 * las sesiones manda las sin fecha primero (`?? 0`), y el backoff del rebuild
 * sin `ultimoIntento` no tiene de dónde medir y dispara.
 */
export const milisDe = (t) => {
  if (t == null) return null;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * Para ordenar: una sesión sin `inicio` usable cuenta como `0` y queda primera.
 * El schema rechaza una sesión sin fechas en los dos niveles, así que es un
 * documento roto a mano — y descontarla del total le correría el número a todas
 * las demás (D-190).
 */
const paraOrdenar = (t) => milisDe(t) ?? 0;

/**
 * Qué lugar ocupa un encuentro dentro de su actividad: `{ indice, total }`,
 * base 1. `null` si la sesión no pertenece a la actividad.
 *
 * ── La aritmética, una sola vez (B-163, D-20, D-71) ────────────────────────
 * El número sale en dos pantallas: el "2 de 8" de la vista calendario del
 * panel (`encuentrosDe`, D-70) y el "Encuentro 2 de 8" de la descripción del
 * evento público. Hasta acá cada lado lo **calculaba por su cuenta** —el panel
 * ordenaba y contaba en `encuentrosDe`, el evento ordenaba y contaba en
 * `posicionEnCiclo`— y coincidían porque los dos habían llegado al mismo
 * criterio, no porque fuera el mismo código. Es la forma que D-71 y D-20
 * evitan: dos criterios para lo mismo derivado, que el día que uno se toque se
 * separan sin que nada falle. B-84 fue exactamente eso (el panel decía "6 de
 * 8" y el evento "5 de 7").
 *
 * Ahora la cuenta es esta función y el panel la importa. Lo que queda decidido
 * por separado —a propósito— es **cuándo se muestra**, que es otra cosa: ver
 * `elEventoNumeraElCiclo` abajo.
 *
 * ── Se cuentan también los cancelados (D-95) ───────────────────────────────
 * El número es la identidad del encuentro dentro del ciclo —con qué lectura se
 * corresponde, qué fila del formulario es—, no un recuento en vivo de los que
 * siguen en pie. Numerar sobre las no canceladas hacía que cancelar el tercero
 * de ocho convirtiera al sexto en "Encuentro 5 de 7": el diff reescribía los
 * otros siete eventos y a quien lo tenía agendado se le renombraba sin que nada
 * hubiera cambiado para él (B-84).
 *
 * El cancelado no tiene evento (§7.3), así que en el calendario queda un hueco
 * en la secuencia. Eso es información —hubo un encuentro y se canceló—, no un
 * error de conteo.
 *
 * Se numera **por fecha y no por posición en el array**: el array puede estar
 * desordenado (el formulario deja mover las filas) y "Encuentro 5" tiene que
 * ser el quinto en el tiempo.
 */
export const numeroDeEncuentro = (actividad, sesion) => {
  const sesiones = actividad?.sesiones ?? [];
  const ordenadas = [...sesiones].sort((a, b) => paraOrdenar(a?.inicio) - paraOrdenar(b?.inicio));

  const i = ordenadas.findIndex((s) => s?.id === sesion?.id);
  if (i === -1) return null;
  return { indice: i + 1, total: ordenadas.length };
};

/**
 * ¿El evento público **dice** qué encuentro del ciclo es este?
 *
 * Solo si el dueño declaró que la actividad es un ciclo y hay más de un
 * encuentro. El schema prohíbe `esCiclo` con menos de dos sesiones, pero no el
 * recíproco: tres encuentros sin tildar el ciclo es un documento válido.
 *
 * **La regla de cuándo mostrar el número no está unificada con el panel, y esa
 * es la mitad abierta de B-163.** La vista calendario numera cualquier
 * actividad de más de una sesión (`total > 1` en `CalendarioActividades`),
 * así que en un documento de tres sesiones sin `esCiclo` el panel numera y el
 * evento no dice nada. La **aritmética** ya es una sola (`numeroDeEncuentro`);
 * lo que sigue siendo una decisión de producto es qué criterio gana, y las dos
 * salidas cuestan distinto:
 *
 *  - que el evento numere con más de una sesión aunque no sea ciclo → cambia el
 *    texto de los eventos **ya publicados** de esas actividades, o sea el
 *    argumento de D-95 y B-84 otra vez;
 *  - que el panel deje de numerar sin `esCiclo` → no toca nada publicado, pero
 *    devuelve el problema que la regla 1 de D-70 resuelve (varias filas con el
 *    mismo título se leen como varias actividades).
 *
 * Se deja acá, exportada y con nombre, para que elegir sea una línea y para que
 * el criterio del evento no vuelva a estar escrito inline en medio de la
 * descripción.
 */
export const elEventoNumeraElCiclo = (actividad) =>
  actividad?.esCiclo === true && (actividad?.sesiones ?? []).length >= 2;

/** "Encuentro 3 de 8" para la descripción del evento, o `null`. */
const posicionEnCiclo = (actividad, sesion) => {
  if (!elEventoNumeraElCiclo(actividad)) return null;
  const numero = numeroDeEncuentro(actividad, sesion);
  return numero ? `Encuentro ${numero.indice} de ${numero.total}` : null;
};

/**
 * §7.4 — Descripción del evento con todo lo que se cargó en el formulario y es
 * publicable. Texto plano: es lo que renderiza bien en todos los clientes de
 * calendario, incluido el mail del recordatorio.
 */
export const construirDescripcion = (actividad, sesion, labels = {}) => {
  const bloques = [];

  // ── Encabezado: qué es y, si es ciclo, qué encuentro ──────────
  const tipo = etiqueta(labels, 'tipo', actividad.tipo);
  const posicion = posicionEnCiclo(actividad, sesion);
  const encabezado = [tipo, posicion].filter(Boolean).join(' · ');
  if (encabezado) bloques.push(encabezado);

  if (actividad.descripcion) bloques.push(actividad.descripcion.trim());

  // ── La obra (DEC-1) ───────────────────────────────────────────
  /**
   * El libro presentado va **acá adentro** y no armado por fuera de
   * `construirEvento`: así entra al payload que compara la guarda anti-loop, y
   * cambiar el título de la obra propaga solo a las N sesiones del ciclo (D-07,
   * trampa 9). Armarlo afuera dejaría de propagarse en silencio.
   *
   * Es público a propósito: «presentación de tal libro» es el dato central del
   * evento, del mismo orden que el título de la actividad (§5.1).
   *
   * El autor sale solo si está cargado, que es solo cuando **difiere del
   * invitado** (ver `Libro.autor`): repetirlo abajo, en «Invitado», sería decir
   * dos veces la misma cosa.
   */
  const libro = actividad.libro;
  if (libro?.titulo) {
    bloques.push(`Libro: ${libro.titulo}${libro.autor ? ` — ${libro.autor}` : ''}`);
  }

  // ── De este encuentro ─────────────────────────────────────────
  const deEsteEncuentro = [];
  if (sesion.tema) deEsteEncuentro.push(`Tema: ${sesion.tema}`);
  if (sesion.lectura) deEsteEncuentro.push(`Lectura: ${sesion.lectura}`);
  if (deEsteEncuentro.length) bloques.push(deEsteEncuentro.join('\n'));

  // ── Dónde ─────────────────────────────────────────────────────
  /*
   * B-224 — una entrada por **forma de cursar**, con su lugar: un club que se da
   * presencial en una librería y virtual por Meet tiene que decir las dos cosas,
   * y con una sede sola no se podía.
   *
   * Va **adentro** de `construirDescripcion` y no armado por fuera de
   * `construirEvento`, como el libro y el cupo completo: así entra al payload que
   * compara la guarda anti-loop, y cambiar una sede propaga solo a las N sesiones
   * del ciclo (D-07, trampa 9). Armarlo afuera dejaría de propagarse en silencio.
   *
   * **Las fechas de la modalidad NO salen acá** (B-224, decisión pendiente del
   * dueño): qué significan frente a las de los encuentros no está resuelto, y un
   * campo que no sale no puede decir algo equivocado en el calendario de todos
   * los suscriptos. Sacarlo después de publicado no se puede.
   *
   * Con **una sola fila** el texto es exactamente el de antes de B-224, y es
   * deliberado: si cambiara, el diff del §7.2 vería un evento distinto y la
   * primera edición de cada actividad publicada reescribiría sus N eventos sin
   * que nada hubiera cambiado para quien los tiene agendados (el argumento de
   * D-95).
   *
   * **`?? []` y no una rama de compatibilidad que sintetice una fila** con el
   * `modalidad`/`sede`/`online` de primer nivel. La hubo, y se sacó: no hay
   * documentos sin el campo —el dueño lo dijo: «no hay nada en producción»— así
   * que esa rama era una superficie más de la proyección pública, sin ningún
   * centinela que la recorriera. El arreglo más barato para una rama de
   * proyección sin barrido es no tener la rama.
   */
  const filas = actividad.modalidades ?? [];

  for (const fila of filas) {
    const donde = [`Modalidad: ${ETIQUETA_MODALIDAD[fila.modalidad] ?? fila.modalidad}`];
    if (fila.sede) {
      const s = fila.sede;
      if (s.nombre) donde.push(s.nombre);
      const calle = [s.direccion, etiqueta(labels, 'barrio', s.barrio), s.ciudad]
        .map((p) => (p ?? '').trim())
        .filter(Boolean)
        .join(', ');
      if (calle) donde.push(calle);
      if (s.indicaciones) donde.push(`Cómo llegar: ${s.indicaciones}`);
      const mapa = linkMapaDeSede(s, labels, fila.modalidad);
      if (mapa) donde.push(`Mapa: ${mapa}`);
    }
    if (fila.online?.plataforma) {
      const plataforma = etiqueta(labels, 'plataforma', fila.online.plataforma);
      // El §7.4 dice que el link no va nunca. Se respeta el flag `urlPublica` del
      // modelo (§3.1) por decisión explícita del dueño: sin eso, la casilla del
      // formulario prometía algo que no pasaba. Default false, y el formulario
      // advierte sobre el zoombombing.
      if (fila.online.urlPublica && fila.online.url) {
        donde.push(`Plataforma: ${plataforma}`, `Link: ${fila.online.url}`);
      } else {
        donde.push(`Plataforma: ${plataforma} (el link se envía a quienes se inscriban)`);
      }
    }
    bloques.push(donde.join('\n'));
  }

  // ── Arancel ───────────────────────────────────────────────────
  const arancel = [];
  if (actividad.arancel?.tipo) {
    arancel.push(`Arancel: ${etiqueta(labels, 'arancel', actividad.arancel.tipo)}`);
  }
  if (actividad.arancel?.notas) arancel.push(actividad.arancel.notas);
  if (arancel.length) bloques.push(arancel.join('\n'));

  // ── Inscripción ───────────────────────────────────────────────
  /**
   * B-97 — «Cupo completo» va **acá adentro**, como el libro: entra al payload
   * que compara la guarda anti-loop, así que prenderlo actualiza los N eventos
   * del ciclo sin ningún caso especial (D-07, trampa 9). Armado por fuera de
   * `construirEvento` dejaría de propagarse en silencio.
   *
   * Es el punto del campo: quien ya estaba suscripto al calendario se entera de
   * que se llenó **sin que nadie le avise**, que es la única vez que un
   * calendario público vale más que una página.
   *
   * **El canal de inscripción no se esconde**, y es decisión del dueño: la línea
   * va arriba y el «Inscripción por…» queda abajo. Siempre hay lista de espera y
   * las bajas existen, así que esconder el canal convierte una baja en un lugar
   * que se pierde. El paréntesis dice por qué el canal sigue ahí; sin él, un
   * cupo completo con un mail al lado se lee como un error.
   */
  const insc = actividad.inscripcion;
  const completo = insc?.completo === true;
  if (insc?.requiere) {
    const lineas = [];
    if (completo) {
      lineas.push('Cupo completo (se puede escribir igual: puede liberarse un lugar)');
    }
    lineas.push(
      `Inscripción ${ETIQUETA_VIA[insc.via] ?? ''}`.trim() +
        (insc.destino ? `: ${insc.destino}` : ''),
    );
    if (insc.cupo) lineas.push(`Cupo: ${insc.cupo}`);
    if (insc.cierra) {
      lineas.push(
        `Cierra: ${fecha(insc.cierra, { dateStyle: 'long', timeStyle: 'short' })}`,
      );
    }
    bloques.push(lineas.join('\n'));
  } else if (insc) {
    // Sin inscripción previa también se llena: es un hecho de la sala, no del
    // canal. Acá no hay a quién escribirle, así que la línea va sola y seca.
    bloques.push(completo ? 'Sin inscripción previa\nCupo completo' : 'Sin inscripción previa');
  }

  // ── Material (§5.1: la URL solo si es pública) ─────────────────
  const items = actividad.material?.tiene ? (actividad.material.items ?? []) : [];
  if (items.length) {
    const lineas = items.map((i) => {
      // `otro` no se nombra en el evento (B-182). "Otro" no le dice nada a quien
      // lee —el título ya dice qué es: "Playlist inspirada en el libro (Otro,
      // previo al encuentro)"— y en la práctica es el formato más usado, porque
      // es donde cae todo lo que no entra en los demás. La entrega sí se
      // conserva: eso no está en el título. En el panel «Otro» sigue siendo una
      // opción del desplegable, que es otra cosa: ahí hay que poder elegirla.
      const tipo = i.tipo === 'otro' ? null : (ETIQUETA_TIPO_MATERIAL[i.tipo] ?? i.tipo);
      const meta = [tipo, ETIQUETA_ENTREGA[i.entrega] ?? i.entrega]
        .filter(Boolean)
        .join(', ');
      const base = `- ${i.titulo}${meta ? ` (${meta})` : ''}`;
      return i.publico && i.url ? `${base}: ${i.url}` : base;
    });
    bloques.push(['Material:', ...lineas].join('\n'));
  }

  // ── Quién ─────────────────────────────────────────────────────
  const quien = [];
  const org = actividad.organizador;
  if (org?.nombre) {
    quien.push(`Organiza: ${[org.nombre, org.instagram, org.web].filter(Boolean).join(' · ')}`);
  }
  const persona = actividad.tallerista;
  if (persona?.nombre) {
    const rol =
      actividad.tipo === 'presentacion' || actividad.tipo === 'charla' ? 'Invitado' : 'Tallerista';
    quien.push(`${rol}: ${[persona.nombre, persona.instagram].filter(Boolean).join(' · ')}`);
    if (persona.bio) quien.push(persona.bio);
  }
  if (quien.length) bloques.push(quien.join('\n'));

  // ── Tags ──────────────────────────────────────────────────────
  const tags = (actividad.tags ?? []).map((t) => etiqueta(labels, 'tags', t)).filter(Boolean);
  if (tags.length) bloques.push(`Temas: ${tags.join(', ')}`);

  return bloques.join('\n\n');
};

/**
 * §7.4 — Cuerpo completo del evento.
 *
 * `timeZone` explícito y siempre: es el bug clásico de eventos corridos tres
 * horas (trampa 1).
 */
export const construirEvento = (actividad, sesion, labels = {}) => {
  const aIso = (t) =>
    (typeof t?.toDate === 'function' ? t.toDate() : new Date(t)).toISOString();

  return {
    summary: actividad.titulo + (sesion.tema ? ` — ${sesion.tema}` : ''),
    description: construirDescripcion(actividad, sesion, labels),
    location: construirUbicacion(actividad, labels),
    start: { dateTime: aIso(sesion.inicio), timeZone: TIMEZONE },
    end: { dateTime: aIso(sesion.fin), timeZone: TIMEZONE },
  };
};

const porId = (sesiones = []) => new Map(sesiones.map((s) => [s.id, s]));

/**
 * §7.3 — Una sesión tiene evento en el calendario solo si la actividad está
 * publicada y la sesión no está cancelada.
 *
 * Se exporta para que la vista previa del panel avise "esto todavía no existe
 * en el calendario" con el mismo criterio que aplica el sync, en lugar de
 * reimplementarlo y arriesgarse a que las dos versiones se separen.
 */
export const debeExistir = (actividad, sesion) =>
  actividad?.estado === 'publicado' && !sesion.cancelada;

/**
 * §7.1 — Guarda anti-loop.
 *
 * En vez de mantener a mano una lista de campos relevantes, se compara el
 * evento que se le mandaría a Calendar antes y después. Dos consecuencias:
 *
 *  - `calendarEventId` no participa: `construirEvento` no lo lee. La escritura
 *    del id de vuelta en el documento vuelve a disparar la Function, produce
 *    el mismo payload, no genera operaciones y la recursión se corta. No hay
 *    forma de romperlo por olvido, que es lo que pasaba con la lista de
 *    campos: agregar un dato a la descripción sin agregarlo a la lista dejaba
 *    de propagar ese cambio al calendario, en silencio.
 *  - Un cambio que no altera el evento (difusión interna, el link privado de
 *    la reunión) no dispara ningún update.
 */
const mismoEvento = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * §7.2 — Diff por id de sesión. Devuelve las operaciones a aplicar, sin
 * ejecutarlas.
 *
 * Se resuelve por id y nunca por índice: si se usara el índice, borrar la
 * sesión 3 renumera el array y el diff creería que cambiaron cinco encuentros
 * en vez de uno, borrando y recreando eventos que la gente ya tiene agendados
 * (y perdiendo sus recordatorios).
 */
export const planificar = (antes, despues, labels = {}) => {
  const ops = [];
  const sesionesAntes = porId(antes?.sesiones);
  const sesionesDespues = porId(despues?.sesiones);

  // La actividad se borró por completo: se van todos sus eventos.
  if (!despues) {
    for (const [id, s] of sesionesAntes) {
      if (s.calendarEventId) ops.push({ tipo: 'borrar', id, eventId: s.calendarEventId });
    }
    return ops;
  }

  // Sesiones eliminadas del array.
  for (const [id, s] of sesionesAntes) {
    if (!sesionesDespues.has(id) && s.calendarEventId) {
      ops.push({ tipo: 'borrar', id, eventId: s.calendarEventId });
    }
  }

  for (const [id, sesion] of sesionesDespues) {
    const previa = sesionesAntes.get(id);
    const eventId = previa?.calendarEventId ?? sesion.calendarEventId ?? null;

    if (!debeExistir(despues, sesion)) {
      // Pasó a borrador/cancelado, o se canceló el encuentro.
      if (eventId) ops.push({ tipo: 'borrar', id, eventId });
      continue;
    }

    const evento = construirEvento(despues, sesion, labels);

    if (!eventId) {
      ops.push({ tipo: 'crear', id, evento });
      continue;
    }

    // Un cambio de sede o de título altera el payload de las N sesiones del
    // ciclo, así que se propaga a todas sin ningún caso especial (trampa 9).
    const eventoAntes =
      previa && antes && debeExistir(antes, previa)
        ? construirEvento(antes, previa, labels)
        : null;

    if (!mismoEvento(evento, eventoAntes)) {
      ops.push({ tipo: 'actualizar', id, eventId, evento });
    }
  }

  return ops;
};
