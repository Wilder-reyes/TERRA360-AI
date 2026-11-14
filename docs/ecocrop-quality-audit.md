# Auditoría automática de calidad ECOCROP (v0.10)

El catálogo FAO ECOCROP se conserva **intacto**. La auditoría reproducible identifica
datos faltantes, tipos numéricos inválidos, rangos invertidos, límites óptimos
incompatibles con límites generales y valores fuera de límites físicos **amplios**.

Esta revisión **no** valida especies, variedades, clima local, suelo, rendimiento
ni aptitud agrícola. Los límites son heurísticas conservadoras para priorizar
revisión humana, **no** valores fisiológicos ni umbrales para recomendar cultivos.
Se pueden producir falsos positivos y falsos negativos.

## Ejecutar sin red

Desde la raíz del repositorio:

```bash
python -m scripts.audit_ecocrop --summary-only
python -m scripts.audit_ecocrop --output /tmp/ecocrop-quality.json
python -m unittest tests.test_ecocrop_audit -v
```

La salida completa muestra identificadores de los registros que necesitan revisión,
los nombres científicos originales, los códigos de alerta y el SHA256 de procedencia
registrado en el snapshot. No modifica el dataset ni bloquea la exploración.

**Interpretación:** una alerta significa *revisar el registro y su documentación
original*, nunca reemplazar el valor por una cifra inferida. La ausencia de alertas
no implica que la especie sea apta para ninguna localidad.

**Siguiente validación:** revisión documentada por especialistas agrarios de una
muestra de registros, comprobando definición, unidades, fuente original y variedad.
El siguiente paso geoespacial independiente es importar una capa real de GAEZ v5
con metadatos, licencia, resolución y criterios de manejo específicos.
