# Caché simple en memoria: clave (md5_imagen + disfraz) -> ruta resultante
EDIT_CACHE = {}

def _read_upload_bytes_from_url(image_url: str):
    if not image_url.startswith('/uploads/'):
        raise RuntimeError('image_url no apunta a uploads/')
    filename = image_url.split('/uploads/', 1)[1]
    src_path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.isfile(src_path):
        raise FileNotFoundError(f'No existe el archivo fuente: {src_path}')
    with open(src_path, 'rb') as f:
        return f.read(), src_path

def _digest_image_and_disfraz(img_bytes: bytes, disfraz: str, extra: str = "", thematic_bg: str = "") -> str:
    h = hashlib.md5()
    h.update(img_bytes)
    h.update(disfraz.encode('utf-8'))
    if extra:
        h.update(extra.encode('utf-8'))
    if thematic_bg:
        h.update(thematic_bg.encode('utf-8'))
    return h.hexdigest()

def _extract_retry_delay_seconds(err: Exception) -> int | None:

    try:
        import re
        m = re.search(r"retryDelay\'?:\s*'?(\d+)s" , str(err))
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return None

import os
import uuid
import base64
import time
import hashlib
from mimetypes import guess_type
from io import BytesIO
from PIL import Image
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# Integración opcional con Firestore (soporte de proyecto y base nombrada vía entorno)
db = None
try:
    from google.cloud import firestore  # type: ignore
    _fs_project = os.environ.get('FIRESTORE_PROJECT_ID')
    _fs_database = os.environ.get('FIRESTORE_DATABASE_ID')
    if _fs_project or _fs_database:
        kwargs = {}
        if _fs_project:
            kwargs['project'] = _fs_project
        if _fs_database:
            kwargs['database'] = _fs_database
        db = firestore.Client(**kwargs)
        print(f"[Firestore] Cliente inicializado con project={kwargs.get('project')} database={kwargs.get('database')}")
    else:
        db = firestore.Client()
        print(f"[Firestore] Cliente inicializado con configuración por defecto: project={getattr(db, 'project', None)}")
except Exception as e:
    # Si no hay credenciales o librería, seguimos sin DB
    print(f"[Aviso] Firestore no inicializado: {e}")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
RESULTS_FOLDER = os.path.join(BASE_DIR, 'results')
STATIC_FOLDER = os.path.join(BASE_DIR, 'static')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}

load_dotenv()  # Cargar variables desde .env si existe

app = Flask(__name__, static_folder=STATIC_FOLDER)

# Cabeceras de seguridad básicas
@app.after_request
def add_security_headers(response):
    try:
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        # CSP: permitir Google Fonts y el CDN de SweetAlert2 (jsDelivr) para scripts
        csp = "default-src 'self'; " \
              "img-src 'self' data: blob:; " \
              "media-src 'self' data:; " \
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " \
              "font-src 'self' https://fonts.gstatic.com; " \
              "script-src 'self' https://cdn.jsdelivr.net; " \
              "connect-src 'self'"
        response.headers['Content-Security-Policy'] = csp
    except Exception:
        pass
    return response


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# ---- Poem generation helper (Gemini) ----
def _generate_poem_lines(display_name: str, disfraz: str) -> list[str]:
    name = (display_name or "una sombra").strip()
    theme = (disfraz or "fantasma").strip()
    base_fallback = [
        f"{name} camina entre susurros y luna: la noche aprende tu nombre.",
        f"Bajo el signo de {theme}, vibra el aire con metáforas encendidas.",
        "La oscuridad te saluda con elegancia: todo brilla un poco distinto.",
    ]
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        return base_fallback
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        model_name = os.environ.get('GEMINI_TEXT_MODEL', 'gemini-1.5-flash')
        model = genai.GenerativeModel(model_name)
        prompt = (
            "Actúa como poeta en español latino. Escribe exactamente 3 versos libres, uno por línea, "
            "sin numeración ni comillas, máximo 300 caracteres por verso. Tema: Halloween y la figura "
            f"‘{theme}’. Integra el nombre ‘{name}’ de forma sutil y elegante (no lo repitas en todas las líneas). "
            "Tono cinematográfico y metáforas sensoriales. Evita clichés obvios, rimas forzadas, emojis y signos innecesarios. "
            "Devuélveme solo las tres líneas separadas por saltos de línea."
        )
        res = model.generate_content(prompt)
        text = (getattr(res, 'text', '') or '').strip()
        if not text:
            # algunos SDK exponen output_text
            text = (getattr(res, 'output_text', '') or '').strip()
        if not text:
            return base_fallback
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        # Normalizar a exactamente 3 líneas
        if len(lines) >= 3:
            return lines[:3]
        while len(lines) < 3:
            lines.append(base_fallback[len(lines)])
        return lines
    except Exception as _:
        return base_fallback


