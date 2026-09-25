import type { Dispatch, SetStateAction } from 'react';
import {
  ActividadFormulario,
  BibliotecasPanel,
  BoletinPanel,
  CalendarioActividades,
  EfemeridesPanel,
  EstadisticasPanel,
  HistorialActividad,
  LibreriasPanel,
  ListaActividades,
  LugaresPanel,
  PropuestasPanel,
  ReportesPanel,
  SuscripcionesPanel,
  TaxonomiasPanel,
} from '@/components/admin/pantallas/diferidas';
import type { DestinoDeVolver, Vista } from '@/components/admin/pantallas/vista';
// B-919 — puro: la misma pregunta que decide los botones de la fila del listado.
import { esSoloLectura } from '@/lib/formulario/autoria';
import type { Filtros, Orden } from '@/lib/filtrosActividades';
import type { FormatoDeHora } from '@/lib/formatoDeHora';
import type { RolDelPanel } from '@/lib/rolDelPanel';
import type { VistaDelPanel } from '@/lib/vistaDelPanel';
import type { Conversion } from '@/components/admin/PropuestasPanel';
import type { User } from 'firebase/auth';

/**
 * **El router de pantallas del panel** — M-17.
 *
 * Monta la pantalla de `vista` y nada más. El estado vive en el chasis
 * (`AdminApp.tsx`), porque es el único componente que sobrevive a un cambio de
 * vista —el formulario, el listado y la bandeja se desmontan—, y llega acá con
 * sus setters tal cual: los handlers de abajo son los mismos que estaban
 * escritos en el chasis, y la salida del formulario sigue pasando por
 * `salirDe` (B-35).
 *
 * Las pantallas entran todas por `import()` (`diferidas.tsx`), así que este
 * módulo no suma nada de Firestore al chunk del login (B-09, D-51).
 */
interface Props {
  vista: Vista;
  usuario: User;
  rol: RolDelPanel;
  ciudad: string;
  vistaDelPanel: VistaDelPanel;
  formatoDeHora: FormatoDeHora;
  filtros: Filtros;
  setFiltros: Dispatch<SetStateAction<Filtros>>;
  orden: Orden;
  setOrden: Dispatch<SetStateAction<Orden>>;
  version: number;
  setVersion: Dispatch<SetStateAction<number>>;
  volverA: DestinoDeVolver;
  setVolverA: Dispatch<SetStateAction<DestinoDeVolver>>;
  setVista: Dispatch<SetStateAction<Vista>>;
  setEtiquetasSinRegistrar: Dispatch<SetStateAction<readonly string[]>>;
  setFalloAlAceptar: Dispatch<SetStateAction<string | null>>;
  salirDe: (accion: () => void) => void;
  destinoDeVolver: () => Vista;
}

