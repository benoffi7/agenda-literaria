/**
 * La bandeja de propuestas, la parte que no necesita pantalla — B-830, paso 7.
 *
 * Tres cosas que son puras y se pueden verificar sin emuladores y sin DOM:
 * **la forma de la única escritura** que el panel hace sobre una propuesta, **el
 * link del contacto** —que es texto de un anónimo puesto en un `href`— y **la
 * frase de una fecha**, que es donde la trampa 1 volvería a aparecer si a
 * alguien se le ocurre formatear con `Date`.
 *
 * El cableado de la pantalla está en `propuestas-panel.render.test.tsx`, y que
 * la regla acepte de verdad lo que se arma acá, en
 * `propuestas.integracion.test.ts` — que importa **esta** función en vez de
 * copiar el objeto, que es lo que se desincroniza.
 *
 * **Y desde B-844 hay una cuarta cosa, que no es pura sino comparada:** cuándo
 * caduca una propuesta está escrito dos veces —acá para decirlo, en
 * `functions/retencion.js` para borrarla— y el último `describe` de este archivo
 * pasa una familia de fixtures por las dos implementaciones exigiendo que
 * coincidan. Es lo que reemplaza al import que no se hizo (el motivo está en el
 * docblock de `bandejaDePropuestas.ts`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AVISO_DE_CADUCIDAD_DIAS,
  ESTADOS_PENDIENTES,
  RETENCION_DIAS,
  avisoDeCaducidad,
  caducaEn,
  cambioDeRevision,
  enlaceDeContacto,
  enlaceDeImagen,
  esPendiente,
  fraseDeFechaPropuesta,
} from '@/lib/bandejaDePropuestas';
import { ESTADOS_PROPUESTA } from '@/types/propuesta';
// La otra implementación del mismo plazo, la que **borra**. Se importa acá y
// solo acá: es lo que ata las dos (ver el `describe` del final).
import { RETENCION_POR_ESTADO, decidirRetencion } from '../functions/retencion.js';
// El doble de `Timestamp` del repo, uno y solo uno (B-211).
import { tsDe } from './fixtures/tiempo';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

describe('la única escritura del panel sobre una propuesta', () => {
  it('mueve el estado y firma la revisión, con los cuatro campos siempre', () => {
    expect(cambioDeRevision('uid_admin', 'aceptada', 'AHORA', { actividadId: 'act_1' })).toEqual({
      estado: 'aceptada',
      revision: { porUid: 'uid_admin', en: 'AHORA', actividadId: 'act_1', motivo: null },
    });
  });

  it('los dos opcionales van en `null` y no ausentes', () => {
    /*
     * No es cosmética: `revisionValida()` los exige con un `hasAll`, así que
     * `{ porUid, en }` a secas es un permission-denied. Es la asimetría con el
     * `create`, donde el default centinela ya tapa la clave ausente.
     */
    const { revision } = cambioDeRevision('uid_admin', 'en-revision', 'AHORA');
    expect(Object.keys(revision).sort()).toEqual(['actividadId', 'en', 'motivo', 'porUid']);
    expect(revision.actividadId).toBeNull();
    expect(revision.motivo).toBeNull();
  });

  it('no toca nada más que `estado` y `revision`', () => {
    // La otra mitad de la regla (`affectedKeys().hasOnly([...])`) y la razón por
    // la que la bandeja no puede editar el contenido de una propuesta: no hay
    // forma de mandar un título por este camino.
    expect(Object.keys(cambioDeRevision('u', 'rechazada', 'AHORA', { motivo: 'no' }))).toEqual([
      'estado',
      'revision',
    ]);
  });

  it('y las claves son exactamente las que `firestore.rules` acepta', () => {
    /*
     * La atadura de B-364 aplicada a un mapa: la regla vive en otro runtime y no
     * puede importar TypeScript, así que el único modo de que las dos listas no
     * se separen es un test que lea el archivo. Sin esto, agregar un campo a
     * `revision` en la regla y olvidarse acá —o al revés— deja la bandeja
     * rechazada en producción con el build en verde.
     *
     * Se comparan **las dos** apariciones (la del `create` y la del `update`):
     * son el mismo mapa y tienen que seguir siéndolo.
     */
    const declaradas = [
      ...fuente('firestore.rules').matchAll(/revision\.keys\(\)\.hasOnly\(\[([^\]]+)\]\)/g),
    ].map((m) => m[1]!.split(',').map((k) => k.trim().replace(/'/g, '')).sort());
    expect(declaradas.length).toBeGreaterThanOrEqual(2);
    const { revision } = cambioDeRevision('u', 'aceptada', 'AHORA');
    for (const claves of declaradas) {
      expect(claves).toEqual(Object.keys(revision).sort());
    }
  });

  it('los estados pendientes son estados de verdad, y las cerradas no lo son', () => {
    for (const e of ESTADOS_PENDIENTES) {
      expect(ESTADOS_PROPUESTA).toContain(e);
      expect(esPendiente({ estado: e })).toBe(true);
    }
    expect(esPendiente({ estado: 'aceptada' })).toBe(false);
    expect(esPendiente({ estado: 'rechazada' })).toBe(false);
  });
});

