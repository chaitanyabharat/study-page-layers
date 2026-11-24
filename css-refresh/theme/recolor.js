/* =========================================================================
   Dark-mode chart recolor: one algorithm, used in three places
   - tools/build_dark_images.py runs it once per chart and saves dark versions
   - theme/dark-images.js runs it in a background worker as a fallback
   - nothing else; there is no second copy to drift out of sync

   Method, per pixel:
   - Neutral pixels (backgrounds, gridlines, text) are flipped: white becomes
     the dark surface, black becomes light ink, greys land in between.
   - Coloured pixels keep their hue and saturation, so bars still match their
     legends. They are only ever lightened, just enough to stand off the dark
     surface by 4.5:1, so navy titles turn into a readable light blue.
   - Pale tints (panel backgrounds) are treated like neutrals, keeping a trace
     of their hue.
   - Every step is continuous, so gradients and anti-aliased edges stay smooth.

   Guardrail: every pixel that was clearly legible against the original
   background must stay legible against the new one. If more than 3% of those
   pixels fall below a contrast of 2.5:1, the chart fails and the caller keeps
   the original on a light mat instead.
   ========================================================================= */
(function (root) {
  'use strict';
  const VERSION = 'r3';
  /* the dark theme's surface and ink; defaults are Study.com's dark tokens
     (#0c2631, #eaf2f4). recolor(img, { surface, ink }) uses other colors. */
  const DEFAULT_SURFACE = [12, 38, 49], DEFAULT_INK = [234, 242, 244];
  let SURFACE = DEFAULT_SURFACE, INK = DEFAULT_INK;

  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = lin(i);
  const lum = (r, g, b) => 0.2126 * LUT[r] + 0.7152 * LUT[g] + 0.0722 * LUT[b];
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  let SURFACE_L = lum(SURFACE[0], SURFACE[1], SURFACE[2]);
  const hex = (h) => { const m = String(h || '').match(/^#?([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  function setColors(o) {
    SURFACE = (o && hex(o.surface)) || DEFAULT_SURFACE; INK = (o && hex(o.ink)) || DEFAULT_INK;
    SURFACE_L = lum(SURFACE[0], SURFACE[1], SURFACE[2]);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }
  function hslToRgb(h, s, l) {
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }

  /* Map one pixel. Returns [r, g, b]. */
  function mapPixel(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const chroma = (max - min) / 255;
    // perceived lightness of the original, 0 (black) .. 1 (white)
    const y = Math.pow(lum(r, g, b), 1 / 2.2);
    const nt = 1 - y;
    let neutral = [SURFACE[0] + (INK[0] - SURFACE[0]) * nt, SURFACE[1] + (INK[1] - SURFACE[1]) * nt, SURFACE[2] + (INK[2] - SURFACE[2]) * nt];
    let [h, s, l] = rgbToHsl(r, g, b);
    // tinted panels keep a trace of their hue after the flip, so a pale blue card
    // becomes a dark blue card rather than a grey one
    // (off-whites with a faint warm cast stay plain, so backgrounds match the page)
    if (chroma > 0.07) {
      const nl = rgbToHsl(neutral[0], neutral[1], neutral[2])[2], k = Math.min(1, (chroma - 0.07) / 0.1);
      const t = hslToRgb(h, Math.min(0.45, s), nl);
      neutral = [neutral[0] + (t[0] - neutral[0]) * k, neutral[1] + (t[1] - neutral[1]) * k, neutral[2] + (t[2] - neutral[2]) * k];
    }
    // how "neutral" the pixel is, judged by chroma: pale tints and greys flip like
    // backgrounds, real colours (bars, swatches, titles) keep their hue. Smooth, so
    // gradients never show a seam.
    const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const w = Math.max(1 - smooth(0.16, 0.30, chroma), smooth(0.90, 0.97, l));
    if (w >= 1) return neutral;
    // coloured pixels keep hue and saturation and are only ever lightened, until they
    // stand off the dark surface by 4.5:1 (the WCAG text minimum). Navy titles become a
    // readable light blue; bars that are already light enough are untouched.
    let col = hslToRgb(h, s, l);
    while (contrast(lum(col[0], col[1], col[2]), SURFACE_L) < 4.5 && l < 0.92) { l += 0.02; col = hslToRgb(h, s, l); }
    return [col[0] * (1 - w) + neutral[0] * w, col[1] * (1 - w) + neutral[1] * w, col[2] * (1 - w) + neutral[2] * w];
  }

  /* Most common colour, sampled; used as "the background" for the guardrail. */
  function dominant(data) {
    const counts = new Map(); let best = 0, key = 0;
    for (let i = 0; i < data.length; i += 4 * 7) {
      const k = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      const c = (counts.get(k) || 0) + 1; counts.set(k, c); if (c > best) { best = c; key = k; }
    }
    return [((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4];
  }

  /* Recolour an ImageData-like object in place. Returns the guardrail result. */
  function recolor(img, opts) {
    setColors(opts);
    const d = img.data;
    const bg0 = dominant(d), bgL0 = lum(bg0[0], bg0[1], bg0[2]);
    const bg1 = mapPixel(bg0[0], bg0[1], bg0[2]).map(Math.round), bgL1 = lum(bg1[0], bg1[1], bg1[2]);
    const cache = new Map();
    let marks = 0, faint = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const k = (r << 16) | (g << 8) | b;
      let m = cache.get(k);
      if (!m) { const p = mapPixel(r, g, b); m = [Math.round(p[0]), Math.round(p[1]), Math.round(p[2])]; cache.set(k, m); }
      if ((i & 31) === 0) {                                           // guardrail sample: every 8th pixel
        if (contrast(lum(r, g, b), bgL0) >= 3) { marks++; if (contrast(lum(m[0], m[1], m[2]), bgL1) < 2.5) faint++; }
      }
      d[i] = m[0]; d[i + 1] = m[1]; d[i + 2] = m[2];
    }
    const faintShare = marks ? faint / marks : 0;
    return { version: VERSION, ok: faintShare < 0.03, faintShare: Math.round(faintShare * 1000) / 1000, marksSampled: marks,
             background: { before: bg0, after: bg1 } };
  }

  /* Does nearby article text refer to a chart by colour ("the orange bar")?
     Recolouring keeps strong hues, but the light/dark ones change, so any
     colour reference sends that chart to the light mat instead. */
  const COLOR_REF = /\b(orange|blue|yellow|red|green|grey|gray|purple|teal|navy|black|white|dark|light)\s+(?:\w+\s+){0,2}?(bars?|lines?|slices?|segments?|columns?|areas?|dots?|boxes?|colou?rs?|shad(?:e|ing))\b/i;
  function textRefersToColor(text) { const m = String(text || '').match(COLOR_REF); return m ? m[0] : ''; }

  root.StudyRecolor = { VERSION, recolor, mapPixel, textRefersToColor };
})(typeof self !== 'undefined' ? self : this);
