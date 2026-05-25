/* ── IndexedDB ── */
const DB_NAME = 'wedding-ht-v3';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('posts')) {
        db.createObjectStore('posts', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbAdd(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const req = tx.objectStore('posts').add(record);
    req.onsuccess = () => resolve(record);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readonly');
    const req = tx.objectStore('posts').getAll();
    req.onsuccess = e => {
      resolve(e.target.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    };
    req.onerror = e => reject(e.target.error);
  });
}

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

async function savePost(blob, name, message) {
  return dbAdd({ id: newId(), blob, name: name.trim() || 'Convidado', message: message.trim(), createdAt: new Date().toISOString() });
}

/* ── State ── */
let stream      = null;
let facingMode  = 'environment';
let capturedBlob = null;
let posts       = [];
let lightboxIdx = 0;
const blobURLs  = [];

function mkURL(blob)  { const u = URL.createObjectURL(blob); blobURLs.push(u); return u; }
function revokeAll()  { while (blobURLs.length) URL.revokeObjectURL(blobURLs.pop()); }

/* ── DOM ── */
const video          = document.getElementById('cameraVideo');
const canvas         = document.getElementById('cameraCanvas');
const previewImg     = document.getElementById('capturedPreview');
const stateIdle      = document.getElementById('stateIdle');
const stateLive      = document.getElementById('stateLive');
const stepCamera     = document.getElementById('stepCamera');
const stepMessage    = document.getElementById('stepMessage');
const btnLigar       = document.getElementById('btnLigar');
const btnSwitch      = document.getElementById('btnSwitch');
const btnCapture     = document.getElementById('btnCapture');
const btnChangePhoto = document.getElementById('btnChangePhoto');
const btnPublish     = document.getElementById('btnPublish');
const cardFileInput  = document.getElementById('cardFileInput');
const heroCamera     = document.getElementById('heroCamera');
const heroFile       = document.getElementById('heroFileInput');
const postName       = document.getElementById('postName');
const postMsg        = document.getElementById('postMsg');
const charCount      = document.getElementById('charCount');
const feedGrid       = document.getElementById('feedGrid');
const photoCount     = document.getElementById('photoCount');
const lightbox       = document.getElementById('lightbox');
const lightboxBg     = document.getElementById('lightboxBg');
const lightboxImg    = document.getElementById('lightboxImg');
const lightboxCaption= document.getElementById('lightboxCaption');
const lightboxDl     = document.getElementById('lightboxDl');
const lightboxClose  = document.getElementById('lightboxClose');
const lightboxPrev   = document.getElementById('lightboxPrev');
const lightboxNext   = document.getElementById('lightboxNext');

/* ── Camera ── */
function showCameraState(name) {
  stateIdle.style.display = name === 'idle' ? 'flex' : 'none';
  stateLive.style.display = name === 'live' ? 'flex' : 'none';
}

function showStep(name) {
  stepCamera.style.display  = name === 'camera'  ? 'flex' : 'none';
  stepMessage.style.display = name === 'message' ? 'flex' : 'none';
}

async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = stream;
    showCameraState('live');
    showStep('camera');
  } catch (err) {
    showToast('Câmera indisponível: ' + (err.message || err), 'error');
    showCameraState('idle');
  }
}

function stopStream() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

function goToMessageStep(blob) {
  capturedBlob = blob;
  previewImg.src = mkURL(blob);
  stopStream();
  showStep('message');
}

/* ── Hero ── */
heroCamera.addEventListener('click', () => {
  document.getElementById('post').scrollIntoView({ behavior: 'smooth' });
  setTimeout(startCamera, 380);
});

heroFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  heroFile.value = '';
  document.getElementById('post').scrollIntoView({ behavior: 'smooth' });
  goToMessageStep(file);
});

/* ── Camera section ── */
btnLigar.addEventListener('click', startCamera);

btnSwitch.addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});

btnCapture.addEventListener('click', () => {
  if (!stream) return;
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => goToMessageStep(blob), 'image/jpeg', 0.92);
});

cardFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  cardFileInput.value = '';
  goToMessageStep(file);
});

/* "Trocar foto" volta para o passo da câmera */
btnChangePhoto.addEventListener('click', () => {
  capturedBlob = null;
  previewImg.src = '';
  showCameraState('idle');
  showStep('camera');
});

/* ── Publish ── */
postMsg.addEventListener('input', () => {
  charCount.textContent = `${postMsg.value.length} / 400`;
});

