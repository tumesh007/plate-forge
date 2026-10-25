/**
 * Headless checks for the geometry. Not part of the published site.
 * Run from the workspace root:  node plate-forge/test/check.mjs
 */
import { buildPanel, buildRack, buildCoupon, derive } from '../js/model.js';
import { collectTriangles, meshVolume, toPrintSpace, printBounds, buildSTL } from '../js/stl.js';

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ok  ' : '  FAIL'}  ${msg}`);
  if (!cond) failures++;
};

/** Count how many triangles each undirected edge belongs to. */
function edgeReport(tris) {
  const key = (a, b) => {
    const ka = `${a[0].toFixed(4)},${a[1].toFixed(4)},${a[2].toFixed(4)}`;
    const kb = `${b[0].toFixed(4)},${b[1].toFixed(4)},${b[2].toFixed(4)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  const map = new Map();
  for (let i = 0; i < tris.length; i += 9) {
    const p = [
      [tris[i], tris[i + 1], tris[i + 2]],
      [tris[i + 3], tris[i + 4], tris[i + 5]],
      [tris[i + 6], tris[i + 7], tris[i + 8]],
    ];
    for (let k = 0; k < 3; k++) {
      const e = key(p[k], p[(k + 1) % 3]);
      map.set(e, (map.get(e) || 0) + 1);
    }
  }
  let open = 0;
  let over = 0;
  for (const n of map.values()) {
    if (n === 1) open++;
    else if (n > 2) over++;
  }
  return { edges: map.size, open, over };
}

function checkClosed(name, obj) {
  const tris = collectTriangles(obj);
  const rep = edgeReport(tris);
  ok(rep.open === 0 && rep.over === 0, `${name}: closed manifold (${rep.open} open, ${rep.over} over-used edges of ${rep.edges})`);
  const vol = meshVolume(tris);
  ok(vol > 100 && isFinite(vol), `${name}: positive volume ${vol.toFixed(0)} mm³`);
  let bad = 0;
  for (let i = 0; i < tris.length; i++) if (!isFinite(tris[i])) bad++;
  ok(bad === 0, `${name}: no NaN/Inf vertices`);
  return { tris, vol };
}

console.log('\n— panel, default (engraved, 30°, easel) —');
const base = {
  number: '98765 43210',
  mode: 'engrave',
  digitHeight: 18,
  stroke: 0.13,
  gap: 0.025,
  tracking: 0.16,
  aspect: 0.62,
  relief: 0.6,
  thickness: 3,
  radius: 4,
  padX: 8,
  padY: 6,
  mount: 'rack',
  tilt: 30,
  material: 'PETG',
  profile: 'standard',
};

const d0 = derive(base);
console.log(`  panel ${d0.width.toFixed(1)} x ${d0.height.toFixed(1)} x ${d0.thickness} mm`);
console.log(`  ${d0.bars.length} bars, stroke ${d0.strokeMm.toFixed(2)} mm`);
checkClosed('panel', buildPanel(base));
checkClosed('easel', buildRack(base));

console.log('\n— raised digits —');
checkClosed('panel raised', buildPanel({ ...base, mode: 'emboss' }));

console.log('\n— edge cases —');
checkClosed('panel, zero radius', buildPanel({ ...base, radius: 0 }));
checkClosed('panel, max radius', buildPanel({ ...base, radius: 12 }));
checkClosed('panel, +91 prefix', buildPanel({ ...base, number: '+91 98765 43210' }));
checkClosed('panel, 1-digit', buildClosedSafe({ number: '7' }));
checkClosed('panel, all 1s', buildPanel({ ...base, number: '11111 11111' }));
checkClosed('panel, dots', buildPanel({ ...base, number: '9.8.7' }));
checkClosed('panel, deep relief', buildPanel({ ...base, relief: 1.2 }));
checkClosed('panel, thin 1.6', buildPanel({ ...base, thickness: 1.6, relief: 0.6 }));
checkClosed('easel, 20°', buildRack({ ...base, tilt: 20 }));
checkClosed('easel, 40°', buildRack({ ...base, tilt: 40 }));

function buildClosedSafe(p) {
  return buildPanel({ ...base, ...p });
}

console.log('\n— print space —');
for (const [name, obj, mode] of [
  ['panel', buildPanel(base), 'flat'],
  ['easel', buildRack(base), 'upright'],
]) {
  const t = toPrintSpace(collectTriangles(obj), mode);
  const b = printBounds(t);
  ok(
    b.w <= 180.5 && b.d <= 180.5,
    `${name}: fits bed ${b.w.toFixed(1)} x ${b.d.toFixed(1)} x ${b.h.toFixed(1)} mm`,
  );
  let minZ = Infinity;
  for (let i = 2; i < t.length; i += 3) minZ = Math.min(minZ, t[i]);
  ok(Math.abs(minZ) < 1e-6, `${name}: sits on z=0 (min ${minZ.toExponential(2)})`);
}

console.log('\n— coupon —');
checkClosed('coupon', buildCoupon(base));

console.log('\n— STL writer —');
const tris = collectTriangles(buildPanel(base));
const blob = buildSTL(tris, 'panel');
const n = tris.length / 9;
ok(blob.size === 84 + n * 50, `STL size ${blob.size} bytes for ${n} triangles`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);


