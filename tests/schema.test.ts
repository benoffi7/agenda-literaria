import { describe, expect, it } from 'vitest';
import type { Imagen } from '@/types/actividad';
import { ES_RECHAZO_DE_PRIVACIDAD, actividadFormSchema, faltaParaPublicar } from '@/lib/schema';
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
 * **El esquema de la URL de una imagen corre con página, no al publicar** —
 * B-817, y lo marcó el `auditor-trampas` cerrando B-181 explícitamente como fuera
 * de esa tanda: es el mismo agujero que B-181 acababa de cerrar del otro lado, en
 * el campo de al lado.
 *
 * El chequeo vivía adentro del bloque que arranca con
 * `if (!publicando(v.estado)) return`, así que un guardado a `cancelado` lo
 * salteaba entero — y la cancelada **conserva su página** si estuvo publicada
 * (B-110, §7.3), esa página pinta **todas** sus imágenes en un `<img src>` desde
 * B-296 y la portada en `og:image` (B-107), y entra al sitemap hasta 30 días
 * después de su última edición. El camino es el de B-181: publicar normal, pasar a
 * `cancelado`, y en esa misma edición pisar la URL con un `data:` o un
 * `javascript:`.
 */
describe('el esquema de la URL de una imagen corre con página (B-817)', () => {
  const conImagen = (url: string, estado: string) => ({
    ...valido(),
    estado,
    imagenes: [
      {
        id: 'img_1',
        url,
        epigrafe: '',
        textoAlternativo: '',
        origen: 'externa' as const,
        portada: true,
      },
    ],
  });

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAA', 'http://ejemplo.ar/tapa.jpg'])(
    'una cancelada no se guarda con «%s»: su página lo pinta igual (B-110, B-296)',
    (url) => {
      /*
       * MUTACIÓN PROBADA: volviendo la regla al bloque de `publicando` (que es
       * exactamente el estado anterior a B-817), los tres casos se ponen rojos —
       * el `javascript:` se guarda y llega al `<img src>` y al `og:image` de una
       * página que sigue indexada.
       */
      expect(errores(conImagen(url, 'cancelado'))).toEqual(['imagenes.0.url']);
    },
  );

  it('y el que rechaza es el esquema, no `esUrl`', () => {
    /*
     * `javascript:alert(1)` **es** una URL para `new URL()`, así que
     * `z.string().url()` la acepta: si la regla mudada hubiera sido `esUrl`, en
     * `cancelado` no rechazaría **nada**. Es la mitad de la clasificación de
     * B-817 escrita como aserto: cuál de las dos reglas del campo es la que
     * existe para que un dato no salga.
     *
     * DOS MUTACIONES PROBADAS. Mudando `esUrl` en lugar del esquema, se ponen
     * rojos éste (no hay mensaje) y los tres de arriba, más el caso de la galería
     * que exige https al publicar. Cambiando el **texto** del mensaje, se ponen
     * rojos éste y el de publicar, y los tres de arriba siguen verdes: es lo que
     * ata que mudar de nivel no cambie lo que ve quien carga (B-341).
     */
    expect(mensajes(conImagen('javascript:alert(1)', 'cancelado'))['imagenes.0.url']).toBe(
      'La dirección tiene que empezar con https://',
    );
  });

  it('una cancelada con una URL normal se sigue guardando', () => {
    // Control positivo: sin esto, «cancelado no se guarda nunca» pasaría los
    // casos de arriba igual de verde.
    expect(errores(conImagen('https://ejemplo.ar/tapa.jpg', 'cancelado'))).toEqual([]);
  });

  it('el emulador de Storage sigue siendo la excepción, también en cancelado (§10)', () => {
    expect(errores(conImagen('http://127.0.0.1:9199/v0/b/x/o/img.jpg', 'cancelado'))).toEqual([]);
  });

  it('en borrador no molesta: una URL a medio pegar no traba el guardado (D-120)', () => {
    // La otra mitad de la línea: de un borrador no sale nada, así que la regla no
    // tiene por qué correr ahí. Si corriera, se rompería B-183.
    expect(errores(conImagen('http://ejemplo.ar/tapa.jpg', 'borrador'))).toEqual([]);
    expect(errores(conImagen('ejemplo.ar/tapa.jpg', 'borrador'))).toEqual([]);
  });

  it('la fila sin URL conserva su propio mensaje, también en cancelado', () => {
    /*
     * Una URL vacía no es «un dato que no puede salir», es un dato que no está, y
     * ya lo rechaza el `.min(1)` de la fila en los dos niveles.
     *
     * MUTACIÓN PROBADA: sacando el `img.url &&` de la regla mudada, este caso se
     * pone rojo — los dos rechazos caen en el mismo path y el formulario, que los
     * guarda en un mapa por path, pasa a mostrar el de la mudanza sobre una fila
     * que lo único que tiene es un campo en blanco.
     */
    expect(mensajes(conImagen('', 'cancelado'))['imagenes.0.url']).toBe(
      'Falta la dirección de la imagen',
    );
  });

  it('publicando sigue rechazando, y con el mismo mensaje de siempre', () => {
    // La mudanza no relajó el nivel largo: es el caso de B-341, que es el mensaje
    // que `GaleriaEditor` pinta en la fila.
    const r = conImagen('data:image/png;base64,AAA', 'publicado');
    expect(mensajes(r)['imagenes.0.url']).toBe('La dirección tiene que empezar con https://');
  });
});

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

  /**
   * **Y en `cancelado` tampoco se puede** — lo cobró el `auditor-privacidad` como
   * P1 en su segunda pasada, y el agujero era de alcance: la regla vivía adentro
   * del bloque que arranca con `if (!publicando(v.estado)) return`, así que un
   * guardado a `cancelado` la salteaba entera.
   *
   * Y la cancelada **tiene página** si estuvo publicada (B-110, §7.3) y entra al
   * sitemap hasta 30 días después de su última edición. El camino es corto y
   * verosímil: publicar con «Martes 19 h», cancelar, y editar la etiqueta a
   * «Martes 19 h — se pasa a https://…» para avisar por dónde sigue.
   */
  it('en cancelado tampoco: su página sigue indexada (B-110)', () => {
    /*
     * MUTACIÓN PROBADA: volviendo la regla adentro del bloque de `publicando`,
     * este caso queda en verde y el link llega al `<h3>` de una página indexada.
     */
    const cancelada = {
      ...conEtiqueta('Martes 19 h — se pasa a https://meet.google.com/abc'),
      estado: 'cancelado' as const,
    };
    expect(errores(cancelada)).toContain('comisiones.0.etiqueta');
  });

  describe('mira la dirección, no el `https://`', () => {
    /**
     * Segundo hallazgo de la misma pasada: lo que no puede publicarse es **la
     * dirección**, no el esquema — el `?pwd=` es el dato caro y viaja igual sin
     * `https://`.
     *
     * La guarda es una **lista de hosts conocidos** y no un patrón de dominio
     * genérico, a propósito: un `([a-z0-9-]+\.)+[a-z]{2,}` rechazaría «Sábados
     * 11.30 hs», y una etiqueta que no se puede guardar por tener un punto es peor
     * que el riesgo que evita.
     */
    /*
     * **Una posición por clase de puntuación, y no cinco strings parecidos** — lo
     * cobró la tercera pasada del `auditor-privacidad`: los cinco casos de la
     * primera versión caían todos donde el grupo de borde de la regex se cumplía
     * (tres al inicio, uno por el `//`, uno después de un paréntesis), así que el
     * verde **no decía nada** de las otras posiciones. El test estaba formado como
     * la implementación.
     *
     * `Virtual:meet.google.com/…` es el caso que importa: los dos puntos sin
     * espacio son la forma más natural de tipear este campo, y pasaba.
     */
    it.each([
      'meet.google.com/abc-defg-hij',
      'Virtual:meet.google.com/abc-defg-hij',
      'Martes-meet.google.com/abc',
      '«meet.google.com/abc»',
      '[meet.google.com/abc]',
      'zoom.us/j/8412345678?pwd=aB3',
      'us02web.zoom.us/j/84123',
      '//meet.google.com/abc',
      'Turno virtual (teams.microsoft.com/l/meetup-join/x)',
      'Turno virtual, entrás por teams.live.com/meet/x',
      'https://algo-que-la-lista-no-conoce.example/x',
    ])('rechaza «%s»', (etiqueta) => {
      /*
       * MUTACIÓN PROBADA (dos): con la guarda vieja (`/https?:\/\//i` solo) pasan
       * los nueve sin esquema; con el grupo de borde puesto, pasan los cuatro de
       * puntuación pegada.
       */
      expect(errores(conEtiqueta(etiqueta))).toEqual(['comisiones.0.etiqueta']);
    });

    it.each([
      'Martes 19 h',
      'Sábados 11.30 hs',
      'Comisión A.M.',
      'Turno virtual',
      'Comisión 2 · tarde',
      // El `//` como separador tipográfico: la primera versión de la guarda lo
      // rechazaba con el mensaje del link, que no explicaba nada. Lo cobró el
      // `auditor-privacidad` como falso positivo real, y un `//meet.google.com`
      // lo agarra igual la lista de hosts.
      'Martes // Jueves 19 h',
    ])('deja pasar «%s», que es un nombre y no una dirección', (etiqueta) => {
      // La otra mitad, y la que hace usable la guarda: los falsos positivos de un
      // patrón de dominio genérico caen todos acá.
      expect(errores(conEtiqueta(etiqueta))).toEqual([]);
    });

    /**
     * **Lo que la guarda NO agarra, dicho acá y no en un comentario.** Un host de
     * reunión que no está en la lista y viene sin esquema pasa, y eso es el
     * costo aceptado de no usar un patrón de dominio genérico (que rechazaría
     * «Sábados 11.30 hs»).
     *
     * Está como test y no como nota para que el día que alguien amplíe la lista lo
     * vea, y para que la ayuda del panel no prometa más de lo que hay: dice «un
     * link de Meet, Zoom, Teams o Jitsi», que es exactamente esto.
     */
    it('un host de reunión fuera de la lista y sin esquema pasa: es el costo aceptado', () => {
      expect(errores(conEtiqueta('bbb.miuni.edu.ar/b/abc-def'))).toEqual([]);
      // Con esquema, en cambio, no pasa ninguno.
      expect(errores(conEtiqueta('https://bbb.miuni.edu.ar/b/abc-def'))).toEqual([
        'comisiones.0.etiqueta',
      ]);
    });
  });
});

