import { useEffect, useRef, useState } from 'react';
import { claseBotonPrimario } from '@/components/campos/Campo';
import { DirectorioPanel, type FichaDeDirectorio } from '@/components/admin/DirectorioPanel';
import { BibliotecaFormulario } from '@/components/admin/BibliotecaFormulario';
import { medirFuncion } from '@/lib/analytics';
import { esPendienteDeRevision, type EstadoDirectorio } from '@/lib/directorios';
import { moverBiblioteca, observarBibliotecas } from '@/lib/bibliotecas';
import type { BibliotecaConId } from '@/types/biblioteca';

/**
 * **La pantalla de bibliotecas del panel** — B-960, el cuarto directorio.
 *
 * Es el pegamento entre tres piezas que ya existen y **no agrega ninguna regla**:
 *
 * | Pieza | Qué aporta |
 * |---|---|
 * | `DirectorioPanel` (B-834) | la bandeja: la lista, el filtro de pendientes y los botones del grafo. **La misma para los cuatro directorios** |
 * | `BibliotecaFormulario` | los campos, que es lo único propio de esta entidad |
 * | `lib/bibliotecas.ts` | leer y escribir |
 *
 * **Que este archivo sea casi idéntico al de librerías es el punto**, no una
 * copia que haya que unificar: lo que se comparte ya está compartido en
 * `DirectorioPanel`, y lo que queda acá es el mapeo a `FichaDeDirectorio` más
 * qué se muestra en el detalle de cada fila — las dos únicas cosas que dependen
 * de la entidad. B-834 predijo que el cuarto directorio sería «un archivo como
 * éste y su formulario, y nada más», y lo fue.
 *
 * ── Por qué el alta y la edición viven acá adentro ───────────────────────
 * `DirectorioPanel` no edita contenido a propósito —«acá se decide si entra al
 * sitio y nada más»— y `onEditar` es la puerta a este formulario. Tenerlo en la
 * misma pantalla y no en una vista hermana del router es lo que deja volver a la
 * bandeja sin perder el filtro.
 *
 * **La excepción es el aviso de salida** (`salida-del-panel.ts`): mientras el
 * formulario está abierto, la vista del router **es** `'biblioteca'`, así que
 * salir del panel con cambios sin guardar pregunta. Por eso son dos vistas y no
 * una — un formulario que se abandona sin aviso es lo que B-35 vino a cerrar.
 */
interface Props {
  usuario: { uid: string };
  /** Abre el formulario. Lo maneja `AdminApp`, que es quien mueve la vista. */
  onAbrirFormulario: (ficha?: BibliotecaConId) => void;
  /** La ficha que se está editando, o `'nueva'`. `null` = la bandeja. */
  editando: BibliotecaConId | 'nueva' | null;
  /**
   * Guardó. **Separado de `onCancelar`**, y no es cosmético: `AdminApp` envuelve
   * el cancelar en `salirDe` (el aviso de cambios sin guardar, B-35) y el
   * guardado **no**, porque no quedó nada que perder. Con un solo callback,
   * guardar preguntaría «¿salir igual?» — el aviso que aparece cuando no hay
   * nada en juego, que es el que se aprende a ignorar.
   */
  onGuardado: () => void;
  onCancelar: () => void;
}

export function BibliotecasPanel({
  usuario,
  onAbrirFormulario,
  editando,
  onGuardado,
  onCancelar,
}: Props) {
  const [bibliotecas, setBibliotecas] = useState<BibliotecaConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);

  /**
   * `bibliotecas-abrir` con cuántas esperan decisión, igual que las otras tres
   * bandejas y por el mismo motivo: el riesgo que este tipo de pantalla acepta
   * es que **nadie la mire**. Un entero y nada más — no sale ni un nombre, ni un
   * contacto, ni el costo de asociarse (§9 de la analítica).
   *
   * Va adentro del primer snapshot y no en un efecto de montaje: aquél mediría
   * antes de que Firestore conteste y reportaría cero siempre.
   */
  const medido = useRef(false);

  useEffect(
    () =>
      observarBibliotecas(
        (bs) => {
          setBibliotecas(bs);
          if (!medido.current) {
            medido.current = true;
            medirFuncion('bibliotecas-abrir', undefined, bs.filter(esPendienteDeRevision).length);
          }
        },
        (e) => setFallo(e.message),
      ),
    [],
  );

  if (editando) {
    return (
      <BibliotecaFormulario
        uid={usuario.uid}
        inicial={editando === 'nueva' ? undefined : editando}
        onGuardado={onGuardado}
        onCancelar={onCancelar}
      />
    );
  }

  /*
   * El mapeo a `FichaDeDirectorio`: los cinco campos del ciclo de vida, con
   * `nombre` en el nombre genérico que la bandeja pide. Es literalmente lo que
   * su docblock dice que hay que hacer una vez por entidad.
   */
  const fichas: FichaDeDirectorio[] = bibliotecas.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    slug: b.slug,
    estado: b.estado,
    origen: b.origen,
    publicadaAlgunaVez: b.publicadaAlgunaVez,
  }));

  const porId = new Map(bibliotecas.map((b) => [b.id, b]));

  const mover = async (ficha: FichaDeDirectorio, estado: EstadoDirectorio) => {
    try {
      await moverBiblioteca(ficha.id, usuario.uid, estado);
      setFallo(null);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo mover la biblioteca');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" onClick={() => onAbrirFormulario()} className={claseBotonPrimario}>
          Cargar una biblioteca
        </button>
      </div>

      <DirectorioPanel
        directorio="bibliotecas"
        fichas={fichas}
        fallo={fallo}
        onMover={mover}
        onEditar={(f) => {
          const b = porId.get(f.id);
          if (b) onAbrirFormulario(b);
        }}
        detalle={(f) => {
          const b = porId.get(f.id);
          if (!b) return null;
          /*
           * La dirección y el barrio, como en librerías. **El costo de asociarse
           * no va acá**: la bandeja es una lista de decisiones, y un número sin
           * su fecha al lado es exactamente lo que `datoConFecha.ts` existe para
           * impedir. Quien quiera verlo abre la ficha, donde va con su fecha.
           */
          return (
            <>
              {b.direccion}
              {b.barrio ? ` · ${b.barrio}` : ''}
            </>
          );
        }}
      />
    </div>
  );
}
