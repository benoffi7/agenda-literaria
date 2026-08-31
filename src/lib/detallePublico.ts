/**
 * La página de detalle — **la salida pública nueva** (B-227, §4.3 del diseño).
 *
 * ── Por qué esto existe en vez de leer la actividad desde el `.astro` ──────
 * Porque la frontera de privacidad tiene que ser **un tipo**, no la disciplina de
 * quien escribe la plantilla (D-140).
 *
 * `src/pages/actividad/[slug].astro` recibe un `DetallePublico` y **nada más**:
 * no tiene en mano ni el documento de Firestore ni la `ActividadPublica`, así que
 * no puede interpolar `online.url` ni `difusion` aunque quiera —no los tiene—. La
 * decisión de qué se muestra se toma acá, en un módulo puro, enumerando campo por
 * campo; la plantilla solo acomoda.
 *
 * Eso es además lo que hace que la salida sea **testeable**: un `.astro` no se
 * puede importar desde vitest, y el barrido de centinelas necesita un valor sobre
 * el cual afirmar. Con el view-model, `tests/barrido-de-salidas-publicas.test.ts`
 * barre esta salida igual que las otras, y `tests/pagina-de-detalle.test.ts`
 * verifica que la plantilla no lea nada más que estas props.
 *
 * ── Es la CUARTA proyección en serie sobre el mismo documento ──────────────
 * `toPublic` (qué puede ser público) → `entradaDeIndice` (qué necesita el
 * listado) → `opcionesPublicas` (las taxonomías) → **esto** (qué muestra el
 * detalle, que es *más* que el índice y *menos* que `toPublic`). Como el índice,
 * recorta una `ActividadPublica` y no una `Actividad`: no puede publicar algo que
 * la frontera ya descartó, porque no lo recibe.
 *
 * ── Las tres reglas que no se negocian ────────────────────────────────────
 * 1. **`online.url` no sale, ni con `urlPublica: true`** (D-139). Es más
 *    estricto que D-15, que lo permite en las salidas 1 y 2. Ver el docblock de
 *    `modalidadDeDetalle`.
 * 2. **Ningún `href` que no sea `http:`/`https:`** (`urlSegura`). El destino de
 *    inscripción, la web del organizador y la URL de un material son texto libre
 *    de un formulario, y un `javascript:` ahí es un XSS en una página pública.
 * 3. **Nada de `difusion`, `createdBy`/`updatedBy`, `storagePath` ni
 *    `calendarEventId`**: no llegan hasta acá, porque `toPublic` ya los dejó
 *    afuera y esto no ve el documento.
 */
// `resumenDe` vive en `eventsJson.ts` porque nació con el índice: se importa para
// que la tarjeta del listado y la `meta description` del detalle recorten igual.
import { NOMBRE } from '@/lib/identidad';
import { resumenDe } from '@/lib/eventsJson';
import { fechaCompleta, fechaLarga, hora, isoConOffset, rangoCorto } from '@/lib/fechasPublicas';
import { etiquetaDe, type MapaDeEtiquetas } from '@/lib/listadoPublico';
import { instanteDeIso } from '@/lib/sesiones';
import type { ActividadPublica, ItemMaterialPublico } from '@/lib/toPublic';
import type { Modalidad } from '@/types/actividad';
import { ETIQUETA_TIPO_MATERIAL, construirLinkMapa, desSlug } from '@calendario';

// ─────────────────────────────────────────────────────────────────
// Saneamiento de lo que va a un href
// ─────────────────────────────────────────────────────────────────

/**
 * Una URL que se puede poner en un `href`, o `null`.
 *
 * **Solo `http:` y `https:`.** `organizador.web`, `inscripcion.destino` con vía
 * «formulario» y `material.items[].url` son campos de texto libre de un
 * formulario, y un `javascript:…` en cualquiera de los tres es un XSS en una
 * página pública. Astro escapa el **contenido**, no el esquema de un `href`.
 *
 * Sin esquema se asume `https://`: quien carga escribe «casabrandon.com», y
 * pedirle el `https://` en el formulario para que el link ande es trasladarle un
 * detalle nuestro.
 */
