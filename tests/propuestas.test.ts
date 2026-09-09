/**
 * La propuesta, del lado puro — B-830.
 *
 * Acá vive lo que se puede probar sin emuladores: el schema de zod, el armado
 * del documento, y **las ataduras con `firestore.rules`**, que son las que
 * importan más.
 *
 * ── Por qué las ataduras son el corazón de este archivo ───────────────────
 * Del otro lado del formulario público hay un anónimo, así que el schema de zod
 * **no es la defensa**: se saltea con un `curl`. La defensa es la regla. Los dos
 * dicen los mismos números, y un documento que pase por el schema y no por la
 * regla **no se guarda** — con el formulario diciendo que sí. Es la clase de B-88
 * en el peor lugar posible.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * el único modo de atarlo es un test que lea el archivo y compare. Es el patrón
 * de `TOPE_TITULO_REPORTE` (B-364), acá aplicado a **diez** números y cuatro
 * vocabularios.
 *
 * **Y hay una cosa que los dos lados NO comparten**, que también se afirma acá:
 * la forma de cada fecha. Una regla no itera una lista, así que eso vive solo en
 * el schema — ver el caso que lo dice, y por qué es aceptable.
 *
 * Las reglas contra el emulador —qué rechaza cada cláusula, verificado por
 * mutación— están en `tests/propuestas.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RE_DIA, RE_HORA, diaReal, formAPropuesta, propuestaFormSchema, propuestaVacia } from '@/lib/propuesta-schema';
import {
  ARANCELES_PROPUESTA,
  ESTADOS_PROPUESTA,
  MAX_FECHAS_PROPUESTA,
  MAX_INCLUYE_PROPUESTA,
  MODALIDADES_PROPUESTA,
  TOPE_CONTACTO_PROPUESTA,
  TOPE_CORTO_PROPUESTA,
  TOPE_DESCRIPCION_PROPUESTA,
  TOPE_INCLUYE_OTRO_PROPUESTA,
  TOPE_INSCRIPCION_PROPUESTA,
  TOPE_MOTIVO_PROPUESTA,
  TOPE_TITULO_PROPUESTA,
  TOPE_URL_PROPUESTA,
  VIAS_CONTACTO_PROPUESTA,
} from '@/types/propuesta';
import type { PropuestaForm } from '@/types/propuesta';

const REGLAS = readFileSync(
  fileURLToPath(new URL('../firestore.rules', import.meta.url)),
  'utf8',
);

/** El cuerpo de `propuestaValida()` y sus tres helpers, que es donde hay que mirar. */
const bloqueDePropuestas = (): string => {
  const i = REGLAS.indexOf('function fechasValidas(');
  const j = REGLAS.indexOf('match /{document=**}');
  if (i === -1 || j === -1 || j <= i) {
    throw new Error('no se encontró el bloque de /propuestas en firestore.rules');
  }
  return REGLAS.slice(i, j);
};

const form = (over: Partial<PropuestaForm> = {}): PropuestaForm => ({
  ...propuestaVacia(),
  titulo: 'Taller de crónica urbana',
  descripcion: 'Cuatro encuentros para escribir crónica, con lecturas y consignas.',
  fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }],
  lugar: { nombre: 'Casa Brandon', direccion: 'Luis María Drago 236', barrio: 'villa-crespo' },
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon' },
  contacto: { via: 'mail', valor: 'hola@casabrandon.test' },
  ...over,
});

const valida = (over: Partial<PropuestaForm> = {}) => propuestaFormSchema.safeParse(form(over));
const rutas = (r: ReturnType<typeof valida>): string[] =>
  r.success ? [] : r.error.issues.map((i) => i.path.join('.'));

