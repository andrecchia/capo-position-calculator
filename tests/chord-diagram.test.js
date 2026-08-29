import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chordDiagramSVG } from '../js/chord-diagram.js';

describe('chordDiagramSVG', () => {
  it('draws a thick nut and no fret label for an open-position shape (baseFret 1)', () => {
    const svg = chordDiagramSVG({frets:[0,2,2,1,0,0]}); // baseFret defaults to 1
    expect(svg).toMatch(/<rect[^>]*height="3"/);
    expect(svg).not.toMatch(/fr<\/text>/);
  });

  it('draws a fret-number label and a thin nut line for a shifted shape', () => {
    const svg = chordDiagramSVG({frets:[3,5,3,4,3,3], baseFret:3, barre:3});
    expect(svg).toMatch(/>3fr<\/text>/);
    expect(svg).not.toMatch(/<rect[^>]*height="3"/);
  });

  it('renders a muted-string marker for "x" entries', () => {
    const svg = chordDiagramSVG({frets:['x','x',9,10,9,10], baseFret:9, barre:null});
    expect(svg.match(/&#10005;/g)).toHaveLength(2);
  });

  it('renders an open-circle marker for open (0) strings', () => {
    const svg = chordDiagramSVG({frets:[0,2,2,1,0,0]});
    // 3 open strings (index 0, 4, 5) rendered as unfilled circles
    expect(svg.match(/fill="none" stroke="var\(--good\)"/g)).toHaveLength(3);
  });

  it('renders finger numbers when a fingers array is supplied', () => {
    const svg = chordDiagramSVG({frets:['x',3,2,0,1,0], fingers:['',3,2,'',1,'']});
    expect(svg).toMatch(/>3<\/text>/);
    expect(svg).toMatch(/>2<\/text>/);
    expect(svg).toMatch(/>1<\/text>/);
  });

  it('omits finger numbers when no fingers array is supplied', () => {
    const svg = chordDiagramSVG({frets:[3,5,3,4,3,3], baseFret:3, barre:3});
    expect(svg).not.toMatch(/font-weight="700">\d</);
  });

  it('draws a barre bar only when the shape declares one', () => {
    const barred = chordDiagramSVG({frets:[3,5,3,4,3,3], baseFret:3, barre:3});
    expect(barred).toMatch(/rx="7"/);

    const notBarred = chordDiagramSVG({frets:['x','x',9,10,9,10], baseFret:9, barre:null});
    expect(notBarred).not.toMatch(/rx="7"/);
  });

  it('widens the left margin to fit a two-digit fret label', () => {
    const openSvg = chordDiagramSVG({frets:[0,2,2,1,0,0]});
    const shiftedSvg = chordDiagramSVG({frets:[10,12,12,11,10,10], baseFret:10, barre:10});
    const openWidth = Number(openSvg.match(/width="(\d+)"/)[1]);
    const shiftedWidth = Number(shiftedSvg.match(/width="(\d+)"/)[1]);
    expect(shiftedWidth).toBeGreaterThan(openWidth);
  });
});

describe('chord popover + carousel (attachChordHover)', () => {
  let attachChordHover, resetChordPopover;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="container">
        <div class="shape" tabindex="0" data-pc="7" data-minor="0" data-quality="dom7" data-extra="7">G7</div>
        <div class="shape" tabindex="0" data-pc="11" data-minor="0" data-quality="dim7" data-extra="dim7">Bdim7</div>
        <div class="shape" tabindex="0" data-pc="4" data-minor="0" data-quality="" data-extra="9">E9</div>
        <div class="shape" tabindex="0" data-pc="9" data-minor="1" data-quality="" data-extra="9">Am9</div>
        <div id="outside">elsewhere</div>
      </div>
    `;
    ({ attachChordHover, resetChordPopover } = await import('../js/chord-diagram.js'));
    attachChordHover(document.getElementById('container'));
  });

  function popover(){ return document.querySelector('.chord-popover'); }
  function shape(text){
    return Array.from(document.querySelectorAll('.shape')).find(el => el.textContent === text);
  }

  it('creates exactly one popover element in the document, lazily', () => {
    expect(popover()).toBeNull();
    shape('G7').dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelectorAll('.chord-popover')).toHaveLength(1);
  });

  it('shows the popover with the chord name on mouseenter', () => {
    shape('G7').dispatchEvent(new MouseEvent('mouseenter'));
    expect(popover().style.display).toBe('block');
    expect(popover().querySelector('.cp-title').textContent).toBe('G7');
    expect(popover().querySelector('.cp-diagram-label').textContent).toBe('Barre · E-shape');
  });

  it('hides the popover on mouseleave when not pinned', () => {
    const g7 = shape('G7');
    g7.dispatchEvent(new MouseEvent('mouseenter'));
    expect(popover().style.display).toBe('block');
    g7.dispatchEvent(new MouseEvent('mouseleave'));
    expect(popover().style.display).toBe('none');
  });

  it('pins the popover open on click, surviving a mouseleave', () => {
    const g7 = shape('G7');
    g7.click();
    expect(popover().style.display).toBe('block');
    g7.dispatchEvent(new MouseEvent('mouseleave'));
    expect(popover().style.display).toBe('block');
  });

  it('unpins and hides when the pinned shape is clicked again', () => {
    const g7 = shape('G7');
    g7.click();
    g7.click();
    expect(popover().style.display).toBe('none');
  });

  it('closes an open popover when clicking elsewhere on the page', () => {
    shape('G7').click();
    expect(popover().style.display).toBe('block');
    document.getElementById('outside').dispatchEvent(new MouseEvent('click', {bubbles:true}));
    expect(popover().style.display).toBe('none');
  });

  it('does not close when clicking the shape itself (event does not reach the document handler)', () => {
    const g7 = shape('G7');
    g7.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    expect(popover().style.display).toBe('block');
  });

  it('closes on Escape', () => {
    shape('G7').click();
    expect(popover().style.display).toBe('block');
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    expect(popover().style.display).toBe('none');
  });

  it('shows the popover on focus and hides it on blur when not pinned', () => {
    const g7 = shape('G7');
    g7.focus();
    expect(popover().style.display).toBe('block');
    g7.blur();
    expect(popover().style.display).toBe('none');
  });

  it.each(['Enter', ' '])('opens (and pins) via the %s key, like a click', (key) => {
    const g7 = shape('G7');
    g7.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true}));
    expect(popover().style.display).toBe('block');
    g7.dispatchEvent(new MouseEvent('mouseleave'));
    expect(popover().style.display).toBe('block'); // stayed open => click() pinned it
  });

  it('steps through alternatives with the next/prev carousel buttons', () => {
    shape('G7').click(); // 2 alternatives: E-shape, A-shape
    const pop = popover();
    expect(pop.querySelector('.cp-diagram-label').textContent).toBe('Barre · E-shape');

    pop.querySelector('.cp-next').click();
    expect(pop.querySelector('.cp-diagram-label').textContent).toBe('Barre · A-shape');

    pop.querySelector('.cp-next').click(); // wraps back around
    expect(pop.querySelector('.cp-diagram-label').textContent).toBe('Barre · E-shape');

    pop.querySelector('.cp-prev').click(); // wraps backward
    expect(pop.querySelector('.cp-diagram-label').textContent).toBe('Barre · A-shape');
  });

  it('renders one dot per alternative, marking the active one', () => {
    shape('G7').click();
    const pop = popover();
    const dots = pop.querySelectorAll('.cp-dot');
    expect(dots).toHaveLength(2);
    expect(dots[0].classList.contains('active')).toBe(true);
    pop.querySelector('.cp-next').click();
    expect(pop.querySelectorAll('.cp-dot')[1].classList.contains('active')).toBe(true);
  });

  it('hides the carousel arrows when there is only one alternative', () => {
    shape('Bdim7').click();
    const pop = popover();
    expect(pop.querySelector('.cp-prev').style.visibility).toBe('hidden');
    expect(pop.querySelector('.cp-next').style.visibility).toBe('hidden');
  });

  it('shows the "basic triad" note for an unsupported quality, and none for a supported one', () => {
    shape('E9').click();
    expect(popover().querySelector('.cp-note').textContent).toMatch(/adjust for the "9" part/);

    shape('E9').click(); // unpin
    shape('G7').click();
    expect(popover().querySelector('.cp-note').textContent).toBe('');
  });

  it('shows the same fallback note for an unsupported minor-chord extension', () => {
    shape('Am9').click();
    expect(popover().querySelector('.cp-note').textContent).toMatch(/adjust for the "9" part/);
  });

  it('shows the dim7-in-practice note for plain "dim" quality', () => {
    const container = document.getElementById('container');
    container.insertAdjacentHTML('beforeend', '<div class="shape" tabindex="0" data-pc="11" data-minor="0" data-quality="dim" data-extra="dim">Bdim</div>');
    attachChordHover(container);
    shape('Bdim').click();
    expect(popover().querySelector('.cp-note').textContent).toMatch(/normally played with this dim7 fingering/);
  });

  it('resetChordPopover clears a pinned popover', () => {
    shape('G7').click();
    expect(popover().style.display).toBe('block');
    resetChordPopover();
    expect(popover().style.display).toBe('none');
    // and it should no longer be considered pinned: hovering elsewhere alone can now close it again
    shape('G7').dispatchEvent(new MouseEvent('mouseenter'));
    shape('G7').dispatchEvent(new MouseEvent('mouseleave'));
    expect(popover().style.display).toBe('none');
  });
});
