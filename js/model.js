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
import { layoutText } from './glyphs.js?v=6';

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

/** Widest the panel may get so the rack still clears the A1 mini's 180 mm bed. */
const MAX_PANEL_W = 164;

/** Every rack dimension, in mm. */
export const RACK = {
  cl: 0.35, // side clearance between plate edge and pillar
  tb: 2.6, // back plate thickness (this face sits on the bed)
  bw: 6, // border around the plate
  pillarT: 3.5, // pillar width across
  pillarH: 6, // pillar height off the back plate
  lipT: 1.6, // lip thickness
  lipIn: 3.0, // how far the lip overlaps the number face
  detent: 0.9, // how deep the click sits
};

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

/**
 * Panel outline: a rounded rectangle, optionally with a rectangular notch bitten out
 * of the bottom edge (the detent pocket). The four quarter-round corners are returned
 * separately because the faces are triangulated by exact grid decomposition and the
 * corners are fanned off their arc centres.
 */
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
  // Each arc contributes its own start point; the straight run between two arcs is
  // implied by the jump from one arc's last point to the next arc's first. Pushing
  // those connectors explicitly would duplicate vertices and break the wall loop.
  br.pts.slice(1).forEach(push); // ends at (x1, rr)
  tr.pts.forEach(push); // starts (x1, h-rr), ends (x1-rr, h)
  tl.pts.forEach(push); // starts (x0+rr, h), ends (x0, h-rr)
  bl.pts.forEach(push); // starts (x0, rr), ends (x0+rr, 0) = the first point

  const f = ring[0];
  const l = ring[ring.length - 1];
  if (Math.abs(l[0] - f[0]) < 1e-9 && Math.abs(l[1] - f[1]) < 1e-9) ring.pop();

  return { ring, corners: [br, tr, tl, bl], rr, segs };
}

/** Insert every grid coordinate that falls strictly inside an axis-aligned segment. */
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

