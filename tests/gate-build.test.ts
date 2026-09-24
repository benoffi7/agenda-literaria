/**
 * Los módulos de `scripts/gate-build/` sin build — B-1760 (D-1070).
 *
 * El paso 4 del gate necesita el emulador y un `dist/` de verdad, así que su
 * verde se ve una vez por push. Lo que los tres cortes hicieron posible es
 * probar **la mecánica** acá: que la semilla se carga sin sembrar nada, y que el
 * barrido del paso 9 se pone rojo con una fuga en cada canasta. La corrida
 * contra el emulador sigue siendo la que prueba que las plantillas no publican
 * de más; ésta prueba que el barrido lo vería.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { urlDeMiniaturaSiExiste } from '@/lib/imagenes';

import { barrerArtefacto, canastaDe } from '../scripts/gate-build/barrido.mjs';
import { datoConFecha, verificarDirectorio } from '../scripts/gate-build/directorio.mjs';
import {
  CENTINELA,
  CENTINELA_DEL_DETALLE,
  CENTINELA_DE_BIBLIOTECAS,
  CENTINELA_DE_LA_CARTELERA,
  CENTINELA_DE_LUGARES,
  CENTINELA_DE_SUSCRIPCIONES,
  CENTINELA_DEL_DIRECTORIO,
  CENTINELA_DEL_INDICE,
  MONTO_EN_EL_ARTEFACTO,
  PREFIJO,
  documentosDeLaSemilla,
  rutaDeLaMiniaturaDelGate,
} from '../scripts/gate-build/semilla.mjs';

type Archivo = { relativa: string; contenido: string };

const valorDe = (campo: string): string => {
  const forma = MONTO_EN_EL_ARTEFACTO.find((f: { campo: string }) => f.campo === campo);
  if (!forma) throw new Error(`no hay forma ${campo}`);
  return forma.valor as string;
};

/**
 * Un `dist/` de mentira **limpio**: un archivo por canasta, con lo que cada una
 * publica a propósito y los controles positivos del monto en su lugar.
 */
const distLimpio = (): Archivo[] => [
  { relativa: 'index.html', contenido: `<p>${valorDe('montoLegible')}</p>` },
  { relativa: 'events.json', contenido: `{"monto":${valorDe('montoCrudo')}}` },
  {
    relativa: 'actividad/x/index.html',
    contenido: `${CENTINELA.descripcion} ${valorDe('montoCrudo')} ${valorDe('montoLegible')}`,
  },
  { relativa: 'cartelera/index.html', contenido: CENTINELA.epigrafeImagen },
  { relativa: 'librerias.json', contenido: CENTINELA.libreriaDescripcion },
  { relativa: 'guia/suscripciones/x/index.html', contenido: CENTINELA.suscripcionTematica },
  { relativa: 'lugares.json', contenido: CENTINELA.lugarDireccion },
  { relativa: 'guia/bibliotecas/index.html', contenido: CENTINELA.bibliotecaDireccion },
  { relativa: 'sitemap.xml', contenido: '<urlset/>' },
];

describe('la semilla del gate es datos puros', () => {
  it('se importa sin emulador, y la lista de documentos lleva el prefijo del gate', () => {
    // Si importar el módulo sembrara o leyera el entorno, este archivo no
    // cargaría: vitest no tiene FIRESTORE_EMULATOR_HOST acá.
    const docs = documentosDeLaSemilla();
    expect(docs.length).toBeGreaterThanOrEqual(16);
    for (const [ruta] of docs) expect(ruta.split('/')[1]!.startsWith(PREFIJO), ruta).toBe(true);
  });

  it('cada canasta nombra solo centinelas que existen', () => {
    /*
     * Una entrada que no es una clave de `CENTINELA` no permite nada y no avisa:
     * `sesionId` estuvo en la canasta del detalle desde que B-99 lo sacó de
     * `CENTINELA`, sin efecto y sin que nadie lo viera (B-1810).
     */
    const canastas = {
      CENTINELA_DEL_DETALLE,
      CENTINELA_DEL_INDICE,
      CENTINELA_DE_LA_CARTELERA,
      CENTINELA_DEL_DIRECTORIO,
      CENTINELA_DE_SUSCRIPCIONES,
      CENTINELA_DE_LUGARES,
      CENTINELA_DE_BIBLIOTECAS,
    };
    for (const [nombre, canasta] of Object.entries(canastas)) {
      expect(
        (canasta as string[]).filter((c) => !(c in CENTINELA)),
        `${nombre} nombra claves que no son centinelas`,
      ).toEqual([]);
    }
  });
});

