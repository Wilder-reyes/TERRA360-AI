# Protocolo de validación con agricultores — TERRA360 AI

Objetivo: comprobar comprensión y capacidad de decisión, no solo que el software compile.

## Muestra mínima inicial

Reclutar voluntariamente 5 participantes con experiencia agrícola práctica, sin exigir conocimientos informáticos. Explicar el carácter experimental, no solicitar DNI ni ubicaciones personales exactas, y obtener consentimiento antes de recopilar cualquier dato. No convertir la participación ni la aceptación de una propuesta en garantía de aptitud agrícola.

## Tareas de prueba (moderador no da pistas)

1. Abre la web en un teléfono y encuentra en el mapa una zona agrícola que conozcas.
2. Marca una zona aproximada con el control de rectángulo. Indica si entiendes que la figura representa una referencia dibujada, no un levantamiento técnico.
3. Selecciona Lluvia y explica con tus palabras qué se está midiendo y qué no.
4. Busca un cultivo por nombre, indica si te parece compatible o todavía falta información.
5. Selecciona dos o tres cultivos, indica una práctica anterior y solicita la comparación de opciones.
6. Explica qué decidirías, por qué y qué información tendrías que verificar localmente.

## Indicadores de éxito

- 4 de 5 pueden identificar la selección de parcela sin ayuda.
- 4 de 5 distinguen una observación regional de una medición realizada en su propio terreno.
- 4 de 5 pueden encontrar cultivos usando el buscador.
- 4 de 5 explican la diferencia entre «Lo que siembras actualmente» y «Otra forma de organizar tus cultivos».
- Ninguno interpreta «Agua y suelo: lo que debemos revisar» como una tercera recomendación agrícola validada.
- Ninguno necesita abrir rutas JSON, documentación de programación ni códigos S0/S1/S2.
- Se registran obstáculos, tiempos aproximados y frases que generan confusión, sin incluir datos personales identificables.

## Verificación funcional adicional

- Verificar que Netlify sirva el frontend y enrute `/api/*` a Render.
- API de salud, catálogo, evaluación y fuente NASA POWER: respuestas reales, con errores comprensibles.
- Navegación móvil, alternativas a controles de mapa, teclado, textos legibles y accesibilidad.
- Comprobar límites de servicio gratuito y comportamiento cuando Render despierta.
- No habilitar GPM sin cache, protección de recursos y uso seguro del token.
- Comparar datos con la documentación NASA y realizar validación agronómica antes de recomendaciones de calendario, agua o productividad.

Los resultados se documentarán al realizar las sesiones. **No se afirma que se hayan hecho entrevistas ni pruebas con agricultores en la iteración actual.**
