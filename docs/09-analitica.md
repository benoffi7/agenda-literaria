# Analítica del panel — taxonomía de eventos

Referencia de qué se mide en `/admin`, con qué nombre y con qué parámetros.

**Este documento es la fuente de verdad de la taxonomía.** El valor de medir
aparece meses después, cuando alguien mira un gráfico y tiene que saber qué
significaba cada nombre. Si se agrega o cambia un evento, se actualiza acá en el
mismo cambio.

| | |
|---|---|
| Destino | Google Analytics 4, propiedad `G-9CFMHSSGRC` (el web app ya la traía) |
| Implementación | `src/lib/analytics-eventos.ts` (puro) + `src/lib/analytics.ts` (transporte) |
| Instrumentación del formulario | `src/components/admin/useMedicionFormulario.ts` |
| Tests | `tests/analytics-eventos.test.ts`, `tests/analytics-privacidad.test.ts`, `tests/analytics-campos.test.ts` (el vocabulario de campos contra el schema) y `tests/version.test.ts` (el formato de `version` contra el build) |
| Alcance | solo el panel `/admin`. El sitio público no mide nada |

---

## Para qué se instrumentó

**No para contar visitas: para encontrar fricción.** El formulario tiene 30+
campos condicionales (§11) y ya aparecieron dos problemas que nadie vio hasta
que el dueño se frustró y los reportó a mano:

- un placeholder que se veía idéntico a una opción elegida, y el formulario
  saltaba "Elegí el arancel" sobre algo que parecía completo (D-12);
- iOS Safari haciendo zoom al enfocar un campo de menos de 16px, sin volver.

Los dos habrían sido visibles en los datos: el primero como un pico de
`campo_invalido` con `campo=arancel.tipo`, el segundo como una diferencia de
`formulario_abandonado` entre `dispositivo=mobile` y `escritorio`. La apuesta
es encontrar el próximo **antes** de que alguien se enoje.

---

## Regla de privacidad — lo primero

**No sale contenido ni datos personales. Nunca.** Ni títulos, ni descripciones,
ni mails de inscripción, ni links de reunión, ni handles, ni direcciones, ni
uids, ni el mail de quien está logueado.

