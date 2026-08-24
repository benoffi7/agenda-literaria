# Plan de saneamiento

Cómo se ataca el backlog acumulado —lo del diagnóstico de salud
([`10-salud-del-codigo.md`](10-salud-del-codigo.md)) más lo de la caza de bugs—
sin que los frentes se pisen entre ellos.

**Fuera de alcance: el sitio público.** B-01 y todo lo que dependa de él
(`B-105`…`B-114`, `B-99`, `B-27`, `B-101`, `B-121`, `B-122`) va aparte y después.
Su diseño ya está en [`12-sitio-publico.md`](12-sitio-publico.md).

## El criterio: se reparte por archivo, no por tema

Nueve agentes en paralelo sobre este repo ya dejaron una lección: los conflictos
no aparecen donde está el tema, aparecen donde está el archivo. Dos agentes
"arreglando bugs" chocan si los dos tocan `ActividadFormulario.tsx`, y no chocan
nunca si uno vive en `functions/` y el otro en `src/lib/`.

Entonces cada frente es **dueño exclusivo de un conjunto de archivos**. Si un
ítem necesita tocar un archivo de otro frente, no se hace: se anota la
dependencia y se hace en la fase siguiente.

Los dos archivos disputados, que son los que hay que cuidar:

| Archivo | Por qué se lo pelea todo el mundo |
|---|---|
| `src/components/admin/ActividadFormulario.tsx` | 8 ítems lo quieren tocar. **Un solo dueño por fase.** |
| `functions/calendario.js` | lo importa el panel por el alias `@calendario` (D-20), así que un cambio ahí afecta a las Functions **y** al bundle |

## Fase 1 — lo que rompe, en paralelo

Tres frentes, sin archivos compartidos entre ellos. Arrancan juntos.

### 1A · Cloud Functions

**Dueño de:** `functions/**` (salvo `calendario.js`, que es de 1B)

| | Qué | Por qué ahora |
|---|---|---|
| **B-80** | P0 · guardar desde el listado pisa `calendarEventId` y la edición siguiente duplica el evento | dos eventos para el mismo encuentro en el calendario **público**, por el camino normal |
| **B-82** | P0 · `syncCalendar` no es idempotente: una reentrega duplica | ídem, y la entrega es al-menos-una-vez por diseño |
| **B-83** | P1 · el rebuild del sitio cuelga del sync a Calendar | `destacado` e `imagenUrl` no llegan nunca al sitio |
| B-85 | P2 · `registrarExito` se come el cambio que llega durante el dispatch | |
| B-74 | P2 · `crearIssue` sin timeout | dos líneas; el conocimiento ya estaba escrito en la otra copia |
| B-04 | P2 · renombrar una etiqueta no actualiza los eventos ya creados | |
| B-41 | P3 · borrar una actividad no guarda versión | |
| B-77 | P3 · `index.js` sin el corte puro/trigger | habilita testear lo de arriba |
| B-21 | P3 · alerta de rebuild agotado | |

**Sobre B-82, que es el delicado.** La guarda del §7.1 corta la *recursión*, no
la *reentrega*. `guardarVersion` se blinda con `idDeVersion(event.time, event.id)`
y `reporteAIssue` con una transacción sobre `estado`; `syncCalendar` no mira
`event.id` en ninguna parte.

Hay una salida mejor que un marcador en el documento: **la API de Calendar acepta
que el `id` del evento lo elija el cliente**. Derivándolo del id de sesión, un
`insert` repetido devuelve 409 en vez de crear un segundo evento — idempotencia
en el sistema externo, que es donde tiene que estar. El alfabeto que pide es
base32hex (`0-9a-v`), y `ses_<uuid>` sin el guión bajo y sin los guiones ya cae
adentro. Los eventos que ya existen conservan su id de Google, así que es
compatible hacia atrás: el diff usa el `calendarEventId` guardado.

### 1B · El evento de Calendar (`calendario.js`)

**Dueño de:** `functions/calendario.js`, `src/lib/vistaPreviaEvento.ts`

| | Qué |
|---|---|
| B-84 | P2 · cancelar un encuentro de un ciclo renumera y reescribe los otros siete |

Un ítem solo, y va aparte a propósito: es el único archivo que cruza la frontera
Functions/panel. Si lo tocara 1A junto con `index.js`, un merge desprolijo
podría dejar el panel y el sync mostrando cosas distintas — que es exactamente
lo que el alias existe para evitar.

El test que hoy dice `cancelar un encuentro borra solo el suyo` pasa porque su
fixture **no es un ciclo**: el invariante no vale justo en el caso del §2.2.

### 1C · Analítica, versión y enums — ✅ terminada (2026-08-24)

**Dueño de:** `src/lib/analytics*.ts`, `src/lib/version.ts`, `scripts/version.mjs`

| | Qué | Resultado |
|---|---|---|
| B-75 | P2 · tres enums del modelo copiados sin guardia | hecho: se importan, +203 B en la carga inicial |
| B-88 | P3 · la analítica descarta la versión de un build de árbol sucio | hecho: productor y consumidor atados por un test (D-98) |
| B-36 | P3 · dos builds sucios del mismo commit no se distinguen | **descartado**: el sello ya los distingue, y el deploy corta si el build sale sucio |
| B-59 | P3 · la instrumentación suma 2,8 kB gzip | **descartado**: medido, la parte movible es 2,14 kB gzip (D-99) |

