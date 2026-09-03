/**
 * Lo que dice una **fila** del listado — B-247, rehecho en B-260.
 *
 * ── Por qué es un módulo y no está dentro del componente ──────────────────
 * `docs/05-patrones.md` dice que los componentes de React de este repo no tienen
 * tests de render: no hay testing-library y no se va a instalar. Con la lógica
 * adentro del `.tsx`, «qué dice la tarjeta cuando el ciclo ya empezó» no se puede
 * verificar de ninguna manera, y son justo las frases del dominio que el sitio no
 * puede decir mal: un ciclo no es una fecha, «a la gorra» no es gratis ni pago, y
 * una inscripción cerrada no se calcula en el build (B-111).
 *
 * Así que **toda frase que haya que decidir** vive acá, pura, con el reloj entrando
 * como parámetro a través de `EstadoDeEntrada`. Es el mismo corte que ya hay entre
 * `listadoPublico.ts` y `Buscador.tsx`.
 *
 * Lo que el componente **sí** sigue leyendo del índice son los cuatro campos sobre
 * los que no hay nada que decidir —`slug`, `tipo`, `titulo`, `destacado`—: un `href`, un color, un texto y dos banderas. No es una promesa de
 * docblock, es una lista cerrada que verifica
 * `tests/listado-del-sitio.test.ts`; sin ella nada impediría imprimir
 * `searchText` —la descripción entera, normalizada— en una tarjeta. Es la forma de
 * D-140 aplicada a la otra mitad de la salida 1, donde el tipo no puede darla.
 *
 * ── Lo que B-260 sacó: la portada generada ────────────────────────────────
 * D-141 decidió que una tarjeta sin foto llevara una **portada generada** —el
 * título sobre un color derivado del tipo—, y `escalaDePortada` y
 * `renglonesDePortada` vivían acá para dibujarla. El sistema visual de B-260 la
 * retira entera: el listado pasa a ser **filas tipográficas sin ninguna imagen**,
 * y la paleta pasa a ser de tres tintas, así que un color por tipo ya no existe.
 * El razonamiento completo, y qué se conserva de aquella decisión, está en D-146.
 *
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { diaYMes, hora, partesDeFecha, partesDeMes } from '@/lib/fechasPublicas';
import { ETIQUETA_MODALIDAD } from '@/lib/filtrosActividades';
import { esSinCosto } from '@/lib/arancel';
import { etiquetaDe, type EstadoDeEntrada, type MapaDeEtiquetas } from '@/lib/listadoPublico';
import {
  SLUG_PLATAFORMA_A_CONFIRMAR,
  filaPideOnline,
  filaPideSede,
  modalidadResultante,
} from '@/lib/modalidades';
import type { Modalidad } from '@/types/actividad';

// ─────────────────────────────────────────────────────────────────
// Arancel
// ─────────────────────────────────────────────────────────────────

/**
 * Los aranceles que no se pagan — **definidos en `lib/arancel.ts`** desde B-271,
 * y re-exportados acá para que nadie tenga que cambiar de import (B-72).
 *
 * Se mudaron porque los usan tres módulos y no uno: el acento de esta fila, el
 * orden de los chips del sitio (D-151) y el del desplegable del panel (D-152).
 * El motivo de que sea un módulo propio y no cualquiera de los tres está escrito
 * allá.
 */
export { SIN_COSTO, esSinCosto } from '@/lib/arancel';

export interface ArancelDeTarjeta {
  /** La etiqueta cargada en `/opciones/arancel`. Vacío si el slug no está puesto. */
  texto: string;
  sinCosto: boolean;
}

export const arancelDeTarjeta = (
  entrada: EntradaDeIndice,
  etiquetas: MapaDeEtiquetas,
): ArancelDeTarjeta => ({
  texto: entrada.arancel.tipo ? etiquetaDe(etiquetas, 'arancel', entrada.arancel.tipo) : '',
  sinCosto: esSinCosto(entrada.arancel.tipo),
});

