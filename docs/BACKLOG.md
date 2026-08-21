# Backlog

Ordenado por prioridad. **Todo reporte de posible bug entra acá**, incluso si se
arregla en el momento: en ese caso va directo a [Cerrados](#cerrados), para que
quede el rastro de qué se rompió y por qué.

Prioridades: **P0** rompe algo o pierde datos · **P1** bloquea el objetivo del
proyecto · **P2** mejora real · **P3** cuando sobre tiempo.

---

## Decisiones pendientes del usuario

Nada de esto se puede avanzar sin respuesta. Están primero porque bloquean
trabajo.

| # | Tema | Contexto |
|---|---|---|
| DEC-1 | **`libro presentado`**: ¿campo propio o dentro de la descripción? | El §11 lo lista para presentaciones y charlas, pero el §3.1 no lo tiene en el modelo. Hoy en esos tipos se carga solo el autor. |
| DEC-2 | **`arancel` preselecciona "Gratis"**: ¿se queda así o vuelve a obligar a elegir? | Si se carga un taller pago y no se cambia, se publica como gratuito y la gente llega esperando no pagar. |

Resueltas el 2026-08-21:

| # | Tema | Resolución |
|---|---|---|
| DEC-3 | Checkbox "publicar el link de la reunión" | **respetarlo** → implementado (D-15) |
| DEC-4 | Home indexable con el placeholder | se deja así |
| DEC-5 | Eventos de prueba en el calendario | los borra el usuario |

---

## P1 — bloquean el objetivo del proyecto

El proyecto existe para que la gente encuentre los talleres en Google (§2.3).
Hoy eso no pasa: no hay sitio público.

### B-01 · Sitio público (paso 3 del §10)

Lo que falta:

- `src/pages/index.astro` — listado con la island de filtros.
- `src/components/Filtros.tsx` — lee `events.json`, filtra en memoria (§2.5).
- `src/pages/actividad/[slug].astro` — detalle por SSG con `getStaticPaths`.
- Generación de `events.json` en build time con el Admin SDK, usando
  `toPublic.ts` y las opciones del §4.4.

Ya está hecho y testeado: la proyección (`toPublic.ts`), la normalización de
búsqueda (`normalize.ts`) y el acceso de build time (`firebase-admin.ts`).

**Ojo:** toda query pública necesita `where('estado','==','publicado')` o
Firestore rechaza la query entera (trampa 7).

### B-02 · Trigger de rebuild (paso 5 del §10)

`dispararRebuild` está escrita pero sin desplegar (D-13). Falta:

- El workflow de GitHub Actions que responda al `repository_dispatch`.
- `GITHUB_TOKEN` en Secret Manager y `GITHUB_REPO` en la config (§5.4: el PAT
  **no** va al repo).
- Desplegar la función.

Sin esto, una actividad nueva no aparece en el sitio hasta un build manual.

**No olvidar** que el rebuild se dispara también al cambiar `/opciones/*`
(trampa 8) — eso ya está hecho en `rebuildPorOpciones`.

---

## P2 — mejoras reales

### B-03 · Historial de versiones (§12)

Un `onDocumentUpdated` que escriba el `before` completo en
`/actividades/{id}/versiones/{timestamp}`. El §12 dice que son 5 líneas.

Las reglas ya contemplan la subcolección. **Hoy pisar una descripción larga la
pierde**, y el §12 avisa que tarde o temprano pasa.

### B-04 · Renombrar una etiqueta no actualiza los eventos ya creados

La descripción del evento muestra la etiqueta, no el slug (D-11). Si se renombra
"A la gorra", los eventos existentes siguen diciendo lo anterior hasta la
próxima edición de la actividad.

`rebuildPorOpciones` solo marca el rebuild del sitio. Opciones: re-sincronizar
las actividades publicadas cuando cambia `/opciones/*`, o aceptarlo y
documentarlo (ya está documentado).

### B-05 · Las etiquetas de taxonomía se ven en público sin normalizar

Un tag creado como "narrativa" (minúscula) aparece así en el calendario público
y va a aparecer en los filtros del sitio. Ya pasó: `/opciones/tags` tiene
`narrativa="narrativa"`.

Opciones: capitalizar la primera letra al crear, o una UI para editar etiquetas
(el §4.3 dice que las creadas con "Otro" son editables y borrables — esa UI no
existe).

### B-06 · No hay UI para administrar taxonomías

El §4.3 dice que las opciones creadas con "Otro" son editables y borrables, y que
`usos` sirve para detectar basura ("una opción con `usos: 1` creada hace meses es
casi seguro un typo colgado"). No hay pantalla para nada de eso.

### B-07 · El formulario no captura `sede.geo`

El campo existe en el modelo y la Function lo usa para armar un link de mapa
exacto si está presente, pero el formulario no lo pide, así que siempre es
`null` y el mapa resuelve por dirección. Suficiente para direcciones normales;
falla en lugares sin numeración clara.

### B-08 · Sin tests de componentes

No hay testing-library instalada. La lógica pura está muy cubierta (134 tests),
pero el render y la interacción del formulario se verificaron a mano.

Vale al menos para `TaxonomiaSelect` (el bug del placeholder que se veía como
opción elegida habría salido en un test de render) y para el editor de sesiones.

### B-09 · El bundle del panel pesa 570 KB

Es el SDK de Firebase. Queda aislado en `/admin` y la home carga 8 KB, así que
no afecta al público ni al SEO. Se podría bajar con imports más finos o carga
diferida de Firestore, pero no es urgente.

---

## P3 — cuando sobre tiempo

### B-10 · `aprobada` en las opciones (§4.3)

Para cuando cargue gente además del dueño: las opciones nuevas funcionan pero no
aparecen en el desplegable de los demás hasta ser validadas.

### B-11 · Duplicar una actividad entera

Un ciclo nuevo suele ser el del año anterior con otras fechas. Hoy hay que
cargarlo de cero.

### B-12 · Vista previa de cómo queda el evento

El panel no muestra cómo va a verse la descripción en Calendar. Con ~20 campos
volcados ahí, una vista previa evitaría publicar y corregir.

### B-13 · El schedule de `dispararRebuild` no reintenta con backoff

Si el `repository_dispatch` falla, el flag queda en `true` y el próximo tick
reintenta a los 5 minutos, indefinidamente. Suficiente, pero sin límite ni
alerta.

---

## Cerrados

Se dejan para que quede el rastro de qué se rompió.

| Qué | Causa | Dónde |
|---|---|---|
| "Elegí el arancel" al guardar un formulario que parecía completo | el placeholder se renderizaba como el primer `<option>` con valor `""`, y el texto era un ejemplo ("Gratis, a la gorra…") que se veía idéntico a una opción elegida | `2fab7ef`, D-12 |
| El evento de Calendar quedaba sin mapa o con el mapa en otra ciudad | `location` mandaba solo `sede.direccion`, sin ciudad ni país | `90edc8a`, D-10 |
| iOS Safari hacía zoom al enfocar un campo y no volvía | inputs a 14px; iOS hace zoom por debajo de 16px | `2fab7ef` |
| La barra fija de acciones quedaba debajo de la barra de gestos del iPhone | faltaba `viewport-fit=cover` y `env(safe-area-inset-bottom)` | `2fab7ef` |
| Un usuario sin el claim hacía fallar la regla de Firestore | `request.auth.token.admin`: leer una clave ausente de un map es *evaluation error*, no `false` | `9a45c86`, D-05 |
| `createdAt`/`createdBy` se perdían al editar | `setDoc` con `merge:false` borraba los campos que el form no incluye | `9a45c86` |
| El primer deploy de Functions falló dos veces | la service account propia no tiene los roles que la default de Compute trae de fábrica | `af88f84`, D-06 |
| Riesgo: agregar un campo a la descripción del evento sin agregarlo a `CAL_FIELDS` dejaba de propagarlo, en silencio | lista de campos mantenida a mano | `90edc8a`, D-07 |
| El checkbox "publicar el link de la reunión" no hacía nada | la proyección y el evento descartaban la URL sin mirar el flag | D-15 |
