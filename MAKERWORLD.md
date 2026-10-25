# MakerWorld upload

Copy-paste material for the listing. Everything here matches the files in this repo.

## Title

**Parametric Parking Number Plate — Engraved, Re-Letter in 15 Minutes**

## Short description (the one-line summary)

A flat engraved number panel and a reusable 30° easel. Change the number without reprinting the stand.

## Description

```
MOST parking plates make you reprint the whole thing when the number changes. This one splits
the job in two.

  · The NUMBER PANEL is a flat 3 mm plate with the digits engraved 0.6 mm into the face.
    It prints face up, flat on the bed, in about 15 minutes. Changing the number means
    printing one new panel — not a new plate.

  · The EASEL holds it at 30° and is printed once. It has a plinth that doubles as the front
    lip, so the panel drops in, sits against the two side fins, and lifts straight out.

WHY ENGRAVED
A groove has a raised rim around it that acts as a paint dam, and its floor is a horizontal
top surface the slicer can iron flat. That means a permanent marker fills the digit cleanly
and wipes off the face without wandering. It also means the groove walls are vertical, so
the digit outline is exactly as sharp as the model — no layer stair-stepping.

PRINTING
  Both parts fit a 180 x 180 bed together. No supports anywhere.
  Layer 0.20 mm · 4 walls · 5 top / 4 bottom · 15% gyroid · elephant foot 0.15 mm
  Ironing: ALL TOP SURFACES at 10% flow, 0.10 mm spacing, 30 mm/s
  Plate: textured PEI for PETG (glue stick as release)

  ⚠ Ironing MUST be "All top surfaces", not "Only topmost". The groove floors sit below the
    plate rim, so "topmost" irons the rim, skips every digit, and wastes the print. This is
    the single setting people get wrong.

PAINTING THE NUMBER
  1. Wipe the face with 70% IPA.
  2. Brush a thin PVA / wood-glue wash into the grooves and let it dry completely.
     This is the step that stops the ink creeping along the layer lines. Don't skip it.
  3. Flood with an oil-based paint pen (Sharpie Oil-Based, Posca PC-5M).
  4. While tacky, wipe the flat face with a barely damp cloth. The rim does the masking.
  5. Cure 24 h, then two thin matte UV clear coats.

MATERIAL — PLEASE READ
  PETG if the plate lives in the car. PLA is the easier plastic to ink, but it softens at
  57-60 °C and a dashboard reaches 70-80 °C in summer — it will sag over a few hot afternoons.
  ASA would be ideal and this machine cannot print it. The default is PETG, and the glue wash
  in step 2 is what buys back the ink adhesion.

  The panel is 3 mm thick on purpose. Anything thinner will not hold shape on a dashboard.

PRINT THE COUPON FIRST
  There's a pen test coupon in the customizer: the same digit in both relief styles at 0.4,
  0.6 and 0.9 mm. Eight minutes. Colour it and keep whichever combination is cleanest on
  your filament — that turns every claim above into a measurement on your own stock.

PARAMETRIC OPTIONS
  number · engraved or raised · groove depth · digit height · stroke weight · spacing ·
  panel thickness · corner radius · margins · rake angle 0-45°
  The digit height shrinks automatically if your number would overflow the bed.
```

## Tags

`parking plate`, `car`, `phone number`, `parametric`, `customizable`, `openscad`,
`number plate`, `dashboard`, `easel`, `stand`, `single colour`, `a1 mini`, `functional`

## Print profile notes

| | |
|---|---|
| Printer | Bambu Lab A1 mini (fits A1 / P1 / X1 too) |
| Plate | Textured PEI |
| Filament | PETG, white or light colour, 1 spool |
| Estimated time | ~35 min for panel + easel together |
| Filament | ~18 g total |
| Supports | none |

## Files to attach

| File | |
|---|---|
| `plate_forge.scad` | the parametric source — enable the Customizer |
| `Plate-Forge.pdf` | the documentation, good as an attachment |
| `plate-forge-panel.stl` | default 11-character panel, 158 × 30 × 3 |
| `plate-forge-easel.stl` | the easel, 167 × 28 × 32 |
| `plate-forge-coupon.stl` | the pen test coupon |

## Licence suggestion

CC BY-NC-SA 4.0 is the usual choice for functional parametric models on MakerWorld — it lets
people remix the geometry while stopping someone selling prints. CC0 if you want it to be
genuinely free.

## Before you publish

- [ ] Render the customizer at least once with a *different* number and a different rake, and
      confirm it does not error or overflow the bed.
- [ ] Confirm `mw_plate_1()` produces both parts on one plate.
- [ ] Check the default renders in the customizer preview, not just locally.
- [ ] Strip any personal number out of the default parameter before uploading.
