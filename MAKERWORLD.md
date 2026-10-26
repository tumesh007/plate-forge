# MakerWorld Publication Package

Model Page: https://makerworld.com/en/models/3496653-parametric-car-parking-number-plate#profileId-3993980

Copy-paste material for the MakerWorld listing, print profiles, and image gallery.

---

## Title

**Parametric Car Parking Number Plate — Reusable Monolithic Stand with Dual Side Snap-Locks**

## Short Description (Summary)

Compact single-colour dashboard parking plate with engraved paint-dam digits, customizable length (60–160 mm), and reusable 30° stand with dual side snap-locks. No AMS required.

---

## MakerWorld Listing Description (Copy-Paste Text)

```markdown
MOST car parking number plates require reprinting the entire assembly whenever a phone number changes. **Plate Forge** splits the design into two functional components:

1. **The Number Panel:** A flat 3.0 mm plate with digits engraved 0.6 mm deep into the face. It prints flat on the bed in ~15 minutes with zero supports. Changing your phone number means printing only a single 10-gram panel.
2. **The Reusable Stand:** A monolithic 30° angled stand with grooved vertical side channels and dual side key detents. The plate drops in from the top, snaps into the side locks with a 0.5 mm snug click fit, and stays rattle-free on rough roads.

---

### Key Engineering Features

- **Dual Side Key Snap-Locks:** 0.8 mm chamfered detents on both channel walls engage the plate's side notches with 0.5 mm snug clearance. Eliminates bottom rattle and prevents the plate from tipping forward during hard braking.
- **100% Grounded Monolithic Uprights:** Uprights are modeled as continuous 8-point 2D extruded profiles from the bed surface ($y = 0$). Zero mid-air islands, zero bridging gaps, zero supports needed.
- **Continuous Typography Engine:** Digits (including 1, 4, and 7) are rendered as solid, continuous glyphs with cell-boundary wall emission—eliminating artificial 7-segment gaps while maintaining clean single-extrusion perimeters.
- **Compact Dashboard Footprint:** Default length is 95 mm (scaled from 60 to 160 mm). Sits neatly on car dashboards without obstructing the windshield view.

---

### Why Engraved Digits (Single-Colour Workflow)

Engraved digits form a recessed paint dam with a raised perimeter rim. The recessed floor is a flat horizontal top surface that your slicer irons mirror-smooth:
- An oil-based paint pen or acrylic marker floods the groove.
- A cloth barely dampened with IPA wipes cleanly across the flat face; the raised rim acts as a physical stencil dam.
- Vertical groove walls ensure zero layer stair-stepping—edges remain as razor-sharp as the CAD model.

---

### Recommended Print Settings (Bambu Lab A1 Mini / A1 / P1 / X1)

| Parameter | Value | Reason |
| :--- | :--- | :--- |
| **Material** | **PETG** (White / Light Grey) | Dashboard summer heat reaches 70–80 °C. PLA sags at 55–60 °C. |
| **Build Plate** | Textured PEI | Clean release for PETG (thin glue stick layer recommended). |
| **Layer Height** | 0.20 mm Standard | Crisp vertical groove walls and strong channel lips. |
| **Wall Loops** | 4 walls | Ensures channel lips, base, and perimeter are 100% solid. |
| **Top / Bottom Shells** | 5 Top / 4 Bottom | Prevents pillowing under ironed groove floors. |
| **Infill** | 15% Gyroid | Uniform strength, zero resonance. |
| **Ironing** | **All Top Surfaces** | **CRITICAL:** Do NOT use "Only topmost". Groove floors sit 0.6 mm below the rim. "All top surfaces" irons the floor smooth for inking. |
| **Ironing Flow / Speed** | 10% flow · 30 mm/s · 0.10 mm spacing | Glass-smooth floor with zero filament gouging. |
| **Supports** | **NONE** (0 supports) | All overhangs are $\le 30^\circ$ from vertical. |

---

### 5-Minute Inking Guide (Permanent & Weatherproof)

1. **Degrease:** Wipe the plate face with a lint-free wipe and 70% Isopropyl Alcohol (IPA).
2. **Seal Layer Lines (Crucial):** Brush a thin PVA / wood-glue wash (70% PVA, 30% water) into the grooves and let dry 15 minutes. This seals filament micro-crevices and stops ink wicking along layer lines.
3. **Flood Inking:** Flood the groove with a black oil-based paint pen (Sharpie Oil-Based, Uni-Posca PC-5M, or Sakura Pen-Touch 2.0 mm).
4. **Wipe Face:** While the ink is still wet/tacky, wrap a microfiber cloth flat around a wooden block, barely dampen with IPA, and make one clean pass across the top surface. The rim protects the groove.
5. **Clear Coat:** Allow 24 hours cure, then mist with two thin coats of matte UV-resistant acrylic clear coat.

---

### Calibrate First: The Pen Test Coupon

Before committing a full plate, print the included `plate-forge-coupon.stl` (8-minute print, ~4 g filament). It features test digits in engraved and embossed reliefs across 0.4 mm, 0.6 mm, and 0.9 mm depths. Ink each sample to verify your filament's exact flow rate and marker compatibility.

---

### Parametric Customizer (OpenSCAD & Web)

Download `plate_forge.scad` to customize directly inside Bambu Studio / OpenSCAD:
- `number`: Phone number or text (supports spaces and `+91` international prefixes).
- `length`: Overall plate length (60 to 160 mm; default 95 mm).
- `rake_deg`: Viewing angle (20° to 45°; default 30°).
- `relief_depth`: Groove depth (0.2 to 1.4 mm; default 0.6 mm).
- `lettering`: `"engraved"` (paint-dam) or `"raised"` (embossed).
```

