import { useEffect, useRef, useState } from 'react';
import { claseBotonPrimario } from '@/components/campos/Campo';
import { DirectorioPanel, type FichaDeDirectorio } from '@/components/admin/DirectorioPanel';
import { SuscripcionFormulario } from '@/components/admin/SuscripcionFormulario';
import { medirFuncion } from '@/lib/analytics';
import { DIAS_PARA_REVISAR, pideRevision } from '@/lib/datoConFecha';
import { esPendienteDeRevision, type EstadoDirectorio } from '@/lib/directorios';
import { fraseDePrecio } from '@/lib/suscripcionPublica';
import { moverSuscripcion, observarSuscripciones } from '@/lib/suscripcionesLiterarias';
import type { SuscripcionLiterariaConId } from '@/types/suscripcion-literaria';

/**
 * **La pantalla de suscripciones literarias del panel** — B-832, tajada 3.
 *
 * Es el pegamento entre tres piezas que ya existen y **no agrega ninguna regla**:
 * `DirectorioPanel` (la bandeja genérica de B-834, la misma para los tres
 * directorios), `SuscripcionFormulario` (los campos, que es lo único propio de
 * esta entidad) y `lib/suscripcionesLiterarias.ts` (leer y escribir).
 *
 * Que esta pantalla sea un archivo de ciento y pico de líneas es lo que el paso
 * 12 quería probar: la tajada 4 va a ser este archivo con otro nombre.
 *
 * ── Lo único propio: el aviso de los sesenta días ────────────────────────
 * **La tercera regla de DEC-12** (§ 6 del PRD, B-837): «el panel avisa a los 60
 * días». No es un mail ni una alerta: es una línea al lado de la ficha, con el
 * patrón del badge de pendientes que ya existe. `pideRevision` es el predicado y
 * vive en `lib/datoConFecha.ts` —compartido con las promos de una librería, el
 * día que existan— así que «viejo» quiere decir lo mismo en las dos pantallas.
 *
 * Y avisa también cuando **la fecha no es usable**, que es el caso que parece un
 * detalle y no lo es: ahí el sitio no está publicando el precio (`fraseDePrecio`
 * devuelve vacío), o sea que sin este aviso el número quedaría cargado, invisible
 * y sin que nadie se enterara.
 */
interface Props {
  usuario: { uid: string };
  /** Abre el formulario. Lo maneja `AdminApp`, que es quien mueve la vista. */
  onAbrirFormulario: (ficha?: SuscripcionLiterariaConId) => void;
  /** La ficha que se está editando, o `'nueva'`. `null` = la bandeja. */
  editando: SuscripcionLiterariaConId | 'nueva' | null;
  /**
   * Guardó. **Separado de `onCancelar`** por lo mismo que en librerías:
   * `AdminApp` envuelve el cancelar en `salirDe` (el aviso de cambios sin
   * guardar, B-35) y el guardado no, porque no quedó nada que perder.
   */
  onGuardado: () => void;
  onCancelar: () => void;
}

export function SuscripcionesPanel({
  usuario,
  onAbrirFormulario,
  editando,
  onGuardado,
  onCancelar,
}: Props) {
  const [suscripciones, setSuscripciones] = useState<SuscripcionLiterariaConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);

  /**
   * `suscripciones-abrir` con cuántas esperan decisión, igual que las otras dos
   * bandejas y por el mismo motivo: el riesgo que este tipo de pantalla acepta es
   * que **nadie la mire**, y el § 10 del PRD lo nombra como el contra de esta
   * sección. Un entero y nada más — no sale ni un nombre, ni un precio, ni un
   * contacto (§9 de la analítica).
   */
  const medido = useRef(false);

  useEffect(
    () =>
      observarSuscripciones(
        (ss) => {
          setSuscripciones(ss);
          if (!medido.current) {
            medido.current = true;
            medirFuncion(
              'suscripciones-abrir',
              undefined,
              ss.filter(esPendienteDeRevision).length,
            );
          }
        },
        (e) => setFallo(e.message),
      ),
    [],
  );

  if (editando) {
    return (
      <SuscripcionFormulario
        uid={usuario.uid}
        inicial={editando === 'nueva' ? undefined : editando}
        onGuardado={onGuardado}
        onCancelar={onCancelar}
      />
    );
  }

  /*
   * El mapeo a `FichaDeDirectorio`: los cinco campos del ciclo de vida, con
   * `nombre` en el nombre genérico que la bandeja pide.
   */
  const fichas: FichaDeDirectorio[] = suscripciones.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    slug: s.slug,
    estado: s.estado,
    origen: s.origen,
    publicadaAlgunaVez: s.publicadaAlgunaVez,
  }));

  const porId = new Map(suscripciones.map((s) => [s.id, s]));

  const mover = async (ficha: FichaDeDirectorio, estado: EstadoDirectorio) => {
    try {
      await moverSuscripcion(ficha.id, usuario.uid, estado);
      setFallo(null);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo mover la suscripción');
    }
  };

  /*
   * El reloj se lee **una vez por render** y no adentro del `detalle`: con una
   * llamada por fila, dos fichas cargadas el mismo día podrían caer a distinto
   * lado del corte si el render cruza la medianoche. Es el mismo criterio con el
   * que el build usa un solo instante para todo el sitio.
   */
  const ahora = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={() => onAbrirFormulario()}
          className={claseBotonPrimario}
        >
          Cargar una suscripción
        </button>
      </div>

      <DirectorioPanel
        directorio="suscripciones"
        fichas={fichas}
        fallo={fallo}
        onMover={mover}
        onEditar={(f) => {
          const s = porId.get(f.id);
          if (s) onAbrirFormulario(s);
        }}
        detalle={(f) => {
          const s = porId.get(f.id);
          if (!s) return null;
          // La misma frase que publica la ficha —valor y fecha pegados, o nada—:
          // el panel no puede mostrar el número solo, porque entonces habría dos
          // formas de leer el precio y una de las dos sin su fecha (D-570).
          const precio = fraseDePrecio(s.precio);
          return (
            <>
              {s.ofrecidaPor?.nombre}
              {precio ? ` · ${precio}` : ''}
              {pideRevision(s.precio, ahora) && (
                <span className="ml-1 text-acento">
                  · conviene revisar el precio (más de {DIAS_PARA_REVISAR} días)
                </span>
              )}
            </>
          );
        }}
      />
    </div>
  );
}
