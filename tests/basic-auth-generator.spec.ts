import { test, expect } from '@playwright/test';

test.describe('Basic Auth Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/basic-auth-generator');
  });

  test('should load the page correctly', async ({ page }) => {
    await expect(page).toHaveTitle('Basic Auth Generator');
    await expect(page.locator('h2')).toHaveText('Basic Auth Generator');
  });

  test('should output empty string when both fields are empty', async ({
    page,
  }) => {
    await expect(page.locator('.output-field').nth(0)).toBeEmpty();
  });

  test('should generate encoded credentials correctly', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="Enter username"]');
await usernameInput.fill('user@name');
    const passwordInput = page.locator('input[placeholder="Enter password"]');
await passwordInput.fill('pass:word');

    await expect(page.locator('.output-field').nth(0)).toHaveText(
      'user%40name:pass%3Aword',
    );
  });

  test('should generate full URL with basic auth', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="Enter username"]');
await usernameInput.fill('user@name');
    const passwordInput = page.locator('input[placeholder="Enter password"]');
await passwordInput.fill('pass:word');
    const urlInput = page.locator('input[placeholder="https://example.com/api"]');
await urlInput.fill('https://example.com/api');

    await expect(page.locator('.output-field').nth(1)).toHaveText(
      'https://user%40name:pass%3Aword@example.com/api',
    );
  });

  test('should handle missing URL gracefully', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="Enter username"]');
await usernameInput.fill('user');
    const passwordInput = page.locator('input[placeholder="Enter password"]');
await passwordInput.fill('pass');

    await expect(page.locator('.output-field').nth(0)).toHaveText('user:pass');
    await expect(page.locator('.output-field').nth(1)).toBeEmpty();
  });

  test('should show error for invalid URL', async ({ page }) => {
    const urlInput = page.locator('input[placeholder="https://example.com/api"]');
await urlInput.fill('not-a-url');

    await expect(page.locator('.error-text').nth(0)).toHaveText('Invalid URL format');
    await expect(page.locator('.output-field').nth(1)).toBeEmpty();
  });

  test('should generate full URL when only username is provided', async ({
    page,
  }) => {
    const usernameInput = page.locator('input[placeholder="Enter username"]');
await usernameInput.fill('user@name');
    const urlInput = page.locator('input[placeholder="https://example.com/api"]');
await urlInput.fill('https://example.com/api');

    await expect(page.locator('.output-field').nth(0)).toHaveText(
      'user%40name:',
    );
    await expect(page.locator('.output-field').nth(1)).toHaveText(
      'https://user%40name@example.com/api',
    );
  });

  test('should generate full URL when only password is provided', async ({
    page,
  }) => {
    const passwordInput = page.locator('input[placeholder="Enter password"]');
await passwordInput.fill('pass:word');
    const urlInput = page.locator('input[placeholder="https://example.com/api"]');
await urlInput.fill('https://example.com/api');

    await expect(page.locator('.output-field').nth(0)).toHaveText(
      ':pass%3Aword',
    );
    await expect(page.locator('.output-field').nth(1)).toHaveText(
      'https://:pass%3Aword@example.com/api',
    );
  });
});
