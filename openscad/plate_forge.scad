// =============================================================================
//  Plate Forge — car parking number plate
//  Single colour, single sided, engraved digits, reusable 30° easel.
//  Tuned for a Bambu Lab A1 mini (180 × 180 × 180).
//
//  MakerWorld Parametric Model Maker ready:
//    · Customizer-style top level parameters with dropdowns
//    · mw_plate_1() for the printable output
//    · mw_assembly_view() for the assembled preview
//
//  Why engraved: a 0.6 mm groove has a rim that acts as a paint dam and a floor
//  the slicer can iron flat, so a permanent marker fills it cleanly and wipes off
//  the face. Vertical groove walls mean no layer stair-stepping in the outline.
//
//  Print the panel back-face-down, number face up, ironing ON ("All top
//  surfaces"). Print the easel standing on its base — no supports either way.
//  Full settings are in PRINT-SETTINGS.md.
// =============================================================================

/* [The number] */

// Digits, space, + - . only. Up to 14 characters.
number = "98765 43210";

// What to generate on the plate
mode = "both"; // [both:Panel + rack, panel:Panel only, rack:Rack only, coupon:Pen test coupon]

/* [Digit relief] */

// Engraved = pen sits in the groove. Raised = wipe a pen across the tops.
lettering = "engraved"; // [engraved:Engraved, raised:Raised]

// How deep the groove is / how high the ridge is
relief_depth = 0.6; // [0.3:0.1:1.2]

// Digit cap height. Reduced automatically if the plate would not fit the bed.
digit_height = 18; // [12:0.5:36]

// Stroke thickness as a fraction of digit height. 0.13 ≈ 2.3 mm at 18 mm digits.
stroke_ratio = 0.13; // [0.10:0.01:0.22]

// Space between segments, fraction of digit height
segment_gap = 0.025; // [0.015:0.005:0.06]

// Space between characters, fraction of digit height
tracking = 0.16; // [0.04:0.01:0.34]

/* [Panel] */

panel_thickness = 3.0; // [1.6:0.2:4.5]
corner_radius = 4; // [0:0.5:14]
side_gap = 8; // [2:1:26]
end_gap = 6; // [2:1:22]

/* [Easel] */

// Rake from vertical. 30° lines up with a modern windscreen.
rake_deg = 30; // [0:1:45]
easel_fin = 4; // [3:0.5:6]
easel_clearance = 0.4;
easel_lip = 10; // [4:1:14]

with_rack = (mode == "both" || mode == "rack");

/* [Hidden] */

$fn = 48;
max_panel_width = 166;
plate_gap = 8;
EPS = 0.01;

// ---------------------------------------------------------------------------
//  Glyph metrics. Everything is in cap-height units: y spans 0..1.
// ---------------------------------------------------------------------------

aspect = 0.62; // digit cell width
narrow = 0.36; // cell width for "1"

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

// x offset (in cap-height units) of each character
function offsets(s, i = 0, acc = 0, out = []) =
    i >= len(s) ? out :
    offsets(s, i + 1, acc + char_advance(s[i]) + tracking, concat(out, [acc]));

/** Cap height after shrinking the layout to fit the plate width. */
function fitted_height() =
    let (tw = text_width(number) * digit_height)
    let (scale = min(1, (max_panel_width - 2 * side_gap) / tw))
    digit_height * scale;

/** Panel width for a given string and height. */
function panel_width(s, h) = text_width(s) * h + 2 * side_gap;
function panel_height(h) = h + 2 * end_gap;

// ---------------------------------------------------------------------------
//  Glyphs
// ---------------------------------------------------------------------------

/**
 * Segment rectangles of one digit in cap-height units.
 * Horizontal bars run the full cell width; verticals stop short of them, which
 * is what makes a 7-segment digit read as a digit instead of two columns.
 */
