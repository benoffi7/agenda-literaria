import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

/** Los paquetes cuyo peso justifica todo el corte (D-51). */
const SDK_PESADO = ['firebase/firestore', 'firebase/analytics'];

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