describe('el contacto de quien propuso, que es texto ajeno en un `href`', () => {
  it('un mail se abre con el cliente de mail', () => {
    expect(enlaceDeContacto({ via: 'mail', valor: ' hola@casabrandon.example ' })).toBe(
      'mailto:hola@casabrandon.example',
    );
  });

  it('un WhatsApp se queda con los dígitos', () => {
    expect(enlaceDeContacto({ via: 'whatsapp', valor: '+54 9 11 2222-3333' })).toBe(
      'https://wa.me/5491122223333',
    );
  });

  it('un handle de Instagram, con o sin arroba', () => {
    expect(enlaceDeContacto({ via: 'instagram', valor: '@casa.brandon' })).toBe(
      'https://instagram.com/casa.brandon',
    );
    expect(enlaceDeContacto({ via: 'instagram', valor: 'casabrandon' })).toBe(
      'https://instagram.com/casabrandon',
    );
  });

  /**
   * **El caso que justifica que esto sea una función y no una interpolación.**
   *
   * `contacto.valor` lo escribe alguien sin login, y un `href` es donde un string
   * ajeno deja de ser texto: `javascript:` en un panel con la sesión de un admin
   * abierta es código con sus permisos. React escapa el **contenido** de un
   * atributo, no su esquema.
   *
   * MUTACIÓN PROBADA: devolver `valor` sin validar en cualquiera de las tres
   * ramas pone en rojo el caso de esa rama.
   */
  it('nada que no sea un contacto de verdad llega a un link', () => {
    const veneno = [
      'javascript:alert(document.cookie)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ];
    for (const valor of veneno) {
      for (const via of ['mail', 'whatsapp', 'instagram'] as const) {
        expect(enlaceDeContacto({ via, valor }), `${via} · ${valor}`).toBeNull();
      }
    }
  });

  it('y tampoco un valor a medias, que se muestra como texto y no como link roto', () => {
    expect(enlaceDeContacto({ via: 'mail', valor: 'escribime al mail' })).toBeNull();
    // Cinco dígitos no son un teléfono; dieciséis tampoco (E.164 corta en 15).
    expect(enlaceDeContacto({ via: 'whatsapp', valor: '12345' })).toBeNull();
    expect(enlaceDeContacto({ via: 'whatsapp', valor: '1'.repeat(16) })).toBeNull();
    expect(enlaceDeContacto({ via: 'instagram', valor: 'mi cuenta de insta' })).toBeNull();
  });
});

/**
 * **El otro `href` de texto ajeno de la bandeja** — lo señaló el
 * `auditor-privacidad`. `imagen.url` es el único string de una propuesta que no
 * pasa por ningún validador de forma: la regla exige `is string` y 1–500
 * caracteres, y el schema solo el largo. Con `/proponer` abierto (paso 9) el
 * documento puede traer cualquier cosa.
 */
describe('la imagen que pegaron, que es el otro href', () => {
  it('una URL de verdad se puede abrir', () => {
    expect(enlaceDeImagen({ url: 'https://casabrandon.test/flyer.jpg' })).toBe(
      'https://casabrandon.test/flyer.jpg',
    );
  });

  it('un esquema que no es http(s) no arma ningún link', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
      expect(enlaceDeImagen({ url }), url).toBeNull();
    }
  });

  it('y la imagen subida no es un link: verla es del paso 8 (DEC-11)', () => {
    expect(enlaceDeImagen({ storagePath: 'propuestas/abc.jpg' })).toBeNull();
    expect(enlaceDeImagen(null)).toBeNull();
  });

  it('el saneo es el mismo de la ficha pública, importado y no copiado', () => {
    // Dos versiones de «qué URL es segura» divergen y una queda vieja (B-88).
    expect(fuente('src/lib/bandejaDePropuestas.ts')).toContain("from '@/lib/enlaceSeguro'");
  });
});

