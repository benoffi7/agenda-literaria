/**
 * La descripción de una actividad, **con las URLs clickeables y nada más** —
 * B-980, decisión 6 del §11.1 de `docs/12-sitio-publico.md` (D-723).
 *
 * ── Trozos, no HTML ───────────────────────────────────────────────────────
 * La spec pide «escapar primero, linkear después», y la forma más segura de
 * cumplirla es **no producir HTML en ningún momento**. Esto devuelve una lista de
 * trozos —texto o enlace— y la plantilla los pinta con `{t.texto}` y
 * `<a href={t.href}>`, que Astro escapa solo. No hay `set:html`, así que no hay
 * orden que pueda salir mal: un `<script>` en la descripción viaja como el texto
 * de un trozo y termina en la página como `&lt;script&gt;`. Es la primera vez que
 * el sitio arma un enlace con texto que escribió un desconocido (`/proponer`), y
 * la garantía tiene que ser el tipo, no la disciplina.
 *
 * ── Qué es una URL ────────────────────────────────────────────────────────
 * Solo lo que empieza con `http://` o `https://` explícito. `casabrandon.com.ar`
 * suelto queda como texto: un dominio adivinado adentro de una frase rompe el
 * texto de alguien («de 10 a 12.com no existe»), y el que quiere un link lo pega
 * entero. El `href` pasa igual por `urlSegura`, que es el único saneador de
 * `href` del proyecto.
 *
 * La puntuación del final de la frase no es parte del link: «escribinos a
 * https://x.com.» termina en `.com`, y «(ver https://x.com)» no se lleva el
 * paréntesis, salvo que la URL tenga el suyo abierto —
 * `https://es.wikipedia.org/wiki/Rayuela_(novela)` lo conserva.
 *
 * ── El link de la reunión no sale, ni pegado en la descripción ────────────
 * D-139 dice que la página de detalle no publica `online.url`, y la puerta de
 * atrás era la descripción: quien carga pega el Zoom ahí «para que lo tengan».
 * `sinLinksDeReunion` lo reemplaza por un aviso **antes** de enlazar, así que
 * tampoco llega al texto plano. Reconoce los hosts de plataformas de reunión
 * —con esquema o sin él, porque el `?pwd=` viaja igual— y además los links
 * exactos que la actividad tenga cargados en `online.url`.
 */
import { urlSegura } from '@/lib/enlaceSeguro';

export type TrozoDeDescripcion =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'enlace'; texto: string; href: string };

/**
 * El `rel` de un enlace de la descripción. Es contenido de terceros apuntando
 * afuera: sin `nofollow` el sitio reparte autoridad de SEO a cualquiera que pegue
 * un link. `noopener noreferrer` es lo que llevan los demás enlaces externos del
 * detalle.
 */
export const REL_DE_DESCRIPCION = 'nofollow noopener noreferrer';

/**
 * Los mismos hosts que `HOSTS_DE_REUNION` de `schema.ts`, que no se exporta. Un
 * test compara las dos listas leyendo el fuente, así que agregar una plataforma
 * allá sin agregarla acá lo pone en rojo.
 */
const HOSTS_DE_REUNION =
  /(meet\.google|zoom\.us|teams\.microsoft|teams\.live|meet\.jit\.si|whereby\.com|discord\.gg|gotomeet)/i;

/** El texto que ocupa el lugar del link de la reunión. */
export const AVISO_DE_REUNION = '[el link de la reunión lo manda quien organiza cuando te anotás]';

const PUNTUACION_FINAL = /[.,;:!?…»«"'”’“‘]$/;

const cuenta = (texto: string, caracter: string): number => texto.split(caracter).length - 1;

/**
 * Separa la puntuación que rodea a un token del token mismo. El cierre solo se
 * saca si no tiene su apertura adentro.
 */
const recortar = (token: string): { antes: string; nucleo: string; despues: string } => {
  const apertura = /^[(\[«"'“‘]+/.exec(token)?.[0] ?? '';
  let nucleo = token.slice(apertura.length);
  let despues = '';
  for (;;) {
    const ultimo = nucleo.slice(-1);
    const sobra =
      PUNTUACION_FINAL.test(ultimo) ||
      (ultimo === ')' && cuenta(nucleo, '(') < cuenta(nucleo, ')')) ||
      (ultimo === ']' && cuenta(nucleo, '[') < cuenta(nucleo, ']'));
    if (!sobra || !nucleo) break;
    despues = ultimo + despues;
    nucleo = nucleo.slice(0, -1);
  }
  return { antes: apertura, nucleo, despues };
};

/** Un link comparable: sin esquema, sin barra final y en minúsculas. */
const clave = (url: string): string =>
  url.trim().replace(/^https?:\/{2}/i, '').replace(/\/+$/, '').toLowerCase();

/**
 * La descripción sin ningún link de reunión: cada token que lo sea se cambia por
 * `AVISO_DE_REUNION`, conservando la puntuación que lo rodeaba.
 *
 * `conocidos` son los `online.url` de la actividad, para las plataformas que la
 * lista de hosts no reconoce.
 */
export const sinLinksDeReunion = (texto: string, conocidos: readonly string[] = []): string => {
  const exactos = new Set(conocidos.map(clave).filter(Boolean));
  return texto.replace(/\S+/g, (token) => {
    const { antes, nucleo, despues } = recortar(token);
    const esReunion = HOSTS_DE_REUNION.test(nucleo) || exactos.has(clave(nucleo));
    return esReunion ? `${antes}${AVISO_DE_REUNION}${despues}` : token;
  });
};

/** Dónde empieza una URL: `http(s)://` explícito, no pegado a una palabra. */
const URL_EXPLICITA = /(?<![\p{L}\p{N}_/])https?:\/{2}[^\s<>"]+/giu;

/**
 * La descripción en trozos, con las URLs enlazadas. Una URL que `urlSegura`
 * rechaza queda como texto. Los trozos de texto contiguos salen juntos.
 */
export const enlazarDescripcion = (
  texto: string,
  conocidos: readonly string[] = [],
): TrozoDeDescripcion[] => {
  const limpio = sinLinksDeReunion(texto, conocidos);
  const trozos: TrozoDeDescripcion[] = [];
  const empujarTexto = (t: string) => {
    if (!t) return;
    const ultimo = trozos[trozos.length - 1];
    if (ultimo?.tipo === 'texto') ultimo.texto += t;
    else trozos.push({ tipo: 'texto', texto: t });
  };

  let desde = 0;
  for (const m of limpio.matchAll(URL_EXPLICITA)) {
    const { nucleo, despues } = recortar(m[0]);
    const href = urlSegura(nucleo);
    empujarTexto(limpio.slice(desde, m.index));
    if (href) {
      trozos.push({ tipo: 'enlace', texto: nucleo, href });
      empujarTexto(despues);
    } else {
      empujarTexto(m[0]);
    }
    desde = m.index + m[0].length;
  }
  empujarTexto(limpio.slice(desde));
  return trozos;
};
