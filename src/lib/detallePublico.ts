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
import { NOMBRE, colorDeTipo } from '@/lib/identidad';
import { resumenDe } from '@/lib/eventsJson';
import {
  claveDeMes,
  fechaCompleta,
  fechaLarga,
  hora,
  isoConOffset,
  partesDeFecha,
  rangoCorto,
} from '@/lib/fechasPublicas';
import { etiquetaDe, type MapaDeEtiquetas, type TonosDeTipo } from '@/lib/listadoPublico';
import { SLUG_PLATAFORMA_A_CONFIRMAR } from '@/lib/modalidades';
import { urlDeDetalle } from '@/lib/rutasPublicas';
import { instanteDeIso } from '@/lib/sesiones';
import type { ActividadPublica, ImagenPublica, ItemMaterialPublico } from '@/lib/toPublic';
import type { Modalidad, ViaInscripcion } from '@/types/actividad';
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
  /**
   * Las tres piezas del **bloque de fecha** —día de la semana, número y mes— para
   * el rectángulo de tinta plena con el texto calado que abre cada encuentro
   * (B-260, D-146).
   *
   * Viaja armado y no se deriva en la plantilla por lo mismo que todo lo demás de
   * este view-model: un `.astro` no se puede importar desde vitest, así que un
   * `fecha.split(' ')` en el markup sería una derivación de la fecha **sin ningún
   * test que pudiera evaluarla** — y encima una segunda, porque la fila del
   * listado ya tiene la suya (`bloqueDeFecha`). Las dos salen de `partesDeFecha`,
   * que es la única que sabe formatear en la zona del proyecto (trampa 1).
   */
  bloque: { dia: string; diaSemana: string; mes: string };
  tema: string | null;
  lectura: string | null;
  cancelada: boolean;
  /** Ya terminó, según el reloj del build. */
  paso: boolean;
  /**
   * Es **el próximo**: el primero que no está cancelado ni pasó.
   *
   * Derivado, no un dato nuevo: la página lo necesita para marcar una fila de las
   * ocho, y la alternativa era que la plantilla lo recalculara con un
   * `findIndex` — dos derivaciones de la misma idea, que es justo lo que este
   * repo evita. En un ciclo empezado es la única fila que importa de la lista.
   */
  esProximo: boolean;
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
  /**
   * B-190 — la plataforma es «a confirmar»: todavía no se decidió por dónde es
   * el encuentro. No alcanza con mirar el label (`plataforma === 'A confirmar'`):
   * el label se puede renombrar sin que el slug cambie, y esta señal tiene que
   * sobrevivir a eso. La usan `dondeCorto` y el JSON-LD para no publicar una
   * plataforma inventada — la entrada la agrega el panel (`opciones-base.json`).
   */
  plataformaAConfirmar: boolean;
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
  /**
   * La vía, **para la analítica del sitio** (B-375) — nunca para el markup ni
   * para el `href`, que ya está armado. La plantilla la vuelca en un
   * `data-via` del botón: el clic manda esto y nunca el `destino` real (un
   * mail o un teléfono), que es exactamente la regla del §5.4 del diseño
   * («la vía, y no el destino»).
   */
  via: ViaInscripcion;
}

/**
 * El motivo por el que la página arranca con un aviso, si arranca con uno.
 *
 * Es un vocabulario cerrado y no un texto suelto para que la plantilla pueda
 * elegir la forma —el rojo del cancelado no es el gris del que ya pasó— sin
 * volver a decidir el fondo.
 */
export type TonoDeAviso = 'cancelado' | 'pasado' | 'cerrado' | 'completo';

export interface AvisoDeEstado {
  tono: TonoDeAviso;
  texto: string;
}

