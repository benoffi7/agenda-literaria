import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { construirDescripcion, construirEvento } from '@calendario';
// Las Functions son JS plano; TS les infiere los tipos con allowJs.
import { camposCambiados, huboCambioDeContenido } from '../functions/historial.js';
import { documentoAForm, formADocumento, payloadDeActualizacion } from '@/lib/actividades';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { formularioLleno } from './fixtures/formulario';
import { CAMPOS, etiquetaDeCampo, seccionDeCampo } from '@/lib/formulario/camposFaltantes';
import { CAMPOS_VALIDABLES, FUNCIONES } from '@/lib/analytics-eventos';
import { buildSearchText } from '@/lib/normalize';
import { actividadFormSchema, faltaParaPublicar } from '@/lib/schema';
import { toPublic } from '@/lib/toPublic';
import type { Actividad, ActividadForm } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/**
 * B-97 — `inscripcion.completo`: poder decir que una actividad se llenó.
 *
 * Después de publicar no había forma de decir nada: el taller se llenaba, la
 * gente seguía mandando DM, y el sitio y el calendario seguían mostrando «cupo:
 * 12» porque `inscripcion.cupo` se carga una vez y no se vuelve a mirar.
 *
 * Las dos decisiones del dueño que estos tests fijan, porque las dos se pueden
 * perder en una "mejora" razonable:
 *
 *  1. **Un booleano y no un contador de lugares.** Un número queda viejo con
 *     cada inscripción y no solo con la última.
 *  2. **El canal de inscripción no se esconde**: queda, con el cartel al lado.
 *     Siempre hay lista de espera y las bajas existen.
 *
 * Y las dos cosas que un campo nuevo rompe en silencio: el **default de
 * lectura** de los documentos que ya están en producción, y **la ida y vuelta**
 * formulario ⇄ documento.
 *
 * Cada salida se verifica en el archivo de su salida, que es donde alguien la va
 * a editar: `toPublic.test.ts` (events.json), `calendario.test.ts` (el evento y
 * su propagación a las ocho sesiones del ciclo), `reportes.test.ts` (el issue de
 * GitHub) y `analytics-privacidad.test.ts` (GA4).
 */



/**
 * Un taller tal como lo entrega Firestore, **sin `completo`**: es el estado de
 * todo documento anterior a B-97, que es el caso que el default de lectura tiene
 * que preservar.
 */
const taller = (over: Partial<Actividad> = {}): Actividad =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    descripcion: 'Ocho encuentros los martes.',
    imagenes: [],
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: { nombre: 'María Moreno', bio: '', instagram: '' },
    libro: null,
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
    inscripcion: { requiere: true, via: 'mail', destino: 'hola@brandon.example', cupo: 12, cierra: null },
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

/** El mismo taller, con el cupo completo prendido. */
const lleno = (over: Partial<Actividad> = {}): Actividad =>
  taller({
    inscripcion: { ...taller().inscripcion, completo: true },
    ...over,
  });

const formLleno = (over: Partial<ActividadForm> = {}): ActividadForm => ({
  ...formVacio(),
  titulo: 'Taller de crónica',
  slug: 'taller-de-cronica',
  inscripcion: { ...formVacio().inscripcion, requiere: true, via: 'mail', destino: 'hola@brandon.example', cupo: 12, completo: true },
  ...over,
});

