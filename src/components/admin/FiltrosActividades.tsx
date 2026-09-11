import { useId, useMemo, useRef, useState } from 'react';
import { Campo, claseBotonChip, claseBotonChipActivo, claseInput } from '@/components/campos/Campo';
import {
  CUANDOS,
  DESTACADOS,
  ETIQUETA_CUANDO,
  ETIQUETA_DESTACADO,
  ETIQUETA_ESTADO,
  ETIQUETA_MODALIDAD,
  ETIQUETA_ORDEN,
  FILTROS_VACIOS,
  ORDENES,
  cantidadDeFiltros,
  chipsDeTags,
  conTagAlternada,
  legible,
  type Filtros,
  type FiltroDestacado,
  type OpcionesPresentes,
  type Orden,
} from '@/lib/filtrosActividades';
import { indiceDeTecla } from '@/lib/foco';
import type { LabelsTaxonomia } from '@/lib/vistaPreviaEvento';
import type { ActividadConId, Estado, Modalidad } from '@/types/actividad';

interface Props {
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  orden: Orden;
  onOrden: (o: Orden) => void;
  /** Solo los valores que existen en los datos (ver `opcionesPresentes`). */
  opciones: OpcionesPresentes;
  /** `{ campo: { valor: etiqueta } }` — se muestra la etiqueta, no el valor (§4.1). */
  labels: LabelsTaxonomia;
  /** Cuántas hay en total y cuántas quedaron después de filtrar. */
  total: number;
  mostradas: number;
  /**
   * B-274 — las actividades **sin filtrar** y el reloj, que es lo que necesita
   * `chipsDeTags` para contar cada etiqueta con los demás filtros puestos y este
   * eje no. Se pasan en vez de recibir los chips ya armados para que el
   * componente siga recibiendo datos y no una vista: el conteo depende de
   * `filtros`, que ya está acá.
   */
  actividades: ActividadConId[];
  ahora: Date;
  /**
   * B-888 — uid → mail, de `/usuarios`. Es lo que hace posible el eje «Quién la
   * cargó»: D-74 lo había descartado porque «es un uid, y el §5.1 mantiene los
   * identificadores afuera de todo lo que se muestre», y con el directorio de
   * D-650 lo que se muestra es el **mail**.
   *
   * Con el mapa vacío —el directorio arranca vacío y se llena a medida que cada
   * cuenta entra— el eje no se dibuja: un desplegable de uids sería justo lo que
   * D-74 rechazaba. Ver el `if` de más abajo.
   */
  mailes: ReadonlyMap<string, string>;
}

/**
 * Orden y filtros del listado (B-126, D-73, D-74, D-152).
 *
 * **Los filtros arrancan colapsados detrás de un botón** que muestra cuántos hay
 * puestos. En 360px seis desplegables abiertos empujan el listado abajo del
 * pliegue, y el listado es lo que se vino a ver. El número del botón es lo que
 * impide que un filtro olvidado explique un listado que parece vacío.
 *
 * El sexto es **«Arancel»**, que D-74 había descartado y D-152 repone: no es un
 * bug que se arregla, es una decisión que se da vuelta, y el motivo está escrito
 * en las dos entradas.
 *
 * **Y los otros dos descartes de D-74 también se reponen** (B-274, pedido del
 * dueño el 2026-09-07): «Destacada» como séptimo desplegable —solo si hay alguna
 * destacada— y las **etiquetas**, que no son un desplegable porque son
 * multivaluadas: van como chips de alternancia debajo de la grilla, con el número
 * de cada una.
 *
 * **No hay una sola query nueva:** todo sale de las actividades que el listado ya
 * tiene en memoria (§2.5).
 */
