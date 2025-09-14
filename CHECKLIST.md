# CHECKLIST del Proyecto – “Transformación Halloweenia”

- Información general:
  - Modalidades a combinar: imagen + narrativa (opcional) + sonido (más adelante).
  - Herramienta IA objetivo: Nano Banana (Gemini Image Generation).
  - Entregable PDF: enlace a pieza, descripción (≤300 palabras), herramientas utilizadas.

## Fase 0 — Base y seguridad
- [x] Archivo `README.md` con instrucciones de ejecución.
- [x] Añadir `.env` y cargar `GEMINI_API_KEY` de entorno (cuando se integre IA).

## Fase 1 — MVP sin sonido (primera implementación)
- [x] Subir imagen y previsualizar (`#userImage`, `#previewImage`).
- [x] Selector de disfraz controla temática Halloween.
  - [ ] Opción A (sin backend): filtros/overlays en frontend JS/CSS por disfraz.
  - [x] Opción B (con backend): integración real con Gemini (requiere API Key).
- [x] Botón “Transformar” que aplica la temática.
- [x] Ocultar elementos de sonido temporalmente (sin eliminar del código).
- [x] Mostrar `#transformedImage` con la estética aplicada.

## Fase 2 — Integración IA (Nano Banana/Gemini)
- [x] Backend Python (Flask) con endpoint `POST /transform`.
- [x] Llamada a Gemini Image Generation con prompt por disfraz.
- [x] Guardado de imagen generada en `results/` y devolución de URL.
- [x] Manejo de errores y tiempos de espera.

## Fase 3 — Sonido (reintegración)
- [x] Mapear selector de sonido a `static/sounds/*.mp3`.
- [x] Devolver `sound_url` desde backend o usar assets locales.
- [x] Botón/auto reproducción según UX.

## Fase 4 — Animación (opcional en etapas)
- [x] Fase 1: animación ligera en frontend (canvas/CSS) y exportación WebM.
- [x] Fase 2: explorar API de video generativo.

## Fase 5 — Narrativa (opcional pero creativo)
- [x] Texto breve generado por IA describiendo el álter ego Halloween del usuario.
- [x] Mostrar en `#results`.

## Fase 6 — Entregable PDF
- [x] Generar PDF con enlace, descripción y herramientas utilizadas (ReportLab).
- [x] Incluir capturas de la pieza y créditos.

## Fase 7 — Pulido y despliegue
- [ ] Mejoras de UI/UX.
- [ ] Optimización de estáticos e imágenes.
- [ ] Despliegue y enlace final.

## Firestore — Configuración y uso
- [x] Crear proyecto en Google Cloud y habilitar Firestore (Native mode).
- [x] Crear cuenta de servicio con rol mínimo: `Cloud Datastore User` (o `Firebase Admin` si usas Firebase)
- [x] Descargar archivo JSON de credenciales (p.ej. `gcp-sa-key.json`).
- [x] Exportar variable de entorno en el sistema:
  - Linux/macOS: `export GOOGLE_APPLICATION_CREDENTIALS="/ruta/absoluta/gcp-sa-key.json"`
- [x] Instalar dependencias: `pip install -r requirements.txt`
- [x] Iniciar servidor Flask: `python app.py`
- [x] Probar `/health` y verificar `firestore: true`.
- [x] Probar flujo:
  - `POST /upload` con `image` (multipart) devuelve `image_url`.
  - `POST /transform` con `image_url` y `disfraz` registra doc y devuelve `transformed_image_url`.
- [ ] Agregar índices/reglas según crecimiento (opcional).
