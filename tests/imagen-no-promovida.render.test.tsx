/**
 * **La foto de una propuesta que no entró, imposible de no ver** — B-1235.
 *
 * El reporte del dueño: «el usuario pulsó usar imagen pero no la tomó». La
 * cadena de guardado estaba sana (la sesión del 2026-09-23 la corrió entera); lo
 * que fallaba era la **promoción**, y el panel lo decía en una línea más de la
 * lista de avisos de conversión, entre «el canal no viaja» y «revisá el slug».
 *
 * La causa, mirada contra el bucket de producción: la respuesta con los bytes
 * (`alt=media`) no trae `Access-Control-Allow-Origin`, así que el `fetch` de
 * `promoverImagenDePropuesta` rechaza con un `TypeError` («Failed to fetch»). El
 * emulador no aplica el CORS del bucket y ahí anda: por eso todo daba verde.
 *
 * Este archivo fija tres cosas: el texto (causa + qué hacer), que el formulario
 * lo pinta como **alerta aparte**, y que el `cors.json` del repo cubre el origen
 * del sitio — que es el arreglo de la causa, aplicado con `gsutil cors set`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => ({ valores: [], elegibles: [], cargando: false }),
  useLabelsTaxonomia: () => ({}),
}));

import { ActividadFormulario } from '@/components/admin/ActividadFormulario';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { avisoDeImagenNoPromovida } from '@/lib/propuestas';
import { SITIO } from '@/lib/rutasPublicas';

afterEach(cleanup);
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('el texto dice la causa y qué hacer (avisoDeImagenNoPromovida)', () => {
  it('el TypeError del fetch —lo que de verdad pasa en producción— se nombra como CORS', () => {
    const t = avisoDeImagenNoPromovida(new TypeError('Failed to fetch'));
    expect(t).toMatch(/CORS/);
    expect(t).toMatch(/No es tu conexión/);
    // Y no el mensaje crudo en inglés, que es lo que se veía antes.
    expect(t).not.toMatch(/Failed to fetch/);
  });

  it('los códigos de Storage que se pueden explicar, se explican', () => {
    expect(avisoDeImagenNoPromovida({ code: 'storage/object-not-found' })).toMatch(
      /ya no está/,
    );
    expect(avisoDeImagenNoPromovida({ code: 'storage/unauthorized' })).toMatch(/permiso/);
  });

  it('un rechazo del saneador se reconoce por nombre, sin importar el módulo de Storage', () => {
    const e = new Error('Ese archivo tiene nombre de imagen pero adentro es otra cosa.');
    e.name = 'ImagenRechazada';
    expect(avisoDeImagenNoPromovida(e)).toMatch(/no pasó los controles/);
  });

  it('en todos los casos dice cómo no perder la foto', () => {
    for (const e of [
      new TypeError('Failed to fetch'),
      { code: 'storage/object-not-found' },
      new Error('cualquier cosa'),
      'ni siquiera un Error',
    ]) {
      expect(avisoDeImagenNoPromovida(e)).toMatch(/«Flyer e imágenes»/);
    }
  });
});

const pintar = (imagenNoPromovida: string | null) =>
  render(
    <ActividadFormulario
      rol="admin"
      vistaDelPanel="celular"
      formatoDeHora="24"
      uid="uid-de-prueba"
      copia={formVacio()}
      tituloOrigen="Taller de cuento"
      origenDeLaCopia="propuesta"
      avisos={['El canal de inscripción no viaja: completalo a mano.']}
      imagenNoPromovida={imagenNoPromovida}
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
    />,
  );

describe('el formulario lo pinta como alerta, aparte de los avisos de conversión', () => {
  it('con la foto sin promover, hay una alerta que lo dice con todas las letras', () => {
    /*
     * MUTACIÓN PROBADA: sacar el bloque `role="alert"` de `ActividadFormulario`
     * (o volver a meter el texto en la lista de `avisos`) deja este caso en rojo.
     */
    const texto = avisoDeImagenNoPromovida(new TypeError('Failed to fetch'));
    pintar(texto);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('NO se agregó');
    expect(alerta.textContent).toContain('CORS');
    // Y no quedó enterrada en la lista de lo que la conversión no prellenó.
    const avisoDeCanal = screen.getByText(/El canal de inscripción no viaja/);
    expect(alerta.contains(avisoDeCanal)).toBe(false);
  });

  it('y cuando la foto entró (o no había), no hay alerta', () => {
    pintar(null);
    expect(screen.queryByText(/NO se agregó/)).toBeNull();
  });
});

describe('el arreglo de la causa: el CORS del bucket cubre el origen del sitio', () => {
  /*
   * `cors.json` es lo que se aplica con
   * `gcloud storage buckets update gs://agenda-literaria.firebasestorage.app --cors-file=cors.json`.
   * Este caso no prueba que esté **aplicado** —eso es de la consola— sino que el
   * archivo no se quede atrás el día que cambie el dominio (`SITIO`): un CORS que
   * no nombra el origen del panel es lo mismo que no tenerlo.
   */
  const reglas = JSON.parse(
    readFileSync(resolve(process.cwd(), 'cors.json'), 'utf8'),
  ) as { origin: string[]; method: string[] }[];

  it('deja leer con GET desde el origen canónico del sitio', () => {
    expect(reglas.some((r) => r.origin.includes(SITIO) && r.method.includes('GET'))).toBe(true);
  });

  it('y solo lectura: nada de métodos que escriban, ni el comodín de origen', () => {
    for (const r of reglas) {
      expect(r.origin).not.toContain('*');
      for (const m of r.method) expect(['GET', 'HEAD']).toContain(m);
    }
  });
});
