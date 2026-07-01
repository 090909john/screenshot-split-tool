const fileInput = document.getElementById('fileInput');
const uploadBox = document.getElementById('uploadBox');
const errorMsg = document.getElementById('errorMsg');

const modeTabs = document.getElementById('modeTabs');
const originalSection = document.getElementById('originalSection');
const originalPreview = document.getElementById('originalPreview');
const cropHint = document.getElementById('cropHint');
const cropFrame = document.getElementById('cropFrame');
const selectionBox = document.getElementById('selectionBox');

const splitPanel = document.getElementById('splitPanel');
const splitAction = document.getElementById('splitAction');
const resultCanvas = document.getElementById('resultCanvas');
const downloadBtn = document.getElementById('downloadBtn');

const cropPanel = document.getElementById('cropPanel');
const cropAction = document.getElementById('cropAction');
const cropResultCanvas = document.getElementById('cropResultCanvas');
const cropBtn = document.getElementById('cropBtn');
const cropDownloadBtn = document.getElementById('cropDownloadBtn');

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MIN_WIDTH_FOR_SPLIT = 2;

let currentImage = null;
let splitDataUrl = null;
let cropDataUrl = null;
let currentMode = 'split';
let selection = null; // { x, y, width, height } in natural image pixels

// ---------- Upload handling ----------

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

['dragover', 'dragleave', 'drop'].forEach((eventName) => {
  uploadBox.addEventListener(eventName, (e) => e.preventDefault());
});

