/**
 * **Qué dice cada placa para Instagram, y qué no dice nunca** — B-2225, B-2226.
 *
 * La mitad pura de las placas (`lib/placas.ts`). El dibujo no se testea acá —un
 * canvas en jsdom no mide texto—; lo que sí, y es lo que importa, es el texto:
 * una placa es una imagen que se comparte sola y no se despublica, así que la
 * tabla de privacidad del docblock se verifica con los centinelas del
 * formulario lleno, igual que el texto para redes.
 */
import { describe, expect, it } from 'vitest';
import { formADocumento } from '@/lib/actividades';
import { filtrarEfemerides } from '@/lib/efemeride-schema';
import {
  CAMPOS_DE_LA_PLACA,
  CLAVE_CAMPOS_DE_LA_PLACA,
  FECHAS_SUELTAS,
  conLosCampos,
  leerCamposDeLaPlaca,
  recordarCamposDeLaPlaca,
  placaDeActividad,
  placaDeEfemeride,
  type ActividadParaPlaca,
} from '@/lib/placas';
import { DOMINIO } from '@/lib/rutasPublicas';
import { labelsDeOpciones } from '@/lib/vistaPreviaEvento';
import type { Sesion, ValorOpcion } from '@/types/actividad';
import { CENTINELAS, formularioLleno } from './fixtures/formulario';
import { tsDe } from './fixtures/tiempo';

const opcion = (slug: string, label: string): ValorOpcion => ({ slug, label, orden: 1, fijo: true, usos: 0 });
const LABELS = labelsDeOpciones({
  tipo: [opcion('taller', 'Taller'), opcion('club-lectura', 'Club de lectura')],
  arancel: [opcion('a-la-gorra', 'A la gorra'), opcion('gratis', 'Gratis')],
  barrio: [opcion('villa-crespo', 'Villa Crespo')],
  ciudad: [opcion('caba', 'CABA'), opcion('rosario', 'Rosario')],
  plataforma: [opcion('zoom', 'Zoom')],
});

// ─────────────────────────────────────────────────────────────────
// Efeméride
// ─────────────────────────────────────────────────────────────────

const EFEMERIDE = {
  titulo: 'Nace Julio Cortázar',
  descripcion: 'Argentina (Ixelles, Bélgica, 1914 – París, 1984).',
  dia: 26,
  mes: 8,
  anio: 1914,
  slug: 'nace-julio-cortazar',
  estado: 'publicado' as const,
};
const HOY = new Date('2026-08-26T12:00:00-03:00');

describe('la placa de una efeméride — B-2225', () => {
  it('dice el día, el año, cuántos años hace, el hecho y el dato', () => {
    const p = placaDeEfemeride(EFEMERIDE, HOY);
    expect(p).toMatchObject({
      antetitulo: 'Un día como hoy',
      fecha: '26 de agosto',
      anio: '1914',
      hace: 'Hace 112 años',
      titulo: 'Nace Julio Cortázar',
      cuerpo: 'Argentina (Ixelles, Bélgica, 1914 – París, 1984).',
      pie: DOMINIO,
    });
  });

  it('lleva la dirección de su página solo si está publicada', () => {
    expect(placaDeEfemeride(EFEMERIDE, HOY).enlace).toBe(`${DOMINIO}/efemerides/nace-julio-cortazar`);
    expect(placaDeEfemeride({ ...EFEMERIDE, estado: 'borrador' }, HOY).enlace).toBeNull();
  });

  it('sin año no dice año ni «hace»', () => {
    const p = placaDeEfemeride({ ...EFEMERIDE, anio: null }, HOY);
    expect(p.anio).toBeNull();
    expect(p.hace).toBeNull();
  });

  it('hace N años se cuenta con el año de Buenos Aires, no con el del navegador', () => {
    // 2027-01-01 a la 01:00 UTC todavía es 31 de diciembre de 2026 en Buenos Aires.
    expect(placaDeEfemeride(EFEMERIDE, new Date('2027-01-01T01:00:00Z')).hace).toBe('Hace 112 años');
  });

  it('un año: singular; del mismo año: no dice nada', () => {
    expect(placaDeEfemeride({ ...EFEMERIDE, anio: 2025 }, HOY).hace).toBe('Hace 1 año');
    expect(placaDeEfemeride({ ...EFEMERIDE, anio: 2026 }, HOY).hace).toBeNull();
  });
});

