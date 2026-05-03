import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('PDF Merger', () => {
  let tempDir: string;

  test.beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(__dirname, 'pdf-merger-test-'));
  });

  test.afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should merge two PDFs', async ({ page }) => {
    // Generate two dummy PDFs
    const pdfDoc1 = await PDFDocument.create();
    const page1 = pdfDoc1.addPage();
    page1.drawText('This is PDF 1');
    const pdfBytes1 = await pdfDoc1.save();
    const pdfPath1 = path.join(tempDir, 'dummy1.pdf');
    fs.writeFileSync(pdfPath1, pdfBytes1);

    const pdfDoc2 = await PDFDocument.create();
    const page2 = pdfDoc2.addPage();
    page2.drawText('This is PDF 2');
    const pdfBytes2 = await pdfDoc2.save();
    const pdfPath2 = path.join(tempDir, 'dummy2.pdf');
    fs.writeFileSync(pdfPath2, pdfBytes2);

    await page.goto('/pdf-merger.html');

    const fileInput = page.locator('#pdf-files');
    await fileInput.setInputFiles([pdfPath1, pdfPath2]);

    const fileList = page.locator('#file-list li');
    await expect(fileList).toHaveCount(2);

    const mergeBtn = page.locator('#merge-btn');

    await mergeBtn.click();

    // Wait for the download link to appear
    const downloadLink = page.locator('#output a');
    await expect(downloadLink).toBeVisible();

    // Wait for the download event
    const downloadPromise = page.waitForEvent('download');
    await downloadLink.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('merged.pdf');

    // Save to temp and verify
    const downloadedPath = path.join(tempDir, 'downloaded.pdf');
    await download.saveAs(downloadedPath);

    const downloadedBytes = fs.readFileSync(downloadedPath);
    const downloadedDoc = await PDFDocument.load(downloadedBytes);
    expect(downloadedDoc.getPageCount()).toBe(2);
  });
});
