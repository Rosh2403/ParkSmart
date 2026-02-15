# Frontend Design: Instrument Cluster

**Date:** 2026-02-15
**Branch:** `refactor/frontend-design`
**Status:** Approved — pending implementation

---

## Context

ParkSmart is a Singapore parking app (Next.js 14 + Capacitor, mobile-first). The existing design uses Tailwind's generic indigo/purple palette (#6366F1), DM Sans font, and uniform frosted cards — a textbook "SaaS dark mode dashboard" look with no distinct identity.

**Goal:** Replace with a cohesive "Instrument Cluster" aesthetic — warm charcoal backgrounds, amber gold accents, IBM Plex Mono for numerical data. Inspired by premium automotive dashboards. No purple. Nothing generic.

---

## Aesthetic Direction: Instrument Cluster

**Concept:** The app sits in a car. It should feel like a premium instrument cluster panel — warm amber glow on deep charcoal, precise monospaced data, purposeful and calm.

**Reference:** BMW iDrive, aviation instrument panels, Singapore MRT line displays (crisp data on dark backgrounds).

---

## Color System

Replace all CSS variables in `app/globals.css`:

```css
:root {
  /* Backgrounds — warm near-black */
  --bg-primary:    #0E1014;
  --bg-secondary:  #13161C;
  --bg-card:       rgba(255,255,255,0.025);
  --bg-elevated:   #1A1E26;

  /* Borders */
  --border:        rgba(255,255,255,0.055);
  --border-active: rgba(212,168,90,0.45);

  /* Text — warm whites */
  --text-primary:  #F0EDE8;
  --text-secondary:#A89F94;
  --text-muted:    #6B6460;
  --text-dim:      #4A4340;

  /* Amber — primary accent */
  --amber:         #D4A85A;
  --amber-light:   #F0C47A;
  --amber-dim:     rgba(212,168,90,0.12);

  /* Functional */
  --teal:          #00CCA8;    /* availability / prices / positive */
  --teal-dark:     #00A88A;
  --red:           #E05555;
  --orange:        #F07840;    /* warnings / expiring soon */

  /* Remove: --accent, --accent-light, --accent-purple, --green, --green-dark, --yellow, --pink */
}
```

**Migration map:**
| Old | New |
|---|---|
| `--accent` | `--amber` |
| `--accent-light` | `--amber-light` |
| `--accent-purple` | `--amber` |
| `--green` | `--teal` |
| `--green-dark` | `--teal-dark` |
| `--yellow` | `--orange` |
| `--border-active` (purple) | `--border-active` (amber) |

---

## Typography

Three-font stack replacing DM Sans + Space Mono:

| Role | Font | Weight | Used For |
|---|---|---|---|
| Display/Labels | `Rajdhani` | 600, 700, 800 | Titles, headings, nav labels, badge text |
| Data/Numbers | `IBM Plex Mono` | 400, 600 | All numbers: costs, distances, timers, lot counts |
| Body | `Outfit` | 400, 600 | Card names, descriptions, body copy |

**Import in `app/layout.js`:**
```js
import { Rajdhani, IBM_Plex_Mono, Outfit } from 'next/font/google';

const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['400','600','700'] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400','600'] });
const outfit = Outfit({ subsets: ['latin'], weight: ['400','600'] });
```

**CSS variables for fonts:**
```css
--font-display: 'Rajdhani', sans-serif;
--font-mono:    'IBM Plex Mono', monospace;
--font-body:    'Outfit', sans-serif;
```

**Body font:** `font-family: var(--font-body)` (replace current DM Sans)

---

## Component Treatments

### Header
- Logo box: `--bg-secondary` background, 2px `--amber` border, "P" in `Rajdhani 800 --amber`. No gradient.
- App name: `Rajdhani 800`, `--amber-light`, tracking `-0.01em`
- Subtitle: `Outfit 400`, `--text-muted`

### Bottom Navigation
- Icons: SVG thin-line icons in `components/icons/` (Search, Parking, Bookmark, BarChart)
- Active: icon + label color → `--amber`
- Inactive: `--text-dim`
- Active indicator: 2px amber top-border rail across the full tab width (top of nav bar)
- Remove: dot below label (current approach)
- Keep: green/teal pulsing dot on Parked tab (semantic — stays teal)
- Tab label font: `Rajdhani 700` all-caps

### Carpark Cards
- Background: `--bg-secondary` (slightly lighter than page bg)
- Left accent bar: 3px vertical bar, colored by result type:
  - BEST MATCH → `--amber`
  - CHEAPEST → `--teal`
  - NEAREST → `--orange`
  - Default → `rgba(255,255,255,0.08)`
