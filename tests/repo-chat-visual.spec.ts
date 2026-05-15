import { test, expect } from '@playwright/test';
import path from 'path';

test('Repo Chat Verification', async ({ page }) => {
  // Fill in OpenRouter Settings mock
  await page.goto('http://localhost:3000/settings');
  await page.fill('#shared-api-key', 'mock-api-key');

  await page.goto('http://localhost:3000/repo-chat');

  // Test clone
  await page.fill(
    '#repo-url',
    'https://github.com/arthow4n/in-browser-tools.git',
  );
  await page.click('#clone-btn');

  // Wait for cloning to finish and seed
  await expect(page.locator('#clone-status')).toHaveText(
    'Cloned and seeded successfully.',
    { timeout: 30000 },
  );

  // Ensure tool messages are NOT printed since they were removed
  await expect(page.locator('.message.tool')).toBeHidden();

  // Ensure the new assistant prompt appears
  await expect(
    page
      .locator('.message.assistant')
      .filter({ hasText: 'I have read the repository files into my context' }),
  ).toBeVisible();

  // Test basic streaming behavior without tools
  await page.route(
    'https://openrouter.ai/api/v1/chat/completions',
    async (route) => {
      const streamBody = `data: {"choices":[{"delta":{"content":"Okay, proceeding with the plan based on the file context."}}]}

data: [DONE]
`;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: streamBody,
      });
    },
  );

  await page.fill('#chat-input', 'Test intention');
  await page.click('#send-btn');

  // Verify UI continues and shows assistant response
  await expect(
    page.locator('.message.assistant').filter({
      hasText: 'Okay, proceeding with the plan based on the file context.',
    }),
  ).toBeVisible();
});
