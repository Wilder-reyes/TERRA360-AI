# Rotaciones de demo, selección de terrenos y textos para el agricultor

Complementa a [06-catalogo-cultivos-costa.json](06-catalogo-cultivos-costa.json): 13 cultivos, porque el frijol se separó en canario/invierno y castilla/verano.

---

## 1. Hallazgo para el pitch (hipótesis que conviene verificar con datos)

> **El pico de siembra del maíz amarillo duro en Lima es ago–oct** (DRA Lima: 1 292 / 913 / 757 ha en ago, set y oct de 2025). Con un ciclo de ~145 días, su etapa de **mayor consumo de agua (Kc 1,20)** cae entre **oct y dic**. Esos son justo los **últimos meses de estiaje**, antes de que lleguen las avenidas de la sierra en dic–ene.

Si los caudales de ANA (boletín DRA Lima, sección XII) y la lluvia de IMERG en la cuenca alta lo confirman, esta es la **historia central del pitch**: *«tu maíz tiene más sed justo cuando el río trae menos agua»*. Hay que verificarla con el cálculo real antes de afirmarla.

## 2. Plantillas de rotación para la demo (24 meses, desde agosto)

Sirven para probar el motor y como respaldo si la generación automática no queda lista.

| Estrategia | Secuencia (meses de siembra → cosecha) | Lógica |
|---|---|---|
| **S0 Actual típica** (maíz tras maíz) | MAD (ago→dic) · *pelado* ene–feb · MAD (mar→jul) · *pelado* ago · MAD (set→ene) … | Monocultivo de cereal, 2–3 meses pelado al año, pico de agua en estiaje |
| **S1 «Agua»** | MAD de verano (ene→may, aprovecha las avenidas) · frijol canario (jun→set, ciclo corto, invierno fresco) · brócoli/col (oct→dic) · se repite cada año | Saca la campaña de mayor sed del estiaje y usa cultivos cortos de menor demanda cuando el río baja. 3 familias, sin meses pelados |
| **S2 «Suelo»** | MAD (ago→dic) · frijol castilla (ene→mar, verano, fija N) · zanahoria (abr→jul) · vainita (ago→oct) · MAD (nov→mar) … | Sin meses pelados, 2 leguminosas en 24 meses (1 por año), 3 familias distintas (corta plagas). *Trade-off:* el maíz de agosto sigue en estiaje |
| *Opcional S3 «Descanso productivo»* | Alfalfa 2 años → MAD | Máxima mejora de suelo (raíz profunda, N, cobertura) pero **mucha agua todo el año**. Muestra el *trade-off* |

> El motor debe **calcular** el puntaje de cada una (agua en estiaje, meses sin cubierta, leguminosas, familias, calor) y **no fijarlo a mano**. La tabla solo garantiza que la demo tenga casos con contraste.

## 3. Cómo elegir los terrenos de ejemplo (2 en Huaral + 2 en Barranca)

**Qué se necesita:** el polígono de un campo agrícola real visto en la imagen satelital del mapa. **Lo hace mejor una persona del equipo en 5 minutos por terreno**: yo no puedo ver la imagen satelital desde aquí, y el padrón de sectores de MIDAGRI no respondió hoy (el SIEA redirige a su portafolio).

Criterios para cada terreno:
1. **Dentro del valle agrícola:** Huando o Aucallama para Huaral; los valles Pativilca o Supe para Barranca. Cerca del centroide del sector MIDAGRI que use el chat del repo.
2. **Cultivo de ciclo corto, no frutal.** En la imagen se ve **sin árboles en hileras**; en distintas fechas aparece a veces verde y a veces pardo.
3. **Tamaño de 1 a 5 ha.** Polígono simple de 4–6 vértices, **dibujado unos 10 m hacia dentro del borde** para no mezclar caminos ni acequias en los píxeles.
4. **Contraste entre los dos terrenos de cada zona:** uno que se vea **pelado varias veces al año** (caso S0 claro) y otro con **cobertura más continua**.
5. Guardar el GeoJSON con el nombre `huaral-1`, `huaral-2`, `barranca-1` y `barranca-2`, más una nota: *«Terreno representativo identificado en imagen; no corresponde a un agricultor identificado.»*

Verificación rápida: pasar cada polígono por la nueva serie NDVI mensual. Si **no se ven al menos 3 o 4 campañas** (picos) en 5 años, descartarlo y elegir otro.

## 4. Textos para el agricultor (español sencillo, listos para la interfaz)

**Pantalla 2: Mi rotación actual**
- Título: **«Así ha estado tu terreno en los últimos años»**
- Leyenda: 🟩 *Con cultivo* · 🟫 *Terreno sin cultivo* · ⬜ *Sin foto del satélite (nubes)*
- Pie: *«Lo vemos desde el satélite. Puede equivocarse: dinos qué sembraste en cada campaña.»*
- Pregunta por campaña: **«Entre {mes} y {mes} hubo un cultivo. ¿Qué sembraste?»**, con botones de cultivos y la opción «No me acuerdo».

**Pantalla 4: Compara**
- Título: **«Tu forma de sembrar y dos ideas para cuidar tu suelo y tu agua»**
- Etiquetas: **«Lo que haces hoy»** · **«Idea 1: gasta menos agua cuando el río baja»** · **«Idea 2: tu suelo siempre cubierto»**
- Aviso fijo: *«Son ideas para conversar, no órdenes. Revísalas con un técnico de la Agencia Agraria o de tu Junta de Usuarios antes de decidir.»*

**Ficha «¿Por qué?»: plantilla (rellenada por el motor)**
1. **¿Por qué te lo sugerimos?** *«Tu terreno quedó sin cultivo {N} meses al año y tu maíz pide más agua en {meses}, cuando el río suele traer menos.»*
2. **¿En qué nos basamos?** *«Fotos del satélite {HLS/Sentinel-2} de {fecha} a {fecha}; clima de NASA POWER ({años}); lluvia de la sierra de NASA GPM; calendario de siembras de MIDAGRI.»*
3. **¿Qué podrías ganar?** *«Hasta {X} % menos agua entre mayo y noviembre (comparado con lo que haces hoy) · {N} meses más con el suelo cubierto · el frijol deja nitrógeno para el siguiente cultivo.»*
4. **¿Qué no sabemos?** *«No conocemos el análisis de tu suelo, tu turno de riego real, la variedad que usas ni el precio de la próxima campaña.»*
5. **¿Qué debes revisar con un técnico?** *«Plagas del nuevo cultivo, salinidad del suelo, si hay comprador y si tienes la maquinaria o la mano de obra.»*

## 5. Glosario corto («¿Qué significa?»)
- **Rotación:** cambiar el cultivo de una campaña a otra en el mismo terreno.
- **Leguminosa:** plantas como el frijol, el pallar o la arveja, que toman nitrógeno del aire y dejan el suelo más fértil.
- **Estiaje:** meses en que el río trae poca agua (aprox. de mayo a noviembre en Lima).
- **Verdor del terreno (NDVI):** medida del satélite que indica cuánta planta verde hay. No dice si la planta está sana.
- **Evapotranspiración:** agua que el cultivo y el suelo pierden hacia el aire. Indica cuánta agua necesita el cultivo.