export interface DetallePublico {
  /**
   * **La actividad entera está cancelada** — B-110, §7.3 del diseño.
   *
   * No sale de `ActividadPublica`: `estado` no se proyecta, y no tiene por qué
   * hacerlo. Lo decide el **lector** (`contenidoDelSitio.ts`), que es el único
   * que ve el documento crudo y el único que sabe de cuál de sus dos queries
   * salió cada actividad — y lo pasa como argumento. Así `toPublic` no gana un
   * campo nuevo y el `events.json` no puede publicar un estado por accidente.
   *
   * Es distinto de que **todos los encuentros** estén cancelados (B-254), que es
   * un dato de las sesiones y ya estaba. Los dos terminan en la misma franja, con
   * textos distintos: «se cancelaron todos los encuentros» deja abierta la idea
   * de que la actividad existe y se reprograma; «esta actividad se canceló» no.
   *
   * Lo que este booleano cambia, y nada más: el texto de la franja, que no haya
   * CTA de inscripción, y `eventStatus: EventCancelled` en el JSON-LD. **Las
   * fechas quedan intactas** — quien mira necesita ver *qué* fecha se cayó, y
   * Google necesita el `startDate` original para poder tachar el resultado.
   */
  cancelada: boolean;
  slug: string;
  titulo: string;
  tipo: string;
  tipoEtiqueta: string;
  /**
   * El color de la categoría, **ya resuelto** — B-273 (D-153).
   *
   * Viene resuelto y no como matiz suelto porque la plantilla no puede
   * resolverlo: la derivación es `colorDeTipo(slug, elegido)` y el «elegido» vive
   * en `/opciones/tipo`, que la página de detalle no ve (D-140). Con el color
   * hecho, la cabecera del detalle y la cajita de cada fila del listado salen de
   * **la misma** función, que es lo que B-273 vino a arreglar: hasta acá el
   * detalle pintaba `bg-azul` fijo y la cajita saltaba de color al navegar.
   *
   * No publica nada nuevo: es una función del `tipo` —que ya sale en esta misma
   * página— y del matiz, que ya viaja en el `events.json` (`OpcionPublica.tono`).
   */
  tipoColor: string;
  descripcion: string;
  resumen: string;

  imagenes: { url: string; epigrafe: string; ancho: number | null; alto: number | null }[];

  esCiclo: boolean;
  /** `Ciclo de 8 encuentros`, o `null` si no hay nada que decir. */
  rotuloCiclo: string | null;
  encuentros: EncuentroDeDetalle[];
  /**
   * La próxima fecha, o `null` si ya pasó todo.
   *
   * `fecha`, `desde` y `hasta` son las palabras que se pintan; `iso` es la misma
   * fecha ordenable — **B-265**, y va acá y no se recalcula afuera porque la
   * cartelera se ordena por «cuándo es la próxima» y esa pregunta ya la contestó
   * este módulo. Derivarla de nuevo del array de encuentros sería la clase de
   * B-88: dos respuestas a la misma pregunta que se separan cuando cambie la
   * regla de qué encuentro cuenta (los cancelados no, por ejemplo).
   *
   * No agrega nada público: `inicioIso` de cada encuentro ya sale en la página y
   * en el JSON-LD.
   */
  proxima: { fecha: string; desde: string; hasta: string; iso: string } | null;
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
    /**
     * ¿Se emite el botón? — B-253.
     *
     * Es la misma clase de decisión que `aviso` y por eso vive en el mismo lugar:
     * son **tres condiciones** —hay a dónde ir, la actividad no pasó, la
     * inscripción no cerró— y la plantilla las encadenaba con `&&` en una `const`
     * suya. Con un solo consumidor eso pasaba; con dos —el botón del flujo y la
     * barra fija de móvil— es una regla de una salida pública duplicada por
     * referencia y que vitest no puede evaluar, porque un `.astro` no se importa.
     *
     * **El CTA se decide por fecha y no por `cierra`** (§7.1): una actividad sin
     * fecha de cierre queda abierta para siempre y mostraría «Anotate» en un taller
     * de hace un año. Lo señaló el `auditor-privacidad`.
     */
    mostrarAccion: boolean;
    /**
     * ¿Se muestra el canal («Para anotarte: …») cuando no hay botón? — B-110.
     *
     * Es la **otra mitad** de `mostrarAccion`, y estaba escrita en la plantilla
     * como `requiere && !accion`, que es la clase de regla que B-253 ya sacó de
     * ahí: un `.astro` no se importa desde vitest, así que un `&&` en el markup
     * es una decisión de una salida pública que nada puede evaluar.
     *
     * Lo que la trajo acá es la actividad cancelada: sin este campo, la página
     * decía «se canceló» arriba y «Para anotarte: taller@…» en la ficha.
     */
    mostrarCanal: boolean;
    /**
     * La fila «Inscripción» de la ficha, ya resuelta — B-110. Ver
     * `resumenDeInscripcion`.
     */
    resumen: string;
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

