import './styles.css';
import { makeFrameSchedule, normalizeDimension, formatDuration } from './timeline.js';
import { sampleImages } from './samples.js';

const state = {
  slides: [],
  width: 960,
  height: 960,
  fit: 'contain',
  background: '#151515',
  transition: 'fade',
  transitionMs: 350,
  transitionFps: 8,
  loop: true,
  colors: 256,
  previewing: false,
  previewRun: 0,
  outputUrl: null,
  generating: false,
};

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#top" aria-label="Koma GIF ホーム">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>Koma GIF</span>
    </a>
    <p>端末内でつくる、軽やかなGIFスライド。</p>
    <span class="privacy-pill"><span></span>画像はアップロードされません</span>
  </header>

  <section class="hero" id="top">
    <div>
      <p class="eyebrow">GIF SLIDE MAKER</p>
      <h1>画像を並べる。<br><em>動きにする。</em></h1>
      <p class="hero-copy">順番、秒数、切り替えを整えて、そのままGIFへ。<br>登録もサーバー送信もありません。</p>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="orbit orbit-one"></div>
      <div class="orbit orbit-two"></div>
      <div class="frame-card frame-a"><span>01</span></div>
      <div class="frame-card frame-b"><span>02</span></div>
      <div class="frame-card frame-c"><span>03</span></div>
    </div>
  </section>

  <section class="workspace" aria-label="GIF編集ワークスペース">
    <div class="editor-column">
      <section class="panel import-panel">
        <div class="section-heading">
          <span class="step">01</span>
          <div><h2>画像を追加</h2><p>JPG・PNG・WebPをまとめて選べます</p></div>
        </div>
        <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="画像ファイルを追加">
          <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
          <span class="plus-icon" aria-hidden="true">＋</span>
          <strong>ここに画像をドロップ</strong>
          <span>またはクリックして選択</span>
        </div>
        <button class="text-button" id="load-samples" type="button">このフォルダの5枚を読み込む <span>→</span></button>
      </section>

      <section class="panel sequence-panel">
        <div class="section-heading heading-with-count">
          <span class="step">02</span>
          <div><h2>順番と表示時間</h2><p>ドラッグ、または矢印で並べ替え</p></div>
          <span class="count" id="slide-count">0枚</span>
        </div>
        <div class="empty-sequence" id="empty-sequence">
          <span>まだ画像がありません</span>
          <small>上のエリアから追加してください</small>
        </div>
        <div class="slide-list" id="slide-list"></div>
      </section>

      <section class="panel settings-panel">
        <div class="section-heading">
          <span class="step">03</span>
          <div><h2>仕上がり</h2><p>サイズと切り替え方を指定</p></div>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="size-preset">出力サイズ</label>
          <select id="size-preset">
            <option value="960x960">正方形 · 960 × 960</option>
            <option value="1280x720">横長 · 1280 × 720</option>
            <option value="720x1280">縦長 · 720 × 1280</option>
            <option value="custom">カスタム</option>
          </select>
          <div class="dimension-row">
            <label>幅<input id="width-input" type="number" min="64" max="1600" value="960"></label>
            <span>×</span>
            <label>高さ<input id="height-input" type="number" min="64" max="1600" value="960"></label>
            <span>px</span>
          </div>
        </div>

        <div class="setting-grid">
          <fieldset class="setting-group">
            <legend class="setting-label">画像の収め方</legend>
            <div class="segmented" id="fit-control">
              <button type="button" data-fit="contain" class="active">全体を表示</button>
              <button type="button" data-fit="cover">画面いっぱい</button>
            </div>
          </fieldset>
          <div class="setting-group color-setting">
            <label class="setting-label" for="background-input">余白の色</label>
            <label class="color-control"><input id="background-input" type="color" value="#151515"><span id="background-value">#151515</span></label>
          </div>
        </div>

        <fieldset class="setting-group">
          <legend class="setting-label">切り替え</legend>
          <div class="segmented" id="transition-control">
            <button type="button" data-transition="fade" class="active">クロスフェード</button>
            <button type="button" data-transition="cut">切り替えのみ</button>
          </div>
          <label class="range-row" id="fade-row">
            <span>フェード時間</span>
            <input id="fade-input" type="range" min="100" max="1200" step="50" value="350">
            <output id="fade-output">0.35秒</output>
          </label>
        </fieldset>

        <div class="setting-grid compact-grid">
          <label class="check-row"><input id="loop-input" type="checkbox" checked><span class="fake-check">✓</span><span><strong>繰り返す</strong><small>無限ループで再生</small></span></label>
          <label class="quality-row"><span><strong>色数</strong><small>多いほど高画質</small></span><select id="colors-input"><option value="128">128色</option><option value="256" selected>256色</option></select></label>
        </div>
      </section>
    </div>

    <aside class="preview-column">
      <section class="preview-panel">
        <div class="preview-header"><div><span class="live-dot"></span>PREVIEW</div><span id="preview-meta">960 × 960</span></div>
        <div class="preview-stage" id="preview-stage">
          <div class="preview-placeholder"><span class="mini-frames">▰ ▰ ▰</span><strong>プレビュー</strong><small>画像を追加すると表示されます</small></div>
          <img id="preview-a" alt="">
          <img id="preview-b" alt="">
        </div>
        <button class="preview-button" id="preview-button" type="button" disabled><span id="preview-icon">▶</span><span id="preview-label">プレビューを再生</span></button>
      </section>

      <section class="export-panel">
        <div class="export-copy"><span class="step light">04</span><div><h2>GIFを書き出す</h2><p id="export-summary">画像を追加してください</p></div></div>
        <button class="export-button" id="export-button" type="button" disabled><span>GIFを生成</span><b>→</b></button>
        <div class="progress-wrap" id="progress-wrap" hidden>
          <div class="progress-label"><span id="progress-label">準備中…</span><span id="progress-value">0%</span></div>
          <progress id="progress" max="100" value="0"></progress>
        </div>
        <div class="result" id="result" hidden>
          <img id="result-image" alt="生成したGIF">
          <div><strong id="result-size"></strong><a id="download-link" class="download-button" download="koma-gif.gif">ダウンロード <span>↓</span></a></div>
        </div>
        <p class="error-message" id="error-message" role="alert"></p>
      </section>
    </aside>
  </section>

  <footer><span>Koma GIF</span><p>すべての処理はこのブラウザ内で行われます。</p></footer>
