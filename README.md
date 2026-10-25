# Plate Forge

A parametric generator for a single-colour, single-sided car parking number plate: a flat
engraved panel that drops into a reusable 30° easel. Sized for a **Bambu Lab A1 mini**.

![Assembled](docs/assembled.png)

No build step, no server, no accounts. Open `index.html` and it runs. Everything — the geometry
and the STL export — happens in the browser.

## Why this shape

- **Engraved, not raised.** A 0.6 mm groove has a rim that acts as a paint dam and a floor the
  slicer can iron flat, so a pen fills it cleanly and wipes clean off the face.
- **Flat panel + separate easel.** The panel prints face up, flat on the bed, in one process with
  no supports. The easel is printed once. Changing the number costs one 15-minute panel rather
  than a whole new plate.
- **Watertight by construction.** The panel is a single closed manifold surface, not two solids
  stacked. A slicer reads an interface sitting exactly on the groove floor as a filled cavity and
  silently swallows the digits; the test suite checks every edge is shared by exactly two triangles.

![Front](docs/front.png)

## Using it

1. Type the number. Only digits, space, `+`, `-`, `.` are accepted.
2. Pick **Engraved** (recommended) or **Raised**.
3. Watch the HUD: it greys out and warns if the job no longer fits the 180 mm bed.
4. **Download** the panel, the easel, or both on one plate.
5. Print the **pen test coupon** first and colour it — it tells you in eight minutes which relief
   depth takes ink best on your filament.

The URL carries your settings, so you can bookmark a configuration.

### Views

- **Assembled** — the product, panel seated in the easel at the chosen rake.
- **As printed** — the actual print orientation the STLs export in.

The pen preview paints the grooves where a marker will land, so you can judge legibility before
committing filament.

## Files

| Path | |
|---|---|
| `index.html`, `css/`, `js/` | the app |
| `js/model.js` | panel, easel, coupon geometry |
| `js/glyphs.js` | 7-segment glyph layout |
| `js/stl.js` | binary STL writer, print-space transform |
| `vendor/three.module.js` | three.js r169, vendored so the site has no CDN dependency |
| `test/check.mjs` | headless geometry tests — manifoldness, volume, bed fit |
| `test/render.mjs` | offline rasteriser, writes the images in `docs/` |
| `OPTIONS.md` | **the research: what the alternatives are and why this one won** |
| `PRINT-SETTINGS.md` | exact slicer settings and the ink workflow |

## Tests

```sh
node test/check.mjs    # manifold + volume + fit checks over 12 configurations
node test/render.mjs   # writes .ppm previews (needs ../node_modules/three shim)
```

The check script asserts that every triangle edge is shared by exactly two triangles, that volume
is positive and finite, that there are no NaN vertices, and that the panel sits on `z = 0` in
printer space.

## Deploying

Static site. Any of these work:

```sh
# GitHub Pages
gh repo create plate-forge --public --source . --push
gh api -X POST repos/:owner/plate-forge/pages -f 'source[branch]=main' -f 'source[path]=/'
```

Because `index.html` is at the repo root and there is no build step, Pages serves it directly.
`.nojekyll` is present so nothing is preprocessed.

## Notes

- Everything is millimetres. The viewport is Y-up; exported STL is Z-up, sitting on `z = 0`.
- The panel is capped at 166 mm wide so the easel still clears the bed. If you type a long number
  the digit height is reduced automatically and the HUD shows the effective height.
- Mass and print-time readouts are estimates from solid volume with a shelling factor, not slicer
  output. Trust them to within ~25 %.