---

## Tags

`parking plate`, `car parking`, `phone number plate`, `parametric`, `customizable`, `openscad`, `bambu lab a1 mini`, `dashboard`, `easel`, `sliding lock`, `single colour`, `ironing`, `functional print`, `petg`

---

## Image Gallery Upload Order

| Image File | MakerWorld Position | Purpose / Caption |
| :--- | :--- | :--- |
| `docs/assembled.png` | **1. Main Cover / Hero** | Assembled parking plate seated in the 30° stand with black paint-dam inking. |
| `docs/print-plate.png` | **2. Print Bed Layout** | Both parts oriented flat on the Bambu Lab A1 Mini bed ($180 \times 180\text{ mm}$), zero supports. |
| `docs/lock-detail.png` | **3. Functional Detail** | Macro view of grooved side channel and 0.5 mm snug-fit snap lock detent. |
| `docs/detail.png` | **4. Inking Quality** | Close-up of 0.6 mm deep paint dam and solid continuous sans-serif digits. |
| `docs/easel.png` | **5. Stand Architecture** | Monolithic 8-point profile with 100% bed grounding and front plinth stop. |
| `docs/coupon.png` | **6. Calibration Coupon** | 6-tile pen test coupon (0.4, 0.6, 0.9 mm engraved/embossed) for flow calibration. |

---

## Files Included in Release

| File Path | Description | Dimensions |
| :--- | :--- | :--- |
| `stls/plate-forge-both.stl` | Combined print plate (Panel + Stand together) | Fits $180 \times 180\text{ mm}$ bed |
| `stls/plate-forge-panel.stl` | Number panel (default 10-digit, 95 mm) | $95.0 \times 21.9 \times 3.0\text{ mm}$ |
| `stls/plate-forge-stand.stl` | Monolithic grooved wedge stand | $103.9 \times 27.1 \times 25.8\text{ mm}$ |
| `stls/plate-forge-coupon.stl` | Pen test coupon (6 calibration tiles) | $80.0 \times 23.0 \times 2.4\text{ mm}$ |
| `openscad/plate_forge.scad` | Fully parametric OpenSCAD source code | Customizer-enabled |
| `Plate-Forge-Documentation.docx`| Complete engineering dossier with figures | Office Open XML format |

---

## Licence

**CC BY-NC-SA 4.0** (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International).
Permits personal remixing and non-commercial printing while protecting creator attribution.
