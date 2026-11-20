// Neon Coast Cover Studio — editor.
//
// Owns the app state, the control panel, the live preview canvas and the PNG
// exports. Photos never leave the machine: uploads are read as data URLs and
// drawn locally. The cover itself is drawn by src/cover.js.

import { GRADES, LAYOUTS, SIZES, panelRects, renderCover } from './cover.js';

/** The two demo photos shipped with the app (made with an image model, free to use). */
export const SAMPLE_PHOTOS = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
];

/** A fresh default state: hero grid, sunset grade, both samples loaded. */
export function defaultState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    size: '1080x1080',
    title: 'NEON COAST',
    subtitle: 'Neon nights, your story',
    tagline: 'Est. 2026 · Neon Coast',
    titlePos: 'bottom',
    frame: true,
    grain: true,
    vignette: true,
    photos: SAMPLE_PHOTOS.map((p) => ({ ...p })),
    panels: [
      // Focus points sit high (y ~0.25-0.3): the demo photos are portraits,
      // and a wide panel cropped at centre would lose the subject's face.
      { photo: 0, zoom: 1, x: 0.5, y: 0.25 },
      { photo: 1, zoom: 1, x: 0.5, y: 0.3 },
      { photo: 0, zoom: 1.15, x: 0.5, y: 0.3 },
      { photo: 1, zoom: 1, x: 0.5, y: 0.3 },
    ],
    selected: 0,
  };
}

/** Resize the panels array when the layout changes, keeping assignments. */
export function panelsForLayout(state) {
  const count = LAYOUTS[state.layout].panels;
  const panels = state.panels.slice(0, count);
  while (panels.length < count) {
    const last = panels[panels.length - 1] || { photo: 0, zoom: 1, x: 0.5, y: 0.5 };
    panels.push({ ...last });
  }
  return panels;
}

/** Load every photo in the state once and keep the Image objects cached. */
const imageCache = new Map();
export function loadPhoto(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

async function loadedImages(state) {
  const images = new Map();
  for (const photo of state.photos) {
    const img = await loadPhoto(photo.src);
    if (img) images.set(photo.src, img);
  }
  return images;
}

/** Draw the state's cover onto a canvas of the given pixel size. */
export async function drawCoverTo(canvas, W, H, state) {
  const images = await loadedImages(state);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, W, H, state, images);
  return canvas;
}

/** Download a canvas as a PNG file. */
function downloadPng(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
}

