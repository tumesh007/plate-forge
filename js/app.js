import {
  DEFAULT_PARAMS,
  PROFILES,
  derive,
  buildPanel,
  buildRack,
  buildFoot,
  rackTransform,
  buildCoupon,
  buildInk,
  seatPanel,
  fits,
} from './model.js?v=8';
import {
  collectTriangles,
  meshVolume,
  toPrintSpace,
  printBounds,
  buildSTL,
  download,
  packSideBySide,
} from './stl.js?v=8';
import { createViewer } from './viewer.js?v=8';
import { sanitize } from './glyphs.js?v=8';

const DENSITY = { PLA: 1.24, PETG: 1.27 }; // g/cm^3
const $ = (id) => document.getElementById(id);

const state = { ...DEFAULT_PARAMS, layout: 'assembled', showInk: true };

/* ------------------------------------------------------------------ camera */

const viewer = createViewer($('view'));

/* ------------------------------------------------------------------ helpers */

const num = (v, d = 1) => v.toFixed(d);

function fmtTime(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Rough slicer-time model, in seconds.
 */
function estimateTime(extrudedMm3, profileKey, ironing) {
  const { nozzle, layer } = PROFILES[profileKey];
  const lineWidth = nozzle * 1.06;
  const cap = nozzle >= 0.58 ? 28 : 22; // mm^3/s, A1 mini class
  const flow = Math.min(lineWidth * layer * 160, cap);
  let s = (extrudedMm3 / flow) * 1.55 + 70;
  if (ironing) s *= 1.12;
  return s;
}

/** Fraction of the solid volume that actually gets extruded at 4 walls / 15% infill. */
const SHELL = { panel: 0.68, stand: 0.4 };

/* ------------------------------------------------------------------ scene */

function buildDisplayObjects() {
  const panel = buildPanel(state);
  if (state.showInk) panel.add(buildInk(state));
  const rack = buildRack(state);
  const d = derive(state);
  return { panel, rack, d };
}

function renderScene() {
  const { panel, rack, d } = buildDisplayObjects();
  viewer.clear();

  if (state.layout === 'assembled') {
    if (d.hasRack) viewer.add(rack);
    seatPanel(panel, state);
    viewer.add(panel);
    return;
  }

  // "As printed": stand sits upright on its base on the bed, panel flat beside it.
  const standW = d.hasRack ? d.rackWidth : 0;
  const gap = 14;
  const totalW = standW + (d.hasRack ? gap : 0) + d.width;
  let x = -totalW / 2;

  if (d.hasRack) {
    // Stand prints sitting on its flat base on the bed
    rack.position.set(x + standW / 2, 0, 0);
    viewer.add(rack);
    x += standW + gap;
  }
  panel.rotation.x = -Math.PI / 2;
  panel.position.set(x + d.width / 2, 0, d.height / 2);
  viewer.add(panel);
}

/* ------------------------------------------------------------------ stats */

function updateStats() {
  const d = derive(state);
  const panel = buildPanel(state);
  const rack = buildRack(state);

  const pVol = meshVolume(collectTriangles(panel));
  const sVol = d.hasRack ? meshVolume(collectTriangles(rack)) : 0;
  const density = DENSITY[state.material] ?? 1.25;

  const panelG = (pVol * SHELL.panel * density) / 1000;
  const standG = (sVol * SHELL.stand * density) / 1000;
  const ironing = state.mode === 'engrave';

  $('mSize').textContent = `${num(d.width)} × ${num(d.height)} × ${num(d.thickness)}`;
  $('mMass').textContent = `≈ ${(panelG + (d.hasRack ? standG : 0)).toFixed(1)} g`;
  $('mMass').title = d.hasRack
    ? `panel ≈${panelG.toFixed(1)} g + stand ≈${standG.toFixed(1)} g`
    : 'panel only';
  $('mTime').textContent = fmtTime(
    estimateTime(pVol * SHELL.panel, state.profile, ironing) +
      estimateTime(sVol * SHELL.stand, state.profile, false),
  );
  $('mStroke').textContent = `${num(d.strokeMm)} mm`;

  // Fit check
  const f = fits(state);
  const fitPill = $('fitPill');
  fitPill.textContent = f.ok ? 'A1 mini · fits' : 'A1 mini · too big';
  fitPill.style.color = f.ok ? '' : 'var(--warn)';
  fitPill.style.borderColor = f.ok ? '' : '#6b4a1c';

  const warnings = [];
  if (!f.ok) {
    warnings.push(
      `Job is too wide for the A1 mini's 180 mm bed. Cut the digit height, side gap or spacing.`,
    );
  }
  if (d.strokeMm < 1.2) {
    warnings.push(
      `Stroke is ${num(d.strokeMm)} mm. Under ~1.2 mm a marker tip cannot fill the groove cleanly. Raise the stroke weight or the digit height.`,
    );
  }
  if (state.material === 'PLA' && state.tilt > 0) {
    warnings.push(
      'PLA creeps above ~60 °C. On a dashboard in an Indian summer it will sag over a few hot afternoons. PETG if it lives in the car.',
    );
  }
  if (d.mode === 'engrave' && state.relief > 1.0) {
    warnings.push('Deep grooves print slower and lose edge sharpness. 0.6 mm is the sweet spot.');
  }

  const warn = $('warn');
  warn.classList.toggle('hidden', warnings.length === 0);
  warn.textContent = warnings[0] ?? '';
  if (warnings.length > 1) warn.textContent += ` (${warnings.length - 1} more in the recipe)`;

  return { d, panelG, standG };
}

/* ------------------------------------------------------------------ recipe */

function recipeText() {
  const d = derive(state);
  const petg = state.material === 'PETG';
  const p = PROFILES[state.profile];
  const ironFlow = petg ? 8 : 10;
  const lines = [
    `PLATE FORGE · ${state.material} · ${p.nozzle} mm nozzle`,
    `Panel ${num(d.width)} × ${num(d.height)} × ${num(d.thickness)} mm`,
    `Digits ${d.mode === 'engrave' ? 'engraved' : 'raised'} ${num(state.relief)} mm,`,
    `stroke ${num(d.strokeMm)} mm`,
    '',
    'QUALITY',
    `  layer height        ${p.layer.toFixed(2)} mm`,
    `  elephant foot comp  0.15 mm`,
    `  ironing type        All top surfaces`,
    `  ironing flow        ${ironFlow}%`,
    `  ironing spacing     0.10 mm`,
    `  ironing speed       30 mm/s`,
    `  ironing inset       0.2 mm`,
    `  ironing angle       fixed 45°`,
    '',
    'STRENGTH',
    '  walls               4',
    '  top / bottom        5 / 4',
    '  sparse infill       15% gyroid',
    '',
    'FILAMENT',
    `  nozzle temp         ${petg ? '255' : '215'} °C`,
    `  bed                 ${petg ? '70' : '60'} °C`,
    `  plate               ${petg ? 'textured PEI + glue' : 'smooth PEI'}`,
    `  part cooling        ${petg ? '60%' : '100%'}`,
    '',
    'AFTER THE PRINT',
    '  1  Wipe the number face with 70% IPA.',
    '  2  Brush a thin PVA / wood-glue wash into',
    '     the grooves and let it dry. This is the',
    '     step that stops ink wicking along layer',
    '     lines — do not skip it.',
    '  3  Flood with an oil-based paint pen',
    '     (Sharpie Oil-Based, Posca PC-5M).',
    '  4  While tacky, wipe the flat face with a',
    '     barely damp cloth.',
    '  5  Cure 24 h, then 2 thin matte UV clear',
    '     coats.',
  ];
  return lines.join('\n');
}

function refreshRecipe() {
  const petg = state.material === 'PETG';
  $('recipeIntro').textContent = petg
    ? 'PETG survives a dashboard but repels ink — the glue wash in step 2 is doing the real work here.'
    : 'PLA takes ink beautifully and sags above 60 °C. Fine on a shaded desk, not on a windscreen.';
  $('recipe').textContent = recipeText();
}

/* ------------------------------------------------------------------ export */

function exportOne(which) {
  const d = derive(state);
  const slug = d.number.replace(/[^0-9+]/g, '') || 'plate';

  if (which === 'panel') {
    const g = buildPanel(state);
    const tris = toPrintSpace(collectTriangles(g), 'flat');
    const b = printBounds(tris);
    download(buildSTL(tris, 'panel'), `panel-${slug}.stl`);
    flash(`panel ${num(b.w)} × ${num(b.d)} mm`);
    return;
  }

  if (which === 'rack' || which === 'base') {
    if (!d.hasRack) {
      flash('no stand with these settings');
      return;
    }
    const g = buildRack(state);
    const tris = toPrintSpace(collectTriangles(g), 'upright');
    download(buildSTL(tris, 'stand'), `stand-${slug}.stl`);
    flash('stand exported');
    return;
  }

  if (which === 'both') {
    const parts = [{ tris: collectTriangles(buildPanel(state)), mode: 'flat' }];
    if (d.hasRack) parts.push({ tris: collectTriangles(buildRack(state)), mode: 'upright' });
    const tris = packSideBySide(parts);
    const b = printBounds(tris);
    if (b.w > 178 || b.d > 178) {
      flash(`too big for one plate (${num(b.w)} mm wide) — export separately`);
      return;
    }
    download(buildSTL(tris, 'plate'), `plate-${slug}.stl`);
    flash('both parts, one plate');
    return;
  }

  if (which === 'coupon') {
    const g = buildCoupon(state);
    const tris = toPrintSpace(collectTriangles(g), 'flat');
    download(buildSTL(tris, 'coupon'), 'pen-test-coupon.stl');
    flash('coupon exported');
  }
}

let flashTimer;
function flash(msg) {
  const fn = $('footnote');
  fn.textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    fn.textContent = 'mm · Y-up preview · Z-up STL';
  }, 3200);
}

