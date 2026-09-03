/**
 * B-95 — el texto para publicar en redes.
 *
 * `difusion.arrobar` era el único campo del §3.1 que se cargaba y **no se usaba
 * para nada**: se guardaba y ahí moría. Mientras tanto cada actividad se volvía
 * a escribir a mano en Instagram, con la hora y el arancel copiados de mirar el
 * panel en otra pestaña — y con la tallerista sin arrobar, que es el olvido que
 * cuesta.
 *
 * Dos variantes bastan: **`anuncio`** (el ciclo entero, para cuando abre la
 * inscripción) y **`recordatorio`** (el próximo encuentro, con su tema y su
 * lectura, para el día antes).
 *
 * **La forma imita a `construirDescripcion` de `@calendario`** (§7.4): bloques
 * de líneas etiquetadas separados por una línea en blanco, armados con lo que
 * esté cargado y nada más. Texto plano, porque el destino es el cuadro de texto
 * de una red.
 *
 * **Qué NO se reimplementa acá** (D-20, que es la regla que este repo aprendió a
 * la mala): la regla de duplicados de handles sale de `formulario/chips.ts`, el
 * respaldo de slug de `@calendario`, la etiqueta de modalidad de
 * `filtrosActividades.ts` —que ya son dos mapas y el `it.fails` de
 * `tests/etiquetas-de-ui.test.ts` los vigila: un tercero sería el mismo bug otra
 * vez—, la numeración "Encuentro 3 de 8" de `calendarioPanel.ts` (D-95) y el
 * criterio de "¿cuál es el próximo?" de `filtrosActividades.ts`.
 *
 * ── Privacidad (§5.1) ────────────────────────────────────────────────────────
 *
 * **Un posteo es más público que las otras dos salidas.** El `events.json` y el
 * evento de Calendar son scrapeables; un texto pegado en Instagram ya está
 * copiado, y no hay despublicación posible. Así que acá la lista es más corta
 * que la del §5.2, no más larga:
 *
 * | Campo | ¿Entra? | Motivo |
 * |---|---|---|
 * | `online.url` | **NUNCA**, ni con `urlPublica: true` | trampa 5. El desvío de D-15 vale para el `events.json` y para el evento —donde el dueño tildó una casilla que dice qué hace— y **no** se extiende a un posteo: el link de la reunión se manda al inscribirse |
 * | `difusion.notas` | **no** | notas internas, §3.2 |
 * | `difusion.arrobar` | **sí** | es su lugar y su razón de existir: el campo existe para este texto |
 * | `inscripcion.destino` | **sí**, tal cual | es el canal de inscripción y ya sale al `events.json` y al evento (§5.2, D-127). La advertencia del §5.1 sobre el WhatsApp personal la da la ayuda del campo, no este módulo |
 * | `inscripcion.completo` | **sí** | D-127: cambia lo que hay que anunciar, y el canal **no** se esconde al lado del cartel |
 * | `libro` | **sí** | D-126: en una presentación es el dato central, del orden del título |
 * | `imagenes` | **no** | D-125: un texto no lleva imágenes. El epígrafe es de la foto y el `storagePath` no sale nunca |
 * | `material` | **no** | la URL depende de `publico` por ítem y el material se entrega al inscribirse; en una caption es ruido con riesgo |
 * | `sede.indicaciones` | **no** | "timbre 3B" es para quien ya va: al evento sí, al posteo no |
 * | `createdBy` / `updatedBy` | **no** | uids |
 * | `slug` | **sí**, dentro del link y **solo con la actividad publicada** | B-312: es la URL pública, la misma que ya sale al `events.json`, al sitemap y a la canónica. Nunca suelto: lo que se imprime es el link |
 *
 * **El link a la página de la actividad sí va**, desde B-312 — y hasta hace
 * unos días no iba, con un motivo que caducó: la página no existía y el dominio
 * no estaba elegido (DEC-6). Las dos cosas pasaron —el sitio salió con B-227 y
 * el canónico es `agendaleh.ar` desde D-165—, así que el posteo que se copia a
 * Instagram lleva a dónde inscribirse en vez de terminar en un handle.
 *
 * **Pero solo con la actividad publicada**, y el porqué está abajo, en
 * `construirTextoRedes`: en borrador el slug todavía se mueve con el título.
 *
 * **La URL sale de `urlDeDetalle` (`lib/rutasPublicas.ts`)**, que es la misma
 * función de la que salen la canónica, el sitemap y el JSON-LD. Escrita a mano
 * acá sería la cuarta derivación de la misma ruta y **la única de la que no se
 * puede volver**: un posteo con una URL rota ya está pegado en Instagram.
 *
 * **La descripción tampoco va**, y no es un olvido: es la parte que quien
 * publica va a reescribir con su voz igual (el contra del §1 de
 * `docs/11-ideas-de-producto.md`). Lo que se automatiza es el bloque de datos
 * —la hora, la sede, el arancel, los handles—, que es lo aburrido y lo que se
 * equivoca. Si algún día se quiere, es un `bloques.push` más.
 *
 * **El reloj entra como parámetro** (`ahora`), como en `functions/rebuild.js`: el
 * recordatorio depende de cuál es el próximo encuentro, y un test no puede
 * depender de qué día es hoy.
 */
