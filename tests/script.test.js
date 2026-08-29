import { describe, it, expect, beforeAll } from 'vitest';
import { parseChord } from '../js/chords.js';

// script.js wires up listeners against the real page's element IDs and runs
// one calculation as soon as it's imported, so — same as the app integration
// tests — a minimal fixture DOM must exist before the (dynamic) import runs.
let computeOptions;
beforeAll(async () => {
  document.body.innerHTML = `
    <input type="text" id="chords" value="D">
    <input type="text" id="semitones" value="0">
    <button type="button" class="toggle-btn active" id="btn-sharp">Sharp</button>
    <button type="button" class="toggle-btn" id="btn-flat">Flat</button>
    <button id="calc">Calculate</button>
    <div id="target-summary"></div>
    <div id="results"></div>
  `;
  ({ computeOptions } = await import('../js/script.js'));
});

describe('computeOptions', () => {
  it('returns one option per fret from 1 to 9', () => {
    const options = computeOptions([parseChord('D')]);
    expect(options.map(o => o.fret).sort((a,b)=>a-b)).toEqual([1,2,3,4,5,6,7,8,9]);
  });

  it('produces one chip per input chord, carrying the shape data', () => {
    const options = computeOptions([parseChord('D'), parseChord('Am7')]);
    const anyOption = options[0];
    expect(anyOption.chips).toHaveLength(2);
    expect(anyOption.total).toBe(2);
    expect(anyOption.chips[0]).toHaveProperty('shapeName');
    expect(anyOption.chips[0]).toHaveProperty('open');
    expect(anyOption.chips[1].quality).toBe('min7');
  });

  it('counts how many chips land on an open shape at each fret', () => {
    // Root C (pc 0): open-shape landings only happen at frets 3, 5 and 8
    // (shifting pc 0 back by 3/5/8 semitones lands on A/G/E respectively).
    const options = computeOptions([parseChord('C')]);
    const byFret = Object.fromEntries(options.map(o => [o.fret, o.openCount]));
    expect(byFret).toEqual({1:0, 2:0, 3:1, 4:0, 5:1, 6:0, 7:0, 8:1, 9:0});
  });

  it('sorts comfortable frets (<=5) before high frets, by open-shape count desc, then lowest fret', () => {
    const options = computeOptions([parseChord('C')]);
    // Derived by hand from the openCount table above:
    // comfy group (1-5) ordered by openCount desc/fret asc: 3,5,1,2,4
    // high group (6-9) ordered the same way: 8,6,7,9
    expect(options.map(o => o.fret)).toEqual([3,5,1,2,4,8,6,7,9]);
  });

  it('breaks a tie in open-shape count by preferring the lower fret', () => {
    // D (pc 2): open landings at fret 5 (G) and fret 7 (E) — a mid-comfy vs.
    // just-past-comfy tie, both open shapes to trigger the tiebreak.
    const options = computeOptions([parseChord('D')]);
    const fret5 = options.find(o => o.fret === 5);
    const fret7 = options.find(o => o.fret === 7);
    expect(fret5.openCount).toBe(1);
    expect(fret7.openCount).toBe(1);
    // fret 5 is comfy (<=5) so it must sort strictly before fret 7 regardless of tied count
    expect(options.indexOf(fret5)).toBeLessThan(options.indexOf(fret7));
  });
});
