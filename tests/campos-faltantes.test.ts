import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAMPOS_VALIDABLES } from '@/lib/analytics-eventos';
import {
  CAMPOS,
  MAX_CAMPOS_NOMBRADOS,
  SECCIONES,
  etiquetaDeCampo,
  nombraSecciones,
  resumirFaltantes,
  seccionDeCampo,
  textoFaltantes,
} from '@/lib/formulario/camposFaltantes';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { faltaParaPublicar } from '@/lib/schema';

/**
 * B-184 — el mensaje de la barra dice qué falta. Estos tests son lo que evita
 * las dos formas en que ese mensaje puede volver a no decir nada:
 *
 * 1. **Un campo nuevo sin nombre.** El diccionario se compara contra el
 *    vocabulario de rutas del schema, que `tests/analytics-campos.test.ts`
 *    mantiene alineado con zod. La cadena completa es schema → vocabulario →
 *    nombres: agregar un campo al modelo y no nombrarlo falla acá.
 * 2. **Una sección renombrada o movida.** Los ids y los títulos viven en el
 *    diccionario y como literales en los `.tsx`; se leen los archivos y se
 *    comparan. Si se separan, el mensaje mandaría a una sección que no existe.
 */

const FUENTES = readdirSync('src/components/admin/formulario')
  .filter((f) => f.startsWith('Seccion') && f.endsWith('.tsx'))
  .map((f) => ({ archivo: f, src: readFileSync(`src/components/admin/formulario/${f}`, 'utf8') }));

describe('el diccionario de campos sigue al schema', () => {
  it('todo campo que el schema puede rechazar tiene nombre y sección', () => {
    const sinNombre = [...CAMPOS_VALIDABLES].filter((ruta) => !CAMPOS[ruta]).sort();
    expect(
      sinNombre,
      'campos del schema sin nombre en src/lib/formulario/camposFaltantes.ts. ' +
        'Sin esto, la barra dice que falta algo y no dice qué.',
    ).toEqual([]);
  });

  it('no hay nombres para rutas que el schema ya no tiene', () => {
    const sobrantes = Object.keys(CAMPOS).filter((ruta) => !CAMPOS_VALIDABLES.has(ruta)).sort();
    expect(sobrantes, 'rutas nombradas que el schema no puede reportar').toEqual([]);
  });

  it('cada campo apunta a una sección que existe', () => {
    const ids = new Set<string>(SECCIONES.map((s) => s.id));
    const huerfanos = Object.entries(CAMPOS)
      .filter(([, c]) => !ids.has(c.seccion))
      .map(([ruta]) => ruta);
    expect(huerfanos).toEqual([]);
  });

  it('ningún campo se queda sin etiqueta legible', () => {
    for (const [ruta, campo] of Object.entries(CAMPOS)) {
      expect(campo.etiqueta.length, `«${ruta}» sin nombre`).toBeGreaterThan(2);
      // El nombre es el de la pantalla, no la ruta del schema: si son iguales,
      // el mensaje volvió a decir `sede.direccion`.
      expect(campo.etiqueta, `«${ruta}» se nombra con la ruta del schema`).not.toBe(ruta);
    }
  });
});

describe('las secciones del diccionario son las del formulario', () => {
  it('cada sección del formulario declara el ancla de su id', () => {
    const enDisco = FUENTES.flatMap(({ src }) => {
      const ancla = /ancla="([^"]+)"/.exec(src)?.[1];
      const titulo = /\btitulo="([^"]+)"/.exec(src)?.[1];
      return ancla && titulo ? [{ ancla, titulo, colapsable: /\bcolapsable\b/.test(src) }] : [];
    });

    expect(enDisco.length, 'hay secciones del formulario sin ancla').toBe(SECCIONES.length);

    const esperado = [...SECCIONES]
      .map((s) => ({ ancla: s.id, titulo: s.titulo, colapsable: Boolean(s.colapsable) }))
      .sort((a, b) => a.ancla.localeCompare(b.ancla));
    expect(
      [...enDisco].sort((a, b) => a.ancla.localeCompare(b.ancla)),
      'las secciones de src/components/admin/formulario/ no coinciden con SECCIONES: ' +
        'el mensaje de la barra mandaría a una sección que no existe',
    ).toEqual(esperado);
  });

  it('no hay dos secciones con el mismo id', () => {
    expect(new Set(SECCIONES.map((s) => s.id)).size).toBe(SECCIONES.length);
  });

  it('las secciones colapsables reciben el pedido de apertura', () => {
    // Sin esta prop, un campo rechazado adentro de un acordeón cerrado sigue sin
    // verse: es exactamente el agujero que B-184 vino a tapar. «Vista previa del
    // evento» queda afuera a propósito: no tiene campos, así que ningún faltante
    // puede caer ahí.
    const conCampos = new Set(Object.values(CAMPOS).map((c) => c.seccion));
    for (const { archivo, src } of FUENTES) {
      const ancla = /ancla="([^"]+)"/.exec(src)?.[1];
      if (!ancla || !/\bcolapsable\b/.test(src) || !conCampos.has(ancla as never)) continue;
      expect(src, `${archivo} es colapsable y no pasa pedidoDeApertura`).toContain(
        'pedidoDeApertura={pedidoDeApertura}',
      );
    }
  });
});

