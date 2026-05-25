/* ── IndexedDB ── */
const DB_NAME = 'wedding-ht-v2';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbAdd(store, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(record);
    req.onsuccess = () => resolve(record);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Photo storage ── */
async function savePhoto(blob) {
  return dbAdd('photos', { id: newId(), blob, createdAt: new Date().toISOString() });
}

async function getAllPhotos() {
  const all = await dbGetAll('photos');
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/* ── Message storage ── */
async function saveMessage(name, text) {
  return dbAdd('messages', { id: newId(), name: name.trim() || 'Anônimo', text: text.trim(), createdAt: new Date().toISOString() });
}

async function getAllMessages() {
  const all = await dbGetAll('messages');
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/* ── State ── */
let stream = null;
let facingMode = 'environment';
let capturedBlob = null;
let photos = [];
let lightboxIdx = 0;
const blobURLs = [];

function revokeAll() { while (blobURLs.length) URL.revokeObjectURL(blobURLs.pop()); }
function mkURL(blob) { const u = URL.createObjectURL(blob); blobURLs.push(u); return u; }

/* ── DOM refs ── */
const video       = document.getElementById('cameraVideo');
const canvas      = document.getElementById('cameraCanvas');
const preview     = document.getElementById('capturedPreview');
const stateIdle   = document.getElementById('stateIdle');
const stateLive   = document.getElementById('stateLive');
const statePreview= document.getElementById('statePreview');
const btnLigar    = document.getElementById('btnLigar');
const btnSwitch   = document.getElementById('btnSwitch');
const btnCapture  = document.getElementById('btnCapture');
const btnEnviar   = document.getElementById('btnEnviar');
const btnRetake   = document.getElementById('btnRetake');
const heroCamera  = document.getElementById('heroCamera');
const heroFile    = document.getElementById('heroFileInput');
const sectionFile = document.getElementById('sectionFileInput');
const galleryGrid = document.getElementById('galleryGrid');
const photoCount  = document.getElementById('photoCount');
const lightbox    = document.getElementById('lightbox');
const lightboxBg  = document.getElementById('lightboxBg');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxDl  = document.getElementById('lightboxDownload');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev  = document.getElementById('lightboxPrev');
const lightboxNext  = document.getElementById('lightboxNext');
const msgText     = document.getElementById('msgText');
const msgName     = document.getElementById('msgName');
const btnSendMsg  = document.getElementById('btnSendMsg');
const charCount   = document.getElementById('charCount');
const msgList     = document.getElementById('msgList');

/* ── Camera helpers ── */
function showState(name) {
  stateIdle.style.display    = name === 'idle'    ? 'flex' : 'none';
  stateLive.style.display    = name === 'live'    ? 'flex' : 'none';
  statePreview.style.display = name === 'preview' ? 'flex' : 'none';
}

async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = stream;
    showState('live');
  } catch (err) {
    showToast('Câmera indisponível: ' + (err.message || err), 'error');
    showState('idle');
  }
}

function stopStream() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

/* ── Hero buttons ── */
heroCamera.addEventListener('click', () => {
  document.getElementById('camera').scrollIntoView({ behavior: 'smooth' });
  setTimeout(startCamera, 400);
});

heroFile.addEventListener('change', async e => {
  await handleFiles(Array.from(e.target.files));
  heroFile.value = '';
  document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
});

/* ── Camera section buttons ── */
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
  canvas.toBlob(blob => {
    capturedBlob = blob;
    preview.src = mkURL(blob);
    stopStream();
    showState('preview');
  }, 'image/jpeg', 0.92);
});

