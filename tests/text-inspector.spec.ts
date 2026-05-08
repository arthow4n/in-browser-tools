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

  // Assert the output div contains the character blocks
  const charBoxes = output.locator('.char-box');
  await expect(charBoxes).toHaveCount(27); // length of 'I1Ll O0\nTesting multi-line.'

  // Check the first character 'I'
  await expect(charBoxes.nth(0).locator('.char-val')).toHaveText('I');
  await expect(charBoxes.nth(0).locator('.char-code')).toHaveText('U+0049');

  // Check the '1'
  await expect(charBoxes.nth(1).locator('.char-val')).toHaveText('1');
  await expect(charBoxes.nth(1).locator('.char-code')).toHaveText('U+0031');

  // Check the 'L'
  await expect(charBoxes.nth(2).locator('.char-val')).toHaveText('L');
  await expect(charBoxes.nth(2).locator('.char-code')).toHaveText('U+004C');

  // Check the 'l'
  await expect(charBoxes.nth(3).locator('.char-val')).toHaveText('l');
  await expect(charBoxes.nth(3).locator('.char-code')).toHaveText('U+006C');

  // Check the space
  await expect(charBoxes.nth(4).locator('.char-val')).toHaveText('·');
  await expect(charBoxes.nth(4).locator('.char-code')).toHaveText('U+0020');
  await expect(charBoxes.nth(4)).toHaveClass(/whitespace/);

  // Check the 'O'
  await expect(charBoxes.nth(5).locator('.char-val')).toHaveText('O');
  await expect(charBoxes.nth(5).locator('.char-code')).toHaveText('U+004F');

  // Check the '0'
  await expect(charBoxes.nth(6).locator('.char-val')).toHaveText('0');
  await expect(charBoxes.nth(6).locator('.char-code')).toHaveText('U+0030');

  // Check the newline
  await expect(charBoxes.nth(7).locator('.char-val')).toHaveText('↵');
  await expect(charBoxes.nth(7).locator('.char-code')).toHaveText('U+000A');
  await expect(charBoxes.nth(7)).toHaveClass(/whitespace/);
});