  /**
   * **Lo primero que la página dice, o `null` si no hay nada que avisar** — B-253.
   *
   * ── Por qué se decide acá y no en la plantilla ────────────────────────
   * Porque es una **prioridad**, no un formato: cuatro estados pueden valer a la
   * vez —se cancelaron todos los encuentros, ya pasó, la inscripción cerró, el
   * cupo está completo— y mostrar los cuatro apilados es la forma de que no se
   * lea ninguno. La plantilla que los encadene con `&&` toma esa decisión sin
   * quererlo y la toma distinto la próxima vez que alguien la edite.
   *
   * El orden es del más irreversible al menos: **no va a pasar** → **ya pasó** →
   * **no te podés anotar** → **no hay lugar, pero hay lista de espera**.
   *
   * ── Y el caso que estaba mal (B-254) ──────────────────────────────────
   * Una actividad con **todos** sus encuentros cancelados no tiene ninguno por
   * venir, así que `yaPaso` da `true` y la página decía «Esta actividad ya pasó».
   * Es falso y de la peor manera: quien pregunta «¿se hace?» se va creyendo que
   * llegó tarde a algo que no se hizo, y encima la fecha que está más abajo puede
   * ser del mes que viene. Se distingue con `encuentros.length > 0 &&
   * vivos.length === 0`, que es un dato que ya estaba en la mano.
   *
   * El **estado `cancelado` de la actividad entera** (§7.3 del diseño) es otra
   * cosa y todavía no llega: el lector solo trae `estado == 'publicado'`, así que
   * una actividad cancelada no tiene página. Eso es **B-110**, abierto desde antes
   * de este cambio — y hasta que se cierre, `ayudaDelSitio.ts` le promete a quien
   * lee el sitio algo que todavía no pasa («si se cancela la actividad entera, la
   * página no desaparece»).
   */
  aviso: AvisoDeEstado | null;