export const urlSegura = (crudo: string | null | undefined): string | null => {
  const texto = (crudo ?? '').trim();
  if (!texto) return null;
  const candidato = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(texto) ? texto : `https://${texto}`;
  try {
    const url = new URL(candidato);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/**
 * `@casabrandon` / `casabrandon` / `instagram.com/casabrandon` → el handle solo.
 *
 * Se valida contra el alfabeto real de Instagram: lo que no lo cumple no se
 * convierte en link, se muestra como texto. Un handle con una barra adentro
 * armaría una URL a otra cuenta.
 */
export const handleInstagram = (crudo: string | null | undefined): string | null => {
  const limpio = (crudo ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(limpio) ? limpio : null;
};

/** La URL del perfil, o `null` si el handle no es uno. El texto se muestra igual. */
export const enlaceInstagram = (crudo: string | null | undefined): string | null => {
  const handle = handleInstagram(crudo);
  return handle ? `https://instagram.com/${handle}` : null;
};

// ─────────────────────────────────────────────────────────────────
// El view-model
// ─────────────────────────────────────────────────────────────────

export interface EncuentroDeDetalle {
  /** El uuid de la sesión (§3.1): es el ancla `#ses_…` de la fila. */
  id: string;
  /** `1` … `N`, **numerado sobre todas las sesiones, canceladas incluidas**. */
  numero: number;
  inicioIso: string;
  finIso: string;
  fecha: string;
  hora: string;
  tema: string | null;
  lectura: string | null;
  cancelada: boolean;
  /** Ya terminó, según el reloj del build. */
  paso: boolean;
}

export interface SedeDeDetalle {
  nombre: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  indicaciones: string;
  /** El link a Google Maps, armado con `construirLinkMapa` (el del evento). */
  mapa: string | null;
}

export interface ModalidadDeDetalle {
  id: string;
  modalidad: Modalidad;
  etiqueta: string;
  sede: SedeDeDetalle | null;
  /** **Solo la plataforma.** El link de la reunión no llega hasta acá (D-139). */
  plataforma: string | null;
}

export interface MaterialDeDetalle {
  tipo: string;
  tipoEtiqueta: string;
  titulo: string;
  entrega: string;
  /** `null` en un item privado: sobreviven tipo y título, no la URL (§5.1). */
  url: string | null;
}

export interface AccionDeInscripcion {
  /** El verbo real de la vía: «Escribir por WhatsApp», «Mandar un mail»… */
  texto: string;
  href: string;
}

export interface DetallePublico {
  slug: string;
  titulo: string;
  tipo: string;
  tipoEtiqueta: string;
  descripcion: string;
  resumen: string;

  imagenes: { url: string; epigrafe: string; ancho: number | null; alto: number | null }[];

  esCiclo: boolean;
  /** `Ciclo de 8 encuentros`, o `null` si no hay nada que decir. */
  rotuloCiclo: string | null;
  encuentros: EncuentroDeDetalle[];
  /** La próxima fecha en palabras, o `null` si ya pasó todo. */
  proxima: { fecha: string; desde: string; hasta: string } | null;
  yaPaso: boolean;
  yaEmpezo: boolean;
  /**
   * ¿Vale la pena listar los encuentros aparte de la ficha?
   *
   * Con más de uno, siempre: es la lista del ciclo. Con **uno solo** depende de
   * si tiene algo que la ficha no dice —tema, lectura, o que esté cancelado—,
   * y ese caso apareció mirando el HTML de verdad: con la condición ingenua
   * (`> 1`), una charla de una sola fecha con su tema cargado **perdía el tema**,
   * que el evento de Calendar sí publica en el `summary`. Una página pública que
   * dice menos que el calendario del mismo encuentro está mal.
   */
  mostrarEncuentros: boolean;

  modalidades: ModalidadDeDetalle[];
  /** El texto corto de dónde: «Casa Brandon · Boedo» o «Online por Meet». */
  donde: string;

  arancel: { etiqueta: string; notas: string; esGratis: boolean };

  inscripcion: {
    requiere: boolean;
    /** El canal, en texto. Sale **también** con el cupo completo (D-127). */
    destino: string;
    accion: AccionDeInscripcion | null;
    cupo: number | null;
    completo: boolean;
    /** «22 de septiembre de 2026», o `null` si no cierra. */
    cierra: string | null;
    /** Cerró, según el reloj del build. */
    cerrada: boolean;
  };

  /**
   * El texto **siempre**, el link **solo si se puede armar uno seguro**.
   *
   * Son dos campos y no uno porque perder el dato por un formato raro es peor
   * que no linkearlo: quien cargó «Casa Brandon / IG @casa.brandon» escribió algo
   * que una persona entiende y una URL no. El texto sale igual; el `href` solo
   * cuando `handleInstagram` / `urlSegura` dan algo válido.
   */
  organizador: {
    nombre: string;
    instagram: string;
    instagramUrl: string | null;
    web: string;
    webUrl: string | null;
  };
  tallerista: {
    nombre: string;
    bio: string;
    instagram: string;
    instagramUrl: string | null;
  } | null;
  libro: { titulo: string; autor: string } | null;
  material: { tiene: boolean; items: MaterialDeDetalle[] };
  /** Las **etiquetas** de los temas. El slug no se muestra ni linkea a nada todavía. */
  tags: string[];

  /** `<title>` y `meta description` (§5.1 del diseño). */
  meta: { titulo: string; descripcion: string };
}

/**
 * Cuándo llega el material, **en el idioma de la página**.
 *
 * No se importa de `@calendario`: ahí `ETIQUETA_ENTREGA` está en minúscula
 * porque cae a mitad de una frase entre paréntesis y **no se exporta a
 * propósito** —lo dice su docblock—. Acá encabeza una línea. Es la misma
 * distinción que ese archivo ya hizo con el panel: los sustantivos se comparten
 * (`ETIQUETA_TIPO_MATERIAL`, importado), la prosa no.
 */
const ETIQUETA_ENTREGA: Record<string, string> = {
  previo: 'se manda antes del encuentro',
  'al-inscribirse': 'se manda al inscribirte',
  'durante-el-mes': 'se manda durante el mes',
  'en-el-encuentro': 'se entrega en el encuentro',
};

const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Presencial y virtual',
};

const ETIQUETA_VIA: Record<string, string> = {
  mail: 'Mandar un mail',
  whatsapp: 'Escribir por WhatsApp',
  dm: 'Escribir por Instagram',
  formulario: 'Anotarme en el formulario',
};

/**
 * El botón, con el verbo de la vía real (§4.3 del diseño).
 *
 * Cada vía arma su `href` a su manera y **ninguna confía en el texto tal cual**:
 *
 * - `mail` → `mailto:` con asunto precargado, y solo si el destino parece un mail.
 * - `whatsapp` → `wa.me` con los dígitos del teléfono y el mensaje precargado. Si
 *   no hay dígitos suficientes no se arma el link: mandar a `wa.me/` pelado es un
 *   botón que no hace nada.
 * - `dm` → el perfil, con el handle validado.
 * - `formulario` → la URL, pasada por `urlSegura`.
 *
 * Sin vía reconocida o sin destino usable **no hay botón**, y la página muestra
 * el canal como texto. Un botón que no lleva a ningún lado es peor que ninguno.
 */
export const accionDeInscripcion = (
  via: string | null,
  destino: string,
  titulo: string,
): AccionDeInscripcion | null => {
  const texto = ETIQUETA_VIA[via ?? ''] ?? null;
  const valor = destino.trim();
  if (!texto || !valor) return null;
  const mensaje = `Hola, quiero anotarme en ${titulo}`;

  if (via === 'mail') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return null;
    return {
      texto,
      href: `mailto:${valor}?subject=${encodeURIComponent(`Inscripción: ${titulo}`)}`,
    };
  }
  if (via === 'whatsapp') {
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length < 8) return null;
    return { texto, href: `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}` };
  }
  if (via === 'dm') {
    const handle = handleInstagram(valor);
    return handle ? { texto, href: `https://instagram.com/${handle}` } : null;
  }
  const url = urlSegura(valor);
  return url ? { texto, href: url } : null;
};

