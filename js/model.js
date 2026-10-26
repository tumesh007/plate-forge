/**
 * Geometry for the plate generator.
 *
 * Coordinate convention for the PANEL (its own local frame):
 *   x : across the plate, centred on 0
 *   y : up the plate, 0 at the bottom edge
 *   z : through the plate, 0 at the BACK face, +thickness at the FRONT (number) face
 *
 * The panel is built in exactly the orientation it should be printed in: back face on
 * the bed, number face up.
 *
 * The stand is a SINGLE-PIECE grooved wedge mount:
 *   - Two thickened side wedges with inward-facing channels running down the front rake.
 *   - The panel slides in from the top and sits on the bottom ledge stop.
 *   - Connected by a front plinth and a rear tie bar.
 *   - Prints upright on its flat base on the bed with 0 supports (satisfying the 45° rule).
 */
import * as THREE from 'three';
import { layoutText } from './glyphs.js?v=7';

const deg = Math.PI / 180;

export const DEFAULT_PARAMS = {
  number: '98765 43210',
  mode: 'engrave', // 'engrave' | 'emboss'
  style: 'styled', // 'styled' | 'digital'
  digitHeight: 18,
  stroke: 0.13,
  gap: 0.025,
  tracking: 0.16,
  aspect: 0.62,
  relief: 0.6,
  thickness: 3.0,
  radius: 4,
  padX: 8,
  padY: 6,
  mount: 'rack', // 'rack' | 'none'
  tilt: 30,
  material: 'PETG', // 'PLA' | 'PETG'
  profile: 'standard', // 'fast' | 'standard' | 'fine'
};

export const PROFILES = {
  fast: { nozzle: 0.6, layer: 0.3, label: '0.6 nozzle / 0.30 mm' },
  standard: { nozzle: 0.4, layer: 0.2, label: '0.4 nozzle / 0.20 mm' },
  fine: { nozzle: 0.4, layer: 0.12, label: '0.4 nozzle / 0.12 mm' },
};

/** Widest the panel may get so the stand still clears the A1 mini's 180 mm bed. */
const MAX_PANEL_W = 160;

/** Stand dimension presets. */
export const RACK = {
  cl: 0.4,
  tb: 2.6,
  bw: 7,
  pillarT: 4.0,
  pillarH: 6.0,
  lipT: 1.8,
  lipIn: 2.5,
  detent: 0.9,
  topCl: 1.0,
};

/* ------------------------------------------------------------------ 2D helpers */

function uniqSorted(values, lo, hi, eps = 1e-7) {
  const kept = values
    .filter((v) => v >= lo - eps && v <= hi + eps)
    .map((v) => Math.min(hi, Math.max(lo, v)))
    .sort((a, b) => a - b);
  const out = [];
  for (const v of kept) {
    if (!out.length || v - out[out.length - 1] > eps) out.push(v);
  }
  return out;
}

function outlinePoints(w, h, r, notch, seg = 8) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2 - 0.2));
  const x0 = -w / 2;
  const x1 = w / 2;
  const segs = rr > 0.05 ? seg : 0;

  if (segs === 0) {
    const ring = [[x0, 0]];
    if (notch) {
      ring.push([notch.x0, 0], [notch.x0, notch.depth]);
      ring.push([notch.x1, notch.depth], [notch.x1, 0]);
    }
    ring.push([x1, 0], [x1, h], [x0, h]);
    return { ring, corners: [], rr: 0, segs: 0 };
  }

  const arc = (cx, cy, a0, a1) => {
    const out = [];
    for (let k = 0; k <= segs; k++) {
      const t = a0 + ((a1 - a0) * k) / segs;
      out.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
    }
    return out;
  };

  const br = { c: [x1 - rr, rr], pts: arc(x1 - rr, rr, -Math.PI / 2, 0) };
  const tr = { c: [x1 - rr, h - rr], pts: arc(x1 - rr, h - rr, 0, Math.PI / 2) };
  const tl = { c: [x0 + rr, h - rr], pts: arc(x0 + rr, h - rr, Math.PI / 2, Math.PI) };
  const bl = { c: [x0 + rr, rr], pts: arc(x0 + rr, rr, Math.PI, Math.PI * 1.5) };

  const ring = [];
  const push = (p) => ring.push(p);
  push([x0 + rr, 0]);
  if (notch) {
    push([notch.x0, 0]);
    push([notch.x0, notch.depth]);
    push([notch.x1, notch.depth]);
    push([notch.x1, 0]);
  }
  push([x1 - rr, 0]);
  br.pts.slice(1).forEach(push);
  tr.pts.forEach(push);
  tl.pts.forEach(push);
  bl.pts.forEach(push);

  const f = ring[0];
  const l = ring[ring.length - 1];
  if (Math.abs(l[0] - f[0]) < 1e-9 && Math.abs(l[1] - f[1]) < 1e-9) ring.pop();

  return { ring, corners: [br, tr, tl, bl], rr, segs };
}