// ─────────────────────────────────────────────────────────────────
// Cuándo — el bloque de fecha
// ─────────────────────────────────────────────────────────────────

/**
 * El **bloque de fecha**: el rectángulo de tinta plena con el texto calado que es
 * el gesto central del sistema visual (B-260, D-146).
 *
 * Devuelve las piezas por separado y no una cadena, porque el bloque las pinta a
 * cuerpos distintos: el número del día grande y el día de la semana y el mes en
 * versalitas. Armar una cadena y volver a partirla en el componente sería la
 * derivación de ida y vuelta que este módulo existe para evitar.
 *
 * **Por qué `paso` es un discriminante** y no un objeto con campos en `null`:
 * cuando la actividad ya pasó no hay día que poner, y un `dia: null` obliga a cada
 * consumidor a acordarse de chequearlo — que es cómo termina saliendo un bloque de
 * fecha vacío en producción. Con el discriminante, el compilador no deja leer
 * `dia` sin haber preguntado antes.
 *
 * La hora **no** se pinta adentro del bloque: el bloque es la fecha, y meter
 * `19:00` ahí dentro obliga a un tercer cuerpo tipográfico en un rectángulo de
 * 56px, con lo que deja de leerse de un golpe de vista — que es lo único que tiene
 * que hacer. Viaja igual, para la línea de metadatos de al lado.
 */
export type BloqueDeFecha =
  | { paso: true; texto: string }
  | { paso: false; dia: string; diaSemana: string; mes: string; hora: string; iso: string };

export const bloqueDeFecha = (estado: EstadoDeEntrada): BloqueDeFecha => {
  if (!estado.proxima) return { paso: true, texto: 'Pasó' };
  const { dia, diaSemana, mes } = partesDeFecha(estado.proxima);
  return {
    paso: false,
    dia,
    diaSemana,
    mes,
    hora: hora(estado.proxima),
    iso: estado.proxima.toISOString(),
  };
};

// ─────────────────────────────────────────────────────────────────
// Dónde y cómo se cursa
// ─────────────────────────────────────────────────────────────────

export interface FormasDeCursar {
  presencial: boolean;
  virtual: boolean;
  /** `Presencial` · `Virtual` · `Presencial y virtual`. Vacío si no hay dato. */
  texto: string;
}

/**
 * Qué formas de cursar ofrece, **leídas de `modalidades[]` y no del escalar**
 * (B-224).
 *
 * El escalar `modalidad` es la resultante que calculó el build, y una actividad
 * con una fila presencial y otra virtual tiene las dos cosas ciertas de ella. La
 * tarjeta tiene que poder decir «y también online», y con la resultante sola no
 * hay con qué: `'hibrido'` no distingue «un encuentro híbrido» de «dos filas, una
 * de cada tipo». Se cae al escalar solo si el índice viene sin el array, que es la
 * forma que el modelo tenía antes de B-224.
 *
 * ── Las tres reglas se importan, no se reescriben (clase de B-88) ─────────
 * «Qué fila pide sede», «qué fila pide online» y «cuál es la resultante» son de
 * `lib/modalidades.ts`, que es **el productor** del array y del escalar que el
 * índice lleva. Escritas de nuevo acá quedaban idénticas hoy y divergentes el día
 * que aparezca un cuarto valor de modalidad: el productor lo entiende, este
 * consumidor lo clasifica como *ni presencial ni virtual*, el chip desaparece y el
 * lugar cae a «Lugar a confirmar» aunque haya sede cargada — en silencio, que es
 * la firma de la clase. Lo señaló el `auditor-privacidad`.
 *
 * El `as Modalidad` es la costura entre los dos: el índice es JSON, así que sus
 * modalidades son `string`. El test recorre `MODALIDADES` —el dominio del
 * productor— y exige que ninguna quede sin clasificar.
 */
