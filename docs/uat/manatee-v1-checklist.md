# Manatee v1 Field UAT Checklist

Use this checklist during field user acceptance testing with CMARI workflow advisors. Mark each scenario **Pass**, **Fail**, or **N/A**, and log issues via Settings → Field feedback (export JSON) or GitHub issue templates.

## Environment

| Item                                       | Pass | Fail | Notes |
| ------------------------------------------ | ---- | ---- | ----- |
| Field app loads on target tablet/phone     |      |      |       |
| PWA installs and launches from home screen |      |      |       |
| Help & Protocol link opens field guide     |      |      |       |

## Responsive layout (phone + tablet)

| Scenario                                                            | Pass | Fail | Notes |
| ------------------------------------------------------------------- | ---- | ---- | ----- |
| Phone portrait: top bar controls do not overlap                     |      |      |       |
| Phone portrait: New Assessment header title/subtitle do not collide |      |      |       |
| Phone: Help & Protocol page has no page-level horizontal scroll     |      |      |       |
| Tablet portrait: Mission site + Online labels remain readable       |      |      |       |
| Tablet landscape: primary tabs usable without clipping key actions  |      |      |       |

## Offline capture

| Scenario                                     | Pass | Fail | Notes |
| -------------------------------------------- | ---- | ---- | ----- |
| Create assessment while offline              |      |      |       |
| Add multiple vital readings (length, HR, BP) |      |      |       |
| Complete assessment offline                  |      |      |       |
| Data persists after app restart              |      |      |       |

## GPS fallback

| Scenario                              | Pass | Fail | Notes |
| ------------------------------------- | ---- | ---- | ----- |
| Capture GPS succeeds outdoors         |      |      |       |
| GPS failure shows clear message       |      |      |       |
| Manual lat/long entry saves correctly |      |      |       |

## Validation UX

| Scenario                                        | Pass | Fail | Notes |
| ----------------------------------------------- | ---- | ---- | ----- |
| Required fields block save with summary banner  |      |      |       |
| Out-of-range vitals show soft warning + confirm |      |      |       |
| Invalid data shows inline field errors          |      |      |       |

## Sync & backup

| Scenario                                 | Pass | Fail | Notes |
| ---------------------------------------- | ---- | ---- | ----- |
| Pending sync count updates after capture |      |      |       |
| Sync Now uploads when online             |      |      |       |
| Export backup JSON downloads             |      |      |       |
| Import backup restores validated records |      |      |       |

## Accessibility & field usability

| Scenario                                            | Pass | Fail | Notes |
| --------------------------------------------------- | ---- | ---- | ----- |
| Complete flow usable with keyboard only             |      |      |       |
| Screen reader announces validation errors           |      |      |       |
| Glove mode increases touch target size              |      |      |       |
| Text readable in direct sunlight (outdoor contrast) |      |      |       |

## Extensibility (developer check)

| Scenario                                            | Pass | Fail | Notes |
| --------------------------------------------------- | ---- | ---- | ----- |
| Switch to dolphin_v1 stub in Settings               |      |      |       |
| Dolphin form renders different fields               |      |      |       |
| Dolphin assessment stays local-only (no sync queue) |      |      |       |

## Sign-off

| Role          | Name | Date | Result |
| ------------- | ---- | ---- | ------ |
| Field advisor |      |      |        |
| Engineering   |      |      |        |

**P0 issues must be closed before M5 launch.**