  /**
   * **«Más en septiembre»: la página de mes a la que esta actividad pertenece**,
   * o `null` si no hay ninguna que enlazar — B-331, cierra B-280.
   *
   * ── Por qué es una decisión y no una derivación de la fecha ───────────────
   * Porque la página de mes **puede no existir**. El §2.2 la genera solo para los
   * meses vigentes con 3 o más actividades, así que derivarla acá de
   * `proxima.iso` produciría un enlace a un 404 en cuanto el mes tenga dos. Y un
   * 404 desde una página que recibe tráfico de Google es peor que no tener el
   * enlace: `mesesEnlazables` (`lib/mesPublico.ts`) es quien sabe si esa página
   * existe, y no lo puede saber esta actividad sola — depende de **las otras**.
   *
   * Por eso llega como argumento, igual que `cancelada`: lo decide quien tiene el
   * índice entero a la vista, que es el lector (`contenidoDelSitio.ts`).
   *
   * ── Cuál mes, cuando hay dos ─────────────────────────────────────────────
   * El de la **próxima** fecha en pie. Un ciclo del 3 de septiembre al 22 de
   * octubre cae en las dos páginas de mes (§7.5) y mirado en septiembre enlaza
   * septiembre: es «qué más hay cuando voy a esto», no un índice de los meses que
   * el ciclo cruza. Sin ninguna fecha por venir no enlaza nada — el mes ya pasó,
   * su página no es enlazable, y la salida de una pasada es `/pasadas`.
   *
   * **No publica nada nuevo**: la clave del mes es una función de `inicioIso`, que
   * ya sale en esta página y en su JSON-LD, y el nombre del mes lo escribe
   * `nombreDeMes`.
   */
  mes: { clave: string; nombre: string } | null;

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
      via: 'mail',
    };
  }
  if (via === 'whatsapp') {
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length < 8) return null;
    return {
      texto,
      href: `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`,
      via: 'whatsapp',
    };
  }
  if (via === 'dm') {
    const handle = handleInstagram(valor);
    return handle ? { texto, href: `https://instagram.com/${handle}`, via: 'dm' } : null;
  }
  // Llegar hasta acá con `texto` no nulo implica `via === 'formulario'`: es la
  // cuarta y última clave de `ETIQUETA_VIA`, y las otras tres ya volvieron
  // arriba. Mismo supuesto que ya tenía este `if`, solo que ahora hace falta
  // nombrarlo para poder devolver la vía.
  const url = urlSegura(valor);
  return url ? { texto, href: url, via: 'formulario' } : null;
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
  // B-190 — se mira el slug, no el label: ver el docblock de la interfaz.
  plataformaAConfirmar: m.online?.plataforma === SLUG_PLATAFORMA_A_CONFIRMAR,
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
          ? // B-190 — «Online por A confirmar» se lee como si «A confirmar»
            // fuera el nombre de una plataforma. Con el slug a la vista en vez
            // del label, el mismo texto sirve para publicar lo que se sabe de
            // verdad: que la plataforma todavía no está decidida.
            m.plataformaAConfirmar
            ? 'Online, plataforma a confirmar'
            : `Online por ${m.plataforma}`
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
 * La fila «Inscripción» de la ficha técnica, resuelta acá y no en el markup.
 *
 * Eran cuatro ramas encadenadas en la plantilla, y B-110 le agregó la quinta —la
 * actividad cancelada— que es la que muestra por qué no podían vivir ahí: con la
 * franja «Esta actividad se canceló» arriba, la ficha decía «Abierta hasta el 22
 * de septiembre». Son dos afirmaciones contradictorias en la misma pantalla, y la
 * que sobra no se puede sacar desde un `.astro` porque nada la evalúa.
 *
 * El orden es el mismo criterio que `avisoDeEstado`: del hecho más irreversible
 * al más chico.
 */
const resumenDeInscripcion = (
  cancelada: boolean,
  canal: { requiere: boolean; cerrada: boolean; cierra: string | null },
): string => {
  if (cancelada) return 'La actividad se canceló';
  if (!canal.requiere) return 'No hace falta anotarse';
  if (canal.cerrada) return canal.cierra ? `Cerró el ${canal.cierra}` : 'Cerró';
  return canal.cierra ? `Abierta hasta el ${canal.cierra}` : 'Abierta';
};

/**
 * El aviso de arriba, o `null`. Ver el docblock de `DetallePublico.aviso`.
 *
 * Es una función aparte y devuelve **uno** a propósito: la prioridad es la
 * decisión, y una función que devuelve una lista invita a que la plantilla elija
 * cuál mostrar, que es la decisión que se quería sacar de ahí.
 */
