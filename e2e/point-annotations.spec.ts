import { test, expect, dispatch, tabIdForUrl, extUrl } from './support';

test('toggles live comments without activating the page and preserves screenshot markup', async ({
  context,
  background,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto('/');
  const tabId = await tabIdForUrl(background, 'http://localhost:5319');
  const started = await dispatch<{ ok: boolean; session: { id: string } }>(background, {
    kind: 'session/start',
    tabId,
  });
  expect(started.ok).toBe(true);
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 390, height: 844 });
  await panel.goto(extUrl(extensionId, 'sidepanel.html'));
  await expect(
    panel.getByRole('button', { name: 'Annotate', exact: true }),
  ).toBeVisible();
  await panel.bringToFront();
  await expect(
    panel.getByRole('button', { name: 'Screenshot', exact: true }),
  ).toBeInViewport();

  await panel.getByRole('button', { name: 'Annotate', exact: true }).click();
  const host = page.locator('#__session_recorder_point_annotation_host__');
  await expect(
    host.getByRole('button', { name: 'Turn off annotations' }),
  ).toBeVisible();
  await expect(host.getByRole('button', { name: 'Turn off annotations' })).toHaveCSS('outline-style', 'none');
  const bounds = await page.locator('#btn-get').boundingBox();
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await expect(host.getByLabel('Comment', { exact: true })).toBeVisible();
  await host
    .getByLabel('Comment', { exact: true })
    .fill('This fetch button should show a useful error.');
  await page.screenshot({
    path: '.impeccable/review/annotation-element.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.impeccable/review/annotation-mobile.png',
    animations: 'disabled',
  });
  const composer = await host.getByRole('dialog').boundingBox();
  expect(composer!.x).toBeGreaterThanOrEqual(0);
  expect(composer!.x + composer!.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 720 });
  await host.getByRole('button', { name: 'Add comment', exact: true }).click();
  await expect(host.getByRole('status')).toHaveText('Comment added to the recording.');
  await expect(
    panel.getByRole('button', { name: 'Annotate', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Drag backwards to ensure arbitrary regions normalize both axes.
  await page.mouse.move(480, 400);
  await page.mouse.down();
  await page.mouse.move(180, 200, { steps: 8 });
  await page.mouse.up();
  await host
    .getByLabel('Comment', { exact: true })
    .fill('This entire area needs attention.');
  await page.screenshot({
    path: '.impeccable/review/annotation-region.png',
    animations: 'disabled',
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: '.impeccable/review/annotation-region-dark.png',
    animations: 'disabled',
  });
  await host.getByLabel('Comment', { exact: true }).press('Enter');
  await expect(host.getByRole('status')).toHaveText('Comment added to the recording.');
  await panel.getByRole('button', { name: 'Annotate', exact: true }).click();
  await expect(host).toHaveCount(0);
  const result = await dispatch<{ events: Array<{ type: string; payload: any }> }>(
    background,
    { kind: 'events/get', sessionId: started.session.id },
  );
  const annotations = result.events.filter((e) => e.type === 'annotation');
  expect(annotations).toHaveLength(2);
  expect(annotations[1]!.payload.shapes[0].rect).toEqual({
    x: 180,
    y: 200,
    w: 300,
    h: 200,
  });
  expect(annotations[1]!.payload.shapes[0].targetDescriptor).toBeUndefined();
  await panel.emulateMedia({ colorScheme: 'dark', reducedMotion:'reduce' });
  await expect(
    panel.getByRole('button', { name: 'Screenshot', exact: true }),
  ).toBeInViewport();
  await panel.screenshot({ path: '.impeccable/review/panel-recording-dark.png' });

  expect(annotations[0]!.payload.shapes[0].text).toContain('useful error');
  expect(annotations[0]!.payload.shapes[0].targetDescriptor.selector).toBe('#btn-get');
  expect(
    result.events.filter(
      (e) => e.type === 'click' && e.payload.descriptor?.id === 'btn-get',
    ),
  ).toHaveLength(0);
  await page.locator('#btn-get').click();
  await panel.getByRole('button', { name: 'Annotate', exact: true }).click();
  await expect(host).toBeVisible();
  await dispatch(background, { kind: 'session/pause' });
  await expect(host).toHaveCount(0);
  await dispatch(background, { kind: 'session/resume' });
  await panel.getByRole('button', { name: 'Annotate', exact: true }).click();
  await page.reload();
  await expect(host).toBeVisible();
  await panel.getByRole('button', { name: 'Markup', exact: true }).click();
  await expect(host).toHaveCount(0);
  // Degraded capture in headless Chromium may not provide an image to the existing markup editor.
  const openedReport = context.waitForEvent('page');
  await dispatch(background, { kind: 'session/stop' });
  await expect(await openedReport).toHaveURL(
    new RegExp(`share.html.*${started.session.id}`),
  );
  const final = await dispatch<{ events: Array<{ type: string; payload: any }> }>(
    background,
    { kind: 'events/get', sessionId: started.session.id },
  );
  const report = await context.newPage();
  await report.goto(extUrl(extensionId, `report.html?session=${started.session.id}`));
  await expect(
    report.getByText('This fetch button should show a useful error.', { exact: true }),
  ).toBeVisible();
  expect(
    final.events.some(
      (e) => e.type === 'click' && e.payload.descriptor?.id === 'btn-get',
    ),
  ).toBe(true);
});
