import { describe, expect, it } from 'vitest';
import {
  CASILLAS_COPIA,
  COPIA_POR_DEFECTO,
  casillasAplicables,
  diasDeDesplazamiento,
  duplicarActividadForm,
  duplicarSesionParaCopia,
  slugCopia,
  tituloCopia,
  type QueCopiar,
} from '@/lib/duplicar';
import { actividadFormSchema } from '@/lib/schema';
import { deDatetimeLocal } from '@/lib/sesiones';
import type { ActividadForm, Imagen, SesionForm } from '@/types/actividad';

const sesion = (over: Partial<SesionForm> = {}): SesionForm => ({
  id: 'ses_original',
  inicio: '2025-09-02T19:00',
  fin: '2025-09-02T21:00',
  tema: 'Cap. 1-4',
  lectura: 'Los siete locos',
  cancelada: false,
  calendarEventId: 'evento_del_original',
  ...over,
});

/** Ciclo de tres martes de 2025, con un salto de dos semanas en el medio. */
const original = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros por narrativa del boom y después.',
  imagenes: [],
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: '' },
  tallerista: { nombre: 'María Moreno', bio: 'Cronista', instagram: '@mmoreno' },
  libro: { titulo: 'Los siete locos', autor: 'Roberto Arlt' },
  esCiclo: true,
  sesiones: [
    sesion({ id: 'ses_a', inicio: '2025-09-02T19:00', fin: '2025-09-02T21:00' }),
    sesion({ id: 'ses_b', inicio: '2025-09-09T19:00', fin: '2025-09-09T21:00' }),
    // Se saltea una semana (feriado) — el hueco irregular tiene que sobrevivir.
    sesion({ id: 'ses_c', inicio: '2025-09-23T19:00', fin: '2025-09-23T21:30' }),
  ],
  modalidad: 'hibrido',
  sede: {
    nombre: 'Casa Brandon',
    direccion: 'Drago 236',
    barrio: 'villa-crespo',
    ciudad: 'CABA',
    indicaciones: 'Timbre 2',
    geo: null,
  },
  online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: 'hola@casabrandon.example',
    cupo: 12,
    cierra: '2025-08-30T00:00',
    // B-97 — el original está completo, así que la copia tiene algo que NO
    // heredar. Con `false` el chequeo de abajo pasaría por vacío.
    completo: true,
  },
  arancel: { tipo: 'a-la-gorra', notas: 'incluye material' },
  material: {
    tiene: true,
    items: [
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
  destacado: true,
  ...over,
});

const imagen = (over: Partial<Imagen> = {}): Imagen => ({
  id: 'img_1',
  url: 'https://ejemplo.ar/flyer.jpg',
  epigrafe: '',
  origen: 'externa',
  portada: true,
  ...over,
});

const AHORA = new Date('2026-08-21T12:00');

describe('duplicar una actividad — lo que NO se puede heredar (B-11)', () => {
  it('le da a cada sesión un id nuevo: dos actividades con los mismos ids rompen el diff (§7.2, trampa 2)', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });

    const idsOriginales = o.sesiones.map((s) => s.id);
    const idsCopia = copia.sesiones.map((s) => s.id);

    expect(idsCopia).toHaveLength(3);
    expect(idsCopia.every((id) => !idsOriginales.includes(id))).toBe(true);
    // Únicos entre sí, y con el prefijo que exige el schema.
    expect(new Set(idsCopia).size).toBe(3);
    expect(idsCopia.every((id) => id.startsWith('ses_'))).toBe(true);
    // Y el original queda intacto.
    expect(o.sesiones.map((s) => s.id)).toEqual(idsOriginales);
  });

  it('pone calendarEventId en null en todas las sesiones: los eventos son del original (§7.2)', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    expect(copia.sesiones.map((s) => s.calendarEventId)).toEqual([null, null, null]);
    expect(JSON.stringify(copia)).not.toContain('evento_del_original');
  });

  it('arranca en borrador aunque el original esté publicado: no manda nada al calendario (§7.3)', () => {
    for (const estado of ['publicado', 'pendiente', 'cancelado'] as const) {
      const copia = duplicarActividadForm(original({ estado }), { ahora: AHORA });
      expect(copia.estado).toBe('borrador');
    }
  });

  it('propone un slug distinto del original', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });
    expect(copia.slug).not.toBe(o.slug);
    expect(copia.slug).toBe('club-latinoamericana-copia');
  });

  it('esquiva los slugs ya tomados', () => {
    const copia = duplicarActividadForm(original(), {
      ahora: AHORA,
      tomados: ['club-latinoamericana', 'club-latinoamericana-copia', 'club-latinoamericana-copia-2'],
    });
    expect(copia.slug).toBe('club-latinoamericana-copia-3');
  });

  it('duplicar la copia no encadena sufijos', () => {
    expect(slugCopia('club-copia', ['club-copia'])).toBe('club-copia-2');
    expect(slugCopia('club-copia-3', [])).toBe('club-copia');
    expect(tituloCopia('Club (copia)')).toBe('Club (copia)');
    expect(tituloCopia('Club')).toBe('Club (copia)');
  });

  it('marca el título como copia: dos filas con el mismo título son indistinguibles en el listado', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    expect(copia.titulo).toBe('Club de lectura latinoamericana (copia)');
  });
});

