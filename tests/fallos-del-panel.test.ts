/**
 * **Qué dice el cartel rojo del panel** — B-929, reportado por el dueño.
 *
 * El síntoma era «Failed to get document because the client is offline» en el
 * cartel: texto del SDK, en inglés, hablando de «document». Lo que vuelve esto un
 * ítem y no una queja de estilo es que **el panel ya sabía lo que le pasaba**:
 * `clasificarFalloGuardado` mapeaba `unavailable` a `motivo: 'red'` desde antes,
 * así que la métrica quedaba bien etiquetada mientras la persona leía inglés.
 *
 * Por eso el caso que más importa de este archivo no es ninguno de los textos:
 * es **que las dos mitades salgan de la misma clasificación**. Dos
 * clasificadores —uno para medir, otro para hablar— se separan sin que nada
 * falle, y el día que se separen la métrica dice «red» y el cartel dice otra
 * cosa (la clase de B-88).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { TEXTO_DEL_BORRADOR, textoDeFallo } from '@/lib/fallosDelPanel';
import { MOTIVOS_FALLO, clasificarFalloGuardado } from '@/lib/analytics-eventos';
import {
  _fijarVerificacion,
  _resetVerificacion,
  TITULO_SIN_VERIFICAR,
} from '@/lib/verificacionDelNavegador';

/** Un error del SDK: lo que importa es el `code`, no el mensaje. */
const deFirebase = (code: string, message = 'Something went wrong in English') => {
  const e = new Error(message) as Error & { code: string };
  e.code = `firestore/${code}`;
  return e;
};

const RESPALDO = 'No se pudo guardar la librería';

describe('el cartel habla en castellano y dice qué hacer', () => {
  it('sin conexión: qué pasó, qué NO pasó, y qué hacer', () => {
    const texto = textoDeFallo(deFirebase('unavailable'), { respaldo: RESPALDO });
    /*
     * Las tres cosas que nadie puede deducir de «the client is offline». La que
     * más falta hace es la del medio: con el mensaje del SDK la duda inmediata
     * es si la escritura quedó a medias — y no queda a medias, o entró o no.
     */
    expect(texto).toContain('Se cortó la conexión');
    expect(texto).toContain('No se guardó nada');
    expect(texto).toContain('probá de nuevo');
    // Y nada del mensaje original.
    expect(texto).not.toContain('English');
  });

  it('`deadline-exceeded` es el mismo caso: no hay dos frases para lo mismo', () => {
    expect(textoDeFallo(deFirebase('deadline-exceeded'), { respaldo: RESPALDO })).toBe(
      textoDeFallo(deFirebase('unavailable'), { respaldo: RESPALDO }),
    );
  });

  it('sin permiso: la salida accionable es renovar la sesión, y lo dice', () => {
    /*
     * No es un cliché: el permiso viaja en el claim del token
     * (`setCustomUserClaims`), así que a una cuenta que acaba de recibirlo el
     * panel le sigue diciendo que no hasta que renueve. Es el primer caso que le
     * pasa a quien recibe acceso, y sin esta frase el camino no se adivina.
     */
    const texto = textoDeFallo(deFirebase('permission-denied'), { respaldo: RESPALDO });
    expect(texto).toContain('no tiene permiso');
    expect(texto).toContain('salí y volvé a entrar');
  });

  it('sin sesión: entrar de nuevo', () => {
    const texto = textoDeFallo(deFirebase('unauthenticated'), { respaldo: RESPALDO });
    expect(texto).toContain('Se cerró tu sesión');
  });
});

