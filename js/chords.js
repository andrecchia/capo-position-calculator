/**
 * Chord theory model: parsing chord symbols, transposing them, and looking
 * up the fretboard shapes used to draw diagrams. Pure logic only — no DOM
 * access — so it runs unchanged in the browser and under the test suite.
 *
 * Pitch classes (`pc` in the functions below) are integers 0-11, C=0 through
 * B=11, matching the indices of the SHARP/FLAT arrays.
 */

/** Note names for pitch classes 0-11, spelled with sharps. */
export const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
/** Note names for pitch classes 0-11, spelled with flats. */
export const FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
/** Sharp spelling for each flatted root letter, e.g. 'Bb' -> 'A#'. */
const FLAT_TO_SHARP = {'Cb':'B','Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#'};
/** Pitch classes that have a beginner-friendly open major chord shape. */
const OPEN_MAJOR = {0:'C',2:'D',4:'E',7:'G',9:'A'};
/** Pitch classes that have a beginner-friendly open minor chord shape. */
const OPEN_MINOR = {9:'Am',4:'Em',2:'Dm'};

/** Which spelling {@link noteName} uses for non-open shapes: 'sharp' or 'flat'. */
let accidentalMode = 'sharp';

/** Sets the accidental spelling used by {@link noteName} going forward. */
export function setAccidentalMode(mode){
  accidentalMode = mode;
}

/** Returns the accidental spelling currently in effect ('sharp' or 'flat'). */
export function getAccidentalMode(){
  return accidentalMode;
}

/** Spells a pitch class as a note name, respecting the current accidental mode. */
export function noteName(pc){
  return accidentalMode === 'flat' ? FLAT[pc] : SHARP[pc];
}

/** Escapes the five HTML-sensitive characters, for safely inserting user text into innerHTML. */
export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// Maps the text typed after the root note (e.g. "m7", "sus4", "dim7") to a
// canonical chord-quality key used to look up fretting shapes below.
// Anything not listed here still displays and calculates fine — it just
// falls back to a plain major/minor triad diagram with a note that it's
// simplified, instead of a wrong or missing diagram.
export const QUALITY_ALIASES = {
  '': 'maj', 'maj': 'maj', 'M': 'maj',
  'm': 'min', 'min': 'min', '-': 'min',
  '7': 'dom7', 'dom7': 'dom7',
  'maj7': 'maj7', 'M7': 'maj7', 'Δ7': 'maj7', 'Δ': 'maj7',
  'm7': 'min7', 'min7': 'min7', '-7': 'min7',
  'sus2': 'sus2',
  'sus4': 'sus4', 'sus': 'sus4',
  'dim': 'dim', '°': 'dim',
  'dim7': 'dim7', '°7': 'dim7',
  'aug': 'aug', '+': 'aug',
  '6': 'maj6',
  'm6': 'min6', 'min6': 'min6',
};

/**
 * Parses a chord symbol like "F#m7" or "Bbsus4" into its structured parts.
 *
 * @param {string} raw - user-typed chord text (e.g. "Bm", "G7", "Ebmaj7")
 * @returns {?{original: string, pc: number, isMinor: boolean, extra: string, quality: ?string}}
 *   `original` is the raw text as typed. `pc` is the root's pitch class
 *   (0-11). `extra` is everything after the root letter/accidental (and
 *   after a leading "m", if minor), kept verbatim for display. `quality` is
 *   the canonical key used to look up a fretting shape (see
 *   {@link QUALITY_ALIASES}), or null if the suffix isn't one of the
 *   supported chord types (calculation/display still work fine either way).
 *   Returns null if `raw` isn't parseable as a chord at all — either it
 *   doesn't start with a note letter, or it's a sharped note with no slot of
 *   its own in this table (e.g. "E#", "B#").
 */
