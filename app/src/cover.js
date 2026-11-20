// Neon Coast Cover Studio — cover renderer.
//
// Draws one GTA-poster-style multi-panel cover onto any 2D canvas context at
// any pixel size. Pure drawing code: no network, no DOM reads, no Rockstar
// artwork. Lettering uses Anton (display) and Pacifico (script), both shipped
// under app/fonts/ under the SIL Open Font License.

/** Every layout the studio offers, with its panel count and label. */
export const LAYOUTS = {
  hero: { label: 'Hero grid', panels: 4, hint: 'One hero panel, two stacked, one wide strip' },
  grid: { label: 'Four panels', panels: 4, hint: 'A classic 2 by 2 poster grid' },
  strips: { label: 'Film strips', panels: 3, hint: 'Three tall vertical strips' },
  bleed: { label: 'Full bleed', panels: 1, hint: 'One photo edge to edge, title band on top' },
};

/** Every export size the studio offers, in pixels. */
export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape · 1920 × 1080' },
};

/**
 * Every colour grade: the sky behind the panels, the wash laid over each
 * photo, the canvas filter applied while the photo is drawn, and the accent
 * colour used for the subtitle and rules.
 */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    sky: ['#1d0b3d', '#c22e6e', '#ff7e3d', '#ffc46b'],
    washTop: 'rgba(255, 126, 61, 0.30)',
    washBottom: 'rgba(255, 46, 99, 0.34)',
    filter: 'saturate(1.3) contrast(1.1)',
    accent: '#ff5fa2',
  },
  neon: {
    label: 'Neon Night',
    sky: ['#070a24', '#1b0f4b', '#4b0f66', '#0d3b4d'],
    washTop: 'rgba(255, 46, 136, 0.34)',
    washBottom: 'rgba(0, 229, 255, 0.30)',
    filter: 'saturate(1.35) contrast(1.12)',
    accent: '#00e5ff',
  },
  gold: {
    label: 'Palm Gold',
    sky: ['#3d1e05', '#8a4b12', '#e8a33d', '#ffe9a8'],
    washTop: 'rgba(232, 163, 61, 0.30)',
    washBottom: 'rgba(138, 75, 18, 0.32)',
    filter: 'saturate(1.25) contrast(1.08) sepia(0.18)',
    accent: '#ffd166',
  },
  noir: {
    label: 'Mono Noir',
    sky: ['#0c0c0e', '#2a2a30', '#55555e', '#8a8a92'],
    washTop: 'rgba(255, 255, 255, 0.10)',
    washBottom: 'rgba(0, 0, 0, 0.28)',
    filter: 'grayscale(1) contrast(1.18) brightness(1.06)',
    accent: '#ffffff',
  },
  teal: {
    label: 'Teal Heat',
    sky: ['#04202b', '#0b5563', '#e4572e', '#ff9e5e'],
    washTop: 'rgba(0, 229, 255, 0.26)',
    washBottom: 'rgba(228, 87, 46, 0.30)',
    filter: 'saturate(1.3) contrast(1.1)',
    accent: '#ff7b54',
  },
};

/** A tiny deterministic PRNG so the film grain is identical on every export. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The panel rectangles for a layout, in cover pixels. */
export function panelRects(layout, W, H, frame) {
  const m = frame ? Math.round(Math.min(W, H) * 0.028) : 0;
  const g = Math.round(Math.min(W, H) * 0.014);
  const x0 = m;
  const y0 = m;
  const w = W - 2 * m;
  const h = H - 2 * m;
  if (layout === 'grid') {
    const cw = (w - g) / 2;
    const ch = (h - g) / 2;
    return [
      { x: x0, y: y0, w: cw, h: ch },
      { x: x0 + cw + g, y: y0, w: cw, h: ch },
      { x: x0, y: y0 + ch + g, w: cw, h: ch },
      { x: x0 + cw + g, y: y0 + ch + g, w: cw, h: ch },
    ];
  }
  if (layout === 'strips') {
    const cw = (w - 2 * g) / 3;
    return [
      { x: x0, y: y0, w: cw, h },
      { x: x0 + cw + g, y: y0, w: cw, h },
      { x: x0 + 2 * (cw + g), y: y0, w: cw, h },
    ];
  }
  if (layout === 'bleed') {
    return [{ x: x0, y: y0, w, h }];
  }
  // hero: one big panel, two stacked at its side, one wide strip along the bottom.
  const heroW = w * 0.6 - g / 2;
  const sideW = w * 0.4 - g / 2;
  const topH = h * 0.58 - g / 2;
  const sideH = (topH - g) / 2;
  return [
    { x: x0, y: y0, w: heroW, h: topH },
    { x: x0 + heroW + g, y: y0, w: sideW, h: sideH },
    { x: x0 + heroW + g, y: y0 + sideH + g, w: sideW, h: sideH },
    { x: x0, y: y0 + topH + g, w, h: h - topH - g },
  ];
}

/** Draw one photo into a panel, cover-fitting it with zoom and a focus point. */
function drawPhotoCover(ctx, img, rect, zoom, fx, fy, filter) {
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) * fx;
  const dy = rect.y + (rect.h - dh) * fy;
  ctx.save();
  ctx.filter = filter || 'none';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Lay a grade's colour wash over one panel, clipped to the panel. */
function washPanel(ctx, rect, grade) {
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  wash.addColorStop(0, grade.washTop);
  wash.addColorStop(1, grade.washBottom);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.washBottom;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Shrink a font until the text fits maxWidth, then return the fitted size. */
function fitFont(ctx, text, startSize, family, maxWidth, weight) {
  let size = startSize;
  while (size > 12) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size = Math.floor(size * 0.94);
  }
  return size;
}

