(function (global) {
  'use strict';
  const Core = global.StudioCore;
  if (!Core) throw new Error('studio-core.js must be loaded before studio-fractals.js');
  const clamp = Core.clamp;
  const standardise = (raw) => Core.standardiseAsset(raw, { normalise: true, targetRadius: 1 });

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (v, amount) => [v[0] * amount, v[1] * amount, v[2] * amount];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalise = (v, fallback = [0, 1, 0]) => {
    const length = Math.hypot(v[0], v[1], v[2]);
    return length > 1e-8 ? [v[0] / length, v[1] / length, v[2] / length] : fallback.slice();
  };

  function basisFrom(direction) {
    const forward = normalise(direction);
    const reference = Math.abs(forward[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
    const right = normalise(cross(forward, reference), [1, 0, 0]);
    const up = normalise(cross(right, forward), [0, 0, 1]);
    return { forward, right, up };
  }

  function addTube(vertices, faces, start, end, radiusStart, radiusEnd, segments = 8) {
    const direction = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
    const { right, up } = basisFrom(direction);
    const base = vertices.length;
    for (let ring = 0; ring < 2; ring += 1) {
      const center = ring ? end : start;
      const radius = ring ? radiusEnd : radiusStart;
      for (let index = 0; index < segments; index += 1) {
        const angle = index / segments * Math.PI * 2;
        const offset = add(scale(right, Math.cos(angle) * radius), scale(up, Math.sin(angle) * radius));
        vertices.push(add(center, offset));
      }
    }
    const startCenter = vertices.length;
    vertices.push(start);
    const endCenter = vertices.length;
    vertices.push(end);
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      const a = base + index, b = base + next, c = base + segments + next, d = base + segments + index;
      faces.push([a, b, c], [a, c, d], [startCenter, b, a], [endCenter, d, c]);
    }
  }

  function childDirection(direction, spread, twist) {
    const { forward, right, up } = basisFrom(direction);
    return normalise(add(scale(forward, Math.cos(spread)), add(scale(right, Math.cos(twist) * Math.sin(spread)), scale(up, Math.sin(twist) * Math.sin(spread)))));
  }

  function createTree(options = {}) {
    const depth = clamp(Math.round(Number(options.depth) || 7), 1, 10);
    const spread = clamp(Number(options.angleDeg) || 32, 8, 72) * Math.PI / 180;
    const lengthScale = clamp(Number(options.lengthScale) || 0.68, 0.45, 0.86);
    const thickness = clamp(Number(options.thickness) || 0.04, 0.006, 0.12);
    const vertices = [], faces = [];

    function branch(start, direction, length, level, radius, twistSeed) {
      const end = add(start, scale(direction, length));
      addTube(vertices, faces, start, end, radius, radius * 0.66, 9);
      if (level <= 1) return;
      const nextLength = length * lengthScale;
      const nextRadius = radius * 0.66;
      const twist = twistSeed + level * 0.74;
      branch(end, childDirection(direction, spread, twist), nextLength, level - 1, nextRadius, twistSeed + 1.91);
      branch(end, childDirection(direction, spread * 0.92, twist + Math.PI * 0.92), nextLength * 0.96, level - 1, nextRadius * 0.94, twistSeed + 2.47);
      if (level > 4) branch(end, childDirection(direction, spread * 0.55, twist + Math.PI * 1.72), nextLength * 0.72, level - 2, nextRadius * 0.72, twistSeed + 3.16);
    }

    branch([0, -1, 0], [0, 1, 0], 1.15, depth, thickness, 0.35);
    return standardise({ name:'Fractal Tree', type:'fractal-tree', vertices, faces, metadata:{ material:{type:'contour',primary:'#7de6b1',secondary:'#173b24',scale:12,roughness:.7}, fractal:{kind:'tree-3d',depth,angleDeg:spread*180/Math.PI,lengthScale,thickness} } });
  }

  function rotateAroundY(point, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    return [point[0] * cosine + point[2] * sine, point[1], -point[0] * sine + point[2] * cosine];
  }

  function addLeaflet(vertices, faces, center, side, up, normal, length, width) {
    const base = vertices.length;
    const tip = add(center, scale(side, length));
    const root = add(center, scale(side, -length * 0.16));
    vertices.push(
      add(tip, scale(normal, width * 0.08)),
      add(root, add(scale(up, width), scale(normal, -width * 0.05))),
      add(root, add(scale(up, -width), scale(normal, width * 0.05))),
      add(center, scale(normal, width * 0.18))
    );
    faces.push([base, base + 1, base + 3], [base, base + 3, base + 2]);
  }

  function createFern(options = {}) {
    const points = clamp(Math.round(Number(options.points) || 3600), 600, 9000);
    const leafSize = clamp(Number(options.leafSize) || 0.018, 0.004, 0.05);
    const curl = clamp(Number(options.curl) || 0.25, -1, 1);
    const vertices = [], faces = [];
    const fronds = clamp(Math.round(12 + points / 520), 14, 28);
    const height = 1.75;
    const stemRadius = Math.max(leafSize * 0.55, 0.012);
    const stemPoints = [];

    for (let i = 0; i <= fronds; i += 1) {
      const t = i / fronds;
      const y = -0.95 + t * height;
      const bend = Math.sin(t * Math.PI * 0.9) * curl * 0.22;
      const twist = t * curl * Math.PI * 0.9;
      stemPoints.push([Math.sin(twist) * bend, y, Math.cos(twist) * bend * 0.55]);
    }
    for (let i = 0; i < stemPoints.length - 1; i += 1) {
      const t = i / Math.max(1, stemPoints.length - 2);
      addTube(vertices, faces, stemPoints[i], stemPoints[i + 1], stemRadius * (1 - t * 0.58), stemRadius * (1 - (t + 1 / fronds) * 0.58), 8);
    }

    for (let i = 2; i < fronds; i += 1) {
      const t = i / fronds;
      const center = stemPoints[i];
      const tangent = normalise([stemPoints[i + 1][0] - stemPoints[i - 1][0], stemPoints[i + 1][1] - stemPoints[i - 1][1], stemPoints[i + 1][2] - stemPoints[i - 1][2]], [0, 1, 0]);
      const baseAngle = i * 1.72 + curl * t * 1.4;
      const leftRight = i % 2 === 0 ? 1 : -1;
      const side = normalise(rotateAroundY([leftRight, 0.12 + t * 0.18, 0.18 * curl], baseAngle));
      const normal = normalise(cross(side, tangent), [0, 0, 1]);
      const up = normalise(cross(normal, side), [0, 1, 0]);
      const frondLength = (0.42 * (1 - t * 0.55) + 0.05) * (0.85 + Math.abs(curl) * 0.25);
      const tip = add(center, scale(side, frondLength));
      addTube(vertices, faces, center, tip, stemRadius * 0.42, stemRadius * 0.12, 6);

      const leafletCount = Math.max(4, Math.round(5 + frondLength * 18));
      for (let j = 1; j <= leafletCount; j += 1) {
        const p = j / (leafletCount + 1);
        const base = add(center, scale(side, frondLength * p));
        const localWidth = leafSize * (1.1 - p * 0.55) * (1 - t * 0.2);
        const localLength = leafSize * (3.2 - p * 1.15) * (1 - t * 0.15);
        const leafletSideA = normalise(add(scale(side, 0.35), scale(up, 0.94)));
        const leafletSideB = normalise(add(scale(side, 0.35), scale(up, -0.94)));
        addLeaflet(vertices, faces, add(base, scale(normal, localWidth * 0.22)), leafletSideA, normal, up, localLength, localWidth);
        addLeaflet(vertices, faces, add(base, scale(normal, -localWidth * 0.22)), leafletSideB, normal, up, localLength, localWidth);
      }
    }

    return standardise({ name:'Fractal Fern', type:'fractal-fern', vertices, faces, metadata:{ material:{type:'noise',primary:'#77e39b',secondary:'#0e2a18',scale:18,roughness:.78}, fractal:{kind:'fern-3d-frond',points,leafSize,curl} } });
  }
  global.StudioFractals = Object.freeze({ createTree, createFern });
})(window);

