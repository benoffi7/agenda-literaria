import { describe, expect, it } from 'vitest';
import type { Imagen } from '@/types/actividad';
import { actividadFormSchema, faltaParaPublicar } from '@/lib/schema';
import { sesionVacia } from '@/lib/sesiones';
import type { ItemMaterial } from '@/types/actividad';

/**
 * Los dos niveles de validación de B-183.
 *
 * El schema es uno solo y la condición es `estado === 'publicado'`, así que casi
 * todos los tests de completitud de acá abajo se escriben sobre `publicado()`:
 * son las reglas del §11, que ahora corren al publicar y no al guardar a medias.
 * Los que se escriben sobre `valido()` —un borrador— son los que tienen que
 * seguir bloqueando en los dos niveles: ids de sesión, fechas y formato del slug.
 */
const valido = () => ({
  tipo: 'taller',
  titulo: 'Taller de crónica urbana',
  slug: 'taller-cronica-urbana',
  descripcion: 'Escritura de no ficción, ocho encuentros.',
  imagenUrl: '',
  organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
  tallerista: null,
  esCiclo: false,
  sesiones: [{ ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' }],
  // B-224 — una forma de cursar presencial, con su sede adentro.
  modalidades: [
    {
      id: 'mod_1',
      modalidad: 'presencial' as const,
      inicio: '',
      fin: '',
      sede: {
        nombre: 'Casa Brandon',
        direccion: 'Drago 236',
        barrio: 'villa-crespo',
        ciudad: 'CABA',
        indicaciones: '',
        geo: null,
      },
      online: null,
    },
  ],
  inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: '' },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  material: { tiene: false, items: [] as ItemMaterial[] },
  difusion: { arrobar: [], notas: '' },
  estado: 'borrador' as const,
  tags: [],
  destacado: false,
});

/** La misma actividad, pero saliendo al público: el nivel largo. */
const publicado = () => ({ ...valido(), estado: 'publicado' as const });

const errores = (v: unknown) => {
  const r = actividadFormSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

/** Como `errores`, pero con el mensaje: para afirmar CUÁL rechazo y no solo QUE lo hay (B-200). */
const mensajes = (v: unknown): Record<string, string> => {
  const r = actividadFormSchema.safeParse(v);
  if (r.success) return {};
  const mapa: Record<string, string> = {};
  for (const i of r.error.issues) mapa[i.path.join('.')] = i.message;
  return mapa;
};

describe('schema — caso feliz', () => {
  it('acepta una actividad presencial completa', () => {
    expect(actividadFormSchema.safeParse(valido()).success).toBe(true);
  });

  it('la acepta también publicada', () => {
    expect(actividadFormSchema.safeParse(publicado()).success).toBe(true);
  });
});

describe('schema — el borrador se guarda a medias (B-183)', () => {
  /**
   * El pedido del dueño, palabra por palabra: "No me deja GUARDAR BORRADOR si
   * no completo todo". Esto es el mínimo con el que ahora se puede guardar: el
   * título, y el slug que se genera solo desde el título.
   */
  const aMedias = () => ({
    ...valido(),
    tipo: '',
    descripcion: '',
    organizador: { nombre: '', instagram: '', web: '' },
    sesiones: [],
    arancel: { tipo: '', notas: '' },
    modalidades: [
      {
        id: 'mod_1',
        modalidad: 'presencial' as const,
        inicio: '',
        fin: '',
        sede: { nombre: '', direccion: '', barrio: '', ciudad: '', indicaciones: '', geo: null },
        online: null,
      },
    ],
  });

  it('guarda un borrador con solo título y slug', () => {
    expect(errores(aMedias())).toEqual([]);
  });

  it('guarda un borrador sin ningún encuentro cargado', () => {
    expect(errores({ ...valido(), sesiones: [] })).toEqual([]);
  });

  it('guarda un borrador con una URL de imagen a medio escribir', () => {
    expect(errores({ ...valido(), imagenUrl: 'https://ins' })).toEqual([]);
  });

  it('guarda un borrador de un ciclo con un solo encuentro', () => {
    expect(errores({ ...valido(), esCiclo: true })).toEqual([]);
  });

  it('guarda un borrador con material tildado y sin ítems', () => {
    expect(errores({ ...valido(), material: { tiene: true, items: [] } })).toEqual([]);
  });

  it('guarda un borrador que pide inscripción sin decir por dónde', () => {
    const v = valido();
    v.inscripcion = { ...v.inscripcion, requiere: true };
    expect(errores(v)).toEqual([]);
  });

  it('pero sigue pidiendo un título: sin él no se lo encuentra en el listado', () => {
    expect(errores({ ...aMedias(), titulo: '' })).toContain('titulo');
  });

  it('y sigue pidiendo el slug, que es la dirección del documento', () => {
    expect(errores({ ...aMedias(), slug: '' })).toContain('slug');
  });

  it('el mismo borrador a medias NO se puede publicar', () => {
    // El par que define los dos niveles: mismo formulario, dos respuestas.
    const e = errores({ ...aMedias(), estado: 'publicado' });
    expect(e).toContain('tipo');
    expect(e).toContain('descripcion');
    expect(e).toContain('organizador.nombre');
    expect(e).toContain('arancel.tipo');
    expect(e).toContain('sesiones');
    expect(e).toContain('modalidades.0.sede.nombre');
  });
});

describe('schema — lo que bloquea en los dos niveles', () => {
  /**
   * No es completitud: es que el documento sea legible. Una fecha vacía tira
   * `Fecha inválida` en `formADocumento` (trampa 1) y un id que no viene del
   * cliente rompe el diff contra Calendar (trampa 2). Un borrador con eso
   * adentro no es un borrador incompleto, es un documento roto.
   */
  it('rechaza una fecha de inicio vacía, también en borrador', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, inicio: '' }];
    expect(errores(v)).toContain('sesiones.0.inicio');
  });

  it('rechaza un encuentro que termina antes de empezar, también en borrador', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, inicio: '2026-09-03T21:00', fin: '2026-09-03T19:00' }];
    expect(errores(v)).toContain('sesiones.0.fin');
  });

  it('rechaza ids que no vengan de nuevaSesionId, también en borrador (trampa 2)', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, id: '0' }];
    expect(errores(v)).toContain('sesiones.0.id');
  });

  it('rechaza un slug con mayúsculas y espacios, también en borrador', () => {
    expect(errores({ ...valido(), slug: 'Taller Crónica' })).toContain('slug');
  });

  /**
   * B-200 — antes esto pasaba: `new Date('no es viernes')` es `Invalid Date`,
   * y `Invalid Date > Date válida` da `false` por las reglas de `NaN`, así que
   * el `.refine` de ese entonces SÍ rechazaba... pero con el mensaje de "tiene
   * que terminar después de empezar", que es engañoso cuando el problema real
   * es que se tipeó cualquier cosa.
   *
   * MUTACIÓN PROBADA: volver el `superRefine` a un `.refine` que solo compare
   * fechas. Este caso sigue en rojo (el `errores` ya no contiene el mensaje
   * nuevo), así que la mutación no puede colarse en silencio.
   */
  it('una fecha de inicio corrupta se rechaza con su propio mensaje', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, inicio: 'no es viernes' }];
    const e = mensajes(v);
    expect(e['sesiones.0.inicio']).toBe('Fecha de inicio inválida');
    expect(e['sesiones.0.fin']).toBeUndefined();
  });

  it('una fecha de fin corrupta se rechaza con su propio mensaje', () => {
    const v = valido();
    v.sesiones = [{ ...v.sesiones[0]!, fin: 'tampoco esto' }];
    expect(mensajes(v)['sesiones.0.fin']).toBe('Fecha de fin inválida');
  });

  /**
   * B-200 — el agujero real: `modalidadFilaSchema` compara fechas con
   * `!m.inicio || !m.fin || …`, así que una ventana con una sola punta cargada
   * cortaba en el primer `||` y nunca comparaba nada. Con esa punta corrupta
   * (no vacía, pero tampoco una fecha), pasaba el schema entero y recién
   * `formADocumento` tiraba `Fecha inválida` al convertir — el crash real que
   * el ítem reporta, no una hipótesis.
   *
   * MUTACIÓN PROBADA: volver al `.refine` con el corto circuito original. Este
   * caso pasa a `success: true` (nada en `errores`), que es exactamente el bug.
   */
  it('B-200 — una ventana con una sola fecha corrupta no se cuela por el corto circuito', () => {
    const v = valido();
    v.modalidades = [{ ...v.modalidades[0]!, inicio: 'no es viernes', fin: '' }];
    expect(mensajes(v)['modalidades.0.inicio']).toBe('Fecha de inicio inválida');
  });

  it('B-200 — el cierre de inscripción corrupto se rechaza, también en borrador', () => {
    const v = valido();
    v.inscripcion = { ...v.inscripcion, cierra: 'no es viernes' };
    expect(mensajes(v)['inscripcion.cierra']).toBe('Fecha de cierre inválida');
  });

  it('B-200 — un cierre de inscripción vacío sigue siendo válido (es opcional)', () => {
    expect(errores(valido())).not.toContain('inscripcion.cierra');
  });
});

