/**
 * B-81: el saneador va en un punto de paso obligado.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { construirIssue } from '../../functions/reportes.js';
import { fuente, primero, CENTINELA } from '../fixtures/clases-de-bug';

/**
 * Todo string de la entrada reemplazado por el centinela.
 *
 * `creadoEn` y `actualizadoEn` se excluyen porque no son texto: son fechas, y
 * un string en su lugar hace explotar el formateador antes de llegar a la
 * aserción.
 */
const conCentinelas = (valor: unknown, clave = ''): unknown => {
  if (clave === 'creadoEn' || clave === 'actualizadoEn') return valor;
  if (typeof valor === 'string') return CENTINELA;
  if (Array.isArray(valor)) return valor.map((v) => conCentinelas(v));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, conCentinelas(v, k)]),
    );
  }
  return valor;
};


/**
 * Un centinela que `redactar()` **no** tapa — B-361.
 *
 * El `CENTINELA` de arriba es un link de zoom, o sea justo una de las dos cosas
 * que el saneador reemplaza. Eso lo hace perfecto para verificar que el saneador
 * corre, y **inútil** para verificar que un campo no está interpolado: un campo
 * que se cuela y se sanea deja el barrido en verde igual que uno que no se cuela.
 * Los dos hechos se confunden.
 *
 * Para `reportadoPor.uid` y `reportadoPor.email` —que el §5.1 prohíbe publicar—
 * lo que hace falta es lo contrario: un valor que el saneador deje pasar, para
 * que si aparece en la salida, aparezca. Se probó con la mutación: interpolar el
 * mail del reportante en el encabezado **sobrevive** a un aserto contra el mail
 * del fixture, y muere contra éste.
 */
const CENTINELA_CRUDO = 'CENTINELA_QUE_EL_SANEADOR_NO_TAPA';


/**
 * El documento de `/reportes/{id}` **completo** — B-361.
 *
 * Tenía 8 de las 13 claves que `reporteValido()` enumera en `firestore.rules`, y
 * las que faltaban eran justo las que el §5.1 prohíbe publicar:
 * `reportadoPor.uid`, `reportadoPor.email`, más `estado`, `intentos`, `github` y
 * `error`. O sea que el barrido que promete «ningún string de la entrada llega
 * crudo al issue público» no barría los strings privados del reporte. Lo
 * encontró el `auditor-privacidad` sobre B-137.
 *
 * Con las cinco agregadas el barrido de centinelas sigue verde —ninguna está
 * interpolada hoy— y eso es el punto: entran a la garantía desde ahora.
 */
const REPORTE = {
  tipo: 'bug',
  titulo: 'No me deja guardar el borrador',
  descripcion: 'Cargo el taller y no me deja guardar.',
  pasos: 'Entrar, cargar, guardar.',
  severidad: 'molesta',
  creadoEn: new Date('2026-08-21T22:00:00Z'),
  contexto: {
    pantalla: 'nueva-actividad',
    url: '/admin',
    versionPanel: '1.0.1+5e2cb50',
    navegador: 'Safari',
    ventana: '390x844',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
  },
  actividad: { id: 'act1' },
  reportadoPor: { uid: 'uid_test', email: 'admin@ejemplo.com' },
  // Las cinco que faltaban. Las dos primeras son las que el §5.1 nombra.

  estado: 'pendiente',
  intentos: 0,
  github: null,
  error: null,
  // B-580 — las dos que solo existen después de la creación (ver el
  // docblock de `clavesDelReporteEnLasReglas` de abajo: sin esto el barrido
  // de centinelas es ciego a cualquier campo que se escriba por
  // `reintentoValido`/`resueltoValido` y no por `reporteValido`).
  actualizadoEn: new Date('2026-09-03T12:00:00Z'),
  resuelto: false,
};


/**
 * Las claves que el cliente puede escribir en `/reportes/{id}`, leídas de
 * las reglas — creación (`reporteValido`) **y** las dos escrituras
 * post-creación (`reintentoValido` de B-31, `resueltoValido` de B-580).
 *
 * El fixture de arriba tiene que cubrirlas todas, y esta lista es la que lo
 * obliga: derivarla del archivo en vez de escribirla acá es lo que hace que una
 * clave nueva en el modelo del reporte entre sola al barrido, sin que nadie se
 * acuerde. Es el mismo autoexigirse de `tests/fixtures/centinelas.ts` contra
 * `src/types/actividad.ts`.
 *
 * **Por qué las dos post-creación entran acá y no solo en `reporteValido`.**
 * Encontrado por el `auditor-privacidad` sobre B-580: `resuelto` (y
 * `actualizadoEn`) se escriben por `resueltoValido()`/`reintentoValido()`,
 * nunca por `reporteValido()`, así que sin esto quedaban fuera del fixture
 * `REPORTE` y el barrido de centinelas (`B-361` de abajo) los daba por
 * cubiertos sin haberlos mirado nunca — el modo de falla más caro que puede
 * tener un barrido: parece cobertura y no lo es. Es clase, no instancia:
 * cualquier campo que se agregue mañana a una escritura post-creación corre
 * el mismo riesgo si no entra acá.
 */
