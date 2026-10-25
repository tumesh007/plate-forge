/**
 * Geometry for the plate generator.
 *
 * Coordinate convention for the PANEL (its own local frame):
 *   x : across the plate, centred on 0
 *   y : up the plate, 0 at the bottom edge
 *   z : through the plate, 0 at the BACK face, +thickness at the FRONT (number) face
 *
 * The panel is built in exactly the orientation it should be printed in: back face on
 * the bed, number face up. Nothing needs flipping and nothing needs supports.
 */
import * as THREE from 'three';
import { layoutText } from './glyphs.js';

const deg = Math.PI / 180;

export const DEFAULT_PARAMS = {
  number: '98765 43210',
  mode: 'engrave', // 'engrave' | 'emboss'
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
  stand: 'easel', // 'easel' | 'none'
  tilt: 30,
  material: 'PETG', // 'PLA' | 'PETG'
  profile: 'standard', // 'fast' | 'standard' | 'fine'
};

export const PROFILES = {
  fast: { nozzle: 0.6, layer: 0.3, label: '0.6 nozzle / 0.30 mm' },
  standard: { nozzle: 0.4, layer: 0.2, label: '0.4 nozzle / 0.20 mm' },
  fine: { nozzle: 0.4, layer: 0.12, label: '0.4 nozzle / 0.12 mm' },
};

/** Widest the panel may get so the easel still clears the A1 mini's 180 mm bed. */
const MAX_PANEL_W = 166;

/* ------------------------------------------------------------------ 2D helpers */

function signedArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Sorted, de-duplicated copy of `values`, clipped to [lo, hi]. */
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

/** Clockwise rectangle ring for a digit bar, subdivided at every interior grid line. */
function subdivRect(b, xs, ys) {
  const ax = b.x;
  const bx = b.x + b.w;
  const ay = b.y;
  const by = b.y + b.h;
  const e = 1e-9;
  const out = [[ax, ay]];
  for (const y of ys) if (y > ay + e && y < by - e) out.push([ax, y]);
  out.push([ax, by]);
  for (const x of xs) if (x > ax + e && x < bx - e) out.push([x, by]);
  out.push([bx, by]);
  for (let i = ys.length - 1; i >= 0; i--) {
    const y = ys[i];
    if (y > ay + e && y < by - e) out.push([bx, y]);
  }
  out.push([bx, ay]);
  for (let i = xs.length - 1; i >= 0; i--) {
    const x = xs[i];
    if (x > ax + e && x < bx - e) out.push([x, ay]);
  }
  return out;
}

/* ------------------------------------------------------------------ mesh builder */

/** Accumulates triangles, then bakes them into a flat-shaded BufferGeometry. */
class Solid {
  constructor() {
    this.v = [];
  }

