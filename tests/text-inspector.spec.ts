import { test, expect } from '@playwright/test';

test('Text Inspector page works', async ({ page }) => {
  await page.goto('/text-inspector.html');

  // Check the title
  await expect(page.locator('h1')).toHaveText('Text Inspector');

  // Find the input textarea and the output div
  const input = page.locator('#input-text');
  const output = page.locator('#output-text');

  // Input some tricky characters to see if it renders them
  const testString = 'I1Ll O0\nTesting multi-line.';
  await input.fill(testString);

  // Assert the output div contains the exact string
  await expect(output).toHaveText(testString);
});