import { desSlug } from '@calendario';
import { formADocumento } from '@/lib/actividades';
import { encuentrosDe, fechaHoraLegible } from '@/lib/calendarioPanel';
import { ETIQUETA_MODALIDAD, proximoEncuentro } from '@/lib/filtrosActividades';
import { SLUG_PLATAFORMA_A_CONFIRMAR } from '@/lib/modalidades';
import { agregarChips } from '@/lib/formulario/chips';
import { instanteDeTimestamp } from '@/lib/sesiones';
// B-312 — la URL absoluta del detalle, de la misma función que la canónica y el
// sitemap. `rutasPublicas` es puro y sin dependencias: entra al bundle del panel
// sin arrastrar nada (§5.4).
import { urlDeDetalle } from '@/lib/rutasPublicas';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type {
  Actividad,
  ActividadConId,
  ActividadForm,
  CampoTaxonomia,
  ViaInscripcion,
} from '@/types/actividad';

// ─────────────────────────────────────────────────────────────────
// Variantes
// ─────────────────────────────────────────────────────────────────

export const VARIANTES_REDES = ['anuncio', 'recordatorio'] as const;
export type VarianteRedes = (typeof VARIANTES_REDES)[number];

/** Lo que se lee en el selector de variante. */
export const ETIQUETA_VARIANTE: Record<VarianteRedes, string> = {
  anuncio: 'Anuncio',
  recordatorio: 'Recordatorio',
};

/** Para qué sirve cada una: sin esto el selector son dos palabras sin criterio. */
export const AYUDA_VARIANTE: Record<VarianteRedes, string> = {
  anuncio: 'Todas las fechas del ciclo. Para cuando abre la inscripción.',
  recordatorio: 'Solo el próximo encuentro, con su tema y su lectura. Para el día antes.',
};

/**
 * `ok: false` es un caso normal y no un error: una actividad a la que todavía no
 * se le cargó una fecha, o un ciclo que ya terminó y no tiene próximo encuentro.
 * Es la misma forma que `ResultadoVistaPrevia` (B-12), y por el mismo motivo: el
 * motivo se muestra en pantalla en lugar de un texto vacío o inventado.
 */
export type ResultadoTextoRedes = { ok: true; texto: string } | { ok: false; motivo: string };

/**
 * Los campos que este texto lee. Es un subconjunto declarado a propósito y no
 * `Actividad` entera: la lista de arriba dice qué sale y qué no, y esta interfaz
 * es la que hace que agregar un campo al §3.1 **no** lo meta al posteo por
 * accidente — para que entre, hay que nombrarlo acá.
 */
export type ActividadParaRedes = Pick<
  Actividad,
  | 'tipo'
  | 'titulo'
  // B-312 — el slug entra **solo** para armar el link con `urlDeDetalle`. No se
  // imprime: un slug suelto en un posteo no le dice nada a nadie.
  | 'slug'
  | 'esCiclo'
  | 'sesiones'
  | 'modalidad'
  | 'sede'
  | 'online'
  | 'inscripcion'
  | 'arancel'
  | 'organizador'
  | 'tallerista'
  | 'difusion'
  | 'estado'
> &
  Pick<Partial<Actividad>, 'libro'>;

