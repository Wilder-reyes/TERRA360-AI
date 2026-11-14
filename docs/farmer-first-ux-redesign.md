# TERRA360 AI — Rediseño centrado en el agricultor (requisitos UX)

Estado: especificación aprobada como dirección de diseño; **NO implementada todavía** en v0.7. No confundir estos objetivos con capacidades actuales.

## Objetivo esencial

Una persona que cultiva la tierra debe poder utilizar TERRA360 sin comprender teledetección, formatos informáticos ni nombres internos de algoritmos. La herramienta debe **mostrar primero una interpretación geográfica, después opciones agrícolas comparables, y finalmente una acción concreta y prudente**.

### Prioridad máxima: eliminar S0/S1/S2 de toda la experiencia pública

Los identificadores `S0`, `S1`, `S2` pueden mantenerse en el backend, base de datos, tests y reportes técnicos. **Nunca** deben aparecer en encabezados, botones, tarjetas, leyendas, exportaciones para agricultores, mensajes de error ni guías de usuario.

Etiquetas visibles propuestas (revisar mediante pruebas con agricultores):

| ID interno | Etiqueta pública en español | Explicación en una frase |
| --- | --- | --- |
| S0 | Lo que siembras actualmente | Tu práctica declarada; si no la registraste, indica «Aún no sabemos qué sembrabas». |
| S1 | Otra forma de organizar tus cultivos | Una secuencia que puede servir para comparar, no es necesariamente mejor. |
| S2 | Agua y suelo: lo que debemos revisar | Señala condiciones y datos que faltan; **no** es una estrategia validada de ahorro de agua. |

Nunca presentar S1 como «más productiva» ni S2 como «la mejor» o «ahorra agua» sin estudios y parámetros verificables. **Si el tercer escenario no es una rotación alternativa independiente, no colocarlo como tarjeta aparentemente equivalente**: mostrarlo como comprobación de riesgos y restricciones, separado de las opciones de siembra.

### No mostrar JSON ni jerga informática al usuario

- **Prohibido enlazar a archivos `.json`, rutas `/api/...`, Swagger `/docs`, OpenAPI, formatos crudos, stack traces o mensajes de excepción** desde cualquier pantalla para agricultores.
- Todas las consultas API se hacen en segundo plano; presentar sus resultados en **mapas, gráficos, indicadores con unidades, colores con leyendas y frases comprensibles**.
- Mantener JSON como intercambio interno entre React y FastAPI: no bloquear las rutas que necesita el frontend. Si se requiere limitar el acceso externo a las APIs, diseñar autenticación, caché y permisos sin romper las consultas de la interfaz.
- La documentación técnica y las referencias científicas estarán en un panel «¿Cómo lo sabemos?» accesible bajo demanda y redactado en lenguaje sencillo; los enlaces científicos pueden abrir fuentes originales, **pero nunca deben sustituir el resultado interpretado**.
- Transformar códigos de error técnicos en mensajes orientados a tareas: «No pudimos cargar las lluvias de esta zona. Prueba de nuevo»; no `HTTP 503` ni trazas.
- Indicadores de incertidumbre comprensibles: «Datos disponibles», «Estimación regional», «Necesita comprobación local», «No tenemos datos suficientes». Explicar en una frase por qué.

### El mapa es el centro

- Mapa como elemento principal en escritorio y móvil. Mantenerlo visible durante toda la experiencia.
- Permitir buscar una ubicación, delimitar un área mediante dibujo y editarla.
- Diferenciar el **polígono dibujado por el agricultor (sin validez catastral)** de la **cuadrícula de cobertura de las fuentes NASA**.
- Ofrecer capas activables con leyenda, colores, unidades, fecha, resolución, límites y fuente: lluvia, clima, vegetación, relieve, humedad y suelo **solo cuando estén integradas y verificadas**.
- Cada capa debe aportar una interpretación ligada al terreno marcado y a la próxima decisión. No ofrecer una lista desconectada de botones de consulta en la parte inferior.
- No presentar la mera lista de fechas Sentinel-2 como diagnóstico de vegetación. Calcular y validar realmente índices antes de publicarlos como capas.
- GPM actualmente deshabilitado en el entorno público Render: indicar disponibilidad real y no ofrecer botones que produzcan errores esperables.

### Catálogo de cultivos

- Separar **cultivo que puede encontrarse mediante búsqueda** de **cultivo para el que hay datos suficientes para recomendar**.
- Ampliar catálogo progresivamente con fuentes científicas y públicas verificables (FAO ECOCROP/GAEZ, instituciones agronómicas oficiales y literatura), distinguiendo especie, variedad y alcance geográfico.
- Autocompletar nombres comunes y científicos, facilitar búsqueda en español e inglés, mostrar «No evaluable para esta región» cuando sea necesario.
- No sugerir aptitud agrícola solo porque una especie aparezca en el catálogo, ni extrapolar un coeficiente Kc genérico a una parcela sin validación.

### Recorrido de decisión (sin complejidad innecesaria)

1. **Ubica tu terreno**: mapa, dibujo y capas clave con interpretación legible.
2. **Dinos qué cultivas o quieres cultivar**: catálogo amplio, historial y solo preguntas indispensables; otras entradas aparecen cuando cambian la recomendación.
3. **Compara tus opciones**: encabezados humanos, riesgos, diferencias, explicación basada en evidencia y una siguiente acción concreta.

La recomendación debe responder en el primer bloque: «Qué opciones puedes considerar», «Por qué», «Qué no sabemos», «Qué revisar primero». Evitar presentar tres tarjetas casi idénticas o un ranking arbitrario.

### Ejemplo de comunicación

**No usar:**
> Escenario S2 · not_evaluable · precipitation_total_mm null · feature GPM unavailable.

**Usar:**
> **Agua y suelo: aún falta confirmar información.**
> Los datos regionales muestran cómo ha llovido, pero no indican cuánto riego tiene tu parcela.
> **Qué puedes hacer ahora:** dinos si tienes riego y en qué meses dispones de agua.

### Pruebas de aceptación obligatorias

1. Un agricultor sin formación técnica entiende la comparación sin necesitar que alguien le explique qué significan S0, S1 y S2.
2. No se muestran identificadores de escenarios, JSON, rutas API, códigos de error, acrónimos sin explicar o bibliografía extensa en el flujo principal.
3. Un clic o una selección del mapa devuelve una lectura visual de las capas realmente disponibles y sus limitaciones.
4. Toda visualización geográfica tiene fecha, cobertura, unidad, fuente y leyenda; se distingue la cuadrícula de origen de la delimitación aportada por la persona.
5. La página principal no enlaza a JSON ni a documentación para desarrolladores. Las APIs internas pueden seguir respondiendo JSON para el funcionamiento de React.
6. Nunca se afirma que una opción mejora ingresos, rendimiento, ahorro de agua o salud del suelo sin evidencia específica que lo justifique.
7. Si falta un dato, la interfaz explica por qué importa y qué debe aportar el usuario.
8. Un agricultor puede completar el flujo de manera comprensible desde móvil, con un número reducido de decisiones explícitas.
9. Se verifica en producción con usuarios reales; la aprobación automática de software no sustituye la comprensión de los agricultores.

### No romper durante la migración

Mantener los contratos de la API y los IDs `S0`, `S1`, `S2` mientras otras piezas del sistema dependan de ellos. Implementar primero un adaptador de presentación y luego rediseñar la semántica interna con tests y migraciones controladas.
