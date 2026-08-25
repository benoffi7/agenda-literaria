# CLAUDE.md — Agenda de Actividades Literarias

Documento de contexto del proyecto. **Leer completo antes de escribir código.**
Contiene decisiones de arquitectura ya tomadas y cerradas. Si algo parece
mejorable, proponerlo explícitamente antes de implementar algo distinto — no
cambiar de enfoque por cuenta propia.

> **Estado de la implementación: [`docs/`](docs/README.md).**
> Este archivo dice qué se decidió; `docs/` dice qué se construyó, qué infra
> existe hoy, y qué falta.
>
> Dos reglas de proceso, detalladas en [`docs/05-patrones.md`](docs/05-patrones.md):
>
> 1. **Todo pedido de funcionalidad, arreglo o modificación de código termina
>    con la documentación actualizada.** Es parte de haber terminado, no un paso
>    posterior. Como mínimo, entra en [`docs/CHANGELOG.md`](docs/CHANGELOG.md).
> 2. **Todo reporte de posible bug va a [`docs/BACKLOG.md`](docs/BACKLOG.md),
>    ordenado por prioridad** — incluso si se arregla en el momento, para que
>    quede el rastro.

---

## 1. Qué es el proyecto

Sitio web público de actividades literarias en Argentina: talleres de escritura,
clubes de lectura, encuentros literarios, presentaciones de libros y charlas con
autores.

Tres piezas:

1. **Panel de admin** — formulario propio para cargar y editar actividades.
2. **Sitio público** — listado con búsqueda y filtros + página de detalle por actividad.
3. **Google Calendar público** — espejo de solo lectura para que la gente se suscriba.

---

## 2. Decisiones cerradas

Estas decisiones ya se discutieron y descartaron alternativas. No revisitar sin
que el usuario lo pida.

### 2.1 Firestore es la única fuente de verdad

Google Calendar es un **espejo de solo lectura**. El flujo es unidireccional:

```
Admin (React) → Firestore → Cloud Function → Google Calendar API
                    ↓
              build de Astro → sitio estático
```

**NO implementar sincronización bidireccional** (watch channels, syncToken,
webhooks de Calendar). Se evaluó y se descartó: es desproporcionado para el caso
de uso. Si alguien edita un evento directamente en Google Calendar, ese cambio se
pierde en el próximo sync. Es el comportamiento esperado.

### 2.2 Actividad ≠ Encuentro

Un club de lectura de 8 encuentros es **una** actividad con **ocho** sesiones en
un array embebido. No son 8 documentos.

Motivo: en el listado tiene que aparecer una sola tarjeta, y editar "cambió la
sede" tiene que ser una sola escritura.

**NO usar RRULE / eventos recurrentes de Google Calendar.** Los ciclos literarios
tienen fechas irregulares (se saltea un feriado, se corre una semana) y cada
encuentro tiene su propio tema o lectura asignada. Siempre lista explícita de
sesiones, un evento de Calendar por sesión.

### 2.3 Stack

- **Astro** para el sitio público, **estático (SSG)**. SEO real es requisito:
  si la gente no encuentra los talleres en Google, el sitio no sirve.
- **React** para el panel de admin, como island `client:only` en la ruta `/admin`
  del mismo proyecto Astro. Un repo, un Hosting target, un deploy.
- **Firebase**: Firestore + Functions (v2) + Hosting + Auth.
- **Plan Blaze obligatorio** — Cloud Functions no hace llamadas de red salientes
  en Spark, ni siquiera a APIs de Google. Configurar budget alert.

### 2.4 El JSON público lo genera el build, no una Function

Astro en build time lee Firestore con el Admin SDK y produce:
- las páginas de detalle en HTML (SSG),
- un `events.json` como artefacto estático para que el listado filtre en memoria.

**No existe una Function que genere el JSON.** La única Function de peso es la de
sync a Calendar.

### 2.5 Búsqueda en memoria, no en Firestore

Firestore no tiene full-text. La web pública hace **un solo fetch** de
`events.json` (cacheado en CDN) y filtra/busca en memoria del cliente.

Ventajas: búsqueda instantánea, filtros combinados sin composite indexes, cero
lecturas de Firestore desde el público, costo prácticamente nulo.

**No integrar Algolia / Typesense.** Se evaluó y es prematuro. El enfoque
funciona bien hasta varios miles de actividades futuras.

### 2.6 Autenticación con Google Calendar

**Service account, no OAuth con refresh tokens.**

Setup: crear service account → en la configuración del calendario, compartirlo
con el mail del service account (`...@....iam.gserviceaccount.com`) dándole
permiso **"Realizar cambios en los eventos"**.