function subdivideRing(ring, xs, ys) {
  const out = [];
  const eq = (a, b) => Math.abs(a - b) < 1e-9;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    out.push(p);
    const horizontal = eq(p[1], q[1]);
    const vertical = eq(p[0], q[0]);
    if (!horizontal && !vertical) continue;
    const lo = horizontal ? Math.min(p[0], q[0]) : Math.min(p[1], q[1]);
    const hi = horizontal ? Math.max(p[0], q[0]) : Math.max(p[1], q[1]);
    const forward = horizontal ? q[0] > p[0] : q[1] > p[1];
    const list = (horizontal ? xs : ys)
      .filter((v) => v > lo + 1e-9 && v < hi - 1e-9)
      .sort((a, b) => (forward ? a - b : b - a));
    for (const v of list) out.push(horizontal ? [v, p[1]] : [p[0], v]);
  }
  return out;
}

function subdivideSegment(a, b, xs, ys) {
  const eq = (p, q) => Math.abs(p - q) < 1e-9;
  const out = [a];
  const horizontal = eq(a[1], b[1]);
  const vertical = eq(a[0], b[0]);
  if (!horizontal && !vertical) return [a, b];
  const lo = horizontal ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
  const hi = horizontal ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
  const forward = horizontal ? b[0] > a[0] : b[1] > a[1];
  const list = (horizontal ? xs : ys)
    .filter((v) => v > lo + 1e-9 && v < hi - 1e-9)
    .sort((p, q) => (forward ? p - q : q - p));
  for (const v of list) out.push(horizontal ? [v, a[1]] : [a[0], v]);
  out.push(b);
  return out;
}

/* ------------------------------------------------------------------ mesh builder */

class Solid {
  constructor() {
    this.v = [];
  }

  tri(a, b, c) {
    this.v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  triUp(a, b, c, z) {
    const ar = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (ar >= 0) this.tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]);
    else this.tri([a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z]);
  }

  triDown(a, b, c, z) {
    const ar = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (ar >= 0) this.tri([a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z]);
    else this.tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]);
  }

  wall(ring, zA, zB, flip = false) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      const aLo = [p[0], p[1], zA];
      const bLo = [q[0], q[1], zA];
      const aHi = [p[0], p[1], zB];
      const bHi = [q[0], q[1], zB];
      if (flip) {
        this.tri(aLo, bHi, bLo);
        this.tri(aLo, aHi, bHi);
      } else {
        this.tri(aLo, bLo, bHi);
        this.tri(aLo, bHi, aHi);
      }
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.v), 3));
    if (signedVolume(this.v) < 0) {
      for (let i = 0; i < this.v.length; i += 9) {
        for (let k = 0; k < 3; k++) {
          const tmp = this.v[i + 3 + k];
          this.v[i + 3 + k] = this.v[i + 6 + k];
          this.v[i + 6 + k] = tmp;
        }
      }
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.v), 3));
    }
    g.computeVertexNormals();
    return g;
  }
}