describe('schema — condicionales de §11, ahora por fila (al publicar)', () => {
  /** La misma actividad publicada, con estas formas de cursar. */
  const conFilas = (...filas: unknown[]) => ({ ...publicado(), modalidades: filas });
  const fila = (over: Record<string, unknown>) => ({
    id: 'mod_x',
    modalidad: 'presencial',
    inicio: '',
    fin: '',
    sede: null,
    online: null,
    ...over,
  });

  it('exige sede en presencial', () => {
    const v = publicado();
    v.modalidades = [
      { ...v.modalidades[0]!, sede: { ...v.modalidades[0]!.sede!, nombre: '', direccion: '' } },
    ];
    expect(errores(v)).toContain('modalidades.0.sede.nombre');
    expect(errores(v)).toContain('modalidades.0.sede.direccion');
  });

  it('exige plataforma en virtual', () => {
    expect(errores(conFilas(fila({ modalidad: 'virtual' })))).toContain(
      'modalidades.0.online.plataforma',
    );
  });

  it('exige sede Y plataforma en híbrido', () => {
    const e = errores(conFilas(fila({ modalidad: 'hibrido' })));
    expect(e).toContain('modalidades.0.sede.nombre');
    expect(e).toContain('modalidades.0.online.plataforma');
  });

  it('no pide sede en virtual', () => {
    const v = conFilas(
      fila({ modalidad: 'virtual', online: { plataforma: 'zoom', url: '', urlPublica: false } }),
    );
    expect(actividadFormSchema.safeParse(v).success).toBe(true);
  });

  it('B-224 — el error señala la fila incompleta y no la primera', () => {
    // La instancia que la lista hace posible: la primera está bien y la segunda
    // no. Sin el índice en el `path`, el mensaje mandaría a mirar el bloque
    // equivocado.
    const v = publicado();
    const e = errores({ ...v, modalidades: [...v.modalidades, fila({ modalidad: 'virtual' })] });
    expect(e).toContain('modalidades.1.online.plataforma');
    expect(e).not.toContain('modalidades.0.online.plataforma');
  });

  it('B-224 — sin ninguna forma de cursar no se puede publicar', () => {
    expect(errores({ ...publicado(), modalidades: [] })).toContain('modalidades');
    // Pero un borrador sin filas sí se guarda: es completitud, no un documento
    // roto (B-183).
    expect(errores({ ...valido(), modalidades: [] })).toEqual([]);
  });

  it('B-224 — una ventana al revés se rechaza en los dos niveles (trampa 1)', () => {
    const v = valido();
    v.modalidades = [
      { ...v.modalidades[0]!, inicio: '2026-06-30T21:00', fin: '2026-03-03T19:00' },
    ];
    expect(errores(v)).toContain('modalidades.0.fin');
  });

  it('B-224 — con una sola de las dos fechas no hay nada que comparar', () => {
    const v = valido();
    v.modalidades = [{ ...v.modalidades[0]!, inicio: '2026-03-03T19:00' }];
    expect(errores(v)).toEqual([]);
  });

  it('B-224 — rechaza ids que no vengan de nuevaModalidadId (trampa 2)', () => {
    const v = valido();
    v.modalidades = [{ ...v.modalidades[0]!, id: '0' }];
    expect(errores(v)).toContain('modalidades.0.id');
  });
});

