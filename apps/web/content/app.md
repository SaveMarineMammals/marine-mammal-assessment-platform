---
title: Field App
description: Install and use the MMAP offline field PWA.
---

## Field PWA

The field app is a Progressive Web App optimized for tablets on boats and at dockside.

### Development URL

During local development the app runs at [http://localhost:5174](http://localhost:5174).

### Install on a tablet

1. Open the field app URL in **Chrome** or **Safari**.
2. Complete an initial sync test while online (optional but recommended).
3. **Install to home screen:**
   - **iPad/iOS:** Share → _Add to Home Screen_
   - **Android/Chrome:** Menu → _Install app_ or _Add to Home screen_
4. Enable location permissions when prompted for GPS capture.

### Offline use

- Create assessments and measurements without connectivity.
- The header shows **Offline** and a pending sync count.
- Tap **Sync Now** when Wi‑Fi or LTE returns, or wait for automatic sync.

### Backup

Use **Settings → Export Backup** before multi-day deployments. Import restores data after validating against the manatee v1 schema.