/**
 * Una forma de cursar, con su lugar (B-224).
 *
 * **Acá se cae el link de la reunión, y es la decisión de D-139.** `toPublic`
 * emite `online.url` cuando el dueño tildó `urlPublica` (D-15, desvío consciente
 * del §5.2), y esta proyección **no lo copia**: sale la plataforma y nada más.
 *
 * El motivo es el mismo que D-129 dio para el índice, y vale más acá: la página
 * de detalle es la superficie que Google indexa y la que un bot cosecha primero.
 * Un link de reunión en un HTML público es zoombombing barato (trampa 5), y el
 * link se manda al inscribirse — que es para lo que está el botón de arriba. Si
 * el dueño quiere el link a la vista, el lugar donde eso se decide es el
 * formulario y la conversación que abre este comentario, no un `?.url` agregado
 * sin ruido.
 */
const modalidadDeDetalle = (
  m: ActividadPublica['modalidades'][number],
  etiquetas: MapaDeEtiquetas,
): ModalidadDeDetalle => ({
  id: m.id,
  modalidad: m.modalidad,
  etiqueta: ETIQUETA_MODALIDAD[m.modalidad] ?? desSlug(m.modalidad),
  sede: m.sede
    ? {
        nombre: m.sede.nombre,
        direccion: m.sede.direccion,
        barrio: etiquetaDe(etiquetas, 'barrio', m.sede.barrio),
        ciudad: m.sede.ciudad,
        indicaciones: m.sede.indicaciones,
        /*
         * El **mismo** armador de link que usa el evento de Calendar, importado
         * y no copiado (D-20): si divergieran, el mapa del sitio y el del
         * calendario apuntarían a lugares distintos para la misma sede. Usa las
         * coordenadas si están y la dirección escapada si no.
         */
        mapa: construirLinkMapa({ sede: m.sede, modalidad: m.modalidad }, etiquetas),
      }
    : null,
  // Enumerado: `m.online` puede traer `url` (D-15) y acá se descarta (D-139).
  plataforma: m.online ? etiquetaDe(etiquetas, 'plataforma', m.online.plataforma) : null,
});

