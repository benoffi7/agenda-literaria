/**
 * **Dónde puede cargar un publicador, del lado del panel** — B-921, D-1150.
 *
 * La frontera es `dentroDeSuCiudad()` en `firestore.rules`, y la prueban los
 * casos contra el emulador de `rol-publicador.integracion.test.ts` (bloque 10).
 * Esto prueba el **espejo**: que el panel conteste la misma pregunta antes de
 * escribir, con una frase que no parezca un error del sistema, y que las dos
 * mitades no se separen.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ciudadesFueraDeSuCiudad, textoFueraDeSuCiudad } from '@/lib/alcanceDeCiudad';
import { guardarActividad, type PuertosGuardado } from '@/lib/formulario/guardar';
import { textoDeFallo } from '@/lib/fallosDelPanel';
import { clasificarFalloGuardado, MOTIVOS_FALLO } from '@/lib/analytics-eventos';
import { formDeCiclo } from './fixtures/formulario-de-ciclo';
import type { ActividadForm } from '@/types/actividad';

const MDQ = 'mar-del-plata';

describe('ciudadesFueraDeSuCiudad — la misma pregunta que la regla', () => {
  it('el publicador general y el admin (`ciudad: ""`) no tienen nada afuera', () => {
    expect(
      ciudadesFueraDeSuCiudad({ ciudad: '', ciudades: ['rosario', 'cordoba'], editando: false }),
    ).toEqual([]);
  });

  it('al crear, todo lo que no es su ciudad queda afuera', () => {
    expect(ciudadesFueraDeSuCiudad({ ciudad: MDQ, ciudades: [MDQ], editando: false })).toEqual([]);
    expect(ciudadesFueraDeSuCiudad({ ciudad: MDQ, ciudades: ['rosario'], editando: false })).toEqual(
      ['rosario'],
    );
    // Una sede en su ciudad no «tapa» la otra: es el `hasOnly` de la regla.
    expect(
      ciudadesFueraDeSuCiudad({ ciudad: MDQ, ciudades: [MDQ, 'rosario'], editando: false }),
    ).toEqual(['rosario']);
  });

  it('una actividad solo virtual no queda fuera de ninguna ciudad (D-1151)', () => {
    expect(ciudadesFueraDeSuCiudad({ ciudad: MDQ, ciudades: [], editando: false })).toEqual([]);
  });

  it('lo ya cargado en otra ciudad se mantiene si no se mueve, y no se muda (D-1153)', () => {
    const base = { ciudad: MDQ, ciudadesAntes: ['rosario'], editando: true };
    expect(ciudadesFueraDeSuCiudad({ ...base, ciudades: ['rosario'] })).toEqual([]);
    expect(ciudadesFueraDeSuCiudad({ ...base, ciudades: ['cordoba'] })).toEqual(['cordoba']);
    // Y traerla a su ciudad sí se puede.
    expect(ciudadesFueraDeSuCiudad({ ...base, ciudades: [MDQ] })).toEqual([]);
  });

  it('«sin cambio» es en orden, como el `==` de listas de la regla', () => {
    // Reordenar dos ciudades ajenas cuenta como cambio: falla cerrado igual que
    // la regla, en vez de dejar pasar algo que el servidor va a rechazar.
    expect(
      ciudadesFueraDeSuCiudad({
        ciudad: MDQ,
        ciudades: ['cordoba', 'rosario'],
        ciudadesAntes: ['rosario', 'cordoba'],
        editando: true,
      }),
    ).toEqual(['cordoba', 'rosario']);
  });

  it('un documento sin `ciudades` (anterior a B-919) se compara como `[]`, igual que la regla', () => {
    expect(
      ciudadesFueraDeSuCiudad({ ciudad: MDQ, ciudades: ['rosario'], ciudadesAntes: undefined, editando: true }),
    ).toEqual(['rosario']);
    expect(
      ciudadesFueraDeSuCiudad({ ciudad: MDQ, ciudades: [], ciudadesAntes: undefined, editando: true }),
    ).toEqual([]);
  });

  it('las dos mitades siguen escritas en la regla', () => {
    /*
     * Si alguien afloja o endurece `dentroDeSuCiudad()` sin tocar este módulo, el
     * panel empieza a avisar de más o de menos. No reemplaza a los casos contra el
     * emulador: es la alarma de que hay que mirar las dos cosas juntas.
     */
    const reglas = readFileSync(
      fileURLToPath(new URL('../firestore.rules', import.meta.url)),
      'utf8',
    );
    expect(reglas).toContain(
      ".hasOnly([request.auth.token.get('ciudad', '')])",
    );
    expect(reglas).toContain("return request.auth.token.get('ciudad', '') == ''");
    expect(reglas).toContain(
      "request.resource.data.get('ciudades', []) == resource.data.get('ciudades', [])",
    );
  });
});

