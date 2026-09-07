import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// Las Functions son JS plano; TS les infiere los tipos con allowJs.
import {
  MARCA_DE_PUBLICADA,
  camposCambiados,
  contenidoEditable,
  estuvoPublicada,
  faltaMarcarPublicada,
  huboCambioDeContenido,
  marcadaComoPublicada,
} from '../functions/historial.js';
import { formADocumento, payloadDeActualizacion } from '@/lib/actividades';
import { duplicarActividadForm } from '@/lib/duplicar';
import { slugRestaurable } from '@/lib/historial';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { toPublic } from '@/lib/toPublic';
import type { Actividad } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/**
 * B-285 — `publicadaAlgunaVez`: «estuvo publicada alguna vez» se **guarda**, no
 * se infiere.
 *
 * La pregunta la necesita B-110: una actividad `cancelado` conserva su página
 * pública solo si estuvo publicada, porque publicar la de un borrador que nació y
 * murió sin ver la luz sería filtrar un borrador. Hasta acá se inferían dos cosas
 * (D-159): que alguna sesión conserve `calendarEventId` —heurística que el propio
 * sync borra al cancelar— y, si no, que `/versiones` tenga una entrada publicada.
 *
 * Lo que este archivo fija, en orden de qué duele más si se rompe:
 *
 * 1. **El default de lectura de los documentos que ya existen.** Ausente
 *    significa «no lo sabemos», **no** `false`: con un `?? false` una cancelada
 *    de hace un mes perdería su página, que es exactamente la regresión de B-110
 *    (un 404 en una URL que estuvo tres semanas en Google y en Instagram).
 * 2. **La guarda anti-loop** (trampa 3): el trigger escribe en el documento que lo
 *    disparó, así que la escritura no puede contar como cambio de contenido ni
 *    repetirse en la segunda pasada.
 * 3. **Un solo dueño por campo**: el panel no lo escribe, así que no puede
 *    apagarlo por omisión (la clase de B-80).
 * 4. **Que el candado del slug deje de tener puerta de atrás** (trampa 10).
 */

const actividad = (over: Partial<Actividad> = {}): Actividad =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica urbana',
    slug: 'taller-cronica',
    descripcion: 'Ocho encuentros de crónica.',
    imagenes: [],
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [],
    modalidades: [],
    modalidad: 'presencial',
    sede: null,
    online: null,
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'publicado',
    tags: [],
    destacado: false,
    searchText: '',
    createdAt: ts('2026-08-01T00:00:00Z'),
    updatedAt: ts('2026-08-01T00:00:00Z'),
    createdBy: 'uid',
    updatedBy: 'uid',
    ...over,
  }) as Actividad;

describe('el campo contesta, y ausente NO es «no» (D-26, D-159)', () => {
  it('marcadaComoPublicada es estricto: ausente no afirma nada', () => {
    // Es la mitad que protege a B-110. Si esto fuera `??`, una cancelada
    // anterior al campo daría «nunca estuvo publicada» y el build no generaría
    // su página — sin que nada falle.
    expect(marcadaComoPublicada(actividad({ estado: 'cancelado' }))).toBe(false);
    expect(marcadaComoPublicada(actividad({ estado: 'cancelado', publicadaAlgunaVez: true }))).toBe(
      true,
    );
    expect(marcadaComoPublicada(undefined)).toBe(false);
  });

  it('estuvoPublicada, el default del panel, preserva el comportamiento anterior', () => {
    // Para un documento sin la clave devuelve exactamente el
    // `estado === 'publicado'` que el formulario y el historial usaban antes:
    // el cambio no afloja ni endurece nada retroactivamente.
    expect(estuvoPublicada(actividad({ estado: 'publicado' }))).toBe(true);
    expect(estuvoPublicada(actividad({ estado: 'borrador' }))).toBe(false);
    expect(estuvoPublicada(actividad({ estado: 'cancelado' }))).toBe(false);
    // Y sin documento —una actividad nueva, que el formulario todavía no
    // guardó— la respuesta es «no», que es lo que deja editar el slug.
    expect(estuvoPublicada(undefined)).toBe(false);
  });

  it('con la marca puesta, el estado de hoy ya no manda', () => {
    expect(estuvoPublicada(actividad({ estado: 'borrador', publicadaAlgunaVez: true }))).toBe(true);
  });
});

describe('quién lo escribe: el trigger, y una sola vez', () => {
  it('falta marcar cuando se publica y todavía no está marcada', () => {
    expect(faltaMarcarPublicada(actividad({ estado: 'publicado' }))).toBe(true);
  });

  it('ya marcada, no se vuelve a escribir: es la guarda anti-loop (trampa 3)', () => {
    // MUTACIÓN PROBADA: sacar el `!marcadaComoPublicada(...)` hace que cada
    // pasada escriba de nuevo y el trigger se dispare a sí mismo sin parar.
    expect(faltaMarcarPublicada(actividad({ estado: 'publicado', publicadaAlgunaVez: true }))).toBe(
      false,
    );
  });

  it('no se marca lo que no está publicado, y tampoco un borrado', () => {
    for (const estado of ['borrador', 'pendiente', 'cancelado'] as const) {
      expect(faltaMarcarPublicada(actividad({ estado })), estado).toBe(false);
    }
    // `despues` es `null` cuando el documento se borró: no hay nada que marcar.
    expect(faltaMarcarPublicada(null)).toBe(false);
  });

  it('es pegajoso: no hay camino que lo apague', () => {
    // Despublicar no des-indexa la URL, así que la pregunta no tiene vuelta
    // atrás. La afirmación es sobre el módulo: ninguna función escribe `false`.
    const fuente = readFileSync('functions/marca-de-publicada.js', 'utf8');
    expect(fuente).toContain(`[MARCA_DE_PUBLICADA]: true`);
    expect(fuente).not.toMatch(/MARCA_DE_PUBLICADA\]:\s*false/);
  });
});

