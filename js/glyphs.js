/**
 * Segment glyphs for parking plates.
 *
 * Everything is defined in a "unit box": height = 1, y from 0 (baseline) to 1 (cap).
 *
 * The 7-segment skeleton is deliberate. Uniform, thick, axis-aligned bars are the
 * easiest possible shape to fill with a permanent marker or a paint pen, and because
 * every wall is vertical the outline is exactly as crisp as the model — no layer
 * stair-stepping anywhere in the groove.
 *
 * Every segment is separated from its neighbours by a real gap. That is not just
 * cosmetic: two bars that touch, share an edge, or overlap at a single corner produce
 * a self-intersecting sketch, and the triangulator will quietly drop boundary edges.
 */

/** Default stroke thickness as a fraction of cap height. */
export const STROKE = 0.13;
/** Default gap between segments, as a fraction of cap height. */
export const GAP = 0.025;

const DIGITS = {
  0: 'ABCDEF',
  1: 'BC',
  2: 'ABGED',
  3: 'ABGCD',
  4: 'FGBC',
  5: 'AFGCD',
  6: 'AFGECD',
  7: 'ABC',
  8: 'ABCDEFG',
  9: 'ABCDFG',
};

/** Characters that get a narrow cell and a centred single column. */
const NARROW = new Set(['1']);
const SPACE_ADVANCE = 0.34;

/**
 * The seven bar footprints of a unit cell, already separated by `gap`.
 * Everything is in cap-height units: y spans 0..1, x spans 0..cell.
 *
 * The horizontal bars run the full cell width and the vertical bars stop short of
 * them, which is what makes a 7-segment digit read as a digit rather than as two
 * columns with nubs between. Nothing here touches or overlaps: every pair is
 * separated by exactly `gap`.
 */
function skeleton(s, gap, cell) {
  const top = 1 - s;
  const mid = 0.5 - s / 2;
  const up = mid + s + gap; // first y above the middle bar
  const dn = mid - gap; // last y below the middle bar
  return {
    A: [0, top, cell, 1], // top
    D: [0, 0, cell, s], // bottom
    G: [0, mid, cell, mid + s], // middle
    F: [0, up, s, top - gap], // upper left
    B: [cell - s, up, cell, top - gap], // upper right
    E: [0, s + gap, s, dn], // lower left
    C: [cell - s, s + gap, cell, dn], // lower right
  };
}

/** Build the bar rectangles for one character, in the unit box. */
function charGeometry(ch, s, gap, aspect) {
  if (ch === ' ') return { advance: SPACE_ADVANCE, bars: [] };

  const h = gap / 2;

  if (ch === '+') {
    // Three mutually clear bars rather than one plus-shaped polygon, so the gap
    // discipline is the same everywhere.
    const cw = 0.64;
    const cx = cw / 2;
    const cy = 0.5;
    const half = 0.44;
    return {
      advance: cw + 0.08,
      bars: [
        [cx - s / 2, cy - half, cx + s / 2, cy + half],
        [cx - half, cy - s / 2, cx - s / 2 - h, cy + s / 2],
        [cx + s / 2 + h, cy - s / 2, cx + half, cy + s / 2],
      ],
    };
  }

  if (ch === '-') {
    const w = 0.5;
    return { advance: w + 0.16, bars: [[0, 0.5 - s / 2, w, 0.5 + s / 2]] };
  }

  if (ch === '.') {
    const w = 0.18;
    return { advance: w + 0.16, bars: [[0, 0, w, w]] };
  }

  if (ch === ':') {
    const w = 0.18;
    return {
      advance: w + 0.16,
      bars: [
        [0, 0, w, w],
        [0, 1 - w, w, 1],
      ],
    };
  }

  const segs = DIGITS[ch];
  if (!segs) return { advance: SPACE_ADVANCE, bars: [] };

  const narrow = NARROW.has(ch);
  const cell = narrow ? 0.36 : aspect;
  const seg = skeleton(s, gap, cell);

  const bars = segs.split('').map((k) => {
    const r = seg[k];
    if (!narrow) return [...r];
    // Collapse the two right-hand bars to one centred column.
    const xc = cell / 2;
    return [xc - s / 2, r[1], xc + s / 2, r[3]];
  });

  return { advance: cell, bars };
}

/**
 * Lay out a string into bar rectangles, in millimetres.
 * The block is centred on x = 0 and sits on y = 0.
 *
 * @param {string} text
 * @param {object} o
 * @param {number} o.height   cap height in mm
 * @param {number} o.stroke   stroke as a fraction of height
 * @param {number} o.gap      gap between segments, fraction of height
 * @param {number} o.tracking extra space between characters, fraction of height
 * @param {number} o.aspect   width of a digit cell, fraction of height
 * @returns {{bars: Array<{x,y,w,h}>, width:number, height:number}}
 */
export function layoutText(text, o) {
  const height = o.height;
  const stroke = Math.max(0.1, Math.min(0.28, o.stroke ?? STROKE));
  const gap = Math.max(0.015, Math.min(0.1, o.gap ?? GAP));
  const tracking = Math.max(0, o.tracking ?? 0.16);
  const aspect = Math.max(0.4, Math.min(1, o.aspect ?? 0.62));

  const chars = [...String(text)];
  if (!chars.length) return { bars: [], width: 0, height };

  const geo = chars.map((c) => charGeometry(c, stroke, gap, aspect));
  const advanceTotal = geo.reduce((a, g) => a + g.advance, 0);
  const trackTotal = Math.max(0, chars.length - 1) * tracking;
  const widthU = advanceTotal + trackTotal;

  let cursor = -widthU / 2;
  const bars = [];
  for (let i = 0; i < chars.length; i++) {
    const g = geo[i];
    for (const r of g.bars) {
      bars.push({
        x: (cursor + r[0]) * height,
        y: r[1] * height,
        w: (r[2] - r[0]) * height,
        h: (r[3] - r[1]) * height,
      });
    }
    cursor += g.advance + tracking;
  }

  return { bars, width: widthU * height, height };
}

/** Character set the input sanitiser allows. */
export const ALLOWED = /[0-9+\-.: ]/;

export function sanitize(raw) {
  return [...String(raw ?? '')]
    .filter((c) => ALLOWED.test(c))
    .join('')
    .slice(0, 16);
}