describe('schema — inscripción (al publicar)', () => {
  it('exige vía y destino si requiere inscripción', () => {
    const v = publicado();
    v.inscripcion = { ...v.inscripcion, requiere: true };
    const e = errores(v);
    expect(e).toContain('inscripcion.via');
    expect(e).toContain('inscripcion.destino');
  });
});

describe('schema — sesiones (al publicar)', () => {
  it('pide al menos un encuentro', () => {
    expect(errores({ ...publicado(), sesiones: [] })).toContain('sesiones');
  });

  it('un ciclo necesita más de un encuentro', () => {
    expect(errores({ ...publicado(), esCiclo: true })).toContain('sesiones');
  });
});

describe('schema — slug', () => {
  it('acepta minúsculas con guiones', () => {
    expect(errores({ ...valido(), slug: 'taller-de-cronica-2026' })).toEqual([]);
  });
});

describe('schema — material (al publicar)', () => {
  it('no deja tildar "tiene material" sin items', () => {
    const v = publicado();
    v.material = { tiene: true, items: [] };
    expect(errores(v)).toContain('material.items');
  });

  it('exige título en cada item', () => {
    const v = publicado();
    v.material = {
      tiene: true,
      items: [{ id: 'mat_1', tipo: 'lectura', titulo: '', url: '', entrega: 'previo', publico: false }],
    };
    expect(errores(v)).toContain('material.items.0.titulo');
  });

  it('nombra la fila exacta cuando el que falta es el segundo', () => {
    const v = publicado();
    v.material = {
      tiene: true,
      items: [
        { id: 'mat_1', tipo: 'lectura', titulo: 'Pedro Páramo', url: '', entrega: 'previo', publico: false },
        { id: 'mat_2', tipo: 'guia', titulo: '', url: '', entrega: 'previo', publico: false },
      ],
    };
    expect(errores(v)).toContain('material.items.1.titulo');
  });
});

