// Variables globales
let currentImageFile = null;

// --- Helpers narrativa tipo brochure ---
function generatePoem(disfraz, displayName) {
    const name = displayName || 'tu sombra';
    const poems = {
        vampire: [
            `${name}, entre espejos de medianoche, viste seda y colmillos en silencio, donde la luna guarda promesas rojas.`,
            `En balcones de viento quieto, un susurro antiguo talla tu destino, y las rosas beben estrellas.`,
            `Camina tu elegancia en tinieblas nobles: nadie olvida la danza del eterno invitado.`
        ],
        witch: [
            `${name} enciende círculos de bruma, trenza relámpagos morados y ríe con ojos de luciérnaga.`,
            `El bosque inclina su corona: calderos de luna hierven historias y amuletos despiertan.`,
            `Tu hechizo viaja ligero: donde tocas, la noche aprende a cantar.`
        ],
        zombie: [
            `Late un tambor en la tierra: ${name} regresa con pasos verdes, memoria de polvo y brillo secreto.`,
            `Entre grietas elegantes, la vida firma treguas: ojos de neón, belleza de frontera.`,
            `Camina tu calma de niebla: incluso el silencio quiere vivir otra vez.`
        ],
        werewolf: [
            `Loba/lobo del alba, ${name} aúlla letras de cobre; la noche responde con montañas y piel.`,
            `La luna afila caminos: correr es orar, y cada árbol guarda tu nombre.`,
            `Tu instinto es brújula de fuego: donde miras, despierta el bosque.`
        ],
        ghost: [
            `Como un suspiro que aprendió a caminar, ${name} roza campanas de vapor y ventanas azules.`,
            `Los pasillos beben neblina: tu risa es vela pequeña en océanos dormidos.`,
            `Cruzas paredes de recuerdo: al pasar, la noche se vuelve amable.`
        ]
    };
    return poems[disfraz] || poems.ghost;
}

function renderBrochureWithLines(disfraz, imgSrc, displayName, lines){
    const container = document.getElementById('brochureContainer');
    if (!container) return;
    const deco = emojiFor(disfraz);
    const safeImg = imgSrc || '#';
    const disfrazNames = { vampire: 'Vampiro', witch: 'Bruj@', zombie: 'Zombie', werewolf: 'Hombre Lobo', ghost: 'Fantasma' };
    const nice = disfrazNames[disfraz] || (disfraz?.charAt(0).toUpperCase() + disfraz?.slice(1) || 'Alter Ego');
    const title = `Tu álter ego: ${nice} — ${displayName || 'Sin nombre'}`;
    container.innerHTML = `
      <h3 class="brochure-subtitle">${title}</h3>
      <div class="parchment-bg brochure">
        ${renderPoemWithIcons(lines, disfraz)}
        <div class="brochure-row">
          <div class="brochure-img left" aria-hidden="true" style="overflow:hidden;">
            <img src="${safeImg}" alt="Imagen final" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
          </div>
          <div class="brochure-text"><p></p></div>
        </div>
      </div>`;
    container.style.display = 'block';
}

function emojiFor(disfraz){
    switch(disfraz){
        case 'vampire': return '🦇';
        case 'witch': return '🧙';
        case 'zombie': return '🧟';
        case 'werewolf': return '🐺';
        default: return '👻';
    }
}

function renderBrochure(disfraz, imgSrc, displayName){
    const container = document.getElementById('brochureContainer');
    if (!container) return;
    const lines = generatePoem(disfraz, displayName);
    const deco = emojiFor(disfraz);
    const safeImg = imgSrc || '#';
    // Nombre legible del disfraz para título
    const disfrazNames = { vampire: 'Vampiro', witch: 'Bruj@', zombie: 'Zombie', werewolf: 'Hombre Lobo', ghost: 'Fantasma' };
    const nice = disfrazNames[disfraz] || (disfraz?.charAt(0).toUpperCase() + disfraz?.slice(1) || 'Alter Ego');
    const title = `Tu álter ego: ${nice} — ${displayName || 'Sin nombre'}`;
    container.innerHTML = `
      <h3 class="brochure-subtitle">${title}</h3>
      <div class="parchment-bg brochure">
        ${renderPoemWithIcons(lines, disfraz)}
        <div class="brochure-row">
          <div class="brochure-img left" aria-hidden="true" style="overflow:hidden;">
            <img src="${safeImg}" alt="Imagen final" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
          </div>
          <div class="brochure-text"><p></p></div>
        </div>
      </div>
    `;
    container.style.display = 'block';
}

