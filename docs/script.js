/* ── IndexedDB ── */
const DB_NAME = 'wedding-ht-photos';
const DB_VERSION = 1;
const STORE = 'photos';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function savePhoto(blob) {
  const db = await openDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const record = { id, blob, createdAt: new Date().toISOString() };
    const req = tx.objectStore(STORE).add(record);
    req.onsuccess = () => resolve(record);
    req.onerror = e => reject(e.target.error);
  });
}

async function getAllPhotos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = e => {
      const sorted = e.target.result.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      resolve(sorted);
    };
    req.onerror = e => reject(e.target.error);
  });
}

/* ── State ── */
let stream = null;
let facingMode = 'environment';
let capturedBlob = null;
let photos = [];
let lightboxIndex = 0;
const objectURLs = [];

function revokeOldURLs() {
  while (objectURLs.length) URL.revokeObjectURL(objectURLs.pop());
}

/* ── DOM ── */
const video       = document.getElementById('cameraVideo');
const canvas      = document.getElementById('cameraCanvas');
const placeholder = document.getElementById('cameraPlaceholder');
const preview     = document.getElementById('capturedPreview');
const btnStart    = document.getElementById('btnStartCamera');
const btnSwitch   = document.getElementById('btnSwitchCamera');
const btnCapture  = document.getElementById('btnCapture');
const btnSend     = document.getElementById('btnSend');
const btnRetake   = document.getElementById('btnRetake');
const fileInput   = document.getElementById('fileInput');
const previewActs = document.getElementById('previewActions');
const galleryGrid = document.getElementById('galleryGrid');
const photoCount  = document.getElementById('photoCount');
const lightbox    = document.getElementById('lightbox');
const lightboxOvr = document.getElementById('lightboxOverlay');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxDl  = document.getElementById('lightboxDownload');
const lightboxClose= document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

/* ── Camera ── */
async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = stream;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    preview.style.display = 'none';
    capturedBlob = null;
    previewActs.style.display = 'none';
    btnCapture.disabled = false;
    btnStart.textContent = 'Desligar';
    btnStart.style.borderColor = '#a05050';
    btnStart.style.color = '#a05050';
    btnSwitch.style.display = 'flex';
    showToast('Câmera ligada!', 'info');
  } catch (err) {
    showToast('Não foi possível acessar a câmera: ' + (err.message || err), 'error');
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
  video.style.display = 'none';
  placeholder.style.display = 'flex';
  btnCapture.disabled = true;
  btnStart.textContent = 'Ligar câmera';
  btnStart.style.borderColor = '';
  btnStart.style.color = '';
  btnSwitch.style.display = 'none';
}

btnStart.addEventListener('click', () => {
  if (stream) stopCamera();
  else startCamera();
});

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
    const url = URL.createObjectURL(blob);
    objectURLs.push(url);
    preview.src = url;
    preview.style.display = 'block';
    video.style.display = 'none';
    previewActs.style.display = 'flex';
    stopCamera();
  }, 'image/jpeg', 0.92);
});

btnRetake.addEventListener('click', () => {
  preview.style.display = 'none';
  previewActs.style.display = 'none';
  capturedBlob = null;
  startCamera();
});

/* ── File Input ── */
fileInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  for (const file of files) await storePhoto(file);
  fileInput.value = '';
  await loadGallery();
});

/* ── Send Captured ── */
btnSend.addEventListener('click', async () => {
  if (!capturedBlob) return;
  btnSend.disabled = true;
  btnSend.textContent = 'Salvando...';
  await storePhoto(capturedBlob);
  preview.style.display = 'none';
  previewActs.style.display = 'none';
  placeholder.style.display = 'flex';
  capturedBlob = null;
  btnSend.disabled = false;
  btnSend.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Salvar foto`;
  await loadGallery();
});

/* ── Store ── */
async function storePhoto(blobOrFile) {
  try {
    const blob = blobOrFile instanceof Blob ? blobOrFile : new Blob([blobOrFile], { type: blobOrFile.type });
    await savePhoto(blob);
    showToast('Foto salva na galeria!', 'success');
  } catch (err) {
    showToast('Erro ao salvar: ' + err.message, 'error');
  }
}

/* ── Gallery ── */
async function loadGallery() {
  try {
    photos = await getAllPhotos();
    renderGallery();
  } catch {
    galleryGrid.innerHTML = '<div class="gallery-empty"><p>Não foi possível carregar as fotos.</p></div>';
  }
}

function renderGallery() {
  revokeOldURLs();

  if (!photos.length) {
    photoCount.textContent = 'Ainda não há fotos. Seja o primeiro a compartilhar!';
    galleryGrid.innerHTML = `
      <div class="gallery-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <p>Nenhuma foto ainda — tire a primeira!</p>
      </div>`;
    return;
  }

  photoCount.textContent = photos.length === 1
    ? '1 foto compartilhada'
    : `${photos.length} fotos compartilhadas`;

  galleryGrid.innerHTML = photos.map((p, i) => {
    const url = URL.createObjectURL(p.blob);
    objectURLs.push(url);
    return `
      <div class="photo-card" data-index="${i}">
        <img src="${url}" alt="Foto ${i + 1}" loading="lazy" />
        <div class="photo-card-overlay">
          <div class="photo-card-actions">
            <button class="photo-action-btn" data-action="view" data-index="${i}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Ver
            </button>
            <button class="photo-action-btn gold" data-action="download" data-index="${i}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  galleryGrid.querySelectorAll('.photo-card').forEach(card => {
    card.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      const idx = Number(card.dataset.index);
      if (btn?.dataset.action === 'download') {
        downloadPhoto(idx);
      } else {
        openLightbox(idx);
      }
    });
  });
}

function downloadPhoto(index) {
  const photo = photos[index];
  const url = URL.createObjectURL(photo.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `henrique-thayna-${photo.id}.jpg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Lightbox ── */
function openLightbox(index) {
  lightboxIndex = index;
  const photo = photos[index];
  const url = URL.createObjectURL(photo.blob);
  objectURLs.push(url);
  lightboxImg.src = url;
  lightbox.style.display = 'flex';
  lightboxOvr.style.display = 'block';
  document.body.style.overflow = 'hidden';
  updateLightboxNav();
}

function closeLightbox() {
  lightbox.style.display = 'none';
  lightboxOvr.style.display = 'none';
  document.body.style.overflow = '';
  lightboxImg.src = '';
}

function updateLightboxNav() {
  lightboxPrev.style.opacity = lightboxIndex > 0 ? '1' : '0.25';
  lightboxNext.style.opacity = lightboxIndex < photos.length - 1 ? '1' : '0.25';
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxOvr.addEventListener('click', closeLightbox);

lightboxPrev.addEventListener('click', () => {
  if (lightboxIndex > 0) openLightbox(lightboxIndex - 1);
});

lightboxNext.addEventListener('click', () => {
  if (lightboxIndex < photos.length - 1) openLightbox(lightboxIndex + 1);
});

lightboxDl.addEventListener('click', () => downloadPhoto(lightboxIndex));

document.addEventListener('keydown', e => {
  if (lightbox.style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft' && lightboxIndex > 0) openLightbox(lightboxIndex - 1);
  if (e.key === 'ArrowRight' && lightboxIndex < photos.length - 1) openLightbox(lightboxIndex + 1);
});

/* ── Toast ── */
function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.4s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

/* ── Init ── */
loadGallery();