- Border: `rgba(255,255,255,0.04)` — nearly invisible, the left bar does the work
- Selected state: left bar at full brightness + `--amber-dim` background tint + `box-shadow: 0 0 0 1px rgba(212,168,90,0.2)`
- Cost figure: `IBM Plex Mono 700`, `--teal`, 20px
- Distance/lots: `IBM Plex Mono 400`, `--text-muted`, 12px
- Carpark name: `Outfit 600`, `--text-primary`, 14-15px
- Agency badges: `Rajdhani 700`, updated colors (HDB=blue-teal, URA=amber, LTA=orange)

### Badges (BEST MATCH / CHEAPEST / NEAREST)
- Font: `Rajdhani 700` all-caps, 10px, letter-spacing 0.06em
- Shape: pill, 4px radius
- BEST MATCH: `--amber-dim` bg, `--amber-light` text, `--border-active` border
- CHEAPEST: `rgba(0,204,168,0.15)` bg, `--teal` text
- NEAREST: `rgba(240,120,64,0.15)` bg, `--orange` text
- Remove: gradient fills on badges

### Buttons
- **Primary (Submit / Park Here):** Solid `--amber` bg, `--bg-primary` text, `Rajdhani 700`, 14px, `border-radius: 10px`. No gradient.
- **Secondary (outline):** `rgba(212,168,90,0.12)` bg, `1px solid rgba(212,168,90,0.35)` border, `--amber-light` text
- **Navigate (go to car):** Solid `--teal` bg, `--bg-primary` text — semantic green preserved
- **Destructive (Done Parking / Clear):** Current red treatment — no change

### Timer Display (Parked tab)
- Font: `IBM Plex Mono 800`, 58px, `--amber-light`
- Expired: color → `--red`
- Add: horizontal progress bar below timer (fills left-to-right as time is used, amber → transitions to `--orange` at 25% remaining → `--red` at 10%)
- Bar CSS: `height: 3px`, `border-radius: 2px`, smooth CSS transition

### Search Panel
- Input field: `--bg-elevated` bg, `--border` border, focus → `--border-active` (amber)
- Duration slider: `accent-color: var(--amber)`
- Priority buttons: active state → `--amber-dim` bg + `--border-active` border (replaces purple)
- Labels: `Rajdhani 600` all-caps

### Stats Page
- Monthly total: `IBM Plex Mono 800`, 44px, `--teal`
- Bar chart bars: gradient from `--teal-dark` to `--teal`
- Section titles: `Rajdhani 700` all-caps
- Top carparks progress bar: teal fill

---

## SVG Icons for Bottom Navigation

Create `components/icons/` with four components:
- `SearchIcon.js` — thin magnifying glass
- `ParkingIcon.js` — P in a rounded square (thin stroke)
- `BookmarkIcon.js` — bookmark outline
- `ChartIcon.js` — three vertical bars

All icons: `width=22, height=22, stroke=currentColor, strokeWidth=1.5, fill=none`

---

## Motion

- **Card stagger:** `animation-delay: calc(var(--index, 0) * 60ms)` on each card (set via inline style)
- **Card entry keyframe:** `translateY(12px) opacity(0)` → `translateY(0) opacity(1)`, 300ms ease-out
- **Tab icon press:** `transform: scale(1.12)` on `:active`, 150ms
- **Button press:** `transform: scale(0.97)` on `:active`
- **Amber glow on selected card:** `box-shadow: 0 0 0 1px rgba(212,168,90,0.2), 0 4px 16px rgba(0,0,0,0.3)`
- **Skeleton shimmer:** update shimmer gradient to amber-warm tint

---

## Files Changed

| File | Change |
|---|---|
| `app/globals.css` | Full color token replacement, font stack, animation keyframes |
| `app/layout.js` | New font imports (Rajdhani, IBM Plex Mono, Outfit) |
| `components/Header.module.css` | Logo box, title treatment |
| `components/BottomNav.module.css` | SVG icons, amber active state, top rail indicator |
| `components/BottomNav.js` | Import SVG icon components |
| `components/ResultsList.module.css` | Card left accent bar, badge redesign, teal costs |
| `components/SearchPanel.module.css` | Amber focus states, priority btn active |
| `components/RecommendationBanner.module.css` | Updated color tokens |
| `app/page.module.css` | Token updates |
| `app/parked/parked.module.css` | Timer amber, progress bar, token updates |
| `app/favourites/favourites.module.css` | Token updates |
| `app/stats/stats.module.css` | Teal chart bars, token updates |
| `components/icons/` (new) | SearchIcon, ParkingIcon, BookmarkIcon, ChartIcon |

**Zero changes to:** any `.js` logic files (parking.js, storage, API routes), layouts, spacing, component structure.

---

## References

- Frontend design skill: `references/frontend-design-SKILL.md`
- Fonts: [Rajdhani](https://fonts.google.com/specimen/Rajdhani), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono), [Outfit](https://fonts.google.com/specimen/Outfit)
