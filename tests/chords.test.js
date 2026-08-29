import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHARP, FLAT, QUALITY_ALIASES,
  parseChord, shapeFor, transposeChord, buildAlternatives,
  escapeHtml, setAccidentalMode, getAccidentalMode,
} from '../js/chords.js';

beforeEach(() => setAccidentalMode('sharp'));

describe('parseChord', () => {
  it('parses a plain major chord', () => {
    expect(parseChord('D')).toEqual({original:'D', pc:2, isMinor:false, extra:'', quality:'maj'});
  });

  it('parses a minor chord', () => {
    expect(parseChord('Bm')).toEqual({original:'Bm', pc:11, isMinor:true, extra:'', quality:'min'});
  });

  it('lowercases the input letter but keeps the original string verbatim', () => {
    const c = parseChord('d');
    expect(c.pc).toBe(2);
    expect(c.original).toBe('d');
  });

  it('converts flatted roots to their enharmonic sharp pitch class', () => {
    expect(parseChord('Db').pc).toBe(SHARP.indexOf('C#'));
    expect(parseChord('Eb').pc).toBe(SHARP.indexOf('D#'));
    expect(parseChord('Gb').pc).toBe(SHARP.indexOf('F#'));
    expect(parseChord('Cb').pc).toBe(SHARP.indexOf('B'));
    expect(parseChord('Eb').pc).toBe(parseChord('D#').pc);
  });

  it('returns null for input that cannot be parsed as a chord', () => {
    expect(parseChord('H')).toBeNull();
    expect(parseChord('')).toBeNull();
    expect(parseChord('   ')).toBeNull();
  });

  it('returns null for sharped notes with no slot of their own in the 12-note table (E#, B#)', () => {
    // E# and B# are valid enharmonic spellings (== F and C) but this tool's
    // pitch-class table only has entries for F and C, not E#/B# themselves.
    expect(parseChord('E#')).toBeNull();
    expect(parseChord('B#')).toBeNull();
  });

  it.each([
    ['C', 'maj'], ['Cmaj', 'maj'], ['CM', 'maj'],
    ['Cm', 'min'], ['Cmin', 'min'], ['C-', 'min'],
    ['C7', 'dom7'],
    ['Cmaj7', 'maj7'], ['CM7', 'maj7'],
    ['Cm7', 'min7'], ['Cmin7', 'min7'], ['C-7', 'min7'],
    ['Csus2', 'sus2'],
    ['Csus4', 'sus4'], ['Csus', 'sus4'],
    ['Cdim', 'dim'],
    ['Cdim7', 'dim7'],
    ['Caug', 'aug'], ['C+', 'aug'],
    ['C6', 'maj6'],
    ['Cm6', 'min6'], ['Cmin6', 'min6'],
  ])('resolves the suffix of %s to quality %s', (input, expected) => {
    expect(parseChord(input).quality).toBe(expected);
  });

  it('exposes every declared alias through parseChord', () => {
    for(const [suffix, expected] of Object.entries(QUALITY_ALIASES)){
      expect(parseChord('C' + suffix).quality).toBe(expected);
    }
  });

  it('falls back to a null quality for unsupported extensions, without losing the raw suffix', () => {
    const nine = parseChord('E9');
    expect(nine.quality).toBeNull();
    expect(nine.extra).toBe('9');

    const add9 = parseChord('Cadd9');
    expect(add9.quality).toBeNull();
    expect(add9.extra).toBe('add9');

    const halfDim = parseChord('Bm7b5');
    expect(halfDim.quality).toBeNull();
    expect(halfDim.isMinor).toBe(true);
    expect(halfDim.extra).toBe('7b5');
  });
});

describe('shapeFor', () => {
  it('flags the beginner open-position pitch classes as open', () => {
    expect(shapeFor(0, false, '', 'maj')).toMatchObject({name:'C', open:true});
    expect(shapeFor(9, true, '', 'min')).toMatchObject({name:'Am', open:true});
  });

  it('names non-open pitch classes with the plain note name instead', () => {
    expect(shapeFor(1, false, '', 'maj').name).toBe('C#');
    expect(shapeFor(1, true, '', 'min').name).toBe('C#m');
  });

  it('respects the accidental mode when naming non-open shapes', () => {
    setAccidentalMode('flat');
    expect(shapeFor(1, false, '', 'maj').name).toBe('Db');
  });

  it('appends the extra suffix onto the shape name', () => {
    expect(shapeFor(2, false, '7', 'dom7').name).toBe('D7');
    expect(shapeFor(1, true, '7', 'min7').name).toBe('C#m7');
  });
});

