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
    await page.waitForTimeout(500); // Wait for auto-save

    // Create a new thread
    await page.click('#new-thread-btn');
    await expect(page.locator('#system-prompt')).toHaveValue(
      'You are a helpful assistant.',
    );

    // Switch back to the first thread
    const dropdown = page.locator('#thread-select');
    // First option should be dynamically named with a timestamp
    await dropdown.selectOption({ index: 0 });

    // Verify persistence across thread switch
    await expect(page.locator('#system-prompt')).toHaveValue(
      'Custom system prompt',
    );
  });

  test('should allow saving new prompt and updating existing saved prompt', async ({
    page,
  }) => {
    await page.goto('/llm-chat');

    // Make a change and save it as a new prompt
    await page.fill('#system-prompt', 'Prompt 1 content');
    page.once('dialog', (dialog) => {
      dialog.accept('My First Prompt');
    });
    await page.click('#save-prompt-btn');

    // Wait for the prompt to be selected in the dropdown
    await expect(page.locator('#saved-prompts-select')).toHaveValue(
      /^[0-9a-fA-F-]{36}$/,
    );

    // Check that "Save" button is now visible
    await expect(page.locator('#update-prompt-btn')).toBeVisible();

    // Now let's change the content and click "Save"
    await page.fill('#system-prompt', 'Updated prompt 1 content');
    await page.click('#update-prompt-btn');

    // Change the content to something else manually to test if it loads correctly
    await page.fill('#system-prompt', 'Something completely different');

    // Select the prompt from the dropdown again to reload
    const promptId = await page.locator('#saved-prompts-select').inputValue();
    await page.locator('#saved-prompts-select').selectOption(''); // Deselect
    await page.locator('#saved-prompts-select').selectOption(promptId); // Select again

    // Verify the updated content was loaded
    await expect(page.locator('#system-prompt')).toHaveValue(
      'Updated prompt 1 content',
    );
  });

  test('should allow fetching models from OpenRouter from settings', async ({
    page,
  }) => {
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
      '.message.user button[title="Edit"]',
    );
    await userMsgEditBtn.click();

    // The textarea should appear
    const editArea = history.locator('.message.user textarea');
    await expect(editArea).toBeVisible();
    await editArea.fill('Hi updated');

    // Click Save
    const userMsgSaveBtn = history.locator(
      '.message.user button[title="Save"]',
    );
    await userMsgSaveBtn.click();

    // Verify updated content
    await expect(history.locator('.message.user .content')).toHaveText(
      'Hi updated',
    );

    // Test deleting a message
    page.on('dialog', (dialog) => dialog.accept()); // Accept the delete confirmation
    const userMsgDeleteBtn = history.locator(
      '.message.user button[title="Delete"]',
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
    await expect(history.locator('.message')).toHaveCount(4, {
      timeout: 10000,
    });

    page.on('dialog', (dialog) => dialog.accept());

    // Click "Delete ↓" on Assistant 1
    const assistant1DeleteBelowBtn = history
      .locator('.message.assistant')
      .first()
      .locator('button[title="Delete Below"]');
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
    await expect(history.locator('.message')).toHaveCount(2, {
      timeout: 10000,
    });

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

  test('should allow adding messages directly to history without triggering generation', async ({
    page,
  }) => {
    let callCount = 0;
    await page.route(
      'https://openrouter.ai/api/v1/chat/completions',
      async (route) => {
        callCount++;
        const streamBody = `data: {"choices":[{"delta":{"content":"Should not trigger"}}]}\n\ndata: [DONE]\n\n`;
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

    const history = page.locator('#history-container');

    // Add assistant message directly to history
    await page.fill('#user-input', 'Prefilled assistant response');
    await page.selectOption('#insert-role-select', 'assistant');
    await page.click('#add-history-btn');

    // Add system message directly to history
    await page.fill('#user-input', 'Prefilled system response');
    await page.selectOption('#insert-role-select', 'system');
    await page.click('#add-history-btn');

    // Add user message directly to history
    await page.fill('#user-input', 'Prefilled user response');
    await page.selectOption('#insert-role-select', 'user');
    await page.click('#add-history-btn');

    // Check history count
    await expect(history.locator('.message')).toHaveCount(3);

    // Verify messages and types
    await expect(history.locator('.message').nth(0)).toHaveClass(/assistant/);
    await expect(history.locator('.message .content').nth(0)).toHaveText(
      'Prefilled assistant response',
    );

    await expect(history.locator('.message').nth(1)).toHaveClass(/system/);
    await expect(history.locator('.message .content').nth(1)).toHaveText(
      'Prefilled system response',
    );

    await expect(history.locator('.message').nth(2)).toHaveClass(/user/);
    await expect(history.locator('.message .content').nth(2)).toHaveText(
      'Prefilled user response',
    );

    // Verify no network call was made
    expect(callCount).toBe(0);

    // Ensure input is cleared
    await expect(page.locator('#user-input')).toHaveValue('');
  });
});