const clavesDelReporteEnLasReglas = (): string[] => {
  const reglas = fuente('firestore.rules');

  const clavesDeUnaFuncion = (nombreFuncion: string, patron: RegExp): string[] => {
    const desde = reglas.indexOf(`function ${nombreFuncion}()`);
    if (desde === -1) {
      throw new Error(`no se encontró function ${nombreFuncion}() en firestore.rules`);
    }
    const match = patron.exec(reglas.slice(desde));
    if (!match) throw new Error(`no se encontró la lista de claves de ${nombreFuncion}()`);
    return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  };

  const creacion = clavesDeUnaFuncion('reporteValido', /let campos = \[([\s\S]*?)\];/);
  // El primer `.hasOnly([...])` de cada función es el que acota qué campos
  // puede tocar esa escritura — es el mismo que se lee para armar la regla.
  const reintento = clavesDeUnaFuncion('reintentoValido', /\.hasOnly\(\[([\s\S]*?)\]\)/);
  const resuelto = clavesDeUnaFuncion('resueltoValido', /\.hasOnly\(\[([\s\S]*?)\]\)/);

  return [...new Set([...creacion, ...reintento, ...resuelto])];
};


const ACTIVIDAD = { titulo: 'Taller de crónica', slug: 'taller-de-cronica' };

