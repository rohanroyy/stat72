# StudyDock — Design System
### Class schedule · PDF/notes file manager · built-in PDF, image & video viewer

---

## 0. Thesis

This is a **student's control room**, not a generic productivity app. Two jobs live side by side: *"what's next"* (schedule) and *"where's my file"* (manager). The signature idea that ties them together:

> **Color = time.** The five brand colors aren't decoration — they're mapped to a full day's arc, from `navy_electric` (early morning) through `dark_raspberry`, `hot_fuchsia`, `blaze_orange`, to `amber_gold` (evening). A class card's color tells you *when* it happens before you read a single word. The same five colors double as file-type tags in the manager, so the whole app reads as one continuous language instead of two features bolted together.

Background is nearly black throughout — the palette is loud, so the canvas has to stay quiet.

---

## 1. Color tokens

```
bg-base        #0A0A0C   /* app background, near-black, slight blue lean */
bg-surface     #131316   /* cards, sheets */
bg-surface-2   #1C1C20   /* raised cards, modals */
bg-elevated    #232328   /* topmost layer: viewers' toolbars, popovers */
border-hairline #2A2A30
text-primary   #F5F4F7
text-secondary #9C9CA6
text-tertiary  #64646E
```

Brand ramp (as supplied — used exactly, no new hues invented):

```
navy_electric   DEFAULT #390099   600 #5200E0   700 #7729FF   800 #A570FF
dark_raspberry  DEFAULT #9E0059   600 #E40081   700 #FF2CA4   800 #FF72C2
hot_fuchsia     DEFAULT #FF0054   600 #FF3377   700 #FF6699
blaze_orange    DEFAULT #FF5400   600 #FF7733   700 #FF9966
amber_gold      DEFAULT #FFBD00   600 #FFC933   700 #FFD666
```

### 1.1 Time-of-day mapping (the schedule's core logic)

| Time block | Color | Token |
|---|---|---|
| 06:00–09:59 | Deep violet | `navy_electric.700` on `navy_electric.200` fill |
| 10:00–12:59 | Magenta-raspberry | `dark_raspberry.700` on `dark_raspberry.200` fill |
| 13:00–15:59 | Hot pink | `hot_fuchsia.600` on `hot_fuchsia.200`* fill |
| 16:00–18:59 | Orange | `blaze_orange.600` on `blaze_orange.200`* fill |
| 19:00–22:00 | Gold | `amber_gold.600` on `amber_gold.200`* fill |

*`hot_fuchsia`, `blaze_orange`, `amber_gold` have no 100–300 defined in the spec — for low-fill card backgrounds at those hours, use the DEFAULT at 12–16% opacity over `bg-surface` instead of a numbered shade.

Class cards use the *700* tone for text/icon and a low-opacity wash of the same family for the fill — never a flat 500 fill with white text (too close to a generic "colorful chip" look). This keeps the near-black base dominant, with color arriving as a glow, not a block.

### 1.2 File-type tags (reuses the same five hues — one language, two contexts)

```
PDF      → dark_raspberry.700  (documents: readable, "ink" color)
Image    → amber_gold.600      (visual, brightest/warmest)
Video    → blaze_orange.600    (motion, energetic)
Note/txt → navy_electric.700   (writing, cool/quiet)
Folder   → text-secondary, no color (folders are structure, not content)
```

### 1.3 Usage rules
- Never place two DEFAULT-saturation brand colors edge-to-edge (e.g. fuchsia card directly beside orange card) — separate with `bg-base` gutters of at least 12px, or the time-gradient reads as noise instead of a scale.
- Exactly one accent color is "hot" per screen at a time (e.g. the current class, the file being viewed). Everything else recedes to its low-opacity wash.
- Destructive actions use `hot_fuchsia.600`, never `blaze_orange` (reserved for the 16:00–19:00 time slot and video tags — overloading it as an error color breaks the time-mapping logic).

---

## 2. Typography

Three roles, deliberately not the Inter-for-everything default:

| Role | Typeface | Why |
|---|---|---|
| Display / headings | **Space Grotesk** (600/700) | Geometric but slightly quirky — reads as "built by a student who codes," not corporate SaaS |
| Body / UI | **General Sans** (400/500) | Neutral, warm, high legibility at small sizes for dense file lists |
| Metadata / mono | **JetBrains Mono** (400/500) | File sizes, timestamps, page counts (`12.4 MB`, `Pg 4/28`, `09:00–10:30`) get a technical, "file-system" texture that separates data from prose at a glance |

### Type scale (base 16px)

```
Display-XL   40px / 44px   700   Space Grotesk   — "Hi ZJ" style greeting
Display-L    28px / 34px   700   Space Grotesk   — screen titles
H2           20px / 26px   600   Space Grotesk   — section headers ("Today", "Recent files")
Body-L       16px / 24px   500   General Sans    — class titles, file names
Body-M       14px / 20px   400   General Sans    — secondary text
Caption      12px / 16px   500   JetBrains Mono  — timestamps, file meta, tags
```

---

## 3. Shape, elevation & the stacked-card motif

Inspiration pull: the layered "peeking cards" from the task-app reference and the deck-of-cards campaign screens. This becomes the **home screen's signature gesture**: the next 3 classes/deadlines stack like a hand of cards, the current one on top, next ones peeking 12px behind — swipe or tap to advance. It's the one place we spend the "boldness budget"; everywhere else stays flat and calm.

```
radius-sm    10px   — tags, chips, mini buttons
radius-md    16px   — list rows, file cards
radius-lg    24px   — primary cards, sheets
radius-xl    32px   — hero/stacked class cards, bottom sheet top corners
```

Elevation is done with color-tinted glow, not drop shadow (shadows disappear on near-black):
```
elevation-1: border 1px border-hairline
elevation-2: border 1px border-hairline + 24px blur glow at 18% of the card's accent color
elevation-3 (active/dragging): 40px blur glow at 30% opacity, translateY(-4px)
```

---

## 4. Core screens (mobile-first, 390×844 baseline)

### 4.1 Home — "Today"

```
┌─────────────────────────────┐
│ Hi Rohan 👋        🔔  ⚙   │  Display-XL greeting, icons top-right
│ Wed, 13 Jul                 │
│                              │
│ ● Mon Tue [Wed] Thu Fri Sat  │  horizontal date strip, today pill-filled
│                              │
│  ╭───────────────────────╮   │
│  │ 09:00–10:30    Violet │   │  ← stacked class cards
│  │ Statistics II          │   │     (time-of-day color)
│  │ Room 4B · Prof. Karim   │   │
│  │ [peek: next card edge] │   │
│  ╰───────────────────────╯   │
│                              │
│ Due today                    │  H2
│ 📄 Sampling_HW3.pdf   2.4MB  │  file row, raspberry PDF tag
│ 📄 Lecture12_notes    —     │
│                              │
│ [ Home ] [ Files ] [ ➕ ] [ Cal ]│  bottom nav, center FAB
└─────────────────────────────┘
```

### 4.2 Weekly schedule

```
┌─────────────────────────────┐
│ ← August               [+]  │
│ S  M  T  W  T  F  S          │  week strip (from calendar ref, dark)
│ 7  8  9 [10] 11 12 13         │
│                              │
│ 08:00 ┆                      │
│ 09:00 ┆ ▐ Statistics II      │  vertical time-grid, blocks colored
│ 10:00 ┆ ▐▐ Web Dev Lab       │  by time-of-day, width = concurrent
│ 11:00 ┆                      │
│ 12:00 ┆ ░ lunch (muted)      │
│ 13:00 ┆ ▐ Design Studio      │
│  ...                          │
└─────────────────────────────┘
```
Empty slot = invitation, not blank: a faint dashed outline with "+ Add class" ghost text, `text-tertiary`.

### 4.3 File manager

```
┌─────────────────────────────┐
│ Files                  ⋯    │
│ [All] [PDFs] [Images] [Video]│  filter pills, active = brand wash
│                              │
│ 📁 Statistics II        24   │  folder row — neutral, count in mono
│ 📁 Web Dev Portfolio      9   │
│ ── Recent ──                 │
│ 📄 Sampling_HW3.pdf          │
│    2.4 MB · Pg 1/6 · 09:14   │  Caption row, mono, raspberry accent bar
│ 🖼 wireframe_v2.png           │  amber accent bar
│    1.1 MB · 09:02            │
│ 🎬 lecture_recording.mp4      │  orange accent bar
│    340 MB · 41:12            │
└─────────────────────────────┘
```
Each row gets a **2px left accent bar** in its file-type color instead of a big colored icon block — keeps the list scannable and quiet, color still does the categorizing work.

