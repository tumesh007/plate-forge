// =============================================================================
//  Plate Forge — car parking number plate
//  Single colour, single sided, engraved digits, single-piece grooved wedge stand.
//  Tuned for a Bambu Lab A1 mini (180 × 180 × 180).
//
//  MakerWorld Parametric Model Maker ready:
//    · Customizer-style top level parameters with dropdowns
//    · mw_plate_1() for the printable output
//    · mw_assembly_view() for the assembled preview
//
//  Print the panel back-face-down, number face up, ironing ON ("All top
//  surfaces"). Print the stand standing on its base — no supports either way.
// =============================================================================

/* [The number] */

// Digits, space, + - . only. Up to 14 characters.
number = "98765 43210";

// What to generate on the plate
mode = "both"; // [both:Panel + stand, panel:Panel only, rack:Stand only, coupon:Pen test coupon]

/* [Panel] */

// Target length of the plate in mm (70-100 mm is sweet spot for car dashboards)
plate_length = 95; // [60:5:160]

panel_thickness = 3.0; // [1.6:0.2:4.5]
corner_radius = 4; // [0:0.5:14]
side_gap = 6; // [2:1:26]
end_gap = 5; // [2:1:22]

/* [Digit relief] */

// Engraved = pen sits in the groove. Raised = wipe a pen across the tops.
lettering = "engraved"; // [engraved:Engraved, raised:Raised]

// How deep the groove is / how high the ridge is
relief_depth = 0.6; // [0.3:0.1:1.2]

// Maximum digit cap height
digit_height = 18; // [12:0.5:36]

// Stroke thickness as a fraction of digit height. 0.13 ≈ 2.3 mm at 18 mm digits.
stroke_ratio = 0.13; // [0.10:0.01:0.22]

// Space between segments, fraction of digit height
segment_gap = 0.025; // [0.015:0.005:0.06]

// Space between characters, fraction of digit height
tracking = 0.16; // [0.04:0.01:0.34]

/* [Stand] */

// Rake from vertical. 30° lines up with a modern windscreen.
rake_deg = 30; // [0:1:45]
easel_fin = 4; // [3:0.5:6]
easel_clearance = 0.4;
easel_lip = 8; // [4:1:14]

with_rack = (mode == "both" || mode == "rack");

/* [Hidden] */

$fn = 48;
max_panel_width = 160;
plate_gap = 8;
EPS = 0.01;

// ---------------------------------------------------------------------------
//  Glyph metrics. Everything is in cap-height units: y spans 0..1.
// ---------------------------------------------------------------------------

aspect = 0.62; // digit cell width
narrow = 0.44; // cell width for "1"

// 7-segment membership per digit
SEGS = ["ABCDEF", "BC", "ABGED", "ABGCD", "FGBC", "AFGCD", "AFGECD", "ABC", "ABCDEFG", "ABCDFG"];

function is_digit(ch) =
    let (k = search(ch, "0123456789"))
    len(k) == 0 ? false : (k[0] < 0 ? false : true);

function digit_of(ch) =
    let (k = search(ch, "0123456789"))
    len(k) == 0 ? -1 : k[0];

function char_advance(ch) =
    ch == " " ? 0.34 :
    ch == "+" ? 0.72 :
    ch == "-" ? 0.66 :
    ch == "." ? 0.34 :
    ch == "1" ? narrow :
    aspect;

function advance_sum(s, i = 0, acc = 0) =
    i >= len(s) ? acc : advance_sum(s, i + 1, acc + char_advance(s[i]));

function text_width(s) = advance_sum(s) + tracking * max(0, len(s) - 1);

function offsets(s, i = 0, acc = 0, out = []) =
    i >= len(s) ? out :
    offsets(s, i + 1, acc + char_advance(s[i]) + tracking, concat(out, [acc]));

function fitted_height() =
    let (tw = text_width(number))
    let (scale = min(1, (plate_length - 2 * side_gap) / (tw * digit_height)))
    max(7, min(digit_height, (plate_length - 2 * side_gap) / tw));

function panel_width(s, h) = plate_length;
function panel_height(h) = max(18, h + 2 * end_gap);

// ---------------------------------------------------------------------------
//  Glyphs
// ---------------------------------------------------------------------------

module bar(r, h) {
    translate([r[0] * h, r[1] * h])
        square([(r[2] - r[0]) * h, (r[3] - r[1]) * h]);
}

/**
 * Solid sans-serif typography with continuous strokes, proper 1, 4, and 7.
 */
module digit_glyph(d, h, s, g) {
    cell = d == 1 ? narrow : aspect;
    top = 1 - s;
    mid = 0.5 - s / 2;