export function PantallaDelPanel({
  vista,
  usuario,
  rol,
  ciudad,
  vistaDelPanel,
  formatoDeHora,
  filtros,
  setFiltros,
  orden,
  setOrden,
  version,
  setVersion,
  volverA,
  setVolverA,
  setVista,
  setEtiquetasSinRegistrar,
  setFalloAlAceptar,
  salirDe,
  destinoDeVolver,
}: Props) {
  return (
    <>
      {vista.tipo === 'lista' && (
        <ListaActividades
          filtros={filtros}
          setFiltros={setFiltros}
          orden={orden}
          setOrden={setOrden}
          version={version}
          onNueva={() => {
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'nueva' });
          }}
          onEditar={(a) => {
            // Se resetea acá y no solo se setea en el calendario: si no, la
            // preferencia queda pegada y una edición desde el listado
            // devolvería al calendario.
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
          onDuplicar={(copia, tituloOrigen) => {
            setVolverA('lista');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'duplicar', copia, tituloOrigen });
          }}
          uid={usuario.uid}
          rol={rol}
          ciudad={ciudad}
          onHistorial={(a) => {
            setVolverA('lista');
            setVista({ tipo: 'historial', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'historial' && (
        <HistorialActividad
          actividad={vista.actividad}
          uid={usuario.uid}
          // Restaurar es una edición del documento: el listado tiene que
          // releerlo, igual que después de guardar el formulario.
          onRestaurado={() => setVersion((v) => v + 1)}
        />
      )}

      {vista.tipo === 'calendario' && (
        <CalendarioActividades
          version={version}
          rol={rol}
          uid={usuario.uid}
          ciudad={ciudad}
          onEditar={(a) => {
            setVolverA('calendario');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'taxonomias' && <TaxonomiasPanel />}

      {vista.tipo === 'estadisticas' && (
        <EstadisticasPanel
          onEditar={(a) => {
            // Vuelve al tablero y no al listado, con el mismo criterio que el
            // calendario: se llegó acá desde un aviso, y lo más probable es que
            // haya más de uno para atender en la misma sentada.
            setVolverA('estadisticas');
            setEtiquetasSinRegistrar([]);
            setVista({ tipo: 'editar', actividad: a });
          }}
        />
      )}

      {vista.tipo === 'boletin' && <BoletinPanel />}

      {vista.tipo === 'reportes' && (
        <ReportesPanel usuario={{ uid: usuario.uid, email: usuario.email }} />
      )}

      {vista.tipo === 'propuestas' && (
        <PropuestasPanel
          usuario={{ uid: usuario.uid }}
          onConvertir={(c: Conversion) => {
            // Vuelve a la bandeja y no al listado: se llegó acá desde ahí y lo
            // más probable es que haya más de una para atender en la misma
            // sentada (mismo criterio que el tablero).
            setVolverA('propuestas');
            setEtiquetasSinRegistrar([]);
            setFalloAlAceptar(null);
            setVista({
              tipo: 'convertir',
              copia: c.copia,
              tituloOrigen: c.tituloOrigen,
              avisos: c.avisos,
              imagenNoPromovida: c.imagenNoPromovida,
              alGuardar: c.alGuardar,
            });
          }}
        />
      )}

      {/*
        B-901 — las dos vistas montan el mismo componente a propósito: así la
        suscripción a `/librerias` sigue viva mientras el formulario está abierto
        y volver a la bandeja no cuesta una lectura nueva.
      */}
      {(vista.tipo === 'librerias' || vista.tipo === 'libreria') && (
        <LibreriasPanel
          usuario={{ uid: usuario.uid }}
          editando={
            vista.tipo === 'libreria' ? (vista.ficha ?? 'nueva') : null
          }
          onAbrirFormulario={(ficha) => {
            // Vuelve a la bandeja y no al listado: se llegó acá desde ahí, y lo
            // más probable es que haya más de una ficha que atender en la misma
            // sentada (mismo criterio que la bandeja de propuestas).
            setVolverA('librerias');
            setVista({ tipo: 'libreria', ficha });
          }}
          onGuardado={() => setVista({ tipo: 'librerias' })}
          onCancelar={() => salirDe(() => setVista(destinoDeVolver()))}
        />
      )}

      {/* B-833 — ídem para los lugares para eventos. */}
      {(vista.tipo === 'lugares' || vista.tipo === 'lugar') && (
        <LugaresPanel
          usuario={{ uid: usuario.uid }}
          editando={vista.tipo === 'lugar' ? (vista.ficha ?? 'nueva') : null}
          onAbrirFormulario={(ficha) => {
            setVolverA('lugares');
            setVista({ tipo: 'lugar', ficha });
          }}
          onGuardado={() => setVista({ tipo: 'lugares' })}
          onCancelar={() => salirDe(() => setVista(destinoDeVolver()))}
        />
      )}

      {/* B-960 — ídem para las bibliotecas, el cuarto directorio. */}
      {(vista.tipo === 'bibliotecas' || vista.tipo === 'biblioteca') && (
        <BibliotecasPanel
          usuario={{ uid: usuario.uid }}
          editando={vista.tipo === 'biblioteca' ? (vista.ficha ?? 'nueva') : null}
          onAbrirFormulario={(ficha) => {
            setVolverA('bibliotecas');
            setVista({ tipo: 'biblioteca', ficha });
          }}
          onGuardado={() => setVista({ tipo: 'bibliotecas' })}
          onCancelar={() => salirDe(() => setVista(destinoDeVolver()))}
        />
      )}

      {/* B-959 — las efemérides: la lista y su formulario, en el mismo componente. */}
      {(vista.tipo === 'efemerides' || vista.tipo === 'efemeride') && (
        <EfemeridesPanel
          usuario={{ uid: usuario.uid }}
          editando={vista.tipo === 'efemeride' ? (vista.efemeride ?? 'nueva') : null}
          onAbrirFormulario={(efemeride) => {
            setVolverA('efemerides');
            setVista({ tipo: 'efemeride', efemeride });
          }}
          onGuardado={() => setVista({ tipo: 'efemerides' })}
          onCancelar={() => salirDe(() => setVista(destinoDeVolver()))}
        />
      )}

      {/* B-832 — ídem para las suscripciones literarias. */}
      {(vista.tipo === 'suscripciones' || vista.tipo === 'suscripcion') && (
        <SuscripcionesPanel
          usuario={{ uid: usuario.uid }}
          editando={vista.tipo === 'suscripcion' ? (vista.ficha ?? 'nueva') : null}
          onAbrirFormulario={(ficha) => {
            setVolverA('suscripciones');
            setVista({ tipo: 'suscripcion', ficha });
          }}
          onGuardado={() => setVista({ tipo: 'suscripciones' })}
          onCancelar={() => salirDe(() => setVista(destinoDeVolver()))}
        />
      )}

      {(vista.tipo === 'nueva' ||
        vista.tipo === 'editar' ||
        vista.tipo === 'duplicar' ||
        vista.tipo === 'convertir') && (
        <ActividadFormulario
          uid={usuario.uid}
          rol={rol}
          /*
           * B-919 — **solo al editar.** Crear y duplicar nacen con `createdBy`
           * propio, así que son escrituras que la regla acepta; lo que puede ser
           * de otro es lo que se abre desde el listado. La misma función que
           * decide si la fila muestra «Ver» o «Editar», para que las dos
           * pantallas no puedan contestar distinto (B-175).
           */
          soloLectura={
            vista.tipo === 'editar' && esSoloLectura(rol, vista.actividad, usuario.uid)
          }
          // B-921 — dónde puede cargar: `''` para el admin y el publicador general.
          ciudad={ciudad}
          vistaDelPanel={vistaDelPanel}
          formatoDeHora={formatoDeHora}
          inicial={vista.tipo === 'editar' ? vista.actividad : undefined}
          copia={
            vista.tipo === 'duplicar' || vista.tipo === 'convertir' ? vista.copia : undefined
          }
          tituloOrigen={
            vista.tipo === 'duplicar' || vista.tipo === 'convertir'
              ? vista.tituloOrigen
              : undefined
          }
          origenDeLaCopia={vista.tipo === 'convertir' ? 'propuesta' : 'duplicado'}
          avisos={vista.tipo === 'convertir' ? vista.avisos : undefined}
          imagenNoPromovida={vista.tipo === 'convertir' ? vista.imagenNoPromovida : null}
          onCancelar={() => salirDe(() => setVista({ tipo: volverA }))}
          onGuardado={(id, sinRegistrar) => {
            setVersion((v) => v + 1);
            setEtiquetasSinRegistrar(sinRegistrar ?? []);
            /*
             * D-600, segundo movimiento: la actividad ya existe, así que ahora
             * —y solo ahora— la propuesta pasa a `aceptada` con su id. No se
             * espera para cambiar de vista: el guardado ya salió y dejar el
             * formulario montado mientras viaja un `update` no aporta nada.
             */
            if (vista.tipo === 'convertir') {
              void vista.alGuardar(id).catch((e: unknown) => {
                setFalloAlAceptar(
                  'La actividad se guardó, pero la propuesta quedó sin marcar como aceptada' +
                    ` (${e instanceof Error ? e.message : 'error desconocido'}).` +
                    ' Marcala a mano desde la bandeja: si no, se convierte dos veces.',
                );
              });
            }
            setVista({ tipo: volverA });
          }}
        />
      )}
    </>
  );
}
