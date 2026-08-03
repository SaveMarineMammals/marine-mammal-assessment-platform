import { expect, type Page } from '@playwright/test';

/** Allow 1px tolerance for sub-pixel rounding on mobile browsers. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function expectTopBarControlsSeparated(page: Page): Promise<void> {
  const topBar = page.locator('.app-top-bar');
  if ((await topBar.count()) === 0) {
    return;
  }

  const boxes = await topBar.evaluate((bar) => {
    const interactive = bar.querySelectorAll(
      'button, a.connectivity-indicator, a.help-link, a.app-mission-link',
    );
    return Array.from(interactive).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });
  });

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const verticalOverlap = a.top < b.bottom && b.top < a.bottom;
      const horizontalOverlap = a.left < b.right && b.left < a.right;
      if (verticalOverlap && horizontalOverlap) {
        const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const overlapArea = overlapWidth * overlapHeight;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        expect(overlapArea / minArea).toBeLessThan(0.15);
      }
    }
  }
}

export async function waitForFieldShell(page: Page): Promise<void> {
  await page.goto('.', { waitUntil: 'load' });
  await page.locator('.app-shell').waitFor({ state: 'visible' });
  const bottomNav = page.locator('.app-bottom-nav');
  if (await bottomNav.isVisible()) {
    return;
  }
  await page.locator('.app-landscape-nav').waitFor({ state: 'visible' });
}

export async function clickPrimaryNav(page: Page, hrefPart: string): Promise<void> {
  const bottomNav = page.locator('.app-bottom-nav');
  if (await bottomNav.isVisible()) {
    await bottomNav.locator(`a[href*="${hrefPart}"]`).click();
    return;
  }

  await page.locator(`.app-landscape-nav a[href*="${hrefPart}"]`).first().click();
}

export async function openProtocolGuide(page: Page): Promise<void> {
  const topHelp = page.locator('.app-top-bar .help-link');
  if (await topHelp.isVisible()) {
    await topHelp.click();
  } else {
    await page.locator('.app-landscape-nav .help-link').click();
  }
  await page.waitForURL(/\/help\/protocol/);
}