describe('schema — la galería (B-167)', () => {
  const img = (over: Partial<Imagen> = {}): Imagen => ({
    id: 'img_1',
    url: 'https://ejemplo.ar/tapa.jpg',
    epigrafe: '',
    // B-301 — cargado en el molde: el alternativo de la portada es obligatorio
    // para publicar (D-440), así que sin esto todos los casos de abajo medirían
    // ese rechazo en vez del que dice su nombre. Su ausencia tiene sus propios
    // casos, más abajo.
    textoAlternativo: 'Flyer con la fecha y la sede',
    origen: 'externa',
    portada: true,
    ...over,
  });

  it('acepta la lista vacía: la imagen nunca fue obligatoria', () => {
    expect(errores({ ...publicado(), imagenes: [] })).toEqual([]);
  });

  it('acepta una externa con portada', () => {
    expect(errores({ ...publicado(), imagenes: [img()] })).toEqual([]);
  });

  it('rechaza al publicar una URL inválida, con la ruta de la fila', () => {
    expect(errores({ ...publicado(), imagenes: [img({ url: 'no-es-una-url' })] })).toContain(
      'imagenes.0.url',
    );
  });

  it('pero un borrador con la URL a medio escribir se guarda igual (D-120)', () => {
    expect(errores({ ...valido(), imagenes: [img({ url: 'https://ins' })] })).toEqual([]);
  });

  it('el id tiene que venir del generador, en los dos niveles (trampa 2)', () => {
    // Por índice, borrar la segunda imagen renumera todo y cualquier cosa que
    // compare por posición cree que cambiaron todas.
    expect(errores({ ...valido(), imagenes: [img({ id: '0' })] })).toContain('imagenes.0.id');
  });

  it('exactamente una portada, en los dos niveles', () => {
    const dos = [img(), img({ id: 'img_2' })];
    expect(errores({ ...valido(), imagenes: dos })).toContain('imagenes');
    const ninguna = [img({ portada: false })];
    expect(errores({ ...valido(), imagenes: ninguna })).toContain('imagenes');
  });

  it('hasta cuatro, en los dos niveles (DEC-7b)', () => {
    const cinco = Array.from({ length: 5 }, (_, n) =>
      img({ id: `img_${n}`, portada: n === 0 }),
    );
    expect(errores({ ...valido(), imagenes: cinco })).toContain('imagenes');
  });

  it('al publicar, la URL tiene que ser https', () => {
    // `z.string().url()` acepta todo lo que `new URL()` parsee, o sea también
    // `data:` y `javascript:`, y esa URL sale entera al events.json y va a
    // terminar en un <img src> y en og:image (B-107). Y un http:// lo bloquea el
    // contenido mixto: imagen rota en el sitio, sin que nada avise.
    for (const url of ['http://ejemplo.ar/tapa.jpg', 'data:image/png;base64,AAA']) {
      expect(
        errores({ ...publicado(), imagenes: [img({ url })] }),
        `se aceptó ${url}`,
      ).toContain('imagenes.0.url');
    }
  });

  it('pero un borrador con http:// se guarda igual: se corrige antes de publicar', () => {
    expect(errores({ ...valido(), imagenes: [img({ url: 'http://ejemplo.ar/t.jpg' })] })).toEqual(
      [],
    );
  });

  it('storagePath se acepta pero no se exige: lo escribe la Function', () => {
    expect(
      errores({ ...publicado(), imagenes: [img({ origen: 'propia', storagePath: 'a/b.jpg' })] }),
    ).toEqual([]);
  });
});

/**
 * B-301 · **D-440** — el texto alternativo se exige **solo en la portada** y
 * **solo al publicar**.
 *
 * DEC-7a (D-125) había decidido lo contrario a propósito —el alternativo salía
 * del título de la actividad— y el desvío del dueño (2026-09-03) le cambia el
 * alcance, no el argumento: un campo por imagen nadie lo llenaría en las cuatro,
 * y la portada es la única que se comparte.
 *
 * Los dos ejes de la condición tienen su caso, porque son las dos formas de
 * escribir mal la regla: pedirlo en todas las filas (y el formulario tendría
 * cuatro campos que el dueño rechazó) o pedirlo en un borrador (y una carga a
 * medio hacer dejaría de guardarse).
 */
/**
 * **El texto alternativo dejó de ser obligatorio para publicar** — lo pidió el
 * dueño el 2026-09-07 («sacame lo de la descripcion obligatoria de la imagen»), y
 * revierte el bloqueo que B-301 / D-440 había puesto cuatro días antes.
 *
 * Los cuatro casos que afirmaban el bloqueo están abajo **dados vuelta y con su
 * texto original citado**, que es cómo este repo registra un desvío: el valor de
 * esos casos era decir qué se rompía si el bloqueo desaparecía, y ahora dicen que
 * desapareció a propósito.
 *
 * **Lo que NO cambió, y sigue con sus casos intactos:** el campo existe, se
 * guarda, viaja en `toPublic`, y las filas secundarias nunca lo pidieron.
 */
