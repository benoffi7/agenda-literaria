/**
 * trampa 12: un trigger de Storage no puede dispararse a sí mismo.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { type Trigger, CLASES_DE_TRIGGER, TRIGGERS, primero, sinComentarios, trazaDe } from '../fixtures/clases-de-bug';

// ─────────────────────────────────────────────────────────────────────
// Clase de la trampa 12 · un trigger de Storage que escribe en el bucket
// que lo dispara se dispara a sí mismo
// ─────────────────────────────────────────────────────────────────────

/**
 * La trampa 12 del §13, que es la 3 con otra cara — y la **instancia** llegó con
 * B-220 (D-175).
 *
 * Hasta el 2026-09-02 este archivo cubría la trampa 12 por anticipación: las
 * cuatro clases `onObject*` estaban en `CLASES_DE_TRIGGER` desde antes de que
 * existiera ningún trigger de Storage, así que el que se escribiera iba a entrar
 * solo. Entró (`optimizarImagen`), y lo que faltaba era **la regla que le pide la
 * guarda**: el chequeo de B-82 no alcanza, porque su noción de "efecto
 * duplicable" son los verbos de creación de Firestore y de Calendar, y
 * `bucket.file(x).save(...)` no es ninguno — escribir dos veces la misma
 * dirección de Storage no produce un segundo objeto.
 *
 * **El daño de esta clase es otro**: no es un duplicado, es un lazo. El objeto
 * que la Function escribe vuelve a disparar a la Function, y cada pasada produce
 * bytes distintos, así que ni siquiera una guarda del estilo "no cambió nada"
 * cortaría. El §13 nombra las dos formas aceptadas y acá se pide **al menos
 * una**:
 *
 *  - **por prefijo** — el objeto derivado vive en un prefijo que el handler
 *    ignora;
 *  - **por `customMetadata`** — el objeto derivado va marcado y el handler corta
 *    al leer la marca. Es la única que sirve cuando la derivada se escribe
 *    **encima** del original, que es el caso de `optimizarImagen`.
 *
 * Y se pide además que la guarda **domine** las escrituras, que es la clase de
 * B-83 aplicada acá: una guarda que decide bien pero está debajo del efecto no
 * guarda nada.
 */
const deStorage = TRIGGERS.filter((t) => t.clase.startsWith('onObject'));


/**
 * ¿Este trigger **escribe** en el bucket?
 *
 * Pide el verbo de escritura, y no alcanza con nombrar `bucket.file(`. Lo
 * corrigió el `auditor-trampas`: `bucket.file(nombre).download()` es una
 * **lectura**, y con el regex anterior un trigger de Storage que solo leyera
 * quedaba clasificado como «escribe» y se le exigía una guarda que no necesita.
 * Hoy no cambiaba ningún resultado —`optimizarImagen` escribe de verdad— y por
 * eso se aprieta ahora, que es cuando es gratis. Es el error inverso a los otros
 * dos falsos positivos de este bloque: más seguro, igual de impreciso.
 */
