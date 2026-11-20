// Neon Coast Cover Studio — boot and screenshot mode.
//
// Normal visit: starts the editor. A `?shot=` visit renders one fixed scene
// for the entry's screenshots, so the maker can capture the app exactly as
// submitted:
//   ?shot=cover&size=1920x1080&photo=boulevard&caption=NEON%20COAST
//       draws the exported cover full-frame (no editor chrome).
//   ?shot=editor&photo=boulevard
//       shows the editor with a sample photo loaded.
// Query keys: photo, photo2, photo3, photo4 (sample names boulevard / pier),
// caption, subtitle, layout, grade, size, titlepos.

import { GRADES, LAYOUTS, SIZES, renderCover } from './cover.js';
import { SAMPLE_PHOTOS, defaultState, drawCoverTo, loadPhoto, startEditor } from './main.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

/** A sample photo by its short name, or null. */
function sampleByName(name) {
  return SAMPLE_PHOTOS.find((p) => p.name.toLowerCase() === (name || '').toLowerCase()) || null;
}

/** Build a state from the shot query, falling back to the editor defaults. */
function stateFromQuery() {
  const state = defaultState();
  const layout = params.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const grade = params.get('grade');
  if (grade && GRADES[grade]) state.grade = grade;
  const size = params.get('size');
  if (size && SIZES[size]) state.size = size;
  const caption = params.get('caption');
  if (caption) state.title = caption;
  const subtitle = params.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const titlePos = params.get('titlepos');
  if (titlePos === 'top' || titlePos === 'bottom') state.titlePos = titlePos;

  // photo, photo2, ... assign sample photos to the panels in order.
  const picks = ['photo', 'photo2', 'photo3', 'photo4']
    .map((key) => sampleByName(params.get(key)))
    .filter(Boolean);
  if (picks.length > 0) {
    state.photos = picks.map((p) => ({ ...p }));
    state.panels.forEach((panel, i) => {
      panel.photo = i % picks.length;
    });
  }
  return state;
}

/** Full-frame cover mode: hide the editor, draw the cover at window size. */
async function shotCover() {
  document.body.classList.add('shot-cover');
  const canvas = document.getElementById('stage');
  const state = stateFromQuery();
  const size = SIZES[state.size];
  // Match the window to the cover's aspect so the drawing fills the frame.
  const scale = Math.min(window.innerWidth / size.w, window.innerHeight / size.h);
  const W = Math.round(size.w * scale);
  const H = Math.round(size.h * scale);
  try {
    await document.fonts.load(`${Math.round(W * 0.1)}px Anton`);
    await document.fonts.load(`${Math.round(W * 0.04)}px Pacifico`);
    await document.fonts.ready;
  } catch {
    // Fonts fall back to system faces; the cover still draws.
  }
  for (const photo of state.photos) await loadPhoto(photo.src);
  const images = new Map();
  for (const photo of state.photos) {
    const img = await loadPhoto(photo.src);
    if (img) images.set(photo.src, img);
  }
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  renderCover(canvas.getContext('2d'), W, H, state, images);
  document.title = 'Neon Coast — cover ready';
  window.__coverReady = true;
}

/** Editor mode: the normal app, with any query preset applied. */
function shotEditor() {
  const state = stateFromQuery();
  const canvas = document.getElementById('stage');
  startEditor(canvas, state);
  document.title = 'Neon Coast — editor ready';
  window.__coverReady = true;
}

if (shot === 'cover') {
  shotCover();
} else {
  shotEditor();
}

// Keep the export helper reachable for shot scripts that drive the page.
export { drawCoverTo };