const itemDeDetalle = (i: ItemMaterialPublico): MaterialDeDetalle => ({
  tipo: i.tipo,
  tipoEtiqueta: ETIQUETA_TIPO_MATERIAL[i.tipo] ?? desSlug(i.tipo),
  titulo: i.titulo,
  entrega: ETIQUETA_ENTREGA[i.entrega] ?? desSlug(i.entrega),
  // Un item privado llega sin `url` desde `toPublic`; el `urlSegura` es la
  // segunda mitad, contra un `javascript:` tipeado en un item público.
  url: urlSegura(i.url),
});

/** El texto corto de dónde, para la ficha y el `<title>`. */
const dondeCorto = (modalidades: ModalidadDeDetalle[]): string => {
  const lugares = modalidades
    .map((m) =>
      m.sede
        ? [m.sede.nombre, m.sede.barrio].filter(Boolean).join(' · ')
        : m.plataforma
          ? `Online por ${m.plataforma}`
          : m.etiqueta,
    )
    .filter(Boolean);
  return [...new Set(lugares)].join(' · ') || 'Lugar a confirmar';
};

/** La hora de fin del encuentro, para «19:00 a 21:00». */
const horaDeFin = (e: EncuentroDeDetalle): string => {
  const fin = instanteDeIso(e.finIso);
  return fin ? hora(fin) : '';
};

