# Brand and UX — continuous experience

MMAP is one product with two surfaces on a **single hostname**:

| Path          | Surface                         | Theme |
| ------------- | ------------------------------- | ----- |
| `/`           | Mission site (web)              | Light |
| `/app`        | About / install the field app   | Light |
| `/field/app/` | Field PWA (offline assessments) | Dark  |

Tokens and fonts live in `@mmap/brand` (`packages/brand`). Both apps import the same CSS; theme is selected with `data-theme` on `<html>`.

## Shared DNA

- **Ink** `#0b1f2a` — wordmark weight, field surfaces, web body text
- **Teal / cyan scale** — web accent `#0f6e8c`; field accent `#5ec4e6` (same coastal family, brighter for dark UI)
- **Focus** `#ffb703` — shared keyboard focus ring
- **Type** — Literata for brand titles; IBM Plex Sans for UI
- **Spacing / radius** — `--space-*` and `--radius-*` from tokens

## Context cues

Users should always know which surface they are on:

- **Web** — light aqua wash, full product name in the header, primary CTA to open `/field/app/`
- **Field** — dark navy shell, persistent **Field** chip in the top bar, optional link back to `/`

Do not blur the modes (e.g. dark marketing hero that looks like the PWA). The light↔dark flip is intentional product context, not two unrelated brands.

## Linking

- Mission site → PWA: relative **`/field/app/`** (same origin; works on CloudFront and Docker gateway)
- About/install copy stays at **`/app`**
- Field → docs: same-origin **`/docs/manatee-v1`** when unset

## PWA scope

The field service worker is scoped to `/field/app/` only. It must never control `/`, `/app`, or `/docs`.

## Field personas and responsive layout

Field biologists use two primary device classes in Belize-style workflows. Layout must work for **both** without horizontal scrolling or overlapping chrome.

| Persona              | Typical device                         | Viewport                                     | Shell           | Navigation                                        |
| -------------------- | -------------------------------------- | -------------------------------------------- | --------------- | ------------------------------------------------- |
| **Phone field tech** | Modern phone (e.g. Galaxy S24 Ultra)   | ≤639px portrait, or any orientation ≤767px   | Portrait shell  | Top bar (two-row compact utilities) + bottom tabs |
| **Tablet boat crew** | Rugged tablet, often landscape on deck | ≥768px landscape, or ≥1024px any orientation | Landscape shell | Header tabs + inline utilities                    |

### Layout rules

1. **Portrait shell** when `(orientation: portrait)` **or** `max-width: 767px` — keeps bottom navigation on phones held landscape and narrow portrait tablets.
2. **Landscape shell** when `(orientation: landscape)` and `min-width: 768px` — horizontal tabs for boat/tablet workflows.
3. **Compact top bar** when portrait shell and `max-width: 639px` — two-row grid: back + title on row 1; Field chip + icon utilities on row 2. Mission-site and connectivity labels collapse to icons; page titles ellipsize instead of overlapping.
4. **No horizontal document scroll** — protocol guide markdown, tables, and panels use `max-width: 100%` with table `overflow-x: auto` inside the content column.
5. **Touch targets** — minimum 48px (`--touch-min`); 56px in glove mode. Safe-area padding on the bottom nav.
6. **PWA orientation** — manifest `orientation: any` so tablets can use landscape without OS fighting the install prompt.

### Visual checks

Post-deploy Playwright journeys (staging) exercise phone portrait, tablet portrait, and tablet landscape viewports:

- Assessment list, new assessment, sync, and protocol guide load without horizontal overflow.
- Top-bar controls do not overlap.

See `e2e/field-ui/` and `scripts/field-ui-verify.ts`.