@app.route('/', methods=['GET'])
def root_index():
    # Servir index.html desde el directorio base del proyecto
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/style.css', methods=['GET'])
def serve_style():
    return send_from_directory(BASE_DIR, 'style.css')


@app.route('/script.js', methods=['GET'])
def serve_script():
    return send_from_directory(BASE_DIR, 'script.js')


@app.route('/gallery.js', methods=['GET'])
def serve_gallery_script():
    return send_from_directory(BASE_DIR, 'gallery.js')


@app.route('/galeria', methods=['GET'])
def serve_gallery_page():
    # Sirve la página de galería
    return send_from_directory(BASE_DIR, 'gallery.html')


@app.route('/health', methods=['GET'])
def health():
    # Proyecto y base configurados por entorno (si aplica)
    env_project = os.environ.get('FIRESTORE_PROJECT_ID')
    env_database = os.environ.get('FIRESTORE_DATABASE_ID')
    client_project = None
    try:
        client_project = getattr(db, 'project', None) if db is not None else None
    except Exception:
        client_project = None

    return jsonify({
        'status': 'ok',
        'firestore': db is not None,
        'firestore_project': client_project or env_project,
        'firestore_database': env_database,
        'gemini_enabled': bool(os.environ.get('GEMINI_API_KEY')),
        'gemini_model': os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast')
    })


@app.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/results/<path:filename>', methods=['GET'])
def serve_result(filename):
    return send_from_directory(RESULTS_FOLDER, filename)


@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'Falta el archivo image'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacío'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Formato no permitido'}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[-1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)
    file.save(save_path)

    image_url = f"/uploads/{unique_name}"

    # Registrar en Firestore si está disponible
    if db is not None:
        try:
            doc_ref = db.collection('transformaciones_halloween').document()
            doc_ref.set({
                'timestamp': datetime.utcnow().isoformat(),
                'original_image_url': image_url,
                'transformed_image_url': '',
                'disfraz': '',
                'estado': 'uploaded'
            })
        except Exception as e:
            print(f"[Aviso] No se pudo escribir en Firestore: {e}")

    return jsonify({'image_url': image_url})


