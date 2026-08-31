# Página de detalle — referencia aprobada

> Generada en Stitch el 2026-08-31, en el mismo proyecto que la home, así que
> hereda las tintas y la tipografía de [`sistema-visual.md`](sistema-visual.md).
> Se implementa, no se rediseña. Abajo, lo que hay que corregir al implementarla.

## Estructura, de arriba abajo

| Bloque | Cómo |
|---|---|
| **Franja de estado** | ancho completo, tinta plena con el texto calado, **arriba de todo** — antes del título. Quien llega de un link viejo tiene que enterarse antes de leer nada |
| **Cabecera** | la etiqueta del tipo en un rectángulo de tinta con el texto calado, y debajo el título en Bodoni display. **Sin foto obligatoria** |
| **Ficha técnica** | barra lateral **pegajosa** con borde de 2px: `<dl>` de cinco filas —Cuándo · Dónde · Arancel · Inscripción · Cupo—, etiqueta en versalitas a la izquierda y valor alineado a la derecha, separadas por reglas finas. El título de la ficha va calado sobre la tinta de superposición |
| **Descripción** | una sola columna legible, con la medida más generosa de todo el sitio |
| **«El Programa»** | los encuentros. Cada uno: **bloque de fecha en tinta plena con el día calado** (día de la semana / número grande / mes), y al lado el número de encuentro en versalitas, el tema en negrita y la lectura en **Bodoni cursiva** |
| **«Cómo se cursa»** | una caja con borde, partida por una regla vertical: presencial con dirección, virtual con la plataforma. **Nunca el link de la reunión** |
| **Material** | lista simple. Con link: acentuado y subrayado. Sin link: en gris, sin adorno. **Sin iconos** |
| **Coordina** | nombre y bio corta, al final, como un colofón |
| **Botón** | bloque macizo, ancho completo, dentro de la ficha |

## Los dos casos difíciles, que salieron bien

**El encuentro cancelado sigue visible.** Fila con opacidad reducida, el número del
día tachado, el título tachado, una regla horizontal que la cruza entera, y el
motivo en su lugar: «CANCELADO, se pasa al 30». No se borra y no se pinta de rojo
de alarma. Es lo correcto: la gente necesita ver que esa fecha se movió.

**El material distingue sin iconos.** El que tiene link va en la tinta principal,
subrayado y grueso; el que no, en gris y sin nada. La diferencia entre «esto lo
podés leer ahora» y «esto te llega al inscribirte» se lee sin candaditos.

## Qué corregir al implementar

1. **Sacar las tres imágenes de relleno.** La referencia mete una grilla de tres
   fotos alojadas en `googleusercontent.com`. No existen en el modelo, son
   externas, y el prompt pedía explícitamente que la página funcionara sin
   ninguna. La actividad tiene **una** portada opcional, o ninguna.
2. **Sacar el link a Material Symbols.** Sigue en el `<head>` aunque no se usa
   ningún icono en el marcado. Es peso muerto y es el archivo que nos devuelve a
   Google.
3. **«Privacidad» en el pie no existe.** Tampoco «Términos». Los enlaces reales son
   Suscribirse al calendario, Sugerir una actividad y Contacto.
4. **`<html lang="en">`** → `es`.
5. **Encabezado con «Suscribirse» dos veces**, como ítem del menú y como botón. Va
   una sola.
6. **Clases fantasma** en el encabezado y el pie: `flat`, `no`, `shadows`,
   `full-width`, `docked` son palabras de la especificación que quedaron escritas
   como clases. No hacen nada.
7. **Clases `dark:`** por todas partes sin una paleta oscura definida. O se define,
   o se sacan.
8. **`transition-all duration-0`** se contradice.
9. **Error de contenido:** el encuentro 3, el cancelado, muestra el título del
   encuentro 4. En los datos reales el cancelado puede no tener tema.
10. **La barra lateral usa `top-24`**, que no está atado a la altura real del
    encabezado. Si el encabezado cambia, la ficha queda tapada o flotando.

## Lo que sí verifiqué, y estaba bien

Los tres usos de `primary-container` con texto calado —la franja de estado, la
etiqueta del tipo y el botón— dan **4,55:1** con su `on-primary-container`
(`#fffcff`) y **pasan** el piso de 4,5, incluso en las versalitas de 11px.

Una advertencia anterior de este repo decía lo contrario porque medía **el papel**
encima del container (4,40:1) en vez del `on-*` que el sistema define. La
corrección está en [`sistema-visual.md`](sistema-visual.md). El margen es de cinco
centésimas: si alguna vez se aclaran esos dos tonos, se vuelve a medir.
