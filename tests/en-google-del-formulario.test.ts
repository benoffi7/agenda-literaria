/**
 * Lo que una actividad pierde en Google si se publica así — B-813, la mitad
 * por-actividad.
 *
 * Tres cosas se fijan acá, y la tercera es la que justifica el archivo:
 *
 * 1. **Cada uno de los cuatro datos aparece cuando falta y se va cuando está.**
 * 2. **Solo lo accionable (D-273):** lo que el formulario no pide —el tallerista
 *    de un club, el monto de gratis o a la gorra— no se avisa.
 * 3. **La barra y el tablero contestan lo mismo (D-88).** Para cada caso, que la
 *    barra diga «sale sin X» tiene que ser exactamente que el tablero no cuente
 *    esa actividad en la proporción de X. Si alguien reescribe una condición en
 *    `enGoogle.ts` en vez de importarla, este bloque se pone rojo.
 */
import { describe, expect, it } from 'vitest';

import { formADocumento } from '@/lib/actividades';
import { estadoDelCatalogo } from '@/lib/estadoDelCatalogo';
import {
  ENCABEZADO_EN_GOOGLE,
  loQuePierdeEnGoogle,
  separadorEnGoogle,
  textoEnGoogle,
} from '@/lib/formulario/enGoogle';
import { SECCIONES } from '@/lib/formulario/camposFaltantes';
import type { ActividadConId, ActividadForm } from '@/types/actividad';
import { formularioLleno } from './fixtures/formulario';

const ids = (form: ActividadForm) => loQuePierdeEnGoogle(form).map((p) => p.id);

const sinNada = (over: Partial<ActividadForm> = {}): ActividadForm =>
  formularioLleno({
    imagenes: [],
    tallerista: null,
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    arancel: { tipo: 'arancelado', notas: '', monto: null },
    ...over,
  });

describe('los cuatro datos (B-813)', () => {
  it('un formulario completo no pierde nada (control positivo del fixture)', () => {
    expect(loQuePierdeEnGoogle(formularioLleno())).toEqual([]);
    expect(textoEnGoogle([])).toBe('');
  });

  it('sin ninguno, los cuatro, en el orden del resultado de búsqueda', () => {
    expect(ids(sinNada())).toEqual(['foto', 'quien', 'web', 'precio']);
  });

  it('cada uno se va cuando se carga', () => {
    expect(ids(formularioLleno({ imagenes: [] }))).toEqual(['foto']);
    expect(
      ids(
        formularioLleno({
          tallerista: { nombre: '  ', bio: '', instagram: '' },
        }),
      ),
    ).toEqual(['quien']);
    expect(
      ids(
        formularioLleno({
          organizador: { nombre: 'X', instagram: '', web: '' },
        }),
      ),
    ).toEqual(['web']);
    expect(
      ids(
        formularioLleno({
          arancel: { tipo: 'arancelado', notas: '', monto: null },
        }),
      ),
    ).toEqual(['precio']);
    expect(
      ids(
        formularioLleno({
          arancel: { tipo: 'arancelado', notas: '', monto: 15000 },
        }),
      ),
    ).toEqual([]);
  });

  it('una web cargada que no enlaza se nombra distinto que una vacía', () => {
    const vacia = loQuePierdeEnGoogle(
      formularioLleno({ organizador: { nombre: 'X', instagram: '', web: '' } }),
    )[0]!;
    const rota = loQuePierdeEnGoogle(
      formularioLleno({
        organizador: { nombre: 'X', instagram: '', web: 'Casa Brandon / IG' },
      }),
    )[0]!;
    expect(vacia.id).toBe('web');
    expect(rota.id).toBe('web');
    expect(rota.etiqueta).not.toBe(vacia.etiqueta);
    expect(rota.etiqueta).toContain('no es una dirección');
  });

  it('cada aviso lleva a una sección que existe', () => {
    const existentes = new Set<string>(SECCIONES.map((s) => s.id));
    for (const p of loQuePierdeEnGoogle(sinNada())) expect(existentes.has(p.seccion)).toBe(true);
  });
});

