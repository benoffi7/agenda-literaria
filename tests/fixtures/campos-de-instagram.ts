/**
 * **El registro de los campos de Instagram, y el barrido que lo recorre** —
 * B-1590 lo creó, B-1780 lo mudó acá.
 *
 * Nació adentro de `tests/calendario.test.ts` (D-1080) porque la guarda del
 * evento de Calendar era su único consumidor. No lo era la única salida: el texto
 * para redes (`destinoLegible`, las arrobas del pie) y la ficha pública
 * (`accionDeInscripcion`, organizador y tallerista) muestran los mismos campos y
 * tenían tests de comportamiento pero ninguna guarda de clase. Un
 * `insc.destino` crudo en `textoRedes.ts` pasaba en verde mientras nadie
 * escribiera el caso. Vive en un fixture por la razón de `barrido.ts`: importar
 * un `.test.ts` haría correr sus tests dos veces.
 *
 * ── Qué dice cada entrada ────────────────────────────────────────────────
 * Una entrada por fila de la tabla de `docs/03-modelo-de-datos.md` § «Los
 * campos de Instagram, campo por campo» (B-1191), con la primera celda
 * idéntica: el cruce lo hace `tests/campos-de-instagram.test.ts`, en las dos
 * direcciones. Para **cada salida**, la entrada dice si el campo sale ahí y con
 * qué forma saneada, o por qué no. Una salida nueva agrega una clave y obliga a
 * contestar las seis filas; una fila nueva obliga a contestar las tres salidas.
 *
 * Las formas son regex sobre el fuente **sin comentarios**, y se escriben con
 * `CADENA` en lugar del objeto: `a.organizador.instagram`,
 * `actividad.organizador?.instagram` y `org.instagram` son la misma lectura.
 * `crudo` es la lectura sin sanear que la salida hace **a propósito**, con su
 * motivo escrito; no hay otra manera de que un acceso crudo pase.
 *
 * ── Lo que no sale también se verifica (B-1840) ──────────────────────────
 * Un `{ porque }` solo era una afirmación: que `difusion.arrobar` no llegara a
 * Calendar lo cubrían los centinelas del barrido de salidas públicas, no este
 * registro. Ahora cada `{ porque }` elige: `ausente`, los nombres con nombre
 * propio que el código de esa salida **no puede nombrar** —ni como acceso, ni
 * como clave de un `pick`, ni desestructurado—, o `sinAusente`, el motivo por el
 * que la ausencia no se puede leer en el texto del código. El caso es un
 * atributo compartido: `organizador.instagram` de una propuesta es, letra por
 * letra, el acceso que la primera fila exige encontrar.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { sinComentarios } from '../../scripts/sin-comentarios.mjs';

export type Salida = 'calendario' | 'redes' | 'ficha';

/** El archivo que arma cada salida: es el que se barre. */
export const ARCHIVO_DE_SALIDA: Record<Salida, string> = {
  calendario: 'functions/calendario.js',
  redes: 'src/lib/textoRedes.ts',
  ficha: 'src/lib/detallePublico.ts',
};

const ID = '[A-Za-z_$][\\w$]*';
/** Un objeto y sus accesos: `a.inscripcion`, `actividad.organizador?`, `org`. */
const CADENA = `${ID}(?:\\??\\.${ID})*`;

export const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `fn(x.atributo)`, con cualquier cadena adelante del atributo. */
const envuelto = (fn: string, atributo: string) =>
  `${fn}\\(${CADENA}\\??\\.${escaparRegex(atributo)}\\)`;

/**
 * El ternario que sanea con una vía y deja el resto como se escribió:
 * `x.via === 'dm' ? fn(x.destino) : x.destino`. Es la forma de Calendar, y con
 * vía la única aceptada ahí (D-1080).
 */
const ternarioPorVia = (fn: string, via: string, atributo: string) => {
  const a = escaparRegex(atributo);
  return (
    `(${CADENA})\\??\\.via === '${escaparRegex(via)}' \\? ` +
    `${fn}\\(\\1\\??\\.${a}\\) : \\1\\??\\.${a}\\b`
  );
};

