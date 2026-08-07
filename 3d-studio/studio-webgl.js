(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function parseHexColor(value, fallback = [0.08, 0.12, 0.09]) {
    const text = String(value || '').trim();
    const rgb = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) return [clamp(Number(rgb[1]) / 255, 0, 1), clamp(Number(rgb[2]) / 255, 0, 1), clamp(Number(rgb[3]) / 255, 0, 1)];
    let hex = text.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((part) => part + part).join('');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback.slice();
    const number = parseInt(hex, 16);
    return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
  }

  function mat4Identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        out[column * 4 + row] =
          a[0 * 4 + row] * b[column * 4 + 0] +
          a[1 * 4 + row] * b[column * 4 + 1] +
          a[2 * 4 + row] * b[column * 4 + 2] +
          a[3 * 4 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }

  function mat4Translation(x, y, z) {
    const out = mat4Identity();
    out[12] = x; out[13] = y; out[14] = z;
    return out;
  }

  function mat4Scale(x, y, z) {
    const out = mat4Identity();
    out[0] = x; out[5] = y; out[10] = z;
    return out;
  }

  function mat4RotationX(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }

  function mat4RotationY(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }

  function mat4RotationZ(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function composeTransform(transform, scaleMultiplier = 1) {
    const position = transform?.position || { x: 0, y: 0, z: 0 };
    const rotation = transform?.rotation || { x: 0, y: 0, z: 0 };
    const scale = transform?.scale || { x: 1, y: 1, z: 1 };
    const radians = Math.PI / 180;
    let matrix = mat4Translation(Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
    matrix = mat4Multiply(matrix, mat4RotationZ((Number(rotation.z) || 0) * radians));
    matrix = mat4Multiply(matrix, mat4RotationY((Number(rotation.y) || 0) * radians));
    matrix = mat4Multiply(matrix, mat4RotationX((Number(rotation.x) || 0) * radians));
    matrix = mat4Multiply(matrix, mat4Scale(
      (Number(scale.x) || 1) * scaleMultiplier,
      (Number(scale.y) || 1) * scaleMultiplier,
      (Number(scale.z) || 1) * scaleMultiplier
    ));
    return matrix;
  }

  function flattenVec3(values) {
    const result = new Float32Array(values.length * 3);
    let cursor = 0;
    for (const value of values) {
      result[cursor++] = Number(value?.[0]) || 0;
      result[cursor++] = Number(value?.[1]) || 0;
      result[cursor++] = Number(value?.[2]) || 0;
    }
    return result;
  }

  function flattenVec2(values, count) {
    const result = new Float32Array(count * 2);
    let cursor = 0;
    for (let index = 0; index < count; index += 1) {
      const value = values?.[index] || [0, 0];
      result[cursor++] = Number(value[0]) || 0;
      result[cursor++] = Number(value[1]) || 0;
    }
    return result;
  }

  function flattenFaces(faces) {
    const result = new Uint32Array(faces.length * 3);
    let cursor = 0;
    for (const face of faces) {
      result[cursor++] = face[0]; result[cursor++] = face[1]; result[cursor++] = face[2];
    }
    return result;
  }

  function edgeIndices(faces) {
    const unique = new Set();
    const values = [];
    for (const face of faces) {
      for (let i = 0; i < 3; i += 1) {
        const a = face[i], b = face[(i + 1) % 3];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (unique.has(key)) continue;
        unique.add(key); values.push(a, b);
      }
    }
    return new Uint32Array(values);
  }

  function calculateNormals(vertices, faces) {
    const normals = new Float32Array(vertices.length * 3);
    for (const face of faces) {
      const ia = face[0], ib = face[1], ic = face[2];
      const a = vertices[ia], b = vertices[ib], c = vertices[ic];
      if (!a || !b || !c) continue;
      const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
      const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      for (const index of [ia, ib, ic]) {
        normals[index * 3] += nx;
        normals[index * 3 + 1] += ny;
        normals[index * 3 + 2] += nz;
      }
    }
    for (let index = 0; index < vertices.length; index += 1) {
      const offset = index * 3;
      const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) || 1;
      normals[offset] /= length; normals[offset + 1] /= length; normals[offset + 2] /= length;
    }
    return normals;
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Unknown WebGL shader error.';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex); gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Unknown WebGL link error.';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  const VERTEX_SHADER = `#version 300 es
    precision highp float;
    in vec3 aPosition;
    in vec3 aNormal;
    in vec2 aUv;
    uniform mat4 uModel;
    uniform vec2 uViewport;
    uniform float uPitch;
    uniform float uYaw;
    uniform float uDistance;
    uniform vec3 uTarget;
    uniform float uFocal;
    uniform float uNear;
    uniform float uFar;
    out vec3 vNormal;
    out vec3 vWorld;
    out vec3 vCameraPoint;
    out vec2 vUv;

    mat3 rotateX(float a) {
      float c = cos(a), s = sin(a);
      return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c);
    }
    mat3 rotateY(float a) {
      float c = cos(a), s = sin(a);
      return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c);
    }

    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vec3 cameraPoint = world.xyz - uTarget;
      mat3 cameraRotation = rotateY(uYaw) * rotateX(uPitch);
      cameraPoint = cameraRotation * cameraPoint;
      float depth = cameraPoint.z + uDistance;
      float safeDepth = max(depth, uNear * 0.25);
      float sx = 2.0 * uFocal / max(1.0, uViewport.x);
      float sy = 2.0 * uFocal / max(1.0, uViewport.y);
      float A = (uFar + uNear) / (uFar - uNear);
      float B = (-2.0 * uFar * uNear) / (uFar - uNear);
      gl_Position = vec4(cameraPoint.x * sx, cameraPoint.y * sy, A * safeDepth + B, safeDepth);

      mat3 normalMatrix = mat3(transpose(inverse(uModel)));
      vNormal = normalize(cameraRotation * normalMatrix * aNormal);
      vWorld = world.xyz;
      vCameraPoint = vec3(cameraPoint.xy, safeDepth);
      vUv = aUv;
    }
  `;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in vec3 vWorld;
    in vec3 vCameraPoint;
    in vec2 vUv;
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform vec3 uFlatColor;
    uniform float uFlatAlpha;
    uniform vec3 uLightDir;
    uniform float uScale;
    uniform float uRoughness;
    uniform float uAmbient;
    uniform float uLightIntensity;
    uniform float uExposure;
    uniform float uRim;
    uniform int uMaterialType;
    uniform int uRenderMode;
    uniform bool uHasTexture;
    uniform bool uSelected;
    uniform sampler2D uTexture;
    out vec4 outColor;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    vec3 materialColor() {
      float scale = max(0.01, uScale);
      if (uMaterialType == 1) {
        float cell = mod(floor(vUv.x * scale) + floor(vUv.y * scale), 2.0);
        return mix(uPrimary, uSecondary, cell);
      }
      if (uMaterialType == 2) {
        float stripe = mod(floor(vUv.x * scale), 2.0);
        return mix(uPrimary, uSecondary, stripe);
      }
      if (uMaterialType == 3) {
        float stripe = mod(floor((vWorld.y + 100.0) * scale), 2.0);
        return mix(uPrimary, uSecondary, stripe);
      }
      if (uMaterialType == 4) {
        float n = hash21(floor(vUv * scale * 12.0) / 12.0);
        return mix(uSecondary, uPrimary, smoothstep(0.42, 0.62, n));
      }
      if (uMaterialType == 5 && uHasTexture) {
        return texture(uTexture, fract(vUv * scale)).rgb;
      }
      return uPrimary;
    }

    vec3 filmic(vec3 color) {
      color *= max(0.05, uExposure);
      color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
      return pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
    }

    void main() {
      if (uRenderMode == 1) {
        outColor = vec4(uFlatColor, clamp(uFlatAlpha, 0.0, 1.0));
        return;
      }

      vec3 normal = normalize(vNormal);
      if (!gl_FrontFacing) normal = -normal;
      vec3 lightDir = normalize(uLightDir);
      vec3 viewDir = normalize(-vCameraPoint);
      float diffuse = max(dot(normal, lightDir), 0.0);
      float hemi = 0.5 + 0.5 * normal.y;
      float roughness = clamp(uRoughness, 0.0, 1.0);
      vec3 halfDir = normalize(lightDir + viewDir);
      float shininess = mix(96.0, 7.0, roughness);
      float specular = pow(max(dot(normal, halfDir), 0.0), shininess) * (1.0 - roughness) * 0.7;
      float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5) * uRim;
      vec3 base = materialColor();
      float light = uAmbient + hemi * 0.16 + diffuse * uLightIntensity;
      vec3 color = base * light + vec3(specular) + base * rim;
      if (uSelected) color += vec3(0.055, 0.12, 0.075);
      outColor = vec4(filmic(color), 1.0);
    }
  `;

  class Renderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.onInvalidate = typeof options.onInvalidate === 'function' ? options.onInvalidate : () => {};
      this.available = false;
      this.error = null;
      this.geometryCache = new WeakMap();
      this.textureCache = new Map();
      this.canvasTextureCache = new WeakMap();
      this.frame = 0;
      this.stats = { drawCalls: 0, triangles: 0, vertices: 0 };

      try {
        const gl = canvas.getContext('webgl2', {
          alpha: false,
          antialias: true,
          depth: true,
          stencil: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance'
        });
        if (!gl) throw new Error('WebGL2 is not available in this browser.');
        this.gl = gl;
        this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
        this.locations = this.resolveLocations();
        this.grid = this.createGridBuffers();
        this.whiteTexture = this.createWhiteTexture();
        this.available = true;
      } catch (error) {
        this.error = error;
        console.warn('Studio WebGL renderer unavailable:', error);
      }
    }

    resolveLocations() {
      const gl = this.gl, program = this.program;
      const attribute = (name) => gl.getAttribLocation(program, name);
      const uniform = (name) => gl.getUniformLocation(program, name);
      return {
        aPosition: attribute('aPosition'), aNormal: attribute('aNormal'), aUv: attribute('aUv'),
        uModel: uniform('uModel'), uViewport: uniform('uViewport'), uPitch: uniform('uPitch'), uYaw: uniform('uYaw'),
        uDistance: uniform('uDistance'), uTarget: uniform('uTarget'), uFocal: uniform('uFocal'), uNear: uniform('uNear'), uFar: uniform('uFar'),
        uPrimary: uniform('uPrimary'), uSecondary: uniform('uSecondary'), uFlatColor: uniform('uFlatColor'), uFlatAlpha: uniform('uFlatAlpha'), uLightDir: uniform('uLightDir'),
        uScale: uniform('uScale'), uRoughness: uniform('uRoughness'), uAmbient: uniform('uAmbient'), uLightIntensity: uniform('uLightIntensity'),
        uExposure: uniform('uExposure'), uRim: uniform('uRim'), uMaterialType: uniform('uMaterialType'), uRenderMode: uniform('uRenderMode'),
        uHasTexture: uniform('uHasTexture'), uSelected: uniform('uSelected'), uTexture: uniform('uTexture')
      };
    }

    createWhiteTexture() {
      const gl = this.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return texture;
    }

    createGridBuffers() {
      const gl = this.gl;
      const minor = [], major = [];
      const radius = 12;
      for (let line = -radius; line <= radius; line += 1) {
        const target = line % 5 === 0 ? major : minor;
        target.push(-radius, 0, line, radius, 0, line, line, 0, -radius, line, 0, radius);
      }
      const make = (data) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        return { buffer, count: data.length / 3 };
      };
      return { minor: make(minor), major: make(major) };
    }

    ensureGeometry(asset, vertices, revision = null) {
      const gl = this.gl;
      let cache = this.geometryCache.get(asset);
      if (!cache) {
        cache = {
          position: gl.createBuffer(), normal: gl.createBuffer(), uv: gl.createBuffer(),
          triangles: gl.createBuffer(), edges: gl.createBuffer(),
          verticesRef: null, revision: null, vertexCount: 0, triangleIndexCount: 0, edgeIndexCount: 0
        };
        const triangles = flattenFaces(asset.faces || []);
        const edges = edgeIndices(asset.faces || []);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cache.triangles);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangles, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cache.edges);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edges, gl.STATIC_DRAW);
        const uvs = flattenVec2(asset.uvs, asset.vertices.length);
        gl.bindBuffer(gl.ARRAY_BUFFER, cache.uv);
        gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
        cache.triangleIndexCount = triangles.length;
        cache.edgeIndexCount = edges.length;
        this.geometryCache.set(asset, cache);
      }

      if (cache.verticesRef !== vertices || cache.revision !== revision) {
        const positions = flattenVec3(vertices);
        const normals = calculateNormals(vertices, asset.faces || []);
        gl.bindBuffer(gl.ARRAY_BUFFER, cache.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, cache.normal);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.DYNAMIC_DRAW);
        cache.verticesRef = vertices;
        cache.revision = revision;
        cache.vertexCount = vertices.length;
      }
      return cache;
    }

    bindGeometry(cache, elementBuffer) {
      const gl = this.gl, loc = this.locations;
      gl.bindBuffer(gl.ARRAY_BUFFER, cache.position);
      gl.enableVertexAttribArray(loc.aPosition);
      gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, cache.normal);
      gl.enableVertexAttribArray(loc.aNormal);
      gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, cache.uv);
      gl.enableVertexAttribArray(loc.aUv);
      gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
    }

    textureFromDataUrl(dataUrl) {
      const gl = this.gl;
      if (!dataUrl) return { texture: this.whiteTexture, ready: false };
      const existing = this.textureCache.get(dataUrl);
      if (existing) { existing.lastUsed = this.frame; return existing; }

      const entry = { texture: gl.createTexture(), ready: false, lastUsed: this.frame, promise: null };
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([90, 120, 95, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      this.textureCache.set(dataUrl, entry);

      const image = new Image();
      entry.promise = new Promise((resolve) => {
      image.onload = () => {
        try {
          gl.bindTexture(gl.TEXTURE_2D, entry.texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          entry.ready = true;
          this.onInvalidate();
          resolve(true);
        } catch (error) {
          console.warn('Could not upload Studio texture to WebGL.', error);
          resolve(false);
        }
      };
      image.onerror = () => { entry.ready = false; resolve(false); };
      image.src = dataUrl;
      });
      return entry;
    }

    textureFromCanvas(canvas) {
      const gl = this.gl;
      let entry = this.canvasTextureCache.get(canvas);
      if (!entry) {
        entry = { texture: gl.createTexture(), ready: true };
        this.canvasTextureCache.set(canvas, entry);
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      }
      try {
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      } catch (error) {
        console.warn('Could not upload live Studio canvas texture.', error);
      }
      return entry;
    }

    bindTexture(source) {
      const gl = this.gl;
      let entry;
      if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) entry = this.textureFromCanvas(source);
      else entry = this.textureFromDataUrl(typeof source === 'string' ? source : null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture || this.whiteTexture);
      gl.uniform1i(this.locations.uTexture, 0);
      return Boolean(entry.ready);
    }

    setCameraUniforms(camera, settings) {
      const gl = this.gl, loc = this.locations;
      const width = Math.max(1, this.canvas.width), height = Math.max(1, this.canvas.height);
      const focalMultiplier = Number(settings.focalMultiplier) || 0.82;
      gl.uniform2f(loc.uViewport, width, height);
      gl.uniform1f(loc.uPitch, Number(camera?.pitch) || 0);
      gl.uniform1f(loc.uYaw, Number(camera?.yaw) || 0);
      gl.uniform1f(loc.uDistance, Math.max(0.1, Number(camera?.distance) || 6));
      gl.uniform3f(loc.uTarget, Number(camera?.targetX) || 0, Number(camera?.targetY) || 0, Number(camera?.targetZ) || 0);
      gl.uniform1f(loc.uFocal, Math.min(width, height) * focalMultiplier);
      gl.uniform1f(loc.uNear, 0.035);
      gl.uniform1f(loc.uFar, Math.max(80, (Number(camera?.distance) || 6) + 60));

      const azimuth = (Number(settings.lightAzimuth) || -42) * Math.PI / 180;
      const elevation = (Number(settings.lightElevation) || 55) * Math.PI / 180;
      let light = {
        x: Math.cos(elevation) * Math.cos(azimuth),
        y: Math.sin(elevation),
        z: Math.cos(elevation) * Math.sin(azimuth)
      };
      const pitch = Number(camera?.pitch) || 0, yaw = Number(camera?.yaw) || 0;
      const cx = Math.cos(pitch), sx = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const afterX = { x: light.x, y: light.y * cx - light.z * sx, z: light.y * sx + light.z * cx };
      light = { x: afterX.x * cy + afterX.z * sy, y: afterX.y, z: -afterX.x * sy + afterX.z * cy };
      gl.uniform3f(loc.uLightDir, light.x, light.y, light.z);
      gl.uniform1f(loc.uAmbient, clamp(Number(settings.ambient) || 0.34, 0, 2));
      gl.uniform1f(loc.uLightIntensity, clamp(Number(settings.lightIntensity) || 1.15, 0, 4));
      gl.uniform1f(loc.uExposure, clamp(Number(settings.exposure) || 1.08, 0.1, 4));
      gl.uniform1f(loc.uRim, clamp(Number(settings.rim) || 0.18, 0, 2));
    }

    setMaterialUniforms(material, object, settings) {
      const gl = this.gl, loc = this.locations;
      const primary = parseHexColor(material?.primary || '#50d08a');
      const secondary = parseHexColor(material?.secondary || '#173b24');
      const typeMap = { solid: 0, checker: 1, stripes: 2, contour: 3, noise: 4, image: 5 };
      gl.uniform3fv(loc.uPrimary, primary);
      gl.uniform3fv(loc.uSecondary, secondary);
      gl.uniform1f(loc.uScale, Math.max(0.01, Number(material?.scale) || 1));
      gl.uniform1f(loc.uRoughness, clamp(Number(material?.roughness) || 0.55, 0, 1));
      gl.uniform1i(loc.uMaterialType, typeMap[material?.type] ?? 0);
      const textureSource = object?.__textureSource || material?.textureData || null;
      const ready = this.bindTexture(textureSource);
      gl.uniform1i(loc.uHasTexture, ready && material?.type === 'image' ? 1 : 0);
      gl.uniform1i(loc.uSelected, object?.id === settings.selectedId ? 1 : 0);
    }

    drawGrid(camera, settings) {
      if (settings.grid === false) return;
      const gl = this.gl, loc = this.locations;
      gl.uniformMatrix4fv(loc.uModel, false, mat4Identity());
      gl.uniform1i(loc.uRenderMode, 1);
      gl.uniform1i(loc.uHasTexture, 0);
      gl.uniform1i(loc.uSelected, 0);
      gl.disableVertexAttribArray(loc.aNormal);
      gl.vertexAttrib3f(loc.aNormal, 0, 1, 0);
      gl.disableVertexAttribArray(loc.aUv);
      gl.vertexAttrib2f(loc.aUv, 0, 0);
      gl.enableVertexAttribArray(loc.aPosition);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const draw = (entry, color, alpha) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, entry.buffer);
        gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.uniform3fv(loc.uFlatColor, color);
        gl.uniform1f(loc.uFlatAlpha, alpha);
        gl.drawArrays(gl.LINES, 0, entry.count);
        this.stats.drawCalls += 1;
      };
      draw(this.grid.minor, parseHexColor(settings.gridMinor || '#173021'), clamp(Number(settings.gridMinorAlpha ?? 0.18), 0, 1));
      draw(this.grid.major, parseHexColor(settings.gridMajor || '#2b5b3b'), clamp(Number(settings.gridMajorAlpha ?? 0.38), 0, 1));
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }

    render(objects, camera, options = {}) {
      if (!this.available) return false;
      this.frame += 1;
      this.stats = { drawCalls: 0, triangles: 0, vertices: 0 };
      const gl = this.gl;
      const settings = {
        background: '#080b09', grid: true, selectedId: null, wireframe: false,
        exposure: 1.08, ambient: 0.34, lightIntensity: 1.15, lightAzimuth: -42, lightElevation: 55, rim: 0.18,
        ...options
      };
      const background = parseHexColor(settings.background, [0.03, 0.045, 0.035]);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(background[0], background[1], background[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.useProgram(this.program);
      this.setCameraUniforms(camera || {}, settings);
      this.drawGrid(camera, settings);

      const prepared = [];
      for (let index = 0; index < (objects || []).length; index += 1) {
        const object = objects[index];
        if (!object?.asset?.vertices?.length || !object.asset.faces?.length) continue;
        const vertices = typeof settings.getVertices === 'function' ? (settings.getVertices(object, index) || object.asset.vertices) : (object.__renderVertices || object.asset.vertices);
        const revision = typeof settings.getGeometryRevision === 'function' ? settings.getGeometryRevision(object, index) : object.__geometryRevision;
        const geometry = this.ensureGeometry(object.asset, vertices, revision);
        const transform = typeof settings.getTransform === 'function' ? (settings.getTransform(object, index) || object.transform) : object.transform;
        prepared.push({ object, geometry, transform });
        this.stats.vertices += geometry.vertexCount;
        this.stats.triangles += geometry.triangleIndexCount / 3;
      }

      // Opaque shaded pass.
      for (const item of prepared) {
        const { object, geometry, transform } = item;
        gl.uniformMatrix4fv(this.locations.uModel, false, composeTransform(transform));
        gl.uniform1i(this.locations.uRenderMode, 0);
        this.setMaterialUniforms(object.material || {}, object, settings);
        this.bindGeometry(geometry, geometry.triangles);
        gl.drawElements(gl.TRIANGLES, geometry.triangleIndexCount, gl.UNSIGNED_INT, 0);
        this.stats.drawCalls += 1;
      }

      // Silhouette outline for the selected object. It is intentionally subtle so dense meshes stay readable.
      const selected = prepared.find((item) => item.object.id === settings.selectedId);
      if (selected) {
        gl.enable(gl.CULL_FACE);
        // Studio meshes use the opposite projected winding from the conventional outline recipe.
        // Cull the visible shell so the slightly enlarged back shell only peeks around the silhouette.
        gl.cullFace(gl.BACK);
        gl.depthMask(false);
        gl.uniformMatrix4fv(this.locations.uModel, false, composeTransform(selected.transform, 1.025));
        gl.uniform1i(this.locations.uRenderMode, 1);
        gl.uniform3fv(this.locations.uFlatColor, parseHexColor(settings.selectionColor || '#72f0a0'));
        gl.uniform1f(this.locations.uFlatAlpha, 1);
        this.bindGeometry(selected.geometry, selected.geometry.triangles);
        gl.drawElements(gl.TRIANGLES, selected.geometry.triangleIndexCount, gl.UNSIGNED_INT, 0);
        this.stats.drawCalls += 1;
        gl.depthMask(true);
        gl.disable(gl.CULL_FACE);
      }

      // Optional topology overlay. Selection remains a clean silhouette when wireframe is off.
      if (settings.wireframe) {
        gl.uniform1i(this.locations.uRenderMode, 1);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        for (const item of prepared) {
          const isSelected = item.object.id === settings.selectedId;
          gl.uniformMatrix4fv(this.locations.uModel, false, composeTransform(item.transform));
          gl.uniform3fv(this.locations.uFlatColor, parseHexColor(isSelected ? (settings.selectionWire || '#a9ffc0') : (settings.wireColor || '#102417')));
          gl.uniform1f(this.locations.uFlatAlpha, isSelected ? 0.58 : 0.36);
          this.bindGeometry(item.geometry, item.geometry.edges);
          gl.drawElements(gl.LINES, item.geometry.edgeIndexCount, gl.UNSIGNED_INT, 0);
          this.stats.drawCalls += 1;
        }
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }

      this.pruneTextures();
      gl.flush();
      return true;
    }

    async prepareTextures(objects) {
      const promises = [];
      for (const object of objects || []) {
        const source = object?.__textureSource || object?.material?.textureData;
        if (typeof source !== 'string' || !source) continue;
        const entry = this.textureFromDataUrl(source);
        if (entry.promise) promises.push(entry.promise);
      }
      if (promises.length) await Promise.allSettled(promises);
    }

    readPixels() {
      if (!this.available) return null;
      const gl = this.gl;
      const width = this.canvas.width, height = this.canvas.height;
      const raw = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      const data = new Uint8ClampedArray(raw.length);
      const stride = width * 4;
      for (let y = 0; y < height; y += 1) {
        data.set(raw.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
      }
      return { data, width, height };
    }

    pruneTextures() {
      if (this.textureCache.size < 48) return;
      const gl = this.gl;
      const entries = [...this.textureCache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [key, entry] of entries.slice(0, Math.max(0, entries.length - 36))) {
        gl.deleteTexture(entry.texture);
        this.textureCache.delete(key);
      }
    }

    getStats() { return { ...this.stats }; }
  }

  function createRenderer(canvas, options) { return new Renderer(canvas, options); }

  global.StudioWebGL = Object.freeze({ createRenderer, Renderer, composeTransform, calculateNormals, parseHexColor, TAU });
})(window);