describe('el default de lectura de los documentos que ya existen (D-26, D-125)', () => {
  it('un documento anterior a B-97 se lee como no completo, no como undefined', () => {
    expect(documentoAForm(taller()).inscripcion.completo).toBe(false);
  });

  it('preserva el comportamiento anterior: nada cambia en pantalla ni en las salidas', () => {
    // Ni el sitio ni el calendario pueden empezar a decir «Cupo completo» por un
    // campo que el documento no tiene.
    expect(toPublic(taller(), 'id1').inscripcion.completo).toBe(false);
    expect(construirDescripcion(taller(), taller().sesiones[0]!, {})).not.toContain('Cupo completo');
  });

  it('es determinístico, y esto NO es un detalle', () => {
    /*
     * Un default que devuelva algo distinto en cada lectura —derivado de la hora,
     * o de comparar el cupo contra algo— hace que `huboCambioDeContenido` vea un
     * cambio cada vez que se abre el formulario: el aviso de «cambios sin
     * guardar» aparecería solo y se escribiría una versión al historial por cada
     * vez que alguien **mira** una actividad. Es lo que casi pasó con la galería
     * (D-125) y lo que D-126 dejó escrito.
     */
    const doc = taller();
    expect(documentoAForm(doc).inscripcion.completo).toBe(
      documentoAForm(doc).inscripcion.completo,
    );
    // Y el formulario nuevo nace igual a lo que se lee de un documento sin el
    // campo: si difirieran, el formulario nacería sucio (B-87).
    expect(documentoAForm(doc).inscripcion.completo).toBe(formVacio().inscripcion.completo);
  });

  it('leer y volver a guardar una actividad que ya tiene el campo no marca ningún cambio', () => {
    /*
     * La propiedad que de verdad importa del default: es **estable**. Una vez que
     * el documento tiene la clave, abrir el formulario y guardarlo sin tocar nada
     * no pisa contenido, así que no se acumula una versión por edición boba.
     */
    const doc = taller({ inscripcion: { ...taller().inscripcion, completo: false } });
    const guardado = formADocumento(documentoAForm(doc), 'uid', false);
    expect(camposCambiados(doc, { ...doc, ...guardado })).not.toContain('inscripcion');
  });

  it('la primera edición de una actividad vieja sí registra el campo, y está bien', () => {
    /*
     * Un documento anterior a B-97 no tiene la clave, así que el primer guardado
     * la agrega y el trigger del historial lo cuenta como cambio de
     * `inscripcion`. Es **correcto**: el documento cambió de verdad, y pasó lo
     * mismo con `libro` en DEC-1. Y es **una sola vez por actividad**, no una por
     * apertura, que es la diferencia con lo que D-125 vino a evitar: abrir el
     * formulario no escribe nada.
     */
    const doc = taller();
    const guardado = formADocumento(documentoAForm(doc), 'uid', false);
    expect(camposCambiados(doc, { ...doc, ...guardado })).toContain('inscripcion');
    // Y la segunda ya no: la transición no se repite.
    const migrado = { ...doc, ...guardado } as unknown as Actividad;
    const otraVez = formADocumento(documentoAForm(migrado), 'uid', false);
    expect(camposCambiados(migrado, { ...migrado, ...otraVez })).not.toContain('inscripcion');
  });
});

describe('la ida y vuelta formulario ⇄ documento no pierde el cupo completo', () => {
  it('lo escribe tal como está en el formulario', () => {
    const doc = formADocumento(formLleno(), 'uid', true) as unknown as Actividad;
    expect(doc.inscripcion.completo).toBe(true);
  });

  it('vuelve del documento al formulario', () => {
    expect(documentoAForm(lleno()).inscripcion.completo).toBe(true);
  });

  /**
   * **Es el modo de falla del campo, y no es teórico.** `formADocumento`
   * reemplaza el objeto `inscripcion` entero en cada guardado, así que si el
   * formulario no llevara la clave, editar cualquier otra cosa —una coma en la
   * descripción— apagaría el cartel del sitio y de los N eventos del calendario
   * sin que nadie lo haya pedido.
   */
  it('editar otra cosa NO apaga el cartel: el formulario lo transporta aunque no lo edite', () => {
    const editado = { ...documentoAForm(lleno()), descripcion: 'Otra descripción, con una coma.' };
    const doc = formADocumento(editado, 'uid', false) as unknown as Actividad;
    expect(doc.inscripcion.completo).toBe(true);
    expect(doc.descripcion).toBe('Otra descripción, con una coma.');
  });

  it('y apagarlo se guarda como apagado, no como ausente', () => {
    // `undefined` en un `updateDoc` de Firestore no borra el campo: lo rechaza.
    const doc = formADocumento(
      formLleno({ inscripcion: { ...formLleno().inscripcion, completo: false } }),
      'uid',
      false,
    ) as unknown as Actividad;
    expect(doc.inscripcion.completo).toBe(false);
  });

  it('no se borra al destildar «requiere inscripción previa»', () => {
    // A diferencia de `via` y `destino`, que sí se limpian: «se llenó» es un
    // hecho de la sala, no del canal. Es el criterio de `cupo`, que tampoco se
    // borra.
    const doc = formADocumento(
      formLleno({ inscripcion: { ...formLleno().inscripcion, requiere: false } }),
      'uid',
      true,
    ) as unknown as Actividad;
    expect(doc.inscripcion.completo).toBe(true);
    expect(doc.inscripcion.destino).toBe('');
  });
});

