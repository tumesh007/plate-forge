# Your options

A 30-second summary, then the reasoning.

**Do this:** a flat engraved number panel, printed once per number, dropped into a separate
reusable 30° easel. Print the easel in PETG, colour the grooves with an oil-based paint pen.

**Why not the obvious thing:** every *swappable* mechanism on the market — rotary dials, digit
tiles, snap clamshells — either needs supports, has a dozen loose parts, or has fragile pins that
users report snapping. None of them beats simply reprinting a thin flat panel, and a thin flat
panel is what makes the number surface printable *and* paintable.

**Why not your double-sided profiles:** they are the slowest shape possible for this job. You are
printing two display faces and a body. A single 3 mm panel with the digits 0.6 mm deep is roughly
a fifth of the plastic.

---

## 1. The decision that actually matters: what you print it in

Two of your own requirements pull against each other, and only you can break the tie.

| | PLA | PETG |
|---|---|---|
| Marker / paint takes to it | **good** — mildly forgiving of a missed primer | **poor** — acrylic "beads into islands within seconds"; primer is not optional |
| Glass transition (softens) | 57–60 °C | 80–85 °C |
| A dashboard in an Indian summer | 70–80 °C, more against glass | marginal but survives |
| Verdict | sags over a few hot afternoons | correct choice, but it fights the ink |

[Read: [filament/heat](https://evezone.evetech.co.za/deep-dives/best-filament-for-high-heat-parts-why-abs-survives-a-hot-car-dashboard), [paint on PLA vs PETG](https://printforgehq.com/best-paint-for-pla-petg-prints/)]

ASA would settle it, and an A1 Mini cannot print ASA (open frame, ~80 °C bed against the 90–110 °C
ASA wants). So: **PETG if it lives in the car, PLA if it lives on a desk.** The generator defaults
to PETG and the prep step below is what buys back the ink adhesion.

## 2. Mechanism options, with real numbers

| Family | Parts | Claimed print | Cost to change the number | Problem |
|---|---|---|---|---|
| One-piece, digits embossed or engraved | 1 | **26 min / 11 g**, no supports | reprint the whole thing | none, if the number never changes |
| **Separate easel + flat panel that drops in** | 2 | easel once, then **~15 min / 11 g** per panel | **one panel** | none — this is what the app builds |
| Individual digit tiles in a rail | base + 11 | more than one plate | swap a tile in seconds | 11 loose parts to print, lose, and wear out |
| Rotating drum / disc dials | 11 wheels + housing | **3.0–3.1 h, supports required** | spin it | slowest; designer himself: "I don't know if the temperature inside the car will cause it to deform… I think it will" |
| Two-part snap / clamshell | 2 | 1.3–1.6 h | swap the insert | users: "it broke with the slightest touch"; "the pins… break even if dropped" — a V2 was issued |
| Magnetic overlay | 2+ | — | lift off | extra hardware, and magnets near a dash are a bad idea |
| Your double-sided profiles | 1 | ~2× a single face | reprint both faces | what you already know is too slow |

[Read: [Minimalist plate 26 min/11 g](https://makerworld.com/en/models/3177870-minimalist-parking-plate-customizable),
[rotary dials 3 h + supports](https://makerworld.com/en/models/1839068-all-digital-parking-number-plate),
[snap plate failures](https://makerworld.com/en/models/2630087-modular-parking-number-plate),
[PETG 2-part 2 h / 38 g](https://makerworld.com/en/models/3035761-car-parking-phone-number-display-2-part-petg)]

The one row that matters: **the easel is printed once, so a slide-in panel costs exactly the same
as a one-piece plate.** You get the swappability for free. That is the whole argument for the
two-part design, and it is why the app is built around it.

## 3. How to make the number face actually take a pen

This is where most designs quietly fail, and the evidence is specific:

- **Engraved beats raised for marker fill.** A groove has a raised rim around it that acts as a
  paint dam, and its floor is a *top* surface the slicer can iron flat. Raised ridges make you
  trace the ridge tops and bleed onto the plate. (The one designer I found who has done both on a
  real product went engraved → raised, but that was brush-painting 2 mm wheels, not flood-and-wipe
  on 3 mm strokes. [Read](https://makerworld.com/en/models/1839068-all-digital-parking-number-plate))
- **Ironing must be "All top surfaces", not "Only topmost".** Your 0.6 mm grooves sit below the
  plate rim; "topmost" would iron the rim and skip all ten digits. This is the single setting most
  people get wrong. [Read](https://www.orcaslicer.com/wiki/print_settings/quality/quality_settings_ironing)
- **Ink wicks along layer lines.** This is documented and tested, and it is capillary, not
  sloppiness. The cheapest fix that works is a **PVA / school-glue wash** brushed into the grooves
  and dried before you flood them; clear lacquer also works but is slower and dearer.
  [Read](https://3dprinting.stackexchange.com/questions/24083)
- **Use an oil-based paint pen**, not a normal alcohol Sharpie — the oil-based ones bond to plastic
  far better. Wipe the plate with 70 % IPA first. [Read](https://choosemarker.com/how-to-keep-permanent-marker-on-plastic/)
- **Skip the wall chamfer.** A chamfer on the groove rim gives paint a wedge to sit in and fuzzes
  the wiped edge. Vertical walls are what you want — and they also mean no layer stair-stepping,
  so the digit outline is exactly as sharp as the model.

## 4. Tilt

**30°** is the figure a designer actually documented ("a perfect 30-degree viewing angle for
maximum visibility through the windshield"). [Read](https://makerworld.com/en/models/2630087-modular-parking-number-plate)
Modern windscreens rake 25–35° from horizontal, so a 30–35° face reads close to perpendicular to
someone standing outside. Below about 20° it reads as a flat plate. The app defaults to 30° and
lets you go to 45°.

## 5. What I'd do, concretely

1. Print the **pen test coupon** first — six digits, 8 minutes, both relief styles at three
   depths. Colour it and keep whichever combination is cleanest on *your* filament. Do not skip
   this; it turns an opinion into a measurement.
2. Print the **easel** in white PETG, 4 walls, 15 % infill.
3. Print the **panel** in white PETG, 3 mm, 0.6 mm grooves, ironing on.
4. IPA wipe → glue wash in the grooves → dry → flood with a paint pen → wipe the face while tacky
   → cure 24 h → two thin matte UV clear coats.
5. When the number changes, reprint 15 minutes of panel. The easel never prints again.

If the number genuinely never changes, print the one-piece version instead and save the easel
print. The app gives you both from the same panel.

## 6. What I did not choose, and why

- **AMS / two-colour digits.** You said single colour, and a colour swap adds a purge tower and
  triples the print time.
- **Magnets.** Extra hardware, and a recessed magnet pocket on a 3 mm plate means a 1.6 mm wall.
- **Suction cup or clip mount.** Mechanical design with no payoff for this job; a 20 g easel on the
  dash is simpler and doesn't fall off.
- **Text on a curved surface.** Nozzle can't do it cleanly at 0.2 mm.

All figures above are what the source actually says; where I have extrapolated (the `~15 min`
panel figure, the easel mass) it is marked as an estimate in the app rather than presented as fact.