describe('solo lo que el formulario pide (D-273)', () => {
  it('en un club o un encuentro no se pide quién la da: no hay campo', () => {
    expect(ids(sinNada({ tipo: 'club-lectura' }))).not.toContain('quien');
    expect(ids(sinNada({ tipo: 'encuentro' }))).not.toContain('quien');
  });

  it('en una presentación o una charla sí: es la persona invitada', () => {
    expect(ids(sinNada({ tipo: 'presentacion' }))).toContain('quien');
    expect(ids(sinNada({ tipo: 'charla' }))).toContain('quien');
  });

  it('gratis y a la gorra no piden monto, y sin arancel elegido tampoco', () => {
    for (const tipo of ['gratis', 'a-la-gorra', '']) {
      expect(ids(sinNada({ arancel: { tipo, notas: '', monto: null } }))).not.toContain('precio');
    }
  });
});

describe('la frase', () => {
  it('coma entre los del medio y «ni» antes del último', () => {
    expect(textoEnGoogle(loQuePierdeEnGoogle(sinNada()))).toBe(
      `${ENCABEZADO_EN_GOOGLE} foto, quién la da, la web del organizador ni precio.`,
    );
    expect(textoEnGoogle(loQuePierdeEnGoogle(formularioLleno({ imagenes: [] })))).toBe(
      `${ENCABEZADO_EN_GOOGLE} foto.`,
    );
    expect([0, 1].map((i) => separadorEnGoogle(i, 2))).toEqual(['', ' ni ']);
  });

  it('dice que se publica igual: es aviso, no bloqueo (D-440)', () => {
    expect(ENCABEZADO_EN_GOOGLE).toMatch(/se publica igual/i);
  });
});

describe('la barra y el tablero dicen lo mismo (D-88)', () => {
  /*
   * Se arma la actividad con `formADocumento` —lo que de verdad se guardaría— y
   * se la pasa publicada por `estadoDelCatalogo`. Para cada dato, «la barra lo
   * avisa» tiene que ser «el tablero no la cuenta». La foto se compara contra
   * `conFlyer`, que es la misma pregunta (`faltaElFlyer`).
   */
  const AHORA = new Date('2026-09-24T12:00:00-03:00');

  const casos: [string, ActividadForm][] = [
    ['completa', formularioLleno()],
    ['vacía', sinNada()],
    ['sin foto', formularioLleno({ imagenes: [] })],
    ['sin tallerista', formularioLleno({ tallerista: null })],
    [
      'web rota',
      formularioLleno({
        organizador: { nombre: 'X', instagram: '', web: 'no es url' },
      }),
    ],
    ['sin web', formularioLleno({ organizador: { nombre: 'X', instagram: '', web: '' } })],
    [
      'arancelada sin monto',
      formularioLleno({
        arancel: { tipo: 'arancelado', notas: '', monto: null },
      }),
    ],
    [
      'arancelada con monto',
      formularioLleno({
        arancel: { tipo: 'arancelado', notas: '', monto: 900 },
      }),
    ],
  ];

  for (const [nombre, form] of casos) {
    it(nombre, () => {
      const doc = {
        ...formADocumento(form, 'uid-de-prueba', true),
        id: 'act_1',
        estado: 'publicado',
      } as unknown as ActividadConId;
      const cob = estadoDelCatalogo([doc], AHORA).publicadas;
      const pierde = new Set(ids(form));

      expect(pierde.has('foto')).toBe(cob.conFlyer === 0);
      expect(pierde.has('quien')).toBe(cob.enGoogle.conQuienLaDa === 0);
      expect(pierde.has('web')).toBe(cob.enGoogle.conWebDelOrganizador === 0);
      expect(pierde.has('precio')).toBe(
        cob.enGoogle.admitenMonto === 1 && cob.enGoogle.conMonto === 0,
      );
    });
  }
});
