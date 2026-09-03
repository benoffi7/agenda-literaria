import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { insigniasDeActividad, insigniasDeTarjeta } from '@/lib/tarjetaDelPanel';
import type { Imagen } from '@/types/actividad';

/**
 * B-622 — qué insignias lleva la fila del listado del panel.
 *
 * El bug era una **ausencia**: `destacado` decide dónde aparece la actividad en
 * el sitio, se prende desde el acordeón «Opcional» —el rincón del formulario que
 * nadie vuelve a abrir— y el listado, que es la pantalla del conjunto, no lo
 * decía en ninguna parte.
 *
 * Lo que se fija acá no es esa línea sino **la regla**: solo se marca lo
 * excepcional. Es el mismo criterio de B-130 (solo lo ajeno) y de B-264 (solo
 * las publicadas sin flyer), y era el que no estaba escrito en ningún lado
 * mientras las insignias fueron tres `&&` sueltos adentro del JSX.
 */

const flyer: Imagen = {
  id: 'img_1',
  url: 'https://ejemplo.com/flyer.jpg',
  epigrafe: '',
  origen: 'externa',
  portada: true,
};

const ids = (a: Parameters<typeof insigniasDeActividad>[0]) =>
  insigniasDeActividad(a).map((i) => i.id);

describe('insignias de la fila del panel (B-622)', () => {
  it('una publicada normal, con flyer, no lleva ninguna: si todo se marca, la marca no avisa', () => {
    expect(ids({ estado: 'publicado', imagenes: [flyer] })).toEqual([]);
  });

  it('«Destacada» aparece, que es lo que faltaba', () => {
    expect(ids({ estado: 'publicado', destacado: true, imagenes: [flyer] })).toContain('destacada');
  });

  it('y también en un borrador: destacar es deliberado y conviene revisarlo ANTES de publicar', () => {
    // A diferencia de «Sin flyer», que solo tiene sentido sobre lo publicado.
    expect(ids({ estado: 'borrador', destacado: true, imagenes: [flyer] })).toContain('destacada');
  });

  it('no marca lo que no está destacado, ni con el campo ausente', () => {
    // El campo puede no existir: los documentos anteriores a que se agregara no
    // lo tienen, y el default de lectura tiene que ser «no lleva la marca».
    expect(ids({ estado: 'publicado', imagenes: [flyer] })).not.toContain('destacada');
    expect(ids({ estado: 'publicado', destacado: false, imagenes: [flyer] })).not.toContain(
      'destacada',
    );
  });

  it('«Cupo completo» sigue estando: lo que se publica se ve desde el panel (B-97)', () => {
    expect(
      ids({ estado: 'publicado', inscripcion: { completo: true }, imagenes: [flyer] }),
    ).toContain('cupo-completo');
  });

  it('«Sin flyer» sigue siendo solo de las publicadas (B-264)', () => {
    expect(ids({ estado: 'publicado', imagenes: [] })).toContain('sin-flyer');
    // Un borrador sin flyer no le falta nada todavía.
    expect(ids({ estado: 'borrador', imagenes: [] })).not.toContain('sin-flyer');
  });

  it('las tres pueden convivir, y en un orden estable', () => {
    expect(
      ids({
        estado: 'publicado',
        destacado: true,
        inscripcion: { completo: true },
        imagenes: [],
      }),
    ).toEqual(['cupo-completo', 'destacada', 'sin-flyer']);
  });

  it('no se cae con un documento al que le falta todo', () => {
    // Sale del documento crudo de Firestore: un `TypeError` acá deja el listado
    // entero en blanco, que es la pantalla desde la que se hace todo lo demás.
    expect(() => insigniasDeTarjeta({}, undefined)).not.toThrow();
    expect(insigniasDeTarjeta({}, undefined)).toEqual([]);
  });
});

/**
 * La otra mitad de B-622, y es una decisión, no un olvido: **los tags no van**.
 *
 * Un test que solo mirara lo que la función devuelve no distingue «se decidió que
 * no» de «se olvidaron», y el próximo que lea el listado y note que las etiquetas
 * no están las va a agregar. Esto lo pone en rojo si pasa.
 */
describe('los tags NO son una insignia de la fila (B-622)', () => {
  it('una actividad con etiquetas no suma ninguna insignia por eso', () => {
    const conTags = { estado: 'publicado', tags: ['poesia', 'taller'], imagenes: [flyer] };
    expect(ids(conTags)).toEqual([]);
  });

  it('el módulo no mira `tags` en ninguna parte, y dice por qué', () => {
    const FUENTE = readFileSync('src/lib/tarjetaDelPanel.ts', 'utf8');
    const sinComentarios = FUENTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(sinComentarios).not.toMatch(/\btags\b/);
    // Y el motivo está escrito: si alguien quita el razonamiento, que tenga que
    // borrarlo a propósito.
    expect(FUENTE).toContain('Por qué `tags` NO entra');
  });
});

/**
 * Que la decisión viva en el módulo no sirve de nada si el componente sigue
 * teniendo su propia rama. Es el mismo aserto de identidad que B-76 hace con las
 * etiquetas: no alcanza con que hoy coincidan.
 */
describe('el listado pinta lo que decide el módulo, no lo suyo (B-622)', () => {
  const LISTADO = readFileSync('src/components/admin/ListaActividades.tsx', 'utf8');

  it('recorre las insignias en vez de condicionarlas a mano', () => {
    expect(LISTADO).toContain('insigniasDeActividad(a)');
  });

  it('no quedó ninguna condición de insignia suelta en el JSX', () => {
    // Las tres formas exactas que tenía antes. El estado sí sigue en el JSX, y a
    // propósito: lleva color propio y lo lleva siempre, así que no es una
    // excepción sino la identidad de la fila.
    expect(LISTADO).not.toContain('Cupo completo');
    expect(LISTADO).not.toContain('Sin flyer');
    expect(LISTADO).not.toMatch(/faltaElFlyer\(/);
  });
});
