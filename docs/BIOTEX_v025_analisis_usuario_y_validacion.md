# BIOTEX v0.25 — análisis de usuario y prueba de campo

## Lo que conocemos frente a lo que suponemos

**Área inicial:** Barranca, Pativilca y Supe. **Público principal:** productores agrícolas de la zona. Este documento describe **hipótesis de diseño** basadas en las necesidades de la aplicación; **NO** afirma que ya hayamos entrevistado a productores.

### Persona de referencia (hipótesis, no participante real)

Productor de unos 40 años, con experiencia en su cultivo, fechas de siembra y turnos de riego. Usa WhatsApp y un teléfono móvil, posiblemente con señal irregular y mucho brillo ambiental. Puede conocer el nombre local de una parcela y el precio de venta aproximado, pero no necesita comprender NDVI, GeoJSON, Kc, ET0 o términos meteorológicos especializados. No suponer que todos los agricultores son iguales, ni que su nivel escolar o competencias digitales dependen de la edad.

### Tareas esenciales que deben completarse sin ayuda externa

1. Seleccionar la parcela de Barranca o buscar su localidad, señalar las esquinas, confirmar que el área parece correcta.
2. Anotar el cultivo y mes que realmente recuerda; la consulta de fotos de NASA es **opcional** y no determina la especie.
3. Elegir solo una prioridad entre agua, suelo o ambos; indicar si el agua le escasea. No formularios largos.
4. Leer en pantalla: **qué cultivo**, **en qué mes**, **por cuánto tiempo**, **por qué se sugiere** y **qué comprobar**.
5. Guardar el terreno o mandar el plan por WhatsApp. Los costos, ANA, SENAMHI y detalles NASA se abren solo a demanda.

### Decisiones UI/UX Pro Max

- El recorrido habitual tiene **cuatro pantallas**, **un CTA principal por pantalla** y lenguaje castellano concreto de uso local.
- Tipografía base 16px; objetivos táctiles 48px o más; contraste alto; sin desplazamiento horizontal; teclado y lector de pantalla.
- No poner al agricultor a interpretar S0/S1/S2, mm de ET0, mapas de humedad de ~9 km o porcentajes sin denominador.
- El beneficio pequeño (<5% de cambio relativo estimado en agua) va etiquetado como **pequeño**, no ahorro real.
- Prioridades, suelo y agua: se explica lo observado vs lo declarado vs lo aún no disponible; no se rellena un vacío con 0.
- Costos y rentabilidad: opcionales, calculados solamente al ingresar sus propios valores por cultivo y por hectárea; precios mayoristas no equivalen a precio en chacra.
- Datos ANA históricos quedan en “Fuentes y detalles”, no se presentan como suministro de la chacra.
- El pronóstico/aviso oficial SENAMHI se abre desde un enlace explícito; no declarar «no hay peligro» si no hubo consulta efectiva.
- Los resultados para lugares fuera de la costa de Lima se abstienen de recomendar una rotación no validada.
- Quechua `qu`: en preparación, NO se activa sin traducción revisada.

### Protocolo presencial mínimo — pendiente de ejecutar

**Reclutamiento:** participantes voluntarios de Pativilca y Supe, diversidad de cultivos, género, nivel de alfabetización digital y sistemas de riego; mínimo 8 para exploración inicial, no muestra representativa. Incorporar al menos 2 ingenieros agrónomos distintos de los desarrolladores. Consentimiento claro antes de observar o registrar. No guardar nombre, documento, número de celular ni ubicación exacta de la chacra en los resultados de pruebas.

**Dispositivo y entorno:** teléfono Android de gama media, iluminación exterior, conexión lenta o intermitente. Para cada tarea medir éxito sin ayuda, solicitudes de aclaración y errores que afectarían una decisión. No orientar al usuario cuando no entiende.

**Preguntas de comprensión, sin lenguaje guiado:**
1. «¿Qué sembrarías primero, según la propuesta?»
2. «¿En qué mes lo harías?»
3. «¿El porcentaje de agua es un ahorro medido o una comparación?»
4. «¿Quién te confirma cuándo tendrás agua?»
5. «¿Cuál es la mayor desventaja de la otra opción?»

**Criterios tentativos de aceptación (ajustables antes del estudio):**
- ≥80% de participantes completan las tareas 1–4 sin intervención.
- ≥80% entiende que las cifras de agua son estimaciones, no promesas.
- 100% de recomendaciones mostradas respetan la regla de no destacar mayor demanda de agua declarada escasa.
- Ningún usuario necesita conocer códigos, NDVI, GeoJSON, S0/S1/S2.
- La sesión deja un problema de uso, su prioridad y una acción de mejora, aunque todo haya salido bien.

**Estado:** la plataforma tiene pruebas automatizadas; la validación **presencial** y la aprobación agronómica **aún no se han realizado**. La prueba de uso no constituye por sí misma evidencia de eficacia del modelo agrícola.

## Validación de suelos, agua y modelos

- Suelo: análisis de laboratorio vinculado a fecha y parcela con **consentimiento** y rangos por especie/variedad revisados por agrónomo; no inferir salinidad o pH desde imágenes satelitales.
- Riego: serie ANA por estación con fecha y caudal/volumen; para disponibilidad de una parcela, documento de la Junta de Usuarios o comisión del sector y método/eficiencia de aplicación. Un promedio de río no es el turno.
- Economía: costos por hectárea, rendimientos históricos, precio **en chacra** y temporada; documentar incertidumbre. Comparador de ingresos menos costos con los datos del usuario no equivale a predicción de rentabilidad.
- ML: script de entrenamiento disponible para **registros reales de campañas con consentimiento**; ninguna predicción de ese modelo se activa en producción antes de superar evaluación con parcelas independientes y revisión agronómica.

## Fuentes y límites
- [ANA SNIRH](https://www.gob.pe/86460-acceder-al-sistema-nacional-de-informacion-de-recursos-hidricos)
- [SENAMHI avisos](https://www.senamhi.gob.pe/?p=aviso-meteorologico)
- [SIEA MIDAGRI](https://www.gob.pe/institucion/midagri/colecciones/94874-reporte-de-ingreso-y-precios-en-el-gran-mercado-mayorista-de-lima-2026)
- [FAO ECOCROP](https://www.fao.org/land-water/resources/tools/databases/ecocrop/en)
- [NASA IMERG mensual v07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07)
- [Cloudflare R2 precios y cuota gratuita](https://developers.cloudflare.com/r2/pricing/)
