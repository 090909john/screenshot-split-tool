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
const cropPresets = document.getElementById('cropPresets');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');

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

  if (currentMode === 'crop' && !selection && currentImage) {
    applyPreset('middle-half');
  }
});

function applyMode() {
  const isSplit = currentMode === 'split';
  splitPanel.hidden = !isSplit;
  splitAction.hidden = !isSplit;
  cropPanel.hidden = isSplit;
  cropAction.hidden = isSplit;
  cropHint.hidden = isSplit;
  cropPresets.hidden = isSplit;
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

// All frame-relative helpers work in cropFrame's local coordinate space,
// since selectionBox is positioned absolute within cropFrame (which is
// wider than the centered image itself).

function getImageBoundsInFrame() {
  const imgRect = originalPreview.getBoundingClientRect();
  const frameRect = cropFrame.getBoundingClientRect();
  const left = imgRect.left - frameRect.left;
  const top = imgRect.top - frameRect.top;
  return { left, top, right: left + imgRect.width, bottom: top + imgRect.height, width: imgRect.width, height: imgRect.height };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setSelectionBoxStyle(box) {
  selectionBox.style.left = `${box.left}px`;
  selectionBox.style.top = `${box.top}px`;
  selectionBox.style.width = `${box.width}px`;
  selectionBox.style.height = `${box.height}px`;
}

// Converts a frame-relative box into natural image pixels, updates
// `selection`, and enables/disables the crop button accordingly.
function finalizeSelection(box) {
  if (box.width < 4 || box.height < 4) {
    selectionBox.hidden = true;
    selection = null;
    cropBtn.disabled = true;
    return;
  }

  const bounds = getImageBoundsInFrame();
  const scaleX = currentImage.naturalWidth / bounds.width;
  const scaleY = currentImage.naturalHeight / bounds.height;

  selection = {
    x: Math.round((box.left - bounds.left) * scaleX),
    y: Math.round((box.top - bounds.top) * scaleY),
    width: Math.round(box.width * scaleX),
    height: Math.round(box.height * scaleY),
  };

  cropBtn.disabled = false;
}

// ---- Free-draw selection ----

// A touch that merely brushes the image while the user is trying to
// scroll the page (to reach the action bar below) must NOT wipe out an
// existing selection. So a new free-draw only "commits" (hides the old
// box and starts drawing a new one) once the finger has moved past
// DRAG_THRESHOLD px; a plain tap/scroll-start leaves the selection intact.
const DRAG_THRESHOLD = 8;

let pendingStart = null;
let dragging = false;
let dragStart = null;

cropFrame.addEventListener('mousedown', onDragStart);
cropFrame.addEventListener('touchstart', onDragStart, { passive: true });
window.addEventListener('mousemove', onDragMove);
window.addEventListener('touchmove', onDragMove, { passive: true });
window.addEventListener('mouseup', onDragEnd);
window.addEventListener('touchend', onDragEnd);

function getPoint(e) {
  const bounds = getImageBoundsInFrame();
  const frameRect = cropFrame.getBoundingClientRect();
  const source = e.touches ? e.touches[0] : e;

  return {
    x: clamp(source.clientX - frameRect.left, bounds.left, bounds.right),
    y: clamp(source.clientY - frameRect.top, bounds.top, bounds.bottom),
  };
}

function onDragStart(e) {
  if (currentMode !== 'crop' || !currentImage) return;
  if (e.target.closest('.handle')) return;
  pendingStart = getPoint(e);
  dragging = false;
}

function onDragMove(e) {
  if (!pendingStart) return;
  const pt = getPoint(e);

  if (!dragging) {
    const dx = pt.x - pendingStart.x;
    const dy = pt.y - pendingStart.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragging = true;
    dragStart = pendingStart;
    selectionBox.hidden = false;
  }

  updateSelectionBox(dragStart, pt);
}

function onDragEnd() {
  pendingStart = null;
  if (!dragging) return;
  dragging = false;

  const frameRect = cropFrame.getBoundingClientRect();
  const boxRect = selectionBox.getBoundingClientRect();

  finalizeSelection({
    left: boxRect.left - frameRect.left,
    top: boxRect.top - frameRect.top,
    width: boxRect.width,
    height: boxRect.height,
  });
}

function updateSelectionBox(start, current) {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  setSelectionBoxStyle({ left: x, top: y, width, height });
}

// ---- Preset quick-select ranges ----

const PRESETS = {
  'top-half': [0, 0.5],
  'middle-half': [0.25, 0.75],
  'bottom-half': [0.5, 1],
  'top-third': [0, 1 / 3],
  'middle-third': [1 / 3, 2 / 3],
  'bottom-third': [2 / 3, 1],
};

cropPresets.addEventListener('click', (e) => {
  const presetBtn = e.target.closest('.preset-btn');
  if (!presetBtn || !currentImage) return;

  if (presetBtn === clearSelectionBtn) {
    selectionBox.hidden = true;
    selection = null;
    cropBtn.disabled = true;
    return;
  }

  applyPreset(presetBtn.dataset.preset);
});

function applyPreset(presetName) {
  const range = PRESETS[presetName];
  if (!range || !currentImage) return;

  const bounds = getImageBoundsInFrame();
  const [startFrac, endFrac] = range;
  const box = {
    left: bounds.left,
    top: bounds.top + bounds.height * startFrac,
    width: bounds.width,
    height: bounds.height * (endFrac - startFrac),
  };

  selectionBox.hidden = false;
  setSelectionBoxStyle(box);
  finalizeSelection(box);
}

// ---- Corner-handle resize (for one-handed fine-tuning) ----

let resizingHandle = null;
let resizeAnchor = null; // frame-relative point of the fixed opposite corner

selectionBox.addEventListener('mousedown', onHandleDragStart);
selectionBox.addEventListener('touchstart', onHandleDragStart, { passive: true });
window.addEventListener('mousemove', onHandleDragMove);
window.addEventListener('touchmove', onHandleDragMove, { passive: true });
window.addEventListener('mouseup', onHandleDragEnd);
window.addEventListener('touchend', onHandleDragEnd);

function onHandleDragStart(e) {
  const handle = e.target.closest('.handle');
  if (!handle) return;

  const boxRect = selectionBox.getBoundingClientRect();
  const frameRect = cropFrame.getBoundingClientRect();
  const left = boxRect.left - frameRect.left;
  const top = boxRect.top - frameRect.top;

  const corner = handle.dataset.handle;
  resizeAnchor = {
    x: corner.includes('w') ? left + boxRect.width : left,
    y: corner.includes('n') ? top + boxRect.height : top,
  };
  resizingHandle = corner;
}

function onHandleDragMove(e) {
  if (!resizingHandle) return;
  const pt = getPoint(e);
  const box = {
    left: Math.min(resizeAnchor.x, pt.x),
    top: Math.min(resizeAnchor.y, pt.y),
    width: Math.abs(pt.x - resizeAnchor.x),
    height: Math.abs(pt.y - resizeAnchor.y),
  };
  setSelectionBoxStyle(box);
}

function onHandleDragEnd() {
  if (!resizingHandle) return;
  resizingHandle = null;

  const frameRect = cropFrame.getBoundingClientRect();
  const boxRect = selectionBox.getBoundingClientRect();

  finalizeSelection({
    left: boxRect.left - frameRect.left,
    top: boxRect.top - frameRect.top,
    width: boxRect.width,
    height: boxRect.height,
  });
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
