# Mapa de trampas → test → archivo

Las diez trampas conocidas del [`CLAUDE.md`](../CLAUDE.md) §13, con **dónde vive
la regla** y **qué test la fija**. Cierra B-119.

## Para qué

El `auditor-trampas` reconstruía esta tabla en cada corrida con `grep`. Funciona
mientras la convención se respete, pero un test que cambia de nombre le hace
reportar "sin red" sobre algo cubierto, o —peor— lo contrario. Acá la respuesta
está escrita, y [`tests/mapa-de-trampas.test.ts`](../tests/mapa-de-trampas.test.ts)
la verifica contra el repo en cada corrida:

- que estén **las diez** (la lista se lee del §13, así que una trampa nueva en el
  `CLAUDE.md` rompe el test hasta que entre acá);
- que los archivos citados existan;
- que cada test citado **nombre su trampa** (`trampa N`), que es la convención
  que hace posible el `grep`;
- y que **la lista de descubiertas de abajo sea exactamente** la de las trampas
  sin ningún test que las nombre. Esa es la parte que vale: una trampa sin red no
  se puede esconder de una tabla que se verifica sola.

**La convención, entonces, es una regla y no una costumbre:** el test que cubre
una trampa la nombra en su `describe` o en su comentario de cabecera, con las
palabras `trampa N`.

## El mapa

| # | Trampa (§13) | Dónde vive la regla | Test que la fija |
|---|---|---|---|
| 1 | Timestamps sin timezone | `functions/calendario.js`, `src/lib/calendarioPanel.ts` | `tests/calendario.test.ts`, `tests/calendarioPanel.test.ts` |
| 2 | Ids de sesión por índice | `src/lib/sesiones.ts`, `src/lib/duplicar.ts`, `src/lib/formulario/autoguardado.ts` | `tests/sesiones.test.ts`, `tests/duplicar.test.ts`, `tests/autoguardado.test.ts` |
| 3 | Loop de escritura en la Function | `functions/index.js`, `functions/historial.js` | `tests/calendario.test.ts`, `tests/costuras.test.ts`, `tests/reportes.test.ts` |
| 4 | `firebase-admin` en bundle cliente | `src/lib/firebase-admin.ts`, `src/pages/admin.astro` | `tests/bundle-panel.test.ts` |
| 5 | Link de la reunión en lo público | `src/lib/toPublic.ts`, `functions/calendario.js`, `src/lib/formulario/autoguardado.ts` | `tests/toPublic.test.ts`, `tests/calendario.test.ts`, `tests/autoguardado.test.ts` |
| 6 | Taxonomías sin slugify | `src/lib/slugify.ts`, `src/lib/opciones.ts` | `tests/slugify.test.ts` |
| 7 | Query pública sin `where('estado','==','publicado')` | `firestore.rules` | — **sin red** |
| 8 | Olvidar el rebuild al cambiar `/opciones/*` | `functions/index.js`, `functions/rebuild.js` | `tests/costuras.test.ts`, `tests/clases-de-bug.test.ts` |
| 9 | Cambio de sede que no propaga a las N sesiones | `functions/calendario.js` | `tests/calendario.test.ts` |
| 10 | Slug mutable | `src/lib/schema.ts`, `src/lib/formulario/autoguardado.ts` | `tests/schema.test.ts`, `tests/autoguardado.test.ts` |
| 11 | Workflow de Actions que no parsea | `.github/workflows/deploy.yml`, `.github/workflows/push-main.yml` | `tests/workflows.test.ts` |

## Sin red

- **Trampa 7 · query pública sin `where('estado','==','publicado')`** — B-167.

  `tests/actividades.integracion.test.ts` prueba las reglas **por documento** (un
  anónimo lee lo publicado, no lee un borrador), que es la mitad de abajo. Lo que
  la trampa dice es otra cosa: con `allow read` condicionado a `resource.data`,
  una **query** de colección sin el `where` se rechaza **entera** — no devuelve
  el subconjunto visible. Es un modo de falla de la consulta, no del documento, y
  hoy no hay ninguna consulta de colección en el test de reglas.

  Todavía casi no muerde porque el público lee el `events.json` estático (§2.5).
  Muerde el día que aparezca la primera lectura en vivo del sitio público (B-01),
  que es exactamente cuando nadie se va a acordar del §5.3.

