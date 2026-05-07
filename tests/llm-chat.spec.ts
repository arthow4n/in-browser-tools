import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('LLM Chat Tool', () => {
  test('should load the page and initialize local storage properly', async ({
    page,
  }) => {
    // Navigate to tool
    await page.goto('/llm-chat.html');

    // Check title and inputs exist
    await expect(page.locator('h1')).toHaveText('LLM Chat');
    await expect(page.locator('#api-key')).toBeVisible();
    await expect(page.locator('#model-input')).toBeVisible();

    // Modify settings to test local storage behavior
    await page.fill('#api-key', 'test-api-key');
    await page.fill('#model-input', 'test-model');
    await page.fill('#system-prompt', 'Custom system prompt');

    // Reload and check persistence
    await page.reload();
    await expect(page.locator('#api-key')).toHaveValue('test-api-key');
    await expect(page.locator('#model-input')).toHaveValue('test-model');
    await expect(page.locator('#system-prompt')).toHaveValue(
      'Custom system prompt',
    );
  });

  test('should allow fetching models from OpenRouter', async ({ page }) => {
    // Intercept the API call to mock response
    await page.route('https://openrouter.ai/api/v1/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'model-a', name: 'Model A' },
            { id: 'model-b', name: 'Model B' },
          ],
        }),
      });
    });

    // Mock alert to prevent it from blocking the test
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/llm-chat.html');
    await page.fill('#api-key', 'test-key');

    // Click fetch
    await page.click('#fetch-models-btn');

    // Wait for models to populate in the datalist
    const datalist = page.locator('#models-list');
    await expect(datalist.locator('option').first()).toHaveAttribute(
      'value',
      'model-a',
    );
    await expect(datalist.locator('option').nth(1)).toHaveAttribute(
      'value',
      'model-b',
    );
  });

  test('should simulate streaming and edit history', async ({ page }) => {
    // Mock the streaming endpoint
    await page.route(
      'https://openrouter.ai/api/v1/chat/completions',
      async (route) => {
        // Simulate an SSE response manually
        const chunks = [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" world!"}}]}\n\n',
          'data: [DONE]\n\n',
        ];

        // Use a custom response mimicking stream
        const streamBody = chunks.join('');
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: streamBody,
        });
      },
    );

    await page.goto('/llm-chat.html');
    await page.fill('#api-key', 'test-key');
    await page.fill('#model-input', 'test-model');

    // Send a message
    await page.fill('#user-input', 'Hi there');
    await page.click('#send-btn');

    // Check history container
    const history = page.locator('#history-container');

    // User message should appear
    await expect(history.locator('.message.user .content')).toHaveText(
      'Hi there',
    );

    // Assistant message should stream in
    await expect(history.locator('.message.assistant .content')).toHaveText(
      'Hello world!',
    );

    // Test editing a message
    const userMsgEditBtn = history.locator(
      '.message.user button:has-text("Edit")',
    );
    await userMsgEditBtn.click();

    // The textarea should appear
    const editArea = history.locator('.message.user textarea');
    await expect(editArea).toBeVisible();
    await editArea.fill('Hi updated');

    // Click Save
    const userMsgSaveBtn = history.locator(
      '.message.user button:has-text("Save")',
    );
    await userMsgSaveBtn.click();

    // Verify updated content
    await expect(history.locator('.message.user .content')).toHaveText(
      'Hi updated',
    );

    // Test deleting a message
    page.on('dialog', (dialog) => dialog.accept()); // Accept the delete confirmation
    const userMsgDeleteBtn = history.locator(
      '.message.user button:has-text("Delete")',
    );
    await userMsgDeleteBtn.click();

    // Verify it's gone
    await expect(history.locator('.message.user')).toHaveCount(0);
  });
});