  tri(a, b, c) {
    this.v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  /** Planar triangle at z, wound so the normal points at +z. */
  triUp(a, b, c, z) {
    const ar = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (ar >= 0) this.tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]);
    else this.tri([a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z]);
  }

  /** Planar triangle at z, wound so the normal points at -z. */
  triDown(a, b, c, z) {
    const ar = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (ar >= 0) this.tri([a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z]);
    else this.tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]);
  }

  /** Axis-aligned vertical wall swept between two z levels along a ring. */
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

  /** A convex ring closed as a flat cap facing +z, fanned off its centroid. */
  capRing(ring, z) {
    let cx = 0;
    let cy = 0;
    for (const p of ring) {
      cx += p[0];
      cy += p[1];
    }
    cx /= ring.length;
    cy /= ring.length;
    for (let i = 0; i < ring.length; i++) {
      this.triUp([cx, cy], ring[i], ring[(i + 1) % ring.length], z);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.v), 3));
    if (signedVolume(this.v) < 0) {
      // Consistent winding, but inside-out — mirror every triangle.
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
 * Both relief styles are the same construction: the front face is the outline with the
 * digit footprints cut out, and the digit walls run either DOWN into the plate
 * (engraved) or UP out of it (raised). A single surface rather than two stacked solids
 * matters — an interior interface sitting exactly on the groove floor can be read by a
 * slicer as a filled cavity, which silently swallows the digits.
 *
 * The front face is triangulated by exact grid decomposition, not by earcut. Every hole
 * here is axis-aligned, so the region between the panel edge and the digit bars is
 * rectilinear; a grid over the unique x/y coordinates tiles it exactly, with no
 * slivers, no T-junctions and no dependence on a general polygon triangulator.
 */
export function buildPanel(p) {
  const d = derive(p);
  const g = new THREE.Group();
  g.name = 'panel';

  const T = d.thickness;
  const R = Math.max(0.2, Math.min(1.4, d.relief));
  const raised = d.mode === 'emboss';
  const { width: W, height: H, bars } = d;
  const x0 = -W / 2;
  const x1 = W / 2;

  // Keep the corner radius small enough that it can never reach the digits.
  const rr = Math.max(0, Math.min(d.radius, d.padX, d.padY, Math.min(W, H) / 2 - 0.5));
  const seg = rr > 0.05 ? 8 : 0;

  const solid = new Solid();
  const capZ = T; // the plate's face; digits break out of it either way
  const floorZ = T - R;

  /* ---- grid coordinates ---- */
  const xset = [x0, x1];
  const yset = [0, H];
  if (seg) {
    xset.push(x0 + rr, x1 - rr);
    yset.push(rr, H - rr);
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

  const eps = 1e-6;
  const isCornerCell = (ax, bx, ay, by) => {
    const side = ax >= x1 - rr - eps || bx <= x0 + rr + eps;
    const end = ay >= H - rr - eps || by <= rr + eps;
    return seg > 0 && side && end;
  };

  /* ---- front face ---- */
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const ax = xs[i];
      const bx = xs[i + 1];
      const ay = ys[j];
      const by = ys[j + 1];
      if (bx - ax < 1e-9 || by - ay < 1e-9) continue;
      if (isCornerCell(ax, bx, ay, by)) continue;
      if (inBar((ax + bx) / 2, (ay + by) / 2)) continue;
      solid.triUp([ax, ay], [bx, ay], [bx, by], capZ);
      solid.triUp([ax, ay], [bx, by], [ax, by], capZ);
    }
  }

  /* ---- rounded corners: fan from the arc centre ---- */
  const arcPts = (cx, cy, a0, a1) => {
    const out = [];
    for (let k = 0; k <= seg; k++) {
      const t = a0 + ((a1 - a0) * k) / seg;
      out.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
    }
    return out;
  };

  const brArc = seg ? arcPts(x1 - rr, rr, -Math.PI / 2, 0) : [];
  const trArc = seg ? arcPts(x1 - rr, H - rr, 0, Math.PI / 2) : [];
  const tlArc = seg ? arcPts(x0 + rr, H - rr, Math.PI / 2, Math.PI) : [];
  const blArc = seg ? arcPts(x0 + rr, rr, Math.PI, Math.PI * 1.5) : [];

  if (seg) {
    for (const [arc, c] of [
      [brArc, [x1 - rr, rr]],
      [trArc, [x1 - rr, H - rr]],
      [tlArc, [x0 + rr, H - rr]],
      [blArc, [x0 + rr, rr]],
    ]) {
      for (let k = 0; k < arc.length - 1; k++) {
        solid.triUp(c, arc[k], arc[k + 1], capZ);
      }
    }
  }

  /* ---- outer wall: the cap boundary, subdivided to match the grid ---- */
  const ring = [];
  const pushPt = (px, py) => {
    const last = ring[ring.length - 1];
    if (last && Math.abs(last[0] - px) < 1e-9 && Math.abs(last[1] - py) < 1e-9) return;
    ring.push([px, py]);
  };

  if (!seg) {
    for (const x of xs) pushPt(x, 0);
    for (const y of ys) if (y > 0) pushPt(x1, y);
    for (let i = xs.length - 1; i >= 0; i--) pushPt(xs[i], H);
    for (let i = ys.length - 1; i >= 0; i--) if (ys[i] < H) pushPt(x0, ys[i]);
  } else {
    for (const x of xs) if (x >= x0 + rr - eps && x <= x1 - rr + eps) pushPt(x, 0);
    brArc.slice(1).forEach((q) => pushPt(q[0], q[1]));
    for (const y of ys) if (y >= rr - eps && y <= H - rr + eps) pushPt(x1, y);
    trArc.slice(1).forEach((q) => pushPt(q[0], q[1]));
    for (let i = xs.length - 1; i >= 0; i--) {
      if (xs[i] >= x0 + rr - eps && xs[i] <= x1 - rr + eps) pushPt(xs[i], H);
    }
    tlArc.slice(1).forEach((q) => pushPt(q[0], q[1]));
    for (let i = ys.length - 1; i >= 0; i--) {
      if (ys[i] >= rr - eps && ys[i] <= H - rr + eps) pushPt(x0, ys[i]);
    }
    blArc.slice(1, -1).forEach((q) => pushPt(q[0], q[1]));
  }
  const f = ring[0];
  const l = ring[ring.length - 1];
  if (Math.abs(l[0] - f[0]) < 1e-9 && Math.abs(l[1] - f[1]) < 1e-9) ring.pop();

  // Back face: fanned off the same ring, so its boundary is subdivided exactly like
  // the wall. A single quad here would leave a T-junction on every grid line.
  const centre = [0, H / 2];
  for (let i = 0; i < ring.length; i++) {
    solid.triDown(centre, ring[i], ring[(i + 1) % ring.length], 0);
  }

  solid.wall(ring, 0, capZ);

  /* ---- digit walls and their floors/tops ---- */
  for (const b of bars) {
    const r = subdivRect(b, xs, ys);
    if (raised) {
      solid.wall(r, T, T + R, true);
      solid.capRing(r, T + R);
    } else {
      solid.wall(r, floorZ, T);
      solid.capRing(r, floorZ);
    }
  }

  g.add(new THREE.Mesh(solid.geometry(), null));
  g.userData.dims = d;
  return g;
}

