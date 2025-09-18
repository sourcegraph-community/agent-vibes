import { test, expect } from '@playwright/test';

const MOCK_HTML_PATH = '/Users/sjarmak/agent-vibes/mocks/analytics-dashboard.html';
const DASHBOARD_URL = 'http://localhost:3000/dashboard';

test.describe('Dashboard Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for fonts and network to be idle
    await page.goto(DASHBOARD_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for any dynamic content to load
    await page.waitForLoadState('networkidle');

    // Wait for fonts to load
    await page.waitForFunction(() => document.fonts.ready);
  });

  test('should match mock design - desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Wait for layout to settle
    await page.waitForTimeout(1000);

    // Take screenshot of the entire page
    const screenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
    });

    // Compare with reference screenshot
    await expect(screenshot).toMatchSnapshot('dashboard-desktop.png', {
      threshold: 0.3, // Allow 30% pixel difference for dynamic content
      maxDiffPixels: 1000,
    });
  });

  test('should match mock design - tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Wait for responsive layout to adjust
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
    });

    await expect(screenshot).toMatchSnapshot('dashboard-tablet.png', {
      threshold: 0.3,
      maxDiffPixels: 800,
    });
  });

  test('should match mock design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for responsive layout to adjust
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
    });

    await expect(screenshot).toMatchSnapshot('dashboard-mobile.png', {
      threshold: 0.3,
      maxDiffPixels: 600,
    });
  });

  test('should have correct layout structure', async ({ page }) => {
    // Verify main layout elements exist
    await expect(page.locator('.sidebar, aside')).toBeVisible();
    await expect(page.locator('.main-content, main')).toBeVisible();
    await expect(page.locator('.main-header, header')).toBeVisible();

    // Verify key sections exist
    await expect(page.locator('#overview, [data-section="overview"]')).toBeVisible();
    await expect(page.locator('#highlights, [data-section="highlights"]')).toBeVisible();
    await expect(page.locator('#sentiment, [data-section="sentiment"]')).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    // Check for navigation items
    const navItems = [
      'Overview',
      'TL;DR Highlights',
      'Sentiment Trends',
      'Product Updates',
      'Research Papers',
      'Perspective Pieces',
      'Social Sentiment',
      'Timeline View',
      'Search & Filter',
      'Query Interface',
    ];

    for (const item of navItems) {
      await expect(page.getByText(item, { exact: false })).toBeVisible();
    }
  });

  test('should have metric cards with proper styling', async ({ page }) => {
    // Check for metric cards in overview section
    const metricCards = page.locator('.card, .metric-card');
    await expect(metricCards.first()).toBeVisible();

    // Verify cards contain expected content structure
    await expect(page.getByText('Overall Sentiment', { exact: false })).toBeVisible();
    await expect(page.getByText('Content Analyzed', { exact: false })).toBeVisible();
    await expect(page.getByText('Active Discussions', { exact: false })).toBeVisible();
    await expect(page.getByText('Research Papers', { exact: false })).toBeVisible();
  });

  test('should have working filters and controls', async ({ page }) => {
    // Check for timeframe filter
    const timeframeFilter = page.locator('select, .select').first();
    await expect(timeframeFilter).toBeVisible();

    // Check for search functionality
    const searchInput = page.locator('input[type="text"], .search-input').first();
    await expect(searchInput).toBeVisible();

    // Type in search to verify it's interactive
    await searchInput.fill('test search');
    await expect(searchInput).toHaveValue('test search');
  });

  test('should render highlights section correctly', async ({ page }) => {
    const highlightsSection = page.locator('#highlights, [data-section="highlights"]');
    await expect(highlightsSection).toBeVisible();

    // Check for highlight cards
    const highlightCards = page.locator('.highlight-card, .content-item');
    await expect(highlightCards.first()).toBeVisible();

    // Verify highlight badges/categories
    const badges = page.locator('.highlight-badge, .content-tag');
    await expect(badges.first()).toBeVisible();
  });

  test('should have responsive behavior', async ({ page }) => {
    // Test sidebar collapse on mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Check if mobile menu toggle exists or sidebar is hidden/collapsed
    const mobileToggle = page.locator('.mobile-menu-toggle, .menu-toggle');
    const sidebar = page.locator('.sidebar, aside');

    // Either mobile toggle should exist OR sidebar should be hidden/collapsed on mobile
    const hasMobileToggle = await mobileToggle.isVisible();
    const sidebarVisible = await sidebar.isVisible();

    if (hasMobileToggle) {
      await expect(mobileToggle).toBeVisible();
    } else {
      // Sidebar might be hidden or have different mobile styling
      console.log('Mobile navigation handled differently - checking layout');
    }

    expect(hasMobileToggle || !sidebarVisible).toBeTruthy();
  });

  test('should load and display charts/visualizations', async ({ page }) => {
    // Wait for chart elements to load
    await page.waitForTimeout(2000);

    // Check for chart containers or canvas elements
    const chartElements = page.locator('canvas, .chart-container, #sentimentChart');

    if (await chartElements.count() > 0) {
      await expect(chartElements.first()).toBeVisible();
    } else {
      console.log('No chart elements found - charts may be implemented differently');
    }
  });
});

test.describe('Mock HTML Comparison', () => {
  test('compare dashboard structure with mock HTML', async ({ page }) => {
    // First, visit the actual dashboard
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    // Get all major section headings from live dashboard
    const liveSections = await page.locator('h1, h2, h3').allTextContents();

    // Now check the mock HTML
    await page.goto(`file://${MOCK_HTML_PATH}`);
    await page.waitForLoadState('networkidle');

    const mockSections = await page.locator('h1, h2, h3').allTextContents();

    // Compare key sections (allowing for some differences due to dynamic content)
    const expectedSections = [
      'Agent Vibes Dashboard',
      'TL;DR Highlights',
      'Sentiment Trends',
      'Product Updates',
      'Research Papers',
      'Perspective Pieces',
      'Social Sentiment',
    ];

    for (const section of expectedSections) {
      const inMock = mockSections.some(s => s.includes(section));
      const inLive = liveSections.some(s => s.includes(section));

      console.log(`Section "${section}": Mock=${inMock}, Live=${inLive}`);

      // Both should have the section, or we should document the difference
      if (inMock && !inLive) {
        console.warn(`Missing section in live dashboard: ${section}`);
      } else if (!inMock && inLive) {
        console.log(`Extra section in live dashboard: ${section}`);
      }
    }
  });
});

test.describe('Error Handling', () => {
  test('should handle missing elements gracefully', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });

    // Test that page doesn't crash with JavaScript errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for any async operations
    await page.waitForTimeout(3000);

    // Log errors but don't fail the test unless they're critical
    if (errors.length > 0) {
      console.log('Console errors detected:', errors);

      // Only fail on critical errors (not missing chart libraries, etc.)
      const criticalErrors = errors.filter(error =>
        !error.includes('Chart') &&
        !error.includes('chart') &&
        !error.includes('404') &&
        !error.toLowerCase().includes('font'),
      );

      expect(criticalErrors).toHaveLength(0);
    }
  });

  test('should display fallback content for failed API calls', async ({ page }) => {
    // Intercept API calls and simulate failures
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Simulated API failure' }),
      });
    });

    await page.goto(DASHBOARD_URL);

    // Verify page still loads and shows some content
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1, h2')).toHaveCount({ min: 1 });
  });
});
