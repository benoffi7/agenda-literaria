/**
 * **«Qué se llevan»** — `incluye`, B-830, `docs/prd/01-propuestas-de-organizadores.md` § 5.
 *
 * Pedido del dueño: «¿qué incluye el evento? (Material de lectura, libro,
 * merienda, etc)». Es un campo del **modelo de actividad** y no solo de la
 * propuesta: si se muestra en la ficha pública tiene que existir en
 * `/actividades`.
 *
 * Acá viven las cuatro respuestas del paso 0 del skill `campo-nuevo` que no
 * tienen dueño en otro archivo, con el molde de `libro-presentado.test.ts`:
 *
 * 1. **¿es público?** Sí, y **solo en la página de detalle**. El índice del
 *    listado no lo lleva —`incluye` no es eje de filtro ni frase de la tarjeta—,
 *    ni el evento de Calendar, ni el texto para redes. Las ausencias se afirman
 *    acá abajo y en `barrido-de-salidas-publicas.test.ts`, cada una con su
 *    motivo, porque una ausencia sin decisión escrita no le dice nada a nadie.
 * 2. **¿dato libre o taxonomía?** Taxonomía autogestionada (§4),
 *    `/opciones/incluye-actividad`, con siete opciones base `fijo: true`.
 * 3. **¿entra al evento de Calendar?** **No.** El calendario dice cuándo y
 *    dónde; qué te llevás es de la ficha.
 * 4. **¿qué pasa con los documentos que ya están?** No tienen el campo, y el
 *    default de lectura es `[]` — «no se declaró nada», que es exactamente el
 *    comportamiento anterior (D-26).
 *
 * Las salidas se verifican además en el archivo de cada una, que es donde
 * alguien las va a editar.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { construirDescripcion } from '@calendario';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { CAMPOS, etiquetaDeCampo, seccionDeCampo } from '@/lib/formulario/camposFaltantes';
import { labelsPendientesDe, usosAContar } from '@/lib/formulario/etiquetas';
import { actividadFormSchema } from '@/lib/schema';
import { construirEvento, formaDelFormulario } from '@/lib/analytics-eventos';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import { COPIA_POR_DEFECTO, casillasAplicables, duplicarActividadForm } from '@/lib/duplicar';
import { CAMPOS_MULTIVALOR, CAMPOS_TAXONOMIA } from '@/types/actividad';
import type { Actividad, ActividadForm } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

const DOS = ['merienda', 'material-de-lectura'];

const conIncluye = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  ...formVacio(),
  titulo: 'Taller de crónica',
  slug: 'taller-de-cronica',
  descripcion: 'Cuatro encuentros para escribir crónica urbana, con lecturas.',
  incluye: DOS,
  ...over,
});

/** Un documento como los que ya están en producción: sin el campo. */
const documentoViejo = (over: Partial<Actividad> = {}): Actividad =>
  ({
    ...(formADocumento(conIncluye({ incluye: [] }), 'uid', true) as unknown as Actividad),
    createdAt: ts('2026-08-01T00:00:00Z'),
    updatedAt: ts('2026-08-01T00:00:00Z'),
    ...over,
  }) as Actividad;

describe('la taxonomía existe y tiene su vocabulario base (§4)', () => {
  it('`incluye-actividad` es un campo de taxonomía, y multivalor', () => {
    expect(CAMPOS_TAXONOMIA).toContain('incluye-actividad');
    expect(CAMPOS_MULTIVALOR).toContain('incluye-actividad');
  });

  /**
   * Las siete del PRD, y **todas `fijo: true`**: son las que probablemente
   * queden cableadas en la lógica y las que el §4.3 protege de que alguien las
   * borre desde la pantalla de taxonomías. Las que nazcan del «Otro» sí son
   * editables y borrables.
   */
  it('las siete opciones base están, fijas y aprobadas', () => {
    const base = JSON.parse(readFileSync('src/lib/opciones-base.json', 'utf8')) as Record<
      string,
      { slug: string; fijo: boolean; aprobada: boolean }[]
    >;
    const valores = base['incluye-actividad'];
    expect(valores?.map((v) => v.slug)).toEqual([
      'material-de-lectura',
      'libro',
      'merienda',
      'cafe',
      'certificado',
      'grabacion',
      'material-impreso',
    ]);
    for (const v of valores!) {
      expect(v.fijo, v.slug).toBe(true);
      expect(v.aprobada, v.slug).toBe(true);
    }
  });

  it('el buffer de etiquetas nuevas lo trata como multivalor', () => {
    // D-02 — el «Otro» se persiste en el submit. Si el campo no tuviera buffer,
    // el chip aparecería en pantalla y la opción nunca se daría de alta.
    const mapa = labelsPendientesDe([], {
      'incluye-actividad': { 'vino-de-honor': ' Vino de honor ' },
    });
    expect(mapa['incluye-actividad']).toEqual({ 'vino-de-honor': 'Vino de honor' });
  });

  it('sus usos se cuentan con el nombre de la taxonomía, no del campo', () => {
    // `registrarUsos` escribe en `/opciones/{campo}`: con `incluye` a secas
    // crearía un documento que ningún desplegable lee (§4.3).
    const datos = {
      tipo: 'taller',
      arancel: { tipo: 'gratis' },
      modalidades: [],
      tags: [],
      incluye: DOS,
    };
    expect(usosAContar(datos, [], {})['incluye-actividad']).toEqual(DOS);
  });
});

