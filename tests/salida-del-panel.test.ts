import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AVISO_CAMBIOS_SIN_GUARDAR,
  VISTAS_CON_FORMULARIO,
  debeConfirmarSalida,
  tieneFormulario,
} from '@/lib/salida-del-panel';

/**
 * B-35 — salir del panel con cambios sin guardar.
 *
 * La regla es pura y se testea directo. Lo que **no** se puede testear así es el
 * cableado —el panel no tiene tests de componentes (`docs/05-patrones.md`)— y es
 * justo la mitad que se rompe sola: agregar un botón de salida nuevo y olvidarse
 * del aviso no falla en ninguna parte. De ahí el último bloque, que lee
 * `AdminApp.tsx` como texto y cuenta las salidas.
 */

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

describe('cuándo preguntar antes de salir (B-35)', () => {
  it('en las tres vistas con formulario, si hay cambios', () => {
    for (const vista of VISTAS_CON_FORMULARIO) {
      expect(debeConfirmarSalida(vista, true)).toBe(true);
    }
  });

  it('nunca si no hay cambios: un aviso vacío se aprende a ignorar', () => {
    for (const vista of VISTAS_CON_FORMULARIO) {
      expect(debeConfirmarSalida(vista, false)).toBe(false);
    }
  });

  it('nunca desde una vista sin formulario, aunque el store haya quedado sucio', () => {
    // El escenario es un formulario que se desmontó sin pasar por su cleanup:
    // sin este chequeo, todos los botones del listado empezarían a preguntar.
    for (const vista of ['lista', 'reportes', 'calendario']) {
      expect(debeConfirmarSalida(vista, true)).toBe(false);
    }
  });

  it('una vista que no existe no cuenta como formulario', () => {
    expect(tieneFormulario('inventada')).toBe(false);
  });

  it('el aviso dice qué se pierde, no solo que hay cambios', () => {
    // La pregunta se contesta en dos segundos: "hay cambios sin guardar" no
    // alcanza para decidir, "se pierden" sí.
    expect(AVISO_CAMBIOS_SIN_GUARDAR).toMatch(/pierden/);
  });
});

describe('todas las salidas del panel pasan por el aviso (B-35)', () => {
  const ADMIN_APP = fuente('components/admin/AdminApp.tsx');

  it('los cuatro caminos que abandonan el formulario están envueltos en salirDe', () => {
    // Uno por camino: "← Volver", "Reportar algo", "Salir" y el "Cancelar" del
    // formulario. "Calendario" solo se ofrece desde el listado, donde no hay
    // nada que perder.
    expect([...ADMIN_APP.matchAll(/salirDe\(/g)]).toHaveLength(5); // 4 usos + la definición
  });

  it('la salida del formulario respeta a dónde volver', () => {
    expect(ADMIN_APP).toContain('setVista(destinoDeVolver())');
  });

  it('cerrar la pestaña también avisa', () => {
    expect(ADMIN_APP).toContain("'beforeunload'");
    // Sin `returnValue` Chrome ignora el `preventDefault()` y cierra igual.
    expect(ADMIN_APP).toContain('e.returnValue');
  });

  it('guardar no pregunta nada', () => {
    // `onGuardado` no lleva `salirDe`: no quedó nada sin guardar.
    expect(ADMIN_APP).not.toMatch(/onGuardado=\{\(\) => salirDe/);
  });
});
