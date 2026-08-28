import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * B-09 — guardas del corte del bundle del panel.
 *
 * El split que baja la carga inicial de `/admin` de ~750 KB a ~350 KB se
 * sostiene sobre el grafo de imports, no sobre configuración: un `import`
 * estático de más lo deshace y el build sigue verde. Estos tests son la alarma.
 *
 * Se leen los fuentes como texto a propósito: importarlos no diría nada sobre
 * si el import es estático o dinámico.
 *
 * ── B-117 · por qué se sigue el grafo y no una lista ───────────────────────
 * La primera versión de este archivo comparaba **literales**: nombraba los dos
 * componentes diferidos que había ese día. Cuando aparecieron el tercero
 * (`ReportesPanel`) y el cuarto (`CalendarioActividades`), volverlos estáticos
 * deshacía el corte con el test en verde. Y el modo de falla más probable no es
 * ese: es un import estático nuevo en cualquier módulo del grafo que arrastre
 * `firebase/firestore` **por la cadena**, tres saltos más abajo, donde ninguna
 * lista de nombres lo va a ver.
 *
 * Entonces lo que se afirma es la propiedad: **desde la entrada de la island,
 * siguiendo solo imports estáticos, el SDK pesado no se alcanza**, y **lo que
 * se carga con `import()` no es alcanzable de forma estática** (si lo fuera, el
 * `import()` no estaría cortando nada). Un componente nuevo entra solo en las
 * dos reglas.
 */

const ruta = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(ruta(rel), 'utf8');

/** Imports estáticos (`import ... from 'x'`), sin los `import type`. */
const importsEstaticos = (src: string): string[] =>
  [...src.matchAll(/^import\s+(?!type\s)[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]!);

/** Los `import('x')` diferidos, en el orden en que aparecen. */
const importsDiferidos = (src: string): string[] =>
  [...src.matchAll(/\bimport\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]!);

/**
 * La entrada del bundle del panel: es lo que `admin.astro` monta como island
 * `client:only`, así que es exactamente lo que el navegador baja para el primer
 * render de `/admin`.
 *
 * No se hardcodea: se lee del `.astro`, para que mover la island a otro
 * componente no deje estos tests auditando un archivo que ya no es la entrada.
 */
const ENTRADA = (() => {
  const astro = fuente('src/pages/admin.astro');
  const montado = /<(\w+)\s+client:only/.exec(astro)?.[1];
  const desde = new RegExp(`^import\\s*\\{[^}]*\\b${montado}\\b[^}]*\\}\\s*from\\s*'([^']+)'`, 'm')
    .exec(astro)?.[1];
  if (!montado || !desde) throw new Error('no se pudo leer la island de src/pages/admin.astro');
  return desde;
})();

/**
 * De especificador a archivo del repo, o `null` si es un paquete de
 * `node_modules` (ahí el grafo se corta: lo que interesa es qué paquete se
 * alcanza, no cómo está armado adentro).
 */
const aArchivo = (spec: string, desde: string | null): string | null => {
  let base: string;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.') && desde) {
    const partes = desde.split('/').slice(0, -1);
    for (const p of spec.split('/')) {
      if (p === '.') continue;
      else if (p === '..') partes.pop();
      else partes.push(p);
    }
    base = partes.join('/');
  } else return null;

  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (cand.includes('.') && existsSync(ruta(cand))) return cand;
  }
  return null;
};

type Grafo = {
  /** Archivos del repo alcanzados. */
  archivos: Set<string>;
  /** Paquetes de `node_modules` alcanzados (`firebase/firestore`, `react`, …). */
  paquetes: Set<string>;
  /** Todo lo que algún archivo del grafo carga con `import()`. */
  diferidos: Set<string>;
};

/**
 * El cierre transitivo de los imports desde `entrada`.
 *
 * `seguirDiferidos` es lo que separa las dos preguntas: con `false` es "lo que
 * el navegador baja para el primer render"; con `true`, "todo lo que el panel
 * puede llegar a usar". La segunda existe para que la primera no pueda dar un
 * verde vacío (ver el control positivo abajo).
 */
const recorrer = (entrada: string, seguirDiferidos: boolean): Grafo => {
  const archivos = new Set<string>();
  const paquetes = new Set<string>();
  const diferidos = new Set<string>();
  const pendientes = [aArchivo(entrada, null)!];

  while (pendientes.length > 0) {
    const archivo = pendientes.pop()!;
    if (archivos.has(archivo)) continue;
    archivos.add(archivo);

    const src = fuente(archivo);
    const especificadores = [...importsEstaticos(src)];
    for (const spec of importsDiferidos(src)) {
      diferidos.add(spec);
      if (seguirDiferidos) especificadores.push(spec);
    }

    for (const spec of especificadores) {
      const destino = aArchivo(spec, archivo);
      if (destino) pendientes.push(destino);
      else paquetes.add(spec);
    }
  }

  return { archivos, paquetes, diferidos };
};

