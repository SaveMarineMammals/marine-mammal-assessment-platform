import { expect, type Locator, type Page } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boxesOverlap(a: Box, b: Box, padding = 0): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

export async function requireBox(locator: Locator, label: string): Promise<Box> {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`${label} has no bounding box`);
  }
  return box;
}

export async function assertNoOverlap(
  first: Locator,
  second: Locator,
  labels: [string, string],
): Promise<void> {
  const a = await requireBox(first, labels[0]);
  const b = await requireBox(second, labels[1]);
  expect(
    boxesOverlap(a, b),
    `${labels[0]} overlaps ${labels[1]} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`,
  ).toBe(false);
}

/** Page-level horizontal overflow (ignore nested scroll regions). */
export async function assertNoPageHorizontalScroll(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0),
    };
  });

  expect(
    metrics.scrollWidth,
    `Page horizontal overflow: scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

export async function openFieldApp(page: Page): Promise<void> {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: 'Primary' }).first()).toBeVisible();
}
