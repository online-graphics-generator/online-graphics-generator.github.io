(function () {
  'use strict';

  const Core = window.StudioCore;
  if (!Core) throw new Error('studio-core.js must be loaded before world.js');
  const Procedural = window.StudioProcedural;
  if (!Procedural) throw new Error('studio-procedural.js must be loaded before world.js');

  const canvas = document.getElementById('world-view');
  const WebGL = window.StudioWebGL;
  const webglRenderer = WebGL?.createRenderer(canvas, { onInvalidate: () => scheduleRender() });
  const context = webglRenderer?.available ? null : canvas.getContext('2d', { alpha: false });
  const stage = document.getElementById('stage');
  const objectList = document.getElementById('object-list');
  const objectCount = document.getElementById('object-count');
  const inspector = document.getElementById('inspector');
  const noSelection = document.getElementById('no-selection');
  const toast = document.getElementById('toast');
  const stageHint = document.getElementById('stage-hint');
  const painter = document.getElementById('texture-painter');
  const painterContext = painter.getContext('2d', { willReadFrequently: true });

  const DEFAULT_CAMERA = Object.freeze({ pitch: 0.48, yaw: 0.65, distance: 6.3, targetX: 0, targetY: 0, targetZ: 0 });
  const DEFAULT_DISPLACEMENT = Object.freeze({
    enabled: false,
    strength: 0.25,
    midpoint: 0.5,
    source: 'custom',
    data: null,
    label: 'No relief map'
  });
  const DEFAULT_RENDER_SETTINGS = Object.freeze({
    background: '#080b09', grid: true, exposure: 1.08, ambient: 0.34,
    lightIntensity: 1.15, lightAzimuth: -42, lightElevation: 55, rim: 0.18
  });
  const DEFAULT_MATERIAL = Object.freeze({
    type: 'checker',
    primary: '#50d08a',
    secondary: '#173b24',
    scale: 6,
    roughness: 0.55,
    textureData: null
  });

  const state = {
    objects: [],
    selectedId: null,
    camera: { ...DEFAULT_CAMERA },
    renderSettings: { ...DEFAULT_RENDER_SETTINGS },
    wireframe: false,
    freeCamera: false,
    renderQueued: false,
    saveTimer: 0,
    hitTriangles: [],
    paintMode: false
  };

  const imageCache = new Map();
  const liveTextureCache = new Map();
  const normalCache = new WeakMap();
  const displacementGeometryCache = new Map();
  let toastTimer = 0;
  let painterObjectId = null;
  let painterReady = true;
  let painterLoadToken = 0;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  function deepClone(value) {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function createMaterial(raw = {}) {
    const displacement = {
      ...DEFAULT_DISPLACEMENT,
      ...(raw.displacement && typeof raw.displacement === 'object' ? raw.displacement : {})
    };
    return {
      ...DEFAULT_MATERIAL,
      ...raw,
      displacement
    };
  }

  function makeObject(asset, name = asset.name) {
    return {
      id: Core.createId('object'),
      name: String(name || 'Object').slice(0, 80),
      asset,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      },
      material: createMaterial()
    };
  }

  function selectedObject() {
    return state.objects.find((object) => object.id === state.selectedId) || null;
  }

  function isPlacementMeshObject(object) {
    return object?.asset?.metadata?.placementMesh === true
      || (object?.name === 'Ground tile' && object?.asset?.type === 'primitive-plane');
  }

  function visibleObjects() {
    return state.renderSettings.grid === false
      ? state.objects.filter((object) => !isPlacementMeshObject(object))
      : state.objects;
  }

  function addObject(asset, options = {}) {
    const object = makeObject(asset, options.name || asset.name);
    const index = state.objects.length;
    object.transform.position.x = ((index % 4) - 1.5) * 1.25;
    object.transform.position.z = Math.floor(index / 4) * 1.25;
    if (options.position) Object.assign(object.transform.position, options.position);
    const embeddedMaterial = asset.metadata?.material;
    if (options.material || embeddedMaterial) object.material = createMaterial(options.material || embeddedMaterial);
    state.objects.push(object);
    state.selectedId = object.id;
    refreshUi({ forcePainter: true });
    scheduleRender();
    scheduleSave();
    return object;
  }

  function createGridAsset(name, type, rows, cols, vertexFactory) {
    const vertices = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        vertices.push(vertexFactory(row, col, rows, cols));
      }
    }
    return Core.standardiseAsset({
      schema: 'studio3d-asset-v1',
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
    const segments = 14;
    const side = segments + 1;
    const half = 0.65;
    const vertices = [];
    const faces = [];
    const uvs = [];
    const faceDefinitions = [
      { center: [0, 0, half], u: [1, 0, 0], v: [0, 1, 0] },
      { center: [0, 0, -half], u: [-1, 0, 0], v: [0, 1, 0] },
      { center: [half, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
      { center: [-half, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
      { center: [0, half, 0], u: [1, 0, 0], v: [0, 0, -1] },
      { center: [0, -half, 0], u: [1, 0, 0], v: [0, 0, 1] }
    ];

    for (const definition of faceDefinitions) {
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
      for (const [a, b, c] of Core.gridFaces(side, side)) faces.push([a + offset, b + offset, c + offset]);
    }

    return Core.standardiseAsset({ name: 'Cube', type: 'primitive-cube', vertices, faces, uvs });
  }

  function createPrimitive(kind) {
    if (kind === 'cube') return createCubeAsset();
    if (kind === 'sphere') {
      const rows = 33, cols = 49;
      return createGridAsset('Sphere', 'primitive-sphere', rows, cols, (row, col) => {
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
    if (kind === 'torus') {
      const rows = 33, cols = 49;
      return createGridAsset('Torus', 'primitive-torus', rows, cols, (row, col) => {
        const v = row / (rows - 1) * Math.PI * 2;
        const u = col / (cols - 1) * Math.PI * 2;
        const major = 0.72, minor = 0.28;
        return [
          (major + minor * Math.cos(v)) * Math.cos(u),
          minor * Math.sin(v),
          (major + minor * Math.cos(v)) * Math.sin(u)
        ];
      });
    }
    return createGridAsset('Plane', 'primitive-plane', 25, 25, (row, col, rows, cols) => [
      (col / (cols - 1) - 0.5) * 2,
      0,
      (row / (rows - 1) - 0.5) * 2
    ]);
  }

  function upgradePrimitiveAsset(asset) {
    const legacySignatures = {
      'primitive-cube': { vertices: 8, faces: 12 },
      'primitive-plane': { vertices: 4, faces: 2 },
      'primitive-sphere': { vertices: 925, faces: 1728 },
      'primitive-torus': { vertices: 1189, faces: 2240 }
    };
    const signature = legacySignatures[asset.type];
    if (!signature || asset.vertices.length !== signature.vertices || asset.faces.length !== signature.faces) return asset;
    const kind = asset.type.replace('primitive-', '');
    const upgraded = createPrimitive(kind);
    upgraded.id = asset.id;
    upgraded.name = asset.name;
    upgraded.metadata = { ...asset.metadata, upgradedForPainting: true };
    return upgraded;
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => Core.saveWorldDraft(serialiseWorld()), 280);
  }

  function serialiseWorld() {
    return {
      schema: 'studio3d-world-v1',
      version: 2,
      savedAt: new Date().toISOString(),
      camera: { ...state.camera },
      renderSettings: { ...state.renderSettings },
      wireframe: state.wireframe,
      objects: state.objects
    };
  }

  function loadWorldDocument(documentData) {
    if (!documentData || !Array.isArray(documentData.objects)) {
      throw new Error('This file is not a valid Studio 3D world.');
    }

    imageCache.clear();
    liveTextureCache.clear();
    displacementGeometryCache.clear();
    const objects = documentData.objects.map((item, index) => {
      let asset = Core.standardiseAsset(item.asset || item.geometry || item, { name: item.name || `Object ${index + 1}` });
      asset = upgradePrimitiveAsset(asset);
      const object = makeObject(asset, item.name || asset.name);
      object.id = typeof item.id === 'string' ? item.id : Core.createId('object');
      if (item.transform) {
        Object.assign(object.transform.position, item.transform.position || {});
        Object.assign(object.transform.rotation, item.transform.rotation || {});
        Object.assign(object.transform.scale, item.transform.scale || {});
      }
      object.material = createMaterial(item.material || {});
      return object;
    });

    state.objects = objects;
    state.selectedId = objects[0]?.id || null;
    state.camera = { ...DEFAULT_CAMERA, ...(documentData.camera || {}) };
    state.renderSettings = { ...DEFAULT_RENDER_SETTINGS, ...(documentData.renderSettings || {}) };
    state.wireframe = documentData.wireframe === true;
    setPaintMode(false);
    refreshUi({ forcePainter: true });
    scheduleRender();
    scheduleSave();
  }

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
    if (context) context.setTransform(dpr, 0, 0, dpr, 0, 0);
    scheduleRender();
  }

  function rotateX(point, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return { x: point.x, y: point.y * cosine - point.z * sine, z: point.y * sine + point.z * cosine };
  }

  function rotateY(point, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return { x: point.x * cosine + point.z * sine, y: point.y, z: -point.x * sine + point.z * cosine };
  }

  function rotateZ(point, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine, z: point.z };
  }

  function objectToWorld(vertex, transform) {
    let point = {
      x: vertex[0] * transform.scale.x,
      y: vertex[1] * transform.scale.y,
      z: vertex[2] * transform.scale.z
    };
    point = rotateX(point, transform.rotation.x * Math.PI / 180);
    point = rotateY(point, transform.rotation.y * Math.PI / 180);
    point = rotateZ(point, transform.rotation.z * Math.PI / 180);
    point.x += transform.position.x;
    point.y += transform.position.y;
    point.z += transform.position.z;
    return point;
  }

  function worldToCamera(point) {
    let cameraPoint = {
      x: point.x - (state.camera.targetX || 0),
      y: point.y - (state.camera.targetY || 0),
      z: point.z - (state.camera.targetZ || 0)
    };
    cameraPoint = rotateX(cameraPoint, state.camera.pitch);
    cameraPoint = rotateY(cameraPoint, state.camera.yaw);
    return cameraPoint;
  }

  function project(point, width, height) {
    const depth = point.z + state.camera.distance;
    if (depth <= 0.05) return null;
    const focalLength = Math.min(width, height) * 0.82;
    return {
      x: width / 2 + point.x * focalLength / depth,
      y: height / 2 - point.y * focalLength / depth,
      depth
    };
  }

  function cameraBasis(camera = state.camera) {
    const yaw = Number(camera.yaw) || 0;
    return {
      right: { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) },
      forward: { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) },
      up: { x: 0, y: 1, z: 0 }
    };
  }

  function moveCameraTarget(camera, rightAmount = 0, upAmount = 0, forwardAmount = 0) {
    const basis = cameraBasis(camera);
    camera.targetX = (camera.targetX || 0) + basis.right.x * rightAmount + basis.forward.x * forwardAmount;
    camera.targetY = (camera.targetY || 0) + upAmount;
    camera.targetZ = (camera.targetZ || 0) + basis.right.z * rightAmount + basis.forward.z * forwardAmount;
  }

  function panCameraByPixels(dx, dy) {
    const scale = Math.max(0.002, state.camera.distance * 0.0016);
    moveCameraTarget(state.camera, -dx * scale, dy * scale, 0);
  }

  function cross(a, b, c) {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    return {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };
  }

  function normaliseVector(vector, fallback = { x: 0, y: 1, z: 0 }) {
    const length = Math.hypot(vector.x, vector.y, vector.z);
    if (!Number.isFinite(length) || length <= Number.EPSILON) return { ...fallback };
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
  }

  function parseColor(value) {
    if (value && typeof value === 'object' && Number.isFinite(value.r)) {
      return {
        r: Core.clamp(Math.round(value.r), 0, 255),
        g: Core.clamp(Math.round(value.g), 0, 255),
        b: Core.clamp(Math.round(value.b), 0, 255)
      };
    }

    const text = String(value || '').trim();
    const rgbMatch = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgbMatch) {
      return {
        r: Core.clamp(Math.round(Number(rgbMatch[1])), 0, 255),
        g: Core.clamp(Math.round(Number(rgbMatch[2])), 0, 255),
        b: Core.clamp(Math.round(Number(rgbMatch[3])), 0, 255)
      };
    }

    const valueWithoutHash = text.replace('#', '');
    const expanded = valueWithoutHash.length === 3
      ? valueWithoutHash.split('').map((part) => part + part).join('')
      : valueWithoutHash.padEnd(6, '0').slice(0, 6);
    const number = Number.parseInt(expanded, 16);
    if (!Number.isFinite(number)) return { r: 0, g: 0, b: 0 };
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  function shadedColor(colorValue, intensity) {
    const color = parseColor(colorValue);
    const amount = Core.clamp(intensity, 0, 1.25);
    return `rgb(${Math.round(color.r * amount)},${Math.round(color.g * amount)},${Math.round(color.b * amount)})`;
  }

  function putCanvasInCache(cache, key, sourceCanvas, sourceContext) {
    if (!key) return;
    try {
      const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      cache.set(key, {
        status: 'ready',
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        pixels: new Uint8ClampedArray(imageData.data)
      });
    } catch (error) {
      console.warn('Could not read texture pixels.', error);
    }
  }

  function loadTexture(dataUrl) {
    if (!dataUrl || imageCache.has(dataUrl)) return;
    imageCache.set(dataUrl, { status: 'loading' });
    const image = new Image();
    image.onload = () => {
      try {
        const size = 256;
        const offscreen = document.createElement('canvas');
        offscreen.width = size;
        offscreen.height = size;
        const offscreenContext = offscreen.getContext('2d', { willReadFrequently: true });
        offscreenContext.drawImage(image, 0, 0, size, size);
        putCanvasInCache(imageCache, dataUrl, offscreen, offscreenContext);
        scheduleRender();
      } catch (error) {
        imageCache.set(dataUrl, { status: 'error' });
        console.warn('Could not decode texture.', error);
      }
    };
    image.onerror = () => imageCache.set(dataUrl, { status: 'error' });
    image.src = dataUrl;
  }

  function sampleCache(cacheEntry, u, v) {
    if (!cacheEntry || cacheEntry.status !== 'ready') return null;
    const wrappedU = (u % 1 + 1) % 1;
    const wrappedV = (v % 1 + 1) % 1;
    const x = Math.min(cacheEntry.width - 1, Math.floor(wrappedU * cacheEntry.width));
    const y = Math.min(cacheEntry.height - 1, Math.floor((1 - wrappedV) * cacheEntry.height));
    const index = (y * cacheEntry.width + x) * 4;
    return {
      r: cacheEntry.pixels[index],
      g: cacheEntry.pixels[index + 1],
      b: cacheEntry.pixels[index + 2],
      a: cacheEntry.pixels[index + 3]
    };
  }

  function sampleImage(dataUrl, u, v, objectId = null, preferLive = false) {
    if (preferLive && objectId && liveTextureCache.has(objectId)) {
      return sampleCache(liveTextureCache.get(objectId), u, v);
    }
    if (!dataUrl) return null;
    loadTexture(dataUrl);
    return sampleCache(imageCache.get(dataUrl), u, v);
  }

  function textureColor(object, uv, worldY) {
    const material = object.material;
    const scale = Math.max(1, Number(material.scale) || 1);
    const u = uv[0], v = uv[1];
    switch (material.type) {
      case 'checker':
        return (Math.floor(u * scale) + Math.floor(v * scale)) % 2 === 0 ? material.primary : material.secondary;
      case 'stripes':
        return Math.floor(u * scale) % 2 === 0 ? material.primary : material.secondary;
      case 'contour':
        return Math.floor((worldY + 10) * scale) % 2 === 0 ? material.primary : material.secondary;
      case 'noise': {
        const noise = Math.sin((u * 91.7 + v * 137.3) * scale) * 43758.5453;
        return noise - Math.floor(noise) > 0.52 ? material.primary : material.secondary;
      }
      case 'image':
        return sampleImage(material.textureData, u * scale, v * scale, object.id, true) || material.primary;
      default:
        return material.primary;
    }
  }

  function getVertexNormals(asset) {
    const cached = normalCache.get(asset);
    if (cached) return cached;

    if (asset.type === 'primitive-sphere') {
      const normals = asset.vertices.map(([x, y, z]) => {
        const normal = normaliseVector({ x, y, z });
        return [normal.x, normal.y, normal.z];
      });
      normalCache.set(asset, normals);
      return normals;
    }

    if (asset.type === 'primitive-torus') {
      const major = 0.72;
      const normals = asset.vertices.map(([x, y, z]) => {
        const radialLength = Math.hypot(x, z) || 1;
        const centerX = x / radialLength * major;
        const centerZ = z / radialLength * major;
        const normal = normaliseVector({ x: x - centerX, y, z: z - centerZ });
        return [normal.x, normal.y, normal.z];
      });
      normalCache.set(asset, normals);
      return normals;
    }

    const accumulated = asset.vertices.map(() => ({ x: 0, y: 0, z: 0 }));
    for (const [ia, ib, ic] of asset.faces) {
      const a = { x: asset.vertices[ia][0], y: asset.vertices[ia][1], z: asset.vertices[ia][2] };
      const b = { x: asset.vertices[ib][0], y: asset.vertices[ib][1], z: asset.vertices[ib][2] };
      const c = { x: asset.vertices[ic][0], y: asset.vertices[ic][1], z: asset.vertices[ic][2] };
      const faceNormal = cross(a, b, c);
      for (const index of [ia, ib, ic]) {
        accumulated[index].x += faceNormal.x;
        accumulated[index].y += faceNormal.y;
        accumulated[index].z += faceNormal.z;
      }
    }

    const center = asset.vertices.reduce((sum, vertex) => {
      sum.x += vertex[0]; sum.y += vertex[1]; sum.z += vertex[2];
      return sum;
    }, { x: 0, y: 0, z: 0 });
    center.x /= asset.vertices.length;
    center.y /= asset.vertices.length;
    center.z /= asset.vertices.length;

    let normals = accumulated.map((normal, index) => {
      const [x, y, z] = asset.vertices[index];
      const fallback = normaliseVector({ x: x - center.x, y: y - center.y, z: z - center.z });
      const result = normaliseVector(normal, fallback);
      return [result.x, result.y, result.z];
    });

    if (asset.type.includes('plane') || asset.type === 'heightmap') {
      const averageY = normals.reduce((sum, normal) => sum + normal[1], 0);
      if (averageY < 0) normals = normals.map(([x, y, z]) => [-x, -y, -z]);
    } else {
      let orientationScore = 0;
      for (let index = 0; index < asset.vertices.length; index += 1) {
        const [x, y, z] = asset.vertices[index];
        const [nx, ny, nz] = normals[index];
        orientationScore += (x - center.x) * nx + (y - center.y) * ny + (z - center.z) * nz;
      }
      if (orientationScore < 0) normals = normals.map(([x, y, z]) => [-x, -y, -z]);
    }

    normalCache.set(asset, normals);
    return normals;
  }

  function displacementData(object) {
    const displacement = object.material.displacement;
    if (!displacement?.enabled) return null;
    if (displacement.source === 'texture') return object.material.textureData;
    return displacement.data;
  }

  function displacedLocalVertices(object) {
    const displacement = object.material.displacement;
    const dataUrl = displacementData(object);
    const strength = Core.clamp(Number(displacement?.strength) || 0, 0, 2);
    if (!dataUrl || strength <= Number.EPSILON) return object.asset.vertices;

    const midpoint = Core.clamp(Number(displacement.midpoint) || 0, 0, 1);
    const useLive = displacement.source === 'texture' && painterObjectId === object.id && liveTextureCache.has(object.id);
    const cached = displacementGeometryCache.get(object.id);
    if (!useLive && cached && cached.asset === object.asset && cached.dataUrl === dataUrl && cached.strength === strength && cached.midpoint === midpoint) return cached.vertices;

    const normals = getVertexNormals(object.asset);
    const vertices = object.asset.vertices.map((vertex, index) => {
      const uv = object.asset.uvs[index] || [0, 0];
      const sample = sampleImage(dataUrl, uv[0], uv[1], object.id, useLive);
      if (!sample) return vertex;
      const luminance = (sample.r * 0.2126 + sample.g * 0.7152 + sample.b * 0.0722) / 255;
      const amount = (luminance - midpoint) * strength;
      const normal = normals[index] || [0, 1, 0];
      return [vertex[0] + normal[0] * amount, vertex[1] + normal[1] * amount, vertex[2] + normal[2] * amount];
    });
    if (!useLive) displacementGeometryCache.set(object.id, { asset: object.asset, dataUrl, strength, midpoint, vertices });
    return vertices;
  }

  function renderGround(width, height) {
    if (state.renderSettings.grid === false) return;
    context.save();
    context.lineWidth = 1;
    for (let line = -8; line <= 8; line += 1) {
      const alpha = line === 0 ? 0.22 : 0.09;
      context.strokeStyle = `rgba(120,210,145,${alpha})`;
      const segments = [
        [{ x: line, y: 0, z: -8 }, { x: line, y: 0, z: 8 }],
        [{ x: -8, y: 0, z: line }, { x: 8, y: 0, z: line }]
      ];
      for (const [start, end] of segments) {
        const a = project(worldToCamera(start), width, height);
        const b = project(worldToCamera(end), width, height);
        if (!a || !b) continue;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }
    context.restore();
  }

  function renderCanvas2D() {
    const rect = stage.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    context.fillStyle = '#080a08';
    context.fillRect(0, 0, width, height);
    renderGround(width, height);

    const triangles = [];
    for (const object of visibleObjects()) {
      const localVertices = displacedLocalVertices(object);
      const worldVertices = localVertices.map((vertex) => objectToWorld(vertex, object.transform));
      const cameraVertices = worldVertices.map(worldToCamera);
      const projected = cameraVertices.map((point) => project(point, width, height));
      const uvs = object.asset.uvs;

      for (const face of object.asset.faces) {
        const [ia, ib, ic] = face;
        const pa = projected[ia], pb = projected[ib], pc = projected[ic];
        if (!pa || !pb || !pc) continue;
        const cameraNormal = normaliseVector(cross(cameraVertices[ia], cameraVertices[ib], cameraVertices[ic]));
        const light = normaliseVector({ x: -0.35, y: 0.75, z: -0.55 });
        const diffuse = Math.abs(cameraNormal.x * light.x + cameraNormal.y * light.y + cameraNormal.z * light.z);
        const roughness = Core.clamp(Number(object.material.roughness) || 0, 0, 1);
        const lighting = 0.28 + diffuse * (0.82 - roughness * 0.28);
        const triangleUvs = [uvs[ia] || [0, 0], uvs[ib] || [0, 0], uvs[ic] || [0, 0]];
        const uv = [
          (triangleUvs[0][0] + triangleUvs[1][0] + triangleUvs[2][0]) / 3,
          (triangleUvs[0][1] + triangleUvs[1][1] + triangleUvs[2][1]) / 3
        ];
        const worldY = (worldVertices[ia].y + worldVertices[ib].y + worldVertices[ic].y) / 3;
        triangles.push({
          objectId: object.id,
          points: [pa, pb, pc],
          uvs: triangleUvs,
          depth: (pa.depth + pb.depth + pc.depth) / 3,
          fill: shadedColor(textureColor(object, uv, worldY), lighting),
          selected: object.id === state.selectedId
        });
      }
    }

    triangles.sort((a, b) => b.depth - a.depth);
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
      if (state.wireframe || triangle.selected) {
        context.strokeStyle = triangle.selected ? 'rgba(190,255,205,.62)' : 'rgba(4,12,6,.34)';
        context.lineWidth = triangle.selected ? 0.8 : 0.45;
        context.stroke();
      }
    }
  }

  function rebuildHitTriangles() {
    const rect = stage.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    const triangles = [];
    for (const object of visibleObjects()) {
      const localVertices = displacedLocalVertices(object);
      const worldVertices = localVertices.map((vertex) => objectToWorld(vertex, object.transform));
      const projected = worldVertices.map((point) => project(worldToCamera(point), width, height));
      const uvs = object.asset.uvs;
      for (const face of object.asset.faces) {
        const [ia, ib, ic] = face;
        const pa = projected[ia], pb = projected[ib], pc = projected[ic];
        if (!pa || !pb || !pc) continue;
        triangles.push({
          objectId: object.id,
          points: [pa, pb, pc],
          uvs: [uvs[ia] || [0, 0], uvs[ib] || [0, 0], uvs[ic] || [0, 0]],
          depth: (pa.depth + pb.depth + pc.depth) / 3
        });
      }
    }
    triangles.sort((a, b) => b.depth - a.depth);
    state.hitTriangles = triangles;
  }

  function render() {
    if (!webglRenderer?.available) return renderCanvas2D();
    const renderObjects = visibleObjects().map((object) => {
      const live = painterObjectId === object.id && painterReady && liveTextureCache.has(object.id) && object.material.type === 'image';
      return live ? { ...object, __textureSource: painter } : object;
    });
    webglRenderer.render(renderObjects, state.camera, {
      ...state.renderSettings,
      selectedId: state.selectedId,
      wireframe: state.wireframe,
      getVertices: displacedLocalVertices
    });
    const badge = document.getElementById('render-backend');
    if (badge) {
      const stats = webglRenderer.getStats();
      badge.textContent = `WebGL2 - ${stats.triangles.toLocaleString()} tris`;
    }
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

  function pickTriangle(x, y, objectId = null) {
    for (let index = state.hitTriangles.length - 1; index >= 0; index -= 1) {
      const triangle = state.hitTriangles[index];
      if (objectId && triangle.objectId !== objectId) continue;
      if (pointInTriangle(x, y, triangle)) return triangle;
    }
    return null;
  }

  function perspectiveUvAt(x, y, triangle) {
    const [a, b, c] = triangle.points;
    const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(denominator) <= Number.EPSILON) return null;
    const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
    const l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
    const l3 = 1 - l1 - l2;
    const weights = [l1 / a.depth, l2 / b.depth, l3 / c.depth];
    const sum = weights[0] + weights[1] + weights[2];
    if (Math.abs(sum) <= Number.EPSILON) return null;
    return [
      (triangle.uvs[0][0] * weights[0] + triangle.uvs[1][0] * weights[1] + triangle.uvs[2][0] * weights[2]) / sum,
      (triangle.uvs[0][1] * weights[0] + triangle.uvs[1][1] * weights[1] + triangle.uvs[2][1] * weights[2]) / sum
    ];
  }

  function refreshObjectList() {
    objectCount.textContent = String(state.objects.length);
    objectList.replaceChildren();
    if (!state.objects.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Add a primitive or import a generated asset.';
      objectList.appendChild(empty);
      return;
    }
    for (const object of state.objects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `object-item${object.id === state.selectedId ? ' selected' : ''}`;
      button.dataset.objectId = object.id;
      button.style.setProperty('--object-color', object.material.primary);
      button.innerHTML = '<span class="object-dot"></span><span class="object-name"></span><span class="object-kind"></span>';
      button.querySelector('.object-name').textContent = object.name;
      button.querySelector('.object-kind').textContent = object.asset.type.replace('primitive-', '');
      objectList.appendChild(button);
    }
  }

  const transformDefinitions = [
    ['position.x', 'Position X', -50, 50, 0.05], ['position.y', 'Position Y', -50, 50, 0.05], ['position.z', 'Position Z', -50, 50, 0.05],
    ['rotation.x', 'Rotate X', -1080, 1080, 1], ['rotation.y', 'Rotate Y', -1080, 1080, 1], ['rotation.z', 'Rotate Z', -1080, 1080, 1],
    ['scale.x', 'Scale X', 0.01, 20, 0.01], ['scale.y', 'Scale Y', 0.01, 20, 0.01], ['scale.z', 'Scale Z', 0.01, 20, 0.01]
  ];

  function getNested(object, path) {
    return path.split('.').reduce((current, key) => current[key], object);
  }

  function setNested(object, path, value) {
    const keys = path.split('.');
    const finalKey = keys.pop();
    const target = keys.reduce((current, key) => current[key], object);
    target[finalKey] = value;
  }

  function buildTransformControls() {
    const container = document.getElementById('transform-controls');
    container.replaceChildren();
    for (const [path, labelText, min, max, step] of transformDefinitions) {
      const wrapper = document.createElement('div');
      wrapper.className = 'control';
      const safeId = `transform-${path.replace('.', '-')}`;
      wrapper.innerHTML = `
        <div class="control-header"><label for="${safeId}">${labelText}</label><output data-output="${path}"></output></div>
        <input id="${safeId}" type="range" min="${min}" max="${max}" step="${step}" data-transform="${path}">
        <input class="range-number" type="number" min="${min}" max="${max}" step="${step}" data-transform="${path}" aria-label="${labelText} value">
      `;
      container.appendChild(wrapper);
    }
  }

  function bindRangeNumberControls() {
    document.querySelectorAll('input[type="range"]').forEach((range) => {
      if (range.id === 'timeline') return;
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
      range.addEventListener('input', () => { number.value = range.value; });
      number.addEventListener('input', () => {
        if (number.value === '') return;
        const value = Core.clamp(Number(number.value), Number(range.min), Number(range.max));
        if (!Number.isFinite(value)) return;
        range.value = String(value);
        range.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  function fillPainter(color) {
    painterContext.fillStyle = color;
    painterContext.fillRect(0, 0, painter.width, painter.height);
  }

  function updateLiveTexture(object) {
    if (!object) return;
    putCanvasInCache(liveTextureCache, object.id, painter, painterContext);
  }

  function drawTextureIntoPainter(dataUrl, object, token) {
    const image = new Image();
    image.onload = () => {
      if (token !== painterLoadToken || state.selectedId !== object.id) return;
      painterContext.clearRect(0, 0, painter.width, painter.height);
      painterContext.drawImage(image, 0, 0, painter.width, painter.height);
      painterReady = true;
      updateLiveTexture(object);
      scheduleRender();
    };
    image.onerror = () => {
      if (token !== painterLoadToken || state.selectedId !== object.id) return;
      fillPainter(object.material.primary);
      painterReady = true;
      updateLiveTexture(object);
      showToast('The saved texture could not be decoded. A blank paint layer was created.');
    };
    image.src = dataUrl;
  }

  function syncPainterFromObject(object, force = false) {
    if (!object) {
      painterObjectId = null;
      painterReady = true;
      fillPainter('#142218');
      return;
    }
    if (!force && painterObjectId === object.id) return;

    painterObjectId = object.id;
    painterReady = false;
    const token = ++painterLoadToken;
    if (object.material.textureData) {
      drawTextureIntoPainter(object.material.textureData, object, token);
    } else {
      fillPainter(object.material.primary);
      painterReady = true;
      updateLiveTexture(object);
    }
  }

  function refreshInspector(options = {}) {
    const object = selectedObject();
    inspector.classList.toggle('hidden', !object);
    noSelection.classList.toggle('hidden', Boolean(object));
    if (!object) {
      syncPainterFromObject(null, true);
      return;
    }

    document.getElementById('object-name').value = object.name;
    for (const input of document.querySelectorAll('[data-transform]')) {
      const value = getNested(object.transform, input.dataset.transform);
      input.value = String(value);
      const output = document.querySelector(`[data-output="${input.dataset.transform}"]`);
      output.textContent = Number(value).toFixed(input.dataset.transform.startsWith('rotation') ? 0 : 2);
    }
    document.getElementById('texture-type').value = object.material.type;
    document.getElementById('primary-color').value = object.material.primary;
    document.getElementById('secondary-color').value = object.material.secondary;
    document.getElementById('texture-scale').value = String(object.material.scale);
    document.getElementById('texture-scale-value').textContent = String(object.material.scale);
    document.getElementById('roughness').value = String(object.material.roughness);
    document.getElementById('roughness-value').textContent = Number(object.material.roughness).toFixed(2);

    const displacement = object.material.displacement;
    document.getElementById('relief-enabled').checked = Boolean(displacement.enabled);
    document.getElementById('relief-strength').value = String(displacement.strength);
    document.getElementById('relief-strength-value').textContent = Number(displacement.strength).toFixed(2);
    document.getElementById('relief-midpoint').value = String(displacement.midpoint);
    document.getElementById('relief-midpoint-value').textContent = Number(displacement.midpoint).toFixed(2);
    document.getElementById('relief-source').textContent = displacement.data
      ? `${displacement.label || 'Relief map'} is assigned. Brightness displaces vertices along their surface normals.`
      : 'No relief map. Bright pixels push outward; dark pixels move inward when the neutral level is above zero.';

    syncPainterFromObject(object, Boolean(options.forcePainter));
  }

  function refreshUi(options = {}) {
    refreshObjectList();
    refreshInspector(options);
    refreshRenderControls();
    document.getElementById('toggle-wireframe').textContent = `Wireframe: ${state.wireframe ? 'on' : 'off'}`;
    const paintButton = document.getElementById('surface-paint-toggle');
    paintButton.textContent = `Paint on object: ${state.paintMode ? 'on' : 'off'}`;
    paintButton.classList.toggle('active', state.paintMode);
    const freeCameraButton = document.getElementById('toggle-free-camera');
    if (freeCameraButton) {
      freeCameraButton.textContent = `Free cam: ${state.freeCamera ? 'on' : 'off'}`;
      freeCameraButton.classList.toggle('active', state.freeCamera);
    }
    stageHint.textContent = state.paintMode
      ? 'Brush directly on the selected object - Turn paint mode off to orbit'
      : (state.freeCamera
        ? 'Free cam: WASD move - R/F up/down - Ctrl/right-drag pan - Drag orbit'
        : 'Drag to orbit - Ctrl/right-drag to pan - Scroll to zoom - Click empty space to deselect');
    const placementButton = document.getElementById('toggle-placement-mesh');
    if (placementButton) {
      const enabled = state.renderSettings.grid !== false;
      placementButton.textContent = `Placement mesh: ${enabled ? 'on' : 'off'}`;
      placementButton.classList.toggle('active', enabled);
    }
    canvas.classList.toggle('painting', state.paintMode);
    bindRangeNumberControls();
  }

  async function importAssetFiles(files) {
    let imported = 0;
    for (const file of files) {
      try {
        const raw = JSON.parse(await file.text());
        let asset = Core.standardiseAsset(raw, { name: file.name.replace(/\.json$/i, ''), normalise: true });
        asset = upgradePrimitiveAsset(asset);
        addObject(asset, { name: asset.name });
        imported += 1;
      } catch (error) {
        console.error(error);
        showToast(`${file.name}: ${error.message}`);
      }
    }
    if (imported) showToast(`Added ${imported} asset${imported === 1 ? '' : 's'}.`);
  }

  function deleteSelected() {
    const index = state.objects.findIndex((object) => object.id === state.selectedId);
    if (index < 0) return;
    liveTextureCache.delete(state.objects[index].id);
    displacementGeometryCache.delete(state.objects[index].id);
    state.objects.splice(index, 1);
    state.selectedId = state.objects[index]?.id || state.objects[index - 1]?.id || null;
    refreshUi({ forcePainter: true });
    scheduleRender();
    scheduleSave();
  }

  function duplicateSelected() {
    const source = selectedObject();
    if (!source) return;
    const copy = deepClone(source);
    copy.id = Core.createId('object');
    copy.name = `${source.name} copy`;
    copy.transform.position.x += 0.4;
    copy.transform.position.z += 0.25;
    state.objects.push(copy);
    state.selectedId = copy.id;
    refreshUi({ forcePainter: true });
    scheduleRender();
    scheduleSave();
  }

  function setPaintMode(enabled) {
    state.paintMode = Boolean(enabled);
    refreshUi();
  }

  function painterPoint(event) {
    const rect = painter.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * painter.width / rect.width,
      y: (event.clientY - rect.top) * painter.height / rect.height
    };
  }

  function brushSettings() {
    return {
      color: document.getElementById('paint-color').value,
      size: Number(document.getElementById('paint-size').value)
    };
  }

  function drawBrushSegment(from, to, offsetX = 0) {
    const settings = brushSettings();
    painterContext.strokeStyle = settings.color;
    painterContext.fillStyle = settings.color;
    painterContext.lineWidth = settings.size;
    painterContext.lineCap = 'round';
    painterContext.lineJoin = 'round';
    painterContext.beginPath();
    painterContext.moveTo(from.x + offsetX, from.y);
    painterContext.lineTo(to.x + offsetX, to.y);
    painterContext.stroke();
    if (Math.hypot(to.x - from.x, to.y - from.y) < 0.5) {
      painterContext.beginPath();
      painterContext.arc(to.x + offsetX, to.y, settings.size / 2, 0, Math.PI * 2);
      painterContext.fill();
    }
  }

  function paintWrappedStroke(from, to) {
    const width = painter.width;
    const dx = to.x - from.x;
    if (Math.abs(dx) > width / 2) {
      if (dx > 0) {
        drawBrushSegment(from, { x: to.x - width, y: to.y });
        drawBrushSegment({ x: from.x + width, y: from.y }, to);
      } else {
        drawBrushSegment(from, { x: to.x + width, y: to.y });
        drawBrushSegment({ x: from.x - width, y: from.y }, to);
      }
    } else {
      drawBrushSegment(from, to);
    }
    drawBrushSegment(from, to, -width);
    drawBrushSegment(from, to, width);
  }

  function beginTextureEdit(object) {
    if (!object || painterObjectId !== object.id || !painterReady) return false;
    object.material.type = 'image';
    object.material.scale = 1;
    document.getElementById('texture-type').value = 'image';
    document.getElementById('texture-scale').value = '1';
    document.getElementById('texture-scale-value').textContent = '1';
    return true;
  }

  function updateTexturePreview(object) {
    updateLiveTexture(object);
    refreshObjectList();
    scheduleRender();
  }

  function commitPainterTexture(object, message = '') {
    if (!object || painterObjectId !== object.id || !painterReady) return;
    object.material.type = 'image';
    object.material.scale = 1;
    object.material.textureData = painter.toDataURL('image/png');
    const live = liveTextureCache.get(object.id);
    if (live) imageCache.set(object.material.textureData, live);
    refreshInspector();
    scheduleRender();
    scheduleSave();
    if (message) showToast(message);
  }

  function proceduralTextureOptions() {
    return {
      kind: document.getElementById('pattern-kind').value,
      primary: document.getElementById('primary-color').value,
      secondary: document.getElementById('secondary-color').value,
      scale: Number(document.getElementById('pattern-scale').value),
      detail: Number(document.getElementById('pattern-detail').value),
      contrast: Number(document.getElementById('pattern-contrast').value)
    };
  }

  let painterDrawing = false;
  let painterLast = null;

  painter.addEventListener('pointerdown', (event) => {
    const object = selectedObject();
    if (!object) {
      showToast('Select an object before painting.');
      return;
    }
    if (!beginTextureEdit(object)) {
      showToast('The texture is still loading. Try the brush again.');
      return;
    }
    painterDrawing = true;
    painterLast = painterPoint(event);
    painter.setPointerCapture(event.pointerId);
    paintWrappedStroke(painterLast, painterLast);
    updateTexturePreview(object);
  });

  painter.addEventListener('pointermove', (event) => {
    if (!painterDrawing) return;
    const object = selectedObject();
    if (!object) return;
    const point = painterPoint(event);
    paintWrappedStroke(painterLast, point);
    painterLast = point;
    updateTexturePreview(object);
  });

  function finishPainterStroke() {
    if (!painterDrawing) return;
    painterDrawing = false;
    painterLast = null;
    commitPainterTexture(selectedObject());
  }

  painter.addEventListener('pointerup', finishPainterStroke);
  painter.addEventListener('pointercancel', finishPainterStroke);

  let cameraDragging = false;
  let cameraDragMode = 'orbit';
  let surfacePainting = false;
  let lastPointer = { x: 0, y: 0 };
  let movedDistance = 0;
  let surfaceLastPoint = null;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function paintSurfaceAt(event) {
    const object = selectedObject();
    if (!object || !beginTextureEdit(object)) return false;
    const point = canvasPoint(event);
    const triangle = pickTriangle(point.x, point.y, object.id);
    if (!triangle) {
      surfaceLastPoint = null;
      return false;
    }
    const uv = perspectiveUvAt(point.x, point.y, triangle);
    if (!uv) return false;
    const paintPoint = {
      x: ((uv[0] % 1 + 1) % 1) * painter.width,
      y: (1 - Core.clamp(uv[1], 0, 1)) * painter.height
    };
    paintWrappedStroke(surfaceLastPoint || paintPoint, paintPoint);
    surfaceLastPoint = paintPoint;
    updateTexturePreview(object);
    return true;
  }

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    rebuildHitTriangles();
    const point = canvasPoint(event);
    if (state.paintMode && event.button === 0) {
      const triangle = pickTriangle(point.x, point.y);
      if (!triangle) return;
      if (triangle.objectId !== state.selectedId) {
        state.selectedId = triangle.objectId;
        refreshUi({ forcePainter: true });
        scheduleRender();
        showToast('Object selected. Paint again once its texture is ready.');
        return;
      }
      if (!painterReady) {
        showToast('The texture is still loading.');
        return;
      }
      surfacePainting = true;
      surfaceLastPoint = null;
      canvas.setPointerCapture(event.pointerId);
      paintSurfaceAt(event);
      return;
    }

    cameraDragging = true;
    cameraDragMode = (event.button === 1 || event.button === 2 || event.ctrlKey) ? 'pan' : 'orbit';
    movedDistance = 0;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.toggle('dragging', cameraDragMode === 'orbit');
    canvas.classList.toggle('moving', cameraDragMode === 'pan');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (surfacePainting) {
      paintSurfaceAt(event);
      return;
    }
    if (!cameraDragging) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    movedDistance += Math.hypot(dx, dy);
    if (cameraDragMode === 'pan') {
      panCameraByPixels(dx, dy);
    } else {
      state.camera.yaw += dx * 0.008;
      state.camera.pitch = Core.clamp(state.camera.pitch + dy * 0.008, -1.45, 1.45);
    }
    lastPointer = { x: event.clientX, y: event.clientY };
    scheduleRender();
    scheduleSave();
  });

  canvas.addEventListener('pointerup', (event) => {
    if (surfacePainting) {
      surfacePainting = false;
      surfaceLastPoint = null;
      commitPainterTexture(selectedObject());
      return;
    }

    cameraDragging = false;
    canvas.classList.remove('dragging', 'moving');
    if (cameraDragMode === 'orbit' && movedDistance < 5 && !state.paintMode) {
      rebuildHitTriangles();
      const point = canvasPoint(event);
      const triangle = pickTriangle(point.x, point.y);
      state.selectedId = triangle?.objectId || null;
      refreshUi({ forcePainter: true });
      scheduleRender();
      scheduleSave();
    }
    cameraDragMode = 'orbit';
  });

  canvas.addEventListener('pointercancel', () => {
    if (surfacePainting) commitPainterTexture(selectedObject());
    surfacePainting = false;
    cameraDragging = false;
    cameraDragMode = 'orbit';
    surfaceLastPoint = null;
    canvas.classList.remove('dragging', 'moving');
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.camera.distance = Core.clamp(state.camera.distance + event.deltaY * 0.006, 1.8, 24);
    scheduleRender();
    scheduleSave();
  }, { passive: false });

  function reliefJsonToDataUrl(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('The relief file must contain a JSON object.');
    const rows = Number(raw.rows);
    const cols = Number(raw.cols);
    const vertices = raw.vertices;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) {
      throw new Error('The relief JSON needs valid rows and cols values.');
    }
    if (!Array.isArray(vertices) || vertices.length !== rows * cols) {
      throw new Error('The relief vertex count does not match rows x cols.');
    }

    const values = vertices.map((vertex, index) => {
      if (!Array.isArray(vertex) || vertex.length < 2 || !Number.isFinite(Number(vertex[1]))) {
        throw new Error(`Relief vertex ${index} does not contain a valid height.`);
      }
      return Number(vertex[1]);
    });
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const value of values) {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    const range = maximum - minimum;
    if (!Number.isFinite(range) || range <= Number.EPSILON) throw new Error('The relief is flat and contains no usable height range.');

    const source = document.createElement('canvas');
    source.width = cols;
    source.height = rows;
    const sourceContext = source.getContext('2d');
    const image = sourceContext.createImageData(cols, rows);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const value = (values[row * cols + col] - minimum) / range;
        const targetRow = rows - 1 - row;
        const offset = (targetRow * cols + col) * 4;
        const shade = Math.round(value * 255);
        image.data[offset] = shade;
        image.data[offset + 1] = shade;
        image.data[offset + 2] = shade;
        image.data[offset + 3] = 255;
      }
    }
    sourceContext.putImageData(image, 0, 0);

    const output = document.createElement('canvas');
    output.width = 256;
    output.height = 256;
    const outputContext = output.getContext('2d');
    outputContext.imageSmoothingEnabled = true;
    outputContext.drawImage(source, 0, 0, output.width, output.height);
    return output.toDataURL('image/png');
  }

  document.querySelectorAll('[data-add-primitive]').forEach((button) => {
    button.addEventListener('click', () => addObject(createPrimitive(button.dataset.addPrimitive)));
  });

  objectList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-object-id]');
    if (!button) return;
    state.selectedId = button.dataset.objectId;
    refreshUi({ forcePainter: true });
    scheduleRender();
  });

  document.getElementById('import-asset').addEventListener('click', () => document.getElementById('asset-file').click());
  document.getElementById('asset-file').addEventListener('change', (event) => {
    importAssetFiles([...event.target.files]);
    event.target.value = '';
  });

  document.getElementById('object-name').addEventListener('input', (event) => {
    const object = selectedObject();
    if (!object) return;
    object.name = event.target.value.slice(0, 80) || 'Object';
    refreshObjectList();
    scheduleSave();
  });
  document.getElementById('duplicate-object').addEventListener('click', duplicateSelected);
  document.getElementById('delete-object').addEventListener('click', deleteSelected);
  document.getElementById('edit-materials').addEventListener('click', () => {
    const object = selectedObject();
    if (!object) return;
    try {
      const asset = deepClone(object.asset);
      asset.name = object.name;
      asset.vertices = displacedLocalVertices(object).map((vertex) => vertex.slice());
      const material = deepClone(object.material);
      if (material.layers) delete material.layers;
      material.displacement = { ...DEFAULT_DISPLACEMENT };
      asset.metadata = { ...(asset.metadata || {}), material, worldEditObjectId: object.id, worldEditSource: 'world-builder' };
      Core.queueAsset(asset);
      window.location.href = 'materials.html';
    } catch (error) {
      showToast(error.message || 'The object could not be transferred.');
    }
  });

  document.getElementById('transform-controls').addEventListener('input', (event) => {
    const input = event.target.closest('[data-transform]');
    const object = selectedObject();
    if (!input || !object) return;
    setNested(object.transform, input.dataset.transform, Number(input.value));
    const output = document.querySelector(`[data-output="${input.dataset.transform}"]`);
    output.textContent = Number(input.value).toFixed(input.dataset.transform.startsWith('rotation') ? 0 : 2);
    scheduleRender();
    scheduleSave();
  });

  for (const id of ['texture-type', 'primary-color', 'secondary-color', 'texture-scale', 'roughness']) {
    document.getElementById(id).addEventListener('input', (event) => {
      const object = selectedObject();
      if (!object) return;
      const keyMap = {
        'texture-type': 'type', 'primary-color': 'primary', 'secondary-color': 'secondary',
        'texture-scale': 'scale', roughness: 'roughness'
      };
      const key = keyMap[id];
      object.material[key] = id === 'texture-scale' || id === 'roughness' ? Number(event.target.value) : event.target.value;
      if (id === 'texture-scale') document.getElementById('texture-scale-value').textContent = event.target.value;
      if (id === 'roughness') document.getElementById('roughness-value').textContent = Number(event.target.value).toFixed(2);
      if (id === 'primary-color' && !object.material.textureData && painterObjectId === object.id) {
        fillPainter(object.material.primary);
        updateLiveTexture(object);
      }
      refreshObjectList();
      scheduleRender();
      scheduleSave();
    });
  }

  [
    ['pattern-scale', 'pattern-scale-value', 0],
    ['pattern-detail', 'pattern-detail-value', 2],
    ['pattern-contrast', 'pattern-contrast-value', 2]
  ].forEach(([id, outputId, decimals]) => {
    document.getElementById(id).addEventListener('input', (event) => {
      document.getElementById(outputId).textContent = Number(event.target.value).toFixed(decimals);
    });
  });

  document.getElementById('upload-texture').addEventListener('click', () => document.getElementById('texture-file').click());
  document.getElementById('texture-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    const object = selectedObject();
    if (!file || !object) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Choose an image smaller than 5 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      object.material.type = 'image';
      object.material.scale = 1;
      object.material.textureData = String(reader.result);
      document.getElementById('texture-type').value = 'image';
      document.getElementById('texture-scale').value = '1';
      document.getElementById('texture-scale-value').textContent = '1';
      syncPainterFromObject(object, true);
      scheduleRender();
      scheduleSave();
      showToast('Image texture applied.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  });

  document.getElementById('clear-texture').addEventListener('click', () => {
    const object = selectedObject();
    if (!object || !beginTextureEdit(object)) return;
    fillPainter(object.material.primary);
    updateTexturePreview(object);
    commitPainterTexture(object, 'Texture cleared to the primary color.');
  });

  document.getElementById('random-texture').addEventListener('click', () => {
    const object = selectedObject();
    if (!object || !beginTextureEdit(object)) return;
    const options = Procedural.generate(painter, proceduralTextureOptions());
    updateTexturePreview(object);
    commitPainterTexture(object, `${Procedural.label(options.kind)} texture applied.`);
  });

  document.getElementById('apply-texture').addEventListener('click', () => {
    const object = selectedObject();
    if (!object) return;
    commitPainterTexture(object, 'Painted texture applied.');
  });

  document.getElementById('surface-paint-toggle').addEventListener('click', () => setPaintMode(!state.paintMode));

  document.getElementById('relief-enabled').addEventListener('change', (event) => {
    const object = selectedObject();
    if (!object) return;
    if (event.target.checked && !object.material.displacement.data) {
      event.target.checked = false;
      showToast('Assign a painted or imported relief map first.');
      return;
    }
    object.material.displacement.enabled = event.target.checked;
    scheduleRender();
    scheduleSave();
  });

  document.getElementById('relief-strength').addEventListener('input', (event) => {
    const object = selectedObject();
    if (!object) return;
    object.material.displacement.strength = Number(event.target.value);
    document.getElementById('relief-strength-value').textContent = Number(event.target.value).toFixed(2);
    scheduleRender();
    scheduleSave();
  });

  document.getElementById('relief-midpoint').addEventListener('input', (event) => {
    const object = selectedObject();
    if (!object) return;
    object.material.displacement.midpoint = Number(event.target.value);
    document.getElementById('relief-midpoint-value').textContent = Number(event.target.value).toFixed(2);
    scheduleRender();
    scheduleSave();
  });

  document.getElementById('paint-to-relief').addEventListener('click', () => {
    const object = selectedObject();
    if (!object || painterObjectId !== object.id || !painterReady) return;
    commitPainterTexture(object);
    object.material.displacement = {
      ...object.material.displacement,
      enabled: true,
      source: 'custom',
      data: painter.toDataURL('image/png'),
      label: 'Painted relief',
      midpoint: 0.5
    };
    refreshInspector();
    scheduleRender();
    scheduleSave();
    showToast('The painted texture is now also driving surface relief.');
  });

  document.getElementById('import-relief').addEventListener('click', () => document.getElementById('relief-file').click());
  document.getElementById('relief-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const object = selectedObject();
    if (!file || !object) return;
    try {
      const dataUrl = reliefJsonToDataUrl(JSON.parse(await file.text()));
      object.material.displacement = {
        ...object.material.displacement,
        enabled: true,
        source: 'custom',
        data: dataUrl,
        label: file.name.replace(/\.json$/i, '') || 'Imported relief',
        midpoint: 0
      };
      loadTexture(dataUrl);
      refreshInspector();
      scheduleRender();
      scheduleSave();
      showToast('Relief wrapped onto the selected object.');
    } catch (error) {
      showToast(error.message);
    }
    event.target.value = '';
  });

  document.getElementById('clear-relief').addEventListener('click', () => {
    const object = selectedObject();
    if (!object) return;
    object.material.displacement = { ...DEFAULT_DISPLACEMENT };
    refreshInspector();
    scheduleRender();
    scheduleSave();
    showToast('Surface relief removed.');
  });

  document.getElementById('animate-world').addEventListener('click', () => {
    Core.saveWorldDraft(serialiseWorld());
    try { localStorage.setItem(Core.STORAGE_KEYS.sceneImportWorld, '1'); } catch { /* Optional hand-off marker. */ }
    window.location.href = 'scene.html';
  });

  document.getElementById('save-world').addEventListener('click', () => {
    if (painterDrawing || surfacePainting) commitPainterTexture(selectedObject());
    Core.downloadJson('world.json', serialiseWorld());
    showToast('World exported.');
  });
  document.getElementById('load-world').addEventListener('click', () => document.getElementById('world-file').click());
  document.getElementById('world-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      loadWorldDocument(JSON.parse(await file.text()));
      showToast('World imported.');
    } catch (error) {
      showToast(error.message);
    }
    event.target.value = '';
  });
  document.getElementById('new-world').addEventListener('click', () => {
    state.objects = [];
    state.selectedId = null;
    state.camera = { ...DEFAULT_CAMERA };
    state.renderSettings = { ...DEFAULT_RENDER_SETTINGS };
    displacementGeometryCache.clear();
    imageCache.clear();
    liveTextureCache.clear();
    displacementGeometryCache.clear();
    setPaintMode(false);
    refreshUi({ forcePainter: true });
    scheduleRender();
    scheduleSave();
    showToast('Started a new world.');
  });
  document.getElementById('reset-camera').addEventListener('click', () => {
    state.camera = { ...DEFAULT_CAMERA };
    scheduleRender();
    scheduleSave();
  });
  document.getElementById('toggle-free-camera').addEventListener('click', () => {
    state.freeCamera = !state.freeCamera;
    refreshUi();
  });
  document.getElementById('toggle-placement-mesh').addEventListener('click', () => {
    state.renderSettings.grid = state.renderSettings.grid === false;
    refreshUi();
    scheduleRender();
    scheduleSave();
  });
  document.getElementById('toggle-wireframe').addEventListener('click', () => {
    state.wireframe = !state.wireframe;
    refreshUi();
    scheduleRender();
    scheduleSave();
  });

  function refreshRenderControls() {
    const settings = state.renderSettings;
    const values = {
      'render-background': settings.background,
      'render-exposure': settings.exposure,
      'render-ambient': settings.ambient,
      'render-light-intensity': settings.lightIntensity,
      'render-light-azimuth': settings.lightAzimuth,
      'render-light-elevation': settings.lightElevation,
      'render-rim': settings.rim
    };
    for (const [id, value] of Object.entries(values)) {
      const input = document.getElementById(id);
      if (input) input.value = String(value);
      const output = document.getElementById(`${id}-value`);
      if (output) output.textContent = typeof value === 'number' ? Number(value).toFixed(id.includes('azimuth') || id.includes('elevation') ? 0 : 2) : value;
    }
    const grid = document.getElementById('render-grid');
    if (grid) grid.checked = settings.grid !== false;
    const placementButton = document.getElementById('toggle-placement-mesh');
    if (placementButton) {
      const enabled = settings.grid !== false;
      placementButton.textContent = `Placement mesh: ${enabled ? 'on' : 'off'}`;
      placementButton.classList.toggle('active', enabled);
    }
    const badge = document.getElementById('render-backend');
    if (badge && !webglRenderer?.available) badge.textContent = 'Canvas fallback';
  }

  function bindRenderControls() {
    const numberControls = {
      'render-exposure': 'exposure', 'render-ambient': 'ambient', 'render-light-intensity': 'lightIntensity',
      'render-light-azimuth': 'lightAzimuth', 'render-light-elevation': 'lightElevation', 'render-rim': 'rim'
    };
    for (const [id, key] of Object.entries(numberControls)) {
      document.getElementById(id)?.addEventListener('input', (event) => {
        state.renderSettings[key] = Number(event.target.value);
        const output = document.getElementById(`${id}-value`);
        if (output) output.textContent = Number(event.target.value).toFixed(id.includes('azimuth') || id.includes('elevation') ? 0 : 2);
        scheduleRender(); scheduleSave();
      });
    }
    document.getElementById('render-background')?.addEventListener('input', (event) => {
      state.renderSettings.background = event.target.value; scheduleRender(); scheduleSave();
    });
    document.getElementById('render-grid')?.addEventListener('change', (event) => {
      state.renderSettings.grid = event.target.checked; refreshRenderControls(); scheduleRender(); scheduleSave();
    });
    document.getElementById('reset-render')?.addEventListener('click', () => {
      state.renderSettings = { ...DEFAULT_RENDER_SETTINGS }; refreshRenderControls(); scheduleRender(); scheduleSave();
    });
  }

  function importQueuedAssets() {
    const pending = Core.consumePendingAssets();
    let added = 0, updated = 0;
    for (const rawAsset of pending) {
      try {
        const asset = upgradePrimitiveAsset(Core.standardiseAsset(rawAsset));
        const editId = asset.metadata?.worldEditObjectId;
        const target = editId ? state.objects.find((object) => object.id === editId) : null;
        if (target) {
          const metadata = { ...(asset.metadata || {}) };
          delete metadata.worldEditObjectId; delete metadata.worldEditSource;
          asset.metadata = metadata;
          target.asset = asset;
          target.name = asset.name || target.name;
          if (asset.metadata?.material) target.material = createMaterial(asset.metadata.material);
          state.selectedId = target.id;
          liveTextureCache.delete(target.id);
          displacementGeometryCache.delete(target.id);
          imageCache.clear();
          updated += 1;
          refreshUi({ forcePainter: true }); scheduleRender(); scheduleSave();
        } else {
          addObject(asset); added += 1;
        }
      } catch (error) { console.warn('Ignored invalid queued asset.', error); }
    }
    if (updated || added) {
      const parts = [];
      if (updated) parts.push(`updated ${updated}`);
      if (added) parts.push(`added ${added}`);
      showToast(`Studio transfer: ${parts.join(', ')} object${updated + added === 1 ? '' : 's'}.`);
    }
  }

  function initialise() {
    buildTransformControls();
    bindRangeNumberControls();
    bindRenderControls();
    fillPainter('#142218');
    const draft = Core.loadWorldDraft();
    if (draft?.objects?.length) {
      try {
        loadWorldDocument(draft);
      } catch (error) {
        console.warn('Ignored invalid saved draft.', error);
      }
    }
    importQueuedAssets();
    if (!state.objects.length) {
      const placementMesh = createPrimitive('plane');
      placementMesh.metadata = { ...(placementMesh.metadata || {}), placementMesh: true };
      addObject(placementMesh, {
        name: 'Ground tile',
        material: { type: 'checker', primary: '#315e3d', secondary: '#17261b', scale: 10, roughness: 0.8 }
      });
      addObject(createPrimitive('sphere'), { name: 'Starter sphere', position: { x: 0, y: 1.05, z: 0 } });
    }
    refreshUi({ forcePainter: true });
    refreshRenderControls();
    resizeCanvas();
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', (event) => {
    if (!state.freeCamera || event.target.matches('input, select, textarea')) return;
    const key = event.key.toLowerCase();
    const amount = state.camera.distance * (event.shiftKey ? 0.18 : 0.06);
    let handled = true;
    if (key === 'w') moveCameraTarget(state.camera, 0, 0, amount);
    else if (key === 's') moveCameraTarget(state.camera, 0, 0, -amount);
    else if (key === 'a') moveCameraTarget(state.camera, -amount, 0, 0);
    else if (key === 'd') moveCameraTarget(state.camera, amount, 0, 0);
    else if (key === 'r') moveCameraTarget(state.camera, 0, amount, 0);
    else if (key === 'f') moveCameraTarget(state.camera, 0, -amount, 0);
    else handled = false;
    if (!handled) return;
    event.preventDefault();
    scheduleRender();
    scheduleSave();
  });
  window.addEventListener('storage', (event) => { if (event.key === Core.STORAGE_KEYS.pendingAssets) importQueuedAssets(); });
  initialise();
})();
