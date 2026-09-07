import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analiticaHabilitada } from '@/lib/analytics';
import {
  ACCIONES,
  ANCHOS,
  CAMPOS_VALIDABLES,
  CODIGOS_FIREBASE,
  DETALLES,
  DISPOSITIVOS,
  ESTADOS_DESTINO,
  EVENTOS,
  FORMATO_VERSION,
  FUERA_DE_VOCABULARIO,
  FUNCIONES,
  GRUPOS,
  MODALIDADES_MEDIBLES,
  MODOS,
  MOTIVOS_FALLO,
  NOMBRES_EVENTOS,
  SIN_VERSION_ESTAMPADA,
  avanceDelFormulario,
  clasificarFalloGuardado,
  construirEvento,
  formaDelFormulario,
  normalizarCampo,
  type NombreEvento,
} from '@/lib/analytics-eventos';
import { actividadFormSchema } from '@/lib/schema';
import { CENTINELAS, VALORES_CENTINELA, formularioLleno } from './fixtures/formulario';

/**
 * **Ningún payload de analítica lleva contenido del formulario.**
 *
 * Es el equivalente, para la analítica, de los tests que verifican que el link
 * de Zoom no sale al calendario: no se confía en la intención del código, se
 * arma el payload y se busca el dato adentro.
 *
 * El fixture llena cada campo de texto con un centinela reconocible
 * (`tests/fixtures/formulario.ts`), incluidos los que el §5.1 prohíbe publicar
 * —link de la reunión, difusión interna, URL de material privado— y además el
 * uid y el mail del admin, que no salen ni al `events.json` ni a acá.
 */

/** Todos los vocabularios cerrados: lo único que un string puede llegar a ser. */
const VOCABULARIO = new Set<string>([
  ...DISPOSITIVOS,
  ...ANCHOS,
  ...MODOS,
  ...ACCIONES,
  ...ESTADOS_DESTINO,
  ...MODALIDADES_MEDIBLES,
  ...MOTIVOS_FALLO,
  ...CODIGOS_FIREBASE,
  ...FUNCIONES,
  ...DETALLES,
  ...GRUPOS,
  FUERA_DE_VOCABULARIO,
  SIN_VERSION_ESTAMPADA,
  '',
]);

/**
 * Un valor de parámetro es admisible si es un número, o texto de vocabulario.
 *
 * B-165 — `FORMATO_VERSION` se **importa** del código que sanea, no se copia.
 * Acá había una tercera copia del formato, y B-88 amplió el real sin tocarla:
 * quedó estrictamente más angosta que la que el código acepta. Eso no podía
 * volverse una fuga —al ser más angosta, lo único que podía hacer era rechazar
 * un valor que el código sí acepta, o sea dar una falsa alarma— pero un
 * predicado de admisibilidad que no es el del productor no está verificando lo
 * que dice verificar.
 *
 * Que el consumidor derive por su cuenta el formato del productor es la clase de
 * B-88, y este archivo era una instancia con la red puesta al lado. La guarda
 * contra la próxima copia está en `tests/clases-de-bug.test.ts`.
 */
const esAdmisible = (valor: unknown): boolean => {
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor !== 'string') return false;
  if (FORMATO_VERSION.test(valor)) return true;
  // Las listas viajan unidas por coma; cada token va por separado.
  return valor
    .split(',')
    .every((token) => VOCABULARIO.has(token) || CAMPOS_VALIDABLES.has(token));
};

const revisar = (evento: { nombre: string; params: Record<string, unknown> } | null) => {
  expect(evento).not.toBeNull();
  const serializado = JSON.stringify(evento);
  for (const centinela of VALORES_CENTINELA) {
    expect(serializado).not.toContain(centinela);
  }
  for (const [param, valor] of Object.entries(evento!.params)) {
    // Ni objetos ni arrays: un valor anidado podría esconder contenido.
    expect(['string', 'number']).toContain(typeof valor);
    expect(String(valor).length).toBeLessThanOrEqual(100);
    expect(esAdmisible(valor), `${evento!.nombre}.${param} = ${String(valor)}`).toBe(true);
  }
};