export const formasDeCursar = (entrada: EntradaDeIndice): FormasDeCursar => {
  const valores = entrada.modalidades.length > 0 ? entrada.modalidades : [entrada.modalidad];
  const filas = valores.map((m) => ({ modalidad: m as Modalidad }));
  const presencial = filas.some((f) => filaPideSede(f.modalidad));
  const virtual = filas.some((f) => filaPideOnline(f.modalidad));
  // Un índice sin ninguna modalidad reconocible no se completa con un default:
  // `modalidadResultante([])` devuelve `'presencial'`, que acá sería afirmar algo
  // sobre el mundo que nadie cargó.
  if (!presencial && !virtual) return { presencial: false, virtual: false, texto: '' };
  // El nombre se importa y no se escribe: «Presencial y virtual» tiene que
  // decirse igual en el sitio y en el panel.
  return { presencial, virtual, texto: ETIQUETA_MODALIDAD[modalidadResultante(filas)] };
};

/**
 * La línea de lugar.
 *
 * `Casa Brandon · Boedo, CABA`, o `Online por Zoom`, o las dos cosas. **Nunca la
 * dirección**: el índice no la lleva (§3.1 del diseño) y la tarjeta no la
 * necesita.
 *
 * `Lugar a confirmar` es el texto del §7.7 para una presencial sin sede: no se
 * inventa una sede ni se esconde la actividad.
 */
export const lugarDeTarjeta = (entrada: EntradaDeIndice, etiquetas: MapaDeEtiquetas): string => {
  const { presencial, virtual } = formasDeCursar(entrada);
  /*
   * B-190 — «Online por A confirmar» se lee como si «A confirmar» fuera el
   * nombre de una plataforma (lo señaló el `auditor-privacidad`: esta salida
   * había quedado afuera de la lista de consumidores que B-190 corrigió, y
   * `lugarDeTarjeta` alimenta el listado, la página de mes, /pasadas y los
   * hubs — cuatro salidas indexadas). Se mira el slug, no el label resuelto,
   * mismo criterio que `dondeCorto` en `detallePublico.ts`.
   */
  const enLinea =
    entrada.online?.plataforma === SLUG_PLATAFORMA_A_CONFIRMAR
      ? 'Online, plataforma a confirmar'
      : entrada.online?.plataforma
        ? `Online por ${etiquetaDe(etiquetas, 'plataforma', entrada.online.plataforma)}`
        : 'Online';

  if (presencial && entrada.sede) {
    const zona = [
      entrada.sede.barrio ? etiquetaDe(etiquetas, 'barrio', entrada.sede.barrio) : '',
      entrada.sede.ciudad,
    ]
      .filter(Boolean)
      .join(', ');
    const base = [entrada.sede.nombre, zona].filter(Boolean).join(' · ');
    return virtual ? `${base} · y online` : base;
  }
  if (virtual) return enLinea;
  return 'Lugar a confirmar';
};

// ─────────────────────────────────────────────────────────────────
// El ciclo
// ─────────────────────────────────────────────────────────────────

/**
 * La línea del ciclo: **no es una fecha, es una cantidad y un arranque.**
 *
 * «Ciclo de 4 encuentros · empieza el 9 de septiembre» es lo que alguien necesita
 * para decidir, y es lo que el §2.2 del `CLAUDE.md` pide que la lista diga con una
 * sola tarjeta.
 *
 * **El verbo cambia con el reloj de quien mira** (§7.2 del diseño): decir «empieza
 * el 3 de septiembre» en octubre es información falsa, y es el modo de falla que
 * un texto armado en el build tiene garantizado.
 */