describe('la fecha propuesta, que es hora de pared y no un instante', () => {
  it('se lee como la escribieron', () => {
    expect(
      fraseDeFechaPropuesta({ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }),
    ).toBe('07/10/2026 · 19:00 a 21:00');
  });

  it('sin hora de fin lo dice, en vez de inventarla', () => {
    // Las dos horas por defecto las pone la conversión, y con su aviso: la
    // bandeja muestra lo que llegó.
    expect(fraseDeFechaPropuesta({ dia: '2026-10-07', desde: '19:00', hasta: null })).toBe(
      '07/10/2026 · 19:00 (sin hora de fin)',
    );
  });

  /**
   * **La trampa 1 al revés**, y por eso se afirma sobre el fuente: lo que hay en
   * una propuesta son strings de hora de pared (D-590), así que darles un `Date`
   * para formatearlos les inventaría la zona del navegador del admin para
   * leerlos en otra. Un test de valores no lo puede mostrar —en la zona del CI
   * daría lo mismo—, y es exactamente el caso que corre una fecha un día.
   */
  it('y no pasa por `Date` en ningún momento', () => {
    expect(fuente('src/lib/bandejaDePropuestas.ts')).not.toMatch(/new Date\(/);
  });
});

/**
 * **Cuándo se borra sola, del lado de la bandeja** — B-844.
 *
 * El barrido ya no depende de que un admin apriete «rechazar»: hay documentos
 * que se van solos, y sin este aviso nadie los ve irse.
 */
describe('cuándo caduca una propuesta, para decirlo en la ficha', () => {
  const DIA = 24 * 60 * 60 * 1000;
  const AHORA = Date.parse('2026-10-10T12:00:00Z');
  const ts = (ms: number) => tsDe(new Date(ms));
  const hace = (dias: number) => ts(AHORA - dias * DIA);

  const p = (over: Record<string, unknown> = {}) =>
    ({
      estado: 'nueva',
      creadoEn: hace(1),
      revision: { porUid: null, en: null, actividadId: null, motivo: null },
      ...over,
    }) as never;

  it('cuenta los días que le quedan desde que llegó, si nadie la tocó', () => {
    expect(caducaEn(p({ creadoEn: hace(25) }), AHORA)).toBe(5);
    expect(caducaEn(p({ creadoEn: hace(1) }), AHORA)).toBe(29);
  });

  /**
   * **La misma decisión que del lado que borra: «sin tocar» no es «recién
   * llegada».** Una que un admin miró hace una semana cuenta desde ahí.
   *
   * MUTACIÓN PROBADA: haciendo que `relojDe` devuelva siempre `creadoEn` para
   * los no-rechazados, este caso se pone rojo (da 5 en vez de 83) **y** el cruce
   * contra `decidirRetencion` del final también.
   */
  it('y desde la última vez que alguien la tocó, si la tocaron', () => {
    const mirada = p({
      estado: 'en-revision',
      creadoEn: hace(85),
      revision: { en: hace(7) },
    });
    expect(caducaEn(mirada, AHORA)).toBe(23);
  });

  it('la rechazada cuenta desde el rechazo, con su plazo más corto (DEC-13)', () => {
    const r = p({ estado: 'rechazada', creadoEn: hace(200), revision: { en: hace(28) } });
    expect(caducaEn(r, AHORA)).toBe(2);
  });

  it('la aceptada no vence, así que no hay días que contar', () => {
    expect(caducaEn(p({ estado: 'aceptada', creadoEn: hace(300) }), AHORA)).toBeNull();
  });

  /**
   * El gemelo del caso de `retencion.test.ts`: acá el mismo agujero no borra
   * nada, muestra **«Se borra en NaN días»** en la ficha.
   *
   * MUTACIÓN PROBADA: volviendo al lookup pelado en `caducaEn`, esto se pone
   * rojo.
   */
  it('un estado que se llama como una clave heredada no cuenta días', () => {
    for (const estado of ['constructor', 'toString', '__proto__']) {
      expect(caducaEn(p({ estado, creadoEn: hace(300) }), AHORA), estado).toBeNull();
    }
  });

  it('y una sin fecha legible tampoco: es lo que el barrido tampoco borra', () => {
    // `creadoEn` llega en `null` en el primer snapshot local (`serverTimestamp`),
    // y esa ficha no puede mostrar una cuenta inventada.
    expect(caducaEn(p({ creadoEn: null }), AHORA)).toBeNull();
  });

  it('redondea para abajo: promete menos tiempo del que hay', () => {
    // Medio día de resto no puede leerse como un día más: el barrido corre una
    // vez por día y el error caro es decir «te queda 1» de algo que se va hoy.
    expect(caducaEn(p({ creadoEn: ts(AHORA - 29 * DIA - DIA / 2) }), AHORA)).toBe(0);
  });
});

/**
 * El aviso, que es lo que la ficha muestra. **La ventana es el precedente de
 * D-273**: un aviso en cada ficha no es trabajo pendiente, es la bandeja con un
 * cartel encima.
 */
describe('el aviso de la ficha, y por qué está apagado casi siempre', () => {
  const DIA = 24 * 60 * 60 * 1000;
  const AHORA = Date.parse('2026-10-10T12:00:00Z');
  const hace = (dias: number) => tsDe(new Date(AHORA - dias * DIA));
  const nueva = (dias: number) =>
    ({ estado: 'nueva', creadoEn: hace(dias), revision: { en: null } }) as never;

  const PLAZO = RETENCION_DIAS.nueva!;

  it('no dice nada mientras falte más que la ventana', () => {
    // Con 30 días de plazo y 7 de ventana, la ficha está limpia el 77 % del
    // tiempo — y en una bandeja que se atiende, siempre: mover una propuesta de
    // estado reinicia su reloj. Ése es el punto (D-273).
    expect(avisoDeCaducidad(nueva(1), AHORA)).toBeNull();
    expect(avisoDeCaducidad(nueva(PLAZO - AVISO_DE_CADUCIDAD_DIAS - 1), AHORA)).toBeNull();
  });

  /**
   * **El criterio de la ventana, ejecutable** — es lo que hace que la próxima
   * vez que el plazo se mueva no haya que redescubrir el argumento.
   *
   * La ventana se eligió como «más o menos un cuarto del plazo, nunca más de un
   * tercio»: por encima de eso el aviso está prendido demasiada parte de la vida
   * de cada ficha y se convierte en el cartel que D-273 rechaza. El número
   * anterior (14) fue elegido contra un plazo de 90 y **habría quedado en la
   * mitad** al bajar a 30 sin que nada fallara.
   *
   * MUTACIÓN PROBADA: dejando `AVISO_DE_CADUCIDAD_DIAS` en 14 con el plazo en
   * 30, este caso se pone rojo — que es exactamente el descuido que hubo que
   * corregir a mano esta vez.
   */
  it('la ventana no pasa de un tercio del plazo más corto (D-273)', () => {
    const masCorto = Math.min(
      ...Object.values(RETENCION_DIAS).filter((d): d is number => d !== null),
    );
    expect(AVISO_DE_CADUCIDAD_DIAS).toBeLessThanOrEqual(masCorto / 3);
    // Y el piso: más corta que el hueco entre dos visitas a la bandeja, el
    // aviso se puede perder entero. Una semana es el hueco de quien la mira los
    // lunes.
    expect(AVISO_DE_CADUCIDAD_DIAS).toBeGreaterThanOrEqual(7);
  });

  it('y avisa apenas entra en la ventana, con los días que faltan', () => {
    expect(avisoDeCaducidad(nueva(PLAZO - AVISO_DE_CADUCIDAD_DIAS), AHORA)).toBe(
      `Se borra en ${AVISO_DE_CADUCIDAD_DIAS} días`,
    );
    expect(avisoDeCaducidad(nueva(25), AHORA)).toBe('Se borra en 5 días');
  });

  /**
   * **Los tres bordes de abajo, y ahora se visitan seguido.** Con la ventana en
   * una semana, «mañana» y «hoy» son dos de sus siete días; con la hipótesis de
   * 90 eran una rareza. Y el número es la mitad útil del aviso: una propuesta
   * puede caducar antes de que nadie la haya abierto, así que «esto vence» y
   * «esto vence el jueves» son la diferencia entre llegar y no llegar.
   */
  it('el último día y el día mismo se dicen distinto, porque «en 1 días» no se dice', () => {
    expect(avisoDeCaducidad(nueva(PLAZO - 1), AHORA)).toBe('Se borra mañana');
    expect(avisoDeCaducidad(nueva(PLAZO), AHORA)).toBe('Se borra hoy');
  });

  it('y una ya vencida que todavía está no se anuncia como error', () => {
    // El barrido corre una vez por día: hasta 24 horas de ventana es normal, y
    // «se borra hoy» ya no aplica porque el momento pasó.
    expect(avisoDeCaducidad(nueva(PLAZO + 5), AHORA)).toBe('Se borra en la próxima limpieza');
  });

  it('la que no vence no avisa nunca', () => {
    expect(
      avisoDeCaducidad(
        { estado: 'aceptada', creadoEn: hace(500), revision: { en: hace(400) } } as never,
        AHORA,
      ),
    ).toBeNull();
  });
});

/**
 * **Las dos implementaciones del mismo plazo, cruzadas** — B-844.
 *
 * `caducaEn` (la bandeja) y `decidirRetencion` (la Function) contestan la misma
 * pregunta desde dos runtimes, y **no se importan**: el motivo de alcance está
 * en el docblock de `bandejaDePropuestas.ts`. Entonces la atadura es esto, y es
 * el patrón de B-364 con una vuelta más: en vez de comparar dos números, se pasa
 * una **familia de fixtures** por las dos y se exige que coincidan caso por
 * caso. Así no se separan ni los plazos, ni la tabla de estados, ni el reloj.
 *
 * La propiedad que se afirma es la que importa del lado del usuario: **la
 * bandeja nunca dice «todavía falta» de algo que el barrido de esta noche se
 * lleva, ni «se borra» de algo que el barrido conserva.**
 *
 * MUTACIÓN PROBADA: cambiando `RETENCION_DIAS.nueva` a 60 (o el reloj de un
 * lado solo), tres fixtures de la familia se ponen rojos acá y ningún otro test
 * del repo se entera — que es exactamente el agujero que este `describe` tapa.
 */
describe('la bandeja y el barrido dicen lo mismo', () => {
  const DIA = 24 * 60 * 60 * 1000;
  const AHORA = Date.parse('2026-10-10T12:00:00Z');
  /**
   * El doble compartido (B-211) sirve para las dos: la bandeja lee `toDate` (el
   * `Timestamp` del SDK de cliente) y la Function `toMillis`, y `fixtures/tiempo`
   * expone los cuatro campos de `TimestampLike`. Escribir uno acá habría sido la
   * catorceava copia, que es justo lo que `clases-de-bug.test.ts` vigila.
   */
  const hace = (dias: number) => tsDe(new Date(AHORA - dias * DIA));

  /**
   * La familia. Cubre los dos plazos, los dos relojes, la que no vence, la
   * reabierta y la ilegible — cada fila es un caso donde las dos podrían
   * separarse.
   */
  const FAMILIA: { nombre: string; doc: Record<string, unknown> }[] = [
    { nombre: 'nueva recién llegada', doc: { estado: 'nueva', creadoEn: hace(1), revision: { en: null } } },
    { nombre: 'nueva al borde', doc: { estado: 'nueva', creadoEn: hace(29), revision: { en: null } } },
    // **Justo en el borde**, que es lo único que el resto de la familia no
    // cubría: los 29/31 verifican los dos lados y no el filo. Del lado que
    // borra el corte es `ahora - reloj < plazo`, del lado que muestra es
    // `Math.floor(...) < 0`, y son dos aritméticas distintas que tienen que
    // caer del mismo lado exactamente acá. Lo señaló el `auditor-trampas`.
    { nombre: 'nueva justo en los 30', doc: { estado: 'nueva', creadoEn: hace(30), revision: { en: null } } },
    { nombre: 'rechazada justo en los 30', doc: { estado: 'rechazada', creadoEn: hace(200), revision: { en: hace(30) } } },
    { nombre: 'nueva justo vencida', doc: { estado: 'nueva', creadoEn: hace(31), revision: { en: null } } },
    { nombre: 'nueva muy vieja', doc: { estado: 'nueva', creadoEn: hace(400), revision: { en: null } } },
    { nombre: 'en-revision mirada ayer', doc: { estado: 'en-revision', creadoEn: hace(200), revision: { en: hace(1) } } },
    { nombre: 'en-revision abandonada', doc: { estado: 'en-revision', creadoEn: hace(200), revision: { en: hace(120) } } },
    { nombre: 'reabierta hoy', doc: { estado: 'nueva', creadoEn: hace(180), revision: { en: hace(0) } } },
    { nombre: 'rechazada de ayer', doc: { estado: 'rechazada', creadoEn: hace(200), revision: { en: hace(1) } } },
    { nombre: 'rechazada vencida', doc: { estado: 'rechazada', creadoEn: hace(200), revision: { en: hace(31) } } },
    { nombre: 'rechazada sin fecha', doc: { estado: 'rechazada', creadoEn: hace(200), revision: { en: null } } },
    { nombre: 'aceptada vieja', doc: { estado: 'aceptada', creadoEn: hace(400), revision: { en: hace(300) } } },
    { nombre: 'sin ninguna fecha', doc: { estado: 'nueva', creadoEn: null, revision: { en: null } } },
  ];

  it('coinciden caso por caso: lo que la ficha promete es lo que el barrido hace', () => {
    for (const { nombre, doc } of FAMILIA) {
      const { aBorrar } = decidirRetencion({
        propuestas: [{ id: 'p1', ...doc }],
        ahora: AHORA,
      });
      const laBorra = aBorrar.length === 1;

      const dias = caducaEn(doc as never, AHORA);
      /*
       * La bandeja dice «se la lleva» cuando la cuenta llegó a cero o menos:
       * `0` es «se borra hoy» —el barrido de esta noche se la lleva— y negativo
       * es «ya venció». `null` es «no vence o no se puede fechar», y el barrido
       * tampoco borra.
       */
      const laDaPorIda = dias !== null && dias <= 0;

      expect(laDaPorIda, `${nombre}: la ficha dice ${dias} y el barrido ${laBorra}`).toBe(laBorra);
    }
  });

  it('y la familia ejercita las dos respuestas, no una sola', () => {
    // Control positivo: si todos los fixtures cayeran del mismo lado, el caso de
    // arriba pasaría sin comparar nada.
    const borradas = FAMILIA.filter(
      ({ doc }) =>
        decidirRetencion({ propuestas: [{ id: 'p1', ...doc }], ahora: AHORA }).aBorrar.length === 1,
    ).length;
    expect(borradas).toBeGreaterThan(0);
    expect(borradas).toBeLessThan(FAMILIA.length);
  });

  it('y los plazos son el mismo número de los dos lados', () => {
    // El aserto directo, además del cruce: dice **cuál** de las dos se movió,
    // que el cruce por fixtures no distingue.
    for (const [estado, ms] of Object.entries(RETENCION_POR_ESTADO)) {
      const dias = RETENCION_DIAS[estado as keyof typeof RETENCION_DIAS];
      expect(dias === null ? null : dias * 24 * 60 * 60 * 1000, estado).toEqual(ms);
    }
    // Y las dos tablas nombran los mismos estados.
    expect(Object.keys(RETENCION_DIAS).sort()).toEqual(Object.keys(RETENCION_POR_ESTADO).sort());
  });
});