function seg_rect(cell, s, g, k) =
    k == "A" ? [0, 1 - s, cell, 1] :
    k == "D" ? [0, 0, cell, s] :
    k == "G" ? [0, 0.5 - s / 2, cell, 0.5 + s / 2] :
    k == "F" ? [0, 0.5 - s / 2 + s + g, s, 1 - s - g] :
    k == "B" ? [cell - s, 0.5 - s / 2 + s + g, cell, 1 - s - g] :
    k == "E" ? [0, s + g, s, 0.5 - s / 2 - g] :
    k == "C" ? [cell - s, s + g, cell, 0.5 - s / 2 - g] :
    [0, 0, 0, 0];

module bar(r, h) {
    translate([r[0] * h, r[1] * h])
        square([(r[2] - r[0]) * h, (r[3] - r[1]) * h]);
}

module side_bar(upper, lower, x0, x1, h, s, g) {
    top = 1 - s;
    mid = 0.5 - s / 2;
    if (upper && lower)
        bar([x0, s + g, x1, top - g], h);
    else if (upper)
        bar([x0, mid + s + g, x1, top - g], h);
    else if (lower)
        bar([x0, s + g, x1, mid - g], h);
}

/**
 * One digit. The middle bar is inset from both cell edges so the left and right
 * verticals can run as ONE continuous stroke when both halves are lit — a split
 * vertical is what makes a 7, 1 or 4 look like three floating dashes.
 */
module digit_glyph(d, h, s, g) {
    cell = d == 1 ? narrow : aspect;
    set = SEGS[d];
    top = 1 - s;
    mid = 0.5 - s / 2;
    has = function(k) len(search(k, set)) > 0;

    if (has("A")) bar([0, top, cell, 1], h);
    if (has("D")) bar([0, 0, cell, s], h);
    if (has("G")) bar([s + g, mid, cell - s - g, mid + s], h);

