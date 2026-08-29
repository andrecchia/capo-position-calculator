import { describe, it, expect, vi } from 'vitest';

function buildFixture(chordsValue, semitonesValue){
  document.body.innerHTML = `
    <input type="text" id="chords" value="${chordsValue}">
    <input type="text" id="semitones" value="${semitonesValue}">
    <button type="button" class="toggle-btn active" id="btn-sharp" data-mode="sharp">Sharp (♯)</button>
    <button type="button" class="toggle-btn" id="btn-flat" data-mode="flat">Flat (♭)</button>
    <button id="calc">Calculate</button>
    <div id="target-summary"></div>
    <div id="results"></div>
  `;
}

// Loads the real app fresh against a clean DOM, exactly like the browser does:
// script.js wires up its listeners and runs one calculation immediately on import.
async function loadApp({chords = 'D Em G Bm A', semitones = '0'} = {}){
  vi.resetModules();
  buildFixture(chords, semitones);
  await import('../js/script.js');
}

function shapeByText(root, text){
  return Array.from(root.querySelectorAll('.shape')).find(el => el.textContent === text);
}

describe('initial load', () => {
  it('runs a calculation automatically with the pre-filled progression', async () => {
    await loadApp();
    const chips = document.querySelectorAll('#target-summary .shape');
    expect(Array.from(chips).map(c => c.textContent)).toEqual(['D','Em','G','Bm','A']);
    expect(document.querySelectorAll('#results .option').length).toBeGreaterThan(0);
  });

  it('marks the first (best) option and labels high frets as extended', async () => {
    await loadApp();
    const options = document.querySelectorAll('#results .option');
    expect(options[0].classList.contains('best')).toBe(true);
    options.forEach(opt => {
      const fret = Number(opt.querySelector('.fret-num').textContent);
      expect(opt.classList.contains('extended')).toBe(fret > 5);
    });
  });

  it('shows exactly 8 of the 9 possible capo positions', async () => {
    await loadApp();
    expect(document.querySelectorAll('#results .option')).toHaveLength(8);
  });
});

describe('recalculating after user input', () => {
  it('updates the results when the chord progression is changed and Calculate is clicked', async () => {
    await loadApp();
    document.getElementById('chords').value = 'C G Am F';
    document.getElementById('calc').click();
    const chips = document.querySelectorAll('#target-summary .shape');
    expect(Array.from(chips).map(c => c.textContent)).toEqual(['C','G','Am','F']);
  });

  it('shows an error and clears the summary for unparseable chord text', async () => {
    await loadApp({chords: 'Z Q'});
    expect(document.getElementById('results').textContent).toMatch(/Check the chord spelling/);
    expect(document.getElementById('target-summary').innerHTML).toBe('');
  });

  it('shows an error for a negative semitone count', async () => {
    await loadApp({semitones: '-3'});
    expect(document.getElementById('results').textContent).toMatch(/Enter a valid number of semitones/);
    expect(document.getElementById('target-summary').innerHTML).toBe('');
  });

  it('shows an error for a non-numeric semitone count', async () => {
    await loadApp({semitones: 'abc'});
    expect(document.getElementById('results').textContent).toMatch(/Enter a valid number of semitones/);
  });

  it('treats an empty semitone field as zero (no transposition)', async () => {
    await loadApp({chords: 'D', semitones: ''});
    expect(document.getElementById('target-summary').textContent).toMatch(/no capo/i);
    expect(shapeByText(document.getElementById('target-summary'), 'D')).toBeTruthy();
  });
});

describe('semitone transposition', () => {
  it('labels the transposed progression and shows what each chord used to be', async () => {
    await loadApp({chords: 'D', semitones: '2'});
    const summary = document.getElementById('target-summary');
    expect(summary.textContent).toMatch(/lowered by 2 semitones/);
    expect(shapeByText(summary, 'C')).toBeTruthy(); // D down 2 semitones is C
    expect(summary.querySelector('.real').textContent).toBe('was D');
  });
});

