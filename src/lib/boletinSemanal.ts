/**
 * El **borrador del correo semanal** — B-1230, **D-800** y **D-801**.
 *
 * ── Qué mitad del correo es esto ──────────────────────────────────────────
 * B-847 construyó la mitad del alta: el `<form>` de `/suscribirse` que anota a
 * alguien en la lista de Mailchimp. Lo que ese formulario **promete** es la otra
 * mitad, y hasta hoy no existía: «sale semanal, con encuentros de la agenda para
 * todos los gustos y modalidades». Esa promesa la tiene que cumplir alguien cada
 * semana, y la forma en que un correo semanal muere no es rompiéndose: es
 * costando cuarenta minutos de copiar títulos y horarios de otra pestaña hasta
 * que una semana no sale, y después otra.
 *
 * Esto arma el borrador: **el mismo texto que el sitio ya publica, agrupado por
 * día, listo para pegar**. No manda nada. La curaduría —qué se destaca, qué se
 * saca, qué se cuenta arriba— sigue siendo de quien escribe, que es la parte que
 * vale y la única que no se puede automatizar (el mismo reparto que `textoRedes.ts`:
 * se automatiza el bloque de datos, que es lo aburrido y lo que se equivoca).
 *
 * ── D-800 · Se copia y se pega. No hay API, ni key, ni Function ───────────
 * Es la continuación exacta de la decisión de B-847, que eligió el `<form>`
 * pelado por sobre la API de Mailchimp: este repo **no tiene una credencial de
 * Mailchimp y no la va a tener**. Llamar a la API de campañas para crear el
 * borrador del otro lado pediría una key en Secret Manager y una Function más, y
 * compraría con eso… que no haya que apretar «pegar». El precio de copiar es un
 * gesto por semana; el de la key es una superficie nueva, permanente, sobre el
 * único tercero que recibe un dato de una persona.
 *
 * ── D-801 · Se arma desde el `events.json`, no desde Firestore ────────────
 * La vista del panel podría leer `/actividades` —ya tiene la sesión y las
 * reglas—, y sería peor por dos motivos, en este orden:
 *
 *  1. **Un correo no se despublica.** Armándolo desde el documento, el borrador
 *     podría llevar una actividad en `borrador`, el link de la reunión o las
 *     notas de difusión: cada campo del §5.1 volvería a estar a un `a.campo` de
 *     distancia, en la salida más irreversible de todas. Desde el índice eso es
 *     **imposible y no cuidadoso**: `EntradaDeIndice` es lo que `toPublic`
 *     ya dejó pasar, o sea la frontera de D-140 con auditoría propia. Lo que no
 *     está ahí no se puede filtrar porque no está en la mano.
 *  2. **El correo no puede anunciar lo que el sitio no muestra.** Cada fila
 *     linkea a su página de detalle; si el borrador saliera de Firestore,
 *     anunciaría lo guardado hace un minuto y el link daría 404 hasta el próximo
 *     build (§8). Desde el índice publicado, lo que se anuncia y lo que se puede
 *     abrir son por construcción la misma lista.
 *
 * El costo aceptado es que el borrador está tan fresco como el último build —de
 * dos a siete minutos (§8)—, y la pantalla lo dice con la fecha de generación.
 *
 * ── Por qué es un módulo puro y no vive en el `.tsx` ──────────────────────
 * Por lo mismo que `ahoraPublico.ts`, del que esto es pariente cercano: acá hay
 * **aritmética de calendario en una zona con offset** (trampa 1) y hay reglas de
 * qué entra. Los componentes de React de este repo no tienen tests de render
 * (`docs/05-patrones.md`), así que nada de eso se podría verificar desde un
 * componente.
 *
 * ── Lo que NO se reimplementa acá ─────────────────────────────────────────
 * D-20, otra vez: el lugar sale de `lugarDeTarjeta`, el arancel de
 * `arancelDeTarjeta`, la etiqueta del tipo de `etiquetaDe`, la URL de
 * `urlDeDetalle` (`rutasPublicas.ts`) y **todas** las fechas de
 * `fechasPublicas.ts`. Un correo con la hora corrida tres horas es la trampa 1
 * en su versión más cara: llega a la casilla de todos los suscriptos y no se
 * corrige.
 */