Dependencia anotada y **no** hecha: la tercera copia del formato de versión vive
en `tests/analytics-privacidad.test.ts`, que este frente tenía que dejar en verde
sin tocar (**B-165**).

## Fase 2 — el formulario, un dueño solo

**Dueño de:** `ActividadFormulario.tsx` y los módulos de dominio que salgan de él

Arranca cuando termina la fase 1, porque B-90 necesita saber cómo quedó el diff
de `calendario.js` (1B) y B-87 depende de que la instrumentación esté quieta (1C).

| | Qué | Orden |
|---|---|---|
| B-70 | P2 · sacar la lógica de dominio a módulos puros | **primero** |
| B-71 | P2 · un guardado que falla deja opciones huérfanas | con B-70 |
| B-87 | P2 · el formulario nace sucio | con B-70 |
| B-90 | P2 · "generar N encuentros" borra y recrea los ocho eventos | con B-70 |
| B-79 | P3 · partir el JSX por sección | **último** |

**B-70 antes que B-79, y no al revés.** Después de extraer la lógica hay tests
puros que cubren lo que se movió; partir el JSX primero sería mover 800 líneas a
ciegas. Y B-71 y B-87 viven dentro de la lógica que B-70 extrae: hacerlos antes
es arreglar código que está por mudarse.

Sobre B-71, el arreglo tiene una propiedad linda: invertir el orden —actividad
primero, etiquetas después— es **estrictamente mejor**, porque si fallan las
etiquetas el slug queda apuntando a una no registrada y el des-slug de D-11 ya
lo resuelve solo. El modo de falla pasa de *basura permanente en la taxonomía* a
*una etiqueta se ve capitalizada distinto*.

## Fase 3 — taxonomías y listado, en paralelo

### 3A · Taxonomías

**Dueño de:** `src/lib/opciones.ts`, `campos/TaxonomiaSelect.tsx`, `campos/TagsInput.tsx`, `useOpciones.ts`

| | Qué | Orden |
|---|---|---|
| B-72 | P2 · la deduplicación del §4.2 está implementada dos veces | **primero** |
| B-86 | P2 · `usos` solo cuenta creaciones | con B-72 |
| B-05 | P2 · las etiquetas se ven en público sin normalizar | |
| B-06 | P2 · no hay UI para administrar taxonomías | habilita B-25, B-26 |
| B-25 | P2 · aprobar desde el panel | después de B-06 |
| B-26 | P2 · nadie se entera de que hay algo para aprobar | después de B-06 |
| B-73 | P2 · los tags no se miden | |

### 3B · Listado y panel

**Dueño de:** `ListaActividades.tsx`, `AdminApp.tsx`, `ReportesPanel.tsx`, el centro de ayuda

| | Qué |
|---|---|
| B-76 | P2 · el listado muestra el estado en slug crudo |
| B-96 | P2 · "esta semana" arriba del listado |
| B-31 | P3 · un reporte en `error` no se puede reintentar desde el panel |
| B-40 | P3 · UI para ver y restaurar versiones |
| B-35 | P3 · salir con cambios sin guardar no avisa |
| B-14 | P3 · el menú de acciones no se navega con flechas |
| B-64 | P3 · pendientes chicos del centro de ayuda |
| B-62 | P2 · ayuda contextual por sección — **después de la fase 2** |

3B va después de la vista calendario, que ya toca estos archivos.

## Fase 4 — la red de contención

**Dueño de:** `tests/**`, `.claude/**`, `.github/workflows/**`

| | Qué |
|---|---|
| B-08 | P2 · sin tests de componentes — **después de la fase 2**, cuando quede menos lógica en el `.tsx` |
| B-117 | P2 · `bundle-panel.test.ts` no cubre el tercer chunk |
| B-50 | P2 · verificar el corte del bundle después de analytics |
| B-115 | P2 · nada invoca a los auditores solos |
| B-119 | P3 · falta un mapa trampa → test → archivo |
| B-120 | P3 · nada verifica que `13-agentes.md` liste los agentes que existen |
| B-34 | P3 · nada limita cuántos reportes se pueden cargar |
| B-78 | P3 · el 26 % de `src/lib/` es prosa |

## Lo que no es trabajo de código

**Decisiones tuyas**, que bloquean su ítem: B-28 (¿claim `curador`?), B-29
(¿auto-aprobar una etiqueta reusada?), B-102 (¿guardar datos de inscriptos?),
B-124 (¿cuándo corren los auditores?), y las cuatro de
[`12-sitio-publico.md`](12-sitio-publico.md) §11.1.

**Operación, con credenciales que solo vos tenés**: B-20 (activar el rebuild:
PAT, service account de CI, secret de GitHub), B-33 (crear las etiquetas del
repo), B-116 (verificación contra el sistema real), B-123 (re-relevar la infra).

## Regla para cualquiera que ejecute una fase

1. **No toques archivos de otro frente.** Si un ítem lo pide, anotá la
   dependencia y dejalo.
2. **Cada bug arreglado convierte su `it.fails` en `it`.** Los de
   `tests/costuras.test.ts` están marcados así justamente para que fallen el día
   en que alguien los arregle sin darse cuenta.
3. Vale la regla de proceso de [`05-patrones.md`](05-patrones.md): la
   documentación se actualiza con el código, y los hallazgos nuevos van al
   backlog priorizados.
4. **El conteo de tests en la doc no se toca**: cambia en cada merge y genera
   conflicto en cuatro archivos a la vez.