describe('clase de B-81 · el saneador va en un punto de paso obligado', () => {
  it('el issue sigue saliendo sin centinelas cuando el texto libre los trae', () => {
    // La instancia de B-81, generalizada a los tres campos de texto libre: es
    // lo que ya funciona, y sirve de control del chequeo de abajo.
    const issue = construirIssue({
      id: 'rep1',
      reporte: { ...REPORTE, titulo: CENTINELA, descripcion: CENTINELA, pasos: CENTINELA },
      actividad: ACTIVIDAD,
    });
    expect(JSON.stringify(issue)).not.toContain('zoom.us');
  });

  /**
   * **Cerrado por B-137** (2026-09-02): `construirIssue` sanea su salida en un
   * punto único —el `title` y el `body` ya armados— en vez de campo por campo.
   *
   * Los cuatro valores que se colaban —`id` del reporte, `actividad.slug`,
   * `reporte.actividad.id` y `severidad`— eran ids o enums que `reporteValido()`
   * acota en las reglas, así que no filtraban nada; lo que se cerró es la clase,
   * no una fuga. El aserto de acá es el que mira desde afuera (ningún centinela
   * sobrevive) y el de abajo el que mira la forma (a lo sumo dos aplicaciones).
   * Hacen falta los dos: el primero solo pasa si nada se escapa, el segundo solo
   * pasa si el saneador está en un lugar y no en siete, y ninguno implica al
   * otro — se podría sanear siete veces y no filtrar nada, que es justo el estado
   * del que se venía.
   */
  it('B-81: ningún string de la entrada llega crudo al issue público', () => {
    const issue = construirIssue({
      id: CENTINELA,
      reporte: conCentinelas(REPORTE) as Record<string, unknown>,
      actividad: conCentinelas(ACTIVIDAD) as { titulo: string; slug: string },
    });
    expect(JSON.stringify(issue)).not.toContain('zoom.us');
  });

  it('B-137: el saneador se aplica sobre la salida, no en cada campo', () => {
    const src = fuente('functions/reportes.js');
    const desde = src.indexOf('export const construirIssue');
    const cuerpo = src.slice(desde);
    const aplicaciones = [...cuerpo.matchAll(/\bredactar\(/g)].length;
    // Dos como máximo: el `title` y el `body`, una vez cada uno.
    expect(aplicaciones).toBeLessThanOrEqual(2);
  });

  it('B-361: la identidad de quien reporta no está interpolada, con o sin saneador', () => {
    /*
     * La garantía que ningún otro aserto daba. `reportadoPor.uid` y
     * `reportadoPor.email` no se publican por **enumeración** —el cuerpo elige
     * qué interpola— y no por el saneador, que solo tapa mails y links. Así que
     * se prueba con un centinela que el saneador deja pasar: si el campo se cuela,
     * sale entero y el test falla.
     */
    const issue = construirIssue({
      id: 'rep1',
      reporte: {
        ...REPORTE,
        reportadoPor: { uid: `${CENTINELA_CRUDO}_uid`, email: `${CENTINELA_CRUDO}_mail` },
        estado: `${CENTINELA_CRUDO}_estado`,
        github: { numero: 7, url: `${CENTINELA_CRUDO}_url` },
        error: `${CENTINELA_CRUDO}_error`,
      },
      actividad: ACTIVIDAD,
    });
    // Control positivo: el issue se armó de verdad y tiene contenido.
    expect(issue.body).toContain('reportes/rep1');
    expect(JSON.stringify(issue), 'un campo privado del reporte llegó al issue')
      .not.toContain(CENTINELA_CRUDO);
  });

  it('B-361: el fixture de centinelas cubre todas las claves de /reportes/{id}', () => {
    /*
     * La mitad que un barrido no puede dar por sí solo: barre lo que el fixture
     * tiene, así que una clave del modelo que no esté en el fixture queda fuera
     * de la garantía **y el test sigue verde**. Es el modo de falla más caro que
     * puede tener un barrido por centinelas — parece cobertura y no lo es.
     */
    const claves = clavesDelReporteEnLasReglas();
    // Control positivo: si el parseo de las reglas devuelve poco, el aserto de
    // abajo pasa sin haber comparado nada. 15 = las 13 de creación + `resuelto`
    // y `actualizadoEn`, que solo entran por las escrituras post-creación.
    expect(claves.length).toBeGreaterThanOrEqual(15);
    expect(claves).toContain('reportadoPor');
    expect(claves).toContain('resuelto');

    const faltan = claves.filter((k) => !(k in REPORTE));
    expect(faltan, 'claves del reporte que el barrido no está mirando').toEqual([]);
  });

  it('B-580: `resuelto` es del panel y no llega al issue público (§5.1, trampa 5)', () => {
    /*
     * No es texto libre —no hace falta el `CENTINELA_CRUDO`, `conCentinelas`
     * lo deja pasar tal cual porque no es un string— pero tiene que seguir
     * sin aparecer en el issue bajo ningún nombre: es la marca de qué se
     * muestra en la bandeja del panel, no algo que el issue público necesite
     * decir. Si algún día se agrega una línea "Resuelto: sí/no" al cuerpo,
     * este test tiene que actualizarse a propósito, no romperse en silencio.
     */
    const issue = construirIssue({
      id: 'rep1',
      reporte: { ...REPORTE, resuelto: true },
      actividad: ACTIVIDAD,
    });
    // Control positivo: el issue se armó de verdad y tiene contenido.
    expect(issue.body).toContain('reportes/rep1');
    expect(JSON.stringify(issue), '`resuelto` llegó al issue público').not.toContain('resuelto');
  });

  it('B-362: sanea ANTES de recortar, así un link cerca de los 200 no sale partido', () => {
    /*
     * El docblock de `construirIssue` afirma que el orden importa, y era la única
     * parte del repo donde esa regla estaba escrita. Lo señaló el
     * `auditor-privacidad` sobre B-137, con el argumento de por qué el recorte es
     * **alcanzable**: `redactar` no acorta, expande — «link de reunión oculto» son
     * 24 caracteres contra los 12 de un `wa.me/…`— así que un título al tope que
     * las reglas permiten (120) lleno de links cortos pasa de 200 al redactarse.
     *
     * Con el orden invertido, ese caso publicaría un `https://us02web.zoom`
     * cortado antes del dominio: un prefijo que ya no matchea el patrón, o sea la
     * mitad de un link de reunión, legible, en un repo público.
     */
    /*
     * Nueve links **cortos**, y la brevedad es el punto: `redactar` cambia cada
     * uno por «link de reunión oculto», que son 24 caracteres. Un `http://wa.me`
     * son 12, así que cada reemplazo suma 12 — con un link largo el saneador
     * acorta y el caso no llega nunca al recorte (se probó: 106 caracteres).
     */
    const titulo = Array(9).fill('http://wa.me').join(' ');
    // El título que se prueba es uno que las reglas aceptan: 120 es el tope.
    expect(titulo.length).toBeLessThanOrEqual(120);

    const issue = construirIssue({
      id: 'rep1',
      reporte: { ...REPORTE, titulo },
      actividad: ACTIVIDAD,
    });

    // Control positivo: el caso llega de verdad al recorte. Sin esto el test
    // pasaría sobre un título que nunca lo alcanza, y no probaría el orden.
    expect(issue.title.length, 'el caso no alcanza el recorte de 200').toBe(200);
    // Y no sobrevive nada del link, ni entero ni en pedazos.
    expect(issue.title).not.toContain('wa.me');
    expect(issue.title).toContain('link de reunión oculto');
  });
});