/**
 * `Ciclo de 8 encuentros · 3 sep – 22 oct`, o `null` si no hay nada que decir.
 *
 * §7.5 del diseño: con **una sola** sesión se confía en el flag `esCiclo` —el
 * dueño puede estar cargando el primer encuentro de un ciclo que sigue— pero se
 * escribe «1 encuentro» y no «Ciclo de 1 encuentro», que se lee como un error de
 * software. Y con `esCiclo: false` y tres sesiones se muestran las tres fechas
 * sin llamarlo ciclo: el flag manda para el vocabulario, los datos para las
 * fechas.
 */
const rotuloDeCiclo = (esCiclo: boolean, vivos: EncuentroDeDetalle[]): string | null => {
  if (vivos.length === 0) return null;
  if (vivos.length === 1) return '1 encuentro';
  const desde = instanteDeIso(vivos[0]!.inicioIso);
  const hasta = instanteDeIso(vivos[vivos.length - 1]!.inicioIso);
  const cabecera = `${esCiclo ? 'Ciclo de ' : ''}${vivos.length} encuentros`;
  return desde && hasta ? `${cabecera} · ${rangoCorto(desde, hasta)}` : cabecera;
};

/**
 * El view-model completo de una página de detalle.
 *
 * `ahora` es el reloj del **build**, y hay que saberlo: la página no lleva
 * JavaScript (§4.3 del diseño, presupuesto de 0 KB), así que «ya pasó» y «las
 * inscripciones cerraron» se congelan hasta el rebuild siguiente. Por eso la
 * página muestra siempre **la fecha** de cierre además del estado: una fecha no
 * puede envejecer mal.
 */
