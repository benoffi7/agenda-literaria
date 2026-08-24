/**
 * La lógica de dominio del formulario de carga, que hasta B-70 vivía dentro de
 * `ActividadFormulario.tsx` y por lo tanto **ningún test podía ejecutar**: no
 * hay testing-library (B-08), así que las reglas del modelo escritas en un
 * `.tsx` se podían invertir con `npm test` entero en verde.
 *
 * Son cuatro módulos puros (`src/lib/formulario/`), y el caso de uso de
 * guardado recibe sus escrituras como puertos: eso permite afirmar el **orden**
 * de las dos escrituras, que es exactamente el bug B-71.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formVacio, onlineVacio, primeraOpcionBase, sedeVacia } from '@/lib/formulario/estadoInicial';
import { cambiarModalidad, cambiarTipo, cambiarTitulo } from '@/lib/formulario/cascadas';
import { labelsPendientesDe, recordarLabel } from '@/lib/formulario/etiquetas';
import {
  guardarActividad,
  type PuertosGuardado,
  type ResultadoGuardado,
} from '@/lib/formulario/guardar';
import { OPCIONES_BASE, ordenarValores } from '@/lib/opciones';
import { formularioLleno } from './fixtures/formulario';
import type { ActividadForm } from '@/types/actividad';

// ─────────────────────────────────────────────────────────────────────
// Estado inicial (§3.1) y la preselección de B-87
// ─────────────────────────────────────────────────────────────────────

describe('formVacio — el documento por defecto del §3.1', () => {
  it('arranca en borrador, presencial, con un encuentro y sin online', () => {
    const f = formVacio();
    expect(f.estado).toBe('borrador');
    expect(f.modalidad).toBe('presencial');
    expect(f.sesiones).toHaveLength(1);
    expect(f.sesiones[0]!.id).toMatch(/^ses_/); // trampa 2: id de cliente, no índice
    expect(f.sede).not.toBeNull();
    expect(f.online).toBeNull();
    expect(f.tallerista).toBeNull();
  });

  it('B-87 — `tipo` nace preseleccionado, no vacío', () => {
    // El desplegable preselecciona la primera opción (D-12). Si eso pasa en un
    // efecto del hijo en lugar de acá, el formulario nace "con cambios sin
    // guardar" y el aviso de versión nueva no se auto-recarga nunca.
    expect(formVacio().tipo).toBe('taller');
    expect(formVacio().tipo).toBe(primeraOpcionBase('tipo'));
  });

  it('la preselección es la misma opción que mostraría el desplegable', () => {
    // El desplegable ordena con `ordenarValores` y ninguna opción creada con
    // "Otro" puede quedar antes que una fija (§4.3), así que la primera
    // elegible es siempre la primera base. Este test ata las dos derivaciones.
    for (const campo of ['tipo', 'plataforma'] as const) {
      expect(primeraOpcionBase(campo)).toBe(ordenarValores(OPCIONES_BASE[campo])[0]!.slug);
    }
  });

  it('barrio y tags no tienen nada que preseleccionar', () => {
    expect(primeraOpcionBase('barrio')).toBe('');
    expect(primeraOpcionBase('tags')).toBe('');
  });

  it('el arancel NO se preselecciona (D-16)', () => {
    // El default sería "Gratis" y un taller pago que nadie corrige se publica
    // como gratuito, en el sitio y en el calendario.
    expect(formVacio().arancel.tipo).toBe('');
  });

  it('cada llamada trae una sesión con id propio', () => {
    expect(formVacio().sesiones[0]!.id).not.toBe(formVacio().sesiones[0]!.id);
  });
});

/**
 * El chequeo de clase de B-87: el bug no era "el campo `tipo`", era **la
 * forma** —un efecto de un componente hijo escribiendo el estado inicial del
 * padre después del primer render—. El campo `plataforma` puede seguir usando
 * el efecto: su preselección la dispara un cambio de modalidad, o sea una
 * acción de quien carga, y para entonces el formulario ya está sucio de verdad.
 */