describe('lo que NO se traduce, y es una decisión', () => {
  it('los mensajes propios salen tal cual: ya están en castellano y nombran el dato', () => {
    /*
     * «Fecha inválida: "31/02"» dice **cuál** fecha está mal. Taparlo con una
     * frase genérica sería perder lo único accionable que hay, y es lo contrario
     * de lo que este módulo vino a hacer.
     */
    const texto = textoDeFallo(new Error('Fecha inválida: "31/02"'), { respaldo: RESPALDO });
    expect(texto).toBe('Fecha inválida: "31/02"');
  });

  it('lo que no es un `Error` muestra el respaldo, que dice qué falló', () => {
    // El respaldo sabe **qué operación** era; un texto genérico no.
    expect(textoDeFallo('no es un error', { respaldo: RESPALDO })).toBe(RESPALDO);
    expect(textoDeFallo(null, { respaldo: RESPALDO })).toBe(RESPALDO);
    expect(textoDeFallo(new Error(''), { respaldo: RESPALDO })).toBe(RESPALDO);
  });

  /*
   * **Un `Error` pelado y sin código del SDK es nuestro, y se muestra.**
   *
   * Hasta que lo cobró el `auditor-trampas`, esto se decidía por el motivo del
   * clasificador, que solo distingue `fecha-invalida`. Todo el resto caía en
   * `desconocido` y se tapaba con el respaldo — así que `opciones.ts` e
   * `historial.ts`, que tiran ocho mensajes propios, pasaron con B-929 a decir
   * **menos** de lo que decían antes. Justo al revés del ítem.
   */
  it('un mensaje propio del proyecto se muestra tal cual, aunque el clasificador no lo distinga', () => {
    const propios = [
      '«Gratis» es una opción base: no se puede editar ni borrar desde el panel (§4.3).',
      'Esa dirección web ya la usa otra actividad. Cambiala desde el formulario antes de restaurarla.',
      'La etiqueta no puede quedar vacía.',
    ];
    for (const mensaje of propios) {
      expect(textoDeFallo(new Error(mensaje), { respaldo: RESPALDO })).toBe(mensaje);
    }
  });

  it('pero un error del runtime NO: ése es un bug nuestro, y su frase es en inglés', () => {
    /*
     * `instanceof Error` también es cierto para un `TypeError`, así que el
     * criterio es `constructor === Error`. Sin esa distinción, «Cannot read
     * properties of undefined» llegaría al cartel — que es exactamente la clase
     * de frase que este módulo vino a sacar de la pantalla, con otro idioma de
     * origen.
     */
    expect(
      textoDeFallo(new TypeError('Cannot read properties of undefined'), { respaldo: RESPALDO }),
    ).toBe(RESPALDO);
    expect(textoDeFallo(new RangeError('Invalid array length'), { respaldo: RESPALDO })).toBe(
      RESPALDO,
    );
  });

  it('y si el SDK trajo un código, se agrega: es lo que hace reportable el fallo', () => {
    /*
     * El código no es el mensaje en inglés: es una etiqueta corta de vocabulario
     * cerrado. Sin él, «no se pudo guardar» es lo mismo para quince causas y el
     * reporte que llegue no va a poder decir cuál fue.
     */
    const texto = textoDeFallo(deFirebase('failed-precondition'), { respaldo: RESPALDO });
    expect(texto).toBe(`${RESPALDO} (failed-precondition)`);
    expect(texto).not.toContain('English');
  });

  it('NUNCA sale el `message` del SDK, ni siquiera en desconocido', () => {
    /*
     * Es la decisión del ítem. Lo que el SDK escribe está en inglés, habla de
     * «document» y a veces trae el path — que es lo mismo que
     * `clasificarFalloGuardado` ya evita mandar a GA4 por si arrastra contenido.
     *
     * MUTACIÓN PROBADA: devolviendo `error.message` en la rama de `desconocido`,
     * este caso se pone rojo.
     */
    for (const code of ['failed-precondition', 'aborted', 'internal', 'not-found']) {
      const texto = textoDeFallo(deFirebase(code, 'Failed to get document because…'), {
        respaldo: RESPALDO,
      });
      expect(texto, code).not.toContain('Failed to get document');
    }
  });
});

describe('el borrador se promete solo donde existe', () => {
  it('con autoguardado y sin conexión, se dice que lo escrito sobrevivió', () => {
    const texto = textoDeFallo(deFirebase('unavailable'), {
      respaldo: RESPALDO,
      hayBorrador: true,
    });
    expect(texto).toContain(TEXTO_DEL_BORRADOR);
  });

  it('sin autoguardado NO se promete, aunque sea el mismo error', () => {
    /*
     * El autoguardado existe solo en el formulario de actividad (D-122).
     * Prometerlo desde la bandeja o desde taxonomías sería decirle a alguien que
     * su trabajo está a salvo cuando no lo está — la clase de mentira que cuesta
     * más que el error original.
     */
    const texto = textoDeFallo(deFirebase('unavailable'), { respaldo: RESPALDO });
    expect(texto).not.toContain(TEXTO_DEL_BORRADOR);
  });

  it('y tampoco en `permisos` ni en `sin-sesion`, donde hay que hacer otra cosa', () => {
    for (const code of ['permission-denied', 'unauthenticated']) {
      const texto = textoDeFallo(deFirebase(code), { respaldo: RESPALDO, hayBorrador: true });
      expect(texto, code).not.toContain(TEXTO_DEL_BORRADOR);
    }
  });
});