describe('la analítica no se puede llevar contenido del formulario', () => {
  it('un centinela en CADA parámetro declarado de CADA evento no sobrevive', () => {
    // Esta es la garantía estructural: si mañana alguien agrega un parámetro
    // que acepte texto libre, este test falla sin que haya que acordarse de
    // escribirle un caso propio.
    for (const nombre of NOMBRES_EVENTOS) {
      for (const param of Object.keys(EVENTOS[nombre])) {
        for (const centinela of VALORES_CENTINELA) {
          revisar(construirEvento(nombre, { [param]: centinela }));
          revisar(construirEvento(nombre, { [param]: [centinela, centinela] }));
        }
      }
    }
  });

  it('los centinelas metidos en parámetros NO declarados se descartan', () => {
    const contrabando: Record<string, unknown> = {
      titulo: CENTINELAS.titulo,
      descripcion: CENTINELAS.descripcion,
      email: CENTINELAS.mailAdmin,
      uid: CENTINELAS.uid,
      url: CENTINELAS.linkReunion,
      form: formularioLleno(),
    };
    for (const nombre of NOMBRES_EVENTOS) {
      revisar(construirEvento(nombre, contrabando));
    }
  });

  it('el formulario entero como parámetros no filtra nada', () => {
    // El peor caso imaginable: alguien pasa el estado del formulario tal cual.
    const form = formularioLleno() as unknown as Record<string, unknown>;
    for (const nombre of NOMBRES_EVENTOS) {
      revisar(construirEvento(nombre, form));
    }
  });

  it('un nombre de evento inventado no manda nada', () => {
    expect(construirEvento('titulo_de_la_actividad', { titulo: CENTINELAS.titulo })).toBeNull();
  });
});

describe('los payloads reales de los puntos de medición', () => {
  const form = formularioLleno();

  it('guardado_ok describe la actividad sin nombrarla', () => {
    revisar(
      construirEvento('guardado_ok', {
        dispositivo: 'mobile',
        ancho: 'xs',
        modo: 'nueva',
        accion: 'submit',
        segundos: 412,
        intentos_validacion: 2,
        ...formaDelFormulario(form),
      }),
    );
  });

  /**
   * DEC-1, §5.1 — de la analítica sale **si el libro se cargó o no**, nunca el
   * título de la obra ni su autor. Los dos son texto libre y no hay sanitizador
   * de texto libre (§9 de `docs/07-seguridad.md`): la única forma de que un
   * título no se escape es que el valor sea un booleano.
   *
   * El centinela del fixture es lo que fija esta celda: `revisar()` recorre
   * todos los centinelas, así que mandar `libro: form.libro.titulo` por descuido
   * en cualquier evento pone rojo esto.
   */
  it('del libro presentado sale el booleano, nunca el título (DEC-1, §5.1)', () => {
    const evento = construirEvento('guardado_ok', {
      dispositivo: 'mobile',
      ancho: 'xs',
      modo: 'nueva',
      accion: 'submit',
      ...formaDelFormulario(form),
    });
    revisar(evento);
    expect(evento!.params.tiene_libro).toBe(1);
    expect(
      formaDelFormulario(formularioLleno({ libro: { titulo: '', autor: '' } })).tiene_libro,
    ).toBe(false);
  });

  /**
   * B-97, §5.1 — de la analítica sale **si estaba marcada como completa**, y nada
   * más. Es un booleano, así que no hay contenido posible: no existe el número de
   * lugares que quedan (§3.1: booleano y no contador) ni el destino de la
   * inscripción, que es el campo de al lado y sí es texto libre — su centinela lo
   * cuida en el mismo payload.
   */
  it('del cupo completo sale el booleano y nada más (B-97, §5.1)', () => {
    const evento = construirEvento('guardado_ok', {
      dispositivo: 'mobile',
      ancho: 'xs',
      modo: 'nueva',
      accion: 'submit',
      ...formaDelFormulario(form),
    });
    revisar(evento);
    expect(evento!.params.cupo_completo).toBe(1);
    expect(
      formaDelFormulario(
        formularioLleno({ inscripcion: { ...form.inscripcion, completo: false } }),
      ).cupo_completo,
    ).toBe(false);
  });

  it('la ruta del campo del cupo viaja: es el nombre, no el estado (B-97, D-60)', () => {
    // Lo que la analítica necesita para decir «el schema rechaza esto» es la ruta
    // `inscripcion.completo`, que es vocabulario cerrado derivado del schema.
    expect(normalizarCampo('inscripcion.completo')).toBe('inscripcion.completo');
  });

  it('la ruta del campo sí viaja: es el nombre, no el valor (DEC-1, D-60)', () => {
    // Lo que la analítica necesita para decir «la gente se traba en el libro» es
    // la ruta `libro.titulo`, que es vocabulario cerrado derivado del schema.
    expect(normalizarCampo('libro.titulo')).toBe('libro.titulo');
    expect(normalizarCampo(CENTINELAS.libro)).toBe(FUERA_DE_VOCABULARIO);
  });

  it('formulario_abandonado dice en qué grupo se trabó, no qué escribió', () => {
    const { completos, faltantes } = avanceDelFormulario(
      formularioLleno({ material: { tiene: true, items: [] } }),
    );
    revisar(
      construirEvento('formulario_abandonado', {
        modo: 'duplicar',
        segundos: 95,
        avance: completos.length,
        faltantes,
        encuentros: form.sesiones.length,
        intentos_validacion: 1,
      }),
    );
  });

  it('validacion_fallida lleva las rutas del schema, no los valores', () => {
    // Se usan los issues de verdad que produce zod sobre un formulario roto,
    // no una lista inventada: es el mismo dato que ve el componente.
    const roto = formularioLleno({
      titulo: '',
      descripcion: '',
      arancel: { tipo: '', notas: CENTINELAS.notasArancel },
      sesiones: [
        {
          id: 'ses_3333',
          inicio: '2026-09-10T21:00',
          fin: '2026-09-10T19:00',
          tema: CENTINELAS.tema,
          lectura: CENTINELAS.lectura,
          cancelada: false,
          calendarEventId: null,
        },
      ],
      inscripcion: {
        requiere: true,
        via: null,
        destino: '',
        cupo: null,
        cierra: '',
        completo: false,
      },
    });
    const parsed = actividadFormSchema.safeParse(roto);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const campos = parsed.error.issues.map((i) => i.path.join('.'));
    expect(campos.length).toBeGreaterThan(0);

    revisar(construirEvento('validacion_fallida', { cantidad: campos.length, campos }));
    for (const campo of campos) {
      revisar(construirEvento('campo_invalido', { campo }));
      // Y además: los paths de zod son rutas reconocidas, no "otro". Si esto
      // falla, la analítica funciona pero no sirve para nada.
      expect(normalizarCampo(campo)).not.toBe(FUERA_DE_VOCABULARIO);
    }
  });

  it('guardado_fallido no arrastra el mensaje del error', () => {
    const errores: unknown[] = [
      'slug-tomado',
      new Error(`Fecha inválida: "${CENTINELAS.titulo}"`),
      { code: 'permission-denied', message: `no se pudo escribir ${CENTINELAS.uid}` },
      new Error(`falló guardando ${CENTINELAS.mailInscripcion}`),
    ];
    for (const e of errores) {
      revisar(construirEvento('guardado_fallido', clasificarFalloGuardado(e)));
    }
  });
});

