import { describe, expect, it } from 'vitest';
import {
  CLASES_DE_AVISO,
  DIAS_ESPERANDO,
  DIAS_PROXIMOS,
  MINIMO_DESCRIPCION,
  estadoDelCatalogo,
  porcentaje,
  type ClaseDeAviso,
} from '@/lib/estadoDelCatalogo';
// Se importan los otros dos módulos a propósito: lo que estos tests atan es que
// el tablero no tenga su propia derivación de «¿ya pasó?» ni de «¿falta el
// flyer?». Si divergen, el tablero contradice al listado y nada falla.
import { tieneFuturo } from '@/lib/filtrosActividades';
import { faltaElFlyer } from '@/lib/imagenes';
import { construirEvento } from '@/lib/analytics-eventos';
import { ESTADOS, MODALIDADES, type ActividadConId, type Sesion } from '@/types/actividad';
import { CENTINELAS } from './fixtures/formulario';
import { ts } from './fixtures/tiempo';

/**
 * El tablero «Estado del catálogo» — B-370, D-200.
 *
 * Lo que estos tests cuidan, en orden de importancia:
 *
 * 1. **Los avisos señalan lo que dicen señalar**, con el caso justo del borde
 *    (una inscripción que cierra hoy a la tarde no cerró).
 * 2. **No hay una segunda derivación** de «¿ya pasó?» ni de «¿falta el flyer?»:
 *    el tablero y el listado del panel contestan siempre lo mismo.
 * 3. **El orden es determinístico.** `listarActividades()` no garantiza el orden
 *    de llegada, así que un reparto sin desempate se reordena solo entre dos
 *    recargas del tablero.
 * 4. **Nada de lo que el tablero ve llega a la analítica.** Es la pantalla que
 *    tiene los 46 títulos en la mano; el único evento que dispara lleva un
 *    entero.
 */

const DOS_HORAS = 2 * 60 * 60 * 1000;

const sesion = (inicioIso: string, over: Partial<Sesion> = {}): Sesion =>
  ({
    id: `ses_${inicioIso}`,
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    ...over,
    inicio: ts(inicioIso),
    // Dos horas y no cero: con `fin === inicio` los dos criterios de «ya pasó»
    // son indistinguibles y el fixture dejaría de ejercitar el caso (B-84).
    fin: over.fin ?? ts(new Date(new Date(inicioIso).getTime() + DOS_HORAS).toISOString()),
  }) as unknown as Sesion;

/** Una actividad publicada y completa: el punto de partida sin ningún aviso. */
const acto = (over: Partial<ActividadConId> & { id: string }): ActividadConId =>
  ({
    titulo: over.id,
    tipo: 'taller',
    estado: 'publicado',
    esCiclo: false,
    modalidad: 'presencial',
    modalidades: [{ id: 'mod_1', modalidad: 'presencial', inicio: null, fin: null, sede: null, online: null }],
    sede: null,
    online: null,
    sesiones: [],
    tags: ['escritura'],
    imagenes: [{ id: 'img_1', url: 'https://ejemplo.test/flyer.jpg', epigrafe: '', origen: 'externa', portada: true }],
    descripcion: 'x'.repeat(MINIMO_DESCRIPCION),
    arancel: { tipo: 'gratis', notas: '' },
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null, completo: false },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    updatedAt: ts('2026-09-02T12:00:00Z'),
    createdAt: ts('2026-09-02T12:00:00Z'),
    ...over,
  }) as unknown as ActividadConId;

const AHORA = new Date('2026-09-02T12:00:00Z');

/** Las clases de aviso que se disparan, sin las cantidades. */
const clases = (actividades: ActividadConId[], ahora = AHORA): ClaseDeAviso[] =>
  estadoDelCatalogo(actividades, ahora).avisos.map((a) => a.clase);

const aviso = (actividades: ActividadConId[], clase: ClaseDeAviso, ahora = AHORA) =>
  estadoDelCatalogo(actividades, ahora).avisos.find((a) => a.clase === clase);

// ─────────────────────────────────────────────────────────────────
// Los avisos
// ─────────────────────────────────────────────────────────────────

