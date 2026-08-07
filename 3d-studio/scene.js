(function () {
  'use strict';

  const Core = window.StudioCore;
  if (!Core) throw new Error('studio-core.js must be loaded before scene.js');

  const canvas = document.getElementById('scene-view');
  const WebGL = window.StudioWebGL;
  const webglRenderer = WebGL?.createRenderer(canvas, { onInvalidate: () => scheduleRender() });
  const context = webglRenderer?.available ? null : canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  const stage = document.getElementById('stage');
  const objectList = document.getElementById('object-list');
  const objectCount = document.getElementById('object-count');
  const noSelection = document.getElementById('no-selection');
  const objectInspector = document.getElementById('object-inspector');
  const transformControls = document.getElementById('transform-controls');
  const timeline = document.getElementById('timeline');
  const markers = document.getElementById('markers');
  const timeReadout = document.getElementById('time-readout');
  const toast = document.getElementById('toast');
  const progressBar = document.getElementById('export-progress');
  const exportStatus = document.getElementById('export-status');

  const DEFAULT_CAMERA = Object.freeze({ pitch: 0.48, yaw: 0.65, distance: 6.3, targetX: 0, targetY: 0, targetZ: 0 });
  const DEFAULT_RENDER_SETTINGS = Object.freeze({
    background: '#080b09', grid: true, exposure: 1.08, ambient: 0.34,
    lightIntensity: 1.15, lightAzimuth: -42, lightElevation: 55, rim: 0.18
  });
  const DEFAULT_MATERIAL = Object.freeze({
    type: 'checker', primary: '#50d08a', secondary: '#173b24', scale: 6,
    roughness: 0.55, textureData: null, displacement: null
  });
  const DEFAULT_MOTION = Object.freeze({ type: 'none', axis: 'y', speed: 1, amount: 0.5, phase: 0 });
  const MOTION_LABELS = Object.freeze({
    none: 'None',
    linear: 'Straight line',
    spin: 'Spin',
    tumble: 'Tumble',
    orbit: 'Orbit',
    bob: 'Bob',
    pulse: 'Pulse',
    swing: 'Swing'
  });
  const DEFAULT_CAMERA_MOTION = Object.freeze({ type: 'none', speed: 0.2, amount: 0.6 });
  const DEFAULT_WORLD_MOTION = Object.freeze({ type: 'none', axis: 'y', speed: 0.25, amount: 0.4 });
  const SCENE_STORAGE_KEY = Core.STORAGE_KEYS.sceneDraft || 'studio3d.sceneDraft.v1';

  const state = {
    objects: [],
    selectedId: null,
    camera: { ...DEFAULT_CAMERA },
    renderSettings: { ...DEFAULT_RENDER_SETTINGS },
    wireframe: false,
    freeCamera: false,
    duration: 30,
    fps: 24,
    easing: 'smooth',
    loop: true,
    currentTime: 0,
    playing: false,
    playStartedAt: 0,
    playStartedTime: 0,
    tracks: {},
    motions: {},
    selectedMotionIndex: 0,
    cameraTrack: [],
    cameraMotion: { ...DEFAULT_CAMERA_MOTION },
    worldMotion: { ...DEFAULT_WORLD_MOTION },
    hitTriangles: [],
    renderQueued: false,
    saveTimer: 0,
    exporting: false
  };

  const imageCache = new Map();
  const normalCache = new WeakMap();
  const displacementCache = new Map();
  let dpr = 1;
  let pointerMode = null;
  let lastPointer = null;
  let pointerStart = null;
  let pointerHitId = null;
  let pointerMoved = 0;
  let toastTimer = 0;

  function deepClone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  function safeFilename(value) {
    return String(value || 'scene').trim().toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'scene';
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

  function selectedObject() {
    return state.objects.find((object) => object.id === state.selectedId) || null;
  }

  function normaliseMotion(raw = {}) {
    const motion = { ...DEFAULT_MOTION, ...(raw && typeof raw === 'object' ? raw : {}) };
    motion.type = Object.prototype.hasOwnProperty.call(MOTION_LABELS, motion.type) ? motion.type : 'none';
    motion.axis = ['x', 'y', 'z', 'xyz'].includes(motion.axis) ? motion.axis : 'y';
    motion.speed = Number.isFinite(Number(motion.speed)) ? Number(motion.speed) : DEFAULT_MOTION.speed;
    motion.amount = Number.isFinite(Number(motion.amount)) ? Number(motion.amount) : DEFAULT_MOTION.amount;
    motion.phase = Number.isFinite(Number(motion.phase)) ? Number(motion.phase) : DEFAULT_MOTION.phase;
    return motion;
  }

  function normaliseMotionStack(value) {
    if (Array.isArray(value)) return value.map(normaliseMotion).filter((motion) => motion.type !== 'none');
    if (value && typeof value === 'object') {
      const motion = normaliseMotion(value);
      return motion.type === 'none' ? [] : [motion];
    }
    return [];
  }

  function normaliseAllMotions(source) {
    const result = {};
    if (!source || typeof source !== 'object') return result;
    for (const [objectId, value] of Object.entries(source)) {
      const stack = normaliseMotionStack(value);
      if (stack.length) result[objectId] = stack;
    }
    return result;
  }

  function motionStackFor(object, create = false) {
    if (!object) return [];
    const stack = normaliseMotionStack(state.motions[object.id]);
    if (stack.length || create) state.motions[object.id] = stack;
    else if (Object.prototype.hasOwnProperty.call(state.motions, object.id)) delete state.motions[object.id];
    return stack;
  }

  function selectedMotion(object = selectedObject(), create = false) {
    const stack = motionStackFor(object, create);
    if (!stack.length) return null;
    state.selectedMotionIndex = Core.clamp(state.selectedMotionIndex, 0, stack.length - 1);
    return stack[state.selectedMotionIndex];
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

  function createTransform(raw = {}) {
    return {
      position: { x: 0, y: 0, z: 0, ...(raw.position || {}) },
      rotation: { x: 0, y: 0, z: 0, ...(raw.rotation || {}) },
      scale: { x: 1, y: 1, z: 1, ...(raw.scale || {}) }
    };
  }

  function createMaterial(raw = {}) {
    return {
      ...DEFAULT_MATERIAL,
      ...raw,
      displacement: raw.displacement && typeof raw.displacement === 'object'
        ? { enabled: false, strength: 0.25, midpoint: 0.5, source: 'custom', data: null, ...raw.displacement }
        : null
    };
  }

  function normaliseWorldObject(item, index) {
    const asset = Core.standardiseAsset(item.asset || item.geometry || item, { name: item.name || `Object ${index + 1}` });
    return {
      id: typeof item.id === 'string' ? item.id : Core.createId('object'),
      name: String(item.name || asset.name || `Object ${index + 1}`).slice(0, 80),
      asset,
      transform: createTransform(item.transform),
      material: createMaterial(item.material || asset.metadata?.material || {})
    };
  }

  function loadWorld(world, options = {}) {
    if (!world || !Array.isArray(world.objects)) throw new Error('The file does not contain a valid Studio 3D world.');
    state.objects = world.objects.map(normaliseWorldObject);
    state.selectedId = state.objects[0]?.id || null;
    state.camera = { ...DEFAULT_CAMERA, ...(world.camera || {}) };
    state.renderSettings = { ...DEFAULT_RENDER_SETTINGS, ...(world.renderSettings || {}) };
    state.wireframe = world.wireframe === true;
    imageCache.clear();
    displacementCache.clear();
    if (!options.keepAnimation) resetAnimationState(false);
    refreshUi();
    scheduleRender();
    scheduleSave();
  }

  function resetAnimationState(refresh = true) {
    state.currentTime = 0;
    state.playing = false;
    state.tracks = {};
    state.motions = {};
    state.selectedMotionIndex = 0;
    state.cameraTrack = [];
    state.cameraMotion = { ...DEFAULT_CAMERA_MOTION };
    state.worldMotion = { ...DEFAULT_WORLD_MOTION };
    if (refresh) {
      refreshUi();
      scheduleRender();
      scheduleSave();
    }
  }

  function serialiseWorld() {
    return {
      schema: 'studio3d-world-v1',
      version: 2,
      camera: deepClone(state.camera),
      renderSettings: deepClone(state.renderSettings),
      wireframe: state.wireframe,
      objects: state.objects
    };
  }

  function serialiseProject() {
    return {
      schema: 'studio3d-animation-v1',
      version: 1,
      savedAt: new Date().toISOString(),
      world: serialiseWorld(),
      animation: {
        duration: state.duration,
        fps: state.fps,
        easing: state.easing,
        loop: state.loop,
        tracks: state.tracks,
        motions: state.motions,
        cameraTrack: state.cameraTrack,
        cameraMotion: state.cameraMotion,
        worldMotion: state.worldMotion
      }
    };
  }

  function loadProject(project) {
    if (project?.schema === 'studio3d-animation-v1' && project.world) {
      loadWorld(project.world, { keepAnimation: true });
      const animation = project.animation || {};
      state.duration = Core.clamp(Number(animation.duration) || 6, 1, 3600);
      state.fps = Core.clamp(Math.round(Number(animation.fps) || 24), 6, 60);
      state.easing = ['linear', 'smooth', 'easeInOut', 'hold'].includes(animation.easing) ? animation.easing : 'smooth';
      state.loop = animation.loop !== false;
      state.tracks = animation.tracks && typeof animation.tracks === 'object' ? animation.tracks : {};
      state.motions = normaliseAllMotions(animation.motions);
      state.selectedMotionIndex = 0;
      state.cameraTrack = Array.isArray(animation.cameraTrack) ? animation.cameraTrack : [];
      state.cameraMotion = { ...DEFAULT_CAMERA_MOTION, ...(animation.cameraMotion || {}) };
      state.worldMotion = { ...DEFAULT_WORLD_MOTION, ...(animation.worldMotion || {}) };
      state.currentTime = 0;
      refreshUi();
      scheduleRender();
      scheduleSave();
      return;
    }
    loadWorld(project);
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      try { localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(serialiseProject())); }
      catch (error) { console.warn('Could not save Scene Animator draft.', error); }
    }, 300);
  }

  function loadSavedProject() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCENE_STORAGE_KEY) || 'null');
      if (parsed?.schema === 'studio3d-animation-v1') return parsed;
    } catch { /* Optional draft. */ }
    return null;
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      renderMain();
    });
  }

  function easeValue(value) {
    const t = Core.clamp(value, 0, 1);
    if (state.easing === 'hold') return 0;
    if (state.easing === 'linear') return t;
    if (state.easing === 'easeInOut') return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function lerpAngle(a, b, t) {
    let delta = (b - a) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return a + delta * t;
  }

  function interpolateTransform(a, b, t) {
    const result = createTransform();
    for (const axis of ['x', 'y', 'z']) {
      result.position[axis] = lerp(a.position[axis], b.position[axis], t);
      result.rotation[axis] = lerpAngle(a.rotation[axis], b.rotation[axis], t);
      result.scale[axis] = lerp(a.scale[axis], b.scale[axis], t);
    }
    return result;
  }

  function interpolateCamera(a, b, t) {
    return {
      pitch: lerp(a.pitch, b.pitch, t),
      yaw: lerp(a.yaw, b.yaw, t),
      distance: lerp(a.distance, b.distance, t),
      targetX: lerp(a.targetX || 0, b.targetX || 0, t),
      targetY: lerp(a.targetY || 0, b.targetY || 0, t),
      targetZ: lerp(a.targetZ || 0, b.targetZ || 0, t)
    };
  }

  function evaluateTrack(track, time, fallback, interpolator) {
    if (!Array.isArray(track) || !track.length) return deepClone(fallback);
    const keys = [...track].sort((a, b) => a.time - b.time);
    if (time <= keys[0].time) return deepClone(keys[0].value);
    if (time >= keys[keys.length - 1].time) return deepClone(keys[keys.length - 1].value);
    for (let index = 0; index < keys.length - 1; index += 1) {
      const start = keys[index], end = keys[index + 1];
      if (time < start.time || time > end.time) continue;
      const span = Math.max(0.000001, end.time - start.time);
      return interpolator(start.value, end.value, easeValue((time - start.time) / span));
    }
    return deepClone(fallback);
  }

  function baseTransformAt(object, time) {
    return evaluateTrack(state.tracks[object.id], time, object.transform, interpolateTransform);
  }

  function cameraAt(time, procedural = true) {
    let camera = evaluateTrack(state.cameraTrack, time, state.camera, interpolateCamera);
    camera = { ...DEFAULT_CAMERA, ...camera };
    if (!procedural) return camera;
    const motion = state.cameraMotion;
    const cycle = time * Number(motion.speed || 0) * Math.PI * 2;
    const amount = Number(motion.amount || 0);
    if (motion.type === 'orbit') camera.yaw += cycle;
    else if (motion.type === 'orbit3d') { camera.yaw += cycle; camera.pitch += Math.sin(cycle * 0.63) * amount * 0.22; camera.targetY += Math.sin(cycle * 0.37) * amount * 0.35; }
    else if (motion.type === 'dolly') camera.distance = Math.max(1.2, camera.distance + Math.sin(cycle) * amount);
    else if (motion.type === 'float') {
      camera.targetY += Math.sin(cycle) * amount;
      camera.pitch += Math.cos(cycle * 0.7) * amount * 0.08;
    }
    return camera;
  }

  function applyObjectMotion(transform, object, time, index) {
    const result = deepClone(transform);
    const applyMotion = (motion) => {
      const phase = Number(motion.phase || 0) * Math.PI / 180;
      const speed = Number(motion.speed || 0);
      const amount = Number(motion.amount || 0);
      const cycle = time * speed * Math.PI * 2 + phase;
      const axis = ['x', 'y', 'z', 'xyz'].includes(motion.axis) ? motion.axis : 'y';

      if (motion.type === 'linear') {
        const offset = time * speed * amount;
        if (axis === 'xyz') { result.position.x += offset; result.position.y += offset; result.position.z += offset; }
        else result.position[axis] += offset;
      } else if (motion.type === 'spin') {
        if (axis === 'xyz') { result.rotation.x += time * speed * 360; result.rotation.y += time * speed * 270; result.rotation.z += time * speed * 180; }
        else result.rotation[axis] += time * speed * 360;
      }
      else if (motion.type === 'tumble') {
        result.rotation.x += time * speed * 260;
        result.rotation.y += time * speed * 360;
        result.rotation.z += time * speed * 170;
      } else if (motion.type === 'orbit') {
        if (axis === 'x') { result.position.y += Math.cos(cycle) * amount; result.position.z += Math.sin(cycle) * amount; }
        else if (axis === 'z') { result.position.x += Math.cos(cycle) * amount; result.position.y += Math.sin(cycle) * amount; }
        else if (axis === 'xyz') { result.position.x += Math.cos(cycle) * amount; result.position.z += Math.sin(cycle) * amount; result.position.y += Math.sin(cycle * 2 + phase) * amount * 0.55; }
        else { result.position.x += Math.cos(cycle) * amount; result.position.z += Math.sin(cycle) * amount; }
      } else if (motion.type === 'bob') {
        if (axis === 'xyz') { result.position.x += Math.sin(cycle) * amount * 0.5; result.position.y += Math.sin(cycle * 1.27) * amount; result.position.z += Math.cos(cycle * 0.83) * amount * 0.5; }
        else result.position[axis] += Math.sin(cycle) * amount;
      }
      else if (motion.type === 'pulse') {
        const factor = Math.max(0.05, 1 + Math.sin(cycle) * amount * 0.25);
        result.scale.x *= factor; result.scale.y *= factor; result.scale.z *= factor;
      } else if (motion.type === 'swing') {
        if (axis === 'xyz') { result.rotation.x += Math.sin(cycle) * amount * 45; result.rotation.y += Math.sin(cycle * 0.71) * amount * 38; result.rotation.z += Math.cos(cycle * 1.13) * amount * 30; }
        else result.rotation[axis] += Math.sin(cycle) * amount * 45;
      }
    };

    motionStackFor(object).forEach(applyMotion);

    const global = state.worldMotion;
    const globalCycle = time * Number(global.speed || 0) * Math.PI * 2;
    const globalAmount = Number(global.amount || 0);
    if (global.type === 'turntable') {
      const angle = globalCycle, c = Math.cos(angle), sn = Math.sin(angle);
      const globalAxis = ['x','y','z','xyz'].includes(global.axis) ? global.axis : 'y';
      const rotateAxis = (axisName, factor = 1) => {
        const a = angle * factor, ca = Math.cos(a), sa = Math.sin(a);
        const x = result.position.x, y = result.position.y, z = result.position.z;
        if (axisName === 'x') { result.position.y = y * ca - z * sa; result.position.z = y * sa + z * ca; result.rotation.x += a * 180 / Math.PI; }
        if (axisName === 'y') { result.position.x = x * ca + z * sa; result.position.z = -x * sa + z * ca; result.rotation.y += a * 180 / Math.PI; }
        if (axisName === 'z') { result.position.x = x * ca - y * sa; result.position.y = x * sa + y * ca; result.rotation.z += a * 180 / Math.PI; }
      };
      if (globalAxis === 'xyz') { rotateAxis('x', .43); rotateAxis('y', 1); rotateAxis('z', .27); }
      else rotateAxis(globalAxis);
    } else if (global.type === 'breathe') {
      const factor = Math.max(0.1, 1 + Math.sin(globalCycle) * globalAmount * 0.16);
      result.scale.x *= factor; result.scale.y *= factor; result.scale.z *= factor;
    } else if (global.type === 'wave') {
      result.position.y += Math.sin(globalCycle + index * 0.7) * globalAmount;
    } else if (global.type === 'explode') {
      const factor = 1 + (0.5 + 0.5 * Math.sin(globalCycle)) * globalAmount;
      result.position.x *= factor; result.position.y *= factor; result.position.z *= factor;
    }
    return result;
  }

  function transformAt(object, time, index) {
    return applyObjectMotion(baseTransformAt(object, time), object, time, index);
  }

  function upsertKey(track, time, value) {
    const tolerance = Math.max(0.002, 0.45 / state.fps);
    const existing = track.find((key) => Math.abs(key.time - time) <= tolerance);
    if (existing) {
      existing.time = time;
      existing.value = deepClone(value);
    } else {
      track.push({ time, value: deepClone(value) });
    }
    track.sort((a, b) => a.time - b.time);
  }

  function deleteNearestKey(track, time) {
    if (!track?.length) return false;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    track.forEach((key, index) => {
      const distance = Math.abs(key.time - time);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    if (nearestDistance > Math.max(0.08, 1.5 / state.fps)) return false;
    track.splice(nearestIndex, 1);
    return true;
  }

  function setObjectBaseTransform(object, transform) {
    if (document.getElementById('auto-key').checked) {
      const track = state.tracks[object.id] || (state.tracks[object.id] = []);
      upsertKey(track, state.currentTime, transform);
    } else {
      object.transform = deepClone(transform);
    }
    refreshKeyInfo();
    scheduleRender();
    scheduleSave();
  }

  function setCameraBase(camera) {
    if (document.getElementById('auto-key').checked && state.cameraTrack.length) {
      upsertKey(state.cameraTrack, state.currentTime, camera);
    } else {
      state.camera = { ...camera };
    }
    refreshKeyInfo();
    scheduleRender();
    scheduleSave();
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
    let point = { x: vertex[0] * transform.scale.x, y: vertex[1] * transform.scale.y, z: vertex[2] * transform.scale.z };
    point = rotateX(point, transform.rotation.x * Math.PI / 180);
    point = rotateY(point, transform.rotation.y * Math.PI / 180);
    point = rotateZ(point, transform.rotation.z * Math.PI / 180);
    point.x += transform.position.x; point.y += transform.position.y; point.z += transform.position.z;
    return point;
  }

  function worldToCamera(point, camera) {
    let result = {
      x: point.x - (camera.targetX || 0),
      y: point.y - (camera.targetY || 0),
      z: point.z - (camera.targetZ || 0)
    };
    result = rotateX(result, camera.pitch);
    result = rotateY(result, camera.yaw);
    return result;
  }

  function project(point, width, height, camera) {
    const depth = point.z + camera.distance;
    if (depth <= 0.05) return null;
    const focal = Math.min(width, height) * 0.82;
    return { x: width / 2 + point.x * focal / depth, y: height / 2 - point.y * focal / depth, depth };
  }

  function cameraBasis(camera) {
    const yaw = Number(camera?.yaw) || 0;
    return {
      right: { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) },
      forward: { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) }
    };
  }

  function moveCameraTarget(camera, rightAmount = 0, upAmount = 0, forwardAmount = 0) {
    const basis = cameraBasis(camera);
    camera.targetX = (camera.targetX || 0) + basis.right.x * rightAmount + basis.forward.x * forwardAmount;
    camera.targetY = (camera.targetY || 0) + upAmount;
    camera.targetZ = (camera.targetZ || 0) + basis.right.z * rightAmount + basis.forward.z * forwardAmount;
  }

  function panCameraByPixels(camera, dx, dy) {
    const scale = Math.max(0.002, camera.distance * 0.0016);
    moveCameraTarget(camera, -dx * scale, dy * scale, 0);
  }

  function cross(a, b, c) {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    return { x: ab.y * ac.z - ab.z * ac.y, y: ab.z * ac.x - ab.x * ac.z, z: ab.x * ac.y - ab.y * ac.x };
  }

  function normaliseVector(vector, fallback = { x: 0, y: 1, z: 0 }) {
    const length = Math.hypot(vector.x, vector.y, vector.z);
    if (!Number.isFinite(length) || length <= Number.EPSILON) return { ...fallback };
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
  }

  function parseColor(value) {
    if (value && typeof value === 'object' && Number.isFinite(value.r)) return value;
    const text = String(value || '').trim();
    const rgb = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
    const clean = text.replace('#', '');
    const expanded = clean.length === 3 ? clean.split('').map((part) => part + part).join('') : clean.padEnd(6, '0').slice(0, 6);
    const number = Number.parseInt(expanded, 16);
    if (!Number.isFinite(number)) return { r: 0, g: 0, b: 0 };
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  // function shadedColor(value, intensity) {
  //   const color = parseColor(value);
  //   const amount = Core.clamp(intensity, 0, 1.3);
  //   return `rgb(${Math.round(color.r * amount)},${Math.round(color.g * amount)},${Math.round(color.b * amount)})`;
  // }
  function shadedColor(
    value,
    intensity,
    exposure = 1,
    gamma = 1
  ) {
    const color = parseColor(value);
    const lightAmount = Core.clamp(intensity, 0, 1.5);
    const safeGamma = Math.max(0.01, Number(gamma) || 1);
    const safeExposure = Math.max(0, Number(exposure) || 1);

    const convertChannel = (channel) => {
      const exposed = Core.clamp(
        (channel / 255) * lightAmount * safeExposure,
        0,
        1
      );

      const corrected = Math.pow(exposed, 1 / safeGamma);

      return Math.round(corrected * 255);
    };

    return `rgb(
      ${convertChannel(color.r)},
      ${convertChannel(color.g)},
      ${convertChannel(color.b)}
    )`;
  }

  function loadTexture(dataUrl) {
    if (!dataUrl) return Promise.resolve(null);
    const cached = imageCache.get(dataUrl);
    if (cached?.status === 'ready') return Promise.resolve(cached);
    if (cached?.promise) return cached.promise;
    const entry = { status: 'loading', promise: null };
    entry.promise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        try {
          const maximum = 512;
          const scale = Math.min(1, maximum / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
          const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
          const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
          const offscreen = document.createElement('canvas');
          offscreen.width = width; offscreen.height = height;
          const ctx = offscreen.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(image, 0, 0, width, height);
          const pixels = ctx.getImageData(0, 0, width, height).data;
          Object.assign(entry, { status: 'ready', width, height, pixels: new Uint8ClampedArray(pixels) });
          scheduleRender();
          resolve(entry);
        } catch (error) {
          entry.status = 'error';
          console.warn('Could not decode texture.', error);
          resolve(null);
        }
      };
      image.onerror = () => { entry.status = 'error'; resolve(null); };
      image.src = dataUrl;
    });
    imageCache.set(dataUrl, entry);
    return entry.promise;
  }

  function sampleTextureData(dataUrl, u, v) {
    if (!dataUrl) return null;
    const entry = imageCache.get(dataUrl);
    if (!entry) { loadTexture(dataUrl); return null; }
    if (entry.status !== 'ready') return null;
    const wrappedU = (u % 1 + 1) % 1;
    const wrappedV = (v % 1 + 1) % 1;
    const x = Math.min(entry.width - 1, Math.floor(wrappedU * entry.width));
    const y = Math.min(entry.height - 1, Math.floor((1 - wrappedV) * entry.height));
    const index = (y * entry.width + x) * 4;
    return { r: entry.pixels[index], g: entry.pixels[index + 1], b: entry.pixels[index + 2], a: entry.pixels[index + 3] };
  }

  function materialColor(object, uv, worldY) {
    const material = object.material;
    const scale = Math.max(1, Number(material.scale) || 1);
    const u = uv[0], v = uv[1];
    if (material.type === 'checker') return (Math.floor(u * scale) + Math.floor(v * scale)) % 2 ? material.secondary : material.primary;
    if (material.type === 'stripes') return Math.floor(u * scale) % 2 ? material.secondary : material.primary;
    if (material.type === 'contour') return Math.floor((worldY + 10) * scale) % 2 ? material.secondary : material.primary;
    if (material.type === 'noise') {
      const noise = Math.sin((u * 91.7 + v * 137.3) * scale) * 43758.5453;
      return noise - Math.floor(noise) > 0.52 ? material.primary : material.secondary;
    }
    if (material.type === 'image') return sampleTextureData(material.textureData, u * scale, v * scale) || material.primary;
    return material.primary;
  }

  function vertexNormals(asset) {
    const cached = normalCache.get(asset);
    if (cached) return cached;
    const accumulated = asset.vertices.map(() => ({ x: 0, y: 0, z: 0 }));
    for (const [ia, ib, ic] of asset.faces) {
      const a = { x: asset.vertices[ia][0], y: asset.vertices[ia][1], z: asset.vertices[ia][2] };
      const b = { x: asset.vertices[ib][0], y: asset.vertices[ib][1], z: asset.vertices[ib][2] };
      const c = { x: asset.vertices[ic][0], y: asset.vertices[ic][1], z: asset.vertices[ic][2] };
      const normal = cross(a, b, c);
      for (const index of [ia, ib, ic]) {
        accumulated[index].x += normal.x; accumulated[index].y += normal.y; accumulated[index].z += normal.z;
      }
    }
    const center = asset.vertices.reduce((sum, vertex) => {
      sum.x += vertex[0]; sum.y += vertex[1]; sum.z += vertex[2]; return sum;
    }, { x: 0, y: 0, z: 0 });
    center.x /= asset.vertices.length; center.y /= asset.vertices.length; center.z /= asset.vertices.length;
    let normals = accumulated.map((normal, index) => {
      const vertex = asset.vertices[index];
      const fallback = normaliseVector({ x: vertex[0] - center.x, y: vertex[1] - center.y, z: vertex[2] - center.z });
      const value = normaliseVector(normal, fallback);
      return [value.x, value.y, value.z];
    });
    let score = 0;
    normals.forEach((normal, index) => {
      const vertex = asset.vertices[index];
      score += (vertex[0] - center.x) * normal[0] + (vertex[1] - center.y) * normal[1] + (vertex[2] - center.z) * normal[2];
    });
    if (score < 0) normals = normals.map(([x, y, z]) => [-x, -y, -z]);
    normalCache.set(asset, normals);
    return normals;
  }

  function displacedVertices(object) {
    const displacement = object.material.displacement;
    if (!displacement?.enabled) return object.asset.vertices;
    const dataUrl = displacement.source === 'texture' ? object.material.textureData : displacement.data;
    if (!dataUrl) return object.asset.vertices;
    const entry = imageCache.get(dataUrl);
    if (!entry || entry.status !== 'ready') { loadTexture(dataUrl); return object.asset.vertices; }
    const strength = Core.clamp(Number(displacement.strength) || 0, 0, 2);
    const midpoint = Core.clamp(Number(displacement.midpoint) || 0, 0, 1);
    const cacheKey = `${object.asset.id}|${dataUrl.length}|${dataUrl.slice(-24)}|${strength}|${midpoint}`;
    const cached = displacementCache.get(object.id);
    if (cached?.key === cacheKey) return cached.vertices;
    const normals = vertexNormals(object.asset);
    const vertices = object.asset.vertices.map((vertex, index) => {
      const sample = sampleTextureData(dataUrl, ...(object.asset.uvs[index] || [0, 0]));
      if (!sample) return vertex;
      const lightness = (sample.r * 0.2126 + sample.g * 0.7152 + sample.b * 0.0722) / 255;
      const amount = (lightness - midpoint) * strength;
      const normal = normals[index] || [0, 1, 0];
      return [vertex[0] + normal[0] * amount, vertex[1] + normal[1] * amount, vertex[2] + normal[2] * amount];
    });
    displacementCache.set(object.id, { key: cacheKey, vertices });
    return vertices;
  }

  function renderGround(ctx, width, height, camera) {
    if (state.renderSettings.grid === false) return;
    ctx.save();
    ctx.lineWidth = 1;
    for (let line = -8; line <= 8; line += 1) {
      ctx.strokeStyle = `rgba(120,210,145,${line === 0 ? 0.21 : 0.075})`;
      const segments = [
        [{ x: line, y: 0, z: -8 }, { x: line, y: 0, z: 8 }],
        [{ x: -8, y: 0, z: line }, { x: 8, y: 0, z: line }]
      ];
      for (const [start, end] of segments) {
        const a = project(worldToCamera(start, camera), width, height, camera);
        const b = project(worldToCamera(end, camera), width, height, camera);
        if (!a || !b) continue;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function renderScene(ctx, width, height, time, options = {}) {
    const camera = cameraAt(time, true);
    ctx.fillStyle = '#080a08';
    ctx.fillRect(0, 0, width, height);
    renderGround(ctx, width, height, camera);

    const triangles = [];
    state.objects.forEach((object, objectIndex) => {
      if (state.renderSettings.grid === false && isPlacementMeshObject(object)) return;
      const transform = transformAt(object, time, objectIndex);
      const worldVertices = displacedVertices(object).map((vertex) => objectToWorld(vertex, transform));
      const cameraVertices = worldVertices.map((point) => worldToCamera(point, camera));
      const projected = cameraVertices.map((point) => project(point, width, height, camera));
      const uvs = object.asset.uvs;
      for (const face of object.asset.faces) {
        const [ia, ib, ic] = face;
        const pa = projected[ia], pb = projected[ib], pc = projected[ic];
        if (!pa || !pb || !pc) continue;
        const normal = normaliseVector(cross(cameraVertices[ia], cameraVertices[ib], cameraVertices[ic]));
        const light = normaliseVector({ x: -0.35, y: 0.75, z: -0.55 });
        const diffuse = Math.abs(normal.x * light.x + normal.y * light.y + normal.z * light.z);
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
          depth: (pa.depth + pb.depth + pc.depth) / 3,
          fill: shadedColor(materialColor(object, uv, worldY), lighting),
          selected: object.id === state.selectedId
        });
      }
    });

    triangles.sort((a, b) => b.depth - a.depth);
    if (options.collectHits) state.hitTriangles = triangles;
    for (const triangle of triangles) {
      const [a, b, c] = triangle.points;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = triangle.fill; ctx.fill();
      if (state.wireframe || (triangle.selected && !options.hideSelection)) {
        ctx.strokeStyle = triangle.selected ? 'rgba(190,255,205,.62)' : 'rgba(4,12,6,.34)';
        ctx.lineWidth = triangle.selected ? 0.8 : 0.45;
        ctx.stroke();
      }
    }
  }

  function rebuildHitTriangles(time = state.currentTime) {
    const rect = stage.getBoundingClientRect();
    const width = rect.width, height = rect.height, camera = cameraAt(time, true);
    const triangles = [];
    state.objects.forEach((object, objectIndex) => {
      if (state.renderSettings.grid === false && isPlacementMeshObject(object)) return;
      const transform = transformAt(object, time, objectIndex);
      const worldVertices = displacedVertices(object).map((vertex) => objectToWorld(vertex, transform));
      const projected = worldVertices.map((point) => project(worldToCamera(point, camera), width, height, camera));
      for (const face of object.asset.faces) {
        const [ia, ib, ic] = face; const pa = projected[ia], pb = projected[ib], pc = projected[ic];
        if (!pa || !pb || !pc) continue;
        triangles.push({ objectId: object.id, points: [pa, pb, pc], depth: (pa.depth + pb.depth + pc.depth) / 3 });
      }
    });
    triangles.sort((a, b) => b.depth - a.depth); state.hitTriangles = triangles;
  }

  function renderMain() {
    const rect = stage.getBoundingClientRect();
    if (!webglRenderer?.available) {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderScene(context, rect.width, rect.height, state.currentTime, { collectHits: true });
      return;
    }
    webglRenderer.render(visibleObjects(), cameraAt(state.currentTime, true), {
      ...state.renderSettings,
      selectedId: state.selectedId,
      wireframe: state.wireframe,
      getVertices: displacedVertices,
      getTransform: (object) => transformAt(object, state.currentTime, state.objects.indexOf(object))
    });
    const badge = document.getElementById('render-backend');
    if (badge) { const stats = webglRenderer.getStats(); badge.textContent = `WebGL2 - ${stats.triangles.toLocaleString()} tris`; }
  }

  function chosenAspectRatio() {
    const value = document.getElementById('export-aspect')?.value || '16:9';
    if (value === 'preview') {
      const rect = stage.getBoundingClientRect();
      return rect.width / Math.max(1, rect.height);
    }
    const [w, h] = value.split(':').map(Number);
    return w > 0 && h > 0 ? w / h : 16 / 9;
  }

  function fitPreviewCanvas() {
    const stageRect = stage.getBoundingClientRect();
    const aspectMode = document.getElementById('export-aspect')?.value || '16:9';
    if (aspectMode === 'preview') {
      canvas.style.width = `${Math.max(1, stageRect.width)}px`;
      canvas.style.height = `${Math.max(1, stageRect.height)}px`;
      return;
    }
    const aspect = chosenAspectRatio();
    let width = stageRect.width;
    let height = width / aspect;
    if (height > stageRect.height) {
      height = stageRect.height;
      width = height * aspect;
    }
    canvas.style.width = `${Math.max(1, width)}px`;
    canvas.style.height = `${Math.max(1, height)}px`;
  }

  function resizeCanvas() {
    fitPreviewCanvas();
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
    scheduleRender();
  }

  function pointInTriangle(x, y, triangle) {
    const [a, b, c] = triangle.points;
    const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const point = { x, y };
    const d1 = sign(point, a, b), d2 = sign(point, b, c), d3 = sign(point, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }

  function pickObject(x, y) {
    for (let index = state.hitTriangles.length - 1; index >= 0; index -= 1) {
      const triangle = state.hitTriangles[index];
      if (pointInTriangle(x, y, triangle)) return triangle.objectId;
    }
    return null;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function motionTitle(motion, index) {
    const label = MOTION_LABELS[motion?.type] || 'Motion';
    const axis = motion?.axis && motion.axis !== 'y' ? ` ${motion.axis.toUpperCase()}` : '';
    return `${index + 1}. ${label}${axis}`;
  }

  function refreshObjectList() {
    objectCount.textContent = String(state.objects.length);
    objectList.replaceChildren();
    if (!state.objects.length) {
      const empty = document.createElement('div');
      empty.className = 'empty'; empty.textContent = 'Load the current world or import a World / Animation JSON file.';
      objectList.appendChild(empty); return;
    }
    state.objects.forEach((object) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `object-item${object.id === state.selectedId ? ' selected' : ''}`;
      button.dataset.objectId = object.id;
      button.style.setProperty('--dot', object.material.primary || '#50d08a');
      button.innerHTML = '<span class="dot"></span><span class="object-name"></span><span class="object-motion"></span>';
      button.querySelector('.object-name').textContent = object.name;
      const stack = motionStackFor(object);
      button.querySelector('.object-motion').textContent = stack.length
        ? `${stack.length} motion${stack.length === 1 ? '' : 's'}`
        : `${state.tracks[object.id]?.length || 0} keys`;
      objectList.appendChild(button);
    });
  }

  const TRANSFORM_GROUPS = [
    { key: 'position', label: 'P', min: -50, max: 50, step: 0.01 },
    { key: 'rotation', label: 'R', min: -1080, max: 1080, step: 1 },
    { key: 'scale', label: 'S', min: 0.01, max: 20, step: 0.01 }
  ];

  function buildTransformControls() {
    transformControls.replaceChildren();
    for (const group of TRANSFORM_GROUPS) {
      const title = document.createElement('label');
      title.textContent = group.key;
      title.style.marginTop = group.key === 'position' ? '0' : '10px';
      transformControls.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'transform-grid';
      for (const axis of ['x', 'y', 'z']) {
        const axisLabel = document.createElement('span'); axisLabel.textContent = `${group.label}${axis.toUpperCase()}`;
        const range = document.createElement('input');
        range.type = 'range'; range.min = group.min; range.max = group.max; range.step = group.step;
        range.dataset.group = group.key; range.dataset.axis = axis;
        const number = document.createElement('input');
        number.type = 'number'; number.min = group.min; number.max = group.max; number.step = group.step;
        number.dataset.group = group.key; number.dataset.axis = axis;
        grid.append(axisLabel, range, number);
      }
      transformControls.appendChild(grid);
    }
  }

  function bindRangeNumberControls() {
    document.querySelectorAll('input[type="range"]').forEach((range) => {
      if (range.id === 'timeline' || range.dataset.group) return;
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

  function refreshTransformControls() {
    const object = selectedObject();
    if (!object) return;
    const transform = baseTransformAt(object, state.currentTime);
    transformControls.querySelectorAll('input').forEach((input) => {
      const value = transform[input.dataset.group][input.dataset.axis];
      input.value = Number(value.toFixed(input.dataset.group === 'rotation' ? 1 : 3));
    });
  }

  function refreshMotionControls() {
    const object = selectedObject();
    const stackSelect = document.getElementById('motion-stack');
    const stack = motionStackFor(object);
    stackSelect.replaceChildren();
    stack.forEach((motion, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = motionTitle(motion, index);
      stackSelect.appendChild(option);
    });
    const hasMotion = stack.length > 0;
    state.selectedMotionIndex = hasMotion ? Core.clamp(state.selectedMotionIndex, 0, stack.length - 1) : 0;
    stackSelect.disabled = !hasMotion;
    stackSelect.value = String(state.selectedMotionIndex);
    document.getElementById('remove-motion').disabled = !hasMotion;
    for (const id of ['motion-type', 'motion-axis', 'motion-speed', 'motion-amount', 'motion-phase']) {
      document.getElementById(id).disabled = !hasMotion;
    }
    const motion = hasMotion ? stack[state.selectedMotionIndex] : { ...DEFAULT_MOTION };
    document.getElementById('motion-type').value = motion.type;
    document.getElementById('motion-axis').value = motion.axis;
    document.getElementById('motion-speed').value = motion.speed;
    document.getElementById('motion-speed-v').textContent = Number(motion.speed).toFixed(2);
    document.getElementById('motion-amount').value = motion.amount;
    document.getElementById('motion-amount-v').textContent = Number(motion.amount).toFixed(2);
    document.getElementById('motion-phase').value = motion.phase;
    document.getElementById('motion-phase-v').textContent = `${Math.round(motion.phase)} deg`;
    bindRangeNumberControls();
  }

  function refreshInspector() {
    const object = selectedObject();
    noSelection.hidden = Boolean(object);
    objectInspector.hidden = !object;
    if (!object) return;
    document.getElementById('object-name').value = object.name;
    document.getElementById('object-type').textContent = `${object.asset.type} - ${object.asset.vertices.length} vertices - ${object.asset.faces.length} triangles`;
    refreshTransformControls();
    refreshMotionControls();
  }

  function refreshAnimationControls() {
    document.getElementById('duration').value = state.duration;
    document.getElementById('duration-v').textContent = `${state.duration.toFixed(1)} s`;
    document.getElementById('fps').value = state.fps;
    document.getElementById('fps-v').textContent = String(state.fps);
    document.getElementById('easing').value = state.easing;
    document.getElementById('loop').checked = state.loop;
    document.getElementById('world-motion').value = state.worldMotion.type;
    document.getElementById('world-axis').value = state.worldMotion.axis || 'y';
    document.getElementById('world-speed').value = state.worldMotion.speed;
    document.getElementById('world-speed-v').textContent = Number(state.worldMotion.speed).toFixed(2);
    document.getElementById('world-amount').value = state.worldMotion.amount;
    document.getElementById('world-amount-v').textContent = Number(state.worldMotion.amount).toFixed(2);
    document.getElementById('camera-motion').value = state.cameraMotion.type;
    document.getElementById('camera-speed').value = state.cameraMotion.speed;
    document.getElementById('camera-speed-v').textContent = Number(state.cameraMotion.speed).toFixed(2);
    document.getElementById('camera-amount').value = state.cameraMotion.amount;
    document.getElementById('camera-amount-v').textContent = Number(state.cameraMotion.amount).toFixed(2);
    timeline.max = state.duration;
    timeline.value = state.currentTime;
    timeReadout.textContent = `${state.currentTime.toFixed(2)} / ${state.duration.toFixed(2)} s`;
    document.getElementById('play').textContent = state.playing ? 'Pause' : 'Play';
  }

  function refreshMarkers() {
    markers.replaceChildren();
    const object = selectedObject();
    const addMarker = (key, className, title) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `marker ${className}`;
      button.style.left = `${Core.clamp(key.time / state.duration, 0, 1) * 100}%`;
      button.title = `${title}: ${key.time.toFixed(2)} s`;
      button.dataset.time = key.time;
      markers.appendChild(button);
    };
    (state.tracks[object?.id] || []).forEach((key) => addMarker(key, 'object', 'Object'));
    state.cameraTrack.forEach((key) => addMarker(key, 'camera', 'Camera'));
  }

  function refreshKeyInfo() {
    const object = selectedObject();
    document.getElementById('object-key-count').textContent = String(state.tracks[object?.id]?.length || 0);
    document.getElementById('camera-key-count').textContent = String(state.cameraTrack.length);
    refreshMarkers();
    refreshObjectList();
  }

  function refreshUi() {
    refreshObjectList();
    refreshInspector();
    refreshAnimationControls();
    refreshKeyInfo();
    refreshRenderControls();
    document.getElementById('wireframe-toggle').textContent = `Wireframe: ${state.wireframe ? 'on' : 'off'}`;
    const placementButton = document.getElementById('toggle-placement-mesh');
    if (placementButton) {
      const enabled = state.renderSettings.grid !== false;
      placementButton.textContent = `Placement mesh: ${enabled ? 'on' : 'off'}`;
      placementButton.classList.toggle('active', enabled);
    }
    const freeCameraButton = document.getElementById('toggle-free-camera');
    if (freeCameraButton) {
      freeCameraButton.textContent = `Free cam: ${state.freeCamera ? 'on' : 'off'}`;
      freeCameraButton.classList.toggle('active', state.freeCamera);
    }
    const stageStatus = document.getElementById('stage-status');
    if (stageStatus) {
      stageStatus.textContent = state.freeCamera
        ? 'Free cam: WASD move - R/F up/down - Ctrl/right-drag pan - Drag orbit'
        : 'Drag: orbit - Ctrl/right-drag: pan camera - Shift+drag: move object - Scroll: zoom';
    }
    bindRangeNumberControls();
  }

  function setTime(value, options = {}) {
    state.currentTime = Core.clamp(Number(value) || 0, 0, state.duration);
    timeline.value = state.currentTime;
    timeReadout.textContent = `${state.currentTime.toFixed(2)} / ${state.duration.toFixed(2)} s`;
    if (!options.skipInspector) refreshTransformControls();
    scheduleRender();
  }

  function stopPlayback() {
    state.playing = false;
    document.getElementById('play').textContent = 'Play';
  }

  function playbackFrame(now) {
    if (!state.playing) return;
    const elapsed = (now - state.playStartedAt) / 1000;
    let time = state.playStartedTime + elapsed;
    if (time > state.duration) {
      if (state.loop) {
        time %= state.duration;
        state.playStartedAt = now;
        state.playStartedTime = time;
      } else {
        setTime(state.duration, { skipInspector: true });
        stopPlayback();
        refreshTransformControls();
        return;
      }
    }
    setTime(time, { skipInspector: true });
    requestAnimationFrame(playbackFrame);
  }

  function togglePlayback() {
    if (state.exporting || !state.objects.length) return;
    state.playing = !state.playing;
    document.getElementById('play').textContent = state.playing ? 'Pause' : 'Play';
    if (state.playing) {
      if (state.currentTime >= state.duration) state.currentTime = 0;
      state.playStartedAt = performance.now();
      state.playStartedTime = state.currentTime;
      requestAnimationFrame(playbackFrame);
    } else {
      refreshTransformControls();
    }
  }

  async function prepareTextures() {
    const urls = new Set();
    state.objects.forEach((object) => {
      if (object.material.textureData) urls.add(object.material.textureData);
      const displacement = object.material.displacement;
      if (displacement?.enabled) {
        const data = displacement.source === 'texture' ? object.material.textureData : displacement.data;
        if (data) urls.add(data);
      }
    });
    await Promise.all([...urls].map(loadTexture));
  }

  function exportDimensions() {
    let width = Number(document.getElementById('export-width').value) || 1920;
    const aspect = chosenAspectRatio();
    let height = Math.max(2, Math.round(width / Math.max(0.01, aspect)));
    // AVC encoders are most reliable with even dimensions.
    width = Math.max(2, Math.round(width / 2) * 2);
    height = Math.max(2, Math.round(height / 2) * 2);
    return { width, height };
  }

  function requestedSupersample() {
    return Core.clamp(Number(document.getElementById('export-quality')?.value || 2), 1, 2);
  }

  function createExportCanvas() {
    const { width, height } = exportDimensions();
    const output = document.createElement('canvas');
    output.width = width; output.height = height;
    return output;
  }

  function createExportTargets() {
    const output = createExportCanvas();
    const requested = requestedSupersample();
    // Keep the internal render target bounded. 1080p can render at 4K internally;
    // 4K output stays near native resolution instead of attempting an 8K canvas.
    const maxInternalDimension = 4096;
    const scale = Math.max(1, Math.min(requested, maxInternalDimension / output.width, maxInternalDimension / output.height));
    const render = document.createElement('canvas');
    render.width = Math.max(output.width, Math.round(output.width * scale / 2) * 2);
    render.height = Math.max(output.height, Math.round(output.height * scale / 2) * 2);
    const outputCtx = output.getContext('2d', { alpha: false });
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    const blit = () => {
      outputCtx.clearRect(0, 0, output.width, output.height);
      outputCtx.drawImage(render, 0, 0, render.width, render.height, 0, 0, output.width, output.height);
    };
    return { output, render, blit, scale: render.width / output.width };
  }

  function setExportBusy(busy, message = '') {
    state.exporting = busy;
    document.querySelectorAll('#export-mp4, #export-webm, #export-gif').forEach((button) => { button.disabled = busy; });
    if (message) exportStatus.textContent = message;
    if (!busy) progressBar.style.width = '0%';
  }

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  function bytesConcat(...parts) {
    const arrays = parts.flat().filter(Boolean);
    const length = arrays.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length); let offset = 0;
    for (const part of arrays) { output.set(part, offset); offset += part.length; }
    return output;
  }

  function bytesU8(value) { return Uint8Array.of(value & 255); }
  function bytesU16(value) { return Uint8Array.of((value >>> 8) & 255, value & 255); }
  function bytesU24(value) { return Uint8Array.of((value >>> 16) & 255, (value >>> 8) & 255, value & 255); }
  function bytesU32(value) { value = Number(value) >>> 0; return Uint8Array.of((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255); }
  function bytesText(value) { return Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 255)); }
  function mp4Box(type, ...parts) { const payload = bytesConcat(...parts); return bytesConcat(bytesU32(payload.length + 8), bytesText(type), payload); }
  function mp4FullBox(type, version, flags, ...parts) { return mp4Box(type, bytesU8(version), bytesU24(flags), ...parts); }

  function mp4Matrix() {
    return bytesConcat(bytesU32(0x00010000), bytesU32(0), bytesU32(0), bytesU32(0), bytesU32(0x00010000), bytesU32(0), bytesU32(0), bytesU32(0), bytesU32(0x40000000));
  }

  function buildMp4(samples, avcConfig, width, height, fps) {
    if (!samples.length || !avcConfig?.length) throw new Error('H.264 encoder did not provide an AVC configuration record.');
    const timescale = 90000;
    const sampleDelta = Math.max(1, Math.round(timescale / fps));
    const duration = sampleDelta * samples.length;
    const ftyp = mp4Box('ftyp', bytesText('isom'), bytesU32(0x200), bytesText('isom'), bytesText('iso6'), bytesText('avc1'), bytesText('mp41'));

    const mvhd = mp4FullBox('mvhd', 0, 0,
      bytesU32(0), bytesU32(0), bytesU32(timescale), bytesU32(duration),
      bytesU32(0x00010000), bytesU16(0x0100), bytesU16(0), bytesU32(0), bytesU32(0), mp4Matrix(),
      bytesU32(0), bytesU32(0), bytesU32(0), bytesU32(0), bytesU32(0), bytesU32(0), bytesU32(2));

    const tkhd = mp4FullBox('tkhd', 0, 0x000007,
      bytesU32(0), bytesU32(0), bytesU32(1), bytesU32(0), bytesU32(duration), bytesU32(0), bytesU32(0),
      bytesU16(0), bytesU16(0), bytesU16(0), bytesU16(0), mp4Matrix(), bytesU32(width << 16), bytesU32(height << 16));

    const mdhd = mp4FullBox('mdhd', 0, 0, bytesU32(0), bytesU32(0), bytesU32(timescale), bytesU32(duration), bytesU16(0x55c4), bytesU16(0));
    const hdlr = mp4FullBox('hdlr', 0, 0, bytesU32(0), bytesText('vide'), bytesU32(0), bytesU32(0), bytesU32(0), bytesText('VideoHandler\0'));
    const vmhd = mp4FullBox('vmhd', 0, 1, bytesU16(0), bytesU16(0), bytesU16(0), bytesU16(0));
    const url = mp4FullBox('url ', 0, 1);
    const dref = mp4FullBox('dref', 0, 0, bytesU32(1), url);
    const dinf = mp4Box('dinf', dref);

    const compressor = new Uint8Array(32);
    const avc1 = mp4Box('avc1',
      new Uint8Array(6), bytesU16(1), bytesU16(0), bytesU16(0), bytesU32(0), bytesU32(0), bytesU32(0),
      bytesU16(width), bytesU16(height), bytesU32(0x00480000), bytesU32(0x00480000), bytesU32(0), bytesU16(1),
      compressor, bytesU16(0x0018), bytesU16(0xffff), mp4Box('avcC', avcConfig));
    const stsd = mp4FullBox('stsd', 0, 0, bytesU32(1), avc1);
    const stts = mp4FullBox('stts', 0, 0, bytesU32(1), bytesU32(samples.length), bytesU32(sampleDelta));
    const keySamples = samples.map((sample, index) => sample.key ? index + 1 : 0).filter(Boolean);
    const stss = mp4FullBox('stss', 0, 0, bytesU32(keySamples.length), ...keySamples.map(bytesU32));
    const stsc = mp4FullBox('stsc', 0, 0, bytesU32(1), bytesU32(1), bytesU32(samples.length), bytesU32(1));
    const stsz = mp4FullBox('stsz', 0, 0, bytesU32(0), bytesU32(samples.length), ...samples.map((sample) => bytesU32(sample.data.length)));

    const makeMoov = (chunkOffset) => {
      const stco = mp4FullBox('stco', 0, 0, bytesU32(1), bytesU32(chunkOffset));
      const stbl = mp4Box('stbl', stsd, stts, stss, stsc, stsz, stco);
      const minf = mp4Box('minf', vmhd, dinf, stbl);
      const mdia = mp4Box('mdia', mdhd, hdlr, minf);
      const trak = mp4Box('trak', tkhd, mdia);
      return mp4Box('moov', mvhd, trak);
    };
    let moov = makeMoov(0);
    const chunkOffset = ftyp.length + moov.length + 8;
    moov = makeMoov(chunkOffset);
    const mdatPayload = bytesConcat(...samples.map((sample) => sample.data));
    const mdat = mp4Box('mdat', mdatPayload);
    return new Blob([ftyp, moov, mdat], { type: 'video/mp4' });
  }

  async function supportedAvcConfig(width, height, fps, bitrate) {
    if (!window.VideoEncoder || !window.VideoFrame || typeof VideoEncoder.isConfigSupported !== 'function') return null;
    const codecCandidates = width >= 2560 || height >= 1440
      ? ['avc1.640033', 'avc1.64002A', 'avc1.4D402A']
      : width >= 1280 || height >= 720
        ? ['avc1.640028', 'avc1.4D4028', 'avc1.420028']
        : ['avc1.4D401F', 'avc1.42001F'];
    // Prefer quality-oriented encoding. Realtime is only a compatibility fallback.
    for (const latencyMode of ['quality', 'realtime']) {
      for (const codec of codecCandidates) {
        const config = { codec, width, height, bitrate, framerate: fps, latencyMode, hardwareAcceleration: 'no-preference', avc: { format: 'avc' } };
        try {
          const support = await VideoEncoder.isConfigSupported(config);
          if (support.supported) return support.config || config;
        } catch { /* Try the next AVC profile/level. */ }
      }
    }
    return null;
  }

  async function exportMp4WebCodecs() {
    if (!state.objects.length || state.exporting) return false;
    const targets = createExportTargets();
    const output = targets.output;
    const renderSurface = targets.render;
    const fps = state.fps;
    const bitrate = Number(document.getElementById('export-bitrate')?.value || 12) * 1_000_000;
    const config = await supportedAvcConfig(output.width, output.height, fps, bitrate);
    if (!config) return false;

    stopPlayback();
    setExportBusy(true, 'Initializing the H.264 encoder for MP4...');
    try {
      await prepareTextures();
      const exportRenderer = WebGL?.createRenderer(renderSurface);
      const fallbackCtx = exportRenderer?.available ? null : renderSurface.getContext('2d', { alpha: false });
      if (exportRenderer?.available) await exportRenderer.prepareTextures(state.objects);
      const samples = [];
      let avcConfig = null;
      const encoder = new VideoEncoder({
        output(chunk, metadata) {
          const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
          samples.push({ data, key: chunk.type === 'key', timestamp: Number(chunk.timestamp) || 0 });
          const description = metadata?.decoderConfig?.description;
          if (description && !avcConfig) avcConfig = new Uint8Array(description instanceof ArrayBuffer ? description : description.buffer.slice(description.byteOffset, description.byteOffset + description.byteLength));
        },
        error(error) { console.error('H.264 encoder error', error); }
      });
      encoder.configure(config);
      const totalFrames = Math.max(1, Math.ceil(state.duration * fps));
      const frameDurationUs = Math.max(1, Math.round(1_000_000 / fps));
      for (let frame = 0; frame < totalFrames; frame += 1) {
        const time = Math.min(state.duration, frame / fps);
        if (exportRenderer?.available) exportRenderer.render(visibleObjects(), cameraAt(time, true), { ...state.renderSettings, selectedId: null, wireframe: state.wireframe, getVertices: displacedVertices, getTransform: (object) => transformAt(object, time, state.objects.indexOf(object)) });
        else renderScene(fallbackCtx, renderSurface.width, renderSurface.height, time, { hideSelection: true });
        targets.blit();
        const videoFrame = new VideoFrame(output, { timestamp: frame * frameDurationUs, duration: frameDurationUs });
        encoder.encode(videoFrame, { keyFrame: frame === 0 || frame % Math.max(1, Math.round(fps * 2)) === 0 });
        videoFrame.close();
        progressBar.style.width = `${(frame + 1) / totalFrames * 100}%`;
        exportStatus.textContent = `Encoding MP4: ${frame + 1} / ${totalFrames} frames`;
        if (encoder.encodeQueueSize > 16 || frame % 6 === 0) await new Promise(requestAnimationFrame);
        if (frame > 0 && frame % Math.max(30, fps * 2) === 0) await encoder.flush();
      }
      await encoder.flush(); encoder.close();
      samples.sort((a, b) => a.timestamp - b.timestamp);
      if (!avcConfig) throw new Error('The H.264 encoder did not provide the avcC data required for MP4.');
      const blob = buildMp4(samples, avcConfig, output.width, output.height, fps);
      downloadBlob(`${safeFilename('studio-scene')}.mp4`, blob);
      exportStatus.textContent = `MP4 H.264: ${output.width} x ${output.height}, ${fps} fps, ${Math.round(bitrate / 1_000_000)} Mbps - internal render ${targets.scale.toFixed(2)}x.`;
      showToast('MP4 export created.');
      return true;
    } catch (error) {
      console.error(error); exportStatus.textContent = `${error.message || 'The H.264 encoder is not available.'} Trying the native MP4 fallback...`; showToast('Switching to native MP4 fallback.');
      return false;
    } finally {
      setExportBusy(false); setTime(state.currentTime);
    }
  }

  function recorderMime(format) {
    const candidates = format === 'mp4'
      ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function exportRecordedVideo(format) {
    if (!state.objects.length || state.exporting) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      showToast('This browser does not support video export from canvas.'); return;
    }
    const mimeType = recorderMime(format);
    if (!mimeType) {
      const label = format.toUpperCase();
      exportStatus.textContent = `${label} is not exposed by MediaRecorder in this browser. Use the other video format.`;
      showToast(`${label} export is unavailable in this browser.`); return;
    }
    stopPlayback();
    setExportBusy(true, `Preparing textures for ${format.toUpperCase()}...`);
    try {
      await prepareTextures();
      const targets = createExportTargets();
      const output = targets.output;
      const renderSurface = targets.render;
      const exportRenderer = WebGL?.createRenderer(renderSurface);
      const fallbackCtx = exportRenderer?.available ? null : renderSurface.getContext('2d', { alpha: false });
      if (exportRenderer?.available) await exportRenderer.prepareTextures(state.objects);
      const fps = state.fps, totalFrames = Math.max(1, Math.ceil(state.duration * fps));
      const bitrate = Number(document.getElementById('export-bitrate')?.value || 12) * 1_000_000;
      const stream = output.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = () => reject(recorder.error || new Error('MediaRecorder failed.')); });
      recorder.start(250);
      const frameDuration = 1000 / fps, startTime = performance.now();
      for (let frame = 0; frame < totalFrames; frame += 1) {
        const remaining = startTime + frame * frameDuration - performance.now();
        if (remaining > 1) await wait(remaining);
        const time = Math.min(state.duration, frame / fps), camera = cameraAt(time, true);
        if (exportRenderer?.available) exportRenderer.render(visibleObjects(), camera, { ...state.renderSettings, selectedId: null, wireframe: state.wireframe, getVertices: displacedVertices, getTransform: (object) => transformAt(object, time, state.objects.indexOf(object)) });
        else renderScene(fallbackCtx, renderSurface.width, renderSurface.height, time, { hideSelection: true });
        targets.blit();
        progressBar.style.width = `${(frame + 1) / totalFrames * 100}%`;
        exportStatus.textContent = `Rendering ${format.toUpperCase()}: ${frame + 1} / ${totalFrames} frames`;
      }
      await wait(frameDuration * 1.5); recorder.stop(); await stopped; stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      downloadBlob(`${safeFilename('studio-scene')}.${format}`, blob);
      exportStatus.textContent = `${format.toUpperCase()}: ${output.width} x ${output.height}, ${fps} fps, ${Math.round(bitrate / 1_000_000)} Mbps - internal render ${targets.scale.toFixed(2)}x.`;
      showToast(`${format.toUpperCase()} export created.`);
    } catch (error) {
      console.error(error); exportStatus.textContent = error.message || `${format.toUpperCase()} export failed.`; showToast(`${format.toUpperCase()} export failed.`);
    } finally { setExportBusy(false); setTime(state.currentTime); }
  }

  const exportWebm = () => exportRecordedVideo('webm');
  const exportMp4 = async () => { if (!(await exportMp4WebCodecs())) await exportRecordedVideo('mp4'); };

  class ByteSink {
    constructor() { this.bytes = []; }
    byte(value) { this.bytes.push(value & 255); }
    word(value) { this.byte(value); this.byte(value >> 8); }
    text(value) { for (let index = 0; index < value.length; index += 1) this.byte(value.charCodeAt(index)); }
    array(values) { for (const value of values) this.byte(value); }
    blob(type) { return new Blob([Uint8Array.from(this.bytes)], { type }); }
  }

  // function rgb332Palette() {
  //   const palette = new Uint8Array(256 * 3);
  //   for (let index = 0; index < 256; index += 1) {
  //     const r = (index >> 5) & 7;
  //     const g = (index >> 2) & 7;
  //     const b = index & 3;
  //     palette[index * 3] = Math.round(r * 255 / 7);
  //     palette[index * 3 + 1] = Math.round(g * 255 / 7);
  //     palette[index * 3 + 2] = Math.round(b * 255 / 3);
  //   }
  //   return palette;
  // }

  // function quantiseRgb332(imageData) {
  //   const source = imageData.data;
  //   const indices = new Uint8Array(source.length / 4);
  //   for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += 4, targetIndex += 1) {
  //     indices[targetIndex] = ((source[sourceIndex] >> 5) << 5) | ((source[sourceIndex + 1] >> 5) << 2) | (source[sourceIndex + 2] >> 6);
  //   }
  //   return indices;
  // }

  const GIF_BAYER_MATRIX = [
    0,  8,  2, 10,
    12,  4, 14,  6,
    3, 11,  1,  9,
    15,  7, 13,  5
  ];

  function artisticGifPalette() {
    const palette = new Uint8Array(256 * 3);
    let paletteIndex = 0;

    // 216 colors: RGB cube 6 x 6 x 6.
    for (let red = 0; red < 6; red += 1) {
      for (let green = 0; green < 6; green += 1) {
        for (let blue = 0; blue < 6; blue += 1) {
          palette[paletteIndex * 3] =
            Math.round(red * 255 / 5);

          palette[paletteIndex * 3 + 1] =
            Math.round(green * 255 / 5);

          palette[paletteIndex * 3 + 2] =
            Math.round(blue * 255 / 5);

          paletteIndex += 1;
        }
      }
    }

    // Ultimele 40 de culori sunt niveluri de gri.
    for (let index = 0; index < 40; index += 1) {
      const gray = Math.round(index * 255 / 39);
      const offset = (216 + index) * 3;

      palette[offset] = gray;
      palette[offset + 1] = gray;
      palette[offset + 2] = gray;
    }

    return palette;
  }

  function quantiseArtisticGif(imageData, width, height) {
    const source = imageData.data;
    const indices = new Uint8Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        const sourceIndex = pixelIndex * 4;

        const matrixIndex = (y % 4) * 4 + (x % 4);

        // Ordered dithering, subtle enough for textures.
        const dither =
          (GIF_BAYER_MATRIX[matrixIndex] - 7.5) * 2.6;

        const red = Core.clamp(
          source[sourceIndex] + dither,
          0,
          255
        );

        const green = Core.clamp(
          source[sourceIndex + 1] + dither,
          0,
          255
        );

        const blue = Core.clamp(
          source[sourceIndex + 2] + dither,
          0,
          255
        );

        const maximum = Math.max(red, green, blue);
        const minimum = Math.min(red, green, blue);

        // Pentru culorile aproape neutre folosim cele 40 de griuri.
        if (maximum - minimum < 18) {
          const luminance =
            red * 0.2126 +
            green * 0.7152 +
            blue * 0.0722;

          const grayIndex = Math.round(
            luminance / 255 * 39
          );

          indices[pixelIndex] = 216 + grayIndex;
          continue;
        }

        const redIndex = Math.round(red / 255 * 5);
        const greenIndex = Math.round(green / 255 * 5);
        const blueIndex = Math.round(blue / 255 * 5);

        indices[pixelIndex] =
          redIndex * 36 +
          greenIndex * 6 +
          blueIndex;
      }
    }

    return indices;
  }

  function lzwEncode(indices, minimumCodeSize = 8) {
    // A deliberately simple, standards-safe GIF stream. Clearing the LZW
    // dictionary every 240 literal pixels keeps every code at 9 bits. This is
    // larger than aggressive LZW compression, but it is deterministic and
    // avoids browser-specific dictionary edge cases in a dependency-free encoder.
    const clearCode = 1 << minimumCodeSize;
    const endCode = clearCode + 1;
    const codeSize = minimumCodeSize + 1;
    const output = [];
    let bitBuffer = 0;
    let bitCount = 0;
    const emit = (code) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        output.push(bitBuffer & 255);
        bitBuffer >>>= 8;
        bitCount -= 8;
      }
    };

    const literalRun = 240;
    for (let offset = 0; offset < indices.length; offset += literalRun) {
      emit(clearCode);
      const end = Math.min(indices.length, offset + literalRun);
      for (let index = offset; index < end; index += 1) emit(indices[index]);
    }
    if (!indices.length) emit(clearCode);
    emit(endCode);
    if (bitCount) output.push(bitBuffer & 255);
    return Uint8Array.from(output);
  }

  function writeGifFrame(sink, indices, width, height, delayCentiseconds) {
    sink.array([0x21, 0xF9, 0x04, 0x00]);
    sink.word(delayCentiseconds);
    sink.array([0x00, 0x00]);
    sink.byte(0x2C);
    sink.word(0); sink.word(0); sink.word(width); sink.word(height);
    sink.byte(0x00);
    sink.byte(8);
    const compressed = lzwEncode(indices, 8);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const length = Math.min(255, compressed.length - offset);
      sink.byte(length);
      sink.array(compressed.subarray(offset, offset + length));
    }
    sink.byte(0);
  }

  async function exportGif() {
    if (!state.objects.length || state.exporting) return;
    stopPlayback();
    setExportBusy(true, 'Preparing textures for GIF...');
    try {
      await prepareTextures();
      const requested = exportDimensions();
      const width = Math.min(640, requested.width);
      const height = Math.max(180, Math.round(requested.height * width / requested.width));
      const output = document.createElement('canvas');
      output.width = width; output.height = height;
      const gifRenderer = WebGL?.createRenderer(output);
      const ctx = gifRenderer?.available ? null : output.getContext('2d', { alpha: false, willReadFrequently: true });
      if (gifRenderer?.available) await gifRenderer.prepareTextures(state.objects);
      const requestedFps = Number(document.getElementById('gif-fps').value) || 12;
      const totalFrames = Math.min(300, Math.max(1, Math.ceil(state.duration * requestedFps)));
      const effectiveFps = totalFrames / state.duration;
      const delay = Math.max(2, Math.round(100 / effectiveFps));
      const sink = new ByteSink();
      sink.text('GIF89a');
      sink.word(width); sink.word(height);
      sink.byte(0xF7); sink.byte(0); sink.byte(0);
      sink.array(artisticGifPalette());
      sink.array([0x21, 0xFF, 0x0B]); sink.text('NETSCAPE2.0'); sink.array([0x03, 0x01]); sink.word(state.loop ? 0 : 1); sink.byte(0);

      for (let frame = 0; frame < totalFrames; frame += 1) {
        const time = Math.min(state.duration, frame / effectiveFps);
        if (gifRenderer?.available) gifRenderer.render(visibleObjects(), cameraAt(time, true), { ...state.renderSettings, background: '#101510', exposure: state.renderSettings.exposure * 1.12, selectedId: null, wireframe: state.wireframe, getVertices: displacedVertices, getTransform: (object) => transformAt(object, time, state.objects.indexOf(object)) });
        else renderScene(ctx, width, height, time, { hideSelection: true });
        const pixels = gifRenderer?.available ? gifRenderer.readPixels() : ctx.getImageData(0, 0, width, height);
        writeGifFrame(
          sink,
          quantiseArtisticGif(pixels, width, height),
          width,
          height,
          delay
        );
        progressBar.style.width = `${(frame + 1) / totalFrames * 100}%`;
        exportStatus.textContent = `Encoding GIF: ${frame + 1} / ${totalFrames} frames`;
        if (frame % 3 === 0) await new Promise(requestAnimationFrame);
      }
      sink.byte(0x3B);
      downloadBlob(`${safeFilename('studio-scene')}.gif`, sink.blob('image/gif'));
      exportStatus.textContent = `GIF exported: ${width} x ${height}, ${effectiveFps.toFixed(1)} fps, 256-color palette.`;
      showToast('GIF created.');
    } catch (error) {
      console.error(error);
      exportStatus.textContent = error.message || 'GIF export failed.';
      showToast('GIF export failed.');
    } finally {
      setExportBusy(false);
      setTime(state.currentTime);
    }
  }

  function refreshRenderControls() {
    const settings = state.renderSettings;
    for (const [id, key] of [['scene-background','background'],['scene-exposure','exposure'],['scene-ambient','ambient'],['scene-light','lightIntensity'],['scene-light-azimuth','lightAzimuth'],['scene-light-elevation','lightElevation'],['scene-rim','rim']]) {
      const input = document.getElementById(id); if (input) input.value = String(settings[key]);
      const output = document.getElementById(`${id}-v`); if (output && key !== 'background') output.textContent = (key === 'lightAzimuth' || key === 'lightElevation') ? `${Math.round(Number(settings[key]))} deg` : Number(settings[key]).toFixed(2);
    }
    const grid = document.getElementById('scene-grid'); if (grid) grid.checked = settings.grid !== false;
    const placementButton = document.getElementById('toggle-placement-mesh');
    if (placementButton) {
      const enabled = settings.grid !== false;
      placementButton.textContent = `Placement mesh: ${enabled ? 'on' : 'off'}`;
      placementButton.classList.toggle('active', enabled);
    }
    const badge = document.getElementById('render-backend'); if (badge && !webglRenderer?.available) badge.textContent = 'Canvas fallback';
  }

  function bindRenderControls() {
    for (const [id, key] of [['scene-exposure','exposure'],['scene-ambient','ambient'],['scene-light','lightIntensity'],['scene-light-azimuth','lightAzimuth'],['scene-light-elevation','lightElevation'],['scene-rim','rim']]) {
      document.getElementById(id)?.addEventListener('input', (event) => { const value = Number(event.target.value); state.renderSettings[key] = value; document.getElementById(`${id}-v`).textContent = (key === 'lightAzimuth' || key === 'lightElevation') ? `${Math.round(value)} deg` : value.toFixed(2); scheduleRender(); scheduleSave(); });
    }
    document.getElementById('scene-background')?.addEventListener('input', (event) => { state.renderSettings.background = event.target.value; scheduleRender(); scheduleSave(); });
    document.getElementById('scene-grid')?.addEventListener('change', (event) => { state.renderSettings.grid = event.target.checked; refreshRenderControls(); scheduleRender(); scheduleSave(); });
  }

  objectList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-object-id]');
    if (!button) return;
    state.selectedId = button.dataset.objectId;
    refreshUi(); scheduleRender();
  });

  transformControls.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-group]');
    const object = selectedObject();
    if (!input || !object) return;
    const transform = baseTransformAt(object, state.currentTime);
    const group = input.dataset.group, axis = input.dataset.axis;
    let value = Number(input.value);
    if (!Number.isFinite(value)) return;
    if (group === 'scale') value = Math.max(0.01, value);
    transform[group][axis] = value;
    setObjectBaseTransform(object, transform);
    transformControls.querySelectorAll(`input[data-group="${group}"][data-axis="${axis}"]`).forEach((control) => {
      if (control !== input) control.value = input.value;
    });
  });

  timeline.addEventListener('input', () => {
    stopPlayback();
    setTime(timeline.value);
  });
  markers.addEventListener('click', (event) => {
    const marker = event.target.closest('[data-time]');
    if (!marker) return;
    stopPlayback(); setTime(marker.dataset.time);
  });

  document.getElementById('play').addEventListener('click', togglePlayback);
  document.getElementById('jump-start').addEventListener('click', () => { stopPlayback(); setTime(0); });
  document.getElementById('jump-end').addEventListener('click', () => { stopPlayback(); setTime(state.duration); });

  document.getElementById('add-key').addEventListener('click', () => {
    const object = selectedObject();
    if (!object) return showToast('Select an object.');
    const track = state.tracks[object.id] || (state.tracks[object.id] = []);
    upsertKey(track, state.currentTime, baseTransformAt(object, state.currentTime));
    refreshKeyInfo(); scheduleSave(); showToast('Object keyframe added.');
  });
  document.getElementById('delete-key').addEventListener('click', () => {
    const object = selectedObject();
    if (!object || !deleteNearestKey(state.tracks[object.id], state.currentTime)) return showToast('No nearby keyframe exists.');
    refreshUi(); scheduleRender(); scheduleSave();
  });
  document.getElementById('add-camera-key').addEventListener('click', () => {
    upsertKey(state.cameraTrack, state.currentTime, cameraAt(state.currentTime, false));
    refreshKeyInfo(); scheduleSave(); showToast('Camera keyframe added.');
  });
  document.getElementById('delete-camera-key').addEventListener('click', () => {
    if (!deleteNearestKey(state.cameraTrack, state.currentTime)) return showToast('No nearby camera keyframe exists.');
    refreshUi(); scheduleRender(); scheduleSave();
  });

  document.getElementById('duration').addEventListener('input', (event) => {
    state.duration = Core.clamp(Number(event.target.value) || 1, 1, 3600);
    if (state.currentTime > state.duration) state.currentTime = state.duration;
    refreshAnimationControls(); refreshMarkers(); scheduleRender(); scheduleSave();
  });
  document.getElementById('fps').addEventListener('input', (event) => {
    state.fps = Number(event.target.value);
    document.getElementById('fps-v').textContent = String(state.fps);
    scheduleSave();
  });
  document.getElementById('easing').addEventListener('change', (event) => { state.easing = event.target.value; scheduleRender(); scheduleSave(); });
  document.getElementById('loop').addEventListener('change', (event) => { state.loop = event.target.checked; scheduleSave(); });

  function bindMotionControl(id, target, property, formatter = (value) => value) {
    document.getElementById(id).addEventListener('input', (event) => {
      target[property] = event.target.type === 'range' ? Number(event.target.value) : event.target.value;
      const output = document.getElementById(`${id}-v`);
      if (output) output.textContent = formatter(target[property]);
      scheduleRender(); scheduleSave(); refreshObjectList();
    });
  }

  document.getElementById('motion-stack').addEventListener('change', (event) => {
    state.selectedMotionIndex = Number(event.target.value) || 0;
    refreshMotionControls();
  });
  document.getElementById('add-motion').addEventListener('click', () => {
    const object = selectedObject(); if (!object) return;
    const stack = motionStackFor(object, true);
    stack.push({ ...DEFAULT_MOTION, type: 'spin' });
    state.selectedMotionIndex = stack.length - 1;
    refreshInspector(); refreshObjectList(); scheduleRender(); scheduleSave();
  });
  document.getElementById('remove-motion').addEventListener('click', () => {
    const object = selectedObject(); if (!object) return;
    const stack = motionStackFor(object);
    if (!stack.length) return;
    stack.splice(state.selectedMotionIndex, 1);
    if (stack.length) state.selectedMotionIndex = Core.clamp(state.selectedMotionIndex, 0, stack.length - 1);
    else { delete state.motions[object.id]; state.selectedMotionIndex = 0; }
    refreshInspector(); refreshObjectList(); scheduleRender(); scheduleSave();
  });
  document.getElementById('motion-type').addEventListener('change', (event) => {
    const motion = selectedMotion(undefined, true); if (!motion) return;
    motion.type = event.target.value; refreshMotionControls(); scheduleRender(); scheduleSave(); refreshObjectList();
  });
  document.getElementById('motion-axis').addEventListener('change', (event) => {
    const motion = selectedMotion(undefined, true); if (!motion) return;
    motion.axis = event.target.value; refreshMotionControls(); scheduleRender(); scheduleSave(); refreshObjectList();
  });
  for (const [id, property, formatter] of [
    ['motion-speed', 'speed', (v) => Number(v).toFixed(2)],
    ['motion-amount', 'amount', (v) => Number(v).toFixed(2)],
    ['motion-phase', 'phase', (v) => `${Math.round(v)} deg`]
  ]) {
    document.getElementById(id).addEventListener('input', (event) => {
      const motion = selectedMotion(undefined, true); if (!motion) return;
      motion[property] = Number(event.target.value);
      document.getElementById(`${id}-v`).textContent = formatter(motion[property]);
      refreshMotionControls(); scheduleRender(); scheduleSave(); refreshObjectList();
    });
  }

  document.getElementById('world-motion').addEventListener('change', (event) => { state.worldMotion.type = event.target.value; scheduleRender(); scheduleSave(); });
  document.getElementById('world-axis').addEventListener('change', (event) => { state.worldMotion.axis = event.target.value; scheduleRender(); scheduleSave(); });
  document.getElementById('world-speed').addEventListener('input', (event) => {
    state.worldMotion.speed = Number(event.target.value); document.getElementById('world-speed-v').textContent = state.worldMotion.speed.toFixed(2); scheduleRender(); scheduleSave();
  });
  document.getElementById('world-amount').addEventListener('input', (event) => {
    state.worldMotion.amount = Number(event.target.value); document.getElementById('world-amount-v').textContent = state.worldMotion.amount.toFixed(2); scheduleRender(); scheduleSave();
  });
  document.getElementById('camera-motion').addEventListener('change', (event) => { state.cameraMotion.type = event.target.value; scheduleRender(); scheduleSave(); });
  document.getElementById('camera-speed').addEventListener('input', (event) => {
    state.cameraMotion.speed = Number(event.target.value); document.getElementById('camera-speed-v').textContent = state.cameraMotion.speed.toFixed(2); scheduleRender(); scheduleSave();
  });
  document.getElementById('camera-amount').addEventListener('input', (event) => {
    state.cameraMotion.amount = Number(event.target.value); document.getElementById('camera-amount-v').textContent = state.cameraMotion.amount.toFixed(2); scheduleRender(); scheduleSave();
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    if (state.exporting) return;
    rebuildHitTriangles();
    const point = canvasPoint(event);
    const hitId = pickObject(point.x, point.y);
    pointerStart = { x: event.clientX, y: event.clientY }; pointerMoved = 0; pointerHitId = hitId;
    if (hitId && !event.shiftKey && event.button === 0 && !event.ctrlKey) {
      state.selectedId = hitId;
      refreshUi(); scheduleRender();
    }
    pointerMode = event.shiftKey && selectedObject()
      ? 'move'
      : ((event.button === 1 || event.button === 2 || event.ctrlKey) ? 'pan' : 'orbit');
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.toggle('moving', pointerMode === 'move' || pointerMode === 'pan');
    canvas.classList.toggle('dragging', pointerMode === 'orbit');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointerMode || !lastPointer) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    pointerMoved += Math.hypot(dx, dy);
    lastPointer = { x: event.clientX, y: event.clientY };
    if (pointerMode === 'move') {
      const object = selectedObject(); if (!object) return;
      const transform = baseTransformAt(object, state.currentTime);
      transform.position.x += dx * 0.012;
      transform.position.y -= dy * 0.012;
      setObjectBaseTransform(object, transform);
      refreshTransformControls();
    } else if (pointerMode === 'pan') {
      const camera = cameraAt(state.currentTime, false);
      panCameraByPixels(camera, dx, dy);
      setCameraBase(camera);
    } else {
      const camera = cameraAt(state.currentTime, false);
      camera.yaw += dx * 0.008;
      camera.pitch = Core.clamp(camera.pitch + dy * 0.008, -1.45, 1.45);
      setCameraBase(camera);
    }
  });
  function endPointer() {
    if (pointerMode === 'orbit' && pointerMoved < 5 && !pointerHitId) { state.selectedId = null; refreshUi(); scheduleRender(); scheduleSave(); }
    pointerMode = null; lastPointer = null; pointerStart = null; pointerHitId = null; pointerMoved = 0;
    canvas.classList.remove('moving', 'dragging');
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const camera = cameraAt(state.currentTime, false);
    camera.distance = Core.clamp(camera.distance + event.deltaY * 0.004, 1.2, 20);
    setCameraBase(camera);
  }, { passive: false });

  document.getElementById('reset-camera').addEventListener('click', () => {
    setCameraBase({ ...DEFAULT_CAMERA });
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
  document.getElementById('wireframe-toggle').addEventListener('click', () => {
    state.wireframe = !state.wireframe;
    document.getElementById('wireframe-toggle').textContent = `Wireframe: ${state.wireframe ? 'on' : 'off'}`;
    scheduleRender(); scheduleSave();
  });

  document.getElementById('load-current-world').addEventListener('click', () => {
    const world = Core.loadWorldDraft();
    if (!world) return showToast('There is no saved world in World Builder yet.');
    loadWorld(world); showToast('Current world loaded.');
  });
  document.getElementById('import-scene').addEventListener('click', () => document.getElementById('scene-file').click());
  document.getElementById('scene-file').addEventListener('change', async (event) => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    try { loadProject(JSON.parse(await file.text())); showToast('Scene imported.'); }
    catch (error) { showToast(error.message || 'Invalid file.'); }
  });
  document.getElementById('export-project').addEventListener('click', () => Core.downloadJson('studio-animation.scene.json', serialiseProject()));
  document.getElementById('export-aspect')?.addEventListener('change', resizeCanvas);
  document.getElementById('reset-animation').addEventListener('click', () => {
    if (!confirm('Clear all keyframes and procedural motion? Objects will remain in the scene.')) return;
    resetAnimationState();
  });
  document.getElementById('export-mp4').addEventListener('click', exportMp4);
  document.getElementById('export-webm').addEventListener('click', exportWebm);
  document.getElementById('export-gif').addEventListener('click', exportGif);

  window.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea')) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
    if (state.freeCamera) {
      const key = event.key.toLowerCase();
      const camera = cameraAt(state.currentTime, false);
      const amount = camera.distance * (event.shiftKey ? 0.18 : 0.06);
      let handled = true;
      if (key === 'w') moveCameraTarget(camera, 0, 0, amount);
      else if (key === 's') moveCameraTarget(camera, 0, 0, -amount);
      else if (key === 'a') moveCameraTarget(camera, -amount, 0, 0);
      else if (key === 'd') moveCameraTarget(camera, amount, 0, 0);
      else if (key === 'r') moveCameraTarget(camera, 0, amount, 0);
      else if (key === 'f') moveCameraTarget(camera, 0, -amount, 0);
      else handled = false;
      if (handled) {
        event.preventDefault();
        setCameraBase(camera);
        return;
      }
    }
    if (event.key === 'ArrowLeft') { stopPlayback(); setTime(state.currentTime - 1 / state.fps); }
    if (event.key === 'ArrowRight') { stopPlayback(); setTime(state.currentTime + 1 / state.fps); }
    if (event.key.toLowerCase() === 'k') document.getElementById('add-key').click();
  });
  window.addEventListener('resize', resizeCanvas);

  function initialise() {
    buildTransformControls();
    bindRangeNumberControls();
    bindRenderControls();
    const saved = loadSavedProject();
    const world = Core.loadWorldDraft();
    let importCurrentWorld = false;
    try {
      importCurrentWorld = localStorage.getItem(Core.STORAGE_KEYS.sceneImportWorld) === '1';
      localStorage.removeItem(Core.STORAGE_KEYS.sceneImportWorld);
    } catch { /* Optional hand-off marker. */ }
    try {
      if (importCurrentWorld && world) loadWorld(world);
      else if (saved) loadProject(saved);
      else if (world) loadWorld(world);
      else refreshUi();
    } catch (error) {
      console.error(error);
      refreshUi();
      showToast('The saved scene could not be loaded.');
    }
    resizeCanvas();
  }

  initialise();
})();
