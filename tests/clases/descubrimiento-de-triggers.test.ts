/**
 * el descubrimiento de triggers sigue viendo lo que hay.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CLASES_DE_TRIGGER, triggers, TRIGGERS, primero, EFECTOS_INCONDICIONALES, WRITE_BACKS_CON_GUARDA } from '../fixtures/clases-de-bug';

describe('el descubrimiento de triggers sigue viendo lo que hay', () => {
  it('encuentra los dieciocho triggers del proyecto', () => {
    // Si esto se rompe, todos los chequeos de abajo dejaron de mirar algo y
    // pasarían en verde sin verificar nada.
    expect(TRIGGERS.map((t) => t.nombre).sort()).toEqual([
      /*
       * B-838 / DEC-13 — la retención de propuestas rechazadas. El cuarto
       * `onSchedule`, y **entró solo**: la clase ya estaba en
       * `CLASES_DE_TRIGGER`, así que lo único que hubo que confirmar a mano es
       * el conteo, que es la parte del chequeo que no se puede derivar.
       *
       * Por qué no cae en los dos chequeos de abajo, que conviene saber el día
       * que se toque: **B-82** (efecto duplicable sin guarda) mira los triggers
       * de documento y éste es un schedule — y su efecto tampoco es duplicable,
       * porque borrar dos veces el mismo documento deja el mismo estado
       * (`ignoreNotFound` en el objeto es justamente eso escrito). **B-85**
       * (leer estado → red → escribir lo leído) sí lo mira, y desde **B-867** lo
       * mira de verdad: hasta entonces esta línea decía «lo único que se escribe
       * es un borrado» como si eso lo sacara de la clase, que es precisamente lo
       * que el detector no veía —B-864 tenía la forma de B-85 con el verbo
       * cambiado—. Hoy borrar cuenta como escribir, este barrido entra con los
       * dos síntomas prendidos, y desde **B-879** lo único que lo deja afuera es
       * la precondición de B-864, declarada abajo en `GUARDAS_DE_BARRIDO`: no
       * hablar con la red dejó de contar, porque la red de un barrido es la
       * corrida entera.
       */
      /*
       * B-830 paso 8 / DEC-11 y **B-863** — cerrar una propuesta borra su
       * imagen: al rechazarla en el acto, al aceptarla una vez verificada la
       * copia promovida. **Se llamaba `borrarImagenAlRechazar`** hasta B-863; el
       * nombre pasó a mentir el día que el cierre dejó de ser uno solo, y sigue
       * siendo **un solo trigger** porque dos `onDocumentWritten` sobre
       * `propuestas/{id}` serían dos handlers del mismo evento peleándose el
       * mismo objeto (B-89).
       *
       * Es un trigger **de documento**, así que a diferencia de su vecino de
       * arriba sí entra a los dos chequeos de abajo, y conviene saber cómo pasa
       * cada uno:
       *
       *  - **B-82** (efecto duplicable sin guarda): el efecto es un `delete()`
       *    con `ignoreNotFound`, o sea idempotente — dos entregas del mismo
       *    evento dejan el mismo estado. Y la guarda que lo hace decidible está
       *    escrita igual: `decidirBorradoDeImagen` actúa **solo en la
       *    transición** a un estado que cierra, no en el estado.
       *  - **B-85** (leer estado → red → escribir lo leído): la rama de B-863
       *    **lee** la actividad y **pregunta** al bucket, pero no escribe nada.
       *    El documento que lo dispara no se toca, y eso es deliberado — es
       *    prueba de qué se pidió, y un write-back volvería a dispararlo
       *    (trampa 3).
       */
      /*
       * B-904 / B-912 / B-917 — la retención de las tres guías. El quinto
       * `onSchedule`, y **entró solo** por la misma puerta que los anteriores:
       * la clase ya estaba en `CLASES_DE_TRIGGER`, así que lo único que hubo que
       * confirmar a mano es el conteo.
       *
       * Cae exactamente donde su vecino `borrarPropuestasVencidas`: **B-82** no
       * lo mira (es un schedule, y borrar dos veces el mismo documento deja el
       * mismo estado), **B-85** sí lo mira con los dos síntomas prendidos y lo
       * deja afuera por su guarda declarada —la precondición de B-864, abajo en
       * `GUARDAS_DE_BARRIDO`— y no por no hablar con la red (B-879). Y acá hay una
       * diferencia que conviene tener escrita: este barrido **no borra nada de
       * Storage**, así que no tiene la mitad sin precondición que allá obligó a
       * elegir cuál perder.
       */
      'borrarFichasVencidas',
      'borrarImagenAlCerrar',
      'borrarPropuestasVencidas',
      'dispararRebuild',
      'guardarVersion',
      // Agregado por B-41 (guardar versión al borrar una actividad). Este test
      // lo detectó solo, que es su razón de ser: si la lista se queda vieja,
      // los chequeos de abajo dejan de mirar el trigger nuevo y pasan en verde
      // sin verificar nada.
      'guardarVersionAlBorrar',
      // El barrido de imágenes huérfanas (B-221): un `onSchedule` más, como
      // `dispararRebuild`. Entró solo porque `onSchedule` ya estaba en
      // `CLASES_DE_TRIGGER` desde el principio — este test se puso rojo por el
      // conteo, que es la parte que sí hay que confirmar a mano.
      'limpiarImagenesHuerfanas',
      // El barrido de subcolecciones `versiones` huérfanas (B-89): otro
      // `onSchedule`, y entró solo por la misma puerta que el anterior. Lo que
      // sí hubo que confirmar a mano es el conteo — que es la parte del chequeo
      // que no se puede derivar.
      'limpiarVersionesHuerfanas',
      // **El primer trigger de Storage del proyecto** (B-220, D-175), y entró
      // solo: las cuatro clases `onObject*` se habían agregado a
      // `CLASES_DE_TRIGGER` el 2026-08-28 —antes de que existiera ninguno,
      // porque era el único momento en que era gratis (D-131 §4)— y este test se
      // puso rojo el día que se escribió el archivo. Es exactamente la promesa
      // de la cabecera cumpliéndose: «un trigger nuevo entra solo».
      'optimizarImagen',
      /*
       * B-960 — el rebuild de las bibliotecas, el cuarto de la familia. **Entró
       * solo** y pasa los dos chequeos por el mismo camino que sus tres
       * hermanos: su efecto es `marcarRebuild` (idempotente: escribe un
       * documento fijo con `merge`) y su llamada **domina** el handler, escrita
       * en la misma forma positiva.
       *
       * Y es la cuarta vez que los cuerpos quedan casi iguales a propósito: el
       * chequeo de B-83 es **textual sobre el cuerpo de cada trigger**, así que
       * un cuerpo mudado a un helper deja de contener la llamada y este archivo
       * **dejaría de mirarlos sin ponerse rojo**.
       */
      'rebuildPorBibliotecas',
      /*
       * B-959 — el rebuild de las efemérides. **Entró solo** por la misma puerta
       * que los cuatro de la Guía, y pasa los dos chequeos por el mismo camino:
       * su efecto es `marcarRebuild` (idempotente) y su llamada **domina** el
       * handler en forma positiva. Lo único distinto es la guarda
       * (`efemerideAmeritaRebuild`, en `functions/efemerides.js`), que además
       * deja afuera los borradores. Y escribe la marca de B-905, así que también
       * es llamador de `marcarPublicada` en el chequeo de la trampa 3.
       */
      'rebuildPorEfemerides',
      /*
       * B-901 — el rebuild cuando cambia una ficha de directorio (`/librerias`).
       * Es la trampa 8 con otra cara: sin él se publica una librería desde el
       * panel y el sitio estático **no la muestra nunca**. Entró solo —
       * `onDocumentWritten` ya estaba en `CLASES_DE_TRIGGER`— y lo único que hubo
       * que confirmar a mano es el conteo, que es la parte del chequeo que no se
       * puede derivar.
       *
       * Los dos chequeos de abajo sí lo miran, y conviene saber cómo pasa cada
       * uno:
       *
       *  - **B-82** (efecto duplicable sin guarda): el efecto es `marcarRebuild`,
       *    que escribe un documento fijo con `merge` — dos entregas del mismo
       *    evento dejan el mismo estado. Y la guarda que lo hace decidible es
       *    `cambioAmeritaRebuild`, que compara **los campos que el sitio
       *    publica** (la lista vive del lado de `functions/` por D-20 y la ata
       *    `tests/directorios-rebuild.test.ts` contra la proyección).
       *  - **B-83** (efecto incondicional debajo de una guarda): la llamada a
       *    `marcarRebuild` **domina** el handler entero, escrita en la misma
       *    forma positiva que `syncCalendar` y `rebuildPorOpciones`. La forma al
       *    revés es lógicamente idéntica y deja este archivo en rojo — lo
       *    encontraron los dos auditores sobre la primera versión del trigger.
       *
       * **B-905 — y desde ahí los cuatro rebuild de directorio escriben en el
       * documento que los dispara**: prenden `publicadaAlgunaVez` con
       * `marcarPublicada`, el mismo efecto que `syncCalendar`. Ninguno cambia de
       * respuesta en B-82 (el efecto es un `update`, que direcciona una identidad
       * que ya existe) y los dos registros que sí los miran por eso crecieron:
       * `EFECTOS_INCONDICIONALES` (B-83) ya tenía la marca, y
       * `WRITE_BACKS_CON_GUARDA` (trampa 3) es nuevo.
       */
      'rebuildPorLibrerias',
      /*
       * B-833 — el rebuild de los lugares para eventos, el tercero de la familia.
       * **Entró solo** y pasa los dos chequeos por el mismo camino que sus dos
       * hermanos: su efecto es `marcarRebuild` (idempotente: escribe un documento
       * fijo con `merge`) y su llamada **domina** el handler, escrita en la misma
       * forma positiva.
       *
       * Y es la tercera vez que los cuerpos quedan casi iguales a propósito: el
       * chequeo de B-83 es **textual sobre el cuerpo de cada trigger**, así que un
       * cuerpo mudado a un helper deja de contener la llamada y este archivo
       * **dejaría de mirarlos sin ponerse rojo**.
       */
      'rebuildPorLugares',
      'rebuildPorOpciones',
      /*
       * B-832 — el rebuild de las suscripciones literarias, el hermano del de
       * librerías. **Entró solo** y pasa los dos chequeos por el mismo camino:
       * su efecto es `marcarRebuild` (idempotente: escribe un documento fijo con
       * `merge`) y su llamada **domina** el handler, escrita en la misma forma
       * positiva.
       *
       * Y es la razón por la que los dos cuerpos siguen siendo casi iguales en
       * vez de compartir un helper: el chequeo de B-83 es **textual sobre el
       * cuerpo de cada trigger**, así que un cuerpo mudado a una función deja de
       * contener la llamada y este archivo **dejaría de mirarlos sin ponerse
       * rojo**. Está escrito en `functions/directorios-trigger.js`.
       */
      'rebuildPorSuscripciones',
      'reporteAIssue',
      'syncCalendar',
      /*
       * B-374/B-373 — la lectura de GA4 y de Search Console para el panel. El
       * tercer `onSchedule` del proyecto, y **entró solo**: la clase ya estaba
       * en `CLASES_DE_TRIGGER`, así que lo único que hubo que confirmar a mano
       * es el conteo, que es la parte que este `it` existe para pedir.
       *
       * Vale la pena anotar por qué **no** cae en los dos chequeos de abajo,
       * porque no es casualidad y el día que se toque conviene saberlo:
       *
       *  - **B-82** (efecto duplicable sin guarda) mira los triggers *de
       *    documento*, y éste es un schedule; y su efecto tampoco es
       *    duplicable: escribe un documento fijo con `set`, así que dos
       *    corridas producen un documento y no dos.
       *  - **B-85** (leer estado → red → escribir lo leído) pide los tres
       *    síntomas juntos —el orden salió de la condición en B-845— y acá falta
       *    el primero: no hay ninguna lectura de Firestore, el resumen se arma
       *    entero de las dos APIs y se escribe pisando. La red **sí** se ve
       *    desde **B-862**: hasta entonces el detector conocía `fetch(`,
       *    `cal.events.` y `google.calendar(`, así que los clientes de GA4 y de
       *    Search Console daban `red: false` y a este schedule le faltaban dos
       *    síntomas y no uno. Si algún día se quisiera conservar algo del
       *    documento anterior —«desde cuándo hay datos», por ejemplo, para no
       *    depender del informe del primer día— ese `.get()` lo pondría en la
       *    clase de B-85, y ahora el chequeo lo agarra en vez de dejarlo pasar.
       */
      'traerAnaliticaDelSitio',
      /*
       * B-882 — el chequeo de frescura: compara lo publicado en Firestore contra
       * el `events.json` vivo y avisa si divergen. El cuarto `onSchedule`, y
       * **entró solo** (la clase ya estaba en `CLASES_DE_TRIGGER`); lo único que
       * hubo que confirmar a mano es el conteo, que es la parte que este `it`
       * existe para pedir.
       *
       * Es el primer schedule que enciende los **cuatro** síntomas de B-85 —lee
       * Firestore, habla con la red dos veces (el índice y el issue) y escribe— y
       * pasa por el mismo motivo que `dispararRebuild`: la transacción. No es
       * decorativa. El `previo` con el que se decide si abrir un issue se leyó
       * antes del `fetch` del índice, así que la decisión se vuelve a tomar
       * adentro de la transacción contra el documento de ahora; si no, dos
       * corridas superpuestas abren dos issues del mismo atraso en un repo
       * público.
       *
       * Y por eso **no** entra a `GUARDAS_DE_BARRIDO`: ese registro se deriva de
       * los schedules que escriben lo que leyeron **sin** transacción, y éste la
       * tiene. El día que alguien se la saque, el chequeo de B-85 se pone rojo
       * primero.
       */
      'verificarFrescuraDelSitio',
    ]);
  });

  it('cada cuerpo tiene contenido y no se comió código ajeno', () => {
    for (const t of TRIGGERS) {
      expect(t.cuerpo.length, t.nombre).toBeGreaterThan(200);
      expect(t.cuerpo, t.nombre).toContain(t.nombre);
      // Un cuerpo con dos `export const` adentro se tragó al vecino, y le
      // atribuiría efectos que no produce.
      expect([...t.cuerpo.matchAll(/export const/g)].length, t.nombre).toBe(1);
    }
  });
});
