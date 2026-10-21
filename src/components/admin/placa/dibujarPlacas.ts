/**
 * **El dibujo de las placas** — B-2225 (efeméride) y B-2226 (actividad).
 *
 * Qué texto lleva cada una lo decide `lib/placas.ts`; acá solo se pinta, con la
 * misma retícula que la imagen de la semana: margen de 88, la regla gruesa
 * arriba, y el pie con la dirección del sitio.
 */
import { FORMATOS, partirEnLineas, type Formato } from '@/lib/imagenDeLaSemana';
import type { PlacaDeActividad, PlacaDeEfemeride } from '@/lib/placas';
import {
  cargarFuentes,
  cargarImagen,
  colores,
  dibujarCubriendo,
  escribir,
  type Colores,
} from '@/components/admin/placa/lienzo';

const MARGEN = 88;

/** Prepara el lienzo: tamaño, fondo y la regla de arriba. */
const lienzo = async (canvas: HTMLCanvasElement, formato: Formato) => {
  await cargarFuentes();
  const { ancho, alto } = FORMATOS[formato];
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const c = colores();
  ctx.fillStyle = c.papel;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textBaseline = 'top';
  ctx.fillStyle = c.tinta;
  ctx.fillRect(MARGEN, MARGEN, ancho - MARGEN * 2, 8);
  return { ctx, c, ancho, alto, util: ancho - MARGEN * 2 };
};

/** El pie: una regla, la dirección de la página (si la hay) y el dominio. */
const pie = (
  ctx: CanvasRenderingContext2D,
  c: Colores,
  alto: number,
  util: number,
  enlace: string | null,
  dominio: string,
) => {
  ctx.fillStyle = c.tinta;
  ctx.fillRect(MARGEN, alto - MARGEN - 110, util, 2);
  if (enlace) {
    ctx.fillStyle = c.suave;
    ctx.font = '400 30px "Public Sans"';
    const [l] = partirEnLineas(enlace, util, (t) => ctx.measureText(t).width, 1);
    if (l) ctx.fillText(l, MARGEN, alto - MARGEN - 88);
  }
  ctx.fillStyle = c.acento;
  ctx.font = '900 56px Fraunces';
  ctx.fillText(dominio, MARGEN, alto - MARGEN - 44);
};

/** Dónde termina lo que se puede escribir: arriba del pie. */
const pisoDe = (alto: number) => alto - MARGEN - 140;

/**
 * El cuerpo de la placa de efeméride desde `y`; devuelve dónde terminó. Con
 * `lineasDelDato` se acota el dato (la primera pasada, que mide, no lo acota).
 */
const cuerpoDeEfemeride = (
  ctx: CanvasRenderingContext2D,
  c: Colores,
  p: PlacaDeEfemeride,
  historia: boolean,
  util: number,
  y: number,
  piso: number,
): number => {
  ctx.fillStyle = c.acento;
  ctx.font = '700 40px "Archivo Narrow"';
  ctx.fillText(p.antetitulo.toUpperCase(), MARGEN, y);
  y += 76;

  ctx.fillStyle = c.tinta;
  ctx.font = `900 ${historia ? 150 : 128}px Fraunces`;
  y = escribir(ctx, p.fecha, MARGEN, y, util, historia ? 156 : 134, 2);

  const anio = [p.anio, p.hace].filter(Boolean).join(' · ');
  if (anio) {
    ctx.fillStyle = c.acento;
    ctx.font = '700 48px "Archivo Narrow"';
    ctx.fillText(anio, MARGEN, y + 8);
    y += 80;
  }

  y += 24;
  ctx.fillStyle = c.tinta;
  ctx.fillRect(MARGEN, y, util, 2);
  y += 40;

  ctx.font = `600 ${historia ? 68 : 60}px "Public Sans"`;
  y = escribir(ctx, p.titulo, MARGEN, y, util, historia ? 82 : 72, 4);

  // El dato, con las líneas que queden hasta el pie.
  if (p.cuerpo) {
    y += 24;
    const interlineado = 52;
    const lineas = Math.floor((piso - y) / interlineado);
    if (lineas > 0) {
      ctx.fillStyle = c.suave;
      ctx.font = '400 38px "Public Sans"';
      y = escribir(ctx, p.cuerpo, MARGEN, y, util, interlineado, lineas);
    }
  }
  return y;
};

