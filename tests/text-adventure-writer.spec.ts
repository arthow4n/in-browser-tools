import { test, expect } from '@playwright/test';

test.describe('Text Adventure Writer Tool', () => {
  test('should load the page and initialize local storage properly', async ({
    page,
  }) => {
    await page.goto('/text-adventure-writer.html');

    await expect(page.locator('h1')).toHaveText('Text Adventure Writer');

    // Go to settings to set API key since it's shared now
    await page.goto('/settings.html');
    await page.fill('#shared-api-key', 'test-api-key');
    await page.fill('#shared-model-input', 'test-model');
    // Save is automatic via input event listener, but we might need to trigger change or wait
    await page.locator('#shared-api-key').evaluate(node => node.dispatchEvent(new Event('input')));

    // Go back to text adventure writer
    await page.goto('/text-adventure-writer.html');

    await expect(page.locator('#character-name')).toBeVisible();
    await page.fill('#character-name', 'Arthur Dent');
    await page.fill('#character-description', 'A bewildered Englishman.');

    // Wait slightly to ensure initialization happened
    await page.waitForTimeout(100);

    // Trigger change events so the event listeners fire and save the state
    await page
      .locator('#character-name')
      .evaluate((node) => node.dispatchEvent(new Event('input')));
    await page
      .locator('#character-description')
      .evaluate((node) => node.dispatchEvent(new Event('input')));

    await page.reload();
    await page.waitForTimeout(100);

    await expect(page.locator('#character-name')).toHaveValue('Arthur Dent');
    await expect(page.locator('#character-description')).toHaveValue(
      'A bewildered Englishman.',
    );
  });

  test('should validate empty character name before sending', async ({
    page,
  }) => {
    await page.goto('/text-adventure-writer');
    await page.fill('#character-name', '');

    await page.fill('#user-input', 'Hello!');
    await page.click('#send-btn');

    await expect(page.locator('#chat-status')).toHaveText(
      'Please enter your character name.',
    );
  });

  test('should simulate streaming tool calls and display correctly', async ({
    page,
  }) => {
    // Mock the streaming endpoint with tool calls
    await page.route(
      'https://openrouter.ai/api/v1/chat/completions',
      async (route) => {
        // We simulate a stream that calls the "speak" tool
        const toolCallId = 'call_123';
        const toolCallJson = JSON.stringify({
          character: 'Narrator',
          message: 'The journey begins.',
        });

        const chunks = [
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"${toolCallId}","type":"function","function":{"name":"speak","arguments":""}}]}}]}\n\n`,
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"character\\": \\"Narrator\\", "}}]}}]}\n\n`,
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"message\\": \\"The journey begins.\\"}"}}]}}]}\n\n`,
          'data: [DONE]\n\n',
        ];

        const streamBody = chunks.join('');
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: streamBody,
        });
      },
    );

    await page.goto('/settings.html');
    await page.fill('#shared-api-key', 'test-key');
    await page.fill('#shared-model-input', 'test-model');
    await page.locator('#shared-api-key').evaluate(node => node.dispatchEvent(new Event('input')));

    await page.goto('/text-adventure-writer.html');
    await page.fill('#character-name', 'Arthur Dent');

    // Send a message
    await page.fill('#user-input', 'I wake up.');
    await page.fill('#story-direction', 'Make it sudden.');
    await page.click('#send-btn');

    const history = page.locator('#history-container');

    // Check user messages (System message separate now)
    await expect(history.locator('.message.user')).toContainText(
      '[Arthur Dent]: I wake up.',
    );

    // Wait for the tool call response to render
    // Since it checks narrator, it should have the narrator class
    const assistantMsg = history.locator('.message.narrator');
    await expect(assistantMsg).toBeVisible();
    await expect(assistantMsg.locator('.character-name')).toHaveText(
      'Narrator',
    );
    await expect(assistantMsg).toContainText('The journey begins.');
  });
});
