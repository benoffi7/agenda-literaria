/**
 * **El alcance por ciudad del rol `publicador`, del lado puro** — B-919, D-690.
 *
 * La frontera se prueba contra el emulador (`rol-publicador.integracion.test.ts`,
 * bloque 9): las reglas son la autorización real y lo que vale es que rechacen.
 * Lo de acá es la otra mitad, y es la que no se ve fallar:
 *
 *  1. **la derivación de `ciudades`**, que es lo que hace la regla expresable —
 *     una regla no puede mirar adentro de `modalidades[]` ni normalizar un campo
 *     de texto libre;
 *  2. **que haya UNA sola normalización**, porque el claim lo escribe un script
 *     de node y el documento lo escribe el panel: si los dos slugificaran
 *     distinto, el permiso no matchearía y el síntoma sería «no hay actividades
 *     de tu ciudad», no «no tenés permiso» (clase de B-88);
 *  3. **qué se puede tocar y qué no**, que es lo que decide los botones del
 *     panel — y que el panel no ofrezca lo que la regla va a rechazar.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { ciudadesDe, slugDeCiudad } from '@/lib/ciudades.mjs';
import { slugify } from '@/lib/slugify';
import { ciudadDeClaims } from '@/lib/rolDelPanel';
import { esSoloLectura } from '@/lib/formulario/autoria';
import { formADocumento, documentoAForm } from '@/lib/actividades';
import { payloadDeRestauracion } from '@/lib/historial';
import { formVacio, modalidadVacia } from '@/lib/formulario/estadoInicial';
import { formGuardable } from './fixtures/formulario';
import type { ActividadForm, Sede } from '@/types/actividad';

const sede = (over: Partial<Sede> = {}): Sede => ({
  nombre: 'Librería del puerto',
  direccion: 'Av. Luro 3000',
  provincia: 'buenos-aires',
  barrio: '',
  ciudad: 'mar-del-plata',
  indicaciones: '',
  geo: null,
  ...over,
});

const fila = (over: Partial<ActividadForm['modalidades'][number]> = {}) => ({
  ...modalidadVacia('presencial'),
  id: 'mod_1',
  sede: sede(),
  ...over,
});

const formConFilas = (filas: ActividadForm['modalidades']): ActividadForm => ({
  ...formGuardable(),
  titulo: 'Club de lectura del puerto',
  slug: 'club-del-puerto',
  descripcion: 'Ocho encuentros sobre narrativa argentina.',
  organizador: { nombre: 'Casa de la cultura', instagram: '', web: '' },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  estado: 'publicado',
  modalidades: filas,
});

const documentoDe = (f: ActividadForm) =>
  formADocumento(f, 'uid_pub', true) as unknown as { ciudades?: string[] };

// ───────────────────────────────────────────────────────────────────────────
// 1 · La derivación
// ───────────────────────────────────────────────────────────────────────────

describe('`ciudades` se deriva de las modalidades, normalizada (B-919)', () => {
  it('cuatro formas de escribir la misma ciudad dan un solo slug', () => {
    /*
     * **Es la trampa 6 puesta donde nadie la había puesto.** La ciudad es un
     * `<input>` de texto libre (`ModalidadesEditor.tsx`), no una taxonomía: sin
     * normalizar, «Mar del Plata» y « MAR DEL PLATA » son dos ciudades distintas
     * y el permiso de la publicadora falla **en silencio** con una de las dos.
     */
    const variantes = ['Mar del Plata', 'mar del plata', 'MAR DEL PLATA', '  Mar del Plata  '];
    const slugs = new Set(variantes.map((c) => ciudadesDe([{ sede: sede({ ciudad: c }) }])[0]));
    expect(slugs).toEqual(new Set(['mar-del-plata']));
  });

  it('toma TODAS las filas, no la sede derivada', () => {
    /*
     * `sede` es «la primera fila que tenga una» (D-130). Derivar de ahí dejaría a
     * la segunda ciudad fuera del alcance de su publicadora **sin que nada
     * falle**: es el mismo motivo por el que `searchText` indexa todas las sedes
     * y no la principal.
     */
    const doc = documentoDe(
      formConFilas([
        fila(),
        fila({ id: 'mod_2', sede: sede({ ciudad: 'Necochea' }) }),
      ]),
    );
    expect(doc.ciudades).toEqual(['mar-del-plata', 'necochea']);
  });

  it('no repite cuando dos filas son de la misma ciudad', () => {
    const doc = documentoDe(
      formConFilas([fila(), fila({ id: 'mod_2', sede: sede({ ciudad: 'mar del plata' }) })]),
    );
    expect(doc.ciudades).toEqual(['mar-del-plata']);
  });

  it('una actividad solo virtual queda en `[]`, y eso es correcto', () => {
    /*
     * No es de ninguna ciudad, así que no la ve ningún publicador por ciudad. Es
     * la respuesta correcta y no un agujero: el alcance dice «lo que pasa en tu
     * ciudad», y una reunión por Meet no pasa en ninguna.
     */
    const doc = documentoDe(
      formConFilas([
        {
          ...modalidadVacia('virtual'),
          id: 'mod_v',
          online: { plataforma: 'meet', url: 'https://meet.example/x', urlPublica: false },
        },
      ]),
    );
    expect(doc.ciudades).toEqual([]);
  });

  it('una ciudad vacía NO entra a la lista, y esa es la mitad que protege un permiso', () => {
    /*
     * **Si `''` entrara, un claim sin ciudad la matchearía.** La regla tiene su
     * propia cláusula para ese caso (`token.ciudad != ''`, con su testigo contra
     * el emulador), pero las dos mitades hacen falta y son distintas: acá el
     * estado raro no se puede crear, y allá se decide qué pasa si igual existe.
     * Es el mismo reparto que los dos claims de rol en B-888.
     */
    expect(ciudadesDe([{ sede: sede({ ciudad: '   ' }) }])).toEqual([]);
    expect(ciudadesDe([{ sede: sede({ ciudad: '¿?' }) }])).toEqual([]);
    expect(slugDeCiudad(null)).toBe('');
    expect(slugDeCiudad(undefined)).toBe('');
  });

  it('una actividad sin modalidades no rompe: `[]`', () => {
    expect(ciudadesDe()).toEqual([]);
    expect(ciudadesDe([])).toEqual([]);
  });

  it('restaurar `modalidades` del historial recalcula `ciudades` en la misma escritura', () => {
    /*
     * **Es el derivado que más duele olvidar, porque no es una incoherencia
     * visible: es un permiso.** Restaurar las formas de cursar sin recalcular
     * esto deja al documento diciendo que es de una ciudad que ninguna de sus
     * modalidades tiene, y la actividad entra —o desaparece— del panel de una
     * publicadora sin que nada en la pantalla lo explique.
     *
     * MUTACIÓN PROBADA: sacarle el `payload.ciudades = ciudadesDe(filas)` a
     * `payloadDeRestauracion` (`src/lib/historial.ts`) deja este caso en rojo.
     */
    const actual = documentoDe(formConFilas([fila()])) as never;
    const version = {
      documento: documentoDe(
        formConFilas([fila({ id: 'mod_2', sede: sede({ ciudad: 'Necochea' }) })]),
      ),
    } as never;

    const payload = payloadDeRestauracion('modalidades', version, actual, 'uid_pub');
    expect(payload.ciudades).toEqual(['necochea']);
  });

  /**
   * **B-950, y lo cobraron los dos auditores (trampas y privacidad).** Una
   * versión guardada antes de B-950 trae la ciudad como se tipeó y sin provincia.
   * Restaurarla devolvía al documento en vivo un estado **internamente
   * contradictorio**: `sede.ciudad` en texto libre y, en la misma escritura,
   * `ciudades` ya slugificado — o sea el campo que gobierna el permiso del
   * publicador diciendo una cosa y la sede diciendo otra.
   *
   * No se veía en el sitio porque `toPublic` y los filtros del panel vuelven a
   * normalizar al leer (D-26). Se veía al reeditar: el desplegable de Ciudad
   * quedaba deshabilitado con un valor que no matchea ninguna opción.
   *
   * **La versión se arma a mano y NO con `formConFilas`**, que es todo el punto:
   * el caso de arriba usa un documento ya normalizado, así que nunca ejercitaba
   * una versión sin migrar — por eso la suite estaba verde con el bug adentro.
   *
   * MUTACIÓN PROBADA: sacar el `map` con `geografiaNormalizada` de
   * `payloadDeRestauracion` deja los tres `expect` en rojo.
   */
  it('restaurar una versión anterior a B-950 deja la geografía normalizada', () => {
    const actual = documentoDe(formConFilas([fila()])) as never;
    const version = {
      documento: {
        modalidades: [
          {
            id: 'mod_viejo',
            modalidad: 'presencial',
            inicio: null,
            fin: null,
            // La forma de antes de B-950: sin `provincia`, con la ciudad tipeada.
            sede: {
              nombre: 'Librería del puerto',
              direccion: 'Av. Luro 3000',
              barrio: '',
              ciudad: 'Mar del Plata',
              indicaciones: '',
              geo: null,
            },
            online: null,
          },
        ],
      },
    } as never;

    const payload = payloadDeRestauracion('modalidades', version, actual, 'uid_pub');
    const filas = payload.modalidades as { sede: Record<string, string> }[];
    expect(filas[0]!.sede.ciudad).toBe('mar-del-plata');
    // La provincia no se adivina para una ciudad que no es CABA (D-710 § 5), así
    // que queda vacía — pero **declarada**, no ausente.
    expect(filas[0]!.sede.provincia).toBe('');
    // Y el derivado que decide el permiso concuerda con la sede, que es lo que
    // antes no pasaba.
    expect(payload.ciudades).toEqual(['mar-del-plata']);
  });

  it('y `ciudades` no se ofrece para restaurar por separado', () => {
    // Está en `CAMPOS_DERIVADOS`: restaurarlo solo dejaría el documento diciendo
    // dos cosas hasta el próximo guardado.
    const src = readFileSync('src/lib/historial.ts', 'utf8');
    const lista = src.slice(src.indexOf('const CAMPOS_DERIVADOS'));
    expect(lista.slice(0, lista.indexOf('];'))).toContain("'ciudades'");
  });

  it('`documentoAForm` no lo trae de vuelta: no es un campo del formulario', () => {
    // Es derivado, como `modalidad`, `sede` y `online`: tenerlo también en el
    // estado del formulario serían dos fuentes para el mismo dato.
    const form = documentoAForm(documentoDe(formConFilas([fila()])) as never);
    expect(Object.prototype.hasOwnProperty.call(form, 'ciudades')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Una sola normalización (clase de B-88)
// ───────────────────────────────────────────────────────────────────────────

describe('el claim y el documento normalizan con la MISMA función', () => {
  it('`slugDeCiudad` es `slugify`, no una copia parecida', () => {
    for (const c of ['Mar del Plata', 'Añatuya', 'Río Cuarto', 'San Miguel de Tucumán', '9 de Julio']) {
      expect(slugDeCiudad(c)).toBe(slugify(c));
    }
  });

  it('saca los acentos y la ñ **por valor**, no comparándose contra sí misma', () => {
    /*
     * **El caso de arriba es tautológico y hace falta igual; éste es el que ata
     * el resultado.** Los dos lados de aquella igualdad son la misma función, así
     * que se degradan juntos: si el borrado de acentos se apagara, `slugDeCiudad`
     * y `slugify` seguirían coincidiendo y el caso quedaría verde.
     *
     * Y no es una hipótesis: el primer borrador de `slugify.mjs` escribió la
     * clase de caracteres con los **combinantes literales** (`/[̀-ͯ]/`) en vez de
     * los escapes, que funciona hasta que cualquier herramienta normalice el
     * archivo. Lo encontró el `auditor-privacidad`; esto es lo que lo habría
     * encontrado antes.
     */
    expect(slugify('Córdoba')).toBe('cordoba');
    expect(slugify('Añatuya')).toBe('anatuya');
    expect(slugify('Río Cuarto')).toBe('rio-cuarto');
    expect(ciudadesDe([{ sede: sede({ ciudad: 'CÓRDOBA' }) }])).toEqual(['cordoba']);
  });

  it('los dos scripts que tocan la ciudad importan el slugify del proyecto', () => {
    /*
     * **El día que uno de los dos se copie la función, el permiso empieza a
     * fallar en silencio** con la primera ciudad que tenga una `ñ` o un acento:
     * el panel no diría «no tenés permiso», diría «no hay actividades de tu
     * ciudad».
     *
     * MUTACIÓN PROBADA: reemplazar el `import` de `set-admin-claim.mjs` por un
     * `const slugify = (s) => s.toLowerCase()` deja los dos casos de este
     * `describe` en rojo (éste por el import, el de abajo por el `normalize`).
     */
    expect(readFileSync('scripts/set-admin-claim.mjs', 'utf8')).toContain(
      "from '../functions/slugify.js'",
    );
    expect(readFileSync('scripts/sembrar-ciudades.mjs', 'utf8')).toContain(
      "from '../src/lib/ciudades.mjs'",
    );
  });

  it('nadie más en el repo se escribe su propio slugify — el chequeo de la clase', () => {
    /*
     * No protege una instancia: protege **la forma**. El `normalize('NFD')` es la
     * firma inconfundible de esta normalización, y **solo dos archivos del repo
     * pueden tenerla**. Quien la copie entra acá en rojo el día que la escribe,
     * que es cuando hay que mirarlo — §«Verificar la clase, no la instancia».
     *
     * **Barre `src/`, `functions/` y `scripts/` y no solo los scripts**, y eso lo
     * cobró el `auditor-privacidad`: el docblock decía «el único lugar del repo» y
     * el barrido miraba un directorio, así que una segunda copia en una Function
     * pasaba. La lista se deriva del árbol, no se mantiene a mano.
     *
     * Los dos permitidos son distintos a propósito y no una excepción de más:
     * `functions/slugify.js` produce un **identificador** (`[a-z0-9-]`, es lo que
     * compara la regla) y `normalize.ts` produce el **índice de búsqueda** del §6,
     * que conserva los espacios porque se busca por palabras. Son dos preguntas
     * distintas, no dos respuestas a la misma.
     *
     * **El primero se mudó a `functions/` con B-968**, cuando apareció el cuarto
     * runtime que tiene que normalizar igual: la Function de Calendar, que se
     * despliega con su propio `package.json` y no puede importar `src/` (D-20).
     * `src/lib/slugify.ts` es su fachada y no cuenta acá porque **reexporta** en
     * vez de reimplementar, que es justo la diferencia que este barrido mide.
     */
    const PERMITIDOS = ['functions/slugify.js', 'src/lib/normalize.ts'];

    const archivos = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const ruta = `${dir}/${e.name}`;
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : archivos(ruta);
        return /\.(ts|tsx|mjs|js)$/.test(e.name) ? [ruta] : [];
      });

    const culpables = ['src', 'functions', 'scripts']
      .flatMap(archivos)
      .filter((f) => readFileSync(f, 'utf8').includes("normalize('NFD')"))
      .filter((f) => !PERMITIDOS.includes(f));

    expect(
      culpables,
      `estos archivos se escribieron su propia normalización: ${culpables.join(', ')}. ` +
        'Importala de `@/lib/slugify` (identificadores; desde node, de `functions/slugify.js`) ' +
        'o de `src/lib/normalize.ts` ' +
        '(búsqueda): dos normalizaciones distintas de la misma ciudad son un permiso que no ' +
        'matchea y nadie entiende por qué (B-919).',
    ).toEqual([]);

    // Control positivo: si el barrido dejara de encontrar archivos —un `readdir`
    // que falla, una extensión que cambia— el caso pasaría sin verificar nada.
    expect(['src', 'functions', 'scripts'].flatMap(archivos).length).toBeGreaterThan(100);
  });

  it('y `src/lib/slugify.ts` es la única fachada, no una segunda copia — M-18', () => {
    // Un salto a la implementación, no dos: la `.mjs` intermedia se borró.
    const fachada = sinComentarios(readFileSync('src/lib/slugify.ts', 'utf8'));
    expect(fachada.trim()).toBe("export { slugify } from '../../functions/slugify.js';");
    expect(existsSync('src/lib/slugify.mjs')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Qué ofrece el panel
// ───────────────────────────────────────────────────────────────────────────

describe('la ciudad del claim (`ciudadDeClaims`)', () => {
  it('la devuelve verbatim para un publicador', () => {
    /*
     * **Verbatim y sin volver a slugificar**: la regla compara el claim tal cual,
     * así que lo que el panel pregunta tiene que ser byte por byte lo que la
     * regla va a mirar. Normalizar de nuevo acá haría que la consulta pida algo
     * que el disyunto no autoriza, y una query que la regla rechaza **rompe el
     * listado entero** (trampa 7).
     */
    expect(ciudadDeClaims({ publicador: true, ciudad: 'mar-del-plata' })).toBe('mar-del-plata');
  });

  it('para un admin es `\'\'`: ve todo el catálogo, la ciudad no significa nada', () => {
    expect(ciudadDeClaims({ admin: true, ciudad: 'mar-del-plata' })).toBe('');
  });

  it('con los dos claims gana el acotado, igual que el rol', () => {
    // Paridad con `esAdmin()` de las reglas, que exige además **no** ser
    // publicador: un token con los dos cae del lado acotado, y su alcance
    // también.
    expect(ciudadDeClaims({ admin: true, publicador: true, ciudad: 'necochea' })).toBe('necochea');
  });

  it('sin claims, sin ciudad, o con una ciudad que no es texto: `\'\'`', () => {
    expect(ciudadDeClaims(null)).toBe('');
    expect(ciudadDeClaims({})).toBe('');
    expect(ciudadDeClaims({ publicador: true })).toBe('');
    expect(ciudadDeClaims({ publicador: true, ciudad: 42 })).toBe('');
  });
});

describe('qué se puede tocar y qué solo mirar (`esSoloLectura`)', () => {
  const mia = { createdBy: 'uid_pub' };
  const ajena = { createdBy: 'uid_otra' };
  const vieja = {};

  it('un publicador edita lo suyo y solo mira lo ajeno', () => {
    expect(esSoloLectura('publicador', mia, 'uid_pub')).toBe(false);
    expect(esSoloLectura('publicador', ajena, 'uid_pub')).toBe(true);
  });

  it('un admin toca todo: el rol se mira primero', () => {
    // Control positivo del otro lado. Sin él, un `esSoloLectura` que devolviera
    // siempre `true` dejaría verde la mitad de arriba.
    expect(esSoloLectura('admin', ajena, 'uid_admin')).toBe(false);
    expect(esSoloLectura('admin', vieja, 'uid_admin')).toBe(false);
  });

  it('una actividad anterior a `createdBy` es solo lectura para un publicador', () => {
    /*
     * No es de nadie, y la regla no se la deja tocar a ningún publicador. Sin
     * este default el panel le ofrecería «Editar» sobre una actividad vieja de su
     * ciudad y el guardado moriría con un `permission-denied` después de veinte
     * minutos de edición.
     */
    expect(esSoloLectura('publicador', vieja, 'uid_pub')).toBe(true);
  });
});
