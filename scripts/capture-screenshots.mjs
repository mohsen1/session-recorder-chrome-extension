/**
 * Capture the real extension with fictional checkout evidence, in both themes.
 * Run pnpm build first, then node scripts/capture-screenshots.mjs.
 * Uses a disposable Chromium profile; blocks external network requests.
 * Record/recording images pair actual page and panel screenshots at native size.
 */
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "docs/screenshots");
await mkdir(out, { recursive: true });
const fixture = await readFile(resolve(root, "demo/checkout.html"));
const server = createServer((_req, res) => {
	res.writeHead(200, { "content-type": "text/html" });
	res.end(fixture);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const ext = resolve(
	process.env.EXTENSION_PATH || resolve(root, ".output/chrome-mv3"),
);
const context = await chromium.launchPersistentContext("", {
	channel: "chromium",
	headless: true,
	args: [
		`--disable-extensions-except=${ext}`,
		`--load-extension=${ext}`,
		"--no-first-run",
		"--disable-gpu",
	],
	viewport: { width: 1220, height: 780 },
});
try {
	await context.route(/^https?:\/\//, (route) =>
		route.request().url().startsWith(origin) ? route.continue() : route.abort(),
	);
	let background = context.serviceWorkers()[0];
	if (!background) background = await context.waitForEvent("serviceworker");
	const id = new URL(background.url()).host;
	const dispatch = (msg) =>
		background.evaluate((msg) => globalThis.__srTest(msg), msg);
	const page = await context.newPage();
	await page.goto(origin);
	const tabId = await background.evaluate(
		async (origin) =>
			(await chrome.tabs.query({})).find((tab) => tab.url?.startsWith(origin))
				.id,
		origin,
	);
	const panel = await context.newPage();
	await panel.setViewportSize({ width: 380, height: 780 });
	await panel.goto(`chrome-extension://${id}/sidepanel.html`);
	await expect(
		panel.getByRole("button", { name: "Start recording", exact: true }),
	).toBeVisible();
	async function pair(name, theme) {
		await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
		await panel.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
		await page.evaluate(() => document.fonts.ready);
		await panel.evaluate(() => document.fonts.ready);
		await page.bringToFront();
		const a = await page.screenshot({ animations: "disabled" });
		await panel.bringToFront();
		const b = await panel.screenshot({ animations: "disabled" });
		const sheet = await context.newPage();
		await sheet.setViewportSize({ width: 1600, height: 780 });
		await sheet.setContent(
			`<html><body style="margin:0;display:flex"><img width="1220" height="780" src="data:image/png;base64,${a.toString("base64")}"><img width="380" height="780" src="data:image/png;base64,${b.toString("base64")}" style="box-sizing:border-box;border-left:1px solid ${theme === "dark" ? "#303535" : "#dedede"}"></body></html>`,
		);
		await sheet.bringToFront();
		await sheet.screenshot({ path: resolve(out, `${name}-${theme}.png`) });
		await sheet.close();
	}
	for (const theme of ["light", "dark"]) await pair("record", theme);
	const started = await dispatch({ kind: "session/start", tabId });
	if (!started.ok) throw new Error(JSON.stringify(started));
	await page.getByLabel("Discount code").fill("SAVE20");
	await page.getByRole("button", { name: "Apply", exact: true }).click();
	await dispatch({
		kind: "note/add",
		text: "The code says 20% off, but the total is still $120.",
	});
	await dispatch({
		kind: "marker/add",
		name: "Discount is not reflected in the total",
	});
	await expect(
		panel.getByRole("button", { name: "Annotate", exact: true }),
	).toBeVisible();
	for (const theme of ["light", "dark"]) await pair("recording", theme);
	await panel.getByRole("button", { name: "Annotate", exact: true }).click();
	const host = page.locator("#__session_recorder_point_annotation_host__");
	await expect(
		host.getByRole("button", { name: "Turn off annotations" }),
	).toBeVisible();
	const box = await page.locator("#total").boundingBox();
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await host
		.getByLabel("Comment", { exact: true })
		.fill("SAVE20 is applied, but the total should be $96.");
	for (const theme of ["light", "dark"]) await pair("annotate", theme);
	await host.getByRole("button", { name: "Add comment", exact: true }).click();
	await panel.getByRole("button", { name: "Annotate", exact: true }).click();
	const evidence = (
		await page.screenshot({ animations: "disabled", fullPage: true })
	).toString("base64");
	await dispatch({ kind: "session/stop" });
	const title = "Discount code applies without updating the order total";
	const body =
		"## Summary\n\nApplying **SAVE20** shows a success message, but the order total stays at **$120.00**. The expected total after 20% off is **$96.00**.\n\n## Steps to reproduce\n\n1. Open checkout with a Weekender pack in the bag.\n2. Enter **SAVE20** in the discount field and select **Apply**.\n3. Compare the success message with the order total.\n\n## Expected behavior\n\nThe total updates to $96.00 before continuing to payment.\n\n## Actual behavior\n\nThe page confirms the discount while showing the original $120.00 total.\n\n## Reporter’s annotation\n\n> SAVE20 is applied, but the total should be $96.";
	await background.evaluate(
		async ({ sessionId, evidence, title, body }) => {
			await chrome.storage.local.set({
				[`shareDraft:${sessionId}`]: {
					draft: { title, body },
					repository: "northstar-demo/storefront",
					draftSource: "edited",
				},
			});
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open("session-recorder");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const tx = db.transaction(["assets", "events", "sessions"], "readwrite");
			const bytes = Uint8Array.from(atob(evidence), (c) => c.charCodeAt(0));
			const blob = new Blob([bytes], { type: "image/png" });
			tx.objectStore("assets").put({
				id: "demo-checkout-evidence",
				sessionId,
				kind: "screenshot",
				mime: "image/png",
				size: blob.size,
				blob,
			});
			tx.objectStore("events").put({
				id: "demo-checkout-shot",
				sessionId,
				t: 14000,
				type: "screenshot",
				importance: 80,
				protected: true,
				payload: {
					assetId: "demo-checkout-evidence",
					width: 1220,
					height: 780,
					trigger: "manual",
				},
			});
			const get = tx.objectStore("sessions").get(sessionId);
			get.onsuccess = () => {
				const session = get.result;
				session.name = title;
				session.startedAt = Date.now() - 62000;
				session.endedAt = Date.now();
				session.assetBytes += blob.size;
				tx.objectStore("sessions").put(session);
			};
			await new Promise((resolve, reject) => {
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
			db.close();
		},
		{ sessionId: started.session.id, evidence, title, body },
	);
	const report = await context.newPage();
	await report.setViewportSize({ width: 1600, height: 950 });
	await report.goto(
		`chrome-extension://${id}/share.html?session=${started.session.id}`,
	);
	await expect(
		report.getByRole("textbox", { name: "Issue title" }),
	).toHaveValue(title);
	await expect(
		report.getByRole("heading", { name: "Summary", exact: true }),
	).toBeVisible();
	for (const theme of ["light", "dark"]) {
		await report.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
		await report.evaluate(() => document.fonts.ready);
		await report.bringToFront();
		await report.screenshot({
			path: resolve(out, `report-${theme}.png`),
			animations: "disabled",
			clip: { x: 0, y: 0, width: 1600, height: 780 },
		});
	}
	await writeFile(
		resolve(out, "capture.json"),
		JSON.stringify(
			{
				source: "scripts/capture-screenshots.mjs",
				fixture: "demo/checkout.html",
				data: "Fictional Northstar checkout. No account, API keys or external requests.",
				views: {
					record: { width: 1600, height: 780 },
					recording: { width: 1600, height: 780 },
					annotate: { width: 1600, height: 780 },
					report: { width: 1600, height: 780 },
				},
				composition:
					"Record, recording and annotation pair screenshots of the actual demo tab and actual extension side panel at native dimensions. Report captures the actual issue draft page. The report draft is deterministic fixture copy.",
			},
			null,
			2,
		) + "\n",
	);
	console.log(`Captured 8 screenshots in ${out}`);
} finally {
	await context.close();
	await new Promise((resolve) => server.close(resolve));
}