/**
 * **Dos filas de la misma lista no pueden compartir id** — B-816, y lo marcó el
 * `auditor-privacidad` cerrando B-181 como «no es de esta tanda». Vale para
 * `sesiones[].id` desde que existe el modelo, y para `imagenes`, `modalidades`,
 * `material.items` y `comisiones`.
 *
 * El schema validaba el **prefijo** y nada más, así que dos filas con el mismo id
 * eran un documento válido — y el id es la llave con la que **todo** resuelve por
 * fila: `comisionDe` hace un `.find` (gana la primera) contra un `Map` de
 * etiquetas (donde gana la última), así que el evento de Calendar puede decir
 * «Martes» y la página «Jueves» para el mismo encuentro; el diff del §7.2 pierde
 * una sesión; y la página escribe dos `<li id="ses_…">` iguales.
 *
 * **Es la única invariante de la trampa 2 que no estaba verificada.** La fábrica
 * de ids tiene tests en las cinco listas; que dos filas no compartan id no lo
 * afirmaba nadie, y es la mitad de la que depende todo el resto.
 *
 * Los cinco casos son **la misma clase en las cinco listas** y no cinco tests
 * parecidos: la tabla se recorre entera, así que la lista que nazca mañana con su
 * id de cliente entra agregando una fila acá y no un `describe` nuevo.
 */