describe('duplicar una actividad — las fechas', () => {
  it('corre el ciclo entero en semanas enteras: mismo día de semana y misma hora', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });

    for (const [i, s] of copia.sesiones.entries()) {
      const antes = deDatetimeLocal(original().sesiones[i]!.inicio)!;
      const despues = deDatetimeLocal(s.inicio)!;
      expect(despues.getDay()).toBe(antes.getDay());
      expect(despues.getHours()).toBe(antes.getHours());
      expect(despues.getMinutes()).toBe(antes.getMinutes());
    }
  });

  it('conserva los huecos irregulares y las duraciones (§2.2 — un feriado que se saltea)', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    const ms = (s: string) => deDatetimeLocal(s)!.getTime();

    // Original: +7 días entre la 1ª y la 2ª, +14 entre la 2ª y la 3ª.
    expect(ms(copia.sesiones[1]!.inicio) - ms(copia.sesiones[0]!.inicio)).toBe(7 * 86_400_000);
    expect(ms(copia.sesiones[2]!.inicio) - ms(copia.sesiones[1]!.inicio)).toBe(14 * 86_400_000);
    // La tercera duraba media hora más.
    expect(ms(copia.sesiones[2]!.fin) - ms(copia.sesiones[2]!.inicio)).toBe(2.5 * 3_600_000);
  });

  it('un ciclo del año pasado arranca en el futuro: publicar la copia no crea eventos vencidos', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    const primera = deDatetimeLocal(copia.sesiones[0]!.inicio)!;
    expect(primera.getTime()).toBeGreaterThan(AHORA.getTime());
    // El primer martes de septiembre de 2025 corrido a semanas enteras cae en
    // el primer martes futuro respecto de "ahora".
    expect(copia.sesiones[0]!.inicio).toBe('2026-08-25T19:00');
  });

  it('un ciclo que todavía no terminó arranca después del último encuentro del original', () => {
    const enCurso = original({
      sesiones: [
        sesion({ id: 'ses_1', inicio: '2026-08-25T19:00', fin: '2026-08-25T21:00' }),
        sesion({ id: 'ses_2', inicio: '2026-09-01T19:00', fin: '2026-09-01T21:00' }),
      ],
    });
    const copia = duplicarActividadForm(enCurso, { ahora: AHORA });
    expect(copia.sesiones[0]!.inicio).toBe('2026-09-08T19:00');
    expect(copia.sesiones[1]!.inicio).toBe('2026-09-15T19:00');
  });

  it('nunca se queda sentada sobre las fechas del original: mínimo una semana', () => {
    const unaSola = original({
      esCiclo: false,
      sesiones: [sesion({ id: 'ses_x', inicio: '2027-01-05T19:00', fin: '2027-01-05T21:00' })],
    });
    const copia = duplicarActividadForm(unaSola, { ahora: AHORA });
    expect(copia.sesiones[0]!.inicio).toBe('2027-01-12T19:00');
    expect(diasDeDesplazamiento(unaSola.sesiones, AHORA)).toBe(7);
  });

  it('corre también el cierre de inscripción: si no, la copia sale con la inscripción cerrada', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });
    const dias = diasDeDesplazamiento(o.sesiones, AHORA);

    const cierreOriginal = deDatetimeLocal(o.inscripcion.cierra)!;
    const cierreCopia = deDatetimeLocal(copia.inscripcion.cierra)!;
    expect(Math.round((cierreCopia.getTime() - cierreOriginal.getTime()) / 86_400_000)).toBe(dias);
    // Y sigue cayendo antes del primer encuentro.
    expect(copia.inscripcion.cierra < copia.sesiones[0]!.inicio).toBe(true);
  });

  it('sin cierre de inscripción no se inventa uno', () => {
    const copia = duplicarActividadForm(
      original({ inscripcion: { ...original().inscripcion, cierra: '' } }),
      { ahora: AHORA },
    );
    expect(copia.inscripcion.cierra).toBe('');
  });

  it('una fecha inválida se deja como está para que la marque la validación', () => {
    const roto = original({
      esCiclo: false,
      sesiones: [sesion({ id: 'ses_roto', inicio: '', fin: '' })],
    });
    const copia = duplicarActividadForm(roto, { ahora: AHORA });
    expect(copia.sesiones[0]!.inicio).toBe('');
    expect(diasDeDesplazamiento(roto.sesiones, AHORA)).toBe(0);
  });
});

