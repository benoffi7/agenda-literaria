import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { construirDescripcion } from '@calendario';
// Las Functions son JS plano; TS les infiere los tipos con allowJs.
import { camposCambiados, huboCambioDeContenido } from '../functions/historial.js';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import { esCharla, muestraLibro } from '@/lib/formulario/condicionales';
import { formVacio, libroVacio } from '@/lib/formulario/estadoInicial';
import { CAMPOS, etiquetaDeCampo, seccionDeCampo } from '@/lib/formulario/camposFaltantes';
import { buildSearchText } from '@/lib/normalize';
import { actividadFormSchema, faltaParaPublicar } from '@/lib/schema';
import { toPublic } from '@/lib/toPublic';
import type { Actividad, ActividadForm } from '@/types/actividad';

/**
 * DEC-1 — el libro presentado.
 *
 * El campo es propio y no un párrafo de la descripción: es lo que permite
 * mostrarlo aparte, buscarlo y filtrarlo más adelante. Acá viven las cuatro
 * respuestas del paso 0 del skill `campo-nuevo` que no tienen dueño en otro
 * archivo, más las dos cosas que un campo nuevo rompe en silencio:
 *
 *  1. **el default de lectura** de los documentos que ya están en producción, y
 *     que tiene que ser determinístico;
 *  2. **la ida y vuelta** formulario ⇄ documento, que no puede perder nada.
 *
 * Las salidas se verifican cada una en el archivo de su salida, que es donde
 * alguien las va a editar: `toPublic.test.ts` (events.json),
 * `calendario.test.ts` (el evento y su propagación a las N sesiones),
 * `reportes.test.ts` (el issue de GitHub) y `analytics-privacidad.test.ts`
 * (GA4). La tabla completa está en el ADR.
 */

const ts = (iso: string) => {
  const d = new Date(iso);
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  };
};

/** Una presentación tal como la entrega Firestore. Sin `libro`, salvo que se pida. */
const presentacion = (over: Partial<Actividad> = {}): Actividad =>
  ({
    tipo: 'presentacion',
    titulo: 'Presentación de Los detectives salvajes',
    slug: 'presentacion-detectives',
    descripcion: 'Se presenta la novela con lectura de fragmentos.',
    imagenes: [],
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: { nombre: 'María Moreno', bio: 'Cronista', instagram: '@mmoreno' },
    esCiclo: false,
    sesiones: [
      {
        id: 'ses_1',
        inicio: ts('2026-09-03T22:00:00Z'),
        fin: ts('2026-09-04T00:00:00Z'),
        tema: null,
        lectura: null,
        cancelada: false,
        calendarEventId: null,
      },
    ],
    modalidad: 'presencial',
    sede: {
      nombre: 'Casa Brandon',
      direccion: 'Drago 236',
      barrio: '',
      ciudad: 'CABA',
      indicaciones: '',
      geo: null,
    },
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
    updatedAt: ts('2026-08-02T00:00:00Z'),
    createdBy: 'uid_abc',
    updatedBy: 'uid_abc',
    ...over,
  }) as Actividad;

const conLibro = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  ...formVacio(),
  tipo: 'presentacion' as ActividadForm['tipo'],
  titulo: 'Presentación de Los detectives salvajes',
  slug: 'presentacion-detectives',
  libro: { titulo: 'Los detectives salvajes', autor: 'Roberto Bolaño' },
  ...over,
});

