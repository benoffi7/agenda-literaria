import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * B-561 — un test que **importa** (ejecuta) un módulo de `functions/` que a su
 * vez importa `firebase-functions` **pasa en local y falla solo en CI**, y es de
 * los peores de diagnosticar.
 *
 * El motivo: `firebase-functions` vive en `functions/package.json`, no en la
 * raíz. En la máquina de desarrollo `functions/node_modules` existe (de trabajar
 * ahí), así que el import resuelve; en CI el `npm ci` es solo de la raíz, no hay
 * `functions/node_modules`, y Vite muere con un `loadAndTransform` sobre la línea
 * del `import { onSchedule } from 'firebase-functions/...'`. Verde local, rojo CI.
 *
 * La regla del repo ya existía de hecho —los tests que miran un trigger lo leen
 * como **texto** con `fuente('functions/...-trigger.js')`, nunca lo importan— pero
 * nada la hacía cumplir. Esta guarda la hace cumplir. Lo que un test necesite de
 * un trigger o vive en el módulo **puro** de al lado (el patrón `reconciliacion.js`
 * / `limpieza-imagenes.js`) y se importa de ahí, o se lee como fuente.
 *
 * La lista de módulos prohibidos **se computa sola**: son los `functions/*.js`
 * con un `import ... from 'firebase-functions...'` real. Un trigger nuevo entra a
 * la lista sin tocar este archivo.
 *
 * MUTACIÓN PROBADA: agregar `import { referenciasEnUso } from
 * '../functions/imagenes-limpieza-trigger.js'` a cualquier test pone este caso en
 * rojo nombrando el archivo y el módulo.
 */
const raiz = new URL('..', import.meta.url);
const leer = (rel: string) => readFileSync(fileURLToPath(new URL(rel, raiz)), 'utf8');

/** Los módulos de `functions/` que importan `firebase-functions` (ausente en la raíz). */
const modulosProhibidos = readdirSync(fileURLToPath(new URL('functions/', raiz)))
  .filter((f) => f.endsWith('.js'))
  .filter((f) => /^\s*import[^;]*from\s*['"]firebase-functions/m.test(leer(`functions/${f}`)))
  .map((f) => f.replace(/\.js$/, ''));

/** Todos los archivos de test. */
const archivosDeTest = readdirSync(fileURLToPath(new URL('tests/', raiz))).filter((f) =>
  /\.test\.tsx?$/.test(f),
);

/** Las sentencias `import ... from '...'` de un archivo — no las cadenas sueltas. */
const importsDe = (src: string): string[] =>
  [...src.matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]!);

describe('ningún test importa un módulo de functions con firebase-functions (B-561)', () => {
  it('la lista de módulos prohibidos no está vacía —si no, la guarda no mira nada', () => {
    // Control positivo: si un refactor dejara a `functions/` sin ningún trigger
    // que importe firebase-functions, este archivo pasaría por no tener nada que
    // revisar, y la próxima vez que vuelva un trigger nadie lo estaría cuidando.
    expect(modulosProhibidos.length).toBeGreaterThan(0);
  });

  it('cada test importa solo módulos puros o lee el trigger como texto', () => {
    const infracciones: string[] = [];
    for (const archivo of archivosDeTest) {
      for (const especificador of importsDe(leer(`tests/${archivo}`))) {
        const base = especificador.split('/').pop()?.replace(/\.js$/, '') ?? '';
        if (modulosProhibidos.includes(base)) {
          infracciones.push(`${archivo} → ${especificador}`);
        }
      }
    }
    expect(
      infracciones,
      'estos tests importan un módulo de functions que arrastra `firebase-functions` ' +
        '(verde local, rojo en CI). Importá el módulo puro de al lado, o leé el trigger ' +
        `como texto con fuente(...). Módulos prohibidos: ${modulosProhibidos.join(', ')}`,
    ).toEqual([]);
  });
});