function renderPoemWithIcons(lines, disfraz){
    const icons = iconPairFor(disfraz);
    const l1 = escapeHtml(lines?.[0] || '');
    const l2 = escapeHtml(lines?.[1] || '');
    const l3 = escapeHtml(lines?.[2] || '');
    return `
      <div class="poem-line-row"><span class="poem-line-icon">${icons[0]}</span><span class="poem-line-text">${l1}</span></div>
      <div class="poem-line-row right"><span class="poem-line-text">${l2}</span><span class="poem-line-icon">${icons[1]}</span></div>
      <div class="poem-line-row"><span class="poem-line-icon">${icons[0]}</span><span class="poem-line-text">${l3}</span></div>
    `;
}

function iconPairFor(disfraz){
    switch(disfraz){
        case 'vampire': return ['🦇','🩸'];
        case 'witch': return ['🧙‍♀️','✨'];
        case 'zombie': return ['🧟','🧠'];
        case 'werewolf': return ['🐺','🌕'];
        default: return ['👻','🕯️'];
    }
}

function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c=>({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
    }[c]));
}

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

// ---- Animación creativa: brasas (canvas) ----
let _embers = null;
function setupEmbers(canvas, imgEl){
    if (!canvas || !imgEl) return;
    const stage = canvas.parentElement; // .image-stage
    const resize = () => {
        const parentRect = stage.getBoundingClientRect();
        const imgRect = imgEl.getBoundingClientRect();
        const left = imgRect.left - parentRect.left;
        const top = imgRect.top - parentRect.top;
        const w = Math.max(10, Math.round(imgRect.width));
        const h = Math.max(10, Math.round(imgRect.height));
        canvas.style.left = left + 'px';
        canvas.style.top = top + 'px';
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width = w;
        canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);
    canvas._cleanupResize = () => window.removeEventListener('resize', resize);
}

