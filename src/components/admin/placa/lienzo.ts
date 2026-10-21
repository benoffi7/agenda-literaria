/**
 * **Lo que comparten las imágenes para Instagram del panel** — la de la semana
 * (roadmap 4.3) y las placas (B-2225, B-2226).
 *
 * Las tipografías del sitio (el panel carga `global.css`), los colores leídos de
 * sus variables CSS —así no hay un segundo juego de colores que se desalinee— y
 * el «bajar como PNG». Nada sube a ningún lado.
 */
import { partirEnLineas } from '@/lib/imagenDeLaSemana';

/** Las familias del sitio, en los pesos que dibujan las imágenes. */
export const FUENTES = [
  '900 96px Fraunces',
  '700 40px "Archivo Narrow"',
  '600 44px "Public Sans"',
  '400 32px "Public Sans"',
];

/** Espera a que las tipografías estén: un `fillText` antes dibuja con la de respaldo. */
export const cargarFuentes = async (): Promise<void> => {
  // Sin la API (un navegador viejo, jsdom) se dibuja con lo que haya.
  if (!document.fonts?.load) return;
  await Promise.all(FUENTES.map((f) => document.fonts.load(f).catch(() => [])));
};

const variable = (nombre: string, respaldo: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || respaldo;

export interface Colores {
  papel: string;
  tinta: string;
  acento: string;
  suave: string;
}

export const colores = (): Colores => ({
  papel: variable('--color-papel', '#fbf9f4'),
  tinta: variable('--color-tinta', '#1b1c19'),
  acento: variable('--color-acento', '#a7341c'),
  suave: variable('--color-suave', '#58413c'),
});

/**
 * Escribe un texto partido en líneas desde `y` y devuelve dónde terminó. El
 * `interlineado` es la distancia entre renglones; la fuente va puesta antes.
 */
export const escribir = (
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  interlineado: number,
  maxLineas: number,
): number => {
  const lineas = partirEnLineas(texto, ancho, (t) => ctx.measureText(t).width, maxLineas);
  for (const l of lineas) {
    ctx.fillText(l, x, y);
    y += interlineado;
  }
  return y;
};

/**
 * Una imagen para dibujar, o `null` si no se pudo. **Con `crossOrigin`**: sin
 * eso el canvas queda «contaminado» y `toBlob` falla, así que lo que no trae
 * CORS no carga y la placa sale sin foto en vez de no poder bajarse.
 */
export const cargarImagen = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

/** Dibuja `img` cubriendo el rectángulo, recortando lo que sobra (como `object-fit: cover`). */
export const dibujarCubriendo = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  ancho: number,
  alto: number,
): void => {
  const escala = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight);
  const w = ancho / escala;
  const h = alto / escala;
  ctx.drawImage(img, (img.naturalWidth - w) / 2, (img.naturalHeight - h) / 2, w, h, x, y, ancho, alto);
};

/** Baja lo dibujado como PNG con ese nombre. */
export const bajarComoPng = (canvas: HTMLCanvasElement, nombre: string): void => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
};