export const cicloDeTarjeta = (
  entrada: EntradaDeIndice,
  estado: EstadoDeEntrada,
): string | null => {
  if (estado.encuentros === 0) return null;
  if (estado.encuentros === 1 && !entrada.esCiclo) return null;

  const cabeza = `${entrada.esCiclo ? 'Ciclo de ' : ''}${estado.encuentros} ${
    estado.encuentros === 1 ? 'encuentro' : 'encuentros'
  }`;
  if (estado.paso) return estado.hasta ? `${cabeza} · terminó el ${diaYMes(estado.hasta)}` : cabeza;
  if (estado.enCurso) return estado.desde ? `${cabeza} · empezó el ${diaYMes(estado.desde)}` : cabeza;
  return estado.desde ? `${cabeza} · empieza el ${diaYMes(estado.desde)}` : cabeza;
};

/**
 * La línea del ciclo **en una página de mes** — B-113, §7.5 del diseño.
 *
 * «Un ciclo que cruza dos meses aparece en los dos, y en cada uno muestra *las
 * fechas de ese mes*». Eso es lo que dice esta frase, y es la única diferencia
 * entre una fila de la home y la misma fila en `/agenda/2026-09`: no es otra
 * tarjeta, es el subtítulo recalculado.
 *
 * ── Por qué viajan los dos estados ────────────────────────────────────────
 * `estadoDelMes` sale del **recorte** (`recorteDelMes`), así que sus fechas y su
 * conteo son los del mes. `estadoTotal` sale de la entrada entera, y hace falta
 * por una sola cosa que no se puede perder: **cuántos encuentros tiene el ciclo**.
 * Decir «Ciclo de 4 encuentros» en la página de septiembre, cuando son 8, no es
 * un recorte: es información falsa, y es justo el error que el recorte invita a
 * cometer.
 *
 * Así que la cabeza dice el total —el mismo texto que en la home— y la cola dice
 * cuántos y cuándo caen en este mes:
 *
 * | Caso | Qué dice |
 * |---|---|
 * | ciclo de 8, 4 en septiembre | `Ciclo de 8 encuentros · 4 en septiembre, del 3 al 24` |
 * | ciclo de 4, los 4 en septiembre | `Ciclo de 4 encuentros · del 3 al 24` |
 * | 3 encuentros sueltos, 1 en septiembre | `3 encuentros · 1 en septiembre, el 12` |
 * | uno solo, y no es ciclo | nada — el bloque de fecha ya lo dijo |
 *
 * Cuando el mes tiene todas las fechas no se repite el número: «Ciclo de 4
 * encuentros · 4 en septiembre» le hace dudar a quien lee si son cuatro u ocho.
 *
 * El día del mes sale de `partesDeFecha`, con el `timeZone` del proyecto: un
 * encuentro del 1 a las 00:30 de Buenos Aires es «31» para un navegador en UTC
 * (trampa 1), y acá el día es el dato entero de la frase.
 */
export const cicloDelMes = (
  entrada: EntradaDeIndice,
  estadoDelMes: EstadoDeEntrada,
  estadoTotal: EstadoDeEntrada,
  clave: string,
): string | null => {
  if (estadoDelMes.encuentros === 0) return null;
  // La misma regla que en la home: una actividad de un solo encuentro que no se
  // declara ciclo no gana nada repitiendo la fecha que ya está en el bloque.
  if (estadoTotal.encuentros === 1 && !entrada.esCiclo) return null;

  const total = estadoTotal.encuentros;
  const cabeza = `${entrada.esCiclo ? 'Ciclo de ' : ''}${total} ${
    total === 1 ? 'encuentro' : 'encuentros'
  }`;

  const dia = (d: Date): string => partesDeFecha(d).dia;
  const { desde, hasta } = estadoDelMes;
  const tramo =
    desde && hasta ? (dia(desde) === dia(hasta) ? `el ${dia(desde)}` : `del ${dia(desde)} al ${dia(hasta)}`) : '';

  if (estadoDelMes.encuentros === total) return tramo ? `${cabeza} · ${tramo}` : cabeza;

  const mes = partesDeMes(clave).mes.toLowerCase();
  const cuantos = `${estadoDelMes.encuentros} en ${mes}`;
  return tramo ? `${cabeza} · ${cuantos}, ${tramo}` : `${cabeza} · ${cuantos}`;
};

