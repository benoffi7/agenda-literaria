import { useEffect, useRef, useState } from 'react';
import { claseBotonPrimario } from '@/components/campos/Campo';
import { DirectorioPanel, type FichaDeDirectorio } from '@/components/admin/DirectorioPanel';
import { LibreriaFormulario } from '@/components/admin/LibreriaFormulario';
import { medirFuncion } from '@/lib/analytics';
import { esPendienteDeRevision, type EstadoDirectorio } from '@/lib/directorios';
import { moverLibreria, observarLibrerias } from '@/lib/librerias';
import type { LibreriaConId } from '@/types/libreria';

/**
 * **La pantalla de librerías del panel** — B-901, tajada 2 paso 14.
 *
 * Es el pegamento entre tres piezas que ya existen y **no agrega ninguna regla**:
 *
 * | Pieza | Qué aporta |
 * |---|---|
 * | `DirectorioPanel` (B-834) | la bandeja: la lista, el filtro de pendientes y los botones del grafo. **La misma para los tres directorios** |
 * | `LibreriaFormulario` | los campos, que es lo único propio de esta entidad |
 * | `lib/librerias.ts` | leer y escribir |
 *
 * Que la bandeja sea genérica es lo que hace que las tajadas 3 y 4 (suscripciones
 * y lugares) sean un archivo como éste y su formulario, y nada más.
 *
 * ── Por qué el alta y la edición viven acá adentro ───────────────────────
 * `DirectorioPanel` no edita contenido a propósito —«acá se decide si entra al
 * sitio y nada más»— y `onEditar` es la puerta a este formulario. Tenerlo en la
 * misma pantalla y no en una vista hermana del router es lo que deja volver a la
 * bandeja sin perder el filtro, que es el mismo criterio con el que la conversión
 * de una propuesta vuelve a la bandeja y no al listado.
 *
 * **La excepción es el aviso de salida** (`salida-del-panel.ts`): mientras el
 * formulario está abierto, la vista del router **es** `'libreria'`, así que salir
 * del panel con cambios sin guardar pregunta. Por eso son dos vistas y no una —
 * un formulario que se abandona sin aviso es lo que B-35 vino a cerrar.
 */
interface Props {
  usuario: { uid: string };
  /** Abre el formulario. Lo maneja `AdminApp`, que es quien mueve la vista. */
  onAbrirFormulario: (ficha?: LibreriaConId) => void;
  /** La ficha que se está editando, o `'nueva'`. `null` = la bandeja. */
  editando: LibreriaConId | 'nueva' | null;
  /**
   * Guardó. **Separado de `onCancelar` y no un solo `onCerrar`**, y no es
   * cosmético: `AdminApp` envuelve el cancelar en `salirDe` (el aviso de cambios
   * sin guardar, B-35) y el guardado **no**, porque no quedó nada que perder.
   * Con un solo callback, guardar preguntaría «¿salir igual?» —el aviso que
   * aparece cuando no hay nada en juego, que es el que se aprende a ignorar—.
   */
  onGuardado: () => void;
  onCancelar: () => void;
}

export function LibreriasPanel({
  usuario,
  onAbrirFormulario,
  editando,
  onGuardado,
  onCancelar,
}: Props) {
  const [librerias, setLibrerias] = useState<LibreriaConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);

  /**
   * `librerias-abrir` con cuántas esperan decisión, igual que la bandeja de
   * propuestas y por el mismo motivo: el riesgo que este tipo de pantalla acepta
   * es que **nadie la mire**. Un entero y nada más — no sale ni un nombre ni un
   * contacto (§9 de la analítica).
   *
   * Va adentro del primer snapshot y no en un efecto de montaje: aquél mediría
   * antes de que Firestore conteste y reportaría cero siempre.
   */
  const medido = useRef(false);

  useEffect(
    () =>
      observarLibrerias(
        (ls) => {
          setLibrerias(ls);
          if (!medido.current) {
            medido.current = true;
            medirFuncion('librerias-abrir', undefined, ls.filter(esPendienteDeRevision).length);
          }
        },
        (e) => setFallo(e.message),
      ),
    [],
  );

  if (editando) {
    return (
      <LibreriaFormulario
        uid={usuario.uid}
        inicial={editando === 'nueva' ? undefined : editando}
        onGuardado={onGuardado}
        onCancelar={onCancelar}
      />
    );
  }

  /*
   * El mapeo a `FichaDeDirectorio`: los cinco campos del ciclo de vida, con
   * `nombre` en el nombre genérico que la bandeja pide. Es literalmente lo que su
   * docblock dice que hay que hacer una vez por entidad.
   */
  const fichas: FichaDeDirectorio[] = librerias.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    slug: l.slug,
    estado: l.estado,
    origen: l.origen,
    publicadaAlgunaVez: l.publicadaAlgunaVez,
  }));

  const porId = new Map(librerias.map((l) => [l.id, l]));

  const mover = async (ficha: FichaDeDirectorio, estado: EstadoDirectorio) => {
    try {
      await moverLibreria(ficha.id, usuario.uid, estado);
      setFallo(null);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo mover la librería');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={() => onAbrirFormulario()}
          className={claseBotonPrimario}
        >
          Cargar una librería
        </button>
      </div>

      <DirectorioPanel
        directorio="librerias"
        fichas={fichas}
        fallo={fallo}
        onMover={mover}
        onEditar={(f) => {
          const l = porId.get(f.id);
          if (l) onAbrirFormulario(l);
        }}
        detalle={(f) => {
          const l = porId.get(f.id);
          if (!l) return null;
          return (
            <>
              {l.direccion}
              {l.barrio ? ` · ${l.barrio}` : ''}
            </>
          );
        }}
      />
    </div>
  );
}
