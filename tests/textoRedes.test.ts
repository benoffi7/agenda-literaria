/**
 * B-95 — el texto para publicar en redes.
 *
 * Es una función pura, así que se cubre entera y sin emuladores
 * (`docs/05-patrones.md`): las dos variantes, la deduplicación de handles, el
 * ciclo, el encuentro cancelado, la actividad virtual y —lo que no se puede
 * equivocar— las reglas de privacidad del §5.1.
 *
 * **Los tests de privacidad van con centinelas.** No se confía en leer el código
 * y creerle: se carga el formulario con valores inventados y reconocibles
 * (`tests/fixtures/formulario.ts`) y se busca cada uno en el texto que salió. Es
 * el mismo truco del ICS del calendario y de la analítica: un campo nuevo que se
 * cuele al posteo tiene que romper acá, sin que nadie se acuerde de agregar un
 * chequeo.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { agregarChips } from '@/lib/formulario/chips';
import {
  AYUDA_VARIANTE,
  ETIQUETA_VARIANTE,
  VARIANTES_REDES,
  construirTextoRedes,
  textoRedesDeForm,
  type ActividadParaRedes,
  type VarianteRedes,
} from '@/lib/textoRedes';
import { labelsDeOpciones } from '@/lib/vistaPreviaEvento';
// B-312 — el link del posteo se compara contra la **misma** función que lo
// produce, no contra una cadena escrita en el test: así el caso sigue siendo
// cierto el día que cambie `rutaCanonica`.
import { PREFIJO_ACTIVIDAD, SITIO, urlDeDetalle } from '@/lib/rutasPublicas';
import { CENTINELAS, VALORES_CENTINELA, formularioLleno } from './fixtures/formulario';
import type { ActividadForm, Sesion, ValorOpcion } from '@/types/actividad';
import { ts, tsDe } from './fixtures/tiempo';

// ─────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────

const opcion = (slug: string, label: string): ValorOpcion => ({
  slug,
  label,
  orden: 1,
  fijo: true,
  usos: 0,
});

const LABELS = labelsDeOpciones({
  arancel: [opcion('a-la-gorra', 'A la gorra')],
  tipo: [opcion('club-lectura', 'Club de lectura'), opcion('taller', 'Taller')],
  barrio: [opcion('villa-crespo', 'Villa Crespo')],
  plataforma: [opcion('zoom', 'Zoom')],
  tags: [opcion('narrativa', 'Narrativa')],
});




const DOS_HORAS_MS = 2 * 60 * 60 * 1000;

/**
 * Una sesión con **duración de verdad**: si no se pasa `fin`, dura dos horas.
 *
 * El default no puede caer en `inicio` (el fixture flojo de B-135/B-136, que
 * `tests/invariantes-de-ciclo.test.ts` detecta): acá importa de más, porque el
 * recordatorio elige el próximo encuentro descartando por el **fin** — con
 * duración cero, ese criterio sería indistinguible de descartar por el inicio y
 * el test que lo fija no probaría nada.
 */
const sesion = (
  o: { id: string; inicio: string; fin?: string } & Partial<Omit<Sesion, 'inicio' | 'fin'>>,
): Sesion => {
  const arranca = new Date(o.inicio);
  const termina = o.fin ? new Date(o.fin) : new Date(arranca.getTime() + DOS_HORAS_MS);
  return {
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    ...o,
    inicio: tsDe(arranca),
    fin: tsDe(termina),
  } as unknown as Sesion;
};

/** Las tres fechas están en hora UTC: 22:00Z es 19:00 en Buenos Aires. */
const TRES_ENCUENTROS = [
  sesion({
    id: 'ses_1',
    inicio: '2026-09-03T22:00:00Z',
    fin: '2026-09-04T00:00:00Z',
    tema: 'Los detectives salvajes, cap. 1-4',
    lectura: 'Bolaño, primera parte',
  }),
  sesion({
    id: 'ses_2',
    inicio: '2026-09-10T22:00:00Z',
    fin: '2026-09-11T00:00:00Z',
    tema: 'Segunda parte',
    lectura: 'Bolaño, cap. 5-9',
  }),
  sesion({
    id: 'ses_3',
    inicio: '2026-09-17T22:00:00Z',
    fin: '2026-09-18T00:00:00Z',
    tema: 'Cierre',
    lectura: 'Bolaño, últimos capítulos',
  }),
];