describe('el filtro de la lista del panel — B-2225', () => {
  const lista = [
    { ...EFEMERIDE },
    { ...EFEMERIDE, titulo: 'Muere Alejandra Pizarnik', descripcion: 'Poeta.', mes: 9 },
  ];

  it('por mes, y `null` es el año entero', () => {
    expect(filtrarEfemerides(lista, { mes: 8, texto: '' })).toHaveLength(1);
    expect(filtrarEfemerides(lista, { mes: null, texto: '' })).toHaveLength(2);
  });

  it('por texto, sin acentos ni mayúsculas, en el título y en el dato', () => {
    expect(filtrarEfemerides(lista, { mes: null, texto: 'CORTAZAR' })).toHaveLength(1);
    expect(filtrarEfemerides(lista, { mes: null, texto: 'belgica' })).toHaveLength(1);
    expect(filtrarEfemerides(lista, { mes: 8, texto: 'pizarnik' })).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Actividad
// ─────────────────────────────────────────────────────────────────

const sesion = (id: string, inicio: string, over: Partial<Sesion> = {}): Sesion =>
  ({
    id,
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    comisionId: null,
    horarioAConfirmar: false,
    ...over,
    inicio: tsDe(new Date(inicio)),
    fin: tsDe(new Date(new Date(inicio).getTime() + 2 * 3600_000)),
  }) as unknown as Sesion;

/** Jueves a las 19 en Buenos Aires (22:00Z). */
const jueves = (dias: number[]) =>
  dias.map((d, i) => sesion(`ses_${i}`, `2026-11-${String(d).padStart(2, '0')}T22:00:00Z`));

const act = (over: Partial<ActividadParaPlaca> = {}): ActividadParaPlaca =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    esCiclo: true,
    estado: 'publicado',
    sesiones: jueves([5, 12, 19, 26]),
    modalidad: 'presencial',
    sede: {
      nombre: 'Casa Brandon',
      direccion: 'Luis María Drago 236',
      provincia: 'caba',
      barrio: 'villa-crespo',
      ciudad: 'caba',
      indicaciones: 'Timbre 3B',
      geo: null,
    },
    online: null,
    inscripcion: { requiere: true, via: 'whatsapp', destino: '+5491100000000', cupo: 10, cierra: null, completo: false },
    arancel: { tipo: 'a-la-gorra', notas: '' },
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: { nombre: 'María Moreno', bio: '', instagram: '' },
    difusion: { arrobar: [], notas: '' },
    imagenes: [],
    comisiones: [],
    ...over,
  }) as ActividadParaPlaca;

const placa = (over: Partial<ActividadParaPlaca> = {}, yaTienePagina = true) => {
  const r = placaDeActividad(act(over), LABELS, yaTienePagina);
  if (!r.ok) throw new Error(r.motivo);
  return r.placa;
};

describe('la placa de una actividad — B-2226', () => {
  it('el ciclo semanal se resume en el día, la hora y el rango', () => {
    const p = placa();
    expect(p.antetitulo).toBe('Taller · 4 encuentros');
    expect(p.cuando).toEqual(['Los jueves · 19:00', 'Del 5/11 al 26/11']);
    expect(p.conQuien).toBe('Con María Moreno');
  });

  it(`hasta ${FECHAS_SUELTAS} fechas van una por línea`, () => {
    expect(placa({ sesiones: jueves([5, 12]) }).cuando).toEqual([
      'Jueves 5 de noviembre · 19:00',
      'Jueves 12 de noviembre · 19:00',
    ]);
  });

  it('muchas fechas sin patrón: las dos primeras y cuántas más', () => {
    const sesiones = [...jueves([5, 12, 19]), sesion('ses_x', '2026-11-28T15:00:00Z')];
    expect(placa({ sesiones }).cuando).toEqual([
      'Jueves 5 de noviembre · 19:00',
      'Jueves 12 de noviembre · 19:00',
      'y 2 fechas más',
    ]);
  });

  it('no anuncia los encuentros cancelados', () => {
    const sesiones = jueves([5, 12]).map((s, i) => (i === 1 ? { ...s, cancelada: true } : s));
    expect(placa({ sesiones }).cuando).toEqual(['Jueves 5 de noviembre · 19:00']);
  });

  it('con opciones para sumarse, lista las opciones y no cuenta encuentros', () => {
    const p = placa({
      comisiones: [
        { id: 'com_1', etiqueta: 'Martes 19 h' },
        { id: 'com_2', etiqueta: 'Jueves 10 h' },
      ],
    });
    expect(p.cuando).toEqual(['2 opciones para sumarse:', 'Martes 19 h', 'Jueves 10 h']);
    expect(p.antetitulo).toBe('Taller');
  });

  it('dónde: sede y barrio; lo virtual con su plataforma', () => {
    expect(placa().donde).toEqual(['Casa Brandon · Villa Crespo']);
    expect(
      placa({ modalidad: 'virtual', sede: null, online: { plataforma: 'zoom', url: 'x', urlPublica: false } })
        .donde,
    ).toEqual(['Virtual, por Zoom']);
  });

  it('el arancel con su etiqueta, y la inscripción dice por dónde', () => {
    const p = placa();
    expect(p.arancel).toBe('A la gorra');
    expect(p.inscripcion).toBe('Inscripción por WhatsApp');
    expect(placa({ inscripcion: { ...act().inscripcion, completo: true } }).inscripcion).toBe('Cupo completo');
  });

  it('la dirección de su página, solo con la actividad guardada publicada', () => {
    expect(placa().enlace).toBe(`${DOMINIO}/actividad/taller-de-cronica`);
    expect(placa({}, false).enlace).toBeNull();
  });

  it('la foto es la portada propia; una externa no entra', () => {
    const propia = {
      id: 'img_1',
      url: 'https://firebasestorage.googleapis.com/v0/b/x/o/flyer.webp',
      epigrafe: '',
      origen: 'propia' as const,
      portada: true,
    };
    expect(placa({ imagenes: [propia] }).imagen).toBe(propia.url);
    expect(placa({ imagenes: [{ ...propia, origen: 'externa' }] }).imagen).toBeNull();
  });

  it('sin fechas no hay placa, y lo dice', () => {
    const r = placaDeActividad(act({ sesiones: [] }), LABELS, true);
    expect(r.ok).toBe(false);
  });
});

describe('lo que una placa no dice nunca — §5.1', () => {
  /*
   * El formulario lleno, por el mismo camino que el panel (`formADocumento`),
   * con una portada **propia** para que la foto también se mire. Todo lo que
   * la tabla del docblock dice «no» tiene que faltar del resultado entero.
   */
  const form = formularioLleno();
  form.imagenes = form.imagenes.map((i) => ({ ...i, origen: 'propia' as const }));
  const documento = formADocumento(form, '', false) as unknown as ActividadParaPlaca;
  const r = placaDeActividad(documento, LABELS, true);
  const salida = JSON.stringify(r);

  it('arma la placa (control positivo)', () => {
    expect(r.ok).toBe(true);
    expect(salida).toContain(CENTINELAS.titulo);
    expect(salida).toContain(CENTINELAS.tallerista);
  });

  const NUNCA = [
    ['el link de la reunión', CENTINELAS.linkReunion],
    ['el destino de la inscripción', CENTINELAS.mailInscripcion],
    ['la dirección', CENTINELAS.direccion],
    ['las indicaciones', CENTINELAS.indicaciones],
    ['las notas de difusión', CENTINELAS.notasInternas],
    ['los handles a arrobar', CENTINELAS.handle],
    ['las notas del arancel', CENTINELAS.notasArancel],
    ['la bio', CENTINELAS.bio],
    ['el uid', CENTINELAS.uid],
    ['el epígrafe', CENTINELAS.epigrafeImagen],
    ['el material', CENTINELAS.urlMaterial],
  ] as const;

  for (const [que, centinela] of NUNCA) {
    it(`no lleva ${que}`, () => expect(salida).not.toContain(centinela));
  }

  it('una etiqueta de opción con el link de la reunión no llega a la placa, ni en borrador (§5.1, trampa 5)', () => {
    /*
     * Lo encontró el `auditor-privacidad`: la placa es la primera salida para
     * redes que dibuja las opciones para sumarse, y la regla del schema que les
     * saca el link de reunión corre solo con la actividad publicada y al guardar.
     * La placa se arma del formulario en curso, en borrador también.
     */
    const conLink = formularioLleno({ estado: 'borrador' });
    conLink.comisiones = [
      { id: 'com_a', etiqueta: `Martes 19 h por ${CENTINELAS.linkReunion}` },
      { id: 'com_b', etiqueta: 'Jueves 10 h' },
    ];
    conLink.titulo = `Taller ${CENTINELAS.linkReunion}`;
    const doc = formADocumento(conLink, '', false) as unknown as ActividadParaPlaca;
    const r = placaDeActividad(doc, LABELS, false);
    expect(r.ok).toBe(true);
    const texto = JSON.stringify(r);
    expect(texto).toContain('Martes 19 h');
    expect(texto).not.toContain(CENTINELAS.linkReunion);
    expect(texto).not.toContain('zoom.us');
  });

  // El caso que cita la ayuda del panel, escrito literal para que se pueda atar.
  it('no lleva el destino de la inscripción ni la dirección, aunque el texto sí', () => {
    expect(salida).not.toContain(CENTINELAS.mailInscripcion);
    expect(salida).not.toContain(CENTINELAS.direccion);
  });
});

describe('qué filas lleva la placa — B-2227', () => {
  const almacen = (inicial: Record<string, string> = {}) => {
    const datos = { ...inicial };
    return {
      getItem: (k: string) => datos[k] ?? null,
      setItem: (k: string, v: string) => {
        datos[k] = v;
      },
      datos,
    };
  };

  it('lo que no se eligió sale vacío, y el tipo y el título quedan', () => {
    const p = conLosCampos(placa({ imagenes: [] }), new Set(['cuando'] as const));
    expect(p.titulo).toBe('Taller de crónica');
    expect(p.antetitulo).toBe('Taller · 4 encuentros');
    expect(p.cuando).toHaveLength(2);
    expect(p).toMatchObject({ conQuien: null, donde: [], arancel: null, inscripcion: null, enlace: null, imagen: null });
  });

  it('sin nada guardado van todas', () => {
    expect([...leerCamposDeLaPlaca(almacen())]).toEqual([...CAMPOS_DE_LA_PLACA]);
    expect([...leerCamposDeLaPlaca(null)]).toEqual([...CAMPOS_DE_LA_PLACA]);
  });

  it('recuerda la elección, y lo guardado es solo de la lista cerrada', () => {
    const a = almacen();
    recordarCamposDeLaPlaca(a, new Set(['donde', 'cuando'] as const));
    // En el orden de la placa, no en el de los clics.
    expect(a.datos[CLAVE_CAMPOS_DE_LA_PLACA]).toBe('["cuando","donde"]');
    expect([...leerCamposDeLaPlaca(a)]).toEqual(['cuando', 'donde']);
  });

  it('un valor roto o ajeno no rompe nada: lo desconocido se ignora', () => {
    expect([...leerCamposDeLaPlaca(almacen({ [CLAVE_CAMPOS_DE_LA_PLACA]: '{roto' }))]).toEqual([
      ...CAMPOS_DE_LA_PLACA,
    ]);
    expect([
      ...leerCamposDeLaPlaca(almacen({ [CLAVE_CAMPOS_DE_LA_PLACA]: '["donde","<script>"]' })),
    ]).toEqual(['donde']);
  });
});
