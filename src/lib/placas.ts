/**
 * **Las placas para Instagram: una efeméride, o una actividad** — B-2225, B-2226.
 *
 * Son la hermana de la imagen de la semana (`lib/imagenDeLaSemana.ts`, roadmap
 * 4.3): el mismo lienzo en el navegador de quien carga, los mismos dos formatos y
 * el mismo «se baja y se sube a mano». Ese ítem había decidido **una sola
 * plantilla, semanal**, porque el flyer del organizador ya era la imagen de cada
 * actividad; el dueño pidió el 2026-10-21 la placa por actividad igual (D-1278):
 * no todas tienen flyer, y la que lo tiene no siempre dice la fecha ni el lugar.
 *
 * Este módulo es la parte pura: **qué texto lleva cada placa**. El dibujo vive en
 * `components/admin/placa/`, y lo que se mide en píxeles (cuántas líneas entran)
 * lo decide `partirEnLineas` allá, con el canvas.
 *
 * ── Privacidad (§5.1) ──────────────────────────────────────────────────────
 * Una placa es todavía más pública que el texto para redes: es una imagen, se
 * comparte sin el texto, y no se despublica. Así que lleva **menos** que el
 * texto de `lib/textoRedes.ts`, nunca más:
 *
 * | Campo | ¿Entra? | Motivo |
 * |---|---|---|
 * | `online.url` | **nunca** | trampa 5 |
 * | `difusion` (las dos mitades) | **no** | los handles van en el texto, no en la imagen |
 * | `inscripcion.destino` | **no** | un teléfono en una imagen lo lee cualquier bot de OCR (§5.1); la placa dice *por dónde* y el texto, *a qué número* |
 * | `arancel.notas` | **no** | texto libre: puede traer un link de reunión (B-2185) |
 * | `sede.direccion`, `sede.indicaciones` | **no** | la placa dice sede y barrio; la dirección está a un toque, en la página |
 * | `comisiones[].etiqueta`, `titulo`, `tallerista.nombre`, `sede.nombre` | **sí**, sin links de reunión | texto libre que se dibuja. La regla del schema que saca el link de las etiquetas corre solo con la actividad publicada y al guardar, y la placa se arma del formulario en curso, también en borrador (lo encontró el `auditor-privacidad`). Se pasan por `sinLinksDeReunion`, como las notas en el texto para redes |
 * | la portada | **sí**, solo si es **propia** | es la misma de Open Graph. Una externa no se puede dibujar sin CORS y, si se pudiera, sería la imagen de otro |
 */
import { TIMEZONE, desSlug } from '@calendario';
import { admiteMonto, montoLegible } from '@/lib/arancel';
import { cuandoLegible, encuentrosDe } from '@/lib/calendarioPanel';
import { diaYMesDeEfemeride } from '@/lib/efemeridePublica';
import { ETIQUETA_MODALIDAD } from '@/lib/etiquetaDeModalidad';
import { portadaDe } from '@/lib/imagenes';
import { SLUG_PLATAFORMA_A_CONFIRMAR } from '@/lib/modalidades';
import { linksDeReunionDe, sinLinksDeReunion } from '../../functions/links-de-reunion.js';
import { DOMINIO, rutaDeDetalle, rutaDeEfemeride } from '@/lib/rutasPublicas';
import type { ActividadParaRedes } from '@/lib/textoRedes';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadConId, CampoTaxonomia, Comision, Imagen, ViaInscripcion } from '@/types/actividad';
import type { Efemeride } from '@/types/efemeride';

/** `agendaleh.ar/efemerides/nace-umberto-eco` — sin esquema ni barra final. */
const enlaceVisible = (ruta: string): string => `${DOMINIO}${ruta.replace(/\/$/, '')}`;

const etiqueta = (labels: LabelsTaxonomia, campo: CampoTaxonomia, slug: string | null | undefined): string =>
  slug ? (labels[campo]?.[slug] ?? desSlug(slug)) : '';

// ─────────────────────────────────────────────────────────────────
// Efeméride — B-2225
// ─────────────────────────────────────────────────────────────────

export interface PlacaDeEfemeride {
  /** «Un día como hoy». */
  antetitulo: string;
  /** «26 de agosto». */
  fecha: string;
  /** «1914», o `null` sin año. */
  anio: string | null;
  /** «Hace 112 años», contado sobre el año de `hoy`; `null` sin año o si es de este año. */
  hace: string | null;
  titulo: string;
  cuerpo: string;
  /**
   * La dirección de su página, **solo si está publicada**: en borrador el slug
   * todavía se mueve con el título (trampa 10) y la página no existe.
   */
  enlace: string | null;
  pie: string;
}

/**
 * El año de `hoy` **en Buenos Aires** (trampa 1): con el del navegador, una placa
 * armada desde otra zona el 31 de diciembre a la noche diría un año de más.
 */
