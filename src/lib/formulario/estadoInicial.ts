/**
 * Estado inicial del formulario de carga: el documento por defecto del §3.1 y
 * los sub-objetos que las cascadas de modalidad crean y destruyen.
 *
 * Vivía dentro de `ActividadFormulario.tsx`, donde ningún test podía
 * ejecutarlo (no hay testing-library, B-08). Son reglas del modelo —qué trae
 * una actividad nueva, qué campos son `null` y cuáles objetos vacíos— y como no
 * necesitan red, van en un módulo puro (B-70, `docs/05-patrones.md`).
 */
import { OPCIONES_BASE, opcionesVisibles, ordenarValores } from '@/lib/opciones';
import { sesionVacia } from '@/lib/sesiones';
import type { ActividadForm, CampoTaxonomia, Online, Persona, Sede } from '@/types/actividad';

/** La sede que se crea al pasar a presencial o híbrido. `CABA` por defecto. */
export const sedeVacia = (): Sede => ({
  nombre: '',
  direccion: '',
  barrio: '',
  ciudad: 'CABA',
  indicaciones: '',
  geo: null,
});

/**
 * Las coordenadas que crea el pegado de un link de Maps. `geo` nace en `null` y
 * esta fábrica existe para que el molde de la poda de `autoguardado.ts` conozca
 * su forma sin escribirla a mano — la última forma escrita a mano ahí borró
 * `tallerista.bio` (D-124).
 */
export const geoVacia = (): NonNullable<Sede['geo']> => ({ lat: 0, lng: 0 });

/** El bloque online que se crea al pasar a virtual o híbrido. */
export const onlineVacio = (): Online => ({ plataforma: '', url: '', urlPublica: false });

/**
 * La persona que se crea al elegir un tipo que la pide (taller, presentación,
 * charla). **No es la misma forma que `organizador`**, que tiene `web` y no
 * `bio`.
 *
 * Está acá, y no como literal en `cascadas.ts`, porque el molde con el que
 * `autoguardado.ts` poda lo recuperado necesita exactamente esta forma — y
 * escribirla dos veces ya salió mal una vez: el molde nació con la forma de
 * `organizador`, así que la poda borraba `tallerista.bio` de todo borrador
 * recuperado (D-124).
 */
export const personaVacia = (): Persona => ({ nombre: '', bio: '', instagram: '' });

/**
 * Primera opción elegible de una taxonomía **según las opciones base**, que es
 * la que el desplegable va a mostrar arriba.
 *
 * No consulta Firestore a propósito: `ordenarValores` pone las fijas primero
 * por su `orden` y ninguna opción creada con "Otro" puede quedar antes que una
 * fija (§4.3), así que la primera elegible es siempre la primera base. Eso
 * permite preseleccionarla en el estado inicial en lugar de esperar a que
 * lleguen las opciones — que es lo que hacía nacer sucio el formulario (B-87).
 *
 * El orden y la aprobación se importan de `lib/opciones.ts`: reimplementarlos
 * acá sería la tercera copia de la misma regla (B-72).
 */
export const primeraOpcionBase = (campo: CampoTaxonomia): string =>
  ordenarValores(opcionesVisibles(OPCIONES_BASE[campo]))[0]?.slug ?? '';

/**
 * El formulario de una actividad nueva.
 *
 * `tipo` arranca preseleccionado con la primera opción del desplegable (D-12).
 * Se resuelve acá y no con un efecto del hijo: un efecto que escribe el estado
 * del padre después del primer render deja el formulario "con cambios sin
 * guardar" desde el arranque, y con eso el aviso de versión nueva nunca se
 * auto-recarga y `formulario_abandonado` reporta `sucio: 1` siempre (B-87).
 *
 * `arancel.tipo` sigue vacío a propósito: el default sería "Gratis" y un taller
 * pago que nadie corrige se publica como gratuito (D-16).
 */
export const formVacio = (): ActividadForm => ({
  tipo: primeraOpcionBase('tipo') as ActividadForm['tipo'],
  titulo: '',
  slug: '',
  descripcion: '',
  imagenes: [],
  organizador: { nombre: '', instagram: '', web: '' },
  tallerista: null,
  esCiclo: false,
  sesiones: [sesionVacia()],
  modalidad: 'presencial',
  sede: sedeVacia(),
  online: null,
  inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: '' },
  arancel: { tipo: '', notas: '' },
  material: { tiene: false, items: [] },
  difusion: { arrobar: [], notas: '' },
  estado: 'borrador',
  tags: [],
  destacado: false,
});
