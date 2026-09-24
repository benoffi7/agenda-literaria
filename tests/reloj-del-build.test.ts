/**
 * B-1850 — el detalle y los hubs o meses que enlaza contestan con **el mismo
 * instante**.
 *
 * `caminosDeDetalle` y `carteleraDelSitio` usaban `new Date()` y el resto de los
 * `caminos*` el `generadoEn` del índice. En el borde —una actividad cuyo único
 * encuentro termina mientras corre el build— el detalle de una pasada decidía que
 * el hub de su tipo ya no se ofrece, mientras `/tipo/taller` se emitía indexable;
 * y la actividad del borde perdía su «Más en septiembre» con la página de
 * septiembre emitida y enlazable.
 *
 * ── Cómo se reproduce sin emulador ────────────────────────────────────────
 * `caminos*` leen Firestore, así que se mockea la puerta (`@/lib/firebase-admin`)
 * con un doble que devuelve documentos armados con `actividadDePrueba`, y el
 * `generadoEn` (`@/lib/version`). El reloj del proceso se fija **tres horas
 * después** del `generadoEn`: es la separación entre los dos relojes, exagerada
 * para que el caso no dependa de cuánto tarda el test.
 *
 * MUTACIONES PROBADAS (2026-09-24), las tres contra este archivo solo:
 *
 * - `caminosDeDetalle` vuelta a `ahora instanceof Date ? ahora : new Date()`: rojo
 *   «Más talleres», el del mes y el estructural del `new Date()`.
 * - lo mismo en `carteleraDelSitio`: rojo el de la cartelera y el estructural.
 * - `relojDelBuild` con `new Date(generadoEn)` en vez de `instanteDeIso`: rojo los
 *   dos del `generadoEn` ilegible (B-602) y el estructural del pelado.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Actividad, ValorOpcion } from "@/types/actividad";
import { sinComentarios } from "../scripts/sin-comentarios.mjs";
import { actividadDePrueba } from "./fixtures/indice";

/** El `generadoEn` del build: a media tarde del 15, lejos de cualquier borde de mes. */
const GENERADO_EN = "2026-09-15T15:00:00.000Z";
/** El reloj de la máquina mientras corre el build, tres horas después. */
const AHORA_DE_LA_MAQUINA = new Date("2026-09-15T18:00:00.000Z");

const estado = vi.hoisted(() => ({
  generadoEn: "",
  publicadas: [] as { id: string; data: unknown }[],
  opciones: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/version", async (original) => {
  const real = await original<typeof import("@/lib/version")>();
  return {
    ...real,
    INFO_VERSION: {
      version: "test",
      get generadoEn() {
        return estado.generadoEn;
      },
    },
  };
});

vi.mock("@/lib/firebase-admin", () => {
  const consulta = (docs: () => { id: string; data: unknown }[]) => {
    const q = {
      where: () => q,
      select: () => q,
      limit: () => q,
      get: async () => {
        const lista = docs().map((d) => ({
          id: d.id,
          data: () => d.data,
          ref: { collection: () => consulta(() => []) },
        }));
        return { docs: lista, empty: lista.length === 0 };
      },
    };
    return q;
  };
  const db = {
    collection: (nombre: string) => ({
      where: (_campo: string, _op: string, valor: string) =>
        consulta(() =>
          nombre === "actividades" && valor === "publicado"
            ? estado.publicadas
            : [],
        ),
    }),
    doc: (ruta: string) => ({ ruta }),
    getAll: async (...refs: { ruta: string }[]) =>
      refs.map((r) => ({
        data: () => ({ valores: estado.opciones[r.ruta.split("/")[1]!] ?? [] }),
      })),
  };
  return {
    hayCredenciales: () => true,
    adminDb: () => db,
    adminBucket: () => ({ getFiles: async () => [[]] }),
  };
});

const {
  caminosDeDetalle,
  caminosDeMes,
  caminosDeTipo,
  carteleraDelSitio,
  olvidarContenido,
  olvidarMiniaturas,
  olvidarRespaldoDelReloj,
  relojDelBuild,
} = await import("@/lib/contenidoDelSitio");

const opcion = (slug: string, label: string): ValorOpcion =>
  ({ slug, label, orden: 1, fijo: true, usos: 0 }) as ValorOpcion;

const doc = (a: Actividad) => ({ id: `act_${a.slug}`, data: a });

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA_DE_LA_MAQUINA);
});
afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  olvidarContenido();
  olvidarMiniaturas();
  olvidarRespaldoDelReloj();
  estado.generadoEn = GENERADO_EN;
  estado.opciones = { tipo: [opcion("taller", "Taller")] };
  estado.publicadas = [
    // Dos pasadas de septiembre: con la del borde, el mes llega al corte de tres.
    doc(
      actividadDePrueba({
        slug: "pasada-uno",
        fechas: ["2026-09-02T22:00:00Z"],
      }),
    ),
    doc(
      actividadDePrueba({
        slug: "pasada-dos",
        fechas: ["2026-09-05T22:00:00Z"],
      }),
    ),
    /*
     * **La del borde**: su único encuentro va de 14 a 16 (UTC). Con el reloj del
     * índice (las 15) está en curso, y es lo único vigente del tipo; con el de la
     * máquina (las 18) ya terminó.
     */
    doc(
      actividadDePrueba({
        slug: "la-del-borde",
        fechas: ["2026-09-15T14:00:00Z"],
        // Con imagen, para que tenga afiche en `/cartelera`.
        imagenUrl: "https://example.com/afiche.jpg",
      }),
    ),
  ];
});