export function parseChord(raw){
  const str = raw.trim();
  const m = str.match(/^([A-Ga-g])([#b]?)(.*)$/);
  if(!m) return null;
  const letter = m[1].toUpperCase();
  const acc = m[2];
  const rest = m[3] || '';
  let noteStr = letter + acc;
  if(acc === 'b') noteStr = FLAT_TO_SHARP[letter+'b'] || noteStr;
  const pc = SHARP.indexOf(noteStr);
  if(pc === -1) return null;
  const isMinor = /^m(?!aj)/.test(rest);
  const extra = isMinor ? rest.slice(1) : rest.replace(/^maj\b/i,'');
  const quality = QUALITY_ALIASES.hasOwnProperty(rest) ? QUALITY_ALIASES[rest] : null;
  return {original: str, pc, isMinor, extra, quality};
}

/**
 * Builds the display/scoring info for a chord at a given pitch class — used
 * both for the real target chord and, after subtracting the capo fret, for
 * the "shape" you'd actually finger at that position.
 *
 * @param {number} pc - pitch class (0-11) of the chord's root
 * @param {boolean} isMinor
 * @param {string} extra - suffix text appended after the shape's letter name
 * @param {?string} quality - canonical quality key, see {@link QUALITY_ALIASES}
 * @returns {{name: string, open: boolean, pc: number, isMinor: boolean, extra: string, quality: ?string}}
 *   `open` is true exactly when this pc/isMinor lands on one of the 8
 *   beginner open shapes (C, D, E, G, A, Am, Em, Dm) — maximizing how many
 *   chords come out `open: true` is the whole point of the capo calculator.
 */
export function shapeFor(pc, isMinor, extra, quality){
  const table = isMinor ? OPEN_MINOR : OPEN_MAJOR;
  const open = !!table[pc];
  const name = open ? (table[pc] + extra) : (noteName(pc) + (isMinor ? 'm' : '') + extra);
  return {name, open, pc, isMinor, extra, quality};
}

/**
 * Returns a copy of `c` transposed `semitones` lower — the optional "lower
 * the whole song first" step, applied before capo shapes are searched for.
 * @param {object} c - a chord as returned by {@link parseChord}
 * @param {number} semitones
 */
export function transposeChord(c, semitones){
  const newPc = ((c.pc - semitones) % 12 + 12) % 12;
  const name = noteName(newPc) + (c.isMinor ? 'm' : '') + c.extra;
  return {original: name, pc: newPc, isMinor: c.isMinor, extra: c.extra, quality: c.quality};
}

// --- Fretting shapes for chord diagrams ---
// Fret arrays are 6 entries, low E string first through high e string last.
// 'x' = muted, 0 = open, n = fretted at fret n.

// Extra beginner-friendly open-position alternatives for plain major/minor
// chords only (the C/D/G-shape open forms) — hand-picked, on top of the
// generic E-shape/A-shape barre system below.
const OPEN_SHAPES = {
  '0-0': {label:'Open', frets:['x',3,2,0,1,0], fingers:['',3,2,'',1,'']},
  '2-0': {label:'Open', frets:['x','x',0,2,3,2], fingers:['','','',1,3,2]},
  '4-0': {label:'Open', frets:[0,2,2,1,0,0], fingers:['',2,3,1,'','']},
  '7-0': {label:'Open', frets:[3,2,0,0,0,3], fingers:[2,1,'','','',3]},
  '9-0': {label:'Open', frets:['x',0,2,2,2,0], fingers:['','',1,2,3,'']},
  '9-1': {label:'Open', frets:['x',0,2,2,1,0], fingers:['','',2,3,1,'']},
  '4-1': {label:'Open', frets:[0,2,2,0,0,0], fingers:['',2,3,'','','']},
  '2-1': {label:'Open', frets:['x','x',0,2,3,1], fingers:['','','',2,3,1]},
};

// Movable shapes rooted on the low-E string: barre the index finger across
// all six strings, other fingers add the remaining notes higher up. Given
// here as if rooted on E itself (fret 0); shifted to any root at draw time.
// Each shape was derived from the actual chord tones on each string, not
// guessed — sus2, dim/dim7, and plain 6th/m6th chords don't fit this family
// cleanly (the altered tone lands almost an octave from the barre), so
// they're left out here on purpose rather than shown wrong.
const E_SHAPE_TEMPLATES = {
  maj:  [0,2,2,1,0,0],
  min:  [0,2,2,0,0,0],
  dom7: [0,2,0,1,0,0],
  maj7: [0,2,1,1,0,0],
  min7: [0,2,0,0,0,0],
  sus4: [0,2,2,2,0,0],
  aug:  [0,3,2,1,1,0],
  maj6: [0,2,2,1,2,0],
  min6: [0,2,2,0,2,0],
};

// Same idea, rooted on the A string (low E string muted).
const A_SHAPE_TEMPLATES = {
  maj:  ['x',0,2,2,2,0],
  min:  ['x',0,2,2,1,0],
  dom7: ['x',0,2,0,2,0],
  maj7: ['x',0,2,1,2,0],
  min7: ['x',0,2,0,1,0],
  sus2: ['x',0,2,2,0,0],
  sus4: ['x',0,2,2,3,0],
  aug:  ['x',0,3,2,2,1],
  maj6: ['x',0,2,2,2,2],
  min6: ['x',0,2,2,1,2],
};

/** Shifts every fretted (non-muted) entry of a shape template up by `f` frets. */
function shiftTemplate(template, f){
  return template.map(v => v === 'x' ? 'x' : v + f);
}

// Diminished chords don't fit a clean E/A-shape barre (the two "5th" notes
// of the shape would end up almost an octave apart). Guitarists instead use
// this compact 4-string shape rooted on the D string — and in practice the
// same fingering is normally used for both "dim" and "dim7".
/**
 * @param {number} pc - pitch class (0-11) of the chord's root
 * @returns {{label: string, frets: Array<number|'x'>, baseFret: number, barre: null}}
 */
function dimShapeFor(pc){
  const anchorPc = 2; // open D string
  const f = ((pc - anchorPc) % 12 + 12) % 12;
  return {label:'Movable shape (no barre)', frets: ['x','x', f, f+1, f, f+1], baseFret: f, barre: null};
}

/**
 * Returns the playable fretting alternatives for a chord — what shows up in
 * the hover/click diagram carousel, in display order:
 *
 *  1. A hand-picked beginner open-position shape (see {@link OPEN_SHAPES}),
 *     only for plain major/minor chords that have one.
 *  2. A movable E-shape barre (see {@link E_SHAPE_TEMPLATES}), if this
 *     quality has one.
 *  3. A movable A-shape barre (see {@link A_SHAPE_TEMPLATES}), if this
 *     quality has one.
 *
 * "dim"/"dim7" are a special case, returning a single barre-free movable
 * shape instead (see {@link dimShapeFor}). An unsupported quality (`quality`
 * is null) falls back to the plain major/minor triad shapes. Any duplicate
 * fret pattern — e.g. a barre shape that happens to land on fret 0 and so
 * matches the open shape exactly — is filtered out.
 *
 * @param {number} pc - pitch class (0-11) of the chord's root
 * @param {boolean} isMinor
 * @param {?string} quality - canonical quality key, or null if unsupported
 * @returns {Array<{label: string, frets: Array<number|'x'>, baseFret: number, barre: ?number, fingers?: Array}>}
 */
export function buildAlternatives(pc, isMinor, quality){
  const key = quality || (isMinor ? 'min' : 'maj');

  if(key === 'dim' || key === 'dim7'){
    return [dimShapeFor(pc)];
  }

  const list = [];
  if(key === 'maj' || key === 'min'){
    const openDef = OPEN_SHAPES[`${pc}-${isMinor?1:0}`];
    if(openDef) list.push(openDef);
  }

  const eTemplate = E_SHAPE_TEMPLATES[key];
  if(eTemplate){
    const f = ((pc - 4) % 12 + 12) % 12; // open low E string
    list.push({label:'Barre · E-shape', frets: shiftTemplate(eTemplate, f), baseFret: f, barre: f || null});
  }
  const aTemplate = A_SHAPE_TEMPLATES[key];
  if(aTemplate){
    const f = ((pc - 9) % 12 + 12) % 12; // open A string
    list.push({label:'Barre · A-shape', frets: shiftTemplate(aTemplate, f), baseFret: f, barre: f || null});
  }

  const seen = new Set();
  return list.filter(def=>{
    const sig = def.frets.join(',');
    if(seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}
