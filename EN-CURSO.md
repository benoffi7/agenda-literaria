# En curso

**Archivo de coordinación, no documentación.** Dice qué se está haciendo **ahora
mismo** y cómo retomarlo o abandonarlo. Cuando la tanda cierra, este archivo queda
vacío — si tiene contenido y nadie está trabajando, está mintiendo, y hay que
vaciarlo. La documentación de verdad vive en [`docs/`](docs/README.md).

Para parar todo: leé «Cómo parar» al final. Nada de lo que está en curso queda a
medias en `main`: los commits los hace el orquestador, uno por ítem y stageado por
path. **A mitad de tanda la suite completa está roja** —el árbol tiene trabajo en
vuelo de varios frentes a la vez— así que cada commit se verifica con los tests de su
frente más los archivos que toca, y la suite entera se corre al cerrar, antes de
pushear. Está explicado abajo.

---

## Estado — 2026-08-26, 19:30

**Publicado:** sitio y panel en `1.2.0+8cd96ab`. `syncCalendar` ACTIVE desde 18:52,
con el libro presentado y el cartel de cupo completo en la descripción del evento.

**Local sin pushear:** `52c79f1` (B-97). El panel en producción todavía no tiene el
ítem «Marcar cupo completo», pero la Function ya sabe leerlo. El desfasaje es del
lado inofensivo y se cierra con el próximo push.

**Árbol:** limpio al momento de escribir esto, salvo lo que estén escribiendo los
agentes de abajo.

---

## Tanda en paralelo — seis frentes

Cada frente tiene **propiedad exclusiva de archivos**. Ningún agente commitea:
los commits los hace el orquestador, uno por ítem, y **por path** — nunca
`git add -A`, que hoy mezcló trabajo de dos frentes en dos commits que decían otra
cosa.

Nadie toca: `docs/**`, `src/lib/schema.ts`, `src/types/actividad.ts`,
`src/lib/actividades.ts`, `src/lib/toPublic.ts`, `src/lib/analytics-eventos.ts`,
`src/lib/novedades.ts`, `src/lib/formulario/**`.

| Frente | Ítems | Archivos propios | Estado |
|---|---|---|---|
| A | **B-199** modal de duplicar | `lib/duplicar.ts`, `ListaActividades.tsx`, `MenuAcciones.tsx`, modal nuevo, `tests/duplicar.test.ts` | en curso |
| B | **B-186** almanaque · **B-193** encontrar la vista previa | `SesionesEditor.tsx`, `SeccionEncuentros.tsx`, `SeccionVistaPrevia.tsx`, `VistaPreviaEvento.tsx`, `campos/Seccion.tsx`, `campos/Campo.tsx`, `tests/foco.test.ts`, `tests/vistaPreviaEvento.test.ts` | en curso |
| C | **B-196** privacidad como propiedad | ídem | ✅ **commiteado** `1302135` |
| D | **B-63** que la guía no pueda mentir | `lib/ayuda.ts`, `tests/ayuda.test.ts` | en curso |
| E | **B-95** texto para redes | `lib/textoRedes.ts` (nuevo), componente nuevo, tests nuevos | en curso |
| F | **B-126** · **B-127** · **B-128** vista calendario y taxonomías | `lib/calendarioPanel.ts`, `CalendarioActividades.tsx`, el hook de labels, `tests/calendarioPanel.test.ts` | en curso |

**Decisiones que tomé yo para no dejarlos trabados**, y que se pueden revertir:

- **B-95 sin link a la actividad.** La página no existe y el sitio está congelado
  (DEC-6). Queda a una línea de agregarse.
- **B-186**: si la causa es el selector nativo del navegador y no un bug nuestro, no
  se construye un date-picker propio; el arreglo pasa a ser que tipear a mano sea
  cómodo.

---

## Lo que hay que saber a mitad de tanda

**La suite completa está roja, y es esperable.** El árbol tiene trabajo en vuelo de
cinco frentes, así que `npm test` entero no puede estar verde hasta que aterricen
todos. Lo que sí vale: **cada commit es coherente por sí solo** —se stagea por path y
se verifica corriendo los tests del frente más los archivos que toca— y la suite
completa se corre al cerrar la tanda, antes de pushear.

**Un hallazgo del frente C que le toca a otro:** `tests/invariantes-de-ciclo.test.ts`
referencia entradas de `tests/calendarioPanel.test.ts` **por número de línea**
(`DURACION_CERO_CONOCIDA`), así que editar ese archivo —que es justo lo que hace el
frente F— corre las líneas y pone rojo un test que no tiene nada que ver. Un registro
anclado por número de línea es frágil por construcción; anotarlo al cerrar.

## Encolado, con el motivo de por qué no está en la tanda

- **B-98 · cancelar sin que desaparezca en silencio** — **aprobado por el dueño el
  2026-08-26**, con el motivo de cancelación incluido. No entró a la tanda por
  colisión concreta: necesita `SesionesEditor.tsx` (frente B) para el campo del
  motivo, y cambia lo que sale al evento, así que el barrido de centinelas del
  frente C tendría que conocerlo. **Va después de que aterricen B y C.**
- **B-181 · el eje de `opciones`** (DEC-8, decidido) — toca el modelo entero
  (`types`, `schema`, `toPublic`, el diff del §7.2, la numeración de D-95). No puede
  ir en paralelo con nada.
- **B-194** y **B-205** — los dos tocan los workflows de deploy. B-194 ya tiene
  evidencia de una corrida real (la de `8cd96ab`, roja por el job de Functions).
- **B-21** — falta un click del dueño en la consola de GCP.
- **B-01 a B-113** — el sitio público, **congelado** por decisión del dueño: falta
  elegir el nombre y con él el dominio (DEC-6).

---

## Novedades del panel acumuladas

Van en `docs/CHANGELOG.md`, bajo «Sin publicar», con el `id` ya decidido. Se pasan a
`src/lib/novedades.ts` **en el mismo cambio que suba la versión** (D-117): escribirlas
antes obliga a adivinar el número.

Van seis: la galería, las etiquetas del generador, que regenerar conserva el
contenido, el tipo «Librería a la calle», el ajuste de la del autoguardado, el libro
presentado y el cupo completo.

---

## Cómo parar

1. **Parar los agentes**: `/tasks` los lista y los mata. Ninguno commitea, así que
   lo que quede a medias está solo en el árbol de trabajo.
2. **Ver qué quedó suelto**: `git status --short`. Lo que aparezca es de un frente
   que no llegó a cerrar.
3. **Descartar lo suelto** (si se abandona la tanda): `git checkout -- <paths>` de
   esos archivos, o `git stash` si se quiere conservar para después.
4. **Lo commiteado es coherente, pero la suite entera todavía no corrió sobre el
   conjunto.** Cada commit pasó los tests de su frente y los de los archivos que
   toca; la corrida completa y el gate mecánico van al cerrar la tanda. Si se corta
   acá, **antes de pushear hay que correr `./scripts/verificar-todo.sh`** — y el hook
   lo hace solo en el `git push`, así que en la práctica no se puede saltear.
   `git log --oneline origin/main..HEAD` dice qué falta pushear.
5. **Si se pushea**: el hook corre `verificar-todo.sh` solo (`core.hooksPath` quedó
   activado hoy). La corrida de Actions va a quedar **roja** por el job de Functions
   si el push toca `functions/` — es la contra asumida de D-119, y Hosting corre
   antes, así que publica igual. Verificar contra
   `curl -s https://agenda-literaria.web.app/version.json`, **no** contra el color de
   la corrida.
