/**
 * B-212: los cinco caminos de una opción leen lo mismo.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CAMPOS_TAXONOMIA } from '@/types/actividad';
// B-891 — las cinco salidas que contestan «¿hay tallerista?» y «¿hay libro?».
import { toPublic } from '@/lib/toPublic';
import { fuente, triggers, primero, sinComentarios } from '../fixtures/clases-de-bug';

/**
 * Clase de B-212 · la misma decisión de privacidad, escrita en tres lugares.
 *
 * El documento de `/opciones/{campo}` llega a varias salidas por caminos
 * distintos, y cada uno decide por su cuenta qué de un `ValorOpcion` es público:
 *
 * | Camino | Salida | Forma |
 * |---|---|---|
 * | `opcionesPublicas` (`src/lib/toPublic.ts`) | 1 — `events.json` | objetos `{ slug, label, tono? }` |
 * | `labelsDeOpciones` (`src/lib/vistaPreviaEvento.ts`) | 5 y la vista previa | `Record<slug, label>` |
 * | `cargarLabels` (`functions/index.js`) | 2 — el evento de Calendar | `Record<slug, label>` |
 * | `etiquetasDelDetalle` (`src/lib/contenidoDelSitio.ts`) | 6 — el detalle y su JSON-LD | `Record<slug, label>` |
 * | `tonosDeTipo` (`src/lib/listadoPublico.ts`) | 1 (el HTML del listado) y 6 (la cabecera del detalle) | `Record<slug, tono>` |
 *
 * **Eran tres, fueron cuatro (B-270) y son cinco (B-273).** El de la salida 6 lo
 * encontró el `auditor-privacidad` y era el único sin nada que nombrara qué puede
 * leer; el quinto entró con B-273, cuando el color de la categoría pasó a pintarse
 * también en el detalle.
 *
 * ── El quinto no lee el documento, y por eso es seguro ────────────────────
 * `tonosDeTipo` recibe `OpcionPublica[]`, o sea la **salida** de `opcionesPublicas`
 * y no la taxonomía cruda: estructuralmente no puede alcanzar `huellaCreador`,
 * `usos` ni `aprobada`, porque no están en lo que recibe. Es la misma herencia que
 * hace segura a la salida 7 (la cartelera proyecta el `DetallePublico`, no el
 * documento). Está en la lista igual, porque un camino que no se cuenta es uno que
 * nadie mira el día que cambie de entrada.
 *
 * ── Por qué no se unifican ────────────────────────────────────────────────
 * Los dos primeros podrían compartir algo; el tercero **no puede**, y eso es lo
 * que hace que este test sea la respuesta correcta en vez de un refactor:
 * `functions/` se despliega con su propio `package.json` y no importa hacia
 * arriba (D-20). Es el mismo caso que la copia de `CAMPOS_TAXONOMIA`, donde
 * `docs/10-salud-del-codigo.md` ya dejó escrita la política: «si molesta, la
 * respuesta es un test que compare las dos listas, no un import imposible».
 *
 * ── Qué se afirma ─────────────────────────────────────────────────────────
 * Que cada camino lea de un `ValorOpcion` **exactamente lo que su salida
 * publica**. Si alguno agrega `.usos` para ordenar los chips, o `.huellaCreador`
 * para «mostrar quién la creó», este test lo nombra. Lo pidió el
 * `auditor-privacidad` al notar que la tabla de `07-seguridad.md` atribuía todo a
 * `opcionesPublicas`, que no interviene en tres de los cinco caminos.
 *
 * ── `tono` es de dos de los cinco, y por eso la lista es por camino ──────
 * D-150 agregó el matiz de la categoría, que **sí es público** —el sitio lo
 * necesita para pintar el color— y lo llevan **dos**: `opcionPublica`, que lo
 * emite al `events.json`, y `tonosDeTipo`, que lo consume de ahí para pintar (B-273).
 * Los otros tres producen un `Record<slug, label>` para resolver una etiqueta: un
 * color ahí no tendría dónde ir, así que leerlo sería el síntoma de que alguien
 * está por publicarlo en una salida que no lo pidió.
 *
 * Escribir `PERMITIDAS` como una lista sola habría sido lo cómodo, y habría
 * abierto todos los caminos de una vez por un campo que necesita dos.
 */
