/**
 * **El tablero del backlog** — `scripts/tablero/parseo.mjs`.
 *
 * ── Por qué esto tiene tests y otras herramientas locales no ──────────────
 * Porque **escribe en `docs/BACKLOG.md`**, que es el archivo donde vive el rastro
 * de todo lo que se rompió en este proyecto y por qué. Una herramienta que lee mal
 * muestra una pantalla equivocada; una que escribe mal se lleva prosa que costó
 * escribir y que nadie va a poder reconstruir. El skill `al-backlog` lo dice como
 * regla: «no borres el texto, el rastro importa más que la prolijidad de la
 * lista».
 *
 * Los casos de abajo son, casi todos, **formas de encabezado que el archivo real
 * tiene hoy** — con el marcador antes de la prioridad y después, con rayas largas
 * adentro del título, con dos fechas, con sufijo de letra. No son inventadas: se
 * sacaron del archivo al escribir el parser, y una de ellas encontró un bug
 * (`… retención· P1`, pegado, al sacarle el `— ✅ hecho (fecha)`).
 *
 * ── Lo que estos tests **no** cubren ──────────────────────────────────────
 * El servidor (`servidor.mjs`): HTTP, escritura atómica y el latido. Se probó a
 * mano de punta a punta el 2026-09-15 —lectura, nota, alta y el `409` de la
 * precondición— contra una copia del archivo. Lo que sí está acá es toda la
 * lógica que decide **qué texto queda escrito**, que es donde está el daño
 * posible.
 */
import { describe, expect, it } from 'vitest';

import {
  conEstado,
  conItemNuevo,
  conNota,
  conPrioridad,
  idsUsados,
  parsearBacklog,
  parsearIdeas,
  proximoNumero,
} from '../scripts/tablero/parseo.mjs';

/** Un backlog de juguete con las formas de encabezado que el real usa. */
const BACKLOG = [
  '# Backlog',
  '',
  '## P1 — bloquean el objetivo del proyecto',
  '',
  '### B-900 · Un título con una raya larga — y una aclaración · P1 — pedido del dueño (2026-09-15)',
  '',
  'El cuerpo del primero.',
  '',
  '### B-901 · Algo que ya se hizo — ✅ hecho (2026-09-11) · P1',
  '',
  'El cuerpo del segundo.',
  '',
  '## P2 — mejoras reales',
  '',
  '### B-902 · Algo empezado · P2 — 🟠 empezado (2026-09-12)',
  '',
  'El cuerpo del tercero.',
  '',
  '### B-903a · Una mitad manual del dueño',
  '',
  'Sin prioridad propia: la hereda de la sección.',
  '',
].join('\n');

describe('el parser del backlog', () => {
  const { items, secciones } = parsearBacklog(BACKLOG);

  it('encuentra los ítems y sus secciones', () => {
    expect(items.map((i) => i.id)).toEqual(['B-900', 'B-901', 'B-902', 'B-903a']);
    expect(secciones).toEqual(['P1 — bloquean el objetivo del proyecto', 'P2 — mejoras reales']);
  });

  it('no corta el título en la raya larga, solo en el marcador de estado', () => {
    // El bug que este caso impide: anclar en `—` deja el título en «Un título con
    // una raya larga» y se come la mitad que explica de qué se trata.
    expect(items[0].titulo).toBe(
      'Un título con una raya larga — y una aclaración — pedido del dueño (2026-09-15)',
    );
    expect(items[1].titulo).toBe('Algo que ya se hizo');
  });

  it('lee el estado de los dos marcadores que el archivo usa, y del que no los tiene', () => {
    expect(items.map((i) => i.estado)).toEqual(['abierto', 'hecho', 'empezado', 'abierto']);
  });

  it('la prioridad del encabezado gana, y la de la sección se hereda', () => {
    expect(items.map((i) => i.prioridad)).toEqual(['P1', 'P1', 'P2', 'P2']);
    expect(items.map((i) => i.prioridadPropia)).toEqual([true, true, true, false]);
  });

  it('el cuerpo llega entero y la línea apunta al encabezado', () => {
    expect(items[0].cuerpo).toBe('El cuerpo del primero.');
    expect(BACKLOG.split('\n')[items[0].linea - 1]).toBe(items[0].encabezado);
  });

  it('el próximo id sale del número más alto que el archivo nombre', () => {
    expect(proximoNumero(BACKLOG)).toBe(904);
    // Un id citado en la prosa de otro ítem también cuenta: está comprometido
    // aunque no tenga sección propia (es lo que evita el choque de B-930).
    expect(proximoNumero(`${BACKLOG}\nVer B-999 para el contexto.`)).toBe(1000);
    expect(idsUsados(BACKLOG).has('B-903a')).toBe(true);
  });
});