import { arancelDeTarjeta, lugarDeTarjeta } from '@/lib/tarjetaPublica';
import {
  claveDeDia,
  diaDesplazado,
  fechaLargaDeDia,
  hora as horaDe,
} from '@/lib/fechasPublicas';
import { etiquetaDe, type MapaDeEtiquetas } from '@/lib/listadoPublico';
import { instanteDeIso } from '@/lib/sesiones';
import { RUTA_AGENDA, SITIO, urlAbsoluta, urlDeDetalle } from '@/lib/rutasPublicas';
import type { EntradaDeIndice, Indice } from '@/lib/eventsJson';

/**
 * Cuántos días abarca el correo: **siete corridos desde hoy**, no «de lunes a
 * domingo».
 *
 * El correo sale el día que se manda, y quien lo abre quiere saber qué hay desde
 * ese momento. Una semana calendario deja el correo del miércoles hablando de un
 * lunes que ya pasó y callando el martes siguiente — que es lo mismo que el
 * tríptico de la home resolvió con ventanas relativas al reloj (B-600).
 */
export const DIAS_DEL_BOLETIN = 7;

/**
 * Un encuentro como lo imprime el correo: **strings ya decididos**, nada que
 * derivar del otro lado.
 *
 * Es la forma de D-140 y acá además la impone el destino: el HTML del correo se
 * arma con concatenación de strings, así que cualquier campo que llegara sin
 * resolver terminaría impreso tal cual —un `mar-del-plata` o un `19:00:00Z`— en
 * algo que ya salió.
 */
export interface EncuentroDelBoletin {
  /** `slug#sesionId` — identifica la fila, y es la `key` de React en la vista previa. */
  clave: string;
  /** La URL **absoluta** de la página de detalle: en un correo no hay origen. */
  url: string;
  /** `19:00`. */
  hora: string;
  titulo: string;
  /** La etiqueta del tipo, resuelta contra `/opciones` (§4.4). */
  tipoEtiqueta: string;
  /** `Casa Brandon · Boedo`, o `Online por Zoom`. Sale de `lugarDeTarjeta`. */
  lugar: string;
  /** `Arancelado · $15.000`, o `` cuando el slug no está en la taxonomía. */
  arancel: string;
}

/** Un día del correo, con sus encuentros en orden de horario. */
export interface DiaDelBoletin {
  /** `2026-09-26`. */
  clave: string;
  /** `sábado 26 de septiembre`. */
  rotulo: string;
  encuentros: EncuentroDelBoletin[];
}

/** El borrador entero, ya resuelto. */
export interface Boletin {
  /**
   * El asunto sugerido. Dice **el número** porque es lo que hace que se abra:
   * «Esta semana: 9 encuentros literarios» promete algo verificable, y
   * «Novedades de la agenda» no promete nada.
   */
  asunto: string;
  /**
   * El texto de vista previa de la casilla (el *preheader*): los primeros
   * títulos, que es lo que se ve al lado del asunto antes de abrir.
   */
  preencabezado: string;
  dias: DiaDelBoletin[];
  /** Cuántos encuentros entraron, sumando los días. */
  total: number;
  /** `viernes 25 de septiembre` — el primer día de la ventana (hoy). */
  desde: string;
  /** `jueves 1 de octubre` — el último. */
  hasta: string;
  /** La URL absoluta de la agenda, para el pie. */
  urlDeLaAgenda: string;
}

/** Las claves de los siete días que abarca el correo, desde hoy. */
export const ventanaDelBoletin = (ahora: Date): string[] => {
  const hoy = claveDeDia(ahora);
  return Array.from({ length: DIAS_DEL_BOLETIN }, (_, i) => diaDesplazado(hoy, i));
};

/**
 * El borrador de la semana, o `null` si no hay ni un encuentro en los siete
 * días.
 *
 * **`null` y no un correo vacío**, y es exactamente lo que la página de
 * `/suscribirse` promete: «la semana que no haya nada que valga la pena, no
 * sale». Un borrador vacío invita a mandarlo igual; un `null` con su motivo en
 * pantalla dice qué corresponde hacer, que es nada.
 */
