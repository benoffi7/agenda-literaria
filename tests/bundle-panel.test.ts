import { readFileSync } from 'node:fs';
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
 */

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

/** Imports estáticos (`import ... from 'x'`), sin los `import type`. */
const importsEstaticos = (src: string): string[] =>
  [...src.matchAll(/^import\s+(?!type\s)[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]!);

describe('corte del bundle del panel — B-09', () => {
  it('firebase-client no importa firebase/firestore', () => {
    // Es el módulo de la pantalla de login: si acá entra Firestore, el SDK
    // completo vuelve al chunk inicial. `db` vive en firestore-client.
    expect(importsEstaticos(fuente('lib/firebase-client.ts'))).not.toContain('firebase/firestore');
  });

  it('firebase-client no exporta ni re-exporta db', () => {
    // Re-exportarlo desde acá volvería a atar Firestore al chunk del login.
    const src = fuente('lib/firebase-client.ts');
    expect(src).not.toMatch(/^export\s+const\s+db\b/m);
    expect(src).not.toMatch(/^export\s*\{[^}]*\bdb\b[^}]*\}/m);
  });

  it('firestore-client es el único dueño de getFirestore', () => {
    expect(importsEstaticos(fuente('lib/firestore-client.ts'))).toContain('firebase/firestore');
  });

  it('AdminApp no importa el listado ni el formulario de forma estática', () => {
    const estaticos = importsEstaticos(fuente('components/admin/AdminApp.tsx'));
    expect(estaticos).not.toContain('@/components/admin/ListaActividades');
    expect(estaticos).not.toContain('@/components/admin/ActividadFormulario');
  });

  it('AdminApp los carga con import() diferido', () => {
    const src = fuente('components/admin/AdminApp.tsx');
    expect(src).toMatch(/import\('@\/components\/admin\/ListaActividades'\)/);
    expect(src).toMatch(/import\('@\/components\/admin\/ActividadFormulario'\)/);
  });

  it('los módulos que hablan con Firestore piden db a firestore-client', () => {
    for (const rel of ['lib/actividades.ts', 'lib/opciones.ts']) {
      expect(importsEstaticos(fuente(rel))).toContain('@/lib/firestore-client');
    }
  });
});