describe('el barrido del paso 9, sin build', () => {
  it('un dist/ limpio no da ningún fallo (control)', () => {
    expect(barrerArtefacto(distLimpio())).toEqual([]);
  });

  /*
   * **Una fuga por canasta**, y cada una es un centinela que **otra** canasta sí
   * permite: así lo que se prueba es la frontera entre salidas y no solo que lo
   * prohibido en todos lados siga prohibido.
   *
   * MUTACIÓN PROBADA: hacer que `canastaDe` devuelva la canasta del detalle para
   * todo deja pasar las fugas del `events.json`, de la cartelera y del resto del
   * sitio, y esas tres filas fallan.
   */
  it.each([
    ['la página de detalle', 'actividad/x/index.html', 'libreriaDescripcion'],
    ['el events.json', 'events.json', 'descripcion'],
    ['la cartelera', 'cartelera/index.html', 'descripcion'],
    ['las librerías', 'guia/librerias/x/index.html', 'lugarDireccion'],
    ['las suscripciones', 'suscripciones.json', 'libreriaDireccion'],
    ['los lugares', 'guia/lugares/x/index.html', 'bibliotecaDireccion'],
    ['las bibliotecas', 'bibliotecas.json', 'lugarDescripcion'],
    ['el resto del sitio', 'agenda/2026-10/index.html', 'epigrafeImagen'],
  ])('%s se pone roja con una fuga', (_nombre, relativa, campo) => {
    const valor = CENTINELA[campo as keyof typeof CENTINELA];
    const dist = [...distLimpio(), { relativa, contenido: `<p>${valor}</p>` }];
    const fallos = barrerArtefacto(dist);
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toContain(`${relativa} → ${campo} (${valor})`);
  });

  it('el monto en una salida que no lo publica también es una fuga (B-804)', () => {
    const dist = [...distLimpio(), { relativa: 'cartelera/index.html', contenido: valorDe('montoLegible') }];
    expect(barrerArtefacto(dist).join('\n')).toContain('cartelera/index.html → montoLegible');
  });

  it('sin archivos, o sin el monto, el barrido no pasa en verde por vacuidad', () => {
    expect(barrerArtefacto([]).join('\n')).toContain('encontró 0 archivo(s)');
    const sinMonto = distLimpio().map((a) => ({ ...a, contenido: a.contenido.replace(/\d{3}/g, '') }));
    expect(barrerArtefacto(sinMonto).join('\n')).toContain('no aparece en NINGÚN archivo');
  });

  it('las canastas se reparten por salida', () => {
    expect(canastaDe('actividad/a/index.html')).toBe(CENTINELA_DEL_DETALLE);
    expect(canastaDe('events.json')).toBe(CENTINELA_DEL_INDICE);
    expect(canastaDe('guia/lugares/index.html')).toBe(CENTINELA_DE_LUGARES);
    expect(canastaDe('bibliotecas.json')).toBe(CENTINELA_DE_BIBLIOTECAS);
    // Un archivo que se llama parecido no hereda el permiso.
    expect(canastaDe('guia/lugares-otro.json')).toEqual([]);
    expect(canastaDe('index.html')).toEqual([]);
  });
});