/** Rectangle ring for a digit bar, subdivided at every interior grid line. */
function barRing(b, xs, ys) {
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

/** Insert grid coordinates that fall strictly inside the segment a-b. */
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
 * The front and back faces are triangulated by exact grid decomposition, not earcut.
 * Every cut-out here is axis-aligned, so the region between the panel edge and the
 * digit bars is rectilinear; a grid over the unique x/y coordinates tiles it exactly,
 * with no slivers and no T-junctions.
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
  const capZ = T;
  const floorZ = T - R;

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

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const ax = xs[i];
      const bx = xs[i + 1];
      const ay = ys[j];
      const by = ys[j + 1];
      if (bx - ax < 1e-9 || by - ay < 1e-9) continue;
      if (isCornerCell(ax, bx, ay, by)) continue;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      if (inNotch(mx, my)) continue;
      // back face: solid everywhere the notch is not
      solid.triDown([ax, ay], [bx, ay], [bx, by], 0);
      solid.triDown([ax, ay], [bx, by], [ax, by], 0);
      // front face: minus the digits
      if (inBar(mx, my)) continue;
      solid.triUp([ax, ay], [bx, ay], [bx, by], capZ);
      solid.triUp([ax, ay], [bx, by], [ax, by], capZ);
    }
  }

  // Quarter-round corners. The two radii are split at the same grid lines the rest of
  // the face uses, and the first/last fan triangles are replaced by strips along those
  // radii — otherwise the fan meets the grid at a T-junction.
  const emit = (a, b, c) => {
    solid.triUp(a, b, c, capZ);
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

  const ring = subdivideRing(outline.ring, xs, ys);
  solid.wall(ring, 0, capZ);

  for (const b of bars) {
    const r = barRing(b, xs, ys);
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

  // detent pocket, near the closed end of the channel
  const notchW = 10;
  const notch = hasRack
    ? { x0: width / 2 - 32, x1: width / 2 - 32 + notchW, depth: RACK.detent }
    : null;

  // The corner radius must stop short of the detent pocket, or the quarter-round
  // corner band swallows grid cells that belong to the notch.
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
  const rearFoot = Math.max(16, Math.min(46, height * 0.62));
  const hb = Math.max(8, height * 0.86);

  const rackWidth = width + RACK.bw * 2;
  const rackDepth = rearFoot + thickness + 9;
  const rackHeight = lipH + (height + RACK.topCl + RACK.bw) * Math.cos(tilt * deg);

  return {
    ...p,
    bars,
    width,
    height,
    thickness,
    textWidth: text.width,
    tilt,
    hasRack,
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
    standDepth: rackDepth,
  };
}

/* ------------------------------------------------------------------ rack */

/**
 * The rack the panel drops into.
 *
 * Two side pillars and a bottom ledge stand off a back plate, each finishing in a lip
 * that overlaps the number face. The plate enters from the TOP, drops between the
 * pillars, lands on the ledge and clicks into a detent. Nothing is glued.
 *
 * Everything here is extruded perpendicular to the back plate in +w, so the part is
 * modelled in its print orientation: lay the back plate on the bed and every feature
 * rises vertically. No supports, no bridging.
 */
export function buildRack(p) {
  const d = derive(p);
  const g = new THREE.Group();
  g.name = 'rack';
  if (!d.hasRack) return g;

  const { width: W, height: H, thickness: T, notch } = d;
  const { cl, tb, bw, pillarT, pillarH, lipT, lipIn } = RACK;
  const x0 = -W / 2;
  const x1 = W / 2;
  const top = H + bw;
  const bot = -bw;
  const ov = 0.05;

  /** Box in rack coordinates: x across, y up, z out of the back plate (print up). */
  const box = (u0, u1, v0, v1, w0, w1, gr = ov) => {
    const geo = new THREE.BoxGeometry(u1 - u0 + gr * 2, v1 - v0 + gr * 2, w1 - w0 + gr * 2);
    geo.translate((u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2);
    return new THREE.Mesh(geo, null);
  };

  /* back plate — this is the face that sits on the bed */
  g.add(box(x0 - bw, x1 + bw, bot, top, 0, tb));

  /* the two pillars the plate slides between */
  g.add(box(x0 - cl - pillarT, x0 - cl, bot, top, tb, tb + pillarH));
  g.add(box(x1 + cl, x1 + cl + pillarT, bot, top, tb, tb + pillarH));

  /* bottom ledge: the plate lands on this */
  g.add(box(x0 - cl, x1 + cl, bot, -cl, tb, tb + pillarH));

  /* lips: overlap the number face on both sides and the bottom */
  g.add(box(x0 - cl, x0 - cl + lipIn, bot, top, tb + pillarH, tb + pillarH + lipT));
  g.add(box(x1 + cl - lipIn, x1 + cl, bot, top, tb + pillarH, tb + pillarH + lipT));
  g.add(box(x0 - cl, x1 + cl, -cl, -cl + lipIn, tb + pillarH, tb + pillarH + lipT));

  /* detent: a stepped wedge on the ledge, clicking into the plate's bottom pocket */
  if (notch) {
    const steps = 4;
    const crest = RACK.detent - 0.1;
    for (let i = 0; i < steps; i++) {
      const inset = crest * (1 - (i + 1) / steps);
      const rise = crest * ((i + 1) / steps);
      g.add(
        box(notch.x0 + inset, notch.x1 - inset, -cl, -cl + rise, tb, tb + T, 0.02),
      );
    }
  }

  return g;
}

/**
 * Wedge the rack stands in. A separate part only because a stand cannot be printed as
 * part of a plate that lies flat on the bed — a foot has to reach behind the plate.
 *
 * Prints on its base: the sloping face is a 20° overhang, the slot is cut into it.
 */
export function buildFoot(p) {
  const d = derive(p);
  const g = new THREE.Group();
  g.name = 'foot';
  if (!d.hasRack) return g;

  const theta = d.tilt * deg;
  const tan = Math.tan(theta);
  const lip = d.lipH;
  const hb = d.hb;
  const rear = d.rearFoot;
  const finT = 4.5;
  const span = d.rackWidth;

  // Side profile in (z, y): the front edge lies on the rack's back plane, the base
  // lies on the bed. Every face is either vertical or a 20° overhang, which is why
  // this shape prints standing with no supports.
  const shape = new THREE.Shape();
  shape.moveTo(-hb * tan, lip + hb);
  shape.lineTo(0, lip);
  shape.lineTo(0, 0);
  shape.lineTo(-rear, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: finT,
    bevelEnabled: false,
    curveSegments: 2,
  });
  geo.rotateY(-Math.PI / 2);

  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(geo, null);
    fin.position.x = s > 0 ? span / 2 : -span / 2 + finT;
    g.add(fin);
  }

  // tie bar so the two gussets cannot splay
  const tie = new THREE.Mesh(new THREE.BoxGeometry(span, 5, 5), null);
  tie.position.set(0, 2.5, -rear * 0.7);
  g.add(tie);

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

/** Seat the panel in the rack for preview. */
/** Rack frame -> world: lean it back by the rake and lift it onto its base. */
export function rackTransform(p) {
  const d = derive(p);
  return { rotX: -d.tilt * deg, y: d.lipH };
}

/** Seat the panel inside the rack for preview. */
export function seatPanel(panelGroup, p) {
  const d = derive(p);
  if (!d.hasRack) return panelGroup;
  const theta = d.tilt * deg;
  const yLocal = -RACK.cl;
  const zLocal = RACK.tb;
  panelGroup.rotation.set(-theta, 0, 0);
  panelGroup.position.set(
    0,
    d.lipH + yLocal * Math.cos(theta) + zLocal * Math.sin(theta),
    -yLocal * Math.sin(theta) + zLocal * Math.cos(theta),
  );
  return panelGroup;
}
export function fits(p) {
  const d = derive(p);
  const w = Math.max(d.width, d.hasRack ? d.rackWidth : 0);
  const dep = d.hasRack ? d.rackDepth : d.height;
  const h = d.hasRack ? d.rackHeight : d.thickness;
  return { w, dep, h, ok: w <= 176 && dep <= 176 && h <= 176 };
}











