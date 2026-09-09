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
 * `img.portada` y «la primera» dan respuestas distintas, y `portadaDe` da la
 * correcta. B-850 — decía «la misma función que usa el `superRefine`», y ese
 * consumidor ya no existe: el bloqueo se sacó el 2026-09-07. El acoplamiento que
 * queda es con el **sitio**, que es el que importa ahora — `eventsJson` y
 * `detallePublico` eligen la portada con `portadaDe`, así que pedir el texto en
 * otra fila sería hacer describir una foto y publicar otra.
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

  it('B-850 — el cartel del campo ya no dice que se necesita para publicar', () => {
    /*
     * El texto decía «Se necesita para publicar», en las dos ramas —con el campo
     * lleno y con el campo vacío—, y dejó de ser cierto el 2026-09-07 cuando el
     * dueño sacó el bloqueo (D-440). Se afirma renderizado y no leyendo el
     * fuente a propósito: la rama depende de `img.textoAlternativo?.trim()`, así
     * que un `toContain` sobre el `.tsx` daría verde aunque solo se hubiera
     * corregido una de las dos.
     *
     * MUTACIÓN PROBADA: reponer «Se necesita para publicar» en cualquiera de las
     * dos ramas pone esto en rojo.
     */
    // El `not` va contra el editor entero y no contra un párrafo: la frase no
    // tiene que estar en ninguna parte de la pantalla, ni en el cartel del campo
    // ni en la ayuda del pie del cargador.
    pintar([img({ textoAlternativo: '' })]);
    expect(document.body.textContent).not.toContain('Se necesita para publicar');
    expect(screen.getByText(/^No frena la publicación/)).toBeTruthy();
    cleanup();

    pintar([img({ textoAlternativo: 'Flyer con la fecha y la sede' })]);
    expect(document.body.textContent).not.toContain('Se necesita para publicar');
    expect(screen.getByText(/^No frena la publicación/)).toBeTruthy();
  });

  it('B-850 — y no queda ningún cartel de error para un campo que no puede fallar', () => {
    /*
     * La rama que se borró: `errorDe('imagenes.N.textoAlternativo')` con su
     * `<p role="alert">`. Nada en el schema puede producir ese issue —el campo es
     * `opcional`, sin largo máximo—, así que el editor no lo pinta más. Este caso
     * afirma que tampoco lo pinta si alguien **le inventa** el error: si volviera
     * la rama sin que el campo gane una regla de forma, vuelve el código muerto.
     *
     * El porqué del `queryAllByRole` en vez de `queryByRole`: la fila tiene otro
     * `alert` vivo, el de `url`, y acá no se pinta ninguno porque el `errorDe`
     * falso solo contesta la ruta del alternativo.
     */
    pintar([img()], (p) =>
      p === 'imagenes.0.textoAlternativo' ? 'Describí la portada para quien no puede verla' : undefined,
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });
});
