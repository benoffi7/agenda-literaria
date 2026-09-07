/**
 * `GaleriaEditor` renderizado de verdad — B-301, D-440.
 *
 * **Por qué acá hace falta el DOM y no alcanza leer el fuente.** Lo que la
 * decisión del dueño promete es «un campo solo»: el texto alternativo se pide en
 * **la portada** y en ninguna otra fila. Eso es una afirmación sobre cuántos
 * controles hay en pantalla con cuatro imágenes cargadas, y un `toContain` sobre
 * el fuente no la puede hacer — un `esPortada &&` mal escrito (comparando
 * `i === 0`, o `img.portada` en vez de `portadaDe`) deja el string igual y pinta
 * el campo en la fila equivocada. Es la lección de B-202: un aserto que un import
 * satisface no verifica nada.
 *
 * El caso que fija la diferencia es **la portada que no es la primera fila**: ahí
 * `img.portada` y «la primera» dan respuestas distintas, y `portadaDe` —la misma
 * función que usa el `superRefine`— da la correcta. Con las dos derivaciones
 * separadas, el schema pediría el campo en una fila y el editor lo mostraría en
 * otra: el error existiría en el mapa y no se pintaría en ninguna parte (B-341).
 *
 * Vive en `.render.test.tsx` porque `vitest.config.ts` monta jsdom solo para ese
 * patrón, y `cleanup()` va a mano porque este proyecto no prende `test.globals`.
 */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GaleriaEditor } from '@/components/admin/GaleriaEditor';
import type { Imagen } from '@/types/actividad';

afterEach(() => cleanup());

const img = (over: Partial<Imagen> = {}): Imagen => ({
  id: 'img_1',
  url: 'https://ejemplo.ar/flyer.jpg',
  epigrafe: '',
  textoAlternativo: '',
  origen: 'externa',
  portada: true,
  ...over,
});

const pintar = (imagenes: Imagen[], errorDe: (p: string) => string | undefined = () => undefined) =>
  render(
    <GaleriaEditor
      imagenes={imagenes}
      onChange={() => {}}
      tituloActividad="Taller de crónica urbana"
      errorDe={errorDe}
    />,
  );

const camposDeAlternativo = () => screen.queryAllByLabelText('Descripción de la portada');

describe('el texto alternativo se pide una sola vez (B-301, D-440)', () => {
  it('con una imagen, hay exactamente un campo', () => {
    pintar([img()]);
    expect(camposDeAlternativo()).toHaveLength(1);
  });

  it('con cuatro imágenes sigue habiendo uno: es lo que el dueño decidió', () => {
    // «Ni un campo por imagen —nadie lo llenaría en las cuatro»— es literalmente
    // la decisión, así que este número es el requisito y no un detalle de UI.
    const cuatro = [
      img({ id: 'img_1', portada: true }),
      img({ id: 'img_2', portada: false }),
      img({ id: 'img_3', portada: false }),
      img({ id: 'img_4', portada: false }),
    ];
    pintar(cuatro);
    expect(camposDeAlternativo()).toHaveLength(1);
  });

  it('sin imágenes no hay ningún campo: la imagen nunca fue obligatoria', () => {
    pintar([]);
    expect(camposDeAlternativo()).toHaveLength(0);
  });

  it('el campo está en la fila marcada portada, no en la primera', () => {
    // MUTACIÓN PROBADA: cambiar `portadaDe(imagenes)?.id === img.id` por
    // `i === 0` pone esto en rojo, y es el caso en el que el schema pediría el
    // campo en la fila 2 y el editor lo mostraría en la 1.
    const laSegundaEsPortada = [
      img({ id: 'img_1', portada: false, textoAlternativo: 'de la primera' }),
      img({ id: 'img_2', portada: true, textoAlternativo: 'de la portada' }),
    ];
    pintar(laSegundaEsPortada);
    const campos = camposDeAlternativo();
    expect(campos).toHaveLength(1);
    expect((campos[0] as HTMLInputElement).value).toBe('de la portada');
  });

  it('una fila anterior al campo se muestra vacía, no como «undefined»', () => {
    const vieja = img();
    delete (vieja as { textoAlternativo?: string }).textoAlternativo;
    pintar([vieja]);
    expect((camposDeAlternativo()[0] as HTMLInputElement).value).toBe('');
  });

  it('el rechazo del schema se pinta al lado del campo, no solo en la barra', () => {
    // B-341 aplicado al campo nuevo: el editor recibe el mapa entero y arma la
    // ruta con el índice en el medio (`imagenes.0.textoAlternativo`).
    pintar([img()], (p) =>
      p === 'imagenes.0.textoAlternativo' ? 'Describí la portada para quien no puede verla' : undefined,
    );
    expect(screen.getByRole('alert').textContent).toContain('Describí la portada');
  });
});
