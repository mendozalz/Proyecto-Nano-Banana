// Variables globales
let currentImageFile = null;

// Función para manejar la selección de archivo
function handleFileSelect(file) {
    if (!file) return;
    
    // Validar tipo de archivo
    if (!file.type.match('image.*')) {
        showError('¡Ups! Solo se permiten archivos de imagen (JPEG, PNG, etc.)');
        return;
    }
    
    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError('La imagen es demasiado grande. Por favor, selecciona una imagen de menos de 5MB.');
        return;
    }
    
    currentImageFile = file;
    const previewImage = document.getElementById('previewImage');
    const previewContainer = document.getElementById('previewContainer');
    const dropZone = document.getElementById('dropZone');
    
    // Mostrar vista previa
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewContainer.style.display = 'block';
        dropZone.style.display = 'none';
    };
    reader.readAsDataURL(file);
    
    // Mostrar mensaje de éxito
    showSuccess('¡Imagen cargada con éxito!');
}

// Función para mostrar mensajes de error
function showError(message) {
    // Eliminar mensajes anteriores
    const existingAlert = document.querySelector('.alert-message');
    if (existingAlert) existingAlert.remove();
    
    const alert = document.createElement('div');
    alert.className = 'alert-message error';
    alert.innerHTML = `
        <span>⚠️ ${message}</span>
        <span class="close-btn">&times;</span>
    `;
    
    document.body.appendChild(alert);
    
    // Cerrar el mensaje
    const closeBtn = alert.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        alert.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => alert.remove(), 500);
    });
    
    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        if (document.body.contains(alert)) {
            alert.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => alert.remove(), 500);
        }
    }, 5000);
}

// Función para mostrar mensajes de éxito
function showSuccess(message) {
    // Similar a showError pero con estilo de éxito
    const existingAlert = document.querySelector('.alert-message');
    if (existingAlert) existingAlert.remove();
    
    const alert = document.createElement('div');
    alert.className = 'alert-message success';
    alert.innerHTML = `
        <span>🎉 ${message}</span>
        <span class="close-btn">&times;</span>
    `;
    
    document.body.appendChild(alert);
    
    const closeBtn = alert.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        alert.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => alert.remove(), 500);
    });
    
    setTimeout(() => {
        if (document.body.contains(alert)) {
            alert.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => alert.remove(), 500);
        }
    }, 3000);
}

// Inicialización cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('userImage');
    const changeImageBtn = document.getElementById('changeImageBtn');
    const previewContainer = document.getElementById('previewContainer');
    
    // Ocultar controles de sonido temporalmente
    const soundSelector = document.getElementById('soundSelector');
    const soundLabel = document.querySelector('label[for="soundSelector"]');
    const halloweenSound = document.getElementById('halloweenSound');
    if (soundSelector) soundSelector.style.display = 'none';
    if (soundLabel) soundLabel.style.display = 'none';
    if (halloweenSound) halloweenSound.style.display = 'none';
    
    // Manejar clic en el área de drop
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Manejar cambio de archivo
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFileSelect(file);
    });
    
    // Botón para cambiar imagen
    changeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = ''; // Resetear el input para permitir seleccionar el mismo archivo de nuevo
        fileInput.click();
    });
    
    // Arrastrar sobre el área de drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Efecto al arrastrar sobre el área de drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropZone.classList.add('dragover');
    }
    
    function unhighlight() {
        dropZone.classList.remove('dragover');
    }
    
    // Manejar soltar archivo
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        handleFileSelect(file);
    }
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
    const displayNameInput = document.getElementById('displayName');
    const downloadArea = document.getElementById('downloadArea');
    const downloadBtn = document.getElementById('downloadResultBtn');

    if (!userImageFile) {
        alert('Por favor, sube una imagen.');
        return;
    }

    // Validación de nombre obligatorio (mínimo 5 caracteres)
    const displayName = (displayNameInput?.value || '').trim();
    if (!displayName || displayName.length < 5) {
        alert('Por favor, ingresa un nombre para tu imagen (mínimo 5 caracteres).');
        if (displayNameInput) displayNameInput.focus();
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
        transformFD.append('display_name', displayName);
        const transformResp = await fetch('/transform', { method: 'POST', body: transformFD });
        if (!transformResp.ok) throw new Error(`Transform HTTP ${transformResp.status}`);
        const transformData = await transformResp.json();

        let imgSrc = null;
        if (transformData.data_url) {
            imgSrc = transformData.data_url;
            transformedImage.src = imgSrc;
        } else if (transformData.transformed_image_url) {
            imgSrc = transformData.transformed_image_url;
            transformedImage.src = imgSrc;
        }
        transformedImage.style.display = 'block';
        if (imageStage) imageStage.style.display = 'inline-block';

        // Configurar botón de descarga
        if (imgSrc && downloadArea && downloadBtn) {
            const base = (displayName || 'imagen').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagen';
            const ext = transformData.data_url ? 'webp' : (imgSrc.endsWith('.png') ? 'png' : (imgSrc.endsWith('.jpg') || imgSrc.endsWith('.jpeg') ? 'jpg' : 'png'));
            downloadBtn.href = imgSrc;
            downloadBtn.download = `${base}.${ext}`;
            downloadArea.style.display = 'block';
        }

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