export const detalleDeActividad = (
  a: ActividadPublica,
  etiquetas: MapaDeEtiquetas,
  ahora: Date,
): DetallePublico => {
  const ordenadas = [...a.sesiones].sort((x, y) => x.inicio.localeCompare(y.inicio));

  const encuentros: EncuentroDeDetalle[] = ordenadas.map((s, i) => {
    const inicio = instanteDeIso(s.inicio);
    const fin = instanteDeIso(s.fin) ?? inicio;
    return {
      id: s.id,
      // Se numera sobre **todas**, canceladas incluidas: el número es la
      // identidad del encuentro dentro del ciclo, no un recuento en vivo de los
      // que siguen en pie. Es la misma regla que el evento de Calendar (D-95):
      // numerar sobre las no canceladas renombraba los otros siete eventos al
      // cancelar el tercero (B-84).
      numero: i + 1,
      inicioIso: inicio ? isoConOffset(inicio) : '',
      finIso: fin ? isoConOffset(fin) : '',
      fecha: inicio ? fechaLarga(inicio) : '',
      hora: inicio ? hora(inicio) : '',
      tema: s.tema,
      lectura: s.lectura,
      cancelada: s.cancelada,
      paso: Boolean(fin && fin.getTime() < ahora.getTime()),
    };
  });

  const vivos = encuentros.filter((e) => !e.cancelada);
  const proximos = vivos.filter((e) => !e.paso);
  const siguiente = proximos[0] ?? null;

  const modalidades = a.modalidades.map((m) => modalidadDeDetalle(m, etiquetas));
  const cierra = instanteDeIso(a.inscripcion.cierraEn);

  const tipoEtiqueta = etiquetaDe(etiquetas, 'tipo', a.tipo);
  const donde = dondeCorto(modalidades);

  return {
    slug: a.slug,
    titulo: a.titulo,
    tipo: a.tipo,
    tipoEtiqueta,
    descripcion: a.descripcion,
    resumen: resumenDe(a.descripcion),

    imagenes: a.imagenes.map((i) => ({
      // Una imagen con URL inválida se descarta abajo; acá se sanea igual.
      url: urlSegura(i.url) ?? '',
      epigrafe: i.epigrafe,
      ancho: i.ancho ?? null,
      alto: i.alto ?? null,
    })).filter((i) => i.url !== ''),

    esCiclo: a.esCiclo,
    rotuloCiclo: rotuloDeCiclo(a.esCiclo, vivos),
    encuentros,
    proxima: siguiente
      ? { fecha: siguiente.fecha, desde: siguiente.hora, hasta: horaDeFin(siguiente) }
      : null,
    yaPaso: proximos.length === 0,
    // §7.2 — «ya empezó, se puede entrar»: quedan encuentros y el primero quedó
    // atrás. Es lo que evita que la página diga «empieza el 3 de septiembre» en
    // octubre.
    yaEmpezo: proximos.length > 0 && proximos.length < vivos.length,
    mostrarEncuentros:
      encuentros.length > 1 ||
      encuentros.some((e) => e.tema || e.lectura || e.cancelada),

    modalidades,
    donde,

    arancel: {
      etiqueta: etiquetaDe(etiquetas, 'arancel', a.arancel.tipo),
      notas: a.arancel.notas,
      esGratis: a.arancel.tipo === 'gratis',
    },

    inscripcion: {
      requiere: a.inscripcion.requiere,
      destino: a.inscripcion.destino,
      accion: a.inscripcion.requiere
        ? accionDeInscripcion(a.inscripcion.via, a.inscripcion.destino, a.titulo)
        : null,
      cupo: a.inscripcion.cupo,
      completo: a.inscripcion.completo,
      cierra: cierra ? fechaCompleta(cierra) : null,
      cerrada: Boolean(cierra && cierra.getTime() <= ahora.getTime()),
    },

    organizador: {
      nombre: a.organizador.nombre,
      instagram: a.organizador.instagram,
      instagramUrl: enlaceInstagram(a.organizador.instagram),
      web: a.organizador.web,
      webUrl: urlSegura(a.organizador.web),
    },
    tallerista: a.tallerista
      ? {
          nombre: a.tallerista.nombre,
          bio: a.tallerista.bio,
          instagram: a.tallerista.instagram,
          instagramUrl: enlaceInstagram(a.tallerista.instagram),
        }
      : null,
    libro: a.libro ? { titulo: a.libro.titulo, autor: a.libro.autor } : null,
    material: {
      tiene: a.material.tiene,
      items: a.material.items.map(itemDeDetalle),
    },
    tags: a.tags.map((t) => etiquetaDe(etiquetas, 'tag', t)),

    meta: {
      // §5.1 del diseño — el título de la actividad **primero**: Google recorta a
      // ~60 caracteres y lo que importa es el nombre, no la marca. El barrio
      // entra porque es la palabra que hace match con «taller de escritura villa
      // crespo».
      titulo: `${a.titulo} · ${tipoEtiqueta} en ${donde} — ${NOMBRE}`,
      // Con la descripción vacía cae al formato armado, que es más útil que una
      // frase trunca (§7.7).
      descripcion:
        resumenDe(a.descripcion) ||
        [tipoEtiqueta, siguiente?.fecha, donde, etiquetaDe(etiquetas, 'arancel', a.arancel.tipo)]
          .filter(Boolean)
          .join(' · '),
    },
  };
};

// ─────────────────────────────────────────────────────────────────
// Datos estructurados — `Event` de schema.org (§5.2 y §5.3 del diseño)
// ─────────────────────────────────────────────────────────────────

/**
 * El `@type` según el tipo de actividad. Un tipo nuevo de la taxonomía (§4) cae
 * al genérico `Event`, que siempre es válido: la alternativa —adivinar un subtipo
 * por el nombre— es marcar un dato que no sabemos.
 */
const TIPO_SCHEMA: Record<string, string> = {
  taller: 'EducationEvent',
  'club-lectura': 'EducationEvent',
  presentacion: 'LiteraryEvent',
  charla: 'LiteraryEvent',
  encuentro: 'LiteraryEvent',
};

