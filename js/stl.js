/** Binary STL writer + mesh maths. No dependencies. */
import * as THREE from 'three';

/**
 * Collect every triangle under `root` as a flat Float32Array of 9 floats per
 * triangle, already baked with world matrices.
 */
export function collectTriangles(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;
    const idx = geo.index;
    const v = new THREE.Vector3();
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) {
      const j = idx ? idx.getX(i) : i;
      v.fromBufferAttribute(pos, j).applyMatrix4(o.matrixWorld);
      out.push(v.x, v.y, v.z);
    }
  });
  return new Float32Array(out);
}

/** Signed volume of a closed triangle soup, in mm^3. */
export function meshVolume(tris) {
  let vol = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cross = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 9) {
    a.set(tris[i], tris[i + 1], tris[i + 2]);
    b.set(tris[i + 3], tris[i + 4], tris[i + 5]);
    c.set(tris[i + 6], tris[i + 7], tris[i + 8]);
    cross.crossVectors(b, c);
    vol += a.dot(cross) / 6;
  }
  return Math.abs(vol);
}

/**
 * Re-orient a triangle soup into slicer space: Z up, sitting on z = 0, centred in
 * x/y.
 *
 * Two source conventions exist here:
 *   'flat'  the model's z axis is the thickness, so it is already lying on the bed
 *           (the number panel — print the back face down)
 *   'upright' the model's y axis is up, so it is already standing as it will print
 *           (the easel)
 */
export function toPrintSpace(tris, mode = 'upright') {
  const out = new Float32Array(tris.length);
  let minX = Infinity;
  let maxX = -Infinity;
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;

  for (let i = 0; i < tris.length; i += 3) {
    const x = tris[i];
    // 'upright': up = +y, depth = -z.   'flat': up = +z, depth = +y.
    const a = mode === 'upright' ? tris[i + 1] : tris[i + 2];
    const b = mode === 'upright' ? -tris[i + 2] : tris[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
    if (b < minB) minB = b;
  }

  const cx = (minX + maxX) / 2;
  const ca = (minA + maxA) / 2;

  for (let i = 0; i < tris.length; i += 3) {
    const x = tris[i];
    const a = mode === 'upright' ? tris[i + 1] : tris[i + 2];
    const b = mode === 'upright' ? -tris[i + 2] : tris[i + 1];
    out[i] = x - cx;
    out[i + 1] = b - minB; // depth -> printer Y
    out[i + 2] = a - minA; // up -> printer Z
  }
  return out;
}

/** Bounding box of a ready-to-print soup, in printer space. */
export function printBounds(tris) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < tris.length; i += 3) {
    if (tris[i] < minX) minX = tris[i];
    if (tris[i] > maxX) maxX = tris[i];
    if (tris[i + 1] < minY) minY = tris[i + 1];
    if (tris[i + 1] > maxY) maxY = tris[i + 1];
    if (tris[i + 2] > maxZ) maxZ = tris[i + 2];
  }
  return { w: maxX - minX, d: maxY - minY, h: maxZ };
}


function normalOf(t, i, out) {
  const ax = t[i],
    ay = t[i + 1],
    az = t[i + 2];
  const bx = t[i + 3],
    by = t[i + 4],
    bz = t[i + 5];
  const cx = t[i + 6],
    cy = t[i + 7],
    cz = t[i + 8];
  const ux = bx - ax,
    uy = by - ay,
    uz = bz - az;
  const vx = cx - ax,
    vy = cy - ay,
    vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / len;
  out[1] = ny / len;
  out[2] = nz / len;
}

/** Build a binary STL Blob from a triangle soup. */
export function buildSTL(tris, name = 'plate') {
  const count = tris.length / 9;
  const buf = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buf);
  const enc = new TextEncoder().encode(`plate-forge ${name}`.slice(0, 79));
  new Uint8Array(buf, 0, enc.length).set(enc);
  view.setUint32(80, count, true);

  const n = [0, 0, 0];
  let off = 84;
  for (let i = 0; i < tris.length; i += 9) {
    normalOf(tris, i, n);
    view.setFloat32(off, n[0], true);
    view.setFloat32(off + 4, n[1], true);
    view.setFloat32(off + 8, n[2], true);
    off += 12;
    for (let k = 0; k < 9; k++) {
      view.setFloat32(off, tris[i + k], true);
      off += 4;
    }
    view.setUint16(off, 0, true);
    off += 2;
  }
  return new Blob([buf], { type: 'model/stl' });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Lay several parts out side by side on one bed and merge them into one soup. */
export function packSideBySide(parts, gap = 10) {
  const chunks = [];
  let cursor = 0;
  for (const part of parts) {
    const t = toPrintSpace(part.tris, part.mode);
    const b = printBounds(t);
    const shift = cursor - (-b.w / 2);
    for (let i = 0; i < t.length; i += 3) t[i] += shift;
    cursor += b.w + gap;
    chunks.push(t);
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  // Re-centre the whole plate on the bed.
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < out.length; i += 3) {
    if (out[i] < minX) minX = out[i];
    if (out[i] > maxX) maxX = out[i];
  }
  const c = (minX + maxX) / 2;
  for (let i = 0; i < out.length; i += 3) out[i] -= c;
  return out;
}