describe('el aviso de la inscripción cerrada — el peor de los seis', () => {
  const conFuturo = [sesion('2026-09-20T19:00:00Z')];

  it('señala una publicada con encuentros por venir cuya inscripción ya cerró', () => {
    const a = acto({
      id: 'cerrada',
      sesiones: conFuturo,
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: CENTINELAS.mailInscripcion,
        cupo: null,
        cierra: ts('2026-08-30T12:00:00Z'),
        completo: false,
      },
    });
    expect(aviso([a], 'inscripcion-cerrada')?.actividades).toEqual([
      { id: 'cerrada', titulo: 'cerrada' },
    ]);
  });

  it('NO la señala si la inscripción cierra más tarde hoy mismo', () => {
    // El borde que importa: «cierra el 2 de septiembre» no es «cerró».
    const a = acto({
      id: 'cierra-hoy',
      sesiones: conFuturo,
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: 'x@y.test',
        cupo: null,
        cierra: ts('2026-09-02T23:59:00Z'),
        completo: false,
      },
    });
    expect(clases([a])).not.toContain('inscripcion-cerrada');
  });

  it('NO la señala si ya no le quedan encuentros: ahí el problema es otro', () => {
    const a = acto({
      id: 'paso-y-cerrada',
      sesiones: [sesion('2026-08-01T19:00:00Z')],
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: 'x@y.test',
        cupo: null,
        cierra: ts('2026-07-20T12:00:00Z'),
        completo: false,
      },
    });
    expect(clases([a])).toContain('ya-paso');
    expect(clases([a])).not.toContain('inscripcion-cerrada');
  });

  it('NO la señala si la actividad no pide inscripción', () => {
    // Una fecha de cierre olvidada en una actividad sin inscripción no le hace
    // perder nada a nadie: el sitio no ofrece anotarse.
    const a = acto({
      id: 'sin-inscripcion',
      sesiones: conFuturo,
      inscripcion: {
        requiere: false,
        via: null,
        destino: '',
        cupo: null,
        cierra: ts('2026-08-01T12:00:00Z'),
        completo: false,
      },
    });
    expect(clases([a])).not.toContain('inscripcion-cerrada');
  });

  it('NO la señala por estar completa — eso es lo que B-97 decidió', () => {
    // «Se llenó» y el canal sigue visible es el comportamiento correcto: siempre
    // hay lista de espera. Si esto entrara al aviso, una decisión tomada
    // aparecería como un problema a resolver.
    const a = acto({
      id: 'completa',
      sesiones: conFuturo,
      inscripcion: {
        requiere: true,
        via: 'dm',
        destino: '@x',
        cupo: 10,
        cierra: null,
        completo: true,
      },
    });
    expect(clases([a])).not.toContain('inscripcion-cerrada');
  });

  it('solo mira las publicadas: un borrador con la inscripción vencida no está en el sitio', () => {
    const a = acto({
      id: 'borrador',
      estado: 'borrador',
      sesiones: conFuturo,
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: 'x@y.test',
        cupo: null,
        cierra: ts('2026-08-01T12:00:00Z'),
        completo: false,
      },
    });
    expect(clases([a])).not.toContain('inscripcion-cerrada');
  });
});

describe('el aviso de «ya pasó y sigue publicada»', () => {
  it('señala una publicada sin encuentros por venir', () => {
    const a = acto({ id: 'vieja', sesiones: [sesion('2026-08-01T19:00:00Z')] });
    expect(clases([a])).toContain('ya-paso');
  });

  it('NO señala una publicada que todavía no tiene ningún encuentro cargado', () => {
    // Esa está a medio cargar, no «ya pasó». Decir que pasó algo que nunca tuvo
    // fecha es un aviso que enseña a desconfiar del tablero.
    const a = acto({ id: 'sin-fechas', sesiones: [] });
    expect(clases([a])).not.toContain('ya-paso');
  });

  it('usa el mismo criterio que el listado del panel, no uno propio', () => {
    // Durante las dos horas de un taller de 19 a 21, a las 19:30, todavía se
    // puede entrar: `proximaVentana` descarta por el fin. Si el tablero usara el
    // inicio, diría «ya pasó» de algo que el listado muestra arriba.
    const enCurso = acto({ id: 'en-curso', sesiones: [sesion('2026-09-02T11:30:00Z')] });
    expect(tieneFuturo(enCurso, AHORA)).toBe(true);
    expect(clases([enCurso])).not.toContain('ya-paso');
    expect(estadoDelCatalogo([enCurso], AHORA).publicadas.conFuturo).toBe(1);
  });

  it('un encuentro cancelado no cuenta como futuro', () => {
    const a = acto({
      id: 'cancelado',
      sesiones: [sesion('2026-09-20T19:00:00Z', { cancelada: true })],
    });
    expect(clases([a])).toContain('ya-paso');
  });

  // D-270 — que siga publicada es lo esperado (archivo, §2.1 del CLAUDE.md),
  // así que este es el aviso menos accionable de los seis y va último. Si
  // alguien lo vuelve a poner arriba —por ejemplo al lado de
  // `inscripcion-cerrada`, que sí es una fricción real— este test lo dice.
  it('es el último de la lista de gravedad, no el segundo', () => {
    expect(CLASES_DE_AVISO[CLASES_DE_AVISO.length - 1]).toBe('ya-paso');
    expect(CLASES_DE_AVISO.indexOf('ya-paso')).toBeGreaterThan(
      CLASES_DE_AVISO.indexOf('inscripcion-cerrada'),
    );
  });

  // D-270 — el texto no puede volver a sonar a fricción: una actividad que
  // pasó y sigue publicada es el comportamiento correcto, no algo roto.
  it('el texto no alarma: dice que es lo esperado y cuál es la única excepción accionable', () => {
    const a = acto({ id: 'vieja', sesiones: [sesion('2026-08-01T19:00:00Z')] });
    const av = aviso([a], 'ya-paso');
    expect(av?.porque).toMatch(/es lo esperado/i);
    expect(av?.porque).toMatch(/ciclo que vuelve/i);
    expect(av?.porque).not.toMatch(/ya pasaron y siguen figurando/i);
  });
});

