import { useEffect, useState } from 'react';
import { listarActividades } from '@/lib/actividades';
import { contactoDeOrganizador, type ContactoDeOrganizador } from '@/lib/contactoDeOrganizador';
import type { RolDelPanel } from '@/lib/rolDelPanel';
import type { ActividadConId } from '@/types/actividad';

/**
 * **El Instagram y la web que sus otras actividades dicen** — roadmap 2.6.
 *
 * Lee las actividades **una sola vez por sesión del panel y solo cuando hace falta**
 * (cuando se eligió un organizador que ya existe): la primera vez que se pide,
 * no al abrir el formulario. Con la **misma** `listarActividades` del listado, así
 * que respeta lo que cada rol puede leer: una publicadora no ve el contacto de un
 * borrador ajeno (B-920), porque esa actividad no le llega.
 *
 * La memoria es por cuenta (rol + uid + ciudad): si se cambia de sesión, se lee de
 * nuevo. Un fallo no rompe nada: no hay sugerencia, y el campo sigue como estaba.
 */
const memoria = new Map<string, Promise<ActividadConId[]>>();

const actividadesDeLaSesion = (rol: RolDelPanel, uid: string, ciudad: string) => {
  const clave = `${rol}|${uid}|${ciudad}`;
  let p = memoria.get(clave);
  if (!p) {
    p = listarActividades(rol, uid, ciudad).catch(() => {
      memoria.delete(clave);
      return [];
    });
    memoria.set(clave, p);
  }
  return p;
};

export const useContactoDeOrganizador = (
  slug: string | null,
  rol: RolDelPanel,
  uid: string,
  ciudad: string,
): ContactoDeOrganizador | null => {
  const [contacto, setContacto] = useState<ContactoDeOrganizador | null>(null);
  useEffect(() => {
    let vivo = true;
    setContacto(null);
    if (!slug) return;
    void actividadesDeLaSesion(rol, uid, ciudad).then((as) => {
      if (vivo) setContacto(contactoDeOrganizador(slug, as));
    });
    return () => {
      vivo = false;
    };
  }, [slug, rol, uid, ciudad]);
  return contacto;
};
