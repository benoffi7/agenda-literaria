import { useState } from 'react';
import {
  claseBotonFila,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
} from '@/components/admin/campos/Campo';
import { FilasEditor } from '@/components/admin/campos/FilasEditor';
import { medirFuncion } from '@/lib/analytics';
import {
  aDatetimeLocal,
  deDatetimeLocal,
  duplicarSesion,
  duracionMinutos,
  generarSesiones,
  ordenarPorInicio,
  sesionVacia,
} from '@/lib/sesiones';
import type { SesionForm } from '@/types/actividad';

interface Props {
  sesiones: SesionForm[];
  onChange: (s: SesionForm[]) => void;
  /** Los clubes de lectura muestran el campo "lectura" con más prominencia. */
  mostrarLectura?: boolean;
  error?: string;
}

const MS_POR_DIA = 86_400_000;

/**
 * ── B-186 · correr la fecha sin pelear con el almanaque ───────────────────
 *
 * El reporte: «el almanaque cuando "corrés" la fecha se suele cerrar si no pongo
 * rápido la fecha, pero bueno, lo pongo manual». El almanaque es el **selector
 * nativo** de `<input type="datetime-local">`: no hay nada nuestro corriendo
 * mientras está abierto que lo pueda cerrar (el detalle del descarte, en
 * `docs/BACKLOG.md`). O sea que el arreglo no es un date-picker propio —pesa en
 * el bundle (B-09) y hereda el mismo problema en otra forma— sino que **no haga
 * falta abrirlo**:
 *
 *  1. los cuatro saltos de acá, que son la operación que el reporte nombra;
 *  2. `conInicioNuevo`, que mueve el fin con el inicio: una fecha en vez de dos;
 *  3. `resumirSesion`, que dice en qué día de la semana cae — lo único que el
 *     almanaque da y el tipeo no.
 *
 * Los cuatro saltos y no una caja de "cuántos días": son los que de verdad pasan
 * en un ciclo. ±7 conserva el día de la semana, que es el motivo por el que un
 * taller de los jueves se corre en semanas enteras y no en días.
 */
export const SALTOS_DE_FECHA = [
  { dias: -7, etiqueta: '−1 sem' },
  { dias: -1, etiqueta: '−1 día' },
  { dias: 1, etiqueta: '+1 día' },
  { dias: 7, etiqueta: '+1 sem' },
] as const;

/**
 * Cómo se lee el salto en voz alta. El `−` de las etiquetas es un signo menos
 * tipográfico (U+2212) y un lector de pantalla no lo dice: el nombre del botón
 * se arma acá, con palabras.
 */
export const nombreDelSalto = (dias: number): string => {
  const magnitud = Math.abs(dias);
  const cuanto = magnitud === 7 ? 'una semana' : `${magnitud} día${magnitud === 1 ? '' : 's'}`;
  return dias < 0 ? `${cuanto} antes` : `${cuanto} después`;
};

/**
 * La sesión corrida `dias` días: **inicio y fin se mueven juntos**.
 *
 * Conserva `id`, `cancelada` y `calendarEventId`. No es un detalle: correr una
 * fecha no puede perder el evento que ya existe en el calendario de la gente —el
 * diff del §7.2 cruza por `id` (trampa 2) y sin `calendarEventId` crearía un
 * segundo evento para el mismo encuentro en vez de moverlo.
 *
 * Si el inicio no se puede leer, la sesión vuelve tal cual: no hay desde dónde
 * correr.
 */
export const correrSesion = (s: SesionForm, dias: number): SesionForm => {
  const inicio = deDatetimeLocal(s.inicio);
  if (!inicio) return s;
  const delta = dias * MS_POR_DIA;
  const fin = deDatetimeLocal(s.fin);
  return {
    ...s,
    inicio: aDatetimeLocal(new Date(inicio.getTime() + delta)),
    // Un fin ilegible se deja como está: inventarle una fecha sería peor que
    // dejar la fila a medio completar, que es lo que el schema ya sabe rechazar.
    fin: fin ? aDatetimeLocal(new Date(fin.getTime() + delta)) : s.fin,
  };
};