const act = (over: Partial<ActividadParaRedes> = {}): ActividadParaRedes =>
  ({
    tipo: 'club-lectura',
    titulo: 'Club de lectura latinoamericana',
    esCiclo: true,
    estado: 'publicado',
    sesiones: TRES_ENCUENTROS,
    modalidad: 'hibrido',
    sede: {
      nombre: 'Casa Brandon',
      direccion: 'Luis María Drago 236',
      barrio: 'villa-crespo',
      ciudad: 'CABA',
      indicaciones: 'Timbre 3B, tocar fuerte',
      geo: null,
    },
    online: { plataforma: 'zoom', url: 'https://zoom.us/j/999', urlPublica: false },
    inscripcion: {
      requiere: true,
      via: 'dm',
      destino: '@casabrandon',
      cupo: 12,
      cierra: ts('2026-09-01T15:00:00Z'),
      completo: false,
    },
    arancel: { tipo: 'a-la-gorra', notas: 'Dos cuotas, incluye el material' },
    organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: 'https://casabrandon.example' },
    tallerista: { nombre: 'María Moreno', bio: 'Cronista y ensayista.', instagram: 'mmoreno' },
    difusion: { arrobar: ['@CasaBrandon', 'editorialdelamona'], notas: 'coordinar con prensa' },
    ...over,
  }) as ActividadParaRedes;

/** Antes de que arranque el ciclo: es cuando se publica el anuncio. */
const ANTES = new Date('2026-08-25T12:00:00Z');
/** Después del segundo encuentro: el próximo es el tercero. */
const MEDIO = new Date('2026-09-11T18:00:00Z');

const texto = (
  a: ActividadParaRedes,
  variante: VarianteRedes = 'anuncio',
  ahora: Date = ANTES,
): string => {
  const r = construirTextoRedes(a, variante, ahora, LABELS);
  if (!r.ok) throw new Error(`esperaba texto y salió: ${r.motivo}`);
  return r.texto;
};

const motivo = (a: ActividadParaRedes, variante: VarianteRedes, ahora: Date): string => {
  const r = construirTextoRedes(a, variante, ahora, LABELS);
  if (r.ok) throw new Error(`esperaba un motivo y salió texto:\n${r.texto}`);
  return r.motivo;
};

// ─────────────────────────────────────────────────────────────────
// Variante «anuncio»
// ─────────────────────────────────────────────────────────────────