btnEnviar.addEventListener('click', async () => {
  if (!capturedBlob) return;
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Salvando...';
  await storePhoto(capturedBlob);
  capturedBlob = null;
  showState('idle');
  btnEnviar.disabled = false;
  btnEnviar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Foto`;
  await loadGallery();
  document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
});

btnRetake.addEventListener('click', () => {
  capturedBlob = null;
  startCamera();
});

sectionFile.addEventListener('change', async e => {
  await handleFiles(Array.from(e.target.files));
  sectionFile.value = '';
});

/* ── File handling ── */
async function handleFiles(files) {
  if (!files.length) return;
  for (const f of files) await storePhoto(f);
  await loadGallery();
}

async function storePhoto(blobOrFile) {
  try {
    const blob = blobOrFile instanceof Blob ? blobOrFile : new Blob([blobOrFile], { type: blobOrFile.type });
    await savePhoto(blob);
    showToast('Foto adicionada à galeria!', 'success');
  } catch (e) {
    showToast('Erro ao salvar a foto.', 'error');
  }
}

/* ── Gallery ── */
async function loadGallery() {
  try {
    photos = await getAllPhotos();
    renderGallery();
  } catch {
    galleryGrid.innerHTML = '<div class="insta-empty"><p>Não foi possível carregar as fotos.</p></div>';
  }
}

function renderGallery() {
  revokeAll();

  if (!photos.length) {
    photoCount.textContent = 'Nenhuma foto ainda — tire a primeira!';
    galleryGrid.innerHTML = `
      <div class="insta-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <p>Seja o primeiro a compartilhar um momento!</p>
      </div>`;
    return;
  }

  photoCount.textContent = photos.length === 1 ? '1 foto compartilhada' : `${photos.length} fotos compartilhadas`;

  galleryGrid.innerHTML = photos.map((p, i) => {
    const url = mkURL(p.blob);
    return `
      <div class="insta-cell" data-index="${i}">
        <img src="${url}" alt="Foto ${i + 1}" loading="lazy" />
        <div class="insta-overlay">
          <button class="insta-btn" data-action="view" data-index="${i}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Ver
          </button>
          <button class="insta-btn" data-action="dl" data-index="${i}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Baixar
          </button>
        </div>
      </div>`;
  }).join('');

  galleryGrid.querySelectorAll('.insta-cell').forEach(cell => {
    cell.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      const idx = Number(cell.dataset.index);
      if (btn?.dataset.action === 'dl') downloadPhoto(idx);
      else openLightbox(idx);
    });
  });
}

function downloadPhoto(idx) {
  const p = photos[idx];
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
  lightboxImg.src = mkURL(photos[idx].blob);
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
  lightboxNext.style.opacity = lightboxIdx < photos.length - 1 ? '1' : '0.2';
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxBg.addEventListener('click', closeLightbox);
lightboxDl.addEventListener('click', () => downloadPhoto(lightboxIdx));

lightboxPrev.addEventListener('click', () => {
  if (lightboxIdx > 0) openLightbox(lightboxIdx - 1);
});
lightboxNext.addEventListener('click', () => {
  if (lightboxIdx < photos.length - 1) openLightbox(lightboxIdx + 1);
});

document.addEventListener('keydown', e => {
  if (lightbox.style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft'  && lightboxIdx > 0)                  openLightbox(lightboxIdx - 1);
  if (e.key === 'ArrowRight' && lightboxIdx < photos.length - 1)  openLightbox(lightboxIdx + 1);
});

/* ── Messages ── */
msgText.addEventListener('input', () => {
  charCount.textContent = `${msgText.value.length} / 500`;
});

btnSendMsg.addEventListener('click', async () => {
  const text = msgText.value.trim();
  if (!text) { showToast('Escreva uma mensagem antes de enviar.', 'error'); return; }

  btnSendMsg.disabled = true;
  btnSendMsg.textContent = 'Enviando...';
  await saveMessage(msgName.value, text);
  msgText.value = '';
  msgName.value = '';
  charCount.textContent = '0 / 500';
  btnSendMsg.disabled = false;
  btnSendMsg.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Enviar Mensagem`;
  showToast('Mensagem enviada com carinho!', 'success');
  await loadMessages();
});

async function loadMessages() {
  try {
    const msgs = await getAllMessages();
    if (!msgs.length) {
      msgList.innerHTML = '<p class="msg-empty">Ainda sem mensagens. Seja o primeiro a deixar um recado!</p>';
      return;
    }
    msgList.innerHTML = msgs.map(m => `
      <div class="msg-card">
        <div class="msg-card-header">
          <span class="msg-card-name">${escapeHtml(m.name)}</span>
          <span class="msg-card-time">${formatDate(m.createdAt)}</span>
        </div>
        <p class="msg-card-text">${escapeHtml(m.text)}</p>
      </div>
    `).join('');
  } catch {
    msgList.innerHTML = '<p class="msg-empty">Não foi possível carregar as mensagens.</p>';
  }
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ── Toast ── */
function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

/* ── Init ── */
showState('idle');
loadGallery();
loadMessages();
