# CHAKRA — recorrido agrícola de tres pasos (rama de desarrollo)

## Experiencia objetivo

1. **Delimitar:** iniciar sobre el mapa interactivo con la parcela de estudio de Barranca; el agricultor también puede buscar cualquier lugar, dibujar un terreno válido o importar un contorno GeoJSON.
2. **Cultivos y zonas:** delimitar subzonas, elegir cultivos con tarjetas y registrar el mes de cada siembra. La superficie restante se mantiene como zona independiente. Los cultivos son información proporcionada por el agricultor, nunca etiquetas inferidas de NDVI.
3. **Plan por zonas + PDF:** recibir para cada zona un próximo cultivo **para evaluar**, una fecha orientativa y pasos de preparación. Imprimir en A4 el croquis del terreno, las zonas, las superficies, los cultivos y las instrucciones.

Los detalles NASA y las herramientas agronómicas avanzadas están disponibles de manera opcional, sin ocupar el recorrido principal.

## API

POST /api/rotation/spatial-plan

~~~json
{
  "polygon": {"type":"Polygon","coordinates":[[[-77.740,-10.702],[-77.738,-10.702],[-77.738,-10.700],[-77.740,-10.700],[-77.740,-10.702]]]},
  "zones": [
    {"id":"Zona 1","crop_id":"maiz_amarillo_duro","planted_month":"2026-01","polygon":{"type":"Polygon","coordinates":[[[-77.740,-10.702],[-77.739,-10.702],[-77.739,-10.700],[-77.740,-10.700],[-77.740,-10.702]]]}},
    {"id":"rest","crop_id":"camote","planted_month":"2026-05"}
  ]
}
~~~

La respuesta incluye la superficie total, recomendaciones con fecha y tareas por zona, procedencia de la información, alcance y límites. El servidor utiliza Shapely y pyproj para comprobar geometría y calcular superficies, impide zonas superpuestas o exteriores y calcula el remanente geográfico.

## Alcance de la evidencia

- **NASA HLS:** el modelo histórico entrenado se aplica únicamente a la parcela original de Barranca. Su objetivo es vegetación baja observada, no reconocimiento de cultivos, rendimiento o salud.
- **NASA POWER:** cuando se obtiene su climatología regional, permite estimar comparaciones relativas de demanda de agua de referencia mediante FAO-56. La malla regional difiere de un medidor en la chacra.
- **DRA Lima/MIDAGRI:** aporta una referencia de temporada únicamente al entorno estudiado de Barranca, sin extrapolación a otras regiones.
- **Otras localidades:** pueden delimitarse, asignar cultivos por zonas y generar el PDF. El motor general utiliza familias de cultivos, duraciones de catálogo y fechas declaradas; indica que la fecha propuesta debe confirmarse localmente.
- **Instrucciones:** orientar la preparación de suelo, selección de variedad, riego y observación de plagas. Dosis, márgenes y rendimientos requieren datos de campo y no se inventan.

## Datos guardados

Se conserva la clave histórica biotex-farm-v1 para recuperar registros anteriores. Los datos nuevos se añaden como zoneCrops sin alterar las siembras antiguas, el contorno y las preferencias. Las parcelas guardadas pueden encontrarse en cualquier lugar.

## Pruebas y publicación

Verificar los tests Python de tests/test_spatial_plan.py, la compilación Vite y las pruebas Playwright del recorrido de tres pasos. Los tests antiguos escritos para cuatro pantallas deberán adaptarse antes de certificar la suite completa.

Publicar primero la ruta del backend en Render y posteriormente el frontend en Vercel, **solo con autorización expresa**. La rama main y la web pública no se modifican durante esta etapa. El repositorio final para la entrega NASA se preparará por separado cuando el usuario lo autorice.
