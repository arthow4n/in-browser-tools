import { test, expect } from '@playwright/test';

test('MP3 Splitter page has expected elements and default values', async ({
  page,
}) => {
  await page.goto('/mp3-splitter.html');

  await expect(page).toHaveTitle('MP3 Splitter');
  await expect(page.locator('h1')).toHaveText('MP3 Splitter');

  const fileInput = page.locator('#mp3-file');
  await expect(fileInput).toBeAttached();
  await expect(fileInput).toHaveAttribute('type', 'file');
  await expect(fileInput).toHaveAttribute(
    'accept',
    'audio/mpeg,audio/mp4,audio/x-m4a,.m4a',
  );

  const minutesInput = page.locator('#minutes');
  await expect(minutesInput).toBeAttached();
  await expect(minutesInput).toHaveValue('30');

  const splitBtn = page.locator('#split-btn');
  await expect(splitBtn).toBeAttached();
  await expect(splitBtn).toHaveText('Split MP3');
});