function signedVolume(v) {
  let vol = 0;
  for (let i = 0; i < v.length; i += 9) {
    const ax = v[i];
    const ay = v[i + 1];
    const az = v[i + 2];
    const bx = v[i + 3];
    const by = v[i + 4];
    const bz = v[i + 5];
    const cx = v[i + 6];
    const cy = v[i + 7];
    const cz = v[i + 8];
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}

/* ------------------------------------------------------------------ panel */

/**
 * The number panel, as ONE closed manifold surface.
 *
 * Front face, back face, and vertical groove walls are generated via exact 2D grid cell
 * decomposition. Overlapping and contiguous strokes merge seamlessly without internal walls
 * or degenerate edges, producing an airtight manifold.
 */
export function buildPanel(p) {
  const d = derive(p);
  const g = new THREE.Group();
  g.name = 'panel';

  const T = d.thickness;
  const R = Math.max(0.2, Math.min(1.4, d.relief));
  const raised = d.mode === 'emboss';
  const { width: W, height: H, bars, notch } = d;
  const x0 = -W / 2;
  const x1 = W / 2;

  const outline = outlinePoints(W, H, d.radiusSafe, notch);

  const solid = new Solid();
  const capZ = raised ? T + R : T;
  const floorZ = raised ? T : T - R;

  const xset = [x0, x1];
  const yset = [0, H];
  if (outline.segs) {
    xset.push(x0 + outline.rr, x1 - outline.rr);
    yset.push(outline.rr, H - outline.rr);
  }
  if (notch) {
    xset.push(notch.x0, notch.x1);
    yset.push(notch.depth);
  }
  for (const b of bars) {
    xset.push(b.x, b.x + b.w);
    yset.push(b.y, b.y + b.h);
  }
  const xs = uniqSorted(xset, x0, x1);
  const ys = uniqSorted(yset, 0, H);

  const inBar = (px, py) => {
    for (const b of bars) {
      if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) return true;
    }
    return false;
  };
  const inNotch = (px, py) =>
    !!notch && px > notch.x0 && px < notch.x1 && py > 0 && py < notch.depth;

  const eps = 1e-6;
  const isCornerCell = (ax, bx, ay, by) => {
    const side = ax >= x1 - outline.rr - eps || bx <= x0 + outline.rr + eps;
    const end = ay >= H - outline.rr - eps || by <= outline.rr + eps;
    return outline.segs > 0 && side && end;
  };

  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const cellType = Array.from({ length: nx }, () => new Int8Array(ny)); // 0: outside, 1: solid, 2: groove

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const ax = xs[i], bx = xs[i + 1];
      const ay = ys[j], by = ys[j + 1];
      if (bx - ax < 1e-9 || by - ay < 1e-9) continue;
      if (isCornerCell(ax, bx, ay, by)) continue;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      if (inNotch(mx, my)) continue;

      // Solid back face
      solid.triDown([ax, ay], [bx, ay], [bx, by], 0);
      solid.triDown([ax, ay], [bx, by], [ax, by], 0);

      const inG = inBar(mx, my);
      cellType[i][j] = inG ? 2 : 1;

      if (!inG) {
        // Solid top face
        const z = raised ? T : capZ;
        solid.triUp([ax, ay], [bx, ay], [bx, by], z);
        solid.triUp([ax, ay], [bx, by], [ax, by], z);
      } else {
        // Groove floor / raised top
        const z = raised ? capZ : floorZ;
        solid.triUp([ax, ay], [bx, ay], [bx, by], z);
        solid.triUp([ax, ay], [bx, by], [ax, by], z);
      }
    }
  }

  // Groove walls along cell boundaries between solid and groove
  const zBot = raised ? T : floorZ;
  const zTop = raised ? capZ : T;

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const c = cellType[i][j];
      const right = i + 1 < nx ? cellType[i + 1][j] : 0;
      if ((c === 2 && right === 1) || (c === 1 && right === 2)) {
        const x = xs[i + 1];
        const y0 = ys[j], y1 = ys[j + 1];
        if (c === 2) {
          solid.tri([x, y0, zBot], [x, y1, zTop], [x, y1, zBot]);
          solid.tri([x, y0, zBot], [x, y0, zTop], [x, y1, zTop]);
        } else {
          solid.tri([x, y0, zBot], [x, y1, zBot], [x, y1, zTop]);
          solid.tri([x, y0, zBot], [x, y1, zTop], [x, y0, zTop]);
        }
      }

      const top = j + 1 < ny ? cellType[i][j + 1] : 0;
      if ((c === 2 && top === 1) || (c === 1 && top === 2)) {
        const y = ys[j + 1];
        const x0 = xs[i], x1 = xs[i + 1];
        if (c === 2) {
          solid.tri([x0, y, zBot], [x1, y, zBot], [x1, y, zTop]);
          solid.tri([x0, y, zBot], [x1, y, zTop], [x0, y, zTop]);
        } else {
          solid.tri([x0, y, zBot], [x1, y, zTop], [x1, y, zBot]);
          solid.tri([x0, y, zBot], [x0, y, zTop], [x1, y, zTop]);
        }
      }
    }
  }

  // Quarter-round corners
  const topZ = raised ? T : capZ;
  const emit = (a, b, c) => {
    solid.triUp(a, b, c, topZ);
    solid.triDown(a, b, c, 0);
  };
  for (const corner of outline.corners) {
    const c = corner.c;
    const pts = corner.pts;
    const n = pts.length;

    const r0 = subdivideSegment(c, pts[0], xs, ys);
    for (let i = 0; i < r0.length - 1; i++) emit(r0[i], r0[i + 1], pts[1]);

    for (let k = 1; k < n - 2; k++) emit(c, pts[k], pts[k + 1]);

    const r1 = subdivideSegment(c, pts[n - 1], xs, ys);
    for (let i = 0; i < r1.length - 1; i++) emit(r1[i], r1[i + 1], pts[n - 2]);
  }

  // Outer perimeter wall
  const ring = subdivideRing(outline.ring, xs, ys);
  solid.wall(ring, 0, topZ);

  g.add(new THREE.Mesh(solid.geometry(), null));
  g.userData.dims = d;
  return g;
}