// ─────────────────────────────────────────────────────────────────
// Piezas
// ─────────────────────────────────────────────────────────────────

/**
 * Slug de taxonomía → etiqueta legible (§4.1). El respaldo para un slug que no
 * está en `/opciones/*` es `desSlug` de `@calendario`, importado y no copiado:
 * si el posteo y el evento des-sluguearan distinto, la misma actividad se leería
 * de dos maneras y nada fallaría (D-20).
 */
const etiqueta = (labels: LabelsTaxonomia, campo: CampoTaxonomia, slug: string): string =>
  slug ? (labels[campo]?.[slug] ?? desSlug(slug)) : '';

/**
 * Cómo se dice cada canal de inscripción **en una red**.
 *
 * Es un mapa propio y no el de `construirDescripcion`, por el mismo motivo por
 * el que ese archivo no exporta `ETIQUETA_ENTREGA`: acá es prosa de caption y
 * allá es una línea de un evento de calendario. `dm` es la diferencia que lo
 * justifica — "por DM al Instagram" en el calendario, donde hay que decir de qué
 * DM se habla, y "por DM" en Instagram, donde decirlo sobra.
 */
const ETIQUETA_VIA: Record<ViaInscripcion, string> = {
  mail: 'por mail',
  whatsapp: 'por WhatsApp',
  dm: 'por DM',
  formulario: 'por formulario',
};

/**
 * Le pone el `@` a un handle pelado y deja intacto todo lo demás.
 *
 * El pedido es que los handles salgan con `@`, y `chips.ts` decide a propósito
 * **no** normalizar el valor guardado ("forzar el arroba rompería los handles
 * que no son de Instagram, y quitarlo perdería información"). Las dos cosas
 * conviven porque acá no se guarda nada: se decora la salida, y solo cuando lo
 * que hay parece un handle —una sola palabra de letras, números, punto o guion
 * bajo—. Un mail, una URL o un nombre con espacios salen como se escribieron, y
 * uno que ya trae `@` no lo duplica.
 */
const conArroba = (handle: string): string =>
  /^[A-Za-z0-9._-]+$/.test(handle) ? `@${handle}` : handle;

/**
 * Los handles del pie: `difusion.arrobar`, después `organizador.instagram` y
 * `tallerista.instagram`, **deduplicados** y en ese orden.
 *
 * **La regla de duplicados no se reimplementa:** la aplica `agregarChips` de
 * `formulario/chips.ts`, que ya sabe que `@CasaBrandon`, `casabrandon` y
 * `@casabrandon` son la misma cuenta (B-133) y que conserva la forma con la que
 * se escribió la primera. Es la misma función con la que se cargó la lista, así
 * que el pie del posteo no puede tener una idea distinta de "ya está" que el
 * campo del formulario. El caso real es el organizador que además está en
 * «arrobar», escrito con otras mayúsculas.
 */
const handlesDe = (actividad: ActividadParaRedes): string[] => {
  const candidatos = [
    ...(actividad.difusion?.arrobar ?? []),
    actividad.organizador?.instagram ?? '',
    actividad.tallerista?.instagram ?? '',
  ]
    .map((h) => h.trim())
    .filter(Boolean);

  // `agregarChips` recibe el texto crudo y corta por sus separadores, así que se
  // le pasa uno por línea: si alguien dejó dos handles en un mismo campo,
  // separados por coma, salen como dos y no como uno raro.
  return agregarChips([], candidatos.join('\n')).map(conArroba);
};

/**
 * Dónde es. Primera línea la modalidad, con la etiqueta compartida del panel;
 * después la sede y/o la plataforma.
 *
 * **El link de la reunión no sale nunca** (§5.1, trampa 5), ni con
 * `online.urlPublica` en `true`: en su lugar va la misma promesa que hace el
 * evento —se envía a quienes se inscriban—, que es la que evita el DM
 * preguntando por el link.
 *
 * La dirección se arma acá y no con `construirUbicacion`: esa existe para que
 * Google geolocalice el evento, y por eso termina en ", Argentina" y repite la
 * ciudad. En una caption eso es ruido.
 */
