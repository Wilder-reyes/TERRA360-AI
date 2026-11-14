# Alcance de la primera implementación ML

El usuario confirmó un piloto regional en Perú, selección de cultivos a cargo del proyecto y ausencia de registros propios de campo. Se propone Cusco, comenzando por la referencia de Calca en el Valle Sagrado. La configuración reproducible está en `backend/app/data/agro_pilot.json`.

Los cultivos priorizados son maíz Blanco Gigante del Cusco, papa, haba para grano seco y cebada para grano, con correspondencias ECOCROP explícitas para revisión. La ausencia de alertas de calidad no establece aptitud. El régimen hídrico se mantiene desconocido; no se presume riego o secano de una parcela.

La primera entrega implementa auditoría offline, metadatos del piloto, preparación reproducible de históricos y uso de Chronos-2 preentrenado para estimar la precipitación regional del próximo mes completo. Incluye API, panel del mapa e informe real de Calca. Los pesos son originales; no se entrenó ni ajustó un modelo nuevo.

Erosión y estrés hídrico se mantienen como datos insuficientes. La recomendación agrícola aprendida, la interpretación local de variedades y la validación independiente de campo siguen pendientes. Las alternativas de rotación existentes conservan su alcance estructural.

La comparación retrospectiva de lluvia exige dos bloques de 24 meses y una mejora de MAE de al menos 5 % por bloque frente a la mediana estacional. Sus cuantiles no tienen calibración local. Incluso si supera ese criterio, no pasa automáticamente a decisiones agrícolas. Véase el [método y ejecución real](pretrained-rain-demo.md).

El segundo incremento comparó tres ajustes LoRA con treinta años de históricos, separando entrenamiento, validación y comparación retrospectiva mediante ventanas temporales. Se conserva el modelo original al no alcanzar la mejora de validación exigida. Los periodos de comparación ya se habían examinado previamente y se identifican como retrospectivos, sin presentarlos como pruebas nuevas. [Resultados y reproducción](rain-fine-tuning-experiment.md). La expansión geográfica exigirá comprobar soporte y desempeño fuera de Calca.

El tercer incremento incorpora [aptitud agrícola histórica GAEZ v5](agricultural-suitability.md): mapas regionales para maíz genérico, papa y cebada, con escenarios explícitos. Haba permanece sin capa verificada y Blanco Gigante sin validación específica. Se integran clima, suelo, terreno y disponibilidad hídrica modelada; no se afirma medir humedad actual. La ventana preparada en torno a Cusco no representa un límite administrativo. Continúan pendientes la validación de campo y las recomendaciones agronómicas locales.