const avisoDeEstado = (
  cancelada: boolean,
  todoCancelado: boolean,
  yaPaso: boolean,
  hayEncuentros: boolean,
  inscripcion: { requiere: boolean; cerrada: boolean; cierra: string | null; completo: boolean },
): AvisoDeEstado | null => {
  /*
   * **B-110 — la actividad entera cancelada va primero de todo**, arriba incluso
   * del caso de B-254.
   *
   * Va primero porque una actividad cancelada puede además tener todos sus
   * encuentros cancelados, haber pasado, tener la inscripción cerrada y el cupo
   * completo: los cinco valen a la vez y solo uno se muestra. Y es el único que
   * contesta la pregunta con la que se entra a esta página desde un link de hace
   * tres semanas — ¿se hace o no se hace?
   */
  if (cancelada) {
    return {
      tono: 'cancelado',
      texto: 'Esta actividad se canceló. La página queda publicada para que se sepa.',
    };
  }
  if (todoCancelado) {
    return {
      tono: 'cancelado',
      texto: 'Se cancelaron todos los encuentros de esta actividad.',
    };
  }
  /*
   * `hayEncuentros` no es defensivo: una actividad publicada **sin ninguna
   * fecha** también deja `yaPaso` en `true`, y ahí «ya pasó» es tan falso como en
   * el caso cancelado. Sin encuentros no se afirma nada — la ficha ya dice «Sin
   * fechas por venir», que es lo único que se sabe.
   */
  if (yaPaso && hayEncuentros) {
    return {
      tono: 'pasado',
      texto: 'Esta actividad ya pasó. Muchas se repiten: seguí a quien la organiza.',
    };
  }
  if (inscripcion.requiere && inscripcion.cerrada) {
    return {
      tono: 'cerrado',
      texto: inscripcion.cierra
        ? `Las inscripciones cerraron el ${inscripcion.cierra}.`
        : 'Las inscripciones cerraron.',
    };
  }
  // D-127 — el cupo completo avisa, pero **no** cierra la puerta: el canal sigue
  // más abajo porque siempre hay lista de espera y las bajas existen.
  if (inscripcion.requiere && inscripcion.completo) {
    return {
      tono: 'completo',
      texto: 'Cupo completo. Se puede consultar por lista de espera.',
    };
  }
  return null;
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
/**
 * Las imágenes de la página, **con la portada primero** — B-268.
 *
 * ── El bug que esto arregla ───────────────────────────────────────────────
 * Este mapeo tiraba el flag `portada` y dejaba el array en el orden en que se
 * cargaron las filas, y los dos consumidores toman `imagenes[0]`: la cabecera de
 * la página y la pared de `/cartelera`. Entonces quien cargaba una foto, después
 * el flyer, y marcaba el flyer como portada con el radio del panel —que es
 * exactamente para eso— seguía viendo la primera en las dos pantallas.
 *
 * No fallaba nada, y encima fallaba **coherente**: las dos páginas mostraban la
 * misma imagen equivocada, así que ni siquiera se notaba comparándolas. Lo
 * encontró el `auditor-trampas` cuando B-265 propagó el mismo `imagenes[0]` a una
 * salida nueva.
 *
 * ── Por qué se ordena acá y no en la plantilla ────────────────────────────
 * Porque «cuál es la portada» es una decisión del dominio y ya tiene una sola
 * respuesta escrita: `portadaDe` (`lib/imagenes.ts`), que es la que usan el panel
 * y la vista previa. Reordenar acá hace que **todo** consumidor del view-model
 * herede la respuesta correcta sin acordarse: la pared, la cabecera y el
 * `og:image` del día que exista. Filtrar en vez de ordenar sería peor — la
 * galería del detalle muestra el resto, y perderlas sería un cambio de producto
 * que nadie pidió.
 *
 * `conPortada` en el panel togglea el booleano y **no mueve la fila**, y eso está
 * bien: el orden del array es el orden en que se cargaron y es lo que la galería
 * respeta. Lo que no puede pasar es que ese orden decida cuál es la portada.
 */
const imagenesDeDetalle = (
  imagenes: readonly ImagenPublica[],
): { url: string; epigrafe: string; ancho: number | null; alto: number | null }[] => {
  const saneadas = imagenes
    .map((i) => ({
      // Una imagen con URL inválida se descarta abajo; acá se sanea igual.
      url: urlSegura(i.url) ?? '',
      epigrafe: i.epigrafe,
      ancho: i.ancho ?? null,
      alto: i.alto ?? null,
      portada: i.portada,
    }))
    .filter((i) => i.url !== '');

  /*
   * El índice de la portada **se busca después de filtrar**: si la marcada tiene
   * una URL que `urlSegura` rechaza, la portada pasa a ser la primera que sí
   * sirve, que es lo mismo que hace `portadaDe` con una lista sin ninguna
   * marcada. Buscarlo antes dejaría la página sin imagen habiendo otras válidas.
   */
  const n = saneadas.findIndex((i) => i.portada);
  const ordenadas = n > 0 ? [saneadas[n]!, ...saneadas.filter((_, i) => i !== n)] : saneadas;
  return ordenadas.map(({ portada: _portada, ...resto }) => resto);
};

/**
 * El mes que esta página puede enlazar, o `null` — B-331, cierra B-280.
 *
 * Dos condiciones, y las dos tienen que valer:
 *
 * 1. **hay una próxima fecha en pie.** Sin ella el mes ya pasó, y la página de un
 *    mes vencido no es enlazable (se emite con `noindex` solo para que su URL no
 *    devuelva 404, §2.2). La salida de una pasada es `/pasadas`, que el pie ya da.
 * 2. **ese mes tiene página**, o sea que pasó el corte de tres del §2.2. Es lo que
 *    `mesesConPagina` contesta, y por eso viene de afuera: depende de las otras
 *    actividades, no de ésta.
 *
 * El nombre sale del mapa y no de `nombreDeMes` acá: el que lo armó es
 * `mesesEnlazables`, y con dos derivaciones el enlace podría decir «Septiembre» y
 * la página «septiembre de 2026». Es la clase de B-88 en su versión más chica.
 */
const mesEnlazable = (
  siguiente: EncuentroDeDetalle | null,
  mesesConPagina: Readonly<Record<string, string>>,
): { clave: string; nombre: string } | null => {
  const inicio = instanteDeIso(siguiente?.inicioIso ?? null);
  if (!inicio) return null;
  const clave = claveDeMes(inicio);
  const nombre = mesesConPagina[clave];
  return nombre ? { clave, nombre } : null;
};

/**
 * El view-model de la página de detalle.
 *
 * `tonos` es el mismo mapa con el que el listado pinta su cajita —los matices
 * elegidos que viajan en el `events.json`—, y tiene que ser el mismo: es la
 * condición de que las dos pantallas muestren un color y no dos (B-273, D-153).
 * Es un parámetro obligatorio y no uno con default por eso mismo: un default
 * `{}` dejaría al detalle derivando del slug mientras el listado usa lo elegido,
 * o sea el bug de vuelta, en silencio y solo para los tipos pintados a mano.
 */
export const detalleDeActividad = (
  a: ActividadPublica,
  etiquetas: MapaDeEtiquetas,
  ahora: Date,
  /**
   * Los matices de cada tipo, ya resueltos — B-273.
   *
   * **Es obligatorio y no tiene default.** Un `{}` de cortesía habría reproducido
   * en silencio el bug que este parámetro vino a cerrar —la cajita del detalle
   * pintada de un color distinto que la del listado— y solo para los tipos con
   * matiz elegido a mano, que es el subconjunto que menos se prueba.
   */
  tonos: TonosDeTipo,
  /**
   * **La actividad está en `estado: 'cancelado'`** — B-110.
   *
   * Llega como argumento y no adentro de `a` porque `estado` **no se proyecta**:
   * `toPublic` no lo emite y no tiene por qué hacerlo. El único que lo sabe es el
   * lector, que ve el documento crudo y sabe de cuál de sus dos queries salió
   * cada actividad (`contenidoDelSitio.ts`).
   *
   * El default es `false` a propósito: la respuesta segura para quien lo omita es
   * «no está cancelada», que es lo que la página venía haciendo.
   */
  cancelada = false,
  /**
   * **Las páginas de mes que existen y se pueden enlazar**, como `{ clave: nombre }`
   * — B-331, cierra B-280. Ver `DetallePublico.mes`.
   *
   * Llega como argumento por lo mismo que `cancelada`: quién tiene página de mes
   * lo decide `mesesEnlazables` sobre el índice **entero**, y esta actividad sola
   * no puede saberlo — depende de cuántas otras caen en su mes.
   *
   * **El default es `{}`, o sea «no enlazar nada»**, y es el lado correcto del
   * error: quien omita el argumento pierde un enlace interno, no publica un 404
   * desde la página que más tráfico recibe.
   */
  mesesConPagina: Readonly<Record<string, string>> = {},
): DetallePublico => {
  const ordenadas = [...a.sesiones].sort((x, y) => x.inicio.localeCompare(y.inicio));

  const enOrden: EncuentroDeDetalle[] = ordenadas.map((s, i) => {
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
      bloque: inicio ? partesDeFecha(inicio) : { dia: '', diaSemana: '', mes: '' },
      tema: s.tema,
      lectura: s.lectura,
      cancelada: s.cancelada,
      paso: Boolean(fin && fin.getTime() < ahora.getTime()),
      // Se resuelve en la segunda pasada: «el próximo» depende de todos.
      esProximo: false,
    };
  });

  const vivos = enOrden.filter((e) => !e.cancelada);
  const proximos = vivos.filter((e) => !e.paso);
  const siguiente = proximos[0] ?? null;
  // Segunda pasada: marcar el próximo por su id. Comparar por id y no por
  // posición es la misma regla de siempre (§7.2, trampa 2): el índice del array
  // cambia al cancelar una fila y el uuid no.
  const encuentros: EncuentroDeDetalle[] = enOrden.map((e) => ({
    ...e,
    esProximo: e.id === siguiente?.id,
  }));

  const modalidades = a.modalidades.map((m) => modalidadDeDetalle(m, etiquetas));
  const cierra = instanteDeIso(a.inscripcion.cierraEn);

  const tipoEtiqueta = etiquetaDe(etiquetas, 'tipo', a.tipo);
  const donde = dondeCorto(modalidades);

  const canal = {
    requiere: a.inscripcion.requiere,
    destino: a.inscripcion.destino,
    accion: a.inscripcion.requiere
      ? accionDeInscripcion(a.inscripcion.via, a.inscripcion.destino, a.titulo)
      : null,
    cupo: a.inscripcion.cupo,
    completo: a.inscripcion.completo,
    cierra: cierra ? fechaCompleta(cierra) : null,
    cerrada: Boolean(cierra && cierra.getTime() <= ahora.getTime()),
  };

  // §7.3 del diseño con la corrección de B-254: sin ningún encuentro en pie la
  // actividad **no pasó**, se canceló. Los dos casos llegaban a `yaPaso: true`.
  const todoCancelado = encuentros.length > 0 && vivos.length === 0;
  const yaPaso = proximos.length === 0;

  const inscripcion = {
    ...canal,
    // B-110 — una actividad cancelada **no invita a anotarse**, ni con el botón
    // ni con el canal en texto. Es la segunda de las tres cosas que pide el §7.3.
    mostrarAccion: canal.accion !== null && !yaPaso && !canal.cerrada && !cancelada,
    mostrarCanal: canal.requiere && canal.accion === null && !cancelada,
    resumen: resumenDeInscripcion(cancelada, canal),
  };

  return {
    cancelada,
    slug: a.slug,
    titulo: a.titulo,
    tipo: a.tipo,
    tipoEtiqueta,
    tipoColor: colorDeTipo(a.tipo, tonos[a.tipo]),
    descripcion: a.descripcion,
    resumen: resumenDe(a.descripcion),

    imagenes: imagenesDeDetalle(a.imagenes),

    esCiclo: a.esCiclo,
    rotuloCiclo: rotuloDeCiclo(a.esCiclo, vivos),
    encuentros,
    proxima: siguiente
      ? {
          fecha: siguiente.fecha,
          desde: siguiente.hora,
          hasta: horaDeFin(siguiente),
          iso: siguiente.inicioIso,
        }
      : null,
    yaPaso,
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

    inscripcion,

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

    aviso: avisoDeEstado(cancelada, todoCancelado, yaPaso, encuentros.length > 0, inscripcion),

    mes: mesEnlazable(siguiente, mesesConPagina),

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
 * **El `url` del `VirtualLocation` es la canónica de la actividad** — §5.4 del
 * diseño, completado en B-109 (D-165). Google pide ahí la URL donde se consigue
 * el acceso, y esa es **esta página**: nunca `online.url`, ni con
 * `urlPublica: true` (D-139). El JSON-LD es lo primero que cosecha un bot, así
 * que el link de la reunión no llega ahí por ningún camino — la trampa 5.
 *
 * Hasta que el dominio existió el lugar salía sin `url`, porque una URL relativa
 * ahí no es válida y una absoluta inventada es peor que nada.
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
    if (m.plataforma) {
      salida.push({
        '@type': 'VirtualLocation',
        /*
         * B-190 — sin `name` cuando la plataforma todavía no está confirmada:
         * no hay ninguna que nombrar, y `name: "A confirmar"` sería una
         * plataforma inventada en los datos estructurados que indexa Google —
         * justo lo que este bloque existe para evitar con el link de la
         * reunión (ver el docblock de `lugaresDe`). `VirtualLocation` no pide
         * `name`, así que omitirlo no rompe el resultado enriquecido.
         */
        ...(m.plataformaAConfirmar ? {} : { name: m.plataforma }),
        url: urlDeDetalle(d.slug),
      });
    }
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

  /*
   * **De qué encuentros salen las fechas de la serie** — B-110.
   *
   * Con la actividad cancelada se usan **todos** los que tienen fecha y no solo
   * los que están en pie, porque es justo el caso en el que Google necesita el
   * `startDate` original: un `eventStatus: EventCancelled` sin fecha no le dice
   * nada, y con la fecha puede tachar el resultado que ya tiene indexado. Es la
   * regla 3 de este docblock un nivel más arriba — de la sesión cancelada a la
   * actividad cancelada.
   *
   * Sin cancelar, sin un solo encuentro en pie no hay evento que anunciar: emitir
   * la serie entera cancelada sería marcar como agenda algo que no va a pasar.
   * Ése es el caso de B-254 y sigue devolviendo `null`.
   */
  const conFechas = d.cancelada ? conFecha : vivos;
  if (conFechas.length === 0) return null;

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
    /*
     * **La canónica del evento** — B-109 (D-165). Es lo que le dice a Google
     * cuál es la página de esta actividad, y sale de `urlDeDetalle`, la misma
     * función que arma el `href` del listado: el `url` del JSON-LD, el
     * `canonical` del `<head>` y la entrada del sitemap no pueden ser tres URLs
     * distintas de la misma página.
     */
    url: urlDeDetalle(d.slug),
    eventAttendanceMode: modo,
    // B-110 / §7.3 — es exactamente lo que Google pide para dejar de mostrarla
    // como vigente sin que la URL se caiga.
    eventStatus: d.cancelada ? CANCELADO : PROGRAMADO,
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
    /*
     * **Con la actividad cancelada no se emite `offers`** — B-110. Un `Offer` con
     * `availability: InStock` en un evento cancelado marca como conseguible algo
     * que no lo es, que es de las cosas que hacen que Google desconfíe del sitio
     * entero (regla 6). Es la misma puerta que ya cerraba la inscripción cerrada,
     * con un motivo más fuerte.
     */
    ...(d.cancelada
      ? {}
      : d.arancel.esGratis && !d.inscripcion.cerrada
        ? {
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'ARS',
              availability: 'https://schema.org/InStock',
              category: d.arancel.etiqueta,
              // §5.4 — dónde se consigue: **esta página**, nunca el canal de
              // inscripción crudo ni el link de la reunión (B-109, D-165).
              url: urlDeDetalle(d.slug),
            },
          }
        : !d.inscripcion.cerrada
          ? {
              offers: {
                '@type': 'Offer',
                availability: 'https://schema.org/InStock',
                category: d.arancel.etiqueta,
                url: urlDeDetalle(d.slug),
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
      startDate: conFechas[0]!.inicioIso,
      endDate: conFechas[0]!.finIso,
    };
  }

  return {
    ...comun,
    '@type': 'EventSeries',
    // La serie arranca en la fecha original, aunque ya haya empezado: no se
    // reescribe la historia para que parezca que empieza ahora (§7.2).
    startDate: conFechas[0]!.inicioIso,
    endDate: conFechas[conFechas.length - 1]!.finIso,
    subEvent: conFecha
      .map((e) => ({
        '@type': subtipo,
        name: e.tema ? `${d.titulo} — ${e.tema}` : d.titulo,
        startDate: e.inicioIso,
        endDate: e.finIso,
        // Con la actividad cancelada lo están **todos** sus encuentros, aunque
        // ninguna sesión tenga su propio flag: un subevento de una actividad
        // cancelada no puede quedar en `EventScheduled`.
        eventStatus: d.cancelada || e.cancelada ? CANCELADO : PROGRAMADO,
      })),
  };
};
