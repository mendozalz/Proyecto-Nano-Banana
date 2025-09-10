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
    """Intenta extraer RetryInfo.retryDelay en segundos a partir de la excepción (cuando viene en el JSON del error).
    Formatos típicos: 'retryDelay': '55s' o 'retryDelay': '6s'. Devuelve None si no puede extraer.
    """
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

app = Flask(__name__, static_folder=STATIC_FOLDER)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


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

    if not image_url:
        return jsonify({'error': 'Falta image_url (usa /upload primero)'}), 400

    # Por defecto, usar la misma imagen (fallback)
    transformed_image_url = image_url
    data_url = None

    # Intentar caché (si tenemos bytes de la imagen)
    img_bytes_for_cache = None
    try:
        img_bytes_for_cache, src_path_for_cache = _read_upload_bytes_from_url(image_url)
        cache_key = _digest_image_and_disfraz(img_bytes_for_cache, disfraz, extra_prompt, 'bg' if use_thematic_bg else 'nobg')
        cached = EDIT_CACHE.get(cache_key)
        if cached and os.path.isfile(os.path.join(RESULTS_FOLDER, os.path.basename(cached))):
            transformed_image_url = cached
            print(f"[Cache] Usando resultado cacheado: {transformed_image_url}")
            return jsonify({
                'transformed_image_url': transformed_image_url,
                'animation_url': None,
                'sound_url': None,
                'ai_debug': {
                    'model': os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast'),
                    'changed': True,
                    'mode': 'edit' if os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast').lower().startswith('gemini') else 'generate',
                    'cache': True
                }
            })
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
                        "Edit the provided photo. Keep the same person and identity. "
                        "Apply glamorous zombie makeup: pale skin tint, under-eye shadows, light cracks and faint veins; eerie green cinematic grade. "
                        "Replace the background with a moody abandoned-street night vibe, softly blurred. Do not replace the person."
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
                    out_name = f"{uuid.uuid4().hex}.png"
                    out_path = os.path.join(RESULTS_FOLDER, out_name)
                    with open(out_path, 'wb') as f:
                        f.write(img_bytes)
                    transformed_image_url = f"/results/{out_name}"
                    print(f"[Gemini] Imagen generada y guardada en {transformed_image_url}")
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

                        out_name = f"{uuid.uuid4().hex}.png"
                        out_path = os.path.join(RESULTS_FOLDER, out_name)
                        with open(out_path, 'wb') as f:
                            f.write(out_bytes)
                        transformed_image_url = f"/results/{out_name}"
                        # Construir Data URL (base64) para UX estilo video
                        try:
                            data_url = "data:image/png;base64," + base64.b64encode(out_bytes).decode('utf-8')
                        except Exception:
                            data_url = None
                        print(f"[Gemini Edit] Imagen editada y guardada en {transformed_image_url} | parts={parts_count} inline={has_inline}")
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

    if db is not None:
        try:
            doc_ref = db.collection('transformaciones_halloween').document()
            doc_ref.set({
                'timestamp': datetime.utcnow().isoformat(),
                'original_image_url': image_url,
                'transformed_image_url': transformed_image_url,
                'disfraz': disfraz,
                'estado': 'generated_ai' if transformed_image_url != image_url else 'themed_local'
            })
        except Exception as e:
            print(f"[Aviso] No se pudo escribir en Firestore: {e}")

    return jsonify({
        'transformed_image_url': transformed_image_url,
        'data_url': data_url,
        'animation_url': None,
        'sound_url': None,
        'ai_debug': {
            'model': os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast'),
            'changed': transformed_image_url != image_url,
            'mode': 'edit' if os.environ.get('GEMINI_IMAGE_MODEL', 'imagen-3.0-fast').lower().startswith('gemini') else 'generate',
            'use_thematic_bg': use_thematic_bg
        }
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)