/**
 * `fn(x.via, x.destino…`: la salida le pasa el campo **junto con su vía** a una
 * función que decide. Lo que se barre es que el campo no llegue a la salida sin
 * la vía; lo que la función hace con la vía lo fija `adentro`.
 */
const conSuVia = (fn: string, atributo: string) =>
  `${fn}\\((${CADENA})\\??\\.via, \\1\\??\\.${escaparRegex(atributo)}\\b`;

export type EnSalida =
  | {
      /** El nombre del atributo como lo lee el código. */
      atributo: string;
      /** Las lecturas saneadas que se aceptan. */
      formas: string[];
      /** Una lectura sin sanear que la salida hace a propósito, con su motivo. */
      crudo?: { forma: string; porque: string }[];
      /** Lo que tiene que estar en el fuente para que la forma sanee de verdad. */
      adentro?: string[];
      /**
       * Cuántas lecturas aceptadas —saneadas más crudas declaradas— hay que
       * encontrar. Sin esto la guarda pasaría vacía el día que alguien renombre
       * el campo, que es la firma de un chequeo que no verifica nada (D-750).
       */
      minimo: number;
    }
  | {
      porque: string;
      /**
       * Los nombres propios de la fila que el código de la salida no nombra
       * nunca, como palabra entera. Cada uno tiene que estar en la fila: si el
       * campo se renombra, el chequeo no puede quedar mirando un nombre muerto.
       */
      ausente?: string[];
      /** Por qué la ausencia de lo que queda de la fila no se puede verificar. */
      sinAusente?: string;
    };

export type CampoDeInstagram = { fila: string[]; salidas: Record<Salida, EnSalida> };

const DE_LAS_GUIAS = 'es de las guías, que no tienen actividad ni evento: sus salidas son sus propias fichas';
const DE_UNA_PROPUESTA =
  'es de una propuesta, que no sale a ninguna salida hasta convertirse en actividad, y entonces vale la primera fila';
const INTERNO = 'es interno: cómo escribirle a quien cargó, no una cuenta a mostrar';

const INSTAGRAM_COMPARTIDO =
  '`instagram` es el atributo de la primera fila, que en esta salida sí aparece: su ausencia no se lee en el texto';
const PROPUESTA_SIN_NOMBRE_PROPIO =
  'el acceso es `organizador.instagram`, idéntico al de la primera fila, que esta salida tiene que leer: lo que lo deja afuera es que la salida recibe una actividad y no una propuesta, y eso no está en el texto del código';
const CONTACTO_ES_PALABRA =
  '`contacto` es una palabra del castellano que un texto de la salida puede decir sin leer el campo («medio de contacto»): buscarla como ausente daría rojo por un rótulo';

