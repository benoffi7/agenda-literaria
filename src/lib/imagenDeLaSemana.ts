/**
 * **La imagen «Esta semana en la agenda»** — roadmap 4.3 (decisión del dueño:
 * una sola plantilla, semanal, y no una por actividad: el flyer del organizador ya
 * es la imagen de cada una).
 *
 * Se arma **en el navegador de quien carga**, en la pantalla del correo, y se baja
 * para subirla a mano: no se publica sola ni pasa por el build (el renderizador en
 * el build es lo que 12-sitio-publico §12 descartó para Open Graph).
 *
 * Este módulo es la parte pura: **qué entra** y **cómo se parte un título en
 * líneas**, con la medición inyectada para poder testearla sin un canvas. El
 * dibujo vive en `components/admin/ImagenDeLaSemana.tsx`.
 *
 * **Todo sale del mismo `Boletin`** que arma el correo y el posteo, o sea del
 * índice publicado (D-801): ni una regla nueva de qué entra a la semana, ni un
 * dato que no esté ya en el correo.
 */
import type { Boletin, EncuentroDelBoletin } from '@/lib/boletinSemanal';
import { DOMINIO } from '@/lib/rutasPublicas';

/** Los dos formatos de Instagram, en píxeles. */
export const FORMATOS = {
  // Medidos sobre el dibujo con títulos de dos líneas (2026-10-06): en el feed
  // entran cuatro con aire, en la historia siete. El dibujo igual corta si no
  // entran y cuenta los que faltan sobre lo que dibujó.
  feed: { ancho: 1080, alto: 1350, maximo: 4 },
  historia: { ancho: 1080, alto: 1920, maximo: 7 },
} as const;
export type Formato = keyof typeof FORMATOS;

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

/** `2026-10-07` → `MIÉ 7`. Aritmética de calendario en UTC: la clave ya es del día local. */
export const diaCorto = (clave: string): string => {
  const [a, m, d] = clave.split('-').map(Number);
  if (!a || !m || !d) return '';
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d}`;
};

export interface FilaDeLaImagen {
  clave: string;
  /** `MIÉ 7`. */
  dia: string;
  /** `19:00`, o `` si el encuentro no tiene horario. */
  hora: string;
  titulo: string;
  /** `Casa Brandon · Boedo`. */
  lugar: string;
}

export interface ContenidoDeLaImagen {
  /** Las líneas del título, partidas a mano: «Esta semana / en la agenda». */
  titulo: string[];
  /** `Del martes 6 al lunes 12 de octubre`. */
  rango: string;
  filas: FilaDeLaImagen[];
  /** Cuántos encuentros de la semana no entraron. */
  faltan: number;
  /** `agendaleh.ar`. */
  pie: string;
}

const fila = (e: EncuentroDelBoletin): FilaDeLaImagen => ({
  clave: e.clave,
  dia: diaCorto(e.dia),
  hora: e.hora,
  titulo: e.titulo,
  lugar: e.lugar,
});

/**
 * Qué entra en la imagen de un formato.
 *
 * **Si sobran, las destacadas primero** (roadmap 4.2: son las que el dueño eligió
 * recomendar), después el resto por fecha; y lo que entra se muestra **en orden de
 * fecha**, que es como se lee una semana. Lo que no entra se dice: «y N más», igual
 * que el posteo — cortar sin decirlo publicaría una semana que parece completa.
 */
export const contenidoDeLaImagen = (b: Boletin, formato: Formato): ContenidoDeLaImagen => {
  const { maximo } = FORMATOS[formato];
  const resto = b.dias.flatMap((d) => d.encuentros);
  const elegidos = [...b.destacadas, ...resto].slice(0, maximo);
  const enOrden = [...elegidos].sort(
    (x, y) => x.dia.localeCompare(y.dia) || x.hora.localeCompare(y.hora),
  );
  return {
    titulo: ['Esta semana', 'en la agenda'],
    rango: `Del ${b.desde} al ${b.hasta}`,
    filas: enOrden.map(fila),
    faltan: Math.max(0, b.total - enOrden.length),
    pie: DOMINIO,
  };
};

/**
 * Parte un texto en líneas que entren en `ancho`, con `medir` dando el ancho de un
 * texto en la tipografía del momento (`ctx.measureText(t).width` en el canvas).
 * Hasta `maxLineas`; si sobra texto, la última termina en «…». Una palabra sola más
 * ancha que la línea se corta igual: un título no puede salirse de la imagen.
 */
export const partirEnLineas = (
  texto: string,
  ancho: number,
  medir: (t: string) => number,
  maxLineas: number,
): string[] => {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const probada = actual ? `${actual} ${p}` : p;
    if (medir(probada) <= ancho || !actual) {
      actual = probada;
    } else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length <= maxLineas) return lineas.map((l) => recortar(l, ancho, medir));
  const visibles = lineas.slice(0, maxLineas);
  visibles[maxLineas - 1] = recortar(`${visibles[maxLineas - 1]}…`, ancho, medir, true);
  return visibles.map((l, i) => (i < maxLineas - 1 ? recortar(l, ancho, medir) : l));
};

/** Achica una línea de a una letra hasta que entre, terminándola en «…». */
const recortar = (
  linea: string,
  ancho: number,
  medir: (t: string) => number,
  conPuntos = false,
): string => {
  if (medir(linea) <= ancho) return linea;
  let base = conPuntos ? linea.replace(/…$/, '') : linea;
  while (base.length > 1 && medir(`${base}…`) > ancho) base = base.slice(0, -1);
  return `${base.trimEnd()}…`;
};
