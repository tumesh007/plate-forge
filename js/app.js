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
} from './model.js?v=3';
import {
  collectTriangles,
  meshVolume,
  toPrintSpace,
  printBounds,
  buildSTL,
  download,
  packSideBySide,
} from './stl.js?v=3';
import { createViewer } from './viewer.js?v=3';
import { sanitize } from './glyphs.js?v=3';

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
 *
 * Takes the already-shelled extrusion volume — a 3 mm plate is nearly all walls and
 * skins, so the plastic actually laid down is well below the solid volume.
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
    seatPanel(panel, state);
    const t = rackTransform(state);
    rack.rotation.x = t.rotX;
    rack.position.set(0, t.y, 0);
    viewer.add(rack);
    viewer.add(panel);
    return;
  }

  // "As printed": rack lying on its back plate, panel flat beside it.
  const standW = d.hasRack ? d.rackWidth : 0;
  const gap = 14;
  const totalW = standW + (d.hasRack ? gap : 0) + d.width;
  let x = -totalW / 2;

  if (d.hasRack) {
    // the rack is authored in its print orientation already
    rack.rotation.x = -Math.PI / 2;
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
  $('mMass').textContent = `≈ ${panelG.toFixed(1)} g`;
  $('mMass').title = d.hasRack
    ? `panel ≈${panelG.toFixed(1)} g + easel ≈${standG.toFixed(1)} g`
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
      `Panel is ${num(f.stripW)} mm wide — over the A1 mini's 180 mm bed. Cut the digit height, the side gap, or the spacing.`,
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

  if (which === 'rack') {
    if (!d.hasRack) {
      flash('no easel with these settings');
      return;
    }
    const g = buildRack(state);
    const tris = toPrintSpace(collectTriangles(g), 'upright');
    download(buildSTL(tris, 'easel'), 'easel.stl');
    flash('easel exported');
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
  const v = Number(el.value);
  const pct = ((v - min) / (max - min)) * 100;
  el.style.setProperty('--pct', `${pct}%`);
}

function syncOutputs() {
  const d = derive(state);
  for (const [key, fn] of Object.entries(RANGES)) {
    const el = $(key);
    const out = $(`${key}Out`);
    if (el) paintRange(el);
    if (out) out.textContent = fn(Number(el?.value ?? state[key]), d);
  }
  // Show the height that will actually be printed — it is capped to fit the bed.
  const capped = d.fitScale < 0.999;
  $('digitHeightOut').textContent = capped
    ? `${state.digitHeight} → ${d.digitHeightEff.toFixed(1)} mm`
    : `${state.digitHeight} mm`;
  $('digitHeightOut').style.color = capped ? 'var(--warn)' : '';
  $('digitHeightOut').title = capped
    ? 'Reduced automatically so the panel fits the A1 mini bed'
    : '';
}

function applyFromUI() {
  for (const key of Object.keys(RANGES)) {
    const el = $(key);
    if (el) state[key] = Number(el.value);
  }
  state.profile = $('profile').value;
  state.showInk = $('showInk').checked;
  syncOutputs();
  renderScene();
  updateStats();
  refreshRecipe();
  persist();
}

function bind() {
  $('number').addEventListener('input', (e) => {
    const clean = sanitize(e.target.value);
    if (clean !== e.target.value) e.target.value = clean;
    state.number = clean;
    syncOutputs();
    renderScene();
    updateStats();
    persist();
  });

  for (const key of Object.keys(RANGES)) {
    const el = $(key);
    if (!el) continue;
    el.addEventListener('input', applyFromUI);
  }

  $('profile').addEventListener('change', applyFromUI);
  $('showInk').addEventListener('change', applyFromUI);

  for (const [id, key] of [
    ['mode', 'mode'],
    ['mount', 'mount'],
    ['material', 'material'],
  ]) {
    const grp = $(id);
    grp.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-val]');
      if (!btn) return;
      for (const b of grp.querySelectorAll('button')) {
        const on = b === btn;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      }
      state[key] = btn.dataset.val;
      if (key === 'mode') {
        $('reliefHint').textContent =
          btn.dataset.val === 'engrave'
            ? 'Rule of thumb: 0.6 mm is two layers at 0.30 mm and three at 0.20 mm — deep enough to hold ink, shallow enough to stay sharp.'
            : 'Raised digits: lay a chisel-tip pen almost flat and swipe, so only the tops catch the ink. Works, but the edge is less forgiving than a groove.';
      }
      applyFromUI();
    });
  }

  const layout = $('layout');
  layout.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    for (const b of layout.querySelectorAll('button')) {
      const on = b === btn;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
    state.layout = btn.dataset.val;
    renderScene();
    viewer.frame();
    persist();
  });

  $('reframe').addEventListener('click', () => viewer.frame());

  $('dlPanel').addEventListener('click', () => exportOne('panel'));
  $('dlRack').addEventListener('click', () => exportOne('rack'));
  $('dlBoth').addEventListener('click', () => exportOne('both'));
  $('dlCoupon').addEventListener('click', () => exportOne('coupon'));

  $('copyRecipe').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(recipeText());
      flash('settings copied');
    } catch {
      flash('copy blocked by the browser');
    }
  });
}

/* ------------------------------------------------------------------ persist */

let persistTimer;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const slim = { ...state };
    delete slim.layout;
    delete slim.showInk;
    history.replaceState(null, '', `#${encodeURIComponent(JSON.stringify(slim))}`);
  }, 350);
}

function restore() {
  const raw = location.hash.slice(1);
  if (!raw) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    Object.assign(state, parsed);
    for (const key of Object.keys(RANGES)) {
      const el = $(key);
      if (el && state[key] !== undefined) el.value = String(state[key]);
    }
    $('profile').value = state.profile;
    $('number').value = state.number;
    for (const [id, key] of [
      ['mode', 'mode'],
      ['mount', 'mount'],
      ['material', 'material'],
    ]) {
      for (const b of $(id).querySelectorAll('button')) {
        const on = b.dataset.val === state[key];
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      }
    }
  } catch {
    /* corrupt hash, ignore */
  }
}

/* ------------------------------------------------------------------ boot */

restore();
bind();
syncOutputs();
renderScene();
updateStats();
refreshRecipe();
viewer.frame();





