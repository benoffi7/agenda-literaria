import { describe, expect, it } from 'vitest';
import { tituloDeLaVista, type Vista } from '@/components/admin/pantallas/vista';
import { PANTALLAS_DEL_PANEL } from '@/lib/rolDelPanel';
import type { ActividadConId, ActividadForm } from '@/types/actividad';

/**
 * M-17 — el título del encabezado salió de una cadena de ternarios en
 * `AdminApp.tsx` a `tituloDeLaVista`. El refactor promete el mismo texto en cada
 * pantalla, así que la tabla de abajo es la que tenía el ternario, entera.
 */
const actividad = { titulo: 'Taller de cuento' } as ActividadConId;
const copia = {} as ActividadForm;
const ficha = { nombre: 'La Libre' };

const CASOS: [Vista, string][] = [
  [{ tipo: 'lista' }, 'Actividades'],
  [{ tipo: 'nueva' }, 'Nueva actividad'],
  [{ tipo: 'editar', actividad }, 'Taller de cuento'],
  [{ tipo: 'duplicar', copia, tituloOrigen: 'Club' }, 'Copia de Club'],
  [{ tipo: 'reportes' }, 'Bugs y sugerencias'],
  [{ tipo: 'calendario' }, 'Calendario'],
  [{ tipo: 'historial', actividad }, 'Historial de Taller de cuento'],
  [{ tipo: 'taxonomias' }, 'Opciones de los desplegables'],
  [{ tipo: 'estadisticas' }, 'Estado del catálogo'],
  [{ tipo: 'boletin' }, 'Correo semanal'],
  [{ tipo: 'propuestas' }, 'Propuestas'],
  [
    {
      tipo: 'convertir',
      copia,
      tituloOrigen: 'Ronda',
      avisos: [],
      imagenNoPromovida: null,
      alGuardar: async () => {},
    },
    'Propuesta de Ronda',
  ],
  [{ tipo: 'librerias' }, 'Librerías'],
  [{ tipo: 'libreria' }, 'Librería nueva'],
  [{ tipo: 'libreria', ficha: ficha as never }, 'La Libre'],
  [{ tipo: 'suscripciones' }, 'Suscripciones'],
  [{ tipo: 'suscripcion' }, 'Suscripción nueva'],
  [{ tipo: 'suscripcion', ficha: ficha as never }, 'La Libre'],
  [{ tipo: 'lugares' }, 'Lugares'],
  [{ tipo: 'lugar' }, 'Lugar nuevo'],
  [{ tipo: 'lugar', ficha: ficha as never }, 'La Libre'],
  [{ tipo: 'bibliotecas' }, 'Bibliotecas'],
  [{ tipo: 'biblioteca' }, 'Biblioteca nueva'],
  [{ tipo: 'biblioteca', ficha: ficha as never }, 'La Libre'],
  [{ tipo: 'efemerides' }, 'Efemérides'],
  [{ tipo: 'efemeride' }, 'Efeméride nueva'],
  [{ tipo: 'efemeride', efemeride: { titulo: 'Borges' } as never }, 'Borges'],
];

describe('tituloDeLaVista — el mismo texto que el ternario de antes (M-17)', () => {
  it.each(CASOS)('%o → %s', (vista, titulo) => {
    expect(tituloDeLaVista(vista)).toBe(titulo);
  });

  it('la tabla recorre todas las pantallas del panel', () => {
    // Sin esto, una vista nueva con un título mal puesto pasaría sin caso.
    expect([...new Set(CASOS.map(([v]) => v.tipo))].sort()).toEqual(
      [...PANTALLAS_DEL_PANEL].sort(),
    );
  });
});