/** Wire the editor: controls, preview canvas, drag-to-pan, exports. */
export function startEditor(canvas, preset) {
  const state = preset || defaultState();
  state.panels = panelsForLayout(state);
  if (state.selected >= state.panels.length) state.selected = 0;

  const $ = (id) => document.getElementById(id);
  const history = [];
  let future = [];
  let previewScale = 1;

  function snapshot() {
    return JSON.stringify({ ...state, photos: state.photos, panels: state.panels });
  }

  function commit() {
    history.push(snapshot());
    if (history.length > 60) history.shift();
    future = [];
    syncUndoButtons();
  }

  function restore(json) {
    const next = JSON.parse(json);
    Object.assign(state, next);
    state.panels = panelsForLayout(state);
    syncControls();
    redraw();
  }

  function undo() {
    if (history.length === 0) return;
    future.push(snapshot());
    restore(history.pop());
    syncUndoButtons();
  }

  function redo() {
    if (future.length === 0) return;
    history.push(snapshot());
    restore(future.pop());
    syncUndoButtons();
  }

  function syncUndoButtons() {
    $('undoBtn').disabled = history.length === 0;
    $('redoBtn').disabled = future.length === 0;
  }

  /** Size the preview canvas to its box, keeping the export aspect. */
  function fitPreview() {
    const size = SIZES[state.size];
    const box = canvas.parentElement.getBoundingClientRect();
    const pad = 8;
    const availW = Math.max(240, box.width - pad * 2);
    const availH = Math.max(240, box.height - pad * 2);
    const scale = Math.min(availW / size.w, availH / size.h);
    const cssW = Math.round(size.w * scale);
    const cssH = Math.round(size.h * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    previewScale = (cssW * dpr) / size.w;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  async function redraw() {
    fitPreview();
    const images = await loadedImages(state);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(previewScale, 0, 0, previewScale, 0, 0);
    const size = SIZES[state.size];
    renderCover(ctx, size.w, size.h, state, images);
    syncPanelLabel();
  }

  function syncPanelLabel() {
    const panel = state.panels[state.selected];
    const photo = panel && panel.photo != null ? state.photos[panel.photo] : null;
    $('panelLabel').textContent = panel
      ? `Panel ${state.selected + 1} of ${state.panels.length} · ${photo ? photo.name : 'no photo yet'}`
      : 'No panel selected';
    $('sizeLabel').textContent = `${SIZES[state.size].label} · ${LAYOUTS[state.layout].label} · ${GRADES[state.grade].label}`;
  }

  /** Rebuild the photo library thumbnails. */
  function syncPhotos() {
    const list = $('photoList');
    list.innerHTML = '';
    state.photos.forEach((photo, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'photo-thumb';
      button.title = `Use ${photo.name} in the selected panel`;
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.name;
      const label = document.createElement('span');
      label.textContent = photo.name;
      button.append(img, label);
      button.addEventListener('click', () => {
        commit();
        state.panels[state.selected].photo = i;
        redraw();
      });
      list.appendChild(button);
    });
  }

  /** Reflect the state in every control. */
  function syncControls() {
    document.querySelectorAll('#layoutBtns button').forEach((b) => {
      b.classList.toggle('active', b.dataset.layout === state.layout);
      b.title = LAYOUTS[b.dataset.layout].hint;
    });
    document.querySelectorAll('#gradeBtns button').forEach((b) => {
      b.classList.toggle('active', b.dataset.grade === state.grade);
    });
    document.querySelectorAll('#sizeBtns button').forEach((b) => {
      b.classList.toggle('active', b.dataset.size === state.size);
    });
    $('titleInput').value = state.title;
    $('subtitleInput').value = state.subtitle;
    $('taglineInput').value = state.tagline;
    $('titlePosSelect').value = state.titlePos;
    $('frameToggle').checked = state.frame;
    $('grainToggle').checked = state.grain;
    $('vignetteToggle').checked = state.vignette;
    const panel = state.panels[state.selected];
    if (panel) {
      $('zoomRange').value = panel.zoom;
      $('panXRange').value = panel.x;
      $('panYRange').value = panel.y;
    }
    syncPhotos();
  }

  // -- layout, grade and size pickers -------------------------------------
  document.querySelectorAll('#layoutBtns button').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.layout === state.layout) return;
      commit();
      state.layout = button.dataset.layout;
      state.panels = panelsForLayout(state);
      state.selected = 0;
      syncControls();
      redraw();
    });
  });
  document.querySelectorAll('#gradeBtns button').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.grade === state.grade) return;
      commit();
      state.grade = button.dataset.grade;
      syncControls();
      redraw();
    });
  });
  document.querySelectorAll('#sizeBtns button').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.size === state.size) return;
      commit();
      state.size = button.dataset.size;
      syncControls();
      redraw();
    });
  });

  // -- caption editing ------------------------------------------------------
  const bindText = (id, key) => {
    $(id).addEventListener('input', (event) => {
      state[key] = event.target.value;
      redraw();
    });
    $(id).addEventListener('change', () => commit());
  };
  bindText('titleInput', 'title');
  bindText('subtitleInput', 'subtitle');
  bindText('taglineInput', 'tagline');
  $('titlePosSelect').addEventListener('change', (event) => {
    commit();
    state.titlePos = event.target.value;
    redraw();
  });

  // -- panel crop controls --------------------------------------------------
  const panel = () => state.panels[state.selected];
  $('zoomRange').addEventListener('input', (event) => {
    panel().zoom = Number(event.target.value);
    redraw();
  });
  $('zoomRange').addEventListener('change', () => commit());
  $('panXRange').addEventListener('input', (event) => {
    panel().x = Number(event.target.value);
    redraw();
  });
  $('panXRange').addEventListener('change', () => commit());
  $('panYRange').addEventListener('input', (event) => {
    panel().y = Number(event.target.value);
    redraw();
  });
  $('panYRange').addEventListener('change', () => commit());
  $('fillAllBtn').addEventListener('click', () => {
    const photo = panel().photo;
    if (photo == null) return;
    commit();
    state.panels.forEach((p) => { p.photo = photo; });
    redraw();
  });
  $('clearPanelBtn').addEventListener('click', () => {
    commit();
    panel().photo = null;
    redraw();
  });

  // -- effect toggles -------------------------------------------------------
  const bindToggle = (id, key) => {
    $(id).addEventListener('change', (event) => {
      commit();
      state[key] = event.target.checked;
      redraw();
    });
  };
  bindToggle('frameToggle', 'frame');
  bindToggle('grainToggle', 'grain');
  bindToggle('vignetteToggle', 'vignette');

  // -- photo uploads --------------------------------------------------------
  $('uploadInput').addEventListener('change', async (event) => {
    const files = [...event.target.files].filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    commit();
    for (const file of files.slice(0, 4)) {
      const src = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      state.photos.push({ name: file.name.replace(/\.[^.]+$/, ''), src });
    }
    state.panels[state.selected].photo = state.photos.length - 1;
    syncControls();
    redraw();
    event.target.value = '';
  });

  // -- canvas: click to select a panel, drag to pan it, wheel to zoom ------
  let dragging = null;
  function panelAt(event) {
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const size = SIZES[state.size];
    const rects = panelRects(state.layout, size.w, size.h, state.frame);
    const x = px * size.w;
    const y = py * size.h;
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }
  canvas.addEventListener('pointerdown', (event) => {
    const hit = panelAt(event);
    if (hit < 0) return;
    canvas.setPointerCapture(event.pointerId);
    if (hit !== state.selected) {
      state.selected = hit;
      syncControls();
      redraw();
    }
    const p = panel();
    dragging = { x: event.clientX, y: event.clientY, fx: p.x, fy: p.y };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const size = SIZES[state.size];
    const rects = panelRects(state.layout, size.w, size.h, state.frame);
    const r = rects[state.selected];
    const p = panel();
    p.x = Math.min(1, Math.max(0, dragging.fx + ((event.clientX - dragging.x) / rect.width) * (size.w / r.w)));
    p.y = Math.min(1, Math.max(0, dragging.fy + ((event.clientY - dragging.y) / rect.height) * (size.h / r.h)));
    $('panXRange').value = p.x;
    $('panYRange').value = p.y;
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (dragging) {
      dragging = null;
      commit();
    }
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const p = panel();
    p.zoom = Math.min(3, Math.max(1, p.zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
    $('zoomRange').value = p.zoom;
    redraw();
  }, { passive: false });

  // -- history, shuffle, reset, export --------------------------------------
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
  });
  $('shuffleBtn').addEventListener('click', () => {
    commit();
    const layouts = Object.keys(LAYOUTS);
    const grades = Object.keys(GRADES);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    state.panels = panelsForLayout(state);
    state.panels.forEach((p) => {
      p.photo = Math.floor(Math.random() * state.photos.length);
      p.zoom = 1 + Math.random() * 0.5;
    });
    state.selected = 0;
    syncControls();
    redraw();
  });
  $('resetBtn').addEventListener('click', () => {
    commit();
    const fresh = defaultState();
    Object.assign(state, fresh);
    state.panels = panelsForLayout(state);
    syncControls();
    redraw();
  });
  $('exportBtn').addEventListener('click', async () => {
    const size = SIZES[state.size];
    const offscreen = document.createElement('canvas');
    await drawCoverTo(offscreen, size.w, size.h, state);
    downloadPng(offscreen, `${slug(state.title)}-${state.size}.png`);
  });
  $('exportAllBtn').addEventListener('click', async () => {
    for (const key of Object.keys(SIZES)) {
      const size = SIZES[key];
      const offscreen = document.createElement('canvas');
      await drawCoverTo(offscreen, size.w, size.h, state);
      downloadPng(offscreen, `${slug(state.title)}-${key}.png`);
    }
  });

  window.addEventListener('resize', redraw);
  document.fonts.ready.then(redraw);
  syncControls();
  syncUndoButtons();
  redraw();
  return { state, redraw };
}