const bloqueDonde = (actividad: ActividadParaRedes, labels: LabelsTaxonomia): string => {
  const lineas = [ETIQUETA_MODALIDAD[actividad.modalidad] ?? actividad.modalidad];

  const sede = actividad.sede;
  if (sede) {
    const partes = [sede.direccion, etiqueta(labels, 'barrio', sede.barrio), sede.ciudad]
      .map((p) => (p ?? '').trim())
      .filter(Boolean);
    // Barrio y ciudad se cargan repetidos seguido ("Palermo" en los dos campos),
    // igual que en `construirUbicacion`.
    const unicas = partes.filter(
      (p, i) => partes.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i,
    );
    const linea = [sede.nombre?.trim(), unicas.join(', ')].filter(Boolean).join(' · ');
    if (linea) lineas.push(linea);
  }

  const online = actividad.online;
  if (online) {
    // B-190 — «Por A confirmar» se lee como si «A confirmar» fuera el nombre
    // de una plataforma. Se mira el slug (no el label, que se puede renombrar
    // sin que esto deje de aplicar) para publicar lo que se sabe de verdad.
    const plataforma =
      online.plataforma === SLUG_PLATAFORMA_A_CONFIRMAR
        ? null
        : etiqueta(labels, 'plataforma', online.plataforma);
    lineas.push(
      `${plataforma ? `Por ${plataforma}` : 'Encuentro virtual'} · el link se envía a quienes se inscriban`,
    );
  }

  return lineas.join('\n');
};

/** Arancel y sus notas, que se publican tal cual (son "2 cuotas", "incluye material"). */
const bloqueArancel = (actividad: ActividadParaRedes, labels: LabelsTaxonomia): string => {
  const lineas: string[] = [];
  const tipo = etiqueta(labels, 'arancel', actividad.arancel?.tipo ?? '');
  if (tipo) lineas.push(`Arancel: ${tipo}`);
  const notas = actividad.arancel?.notas?.trim();
  if (notas) lineas.push(notas);
  return lineas.join('\n');
};

/**
 * Cómo se inscribe. Sigue el criterio de D-127: «se llenó» va **arriba** y el
 * canal queda igual, abajo y con el paréntesis que explica por qué sigue ahí.
 * Esconder el canal convierte una baja en un lugar que se pierde.
 */
const bloqueInscripcion = (actividad: ActividadParaRedes, ahora: Date): string => {
  const insc = actividad.inscripcion;
  if (!insc) return '';
  const completo = insc.completo === true;

  if (!insc.requiere) {
    // Sin inscripción previa también se llena: es un hecho de la sala, no del
    // canal. Acá no hay a quién escribirle, así que la línea va sola y seca.
    return completo ? 'Sin inscripción previa\nCupo completo' : 'Sin inscripción previa';
  }

  const lineas: string[] = [];
  if (completo) {
    lineas.push('Cupo completo (se puede escribir igual: puede liberarse un lugar)');
  }
  const via = insc.via ? ETIQUETA_VIA[insc.via] : '';
  const destino = insc.destino?.trim();
  lineas.push(`Inscripción${via ? ` ${via}` : ''}${destino ? `: ${destino}` : ''}`);
  if (insc.cupo) lineas.push(`Cupo: ${insc.cupo}`);
  /**
   * La fecha de cierre solo sale si **todavía no pasó**, y es el único lugar
   * donde este texto mira el reloj además del recordatorio. Un posteo del 16 que
   * dice "se inscribe hasta el 1" no es un dato viejo: es una instrucción falsa
   * sobre qué hacer ahora. Las fechas de los encuentros sí se listan enteras
   * aunque alguna haya pasado — ahí el ciclo es lo que se anuncia y su historia
   * es parte de lo que se cuenta.
   */
  const cierra = instanteDeTimestamp(insc.cierra);
  if (cierra && cierra.getTime() > ahora.getTime()) {
    lineas.push(`Se inscribe hasta el ${fechaHoraLegible(cierra)}`);
  }
  return lineas.join('\n');
};

/**
 * El libro presentado (D-126). Es público a propósito y del orden del título:
 * en una presentación es el dato central, y un anuncio sin la obra no anuncia
 * nada. El autor sale solo si está cargado, que es solo cuando difiere del
 * invitado.
 */