/* ------------------------------------------------------------------ binding */

const RANGES = {
  length: (v) => `${v} mm`,
  digitHeight: (v) => `${v} mm`,
  stroke: (v, d) => `${num(d.strokeMm, 2)} mm`,
  tracking: (v) => `${Math.round(v * 100)}%`,
  relief: (v) => `${num(v)} mm`,
  thickness: (v) => `${num(v)} mm`,
  radius: (v) => `${num(v)} mm`,
  padX: (v) => `${v} mm`,
  padY: (v) => `${v} mm`,
  tilt: (v) => `${v}°`,
};

function paintRange(el) {
  const min = Number(el.min);
  const max = Number(el.max);
  const val = Number(el.value);
  const pct = ((val - min) / (max - min)) * 100;
  el.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--panel-2) ${pct}%, var(--panel-2) 100%)`;
}

function updateOutputs(d) {
  for (const [key, fmt] of Object.entries(RANGES)) {
    const out = $(`${key}Out`);
    if (out) out.textContent = fmt(state[key], d);
  }
}

function syncStateFromDOM() {
  state.number = sanitize($('number').value) || '98765 43210';
  for (const k of ['length', 'relief', 'digitHeight', 'stroke', 'tracking', 'thickness', 'radius', 'padX', 'padY', 'tilt']) {
    const el = $(k);
    if (el) state[k] = Number(el.value);
  }
  state.material = $('material').querySelector('button.on').dataset.val;
  state.mode = $('mode').querySelector('button.on').dataset.val;
  state.style = $('style').querySelector('button.on').dataset.val;
  state.mount = $('mount').querySelector('button.on').dataset.val;
  state.profile = $('profile').value;
  state.layout = $('layout').querySelector('button.on').dataset.val;
  state.showInk = $('showInk').checked;
}

function syncDOMFromState() {
  $('number').value = state.number;
  for (const k of ['length', 'relief', 'digitHeight', 'stroke', 'tracking', 'thickness', 'radius', 'padX', 'padY', 'tilt']) {
    const el = $(k);
    if (el) {
      el.value = state[k];
      paintRange(el);
    }
  }
  setSeg('material', state.material);
  setSeg('mode', state.mode);
  setSeg('style', state.style);
  setSeg('mount', state.mount);
  setSeg('layout', state.layout);
  $('profile').value = state.profile;
  $('showInk').checked = state.showInk;
}

function setSeg(id, val) {
  const grp = $(id);
  if (!grp) return;
  for (const btn of grp.querySelectorAll('button')) {
    const on = btn.dataset.val === val;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
  }
}

function rerender() {
  syncStateFromDOM();
  const { d } = updateStats();
  updateOutputs(d);
  refreshRecipe();
  renderScene();
  syncURL();
}

function syncURL() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (DEFAULT_PARAMS[k] !== undefined && v !== DEFAULT_PARAMS[k]) {
      p.set(k, String(v));
    }
  }
  const qs = p.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ''}`;
  history.replaceState(null, '', url);
}