describe('textoFueraDeSuCiudad — el aviso no parece un error del sistema', () => {
  it('nombra su ciudad y la de afuera, y dice qué hacer', () => {
    const t = textoFueraDeSuCiudad(['rosario'], MDQ, (s) =>
      s === MDQ ? 'Mar del Plata' : undefined,
    );
    expect(t).toContain('Mar del Plata');
    expect(t).toContain('Rosario'); // sin etiqueta, `desSlug`
    expect(t).toMatch(/dejá solo sedes de Mar del Plata/);
    expect(t).toMatch(/virtual/);
    // No manda a salir y volver a entrar, que es el consejo de `permisos`.
    expect(t).not.toMatch(/permiso|error|salí/i);
  });

  it('con dos ciudades afuera, las enumera', () => {
    expect(textoFueraDeSuCiudad(['rosario', 'cordoba'], MDQ)).toContain('Rosario y Cordoba');
  });
});

describe('el guardado no escribe nada fuera de su ciudad', () => {
  const puertosQueAnotan = () => {
    const llamadas: string[] = [];
    const puertos: PuertosGuardado = {
      slugDisponible: async () => (llamadas.push('slugDisponible'), true),
      upsertOpcion: async () => (llamadas.push('upsertOpcion'), 'x'),
      upsertOpciones: async () => (llamadas.push('upsertOpciones'), []),
      registrarUsos: async () => void llamadas.push('registrarUsos'),
      proponerOpcion: async (_c, _l, slug) => (llamadas.push('proponerOpcion'), slug),
      crearActividad: async () => (llamadas.push('crearActividad'), 'act1'),
      actualizarActividad: async () => void llamadas.push('actualizarActividad'),
    };
    return { puertos, llamadas };
  };

  const enCiudad = (ciudad: string): ActividadForm => {
    const f = formDeCiclo();
    return {
      ...f,
      modalidades: f.modalidades.map((m) => ({
        ...m,
        sede: m.sede && { ...m.sede, provincia: 'buenos-aires', barrio: '', ciudad },
      })),
    };
  };

  const entrada = (form: ActividadForm, extra: Record<string, unknown> = {}) => ({
    form,
    uid: 'uid-pub',
    rol: 'publicador' as const,
    labelsNuevos: [],
    multivalorNuevos: {},
    ...extra,
  });

  it('crear fuera de su ciudad devuelve `fuera-de-ciudad` y no toca ningún puerto', async () => {
    /*
     * Ni siquiera `slugDisponible`: si la regla lo va a rechazar, no hay nada
     * que ir a buscar. MUTACIÓN PROBADA: sacar el bloque `if (alcance)` de
     * `guardarActividad` deja este caso en rojo con `crearActividad` llamado.
     */
    const { puertos, llamadas } = puertosQueAnotan();
    const r = await guardarActividad(
      entrada(enCiudad('rosario'), { alcance: { ciudad: MDQ } }),
      puertos,
    );
    expect(r).toEqual({ estado: 'fuera-de-ciudad', ciudades: ['rosario'] });
    expect(llamadas).toEqual([]);
  });

  it('editar la sede de una propia hacia afuera, también', async () => {
    const { puertos, llamadas } = puertosQueAnotan();
    const r = await guardarActividad(
      entrada(enCiudad('rosario'), {
        idActual: 'act1',
        alcance: { ciudad: MDQ, ciudadesAntes: [MDQ] },
      }),
      puertos,
    );
    expect(r.estado).toBe('fuera-de-ciudad');
    expect(llamadas).not.toContain('actualizarActividad');
  });

  it('dentro de su ciudad, el general, y lo ya cargado sin moverlo: guardan', async () => {
    // Los controles positivos: sin ellos, un `return` incondicional pasaría
    // los dos casos de arriba.
    for (const e of [
      entrada(enCiudad(MDQ), { alcance: { ciudad: MDQ } }),
      entrada(enCiudad('rosario'), { alcance: { ciudad: '' } }),
      entrada(enCiudad('rosario'), {
        idActual: 'act1',
        alcance: { ciudad: MDQ, ciudadesAntes: ['rosario'] },
      }),
    ]) {
      const { puertos } = puertosQueAnotan();
      expect((await guardarActividad(e, puertos)).estado).toBe('ok');
    }
  });
});

describe('la métrica lo etiqueta sin decir qué ciudad', () => {
  it('`fuera-de-ciudad` es un motivo del vocabulario cerrado', () => {
    expect(MOTIVOS_FALLO).toContain('fuera-de-ciudad');
    expect(clasificarFalloGuardado('fuera-de-ciudad', { navegadorSinVerificar: false })).toEqual({
      motivo: 'fuera-de-ciudad',
    });
    // Y el cartel genérico no lo tapa con una frase suya: el texto lo arma
    // `textoFueraDeSuCiudad` con los nombres.
    expect(textoDeFallo(new Error('texto propio'), { respaldo: 'x' })).toBe('texto propio');
  });
});