describe('el default de lectura de los documentos que ya existen (D-26)', () => {
  it('un documento sin el campo se lee como lista vacía', () => {
    const { incluye, ...sinCampo } = documentoViejo();
    expect(incluye).toEqual([]);
    expect(documentoAForm(sinCampo as Actividad).incluye).toEqual([]);
  });

  it('y la proyección pública del documento viejo tampoco inventa nada', () => {
    const { incluye: _, ...sinCampo } = documentoViejo();
    expect(toPublic(sinCampo as Actividad, 'act_1').incluye).toEqual([]);
  });

  it('el formulario vacío arranca sin nada declarado', () => {
    expect(formVacio().incluye).toEqual([]);
  });
});

describe('la ida y vuelta formulario ⇄ documento no pierde nada', () => {
  it('escribe los slugs tal como se eligieron, en orden', () => {
    const doc = formADocumento(conIncluye(), 'uid', true);
    expect(doc.incluye).toEqual(DOS);
  });

  it('vuelve del documento al formulario igual', () => {
    const doc = formADocumento(conIncluye(), 'uid', true) as unknown as Actividad;
    expect(documentoAForm(documentoViejo({ incluye: doc.incluye })).incluye).toEqual(DOS);
  });

  it('una lista vacía se guarda vacía y no como ausente', () => {
    // Que la clave exista es lo que hace que borrar el último ítem **borre**: con
    // `undefined`, el merge de Firestore dejaría lo anterior.
    const doc = formADocumento(conIncluye({ incluye: [] }), 'uid', true);
    expect(doc.incluye).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(doc, 'incluye')).toBe(true);
  });
});

describe('el schema lo acepta y lo normaliza como `tags`', () => {
  it('acepta la lista de slugs', () => {
    const r = actividadFormSchema.safeParse(conIncluye());
    expect(r.success, JSON.stringify(r.success ? {} : r.error.issues)).toBe(true);
  });

  it('sin el campo, el default es la lista vacía', () => {
    const { incluye: _, ...sinCampo } = conIncluye();
    const r = actividadFormSchema.safeParse(sinCampo);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.incluye).toEqual([]);
  });

  it('rechaza lo que no es una lista de strings', () => {
    const r = actividadFormSchema.safeParse(conIncluye({ incluye: [1] as unknown as string[] }));
    expect(r.success).toBe(false);
  });

  it('la barra sabe nombrarlo, y lo ubica en «Qué es» (B-184)', () => {
    // Sin esta entrada la barra diría que falta algo sin decir qué ni dónde.
    expect(CAMPOS.incluye).toBeDefined();
    expect(etiquetaDeCampo('incluye')).toBe('Qué se llevan');
    expect(seccionDeCampo('incluye')).toBe('que-es');
    // La ruta con índice, que es la que emite el schema sobre un elemento.
    expect(etiquetaDeCampo('incluye.N')).toBe('Qué se llevan');
  });
});