    if (d == 1) {
        // single centred column
        xc = cell / 2;
        bar([xc - s / 2, s + g, xc + s / 2, top - g], h);
    } else {
        side_bar(has("F"), has("E"), 0, s, h, s, g);
        side_bar(has("B"), has("C"), cell - s, cell, h, s, g);
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
 * The number panel. Origin at the bottom-left of the back face, z = 0 on the
 * build plate, number face up — exactly the print orientation.
 */
module panel(str = number, h = -1, thick = panel_thickness, rad = corner_radius) {
    hh = h < 0 ? fitted_height() : h;
    w = panel_width(str, hh);
    hp = panel_height(hh);
    rel = max(0.2, min(1.4, relief_depth));

    union() {
        difference() {
            linear_extrude(height = thick)
                rounded_rect(w, hp, rad);

            // detent pocket in the bottom edge, for the rack's click
            if (with_rack) {
                translate([w / 2 - 32, -1, -1])
                    cube([10, 0.9 + 1, thick + 2]);
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
//  Easel
// ---------------------------------------------------------------------------

function fin_h(panel_h) = max(8, panel_h * 0.86);

function lip_height() = min(easel_lip, max(4, panel_height(fitted_height()) * 0.22));

/** A box given in plate-frame extents: u across, v up the plate, w along the normal. */
module pbox(u0, u1, v0, v1, w0, w1) {
    uc = (u0 + u1) / 2;
    vc = (v0 + v1) / 2;
    wc = (w0 + w1) / 2;
    base = lip_height();
    translate([uc,
               base + vc * cos(rake_deg) + wc * sin(rake_deg),
               -vc * sin(rake_deg) + wc * cos(rake_deg)])
        rotate([-rake_deg, 0, 0])
            cube([u1 - u0 + 0.1, v1 - v0 + 0.1, w1 - w0 + 0.1], center = true);
}

/**
 * The rack the panel slides into.
 *
 * A frame sits behind the panel, and three rails (bottom, top, far end) stand outboard
 * of it, each with a lip that overlaps the number face. The panel enters from the open
 * near end and travels the channel; a detent on the floor clicks into the pocket in the
 * panel's bottom edge. Nothing is glued, and a firm pull cams the detent back out.
 *
 * The near 6 mm of the panel stands proud of the rack so there is something to grip.
 */
module rack() {
    hh = fitted_height();
    pw = panel_width(number, hh);
    ph = panel_height(hh);
    th = panel_thickness;
    base = lip_height();

    cl = 0.3;
    topcl = 1.1;
    tb = 2.4;
    bw = 7;
    railT = 3.2;
    lipT = 1.6;
    lipIn = 2.6;
    wcl = 0.25;
    grip = 6;
    detent = 0.9;

    x0 = -pw / 2;
    x1 = pw / 2;
    chU0 = x0 + grip;
    chU1 = x1 + cl;
    wLip = wcl + th;

    // frame behind the panel: four bands, middle open
    pbox(x0 - bw, chU0, -bw, ph + topcl + bw, -tb, 0);
    pbox(chU0, chU1, -bw, 0, -tb, 0);
    pbox(chU0, chU1, ph + topcl, ph + topcl + bw, -tb, 0);
    pbox(chU1, x1 + bw, -bw, ph + topcl + bw, -tb, 0);

    // rails, outboard of the panel
    pbox(chU0, x1 + bw, -railT, 0, 0, wLip);
    pbox(chU0, x1 + bw, ph + topcl, ph + topcl + railT, 0, wLip);
    pbox(chU1, chU1 + railT, 0, ph + topcl, 0, wLip);

    // lips, overlapping the number face
    pbox(chU0, x1 + bw, 0, lipIn, wLip, wLip + lipT);
    pbox(chU0, x1 + bw, ph - lipIn, ph, wLip, wLip + lipT);
    pbox(chU1 - lipIn, chU1, 0, ph, wLip, wLip + lipT);

    // detent: a stepped pyramid on the channel floor, ramped in and out
    n0 = x1 - 32;
    n1 = n0 + 10;
    for (i = [0:3]) {
        inset = (detent - 0.1) * (1 - (i + 1) / 4);
        hgt = (detent - 0.1) * ((i + 1) / 4);
        pbox(n0 + inset, n1 - inset, 0, hgt, 0, th + wcl);
    }

    // stance: plinth, two fins, tie
    rack_w = pw + 2 * bw;
    plinth_d = th + 6;
    translate([-rack_w / 2, 0, -1.5])
        cube([rack_w, base, plinth_d + 1.5]);

    tanr = tan(rake_deg);
    hb = max(8, ph * 0.86);
    rear = max(16, min(46, ph * 0.62));
    A = [-hb * tanr, base + hb];
    B = [0, base];
    C = [0, 0];
    D = [-rear, 0];
    for (sgn = [-1, 1]) {
        xl = sgn > 0 ? rack_w / 2 : -rack_w / 2;
        translate([xl, 0, 0])
            rotate([0, -90, 0])
                linear_extrude(height = 4)
                    polygon(points = [A, B, C, D]);
    }

    translate([-rack_w / 2, 0, -rear * 0.62 - 2.5])
        cube([rack_w, 4, 5]);
}

/** The rack as it prints: up is already Z, so it needs no rotation. */
module rack_on_bed() {
    rotate([90, 0, 0]) rack();
}
/** Panel seated in the rack: it lies in the plate frame, so only the origin moves. */
module assembly() {
    hh = fitted_height();
    pw = panel_width(number, hh);
    base = lip_height();
    wcl = 0.25;
    rack();
    translate([0, base + wcl * sin(rake_deg), wcl * cos(rake_deg)])
        rotate([-rake_deg, 0, 0])
            translate([-pw / 2, 0, 0])
                panel();
}

mw_plate_1();






// ---------------------------------------------------------------------------
//  Pen test coupon — one short print that tells you which relief takes ink
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
        translate([-pw / 2, 0, 0]) panel();
    } else if (mode == "rack") {
        rack_on_bed();
    } else if (mode == "coupon") {
        coupon();
    } else {
        translate([-pw / 2, ph + 8, 0]) panel();
        rack_on_bed();
    }
}

module mw_plate_1() {
    plate_contents();
}

module mw_assembly_view() {
    assembly();
}

mw_plate_1();




