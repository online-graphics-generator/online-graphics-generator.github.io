(function (global) {
  'use strict';

  const STORAGE_KEYS = Object.freeze({
    pendingAssets: 'studio3d.pendingAssets.v1',
    worldDraft: 'studio3d.worldDraft.v1',
    sceneDraft: 'studio3d.sceneDraft.v1',
    sceneImportWorld: 'studio3d.sceneImportWorld.v1'
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  function createId(prefix = 'item') {
    const random = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${random}`;
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function gridFaces(rows, cols) {
    const faces = [];
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) return faces;
    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < cols - 1; col += 1) {
        const a = row * cols + col;
        const b = a + 1;
        const c = (row + 1) * cols + col + 1;
        const d = (row + 1) * cols + col;
        faces.push([a, b, c], [a, c, d]);
      }
    }
    return faces;
  }

  function gridUvs(rows, cols) {
    const uvs = [];
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2) return uvs;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        uvs.push([col / (cols - 1), row / (rows - 1)]);
      }
    }
    return uvs;
  }

  function facesToEdges(faces) {
    const unique = new Set();
    const edges = [];
    for (const face of faces) {
      if (!Array.isArray(face) || face.length < 3) continue;
      for (let index = 0; index < face.length; index += 1) {
        const start = face[index];
        const end = face[(index + 1) % face.length];
        const key = start < end ? `${start}:${end}` : `${end}:${start}`;
        if (unique.has(key)) continue;
        unique.add(key);
        edges.push([start, end]);
      }
    }
    return edges;
  }

  function inferGrid(vertexCount) {
    const side = Math.round(Math.sqrt(vertexCount));
    return side * side === vertexCount ? { rows: side, cols: side } : { rows: null, cols: null };
  }

  function sanitiseVertices(vertices) {
    if (!Array.isArray(vertices)) throw new Error('Geometry must contain a vertices array.');
    const cleaned = vertices.map((vertex, index) => {
      if (!Array.isArray(vertex) || vertex.length < 3) {
        throw new Error(`Vertex ${index} is not a valid [x, y, z] tuple.`);
      }
      const result = vertex.slice(0, 3).map((value) => Number(value));
      if (!result.every(Number.isFinite)) throw new Error(`Vertex ${index} contains a non-finite value.`);
      return result;
    });
    if (cleaned.length < 3) throw new Error('Geometry needs at least three vertices.');
    return cleaned;
  }

  function sanitiseFaces(faces, vertexCount) {
    if (!Array.isArray(faces)) return [];
    const cleaned = [];
    for (const face of faces) {
      if (!Array.isArray(face) || face.length < 3) continue;
      const indices = face.slice(0, 3).map(Number);
      if (!indices.every(Number.isInteger)) continue;
      if (!indices.every((index) => index >= 0 && index < vertexCount)) continue;
      if (new Set(indices).size !== 3) continue;
      cleaned.push(indices);
    }
    return cleaned;
  }

  function normaliseGeometry(vertices, targetRadius = 1) {
    const center = [0, 0, 0];
    for (const [x, y, z] of vertices) {
      center[0] += x;
      center[1] += y;
      center[2] += z;
    }
    center[0] /= vertices.length;
    center[1] /= vertices.length;
    center[2] /= vertices.length;

    let radius = 0;
    for (const [x, y, z] of vertices) {
      radius = Math.max(radius, Math.hypot(x - center[0], y - center[1], z - center[2]));
    }
    if (!Number.isFinite(radius) || radius <= Number.EPSILON) return vertices.map(() => [0, 0, 0]);
    const scale = targetRadius / radius;
    return vertices.map(([x, y, z]) => [
      (x - center[0]) * scale,
      (y - center[1]) * scale,
      (z - center[2]) * scale
    ]);
  }

  function standardiseAsset(raw, options = {}) {
    const source = Array.isArray(raw) ? { vertices: raw } : raw;
    if (!source || typeof source !== 'object') throw new Error('Asset JSON must be an object or vertex array.');

    let vertices = sanitiseVertices(source.vertices);
    if (options.normalise) vertices = normaliseGeometry(vertices, options.targetRadius || 1);

    const inferred = inferGrid(vertices.length);
    const rows = Number.isInteger(source.rows) ? source.rows : inferred.rows;
    const cols = Number.isInteger(source.cols) ? source.cols : inferred.cols;
    let faces = sanitiseFaces(source.faces, vertices.length);
    if (!faces.length && rows && cols && rows * cols === vertices.length) faces = gridFaces(rows, cols);
    if (!faces.length) throw new Error('The asset has no triangle faces and its vertices do not form a rectangular grid.');

    const uvs = Array.isArray(source.uvs) && source.uvs.length === vertices.length
      ? source.uvs.map((uv) => [clamp(toFiniteNumber(uv?.[0]), 0, 1), clamp(toFiniteNumber(uv?.[1]), 0, 1)])
      : (rows && cols && rows * cols === vertices.length ? gridUvs(rows, cols) : vertices.map(([x, , z]) => [(x + 1) / 2, (z + 1) / 2]));

    return {
      schema: 'studio3d-asset-v1',
      id: source.id || createId('asset'),
      name: String(source.name || source.type || options.name || 'Imported shape').slice(0, 80),
      type: String(source.type || 'mesh'),
      rows: rows || null,
      cols: cols || null,
      vertices,
      faces,
      uvs,
      metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {}
    };
  }

  function getStorage() {
    try { return global.localStorage; }
    catch { return null; }
  }

  const WINDOW_PENDING_PREFIX = 'studio3d.pendingAssets.windowName:';

  function writePendingToWindowName(assets) {
    global.name = WINDOW_PENDING_PREFIX + JSON.stringify(assets.slice(-20));
  }

  function readPendingFromWindowName() {
    try {
      const name = String(global.name || '');
      if (!name.startsWith(WINDOW_PENDING_PREFIX)) return [];
      const parsed = JSON.parse(name.slice(WINDOW_PENDING_PREFIX.length));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function clearPendingWindowName() {
    try {
      if (String(global.name || '').startsWith(WINDOW_PENDING_PREFIX)) global.name = '';
    } catch { /* Window name is optional. */ }
  }

  function queueAsset(rawAsset) {
    const asset = standardiseAsset(rawAsset);
    const current = readPendingAssets();
    current.push(asset);
    const payload = current.slice(-20);
    const storage = getStorage();
    if (!storage) {
      writePendingToWindowName(payload);
      return asset;
    }
    try {
      storage.setItem(STORAGE_KEYS.pendingAssets, JSON.stringify(payload));
      clearPendingWindowName();
    } catch (error) {
      try { storage.removeItem(STORAGE_KEYS.pendingAssets); } catch { /* Best effort cleanup. */ }
      writePendingToWindowName(payload);
    }
    return asset;
  }

  function readPendingAssets() {
    const windowAssets = readPendingFromWindowName();
    try {
      const storage = getStorage();
      if (!storage) return windowAssets;
      const parsed = JSON.parse(storage.getItem(STORAGE_KEYS.pendingAssets) || '[]');
      const storageAssets = Array.isArray(parsed) ? parsed : [];
      return storageAssets.concat(windowAssets).slice(-20);
    } catch {
      return windowAssets;
    }
  }

  function consumePendingAssets() {
    const assets = readPendingAssets();
    try { getStorage()?.removeItem(STORAGE_KEYS.pendingAssets); }
    catch { /* Storage is optional. */ }
    clearPendingWindowName();
    return assets;
  }

  function saveWorldDraft(world) {
    try {
      const storage = getStorage();
      if (!storage) return false;
      storage.setItem(STORAGE_KEYS.worldDraft, JSON.stringify(world));
      return true;
    } catch (error) {
      console.warn('Could not save world draft.', error);
      return false;
    }
  }

  function loadWorldDraft() {
    try {
      const storage = getStorage();
      if (!storage) return null;
      const parsed = JSON.parse(storage.getItem(STORAGE_KEYS.worldDraft) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  global.StudioCore = Object.freeze({
    STORAGE_KEYS,
    clamp,
    createId,
    downloadJson,
    gridFaces,
    gridUvs,
    facesToEdges,
    normaliseGeometry,
    standardiseAsset,
    queueAsset,
    readPendingAssets,
    consumePendingAssets,
    saveWorldDraft,
    loadWorldDraft
  });
})(window);


