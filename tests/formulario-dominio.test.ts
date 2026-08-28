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
import {
  formVacio,
  modalidadVacia,
  onlineVacio,
  primeraOpcionBase,
  sedeVacia,
} from '@/lib/formulario/estadoInicial';
import opcionesBase from '@/lib/opciones-base.json';
import {
  CICLOS_POR_TIPO,
  conModalidadDeFila,
  cambiarTipo,
  cambiarTitulo,
} from '@/lib/formulario/cascadas';
import {
  esCharla,
  esClub,
  esTaller,
  necesitaOnline,
  necesitaSede,
  nombrePersona,
} from '@/lib/formulario/condicionales';
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
    expect(f.sesiones).toHaveLength(1);
    expect(f.sesiones[0]!.id).toMatch(/^ses_/); // trampa 2: id de cliente, no índice
    // B-224 — una sola forma de cursar, presencial, con su sede y sin online.
    expect(f.modalidades).toHaveLength(1);
    expect(f.modalidades[0]!.id).toMatch(/^mod_/); // trampa 2, otra vez
    expect(f.modalidades[0]!.modalidad).toBe('presencial');
    expect(f.modalidades[0]!.sede).not.toBeNull();
    expect(f.modalidades[0]!.online).toBeNull();
    // Las dos fechas nacen vacías: son opcionales y no se inventa un «hoy».
    expect(f.modalidades[0]!.inicio).toBe('');
    expect(f.modalidades[0]!.fin).toBe('');
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

  it('B-129 — una feria es un ciclo, pero sin material ni tallerista', () => {
    // Una feria del libro dura varios días: es una actividad con N encuentros
    // (§2.2), uno por jornada. Sin esta cascada caía en el default y había que
    // acordarse de tildar «es un ciclo» a mano — el olvido que el §11 evita.
    const f = cambiarTipo(formVacio(), 'feria');
    expect(f.esCiclo).toBe(true);
    // Y las dos que NO le corresponden: una feria no tiene quien la dé, y el
    // material de lectura no es su caso. Sin estas dos afirmaciones el test
    // pasaría igual con una cascada que prende todo.
    expect(f.material.tiene).toBe(false);
    expect(f.tallerista).toBeNull();
  });

  it('B-129 — «Feria» está entre las opciones de fábrica del tipo', () => {
    const tipos = opcionesBase.tipo as { slug: string; fijo: boolean }[];
    const feria = tipos.find((v) => v.slug === 'feria');
    // `fijo` es lo que la protege de que alguien la borre desde la pantalla de
    // taxonomías (§4.3): la cascada de arriba la nombra por slug, así que
    // borrarla dejaría la regla apuntando a un tipo que no se puede elegir.
    expect(feria?.fijo).toBe(true);
  });

  it('B-192 / DEC-9 — «Librería a la calle» es un ciclo, con la cascada de «Feria»', () => {
    // Dos reportes del panel pedían lo mismo con tres nombres distintos («Venta
    // especial», «Librería ABIERTA», «Librería a la calle»). Se eligió UN slug,
    // porque un valor nuevo no es reversible —parte los datos en dos que después
    // nadie puede volver a juntar, la lección de B-134— y la etiqueta sí lo es.
    //
    // La cascada es la de «Feria» y por el mismo motivo: salir a la vereda un
    // sábado es un día, y una semana de la librería son varias jornadas.
    const f = cambiarTipo(formVacio(), 'libreria-a-la-calle');
    expect(f.esCiclo).toBe(true);
    // Y las dos que no le corresponden: una librería en la calle no tiene quien
    // la dé ni material de lectura asignado.
    expect(f.material.tiene).toBe(false);
    expect(f.tallerista).toBeNull();
  });

  it('B-192 — está entre las opciones de fábrica y protegida con `fijo`', () => {
    const tipos = opcionesBase.tipo as { slug: string; label: string; fijo: boolean }[];
    const libreria = tipos.find((v) => v.slug === 'libreria-a-la-calle');
    expect(libreria?.label).toBe('Librería a la calle');
    // La cascada la nombra por slug: borrarla desde la pantalla de taxonomías
    // dejaría la regla apuntando a un tipo que no se puede elegir (§4.3).
    expect(libreria?.fijo).toBe(true);
  });

  it('la cascada de ciclos no se escribe dos veces: los tipos salen del Set', () => {
    // El registro y la regla tienen que ser la misma cosa: una cadena de `||` que
    // crece es cómo un tipo nuevo queda con la mitad de la cascada.
    for (const tipo of CICLOS_POR_TIPO) {
      expect(cambiarTipo(formVacio(), tipo).esCiclo, `${tipo} tendría que ser ciclo`).toBe(true);
    }
    // Y un tipo que no está en el Set no prende nada.
    expect(cambiarTipo(formVacio(), 'charla').esCiclo).toBe(false);
  });

  it('todo tipo del Set existe como opción de fábrica y está protegido', () => {
    // Es la otra dirección, y es la que faltaría si alguien agrega un slug al Set
    // sin agregarlo al JSON: la cascada apuntaría a un tipo inexistente.
    const tipos = opcionesBase.tipo as { slug: string; fijo: boolean }[];
    for (const tipo of CICLOS_POR_TIPO) {
      const opcion = tipos.find((v) => v.slug === tipo);
      expect(opcion, `${tipo} no está en opciones-base.json`).toBeDefined();
      expect(opcion?.fijo, `${tipo} tendría que ser fijo`).toBe(true);
    }
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

describe('conModalidadDeFila — §11, ahora por fila (B-224)', () => {
  const fila = () => modalidadVacia('presencial');

  it('virtual borra la sede y crea el bloque online', () => {
    const f = conModalidadDeFila(fila(), 'virtual');
    expect(f.sede).toBeNull();
    expect(f.online).toEqual(onlineVacio());
  });

  it('presencial borra el online y crea la sede', () => {
    const f = conModalidadDeFila(conModalidadDeFila(fila(), 'virtual'), 'presencial');
    expect(f.online).toBeNull();
    expect(f.sede).toEqual(sedeVacia());
  });

  it('híbrido tiene las dos cosas', () => {
    const f = conModalidadDeFila(fila(), 'hibrido');
    expect(f.sede).not.toBeNull();
    expect(f.online).not.toBeNull();
  });

  it('el link de la reunión nace sin publicar (§5.1, trampa 5)', () => {
    expect(conModalidadDeFila(fila(), 'virtual').online!.urlPublica).toBe(false);
  });

  it('conserva la sede ya cargada al pasar a híbrido', () => {
    const con = { ...fila(), sede: { ...sedeVacia(), nombre: 'Casa Brandon' } };
    expect(conModalidadDeFila(con, 'hibrido').sede!.nombre).toBe('Casa Brandon');
  });

  it('no toca el id de la fila: cambiar de modalidad no la reemplaza (trampa 2)', () => {
    const f = fila();
    expect(conModalidadDeFila(f, 'virtual').id).toBe(f.id);
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
// Condicionales del §11: qué partes del formulario aplican
// ─────────────────────────────────────────────────────────────────────

describe('condicionales del §11', () => {
  const con = (over: Partial<ActividadForm>) => ({ ...formVacio(), ...over });

  it('el tallerista es del taller; el autor invitado, de presentación y charla', () => {
    expect(esTaller(con({ tipo: 'taller' }))).toBe(true);
    expect(esCharla(con({ tipo: 'presentacion' }))).toBe(true);
    expect(esCharla(con({ tipo: 'charla' }))).toBe(true);
    expect(esCharla(con({ tipo: 'taller' }))).toBe(false);
    expect(esClub(con({ tipo: 'club-lectura' }))).toBe(true);
  });

  it('el rótulo de la persona cambia con el tipo', () => {
    expect(nombrePersona(con({ tipo: 'taller' }))).toBe('Tallerista');
    expect(nombrePersona(con({ tipo: 'charla' }))).toBe('Autor o autora invitada');
  });

  it('híbrido pide las dos cosas; virtual y presencial, una cada uno', () => {
    const conFila = (m: 'presencial' | 'virtual' | 'hibrido') =>
      con({ modalidades: [modalidadVacia(m)] });
    expect(necesitaSede(conFila('hibrido'))).toBe(true);
    expect(necesitaOnline(conFila('hibrido'))).toBe(true);
    expect(necesitaSede(conFila('virtual'))).toBe(false);
    expect(necesitaOnline(conFila('presencial'))).toBe(false);
  });

  it('B-224 — con dos filas, la actividad pide lo de las dos', () => {
    const dos = con({ modalidades: [modalidadVacia('presencial'), modalidadVacia('virtual')] });
    expect(necesitaSede(dos)).toBe(true);
    expect(necesitaOnline(dos)).toBe(true);
  });

  it('lo que el formulario muestra es lo mismo que el schema exige', () => {
    // Si se separan, el formulario esconde un campo que el schema pide y el
    // guardado falla por algo que no está en pantalla. `conModalidadDeFila` crea
    // el bloque exactamente cuando el condicional dice que hace falta.
    for (const modalidad of ['presencial', 'virtual', 'hibrido'] as const) {
      const fila = conModalidadDeFila(modalidadVacia('presencial'), modalidad);
      const f = con({ modalidades: [fila] });
      expect(fila.sede !== null).toBe(necesitaSede(f));
      expect(fila.online !== null).toBe(necesitaOnline(f));
    }
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
    registrarUsos: async (campo, slugs) =>
      void llamadas.push(`registrarUsos:${campo}:${slugs.join(',')}`),
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
    // La secuencia completa, y no solo "la actividad va primero": el orden
    // relativo de los tres tramos es lo que hace que ninguno rompa al otro.
    // `registrarUsos` va al final porque no crea el documento de opciones si no
    // existe (B-168, D-103), así que contar antes de sembrar no contaría nada.
    expect(llamadas).toEqual([
      'slugDisponible',
      'crearActividad',
      'upsertOpcion:arancel',
      'upsertOpciones:tags',
      // El arancel se cuenta acá porque el fixture por defecto es incoherente
      // a propósito de nada: dice que se tipeó «Con beca parcial» pero el form
      // guarda `a-la-gorra`. En el panel real no puede pasar —`recordarLabel`
      // registra el label en el mismo cambio que pone su slug en el form— y el
      // test de abajo usa un fixture coherente para ejercitar la resta.
      'registrarUsos:arancel:a-la-gorra',
      'registrarUsos:tipo:taller',
      'registrarUsos:barrio:villa-crespo',
      'registrarUsos:plataforma:zoom',
    ]);
  });

  it('B-168 — no vuelve a contar la etiqueta que se acaba de crear', async () => {
    // `upsertOpcion` la siembra con `usos: 1`. Sumarla otra vez la deja en 2, y
    // el orden por frecuencia del §4.3 arranca torcido justo para las nuevas —
    // que son las que ese mismo párrafo quiere poder distinguir de la basura.
    // El síntoma sería silencioso: números plausibles y un orden mal.
    const { puertos, llamadas } = puertosFalsos();
    await guardarActividad(
      entrada({
        // Coherente, que es la mitad que importa: el form guarda el slug de la
        // etiqueta que se tipeó. Con el fixture por defecto —label nuevo de un
        // campo cuyo valor guardado es otro— la resta no tiene nada que restar
        // y el chequeo pasaría sin haber mirado el caso.
        labelsNuevos: [{ campo: 'arancel' as const, label: 'Con beca parcial' }],
        tagsNuevos: { 'micro-ficcion': 'Micro ficción' },
        form: formularioLleno({
          arancel: { tipo: 'con-beca-parcial', notas: '' },
          tags: ['micro-ficcion', 'taller-largo'],
        }),
      }),
      puertos,
    );
    const contados = llamadas.filter((l) => l.startsWith('registrarUsos:'));

    // Ninguno de los dos recién creados se vuelve a contar.
    expect(contados.join(' ')).not.toContain('con-beca-parcial');
    expect(contados.join(' ')).not.toContain('micro-ficcion');
    // Los que ya existían sí — sin esto el chequeo pasaría con la lista vacía.
    expect(contados).toContain('registrarUsos:tipo:taller');
    expect(contados).toContain('registrarUsos:tags:taller-largo');
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