/* ------------------------------------------------------------------ dimensions */

export function derive(p) {
  const probe = layoutText(p.number, {
    height: p.digitHeight,
    stroke: p.stroke,
    gap: p.gap,
    tracking: p.tracking,
    aspect: p.aspect,
    style: p.style,
  });
  const availW = Math.max(30, MAX_PANEL_W - p.padX * 2);
  const fitScale = probe.width > availW ? availW / probe.width : 1;
  const digitHeightEff = p.digitHeight * fitScale;

  const text = layoutText(p.number, {
    height: digitHeightEff,
    stroke: p.stroke,
    gap: p.gap,
    tracking: p.tracking,
    aspect: p.aspect,
    style: p.style,
  });

  const width = Math.max(40, text.width + p.padX * 2);
  const height = Math.max(20, digitHeightEff + p.padY * 2);
  const bars = text.bars.map((b) => ({ ...b, y: b.y + p.padY }));

  const thickness = Math.max(1.2, p.thickness);
  const tilt = Math.max(0, Math.min(45, p.tilt));
  const hasRack = p.mount === 'rack';

  const notchW = 10;
  const notch = hasRack
    ? { x0: width / 2 - 32, x1: width / 2 - 32 + notchW, depth: RACK.detent }
    : null;

  const radiusSafe = Math.max(
    0,
    Math.min(
      p.radius,
      p.padX,
      p.padY,
      Math.min(width, height) / 2 - 0.2,
      notch ? notch.x0 - -width / 2 - 1 : Infinity,
    ),
  );

  const lipH = Math.min(10, Math.max(4, height * 0.22));
  const rearFoot = Math.max(18, Math.min(46, height * 0.62));
  const hb = Math.max(8, height * 0.86);

  const wedgeThick = 7.0;
  const clSide = 0.4;
  const rackWidth = width + 2 * (clSide + wedgeThick);
  const rackDepth = rearFoot + thickness + 9;
  const rackHeight = lipH + (height + 2) * Math.cos(tilt * deg);

  return {
    ...p,
    bars,
    width,
    height,
    thickness,
    textWidth: text.width,
    tilt,
    hasRack,
    hasStand: hasRack,
    notch,
    radiusSafe,
    fitScale,
    digitHeightEff,
    strokeMm: digitHeightEff * p.stroke,
    lipH,
    rearFoot,
    hb,
    rackWidth,
    rackDepth,
    rackHeight,
    standWidth: rackWidth,
    standDepth: rackDepth,
    standHeight: rackHeight,
  };
}

/* ------------------------------------------------------------------ stand (one-piece grooved wedge) */

/**
 * The single-piece grooved wedge stand.
 *
 * Two side wedges with inward-facing U-channels running down the front rake.
 * The plate enters from the top, slides down between the wedges, and lands on the
 * bottom plinth stop.
 *
 * Prints standing on its flat base on the bed with ZERO supports (slope < 45° overhang).
 */
