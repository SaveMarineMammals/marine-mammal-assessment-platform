import { expect, test } from '@playwright/test';
import {
  clickPrimaryNav,
  expectNoHorizontalOverflow,
  expectTopBarControlsSeparated,
  openProtocolGuide,
  waitForFieldShell,
} from './helpers.js';

test.describe('field PWA responsive journeys', () => {
  test('assessment list loads without horizontal overflow', async ({ page }) => {
    await waitForFieldShell(page);
    await expectNoHorizontalOverflow(page);
    await expectTopBarControlsSeparated(page);
  });

  test('new assessment form fits the viewport', async ({ page }) => {
    await waitForFieldShell(page);
    await clickPrimaryNav(page, 'assessments/new');
    await page.waitForURL(/\/assessments\/new/);
    await expectNoHorizontalOverflow(page);
    await expectTopBarControlsSeparated(page);
    await expect(page.getByText('Name / ID')).toBeVisible();
  });

  test('protocol guide scrolls vertically only', async ({ page }) => {
    await waitForFieldShell(page);
    await openProtocolGuide(page);
    await expectNoHorizontalOverflow(page);
    await expectTopBarControlsSeparated(page);
    await expect(page.locator('.protocol-guide .markdown')).toBeVisible();
    const tableOverflow = await page
      .locator('.protocol-guide .markdown')
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(tableOverflow).toBeLessThanOrEqual(1);
  });

  test('sync page is reachable from primary navigation', async ({ page }) => {
    await waitForFieldShell(page);
    await clickPrimaryNav(page, 'sync');
    await page.waitForURL(/\/sync/);
    await expectNoHorizontalOverflow(page);
    await expectTopBarControlsSeparated(page);
  });
});