btnPublish.addEventListener('click', async () => {
  if (!capturedBlob) { showToast('Selecione uma foto primeiro.', 'error'); return; }

  btnPublish.disabled = true;
  btnPublish.textContent = 'Publicando...';

  try {
    const blob = capturedBlob instanceof Blob
      ? capturedBlob
      : new Blob([capturedBlob], { type: capturedBlob.type || 'image/jpeg' });

    await savePost(blob, postName.value, postMsg.value);

    /* Reset */
    capturedBlob = null;
    previewImg.src = '';
    postName.value = '';
    postMsg.value  = '';
    charCount.textContent = '0 / 400';
    showCameraState('idle');
    showStep('camera');

    showToast('Foto publicada com sucesso!', 'success');
    await loadFeed();
    document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
  } catch {
    showToast('Erro ao publicar. Tente novamente.', 'error');
  } finally {
    btnPublish.disabled = false;
    btnPublish.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Publicar`;
  }
});

/* ── Feed ── */
async function loadFeed() {
  try {
    posts = await dbGetAll();
    renderFeed();
  } catch {
    feedGrid.innerHTML = '<div class="feed-empty"><p>Não foi possível carregar a galeria.</p></div>';
  }
}

function renderFeed() {
  revokeAll();

  if (!posts.length) {
    photoCount.textContent = 'Nenhuma foto ainda';
    feedGrid.innerHTML = `
      <div class="feed-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <p>Seja o primeiro a compartilhar um momento!</p>
      </div>`;
    return;
  }

  photoCount.textContent = posts.length === 1 ? '1 foto compartilhada' : `${posts.length} fotos compartilhadas`;

  feedGrid.innerHTML = posts.map((p, i) => {
    const url = mkURL(p.blob);
    const hasMsg = p.message && p.message.length > 0;
    return `
      <div class="feed-card" data-index="${i}">
        <div class="feed-card-photo">
          <img src="${url}" alt="Foto de ${escHtml(p.name)}" loading="lazy" />
          <div class="feed-card-overlay">
            <button class="overlay-btn" data-action="view" data-index="${i}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Ver
            </button>
          </div>
        </div>
        <div class="feed-card-body">
          <span class="feed-card-name">${escHtml(p.name)}</span>
          <p class="feed-card-msg${hasMsg ? '' : ' no-msg'}">${hasMsg ? escHtml(p.message) : 'Sem mensagem'}</p>
        </div>
        <div class="feed-card-footer">
          <span class="feed-card-time">${fmtDate(p.createdAt)}</span>
          <button class="btn-dl-sm" data-action="dl" data-index="${i}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
        </div>
      </div>`;
  }).join('');

  feedGrid.querySelectorAll('.feed-card').forEach(card => {
    card.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      const idx = Number(e.target.closest('[data-index]')?.dataset.index ?? card.dataset.index);
      if (btn?.dataset.action === 'dl') { e.stopPropagation(); downloadPost(idx); }
      else openLightbox(Number(card.dataset.index));
    });
  });
}

function downloadPost(idx) {
  const p = posts[idx];
  const url = URL.createObjectURL(p.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `henrique-thayna-${p.id}.jpg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ── Lightbox ── */
function openLightbox(idx) {
  lightboxIdx = idx;
  const p = posts[idx];
  lightboxImg.src = mkURL(p.blob);

  const hasMsg = p.message && p.message.length > 0;
  lightboxCaption.innerHTML = `
    <p class="lc-name">${escHtml(p.name)}</p>
    ${hasMsg ? `<p class="lc-msg">${escHtml(p.message)}</p>` : ''}
  `;

  lightbox.style.display = 'flex';
  lightboxBg.style.display = 'block';
  document.body.style.overflow = 'hidden';
  updateNav();
}

function closeLightbox() {
  lightbox.style.display = 'none';
  lightboxBg.style.display = 'none';
  document.body.style.overflow = '';
  lightboxImg.src = '';
}

function updateNav() {
  lightboxPrev.style.opacity = lightboxIdx > 0 ? '1' : '0.2';
  lightboxNext.style.opacity = lightboxIdx < posts.length - 1 ? '1' : '0.2';
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxBg.addEventListener('click', closeLightbox);
lightboxDl.addEventListener('click', () => downloadPost(lightboxIdx));
lightboxPrev.addEventListener('click', () => { if (lightboxIdx > 0) openLightbox(lightboxIdx - 1); });
lightboxNext.addEventListener('click', () => { if (lightboxIdx < posts.length - 1) openLightbox(lightboxIdx + 1); });

document.addEventListener('keydown', e => {
  if (lightbox.style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft'  && lightboxIdx > 0)               openLightbox(lightboxIdx - 1);
  if (e.key === 'ArrowRight' && lightboxIdx < posts.length - 1) openLightbox(lightboxIdx + 1);
});

/* ── Helpers ── */
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

/* ── Init ── */
showCameraState('idle');
showStep('camera');
loadFeed();
