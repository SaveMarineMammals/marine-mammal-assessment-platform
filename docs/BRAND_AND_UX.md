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