describe('los topes se dicen en dos runtimes y son el mismo número (B-364, clase de B-88)', () => {
  it('el bloque de la regla existe y tiene contenido', () => {
    // Control positivo: si el recorte fallara, los casos de abajo compararían
    // contra una cadena vacía y `toContain` sería falso para todo — o peor,
    // pasarían si alguien los escribiera al revés.
    const bloque = bloqueDePropuestas();
    expect(bloque.length).toBeGreaterThan(1000);
    expect(bloque).toContain('function propuestaValida()');
  });

  /**
   * Cada par es `[número del modelo, cómo aparece en la regla]`. La regla escribe
   * el literal porque no puede importar nada, así que lo que se compara es el
   * texto — y por eso el segundo elemento incluye el campo: `<= 200` suelto
   * aparece siete veces y no diría de cuál es.
   */
  it.each([
    [TOPE_TITULO_PROPUESTA, 'd.titulo.size() <= 120'],
    [TOPE_DESCRIPCION_PROPUESTA, 'd.descripcion.size() <= 4000'],
    [TOPE_CORTO_PROPUESTA, 'd.organizador.nombre.size() <= 200'],
    [TOPE_INCLUYE_OTRO_PROPUESTA, 'd.incluyeOtro.size() <= 200'],
    [TOPE_INSCRIPCION_PROPUESTA, 'd.inscripcion.comoDice.size() <= 500'],
    [TOPE_CONTACTO_PROPUESTA, 'd.contacto.valor.size() <= 200'],
    [TOPE_URL_PROPUESTA, "imagen.get('url', '').size() <= 500"],
    [TOPE_MOTIVO_PROPUESTA, 'd.revision.motivo.size() <= 500'],
  ])('el tope %i está escrito igual en la regla', (tope, enLaRegla) => {
    // El número del modelo tiene que ser el que la regla escribe: si alguien
    // sube el tope de un lado, este caso nombra cuál quedó atrás.
    expect(enLaRegla).toContain(String(tope));
    expect(bloqueDePropuestas()).toContain(enLaRegla);
  });

  it('los máximos de las dos listas también', () => {
    expect(bloqueDePropuestas()).toContain(`fechas.size() <= ${MAX_FECHAS_PROPUESTA}`);
    expect(bloqueDePropuestas()).toContain(`d.incluye.size() <= ${MAX_INCLUYE_PROPUESTA}`);
  });

  it('y los cuatro vocabularios', () => {
    const bloque = bloqueDePropuestas();
    const comoLista = (xs: readonly string[]) => `[${xs.map((x) => `'${x}'`).join(', ')}]`;
    expect(bloque, 'las modalidades').toContain(comoLista(MODALIDADES_PROPUESTA));
    expect(bloque, 'los aranceles').toContain(comoLista(ARANCELES_PROPUESTA));
    expect(bloque, 'las vías de contacto').toContain(comoLista(VIAS_CONTACTO_PROPUESTA));
    expect(bloque, 'los estados').toContain(comoLista(ESTADOS_PROPUESTA));
  });

  /**
   * **La asimetría que hay que conocer: la forma de cada fecha la valida el
   * schema y NO la regla.**
   *
   * Una regla de Firestore **no itera una lista**, así que de `fechas` se puede
   * acotar la cantidad (1–12) y el tipo, y no la forma de cada fila. O sea que un
   * `curl` puede mandar doce mapas arbitrarios ahí adentro, con strings tan
   * largos como el tope de 1 MB del documento permita.
   *
   * **Qué lo hace aceptable, y conviene tenerlo escrito y no supuesto:** nada de
   * una propuesta llega a una salida pública sin que un admin la convierta en
   * actividad, y esa conversión pasa por `actividadFormSchema`. El daño posible es
   * «el admin ve una fila rara en la bandeja», no un dato publicado. Si aparece
   * abuso, la defensa que falta es del lado de una Function y no de la regla —
   * anotado en el backlog.
   *
   * Este caso afirma la asimetría en vez de fingir que no está. La primera
   * versión afirmaba que la regla repetía las dos expresiones: era **falso** y se
   * leía como una garantía.
   */
  it('la forma de cada fecha vive SOLO en el schema, y la regla no la puede validar', () => {
    const bloque = bloqueDePropuestas();
    // Las expresiones existen y son las que el schema usa.
    expect(new RegExp(RE_DIA).test('2026-10-07')).toBe(true);
    expect(new RegExp(RE_HORA).test('19:00')).toBe(true);
    // Y la regla NO las tiene: si alguien las agrega, esto se pone rojo y hay que
    // venir a decidir qué quedó cubierto y qué no.
    expect(bloque, 'la regla empezó a validar la forma del día').not.toContain('matches');
    // Lo que la regla sí acota de `fechas` es la cantidad y el tipo.
    expect(bloque).toContain('fechas is list');
    expect(bloque).toContain('fechas.size() >= 1');
  });
});