describe('clase de B-212 · los cinco caminos de una opción leen lo mismo', () => {
  const CAMINOS = [
    // El `events.json` es el único que publica el color de la categoría (D-150).
    { archivo: 'src/lib/toPublic.ts', funcion: 'opcionPublica', permitidas: ['slug', 'label', 'tono'] },
    { archivo: 'src/lib/vistaPreviaEvento.ts', funcion: 'labelsDeOpciones', permitidas: ['slug', 'label'] },
    // B-77 la mudó de `functions/index.js` a su propio módulo: el caché de
    // etiquetas lo comparten los dos triggers del lado de Calendar.
    { archivo: 'functions/etiquetas.js', funcion: 'cargarLabels', permitidas: ['slug', 'label'] },
    /*
     * El cuarto, que faltaba — lo encontró el `auditor-privacidad` al cerrar
     * B-270. Alimenta la salida 6 (la página de detalle y su JSON-LD), que es la
     * que un bot cosecha primero y la que se queda en Google, y era el único de
     * los cuatro sin nada que nombrara qué puede leer.
     *
     * El agujero se volvió consecuente justo con D-150: es el primer campo de
     * `ValorOpcion` que **sí** es público pero **de una sola salida**, así que el
     * reflejo del próximo cambio —«pintemos la categoría también en el detalle»—
     * escribiría `.tono` acá sin que nada lo dijera. Y el que venga después con un
     * campo que no sea publicable pasaría por el mismo hueco.
     */
    {
      archivo: 'src/lib/contenidoDelSitio.ts',
      funcion: 'etiquetasDelDetalle',
      permitidas: ['slug', 'label'],
    },
    /*
     * El quinto, de B-273. Es el que el docblock de arriba anticipaba —«el reflejo
     * del próximo cambio: pintemos la categoría también en el detalle»— y entró por
     * donde correspondía: `etiquetasDelDetalle` sigue leyendo `['slug','label']` y
     * el color va por su propio camino, que además parte de la lista **ya
     * proyectada**. Se cuenta igual: lo que no está en esta lista no lo mira nadie.
     */
    { archivo: 'src/lib/listadoPublico.ts', funcion: 'tonosDeTipo', permitidas: ['slug', 'tono'] },
  ];

  /** Lo que **algún** camino puede leer. Lo que ninguno puede sale de restarlo. */
  const PERMITIDAS = [...new Set(CAMINOS.flatMap((c) => c.permitidas))];

  /**
   * Los campos de `ValorOpcion` que **no** son públicos, derivados del modelo y
   * no escritos a mano: si mañana se agrega uno, entra solo a este chequeo.
   *
   * ── Por qué se busca el nombre del campo y no la variable ─────────────────
   * La primera versión de este test rastreaba accesos a través de una variable
   * llamada `v` (`v.usos`, `v.huellaCreador`). **No detectaba nada realista:** se
   * probó metiendo un `.sort((a, b) => b.usos - a.usos)` en `labelsDeOpciones` y
   * el test siguió en verde, porque la variable se llamaba `b`. Un chequeo que
   * depende del nombre que eligió quien escribió el código no verifica el código,
   * verifica la convención de nombres.
   */
  const PROHIBIDAS = (() => {
    const src = sinComentarios(fuente('src/types/actividad.ts'));
    const desde = src.indexOf('export interface ValorOpcion');
    const cuerpo = src.slice(desde, src.indexOf('}', desde));
    return [...cuerpo.matchAll(/^\s{2}(\w+)\??:/gm)]
      .map((m) => m[1]!)
      .filter((c) => !PERMITIDAS.includes(c));
  })();

  /**
   * El cuerpo de una función, desde su nombre hasta el próximo `export`/`const`
   * de nivel superior. Alcanza para estas tres, que son cortas; lo que importa es
   * que no cruce hacia la función siguiente.
   */
  const cuerpo = (archivo: string, funcion: string): string => {
    const src = sinComentarios(fuente(archivo));
    const desde = src.indexOf(funcion);
    expect(desde, `no encontré \`${funcion}\` en ${archivo}`).toBeGreaterThan(-1);
    const resto = src.slice(desde);
    const corte = resto.slice(1).search(/\n(?:export )?const \w/);
    return corte === -1 ? resto : resto.slice(0, corte + 1);
  };

  it('los cinco caminos existen, y la lista de campos prohibidos salió del modelo', () => {
    /*
     * Control positivo en las dos mitades. Sin la primera, el `it` de abajo
     * recorrería cuerpos vacíos; sin la segunda, compararía contra una lista
     * vacía de campos prohibidos y no podría fallar nunca.
     */
    for (const { archivo, funcion, permitidas } of CAMINOS) {
      const src = cuerpo(archivo, funcion);
      expect(src.length, `${funcion} salió vacío`).toBeGreaterThan(20);
      // Y que cada camino lea de verdad **las suyas**: si no, no es el camino que
      // creemos y el chequeo de abajo mira otra cosa.
      for (const permitida of permitidas) {
        expect(src, `${funcion} no lee \`${permitida}\``).toContain(`.${permitida}`);
      }
    }

    expect(PROHIBIDAS.length, 'no se pudieron derivar los campos de ValorOpcion').toBeGreaterThan(
      3,
    );
    expect(PROHIBIDAS).toContain('huellaCreador');
    expect(PROHIBIDAS).toContain('usos');
  });

  it('ninguno menciona un campo de la opción que no sea público', () => {
    const deMas: string[] = [];

    for (const { archivo, funcion, permitidas } of CAMINOS) {
      const src = cuerpo(archivo, funcion);
      // Lo prohibido para **este** camino: lo que no es público más lo que es
      // público pero de otra salida (`tono` fuera del `events.json`).
      for (const prop of [...PROHIBIDAS, ...PERMITIDAS.filter((p) => !permitidas.includes(p))]) {
        // `.usos` y no `usos`: se busca el **acceso**, sin importar de qué
        // variable. Así `b.usos` dentro de un `sort` cuenta igual que `v.usos`.
        if (src.includes(`.${prop}`)) deMas.push(`${archivo} · ${funcion} lee \`${prop}\``);
      }
    }

    expect(
      [...new Set(deMas)],
      'un camino de /opciones/* lee un campo que no es público (§4.4, §5.1)',
    ).toEqual([]);
  });
});
