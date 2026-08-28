import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CONTACTO, MOTIVOS_DE_CONTACTO, urlDeContacto } from '@/lib/enlaces';
import {
  ANTES_DE_ESCRIBIR,
  BLOQUES_DE_CONTACTO,
  INTRO_DE_CONTACTO,
  QUE_PASA_DESPUES,
} from '@/lib/contactoDelSitio';

/**
 * La página de contacto — B-232.
 *
 * No hay backend: son dos `mailto:` con el asunto ya puesto. Suena a que no hay
 * nada que testear, y hay tres cosas:
 *
 * 1. **Que la página muestre todos los motivos que el contrato declara.** Los
 *    bloques se derivan de `MOTIVOS_DE_CONTACTO`, así que un motivo nuevo
 *    aparece solo — pero su lista de "qué conviene contarnos" no se escribe
 *    sola, y sin este test quedaría vacía y nadie se enteraría.
 * 2. **Que los asuntos sigan siendo distintos.** Es lo único que permite separar
 *    una sugerencia de un error en la bandeja sin abrirlos, y es un pedido
 *    explícito del dueño. `enlaces.test.ts` lo fija en el contrato; acá se fija
 *    en la salida, que es donde se rompería si la página armara sus propios
 *    links.
 * 3. **Que la dirección no esté escrita en el marcado.** Un `mailto:` a mano en
 *    el `.astro` funciona igual de bien hoy y deja de funcionar el día que la
 *    casilla cambie, sin que nada falle. Es la clase B-72/B-88.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const paginas = ['src/pages/contacto.astro', 'src/pages/ayuda.astro'];

/** Todo el texto que la página muestra. */
const TEXTOS = (): string[] => [
  ...INTRO_DE_CONTACTO,
  ...QUE_PASA_DESPUES,
  ANTES_DE_ESCRIBIR.texto,
  ...BLOQUES_DE_CONTACTO.flatMap((b) => [b.etiqueta, b.ayuda, b.asunto, ...b.queIncluir]),
];