describe('los aranceles del formulario público son los tres `fijo: true`, y nada más (§4.2)', () => {
  /**
   * La lista está escrita a mano en `types/propuesta.ts` a propósito: derivarla
   * de `opciones-base.json` haría que una cuarta opción base **ensanche sola** lo
   * que un anónimo puede mandar. Este caso la ata en las dos direcciones, así que
   * la cuarta pone el test en rojo y alguien decide.
   */
  const base = JSON.parse(readFileSync('src/lib/opciones-base.json', 'utf8')) as Record<
    string,
    { slug: string; fijo: boolean }[]
  >;
  const fijos = base.arancel!.filter((v) => v.fijo).map((v) => v.slug);

  it('son exactamente los `fijo: true` de la taxonomía', () => {
    expect([...ARANCELES_PROPUESTA].sort()).toEqual([...fijos].sort());
  });

  it('y no hay ninguno de más, que es el sentido de la lista', () => {
    // Si mañana aparece un quinto `fijo: true`, el caso de arriba se pone rojo y
    // hay que decidir si el formulario público lo ofrece. Este es el control
    // positivo de que la taxonomía tiene de dónde sacar la comparación.
    expect(fijos.length).toBeGreaterThan(2);
    expect(fijos).toContain('a-la-gorra');
  });
});

describe('el schema — lo que la persona ve antes de mandar', () => {
  it('acepta la propuesta completa', () => {
    const r = valida();
    expect(rutas(r)).toEqual([]);
  });

  it('pide título, descripción, quién organiza y cómo contactarlo', () => {
    expect(rutas(valida({ titulo: 'corto' }))).toContain('titulo');
    expect(rutas(valida({ descripcion: 'poco' }))).toContain('descripcion');
    expect(rutas(valida({ organizador: { nombre: '', instagram: '' } }))).toContain(
      'organizador.nombre',
    );
    expect(rutas(valida({ contacto: { via: 'mail', valor: '' } }))).toContain('contacto.valor');
  });

  it('pide al menos una fecha, y no más de doce', () => {
    expect(rutas(valida({ fechas: [] }))).toContain('fechas');
    const trece = Array.from({ length: 13 }, () => ({
      dia: '2026-10-07',
      desde: '19:00',
      hasta: '',
    }));
    expect(rutas(valida({ fechas: trece }))).toContain('fechas');
  });

  it('rechaza la forma de la fecha y de la hora', () => {
    expect(rutas(valida({ fechas: [{ dia: '7/10/2026', desde: '19:00', hasta: '' }] }))).toContain(
      'fechas.0.dia',
    );
    expect(rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '7pm', hasta: '' }] }))).toContain(
      'fechas.0.desde',
    );
    // 24:00 no existe en un reloj de 24 horas, y `[01]\d|2[0-3]` es lo que lo dice.
    expect(
      rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '24:00', hasta: '' }] })),
    ).toContain('fechas.0.desde');
  });

  /**
   * **La fecha que no existe**, que es lo único de las fechas que el schema
   * verifica y la regla no puede: `2026-02-31` pasa el `matches` de los dos
   * lados. Se avisa acá, que es donde hay alguien mirando la pantalla.
   */
  it('rechaza el 31 de febrero, que la regla no puede ver', () => {
    expect(diaReal('2026-02-31')).toBe(false);
    expect(diaReal('2026-02-28')).toBe(true);
    // Bisiesto, que es el caso donde una implementación a ojo se equivoca.
    expect(diaReal('2028-02-29')).toBe(true);
    expect(diaReal('2026-02-29')).toBe(false);
    expect(diaReal('2026-13-01')).toBe(false);
    expect(rutas(valida({ fechas: [{ dia: '2026-02-31', desde: '19:00', hasta: '' }] }))).toContain(
      'fechas.0.dia',
    );
  });

  it('rechaza el fin antes del inicio', () => {
    expect(
      rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '21:00', hasta: '19:00' }] })),
    ).toContain('fechas.0.hasta');
    // Igual tampoco: una actividad de duración cero no es una actividad.
    expect(
      rutas(valida({ fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '19:00' }] })),
    ).toContain('fechas.0.hasta');
  });

  it('pide el lugar salvo que sea virtual, y alcanza con uno de los dos datos', () => {
    const sinLugar = { nombre: '', direccion: '', barrio: '' };
    expect(rutas(valida({ lugar: sinLugar }))).toContain('lugar.nombre');
    expect(rutas(valida({ modalidad: 'virtual', lugar: sinLugar }))).toEqual([]);
    // Con el nombre solo, o con la dirección sola, alcanza: quien propone no
    // siempre sabe la dirección exacta, y el admin la completa.
    expect(rutas(valida({ lugar: { ...sinLugar, nombre: 'Casa Brandon' } }))).toEqual([]);
    expect(rutas(valida({ lugar: { ...sinLugar, direccion: 'Aráoz 32' } }))).toEqual([]);
  });

  it('si pide inscripción, pide cómo se anota la gente', () => {
    expect(
      rutas(valida({ inscripcion: { requiere: true, comoDice: '' } })),
    ).toContain('inscripcion.comoDice');
    expect(rutas(valida({ inscripcion: { requiere: false, comoDice: '' } }))).toEqual([]);
  });
});

