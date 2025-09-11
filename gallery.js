// Galería con scroll infinito
(function(){
  const grid = document.getElementById('galleryGrid');
  const emptyMsg = document.getElementById('emptyMsg');
  const loader = document.getElementById('loader');
  const sentinel = document.getElementById('sentinel');
  const lb = {
    overlay: document.getElementById('lightboxOverlay'),
    img: document.getElementById('lbImage'),
    caption: document.getElementById('lbCaption'),
    btnClose: document.getElementById('lbClose'),
    btnPrev: document.getElementById('lbPrev'),
    btnNext: document.getElementById('lbNext'),
    download: document.getElementById('lbDownload'),
  };

  let isLoading = false;
  let endReached = false;
  let cursor = null;     // Firestore cursor (timestamp ISO)
  let offset = 0;        // Filesystem offset
  const limit = 24;
  let mode = null;       // 'fs' | 'fs_guess' | 'firestore'
  const allItems = [];   // mantener orden para lightbox
  let lbIndex = -1;

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
    lb.overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    lb.overlay.style.display = 'none';
    document.body.style.overflow = '';
    lbIndex = -1;
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