La Function autentica con la key del service account. Sin flujo de
consentimiento, sin tokens que expiran.

---

## 3. Modelo de datos

### 3.1 `/actividades/{id}`

```
tipo: 'taller' | 'club-lectura' | 'encuentro' | 'presentacion' | 'charla'
titulo: string
slug: string                    // único, inmutable — ver §7
descripcion: string
imagenUrl: string | null
organizador: { nombre, instagram, web }
tallerista: { nombre, bio, instagram } | null    // o autor invitado

// ── CICLO ────────────────────────────────────────
esCiclo: boolean
sesiones: [{
  id: string,                   // 'ses_<uuid>' — generado en cliente, NUNCA por índice
  inicio: Timestamp,
  fin: Timestamp,               // la duración del encuentro sale de acá
  tema: string | null,          // "Cap. 1-4" / "Ejercicio de voz"
  lectura: string | null,
  cancelada: boolean,
  calendarEventId: string | null
}]

// ── MODALIDAD ────────────────────────────────────
modalidad: 'presencial' | 'virtual' | 'hibrido'
sede: { nombre, direccion, barrio, ciudad, indicaciones, geo } | null
online: { plataforma, url, urlPublica: boolean } | null

// ── INSCRIPCIÓN ──────────────────────────────────
inscripcion: {
  requiere: boolean,
  via: 'mail' | 'whatsapp' | 'dm' | 'formulario' | null,
  destino: string,              // mail, teléfono, @handle o URL
  cupo: number | null,
  cierra: Timestamp | null
}

// ── ARANCEL ──────────────────────────────────────
arancel: {
  tipo: string,                 // slug de taxonomía — ver §4
  notas: string                 // libre: "2 cuotas", "incluye material"
}

// ── MATERIAL (sobre todo club de lectura) ────────
material: {
  tiene: boolean,
  items: [{
    tipo: 'lectura' | 'guia' | 'contexto' | 'autor' | 'otro',
    titulo: string,
    url: string,
    entrega: 'previo' | 'al-inscribirse' | 'en-el-encuentro',
    publico: boolean            // ¿se muestra el link sin inscribirse?
  }]
}

// ── DIFUSIÓN (interno, nunca público) ────────────
difusion: {
  arrobar: string[],            // handles a etiquetar al publicar en redes
  notas: string
}

// ── META ─────────────────────────────────────────
estado: 'borrador' | 'pendiente' | 'publicado' | 'cancelado'
tags: string[]
destacado: boolean
searchText: string              // normalizado — ver §6
createdAt, updatedAt: Timestamp
createdBy, updatedBy: string    // uid
```

### 3.2 Notas del modelo

**`categoria`/`tipo` único + `tags` array no es redundante.** Firestore permite
un solo `array-contains-any` por query. Si todo va en `tags`, no se pueden cruzar
dos filtros de array.

**Guardar `Timestamp`, nunca strings de fecha.** Y siempre `timeZone` explícito
hacia Calendar (`America/Argentina/Buenos_Aires`). Es el bug clásico: eventos
corridos 3 horas.

**`difusion.arrobar`** son los handles que se etiquetan al publicar en redes. Es
campo de trabajo interno, no sale nunca al público.

---

## 4. Taxonomías autogestionadas

Patrón genérico: desplegable enumerado + casilla "Otro" cuyo valor **se incorpora
al desplegable** para usos futuros.

Se aplica a: `arancel.tipo`, `tipo`, `sede.barrio`, `online.plataforma`, `tags`.
**Una sola implementación, todos esos campos resueltos.**

### 4.1 `/opciones/{campo}`

```
valores: [
  { slug: 'gratis',       label: 'Gratis',           orden: 1, fijo: true,  usos: 0 },
  { slug: 'a-la-gorra',   label: 'A la gorra',       orden: 2, fijo: true,  usos: 0 },
  { slug: 'arancelado',   label: 'Arancelado',       orden: 3, fijo: true,  usos: 0 },
  { slug: 'beca-parcial', label: 'Con beca parcial', orden: 9, fijo: false, usos: 3 }
]
```

Un documento con array (no subcolección): son pocas opciones y se leen todas
juntas para pintar el formulario en una sola lectura.

**La actividad guarda solo el `slug`.** Así renombrar el label no obliga a tocar
ningún documento de actividad.

`'a-la-gorra'` es opción de primera clase, no un caso raro: en el circuito
literario es la mitad de los casos y no entra en el binario gratis/pago.