describe('duplicar una actividad — el resto del contenido', () => {
  it('conserva los 30+ campos que son el motivo de duplicar (§11)', () => {
    const o = original();
    const copia = duplicarActividadForm(o, { ahora: AHORA });

    expect(copia.tipo).toBe(o.tipo);
    expect(copia.descripcion).toBe(o.descripcion);
    expect(copia.modalidad).toBe(o.modalidad);
    expect(copia.sede).toEqual(o.sede);
    expect(copia.online).toEqual(o.online);
    expect(copia.arancel).toEqual(o.arancel);
    expect(copia.material).toEqual(o.material);
    /*
     * B-199 — la difusión es la excepción: nace **apagada**. Es lo único que el
     * default cambió respecto de "copiá todo", y el motivo es que son notas
     * internas y handles de otra edición que se arrastraban sin que nadie los
     * revise, porque viven en un acordeón cerrado. Su chequeo propio está en el
     * describe de B-199, con las dos direcciones.
     */
    expect(copia.difusion).toEqual({ arrobar: [], notas: '' });
    expect(copia.organizador).toEqual(o.organizador);
    expect(copia.tallerista).toEqual(o.tallerista);
    // DEC-1 — la copia hereda el libro: duplicar una presentación es la misma
    // obra en otra fecha o en otra librería. Si es otro libro, son dos campos.
    expect(copia.libro).toEqual(o.libro);
    expect(copia.tags).toEqual(o.tags);
    expect(copia.esCiclo).toBe(true);
    expect(copia.inscripcion.requiere).toBe(true);
    expect(copia.inscripcion.cupo).toBe(12);
    /**
     * B-97 — el cupo completo **no** se hereda, y es el mismo criterio que
     * `cancelada` en las sesiones: que la edición anterior se haya llenado es un
     * hecho de esa edición. La copia no tiene una sola inscripción todavía, y
     * heredarlo publicaría «Cupo completo» —al sitio y a los N eventos— sobre un
     * cupo entero libre.
     */
    expect(o.inscripcion.completo, 'el original tiene que estar completo').toBe(true);
    expect(copia.inscripcion.completo).toBe(false);
    // El tema y la lectura de cada encuentro son la mitad del trabajo de carga.
    expect(copia.sesiones.map((s) => s.tema)).toEqual(o.sesiones.map((s) => s.tema));
    expect(copia.sesiones.map((s) => s.lectura)).toEqual(o.sesiones.map((s) => s.lectura));
  });

  it('no comparte referencias con el original: editar la copia no lo toca', () => {
    const o = original();
    // La difusión se pide tildada a propósito: con el default apagado la copia
    // trae objetos nuevos vacíos, y el chequeo de "no comparte la referencia"
    // pasaría por vacío justo en el campo que más se copia por spread (B-199).
    const copia = duplicarActividadForm(o, { ahora: AHORA, copiar: { difusion: true } });

    expect(copia.sede).not.toBe(o.sede);
    expect(copia.online).not.toBe(o.online);
    expect(copia.material.items[0]).not.toBe(o.material.items[0]);
    expect(copia.difusion.arrobar).not.toBe(o.difusion.arrobar);
    expect(copia.tags).not.toBe(o.tags);
    expect(copia.organizador).not.toBe(o.organizador);
    // DEC-1 — el form del original sale de `documentoAForm`, que comparte
    // objetos con el documento que el listado tiene en memoria: pisar el título
    // del libro en la copia no puede cambiar el del original.
    expect(copia.libro).not.toBe(o.libro);
  });

  it('descancela los encuentros: una cancelación es una excepción del ciclo original', () => {
    const conCancelado = original({
      sesiones: [
        sesion({ id: 'ses_1' }),
        sesion({ id: 'ses_2', inicio: '2025-09-09T19:00', fin: '2025-09-09T21:00', cancelada: true }),
      ],
    });
    const copia = duplicarActividadForm(conCancelado, { ahora: AHORA });
    expect(copia.sesiones).toHaveLength(2);
    expect(copia.sesiones.every((s) => !s.cancelada)).toBe(true);
  });

  it('la copia pasa la validación del formulario sin tocar nada más', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA });
    const parsed = actividadFormSchema.safeParse(copia);
    expect(parsed.success).toBe(true);
  });

  it('duplicarSesionParaCopia sola también limpia id, evento y cancelación', () => {
    const s = sesion({ cancelada: true });
    const copia = duplicarSesionParaCopia(s, 7);
    expect(copia.id).not.toBe(s.id);
    expect(copia.calendarEventId).toBeNull();
    expect(copia.cancelada).toBe(false);
    expect(copia.inicio).toBe('2025-09-09T19:00');
  });
});

