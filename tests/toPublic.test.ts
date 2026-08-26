import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import type { Actividad } from '@/types/actividad';

/** Timestamp mínimo, suficiente para la proyección. */
const ts = (iso: string) => {
  const d = new Date(iso);
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  };
};

const actividad = (over: Partial<Actividad> = {}): Actividad => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros',
  imagenUrl: null,
  organizador: { nombre: 'Brandon', instagram: '@brandon', web: '' },
  tallerista: null,
  // DEC-1 — con centinelas: si el fixture no tuviera el campo, sacarlo de la
  // proyección (o meterlo de más) no rompería ningún test de este archivo.
  libro: { titulo: 'CENTINELA-LIBRO Pedro Páramo', autor: 'CENTINELA-AUTORLIBRO Juan Rulfo' },
  esCiclo: true,
  sesiones: [
    {
      id: 'ses_1',
      inicio: ts('2026-09-03T22:00:00Z'),
      fin: ts('2026-09-04T00:00:00Z'),
      tema: 'Cap. 1-4',
      lectura: 'Pedro Páramo',
      cancelada: false,
      // Interno: no debería salir al JSON público.
      calendarEventId: 'evt_secreto',
    },
  ],
  modalidad: 'virtual',
  sede: null,
  online: { plataforma: 'zoom', url: 'https://zoom.us/j/999', urlPublica: false },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: 'hola@ejemplo.com',
    cupo: 12,
    cierra: ts('2026-09-01T00:00:00Z'),
    // B-97 — en `true` en el fixture base a propósito. Con `false`, sacar
    // `completo` de la proyección no rompería ningún test de este archivo: es la
    // misma razón por la que el libro está acá con centinelas. Un booleano no
    // admite centinela, así que lo que fija la celda es el valor esperado.
    completo: true,
  },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  material: {
    tiene: true,
    items: [
      { tipo: 'lectura', titulo: 'Pedro Páramo', url: 'https://drive/publico', entrega: 'previo', publico: true },
      { tipo: 'guia', titulo: 'Guía de lectura', url: 'https://drive/privado', entrega: 'al-inscribirse', publico: false },
    ],
  },
  difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
  estado: 'publicado',
  tags: ['narrativa'],
  destacado: false,
  searchText: 'club de lectura latinoamericana',
  createdAt: ts('2026-08-01T00:00:00Z'),
  updatedAt: ts('2026-08-02T00:00:00Z'),
  createdBy: 'uid_abc',
  updatedBy: 'uid_abc',
  ...over,
});

