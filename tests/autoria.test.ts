/**
 * B-130 — quién cargó cada actividad.
 *
 * El reporte era una pregunta, no un bug: *"los eventos que crea el otro admin
 * también me aparecen, ¿no?"*. Se contesta con el uid que el panel ya tiene en
 * la sesión, sin tocar el modelo ni arriesgar una filtración del §5.1.
 */
import { describe, expect, it } from 'vitest';
import { ETIQUETA_AUTORIA, autoriaDe } from '@/lib/formulario/autoria';

const YO = 'uid_propio';

describe('de quién es la actividad', () => {
  it('la mía es propia', () => {
    expect(autoriaDe({ createdBy: YO }, YO)).toBe('propia');
  });

  it('la de la otra cuenta es ajena', () => {
    expect(autoriaDe({ createdBy: 'uid_ajeno' }, YO)).toBe('ajena');
  });

  it('sin `createdBy` es desconocida, no ajena', () => {
    // Los documentos anteriores a que se escribiera `createdBy`. Marcarlos como
    // ajenos sería afirmar de más sobre datos viejos, que es peor que callarse.
    expect(autoriaDe({}, YO)).toBe('desconocida');
    expect(autoriaDe({ createdBy: null }, YO)).toBe('desconocida');
    expect(autoriaDe({ createdBy: '' }, YO)).toBe('desconocida');
  });

  it('sin sesión no se afirma nada', () => {
    expect(autoriaDe({ createdBy: 'uid_ajeno' }, undefined)).toBe('desconocida');
  });
});

describe('qué se muestra', () => {
  it('lo propio no lleva marca', () => {
    // Si todo lleva marca, la marca deja de avisar: la fila del listado ya tiene
    // título, estado y próximo encuentro compitiendo por la atención.
    expect(ETIQUETA_AUTORIA.propia).toBeNull();
  });

  it('lo desconocido tampoco', () => {
    expect(ETIQUETA_AUTORIA.desconocida).toBeNull();
  });

  it('lo ajeno sí, y no nombra a nadie', () => {
    const texto = ETIQUETA_AUTORIA.ajena;
    expect(texto).toBeTruthy();
    // No hay nombre ni mail que mostrar: `createdBy` es un uid. Y si algún día
    // se guarda el mail, este test recuerda que el §5.1 lo tiene que revisar.
    expect(texto).not.toMatch(/@/);
  });
});
