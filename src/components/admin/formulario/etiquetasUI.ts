/**
 * Vocabulario de la UI del formulario: los enums del modelo en el idioma de la
 * pantalla.
 *
 * Vive acá porque después de B-79 lo comparten varias secciones. **No es el
 * vocabulario del evento público**: los `ETIQUETA_*` de `functions/calendario.js`
 * son prosa para el calendario ("Presencial y virtual", "por DM de Instagram") y
 * unificarlos haría que un cambio de copy del panel cambie lo que se publica.
 *
 * **`ETIQUETA_ESTADO` ya no vive acá: se reexporta.** Era idéntico palabra por
 * palabra al de `filtrosActividades.ts`, así que eran dos copias sin ninguna
 * diferencia que las justifique — la mitad de B-76 que se podía cerrar sin
 * decidir nada. Se reexporta en vez de pedirles a las secciones que cambien de
 * import: quien lo usa no tiene por qué saber de dónde sale.
 *
 * Lo que **no** se unificó es `ETIQUETA_MODALIDAD`, y no por olvido: el
 * formulario dice "Híbrido" y el listado "Presencial y virtual" para el mismo
 * valor guardado. Elegir cuál gana es una decisión de copy, no un refactor, y
 * está anotada como B-175.
 */
export { ETIQUETA_ESTADO } from '@/lib/filtrosActividades';
export const ETIQUETA_MODALIDAD = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Híbrido',
};

export const ETIQUETA_VIA = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  dm: 'DM de Instagram',
  formulario: 'Formulario',
};