const INICIAL = recorrer(ENTRADA, false);
const COMPLETO = recorrer(ENTRADA, true);

/**
 * Los paquetes cuyo peso justifica todo el corte (D-51).
 *
 * `firebase/storage` entró con la subida de imágenes propias (B-167, segunda
 * tajada): pesa del mismo orden que Firestore y lo usa **un** módulo
 * (`src/lib/subir-imagen.ts`), cargado con `import()` desde el editor de la
 * galería. Sin esta línea, volverlo estático deshacía el corte con el build en
 * verde — que es exactamente el modo de falla que B-50 dejó anotado cuando pasó
 * lo mismo con `firebase/analytics`.
 */
const SDK_PESADO = ['firebase/firestore', 'firebase/analytics', 'firebase/storage'];

describe('el recorrido del grafo ve lo que hay — B-117', () => {
  it('la entrada de la island es un archivo del panel', () => {
    expect(ENTRADA).toMatch(/AdminApp$/);
  });

  it('el grafo inicial no está vacío ni es sospechosamente chico', () => {
    // Un `aArchivo` que dejara de resolver el alias devolvería un grafo de un
    // solo archivo, y **todos** los chequeos de abajo pasarían sin mirar nada.
    expect(INICIAL.archivos.size).toBeGreaterThanOrEqual(5);
    expect(INICIAL.paquetes).toContain('react');
  });

  it('el grafo completo es más grande que el inicial', () => {
    // Si fueran iguales, o ya no hay nada diferido (el corte se deshizo) o el
    // detector de `import()` dejó de ver los diferidos.
    expect(COMPLETO.archivos.size).toBeGreaterThan(INICIAL.archivos.size);
  });

  it('CONTROL POSITIVO: siguiendo los diferidos, el SDK pesado sí se alcanza', () => {
    // La pregunta que hace honesto al test de abajo. Si el SDK no apareciera ni
    // siguiendo los `import()`, "no está en el chunk inicial" no probaría nada:
    // querría decir que el recorrido no sabe encontrarlo.
    for (const sdk of SDK_PESADO) {
      expect([...COMPLETO.paquetes], sdk).toContain(sdk);
    }
  });
});

