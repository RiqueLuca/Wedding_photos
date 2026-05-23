/* ── State ── */
let stream = null;
let facingMode = 'environment';
let capturedBlob = null;
let photos = [];
let lightboxIndex = 0;

/* ── DOM ── */
const video        = document.getElementById('cameraVideo');
const canvas       = document.getElementById('cameraCanvas');
const placeholder  = document.getElementById('cameraPlaceholder');
const preview      = document.getElementById('capturedPreview');
const btnStart     = document.getElementById('btnStartCamera');
const btnSwitch    = document.getElementById('btnSwitchCamera');
const btnCapture   = document.getElementById('btnCapture');
const btnSend      = document.getElementById('btnSend');
const btnRetake    = document.getElementById('btnRetake');
const fileInput    = document.getElementById('fileInput');
const previewActs  = document.getElementById('previewActions');
const uploadStatus = document.getElementById('uploadStatus');
const uploadFill   = document.getElementById('uploadProgressFill');
const uploadText   = document.getElementById('uploadStatusText');
const galleryGrid  = document.getElementById('galleryGrid');
const photoCount   = document.getElementById('photoCount');
const lightbox     = document.getElementById('lightbox');
const lightboxOvr  = document.getElementById('lightboxOverlay');
const lightboxImg  = document.getElementById('lightboxImg');
const lightboxDl   = document.getElementById('lightboxDownload');
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
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    capturedBlob = blob;
    preview.src = URL.createObjectURL(blob);
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
  for (const file of files) await uploadPhoto(file);
  fileInput.value = '';
});

/* ── Send captured ── */
btnSend.addEventListener('click', () => {
  if (!capturedBlob) return;
  const file = new File([capturedBlob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
  uploadPhoto(file).then(() => {
    preview.style.display = 'none';
    previewActs.style.display = 'none';
    placeholder.style.display = 'flex';
    capturedBlob = null;
  });
});

/* ── Upload ── */
async function uploadPhoto(file) {
  uploadStatus.style.display = 'block';
  uploadFill.style.width = '0%';
  uploadText.textContent = 'Enviando...';

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('photo', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        uploadFill.style.width = Math.round((e.loaded / e.total) * 90) + '%';
      }
    });
    xhr.addEventListener('load', () => {
      uploadFill.style.width = '100%';
      if (xhr.status === 200) {
        uploadText.textContent = 'Foto enviada com sucesso!';
        showToast('Foto adicionada à galeria!', 'success');
        loadGallery();
        setTimeout(() => { uploadStatus.style.display = 'none'; }, 2500);
        resolve();
      } else {
        uploadText.textContent = 'Erro ao enviar.';
        showToast('Erro ao enviar a foto.', 'error');
        setTimeout(() => { uploadStatus.style.display = 'none'; }, 2500);
        reject();
      }
    });
    xhr.addEventListener('error', () => {
      uploadText.textContent = 'Erro de rede.';
      showToast('Erro de rede ao enviar.', 'error');
      setTimeout(() => { uploadStatus.style.display = 'none'; }, 2500);
      reject();
    });
    xhr.send(formData);
  });
}

/* ── Gallery ── */
async function loadGallery() {
  try {
    const res = await fetch('/api/photos');
    photos = await res.json();
    renderGallery();
  } catch {
    galleryGrid.innerHTML = '<div class="gallery-empty"><p>Não foi possível carregar as fotos.</p></div>';
  }
}

function renderGallery() {
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

  galleryGrid.innerHTML = photos.map((p, i) => `
    <div class="photo-card" data-index="${i}">
      <img
        src="${p.url}"
        alt="Foto ${i + 1}"
        loading="lazy"
        onerror="this.parentElement.style.display='none'"
      />
      <div class="photo-card-overlay">
        <div class="photo-card-actions">
          <button class="photo-action-btn" onclick="openLightbox(${i});event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/></svg>
            Ver
          </button>
          <a class="photo-action-btn gold" href="${p.url}" download="henrique-thayna-${p.filename}" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.photo-card').forEach(card => {
    card.addEventListener('click', () => openLightbox(Number(card.dataset.index)));
  });
}

/* ── Lightbox ── */
function openLightbox(index) {
  lightboxIndex = index;
  const photo = photos[index];
  lightboxImg.src = photo.url;
  lightboxDl.href = photo.url;
  lightboxDl.download = `henrique-thayna-${photo.filename}`;
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

/* ── Auto-refresh gallery ── */
function scheduleRefresh() {
  setTimeout(async () => {
    await loadGallery();
    scheduleRefresh();
  }, 15000);
}

/* ── Init ── */
loadGallery();
scheduleRefresh();
