const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const mosaic = document.getElementById("mosaic");
const stage = document.getElementById("stage");
const empty = document.getElementById("empty");
const stats = document.getElementById("stats");
const exportBtn = document.getElementById("exportBtn");

const controls = {
  cols: document.getElementById("cols"),
  sharpen: document.getElementById("sharpen"),
  gap: document.getElementById("gap"),
  shape: document.getElementById("shape"),
  mode: document.getElementById("mode"),
  sizeByBrightness: document.getElementById("sizeByBrightness"),
  hoverFx: document.getElementById("hoverFx"),
  bg: document.getElementById("bg"),
};

const colsOut = document.getElementById("colsOut");
const gapOut = document.getElementById("gapOut");
const sharpenOut = document.getElementById("sharpenOut");

// Keep the DOM size sane on very tall images.
const MAX_CELLS = 200000;
// Imported images are shrunk once to this so rebuilds never touch the full-size photo.
const MAX_SOURCE_SIDE = 1600;
const MAX_MOSAIC_WIDTH = 1600;

const sampler = document.createElement("canvas");
const ctx = sampler.getContext("2d", { willReadFrequently: true });

let image = null;
let cells = [];
let builtCols = 0;
let builtRows = 0;
let buildTimer = null;

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  stats.textContent = "Loading image…";
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    image = downscale(img, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale));
    exportBtn.disabled = false;
    empty.hidden = true;
    build();
  };
  img.src = url;
}

function sample(requestedCols) {
  const ratio = image.height / image.width;
  // Shrink columns (not rows) past the cap so the aspect ratio stays intact.
  const cols = Math.min(requestedCols, Math.max(1, Math.floor(Math.sqrt(MAX_CELLS / ratio))));
  const rows = Math.max(1, Math.round(cols * ratio));
  const source = downscale(image, cols, rows);
  sampler.width = cols;
  sampler.height = rows;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, cols, rows);
  ctx.drawImage(source, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const amount = Number(controls.sharpen.value) / 100;
  return { cols, rows, data: amount > 0 ? sharpen(data, cols, rows, amount) : data };
}

// Halve in steps so big reductions average every source pixel instead of aliasing.
function downscale(src, cols, rows) {
  let w = src.naturalWidth || src.width;
  let h = src.naturalHeight || src.height;
  let current = src;
  while (w / 2 >= cols && h / 2 >= rows) {
    w = Math.floor(w / 2);
    h = Math.floor(h / 2);
    const step = document.createElement("canvas");
    step.width = w;
    step.height = h;
    const sctx = step.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(current, 0, 0, w, h);
    current = step;
  }
  if (w === cols && h === rows) return current;
  const out = document.createElement("canvas");
  out.width = cols;
  out.height = rows;
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(current, 0, 0, cols, rows);
  return out;
}

// Unsharp mask with a 3x3 box blur; alpha is left untouched.
function sharpen(data, w, h, amount) {
  const out = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += data[(yy * w + xx) * 4 + c];
            n++;
          }
        }
        out[o + c] = data[o + c] + (data[o + c] - sum / n) * amount;
      }
    }
  }
  return out;
}

function mapColor(r, g, b, mode) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  switch (mode) {
    case "gray":
      return [lum, lum, lum];
    case "posterize": {
      const step = 255 / 3;
      return [r, g, b].map((v) => Math.round(v / step) * step);
    }
    case "mono": {
      const v = lum > 127 ? 255 : 0;
      return [v, v, v];
    }
    default:
      return [r, g, b];
  }
}

