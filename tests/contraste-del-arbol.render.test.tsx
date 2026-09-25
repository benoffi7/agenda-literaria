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
 *
 * ── Y los contenedores con tinte que reciben hijos — B-1870 ──────────────
 * El otro lado del mismo hueco: un elemento con fondo que **no** es blanco pleno
 * (`bg-white/60` de `Seccion`, `bg-papel/95` de la barra, la fila apagada de una
 * bandeja) y adentro algo cuya tinta decide **otro** archivo: un componente
 * (`<Campo>`, `<ChipEstado>`), el `{children}` o una prop `ReactNode`. La lista
 * **se deriva del fuente** con el parser de TypeScript (`contenedoresConTinte`):
 * uno nuevo que ningún caso monte pone la completitud en rojo, y cada caso que
 * dice montar uno tiene que mostrarlo en su DOM, con hijos adentro. Los hijos
 * son los de verdad —el formulario de actividad entero con todas las secciones
 * abiertas, el de reportes, el texto para redes, la vista previa—, no un `<p>`
 * de muestra.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Lo que es I/O —Firestore, Storage, la medición— se dobla: lo que se mide acá
 * es el markup. Los exports de la analítica son los mismos que dobla
 * `formulario-apilado.render.test.tsx`; los de los módulos de datos conservan
 * los reales y pisan solo lo que se llama al montar.
 */
vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => ({ valores: [], elegibles: [], cargando: false }),
  useLabelsTaxonomia: () => ({ tipo: { taller: 'Taller' } }),
}));
vi.mock('@/lib/actividades', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/actividades')>()),
  listarActividades: vi.fn(),
}));
vi.mock('@/lib/reportes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/reportes')>()),
  crearReporte: vi.fn(),
}));
vi.mock('@/lib/subir-imagen', () => ({
  urlDeImagenDePropuesta: vi.fn(async () => 'https://emu.test/flyer.jpg'),
  promoverImagenDePropuesta: vi.fn(),
}));
vi.mock('@/lib/bandejaDePropuestas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bandejaDePropuestas')>()),
  observarPropuestas: vi.fn(),
  revisarPropuesta: vi.fn(),
}));

import { ActividadFormulario } from '@/components/admin/ActividadFormulario';
import { CalendarioActividades } from '@/components/admin/CalendarioActividades';
import { FiltrosActividades } from '@/components/admin/FiltrosActividades';
import { PropuestasPanel } from '@/components/admin/PropuestasPanel';
import { ReporteFormulario } from '@/components/admin/ReporteFormulario';
import { CentroAyuda } from '@/components/admin/ayuda/CentroAyuda';
import { SeccionTextoRedes } from '@/components/admin/formulario/SeccionTextoRedes';
import { SeccionVistaPrevia } from '@/components/admin/formulario/SeccionVistaPrevia';
import { listarActividades } from '@/lib/actividades';
import { observarPropuestas } from '@/lib/bandejaDePropuestas';
import { FILTROS_VACIOS, ORDEN_POR_DEFECTO, opcionesPresentes } from '@/lib/filtrosActividades';
import type { ActividadConId, ActividadForm } from '@/types/actividad';
import type { PropuestaConId } from '@/types/propuesta';
import { formularioLleno } from './fixtures/formulario';
import { tsDe } from './fixtures/tiempo';

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
  fuentes,
  peorBase,
  RE_FONDO,
  RE_TINTA,
  resolverFondo,
  token,
  unaVez,
} from './fixtures/contraste-del-panel';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarActividades).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  fijarRolActivo(null);
  vi.useRealTimers();
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

/**
 * Un contenedor con tinte que recibe hijos, leído del fuente — B-1870.
 *
 * - **Con tinte**: un fondo en reposo que resuelve a color y no es `bg-white`
 *   pleno. El blanco pleno es la mejor base que hay: lo que cae ahí contrasta
 *   más que sobre la peor base que el render usa cuando no hay fondo, así que no
 *   hay nada que componer. `bg-white/60` sí es tinte: deja ver lo de abajo.
 * - **O con el tinte de quien llama**: un `className` que llama a una prop
 *   función (`claseFila?.(fila)` de `FilasEditor`). El archivo no sabe qué fondo
 *   pone, y por eso es de los que hay que montar.
 * - **Que recibe hijos**: adentro hay un componente (`<Campo>`), el `children` o
 *   una prop tipada `ReactNode`. Lo que es JSX literal del mismo archivo ya lo
 *   compone el barrido del fuente (D-1125).
 *
 * Las clases que llegan por identificador (`claseFilaApagada`) se resuelven
 * contra los `const clase… = '…'` del panel, que es de donde salen.
 */
