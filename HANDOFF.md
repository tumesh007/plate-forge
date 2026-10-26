# HANDOFF: Plate Forge - Car Parking Number Plate Generator

## Project Overview
A parametric generator for a car parking number plate with a slide-in rack mechanism. The plate has engraved/embossed digits and slides into a rack. The project includes a Three.js web app for configuration/preview and an OpenSCAD model for 3D printing.

## Current State (as of latest commit)

### What's Working
- **Browser app** at https://tumesh007.github.io/plate-forge/ (build 6 deployed)
- **Parameterized panel generation** with engraved/embossed digits
- **Rack** with top-loading design (panel drops in from top)
- **Styled digit set** with improved 1 (flag+base) and 4 (full-width crossbar)
- **Detent mechanism** (stepped wedge on rack floor clicks into panel pocket)
- **Cache-busting** via `?v=6` query strings and build version pill
- **All geometry tests pass** (12 configurations, manifold, no NaN/Inf, fits A1 mini bed)

### Key Files
```
plate-forge/
├── index.html              # Main HTML entry
├── css/app.css             # Styles
├── js/
│   ├── app.js              # Main app, UI, scene rendering
│   ├── model.js            # Core geometry (buildPanel, buildRack, buildFoot, etc.)
│   ├── glyphs.js           # 7-segment + styled digit glyphs
│   ├── stl.js              # Binary STL export
│   ├── viewer.js           # Three.js scene setup
│   └── glyphs.js           # Digit glyph definitions
├── openscad/
│   └── plate_forge.scad    # OpenSCAD model (OUT OF SYNC)
├── test/
│   ├── check.mjs           # Geometry validation tests
│   ├── render.mjs          # Offline PPM renders
│   └── render-scad.mjs     # SCAD rendering
├── docs/                   # Rendered images
├── test/                   # Test scripts
├── test/check.mjs          # Geometry validation
├── test/render.mjs         # Renders
├── test/render-scad.mjs    # SCAD renders
├── test/check.mjs          # Geometry tests
└── HANDOFF.md              # This file
```

---

## CURRENT STATE (Build 6 - "base + fixed 4")

### What Works (✅ Verified)
| Feature | Status |
|---------|--------|
| Panel geometry (engraved/embossed) | ✅ Closed manifold, 12 configs pass |
| Rack (top-loading, flat print) | ✅ Closed manifold, 12 configs pass |
| Easel/stand (new buildFoot) | ✅ Builds, manifold |
| Coupon (test coupon) | ✅ |
| STL export | ✅ Binary STL, correct transform |
| Geometry tests | ✅ 12 configs pass (ALL CHECKS PASSED) |
| Cache busting | ✅ v6 deployed with `?v=6` |
| Build stamp | ✅ Shows "build 6 · top-load rack" |

### Current Architecture

**Geometry Pipeline:**
1. `derive(p)` → computes all dimensions from params
2. `buildPanel(p)` → Creates panel with digits (engraved/embossed)
3. `buildRack(p)` → Top-loading rack (panel drops in from top)
4. `buildFoot(p)` → Wedge gusset base (NOT YET WIRED IN)
5. `buildInk()` → Preview ink overlay
6. `buildCoupon()` → Test coupon with 6 variants

**Key Parameters (DEFAULT_PARAMS):**
```javascript
{
  number: '98765 43210',
  mode: 'engrave',           // 'engrave' | 'emboss'
  digitHeight: 18,           // mm
  stroke: 0.13,              // fraction of height
  gap: 0.025,                // gap between segments
  tracking: 0.16,            // char spacing
  aspect: 0.62,              // width/height ratio
  relief: 0.6,               // engrave/emboss depth
  thickness: 3.0,            // panel thickness
  radius: 4,                 // corner radius
  padX: 8, padY: 6,          // padding
  mount: 'rack',             // 'rack' | 'none'
  tilt: 30,                  // degrees
  material: 'PETG',
  profile: 'standard',       // 'fast' | 'standard' | 'fine'
  style: 'styled',           // 'styled' | 'digital'
  profile: 'standard'        // 'fast' | 'standard' | 'fine'
}
```

**RACK Constants:**
```javascript
const RACK = {
  cl: 0.35,       // side clearance
  topCl: 1.1,     // headroom
  tb: 2.6,        // back plate thickness
  bw: 6,          // border width
  pillarT: 3.5,   // pillar width
  pillarH: 6,     // pillar height
  lipT: 1.6,      // lip thickness
  lipIn: 3.0,     // lip overlap
  wCl: 0.25,      // panel-back clearance
  grip: 6,        // panel overhang
  detent: 0.9,    // detent depth
  fin: 4          // fin thickness
};
```

---

## CRITICAL ISSUES TO FIX

### 1. 🔴 Assembled vs Unassembled Views Don't Match (CRITICAL)

