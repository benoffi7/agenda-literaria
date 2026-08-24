/**
 * Vocabulario de la UI del formulario: los enums del modelo en el idioma de la
 * pantalla.
 *
 * Vive acá porque después de B-79 lo comparten varias secciones. **No es el
 * vocabulario del evento público**: los `ETIQUETA_*` de `functions/calendario.js`
 * son prosa para el calendario ("Presencial y virtual", "por DM de Instagram") y
 * unificarlos haría que un cambio de copy del panel cambie lo que se publica.
 *
 * B-76 quiere un `src/lib/etiquetas.ts` compartido con el listado, que hoy pinta
 * el estado en slug crudo. Cuando salga, estos tres mapas son los que se mudan.
 */
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

export const ETIQUETA_ESTADO = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  publicado: 'Publicado',
  cancelado: 'Cancelado',
};