describe('dos filas de la misma lista no pueden compartir id (B-816, trampa 2)', () => {
  const imagen = (id: string, portada: boolean) => ({
    id,
    url: 'https://ejemplo.ar/tapa.jpg',
    epigrafe: '',
    textoAlternativo: '',
    origen: 'externa' as const,
    portada,
  });

  const modalidad = (id: string) => ({
    id,
    modalidad: 'virtual' as const,
    inicio: '',
    fin: '',
    sede: null,
    online: { plataforma: 'meet', url: '', urlPublica: false },
  });

  const material = (id: string, titulo: string) => ({
    id,
    tipo: 'lectura' as const,
    titulo,
    url: '',
    entrega: 'previo' as const,
    publico: false,
  });

  /** Las cinco listas con id de cliente, cada una con dos filas parametrizadas. */
  const listas = [
    {
      lista: 'sesiones',
      ids: ['ses_1', 'ses_2'],
      mensaje: 'El id de sesión debe venir de nuevaSesionId()',
      con: (a: string, b: string) => ({
        ...valido(),
        sesiones: [
          { ...sesionVacia(), id: a, inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' },
          { ...sesionVacia(), id: b, inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' },
        ],
      }),
      path: (n: number) => `sesiones.${n}.id`,
    },
    {
      lista: 'imagenes',
      ids: ['img_1', 'img_2'],
      mensaje: 'El id de imagen debe venir de nuevaImagenId()',
      con: (a: string, b: string) => ({
        ...valido(),
        imagenes: [imagen(a, true), imagen(b, false)],
      }),
      path: (n: number) => `imagenes.${n}.id`,
    },
    {
      lista: 'modalidades',
      ids: ['mod_1', 'mod_2'],
      mensaje: 'El id de modalidad debe venir de nuevaModalidadId()',
      con: (a: string, b: string) => ({
        ...valido(),
        modalidades: [modalidad(a), modalidad(b)],
      }),
      path: (n: number) => `modalidades.${n}.id`,
    },
    {
      lista: 'material.items',
      ids: ['mat_1', 'mat_2'],
      mensaje: 'El id de material debe venir de nuevaItemMaterialId()',
      con: (a: string, b: string) => ({
        ...valido(),
        material: { tiene: true, items: [material(a, 'Cap. 1'), material(b, 'Cap. 2')] },
      }),
      path: (n: number) => `material.items.${n}.id`,
    },
    {
      lista: 'comisiones',
      ids: ['com_1', 'com_2'],
      mensaje: 'El id de opción debe venir de nuevaComisionId()',
      con: (a: string, b: string) => ({
        ...valido(),
        comisiones: [
          { id: a, etiqueta: 'Martes 19 h' },
          { id: b, etiqueta: 'Jueves 19 h' },
        ],
      }),
      path: (n: number) => `comisiones.${n}.id`,
    },
  ];

  it.each(listas)('$lista — dos filas con el mismo id no se guardan', (caso) => {
    /*
     * MUTACIÓN PROBADA: sacando la llamada a `idsRepetidos` de una lista, se ponen
     * rojos los dos casos de **esa** lista y ninguno de las otras cuatro — o sea
     * que las cinco están atadas de verdad y no por una que las tape. Sacando las
     * cinco llamadas, se pone rojo el `describe` entero.
     */
    const [a] = caso.ids;
    expect(errores(caso.con(a, a))).toEqual([caso.path(1)]);
  });

  it.each(listas)('$lista — con ids distintos se guarda', (caso) => {
    // Control positivo, y no es formalidad: sin él, un fixture que no valide por
    // cualquier otro motivo haría pasar el caso de arriba sin que la regla exista.
    const [a, b] = caso.ids;
    expect(errores(caso.con(a, b))).toEqual([]);
  });

  it.each(listas)('$lista — el rechazo cae en la fila repetida, no en la lista', (caso) => {
    /*
     * DOS MUTACIONES PROBADAS. Apuntando el issue a la lista (`['sesiones']`) en
     * vez de a la fila, se pone rojo el `describe` entero: importa porque es el
     * path con el que el editor de filas pinta el error al lado del control
     * (B-341, B-343), y en la lista el mensaje sale en la barra de abajo sin decir
     * cuál fila. Y pasándole a una lista un mensaje propio («Hay dos filas con el
     * mismo id»), se ponen rojos el caso de esa lista y el derivado de más abajo.
     */
    const [a] = caso.ids;
    expect(mensajes(caso.con(a, a))).toEqual({ [caso.path(1)]: caso.mensaje });
  });

  it('bloquea también en un borrador: no es completitud, es un documento ilegible', () => {
    /*
     * Los dos niveles, como el prefijo y por el mismo motivo (B-183). Los fixtures
     * de arriba son borradores, así que ellos fijan la mitad de abajo; éste fija
     * la de arriba, que es la que se rompería si alguien acotara la regla al nivel
     * corto «porque total es un borrador roto».
     *
     * MUTACIÓN PROBADA: gateando la llamada de `sesiones` con
     * `if (!publicando(v.estado))`, este caso se pone rojo y **ningún otro**.
     */
    const dosIguales = {
      ...publicado(),
      sesiones: [
        { ...sesionVacia(), id: 'ses_1', inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' },
        { ...sesionVacia(), id: 'ses_1', inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' },
      ],
    };
    expect(errores(dosIguales)).toContain('sesiones.1.id');
  });

  it('el mensaje del repetido es el del prefijo: la falla es la misma', () => {
    /*
     * Se **deriva** uno del otro en vez de copiar el literal. Los dos rechazos son
     * la misma falla vista de dos lados —el id no salió de su fábrica—, y desde la
     * UI ninguno de los dos se puede producir: los cinco ids salen de
     * `crypto.randomUUID()`, así que a los dos se llega editando a mano o por un
     * bug en la fábrica, que es lo que la trampa 2 vigila.
     *
     * DOS MUTACIONES PROBADAS. Escribiendo el mensaje del repetido como un literal
     * distinto («Hay dos filas con el mismo id»), este caso se pone rojo — que es
     * lo que evita que un renombre de `nuevaSesionId()` corrija uno de los dos
     * lugares y deje al otro mintiendo. Y sacando la regla de prefijo de
     * `sesiones`, también: el `toBeTruthy` es el control positivo que distingue
     * «los dos mensajes coinciden» de «los dos son `undefined`».
     */
    const delPrefijo = mensajes({
      ...valido(),
      sesiones: [{ ...sesionVacia(), id: 'no-tiene-prefijo' }],
    })['sesiones.0.id'];
    const delRepetido = mensajes({
      ...valido(),
      sesiones: [
        { ...sesionVacia(), id: 'ses_1', inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' },
        { ...sesionVacia(), id: 'ses_1', inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' },
      ],
    })['sesiones.1.id'];

    expect(delPrefijo).toBeTruthy();
    expect(delRepetido).toBe(delPrefijo);
  });

  it('tres filas con el mismo id rechazan las dos repetidas, no la primera', () => {
    /*
     * El rechazo nombra las filas que **sobran**, una por una.
     *
     * MUTACIÓN PROBADA: con la forma que proponía el ítem —un
     * `new Set(ids).size !== ids.length` que marca la lista una sola vez— este
     * caso se pone rojo y ningún otro. Es la diferencia que se eligió: con tres
     * repetidas hay que borrar dos filas, y una marca sola no dice cuáles.
     */
    const tres = {
      ...valido(),
      comisiones: [
        { id: 'com_1', etiqueta: 'Martes' },
        { id: 'com_1', etiqueta: 'Jueves' },
        { id: 'com_1', etiqueta: 'Sábados' },
      ],
    };
    expect(errores(tres)).toEqual(['comisiones.1.id', 'comisiones.2.id']);
  });
});

/**
 * **Que una regla de privacidad nueva entre sola a `MENSAJES_DE_PRIVACIDAD`** —
 * B-818, y lo cobró el `auditor-privacidad` sobre la primera versión de esa lista.
 *
 * La lista existe porque `issuesDeRestauracion` (`@/lib/historial`) enmascara los
 * rechazos que ya estaban —correcto para la completitud, incorrecto para las reglas
 * que existen para que un dato no salga—. Y estaba colgada de la memoria: su
 * docblock decía que «la regla que se agregue mañana … la que la escriba decide en
 * una línea», y **nada se lo preguntaba**. Una regla nueva bajo
 * `if (tienePagina(v.estado))` con un mensaje literal quedaba afuera, la resta la
 * enmascaraba, y la suite seguía verde.
 *
 * El marcador mecánico ya lo había definido el propio schema: **una regla que
 * existe para que un dato no salga corre con `tienePagina`** y no con el nivel de
 * publicar. Así que la lista se deriva del **comportamiento** y no de una lista
 * paralela: los mensajes que aparecen en `cancelado` y no en `borrador` son
 * exactamente las reglas gateadas por `tienePagina`, porque `cancelado` tiene
 * página y no pasa por el nivel largo.
 *
 * Es el patrón que este repo ya usa con las claves derivadas de `firestore.rules`.
 */
describe('las reglas que solo corren con página están declaradas (B-818, §5.1)', () => {
  /**
   * Un documento con todo lo que las reglas «de página» pueden rechazar.
   *
   * **La imagen la agregó B-817**, y no es decorativa: el barrido solo puede ver
   * las reglas que este documento dispara, así que una regla nueva que ningún
   * fixture viole entraría igual de silenciosa que antes. Con la fila acá, el día
   * que alguien mude otra regla a `tienePagina` sin declararla, este caso la
   * nombra.
   */
  const conViolaciones = (estado: string) => ({
    ...valido(),
    estado,
    esCiclo: true,
    comisiones: [{ id: 'com_1', etiqueta: 'Martes — https://meet.google.com/abc' }],
    sesiones: [{ ...sesionVacia(), comisionId: 'com_1' }],
    imagenes: [
      {
        id: 'img_1',
        url: 'javascript:alert(1)',
        epigrafe: '',
        textoAlternativo: '',
        origen: 'externa' as const,
        portada: true,
      },
    ],
  });

  const mensajesEn = (estado: string): Set<string> => {
    const r = actividadFormSchema.safeParse(conViolaciones(estado));
    return new Set(r.success ? [] : r.error.issues.map((i) => i.message));
  };

  it('toda regla gateada por `tienePagina` está en `ES_RECHAZO_DE_PRIVACIDAD`', () => {
    /*
     * MUTACIÓN PROBADA: vaciando `MENSAJES_DE_PRIVACIDAD`, este caso falla
     * nombrando el mensaje que quedó sin declarar.
     */
    const enBorrador = mensajesEn('borrador');
    const soloConPagina = [...mensajesEn('cancelado')].filter((m) => !enBorrador.has(m));

    // Que el derivado encontró algo: con cero, la aserción de abajo pasaría sola.
    expect(soloConPagina.length).toBeGreaterThan(0);

    for (const mensaje of soloConPagina) {
      expect(
        ES_RECHAZO_DE_PRIVACIDAD.includes(mensaje),
        `«${mensaje}» solo corre cuando la actividad tiene página, así que es una regla ` +
          'de privacidad, y no está en MENSAJES_DE_PRIVACIDAD: la resta de ' +
          '`issuesDeRestauracion` la va a enmascarar',
      ).toBe(true);
    }
  });
});
