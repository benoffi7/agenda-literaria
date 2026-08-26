import { describe, expect, it } from 'vitest';
import { planificar } from '@calendario';
import { formADocumento } from '@/lib/actividades';
import { labelsDeOpciones, vistaPreviaEvento } from '@/lib/vistaPreviaEvento';
import type { ActividadForm, SesionForm, ValorOpcion } from '@/types/actividad';

/**
 * B-12 — la vista previa reusa `construirDescripcion` de `@calendario`, así que
 * lo que se testea acá es la adaptación: fechas de `datetime-local` a algo que
 * la Function entienda, y slugs a etiquetas. Más la garantía de que la vista
 * previa no muestra lo que el evento no publica (§5.1): si mostrara de más, el
 * usuario creería que se publica algo que no se publica.
 */

const opcion = (slug: string, label: string): ValorOpcion => ({
  slug,
  label,
  orden: 1,
  fijo: true,
  usos: 0,
});

const LABELS = labelsDeOpciones({
  arancel: [opcion('a-la-gorra', 'A la gorra')],
  tipo: [opcion('club-lectura', 'Club de lectura')],
  barrio: [opcion('villa-crespo', 'Villa Crespo')],
  plataforma: [opcion('zoom', 'Zoom')],
  tags: [opcion('narrativa', 'Narrativa')],
});

const sesion = (over: Partial<SesionForm> = {}): SesionForm => ({
  id: 'ses_1',
  inicio: '2026-09-03T19:00',
  fin: '2026-09-03T21:00',
  tema: '',
  lectura: '',
  cancelada: false,
  calendarEventId: null,
  ...over,
});

const form = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros para leer el boom.',
  imagenes: [],
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: 'https://casabrandon.org' },
  tallerista: { nombre: 'María Moreno', bio: 'Cronista y ensayista.', instagram: '@mmoreno' },
  libro: { titulo: '', autor: '' },
  esCiclo: true,
  sesiones: [sesion()],
  modalidad: 'hibrido',
  sede: {
    nombre: 'Casa Brandon',
    direccion: 'Luis María Drago 236',
    barrio: 'villa-crespo',
    ciudad: 'CABA',
    indicaciones: 'Timbre 2, tocar fuerte',
    geo: null,
  },
  online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: 'hola@casabrandon.org',
    cupo: 12,
    cierra: '2026-09-01T12:00',
    // B-97 — el caso normal es "no está completo"; el que sí lo está tiene su
    // propio chequeo abajo, que es el que verifica que la vista previa no
    // reimplemente la línea (D-20).
    completo: false,
  },
  arancel: { tipo: 'a-la-gorra', notas: 'incluye material' },
  material: {
    tiene: true,
    items: [
      {
        tipo: 'lectura',
        titulo: 'Pedro Páramo',
        url: 'https://drive/publico',
        entrega: 'previo',
        publico: true,
      },
      {
        tipo: 'guia',
        titulo: 'Guía de lectura',
        url: 'https://drive/privado',
        entrega: 'al-inscribirse',
        publico: false,
      },
    ],
  },
  difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
  estado: 'publicado',
  tags: ['narrativa'],
  destacado: false,
  ...over,
});

/** Atajo: la vista previa de un formulario que se sabe válido. */
const previa = (f: ActividadForm, sesionId: string | null = null) => {
  const r = vistaPreviaEvento(f, sesionId, LABELS);
  if (!r.ok) throw new Error(`Se esperaba una vista previa válida: ${r.motivo}`);
  return r.evento;
};