describe('no se mide en desarrollo', () => {
  it('con los emuladores prendidos la analítica está apagada', () => {
    // `vitest.config.ts` corre con PUBLIC_USE_EMULATORS=true, igual que
    // `npm run dev`: en este entorno no puede salir un solo evento.
    expect(analiticaHabilitada()).toBe(false);
  });
});

describe('la taxonomía es chica y estable', () => {
  it('son pocos eventos, con nombres explícitos', () => {
    // Cincuenta eventos sueltos no se analizan; diez bien elegidos sí. El tope
    // es para que agregar el número once sea una decisión, no un descuido.
    expect(NOMBRES_EVENTOS.length).toBeLessThanOrEqual(10);
  });

  it('los nombres documentados son exactamente los implementados', () => {
    // Si se agrega un evento sin documentarlo, el valor de esto se pierde a los
    // tres meses: nadie se acuerda qué medía cada nombre.
    const nombres: NombreEvento[] = [
      'panel_abierto',
      'formulario_abierto',
      'formulario_abandonado',
      'validacion_fallida',
      'campo_invalido',
      'guardado_ok',
      'guardado_fallido',
      'funcion_usada',
    ];
    expect([...NOMBRES_EVENTOS].sort()).toEqual([...nombres].sort());
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La tabla de `09-analitica.md` no puede quedarse corta — B-58
// ───────────────────────────────────────────────────────────────────────────

describe('toda función medida está documentada — B-58', () => {
  const doc = (): string => readFileSync(`${process.cwd()}/docs/09-analitica.md`, 'utf8');

  /**
   * Las filas de **la tabla de funciones**, y no las de todo el documento.
   *
   * Se busca su encabezado y se toman las filas contiguas que siguen. Es la pieza
   * que el primer intento no tenía, y sin ella el chequeo **no verificaba lo que
   * decía verificar**: lo levantó el `auditor-privacidad`. Buscar el nombre en
   * `doc` entero deja pasar el borrado de una fila para las cinco funciones que
   * el documento **también** nombra en la prosa (`estadisticas-abrir`,
   * `imagen-subida`, `imagen-rechazada`, `seccion-abrir`, `seccion-cerrar`) — y el
   * docblock afirmaba que esa mutación estaba probada, cuando lo único probado
   * era el caso de una función que no aparece en ninguna otra parte.
   */
  const filasDeLaTabla = (): string[] => {
    const lineas = doc().split('\n');
    const encabezado = lineas.findIndex((l) => /^\| `funcion` \| Cuándo \|/.test(l));
    expect(encabezado, 'no se encontró el encabezado de la tabla de funciones').toBeGreaterThan(-1);

    const filas: string[] = [];
    // +2: el encabezado y su separador `|---|`.
    for (let i = encabezado + 2; i < lineas.length && lineas[i]!.startsWith('|'); i += 1) {
      filas.push(lineas[i]!);
    }
    expect(filas.length, 'la tabla de funciones salió vacía o cortada').toBeGreaterThan(15);
    return filas;
  };

  /**
   * Los nombres de la **primera celda** de cada fila, que es la que nombra la
   * función. Las otras tres son prosa y valores de `detalle`, que son slugs con
   * guion también (`arancel-e-inscripcion`, `coord-link-corto`) y no son
   * funciones.
   */
  const nombradasEnLaTabla = (): Set<string> =>
    new Set(
      filasDeLaTabla().flatMap((l) =>
        [...(l.split('|')[1] ?? '').matchAll(/`([a-z][a-z0-9-]+)`/g)].map((m) => m[1]!),
      ),
    );

  it('la tabla de `docs/09-analitica.md` nombra todas las funciones, y ninguna de más', () => {
    /*
     * **Encontrado al agregar `encuentro-cancelar`.** La tabla del §«funcion» de
     * `docs/09-analitica.md` es lo único que dice **qué mide el panel y con qué
     * `valor`**, y estaba corta en cuatro: `duplicar-desmarcar` (B-199),
     * `encuentro-correr` (B-186), `actividad-cupo-completo` (B-97) y la nueva.
     * O sea que tres se habían agregado al enum sin pasar por la tabla — no es un
     * olvido de una vez, es un patrón.
     *
     * Por qué importa más que un índice desactualizado: esa tabla es la que se
     * consulta para saber si un evento **puede llevar texto libre**. Una función
     * que no está en la tabla es una que se mide sin que nadie haya escrito qué
     * manda, y el §9 del diseño es justamente «enum cerrado, nada de texto libre».
     *
     * **La cantidad no se escribe acá.** Sale de `FUNCIONES`: un título que diga
     * «las 24» miente el día que entre la 25 sin que nada falle.
     *
     * MUTACIÓN PROBADA, las dos direcciones: agregar un valor a `FUNCIONES` sin
     * tocar la doc deja este caso en rojo nombrándolo, y **borrar la fila de
     * `estadisticas-abrir`** —que el documento nombra dos veces en la prosa, o sea
     * el caso que el primer intento dejaba pasar— también.
     */
    const enTabla = nombradasEnLaTabla();

    const sinDocumentar = FUNCIONES.filter((f) => !enTabla.has(f));
    expect(
      sinDocumentar,
      'estas funciones se miden y la tabla de `09-analitica.md` no las nombra: ' +
        'nadie escribió qué mandan',
    ).toEqual([]);

    // La vuelta: la tabla no puede nombrar una función que ya no existe, porque
    // eso hace creer que se mide algo que no.
    const fantasmas = [...enTabla].filter((n) => !(FUNCIONES as readonly string[]).includes(n));
    expect(fantasmas, 'la tabla nombra funciones que el enum no tiene').toEqual([]);
  });

  it('el `valor` de `encuentro-correr` viaja CON signo — B-797', () => {
    /*
     * **Este caso cambió de afirmación el mismo día que se escribió, y por eso
     * está escrito el original.** Decía «viaja SIN signo: el clamp lo lleva a 0»,
     * y era cierto: el sanitizador de `entero` recortaba a `[0, max]`, así que de
     * los cuatro saltos que ofrece el editor —`−1 sem`, `−1 día`, `+1 día`,
     * `+1 sem`— los dos hacia atrás llegaban **los dos como `0`**. Ni se
     * distinguían entre sí ni de un salto de cero días.
     *
     * Lo había fijado como está —el comportamiento real, no el deseado— para que
     * la doc no volviera a inventar el signo, y con el arreglo (**B-797**) ese
     * caso se puso en rojo, que es exactamente lo que tenía que pasar: el cambio
     * lo pidió explícitamente en vez de pasar sin que nadie note qué se arregló.
     *
     * El piso ahora es **−366**, y son dos decisiones que conviene tener juntas:
     *
     * - **`min` es del parámetro y no de la función.** El sanitizador es uno por
     *   parámetro, así que abrir el piso lo abre para las veinticuatro funciones.
     *   Se acepta porque el techo es lo que acota de verdad: un `valor` inventado
     *   sigue encerrado en `[−366, 1000]`, un entero chico y sin contenido.
     * - **−366 y no `-Infinity`:** un año de días para atrás es el salto más
     *   grande que el editor puede producir con clics, así que más allá es un
     *   error y se recorta.
     *
     * MUTACIÓN PROBADA: sacar el `min` del spec deja este caso en rojo con los dos
     * negativos en `0`.
     */
    const valorDe = (v: number) =>
      construirEvento('funcion_usada', { funcion: 'encuentro-correr', valor: v })?.params.valor;

    expect([valorDe(-7), valorDe(-1), valorDe(1), valorDe(7)]).toEqual([-7, -1, 1, 7]);

    // El cero se emite, no se descarta: el saneador saltea `undefined`, no el 0.
    expect(construirEvento('funcion_usada', { funcion: 'encuentro-correr', valor: 0 })?.params)
      .toHaveProperty('valor');

    // Y el piso acota: un año y medio para atrás se recorta a −366.
    expect(valorDe(-500)).toBe(-366);
    expect(valorDe(5000)).toBe(1000);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El panel no cuenta como visita del sitio público — B-801
// ───────────────────────────────────────────────────────────────────────────

describe('la analítica del panel no manda vistas de página — B-801', () => {
  const fuente = (): string =>
    readFileSync(`${process.cwd()}/src/lib/analytics.ts`, 'utf8').replace(/\s+/g, ' ');

  it('inicializa con `send_page_view: false`', () => {
    /*
     * **El bug que este caso frena, y era real.** El dueño vio `/admin/` en «Las
     * páginas más vistas» **del sitio público**, y la causa no era el ranking: la
     * analítica del panel y la del sitio usan el **mismo**
     * `PUBLIC_FIREBASE_MEASUREMENT_ID`, o sea la misma propiedad de GA4. Y
     * `getAnalytics` configura `gtag` con `send_page_view` en `true` por default,
     * así que **cada vez que se abría el panel se contaba una vista del sitio**.
     *
     * No es solo `/admin/` en un ranking: las visitas al panel entraban también en
     * sesiones, personas y vistas, que son los tres números que la pestaña ofrece
     * «para un anunciante».
     *
     * MUTACIÓN PROBADA: volver a `getAnalytics(app())` deja este caso en rojo.
     */
    expect(fuente(), 'el panel volvió a mandar la vista automática').toMatch(
      /initializeAnalytics\(\s*app\(\),\s*\{\s*config:\s*\{\s*send_page_view:\s*false/,
    );
  });

  it('y el panel sigue midiendo lo suyo: apagar la vista no apaga los eventos', () => {
    /*
     * La otra mitad, y la que impide el arreglo de más. Apagar la analítica del
     * panel entera —`setAnalyticsCollectionEnabled(false)`— también saca `/admin/`
     * del ranking, y de paso apaga `funcion_usada`, `guardado_ok` y los eventos con
     * los que se decide qué se usa del panel. La medición del panel **no pierde
     * nada** con este cambio: ninguno de sus números salía del `page_view`, y
     * «¿alguien abre el tablero?» ya se mide con `estadisticas-abrir`.
     */
    const src = fuente();
    expect(src, 'se apagó la recolección entera en vez de la vista').not.toContain(
      'setAnalyticsCollectionEnabled',
    );
    expect(src, 'el panel dejó de emitir sus eventos').toContain('sdk.logEvent(');
  });

  it('el fallback existe: si ya estaba inicializada, no se pierde la medición', () => {
    /*
     * `initializeAnalytics` tira si la app ya tiene una instancia. Sin el `catch`,
     * ese caso dejaría al panel **sin medir nada** — un cambio pensado para sacar
     * un dato de más terminaría sacando todos. Es la clase de B-180: el arreglo
     * que se lleva puesta la funcionalidad que arreglaba.
     */
    expect(fuente()).toMatch(/catch\s*\{\s*return sdk\.getAnalytics\(app\(\)\);/);
  });
});