describe('el default de lectura de los documentos que ya existen (D-26, D-125)', () => {
  it('un documento anterior a DEC-1 se lee con el bloque vacío, no con undefined', () => {
    const f = documentoAForm(presentacion());
    expect(f.libro).toEqual({ titulo: '', autor: '' });
  });

  it('preserva el comportamiento anterior: nada cambia en pantalla ni en el documento', () => {
    // El bloque vacío es indistinguible de «no hay libro»: `formADocumento` lo
    // convierte en `null` y la proyección pública no inventa el campo.
    const doc = formADocumento(documentoAForm(presentacion()), 'uid', false);
    expect(doc.libro).toBeNull();
    expect(toPublic(presentacion(), 'id1').libro).toBeNull();
  });

  it('es determinístico, y esto NO es un detalle', () => {
    /*
     * Un default que devuelva algo distinto en cada lectura —un id, una fecha—
     * hace que `huboCambioDeContenido` vea un cambio cada vez que se abre el
     * formulario: el aviso de «cambios sin guardar» aparecería solo y se
     * escribiría una versión al historial por cada vez que alguien **mira** una
     * actividad. Es lo que casi pasó con la galería (D-125).
     */
    const doc = presentacion();
    expect(documentoAForm(doc).libro).toEqual(documentoAForm(doc).libro);
    expect(JSON.stringify(libroVacio())).toBe(JSON.stringify(libroVacio()));
    // Y el formulario nace igual a lo que se lee de un documento sin el campo:
    // si difirieran, el formulario nacería sucio (B-87).
    expect(documentoAForm(doc).libro).toEqual(formVacio().libro);
  });

  it('un documento con `libro: null` se lee igual que uno sin el campo', () => {
    expect(documentoAForm(presentacion({ libro: null })).libro).toEqual(libroVacio());
  });
});

describe('la ida y vuelta formulario ⇄ documento no pierde el libro', () => {
  it('escribe título y autor, recortados', () => {
    const doc = formADocumento(
      conLibro({ libro: { titulo: '  Los detectives salvajes  ', autor: ' Roberto Bolaño ' } }),
      'uid',
      true,
    );
    expect(doc.libro).toEqual({ titulo: 'Los detectives salvajes', autor: 'Roberto Bolaño' });
  });

  it('vuelve del documento al formulario tal como se cargó', () => {
    const doc = formADocumento(conLibro(), 'uid', true) as unknown as Actividad;
    expect(documentoAForm(presentacion({ libro: doc.libro })).libro).toEqual({
      titulo: 'Los detectives salvajes',
      autor: 'Roberto Bolaño',
    });
  });

  it('sin título no escribe el bloque: un libro sin título no es un libro', () => {
    // Mismo criterio que `tallerista`, que sin nombre se guarda como `null`.
    const doc = formADocumento(conLibro({ libro: { titulo: '', autor: 'Bolaño' } }), 'uid', true);
    expect(doc.libro).toBeNull();
  });

  it('no lo borra al cambiar el tipo de actividad (§11: las cascadas agregan, no sacan)', () => {
    // A diferencia de `sede`/`online` con la modalidad, el libro sobrevive a un
    // cambio de desplegable: sacar lo que alguien escribió es pérdida de trabajo.
    const doc = formADocumento(conLibro({ tipo: 'taller' as ActividadForm['tipo'] }), 'uid', true);
    expect(doc.libro).toEqual({ titulo: 'Los detectives salvajes', autor: 'Roberto Bolaño' });
  });

  it('enumera los dos campos: una clave de más no entra al documento (§5.2)', () => {
    const doc = formADocumento(
      conLibro({
        libro: {
          titulo: 'Los detectives salvajes',
          autor: '',
          // @ts-expect-error — a propósito: lo que podría llegar de un borrador
          // recuperado o de un documento tocado a mano.
          notaInterna: 'no publicar',
        },
      }),
      'uid',
      true,
    );
    expect(Object.keys(doc.libro as object).sort()).toEqual(['autor', 'titulo']);
  });
});

