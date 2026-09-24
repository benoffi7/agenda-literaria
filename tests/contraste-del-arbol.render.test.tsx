/**
 * El contraste de los avisos de color del panel, **medido sobre el DOM** — B-1830.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * `tests/contraste-del-panel.test.ts` lee el fuente: por línea y, desde B-1830,
 * por el árbol JSX **de cada archivo**. Lo que un fuente no dice es qué tinte pone
 * **otro componente** —`AvisoDePrecioViejo` es un `<span className="text-acento">`
 * sin fondo, y el fondo es el de la fila de `DirectorioPanel` donde lo meten— ni
 * qué clases llegan por identificador (`claseFilaApagada`, `claseBotonFila`). El
 * DOM sí lo dice: acá se montan los avisos de color del panel y, por cada
 * elemento con texto propio, se compone su tinta (la de él o la que hereda) sobre
 * el primer fondo de sus ancestros.
 *
 * ── La misma mecánica, no una copia ──────────────────────────────────────
 * Los colores, la lectura de una clase de fondo o de tinta y la composición de un
 * tinte translúcido sobre la peor base son los de `tests/fixtures/contraste-del-panel.ts`,
 * los mismos que usa el barrido del fuente. Dos implementaciones de la mezcla
 * serían dos respuestas posibles a la misma pregunta.
 *
 * ── Qué se mide y qué no ─────────────────────────────────────────────────
 * - El **reposo**: las clases sin variante. `hover:` y compañía van en el mismo
 *   grupo que su fondo con variante, y los mide el caso de los pares del barrido.
 * - Sin tinta en ningún ancestro, la del `html` (`--color-tinta`, `global.css`).
 *   Sin fondo en ningún ancestro, la peor base del panel: el aviso suelto no sabe
 *   dónde lo van a poner, y lo peor que puede haber abajo es la respuesta segura.
 * - No se mide el texto de un control deshabilitado (WCAG 1.4.3, como en el
 *   barrido) ni el de `sr-only`, que no se ve.
 *
 * ── Qué es un «aviso de color» ───────────────────────────────────────────
 * Cada `Aviso*.tsx` del panel. La lista de abajo se afirma contra el árbol: uno
 * nuevo que no se monte acá pone el caso de completitud en rojo.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AvisoDePrecioViejo } from '@/components/admin/AvisoDePrecioViejo';
import { AvisoEtiquetas } from '@/components/admin/AvisoEtiquetas';
import { AvisoVerificacion } from '@/components/admin/AvisoVerificacion';
import { AvisoVersionNueva } from '@/components/admin/AvisoVersionNueva';
import { DirectorioPanel, type FichaDeDirectorio } from '@/components/admin/DirectorioPanel';
import { AvisoBorradorLocal } from '@/components/admin/formulario/AvisoBorradorLocal';
import { AA_TEXTO, contraste, mezclar, type Srgb } from '@/lib/contraste';
import { fijarRolActivo } from '@/lib/rolActivo';
import {
  alfa,
  archivosDelPanel,
  colorDe,
  type Fondo,
  peorBase,
  RE_FONDO,
  RE_TINTA,
  resolverFondo,
  token,
} from './fixtures/contraste-del-panel';

afterEach(() => {
  cleanup();
  fijarRolActivo(null);
});

/** Las clases de un elemento **en reposo**: las que no llevan variante. */
const enReposo = (el: Element): string =>
  [...el.classList].filter((c) => !c.includes(':')).join(' ');

/** La tinta que pinta un elemento: la suya o la del ancestro más cercano. */
const tintaDe = (el: Element): { clase: string; color: Srgb; alfa: number }[] => {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const propias = [...enReposo(n).matchAll(RE_TINTA)].flatMap((t) => {
      const color = colorDe(t[2]!);
      return color ? [{ clase: t[0], color, alfa: alfa(t[3], t[4]) }] : [];
    });
    if (propias.length) return propias;
  }
  return [{ clase: 'tinta del html', color: token('tinta'), alfa: 1 }];
};

/** El fondo sobre el que cae: el del ancestro más cercano que tenga uno. */
const fondoDe = (el: Element): Fondo[] => {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const propios = [...enReposo(n).matchAll(RE_FONDO)]
      .map((m) => resolverFondo(m, 'DOM', 'DOM'))
      .filter((f): f is Fondo => f !== null);
    if (propios.length) return propios;
  }
  const base = peorBase();
  return [{ archivo: 'DOM', donde: 'DOM', clase: `peor base (${base.nombre})`, color: base.color }];
};

/** Cada elemento con texto propio que se ve, con cada par tinta + fondo que pinta. */
const medir = (raiz: Element): { texto: string; par: string; r: number }[] => {
  const out: { texto: string; par: string; r: number }[] = [];
  for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
    const texto = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    if (!texto) continue;
    if (el.closest('.sr-only, :disabled, [aria-disabled="true"]')) continue;
    for (const t of tintaDe(el)) {
      for (const bg of fondoDe(el)) {
        out.push({
          texto: texto.length > 40 ? `${texto.slice(0, 40)}…` : texto,
          par: `${t.clase} sobre ${bg.clase}`,
          r: contraste(mezclar(t.color, bg.color, t.alfa), bg.color),
        });
      }
    }
  }
  return out;
};

const ficha = (over: Partial<FichaDeDirectorio>): FichaDeDirectorio => ({
  id: 'f1',
  nombre: 'La Libre',
  slug: 'la-libre',
  estado: 'pendiente',
  origen: 'formulario-publico',
  ...over,
});