describe('el texto alternativo de la portada (B-301, D-440, revertido)', () => {
  const img = (over: Partial<Imagen> = {}): Imagen => ({
    id: 'img_1',
    url: 'https://ejemplo.ar/tapa.jpg',
    epigrafe: '',
    textoAlternativo: 'Flyer con la fecha y la sede',
    origen: 'externa',
    portada: true,
    ...over,
  });

  it('sin él SÍ se puede publicar — el bloqueo se sacó a pedido del dueño', () => {
    /*
     * **Decía lo contrario**: «sin él, no se puede publicar, y el error cae en la
     * fila de la portada». Era la decisión de D-440 y duró cuatro días.
     *
     * El argumento del dueño es el que DEC-7a (D-125) ya había escrito: un campo
     * obligatorio en un panel de una persona produce «foto», y un alternativo de
     * compromiso es peor que el título descriptivo que se arma solo — suena a
     * descripción y no lo es.
     *
     * MUTACIÓN PROBADA: reponer el `superRefine` deja este caso y los tres de
     * abajo en rojo.
     */
    expect(errores({ ...publicado(), imagenes: [img({ textoAlternativo: '' })] })).toEqual([]);
  });

  it('y en blanco tampoco bloquea: no hay nada que exigir', () => {
    // Decía «espacios no describen nada», que era cierto mientras se exigiera.
    expect(errores({ ...publicado(), imagenes: [img({ textoAlternativo: '   ' })] })).toEqual([]);
  });

  it('un documento anterior al campo publica sin problema, y ESE era el punto', () => {
    // La clave directamente no está: es el caso de las 30 imágenes que ya están
    // en producción. Que el rechazo aparezca acá es deliberado — el aviso sale
    // en la barra desde el principio (`faltaParaPublicar`) y guardar como
    // borrador sigue funcionando.»
    //
    // Y ése era el costo que el dueño decidió no pagar: las 30 imágenes que ya
    // están en producción no tienen el campo, así que la próxima vez que alguien
    // publicara cualquiera de esas actividades tenía que escribirlo primero.
    const sinCampo = img();
    delete (sinCampo as { textoAlternativo?: string }).textoAlternativo;
    expect(errores({ ...publicado(), imagenes: [sinCampo] })).toEqual([]);
  });

  it('un borrador sin él se guarda igual (D-120: es completitud, no forma)', () => {
    expect(errores({ ...valido(), imagenes: [img({ textoAlternativo: '' })] })).toEqual([]);
  });

  it('las secundarias NO lo piden: es un campo solo, el de la portada', () => {
    const conSecundariaVacia = [
      img(),
      img({ id: 'img_2', portada: false, textoAlternativo: '' }),
    ];
    expect(errores({ ...publicado(), imagenes: conSecundariaVacia })).toEqual([]);
  });

  it('y no lo pide en ninguna fila, ni en la marcada portada', () => {
    /*
     * Decía «lo pide la fila marcada portada, no la primera de la lista», y era
     * el caso que ataba el schema a `portadaDe` — la mitad que una derivación
     * propia se habría equivocado, pidiendo el campo en la fila que no se
     * comparte (la clase de B-268).
     *
     * **Ese acoplamiento ya no existe acá**, y conviene saber que `portadaDe`
     * sigue siendo la única respuesta a «cuál es la portada»: la usan el editor
     * —que muestra el campo solo en esa fila— la vista previa y el detalle. Lo
     * que se fue es el consumidor del schema, no la función.
     */
    const laSegundaEsPortada = [
      img({ id: 'img_1', portada: false, textoAlternativo: '' }),
      img({ id: 'img_2', portada: true, textoAlternativo: '' }),
    ];
    expect(errores({ ...publicado(), imagenes: laSegundaEsPortada })).toEqual([]);
  });

  it('sin imágenes no se pide nada: la imagen nunca fue obligatoria', () => {
    expect(errores({ ...publicado(), imagenes: [] })).toEqual([]);
  });
});

describe('schema — coordenadas de la sede (§3.1)', () => {
  const conGeo = (geo: { lat: number; lng: number } | null) => {
    const v = valido();
    return {
      ...v,
      modalidades: [{ ...v.modalidades[0]!, sede: { ...v.modalidades[0]!.sede!, geo } }],
    };
  };

  it('acepta la sede sin coordenadas: el campo es opcional', () => {
    expect(errores(conGeo(null))).toEqual([]);
  });

  it('acepta un punto válido', () => {
    expect(errores(conGeo({ lat: -34.5989, lng: -58.4392 }))).toEqual([]);
  });

  it('rechaza una latitud que no existe, también en borrador', () => {
    expect(errores(conGeo({ lat: 200, lng: -58.4392 }))).toContain('modalidades.0.sede.geo.lat');
  });

  it('rechaza una longitud que no existe, también en borrador', () => {
    expect(errores(conGeo({ lat: -34.5989, lng: -400 }))).toContain('modalidades.0.sede.geo.lng');
  });
});