export const boletinSemanal = (
  indice: Indice,
  ahora: Date,
  etiquetas: MapaDeEtiquetas,
): Boletin | null => {
  const porSlug = new Map<string, EntradaDeIndice>(indice.actividades.map((a) => [a.slug, a]));
  const dias = ventanaDelBoletin(ahora);
  const enLaVentana = new Set(dias);

  const resueltos = indice.encuentros.flatMap((e) => {
    const d = instanteDeIso(e.inicio);
    /*
     * `d >= ahora` además del día, igual que en `panelesDeAhora`: el eje viene
     * recortado desde el build, pero entre el build y el momento en que se arma
     * el borrador pasan minutos u horas. Sin esto, un correo escrito a la noche
     * anunciaría el taller de las siete de esa misma tarde.
     */
    if (!d || d.getTime() < ahora.getTime()) return [];
    const clave = claveDeDia(d);
    if (!enLaVentana.has(clave)) return [];
    /*
     * Un encuentro cuyo slug no está en `actividades` no se puede anunciar: no
     * hay título, ni lugar, ni página a la que ir. Mismo criterio y mismo motivo
     * que en el tríptico —los dos ejes salen del mismo build, pero el índice lo
     * sirve un CDN y puede ser de uno anterior—, con una consecuencia más grave
     * acá: una fila sin título en un correo ya está en la casilla de todos.
     */
    const entrada = porSlug.get(e.slug);
    if (!entrada) return [];
    return [
      {
        clave,
        encuentro: {
          clave: `${e.slug}#${e.sesionId}`,
          url: urlDeDetalle(e.slug),
          hora: horaDe(d),
          titulo: entrada.titulo,
          tipoEtiqueta: etiquetaDe(etiquetas, 'tipo', entrada.tipo),
          lugar: lugarDeTarjeta(entrada, etiquetas),
          arancel: arancelDeTarjeta(entrada, etiquetas).texto,
        },
      },
    ];
  });

  if (resueltos.length === 0) return null;

  /*
   * **Sin tope por día**, a diferencia del tríptico de la home.
   *
   * Allá el tope existe porque el listado completo está unos centímetros más
   * abajo: cortar en dos filas empuja a scrollear, no esconde nada. En un correo
   * no hay nada más abajo, y «y 4 más» es una fila que le pide a quien ya abrió
   * el correo que abra además el navegador para saber qué se está perdiendo.
   */
  const agrupados: DiaDelBoletin[] = dias
    .map((clave) => ({
      clave,
      rotulo: fechaLargaDeDia(clave),
      encuentros: resueltos.filter((r) => r.clave === clave).map((r) => r.encuentro),
    }))
    .filter((d) => d.encuentros.length > 0);

  const total = agrupados.reduce((n, d) => n + d.encuentros.length, 0);
  const titulos = agrupados.flatMap((d) => d.encuentros.map((e) => e.titulo));

  return {
    asunto: `Esta semana: ${total} ${total === 1 ? 'encuentro literario' : 'encuentros literarios'}`,
    preencabezado: titulos.slice(0, 3).join(' · '),
    dias: agrupados,
    total,
    desde: fechaLargaDeDia(dias[0] ?? ''),
    hasta: fechaLargaDeDia(dias[dias.length - 1] ?? ''),
    urlDeLaAgenda: urlAbsoluta(RUTA_AGENDA),
  };
};

/** Los datos de una fila, ya unidos: `19:00 · Taller · Casa Brandon · Gratis`. */
const metadatosDe = (e: EncuentroDelBoletin): string =>
  [e.hora, e.tipoEtiqueta, e.lugar, e.arancel].filter(Boolean).join(' · ');

/**
 * El borrador **en texto plano**, para el cuerpo de texto de la campaña.
 *
 * Mailchimp manda las dos versiones y arma la de texto sola a partir del HTML si
 * no se le da otra; la que genera sale con los links repetidos y las etiquetas
 * pegoteadas. Esta es la que se pega en la pestaña «Plain-Text Email».
 */
