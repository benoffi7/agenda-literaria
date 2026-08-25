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
export const construirUbicacion = (actividad, labels = {}) => {
  const sede = actividad.sede;
  if (!sede) {
    // Virtual sin sede: la plataforma en el campo location hace que se lea en
    // la vista de agenda sin abrir el evento.
    return actividad.modalidad === 'virtual' ? 'Encuentro virtual' : undefined;
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

/**
 * Link al mapa. Si la sede tiene coordenadas se usan, que es exacto; si no, la
 * búsqueda por dirección, que es lo que Google resuelve igual de bien para una
 * dirección completa.
 */
export const construirLinkMapa = (actividad, labels = {}) => {
  const sede = actividad.sede;
  if (!sede) return null;

  const geo = sede.geo;
  const query =
    geo && typeof geo.lat === 'number' && typeof geo.lng === 'number'
      ? `${geo.lat},${geo.lng}`
      : construirUbicacion(actividad, labels);

  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

/**
 * Numera el encuentro dentro del ciclo: "Encuentro 3 de 8".
 *
 * Se numera sobre **todas** las sesiones del array, canceladas incluidas
 * (D-95). El número es la identidad del encuentro dentro del ciclo —con qué
 * lectura se corresponde, qué fila del formulario es—, no un recuento en vivo
 * de los que siguen en pie. Numerar sobre las no canceladas hacía que cancelar
 * el tercero de ocho convirtiera al sexto en "Encuentro 5 de 7": el diff
 * reescribía los otros siete eventos y a quien lo tenía agendado se le
 * renombraba sin que nada hubiera cambiado para él (B-84).
 *
 * Es además el mismo criterio que usa el panel para el "2 de 8" de la vista
 * calendario (`encuentrosDe`, D-70): antes el panel decía "6 de 8" y el evento
 * público "5 de 7" para el mismo encuentro.
 *
 * El cancelado no tiene evento (§7.3), así que en el calendario queda un hueco
 * en la secuencia. Eso es información —hubo un encuentro y se canceló—, no un
 * error de conteo.
 */
const posicionEnCiclo = (actividad, sesion) => {
  const sesiones = actividad.sesiones ?? [];
  if (!actividad.esCiclo || sesiones.length < 2) return null;

  // Se numera por fecha, no por posición en el array: el array puede estar
  // desordenado y "Encuentro 5" tiene que ser el quinto en el tiempo.
  const ordenadas = [...sesiones].sort((a, b) => {
    const ma = typeof a.inicio?.toMillis === 'function' ? a.inicio.toMillis() : 0;
    const mb = typeof b.inicio?.toMillis === 'function' ? b.inicio.toMillis() : 0;
    return ma - mb;
  });

  const i = ordenadas.findIndex((s) => s.id === sesion.id);
  if (i === -1) return null;
  return `Encuentro ${i + 1} de ${ordenadas.length}`;
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

  // ── De este encuentro ─────────────────────────────────────────
  const deEsteEncuentro = [];
  if (sesion.tema) deEsteEncuentro.push(`Tema: ${sesion.tema}`);
  if (sesion.lectura) deEsteEncuentro.push(`Lectura: ${sesion.lectura}`);
  if (deEsteEncuentro.length) bloques.push(deEsteEncuentro.join('\n'));

  // ── Dónde ─────────────────────────────────────────────────────
  const donde = [`Modalidad: ${ETIQUETA_MODALIDAD[actividad.modalidad] ?? actividad.modalidad}`];
  if (actividad.sede) {
    const s = actividad.sede;
    if (s.nombre) donde.push(s.nombre);
    const calle = [s.direccion, etiqueta(labels, 'barrio', s.barrio), s.ciudad]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(', ');
    if (calle) donde.push(calle);
    if (s.indicaciones) donde.push(`Cómo llegar: ${s.indicaciones}`);
    const mapa = construirLinkMapa(actividad, labels);
    if (mapa) donde.push(`Mapa: ${mapa}`);
  }
  if (actividad.online?.plataforma) {
    const plataforma = etiqueta(labels, 'plataforma', actividad.online.plataforma);
    // El §7.4 dice que el link no va nunca. Se respeta el flag `urlPublica` del
    // modelo (§3.1) por decisión explícita del dueño: sin eso, la casilla del
    // formulario prometía algo que no pasaba. Default false, y el formulario
    // advierte sobre el zoombombing.
    if (actividad.online.urlPublica && actividad.online.url) {
      donde.push(`Plataforma: ${plataforma}`, `Link: ${actividad.online.url}`);
    } else {
      donde.push(`Plataforma: ${plataforma} (el link se envía a quienes se inscriban)`);
    }
  }
  bloques.push(donde.join('\n'));

  // ── Arancel ───────────────────────────────────────────────────
  const arancel = [];
  if (actividad.arancel?.tipo) {
    arancel.push(`Arancel: ${etiqueta(labels, 'arancel', actividad.arancel.tipo)}`);
  }
  if (actividad.arancel?.notas) arancel.push(actividad.arancel.notas);
  if (arancel.length) bloques.push(arancel.join('\n'));

  // ── Inscripción ───────────────────────────────────────────────
  const insc = actividad.inscripcion;
  if (insc?.requiere) {
    const lineas = [
      `Inscripción ${ETIQUETA_VIA[insc.via] ?? ''}`.trim() +
        (insc.destino ? `: ${insc.destino}` : ''),
    ];
    if (insc.cupo) lineas.push(`Cupo: ${insc.cupo}`);
    if (insc.cierra) {
      lineas.push(
        `Cierra: ${fecha(insc.cierra, { dateStyle: 'long', timeStyle: 'short' })}`,
      );
    }
    bloques.push(lineas.join('\n'));
  } else if (insc) {
    bloques.push('Sin inscripción previa');
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
