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
    await page.goto('/llm-chat');

    // Check title and inputs exist
    await expect(page.locator('h1')).toHaveText('LLM Chat');

    // Modify settings to test local storage behavior
    await page.fill('#system-prompt', 'Custom system prompt');

    // Reload and check persistence
    await page.reload();
    await expect(page.locator('#system-prompt')).toHaveValue(
      'Custom system prompt',
    );
  });

  test('should allow fetching models from OpenRouter from settings', async ({ page }) => {
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

    await page.goto('/settings');
    await page.fill('#shared-api-key', 'test-key');

    // Click fetch
    await page.click('#shared-fetch-models-btn');
    await page.waitForFunction(() => {
      const status = document.getElementById('shared-status-text');
      return (
        status && status.textContent && status.textContent.includes('Fetched')
      );
    });

    // Wait for models to populate in the datalist

    // Wait for the dropdown and verify options appear when focused

    await page.fill('#shared-model-input', '');
    await page.focus('#shared-model-input');

    const dropdownList = page.locator('#shared-models-list');
    await expect(dropdownList.locator('li').first()).toHaveText(
      'Model A (model-a)',
    );
    await expect(dropdownList.locator('li').nth(1)).toHaveText(
      'Model B (model-b)',
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

    await page.goto('/settings');
    await page.fill('#shared-api-key', 'test-key');
    await page.fill('#shared-model-input', 'test-model');

    await page.goto('/llm-chat');

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
      '.message.user button:text-is("Delete")',
    );
    await userMsgDeleteBtn.click();

    // Verify it's gone
    await expect(history.locator('.message.user')).toHaveCount(0);
  });

  test('should support delete below functionality', async ({ page }) => {
    await page.route(
      'https://openrouter.ai/api/v1/chat/completions',
      async (route) => {
        const streamBody =
          'data: {"choices":[{"delta":{"content":"Response"}}]}\n\ndata: [DONE]\n\n';
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: streamBody,
        });
      },
    );

    await page.goto('/settings');
    await page.fill('#shared-api-key', 'test-key');
    await page.fill('#shared-model-input', 'test-model');

    await page.goto('/llm-chat');

    // Send first message
    await page.fill('#user-input', 'Message 1');
    await page.click('#send-btn');

    // Wait for the first response to finish rendering
    const history = page.locator('#history-container');
    await expect(
      history.locator('.message.assistant .content').first(),
    ).toHaveText('Response');

    // Send second message
    await page.fill('#user-input', 'Message 2');
    await page.click('#send-btn');

    // Wait for the second response to finish rendering
    await expect(
      history.locator('.message.assistant .content').nth(1),
    ).toHaveText('Response');

    // Currently we have 4 messages: User 1, Assistant 1, User 2, Assistant 2
    await expect(history.locator('.message')).toHaveCount(4);

    page.on('dialog', (dialog) => dialog.accept());

    // Click "Delete ↓" on Assistant 1
    const assistant1DeleteBelowBtn = history
      .locator('.message.assistant')
      .first()
      .locator('button:text-is("Delete ↓")');
    await assistant1DeleteBelowBtn.click();

    // After deleting Assistant 1 and everything below, only User 1 should remain
    await expect(history.locator('.message')).toHaveCount(1);
    await expect(history.locator('.message').first()).toHaveClass(/user/);
    await expect(history.locator('.message .content').first()).toHaveText(
      'Message 1',
    );
  });

  test('should trigger regeneration when sending empty text if history is not empty', async ({
    page,
  }) => {
    let callCount = 0;
    await page.route(
      'https://openrouter.ai/api/v1/chat/completions',
      async (route) => {
        callCount++;
        const streamBody = `data: {"choices":[{"delta":{"content":"Resp ${callCount}"}}]}\n\ndata: [DONE]\n\n`;
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: streamBody,
        });
      },
    );

    await page.goto('/settings');
    await page.fill('#shared-api-key', 'test-key');
    await page.fill('#shared-model-input', 'test-model');

    await page.goto('/llm-chat');

    // Try sending empty text with empty history - should do nothing
    await page.click('#send-btn');
    const history = page.locator('#history-container');
    await expect(history.locator('.message')).toHaveCount(0);
    expect(callCount).toBe(0);

    // Send normal message
    await page.fill('#user-input', 'Hello');
    await page.click('#send-btn');

    // Wait for response
    await expect(
      history.locator('.message.assistant .content').first(),
    ).toHaveText('Resp 1');
    await expect(history.locator('.message')).toHaveCount(2);

    // Ensure input is empty
    await page.fill('#user-input', '');

    // Click send again
    await page.click('#send-btn');

    // Wait for new response
    await expect(
      history.locator('.message.assistant .content').nth(1),
    ).toHaveText('Resp 2');

    // Should now have 3 messages: User, Assistant (Resp 1), Assistant (Resp 2)
    // No new user message should have been added
    await expect(history.locator('.message')).toHaveCount(3);
    await expect(history.locator('.message').nth(0)).toHaveClass(/user/);
    await expect(history.locator('.message').nth(1)).toHaveClass(/assistant/);
    await expect(history.locator('.message').nth(2)).toHaveClass(/assistant/);
  });
});
