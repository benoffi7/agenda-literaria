# Sistema visual — Brutalismo editorial

> Generado en Stitch y **aprobado por el dueño el 2026-08-31**, después de rechazar
> dos direcciones anteriores por genéricas. Esta es la referencia: se implementa,
> no se rediseña. Las mediciones de contraste al final las hizo el orquestador
> sobre esta paleta, antes de escribir una línea.

## Marca y estilo

Informado por la naturaleza táctil e imperfecta de la efímera cultural impresa en
risografía. Prioriza la estética de **materia impresa**, favoreciendo una
arquitectura de información **densa** por sobre las modas de espacio en blanco. El
objetivo es evocar un programa físico de festival: intencional, cultural,
intelectualmente riguroso.

**Brutalismo editorial:**

- **Densidad.** La información va apretada, para dar escala y urgencia.
- **Fisicalidad.** Reglas finas y grillas visibles estructuran el contenido, como
  las marcas de registro de una imprenta.
- **Autenticidad.** Sin desenfoques, sin sombras, sin degradados. La profundidad
  sale de superponer tintas, no de simular luz.

## Las tintas

Paleta limitada, como una impresión a tintas planas sobre papel sin estucar.

| Tinta | Valor | Para qué |
|---|---|---|
| **Papel** | `#fbf9f4` | el fondo global. **Nunca blanco puro** |
| **Terracota profunda** — primary | `#a7341c` | títulos, fechas y llamados a la acción. Es la tinta principal |
| **Azul tinta** — secondary | `#4f6073` | texto funcional, categorías, secciones que contrastan |
| **Superposición** — tertiary | `#6c575a` | el resultado de multiplicar las dos tintas. Cuerpo denso y reglas |

## Tipografía

La jerarquía tipográfica **es** el elemento estructural de la interfaz.

| Rol | Familia | Tamaño / interlínea | Detalle |
|---|---|---|---|
| `display-lg` | Bodoni Moda | 72 / 64 | peso 800, `tracking -0.02em` |
| `display-lg-mobile` | Bodoni Moda | 48 / 44 | peso 800, `tracking -0.01em` |
| `headline-md` | Archivo Narrow | 32 / 32 | peso 700 |
| `body-md` | Public Sans | 14 / 18 | peso 400 |
| `body-sm` | Public Sans | 12 / 16 | peso 400 |
| `label-caps` | Archivo Narrow | 11 / 12 | peso 600, `tracking 0.05em`, VERSALITAS |

- **Display y títulos:** Bodoni Moda, por su alto contraste y su elegancia
  literaria. En zonas densas se pasa a Archivo Narrow, condensada y utilitaria.
- **Cuerpo:** Public Sans, un grotesco neutro que hace de contrapunto. Chico
  (14px) y con interlínea ajustada, para maximizar densidad.
- **Etiquetas:** Archivo Narrow en versalitas, para metadatos y navegación chica.

## Grilla y espaciado

| | |
|---|---|
| Grilla | 12 columnas en escritorio, 4 en móvil |
| Línea de base | **4px**, y todo el texto se apoya en ella |
| Márgenes | 40px en escritorio (el área segura de impresión de un afiche), 16px en móvil |
| Medianil | 16px |
| Regla | 0,5px |

El ritmo vertical importa más que el espacio en blanco.

## Profundidad

Estrictamente **plano**. Sin sombras, sin desenfoques, sin degradados.

- **Sobreimpresión.** Un bloque de color sobre otro se ve como dos tintas que se
  superponen.
- **Capas tonales.** Un tinte apenas más oscuro del papel separa secciones.
- **Bordes.** La jerarquía sale del grosor y la frecuencia de las reglas: 2pt
  corta una sección mayor, 0,5pt separa un ítem de lista.

## Formas

Lenguaje **filoso**.

- **Radio 0** en botones, campos y contenedores.
- **Bloques de fecha:** rectángulos de tinta plena con el texto **calado** en el
  color del papel.
- Excepción: un radio de 1 o 2px en el contenedor más externo de la página, para
  imitar el redondeo de una hoja física. Lo de adentro va filoso.

## Componentes

- **Filas cronológicas** en lugar de tarjetas. Separadas por una regla fina.
  Primera columna la fecha, segunda el título, tercera la sede y la categoría.