const MODO_ASISTENCIA: Record<Modalidad, string> = {
  presencial: 'https://schema.org/OfflineEventAttendanceMode',
  virtual: 'https://schema.org/OnlineEventAttendanceMode',
  hibrido: 'https://schema.org/MixedEventAttendanceMode',
};

const PROGRAMADO = 'https://schema.org/EventScheduled';
const CANCELADO = 'https://schema.org/EventCancelled';

/**
 * Los `location`: un `Place` por sede y un `VirtualLocation` por plataforma.
 *
 * **`VirtualLocation` sale sin `url`, y es una carencia consciente.** Google pide
 * ahí la URL donde se consigue el acceso, que según el §5.4 del diseño tiene que
 * ser **la canónica de la actividad** —nunca `online.url`, ni con `urlPublica`—.
 * La canónica es absoluta y hoy no existe: `site` de `astro.config.mjs` depende
 * del dominio, que es **B-109**. Emitir una URL relativa ahí sería inválido y
 * emitir el link de la reunión está prohibido, así que se emite el lugar sin URL
 * y se completa con B-109 (anotado como **B-237**).
 */
const lugaresDe = (d: DetallePublico): Record<string, unknown>[] =>
  d.modalidades.flatMap((m) => {
    const salida: Record<string, unknown>[] = [];
    if (m.sede) {
      salida.push({
        '@type': 'Place',
        name: m.sede.nombre,
        address: {
          '@type': 'PostalAddress',
          streetAddress: m.sede.direccion,
          addressLocality: m.sede.ciudad,
          addressCountry: 'AR',
        },
      });
    }
    if (m.plataforma) salida.push({ '@type': 'VirtualLocation', name: m.plataforma });
    return salida;
  });

/**
 * El JSON-LD de la página, o `null` si no se puede emitir uno honesto.
 *
 * Las reglas del §5.3 del diseño, todas verificables y todas con su test:
 *
 * 1. **Las fechas llevan el offset de Buenos Aires** (`isoConOffset`), no `Z`. Un
 *    `19:00` publicado como `22:00Z` está bien, pero un consumidor que lo muestre
 *    sin convertir dice «22:00» y la gente llega tarde (trampa 1).
 * 2. **Un ciclo es un `EventSeries` con `subEvent`**, no N eventos sueltos: la
 *    traducción literal del §2.2. N eventos sueltos le dirían a Google que hay
 *    ocho actividades distintas compitiendo entre sí.
 * 3. **Una sesión cancelada conserva su fecha** con `eventStatus:
 *    EventCancelled`. Google pide el `startDate` original: sin él no puede
 *    tacharlo en el resultado.
 * 4. **`offers` solo con precio real.** Con `gratis` se emite `price: "0"`; con
 *    cualquier otro arancel **no se emite precio**, porque `arancel.tipo` es un
 *    slug y no un monto — un `0` en un taller arancelado es un dato falso
 *    publicado en un formato que las máquinas creen. Con la inscripción cerrada
 *    no se emite `offers`.
 * 5. **`performer` solo si hay tallerista.** No se inventa el organizador como
 *    performer.
 * 6. **Nada de `aggregateRating`, `review`, ni `Offer` sin respaldo.** Marcar lo
 *    que la página no muestra es lo que hace que Google desconfíe del sitio
 *    entero.
 *
 * Y el caso del §7.7 que decide devolver `null`: **una actividad presencial sin
 * sede cargada no lleva JSON-LD**. `location` es obligatorio y un `Place`
 * inventado es peor que no tener datos estructurados.
 */
