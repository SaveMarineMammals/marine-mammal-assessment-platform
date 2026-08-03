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

## Field personas and device classes

The field PWA serves two complementary personas. Layout must remain usable for both; do not optimize only for tablets.

| Persona                        | Typical device                      | Primary jobs                                                                   |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------ |
| **Boat biologist (tablet)**    | 8–11″ tablet, portrait or landscape | Full assessments, multi-reading vitals, glove mode, dock-side sync             |
| **Shore / scout tech (phone)** | Large phone (~360–430px CSS width)  | Quick create, status check, open protocol help, sync when connectivity returns |

### Layout rules by viewport

| Class                  | CSS heuristic                         | Chrome behavior                                                                                        |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Phone portrait         | `orientation: portrait` and `≤480px`  | Compact top bar: icon-only Back and Online; hide Mission site link; title ellipsizes; bottom tabs stay |
| Tablet / wide portrait | `orientation: portrait` and `≥768px`  | Full labels (Back, Online, Mission site); more padding                                                 |
| Phone landscape        | `orientation: landscape` and `≤900px` | Landscape tab strip may scroll horizontally **inside** the nav; page body must not                     |
| Tablet landscape       | `orientation: landscape` and `>900px` | Full landscape header with brand, tabs, and utilities                                                  |

### Non-negotiables (all devices)

- Touch targets stay at least `--touch-min` (48px; 56px in glove mode).
- Top-bar controls must **not overlap**. Prefer progressive disclosure over shrinking type below readable sizes.
- Page content must **not force horizontal page scroll**. Wide protocol tables and Mermaid diagrams scroll inside a local `overflow-x: auto` wrapper (`.table-wrap` / `.mermaid-diagram`).
- Panel headers wrap or stack on narrow widths so title and protocol subtitle never collide.
- Offline-first: never gate primary capture flows on network availability.

## Context cues

Users should always know which surface they are on:

- **Web** — light aqua wash, full product name in the header, primary CTA to open `/field/app/`
- **Field** — dark navy shell, persistent **Field** chip in the top bar, optional link back to `/` (shown when width allows)

Do not blur the modes (e.g. dark marketing hero that looks like the PWA). The light↔dark flip is intentional product context, not two unrelated brands.

## Linking

- Mission site → PWA: relative **`/field/app/`** (same origin; works on CloudFront and Docker gateway)
- About/install copy stays at **`/app`**
- Field → docs: same-origin **`/docs/manatee-v1`** when unset

## PWA scope

The field service worker is scoped to `/field/app/` only. It must never control `/`, `/app`, or `/docs`.
