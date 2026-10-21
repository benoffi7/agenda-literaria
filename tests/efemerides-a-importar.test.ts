/**
 * **Las efemérides del relevamiento entran como si se hubieran cargado a mano** — B-2224.
 *
 * `importar-efemerides.mjs` escribe con el Admin SDK, que no pasa por
 * `firestore.rules`. Así que lo que la regla y el formulario le exigen a cada
 * efeméride se verifica acá, sobre el archivo: si una entrada no pasa
 * `efemerideFormSchema`, o el documento que sale de ella no es el que
 * `formAEfemeride` armaría, el importador metería en la base algo que el panel
 * no deja guardar —y que después no se puede editar sin arreglarlo primero—.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aImportar, conSlug } from '../scripts/efemerides-a-importar.mjs';
import { RE_SLUG_EFEMERIDE, efemerideFormSchema, formAEfemeride } from '@/lib/efemeride-schema';
import type { Efemeride, EfemerideForm } from '@/types/efemeride';

type Entrada = Pick<
  Efemeride,
  'titulo' | 'descripcion' | 'dia' | 'mes' | 'anio' | 'fuente' | 'estado'
>;

const ENTRADAS: Entrada[] = JSON.parse(
  readFileSync(`${process.cwd()}/scripts/datos/efemerides-literarias.json`, 'utf8'),
);

/** La entrada como la tipearía alguien en el formulario. */
const comoFormulario = (e: Entrada): EfemerideForm => ({
  titulo: e.titulo,
  slug: '',
  descripcion: e.descripcion,
  dia: String(e.dia),
  mes: String(e.mes),
  anio: e.anio === null ? '' : String(e.anio),
  fuente: { texto: e.fuente?.texto ?? '', url: e.fuente?.url ?? '' },
});

describe('el archivo del relevamiento — B-2224', () => {
  it('son las 296 con día y mes: las de solo mes quedaron afuera', () => {
    expect(ENTRADAS).toHaveLength(296);
    for (const e of ENTRADAS) expect(Number.isInteger(e.dia), e.titulo).toBe(true);
  });

  it('cada una pasa el schema del formulario', () => {
    for (const e of ENTRADAS) {
      const r = efemerideFormSchema.safeParse(comoFormulario(e));
      expect(r.success, `${e.titulo}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it('y el documento es el que armaría el formulario', () => {
    /*
     * La prueba de que el importador no tiene una forma propia: el slug, la
     * fuente saneada y los números son los de `formAEfemeride`.
     */
    for (const e of conSlug(ENTRADAS)) {
      const delForm = formAEfemeride(comoFormulario(e), e.estado);
      expect({ ...e }, e.titulo).toEqual(delForm);
    }
  });

  it('ningún slug se repite, y todos tienen la forma de la regla', () => {
    const slugs = conSlug(ENTRADAS).map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(new RegExp(RE_SLUG_EFEMERIDE));
  });

  it('las discutidas entran como borrador, el resto publicadas', () => {
    expect(ENTRADAS.filter((e) => e.estado === 'borrador')).toHaveLength(22);
    expect(ENTRADAS.filter((e) => e.estado === 'publicado')).toHaveLength(274);
  });

  it('lo publicado no lleva notas de investigación', () => {
    /*
     * El CSV traía la nota del relevamiento como descripción —citas en inglés,
     * «según Wikipedia», «verificado en otra sesión»— y la descripción sale en
     * una página indexada. Las publicadas se reescribieron; las de borrador
     * conservan la nota a propósito, porque es lo que hay que leer antes de
     * publicarlas.
     */
    const nota =
      /\b(was published|published on|published in)\b|según Wikipedia|infobox|nota preexistente|otra sesión|por el usuario|Fuentes varían/i;
    for (const e of ENTRADAS.filter((x) => x.estado === 'publicado')) {
      expect(e.descripcion, e.titulo).not.toMatch(nota);
    }
  });
});

describe('aImportar — B-2224', () => {
  const tres = [{ titulo: 'Nace Umberto Eco' }, { titulo: 'Muere Albert Camus' }, { titulo: 'Nace  Umberto Eco' }];

  it('reparte entre nuevas, ya en la base y repetidas en el archivo', () => {
    const r = aImportar(tres, ['muere-albert-camus']);
    expect(r.nuevas.map((e) => e.slug)).toEqual(['nace-umberto-eco']);
    expect(r.yaEstan.map((e) => e.slug)).toEqual(['muere-albert-camus']);
    expect(r.repetidas.map((e) => e.slug)).toEqual(['nace-umberto-eco']);
  });

  it('es idempotente: con todo ya escrito, no escribe nada', () => {
    const primera = aImportar(ENTRADAS, []);
    const segunda = aImportar(ENTRADAS, primera.nuevas.map((e) => e.slug));
    expect(primera.nuevas).toHaveLength(296);
    expect(segunda.nuevas).toHaveLength(0);
  });
});
