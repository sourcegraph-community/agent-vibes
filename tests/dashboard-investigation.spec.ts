import { test, expect } from '@playwright/test';

test.describe('Dashboard V2 Investigation', () => {
  test('investigate RSS connection errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    const errors: string[] = [];
    const networkRequests: Array<{ url: string; status: number; response?: unknown }> = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
      errors.push(`Page Error: ${error.message}`);
    });

    // Monitor network requests
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/rss/entries')) {
        try {
          const body = await response.json();
          networkRequests.push({
            url,
            status: response.status(),
            response: body
          });
        } catch {
          networkRequests.push({
            url,
            status: response.status(),
            response: 'Failed to parse response'
          });
        }
      }
    });

    // Navigate to dashboard-v2
    console.log('Navigating to dashboard-v2...');
    await page.goto('http://localhost:3001/dashboard-v2#updates');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'dashboard-v2-initial.png', fullPage: true });

    // Wait a bit more for data to load
    await page.waitForTimeout(2000);

    // Check for error messages in the UI
    const errorElements = await page.locator('text=/error|failed/i').all();
    console.log(`\n=== Found ${errorElements.length} potential error elements ===`);
    for (const elem of errorElements) {
      const text = await elem.textContent();
      console.log(`Error text: ${text}`);
    }

    // Check specifically for RSS sections
    const rssSections = await page.locator('section[id^="updates"], section[id^="research"], section[id^="perspectives"]').all();
    console.log(`\n=== Found ${rssSections.length} RSS sections ===`);
    for (const section of rssSections) {
      const id = await section.getAttribute('id');
      const text = await section.textContent();
      console.log(`Section ${id}: ${text?.substring(0, 200)}...`);
    }

    // Log all console messages
    console.log('\n=== Console Messages ===');
    consoleMessages.forEach(msg => console.log(msg));

    // Log all errors
    console.log('\n=== Page Errors ===');
    errors.forEach(err => console.log(err));

    // Log network requests
    console.log('\n=== RSS API Network Requests ===');
    networkRequests.forEach(req => {
      console.log(`URL: ${req.url}`);
      console.log(`Status: ${req.status}`);
      console.log(`Response: ${JSON.stringify(req.response, null, 2)}`);
      console.log('---');
    });

    // Check if Miniflux is accessible
    console.log('\n=== Checking Miniflux Connection ===');
    const minifluxResponse = await page.request.get('http://localhost:8080/v1/me', {
      headers: {
        'X-Auth-Token': process.env.MINIFLUX_API_KEY || 'test-token'
      },
      failOnStatusCode: false
    });
    console.log(`Miniflux status: ${minifluxResponse.status()}`);
    try {
      const minifluxBody = await minifluxResponse.json();
      console.log(`Miniflux response: ${JSON.stringify(minifluxBody, null, 2)}`);
    } catch {
      console.log('Miniflux response: Failed to parse');
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      consoleMessages,
      errors,
      networkRequests,
      minifluxStatus: minifluxResponse.status()
    };

    console.log('\n=== Full Investigation Report ===');
    console.log(JSON.stringify(report, null, 2));
  });
});
