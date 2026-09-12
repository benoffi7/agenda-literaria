import { useEffect, useRef, useState } from 'react';
import { claseBotonPrimario } from '@/components/campos/Campo';
import { DirectorioPanel, type FichaDeDirectorio } from '@/components/admin/DirectorioPanel';
import { LugarFormulario } from '@/components/admin/LugarFormulario';
import { medirFuncion } from '@/lib/analytics';
import { DIAS_PARA_REVISAR, pideRevision } from '@/lib/datoConFecha';
import { esPendienteDeRevision, type EstadoDirectorio } from '@/lib/directorios';
import { fraseDePrecioDeLugar } from '@/lib/lugarPublico';
import { moverLugar, observarLugares } from '@/lib/lugares';
import type { LugarConId } from '@/types/lugar';

/**
 * **La pantalla de lugares para eventos del panel** — B-833, tajada 4.
 *
 * Es el pegamento entre tres piezas que ya existen y **no agrega ninguna regla**:
 * `DirectorioPanel` (la bandeja genérica de B-834, la misma para los tres
 * directorios), `LugarFormulario` (los campos, que es lo único propio de esta
 * entidad) y `lib/lugares.ts` (leer y escribir).
 *
 * Que esta pantalla sea un archivo de ciento y pico de líneas —el tercero
 * seguido— es lo que el paso 12 quería probar.
 *
 * ── Lo propio de esta bandeja, y es lo que más importa que se vea ────────
 * **El detalle dice si la dirección se publica.** No es decoración: es la
 * decisión del § 6 del PRD puesta donde se revisa la ficha, que es el único
 * momento en que alguien la va a mirar antes de que salga al sitio. Una ficha de
 * casa con la dirección prendida tiene que saltar a la vista en la bandeja, no
 * en el HTML publicado.
 *
 * El segundo agregado es el aviso de los sesenta días del precio, igual que en
 * suscripciones y con el mismo predicado compartido (`pideRevision`,
 * `lib/datoConFecha.ts`), así que «viejo» quiere decir lo mismo en las dos
 * pantallas.
 */
interface Props {
  usuario: { uid: string };
  /** Abre el formulario. Lo maneja `AdminApp`, que es quien mueve la vista. */
  onAbrirFormulario: (ficha?: LugarConId) => void;
  /** La ficha que se está editando, o `'nueva'`. `null` = la bandeja. */
  editando: LugarConId | 'nueva' | null;
  /**
   * Guardó. **Separado de `onCancelar`** por lo mismo que en los otros dos
   * directorios: `AdminApp` envuelve el cancelar en `salirDe` (el aviso de
   * cambios sin guardar, B-35) y el guardado no, porque no quedó nada que
   * perder.
   */
  onGuardado: () => void;
  onCancelar: () => void;
}

export function LugaresPanel({
  usuario,
  onAbrirFormulario,
  editando,
  onGuardado,
  onCancelar,
}: Props) {
  const [lugares, setLugares] = useState<LugarConId[]>([]);
  const [fallo, setFallo] = useState<string | null>(null);

  /**
   * `lugares-abrir` con cuántos esperan decisión, igual que las otras dos
   * bandejas. Un entero y nada más — no sale ni un nombre, **ni una dirección**,
   * ni un precio, ni un contacto (§9 de la analítica).
   */
  const medido = useRef(false);

  useEffect(
    () =>
      observarLugares(
        (ls) => {
          setLugares(ls);
          if (!medido.current) {
            medido.current = true;
            medirFuncion('lugares-abrir', undefined, ls.filter(esPendienteDeRevision).length);
          }
        },
        (e) => setFallo(e.message),
      ),
    [],
  );

  if (editando) {
    return (
      <LugarFormulario
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
  const fichas: FichaDeDirectorio[] = lugares.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    slug: l.slug,
    estado: l.estado,
    origen: l.origen,
    publicadaAlgunaVez: l.publicadaAlgunaVez,
  }));

  const porId = new Map(lugares.map((l) => [l.id, l]));

  const mover = async (ficha: FichaDeDirectorio, estado: EstadoDirectorio) => {
    try {
      await moverLugar(ficha.id, usuario.uid, estado);
      setFallo(null);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo mover el lugar');
    }
  };

  /*
   * El reloj se lee **una vez por render** y no adentro del `detalle`: con una
   * llamada por fila, dos fichas cargadas el mismo día podrían caer a distinto
   * lado del corte si el render cruza la medianoche.
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
          Cargar un lugar
        </button>
      </div>

      <DirectorioPanel
        directorio="lugares"
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
          // La misma frase que publica la ficha —valor y fecha pegados, o nada—:
          // el panel no puede mostrar el número solo (D-570).
          const precio = fraseDePrecioDeLugar(l.precio);
          return (
            <>
              {l.barrio}
              {l.capacidad ? ` · hasta ${l.capacidad}` : ''}
              {precio ? ` · ${precio}` : ''}
              {/*
                **§ 6 — qué pasa con la dirección, dicho en la bandeja.**
                Es la línea que hace que revisar una ficha incluya revisar esta
                decisión. Se dice en los dos sentidos a propósito: «sin dirección
                publicada» no es un error, es lo que corresponde para una casa, y
                «publica la dirección» es lo que hay que mirar dos veces.
              */}
              <span className={l.direccionPublica ? 'ml-1 text-tinta/55' : 'ml-1 text-azul'}>
                · {l.direccionPublica ? 'publica la dirección' : 'sin dirección publicada'}
              </span>
              {pideRevision(l.precio, ahora) && (
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