- **Bloques de fecha:** rectángulo de tinta plena, texto en papel.
- **Botones:** texto con un subrayado grueso de 1,5pt, o bloques rectangulares
  macizos. Sin esquinas redondeadas. Al pasar el mouse, la tinta de superposición.
- **Barra de índice:** una lista persistente de categorías, vertical u horizontal,
  con el aspecto del índice de un libro.
- **Campos:** una etiqueta de texto apoyada sobre una regla de 1pt. Sin caja, salvo
  cuando está activo.
- **Casillas:** cuadradas, radio 0, con una **X** maciza en tinta azul al marcarse.

---

## Contraste medido — antes de implementar

Medido con `src/lib/contraste.ts` sobre el papel `#fbf9f4`. **Esto no viene del
sistema de diseño: es la verificación que un sistema de diseño no puede hacer
solo**, y define qué se puede usar dónde.

| Token | Sobre papel | Texto normal (4,5) | Texto grande (3,0) |
|---|---|---|---|
| `on-surface` `#1b1c19` | 16,27:1 | ✅ | ✅ |
| `on-surface-variant` `#58413c` | 8,92:1 | ✅ | ✅ |
| `tertiary` `#6c575a` | 6,34:1 | ✅ | ✅ |
| `primary` `#a7341c` | 6,33:1 | ✅ | ✅ |
| `secondary` `#4f6073` | 6,14:1 | ✅ | ✅ |
| `outline` `#8c716b` | 4,26:1 | ❌ | ✅ |
| `outline-variant` `#e0bfb9` | 1,62:1 | ❌ | ❌ |

**Y el texto calado sobre las tintas**, que es el gesto central:

| Fondo | Papel encima | |
|---|---|---|
| `primary` `#a7341c` | 6,33:1 | ✅ el bloque de fecha entra cómodo |
| `tertiary` `#6c575a` | 6,34:1 | ✅ |
| `secondary` `#4f6073` | 6,14:1 | ✅ |
| `primary-container` `#c84c32` | 4,40:1 | ⚠️ **con el papel**, falla por cuatro centésimas |
| `tertiary-container` `#866f72` | 4,41:1 | ⚠️ ídem |

**Corrección del 2026-08-31, y vale escribirla porque casi manda a evitar una
combinación buena.** Las dos filas de arriba miden **el papel** encima de los
`*-container`, y ese no es el par que el sistema define: para cada uno hay un
`on-*` propio, que es un blanco casi puro (`#fffcff`) y no el papel cálido. Con el
par correcto:

| Fondo | Su `on-*` encima | |
|---|---|---|
| `primary-container` `#c84c32` | `#fffcff` → **4,55:1** | ✅ pasa, incluso en versalitas de 11px |
| `tertiary-container` `#866f72` | `#fffcff` → **4,56:1** | ✅ |

O sea: **los `*-container` sí llevan texto chico, siempre que sea su `on-*` y no el
papel.** La diferencia son quince centésimas y decide entre poder usarlos o no.
Poner papel encima de un `*-container` sigue estando mal.

Y el margen es finito: 4,55 contra un piso de 4,5. **Cualquier retoque de esos dos
tonos hacia el claro los tira abajo del piso**, así que si se ajustan, se vuelve a
medir.

**Las tres reglas que salen de la medición:**

1. `outline` y `outline-variant` son **para reglas y bordes, nunca para texto**.
   `outline-variant` ni siquiera llega al 3:1 de un borde de control.
2. Los dos `*-container` **llevan texto chico solo con su `on-*`** (`#fffcff`),
   nunca con el papel: 4,55:1 contra 4,40:1, y el piso está en 4,5. Ver la
   corrección de más abajo — la primera versión de esta regla decía lo contrario y
   habría hecho evitar una combinación válida.
3. Todo lo demás entra con margen, incluido el bloque de fecha en tinta plena.

**Discrepancia de la fuente:** el YAML de tokens dice `surface: #fbf9f4` y la prosa
dice `Paper #F9F7F2`. Se toma el del YAML, que es de donde salen los tokens. La
diferencia es de 0,28 puntos de contraste y no cambia ningún veredicto.
