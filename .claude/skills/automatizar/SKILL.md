---
name: automatizar
description: Mejora continua del trabajo de este repo — busca lo que se hizo a mano más de una vez, o el error que ya volvió a pasar, y propone o construye la automatización que corresponde, eligiendo entre test, script, hook, skill y auditor. Invocalo cuando alguien diga "esto ya lo hice dos veces", "otra vez lo mismo", "habría que automatizar esto", "/automatizar", o cada tanto como barrido de mejora continua sobre el repo entero. También cuando un bug reaparezca con otra cara.
---

# Automatizar lo que ya se hizo dos veces

La regla es una: **la segunda vez es la señal.** La primera vez que algo se hace
a mano es trabajo; la segunda es un patrón; la tercera ya costó más que la
automatización.

Este repo tiene los cinco casos escritos, y conviene leerlos antes de decidir
porque son la calibración:

| Lo que se hacía a mano | Cuántas veces | Qué se construyó | Por qué esa forma |
|---|---|---|---|
| decidir qué deployar mirando el diff | todas | `scripts/que-deployar.sh` + `tests/que-deployar.test.ts` | la decisión estaba en un `if` dentro del YAML: **no se podía probar hasta que ya había deployado mal** |
| buscar `firebase-admin` en `dist/` | dos workflows | `scripts/verificar-bundle.sh` | estaba duplicado en YAML, y duplicar en YAML es garantizar que una de las dos copias quede vieja |
| acordarse de levantar los emuladores antes de creerle a `npm test` | siempre | la variable `EXIGIR_EMULADOR` | 43 tests se salteaban **en silencio**: "verde" no distinguía entre "las reglas pasaron" y "las reglas no se probaron" |
| revisar a ojo si quedaron marcadores de conflicto | dos veces commiteados | `tests/sin-marcadores-de-conflicto.test.ts` | con nueve ramas sobre los mismos archivos, resolver a ojo no alcanza |
| notar que un fixture no ejercitaba el caso real | tres veces (B-84, H1, H5) | `tests/invariantes-de-ciclo.test.ts` + `tests/fixtures/ciclo.ts` | el invariante hay que afirmarlo sobre una **familia** de fixtures; sobre una instancia, el fixture flojo lo deja pasar |

## 1 · Buscar los candidatos

No inventes candidatos: sacalos del rastro que ya existe.

```bash
# Lo que se repite en el historial: el mismo tipo de arreglo dos veces.
git log --oneline -60

# La tabla de Cerrados del backlog: la columna que sirve es la CAUSA, no el
# síntoma. Dos ítems con la misma causa son un candidato.
grep -n -A2 '^## Cerrados' docs/BACKLOG.md

# Pasos duplicados entre workflows (la lección de verificar-bundle.sh).
grep -rn 'run:' .github/workflows/ | sort | uniq -d

# Lo que la doc dice que se verifica a mano.
grep -rniE 'a mano|manualmente|acordarse|no te olvides' docs/ CLAUDE.md
```

Y las tres preguntas que ordenan la lista:

1. **¿Cuántas veces ya pasó?** Una vez no es un patrón (ver "cuándo no").
2. **¿Se rompe en silencio?** Si el error deja el build en verde, sube de
   prioridad: eso es lo que este repo paga caro.
3. **¿Cuánto cuesta el olvido?** Publicar algo privado es irreversible; una
   etiqueta capitalizada distinto se arregla tipeando.

## 2 · Elegir la forma

Cinco formas, y elegir mal es la mitad del problema. La pregunta que decide es
**qué clase de cosa es la verificación**, no cuánto trabajo ahorra.

| Si… | Va como | Ejemplo del repo |
|---|---|---|
| es una afirmación determinista sobre el código o su salida | **test** | `bundle-panel.test.ts`, `clases-de-bug.test.ts` |
| es una secuencia de comandos con una **decisión adentro** que hay que poder probar | **script** (+ su test) | `que-deployar.sh`, `verificar-bundle.sh` |
| tiene que ocurrir en un momento fijo del flujo, sin que nadie se acuerde | **hook** que llama a un script | `githooks/pre-push` → `verificar-todo.sh` |
| es un procedimiento que **modifica archivos** siguiendo pasos fijos, y el porqué está en la conversación | **skill** | `cerrar-cambio`, `campo-nuevo` |
| es buscar la **instancia nueva** de un patrón conocido, con criterio y sin tocar nada | **auditor** (agente de solo lectura) | los tres de `.claude/agents/` |