describe('las ideas', () => {
  it('salen de los títulos numerados de 11-ideas-de-producto.md', () => {
    const ideas = parsearIdeas(['# Ideas', '', '## 2 · "Esta semana" arriba', '', 'Cuerpo.', ''].join('\n'));
    expect(ideas).toHaveLength(1);
    expect(ideas[0]).toMatchObject({ id: 'IDEA-2', numero: 2, titulo: '"Esta semana" arriba' });
  });
});

describe('cambiar la prioridad', () => {
  const enc = (texto: string, id: string) =>
    parsearBacklog(texto).items.find((i) => i.id === id)!.encabezado;

  it('pisa la que estaba, en su lugar', () => {
    const r = conPrioridad(BACKLOG, enc(BACKLOG, 'B-900'), 'P0') as { texto: string };
    expect(enc(r.texto, 'B-900')).toBe(
      '### B-900 · Un título con una raya larga — y una aclaración · P0 — pedido del dueño (2026-09-15)',
    );
  });

  it('la agrega al final cuando el ítem la heredaba de la sección', () => {
    const r = conPrioridad(BACKLOG, enc(BACKLOG, 'B-903a'), 'P3') as { texto: string };
    expect(enc(r.texto, 'B-903a')).toBe('### B-903a · Una mitad manual del dueño · P3');
  });

  it('rechaza una prioridad que no existe', () => {
    expect(conPrioridad(BACKLOG, enc(BACKLOG, 'B-900'), 'P9')).toEqual({
      error: 'Prioridad inválida: P9',
    });
  });
});

describe('cambiar el estado', () => {
  const enc = (texto: string, id: string) =>
    parsearBacklog(texto).items.find((i) => i.id === id)!.encabezado;

  it('marca hecho con la fecha', () => {
    const r = conEstado(BACKLOG, enc(BACKLOG, 'B-900'), 'hecho', '2026-09-20') as { texto: string };
    expect(enc(r.texto, 'B-900')).toContain('— ✅ hecho (2026-09-20)');
    expect(parsearBacklog(r.texto).items[0].estado).toBe('hecho');
  });

  it('reabrir saca el marcador sin dejar el texto pegado', () => {
    // Este es el caso que encontró el bug: el marcador venía seguido de ` · P1`
    // y sacarlo con el espacio de adelante devolvía «… hizo· P1».
    const r = conEstado(BACKLOG, enc(BACKLOG, 'B-901'), 'abierto', '2026-09-20') as { texto: string };
    expect(enc(r.texto, 'B-901')).toBe('### B-901 · Algo que ya se hizo · P1');
  });

  it('ida y vuelta deja el archivo exactamente como estaba', () => {
    const ida = conEstado(BACKLOG, enc(BACKLOG, 'B-902'), 'abierto', '2026-09-20') as { texto: string };
    const vuelta = conEstado(ida.texto, enc(ida.texto, 'B-902'), 'empezado', '2026-09-12') as {
      texto: string;
    };
    expect(parsearBacklog(vuelta.texto).items.find((i) => i.id === 'B-902')!.estado).toBe('empezado');
  });

  it('no escribe nada si el encabezado ya no está en el disco', () => {
    /*
     * La precondición, y no es teórica: el 2026-09-15 dos frentes escribieron en
     * este archivo con minutos de diferencia. Fallar es lo correcto — pisar el
     * trabajo del otro es peor.
     */
    expect(conEstado(BACKLOG, '### B-900 · otro título', 'hecho', '2026-09-20')).toHaveProperty(
      'error',
    );
  });
});