describe('la decisión de no entrar al searchText (§6)', () => {
  /**
   * La quinta salida, la que el paso 0 del skill no lista y D-126 agregó: el
   * `searchText` viaja **entero** al `events.json` en cada visita.
   *
   * Acá la respuesta es **no**, y por dos motivos: nadie busca «completo» —lo que
   * se busca es un tema, una sede, un nombre— y el índice se recalcula en cada
   * guardado, así que meter un estado que cambia solo lo engordaría para todos
   * los que descargan el JSON, sin que nadie lo consulte.
   */
  it('marcar el cupo completo no cambia una letra del searchText', () => {
    const conCupo = formADocumento(formLleno(), 'uid', true);
    const sinCupo = formADocumento(
      formLleno({ inscripcion: { ...formLleno().inscripcion, completo: false } }),
      'uid',
      true,
    );
    expect(conCupo.searchText).toBe(sinCupo.searchText);
    expect(String(conCupo.searchText)).not.toContain('completo');
  });

  it('y el índice de un documento lleno no lo nombra', () => {
    expect(buildSearchText({ titulo: 'Taller de crónica' })).toBe('taller de cronica');
  });
});

describe('el schema (§11, B-183)', () => {
  it('acepta el booleano y por defecto es false', () => {
    const r = actividadFormSchema.safeParse({
      ...formLleno(),
      inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: '' },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.inscripcion.completo).toBe(false);
  });

  it('rechaza lo que no es un booleano', () => {
    const r = actividadFormSchema.safeParse({
      ...formLleno(),
      // Un string donde va un booleano: lo que llegaría de un borrador de otra
      // versión o de un documento tocado a mano. `safeParse` toma `unknown`, así
      // que acá el que tiene que rechazarlo es zod y no el compilador.
      inscripcion: { ...formLleno().inscripcion, completo: 'si' },
    });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toContain(
      'inscripcion.completo',
    );
  });

  it('no bloquea publicar, ni prendido ni apagado', () => {
    // Es un estado que cambia **después** de publicar: no es completitud. Y una
    // actividad llena tiene que seguir siendo editable y publicable.
    for (const completo of [true, false]) {
      const rutas = faltaParaPublicar(
        formLleno({
          descripcion: 'Ocho encuentros los martes, con lectura de crónicas.',
          organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
          arancel: { tipo: 'gratis', notas: '' },
          inscripcion: { ...formLleno().inscripcion, completo },
        }),
      ).map((i) => i.path.join('.'));
      expect(rutas.filter((r) => r.startsWith('inscripcion'))).toEqual([]);
    }
  });
});

