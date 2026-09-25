/**
 * Los ids de `src/lib/novedades.ts`, en el mismo orden, y lo justo para contar
 * las no leídas (D-64).
 *
 * El contador del botón «Ayuda» se pinta antes del login, así que lo que importa
 * `BotonAyuda` entra al chunk inicial del panel. `novedades.ts` es texto (~21 KB
 * gzip) y solo lo necesita `CentroAyuda`, que es diferido: por eso el botón lee
 * de acá y no de allá (B-1961). `tests/novedadesIds.test.ts` ata esta lista a
 * `NOVEDADES` y dice qué línea falta cuando se agrega una novedad.
 */

/** Lo más nuevo arriba, igual que `NOVEDADES`. */
export const NOVEDADES_IDS: readonly string[] = [
  'filtros-sin-resultados-cual',
  'efemerides',
  'publicador-carga-en-su-ciudad',
  'cancelar-encuentro-avisa',
  'que-se-pierde-en-google',
  'pestana-pasadas',
  'historial-avisa-imagenes-borradas',
  'ritmo-del-catalogo',
  'volver-a-sin-mirar',
  'precios-para-revisar',
  'convertir-una-que-vence-avisa',
  'convertir-marca-en-revision',
  'precio-revisado',
  'instagram-que-no-reconocemos-se-avisa',
  'publicador-crea-etiquetas',
  'el-panel-avisa-si-no-pudo-verificar-tu-navegador',
  'el-correo-semanal-se-arma-solo',
  'la-hora-en-am-pm-entiende-las-24',
  'ya-se-pueden-anotar-al-correo',
  'el-instagram-se-prolija-al-salir-del-campo',
  'las-horas-se-cargan-en-am-pm',
  'la-miniatura-abre-la-imagen-entera',
  'los-carteles-de-error-hablan-en-castellano',
  'decidir-la-foto-al-convertir',
  'link-de-la-ficha-prellenado-al-convertir',
  'guia-de-bibliotecas',
  'horario-de-atencion-en-la-guia',
  'guardar-y-publicar-en-la-guia',
  'cupo-completo-en-el-formulario',
  'ver-en-el-sitio-desde-el-panel',
  'encuentros-sin-fecha-precargada',
  'sede-ahora-es-lugar',
  'geografia-en-cascada-en-la-guia',
  'geografia-en-cascada',
  'publicador-ve-su-ciudad',
  'guia-de-lugares',
  'guia-de-suscripciones',
  'guia-de-librerias',
  'mail-de-quien-cargo-cada-actividad',
  'fotos-de-google-photos-ya-suben',
  'propuestas-avisan-antes-de-borrarse',
  'como-se-ve-en-google',
  'foto-de-la-propuesta',
  'bandeja-de-propuestas',
  'que-se-llevan',
  'vista-pc-o-celular',
  'historial-no-reenciende-links',
  'historial-no-publica-a-ciegas',
  'opciones-para-sumarse',
  'recargar-cuando-algo-no-carga',
  'monto-del-arancel',
  'formulario-en-pestanias',
  'filtros-de-etiquetas-y-destacadas',
  'aviso-foto-rotada',
  'describir-la-portada-ya-no-frena',
  'slug-fijo-para-siempre',
  'describir-la-portada',
  'listado-en-grilla',
  'copia-con-titulo-legitimo-se-publica',
  'taxonomia-aprobada-por-reuso',
  'estadisticas-sedes-repetidas',
  'ayuda-por-seccion-del-formulario',
  'calendario-y-tablero-mas-anchos',
  'destacada-se-ve-en-el-listado',
  'una-sola-forma-de-nombrar-las-modalidades',
  'abrir-link-corto-de-maps',
  'motivo-al-fallar-una-imagen',
  'reportes-solo-abiertos',
  'historial-restaurar-campo',
  'tablero-con-pestanias',
  'plataforma-a-confirmar',
  'material-duplicar-y-contador',
  'errores-de-galeria-y-encuentros-al-lado',
  'evento-borrado-a-mano-vuelve',
  'errores-del-material-al-lado',
  'aviso-de-opcion-que-no-quedo',
  'coordenadas-con-coma',
  'las-imagenes-se-alivianan-solas',
  'las-demas-imagenes-se-ven',
  'sitio-con-dominio-propio',
  'cancelada-conserva-pagina',
  'link-reunion-dice-el-calendario',
  'flyer-y-cartelera',
  'color-por-tipo-de-actividad',
  'filtro-de-arancel-en-el-listado',
  'varias-formas-de-cursar',
  'subir-imagenes-propias',
  'cierres-de-inscripcion-en-el-calendario',
  'texto-para-redes',
  'correr-la-fecha-de-un-encuentro',
  'duplicar-elegir-que-se-copia',
  'cupo-completo',
  'libro-presentado',
  'galeria-de-imagenes',
  'regenerar-no-borra-los-temas',
  'generador-dice-que-es-cada-campo',
  'tipo-libreria-a-la-calle',
  'vista-previa-abierta',
  'autoguardado-del-formulario',
  'borrador-sin-completar-todo',
  'la-barra-dice-que-falta',
  'etiquetas-nacen-aprobadas',
  'tipo-feria',
  'material-mas-formatos',
  'quien-cargo-cada-actividad',
  'arrobar-varios-handles',
  'desplegables-sin-slug-crudo',
  'administrar-las-opciones',
  'regenerar-encuentros-conserva-el-calendario',
  'reintentar-reporte-fallido',
  'menu-y-ayuda-con-teclado',
  'aviso-al-salir-sin-guardar',
  'destacar-llega-al-sitio',
  'sin-encuentros-duplicados',
  'cancelar-no-renumera',
  'calendario-en-curso',
  'vista-calendario',
  'orden-y-filtros-del-listado',
  'version-en-el-pie',
  'medicion-del-uso',
  'reportar-desde-el-panel',
  'historial-de-cambios',
  'etiquetas-a-revisar',
  'ayuda-y-novedades',
  'aviso-version-nueva',
  'coordenadas-sede',
  'slug-copia-no-publica',
  'vista-previa-evento',
  'duplicar-actividad',
  'arancel-obliga-elegir',
  'link-reunion-casilla',
  'evento-completo',
  'mapa-direccion',
  'formulario-telefono',
  'desplegables-placeholder',
];

/** Dónde se recuerda, por navegador, hasta dónde leyó esta persona. */
export const CLAVE_VISTO = 'agenda-literaria:novedad-vista';

/**
 * Los ids posteriores a la marca. Sin marca, todos; con una marca que ya no está
 * en la lista, ninguno: los dos bordes de D-64, iguales a `novedadesNoLeidas`.
 */
export function idsSinLeer(ids: readonly string[], visto: string | null): string[] {
  if (!visto) return [...ids];
  const i = ids.indexOf(visto);
  return i === -1 ? [] : ids.slice(0, i);
}

/** La marca guardada, o `null` si el navegador no deja leerla (ventana privada). */
export function leerVisto(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_VISTO);
  } catch {
    return null;
  }
}