describe('transposeChord', () => {
  it('lowers the pitch class by the given number of semitones, wrapping around', () => {
    const c = parseChord('C');
    expect(transposeChord(c, 1).pc).toBe(11); // C down a semitone is B
    expect(transposeChord(c, 12).pc).toBe(0); // a full octave down is still C
  });

  it('preserves quality, extra and isMinor through the transposition', () => {
    const c = parseChord('Am7');
    const t = transposeChord(c, 2);
    expect(t).toMatchObject({original:'Gm7', isMinor:true, extra:'7', quality:'min7'});
  });
});

describe('buildAlternatives', () => {
  it('gives diminished chords a single movable, barre-free shape', () => {
    const alts = buildAlternatives(11, false, 'dim7'); // B dim7
    expect(alts).toHaveLength(1);
    expect(alts[0]).toMatchObject({frets:['x','x',9,10,9,10], barre:null});
  });

  it('treats plain "dim" the same as "dim7" fingering-wise', () => {
    const dim = buildAlternatives(11, false, 'dim');
    const dim7 = buildAlternatives(11, false, 'dim7');
    expect(dim[0].frets).toEqual(dim7[0].frets);
  });

  it('matches the standard G7 barre chord (E-shape barre at fret 3)', () => {
    const alts = buildAlternatives(7, false, 'dom7'); // G7
    const eShape = alts.find(a => a.label.includes('E-shape'));
    expect(eShape.frets).toEqual([3,5,3,4,3,3]);
    expect(eShape.baseFret).toBe(3);
  });

  it('matches the standard F barre chord (E-shape barre at fret 1)', () => {
    const alts = buildAlternatives(5, false, 'maj'); // F major
    const eShape = alts.find(a => a.label.includes('E-shape'));
    expect(eShape.frets).toEqual([1,3,3,2,1,1]);
  });

  it('matches the standard open Am7 voicing (A-shape barre at fret 0)', () => {
    const alts = buildAlternatives(9, true, 'min7'); // Am7
    const aShape = alts.find(a => a.label.includes('A-shape'));
    expect(aShape.frets).toEqual(['x',0,2,0,1,0]);
  });

  it('matches the standard open Asus2 voicing', () => {
    const alts = buildAlternatives(9, false, 'sus2'); // Asus2
    expect(alts).toHaveLength(1); // no E-shape sus2 alternative — it doesn't fit compactly
    expect(alts[0].frets).toEqual(['x',0,2,2,0,0]);
  });

  it('deduplicates when the open bonus shape and a barre-at-fret-0 shape coincide', () => {
    const alts = buildAlternatives(4, false, 'maj'); // E major
    const sigs = alts.map(a => a.frets.join(','));
    expect(new Set(sigs).size).toBe(sigs.length); // no duplicate fret patterns
    expect(alts).toHaveLength(2); // hand-picked Open + A-shape barre only
  });

  it('never draws a barre bar at fret 0 (an open position, not a barre)', () => {
    for(const key of ['maj','min','dom7','maj7','min7','sus4','aug','maj6','min6']){
      for(const pc of [4, 9]){ // roots where a barre shape can land on the open string itself
        for(const isMinor of [false, true]){
          const alts = buildAlternatives(pc, isMinor, key);
          for(const alt of alts){
            if(alt.baseFret === 0) expect(alt.barre).toBeFalsy();
          }
        }
      }
    }
  });

  it('falls back to the plain major/minor triad shapes for unsupported qualities', () => {
    const majFallback = buildAlternatives(0, false, null);
    const majExplicit = buildAlternatives(0, false, 'maj');
    expect(majFallback.map(a => a.frets)).toEqual(majExplicit.map(a => a.frets));

    const minFallback = buildAlternatives(9, true, null);
    const minExplicit = buildAlternatives(9, true, 'min');
    expect(minFallback.map(a => a.frets)).toEqual(minExplicit.map(a => a.frets));
  });
});

describe('accidental mode', () => {
  it('getAccidentalMode reflects the value last set via setAccidentalMode', () => {
    setAccidentalMode('flat');
    expect(getAccidentalMode()).toBe('flat');
    setAccidentalMode('sharp');
    expect(getAccidentalMode()).toBe('sharp');
  });
});

describe('escapeHtml', () => {
  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml(`<a href="x">it's & fine</a>`))
      .toBe('&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; fine&lt;/a&gt;');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Bm7 G#dim7')).toBe('Bm7 G#dim7');
  });
});