describe('corte del bundle del panel — B-09, B-117, B-50', () => {
  it('el SDK pesado no es alcanzable estáticamente desde la island', () => {
    // El corazón del corte, y la única forma de cuidarlo que no envejece: no
    // importa **quién** lo importe ni a cuántos saltos, si aparece acá el chunk
    // inicial se lo lleva.
    //
    // `firebase/analytics` es el cierre de B-50: se agregó en paralelo a B-09,
    // también diferido, y nada verificaba que hubiera quedado afuera.
    const alcanzados = SDK_PESADO.filter((sdk) => INICIAL.paquetes.has(sdk));
    expect(alcanzados, `cadena: ${[...INICIAL.archivos].join(', ')}`).toEqual([]);
  });

  it('lo que se carga con `import()` no es alcanzable estáticamente', () => {
    // Volver estático uno de los componentes diferidos deshace su chunk con el
    // build en verde. La lista sale del código —los `import()` que el grafo
    // tenga— así que el quinto componente diferido que alguien agregue queda
    // cubierto sin tocar este archivo. Es lo que B-117 vino a arreglar: la
    // versión anterior nombraba dos y ya había cuatro.
    const contradictorios = [...COMPLETO.diferidos].filter((spec) => {
      const archivo = aArchivo(spec, null);
      return archivo !== null && INICIAL.archivos.has(archivo);
    });
    expect(contradictorios).toEqual([]);
  });

  it('hay varios módulos diferidos, y son componentes del panel', () => {
    // Control positivo del chequeo anterior: con la lista vacía pasaría solo.
    const componentes = [...COMPLETO.diferidos].filter((s) => s.includes('/admin/'));
    expect(componentes.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Trampa 4 del §13 — `firebase-admin` en el bundle cliente.
 *
 * Es la trampa más caras del §13 (si se cuela, la key de la service account
 * termina en un artefacto público, §5.4) y hasta acá **no había ningún test que
 * la cubriera**: el hallazgo salió de armar el mapa de B-119. Se cierra con el
 * mismo recorrido de arriba, que es lo que hacía falta: la regla del §5.4 no es
 * "este archivo no lo importa", es "no se llega desde el cliente", y eso es una
 * pregunta sobre el grafo.
 *
 * Se mira el grafo **completo**, diferidos incluidos: un `import()` también
 * termina en un chunk que el navegador puede bajar.
 */
describe('trampa 4 · la service account no puede llegar al cliente', () => {
  const ADMIN = 'src/lib/firebase-admin.ts';

  it('CONTROL POSITIVO: el módulo que hay que mantener afuera existe y sí trae el SDK', () => {
    // Si `firebase-admin.ts` se renombrara o dejara de importar el SDK, el
    // chequeo de abajo pasaría por vacío en vez de por correcto.
    expect(existsSync(ruta(ADMIN))).toBe(true);
    expect(importsEstaticos(fuente(ADMIN)).some((i) => i.startsWith('firebase-admin'))).toBe(true);
  });

  it('no se alcanza desde la island, ni siquiera por un import diferido', () => {
    expect([...COMPLETO.archivos].filter((a) => a === ADMIN)).toEqual([]);
    expect([...COMPLETO.paquetes].filter((p) => p.startsWith('firebase-admin'))).toEqual([]);
  });
});

/**
 * B-167 (segunda tajada) — el SDK de Storage entra por una sola puerta, y esa
 * puerta es un `import()`.
 *
 * **Por qué hace falta un chequeo aparte y no alcanza con `SDK_PESADO`.** El
 * grafo `INICIAL` arranca en la island, y el editor de la galería vive tres
 * saltos abajo de un componente que ya es diferido: volver estático el
 * `import()` de `subir-imagen` **no** metería Storage en el chunk inicial, así
 * que el chequeo de arriba seguiría en verde. Lo que sí pasaría es que el SDK se
 * pegara al chunk del formulario, que baja **toda** persona que abre una
 * actividad — y casi ninguna sube una imagen.
 *
 * Se verificó por mutación: volviendo estático ese `import()`, los chequeos de
 * `SDK_PESADO` siguen pasando y este falla. Ese es exactamente el hueco que
 * viene a tapar.
 */
describe('quién es dueño de Storage — B-167', () => {
  const DUENO = 'src/lib/subir-imagen.ts';

  /** Todos los fuentes del panel y de la librería compartida. */
  const FUENTES = execFileSync('git', ['ls-files', '-z', 'src'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

  it('CONTROL POSITIVO: el dueño existe y sí importa el SDK', () => {
    expect(existsSync(ruta(DUENO))).toBe(true);
    expect(importsEstaticos(fuente(DUENO))).toContain('firebase/storage');
    expect(FUENTES.length).toBeGreaterThan(20);
  });

  it('ningún otro módulo importa firebase/storage', () => {
    const otros = FUENTES.filter(
      (f) => f !== DUENO && importsEstaticos(fuente(f)).includes('firebase/storage'),
    );
    expect(otros).toEqual([]);
  });

  it('nadie importa al dueño de forma estática', () => {
    // La regla que hace verdadero el comentario de `subir-imagen.ts`: se entra
    // por `import()` o no se entra. Un `import { subirImagen } from …` en
    // cualquier componente pega el SDK al chunk de quien lo importe.
    const estaticos = FUENTES.filter((f) =>
      importsEstaticos(fuente(f)).some((spec) => spec.replace(/\.tsx?$/, '').endsWith('subir-imagen')),
    );
    expect(estaticos).toEqual([]);
  });

  it('y alguien sí lo carga con import(): la puerta existe', () => {
    // Control negativo del anterior: con el módulo huérfano, "nadie lo importa
    // estáticamente" sería cierto y vacío.
    const diferido = FUENTES.filter((f) =>
      importsDiferidos(fuente(f)).some((spec) => spec.endsWith('subir-imagen')),
    );
    expect(diferido.length).toBeGreaterThanOrEqual(1);
  });
});

describe('quién es dueño de Firestore — B-09', () => {
  it('firebase-client no importa firebase/firestore', () => {
    // Es el módulo de la pantalla de login: si acá entra Firestore, el SDK
    // completo vuelve al chunk inicial. `db` vive en firestore-client.
    expect(importsEstaticos(fuente('src/lib/firebase-client.ts'))).not.toContain(
      'firebase/firestore',
    );
  });

  it('firebase-client no exporta ni re-exporta db', () => {
    // Re-exportarlo desde acá volvería a atar Firestore al chunk del login.
    const src = fuente('src/lib/firebase-client.ts');
    expect(src).not.toMatch(/^export\s+const\s+db\b/m);
    expect(src).not.toMatch(/^export\s*\{[^}]*\bdb\b[^}]*\}/m);
  });

  it('firestore-client es el único dueño de getFirestore', () => {
    expect(importsEstaticos(fuente('src/lib/firestore-client.ts'))).toContain('firebase/firestore');
  });

  it('los módulos que hablan con Firestore piden db a firestore-client', () => {
    for (const rel of ['src/lib/actividades.ts', 'src/lib/opciones.ts']) {
      expect(importsEstaticos(fuente(rel))).toContain('@/lib/firestore-client');
    }
  });
});

/**
 * Las proyecciones públicas no pueden tocar Firestore — B-212, B-218.
 *
 * `src/lib/toPublic.ts` corre en el **build de Astro**, con el Admin SDK, para
 * producir el `events.json`. Importa `opcionesVisibles`, y esa función se puede
 * traer de dos lugares: de `@/lib/taxonomia`, que es puro, o de `@/lib/opciones`,
 * que la **re-exporta** y además importa `firestore-client`.
 *
 * El archivo tiene un docblock explicando cuál de los dos y por qué. Pero un
 * comentario no es una guarda: cambiar el import por `@/lib/opciones`
 * **typechequea y deja toda la suite en verde**, arrastrando `firebase/firestore`
 * al módulo de la proyección pública. Y el recorrido del grafo de más arriba
 * tampoco lo vería: estas proyecciones no están en el grafo de la island de
 * `/admin`, así que quedan fuera de las dos redes que existen. Es exactamente la
 * forma del §5.4 —«no se llega desde el cliente»— aplicada a un módulo cuyos
 * clientes todavía no existen.
 *
 * ── Por qué la lista y no un archivo — B-218 ──────────────────────────────
 * Este bloque nació con `toPublic.ts` cableado en una constante, cuando su
 * docblock podía decir «no tiene hoy ningún importador en `src/` (B-106 no existe
 * todavía)». B-106 existe: `src/lib/eventsJson.ts` lo importa y **hereda la
 * posición exacta** —proyección pura, sin consumidor cliente hoy, con uno
 * previsto en B-105—, y el día que alguien le agregue un import de conveniencia
 * para «leer las opciones acá» no lo ve nadie:
 *
 * | Red | Por qué no lo ve |
 * |---|---|
 * | `tests/build-credenciales.test.ts` | busca `from 'firebase-admin` y el import sería `@/lib/firebase-admin`, que es la puerta legítima |
 * | el grafo de la island (arriba) | no alcanza `eventsJson.ts`: no se llega desde `/admin` |
 * | `scripts/verificar-bundle.sh` | lo vería en `dist/`, o sea después de que el build lo bundleó |
 *
 * Lo encontró el `auditor-privacidad` las dos veces. Que sea una lista es lo que
 * hace que la tercera proyección se agregue acá y no dentro de seis semanas.
 */
describe.each(['src/lib/toPublic.ts', 'src/lib/eventsJson.ts'])(
  '%s no arrastra Firestore — B-212',
  (PROYECCION) => {
    it('el archivo existe y tiene imports que revisar', () => {
      // Control positivo: con una lista vacía, los dos `it` de abajo pasarían sin
      // haber mirado nada.
      expect(importsEstaticos(fuente(PROYECCION)).length).toBeGreaterThan(1);
    });

    it('no importa el módulo que habla con Firestore', () => {
      const specs = importsEstaticos(fuente(PROYECCION));
      // `@/lib/opciones` re-exporta lo mismo que `@/lib/taxonomia` y además abre
      // el cliente de Firestore: es el atajo cómodo que hay que cerrar.
      expect(specs, 'traelo de @/lib/taxonomia, que es puro').not.toContain('@/lib/opciones');
    });

    it('ni Firebase, por ninguna puerta', () => {
      const todos = [
        ...importsEstaticos(fuente(PROYECCION)),
        ...importsDiferidos(fuente(PROYECCION)),
      ];
      const deFirebase = todos.filter((s) => s === 'firebase' || s.startsWith('firebase/'));
      expect(deFirebase, 'la proyección pública no habla con Firebase').toEqual([]);
    });

    it('y su clausura de imports propios tampoco', () => {
      /*
       * La parte que importa de verdad: no alcanza con que `toPublic` esté limpio
       * si algo que importa no lo está. Se recorre el cierre transitivo de sus
       * imports **de `src/`** —el mismo `aArchivo` que usa el grafo de la island—
       * y se exige que nadie en la cadena traiga Firebase.
       */
      const vistos = new Set<string>();
      const pendientes = [PROYECCION];
      const culpables: string[] = [];

      while (pendientes.length > 0) {
        const archivo = pendientes.pop()!;
        if (vistos.has(archivo)) continue;
        vistos.add(archivo);

        const src = fuente(archivo);
        for (const spec of [...importsEstaticos(src), ...importsDiferidos(src)]) {
          if (spec === 'firebase' || spec.startsWith('firebase/')) {
            culpables.push(`${archivo} → ${spec}`);
            continue;
          }
          const destino = aArchivo(spec, archivo);
          if (destino) pendientes.push(destino);
        }
      }

      // Control positivo: la clausura tiene que haber visitado más que el archivo
      // de entrada, o esto no probó nada.
      expect(vistos.size).toBeGreaterThan(2);
      expect(culpables, `algo en la cadena de imports de ${PROYECCION} trae Firebase`).toEqual([]);
    });
  },
);
