---
name: audit
description: Lanza los auditores de este repo (privacidad, trampas, documentación) en paralelo sobre un alcance, junta los hallazgos en una tabla y decide qué frena y qué se anota. Es a pedido — invocalo cuando el usuario diga "/audit", "audita esto", "revisá antes de pushear", "¿está listo?", "pasale los auditores", o cuando vos quieras verificar un cambio antes de darlo por cerrado. Acepta qué auditar (`/audit privacidad`, `/audit todo`) y sobre qué (`/audit HEAD~3`, `/audit src/lib/toPublic.ts`); sin argumentos elige el alcance y los auditores que corresponden. Nada lo dispara solo — ni un hook, ni un gate.
---

# `/audit`

Los tres auditores de este repo son de solo lectura y cada uno mira una cosa que
un test no puede: **si algo privado se escapa a una salida pública**
(`auditor-privacidad`), **si volvió una de las trampas del §13**
(`auditor-trampas`), y **si la doc acompaña al cambio o quedó afirmando algo
falso** (`auditor-documentacion`).

**Este skill es el único camino a los auditores, y corre solo cuando alguien lo
pide** — decisión del dueño del 2026-09-08, que revisa B-124 y D-350. Antes se
disparaban solos (un hook al terminar el turno, otro que frenaba el `git commit`,
y un séptimo paso del gate de push que exigía los tres sellados). Eso se sacó
entero. El racional está en **D-560**; lo que importa acá es la consecuencia
práctica: **nada te va a recordar que corras esto.** Si el cambio toca una salida
pública y nadie invoca `/audit`, no hay red. La contra está asumida.

## 1 · El alcance

Un auditor sin alcance lee el repo entero y devuelve drift viejo mezclado con lo
que acabás de escribir, que es la forma más rápida de que sus reportes se
empiecen a ignorar. Así que **siempre** se le pasa un alcance explícito.

Si el usuario nombró uno, es ése. Si no:

```bash
git status --porcelain                    # ¿hay algo sin commitear?
git log --oneline @{u}..HEAD 2>/dev/null  # ¿y algo commiteado sin pushear?
```

- **Árbol sucio** → el alcance es lo no commiteado. Es el caso normal: se está
  auditando lo que se acaba de escribir.
- **Árbol limpio con commits sin pushear** → el alcance es `@{u}..HEAD` (o
  `main...HEAD` sin upstream). Es el caso de «¿está listo para el PR?».
- **Las dos cosas** → los dos juntos, y decilo, porque el reporte va a mezclar
  dos tandas.
- **Todo limpio y nada pendiente** → no hay nada que auditar. Decilo y pará; no
  inventes un alcance. Si el usuario quiere un barrido del repo entero, que lo
  pida (`/audit todo el repo`), y ahí sí: es una corrida larga y el resultado va
  a ser sobre todo drift histórico.

## 2 · Qué auditores

Preguntale al mecanismo, no lo adivines:

```bash
git status --porcelain | sed 's/^...//' | node scripts/auditores-que-corresponden.mjs
```

Devuelve `privacidad`, `trampas` y `documentacion` en `true`/`false` más los
archivos que disparan cada uno. La lista de disparadores de cada auditor vive en
el `description` de su propia ficha (`.claude/agents/auditor-*.md`) y se lee de
ahí, así que **agregar un productor a un auditor no requiere tocar este skill**.

- `documentacion` corre **siempre** — su disparador es el cambio, no el archivo.
- `privacidad` y `trampas` corren si el alcance toca lo que nombran.
- Si el usuario nombró auditores (`/audit privacidad`, `/audit trampas doc`),
  esos son los que corren, incluso si el mecanismo dice que no corresponden: un
  pedido explícito gana. Decí en el reporte que corriste uno que no aplicaba.
- `/audit todo` corre los tres siempre.

Para un alcance que no es «lo no commiteado», pasale las rutas de ese alcance al
script en vez de las de `git status`:

```bash
git diff --name-only @{u}...HEAD | node scripts/auditores-que-corresponden.mjs
```

**Los que corresponden van en un solo mensaje, con varias llamadas a `Agent`**,
para que corran en paralelo. Son de solo lectura y no se pisan.

## 3 · Qué pasarle a cada uno

Un auditor rinde según lo que sabe del cambio, y lo que sabe se lo pasás vos. El
prompt de cada uno lleva:

1. **El alcance, con el comando para verlo.** Los archivos nuevos son untracked:
   nombralos aparte y decile que los lea directo, porque no salen en `git diff`.
2. **Qué es el cambio**, en dos o tres líneas y en el idioma del pedido, no en
   jerga. El número de ticket y la decisión (`B-xxx`, `D-xxx`) si existen.
3. **Lo que ya sabés que está resuelto.** Si vos ya pisaste una trampa y la
   arreglaste, decilo: sin eso te la reporta como nueva y gastás una vuelta.
4. **Lo que querés con nombre propio.** Un auditor al que le pedís «audita esto»
   devuelve un barrido; uno al que le nombrás tres puntos concretos ataca esos
   tres y además barre. Pedile explícitamente que ataque **tu propio trabajo**:
   el chequeo nuevo que escribiste, el test que puede autodesactivarse.

## 4 · Juntar

Armá **una** tabla, no tres reportes pegados: quien lee quiere una decisión, no
leer tres veces el mismo archivo.

```
| Severidad | Auditor | archivo:línea | Qué pasa | Resolución |
```

- **Un hallazgo que aparece en dos auditores es uno**, con los dos nombres. Los
  auditores derivan entre ellos a propósito (las trampas 4 y 5 son de
  privacidad).
- **Un hallazgo que un test ya frena no es un hallazgo.** Va a una línea aparte,
  «cubierto por `tests/x.test.ts`»: sirve para que nadie escriba un test que ya
  existe, y no es motivo de nada.
- Si un auditor devolvió vacío o con formato raro, **verificá que su ficha
  parsee** antes de creerle: un frontmatter inválido hace que el agente se
  ignore entero y sin error visible. Ver `docs/13-agentes.md`.
- Decí también **qué salió limpio**, y no solo qué falló. Un reporte que solo
  lista problemas no deja saber qué quedó cubierto.

## 5 · Decidir

Los auditores no bloquean nada por sí solos —ya no hay gate que los espere—, así
que la decisión es tuya y se dice explícita.

**Arreglalo antes de cerrar el cambio:**

1. **P0 de privacidad**: algo privado que sale, o una proyección abierta
   (`...actividad`, `JSON.stringify(doc)`) que va a publicar el campo de mañana.
   Publicar es irreversible: es la única categoría donde el falso positivo cuesta
   menos que el falso negativo.
2. **P1 de privacidad**: un campo nuevo del modelo sin las cuatro celdas
   decididas (JSON, Calendar, issue, analítica). «Nadie lo decidió» es la causa
   raíz de las fugas, no un pendiente.
3. **P0 de trampas**: pierde o corrompe datos — eventos borrados, documentos
   pisados, el diff de sesiones roto.
4. **Un `it.fails` que pasa.** Alguien arregló el bug y no promovió el test.
5. **Doc que este cambio volvió falsa.** Es la regla de proceso del `CLAUDE.md`,
   y es la que más se subestima: una decisión que fue revisada y no dice que lo
   fue manda al próximo lector en la dirección equivocada con toda confianza.
   Incluye la entrada del CHANGELOG y el bug que apareció en el camino y no entró
   al BACKLOG.

**Anotalo y seguí:** P1 de trampas cuyo arreglo no es de este cambio, P2 y P3 de
cualquiera, drift de doc que no es del cambio, y «sin red» (una trampa que el
cambio toca y ningún test verifica) — con el `it(...)` que habría que escribir.
Frenar por un test que falta invita a saltear el proceso.

Los avisos que se anotan van con el skill `al-backlog`, que sabe el formato y las
prioridades. No los escribas a mano.

## 6 · Lo mecánico no es de acá

`/audit` es lo que necesita criterio. Lo mecánico —marcadores de conflicto,
typecheck, tests con emuladores, build, fuga de credenciales— lo corre
`./scripts/verificar-todo.sh`, que además es el hook de `pre-push`. **No
reimplementes esos chequeos acá**, y no los des por corridos: si estás cerrando
un cambio, corré el script y leé el resultado.

Un hook de git no puede invocar un modelo, así que las dos mitades no se pueden
unir. Antes el gate exigía que los auditores hubieran corrido; eso se sacó con
D-560, así que hoy son dos cosas independientes: **el gate puede pasar sin que
nadie haya auditado.**