describe('toPublic — §5, trampa 5', () => {
  it('por defecto no filtra el link de la reunión, solo la plataforma', () => {
    const p = toPublic(actividad(), 'id1');
    expect(p.online).toEqual({ plataforma: 'zoom' });
    expect(JSON.stringify(p)).not.toContain('zoom.us/j/999');
  });

  it('publica el link si urlPublica está en true', () => {
    // Desvío consciente del §5.2, decidido por el dueño.
    const a = actividad();
    a.online = { plataforma: 'zoom', url: 'https://zoom.us/j/abierto', urlPublica: true };
    expect(toPublic(a, 'id1').online).toEqual({
      plataforma: 'zoom',
      url: 'https://zoom.us/j/abierto',
    });
  });

  it('urlPublica en true sin URL no inventa el campo', () => {
    const a = actividad();
    a.online = { plataforma: 'zoom', url: '', urlPublica: true };
    expect(toPublic(a, 'id1').online).toEqual({ plataforma: 'zoom' });
  });

  it('no incluye difusion', () => {
    const p = toPublic(actividad(), 'id1');
    expect('difusion' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('coordinar con prensa');
  });

  it('no incluye createdBy ni updatedBy', () => {
    const json = JSON.stringify(toPublic(actividad(), 'id1'));
    expect(json).not.toContain('uid_abc');
  });

  it('un material privado conserva título y tipo pero pierde la URL', () => {
    const p = toPublic(actividad(), 'id1');
    const [publico, privado] = p.material.items;
    expect(publico!.url).toBe('https://drive/publico');
    expect(privado!.titulo).toBe('Guía de lectura');
    expect(privado!.url).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain('drive/privado');
  });

  it('no expone el calendarEventId de las sesiones', () => {
    const p = toPublic(actividad(), 'id1');
    expect(JSON.stringify(p)).not.toContain('evt_secreto');
    expect(p.sesiones[0]!.tema).toBe('Cap. 1-4');
  });
});

describe('toPublic — el libro presentado (DEC-1, §5.1, trampa 5)', () => {
  /**
   * La decisión del paso 0: el libro **es público**. Es información de la
   * actividad, del mismo orden que el título y el tallerista, y es lo que hace
   * que alguien que busca la obra encuentre la presentación.
   *
   * Está acá y con centinelas porque la celda de la tabla tiene que estar fijada
   * en los dos sentidos: que salga, y que salga **solo lo decidido**.
   */
  it('sale al events.json, con título y autor', () => {
    const p = toPublic(actividad(), 'id1');
    expect(p.libro).toEqual({
      titulo: 'CENTINELA-LIBRO Pedro Páramo',
      autor: 'CENTINELA-AUTORLIBRO Juan Rulfo',
    });
  });

  it('enumera los dos campos: una clave de más en el documento no sale (§5.2)', () => {
    // La proyección es whitelist, no spread: el campo que alguien agregue mañana
    // a `libro` no se publica solo.
    const conExtra = actividad({
      libro: {
        titulo: 'Pedro Páramo',
        autor: '',
        // @ts-expect-error — a propósito: simula el campo interno de mañana.
        notasInternas: 'CENTINELA-NOTAS coordinar con la editorial',
      },
    });
    const p = toPublic(conExtra, 'id1');
    expect(JSON.stringify(p.libro)).not.toContain('CENTINELA-NOTAS');
    expect(Object.keys(p.libro!).sort()).toEqual(['autor', 'titulo']);
  });

  it('sin título no inventa el campo (D-15)', () => {
    // Los documentos anteriores a DEC-1 no lo tienen, y una actividad que no es
    // presentación tampoco: en los tres casos el JSON dice `null` y el sitio no
    // pinta un rótulo vacío.
    expect(toPublic(actividad({ libro: undefined }), 'id1').libro).toBeNull();
    expect(toPublic(actividad({ libro: null }), 'id1').libro).toBeNull();
    expect(toPublic(actividad({ libro: { titulo: '', autor: 'Rulfo' } }), 'id1').libro).toBeNull();
  });
});

describe('toPublic — inscripción', () => {
  it('marca la inscripción cerrada cuando ya pasó la fecha', () => {
    const p = toPublic(actividad(), 'id1', new Date('2026-09-02T00:00:00Z').getTime());
    expect(p.inscripcion.abierta).toBe(false);
  });

  it('la marca abierta antes de la fecha de cierre', () => {
    const p = toPublic(actividad(), 'id1', new Date('2026-08-15T00:00:00Z').getTime());
    expect(p.inscripcion.abierta).toBe(true);
  });

  it('sin fecha de cierre queda abierta', () => {
    const a = actividad();
    a.inscripcion.cierra = null;
    expect(toPublic(a, 'id1').inscripcion.abierta).toBe(true);
  });

  /**
   * B-97, §5.1 — la decisión del paso 0: «se llenó» **es público**, y es el
   * punto del campo. Sin esto el `events.json` sigue diciendo «cupo: 12» cuando
   * ya no entra nadie, y un número viejo es peor que ningún número porque parece
   * información fresca.
   */
  it('el cupo completo sale al events.json (B-97, §5.1, trampa 5)', () => {
    expect(toPublic(actividad(), 'id1').inscripcion.completo).toBe(true);
  });

  /**
   * La segunda decisión, y la que una "mejora" razonable rompería: **el canal de
   * inscripción no se esconde**. Siempre hay lista de espera y las bajas
   * existen, así que esconder el canal convierte una baja en un lugar que se
   * pierde. El cartel va al lado del canal, no en su lugar.
   */
  it('con el cupo completo el canal de inscripción sigue saliendo (B-97)', () => {
    const p = toPublic(actividad(), 'id1');
    expect(p.inscripcion.completo).toBe(true);
    expect(p.inscripcion.via).toBe('mail');
    expect(p.inscripcion.destino).toBe('hola@ejemplo.com');
    // Y el cupo numérico tampoco se borra: sigue siendo información de cuántos
    // eran, no una promesa de lugares libres.
    expect(p.inscripcion.cupo).toBe(12);
  });

  it('un documento anterior a B-97 se publica como no completo (D-26)', () => {
    // El default de lectura preserva el comportamiento anterior: ni el sitio ni
    // nadie puede empezar a decir «Cupo completo» por un campo que falta.
    const a = actividad();
    delete a.inscripcion.completo;
    expect(toPublic(a, 'id1').inscripcion.completo).toBe(false);
  });

  it('enumera lo que sale de la inscripción: una clave de más no se publica (§5.2)', () => {
    // La proyección es whitelist, no spread. Es la guarda que hace que `completo`
    // sea una decisión y no un accidente — y la que va a frenar al campo que se
    // agregue mañana al lado suyo.
    const conExtra = actividad();
    // @ts-expect-error — a propósito: el campo interno de mañana.
    conExtra.inscripcion.notaInterna = 'CENTINELA-NOTAS llamar a la sede';
    const p = toPublic(conExtra, 'id1');
    expect(JSON.stringify(p.inscripcion)).not.toContain('CENTINELA-NOTAS');
    expect(Object.keys(p.inscripcion).sort()).toEqual([
      'abierta',
      'completo',
      'cupo',
      'destino',
      'requiere',
      'via',
    ]);
  });
});

describe('toPublic — fechas', () => {
  it('serializa los Timestamp a ISO, sin corrimiento', () => {
    const p = toPublic(actividad(), 'id1');
    expect(p.sesiones[0]!.inicio).toBe('2026-09-03T22:00:00.000Z');
    expect(p.sesiones[0]!.fin).toBe('2026-09-04T00:00:00.000Z');
  });
});