const bloqueLibro = (actividad: ActividadParaRedes): string => {
  const libro = actividad.libro;
  if (!libro?.titulo?.trim()) return '';
  const autor = libro.autor?.trim();
  return `Libro: ${libro.titulo.trim()}${autor ? ` — ${autor}` : ''}`;
};

/**
 * Las dos o tres primeras líneas: el título, la línea de contexto (tipo, cuántos
 * encuentros o cuál) y quién está al frente.
 *
 * **El nombre de la persona sí entra, y su bio no.** «Charla con tal» o «taller
 * de tal» es el dato que decide si alguien se anota, del mismo orden que el
 * título, y dejarlo solo en el handle lo pierde cuando el handle no está
 * cargado. La bio, en cambio, es un párrafo: al evento de Calendar sí (§7.4),
 * a una caption no. Se dice «Con» y no «Tallerista»/«Invitado» a propósito: es
 * prosa, y evita un cuarto mapa de roles por tipo.
 *
 * El nombre del organizador **no** va: en una red el que publica es él, y su
 * handle está en el pie.
 */
const bloqueEncabezado = (
  actividad: ActividadParaRedes,
  titulo: string,
  contexto: string,
): string => {
  const persona = actividad.tallerista?.nombre?.trim();
  return [titulo, contexto, persona ? `Con ${persona}` : ''].filter(Boolean).join('\n');
};

// ─────────────────────────────────────────────────────────────────
// El texto
// ─────────────────────────────────────────────────────────────────

/**
 * Convierte la actividad al eje de encuentros para reusar la numeración
 * "Encuentro 3 de 8" y el orden cronológico de `calendarioPanel.ts`.
 *
 * `encuentrosDe` pide una `ActividadConId` porque su uso normal es el calendario
 * del panel; acá el id no importa (hay una sola actividad) y se pasa vacío. Lo
 * que se gana es la regla de D-95: se numera **por fecha** y sobre **todas** las
 * sesiones, canceladas incluidas, que es el número que el evento público y la
 * vista calendario ya usan para el mismo encuentro. Numerarlo de nuevo acá haría
 * que el posteo diga "Encuentro 5 de 7" de lo que el calendario llama "6 de 8".
 */
const encuentrosDeLaActividad = (actividad: ActividadParaRedes) =>
  encuentrosDe([{ ...actividad, id: '' } as unknown as ActividadConId]);