describe('labelsDeOpciones — slugs a etiquetas (§4.1)', () => {
  it('arma el mapa que espera la descripción del evento', () => {
    expect(LABELS.arancel).toEqual({ 'a-la-gorra': 'A la gorra' });
    expect(LABELS.tags).toEqual({ narrativa: 'Narrativa' });
  });

  it('deja los cinco campos de taxonomía, aunque no tengan opciones', () => {
    const vacio = labelsDeOpciones({});
    expect(Object.keys(vacio).sort()).toEqual(
      ['arancel', 'barrio', 'plataforma', 'tags', 'tipo'].sort(),
    );
  });

  it('las etiquetas pendientes del submit ganan sobre lo que hay en /opciones (D-02)', () => {
    // Se creó con "Otro" y todavía no está en Firestore: sin esto la
    // descripción mostraría "Con Beca Parcial" des-slugueado.
    const labels = labelsDeOpciones(
      { arancel: [opcion('gratis', 'Gratis')] },
      { arancel: { 'con-beca-parcial': 'Con beca parcial' } },
    );
    expect(labels.arancel).toEqual({
      gratis: 'Gratis',
      'con-beca-parcial': 'Con beca parcial',
    });
  });
});

describe('vistaPreviaEvento — adaptación del formulario', () => {
  it('convierte las fechas de datetime-local a lo que espera la Function', () => {
    // Si la conversión no fuera un Timestamp con toDate(), el cierre de la
    // inscripción no se podría formatear y esto no aparecería.
    expect(previa(form()).descripcion).toContain('Cierra: 1 de septiembre de 2026');
  });

  it('numera el encuentro dentro del ciclo, que necesita toMillis()', () => {
    const f = form({
      sesiones: [
        sesion({ id: 'ses_b', inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' }),
        sesion({ id: 'ses_a', inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' }),
      ],
    });
    // Ordena por fecha y no por posición en el array, igual que el evento real.
    expect(previa(f, 'ses_a').descripcion).toContain('Encuentro 1 de 2');
    expect(previa(f, 'ses_b').descripcion).toContain('Encuentro 2 de 2');
  });

  /**
   * B-97 + D-20 — la vista previa **no reimplementa** la línea del cupo completo:
   * la trae de `@calendario`, que es el mismo módulo que el sync. Por eso se
   * compara contra el payload que el diff le mandaría a Calendar, y no contra una
   * cadena escrita a mano acá: una igualdad contra un literal pasaría igual el
   * día que alguien arme la línea por fuera de `construirDescripcion`, que es la
   * trampa 9.
   */
  it('B-97: el cupo completo aparece solo en la previa, con el texto del evento (D-20)', () => {
    const f = form({ inscripcion: { ...form().inscripcion, completo: true } });
    const documento = formADocumento(f, '', false);
    const creada = planificar(null, documento, LABELS).find(
      (o: { id: string }) => o.id === f.sesiones[0]!.id,
    ) as { evento: { description: string } };

    expect(previa(f).descripcion).toBe(creada.evento.description);
    expect(previa(f).descripcion).toContain('Cupo completo');
    // Y sin marcarlo, la previa tampoco lo dice: el fixture base está en `false`.
    expect(previa(form()).descripcion).not.toContain('Cupo completo');
  });

  it('numera igual que el evento publicado: el cancelado sigue contando (B-84, D-95)', () => {
    const tres = [
      sesion({ id: 'ses_a' }),
      sesion({ id: 'ses_b', inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00', cancelada: true }),
      sesion({ id: 'ses_c', inicio: '2026-09-17T19:00', fin: '2026-09-17T21:00' }),
    ];
    const f = form({ sesiones: tres });

    // La vista previa no puede decir una cosa y el calendario otra: se compara
    // contra el payload que el diff le mandaría a Calendar. Hoy es la misma
    // cadena de funciones, así que la igualdad no puede fallar: es la guarda
    // que se pone en rojo el día que alguien reimplemente la previa acá (D-20).
    // Lo que verifica el caso es el número de la línea siguiente.
    const documento = formADocumento(f, '', false);
    const creada = planificar(null, documento, LABELS).find(
      (o: { id: string }) => o.id === 'ses_c',
    ) as { evento: { description: string } };

    expect(previa(f, 'ses_c').descripcion).toBe(creada.evento.description);
    expect(previa(f, 'ses_c').descripcion).toContain('Encuentro 3 de 3');
  });

  it('muestra el título del evento, con el tema del encuentro', () => {
    const f = form({ sesiones: [sesion({ tema: 'Cap. 1-4' })] });
    expect(previa(f).titulo).toBe('Club de lectura latinoamericana — Cap. 1-4');
  });

  it('muestra la ubicación completa, con el barrio resuelto (D-10, D-11)', () => {
    expect(previa(form()).ubicacion).toBe(
      'Casa Brandon, Luis María Drago 236, Villa Crespo, CABA, Argentina',
    );
  });

  it('resuelve los slugs de taxonomía a su etiqueta legible', () => {
    const d = previa(form()).descripcion;
    expect(d).toContain('Club de lectura');
    expect(d).toContain('Arancel: A la gorra');
    expect(d).toContain('Temas: Narrativa');
    expect(d).not.toContain('a-la-gorra');
  });

  it('elige el encuentro pedido y cae al primero si ese id ya no está', () => {
    const f = form({
      sesiones: [
        sesion({ id: 'ses_a', tema: 'Primero' }),
        sesion({ id: 'ses_b', tema: 'Segundo', inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' }),
      ],
    });
    expect(previa(f, 'ses_b').titulo).toContain('Segundo');
    expect(previa(f, 'ses_borrada').titulo).toContain('Primero');
  });

  it('sin encuentros no hay evento que previsualizar', () => {
    const r = vistaPreviaEvento(form({ sesiones: [] }), null, LABELS);
    expect(r).toMatchObject({ ok: false });
  });

  it('con una fecha incompleta avisa en lugar de explotar', () => {
    const f = form({ sesiones: [sesion({ inicio: '' })] });
    const r = vistaPreviaEvento(f, null, LABELS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('fechas');
  });

  it('avisa que el evento todavía no existe si la actividad no está publicada (§7.3)', () => {
    expect(previa(form({ estado: 'borrador' })).saleAlCalendario).toBe(false);
    expect(previa(form()).saleAlCalendario).toBe(true);
  });

  it('avisa que un encuentro cancelado no tiene evento (§7.3)', () => {
    expect(previa(form({ sesiones: [sesion({ cancelada: true })] })).saleAlCalendario).toBe(false);
  });
});

describe('vistaPreviaEvento — no muestra lo que el evento no publica (§5.1, §7.4)', () => {
  it('no muestra el link de la reunión: solo la plataforma (trampa 5)', () => {
    const d = previa(form()).descripcion;
    expect(d).not.toContain('zoom.us/j/secreto');
    expect(d).toContain('Plataforma: Zoom (el link se envía a quienes se inscriban)');
  });

  it('no muestra la difusión interna', () => {
    const d = previa(form()).descripcion;
    expect(d).not.toContain('coordinar con prensa');
    expect(d).not.toContain('@editorial');
  });

  it('del material privado muestra el título pero no la URL', () => {
    const d = previa(form()).descripcion;
    expect(d).toContain('Guía de lectura');
    expect(d).not.toContain('drive/privado');
    // El público sí lleva su link, igual que en el evento.
    expect(d).toContain('https://drive/publico');
  });

  it('marca el link como reservado cuando está cargado y sin publicar', () => {
    const e = previa(form());
    expect(e.linkPublicado).toBe(false);
    expect(e.linkReservado).toBe(true);
  });

  it('con "publicar el link" tildado el link SÍ sale, y queda señalado (D-15)', () => {
    const f = form({
      online: { plataforma: 'zoom', url: 'https://zoom.us/j/abierto', urlPublica: true },
    });
    const e = previa(f);
    expect(e.descripcion).toContain('Link: https://zoom.us/j/abierto');
    expect(e.linkPublicado).toBe(true);
    expect(e.linkReservado).toBe(false);
  });

  it('urlPublica en true sin URL cargada no inventa el campo', () => {
    const f = form({ online: { plataforma: 'zoom', url: '', urlPublica: true } });
    const e = previa(f);
    expect(e.descripcion).not.toContain('Link:');
    expect(e.linkPublicado).toBe(false);
  });
});
