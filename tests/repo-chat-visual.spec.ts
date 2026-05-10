import { test, expect } from '@playwright/test';
import path from 'path';

test('Repo Chat Verification', async ({ page }) => {
  await page.goto('http://localhost:3000/repo-chat');

  // Fill in OpenRouter Settings mock
  await page.fill('#shared-api-key', 'mock-api-key');

  // Test clone
  await page.fill('#repo-url', 'https://github.com/arthow4n/in-browser-tools.git');
  await page.click('#clone-btn');

  // Wait for cloning to finish and seed
  await expect(page.locator('#clone-status')).toHaveText('Cloned and seeded successfully.', { timeout: 30000 });

  // Ensure tool calls were printed
  await expect(page.locator('.message.tool')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.message.assistant').filter({ hasText: 'What changes do you want to make' })).toBeVisible();

  // Test chat asking a question
  let callCount = 0;
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    callCount++;
    if (callCount === 1) {
      const streamBody = `data: {"choices":[{"delta":{"content":null,"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"ask_question","arguments":"{\\"question\\":\\"Are you sure?\\",\\"suggested_answers\\":[\\"Yes\\",\\"No\\"]}"}}]}}]}

data: [DONE]
`;
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: streamBody });
    } else {
      const streamBody = `data: {"choices":[{"delta":{"content":"Okay, proceeding with the plan."}}]}

data: [DONE]
`;
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: streamBody });
    }
  });

  await page.fill('#chat-input', 'Test intention');
  await page.click('#send-btn');

  // Wait for UI to show question
  await expect(page.locator('#ask-question-container')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#question-text')).toHaveText('Are you sure?');

  // Answer
  await page.locator('#ask-question-container button', { hasText: 'Yes' }).click();

  // Verify UI continues
  await expect(page.locator('#ask-question-container')).toBeHidden({ timeout: 10000 });
  await expect(page.locator('.message.assistant').filter({ hasText: 'Okay, proceeding with the plan.' })).toBeVisible();
});