interface Caso {
  /** El componente, con el nombre de su archivo: es la clave de la completitud. */
  componente: string;
  estado: string;
  montar: () => ReactElement;
  /** Lo que hay que hacer después de montar para que aparezca lo que se mide. */
  despues?: () => Promise<void>;
}

const nada = () => {};

const CASOS: Caso[] = [
  {
    componente: 'AvisoVersionNueva',
    estado: 'con el formulario a medio cargar',
    montar: () => (
      <AvisoVersionNueva
        decision={{ accion: 'avisar', motivo: 'cambios-sin-guardar' }}
        versionActual="2026.09.24-1"
        versionPublicada="2026.09.24-2"
      />
    ),
  },
  {
    componente: 'AvisoVersionNueva',
    estado: 'cuando recargar no alcanzó',
    montar: () => (
      <AvisoVersionNueva
        decision={{ accion: 'avisar', motivo: 'recarga-sin-efecto' }}
        versionActual="2026.09.24-1"
        versionPublicada="2026.09.24-2"
      />
    ),
  },
  {
    componente: 'AvisoVerificacion',
    estado: 'sin verificar',
    montar: () => <AvisoVerificacion estado="sin-verificar" />,
  },
  {
    componente: 'AvisoEtiquetas',
    estado: 'una etiqueta, con la pantalla de Opciones a mano',
    montar: () => <AvisoEtiquetas etiquetas={['poesía']} onIrAOpciones={nada} onCerrar={nada} />,
  },
  {
    componente: 'AvisoEtiquetas',
    estado: 'dos etiquetas, para quien publica',
    montar: () => {
      fijarRolActivo('publicador');
      return (
        <AvisoEtiquetas etiquetas={['poesía', 'ensayo']} onIrAOpciones={nada} onCerrar={nada} />
      );
    },
  },
  {
    componente: 'AvisoDePrecioViejo',
    estado: 'suelto, con el rebote a la vista',
    montar: () => (
      <AvisoDePrecioViejo onConfirmar={vi.fn(async () => Promise.reject(new Error('x')))} />
    ),
    despues: async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Lo revisé: sigue siendo éste' }));
      await screen.findByRole('alert');
    },
  },
  {
    componente: 'AvisoDePrecioViejo',
    estado: 'adentro de las filas de la bandeja, viva y apagada',
    montar: () => (
      <DirectorioPanel
        directorio="lugares"
        fichas={[
          ficha({ id: 'viva', estado: 'pendiente' }),
          ficha({ id: 'apagada', nombre: 'Kiosco', estado: 'rechazado' }),
        ]}
        onMover={vi.fn(async () => {})}
        detalle={(f) => (
          <>
            San Telmo
            <AvisoDePrecioViejo sinFecha={f.id === 'apagada'} onConfirmar={vi.fn(async () => {})} />
          </>
        )}
      />
    ),
    despues: async () => {
      await userEvent.click(screen.getByLabelText('Ver publicadas y descartadas'));
    },
  },
  {
    componente: 'AvisoBorradorLocal',
    estado: 'con los links sin publicar',
    montar: () => (
      <AvisoBorradorLocal
        cuando="martes a las 18:40"
        linksSinPublicar
        onRecuperar={nada}
        onDescartar={nada}
      />
    ),
  },
];

describe('el contraste de los avisos de color del panel, sobre el DOM — B-1830', () => {
  it('cada Aviso*.tsx del panel se monta acá', () => {
    // Completitud: un aviso nuevo nace con su tinte y su tinta, y si no se monta
    // acá nadie compone la tinta de un hijo sobre el tinte del padre.
    const avisos = archivosDelPanel()
      .map((f) => f.split('/').pop()!.replace(/\.tsx?$/, ''))
      .filter((n) => /^Aviso/.test(n));
    expect(avisos.length).toBeGreaterThanOrEqual(5);
    const montados = new Set(CASOS.map((c) => c.componente));
    expect(avisos.filter((n) => !montados.has(n))).toEqual([]);
  });

  it('control negativo: la tinta vieja del aviso de versión nueva no llega sobre su tinte', () => {
    // La misma composición que usa el caso de abajo, sobre un DOM armado a mano
    // con las clases de antes de B-1751. Si `medir` devolviera siempre un número
    // alto, esto daría verde igual.
    const div = document.createElement('div');
    div.className = 'bg-amber-100/95';
    div.innerHTML = '<p class="font-mono text-amber-900/70">v1 → v2</p>';
    const [p] = medir(div);
    expect(p?.par).toBe('text-amber-900/70 sobre bg-amber-100/95');
    expect(p!.r).toBeLessThan(AA_TEXTO);
  });

  it.each(CASOS.map((c) => [`${c.componente} — ${c.estado}`, c] as const))(
    '%s: cada texto llega a AA sobre el fondo que hereda',
    async (_nombre, caso) => {
      const { container } = render(caso.montar());
      await caso.despues?.();
      const medidos = medir(container);
      // Control positivo: un aviso que no pintó nada daría verde sin mirar.
      expect(medidos.length).toBeGreaterThan(0);
      const flojos = medidos
        .filter((m) => m.r < AA_TEXTO)
        .map((m) => `«${m.texto}» — ${m.par} da ${m.r.toFixed(2)}:1`);
      expect(
        flojos,
        `estos textos no llegan a ${AA_TEXTO}:1 sobre el fondo del ancestro más cercano que ` +
          'tiene uno. Oscurecé la tinta o aclarale el fondo.',
      ).toEqual([]);
    },
  );
});
