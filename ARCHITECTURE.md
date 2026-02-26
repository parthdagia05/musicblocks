# Music Blocks v3 — Comprehensive Architecture Document

> **Audience:** Systems architects, senior maintainers, GSoC mentors & contributors  
> **Codebase version:** v3 (current `master`)  
> **Generated from:** full source-level reverse engineering

---

## Table of Contents

1. [High-Level Architecture](#section-1-high-level-architecture)
2. [Folder Structure Deep Dive](#section-2-folder-structure-deep-dive)
3. [Application Initialization Flow](#section-3-application-initialization-flow)
4. [Blocks System](#section-4-blocks-system)
5. [Execution Engine](#section-5-execution-engine)
6. [Audio Engine](#section-6-audio-engine)
7. [Persistence & Backend](#section-7-persistence--backend)
8. [Performance & Bottlenecks](#section-8-performance--bottlenecks)
9. [Manual Testing Checklist](#section-9-manual-testing-checklist)
10. [Migration Plan to v4 (React/TypeScript)](#section-10-migration-plan-to-v4)

---

## SECTION 1: High-Level Architecture

### 1.1 System Design Overview

Music Blocks v3 is a **monolithic single-page application (SPA)** built with vanilla JavaScript, rendered on an HTML5 Canvas via **CreateJS (EaselJS/TweenJS)**, with audio powered by **Tone.js** and the Web Audio API. The UI chrome uses **jQuery + Materialize CSS**, while module loading is handled by **RequireJS**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        index.html                               │
│  (Bootstrap: loads libs, CSS, sets up DOM, invokes RequireJS)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                      ┌──────▼──────┐
                      │  loader.js  │  RequireJS config + i18n + module shims
                      └──────┬──────┘
                             │
              ┌──────────────▼──────────────┐
              │        Activity             │  God-object orchestrator
              │  (js/activity.js — ~7900L)  │
              └──┬───┬───┬───┬───┬───┬──────┘
                 │   │   │   │   │   │
    ┌────────┐ ┌─▼─┐ │ ┌─▼─┐ │ ┌─▼────────┐
    │Toolbar │ │Pal│ │ │Tur│ │ │SaveIntf   │
    │        │ │ett│ │ │tle│ │ │           │
    └────────┘ │es │ │ │s  │ │ └───────────┘
               └───┘ │ └───┘ │
              ┌──────▼──┐  ┌─▼──────────┐
              │ Blocks   │  │   Logo     │
              │(js/      │  │(js/logo.js │
              │blocks.js)│  │ ~2527L)    │
              └──────────┘  └─────┬──────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Singer / Synth / Tone   │
                    │  (turtle-singer, synthutils│
                    │   Tone.js Web Audio API)   │
                    └───────────────────────────┘
```

### 1.2 Key Design Patterns

| Pattern | Where Used |
|---------|-----------|
| **God Object** | `Activity` holds references to every subsystem |
| **Prototype Registry** | `ProtoBlock` → `Block` instantiation via `BlockFactory` (SVG class) |
| **Event-Driven Execution** | `Logo` dispatches named events via `stage.dispatchEvent()` for clamp end-signals |
| **Queue-Based Interpreter** | `Logo.runFromBlockNow()` uses `Queue` objects on per-turtle queues |
| **Observer/Listener** | Turtle listeners registered on the CreateJS stage for block flow control |
| **MVC (partial)** | `Turtles` splits into `TurtlesModel` + `TurtlesView` inner classes |

### 1.3 Technology Stack

| Layer | Technology |
|-------|-----------|
| Module Loading | RequireJS (AMD) |
| Canvas Rendering | CreateJS (EaselJS + TweenJS) |
| Audio Synthesis | Tone.js + Web Audio API |
| UI Framework | jQuery + Materialize CSS |
| i18n | i18next |
| Testing | Jest (unit) + Cypress (e2e) |
| Build | Gulp (legacy) |
| Packaging | Electron (optional desktop build) |
| Server | Express.js (dev server) |

---

## SECTION 2: Folder Structure Deep Dive

```
musicblocks-clean/
├── index.html              # Entry point — loads all libs, sets up DOM skeleton
├── package.json            # Dependencies, scripts (lint, test, build, serve)
├── server.js                   # Express dev server
├── header.html / planet.html  # Sugarizer integration & Planet community pages
│
├── js/                     # ★ Core application source (~150+ files)
│   ├── activity.js          # (7905L) God-object: orchestrates entire app
│   ├── loader.js           # (352L)  RequireJS config, i18n bootstrap
│   ├── logo.js              # (2527L) Execution engine / interpreter
│   ├── block.js            # (1800+L) Individual Block class
│   ├── blocks.js          # (3000+L) Block collection manager
│   ├── protoblocks.js      # (2105L) Block prototype definitions (largely deprecated)
│   ├── blockfactory.js     # (1820L) SVG class — generates block artwork
│   ├── palette.js          # (1632L) Palette UI system
│   ├── toolbar.js          # (1293L) Top toolbar rendering
│   ├── turtle.js           # (989L)  Individual Turtle controller
│   ├── turtles.js          # (868L)  Turtles collection (Model+View)
│   ├── turtle-singer.js    # (1500+L) Musical state per turtle (Singer class)
│   ├── SaveInterface.js    # (881L)  Export: HTML/SVG/PNG/MIDI/ABC/Lilypond/MusicXML/WAV
│   │
│   ├── blocks/             # ★ Block definitions by category (24 files)
│   │   ├── FlowBlocks.js       # backward, duplicate, switch/case, repeat, forever, if/else
│   │   ├── PitchBlocks.js      # pitch, hertz, scalar step, accidentals, inversion, transpose
│   │   ├── RhythmBlocks.js     # note value, dot, tie, swing, skipnotes
│   │   ├── MeterBlocks.js      # meter, BPM, pickup, on-beat, off-beat
│   │   ├── ToneBlocks.js       # set timbre, vibrato, tremolo, phaser, chorus, distortion
│   │   ├── VolumeBlocks.js     # crescendo, decrescendo, set volume, articulation
│   │   ├── IntervalsBlocks.js  # scalar/semi-tone intervals, temperament, set key
│   │   ├── DrumBlocks.js       # play drum, map pitch to drum, set drum
│   │   ├── ActionBlocks.js     # action (define), do (call), named do, calc, return
│   │   ├── GraphicsBlocks.js   # forward, right, arc, setxy, set heading, pen
│   │   ├── PenBlocks.js        # pen up/down, color, shade, pen size
│   │   ├── ProgramBlocks.js    # start, forever, comment, print, save heap
│   │   ├── SensorsBlocks.js    # mouse position, keyboard, time, loudness
│   │   ├── BooleanBlocks.js    # and, or, not, greater, less, equal
│   │   ├── NumberBlocks.js     # arithmetic, random, modulo, sqrt, trig
│   │   ├── BoxesBlocks.js      # named boxes (variables), store/retrieve
│   │   ├── HeapBlocks.js       # heap (stack) operations
│   │   ├── DictBlocks.js       # dictionary operations
│   │   ├── EnsembleBlocks.js   # multi-turtle coordination
│   │   ├── MediaBlocks.js      # show, camera, text, load file
│   │   ├── ExtrasBlocks.js     # open project, save, plugin support
│   │   ├── OrnamentBlocks.js   # staccato, slur, neighbor, glide
│   │   ├── RhythmBlockPaletteBlocks.js  # rhythm palette specifics
│   │   └── WidgetBlocks.js     # status, oscilloscope, phrase maker, etc.
│   │
│   ├── turtleactions/      # Action implementations per domain (9 files)
│   │   ├── PitchActions.js     # Singer.processPitch, transposition logic
│   │   ├── RhythmActions.js    # Singer.processNote, note value calculations
│   │   ├── MeterActions.js     # BPM, meter changes, pickup
│   │   ├── IntervalsActions.js # interval calculations, mode/key operations
│   │   ├── DrumActions.js      # drum mapping and playback
│   │   ├── ToneActions.js      # timbre, effects, synth control
│   │   ├── VolumeActions.js    # volume, crescendo, master volume
│   │   ├── OrnamentActions.js  # staccato, slur parameters
│   │   └── DictActions.js      # dictionary operations
│   │
│   ├── widgets/            # Interactive music tool windows (30 files)
│   │   ├── phrasemaker.js      # (229K) Phrase Maker / Matrix — the largest widget
│   │   ├── musickeyboard.js    # (137K) On-screen piano keyboard
│   │   ├── legobricks.js       # (115K) Lego-style beat builder
│   │   ├── timbre.js           # (108K) Timbre/instrument designer
│   │   ├── rhythmruler.js      # (103K) Rhythm pattern ruler
│   │   ├── temperament.js      # (95K)  Temperament/tuning explorer
│   │   ├── sampler.js          # (94K)  Audio sampler
│   │   ├── aiwidget.js         # (48K)  AI music generation
│   │   ├── aidebugger.js       # (42K)  AI code debugger
│   │   ├── jseditor.js         # (42K)  JavaScript code editor
│   │   ├── modewidget.js       # (39K)  Musical mode explorer
│   │   ├── pitchdrummatrix.js  # (36K)  Pitch-to-drum mapper
│   │   ├── widgetWindows.js    # (21K)  Window manager for all widgets
│   │   └── ... (more: arpeggio, meterwidget, oscilloscope, etc.)
│   │
│   ├── utils/              # Utility modules
│   │   ├── synthutils.js       # (3467L) Synth definitions, instrument/drum/effect constants
│   │   ├── musicutils.js       # Musical theory: scales, intervals, pitch math
│   │   ├── utils.js            # DOM helpers, math utils, string formatting
│   │   ├── platformstyle.js    # Platform detection, color themes
│   │   └── ... (munsell, sanitizer, etc.)
│   │
│   └── js-export/          # Block-to-JavaScript transpiler
│       ├── export.js           # Main transpiler — blocks → JS code
│       ├── interface.js        # Runtime API that exported JS calls
│       ├── ASTutils.js         # AST manipulation utilities
│       ├── ast2blocklist.js    # Convert AST back to block list
│       ├── generate.js         # Code generation from AST
│       ├── constraints.js      # Type constraints for transpilation
│       └── API/                # Per-category API wrappers (22 files)
│
├── sounds/                 # Audio assets
│   ├── samples/            # PCM samples for instruments (54 directories)
│   └── tick.mp3            # Metronome tick
│
├── images/                 # SVG icons for blocks, instruments, UI
├── css/                    # Stylesheets (activity.css, materialize overrides)
├── lib/                    # Third-party libraries (require.js, createjs, etc.)
├── header/                 # Sugarizer integration headers
├── cypress/                # End-to-end test suites
└── guide/                  # User-facing documentation
```

---

## SECTION 3: Application Initialization Flow

### 3.1 Boot Sequence (step-by-step)

```
Browser loads index.html
  │
  ├─ 1. Load CSS: activity.css, materialize.css, Google Fonts
  ├─ 2. Load libs: jQuery, Materialize, Tone.js, CreateJS, wheelnav
  ├─ 3. Execute inline <script>: set up DOM elements, responsive handlers
  ├─ 4. Load RequireJS → data-main="js/loader.js"
  │
  └─ js/loader.js executes:
       │
       ├─ 5. Configure RequireJS paths/shims for ~50+ modules
       ├─ 6. Initialize i18next (load translation JSON)
       ├─ 7. require(["activity/activity"], ...) → loads activity.js
       │
       └─ Activity constructor runs:
            │
            ├─ 8.  Set globalActivity = this
            ├─ 9.  Initialize state flags (beginnerMode, themes, i18n)
            ├─ 10. Start requestAnimationFrame render loop (dirty-flag pattern)
            │
            └─ setupDependencies() called:
                 │
                 ├─ 11. Grab DOM references (canvas, toolbar, choosers, search)
                 ├─ 12. doPluginsAndPaletteCols() — compute palette colors
                 ├─ 13. Create CreateJS stages (masterStage, stage)
                 ├─ 14. Instantiate Turtles(this) → sets up canvas layers
                 ├─ 15. Instantiate Blocks(this) → block collection manager
                 ├─ 16. Instantiate Palettes(this) → palette UI
                 ├─ 17. Instantiate Logo(this) → execution engine
                 ├─ 18. Instantiate Toolbar, SaveInterface
                 │
                 ├─ 19. Setup block definitions:
                 │      setupXxxBlocks(activity) called for each of 24 block files
                 │      Each registers ProtoBlock instances on palettes
                 │
                 ├─ 20. palettes.makePalettes() — render palette buttons
                 ├─ 21. Load session data (from Planet or localStorage)
                 ├─ 22. blocks.loadNewBlocks(JSON.parse(sessionData))
                 └─ 23. Fire "finishedLoading" event → enable keyboard, clear loading
```

### 3.2 Module Dependency Graph (simplified)

```
loader.js
  └─ activity.js
       ├─ blocks.js ← block.js ← protoblocks.js ← blockfactory.js (SVG)
       ├─ palette.js
       ├─ logo.js ← turtle-singer.js ← synthutils.js
       ├─ turtles.js ← turtle.js
       ├─ toolbar.js
       ├─ SaveInterface.js
       ├─ blocks/*.js (24 block definition files)
       ├─ turtleactions/*.js (9 action files)
       └─ widgets/*.js (loaded on demand)
```

---

## SECTION 4: Blocks System

### 4.1 Block Hierarchy

```
ProtoBlock (js/protoblocks.js)         Block (js/block.js)
  - Template/prototype for a block       - Runtime instance on canvas
  - name, palette, dockTypes             - connections[], value, container
  - args count, flow/arg definition      - position (x, y), trash flag
  - SVG generator methods               - highlight/unhighlight state
  - flow() and arg() callbacks           - Belongs to Blocks collection
```

**Block Types** (from ProtoBlock styles):
- **FlowBlock** — has top/bottom connectors, executes sequentially
- **FlowClampBlock** — flow block with an inner clamp (e.g., repeat, note)
- **ValueBlock** — outputs a value (number, text, boolean)
- **ArgBlock** — provides an argument to a parent block
- **BaseBlock** — minimal block (e.g., break/stop)

### 4.2 Block Registration Pattern

Each `js/blocks/XxxBlocks.js` file exports a `setupXxxBlocks(activity)` function that defines inner classes extending block base types:

```javascript
function setupFlowBlocks(activity) {
    class BackwardBlock extends FlowClampBlock {
        constructor() {
            super("backward");
            this.setPalette("flow", activity);
            this.formBlock({ name: _("backward") });
        }
        flow(args, logo, turtle, blk) {
            // Execution logic — returns [childFlow, childFlowCount]
        }
    }
    new BackwardBlock(); // Self-registering
}
```

### 4.3 Block Connections Model

Blocks connect via a **connections array** where:
- `connections[0]` = parent block (upstream)
- `connections[1..n-1]` = arguments/inputs
- `connections[n]` = next flow block (downstream) or child flow (clamp interior)

Dock types enforce connection compatibility: `"in"`, `"out"`, `"numberin"`, `"textin"`, `"booleanin"`, `"anyin"`, `"mediain"`, `"casein"`, `"caseout"`, etc.

### 4.4 Block Categories (Palettes)

| Palette | Block Count | Purpose |
|---------|-------------|---------|
| **Rhythm** | ~25 | Note values, dots, ties, rests, tuplets |
| **Pitch** | ~30 | Pitch, hertz, scale degree, accidentals, transposition |
| **Meter** | ~20 | BPM, time signature, pickup, beat actions |
| **Tone** | ~15 | Timbre, vibrato, tremolo, chorus, distortion |
| **Volume** | ~12 | Crescendo, master volume, articulation |
| **Intervals** | ~18 | Scalar intervals, modes, temperaments |
| **Drum** | ~8 | Drum playback, pitch-drum mapping |
| **Flow** | ~15 | Repeat, if/else, switch, backward, duplicate |
| **Action** | ~12 | Define/call actions, calc, return, named do |
| **Graphics** | ~15 | Forward, right, arc, setxy, heading |
| **Pen** | ~12 | Pen state, color, shade, size |
| **Boxes** | ~8 | Variables (store/retrieve named values) |
| **Sensors** | ~10 | Mouse, keyboard, time, loudness |
| **Ensemble** | ~8 | Multi-turtle coordination |
| **Widgets** | ~15 | Status, phrase maker, oscilloscope, etc. |

---

## SECTION 5: Execution Engine

### 5.1 Overview

The execution engine lives in `Logo` (js/logo.js, ~2527 lines). It implements a **queue-based tree-walking interpreter** that runs block programs per-turtle.

### 5.2 Execution Flow

```
logo.runLogoCommands(startHere, env)
  │
  ├─ 1. Restore broken connections, save state locally
  ├─ 2. Reset all musical state (BPM, synths, notation)
  ├─ 3. Initialize each turtle (initTurtle)
  ├─ 4. prepSynths() — ensure default synth per turtle
  │
  ├─ 5. Find start blocks (blocks.findStacks)
  │     Categorize: "start", "drum", "status", "oscilloscope", "action"
  │     Register named actions: logo.actions[name] = firstBlockInClamp
  │
  └─ 6. For each start block:
       logo.runFromBlock(logo, turtle, startBlk, 0, env)
         │
         ├─ If turtleDelay === TURTLESTEP → push to stepQueue (step mode)
         └─ Else → setTimeout → logo.runFromBlockNow(...)
              │
              ├─ (1) Parse arguments via parseArg() recursively
              ├─ (2) Call block.protoblock.flow(args, logo, turtle, blk, ...)
              │      Returns: [childFlow, childFlowCount, earlyReturn?]
              ├─ (3) Queue management:
              │      - Push nextFlow (downstream) to tur.queue
              │      - Push childFlow (clamp interior) to tur.queue
              │      - Decrement repeat counts, dispatch clamp-end signals
              ├─ (4) Highlight current block (if visible + not suppressed)
              └─ (5) Recurse: runFromBlock or runFromBlockNow for next block
```

### 5.3 The Queue System

Each turtle maintains several queues:

| Queue | Purpose |
|-------|---------|
| `tur.queue` | Array of `Queue(blk, count, parentBlk, args)` — pending blocks |
| `tur.parentFlowQueue` | Tracks parent blocks for unhighlighting |
| `tur.unhighlightQueue` | Blocks to unhighlight after child flow completes |
| `tur.parameterQueue` | Parameter blocks to update display values |
| `tur.endOfClampSignals` | Map: blockId → [listenerNames] dispatched at clamp end |

### 5.4 Control Flow Mechanisms

- **Repeat/Forever**: `Queue.count` set to repeat value (or -1 for forever); decremented each pass
- **Backward**: Reverses flow by following `connections[0]` instead of last connection
- **Switch/Case**: `logo.switchCases[turtle][blk]` stores case→flow mappings; evaluated at clamp end
- **Actions (functions)**: `logo.actions[name]` maps to entry block; called via `do` blocks
- **Events/Listeners**: `logo.setTurtleListener()` registers on CreateJS stage; `setDispatchBlock()` maps signals to clamp-end blocks

### 5.5 Timing & Delays

- `logo.turtleDelay`: ms between block executions (0 = full speed, -1 = step mode)
- `tur.waitTime`: per-turtle additional wait (for `wait` blocks)
- Musical timing: `tur.singer.turtleTime` tracks elapsed time for note scheduling

---

## SECTION 6: Audio Engine

### 6.1 Architecture

```
┌──────────────────────────────────────────────────┐
│              Singer (turtle-singer.js)            │
│  Per-turtle musical state: key, BPM, volume,     │
│  transposition, note stacks, oscillator lists     │
├──────────────────────────────────────────────────┤
│         SynthUtils (utils/synthutils.js)          │
│  Instrument definitions (VOICENAMES, DRUMNAMES),  │
│  SAMPLE_INFO paths, synth creation/loading        │
├──────────────────────────────────────────────────┤
│              Tone.js (lib/tone.js)                │
│  Synthesizers, Samplers, Effects, Transport       │
├──────────────────────────────────────────────────┤
│           Web Audio API (browser native)          │
│  AudioContext, oscillators, gain nodes            │
└──────────────────────────────────────────────────┘
```

### 6.2 Instrument System

**VOICENAMES** (~30 instruments): piano, violin, viola, cello, flute, clarinet, trumpet, guitar, banjo, etc.  
**DRUMNAMES** (~25 percussion): snare drum, kick drum, hi-hat, tom-tom, cowbell, clap, crash, ride, etc.  
**Synth types**: sine, square, sawtooth, triangle, electronic synth, noise1/2/3, custom

**Sample Loading**: Instruments backed by PCM samples live in `sounds/samples/<instrument>/`. The `SAMPLE_INFO` object maps instrument names to paths and global variable names. Samples are loaded lazily when first used.

### 6.3 Note Playback Pipeline

```
Singer.processNote(activity, noteValue, isOsc, blk, turtle, callback)
  │
  ├─ 1. Calculate note duration from noteValue and BPM
  ├─ 2. Process pitch stack: notePitches[], noteOctaves[], noteCents[]
  ├─ 3. Apply transformations: transposition, inversion, pitch-drum mapping
  ├─ 4. Apply effects: staccato, slur, swing, articulation
  │
  ├─ 5. For each pitch in chord:
  │     synth.triggerAttackRelease(frequency, duration, time)
  │
  ├─ 6. Dispatch embedded graphics (turtle movements during note)
  ├─ 7. Update notation (Lilypond/ABC/MIDI staging)
  └─ 8. Schedule callback for next block after note duration
```

### 6.4 Volume & Effects

- **Master volume**: Global via `Tone.Destination.volume`
- **Per-turtle volume**: `tur.singer.synthVolume[instrumentName]`
- **Effects chain**: vibrato, tremolo, phaser, chorus, distortion, applied as Tone.js effect nodes
- **Crescendo/Decrescendo**: Volume arrays that ramp over specified beats

---

## SECTION 7: Persistence & Backend

### 7.1 Project Format

Projects are serialized as **JSON arrays of block descriptors**:

```json
[
  [0, ["start", {"collapsed": false}], 100, 100, [null, 1, null]],
  [1, "pitch", 0, 0, [0, 2, 3, null]],
  [2, ["solfege", {"value": "sol"}], 0, 0, [1]],
  [3, ["number", {"value": 4}], 0, 0, [1]]
]
```

Each entry: `[blockId, blockType, x, y, connections[]]`

### 7.2 Storage Mechanisms

| Mechanism | Key | Usage |
|-----------|-----|-------|
| `localStorage` | `SESSION<projectId>` | Auto-save current session |
| `localStorage` | `currentProject` | Active project identifier |
| `localStorage` | `beginnerMode` | User preference |
| `localStorage` | `languagePreference` | i18n setting |
| `localStorage` | `themePreference` | Dark/light theme |
| **Planet** (server) | HTTP API | Cloud project sharing/loading |
| **File download** | Various | Export as HTML/SVG/PNG/MIDI/ABC/Lilypond/MusicXML/WAV |

### 7.3 Save/Load Flow

**Save**: `activity.saveLocally()` → `JSON.stringify(blocks.blockList)` → `localStorage`  
**Load**: `blocks.loadNewBlocks(JSON.parse(data))` → recreates Block instances, connections, positions  
**Planet**: `planet.openProjectFromPlanet(id)` → fetches JSON → `loadNewBlocks()`

### 7.4 Export Formats (SaveInterface.js)

| Format | Method | Output |
|--------|--------|--------|
| HTML | `saveHTML()` | Self-contained HTML file with embedded project |
| SVG | `saveSVG()` | Turtle canvas artwork as SVG |
| PNG | `savePNG()` | Canvas rasterized to PNG |
| MIDI | `saveMIDI()` | Standard MIDI file via `logo._midiData` |
| ABC | `saveAbc()` | ABC notation text |
| Lilypond | `saveLilypond()` | Lilypond notation for engraving |
| MusicXML | `saveMxml()` | MusicXML interchange format |
| WAV | `saveWAV()` | Audio recording via `MediaRecorder` + Tone.js |
| Block Art | `saveBlockArtwork()` | SVG/PNG of block program itself |

---

## SECTION 8: Performance & Bottlenecks

### 8.1 Known Bottlenecks

| Issue | Cause | Impact |
|-------|-------|--------|
| **Canvas redraws** | `stage.update()` called on every tick | 60fps overhead when idle; mitigated by dirty-flag pattern |
| **Block rendering** | Each block is a CreateJS Container with SVG bitmap | Large programs (100+ blocks) cause slow initial render |
| **SVG generation** | `blockfactory.js` generates SVG paths per block | CPU-intensive for many blocks |
| **DOM event handlers** | Many inline jQuery handlers, global event listeners | Memory leaks if not cleaned up |
| **Synth initialization** | Tone.js Sampler loads PCM samples on first use | Audible delay on first note with new instrument |
| **God object** | `Activity` (~7900 lines) holds all references | Hard to garbage collect, monolithic updates |
| **Global state** | `instruments[]`, `instrumentsFilters[]`, `instrumentsEffects[]` are module-global | No isolation between execution runs |
| **`eval()` usage** | Plugin system uses `eval()` for flow/arg evaluation | Security risk, prevents optimization |
| **Busy-wait lock** | `DuplicateBlock` uses spin-wait for `connectionStoreLock` | Can block main thread |

### 8.2 Optimizations Already Present

- **Dirty-flag rendering**: `stageDirty` flag prevents unnecessary `stage.update()` calls
- **Block caching**: `block.container.cache()` rasterizes blocks that don't change
- **Lazy sample loading**: Instruments loaded only when first played
- **Debounced resize**: Block repositioning debounced on window resize

### 8.3 Recommended Improvements

1. **Virtual canvas**: Only render blocks visible in viewport
2. **Web Workers**: Move synth scheduling to audio worklet
3. **Block pooling**: Reuse Block/Container instances instead of creating new ones
4. **Batch SVG**: Generate block artwork in batches using off-screen canvas
5. **Replace eval()**: Use function maps instead of `eval()` for plugins

---

## SECTION 9: Manual Testing Checklist

### 9.1 Core Functionality

- [ ] **App loads**: Page loads without console errors; loading animation completes
- [ ] **Start block runs**: Click Play → default "Sol 4" plays
- [ ] **Stop button**: Stops all audio and turtle movement immediately
- [ ] **Step mode**: Click Step → blocks highlight one-at-a-time
- [ ] **Beginner/Advanced mode**: Toggle switches palette visibility correctly

### 9.2 Block Operations

- [ ] **Drag from palette**: Block appears on canvas; snaps to grid
- [ ] **Connect blocks**: Dock types enforce valid connections only
- [ ] **Disconnect blocks**: Pulling block apart cleanly separates connections
- [ ] **Delete block**: Drag to trash; block removed from blockList
- [ ] **Duplicate block stack**: Right-click → duplicate works
- [ ] **Collapse clamp**: Click collapse icon on clamp blocks

### 9.3 Audio & Music

- [ ] **Note playback**: Pitch + Note Value → correct frequency and duration
- [ ] **Multiple turtles**: Two start blocks → two simultaneous voices
- [ ] **Instrument change**: Set Timbre → different instrument plays
- [ ] **Drum playback**: Drum blocks trigger correct samples
- [ ] **Volume control**: Crescendo/decrescendo ramps correctly
- [ ] **Tempo change**: Set BPM → note durations adjust

### 9.4 Widgets

- [ ] **Phrase Maker**: Opens, notes clickable, generates blocks
- [ ] **Music Keyboard**: Keys play notes; can be resized
- [ ] **Rhythm Ruler**: Divisions create correct rhythm patterns
- [ ] **Tempo widget**: Slider changes BPM in real-time
- [ ] **Pitch Staircase**: Steps create ascending/descending patterns

### 9.5 Persistence

- [ ] **Auto-save**: Refresh page → project restored from localStorage
- [ ] **Save HTML**: Downloaded file opens correctly in browser
- [ ] **Save MIDI**: File plays in external MIDI player
- [ ] **Save Lilypond**: Output compiles in Lilypond
- [ ] **New Project**: Clears canvas; creates fresh start block
- [ ] **Load .tb file**: File chooser loads project correctly

### 9.6 Responsive & Cross-Browser

- [ ] **Window resize**: Blocks reposition; don't overflow canvas
- [ ] **Mobile layout**: Touch works; palettes collapse properly
- [ ] **Dark/Light theme**: Toggles correctly; persists across reload

---

## SECTION 10: Migration Plan to v4 (React/TypeScript)

### 10.1 Strategic Goals

1. **Type safety**: TypeScript eliminates runtime type errors rampant in v3
2. **Component architecture**: React replaces the God-object pattern
3. **Testability**: Decoupled modules enable comprehensive unit testing
4. **Performance**: Virtual DOM + canvas offloading vs. full CreateJS redraws
5. **Maintainability**: ESM modules replace RequireJS AMD

### 10.2 Proposed v4 Architecture

```
┌────────────────────────────────────────────────────────┐
│                    React Application                    │
├──────────┬──────────┬──────────────┬──────────────────┤
│ UI Layer │ Block    │ Execution    │ Audio Engine      │
│ (React   │ Editor   │ Engine       │ (TypeScript)      │
│ Comps)   │ (Canvas) │ (TypeScript) │                   │
├──────────┴──────────┴──────────────┴──────────────────┤
│              State Management (Zustand/Redux)          │
├───────────────────────────────────────────────────────┤
│              Service Layer (APIs, Storage)             │
└───────────────────────────────────────────────────────┘
```

### 10.3 Migration Phases

#### Phase 1: Foundation (Weeks 1-4)
- Set up Vite + React + TypeScript project
- Define TypeScript interfaces: `IBlock`, `ITurtle`, `ISinger`, `IProtoBlock`
- Implement state management (Zustand recommended for simplicity)
- Create design system / component library

#### Phase 2: Block System (Weeks 5-8)
- Port `ProtoBlock` → TypeScript `BlockDefinition` interface
- Port 24 block definition files → TypeScript classes with typed `flow()`/`arg()`
- Implement block canvas renderer (consider react-konva or custom Canvas)
- Port connection model with TypeScript generics for dock types
- Port `blockfactory.js` SVG → React SVG components or retained-mode canvas

#### Phase 3: Execution Engine (Weeks 9-12)
- Port `Logo` interpreter → `ExecutionEngine` class (TypeScript)
- Replace `eval()` plugin system with typed function registry
- Implement typed Queue system with generics
- Port turtle state management → typed per-turtle state
- Implement proper async execution (replace `setTimeout` chains with async/await)

#### Phase 4: Audio Engine (Weeks 13-16)
- Port `Singer` → TypeScript `MusicState` per turtle
- Port `synthutils.js` constants → typed enums and const objects
- Wrap Tone.js in typed service layer
- Implement note pipeline with proper types
- Port all 9 `turtleactions/*.js` → typed action handlers

#### Phase 5: Widgets & UI (Weeks 17-22)
- Port widgets as React components (start with Phrase Maker, Music Keyboard)
- Implement widget window manager in React
- Port toolbar + palette system to React components
- Port save/load with typed serialization (consider Zod schemas for validation)

#### Phase 6: Polish & Parity (Weeks 23-26)
- Port ABC/Lilypond/MIDI import/export
- Port Planet integration
- Performance optimization pass
- E2E test migration (Cypress → Playwright recommended)
- Accessibility audit

### 10.4 Key Migration Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Block rendering | **react-konva** or custom Canvas | React integration + performance |
| State management | **Zustand** | Simpler than Redux; supports slices |
| Module system | **ESM (Vite)** | Tree-shaking, HMR, modern tooling |
| Audio | **Tone.js (keep)** | Mature, well-typed, no need to replace |
| Testing | **Vitest + Playwright** | Fast unit tests + reliable e2e |
| Serialization | **Zod schemas** | Runtime validation of project JSON |
| i18n | **react-i18next** | Natural React integration |

### 10.5 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Block rendering parity | Build visual regression test suite early |
| Audio timing regression | Port note playback tests first; compare WAV output |
| Project format compatibility | v4 must load v3 JSON; use adapter pattern |
| Widget complexity | Port widgets incrementally; keep v3 widgets working in iframe fallback |
| Community disruption | Maintain v3 during transition; v4 opt-in beta |

### 10.6 Files to Port (Priority Order)

| Priority | v3 File | v4 Module | Complexity |
|----------|---------|-----------|------------|
| P0 | `logo.js` | `engine/ExecutionEngine.ts` | High |
| P0 | `block.js` + `blocks.js` | `blocks/BlockModel.ts` | High |
| P0 | `turtle-singer.js` | `audio/Singer.ts` | High |
| P1 | `protoblocks.js` | `blocks/BlockDefinitions.ts` | Medium |
| P1 | `blocks/*.js` (24 files) | `blocks/definitions/*.ts` | Medium |
| P1 | `utils/synthutils.js` | `audio/SynthUtils.ts` | Medium |
| P1 | `turtleactions/*.js` | `actions/*.ts` | Medium |
| P2 | `palette.js` | `ui/PalettePanel.tsx` | Medium |
| P2 | `activity.js` | Split into multiple React contexts | High |
| P2 | `SaveInterface.js` | `services/ExportService.ts` | Medium |
| P3 | `widgets/*.js` | `widgets/*.tsx` | High (per-widget) |
| P3 | `js-export/` | `transpiler/` | Medium |

---

## Appendix A: Global Variables & Singletons

| Variable | Source | Purpose |
|----------|--------|---------|
| `globalActivity` | activity.js | Global reference to Activity instance |
| `instruments` | synthutils.js | `{turtle: {name: ToneInstrument}}` |
| `instrumentsFilters` | synthutils.js | Per-turtle per-instrument filter chains |
| `instrumentsEffects` | synthutils.js | Per-turtle per-instrument effect settings |
| `VOICENAMES` | synthutils.js | Available instrument definitions |
| `DRUMNAMES` | synthutils.js | Available drum definitions |
| `SAMPLE_INFO` | synthutils.js | Sample file path mappings |
| `platformColor` | platformstyle.js | Theme colors object |
| `_THIS_IS_MUSIC_BLOCKS_` | loader.js | Feature flag (vs. Turtle Blocks) |

## Appendix B: Key Class Relationships

```
Activity ──owns──→ Blocks ──contains──→ Block[] 
    │                                      ↑
    │                              instantiated from
    │                                      │
    ├──owns──→ Palettes ──registers──→ ProtoBlock[]
    │
    ├──owns──→ Logo ──executes──→ Block.protoblock.flow()
    │              │
    │              └──uses──→ Singer (per Turtle)
    │                           │
    │                           └──controls──→ Synth (Tone.js)
    │
    ├──owns──→ Turtles ──contains──→ Turtle[]
    │                                   │
    │                                   ├──has──→ Singer (music state)
    │                                   └──has──→ Painter (graphics)
    │
    ├──owns──→ Toolbar
    └──owns──→ SaveInterface
```

---

*Document generated via full source-level reverse engineering of the Music Blocks v3 codebase.*