    if (d == 1) {
        // Solid classic sans-serif 1: stem, hook with barb, wide base serif
        xc = cell / 2;
        stemL = xc - s / 2;
        stemR = xc + s / 2;
        hookL = max(0, stemL - 1.2 * s);
        bar([stemL, 0, stemR, 1], h);
        bar([hookL, top - 0.01, stemR, 1], h);
        bar([hookL, top - 0.7 * s, hookL + s, top], h);
        bar([0, 0, cell, s], h);
    } else if (d == 4) {
        // True sans-serif 4: continuous full-height stem, continuous crossbar, upper left arm
        rightStemL = cell - s;
        midY = 0.38 - s / 2;
        bar([rightStemL, 0, cell, 1], h);
        bar([0, midY, cell, midY + s], h);
        bar([0, midY, s, 1], h);
    } else if (d == 7) {
        // Banking / Indian 7: top bar, downward hook, diagonal stepped stem, middle crossbar
        bar([0, top - 0.01, cell, 1], h);
        bar([0, top - 0.7 * s, s, top], h);
        steps = 7;
        botX = cell * 0.32;
        topX = cell - s;
        for (k = [0:steps-1]) {
            t0 = k / steps;
            t1 = (k + 1) / steps;
            y0 = t0 * top;
            y1 = min(top + 0.01, t1 * top + 0.01);
            x0 = botX * (1 - t0) + topX * t0;
            bar([x0, y0, x0 + s, y1], h);
        }
        midY = 0.52 - s / 2;
        bar([cell * 0.22, midY, cell * 0.82, midY + s], h);
    } else {
        set = SEGS[d];
        has = function(k) len(search(k, set)) > 0;
        if (has("A")) bar([0, top - 0.005, cell, 1], h);
        if (has("D")) bar([0, 0, cell, s + 0.005], h);
        if (has("G")) bar([0, mid - 0.005, cell, mid + s + 0.005], h);
        if (has("F") && has("E")) bar([0, 0, s, 1], h);
        else if (has("F")) bar([0, mid, s, 1], h);
        else if (has("E")) bar([0, 0, s, mid + s], h);
        if (has("B") && has("C")) bar([cell - s, 0, cell, 1], h);
        else if (has("B")) bar([cell - s, mid, cell, 1], h);
        else if (has("C")) bar([cell - s, 0, cell, mid + s], h);
    }
}

/** One non-digit character. */
module symbol_glyph(ch, h, s, g) {
    if (ch == "+") {
        bar([0.30, 0.06, 0.30 + s, 0.94], h);
        bar([0.02, 0.44 - s / 2, 0.30 - g / 2, 0.44 + s / 2], h);
        bar([0.30 + s + g / 2, 0.44 - s / 2, 0.62, 0.44 + s / 2], h);
    } else if (ch == "-") {
        bar([0.04, 0.44 - s / 2, 0.46, 0.44 + s / 2], h);
    } else if (ch == ".") {
        square([0.18 * h, 0.18 * h]);
    }
}

/** The whole string, centred on x = 0, sitting on y = 0. */
module number_2d(s, h) {
    s_ratio = max(0.10, min(0.22, stroke_ratio));
    g = max(0.015, min(0.06, segment_gap));
    offs = offsets(s);
    tw = text_width(s);
    for (i = [0:len(s) - 1]) {
        ch = s[i];
        translate([(offs[i] - tw / 2) * h, 0]) {
            if (is_digit(ch))
                digit_glyph(digit_of(ch), h, s_ratio, g);
            else
                symbol_glyph(ch, h, s_ratio, g);
        }
    }
}

// ---------------------------------------------------------------------------
//  Panel
// ---------------------------------------------------------------------------

module rounded_rect(w, h, r) {
    rr = max(0, min(r, min(w, h) / 2 - 0.2));
    translate([rr, rr])
        offset(r = rr, $fn = 32)
            square([w - 2 * rr, h - 2 * rr]);
}

/**
 * The number panel. Origin at bottom-center of the back face, z = 0 on build plate.
 */
module panel(str = number, h = -1, thick = panel_thickness, rad = corner_radius) {
    hh = h < 0 ? fitted_height() : h;
    w = panel_width(str, hh);
    hp = panel_height(hh);
    rel = max(0.2, min(1.4, relief_depth));

    translate([-w / 2, 0, 0]) union() {
        difference() {
            linear_extrude(height = thick)
                rounded_rect(w, hp, rad);

            // Dual side keying notches for snap fit with stand keys
            if (with_rack) {
                translate([-1, 5.5, -1])
                    cube([0.9 + 1, 6, thick + 2]);
                translate([w - 0.9, 5.5, -1])
                    cube([0.9 + 1, 6, thick + 2]);
            }

            if (lettering == "engraved")
                translate([w / 2, end_gap, thick - rel])
                    linear_extrude(height = rel + 1)
                        number_2d(str, hh);
        }

        if (lettering == "raised")
            translate([w / 2, end_gap, thick - EPS])
                linear_extrude(height = rel + EPS)
                    number_2d(str, hh);
    }
}

// ---------------------------------------------------------------------------
//  Stand (Single-piece grooved wedge mount)
// ---------------------------------------------------------------------------

function lip_height() = min(easel_lip, max(5, panel_height(fitted_height()) * 0.22));

