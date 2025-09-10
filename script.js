document.getElementById('userImage').addEventListener('change', function(event) {
    const [file] = event.target.files;
    if (file) {
        document.getElementById('previewImage').src = URL.createObjectURL(file);
        document.getElementById('previewImage').style.display = 'block';
    }
});

// Ocultar controles de sonido temporalmente (sin eliminarlos)
document.addEventListener('DOMContentLoaded', () => {
    const soundSelector = document.getElementById('soundSelector');
    const soundLabel = document.querySelector('label[for="soundSelector"]');
    const halloweenSound = document.getElementById('halloweenSound');
    if (soundSelector) soundSelector.style.display = 'none';
    if (soundLabel) soundLabel.style.display = 'none';
    if (halloweenSound) halloweenSound.style.display = 'none';
});

document.getElementById('transformButton').addEventListener('click', async () => {
    const userImageFile = document.getElementById('userImage').files[0];
    const disfraz = document.getElementById('disfrazSelector').value;
    const loadingMessage = document.getElementById('loadingMessage');
    const aiStatus = document.getElementById('aiStatus');
    const btn = document.getElementById('transformButton');
    const transformedImage = document.getElementById('transformedImage');
    const halloweenAnimation = document.getElementById('halloweenAnimation');
    const imageStage = document.querySelector('.image-stage');
    const themeOverlay = document.getElementById('themeOverlay');
    const extraPromptInput = document.getElementById('extraPrompt');
    const useThematicBg = document.getElementById('useThematicBg');

    if (!userImageFile) {
        alert('Por favor, sube una imagen.');
        return;
    }

    loadingMessage.style.display = 'block';
    if (aiStatus) { aiStatus.style.display = 'none'; aiStatus.textContent = ''; }
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }
    halloweenAnimation.style.display = 'none';

    // No aplicar fallback visual por CSS ni overlays. Mostraremos solo el resultado del backend.
    if (themeOverlay) themeOverlay.style.display = 'none';

    // Conectar con el backend: /upload luego /transform
    try {
        // 1) Subir imagen
        const fd = new FormData();
        fd.append('image', userImageFile);
        const uploadResp = await fetch('/upload', { method: 'POST', body: fd });
        if (!uploadResp.ok) throw new Error(`Upload HTTP ${uploadResp.status}`);
        const uploadData = await uploadResp.json();
        if (!uploadData.image_url) throw new Error('Respuesta de /upload inválida');

        // 2) Registrar transformación (futuro: IA real aquí)
        const transformFD = new FormData();
        transformFD.append('image_url', uploadData.image_url);
        transformFD.append('disfraz', disfraz);
        if (extraPromptInput && extraPromptInput.value) {
            transformFD.append('extra_prompt', extraPromptInput.value);
        }
        if (useThematicBg) {
            transformFD.append('use_thematic_bg', useThematicBg.checked ? '1' : '0');
        }
        const transformResp = await fetch('/transform', { method: 'POST', body: transformFD });
        if (!transformResp.ok) throw new Error(`Transform HTTP ${transformResp.status}`);
        const transformData = await transformResp.json();

        if (transformData.data_url) {
            transformedImage.src = transformData.data_url;
        } else if (transformData.transformed_image_url) {
            transformedImage.src = transformData.transformed_image_url;
        }
        transformedImage.style.display = 'block';
        if (imageStage) imageStage.style.display = 'inline-block';

        // Mostrar estado de IA
        if (aiStatus && transformData.ai_debug) {
            const { model, changed, mode } = transformData.ai_debug;
            aiStatus.style.display = 'block';
            aiStatus.textContent = `IA: modelo=${model} | modo=${mode || 'n/a'} | cambio=${changed ? 'sí' : 'no'}`;
        }
    } catch (err) {
        console.error('Error en flujo backend:', err);
        alert('No se pudo completar la transformación. Intenta nuevamente más tarde.');
    } finally {
        loadingMessage.style.display = 'none';
        if (btn) { btn.disabled = false; btn.textContent = '¡Transformar y Animar!'; }
    }
});