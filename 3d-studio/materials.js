(function () {
  'use strict';

  const Core = window.StudioCore;
  if (!Core) throw new Error('studio-core.js must be loaded before materials.js');
  const Procedural = window.StudioProcedural;
  if (!Procedural) throw new Error('studio-procedural.js must be loaded before materials.js');

  const TEXTURE_SIZE = 512;
  const MAX_HISTORY = 30;
  const DEFAULT_CAMERA = Object.freeze({ pitch: 0.35, yaw: 0.55, distance: 4.1 });
  const LIGHT = Object.freeze({ x: -0.35, y: 0.78, z: 0.52 });

  const view = document.getElementById('sculpt-view');
  const WebGL = window.StudioWebGL;
  const webglRenderer = WebGL?.createRenderer(view, { onInvalidate: () => scheduleRender() });
  const context = webglRenderer?.available ? null : view.getContext('2d', { alpha: false });
  const stage = document.getElementById('stage');
  const textureCanvas = document.getElementById('texture-canvas');
  const textureContext = textureCanvas.getContext('2d', { willReadFrequently: true });
  const toast = document.getElementById('toast');
  const layerList = document.getElementById('layer-list');
  const compositeCanvas = document.createElement('canvas');
  const compositeContext = compositeCanvas.getContext('2d', { willReadFrequently: true });
  compositeCanvas.width = compositeCanvas.height = TEXTURE_SIZE;

  const state = {
    asset: null,
    baseAsset: null,
    camera: { ...DEFAULT_CAMERA },
    mode: 'sculpt',
    sculptTool: 'inflate',
    wireframe: true,
    renderQueued: false,
    hitTriangles: [],
    layers: [],
    selectedLayerId: null,
    undo: [],
    redo: [],
    normals: [],
    adjacency: [],
    geometryDirty: true,
    geometryRevision: 0,
    textureDirty: true,
    compositePixels: null,
    compositeDataUrl: null,
    objectName: 'Sculpted object'
  };

  let toastTimer = 0;
  let pointerAction = null;
  let pointerId = null;
  let lastPointer = null;
  let paintLast = null;
  let strokeSeed = 1;
  let movedDistance = 0;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2300);
  }

  function deepClone(value) {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function cloneVertices(vertices) {
    return vertices.map((vertex) => vertex.slice(0, 3));
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadText(filename, text, type = 'text/plain') {
    downloadBlob(filename, new Blob([text], { type }));
  }

  function downloadDataUrl(filename, dataUrl) {
    const [header, payload] = dataUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
    const bytes = atob(payload);
    const buffer = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
    downloadBlob(filename, new Blob([buffer], { type: mime }));
  }

  function safeName() {
    return String(state.objectName || state.asset?.name || 'sculpted-object')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sculpted-object';
  }

  function createGridAsset(name, type, rows, cols, vertexFactory) {
    const vertices = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) vertices.push(vertexFactory(row, col, rows, cols));
    }
    return Core.standardiseAsset({
      name,
      type,
      rows,
      cols,
      vertices,
      faces: Core.gridFaces(rows, cols),
      uvs: Core.gridUvs(rows, cols)
    });
  }

  function createCubeAsset() {
    const segments = 24;
    const side = segments + 1;
    const half = 0.72;
    const vertices = [];
    const faces = [];
    const uvs = [];
    const definitions = [
      { center: [0, 0, half], u: [1, 0, 0], v: [0, 1, 0] },
      { center: [0, 0, -half], u: [-1, 0, 0], v: [0, 1, 0] },
      { center: [half, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
      { center: [-half, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
      { center: [0, half, 0], u: [1, 0, 0], v: [0, 0, -1] },
      { center: [0, -half, 0], u: [1, 0, 0], v: [0, 0, 1] }
    ];

    for (const definition of definitions) {
      const offset = vertices.length;
      for (let row = 0; row < side; row += 1) {
        const v = row / segments;
        for (let col = 0; col < side; col += 1) {
          const u = col / segments;
          const du = (u - 0.5) * 2 * half;
          const dv = (v - 0.5) * 2 * half;
          vertices.push([
            definition.center[0] + definition.u[0] * du + definition.v[0] * dv,
            definition.center[1] + definition.u[1] * du + definition.v[1] * dv,
            definition.center[2] + definition.u[2] * du + definition.v[2] * dv
          ]);
          uvs.push([u, v]);
        }
      }
      for (const face of Core.gridFaces(side, side)) faces.push(face.map((index) => index + offset));
    }
    return Core.standardiseAsset({ name: 'Sculpt cube', type: 'sculpt-cube', vertices, faces, uvs });
  }

  function createPrimitive(kind) {
    if (kind === 'cube') return createCubeAsset();
    if (kind === 'torus') {
      const rows = 49, cols = 73;
      return createGridAsset('Sculpt torus', 'sculpt-torus', rows, cols, (row, col) => {
        const v = row / (rows - 1) * Math.PI * 2;
        const u = col / (cols - 1) * Math.PI * 2;
        const major = 0.78, minor = 0.31;
        return [
          (major + minor * Math.cos(v)) * Math.cos(u),
          minor * Math.sin(v),
          (major + minor * Math.cos(v)) * Math.sin(u)
        ];
      });
    }
    if (kind === 'plane') {
      const rows = 55, cols = 55;
      return createGridAsset('Sculpt plane', 'sculpt-plane', rows, cols, (row, col) => [
        (col / (cols - 1) - 0.5) * 2,
        0,
        (row / (rows - 1) - 0.5) * 2
      ]);
    }
    const rows = 49, cols = 73;
    return createGridAsset('Sculpt sphere', 'sculpt-sphere', rows, cols, (row, col) => {
      const v = row / (rows - 1);
      const u = col / (cols - 1);
      const theta = v * Math.PI;
      const phi = u * Math.PI * 2;
      return [
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi)
      ];
    });
  }

  function initialiseMesh(asset, preserveTexture = false) {
    state.asset = Core.standardiseAsset(asset, { normalise: true });
    state.baseAsset = deepClone(state.asset);
    state.objectName = state.asset.name || 'Sculpted object';
    document.getElementById('asset-name').value = state.objectName;
    state.undo = [];
    state.redo = [];
    state.geometryDirty = true;
    if (!preserveTexture) initialiseLayers(state.asset.metadata?.material);
    updateModeClasses();
    refreshStageStatus();
    scheduleRender();
  }

  function createLayer(name, type = 'paint') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    return {
      id: Core.createId('layer'),
      name,
      type,
      canvas,
      visible: true,
      opacity: 1,
      blendMode: 'source-over'
    };
  }

  function fillLayer(layer, color) {
    const ctx = layer.canvas.getContext('2d');
    ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  }

  function imageToLayer(dataUrl, name = 'Imported texture') {
    return new Promise((resolve, reject) => {
      const layer = createLayer(name, 'paint');
      const image = new Image();
      image.onload = () => {
        const ctx = layer.canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        resolve(layer);
      };
      image.onerror = () => reject(new Error('The image could not be decoded.'));
      image.src = dataUrl;
    });
  }

  function initialiseLayers(material = null) {
    state.layers = [];
    const base = createLayer('Base clay');
    fillLayer(base, '#315e3d');
    state.layers.push(base);
    state.selectedLayerId = base.id;
    state.textureDirty = true;

    if (material?.textureData) {
      imageToLayer(material.textureData, 'Imported material').then((layer) => {
        state.layers.push(layer);
        state.selectedLayerId = layer.id;
        markTextureDirty();
        refreshLayerUi();
      }).catch(() => showToast('The embedded texture could not be loaded.'));
    } else {
      const wash = makeProceduralLayer('patina');
      wash.opacity = 0.38;
      wash.blendMode = 'soft-light';
      state.layers.push(wash);
    }
    refreshLayerUi();
  }

  function selectedLayer() {
    return state.layers.find((layer) => layer.id === state.selectedLayerId) || null;
  }

  function markTextureDirty() {
    state.textureDirty = true;
    state.compositeDataUrl = null;
    scheduleRender();
    drawTextureCanvas();
  }

  function compositeLayers() {
    if (!state.textureDirty && state.compositePixels) return;
    compositeContext.save();
    compositeContext.setTransform(1, 0, 0, 1, 0, 0);
    compositeContext.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    compositeContext.fillStyle = '#262b27';
    compositeContext.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (const layer of state.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      compositeContext.globalAlpha = Core.clamp(Number(layer.opacity) || 0, 0, 1);
      compositeContext.globalCompositeOperation = layer.blendMode || 'source-over';
      compositeContext.drawImage(layer.canvas, 0, 0);
    }
    compositeContext.restore();
    const imageData = compositeContext.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    state.compositePixels = imageData.data;
    state.textureDirty = false;
  }

  function compositeDataUrl() {
    compositeLayers();
    if (!state.compositeDataUrl) state.compositeDataUrl = compositeCanvas.toDataURL('image/png');
    return state.compositeDataUrl;
  }

  function drawTextureCanvas() {
    compositeLayers();
    textureContext.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    textureContext.drawImage(compositeCanvas, 0, 0);
  }

  function sampleTexture(uv) {
    compositeLayers();
    const u = ((uv[0] % 1) + 1) % 1;
    const v = Core.clamp(uv[1], 0, 1);
    const x = Math.min(TEXTURE_SIZE - 1, Math.floor(u * TEXTURE_SIZE));
    const y = Math.min(TEXTURE_SIZE - 1, Math.floor((1 - v) * TEXTURE_SIZE));
    const index = (y * TEXTURE_SIZE + x) * 4;
    const pixels = state.compositePixels;
    return { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2], a: pixels[index + 3] };
  }

  function refreshLayerUi() {
    layerList.innerHTML = '';
    for (let index = state.layers.length - 1; index >= 0; index -= 1) {
      const layer = state.layers[index];
      const item = document.createElement('div');
      item.className = `layer-item${layer.id === state.selectedLayerId ? ' selected' : ''}`;
      item.dataset.layerId = layer.id;
      const swatch = document.createElement('div');
      swatch.className = 'layer-swatch';
      try { swatch.style.backgroundImage = `url(${layer.canvas.toDataURL('image/png')})`; } catch { /* Optional preview. */ }
      const text = document.createElement('div');
      text.innerHTML = `<div class="layer-name"></div><div class="layer-kind"></div>`;
      text.querySelector('.layer-name').textContent = layer.name;
      text.querySelector('.layer-kind').textContent = `${layer.type} · ${Math.round(layer.opacity * 100)}%`;
      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.checked = layer.visible;
      visible.className = 'layer-visible';
      visible.dataset.layerId = layer.id;
      visible.setAttribute('aria-label', `Show ${layer.name}`);
      item.append(swatch, text, visible);
      layerList.appendChild(item);
    }
    const layer = selectedLayer();
    document.getElementById('layer-name').value = layer?.name || '';
    document.getElementById('blend-mode').value = layer?.blendMode || 'source-over';
    document.getElementById('layer-opacity').value = String(layer?.opacity ?? 1);
    drawTextureCanvas();
  }

  function hash2(x, y, seed = 0) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 17.13) * 43758.5453;
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

  function fractalNoise(u, v, seed) {
    return smoothNoise(u, v, 3, seed) * 0.5
      + smoothNoise(u, v, 7, seed + 1) * 0.3
      + smoothNoise(u, v, 15, seed + 2) * 0.2;
  }

  function proceduralLayerOptions(kind) {
    const numberValue = (id, fallback) => {
      const value = Number(document.getElementById(id)?.value);
      return Number.isFinite(value) ? value : fallback;
    };
    return {
      kind,
      primary: document.getElementById('procedural-primary')?.value || '#74d995',
      secondary: document.getElementById('procedural-secondary')?.value || '#17291d',
      scale: numberValue('procedural-scale', 9),
      detail: numberValue('procedural-detail', 0.6),
      contrast: numberValue('procedural-contrast', 0.7)
    };
  }

  function makeProceduralLayer(kind) {
    const options = { ...proceduralLayerOptions(kind), seed: Math.random() * 10000 };
    const layer = createLayer(Procedural.label(options.kind), 'procedural');
    Procedural.generate(layer.canvas, options);
    const defaults = {
      patina: ['soft-light', 0.42],
      speckle: ['overlay', 0.48],
      clouds: ['soft-light', 0.62],
      topographic: ['overlay', 0.58],
      cracks: ['multiply', 0.65],
      brushed: ['soft-light', 0.7]
    }[options.kind];
    if (defaults) {
      layer.blendMode = defaults[0];
      layer.opacity = defaults[1];
    }
    return layer;
  }

  function buildAdjacency() {
    const adjacency = Array.from({ length: state.asset.vertices.length }, () => new Set());
    for (const [a, b, c] of state.asset.faces) {
      adjacency[a].add(b); adjacency[a].add(c);
      adjacency[b].add(a); adjacency[b].add(c);
      adjacency[c].add(a); adjacency[c].add(b);
    }
    state.adjacency = adjacency.map((set) => [...set]);
  }

  function vectorNormalise(vector, fallback = [0, 1, 0]) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    if (!Number.isFinite(length) || length <= Number.EPSILON) return fallback.slice();
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  function faceNormal(a, b, c) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return vectorNormalise([
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]
    ]);
  }

  function rebuildGeometryCaches() {
    if (!state.geometryDirty) return;
    buildAdjacency();
    const sums = Array.from({ length: state.asset.vertices.length }, () => [0, 0, 0]);
    for (const [a, b, c] of state.asset.faces) {
      const normal = faceNormal(state.asset.vertices[a], state.asset.vertices[b], state.asset.vertices[c]);
      for (const index of [a, b, c]) {
        sums[index][0] += normal[0];
        sums[index][1] += normal[1];
        sums[index][2] += normal[2];
      }
    }
    state.normals = sums.map((normal) => vectorNormalise(normal));
    state.geometryRevision += 1;
    state.geometryDirty = false;
  }

  function rotateX(point, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return [point[0], point[1] * cosine - point[2] * sine, point[1] * sine + point[2] * cosine];
  }

  function rotateY(point, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return [point[0] * cosine + point[2] * sine, point[1], -point[0] * sine + point[2] * cosine];
  }

  function toCamera(point) {
    return rotateY(rotateX(point, state.camera.pitch), state.camera.yaw);
  }

  function project(point, width, height) {
    const depth = point[2] + state.camera.distance;
    if (depth <= 0.03) return null;
    const focal = Math.min(width, height) * 0.78;
    return {
      x: width / 2 + point[0] * focal / depth,
      y: height / 2 - point[1] * focal / depth,
      depth
    };
  }

  function shadedColor(color, intensity) {
    const amount = Core.clamp(intensity, 0.12, 1.3);
    return `rgb(${Math.round(color.r * amount)},${Math.round(color.g * amount)},${Math.round(color.b * amount)})`;
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  function renderGround(width, height) {
    const horizon = height * 0.72;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#090b09');
    gradient.addColorStop(horizon / height, '#0b0f0b');
    gradient.addColorStop(1, '#111711');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(100,150,105,.08)';
    context.lineWidth = 1;
    for (let index = -8; index <= 8; index += 1) {
      const y = horizon + index * 15;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }

  function renderCanvas2D() {
    if (!state.asset || !view.width || !view.height) return;
    rebuildGeometryCaches();
    compositeLayers();
    const width = view.width;
    const height = view.height;
    renderGround(width, height);

    const projected = state.asset.vertices.map((vertex) => {
      const camera = toCamera(vertex);
      const point = project(camera, width, height);
      return point ? { ...point, camera } : null;
    });

    const triangles = [];
    for (const face of state.asset.faces) {
      const [ia, ib, ic] = face;
      const a = projected[ia], b = projected[ib], c = projected[ic];
      if (!a || !b || !c) continue;
      const normal = faceNormal(a.camera, b.camera, c.camera);
      if (normal[2] >= 0.12) continue;
      const uvA = state.asset.uvs[ia] || [0, 0];
      const uvB = state.asset.uvs[ib] || [0, 0];
      const uvC = state.asset.uvs[ic] || [0, 0];
      let u = (uvA[0] + uvB[0] + uvC[0]) / 3;
      if (Math.max(uvA[0], uvB[0], uvC[0]) - Math.min(uvA[0], uvB[0], uvC[0]) > 0.5) {
        u = ([uvA[0], uvB[0], uvC[0]].map((value) => value < 0.5 ? value + 1 : value).reduce((sum, value) => sum + value, 0) / 3) % 1;
      }
      const uv = [u, (uvA[1] + uvB[1] + uvC[1]) / 3];
      const color = sampleTexture(uv);
      const lightAmount = Core.clamp(0.28 + Math.max(0, -(normal[0] * LIGHT.x + normal[1] * LIGHT.y + normal[2] * LIGHT.z)) * 0.92, 0.18, 1.2);
      triangles.push({
        points: [a, b, c],
        depth: (a.depth + b.depth + c.depth) / 3,
        face,
        local: [state.asset.vertices[ia], state.asset.vertices[ib], state.asset.vertices[ic]],
        uvs: [uvA, uvB, uvC],
        fill: shadedColor(color, lightAmount)
      });
    }

    triangles.sort((left, right) => right.depth - left.depth);
    state.hitTriangles = triangles;
    for (const triangle of triangles) {
      const [a, b, c] = triangle.points;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.closePath();
      context.fillStyle = triangle.fill;
      context.fill();
      if (state.wireframe) {
        context.strokeStyle = 'rgba(4,12,6,.30)';
        context.lineWidth = 0.45;
        context.stroke();
      }
    }
  }

  function rebuildWebGLHitTriangles() {
    if (!state.asset) return;
    const width = view.width, height = view.height;
    const projected = state.asset.vertices.map((vertex) => {
      const camera = toCamera(vertex); const point = project(camera, width, height);
      return point ? { ...point, camera } : null;
    });
    const triangles = [];
    for (const face of state.asset.faces) {
      const [ia, ib, ic] = face, a = projected[ia], b = projected[ib], c = projected[ic];
      if (!a || !b || !c) continue;
      const normal = faceNormal(a.camera, b.camera, c.camera);
      if (normal[2] >= 0.12) continue;
      triangles.push({
        points:[a,b,c], depth:(a.depth+b.depth+c.depth)/3, face,
        local:[state.asset.vertices[ia],state.asset.vertices[ib],state.asset.vertices[ic]],
        uvs:[state.asset.uvs[ia]||[0,0],state.asset.uvs[ib]||[0,0],state.asset.uvs[ic]||[0,0]]
      });
    }
    triangles.sort((left,right)=>right.depth-left.depth); state.hitTriangles=triangles;
  }

  function render() {
    if (!webglRenderer?.available) return renderCanvas2D();
    if (!state.asset || !view.width || !view.height) return;
    rebuildGeometryCaches(); compositeLayers(); rebuildWebGLHitTriangles();
    webglRenderer.render([{
      id:'materials-preview', asset:state.asset, __geometryRevision: state.geometryRevision,
      transform:{ position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} },
      material:{ type:'image', primary:'#50d08a', secondary:'#173b24', scale:1, roughness:.5 },
      __textureSource: compositeCanvas
    }], { pitch:state.camera.pitch, yaw:state.camera.yaw, distance:state.camera.distance, targetY:0 }, {
      background:'#090d0a', grid:true, wireframe:state.wireframe, exposure:1.08, ambient:.36, lightIntensity:1.2, rim:.2, focalMultiplier:.78
    });
  }

  function resizeView() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.width = Math.max(1, Math.round(stage.clientWidth * dpr));
    view.height = Math.max(1, Math.round(stage.clientHeight * dpr));
    view.style.width = `${stage.clientWidth}px`; view.style.height = `${stage.clientHeight}px`;
    scheduleRender();
  }

  function viewPoint(event) {
    const rect = view.getBoundingClientRect();
    const scaleX = view.width / rect.width;
    const scaleY = view.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  function pointInTriangle(x, y, triangle) {
    const [a, b, c] = triangle.points;
    const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const point = { x, y };
    const d1 = sign(point, a, b), d2 = sign(point, b, c), d3 = sign(point, c, a);
    const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNegative && hasPositive);
  }

  function pickTriangle(x, y) {
    for (let index = state.hitTriangles.length - 1; index >= 0; index -= 1) {
      const triangle = state.hitTriangles[index];
      if (pointInTriangle(x, y, triangle)) return triangle;
    }
    return null;
  }

  function perspectiveWeights(x, y, triangle) {
    const [a, b, c] = triangle.points;
    const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denominator) <= Number.EPSILON) return null;
    const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
    const l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
    const l3 = 1 - l1 - l2;
    const weighted = [l1 / a.depth, l2 / b.depth, l3 / c.depth];
    const sum = weighted[0] + weighted[1] + weighted[2];
    if (Math.abs(sum) <= Number.EPSILON) return null;
    return weighted.map((value) => value / sum);
  }

  function interpolateAttribute(values, weights) {
    return values[0].map((_, component) => values[0][component] * weights[0] + values[1][component] * weights[1] + values[2][component] * weights[2]);
  }

  function hitAt(event) {
    const point = viewPoint(event);
    const triangle = pickTriangle(point.x, point.y);
    if (!triangle) return null;
    const weights = perspectiveWeights(point.x, point.y, triangle);
    if (!weights) return null;
    return {
      triangle,
      point,
      local: interpolateAttribute(triangle.local, weights),
      uv: interpolateAttribute(triangle.uvs, weights),
      normal: faceNormal(...triangle.local)
    };
  }

  function pushHistory() {
    state.undo.push(cloneVertices(state.asset.vertices));
    if (state.undo.length > MAX_HISTORY) state.undo.shift();
    state.redo = [];
  }

  function restoreVertices(vertices) {
    state.asset.vertices = cloneVertices(vertices);
    state.geometryDirty = true;
    refreshStageStatus();
    scheduleRender();
  }

  function symmetryCenters(center, normal) {
    let variants = [{ center: center.slice(), normal: normal.slice() }];
    const axes = [
      { checked: document.getElementById('symmetry-x').checked, index: 0 },
      { checked: document.getElementById('symmetry-y').checked, index: 1 },
      { checked: document.getElementById('symmetry-z').checked, index: 2 }
    ];
    for (const axis of axes) {
      if (!axis.checked) continue;
      const mirrored = variants.map((variant) => {
        const c = variant.center.slice();
        const n = variant.normal.slice();
        c[axis.index] *= -1;
        n[axis.index] *= -1;
        return { center: c, normal: n };
      });
      variants = variants.concat(mirrored);
    }
    const unique = new Map();
    for (const variant of variants) unique.set(variant.center.map((value) => value.toFixed(5)).join(':'), variant);
    return [...unique.values()];
  }

  function applySculptBrush(hit) {
    rebuildGeometryCaches();
    const radius = Number(document.getElementById('sculpt-radius').value);
    const strength = Number(document.getElementById('sculpt-strength').value);
    const softness = Number(document.getElementById('sculpt-falloff').value);
    const source = cloneVertices(state.asset.vertices);
    const centers = symmetryCenters(hit.local, hit.normal);
    const modified = new Set();

    for (const { center, normal: planeNormal } of centers) {
      for (let index = 0; index < source.length; index += 1) {
        const vertex = source[index];
        const dx = vertex[0] - center[0];
        const dy = vertex[1] - center[1];
        const dz = vertex[2] - center[2];
        const distance = Math.hypot(dx, dy, dz);
        if (distance >= radius) continue;
        const t = 1 - distance / radius;
        const smooth = t * t * (3 - 2 * t);
        const weight = smooth * (1 - softness) + Math.pow(smooth, 2.5) * softness;
        const vertexNormal = state.normals[index] || [0, 1, 0];
        const target = state.asset.vertices[index];
        if (state.sculptTool === 'inflate' || state.sculptTool === 'deflate') {
          const direction = state.sculptTool === 'inflate' ? 1 : -1;
          target[0] += vertexNormal[0] * strength * weight * direction;
          target[1] += vertexNormal[1] * strength * weight * direction;
          target[2] += vertexNormal[2] * strength * weight * direction;
        } else if (state.sculptTool === 'smooth') {
          const neighbours = state.adjacency[index];
          if (!neighbours.length) continue;
          const average = [0, 0, 0];
          for (const neighbour of neighbours) {
            average[0] += source[neighbour][0]; average[1] += source[neighbour][1]; average[2] += source[neighbour][2];
          }
          average[0] /= neighbours.length; average[1] /= neighbours.length; average[2] /= neighbours.length;
          const factor = Core.clamp(strength * 9 * weight, 0, 0.9);
          target[0] += (average[0] - vertex[0]) * factor;
          target[1] += (average[1] - vertex[1]) * factor;
          target[2] += (average[2] - vertex[2]) * factor;
        } else if (state.sculptTool === 'flatten') {
          const planeDistance = dx * planeNormal[0] + dy * planeNormal[1] + dz * planeNormal[2];
          const factor = Core.clamp(strength * 8 * weight, 0, 0.85);
          target[0] -= planeNormal[0] * planeDistance * factor;
          target[1] -= planeNormal[1] * planeDistance * factor;
          target[2] -= planeNormal[2] * planeDistance * factor;
        } else if (state.sculptTool === 'pinch') {
          const dot = (-dx) * vertexNormal[0] + (-dy) * vertexNormal[1] + (-dz) * vertexNormal[2];
          const tangent = [-dx - vertexNormal[0] * dot, -dy - vertexNormal[1] * dot, -dz - vertexNormal[2] * dot];
          const factor = strength * 2.8 * weight;
          target[0] += tangent[0] * factor;
          target[1] += tangent[1] * factor;
          target[2] += tangent[2] * factor;
        } else if (state.sculptTool === 'noise') {
          const random = hash2(index, strokeSeed, 17) * 2 - 1;
          const factor = random * strength * weight;
          target[0] += vertexNormal[0] * factor;
          target[1] += vertexNormal[1] * factor;
          target[2] += vertexNormal[2] * factor;
        }
        modified.add(index);
      }
    }

    if (modified.size) {
      state.geometryDirty = true;
      scheduleRender();
    }
    return modified.size > 0;
  }

  function ensurePaintLayer() {
    let layer = selectedLayer();
    if (!layer || layer.type !== 'paint') {
      layer = createLayer('Paint layer');
      state.layers.push(layer);
      state.selectedLayerId = layer.id;
      refreshLayerUi();
      showToast('A paint layer was created for the brush.');
    }
    return layer;
  }

  function hexToRgb(hex) {
    const clean = String(hex).replace('#', '');
    const value = Number.parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function brushSettings(event = null) {
    return {
      color: document.getElementById('paint-color').value,
      size: Number(document.getElementById('paint-size').value),
      opacity: Number(document.getElementById('paint-opacity').value),
      softness: Number(document.getElementById('paint-softness').value),
      erase: Boolean(event?.altKey || event?.button === 2)
    };
  }

  function stampBrush(layer, point, settings, offsetX = 0) {
    const ctx = layer.canvas.getContext('2d');
    const radius = settings.size / 2;
    const rgb = hexToRgb(settings.color);
    ctx.save();
    ctx.globalCompositeOperation = settings.erase ? 'destination-out' : 'source-over';
    const gradient = ctx.createRadialGradient(point.x + offsetX, point.y, radius * (1 - settings.softness), point.x + offsetX, point.y, radius);
    if (settings.erase) {
      gradient.addColorStop(0, `rgba(0,0,0,${settings.opacity})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${settings.opacity})`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x + offsetX, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintStroke(layer, from, to, settings) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const spacing = Math.max(1.5, settings.size * 0.16);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      for (const offset of [-TEXTURE_SIZE, 0, TEXTURE_SIZE]) stampBrush(layer, point, settings, offset);
    }
    markTextureDirty();
  }

  function uvToTexturePoint(uv) {
    return {
      x: (((uv[0] % 1) + 1) % 1) * TEXTURE_SIZE,
      y: (1 - Core.clamp(uv[1], 0, 1)) * TEXTURE_SIZE
    };
  }

  function paintOnSurface(event) {
    const hit = hitAt(event);
    if (!hit) {
      paintLast = null;
      return false;
    }
    const layer = ensurePaintLayer();
    const point = uvToTexturePoint(hit.uv);
    const settings = brushSettings(event);
    if (paintLast && Math.abs(point.x - paintLast.x) > TEXTURE_SIZE / 2) {
      const adjusted = { ...point, x: point.x > paintLast.x ? point.x - TEXTURE_SIZE : point.x + TEXTURE_SIZE };
      paintStroke(layer, paintLast, adjusted, settings);
    } else {
      paintStroke(layer, paintLast || point, point, settings);
    }
    paintLast = point;
    return true;
  }

  function texturePoint(event) {
    const rect = textureCanvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * TEXTURE_SIZE / rect.width,
      y: (event.clientY - rect.top) * TEXTURE_SIZE / rect.height
    };
  }

  function updateModeClasses() {
    document.querySelectorAll('#mode-tools [data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
    view.classList.toggle('sculpting', state.mode === 'sculpt');
    view.classList.toggle('painting', state.mode === 'paint');
    document.getElementById('stage-hint').textContent = state.mode === 'orbit'
      ? 'Drag to orbit · Scroll to zoom'
      : state.mode === 'paint'
        ? 'Paint directly on the visible UV-mapped surface · Alt/right-click erases'
        : 'Sculpt directly on the visible surface · Symmetry mirrors the brush';
  }

  function refreshStageStatus() {
    if (!state.asset) return;
    document.getElementById('stage-status').textContent = `${state.objectName} · ${state.asset.vertices.length.toLocaleString()} vertices · ${state.asset.faces.length.toLocaleString()} triangles`;
  }

  function applyWholeMeshOperation(kind) {
    pushHistory();
    rebuildGeometryCaches();
    const source = cloneVertices(state.asset.vertices);
    if (kind === 'smooth-all') {
      for (let pass = 0; pass < 3; pass += 1) {
        const current = cloneVertices(state.asset.vertices);
        for (let index = 0; index < current.length; index += 1) {
          const neighbours = state.adjacency[index];
          if (!neighbours.length) continue;
          const average = [0, 0, 0];
          for (const neighbour of neighbours) {
            average[0] += current[neighbour][0]; average[1] += current[neighbour][1]; average[2] += current[neighbour][2];
          }
          state.asset.vertices[index][0] += (average[0] / neighbours.length - current[index][0]) * 0.35;
          state.asset.vertices[index][1] += (average[1] / neighbours.length - current[index][1]) * 0.35;
          state.asset.vertices[index][2] += (average[2] / neighbours.length - current[index][2]) * 0.35;
        }
      }
    } else {
      for (let index = 0; index < source.length; index += 1) {
        const vertex = source[index];
        const normal = state.normals[index];
        let amount = 0;
        if (kind === 'organic') amount = (fractalNoise(vertex[0] * 0.5 + 0.5, vertex[2] * 0.5 + 0.5, 19) - 0.5) * 0.18;
        if (kind === 'erode') amount = (hash2(index, 11, 7) - 0.56) * 0.11;
        if (kind === 'crystal') {
          const quantised = vertex.map((value) => Math.round(value * 5) / 5);
          state.asset.vertices[index][0] += (quantised[0] - vertex[0]) * 0.38;
          state.asset.vertices[index][1] += (quantised[1] - vertex[1]) * 0.38;
          state.asset.vertices[index][2] += (quantised[2] - vertex[2]) * 0.38;
          continue;
        }
        state.asset.vertices[index][0] += normal[0] * amount;
        state.asset.vertices[index][1] += normal[1] * amount;
        state.asset.vertices[index][2] += normal[2] * amount;
      }
    }
    state.geometryDirty = true;
    scheduleRender();
    showToast(`${kind.replace('-', ' ')} operation applied.`);
  }

  function effectLayer(kind, strength) {
    compositeLayers();
    const layer = createLayer(kind[0].toUpperCase() + kind.slice(1), 'effect');
    const ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
    if (kind === 'glaze') {
      const gradient = ctx.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      gradient.addColorStop(0, 'rgba(255,245,210,.55)');
      gradient.addColorStop(0.45, 'rgba(65,170,110,.10)');
      gradient.addColorStop(1, 'rgba(12,25,18,.52)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      layer.blendMode = 'soft-light';
      layer.opacity = strength;
      return layer;
    }
    if (kind === 'grain') {
      const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
      for (let index = 0; index < image.data.length; index += 4) {
        const value = Math.random() * 255;
        image.data[index] = image.data[index + 1] = image.data[index + 2] = value;
        image.data[index + 3] = Math.round(105 * strength);
      }
      ctx.putImageData(image, 0, 0);
      layer.blendMode = 'overlay';
      layer.opacity = Math.min(0.7, 0.25 + strength * 0.4);
      return layer;
    }

    const temp = document.createElement('canvas');
    temp.width = temp.height = TEXTURE_SIZE;
    const tempContext = temp.getContext('2d', { willReadFrequently: true });
    tempContext.filter = kind === 'watercolor' ? `blur(${Math.round(1 + strength * 5)}px) saturate(${1 + strength * 0.45})` : 'none';
    tempContext.drawImage(compositeCanvas, 0, 0);
    const image = tempContext.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    const levels = kind === 'posterize' ? Math.max(3, Math.round(9 - strength * 6)) : Math.max(5, Math.round(12 - strength * 5));
    for (let index = 0; index < image.data.length; index += 4) {
      for (let channel = 0; channel < 3; channel += 1) image.data[index + channel] = Math.round(image.data[index + channel] / 255 * (levels - 1)) / (levels - 1) * 255;
    }
    ctx.putImageData(image, 0, 0);
    layer.opacity = kind === 'watercolor' ? 0.55 + strength * 0.35 : strength;
    layer.blendMode = kind === 'watercolor' ? 'soft-light' : 'source-over';
    return layer;
  }

  function bakeTextureRelief() {
    rebuildGeometryCaches();
    compositeLayers();
    const amount = Number(document.getElementById('texture-relief').value);
    const midpoint = Number(document.getElementById('texture-midpoint').value);
    if (Math.abs(amount) < 0.0001) {
      showToast('Choose a non-zero relief amount.');
      return;
    }
    pushHistory();
    for (let index = 0; index < state.asset.vertices.length; index += 1) {
      const color = sampleTexture(state.asset.uvs[index] || [0, 0]);
      const luminance = (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722) / 255;
      const displacement = (luminance - midpoint) * amount;
      const normal = state.normals[index];
      state.asset.vertices[index][0] += normal[0] * displacement;
      state.asset.vertices[index][1] += normal[1] * displacement;
      state.asset.vertices[index][2] += normal[2] * displacement;
    }
    state.geometryDirty = true;
    scheduleRender();
    showToast('Composite texture baked into the geometry.');
  }

  function serialiseLayers() {
    return state.layers.map((layer) => ({
      name: layer.name,
      type: layer.type,
      visible: layer.visible,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      textureData: layer.canvas.toDataURL('image/png')
    }));
  }

  function exportAsset(includeLayers = true) {
    const asset = deepClone(state.asset);
    asset.name = state.objectName;
    asset.metadata = {
      ...(asset.metadata || {}),
      source: 'Sculpt Materials',
      material: {
        type: 'image',
        scale: 1,
        primary: '#ffffff',
        secondary: '#000000',
        roughness: 0.58,
        textureData: compositeDataUrl(),
        ...(includeLayers ? { layers: serialiseLayers() } : {})
      }
    };
    return asset;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    let binary = '';
    for (let start = 0; start < bytes.length; start += chunk) binary += String.fromCharCode(...bytes.subarray(start, start + chunk));
    return btoa(binary);
  }

  function buildGltf() {
    rebuildGeometryCaches();
    const positions = new Float32Array(state.asset.vertices.flat());
    const normals = new Float32Array(state.normals.flat());
    const uvs = new Float32Array(state.asset.uvs.flat());
    const indices = new Uint32Array(state.asset.faces.flat());
    const arrays = [positions, normals, uvs, indices];
    const offsets = [];
    let total = 0;
    for (const array of arrays) {
      total = Math.ceil(total / 4) * 4;
      offsets.push(total);
      total += array.byteLength;
    }
    const buffer = new ArrayBuffer(total);
    arrays.forEach((array, index) => new Uint8Array(buffer, offsets[index], array.byteLength).set(new Uint8Array(array.buffer)));
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const vertex of state.asset.vertices) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], vertex[axis]);
        max[axis] = Math.max(max[axis], vertex[axis]);
      }
    }
    return {
      asset: { version: '2.0', generator: '3D Studio Sculpt Materials' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: state.objectName }],
      meshes: [{ name: state.objectName, primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0
      }] }],
      materials: [{ name: 'Sculpt material', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.58 } }],
      textures: [{ sampler: 0, source: 0 }],
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
      images: [{ uri: compositeDataUrl(), mimeType: 'image/png' }],
      buffers: [{ byteLength: buffer.byteLength, uri: `data:application/octet-stream;base64,${arrayBufferToBase64(buffer)}` }],
      bufferViews: [
        { buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength, target: 34962 },
        { buffer: 0, byteOffset: offsets[1], byteLength: normals.byteLength, target: 34962 },
        { buffer: 0, byteOffset: offsets[2], byteLength: uvs.byteLength, target: 34962 },
        { buffer: 0, byteOffset: offsets[3], byteLength: indices.byteLength, target: 34963 }
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: state.asset.vertices.length, type: 'VEC3', min, max },
        { bufferView: 1, componentType: 5126, count: state.normals.length, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: state.asset.uvs.length, type: 'VEC2' },
        { bufferView: 3, componentType: 5125, count: indices.length, type: 'SCALAR' }
      ]
    };
  }

  function exportObjPackage() {
    rebuildGeometryCaches();
    const name = safeName();
    const lines = [`# ${state.objectName}`, `mtllib ${name}.mtl`, `o ${name}`];
    for (const vertex of state.asset.vertices) lines.push(`v ${vertex.join(' ')}`);
    for (const uv of state.asset.uvs) lines.push(`vt ${uv[0]} ${uv[1]}`);
    for (const normal of state.normals) lines.push(`vn ${normal.join(' ')}`);
    lines.push('usemtl SculptMaterial');
    for (const face of state.asset.faces) {
      lines.push(`f ${face.map((index) => `${index + 1}/${index + 1}/${index + 1}`).join(' ')}`);
    }
    const mtl = ['newmtl SculptMaterial', 'Ka 0.1 0.1 0.1', 'Kd 1 1 1', 'Ks 0.08 0.08 0.08', 'Ns 24', `map_Kd ${name}.png`, ''].join('\n');
    downloadText(`${name}.obj`, lines.join('\n'), 'text/plain');
    setTimeout(() => downloadText(`${name}.mtl`, mtl, 'text/plain'), 120);
    setTimeout(() => downloadDataUrl(`${name}.png`, compositeDataUrl()), 240);
    showToast('OBJ, MTL, and PNG downloads started. Keep the three files together.');
  }

  function asciiStl(vertices, filenameSuffix = '') {
    const solidName = `${safeName()}${filenameSuffix}`;
    const lines = [`solid ${solidName}`];
    for (const [a, b, c] of state.asset.faces) {
      const normal = faceNormal(vertices[a], vertices[b], vertices[c]);
      lines.push(`  facet normal ${normal.join(' ')}`, '    outer loop');
      for (const index of [a, b, c]) lines.push(`      vertex ${vertices[index].join(' ')}`);
      lines.push('    endloop', '  endfacet');
    }
    lines.push(`endsolid ${solidName}`);
    downloadText(`${solidName}.stl`, lines.join('\n'), 'model/stl');
  }

  function exportStl() {
    asciiStl(state.asset.vertices);
  }

  function textureReliefVertices() {
    rebuildGeometryCaches();
    const strength = Number(document.getElementById('texture-relief').value) || 0;
    const midpoint = Number(document.getElementById('texture-midpoint').value) || 0;
    return state.asset.vertices.map((vertex, index) => {
      const color = sampleTexture(state.asset.uvs[index] || [0, 0]);
      const luminance = (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722) / 255;
      const amount = (luminance - midpoint) * strength;
      const normal = state.normals[index] || [0, 1, 0];
      return [
        vertex[0] + normal[0] * amount,
        vertex[1] + normal[1] * amount,
        vertex[2] + normal[2] * amount
      ];
    });
  }

  function exportTextureReliefStl() {
    const strength = Number(document.getElementById('texture-relief').value) || 0;
    if (strength <= Number.EPSILON) {
      showToast('Set Texture relief amount above zero before exporting.');
      return;
    }
    asciiStl(textureReliefVertices(), '-texture-relief');
    showToast('Texture brightness was baked into STL geometry without changing the editable mesh.');
  }

  function exportColorStl() {
    rebuildGeometryCaches();
    const triangleCount = state.asset.faces.length;
    const buffer = new ArrayBuffer(84 + triangleCount * 50);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const header = '3D Studio experimental VisCAM color STL; color may be ignored';
    for (let index = 0; index < Math.min(80, header.length); index += 1) bytes[index] = header.charCodeAt(index);
    view.setUint32(80, triangleCount, true);
    let offset = 84;
    for (const [a, b, c] of state.asset.faces) {
      const normal = faceNormal(state.asset.vertices[a], state.asset.vertices[b], state.asset.vertices[c]);
      for (const value of normal) { view.setFloat32(offset, value, true); offset += 4; }
      for (const vertexIndex of [a, b, c]) {
        for (const value of state.asset.vertices[vertexIndex]) { view.setFloat32(offset, value, true); offset += 4; }
      }
      const uvA = state.asset.uvs[a] || [0, 0];
      const uvB = state.asset.uvs[b] || [0, 0];
      const uvC = state.asset.uvs[c] || [0, 0];
      const color = sampleTexture([
        (uvA[0] + uvB[0] + uvC[0]) / 3,
        (uvA[1] + uvB[1] + uvC[1]) / 3
      ]);
      const red = Math.round(color.r * 31 / 255) & 31;
      const green = Math.round(color.g * 31 / 255) & 31;
      const blue = Math.round(color.b * 31 / 255) & 31;
      const attribute = 0x8000 | red | (green << 5) | (blue << 10);
      view.setUint16(offset, attribute, true);
      offset += 2;
    }
    downloadBlob(`${safeName()}-color-experimental.stl`, new Blob([buffer], { type: 'model/stl' }));
    showToast('Experimental color STL exported. Many STL applications will display only geometry.');
  }

  function exportPly() {
    rebuildGeometryCaches();
    const lines = [
      'ply', 'format ascii 1.0', `comment generated by 3D Studio Sculpt Materials`,
      `element vertex ${state.asset.vertices.length}`,
      'property float x', 'property float y', 'property float z',
      'property uchar red', 'property uchar green', 'property uchar blue',
      `element face ${state.asset.faces.length}`, 'property list uchar int vertex_indices', 'end_header'
    ];
    for (let index = 0; index < state.asset.vertices.length; index += 1) {
      const color = sampleTexture(state.asset.uvs[index] || [0, 0]);
      lines.push(`${state.asset.vertices[index].join(' ')} ${color.r} ${color.g} ${color.b}`);
    }
    for (const face of state.asset.faces) lines.push(`3 ${face.join(' ')}`);
    downloadText(`${safeName()}.ply`, lines.join('\n'), 'application/octet-stream');
  }

  function exportHeightTexture() {
    compositeLayers();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');
    const source = compositeContext.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    const output = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
    for (let index = 0; index < source.data.length; index += 4) {
      const value = Math.round(source.data[index] * 0.2126 + source.data[index + 1] * 0.7152 + source.data[index + 2] * 0.0722);
      output.data[index] = output.data[index + 1] = output.data[index + 2] = value;
      output.data[index + 3] = 255;
    }
    ctx.putImageData(output, 0, 0);
    downloadDataUrl(`${safeName()}-height.png`, canvas.toDataURL('image/png'));
  }

  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Could not read the image.'));
      reader.readAsDataURL(file);
    });
  }

  document.querySelectorAll('[data-base]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-base]').forEach((item) => item.classList.toggle('active', item === button));
      initialiseMesh(createPrimitive(button.dataset.base));
    });
  });

  document.getElementById('asset-name').addEventListener('input', (event) => {
    state.objectName = event.target.value.slice(0, 80) || 'Sculpted object';
    refreshStageStatus();
  });

  document.getElementById('import-mesh').addEventListener('click', () => document.getElementById('mesh-file').click());
  document.getElementById('mesh-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      initialiseMesh(raw);
      showToast('Mesh imported.');
    } catch (error) {
      showToast(error.message || 'The mesh could not be imported.');
    }
  });

  document.getElementById('mode-tools').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    state.mode = button.dataset.mode;
    updateModeClasses();
  });

  document.getElementById('sculpt-tools').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tool]');
    if (!button) return;
    state.sculptTool = button.dataset.tool;
    document.querySelectorAll('#sculpt-tools [data-tool]').forEach((item) => item.classList.toggle('active', item === button));
  });

  const rangeOutputs = [
    ['sculpt-radius', 'sculpt-radius-v', 2], ['sculpt-strength', 'sculpt-strength-v', 3], ['sculpt-falloff', 'sculpt-falloff-v', 2],
    ['paint-opacity', 'paint-opacity-v', 2], ['paint-softness', 'paint-softness-v', 2], ['effect-strength', 'effect-strength-v', 2],
    ['texture-relief', 'texture-relief-v', 2], ['texture-midpoint', 'texture-midpoint-v', 2],
    ['procedural-scale', 'procedural-scale-v', 0], ['procedural-detail', 'procedural-detail-v', 2], ['procedural-contrast', 'procedural-contrast-v', 2]
  ];
  for (const [id, outputId, decimals] of rangeOutputs) {
    document.getElementById(id).addEventListener('input', (event) => {
      document.getElementById(outputId).textContent = Number(event.target.value).toFixed(decimals);
    });
  }

  function bindRangeNumberControls() {
    document.querySelectorAll('input[type="range"]').forEach((range) => {
      let number = range.nextElementSibling?.matches?.('input[type="number"].range-number')
        ? range.nextElementSibling
        : null;
      if (!number) {
        number = document.createElement('input');
        number.type = 'number';
        number.className = 'range-number';
        number.min = range.min;
        number.max = range.max;
        number.step = range.step || 'any';
        number.setAttribute('aria-label', `${range.id || 'range'} value`);
        range.insertAdjacentElement('afterend', number);
      }
      if (range.dataset.rangeNumberBound === '1') {
        number.value = range.value;
        number.disabled = range.disabled;
        return;
      }
      range.dataset.rangeNumberBound = '1';
      number.value = range.value;
      number.disabled = range.disabled;
      range.addEventListener('input', () => {
        number.value = range.value;
        number.disabled = range.disabled;
      });
      number.addEventListener('input', () => {
        if (number.value === '') return;
        const value = Core.clamp(Number(number.value), Number(range.min), Number(range.max));
        if (!Number.isFinite(value)) return;
        range.value = String(value);
        range.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  document.getElementById('undo').addEventListener('click', () => {
    const previous = state.undo.pop();
    if (!previous) return showToast('Nothing to undo.');
    state.redo.push(cloneVertices(state.asset.vertices));
    restoreVertices(previous);
  });
  document.getElementById('redo').addEventListener('click', () => {
    const next = state.redo.pop();
    if (!next) return showToast('Nothing to redo.');
    state.undo.push(cloneVertices(state.asset.vertices));
    restoreVertices(next);
  });
  document.getElementById('reset-mesh').addEventListener('click', () => {
    pushHistory();
    restoreVertices(state.baseAsset.vertices);
    showToast('Mesh reset to its imported or primitive base.');
  });

  document.querySelectorAll('[data-operation]').forEach((button) => button.addEventListener('click', () => applyWholeMeshOperation(button.dataset.operation)));

  layerList.addEventListener('click', (event) => {
    const visibility = event.target.closest('.layer-visible');
    if (visibility) {
      const layer = state.layers.find((item) => item.id === visibility.dataset.layerId);
      if (layer) {
        layer.visible = visibility.checked;
        markTextureDirty();
        refreshLayerUi();
      }
      event.stopPropagation();
      return;
    }
    const item = event.target.closest('.layer-item');
    if (!item) return;
    state.selectedLayerId = item.dataset.layerId;
    refreshLayerUi();
  });

  document.getElementById('add-paint-layer').addEventListener('click', () => {
    const layer = createLayer(`Paint ${state.layers.length + 1}`);
    state.layers.push(layer);
    state.selectedLayerId = layer.id;
    refreshLayerUi();
  });
  document.getElementById('add-procedural').addEventListener('click', () => {
    const layer = makeProceduralLayer(document.getElementById('procedural-kind').value);
    state.layers.push(layer);
    state.selectedLayerId = layer.id;
    markTextureDirty();
    refreshLayerUi();
  });

  function moveSelectedLayer(direction) {
    const index = state.layers.findIndex((layer) => layer.id === state.selectedLayerId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.layers.length) return;
    [state.layers[index], state.layers[target]] = [state.layers[target], state.layers[index]];
    markTextureDirty();
    refreshLayerUi();
  }
  document.getElementById('move-layer-up').addEventListener('click', () => moveSelectedLayer(1));
  document.getElementById('move-layer-down').addEventListener('click', () => moveSelectedLayer(-1));
  document.getElementById('duplicate-layer').addEventListener('click', () => {
    const layer = selectedLayer();
    if (!layer) return;
    const copy = createLayer(`${layer.name} copy`, layer.type);
    copy.visible = layer.visible; copy.opacity = layer.opacity; copy.blendMode = layer.blendMode;
    copy.canvas.getContext('2d').drawImage(layer.canvas, 0, 0);
    state.layers.push(copy);
    state.selectedLayerId = copy.id;
    markTextureDirty();
    refreshLayerUi();
  });
  document.getElementById('delete-layer').addEventListener('click', () => {
    if (state.layers.length <= 1) return showToast('At least one material layer is required.');
    const index = state.layers.findIndex((layer) => layer.id === state.selectedLayerId);
    if (index < 0) return;
    state.layers.splice(index, 1);
    state.selectedLayerId = state.layers[Math.max(0, index - 1)].id;
    markTextureDirty();
    refreshLayerUi();
  });

  document.getElementById('layer-name').addEventListener('input', (event) => {
    const layer = selectedLayer();
    if (!layer) return;
    layer.name = event.target.value.slice(0, 50);
    refreshLayerUi();
  });
  document.getElementById('blend-mode').addEventListener('change', (event) => {
    const layer = selectedLayer();
    if (!layer) return;
    layer.blendMode = event.target.value;
    markTextureDirty();
    refreshLayerUi();
  });
  document.getElementById('layer-opacity').addEventListener('input', (event) => {
    const layer = selectedLayer();
    if (!layer) return;
    layer.opacity = Number(event.target.value);
    markTextureDirty();
  });

  document.getElementById('clear-layer').addEventListener('click', () => {
    const layer = selectedLayer();
    if (!layer) return;
    layer.canvas.getContext('2d').clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    layer.type = 'paint';
    markTextureDirty();
    refreshLayerUi();
  });
  document.getElementById('upload-layer').addEventListener('click', () => document.getElementById('layer-file').click());
  document.getElementById('layer-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await loadImageFile(file);
      const layer = await imageToLayer(dataUrl, file.name.replace(/\.[^.]+$/, ''));
      state.layers.push(layer);
      state.selectedLayerId = layer.id;
      markTextureDirty();
      refreshLayerUi();
    } catch (error) {
      showToast(error.message || 'The image could not be loaded.');
    }
  });

  document.querySelectorAll('[data-effect]').forEach((button) => {
    button.addEventListener('click', () => {
      const layer = effectLayer(button.dataset.effect, Number(document.getElementById('effect-strength').value));
      state.layers.push(layer);
      state.selectedLayerId = layer.id;
      markTextureDirty();
      refreshLayerUi();
      showToast(`${button.dataset.effect} effect added as a layer.`);
    });
  });

  document.getElementById('bake-relief').addEventListener('click', bakeTextureRelief);

  let textureDrawing = false;
  textureCanvas.addEventListener('contextmenu', (event) => event.preventDefault());
  textureCanvas.addEventListener('pointerdown', (event) => {
    const layer = ensurePaintLayer();
    textureDrawing = true;
    const point = texturePoint(event);
    paintLast = point;
    textureCanvas.setPointerCapture(event.pointerId);
    paintStroke(layer, point, point, brushSettings(event));
  });
  textureCanvas.addEventListener('pointermove', (event) => {
    if (!textureDrawing) return;
    const layer = ensurePaintLayer();
    const point = texturePoint(event);
    paintStroke(layer, paintLast || point, point, brushSettings(event));
    paintLast = point;
  });
  const stopTextureDrawing = () => { textureDrawing = false; paintLast = null; refreshLayerUi(); };
  textureCanvas.addEventListener('pointerup', stopTextureDrawing);
  textureCanvas.addEventListener('pointercancel', stopTextureDrawing);

  view.addEventListener('contextmenu', (event) => event.preventDefault());
  view.addEventListener('pointerdown', (event) => {
    if (!state.asset) return;
    pointerId = event.pointerId;
    view.setPointerCapture(pointerId);
    lastPointer = { x: event.clientX, y: event.clientY };
    movedDistance = 0;
    strokeSeed += 1;
    if (state.mode === 'orbit' || event.button === 1) {
      pointerAction = 'orbit';
      view.classList.add('dragging');
      return;
    }
    if (state.mode === 'paint') {
      pointerAction = 'paint';
      paintLast = null;
      paintOnSurface(event);
      return;
    }
    const hit = hitAt(event);
    if (!hit) {
      pointerAction = 'orbit';
      view.classList.add('dragging');
      return;
    }
    pushHistory();
    pointerAction = 'sculpt';
    applySculptBrush(hit);
  });

  view.addEventListener('pointermove', (event) => {
    if (pointerAction === 'orbit') {
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;
      movedDistance += Math.hypot(dx, dy);
      state.camera.yaw += dx * 0.008;
      state.camera.pitch = Core.clamp(state.camera.pitch + dy * 0.008, -1.45, 1.45);
      lastPointer = { x: event.clientX, y: event.clientY };
      scheduleRender();
      return;
    }
    if (pointerAction === 'paint') {
      paintOnSurface(event);
      return;
    }
    if (pointerAction === 'sculpt') {
      const hit = hitAt(event);
      if (hit) applySculptBrush(hit);
    }
  });

  function endViewPointer() {
    if (pointerAction === 'paint') refreshLayerUi();
    pointerAction = null;
    pointerId = null;
    paintLast = null;
    view.classList.remove('dragging');
    refreshStageStatus();
  }
  view.addEventListener('pointerup', endViewPointer);
  view.addEventListener('pointercancel', endViewPointer);
  view.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.camera.distance = Core.clamp(state.camera.distance + event.deltaY * 0.004, 1.7, 12);
    scheduleRender();
  }, { passive: false });

  document.getElementById('reset-camera').addEventListener('click', () => {
    state.camera = { ...DEFAULT_CAMERA };
    scheduleRender();
  });
  document.getElementById('wireframe-toggle').addEventListener('click', (event) => {
    state.wireframe = !state.wireframe;
    event.target.textContent = `Wireframe: ${state.wireframe ? 'on' : 'off'}`;
    scheduleRender();
  });

  document.getElementById('send-world').addEventListener('click', () => {
    try {
      Core.queueAsset(exportAsset(false));
      window.location.href = 'world.html';
    } catch (error) {
      showToast(error.message || 'The asset could not be transferred.');
    }
  });
  document.getElementById('export-studio').addEventListener('click', () => Core.downloadJson(`${safeName()}.studio3d.json`, exportAsset()));
  document.getElementById('export-gltf').addEventListener('click', () => Core.downloadJson(`${safeName()}.gltf`, buildGltf()));
  document.getElementById('export-obj').addEventListener('click', exportObjPackage);
  document.getElementById('export-stl').addEventListener('click', exportStl);
  document.getElementById('export-stl-relief').addEventListener('click', exportTextureReliefStl);
  document.getElementById('export-stl-color').addEventListener('click', exportColorStl);
  document.getElementById('export-ply').addEventListener('click', exportPly);
  document.getElementById('export-texture').addEventListener('click', () => downloadDataUrl(`${safeName()}-texture.png`, compositeDataUrl()));
  document.getElementById('export-height').addEventListener('click', exportHeightTexture);

  function initialise() {
    const pending = Core.consumePendingAssets();
    if (pending.length) {
      initialiseMesh(pending[0]);
      showToast('Transferred asset opened in Sculpt Materials.');
    } else {
      initialiseMesh(createPrimitive('sphere'));
    }
    updateModeClasses();
    bindRangeNumberControls();
    resizeView();
  }

  window.addEventListener('resize', resizeView);
  initialise();
})();
