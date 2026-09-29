/**
 * **El organizador al guardar** — roadmap 1.5, B-2172 paso 2.
 *
 * «Organiza» es una caja de texto libre que autocompleta contra
 * `/opciones/organizador` (la condición del dueño: se escribe, no se elige de
 * una lista). Lo que se decide acá es qué se guarda con lo que quedó escrito:
 *
 *  - si normaliza a una opción que ya existe, se **reusa**: el documento lleva
 *    su slug y su etiqueta, así «casa brandon » y «Casa Brandon» son la misma
 *    página (§4.2);
 *  - si no, es un organizador **nuevo**: se guarda con el slug de lo tipeado y la
 *    etiqueta va al buffer de D-02, que la da de alta después de escribir la
 *    actividad —el admin por `upsertOpcion`, el publicador por la callable—.
 *
 * **Se resuelve al guardar y no al tipear**, y no es por comodidad: una
 * actividad que llega de una propuesta o de un duplicado trae el nombre escrito
 * sin que nadie haya tocado el campo, y también tiene que dar de alta su
 * organizador. Resolver sobre lo que se guarda cubre los tres caminos.
 *
 * Puro: recibe las opciones, no las lee.
 */
import type { LabelNuevo } from '@/lib/formulario/etiquetas';
import { resolverEtiqueta } from '@/lib/taxonomia';
import { slugify } from '@/lib/slugify';
import type { Organizador, ValorOpcion } from '@/types/actividad';

export interface OrganizadorResuelto {
  organizador: Organizador;
  /** Solo si el organizador no estaba en la lista: la etiqueta a dar de alta. */
  labelNuevo?: LabelNuevo;
}

/**
 * La opción que ya es este organizador, si la hay.
 *
 * **Por slug, y si no por el slug de la etiqueta.** Lo segundo no sobra:
 * renombrar una opción cambia su etiqueta y no su slug (§4.1), así que después
 * de renombrar «mandolina» a «Mandolina Libros», reusarla deja escrito
 * «Mandolina Libros», cuyo slug ya no es el de la opción. Sin esta segunda
 * mirada, el siguiente guardado de esa misma actividad crearía un organizador
 * «mandolina-libros» duplicado.
 */
export const opcionDeOrganizador = (
  nombre: string,
  valores: readonly ValorOpcion[],
): ValorOpcion | undefined => {
  const { coincidencia, slug } = resolverEtiqueta(nombre, [...valores]);
  return coincidencia ?? (slug ? valores.find((v) => slugify(v.label) === slug) : undefined);
};

/**
 * Lo que se guarda del organizador, y la etiqueta nueva si hace falta una.
 *
 * El `slug` que traiga el formulario **no se mira**: sale del documento tal como
 * se abrió, y si se cambió el nombre ya no es el de este organizador. Siempre se
 * recalcula desde lo escrito. Sin nombre, sin slug: hay actividades sin
 * organizador (8 al 2026-09-28) y un borrador puede no tenerlo todavía.
 *
 * **`listaCargada: false`** es guardar antes de que llegue la lista (o con la
 * lectura caída): un organizador que ya existe parecería nuevo. El slug sale
 * igual y el alta reusa por slug, así que no hay duplicado; lo que no se hace es
 * reescribir el nombre con la etiqueta presentable de lo tipeado, que pisaría la
 * mayúscula de la opción («Casa brandon» en vez de «Casa Brandon»). Lo señaló el
 * `auditor-trampas`.
 */
export const resolverOrganizador = (
  org: Organizador,
  valores: readonly ValorOpcion[],
  { listaCargada = true }: { listaCargada?: boolean } = {},
): OrganizadorResuelto => {
  const { slug: _viejo, ...resto } = org;
  const nombre = org.nombre.trim();
  if (!slugify(nombre)) return { organizador: { ...resto, nombre } };

  const existente = opcionDeOrganizador(nombre, valores);
  if (existente) {
    return { organizador: { ...resto, nombre: existente.label, slug: existente.slug } };
  }

  const { slug, labelNuevo } = resolverEtiqueta(nombre, [...valores]);
  const label = labelNuevo ?? nombre;
  return {
    organizador: { ...resto, nombre: listaCargada ? label : nombre, slug },
    labelNuevo: { campo: 'organizador', label },
  };
};
