// Galería con scroll infinito
(function(){
  const grid = document.getElementById('galleryGrid');
  const emptyMsg = document.getElementById('emptyMsg');
  const loader = document.getElementById('loader');
  const sentinel = document.getElementById('sentinel');
  const lb = {
    overlay: document.getElementById('lightboxOverlay'),
    content: document.querySelector('.lightbox-content'),
    img: document.getElementById('lbImage'),
    caption: document.getElementById('lbCaption'),
    btnClose: document.getElementById('lbClose'),
    btnPrev: document.getElementById('lbPrev'),
    btnNext: document.getElementById('lbNext'),
    download: document.getElementById('lbDownload'),
    sound: document.getElementById('lbSound'),
    playBtn: document.getElementById('lbPlaySoundBtn'),
    brochure: document.getElementById('lbBrochure'),
    emberCanvas: document.getElementById('lbEmberCanvas'),
    emberToggleBtn: document.getElementById('lbEmberToggleBtn'),
  };

  let isLoading = false;
  let endReached = false;
  let cursor = null;     // Firestore cursor (timestamp ISO)
  let offset = 0;        // Filesystem offset
  const limit = 24;
  let mode = null;       // 'fs' | 'fs_guess' | 'firestore'
  const allItems = [];   // mantener orden para lightbox
  let lbIndex = -1;

  // ---- Narrativa y audio helpers (para lightbox) ----
  function emojiFor(disfraz){
    switch(disfraz){
      case 'vampire': return '🦇';
      case 'witch': return '🧙';
      case 'zombie': return '🧟';
      case 'werewolf': return '🐺';
      default: return '👻';
    }
  }

  // ---- Brasas en lightbox ----
  let _lbEmbers = null;
  function setupLbEmbers(){
    const canvas = lb.emberCanvas;
    if (!canvas || !lb.img) return;
    const resize = () => {
      const contentRect = lb.content.getBoundingClientRect();
      const imgRect = lb.img.getBoundingClientRect();
      const left = imgRect.left - contentRect.left;
      const top = imgRect.top - contentRect.top;
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

  function toggleLbEmbers(){
    const canvas = lb.emberCanvas;
    const btn = lb.emberToggleBtn;
    if (!canvas || !btn) return;
    if (_lbEmbers && _lbEmbers.running){
      _lbEmbers.stop();
      canvas.style.display = 'none';
      btn.textContent = 'Activar brasas ✨🔥';
      return;
    }
    setupLbEmbers();
    canvas.style.display = 'block';
    btn.textContent = 'Desactivar brasas ✨🔥';
    const ctx = canvas.getContext('2d');
    const maxEmbers = 120;
    const maxSmoke = 22;
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
      const size = rnd(2.5, 6.0);
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
    let last=0; let running=true;
    function loop(ts){
      if (!running) return;
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts-last)/1000);
      last = ts;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // Clip redondeado para mantener efectos dentro de la imagen
      ctx.save();
      roundedClip(ctx, canvas.width, canvas.height, 10);
      if (embers.length < maxEmbers) spawnEmber();
      if (smokes.length < maxSmoke && Math.random() < 0.5) spawnSmoke();

      // Flames flicker near bottom
      drawLbFlames(ctx, canvas);

      // Smoke (background)
      ctx.globalCompositeOperation = 'lighter';
      for (let i=smokes.length-1;i>=0;i--){
        const s = smokes[i];
        s.age += dt;
        if (s.age > s.life){ smokes.splice(i,1); continue; }
        s.x += s.vx; s.y += s.vy;
        const t = 1 - (s.age/s.life);
        ctx.save(); ctx.filter='blur(6px)';
        ctx.fillStyle = `rgba(200,200,200,${0.18*t})`;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.size,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      // Embers (foreground)
      for (let i=embers.length-1;i>=0;i--){
        const p = embers[i];
        p.age += dt;
        if (p.age > p.life){ embers.splice(i,1); continue; }
        p.x += p.vx; p.y += p.vy;
        const t = 1 - (p.age/p.life);
        const r = 255;
        const g = Math.floor(140 + 100*t);
        const b = Math.floor(40*t);
        const alpha = 0.75*t;
        const grad = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);
        grad.addColorStop(0, `rgba(255,255,200,${alpha})`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(1, `rgba(${r},${g-40},${b},0)`);
        ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    _lbEmbers = { running:true, stop(){ this.running=false; } };
  }

  function drawLbFlames(ctx, canvas){
    const baseY = canvas.height * 0.96; // igual que en página principal
    const topY  = canvas.height * 0.88; // banda más delgada
    const width = canvas.width * 0.9;
    const leftX = canvas.width * 0.05;
    const flicker = (Math.sin(performance.now()/120) + 1) * 0.5;
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
  

  function generatePoem(disfraz, displayName){
    const name = (displayName || 'tu sombra');
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

  function renderLightboxBrochure(disfraz, imgSrc, displayName, poemLines){
    if (!lb.brochure) return;
    const lines = Array.isArray(poemLines) && poemLines.length ? poemLines : generatePoem(disfraz, displayName);
    const deco = emojiFor(disfraz);
    const safeImg = imgSrc || '#';
    // Subtítulo legible
    const disfrazNames = { vampire: 'Vampir@', witch: 'Bruj@', zombie: 'Zombie', werewolf: 'Lob@', ghost: 'Fantasma' };
    const nice = disfrazNames[disfraz] || (disfraz?.charAt(0).toUpperCase() + disfraz?.slice(1) || 'Alter Ego');
    const title = `Tu álter ego: ${nice} — ${displayName || 'Sin nombre'}`;
    lb.brochure.innerHTML = `
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
    lb.brochure.style.display = 'block';
  }

  function renderPoemWithIcons(lines, disfraz){
    const icons = iconPairFor(disfraz);
    const e = (s)=>String(s||'').replace(/[&<>"']/g, c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
    }[c]));
    const l1=e(lines?.[0]||''), l2=e(lines?.[1]||''), l3=e(lines?.[2]||'');
    return `
      <div class="poem-line-row"><span class="poem-line-icon">${icons[0]}</span><span class="poem-line-text">${l1}</span></div>
      <div class="poem-line-row right"><span class="poem-line-text">${l2}</span><span class="poem-line-icon">${icons[1]}</span></div>
      <div class="poem-line-row"><span class="poem-line-icon">${icons[0]}</span><span class="poem-line-text">${l3}</span></div>`;
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

  function hideLightboxBrochure(){
    if (!lb.brochure) return;
    lb.brochure.innerHTML = '';
    lb.brochure.style.display = 'none';
  }

  // ---- Fade de scroll en lightbox ----
  function updateLightboxFade(){
    const el = lb.content;
    if (!el) return;
    const atBottom = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 2);
    if (atBottom) {
      el.classList.add('hide-fade');
    } else {
      el.classList.remove('hide-fade');
    }
  }

  async function fetchPage() {
    if (isLoading || endReached) return;
    isLoading = true;
    loader.style.display = 'block';

    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (mode === 'firestore') {
        if (cursor) params.set('cursor', cursor);
      } else if (mode === 'fs' || mode === 'fs_guess' || mode === null) {
        params.set('offset', String(offset));
      }
      const res = await fetch(`/api/gallery?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Detectar modo si aún no lo sabemos
      if (!mode) {
        if (typeof data.next_cursor !== 'undefined' || typeof data.next_offset === 'undefined') {
          // Si viene next_cursor, claramente Firestore. Si no viene next_offset, puede ser Firestore con último batch completo
          mode = typeof data.next_cursor !== 'undefined' ? 'firestore' : 'fs_guess';
        } else {
          mode = 'fs';
        }
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        if (grid.childElementCount === 0) emptyMsg.style.display = 'block';
        endReached = true;
        return;
      }

      // Renderizar
      const frag = document.createDocumentFragment();
      for (const it of items) {
        if (!it || (!it.image_url && !it.data_url)) continue;
        const card = document.createElement('div');
        card.className = 'gallery-card';
        const img = document.createElement('img');
        img.src = it.data_url || it.image_url;
        img.alt = 'Imagen transformada';
        img.style.cursor = 'zoom-in';
        card.appendChild(img);
        if (it.display_name) {
          const badge = document.createElement('div');
          badge.className = 'name-badge';
          badge.textContent = it.display_name;
          card.appendChild(badge);
        }
        // Botón de descarga en la tarjeta
        const a = document.createElement('a');
        a.className = 'card-download-btn';
        a.href = it.data_url || it.image_url;
        a.title = 'Descargar imagen';
        // filename sugerido
        const base = (it.display_name || 'imagen').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagen';
        const ext = it.data_url ? 'webp' : ((it.image_url||'').split('.').pop() || 'png');
        a.download = (it.suggested_name) || `${base}.${ext}`;
        a.textContent = '⬇';
        card.appendChild(a);
        // Guardar item para lightbox y configurar click
        const idx = allItems.length;
        allItems.push(it);
        img.addEventListener('click', () => openLightbox(idx));
        frag.appendChild(card);
      }
      grid.appendChild(frag);

      // Actualizar paginación
      if (mode === 'firestore') {
        cursor = data.next_cursor || null;
        if (!cursor || items.length < limit) endReached = true;
      } else {
        const nextOffset = typeof data.next_offset === 'number' ? data.next_offset : offset + items.length;
        if (nextOffset === offset) {
          endReached = true;
        } else {
          offset = nextOffset;
          if (items.length < limit && typeof data.next_offset === 'undefined') {
            // Sin next_offset y menos de limit -> asumir fin
            endReached = true;
          }
        }
      }
    } catch (e) {
      console.error('Error cargando galería:', e);
      if (grid.childElementCount === 0) emptyMsg.style.display = 'block';
      endReached = true;
    } finally {
      isLoading = false;
      loader.style.display = 'none';
    }
  }

  // Observer para scroll infinito
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        fetchPage();
      }
    }
  }, { rootMargin: '600px' });

  if (sentinel) io.observe(sentinel);

  // Carga inicial
  fetchPage();

  // ---------- Lightbox logic ----------
  function openLightbox(index){
    if (index < 0 || index >= allItems.length) return;
    lbIndex = index;
    const it = allItems[index];
    lb.img.src = it.data_url || it.image_url;
    lb.caption.textContent = it.display_name || '';
    // Configurar descarga en lightbox
    if (lb.download) {
      lb.download.href = it.data_url || it.image_url;
      const base = (it.display_name || 'imagen').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagen';
      const ext = it.data_url ? 'webp' : ((it.image_url||'').split('.').pop() || 'png');
      lb.download.download = (it.suggested_name) || `${base}.${ext}`;
    }

    // Mostrar overlay inmediatamente para evitar cualquier interrupción
    lb.overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Narrativa y sonido si hay 'disfraz'
    const disfraz = (it && it.disfraz) ? String(it.disfraz) : '';
    if (disfraz) {
      try {
        const pls = Array.isArray(it.poem_lines) ? it.poem_lines : null;
        renderLightboxBrochure(disfraz, (it.data_url || it.image_url), it.display_name || '', pls);
      } catch(e) {
        console.warn('No se pudo renderizar brochure en lightbox:', e);
        hideLightboxBrochure();
      }
      // Sonido por disfraz
      try {
        const soundMap = {
          'vampire': 'static/sounds/vampire_sound.mp3',
          'witch': 'static/sounds/witch_sound.mp3',
          'zombie': 'static/sounds/zombie_sound.mp3',
          'werewolf': 'static/sounds/werewolf_sound.mp3',
          'ghost': 'static/sounds/ghost_sound.mp3'
        };
        if (lb.sound) {
          lb.sound.pause();
          lb.sound.src = soundMap[disfraz] || '';
          lb.sound.currentTime = 0;
          // Ocultar controles por defecto; sólo mostrarlos si falla autoplay
          lb.sound.style.display = 'none';
          if (lb.playBtn) lb.playBtn.style.display = 'none';
          // Intentar autoplay
          lb.sound.play().then(() => {
            // Éxito: mantener controles y botón ocultos
            if (lb.playBtn) lb.playBtn.style.display = 'none';
            lb.sound.style.display = 'none';
          }).catch(() => {
            // Falla autoplay: mostrar botón y controles como alternativa
            if (lb.playBtn) {
              lb.playBtn.style.display = 'inline-block';
              lb.playBtn.onclick = async () => {
                try {
                  await lb.sound.play();
                  lb.playBtn.style.display = 'none';
                  lb.sound.style.display = 'none';
                } catch(_){
                  // si falla de nuevo, mostrar controles
                  lb.sound.style.display = 'block';
                }
              };
            }
            lb.sound.style.display = 'block';
          });
        }
      } catch (se) {
        console.warn('No se pudo reproducir sonido en lightbox:', se);
      }
    } else {
      // Sin disfraz: comportamiento actual (solo imagen)
      hideLightboxBrochure();
      if (lb.sound) {
        lb.sound.pause();
        lb.sound.style.display = 'none';
      }
      if (lb.playBtn) lb.playBtn.style.display = 'none';
    }

    // Mostrar botón de brasas y conectar handler
    if (lb.emberToggleBtn) {
      lb.emberToggleBtn.style.display = 'inline-block';
      lb.emberToggleBtn.onclick = toggleLbEmbers;
    }
    if (lb.emberCanvas) {
      lb.emberCanvas.style.display = 'none';
    }

    // Activar indicador de scroll
    if (lb.content) {
      lb.content.classList.add('scroll-fade');
      lb.content.classList.remove('hide-fade');
      // Actualizar después de inyectar contenido
      setTimeout(updateLightboxFade, 0);
      lb.content.addEventListener('scroll', updateLightboxFade);
      // También al redimensionar
      window.addEventListener('resize', updateLightboxFade);
    }
  }
  function closeLightbox(){
    lb.overlay.style.display = 'none';
    document.body.style.overflow = '';
    lbIndex = -1;
    // Detener sonido y limpiar brochure
    try { lb.sound?.pause(); } catch(_){}
    hideLightboxBrochure();
    if (lb.playBtn) lb.playBtn.style.display = 'none';
    // Desactivar indicador de scroll
    if (lb.content) {
      lb.content.removeEventListener('scroll', updateLightboxFade);
      window.removeEventListener('resize', updateLightboxFade);
      lb.content.classList.remove('scroll-fade');
      lb.content.classList.remove('hide-fade');
    }
    // Ocultar y detener brasas
    if (lb.emberCanvas) lb.emberCanvas.style.display = 'none';
    if (lb.emberToggleBtn) lb.emberToggleBtn.style.display = 'none';
    try { if (_lbEmbers && _lbEmbers.running) _lbEmbers.stop(); } catch(_){}
  }
  function next(){
    if (lbIndex < 0) return;
    openLightbox((lbIndex + 1) % allItems.length);
  }
  function prev(){
    if (lbIndex < 0) return;
    openLightbox((lbIndex - 1 + allItems.length) % allItems.length);
  }
  lb.btnClose?.addEventListener('click', closeLightbox);
  lb.btnNext?.addEventListener('click', next);
  lb.btnPrev?.addEventListener('click', prev);
  lb.overlay?.addEventListener('click', (e)=>{
    if (e.target === lb.overlay) closeLightbox();
  });
  window.addEventListener('keydown', (e)=>{
    if (lbIndex < 0) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });
})();