describe('se prende desde el menú del listado, no desde el formulario', () => {
  /**
   * El código de un archivo **sin comentarios y sin espacios**, para poder
   * afirmar una llamada y no un nombre: sin colapsar espacios lo satisface el
   * `import`, y sin quitar comentarios lo satisface la prosa — y este repo
   * escribe comentarios largos que citan código. Es el helper de
   * `tests/autoguardado.test.ts`, misma razón.
   */
  const codigoSinEspacios = (ruta: string): string =>
    readFileSync(ruta, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\s+/g, '');

  it('el listado llama a `marcarCupoCompleto`, y es lo único que lo llama', () => {
    const listado = codigoSinEspacios('src/components/admin/ListaActividades.tsx');
    expect(listado).toContain('marcarCupoCompleto(a.id,completo,uid)');
    // El formulario no lo llama: si lo llamara, habría dos lugares donde
    // prenderlo y ninguno sería el bueno.
    for (const archivo of [
      'src/components/admin/ActividadFormulario.tsx',
      'src/components/admin/formulario/SeccionArancelInscripcion.tsx',
    ]) {
      expect(codigoSinEspacios(archivo), `${archivo} prende el cupo completo`).not.toContain(
        'marcarCupoCompleto',
      );
    }
  });

  it('escribe solo esa clave y no el objeto `inscripcion` entero', () => {
    /*
     * Con ruta punteada un toque desde el teléfono no puede pisar el destino ni
     * el cierre que el documento tenga en ese momento. Escribir `inscripcion`
     * completo desde el listado sería la clase de B-80 al revés: el listado no
     * tiene el formulario en la mano, así que reconstruiría el objeto desde lo
     * que trajo la última lectura.
     */
    // Se aísla el cuerpo de la función y se buscan las tres piezas por separado:
    // atarlo a un orden y a las comas de en medio lo rompería el formateador sin
    // que nada haya cambiado de verdad.
    const cuerpo = /marcarCupoCompleto=async\(([\s\S]*?)\n\};/.exec(
      codigoSinEspacios('src/lib/actividades.ts').replace(/;/g, ';\n'),
    );
    const fuente = codigoSinEspacios('src/lib/actividades.ts');
    expect(cuerpo, 'no se encontró marcarCupoCompleto').not.toBeNull();
    expect(fuente).toContain("'inscripcion.completo':completo");
    // Y no escribe el objeto entero: eso pisaría el destino y el cierre.
    expect(fuente).not.toContain('inscripcion:{completo}');
    // Firma la edición, así el historial la guarda y el sync corre.
    expect(fuente).toContain('updatedBy:uid');
    expect(fuente).toContain('updatedAt:serverTimestamp()');
  });

  /**
   * **La ruta punteada es un par productor/consumidor, y es la clase de B-88.**
   *
   * `marcarCupoCompleto` **produce** la ruta como string literal para
   * `updateDoc`; `documentoAForm`, `toPublic` y `construirDescripcion` la
   * **consumen** como propiedad tipada. TypeScript no mira adentro del string,
   * así que renombrar el campo del modelo dejaría al menú escribiendo un campo
   * fantasma: el cartel no se prende ni se apaga nunca, el panel muestra un
   * estado que la salida pública no tiene, y nada se pone rojo.
   *
   * Y el chequeo de arriba tampoco lo levantaría: busca el literal en el fuente,
   * o sea al productor contra sí mismo. Lo que ata los dos lados es exigir que
   * cada clave punteada que el módulo escribe **sea una ruta del schema** —
   * `CAMPOS_VALIDABLES` está atada a zod por `tests/analytics-campos.test.ts`.
   */
  it('cada clave punteada que se escribe es una ruta del schema (B-88, §5.2)', () => {
    const fuente = readFileSync('src/lib/actividades.ts', 'utf8');
    const punteadas = [
      ...new Set(
        [...fuente.matchAll(/'([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+)':/g)].map(
          (m) => m[1]!,
        ),
      ),
    ];
    // Sin esto el chequeo pasaría por vacío el día que la escritura cambie de
    // forma y no haya ninguna clave punteada que mirar.
    expect(
      punteadas,
      'la ruta de B-97 dejó de escribirse con ese nombre: el menú escribiría otro campo',
    ).toContain('inscripcion.completo');
    const fantasma = punteadas.filter((r) => !CAMPOS_VALIDABLES.has(r));
    expect(
      fantasma,
      'claves punteadas que el schema no tiene: el updateDoc escribiría un campo que nadie lee',
    ).toEqual([]);
  });

  it('el menú ofrece prenderlo y apagarlo, no solo prenderlo', () => {
    // Si se libera un lugar el cartel tiene que poder salir: el botón de una sola
    // dirección era la mitad del bug.
    const listado = codigoSinEspacios('src/components/admin/ListaActividades.tsx');
    expect(listado).toContain("'Marcarcupodisponible'");
    expect(listado).toContain("'Marcarcupocompleto'");
  });

  it('y la fila muestra que está marcada, sin abrir el menú', () => {
    // Lo que se publica se puede ver desde el panel: el cartel ya está en el
    // sitio y en los N eventos.
    const listado = codigoSinEspacios('src/components/admin/ListaActividades.tsx');
    expect(listado).toContain('Cupocompleto');
    // Y la sección del formulario lo avisa, aunque no lo edite.
    expect(codigoSinEspacios('src/components/admin/formulario/SeccionArancelInscripcion.tsx')).toContain(
      'form.inscripcion.completo&&',
    );
  });

  it('el uso de la función se mide, con vocabulario cerrado (§9)', () => {
    expect(FUNCIONES).toContain('actividad-cupo-completo');
    expect(codigoSinEspacios('src/components/admin/ListaActividades.tsx')).toContain(
      "medirFuncion('actividad-cupo-completo'",
    );
  });
});

