import { expect, type Page } from '@playwright/test';

export async function openNavigation(page: Page) {
	const trigger = page.getByRole('button', { name: 'Open Navigation', exact: true });
	if ((page.viewportSize()?.width ?? 1280) <= 900) await trigger.click();
}

/** A valid 2×2 PNG accepted by the backend's document validation. */
export const supportingPng = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII=',
	'base64'
);

/**
 * Submission requires at least one supporting document. On a requisition detail page,
 * attach one if the draft has none, then wait until Review & Submit can be used.
 */
export async function attachSupportingDocument(
	page: Page,
	name = 'supporting-quote.png',
	{ expectSubmittable = true } = {}
) {
	const documents = page.locator('section').filter({
		has: page.getByRole('heading', { name: 'Supporting Documents', exact: true })
	});
	await expect(documents.getByText(/PDF, PNG or JPEG/)).toBeVisible();
	if (await documents.getByText('No supporting documents attached.', { exact: true }).isVisible()) {
		await documents
			.getByLabel('Supporting Document', { exact: true })
			.setInputFiles({ name, mimeType: 'image/png', buffer: supportingPng });
		await expect(page.getByRole('button', { name: 'View ' + name })).toBeVisible();
	}
	if (expectSubmittable)
		await expect(page.getByRole('button', { name: 'Review & Submit', exact: true })).toBeEnabled();
}