describe('la otra mitad de la guarda anti-loop: es campo de máquina (D-41, D-07)', () => {
  it('el write-back no cuenta como cambio de contenido', () => {
    // Sin esto, cada publicación costaría **una versión de historial y un
    // rebuild del sitio** de más: el trigger escribe la marca, eso vuelve a
    // disparar los triggers, y `huboCambioDeContenido` vería un cambio.
    const antes = actividad();
    const despues = actividad({ publicadaAlgunaVez: true });
    expect(huboCambioDeContenido(antes, despues)).toBe(false);
    expect(camposCambiados(antes, despues)).toEqual([]);
  });

  it('y por lo mismo el panel no lo ofrece para restaurar', () => {
    // `camposRestaurables` filtra por `camposCambiados`, que ya lo excluye: el
    // historial no puede ofrecer «restaurar» un campo que escribe la máquina.
    expect(contenidoEditable(actividad({ publicadaAlgunaVez: true }))).not.toHaveProperty(
      MARCA_DE_PUBLICADA,
    );
  });
});

describe('un solo dueño por campo: el panel no lo escribe (clase de B-80)', () => {
  const form = { ...formVacio(), titulo: 'Taller', slug: 'taller' };

  it('formADocumento no lo emite', () => {
    // Es lo que hace que `updateDoc` no pueda apagarlo por omisión: la clave no
    // viaja, así que el documento conserva la que tiene.
    expect(formADocumento(form, 'uid', true)).not.toHaveProperty(MARCA_DE_PUBLICADA);
    expect(formADocumento(form, 'uid', false)).not.toHaveProperty(MARCA_DE_PUBLICADA);
  });

  it('el payload de actualización tampoco', () => {
    expect(payloadDeActualizacion(form, 'uid', [])).not.toHaveProperty(MARCA_DE_PUBLICADA);
  });

  it('una copia nace sin la marca y en borrador: nunca estuvo publicada', () => {
    // No hace falta una rama en `duplicar.ts`: el campo no está en el
    // formulario, así que la copia no lo puede heredar.
    const copia = duplicarActividadForm({ ...form, imagenes: [] }, { tomados: [] });
    expect(copia).not.toHaveProperty(MARCA_DE_PUBLICADA);
    expect(copia.estado).toBe('borrador');
    expect(estuvoPublicada(copia)).toBe(false);
  });
});

describe('el candado del slug se cierra por los dos lados (trampa 10)', () => {
  it('un borrador que estuvo publicado no puede restaurar el slug', () => {
    // Era `actual.estado !== 'publicado'`: bastaba despublicar para abrir la
    // puerta de atrás sobre una URL ya indexada.
    expect(slugRestaurable(actividad({ estado: 'borrador', publicadaAlgunaVez: true }))).toBe(false);
  });

  it('pero uno que nunca se publicó sí, que es el control negativo', () => {
    expect(slugRestaurable(actividad({ estado: 'borrador' }))).toBe(true);
  });

  it('el formulario pregunta lo mismo con la misma función, no con una copia', () => {
    // La clase de B-88: dos ideas del mismo predicado se separan sin que nada
    // falle, y la que se olvide del campo vuelve a abrir el candado.
    const fuente = readFileSync('src/components/admin/ActividadFormulario.tsx', 'utf8');
    expect(fuente).toContain("from '@historial'");
    // La asignación, no una mención: `slugBloqueado` sale de la función
    // compartida y no de un predicado escrito acá. (No se afirma la ausencia del
    // predicado viejo por texto: el docblock lo cita para explicar qué cambió, y
    // un aserto negativo sobre prosa se rompe por un renombre — B-202.)
    expect(fuente).toMatch(/const slugBloqueado = estuvoPublicada\(inicial\)/);
  });
});

describe('no sale a ninguna salida pública: es un predicado (§5.1)', () => {
  it('el events.json no lo lleva', () => {
    // Es el criterio de `updatedAt` en B-109: decide si se genera la página, y
    // no se emite en ninguna parte. Publicarlo diría además, de una actividad en
    // borrador, que alguna vez estuvo publicada — dato de gestión.
    const publica = toPublic(actividad({ publicadaAlgunaVez: true }), 'act-1');
    expect(publica).not.toHaveProperty(MARCA_DE_PUBLICADA);
    expect(JSON.stringify(publica)).not.toContain(MARCA_DE_PUBLICADA);
  });
});

describe('el efecto está donde tiene que estar', () => {
  it('el trigger lo escribe antes de sus dos cortes tempranos (clase de B-83)', () => {
    // La marca corresponde porque la actividad **pasó a publicado**, no porque
    // el calendario haya recibido operaciones. Lo fija además
    // `tests/clases-de-bug.test.ts` por la clase; acá queda el caso con nombre.
    const fuente = readFileSync('functions/calendario-trigger.js', 'utf8');
    const marca = fuente.indexOf('marcarPublicada(db, id)');
    const sinOps = fuente.indexOf('ops.length === 0');
    const sinCalendario = fuente.indexOf('!CALENDAR_ID');
    expect(marca).toBeGreaterThan(0);
    expect(marca).toBeLessThan(sinOps);
    expect(marca).toBeLessThan(sinCalendario);
  });
});