describe('sale a la página de detalle, y a ninguna otra salida', () => {
  it('la proyección pública lo lleva, como slug', () => {
    expect(toPublic(documentoViejo({ incluye: DOS }), 'act_1').incluye).toEqual(DOS);
  });

  /**
   * **La decisión, no el comportamiento.** El índice recorta más que `toPublic` a
   * propósito, y `incluye` no entra porque no es eje de filtro ni frase de la
   * tarjeta. Meterlo comprometería además la forma de una URL —el `?incluye=` de
   * un chip— y una URL indexada no se mueve (trampa 10).
   *
   * El barrido de centinelas lo afirma con su control positivo
   * (`barrido-de-salidas-publicas.test.ts`); acá se afirma sobre valores reales,
   * que es la mitad que un centinela no puede dar: si mañana `entradaDeIndice`
   * proyecta el campo con otro nombre, el centinela lo agarra y esto también.
   */
  it('el índice del listado NO lo lleva (B-830)', () => {
    const entrada = entradaDeIndice(toPublic(documentoViejo({ incluye: DOS }), 'act_1'));
    expect(Object.prototype.hasOwnProperty.call(entrada, 'incluye')).toBe(false);
    expect(JSON.stringify(entrada)).not.toContain('merienda');
  });

  it('el evento de Calendar NO lo dice', () => {
    /*
     * El calendario dice **cuándo y dónde**; qué te llevás es de la ficha. Y hay
     * un motivo de forma además del de contenido: un cambio en `incluye` no
     * tiene por qué reescribir los N eventos de un ciclo (D-07, trampa 9), y si
     * entrara a la descripción entraría también al payload que compara la guarda
     * anti-loop.
     */
    const doc = documentoViejo({ incluye: DOS });
    const labels = {
      'incluye-actividad': { merienda: 'Merienda', 'material-de-lectura': 'Material de lectura' },
    };
    const descripcion = construirDescripcion(doc, doc.sesiones[0], labels);
    // Control positivo: sin esto, una `descripcion` vacía —porque la firma
    // cambió y el llamado devuelve `''`— dejaría los tres `not.toContain` en
    // verde sin haber mirado nada.
    expect(descripcion.length).toBeGreaterThan(20);
    expect(descripcion).toContain('crónica urbana');
    expect(descripcion).not.toContain('Merienda');
    expect(descripcion).not.toContain('merienda');
    expect(descripcion).not.toContain('Material de lectura');
  });

  /**
   * **La plantilla lo pinta, y ahí termina el circuito.** El view-model puede
   * traer el campo y la página no mostrarlo: eso es código muerto que ningún
   * barrido detecta —el barrido mira qué **puede** salir, no qué sale— y es
   * exactamente lo que pasó con el `error` de la galería en B-341.
   *
   * Se afirma sobre el `.astro` porque la página no se puede montar en la suite
   * (es SSG y no hay renderer de Astro acá), que es el mismo criterio de
   * `detalle-visual.test.ts`.
   */
  it('la página de detalle lo pinta desde el view-model', () => {
    const pagina = readFileSync('src/pages/actividad/[slug].astro', 'utf8');
    expect(pagina).toContain('detalle.incluye');
    // El rótulo con el que el dueño lo va a reconocer, y el mismo que el panel.
    expect(pagina).toContain('Qué se llevan');
  });

  /**
   * **`ActividadParaRedes` es un `Pick`**, así que la garantía la da el tipo y
   * no un test: el campo no puede llegar al posteo sin que alguien lo agregue a
   * mano a esa lista. Lo que se afirma acá es que sigue siendo así — si el `Pick`
   * se cambiara por la `Actividad` entera, el posteo pasaría a llevar todo lo que
   * el modelo tenga y este caso lo dice.
   */
  it('el texto para redes no lo puede llevar: el tipo no lo incluye', () => {
    const src = readFileSync('src/lib/textoRedes.ts', 'utf8');
    const pick = /export type ActividadParaRedes = Pick<[\s\S]*?>;/.exec(src)?.[0];
    expect(pick, 'cambió la forma de `ActividadParaRedes`').toBeDefined();
    expect(pick).not.toContain("'incluye'");
  });

  it('la analítica manda cuántos, nunca cuáles (§9)', () => {
    const evento = construirEvento('guardado_ok', formaDelFormulario(conIncluye()));
    const crudo = JSON.stringify(evento);
    expect(crudo).toContain('"incluye":2');
    expect(crudo).not.toContain('merienda');
    expect(crudo).not.toContain('material-de-lectura');
  });
});

describe('duplicar lo hereda, y se puede destildar', () => {
  it('por defecto la copia se lo lleva', () => {
    expect(COPIA_POR_DEFECTO.incluye).toBe(true);
    const copia = duplicarActividadForm(conIncluye());
    expect(copia.incluye).toEqual(DOS);
  });

  it('destildado, la copia nace sin nada declarado', () => {
    const copia = duplicarActividadForm(conIncluye(), { copiar: { incluye: false } });
    expect(copia.incluye).toEqual([]);
  });

  it('la casilla aparece solo si hay algo que copiar', () => {
    const claves = (f: ActividadForm) => casillasAplicables(f).map((c) => c.clave);
    expect(claves(conIncluye())).toContain('incluye');
    expect(claves(conIncluye({ incluye: [] }))).not.toContain('incluye');
  });
});