/**
 * La sesión con otro inicio, **conservando la duración**.
 *
 * Antes, cambiar el inicio dejaba el fin donde estaba: correr un encuentro pedía
 * resolver **dos** fechas, y en el medio el formulario quedaba con `fin <=
 * inicio`, que es justo lo que el schema rechaza al guardar. Con la duración
 * conservada, cambiar de día es un solo campo.
 *
 * Tres casos en que el fin no se toca, y el mismo motivo: no se puede calcular
 * nada. Un `datetime-local` a medio completar reporta `''`, así que mientras se
 * tipea el inicio nuevo es ilegible; y si el fin ya venía ilegible o no era
 * posterior al inicio, no hay duración que conservar.
 */
export const conInicioNuevo = (s: SesionForm, inicio: string): SesionForm => {
  const antes = deDatetimeLocal(s.inicio);
  const fin = deDatetimeLocal(s.fin);
  const nuevo = deDatetimeLocal(inicio);
  if (!antes || !fin || !nuevo || fin.getTime() <= antes.getTime()) return { ...s, inicio };
  return {
    ...s,
    inicio,
    fin: aDatetimeLocal(new Date(nuevo.getTime() + (fin.getTime() - antes.getTime()))),
  };
};

/** «2 h», «1 h 30 min», «45 min». */
const duracionLegible = (minutos: number): string => {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
};

export interface ResumenSesion {
  /** «jueves, 10 de septiembre», o `null` si el inicio no se puede leer. */
  dia: string | null;
  /** «2 h», o `null` si el fin no sirve para medir. */
  duracion: string | null;
  /** El fin no es posterior al inicio: el schema lo va a rechazar al guardar. */
  finAntesDelInicio: boolean;
}

/**
 * Qué día cae y cuánto dura, en palabras.
 *
 * Es la mitad de B-186 que hace que tipear no sea un castigo: lo único que el
 * almanaque da y el tipeo no es **ver en qué día de la semana cae**. Un taller de
 * los jueves se verifica leyendo «jueves», sin abrir nada.
 *
 * Y de paso nombra el estado que el arreglo del fin dejó de producir pero que
 * todavía se puede tipear a mano: un fin anterior al inicio, que hasta ahora
 * aparecía recién al guardar.
 */
export const resumirSesion = (s: SesionForm): ResumenSesion => {
  const inicio = deDatetimeLocal(s.inicio);
  if (!inicio) return { dia: null, duracion: null, finAntesDelInicio: false };
  const fin = deDatetimeLocal(s.fin);
  const minutos = fin ? Math.round((fin.getTime() - inicio.getTime()) / 60_000) : 0;
  return {
    // Sin `timeZone`: el `datetime-local` ya está en la hora del navegador, y
    // mostrarlo en otra zona sería mentir sobre lo que se cargó (trampa 1).
    dia: new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(inicio),
    duracion: minutos > 0 ? duracionLegible(minutos) : null,
    finAntesDelInicio: Boolean(fin) && minutos <= 0,
  };
};

/** Las funciones que se miden, en el vocabulario cerrado de `analytics-eventos`. */
const FUNCION = {
  agregar: 'encuentro-agregar',
  duplicar: 'encuentro-duplicar',
  borrar: 'encuentro-borrar',
} as const;

/**
 * §11 — Editor de sesiones: filas dinámicas (agregar / duplicar / borrar),
 * cada una con su `id` generado al crearse.
 *
 * "Generar N encuentros semanales" ahorra mucho tipeo, pero las fechas
 * resultantes quedan editables una por una: los ciclos siempre tienen
 * excepciones (§2.2 — sin RRULE, lista explícita).
 *
 * El chasis de la lista —agregar, duplicar, borrar por id, el contador y el
 * estado vacío— es `FilasEditor`, compartido con el editor de modalidades
 * (B-224). Acá queda lo propio de un encuentro: el generador de N, los saltos de
 * fecha de B-186 y la cancelación.
 */