interface Contenedor {
  componente: string;
  donde: string;
  etiqueta: string;
  /** Los fondos con tinte en reposo, como clase del DOM. Vacío si lo pone quien llama. */
  fondos: string[];
  hijos: string[];
}

/** Los literales de un `className`, resolviendo los `const clase…` del panel. */
const clasesLiterales = (
  n: ts.Node,
  constantes: ReadonlyMap<string, ts.Expression>,
  vistas: Set<string> = new Set(),
): string[] => {
  const out: string[] = [];
  const visitar = (x: ts.Node): void => {
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) {
      out.push(x.text);
      return;
    }
    if (ts.isTemplateExpression(x)) {
      out.push(x.head.text);
      for (const tramo of x.templateSpans) {
        visitar(tramo.expression);
        out.push(tramo.literal.text);
      }
      return;
    }
    if (ts.isIdentifier(x) && constantes.has(x.text) && !vistas.has(x.text)) {
      vistas.add(x.text);
      visitar(constantes.get(x.text)!);
      return;
    }
    ts.forEachChild(x, visitar);
  };
  visitar(n);
  return out;
};

const esCadena = (e: ts.Expression): boolean =>
  ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e);

const contenedoresConTinte = unaVez((): Contenedor[] => {
  const archivos = fuentes().map(({ donde, src }) => ({
    donde,
    sf: ts.createSourceFile(donde, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  }));
  const constantes = new Map<string, ts.Expression>();
  for (const { sf } of archivos) {
    const visitar = (n: ts.Node): void => {
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        /^clase/.test(n.name.text) &&
        n.initializer &&
        esCadena(n.initializer)
      ) {
        constantes.set(n.name.text, n.initializer);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  const out: Contenedor[] = [];
  for (const { donde, sf } of archivos) {
    const componente = donde.split('/').pop()!.replace(/\.tsx?$/, '');
    // Las props del archivo: las que son nodos de React y las que son funciones.
    const nodos = new Set(['children']);
    const funciones = new Set<string>();
    const props = (n: ts.Node): void => {
      if (ts.isPropertySignature(n) && n.type) {
        const tipo = n.type.getText();
        if (/\bReact(?:Node|Element)\b|JSX\.Element/.test(tipo)) nodos.add(n.name.getText());
        if (ts.isFunctionTypeNode(n.type)) funciones.add(n.name.getText());
      }
      ts.forEachChild(n, props);
    };
    props(sf);
    const recorrer = (n: ts.Node): void => {
      if (ts.isJsxElement(n)) {
        const el = n.openingElement;
        const attr = el.attributes.properties.find(
          (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'className',
        );
        const clases = attr?.initializer ? clasesLiterales(attr.initializer, constantes).join(' ') : '';
        const fondos = [
          ...new Set(
            [...clases.matchAll(RE_FONDO)]
              .filter((m) => m[1] === '')
              .map((m) => resolverFondo(m, donde, donde)?.clase)
              .filter((c): c is string => !!c && c !== 'bg-white'),
          ),
        ];
        let deQuienLlama = false;
        if (attr?.initializer) {
          const llamadas = (x: ts.Node): void => {
            if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && funciones.has(x.expression.text)) {
              deQuienLlama = true;
            }
            ts.forEachChild(x, llamadas);
          };
          llamadas(attr.initializer);
        }
        if (fondos.length || deQuienLlama) {
          const hijos = new Set<string>();
          const buscar = (x: ts.Node): void => {
            if (ts.isJsxOpeningElement(x) || ts.isJsxSelfClosingElement(x)) {
              const tag = x.tagName.getText();
              if (/^[A-Z]/.test(tag)) hijos.add(`<${tag}>`);
            }
            if (ts.isJsxExpression(x)) {
              const nombres = (y: ts.Node): void => {
                if (ts.isIdentifier(y) && nodos.has(y.text)) hijos.add(`{${y.text}}`);
                ts.forEachChild(y, nombres);
              };
              nombres(x);
            }
            ts.forEachChild(x, buscar);
          };
          n.children.forEach(buscar);
          if (hijos.size) {
            out.push({
              componente,
              donde: `${donde}:${sf.getLineAndCharacterOfPosition(el.getStart()).line + 1}`,
              etiqueta: el.tagName.getText(),
              fondos,
              hijos: [...hijos],
            });
          }
        }
      }
      ts.forEachChild(n, recorrer);
    };
    recorrer(sf);
  }
  return out;
});

/**
 * ¿Está este contenedor en el DOM, con hijos adentro? Un elemento de la misma
 * etiqueta con uno de sus fondos en reposo —o, si el fondo lo pone quien llama,
 * con cualquier fondo que no sea el blanco pleno— y con texto propio en algún
 * elemento de adentro, que es lo que se va a medir sobre él.
 */
const estaMontado = (c: Contenedor, raizDom: Element): boolean =>
  [...raizDom.querySelectorAll(c.etiqueta)].some((el) => {
    const fondos = [...enReposo(el).matchAll(RE_FONDO)]
      .map((m) => resolverFondo(m, 'DOM', 'DOM')?.clase)
      .filter((f): f is string => !!f);
    const conTinte = c.fondos.length
      ? fondos.some((f) => c.fondos.includes(f))
      : fondos.some((f) => f !== 'bg-white');
    return conTinte && [...el.querySelectorAll('*')].some((h) => medir(h).length > 0);
  });

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
  /**
   * Los contenedores con tinte (B-1870) que este caso monta con hijos adentro,
   * por el nombre de su archivo. Cada uno tiene que aparecer en el DOM del caso.
   */
  contenedores?: string[];
}

/** Abre cada acordeón cerrado, incluso los que aparecen al abrir otro. */
const abrirTodo = async (): Promise<void> => {
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const cerrados = [...document.querySelectorAll('button[aria-expanded="false"]')];
    if (!cerrados.length) return;
    for (const b of cerrados) await userEvent.click(b);
  }
};

/** Unas notas del arancel largas —salen tal cual al texto—: pasan el tope del caption y prenden el aviso ámbar. */
const LARGA = 'Dos cuotas, con material incluido y descuento para estudiantes. '.repeat(60);

const formulario = (copia: ActividadForm) => (
  <ActividadFormulario
    rol="admin"
    vistaDelPanel="celular"
    formatoDeHora="24"
    uid="uid-de-prueba"
    copia={copia}
    onGuardado={vi.fn()}
    onCancelar={vi.fn()}
  />
);

/** Un encuentro del calendario, en el mes que el reloj fijado abre. */
const sesionDelCalendario = (id: string, iso: string, calendarEventId: string | null) => ({
  id,
  inicio: tsDe(new Date(iso)),
  fin: tsDe(new Date(new Date(iso).getTime() + 2 * 3600_000)),
  tema: null,
  lectura: null,
  cancelada: false,
  calendarEventId,
  comisionId: null,
});

const actividadDelCalendario = (): ActividadConId =>
  ({
    id: 'a1',
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    estado: 'publicado',
    esCiclo: true,
    sesiones: [
      // Pasado: la fila apagada. Por venir y sin evento: el aviso del calendario.
      sesionDelCalendario('ses_1', '2026-09-08T22:00:00Z', 'evt_1'),
      sesionDelCalendario('ses_2', '2026-09-22T22:00:00Z', null),
    ],
    modalidades: [],
    modalidad: 'presencial',
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    tags: [],
    searchText: 'taller',
    createdBy: 'uid-de-prueba',
    updatedBy: 'uid-de-prueba',
    updatedAt: tsDe(new Date('2026-09-10T12:00:00Z')),
  }) as unknown as ActividadConId;

const propuesta = (over: Partial<PropuestaConId>): PropuestaConId => ({
  id: 'p1',
  titulo: 'Taller de crónica urbana',
  descripcion: 'Cuatro encuentros para escribir crónica.',
  fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }],
  modalidad: 'presencial',
  lugar: { nombre: 'Casa Brandon', direccion: 'Luis María Drago 236', barrio: 'Villa Crespo' },
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon' },
  arancel: { tipo: 'a-la-gorra', notas: null },
  inscripcion: { requiere: false, comoDice: null },
  incluye: [],
  incluyeOtro: null,
  imagen: { storagePath: 'propuestas/abc.jpg' },
  contacto: { via: 'mail', valor: 'hola@casabrandon.test' },
  estado: 'nueva',
  creadoEn: { toDate: () => new Date('2026-09-08T18:00:00Z') } as never,
  origen: 'formulario-publico',
  revision: { porUid: null, en: null, actividadId: null, motivo: null },
  ...over,
});

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
    contenedores: ['DirectorioPanel'],
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
  // ── Los contenedores con tinte, con sus hijos de verdad — B-1870 ──────────
  {
    componente: 'ActividadFormulario',
    estado: 'lleno, con un encuentro cancelado y todas las secciones abiertas',
    montar: () =>
      formulario(
        formularioLleno({
          sesiones: formularioLleno().sesiones.map((s, i) => ({ ...s, cancelada: i === 1 })),
        }),
      ),
    despues: abrirTodo,
    contenedores: ['Seccion', 'FilasEditor'],
  },
  {
    componente: 'ActividadFormulario',
    estado: 'recién empezado, con lo que falta en la barra',
    montar: () => formulario(formularioLleno({ titulo: '', descripcion: '', sesiones: [] })),
    contenedores: ['Seccion', 'BarraAcciones'],
  },
  {
    componente: 'ReporteFormulario',
    estado: 'con el aviso de que el repositorio es público',
    montar: () => <ReporteFormulario usuario={{ uid: 'u1', email: 'a@b.test' }} onEnviado={nada} />,
    despues: async () => {
      // La caja ámbar es lo que este caso existe para medir adentro de la sección.
      expect(screen.getByText('El repositorio es público:')).toBeTruthy();
    },
    contenedores: ['Seccion'],
  },
  {
    componente: 'SeccionTextoRedes',
    estado: 'con un texto más largo que un caption',
    montar: () => (
      <SeccionTextoRedes
        form={formularioLleno({ arancel: { ...formularioLleno().arancel, notas: LARGA } })}
        labelsPendientes={{}}
      />
    ),
    despues: async () => {
      await abrirTodo();
      expect(screen.getByText(/una publicación de Instagram admite/)).toBeTruthy();
    },
    contenedores: ['Seccion'],
  },
  {
    componente: 'SeccionVistaPrevia',
    estado: 'de una actividad sin publicar y con el link publicado',
    montar: () => {
      const f = formularioLleno({ estado: 'borrador' });
      return (
        <SeccionVistaPrevia
          form={{
            ...f,
            modalidades: f.modalidades.map((m) =>
              m.online ? { ...m, online: { ...m.online, urlPublica: true } } : m,
            ),
          }}
          labelsPendientes={{}}
        />
      );
    },
    despues: async () => {
      await abrirTodo();
      // Las dos cajas con tinte de la vista previa: la del link y la ámbar.
      expect(screen.getByText(/sale publicado en este evento/)).toBeTruthy();
      expect(screen.getByText(/todavía no está publicada/)).toBeTruthy();
    },
    contenedores: ['Seccion'],
  },
  {
    componente: 'CalendarioActividades',
    estado: 'con un encuentro pasado y uno por venir sin evento',
    montar: () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
      vi.mocked(listarActividades).mockResolvedValue([actividadDelCalendario()]);
      return <CalendarioActividades onEditar={nada} version={0} rol="admin" uid="uid-de-prueba" />;
    },
    despues: async () => {
      await screen.findByRole('alert');
      await userEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    },
    contenedores: ['CalendarioActividades'],
  },
  {
    componente: 'FiltrosActividades',
    estado: 'abiertos',
    montar: () => {
      const acts = [actividadDelCalendario()];
      return (
        <FiltrosActividades
          filtros={FILTROS_VACIOS}
          onFiltros={nada}
          orden={ORDEN_POR_DEFECTO}
          onOrden={nada}
          mailes={new Map()}
          opciones={opcionesPresentes(acts)}
          labels={{}}
          total={1}
          mostradas={1}
          actividades={acts}
          ahora={new Date('2026-09-15T12:00:00Z')}
        />
      );
    },
    despues: async () => {
      await userEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    },
    contenedores: ['FiltrosActividades'],
  },
  {
    componente: 'PropuestasPanel',
    estado: 'una nueva y una rechazada, las dos con flyer',
    montar: () => {
      vi.mocked(observarPropuestas).mockImplementation((cb) => {
        cb([propuesta({}), propuesta({ id: 'p2', estado: 'rechazada' })]);
        return () => {};
      });
      return <PropuestasPanel usuario={{ uid: 'u1' }} onConvertir={nada} />;
    },
    despues: async () => {
      await userEvent.click(screen.getByLabelText('Ver aceptadas y rechazadas'));
      // El flyer de la rechazada, adentro de su fila apagada.
      expect(screen.getByText(/se borró al rechazar/)).toBeTruthy();
    },
    contenedores: ['PropuestasPanel'],
  },
  {
    componente: 'CentroAyuda',
    estado: 'en la guía',
    montar: () => (
      <CentroAyuda contexto="formulario" idsSinLeer={[]} onCerrar={nada} onNovedadesLeidas={nada} />
    ),
    despues: abrirTodo,
    contenedores: ['CentroAyuda', 'Seccion'],
  },
  {
    componente: 'CentroAyuda',
    estado: 'en las novedades',
    montar: () => (
      <CentroAyuda contexto="formulario" idsSinLeer={[]} onCerrar={nada} onNovedadesLeidas={nada} />
    ),
    despues: async () => {
      await userEvent.click(screen.getByRole('tab', { name: /Novedades/ }));
    },
    contenedores: ['CentroAyuda'],
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

  it('control positivo: el registro de contenedores con tinte ve los que se conocen — B-1870', () => {
    // Si el recorrido del árbol se rompiera, la lista saldría vacía y la
    // completitud de abajo daría verde sin pedir nada. Son uno por cada vía:
    // `{children}`, la clase de quien llama, una prop `ReactNode` por una clase
    // resuelta por identificador, y un componente adentro.
    const por = (n: string) => contenedoresConTinte().filter((c) => c.componente === n);
    expect(por('Seccion').map((c) => c.fondos)).toEqual([['bg-white/60']]);
    expect(por('FilasEditor')).toEqual([
      expect.objectContaining({ etiqueta: 'li', fondos: [], hijos: expect.arrayContaining(['{children}']) }),
    ]);
    expect(por('DirectorioPanel')).toEqual([
      expect.objectContaining({ fondos: ['bg-black/[0.03]'], hijos: ['{detalle}'] }),
    ]);
    expect(por('FiltrosActividades')[0]?.hijos).toContain('<Campo>');
  });

  it('cada contenedor con tinte que recibe hijos se monta acá — B-1870', () => {
    // Completitud, derivada del fuente: un contenedor nuevo con fondo y con algo
    // de otro archivo adentro, que ningún caso monte, queda nombrado acá.
    const montados = new Set(CASOS.flatMap((c) => c.contenedores ?? []));
    expect(
      contenedoresConTinte()
        .filter((c) => !montados.has(c.componente))
        .map((c) => `${c.donde} <${c.etiqueta}> ${c.fondos.join(' ') || '(fondo de quien llama)'} ← ${c.hijos.join(', ')}`),
      'montalo en CASOS con hijos de verdad y declaralo en `contenedores`',
    ).toEqual([]);
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
      // B-1870 — lo que el caso dice montar tiene que estar, con hijos adentro:
      // si no, la completitud de arriba daría verde por una declaración.
      const sinMontar = contenedoresConTinte()
        .filter((c) => caso.contenedores?.includes(c.componente))
        .filter((c) => !estaMontado(c, container))
        .map((c) => `${c.donde} <${c.etiqueta}> ${c.fondos.join(' ')}`);
      expect(sinMontar, 'el caso declara estos contenedores y no los pinta con hijos').toEqual([]);
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