describe('schema — no publicar con el slug de una copia (trampa 10)', () => {
  /**
   * Una copia recién hecha, tal como la deja `duplicarActividadForm`: **la marca
   * está en el título y en el slug a la vez**, porque la escriben juntas
   * `tituloCopia` y `slugCopia`. Es el par lo que el schema lee (B-91), así que
   * el fixture tiene que traer los dos o el test mediría otra cosa.
   */
  const copiaRecienHecha = (slug: string) => ({
    ...valido(),
    estado: 'publicado' as const,
    titulo: 'Taller de crónica urbana (copia)',
    slug,
  });

  it('rechaza publicar con un slug que termina en -copia', () => {
    expect(errores(copiaRecienHecha('taller-cronica-urbana-copia'))).toContain('slug');
  });

  it('rechaza también los sufijos numerados', () => {
    expect(errores(copiaRecienHecha('taller-cronica-urbana-copia-3'))).toContain('slug');
  });

  it('deja GUARDAR un borrador con ese slug', () => {
    // La copia nace como borrador con `-copia` a propósito: el bloqueo es solo
    // al publicar, para no romper el flujo de duplicar.
    const v = { ...copiaRecienHecha('taller-cronica-urbana-copia'), estado: 'borrador' as const };
    expect(errores(v)).toEqual([]);
  });

  it('deja publicar en cuanto se corrige el slug', () => {
    expect(errores(copiaRecienHecha('taller-cronica-urbana-2027'))).toEqual([]);
  });

  it('no confunde un slug que solo contiene la palabra copia', () => {
    // "copiando-a-borges" no es una copia: la regla es sobre el sufijo.
    const v = { ...valido(), estado: 'publicado' as const, slug: 'copia-de-seguridad-taller' };
    expect(errores(v)).toEqual([]);
  });

  /**
   * B-91 — el falso positivo que este ítem reportaba: un título legítimo que
   * termina en esa palabra deriva en un slug `…-copia` y quedaba **imposible de
   * publicar**, con un mensaje que hablaba de un sufijo que nadie puso.
   *
   * Lo que distingue los dos casos es la marca `(copia)` del título, que
   * `duplicar` escribe junto con la del slug: acá no está, porque nadie duplicó
   * nada.
   */
  it('deja publicar un título legítimo que termina en «copia» (B-91)', () => {
    const v = {
      ...valido(),
      estado: 'publicado' as const,
      titulo: 'Taller de copia',
      slug: 'taller-de-copia',
    };
    expect(errores(v)).toEqual([]);
  });

  it('y tampoco frena su segunda edición, con el slug numerado (B-91)', () => {
    // `taller-de-copia` ya estaba tomado, así que el slug legítimo es `-copia-2`
    // — la forma exacta que el regex del sufijo numerado reconoce.
    const v = {
      ...valido(),
      estado: 'publicado' as const,
      titulo: 'El arte de la copia',
      slug: 'el-arte-de-la-copia-2',
    };
    expect(errores(v)).toEqual([]);
  });

  it('el título marcado solo, sin slug de copia, no frena nada (B-91)', () => {
    // El slug ya se corrigió: lo que queda es un título con «(copia)», que es
    // texto y se puede editar después de publicar. No es irreversible, así que
    // no bloquea.
    const v = { ...copiaRecienHecha('taller-cronica-urbana-2027') };
    expect(errores(v)).toEqual([]);
  });
});

describe('faltaParaPublicar — el aviso que no bloquea', () => {
  const rutas = (v: unknown) => faltaParaPublicar(v).map((i) => i.path.join('.'));

  it('sobre un borrador válido dice lo que le va a faltar al publicar', () => {
    const v = { ...valido(), arancel: { tipo: '', notas: '' }, descripcion: '' };
    expect(actividadFormSchema.safeParse(v).success).toBe(true);
    expect(rutas(v)).toEqual(expect.arrayContaining(['arancel.tipo', 'descripcion']));
  });

  it('no devuelve nada cuando la actividad ya está lista para publicar', () => {
    expect(faltaParaPublicar(valido())).toEqual([]);
  });

  it('cada faltante viene con su mensaje, para poder nombrarlo', () => {
    const faltantes = faltaParaPublicar({ ...valido(), arancel: { tipo: '', notas: '' } });
    expect(faltantes[0]).toMatchObject({ path: ['arancel', 'tipo'], message: 'Elegí el arancel' });
  });

  it('no toca el formulario que recibe: el estado sigue siendo borrador', () => {
    const v = valido();
    faltaParaPublicar(v);
    expect(v.estado).toBe('borrador');
  });

  it('no explota con algo que no es un formulario', () => {
    expect(faltaParaPublicar(null).length).toBeGreaterThan(0);
  });
});

describe('schema — el monto del arancel (B-114)', () => {
  /**
   * La regla es de dos campos y por eso vive en el `superRefine`: **un arancel
   * que no se paga no lleva monto.** Va en el schema y no solo en el formulario
   * porque el formulario no es la única puerta —también entra por «Duplicar» y
   * por «Restaurar» del historial— y un «Gratis · $8.000» sale al `offers` del
   * JSON-LD, o sea a un formato que las máquinas creen.
   */
  const conArancel = (tipo: string, monto: number | null) => ({
    ...valido(),
    arancel: { tipo, notas: '', monto },
  });

  it('un arancelado con monto entero pasa', () => {
    expect(errores(conArancel('arancelado', 15000))).toEqual([]);
  });

  it('un arancelado sin monto pasa: el campo es opcional', () => {
    // Es el caso de la mayoría, y el motivo por el que el JSON-LD sigue teniendo
    // una rama sin precio: `arancel.tipo` es lo esencial.
    expect(errores(conArancel('arancelado', null))).toEqual([]);
  });

  it('«gratis» y «a la gorra» con monto se rechazan, y el mensaje dice qué hacer', () => {
    /*
     * MUTACIÓN PROBADA: sacar el bloque del `superRefine` deja los dos casos en
     * verde y publica «Gratis · $8.000».
     */
    for (const tipo of ['gratis', 'a-la-gorra']) {
      expect(errores(conArancel(tipo, 8000)), tipo).toEqual(['arancel.monto']);
      expect(mensajes(conArancel(tipo, 8000))['arancel.monto']).toMatch(
        /no se paga no lleva monto/,
      );
    }
    // Y sin monto los dos siguen pasando: la regla es sobre el par, no sobre el tipo.
    expect(errores(conArancel('gratis', null))).toEqual([]);
    expect(errores(conArancel('a-la-gorra', null))).toEqual([]);
  });

  it('un monto que no es un entero positivo se rechaza', () => {
    // Los centavos no existen en este dominio y un negativo no es un precio. El
    // `0` tampoco: para eso está el arancel «Gratis».
    expect(errores(conArancel('arancelado', 0))).toEqual(['arancel.monto']);
    expect(errores(conArancel('arancelado', -100))).toEqual(['arancel.monto']);
    expect(errores(conArancel('arancelado', 1500.5))).toEqual(['arancel.monto']);
  });

  it('el default es `null` y no cero: «no cargué el monto» no es «cuesta cero»', () => {
    /*
     * El fixture `valido()` **no tiene la clave**, que es a propósito: es la forma
     * de un formulario anterior a B-114 y de cualquier documento en producción
     * hoy. Lo que se afirma es que el schema lo completa con `null` y no con `0`
     * —«no cargué el monto» y «cuesta cero» son cosas distintas, y la segunda no
     * existe en este modelo: para eso está el arancel «Gratis»—.
     */
    const r = actividadFormSchema.safeParse(valido());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.arancel.monto).toBeNull();
      expect(r.data.arancel.monto).not.toBe(0);
    }
  });
});

