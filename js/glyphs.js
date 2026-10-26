/**
 * Segment and typographic glyphs for parking plates.
 *
 * Everything is defined in a "unit box": height = 1, y from 0 (baseline) to 1 (cap).
 *
 * In "styled" mode:
 *   - Continuous, solid, clean strokes: adjacent bars connect seamlessly without gaps.
 *   - "1": solid vertical stem, top hook with downward barb, solid base serif.
 *   - "4": full-height right stem, horizontal crossbar crossing through, upper left arm.
 *          Open top and bottom (never looks like a 9).
 *   - "7": top bar, top-left downward hook, stepped diagonal stem down to lower-center,
 *          and an Indian/European middle crossbar distinguishing it unmistakably from 1.
 *   - All other digits: solid contiguous strokes without awkward LCD cracks.
 *
 * In "digital" mode:
 *   - Traditional 7-segment layout with intentional uniform gaps.
 */

/** Default stroke thickness as a fraction of cap height. */
export const STROKE = 0.13;
/** Default gap between segments, as a fraction of cap height (digital mode). */
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

/** Characters that get a narrow cell. */
const NARROW = new Set(['1']);
const SPACE_ADVANCE = 0.34;

/**
 * Classical 7-segment digit geometry with gaps between segments.
 */
function digitBars(segs, s, gap, cell) {
  const top = 1 - s;
  const mid = 0.5 - s / 2;
  const has = (k) => segs.includes(k);
  const bars = [];

  if (has('A')) bars.push([0, top, cell, 1]);
  if (has('D')) bars.push([0, 0, cell, s]);
  if (has('G')) bars.push([s + gap, mid, cell - s - gap, mid + s]);

  const side = (upper, lower, x0, x1) => {
    if (upper && lower) bars.push([x0, s + gap, x1, top - gap]);
    else if (upper) bars.push([x0, mid + s + gap, x1, top - gap]);
    else if (lower) bars.push([x0, s + gap, x1, mid - gap]);
  };

  side(has('F'), has('E'), 0, s);
  side(has('B'), has('C'), cell - s, cell);

  return bars;
}

/**
 * Continuous merged digit geometry: touching segments overlap slightly so
 * the mesh builder produces a seamless, solid engraved or embossed cavity.
 */
function digitBarsMerged(segs, s, cell) {
  const top = 1 - s;
  const mid = 0.5 - s / 2;
  const has = (k) => segs.includes(k);
  const bars = [];
  const ov = 0.005;

  if (has('A')) bars.push([0, top - ov, cell, 1]);
  if (has('D')) bars.push([0, 0, cell, s + ov]);
  if (has('G')) bars.push([0, mid - ov, cell, mid + s + ov]);

  // Full or half verticals running into the horizontals
  if (has('F') && has('E')) bars.push([0, 0, s, 1]);
  else if (has('F')) bars.push([0, mid, s, 1]);
  else if (has('E')) bars.push([0, 0, s, mid + s]);

  if (has('B') && has('C')) bars.push([cell - s, 0, cell, 1]);
  else if (has('B')) bars.push([cell - s, mid, cell, 1]);
  else if (has('C')) bars.push([cell - s, 0, cell, mid + s]);

  return bars;
}

/**
 * Styled variant: full, complete, unmistakable typography.
 */
function styledDigitBars(d, s, gap, cell) {
  const top = 1 - s;

  if (d === 1) {
    // Solid, classic sans-serif 1:
    // Centered vertical stem, sharp top hook pointing down-left, solid base serif.
    const xc = cell / 2;
    const stemL = xc - s / 2;
    const stemR = xc + s / 2;
    const hookL = Math.max(0, stemL - 1.2 * s);
    return [
      [stemL, 0, stemR, 1],
      [hookL, top - 0.01, stemR, 1],
      [hookL, top - 0.7 * s, hookL + s, top],
      [0, 0, cell, s],
    ];
  }

  if (d === 4) {
    // True sans-serif 4:
    // Continuous right stem, left upper arm from cap down to crossbar,
    // crossbar crossing cleanly through the right stem. Open top, open bottom.
    const rightStemL = cell - s;
    const midY = 0.38 - s / 2;
    return [
      [rightStemL, 0, cell, 1],
      [0, midY, cell, midY + s],
      [0, midY, s, 1],
    ];
  }

  if (d === 7) {
    // Official / banking 7:
    // Full-width top bar with downward hook on top-left,
    // stepped diagonal stem from top-right down to lower-center,
    // and an Indian/European middle crossbar distinguishing it unmistakably from 1.
    const bars = [];
    bars.push([0, top - 0.01, cell, 1]);
    bars.push([0, top - 0.7 * s, s, top]);

    const steps = 7;
    const botX = cell * 0.32;
    const topX = cell - s;
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps;
      const t1 = (k + 1) / steps;
      const y0 = t0 * top;
      const y1 = Math.min(top + 0.01, t1 * top + 0.01);
      const x0 = botX * (1 - t0) + topX * t0;
      bars.push([x0, y0, x0 + s, y1]);
    }

    const midY = 0.52 - s / 2;
    bars.push([cell * 0.22, midY, cell * 0.82, midY + s]);
    return bars;
  }

  return digitBarsMerged(DIGITS[d], s, cell);
}

/** Build the bar rectangles for one character, in the unit box. */
function charGeometry(ch, s, gap, aspect, style) {
  if (ch === ' ') return { advance: SPACE_ADVANCE, bars: [] };

  const h = gap / 2;

  if (ch === '+') {
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
  const cell = narrow ? 0.44 : aspect;
  const styled = style !== 'digital';
  let bars = styled ? styledDigitBars(Number(ch), s, gap, cell) : digitBars(segs, s, gap, cell);

  if (narrow && !styled) {
    const xc = cell / 2;
    bars = bars.map((r) => [xc - s / 2, r[1], xc + s / 2, r[3]]);
  }

  return { advance: cell, bars };
}

/**
 * Lay out a string into bar rectangles, in millimetres.
 * The block is centred on x = 0 and sits on y = 0.
 */
export function layoutText(text, o) {
  const height = o.height;
  const stroke = Math.max(0.1, Math.min(0.28, o.stroke ?? STROKE));
  const gap = Math.max(0.015, Math.min(0.1, o.gap ?? GAP));
  const tracking = Math.max(0, o.tracking ?? 0.16);
  const aspect = Math.max(0.4, Math.min(1, o.aspect ?? 0.62));

  const chars = [...String(text)];
  if (!chars.length) return { bars: [], width: 0, height };

  const style = o.style === 'digital' ? 'digital' : 'styled';
  const geo = chars.map((c) => charGeometry(c, stroke, gap, aspect, style));
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