### La trampa 11, que se descubrió en producción

Es la única de la lista que **no** se identificó leyendo el código sino mirando
GitHub: `deploy.yml` tenía `run: echo "Motivo: ${{ … }}"`, y ese `: ` adentro de un
escalar sin comillas hace que YAML lea un mapa anidado. El archivo entero quedaba
inválido y GitHub lo registraba **sin triggers** — el `repository_dispatch` de
`dispararRebuild` no disparaba nada, la Function veía su POST devolver 204, y lo
único visible era una corrida fallida sin jobs en cada push. Estuvo así desde el
primer día (B-188).

Lo que la hace distinta de las otras diez: **ningún test del repo podía verla**. El
YAML roto no rompe un import, ni un tipo, ni una aserción; el único lugar donde se
nota es del otro lado. Y el parser tolerante engaña: `yaml` se recupera del error y
devuelve un objeto con `name` y `on` adentro, así que el chequeo tiene que mirar
`doc.errors` y no el resultado. Eso está escrito en el test, y se verificó
reintroduciendo el bug.

### Lo que estaba sin red hasta hoy

- **Trampa 4 · `firebase-admin` en el bundle cliente** — cerrada en esta corrida.
  Era la única de las diez sin ningún test y la de peor consecuencia (la key de
  la service account en un artefacto público, §5.4). La cubre ahora
  `tests/bundle-panel.test.ts`, recorriendo el grafo de imports desde la island
  de `/admin`: la regla del §5.4 no es "este archivo no lo importa", es "no se
  llega desde el cliente".

## Cobertura parcial, que el mapa no distingue

El test verifica que **exista** una red, no que sea completa. Dos casos anotados:

- **Trampa 3** — la clase (todo trigger con efecto duplicable se blinda) la cuida
  `tests/clases-de-bug.test.ts`; la instancia, `tests/costuras.test.ts`.
- **Trampa 8** — hay red sobre que el rebuild no cuelgue del sync (B-83) y sobre
  el debounce, pero el disparo por `/opciones/*` se verifica leyendo el fuente,
  no ejecutando el trigger.
- **Trampa 2 / clase de B-80** — el autoguardado de B-191 agrega una vía nueva
  para que un formulario viejo pise `calendarEventId`: un borrador del navegador
  de hace hasta 30 días. La red está en el punto de recuperación
  (`conIdsDeCalendarioDe`, que cruza por id de sesión y devuelve los ids del
  documento de hoy) y en `tests/autoguardado.test.ts`. La clase de fondo sigue
  viva y sigue anotada como el `it.fails` de B-80 en
  `tests/clases-de-bug.test.ts`: el formulario sigue siendo emisor de un campo
  que escribe la máquina.
- **Trampa 5 por la puerta del autoguardado (D-124)** — el mismo borrador de
  hasta 30 días podía **reactivar** `online.urlPublica` y
  `material.items[].publico`: se destilda la casilla, no se guarda, se recupera a
  los veinte días y se publica. La red está en el punto de recuperación
  (`sinFlagsDePublicacion`, que los vuelve a `false`) y en
  `tests/autoguardado.test.ts`. **La clase, no la instancia:** un campo del
  formulario cuyo valor de hace semanas tiene consecuencias al aplicarse sobre el
  documento de hoy. **La lista se quedó corta dos veces:** primero era solo
  `calendarEventId`, después se le sumaron los dos flags, y la re-auditoría del
  mismo cierre encontró tres más (`estado`, el `slug` bloqueado y `cancelada`). Van
  seis, viven juntos en `conLoQueEsDelDocumento` + `sinFlagsDePublicacion`, y al
  agregar un campo de esa forma corresponde preguntarse si entra ahí.
- **Trampa 10 por la misma puerta (D-124)** — el `slug` está bloqueado en el input
  cuando la actividad ya está publicada, pero el borrador recuperado pisaba el
  campo sin mirar ese flag: un borrador anterior a publicar trae el slug todavía
  cascadeando del título, así que recuperarlo cambiaba la URL de algo indexado.
  Sale del documento cuando está bloqueado (`conLoQueEsDelDocumento`).