describe('schema — las opciones para sumarse (B-181)', () => {
  /**
   * Las tres reglas son de **coherencia entre dos campos hermanos**
   * (`comisiones` y `sesiones`), y por eso viven en el `superRefine` de la
   * actividad y no en el schema de la fila: es el único nivel que ve los dos.
   *
   * Van en el nivel «publicar» como el resto de la completitud: una opción a
   * medio crear no puede bloquear el guardado de un borrador, porque nace vacía
   * cuando se aprieta «+ Agregar opción».
   */
  const MARTES = { id: 'com_martes', etiqueta: 'Martes 19 h' };
  const JUEVES = { id: 'com_jueves', etiqueta: 'Jueves 19 h' };

  const conComisiones = (
    comisiones: { id: string; etiqueta: string }[],
    idsDeSesion: (string | null)[],
  ) => ({
    ...publicado(),
    esCiclo: true,
    comisiones,
    sesiones: idsDeSesion.map((comisionId, i) => ({
      ...sesionVacia(),
      inicio: `2026-09-0${i + 1}T19:00`,
      fin: `2026-09-0${i + 1}T21:00`,
      comisionId,
    })),
  });

  it('sin opciones, un ciclo normal pasa igual que siempre', () => {
    expect(errores(conComisiones([], [null, null]))).toEqual([]);
  });

  it('dos opciones con sus encuentros repartidos pasan', () => {
    expect(errores(conComisiones([MARTES, JUEVES], [MARTES.id, JUEVES.id]))).toEqual([]);
  });

  describe('1 · la opción necesita nombre', () => {
    /**
     * Es lo único que se lee de una opción: sin ella el título del evento diría
     * «Club de Saer — » y el desplegable del formulario mostraría una fila en
     * blanco imposible de elegir a conciencia.
     */
    it('una opción sin etiqueta se rechaza al publicar, con el índice de la fila', () => {
      /*
       * MUTACIÓN PROBADA: sacando el bloque 1 del `superRefine`, este caso queda
       * en verde y publica una opción sin nombre.
       */
      // Dos encuentros: con uno solo y `esCiclo` salta además «un ciclo tiene
      // más de un encuentro», que es otra regla y ensucia la aserción.
      const r = conComisiones([{ id: MARTES.id, etiqueta: '   ' }], [MARTES.id, MARTES.id]);
      expect(errores(r)).toEqual(['comisiones.0.etiqueta']);
      expect(mensajes(r)['comisiones.0.etiqueta']).toMatch(/Ponele nombre/);
    });

    it('en borrador no molesta: la opción nace vacía cuando se la agrega', () => {
      const borrador = {
        ...conComisiones([{ id: MARTES.id, etiqueta: '' }], [MARTES.id, MARTES.id]),
        estado: 'borrador' as const,
      };
      expect(errores(borrador)).toEqual([]);
    });
  });

  describe('2 · dos opciones no pueden llamarse igual', () => {
    /**
     * Ninguna salida muestra el id: el título del evento, el desplegable del
     * panel y la página pública muestran el texto. Dos «Martes 19 h» son dos
     * grupos que nadie puede distinguir.
     *
     * No es un `slugify` (§4.2): esto no es una taxonomía que se reuse entre
     * actividades, así que no hay nada que curar. Se compara normalizado nada más
     * para que el espacio y la mayúscula no cuelen un duplicado.
     */
    it('se rechaza la segunda, y el acento del caso es que difieran solo en espacios y mayúsculas', () => {
      /*
       * MUTACIÓN PROBADA: sin el bloque 2, esto queda en verde y el panel muestra
       * dos filas idénticas en el desplegable de cada encuentro.
       */
      const r = conComisiones(
        [MARTES, { id: JUEVES.id, etiqueta: '  martes 19 H ' }],
        [MARTES.id, JUEVES.id],
      );
      expect(errores(r)).toEqual(['comisiones.1.etiqueta']);
      expect(mensajes(r)['comisiones.1.etiqueta']).toMatch(/Ya hay otra opción/);
    });

    it('dos opciones sin nombre no se cuentan como duplicadas entre sí', () => {
      // Si no, agregar dos filas de una vez daría el error equivocado: el que
      // corresponde es «ponele nombre», uno por fila, y son los dos que salen.
      const r = conComisiones(
        [
          { id: MARTES.id, etiqueta: '' },
          { id: JUEVES.id, etiqueta: '' },
        ],
        [MARTES.id, JUEVES.id],
      );
      expect(errores(r)).toEqual(['comisiones.0.etiqueta', 'comisiones.1.etiqueta']);
    });
  });

  describe('3 · integridad referencial, en los dos sentidos', () => {
    it('un encuentro que apunta a una opción que no existe se rechaza', () => {
      /*
       * MUTACIÓN PROBADA: sin la primera mitad del bloque 3, esto queda verde y
       * el documento sale con un encuentro colgado — que el panel no sabe dónde
       * mostrar y que el evento numeraría contra un conjunto que no es el suyo.
       */
      const r = conComisiones([MARTES], [MARTES.id, 'com_borrada']);
      expect(errores(r)).toEqual(['sesiones.1.comisionId']);
      expect(mensajes(r)['sesiones.1.comisionId']).toMatch(/una opción que ya no existe/);
    });

    it('con opciones, un encuentro sin ninguna se rechaza', () => {
      /*
       * Es la mitad que hace legible la lista: un ciclo mitad con opciones y
       * mitad sin ellas multiplica dos dimensiones, que es justo el malentendido
       * que el ítem vino a arreglar.
       *
       * MUTACIÓN PROBADA: sin la segunda mitad del bloque 3, queda verde.
       */
      const r = conComisiones([MARTES], [MARTES.id, null]);
      expect(errores(r)).toEqual(['sesiones.1.comisionId']);
      expect(mensajes(r)['sesiones.1.comisionId']).toMatch(/Elegí de qué opción/);
    });

    it('sin opciones, un encuentro sin opción es lo normal y no se rechaza', () => {
      // La vuelta que hace que el campo sea aditivo: todas las actividades de
      // hoy están en este caso.
      expect(errores(conComisiones([], [null, null]))).toEqual([]);
    });

    it('el id de una opción tiene que venir de `nuevaComisionId` (trampa 2)', () => {
      // Como los de sesión y los de modalidad: en los dos niveles, porque un id
      // por índice haría que borrar una opción reapunte los encuentros de otra.
      const r = {
        ...conComisiones([{ id: '1', etiqueta: 'Martes' }], ['1', '1']),
        estado: 'borrador' as const,
      };
      expect(errores(r)).toContain('comisiones.0.id');
    });
  });
});

