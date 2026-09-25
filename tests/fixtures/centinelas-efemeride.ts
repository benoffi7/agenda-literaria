/**
 * **Una efeméride donde cada string es un centinela rastreable** — B-959.
 *
 * El mismo método que `centinelas.ts` (actividades) y `centinelas-biblioteca.ts`:
 * cada campo de texto del documento lleva un valor distinto y reconocible, y el
 * barrido de `tests/efemeride-publica.test.ts` busca cuáles sobreviven en cada
 * salida pública. La lista de los que **deben** sobrevivir es corta y está
 * justificada en el test; cualquier otro que aparezca es una fuga.
 *
 * `tests/efemeride-publica.test.ts` verifica además que este fixture cubra
 * **todos** los campos de `Efemeride`: un campo nuevo del tipo sin centinela acá
 * pone el caso en rojo, que es lo que impide que el fixture envejezca.
 */
import type { Efemeride } from '@/types/efemeride';
import { ts } from './tiempo';

const RUTAS = [
  // Públicos: son la efeméride.
  'titulo',
  'slug',
  'descripcion',
  'fuente.texto',
  'fuente.url',
  // Internos: uids (§5.1).
  'createdBy',
  'updatedBy',
] as const;

export type RutaDeEfemeride = (typeof RUTAS)[number];

export const CENTINELA_EFEMERIDE = {
  titulo: 'CENTINELA.titulo',
  slug: 'centinela-slug',
  descripcion: 'CENTINELA.descripcion',
  'fuente.texto': 'CENTINELA.fuente.texto',
  'fuente.url': 'https://centinela.fuente.example/CENTINELA.fuente.url',
  createdBy: 'CENTINELA.createdBy',
  updatedBy: 'CENTINELA.updatedBy',
} as const satisfies Record<RutaDeEfemeride, string>;

export const RUTAS_EFEMERIDE: readonly RutaDeEfemeride[] = RUTAS;

/** Lo que no es texto, con por qué sale o no sale. */
export const VALORES_NO_TEXTO_EFEMERIDE: Record<string, string> = {
  dia: 'número. **Sale**: es la mitad de «qué día». Se verifica por clave.',
  mes: 'número. **Sale**: la otra mitad. Se verifica por clave.',
  anio: 'número o `null`. **Sale**: el año del hecho. Se verifica por clave.',
  estado:
    'vocabulario cerrado de `ESTADOS_EFEMERIDE`. No sale: el JSON solo tiene publicadas.',
  publicadaAlgunaVez:
    'booleano pegajoso de la trampa 10. No sale: es el candado del slug, no un dato.',
  createdAt: 'un `Timestamp`. No sale: ciclo de vida.',
  updatedAt:
    'un `Timestamp`. No sale: publicar la fecha de edición convierte cada typo corregido en «actualizado hoy».',
};

export const efemerideCentinela = (): Efemeride => ({
  titulo: CENTINELA_EFEMERIDE.titulo,
  slug: CENTINELA_EFEMERIDE.slug,
  descripcion: CENTINELA_EFEMERIDE.descripcion,
  dia: 26,
  mes: 8,
  anio: 1914,
  fuente: { texto: CENTINELA_EFEMERIDE['fuente.texto'], url: CENTINELA_EFEMERIDE['fuente.url'] },
  estado: 'publicado',
  publicadaAlgunaVez: true,
  createdAt: ts('2026-09-25T12:00:00Z'),
  updatedAt: ts('2026-09-25T12:00:00Z'),
  createdBy: CENTINELA_EFEMERIDE.createdBy,
  updatedBy: CENTINELA_EFEMERIDE.updatedBy,
});
