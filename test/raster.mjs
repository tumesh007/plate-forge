/**
 * Minimal z-buffered triangle rasteriser. No GL, no browser.
 * Used to turn exported STLs into images for docs and listings.
 */
import fs from 'node:fs';

/**
 * @param {Array<{tris:Float32Array, color:number[]}>} parts
 * @param {number[]} eye
 * @param {number[]} target
 * @param {string} outPath
 * @param {object} [o]
 */
export function render(parts, eye, target, outPath, o = {}) {
  const W = o.width ?? 1200;
  const H = o.height ?? 800;
  const SS = o.ss ?? 2;
  const fov = ((o.fov ?? 26) * Math.PI) / 180;
  const w = W * SS;
  const h = H * SS;

  const color = new Float32Array(w * h * 3);
  const depth = new Float32Array(w * h).fill(Infinity);

  const bgTop = o.bgTop ?? [0.10, 0.13, 0.17];
  const bgBottom = o.bgBottom ?? [0.045, 0.055, 0.07];
  for (let y = 0; y < h; y++) {
    const t = y / h;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      for (let k = 0; k < 3; k++) color[i + k] = bgTop[k] + (bgBottom[k] - bgTop[k]) * t;
    }
  }

  const E = v3(...eye);
  const T = v3(...target);
  const zAxis = norm(sub(E, T));
  const xAxis = norm(cross([0, 1, 0], zAxis));
  const yAxis = norm(cross(zAxis, xAxis));
  const f = 1 / Math.tan(fov / 2);
  const aspect = w / h;

  const L1 = norm([0.45, 0.82, 0.55]);
  const L2 = norm([-0.6, 0.35, -0.4]);

  const project = (p) => {
    const d = sub(p, E);
    const cz = dot(d, zAxis);
    const wd = -cz;
    if (wd < 0.5) return null;
    const cx = dot(d, xAxis);
    const cy = dot(d, yAxis);
    return {
      sx: ((f * cx) / wd / aspect) * 0.5 * w + 0.5 * w,
      sy: 0.5 * h - ((f * cy) / wd) * 0.5 * h,
      iw: 1 / wd,
    };
  };

  for (const part of parts) {
    const t = part.tris;
    const base = part.color;
    const ink = part.inkColor;
    const inkZ = part.inkZ;
    for (let i = 0; i < t.length; i += 9) {
      const A = [t[i], t[i + 1], t[i + 2]];
      const B = [t[i + 3], t[i + 4], t[i + 5]];
      const C = [t[i + 6], t[i + 7], t[i + 8]];
      const n = norm(cross(sub(B, A), sub(C, A)));
      if (!isFinite(n[0])) continue;

      const shade = 0.17 + 0.72 * Math.abs(dot(n, L1)) + 0.22 * Math.abs(dot(n, L2));

      // optional: paint the recess floors as if filled with a marker
      let c = base;
      if (inkZ !== undefined && ink) {
        const flat = Math.abs(n[2]) > 0.9;
        if (
          flat &&
          Math.abs(A[2] - inkZ) < 0.06 &&
          Math.abs(B[2] - inkZ) < 0.06 &&
          Math.abs(C[2] - inkZ) < 0.06
        )
          c = ink;
      }

      const pa = project(A);
      const pb = project(B);
      const pc = project(C);
      if (!pa || !pb || !pc) continue;

      const minX = Math.max(0, Math.floor(Math.min(pa.sx, pb.sx, pc.sx)));
      const maxX = Math.min(w - 1, Math.ceil(Math.max(pa.sx, pb.sx, pc.sx)));
      const minY = Math.max(0, Math.floor(Math.min(pa.sy, pb.sy, pc.sy)));
      const maxY = Math.min(h - 1, Math.ceil(Math.max(pa.sy, pb.sy, pc.sy)));
      if (maxX < minX || maxY < minY) continue;

      const denom = (pb.sy - pc.sy) * (pa.sx - pc.sx) + (pc.sx - pb.sx) * (pa.sy - pc.sy);
      if (Math.abs(denom) < 1e-9) continue;
      const inv = 1 / denom;

      const r0 = c[0] * shade;
      const g0 = c[1] * shade;
      const b0 = c[2] * shade;

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((pb.sy - pc.sy) * (px - pc.sx) + (pc.sx - pb.sx) * (py - pc.sy)) * inv;
          const w1 = ((pc.sy - pa.sy) * (px - pc.sx) + (pa.sx - pc.sx) * (py - pc.sy)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const dd = 1 / (w0 * pa.iw + w1 * pb.iw + w2 * pc.iw);
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

  const out = Buffer.alloc(W * H * 3);
  const tm = (v) => Math.min(255, Math.round(255 * Math.pow(Math.max(0, v), 1 / 2.2)));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 3;
          r += color[i];
          g += color[i + 1];
          b += color[i + 2];
        }
      }
      const k = SS * SS;
      const o3 = (y * W + x) * 3;
      out[o3] = tm(r / k);
      out[o3 + 1] = tm(g / k);
      out[o3 + 2] = tm(b / k);
    }
  }
  fs.writeFileSync(outPath, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`, 'ascii'), out]));
  console.log('wrote', outPath);
}

/** Read a binary STL into a flat triangle soup. */
export function readSTL(path) {
  const b = fs.readFileSync(path);
  const n = b.readUInt32LE(80);
  const out = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    for (let k = 0; k < 9; k++) out[i * 9 + k] = b.readFloatLE(o + k * 4);
  }
  return out;
}

/* ---- tiny vector helpers ---- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const v3 = (x, y, z) => [x, y, z];