/**
 * «Ya empezó — se puede entrar», o nada.
 *
 * Sale **solo si además la inscripción está abierta**: no hay un campo «acepta
 * incorporaciones tardías», y un cierre posterior a la primera sesión es la forma
 * en que el dueño lo expresa hoy. Decirlo con la inscripción cerrada sería
 * inventarlo (§7.2).
 */
export const enCursoDeTarjeta = (estado: EstadoDeEntrada): string | null =>
  estado.enCurso && !estado.inscripcionCerrada ? 'Ya empezó — se puede entrar' : null;

// ─────────────────────────────────────────────────────────────────
// La inscripción
// ─────────────────────────────────────────────────────────────────

/** `alerta` frena, `apagado` informa. Lo traduce a color el componente. */
export type TonoDeAviso = 'alerta' | 'apagado';

export interface AvisoDeTarjeta {
  texto: string;
  tono: TonoDeAviso;
}

/**
 * La línea de inscripción, **en orden de qué frena antes**.
 *
 * El orden es la decisión: `cerraron` va antes que `cupo completo` porque cuando
 * las dos son ciertas la segunda invita a una acción —«consultá por lista de
 * espera»— que ya no tiene a dónde ir. Y `requiere: false` va primero de las
 * frases de inscripción: ninguna de las otras tiene sentido si no hay
 * inscripción.
 *
 * Nada de «quedan 3 lugares» (§4.2): no sabemos cuántas inscripciones hay. `cupo`
 * es el cupo total y se dice así.
 *
 * ── Lo que pasó no tiene línea de inscripción — B-290 ─────────────────────
 * **Primero de todo se mira `paso`**, y devuelve `null`: una actividad que ya
 * terminó no se puede seguir ofreciendo. Sin esta rama, un taller de mayo **sin
 * fecha de cierre cargada** cae en el default y la fila dice «Inscripción
 * abierta», que es exactamente el modo de falla que el §7.1 nombra —«`abierta`
 * solo mira `cierra`: una actividad sin fecha de cierre queda `abierta: true`
 * para siempre y mostraría *Anotate* en un taller de hace un año»— y que la
 * página de detalle ya evitaba decidiendo el CTA **por fecha**.
 *
 * No era teórico y no lo trajo `/pasadas`: la fila de una pasada ya se renderiza
 * en la página de un mes vencido (B-113) y con el filtro «Cuándo» puesto en un
 * mes que pasó. `/pasadas` es lo que lo puso a la vista, porque es una página
 * entera de filas pasadas.
 *
 * Devuelve `null` y no una frase propia porque no hay nada que agregar: el bloque
 * de fecha ya dice «Pasó» y la línea del ciclo dice «terminó el 20 de agosto».
 * Una frase más sería repetir en un tercer lugar.
 */
export const avisoDeTarjeta = (
  entrada: EntradaDeIndice,
  estado: EstadoDeEntrada,
): AvisoDeTarjeta | null => {
  if (estado.paso) return null;
  if (!entrada.inscripcion.requiere) return { texto: 'Entrada libre, sin inscripción', tono: 'apagado' };
  if (estado.inscripcionCerrada) return { texto: 'Las inscripciones cerraron', tono: 'alerta' };
  if (entrada.inscripcion.completo) {
    return { texto: 'Cupo completo · consultá por lista de espera', tono: 'alerta' };
  }
  if (estado.cierra) return { texto: `Anotate antes del ${diaYMes(estado.cierra)}`, tono: 'apagado' };
  if (entrada.inscripcion.cupo) {
    return { texto: `Inscripción abierta · cupo ${entrada.inscripcion.cupo}`, tono: 'apagado' };
  }
  return { texto: 'Inscripción abierta', tono: 'apagado' };
};
