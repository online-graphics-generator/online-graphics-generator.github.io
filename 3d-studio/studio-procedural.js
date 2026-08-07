(function () {
  'use strict';

  const Core = window.StudioCore;
  const clamp = Core?.clamp || ((value, min, max) => Math.min(max, Math.max(min, value)));

  const KINDS = Object.freeze([
    ['marble', 'Marble'],
    ['clouds', 'Clouds'],
    ['patina', 'Patina'],
    ['speckle', 'Speckle'],
    ['rings', 'Growth rings'],
    ['weave', 'Woven fibers'],
    ['tiles', 'Stone tiles'],
    ['cellular', 'Cellular'],
    ['topographic', 'Topographic'],
    ['cracks', 'Cracked paint'],
    ['brushed', 'Brushed metal']
  ]);

  function parseColor(value, fallback = '#50d08a') {
    const text = String(value || fallback).trim();
    const match = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (match) {
      return {
        r: clamp(Math.round(Number(match[1])), 0, 255),
        g: clamp(Math.round(Number(match[2])), 0, 255),
        b: clamp(Math.round(Number(match[3])), 0, 255)
      };
    }
    const raw = text.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw.padEnd(6, '0').slice(0, 6);
    const number = Number.parseInt(hex, 16);
    if (!Number.isFinite(number)) return parseColor(fallback, '#50d08a');
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  function mixColor(a, b, amount) {
    const t = clamp(amount, 0, 1);
    return {
      r: Math.round(a.r * (1 - t) + b.r * t),
      g: Math.round(a.g * (1 - t) + b.g * t),
      b: Math.round(a.b * (1 - t) + b.b * t)
    };
  }

  function hash2(x, y, seed = 0) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function smoothNoise(u, v, frequency, seed) {
    const x = u * frequency;
    const y = v * frequency;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash2(x0, y0, seed);
    const b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed);
    const d = hash2(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function fbm(u, v, scale, detail, seed) {
    const octaves = Math.round(3 + detail * 4);
    let value = 0;
    let amplitude = 0.56;
    let total = 0;
    let frequency = Math.max(1, scale);
    for (let octave = 0; octave < octaves; octave += 1) {
      value += smoothNoise(u, v, frequency, seed + octave * 9.17) * amplitude;
      total += amplitude;
      frequency *= 2;
      amplitude *= 0.52;
    }
    return total ? value / total : 0;
  }

  function cellular(u, v, scale, seed) {
    const x = u * scale;
    const y = v * scale;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let nearest = 8;
    let second = 8;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const cx = ix + ox + hash2(ix + ox, iy + oy, seed);
        const cy = iy + oy + hash2(ix + ox, iy + oy, seed + 4.3);
        const distance = Math.hypot(x - cx, y - cy);
        if (distance < nearest) {
          second = nearest;
          nearest = distance;
        } else if (distance < second) {
          second = distance;
        }
      }
    }
    return { nearest, edge: second - nearest };
  }

  function applyContrast(value, contrast) {
    const amount = 0.35 + contrast * 1.45;
    return clamp((value - 0.5) * amount + 0.5, 0, 1);
  }

  function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function patternValue(kind, u, v, options) {
    const scale = options.scale;
    const detail = options.detail;
    const seed = options.seed;
    const noise = fbm(u, v, scale, detail, seed);

    if (kind === 'marble') {
      return 0.5 + 0.5 * Math.sin((u * scale * 0.72 + noise * (2.8 + detail * 4)) * Math.PI * 2);
    }
    if (kind === 'clouds') {
      return Math.pow(noise, 1.15 + detail * 0.7);
    }
    if (kind === 'patina') {
      const blooms = Math.max(0, noise - 0.42) * 1.7;
      return clamp(blooms + smoothNoise(u, v, scale * 2.4, seed + 23) * 0.28, 0, 1);
    }
    if (kind === 'speckle') {
      const dot = hash2(Math.floor(u * scale * 18), Math.floor(v * scale * 18), seed);
      return clamp(noise * 0.38 + (dot > 0.82 - detail * 0.18 ? 1 : 0) * 0.82, 0, 1);
    }
    if (kind === 'rings') {
      const dx = u - 0.5 + (noise - 0.5) * 0.12;
      const dy = v - 0.5 + (fbm(u + 7.1, v - 3.2, scale, detail, seed) - 0.5) * 0.12;
      return 0.5 + 0.5 * Math.sin((Math.hypot(dx, dy) * scale * 2.8 + noise * 1.35) * Math.PI * 2);
    }
    if (kind === 'weave') {
      const warp = (noise - 0.5) * 0.12 * detail;
      const x = 0.5 + 0.5 * Math.sin((u + warp) * scale * Math.PI * 2);
      const y = 0.5 + 0.5 * Math.sin((v - warp) * scale * Math.PI * 2);
      return clamp(Math.max(x, y) * 0.78 + Math.min(x, y) * 0.22, 0, 1);
    }
    if (kind === 'tiles') {
      const grout = 0.055 + detail * 0.04;
      const tx = (u * scale) % 1;
      const ty = (v * scale) % 1;
      const edge = Math.min(tx, 1 - tx, ty, 1 - ty);
      const tileShade = smoothNoise(Math.floor(u * scale), Math.floor(v * scale), 1, seed);
      return edge < grout ? 0.05 : clamp(0.35 + tileShade * 0.45 + noise * 0.2, 0, 1);
    }
    if (kind === 'cellular') {
      const cell = cellular(u, v, scale * 1.2, seed);
      return clamp(1 - cell.nearest * 1.15 + cell.edge * (0.35 + detail), 0, 1);
    }
    if (kind === 'topographic') {
      const bands = Math.abs(((noise * scale * 0.55) % 1) - 0.5) * 2;
      return clamp(1 - Math.pow(bands, 0.2 + detail * 0.45), 0, 1);
    }
    if (kind === 'cracks') {
      const cell = cellular(u, v, scale, seed);
      const crack = cell.edge < 0.065 + detail * 0.035 ? 0 : 1;
      return clamp(crack * (0.45 + noise * 0.55), 0, 1);
    }
    if (kind === 'brushed') {
      const grain = smoothNoise(u, v, scale * 14, seed) * 0.22;
      const streak = 0.5 + 0.5 * Math.sin((u * scale * 8 + noise * (1.2 + detail * 2.5)) * Math.PI * 2);
      return clamp(streak * 0.38 + grain + 0.28, 0, 1);
    }
    return noise;
  }

  function generate(canvas, rawOptions = {}) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const options = {
      kind: rawOptions.kind || 'marble',
      primary: parseColor(rawOptions.primary || '#7fd99a'),
      secondary: parseColor(rawOptions.secondary || '#15281b'),
      scale: clamp(finiteOr(rawOptions.scale, 8), 1, 64),
      detail: clamp(finiteOr(rawOptions.detail, 0.55), 0, 1),
      contrast: clamp(finiteOr(rawOptions.contrast, 0.7), 0, 1),
      seed: Number.isFinite(Number(rawOptions.seed)) ? Number(rawOptions.seed) : Math.random() * 10000
    };
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      const v = y / Math.max(1, height - 1);
      for (let x = 0; x < width; x += 1) {
        const u = x / Math.max(1, width - 1);
        const value = applyContrast(patternValue(options.kind, u, v, options), options.contrast);
        const color = mixColor(options.secondary, options.primary, value);
        const index = (y * width + x) * 4;
        image.data[index] = color.r;
        image.data[index + 1] = color.g;
        image.data[index + 2] = color.b;
        image.data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return options;
  }

  function label(kind) {
    return KINDS.find(([value]) => value === kind)?.[1] || 'Procedural';
  }

  window.StudioProcedural = { KINDS, generate, label, parseColor };
})();
