/**
 * Offline rasteriser. Renders the model to a PPM so the shape can be eyeballed
 * without a browser.  node plate-forge/test/render.mjs
 */
import * as THREE from 'three';
import { buildPanel, buildStand, buildInk, derive, seatPanel, DEFAULT_PARAMS } from '../js/model.js';
import { collectTriangles } from '../js/stl.js';
import fs from 'node:fs';

const P = { ...DEFAULT_PARAMS };

const W = 1200;
const H = 800;
const SS = 2; // supersample

function gather(root) {
  return collectTriangles(root);
}

function toWorldTris(tris, matrix) {
  const out = new Float32Array(tris.length);
  const v = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 3) {
    v.set(tris[i], tris[i + 1], tris[i + 2]).applyMatrix4(matrix);
    out[i] = v.x;
    out[i + 1] = v.y;
    out[i + 2] = v.z;
  }
  return out;
}

function render(sceneTris, eye, target, outPath) {
  const w = W * SS;
  const h = H * SS;
  const color = new Float32Array(w * h * 3);
  const depth = new Float32Array(w * h).fill(Infinity);

  // background gradient
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = 0.055 + 0.03 * (1 - t);
    const g = 0.07 + 0.04 * (1 - t);
    const b = 0.09 + 0.06 * (1 - t);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      color[i] = r;
      color[i + 1] = g;
      color[i + 2] = b;
    }
  }

  const E = new THREE.Vector3(...eye);
  const T = new THREE.Vector3(...target);
  const up = new THREE.Vector3(0, 1, 0);
  const zAxis = E.clone().sub(T).normalize();
  const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const fov = (26 * Math.PI) / 180;
  const f = 1 / Math.tan(fov / 2);
  const aspect = w / h;

  const light = new THREE.Vector3(0.45, 0.82, 0.55).normalize();
  const light2 = new THREE.Vector3(-0.6, 0.35, -0.4).normalize();

  const proj = (p) => {
    const dx = p.x - E.x;
    const dy = p.y - E.y;
    const dz = p.z - E.z;
    const cx = dx * xAxis.x + dy * xAxis.y + dz * xAxis.z;
    const cy = dx * yAxis.x + dy * yAxis.y + dz * yAxis.z;
    const cz = dx * zAxis.x + dy * zAxis.y + dz * zAxis.z;
    const wDepth = -cz;
    if (wDepth < 0.5) return null;
    const ndcx = (f * cx) / wDepth / aspect;
    const ndcy = (f * cy) / wDepth;
    return {
      sx: (ndcx * 0.5 + 0.5) * w,
      sy: (0.5 - ndcy * 0.5) * h,
      iw: 1 / wDepth,
    };
  };

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();

  for (const obj of sceneTris) {
    const t = obj.tris;
    for (let i = 0; i < t.length; i += 9) {
      a.set(t[i], t[i + 1], t[i + 2]);
      b.set(t[i + 3], t[i + 4], t[i + 5]);
      c.set(t[i + 6], t[i + 7], t[i + 8]);
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      n.crossVectors(e1, e2);
      const len = n.length();
      if (len < 1e-9) continue;
      n.divideScalar(len);

      // two-sided lighting
      const nl = Math.abs(n.dot(light));
      const nl2 = Math.abs(n.dot(light2));
      const shade = 0.16 + 0.72 * nl + 0.22 * nl2;

      const pa = proj(a);
      const pb = proj(b);
      const pc = proj(c);
      if (!pa || !pb || !pc) continue;

      const minX = Math.max(0, Math.floor(Math.min(pa.sx, pb.sx, pc.sx)));
      const maxX = Math.min(w - 1, Math.ceil(Math.max(pa.sx, pb.sx, pc.sx)));
      const minY = Math.max(0, Math.floor(Math.min(pa.sy, pb.sy, pc.sy)));
      const maxY = Math.min(h - 1, Math.ceil(Math.max(pa.sy, pb.sy, pc.sy)));
      if (maxX < minX || maxY < minY) continue;

      const denom =
        (pb.sy - pc.sy) * (pa.sx - pc.sx) + (pc.sx - pb.sx) * (pa.sy - pc.sy);
      if (Math.abs(denom) < 1e-9) continue;
      const inv = 1 / denom;

      const base = obj.color;
      const r0 = base[0] * shade;
      const g0 = base[1] * shade;
      const b0 = base[2] * shade;

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 =
            ((pb.sy - pc.sy) * (px - pc.sx) + (pc.sx - pb.sx) * (py - pc.sy)) * inv;
          const w1 =
            ((pc.sy - pa.sy) * (px - pc.sx) + (pa.sx - pc.sx) * (py - pc.sy)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const iw = w0 * pa.iw + w1 * pb.iw + w2 * pc.iw;
          const dd = 1 / iw;
          const idx = y * w + x;
          if (dd >= depth[idx]) continue;
          depth[idx] = dd;
          const ci = idx * 3;
          color[ci] = r0;
          color[ci + 1] = g0;
          color[ci + 2] = b0;
        }
      }
    }
  }

  // downsample + tone map
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let bl = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 3;
          r += color[i];
          g += color[i + 1];
          bl += color[i + 2];
        }
      }
      const k = SS * SS;
      const tm = (v) => Math.min(255, Math.round(255 * Math.pow(v / k, 1 / 2.2)));
      const o = (y * W + x) * 3;
      out[o] = tm(r);
      out[o + 1] = tm(g);
      out[o + 2] = tm(bl);
    }
  }
  const header = Buffer.from(`P6\n${W} ${H}\n255\n`, 'ascii');
  fs.writeFileSync(outPath, Buffer.concat([header, out]));
  console.log('wrote', outPath);
}