describe('la etiqueta de una opción no puede llevar un link (B-181)', () => {
  /**
   * Lo cobró el `auditor-privacidad`, y el argumento es de **probabilidad**, no
   * de forma: la etiqueta es texto libre como el `tema`, pero su contenido
   * natural es «cómo se cursa este grupo» —el ejemplo del propio campo incluye
   * «Turno virtual»— y el bloque «Otras opciones» del evento invita a describir
   * la modalidad de cada uno. Es el campo del modelo con más chances de recibir
   * el link de la reunión, y su destino incluye el `<h3>` de la página indexada,
   * donde D-139 dice que ese link no va nunca.
   */
  const conEtiqueta = (etiqueta: string) => ({
    ...publicado(),
    esCiclo: true,
    comisiones: [{ id: 'com_1', etiqueta }],
    sesiones: [
      { ...sesionVacia(), inicio: '2026-09-01T19:00', fin: '2026-09-01T21:00', comisionId: 'com_1' },
      { ...sesionVacia(), inicio: '2026-09-08T19:00', fin: '2026-09-08T21:00', comisionId: 'com_1' },
    ],
  });

  it('con un link de reunión no se publica, y el mensaje dice qué va en el campo', () => {
    /*
     * MUTACIÓN PROBADA: sacando la guarda del `superRefine`, esto queda en verde y
     * el link sale al título del evento, al `<h3>` de la página y al `subEvent`
     * del JSON-LD.
     */
    const r = conEtiqueta('Turno virtual https://meet.google.com/abc-defg-hij');
    expect(errores(r)).toEqual(['comisiones.0.etiqueta']);
    expect(mensajes(r)['comisiones.0.etiqueta']).toMatch(/el link se publica/);
  });

  it('también con http, y sin importar la mayúscula', () => {
    expect(errores(conEtiqueta('HTTP://zoom.us/j/999'))).toEqual(['comisiones.0.etiqueta']);
  });

  it('un nombre normal pasa, aunque nombre la modalidad', () => {
    // La regla es contra el **link**, no contra hablar de la modalidad: «Turno
    // virtual» es exactamente uno de los ejemplos del campo.
    expect(errores(conEtiqueta('Turno virtual'))).toEqual([]);
    expect(errores(conEtiqueta('Martes 19 h'))).toEqual([]);
  });

  it('en borrador no molesta: pegar un link a medio escribir no traba el guardado', () => {
    const borrador = { ...conEtiqueta('https://meet.google.com/abc'), estado: 'borrador' as const };
    expect(errores(borrador)).toEqual([]);
  });
});