### 4.4 PDF viewer (full-screen, chrome recedes)

```
┌─────────────────────────────┐
│ ✕  Sampling_HW3.pdf   ⋮      │  bg-elevated toolbar, auto-hides on scroll
│                              │
│                              │
│         [ page canvas ]      │  bg-base, page itself off-white paper
│                              │  (deliberate exception: paper stays
│                              │   near-white for reading comfort)
│                              │
│  ◀  Page 4 / 28  ▶           │  mono caption, floating pill, raspberry
│  🔍  ✎ annotate  📤 share     │
└─────────────────────────────┘
```

### 4.5 Image / video viewer

```
┌─────────────────────────────┐
│ ✕                     ⋮     │  transparent-to-black gradient overlay
│                              │
│      [ media, edge-to-edge ] │  black letterbox, no card chrome
│                              │
│ ▶ 12:04 ────●───── 41:12     │  video: scrubber, gold/orange tint
│ 1/14 ◀ ●●●●○○○○○○○ ▶         │  image: dot pagination for multi-image sets
└─────────────────────────────┘
```

---

## 5. Components

- **Class card** — `radius-xl`, elevation-2 glow in its time-color, top-right corner shows a small colored dot + time range in mono, drag-right gesture to mark attended (mirrors the reference app's "drag to mark done," reinterpreted).
- **File row** — `radius-md`, left accent bar, filename in Body-L, meta line in Caption/mono, trailing overflow menu.
- **Date/week strip** — pill-style, today = filled `navy_electric.600`, others = `bg-surface-2` outline.
- **Progress ring** (weekly workload, storage used) — thin 4px stroke, gradient stroke sweeping across the full 5-color ramp to literally visualize "the whole day," inspired by the campaign-dashboard ring reference.
- **Bottom nav** — 4 items + center raised FAB (`+`) for "add class / upload file," `bg-surface-2` pill, active item gets brand-wash background, not just icon color change.
- **Empty states** — one-line, plain instruction in the interface's voice: *"No files yet. Add your first PDF to get started."* — never cute mascots given the utility nature of a file manager.

---

## 6. Motion

- Stacked home cards: spring-based swipe, 220ms, next card scales 0.96→1 and slides up 12px as current card exits.
- Viewer open: shared-element scale from thumbnail to full-screen, 200ms ease-out — no generic fade.
- Everything else: 120–150ms, opacity/translate only. No parallax, no auto-playing background motion — this is a study tool, motion should never compete with reading.
- Respect `prefers-reduced-motion`: swipe/spring becomes an instant cut with a 100ms crossfade.

---

## 7. Accessibility & quality floor

- Text on any brand-wash fill is always the *700* tone (or DEFAULT for the 3 colors without a 700) against `bg-surface`, verified ≥ 4.5:1.
- Color is never the only signal: file-type tags carry a 2-letter mono label (`PDF`, `IMG`, `MP4`) alongside the accent bar for colorblind users.
- All interactive elements ≥ 44×44px tap target; visible focus ring = 2px `amber_gold.DEFAULT` regardless of local accent (one consistent focus color app-wide, so it's never lost against a colored card).
- Responsive: this spec is mobile-first; scale up by widening the time-grid and switching the file manager to a 3-column grid ≥ 768px, stacked cards become a horizontal row ≥ 1024px.

---

## 8. What NOT to do

- Don't tint the whole background with a brand hue — `bg-base` stays near-black everywhere; color only ever appears on cards, bars, and text.
- Don't use more than one hot/saturated accent per viewport.
- Don't default `blaze_orange` to "error" — it's a time-slot and video-tag color; use `hot_fuchsia.600` for destructive/error states instead.
- Don't add numbered step markers or onboarding carousels unless the content is genuinely sequential — a file manager and schedule aren't a story to march through.