describe('los avisos de completitud', () => {
  it('señala la publicada sin imagen, con el mismo criterio que la cartelera', () => {
    // Una fila con la URL en blanco existe en el array y no pinta nada: es el
    // caso que `faltaElFlyer` resuelve, y por eso se importa en vez de escribir
    // «la lista está vacía».
    const enBlanco = [
      { id: 'img_1', url: '   ', epigrafe: '', origen: 'externa' as const, portada: true },
    ];
    const a = acto({ id: 'sin-flyer', imagenes: enBlanco, sesiones: [sesion('2026-09-20T19:00:00Z')] });
    expect(faltaElFlyer(enBlanco)).toBe(true);
    expect(clases([a])).toContain('sin-flyer');
    expect(estadoDelCatalogo([a], AHORA).publicadas.conFlyer).toBe(0);
  });

  it('lee la galería con el default de los documentos viejos (D-125)', () => {
    // Los documentos anteriores a B-167 tienen `imagenUrl` y no `imagenes`.
    // Sin `imagenesDe`, el tablero los reportaría a todos como «sin imagen».
    const viejo = acto({
      id: 'viejo',
      imagenes: undefined,
      imagenUrl: 'https://ejemplo.test/vieja.jpg',
      sesiones: [sesion('2026-09-20T19:00:00Z')],
    } as Partial<ActividadConId> & { id: string });
    expect(clases([viejo])).not.toContain('sin-flyer');
    expect(estadoDelCatalogo([viejo], AHORA).publicadas.conFlyer).toBe(1);
  });

  it('señala la publicada sin etiquetas', () => {
    const a = acto({ id: 'sin-tags', tags: [], sesiones: [sesion('2026-09-20T19:00:00Z')] });
    expect(clases([a])).toContain('sin-etiquetas');
  });

  it('señala la descripción corta y respeta el borde exacto del umbral', () => {
    const futuro = [sesion('2026-09-20T19:00:00Z')];
    const justo = acto({
      id: 'justo',
      descripcion: 'x'.repeat(MINIMO_DESCRIPCION),
      sesiones: futuro,
    });
    const unaMenos = acto({
      id: 'una-menos',
      descripcion: 'x'.repeat(MINIMO_DESCRIPCION - 1),
      sesiones: futuro,
    });
    expect(clases([justo])).not.toContain('descripcion-corta');
    expect(clases([unaMenos])).toContain('descripcion-corta');
  });

  it('no cuenta los espacios como descripción', () => {
    const a = acto({
      id: 'espacios',
      descripcion: `  ${'x'.repeat(MINIMO_DESCRIPCION - 1)}  `,
      sesiones: [sesion('2026-09-20T19:00:00Z')],
    });
    expect(clases([a])).toContain('descripcion-corta');
  });
});

