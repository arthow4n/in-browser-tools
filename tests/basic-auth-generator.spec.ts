import { test, expect } from '@playwright/test';

test.describe('Basic Auth Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/basic-auth-generator.html');
  });

  test('should load the page correctly', async ({ page }) => {
    await expect(page).toHaveTitle('Basic Auth Generator');
    await expect(page.locator('h1')).toHaveText('Basic Auth Generator');
  });

  test('should output empty string when both fields are empty', async ({
    page,
  }) => {
    await expect(page.locator('#output-credentials')).toBeEmpty();
  });

  test('should generate encoded credentials correctly', async ({ page }) => {
    await page.fill('#input-username', 'user@name');
    await page.fill('#input-password', 'pass:word');

    await expect(page.locator('#output-credentials')).toHaveText(
      'user%40name:pass%3Aword',
    );
  });

  test('should generate full URL with basic auth', async ({ page }) => {
    await page.fill('#input-username', 'user@name');
    await page.fill('#input-password', 'pass:word');
    await page.fill('#input-url', 'https://example.com/api');

    await expect(page.locator('#output-full-url')).toHaveText(
      'https://user%40name:pass%3Aword@example.com/api',
    );
  });

  test('should handle missing URL gracefully', async ({ page }) => {
    await page.fill('#input-username', 'user');
    await page.fill('#input-password', 'pass');

    await expect(page.locator('#output-credentials')).toHaveText('user:pass');
    await expect(page.locator('#output-full-url')).toBeEmpty();
  });

  test('should show error for invalid URL', async ({ page }) => {
    await page.fill('#input-url', 'not-a-url');

    await expect(page.locator('#url-error')).toHaveText('Invalid URL format');
    await expect(page.locator('#output-full-url')).toBeEmpty();
  });

  test('should generate full URL when only username is provided', async ({
    page,
  }) => {
    await page.fill('#input-username', 'user@name');
    await page.fill('#input-url', 'https://example.com/api');

    await expect(page.locator('#output-credentials')).toHaveText(
      'user%40name:',
    );
    await expect(page.locator('#output-full-url')).toHaveText(
      'https://user%40name@example.com/api',
    );
  });

  test('should generate full URL when only password is provided', async ({
    page,
  }) => {
    await page.fill('#input-password', 'pass:word');
    await page.fill('#input-url', 'https://example.com/api');

    await expect(page.locator('#output-credentials')).toHaveText(
      ':pass%3Aword',
    );
    await expect(page.locator('#output-full-url')).toHaveText(
      'https://:pass%3Aword@example.com/api',
    );
  });
});