export const construirTextoRedes = (
  actividad: ActividadParaRedes,
  variante: VarianteRedes,
  ahora: Date,
  labels: LabelsTaxonomia = {},
  /**
   * ¿La actividad **guardada** está publicada, o sea que su página existe?
   *
   * Es lo que decide si sale el link (B-312), y **no** se deriva de
   * `actividad.estado`: ése es el del formulario en curso. Ver el bloque del
   * link, abajo. Default `false` — el lado barato de equivocarse.
   */
  yaTienePagina = false,
): ResultadoTextoRedes => {
  const encuentros = encuentrosDeLaActividad(actividad);
  const titulo = actividad.titulo?.trim() || 'Sin título';
  const tipo = etiqueta(labels, 'tipo', actividad.tipo);
  const bloques: string[] = [];

  if (variante === 'anuncio') {
    /**
     * Los cancelados no se anuncian: un encuentro cancelado no va a pasar (§7.3
     * le borra el evento del calendario), y listar su fecha en un posteo es
     * mandar gente un día que no hay nada.
     */
    const fechas = encuentros.filter((e) => !e.cancelada);
    if (!fechas.length) {
      return {
        ok: false,
        motivo: 'Cargá al menos un encuentro con su fecha para armar el texto.',
      };
    }

    /**
     * El "N encuentros" cuenta **las fechas que se listan abajo**, no el total de
     * D-95: en un posteo, decir "8 encuentros" arriba de siete fechas es un
     * error de los que se leen. El "Encuentro 3 de 8" del recordatorio sí usa el
     * total de D-95, porque ahí el número es la identidad del encuentro dentro
     * del ciclo —el mismo que dice el evento de Calendar— y no un recuento.
     */
    const esCicloDeVarios = actividad.esCiclo && fechas.length > 1;
    bloques.push(
      bloqueEncabezado(
        actividad,
        titulo,
        [tipo, esCicloDeVarios ? `${fechas.length} encuentros` : ''].filter(Boolean).join(' · '),
      ),
    );

    const libro = bloqueLibro(actividad);
    if (libro) bloques.push(libro);

    bloques.push(['Cuándo:', ...fechas.map((e) => `- ${fechaHoraLegible(e.inicio)}`)].join('\n'));
  } else {
    /**
     * Cuál es "el próximo" no se decide acá: lo decide `proximoEncuentro`, que
     * descarta por el **fin** y no por el inicio —un taller de 19 a 21, a las
     * 19:30, sigue siendo lo próximo— y saltea los cancelados. Es el mismo
     * criterio que el orden del listado y que el "ya pasó" del calendario: si
     * este módulo eligiera por su cuenta, el panel diría que lo próximo es una
     * cosa y el recordatorio hablaría de otra.
     */
    const proximo = proximoEncuentro({ ...actividad, id: '' } as unknown as ActividadConId, ahora);
    const encuentro = proximo
      ? encuentros.find((e) => !e.cancelada && e.inicio.getTime() === proximo.getTime())
      : undefined;
    if (!encuentro) {
      return {
        ok: false,
        motivo:
          'No queda ningún encuentro por venir: el recordatorio se arma con el próximo. Usá «Anuncio».',
      };
    }

    const posicion =
      actividad.esCiclo && encuentro.total > 1
        ? `Encuentro ${encuentro.indice} de ${encuentro.total}`
        : '';
    bloques.push(
      bloqueEncabezado(
        actividad,
        titulo,
        [tipo, posicion, fechaHoraLegible(encuentro.inicio)].filter(Boolean).join(' · '),
      ),
    );

    const libro = bloqueLibro(actividad);
    if (libro) bloques.push(libro);

    // Lo propio de este encuentro, que es la mitad de por qué el recordatorio
    // existe: el tema y la lectura viven en la sesión, no en la actividad.
    const sesion = actividad.sesiones?.find((s) => s.id === encuentro.sesionId);
    const deEsteEncuentro: string[] = [];
    if (sesion?.tema?.trim()) deEsteEncuentro.push(`Tema: ${sesion.tema.trim()}`);
    if (sesion?.lectura?.trim()) deEsteEncuentro.push(`Lectura: ${sesion.lectura.trim()}`);
    if (deEsteEncuentro.length) bloques.push(deEsteEncuentro.join('\n'));
  }

  bloques.push(bloqueDonde(actividad, labels));

  const arancel = bloqueArancel(actividad, labels);
  if (arancel) bloques.push(arancel);

  const inscripcion = bloqueInscripcion(actividad, ahora);
  if (inscripcion) bloques.push(inscripcion);

  /*
   * El link a la página de la actividad — B-312. Va **último antes de los
   * handles**: es la acción, y lo que sigue son las menciones.
   *
   * ── Solo con la actividad publicada, y esto es la mitad del ítem ─────────
   * La primera versión emitía el link siempre, con el argumento de que «la
   * página va a existir cuando el posteo se publique». **El `auditor-privacidad`
   * lo tiró abajo con dos contraejemplos mecánicos del propio repo**, y tenía
   * razón:
   *
   * 1. Mientras `estado !== 'publicado'` el slug **se re-deriva del título con
   *    cada tecla** (`slugBloqueado` en `formulario/cascadas.ts` solo se activa
   *    con la actividad publicada). O sea que en borrador el slug es provisorio
   *    por construcción — y el borrador es justo cuando se copia el posteo.
   * 2. Una actividad duplicada nace en borrador con slug `…-copia`, y el schema
   *    **prohíbe publicar con ese slug** (`esSlugDeCopia`). Para esa clase la URL
   *    emitida está garantizada de no existir jamás.
   *
   * Y un tercero que ese mismo auditor encontró: una actividad con
   * `estado: 'cancelado'` **no** la frena `construirTextoRedes` —lo que ahí se
   * mira es `sesion.cancelada`, que es otra cosa— y por B-110 una cancelada solo
   * tiene página si estuvo publicada alguna vez. Una cancelada que nunca se
   * publicó llevaría a una página que por diseño no va a existir nunca.
   *
   * Los tres se cierran con lo mismo: **el link se emite solo cuando la
   * actividad ya tiene página**, que es cuando su URL es una promesa que el
   * sitio cumple. Es la trampa 10 aplicada a una salida de la que no se puede
   * volver: un posteo con una URL rota ya está pegado en Instagram.
   *
   * ── Y «ya tiene página» NO es `estado === 'publicado'` ───────────────────
   * La primera corrección usaba el `estado` del documento que arma
   * `formADocumento`, y **el auditor volvió a tirarla abajo**: ese `estado` es
   * el del **select del formulario**, sin guardar (`actividades.ts`,
   * `estado: f.estado`). O sea que poner el select en «Publicado» y copiar el
   * posteo antes de guardar emitía el link igual, con el slug todavía
   * moviéndose — el mismo agujero, un paso más adentro. Y con un caso peor: si
   * el guardado vuelve con `slug-tomado` y el admin cambia el slug, el link ya
   * copiado apunta a la página **de otra actividad**.
   *
   * Por eso entra `yaTienePagina` como parámetro explícito y **su default es
   * `false`**: quien llame tiene que afirmar que el documento **guardado** está
   * publicado. Es el mismo predicado con el que `ActividadFormulario` congela el
   * slug (`inicial?.estado === 'publicado'`) y con el que `historial.ts` decide
   * si se puede restaurar — dos precedentes de que el que vale es el del
   * documento y no el del formulario.
   *
   * El default conservador no es pereza: si mañana aparece un llamador nuevo que
   * se olvida del parámetro, lo que pasa es que **no sale el link**, que es el
   * lado barato de equivocarse.
   *
   * El slug vacío se descarta aparte: `urlDeDetalle('')` devolvería la home, y
   * mandar a la home a alguien que quería anotarse a un taller es peor que no
   * poner nada.
   */
  if (yaTienePagina && actividad.slug?.trim()) {
    bloques.push(urlDeDetalle(actividad.slug.trim()));
  }

  const handles = handlesDe(actividad);
  if (handles.length) bloques.push(handles.join(' '));

  // `filter(Boolean)` es la última línea de defensa: cada bloque opcional ya se
  // empuja bajo su `if`, y son dos guardas para lo mismo a propósito — un bloque
  // vacío que se cuele deja dos líneas en blanco en el medio del posteo, que es
  // de las cosas que se ven y no se explican.
  return { ok: true, texto: bloques.filter(Boolean).join('\n\n') };
};