Cuatro reglas que salieron de equivocarse acá:

- **Un test le gana a un auditor** siempre que se pueda escribir. Es más rápido,
  no cuesta tokens, corre en el CI y no se olvida. El auditor es para lo que un
  test **no puede** ver: el campo que nadie decidió, el trigger nuevo, la doc
  que dejó de ser cierta.
- **Un auditor que repite lo que un test ya verifica es peor que nada**: da
  falsa sensación de cobertura. Si escribís el test, **sacá la línea del
  auditor** y decilo en `docs/13-agentes.md`.
- **La lógica no va dentro del hook ni dentro del YAML.** Va en un script que se
  puede correr a mano y testear; el hook y el workflow solo lo llaman.
- **Preferí la verificación sobre la clase, no sobre la instancia.** Un test que
  afirma "`calendarEventId` no se pisa" protege ese campo; uno que afirma "ningún
  campo que escribe una Function viaja por el formulario" protege la categoría.
  Derivá la lista del código (los campos, los triggers, las formas del formato)
  en vez de escribirla a mano: así lo nuevo entra solo.

## 3 · Cuándo NO automatizar

Automatizar algo que pasa una vez es costo puro: el código nuevo hay que
leerlo, mantenerlo y desconfiar de él para siempre. Se **anota y no se
automatiza** cuando:

- **Pasó una sola vez** y no hay motivo para esperar la segunda. Anotalo en el
  backlog; si vuelve, ahí sí.
- **El error es ruidoso y barato.** Si falla fuerte y se arregla en un minuto,
  la automatización no compra nada.
- **El chequeo se podría satisfacer sin arreglar nada.** Un chequeo con una
  lista de excepciones que va a crecer da falsa cobertura: es peor que no
  tenerlo. Si no se puede escribir de forma que falle de verdad, es un auditor o
  no es nada. (Un *ratchet* —lista cerrada, con dueño y número de backlog por
  línea, que solo puede achicarse— es la excepción, y hay que decir que lo es.)
- **Necesita credenciales o red que un agente no debe tener** (el PAT, la key de
  la service account, la URL del ICS del calendario, `gcloud` autenticado). Eso
  es trabajo del dueño y va a la sección "pendiente de acción manual" del
  backlog. B-116 y B-123 son eso.
- **El código que verificaría todavía no existe.** No se puede escribir un
  auditor del sitio público antes del sitio público (B-122).
- **Ya lo verifica otra cosa.** Buscá primero: `docs/13-agentes.md` tiene la
  lista de lo que se decidió **no** automatizar y por qué.
- **La automatización tardaría más que el trabajo que ahorra en un año.** Decilo
  con números, aunque sean gruesos.

## 4 · Proponer, y recién después construir

Presentá cada candidato así, en una tabla corta antes de escribir una línea:

```
Candidato · qué se hace a mano hoy
Veces que ya pasó · con el rastro (commit, B-xx, H-x)
Forma propuesta · test / script / hook / skill / auditor, con el motivo
Qué deja de poder romperse · en una línea
Qué NO cubre · en una línea (esto es obligatorio: sin esto la propuesta miente)
Costo · líneas nuevas y dónde
```

Con la aprobación del usuario, construí **de a uno**. Y al construir:

- si es un test, tiene que **fallar antes de existir el arreglo**: verificalo
  quitándole el `.fails` (o rompiendo a propósito lo que verifica) y mirando que
  se ponga rojo por el motivo correcto, no por un error de tipeo;
- si es un script, va con su test y con guardas de entorno en las dos
  direcciones cuando toque datos (`seed-emulador` aborta si el host no es local,
  `preparar-produccion` aborta si ve variables de emulador);
- si es un hook, **no lo activés**: `core.hooksPath` es config del clon de cada
  uno. Documentá el comando;
- si es un skill o un auditor, **parseá el frontmatter antes de confiar en él**:
  un `": "` sin comillas en la `description` hace inválido el YAML y el archivo
  se ignora entero, sin ningún error visible. Ya pasó.

Cerrá con `cerrar-cambio`: doc, CHANGELOG y backlog en el mismo cambio. Y si lo
que construiste cubre una clase entera que un auditor miraba, **sacala del
auditor** — el valor de los auditores es lo que los tests no pueden ver.