/** The title block: scrim, big display title, script subtitle, tagline. */
function drawTitleBlock(ctx, W, H, state, grade) {
  const onTop = state.titlePos === 'top';
  const bandH = Math.round(H * 0.24);
  const bandY = onTop ? 0 : H - bandH;
  const scrim = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (onTop) {
    scrim.addColorStop(0, 'rgba(8, 4, 20, 0.82)');
    scrim.addColorStop(1, 'rgba(8, 4, 20, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(8, 4, 20, 0)');
    scrim.addColorStop(1, 'rgba(8, 4, 20, 0.85)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY, W, bandH);

  const padX = Math.round(W * 0.055);
  const maxW = W - padX * 2;
  const title = (state.title || 'NEON COAST').toUpperCase();
  const titleSize = fitFont(ctx, title, Math.round(W * 0.115), 'Anton, sans-serif', maxW, '');
  const accent = grade.accent;
  const baseY = onTop
    ? bandY + Math.round(bandH * 0.18) + titleSize
    : H - Math.round(H * 0.085);

  // Accent drop shadow, then a black keyline, then the white face.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `${titleSize}px Anton, sans-serif`;
  try {
    ctx.letterSpacing = `${Math.round(titleSize * 0.02)}px`;
  } catch {
    // letterSpacing is new in some browsers; the cover still draws without it.
  }
  const shadowOff = Math.max(3, Math.round(titleSize * 0.07));
  ctx.fillStyle = accent;
  ctx.fillText(title, padX + shadowOff, baseY + shadowOff);
  ctx.lineWidth = Math.max(2, Math.round(titleSize * 0.09));
  ctx.strokeStyle = 'rgba(5, 2, 12, 0.9)';
  ctx.lineJoin = 'round';
  ctx.strokeText(title, padX, baseY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, padX, baseY);

  // Script subtitle in the accent colour, tucked under (or over) the title.
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = fitFont(ctx, sub, Math.round(W * 0.042), 'Pacifico, cursive', maxW, '');
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = accent;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = Math.round(subSize * 0.25);
    const subY = onTop ? baseY + Math.round(subSize * 1.5) : baseY - titleSize - Math.round(subSize * 0.35);
    ctx.fillText(sub, padX + Math.round(W * 0.01), subY);
    ctx.shadowBlur = 0;
  }

  // Tagline: small tracked capitals with an accent rule after it.
  const tag = (state.tagline || '').trim().toUpperCase();
  if (tag) {
    const tagSize = Math.max(10, Math.round(W * 0.016));
    ctx.font = `700 ${tagSize}px system-ui, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(tagSize * 0.32)}px`;
    } catch {
      // See above.
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    const tagY = onTop ? bandY + bandH - Math.round(tagSize * 1.4) : H - Math.round(tagSize * 1.6);
    const tagW = ctx.measureText(tag).width;
    ctx.fillText(tag, padX, tagY);
    const ruleY = tagY - tagSize * 0.32;
    ctx.fillStyle = accent;
    ctx.fillRect(padX + tagW + Math.round(W * 0.02), ruleY - 1, Math.round(W * 0.09), 2);
  }
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // See above.
  }
}

/** Speckle film grain and a soft vignette over the whole cover. */
function finishCover(ctx, W, H, state) {
  if (state.grain) {
    const rand = mulberry32(20261119);
    const tile = 128;
    const grain = document.createElement('canvas');
    grain.width = tile;
    grain.height = tile;
    const gctx = grain.getContext('2d');
    const image = gctx.createImageData(tile, tile);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.floor(rand() * 255);
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = Math.floor(rand() * 26);
    }
    gctx.putImageData(image, 0, 0);
    const pattern = ctx.createPattern(grain, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(5, 2, 12, 0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}

/**
 * Draw the whole cover for `state` onto `ctx` at W by H pixels.
 * `images` maps a photo src string to a loaded HTMLImageElement.
 * Panels with no photo fall back to a gradient placeholder so the layout
 * always reads as a poster, never as an empty box.
 */
export function renderCover(ctx, W, H, state, images) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const rects = panelRects(state.layout, W, H, state.frame);
  const frame = state.frame ? Math.round(Math.min(W, H) * 0.028) : 0;

  // Poster frame, then the sunset sky showing through the gutters.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const sky = ctx.createLinearGradient(0, 0, W * 0.25, H);
  grade.sky.forEach((colour, i) => sky.addColorStop(i / (grade.sky.length - 1), colour));
  ctx.fillStyle = sky;
  ctx.fillRect(frame, frame, W - 2 * frame, H - 2 * frame);

  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: null, zoom: 1, x: 0.5, y: 0.5 };
    const photo = panel.photo != null ? state.photos[panel.photo] : null;
    const img = photo ? images.get(photo.src) : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img && img.naturalWidth > 0) {
      drawPhotoCover(ctx, img, rect, panel.zoom || 1, panel.x ?? 0.5, panel.y ?? 0.5, grade.filter);
      washPanel(ctx, rect, grade);
    } else {
      // Empty panel: a dusk gradient with a sun disc, so the poster holds up
      // before any photo is loaded.
      const placeholder = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      placeholder.addColorStop(0, grade.sky[1] || grade.sky[0]);
      placeholder.addColorStop(1, grade.sky[grade.sky.length - 1]);
      ctx.fillStyle = placeholder;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 214, 130, 0.9)';
      ctx.beginPath();
      ctx.arc(rect.x + rect.w / 2, rect.y + rect.h * 0.38, Math.min(rect.w, rect.h) * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // White panel keyline, then a hairline shadow for depth.
    ctx.lineWidth = Math.max(2, Math.round(Math.min(W, H) * 0.004));
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(5, 2, 12, 0.35)';
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  });

  drawTitleBlock(ctx, W, H, state, grade);
  finishCover(ctx, W, H, state);
}