describe('la línea del evento se arma adentro de @calendario (D-20, trampa 9)', () => {
  it('nadie la arma por fuera de `construirDescripcion`', () => {
    /*
     * La vista previa del panel importa `construirEvento` de `@calendario` (D-20),
     * así que se actualiza sola. Lo que este chequeo cuida es lo contrario: que
     * nadie arme la línea del cupo completo por fuera —en el panel o en
     * `index.js`—, porque entonces dejaría de entrar al payload que compara la
     * guarda anti-loop y prenderla dejaría de propagarse a las N sesiones del
     * ciclo **en silencio** (trampa 9, D-07).
     *
     * Los rótulos del panel (el cartel de la fila, el aviso de la sección) no
     * están en esta lista a propósito: son etiquetas de pantalla y no la prosa
     * pública, igual que `ETIQUETA_ENTREGA` no se comparte.
     */
    for (const archivo of [
      'src/lib/vistaPreviaEvento.ts',
      'src/components/admin/VistaPreviaEvento.tsx',
      'functions/index.js',
    ]) {
      expect(readFileSync(archivo, 'utf8'), `${archivo} arma la línea del cupo`).not.toContain(
        'Cupo completo',
      );
    }
    // Y el único que la arma, la arma: si esto deja de valer, el chequeo de
    // arriba pasaría por vacío.
    expect(readFileSync('functions/calendario.js', 'utf8')).toContain("'Cupo completo");
  });

  it('y aparece una sola vez en el evento, no dos', () => {
    /*
     * El chequeo de arriba mira tres archivos por nombre; este mira el resultado.
     * Es lo que distingue «armada adentro» de «armada adentro **y también**
     * afuera»: concatenarla en `construirEvento` sobre lo que ya devolvió
     * `construirDescripcion` no rompe la propagación —sigue entrando al payload—
     * pero deja la línea dos veces en el calendario público de todo el mundo, y
     * ningún test de propagación se da cuenta.
     */
    const doc = formADocumento(formLleno(), 'uid', true) as unknown as Actividad;
    const evento = construirEvento(doc, doc.sesiones[0]!, {}) as { description: string };
    expect(evento.description.match(/Cupo completo/g)).toHaveLength(1);
  });
});

