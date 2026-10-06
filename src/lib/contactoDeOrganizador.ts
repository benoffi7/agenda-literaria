/**
 * **El Instagram y la web de un organizador**, sacados de sus actividades — la
 * regla compartida por la página `/organiza/{slug}` (que la muestra) y el
 * formulario del panel (roadmap 2.6, que la ofrece al cargar).
 *
 * En un módulo chico a propósito: el panel no tiene por qué arrastrar el
 * view-model de la página pública para esto. Depende solo de los saneadores de
 * `enlaceSeguro.ts` y de `slugDeOrganizador`.
 */
import { arrobaInstagram, enlaceInstagram, handleInstagram, urlSegura } from '@/lib/enlaceSeguro';
import { slugDeOrganizador } from '@/lib/organizador.mjs';

/** Un dato de contacto con su link ya saneado. */
export interface EnlaceDeContacto {
  texto: string;
  href: string;
}

/** Cómo se lo encuentra: su Instagram y su web. */
export interface ContactoDeOrganizador {
  instagram: EnlaceDeContacto | null;
  web: EnlaceDeContacto | null;
}

/** La forma mínima de una actividad que hace falta: un documento o una `ActividadPublica`. */
export interface ActividadConOrganizador {
  organizador?: { nombre?: string; slug?: string; instagram?: string; web?: string } | null;
}

const masRepetido = (valores: string[]): string | null => {
  const cuenta = new Map<string, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor: string | null = null;
  let max = 0;
  for (const [v, n] of cuenta) if (n > max) [mejor, max] = [v, n];
  return mejor;
};

/**
 * El Instagram y la web del organizador `slug`, de sus actividades.
 *
 * El slug de cada una se lee con `slugDeOrganizador` —el guardado, o el del nombre
 * en los documentos anteriores (D-26)—, así que sirve igual para una
 * `ActividadPublica` que para un documento crudo del panel.
 *
 * Si no coinciden, **el más repetido**, comparando el handle normalizado y no lo
 * tipeado. Y **solo lo que se puede enlazar con seguridad** (`enlaceInstagram`,
 * `urlSegura`): es un resumen, y un «@algo» sin link no le sirve a nadie.
 */
export const contactoDeOrganizador = (
  slug: string,
  actividades: readonly ActividadConOrganizador[],
): ContactoDeOrganizador => {
  const suyas = actividades.filter((a) => slug && slugDeOrganizador(a.organizador) === slug);
  const handle = masRepetido(
    suyas.map((a) => handleInstagram(a.organizador?.instagram)).filter((h): h is string => !!h),
  );
  const web = masRepetido(
    suyas
      .map((a) => (urlSegura(a.organizador?.web) ? (a.organizador?.web ?? '').trim() : ''))
      .filter(Boolean),
  );
  const instagramUrl = handle ? enlaceInstagram(handle) : null;
  const webUrl = web ? urlSegura(web) : null;
  return {
    instagram: handle && instagramUrl ? { texto: arrobaInstagram(handle), href: instagramUrl } : null,
    web: web && webUrl ? { texto: web, href: webUrl } : null,
  };
};