describe('la página de contacto — B-232', () => {
  it('el barrido mira todos los motivos del contrato', () => {
    // Control positivo: sin esto, un `BLOQUES_DE_CONTACTO` vacío haría pasar
    // todas las aserciones que recorren la lista.
    const motivos = Object.keys(MOTIVOS_DE_CONTACTO);
    expect(motivos.length).toBeGreaterThanOrEqual(2);
    expect(BLOQUES_DE_CONTACTO.map((b) => b.motivo)).toEqual(motivos);
    expect(TEXTOS().length).toBeGreaterThanOrEqual(15);
  });

  it('cada motivo dice qué conviene contar, y no repite la frase del contrato', () => {
    for (const bloque of BLOQUES_DE_CONTACTO) {
      expect(
        bloque.queIncluir.length,
        `«${bloque.etiqueta}» no dice qué conviene contar. Un motivo nuevo se ` +
          'muestra solo, pero su lista hay que escribirla.',
      ).toBeGreaterThanOrEqual(3);

      for (const item of bloque.queIncluir) {
        expect(item.trim().length).toBeGreaterThan(10);
        expect(item, 'la viñeta repite la frase corta del contrato').not.toBe(bloque.ayuda);
      }
    }
  });

  it('la sugerencia pide quién, cuándo y dónde', () => {
    // Es lo mínimo con lo que una actividad se puede cargar: sin alguno de los
    // tres hay que volver a escribir, y ese ida y vuelta es donde se pierden.
    const texto = BLOQUES_DE_CONTACTO.find((b) => b.motivo === 'sugerencia')!
      .queIncluir.join(' ')
      .toLowerCase();

    /*
     * Las tres van **con tilde**, y no es cosmético: la primera versión de este
     * test pedía `d[oó]nde` y lo satisfacía «un link donde esté anunciada», que
     * no dice nada del lugar de la actividad. En castellano el interrogativo
     * lleva tilde, así que pedirla es exactamente pedir la pregunta.
     */
    expect(texto).toMatch(/quién/);
    expect(texto).toMatch(/cuándo|fecha/);
    expect(texto).toMatch(/dónde|dirección/);
  });

  it('el reporte de error pide qué se vio mal y en qué página', () => {
    // Sin la página, un reporte de "la fecha está mal" no se puede accionar: hay
    // decenas de actividades y todas tienen fecha.
    const texto = BLOQUES_DE_CONTACTO.find((b) => b.motivo === 'error')!
      .queIncluir.join(' ')
      .toLowerCase();

    expect(texto).toMatch(/mal|error|incorrect/);
    expect(texto).toMatch(/página/);
  });

  it('los dos motivos llegan con asuntos distintos', () => {
    const asuntos = BLOQUES_DE_CONTACTO.map((b) => b.asunto);
    expect(new Set(asuntos).size, 'dos motivos comparten el asunto').toBe(asuntos.length);

    // Y el asunto que se muestra es el que viaja en el link, no uno reescrito
    // para que se lea mejor: si se separan, la bandeja se ordena por el que
    // nadie ve.
    for (const bloque of BLOQUES_DE_CONTACTO) {
      const enElLink = new URL(bloque.href).searchParams.get('subject');
      expect(enElLink, `el asunto mostrado de «${bloque.etiqueta}» no es el del link`).toBe(
        bloque.asunto,
      );
    }
  });

  it('los links salen del contrato y no se arman acá', () => {
    for (const bloque of BLOQUES_DE_CONTACTO) {
      expect(bloque.href).toBe(urlDeContacto(bloque.motivo));
      expect(bloque.href.startsWith('mailto:')).toBe(true);
    }
  });

  it('ninguna página escribe la dirección ni el mailto a mano', () => {
    /*
     * La guarda que importa. Un `mailto:` pegado en el marcado anda igual de
     * bien hoy: se rompe el día que la casilla cambie, en una sola de las tres
     * páginas, y nada falla. Se verifica sobre el fuente porque es ahí donde se
     * escribe mal.
     */
    for (const rel of paginas) {
      const src = readFileSync(raiz(rel), 'utf8');
      expect(src, `${rel} tiene la dirección escrita a mano`).not.toContain(CONTACTO);
      expect(src.match(/href=["'`]mailto:/), `${rel} arma un mailto a mano`).toBeNull();
    }

    const contacto = readFileSync(raiz('src/pages/contacto.astro'), 'utf8');
    expect(contacto).toContain("from '@/lib/contactoDelSitio'");
  });

  it('dice qué pasa después, y no promete lo que no se puede cumplir', () => {
    const texto = QUE_PASA_DESPUES.join(' ').toLowerCase();
    // Las dos cosas que hay que decir: lo lee alguien, y puede tardar. Prometer
    // una respuesta rápida es peor que no decir nada.
    expect(texto).toContain('persona');
    expect(texto).toMatch(/demor|tard/);
    expect(QUE_PASA_DESPUES.length).toBeGreaterThanOrEqual(2);
  });

  it('la intro aclara que no hay formulario', () => {
    // Es la pregunta que se hace quien busca un campo de texto y no lo encuentra.
    expect(INTRO_DE_CONTACTO.join(' ').toLowerCase()).toContain('formulario');
  });

  it('manda a la ayuda antes de escribir', () => {
    // La mitad de los mails son preguntas ya contestadas, y contestarlas de nuevo
    // a mano es lo que hace que las otras tarden.
    expect(ANTES_DE_ESCRIBIR.href).toBe('/ayuda');
    expect(ANTES_DE_ESCRIBIR.texto.length).toBeGreaterThan(10);
  });

  it('el texto no tiene jerga ni publica un dato que no corresponde', () => {
    for (const texto of TEXTOS()) {
      for (const aguja of ['§', '.ts', '.json', 'Firestore', '@gmail', 'http://', 'https://']) {
        expect(texto, `«${texto.slice(0, 60)}…» contiene ${aguja}`).not.toContain(aguja);
      }
    }
  });
});