describe('el paso 4 levanta Storage y el gate siembra una miniatura que el sitio reconoce — B-1790', () => {
  it('la portada de la de afuera deriva exactamente la ruta que el script sube', () => {
    /*
     * El gate sube `rutaDeLaMiniaturaDelGate` y el sitio busca la que deriva
     * `urlDeMiniaturaSiExiste` de la URL de la portada: dos derivaciones del
     * mismo nombre, la clase de B-88. Si se separan, el `srcset` no sale.
     */
    const huella = 'huella-de-prueba';
    const afuera = documentosDeLaSemilla({ huella }).find(([r]) => r.endsWith('-afuera'))![1] as {
      imagenes: { url: string }[];
    };
    const url = afuera.imagenes[0]!.url;
    const ruta = rutaDeLaMiniaturaDelGate(huella);
    expect(urlDeMiniaturaSiExiste(url, new Set([ruta]))).toContain(encodeURIComponent(ruta));
    expect(urlDeMiniaturaSiExiste(url, new Set())).toBeNull();
  });

  it('verificar-todo.sh le pasa el host de Storage al paso 4 en sus dos ramas', () => {
    const gate = readFileSync('scripts/verificar-todo.sh', 'utf8');
    const paso4 = gate.slice(gate.indexOf("paso 'Build del sitio"), gate.indexOf('# ── 5 ·'));
    expect(paso4).toContain('emulators:exec --only firestore,storage');
    expect(paso4).toMatch(/FIREBASE_STORAGE_EMULATOR_HOST="\$HOST_STORAGE"[\s\\]*\.\/scripts\/build-contra-emulador\.mjs/);
  });
});

describe('el verificador de directorios, sin build', () => {
  const mensajes = {
    sinLeer: () => 'sinLeer',
    pendienteEnElIndice: 'pendienteEnElIndice',
    sinFicha: () => 'sinFicha',
    sinLd: 'sinLd',
    fichaPendiente: () => 'fichaPendiente',
    sinSitemap: () => 'sinSitemap',
    pendienteEnElSitemap: 'pendienteEnElSitemap',
  };
  const correr = async (dist: Record<string, string>) => {
    const fallos: string[] = [];
    const oks: string[] = [];
    await verificarDirectorio(
      {
        leer: async (r: string) => dist[r] ?? null,
        publicables: async () => Object.entries(dist).map(([relativa, contenido]) => ({ relativa, contenido })),
        fallo: (m: string) => fallos.push(m),
        sinFallos: () => fallos.length === 0,
        ok: (m: string) => oks.push(m),
      },
      {
        coleccion: 'cosas',
        indice: 'cosas.json',
        publicadas: ['a'],
        pendiente: 'p',
        tipoLd: '"@type":"Cosa"',
        mensajes,
        exito: () => 'ok',
      },
    );
    return { fallos, oks };
  };
  const sano = {
    'cosas.json': JSON.stringify({ cosas: [{ slug: 'a' }] }),
    'guia/cosas/a/index.html': '<script>{"@type":"Cosa"}</script>',
    'sitemap.xml': '<loc>https://x/guia/cosas/a/</loc>',
  };

  it('un directorio sano da su ✓ (control)', async () => {
    expect(await correr(sano)).toEqual({ fallos: [], oks: ['ok'] });
  });

  it.each([
    ['la pendiente en el índice', { 'cosas.json': JSON.stringify({ cosas: [{ slug: 'a' }, { slug: 'p' }] }) }, 'pendienteEnElIndice'],
    ['la ficha de la pendiente', { 'guia/cosas/p/index.html': 'x' }, 'fichaPendiente'],
    ['la pendiente en el sitemap', { 'sitemap.xml': '/guia/cosas/a/ /guia/cosas/p/' }, 'pendienteEnElSitemap'],
    ['un índice que no leyó nada', { 'cosas.json': '{"cosas":[]}' }, 'sinLeer'],
  ])('%s lo pone rojo y no da ✓', async (_n, cambio, esperado) => {
    const { fallos, oks } = await correr({ ...sano, ...cambio });
    expect(fallos).toContain(esperado);
    expect(oks).toEqual([]);
  });

  it('un dato con fecha suelto es huérfano, y pegado no', () => {
    const { huerfanos, con } = datoConFecha(
      [
        { relativa: 'a.html', contenido: '$3.000 por año, cargado el 1/9' },
        { relativa: 'b.html', contenido: 'cuesta $3.000' },
      ],
      '$3.000',
    );
    expect(con).toEqual(['a.html', 'b.html']);
    expect(huerfanos).toEqual(['    b.html']);
  });
});