export const datosEstructurados = (d: DetallePublico): Record<string, unknown> | null => {
  const lugares = lugaresDe(d);
  if (lugares.length === 0) return null;

  const conFecha = d.encuentros.filter((e) => e.inicioIso);
  const vivos = conFecha.filter((e) => !e.cancelada);
  // Sin un solo encuentro en pie no hay evento que anunciar: emitir la serie
  // entera cancelada sería marcar como agenda algo que no va a pasar.
  if (vivos.length === 0) return null;

  const subtipo = TIPO_SCHEMA[d.tipo] ?? 'Event';
  const modalidades = d.modalidades.map((m) => m.modalidad);
  const modo =
    modalidades.length === 0
      ? MODO_ASISTENCIA.presencial
      : modalidades.every((m) => m === modalidades[0])
        ? MODO_ASISTENCIA[modalidades[0]!]
        : MODO_ASISTENCIA.hibrido;

  const comun = {
    '@context': 'https://schema.org',
    name: d.titulo,
    description: d.resumen,
    eventAttendanceMode: modo,
    eventStatus: PROGRAMADO,
    location: lugares.length === 1 ? lugares[0] : lugares,
    organizer: {
      '@type': 'Organization',
      name: d.organizador.nombre,
      /*
       * **`webUrl` y no `web`**, o sea el saneado y no el crudo. Lo encontró el
       * `auditor-privacidad`: el HTML ya caía a texto plano cuando la web no era
       * una URL válida, pero acá se publicaba tal cual — y `schema.ts` valida
       * `organizador.web` como texto opcional, no como URL, así que es texto
       * libre de verdad. Un `javascript:…` o un «Casa Brandon / IG @…» salían al
       * `<script type="application/ld+json">`, que es lo primero que cosecha un
       * bot y lo lee una máquina que puede convertirlo en link.
       *
       * Es la regla 2 del docblock de este archivo aplicada a la superficie que
       * se había olvidado: **ningún `href` sin `urlSegura`, y el JSON-LD también
       * es un href.**
       */
      ...(d.organizador.webUrl ? { url: d.organizador.webUrl } : {}),
    },
    ...(d.tallerista ? { performer: { '@type': 'Person', name: d.tallerista.nombre } } : {}),
    ...(d.imagenes[0] ? { image: d.imagenes[0].url } : {}),
    ...(d.arancel.esGratis && !d.inscripcion.cerrada
      ? {
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'ARS',
            availability: 'https://schema.org/InStock',
            category: d.arancel.etiqueta,
          },
        }
      : !d.inscripcion.cerrada
        ? {
            offers: {
              '@type': 'Offer',
              availability: 'https://schema.org/InStock',
              category: d.arancel.etiqueta,
            },
          }
        : {}),
  };

  /*
   * Una sola sesión no es una serie: `EventSeries` con un solo `subEvent` es
   * ruido para el consumidor.
   *
   * La cuenta es sobre **todos** los encuentros con fecha y no sobre los que
   * quedan en pie, y ahí hay un caso que se pierde fácil: un ciclo de dos con uno
   * cancelado tiene un solo encuentro vivo, pero el cancelado también tiene que
   * salir —con su fecha original y marcado— porque es lo que Google necesita
   * para tacharlo (regla 3). Contando los vivos, ese subevento desaparecía.
   */
  if (conFecha.length === 1) {
    return {
      ...comun,
      '@type': subtipo,
      startDate: vivos[0]!.inicioIso,
      endDate: vivos[0]!.finIso,
    };
  }

  return {
    ...comun,
    '@type': 'EventSeries',
    // La serie arranca en la fecha original, aunque ya haya empezado: no se
    // reescribe la historia para que parezca que empieza ahora (§7.2).
    startDate: vivos[0]!.inicioIso,
    endDate: vivos[vivos.length - 1]!.finIso,
    subEvent: conFecha
      .map((e) => ({
        '@type': subtipo,
        name: e.tema ? `${d.titulo} — ${e.tema}` : d.titulo,
        startDate: e.inicioIso,
        endDate: e.finIso,
        eventStatus: e.cancelada ? CANCELADO : PROGRAMADO,
      })),
  };
};