describe('agregar una nota', () => {
  it('la deja como cita fechada debajo del encabezado, sin tocar el cuerpo', () => {
    const encabezado = parsearBacklog(BACKLOG).items[0].encabezado;
    const r = conNota(BACKLOG, encabezado, 'Volvió a pasar.', '2026-09-20') as { texto: string };
    const lineas = r.texto.split('\n');
    const i = lineas.indexOf(encabezado);
    expect(lineas.slice(i + 1, i + 4)).toEqual([
      '',
      '> **Nota del 2026-09-20:** Volvió a pasar.',
      '',
    ]);
    expect(parsearBacklog(r.texto).items[0].cuerpo).toContain('El cuerpo del primero.');
  });

  it('una nota vacía no escribe', () => {
    const encabezado = parsearBacklog(BACKLOG).items[0].encabezado;
    expect(conNota(BACKLOG, encabezado, '   ', '2026-09-20')).toEqual({ error: 'La nota está vacía.' });
  });
});

describe('crear un ítem', () => {
  it('entra al principio de su sección, con cuerpo o con el recordatorio', () => {
    const r = conItemNuevo(BACKLOG, {
      id: 'B-904',
      titulo: 'Algo nuevo',
      prioridad: 'P2',
      seccion: 'P2 — mejoras reales',
      cuerpo: '',
      hoy: '2026-09-20',
    }) as { texto: string };
    const items = parsearBacklog(r.texto).items;
    expect(items.map((i) => i.id)).toEqual(['B-900', 'B-901', 'B-904', 'B-902', 'B-903a']);
    expect(items[2].seccion).toBe('P2 — mejoras reales');
    expect(items[2].cuerpo).toContain('Falta el cuerpo');
  });

  it('rechaza un id que el archivo ya nombra', () => {
    /*
     * La otra mitad de la defensa contra el choque de numeración: el servidor
     * recalcula el id contra el disco justo antes de escribir, y esto frena el
     * caso en que igual llegue uno tomado.
     */
    expect(
      conItemNuevo(BACKLOG, {
        id: 'B-901',
        titulo: 'x',
        prioridad: 'P2',
        seccion: 'P2 — mejoras reales',
        cuerpo: '',
        hoy: '2026-09-20',
      }),
    ).toHaveProperty('error');
  });

  it('rechaza una sección que no existe y un título vacío', () => {
    const base = {
      id: 'B-904',
      titulo: 'x',
      prioridad: 'P2',
      seccion: 'P9 — no existe',
      cuerpo: '',
      hoy: '2026-09-20',
    };
    expect(conItemNuevo(BACKLOG, base)).toHaveProperty('error');
    expect(conItemNuevo(BACKLOG, { ...base, seccion: 'P2 — mejoras reales', titulo: ' ' })).toEqual({
      error: 'El título es obligatorio.',
    });
  });
});

describe('contra el archivo real', () => {
  it('parsea docs/BACKLOG.md entero y no pierde ítems', async () => {
    /*
     * Control positivo: si el parser dejara de reconocer los encabezados, todos
     * los casos de arriba seguirían en verde sobre su backlog de juguete y la
     * pantalla mostraría un tablero vacío. El número no se escribe —envejece— :
     * lo que se afirma es la forma.
     */
    const { readFile } = await import('node:fs/promises');
    const texto = await readFile(`${process.cwd()}/docs/BACKLOG.md`, 'utf8');
    const { items, secciones } = parsearBacklog(texto);
    expect(items.length).toBeGreaterThan(100);
    expect(secciones).toContain('P1 — bloquean el objetivo del proyecto');
    expect(items.every((i) => i.id.startsWith('B-') || i.id.startsWith('DEC-'))).toBe(true);
    expect(items.some((i) => i.estado === 'hecho')).toBe(true);
    expect(items.some((i) => i.estado === 'abierto')).toBe(true);
    // Y el encabezado que devuelve es el que está en el archivo, carácter por
    // carácter: es la precondición de toda escritura.
    const lineas = texto.split('\n');
    expect(items.every((i) => lineas[i.linea - 1] === i.encabezado)).toBe(true);
  });
});
