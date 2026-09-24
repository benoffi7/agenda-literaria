/**
 * B-980 — la descripción autolinkea las URLs explícitas, y nada más.
 *
 * Los bordes que la spec nombra: la puntuación del final de la frase, los
 * paréntesis, `javascript:`, las URLs sin esquema y el centinela con `<script>`
 * y una URL en la misma línea. Y el que agregó el frente: el link de la reunión
 * pegado en la descripción no sale ni como texto.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AVISO_DE_REUNION,
  enlazarDescripcion,
  sinLinksDeReunion,
  type TrozoDeDescripcion,
} from '@/lib/descripcionEnlazada';

const enlaces = (trozos: TrozoDeDescripcion[]) =>
  trozos.filter((t) => t.tipo === 'enlace').map((t) => (t.tipo === 'enlace' ? t.href : ''));

const unido = (trozos: TrozoDeDescripcion[]) => trozos.map((t) => t.texto).join('');

describe('enlazarDescripcion', () => {
  it('un texto sin URLs es un solo trozo de texto, igual al original', () => {
    const texto = 'Taller de escritura.\n\nCupo limitado, de 10 a 12.';
    expect(enlazarDescripcion(texto)).toEqual([{ tipo: 'texto', texto }]);
  });

  it('una descripción vacía no produce trozos', () => {
    expect(enlazarDescripcion('')).toEqual([]);
  });

  it('enlaza una URL con esquema y conserva el texto de alrededor', () => {
    expect(enlazarDescripcion('Más en https://instagram.com/casabrandon y listo')).toEqual([
      { tipo: 'texto', texto: 'Más en ' },
      { tipo: 'enlace', texto: 'https://instagram.com/casabrandon', href: 'https://instagram.com/casabrandon' },
      { tipo: 'texto', texto: ' y listo' },
    ]);
  });

  it('el texto unido de los trozos es la descripción entera', () => {
    const texto = 'Uno https://a.com.ar, dos (http://b.com/x) y tres https://c.com.';
    expect(unido(enlazarDescripcion(texto))).toBe(texto);
  });

  it.each([
    ['punto final', 'Escribinos a https://x.com.', 'https://x.com/', '.'],
    ['coma', 'Ver https://x.com/a, y más', 'https://x.com/a', ', y más'],
    ['signos', '¿Viste https://x.com/a?!', 'https://x.com/a', '?!'],
    ['puntos suspensivos', 'En https://x.com/a…', 'https://x.com/a', '…'],
    ['comillas angulares', '«https://x.com/a»', 'https://x.com/a', '»'],
    ['dos puntos', 'Link https://x.com/a: ahí', 'https://x.com/a', ': ahí'],
  ])('la puntuación final no es parte del link: %s', (_caso, texto, href, resto) => {
    const trozos = enlazarDescripcion(texto);
    expect(enlaces(trozos)).toEqual([href]);
    expect(trozos[trozos.length - 1]).toEqual({ tipo: 'texto', texto: resto });
  });

  it('un paréntesis que envuelve la URL queda afuera', () => {
    const trozos = enlazarDescripcion('(ver https://x.com/a)');
    expect(enlaces(trozos)).toEqual(['https://x.com/a']);
    expect(trozos).toContainEqual({ tipo: 'texto', texto: ')' });
  });

  it('un paréntesis que la URL abrió adentro se conserva', () => {
    const trozos = enlazarDescripcion('Ver https://es.wikipedia.org/wiki/Rayuela_(novela).');
    expect(trozos.find((t) => t.tipo === 'enlace')?.texto).toBe(
      'https://es.wikipedia.org/wiki/Rayuela_(novela)',
    );
  });

  it('las dos cosas juntas: paréntesis propio y paréntesis de la frase', () => {
    const trozos = enlazarDescripcion('(ver https://es.wikipedia.org/wiki/Rayuela_(novela))');
    expect(trozos.find((t) => t.tipo === 'enlace')?.texto).toBe(
      'https://es.wikipedia.org/wiki/Rayuela_(novela)',
    );
  });

  it.each([
    'casabrandon.com.ar',
    'www.casabrandon.com.ar',
    'el taller es de 10 a 12.com no existe',
    'instagram.com/casabrandon',
  ])('una URL sin esquema no se enlaza: %s', (texto) => {
    expect(enlazarDescripcion(texto)).toEqual([{ tipo: 'texto', texto }]);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'ftp://x.com/archivo',
    'mailto:alguien@x.com',
  ])('un esquema que no es http(s) no se enlaza: %s', (texto) => {
    const trozos = enlazarDescripcion(`Mirá ${texto} ahora`);
    expect(enlaces(trozos)).toEqual([]);
    expect(unido(trozos)).toBe(`Mirá ${texto} ahora`);
  });

  it('`https://javascript:…` no sirve de disfraz', () => {
    const trozos = enlazarDescripcion('https://javascript:alert(1)');
    for (const href of enlaces(trozos)) expect(href).toMatch(/^https?:\/\//);
    expect(enlaces(trozos).some((h) => /javascript:/i.test(h) && !h.startsWith('https://'))).toBe(false);
  });

  it('una URL pegada a una palabra no es una URL', () => {
    expect(enlaces(enlazarDescripcion('xhttps://x.com'))).toEqual([]);
  });

  it('`https://` solo, sin host, queda como texto', () => {
    expect(enlazarDescripcion('Esto https:// no es nada')).toEqual([
      { tipo: 'texto', texto: 'Esto https:// no es nada' },
    ]);
  });

  it('el esquema en mayúsculas también es un link', () => {
    expect(enlaces(enlazarDescripcion('HTTPS://X.COM/A'))).toEqual(['https://x.com/A']);
  });

  it('respeta los saltos de línea tal como vinieron', () => {
    const trozos = enlazarDescripcion('Primero\nhttps://x.com/a\n\nDespués');
    expect(trozos).toEqual([
      { tipo: 'texto', texto: 'Primero\n' },
      { tipo: 'enlace', texto: 'https://x.com/a', href: 'https://x.com/a' },
      { tipo: 'texto', texto: '\n\nDespués' },
    ]);
  });

  /*
   * El centinela que pide la spec: `<script>` y una URL en la misma línea. Como no
   * hay HTML en ningún paso, la afirmación es sobre los trozos: el `<script>`
   * viaja como texto —que Astro escapa al pintarlo— y ningún `href` ni ningún
   * texto de enlace lleva un `<`, un `>` ni una comilla.
   */
  it('el centinela: `<script>` y una URL en la misma línea no producen HTML', () => {
    const texto = '<script>alert(1)</script> https://x.com/a"><img src=x onerror=alert(1)>';
    const trozos = enlazarDescripcion(texto);
    expect(unido(trozos)).toBe(texto);
    const soloEnlaces = trozos.filter((t) => t.tipo === 'enlace');
    expect(soloEnlaces).toHaveLength(1);
    for (const t of soloEnlaces) {
      expect(t.texto).not.toMatch(/[<>"]/);
      if (t.tipo === 'enlace') expect(t.href).not.toMatch(/[<>"]/);
    }
    expect(trozos[0]).toEqual({ tipo: 'texto', texto: '<script>alert(1)</script> ' });
  });

  it('un `<` en el medio corta la URL', () => {
    const trozos = enlazarDescripcion('https://x.com/a<script>');
    expect(trozos.find((t) => t.tipo === 'enlace')?.texto).toBe('https://x.com/a');
  });

  it('dos URLs en la misma línea son dos enlaces', () => {
    expect(enlaces(enlazarDescripcion('https://a.com y https://b.com/c'))).toEqual([
      'https://a.com/',
      'https://b.com/c',
    ]);
  });
});

describe('el link de la reunión no sale', () => {
  it.each([
    'https://zoom.us/j/8412345678?pwd=aB3',
    'zoom.us/j/8412345678?pwd=aB3',
    'https://us02web.zoom.us/j/123',
    'meet.google.com/abc-defg-hij',
    'https://meet.google.com/abc-defg-hij',
    'https://teams.microsoft.com/l/meetup-join/xyz',
    'https://meet.jit.si/TallerDeVoz',
    'https://whereby.com/club',
    'https://discord.gg/abc',
  ])('ni enlazado ni como texto: %s', (link) => {
    const trozos = enlazarDescripcion(`Nos vemos en ${link}. ¡Traé mate!`);
    expect(unido(trozos)).not.toContain(link);
    expect(enlaces(trozos)).toEqual([]);
    expect(unido(trozos)).toBe(`Nos vemos en ${AVISO_DE_REUNION}. ¡Traé mate!`);
  });

  it('con puntuación pegada: paréntesis, dos puntos y comillas', () => {
    expect(sinLinksDeReunion('(zoom.us/j/1)')).toBe(`(${AVISO_DE_REUNION})`);
    expect(sinLinksDeReunion('Virtual:meet.google.com/abc')).toBe(AVISO_DE_REUNION);
    expect(sinLinksDeReunion('«meet.google.com/abc»')).toBe(`«${AVISO_DE_REUNION}»`);
  });

  it('un `online.url` de una plataforma desconocida también se saca', () => {
    const conocidos = ['https://bbb.miescuela.edu.ar/b/tal-ler'];
    const texto = 'Entrá a https://bbb.miescuela.edu.ar/b/tal-ler/ el martes';
    expect(sinLinksDeReunion(texto, conocidos)).toBe(`Entrá a ${AVISO_DE_REUNION} el martes`);
    expect(sinLinksDeReunion('Entrá a bbb.miescuela.edu.ar/b/tal-ler', conocidos)).toBe(
      `Entrá a ${AVISO_DE_REUNION}`,
    );
    expect(enlaces(enlazarDescripcion(texto, conocidos))).toEqual([]);
  });

  it('un link que no es de reunión pasa intacto', () => {
    const texto = 'Más en https://instagram.com/casabrandon';
    expect(sinLinksDeReunion(texto, ['https://bbb.miescuela.edu.ar/b/x'])).toBe(texto);
  });

  /*
   * La lista de hosts es una copia de la de `schema.ts`, que no se exporta. Si una
   * plataforma nueva entra allá y no acá, el link pasaría el schema de las
   * etiquetas pero saldría pegado en la descripción.
   */
  it('reconoce los mismos hosts que `schema.ts`', () => {
    const literal = (archivo: string) =>
      /const HOSTS_DE_REUNION =\s*(\/[^\n]+\/i);/.exec(readFileSync(archivo, 'utf8'))?.[1];
    const deSchema = literal('src/lib/schema.ts');
    expect(deSchema).toBeTruthy();
    expect(literal('src/lib/descripcionEnlazada.ts')).toBe(deSchema);
  });
});