Se mide **que** un campo falló validación y **cuál** campo, nunca qué se
escribió. Ver [`07-seguridad.md`](07-seguridad.md#analítica-del-panel) para la
garantía y cómo se verifica.

---

## Los ocho eventos

Ocho, a propósito. Cincuenta eventos sueltos no se analizan; diez bien elegidos
sí. **Los nombres son estables:** renombrar uno corta la serie histórica en GA4,
así que se agregan, no se renombran.

### Parámetros comunes

Van en **todos** los eventos.

| Parámetro | Valores | Para qué |
|---|---|---|
| `dispositivo` | `mobile` · `tablet` · `escritorio` | La mitad del análisis. Se deriva del ancho y de `pointer: coarse`, no del user agent |
| `ancho` | `xs` (<400) · `sm` (<768) · `md` (<1024) · `lg` | Los cortes del layout. El ancho exacto no aporta y es una huella |
| `version` | `1.0.1+5e2cb50` · `1.0.1+5e2cb50-sucio.20260821-2124` · `1.0.1+sin-git.20260821-2124` | Atribuir un pico a un deploy. Formato verificado contra el productor; cualquier otra cosa viaja como `otro` |

**Las tres formas de `version` son las tres que el build puede estampar** y las
tres viajan enteras (B-88 · D-98). El sufijo `-sucio.` avisa que lo publicado no
corresponde a ningún commit, y `+sin-git.` que se buildeó desde un clone sin
historial; hasta B-88 esas dos viajaban como `otro`, o sea que justo el build que
no se puede identificar por el commit tampoco se podía identificar por la
versión. El formato lo produce `scripts/version.mjs` y lo verifica
`analytics-eventos.ts`, y como no pueden compartir código —uno corre en Node, el
otro en el navegador— los ata `tests/version.test.ts`: recorre el dominio
completo de entradas de un build y mete cada salida en el sanitizador real. En
producción no se ve ninguna de las dos con sufijo de tiempo: el workflow de
deploy falla si la versión del build sale `-sucio` o `sin-git`.

---

### 1 · `panel_abierto`

**¿Cuántas sesiones de panel hay y desde qué tipo de pantalla?** Es el
denominador de todo lo demás.

Se dispara una vez por carga de página, al montar el panel. **No lleva nada de
la sesión de auth**: ni uid, ni mail, ni si tiene el claim.

Sin parámetros propios.

---

### 2 · `formulario_abierto`

**¿Cuántas cargas se empiezan, y de qué modo?** Denominador del embudo de carga.

| Parámetro | Valores |
|---|---|
| `modo` | `nueva` · `editar` · `duplicar` |

`modo` es lo que permite preguntar si duplicar (B-11) sirve de verdad: si las
cargas con `modo=duplicar` terminan en `guardado_ok` mucho más que las
`nueva`, la función ahorró trabajo; si terminan en `formulario_abandonado`, no.

---

### 3 · `formulario_abandonado`

**¿Dónde se abandona una carga?** El evento más valioso de la taxonomía.

Se dispara al salir del formulario sin guardar: "Cancelar", "← Volver", o
`pagehide` si se cierra la pestaña.

| Parámetro | Valores | Para qué |
|---|---|---|
| `modo` | `nueva` · `editar` · `duplicar` | |
| `segundos` | 0–7200 | ¿Se fue a los 5 segundos o después de 20 minutos? |
| `avance` | 0–7 | Cuántos grupos de campos quedaron completos |
| `faltantes` | lista de grupos, unida por coma | **Dónde se trabó.** Los grupos son `que-es`, `encuentros`, `donde`, `quien`, `arancel`, `inscripcion`, `material` |
| `encuentros` | 0–200 | Un ciclo de 12 encuentros se abandona más que uno de 1 |
| `intentos_validacion` | 0–50 | Se fue después de pelear con la validación, o sin intentar |
| `sucio` | 0 · 1 | ¿Había trabajo adentro, o se abrió el formulario y se salió? |

`faltantes` se deriva de los mismos condicionales del §11 que valida el schema:
una actividad virtual no reclama sede, una sin inscripción no reclama destino.
Se mira **si hay algo** en cada campo, nunca qué hay.

`sucio` compara una huella del formulario al abrirlo contra la del cierre. La
huella se calcula y se descarta en el navegador; lo que viaja es un booleano.

---

### 4 · `validacion_fallida`

**¿Cuántas veces rebota la validación y con qué combinación de campos?** Una vez
por intento de guardado rechazado por el schema.

| Parámetro | Valores | Para qué |
|---|---|---|
| `modo` | `nueva` · `editar` · `duplicar` | |
| `accion` | `borrador` · `submit` | Qué botón se apretó |
| `cantidad` | 0–100 | Cuántos campos fallaron a la vez |
| `campos` | rutas del schema, unidas por coma (≤100 chars) | La **combinación** que falla junta |
| `intento` | 1–50 | El tercer rebote seguido es una historia distinta al primero |

---

### 5 · `campo_invalido`

**¿Qué campo falla y con qué frecuencia?** Uno por campo, hasta 12 por intento.

Existe además de `validacion_fallida` porque GA4 no sabe desarmar una lista
concatenada: para rankear "qué campo traba a la gente" hace falta un evento por
campo.

| Parámetro | Valores |
|---|---|
| `modo` | `nueva` · `editar` · `duplicar` |
| `campo` | una ruta del schema, o `otro` |
| `intento` | 1–50 |

**El vocabulario de `campo` se deriva del schema de zod**, no se mantiene a mano
(D-60). Ejemplos: `titulo`, `arancel.tipo`, `modalidades.N.sede.direccion`,
`modalidades.N.online.plataforma`, `inscripcion.destino`, `sesiones`, `sesiones.N.fin`,
`material.items.N.titulo`.

Los índices de fila se colapsan a `N`: `sesiones.3.fin` → `sesiones.N.fin`. Lo
que importa es qué campo falla, no en qué fila.

**Este es el evento que hay que mirar primero.** El bug del placeholder de
arancel (D-12) sería un `campo=arancel.tipo` desproporcionado.

---

### 6 · `guardado_ok`

**¿Cuánto tarda una carga completa, y qué forma tiene lo que se carga?**

| Parámetro | Valores | Para qué |
|---|---|---|
| `modo` | `nueva` · `editar` · `duplicar` | |
| `accion` | `borrador` · `submit` | |
| `estado` | `borrador` · `pendiente` · `publicado` · `cancelado` (los del modelo) | ¿Se publica o queda en borrador para siempre? |
| `segundos` | 0–7200 | **Cuánto tarda una carga completa**, desde abrir el formulario |
| `intentos_validacion` | 0–50 | Cuántos rebotes hubo antes de entrar |
| `encuentros` | 0–200 | |
| `modalidad` | `presencial` · `virtual` · `hibrido` | Desde B-224 es la **resultante**: la unión de las formas de cursar. La serie histórica no se corta |
| `modalidades` | 0–20 | **¿Alguien carga más de una forma de cursar?** (B-224). Si nadie lo hace, la lista complicó el formulario a cambio de nada |
| `es_ciclo` | 0 · 1 | |
| `material_items` | 0–100 | ¿Se usa el material, o la sección está de adorno? |
| `tags` | 0–100 | ¿Alguien pone tags? Alimentan los filtros del sitio público |
| `requiere_inscripcion` | 0 · 1 | |
| `tiene_tallerista` | 0 · 1 | |
| `tiene_libro` | 0 · 1 | ¿Se cargó la obra en una presentación o una charla? (DEC-1). El **título nunca** viaja: es texto libre |
| `cupo_completo` | 0 · 1 | ¿Estaba marcada como completa al guardar? (B-97). No hay contador de lugares, así que no hay número que viaje |
| `url_publica` | 0 · 1 | ¿Cuántas veces se tilda "publicar el link"? (D-15) |

`url_publica` es 1 solo si el flag está tildado **y** hay URL cargada, igual que
en `toPublic`: sin URL no se inventa el campo. Desde B-224 mira **todas** las
formas de cursar: con dos filas virtuales, mirar solo la primera diría «no» con un
link público en la segunda.

**`estado` y `modalidad` no tienen vocabulario propio: usan el del modelo**
(`ESTADOS` y `MODALIDADES` de `src/types/actividad.ts`), igual que `detalle` con
los campos de taxonomía (`CAMPOS_TAXONOMIA`). Eran copias hasta B-75, y una copia
significaba que un quinto `estado` en el modelo se reportaba como `otro` en
silencio — justo el dato con el que se contestan las preguntas de este
documento. Hoy un valor nuevo del modelo se mide solo.

---

### 7 · `guardado_fallido`

**¿Cuántos guardados fallan y por qué?**

| Parámetro | Valores |
|---|---|
| `modo` | `nueva` · `editar` · `duplicar` |
| `accion` | `borrador` · `submit` |
| `motivo` | `slug-tomado` · `permisos` · `sin-sesion` · `red` · `fecha-invalida` · `desconocido` |
| `codigo` | código del SDK de Firebase, de una lista cerrada |

**El mensaje del error nunca viaja.** `formADocumento` tira
`Fecha inválida: "<lo que se escribió>"`: el texto de ese error *es* contenido
del formulario. Lo que sale es la etiqueta `fecha-invalida`.

`slug-tomado` es el caso más probable: duplicar propone `…-copia` y dos copias
de la misma actividad chocan (D-18).

---

### 8 · `funcion_usada`

**¿Qué funciones del panel se usan de verdad?** Un evento con un enum, y no un
evento por función.

| Parámetro | Valores |
|---|---|
| `funcion` | ver la tabla de abajo |
| `detalle` | según la función: un campo de taxonomía, una sección, o un modo de fallo |
| `valor` | 0–1000, un número con sentido según la función |

| `funcion` | Cuándo | `detalle` | `valor` |
|---|---|---|---|
| `encuentro-agregar` | "+ Agregar encuentro" | — | encuentros resultantes |
| `encuentro-duplicar` | "Duplicar" en una fila | — | encuentros resultantes |
| `encuentro-borrar` | "Borrar" en una fila | — | encuentros resultantes |
| `encuentros-ordenar` | "Ordenar por fecha" | — | cantidad de encuentros |
| `encuentros-generar` | **"Generar N encuentros"** | — | el N pedido |
| `modalidad-agregar` | "+ Agregar modalidad" en «Dónde» | — | modalidades resultantes |
| `modalidad-duplicar` | "Duplicar" en una fila de modalidad | — | modalidades resultantes |
| `modalidad-borrar` | "Borrar" en una fila de modalidad | — | modalidades resultantes |
| `taxonomia-otro` | se elige "Otro…" en un desplegable | el campo | — |
| `taxonomia-nueva` | se confirma una etiqueta que no existía | el campo | — |
| `taxonomia-reusada` | lo tipeado normalizó a un slug existente | el campo | — |
| `taxonomia-sugerencia` | se elige una del autocompletado | el campo | — |
| `seccion-abrir` / `seccion-cerrar` | se despliega o colapsa un acordeón | la sección | — |
| `actividad-duplicar` | "Duplicar" en el menú ⋯ del listado | — | encuentros del original |
| `coordenadas-pegar` | se pega un link de Google Maps en la sede | — | — |
| `coordenadas-fallo` | ese link no se pudo resolver | el modo de fallo | — |
| `imagen-subida` | una imagen propia terminó de subir a Storage | — | — |
| `imagen-rechazada` | la subida no salió | por qué | — |

Valores de `detalle`:

- **Campos de taxonomía:** `arancel`, `tipo`, `barrio`, `plataforma`, `tags`.
- **Secciones:** `que-es`, `encuentros`, `donde`, `quien`,
  `arancel-e-inscripcion`, `material`, `opcional`, `difusion`, `vista-previa`.
- **Modos de fallo de coordenadas:** `coord-link-corto`,
  `coord-sin-coordenadas`, `coord-coma-decimal`, `coord-formato`.
- **Motivos de rechazo de una imagen:** `tamano`, `tipo`, `red`.

**Las dos de imágenes son el termómetro de una decisión del dueño** (B-167,
DEC-7b). `imagen-subida` contesta si la mitad cara de la galería se usa: si nadie
sube nunca y todos pegan URLs, la Function de optimización que falta (B-220) no
vale lo que cuesta. Y `imagen-rechazada` con `detalle: tamano` es el único
termómetro del tope de **3 MB**: si casi todos los rechazos son por tamaño, el
número está mal elegido y lo que hay que hacer es recomprimir del lado de la
Function, no explicar mejor.

**Nunca viaja el nombre del archivo ni su tamaño real**, aunque el mensaje que ve
la persona sí los diga: eso es contenido, y `detalle` es un enum cerrado de tres
valores.

`seccion-abrir` se instrumentó en el componente `Seccion`, así que **una sección
nueva se mide sola** en cuanto existe. Cae en `detalle: otro` hasta que su slug
entre en el vocabulario: si aparece un `otro` con volumen, lo que falta es una
línea en `SECCIONES`.

`taxonomia-reusada` vs `taxonomia-nueva` mide si el autocompletado del §4.2
está evitando duplicados de verdad, que es lo único que lo justifica.

**`detalle: tags` existe para tres de los cuatro eventos, no para los cuatro.**
El input de etiquetas emite `taxonomia-nueva`, `taxonomia-reusada` y
`taxonomia-sugerencia`, pero **nunca `taxonomia-otro`**: no hay ningún "Otro…"
que elegir, el input es siempre el de tipear (D-105). Que ese cruce esté vacío es
correcto, no un agujero de instrumentación. Hasta el 2026-08-24 los tres
faltaban: `tags` era el único campo de taxonomía invisible en GA4 (B-73).

`coordenadas-fallo` responde una pregunta con una consecuencia directa: **si el
80% de los fallos es `coord-link-corto`, la solución es resolver los links
cortos, no explicar mejor el campo.**

---

## Qué NO se mide, y por qué

| Qué | Por qué |
|---|---|
| Cualquier valor de cualquier campo | Regla de privacidad. Es la razón de ser de la proyección |
| El uid y el mail del admin | §5.1: los uids no salen ni al `events.json` |
| Cancelar un encuentro (la casilla "Cancelado") | Está en un `onChange` inline del JSX y medirlo exigía tocar el markup. Ver [B-58](BACKLOG.md) |
| Tildar "publicar el link de la reunión" en el momento | Ídem. Se mide igual en `guardado_ok.url_publica`, que es el dato que importa |
| El foco campo por campo (el embudo fino del formulario) | Exigiría instrumentar 30+ inputs, o refactorizar el formulario. `faltantes` da la ubicación gruesa sin tocar nada |
| El sitio público | Todavía no existe (paso 3 del §10) |

---

## Cuándo NO se manda nada

`debeMedir` tiene tres portones y los tres tienen que abrir:

1. **Estamos en un navegador.** El build de Astro corre en Node.
2. **No están los emuladores.** Con `PUBLIC_USE_EMULATORS=true` no sale nada:
   si no, las pruebas de desarrollo contaminan los datos de producción y el
   panel deja de servir para lo que se instrumentó. `vitest.config.ts` corre con
   ese flag, así que **los tests tampoco mandan nada**.
3. **Hay `PUBLIC_FIREBASE_MEASUREMENT_ID`.** Está en `.env.production` y vacío
   en el ejemplo.

Y además: si el `import()` del SDK falla —ad blocker, red caída, navegador sin
soporte— la analítica queda inutilizada y **el panel sigue funcionando igual**.
Todo `medir()` está envuelto; una métrica no puede tirar el formulario.

---

## Cómo se carga (y cuánto pesa)

`firebase/analytics` entra por un `import()` **dinámico**, disparado con
`requestIdleCallback` después de que el panel está interactivo. Rollup lo parte
en su propio chunk:

| Chunk | Peso | Cuándo se descarga |
|---|---|---|
| `AdminApp.*.js` | +9.058 bytes (+3.126 gzip) sobre el mismo build sin instrumentación | con el panel — es la instrumentación, no el SDK |
| `index.esm.*.js` | 34.5 kB (7.3 kB gzip) | **solo al idle**, después del primer render |

El chunk del SDK **no** lleva `modulepreload`, así que el navegador no lo pide
antes de tiempo. El bundle del sitio público no cambió ni un byte.

**Medido de nuevo el 2026-08-24** (cierre estático de imports de `/admin`,
comparando el build real contra el mismo build con la instrumentación en
no-ops):

| | raw | gzip |
|---|---|---|
| Carga inicial de `/admin` hoy | 386.303 B | 107.590 B |
| Sin ninguna instrumentación | 377.245 B | 104.464 B |
| **Toda la instrumentación** | **9.058 B** | **3.126 B** (2,9 %) |
| Solo la taxonomía + la proyección | 6.522 B | 2.188 B (2,0 %) |

Esa última fila es lo que costaría ganar mudando `construirEvento` al lado
diferido, que es lo que proponía [B-59](BACKLOG.md): **2,14 kB gzip a cambio de
partir la garantía de privacidad en dos pasos.** Se descartó con ese número
(D-99).

Los eventos disparados antes de que el SDK cargue se encolan (máximo 30) y se
vacían al arrancar. Si nunca arranca, la cola se descarta.

---

## Qué tiene que hacer el dueño para ver los datos

Nada de esto está hecho: son pasos de consola y este trabajo no toca
producción.

1. **Verificar que el stream de datos exista** en la propiedad `G-9CFMHSSGRC`
   (Administrar → Flujos de datos). Es la que ya venía con el web app.
2. **Registrar los parámetros como dimensiones personalizadas.** Este es el
   paso que se olvida y sin el cual los datos "no aparecen": GA4 recibe los
   parámetros pero **no los muestra en los informes** hasta que se registran, y
   solo cuentan desde el momento del registro, no retroactivamente.
   En Administrar → Definiciones personalizadas → *Crear dimensión
   personalizada*, alcance **Evento**:

   `dispositivo`, `ancho`, `version`, `modo`, `accion`, `campo`, `campos`,
   `motivo`, `codigo`, `faltantes`, `funcion`, `detalle`, `estado`, `modalidad`

   Y como **métricas** personalizadas: `segundos`, `avance`, `encuentros`,
   `intento`, `intentos_validacion`, `cantidad`, `valor`, `material_items`,
   `tags`, `modalidades`.

   El límite del plan gratuito es 50 dimensiones de evento, así que sobra.
3. **Mirar los datos.** Tres latencias distintas, y es la fuente de la
   confusión más común:

   | Dónde | Latencia | Para qué |
   |---|---|---|
   | **DebugView** | segundos | Verificar que un evento llega, evento por evento. Requiere activar el modo debug en el navegador |
   | **Tiempo real** | ~1 minuto, últimos 30 min | Confirmar que la instrumentación está viva |
   | **Informes / Exploraciones** | **24 a 48 horas** | Todo el análisis serio. Los primeros dos días no se ve casi nada |

4. **Un par de informes que valen la pena** (Explorar → exploración libre):
   - `campo_invalido` desglosado por `campo` → el ranking de fricción.
   - `formulario_abandonado` desglosado por `faltantes` y `dispositivo` → dónde
     y en qué pantalla se cae la carga.
   - `guardado_ok` con `segundos` promedio por `modo` → cuánto cuesta cargar una
     actividad, y si duplicar lo baja.
   - `funcion_usada` por `funcion` → qué funciones no usa nadie.

**Con dos personas cargando, los volúmenes son chicos.** Un ranking de
`campo_invalido` con 40 eventos ya dice algo; una tasa de abandono con 6 no.
Conviene mirarlo recién después de unas semanas, salvo el DebugView, que sirve
desde el primer minuto.

---

## Aviso al otro admin

Hay una segunda cuenta con el claim `admin` (ver
[`02-infraestructura.md`](02-infraestructura.md), que ya no la nombra: el repo es
público, §5.1) y su uso también queda medido.

**Corresponde avisarle**, aunque no se registre nada personal: se mide con qué
pantalla trabaja, en qué campos se traba y cuánto tarda. No se guarda su mail ni
su uid, y los dos perfiles se distinguen entre sí por un identificador aleatorio
del navegador, no por quién es cada uno — pero "es analítica anónima" no
reemplaza el aviso.

---

## Cómo agregar un evento

1. Declararlo en `EVENTOS` (`src/lib/analytics-eventos.ts`) con el sanitizador
   de cada parámetro. **No hay sanitizador de texto libre y no hay que
   agregarlo**: si un dato no entra en un entero, un booleano, un enum cerrado o
   una ruta del schema, no se mide.
2. Documentarlo acá. El test `analytics-privacidad.test.ts` verifica que la
   lista de nombres implementados sea exactamente la documentada, así que
   agregarlo sin documentarlo falla.
3. Llamar a `medir('nombre', { … })` en el punto de medición. **Una línea**: si
   medir algo exige reacomodar un componente, no se reacomoda — se anota en el
   backlog y se mide lo que se pueda.