describe('anuncio — el ciclo entero (B-95)', () => {
  it('el texto completo, tal como se pega', () => {
    expect(texto(act())).toBe(
      [
        'Club de lectura latinoamericana',
        'Club de lectura · 3 encuentros',
        'Con María Moreno',
        '',
        'Cuándo:',
        '- jueves 3 de septiembre · 19:00',
        '- jueves 10 de septiembre · 19:00',
        '- jueves 17 de septiembre · 19:00',
        '',
        'Presencial y virtual',
        'Casa Brandon · Luis María Drago 236, Villa Crespo, CABA',
        'Por Zoom · el link se envía a quienes se inscriban',
        '',
        'Arancel: A la gorra',
        'Dos cuotas, incluye el material',
        '',
        'Inscripción por DM: @casabrandon',
        'Cupo: 12',
        'Se inscribe hasta el martes 1 de septiembre · 12:00',
        '',
        '@CasaBrandon @editorialdelamona @mmoreno',
      ].join('\n'),
    );
  });

  it('las fechas salen en orden cronológico aunque el array esté desordenado', () => {
    // El array de `sesiones` no tiene por qué estar ordenado (§7.4): el orden lo
    // pone `encuentrosDe`, la misma función que numera el "3 de 8" del panel.
    const desordenado = act({
      sesiones: [TRES_ENCUENTROS[2]!, TRES_ENCUENTROS[0]!, TRES_ENCUENTROS[1]!],
    });
    const lineas = texto(desordenado)
      .split('\n')
      .filter((l) => l.startsWith('- '));
    expect(lineas).toEqual([
      '- jueves 3 de septiembre · 19:00',
      '- jueves 10 de septiembre · 19:00',
      '- jueves 17 de septiembre · 19:00',
    ]);
  });

  it('un encuentro cancelado no se anuncia ni se cuenta (§7.3)', () => {
    // Listar su fecha es mandar gente un día que no hay nada, y decir "3
    // encuentros" arriba de dos fechas es un error de los que se leen.
    const conCancelado = act({
      sesiones: [
        TRES_ENCUENTROS[0]!,
        sesion({ id: 'ses_2', inicio: '2026-09-10T22:00:00Z', cancelada: true }),
        TRES_ENCUENTROS[2]!,
      ],
    });
    const salida = texto(conCancelado);
    expect(salida).toContain('2 encuentros');
    expect(salida).not.toContain('10 de septiembre');
    expect(salida.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(2);
  });

  it('una actividad de un solo encuentro no habla de encuentros', () => {
    const suelta = act({ esCiclo: false, sesiones: [TRES_ENCUENTROS[0]!], tipo: 'taller' });
    expect(texto(suelta)).toContain('Taller\n');
    expect(texto(suelta)).not.toContain('encuentros');
  });

  it('un ciclo al que le quedó una sola fecha tampoco', () => {
    // `esCiclo` sigue en true pero hay una sola fecha: "1 encuentros" no se dice.
    const unaSola = act({ sesiones: [TRES_ENCUENTROS[0]!] });
    expect(texto(unaSola)).not.toContain('encuentros');
  });

  it('sin ninguna fecha cargada no inventa un texto', () => {
    expect(motivo(act({ sesiones: [] }), 'anuncio', ANTES)).toMatch(/al menos un encuentro/);
  });

  it('con todos los encuentros cancelados tampoco', () => {
    const todos = act({
      sesiones: [sesion({ id: 'ses_1', inicio: '2026-09-03T22:00:00Z', cancelada: true })],
    });
    expect(motivo(todos, 'anuncio', ANTES)).toMatch(/al menos un encuentro/);
  });

  it('las fechas del ciclo se listan enteras aunque alguna ya pasó', () => {
    // Es lo contrario del cierre de inscripción, y a propósito: el anuncio
    // anuncia el ciclo, y las fechas de un ciclo son las que tiene.
    expect(texto(act(), 'anuncio', MEDIO)).toContain('- jueves 3 de septiembre · 19:00');
  });
});

// ─────────────────────────────────────────────────────────────────
// Variante «recordatorio»
// ─────────────────────────────────────────────────────────────────

describe('recordatorio — el próximo encuentro (B-95)', () => {
  it('el texto completo, tal como se pega', () => {
    expect(texto(act(), 'recordatorio', MEDIO)).toBe(
      [
        'Club de lectura latinoamericana',
        'Club de lectura · Encuentro 3 de 3 · jueves 17 de septiembre · 19:00',
        'Con María Moreno',
        '',
        'Tema: Cierre',
        'Lectura: Bolaño, últimos capítulos',
        '',
        'Presencial y virtual',
        'Casa Brandon · Luis María Drago 236, Villa Crespo, CABA',
        'Por Zoom · el link se envía a quienes se inscriban',
        '',
        'Arancel: A la gorra',
        'Dos cuotas, incluye el material',
        '',
        'Inscripción por DM: @casabrandon',
        'Cupo: 12',
        '',
        '@CasaBrandon @editorialdelamona @mmoreno',
      ].join('\n'),
    );
  });

  it('el tema y la lectura son del encuentro, no de la actividad', () => {
    const salida = texto(act(), 'recordatorio', new Date('2026-09-04T12:00:00Z'));
    expect(salida).toContain('Tema: Segunda parte');
    expect(salida).toContain('Lectura: Bolaño, cap. 5-9');
    expect(salida).not.toContain('Cierre');
  });

  it('un encuentro empezado sigue siendo el próximo: se descarta por el fin', () => {
    // Mismo criterio que el orden del listado y que el "ya pasó" del calendario:
    // un encuentro de 19 a 21, a las 19:30, todavía se puede anunciar.
    const enCurso = new Date('2026-09-10T22:30:00Z'); // 19:30 del segundo encuentro
    expect(texto(act(), 'recordatorio', enCurso)).toContain('Encuentro 2 de 3');
  });

  it('saltea el encuentro cancelado y toma el siguiente', () => {
    const conCancelado = act({
      sesiones: [
        TRES_ENCUENTROS[0]!,
        sesion({ id: 'ses_2', inicio: '2026-09-10T22:00:00Z', cancelada: true, tema: 'Segunda parte' }),
        TRES_ENCUENTROS[2]!,
      ],
    });
    const salida = texto(conCancelado, 'recordatorio', new Date('2026-09-04T12:00:00Z'));
    expect(salida).toContain('jueves 17 de septiembre');
    expect(salida).not.toContain('Segunda parte');
  });

  it('numera igual que el evento público y que el panel: cuenta los cancelados (D-95)', () => {
    // El número es la identidad del encuentro dentro del ciclo, no un recuento en
    // vivo: si acá dijera "2 de 2", el posteo hablaría de otro encuentro que el
    // que el calendario y el panel llaman "3 de 3".
    const conCancelado = act({
      sesiones: [
        TRES_ENCUENTROS[0]!,
        sesion({ id: 'ses_2', inicio: '2026-09-10T22:00:00Z', cancelada: true }),
        TRES_ENCUENTROS[2]!,
      ],
    });
    expect(texto(conCancelado, 'recordatorio', MEDIO)).toContain('Encuentro 3 de 3');
  });

  it('una actividad sin ciclo no numera nada', () => {
    const suelta = act({ esCiclo: false, sesiones: [TRES_ENCUENTROS[0]!] });
    expect(texto(suelta, 'recordatorio', ANTES)).not.toContain('Encuentro');
  });

  it('cuando no queda nada por venir lo dice y manda al anuncio', () => {
    const despues = new Date('2026-10-01T12:00:00Z');
    expect(motivo(act(), 'recordatorio', despues)).toMatch(/Anuncio/);
  });
});

// ─────────────────────────────────────────────────────────────────
// Dónde, arancel e inscripción
// ─────────────────────────────────────────────────────────────────

describe('dónde, arancel e inscripción', () => {
  it('una virtual no habla de sede y nombra la plataforma', () => {
    const virtual = act({ modalidad: 'virtual', sede: null });
    const salida = texto(virtual);
    expect(salida).toContain('Virtual\nPor Zoom · el link se envía a quienes se inscriban');
    expect(salida).not.toContain('Casa Brandon ·');
  });

  it('B-190 — la plataforma «a confirmar» no se nombra como si fuera una plataforma', () => {
    /*
     * MUTACIÓN PROBADA: sacar el `if (online.plataforma === 'a-confirmar')` y
     * dejar que caiga en `etiqueta(labels, 'plataforma', 'a-confirmar')` —
     * ese lookup no está en el fixture de este archivo, así que el des-slug
     * (`lib/vistaPreviaEvento.ts`/`etiqueta`) devuelve «A confirmar» igual, y
     * el texto sale «Por A confirmar · el link se envía a quienes se
     * inscriban», que se lee como si «A confirmar» fuera el nombre de una
     * plataforma. Con la guarda, cae al mismo genérico que sin plataforma.
     */
    const sinDecidir = act({
      modalidad: 'virtual',
      sede: null,
      online: { plataforma: 'a-confirmar', url: '', urlPublica: false },
    });
    const salida = texto(sinDecidir);
    expect(salida).toContain('Virtual\nEncuentro virtual · el link se envía a quienes se inscriban');
    expect(salida).not.toContain('A confirmar');
    expect(salida).not.toContain('a-confirmar');
  });

  it('una presencial no habla de plataforma', () => {
    const presencial = act({ modalidad: 'presencial', online: null });
    const salida = texto(presencial);
    expect(salida).toContain('Presencial\nCasa Brandon');
    expect(salida).not.toContain('Zoom');
  });

  it('el barrio se lee con su etiqueta y no con el slug (§4.1)', () => {
    expect(texto(act())).toContain('Villa Crespo');
    expect(texto(act())).not.toContain('villa-crespo');
  });

  it('un barrio que no está en /opciones cae al respaldo compartido, no al slug', () => {
    const otroBarrio = act({
      sede: { ...act().sede!, barrio: 'parque-chacabuco' },
    });
    expect(texto(otroBarrio)).toContain('Parque Chacabuco');
  });

  it('el barrio y la ciudad cargados iguales no se repiten', () => {
    const repetido = act({
      sede: { ...act().sede!, barrio: 'palermo', ciudad: 'Palermo' },
    });
    expect(texto(repetido)).toContain('Luis María Drago 236, Palermo\n');
  });

  it('el arancel sale con su etiqueta y sus notas tal cual', () => {
    expect(texto(act())).toContain('Arancel: A la gorra\nDos cuotas, incluye el material');
  });

  it('sin inscripción previa lo dice, y «se llenó» va solo y seco (D-127)', () => {
    const sinInscripcion = act({
      inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null, completo: true },
    });
    expect(texto(sinInscripcion)).toContain('Sin inscripción previa\nCupo completo');
  });

  it('el cupo completo no esconde el canal, va arriba y con el paréntesis (D-127)', () => {
    const completo = act({ inscripcion: { ...act().inscripcion, completo: true } });
    const salida = texto(completo);
    expect(salida).toContain(
      'Cupo completo (se puede escribir igual: puede liberarse un lugar)\nInscripción por DM: @casabrandon',
    );
  });

  it('el cierre de inscripción no sale si ya pasó', () => {
    // Un posteo del 11 que dice "se inscribe hasta el 1" no es un dato viejo: es
    // una instrucción falsa sobre qué hacer ahora.
    expect(texto(act(), 'anuncio', MEDIO)).not.toContain('Se inscribe hasta');
    expect(texto(act(), 'anuncio', ANTES)).toContain('Se inscribe hasta');
  });

  it('el libro presentado entra, con su autor si difiere del invitado (D-126)', () => {
    const presentacion = act({
      tipo: 'presentacion',
      libro: { titulo: 'Los detectives salvajes', autor: 'Roberto Bolaño' },
    });
    expect(texto(presentacion)).toContain('Libro: Los detectives salvajes — Roberto Bolaño');
  });

  it('un libro sin título no es un libro', () => {
    expect(texto(act({ libro: { titulo: '', autor: 'Alguien' } }))).not.toContain('Libro:');
    expect(texto(act({ libro: null }))).not.toContain('Libro:');
  });

  it('el nombre de quien está al frente sale; su bio no', () => {
    const salida = texto(act());
    expect(salida).toContain('Con María Moreno');
    expect(salida).not.toContain('Cronista y ensayista');
  });

  it('sin tallerista no queda una línea colgada', () => {
    expect(texto(act({ tallerista: null }))).toContain(
      'Club de lectura latinoamericana\nClub de lectura · 3 encuentros\n\nCuándo:',
    );
  });
});