**Problem:** In `app.js` `renderScene()`, the "assembled" and "as printed" views use different coordinate systems.

**Current code (app.js lines 77-110):**
```javascript
// Assembled view - rack is rotated by rackTransform (-tilt)
if (state.layout === 'assembled') {
  seatPanel(panel, state);
  const t = rackTransform(state);
  rack.rotation.x = t.rotX;
  rack.position.set(0, t.y, 0);
  viewer.add(rack);
  viewer.add(base);           // ← NO TRANSFORM! Placed at origin
  viewer.add(panel);
  return;
}

// "As printed" - rack lying on back, panel flat beside
rack.rotation.x = -Math.PI / 2;  // rack flat
rack.position.set(x + standW / 2, 0, 0);
viewer.add(rack);
base.position.set(x + standW / 2, 0, 0);  // Overlaps rack!
viewer.add(base);
```

**Problems:**
1. **Assembled view**: Base added at origin (0,0,0) with NO transform, but rack is at y=lipH, rotated by -θ. They don't align.
2. **Printed view**: Base positioned at SAME location as rack (overlapping), rack rotated -90° (flat), base NOT rotated.
3. The `buildFoot()` exists but isn't properly integrated.

### 2. Digit Issues (7, 4, 1)
- **7**: Still looks incomplete - the top bar + right stem don't form a clear "7"
- **4**: Still looks like "9" - the current fix (full-width crossbar + open top) makes it look like a 9
- **1**: Missing proper serif/flag - still looks like "I" or "l"

### 3. OpenSCAD File Out of Sync
`openscad/plate_forge.scad` has the OLD easel design, not the current rack design.

### 4. No Base/Foot Printed
The `buildFoot()` exists but isn't integrated into the export pipeline properly.

### 4. Font/Styling Issues
- **7**: Top bar + right stem should form clear 7
- **4**: Current "full crossbar + open top" looks like 9
- **1**: Still looks like "I" or "l", needs proper flag and base serif

---

## Immediate Fixes Required

### 1. Fix renderScene() - CRITICAL
```javascript
// In app.js renderScene()
if (state.layout === 'assembled') {
  seatPanel(panel, state);
  const t = rackTransform(state);
  rack.rotation.x = t.rotX;
  rack.position.set(0, t.y, 0);
  viewer.add(rack);
  
  // FIX: Position base under rack with same transform
  const base = buildFoot(state);
  base.rotation.x = state.tilt * deg;
  base.position.set(0, state.lipH, 0);  // Match rack position
  viewer.add(base);
  
  viewer.add(panel);
  return;
}

// "As printed" - lay flat on bed
const standW = d.hasRack ? d.rackWidth : 0;
const gap = 14;
const totalW = standW + (d.hasRack ? gap : 0) + d.width;
let x = -totalW / 2;

if (d.hasRack) {
  // rack prints flat on its back
  rack.rotation.x = -Math.PI / 2;
  rack.position.set(x + standW / 2, 0, 0);
  viewer.add(rack);
  
  // Base prints separately, flat
  base.rotation.x = -Math.PI / 2;
  base.position.set(x + standW + gap + d.rackWidth/2, 0, 0);
  viewer.add(base);
  x += d.rackWidth + gap;
}
panel.rotation.x = -Math.PI / 2;
panel.position.set(x + d.width / 2, 0, d.height / 2);
viewer.add(panel);
```

### 2. Fix Digit Glyphs (7, 4, 1)

**Current issues in `glyphs.js`:**
- `styledDigitBars(4)` - still looks like 9
- **1** needs: flag at top-left + base serif
- **7**: needs clear top bar + diagonal stroke (or rectilinear approximation)
- **4**: Needs proper closed counter (top bar + crossbar + left vertical)

```javascript
// In glyphs.js - styledDigitBars function
if (d === 4) {
  // 4: Full-width crossbar, open top, left vertical, right stem
  const mid = 0.5 - s / 2;
  return [
    [0, mid, cell, mid + s],           // crossbar full width
    [0, mid + s + gap, s, 1 - s - gap], // left arm
    [cell - s, mid + s + gap, cell, 1 - s - gap], // stem above
    [cell - s, s + gap, cell, mid - gap], // stem below
  ];
}
```

For **1**: add flag + base serif (already implemented in `styledDigitBars`)

### 3. Integrate Foot/Base Properly
```javascript
// In renderScene - "As printed" view
// Add base with proper transform
base.rotation.x = -Math.PI / 2;  // lay flat
base.position.set(x + standW + gap + d.rackWidth/2, 0, 0);
viewer.add(base);
```

### 4. Update OpenSCAD file
The `openscad/plate_forge.scad` needs complete rewrite to match current JS model.

---

## File Structure Reference

### Key Files to Modify