describe('el libro entra a la búsqueda (§6)', () => {
  it('el searchText normalizado lleva título y autor, sin acentos', () => {
    const doc = formADocumento(conLibro(), 'uid', true);
    expect(doc.searchText).toContain('los detectives salvajes');
    expect(doc.searchText).toContain('roberto bolano');
  });

  it('buscar la obra encuentra la presentación, que es la mitad de por qué existe el campo', () => {
    const texto = buildSearchText({
      titulo: 'Presentación del jueves',
      libro: { titulo: 'Pedro Páramo', autor: 'Juan Rulfo' },
    });
    expect(texto).toContain('pedro paramo');
  });

  it('sin libro, el searchText no cambia', () => {
    const sinLibro = buildSearchText({ titulo: 'Taller de crónica' });
    expect(sinLibro).toBe('taller de cronica');
  });
});

describe('el condicional del §11 y el schema dicen lo mismo', () => {
  it('el libro es de presentación y charla, los mismos tipos que el autor invitado', () => {
    for (const tipo of ['presentacion', 'charla'] as const) {
      expect(esCharla({ ...formVacio(), tipo })).toBe(true);
    }
    for (const tipo of ['taller', 'club-lectura', 'encuentro'] as const) {
      expect(esCharla({ ...formVacio(), tipo })).toBe(false);
    }
  });

  it('el formulario decide con la condición de `condicionales.ts`, no con una propia', () => {
    // El §11 vive en `condicionales.ts` (B-70): si la sección escribiera su
    // propia condición, el campo podría esconderse en un caso donde el documento
    // lo tiene, y ahí lo cargado deja de ser editable sin que nada avise.
    const src = readFileSync('src/components/admin/formulario/SeccionQuien.tsx', 'utf8');
    const bloque = /\{muestraLibro\(form\) && \([\s\S]*?form\.libro\.titulo/.exec(src);
    expect(bloque, 'el bloque del libro no usa `muestraLibro(form)`').not.toBeNull();
    expect(src).toContain('form.libro.autor');
  });

  /**
   * §5.1 + §11 — **lo que se publica se puede ver y borrar desde el panel.**
   *
   * El estado es alcanzable sin hacer nada raro: se carga una presentación con su
   * libro, se cambia el desplegable a taller (o se duplica y se cambia). El
   * documento conserva el libro a propósito —las cascadas agregan y no sacan— y
   * las dos salidas públicas no miran el `tipo`, así que el sitio y el calendario
   * siguen diciendo «Libro: …». Si el bloque se mostrara solo en presentación y
   * charla, eso quedaría publicado y sin pantalla desde donde tocarlo.
   */
  it('un libro heredado por un taller sigue publicándose, así que sigue a la vista', () => {
    const taller = conLibro({ tipo: 'taller' as ActividadForm['tipo'] });
    const doc = formADocumento(taller, 'uid', true) as unknown as Actividad;

    // Sale a las dos salidas públicas…
    expect(toPublic(presentacion({ libro: doc.libro }), 'id1').libro).not.toBeNull();
    expect(construirDescripcion(doc, doc.sesiones[0], {})).toContain('Libro:');
    // …entonces el formulario lo muestra, aunque el tipo ya no lo pida.
    expect(muestraLibro(taller)).toBe(true);
  });

  it('pero en un taller sin libro cargado el bloque no aparece', () => {
    // El §11 sigue mandando para lo que se **pide**: un taller no pide libro.
    expect(muestraLibro({ ...formVacio(), tipo: 'taller' as ActividadForm['tipo'] })).toBe(false);
    expect(muestraLibro({ ...formVacio(), tipo: 'presentacion' as ActividadForm['tipo'] })).toBe(
      true,
    );
  });

  it('no bloquea publicar: es opcional como el bloque de autor invitado', () => {
    const faltantes = faltaParaPublicar(
      conLibro({
        libro: libroVacio(),
        descripcion: 'Se presenta la novela, con lectura de fragmentos.',
        organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
        arancel: { tipo: 'gratis', notas: '' },
      }),
    ).map((i) => i.path.join('.'));
    expect(faltantes.filter((r) => r.startsWith('libro'))).toEqual([]);
  });

  it('el schema acepta el libro cargado y recorta los espacios', () => {
    const r = actividadFormSchema.safeParse(
      conLibro({ libro: { titulo: '  Pedro Páramo ', autor: '' } }),
    );
    expect(r.success).toBe(true);
    expect(r.success && r.data.libro).toEqual({ titulo: 'Pedro Páramo', autor: '' });
  });

  it('rechaza un libro que no es un objeto de dos textos', () => {
    const r = actividadFormSchema.safeParse(
      // @ts-expect-error — lo que llegaría de un borrador de otra versión.
      conLibro({ libro: 'Los detectives salvajes' }),
    );
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toContain('libro');
  });
});

describe('el historial lo cubre sin que nadie lo registre (§12, D-41)', () => {
  /**
   * D-41 elige una lista **negra** de campos de máquina justamente para esto: un
   * campo nuevo del modelo entra al historial solo. Con una lista blanca de
   * campos recuperables, olvidarse de sumarlo haría que pisar el título de la
   * obra **no** guarde versión — pérdida de datos en silencio.
   */
  it('pisar el libro cuenta como cambio de contenido y guarda versión', () => {
    const antes = presentacion({ libro: { titulo: 'Los detectives salvajes', autor: '' } });
    const despues = presentacion({ libro: { titulo: 'Los detectives salvages', autor: '' } });
    expect(camposCambiados(antes, despues)).toEqual(['libro']);
    expect(huboCambioDeContenido(antes, despues)).toBe(true);
  });

  it('y el historial lo nombra en castellano, no como clave del modelo', () => {
    // Sin la entrada del diccionario, la pantalla de versiones ofrecería
    // restaurar «libro» tal cual, que es el error de B-76 en otra pantalla.
    const src = readFileSync('src/components/admin/HistorialActividad.tsx', 'utf8');
    expect(src).toMatch(/^\s*libro: '[^']+',$/m);
  });
});

describe('el mensaje de la barra sabe nombrarlo (B-184)', () => {
  it('las tres rutas tienen nombre y viven en «Quién»', () => {
    for (const ruta of ['libro', 'libro.titulo', 'libro.autor']) {
      expect(CAMPOS[ruta], `falta el nombre de ${ruta}`).toBeDefined();
      expect(seccionDeCampo(ruta)).toBe('quien');
    }
    expect(etiquetaDeCampo('libro.titulo')).toBe('Libro presentado');
    expect(etiquetaDeCampo('libro.autor')).toBe('Autor del libro');
  });
});

describe('la descripción del evento se arma adentro de @calendario (D-20)', () => {
  it('la vista previa del panel no reimplementa la línea del libro', () => {
    /*
     * La vista previa importa `construirEvento` de `@calendario` (D-20), así que
     * se actualiza sola. Lo que este chequeo cuida es lo contrario: que nadie
     * arme la línea del libro por fuera —en el panel o en `index.js`—, porque
     * entonces dejaría de entrar al payload que compara la guarda anti-loop y el
     * cambio dejaría de propagarse a las N sesiones **en silencio** (trampa 9).
     */
    const fuentes = [
      'src/lib/vistaPreviaEvento.ts',
      'src/components/admin/VistaPreviaEvento.tsx',
      'functions/index.js',
    ];
    for (const archivo of fuentes) {
      expect(readFileSync(archivo, 'utf8'), `${archivo} arma la línea del libro`).not.toMatch(
        /['"`]Libro:/,
      );
    }
    // Y el único que la arma, la arma: si esto deja de valer, el chequeo de
    // arriba pasaría por vacío.
    expect(readFileSync('functions/calendario.js', 'utf8')).toContain('`Libro: ${libro.titulo}');
  });

  it('y la descripción que ve el panel es la del evento publicado', () => {
    const doc = formADocumento(conLibro(), 'uid', true) as unknown as Actividad;
    const texto = construirDescripcion(doc, doc.sesiones[0], {});
    expect(texto).toContain('Libro: Los detectives salvajes — Roberto Bolaño');
  });
});