// ─────────────────────────────────────────────────────────────────
// El pie de handles — para esto existe `difusion.arrobar`
// ─────────────────────────────────────────────────────────────────

describe('el pie de handles (B-95: el campo que no se usaba para nada)', () => {
  const pie = (a: ActividadParaRedes): string => texto(a).split('\n\n').at(-1)!;

  it('salen los de arrobar, después el organizador y después el tallerista', () => {
    expect(pie(act())).toBe('@CasaBrandon @editorialdelamona @mmoreno');
  });

  it('la misma cuenta escrita distinto sale una sola vez (B-133)', () => {
    // El caso real: el organizador ya estaba en «arrobar», con otras mayúsculas
    // y sin arroba. Tres formas de escribir la misma cuenta, un solo handle.
    const repetidos = act({
      difusion: { arrobar: ['casabrandon', '@CASABRANDON'], notas: '' },
      organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: '' },
      tallerista: { nombre: 'María Moreno', bio: '', instagram: 'CasaBrandon' },
    });
    expect(pie(repetidos)).toBe('@casabrandon');
  });

  it('la regla de duplicados es la de `agregarChips`, la misma con la que se cargó la lista', () => {
    // Se afirma la equivalencia, no la implementación: si el pie dejara de
    // delegar, este test cae en cuanto las dos ideas de "ya está" se separen.
    const escrituras = ['@CasaBrandon', 'casabrandon', 'CASABRANDON'];
    expect(agregarChips([], escrituras.join('\n'))).toHaveLength(1);
    const a = act({
      difusion: { arrobar: escrituras, notas: '' },
      organizador: { nombre: '', instagram: '', web: '' },
      tallerista: null,
    });
    expect(pie(a).split(' ')).toHaveLength(1);
  });

  it('le pone el arroba al handle pelado y no toca lo que no es un handle', () => {
    const variados = act({
      difusion: {
        arrobar: ['casabrandon', '@yatiene', 'https://instagram.com/casa', 'prensa@editorial.com', 'Casa Brandon'],
        notas: '',
      },
      organizador: { nombre: '', instagram: '', web: '' },
      tallerista: null,
    });
    expect(pie(variados)).toBe(
      '@casabrandon @yatiene https://instagram.com/casa prensa@editorial.com Casa Brandon',
    );
  });

  it('sin ningún handle no deja un bloque vacío al final', () => {
    const sinHandles = act({
      difusion: { arrobar: [], notas: 'coordinar con prensa' },
      organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
      tallerista: { nombre: 'María Moreno', bio: '', instagram: '' },
    });
    const salida = texto(sinHandles);
    expect(salida).not.toMatch(/\n\n$/);
    expect(salida.endsWith('Se inscribe hasta el martes 1 de septiembre · 12:00')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// Privacidad (§5.1) — con centinelas
// ─────────────────────────────────────────────────────────────────

describe('privacidad — un posteo es más público que las otras dos salidas (§5.1)', () => {
  it('el link de la reunión no sale, ni con `urlPublica: true` (§5.1, trampa 5)', () => {
    // El desvío de D-15 vale para el `events.json` y para el evento de Calendar,
    // donde el dueño tildó una casilla que dice qué hace. Un texto que se pega en
    // Instagram es más público que los dos: acá el link no sale nunca.
    const publicado = act({
      modalidad: 'virtual',
      sede: null,
      online: { plataforma: 'zoom', url: 'https://zoom.us/j/CENTINELA-999999', urlPublica: true },
    });
    for (const variante of VARIANTES_REDES) {
      const salida = texto(publicado, variante, ANTES);
      expect(salida).not.toContain('zoom.us');
      expect(salida).not.toContain('CENTINELA-999999');
      expect(salida).toContain('el link se envía a quienes se inscriban');
    }
  });

  it('las notas internas de difusión no salen; los handles de arrobar sí (§5.1, §3.2)', () => {
    const salida = texto(act());
    expect(salida).not.toContain('coordinar con prensa');
    expect(salida).toContain('@editorialdelamona');
  });

  it('el texto lleva el link a la página de la actividad, y sale de `urlDeDetalle` — B-312', () => {
    /*
     * **Este caso decía lo contrario hasta B-312**, y su comentario avisaba:
     * «cuando la página exista, este test es el que hay que cambiar a mano». La
     * página existe desde B-227 y el dominio se eligió en D-165, así que el
     * motivo del descarte —un link a la nada— caducó.
     *
     * Lo que se verifica no es que haya *un* link: es que sea **el que produce
     * `urlDeDetalle`**. Escrito a mano en el módulo sería la cuarta derivación de
     * la misma ruta y la única de la que no se puede volver, porque un posteo con
     * una URL rota ya está pegado en Instagram.
     *
     * MUTACIÓN PROBADA: componer la URL con una plantilla en `textoRedes.ts`
     * —aunque hoy dé la misma cadena— deja de pasar por esa función, y este caso
     * lo dice el día que cambie `rutaCanonica` (la barra final, por ejemplo).
     */
    const forma = formularioLleno({ estado: 'publicado' });
    const esperado = urlDeDetalle(forma.slug);
    for (const variante of VARIANTES_REDES) {
      expect(salidaDeForm(forma, variante, true)).toContain(esperado);
    }
  });

  it('el select en «publicado» NO alcanza: hace falta que la página exista — B-312', () => {
    /*
     * **La segunda vuelta del `auditor-privacidad`**, y el hallazgo más fino de
     * las dos pasadas. La corrección anterior miraba `actividad.estado`, que en
     * este camino es el **select del formulario sin guardar**
     * (`formADocumento` hace `estado: f.estado`). O sea que poner «Publicado» y
     * copiar el posteo antes de guardar emitía el link igual — con el slug
     * todavía re-derivándose del título, que es el agujero que la corrección
     * decía cerrar.
     *
     * Este caso es la diferencia entre las dos afirmaciones que se confundían:
     * «se quiere publicar» (el select) y «ya tiene página» (el documento).
     *
     * MUTACIÓN PROBADA: volver la guarda a `actividad.estado === 'publicado'`
     * deja este caso en rojo y el de arriba en verde, que es exactamente el
     * estado en el que el auditor lo encontró.
     */
    const forma = formularioLleno({ estado: 'publicado' });
    for (const variante of VARIANTES_REDES) {
      expect(salidaDeForm(forma, variante, false)).not.toContain(SITIO);
    }
  });

  it('un borrador NO emite el link: su slug todavía se mueve con el título — B-312', () => {
    /*
     * **Lo encontró el `auditor-privacidad`** sobre la primera versión de B-312,
     * que emitía el link siempre con el argumento de que «la página va a existir
     * cuando el posteo se publique». Dos contraejemplos mecánicos del propio
     * repo lo tiran abajo:
     *
     * 1. mientras `estado !== 'publicado'` el slug se **re-deriva del título con
     *    cada tecla** (`slugBloqueado` en `formulario/cascadas.ts`), y el
     *    borrador es justo cuando se copia el posteo;
     * 2. una actividad duplicada nace en borrador con slug `…-copia`, y el
     *    schema **prohíbe publicar con ese slug** — para esa clase la URL está
     *    garantizada de no existir jamás.
     *
     * El fixture es `borrador` por defecto, así que este caso es el que corre
     * con la forma tal cual sale de la fábrica.
     *
     * MUTACIÓN PROBADA: sacar `actividad.estado === 'publicado'` de la guarda
     * deja este caso y el de la cancelada en rojo.
     */
    for (const variante of VARIANTES_REDES) {
      expect(salidaDeForm(formularioLleno(), variante)).not.toContain(SITIO);
    }
  });

  it('una actividad cancelada tampoco: su página puede no existir nunca (B-110)', () => {
    /*
     * El tercer caso del auditor, y el más sutil: lo que frena a
     * `construirTextoRedes` es `sesion.cancelada`, **no** `estado`. Una
     * actividad `cancelado` con un encuentro futuro sin cancelar devuelve
     * `ok: true`; y por B-110 una cancelada solo tiene página si estuvo
     * publicada alguna vez, así que una que nunca se publicó llevaría a una
     * página que por diseño no va a existir.
     */
    for (const variante of VARIANTES_REDES) {
      const salida = salidaDeForm(formularioLleno({ estado: 'cancelado' }), variante);
      expect(salida).not.toContain(SITIO);
    }
  });

  it('el slug sale solo dentro del link, nunca como dato suelto — B-312', () => {
    /*
     * **Lo pidió el `auditor-privacidad`.** Con el centinela del slug permitido
     * en la lista de abajo, el barrido dejó de poder distinguir «salió dentro de
     * la URL» de «salió suelto»: un `bloques.push(\`Slug: ${'$'}{actividad.slug}\`)`
     * agregado mañana pasaría los otros casos sin que nada lo diga. La intención
     * está escrita en el `Pick` del módulo —«no se imprime»— y esto la ejecuta.
     */
    const forma = formularioLleno({ estado: 'publicado' });
    for (const variante of VARIANTES_REDES) {
      const salida = salidaDeForm(forma, variante, true);
      const partes = salida.split(forma.slug);
      expect(partes, 'el slug aparece más de una vez: alguna no es el link').toHaveLength(2);
      expect(partes[0]!.endsWith(`${SITIO}${PREFIJO_ACTIVIDAD}/`)).toBe(true);
    }
  });

  it('sin slug no hay link, y no queda un link a la home', () => {
    /*
     * Una actividad sin slug no tiene página. `urlDeDetalle('')` devolvería la
     * home, y mandar a la home a alguien que quería anotarse a un taller es peor
     * que no poner nada.
     */
    for (const variante of VARIANTES_REDES) {
      const salida = salidaDeForm(
        formularioLleno({ slug: '', estado: 'publicado' }),
        variante,
        true,
      );
      expect(salida).not.toContain(SITIO);
    }
  });

  /**
   * El barrido: se arma el texto desde el formulario lleno de centinelas y se
   * exige que **ningún** valor aparezca salvo los que están permitidos por
   * nombre. Un campo nuevo que entre al posteo sin pasar por esta lista rompe el
   * test, que es justo lo que se quiere: la decisión de publicarlo se toma acá.
   */
  const PERMITIDOS: string[] = [
    CENTINELAS.titulo, // es el título de la actividad
    CENTINELAS.tallerista, // «Con tal»: el dato que decide si alguien se anota
    CENTINELAS.sede, // el nombre de la sede es público
    CENTINELAS.direccion, // la dirección también (ya va al evento y al JSON)
    CENTINELAS.notasArancel, // "dos cuotas" se publica tal cual
    CENTINELAS.mailInscripcion, // §5.2 — el canal de inscripción sí sale
    CENTINELAS.handle, // §3.2 → el pie: para esto existe `arrobar`
    CENTINELAS.libro, // D-126 — en una presentación es el dato central
    CENTINELAS.autorDelLibro, // ídem, cuando difiere del invitado
    CENTINELAS.tema, // recordatorio: de este encuentro
    CENTINELAS.lectura, // ídem
  ];

  /**
   * Los permitidos **según haya link o no** — B-312, y lo pidió el
   * `auditor-privacidad` en su segunda pasada.
   *
   * El slug entra solo cuando la actividad ya tiene página, que es cuando sale
   * el link. Con una lista única para las dos corridas, el barrido del caso «sin
   * página» **permitía** el slug aunque ahí nada debería emitirlo: un
   * `bloques.push` del slug pelado condicionado a no-publicado habría pasado.
   *
   * El permiso en sí es correcto y está verificado: el slug ya es público en el
   * `events.json`, el sitemap y la canónica. Lo que esto arregla es que el
   * permiso diga **exactamente** lo que se decidió, y no un poco más.
   */
  const permitidosPara = (conPagina: boolean): string[] =>
    conPagina ? [...PERMITIDOS, CENTINELAS.slug] : PERMITIDOS;

  const salidaDeForm = (
    form: ActividadForm,
    variante: VarianteRedes,
    yaTienePagina = false,
  ): string => {
    const r = textoRedesDeForm(form, variante, ANTES, LABELS, yaTienePagina);
    if (!r.ok) throw new Error(`esperaba texto y salió: ${r.motivo}`);
    return r.texto;
  };

  /*
   * El barrido corre sobre **las dos formas**, y no solo sobre el borrador que
   * el fixture da por defecto: desde B-312 el link a la actividad existe **solo
   * con la actividad publicada**, así que un barrido que mirara únicamente el
   * borrador no vería nunca el bloque nuevo — que es justo el que agrega una
   * salida. Es la misma trampa que el fixture del §0: no se puede verificar lo
   * que el fixture no produce.
   */
  for (const variante of VARIANTES_REDES) {
    for (const conPagina of [false, true]) {
    it(`${variante} (${conPagina ? 'con página' : 'sin página'}) — ningún centinela sale sin estar permitido para ese caso (§5.1)`, () => {
      const salida = salidaDeForm(
        formularioLleno({
          estado: conPagina ? 'publicado' : 'borrador',
          // El caso peor: el link de la reunión **tildado como publicable**. El
          // desvío de D-15 vale para el JSON y el evento; a un posteo no llega.
          modalidades: [
            {
              id: 'mod_h',
              modalidad: 'hibrido',
              inicio: '',
              fin: '',
              sede: formularioLleno().modalidades[0]!.sede,
              online: { plataforma: 'zoom', url: CENTINELAS.linkReunion, urlPublica: true },
            },
          ],
        }),
        variante,
        conPagina,
      );
      for (const valor of VALORES_CENTINELA) {
        if (permitidosPara(conPagina).includes(valor)) continue;
        expect(salida, `se escapó un centinela al posteo: ${valor}`).not.toContain(valor);
      }
    });
    }
  }

  it('lo que sí tiene que salir, sale: el canal de inscripción y el handle de arrobar', () => {
    // La otra mitad del barrido. Sin esto, un texto vacío pasaría todos los
    // chequeos de privacidad de arriba.
    const salida = salidaDeForm(formularioLleno(), 'anuncio');
    expect(salida).toContain(CENTINELAS.mailInscripcion);
    expect(salida).toContain(CENTINELAS.handle);
    expect(salida).toContain(CENTINELAS.titulo);
  });

  it('el handle repetido en los tres campos del fixture sale una sola vez', () => {
    // `formularioLleno` carga el mismo centinela en `arrobar`, en
    // `organizador.instagram` y en `tallerista.instagram`.
    const salida = salidaDeForm(formularioLleno(), 'anuncio');
    expect(salida.split(CENTINELAS.handle)).toHaveLength(2);
  });

  it('el material y sus URLs no salen (§5.1)', () => {
    const salida = salidaDeForm(formularioLleno(), 'anuncio');
    expect(salida).not.toContain(CENTINELAS.urlMaterial);
    expect(salida).not.toContain(CENTINELAS.tituloMaterial);
  });

  it('las imágenes y sus epígrafes no salen: un texto no lleva imágenes (D-125)', () => {
    const salida = salidaDeForm(formularioLleno(), 'anuncio');
    expect(salida).not.toContain(CENTINELAS.imagen);
    expect(salida).not.toContain(CENTINELAS.epigrafeImagen);
  });

  it('el módulo no lee ningún campo que no esté declarado en `ActividadParaRedes`', () => {
    // Guarda de forma, no de instancia: la interfaz enumera lo que este texto
    // mira, así que un campo nuevo del §3.1 no puede colarse sin nombrarlo. Si
    // alguien la cambia por `Actividad` entera, esto rompe.
    const fuente = readFileSync(
      fileURLToPath(new URL('../src/lib/textoRedes.ts', import.meta.url)),
      'utf8',
    );
    expect(fuente).toContain('export type ActividadParaRedes = Pick<');
    for (const prohibido of ['imagenes', 'material', 'createdBy', 'updatedBy', 'searchText']) {
      expect(fuente).not.toContain(`| '${prohibido}'`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Desde el formulario
// ─────────────────────────────────────────────────────────────────

describe('textoRedesDeForm — el camino del panel', () => {
  it('una fecha a medio cargar no rompe: lo dice', () => {
    const aMedias = formularioLleno({
      sesiones: [
        { id: 'ses_1', inicio: '2026-09-03', fin: '', tema: '', lectura: '', cancelada: false, calendarEventId: null },
      ],
    });
    const r = textoRedesDeForm(aMedias, 'anuncio', ANTES, LABELS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/fechas/);
  });

  it('una sede que quedó cargada al pasar a virtual no sale (la cascada la aplica formADocumento)', () => {
    // El formulario conserva la sede al cambiar de modalidad, y es
    // `formADocumento` el que decide que no se escribe. Armar el texto desde el
    // formulario en crudo publicaría una dirección que la actividad no tiene.
    const virtual = formularioLleno({
      modalidades: [
        {
          ...formularioLleno().modalidades[0]!,
          modalidad: 'virtual',
          // La sede queda cargada en el formulario —la cascada agrega y no saca
          // hasta que se toca el selector—: es `formADocumento` el que decide
          // que no se escribe.
          online: { plataforma: 'zoom', url: CENTINELAS.linkReunion, urlPublica: false },
        },
      ],
    });
    const r = textoRedesDeForm(virtual, 'anuncio', ANTES, LABELS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.texto).not.toContain(CENTINELAS.direccion);
      expect(r.texto).not.toContain(CENTINELAS.sede);
    }
  });

  it('las dos variantes tienen etiqueta y ayuda, y no hay una tercera suelta', () => {
    expect(VARIANTES_REDES).toEqual(['anuncio', 'recordatorio']);
    for (const v of VARIANTES_REDES) {
      expect(ETIQUETA_VARIANTE[v]).toBeTruthy();
      expect(AYUDA_VARIANTE[v]).toBeTruthy();
    }
  });
});
