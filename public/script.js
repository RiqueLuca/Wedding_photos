/* ── State ── */
let stream      = null;
let facingMode  = 'environment';
let capturedBlob = null;
let posts       = [];
let lightboxIdx = 0;

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
const uploadBar      = document.getElementById('uploadBar');
const uploadBarFill  = document.getElementById('uploadBarFill');
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

/* ── Step helpers ── */
function showCameraState(name) {
  stateIdle.style.display = name === 'idle' ? 'flex' : 'none';
  stateLive.style.display = name === 'live' ? 'flex' : 'none';
}

function showStep(name) {
  stepCamera.style.display  = name === 'camera'  ? 'flex' : 'none';
  stepMessage.style.display = name === 'message' ? 'flex' : 'none';
}

/* ── Camera ── */
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
  const url = URL.createObjectURL(blob);
  previewImg.src = url;
  previewImg.onload = () => URL.revokeObjectURL(url);
  stopStream();
  showStep('message');
}

/* ── Hero buttons ── */
heroCamera.addEventListener('click', () => {
  document.getElementById('post').scrollIntoView({ behavior: 'smooth' });
  setTimeout(startCamera, 380);
});

heroFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  heroFile.value = '';
  document.getElementById('post').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => goToMessageStep(file), 300);
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

btnChangePhoto.addEventListener('click', () => {
  capturedBlob = null;
  previewImg.src = '';
  showCameraState('idle');
  showStep('camera');
});

/* ── Publish (XHR with progress) ── */
postMsg.addEventListener('input', () => {
  charCount.textContent = `${postMsg.value.length} / 400`;
});

btnPublish.addEventListener('click', () => {
  if (!capturedBlob) { showToast('Selecione uma foto primeiro.', 'error'); return; }

  const formData = new FormData();
  formData.append('photo', capturedBlob instanceof File ? capturedBlob : new File([capturedBlob], 'foto.jpg', { type: 'image/jpeg' }));
  formData.append('name', postName.value.trim() || 'Convidado');
  formData.append('message', postMsg.value.trim());

  btnPublish.disabled = true;
  btnPublish.textContent = 'Enviando...';
  uploadBar.style.display = 'block';
  uploadBarFill.style.width = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/posts');

  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      uploadBarFill.style.width = Math.round((e.loaded / e.total) * 90) + '%';
    }
  });

  xhr.addEventListener('load', async () => {
    uploadBarFill.style.width = '100%';

    if (xhr.status === 201) {
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
    } else {
      const err = JSON.parse(xhr.responseText || '{}');
      showToast(err.error || 'Erro ao publicar. Tente novamente.', 'error');
    }

    setTimeout(() => { uploadBar.style.display = 'none'; }, 800);
    btnPublish.disabled = false;
    btnPublish.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Publicar`;
  });

  xhr.addEventListener('error', () => {
    showToast('Erro de rede. Verifique a conexão.', 'error');
    uploadBar.style.display = 'none';
    btnPublish.disabled = false;
    btnPublish.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Publicar`;
  });

  xhr.send(formData);
});

/* ── Feed ── */
async function loadFeed() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) throw new Error('Erro ao carregar galeria');
    posts = await res.json();
    renderFeed();
  } catch {
    feedGrid.innerHTML = '<div class="feed-empty"><p>Não foi possível carregar a galeria.</p></div>';
  }
}

function renderFeed() {
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
    const hasMsg = p.message && p.message.length > 0;
    return `
      <div class="feed-card" data-index="${i}">
        <div class="feed-card-photo">
          <img src="${p.photo_url}" alt="Foto de ${escHtml(p.name)}" loading="lazy" />
          <div class="feed-card-overlay">
            <button class="overlay-btn" data-action="view">
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
          <span class="feed-card-time">${fmtDate(p.created_at)}</span>
          <a class="btn-dl-sm" href="${p.photo_url}/download" download>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
        </div>
      </div>`;
  }).join('');

  feedGrid.querySelectorAll('.feed-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      openLightbox(Number(card.dataset.index));
    });
  });
}

/* ── Lightbox ── */
function openLightbox(idx) {
  lightboxIdx = idx;
  const p = posts[idx];
  lightboxImg.src = p.photo_url;
  lightboxDl.href = `${p.photo_url}/download`;

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
lightboxPrev.addEventListener('click', () => { if (lightboxIdx > 0) openLightbox(lightboxIdx - 1); });
lightboxNext.addEventListener('click', () => { if (lightboxIdx < posts.length - 1) openLightbox(lightboxIdx + 1); });

document.addEventListener('keydown', e => {
  if (lightbox.style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft'  && lightboxIdx > 0)               openLightbox(lightboxIdx - 1);
  if (e.key === 'ArrowRight' && lightboxIdx < posts.length - 1) openLightbox(lightboxIdx + 1);
});

/* ── Auto-refresh every 20s ── */
function scheduleRefresh() {
  setTimeout(async () => { await loadFeed(); scheduleRefresh(); }, 20000);
}

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
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3500);
}

/* ── Init ── */
showCameraState('idle');
showStep('camera');
loadFeed();
scheduleRefresh();