describe('el aviso de lo que quedó esperando', () => {
  const viejo = ts('2026-07-01T12:00:00Z');
  const reciente = ts('2026-09-01T12:00:00Z');

  it('señala un borrador y un pendiente sin tocarse hace más del plazo', () => {
    const b = acto({ id: 'b', estado: 'borrador', updatedAt: viejo });
    const p = acto({ id: 'p', estado: 'pendiente', updatedAt: viejo });
    expect(aviso([b, p], 'esperando')?.actividades.map((a) => a.id)).toEqual(['b', 'p']);
  });

  it('respeta el borde del plazo', () => {
    const alFilo = ts(
      new Date(AHORA.getTime() - DIAS_ESPERANDO * 24 * 60 * 60 * 1000 + 1000).toISOString(),
    );
    const a = acto({ id: 'al-filo', estado: 'borrador', updatedAt: alFilo });
    expect(clases([a])).not.toContain('esperando');
  });

  it('no señala un borrador recién tocado, ni una publicada vieja', () => {
    const b = acto({ id: 'b', estado: 'borrador', updatedAt: reciente });
    const pub = acto({ id: 'pub', estado: 'publicado', updatedAt: viejo, sesiones: [sesion('2026-09-20T19:00:00Z')] });
    expect(clases([b, pub])).not.toContain('esperando');
  });

  it('un borrador sin `updatedAt` legible no se señala: no se puede saber de cuándo es', () => {
    const a = acto({ id: 'sin-fecha', estado: 'borrador', updatedAt: undefined } as Partial<ActividadConId> & { id: string });
    expect(clases([a])).not.toContain('esperando');
  });
});