export const CAMPOS_DE_INSTAGRAM: CampoDeInstagram[] = [
  {
    fila: ['organizador.instagram', 'tallerista.instagram'],
    salidas: {
      // `org.instagram` y `persona.instagram` (tallerista o autor invitado).
      calendario: {
        atributo: 'instagram',
        formas: [envuelto('arrobaPublicable', 'instagram')],
        minimo: 2,
      },
      // El pie del posteo: `handlesDe`, un `arrobaInstagram` por campo (B-1142).
      redes: {
        atributo: 'instagram',
        formas: [envuelto('arrobaInstagram', 'instagram')],
        minimo: 2,
      },
      // El texto y el link, por separado: `@handle` y `https://instagram.com/handle` (B-1141).
      ficha: {
        atributo: 'instagram',
        formas: [envuelto('arrobaInstagram', 'instagram'), envuelto('enlaceInstagram', 'instagram')],
        minimo: 4,
      },
    },
  },
  {
    fila: ['instagram', 'ofrecidaPor.instagram'],
    salidas: {
      calendario: { porque: DE_LAS_GUIAS, ausente: ['ofrecidaPor'], sinAusente: INSTAGRAM_COMPARTIDO },
      redes: { porque: DE_LAS_GUIAS, ausente: ['ofrecidaPor'], sinAusente: INSTAGRAM_COMPARTIDO },
      ficha: { porque: DE_LAS_GUIAS, ausente: ['ofrecidaPor'], sinAusente: INSTAGRAM_COMPARTIDO },
    },
  },
  {
    fila: ['organizador.instagram'],
    salidas: {
      calendario: { porque: DE_UNA_PROPUESTA, sinAusente: PROPUESTA_SIN_NOMBRE_PROPIO },
      redes: { porque: DE_UNA_PROPUESTA, sinAusente: PROPUESTA_SIN_NOMBRE_PROPIO },
      ficha: { porque: DE_UNA_PROPUESTA, sinAusente: PROPUESTA_SIN_NOMBRE_PROPIO },
    },
  },
  {
    fila: ['difusion.arrobar[]'],
    salidas: {
      calendario: {
        porque: 'es trabajo interno del §3.2: su única salida es el texto para redes',
        ausente: ['arrobar', 'difusion'],
      },
      redes: {
        atributo: 'arrobar',
        formas: [],
        crudo: [
          {
            forma: `\\.\\.\\.\\(${CADENA}\\??\\.arrobar \\?\\? \\[\\]\\)`,
            porque:
              'no es un campo de Instagram (B-1142): admite `-` y puede ser de otra red, así que sale como se escribió y `conArroba` solo le agrega la `@`',
          },
        ],
        minimo: 1,
      },
      ficha: {
        porque: 'es trabajo interno del §3.2 y nunca sale al sitio (§5.1)',
        ausente: ['arrobar', 'difusion'],
      },
    },
  },
  {
    fila: ['inscripcion.destino', "via: 'dm'"],
    salidas: {
      calendario: {
        atributo: 'destino',
        formas: [ternarioPorVia('arrobaPublicable', 'dm', 'destino')],
        minimo: 1,
      },
      redes: {
        atributo: 'destino',
        formas: [conSuVia('destinoLegible', 'destino')],
        adentro: [`via === 'dm' \\? arrobaInstagram\\(destino\\) : \\(destino \\?\\? ''\\)\\.trim\\(\\)`],
        minimo: 1,
      },
      ficha: {
        atributo: 'destino',
        formas: [conSuVia('accionDeInscripcion', 'destino')],
        crudo: [
          {
            forma: `destino: ${CADENA}\\??\\.inscripcion\\??\\.destino\\b`,
            porque:
              'es el canal en texto, y la página lo pinta solo con `mostrarCanal`, o sea cuando `accionDeInscripcion` no armó botón: con `dm` eso es un valor que `handleInstagram` no reconoce, y la tabla dice que ése se muestra como se escribió',
          },
        ],
        adentro: [
          `if \\(via === 'dm'\\) \\{ const handle = handleInstagram\\(valor\\);`,
          'mostrarCanal: canal\\.requiere && canal\\.accion === null',
        ],
        minimo: 2,
      },
    },
  },
  {
    fila: ['contactoDeQuienCargo', 'contacto', "via: 'instagram'"],
    salidas: {
      calendario: { porque: INTERNO, ausente: ['contactoDeQuienCargo'], sinAusente: CONTACTO_ES_PALABRA },
      redes: { porque: INTERNO, ausente: ['contactoDeQuienCargo'], sinAusente: CONTACTO_ES_PALABRA },
      ficha: { porque: INTERNO, ausente: ['contactoDeQuienCargo'], sinAusente: CONTACTO_ES_PALABRA },
    },
  },
];

/** El fuente de una salida, sin comentarios: los docblocks nombran los campos para explicarlos. */
export const codigoDeSalida = (salida: Salida): string =>
  sinComentarios(
    readFileSync(fileURLToPath(new URL(`../../${ARCHIVO_DE_SALIDA[salida]}`, import.meta.url)), 'utf8'),
  );

/**
 * Las filas de la tabla de docs/03, como las primeras celdas: los campos entre
 * backticks, sin las rutas de las guías (`/librerias`…).
 */