describe('accidental notation toggle', () => {
  it('switches the active button and re-renders using flat spelling', async () => {
    // F# transposed down 5 semitones lands on the C#/Db pitch class.
    await loadApp({chords: 'F#', semitones: '5'});
    const summary = document.getElementById('target-summary');
    expect(shapeByText(summary, 'C#')).toBeTruthy();

    document.getElementById('btn-flat').click();

    expect(document.getElementById('btn-flat').classList.contains('active')).toBe(true);
    expect(document.getElementById('btn-sharp').classList.contains('active')).toBe(false);
    expect(shapeByText(summary, 'Db')).toBeTruthy();
    expect(shapeByText(summary, 'C#')).toBeFalsy();
  });

  it('switching back to sharp restores sharp spelling', async () => {
    await loadApp({chords: 'F#', semitones: '5'});
    document.getElementById('btn-flat').click();
    document.getElementById('btn-sharp').click();
    expect(document.getElementById('btn-sharp').classList.contains('active')).toBe(true);
    expect(shapeByText(document.getElementById('target-summary'), 'C#')).toBeTruthy();
  });
});

describe('chord diagram popover, wired through the real rendered chips', () => {
  it('opens on hovering a chip in the target summary', async () => {
    await loadApp();
    const d = shapeByText(document.getElementById('target-summary'), 'D');
    d.dispatchEvent(new MouseEvent('mouseenter'));
    const pop = document.querySelector('.chord-popover');
    expect(pop.style.display).toBe('block');
    expect(pop.querySelector('.cp-title').textContent).toBe('D');
  });

  it('opens on hovering a chip inside a capo-option result', async () => {
    await loadApp();
    const anyResultShape = document.querySelector('#results .option .shape');
    anyResultShape.dispatchEvent(new MouseEvent('mouseenter'));
    const pop = document.querySelector('.chord-popover');
    expect(pop.style.display).toBe('block');
    expect(pop.querySelector('.cp-title').textContent).toBe(anyResultShape.textContent);
  });

  it('closes when clicking elsewhere on the page', async () => {
    await loadApp();
    const d = shapeByText(document.getElementById('target-summary'), 'D');
    d.click();
    expect(document.querySelector('.chord-popover').style.display).toBe('block');
    document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(document.querySelector('.chord-popover').style.display).toBe('none');
  });

  it('is closed by clicking Calculate again, even if it was pinned open', async () => {
    await loadApp();
    shapeByText(document.getElementById('target-summary'), 'D').click();
    expect(document.querySelector('.chord-popover').style.display).toBe('block');

    document.getElementById('calc').click();

    expect(document.querySelector('.chord-popover').style.display).toBe('none');
  });

  it('still works on chips rendered by a later recalculation (listeners re-attached each render)', async () => {
    await loadApp();
    document.getElementById('chords').value = 'C';
    document.getElementById('calc').click();
    const c = shapeByText(document.getElementById('target-summary'), 'C');
    c.click();
    expect(document.querySelector('.chord-popover').style.display).toBe('block');
    expect(document.querySelector('.chord-popover .cp-title').textContent).toBe('C');
  });
});

describe('rendered chip data attributes', () => {
  it('carry the correct pitch class, minor flag, quality and extra suffix', async () => {
    await loadApp({chords: 'F#m7'});
    const chip = shapeByText(document.getElementById('target-summary'), 'F#m7');
    expect(chip.dataset.pc).toBe('6');
    expect(chip.dataset.minor).toBe('1');
    expect(chip.dataset.quality).toBe('min7');
    expect(chip.dataset.extra).toBe('7');
  });

  it('leaves data-quality empty for an unsupported chord extension', async () => {
    await loadApp({chords: 'Cadd9'});
    const chip = shapeByText(document.getElementById('target-summary'), 'Cadd9');
    expect(chip.dataset.quality).toBe('');
    expect(chip.dataset.extra).toBe('add9');
  });
});
