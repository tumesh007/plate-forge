# Print settings

Bambu Studio names first; OrcaSlicer uses the same names.

## Profile

| Setting | Value | Why |
|---|---|---|
| Layer height | **0.20 mm** (0.30 mm for speed, 0.12 mm for the crispest walls) | 0.6 mm groove = exactly 3 layers at 0.20 |
| Walls | **4** | stiffness in a 3 mm plate; heat resistance |
| Top / bottom shells | **5 / 4** | the digit floor must be a solid skin, not infill |
| Sparse infill | 15 % gyroid | |
| Elephant-foot compensation | **0.15 mm** | otherwise the panel's bottom edge flares and fights the easel slot |
| Seam position | Aligned | |

## Ironing — this is the setting that decides whether the number is paintable

| Setting | Value |
|---|---|
| Ironing type | **All top surfaces** |
| Ironing flow | **10 %** (PETG: 8 %) |
| Ironing line spacing | **0.10 mm** |
| Ironing speed | **30 mm/s** |
| Ironing inset | **0.2 mm** |
| Ironing pattern | Rectilinear, **fixed 45°** |

**"All top surfaces", not "Only topmost".** The groove floors sit 0.6 mm *below* the plate rim.
With "only topmost" the slicer irons the rim, skips all ten digits, and you have wasted a print.
Stock Bambu profiles use 0.15 mm spacing at 10 %; tightening to 0.10 mm is what closes the
inter-layer grooves so ink can't wick sideways.

If the digit floors come out slightly tiger-striped, set the ironing angle to run parallel with
the digit strokes rather than 45°, or drop flow to 8 %.

## Filament

| | PETG (recommended for a car) | PLA (best ink, desk only) |
|---|---|---|
| Nozzle | 255 °C | 215 °C |
| Bed | 70 °C | 60 °C |
| Plate | textured PEI + glue stick | smooth PEI |
| Part cooling | 60 % | 100 % |

PETG bonds to smooth PEI hard enough to tear it. Use textured, or glue stick as a release layer.

## Orientation

Print **exactly as exported**. The panel comes out with its back face on the bed and the number
face up — that is the orientation that makes the groove floor a top surface, which is what lets
ironing work. Do not flip it. The easel comes out standing on its base with a 20° overhang on the
fins, which needs no supports.

## After the print

1. Wipe the number face with **70 % IPA** and let it dry. Skin oil is the main reason ink "doesn't
   stick".
2. Brush a thin **PVA / wood-glue wash** into the grooves with a small flat brush. Let it dry
   completely. **Do not skip this** — it is what stops the ink creeping along the layer seams.
3. Flood each groove with an **oil-based paint pen** (Sharpie Oil-Based, Posca PC-5M). Overfill
   slightly; do not try to stay inside the lines.
4. While the ink is still tacky, wipe the flat face with a barely damp cloth wrapped tight over a
   finger. The rim does the masking for you.
5. Cure 24 h. Then 2 thin coats of **matte UV clear** — matte, because gloss makes the ironing
   tiger-stripes visible.

If a digit is short a bar, it is quicker to touch in with the pen after curing than to reprint.

## If the number has to last a long time

Print the panel in PLA (best ink), then the easel in PETG, and mount the panel **off** the
windscreen with an air gap. A PLA plate that never sees direct sun behind glass is fine; one
against the screen in a Jalandhar May is not.
