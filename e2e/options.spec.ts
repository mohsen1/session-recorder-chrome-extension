/**
 * Options persistence: saving the transcription config writes it to
 * chrome.storage.local (the same key the background reads at transcription time).
 */
import { test, expect, extUrl } from './support';

test('persists transcription settings to chrome.storage.local', async ({
  context,
  background,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(extUrl(extensionId, 'options.html'));

  const section = page
    .locator('section.settings__section')
    .filter({ has: page.getByRole('heading', { name: 'Transcription' }) });

  await section.getByRole('combobox').selectOption('deepgram');
  await section.locator('input[type="password"]').fill('test-key-123');
  await section.getByRole('button', { name: 'Save' }).click();

  // Confirmation badge appears.
  await expect(page.getByText(/saved/i).first()).toBeVisible();

  // The background can read it back from storage.
  const stored = await background.evaluate(async () => {
    const got = await chrome.storage.local.get('transcription');
    return got.transcription as { provider?: string; apiKey?: string } | undefined;
  });
  expect(stored?.provider).toBe('deepgram');
  expect(stored?.apiKey).toBe('test-key-123');
});