describe('etiquetaDeCampo y seccionDeCampo', () => {
  it('nombra el campo, no la ruta', () => {
    expect(etiquetaDeCampo('modalidades.0.sede.direccion')).toBe('Dirección');
    expect(etiquetaDeCampo('arancel.tipo')).toBe('Arancel');
  });

  it('colapsa la fila del array: importa el campo, no el número', () => {
    expect(etiquetaDeCampo('sesiones.3.inicio')).toBe('Fecha de inicio');
    expect(etiquetaDeCampo('material.items.2.titulo')).toBe('Título del material');
    expect(seccionDeCampo('sesiones.7.fin')).toBe('encuentros');
  });

  it('una ruta desconocida se devuelve tal cual, sin sección', () => {
    expect(etiquetaDeCampo('inventado.raro')).toBe('inventado.raro');
    expect(seccionDeCampo('inventado.raro')).toBeNull();
  });
});

describe('resumirFaltantes', () => {
  it('agrupa por sección en el orden de la pantalla', () => {
    const r = resumirFaltantes(['arancel.tipo', 'titulo', 'modalidades.0.sede.direccion']);
    expect(r.secciones.map((s) => s.id)).toEqual(['que-es', 'donde', 'arancel-inscripcion']);
    expect(r.total).toBe(3);
  });

  it('cuenta cada ruta y no repite el nombre', () => {
    const r = resumirFaltantes(['material.items.0.titulo', 'material.items.1.titulo']);
    expect(r.secciones[0]).toMatchObject({
      id: 'material',
      etiquetas: ['Título del material'],
      cantidad: 2,
    });
  });

  it('sin faltantes no hay secciones', () => {
    expect(resumirFaltantes([])).toEqual({ total: 0, secciones: [], sinUbicar: [] });
  });

  it('separa lo que no puede ubicar', () => {
    const r = resumirFaltantes(['titulo', 'campo.que.no.existe']);
    expect(r.sinUbicar).toEqual(['campo.que.no.existe']);
    expect(r.total).toBe(2);
  });
});

describe('textoFaltantes — corto en mobile, accionable igual', () => {
  it('con pocos, nombra los campos', () => {
    const r = resumirFaltantes(['titulo', 'arancel.tipo']);
    expect(nombraSecciones(r)).toBe(false);
    expect(textoFaltantes(r)).toBe('Título, Arancel');
  });

  it('con muchos, nombra las secciones con su cuenta', () => {
    const rutas = [
      'modalidades.0.sede.nombre',
      'modalidades.1.sede.direccion',
      'arancel.tipo',
      'titulo',
    ];
    expect(rutas.length).toBeGreaterThan(MAX_CAMPOS_NOMBRADOS);
    const r = resumirFaltantes(rutas);
    expect(nombraSecciones(r)).toBe(true);
    expect(textoFaltantes(r)).toBe('Qué es (1), Dónde (2), Arancel e inscripción (1)');
  });

  it('sin faltantes, no hay texto', () => {
    expect(textoFaltantes(resumirFaltantes([]))).toBe('');
  });

  it('una ruta sin nombre se muestra igual', () => {
    expect(textoFaltantes(resumirFaltantes(['inventado.raro']))).toBe('inventado.raro');
  });
});

describe('el caso real: publicar un formulario recién abierto', () => {
  /**
   * El formulario vacío se **guarda** como borrador (B-183) y no se puede
   * publicar. Esto verifica lo que se lee en la barra en ese momento, que es la
   * pantalla que el reporte del dueño describía.
   */
  const rutas = faltaParaPublicar(formVacio()).map((i) => i.path.join('.'));
  const resumen = resumirFaltantes(rutas);

  it('hay algo que decir', () => {
    expect(rutas.length).toBeGreaterThan(3);
  });

  it('todo lo que falta tiene nombre: nada queda sin ubicar', () => {
    expect(resumen.sinUbicar).toEqual([]);
  });

  it('el mensaje nombra secciones, no doce rutas de campo', () => {
    const texto = textoFaltantes(resumen);
    expect(texto).toContain('Qué es');
    expect(texto).not.toContain('.');
    // Corto: entra en una línea de un teléfono angosto.
    expect(texto.length).toBeLessThan(90);
  });
});
