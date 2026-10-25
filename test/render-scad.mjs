/**
 * Renders the exported SCAD STLs to images — this is what the MakerWorld listing
 * and the docs should show, because it is the actual printable output.
 *
 *   node plate-forge/test/render-scad.mjs
 *
 * Expects STLs in ./scadtest produced by:
 *   openscad --export-format binstl -o scadtest/<mode>.stl -D 'mode="<mode>"' openscad/plate_forge.scad
 */
import { render, readSTL } from './raster.mjs';

const WHITE = [0.93, 0.93, 0.9];
const INK = [0.05, 0.05, 0.06];
const DIR = process.argv[2] ?? 'scadtest';
const OUT = process.argv[3] ?? 'plate-forge/docs';

const plate = readSTL(`${DIR}/both.stl`);
const easel = readSTL(`${DIR}/easel.stl`);
const coupon = readSTL(`${DIR}/coupon.stl`);

// The SCAD exports Z-up in print orientation: panel flat on the bed at y = 38,
// groove floor at z = 2.4. Cameras sit high on +Z so you can see into the grooves.
render([{ tris: plate, color: WHITE, inkColor: INK, inkZ: 2.4 }], [70, -80, 215], [0, 42, 0], `${OUT}/print-plate.ppm`, {
  width: 1500,
  height: 720,
  fov: 24,
});

render([{ tris: easel, color: WHITE }], [150, -195, 120], [0, 14, 15], `${OUT}/easel.ppm`, {
  width: 1350,
  height: 700,
  fov: 32,
});

render([{ tris: coupon, color: WHITE, inkColor: INK, inkZ: 1.8 }], [0, -95, 235], [0, 0, 0], `${OUT}/coupon.ppm`, {
  width: 1500,
  height: 520,
  fov: 26,
});

// detail: a few digits close up, the thing you actually judge a paint finish on
render([{ tris: plate, color: WHITE, inkColor: INK, inkZ: 2.4 }], [-26, 46, 62], [-54, 55, 0], `${OUT}/detail.ppm`, {
  width: 1200,
  height: 620,
  fov: 26,
});
