# Verificación independiente con NASA POWER — agua de las rotaciones

Fecha: 2026-11-14 · Cálculo: FAO-56 Penman-Monteith mensual (climatología NASA POWER 2001–2020) × curvas Kc del [catálogo](06-catalogo-cultivos-costa.json). Datos completos en [09-referencia-calculo-agua.json](09-referencia-calculo-agua.json). Es una referencia para **validar el motor del repo**, no reemplaza su cálculo.

## 1. ⚠️ Hallazgo técnico crítico: escoger bien la celda de NASA POWER

La grilla meteorológica de POWER es gruesa (~0,5° × 0,625°). En valles costeros estrechos, la celda más cercana puede caer **en la cordillera**:

| Punto consultado | Celda devuelta | Altitud de la celda | T media anual | ¿Sirve? |
|---|---|---|---|---|
| Huando, Huaral (−11,479; −77,180), el centroide del piloto del repo | −77,18 | **2 120 m** | 15,8 °C | ❌ Es cordillera. Tmax plana (~25 °C) todo el año |
| Huaral costero (−11,48; **−77,45**) | −77,45 | **224 m** | 19,3 °C | ✅ Estacionalidad realista (Tmax 26,6 °C en verano, 21,3 °C en agosto) |
| Barranca (−10,754; −77,761) | −77,76 | 786 m | 19,3 °C | ⚠️ Mezcla |
| Barranca costero (−10,75; **−77,90**) | −77,90 | **83 m** | 19,6 °C | ✅ |

**Regla para el motor:** leer `geometry.coordinates[2]` (la altitud de la celda) en la respuesta de POWER. Si difiere más de ~300 m de la altitud del terreno (SRTM), desplazar el punto hacia la costa y repetir. Explicarlo en la ficha «evidencia». Es un argumento de **Validity** muy fuerte ante el jurado: entendemos la escala de los datos.

## 2. Resultados (referencia)

**ET0 mensual (mm/día)**, de enero a diciembre:
- Huaral: 3,98 · 4,04 · 3,95 · 3,48 · 2,79 · 2,40 · 2,44 · 2,60 · 2,88 · 3,18 · 3,45 · 3,60
- Barranca: 3,57 · 3,59 · 3,58 · 3,40 · 2,99 · 2,66 · 2,66 · 2,76 · 3,00 · 3,27 · 3,45 · 3,38

Son valores coherentes con la costa de Lima: alto en verano, bajo en invierno nublado.

**Rotaciones de 24 meses (ago-2025 a jul-2027), demanda del cultivo ETc en mm:**

| Zona | Rotación | ETc total | ETc en estiaje (may–nov) | Días sin cubierta | Leguminosas | Misma familia seguida |
|---|---|---|---|---|---|---|
| Huaral | S0 Maíz tras maíz | 1 491 | 1 023 | 150 | 0 | 3 |
| Huaral | **S1 «Agua»** | 1 755 | **886 (−13 %)** | 88 | 2 | 0 |
| Huaral | **S2 «Suelo»** | 1 951 | 1 013 (−1 %) | **32** | 2 | 0 |
| Barranca | S0 | 1 516 | 1 074 | 150 | 0 | 3 |
| Barranca | S1 «Agua» | 1 738 | **931 (−13 %)** | 88 | 2 | 0 |
| Barranca | S2 «Suelo» | 1 925 | 1 068 (−1 %) | **32** | 2 | 0 |

## 2b. ✅ Historia central CORREGIDA: el mes de siembra decide cuánta agua del maíz cae en estiaje

Corrección del calendario (detectada por el chat del repo): en la campaña 2024-25, el MAD de la región Lima se siembra **todo el año**. El **45,5 %** se siembra en ene–mar y el **21,6 %** en ago–oct (DRA Lima, 12 464 ha en total). Con la ET0 de POWER para Huaral, la parte de la demanda de una campaña de MAD (145 días) que cae en **estiaje (may–nov)** es:

| Siembra | Pico de sed | ETc de la campaña | **% del agua en estiaje** |
|---|---|---|---|
| 15 de enero | mar–abr | 420 mm | **23 %** |
| 15 de febrero (mes de mayor siembra) | abr–may | 366 mm | **51 %** |
| 15 de marzo | may–jun | 328 mm | **79 %** |
| 15 de agosto | oct–nov | 401 mm | **71 %** |
| 15 de setiembre | nov–dic | 433 mm | **39 %** |

**Frase para el pitch (defendible con datos):** *«El mismo maíz puede tomar ¼ o ¾ de su agua en los meses en que el río baja: depende del mes en que lo siembras.»* Por eso la alternativa «Agua» mueve las fechas y no solo los cultivos. Sigue pendiente contrastarlo con los caudales de ANA.

## 3. Qué significa (y cómo decirlo con honestidad)

1. **La historia del maíz se sostiene con los datos de POWER.** Un MAD sembrado el 15 de agosto consume 106, 124 y 106 mm en octubre, noviembre y diciembre: es su pico. La lluvia en la cuenca alta es mínima entre junio y setiembre y recién sube en octubre y noviembre; la avenida llega en dic–mar. ✅ **«Tu maíz tiene más sed en octubre y noviembre, justo al final del estiaje.»** *Pendiente:* confirmar con caudales reales de ANA. El río va con retraso respecto a la lluvia, lo que haría el desfase todavía más marcado.
2. **«Agua» ahorra agua en estiaje, no en total.** S1 pide un 13 % menos entre mayo y noviembre, pero **más agua en total**, porque el terreno pasa menos tiempo vacío (más campañas). El mensaje correcto es *«usa el agua cuando el río la tiene»*, **no** *«ahorra agua»*.
3. **«Suelo» tiene un costo en agua y hay que mostrarlo.** El terreno pasa de 150 a 32 días pelado, con 2 leguminosas y sin repetir familia. Pero pide ~30 % más agua en total. Ese es justo el *trade-off* que el challenge pide explicar en «riesgos».
4. **Límite del cálculo:** no cuenta la evaporación del suelo desnudo ni las malezas en S0, así que el «costo» de S0 está subestimado. Tampoco cuenta la eficiencia del riego ni la lluvia local, que es casi cero.
5. **POWER subestima la lluvia de la sierra.** En la cuenca alta del Chancay da ~110 mm/año, cuando la real es de varios cientos. **Usar POWER solo para la estacionalidad**; las cantidades deben venir de GPM IMERG o PISCO.

## 4. Pruebas sugeridas para el motor del repo (tolerancia ±10 %)
- ET0 de Huaral en enero ≈ 4,0 mm/d y en julio ≈ 2,4 mm/d (celda costera).
- S1 debe tener una ETc en may–nov **menor** que S0 (≈ −13 %).
- S2 debe tener **menos días sin cubierta** que S0 (32 frente a 150) y **2** campañas de leguminosa.
- S0 debe mostrar 3 transiciones de la misma familia.
