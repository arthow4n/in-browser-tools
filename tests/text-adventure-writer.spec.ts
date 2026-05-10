import { test, expect } from '@playwright/test';

test.describe('Text Adventure Writer Tool', () => {
  test('should load the page and initialize local storage properly', async ({
    page,
  }) => {
    await page.goto('/text-adventure-writer.html');

    await expect(page.locator('h1')).toHaveText('Text Adventure Writer');
    await expect(page.locator('#shared-api-key')).toBeVisible();
    await expect(page.locator('#scenario-request')).toBeVisible();
    await expect(page.locator('#character-description')).toBeVisible();

    await page.fill('#shared-api-key', 'test-api-key');
    await page.fill('#scenario-request', 'A dark forest');
    await page.fill('#character-description', 'A brave knight');

    // Wait slightly to ensure initialization happened
    await page.waitForTimeout(100);

    // Trigger change events so the event listeners fire and save the state
    await page
      .locator('#shared-api-key')
      .evaluate((node) => node.dispatchEvent(new Event('change')));
    await page
      .locator('#scenario-request')
      .evaluate((node) => node.dispatchEvent(new Event('input')));
    await page
      .locator('#character-description')
      .evaluate((node) => node.dispatchEvent(new Event('input')));

    await page.reload();
    await page.waitForTimeout(100);

    await expect(page.locator('#shared-api-key')).toHaveValue('test-api-key');
    await expect(page.locator('#scenario-request')).toHaveValue('A dark forest');
    await expect(page.locator('#character-description')).toHaveValue(
      'A brave knight',
    );
  });

  test('should validate empty scenario request before starting', async ({
    page,
  }) => {
    await page.goto('/text-adventure-writer.html');
    await page.fill('#shared-api-key', 'test-key');
    await page.fill('#scenario-request', '');

    await page.click('#start-game-btn');

    await expect(page.locator('#chat-status')).toHaveText(
      'Please enter a scenario request first.',
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

    await page.goto('/text-adventure-writer.html');
    await page.fill('#shared-api-key', 'test-key');
    await page.fill('#shared-model-input', 'test-model');
    await page.fill('#scenario-request', 'A dark forest');
    await page.fill('#character-description', 'A brave knight');

    // Start game
    await page.click('#start-game-btn');

    // Check if we entered game view
    await expect(page.locator('#game-view')).toBeVisible();

    const history = page.locator('#history-container');

    // Check user initial message
    await expect(history.locator('.message.user')).toContainText(
      'Start the adventure based on the setup.',
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