export const dibujarPlacaDeEfemeride = async (
  canvas: HTMLCanvasElement,
  p: PlacaDeEfemeride,
  formato: Formato,
): Promise<void> => {
  const l = await lienzo(canvas, formato);
  if (!l) return;
  const { ctx, c, ancho, alto, util } = l;
  const historia = formato === 'historia';
  const piso = pisoDe(alto);
  const arriba = MARGEN + 56;

  /*
   * Dos pasadas: la primera mide cuánto ocupa, y si sobra lugar la segunda lo
   * centra entre la regla de arriba y el pie. Una efeméride de una línea pegada
   * arriba deja media placa en blanco, que en la historia es casi toda.
   */
  const fin = cuerpoDeEfemeride(ctx, c, p, historia, util, arriba, piso);
  const sobra = piso - fin;
  if (sobra > 0) {
    ctx.fillStyle = c.papel;
    ctx.fillRect(0, MARGEN + 8, ancho, alto - MARGEN - 8);
    cuerpoDeEfemeride(ctx, c, p, historia, util, arriba + Math.floor(sobra / 2), piso);
  }

  pie(ctx, c, alto, util, p.enlace, p.pie);
};

export const dibujarPlacaDeActividad = async (
  canvas: HTMLCanvasElement,
  p: PlacaDeActividad,
  formato: Formato,
): Promise<void> => {
  // La foto se pide antes de tocar el lienzo: si tarda, la vista previa no queda
  // a medio dibujar. Si no carga (sin CORS, borrada), la placa sale sin foto.
  const img = p.imagen ? await cargarImagen(p.imagen) : null;
  const l = await lienzo(canvas, formato);
  if (!l) return;
  const { ctx, c, alto, util } = l;
  const historia = formato === 'historia';
  const piso = pisoDe(alto);
  let y = MARGEN + 40;

  if (img) {
    const altoFoto = historia ? 720 : 280;
    dibujarCubriendo(ctx, img, MARGEN, y, util, altoFoto);
    y += altoFoto + 48;
  } else {
    y += historia ? 80 : 16;
  }

  if (p.antetitulo) {
    ctx.fillStyle = c.acento;
    ctx.font = '700 40px "Archivo Narrow"';
    ctx.fillText(p.antetitulo.toUpperCase(), MARGEN, y);
    y += 64;
  }

  ctx.fillStyle = c.tinta;
  ctx.font = `900 ${img ? 72 : 88}px Fraunces`;
  y = escribir(ctx, p.titulo, MARGEN, y, util, img ? 80 : 96, img && !historia ? 2 : 3);

  if (p.conQuien) {
    ctx.fillStyle = c.suave;
    ctx.font = '600 40px "Public Sans"';
    y = escribir(ctx, p.conQuien, MARGEN, y + 8, util, 52, 1);
  }
  y += historia || !img ? 24 : 12;

  // Los bloques en orden de importancia: el que no entra entero no se dibuja, y
  // los que siguen tampoco — una placa con el arancel y sin la fecha confunde.
  const bloques: [string, string[]][] = [
    ['Cuándo', p.cuando],
    ['Dónde', p.donde],
    ['Arancel', p.arancel ? [p.arancel] : []],
    ['Inscripción', p.inscripcion ? [p.inscripcion] : []],
  ];
  // El rótulo en una columna a la izquierda y el dato al lado, como las filas de
  // la imagen de la semana: un rótulo arriba de cada dato no deja entrar los cuatro.
  const interlineado = 50;
  const columna = 230;
  for (const [rotulo, lineas] of bloques) {
    if (!lineas.length) continue;
    // Cada dato puede ocupar dos renglones («Del 5 de noviembre al 24 de
    // diciembre» no entra en uno al lado del rótulo): se parte antes, para medir.
    ctx.font = '600 40px "Public Sans"';
    const renglones = lineas.flatMap((linea) =>
      partirEnLineas(linea, util - columna, (t) => ctx.measureText(t).width, 2),
    );
    const altoBloque = 20 + renglones.length * interlineado + 12;
    if (y + altoBloque > piso) break;
    ctx.fillStyle = c.tinta;
    ctx.fillRect(MARGEN, y, util, 2);
    y += 20;
    ctx.fillStyle = c.acento;
    ctx.font = '700 32px "Archivo Narrow"';
    ctx.fillText(rotulo.toUpperCase(), MARGEN, y + 6);
    ctx.fillStyle = c.tinta;
    ctx.font = '600 40px "Public Sans"';
    for (const renglon of renglones) {
      ctx.fillText(renglon, MARGEN + columna, y);
      y += interlineado;
    }
    y += 12;
  }

  pie(ctx, c, alto, util, p.enlace, p.pie);
};
