/**
 * **«No se pueden subir imágenes»: el error que ya se había arreglado y seguía
 * apareciendo** — reporte del dueño, 2026-09-07.
 *
 * La cadena completa, porque es lo que este archivo cuida:
 *
 * 1. el SDK de Storage se carga diferido (B-09, D-51), así que el código de la
 *    subida vive en un chunk con el hash del build en el nombre;
 * 2. Hosting sirve el HTML con `no-cache` y `/_astro/**` como `immutable`, así que
 *    **una pestaña abierta se queda con el HTML viejo**, que apunta a un chunk que
 *    el deploy siguiente ya borró;
 * 3. el `import()` se lleva un 404 → el error **no** es un `ImagenRechazada` → cae
 *    en el genérico «no se pudo subir la imagen, volvé a intentar en un momento»;
 * 4. y ese texto manda a repetir lo único que no puede funcionar.
 *
 * B-590 había traducido los códigos de **Storage**, que es lo que el dueño
 * recordaba haber arreglado. Este fallo nunca llega a Storage.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  MENSAJE_PESTANIA_VIEJA,
  PROMESA_DEL_BORRADOR,
  VERSION_BORRADOR_DE_ESTA_PROMESA,
  esFalloDeCarga,
} from '@/lib/carga-diferida';
import { VERSION_BORRADOR } from '@/lib/formulario/autoguardado';
import { MOTIVOS_IMAGEN } from '@/lib/analytics-eventos';

const fuente = (rel: string): string => readFileSync(`${process.cwd()}/${rel}`, 'utf8');

/**
 * Lo que cada motor tira cuando un `import()` no llega. Son cadenas **de otro**,
 * así que están acá con el navegador al lado: si alguna se renombra, este archivo
 * es el que lo va a decir.
 */
const REALES = [
  {
    motor: 'Chromium',
    error: new TypeError(
      'Failed to fetch dynamically imported module: https://agenda-literaria.web.app/_astro/subir-imagen.Bq3x9.js',
    ),
  },
  { motor: 'Firefox', error: new TypeError('error loading dynamically imported module') },
  { motor: 'Safari', error: new TypeError('Importing a module script failed.') },
  {
    motor: 'un rewrite que devuelve HTML donde iba JS',
    error: new SyntaxError("Unexpected token '<'"),
  },
];

