/**
 * Salida 8: la página de mes (B-113).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import { AVISO_DEL_MES_VENCIDO, SALIDA_DEL_MES_VENCIDO, bajadaDelMes, descripcionDelMes, mesesDelSitio, tituloDelMes } from '@/lib/mesPublico';
import { actividadCentinela } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';

// ───────────────────────────────────────────────────────────────────────────
// Salida 8 — la página de mes (B-113)
// ───────────────────────────────────────────────────────────────────────────

describe('barrido de la página de mes (§5, salida 8, B-113)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, como la 7 — y esta vez
   * lo pidió el `auditor-privacidad` antes del commit, no después.
   *
   * ── Qué se barre, y por qué no la página entera ───────────────────────────
   * De la página de mes, las filas las pinta `FilaDeActividad` con los campos que
   * ya barre el índice del listado y que fija por lista blanca
   * `tests/listado-del-sitio.test.ts`. Lo que **es nuevo** de esta salida son las
   * tres frases que arma `mesPublico.ts` y que van al `<title>`, a la
   * `meta description` y a la bajada — y una de ellas **interpola títulos de
   * actividades**:
   *
   *     const titulos = pagina.entradas.slice(0, 3).map((e) => e.titulo)
   *
   * Esa línea es la regla de forma de este archivo: *si una salida se arma
   * interpolando texto, tiene que existir un barrido de centinelas*. Hoy el daño
   * estaría acotado —todo `EntradaDeIndice` ya viaja en el `events.json`— pero el
   * peor caso está a un carácter: `e.searchText` en lugar de `e.titulo` mete la
   * descripción entera y normalizada de tres actividades en una
   * `meta description`, y sin esto nada se pondría en rojo.
   *
   * MUTACIÓN PROBADA: cambiar ese `e.titulo` por `e.searchText` hace fallar el
   * primer caso nombrando el centinela de `descripcion`.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  /**
   * Tres actividades para llegar al corte del §2.2, todas el mismo centinela con
   * distinto id. El ciclo del fixture arranca el 3 de septiembre y son ocho
   * semanales, así que **cruza a octubre**: la página existe y además ejercita el
   * recorte.
   */
  const entradas = () =>
    ['act_mes_1', 'act_mes_2', 'act_mes_3'].map((id) =>
      entradaDeIndice(toPublic(actividadCentinela(), id)),
    );

  const paginaDeSeptiembre = () => {
    const pagina = mesesDelSitio(entradas(), AHORA).find((m) => m.clave === '2026-09');
    expect(pagina, 'el fixture dejó de producir la página de septiembre').toBeDefined();
    return pagina!;
  };

  /** El texto que esta salida agrega, y nada más: las tres frases de `mesPublico`. */
  const textoDeLaPagina = (pagina = paginaDeSeptiembre()): string =>
    [
      tituloDelMes(pagina),
      descripcionDelMes(pagina),
      bajadaDelMes(pagina),
      AVISO_DEL_MES_VENCIDO,
      SALIDA_DEL_MES_VENCIDO,
    ].join(' | ');

  const PERMITIDO_EN_LA_PAGINA_DE_MES: readonly Excepcion[] = [
    {
      nombre: 'los títulos de las tres primeras actividades',
      centinelas: ['titulo'],
      porque:
        '§5.1 del diseño — la `meta description` de una página de mes es «{N} actividades ' +
        'literarias en {mes}: {tres títulos}». El título ya es público en el listado y en ' +
        'la página de detalle de cada actividad; lo que esta lista fija es que **solo** ' +
        'el título entre, y no el resumen, el searchText ni el nombre de quien organiza.',
    },
  ];

  it('el fixture llega al corte y la página existe', () => {
    // Control positivo: `barrer` sobre un texto vacío pasa la dirección «no sobra
    // nada» y falla la otra, así que sin esto una página que dejó de generarse
    // daría un error confuso en vez de decir que el fixture se rompió.
    expect(entradas()).toHaveLength(3);
    expect(paginaDeSeptiembre().entradas).toHaveLength(3);
    expect(textoDeLaPagina().length).toBeGreaterThan(60);
  });

  it('en el título, la descripción y la bajada sobrevive solo el título', () => {
    barrer('página de mes', textoDeLaPagina(), PERMITIDO_EN_LA_PAGINA_DE_MES, {
      insensible: true,
    });
  });

  it('y con el mes ya vencido tampoco cambia lo que sale', () => {
    /*
     * La otra rama de las tres frases: el verbo cambia («Qué hubo») y la bajada es
     * otra. Sin este caso, la mitad vencida de `mesPublico` no la barre nadie —
     * que es la forma en que la salida 7 tenía el link de la reunión cubierto solo
     * de refilón hasta que se le agregó su segunda rama.
     */
    const vencida = { ...paginaDeSeptiembre(), vencido: true };
    expect(tituloDelMes(vencida)).toContain('hubo');
    barrer(
      'página de mes (vencida)',
      textoDeLaPagina(vencida),
      PERMITIDO_EN_LA_PAGINA_DE_MES,
      { insensible: true },
    );
  });

  it('el recorte al mes no agrega ni un campo: es la misma entrada con menos sesiones', () => {
    /*
     * La afirmación de **forma**, la que sobrevive a que cambie la lista de
     * permitidos: la salida 8 deriva de la 1 y por construcción solo puede
     * **sacar**. Si algún día alguien le pasa a la página el documento en vez de
     * la entrada del índice, las claves dejan de coincidir y esto lo dice.
     */
    const [original] = entradas();
    const enLaPagina = paginaDeSeptiembre().entradas[0]!;
    expect(Object.keys(enLaPagina).sort()).toEqual(Object.keys(original!).sort());
  });
});
