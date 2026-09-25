/**
 * El fixture de centinelas no puede envejecer.
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { opcionesPublicas } from '@/lib/toPublic';
import { CENTINELA, CENTINELA_NUM, VALORES_NO_TEXTO, VOCABULARIO_CERRADO, actividadCentinela, opcionCentinela } from '../fixtures/centinelas';

// ───────────────────────────────────────────────────────────────────────────
// Las tres redes que sostienen al barrido. Sin ellas, el fixture envejece y el
// barrido pasa por vacío — que es exactamente el bug que B-196 cierra.
// ───────────────────────────────────────────────────────────────────────────

/** Nombres de campo de una interfaz de `src/types/actividad.ts`. */
const camposDeInterfaz = (src: string, nombre: string): string[] => {
  const bloque = new RegExp(`export interface ${nombre} \\{\\n([\\s\\S]*?)\\n\\}`).exec(src);
  expect(bloque, `no se encontró \`export interface ${nombre}\` en src/types/actividad.ts`).not.toBeNull();
  return [...bloque![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
};

describe('el fixture de centinelas no puede envejecer', () => {
  const src = readFileSync('src/types/actividad.ts', 'utf8');
  const actividad = actividadCentinela();

  /**
   * Cada interfaz del modelo, anclada al lugar del fixture que la representa.
   *
   * **Esto es lo que hace que un campo nuevo entre solo**: nace en el tipo, el
   * chequeo de abajo exige que esté en el fixture, y el de al lado exige que su
   * valor sea un centinela. A partir de ahí el barrido lo ve, y quien lo agregó
   * tiene que decidir en qué lista de excepciones va — o no ponerlo en ninguna.
   */
  const ANCLAS: Record<string, Record<string, unknown>> = {
    Actividad: actividad as unknown as Record<string, unknown>,
    Organizador: actividad.organizador as unknown as Record<string, unknown>,
    Persona: actividad.tallerista as unknown as Record<string, unknown>,
    Libro: actividad.libro as unknown as Record<string, unknown>,
    Sesion: actividad.sesiones[0] as unknown as Record<string, unknown>,
    Imagen: actividad.imagenes![0] as unknown as Record<string, unknown>,
    ModalidadFila: actividad.modalidades[0] as unknown as Record<string, unknown>,
    Sede: actividad.sede as unknown as Record<string, unknown>,
    Online: actividad.online as unknown as Record<string, unknown>,
    Inscripcion: actividad.inscripcion as unknown as Record<string, unknown>,
    Arancel: actividad.arancel as unknown as Record<string, unknown>,
    Material: actividad.material as unknown as Record<string, unknown>,
    ItemMaterial: actividad.material.items[0] as unknown as Record<string, unknown>,
    Difusion: actividad.difusion as unknown as Record<string, unknown>,
    /*
     * B-212 — `/opciones/{campo}` es una salida pública **propia** desde que
     * existe `opcionesPublicas`, y hasta ahora `ValorOpcion` estaba en AJENAS:
     * o sea, afuera de este chequeo. Eso significaba que la única salida nueva
     * ya planificada (B-106) nacía fuera de la red, y que el default —volcar
     * `valores` tal cual— publicaba `huellaCreador` y `usos` sin que nada se
     * pusiera rojo.
     */
    ValorOpcion: opcionCentinela() as unknown as Record<string, unknown>,
    // B-181 — las opciones para sumarse. Los dos campos son públicos y cada uno
    // por su motivo (ver `RUTAS` en el fixture), así que la interfaz se ancla:
    // un campo nuevo acá —un cupo por comisión, una sede por comisión— tiene que
    // decidir si sale antes de compilar.
    Comision: actividad.comisiones![0] as unknown as Record<string, unknown>,
  };

  /**
   * Las interfaces del archivo que **no** son parte de un documento de
   * actividad. Está escrita para que agregar una interfaz nueva al modelo
   * obligue a anclarla o a excluirla a mano.
   */
  const AJENAS = [
    'TimestampLike', // no tiene contenido: es la forma de un Timestamp
    'ActividadForm', // el formulario, cubierto por tests/fixtures/formulario.ts
    'SesionForm', // idem
    'ModalidadFilaForm', // idem
    // `DocOpciones` es `{ valores: ValorOpcion[] }` y nada más: lo que hay que
    // decidir está en `ValorOpcion`, que ahora sí está anclada arriba.
    'DocOpciones',
  ];

  it('el fixture tiene todos los campos de todas las interfaces del modelo', () => {
    for (const [interfaz, ancla] of Object.entries(ANCLAS)) {
      for (const campo of camposDeInterfaz(src, interfaz)) {
        expect(
          Object.prototype.hasOwnProperty.call(ancla, campo),
          `\`${interfaz}.${campo}\` no está en tests/fixtures/centinelas.ts. Un campo que ` +
            `no está en el fixture no lo mira ningún barrido: agregalo con su centinela y ` +
            `decidí en qué lista de excepciones va (o en ninguna).`,
        ).toBe(true);
      }
    }
  });

  it('todas las interfaces del modelo están ancladas o excluidas a mano', () => {
    const declaradas = [...src.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]!);
    const sinDecidir = declaradas.filter((i) => !(i in ANCLAS) && !AJENAS.includes(i));
    expect(
      sinDecidir,
      `interfaces nuevas en src/types/actividad.ts que el barrido no mira: ` +
        `${sinDecidir.join(', ')}. Anclalas en ANCLAS o justificalas en AJENAS.`,
    ).toEqual([]);
  });

  /**
   * Las hojas del fixture, con **dos** nombres: la ruta con índices —para el
   * mensaje de falla, que tiene que decir dónde mirar— y la **clase**, con los
   * índices colapsados a `[]`, que es con la que se declara.
   *
   * Los dos chequeos de abajo recorren esto y no cada uno lo suyo. El de los
   * strings existía con su propio walker y el de B-803 nació al lado: dos
   * recorridos del mismo árbol se separan en silencio —uno aprende a entrar a
   * los `Timestamp` y el otro no— y el agujero que queda es justo la clase de
   * agujero que este archivo existe para cerrar.
   *
   * **Un `Timestamp` es una hoja.** Sus tres campos internos (`seconds`,
   * `nanoseconds` y lo que devuelven `toDate`/`toMillis`) son la misma fecha en
   * otra unidad: declararlos por separado sería declarar tres veces el mismo
   * dato, y el que hay que decidir es el campo.
   */
  interface Hoja {
    ruta: string;
    clase: string;
    valor: unknown;
  }

  const hojasDe = (raiz: unknown, nombre: string): Hoja[] => {
    const salida: Hoja[] = [];
    const recorrer = (valor: unknown, ruta: string, clase: string): void => {
      if (Array.isArray(valor)) {
        valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`, `${clase}[]`));
        return;
      }
      if (valor && typeof valor === 'object' && !('toMillis' in valor)) {
        for (const [k, v] of Object.entries(valor)) recorrer(v, `${ruta}.${k}`, `${clase}.${k}`);
        return;
      }
      salida.push({ ruta, clase, valor });
    };
    recorrer(raiz, nombre, nombre);
    return salida;
  };

  /*
   * B-212 — la opción también, y esto faltaba. Anclar `ValorOpcion` en ANCLAS la
   * metió en el chequeo de cobertura (que sus siete campos estén en el fixture)
   * pero **no** en el recorrido, que es el que exige que cada valor sea
   * rastreable. Sin esta línea, un campo nuevo en la taxonomía —digamos
   * `notaDeModeracion`— quedaba obligado a entrar al fixture y podía entrar con
   * un valor inocente: obligatorio de declarar, invisible para todo barrido. Lo
   * encontró el `auditor-privacidad`.
   */
  const HOJAS = [...hojasDe(actividad, 'actividad'), ...hojasDe(opcionCentinela(), 'opcion')];

  /** `actividad.arancel.monto` → `arancel.monto`, que es como se nombra la ruta. */
  const rutaDelModelo = (clase: string): string => clase.replace(/^actividad\./, '');

  it('todo string del fixture es un centinela o vocabulario cerrado', () => {
    // Sin esto, un campo nuevo puede entrar al fixture con un valor inocente
    // ("Casa Brandon") y quedar fuera del barrido para siempre.
    const centinelas = Object.values(CENTINELA);
    const sueltos = HOJAS.filter(({ valor }) => typeof valor === 'string')
      .filter(({ valor }) => {
        const texto = valor as string;
        const cuantos = centinelas.filter((c) => texto.includes(c)).length;
        return cuantos !== 1 && !VOCABULARIO_CERRADO.includes(texto);
      })
      .map(({ ruta, valor }) => `${ruta} = ${JSON.stringify(valor)}`);

    expect(
      sueltos,
      `strings del fixture que no son centinelas ni vocabulario cerrado: ${sueltos.join(' | ')}. ` +
        `Un valor así no lo puede seguir el barrido: hacelo centinela, o agregalo a ` +
        `VOCABULARIO_CERRADO si es un enum del modelo.`,
    ).toEqual([]);
  });

  /**
   * **La otra mitad del recorrido, y era la que faltaba** — B-803.
   *
   * El chequeo de arriba mira los strings; los no-strings caían por el `return`
   * sin decir nada. O sea que la cobertura de interfaces obligaba a que
   * `arancel.monto` estuviera en el fixture —y por eso está— pero nada obligaba
   * a decidir **cómo se verifica**: el próximo campo numérico (`arancel.cuotas`,
   * `inscripcion.senia`) entraba con un `12` inocente, pasaba las dos redes y
   * ningún barrido lo veía. Lo encontró el `auditor-privacidad` sobre B-114.
   *
   * **Nada queda exento, ni siquiera lo registrado en `CENTINELA_NUM`.** Un
   * número anclado por valor y sin nadie que lo barra es la misma falsa
   * cobertura con otra cara, así que también se declara — y su declaración es la
   * que dice dónde está su barrido.
   */
  it('todo valor que no es texto está declarado con qué lo verifica (B-803)', () => {
    const comoSeVe = (valor: unknown): string =>
      valor && typeof valor === 'object' && 'toMillis' in valor
        ? 'Timestamp'
        : `${JSON.stringify(valor)} (${valor === null ? 'null' : typeof valor})`;

    const sinDecidir: string[] = [];
    const declarados = new Set<string>();

    for (const { ruta, clase, valor } of HOJAS) {
      if (typeof valor === 'string') continue;
      const campo = rutaDelModelo(clase);
      declarados.add(campo);
      if (!VALORES_NO_TEXTO[campo]?.trim()) sinDecidir.push(`${ruta} = ${comoSeVe(valor)}`);
    }

    expect(
      sinDecidir,
      `valores del fixture que no son texto y nadie decidió cómo se verifican: ` +
        `${sinDecidir.join(' | ')}.\n` +
        `Un número, un booleano, un \`null\` o una fecha no pueden llevar un centinela de ` +
        `texto, así que el barrido de cadenas no los ve. Si el valor puede llevar contenido ` +
        `cargado por alguien, registralo en CENTINELA_NUM y anclalo por valor salida por ` +
        `salida; si no puede, declaralo igual en VALORES_NO_TEXTO ` +
        `(tests/fixtures/centinelas.ts) con qué lo cubre en su lugar.`,
    ).toEqual([]);

    /*
     * Y en la otra dirección, que es lo que evita que la lista se vuelva un
     * cajón: una declaración cuyo valor ya no está en el fixture sobra, y
     * mientras sobra tapa el día en que ese campo vuelva con otra forma.
     */
    const huerfanas = Object.keys(VALORES_NO_TEXTO).filter((c) => !declarados.has(c));
    expect(
      huerfanas,
      `declaraciones de VALORES_NO_TEXTO que ya no corresponden a ningún valor del fixture: ` +
        `${huerfanas.join(', ')}. Borralas: una excepción que sobra es una que nadie va a ` +
        `releer el día que el campo vuelva.`,
    ).toEqual([]);
  });

  /**
   * **Lo que hace que un centinela numérico sea un centinela** — B-803.
   *
   * Un número anclado por valor solo prueba algo si encontrarlo en una salida
   * significa que salió **de ese campo**. `987654` lo cumple; un `12` no —en un
   * JSON es un índice, un mes, o tres dígitos de un timestamp— y ése es
   * exactamente el chequeo que pasa siempre y no verifica nada.
   *
   * Así que la regla del registro se verifica en vez de confiarse: seis dígitos o
   * más, y ninguna otra cifra del fixture —otro centinela, el `cupo`, los
   * milisegundos de una fecha— lo contiene como substring. Encontrarlo en una
   * salida tiene que probar de qué campo salió.
   *
   * **Lo que acá no se puede verificar es que alguien lo barra**, y se intentó:
   * pedir que la ruta aparezca en este archivo lo satisface un comentario, y la
   * mutación lo demostró —este mismo docblock nombra `inscripcion.senia` y con
   * eso alcanzaba—. Un chequeo que pasa con el agujero puesto es peor que no
   * tenerlo, así que esa mitad la sostiene la declaración obligatoria de
   * `VALORES_NO_TEXTO`: un número registrado **también** se declara, y su
   * declaración dice dónde está su barrido.
   */
  it('los centinelas numéricos no se confunden con ningún otro número del fixture', () => {
    const registrados = Object.entries(CENTINELA_NUM);
    expect(registrados.length, 'CENTINELA_NUM quedó vacío: no hay nada que anclar').toBeGreaterThan(
      0,
    );

    /** Toda otra cifra del fixture, incluidas las que viven dentro de un Timestamp. */
    const otros: { ruta: string; valor: number }[] = [];
    for (const { ruta, clase, valor } of HOJAS) {
      if (typeof valor === 'number') {
        if (CENTINELA_NUM[rutaDelModelo(clase) as keyof typeof CENTINELA_NUM] === valor) continue;
        otros.push({ ruta, valor });
        continue;
      }
      if (valor && typeof valor === 'object' && 'toMillis' in valor) {
        const t = valor as { toMillis: () => number; seconds: number; nanoseconds: number };
        otros.push({ ruta: `${ruta}.toMillis()`, valor: t.toMillis() });
        otros.push({ ruta: `${ruta}.seconds`, valor: t.seconds });
        otros.push({ ruta: `${ruta}.nanoseconds`, valor: t.nanoseconds });
      }
    }

    for (const [rutaNum, valor] of registrados) {
      const digitos = String(valor);
      expect(
        digitos.length,
        `el centinela de \`${rutaNum}\` es ${digitos}: muy corto para ser rastreable. ` +
          `Un número de pocos dígitos aparece por casualidad en cualquier salida.`,
      ).toBeGreaterThanOrEqual(6);

      const choques = [
        ...registrados
          .filter(([otra, v]) => otra !== rutaNum && String(v).includes(digitos))
          .map(([otra]) => `el centinela de ${otra}`),
        ...otros.filter((o) => String(o.valor).includes(digitos)).map((o) => o.ruta),
      ];
      expect(
        choques,
        `el centinela de \`${rutaNum}\` (${digitos}) está contenido en: ${choques.join(', ')}. ` +
          `Encontrarlo en una salida no probaría de dónde salió.`,
      ).toEqual([]);
    }
  });

});