### 4.2 Normalización — crítico

Sin esto, en tres meses hay "A la gorra", "a la gorra ", "A la Gorra" y "Gorra"
como cuatro opciones distintas.

**Regla: antes de crear, buscar si ya existe por slug.**

```js
const slugify = (s) => s.trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // saca acentos
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

// "A la Gorra " → "a-la-gorra" → ya existe → reusa, no duplica
```

El campo "Otro" en el cliente debe ser un input **con autocompletado** contra la
lista existente. Si el usuario escribe "gor" y aparece "A la gorra", el 90% de
los duplicados no llega a nacer.

Escritura en transacción:

```js
async function upsertOpcion(campo, label) {
  const slug = slugify(label);
  const ref = db.doc(`opciones/${campo}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const valores = snap.data()?.valores ?? [];
    const existe = valores.find(v => v.slug === slug);
    if (existe) {
      tx.update(ref, { valores: valores.map(v =>
        v.slug === slug ? { ...v, usos: (v.usos ?? 0) + 1 } : v) });
    } else {
      tx.update(ref, { valores: [...valores,
        { slug, label: label.trim(), orden: 99, fijo: false, usos: 1 }] });
    }
    return slug;
  });
}
```

### 4.3 Reglas de taxonomía

- **`fijo: true`** protege las opciones base: no se pueden borrar ni renombrar
  desde la UI. Son las que probablemente estén cableadas en la lógica (ej.: badge
  verde para "Gratis"). Las creadas por "Otro" sí son editables y borrables.
- **`usos`** sirve para ordenar el desplegable por frecuencia real (mejor que
  alfabético) y para detectar basura: una opción con `usos: 1` creada hace meses
  es casi seguro un typo colgado.
- Si en el futuro carga gente además del dueño: agregar `aprobada: boolean`. Las
  opciones nuevas funcionan igual pero no aparecen en el desplegable de los demás
  hasta ser validadas.

### 4.4 Las opciones viajan en el JSON

```json
{
  "generadoEn": "2026-08-21T...",
  "opciones": {
    "arancel": [{ "slug": "gratis", "label": "Gratis" }],
    "tipo": []
  },
  "actividades": []
}
```

La web arma los chips de filtro recorriendo `opciones.*` — nada hardcodeado. Al
agregar una opción nueva aparece sola en los filtros.

**El rebuild debe dispararse también cuando cambia `/opciones/*`**, no solo
cuando cambia una actividad. Si no, se renombra una etiqueta y el sitio sigue
mostrando la vieja hasta que alguien edite un evento.

---

## 5. Seguridad — qué es público y qué no

**Todo lo que entra al `events.json` es público y scrapeable.** El build no
vuelca el documento entero: lo **proyecta**.

### 5.1 Nunca al JSON

| Campo | Motivo |
|---|---|
| `online.url` | El link de Zoom se manda al inscribirse, nunca se publica |
| `difusion` | Trabajo interno |
| `material.items[].url` con `publico: false` | Solo título y tipo, sin URL |
| `createdBy` / `updatedBy` | uids |

`inscripcion.destino` con un WhatsApp personal queda expuesto a bots. Usar número
de trabajo o publicar un `wa.me` con mensaje precargado.

### 5.2 Proyección

```js
const toPublic = (a) => ({
  ...pick(a, ['titulo','slug','tipo','descripcion','imagenUrl','modalidad',
              'sede','tags','destacado','searchText','arancel','organizador',
              'tallerista','esCiclo']),
  sesiones: a.sesiones.map(s =>
    pick(s, ['id','inicio','fin','tema','lectura','cancelada'])),
  inscripcion: {
    requiere: a.inscripcion.requiere,
    via: a.inscripcion.via,
    destino: a.inscripcion.destino,
    cupo: a.inscripcion.cupo,
    abierta: !a.inscripcion.cierra || a.inscripcion.cierra.toMillis() > Date.now(),
  },
  online: a.online ? { plataforma: a.online.plataforma } : null,
  material: {
    tiene: a.material.tiene,
    items: a.material.items.map(i =>
      i.publico ? i : { tipo: i.tipo, titulo: i.titulo, entrega: i.entrega }),
  },
});
```

### 5.3 Reglas de Firestore

```js
match /actividades/{id} {
  allow read:  if resource.data.estado == 'publicado';
  allow write: if request.auth.token.admin == true;
}
match /opciones/{campo} {
  allow read:  if true;
  allow write: if request.auth.token.admin == true;
}
```

El custom claim se setea una vez con el Admin SDK desde un script local:
`setCustomUserClaims(uid, { admin: true })`.

**Ojo:** `allow read` con condición sobre `resource.data` obliga a que toda query
pública incluya `where('estado','==','publicado')`, si no Firestore rechaza la
query entera. Con el enfoque de JSON estático casi no afecta, pero tenerlo
presente si se agrega alguna lectura en vivo.

### 5.4 `firebase-admin` nunca al cliente

Solo puede importarse desde frontmatter de `.astro`, `getStaticPaths` o scripts
de build. Si se cuela en un componente cliente, **la service account key termina
en el bundle**.

La key va en variable de entorno de CI. **Nunca en el repo.** El PAT de GitHub
va en Secret Manager.

---

## 6. Búsqueda

Normalizar al escribir para que la búsqueda ignore acentos:

```js
const normalize = (s) => s.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

searchText: normalize(
  `${titulo} ${descripcion} ${sede?.nombre ?? ''} ${sede?.barrio ?? ''} ` +
  `${organizador?.nombre ?? ''} ${tallerista?.nombre ?? ''}`
);
```

El input de búsqueda del cliente aplica el mismo `normalize` antes de comparar.

---

## 7. Sync a Google Calendar

La parte más frágil del sistema. **Implementar al final**, cuando el modelo ya
esté estable.

### 7.1 Guarda anti-loop

La Function escribe `calendarEventId` de vuelta en el documento, eso dispara la
Function otra vez → recursión. Firestore corta a las ~20 iteraciones, pero para
entonces ya se crearon 20 eventos duplicados.

```js
const CAL_FIELDS = ['titulo','descripcion','estado','sede','modalidad','sesiones'];

const relevantChanged = (a, b) =>
  CAL_FIELDS.some(f => JSON.stringify(a?.[f]) !== JSON.stringify(b?.[f]));
```

La escritura de `calendarEventId` va dentro de `sesiones`, así que **cuidado**:
`sesiones` está en `CAL_FIELDS`. Comparar solo los subcampos relevantes de cada
sesión (`inicio`, `fin`, `tema`, `cancelada`), no el objeto completo.

### 7.2 Diff por id de sesión

Al editar, hay que reflejar los cambios sin borrar y recrear todo — eso perdería
los recordatorios y las suscripciones de la gente.

```js
const byId = (arr = []) => new Map(arr.map(s => [s.id, s]));

const antes = byId(before?.sesiones);
const ahora = byId(after?.sesiones);

// eliminadas
for (const [id, s] of antes)
  if (!ahora.has(id) && s.calendarEventId) await del(s.calendarEventId);

// nuevas y modificadas
for (const [id, s] of ahora) {
  if (s.cancelada || after.estado !== 'publicado') {
    if (s.calendarEventId) await del(s.calendarEventId);
    continue;
  }
  const prev = antes.get(id);
  if (!prev?.calendarEventId) s.calendarEventId = await insert(build(after, s));
  else if (cambio(prev, s, before, after)) await update(prev.calendarEventId, build(after, s));
}
```

**Los `id` de sesión se generan en el cliente al crear la fila del formulario**
(`ses_${crypto.randomUUID()}`), **nunca por índice del array**. Si se usa el
índice, borrar la sesión 3 renumera todo y el diff cree que cambiaron cinco
encuentros en vez de uno.

**El `cambio()` depende de la sesión Y de la actividad.** Los datos del evento
salen de ambos: fecha y tema de la sesión, título y sede de la actividad. Un
cambio de sede tiene que actualizar las 8 sesiones.

### 7.3 Estados que borran del calendario

- `estado !== 'publicado'` (borrador, pendiente, cancelado) → borrar todos los eventos
- `sesion.cancelada === true` → borrar ese evento

### 7.4 Construcción del evento

```js
const body = {
  summary: actividad.titulo + (sesion.tema ? ` — ${sesion.tema}` : ''),
  description: actividad.descripcion,
  location: actividad.sede?.direccion,
  start: { dateTime: sesion.inicio.toDate().toISOString(),
           timeZone: 'America/Argentina/Buenos_Aires' },
  end:   { dateTime: sesion.fin.toDate().toISOString(),
           timeZone: 'America/Argentina/Buenos_Aires' },
};
```

**El link de Zoom no va en la descripción del evento** — el calendario es público.

---

## 8. Rebuild del sitio

Con SSG, una actividad nueva no existe hasta que se rebuildea.

**Flujo:** la Function de sync escribe `sistema/rebuild.pendiente = true`. Una
función programada cada 5 minutos dispara un `repository_dispatch` a GitHub
Actions si está en `true`, y lo baja a `false`.

Esto es el debounce: si se editan cinco campos seguidos no se disparan cinco
builds. Diez líneas y ahorra minutos de Actions.

Latencia resultante: ~2-7 minutos. Irrelevante para el caso de uso.

**Disparar también en cambios a `/opciones/*`.**

---

## 9. Estructura del proyecto

```
src/
  pages/
    index.astro                # listado + island de filtros
    actividad/[slug].astro     # detalle, SSG vía getStaticPaths
    admin.astro                # <AdminApp client:only="react" />
  components/
    Filtros.tsx                # island: lee events.json, filtra en memoria
    admin/                     # form, editor de sesiones, taxonomías
  lib/
    firebase-admin.ts          # SOLO build time — nunca al cliente
    firebase-client.ts         # auth del admin
    toPublic.ts                # proyección pública
    slugify.ts
functions/
  index.js                     # sync a Calendar + trigger de rebuild (v2)
firestore.rules
```

El panel de admin es una SPA con router propio dentro de `/admin`. El bundle
pesado queda aislado en esa ruta y no toca el sitio público.

---

## 10. Orden de implementación

1. **Modelo + reglas + emuladores** — `firebase emulators:start` con Firestore + Functions
2. **Admin (React)** escribiendo a Firestore
3. **Sitio público** con SSG
4. **Sync a Calendar**
5. **Trigger de rebuild**

El sync va al final, cuando el esquema ya no se mueve. Cada cambio de modelo
obliga a rehacer el diff de sesiones.

**Emuladores siempre durante el desarrollo del sync.** Un bug en el diff contra
el calendario real crea o borra eventos de verdad, y eso es carísimo de deshacer.

---

## 11. Formulario de admin

Con este esquema el formulario completo son 30+ campos y es inusable de corrido.

**Condicional por tipo.** Se elige `tipo` primero y se muestra solo lo que aplica:

| Campo | Aparece en |
|---|---|
| `material` | club de lectura (principalmente) |
| `tallerista` | taller |
| `autor` / libro presentado | presentación, charla |
| `sede` | presencial, híbrido |
| `online` | virtual, híbrido |

El resto va en un acordeón "opcional".

**Editor de sesiones:** filas dinámicas (agregar / duplicar / borrar), cada una
con su `id` generado al crearse. Un botón "generar N encuentros semanales" ahorra
mucho tipeo, pero las fechas resultantes tienen que quedar **editables una por
una** — los ciclos siempre tienen excepciones.

---

## 12. Historial de versiones

Con edición habilitada, tarde o temprano alguien pisa una descripción larga y la
quiere de vuelta.

`onDocumentUpdated` que escribe el `before` completo en
`/actividades/{id}/versiones/{timestamp}`. Son 5 líneas.

---

## 13. Trampas conocidas

Lista de errores que ya se identificaron. Verificar cada uno antes de dar por
cerrada una feature.

1. **Timestamps sin timezone** → eventos corridos 3 horas. Siempre `Timestamp` en
   Firestore y `timeZone` explícito hacia Calendar.
2. **Ids de sesión por índice** → el diff destruye eventos que no cambiaron.
   Siempre uuid generado en cliente.
3. **Loop de escritura en la Function** → 20 eventos duplicados. Guarda por
   campos relevantes.
4. **`firebase-admin` en bundle cliente** → service account key filtrada.
5. **Link de Zoom en `events.json` o en la descripción del evento público** →
   zoombombing.
6. **Taxonomías sin slugify** → cuatro variantes de "a la gorra" en el desplegable.
7. **Query pública sin `where('estado','==','publicado')`** → Firestore rechaza
   la query entera por las reglas.
8. **Olvidar disparar rebuild al cambiar `/opciones/*`** → labels desactualizados
   en los filtros.
9. **Cambio de sede que no propaga a las N sesiones** del ciclo en Calendar.
10. **Slug mutable** → URLs rotas y SEO perdido. Inmutable después de publicar.
11. **Workflow de Actions que no parsea** → GitHub lo registra **sin ningún
    trigger**, así que no corre nunca y nada lo dice de este lado. Un `: ` adentro
    de un escalar sin comillas alcanza (`run: echo "Motivo: ..."`).

---

## 14. Convenciones

- Idioma del código y los campos: **español** (coherente con el dominio).
- Comentarios y commits: español.
- Cloud Functions: **v2** (`onDocumentWritten`, `onSchedule`).
- Timezone del proyecto: `America/Argentina/Buenos_Aires`.
- Moneda: `ARS`.