/**
 * B-199 — qué se copia se elige, y el default está decidido.
 *
 * El pedido del dueño (2026-08-26) es explícito en las dos direcciones, y las
 * dos se pueden perder en una "mejora" razonable:
 *
 *  1. **Prendido lo que hoy se copia.** El primer pedido era "todos apagados", y
 *     se descartó con motivo: convierte *duplicar* en *actividad nueva*, y en el
 *     caso real —«el mismo club, la temporada que viene»— habría que tildar
 *     quince casillas para conseguir lo que hoy sale de un click. Con eso se
 *     deja de usar el botón, que es peor que arrastrar una nota interna.
 *  2. **Apagado solo lo riesgoso**, y son exactamente dos: la difusión y las
 *     imágenes propias.
 *
 * El default vive en el módulo y no en el modal: un llamador que no pase nada
 * tiene que obtener esto, no el «copiá todo» de antes.
 */
describe('duplicar — qué se copia se elige (B-199)', () => {
  /**
   * Todas las casillas apagadas, para probar el camino de destildar.
   *
   * Se deriva del default en vez de escribirse a mano: una casilla nueva entra
   * sola, que es justo lo que hace falta para que estos chequeos no queden
   * mirando siete de ocho.
   */
  const nada = ((): QueCopiar => {
    const q = { ...COPIA_POR_DEFECTO };
    for (const k of Object.keys(q) as (keyof QueCopiar)[]) q[k] = false;
    return q;
  })();

  it('el default hereda lo que hoy se copia: el modal es para desmarcar, no para armar la copia de cero', () => {
    const o = original({ imagenes: [imagen()] });
    const copia = duplicarActividadForm(o, { ahora: AHORA });

    expect(copia.descripcion).toBe(o.descripcion);
    expect(copia.sesiones.map((s) => s.tema)).toEqual(o.sesiones.map((s) => s.tema));
    expect(copia.material.items).toHaveLength(1);
    expect(copia.imagenes).toHaveLength(1);
    expect(copia.inscripcion.destino).toBe('hola@casabrandon.example');
    expect(copia.inscripcion.cupo).toBe(12);
    expect(copia.tags).toEqual(['narrativa']);
  });

  it('nacen apagadas exactamente dos casillas: la difusión y las imágenes propias', () => {
    const apagadas = Object.entries(COPIA_POR_DEFECTO)
      .filter(([, v]) => !v)
      .map(([k]) => k)
      .sort();
    expect(apagadas).toEqual(['difusion', 'imagenesPropias']);
  });

  it('la difusión no se hereda: son notas y handles de otra edición que nadie revisa', () => {
    const o = original();
    // Sin esto el chequeo pasaría por vacío el día que el fixture pierda la nota.
    expect(o.difusion.notas, 'el original tiene que traer difusión').not.toBe('');

    expect(duplicarActividadForm(o, { ahora: AHORA }).difusion).toEqual({
      arrobar: [],
      notas: '',
    });
    // Y tildarla sí la trae: la casilla tiene que servir para las dos cosas.
    const conDifusion = duplicarActividadForm(o, { ahora: AHORA, copiar: { difusion: true } });
    expect(conDifusion.difusion).toEqual(o.difusion);
    expect(conDifusion.difusion.arrobar).not.toBe(o.difusion.arrobar);
  });

  it('tildar las imágenes propias todavía no cambia nada, y es a propósito (B-206)', () => {
    /*
     * La casilla existe y arranca apagada, pero hoy **no hay forma de que exista
     * una imagen propia**: subirlas es la segunda tajada de B-167 y está
     * bloqueada por B-206. Así que el camino de tildarla no hace nada distinto —
     * las propias no se heredan igual— y no hay código especulativo que decida
     * entre copiar el objeto de Storage y contar referencias (B-71).
     */
    const o = original({
      imagenes: [imagen({ id: 'img_p', origen: 'propia', storagePath: 'actividades/a/b.jpg' })],
    });
    for (const imagenesPropias of [false, true]) {
      const copia = duplicarActividadForm(o, { ahora: AHORA, copiar: { imagenesPropias } });
      expect(copia.imagenes, `imagenesPropias=${imagenesPropias}`).toEqual([]);
      expect(JSON.stringify(copia)).not.toContain('actividades/a/b.jpg');
    }
  });

  it('destildar la descripción la deja vacía y no se lleva nada más', () => {
    const copia = duplicarActividadForm(original(), {
      ahora: AHORA,
      copiar: { descripcion: false },
    });
    expect(copia.descripcion).toBe('');
    // El resto sigue: destildar una casilla no puede vaciar la de al lado.
    expect(copia.tags).toEqual(['narrativa']);
    expect(copia.material.items).toHaveLength(1);
  });

  it('destildar los temas conserva las fechas y la estructura del ciclo (D-17)', () => {
    const conTemas = duplicarActividadForm(original(), { ahora: AHORA });
    const sinTemas = duplicarActividadForm(original(), { ahora: AHORA, copiar: { temas: false } });

    expect(sinTemas.sesiones).toHaveLength(3);
    expect(sinTemas.sesiones.map((s) => s.tema)).toEqual(['', '', '']);
    expect(sinTemas.sesiones.map((s) => s.lectura)).toEqual(['', '', '']);
    // Lo que se destildó es el contenido de cada encuentro, no el ciclo: las
    // fechas corridas son las mismas que con los temas tildados.
    expect(sinTemas.sesiones.map((s) => s.inicio)).toEqual(
      conTemas.sesiones.map((s) => s.inicio),
    );
  });

  it('destildar las imágenes no deja ninguna, y con ellas queda una sola portada', () => {
    const o = original({
      imagenes: [imagen({ id: 'img_a' }), imagen({ id: 'img_b', portada: false })],
    });
    expect(
      duplicarActividadForm(o, { ahora: AHORA, copiar: { imagenes: false } }).imagenes,
    ).toEqual([]);

    const conImagenes = duplicarActividadForm(o, { ahora: AHORA });
    expect(conImagenes.imagenes.filter((i) => i.portada)).toHaveLength(1);
  });

  it('destildar el material apaga «tiene»: la lista vacía con la casilla prendida no se puede publicar', () => {
    const copia = duplicarActividadForm(original(), { ahora: AHORA, copiar: { material: false } });
    expect(copia.material).toEqual({ tiene: false, items: [] });
  });

  it('destildar la inscripción vacía el canal, el cupo y el cierre, y no toca «requiere»', () => {
    const copia = duplicarActividadForm(original(), {
      ahora: AHORA,
      copiar: { inscripcion: false },
    });
    expect(copia.inscripcion.via).toBeNull();
    expect(copia.inscripcion.destino).toBe('');
    expect(copia.inscripcion.cupo).toBeNull();
    expect(copia.inscripcion.cierra).toBe('');
    // "¿Hay que inscribirse?" es de la actividad, no de la edición: quien
    // destildó el canal no dijo que la copia sea con entrada libre.
    expect(copia.inscripcion.requiere).toBe(true);
    // Y «se llenó» sigue sin heredarse, tildado lo que se tilde (B-97).
    expect(copia.inscripcion.completo).toBe(false);
  });

  it('destildar las etiquetas las deja vacías', () => {
    expect(duplicarActividadForm(original(), { ahora: AHORA, copiar: { tags: false } }).tags).toEqual(
      [],
    );
  });

  it('lo que no se hereda no es casilla: no hay una para el slug ni para el estado', () => {
    // No se heredan y no son opcionales (trampa 10, §7.3). Una casilla los
    // volvería negociables, y publicar con «-copia» en la URL no se deshace.
    const claves = CASILLAS_COPIA.map((c) => c.clave);
    expect(claves).not.toContain('slug');
    expect(claves).not.toContain('estado');

    const copia = duplicarActividadForm(original(), { ahora: AHORA, copiar: nada });
    expect(copia.estado).toBe('borrador');
    expect(copia.slug).toBe('club-latinoamericana-copia');
    expect(copia.sesiones.every((s) => s.calendarEventId === null)).toBe(true);
    expect(copia.sesiones.every((s) => !s.cancelada)).toBe(true);
  });

  it('cada casilla del modelo tiene su fila en la pantalla, y ninguna fila sobra', () => {
    /*
     * La clase que este chequeo cierra es la de B-75: dos listas que hay que
     * mantener de acuerdo. Una clave nueva en `QueCopiar` que nadie pueda tildar
     * sería una decisión tomada a espaldas del usuario —y el default la aplica
     * igual—; una fila con una clave que ya no existe no haría nada al tildarse.
     */
    expect(CASILLAS_COPIA.map((c) => c.clave).sort()).toEqual(
      Object.keys(COPIA_POR_DEFECTO).sort(),
    );
    for (const c of CASILLAS_COPIA) {
      expect(c.label, `la casilla ${c.clave} no tiene label`).toBeTruthy();
      expect(c.ayuda, `la casilla ${c.clave} no explica por qué destildarla`).toBeTruthy();
      // El label le habla a quien organiza actividades, no al modelo (B-76): la
      // clave cruda no sale a la pantalla. («material» sí es una palabra del
      // dominio, así que lo que se busca es la forma de la clave, no la palabra.)
      expect(c.label, `la casilla ${c.clave} muestra la clave cruda`).not.toMatch(/[a-z][A-Z]/);
    }
  });

  it('el modal no ofrece lo que la actividad no tiene: una fila que no cambia nada es ruido', () => {
    const claves = (o: ActividadForm) => casillasAplicables(o).map((c) => c.clave);

    // El original tiene de todo menos imágenes.
    expect(claves(original())).toEqual([
      'descripcion',
      'temas',
      'inscripcion',
      'material',
      'tags',
      'difusion',
    ]);

    // Un borrador recién empezado no tiene nada que elegir, y ahí el listado
    // duplica directo en vez de cobrar un click de peaje.
    const pelado = original({
      descripcion: '',
      imagenes: [],
      sesiones: [sesion({ id: 'ses_p', tema: '', lectura: '' })],
      inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: '', completo: false },
      material: { tiene: false, items: [] },
      difusion: { arrobar: [], notas: '' },
      tags: [],
    });
    expect(claves(pelado)).toEqual([]);
  });

  it('destildar cualquier casilla deja una copia que el formulario acepta', () => {
    /*
     * Duplicar existe para ahorrar carga: si destildar algo dejara el formulario
     * abriendo con errores, sería el argumento con el que D-17 descartó "fechas
     * vacías". La copia nace borrador, así que lo que falta se reclama al
     * publicar y no al abrir.
     */
    /*
     * La portada del original es una imagen **propia**, que la copia no hereda:
     * es el caso que obliga a rearmar la portada sobre lo que quedó. Sin eso la
     * copia queda con cero portadas y el schema la rechaza en el nivel que corre
     * siempre, no solo al publicar.
     */
    const o = original({
      imagenes: [
        imagen({ id: 'img_p', origen: 'propia', storagePath: 'a/b.jpg', portada: true }),
        imagen({ id: 'img_e', portada: false }),
      ],
    });
    for (const clave of Object.keys(COPIA_POR_DEFECTO) as (keyof QueCopiar)[]) {
      const copia = duplicarActividadForm(o, { ahora: AHORA, copiar: { [clave]: false } });
      expect(
        actividadFormSchema.safeParse(copia).success,
        `destildar ${clave} deja una copia que el formulario rechaza`,
      ).toBe(true);
    }
    // Y todas destildadas a la vez tampoco.
    expect(
      actividadFormSchema.safeParse(duplicarActividadForm(o, { ahora: AHORA, copiar: nada }))
        .success,
    ).toBe(true);
  });
});
