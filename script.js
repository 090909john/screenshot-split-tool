const fileInput = document.getElementById('fileInput');
const uploadBox = document.getElementById('uploadBox');
const errorMsg = document.getElementById('errorMsg');
const originalPreview = document.getElementById('originalPreview');
const resultCanvas = document.getElementById('resultCanvas');
const downloadBtn = document.getElementById('downloadBtn');

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MIN_WIDTH_FOR_SPLIT = 2;

let resultDataUrl = null;

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
});

['dragover', 'dragleave', 'drop'].forEach((eventName) => {
  uploadBox.addEventListener(eventName, (e) => e.preventDefault());
});

uploadBox.addEventListener('dragover', () => {
  uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
  uploadBox.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFile(file);
  }
});

downloadBtn.addEventListener('click', () => {
  if (!resultDataUrl) return;
  const link = document.createElement('a');
  link.href = resultDataUrl;
  link.download = 'split-stacked-image.png';
  link.click();
});

function handleFile(file) {
  clearError();
  resetResult();

  if (!ACCEPTED_TYPES.includes(file.type)) {
    showError('不支援的檔案格式,請上傳 PNG、JPG、JPEG 或 WebP 圖片。');
    return;
  }

  const reader = new FileReader();

  reader.onerror = () => {
    showError('圖片讀取失敗,請重新選擇檔案。');
  };

  reader.onload = (e) => {
    const img = new Image();

    img.onerror = () => {
      showError('圖片讀取失敗,請確認檔案是否為有效的圖片。');
    };

    img.onload = () => {
      originalPreview.src = img.src;
      processImage(img);
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

function processImage(img) {
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

  resultDataUrl = resultCanvas.toDataURL('image/png');
  downloadBtn.disabled = false;
}

function resetResult() {
  resultDataUrl = null;
  downloadBtn.disabled = true;
  const ctx = resultCanvas.getContext('2d');
  resultCanvas.width = 0;
  resultCanvas.height = 0;
  ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = '';
}