@app.route('/transform', methods=['POST'])
def transform_halloween():
    disfraz = request.form.get('disfraz', '')
    image_url = request.form.get('image_url', '')
    extra_prompt = request.form.get('extra_prompt', '').strip()
    use_thematic_bg = request.form.get('use_thematic_bg', '1').strip() in ('1', 'true', 'True', 'yes')
    display_name = request.form.get('display_name', '').strip()

    # Validación de nombre para la imagen generada (mínimo 5 caracteres)
    if len(display_name) < 5:
        return jsonify({'error': 'display_name es obligatorio y debe tener mínimo 5 caracteres'}), 400

    if not image_url:
        return jsonify({'error': 'Falta image_url (usa /upload primero)'}), 400

    # Generar poema (poem_lines) desde IA o fallback
    poem_lines: list[str] = _generate_poem_lines(display_name, disfraz)

    # Por defecto, usar la misma imagen (fallback)
    transformed_image_url = image_url
    data_url = None
    final_image_bytes = None  # bytes de la imagen resultante para almacenar en Firestore

    # Intentar caché (si tenemos bytes de la imagen)
    img_bytes_for_cache = None
    try:
        img_bytes_for_cache, src_path_for_cache = _read_upload_bytes_from_url(image_url)
        cache_key = _digest_image_and_disfraz(img_bytes_for_cache, disfraz, extra_prompt, 'bg' if use_thematic_bg else 'nobg')
        cached = EDIT_CACHE.get(cache_key)
        if cached and os.path.isfile(os.path.join(RESULTS_FOLDER, os.path.basename(cached))):
            # Cargar bytes desde el resultado cacheado para persistir en Firestore y devolver data_url
            cached_path = os.path.join(RESULTS_FOLDER, os.path.basename(cached))
            try:
                with open(cached_path, 'rb') as f:
                    final_image_bytes = f.read()
                transformed_image_url = ''  # evitamos dependencia del filesystem
                # Data URL provisional; será reemplazado por la versión WebP comprimida más adelante
                try:
                    provisional_mime = guess_type(cached_path)[0] or 'image/png'
                    data_url = f"data:{provisional_mime};base64,{base64.b64encode(final_image_bytes).decode('utf-8')}"
                except Exception:
                    pass
                print(f"[Cache] Usando bytes desde cache {cached_path} para persistir en Firestore")
            except Exception:
                # Si falla, continuamos sin cache y dejamos que el flujo normal intente IA o fallback
                pass
    except Exception:
        pass

    # Intentar integración con Gemini (Nano Banana) si existe GEMINI_API_KEY
    gemini_api_key = os.environ.get('GEMINI_API_KEY')
    if gemini_api_key:
        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=gemini_api_key)

            # Selección de modelo de imagen. Recomendado: 'imagen-3.0-fast' o 'imagen-3.0'.
            model_name = os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast')
            print(f"[Gemini] Modelo seleccionado: {model_name}")

            # Construcción de prompts de EDICIÓN (con/sin fondo temático)
            if use_thematic_bg:
                prompt_map = {
                    'vampire': (
                        "Edit the provided photo. Keep the same person, pose and facial identity. "
                        "Add an elegant black vampire cape over the shoulders (visible collar) and subtle but visible fangs (open lips slightly if needed). "
                        "Apply cinematic red–black lighting grade. Replace the background with a gothic night ambience (castle hints, lamps), softly blurred. Do not replace the person."
                    ),
                    'witch': (
                        "Edit the provided photo. Keep the same person and identity. "
                        "Add a modern witch vibe: soft purple glow, subtle spell particles, and a natural-looking black cloak (optional hat brim). "
                        "Replace the background with a mystical moonlit scene with light fog and shallow depth of field. Do not generate a different person."
                    ),
                    'zombie': (
                        "Edit the provided photo. Keep the same persona and identity. "
                        "Apply glamorous zombie makeup: pale skin tone, shadows under the eyes, faint cracks and veins; a haunting green cinematic effect. "
                        "Replace the background with a spooky look and zombies in the background, softly blurred. Don't replace the person."
                    ),
                    'werewolf': (
                        "Edit the provided photo. Keep the same person and pose. "
                        "Add werewolf features blended over the face: pointed ears peeking through hair, fine fur on cheeks/temples, visible natural fangs with slightly open mouth. "
                        "Replace the background with a moonlit forest vibe with light fog and shallow depth of field. Do not replace the person or identity."
                    ),
                    'ghost': (
                        "Edit the provided photo. Preserve the same person and identity. "
                        "Add ethereal ghostly glow and slight translucency on the subject; cool cinematic atmosphere. "
                        "Replace the background with a dim haunted interior or misty night street, softly blurred. Do not create a new person."
                    )
                }
            else:
                prompt_map = {
                    'vampire': (
                        "Edit the provided photo. Keep the same person, pose and facial identity. "
                        "Add elegant vampire makeup (pale skin tint, subtle red–black grading) and small natural fangs (open lips slightly if needed). "
                        "Preserve the existing background; only adjust global color grading to match the vibe. Do not replace the person."
                    ),
                    'witch': (
                        "Edit the provided photo. Keep the same person and identity. "
                        "Add a modern witch vibe (soft purple glow, subtle spell particles) and an optional black cloak if it fits naturally. "
                        "Preserve the existing background with minimal changes. Do not generate a different person."
                    ),
                    'zombie': (
                        "Edit the provided photo. Keep the same person, pose and identity. "
                        "Apply glamorous zombie makeup: pale skin tint, under-eye shadows, light cracks, faint veins; eerie green cinematic grade. "
                        "Preserve the existing background with minimal adjustments. Do not replace the person."
                    ),
                    'werewolf': (
                        "Edit the provided photo. Keep the same person and pose. "
                        "Add werewolf features blended over the face (ears, fine fur texture, subtle fangs) while preserving identity. "
                        "Preserve the existing background. Do not replace the person."
                    ),
                    'ghost': (
                        "Edit the provided photo. Preserve the same person and identity. "
                        "Add ethereal ghostly glow and slight translucency; cool cinematic vibe. "
                        "Preserve the existing background. Do not create a new person."
                    )
                }
            prompt = prompt_map.get(disfraz, prompt_map['ghost'])
            if extra_prompt:
                prompt = f"{prompt} Additional details: {extra_prompt}"
            print(f"[Prompt] disfraz={disfraz} extra={bool(extra_prompt)} thematic_bg={use_thematic_bg}")

            # Si el modelo es de la familia Imagen, intentamos generate_images
            try:
                if model_name.lower().startswith('imagen'):
                    model = genai.GenerativeModel(model_name)
                    # Backoff para 429: 2 reintentos (total 3 intentos)
                    # 1er reintento: esperar RetryInfo (cap 300s, default 300s)
                    # 2do reintento: esperar 180s
                    attempts = 3
                    last_err = None
                    result = None
                    for i in range(attempts):
                        try:
                            result = model.generate_images(
                                prompt=prompt,
                                number_of_images=1,
                                size='1024x1024'
                            )
                            break
                        except Exception as e:
                            last_err = e
                            msg = str(e)
                            if '429' in msg or 'RESOURCE_EXHAUSTED' in msg:
                                # calcular espera
                                if i == 0:
                                    retry_s = _extract_retry_delay_seconds(e) or 300
                                    retry_s = min(retry_s, 300)
                                elif i == 1:
                                    retry_s = 180
                                else:
                                    break
                                print(f"[Backoff] 429 en generate_images, esperando {retry_s}s (intento {i+1}/{attempts-1})…")
                                time.sleep(retry_s)
                                continue
                            else:
                                raise
                    if result is None and last_err:
                        raise last_err
                    img_b64 = None
                    if hasattr(result, 'images') and result.images:
                        first = result.images[0]
                        if isinstance(first, bytes):
                            img_b64 = base64.b64encode(first).decode('utf-8')
                        elif isinstance(first, str):
                            img_b64 = first
                        elif hasattr(first, 'data'):
                            img_b64 = base64.b64encode(first.data).decode('utf-8')
                    elif hasattr(result, 'generations') and result.generations:
                        gen0 = result.generations[0]
                        if hasattr(gen0, 'image') and hasattr(gen0.image, 'base64_data'):
                            img_b64 = gen0.image.base64_data
                    if not img_b64:
                        raise RuntimeError('No se obtuvo imagen de Gemini (sin datos)')

                    img_bytes = base64.b64decode(img_b64)
                    final_image_bytes = img_bytes
                    print(f"[Gemini] Imagen generada (en memoria)")
                else:
                    # Modelo de la familia Gemini (edición de imagen de entrada)
                    # Patrón según documentación: contents=[prompt, PIL.Image]
                    try:
                        # Abrir imagen con Pillow
                        if img_bytes_for_cache is None:
                            img_bytes_for_cache, src_path_for_cache = _read_upload_bytes_from_url(image_url)
                        image_in = Image.open(BytesIO(img_bytes_for_cache))

                        # Cliente nuevo google-genai
                        try:
                            from google import genai as genai_new  # type: ignore
                        except Exception as _:
                            raise RuntimeError('Paquete google-genai no disponible. Ejecuta pip install google-genai')

                        client = genai_new.Client(api_key=gemini_api_key)

                        # Backoff para 429 en edición: 2 reintentos (total 3 intentos)
                        attempts = 3
                        last_err = None
                        response = None
                        for i in range(attempts):
                            try:
                                response = client.models.generate_content(
                                    model=model_name,
                                    contents=[prompt, image_in]
                                )
                                break
                            except Exception as e:
                                last_err = e
                                msg = str(e)
                                if '429' in msg or 'RESOURCE_EXHAUSTED' in msg:
                                    if i == 0:
                                        retry_s = _extract_retry_delay_seconds(e) or 300
                                        retry_s = min(retry_s, 300)
                                    elif i == 1:
                                        retry_s = 180
                                    else:
                                        break
                                    print(f"[Backoff] 429 en edición, esperando {retry_s}s (intento {i+1}/{attempts-1})…")
                                    time.sleep(retry_s)
                                    continue
                                else:
                                    raise
                        if response is None and last_err:
                            raise last_err

                        # Buscar part con inline_data
                        out_bytes = None
                        parts_count = 0
                        has_inline = False
                        try:
                            parts = response.candidates[0].content.parts
                            parts_count = len(parts)
                            for part in parts:
                                if getattr(part, 'inline_data', None) and getattr(part.inline_data, 'data', None):
                                    out_bytes = part.inline_data.data
                                    has_inline = True
                                    break
                        except Exception:
                            pass

                        if not out_bytes:
                            raise RuntimeError('La respuesta no contiene imagen (inline_data)')

                        final_image_bytes = out_bytes
                        # Data URL provisional (se reemplaza por WebP más abajo)
                        try:
                            data_url = "data:image/png;base64," + base64.b64encode(out_bytes).decode('utf-8')
                        except Exception:
                            data_url = None
                        print(f"[Gemini Edit] Imagen editada (en memoria) | parts={parts_count} inline={has_inline}")
                        # Guardar en caché
                        try:
                            key = cache_key if img_bytes_for_cache is not None else _digest_image_and_disfraz(img_bytes_for_cache, disfraz, extra_prompt, 'bg' if use_thematic_bg else 'nobg')
                            EDIT_CACHE[key] = transformed_image_url
                        except Exception:
                            pass

                    except Exception as ge2:
                        print(f"[Aviso] Edición Gemini falló: {ge2}")
                        # mantenemos fallback (image_url)

            except Exception as ge:
                print(f"[Aviso] Gemini no pudo generar imagen: {ge}")
                # mantenemos fallback (image_url)
        except Exception as e:
            print(f"[Aviso] Integración Gemini no disponible: {e}")

    # Si no hubo bytes de IA (fallback), tomar los bytes de la imagen original subida
    if final_image_bytes is None:
        try:
            if img_bytes_for_cache is None:
                img_bytes_for_cache, src_path_for_cache = _read_upload_bytes_from_url(image_url)
            final_image_bytes = img_bytes_for_cache
        except Exception:
            final_image_bytes = None

    # Convertir a WebP comprimido (<~900 KiB), construir data_url y (nuevo) guardar también en results/ para galería filesystem
    stored_b64 = None
    stored_mime = None
    if final_image_bytes is not None:
        try:
            from io import BytesIO as _BytesIO
            max_side = 1024
            qualities = [80, 70, 60, 50]
            img = Image.open(_BytesIO(final_image_bytes)).convert('RGB')
            w, h = img.size
            scale = min(1.0, max_side / max(w, h))
            if scale < 1.0:
                img = img.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
            webp_bytes = None
            for q in qualities:
                buf = _BytesIO()
                img.save(buf, format='WEBP', quality=q, method=6)
                b = buf.getvalue()
                if len(b) <= 900 * 1024:
                    webp_bytes = b
                    break
            if webp_bytes is None:
                webp_bytes = b
            stored_b64 = base64.b64encode(webp_bytes).decode('utf-8')
            stored_mime = 'image/webp'
            data_url = f"data:{stored_mime};base64,{stored_b64}"

            # Guardar también en filesystem (results/) para que /api/gallery tenga fallback aunque falle Firestore
            try:
                safe_base = ''.join(c.lower() if c.isalnum() or c in ('-','_') else '-' for c in (display_name or 'imagen')).strip('-_') or 'imagen'
                fname = f"{safe_base}-{uuid.uuid4().hex[:12]}.webp"
                out_path = os.path.join(RESULTS_FOLDER, fname)
                with open(out_path, 'wb') as f:
                    f.write(webp_bytes)
                transformed_image_url = f"/results/{fname}"
            except Exception:
                # Si no podemos escribir, mantenemos sólo data_url
                transformed_image_url = ''
        except Exception as _e:
            pass

    if db is not None:
        try:
            doc_ref = db.collection('transformaciones_halloween').document()
            doc_ref.set({
                'timestamp': datetime.utcnow().isoformat(),
                'original_image_url': image_url,
                'transformed_image_url': transformed_image_url,
                'disfraz': disfraz,
                'estado': 'generated_ai' if final_image_bytes is not None else 'themed_local',
                'display_name': display_name,
                'transformed_image_b64': stored_b64 or None,
                'transformed_mime': stored_mime or None,
                'poem_lines': poem_lines
            })
        except Exception as e:
            print(f"[Aviso] No se pudo escribir en Firestore: {e}")

    return jsonify({
        'transformed_image_url': transformed_image_url,
        'data_url': data_url,
        'animation_url': None,
        'sound_url': None,
        'poem_lines': poem_lines,
        'ai_debug': {
            'model': os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast'),
            'changed': transformed_image_url != image_url,
            'mode': 'edit' if os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast').lower().startswith('gemini') else 'generate',
            'use_thematic_bg': use_thematic_bg
        }
    })