export function buildStand(p) {
  const d = derive(p);
  const g = new THREE.Group();
  g.name = 'stand';
  if (!d.hasRack) return g;

  const theta = d.tilt * deg;
  const tan = Math.tan(theta);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const W = d.width;
  const H = d.height;
  const T = d.thickness;

  const lip = d.lipH;
  const hb = d.hb;
  const rear = d.rearFoot;

  const clSide = 0.4;
  const clThick = 0.4;
  const slotW = T + clThick;
  const slotDepth = 3.5;
  const wallThick = 3.5;

  const halfInner = W / 2 + clSide;
  const totalStandW = 2 * (halfInner + slotDepth + wallThick);

  const ov = 0.05;
  const box = (dx, dy, dz, px, py, pz, rx = 0) => {
    const geo = new THREE.BoxGeometry(dx + ov * 2, dy + ov * 2, dz + ov * 2);
    const m = new THREE.Mesh(geo, null);
    m.rotation.x = rx;
    m.position.set(px, py, pz);
    return m;
  };

  // Outer wedge profile
  const shape = new THREE.Shape();
  shape.moveTo(-hb * tan, lip + hb);
  shape.lineTo(0, lip);
  shape.lineTo(0, 0);
  shape.lineTo(-rear, 0);
  shape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(shape, {
    depth: wallThick + ov,
    bevelEnabled: false,
    curveSegments: 2,
  });
  finGeo.rotateY(-Math.PI / 2);

  // Both side wedges
  for (const s of [-1, 1]) {
    // Outer solid fin
    const fin = new THREE.Mesh(finGeo, null);
    fin.position.x = s > 0 ? halfInner + slotDepth + wallThick : -halfInner - slotDepth;
    g.add(fin);

    // Channel flanges
    const chLength = hb + 2;
    const chX = s > 0 ? halfInner + slotDepth / 2 : -halfInner - slotDepth / 2;

    // Back flange of channel (supports back of plate)
    const backFlangeT = 2.4;
    const localY = chLength / 2;
    const localZ_back = -backFlangeT / 2;
    const worldY_back = lip + localY * cos + localZ_back * sin;
    const worldZ_back = -localY * sin + localZ_back * cos;
    g.add(box(slotDepth, chLength, backFlangeT, chX, worldY_back, worldZ_back, -theta));

    // Front lip of channel (holds front of plate)
    const frontLipT = 1.8;
    const localZ_front = slotW + frontLipT / 2;
    const worldY_front = lip + localY * cos + localZ_front * sin;
    const worldZ_front = -localY * sin + localZ_front * cos;
    g.add(box(slotDepth, chLength, frontLipT, chX, worldY_front, worldZ_front, -theta));
  }

  // Front plinth (acts as bottom stop and base bridge)
  const plinthDepth = slotW + 3;
  g.add(box(totalStandW, lip, plinthDepth, 0, lip / 2, plinthDepth / 2 - 1.5));

  // Rear tie bar connecting rear feet
  g.add(box(totalStandW, 4, 5, 0, 2, -rear * 0.7));

  return g;
}

/** Legacy alias for buildStand. */
export function buildRack(p) {
  return buildStand(p);
}

/** Legacy stub for buildFoot (stand is now a unified single piece). */
export function buildFoot(p) {
  const g = new THREE.Group();
  g.name = 'foot';
  return g;
}

/* ------------------------------------------------------------------ preview ink */

export function buildInk(p) {
  const d = derive(p);
  const g = new THREE.Group();
  g.name = 'ink';
  const relief = Math.max(0.2, Math.min(1.4, d.relief));
  const z =
    d.mode === 'engrave'
      ? Math.max(0.8, d.thickness - relief) + 0.03
      : d.thickness + relief + 0.03;

  for (const b of d.bars) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), null);
    m.position.set(b.x + b.w / 2, b.y + b.h / 2, z);
    m.userData.ink = true;
    m.userData.noExport = true;
    g.add(m);
  }
  return g;
}

/* ------------------------------------------------------------------ coupon */

export function buildCoupon(p) {
  const g = new THREE.Group();
  g.name = 'coupon';
  let x = 0;
  for (const mode of ['engrave', 'emboss']) {
    for (const relief of [0.4, 0.6, 0.9]) {
      const sub = buildPanel({
        ...p,
        number: '8',
        mode,
        relief,
        thickness: 2.4,
        digitHeight: 15,
        padX: 4.5,
        padY: 4,
        radius: 1.5,
        mount: 'none',
      });
      const d = sub.userData.dims;
      sub.position.set(x + d.width / 2, 0, 0);
      g.add(sub);
      x += d.width + 4;
    }
  }
  g.position.x = -x / 2;
  return g;
}

/** Stand sits flat on table/dash at (0, 0, 0). */
export function rackTransform(p) {
  return { rotX: 0, y: 0 };
}

/** Seat the panel inside the stand's channels. */
export function seatPanel(panelGroup, p) {
  const d = derive(p);
  if (!d.hasRack) return panelGroup;
  panelGroup.rotation.set(-d.tilt * deg, 0, 0);
  panelGroup.position.set(0, d.lipH, 0);
  return panelGroup;
}

export function fits(p) {
  const d = derive(p);
  const w = Math.max(d.width, d.hasRack ? d.rackWidth : 0);
  const dep = d.hasRack ? d.rackDepth : d.height;
  const h = d.hasRack ? d.rackHeight : d.thickness;
  return { w, dep, h, ok: w <= 176 && dep <= 176 && h <= 176 };
}
