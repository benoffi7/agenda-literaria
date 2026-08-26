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
import { onlineVacio, personaVacia, sedeVacia } from '@/lib/formulario/estadoInicial';
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
/**
 * Los tipos que prenden «es un ciclo» solos.
 *
 * Es un `Set` y no una cadena de `||` porque ya son tres y va a seguir creciendo:
 * cada categoría del dominio que dure varios días entra acá. Los slugs son los de
 * `opciones-base.json`, y están protegidos con `fijo: true` porque esta regla los
 * nombra: borrarlos desde la pantalla de taxonomías dejaría la cascada apuntando a
 * un tipo que no se puede elegir (§4.3).
 */
export const CICLOS_POR_TIPO = new Set(['club-lectura', 'feria', 'libreria-a-la-calle']);

export const cambiarTipo = (f: ActividadForm, tipo: string): ActividadForm => ({
  ...f,
  tipo: tipo as ActividadForm['tipo'],
  // `feria` va acá con `club-lectura` (B-129): una feria del libro es de varios
  // días, así que es un ciclo del §2.2 —una actividad con N encuentros— y no una
  // fecha suelta. Sin esto caía en el default y quien la cargara tendría que
  // acordarse de tildar «es un ciclo» a mano, que es justo el olvido que las
  // cascadas del §11 existen para evitar.
  //
  // `libreria-a-la-calle` va con las dos, por el mismo motivo y con el mismo
  // ejemplo (B-192, DEC-9): una librería que sale a la vereda un sábado es un día,
  // y una semana de la librería son varias jornadas — que es exactamente lo que se
  // decidió para «Feria».
  //
  // Lo que NO prende en ninguna de las dos: material y tallerista. Una feria no
  // tiene quien la dé, el material de lectura no es su caso, y una librería en la
  // calle tampoco.
  esCiclo: CICLOS_POR_TIPO.has(tipo) ? true : f.esCiclo,
  material: tipo === 'club-lectura' ? { ...f.material, tiene: true } : f.material,
  tallerista:
    tipo === 'taller' || tipo === 'presentacion' || tipo === 'charla'
      ? (f.tallerista ?? personaVacia())
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
