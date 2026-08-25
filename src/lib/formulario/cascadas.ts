/**
 * Cascadas del formulario: elegir un valor arrastra otros campos.
 *
 * Son reglas del modelo (§2.2, §11), no de presentación: "un club de lectura es
 * un ciclo con material", "una actividad virtual no tiene sede". Estaban en
 * `ActividadFormulario.tsx`, donde invertir un condicional dejaba `npm test`
 * entero en verde (B-70).
 *
 * Todas son `form → form`: no tocan estado de React, así que se testean como
 * `lib/duplicar.ts`, sin emuladores y sin render.
 */
import { onlineVacio, sedeVacia } from '@/lib/formulario/estadoInicial';
import { slugify } from '@/lib/slugify';
import type { ActividadForm } from '@/types/actividad';

/**
 * El slug se deriva del título mientras la actividad no esté publicada, y sigue
 * siendo editable a mano.
 *
 * Trampa 10 — después de publicar es inmutable: si cambia, las URLs se rompen y
 * el SEO se pierde. Por eso `slugBloqueado` entra como parámetro y no se
 * deduce acá: quien sabe si la actividad está publicada es el formulario.
 */
export const cambiarTitulo = (
  f: ActividadForm,
  titulo: string,
  slugBloqueado: boolean,
): ActividadForm => ({
  ...f,
  titulo,
  slug: slugBloqueado ? f.slug : slugify(titulo),
});

/**
 * §2.2 / §11 — un club de lectura es casi siempre un ciclo con material, y las
 * actividades con una persona al frente (taller, presentación, charla) abren el
 * bloque de tallerista o autor invitado.
 *
 * Las cascadas **agregan, nunca sacan**: cambiar de club a taller no apaga
 * `esCiclo` ni borra el material ya cargado. Sacar datos que alguien escribió
 * por un cambio de desplegable es pérdida de trabajo, y el checkbox está al
 * lado para apagarlo a mano.
 */
export const cambiarTipo = (f: ActividadForm, tipo: string): ActividadForm => ({
  ...f,
  tipo: tipo as ActividadForm['tipo'],
  // `feria` va acá con `club-lectura` (B-129): una feria del libro es de varios
  // días, así que es un ciclo del §2.2 —una actividad con N encuentros— y no una
  // fecha suelta. Sin esto caía en el default y quien la cargara tendría que
  // acordarse de tildar «es un ciclo» a mano, que es justo el olvido que las
  // cascadas del §11 existen para evitar.
  //
  // Lo que NO prende: material y tallerista. Una feria no tiene quien la dé, y
  // el material de lectura no es su caso.
  esCiclo: tipo === 'club-lectura' || tipo === 'feria' ? true : f.esCiclo,
  material: tipo === 'club-lectura' ? { ...f.material, tiene: true } : f.material,
  tallerista:
    tipo === 'taller' || tipo === 'presentacion' || tipo === 'charla'
      ? (f.tallerista ?? { nombre: '', bio: '', instagram: '' })
      : f.tallerista,
});

/**
 * §11 — la modalidad decide qué bloques existen: virtual no tiene sede,
 * presencial no tiene online, híbrido tiene los dos.
 *
 * A diferencia de `cambiarTipo`, acá sí se pone en `null` lo que dejó de
 * aplicar: el schema valida `sede` cuando la modalidad la pide (`superRefine`),
 * y una sede a medio llenar en una actividad virtual viajaría al documento y al
 * evento. Lo que ya estaba cargado se conserva si el bloque sigue existiendo
 * (`f.sede ?? sedeVacia()`).
 */
export const cambiarModalidad = (
  f: ActividadForm,
  modalidad: ActividadForm['modalidad'],
): ActividadForm => ({
  ...f,
  modalidad,
  sede: modalidad === 'virtual' ? null : (f.sede ?? sedeVacia()),
  online: modalidad === 'presencial' ? null : (f.online ?? onlineVacio()),
});