export const textoDelBoletin = (b: Boletin): string =>
  [
    `${b.asunto}`,
    '',
    `Del ${b.desde} al ${b.hasta}.`,
    '',
    ...b.dias.flatMap((d) => [
      d.rotulo.toUpperCase(),
      ...d.encuentros.flatMap((e) => [`· ${e.titulo}`, `  ${metadatosDe(e)}`, `  ${e.url}`]),
      '',
    ]),
    `Todo lo que viene: ${b.urlDeLaAgenda}`,
  ].join('\n');

/**
 * Los cuatro caracteres que rompen un HTML, escapados.
 *
 * **No se comparte con el `escaparXml` de `sitemap.ts`, y no es un olvido:** el
 * XML necesita además `'` → `&apos;`, que en HTML no es universal, y el sitemap
 * escapa rutas armadas con `slugify` mientras acá se escapa **texto que una
 * persona tipeó en el panel** — un título con `<` o con `&` es normal, no una
 * anomalía de la consola. Son dos criterios distintos sobre dos clases de
 * entrada distintas; unificarlos sería elegir el más laxo para los dos.
 *
 * Que esto importe es la lección de la trampa 11 con otra cara: lo que se le
 * entrega a un parser ajeno se escapa siempre, porque el modo de falla no es un
 * error sino una salida que se ve rota del otro lado — y un correo no se
 * corrige después de mandado.
 */
const escaparHtml = (texto: string): string =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * El borrador **en HTML**, para pegar en un bloque de código de la campaña.
 *
 * ── Por qué los estilos van inline y el marcado es de 1999 ────────────────
 * Un cliente de correo no es un navegador: Gmail borra el `<style>` del `<head>`
 * en la vista de conversación, Outlook renderiza con el motor de Word y ninguno
 * garantiza flexbox ni variables CSS. El marcado con `style=` en cada elemento y
 * medidas en píxeles es lo que se ve igual en los tres, y es feo a propósito.
 *
 * **Fragmento y no documento**: esto se pega adentro de la plantilla de
 * Mailchimp, que ya trae el `<html>`, el ancho, el pie legal y el link de baja
 * —que es obligatorio y lo pone el proveedor, no nosotros—.
 *
 * Todo lo que viene de una actividad pasa por `escaparHtml`. Las URLs no: salen
 * de `urlDeDetalle`, que las arma con el slug, y aun así van escapadas por lo
 * mismo que el sitemap escapa rutas — cuesta nada y el modo de falla es caro.
 */
export const htmlDelBoletin = (b: Boletin): string => {
  const fila = (e: EncuentroDelBoletin): string =>
    [
      '      <tr>',
      '        <td style="padding:0 0 18px 0;">',
      `          <a href="${escaparHtml(e.url)}" style="color:#1a1a1a;font-size:17px;font-weight:600;text-decoration:none;">${escaparHtml(e.titulo)}</a>`,
      `          <div style="color:#666666;font-size:14px;padding-top:4px;">${escaparHtml(metadatosDe(e))}</div>`,
      '        </td>',
      '      </tr>',
    ].join('\n');

  const dia = (d: DiaDelBoletin): string =>
    [
      '      <tr>',
      `        <td style="border-bottom:1px solid #dddddd;color:#1a1a1a;font-size:13px;font-weight:700;letter-spacing:0.08em;padding:14px 0 10px 0;text-transform:uppercase;">${escaparHtml(d.rotulo)}</td>`,
      '      </tr>',
      d.encuentros.map(fila).join('\n'),
    ].join('\n');

  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Georgia,\'Times New Roman\',serif;max-width:600px;">',
    '  <tr>',
    '    <td>',
    `      <p style="color:#666666;font-family:Helvetica,Arial,sans-serif;font-size:14px;margin:0 0 20px 0;">Del ${escaparHtml(b.desde)} al ${escaparHtml(b.hasta)}.</p>`,
    '      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">',
    b.dias.map(dia).join('\n'),
    '      </table>',
    `      <p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;margin:24px 0 0 0;"><a href="${escaparHtml(b.urlDeLaAgenda)}" style="color:#1a1a1a;">Todo lo que viene en ${escaparHtml(SITIO.replace(/^https?:\/\//, ''))}</a></p>`,
    '    </td>',
    '  </tr>',
    '</table>',
  ].join('\n');
};