describe('una sola clasificación para medir y para hablar (B-88)', () => {
  /**
   * **El caso que sostiene el ítem entero.**
   *
   * Si `textoDeFallo` clasificara por su cuenta, el día que una de las dos
   * cambie la métrica diría «red» y el cartel diría otra cosa — que es
   * exactamente el estado que B-929 encontró, al revés: la métrica bien y el
   * cartel en inglés.
   */
  it('todo motivo del vocabulario tiene una salida decidida, y ninguna es el mensaje crudo', () => {
    // Control positivo: si el vocabulario viniera vacío, el `for` no miraría nada.
    expect(MOTIVOS_FALLO.length).toBeGreaterThan(4);

    for (const motivo of MOTIVOS_FALLO) {
      const texto = textoDeFallo(motivo, { respaldo: RESPALDO });
      expect(texto, motivo).toBeTruthy();
      expect(texto, motivo).not.toContain('English');
    }
  });

  it('el texto sale del motivo que la métrica va a reportar, no de otro', () => {
    /*
     * Se afirma el emparejamiento y no los textos: lo que no puede pasar es que
     * las dos mitades miren errores distintos.
     */
    for (const code of ['unavailable', 'permission-denied', 'unauthenticated']) {
      const e = deFirebase(code);
      const { motivo } = clasificarFalloGuardado(e);
      // El mismo error, clasificado una vez, produce el texto de ese motivo.
      expect(textoDeFallo(e, { respaldo: RESPALDO }), code).toBe(
        textoDeFallo(motivo, { respaldo: RESPALDO }),
      );
    }
  });
});

describe('«no hay internet» y «no pudimos verificar tu navegador» son dos textos (B-930)', () => {
  afterEach(() => _resetVerificacion());

  /**
   * **El ítem en un caso.** Con App Check exigido, un navegador sin token
   * recibe el mismo `unavailable` que un wifi caído. Con el estado de la
   * verificación a mano, la frase deja de mandar a esperar a quien tiene que
   * apagar una extensión.
   *
   * MUTACIÓN PROBADA (2026-09-23): volviendo la rama de `unavailable` de
   * `clasificarFalloGuardado` a `{ motivo: 'red', codigo }` a secas, este caso y
   * el de la métrica se ponen rojos; los de «sin conexión» de arriba siguen
   * verdes, que es por qué hace falta éste.
   */
  it('con el navegador sin verificar, `unavailable` no dice «se cortó la conexión»', () => {
    _fijarVerificacion('sin-verificar');
    const texto = textoDeFallo(deFirebase('unavailable'), { respaldo: RESPALDO });

    expect(texto.startsWith(TITULO_SIN_VERIFICAR)).toBe(true);
    expect(texto).toContain('No se guardó nada');
    expect(texto).toContain('no es la conexión');
    expect(texto).not.toContain('Se cortó la conexión');
    expect(texto).not.toContain('English');
  });

  it('`deadline-exceeded` va con `unavailable`: los dos pueden ser un token que no llegó', () => {
    _fijarVerificacion('sin-verificar');
    expect(textoDeFallo(deFirebase('deadline-exceeded'), { respaldo: RESPALDO })).toBe(
      textoDeFallo(deFirebase('unavailable'), { respaldo: RESPALDO }),
    );
  });

  /**
   * Mientras el token está en camino (dentro del umbral) o ya llegó, un
   * `unavailable` es la red: el caso de siempre no cambia.
   */
  it.each(['no-aplica', 'verificando', 'verificado'] as const)(
    'con `%s`, `unavailable` sigue siendo «se cortó la conexión»',
    (estado) => {
      _fijarVerificacion(estado);
      expect(textoDeFallo(deFirebase('unavailable'), { respaldo: RESPALDO })).toContain(
        'Se cortó la conexión',
      );
    },
  );

  it('solo cambia lo que es de red: sin permiso sigue siendo sin permiso', () => {
    _fijarVerificacion('sin-verificar');
    expect(clasificarFalloGuardado(deFirebase('permission-denied')).motivo).toBe('permisos');
    expect(clasificarFalloGuardado(deFirebase('unauthenticated')).motivo).toBe('sin-sesion');
  });

  it('la métrica dice lo mismo que el cartel: `verificacion`, no `red`', () => {
    _fijarVerificacion('sin-verificar');
    expect(clasificarFalloGuardado(deFirebase('unavailable'))).toEqual({
      motivo: 'verificacion',
      codigo: 'unavailable',
    });
    // Y el contexto explícito le gana al store, que es lo que usan los tests.
    expect(
      clasificarFalloGuardado(deFirebase('unavailable'), { navegadorSinVerificar: false }).motivo,
    ).toBe('red');
  });

  it('con autoguardado, el borrador se promete igual que en `red`', () => {
    _fijarVerificacion('sin-verificar');
    const texto = textoDeFallo(deFirebase('unavailable'), {
      respaldo: RESPALDO,
      hayBorrador: true,
    });
    expect(texto.endsWith(TEXTO_DEL_BORRADOR)).toBe(true);
  });
});