describe('la forma de la lista de avisos', () => {
  it('solo devuelve los avisos que tienen al menos una actividad', () => {
    const impecable = acto({ id: 'ok', sesiones: [sesion('2026-09-20T19:00:00Z')] });
    expect(estadoDelCatalogo([impecable], AHORA).avisos).toEqual([]);
  });

  it('los devuelve en el orden de gravedad de CLASES_DE_AVISO, no por cantidad', () => {
    // Tres actividades sin etiquetas y una con la inscripción cerrada: la de
    // arriba tiene que ser la que le hace perder algo a alguien de afuera.
    const cerrada = acto({
      id: 'cerrada',
      sesiones: [sesion('2026-09-20T19:00:00Z')],
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: 'x@y.test',
        cupo: null,
        cierra: ts('2026-08-01T12:00:00Z'),
        completo: false,
      },
    });
    const sinTags = [1, 2, 3].map((n) =>
      acto({ id: `t${n}`, tags: [], sesiones: [sesion('2026-09-20T19:00:00Z')] }),
    );
    const orden = clases([...sinTags, cerrada]);
    expect(orden.indexOf('inscripcion-cerrada')).toBeLessThan(orden.indexOf('sin-etiquetas'));
    expect(orden).toEqual(CLASES_DE_AVISO.filter((c) => orden.includes(c)));
  });

  it('cada aviso dice qué cuesta, y no solo qué pasa', () => {
    // El «por qué» es la mitad que hace que el aviso se atienda. Si vive en el
    // componente, un aviso nuevo puede quedar sin explicación y nada falla.
    const a = acto({ id: 'sin-tags', tags: [], sesiones: [sesion('2026-09-20T19:00:00Z')] });
    for (const av of estadoDelCatalogo([a], AHORA).avisos) {
      expect(av.titulo.length).toBeGreaterThan(10);
      expect(av.porque.length).toBeGreaterThan(10);
    }
  });

  it('las actividades de un aviso van ordenadas por título', () => {
    const futuro = [sesion('2026-09-20T19:00:00Z')];
    const lista = ['Zaraza', 'Ábaco', 'Mesa'].map((titulo) =>
      acto({ id: titulo, titulo, tags: [], sesiones: futuro }),
    );
    expect(aviso(lista, 'sin-etiquetas')?.actividades.map((a) => a.titulo)).toEqual([
      'Ábaco',
      'Mesa',
      'Zaraza',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────
// Los repartos
// ─────────────────────────────────────────────────────────────────

describe('los repartos', () => {
  const futuro = [sesion('2026-09-20T19:00:00Z')];

  it('el estado va en el orden del modelo y sin los que no existen', () => {
    const lista = [
      acto({ id: 'a', estado: 'publicado', sesiones: futuro }),
      acto({ id: 'b', estado: 'borrador' }),
      acto({ id: 'c', estado: 'borrador' }),
    ];
    expect(estadoDelCatalogo(lista, AHORA).porEstado).toEqual([
      { valor: 'borrador', cantidad: 2 },
      { valor: 'publicado', cantidad: 1 },
    ]);
    // Y el orden es el del modelo, no el de las cantidades: `borrador` va
    // primero porque es el primero de `ESTADOS`, y da 2 por casualidad.
    expect(ESTADOS[0]).toBe('borrador');
  });

  it('el tipo y el arancel van por cantidad, con desempate alfabético', () => {
    // Sin el desempate, dos tipos con la misma cantidad se ordenarían por el
    // orden de llegada de `listarActividades()`, que no está garantizado: el
    // tablero se reordenaría solo entre dos recargas.
    const lista = [
      acto({ id: '1', tipo: 'encuentro', sesiones: futuro }),
      acto({ id: '2', tipo: 'taller', sesiones: futuro }),
      acto({ id: '3', tipo: 'club-lectura', sesiones: futuro }),
      acto({ id: '4', tipo: 'club-lectura', sesiones: futuro }),
    ];
    expect(estadoDelCatalogo(lista, AHORA).porTipo).toEqual([
      { valor: 'club-lectura', cantidad: 2 },
      { valor: 'encuentro', cantidad: 1 },
      { valor: 'taller', cantidad: 1 },
    ]);
    // Y el resultado no depende del orden de entrada.
    expect(estadoDelCatalogo([...lista].reverse(), AHORA).porTipo).toEqual(
      estadoDelCatalogo(lista, AHORA).porTipo,
    );
  });

  it('un arancel vacío no inventa una tajada', () => {
    const a = acto({ id: 'a', arancel: { tipo: '', notas: '' }, sesiones: futuro });
    expect(estadoDelCatalogo([a], AHORA).porArancel).toEqual([]);
  });

  it('cada actividad cuenta en cada forma que ofrece (B-224)', () => {
    // Una con una fila presencial y otra virtual cuenta en las tres, igual que
    // en el desplegable del listado: las tres cosas son ciertas de ella.
    const dosFilas = acto({
      id: 'dos',
      modalidad: 'hibrido',
      modalidades: [
        { id: 'm1', modalidad: 'presencial', inicio: null, fin: null, sede: null, online: null },
        { id: 'm2', modalidad: 'virtual', inicio: null, fin: null, sede: null, online: null },
      ],
      sesiones: futuro,
    });
    const reparto = estadoDelCatalogo([dosFilas], AHORA).porModalidad;
    expect(reparto).toEqual([
      { valor: 'presencial', cantidad: 1 },
      { valor: 'virtual', cantidad: 1 },
      { valor: 'hibrido', cantidad: 1 },
    ]);
    // El orden es el del modelo, y las cantidades suman más que el total: es la
    // consecuencia que la pantalla tiene que decir.
    expect(reparto.map((t) => t.valor)).toEqual(
      (MODALIDADES as readonly string[]).filter((m) => reparto.some((t) => t.valor === m)),
    );
    expect(reparto.reduce((n, t) => n + t.cantidad, 0)).toBeGreaterThan(1);
  });

  it('lee la modalidad de los documentos anteriores a B-224', () => {
    const viejo = acto({
      id: 'viejo',
      modalidad: 'virtual',
      modalidades: undefined,
      sesiones: futuro,
    } as Partial<ActividadConId> & { id: string });
    expect(estadoDelCatalogo([viejo], AHORA).porModalidad).toEqual([
      { valor: 'virtual', cantidad: 1 },
    ]);
  });
});

describe('las cuentas de encuentros', () => {
  it('cuenta los que pueden pasar, y no los de una actividad cancelada', () => {
    const viva = acto({
      id: 'viva',
      sesiones: [sesion('2026-09-05T19:00:00Z'), sesion('2026-12-01T19:00:00Z')],
    });
    const muerta = acto({
      id: 'muerta',
      estado: 'cancelado',
      sesiones: [sesion('2026-09-06T19:00:00Z')],
    });
    const { encuentros } = estadoDelCatalogo([viva, muerta], AHORA);
    expect(encuentros.total).toBe(2);
    expect(encuentros.porVenir).toBe(2);
    // Diciembre queda fuera de la ventana de los próximos días.
    expect(encuentros.enLosProximosDias).toBe(1);
    expect(DIAS_PROXIMOS).toBe(30);
  });

  it('no cuenta un encuentro cancelado dentro de una actividad viva', () => {
    const a = acto({
      id: 'a',
      sesiones: [
        sesion('2026-09-05T19:00:00Z'),
        sesion('2026-09-06T19:00:00Z', { cancelada: true }),
      ],
    });
    expect(estadoDelCatalogo([a], AHORA).encuentros.total).toBe(1);
  });

  it('un encuentro en curso cuenta como por venir', () => {
    const a = acto({ id: 'a', sesiones: [sesion('2026-09-02T11:30:00Z')] });
    expect(estadoDelCatalogo([a], AHORA).encuentros.porVenir).toBe(1);
  });

  it('cuenta ciclos y sueltas por separado', () => {
    const lista = [
      acto({ id: 'c', esCiclo: true, sesiones: [sesion('2026-09-20T19:00:00Z')] }),
      acto({ id: 's', esCiclo: false, sesiones: [sesion('2026-09-20T19:00:00Z')] }),
    ];
    const e = estadoDelCatalogo(lista, AHORA);
    expect(e.ciclos).toBe(1);
    expect(e.sueltas).toBe(1);
    expect(e.ciclos + e.sueltas).toBe(e.total);
  });
});

describe('el catálogo vacío', () => {
  it('no rompe y no inventa nada', () => {
    const e = estadoDelCatalogo([], AHORA);
    expect(e).toMatchObject({
      total: 0,
      porEstado: [],
      porTipo: [],
      porArancel: [],
      porModalidad: [],
      avisos: [],
      ciclos: 0,
      sueltas: 0,
    });
    expect(e.encuentros).toEqual({ total: 0, porVenir: 0, enLosProximosDias: 0 });
    expect(e.publicadas.total).toBe(0);
  });

  it('el porcentaje de una parte sobre cero es cero y no NaN', () => {
    // Un catálogo vacío tiene que dibujar barras de cero, no romper la pantalla
    // con un `width: NaN%`.
    expect(porcentaje(0, 0)).toBe(0);
    expect(porcentaje(3, 0)).toBe(0);
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(3, 3)).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────
// Privacidad
// ─────────────────────────────────────────────────────────────────

describe('el tablero no se lleva nada a la analítica', () => {
  it('`estadisticas-abrir` manda un entero, y un título metido de prepo no sobrevive', () => {
    // Es la pantalla que tiene los títulos de todo el catálogo en la mano, así
    // que es la que más fácil los mandaría por descuido. `funcion_usada` no
    // tiene ningún parámetro de texto libre: `detalle` es un enum cerrado.
    const evento = construirEvento('funcion_usada', {
      funcion: 'estadisticas-abrir',
      detalle: CENTINELAS.titulo,
      valor: 46,
    });
    expect(evento).not.toBeNull();
    expect(evento!.params.funcion).toBe('estadisticas-abrir');
    expect(evento!.params.valor).toBe(46);
    expect(evento!.params.detalle).toBe('otro');
    expect(JSON.stringify(evento)).not.toContain(CENTINELAS.titulo);
  });

  it('los avisos llevan el título, y eso se queda en la pantalla del panel', () => {
    // El título es lo que hace que el aviso se pueda atender, y el panel es
    // privado (`noIndex`, tras el claim `admin`). Lo que este test fija es la
    // frontera: la señal lleva `id` y `titulo` **y nada más** — ni el destino de
    // la inscripción, ni el link de la reunión, ni el uid de quien la cargó.
    const a = acto({
      id: 'x',
      titulo: CENTINELAS.titulo,
      tags: [],
      sesiones: [sesion('2026-09-20T19:00:00Z')],
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: CENTINELAS.mailInscripcion,
        cupo: null,
        cierra: null,
        completo: false,
      },
      difusion: { arrobar: [CENTINELAS.handle], notas: CENTINELAS.notasInternas },
      createdBy: CENTINELAS.uid,
      updatedBy: CENTINELAS.uid,
    } as Partial<ActividadConId> & { id: string });

    const senalada = aviso([a], 'sin-etiquetas')!.actividades[0]!;
    expect(Object.keys(senalada).sort()).toEqual(['id', 'titulo']);
    const serializado = JSON.stringify(estadoDelCatalogo([a], AHORA));
    for (const fuera of [
      CENTINELAS.mailInscripcion,
      CENTINELAS.notasInternas,
      CENTINELAS.handle,
      CENTINELAS.uid,
      CENTINELAS.descripcion,
    ]) {
      expect(serializado).not.toContain(fuera);
    }
    // Control negativo: el título sí está, así que el barrido de arriba mira un
    // objeto que de verdad contiene texto de la actividad.
    expect(serializado).toContain(CENTINELAS.titulo);
  });
});