uploadBox.addEventListener('dragover', () => uploadBox.classList.add('dragover'));
uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
uploadBox.addEventListener('drop', (e) => {
  uploadBox.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  clearError();
  resetAll();

  if (!ACCEPTED_TYPES.includes(file.type)) {
    showError('不支援的檔案格式,請上傳 PNG、JPG、JPEG 或 WebP 圖片。');
    return;
  }

  const reader = new FileReader();

  reader.onerror = () => showError('圖片讀取失敗,請重新選擇檔案。');

  reader.onload = (e) => {
    const img = new Image();

    img.onerror = () => showError('圖片讀取失敗,請確認檔案是否為有效的圖片。');

    img.onload = () => {
      currentImage = img;
      originalPreview.src = img.src;
      modeTabs.hidden = false;
      originalSection.hidden = false;
      runSplit(img);
      applyMode();
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

function resetAll() {
  currentImage = null;
  splitDataUrl = null;
  cropDataUrl = null;
  selection = null;
  downloadBtn.disabled = true;
  cropBtn.disabled = true;
  cropDownloadBtn.disabled = true;
  modeTabs.hidden = true;
  originalSection.hidden = true;
  selectionBox.hidden = true;
  resultCanvas.width = 0;
  resultCanvas.height = 0;
  cropResultCanvas.width = 0;
  cropResultCanvas.height = 0;
}

// ---------- Mode switching ----------

modeTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-tab');
  if (!btn) return;
  currentMode = btn.dataset.mode;
  [...modeTabs.querySelectorAll('.mode-tab')].forEach((t) => t.classList.toggle('active', t === btn));
  applyMode();
});

function applyMode() {
  const isSplit = currentMode === 'split';
  splitPanel.hidden = !isSplit;
  splitAction.hidden = !isSplit;
  cropPanel.hidden = isSplit;
  cropAction.hidden = isSplit;
  cropHint.hidden = isSplit;
  cropFrame.classList.toggle('crop-active', !isSplit);
}

// ---------- Split mode ----------

function runSplit(img) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  if (W < MIN_WIDTH_FOR_SPLIT) {
    showError('圖片寬度太小,無法切割為左右兩半。');
    return;
  }

  const leftWidth = Math.floor(W / 2);
  const rightWidth = W - leftWidth;
  const rightX = leftWidth;

  if (leftWidth < 1 || rightWidth < 1) {
    showError('圖片寬度太小,無法切割為左右兩半。');
    return;
  }

  const outputWidth = Math.max(leftWidth, rightWidth);
  const outputHeight = H * 2;

  resultCanvas.width = outputWidth;
  resultCanvas.height = outputHeight;

  const ctx = resultCanvas.getContext('2d');
  ctx.clearRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(img, 0, 0, leftWidth, H, 0, 0, leftWidth, H);
  ctx.drawImage(img, rightX, 0, rightWidth, H, 0, H, rightWidth, H);

  splitDataUrl = resultCanvas.toDataURL('image/png');
  downloadBtn.disabled = false;
}

downloadBtn.addEventListener('click', () => {
  if (!splitDataUrl) return;
  triggerDownload(splitDataUrl, 'split-stacked-image.png');
});

// ---------- Crop mode ----------

let dragging = false;
let dragStart = null;

cropFrame.addEventListener('mousedown', onDragStart);
cropFrame.addEventListener('touchstart', onDragStart, { passive: true });
window.addEventListener('mousemove', onDragMove);
window.addEventListener('touchmove', onDragMove, { passive: true });
window.addEventListener('mouseup', onDragEnd);
window.addEventListener('touchend', onDragEnd);

function getPoint(e) {
  // Returned in cropFrame-relative coordinates (since selectionBox is
  // positioned absolute within cropFrame, which is wider than the
  // centered image), but clamped to the image's displayed bounds.
  const imgRect = originalPreview.getBoundingClientRect();
  const frameRect = cropFrame.getBoundingClientRect();
  const source = e.touches ? e.touches[0] : e;

  const imgLeft = imgRect.left - frameRect.left;
  const imgTop = imgRect.top - frameRect.top;

  return {
    x: clamp(source.clientX - frameRect.left, imgLeft, imgLeft + imgRect.width),
    y: clamp(source.clientY - frameRect.top, imgTop, imgTop + imgRect.height),
  };
}

function onDragStart(e) {
  if (currentMode !== 'crop' || !currentImage) return;
  const pt = getPoint(e);
  dragging = true;
  dragStart = pt;
  selectionBox.hidden = false;
  updateSelectionBox(pt, pt);
}

function onDragMove(e) {
  if (!dragging) return;
  const pt = getPoint(e);
  updateSelectionBox(dragStart, pt);
}

function onDragEnd() {
  if (!dragging) return;
  dragging = false;

  const rect = originalPreview.getBoundingClientRect();
  const boxRect = selectionBox.getBoundingClientRect();

  if (boxRect.width < 4 || boxRect.height < 4) {
    selectionBox.hidden = true;
    selection = null;
    cropBtn.disabled = true;
    return;
  }

  const scaleX = currentImage.naturalWidth / rect.width;
  const scaleY = currentImage.naturalHeight / rect.height;

  const left = boxRect.left - rect.left;
  const top = boxRect.top - rect.top;

  selection = {
    x: Math.round(left * scaleX),
    y: Math.round(top * scaleY),
    width: Math.round(boxRect.width * scaleX),
    height: Math.round(boxRect.height * scaleY),
  };

  cropBtn.disabled = false;
}

function updateSelectionBox(start, current) {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);

  selectionBox.style.left = `${x}px`;
  selectionBox.style.top = `${y}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

cropBtn.addEventListener('click', () => {
  if (!currentImage || !selection) return;

  const { x, y, width, height } = selection;

  if (width < 1 || height < 1) {
    showError('選取範圍太小,請重新框選。');
    return;
  }

  cropResultCanvas.width = width;
  cropResultCanvas.height = height;

  const ctx = cropResultCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(currentImage, x, y, width, height, 0, 0, width, height);

  cropDataUrl = cropResultCanvas.toDataURL('image/png');
  cropDownloadBtn.disabled = false;
});

cropDownloadBtn.addEventListener('click', () => {
  if (!cropDataUrl) return;
  triggerDownload(cropDataUrl, 'cropped-zoomed-image.png');
});

// ---------- Shared helpers ----------

function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = '';
}
