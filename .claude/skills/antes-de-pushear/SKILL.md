---
name: antes-de-pushear
description: Lanza los tres auditores del repo en paralelo (privacidad, trampas y documentación), junta los hallazgos y decide si el push sale o no. Invocalo antes de cualquier push o PR, cuando el usuario diga "pusheá", "subilo", "abrí el PR", "/antes-de-pushear" o pregunte si está listo para pushear. Complementa al hook de git, que corre los pasos mecánicos y no puede invocar un modelo.
---

# Antes de pushear

El pedido era que **los auditores prevengan antes de pushear, y que se lancen
todos**. Eso se parte en dos, porque son dos cosas distintas:

| | Quién lo hace | Qué verifica |
|---|---|---|
| **Mecánico** | `githooks/pre-push` → `scripts/verificar-todo.sh` | marcadores de conflicto, typecheck, tests con los emuladores arriba, build, fuga de credenciales |
| **Con criterio** | este skill | privacidad de un campo nuevo, trampas del §13 en código nuevo, si la doc acompaña al cambio |

Un hook de git **no puede invocar un modelo**, así que la segunda mitad no puede
vivir en el hook. Y un modelo no debería reimplementar lo que un script ya
decide, así que este skill **no** re-verifica lo mecánico: lo corre y lee el
resultado.

## 1 · El gate mecánico

Si el hook está activado (`git config core.hooksPath` devuelve `githooks`),
corre solo en el `git push`. Igual conviene correrlo antes, para no descubrir
el problema con el push a medio hacer:

```bash
./scripts/verificar-todo.sh
```

Tarda unos minutos (los tests corren con los emuladores). Si falla, **pará acá**:
no tiene sentido gastar tres auditores sobre un árbol que no compila.

Si el hook no está activado, decilo y ofrecé el comando de activación —
`git config core.hooksPath githooks` — pero no lo corras sin que el usuario lo
pida: es config de su clon.

## 2 · Los tres auditores, en paralelo

Son de solo lectura, arrancan limpios y no se pisan: van los tres **en un solo
mensaje**, con varias llamadas a la herramienta `Agent`, para que corran a la
vez.

| Agente | `subagent_type` | Cuándo es obligatorio |
|---|---|---|
| Privacidad | `auditor-privacidad` | siempre que el diff toque `src/lib/`, `functions/`, `src/types/`, `firestore.rules`, el build o el bundle |
| Trampas | `auditor-trampas` | siempre que el diff toque `src/lib/`, `src/components/admin/`, `functions/` o las reglas |
| Documentación | `auditor-documentacion` | **siempre** |

Si el diff es solo de `docs/`, `tests/` o `.claude/`, alcanza con el de
documentación más el de trampas (un test nuevo puede tapar un agujero o abrirlo,
y una definición de agente mal escrita se ignora en silencio).

A cada uno pasale el rango del diff que va a viajar en el push:

```bash
git log --oneline @{u}..HEAD     # los commits que se van a pushear
git diff @{u}...HEAD --stat      # y qué archivos tocan
```

Sin upstream (rama nueva), usá `main...HEAD`.

## 3 · Juntar los hallazgos

Armá **una** tabla, no tres reportes pegados: quien lee quiere saber si puede
pushear, no leer tres veces el mismo archivo.

```
| Severidad | Auditor | archivo:línea | Qué pasa | Bloquea |
```

Reglas para juntar:

- **Un hallazgo que aparece en dos auditores es uno**, con los dos nombres. Los
  auditores derivan entre ellos a propósito (las trampas 4 y 5 son de
  privacidad); si igual se duplican, colapsalo.
- **Un hallazgo que un test ya frena no es un hallazgo.** Va a una línea aparte,
  "cubierto por `tests/x.test.ts`". Es información útil (evita que alguien
  escriba un test que ya existe) y no es motivo de nada.
- Si un auditor devolvió un reporte vacío o con formato raro, **verificá que su
  archivo parsee** antes de creerle: un frontmatter inválido hace que el agente
  se ignore entero y sin error visible. Ver `docs/13-agentes.md`.

## 4 · Decidir

**Bloquea el push:**

1. Cualquier paso rojo del gate mecánico.
2. **P0 de privacidad**: algo privado que sale, o una proyección abierta
   (`...actividad`, `JSON.stringify(doc)`) que va a publicar el campo de mañana.
   Publicar es irreversible: es la única categoría donde el falso positivo
   cuesta menos que el falso negativo.
3. **P1 de privacidad**: un campo nuevo del modelo sin las cuatro celdas
   decididas (JSON, Calendar, issue, analítica). "Nadie lo decidió" es la causa
   raíz de las fugas, no un pendiente.
4. **P0 de trampas**: pierde o corrompe datos — eventos borrados, documentos
   pisados, el diff de sesiones roto.
5. **Un `it.fails` que pasa.** Significa que alguien arregló el bug y no promovió
   el test; el CI se va a poner rojo igual, así que mejor enterarse acá.
6. **Falta la entrada del CHANGELOG**, o un bug que apareció en el camino y no
   entró al BACKLOG. Son las dos reglas de proceso del `CLAUDE.md`, y son
   baratas: se arreglan en dos minutos con el skill `cerrar-cambio`.

**No bloquea, se avisa y se anota:**

- P1 de trampas (rompe algo visible sin perder datos) **si el arreglo no es de
  este cambio**: va al backlog con su número y se pushea.
- P2 y P3 de cualquier auditor.
- Drift de documentación que no es del cambio (una afirmación vieja en otro
  archivo): va al backlog, no frena el push. Es exactamente lo que pasó con
  B-118.
- "Sin red": una trampa que el cambio toca y ningún test verifica. Se avisa con
  el `it(...)` que habría que escribir. Frenar el push por un test que falta
  invita a saltear el hook, y un gate que se saltea no protege nada.
- El conteo de tests de la doc quedó viejo. **No se toca**: cambia en cada merge
  y genera conflicto en cuatro archivos a la vez.

## 5 · Cerrar

Si algo bloquea: decí **qué**, **dónde** y **el arreglo mínimo**, y no pushees.
Si el usuario insiste igual, el camino explícito es
`SALTEAR_PRE_PUSH=1 git push` — que lo tipee él, con el motivo escrito en el
mensaje del commit o en el PR.

Si nada bloquea: resumí en tres líneas (qué se auditó, qué salió limpio, qué
quedó anotado en el backlog) y recién ahí pushear.

Los avisos que se anotan van con el skill `al-backlog`, que sabe el formato y
las prioridades. No los escribas a mano.
