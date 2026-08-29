# Capo Position Calculator

A small web tool for guitarists: type in a chord progression, optionally lower
it by a number of semitones (handy when transposing a song into a singer's
range), and it works out where to put a capo so you can play **easy, often
open, chord shapes instead of barre chords** — while still sounding in the
original key.

The core idea: a capo raises the pitch of every open string. So instead of
barring your way through a song in, say, F#, you can put a capo on and play
it as if it were in a friendlier key like G or D. This tool checks every
capo position from fret 1 to 9, works out what shape you'd actually finger
at each one, and ranks the options — favoring shapes that are fully open
(C, D, E, G, A, Am, Em, Dm) over ones that still need a barre, and favoring
lower frets that stay comfortable and keep the guitar's tone bright.

Hovering (or tapping) any chord name also opens a small fretboard diagram,
with a carousel to step through alternative fingerings — an open-position
shape where one exists, plus the movable E-shape and A-shape barre versions.
This works for plain major/minor chords and for `7`, `maj7`, `m7`, `sus2`,
`sus4`, `dim`, `dim7`, `aug`, `6`, and `m6` — every fretting shown was
cross-checked against real chord charts, not guessed. Anything outside that
list still displays and calculates correctly; the diagram just falls back to
a basic triad shape with a note that it's simplified.

## Using it

It's a static site with no build step — open `index.html` through any web
server and it works. The one catch: the app is loaded as an ES module, which
browsers refuse to load from a bare `file://` path, so you do need *some*
local server rather than double-clicking the HTML file.

```bash
npm install
npm start
```

`npm start` serves the project at `http://localhost:8080` and opens it in
your default browser.

## Project structure

```
index.html              entry point / page markup
css/style.css            all styling
js/chords.js              chord parsing, transposition, and fretting-shape
                          lookup — pure logic, no DOM access
js/chord-diagram.js       renders the SVG fretboard diagrams and drives the
                          hover/click popover + carousel
js/script.js              app orchestration: wires the page's inputs/buttons
                          to the two modules above and renders results
tests/                    Vitest test suite (unit, component, and full
                          browser-interaction integration tests)
```

`chords.js` never touches the DOM, and `chord-diagram.js` only knows about
one thing from the rest of the page: a `.shape[data-pc]` element with
`data-minor`/`data-extra`/`data-quality` attributes. `script.js` is the only
file that knows the page's specific element IDs. Keeping that separation is
what makes each piece testable and easy to reason about on its own — please
keep it that way in any changes.

## Development

```bash
npm test              # run the test suite once
npm run test:watch    # re-run tests on file changes
npm run test:coverage # run with a coverage report
```

The suite covers the chord-theory logic in isolation, the diagram/popover
component (including simulated hovering, clicking, keyboard activation, and
carousel navigation), and full integration tests that drive the real
rendered page end to end.
