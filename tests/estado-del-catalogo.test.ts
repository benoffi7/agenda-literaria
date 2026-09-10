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

  it('NO señala «inscripción cerrada» si ya no le quedan encuentros por venir', () => {
    // Sin futuro no hay a qué inscribirse: la fricción de «cerrada con encuentros
    // por venir» no aplica. La actividad simplemente pasó, y eso no es un aviso.
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

describe('la cobertura «cuántas publicadas tienen fecha futura»', () => {
  // El número reemplaza al viejo aviso de «ya pasó»: dice lo mismo —qué parte del
  // catálogo publicado sigue vigente— pero es un conteo acotado, no una lista que
  // crece con cada actividad que termina (D-273). El archivo entero vive en
  // /pasadas; el tablero no lo re-lista.
  it('una actividad en curso cuenta como vigente, con el mismo criterio que el listado', () => {
    // A las 11:30 de un encuentro de 11 a 13 todavía se puede entrar: cuenta por
    // el fin, no por el inicio, igual que el listado del panel.
    const enCurso = acto({ id: 'en-curso', sesiones: [sesion('2026-09-02T11:30:00Z')] });
    expect(tieneFuturo(enCurso, AHORA)).toBe(true);
    expect(estadoDelCatalogo([enCurso], AHORA).publicadas.conFuturo).toBe(1);
  });

  it('una actividad que ya pasó no cuenta como vigente', () => {
    const vieja = acto({ id: 'vieja', sesiones: [sesion('2026-08-01T19:00:00Z')] });
    expect(estadoDelCatalogo([vieja], AHORA).publicadas.conFuturo).toBe(0);
  });

  it('un encuentro cancelado no cuenta como fecha futura', () => {
    const a = acto({
      id: 'cancelado',
      sesiones: [sesion('2026-09-20T19:00:00Z', { cancelada: true })],
    });
    expect(estadoDelCatalogo([a], AHORA).publicadas.conFuturo).toBe(0);
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

  it('y una vieja con la dirección inválida cuenta como sin imagen — B-854', () => {
    /*
     * **El `imagenUrl` legacy nunca pasó por ninguna validación**: es anterior a
     * `esUrl` y al esquema que B-817 puso sobre `imagenes[].url`, así que puede
     * traer cualquier cosa. Con el predicado viejo (`.trim()` sobre la URL) el
     * tablero la contaba como «Con imagen» y el sitio no la mostraba: el aviso
     * `sin-flyer` no la listaba, la pared no la tenía y Google no recibía
     * `image`. El número del tablero decía que estaba y el afiche no existía.
     *
     * Esto es además lo que hace cierta la frase del docblock de `enGoogle`: que
     * la cobertura «Con imagen» **es** el `image` del resultado enriquecido y no
     * una segunda derivación.
     *
     * MUTACIÓN PROBADA: volver `faltaElFlyer` a `!portadaDe(imagenes)?.url?.trim()`.
     * Los tres asertos de acá se ponen rojos; el caso de arriba sigue verde.
     */
    for (const imagenUrl of ['javascript:alert(1)', 'Ver el flyer en el instagram', 'C:\\flyer.jpg']) {
      const roto = acto({
        id: 'roto',
        imagenes: undefined,
        imagenUrl,
        sesiones: [sesion('2026-09-20T19:00:00Z')],
      } as Partial<ActividadConId> & { id: string });
      expect(clases([roto]), imagenUrl).toContain('sin-flyer');
      expect(estadoDelCatalogo([roto], AHORA).publicadas.conFlyer, imagenUrl).toBe(0);
    }
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

describe('el reparto por barrio (B-702)', () => {
  const enBarrios = (id: string, barrios: (string | null)[]): ActividadConId =>
    acto({
      id,
      modalidades: barrios.map((barrio, i) => ({
        id: `mod_${i}`,
        modalidad: barrio === null ? 'virtual' : 'presencial',
        inicio: null,
        fin: null,
        sede:
          barrio === null
            ? null
            : { nombre: '', direccion: '', barrio, ciudad: '', indicaciones: '', geo: null },
        online: null,
      })),
    } as Partial<ActividadConId> & { id: string });

  it('cuenta cada barrio en el que la actividad se dicta', () => {
    const estado = estadoDelCatalogo(
      [enBarrios('a', ['almagro']), enBarrios('b', ['boedo'])],
      AHORA,
    );
    expect(estado.porBarrio).toEqual([
      { valor: 'almagro', cantidad: 1 },
      { valor: 'boedo', cantidad: 1 },
    ]);
  });

  it('una actividad en dos barrios cuenta en los dos: la lista de lugares es `modalidades`', () => {
    /*
     * La lección de B-224 aplicada al barrio. Leer `sede.barrio` —el derivado
     * «la primera fila que tenga sede»— haría que un taller que es en Almagro
     * los martes y en Boedo los jueves desapareciera de Boedo, y el barrio que
     * gana dependería del orden del array: la trampa 2 con otra cara.
     */
    const estado = estadoDelCatalogo([enBarrios('a', ['almagro', 'boedo'])], AHORA);
    expect(estado.porBarrio.map((t) => t.valor).sort()).toEqual(['almagro', 'boedo']);
    // Y por eso puede sumar más que el total, igual que `porModalidad`.
    expect(estado.porBarrio.reduce((s, t) => s + t.cantidad, 0)).toBeGreaterThan(estado.total);
  });

  it('dos filas en el mismo barrio son una sola actividad, no dos', () => {
    // Sin el `Set`, un ciclo con seis filas en Almagro contaría seis veces y el
    // barrio se vería seis veces más grande de lo que es.
    const estado = estadoDelCatalogo([enBarrios('a', ['almagro', 'almagro', 'almagro'])], AHORA);
    expect(estado.porBarrio).toEqual([{ valor: 'almagro', cantidad: 1 }]);
  });

  it('las virtuales no aparecen: no tienen barrio', () => {
    // Meterlas como «sin barrio» mezclaría dos preguntas, y la segunda ya la
    // contesta `porModalidad`.
    const estado = estadoDelCatalogo([enBarrios('a', [null]), enBarrios('b', ['almagro'])], AHORA);
    expect(estado.porBarrio).toEqual([{ valor: 'almagro', cantidad: 1 }]);
  });

  it('un barrio en blanco tampoco: una sede a medio cargar no es una categoría', () => {
    const estado = estadoDelCatalogo(
      [enBarrios('a', ['   ']), enBarrios('b', ['almagro'])],
      AHORA,
    );
    expect(estado.porBarrio).toEqual([{ valor: 'almagro', cantidad: 1 }]);
  });

  it('se cae a `sede` cuando no hay filas: los documentos anteriores a B-224', () => {
    const vieja = acto({
      id: 'vieja',
      modalidades: [],
      sede: { nombre: '', direccion: '', barrio: 'once', ciudad: '', indicaciones: '', geo: null },
    } as Partial<ActividadConId> & { id: string });
    expect(estadoDelCatalogo([vieja], AHORA).porBarrio).toEqual([{ valor: 'once', cantidad: 1 }]);
  });
});

describe('las tres proporciones de inscripción (B-703)', () => {
  const conInscripcion = (
    id: string,
    over: { requiere: boolean; cupo?: number | null; completo?: boolean },
  ): ActividadConId =>
    acto({
      id,
      inscripcion: {
        requiere: over.requiere,
        via: 'mail',
        destino: 'hola@ejemplo.test',
        cupo: over.cupo ?? null,
        cierra: null,
        completo: over.completo ?? false,
      },
    } as Partial<ActividadConId> & { id: string });

  it('cuenta cuántas publicadas piden inscripción', () => {
    const estado = estadoDelCatalogo(
      [conInscripcion('a', { requiere: true }), conInscripcion('b', { requiere: false })],
      AHORA,
    );
    expect(estado.publicadas.conInscripcion).toBe(1);
  });

  it('el cupo y las completas se cuentan sobre las que piden inscripción, no sobre todas', () => {
    /*
     * El denominador es la mitad del dato. Un cupo cargado en una actividad de
     * entrada libre no significa nada, y contarlo sobre las publicadas daría
     * «1 de 3 con cupo» donde lo cierto es «1 de 1». Un porcentaje con el
     * denominador equivocado es una mentira que se ve perfecta.
     */
    const estado = estadoDelCatalogo(
      [
        conInscripcion('a', { requiere: true, cupo: 12, completo: true }),
        conInscripcion('b', { requiere: true }),
        conInscripcion('c', { requiere: false, cupo: 99, completo: true }),
      ],
      AHORA,
    );
    expect(estado.publicadas.conInscripcion).toBe(2);
    expect(estado.publicadas.conCupo).toBe(1);
    expect(estado.publicadas.completas).toBe(1);
  });

  it('un cupo en cero no es un cupo', () => {
    const estado = estadoDelCatalogo([conInscripcion('a', { requiere: true, cupo: 0 })], AHORA);
    expect(estado.publicadas.conCupo).toBe(0);
  });

  it('`completo` ausente se lee como `false`: los documentos anteriores a B-97', () => {
    const vieja = acto({
      id: 'vieja',
      inscripcion: { requiere: true, via: 'mail', destino: 'x@y.test', cupo: null, cierra: null },
    } as unknown as Partial<ActividadConId> & { id: string });
    expect(estadoDelCatalogo([vieja], AHORA).publicadas.completas).toBe(0);
  });

  it('las que no están publicadas no cuentan en ninguna de las tres', () => {
    const borrador = acto({
      id: 'b',
      estado: 'borrador',
      inscripcion: {
        requiere: true,
        via: 'mail',
        destino: 'x@y.test',
        cupo: 5,
        cierra: null,
        completo: true,
      },
    } as Partial<ActividadConId> & { id: string });
    const estado = estadoDelCatalogo([borrador], AHORA);
    expect(estado.publicadas.conInscripcion).toBe(0);
    expect(estado.publicadas.conCupo).toBe(0);
    expect(estado.publicadas.completas).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Lo que Google puede mostrar (B-813)
// ─────────────────────────────────────────────────────────────────

/**
 * Los cuatro avisos del informe «Eventos» que **no** eran un bug del markup.
 *
 * Lo que estos tests atan, en orden:
 *
 * 1. **Que sean proporciones y no avisos.** Es la decisión del ítem, y es
 *    D-273 aplicada de nuevo: una lista de 65 sobre 68 no es trabajo, es el
 *    catálogo con otro nombre. Los dos `it` de «no dispara ningún aviso» son
 *    los que la fijan: si mañana alguien agrega `sin-tallerista` o
 *    `sin-precio`, se caen.
 * 2. **Que cada número use la función que decide el JSON-LD** y no una copia
 *    (`urlSegura`, `admiteMonto`) — la clase de B-88 donde muerde: si el
 *    markup cambia de criterio, el tablero cambia con él.
 * 3. **Que el denominador del monto sea el subconjunto que lo admite**, como
 *    el de B-703: gratis y a la gorra no llevan monto y contarlas como «sin
 *    precio» es la mentira que un denominador equivocado produce.
 */
describe('lo que Google puede mostrar (B-813)', () => {
  const futuro = [sesion('2026-09-20T19:00:00Z')];
  const conWeb = (id: string, web: string): ActividadConId =>
    acto({
      id,
      sesiones: futuro,
      organizador: { nombre: 'Casa X', instagram: '', web },
    } as Partial<ActividadConId> & { id: string });

  it('cuenta las publicadas que dicen quién la da, y mira el nombre y no el objeto', () => {
    // `formADocumento` escribe `tallerista: null` sin nombre, pero un documento
    // anterior a esa regla puede tener el objeto vacío: contarlo sería decir que
    // publica un `performer` que sale con el nombre en blanco.
    const con = acto({
      id: 'con',
      sesiones: futuro,
      tallerista: { nombre: 'Ana Ríos', bio: '', instagram: '' },
    } as Partial<ActividadConId> & { id: string });
    const cascara = acto({
      id: 'cascara',
      sesiones: futuro,
      tallerista: { nombre: '   ', bio: CENTINELAS.bio, instagram: '' },
    } as Partial<ActividadConId> & { id: string });
    const sin = acto({ id: 'sin', sesiones: futuro });

    expect(estadoDelCatalogo([con, cascara, sin], AHORA).publicadas.enGoogle.conQuienLaDa).toBe(1);
  });

  it('solo cuenta las publicadas: un borrador con tallerista no está en Google', () => {
    const borrador = acto({
      id: 'b',
      estado: 'borrador',
      tallerista: { nombre: 'Ana Ríos', bio: '', instagram: '' },
    } as Partial<ActividadConId> & { id: string });
    expect(estadoDelCatalogo([borrador], AHORA).publicadas.enGoogle.conQuienLaDa).toBe(0);
  });

  it('una publicada sin tallerista NO dispara ningún aviso: no tenerlo no es un error', () => {
    // La decisión del ítem, fijada. Un club de lectura no tiene tallerista, y
    // 65 de 68 en una lista de pendientes es el catálogo con otro nombre (D-273).
    expect(clases([acto({ id: 'sin', sesiones: futuro })])).toEqual([]);
  });

  it('la web del organizador se cuenta con el mismo saneador que publica el JSON-LD', () => {
    // «casabrandon.com» sin esquema **sí** enlaza (`urlSegura` asume `https://`),
    // y un texto con espacios no. Un `web.trim() !== ''` acá contaría las dos.
    const estado = estadoDelCatalogo(
      [
        conWeb('sin-esquema', 'casabrandon.com'),
        conWeb('con-esquema', 'https://casabrandon.com/agenda'),
        conWeb('prosa', 'Casa Brandon / IG @casabrandon'),
        acto({ id: 'sin-web', sesiones: futuro }),
      ],
      AHORA,
    );
    expect(estado.publicadas.enGoogle.conWebDelOrganizador).toBe(2);
  });

  it('el denominador del monto son las que lo admiten, no todas las publicadas', () => {
    // Gratis y a la gorra no llevan monto —el schema las rechaza—, así que
    // contarlas como «sin precio» sería el denominador equivocado de B-703.
    const arancelada = (id: string, monto: number | null): ActividadConId =>
      acto({
        id,
        sesiones: futuro,
        arancel: { tipo: 'arancelado', notas: '', monto },
      } as Partial<ActividadConId> & { id: string });
    const estado = estadoDelCatalogo(
      [
        arancelada('con-monto', 15000),
        arancelada('sin-monto', null),
        acto({ id: 'gratis', sesiones: futuro }),
        acto({
          id: 'gorra',
          sesiones: futuro,
          arancel: { tipo: 'a-la-gorra', notas: '' },
        } as Partial<ActividadConId> & { id: string }),
      ],
      AHORA,
    );
    expect(estado.publicadas.total).toBe(4);
    expect(estado.publicadas.enGoogle.admitenMonto).toBe(2);
    expect(estado.publicadas.enGoogle.conMonto).toBe(1);
  });

  it('una arancelada sin monto NO dispara ningún aviso: «a convenir» es legítimo', () => {
    // B-114 dejó `arancel.monto` opcional a propósito. Que Google avise no lo
    // convierte en un error nuestro, y ésta es la línea que lo fija.
    const a = acto({
      id: 'a-convenir',
      sesiones: futuro,
      arancel: { tipo: 'arancelado', notas: 'A convenir según el cupo', monto: null },
    } as Partial<ActividadConId> & { id: string });
    expect(clases([a])).toEqual([]);
  });
});

describe('el aviso de la web que no enlaza (B-813)', () => {
  const futuro = [sesion('2026-09-20T19:00:00Z')];
  const conWeb = (id: string, web: string): ActividadConId =>
    acto({
      id,
      sesiones: futuro,
      organizador: { nombre: 'Casa X', instagram: '', web },
    } as Partial<ActividadConId> & { id: string });

  it('señala la que tiene una web cargada que no es una dirección', () => {
    expect(aviso([conWeb('prosa', 'Casa Brandon / IG @casabrandon')], 'web-que-no-enlaza')
      ?.actividades).toEqual([{ id: 'prosa', titulo: 'prosa' }]);
  });

  it('señala un esquema que no se puede publicar como link', () => {
    // El caso filoso: `urlSegura` solo deja pasar http y https, así que esto
    // desaparece de las tres salidas sin que nada lo diga.
    expect(clases([conWeb('script', 'javascript:alert(1)')])).toEqual(['web-que-no-enlaza']);
  });

  it('NO señala la que no tiene web: no tenerla no es un defecto', () => {
    // La mitad que hace que el aviso sea corto. Sin ella listaría a los 24 del
    // informe, que es la mitad del circuito literario.
    expect(clases([acto({ id: 'sin-web', sesiones: futuro })])).toEqual([]);
    expect(clases([conWeb('vacia', '   ')])).toEqual([]);
  });

  it('NO señala una web sin esquema: «casabrandon.com» enlaza igual', () => {
    expect(clases([conWeb('corta', 'casabrandon.com')])).toEqual([]);
  });

  it('solo mira las publicadas: un borrador con la web rota todavía no está en el sitio', () => {
    const b = acto({
      id: 'b',
      estado: 'borrador',
      organizador: { nombre: 'Casa X', instagram: '', web: 'Casa Brandon / IG' },
    } as Partial<ActividadConId> & { id: string });
    expect(clases([b])).toEqual([]);
  });
});