const anioEnBuenosAires = (hoy: Date): number =>
  Number(new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric' }).format(hoy));

export const placaDeEfemeride = (
  e: Pick<Efemeride, 'titulo' | 'descripcion' | 'dia' | 'mes' | 'anio' | 'slug' | 'estado'>,
  hoy: Date,
): PlacaDeEfemeride => {
  const anios = e.anio === null ? 0 : anioEnBuenosAires(hoy) - e.anio;
  return {
    antetitulo: 'Un día como hoy',
    fecha: diaYMesDeEfemeride(e),
    anio: e.anio === null ? null : String(e.anio),
    hace: anios > 0 ? `Hace ${anios} ${anios === 1 ? 'año' : 'años'}` : null,
    titulo: e.titulo.trim(),
    cuerpo: (e.descripcion ?? '').trim(),
    enlace: e.estado === 'publicado' && e.slug ? enlaceVisible(rutaDeEfemeride(e.slug)) : null,
    pie: DOMINIO,
  };
};

// ─────────────────────────────────────────────────────────────────
// Actividad — B-2226
// ─────────────────────────────────────────────────────────────────

export type ActividadParaPlaca = ActividadParaRedes & {
  imagenes?: Imagen[];
  comisiones?: Comision[];
};

export interface PlacaDeActividad {
  /** «Taller · 8 encuentros». */
  antetitulo: string;
  titulo: string;
  /** «Con María Moreno», o `null`. */
  conQuien: string | null;
  /** Las líneas de «Cuándo». */
  cuando: string[];
  /** Las líneas de «Dónde». */
  donde: string[];
  /** «Gratis», «A la gorra», «Arancelado · $15.000», o `null`. */
  arancel: string | null;
  /** «Inscripción por WhatsApp», «Sin inscripción previa», «Cupo completo». */
  inscripcion: string | null;
  /** La URL de la portada propia, o `null`. */
  imagen: string | null;
  enlace: string | null;
  pie: string;
}

export type ResultadoPlaca = { ok: true; placa: PlacaDeActividad } | { ok: false; motivo: string };

/** Cuántas fechas sueltas se listan antes de resumir. */
export const FECHAS_SUELTAS = 3;

const ETIQUETA_VIA: Record<ViaInscripcion, string> = {
  mail: 'por mail',
  whatsapp: 'por WhatsApp',
  dm: 'por mensaje directo',
  formulario: 'por formulario',
};

/** `2026-11-05` → `5/11`. La clave ya es el día civil de Buenos Aires. */
const diaCorto = (clave: string): string => {
  const [, mes, dia] = clave.split('-');
  return `${Number(dia)}/${Number(mes)}`;
};

const capitalizar = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * «Cuándo», en pocas líneas.
 *
 * - Con **opciones para sumarse** (D-530) se listan las opciones, no las
 *   fechas: cada persona va a una sola, y lo que elige es la opción.
 * - Hasta tres fechas, una por línea, con `cuandoLegible` —el mismo texto que el
 *   posteo y el listado del panel—.
 * - Más, y todas el mismo día de la semana a la misma hora (el ciclo típico):
 *   «Los jueves · 19:00» y «Del jueves 6 de noviembre al jueves 18 de diciembre».
 * - Más y sin patrón: las primeras dos y «y N fechas más».
 *
 * Las canceladas no se anuncian, como en el texto para redes.
 */
const cuandoDe = (actividad: ActividadParaPlaca, limpio: (t: string) => string): string[] => {
  const comisiones = (actividad.comisiones ?? []).filter((c) => c.etiqueta?.trim());
  if (comisiones.length > 1) {
    const visibles = comisiones.slice(0, FECHAS_SUELTAS).map((c) => limpio(c.etiqueta.trim()));
    const resto = comisiones.length - visibles.length;
    return [
      `${comisiones.length} opciones para sumarse:`,
      ...visibles,
      ...(resto > 0 ? [`y ${resto} más`] : []),
    ];
  }

  const fechas = encuentrosDe([{ ...actividad, id: '' } as unknown as ActividadConId]).filter(
    (e) => !e.cancelada,
  );
  if (fechas.length <= FECHAS_SUELTAS) {
    return fechas.map((e) => capitalizar(cuandoLegible(e.inicio, e.horarioAConfirmar)));
  }

  // `cuandoLegible` es «jueves 6 de noviembre · 19:00»: el día de la semana es la
  // primera palabra y la hora lo que sigue al «·».
  const partes = fechas.map((e) => {
    const texto = cuandoLegible(e.inicio, e.horarioAConfirmar);
    const [dia = '', hora = ''] = texto.split(' · ');
    return { dia, semana: dia.split(' ')[0] ?? '', hora, corto: diaCorto(e.dia) };
  });
  const mismaSemana = partes.every((p) => p.semana === partes[0]!.semana);
  const mismaHora = partes.every((p) => p.hora === partes[0]!.hora);
  if (mismaSemana && mismaHora) {
    const primero = partes[0]!;
    const ultimo = partes[partes.length - 1]!;
    return [
      `${capitalizar(`los ${primero.semana}${/s$/.test(primero.semana) ? '' : 's'}`)} · ${primero.hora}`,
      // Corto, como se escribe en un flyer: al lado del rótulo, «Del 5 de
      // noviembre al 24 de diciembre» no entra en un renglón.
      `Del ${primero.corto} al ${ultimo.corto}`,
    ];
  }
  return [
    ...fechas.slice(0, 2).map((e) => capitalizar(cuandoLegible(e.inicio, e.horarioAConfirmar))),
    `y ${fechas.length - 2} fechas más`,
  ];
};

/** «Dónde»: la sede y su barrio (o su ciudad), y lo virtual con su plataforma. */
const dondeDe = (
  actividad: ActividadParaPlaca,
  labels: LabelsTaxonomia,
  limpio: (t: string) => string,
): string[] => {
  const lineas: string[] = [];
  const sede = actividad.sede;
  if (sede) {
    const zona = etiqueta(labels, 'barrio', sede.barrio) || etiqueta(labels, 'ciudad', sede.ciudad);
    const linea = [limpio(sede.nombre?.trim() ?? ''), zona].filter(Boolean).join(' · ');
    if (linea) lineas.push(linea);
  }
  if (actividad.online) {
    const plataforma =
      actividad.online.plataforma === SLUG_PLATAFORMA_A_CONFIRMAR
        ? ''
        : etiqueta(labels, 'plataforma', actividad.online.plataforma);
    lineas.push(plataforma ? `Virtual, por ${plataforma}` : 'Virtual');
  }
  if (!lineas.length) lineas.push(ETIQUETA_MODALIDAD[actividad.modalidad] ?? '');
  return lineas.filter(Boolean);
};

const arancelDe = (actividad: ActividadParaPlaca, labels: LabelsTaxonomia): string | null => {
  const tipo = etiqueta(labels, 'arancel', actividad.arancel?.tipo);
  if (!tipo) return null;
  const monto = actividad.arancel?.monto;
  return monto != null && admiteMonto(actividad.arancel?.tipo ?? '')
    ? `${tipo} · ${montoLegible(monto)}`
    : tipo;
};

const inscripcionDe = (actividad: ActividadParaPlaca): string | null => {
  const insc = actividad.inscripcion;
  if (!insc) return null;
  if (insc.completo === true) return 'Cupo completo';
  if (!insc.requiere) return 'Sin inscripción previa';
  return `Inscripción ${insc.via ? ETIQUETA_VIA[insc.via] : 'previa'}`;
};

/**
 * La portada, **solo si es propia** (está en el bucket del proyecto, que tiene
 * el CORS de `cors.json` para el sitio). Una externa no se puede leer de vuelta
 * del canvas: el navegador lo marca como «contaminado» y no deja bajarlo.
 */
const imagenDe = (actividad: ActividadParaPlaca): string | null => {
  const portada = portadaDe(actividad.imagenes ?? []);
  return portada && portada.origen === 'propia' && portada.url ? portada.url : null;
};

export const placaDeActividad = (
  actividad: ActividadParaPlaca,
  labels: LabelsTaxonomia = {},
  /** ¿La actividad **guardada** está publicada? Igual que en `construirTextoRedes` (B-312). */
  yaTienePagina = false,
): ResultadoPlaca => {
  // Todo texto libre que se dibuja pasa por acá: ver la tabla del docblock.
  const conocidos = linksDeReunionDe(actividad);
  const limpio = (t: string): string => sinLinksDeReunion(t, conocidos);
  const cuando = cuandoDe(actividad, limpio);
  if (!cuando.length) {
    return { ok: false, motivo: 'Cargá al menos un encuentro con su fecha para armar la placa.' };
  }
  const fechas = encuentrosDe([{ ...actividad, id: '' } as unknown as ActividadConId]).filter(
    (e) => !e.cancelada,
  );
  const conOpciones = (actividad.comisiones ?? []).length > 1;
  const tipo = etiqueta(labels, 'tipo', actividad.tipo);
  const persona = actividad.tallerista?.nombre?.trim();
  return {
    ok: true,
    placa: {
      // Con opciones para sumarse, las sesiones son de grupos distintos: sumarlas
      // diría «12 encuentros» de un ciclo de cuatro.
      antetitulo: [tipo, actividad.esCiclo && !conOpciones && fechas.length > 1 ? `${fechas.length} encuentros` : '']
        .filter(Boolean)
        .join(' · '),
      titulo: limpio(actividad.titulo?.trim() || 'Sin título'),
      conQuien: persona ? `Con ${limpio(persona)}` : null,
      cuando,
      donde: dondeDe(actividad, labels, limpio),
      arancel: arancelDe(actividad, labels),
      inscripcion: inscripcionDe(actividad),
      imagen: imagenDe(actividad),
      enlace:
        yaTienePagina && actividad.slug?.trim()
          ? enlaceVisible(rutaDeDetalle(actividad.slug.trim()))
          : null,
      pie: DOMINIO,
    },
  };
};