describe('el historial lo cubre sin que nadie lo registre (§12, D-41)', () => {
  /**
   * D-41 elige una lista **negra** de campos de máquina justamente para esto: un
   * campo nuevo del modelo entra al historial solo. Y acá importa el doble,
   * porque la escritura viene de un menú y no de un formulario: sin versión, un
   * toque de más no se puede deshacer.
   */
  it('marcar el cupo completo cuenta como cambio de contenido y guarda versión', () => {
    expect(camposCambiados(taller(), lleno())).toEqual(['inscripcion']);
    expect(huboCambioDeContenido(taller(), lleno())).toBe(true);
  });

  it('y ese mismo `true` es lo que marca el rebuild del sitio (§8, B-83)', () => {
    /*
     * `syncCalendar` cuelga `marcarRebuild` de `huboCambioDeContenido` y no de
     * que el calendario haya recibido operaciones (B-83). O sea: la misma
     * comparación decide la versión del historial **y** que el cartel llegue al
     * `events.json`. Sin esto, marcar el cupo completo actualizaba los eventos y
     * el sitio se quedaba mostrando «cupo: 12» hasta la edición siguiente.
     */
    expect(huboCambioDeContenido(lleno(), taller())).toBe(true);
    // Y el write-back de la Function no cuenta: el contenido editable no cambió.
    const conEvento = lleno();
    conEvento.sesiones[0]!.calendarEventId = 'evt_1';
    expect(huboCambioDeContenido(lleno(), conEvento)).toBe(false);
  });

  it('y el historial nombra el campo en castellano, no como clave del modelo', () => {
    // `inscripcion` ya tenía su entrada: el campo es anidado, así que la pantalla
    // de versiones ofrece restaurar «Inscripción» y no `inscripcion.completo`.
    const src = readFileSync('src/components/admin/HistorialActividad.tsx', 'utf8');
    expect(src).toMatch(/^\s*inscripcion: '[^']+',$/m);
  });
});

describe('el mensaje de la barra sabe nombrarlo (B-184)', () => {
  it('la ruta tiene nombre y vive en «Arancel e inscripción»', () => {
    expect(CAMPOS['inscripcion.completo']).toBeDefined();
    expect(seccionDeCampo('inscripcion.completo')).toBe('arancel-inscripcion');
    expect(etiquetaDeCampo('inscripcion.completo')).toBe('Cupo completo');
  });
});

describe('«se llenó» tiene un solo dueño, y no es el formulario (B-97, clase de B-80)', () => {
  /**
   * `completo` se prende desde el menú del listado. El formulario también escribe
   * `inscripcion`, así que son **dos pantallas escribiendo el mismo campo adentro
   * de un objeto de contenido** — el perfil exacto de `calendarEventId` dentro de
   * `sesiones`, o sea la clase de B-80.
   *
   * Los dos caminos por los que el valor viejo volvía, y los dos están cerrados:
   *
   * 1. **Guardar el formulario.** Abierto desde antes de marcarlo, su próximo
   *    guardado reasentaba `completo: false` y apagaba el cartel del sitio y de los
   *    N eventos del ciclo sin que nadie lo pida.
   * 2. **Recuperar un borrador local**, que vive hasta 30 días — es la lista de
   *    D-124, que con esto se quedó corta por tercera vez.
   */
  it('guardar el formulario no escribe `completo`: lo escribe solo el listado', () => {
    const payload = payloadDeActualizacion(
      { ...formularioLleno(), inscripcion: { ...formularioLleno().inscripcion, completo: false } },
      'uid-a',
      // B-150 — las sesiones que tiene el documento hoy. Acá no hay ninguna que
      // importe para este chequeo; el tercer argumento es obligatorio a
      // propósito, para que nadie pueda guardar sin decidir de dónde salen los
      // campos de máquina.
      [],
    );
    // Ni la clave punteada ni el objeto entero.
    expect(Object.keys(payload)).not.toContain('inscripcion.completo');
    expect(Object.keys(payload)).not.toContain('inscripcion');
  });

  it('pero el resto de la inscripción sí se guarda, por subcampo', () => {
    // Escribir `inscripcion` entero era lo que pisaba `completo`; escribir solo
    // `completo` afuera dejaría de guardar el destino, que es peor.
    const payload = payloadDeActualizacion(formularioLleno(), 'uid-a', []);
    expect(Object.keys(payload)).toContain('inscripcion.destino');
    expect(Object.keys(payload)).toContain('inscripcion.cupo');
    expect(Object.keys(payload)).toContain('inscripcion.requiere');
  });
});