/**
 * La versión que usa el panel: el texto a partir del **formulario**, con las
 * fechas todavía como strings de `datetime-local`.
 *
 * La conversión la hace `formADocumento`, la misma que corre al guardar, así que
 * el texto se arma sobre exactamente el documento que se va a escribir: las
 * cascadas de modalidad (una sede que quedó cargada al pasar a virtual no sale),
 * el tallerista sin nombre que es `null`, el libro sin título que es `null` y el
 * recorte de espacios ya están aplicados. Es el mismo camino que la vista previa
 * del evento (B-12, D-20): si este módulo interpretara el formulario por su
 * cuenta, el posteo hablaría de una actividad distinta de la guardada.
 */
export const textoRedesDeForm = (
  form: ActividadForm,
  variante: VarianteRedes,
  ahora: Date,
  labels: LabelsTaxonomia = {},
  /**
   * ¿La actividad **guardada** está publicada? — B-312.
   *
   * Sale de `inicial?.estado === 'publicado'` en `ActividadFormulario`, que es
   * el mismo booleano con el que ahí se congela el slug. Mientras el panel no lo
   * pase, el default `false` deja el posteo **sin link**, que es exactamente lo
   * que tiene que pasar: el formulario no sabe si la página existe.
   */
  yaTienePagina = false,
): ResultadoTextoRedes => {
  let documento: ActividadParaRedes;
  try {
    documento = formADocumento(form, '', false) as unknown as ActividadParaRedes;
  } catch {
    // `formADocumento` tira si una fecha está a medio cargar, que mientras se
    // carga un encuentro es lo normal y no una excepción (mismo caso que la
    // vista previa del evento).
    return {
      ok: false,
      motivo: 'Completá las fechas de los encuentros para armar el texto.',
    };
  }
  return construirTextoRedes(documento, variante, ahora, labels, yaTienePagina);
};