const RE_ESCRIBE_EN_STORAGE = /\.(?:save|setMetadata|copy|move)\(|\.file\([^)]*\)\s*\.delete\(/;

const escribeEnElBucket = (t: Trigger): boolean =>
  trazaDe(t).cuerpos.some((c) => RE_ESCRIBE_EN_STORAGE.test(c));


/**
 * Guarda por prefijo: el handler compara el nombre del objeto contra un prefijo
 * **y de esa comparación sale un "ignorar"**.
 *
 * Lo último no es adorno. La primera versión pedía solo `PREFIJO_` + un
 * `startsWith(`, y con la guarda ya mutada afuera seguía dando `true`: el
 * **parser del id** (`idDeObjeto`) también compara el prefijo, por otro motivo.
 * Un detector que confunde «acá se decide ignorar» con «acá se parsea un
 * nombre» declara guarda donde hay una coincidencia — que es la forma en que
 * este archivo ya se apagó una vez (B-171).
 */
const guardaPorPrefijo = (t: Trigger): boolean =>
  trazaDe(t).cuerpos.some(
    (c) => /\bPREFIJO_\w+/.test(c) && /startsWith\(|indexOf\(|\bmatch\(/.test(c) && /'ignorar'/.test(c),
  );


/**
 * Guarda por marca: el handler **lee** la marca de los metadatos del objeto.
 *
 * El regex pide la **lectura** (`metadatos[MARCA_…]`) y no la mención del
 * nombre, y la diferencia es todo el chequeo: la Function también **escribe** la
 * marca (`metadatosDeSalida`), así que un `/MARCA_\w+/` suelto seguía dando
 * `true` con la guarda ya sacada — el detector diría que hay guarda porque
 * encontró el nombre de la marca en el código que la pone. Se descubrió mutando.
 */
const guardaPorMarca = (t: Trigger): boolean =>
  trazaDe(t).cuerpos.some((c) => /(?:metadatos|metadata|customMetadata)\s*\[\s*MARCA_/.test(c));

describe('clase de la trampa 12 · un trigger de Storage no puede dispararse a sí mismo', () => {
  it('hay al menos un trigger de Storage y escribe en el bucket', () => {
    // El control positivo: sin esto, el chequeo de abajo daría un verde vacío el
    // día que alguien renombre las clases o mueva el trigger de archivo.
    expect(deStorage.map((t) => t.nombre)).toContain('optimizarImagen');
    expect(deStorage.filter(escribeEnElBucket).length).toBeGreaterThanOrEqual(1);
  });

  it('trampa 12: todo trigger de Storage que escribe en el bucket tiene guarda', () => {
    // **Qué lo pondría rojo:** un `onObjectFinalized` nuevo con un `.save()`
    // adentro y sin comparar el prefijo ni leer una marca. Cae acá el día que se
    // escribe, y también si el `.save()` lo hace un helper — la traza sigue la
    // llamada (B-171).
    const sinGuarda = deStorage
      .filter(escribeEnElBucket)
      .filter((t) => !guardaPorPrefijo(t) && !guardaPorMarca(t))
      .map((t) => `${t.archivo} · ${t.nombre}`);
    expect(sinGuarda).toEqual([]);
  });

  it('las dos formas de guarda están vivas, y la de la marca no es opcional', () => {
    // `optimizarImagen` escribe su salida principal **encima del original**, y
    // eso es lo que hace innecesario el write-back al documento (D-175). El
    // precio es que para esa escritura la guarda por prefijo es imposible: no hay
    // prefijo que distinga la derivada del disparador. Así que la marca tiene que
    // estar, y este `it` es el que no deja que alguien la saque dejando solo el
    // prefijo — que pasaría los dos chequeos de arriba.
    const encima = deStorage.filter((t) => /original\.(?:save|setMetadata)\(/.test(t.cuerpo));
    expect(encima.length).toBeGreaterThanOrEqual(1);
    for (const t of encima) expect(guardaPorMarca(t), t.nombre).toBe(true);
    // Y la del prefijo también sigue viva, para el objeto que sí es nuevo.
    expect(deStorage.filter(guardaPorPrefijo).length).toBeGreaterThanOrEqual(1);
  });

  it('la guarda domina las escrituras: ningún `.save()` antes del corte', () => {
    // La clase de B-83 aplicada a la trampa 12. Se mira el cuerpo del trigger
    // sin comentarios, porque este repo **explica** sus guardas en prosa y la
    // explicación contaría como la guarda.
    const tapados: string[] = [];
    for (const t of deStorage.filter(escribeEnElBucket)) {
      const cuerpo = sinComentarios(t.cuerpo);
      const corte = primero(cuerpo, /\breturn\b/);
      const escritura = primero(cuerpo, RE_ESCRIBE_EN_STORAGE);
      if (!(corte < escritura)) tapados.push(`${t.archivo} · ${t.nombre}`);
    }
    expect(tapados).toEqual([]);
  });
});