export function SesionesEditor({ sesiones, onChange, mostrarLectura, error }: Props) {
  const [abrirGenerador, setAbrirGenerador] = useState(false);
  const [cantidad, setCantidad] = useState(8);
  const [cadaDias, setCadaDias] = useState(7);

  const primera = sesiones[0];
  const duracion = primera ? duracionMinutos(primera) : 120;

  /** Reemplaza una fila por id, nunca por índice (trampa 2). */
  const reemplazar = (id: string, f: (s: SesionForm) => SesionForm) =>
    onChange(sesiones.map((s) => (s.id === id ? f(s) : s)));

  const generar = () => {
    const inicio = primera?.inicio ?? aDatetimeLocal(new Date());
    medirFuncion('encuentros-generar', undefined, cantidad);
    onChange(
      // `previas` para que las filas que ya existen conserven su id y su evento
      // de calendario (B-90): sin eso, regenerar un ciclo publicado borraba y
      // recreaba los ocho eventos, y con ellos los recordatorios de la gente.
      generarSesiones({ cantidad, inicio, duracionMinutos: duracion, cadaDias, previas: sesiones }),
    );
    setAbrirGenerador(false);
  };

  return (
    <FilasEditor
      filas={sesiones}
      onChange={onChange}
      singular="encuentro"
      plural="encuentros"
      nueva={(filas) => {
        // Arranca una semana después de la última, que es el caso más común.
        const ultima = filas[filas.length - 1];
        const base = ultima ? deDatetimeLocal(ultima.inicio) : null;
        const siguiente = base ? new Date(base.getTime() + 7 * 86400_000) : new Date();
        return sesionVacia(siguiente, duracion * 60_000);
      }}
      duplicar={(s) => duplicarSesion(s, 7)}
      alCambiarCantidad={(accion, cantidadResultante) =>
        medirFuncion(FUNCION[accion], undefined, cantidadResultante)
      }
      error={error}
      etiquetaBorrar={(s) => `Borrar encuentro ${s.inicio || ''}`}
      claseFila={(s) =>
        s.cancelada ? 'border-borde bg-black/[0.03] opacity-60' : 'border-borde bg-white'
      }
      insignias={(s) =>
        s.calendarEventId ? (
          <span
            className="rounded-full bg-tinta/10 px-2 py-0.5 text-[11px] text-tinta/60"
            title={`Evento de Calendar: ${s.calendarEventId}`}
          >
            en Calendar
          </span>
        ) : null
      }
      acciones={
        <>
          <button
            type="button"
            onClick={() => setAbrirGenerador((v) => !v)}
            className={claseBotonSecundario}
            aria-expanded={abrirGenerador}
          >
            Generar N encuentros…
          </button>
          <button
            type="button"
            onClick={() => {
              medirFuncion('encuentros-ordenar', undefined, sesiones.length);
              onChange(ordenarPorInicio(sesiones));
            }}
            className={claseBotonSecundario}
            disabled={sesiones.length < 2}
          >
            Ordenar por fecha
          </button>
        </>
      }
      bajoLaBarra={
        abrirGenerador && (
          <div className="rounded-md border border-acento/30 bg-acento/5 p-3">
            <div className="flex flex-wrap items-end gap-3">
              {/*
                B-204 — decían «Cantidad» y «Cada (días)». Leídas una al lado de la
                otra parecen dos cantidades, y un segundo admin cargando una feria
                lo reportó así: «no entiendo porque hay 2 opciones, lo de cantidad y
                cantidad de días». La segunda no es una cantidad de días: es el
                salto. Con el default de 7, pedir 3 encuentros para una feria de tres
                días seguidos generaba tres semanas — fechas válidas, no las que
                quería, y sin que nada avise.
              */}
              <label className="flex flex-col gap-1 text-xs">
                Cuántos encuentros
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={52}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  className={`${claseInput} w-32`}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Cada cuántos días
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={cadaDias}
                  onChange={(e) => setCadaDias(Number(e.target.value))}
                  className={`${claseInput} w-32`}
                />
              </label>
              <button
                type="button"
                onClick={generar}
                className={`${claseBotonPrimario} w-full sm:w-auto`}
              >
                Generar
              </button>
            </div>
            <p className="mt-2 text-xs text-tinta/60">
              <strong>7 es una vez por semana</strong>; para días seguidos —una feria
              de tres jornadas— va 1. Recalcula <strong>solo las fechas</strong>: los
              temas, las lecturas y las cancelaciones que ya cargaste se conservan.
              Toma la fecha y duración del primer encuentro como base — después
              ajustás las excepciones una por una.
              {sesiones.some((s) => s.calendarEventId) && (
                <>
                  {' '}
                  Los encuentros que ya están en el calendario se mueven de fecha:
                  no se borran ni se vuelven a crear, así que quien se suscribió los
                  conserva.
                </>
              )}
            </p>
          </div>
        )
      }
    >
      {(s, i, editar) => {
        const resumen = resumirSesion(s);
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                Inicio
                <input
                  type="datetime-local"
                  value={s.inicio}
                  onChange={(e) => reemplazar(s.id, (x) => conInicioNuevo(x, e.target.value))}
                  className={claseInput}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Fin
                <input
                  type="datetime-local"
                  value={s.fin}
                  onChange={(e) => editar({ fin: e.target.value })}
                  className={claseInput}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Tema
                <input
                  value={s.tema}
                  onChange={(e) => editar({ tema: e.target.value })}
                  placeholder="Ejercicio de voz"
                  className={claseInput}
                />
              </label>
              {mostrarLectura !== false && (
                <label className="flex flex-col gap-1 text-xs">
                  Lectura asignada
                  <input
                    value={s.lectura}
                    onChange={(e) => editar({ lectura: e.target.value })}
                    placeholder="Cap. 1-4"
                    className={claseInput}
                  />
                </label>
              )}
            </div>

            {/*
              B-186 — la operación que el reporte llama «correr la fecha», sin
              almanaque. Mueve inicio y fin juntos, así que un encuentro que se
              corre una semana es un toque y no dos recorridos de calendario.
            */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-tinta/55">Correr</span>
              {SALTOS_DE_FECHA.map(({ dias, etiqueta }) => (
                <button
                  key={dias}
                  type="button"
                  disabled={resumen.dia === null}
                  onClick={() => {
                    // B-186 — toda la hipótesis del arreglo es que esto reemplaza
                    // al almanaque nativo, que se cierra solo y no es nuestro para
                    // arreglar. Sin medirlo, el ítem queda cerrado por fe.
                    medirFuncion('encuentro-correr', undefined, dias);
                    reemplazar(s.id, (x) => correrSesion(x, dias));
                  }}
                  aria-label={`Correr el encuentro ${i + 1} ${nombreDelSalto(dias)}`}
                  className={`${claseBotonFila} border border-borde bg-white text-tinta/70 hover:bg-black/[0.03] disabled:opacity-40`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            {/*
              En qué día de la semana cae, que es lo único que el almanaque da y
              el tipeo no: con esto, escribir la fecha a mano se puede verificar
              de un vistazo.
            */}
            {resumen.dia && (
              <p
                className={`mt-2 text-xs ${
                  resumen.finAntesDelInicio ? 'font-medium text-acento' : 'text-tinta/55'
                }`}
              >
                {resumen.finAntesDelInicio
                  ? `Cae ${resumen.dia}, pero el fin no es posterior al inicio.`
                  : `Cae ${resumen.dia}${resumen.duracion ? `, dura ${resumen.duracion}` : ''}.`}
              </p>
            )}

            <label className="mt-2 flex items-center gap-2 text-xs text-tinta/70">
              <input
                type="checkbox"
                checked={s.cancelada}
                onChange={(e) => editar({ cancelada: e.target.checked })}
              />
              Cancelado — se borra del calendario público (§7.3)
            </label>
          </>
        );
      }}
    </FilasEditor>
  );
}