function build() {
  if (!image) return;

  const mode = controls.mode.value;
  const sizeByBrightness = controls.sizeByBrightness.checked;
  const { cols, rows, data } = sample(Number(controls.cols.value));
  builtCols = cols;

  cells = [];
  const html = [];

  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4;
    const a = data[o + 3] / 255;
    const [r, g, b] = mapColor(data[o], data[o + 1], data[o + 2], mode).map(Math.round);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const scale = sizeByBrightness ? (0.15 + 0.85 * lum).toFixed(2) : null;
    const color = `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;

    // One big string is much faster than createElement at 100k+ cells.
    html.push(`<div class="cell" style="background:${color}${scale ? `;--s:${scale}` : ""}"></div>`);
    cells.push({ color, scale });
  }

  mosaic.innerHTML = html.join("");
  mosaic.dataset.sized = sizeByBrightness ? "on" : "off";
  builtRows = rows;
  applyStyle();

  stats.textContent = `${cols} × ${rows} = ${(cols * rows).toLocaleString()} divs`;
}

// Fixed px tracks are far cheaper to lay out than 1fr + aspect-ratio on every cell.
function sizeGrid() {
  if (!builtCols) return;
  const gap = Number(controls.gap.value);
  const styles = getComputedStyle(stage);
  const avail = stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const width = Math.min(avail, MAX_MOSAIC_WIDTH, builtCols * 14);
  const size = Math.max(1, (width - gap * (builtCols - 1)) / builtCols);
  mosaic.style.gridTemplateColumns = `repeat(${builtCols}, ${size}px)`;
  mosaic.style.gridAutoRows = `${size}px`;
}

function applyStyle() {
  mosaic.style.gap = `${controls.gap.value}px`;
  sizeGrid();
  mosaic.dataset.shape = controls.shape.value;
  mosaic.dataset.hover = controls.hoverFx.checked ? "on" : "off";
  stage.style.setProperty("--stage-bg", controls.bg.value);
}

function scheduleBuild() {
  clearTimeout(buildTimer);
  if (image) stats.textContent = "Building…";
  // Big grids take a moment; wait longer so dragging a slider doesn't rebuild every step.
  const delay = Number(controls.cols.value) > 200 ? 250 : 120;
  buildTimer = setTimeout(build, delay);
}

function exportHtml() {
  if (!cells.length) return;
  const cols = builtCols;
  const gap = controls.gap.value;
  const shape = controls.shape.value;
  const radius = { rounded: "25%", circle: "50%" }[shape] || "0";
  const baseTransform = shape === "diamond" ? "rotate(45deg) " : "";
  const shapeScale = shape === "diamond" ? 0.72 : 1;

  const body = cells
    .map(({ color, scale }) => {
      const s = (scale ? Number(scale) : 1) * shapeScale;
      const transform = s !== 1 || baseTransform ? `;transform:${baseTransform}scale(${s.toFixed(2)})` : "";
      return `<div style="background:${color}${transform}"></div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Div Mosaic</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${controls.bg.value}}
.m{display:grid;grid-template-columns:repeat(${cols},1fr);gap:${gap}px;width:min(1000px,95vw)}
.m div{aspect-ratio:1;border-radius:${radius}}
</style>
</head>
<body>
<div class="m">${body}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "div-mosaic.html";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));

["dragenter", "dragover"].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  })
);

["dragleave", "drop"].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  })
);

dropzone.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));

// Allow dropping anywhere on the stage too.
stage.addEventListener("dragover", (e) => e.preventDefault());
stage.addEventListener("drop", (e) => {
  e.preventDefault();
  loadFile(e.dataTransfer.files[0]);
});

window.addEventListener("paste", (e) => {
  const item = [...e.clipboardData.items].find((it) => it.type.startsWith("image/"));
  if (item) loadFile(item.getAsFile());
});

controls.cols.addEventListener("input", () => {
  colsOut.textContent = controls.cols.value;
  scheduleBuild();
});

controls.sharpen.addEventListener("input", () => {
  sharpenOut.textContent = controls.sharpen.value;
  scheduleBuild();
});

controls.gap.addEventListener("input", () => {
  gapOut.textContent = controls.gap.value;
  applyStyle();
});

controls.mode.addEventListener("change", scheduleBuild);
controls.sizeByBrightness.addEventListener("change", scheduleBuild);
controls.shape.addEventListener("change", applyStyle);
controls.hoverFx.addEventListener("change", applyStyle);
controls.bg.addEventListener("input", applyStyle);
exportBtn.addEventListener("click", exportHtml);

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(sizeGrid, 100);
});