const d = derive(P);
const WHITE = [0.93, 0.93, 0.9];
const INK = [0.06, 0.06, 0.07];

const stand = { tris: gather(buildStand(P)), color: WHITE };

// assembled
const panel = buildPanel(P);
const ink = buildInk(P);
seatPanel(panel, P);
panel.updateMatrixWorld(true);
const panelTris = toWorldTris(gather(panel), panel.matrixWorld);
const inkMatrix = new THREE.Matrix4().compose(panel.position, panel.quaternion, new THREE.Vector3(1, 1, 1));
const inkTris = toWorldTris(gather(ink), inkMatrix);

render(
  [
    stand,
    { tris: panelTris, color: WHITE },
    { tris: inkTris, color: INK },
  ],
  [250, 165, 300],
  [0, 20, -8],
  'plate-forge/test/assembled.ppm',
);

// as printed
const flatPanel = buildPanel(P);
flatPanel.rotation.x = -Math.PI / 2;
flatPanel.position.set(d.width / 2 + 14, 0, d.height / 2);
flatPanel.updateMatrixWorld(true);
const flatTris = gather(flatPanel);
const flatInk = buildInk(P);
flatInk.rotation.x = -Math.PI / 2;
flatInk.position.copy(flatPanel.position);
flatInk.updateMatrixWorld(true);

render(
  [
    { tris: toWorldTris(stand.tris, new THREE.Matrix4()), color: WHITE },
    { tris: flatTris, color: WHITE },
    { tris: gather(flatInk), color: INK },
  ],
  [110, 210, 250],
  [0, 14, 0],
  'plate-forge/test/printed.ppm',
);

// front on, panel only — the view that shows whether the number is legible
const solo = buildPanel(P);
solo.position.set(0, 0, 0);
solo.updateMatrixWorld(true);
const soloInk = buildInk(P);
soloInk.updateMatrixWorld(true);
render(
  [
    { tris: gather(solo), color: WHITE },
    { tris: gather(soloInk), color: INK },
  ],
  [-38, 26, 190],
  [0, 15, 0],
  'plate-forge/test/front.ppm',
);

// zoom on the first three digits, with and without the pen preview
render([{ tris: gather(solo), color: WHITE }], [-50, 16, 78], [-50, 14, 0], 'plate-forge/test/zoom-bare.ppm');
render(
  [
    { tris: gather(solo), color: WHITE },
    { tris: gather(soloInk), color: INK },
  ],
  [-50, 16, 78],
  [-50, 14, 0],
  'plate-forge/test/zoom-ink.ppm',
);

