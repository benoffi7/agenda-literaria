import { describe, expect, it } from 'vitest';
import { actividadFormSchema } from '@/lib/schema';
import { CAMPOS_VALIDABLES } from '@/lib/analytics-eventos';

/**
 * `CAMPOS_VALIDABLES` es el vocabulario de rutas de campo que la analítica
 * acepta en el parámetro `campo`. Se guarda como constante y no derivado del
 * schema en runtime, porque importar zod desde el módulo de analítica lo metía
 * en el chunk inicial del panel (68 kB que el corte de B-09 había sacado).
 *
 * La garantía vive acá: este test deriva el vocabulario del schema de zod y
 * falla si la constante quedó desalineada. Si alguien agrega un campo al
 * formulario, el test dice exactamente qué agregar — que es lo mismo que daba
 * la derivación en runtime, pero sin costo para quien usa el panel.
 */

/*
 * Recorre la forma del schema **por dentro**, que es lo único que cambia entre
 * versiones de zod. Desde zod 4 (B-2208) el tipo está en `_def.type`
 * (`'object'`, `'array'`, …) y no en `_def.typeName`; los envoltorios
 * (`optional`, `nullable`, `default`…) guardan el interior en `innerType`, un
 * `transform` en `in`, y un `superRefine` ya no envuelve: agrega un chequeo al
 * mismo schema.
 */
const desenvolverYRecorrer = () => {
  const desenvolver = (esquema: unknown): any => {
    let n: any = esquema;
    for (let i = 0; i < 12; i++) {
      const def = n?._def;
      if (!def) break;
      if (def.innerType) n = def.innerType;
      else if (def.type === 'pipe' && def.in) n = def.in;
      else break;
    }
    return n;
  };

  const recorrerSchema = (
    esquema: unknown,
    prefijo: string,
    salida: Set<string>,
    profundidad = 0,
  ): void => {
    if (profundidad > 6) return;
    const n = desenvolver(esquema);
    const tipo = n?._def?.type;
    if (tipo === 'object') {
      for (const [clave, hijo] of Object.entries(n.shape as Record<string, unknown>)) {
        const ruta = prefijo ? `${prefijo}.${clave}` : clave;
        salida.add(ruta);
        recorrerSchema(hijo, ruta, salida, profundidad + 1);
      }
    } else if (tipo === 'array' && prefijo) {
      const ruta = `${prefijo}.N`;
      salida.add(ruta);
      recorrerSchema(n._def.element, ruta, salida, profundidad + 1);
    }
  };

  const salida = new Set<string>();
  recorrerSchema(actividadFormSchema, '', salida);
  return salida;
};

describe('el vocabulario de campos sigue al schema', () => {
  it('la constante coincide con lo que el schema puede reportar', () => {
    const delSchema = desenvolverYRecorrer();

    const sobran = [...CAMPOS_VALIDABLES].filter((c) => !delSchema.has(c)).sort();
    const faltan = [...delSchema].filter((c) => !CAMPOS_VALIDABLES.has(c)).sort();

    expect(
      { sobran, faltan },
      'CAMPOS_VALIDABLES quedó desalineado del schema. Actualizá la constante en ' +
        'src/lib/analytics-eventos.ts con lo que falta y sacá lo que sobra.',
    ).toEqual({ sobran: [], faltan: [] });
  });

  it('el schema aporta rutas, no un set vacío', () => {
    // Si el recorrido se rompe, el test de arriba pasaría comparando dos vacíos.
    expect(desenvolverYRecorrer().size).toBeGreaterThan(40);
  });
});