describe("el detalle y lo que enlaza miran el mismo reloj (B-1850)", () => {
  it("«Más talleres» de una pasada existe si y solo si el hub del tipo se emite indexable", async () => {
    const [detalles, tipos] = await Promise.all([
      caminosDeDetalle(),
      caminosDeTipo(),
    ]);
    const hub = tipos.find((t) => t.params.tipo === "taller")!.props.vista.hub;
    const pasada = detalles.find((d) => d.params.slug === "pasada-uno")!.props
      .detalle;

    expect(pasada.yaPaso).toBe(true);
    // El hub tiene lo del borde adentro: con el reloj del índice, está en curso.
    expect(hub.vacio).toBe(false);
    expect(pasada.masDelTipo?.ruta).toBe(hub.ruta);
  });

  it("la del borde enlaza el mes que la página de mes emite, y esa página la tiene adentro", async () => {
    const [detalles, meses] = await Promise.all([
      caminosDeDetalle(),
      caminosDeMes(),
    ]);
    const borde = detalles.find((d) => d.params.slug === "la-del-borde")!.props
      .detalle;

    expect(borde.yaPaso).toBe(false);
    expect(borde.mes?.clave).toBe("2026-09");
    const pagina = meses.find((m) => m.params.mes === "2026-09")!.props.vista
      .pagina;
    expect(pagina.vencido).toBe(false);
    expect(pagina.entradas.map((e) => e.slug)).toContain("la-del-borde");
  });

  it("la cartelera decide con el mismo reloj: la del borde sigue en la pared", async () => {
    const afiches = await carteleraDelSitio();
    expect(afiches.map((a) => a.slug)).toContain("la-del-borde");
  });

  it("control: con el reloj de la máquina pasado a mano, la del borde ya pasó", async () => {
    // Prueba que el escenario de arriba es el borde de verdad y no un caso que da
    // igual con cualquiera de los dos relojes.
    const detalles = await caminosDeDetalle(AHORA_DE_LA_MAQUINA);
    const borde = detalles.find((d) => d.params.slug === "la-del-borde")!.props
      .detalle;
    expect(borde.yaPaso).toBe(true);
    expect(borde.mes).toBeNull();
    expect(
      (await carteleraDelSitio(AHORA_DE_LA_MAQUINA)).map((a) => a.slug),
    ).not.toContain("la-del-borde");
  });
});

describe("relojDelBuild", () => {
  it("un Date explícito gana", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    expect(relojDelBuild(d, GENERADO_EN)).toBe(d);
  });

  it("el argumento de Astro (`{ paginate, rss }`) se ignora y gana el índice (B-237)", () => {
    expect(
      relojDelBuild(
        { paginate: () => [], rss: null },
        GENERADO_EN,
      ).toISOString(),
    ).toBe(GENERADO_EN);
  });

  it("un generadoEn ilegible no da Invalid Date, y el respaldo es el mismo para todos (B-602)", () => {
    const uno = relojDelBuild(undefined, "no-es-una-fecha");
    vi.setSystemTime(new Date(AHORA_DE_LA_MAQUINA.getTime() + 60_000));
    const otro = relojDelBuild(undefined, "");
    vi.setSystemTime(AHORA_DE_LA_MAQUINA);

    expect(Number.isNaN(uno.getTime())).toBe(false);
    expect(otro.getTime()).toBe(uno.getTime());
  });

  it("con un generadoEn ilegible, el build de los caminos no tira", async () => {
    estado.generadoEn = "basura";
    await expect(caminosDeDetalle()).resolves.toHaveLength(3);
    await expect(caminosDeMes()).resolves.toBeDefined();
    await expect(caminosDeTipo()).resolves.toBeDefined();
  });
});

describe("ningún camino arma su reloj por fuera de relojDelBuild", () => {
  const codigo = sinComentarios(
    readFileSync(
      fileURLToPath(
        new URL("../src/lib/contenidoDelSitio.ts", import.meta.url),
      ),
      "utf8",
    ),
  );

  it("el único `new Date()` sin argumento es el respaldo de relojDelBuild", () => {
    expect(codigo.match(/new Date\(\)/g) ?? []).toHaveLength(1);
    expect(codigo).toContain("respaldoDelReloj ??= new Date()");
  });

  it("ningún `new Date(indice.generadoEn)` pelado (B-602)", () => {
    expect(codigo).not.toMatch(/new Date\(\s*[\w.]*generadoEn\s*\)/);
  });
});