describe('esFalloDeCarga reconoce «el módulo no llegó» — reporte del 2026-09-07', () => {
  it('las cuatro formas reales', () => {
    for (const { motor, error } of REALES) {
      expect(esFalloDeCarga(error), motor).toBe(true);
    }
  });

  it('y no confunde con los errores del propio flujo de subida', () => {
    /*
     * **El control que importa.** Si esto diera `true` para un rechazo de imagen,
     * el mensaje escrito para esa persona —«esa foto pesa 8 MB», «la sesión
     * venció»— se reemplazaría por «recargá», que no tiene nada que ver. Los
     * rechazos se reconocen por `name` en el componente, pero esta función corre
     * antes y sobre cualquier cosa.
     */
    const rechazo = Object.assign(new Error('Esa foto pesa más de 3 MB.'), {
      name: 'ImagenRechazada',
    });
    expect(esFalloDeCarga(rechazo)).toBe(false);
    expect(esFalloDeCarga(new TypeError('x is not a function'))).toBe(false);
    expect(esFalloDeCarga(new Error('storage/unauthorized'))).toBe(false);
    // Y lo que no es un error, sin romperse: un `throw 'texto'` o un `null`.
    expect(esFalloDeCarga(null)).toBe(false);
    expect(esFalloDeCarga(undefined)).toBe(false);
    expect(esFalloDeCarga('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('un `SyntaxError` que no es de módulos no cuenta', () => {
    // El `SyntaxError` está en la lista por el caso del rewrite; un error de
    // sintaxis cualquiera no es «la pestaña quedó vieja».
    expect(esFalloDeCarga(new SyntaxError('Invalid regular expression flags'))).toBe(false);
  });
});

describe('el mensaje dice las dos causas y la acción — y no miente', () => {
  it('nombra la conexión Y la pestaña vieja, porque no se distinguen', () => {
    /*
     * Sin red, Chromium tira **el mismo** `TypeError` que con el chunk borrado.
     * Elegir una de las dos causas sería acertar la mitad de las veces; nombrar
     * las dos y ofrecer la única acción que sirve para ambas es lo honesto, y es
     * el mismo criterio de `motivoDeSubidaFallida` (B-590).
     */
    expect(MENSAJE_PESTANIA_VIEJA).toMatch(/conexión/);
    expect(MENSAJE_PESTANIA_VIEJA).toMatch(/pestaña/);
    expect(MENSAJE_PESTANIA_VIEJA).toMatch(/[Rr]ecarg/);
  });

  it('la promesa del borrador va APARTE, porque solo es cierta en un lugar', () => {
    /*
     * **Es la parte que faltaba en todo el flujo**: un «recargá» sin ella se lee
     * como «perdé lo que estabas haciendo», y por eso el reporte llegó dos veces.
     *
     * Pero está partida, y lo pidió el `auditor-privacidad`: el autoguardado
     * existe **solo en el formulario de actividad** (D-122). El de **reportes** no
     * lo tiene —y es el origen de B-191, «reporté algo y todo lo que escribí se
     * borró»— así que pegarle la frase a un mensaje genérico la vuelve una promesa
     * falsa justo ahí.
     *
     * MUTACIÓN PROBADA: meter la promesa dentro de `MENSAJE_PESTANIA_VIEJA` deja
     * este caso en rojo.
     */
    expect(MENSAJE_PESTANIA_VIEJA, 'la promesa se colό al mensaje genérico').not.toMatch(
      /guardad|ofrecer/,
    );
    expect(PROMESA_DEL_BORRADOR).toMatch(/guardado en este navegador/);
    /*
     * **Y no promete que se lo vayan a ofrecer**, que es la corrección que el
     * `auditor-privacidad` hizo sobre su propio hallazgo: eso depende del build
     * **siguiente**. Si el deploy que hace aparecer el mensaje —el que borró el
     * chunk— subió `VERSION_BORRADOR`, `leerBorradorLocal` descarta el borrador al
     * leerlo, así que «te lo va a ofrecer» sería falso justo en el caso que el
     * mensaje describe. La escritura ya ocurrió; el ofrecimiento no.
     */
    expect(
      PROMESA_DEL_BORRADOR,
      'promete algo que depende del build que se va a cargar',
    ).not.toMatch(/ofrecer|al volver/);
  });

  it('y subir `VERSION_BORRADOR` obliga a revisar esa promesa', () => {
    /*
     * **El hallazgo más fino del `auditor-privacidad`, y el que menos se ve
     * venir.** `leerBorradorLocal` **descarta** el borrador cuando su `version` no
     * es la actual, y esa versión se sube «cuando el formulario cambia de forma».
     * O sea que **el deploy que hace aparecer el mensaje puede ser justo el que
     * borró el borrador**: la promesa nace falsa, en silencio, el día que alguien
     * sube el número.
     *
     * Este caso ata el par. Cuando se ponga en rojo, lo que hay que hacer **no**
     * es actualizar la constante: es decidir qué dice el mensaje en **ese** deploy
     * —lo razonable es acotarlo por una vez— y después alinear los dos números.
     */
    expect(
      VERSION_BORRADOR_DE_ESTA_PROMESA,
      'subió `VERSION_BORRADOR`: el borrador guardado se va a descartar al leerlo, ' +
        'así que la promesa de la recarga es falsa para quien tenga uno de antes',
    ).toBe(VERSION_BORRADOR);
  });

  it('el aviso de versión nueva ya no dice que recargar pierde el trabajo', () => {
    /*
     * La otra mitad del reporte, afirmada sobre el fuente porque es texto de un
     * componente: el aviso estaba **desalentando la única acción que arreglaba el
     * problema**.
     *
     * MUTACIÓN PROBADA: volver el texto a «si recargás ahora, se pierde» deja este
     * caso en rojo.
     */
    const aviso = fuente('src/components/admin/AvisoVersionNueva.tsx');
    const cuerpo = aviso.slice(aviso.indexOf('export function'));
    expect(cuerpo, 'volvió a decir que recargar pierde el trabajo').not.toMatch(
      /si recargás ahora, se pierde/,
    );
    expect(cuerpo, 'el botón volvió a llamarse «sin guardar»').not.toMatch(/Recargar sin guardar/);
    // Y dice la consecuencia concreta de NO recargar, que es la que trajo el reporte.
    expect(cuerpo).toMatch(/subir imágenes/);
  });
});

describe('la subida separa «no llegó el módulo» de «Storage dijo no»', () => {
  it('el `import()` tiene su propio `try` y no cae en el mensaje genérico', () => {
    /*
     * Se afirma sobre el fuente porque el componente monta el SDK de Storage y no
     * hay test que lo ejecute. Lo que se exige es la **forma** del arreglo: el
     * import adentro de su propio `try`, con `esFalloDeCarga` decidiendo y el
     * mensaje propio. Sin eso, el error vuelve al genérico y el reporte vuelve.
     *
     * MUTACIÓN PROBADA: volver a un solo `try` con
     * `const { subirImagen } = await import(...)` arriba deja este caso en rojo.
     */
    const src = fuente('src/components/admin/GaleriaEditor.tsx');
    expect(src).toContain('esFalloDeCarga');
    expect(src).toContain('MENSAJE_PESTANIA_VIEJA');
    // El botón de recargar, que es la mitad accionable del mensaje.
    expect(src).toContain('setDebeRecargar');
    expect(src).toMatch(/Recargar ahora/);
    // Y se mide aparte de los otros rechazos: el arreglo es distinto (recargar).
    expect(src).toContain("medirFuncion('imagen-rechazada', 'carga')");
    /*
     * **El literal atado al vocabulario** — lo pidió el `auditor-privacidad`, y el
     * modo de falla es mudo: `medirFuncion` tipa `detalle` como `string`, y los
     * tests de analítica recorren `MOTIVOS_IMAGEN` en vez de los puntos de uso. Si
     * alguien saca o renombra `'carga'` del vocabulario, esos loops se encogen y
     * quedan **verdes**, el literal de acá degrada a `detalle: 'otro'` y el
     * termómetro de B-805 se apaga sin que nada lo diga.
     */
    expect(MOTIVOS_IMAGEN as readonly string[]).toContain('carga');
  });
});

/**
 * Los `.tsx` del panel, recursivo. Está en el scope del módulo porque lo usan dos
 * `describe`: el de la promesa del borrador y el de los puntos de carga diferida.
 */
const archivosDelPanel = (dir: string): string[] =>
  readdirSync(`${process.cwd()}/${dir}`, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? archivosDelPanel(`${dir}/${e.name}`)
      : e.name.endsWith('.tsx')
        ? [`${dir}/${e.name}`]
        : [],
  );

describe('la promesa del borrador se dice solo donde hay dónde guardarlo', () => {
  /**
   * **El agujero reapareció en el componente gemelo**, y lo encontró el
   * `auditor-documentacion` cerrando B-805: `GaleriaEditor` chequeaba el almacén
   * antes de prometer, y `AvisoVersionNueva` la prometía siempre.
   *
   * Y el aviso es el peor lugar para prometer de más: aparece justamente cuando
   * hay un formulario con cambios sin guardar. En modo privado o con la cuota
   * llena, `guardarBorradorLocal` no guardó nada y el texto empuja a recargar
   * igual.
   *
   * Se verifica **de clase**: cualquier archivo que use la constante tiene que
   * chequear el almacén. El día que aparezca un tercer punto de uso, entra solo.
   *
   * MUTACIÓN PROBADA: sacar el `conBorrador ?` de `AvisoVersionNueva` deja este
   * caso en rojo nombrando el archivo.
   */
  it('los dos puntos de uso preguntan por el almacén', () => {
    const usan = archivosDelPanel('src/components/admin').filter((rel) =>
      fuente(rel).includes('PROMESA_DEL_BORRADOR'),
    );
    expect(usan.length, 'nadie usa la promesa: el chequeo no está midiendo nada').toBeGreaterThan(
      1,
    );

    /*
     * **Se exige el ternario y no solo el import**, porque el import solo no
     * alcanza: al probar la mutación —sacarle el `conBorrador ?` al aviso— el
     * chequeo seguía verde, porque `almacenDelNavegador` seguía importado en el
     * archivo. Un chequeo que pasa con el bug puesto es peor que no tenerlo.
     *
     * Los dos puntos de uso llaman al booleano igual (`conBorrador`), y eso es
     * una **convención a propósito**: cuesta una línea y es lo que hace posible
     * verificar esto sin un parser. Si un tercero lo llama distinto, este caso lo
     * va a decir y la respuesta es renombrarlo, no aflojar el chequeo.
     */
    const sinChequear = usan.filter((rel) => {
      const src = fuente(rel);
      return !/almacenDelNavegador\(\)/.test(src) || !/conBorrador\s*\?/.test(src);
    });
    expect(
      sinChequear,
      'prometen el borrador sin preguntar si el navegador tiene dónde guardarlo ' +
        '(o el booleano no se llama `conBorrador`, que es la convención que hace ' +
        'verificable esto)',
    ).toEqual([]);
  });
});

describe('todo `lazy()` del panel cuelga de un `SiNoCarga` — de clase, no de lista', () => {
  /**
   * **La puerta que el primer arreglo no contó, y la encontraron los dos
   * auditores.** El docblock decía «seis vistas diferidas»; los sitios con
   * `import()` en el panel son más, y uno estaba **fuera de todo límite**: el
   * `lazy(CentroAyuda)` de `BotonAyuda`, que vive en el encabezado.
   *
   * El camino concreto: pestaña abierta desde antes de un deploy → alguien toca
   * **«Ayuda»**, que está visible en todas las pantallas y es el gesto de
   * cualquiera que se traba → el chunk se lleva el mismo 404 → `Suspense` no
   * atrapa errores, no hay límite arriba, React desmonta la island y **el panel
   * queda en blanco**. La falla que B-805 decía haber cerrado, por otra puerta.
   *
   * Por eso el chequeo es **de clase**: se buscan los `lazy(` de todo el panel y
   * se exige que cada archivo que declare uno tenga también un `SiNoCarga`. La
   * puerta que se agregue mañana entra sola.
   */
  it('los archivos que declaran un `lazy` también nombran el límite', () => {
    const conLazy = archivosDelPanel('src/components/admin').filter((rel) =>
      /\blazy\(/.test(fuente(rel)),
    );

    // Control positivo: si el glob dejara de encontrar archivos, el `for` de abajo
    // no correría y el caso pasaría en verde sin haber mirado nada.
    expect(conLazy.length, 'no se encontró ningún `lazy` en el panel').toBeGreaterThan(0);

    const sinLimite = conLazy.filter((rel) => !fuente(rel).includes('SiNoCarga'));
    expect(
      sinLimite,
      'declaran un `lazy` y no lo envuelven: un chunk borrado deja el panel en blanco',
    ).toEqual([]);
  });

  it('y los `await import()` de un handler tienen su propio `try`', () => {
    /*
     * **La otra forma de la misma puerta**, y la que originó el reporte: la subida
     * de imágenes no usa `lazy`, usa un `await import()` adentro de un handler. Ahí
     * el error no pasa por el render, así que ningún límite lo ve — necesita su
     * propio `try` con `esFalloDeCarga`.
     *
     * Lo pidió el `auditor-privacidad`: el chequeo de arriba mira `lazy(`, así que
     * un `await import()` nuevo en cualquier otro punto del panel nacería sin
     * límite, sin mensaje y sin nada rojo.
     */
    const conImportDiferido = archivosDelPanel('src/components/admin').filter((rel) =>
      /await import\(/.test(fuente(rel)),
    );
    expect(
      conImportDiferido.length,
      'no se encontró ningún `await import()` en el panel',
    ).toBeGreaterThan(0);

    const sinGuarda = conImportDiferido.filter((rel) => !fuente(rel).includes('esFalloDeCarga'));
    expect(
      sinGuarda,
      'tienen un `await import()` sin distinguir el fallo de carga: el error cae en un ' +
        'mensaje genérico que manda a repetir lo único que no puede funcionar',
    ).toEqual([]);
  });

  it('y el límite envuelve al `Suspense`, no al revés', () => {
    /*
     * El orden importa y es fácil de escribir al revés: `Suspense` adentro del
     * límite deja que el error de carga llegue al límite; al revés, el `Suspense`
     * queda **arriba** y el error lo atraviesa igual —no atrapa errores— pero el
     * límite ya no está en el camino del `lazy`.
     *
     * Se verifica por posición en el fuente, que es lo que se puede afirmar sin
     * renderizar los diez puntos de carga.
     */
    for (const rel of archivosDelPanel('src/components/admin').filter((r) =>
      /\blazy\(/.test(fuente(r)),
    )) {
      const src = fuente(rel);
      const limite = src.indexOf('<SiNoCarga>');
      const suspense = src.indexOf('<Suspense');
      expect(limite, `${rel}: no envuelve con SiNoCarga`).toBeGreaterThan(-1);
      expect(suspense, `${rel}: no tiene Suspense`).toBeGreaterThan(-1);
      expect(limite, `${rel}: el Suspense quedó por encima del límite`).toBeLessThan(suspense);

      /*
       * **Y el componente diferido se renderiza adentro del límite**, no solo
       * después de él — lo pidió el `auditor-trampas`: comparar posiciones alcanza
       * para los tres archivos de hoy, pero con **dos** `lazy` en un archivo
       * bastaba con envolver uno para que el archivo entero pasara.
       *
       * Se ata por el nombre de la variable: el `const X = lazy(...)` tiene que
       * aparecer como `<X` dentro del rango del límite.
       *
       * **Lo que este chequeo NO cubre, y conviene tenerlo escrito:** un `lazy`
       * declarado en un archivo y renderizado en **otro**. Hoy no existe ninguno;
       * si aparece, esto pediría el `SiNoCarga` en el archivo que declara —el
       * equivocado— y el mensaje empujaría a poner uno de relleno. El día que se
       * centralice la carga diferida, el chequeo hay que rehacerlo por el árbol de
       * render y no por archivo.
       */
      const rango = src.slice(limite, src.indexOf('</SiNoCarga>', limite));
      for (const [, nombre] of src.matchAll(/const (\w+)\s*=\s*lazy\(/g)) {
        expect(
          rango.includes(`<${nombre}`) || src.slice(limite).includes(`<${nombre}`),
          `${rel}: <${nombre}> no se renderiza adentro del SiNoCarga`,
        ).toBe(true);
      }
    }
  });
});