/**
 * Single-piece grooved wedge stand with dual side keying and zero floating parts.
 */
module stand() {
    hh = fitted_height();
    pw = panel_width(number, hh);
    ph = panel_height(hh);
    th = panel_thickness;
    base = lip_height();

    clSide = 0.4;
    clThick = 0.4;
    slotW = th + clThick;
    slotDepth = 4.0;
    wallThick = 4.0;
    wedgeThick = slotDepth + wallThick;

    halfInner = pw / 2 + clSide;
    totalW = 2 * (halfInner + wedgeThick);

    tanr = tan(rake_deg);
    cosr = cos(rake_deg);
    sinr = sin(rake_deg);
    hb = max(8, ph * 0.86);
    rear = max(18, min(46, ph * 0.62));

    // Outer fins
    A = [-hb * tanr, base + hb];
    B = [0, base];
    C = [0, 0];
    D = [-rear, 0];
    for (sgn = [-1, 1]) {
        xl = sgn > 0 ? halfInner + slotDepth : -halfInner - slotDepth - wallThick;
        translate([xl, 0, 0])
            rotate([0, -90, 0])
                linear_extrude(height = wallThick)
                    polygon(points = [A, B, C, D]);

        // Channel flanges along the rake slope
        chX = sgn > 0 ? halfInner : -halfInner - slotDepth;
        chLen = hb + 2;

        // Back flange
        translate([chX, base, 0])
            rotate([-rake_deg, 0, 0])
                translate([0, 0, -2.4])
                    cube([slotDepth, chLen, 2.4]);

        // Front lip
        translate([chX, base, 0])
            rotate([-rake_deg, 0, 0])
                translate([0, 0, slotW])
                    cube([slotDepth, chLen, 1.8]);

        // Grounding block directly under channel down to bed y=0
        translate([chX, 0, -2.4])
            cube([slotDepth, base, slotW + 4.2]);

        // Dual side key bumps inside the channel (0.5 mm snug fit)
        keyLocalY = 8.5;
        keyWorldY = base + keyLocalY * cosr + (slotW / 2) * sinr;
        keyWorldZ = -keyLocalY * sinr + (slotW / 2) * cosr;
        keyX = sgn > 0 ? halfInner + slotDepth - 0.7 : -halfInner - slotDepth;
        translate([keyX, keyWorldY, keyWorldZ])
            rotate([-rake_deg, 0, 0])
                cube([0.7, 5, slotW * 0.8]);
    }

    // Front plinth (bottom ledge stop + front bridge)
    plinthD = slotW + 3;
    translate([-totalW / 2, 0, -1.5])
        cube([totalW, base, plinthD + 1.5]);

    // Rear tie bar
    translate([-totalW / 2, 0, -rear * 0.7])
        cube([totalW, 4.5, 5.5]);
}

module rack() {
    stand();
}

/** The stand as it prints: sitting flat on its base on the bed. */
module rack_on_bed() {
    stand();
}

/** Panel seated in the stand: it drops into the channels. */
module assembly() {
    base = lip_height();
    stand();
    translate([0, base, 0])
        rotate([-rake_deg, 0, 0])
            panel();
}

// ---------------------------------------------------------------------------
//  Pen test coupon
// ---------------------------------------------------------------------------

module coupon_tile(lg, rd) {
    difference() {
        linear_extrude(height = 2.4)
            rounded_rect(24, 23, 2);
        if (lg == "engraved")
            translate([12, 4, 2.4 - rd])
                linear_extrude(height = rd + 1)
                    digit_glyph(8, 15, max(0.10, min(0.22, stroke_ratio)),
                                max(0.015, min(0.06, segment_gap)));
    }
    if (lg == "raised")
        translate([12, 4, 2.4 - EPS])
            linear_extrude(height = rd + EPS)
                digit_glyph(8, 15, max(0.10, min(0.22, stroke_ratio)),
                            max(0.015, min(0.06, segment_gap)));
}

module coupon() {
    tiles = [for (lg = ["engraved", "raised"]) for (rd = [0.4, 0.6, 0.9]) [lg, rd]];
    n = len(tiles);
    tw = 24;
    gap = 4;
    total = n * tw + (n - 1) * gap;
    for (i = [0:n - 1])
        translate([i * (tw + gap) - total / 2, 0, 0])
            coupon_tile(tiles[i][0], tiles[i][1]);
}

// ---------------------------------------------------------------------------
//  Output
// ---------------------------------------------------------------------------

module plate_contents() {
    hh = fitted_height();
    pw = panel_width(number, hh);
    ph = panel_height(hh);

    if (mode == "panel") {
        panel();
    } else if (mode == "rack") {
        stand();
    } else if (mode == "coupon") {
        coupon();
    } else {
        // Both: stand on bed, panel beside it
        stand();
        translate([0, ph + 8, 0]) panel();
    }
}

module mw_plate_1() {
    plate_contents();
}

module mw_assembly_view() {
    assembly();
}

mw_plate_1();