describe('form → documento', () => {
  it('recorta y pasa lo opcional vacío a `null`, no a `\'\'`', () => {
    // Una sola forma de vacío, para que la regla pueda exigir `== null` en vez
    // de aceptar dos. Es el criterio de `formAReporte`.
    const d = formAPropuesta(
      form({
        titulo: '  Taller de crónica urbana  ',
        organizador: { nombre: ' Casa Brandon ', instagram: '   ' },
        arancel: { tipo: 'gratis', notas: '  ' },
        incluyeOtro: '   ',
        imagenUrl: '  ',
      }),
    );
    expect(d.titulo).toBe('Taller de crónica urbana');
    expect(d.organizador.nombre).toBe('Casa Brandon');
    expect(d.organizador.instagram).toBeNull();
    expect(d.arancel.notas).toBeNull();
    expect(d.incluyeOtro).toBeNull();
    expect(d.imagen).toBeNull();
  });

  it('nace con el estado y la revisión que la regla exige', () => {
    const d = formAPropuesta(form());
    expect(d.estado).toBe('nueva');
    expect(d.revision).toEqual({ porUid: null, en: null, actividadId: null, motivo: null });
    expect(d.origen).toBe('formulario-publico');
  });

  it('descarta el lugar si es virtual, y el «cómo se anota» si no pide inscripción', () => {
    // Si la modalidad o la casilla cambiaron a mitad de camino, no se cuela lo
    // que ya no aplica — el criterio de `formAReporte` con los pasos.
    expect(formAPropuesta(form({ modalidad: 'virtual' })).lugar).toBeNull();
    expect(
      formAPropuesta(form({ inscripcion: { requiere: false, comoDice: 'por DM' } }))
        .inscripcion.comoDice,
    ).toBeNull();
  });

  it('`hasta` vacío es `null`, no `\'\'`', () => {
    const d = formAPropuesta(form({ fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '' }] }));
    expect(d.fechas[0]!.hasta).toBeNull();
  });

  it('la URL pegada entra como `{ url }`, que es una de las dos formas (DEC-11)', () => {
    const d = formAPropuesta(form({ imagenUrl: ' https://x.test/flyer.jpg ' }));
    expect(d.imagen).toEqual({ url: 'https://x.test/flyer.jpg' });
    // **Una sola clave**: la regla rechaza el mapa con las dos.
    expect(Object.keys(d.imagen as object)).toEqual(['url']);
  });

  it('no emite `creadoEn`: lo pone la capa que escribe, con `request.time`', () => {
    // Si el armado lo emitiera, el cliente podría antedatar la propuesta y la
    // regla lo rechazaría — con el formulario diciendo que se mandó.
    expect(Object.prototype.hasOwnProperty.call(formAPropuesta(form()), 'creadoEn')).toBe(false);
  });
});
