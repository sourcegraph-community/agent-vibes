import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'http://localhost:3000/dashboard';

test.describe('Dashboard Basic Tests', () => {
  test('should load dashboard without errors', async ({ page }) => {
    // Go to dashboard
    await page.goto(DASHBOARD_URL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if main elements are present
    await expect(page.locator('h1')).toContainText('Agent Vibes Dashboard');

    // Check if overview section loads
    await expect(page.locator('#overview, [data-section="overview"]')).toBeVisible();

    // Take a basic screenshot
    await page.screenshot({
      path: 'tests/dashboard-basic.png',
      fullPage: true,
    });
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // Try clicking highlights section
    const highlightsLink = page.getByText('TL;DR Highlights');
    if (await highlightsLink.isVisible()) {
      await highlightsLink.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('#highlights, [data-section="highlights"]')).toBeVisible();
    }
  });
});