export const filasDeLaTabla = (): string[][] => {
  const doc = readFileSync(
    fileURLToPath(new URL('../../docs/03-modelo-de-datos.md', import.meta.url)),
    'utf8',
  );
  const desde = doc.indexOf('## Los campos de Instagram, campo por campo');
  if (desde < 0) return [];
  const seccion = doc.slice(desde, doc.indexOf('\n---', desde));
  return seccion
    .split('\n')
    .filter((l) => l.startsWith('| `'))
    .map((l) =>
      [...l.split('|')[1].matchAll(/`([^`]+)`/g)]
        .map((m) => m[1])
        .filter((campo) => !campo.startsWith('/')),
    );
};

/**
 * **La guarda de clase de una salida**: devuelve los problemas, uno por línea,
 * nombrando la fila. Vacío es verde.
 *
 * 1. Cada campo que sale: se sacan del código sus lecturas aceptadas —saneadas
 *    y crudas declaradas— y lo que quede del atributo entró crudo.
 * 2. Menos lecturas aceptadas que el mínimo: el barrido dejó de ver el campo.
 * 3. Lo de `adentro` tiene que estar: es lo que hace que la forma sanee.
 * 4. Un atributo que diga «instagram» en el nombre y no esté en el registro es
 *    un campo que la tabla todavía no eligió (la mitad que la regex vieja de
 *    Calendar sí cubría).
 * 5. Lo que la fila declara `ausente` en esta salida no aparece como palabra
 *    entera en el código (B-1840): un acceso, una clave de `pick` o una
 *    desestructuración lo nombran igual.
 */
export const barrerSalida = (codigoOriginal: string, salida: Salida): string[] => {
  let codigo = codigoOriginal;
  const problemas: string[] = [];
  const vigilados = CAMPOS_DE_INSTAGRAM.flatMap(({ fila, salidas }) => {
    const en = salidas[salida];
    return 'atributo' in en ? [{ fila: fila.join(', '), ...en }] : [];
  });
  for (const v of vigilados) {
    let usos = 0;
    for (const forma of [...v.formas, ...(v.crudo ?? []).map((c) => c.forma)]) {
      const re = new RegExp(forma, 'g');
      usos += codigo.match(re)?.length ?? 0;
      codigo = codigo.replace(re, '');
    }
    const crudos = codigo.match(new RegExp(`${ID}\\??\\.${escaparRegex(v.atributo)}\\b`, 'g')) ?? [];
    for (const acceso of crudos) problemas.push(`${v.fila}: \`${acceso}\` entra crudo a ${salida}`);
    if (usos < v.minimo) {
      problemas.push(`${v.fila}: el barrido de ${salida} encontró ${usos} lecturas y espera ${v.minimo}`);
    }
    for (const requisito of v.adentro ?? []) {
      if (!new RegExp(requisito).test(codigoOriginal)) {
        problemas.push(`${v.fila}: en ${salida} falta lo que sanea la forma aceptada: /${requisito}/`);
      }
    }
  }
  for (const { fila, salidas } of CAMPOS_DE_INSTAGRAM) {
    const en = salidas[salida];
    if (!('porque' in en)) continue;
    for (const nombre of en.ausente ?? []) {
      const re = new RegExp(`(?<![\\w$])${escaparRegex(nombre)}(?![\\w$])`, 'g');
      const veces = codigoOriginal.match(re)?.length ?? 0;
      if (veces > 0) {
        problemas.push(`${fila.join(', ')}: \`${nombre}\` aparece en ${salida} (${veces}), y la fila dice que no sale ahí`);
      }
    }
  }
  for (const m of codigo.matchAll(new RegExp(`${ID}\\??\\.(\\w*instagram\\w*)\\b`, 'gi'))) {
    if (!vigilados.some((v) => v.atributo === m[1])) {
      problemas.push(`\`${m[0]}\`: un campo de Instagram que el registro no conoce, en ${salida}`);
    }
  }
  return problemas;
};