describe('B-87 — el estado inicial no se completa desde un efecto', () => {
  const fuentes = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? fuentes(`${dir}/${e.name}`)
        : e.name.endsWith('.tsx')
          ? [readFileSync(`${dir}/${e.name}`, 'utf8')]
          : [],
    );

  /** El bloque de un `<TaxonomiaSelect campo="X" …/>`, en cualquier archivo. */
  const bloqueDelCampo = (campo: string): string => {
    for (const src of fuentes('src/components/admin')) {
      const i = src.indexOf(`campo="${campo}"`);
      if (i === -1) continue;
      const resto = src.slice(i);
      return resto.slice(0, resto.indexOf('/>'));
    }
    return '';
  };

  it('el campo tipo existe en el formulario', () => {
    // Guarda contra el falso verde: si el campo se renombra o se mueve, el
    // test de abajo pasaría sin haber mirado nada.
    expect(bloqueDelCampo('tipo')).not.toBe('');
  });

  it('el campo tipo no delega su preselección a un efecto', () => {
    expect(bloqueDelCampo('tipo')).not.toContain('autoSeleccionarPrimera');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Cascadas (§2.2, §11)
// ─────────────────────────────────────────────────────────────────────

describe('cambiarTipo — §2.2 y §11', () => {
  it('un club de lectura es un ciclo con material', () => {
    const f = cambiarTipo(formVacio(), 'club-lectura');
    expect(f.esCiclo).toBe(true);
    expect(f.material.tiene).toBe(true);
  });

  it('un taller abre el bloque de tallerista', () => {
    expect(cambiarTipo(formVacio(), 'taller').tallerista).toEqual({
      nombre: '',
      bio: '',
      instagram: '',
    });
  });

  it('una presentación y una charla también (es el autor invitado)', () => {
    expect(cambiarTipo(formVacio(), 'presentacion').tallerista).not.toBeNull();
    expect(cambiarTipo(formVacio(), 'charla').tallerista).not.toBeNull();
  });

  it('un encuentro no abre el bloque de persona', () => {
    expect(cambiarTipo(formVacio(), 'encuentro').tallerista).toBeNull();
  });

  it('no pisa el tallerista ya cargado', () => {
    const con = { ...formVacio(), tallerista: { nombre: 'Ana', bio: 'b', instagram: '@a' } };
    expect(cambiarTipo(con, 'taller').tallerista!.nombre).toBe('Ana');
  });

  it('salir de club de lectura no apaga el ciclo ni borra el material', () => {
    // Las cascadas agregan y no sacan: quitarle datos a alguien por cambiar un
    // desplegable es pérdida de trabajo, y los checkboxes están al lado.
    const club = cambiarTipo(formVacio(), 'club-lectura');
    const taller = cambiarTipo(club, 'taller');
    expect(taller.esCiclo).toBe(true);
    expect(taller.material.tiene).toBe(true);
  });
});

describe('cambiarModalidad — §11', () => {
  it('virtual borra la sede y crea el bloque online', () => {
    const f = cambiarModalidad(formVacio(), 'virtual');
    expect(f.sede).toBeNull();
    expect(f.online).toEqual(onlineVacio());
  });

  it('presencial borra el online y crea la sede', () => {
    const f = cambiarModalidad(cambiarModalidad(formVacio(), 'virtual'), 'presencial');
    expect(f.online).toBeNull();
    expect(f.sede).toEqual(sedeVacia());
  });

  it('híbrido tiene las dos cosas', () => {
    const f = cambiarModalidad(formVacio(), 'hibrido');
    expect(f.sede).not.toBeNull();
    expect(f.online).not.toBeNull();
  });

  it('el link de la reunión nace sin publicar (§5.1, trampa 5)', () => {
    expect(cambiarModalidad(formVacio(), 'virtual').online!.urlPublica).toBe(false);
  });

  it('conserva la sede ya cargada al pasar a híbrido', () => {
    const con = { ...formVacio(), sede: { ...sedeVacia(), nombre: 'Casa Brandon' } };
    expect(cambiarModalidad(con, 'hibrido').sede!.nombre).toBe('Casa Brandon');
  });
});

describe('cambiarTitulo — trampa 10', () => {
  it('deriva el slug del título mientras no esté publicada', () => {
    expect(cambiarTitulo(formVacio(), 'Taller de Crónica Urbana', false).slug).toBe(
      'taller-de-cronica-urbana',
    );
  });

  it('con el slug bloqueado el título cambia y el slug no', () => {
    const publicada = { ...formVacio(), slug: 'taller-viejo' };
    const f = cambiarTitulo(publicada, 'Otro título', true);
    expect(f.titulo).toBe('Otro título');
    expect(f.slug).toBe('taller-viejo');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Buffer de etiquetas (D-02)
// ─────────────────────────────────────────────────────────────────────

describe('recordarLabel — buffer de etiquetas sin persistir (D-02)', () => {
  it('recuerda la etiqueta tipeada', () => {
    expect(recordarLabel([], 'arancel', 'Con beca parcial')).toEqual([
      { campo: 'arancel', label: 'Con beca parcial' },
    ]);
  });

  it('reemplaza la del mismo campo en lugar de acumularla', () => {
    // El campo tiene un solo valor: persistir la anterior crearía en la
    // taxonomía una opción que nadie eligió (el `usos: 1` colgado del §4.3).
    const uno = recordarLabel([], 'arancel', 'Con beca');
    const dos = recordarLabel(uno, 'arancel', 'Con beca parcial');
    expect(dos).toEqual([{ campo: 'arancel', label: 'Con beca parcial' }]);
  });

  it('no toca las de otros campos', () => {
    const previos = recordarLabel([], 'barrio', 'Parque Chas');
    expect(recordarLabel(previos, 'arancel', 'Con beca')).toHaveLength(2);
  });

  it('elegir una opción que ya existe no recuerda nada', () => {
    expect(recordarLabel([], 'arancel', undefined)).toEqual([]);
  });
});

describe('labelsPendientesDe — lo que la vista previa necesita', () => {
  it('indexa por slug y recorta la etiqueta', () => {
    expect(labelsPendientesDe([{ campo: 'arancel', label: '  Con beca parcial ' }], {})).toEqual({
      arancel: { 'con-beca-parcial': 'Con beca parcial' },
    });
  });

  it('suma los tags, que son multivalor', () => {
    const mapa = labelsPendientesDe([], { 'micro-ficcion': ' Micro ficción ' });
    expect(mapa.tags).toEqual({ 'micro-ficcion': 'Micro ficción' });
  });

  it('sin etiquetas pendientes el mapa está vacío', () => {
    expect(labelsPendientesDe([], {})).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────
// El caso de uso de guardado, y el orden de escritura de B-71
// ─────────────────────────────────────────────────────────────────────

/** Puertos falsos que registran el orden en que se los llama. */
const puertosFalsos = (over: Partial<PuertosGuardado> = {}) => {
  const llamadas: string[] = [];
  const puertos: PuertosGuardado = {
    slugDisponible: async () => (llamadas.push('slugDisponible'), true),
    upsertOpcion: async (campo) => (llamadas.push(`upsertOpcion:${campo}`), 'slug'),
    upsertOpciones: async (campo) => (llamadas.push(`upsertOpciones:${campo}`), []),
    crearActividad: async () => (llamadas.push('crearActividad'), 'act1'),
    actualizarActividad: async () => void llamadas.push('actualizarActividad'),
    ...over,
  };
  return { puertos, llamadas };
};

const entrada = (over: Partial<Parameters<typeof guardarActividad>[0]> = {}) => ({
  form: formularioLleno(),
  uid: 'uid-1',
  labelsNuevos: [{ campo: 'arancel' as const, label: 'Con beca parcial' }],
  tagsNuevos: {},
  ...over,
});

const ok = (r: ResultadoGuardado) => {
  if (r.estado !== 'ok') throw new Error(`se esperaba ok y vino ${r.estado}`);
  return r;
};

describe('guardarActividad — caso feliz', () => {
  it('crea la actividad y devuelve su id', async () => {
    const { puertos } = puertosFalsos();
    expect(ok(await guardarActividad(entrada(), puertos)).id).toBe('act1');
  });

  it('escribe el mismo slug que devuelve, y ya normalizado', async () => {
    // El schema solo acepta la forma canónica (`^[a-z0-9]+(-[a-z0-9]+)*$`), así
    // que el `slugify` del caso de uso es la segunda red: lo que importa es que
    // lo escrito y lo devuelto sean el mismo slug. Si se separaran, la URL
    // publicada y la que muestra el panel dirían cosas distintas (trampa 10).
    let escrito: ActividadForm | null = null;
    const { puertos } = puertosFalsos({
      crearActividad: async (f) => ((escrito = f), 'act1'),
    });
    const r = ok(
      await guardarActividad(
        entrada({ form: formularioLleno({ slug: 'taller-de-cronica' }) }),
        puertos,
      ),
    );
    expect(r.guardado.slug).toBe('taller-de-cronica');
    expect(escrito!.slug).toBe(r.guardado.slug);
  });

  it('editar actualiza en lugar de crear', async () => {
    const { puertos, llamadas } = puertosFalsos();
    await guardarActividad(entrada({ idActual: 'act-existente' }), puertos);
    expect(llamadas).toContain('actualizarActividad');
    expect(llamadas).not.toContain('crearActividad');
  });

  it('"Guardar borrador" fuerza el estado sin tocar el formulario', async () => {
    const { puertos } = puertosFalsos();
    const form = formularioLleno({ estado: 'publicado' });
    const r = ok(await guardarActividad(entrada({ form, estadoDestino: 'borrador' }), puertos));
    expect(r.guardado.estado).toBe('borrador');
    expect(form.estado).toBe('publicado');
  });
});

describe('guardarActividad — lo que no se guarda', () => {
  it('un formulario inválido no escribe nada y mapea los errores por path', async () => {
    const { puertos, llamadas } = puertosFalsos();
    const r = await guardarActividad(
      entrada({ form: formularioLleno({ titulo: '' }) }),
      puertos,
    );
    expect(r.estado).toBe('invalido');
    if (r.estado === 'invalido') expect(Object.keys(r.errores)).toContain('titulo');
    expect(llamadas).toEqual([]);
  });

  it('un slug tomado no escribe nada', async () => {
    const { puertos, llamadas } = puertosFalsos({ slugDisponible: async () => false });
    const r = await guardarActividad(entrada(), puertos);
    expect(r.estado).toBe('slug-tomado');
    // Ni la actividad ni la taxonomía: el chequeo de slug corta antes de todo.
    expect(llamadas).toEqual([]);
  });

  it('un error de red al escribir la actividad se devuelve como error', async () => {
    const { puertos } = puertosFalsos({
      crearActividad: async () => {
        throw new Error('offline');
      },
    });
    expect((await guardarActividad(entrada(), puertos)).estado).toBe('error');
  });
});

describe('B-71 — la actividad se escribe antes que las etiquetas', () => {
  it('el orden es: chequear slug, escribir la actividad, registrar etiquetas', async () => {
    const { puertos, llamadas } = puertosFalsos();
    await guardarActividad(
      entrada({ tagsNuevos: { 'micro-ficcion': 'Micro ficción' }, form: formularioLleno({ tags: ['micro-ficcion'] }) }),
      puertos,
    );
    expect(llamadas).toEqual([
      'slugDisponible',
      'crearActividad',
      'upsertOpcion:arancel',
      'upsertOpciones:tags',
    ]);
  });

  it('si la actividad no se puede escribir, no queda ninguna opción huérfana', async () => {
    // Era el bug: las opciones se creaban primero, así que un guardado fallido
    // dejaba etiquetas colgadas en el desplegable sin UI para limpiarlas (B-06).
    const { puertos, llamadas } = puertosFalsos({
      crearActividad: async () => {
        throw new Error('permission-denied');
      },
    });
    await guardarActividad(entrada(), puertos);
    expect(llamadas.filter((l) => l.startsWith('upsert'))).toEqual([]);
  });

  it('si falla el registro de la etiqueta, el guardado igual es ok', async () => {
    // La actividad ya está escrita. Reportar error haría que el segundo intento
    // choque contra su propio slug sobre algo que se guardó bien; el peor caso
    // es una etiqueta que se ve des-slugueada (D-11).
    const { puertos } = puertosFalsos({
      upsertOpcion: async () => {
        throw new Error('offline');
      },
    });
    const r = ok(await guardarActividad(entrada(), puertos));
    expect(r.id).toBe('act1');
    expect(r.etiquetasSinRegistrar).toBe(true);
  });

  it('sin etiquetas nuevas no se toca la taxonomía', async () => {
    const { puertos, llamadas } = puertosFalsos();
    await guardarActividad(entrada({ labelsNuevos: [] }), puertos);
    expect(llamadas.filter((l) => l.startsWith('upsert'))).toEqual([]);
  });
});
