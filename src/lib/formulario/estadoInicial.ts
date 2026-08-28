/**
 * Estado inicial del formulario de carga: el documento por defecto del §3.1 y
 * los sub-objetos que las cascadas de modalidad crean y destruyen.
 *
 * Vivía dentro de `ActividadFormulario.tsx`, donde ningún test podía
 * ejecutarlo (no hay testing-library, B-08). Son reglas del modelo —qué trae
 * una actividad nueva, qué campos son `null` y cuáles objetos vacíos— y como no
 * necesitan red, van en un módulo puro (B-70, `docs/05-patrones.md`).
 */
import { filaPideOnline, filaPideSede, nuevaModalidadId } from '@/lib/modalidades';
import { OPCIONES_BASE, opcionesVisibles, ordenarValores } from '@/lib/opciones';
import { sesionVacia } from '@/lib/sesiones';
import type {
  ActividadForm,
  CampoTaxonomia,
  Libro,
  Modalidad,
  ModalidadFilaForm,
  Online,
  Persona,
  Sede,
} from '@/types/actividad';

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
 * El bloque del libro presentado, vacío (DEC-1).
 *
 * Es **el único productor de esta forma**, y por eso existe como fábrica: la usa
 * el formulario nuevo (`formVacio`), el default de lectura de los documentos que
 * no tienen el campo (`documentoAForm`) y, por venir dentro de `formVacio`, el
 * molde con el que `autoguardado.ts` poda lo recuperado. Escribir el literal en
 * cada lado es la clase de B-88 —el productor y el consumidor derivando por
 * separado— y ya borró `tallerista.bio` una vez (D-124).
 *
 * **Tiene que ser determinístico**, y no es un detalle: es el default de lectura
 * de todo documento anterior a DEC-1, así que si devolviera algo distinto en
 * cada llamada (un id, una fecha) `huboCambioDeContenido` vería un cambio en
 * cada apertura del formulario y el panel escribiría una versión al historial
 * por cada vez que alguien mira una actividad. Es el argumento de
 * `ID_IMAGEN_MIGRADA` (D-125), en otro campo.
 */
export const libroVacio = (): Libro => ({ titulo: '', autor: '' });

/**
 * Una fila del editor de modalidades (B-224), con el bloque de lugar que le
 * corresponda: presencial trae sede, virtual trae el bloque online, híbrido los
 * dos (§11).
 *
 * Nace **sin fechas**: las dos son opcionales, y darle un «hoy» guardaría una
 * ventana que nadie cargó.
 *
 * Vive acá con las otras fábricas y no en `lib/modalidades.ts` por dos motivos:
 * necesita `sedeVacia`/`onlineVacio` —y ese módulo no las puede importar sin
 * cerrar un ciclo—, y el molde con el que `autoguardado.ts` poda lo recuperado
 * necesita exactamente esta forma. Escribirla dos veces es la clase de B-88 y ya
 * borró `tallerista.bio` una vez (D-124).
 */
export const modalidadVacia = (modalidad: Modalidad = 'presencial'): ModalidadFilaForm =>
  conModalidadDeFila(
    { id: nuevaModalidadId(), modalidad, inicio: '', fin: '', sede: null, online: null },
    modalidad,
  );

/**
 * La cascada de modalidad, ahora **por fila** (B-224): virtual no tiene sede,
 * presencial no tiene online, híbrido tiene los dos.
 *
 * Es la de `cascadas.cambiarModalidad` movida adentro de la fila, con el mismo
 * criterio: acá **sí** se pone en `null` lo que dejó de aplicar —el schema valida
 * la sede cuando la fila la pide, y una sede a medio llenar en una fila virtual
 * viajaría al documento y al evento—, y lo que ya estaba cargado se conserva si el
 * bloque sigue existiendo (`f.sede ?? sedeVacia()`).
 *
 * Está acá y no en `cascadas.ts`, que es su casa por B-70, porque `modalidadVacia`
 * la necesita y `cascadas.ts` importa este módulo. `cascadas.ts` la reexporta, así
 * que quien busca las cascadas la encuentra donde espera.
 */
export const conModalidadDeFila = (
  f: ModalidadFilaForm,
  modalidad: Modalidad,
): ModalidadFilaForm => ({
  ...f,
  modalidad,
  sede: filaPideSede(modalidad) ? (f.sede ?? sedeVacia()) : null,
  online: filaPideOnline(modalidad) ? (f.online ?? onlineVacio()) : null,
});

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
  // DEC-1 — nace vacío y no en `null`: son dos campos de texto, y
  // `formADocumento` los convierte en `null` si no tienen título, así que un
  // bloque vacío no fabrica nada en el documento.
  libro: libroVacio(),
  esCiclo: false,
  sesiones: [sesionVacia()],
  // B-224 — una sola fila presencial, que es lo que el formulario mostraba antes
  // de que las modalidades fueran una lista: el mismo default, en la forma nueva.
  // `modalidad`, `sede` y `online` ya no están en el formulario: los deriva
  // `formADocumento` de esta lista.
  modalidades: [modalidadVacia('presencial')],
  // B-97 — `completo` nace en `false` y viaja en el formulario aunque no se edite
  // desde ahí: se prende desde el menú del listado, y si el formulario no lo
  // trajera, cada guardado lo apagaría (ver `formADocumento`).
  inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: '', completo: false },
  arancel: { tipo: '', notas: '' },
  material: { tiene: false, items: [] },
  difusion: { arrobar: [], notas: '' },
  estado: 'borrador',
  tags: [],
  destacado: false,
});
