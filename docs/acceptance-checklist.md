# Checklist verificable de aceptación v0.6

**Estado a 13-nov-2026**. Aprobado significa ejecutado realmente con la evidencia indicada.

- [x] Localización opcional inicial: aplicación no consulta NASA ni fija Calca hasta elegir punto (test frontend).
- [x] Favicon de pestaña incluido (test frontend).
- [x] Interfaz de tres pasos y parámetros opcionales bajo desplegables (código fuente + validación TypeScript).
- [x] Búsqueda exhaustiva de rotaciones estructurales con hasta 120 opciones (tests Python).
- [x] Mantener S0 real, no inventar historial; S1 consistente entre interfaz y motor (tests Python).
- [x] Abstención del sistema ante objetivos de agua o ingreso sin mediciones (tests Python).
- [x] Entrada y verificación explícita de mercado, límites de maquinaria y calendario opcional (tests Python).
- [x] Manejo de `null` distinto de lluvia cero y cobertura incompleta (tests Python y frontend).
- [x] Resumen histórico mensual sin inventar «climatología» cuando falta cobertura (tests Python).
- [x] Entrenamiento experimental de lluvia definido con comparación estadística y dos cortes temporales; no se despliega como modelo validado (tests unitarios del pipeline).
- [x] Metadatos de variables y referencias disponibles en JSON.
- [x] 59 tests Python y 6 tests frontend ejecutados en este entorno; TypeScript analizado sin errores.
- [ ] Compilación completa Vite: entorno de esta sesión sin módulo nativo Linux de Rolldown; se debe probar en Windows con `npm.cmd ci && npm.cmd run build`.
- [ ] Experiencia visual real en navegador móvil/escritorio y recorrido completo sin ayuda humana.
- [ ] Consulta en vivo y disponibilidad del punto elegido a NASA POWER y GPM desde la máquina del usuario.
- [ ] Ejecución del experimento predictivo con serie NASA real, reporte de error y pruebas independientes espaciales.
- [ ] Verificación agronómica de calendarios/variedades y cultivos adecuados fuera de la región de referencia.
- [ ] Validación con agricultores de comprensión, utilidad y viabilidad de recomendaciones.
- [ ] Modelos de suministro real de agua, presupuestos e ingresos: no existe evidencia suficiente para afirmar un óptimo.

**No se puede afirmar 100/100 de NASA ni producto validado en campo** hasta completar verificaciones adicionales.
