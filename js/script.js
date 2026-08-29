/**
 * App entry point — the only file that knows the page's specific element
 * IDs. Wires the DOM inputs/buttons to chords.js (the chord theory model)
 * and chord-diagram.js (the hover/click diagram widget), and renders the
 * capo-position results.
 */
import { parseChord, shapeFor, transposeChord, escapeHtml, setAccidentalMode } from './chords.js';
import { attachChordHover, resetChordPopover } from './chord-diagram.js';

/**
 * For a target chord progression, works out what shape you'd have to finger
 * at every capo position from fret 1 to 9, and ranks the results.
 *
 * @param {Array} chords - chords as returned by parseChord/transposeChord
 * @returns {Array<{fret: number, chips: Array, openCount: number, total: number}>}
 *   One entry per fret 1-9, `chips[i]` describing what shape you'd play for
 *   `chords[i]` at that capo position (see shapeFor's return shape). Sorted
 *   with comfortable frets (<=5) first, then by how many chips land on an
 *   open shape (more is better), then by the lowest fret.
 */
export function computeOptions(chords){
  const options = [];
  for(let fret=1; fret<=9; fret++){
    const chips = chords.map(c=>{
      const shapePc = ((c.pc - fret) % 12 + 12) % 12;
      const shape = shapeFor(shapePc, c.isMinor, c.extra, c.quality);
      return {real: c.original, shapeName: shape.name, open: shape.open, pc: shape.pc, isMinor: shape.isMinor, extra: shape.extra, quality: shape.quality};
    });
    const openCount = chips.filter(c=>c.open).length;
    options.push({fret, chips, openCount, total: chords.length});
  }
  // sort: first prefer capo fret <=5 (comfortable range), then by number of open chords (desc), then by lowest fret
  options.sort((a,b)=>{
    const aComfy = a.fret <= 5 ? 0 : 1;
    const bComfy = b.fret <= 5 ? 0 : 1;
    if(aComfy !== bComfy) return aComfy - bComfy;
    if(b.openCount !== a.openCount) return b.openCount - a.openCount;
    return a.fret - b.fret;
  });
  return options;
}

/** Renders the top 8 capo-position options into #results, and re-wires the chord-diagram popover on the chips it just created. */
function render(options){
  const el = document.getElementById('results');
  el.innerHTML = '';
  const shown = options.slice(0,8);
  shown.forEach((opt, idx)=>{
    const div = document.createElement('div');
    div.className = 'option' + (idx===0 ? ' best' : '') + (opt.fret > 5 ? ' extended' : '');
    div.innerHTML = `
      <div class="fret-line">
        <div class="fret-num">${opt.fret}</div>
        <div class="fret-label">Capo on fret ${opt.fret}</div>
      </div>
      <div class="chords-row">
        ${opt.chips.map(c=>`
          <div class="chip ${c.open?'open':'barre'}">
            <div class="shape" tabindex="0" data-pc="${c.pc}" data-minor="${c.isMinor?1:0}" data-extra="${escapeHtml(c.extra)}" data-quality="${c.quality||''}">${escapeHtml(c.shapeName)}</div>
            <div class="real">→ ${escapeHtml(c.real)}</div>
          </div>
        `).join('')}
      </div>
      <div class="score">Open shapes: <b>${opt.openCount}/${opt.total}</b></div>
    `;
    el.appendChild(div);
  });
  attachChordHover(el);
}

/**
 * Renders the "here's the progression you're actually aiming for" strip
 * above the results: either the original chords as typed, or — when
 * `semitones` > 0 — the transposed ones, each with a "was X" note showing
 * what it used to be.
 */
function renderTargetSummary(originalChords, targetChords, semitones){
  const el = document.getElementById('target-summary');
  const label = semitones === 0
    ? 'Original progression (no capo):'
    : `Progression lowered by ${semitones} semitones (${(semitones/2).toFixed(semitones%2===0?0:1)} whole tones):`;
  el.innerHTML = `
    <div class="panel" style="padding:14px 20px;">
      <div class="hint" style="margin:0 0 8px;">${label}</div>
      <div class="chords-row">
        ${targetChords.map((c,i)=>{
          const shape = shapeFor(c.pc, c.isMinor, c.extra, c.quality);
          const sub = semitones === 0 ? '' : `<div class="real">was ${escapeHtml(originalChords[i].original)}</div>`;
          return `
          <div class="chip ${shape.open ? 'open' : 'barre'}">
            <div class="shape" tabindex="0" data-pc="${c.pc}" data-minor="${c.isMinor?1:0}" data-extra="${escapeHtml(c.extra)}" data-quality="${c.quality||''}">${escapeHtml(c.original)}</div>
            ${sub}
          </div>
        `;}).join('')}
      </div>
    </div>
  `;
  attachChordHover(el);
}

// --- Wire up the page ---

document.getElementById('btn-sharp').addEventListener('click', ()=>{
  setAccidentalMode('sharp');
  document.getElementById('btn-sharp').classList.add('active');
  document.getElementById('btn-flat').classList.remove('active');
  document.getElementById('calc').click();
});

document.getElementById('btn-flat').addEventListener('click', ()=>{
  setAccidentalMode('flat');
  document.getElementById('btn-flat').classList.add('active');
  document.getElementById('btn-sharp').classList.remove('active');
  document.getElementById('calc').click();
});

document.getElementById('calc').addEventListener('click', ()=>{
  resetChordPopover();
  const raw = document.getElementById('chords').value;
  const tokens = raw.split(/\s+/).filter(Boolean);
  const chords = tokens.map(parseChord);
  const el = document.getElementById('results');

  if(chords.some(c=>c===null) || chords.length===0){
    el.innerHTML = '<div class="empty">Check the chord spelling (e.g. D Em G Bm A).</div>';
    document.getElementById('target-summary').innerHTML = '';
    return;
  }

  const semitonesRaw = document.getElementById('semitones').value.trim();
  const semitones = semitonesRaw === '' ? 0 : parseInt(semitonesRaw, 10);
  if(isNaN(semitones) || semitones < 0){
    el.innerHTML = '<div class="empty">Enter a valid number of semitones (0 or positive).</div>';
    document.getElementById('target-summary').innerHTML = '';
    return;
  }

  const targetChords = semitones === 0 ? chords : chords.map(c => transposeChord(c, semitones));
  renderTargetSummary(chords, targetChords, semitones);

  const options = computeOptions(targetChords);
  render(options);
});

// initial calculation with the prefilled example
document.getElementById('calc').click();
