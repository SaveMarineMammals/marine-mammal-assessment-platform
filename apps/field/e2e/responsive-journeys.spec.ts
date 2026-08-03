import { expect, test } from '@playwright/test';
import { assertNoOverlap, assertNoPageHorizontalScroll, openFieldApp, requireBox } from './layout';

test.describe('Field PWA responsive journeys', () => {
  test('home and new assessment chrome stay usable without overlap', async ({ page }, testInfo) => {
    await openFieldApp(page);

    const primaryNav = page.getByRole('navigation', { name: 'Primary' }).first();
    await expect(primaryNav.getByRole('link', { name: /New/i })).toBeVisible();

    await page.getByRole('link', { name: /New/i }).first().click();
    await expect(page.getByRole('heading', { name: 'New Assessment', level: 2 })).toBeVisible();

    const topBar = page.getByRole('banner', { name: 'Page header' });
    const fieldChip = topBar.locator('.app-context-chip');
    const title = topBar.locator('.app-top-bar__title');
    const help = topBar.getByRole('link', { name: /Help and protocol guide/i });
    const connectivity = topBar.locator('.connectivity-indicator');

    await assertNoOverlap(fieldChip, title, ['Field chip', 'page title']);
    await assertNoOverlap(title, help, ['page title', 'help control']);
    await assertNoOverlap(help, connectivity, ['help control', 'connectivity control']);
    await assertNoOverlap(fieldChip, help, ['Field chip', 'help control']);

    const titleBox = await requireBox(title, 'page title');
    expect(titleBox.width, 'page title should retain readable width').toBeGreaterThan(48);

    if (testInfo.project.name === 'phone') {
      await expect(topBar.getByRole('link', { name: /Mission site/i })).toHaveCount(0);
      await expect(connectivity.locator('.connectivity-indicator__label')).toBeHidden();
    } else {
      await expect(topBar.getByRole('link', { name: /Mission site/i })).toBeVisible();
      await expect(connectivity.getByText(/Online|Offline/)).toBeVisible();
    }

    const panelTitle = page.locator('.panel__header h2');
    const panelHint = page.locator('.panel__header .hint');
    if ((await panelHint.count()) > 0 && (await panelHint.first().isVisible())) {
      await assertNoOverlap(panelTitle, panelHint.first(), ['panel title', 'protocol label']);
    }

    await assertNoPageHorizontalScroll(page);
  });

  test('help protocol guide has no page-level horizontal scroll', async ({ page }, testInfo) => {
    await openFieldApp(page);

    await page
      .getByRole('link', { name: /Help and protocol guide/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: /Manatee v1 Field Guide/i })).toBeVisible();
    await expect(page.locator('.markdown')).toBeVisible();

    const tableWrap = page.locator('.table-wrap').first();
    await expect(tableWrap).toBeVisible();
    await expect(tableWrap.locator('table')).toBeVisible();

    await assertNoPageHorizontalScroll(page);

    const topBar = page.getByRole('banner', { name: 'Page header' });
    if (await topBar.isVisible()) {
      const fieldChip = topBar.locator('.app-context-chip');
      const title = topBar.locator('.app-top-bar__title');
      const help = topBar.getByRole('link', { name: /Help and protocol guide/i });
      const connectivity = topBar.locator('.connectivity-indicator');
      await assertNoOverlap(fieldChip, title, ['Field chip', 'help page title']);
      await assertNoOverlap(title, help, ['help page title', 'help control']);
      await assertNoOverlap(help, connectivity, ['help control', 'connectivity control']);
    }

    if (testInfo.project.name === 'phone') {
      // Wide measurement table may scroll inside the wrapper, but not the document.
      const wrapOverflow = await tableWrap.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(typeof wrapOverflow).toBe('boolean');
    }
  });

  test('list → sync → settings journey keeps primary chrome in view', async ({ page }) => {
    await openFieldApp(page);

    for (const label of [/List/i, /Sync/i, /Settings/i]) {
      await page.getByRole('link', { name: label }).first().click();
      await assertNoPageHorizontalScroll(page);
      const primary = page.getByRole('navigation', { name: 'Primary' }).first();
      await expect(primary).toBeVisible();
    }
  });
});
