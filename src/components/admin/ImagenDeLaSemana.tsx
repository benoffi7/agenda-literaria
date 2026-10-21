/**
 * **La imagen «Esta semana en la agenda», lista para bajar** — roadmap 4.3.
 *
 * Se dibuja en un `<canvas>` en el navegador de quien carga, con la identidad del
 * sitio: las mismas tipografías autoalojadas (el panel carga `global.css`) y **los
 * colores leídos de las variables CSS** (`--color-papel`, `--color-tinta`,
 * `--color-acento`), así que no hay un segundo juego de colores que se desalinee.
 * Qué entra y cómo se parten los títulos lo decide `lib/imagenDeLaSemana.ts`.
 *
 * No sube nada a ningún lado: la imagen se baja como PNG y se sube a mano.
 */
import { useCallback } from 'react';
import type { Boletin } from '@/lib/boletinSemanal';
import {
  FORMATOS,
  contenidoDeLaImagen,
  partirEnLineas,
  type Formato,
} from '@/lib/imagenDeLaSemana';
import { PlacaParaInstagram } from '@/components/admin/placa/PlacaParaInstagram';
import { cargarFuentes, colores } from '@/components/admin/placa/lienzo';

export const dibujar = async (canvas: HTMLCanvasElement, boletin: Boletin, formato: Formato) => {
  await cargarFuentes();
  const { ancho, alto } = FORMATOS[formato];
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { papel, tinta, acento, suave } = colores();
  const c = contenidoDeLaImagen(boletin, formato);

  const margen = 88;
  const util = ancho - margen * 2;
  ctx.fillStyle = papel;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textBaseline = 'top';

  // La regla gruesa de arriba, la marca del sitio.
  ctx.fillStyle = tinta;
  ctx.fillRect(margen, margen, util, 8);

  let y = margen + 48;
  ctx.fillStyle = tinta;
  ctx.font = '900 96px Fraunces';
  for (const l of c.titulo) {
    ctx.fillText(l, margen, y);
    y += 104;
  }
  ctx.fillStyle = acento;
  ctx.font = '700 40px "Archivo Narrow"';
  ctx.fillText(c.rango, margen, y + 8);
  y += 96;

  // Una fila por encuentro: el día a la izquierda, título y lugar a la derecha.
  const columnaDia = 190;
  const anchoTexto = util - columnaDia;
  const piso = alto - margen - 150;
  let dibujadas = 0;
  for (const f of c.filas) {
    ctx.font = '600 44px "Public Sans"';
    const lineas = partirEnLineas(f.titulo, anchoTexto, (t) => ctx.measureText(t).width, 2);
    const altoFila = lineas.length * 54 + 48 + 36;
    if (y + altoFila > piso) break;

    ctx.fillStyle = tinta;
    ctx.fillRect(margen, y, util, 2);
    y += 24;
    ctx.fillStyle = acento;
    ctx.font = '700 40px "Archivo Narrow"';
    ctx.fillText(f.dia, margen, y);
    if (f.hora) {
      ctx.fillStyle = suave;
      ctx.font = '400 32px "Public Sans"';
      ctx.fillText(f.hora, margen, y + 48);
    }
    ctx.fillStyle = tinta;
    ctx.font = '600 44px "Public Sans"';
    let yt = y;
    for (const l of lineas) {
      ctx.fillText(l, margen + columnaDia, yt);
      yt += 54;
    }
    ctx.fillStyle = suave;
    ctx.font = '400 32px "Public Sans"';
    const [lugar] = partirEnLineas(f.lugar, anchoTexto, (t) => ctx.measureText(t).width, 1);
    if (lugar) ctx.fillText(lugar, margen + columnaDia, yt + 4);
    y = yt + 48 + 12;
    dibujadas += 1;
  }
  // Los que faltan, sobre lo que **se dibujó**: si una fila no entró, también falta.
  const faltan = c.faltan + (c.filas.length - dibujadas);

  // El pie: cuántos faltan, si faltan, y la dirección.
  ctx.fillStyle = tinta;
  ctx.fillRect(margen, alto - margen - 110, util, 2);
  ctx.font = '400 32px "Public Sans"';
  ctx.fillStyle = suave;
  if (faltan > 0) {
    ctx.fillText(`y ${faltan} más en la agenda`, margen, alto - margen - 88);
  }
  ctx.fillStyle = acento;
  ctx.font = '900 56px Fraunces';
  ctx.fillText(c.pie, margen, alto - margen - 44);
};

export function ImagenDeLaSemana({ boletin }: { boletin: Boletin }) {
  const dibujarSemana = useCallback(
    (canvas: HTMLCanvasElement, formato: Formato) => dibujar(canvas, boletin, formato),
    [boletin],
  );
  return (
    <PlacaParaInstagram
      titulo="Imagen de la semana"
      ayuda="Con los mismos encuentros que el correo y el posteo. Si no entran todos, dice cuántos faltan. Se baja como imagen y se sube a mano."
      descripcion="Vista previa de la imagen de la semana"
      archivo="esta-semana"
      dibujar={dibujarSemana}
    />
  );
}