function toggleEmbers(canvas, btn, imgEl){
    if (!canvas || !btn) return;
    if (_embers && _embers.running){
        _embers.stop();
        canvas.style.display = 'none';
        btn.textContent = 'Activar brasas ✨🔥';
        return;
    }
    canvas.style.display = 'block';
    btn.textContent = 'Desactivar brasas ✨🔥';
    const ctx = canvas.getContext('2d');
    const maxEmbers = 120;   // más partículas
    const maxSmoke  = 22;    // humo ligero
    const embers = [];
    const smokes = [];
    const rnd = (a,b)=>Math.random()*(b-a)+a;
    function spawnEmber(){
        const w = canvas.width, h = canvas.height;
        const x = rnd(w*0.08, w*0.92);
        const y = rnd(h*0.68, h*0.98);
        const vx = rnd(-0.25, 0.25);
        const vy = rnd(-1.2, -0.35);
        const life = rnd(1.1, 2.6);
        const size = rnd(2.5, 6.0); // más grandes y variados
        embers.push({x,y,vx,vy,life,age:0,size});
    }
    function spawnSmoke(){
        const w = canvas.width, h = canvas.height;
        const x = rnd(w*0.1, w*0.9);
        const y = rnd(h*0.70, h*0.98);
        const vx = rnd(-0.08, 0.08);
        const vy = rnd(-0.35, -0.15);
        const life = rnd(1.8, 3.6);
        const size = rnd(14, 28);
        smokes.push({x,y,vx,vy,life,age:0,size});
    }
    for(let i=0;i<maxEmbers/2;i++) spawnEmber();
    for(let i=0;i<maxSmoke/2;i++) spawnSmoke();
    let last=0, running=true;
    function loop(ts){
        if (!running) return;
        if (!last) last = ts;
        const dt = Math.min(0.05, (ts-last)/1000);
        last = ts;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        // Clip redondeado para no sobreponerse fuera de la imagen con esquinas
        ctx.save();
        roundedClip(ctx, canvas.width, canvas.height, 10);
        // spawn
        if (embers.length < maxEmbers) spawnEmber();
        if (smokes.length < maxSmoke && Math.random() < 0.5) spawnSmoke();

        // flames (flicker band near bottom)
        drawFlames(ctx, canvas);

        // update smoke (detrás)
        ctx.globalCompositeOperation = 'lighter';
        for (let i=smokes.length-1;i>=0;i--){
            const s = smokes[i];
            s.age += dt;
            if (s.age > s.life){ smokes.splice(i,1); continue; }
            s.x += s.vx; s.y += s.vy;
            const t = 1 - (s.age/s.life);
            ctx.save();
            ctx.filter = 'blur(6px)';
            ctx.fillStyle = `rgba(200,200,200,${0.18*t})`;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        // update embers (delante)
        for (let i=embers.length-1;i>=0;i--){
            const p = embers[i];
            p.age += dt;
            if (p.age > p.life){ embers.splice(i,1); continue; }
            p.x += p.vx; p.y += p.vy;
            const t = 1 - (p.age/p.life);
            const r = 255;
            const g = Math.floor(140 + 100*t);
            const b = Math.floor(40*t);
            const alpha = 0.75*t; // más brillo
            // Radial gradient for hotter core
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            grad.addColorStop(0, `rgba(255,255,200,${alpha})`);
            grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha})`);
            grad.addColorStop(1, `rgba(${r},${g-40},${b},${0.0})`);
            ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    _embers = {
        running: true,
        stop(){ this.running=false; },
    };
}

function drawFlames(ctx, canvas){
    const baseY = canvas.height * 0.96; // más abajo
    const topY  = canvas.height * 0.88; // banda más delgada
    const width = canvas.width * 0.9;
    const leftX = canvas.width * 0.05;
    const flicker = (Math.sin(performance.now()/120) + 1) * 0.5; // 0..1
    const flameTop = topY + (1 - flicker) * 8;
    const grad = ctx.createLinearGradient(0, flameTop, 0, baseY);
    grad.addColorStop(0, 'rgba(255,240,180,0.18)');
    grad.addColorStop(0.6, 'rgba(255,180,80,0.14)');
    grad.addColorStop(1, 'rgba(255,100,20,0.06)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    const peaks = 6;
    for(let i=0;i<=peaks;i++){
        const x = leftX + (width/peaks)*i;
        const y = flameTop + Math.sin((i+flicker)*1.7)*6 + (Math.random()*2-1);
        ctx.lineTo(x,y);
    }
    ctx.lineTo(leftX+width, baseY);
    ctx.closePath();
    ctx.fill();
}

function roundedClip(ctx, w, h, r){
    const rr = Math.max(0, r);
    ctx.beginPath();
    ctx.moveTo(rr, 0);
    ctx.lineTo(w-rr, 0);
    ctx.quadraticCurveTo(w, 0, w, rr);
    ctx.lineTo(w, h-rr);
    ctx.quadraticCurveTo(w, h, w-rr, h);
    ctx.lineTo(rr, h);
    ctx.quadraticCurveTo(0, h, 0, h-rr);
    ctx.lineTo(0, rr);
    ctx.quadraticCurveTo(0, 0, rr, 0);
    ctx.closePath();
    ctx.clip();
}

// ---- Modales SweetAlert2: Cómo usar / Créditos ----
function openHowToModal(options){
    const opts = options || {};
    if (typeof Swal === 'undefined') {
        // Fallback simple (sin checkbox obligatorio)
        alert('Cómo usar:\n1) Sube una imagen y escribe tu nombre (mín. 5).\n2) Elige tu disfraz.\n3) Haz clic en “¡Transformar y Animar!”.\n4) Activa “Brasas” si quieres la animación.\n5) Abre la Galería para ampliar/descargar.');
        if (opts.chainNext) openCreditsModal();
        return Promise.resolve();
    }
    return Swal.fire({
        title: 'Cómo usar',
        html: `
          <ol class="howto-list">
            <li>🎃 Sube una imagen y escribe tu nombre (mín. 5 caracteres).</li>
            <li>🧙‍♀️ Elige tu disfraz temático.</li>
            <li>🔥 Haz clic en “¡Transformar y Animar!” y espera al spinner.</li>
            <li>✨ Activa “Brasas” para ver la animación creativa.</li>
            <li>🖼️ Entra a la Galería para ampliar y descargar tus resultados.</li>
          </ol>
        `,
        confirmButtonText: '¡Listo!',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: { popup: 'swal2-theme-halloween' }
    }).then((res)=>{
        if (res.isConfirmed){
            try { sessionStorage.setItem('howto_ack', '1'); } catch(_){ }
            if (opts.chainNext) return openCreditsModal();
        }
    });
}

function openCreditsModal(){
    if (typeof Swal === 'undefined') {
        alert('Créditos:\nBackend: Flask (Python)\nIA: Google Generative AI (Gemini)\nFrontend: HTML, CSS, JavaScript\nAnimación: Canvas 2D\nAssets: static/images/* y static/sounds/*');
        return;
    }
    Swal.fire({
        title: 'Acerca de / Créditos',
        html: `
          <ul class="credits-list">
            <li>🧪 Backend: Flask (Python)</li>
            <li>🤖 IA Generativa: API gemini 2.5 flash image preview</li>
            <li>🕸️ Frontend: HTML, CSS, JavaScript (Vanilla)</li>
            <li>🔥 Animación: Canvas 2D (brasas, humo y llamas)</li>
            <li>🎧 Assets: static/images/* prompt Google Nano Banana</li>
            <li>🎧 Assets: static/images/* gemini 2.5 flash image preview</li>
            <li>🎧 Assets: static/sounds/* ElevenLabs generate audio</li>
          </ul>
        `,
        confirmButtonText: 'Cerrar',
        customClass: { popup: 'swal2-theme-halloween' }
    });
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
    // Disparadores para modales
    const howToLink = document.getElementById('howToLink');
    const creditsLink = document.getElementById('creditsLink');
    if (howToLink) howToLink.addEventListener('click', (e)=>{ e.preventDefault(); openHowToModal(); });
    if (creditsLink) creditsLink.addEventListener('click', (e)=>{ e.preventDefault(); openCreditsModal(); });
    // Mostrar automáticamente solo la primera vez por sesión
    try {
        const seen = sessionStorage.getItem('howto_ack');
        if (!seen) {
            openHowToModal({ chainNext: true });
        }
    } catch(_){
        // Si sessionStorage falla, mostramos igualmente
        openHowToModal({ chainNext: true });
    }
    
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
    const halloweenSound = document.getElementById('halloweenSound');
    const imageStage = document.querySelector('.image-stage');
    const themeOverlay = document.getElementById('themeOverlay');
    const extraPromptInput = document.getElementById('extraPrompt');
    const useThematicBg = document.getElementById('useThematicBg');
    const displayNameInput = document.getElementById('displayName');
    const downloadArea = document.getElementById('downloadArea');
    const downloadBtn = document.getElementById('downloadResultBtn');
    const playSoundBtn = document.getElementById('playSoundBtn');
    const emberCanvas = document.getElementById('emberCanvas');
    const emberToggleBtn = document.getElementById('emberToggleBtn');
    const spinner = document.getElementById('spinner');

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
    if (spinner) spinner.style.display = 'block';
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

        // Reproducir sonido según disfraz (con manejo de autoplay)
        try {
            const soundMap = {
                'vampire': 'static/sounds/vampire_sound.mp3',
                'witch': 'static/sounds/witch_sound.mp3',
                'zombie': 'static/sounds/zombie_sound.mp3',
                'werewolf': 'static/sounds/werewolf_sound.mp3',
                'ghost': 'static/sounds/ghost_sound.mp3'
            };
            if (halloweenSound) {
                // Preparar audio
                halloweenSound.pause();
                halloweenSound.src = soundMap[disfraz] || '';
                halloweenSound.currentTime = 0;
                // Ocultar controles por defecto; sólo mostrarlos si falla autoplay
                halloweenSound.style.display = 'none';
                if (playSoundBtn) playSoundBtn.style.display = 'none';
                // Intentar autoplay
                try {
                    await halloweenSound.play();
                    // Éxito: mantener controles ocultos y botón oculto
                    if (playSoundBtn) playSoundBtn.style.display = 'none';
                    halloweenSound.style.display = 'none';
                } catch (autoplayErr) {
                    // Mostrar botón manual si el navegador bloquea el autoplay
                    if (playSoundBtn) {
                        playSoundBtn.style.display = 'inline-block';
                        playSoundBtn.onclick = async () => {
                            try {
                                await halloweenSound.play();
                                // Ocultar controles y botón tras reproducción manual exitosa
                                playSoundBtn.style.display = 'none';
                                halloweenSound.style.display = 'none';
                            } catch (_) {
                                // Si vuelve a fallar, dejamos el botón visible y podemos mostrar controles si se requiere
                                halloweenSound.style.display = 'block';
                            }
                        };
                    }
                    // Mostrar controles para ofrecer alternativa de reproducción manual
                    halloweenSound.style.display = 'block';
                }
            }
        } catch (soundErr) {
            console.warn('No se pudo reproducir sonido:', soundErr);
        }

        // Renderizar brochure narrativo (usar poema del backend si existe)
        try {
            const poemLines = Array.isArray(transformData.poem_lines) ? transformData.poem_lines : null;
            if (poemLines && poemLines.length >= 1){
                renderBrochureWithLines(disfraz, imgSrc, displayName, poemLines);
            } else {
                renderBrochure(disfraz, imgSrc, displayName);
            }
        } catch (broErr) {
            console.warn('No se pudo renderizar el brochure:', broErr);
        }

        // Mostrar botón de brasas (Fase 4)
        if (emberToggleBtn && emberCanvas) {
            emberToggleBtn.style.display = 'inline-block';
            setupEmbers(emberCanvas, transformedImage);
            emberToggleBtn.onclick = () => toggleEmbers(emberCanvas, emberToggleBtn, transformedImage);
        }

        // Mostrar estado de IA
        if (aiStatus && transformData.ai_debug) {
            const { model, changed, mode } = transformData.ai_debug;
            aiStatus.style.display = 'block';
            aiStatus.textContent = `IA: modelo=${model} | modo=${mode || 'n/a'} | cambio=${changed ? 'sí' : 'no'}`;
        }
    } catch (err) {
        console.error('Error en flujo backend:', err);
       // alert('No se pudo completar la transformación. Intenta nuevamente más tarde.');
    } finally {
        loadingMessage.style.display = 'none';
        if (spinner) spinner.style.display = 'none';
        if (btn) { btn.disabled = false; btn.textContent = '¡Transformar y Animar!'; }
    }
});