| File | Purpose | Status |
|------|---------|--------|
| `js/model.js` | Core geometry (buildPanel, buildRack, buildFoot) | ✅ Core done, needs seatPanel fix |
| `js/glyphs.js` | Digit glyph generation | ⚠️ 4 needs fix, 1 needs flag |
| `js/app.js` | UI, scene rendering, export | ❌ renderScene broken |
| `js/glyphs.js` | Digit glyph generation | 4 needs fix |
| `js/app.js` | UI, scene, exports | ❌ renderScene broken |
| `js/model.js` | Core geometry | ⚠️ seatPanel needs fix |
| `openscad/plate_forge.scad` | OpenSCAD model | **OUT OF SYNC** |
| `test/check.mjs` | Geometry validation | ✅ All pass |

---

## Build/Deploy Commands

```bash
# Run tests
cd plate-forge
node test/check.mjs

# Render test images
node test/render.mjs
python -c "from PIL import Image; [Image.open(f'plate-forge/test/{n}.ppm').save(f'{n}.png') for n in ['assembled','printed','front','zoom-bare','zoom-ink']]"

# Deploy
git add -A
git commit -m "message"
git push origin main
# GitHub Pages auto-deploys from main branch
```

---

## Priority Order for Next Agent

1.  **CRITICAL**: Fix `renderScene()` in `app.js` - assembled view doesn't match printed view
2. **CRITICAL** - Fix digit 4 glyph (currently looks like 9)
3. **HIGH** - Wire up base/foot properly in scene and export
4. **HIGH** - Update OpenSCAD file to match current JS model
5. **MEDIUM** - Fix digit 7 and 1 glyphs
5. Update OpenSCAD file to match JS model
6. Add cache-busting and build version display (already done)

---

## Design Decisions & Constraints

### Hard Constraints (DO NOT CHANGE)
1. **Rectilinear grid only** - All geometry must be axis-aligned rectangles. No diagonals, no curves. This is what makes the engraving print cleanly with vertical walls.
2. **7-segment skeleton** - Digits built from 7 segments (A-G) with gaps. This ensures printable vertical walls.
3. **No CSG operations** - Only box/union of boxes. Boolean operations break manifold tests.
4. **Manifold requirement** - Every edge must be shared by exactly 2 triangles. Test enforces this.
5. **Print orientation** - Parts must print flat (Z-up) without supports. Overhangs ≤ 45°.

### Design Constraints
- **A1 Mini bed**: 180×180mm max
- **Print orientation**: Parts must be printable flat (Z-up) or with minimal overhangs (<45°)
- **Material**: PETG (default) or PLA
- **Single color**: Single extruder, single color

---

## Commands Quick Reference

```bash
# Run tests
cd plate-forge
node test/check.mjs

# Render test images
node test/render.mjs
python -c "from PIL import Image; [Image.open(f'plate-forge/test/{n}.ppm').save(f'{n}.png') for n in ['assembled','printed','front','zoom-bare','zoom-ink']]"

# Deploy
git add -A
git commit -m "message"
git push origin main

# Verify live deployment
curl -s https://tumesh007.github.io/plate-forge/ | grep "build"
```

---

## Quick Reference: Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `derive(p)` | model.js | Compute all dimensions from params |
| `buildPanel(p)` | model.js | Create panel with digits |
| `buildRack(p)` | model.js | Top-loading rack (flat print) |
| `buildFoot(p)` | model.js | Wedge gusset base (NOT YET WIRED) |
| `seatPanel()` | model.js | Position panel in rack for preview |
| `rackTransform()` | model.js | Returns {rotX, y} for rack tilt |
| `renderScene()` | app.js | **BROKEN** - needs fix |
| `buildPanel()` | model.js | Creates panel with digits |
| `buildRack()` | model.js | Top-loading rack (flat print) |
| `buildFoot()` | model.js | Base wedge (NOT INTEGRATED) |
| `buildInk()` | model.js | Preview ink overlay |
| `buildCoupon()` | model.js | Test coupon |

---

## Debugging Tips

```javascript
// Debug geometry in console
const panel = buildPanel(state);
console.log('panel bbox:', new THREE.Box3().setFromObject(panel).getSize(new THREE.Vector3()));

// Check manifold
const tris = collectTriangles(panel);
const edges = countEdges(triangles); // should be 2 per edge

// Check STL export
const tris = collectTriangles(mesh);
const stl = buildSTL(tris, 'name');
```

---

## Git Commands
```bash
cd plate-forge
git add -A
git -c core.autocrlf=false commit -m "message"
gh auth token | xargs -I {} git -c "http.extraheader=AUTHORIZATION: basic {}" push
```

---

## Live URL
https://tumesh007.github.io/plate-forge/

---

## Contact / Context
- User: Tumesh (GitHub: tumesh007)
- Printer: Bambu Lab A1 mini (180mm bed)
- Material: PETG (preferred) or PLA
- Goal: Functional parking plate with slide-in mechanism, printable without supports