export function FiltrosActividades({
  filtros,
  onFiltros,
  orden,
  onOrden,
  opciones,
  labels,
  total,
  mostradas,
  actividades,
  ahora,
  mailes,
}: Props) {
  const puestos = cantidadDeFiltros(filtros);
  const [abierto, setAbierto] = useState(puestos > 0);
  const id = useId();

  const cambiar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) =>
    onFiltros({ ...filtros, [campo]: valor });

  /**
   * B-888 — las cuentas que aparecen en los datos **y** tienen mail en el
   * directorio, ordenadas por mail.
   *
   * Se filtran las que no se resuelven en vez de mostrar el uid: un `<option>`
   * con `uid_b888_admin` adentro no le dice nada a nadie y reintroduciría lo que
   * D-74 descartaba. La contracara está dicha en la ayuda del control: una cuenta
   * que todavía no entró al panel no aparece en el desplegable, y sus actividades
   * quedan bajo «Cualquiera» — que es lo mismo que pasa con la marca de la
   * tarjeta, que dice «otra cuenta» hasta que esa persona entre.
   */
  const autoresConMail = useMemo(
    () =>
      opciones.autores
        .flatMap((uid) => {
          const mail = mailes.get(uid);
          return mail ? [[uid, mail] as const] : [];
        })
        .sort((a, b) => a[1].localeCompare(b[1], 'es')),
    [opciones.autores, mailes],
  );

  /*
   * B-274 · los chips de etiquetas. El memo es por lo mismo que el del listado:
   * `chipsDeTags` recorre la colección entera para contar cada faceta, y este
   * componente se re-renderiza con cada tecla del buscador.
   */
  const chips = useMemo(
    // `labels.tags` y no `desSlug` a secas: una etiqueta cargada como «Poesía»
    // tiene el slug `poesia`, y sin la curada el chip diría «Poesia» mientras el
    // autocompletado y el sitio dicen «Poesía» (§4.1). Lo cobró el auditor.
    () => chipsDeTags(actividades, filtros, ahora, labels.tags),
    [actividades, filtros, ahora, labels.tags],
  );
  const botonesDeTag = useRef<(HTMLButtonElement | null)[]>([]);

  /*
   * Las flechas mueven el foco dentro del grupo, con la **misma aritmética** que
   * el menú «⋯» del listado, la capa de ayuda y los chips del sitio
   * (`lib/foco.ts`, B-14/B-64): dónde cae el foco al pasar del último y qué tecla
   * mueve a dónde son las dos cosas que es fácil escribir mal por segunda vez.
   */
  const alTeclado = (e: React.KeyboardEvent, i: number) => {
    const destino = indiceDeTecla(e.key, i, chips.length);
    if (destino === null) return;
    e.preventDefault();
    botonesDeTag.current[destino]?.focus();
  };

  /** La etiqueta de un valor de taxonomía, con la legibilización como respaldo. */
  const etiqueta = (campo: 'tipo' | 'barrio' | 'arancel', valor: string) =>
    labels[campo]?.[valor] ?? legible(valor);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => setAbierto((v) => !v)}
          className={puestos > 0 ? claseBotonChipActivo : claseBotonChip}
        >
          Filtros{puestos > 0 && ` (${puestos})`}
        </button>

        <label className="flex min-w-0 items-center gap-2 text-xs text-tinta/60">
          Ordenar por
          <select
            className={`${claseInput} sm:max-w-52`}
            value={orden}
            onChange={(e) => onOrden(e.target.value as Orden)}
          >
            {ORDENES.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORDEN[o]}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-tinta/55 sm:ml-auto">
          {mostradas === total
            ? `${total} ${total === 1 ? 'actividad' : 'actividades'}`
            : `${mostradas} de ${total}`}
        </p>
      </div>

      {abierto && (
        <div
          id={id}
          className="flex flex-col gap-3 rounded-md border border-borde bg-white/60 px-3 py-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Estado" htmlFor={`${id}-estado`}>
              <select
                id={`${id}-estado`}
                className={claseInput}
                value={filtros.estado}
                onChange={(e) => cambiar('estado', e.target.value as Estado | '')}
              >
                <option value="">Cualquiera</option>
                {opciones.estados.map((v) => (
                  <option key={v} value={v}>
                    {ETIQUETA_ESTADO[v]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Tipo" htmlFor={`${id}-tipo`}>
              <select
                id={`${id}-tipo`}
                className={claseInput}
                value={filtros.tipo}
                onChange={(e) => cambiar('tipo', e.target.value)}
              >
                <option value="">Cualquiera</option>
                {opciones.tipos.map((v) => (
                  <option key={v} value={v}>
                    {etiqueta('tipo', v)}
                  </option>
                ))}
              </select>
            </Campo>

            {/*
              B-272 · D-152 — el arancel, que D-74 había descartado a propósito.
              Va **pegado a «Tipo»** y antes de modalidad, por lo mismo que en el
              sitio (D-151): es la segunda pregunta y no parte el grupo de dónde.

              Solo aparece si alguna actividad lo tiene cargado, como el barrio:
              un desplegable con una única opción «Cualquiera» es ruido.
            */}
            {opciones.aranceles.length > 0 && (
              <Campo label="Arancel" htmlFor={`${id}-arancel`}>
                <select
                  id={`${id}-arancel`}
                  className={claseInput}
                  value={filtros.arancel}
                  onChange={(e) => cambiar('arancel', e.target.value)}
                >
                  <option value="">Cualquiera</option>
                  {opciones.aranceles.map((v) => (
                    <option key={v} value={v}>
                      {etiqueta('arancel', v)}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo label="Modalidad" htmlFor={`${id}-modalidad`}>
              <select
                id={`${id}-modalidad`}
                className={claseInput}
                value={filtros.modalidad}
                onChange={(e) => cambiar('modalidad', e.target.value as Modalidad | '')}
              >
                <option value="">Cualquiera</option>
                {opciones.modalidades.map((v) => (
                  <option key={v} value={v}>
                    {ETIQUETA_MODALIDAD[v]}
                  </option>
                ))}
              </select>
            </Campo>

            {/* El barrio solo aparece si alguna actividad tiene sede cargada: un
                desplegable con una única opción "Cualquiera" es ruido. */}
            {opciones.barrios.length > 0 && (
              <Campo label="Barrio" htmlFor={`${id}-barrio`}>
                <select
                  id={`${id}-barrio`}
                  className={claseInput}
                  value={filtros.barrio}
                  onChange={(e) => cambiar('barrio', e.target.value)}
                >
                  <option value="">Cualquiera</option>
                  {opciones.barrios.map((v) => (
                    <option key={v} value={v}>
                      {etiqueta('barrio', v)}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo
              label="Fechas"
              htmlFor={`${id}-cuando`}
              ayuda="«Con algo por venir» mira los encuentros no cancelados que todavía no pasaron."
            >
              <select
                id={`${id}-cuando`}
                className={claseInput}
                value={filtros.cuando}
                onChange={(e) => cambiar('cuando', e.target.value as Filtros['cuando'])}
              >
                {CUANDOS.map((c) => (
                  <option key={c} value={c}>
                    {ETIQUETA_CUANDO[c]}
                  </option>
                ))}
              </select>
            </Campo>

            {/*
              B-888 — «Quién la cargó», el tercer descarte de D-74 que se da
              vuelta. El motivo por el que estaba afuera era que el dato es un
              uid; el desplegable de acá muestra el **mail** que `/usuarios`
              resuelve, y el uid se queda del lado de adentro (es el valor del
              `<option>`, no lo que se lee).

              **Dos condiciones para dibujarlo, y las dos hacen falta.** Con una
              sola cuenta en los datos el filtro no distingue nada (mismo
              criterio que el barrio y «Destacada»); y sin ningún mail resuelto
              el control sería una lista de uids, que es exactamente lo que D-74
              rechazaba. Eso además hace que el panel de un publicador no lo
              muestre **sin una rama por rol**: su listado ya trae solo lo suyo,
              así que `autores` tiene un elemento.
            */}
            {autoresConMail.length > 1 && (
              <Campo
                label="Quién la cargó"
                htmlFor={`${id}-autor`}
                ayuda="Es quién la creó. Quién la tocó por última vez lo dice la marca de cada tarjeta."
              >
                <select
                  id={`${id}-autor`}
                  className={claseInput}
                  value={filtros.autor}
                  onChange={(e) => cambiar('autor', e.target.value)}
                >
                  <option value="">Cualquiera</option>
                  {autoresConMail.map(([uid, mail]) => (
                    <option key={uid} value={uid}>
                      {mail}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            {/*
              B-274 — `destacado`, que D-74 había descartado porque «el sitio
              público todavía no existe». Hoy existe y la fila del listado pinta
              «Destacada», o sea que el booleano lo consume alguien.

              Solo aparece si hay alguna destacada, como el barrio y el arancel:
              sin ninguna, los tres valores contestan lo mismo.
            */}
            {opciones.hayDestacadas && (
              <Campo
                label="Destacada"
                htmlFor={`${id}-destacado`}
                ayuda="«Solo no destacadas» sirve para repasar qué está publicado y todavía no destacaste."
              >
                <select
                  id={`${id}-destacado`}
                  className={claseInput}
                  value={filtros.destacado}
                  onChange={(e) => cambiar('destacado', e.target.value as FiltroDestacado)}
                >
                  {DESTACADOS.map((d) => (
                    <option key={d} value={d}>
                      {ETIQUETA_DESTACADO[d]}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>

          {/*
            B-274 · el eje de etiquetas. **Va abajo de la grilla y no adentro**:
            es multivaluado y no entra en una celda de desplegable — con veinte
            etiquetas cargadas, una lista de chips necesita el ancho entero.

            **No es el `EjeDeFiltro` del sitio, y no es por no haberlo mirado.**
            Ese componente está compuesto con el sistema visual del sitio
            —`label-caps`, `bg-acento`, `text-papel`, radio 0— y el panel tiene el
            suyo, con radio y otras tintas. Traerlo dejaría un pedazo del sitio
            adentro del panel y pondría a los tests visuales del sitio a medir un
            componente usado sobre superficies que no son las suyas. Lo que **sí**
            se comparte es lo que de verdad no puede divergir: la aritmética del
            foco (`lib/foco.ts`), la forma del chip (`Chip`, en `lib/chip.ts`) y
            las tres reglas de conteo, escritas en `chipsDeTags`.
          */}
          {chips.length > 0 && (
            <fieldset className="min-w-0 border-0 p-0">
              <legend className="mb-1 text-xs text-tinta/60">
                Etiquetas
                {filtros.tags.length > 0 && ` (${filtros.tags.length})`}
              </legend>

              {/*
                Sin `role="group"` ni `aria-label` acá: el `<fieldset>` **ya** es un
                grupo y su `<legend>` **ya** es su nombre accesible, así que
                repetirlos publicaba dos grupos con el mismo nombre. Lo cobró el
                test de render, que encontró dos donde tenía que haber uno.
              */}
              <div className="flex flex-wrap gap-1">
                {chips.map((chip, i) => (
                  <button
                    key={chip.valor}
                    ref={(el) => {
                      botonesDeTag.current[i] = el;
                    }}
                    type="button"
                    /*
                      `aria-pressed` y no una casilla escondida: así lo anuncia un
                      lector de pantalla como «Poesia, botón de alternancia, no
                      presionado», y funciona con Enter y con barra espaciadora sin
                      escribir un `onKeyDown` de más.
                    */
                    aria-pressed={chip.elegido}
                    onClick={() => onFiltros(conTagAlternada(filtros, chip.valor))}
                    onKeyDown={(e) => alTeclado(e, i)}
                    className={chip.elegido ? claseBotonChipActivo : claseBotonChip}
                  >
                    <span className="min-w-0 truncate">{chip.label}</span>
                    {/*
                      El número va aparte del nombre y `aria-hidden`: «Poesia 12»
                      se leería como una poesía número 12. `tabular-nums` para que
                      la columna no baile.
                    */}
                    <span aria-hidden="true" className="ml-1.5 tabular-nums text-tinta/50">
                      {chip.cantidad}
                    </span>
                    <span className="sr-only">{`, ${chip.cantidad} ${chip.cantidad === 1 ? 'actividad' : 'actividades'}`}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {puestos > 0 && (
            <button
              type="button"
              // El texto se conserva: limpiar los filtros no debería borrar lo
              // que se está buscando, que está en otro control y a la vista.
              onClick={() => onFiltros({ ...FILTROS_VACIOS, texto: filtros.texto })}
              className={`${claseBotonChip} self-start`}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