/* ------------------------------------------------------------------ dimensions */

/** Derive every dimension from the parameters, without building geometry. */
export function derive(p) {
  // Lay out at the requested height first, then shrink to fit the bed if needed.
  const probe = layoutText(p.number, {
    height: p.digitHeight,
    stroke: p.stroke,
    gap: p.gap,
    tracking: p.tracking,
    aspect: p.aspect,
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
  });

  const width = Math.max(40, text.width + p.padX * 2);
  const height = Math.max(20, digitHeightEff + p.padY * 2);
  const bars = text.bars.map((b) => ({ ...b, y: b.y + p.padY }));

  const thickness = Math.max(1.2, p.thickness);
  const tilt = Math.max(0, Math.min(45, p.tilt));
  const hasStand = p.stand === 'easel' && tilt > 1;

  const lipH = Math.min(10, Math.max(4, height * 0.22));
  const finThick = 4;
  const halfInner = width / 2 + 0.4;
  const standWidth = 2 * halfInner + 2 * finThick;
  const hb = Math.max(8, height * 0.86);
  const rearFoot = Math.max(16, Math.min(46, height * 0.62));

  return {
    ...p,
    bars,
    width,
    height,
    thickness,
    textWidth: text.width,
    tilt,
    hasStand,
    fitScale,
    digitHeightEff,
    strokeMm: digitHeightEff * p.stroke,
    lipH,
    finThick,
    halfInner,
    standWidth,
    hb,
    rearFoot,
    standHeight: lipH + hb * Math.cos(tilt * deg),
    standDepth: rearFoot + thickness + 6,
  };
}

/* ------------------------------------------------------------------ easel */

/**
 * Easel stand. Two side fins whose front edge lies exactly on the panel's back plane,
 * a plinth the panel stands on (whose front face is the lip that stops it sliding
 * forward), and a rear tie bar. Prints standing up, base on the bed, no supports.
 */
export function buildStand(p) {
  const d = derive(p);
  const g = new THREE.Group();
  g.name = 'stand';
  if (!d.hasStand) return g;

  const th = d.tilt * deg;
  const tan = Math.tan(th);
  const { lipH, hb, rearFoot, thickness, halfInner, finThick } = d;

  // Side profile in (z, y): the panel's back plane passes through (0, lipH) and rises
  // backwards at the rake angle.
  const A = [-hb * tan, lipH + hb];
  const B = [0, lipH];
  const C = [0, 0];
  const D = [-rearFoot, 0];

  const shape = new THREE.Shape();
  shape.moveTo(A[0], A[1]);
  shape.lineTo(B[0], B[1]);
  shape.lineTo(C[0], C[1]);
  shape.lineTo(D[0], D[1]);
  shape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(shape, {
    depth: finThick,
    bevelEnabled: false,
    curveSegments: 4,
  });
  // Authored as (z, y); turn it so shape-X lands on world Z and the extrusion runs
  // along world X.
  finGeo.rotateY(-Math.PI / 2);

  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, null);
    fin.position.x = s > 0 ? halfInner + finThick : -halfInner;
    g.add(fin);
  }

  const plinthDepth = thickness + 6;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(d.standWidth, lipH, plinthDepth + 1.5),
    null,
  );
  plinth.position.set(0, lipH / 2, (plinthDepth + 1.5) / 2 - 1.5);
  g.add(plinth);

  const tie = new THREE.Mesh(new THREE.BoxGeometry(d.standWidth, 4, 5), null);
  tie.position.set(0, 2, -rearFoot * 0.62);
  g.add(tie);

  return g;
}

/* ------------------------------------------------------------------ preview ink */

/**
 * Preview only: a dark skin where the pen will actually land. Not exported — it just
 * lets you see what the marker will look like before committing filament to it.
 */
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

/** Marker test coupon: the same digit cut both ways at three relief depths. */
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
        stand: 'none',
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

/** Where the panel sits when dropped into the stand. */
export function seatPanel(panelGroup, p) {
  const d = derive(p);
  panelGroup.rotation.x = -d.tilt * deg;
  panelGroup.position.set(0, d.hasStand ? d.lipH : 0, 0);
  return panelGroup;
}

/** Does the job fit the 180 x 180 mm bed of an A1 mini? */
export function fits(p) {
  const d = derive(p);
  const stripW = d.width + (d.hasStand ? 2 * (d.finThick + 0.4) : 0);
  return {
    stripW,
    stripD: Math.max(d.height, d.standDepth),
    ok: stripW <= 176 && Math.max(d.height, d.standDepth) <= 176,
  };
}