`;

const elements = Object.fromEntries(
  [
    'dropzone', 'file-input', 'load-samples', 'slide-list', 'empty-sequence', 'slide-count',
    'size-preset', 'width-input', 'height-input', 'fit-control', 'background-input',
    'background-value', 'transition-control', 'fade-row', 'fade-input', 'fade-output',
    'loop-input', 'colors-input', 'preview-stage', 'preview-a', 'preview-b', 'preview-button',
    'preview-icon', 'preview-label', 'preview-meta', 'export-button', 'export-summary',
    'progress-wrap', 'progress-label', 'progress-value', 'progress', 'result', 'result-image',
    'result-size', 'download-link', 'error-message',
  ].map((id) => [id, document.getElementById(id)]),
);

let draggedSlideId = null;

function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

async function imageFromUrl(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}

async function createSlide(fileOrSample) {
  const isFile = fileOrSample instanceof File;
  const url = isFile ? URL.createObjectURL(fileOrSample) : fileOrSample.url;
  const image = await imageFromUrl(url);
  return {
    id: uid(),
    name: fileOrSample.name,
    url,
    image,
    duration: 2,
    ownedUrl: isFile,
  };
}

async function addImages(items) {
  clearError();
  const accepted = [...items].filter((item) => {
    if (!(item instanceof File)) return true;
    return ['image/jpeg', 'image/png', 'image/webp'].includes(item.type);
  });

  if (!accepted.length) {
    showError('JPG・PNG・WebP形式の画像を選んでください。');
    return;
  }

  try {
    const slides = await Promise.all(accepted.map(createSlide));
    state.slides.push(...slides);
    renderSlides();
    refreshUi();
  } catch {
    showError('読み込めない画像がありました。別のファイルをお試しください。');
  }
}

function releaseSlide(slide) {
  if (slide?.ownedUrl) URL.revokeObjectURL(slide.url);
}

function renderSlides() {
  elements['slide-list'].innerHTML = state.slides.map((slide, index) => `
    <article class="slide-card" draggable="true" data-id="${slide.id}">
      <button class="drag-handle" type="button" title="ドラッグして並べ替え" aria-label="${index + 1}番目を並べ替え">⠿</button>
      <span class="slide-number">${String(index + 1).padStart(2, '0')}</span>
      <img src="${slide.url}" alt="">
      <div class="slide-info"><strong title="${escapeHtml(slide.name)}">${escapeHtml(slide.name)}</strong><small>${slide.image.naturalWidth} × ${slide.image.naturalHeight}</small></div>
      <label class="duration-control"><span>表示</span><input type="number" min="0.2" max="30" step="0.1" value="${slide.duration}" data-action="duration"><span>秒</span></label>
      <div class="move-buttons">
        <button type="button" data-action="up" title="前へ" aria-label="前へ" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-action="down" title="後へ" aria-label="後へ" ${index === state.slides.length - 1 ? 'disabled' : ''}>↓</button>
      </div>
      <button class="remove-button" type="button" data-action="remove" title="削除" aria-label="削除">×</button>
    </article>
  `).join('');

  elements['empty-sequence'].hidden = state.slides.length > 0;
  elements['slide-list'].hidden = state.slides.length === 0;
  elements['slide-count'].textContent = `${state.slides.length}枚`;
}

function moveSlide(fromIndex, toIndex) {
  if (fromIndex === toIndex || toIndex < 0 || toIndex >= state.slides.length) return;
  const [slide] = state.slides.splice(fromIndex, 1);
  state.slides.splice(toIndex, 0, slide);
  renderSlides();
  refreshUi();
}

function refreshUi() {
  const hasSlides = state.slides.length > 0;
  elements['preview-button'].disabled = !hasSlides || state.generating;
  elements['export-button'].disabled = !hasSlides || state.generating;
  elements['preview-meta'].textContent = `${state.width} × ${state.height}`;
  elements['preview-stage'].style.aspectRatio = `${state.width} / ${state.height}`;
  elements['preview-stage'].style.backgroundColor = state.background;
  [elements['preview-a'], elements['preview-b']].forEach((image) => {
    image.style.objectFit = state.fit;
  });

  const total = state.slides.reduce((sum, slide) => sum + Number(slide.duration), 0);
  elements['export-summary'].textContent = hasSlides
    ? `${state.slides.length}枚 · 約${total.toFixed(1)}秒 · ${state.width} × ${state.height}`
    : '画像を追加してください';

  const placeholder = elements['preview-stage'].querySelector('.preview-placeholder');
  placeholder.hidden = hasSlides;
  if (hasSlides && !state.previewing) {
    elements['preview-a'].src = state.slides[0].url;
    elements['preview-a'].style.opacity = '1';
    elements['preview-b'].style.opacity = '0';
  }
}

function stopPreview() {
  state.previewing = false;
  state.previewRun += 1;
  elements['preview-icon'].textContent = '▶';
  elements['preview-label'].textContent = 'プレビューを再生';
  refreshUi();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playPreview() {
  if (state.previewing) {
    stopPreview();
    return;
  }

  state.previewing = true;
  const run = ++state.previewRun;
  elements['preview-icon'].textContent = '■';
  elements['preview-label'].textContent = '停止';

  do {
    for (let index = 0; index < state.slides.length; index += 1) {
      if (!state.previewing || run !== state.previewRun) return;
      const current = state.slides[index];
      const hasNext = index < state.slides.length - 1 || state.loop;
      const next = state.slides[(index + 1) % state.slides.length];
      const fadeMs = state.transition === 'fade' && hasNext && state.slides.length > 1
        ? Math.min(state.transitionMs, current.duration * 1000 - 20)
        : 0;

      elements['preview-a'].src = current.url;
      elements['preview-a'].style.transition = 'none';
      elements['preview-a'].style.opacity = '1';
      elements['preview-b'].style.transition = 'none';
      elements['preview-b'].style.opacity = '0';
      await wait(Math.max(20, current.duration * 1000 - fadeMs));
      if (!state.previewing || run !== state.previewRun) return;

      if (fadeMs > 0) {
        elements['preview-b'].src = next.url;
        elements['preview-b'].style.transition = `opacity ${fadeMs}ms linear`;
        requestAnimationFrame(() => { elements['preview-b'].style.opacity = '1'; });
        await wait(fadeMs);
      }
    }
  } while (state.loop && state.previewing && run === state.previewRun);

  stopPreview();
}

function drawImage(canvas, image, opacity = 1) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const canvasRatio = canvas.width / canvas.height;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  let drawWidth;
  let drawHeight;

  if ((state.fit === 'contain' && imageRatio > canvasRatio) || (state.fit === 'cover' && imageRatio < canvasRatio)) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / imageRatio;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * imageRatio;
  }

  context.save();
  context.globalAlpha = opacity;
  context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function renderFrame(canvas, frame) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.globalAlpha = 1;
  context.fillStyle = state.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawImage(canvas, state.slides[frame.from].image, 1);
  if (frame.mix > 0) drawImage(canvas, state.slides[frame.to].image, frame.mix);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function workerMessage(worker, expectedType) {
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      if (event.data.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(event.data.message));
      } else if (event.data.type === expectedType) {
        worker.removeEventListener('message', handler);
        resolve(event.data);
      }
    };
    worker.addEventListener('message', handler);
  });
}

function setProgress(completed, total, label = 'GIFを生成中…') {
  const percent = Math.round((completed / total) * 100);
  elements['progress'].value = percent;
  elements['progress-value'].textContent = `${percent}%`;
  elements['progress-label'].textContent = label;
}

async function generateGif() {
  if (!state.slides.length || state.generating) return;
  stopPreview();
  clearError();
  state.generating = true;
  elements['result'].hidden = true;
  elements['progress-wrap'].hidden = false;
  elements['export-button'].querySelector('span').textContent = '生成しています…';
  refreshUi();

  state.width = normalizeDimension(elements['width-input'].value, state.width);
  state.height = normalizeDimension(elements['height-input'].value, state.height);
  elements['width-input'].value = state.width;
  elements['height-input'].value = state.height;

  const frames = makeFrameSchedule(state.slides, {
    transition: state.transition,
    transitionMs: state.transitionMs,
    transitionFps: state.transitionFps,
    loop: state.loop,
  });
  const canvas = document.createElement('canvas');
  canvas.width = state.width;
  canvas.height = state.height;
  const worker = new Worker(new URL('./gif-worker.js', import.meta.url), { type: 'module' });

  try {
    worker.postMessage({ type: 'start', width: state.width, height: state.height, repeat: state.loop ? 0 : -1 });
    await workerMessage(worker, 'ready');

    for (let index = 0; index < frames.length; index += 1) {
      setProgress(index, frames.length);
      const imageData = renderFrame(canvas, frames[index]);
      worker.postMessage({
        type: 'frame',
        pixels: imageData.data.buffer,
        delay: frames[index].delay,
        colors: state.colors,
      }, [imageData.data.buffer]);
      await workerMessage(worker, 'frame-complete');
    }

    setProgress(frames.length, frames.length, '仕上げ中…');
    worker.postMessage({ type: 'finish' });
    const message = await workerMessage(worker, 'complete');
    const blob = new Blob([message.bytes], { type: 'image/gif' });

    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = URL.createObjectURL(blob);
    elements['result-image'].src = state.outputUrl;
    elements['download-link'].href = state.outputUrl;
    elements['result-size'].textContent = `${(blob.size / 1024 / 1024).toFixed(2)} MB`;
    elements['result'].hidden = false;
    elements['progress-wrap'].hidden = true;
  } catch (error) {
    showError(`GIFを生成できませんでした：${error.message}`);
    elements['progress-wrap'].hidden = true;
  } finally {
    worker.terminate();
    state.generating = false;
    elements['export-button'].querySelector('span').textContent = 'GIFを生成';
    refreshUi();
  }
}

function showError(message) {
  elements['error-message'].textContent = message;
}

function clearError() {
  elements['error-message'].textContent = '';
}

elements.dropzone.addEventListener('click', () => elements['file-input'].click());
elements.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') elements['file-input'].click();
});
elements['file-input'].addEventListener('change', (event) => {
  addImages(event.target.files);
  event.target.value = '';
});

['dragenter', 'dragover'].forEach((type) => elements.dropzone.addEventListener(type, (event) => {
  event.preventDefault();
  elements.dropzone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((type) => elements.dropzone.addEventListener(type, (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove('dragging');
}));
elements.dropzone.addEventListener('drop', (event) => addImages(event.dataTransfer.files));

elements['load-samples'].addEventListener('click', () => {
  if (state.slides.length && !window.confirm('現在の画像を置き換えて、このフォルダの5枚を読み込みますか？')) return;
  state.slides.forEach(releaseSlide);
  state.slides = [];
  addImages(sampleImages);
});

elements['slide-list'].addEventListener('input', (event) => {
  if (event.target.dataset.action !== 'duration') return;
  const card = event.target.closest('.slide-card');
  const slide = state.slides.find((item) => item.id === card.dataset.id);
  slide.duration = Math.min(30, Math.max(0.2, Number(event.target.value) || 2));
  refreshUi();
});

elements['slide-list'].addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  const card = event.target.closest('.slide-card');
  const index = state.slides.findIndex((slide) => slide.id === card.dataset.id);
  if (action === 'up') moveSlide(index, index - 1);
  if (action === 'down') moveSlide(index, index + 1);
  if (action === 'remove') {
    releaseSlide(state.slides[index]);
    state.slides.splice(index, 1);
    renderSlides();
    stopPreview();
  }
});

elements['slide-list'].addEventListener('dragstart', (event) => {
  const card = event.target.closest('.slide-card');
  if (!card) return;
  draggedSlideId = card.dataset.id;
  card.classList.add('is-dragging');
});
elements['slide-list'].addEventListener('dragend', (event) => {
  event.target.closest('.slide-card')?.classList.remove('is-dragging');
  draggedSlideId = null;
});
elements['slide-list'].addEventListener('dragover', (event) => event.preventDefault());
elements['slide-list'].addEventListener('drop', (event) => {
  event.preventDefault();
  const target = event.target.closest('.slide-card');
  if (!target || !draggedSlideId || target.dataset.id === draggedSlideId) return;
  const fromIndex = state.slides.findIndex((slide) => slide.id === draggedSlideId);
  const toIndex = state.slides.findIndex((slide) => slide.id === target.dataset.id);
  moveSlide(fromIndex, toIndex);
});

elements['size-preset'].addEventListener('change', (event) => {
  if (event.target.value === 'custom') return;
  [state.width, state.height] = event.target.value.split('x').map(Number);
  elements['width-input'].value = state.width;
  elements['height-input'].value = state.height;
  refreshUi();
});

function updateCustomSize() {
  state.width = normalizeDimension(elements['width-input'].value, state.width);
  state.height = normalizeDimension(elements['height-input'].value, state.height);
  elements['size-preset'].value = 'custom';
  refreshUi();
}
elements['width-input'].addEventListener('change', updateCustomSize);
elements['height-input'].addEventListener('change', updateCustomSize);

elements['fit-control'].addEventListener('click', (event) => {
  const fit = event.target.dataset.fit;
  if (!fit) return;
  state.fit = fit;
  [...elements['fit-control'].children].forEach((button) => button.classList.toggle('active', button.dataset.fit === fit));
  refreshUi();
});

elements['background-input'].addEventListener('input', (event) => {
  state.background = event.target.value;
  elements['background-value'].textContent = state.background.toUpperCase();
  refreshUi();
});

elements['transition-control'].addEventListener('click', (event) => {
  const transition = event.target.dataset.transition;
  if (!transition) return;
  state.transition = transition;
  [...elements['transition-control'].children].forEach((button) => button.classList.toggle('active', button.dataset.transition === transition));
  elements['fade-row'].hidden = transition === 'cut';
});

elements['fade-input'].addEventListener('input', (event) => {
  state.transitionMs = Number(event.target.value);
  elements['fade-output'].textContent = `${(state.transitionMs / 1000).toFixed(2)}秒`;
});

elements['loop-input'].addEventListener('change', (event) => {
  state.loop = event.target.checked;
  if (!state.loop && state.previewing) stopPreview();
});
elements['colors-input'].addEventListener('change', (event) => { state.colors = Number(event.target.value); });
elements['preview-button'].addEventListener('click', playPreview);
elements['export-button'].addEventListener('click', generateGif);

window.addEventListener('beforeunload', () => {
  state.slides.forEach(releaseSlide);
  if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
});

renderSlides();
refreshUi();
