import { test, expect } from '@playwright/test';

test('PDF Splitter page has expected elements and default values', async ({
  page,
}) => {
  await page.goto('/pdf-splitter.html');

  await expect(page).toHaveTitle('PDF Splitter');
  await expect(page.locator('h1')).toHaveText('PDF Splitter');

  const fileInput = page.locator('#pdf-file');
  await expect(fileInput).toBeAttached();
  await expect(fileInput).toHaveAttribute('type', 'file');
  await expect(fileInput).toHaveAttribute('accept', 'application/pdf');

  const pagesInput = page.locator('#pages');
  await expect(pagesInput).toBeAttached();
  await expect(pagesInput).toHaveValue('1');

  const splitBtn = page.locator('#split-btn');
  await expect(splitBtn).toBeAttached();
  await expect(splitBtn).toHaveText('Split PDF');
});
