import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SIN_COSTO } from '@/lib/arancel';
import { ETIQUETA_MODALIDAD } from '@/lib/filtrosActividades';
import { datosDeTarjeta, type TarjetaDelPanel } from '@/lib/tarjetaDelPanel';
import type { ActividadConId, Imagen, ModalidadFila, Sesion } from '@/types/actividad';
import {
  CENTINELA,
  LABELS_CENTINELA,
  RUTAS_CENTINELA,
  actividadCentinela,
} from './fixtures/centinelas';
import { ts } from './fixtures/tiempo';

/**
 * Qué dice una tarjeta del listado del panel — B-620.
 *
 * Antes de B-620 estas siete decisiones eran cadenas de ternarios adentro del
 * JSX de `ListaActividades.tsx`, o sea que no había manera de verificarlas: el
 * panel no tiene tests de render salvo para el cableado de DOM
 * (`docs/05-patrones.md`). El pase de fila a tarjeta las sacó a un módulo puro
 * y esto es lo que las cubre.
 *
 * El último bloque es el chequeo **de clase**: los campos del view-model se leen
 * del fuente del módulo y se exige que la tarjeta consuma cada uno. Sin él,
 * agregar un campo y olvidarse de pintarlo deja el build en verde y el dato
 * afuera de la pantalla, que es justo el bug que este frente venía a arreglar.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const sesion = (inicio: string, over: Partial<Sesion> = {}): Sesion =>
  ({
    id: `ses_${inicio}`,
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    ...over,
    inicio: ts(inicio),
    // Dos horas de duración: con `fin === inicio` el criterio «ya pasó» se
    // vuelve indetectable, que es la lección del fixture de B-84.
    fin: over.fin ?? ts(inicio.replace(/T(\d{2})/, (_, h) => `T${String(Number(h) + 2).padStart(2, '0')}`)),
  }) as unknown as Sesion;

const sedeEn = (barrio: string) => ({
  nombre: 'Casa Brandon',
  direccion: 'Luis María Drago 236',
  barrio,
  ciudad: 'CABA',
  indicaciones: '',
  geo: null,
});

const fila = (modalidad: ModalidadFila['modalidad'], barrio?: string) =>
  ({
    id: `mod_${modalidad}_${barrio ?? ''}`,
    modalidad,
    inicio: null,
    fin: null,
    sede: barrio ? sedeEn(barrio) : null,
    online: null,
  }) as unknown as ModalidadFila;

const acto = (over: Partial<ActividadConId> = {}): ActividadConId =>
  ({
    id: 'act',
    titulo: 'Taller de crónica breve',
    tipo: 'taller',
    estado: 'publicado',
    modalidad: 'presencial',
    modalidades: [fila('presencial')],
    sede: null,
    online: null,
    sesiones: [],
    imagenes: [{ id: 'img_1', url: 'https://x/y.jpg', epigrafe: '', origen: 'externa', portada: true } as Imagen],
    arancel: { tipo: 'gratis', notas: '' },
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    createdBy: 'uid-propio',
    updatedAt: ts('2026-08-01T12:00:00Z'),
    searchText: '',
    ...over,
  }) as unknown as ActividadConId;

const ahora = new Date('2026-09-05T12:00:00Z');

const CONTEXTO = {
  labels: {
    tipo: { taller: 'Taller', 'club-lectura': 'Club de lectura' },
    barrio: { 'villa-crespo': 'Villa Crespo' },
    arancel: { gratis: 'Gratis', arancelado: 'Arancelado' },
  },
  ahora,
  uid: 'uid-propio',
};

const de = (over: Partial<ActividadConId> = {}, ctx = CONTEXTO): TarjetaDelPanel =>
  datosDeTarjeta(acto(over), ctx);

// ─────────────────────────────────────────────────────────────────
// Identidad: qué es y cuánto dura
// ─────────────────────────────────────────────────────────────────

describe('la identidad de la tarjeta (§4.1)', () => {
  it('dice la etiqueta del tipo, nunca el valor guardado', () => {
    // El bug de B-76 con otra cara: en el panel «club-lectura» se lee «Club de
    // lectura».
    expect(de({ tipo: 'club-lectura' } as Partial<ActividadConId>).identidad[0]).toBe(
      'Club de lectura',
    );
  });

  it('y si la etiqueta no está cargada todavía, des-sluguea en vez de mostrar el slug', () => {
    // El respaldo es el `desSlug` de `@calendario`, el mismo que usan la
    // descripción del evento y los desplegables (D-20): imperfecto a propósito
    // —«Club Lectura» y no «Club de lectura»— pero nunca el slug crudo, que es
    // lo que este caso existe para impedir.
    const t = datosDeTarjeta(acto({ tipo: 'club-lectura' } as Partial<ActividadConId>), {
      ...CONTEXTO,
      labels: {},
    });
    expect(t.identidad[0]).toBe('Club Lectura');
  });

  it('cuenta los encuentros en singular y en plural', () => {
    expect(de({ sesiones: [] }).identidad[1]).toBe('0 encuentros');
    expect(de({ sesiones: [sesion('2026-09-10T22:00:00Z')] }).identidad[1]).toBe('1 encuentro');
    expect(
      de({ sesiones: [sesion('2026-09-10T22:00:00Z'), sesion('2026-09-17T22:00:00Z')] })
        .identidad[1],
    ).toBe('2 encuentros');
  });

  it('una pieza vacía no viaja: el componente une con «·» sin preguntar', () => {
    // Un documento a medio crear puede no tener `tipo`, y ahí la etiqueta sale
    // vacía. Si viajara, la línea empezaría con un separador colgado.
    // `as unknown as` y no un cast directo: el `tipo` vacío **no** es un valor
    // válido del enum, y eso es justo el caso — un documento a medio crear.
    const t = de({ tipo: '' } as unknown as Partial<ActividadConId>);
    expect(t.identidad).toEqual(['0 encuentros']);
    expect(t.identidad.join(' · ').startsWith('·')).toBe(false);
  });

  it('un documento sin `sesiones` no rompe la tarjeta', () => {
    // Default de lectura: un documento a medio crear no puede tirar el listado
    // entero abajo.
    expect(de({ sesiones: undefined as unknown as Sesion[] }).identidad[1]).toBe('0 encuentros');
  });
});

// ─────────────────────────────────────────────────────────────────
// Dónde y cómo se cursa — el dato que la fila no decía (B-620)
// ─────────────────────────────────────────────────────────────────

describe('dónde y cómo se cursa (B-224)', () => {
  it('con una sola forma de cursar dice esa', () => {
    expect(de().donde).toEqual([ETIQUETA_MODALIDAD.presencial]);
  });

  it('con una fila presencial y otra virtual dice la resultante, no la de la primera fila', () => {
    /*
     * Es la mitad importante: «la primera fila manda» dependería del orden del
     * array —la trampa 2 en otra forma— así que reordenar las filas en el
     * formulario cambiaría lo que dice el listado. Las dos direcciones se
     * prueban para que un `[0]` accidental no pase por casualidad.
     */
    const filas = [fila('presencial', 'villa-crespo'), fila('virtual')];
    expect(de({ modalidades: filas }).donde[0]).toBe(ETIQUETA_MODALIDAD.hibrido);
    expect(de({ modalidades: [...filas].reverse() }).donde[0]).toBe(ETIQUETA_MODALIDAD.hibrido);
  });

  it('lee la modalidad de primer nivel cuando el documento no trae la lista', () => {
    const t = de({
      modalidades: undefined as unknown as ModalidadFila[],
      modalidad: 'virtual',
    });
    expect(t.donde[0]).toBe(ETIQUETA_MODALIDAD.virtual);
  });

  it('agrega el barrio con su etiqueta, y no lo agrega si no hay sede', () => {
    expect(de({ sede: sedeEn('villa-crespo') }).donde).toEqual([
      ETIQUETA_MODALIDAD.presencial,
      'Villa Crespo',
    ]);
    // Una actividad solo virtual no tiene barrio: la lista trae una sola pieza y
    // el componente nunca pinta un `·` colgado.
    expect(de({ sede: null }).donde).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// Arancel — el otro dato que la fila no decía
// ─────────────────────────────────────────────────────────────────

describe('el arancel (D-152)', () => {
  it('muestra la etiqueta cargada, no el slug', () => {
    expect(de().arancel).toBe('Gratis');
    expect(de({ arancel: { tipo: 'arancelado', notas: '' } }).arancel).toBe('Arancelado');
  });

  it('los dos que no se pagan vienen marcados, y los demás no', () => {
    for (const slug of SIN_COSTO) {
      expect(de({ arancel: { tipo: slug, notas: '' } }).sinCosto, slug).toBe(true);
    }
    expect(de({ arancel: { tipo: 'arancelado', notas: '' } }).sinCosto).toBe(false);
  });

  it('sin arancel cargado no dice nada, y no dice «gratis» por omisión', () => {
    // La dirección importa: un documento viejo sin el campo no puede leerse como
    // gratuito, que es afirmar de más sobre el precio de algo ajeno.
    const t = de({ arancel: undefined as unknown as ActividadConId['arancel'] });
    expect(t.arancel).toBe('');
    expect(t.sinCosto).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Cuándo
// ─────────────────────────────────────────────────────────────────

describe('cuándo es lo próximo (B-96)', () => {
  it('nombra el primer encuentro que no terminó', () => {
    const t = de({
      sesiones: [sesion('2026-09-20T22:00:00Z'), sesion('2026-09-10T22:00:00Z')],
    });
    expect(t.hayProximo).toBe(true);
    expect(t.cuando).toMatch(/^Próximo: /);
    // La fecha se lee en la zona del proyecto: 22:00Z del 10 es el 10 a las 19.
    expect(t.cuando).toContain('19:00');
  });

  it('lo que no tiene nada por venir lo dice, y queda marcado para apagarlo', () => {
    const t = de({ sesiones: [sesion('2026-08-01T22:00:00Z')] });
    expect(t.hayProximo).toBe(false);
    expect(t.cuando).toBe('Sin encuentros por venir');
  });

  it('un ciclo entero cancelado no tiene nada por venir', () => {
    const t = de({
      sesiones: [
        sesion('2026-09-10T22:00:00Z', { cancelada: true }),
        sesion('2026-09-17T22:00:00Z', { cancelada: true }),
      ],
    });
    expect(t.hayProximo).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Marcas y autoría
// ─────────────────────────────────────────────────────────────────

describe('las marcas de la tarjeta', () => {
  it('el caso normal no lleva ninguna: si todo llevara marca, la marca dejaría de avisar', () => {
    expect(de().marcas).toEqual([]);
  });

  it('«Cupo completo» cuando se prendió desde el menú (B-97)', () => {
    const inscripcion = { requiere: true, via: null, destino: '', cupo: 8, cierra: null, completo: true };
    expect(de({ inscripcion } as Partial<ActividadConId>).marcas).toContain('Cupo completo');
  });

  it('«Sin flyer» solo en las publicadas que no tienen imagen (B-264)', () => {
    const sinImagen = { imagenes: [] as Imagen[] };
    expect(de({ ...sinImagen, estado: 'publicado' }).marcas).toContain('Sin flyer');
    // Un borrador sin flyer no le falta nada todavía; una publicada sin flyer ya
    // está afuera de la cartelera.
    for (const estado of ['borrador', 'pendiente', 'cancelado'] as const) {
      expect(de({ ...sinImagen, estado }).marcas, estado).not.toContain('Sin flyer');
    }
    // Y con imagen no aparece nunca.
    expect(de({ estado: 'publicado' }).marcas).not.toContain('Sin flyer');
  });

  it('una publicada sin flyer y con cupo lleno lleva las dos', () => {
    const t = de({
      estado: 'publicado',
      imagenes: [],
      inscripcion: { requiere: true, via: null, destino: '', cupo: 8, cierra: null, completo: true },
    } as Partial<ActividadConId>);
    expect(t.marcas).toEqual(['Cupo completo', 'Sin flyer']);
  });

  it('lo propio no se marca y lo ajeno sí (B-130)', () => {
    expect(de({ createdBy: 'uid-propio' }).autoria).toBeNull();
    expect(de({ createdBy: 'otra-cuenta' }).autoria).toBe('La cargó otra cuenta');
    // Un documento anterior a que se escribiera `createdBy` no se marca como
    // ajeno: afirmar de más sobre datos viejos es peor que no decir nada.
    expect(de({ createdBy: '' }).autoria).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// La clase: ningún campo del view-model se queda sin pintar
// ─────────────────────────────────────────────────────────────────

describe('la tarjeta consume todo lo que el módulo decide (B-620)', () => {
  const MODULO = readFileSync(raiz('src/lib/tarjetaDelPanel.ts'), 'utf8');
  const LISTADO = readFileSync(raiz('src/components/admin/ListaActividades.tsx'), 'utf8');

  /**
   * Los campos se derivan del fuente y no se mantienen a mano, que es la
   * propiedad 1 de un chequeo de clase (`docs/05-patrones.md`): el campo que se
   * agregue mañana entra solo.
   */
  const campos = (): string[] => {
    const bloque = /export interface TarjetaDelPanel \{([\s\S]*?)\n\}/.exec(MODULO);
    expect(bloque?.[1], 'se renombró `TarjetaDelPanel`').toBeTruthy();
    return [...bloque![1]!.matchAll(/^ {2}(\w+)[?]?:/gm)].map((m) => m[1]!);
  };

  it('el fuente declara los ocho campos que la tarjeta pinta', () => {
    // Si este número baja, algo se dejó de decidir acá y hay que verificar que
    // no volvió a ser un ternario adentro del JSX.
    expect(campos()).toHaveLength(8);
  });

  it('cada campo aparece en el JSX del listado', () => {
    for (const campo of campos()) {
      expect(LISTADO, `la tarjeta no pinta \`${campo}\``).toContain(`.${campo}`);
    }
  });

  it('y el listado no volvió a decidir por su cuenta lo que este módulo decide', () => {
    // Los tres textos que eran ternarios en el JSX: si reaparecen literales en
    // el componente, hay dos derivaciones de la misma frase (la clase B-88).
    const sinComentarios = LISTADO.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(
      /^\s*\/\/.*$/gm,
      '',
    );
    for (const frase of ['Sin encuentros por venir', 'Cupo completo', 'Sin flyer']) {
      expect(sinComentarios, frase).not.toContain(frase);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Privacidad: el módulo recibe el documento crudo (§5.1, trampa 5)
// ─────────────────────────────────────────────────────────────────

/**
 * El barrido de centinelas del view-model del panel — lo pidió el
 * `auditor-privacidad` sobre B-620.
 *
 * **Hoy no se filtra nada**, y el riesgo es de la clase «se filtra en el próximo
 * cambio»: este es el único módulo de `src/lib/` que a la vez recibe el
 * documento **crudo** y produce strings de pantalla. Su contraparte pública,
 * `tarjetaPublica.ts`, recibe una entrada ya proyectada justamente para no poder
 * publicar lo que `toPublic` no publicó (D-140), y acá esa barrera no existe
 * porque quien mira el panel es un admin.
 *
 * El criterio del repo que aplica es el otro: «si la salida se arma
 * interpolando texto, tiene que existir un barrido de centinelas». Va en el test
 * del módulo y **no** en `tests/barrido-de-salidas-publicas.test.ts`: el panel no
 * es una de las doce salidas, y sumarle una fila rompería la cuenta que
 * `tests/agentes-y-skills.test.ts` compara entre el agente, `07-seguridad.md` y
 * el skill `campo-nuevo` — y borraría el límite panel/público, que es lo que hace
 * que esa tabla signifique algo.
 */
describe('ningún campo interno del documento llega al view-model (§5.1, trampa 5)', () => {
  /**
   * Los tres centinelas que **sí** sobreviven, y por qué: son las **etiquetas**
   * de las tres taxonomías que la tarjeta muestra —tipo, barrio y arancel—, o
   * sea `/opciones/*`, que es de lectura pública (§5.3) y ya viaja en el
   * `events.json` (§4.4). Los tres slugs crudos **no** sobreviven, que es lo que
   * exige el §4.1.
   */
  const PERMITIDOS: readonly string[] = ['labels.tipo', 'labels.barrio', 'labels.arancel'];

  const salida = (): string =>
    JSON.stringify(
      datosDeTarjeta(actividadCentinela() as unknown as ActividadConId, {
        labels: LABELS_CENTINELA,
        ahora: new Date('2026-09-05T12:00:00Z'),
        // A propósito distinto de `createdBy`: así el camino de B-130 se ejercita
        // en su rama «ajena», que es la que produce texto.
        uid: 'otra-cuenta-cualquiera',
      }),
    );

  it('sobreviven exactamente las tres etiquetas de taxonomía, y nada más', () => {
    const json = salida();
    const sobrevivientes = RUTAS_CENTINELA.filter((r) => json.includes(CENTINELA[r]!));
    expect([...sobrevivientes].sort()).toEqual([...PERMITIDOS].sort());
  });

  it('y en particular no llegan el link de la reunión, lo interno ni los uids', () => {
    /*
     * Redundante con el aserto de arriba a propósito: nombra los campos que el
     * §5.1 marca uno por uno, así el mensaje de falla dice **qué** se escapó sin
     * que haya que leer la lista completa. Es la mitad que se lee cuando el test
     * se pone rojo.
     */
    const json = salida();
    for (const ruta of [
      'online.url',
      'difusion.notas',
      'difusion.arrobar',
      'inscripcion.destino',
      'createdBy',
      'updatedBy',
      'imagenes.storagePath',
      'searchText',
      'material.url.privado',
      'arancel.notas',
    ] as const) {
      expect(json, `se escapó ${ruta}`).not.toContain(CENTINELA[ruta]!);
    }
  });

  it('el control negativo: el barrido detecta el documento entero volcado en la salida', () => {
    // Sin esto, un `sobrevivientes` vacío por un `includes` roto se leería como
    // «no se filtra nada». Se afirma que la técnica ve la fuga más burda.
    const crudo = JSON.stringify(actividadCentinela());
    const detectados = RUTAS_CENTINELA.filter((r) => crudo.includes(CENTINELA[r]!));
    expect(detectados).toContain('online.url');
    expect(detectados.length).toBeGreaterThan(PERMITIDOS.length);
  });

  it('ninguna salida pública importa `tarjetaDelPanel`', () => {
    /*
     * La otra mitad de la barrera, y la que de verdad se puede romper: lo que
     * este módulo calcula —modalidad resultante, etiqueta de arancel, próximo
     * encuentro— es exactamente lo que la tarjeta del sitio necesita, así que
     * reusarlo desde un productor público es la tentación probable. Si eso pasara
     * se publicaría `autoria`, o sea cuántas cuentas cargan y qué cargó cada una
     * (D-57, D-138), **sin ningún campo nuevo del modelo** que lo delate.
     *
     * Quién puede importarlo se deriva de la ruta y no se mantiene a mano: el
     * panel, y nada más.
     */
    const rastreados = execFileSync('git', ['ls-files', 'src', 'functions', 'scripts'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);

    const importadores = rastreados.filter((f) =>
      /tarjetaDelPanel/.test(readFileSync(raiz(f), 'utf8')),
    );

    // Sin esto el chequeo pasaría por vacío el día que el módulo se renombre.
    expect(importadores.length, 'nadie menciona el módulo: ¿se renombró?').toBeGreaterThan(0);
    for (const f of importadores) {
      expect(f, `${f} menciona el view-model del panel`).toMatch(
        /^src\/(lib\/tarjetaDelPanel\.ts|components\/admin\/)/,
      );
    }
  });
});
