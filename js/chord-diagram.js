/**
 * Renders chord fretboard diagrams as inline SVG, and drives the hover/click
 * popover (with its shape-alternatives carousel) that displays them next to
 * any `.shape[data-pc]` element. Depends on chords.js's buildAlternatives()
 * for the actual fretting data; knows nothing about capo math or the rest of
 * the page beyond that one data-attribute contract (see attachChordHover).
 */
import { buildAlternatives } from './chords.js';

/**
 * Renders one fretting shape as a small inline SVG fretboard diagram: nut or
 * "Nfr" fret label, string/fret grid, muted/open-string markers, fretted-note
 * dots (with finger numbers where known), and a barre bar when applicable.
 *
 * @param {{frets: Array<number|'x'>, baseFret?: number, barre?: ?number, fingers?: Array}} def
 *   `frets` has 6 entries, low E string first through high e string last;
 *   'x' = muted, 0 = open, n = fretted at fret n. `baseFret` (default 1) is
 *   the fret shown at the top of the diagram — a "Nfr" label replaces the
 *   nut whenever it's anything other than 1.
 * @returns {string} an `<svg>` markup string, ready to drop into innerHTML
 */
export function chordDiagramSVG(def){
  const frets = def.frets;
  const baseFret = def.baseFret || 1;
  const stringGap = 16, fretGap = 20;
  const left = baseFret === 1 ? 16 : 30;
  const top = 22;
  const width = left + stringGap*5 + 16;
  const height = top + fretGap*4 + 14;
  const xs = [0,1,2,3,4,5].map(i => left + i*stringGap);
  let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="chord-diagram">`;

  if(baseFret === 1){
    svg += `<rect x="${xs[0]}" y="${top-2}" width="${xs[5]-xs[0]}" height="3" fill="var(--ink)"/>`;
  } else {
    svg += `<line x1="${xs[0]}" y1="${top}" x2="${xs[5]}" y2="${top}" stroke="var(--muted)" stroke-width="1"/>`;
    svg += `<text x="4" y="${top+fretGap*0.5+4}" font-size="9" fill="var(--muted)" text-anchor="start">${baseFret}fr</text>`;
  }
  for(let r=1;r<=4;r++){
    const y = top + r*fretGap;
    svg += `<line x1="${xs[0]}" y1="${y}" x2="${xs[5]}" y2="${y}" stroke="var(--muted)" stroke-width="1"/>`;
  }
  xs.forEach(x=>{
    svg += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top+fretGap*4}" stroke="var(--muted)" stroke-width="1"/>`;
  });
  if(def.barre){
    const playedIdxs = frets.reduce((acc,v,i)=> v !== 'x' ? acc.concat(i) : acc, []);
    if(playedIdxs.length > 1){
      const rowIndex = def.barre - baseFret;
      const y = top + rowIndex*fretGap + fretGap/2;
      const x1 = xs[playedIdxs[0]], x2 = xs[playedIdxs[playedIdxs.length-1]];
      svg += `<rect x="${x1-7}" y="${y-7}" width="${x2-x1+14}" height="14" rx="7" fill="var(--wood-light)" opacity="0.55"/>`;
    }
  }
  frets.forEach((v,i)=>{
    const x = xs[i];
    if(v === 'x'){
      svg += `<text x="${x}" y="${top-8}" font-size="10" fill="var(--bad)" text-anchor="middle">&#10005;</text>`;
    } else if(v === 0){
      svg += `<circle cx="${x}" cy="${top-9}" r="4" fill="none" stroke="var(--good)" stroke-width="1.5"/>`;
    } else {
      const rowIndex = v - baseFret;
      const y = top + rowIndex*fretGap + fretGap/2;
      svg += `<circle cx="${x}" cy="${y}" r="6" fill="var(--wood-light)"/>`;
      const fingerNum = def.fingers && def.fingers[i];
      if(fingerNum){
        svg += `<text x="${x}" y="${y+3}" font-size="8" fill="#221a12" text-anchor="middle" font-weight="700">${fingerNum}</text>`;
      }
    }
  });
  svg += `</svg>`;
  return svg;
}

// Single popover element shared by every chip on the page, created lazily on
// first use, plus the state of whatever chord it's currently showing.
let chordPopoverEl = null;
let pinnedChordEl = null; // the .shape element pinned open by a click, if any
let currentAlts = [];     // buildAlternatives() result for the open popover
let currentAltIndex = 0;  // which alternative the carousel is showing
let currentAnchor = null; // element the popover is positioned relative to

/** Creates the shared popover and wires its carousel buttons on first call; returns the existing one on later calls. */
function ensureChordPopover(){
  if(chordPopoverEl) return chordPopoverEl;
  const el = document.createElement('div');
  el.className = 'chord-popover';
  el.innerHTML = `
    <div class="cp-title"></div>
    <div class="cp-carousel">
      <button type="button" class="cp-nav cp-prev" aria-label="Previous shape">&#8249;</button>
      <div class="cp-diagram-wrap">
        <div class="cp-diagram"></div>
        <div class="cp-diagram-label"></div>
      </div>
      <button type="button" class="cp-nav cp-next" aria-label="Next shape">&#8250;</button>
    </div>
    <div class="cp-dots"></div>
    <div class="cp-note"></div>
  `;
  document.body.appendChild(el);
  el.querySelector('.cp-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    if(!currentAlts.length) return;
    currentAltIndex = (currentAltIndex - 1 + currentAlts.length) % currentAlts.length;
    renderChordCarousel();
    repositionChordPopover();
  });
  el.querySelector('.cp-next').addEventListener('click', (e) => {
    e.stopPropagation();
    if(!currentAlts.length) return;
    currentAltIndex = (currentAltIndex + 1) % currentAlts.length;
    renderChordCarousel();
    repositionChordPopover();
  });
  chordPopoverEl = el;
  return el;
}