function loadURL() {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of p.entries()) {
    if (DEFAULT_PARAMS[k] === undefined) continue;
    if (typeof DEFAULT_PARAMS[k] === 'number') state[k] = Number(v);
    else state[k] = v;
  }
  if (state.stand !== undefined && state.mount === undefined) {
    state.mount = state.stand === 'none' ? 'none' : 'rack';
  }
}

/* ------------------------------------------------------------------ listeners */

$('number').addEventListener('input', (e) => {
  const clean = sanitize(e.target.value);
  if (clean !== e.target.value) e.target.value = clean;
  rerender();
});

for (const id of ['mode', 'style', 'mount', 'material', 'layout']) {
  $(id).addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    setSeg(id, btn.dataset.val);
    rerender();
  });
}

for (const k of ['length', 'relief', 'digitHeight', 'stroke', 'tracking', 'thickness', 'radius', 'padX', 'padY', 'tilt']) {
  const el = $(k);
  if (el) {
    el.addEventListener('input', () => {
      paintRange(el);
      rerender();
    });
  }
}

$('profile').addEventListener('change', rerender);
$('showInk').addEventListener('change', rerender);

$('reframe').addEventListener('click', () => viewer.resetCamera());

$('dlPanel').addEventListener('click', () => exportOne('panel'));
$('dlRack').addEventListener('click', () => exportOne('rack'));
if ($('dlBase')) $('dlBase').addEventListener('click', () => exportOne('rack'));
$('dlBoth').addEventListener('click', () => exportOne('both'));
$('dlCoupon').addEventListener('click', () => exportOne('coupon'));

$('copyRecipe').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(recipeText());
    flash('settings copied to clipboard');
  } catch {
    flash('copy failed — select manually');
  }
});

/* ------------------------------------------------------------------ boot */

loadURL();
syncDOMFromState();
rerender();