# --------- API de Galería (antes de app.run) ---------
@app.route('/api/gallery', methods=['GET'])
def api_gallery():
    """Devuelve una lista paginada de imágenes transformadas.
    Prioriza Firestore; si no está disponible, hace fallback a filesystem en results/.
    Parámetros (Firestore): limit, cursor (timestamp ISO8601)
    Parámetros (FS): limit, offset
    """
    try:
        limit = int(request.args.get('limit', '24'))
    except Exception:
        limit = 24

    # Preferir Firestore si está disponible
    if db is not None:
        try:
            from google.cloud import firestore as _firestore  # type: ignore
            cursor = request.args.get('cursor', '')
            q = db.collection('transformaciones_halloween').order_by('timestamp', direction=_firestore.Query.DESCENDING)
            if cursor:
                try:
                    # Intentar filtrar por timestamp menor al cursor
                    q = q.where('timestamp', '<', cursor)
                except Exception as _:
                    pass
            q = q.limit(limit)
            docs = list(q.stream())
            items = []
            last_ts = None
            for d in docs:
                data = d.to_dict() or {}
                dn = (data.get('display_name') or '').strip()
                b64 = (data.get('transformed_image_b64') or '').strip()
                mime = (data.get('transformed_mime') or 'image/webp').strip()
                img_url = (data.get('transformed_image_url') or '').strip()
                item = {}
                if b64:
                    item['data_url'] = f"data:{mime};base64,{b64}"
                elif img_url:
                    # Intentar leer del filesystem si apunta a /results/
                    if img_url.startswith('/results/'):
                        try:
                            filename = img_url.split('/results/', 1)[1]
                            fs_path = os.path.join(RESULTS_FOLDER, filename)
                            if os.path.isfile(fs_path):
                                with open(fs_path, 'rb') as f:
                                    raw = f.read()
                                _mime = guess_type(fs_path)[0] or 'image/png'
                                item['data_url'] = f"data:{_mime};base64,{base64.b64encode(raw).decode('utf-8')}"
                            else:
                                item['image_url'] = img_url
                        except Exception:
                            item['image_url'] = img_url
                    else:
                        item['image_url'] = img_url
                else:
                    continue
                if dn:
                    item['display_name'] = dn
                # Incluir disfraz para narrativa/sonido en galería
                try:
                    df = (data.get('disfraz') or '').strip()
                    if df:
                        item['disfraz'] = df
                except Exception:
                    pass
                # Incluir poema si fue generado y guardado
                try:
                    pls = data.get('poem_lines')
                    if isinstance(pls, list) and pls:
                        # Asegurar 3 líneas
                        item['poem_lines'] = [str(x) for x in pls][:3]
                except Exception:
                    pass
                # Nombre sugerido para descarga
                try:
                    base = ''.join(c.lower() if c.isalnum() or c in ('-', '_') else '-' for c in dn).strip('-_') or 'imagen'
                    if 'data_url' in item:
                        ext = 'webp' if (mime.endswith('webp')) else (mime.split('/')[-1] or 'png')
                    else:
                        guessed = guess_type(img_url)[0] or 'image/png'
                        ext = (guessed.split('/')[-1] or 'png')
                    item['suggested_name'] = f"{base}.{ext}"
                except Exception:
                    pass
                items.append(item)
                last_ts = data.get('timestamp') or last_ts
            # Si hay items desde Firestore, devolverlos; si no, hacer fallback a filesystem
            if items:
                resp = {'items': items}
                if last_ts and len(items) >= limit:
                    resp['next_cursor'] = last_ts
                return jsonify(resp)
        except Exception as e:
            print(f"[Aviso] /api/gallery Firestore fallo, usando filesystem: {e}")

    # Fallback a filesystem en results/
    try:
        try:
            offset = int(request.args.get('offset', '0'))
        except Exception:
            offset = 0
        exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
        files = []
        for name in os.listdir(RESULTS_FOLDER):
            p = os.path.join(RESULTS_FOLDER, name)
            if os.path.isfile(p) and os.path.splitext(name)[1].lower() in exts:
                files.append((name, os.path.getmtime(p)))
        files.sort(key=lambda x: x[1], reverse=True)
        slice_files = files[offset: offset + limit]
        items = [{'image_url': f"/results/{name}"} for name, _ in slice_files]
        resp = {'items': items}
        if offset + limit < len(files):
            resp['next_offset'] = offset + limit
        return jsonify(resp)
    except Exception as e:
        return jsonify({'items': [], 'error': str(e)}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)