/** Repaints the popover's diagram/label/dots for the current alternative, hiding the prev/next arrows when there's only one. */
function renderChordCarousel(){
  const pop = chordPopoverEl;
  const def = currentAlts[currentAltIndex];
  if(!def) return;
  pop.querySelector('.cp-diagram').innerHTML = chordDiagramSVG(def);
  pop.querySelector('.cp-diagram-label').textContent = def.label;
  pop.querySelector('.cp-dots').innerHTML = currentAlts.map((_, i) =>
    `<span class="cp-dot${i === currentAltIndex ? ' active' : ''}"></span>`
  ).join('');
  const multi = currentAlts.length > 1;
  pop.querySelector('.cp-prev').style.visibility = multi ? 'visible' : 'hidden';
  pop.querySelector('.cp-next').style.visibility = multi ? 'visible' : 'hidden';
}

/** Positions the popover just below its anchor chip, staying inside the viewport (flips above the anchor if there's no room below). */
function repositionChordPopover(){
  if(!currentAnchor) return;
  const pop = chordPopoverEl;
  const rect = currentAnchor.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;
  const maxLeft = document.documentElement.clientWidth - popRect.width - 8;
  if(left > maxLeft) left = Math.max(8, maxLeft);
  if(top + popRect.height > document.documentElement.clientHeight - 8){
    top = rect.top - popRect.height - 8;
  }
  pop.style.left = `${left}px`;
  pop.style.top = `${Math.max(8, top)}px`;
}

/**
 * Opens the popover for one chord: looks up its fretting alternatives, shows
 * the first one, and sets the explanatory note (if any) below it.
 * @param {Element} anchor - the .shape element the popover is attached to
 * @param {string} name - chord name shown as the popover title
 * @param {number} pc
 * @param {boolean} isMinor
 * @param {string} extra - raw suffix text, used only in the fallback note
 * @param {?string} quality
 */
function showChordPopover(anchor, name, pc, isMinor, extra, quality){
  const pop = ensureChordPopover();
  currentAlts = buildAlternatives(pc, isMinor, quality);
  currentAltIndex = 0;
  currentAnchor = anchor;
  pop.querySelector('.cp-title').textContent = name;
  renderChordCarousel();

  const key = quality || (isMinor ? 'min' : 'maj');
  let note = '';
  if(!quality){
    note = `Basic triad shown — adjust for the "${extra}" part of the chord.`;
  } else if(key === 'dim'){
    note = 'Diminished triads are normally played with this dim7 fingering in practice.';
  }
  pop.querySelector('.cp-note').textContent = note;

  pop.style.display = 'block';
  repositionChordPopover();
}

/** Hides the popover (a no-op if it hasn't been created yet). */
function hideChordPopover(){
  if(chordPopoverEl) chordPopoverEl.style.display = 'none';
}

/** Un-pins and hides the popover. Call this whenever the page re-renders, so a popover left open from before doesn't linger pointing at stale content. */
export function resetChordPopover(){
  pinnedChordEl = null;
  hideChordPopover();
}

/**
 * Wires up every `.shape[data-pc]` element inside `container` so hovering,
 * clicking, or focusing/pressing Enter/Space opens the chord-diagram
 * popover. Must be called again after any re-render that replaces those
 * elements, since the old ones (and their listeners) are gone.
 *
 * Reads the chord's data straight from the element's `data-*` attributes —
 * `data-pc`, `data-minor`, `data-extra`, `data-quality` — set by script.js
 * when it renders each chip; that's the entire contract between this module
 * and the rest of the app.
 *
 * Clicking toggles a "pinned" state so the popover stays open without
 * hovering; only one chip can be pinned at a time, and clicking anywhere
 * else on the page (or pressing Escape) closes it — see the two
 * document-level listeners at the bottom of this file.
 */
export function attachChordHover(container){
  container.querySelectorAll('.shape[data-pc]').forEach(el=>{
    const pc = parseInt(el.dataset.pc, 10);
    const isMinor = el.dataset.minor === '1';
    const extra = el.dataset.extra || '';
    const quality = el.dataset.quality || null;
    const name = el.textContent;
    const open = () => showChordPopover(el, name, pc, isMinor, extra, quality);
    el.addEventListener('mouseenter', () => { if(!pinnedChordEl) open(); });
    el.addEventListener('mouseleave', () => { if(!pinnedChordEl) hideChordPopover(); });
    el.addEventListener('focus', open);
    el.addEventListener('blur', () => { if(pinnedChordEl !== el) hideChordPopover(); });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if(pinnedChordEl === el){ pinnedChordEl = null; hideChordPopover(); }
      else { pinnedChordEl = el; open(); }
    });
    el.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); el.click(); }
    });
  });
}

// Closing gestures that aren't tied to any one chip: click elsewhere on the
// page, or press Escape.
document.addEventListener('click', () => { pinnedChordEl = null; hideChordPopover(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ pinnedChordEl = null; hideChordPopover(); } });
